export type PaymentFrequency = 'monthly' | 'biweekly' | 'weekly';

export interface PayoffProjection {
  months: number;
  totalInterest: number;
  payoffDate: Date;
}

const MAX_DAYS = 365 * 50;
const UNPAYABLE_MONTHS = 999;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function daysToMonths(days: number): number {
  if (days <= 0) return 0;
  return Math.max(1, Math.ceil(days / 30.4375));
}

/**
 * Daily-accrual simulation: interest compounds daily, payment applied every `intervalDays`.
 */
function simulatePayoff(
  balance: number,
  annualRate: number,
  paymentAmount: number,
  intervalDays: number
): PayoffProjection {
  if (balance <= 0) {
    return { months: 0, totalInterest: 0, payoffDate: new Date() };
  }

  if (paymentAmount <= 0) {
    return {
      months: UNPAYABLE_MONTHS,
      totalInterest: 0,
      payoffDate: addMonths(new Date(), UNPAYABLE_MONTHS),
    };
  }

  const dailyRate = annualRate / 100 / 365;
  let remaining = balance;
  let totalInterest = 0;
  let daysElapsed = 0;

  while (remaining > 0.005 && daysElapsed < MAX_DAYS) {
    let periodInterest = 0;
    for (let d = 0; d < intervalDays; d += 1) {
      if (remaining <= 0.005) break;
      const interest = dailyRate > 0 ? remaining * dailyRate : 0;
      periodInterest += interest;
      remaining += interest;
      daysElapsed += 1;
      if (daysElapsed >= MAX_DAYS) break;
    }

    totalInterest += periodInterest;

    if (remaining <= 0.005) break;

    if (paymentAmount <= periodInterest && dailyRate > 0) {
      return {
        months: UNPAYABLE_MONTHS,
        totalInterest,
        payoffDate: addMonths(new Date(), UNPAYABLE_MONTHS),
      };
    }

    const applied = Math.min(paymentAmount, remaining);
    remaining -= applied;

    if (applied < paymentAmount * 0.001 && remaining > 1) {
      return {
        months: UNPAYABLE_MONTHS,
        totalInterest,
        payoffDate: addMonths(new Date(), UNPAYABLE_MONTHS),
      };
    }
  }

  const months = daysToMonths(daysElapsed);
  return {
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    payoffDate: addMonths(new Date(), months),
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
    return {
      months: UNPAYABLE_MONTHS,
      totalInterest: 0,
      payoffDate: addMonths(new Date(), UNPAYABLE_MONTHS),
    };
  }

  if (annualRate <= 0) {
    const months = Math.ceil(balance / monthlyPayment);
    return {
      months,
      totalInterest: 0,
      payoffDate: addMonths(new Date(), months),
    };
  }

  const monthlyRate = annualRate / 12 / 100;
  const monthlyInterest = balance * monthlyRate;
  if (monthlyPayment <= monthlyInterest) {
    return {
      months: UNPAYABLE_MONTHS,
      totalInterest: 0,
      payoffDate: addMonths(new Date(), UNPAYABLE_MONTHS),
    };
  }

  const monthsExact =
    -Math.log(1 - (monthlyRate * balance) / monthlyPayment) / Math.log(1 + monthlyRate);
  const months = Math.ceil(monthsExact);

  let remaining = balance;
  let totalInterest = 0;
  for (let i = 0; i < months && remaining > 0.005; i += 1) {
    const interest = remaining * monthlyRate;
    totalInterest += interest;
    const principal = Math.min(monthlyPayment - interest, remaining);
    if (principal <= 0) {
      return {
        months: UNPAYABLE_MONTHS,
        totalInterest,
        payoffDate: addMonths(new Date(), UNPAYABLE_MONTHS),
      };
    }
    remaining -= principal;
  }

  return {
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    payoffDate: addMonths(new Date(), months),
  };
}

/** Half the monthly payment every 14 days (26 payments/year ≈ 13 monthly payments). */
export function calculateBiWeeklyPayoff(
  balance: number,
  annualRate: number,
  monthlyPayment: number
): PayoffProjection {
  if (balance <= 0) {
    return { months: 0, totalInterest: 0, payoffDate: new Date() };
  }
  const payment = monthlyPayment / 2;
  return simulatePayoff(balance, annualRate, payment, 14);
}

/** Quarter of the monthly payment every 7 days (52 payments/year ≈ 13 monthly payments). */
export function calculateWeeklyPayoff(
  balance: number,
  annualRate: number,
  monthlyPayment: number
): PayoffProjection {
  if (balance <= 0) {
    return { months: 0, totalInterest: 0, payoffDate: new Date() };
  }
  const payment = monthlyPayment / 4;
  return simulatePayoff(balance, annualRate, payment, 7);
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
