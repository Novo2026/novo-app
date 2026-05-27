import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Sparkles, CheckCircle2 } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import { getHomeReadyFullAnalysisForReport } from '../utils/homeReadySnapshot';
import {
  type PaymentFrequency,
  loadPaymentFrequencies,
  savePaymentFrequency,
  loadPaymentCommitments,
  savePaymentCommitment,
  removePaymentCommitment,
  projectPayoffForFrequencyForDebt,
  calculateMonthlyPayoffForDebt,
  markSmarterPaymentsVisited,
  getMotivationalMessage,
  getJourneyStep,
  formatPayoffDateLabel,
  type JourneyStep,
} from '../utils/paymentCalculations';
import type { Debt, DebtCategory } from '../types';

const FREQUENCIES: { id: PaymentFrequency; label: string }[] = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'biweekly', label: 'Bi-Weekly' },
  { id: 'weekly', label: 'Weekly' },
];

function categoryLabel(category: DebtCategory): string {
  const map: Record<DebtCategory, string> = {
    'Credit Card': 'Credit card',
    'Auto Loan': 'Auto',
    Mortgage: 'Mortgage',
    'Student Loan': 'Student loan',
    'Personal Loan': 'Personal',
    HELOC: 'HELOC',
    Other: 'Other',
  };
  return map[category] ?? category;
}

interface SmarterPaymentsProps {
  onDataUpdate?: () => void;
}

export default function SmarterPayments({ onDataUpdate }: SmarterPaymentsProps) {
  const [frequencies, setFrequencies] = useState<Record<string, PaymentFrequency>>(() =>
    loadPaymentFrequencies()
  );
  const [commitments, setCommitments] = useState(() => loadPaymentCommitments());

  useEffect(() => {
    markSmarterPaymentsVisited();
  }, []);

  const debts = useMemo(
    () => StorageService.getDebts().filter(d => !d.isPaidOff && d.currentBalance > 0),
    [frequencies, commitments]
  );

  const financialProfile = StorageService.getFinancialProfile();
  const homeAnalysis = getHomeReadyFullAnalysisForReport(financialProfile, StorageService.getDebts());
  const journeyStep = getJourneyStep(
    debts.length,
    homeAnalysis?.backDtiNum ?? null,
    homeAnalysis?.readinessLevel ?? null
  );

  const handleFrequencyChange = (debtId: string, freq: PaymentFrequency) => {
    savePaymentFrequency(debtId, freq);
    removePaymentCommitment(debtId);
    setFrequencies(loadPaymentFrequencies());
    setCommitments(loadPaymentCommitments());
    onDataUpdate?.();
  };

  const handleCommitmentToggle = (debtId: string, freq: PaymentFrequency, checked: boolean) => {
    if (checked) {
      savePaymentCommitment(debtId, freq);
    } else {
      removePaymentCommitment(debtId);
    }
    setCommitments(loadPaymentCommitments());
    onDataUpdate?.();
  };

  const summary = useMemo(() => {
    let totalInterestSaved = 0;
    let totalMonthsSaved = 0;

    for (const debt of debts) {
      const freq = frequencies[debt.id] ?? 'monthly';
      const monthly = calculateMonthlyPayoffForDebt(debt);
      const selected = projectPayoffForFrequencyForDebt(debt, freq);

      if (monthly.months < 999 && selected.months < 999) {
        const interestSaved = Math.max(0, monthly.totalInterest - selected.totalInterest);
        const monthsSaved = Math.max(0, monthly.months - selected.months);
        if (freq !== 'monthly') {
          totalInterestSaved += interestSaved;
          totalMonthsSaved += monthsSaved;
        }
      } else if (freq !== 'monthly' && monthly.months < 999 && selected.months < monthly.months) {
        totalMonthsSaved += monthly.months - selected.months;
        totalInterestSaved += Math.max(0, monthly.totalInterest - selected.totalInterest);
      }
    }

    return { totalInterestSaved, totalMonthsSaved };
  }, [debts, frequencies]);

  const journeySteps: { label: string; step: JourneyStep }[] = [
    { label: 'Debt Payoff', step: 0 },
    { label: 'Home Ready', step: 1 },
    { label: 'Homeowner', step: 2 },
  ];

  if (debts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#1E3A5F]/10 flex items-center justify-center">
            <CalendarClock className="w-6 h-6 text-[#1E3A5F]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1E3A5F]">Smarter Payments</h1>
            <p className="text-gray-600 text-sm">Pay off debt faster without spending more</p>
          </div>
        </div>
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
          <p className="text-gray-700 font-medium mb-2">No active debts yet</p>
          <p className="text-gray-600 text-sm">
            Add your debts in the My Debts tab to see your Smarter Payments options.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#1E3A5F]/10 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-6 h-6 text-[#1E3A5F]" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1E3A5F]">Smarter Payments</h1>
          <p className="text-gray-600 text-sm">Same budget. Faster payoff.</p>
        </div>
      </div>

      {/* Section 1 */}
      <section className="bg-gradient-to-br from-[#1E3A5F] to-[#2D5A8A] text-white rounded-2xl p-5 sm:p-6 shadow-lg">
        <h2 className="text-lg sm:text-xl font-bold mb-3">Pay Off Debt Faster — Without Spending More</h2>
        <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
          Making bi-weekly or weekly payments instead of monthly is one of the most powerful debt payoff
          strategies most people never use. By splitting your monthly payment in half and paying every two
          weeks, you make 26 half-payments per year — equal to 13 full monthly payments instead of 12. That
          one extra payment per year can shave years off your debt and save thousands in interest. No extra
          money required.
        </p>
      </section>

      {/* Section 2 */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Your debts</h2>
        {debts.map(debt => {
          const freq = frequencies[debt.id] ?? 'monthly';
          const monthly = calculateMonthlyPayoffForDebt(debt);
          const selected = projectPayoffForFrequencyForDebt(debt, freq);
          const interestSaved =
            monthly.months < 999 && selected.months < 999
              ? Math.max(0, monthly.totalInterest - selected.totalInterest)
              : 0;
          const monthsSaved =
            monthly.months < 999 && selected.months < 999
              ? Math.max(0, monthly.months - selected.months)
              : 0;
          const unpayable = selected.months >= 999;
          const isAccelerated = freq === 'biweekly' || freq === 'weekly';
          const isCommitted =
            isAccelerated && commitments[debt.id]?.frequency === freq;

          return (
            <article
              key={debt.id}
              className={`bg-white border rounded-xl shadow-sm p-4 sm:p-5 transition-all duration-300 hover:shadow-md ${
                isCommitted
                  ? 'border-emerald-300 border-l-4 border-l-emerald-500'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-base sm:text-lg">{debt.accountName}</h3>
                  <p className="text-sm text-gray-500 capitalize">{categoryLabel(debt.category)}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-600">
                    Balance:{' '}
                    <span className="font-semibold text-gray-900">
                      {CalculationService.formatCurrency(debt.currentBalance)}
                    </span>
                  </p>
                  <p className="text-gray-600">
                    Rate: <span className="font-semibold text-gray-900">{debt.interestRate.toFixed(2)}%</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Payment frequency">
                {FREQUENCIES.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleFrequencyChange(debt.id, id)}
                    className={`flex-1 min-w-[5.5rem] px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-95 ${
                      freq === id
                        ? 'bg-[#FF6B35] text-white shadow-md ring-2 ring-[#FF6B35]/40'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div
                key={freq}
                className="space-y-2 text-sm transition-all duration-300 animate-fadeIn"
              >
                {unpayable ? (
                  <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Minimum payment may be too low for this schedule — try monthly or increase your payment.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <p className="text-gray-600">
                        Payoff date:{' '}
                        <span className="font-semibold text-gray-900">
                          {formatPayoffDateLabel(selected.months)}
                        </span>
                      </p>
                      <p className="text-gray-600">
                        Total interest:{' '}
                        <span className="font-semibold text-gray-900">
                          {CalculationService.formatCurrency(selected.totalInterest)}
                        </span>
                      </p>
                    </div>
                    {freq !== 'monthly' && interestSaved > 0 && (
                      <p className="text-emerald-700 font-semibold flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 flex-shrink-0" />
                        You save {CalculationService.formatCurrency(interestSaved)}
                        {monthsSaved > 0 && (
                          <span className="font-normal text-emerald-600">
                            · {monthsSaved} month{monthsSaved !== 1 ? 's' : ''} sooner
                          </span>
                        )}
                      </p>
                    )}
                    {isAccelerated && (
                      <div className="space-y-2 pt-1">
                        <label className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100/80 transition-colors">
                          <input
                            type="checkbox"
                            checked={isCommitted}
                            onChange={e => handleCommitmentToggle(debt.id, freq, e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#FF6B35] focus:ring-[#FF6B35]"
                          />
                          <span className="text-sm font-medium text-gray-800">
                            I&apos;m committed to this strategy
                          </span>
                        </label>
                        {isCommitted && (
                          <p className="text-emerald-700 text-sm font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                            Strategy locked in ✓ Your plan has been updated
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {/* Section 3 */}
      <section className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-5 sm:p-6 shadow-sm">
        <h2 className="text-lg font-bold text-emerald-900 mb-4">Your combined savings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-white/80 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Interest saved vs monthly</p>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-600">
              {CalculationService.formatCurrency(summary.totalInterestSaved)}
            </p>
          </div>
          <div className="bg-white/80 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Months saved (total)</p>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{summary.totalMonthsSaved}</p>
          </div>
        </div>
        <p className="text-gray-800 text-center font-medium mb-6 italic">
          {getMotivationalMessage(summary.totalInterestSaved)}
        </p>

        <div className="bg-white rounded-xl p-4 border border-emerald-200">
          <p className="text-sm font-semibold text-gray-700 mb-3 text-center">Your journey</p>
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {journeySteps.map(({ label, step }, i) => {
              const active = journeyStep === step;
              const completed = journeyStep > step;
              return (
                <div key={label} className="flex-1 flex flex-col items-center min-w-0">
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-colors ${
                      active
                        ? 'bg-[#FF6B35] text-white ring-4 ring-[#FF6B35]/25'
                        : completed
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {completed ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                  </div>
                  <p
                    className={`mt-2 text-[10px] sm:text-xs font-semibold text-center leading-tight ${
                      active ? 'text-[#FF6B35]' : completed ? 'text-emerald-700' : 'text-gray-500'
                    }`}
                  >
                    {label}
                  </p>
                  {i < journeySteps.length - 1 && (
                    <span
                      className="hidden sm:block absolute"
                      aria-hidden
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex mt-2 h-1 rounded-full overflow-hidden bg-gray-200">
            <div
              className="h-full bg-gradient-to-r from-[#FF6B35] to-emerald-500 transition-all duration-500"
              style={{ width: `${((journeyStep + 1) / 3) * 100}%` }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
