import type { Debt } from '../types';
import {
  applyInstallmentPayoffMonthCap,
  getInstallmentRemainingTermMonths,
  hasCompleteInstallmentMetadata,
} from '../utils/installmentLoan';

export interface PaymentBreakdown {
  payment: number;
  interest: number;
  principal: number;
  newBalance: number;
}

export interface MonthlyProjection {
  month: number;
  date: string;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface DebtTimeline {
  debtId: string;
  debtName: string;
  monthsToPayoff: number;
  totalInterest: number;
  projections: MonthlyProjection[];
}

export interface BaselineResult {
  totalMonths: number;
  totalInterest: number;
  totalPaid: number;
  debtTimelines: DebtTimeline[];
  longestDebtName: string;
}

export interface OptimizedResult {
  totalMonths: number;
  totalInterest: number;
  totalPaid: number;
  monthlyProjections: Array<{
    month: number;
    date: string;
    debts: Array<{
      debtId: string;
      balance: number;
      payment: number;
      interest: number;
      principal: number;
    }>;
    totalBalance: number;
  }>;
  payoffTimeline: Array<{
    debtId: string;
    debtName: string;
    payoffMonth: number;
    payoffDate: string;
  }>;
}

export const DebtCalculations = {
  /**
   * Calculate monthly interest for a given balance and annual rate
   */
  calculateMonthlyInterest(balance: number, annualRate: number): number {
    if (balance <= 0 || annualRate <= 0) return 0;
    return (balance * (annualRate / 100)) / 12;
  },

  /**
   * Calculate principal portion of a payment
   */
  calculatePrincipal(payment: number, monthlyInterest: number): number {
    return Math.max(0, payment - monthlyInterest);
  },

  /**
   * Calculate remaining months to pay off a debt
   */
  calculateRemainingMonths(
    balance: number,
    payment: number,
    annualRate: number,
    isAmortized: boolean = false
  ): number {
    if (balance <= 0) return 0;
    if (payment <= 0) return 999;

    const monthlyRate = annualRate / 12 / 100;
    const monthlyInterest = this.calculateMonthlyInterest(balance, annualRate);

    // If payment doesn't cover interest, debt grows forever
    if (payment <= monthlyInterest) {
      return 999;
    }

    // For amortized loans with fixed payment, use formula
    if (isAmortized && monthlyRate > 0) {
      const numerator = Math.log(payment) - Math.log(payment - balance * monthlyRate);
      const denominator = Math.log(1 + monthlyRate);
      const months = numerator / denominator;
      return Math.ceil(months);
    }

    // For revolving debt, simulate month by month
    let remainingBalance = balance;
    let months = 0;
    const maxMonths = 999;

    while (remainingBalance > 0 && months < maxMonths) {
      const interest = this.calculateMonthlyInterest(remainingBalance, annualRate);
      const principal = this.calculatePrincipal(payment, interest);

      if (principal <= 0) {
        return 999; // Never pays off
      }

      remainingBalance -= principal;
      months++;

      // Handle final month
      if (remainingBalance < 0) {
        remainingBalance = 0;
      }
    }

    return months;
  },

  /**
   * Calculate remaining months for an installment loan with full metadata.
   * Uses current balance + payment, capped by contractual time left on the loan.
   */
  calculateRemainingMonthsForInstallmentLoan(debt: Debt): number {
    const formulaMonths = this.calculateRemainingMonths(
      debt.currentBalance,
      debt.minimumPayment,
      debt.interestRate,
      false
    );

    if (!hasCompleteInstallmentMetadata(debt)) {
      return formulaMonths;
    }

    return applyInstallmentPayoffMonthCap(debt, formulaMonths);
  },

  /** @deprecated Use calculateRemainingMonthsForInstallmentLoan */
  calculateRemainingMonthsForAmortizedLoan(debt: Debt): number {
    return this.calculateRemainingMonthsForInstallmentLoan(debt);
  },

  /**
   * Generate amortization schedule for a debt
   */
  calculateAmortizationSchedule(
    balance: number,
    payment: number,
    annualRate: number,
    maxMonths: number = 600
  ): MonthlyProjection[] {
    const projections: MonthlyProjection[] = [];
    let remainingBalance = balance;
    let month = 0;

    while (remainingBalance > 0 && month < maxMonths) {
      month++;
      const interest = this.calculateMonthlyInterest(remainingBalance, annualRate);
      const principal = this.calculatePrincipal(payment, interest);

      if (principal <= 0) {
        break; // Payment doesn't cover interest
      }

      remainingBalance -= principal;

      // Handle final month
      if (remainingBalance < 0) {
        remainingBalance = 0;
      }

      const currentDate = new Date();
      currentDate.setMonth(currentDate.getMonth() + month);

      projections.push({
        month,
        date: currentDate.toISOString().split('T')[0],
        payment: remainingBalance === 0 ? payment + remainingBalance : payment,
        interest: Math.round(interest * 100) / 100,
        principal: Math.round(principal * 100) / 100,
        balance: Math.round(remainingBalance * 100) / 100,
      });
    }

    return projections;
  },

  /**
   * Calculate baseline timeline (minimum payments only)
   */
  calculateBaselineTimeline(debts: Debt[]): BaselineResult {
    const activeDebts = debts.filter(d => !d.isPaidOff && d.currentBalance > 0);

    if (activeDebts.length === 0) {
      return {
        totalMonths: 0,
        totalInterest: 0,
        totalPaid: 0,
        debtTimelines: [],
        longestDebtName: '',
      };
    }

    const debtTimelines: DebtTimeline[] = [];
    let maxMonths = 0;
    let longestDebtName = '';

    for (const debt of activeDebts) {
      const monthsToPayoff = hasCompleteInstallmentMetadata(debt)
        ? this.calculateRemainingMonthsForInstallmentLoan(debt)
        : this.calculateRemainingMonths(
            debt.currentBalance,
            debt.minimumPayment,
            debt.interestRate,
            false
          );

      const scheduleMaxMonths =
        getInstallmentRemainingTermMonths(debt) ?? monthsToPayoff;

      const projections = this.calculateAmortizationSchedule(
        debt.currentBalance,
        debt.minimumPayment,
        debt.interestRate,
        Math.min(monthsToPayoff, scheduleMaxMonths)
      );

      const totalInterest = projections.reduce((sum, p) => sum + p.interest, 0);

      debtTimelines.push({
        debtId: debt.id,
        debtName: debt.accountName,
        monthsToPayoff,
        totalInterest,
        projections,
      });

      if (monthsToPayoff > maxMonths) {
        maxMonths = monthsToPayoff;
        longestDebtName = debt.accountName;
      }
    }

    // Total interest is sum of all debts (they pay in parallel)
    const totalInterest = debtTimelines.reduce((sum, dt) => sum + dt.totalInterest, 0);

    // Total paid is sum of all minimum payments over the longest timeline
    const totalMinimumPayments = activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0);
    const totalPaid = totalMinimumPayments * maxMonths;

    return {
      totalMonths: maxMonths,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      debtTimelines,
      longestDebtName,
    };
  },

  /**
   * Calculate optimized timeline using debt avalanche method
   */
  calculateOptimizedTimeline(
    debts: Debt[],
    extraMonthlyPayment: number,
    maxMonths: number = 600
  ): OptimizedResult {
    const activeDebts = debts.filter(d => !d.isPaidOff && d.currentBalance > 0);

    if (activeDebts.length === 0) {
      return {
        totalMonths: 0,
        totalInterest: 0,
        totalPaid: 0,
        monthlyProjections: [],
        payoffTimeline: [],
      };
    }

    // Initialize debt balances (installment loans may cap simulated months at remaining term)
    const debtBalances = activeDebts.map(debt => ({
      debtId: debt.id,
      debtName: debt.accountName,
      balance: debt.currentBalance,
      rate: debt.interestRate,
      minPayment: debt.minimumPayment,
      paidOff: false,
      payoffMonth: 0,
      monthsSimulated: 0,
      maxPayoffMonths: hasCompleteInstallmentMetadata(debt)
        ? getInstallmentRemainingTermMonths(debt)
        : null,
    }));

    const monthlyProjections: OptimizedResult['monthlyProjections'] = [];
    const payoffTimeline: OptimizedResult['payoffTimeline'] = [];
    let totalInterestPaid = 0;
    let month = 0;
    let availableExtraCash = extraMonthlyPayment;

    const canSimulateDebt = (d: (typeof debtBalances)[number]) =>
      !d.paidOff &&
      (d.maxPayoffMonths == null || d.monthsSimulated < d.maxPayoffMonths);

    const isWithinInstallmentCap = (d: (typeof debtBalances)[number]) =>
      d.maxPayoffMonths == null || d.monthsSimulated <= d.maxPayoffMonths;

    while (debtBalances.some(canSimulateDebt) && month < maxMonths) {
      month++;

      // Sort by interest rate (highest first) - Debt Avalanche; skip term-expired debts
      const sortedDebts = debtBalances
        .filter(d => !d.paidOff && isWithinInstallmentCap(d))
        .sort((a, b) => b.rate - a.rate);

      const monthDebts: OptimizedResult['monthlyProjections'][0]['debts'] = [];

      // Step 1: Pay minimums on all debts
      for (const debt of debtBalances) {
        if (debt.paidOff) {
          monthDebts.push({
            debtId: debt.debtId,
            balance: 0,
            payment: 0,
            interest: 0,
            principal: 0,
          });
          continue;
        }

        debt.monthsSimulated += 1;

        if (!isWithinInstallmentCap(debt)) {
          monthDebts.push({
            debtId: debt.debtId,
            balance: Math.round(debt.balance * 100) / 100,
            payment: 0,
            interest: 0,
            principal: 0,
          });
          continue;
        }

        const interest = this.calculateMonthlyInterest(debt.balance, debt.rate);
        const payment = debt.minPayment;
        const principal = this.calculatePrincipal(payment, interest);

        totalInterestPaid += interest;
        debt.balance -= principal;

        if (debt.balance <= 0) {
          debt.balance = 0;
          debt.paidOff = true;
          debt.payoffMonth = month;

          const currentDate = new Date();
          currentDate.setMonth(currentDate.getMonth() + month);

          payoffTimeline.push({
            debtId: debt.debtId,
            debtName: debt.debtName,
            payoffMonth: month,
            payoffDate: currentDate.toISOString().split('T')[0],
          });

          // Add this debt's minimum to available extra cash (snowball effect)
          availableExtraCash += debt.minPayment;
        }

        monthDebts.push({
          debtId: debt.debtId,
          balance: Math.round(debt.balance * 100) / 100,
          payment: Math.round(payment * 100) / 100,
          interest: Math.round(interest * 100) / 100,
          principal: Math.round(principal * 100) / 100,
        });
      }

      // Step 2: Apply extra cash to highest-rate debt
      if (availableExtraCash > 0 && sortedDebts.length > 0) {
        const targetDebt = sortedDebts[0];
        const extraPayment = Math.min(availableExtraCash, targetDebt.balance);

        // Extra payment is pure principal (no interest on extra)
        targetDebt.balance -= extraPayment;

        // Update the projection for this debt
        const debtProjection = monthDebts.find(d => d.debtId === targetDebt.debtId);
        if (debtProjection) {
          debtProjection.payment += extraPayment;
          debtProjection.principal += extraPayment;
          debtProjection.balance = Math.round(targetDebt.balance * 100) / 100;
        }

        if (targetDebt.balance <= 0) {
          targetDebt.balance = 0;
          targetDebt.paidOff = true;
          targetDebt.payoffMonth = month;

          const currentDate = new Date();
          currentDate.setMonth(currentDate.getMonth() + month);

          // Update or add to payoff timeline
          const existingPayoff = payoffTimeline.find(p => p.debtId === targetDebt.debtId);
          if (existingPayoff) {
            existingPayoff.payoffMonth = month;
            existingPayoff.payoffDate = currentDate.toISOString().split('T')[0];
          } else {
            payoffTimeline.push({
              debtId: targetDebt.debtId,
              debtName: targetDebt.debtName,
              payoffMonth: month,
              payoffDate: currentDate.toISOString().split('T')[0],
            });
          }

          // Add this debt's minimum to available extra cash
          availableExtraCash += targetDebt.minPayment;
        }
      }

      const totalBalance = debtBalances.reduce((sum, d) => sum + d.balance, 0);
      const currentDate = new Date();
      currentDate.setMonth(currentDate.getMonth() + month);

      monthlyProjections.push({
        month,
        date: currentDate.toISOString().split('T')[0],
        debts: monthDebts,
        totalBalance: Math.round(totalBalance * 100) / 100,
      });

      if (totalBalance === 0) break;
    }

    const totalMinimumPayments = activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0);
    const totalPaid = (totalMinimumPayments + extraMonthlyPayment) * month;

    return {
      totalMonths: month,
      totalInterest: Math.round(totalInterestPaid * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      monthlyProjections,
      payoffTimeline: payoffTimeline.sort((a, b) => a.payoffMonth - b.payoffMonth),
    };
  },

  /**
   * Process a single payment and return breakdown
   */
  processPayment(debt: Debt, paymentAmount: number): PaymentBreakdown {
    const interest = this.calculateMonthlyInterest(debt.currentBalance, debt.interestRate);
    const principal = this.calculatePrincipal(paymentAmount, interest);
    const newBalance = Math.max(0, debt.currentBalance - principal);

    return {
      payment: Math.round(paymentAmount * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      principal: Math.round(principal * 100) / 100,
      newBalance: Math.round(newBalance * 100) / 100,
    };
  },

  /**
   * Validate calculation results
   */
  validateResults(baseline: BaselineResult, optimized: OptimizedResult): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for unrealistic timelines
    if (baseline.totalMonths > 600) {
      errors.push(`Baseline timeline is ${baseline.totalMonths} months (50+ years). Check minimum payments.`);
    }

    if (optimized.totalMonths > 600) {
      errors.push(`Optimized timeline is ${optimized.totalMonths} months (50+ years). Need higher payments.`);
    }

    // Optimized should be faster than baseline
    if (optimized.totalMonths > baseline.totalMonths) {
      errors.push('Optimized timeline is longer than baseline. This should never happen.');
    }

    // Optimized should have less interest
    if (optimized.totalInterest > baseline.totalInterest) {
      warnings.push('Optimized strategy pays more interest than baseline. Review calculations.');
    }

    // Check for negative values
    if (baseline.totalMonths < 0 || optimized.totalMonths < 0) {
      errors.push('Negative timeline detected.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  },

  /**
   * Format timeline as readable text
   */
  formatTimeline(months: number): string {
    if (months >= 999) return 'Never pays off';

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years === 0) {
      return `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
    } else if (remainingMonths === 0) {
      return `${years} year${years !== 1 ? 's' : ''}`;
    } else {
      return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
    }
  },
};
