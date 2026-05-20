export type PaymentFrequency = 'monthly' | 'biweekly' | 'weekly';

export interface PayoffProjection {
  months: number;
  totalInterest: number;
  payoffDate: Date;
}

const MAX_DAYS = 365 * 50;
const UNPAYABLE_MONTHS = 999;
const PAYMENTS_PER_YEAR = { monthly: 12, biweekly: 26, weekly: 52 } as const;

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

/** Per-payment amount: 12 monthly payments spread across N pay periods per year. */
export function paymentAmountForFrequency(
  monthlyPayment: number,
  frequency: Exclude<PaymentFrequency, 'monthly'>
): number {
  const periods = PAYMENTS_PER_YEAR[frequency];
  return (monthlyPayment * 12) / periods;
}

function daysToMonths(days: number): number {
  if (days <= 0) return 0;
  return Math.max(1, Math.ceil(days / 30.4375));
}

function unpayableResult(totalInterest = 0): PayoffProjection {
  return {
    months: UNPAYABLE_MONTHS,
    totalInterest,
    payoffDate: payoffDateFromMonths(UNPAYABLE_MONTHS),
  };
}

/**
 * Daily interest accrual; one payment every `intervalDays` for `paymentAmount`.
 * More frequent payments (shorter interval) reduce interest when annual principal is equal.
 */
function simulateAcceleratedPayoff(
  balance: number,
  annualRate: number,
  paymentAmount: number,
  intervalDays: number
): PayoffProjection {
  if (balance <= 0) {
    return { months: 0, totalInterest: 0, payoffDate: new Date() };
  }
  if (paymentAmount <= 0) {
    return unpayableResult();
  }

  const dailyRate = annualRate / 100 / 365;
  let remaining = balance;
  let totalInterest = 0;
  let daysElapsed = 0;
  let daysUntilPayment = 0;

  while (remaining > 0.005 && daysElapsed < MAX_DAYS) {
    if (dailyRate > 0) {
      const interest = remaining * dailyRate;
      totalInterest += interest;
      remaining += interest;
    }
    daysElapsed += 1;
    daysUntilPayment += 1;

    if (daysUntilPayment < intervalDays) continue;

    daysUntilPayment = 0;
    const applied = Math.min(paymentAmount, remaining);
    remaining -= applied;
  }

  if (remaining > 0.5) {
    return unpayableResult(totalInterest);
  }

  const months = daysToMonths(daysElapsed);
  return {
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    payoffDate: payoffDateFromMonths(months),
  };
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

export function calculateMonthlyPayoff(
  balance: number,
  annualRate: number,
  monthlyPayment: number
): PayoffProjection {
  if (balance <= 0) {
    return { months: 0, totalInterest: 0, payoffDate: new Date() };
  }
  if (monthlyPayment <= 0) {
    return unpayableResult();
  }

  if (annualRate <= 0) {
    const months = Math.ceil(balance / monthlyPayment);
    return {
      months,
      totalInterest: 0,
      payoffDate: payoffDateFromMonths(months),
    };
  }

  const monthlyRate = annualRate / 12 / 100;
  const monthlyInterest = balance * monthlyRate;
  if (monthlyPayment <= monthlyInterest) {
    return unpayableResult();
  }

  const monthsExact =
    -Math.log(1 - (monthlyRate * balance) / monthlyPayment) / Math.log(1 + monthlyRate);
  if (!Number.isFinite(monthsExact) || monthsExact < 0) {
    return unpayableResult();
  }
  const months = Math.ceil(monthsExact);

  let remaining = balance;
  let totalInterest = 0;
  for (let i = 0; i < months && remaining > 0.005; i += 1) {
    const interest = remaining * monthlyRate;
    totalInterest += interest;
    const principal = Math.min(monthlyPayment - interest, remaining);
    if (principal <= 0) {
      return unpayableResult(totalInterest);
    }
    remaining -= principal;
  }

  return {
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    payoffDate: payoffDateFromMonths(months),
  };
}

/** 26 payments/year × (12/26 of monthly) = 12 monthly payments/year, every 14 days. */
export function calculateBiWeeklyPayoff(
  balance: number,
  annualRate: number,
  monthlyPayment: number
): PayoffProjection {
  if (balance <= 0) {
    return { months: 0, totalInterest: 0, payoffDate: new Date() };
  }
  const payment = paymentAmountForFrequency(monthlyPayment, 'biweekly');
  return simulateAcceleratedPayoff(balance, annualRate, payment, 14);
}

/** 52 payments/year × (12/52 of monthly) = 12 monthly payments/year, every 7 days. */
export function calculateWeeklyPayoff(
  balance: number,
  annualRate: number,
  monthlyPayment: number
): PayoffProjection {
  if (balance <= 0) {
    return { months: 0, totalInterest: 0, payoffDate: new Date() };
  }
  const payment = paymentAmountForFrequency(monthlyPayment, 'weekly');
  return simulateAcceleratedPayoff(balance, annualRate, payment, 7);
}

export function projectPayoffForFrequency(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  frequency: PaymentFrequency
): PayoffProjection {
  switch (frequency) {
    case 'biweekly':
      return calculateBiWeeklyPayoff(balance, annualRate, monthlyPayment);
    case 'weekly':
      return calculateWeeklyPayoff(balance, annualRate, monthlyPayment);
    default:
      return calculateMonthlyPayoff(balance, annualRate, monthlyPayment);
  }
}

export const PAYMENT_FREQUENCIES_STORAGE_KEY = 'novo_payment_frequencies';
export const SMARTER_PAYMENTS_VISITED_KEY = 'novo_smarter_payments_visited';

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
