import type { Debt } from '../types';
import {
  applyInstallmentPayoffMonthCap,
  getPayoffScheduleMonthCap,
  hasCompleteInstallmentMetadata,
} from './installmentLoan';

export type PaymentFrequency = 'monthly' | 'biweekly' | 'weekly';

export interface PayoffProjection {
  months: number;
  totalInterest: number;
  payoffDate: Date;
}

const UNPAYABLE_MONTHS = 999;
const MAX_YEARS = 50;

function addMonths(date: Date, months: number): Date {
  const safeMonths = Math.max(0, Math.min(Math.floor(months), 1200));
  const y = date.getFullYear();
  const m = date.getMonth();
  const day = date.getDate();
  return new Date(y, m + safeMonths, day);
}

/** Today + payoff months → readable label e.g. "March 2029". */
export function formatPayoffDateLabel(months: number): string {
  if (months <= 0) return 'Now';
  if (months >= UNPAYABLE_MONTHS || !Number.isFinite(months)) return '—';
  const payoff = addMonths(new Date(), months);
  if (Number.isNaN(payoff.getTime())) return '—';
  return payoff.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function payoffDateFromMonths(months: number): Date {
  if (months <= 0) return new Date();
  if (months >= UNPAYABLE_MONTHS) return addMonths(new Date(), 0);
  return addMonths(new Date(), months);
}

function periodsToMonths(periodCount: number, periodsPerYear: number): number {
  if (periodCount <= 0) return 0;
  return Math.max(1, Math.ceil((periodCount / periodsPerYear) * 12));
}

function unpayableResult(totalInterest = 0): PayoffProjection {
  return {
    months: UNPAYABLE_MONTHS,
    totalInterest,
    payoffDate: payoffDateFromMonths(UNPAYABLE_MONTHS),
  };
}

interface AmortizationSchedule {
  periods: number;
  totalInterest: number;
  months: number;
}

/**
 * Standard amortization: each period accrue interest on balance, apply full payment toward
 * interest then principal, repeat until paid off.
 */
function runAmortizationSchedule(
  balance: number,
  annualRate: number,
  payment: number,
  periodsPerYear: number,
  scheduleLabel: string,
  maxCalendarMonths?: number
): AmortizationSchedule {
  console.log('[NOVO payoff]', scheduleLabel, {
    balance,
    annualRatePercent: annualRate,
    paymentPerPeriod: payment,
    periodsPerYear,
    annualPrincipalPaid: payment * periodsPerYear,
  });

  if (balance <= 0) {
    return { periods: 0, totalInterest: 0, months: 0 };
  }
  if (payment <= 0) {
    return { periods: UNPAYABLE_MONTHS, totalInterest: 0, months: UNPAYABLE_MONTHS };
  }

  if (annualRate <= 0) {
    const periods = Math.ceil(balance / payment);
    const months = periodsToMonths(periods, periodsPerYear);
    console.log('[NOVO payoff] result (0% rate)', scheduleLabel, { periods, months, totalInterest: 0 });
    return { periods, totalInterest: 0, months };
  }

  const periodRate = annualRate / 100 / periodsPerYear;
  const maxPeriodsFromYears = periodsPerYear * MAX_YEARS;
  const maxPeriodsFromTerm =
    maxCalendarMonths != null && maxCalendarMonths > 0
      ? Math.ceil((maxCalendarMonths / 12) * periodsPerYear)
      : maxPeriodsFromYears;
  const maxPeriods = Math.min(maxPeriodsFromYears, maxPeriodsFromTerm);
  let remaining = balance;
  let totalInterest = 0;
  let periodCount = 0;

  while (remaining > 0.01 && periodCount < maxPeriods) {
    const interest = remaining * periodRate;
    if (payment <= interest) {
      console.log('[NOVO payoff] unpayable — payment does not cover period interest', scheduleLabel, {
        payment,
        interest,
        remaining,
        period: periodCount + 1,
      });
      return { periods: UNPAYABLE_MONTHS, totalInterest, months: UNPAYABLE_MONTHS };
    }

    totalInterest += interest;
    const principal = Math.min(payment - interest, remaining);
    remaining -= principal;
    periodCount += 1;
  }

  if (remaining > 0.01) {
    return { periods: UNPAYABLE_MONTHS, totalInterest, months: UNPAYABLE_MONTHS };
  }

  const months = periodsToMonths(periodCount, periodsPerYear);
  const result = {
    periods: periodCount,
    totalInterest: Math.round(totalInterest * 100) / 100,
    months,
  };
  console.log('[NOVO payoff] result', scheduleLabel, result);
  return result;
}

function scheduleToProjection(schedule: AmortizationSchedule): PayoffProjection {
  if (schedule.months >= UNPAYABLE_MONTHS) {
    return unpayableResult(schedule.totalInterest);
  }
  return {
    months: schedule.months,
    totalInterest: schedule.totalInterest,
    payoffDate: payoffDateFromMonths(schedule.months),
  };
}

/** Per-period payment for accelerated schedules (13 monthly equivalents per year). */
export function paymentAmountForFrequency(
  monthlyPayment: number,
  frequency: Exclude<PaymentFrequency, 'monthly'>
): number {
  return frequency === 'biweekly' ? monthlyPayment / 2 : monthlyPayment / 4;
}

export function calculatePayoffMonths(
  balance: number,
  annualRate: number,
  monthlyPayment: number
): number {
  return calculateMonthlyPayoff(balance, annualRate, monthlyPayment).months;
}

export function calculateTotalInterest(
  balance: number,
  annualRate: number,
  monthlyPayment: number
): number {
  return calculateMonthlyPayoff(balance, annualRate, monthlyPayment).totalInterest;
}

/** 12 payments/year — monthly minimum each period. */
export function calculateMonthlyPayoff(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  maxCalendarMonths?: number
): PayoffProjection {
  const schedule = runAmortizationSchedule(
    balance,
    annualRate,
    monthlyPayment,
    12,
    'monthly',
    maxCalendarMonths
  );
  const projection = scheduleToProjection(schedule);
  if (maxCalendarMonths != null && projection.months > maxCalendarMonths) {
    return {
      ...projection,
      months: maxCalendarMonths,
      payoffDate: payoffDateFromMonths(maxCalendarMonths),
    };
  }
  return projection;
}

export function calculateMonthlyPayoffForDebt(debt: Debt): PayoffProjection {
  const cap = getPayoffScheduleMonthCap(debt);
  const projection = calculateMonthlyPayoff(
    debt.currentBalance,
    debt.interestRate,
    debt.minimumPayment,
    cap
  );
  if (!hasCompleteInstallmentMetadata(debt)) return projection;
  return {
    ...projection,
    months: applyInstallmentPayoffMonthCap(debt, projection.months),
    payoffDate: payoffDateFromMonths(applyInstallmentPayoffMonthCap(debt, projection.months)),
  };
}

/** 26 payments/year at half the monthly payment (13 full monthly payments per year). */
export function calculateBiWeeklyPayoff(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  maxCalendarMonths?: number
): PayoffProjection {
  const payment = monthlyPayment / 2;
  const schedule = runAmortizationSchedule(
    balance,
    annualRate,
    payment,
    26,
    'biweekly',
    maxCalendarMonths
  );
  return scheduleToProjection(schedule);
}

/** 52 payments/year at one-quarter of the monthly payment. */
export function calculateWeeklyPayoff(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  maxCalendarMonths?: number
): PayoffProjection {
  const payment = monthlyPayment / 4;
  const schedule = runAmortizationSchedule(
    balance,
    annualRate,
    payment,
    52,
    'weekly',
    maxCalendarMonths
  );
  return scheduleToProjection(schedule);
}

export function projectPayoffForFrequency(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  frequency: PaymentFrequency,
  maxCalendarMonths?: number
): PayoffProjection {
  switch (frequency) {
    case 'biweekly':
      return calculateBiWeeklyPayoff(balance, annualRate, monthlyPayment, maxCalendarMonths);
    case 'weekly':
      return calculateWeeklyPayoff(balance, annualRate, monthlyPayment, maxCalendarMonths);
    default:
      return calculateMonthlyPayoff(balance, annualRate, monthlyPayment, maxCalendarMonths);
  }
}

export function projectPayoffForFrequencyForDebt(
  debt: Debt,
  frequency: PaymentFrequency
): PayoffProjection {
  const cap = getPayoffScheduleMonthCap(debt);
  const projection = projectPayoffForFrequency(
    debt.currentBalance,
    debt.interestRate,
    debt.minimumPayment,
    frequency,
    cap
  );
  if (!hasCompleteInstallmentMetadata(debt)) return projection;
  const cappedMonths = applyInstallmentPayoffMonthCap(debt, projection.months);
  return {
    ...projection,
    months: cappedMonths,
    payoffDate: payoffDateFromMonths(cappedMonths),
  };
}

export const PAYMENT_FREQUENCIES_STORAGE_KEY = 'novo_payment_frequencies';
export const PAYMENT_COMMITMENTS_STORAGE_KEY = 'novo_payment_commitments';
export const SMARTER_PAYMENTS_VISITED_KEY = 'novo_smarter_payments_visited';

export interface PaymentCommitment {
  frequency: PaymentFrequency;
  committedAt: string;
}

export function formatFrequencyLabel(frequency: PaymentFrequency): string {
  switch (frequency) {
    case 'biweekly':
      return 'Bi-Weekly';
    case 'weekly':
      return 'Weekly';
    default:
      return 'Monthly';
  }
}

export function loadPaymentCommitments(): Record<string, PaymentCommitment> {
  try {
    const raw = localStorage.getItem(PAYMENT_COMMITMENTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PaymentCommitment>;
    const out: Record<string, PaymentCommitment> = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (
        entry &&
        (entry.frequency === 'monthly' ||
          entry.frequency === 'biweekly' ||
          entry.frequency === 'weekly') &&
        entry.committedAt
      ) {
        out[id] = entry;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function savePaymentCommitment(debtId: string, frequency: PaymentFrequency): void {
  const all = loadPaymentCommitments();
  all[debtId] = {
    frequency,
    committedAt: new Date().toISOString(),
  };
  localStorage.setItem(PAYMENT_COMMITMENTS_STORAGE_KEY, JSON.stringify(all));
}

export function removePaymentCommitment(debtId: string): void {
  const all = loadPaymentCommitments();
  delete all[debtId];
  localStorage.setItem(PAYMENT_COMMITMENTS_STORAGE_KEY, JSON.stringify(all));
}

export function getPaymentCommitmentCount(): number {
  return Object.keys(loadPaymentCommitments()).length;
}

export function getActiveCommitmentsSummary(
  debts: Array<{ id: string; accountName: string }>
): Array<{ debtId: string; accountName: string; frequency: PaymentFrequency; committedAt: string }> {
  const commitments = loadPaymentCommitments();
  return debts
    .filter(d => commitments[d.id])
    .map(d => ({
      debtId: d.id,
      accountName: d.accountName,
      frequency: commitments[d.id].frequency,
      committedAt: commitments[d.id].committedAt,
    }));
}

/** Text appended to NovoChat system prompt when commitments exist. */
export function getPaymentCommitmentsPromptContext(
  debts: Array<{ id: string; accountName: string }>
): string {
  const active = getActiveCommitmentsSummary(debts);
  if (active.length === 0) return '';
  const lines = active.map(
    c =>
      `- ${c.accountName}: ${formatFrequencyLabel(c.frequency)} (committed ${new Date(c.committedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`
  );
  return `\n\nThe user has active accelerated payment commitments:\n${lines.join('\n')}\nReference these naturally when relevant — acknowledge they are already on an accelerated payoff plan.`;
}

export function loadPaymentFrequencies(): Record<string, PaymentFrequency> {
  try {
    const raw = localStorage.getItem(PAYMENT_FREQUENCIES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, PaymentFrequency> = {};
    for (const [id, freq] of Object.entries(parsed)) {
      if (freq === 'monthly' || freq === 'biweekly' || freq === 'weekly') {
        out[id] = freq;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function savePaymentFrequency(debtId: string, frequency: PaymentFrequency): void {
  const all = loadPaymentFrequencies();
  all[debtId] = frequency;
  localStorage.setItem(PAYMENT_FREQUENCIES_STORAGE_KEY, JSON.stringify(all));
}

export function hasSmarterPaymentsConfigured(): boolean {
  const freqs = loadPaymentFrequencies();
  return Object.values(freqs).some(f => f === 'biweekly' || f === 'weekly');
}

export function markSmarterPaymentsVisited(): void {
  localStorage.setItem(SMARTER_PAYMENTS_VISITED_KEY, 'true');
}

export function hasVisitedSmarterPayments(): boolean {
  return localStorage.getItem(SMARTER_PAYMENTS_VISITED_KEY) === 'true';
}

export function getMotivationalMessage(totalInterestSaved: number): string {
  if (totalInterestSaved < 500) {
    return 'Every dollar saved is a step forward. Small changes add up.';
  }
  if (totalInterestSaved <= 2000) {
    return "You're building real momentum. Keep going.";
  }
  return 'This is life-changing money staying in your pocket.';
}

export type JourneyStep = 0 | 1 | 2;

/** 0 = Debt Payoff, 1 = Home Ready, 2 = Homeowner */
export function getJourneyStep(
  activeDebtCount: number,
  backDti: number | null,
  readinessLevel: string | null
): JourneyStep {
  if (activeDebtCount === 0) return 2;
  if (backDti == null) return 0;
  if (backDti <= 36 && (readinessLevel === 'Strong' || readinessLevel === 'Good')) return 2;
  if (backDti <= 43) return 1;
  return 0;
}
