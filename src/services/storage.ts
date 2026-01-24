import type {
  Debt,
  Transaction,
  SavingsAccount,
  Milestone,
  FinancialProfile,
  HomeEquity,
  Strategy,
  StrategyResult,
  AppData,
} from '../types';

const STORAGE_KEYS = {
  DEBTS: 'novo_debts',
  TRANSACTIONS: 'novo_payments',
  SAVINGS_ACCOUNTS: 'novo_savings_accounts',
  MILESTONES: 'novo_milestones',
  FINANCIAL_PROFILE: 'novo_financial_profile',
  HOME_EQUITY: 'novo_home_equity',
  STRATEGY: 'novo_strategy',
  STRATEGY_RESULT: 'novo_strategy_result',
};

export const StorageService = {
  getDebts(): Debt[] {
    const data = localStorage.getItem(STORAGE_KEYS.DEBTS);
    return data ? JSON.parse(data) : [];
  },

  saveDebts(debts: Debt[]): void {
    localStorage.setItem(STORAGE_KEYS.DEBTS, JSON.stringify(debts));
  },

  deleteDebt(debtId: string): void {
    const debts = this.getDebts().filter(d => d.id !== debtId);
    this.saveDebts(debts);

    const transactions = this.getTransactions().filter(t => t.debtId !== debtId);
    this.saveTransactions(transactions);
  },

  getTransactions(): Transaction[] {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  },

  saveTransactions(transactions: Transaction[]): void {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  },

  getSavingsAccounts(): SavingsAccount[] {
    const data = localStorage.getItem(STORAGE_KEYS.SAVINGS_ACCOUNTS);
    return data ? JSON.parse(data) : [];
  },

  saveSavingsAccounts(accounts: SavingsAccount[]): void {
    localStorage.setItem(STORAGE_KEYS.SAVINGS_ACCOUNTS, JSON.stringify(accounts));
  },

  getMilestones(): Milestone[] {
    const data = localStorage.getItem(STORAGE_KEYS.MILESTONES);
    return data ? JSON.parse(data) : [];
  },

  saveMilestones(milestones: Milestone[]): void {
    localStorage.setItem(STORAGE_KEYS.MILESTONES, JSON.stringify(milestones));
  },

  addMilestone(milestone: Milestone): void {
    const milestones = this.getMilestones();
    milestones.unshift(milestone);
    this.saveMilestones(milestones);
  },

  getFinancialProfile(): FinancialProfile | null {
    const data = localStorage.getItem(STORAGE_KEYS.FINANCIAL_PROFILE);
    return data ? JSON.parse(data) : null;
  },

  saveFinancialProfile(profile: FinancialProfile): void {
    localStorage.setItem(STORAGE_KEYS.FINANCIAL_PROFILE, JSON.stringify(profile));
  },

  getHomeEquity(): HomeEquity | null {
    const data = localStorage.getItem(STORAGE_KEYS.HOME_EQUITY);
    return data ? JSON.parse(data) : null;
  },

  saveHomeEquity(homeEquity: HomeEquity): void {
    localStorage.setItem(STORAGE_KEYS.HOME_EQUITY, JSON.stringify(homeEquity));
  },

  getStrategy(): Strategy | null {
    const data = localStorage.getItem(STORAGE_KEYS.STRATEGY);
    return data ? JSON.parse(data) : null;
  },

  saveStrategy(strategy: Strategy): void {
    localStorage.setItem(STORAGE_KEYS.STRATEGY, JSON.stringify(strategy));
  },

  getStrategyResult(): StrategyResult | null {
    const data = localStorage.getItem(STORAGE_KEYS.STRATEGY_RESULT);
    return data ? JSON.parse(data) : null;
  },

  saveStrategyResult(result: StrategyResult): void {
    localStorage.setItem(STORAGE_KEYS.STRATEGY_RESULT, JSON.stringify(result));
  },

  getAllData(): AppData {
    return {
      debts: this.getDebts(),
      transactions: this.getTransactions(),
      savingsAccounts: this.getSavingsAccounts(),
      milestones: this.getMilestones(),
      financialProfile: this.getFinancialProfile() || undefined,
      homeEquity: this.getHomeEquity() || undefined,
      strategy: this.getStrategy() || undefined,
      strategyResult: this.getStrategyResult() || undefined,
    };
  },

  clearAllData(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    sessionStorage.clear();
  },

  exportData(): string {
    const data = this.getAllData();
    return JSON.stringify(data, null, 2);
  },

  importData(jsonString: string): void {
    try {
      const data: AppData = JSON.parse(jsonString);
      if (data.debts) this.saveDebts(data.debts);
      if (data.transactions) this.saveTransactions(data.transactions);
      if (data.savingsAccounts) this.saveSavingsAccounts(data.savingsAccounts);
      if (data.milestones) this.saveMilestones(data.milestones);
      if (data.financialProfile) this.saveFinancialProfile(data.financialProfile);
      if (data.homeEquity) this.saveHomeEquity(data.homeEquity);
      if (data.strategy) this.saveStrategy(data.strategy);
      if (data.strategyResult) this.saveStrategyResult(data.strategyResult);
    } catch (error) {
      throw new Error('Invalid data format');
    }
  },
};
