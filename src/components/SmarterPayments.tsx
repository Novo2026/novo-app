import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
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
  paymentAmountForFrequency,
  markSmarterPaymentsVisited,
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

function getDebtAccentBorder(debt: Debt): string {
  switch (debt.category) {
    case 'Mortgage':
      return 'border-l-brand-blue';
    case 'Auto Loan':
      return 'border-l-brand-orange';
    case 'Credit Card':
      return 'border-l-brand-red';
    case 'Personal Loan':
      return 'border-l-brand-green';
    default:
      return 'border-l-brand-gray';
  }
}

function getDebtTypePillClasses(debt: Debt): string {
  switch (debt.category) {
    case 'Mortgage':
      return 'inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-brand-blue border border-brand-blue';
    case 'Auto Loan':
      return 'inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-brand-orange-dark border border-brand-orange';
    case 'Credit Card':
      return 'inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-brand-red border border-brand-red';
    case 'Personal Loan':
      return 'inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-brand-green border border-brand-green';
    default:
      return 'inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-50 text-brand-gray border border-brand-gray';
  }
}

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

function PageHeader() {
  return (
    <div className="bg-brand-navy py-3 px-5">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-white text-lg font-medium leading-tight">Smarter Payments</h1>
        <p className="text-white/65 text-xs mt-0.5">Pay less interest without spending more</p>
      </div>
    </div>
  );
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
      <div className="bg-brand-gray-light min-h-screen">
        <PageHeader />
        <div className="max-w-4xl mx-auto px-5 py-8">
          <div className="bg-white border border-dashed border-brand-gray-border rounded-lg p-8 text-center">
            <p className="text-brand-navy font-medium mb-2">No active debts yet</p>
            <p className="text-brand-gray text-sm">
              Add your debts in the My Debts tab to see your Smarter Payments options.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-gray-light min-h-screen">
      <PageHeader />

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-5">
        <div className="bg-brand-cream border-l-4 border-brand-orange rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
          <p className="text-[13px] text-brand-navy leading-relaxed">
            Making bi-weekly or weekly payments instead of monthly is one of the most powerful debt payoff
            strategies most people never use. By splitting your monthly payment in half and paying every two
            weeks, you make 26 half-payments per year — equal to 13 full monthly payments instead of 12. That
            one extra payment per year can shave years off your debt and save thousands in interest. No extra
            money required.
          </p>
        </div>

        <section>
          <h2 className="text-base font-medium text-brand-navy mb-1">Your debts</h2>
          <p className="text-xs text-brand-gray mb-3">
            Select a payment frequency to see how it affects your payoff timeline
          </p>

          <div className="space-y-4">
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
                  className={`bg-white border border-brand-gray-border rounded-lg border-l-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5 ${getDebtAccentBorder(debt)} ${
                    isCommitted ? 'ring-1 ring-brand-green' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[15px] font-medium text-brand-navy">{debt.accountName}</h3>
                        <span className={getDebtTypePillClasses(debt)}>{categoryLabel(debt.category)}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-brand-gray shrink-0">
                      <p>Balance: {CalculationService.formatCurrency(debt.currentBalance)}</p>
                      <p>Rate: {debt.interestRate.toFixed(2)}%</p>
                    </div>
                  </div>

                  <div
                    className="inline-flex w-full bg-brand-gray-light rounded-lg p-1 border border-brand-gray-border mb-4"
                    role="group"
                    aria-label="Payment frequency"
                  >
                    {FREQUENCIES.map(({ id, label }) => {
                      const isActive = freq === id;
                      const activeClass =
                        id === 'monthly'
                          ? 'bg-brand-navy text-white'
                          : 'bg-brand-orange text-white';

                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleFrequencyChange(debt.id, id)}
                          className={`flex-1 px-4 py-2 rounded-md text-[13px] font-medium transition-colors ${
                            isActive
                              ? activeClass
                              : 'bg-transparent text-brand-gray hover:bg-white hover:text-brand-navy'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div key={freq} className="transition-all duration-300 animate-fadeIn">
                    {unpayable ? (
                      <p className="text-brand-orange bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
                        Minimum payment may be too low for this schedule — try monthly or increase your payment.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-brand-gray">Payoff date:</span>
                            <span className="text-[13px] font-medium text-brand-navy">
                              {formatPayoffDateLabel(selected.months)}
                            </span>
                            {freq !== 'monthly' && monthsSaved > 0 && (
                              <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-brand-green border border-brand-green">
                                Save {monthsSaved} month{monthsSaved !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <span className="text-xs text-brand-gray">Total interest:</span>
                            <span className="text-[13px] font-medium text-brand-navy">
                              {CalculationService.formatCurrency(selected.totalInterest)}
                            </span>
                            {freq !== 'monthly' && interestSaved > 0 && (
                              <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-brand-green border border-brand-green">
                                Save {CalculationService.formatCurrency(interestSaved)}
                              </span>
                            )}
                          </div>
                        </div>

                        {isAccelerated && (() => {
                          const perPayment = paymentAmountForFrequency(debt.minimumPayment, freq as 'biweekly' | 'weekly');
                          const freqLabel = freq === 'biweekly' ? 'bi-weekly' : 'weekly';
                          const freqInterval = freq === 'biweekly' ? '2 weeks' : 'week';
                          return (
                            <div className="space-y-2 pt-1">
                              <div className="bg-brand-blue-light border-l-4 border-brand-blue rounded-r-lg p-3 space-y-1.5">
                                <p className="text-sm font-medium text-brand-navy flex items-center gap-1.5">
                                  <Info className="w-4 h-4 shrink-0 text-brand-blue" />
                                  Your {freqLabel} payment plan
                                </p>
                                <p className="text-[13px] text-brand-navy">
                                  Make a payment of{' '}
                                  <span className="font-medium">{CalculationService.formatCurrency(perPayment)}</span>{' '}
                                  every {freqInterval} — this is your scheduled {freqLabel} amount.
                                </p>
                                <p className="text-xs text-brand-gray leading-relaxed">
                                  <strong>Power move:</strong> Stick to your {freqLabel} schedule, then add extra principal payments whenever you have spare cash — even $25–$50 extra accelerates your payoff significantly.
                                </p>
                              </div>
                              <label className="flex items-start gap-3 p-3 rounded-lg bg-brand-gray-light border border-brand-gray-border cursor-pointer hover:bg-white transition-colors">
                                <input
                                  type="checkbox"
                                  checked={isCommitted}
                                  onChange={e => handleCommitmentToggle(debt.id, freq, e.target.checked)}
                                  className="mt-0.5 w-4 h-4 rounded border-brand-gray-border text-brand-orange focus:ring-brand-orange"
                                />
                                <span className="text-sm font-medium text-brand-navy">
                                  I&apos;m committed to this strategy
                                </span>
                              </label>
                              {isCommitted && (
                                <p className="text-brand-green text-sm font-medium flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                                  Strategy locked in — your plan has been updated
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bg-white border border-brand-gray-border rounded-lg border-t-[3px] border-t-brand-green shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
          <h2 className="text-[15px] font-medium text-brand-navy mb-4">Your combined savings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-green-50 border border-brand-green rounded-lg p-4">
              <p className="text-[11px] uppercase text-brand-gray tracking-wide">Interest saved vs monthly</p>
              <p className="text-[22px] font-medium text-brand-green mt-1">
                {CalculationService.formatCurrency(summary.totalInterestSaved)}
              </p>
            </div>
            <div className="bg-blue-50 border border-brand-blue rounded-lg p-4">
              <p className="text-[11px] uppercase text-brand-gray tracking-wide">Months saved</p>
              <p className="text-[22px] font-medium text-brand-blue mt-1">{summary.totalMonthsSaved}</p>
            </div>
          </div>
          <p className="text-xs text-brand-gray italic text-center mt-3">
            Every dollar saved is a step forward. Small changes add up.
          </p>

          <div className="bg-brand-gray-light rounded-lg p-4 mt-4">
            <p className="text-[13px] font-medium text-brand-navy text-center mb-3">Your journey</p>
            <div className="flex items-start justify-between gap-2 mb-3">
              {journeySteps.map(({ label, step }, i) => {
                const active = journeyStep === step;
                return (
                  <div key={label} className="flex-1 flex flex-col items-center min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${
                        active
                          ? 'bg-brand-orange text-white'
                          : 'bg-white border border-brand-gray-border text-brand-gray'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <p
                      className={`mt-2 text-[11px] font-medium text-center leading-tight ${
                        active ? 'text-brand-navy' : 'text-brand-gray'
                      }`}
                    >
                      {label}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="h-[3px] rounded-full overflow-hidden bg-brand-gray-border">
              <div
                className="h-full bg-brand-orange transition-all duration-500"
                style={{ width: `${((journeyStep + 1) / 3) * 100}%` }}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
