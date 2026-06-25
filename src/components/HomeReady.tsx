import { useState, type MouseEvent } from 'react';
import {
  Home,
  Calculator,
  TrendingUp,
  Phone,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Settings,
  Lightbulb,
  AlertTriangle,
  BadgeCheck,
} from 'lucide-react';
import type { Debt } from '../types';
import { StorageService } from '../services/storage';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const parseDollar = (v: string) => parseFloat(v.replace(/[^0-9.]/g, '')) || 0;

const REFI_BENCHMARK_RATE = 6.5;
const STRATEGY_CALL_URL = 'https://api.leadconnectorhq.com/widget/booking/Ms28gTzPwpR5BbzeU0Dc';

function openBenBookingCalendar(event?: MouseEvent<HTMLAnchorElement>) {
  event?.preventDefault();
  window.open(STRATEGY_CALL_URL, '_blank', 'noopener,noreferrer');
}

export const CREDIT_SCORE_RANGE_OPTIONS = [
  '760+',
  '740-759',
  '720-739',
  '700-719',
  '680-699',
  '660-679',
  '640-659',
  '620-639',
] as const;

export type CreditScoreRange = (typeof CREDIT_SCORE_RANGE_OPTIONS)[number];

const PMI_TABLE: Record<CreditScoreRange, readonly [number, number, number]> = {
  '760+': [0.41, 0.25, 0.19],
  '740-759': [0.54, 0.37, 0.26],
  '720-739': [0.65, 0.44, 0.33],
  '700-719': [0.77, 0.58, 0.41],
  '680-699': [0.93, 0.71, 0.54],
  '660-679': [1.15, 0.88, 0.67],
  '640-659': [1.4, 1.1, 0.85],
  '620-639': [1.75, 1.35, 1.05],
};

function getPmiLtvColumnIndex(ltvPercent: number): 0 | 1 | 2 | null {
  if (ltvPercent <= 80) return null;
  if (ltvPercent > 90) return 0;
  if (ltvPercent > 85) return 1;
  return 2;
}

function lookupPmiAnnualPercent(credit: CreditScoreRange, column: 0 | 1 | 2): number {
  return PMI_TABLE[credit][column];
}

function estimateMonthlyPI(balance: number, annualRate: number, termYears = 30): number {
  if (!balance || !termYears) return 0;
  const monthlyRate = annualRate / 100 / 12;
  const n = termYears * 12;
  if (monthlyRate === 0) return balance / n;
  return (balance * (monthlyRate * Math.pow(1 + monthlyRate, n))) / (Math.pow(1 + monthlyRate, n) - 1);
}

function estimateRefiMonthlySavings(debt: Debt): number {
  const currentPI = estimateMonthlyPI(debt.currentBalance, debt.interestRate);
  const refiPI = estimateMonthlyPI(debt.currentBalance, REFI_BENCHMARK_RATE);
  return Math.max(0, currentPI - refiPI);
}

interface CalcResult {
  monthlyPayment: number;
  principalAndInterest: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyPMI: number;
  totalInterest: number;
  totalCost: number;
  downPct: number;
  loanAmount: number;
  ltvPercent: number;
  pmiAnnualPercent: number;
}

function calcMortgage(
  homePrice: number,
  downPayment: number,
  rate: number,
  termYears: number,
  annualTax: number,
  annualInsurance: number,
  creditScoreRange: CreditScoreRange
): CalcResult | null {
  if (!homePrice || !rate || !termYears) return null;

  const loanAmount = homePrice - downPayment;
  if (loanAmount <= 0) return null;

  const monthlyRate = rate / 100 / 12;
  const n = termYears * 12;

  const pi =
    monthlyRate === 0
      ? loanAmount / n
      : (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n))) /
        (Math.pow(1 + monthlyRate, n) - 1);

  const monthlyTax = annualTax / 12;
  const monthlyInsurance = annualInsurance / 12;
  const downPct = (downPayment / homePrice) * 100;
  const ltvPercent = (loanAmount / homePrice) * 100;

  let monthlyPMI = 0;
  let pmiAnnualPercent = 0;
  if (downPct < 20) {
    const col = getPmiLtvColumnIndex(ltvPercent);
    if (col !== null) {
      pmiAnnualPercent = lookupPmiAnnualPercent(creditScoreRange, col);
      monthlyPMI = (loanAmount * (pmiAnnualPercent / 100)) / 12;
    }
  }

  const monthly = pi + monthlyTax + monthlyInsurance + monthlyPMI;
  const totalInterest = pi * n - loanAmount;
  const totalCost = monthly * n;

  return {
    monthlyPayment: monthly,
    principalAndInterest: pi,
    monthlyTax,
    monthlyInsurance,
    monthlyPMI,
    totalInterest,
    totalCost,
    downPct,
    loanAmount,
    ltvPercent,
    pmiAnnualPercent,
  };
}

function sumActiveDebtMinimums(debts: Debt[]): number {
  return debts.filter((d) => !d.isPaidOff).reduce((sum, d) => sum + (Number(d.minimumPayment) || 0), 0);
}

function getReadinessScore(
  result: CalcResult | null,
  monthlyGrossIncome: number,
  existingDebtMinimums: number
) {
  if (!result || !monthlyGrossIncome || monthlyGrossIncome <= 0) return null;
  const housing = result.monthlyPayment;
  const frontDti = (housing / monthlyGrossIncome) * 100;
  const backDti = ((housing + existingDebtMinimums) / monthlyGrossIncome) * 100;
  if (frontDti <= 28 && backDti <= 36) {
    return {
      score: 'Strong' as const,
      displayLabel: 'Ready',
      badgeClass: 'bg-green-50 text-brand-green border border-brand-green',
      barColor: '#27AE60',
      pct: 90,
      msg: "You're in great shape on both housing ratio and total debt. Let's talk.",
      frontDti,
      backDti,
    };
  }
  if (backDti <= 43) {
    return {
      score: 'Good' as const,
      displayLabel: 'Ready',
      badgeClass: 'bg-green-50 text-brand-green border border-brand-green',
      barColor: '#27AE60',
      pct: 65,
      msg: 'Solid position. Small changes to price, down payment, or debt can improve your ratios.',
      frontDti,
      backDti,
    };
  }
  if (backDti <= 50) {
    return {
      score: 'Caution' as const,
      displayLabel: 'Caution',
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
      barColor: '#f59e0b',
      pct: 40,
      msg: 'Possible for some loan types, but lowering back-end DTI (debt paydown or lower housing payment) helps a lot.',
      frontDti,
      backDti,
    };
  }
  return {
    score: 'Not Yet' as const,
    displayLabel: 'Not Ready',
    badgeClass: 'bg-red-50 text-brand-red border border-brand-red',
    barColor: '#EB5757',
    pct: 15,
    msg: "NOVO's debt plan is your next step before buying.",
    frontDti,
    backDti,
  };
}

function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-brand-gray mb-1.5">{label}</label>
      {hint && <p className="text-[11px] text-brand-gray mb-1">{hint}</p>}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-brand-gray text-sm pointer-events-none">{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border border-brand-gray-border rounded-lg py-2.5 text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-navy transition ${
            prefix ? 'pl-7 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'
          }`}
        />
        {suffix && (
          <span className="absolute right-3 text-brand-gray text-sm pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  if (highlight) {
    return (
      <div className="flex justify-between items-center bg-brand-navy text-white rounded-lg px-4 py-3">
        <span className="text-[13px]">{label}</span>
        <span className="text-base font-medium">{value}</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-brand-gray-border last:border-b-0">
      <span className="text-[13px] text-brand-gray">{label}</span>
      <span className="text-[13px] font-medium text-brand-navy">{value}</span>
    </div>
  );
}

type HomeReadyProps = {
  onNavigateToSettings?: () => void;
};

export default function HomeReady({ onNavigateToSettings }: HomeReadyProps) {
  const financialProfile = StorageService.getFinancialProfile();
  const homeEquity = StorageService.getHomeEquity();
  const ownsHome = homeEquity?.ownsHome === true;
  const debts = StorageService.getDebts();
  const mortgageDebts = debts.filter(
    (d) => d.category === 'Mortgage' && !d.isPaidOff && d.currentBalance > 0
  );
  const highRateMortgages = mortgageDebts.filter((d) => d.interestRate > REFI_BENCHMARK_RATE);
  const grossMonthlyIncome = financialProfile?.monthlyGrossIncome ?? 0;
  const monthlyDebtMinimums = sumActiveDebtMinimums(debts);
  const hasFinancialProfile = financialProfile !== null;

  const [homePrice, setHomePrice] = useState('300000');
  const [downPayment, setDownPayment] = useState('15000');
  const [rate, setRate] = useState('6.75');
  const [term, setTerm] = useState('30');
  const [annualTax, setAnnualTax] = useState('3600');
  const [annualIns, setAnnualIns] = useState('1200');
  const [creditScoreRange, setCreditScoreRange] = useState<CreditScoreRange>('740-759');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const result = calcMortgage(
    parseDollar(homePrice),
    parseDollar(downPayment),
    parseFloat(rate) || 0,
    parseInt(term) || 30,
    parseDollar(annualTax),
    parseDollar(annualIns),
    creditScoreRange
  );

  const readiness =
    hasFinancialProfile && grossMonthlyIncome > 0
      ? getReadinessScore(result, grossMonthlyIncome, monthlyDebtMinimums)
      : null;
  const downPct = result ? result.downPct.toFixed(1) : '0';

  const proposedMortgage = result?.monthlyPayment ?? 0;
  const canComputeDti = hasFinancialProfile && grossMonthlyIncome > 0 && result;
  const frontEndDti = canComputeDti ? (proposedMortgage / grossMonthlyIncome) * 100 : null;
  const backEndDti = canComputeDti
    ? ((proposedMortgage + monthlyDebtMinimums) / grossMonthlyIncome) * 100
    : null;

  const headerSubtitle = ownsHome
    ? 'Manage and optimize your mortgage'
    : 'Your path from debt freedom to homeownership';

  return (
    <div className="bg-brand-gray-light min-h-screen">
      <div className="bg-brand-navy py-3 px-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-white text-lg font-medium leading-tight">Home Ready</h1>
          <p className="text-white/65 text-xs mt-0.5">{headerSubtitle}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-5 pb-12">
        {!ownsHome && (
          <div className="bg-brand-cream border-l-4 border-brand-orange rounded-lg p-4 flex items-start gap-3">
            <Home className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
            <p className="text-[13px] text-brand-navy leading-relaxed">
              Use this calculator to see what a home would cost monthly — and whether your current financial
              position makes you ready to buy.
            </p>
          </div>
        )}

        {!hasFinancialProfile && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <Settings className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-2">
                <p className="font-medium text-brand-navy text-sm">Complete your financial profile</p>
                <p className="text-xs text-brand-gray leading-relaxed">
                  We pull your <strong>gross monthly income</strong> and <strong>existing debt minimum payments</strong>{' '}
                  from NOVO to estimate DTI. Add your profile in Settings to unlock readiness and ratio insights.
                </p>
                {onNavigateToSettings && (
                  <button
                    type="button"
                    onClick={onNavigateToSettings}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-xs font-medium text-white hover:bg-brand-orange-dark transition-colors"
                  >
                    Open Settings
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {hasFinancialProfile && grossMonthlyIncome <= 0 && (
          <div className="rounded-lg border border-brand-gray-border bg-white p-4">
            <p className="text-sm font-medium text-brand-navy">Gross monthly income not set</p>
            <p className="text-xs text-brand-gray mt-1">
              Enter a positive gross monthly income in Settings → Financial Profile to see DTI and readiness.
            </p>
            {onNavigateToSettings && (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="mt-3 text-xs font-medium text-brand-blue hover:underline"
              >
                Open Settings
              </button>
            )}
          </div>
        )}

        <div
          id="mortgage-calculator"
          className="bg-white border border-brand-gray-border rounded-lg border-t-[3px] border-t-brand-navy shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5"
        >
          <div className="flex items-center gap-2 mb-5">
            <Calculator className="w-4 h-4 text-brand-orange" />
            <h2 className="text-sm font-medium text-brand-navy">Mortgage Payment Calculator</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Home Price"
                value={homePrice}
                onChange={setHomePrice}
                prefix="$"
                hint="What price range are you considering?"
              />
              <div>
                <Field label="Down Payment" value={downPayment} onChange={setDownPayment} prefix="$" />
                {result && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <p className="text-[11px] text-brand-gray">{downPct}% down</p>
                    {result.downPct < 20 && (
                      <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        PMI applies
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Interest Rate" value={rate} onChange={setRate} suffix="%" hint="Current avg ~6.75%" />
              <div>
                <label className="block text-xs font-medium text-brand-gray mb-1.5">Loan Term</label>
                <select
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="w-full border border-brand-gray-border rounded-lg py-2.5 px-3 text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-navy transition"
                >
                  <option value="30">30 years</option>
                  <option value="20">20 years</option>
                  <option value="15">15 years</option>
                  <option value="10">10 years</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-gray mb-1.5">Credit score range</label>
              <p className="text-[11px] text-brand-gray mb-1">Used with LTV to estimate PMI (not a hard pull).</p>
              <select
                value={creditScoreRange}
                onChange={(e) => setCreditScoreRange(e.target.value as CreditScoreRange)}
                className="w-full border border-brand-gray-border rounded-lg py-2.5 px-3 text-sm text-brand-navy bg-white focus:outline-none focus:border-brand-navy transition"
              >
                {CREDIT_SCORE_RANGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-brand-blue font-medium hover:underline"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showAdvanced ? 'Hide' : 'Add'} taxes & insurance
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <Field
                  label="Annual Property Tax"
                  value={annualTax}
                  onChange={setAnnualTax}
                  prefix="$"
                  hint="Check county auditor site"
                />
                <Field
                  label="Annual Home Insurance"
                  value={annualIns}
                  onChange={setAnnualIns}
                  prefix="$"
                  hint="Avg ~$1,200/yr in Ohio"
                />
              </div>
            )}
          </div>
        </div>

        {result && (
          <div className="bg-white border border-brand-gray-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-brand-orange" />
              <h2 className="text-sm font-medium text-brand-navy">Your Estimated Payment</h2>
            </div>

            <div className="space-y-1">
              <ResultRow label="Estimated Monthly Payment" value={fmt(result.monthlyPayment)} highlight />
              <ResultRow label="Loan Amount" value={fmt(result.loanAmount)} />
              <ResultRow label="Principal & Interest" value={fmt(result.principalAndInterest)} />

              <button
                type="button"
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="flex items-center gap-1.5 text-xs text-brand-blue font-medium hover:underline pt-2"
              >
                {showBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showBreakdown ? 'Hide' : 'Show'} full breakdown
              </button>

              {showBreakdown && (
                <div className="pt-1">
                  <ResultRow label="Monthly Property Tax" value={fmt(result.monthlyTax)} />
                  <ResultRow label="Monthly Insurance" value={fmt(result.monthlyInsurance)} />
                  {result.monthlyPMI > 0 && (
                    <>
                      <ResultRow
                        label={`PMI (est. · ${result.pmiAnnualPercent.toFixed(2)}%/yr · LTV ${result.ltvPercent.toFixed(1)}%)`}
                        value={fmt(result.monthlyPMI)}
                      />
                      <p className="text-[11px] text-brand-gray leading-relaxed py-2">
                        PMI estimate based on credit range and LTV. Actual rate varies by lender and PMI provider.
                      </p>
                    </>
                  )}
                  <ResultRow label="Total Interest Paid" value={fmt(result.totalInterest)} />
                  <ResultRow label="Total Cost Over Loan" value={fmt(result.totalCost)} />
                </div>
              )}

              {canComputeDti && frontEndDti !== null && backEndDti !== null && (
                <div className="mt-4 pt-4 border-t border-brand-gray-border space-y-1">
                  <p className="text-[11px] uppercase text-brand-gray tracking-wide mb-2">
                    Debt-to-Income (Gross)
                  </p>
                  <ResultRow label="Current monthly debt obligations (minimums)" value={fmt(monthlyDebtMinimums)} />
                  <ResultRow label="Proposed total housing payment (PITI + PMI)" value={fmt(proposedMortgage)} />
                  <ResultRow label="Front-end DTI (housing ÷ gross income)" value={`${frontEndDti.toFixed(1)}%`} />
                  <div className="flex justify-between items-center bg-brand-navy text-white rounded-lg px-4 py-3 mt-2">
                    <span className="text-[13px]">Back-end DTI (housing + debt minimums ÷ gross)</span>
                    <span className="text-base font-medium">{backEndDti.toFixed(1)}%</span>
                  </div>
                  <p className="text-[11px] text-brand-gray italic pt-2">
                    Guidelines often cite ~28% front-end and ~36–43% back-end depending on loan type; actual approval
                    depends on the lender.
                  </p>
                </div>
              )}

              {result.downPct < 20 && (
                <div className="bg-amber-50 border border-amber-200 border-l-4 border-amber-400 rounded-lg p-3 mt-3 flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-brand-navy">
                    Put 20% down ({fmt(parseDollar(homePrice) * 0.2)}) to eliminate PMI and save{' '}
                    {fmt(result.monthlyPMI)}/mo.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {ownsHome ? (
          <>
            <div className="bg-white border border-brand-gray-border rounded-lg border-t-[3px] border-t-brand-blue shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
              <div className="flex items-start gap-3 mb-4">
                <BadgeCheck className="w-5 h-5 text-brand-blue shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-[15px] font-medium text-brand-navy">You&apos;re already a homeowner</h2>
                  <p className="text-[13px] text-brand-gray mt-1 leading-relaxed">
                    Use the calculator above to explore refinance scenarios or plan your next property purchase.
                  </p>
                </div>
              </div>

              {mortgageDebts.length > 0 ? (
                <div className="space-y-3">
                  {mortgageDebts.map((debt) => (
                    <div
                      key={debt.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-brand-gray-border last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-brand-navy">{debt.accountName}</p>
                        <p className="text-xs text-brand-gray mt-0.5">
                          Balance: {fmt(debt.currentBalance)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-brand-blue border border-brand-blue">
                          {debt.interestRate.toFixed(2)}%
                        </span>
                        <a
                          href="#mortgage-calculator"
                          className="text-xs font-medium text-brand-blue hover:underline"
                        >
                          Refi Analysis →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-brand-gray">
                  Add your mortgage in My Debts to see property details here.
                </p>
              )}
            </div>

            {highRateMortgages.map((debt) => {
              const monthlySavings = estimateRefiMonthlySavings(debt);
              return (
                <div
                  key={`refi-${debt.id}`}
                  className="bg-amber-50 border border-amber-200 border-l-4 border-amber-400 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-[13px] font-medium text-brand-navy">Refinance opportunity detected</p>
                      <p className="text-xs text-brand-gray leading-relaxed">
                        Your {debt.accountName} mortgage at {debt.interestRate.toFixed(2)}% may benefit from
                        refinancing at current rates.
                        {monthlySavings > 0 && (
                          <> A lower rate could save you {fmt(monthlySavings)}/month.</>
                        )}
                      </p>
                      <a
                        href={STRATEGY_CALL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={openBenBookingCalendar}
                        className="inline-block text-xs font-medium text-brand-blue hover:underline"
                      >
                        Explore with Ben →
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          result &&
          hasFinancialProfile &&
          grossMonthlyIncome > 0 &&
          readiness && (
            <div className="bg-white border border-brand-gray-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-brand-orange" />
                <h2 className="text-sm font-medium text-brand-navy">Homebuyer Readiness Score</h2>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-brand-gray">Gross monthly income (from profile)</p>
                    <p className="text-base font-medium text-brand-navy mt-0.5">{fmt(grossMonthlyIncome)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-brand-gray">Current debt minimums (active debts)</p>
                    <p className="text-base font-medium text-brand-navy mt-0.5">{fmt(monthlyDebtMinimums)}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] text-brand-gray">Readiness Level</span>
                    <span
                      className={`inline-flex text-[13px] font-medium px-3 py-1 rounded-full ${readiness.badgeClass}`}
                    >
                      {readiness.displayLabel}
                    </span>
                  </div>

                  <div className="w-full bg-brand-gray-border rounded-full h-2 mb-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${readiness.pct}%`,
                        backgroundColor: readiness.barColor,
                      }}
                    />
                  </div>

                  <p className="text-[13px] text-brand-navy">{readiness.msg}</p>

                  <div className="mt-3 space-y-1 text-xs text-brand-gray">
                    <p>
                      Front-end DTI: <span className="text-brand-navy font-medium">{readiness.frontDti.toFixed(1)}%</span>
                      <span className="ml-1">(proposed housing ÷ gross)</span>
                    </p>
                    <p>
                      Back-end DTI: <span className="text-brand-navy font-medium">{readiness.backDti.toFixed(1)}%</span>
                      <span className="ml-1">(housing + existing minimums ÷ gross)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        <div id="strategy-call" className="bg-brand-navy rounded-lg p-6 text-center">
          <Phone className="w-6 h-6 text-brand-orange mx-auto mb-3" />
          <h3 className="text-base font-medium text-white mb-2">Ready to Take the Next Step?</h3>
          <p className="text-white/75 text-[13px] mb-4 leading-relaxed max-w-md mx-auto">
            Ready to talk through your numbers? Book a free 30-minute NOVO Strategy Call.
          </p>
          <a
            href={STRATEGY_CALL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-brand-orange hover:bg-brand-orange-dark text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm"
          >
            Schedule a Strategy Call with Ben
          </a>
          <p className="text-xs text-white/60 mt-3">No pressure. No obligation. Just a real conversation.</p>
        </div>
      </div>
    </div>
  );
}
