import type { Debt, Transaction, StrategyResult, Strategy, SavingsAccount } from '../types';

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
    const totalStartingBalance = debts.reduce((sum, debt) => sum + debt.startingBalance, 0);
    const totalCurrentBalance = debts.reduce((sum, debt) => sum + debt.currentBalance, 0);
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
    const sortedDebts = [...debts]
      .filter(d => !d.isPaidOff)
      .sort((a, b) => b.interestRate - a.interestRate);

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

    while (month < maxMonths && debtBalances.some(d => !d.paidOff)) {
      month++;
      const currentDate = new Date();
      currentDate.setMonth(currentDate.getMonth() + month);

      const monthDebts: StrategyResult['monthlyProjections'][0]['debts'] = [];
      let extraPaymentRemaining = extraMonthlyPayment;

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

        let payment = debt.minPayment;

        if (debtBalances.filter(d => !d.paidOff).length === 1 ||
            debt === debtBalances.find(d => !d.paidOff && d.rate === Math.max(...debtBalances.filter(d => !d.paidOff).map(d => d.rate)))) {
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
        date: currentDate.toISOString().split('T')[0],
        debts: monthDebts,
        totalBalance,
      });

      if (totalBalance === 0) break;
    }

    const totalMinimumPayments = sortedDebts.reduce((sum, d) => sum + d.minimumPayment, 0);
    const totalPaid = (totalMinimumPayments + extraMonthlyPayment) * month;

    const payoffTimeline = debtBalances
      .filter(d => d.paidOff)
      .map(d => {
        const payoffDate = new Date();
        payoffDate.setMonth(payoffDate.getMonth() + d.payoffMonth);
        return {
          debtId: d.debtId,
          debtName: d.debtName,
          payoffMonth: d.payoffMonth,
          payoffDate: payoffDate.toISOString().split('T')[0],
        };
      })
      .sort((a, b) => a.payoffMonth - b.payoffMonth);

    const debtFreeDate = new Date();
    debtFreeDate.setMonth(debtFreeDate.getMonth() + month);

    return {
      strategy: {
        type: 'extra-payment',
        extraMonthlyPayment,
        calculatedAt: new Date().toISOString(),
      },
      debtFreeDate: debtFreeDate.toISOString().split('T')[0],
      totalMonths: month,
      totalInterest: Math.round(totalInterestPaid * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      payoffTimeline,
      monthlyProjections,
    };
  },

  projectMinimumPaymentsOnly(debts: Debt[]): StrategyResult {
    return this.projectDebtPayoff(debts, 0);
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

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  formatMonthYear(dateString: string): string {
    const date = new Date(dateString);
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
};
