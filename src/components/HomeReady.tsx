import { useState } from 'react';
import { Home, Calculator, TrendingUp, Phone, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const parseDollar = (v: string) => parseFloat(v.replace(/[^0-9.]/g, '')) || 0;

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
}

// ── mortgage math ─────────────────────────────────────────────────────────────
function calcMortgage(
  homePrice: number,
  downPayment: number,
  rate: number,
  termYears: number,
  annualTax: number,
  annualInsurance: number
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
  const monthlyPMI = downPct < 20 ? (loanAmount * 0.008) / 12 : 0;

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
  };
}

// ── readiness score ───────────────────────────────────────────────────────────
function getReadinessScore(result: CalcResult | null, monthlyIncome: number) {
  if (!result || !monthlyIncome) return null;
  const dti = (result.monthlyPayment / monthlyIncome) * 100;
  if (dti <= 28) return { score: 'Strong', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', pct: 90, msg: "You're in great shape. Let's talk." };
  if (dti <= 36) return { score: 'Good', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', pct: 65, msg: 'Solid position. A few tweaks could help.' };
  if (dti <= 43) return { score: 'Caution', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', pct: 40, msg: 'Possible, but debt paydown first helps a lot.' };
  return { score: 'Not Yet', color: 'text-red-600', bg: 'bg-red-50 border-red-200', pct: 15, msg: "NOVO's debt plan is your next step before buying." };
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
export default function HomeReady() {
  // calculator inputs
  const [homePrice, setHomePrice]       = useState('300000');
  const [downPayment, setDownPayment]   = useState('15000');
  const [rate, setRate]                 = useState('6.75');
  const [term, setTerm]                 = useState('30');
  const [annualTax, setAnnualTax]       = useState('3600');
  const [annualIns, setAnnualIns]       = useState('1200');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const result = calcMortgage(
    parseDollar(homePrice),
    parseDollar(downPayment),
    parseFloat(rate) || 0,
    parseInt(term) || 30,
    parseDollar(annualTax),
    parseDollar(annualIns)
  );

  const readiness = getReadinessScore(result, parseDollar(monthlyIncome));
  const downPct = result ? result.downPct.toFixed(1) : '0';

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
                  <ResultRow label="PMI (< 20% down)" value={fmt(result.monthlyPMI)} />
                )}
                <ResultRow label="Total Interest Paid" value={fmt(result.totalInterest)} />
                <ResultRow label="Total Cost Over Loan" value={fmt(result.totalCost)} />
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
      {result && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-gray-50">
            <CheckCircle className="w-4 h-4 text-[#FF6B35]" />
            <h2 className="font-semibold text-gray-800 text-sm">Homebuyer Readiness Score</h2>
          </div>
          <div className="p-6 space-y-4">
            <Field
              label="Your Gross Monthly Income"
              value={monthlyIncome}
              onChange={setMonthlyIncome}
              prefix="$"
              hint="Enter to see your readiness score"
            />

            {readiness && (
              <div className={`border rounded-xl p-4 ${readiness.bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Readiness Level</span>
                  <span className={`font-bold text-lg ${readiness.color}`}>{readiness.score}</span>
                </div>

                {/* progress bar */}
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

                <div className="mt-3 text-xs text-gray-500">
                  Housing ratio: <strong>{((result.monthlyPayment / parseDollar(monthlyIncome)) * 100).toFixed(1)}%</strong> of gross income
                  <span className="ml-2 text-gray-400">(guideline: under 28%)</span>
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
