import { useState } from 'react';
import { Home, Calculator, TrendingUp, Phone, ChevronDown, ChevronUp, CheckCircle, Settings } from 'lucide-react';
import type { Debt } from '../types';
import { StorageService } from '../services/storage';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const parseDollar = (v: string) => parseFloat(v.replace(/[^0-9.]/g, '')) || 0;

/** Credit range labels for PMI table lookup (default: 740-759). */
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

/** Annual PMI as % of loan, by credit range then LTV columns: ~95%, ~90%, ~85% LTV. */
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

/** Map actual LTV to table column: high LTV → 95% bucket, then 90%, then 85%. */
function getPmiLtvColumnIndex(ltvPercent: number): 0 | 1 | 2 | null {
  if (ltvPercent <= 80) return null;
  if (ltvPercent > 90) return 0;
  if (ltvPercent > 85) return 1;
  return 2;
}

function lookupPmiAnnualPercent(credit: CreditScoreRange, column: 0 | 1 | 2): number {
  return PMI_TABLE[credit][column];
}

// ── types ────────────────────────────────────────────────────────────────────
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
  /** Loan-to-value % (loan ÷ home price × 100). */
  ltvPercent: number;
  /** Annual PMI rate % of loan used for this estimate (0 if no PMI). */
  pmiAnnualPercent: number;
}

// ── mortgage math ─────────────────────────────────────────────────────────────
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

/** Front-end = proposed housing / gross; back-end = (housing + existing minimums) / gross */
function getReadinessScore(
  result: CalcResult | null,
  monthlyGrossIncome: number,
  existingDebtMinimums: number
) {
  if (!result || !monthlyGrossIncome || monthlyGrossIncome <= 0) return null;
  const housing = result.monthlyPayment;
  const frontDti = (housing / monthlyGrossIncome) * 100;
  const backDti = ((housing + existingDebtMinimums) / monthlyGrossIncome) * 100;
  // Tiers: classic front 28% / back 36% “ideal”, then back 43% / 50% stress bands
  if (frontDti <= 28 && backDti <= 36) {
    return {
      score: 'Strong' as const,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
      pct: 90,
      msg: "You're in great shape on both housing ratio and total debt. Let's talk.",
      frontDti,
      backDti,
    };
  }
  if (backDti <= 43) {
    return {
      score: 'Good' as const,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200',
      pct: 65,
      msg: 'Solid position. Small changes to price, down payment, or debt can improve your ratios.',
      frontDti,
      backDti,
    };
  }
  if (backDti <= 50) {
    return {
      score: 'Caution' as const,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
      pct: 40,
      msg: 'Possible for some loan types, but lowering back-end DTI (debt paydown or lower housing payment) helps a lot.',
      frontDti,
      backDti,
    };
  }
  return {
    score: 'Not Yet' as const,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    pct: 15,
    msg: "NOVO's debt plan is your next step before buying.",
    frontDti,
    backDti,
  };
}

// ── input field ───────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, prefix, suffix, type = 'text', hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; type?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-gray-400 text-sm font-medium pointer-events-none">{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border border-gray-200 rounded-lg py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent transition ${
            prefix ? 'pl-7 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'
          }`}
        />
        {suffix && (
          <span className="absolute right-3 text-gray-400 text-sm font-medium pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  );
}

// ── result row ────────────────────────────────────────────────────────────────
function ResultRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${highlight ? 'bg-[#1E3A5F] text-white' : 'bg-gray-50'}`}>
      <span className={`text-sm ${highlight ? 'font-semibold' : 'text-gray-600'}`}>{label}</span>
      <span className={`font-bold text-sm ${highlight ? 'text-white' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
type HomeReadyProps = {
  onNavigateToSettings?: () => void;
};

export default function HomeReady({ onNavigateToSettings }: HomeReadyProps) {
  const financialProfile = StorageService.getFinancialProfile();
  const debts = StorageService.getDebts();
  const grossMonthlyIncome = financialProfile?.monthlyGrossIncome ?? 0;
  const monthlyDebtMinimums = sumActiveDebtMinimums(debts);
  const hasFinancialProfile = financialProfile !== null;

  // calculator inputs
  const [homePrice, setHomePrice]       = useState('300000');
  const [downPayment, setDownPayment]   = useState('15000');
  const [rate, setRate]                 = useState('6.75');
  const [term, setTerm]                 = useState('30');
  const [annualTax, setAnnualTax]       = useState('3600');
  const [annualIns, setAnnualIns]       = useState('1200');
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
  const backEndDti = canComputeDti ? ((proposedMortgage + monthlyDebtMinimums) / grossMonthlyIncome) * 100 : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">

      {/* ── header ── */}
      <div className="bg-[#1E3A5F] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Home Ready</h1>
            <p className="text-blue-200 text-sm">Your path from debt freedom to homeownership</p>
          </div>
        </div>
        <p className="text-sm text-blue-100 mt-3 leading-relaxed">
          Use this calculator to see what a home would cost monthly — and whether your current financial position makes you ready to buy.
        </p>
      </div>

      {!hasFinancialProfile && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
          <div className="flex gap-3">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-amber-800" />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="font-semibold text-amber-900">Complete your financial profile</p>
              <p className="text-sm text-amber-900/90 leading-relaxed">
                We pull your <strong>gross monthly income</strong> and <strong>existing debt minimum payments</strong> from NOVO to estimate DTI. Add your profile in Settings to unlock readiness and ratio insights.
              </p>
              {onNavigateToSettings && (
                <button
                  type="button"
                  onClick={onNavigateToSettings}
                  className="mt-1 inline-flex items-center gap-2 rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 transition-colors"
                >
                  Open Settings
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {hasFinancialProfile && grossMonthlyIncome <= 0 && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-gray-800">
          <p className="text-sm font-medium text-gray-900">Gross monthly income not set</p>
          <p className="text-sm text-gray-600 mt-1">
            Enter a positive gross monthly income in Settings → Financial Profile to see DTI and readiness.
          </p>
          {onNavigateToSettings && (
            <button
              type="button"
              onClick={onNavigateToSettings}
              className="mt-3 text-sm font-semibold text-[#2D9CDB] hover:underline"
            >
              Open Settings
            </button>
          )}
        </div>
      )}

      {/* ── calculator card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-gray-50">
          <Calculator className="w-4 h-4 text-[#FF6B35]" />
          <h2 className="font-semibold text-gray-800 text-sm">Mortgage Payment Calculator</h2>
        </div>

        <div className="p-6 space-y-4">

          {/* row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Home Price" value={homePrice} onChange={setHomePrice} prefix="$"
              hint="What price range are you considering?" />
            <div>
              <Field label="Down Payment" value={downPayment} onChange={setDownPayment} prefix="$" />
              {result && (
                <p className="text-xs text-gray-400 mt-1">
                  {downPct}% down
                  {result.downPct < 20 && <span className="text-amber-500"> · PMI applies</span>}
                </p>
              )}
            </div>
          </div>

          {/* row 2 */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Interest Rate" value={rate} onChange={setRate} suffix="%" hint="Current avg ~6.75%" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Term</label>
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent transition"
              >
                <option value="30">30 years</option>
                <option value="20">20 years</option>
                <option value="15">15 years</option>
                <option value="10">10 years</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Credit score range</label>
            <p className="text-xs text-gray-400 mb-1">Used with LTV to estimate PMI (not a hard pull).</p>
            <select
              value={creditScoreRange}
              onChange={(e) => setCreditScoreRange(e.target.value as CreditScoreRange)}
              className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent transition"
            >
              {CREDIT_SCORE_RANGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-[#2D9CDB] font-medium hover:underline"
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showAdvanced ? 'Hide' : 'Add'} taxes & insurance
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <Field label="Annual Property Tax" value={annualTax} onChange={setAnnualTax} prefix="$"
                hint="Check county auditor site" />
              <Field label="Annual Home Insurance" value={annualIns} onChange={setAnnualIns} prefix="$"
                hint="Avg ~$1,200/yr in Ohio" />
            </div>
          )}
        </div>
      </div>

      {/* ── results ── */}
      {result && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-gray-50">
            <TrendingUp className="w-4 h-4 text-[#FF6B35]" />
            <h2 className="font-semibold text-gray-800 text-sm">Your Estimated Payment</h2>
          </div>

          <div className="p-6 space-y-3">
            <ResultRow label="Estimated Monthly Payment" value={fmt(result.monthlyPayment)} highlight />
            <ResultRow label="Loan Amount" value={fmt(result.loanAmount)} />
            <ResultRow label="Principal & Interest" value={fmt(result.principalAndInterest)} />

            {/* breakdown toggle */}
            <button
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="flex items-center gap-1.5 text-xs text-[#2D9CDB] font-medium hover:underline pt-1"
            >
              {showBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showBreakdown ? 'Hide' : 'Show'} full breakdown
            </button>

            {showBreakdown && (
              <div className="space-y-2 pt-1">
                <ResultRow label="Monthly Property Tax" value={fmt(result.monthlyTax)} />
                <ResultRow label="Monthly Insurance" value={fmt(result.monthlyInsurance)} />
                {result.monthlyPMI > 0 && (
                  <div className="rounded-lg overflow-hidden">
                    <ResultRow
                      label={`PMI (est. · ${result.pmiAnnualPercent.toFixed(2)}%/yr of loan · LTV ${result.ltvPercent.toFixed(1)}%)`}
                      value={fmt(result.monthlyPMI)}
                    />
                    <div className="px-3 pb-2 pt-0 space-y-1.5 bg-gray-50 border-t border-gray-100">
                      <p className="text-xs text-gray-500 leading-relaxed">
                        PMI estimate based on credit range and LTV. Actual rate varies by lender and PMI provider.
                      </p>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        For illustration only: your exact credit score and provider pricing may differ, and market factors can change over time.
                      </p>
                    </div>
                  </div>
                )}
                <ResultRow label="Total Interest Paid" value={fmt(result.totalInterest)} />
                <ResultRow label="Total Cost Over Loan" value={fmt(result.totalCost)} />
              </div>
            )}

            {canComputeDti && frontEndDti !== null && backEndDti !== null && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Debt-to-income (gross)</p>
                <ResultRow label="Current monthly debt obligations (minimums)" value={fmt(monthlyDebtMinimums)} />
                <ResultRow label="Proposed total housing payment (PITI + PMI)" value={fmt(proposedMortgage)} />
                <ResultRow label="Front-end DTI (housing ÷ gross income)" value={`${frontEndDti.toFixed(1)}%`} />
                <ResultRow label="Back-end DTI (housing + debt minimums ÷ gross)" value={`${backEndDti.toFixed(1)}%`} highlight />
                <p className="text-xs text-gray-500 pt-1">
                  Guidelines often cite ~28% front-end and ~36–43% back-end depending on loan type; actual approval depends on the lender.
                </p>
              </div>
            )}

            {result.downPct < 20 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-2">
                <p className="text-xs text-amber-700 font-medium">
                  💡 Put 20% down ({fmt(parseDollar(homePrice) * 0.2)}) to eliminate PMI and save {fmt(result.monthlyPMI)}/mo.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── readiness score ── */}
      {result && hasFinancialProfile && grossMonthlyIncome > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-gray-50">
            <CheckCircle className="w-4 h-4 text-[#FF6B35]" />
            <h2 className="font-semibold text-gray-800 text-sm">Homebuyer Readiness Score</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-500 font-medium">Gross monthly income (from profile)</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmt(grossMonthlyIncome)}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-500 font-medium">Current debt minimums (active debts)</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmt(monthlyDebtMinimums)}</p>
              </div>
            </div>

            {readiness && (
              <div className={`border rounded-xl p-4 ${readiness.bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Readiness Level</span>
                  <span className={`font-bold text-lg ${readiness.color}`}>{readiness.score}</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                  <div
                    className="h-2.5 rounded-full transition-all duration-700"
                    style={{
                      width: `${readiness.pct}%`,
                      backgroundColor:
                        readiness.score === 'Strong' ? '#10b981' :
                        readiness.score === 'Good'   ? '#2D9CDB' :
                        readiness.score === 'Caution'? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>

                <p className="text-sm text-gray-600">{readiness.msg}</p>

                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  <p>
                    Front-end DTI: <strong>{readiness.frontDti.toFixed(1)}%</strong>
                    <span className="text-gray-400 ml-1">(proposed housing ÷ gross)</span>
                  </p>
                  <p>
                    Back-end DTI: <strong>{readiness.backDti.toFixed(1)}%</strong>
                    <span className="text-gray-400 ml-1">(housing + existing minimums ÷ gross)</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CTA ── */}
      <div className="bg-[#1E3A5F] rounded-2xl p-6 text-white text-center">
        <Phone className="w-8 h-8 text-[#FF6B35] mx-auto mb-3" />
        <h3 className="font-bold text-lg mb-2">Ready to Take the Next Step?</h3>
        <p className="text-blue-200 text-sm mb-4 leading-relaxed">
          Whether you're 6 months out or 6 years out, a 15-minute call with Ben can show you exactly what needs to happen first.
        </p>
        <a
          href="https://windmillmortgage.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-[#FF6B35] hover:bg-[#e85d2a] text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm shadow-lg"
        >
          Talk to Ben · Windmill Mortgage
        </a>
        <p className="text-xs text-blue-300 mt-3">No pressure. No obligation. Just a real conversation.</p>
      </div>

    </div>
  );
}
