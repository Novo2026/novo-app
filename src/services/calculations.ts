import type { Debt, Transaction, StrategyResult, Strategy, SavingsAccount, UnifiedPayment, HELOCTransaction, CheckingTransaction } from '../types';
import { StorageService } from './storage';

export interface PaymentCalculation {
  interestCharged: number;
  principalPaid: number;
  newBalance: number;
}

export const CalculationService = {
  calculateMonthsElapsed(loanStartDate: string): number {
    const [startMonth, startYear] = loanStartDate.split('/').map(Number);
    const startDate = new Date(startYear, startMonth - 1, 1);
    const currentDate = new Date();

    const yearDiff = currentDate.getFullYear() - startDate.getFullYear();
    const monthDiff = currentDate.getMonth() - startDate.getMonth();

    return yearDiff * 12 + monthDiff;
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
    // For amortized debts, calculate based on current balance
    // We don't need to re-simulate the entire loan history for each payment
    const balance = debt.currentBalance;

    // If payment covers the full balance, no interest is charged
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

  calculatePayment(
    currentBalance: number,
    interestRate: number,
    paymentAmount: number
  ): PaymentCalculation {
    // If payment covers the full balance, no interest is charged
    if (paymentAmount >= currentBalance) {
      return {
        interestCharged: 0,
        principalPaid: Math.round(currentBalance * 100) / 100,
        newBalance: 0,
      };
    }

    const annualRate = interestRate;
    const monthlyInterestRate = annualRate / 12 / 100;
    const interestCharged = currentBalance * monthlyInterestRate;
    const principalPaid = paymentAmount - interestCharged;
    const newBalance = Math.max(0, currentBalance + interestCharged - paymentAmount);

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

    // Calculate actual debt eliminated from traditional debts (only from cash flow payments, not HELOC transfers)
    const traditionalDebtPrincipal = transactions
      .filter(t => t.type === 'payment' && !t.paidWithHELOC)
      .reduce((sum, t) => sum + t.principalPaid, 0);

    // Calculate HELOC net paydown (total draws - current balance = net paid down from cash flow)
    const totalHelocDraws = helocTransactions
      .filter((t: any) => t.type === 'draw')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const helocNetPaydown = Math.max(0, totalHelocDraws - helocBalance);

    // Total actual debt eliminated = traditional debt principal + HELOC net paydown
    const actualDebtEliminated = traditionalDebtPrincipal + helocNetPaydown;

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
      progressPercentage,
      activeDebts,
      paidOffDebts,
    };
  },

  calculateCashFlow(
    monthlyNetIncome: number,
    monthlyEssentialExpenses: number,
    monthlyDiscretionaryExpenses: number,
    totalMinimumPayments: number
  ) {
    const totalExpenses = monthlyEssentialExpenses + monthlyDiscretionaryExpenses;
    const availableCashFlow = monthlyNetIncome - totalExpenses - totalMinimumPayments;
    const recommendedExtraPayment = Math.max(0, availableCashFlow * 0.8);

    return {
      totalExpenses,
      availableCashFlow,
      recommendedExtraPayment,
    };
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

    // Get HELOC balance from localStorage
    const helocTransactions = JSON.parse(localStorage.getItem('novo_heloc_transactions') || '[]');
    const homeEquity = JSON.parse(localStorage.getItem('novo_home_equity') || '{}');
    const helocBalance = helocTransactions.length > 0
      ? helocTransactions[helocTransactions.length - 1].balance
      : (homeEquity.hasHELOC && homeEquity.helocBalance !== undefined ? homeEquity.helocBalance : 0);
    const helocRate = homeEquity.hasHELOC && homeEquity.helocRate ? homeEquity.helocRate : 0;

    // Create virtual HELOC debt if balance exists
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

    // Include HELOC in debts if it has a balance
    const allDebts = helocDebt ? [...debts, helocDebt] : debts;

    const sortedDebts = [...allDebts]
      .filter(d => !d.isPaidOff)
      .sort((a, b) => b.interestRate - a.interestRate);

    console.log('Debts sorted by rate (highest first):');
    sortedDebts.forEach(d => console.log(`  ${d.accountName}: ${d.interestRate}% - $${d.currentBalance}`));

    const debtBalances = sortedDebts.map(d => ({
      debtId: d.id,
      debtName: d.accountName,
      balance: d.currentBalance,
      rate: d.interestRate,
      minPayment: d.minimumPayment,
      paidOff: false,
      payoffMonth: 0,
      debt: d,
      isHELOC: d.id === 'HELOC_VIRTUAL',
    }));

    const monthlyProjections: StrategyResult['monthlyProjections'] = [];
    let month = 0;
    let totalInterestPaid = 0;
    let totalMinPayments = sortedDebts.reduce((sum, d) => sum + d.minimumPayment, 0);

    while (month < maxMonths && debtBalances.some(d => !d.paidOff)) {
      month++;
      const currentDate = new Date();
      currentDate.setMonth(currentDate.getMonth() + month);

      const monthDebts: StrategyResult['monthlyProjections'][0]['debts'] = [];
      let extraPaymentRemaining = extraMonthlyPayment;

      // Find the highest-rate unpaid debt
      const highestRateDebt = debtBalances
        .filter(d => !d.paidOff)
        .sort((a, b) => b.rate - a.rate)[0];

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

        // Start with minimum payment
        let payment = debt.minPayment;

        // Add ALL extra payment to the highest-interest debt
        if (debt === highestRateDebt && extraPaymentRemaining > 0) {
          payment += extraPaymentRemaining;
          extraPaymentRemaining = 0;
        }

        const calculation = debt.debt.isAmortized
          ? this.calculateAmortizedPayment({ ...debt.debt, currentBalance: debt.balance }, payment)
          : this.calculatePayment(debt.balance, debt.rate, payment);

        const interest = calculation.interestCharged;
        const principal = calculation.principalPaid;
        const newBalance = calculation.newBalance;

        totalInterestPaid += interest;
        debt.balance = newBalance;

        if (newBalance === 0 && !debt.paidOff) {
          debt.paidOff = true;
          debt.payoffMonth = month;
          console.log(`✅ ${debt.debtName} PAID OFF in month ${month}!`);
        }

        monthDebts.push({
          debtId: debt.debtId,
          balance: newBalance,
          payment,
          interest,
          principal,
        });
      }

      const totalBalance = debtBalances.reduce((sum, d) => sum + d.balance, 0);

      monthlyProjections.push({
        month,
        date: this.addMonthsToDate(new Date(), month - 1),
        debts: monthDebts,
        totalBalance,
      });

      if (totalBalance === 0) break;
    }

    const totalPaid = (totalMinPayments + extraMonthlyPayment) * month;

    const payoffTimeline = debtBalances
      .filter(d => d.paidOff)
      .map(d => {
        return {
          debtId: d.debtId,
          debtName: d.debtName,
          payoffMonth: d.payoffMonth,
          payoffDate: this.addMonthsToDate(new Date(), d.payoffMonth),
        };
      })
      .sort((a, b) => a.payoffMonth - b.payoffMonth);

    const debtFreeDateStr = this.addMonthsToDate(new Date(), month);

    console.log('🎯 OPTIMIZED RESULTS:');
    console.log('  Total months:', month);
    console.log('  Total interest:', totalInterestPaid);
    console.log('  Debt-free date:', debtFreeDateStr);

    return {
      strategy: {
        type: 'extra-payment',
        extraMonthlyPayment,
        calculatedAt: new Date().toISOString(),
      },
      debtFreeDate: debtFreeDateStr,
      totalMonths: month,
      totalInterest: Math.round(totalInterestPaid * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      payoffTimeline,
      monthlyProjections,
    };
  },

  projectMinimumPaymentsOnly(debts: Debt[]): StrategyResult {
    console.log('📊 BASELINE CALCULATION START (minimum payments only)');

    // CRITICAL: For baseline, use ONLY the debts without HELOC virtual debt
    // This represents what would happen if user just paid minimums on actual debts
    const activeDebts = debts.filter(d => !d.isPaidOff);

    console.log('Active debts for baseline:');
    activeDebts.forEach(d => console.log(`  ${d.accountName}: ${d.interestRate}% - $${d.currentBalance} (min: $${d.minimumPayment})`));

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

    // Sort by interest rate (highest first) for avalanche method
    const sortedDebts = [...activeDebts].sort((a, b) => b.interestRate - a.interestRate);

    const debtBalances = sortedDebts.map(d => ({
      debtId: d.id,
      debtName: d.accountName,
      balance: d.currentBalance,
      rate: d.interestRate,
      minPayment: d.minimumPayment,
      paidOff: false,
      payoffMonth: 0,
      debt: d,
    }));

    const monthlyProjections: StrategyResult['monthlyProjections'] = [];
    let month = 0;
    let totalInterestPaid = 0;
    const maxMonths = 600; // 50 years max

    // Simulate minimum payments only
    while (month < maxMonths && debtBalances.some(d => !d.paidOff)) {
      month++;
      const currentDate = new Date();
      currentDate.setMonth(currentDate.getMonth() + month);

      const monthDebts: StrategyResult['monthlyProjections'][0]['debts'] = [];

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

        // Use ONLY minimum payment for baseline
        const payment = debt.minPayment;

        const calculation = debt.debt.isAmortized
          ? this.calculateAmortizedPayment({ ...debt.debt, currentBalance: debt.balance }, payment)
          : this.calculatePayment(debt.balance, debt.rate, payment);

        const interest = calculation.interestCharged;
        const principal = calculation.principalPaid;
        const newBalance = calculation.newBalance;

        totalInterestPaid += interest;
        debt.balance = newBalance;

        if (newBalance === 0 && !debt.paidOff) {
          debt.paidOff = true;
          debt.payoffMonth = month;
        }

        monthDebts.push({
          debtId: debt.debtId,
          balance: newBalance,
          payment,
          interest,
          principal,
        });
      }

      const totalBalance = debtBalances.reduce((sum, d) => sum + d.balance, 0);

      monthlyProjections.push({
        month,
        date: this.addMonthsToDate(new Date(), month - 1),
        debts: monthDebts,
        totalBalance,
      });

      if (totalBalance === 0) break;
    }

    const totalMinimumPayments = sortedDebts.reduce((sum, d) => sum + d.minimumPayment, 0);
    const totalPaid = totalMinimumPayments * month;

    const payoffTimeline = debtBalances
      .filter(d => d.paidOff)
      .map(d => {
        return {
          debtId: d.debtId,
          debtName: d.debtName,
          payoffMonth: d.payoffMonth,
          payoffDate: this.addMonthsToDate(new Date(), d.payoffMonth),
        };
      })
      .sort((a, b) => a.payoffMonth - b.payoffMonth);

    const debtFreeDateStr = this.addMonthsToDate(new Date(), month);

    console.log('📈 BASELINE RESULTS:');
    console.log('  Total months:', month);
    console.log('  Total interest:', totalInterestPaid);
    console.log('  Debt-free date:', debtFreeDateStr);

    return {
      strategy: {
        type: 'extra-payment',
        extraMonthlyPayment: 0,
        calculatedAt: new Date().toISOString(),
      },
      debtFreeDate: debtFreeDateStr,
      totalMonths: month,
      totalInterest: Math.round(totalInterestPaid * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      payoffTimeline,
      monthlyProjections,
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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

  addMonthsToDate(baseDate: Date, monthsToAdd: number): string {
    const newDate = new Date(baseDate);
    newDate.setMonth(newDate.getMonth() + monthsToAdd);
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const day = String(newDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  formatDate(dateString: string): string {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
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
        const transactionYear = new Date(t.date).getFullYear();
        return t.type === 'interest' && transactionYear === currentYear;
      });
      return sum + interestTransactions.reduce((tSum, t) => tSum + t.amount, 0);
    }, 0);

    const currentMonth = new Date().getMonth();
    const currentMonthYear = new Date().getFullYear();
    const monthlySavingsRate = accounts.reduce((sum, account) => {
      const monthTransactions = account.transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === currentMonth &&
               transactionDate.getFullYear() === currentMonthYear;
      });
      const deposits = monthTransactions
        .filter(t => t.type === 'deposit')
        .reduce((tSum, t) => tSum + t.amount, 0);
      const withdrawals = monthTransactions
        .filter(t => t.type === 'withdrawal')
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
        const date = new Date(transaction.date);
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
          const transactionDate = new Date(t.date);
          return transactionDate <= endOfMonth;
        });

        if (transactionsUntilMonth.length > 0) {
          const lastTransaction = transactionsUntilMonth[transactionsUntilMonth.length - 1];
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
