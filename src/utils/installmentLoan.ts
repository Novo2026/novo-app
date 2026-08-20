import type { Debt, DebtCategory } from '../types';

export const INSTALLMENT_LOAN_CATEGORIES: DebtCategory[] = [
  'Mortgage',
  'Auto Loan',
  'Student Loan',
  'Personal Loan',
];

export type LoanTermUnit = 'months' | 'years';

export function isInstallmentLoanCategory(category: DebtCategory): boolean {
  return INSTALLMENT_LOAN_CATEGORIES.includes(category);
}

/** All three optional fields present — enables remaining-term-aware payoff math. */
/** Parse currency text from installment form fields (preserves commas in input). */
export function parseInstallmentCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return NaN;
  return parseFloat(cleaned);
}

export function hasCompleteInstallmentMetadata(debt: Debt): boolean {
  return (
    isInstallmentLoanCategory(debt.category) &&
    Boolean(debt.loanStartDate?.trim()) &&
    debt.originalAmount != null &&
    debt.originalAmount > 0 &&
    debt.loanTerm != null &&
    debt.loanTerm > 0
  );
}

/** Parse loan start from ISO (YYYY-MM-DD) or legacy MM/YYYY. */
export function parseLoanStartDate(loanStartDate: string): Date | null {
  const trimmed = loanStartDate.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{2}\/\d{4}$/.test(trimmed)) {
    const [month, year] = trimmed.split('/').map(Number);
    const date = new Date(year, month - 1, 1);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function calculateMonthsElapsedSinceStart(loanStartDate: string): number {
  const startDate = parseLoanStartDate(loanStartDate);
  if (!startDate) return 0;

  const today = new Date();
  const yearDiff = today.getFullYear() - startDate.getFullYear();
  const monthDiff = today.getMonth() - startDate.getMonth();
  const dayAdjust = today.getDate() < startDate.getDate() ? -1 : 0;
  return Math.max(0, yearDiff * 12 + monthDiff + dayAdjust);
}

/** Convert stored term + unit to total months (legacy mortgages stored term in years). */
export function getLoanTermInMonths(debt: Pick<Debt, 'loanTerm' | 'loanTermUnit' | 'isAmortized'>): number | null {
  if (debt.loanTerm == null || debt.loanTerm <= 0) return null;

  if (debt.loanTermUnit === 'months') return Math.round(debt.loanTerm);
  if (debt.loanTermUnit === 'years') return Math.round(debt.loanTerm * 12);

  // Legacy: amortized entries from onboarding / mortgage flows used years
  if (debt.isAmortized) return Math.round(debt.loanTerm * 12);

  return Math.round(debt.loanTerm);
}

/** Contractual months left on the loan from start date + original term. */
export function getInstallmentRemainingTermMonths(debt: Debt): number | null {
  if (!hasCompleteInstallmentMetadata(debt) || !debt.loanStartDate) return null;

  const totalMonths = getLoanTermInMonths(debt);
  if (totalMonths == null) return null;

  const elapsed = calculateMonthsElapsedSinceStart(debt.loanStartDate);
  return Math.max(0, totalMonths - elapsed);
}

/**
 * When installment metadata exists, cap payoff months so projections reflect
 * time already served on the loan (not a brand-new 30-year timeline).
 */
export function applyInstallmentPayoffMonthCap(debt: Debt, calculatedMonths: number): number {
  const cap = getInstallmentRemainingTermMonths(debt);
  if (cap == null || calculatedMonths >= 999) return calculatedMonths;
  return Math.min(calculatedMonths, Math.max(1, cap));
}

export function toDateInputValue(loanStartDate?: string): string {
  if (!loanStartDate) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(loanStartDate)) return loanStartDate;
  const parsed = parseLoanStartDate(loanStartDate);
  if (!parsed) return '';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatLoanStartDateForDisplay(loanStartDate: string): string {
  const parsed = parseLoanStartDate(loanStartDate);
  if (!parsed) return loanStartDate;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatLoanTermForDisplay(
  loanTerm?: number,
  loanTermUnit?: LoanTermUnit,
  isAmortized?: boolean
): string | null {
  if (loanTerm == null || loanTerm <= 0) return null;
  const unit = loanTermUnit ?? (isAmortized ? 'years' : 'months');
  if (unit === 'years') {
    return `${loanTerm} year${loanTerm !== 1 ? 's' : ''}`;
  }
  return `${loanTerm} month${loanTerm !== 1 ? 's' : ''}`;
}

export function readInstallmentFieldsFromDebt(debt: Debt): {
  originalAmount: string;
  loanStartDate: string;
  loanTerm: string;
  loanTermUnit: LoanTermUnit;
} {
  let loanTermUnit: LoanTermUnit = debt.loanTermUnit ?? 'years';
  let loanTerm = debt.loanTerm?.toString() ?? '';

  if (!debt.loanTermUnit && debt.loanTerm != null) {
    if (debt.isAmortized && debt.loanTerm <= 40) {
      loanTermUnit = 'years';
    } else {
      loanTermUnit = 'months';
    }
  }

  return {
    originalAmount: debt.originalAmount != null ? String(debt.originalAmount) : '',
    loanStartDate: toDateInputValue(debt.loanStartDate),
    loanTerm,
    loanTermUnit,
  };
}

export function applyInstallmentFieldsToDebt(
  debt: Debt,
  fields: {
    originalAmount: string;
    loanStartDate: string;
    loanTerm: string;
    loanTermUnit: LoanTermUnit;
  }
): Debt {
  const next: Debt = { ...debt };
  delete next.originalAmount;
  delete next.loanStartDate;
  delete next.loanTerm;
  delete next.loanTermUnit;
  next.isAmortized = false;

  if (!isInstallmentLoanCategory(debt.category)) {
    return next;
  }

  const trimmedOriginal = fields.originalAmount.trim();
  const originalNum = trimmedOriginal
    ? parseInstallmentCurrencyInput(trimmedOriginal)
    : NaN;
  const termNum = parseInt(fields.loanTerm, 10);
  const hasOriginal = trimmedOriginal.length > 0 && !Number.isNaN(originalNum) && originalNum > 0;
  const hasStart = Boolean(fields.loanStartDate.trim());
  const hasTerm = !Number.isNaN(termNum) && termNum > 0;

  if (hasOriginal) next.originalAmount = originalNum;
  if (hasStart) next.loanStartDate = fields.loanStartDate.trim();
  if (hasTerm) {
    next.loanTerm = termNum;
    next.loanTermUnit = fields.loanTermUnit;
  }

  if (hasOriginal && hasStart && hasTerm) {
    next.isAmortized = true;
  }

  return next;
}

/** Max calendar months for amortization schedules (installment-aware). */
export function getPayoffScheduleMonthCap(debt: Debt): number | undefined {
  const remaining = getInstallmentRemainingTermMonths(debt);
  return remaining != null && remaining > 0 ? remaining : undefined;
}

/** Enough data to show a projected payoff date. */
export function hasProjectedPayoffMetadata(debt: Debt): boolean {
  if (!isInstallmentLoanCategory(debt.category)) return false;
  if (debt.category === 'Mortgage') {
    if (debt.currentBalance <= 0) return true;
    if (debt.minimumPayment > 0 && debt.interestRate >= 0) return true;
    return (
      (debt.originalAmount != null && debt.originalAmount > 0) &&
      debt.loanTerm != null &&
      debt.loanTerm > 0 &&
      debt.interestRate >= 0
    );
  }
  return (
    Boolean(debt.loanStartDate?.trim()) &&
    debt.loanTerm != null &&
    debt.loanTerm > 0
  );
}

/** Standard P&I payment from original principal, annual rate %, and term in months. */
export function calculateAmortizedMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  termMonths: number
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const monthlyRate = annualRatePercent / 12 / 100;
  if (monthlyRate === 0) return principal / termMonths;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (principal * (monthlyRate * factor)) / (factor - 1);
}

/**
 * Months to pay off a balance at a fixed monthly payment (standard amortization N).
 * Returns null if the payment never covers interest.
 */
export function calculateAmortizedMonthsRemaining(
  balance: number,
  annualRatePercent: number,
  monthlyPayment: number
): number | null {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return null;

  const monthlyRate = annualRatePercent / 12 / 100;
  if (monthlyRate === 0) return Math.ceil(balance / monthlyPayment);

  if (monthlyPayment <= balance * monthlyRate) return null;

  const months =
    -Math.log(1 - (monthlyRate * balance) / monthlyPayment) / Math.log(1 + monthlyRate);
  if (!Number.isFinite(months) || months < 0) return null;
  return Math.max(1, Math.ceil(months));
}

function resolveMortgageMonthlyPayment(debt: Debt): number | null {
  if (debt.minimumPayment > 0) return debt.minimumPayment;

  const termMonths = getLoanTermInMonths(debt);
  const principal = debt.originalAmount && debt.originalAmount > 0
    ? debt.originalAmount
    : debt.startingBalance > 0
      ? debt.startingBalance
      : 0;
  if (!termMonths || principal <= 0) return null;

  const payment = calculateAmortizedMonthlyPayment(principal, debt.interestRate, termMonths);
  return payment > 0 ? payment : null;
}

/**
 * Mortgage: payoff date from CURRENT balance forward (amortization), not original start+term.
 * Other installment loans: keep contractual start + full term for display.
 */
export function getProjectedPayoffDate(debt: Debt): Date | null {
  if (debt.category === 'Mortgage') {
    if (debt.currentBalance <= 0) return new Date();

    const payment = resolveMortgageMonthlyPayment(debt);
    if (payment == null) return null;

    const monthsRemaining = calculateAmortizedMonthsRemaining(
      debt.currentBalance,
      debt.interestRate,
      payment
    );
    if (monthsRemaining == null) return null;

    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + monthsRemaining, today.getDate());
  }

  if (!hasProjectedPayoffMetadata(debt) || !debt.loanStartDate) return null;

  const start = parseLoanStartDate(debt.loanStartDate);
  const termMonths = getLoanTermInMonths(debt);
  if (!start || termMonths == null) return null;

  const payoff = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  payoff.setMonth(payoff.getMonth() + termMonths);
  return payoff;
}

export function formatProjectedPayoffMonthYear(debt: Debt): string | null {
  const payoff = getProjectedPayoffDate(debt);
  if (!payoff) return null;
  return payoff.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function getMonthsRemainingUntilProjectedPayoff(debt: Debt): number | null {
  const payoff = getProjectedPayoffDate(debt);
  if (!payoff) return null;

  const today = new Date();
  const months =
    (payoff.getFullYear() - today.getFullYear()) * 12 +
    (payoff.getMonth() - today.getMonth());
  const dayAdjust = payoff.getDate() < today.getDate() ? -1 : 0;
  return Math.max(0, months + dayAdjust);
}

export function formatOriginalAmountForDisplay(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
