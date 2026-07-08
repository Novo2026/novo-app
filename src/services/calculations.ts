import type { Debt, Transaction, StrategyResult, Strategy, SavingsAccount, UnifiedPayment, HELOCTransaction, CheckingTransaction } from '../types';
import { StorageService } from './storage';
import { DebtCalculations } from './debtCalculations';
import {
  applyInstallmentPayoffMonthCap,
  calculateMonthsElapsedSinceStart,
  getInstallmentRemainingTermMonths,
  hasCompleteInstallmentMetadata,
} from '../utils/installmentLoan';

export interface PaymentCalculation {
  interestCharged: number;
  principalPaid: number;
  newBalance: number;
}

export const CalculationService = {
  getStrategyCashFlowInputs(debts: Debt[]) {
    const strategyDebts = this.resolveDebtsForPayoffProjection(debts);
    const totalMinimumPayments = strategyDebts.reduce((sum, d) => sum + d.minimumPayment, 0);
    return { strategyDebts, totalMinimumPayments };
  },

  calculateCurrentStrategy(): StrategyResult | null {
    const debts = StorageService.getDebts();
    const { strategyDebts: activeDebts, totalMinimumPayments } = this.getStrategyCashFlowInputs(debts);

    if (activeDebts.length === 0) {
      return null;
    }

    const profile = StorageService.getFinancialProfile();
    if (!profile) {
      return null;
    }

    const cashFlow = this.calculateCashFlow(
      profile.monthlyNetIncome,
      profile.monthlyEssentialExpenses,
      profile.monthlyDiscretionaryExpenses,
      totalMinimumPayments,
      profile.monthlySavingsGoal ?? 0,
      profile.surplusCommitmentPercent ?? 100
    );
    console.log('[Strategy calculateCurrentStrategy] cash-flow inputs', {
      income: profile.monthlyNetIncome,
      essential: profile.monthlyEssentialExpenses,
      discretionary: profile.monthlyDiscretionaryExpenses,
      minimums: totalMinimumPayments,
      finalSurplus: cashFlow.grossSurplus,
    });

    const extraPayment = Math.floor(cashFlow.recommendedExtraPayment);

    const baseline = DebtCalculations.calculateBaselineTimeline(activeDebts);
    const optimized = DebtCalculations.calculateOptimizedTimeline(activeDebts, extraPayment);

    // Validate results
    const validation = DebtCalculations.validateResults(baseline, optimized);
    if (!validation.isValid) {
      console.error('❌ Calculation validation failed:', validation.errors);
      validation.errors.forEach(err => console.error('  -', err));
    }
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Calculation warnings:', validation.warnings);
      validation.warnings.forEach(warn => console.warn('  -', warn));
    }

    console.log('📊 Strategy Calculated:');
    console.log('  Baseline:', DebtCalculations.formatTimeline(baseline.totalMonths));
    console.log('  Optimized:', DebtCalculations.formatTimeline(optimized.totalMonths));
    console.log('  Interest Saved:', DebtCalculations.formatCurrency(baseline.totalInterest - optimized.totalInterest));
    console.log('  Months Saved:', baseline.totalMonths - optimized.totalMonths);

    // Convert to StrategyResult format
    const result: StrategyResult = {
      strategy: {
        type: 'extra-payment',
        extraMonthlyPayment: extraPayment,
        calculatedAt: new Date().toISOString(),
      },
      debtFreeDate: optimized.monthlyProjections[optimized.monthlyProjections.length - 1]?.date || new Date().toISOString(),
      totalMonths: optimized.totalMonths,
      totalInterest: optimized.totalInterest,
      totalPaid: optimized.totalPaid,
      payoffTimeline: optimized.payoffTimeline,
      monthlyProjections: optimized.monthlyProjections,
    };

    return result;
  },

  calculateMonthsElapsed(loanStartDate: string): number {
    return calculateMonthsElapsedSinceStart(loanStartDate);
  },

  calculateRemainingMonths(
    currentBalance: number,
    interestRate: number,
    monthlyPayment: number
  ): number {
    // Calculate how many months it will take to pay off a loan
    // given current balance, interest rate, and monthly payment
    if (currentBalance <= 0) return 0;
    if (monthlyPayment <= 0) return 999;

    const monthlyRate = interestRate / 12 / 100;

    // If payment is less than or equal to monthly interest, loan will never be paid off
    const monthlyInterest = currentBalance * monthlyRate;
    if (monthlyPayment <= monthlyInterest) {
      return 999; // Return max months to indicate it won't be paid off
    }

    // Use amortization formula to calculate remaining months
    // n = -log(1 - (r * P / M)) / log(1 + r)
    // where P = principal, r = monthly rate, M = monthly payment
    const numerator = Math.log(1 - (monthlyRate * currentBalance / monthlyPayment));
    const denominator = Math.log(1 + monthlyRate);
    const months = -numerator / denominator;

    return Math.ceil(months);
  },

  calculateAmortizedPayment(
    debt: Debt,
    paymentAmount: number
  ): PaymentCalculation {
    // Use new unified calculation engine
    const breakdown = DebtCalculations.processPayment(debt, paymentAmount);

    return {
      interestCharged: breakdown.interest,
      principalPaid: breakdown.principal,
      newBalance: breakdown.newBalance,
    };
  },

  calculatePayment(balance: number, rate: number, payment: number): PaymentCalculation {
    // Create temporary debt object for calculation
    const tempDebt: Debt = {
      id: 'temp',
      accountName: 'temp',
      category: 'Other',
      startingBalance: balance,
      currentBalance: balance,
      interestRate: rate,
      minimumPayment: payment,
      isPaidOff: false,
      createdAt: new Date().toISOString(),
    };

    // Use new unified calculation engine
    const breakdown = DebtCalculations.processPayment(tempDebt, payment);

    return {
      interestCharged: breakdown.interest,
      principalPaid: breakdown.principal,
      newBalance: breakdown.newBalance,
    };
  },

  calculateAmortizedPaymentOLD(
    debt: Debt,
    paymentAmount: number
  ): PaymentCalculation {
    // OLD METHOD - KEPT FOR REFERENCE ONLY
    const balance = debt.currentBalance;

    if (paymentAmount >= balance) {
      return {
        interestCharged: 0,
        principalPaid: Math.round(balance * 100) / 100,
        newBalance: 0,
      };
    }

    const monthlyRate = debt.interestRate / 12 / 100;
    const interestCharged = balance * monthlyRate;
    const principalPaid = paymentAmount - interestCharged;
    const newBalance = Math.max(0, balance - principalPaid);

    return {
      interestCharged: Math.round(interestCharged * 100) / 100,
      principalPaid: Math.round(principalPaid * 100) / 100,
      newBalance: Math.round(newBalance * 100) / 100,
    };
  },

  calculateCharge(currentBalance: number, chargeAmount: number): number {
    return Math.round((currentBalance + chargeAmount) * 100) / 100;
  },

  calculateTotalDebtMetrics(debts: Debt[], transactions: Transaction[]) {
    // Get HELOC balance from localStorage
    const helocTransactions = JSON.parse(localStorage.getItem('novo_heloc_transactions') || '[]');
    const homeEquity = JSON.parse(localStorage.getItem('novo_home_equity') || '{}');
    const helocBalance = helocTransactions.length > 0
      ? helocTransactions[helocTransactions.length - 1].balance
      : (homeEquity.hasHELOC && homeEquity.helocBalance !== undefined ? homeEquity.helocBalance : 0);

    // Calculate total debt including HELOC
    const totalStartingBalance = debts.reduce((sum, debt) => sum + debt.startingBalance, 0);
    const totalCurrentBalance = debts.reduce((sum, debt) => sum + debt.currentBalance, 0) + helocBalance;

    // Use unified payments for principal calculation
    const unifiedPayments = StorageService.getUnifiedPayments();

    // Calculate actual debt eliminated from traditional debts (only principal, not HELOC transfers)
    const traditionalDebtPrincipal = unifiedPayments
      .filter(p => p.source !== 'heloc' || !p.transferredToHELOC)
      .reduce((sum, p) => sum + p.principalPaid, 0);

    // Calculate HELOC net paydown (total draws - current balance = net paid down from cash flow)
    const totalHelocDraws = helocTransactions
      .filter((t: any) => t.type === 'draw')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const helocNetPaydown = Math.max(0, totalHelocDraws - helocBalance);

    // Total actual debt eliminated = traditional debt principal + HELOC net paydown
    const actualDebtEliminated = traditionalDebtPrincipal + helocNetPaydown;

    // Total interest paid across all payments
    const totalInterestPaid = unifiedPayments.reduce((sum, p) => sum + p.interestCharged, 0);

    // For progress calculation, use actual eliminated vs total starting
    const totalPaidOff = totalStartingBalance - totalCurrentBalance;
    const progressPercentage = totalStartingBalance > 0
      ? (totalPaidOff / totalStartingBalance) * 100
      : 0;

    const activeDebts = debts.filter(d => !d.isPaidOff);
    const paidOffDebts = debts.filter(d => d.isPaidOff);

    return {
      totalStartingBalance,
      totalCurrentBalance,
      totalPaidOff,
      actualDebtEliminated,
      traditionalDebtPrincipal,
      helocNetPaydown,
      helocBalance,
      totalInterestPaid,
      progressPercentage,
      activeDebts,
      paidOffDebts,
    };
  },

  calculateCashFlow(
    monthlyNetIncome: number,
    monthlyEssentialExpenses: number,
    monthlyDiscretionaryExpenses: number,
    totalMinimumPayments: number,
    monthlySavingsGoal: number = 0,
    surplusCommitmentPercent: number = 100
  ) {
    const totalExpenses = monthlyEssentialExpenses + monthlyDiscretionaryExpenses;
    const grossSurplus = monthlyNetIncome - totalExpenses - totalMinimumPayments;
    const positiveGross = Math.max(0, grossSurplus);
    const savingsCarveOut = Math.min(Math.max(0, monthlySavingsGoal), positiveGross);
    const surplusAfterSavings = Math.max(0, positiveGross - savingsCarveOut);
    const clampedPercent = Math.min(100, Math.max(0, surplusCommitmentPercent));
    const recommendedExtraPayment = surplusAfterSavings * (clampedPercent / 100);

    return {
      totalExpenses,
      grossSurplus,
      savingsCarveOut,
      surplusAfterSavings,
      commitmentPercent: clampedPercent,
      recommendedExtraPayment,
      availableCashFlow: surplusAfterSavings,
    };
  },

  /**
   * One-time windfall applied to cloned debts only (sandbox). Highest rate first; ties by id.
   * Does not read or write storage.
   */
  applySimulatorWindfall(debts: Debt[], windfall: number): Debt[] {
    const clones = debts.map((d) => ({ ...d }));
    if (windfall <= 0) return clones;

    let remaining = windfall;
    const targets = clones
      .filter((d) => !d.isPaidOff && d.currentBalance > 0)
      .sort((a, b) => b.interestRate - a.interestRate || a.id.localeCompare(b.id));

    let principalApplied = 0;
    for (const d of targets) {
      if (remaining <= 0) break;
      const pay = Math.min(d.currentBalance, remaining);
      d.currentBalance = Math.round((d.currentBalance - pay) * 100) / 100;
      remaining = Math.round((remaining - pay) * 100) / 100;
      principalApplied += pay;
      if (d.currentBalance <= 0) {
        d.currentBalance = 0;
        d.isPaidOff = true;
      }
    }

    console.log('[NOVO What-If windfall]', {
      windfall,
      principalApplied: Math.round(principalApplied * 100) / 100,
      remainingUnapplied: Math.round(remaining * 100) / 100,
      targets: targets.map((d) => ({
        name: d.accountName,
        rate: d.interestRate,
        balanceAfter: d.currentBalance,
        paidOff: d.isPaidOff,
      })),
    });

    return clones;
  },

  /** Exclude stored HELOC rows; projectDebtPayoff adds tracker HELOC once as HELOC_VIRTUAL. */
  filterDebtsForPayoffProjection(debts: Debt[]): Debt[] {
    // Mortgages stay on their fixed amortization schedule
    // They are not targets for aggressive payoff in the avalanche/snowball strategy
    // unless they are the ONLY debt remaining
    const nonMortgageDebts = debts.filter((d) =>
      d.category !== 'HELOC' &&
      d.id !== 'HELOC_VIRTUAL' &&
      d.category !== 'Mortgage'
    );

    if (nonMortgageDebts.length === 0) {
      return debts.filter(d => d.category !== 'HELOC' && d.id !== 'HELOC_VIRTUAL');
    }

    return nonMortgageDebts;
  },

  /** Active debts for strategy/baseline simulation (mortgage filter + optional HELOC virtual). */
  resolveDebtsForPayoffProjection(debts: Debt[]): Debt[] {
    const helocTransactions = JSON.parse(localStorage.getItem('novo_heloc_transactions') || '[]');
    const homeEquity = JSON.parse(localStorage.getItem('novo_home_equity') || '{}');
    const helocBalance = helocTransactions.length > 0
      ? helocTransactions[helocTransactions.length - 1].balance
      : (homeEquity.hasHELOC && homeEquity.helocBalance !== undefined ? homeEquity.helocBalance : 0);
    const helocRate = homeEquity.hasHELOC && homeEquity.helocRate ? homeEquity.helocRate : 0;

    const helocDebt: Debt | null = helocBalance > 0 && helocRate > 0 ? {
      id: 'HELOC_VIRTUAL',
      accountName: 'HELOC',
      category: 'HELOC',
      startingBalance: helocBalance,
      currentBalance: helocBalance,
      interestRate: helocRate,
      minimumPayment: 0,
      isPaidOff: false,
      createdAt: new Date().toISOString(),
      isAmortized: false,
    } : null;

    const tradDebts = this.filterDebtsForPayoffProjection(debts);
    const allDebts = helocDebt ? [...tradDebts, helocDebt] : tradDebts;
    return allDebts.filter((d) => !d.isPaidOff && d.currentBalance > 0);
  },

  /**
   * Same pipeline as Dashboard optimized payoff: sum minimums on active debts → calculateCashFlow →
   * extra to debt (recommended + optional add-on) → projectDebtPayoff (HELOC virtual merged inside).
   * Used by What-If Simulator only; does not persist.
   */
  simulateDashboardStylePayoff(
    debtSnapshot: Debt[],
    inputs: {
      monthlyNetIncome: number;
      monthlyEssentialExpenses: number;
      monthlyDiscretionaryExpenses: number;
      monthlySavingsGoal: number;
      surplusCommitmentPercent: number;
      oneTimeWindfall: number;
      extraMonthlyContribution: number;
    }
  ) {
    const tradDebts = this.filterDebtsForPayoffProjection(debtSnapshot);
    const windfall = Math.max(0, inputs.oneTimeWindfall ?? 0);
    const afterWindfall = this.applySimulatorWindfall(tradDebts, windfall);
    const activeDebts = afterWindfall.filter((d) => !d.isPaidOff && d.currentBalance > 0);
    const totalMinimumPayments = activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0);

    const cashFlow = this.calculateCashFlow(
      inputs.monthlyNetIncome,
      inputs.monthlyEssentialExpenses,
      inputs.monthlyDiscretionaryExpenses,
      totalMinimumPayments,
      inputs.monthlySavingsGoal,
      inputs.surplusCommitmentPercent
    );

    const extraPayment = Math.max(
      0,
      cashFlow.recommendedExtraPayment + Math.max(0, inputs.extraMonthlyContribution ?? 0)
    );
    const projection = this.projectDebtPayoff(activeDebts, extraPayment);

    return { cashFlow, extraPayment, projection, activeDebtCount: activeDebts.length };
  },

  calculateHomeEquityMetrics(homeValue: number, mortgageBalance: number) {
    const totalEquity = homeValue - mortgageBalance;
    const availableHELOC = (homeValue * 0.9) - mortgageBalance;

    return {
      totalEquity: Math.max(0, totalEquity),
      availableHELOC: Math.max(0, availableHELOC),
    };
  },

  projectDebtPayoff(
    debts: Debt[],
    extraMonthlyPayment: number,
    maxMonths: number = 600
  ): StrategyResult {
    console.log('🔥 OPTIMIZED CALCULATION START');
    console.log('Extra monthly payment:', extraMonthlyPayment);

    const activeDebts = this.resolveDebtsForPayoffProjection(debts);

    if (activeDebts.length === 0) {
      return {
        strategy: {
          type: 'extra-payment',
          extraMonthlyPayment,
          calculatedAt: new Date().toISOString(),
        },
        debtFreeDate: this.getTodayDateString(),
        totalMonths: 0,
        totalInterest: 0,
        totalPaid: 0,
        payoffTimeline: [],
        monthlyProjections: [],
      };
    }

    // Use new unified calculation engine
    const optimized = DebtCalculations.calculateOptimizedTimeline(activeDebts, extraMonthlyPayment, maxMonths);

    console.log('🎯 OPTIMIZED RESULTS:');
    console.log('  Total months:', optimized.totalMonths);
    console.log('  Total interest:', DebtCalculations.formatCurrency(optimized.totalInterest));
    console.log('  Payoff order:');
    optimized.payoffTimeline.forEach((p, i) => {
      console.log(`    ${i + 1}. ${p.debtName} - Month ${p.payoffMonth}`);
    });

    return {
      strategy: {
        type: 'extra-payment',
        extraMonthlyPayment,
        calculatedAt: new Date().toISOString(),
      },
      debtFreeDate: optimized.monthlyProjections[optimized.monthlyProjections.length - 1]?.date || this.getTodayDateString(),
      totalMonths: optimized.totalMonths,
      totalInterest: optimized.totalInterest,
      totalPaid: optimized.totalPaid,
      payoffTimeline: optimized.payoffTimeline,
      monthlyProjections: optimized.monthlyProjections,
    };
  },

  calculateDebtRemainingMonths(debt: Debt): number {
    // Calculate how many months it will take to pay off this debt using only minimum payments

    const balance = debt.currentBalance;
    const rate = debt.interestRate;
    const minPayment = debt.minimumPayment;
    const monthlyRate = rate / 12 / 100;

    // Installment loans with full metadata: cap payoff months by time left on the loan
    if (hasCompleteInstallmentMetadata(debt)) {
      const capped = applyInstallmentPayoffMonthCap(
        debt,
        this.calculateRemainingMonths(balance, rate, minPayment)
      );
      const contractual = getInstallmentRemainingTermMonths(debt);
      console.log(
        `  ${debt.accountName}: Installment loan, ~${contractual ?? '?'} months left on term, ${capped} months to payoff at minimum`
      );
      return capped;
    }

    // For revolving debt or loans without term info, calculate based on minimum payment
    const monthlyInterest = balance * monthlyRate;

    // Check if minimum payment is too low (would never pay off)
    if (minPayment <= monthlyInterest) {
      console.warn(`  ⚠️ ${debt.accountName}: Minimum payment ($${minPayment}) ≤ monthly interest ($${monthlyInterest.toFixed(2)}). Debt will never pay off!`);
      return 600; // Return max months (50 years) as flag
    }

    // Calculate months to payoff using standard formula
    // Formula: n = -log(1 - (r * P / M)) / log(1 + r)
    // Where: P = principal, r = monthly rate, M = monthly payment
    if (monthlyRate > 0) {
      const numerator = Math.log(1 - (monthlyRate * balance / minPayment));
      const denominator = Math.log(1 + monthlyRate);
      const months = -numerator / denominator;

      // Validate result
      if (months > 0 && months < 600 && !isNaN(months) && isFinite(months)) {
        console.log(`  ${debt.accountName}: Calculated ${Math.ceil(months)} months to payoff with minimum ($${minPayment}/mo)`);
        return Math.ceil(months);
      }
    }

    // Fallback: simulate month by month (for edge cases)
    console.log(`  ${debt.accountName}: Using simulation fallback`);
    let simBalance = balance;
    let simMonths = 0;
    const maxSimMonths = 600;

    while (simBalance > 0 && simMonths < maxSimMonths) {
      const interest = simBalance * monthlyRate;
      const principal = Math.min(minPayment - interest, simBalance);
      simBalance -= principal;
      simMonths++;

      if (principal <= 0) {
        console.warn(`  ⚠️ ${debt.accountName}: Simulation shows debt won't pay off`);
        return 600;
      }
    }

    return simMonths;
  },

  projectMinimumPaymentsOnly(debts: Debt[]): StrategyResult {
    console.log('📊 BASELINE CALCULATION START (minimum payments only)');

    const activeDebts = this.resolveDebtsForPayoffProjection(debts);

    if (activeDebts.length === 0) {
      return {
        strategy: {
          type: 'extra-payment',
          extraMonthlyPayment: 0,
          calculatedAt: new Date().toISOString(),
        },
        debtFreeDate: this.getTodayDateString(),
        totalMonths: 0,
        totalInterest: 0,
        totalPaid: 0,
        payoffTimeline: [],
        monthlyProjections: [],
      };
    }

    // Use new unified calculation engine
    const baseline = DebtCalculations.calculateBaselineTimeline(activeDebts);

    console.log('Baseline calculation results:');
    console.log(`  Longest debt: ${baseline.longestDebtName}`);
    console.log(`  Total months: ${baseline.totalMonths} (${DebtCalculations.formatTimeline(baseline.totalMonths)})`);
    console.log(`  Total interest: ${DebtCalculations.formatCurrency(baseline.totalInterest)}`);
    console.log('  Individual debt timelines:');
    baseline.debtTimelines.forEach(dt => {
      console.log(`    ${dt.debtName}: ${dt.monthsToPayoff} months, ${DebtCalculations.formatCurrency(dt.totalInterest)} interest`);
    });

    // Convert to StrategyResult format (using optimized format but with baseline data)
    const optimizedFormat = DebtCalculations.calculateOptimizedTimeline(activeDebts, 0);

    return {
      strategy: {
        type: 'extra-payment',
        extraMonthlyPayment: 0,
        calculatedAt: new Date().toISOString(),
      },
      debtFreeDate: optimizedFormat.monthlyProjections[optimizedFormat.monthlyProjections.length - 1]?.date || this.getTodayDateString(),
      totalMonths: baseline.totalMonths,
      totalInterest: baseline.totalInterest,
      totalPaid: baseline.totalPaid,
      payoffTimeline: optimizedFormat.payoffTimeline,
      monthlyProjections: optimizedFormat.monthlyProjections,
    };
  },

  calculateMortgagePayment(
    principal: number,
    annualRate: number,
    months: number
  ): number {
    if (months === 0 || principal === 0) return 0;
    if (annualRate === 0) return principal / months;

    const monthlyRate = annualRate / 12 / 100;
    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) /
                    (Math.pow(1 + monthlyRate, months) - 1);

    return Math.round(payment * 100) / 100;
  },

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  },

  formatCurrencyDetailed(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  },

  getTodayDateString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /** Parse YYYY-MM-DD (or ISO prefix) as local midnight — avoids UTC timezone rollback. */
  parseLocalDate(dateString: string): Date {
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day);
  },

  /** Normalize stored dates to YYYY-MM-DD for date inputs. */
  normalizeDateString(dateString: string): string {
    return dateString.split('T')[0];
  },

  compareDateStrings(a: string, b: string): number {
    return this.parseLocalDate(a).getTime() - this.parseLocalDate(b).getTime();
  },

  formatLocalDateShort(dateString: string): string {
    return this.parseLocalDate(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    });
  },

  addMonthsToDate(baseDate: Date, monthsToAdd: number): string {
    const newDate = new Date(baseDate);
    newDate.setMonth(newDate.getMonth() + monthsToAdd);
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const day = String(newDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  formatDate(dateString: string): string {
    const date = this.parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  formatMonthYear(dateString: string): string {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short'
    });
  },

  calculateSavingsMetrics(accounts: SavingsAccount[]) {
    const totalSavings = accounts.reduce((sum, account) => sum + account.balance, 0);
    const numberOfAccounts = accounts.length;

    const currentYear = new Date().getFullYear();
    const totalInterestEarnedYTD = accounts.reduce((sum, account) => {
      const interestTransactions = account.transactions.filter(t => {
        const transactionYear = CalculationService.parseLocalDate(t.date).getFullYear();
        return t.type === 'interest' && transactionYear === currentYear;
      });
      return sum + interestTransactions.reduce((tSum, t) => tSum + t.amount, 0);
    }, 0);

    const currentMonth = new Date().getMonth();
    const currentMonthYear = new Date().getFullYear();
    const monthlySavingsRate = accounts.reduce((sum, account) => {
      const monthTransactions = account.transactions.filter(t => {
        const transactionDate = CalculationService.parseLocalDate(t.date);
        return transactionDate.getMonth() === currentMonth &&
               transactionDate.getFullYear() === currentMonthYear;
      });
      const deposits = monthTransactions
        .filter(t => t.type === 'deposit' || t.type === 'transfer_from_checking')
        .reduce((tSum, t) => tSum + t.amount, 0);
      const withdrawals = monthTransactions
        .filter(t => t.type === 'withdrawal' || t.type === 'transfer_to_checking')
        .reduce((tSum, t) => tSum + t.amount, 0);
      return sum + (deposits - withdrawals);
    }, 0);

    return {
      totalSavings,
      numberOfAccounts,
      totalInterestEarnedYTD,
      monthlySavingsRate,
    };
  },

  calculateNetWorth(totalSavings: number, totalDebt: number): number {
    return totalSavings - totalDebt;
  },

  calculateSavingsGrowthData(accounts: SavingsAccount[]) {
    const growthMap = new Map<string, number>();

    accounts.forEach(account => {
      account.transactions.forEach(transaction => {
        const date = CalculationService.parseLocalDate(transaction.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!growthMap.has(monthKey)) {
          growthMap.set(monthKey, 0);
        }
      });
    });

    const sortedMonths = Array.from(growthMap.keys()).sort();

    const growthData = sortedMonths.map(monthKey => {
      let totalBalanceAtMonth = 0;

      accounts.forEach(account => {
        const [year, month] = monthKey.split('-').map(Number);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        const transactionsUntilMonth = account.transactions.filter(t => {
          const transactionDate = CalculationService.parseLocalDate(t.date);
          return transactionDate <= endOfMonth;
        });

        if (transactionsUntilMonth.length > 0) {
          const sorted = [...transactionsUntilMonth].sort((a, b) =>
            CalculationService.compareDateStrings(a.date, b.date)
          );
          const lastTransaction = sorted[sorted.length - 1];
          totalBalanceAtMonth += lastTransaction.balanceAfter;
        }
      });

      return {
        month: monthKey,
        balance: totalBalanceAtMonth,
      };
    });

    return growthData;
  },

  getUnifiedPaymentHistory(): UnifiedPayment[] {
    let unifiedPayments = StorageService.getUnifiedPayments();

    if (unifiedPayments.length === 0) {
      const directTransactions = StorageService.getTransactions().filter(t => t.type === 'payment');
      directTransactions.forEach(t => {
        if (t.source === 'direct' || !t.source) {
          unifiedPayments.push({
            id: t.id,
            date: t.date,
            debtId: t.debtId,
            debtName: t.debtName,
            amount: t.amount,
            source: 'direct',
            interestCharged: t.interestCharged,
            principalPaid: t.principalPaid,
            previousBalance: t.previousBalance,
            newBalance: t.newBalance,
            description: t.notes,
            isPaidOff: t.newBalance === 0,
            transferredToHELOC: t.transferredToHELOC || false,
          });
        }
      });

      const helocTransactions = StorageService.getHELOCTransactions();
      const helocDrawsForDebt = helocTransactions.filter(t => t.type === 'draw' && t.debtLinked);

      helocDrawsForDebt.forEach(t => {
        const debts = StorageService.getDebts();
        const debt = debts.find(d => d.accountName === t.debtLinked);

        if (debt) {
          unifiedPayments.push({
            id: t.id,
            date: t.date,
            debtId: debt.id,
            debtName: t.debtLinked!,
            amount: t.amount,
            source: 'heloc',
            interestCharged: 0,
            principalPaid: t.amount,
            previousBalance: 0,
            newBalance: 0,
            description: t.description,
            isPaidOff: true,
            transferredToHELOC: true,
          });
        }
      });

      const checkingTransactions = StorageService.getCheckingTransactions();
      const checkingDebtPayments = checkingTransactions.filter((t: any) => t.type === 'debt_payment' && t.debtId);

      checkingDebtPayments.forEach((t: any) => {
        unifiedPayments.push({
          id: t.id,
          date: t.date,
          debtId: t.debtId,
          debtName: t.debtName || 'Debt Payment',
          amount: t.amount,
          source: 'checking',
          interestCharged: 0,
          principalPaid: t.amount,
          previousBalance: 0,
          newBalance: 0,
          description: t.description,
          isPaidOff: false,
        });
      });

      if (unifiedPayments.length > 0) {
        StorageService.saveUnifiedPayments(unifiedPayments);
        StorageService.deduplicatePayments();
        unifiedPayments = StorageService.getUnifiedPayments();
      }
    }

    unifiedPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return unifiedPayments;
  },

  getPaymentSourceBreakdown(): {
    direct: number;
    heloc: number;
    checking: number;
    total: number;
    directCount: number;
    helocCount: number;
    checkingCount: number;
  } {
    const payments = this.getUnifiedPaymentHistory();

    const direct = payments.filter(p => p.source === 'direct').reduce((sum, p) => sum + p.principalPaid, 0);
    const heloc = payments.filter(p => p.source === 'heloc').reduce((sum, p) => sum + p.principalPaid, 0);
    const checking = payments.filter(p => p.source === 'checking').reduce((sum, p) => sum + p.principalPaid, 0);

    const directCount = payments.filter(p => p.source === 'direct').length;
    const helocCount = payments.filter(p => p.source === 'heloc').length;
    const checkingCount = payments.filter(p => p.source === 'checking').length;

    return {
      direct,
      heloc,
      checking,
      total: direct + heloc + checking,
      directCount,
      helocCount,
      checkingCount,
    };
  },

  getPaymentGuidance(debtId: string): {
    minimumPayment: number;
    recommendedPayment: number;
    extraAmount: number;
    availableCashFlow: number;
    isPriority: boolean;
    priorityReason: string;
    hasStrategy: boolean;
  } | null {
    const debt = StorageService.getDebts().find(d => d.id === debtId);
    if (!debt) return null;

    const strategyResult = StorageService.getStrategyResult();
    const financialProfile = StorageService.getFinancialProfile();

    const minimumPayment = debt.minimumPayment;
    const availableCashFlow = financialProfile?.monthlyCashFlow || 0;

    if (!strategyResult || !strategyResult.monthlyProjections || strategyResult.monthlyProjections.length === 0) {
      return {
        minimumPayment,
        recommendedPayment: minimumPayment,
        extraAmount: 0,
        availableCashFlow,
        isPriority: false,
        priorityReason: 'No payment strategy configured',
        hasStrategy: false,
      };
    }

    const currentMonthProjection = strategyResult.monthlyProjections[0];
    const debtProjection = currentMonthProjection?.debts.find(d => d.debtId === debtId);

    if (!debtProjection) {
      return {
        minimumPayment,
        recommendedPayment: minimumPayment,
        extraAmount: 0,
        availableCashFlow,
        isPriority: false,
        priorityReason: 'Make minimum payment only',
        hasStrategy: true,
      };
    }

    const recommendedPayment = debtProjection.payment;
    const extraAmount = Math.max(0, recommendedPayment - minimumPayment);

    const allDebts = StorageService.getDebts().filter(d => !d.isPaidOff && d.category !== 'HELOC');
    const sortedByRate = [...allDebts].sort((a, b) => b.interestRate - a.interestRate);
    const isPriority = sortedByRate.length > 0 && sortedByRate[0].id === debtId;

    let priorityReason = '';
    if (isPriority) {
      priorityReason = `FOCUS HERE - Highest interest rate (${debt.interestRate.toFixed(2)}%)`;
    } else if (extraAmount > 0) {
      priorityReason = 'Extra payment allocated by strategy';
    } else {
      priorityReason = 'Minimum payment only';
    }

    return {
      minimumPayment,
      recommendedPayment,
      extraAmount,
      availableCashFlow,
      isPriority,
      priorityReason,
      hasStrategy: true,
    };
  },
};
