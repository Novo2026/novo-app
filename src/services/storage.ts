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
  FeaturePreferences,
  HELOCTransaction,
  CheckingAccount,
  CheckingTransaction,
  UnifiedPayment,
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
  HELOC_TRANSACTIONS: 'novo_heloc_transactions',
  CHECKING_TRANSACTIONS: 'novo_checking_transactions',
  CHECKING_ACCOUNTS: 'novo_checking_accounts',
  CHECKING_TRANSACTIONS_V2: 'novo_checking_transactions_v2',
  DATA_HASH: 'novo_data_hash',
  STRATEGY_CALC_HASH: 'novo_strategy_calc_hash',
  FEATURE_PREFERENCES: 'novo_feature_preferences',
  UNIFIED_PAYMENTS: 'novo_unified_payments',
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

  deleteTransaction(transactionId: string): void {
    const transactions = this.getTransactions();
    const txIndex = transactions.findIndex(t => t.id === transactionId);
    if (txIndex === -1) return;

    const tx = transactions[txIndex];
    const remaining = transactions.filter(t => t.id !== transactionId);

    const debts = this.getDebts();
    const debtIndex = debts.findIndex(d => d.id === tx.debtId);

    if (debtIndex !== -1) {
      const debtTransactions = remaining
        .filter(t => t.debtId === tx.debtId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let newBalance: number;
      if (debtTransactions.length === 0) {
        newBalance = debts[debtIndex].startingBalance;
      } else {
        newBalance = debtTransactions[debtTransactions.length - 1].newBalance;
      }

      debts[debtIndex] = {
        ...debts[debtIndex],
        currentBalance: newBalance,
        isPaidOff: newBalance <= 0,
        paidOffDate: newBalance <= 0 ? debts[debtIndex].paidOffDate : undefined,
      };
      this.saveDebts(debts);
    }

    this.saveTransactions(remaining);

    const unifiedPayments = this.getUnifiedPayments().filter(p => p.id !== transactionId);
    this.saveUnifiedPayments(unifiedPayments);
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
      featurePreferences: this.getFeaturePreferences(),
    };
  },

  clearAllData(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('novo_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      if (key === 'novo_access_record') return;
      localStorage.removeItem(key);
    });

    localStorage.removeItem('userName');
    localStorage.removeItem('lastVisit');
    localStorage.removeItem('userAddress');
    localStorage.removeItem('chunkingQuizPassed');
    localStorage.removeItem('novo_smarter_payments_visited');
    localStorage.removeItem('novo_first_chat_completed');
    localStorage.removeItem('novo_install_date');
    localStorage.removeItem('novo_start_here_dismissed');

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
      if (data.featurePreferences) this.saveFeaturePreferences(data.featurePreferences);
    } catch (error) {
      throw new Error('Invalid data format');
    }
  },

  calculateDataHash(): string {
    const debts = this.getDebts().filter(d => !d.isPaidOff);
    const financialProfile = this.getFinancialProfile();
    const homeEquity = this.getHomeEquity();
    const helocTransactions = localStorage.getItem(STORAGE_KEYS.HELOC_TRANSACTIONS);

    const relevantData = {
      debtsCount: debts.length,
      totalBalance: debts.reduce((sum, d) => sum + d.currentBalance, 0),
      monthlyNetIncome: financialProfile?.monthlyNetIncome || 0,
      monthlyEssentialExpenses: financialProfile?.monthlyEssentialExpenses || 0,
      monthlyDiscretionaryExpenses: financialProfile?.monthlyDiscretionaryExpenses || 0,
      monthlySavingsGoal: financialProfile?.monthlySavingsGoal || 0,
      surplusCommitmentPercent: financialProfile?.surplusCommitmentPercent ?? 100,
      helocBalance: homeEquity?.helocBalance || 0,
      helocTransactionsCount: helocTransactions ? JSON.parse(helocTransactions).length : 0,
    };

    return JSON.stringify(relevantData);
  },

  hasDataChangedSinceLastCalculation(): boolean {
    const currentHash = this.calculateDataHash();
    const lastCalcHash = localStorage.getItem(STORAGE_KEYS.STRATEGY_CALC_HASH);

    return currentHash !== lastCalcHash;
  },

  markStrategyCalculated(): void {
    const currentHash = this.calculateDataHash();
    localStorage.setItem(STORAGE_KEYS.STRATEGY_CALC_HASH, currentHash);
  },

  shouldAutoRecalculate(): boolean {
    const strategyResult = this.getStrategyResult();
    if (!strategyResult) return false;

    return this.hasDataChangedSinceLastCalculation();
  },

  getFeaturePreferences(): FeaturePreferences {
    const data = localStorage.getItem(STORAGE_KEYS.FEATURE_PREFERENCES);
    return data ? JSON.parse(data) : { helocEnabled: false, checkingEnabled: true };
  },

  saveFeaturePreferences(preferences: FeaturePreferences): void {
    localStorage.setItem(STORAGE_KEYS.FEATURE_PREFERENCES, JSON.stringify(preferences));
  },

  getHELOCTransactions(): HELOCTransaction[] {
    const data = localStorage.getItem(STORAGE_KEYS.HELOC_TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  },

  saveHELOCTransactions(transactions: HELOCTransaction[]): void {
    localStorage.setItem(STORAGE_KEYS.HELOC_TRANSACTIONS, JSON.stringify(transactions));
  },

  getCheckingAccounts(): CheckingAccount[] {
    try {
      const stored = localStorage.getItem('novo_checking_accounts');
      if (stored) return JSON.parse(stored);

      const oldBalance = localStorage.getItem('novo_checking_starting_balance');
      const oldTransactions = localStorage.getItem('novo_checking_transactions');

      if (oldTransactions || oldBalance) {
        const defaultAccount: CheckingAccount = {
          id: 'default_checking',
          name: 'Primary Checking',
          bankName: '',
          accountType: 'checking',
          startingBalance: parseFloat(oldBalance || '0'),
          currentBalance: parseFloat(oldBalance || '0'),
          lastReconciledAt: null,
          lastReconciledBalance: null,
          createdAt: new Date().toISOString(),
          isDefault: true,
        };
        this.saveCheckingAccounts([defaultAccount]);
        return [defaultAccount];
      }

      return [];
    } catch { return []; }
  },

  saveCheckingAccounts(accounts: CheckingAccount[]): void {
    localStorage.setItem('novo_checking_accounts', JSON.stringify(accounts));
  },

  getCheckingTransactionsForAccount(accountId: string): CheckingTransaction[] {
    try {
      const stored = localStorage.getItem(`novo_checking_transactions_${accountId}`);
      if (stored) return JSON.parse(stored);

      if (accountId === 'default_checking') {
        const old = localStorage.getItem('novo_checking_transactions');
        if (old) {
          const transactions = JSON.parse(old).map((t: CheckingTransaction & { accountId?: string; isReconciled?: boolean }) => ({
            ...t,
            accountId: 'default_checking',
            isReconciled: t.isReconciled ?? false,
          }));
          this.saveCheckingTransactionsForAccount(accountId, transactions);
          return transactions;
        }
      }
      return [];
    } catch { return []; }
  },

  saveCheckingTransactionsForAccount(accountId: string, transactions: CheckingTransaction[]): void {
    localStorage.setItem(`novo_checking_transactions_${accountId}`, JSON.stringify(transactions));
  },

  reconcileAccount(accountId: string, balance: number): void {
    const accounts = this.getCheckingAccounts();
    const idx = accounts.findIndex(a => a.id === accountId);
    if (idx !== -1) {
      accounts[idx].lastReconciledAt = new Date().toISOString();
      accounts[idx].lastReconciledBalance = balance;
      accounts[idx].currentBalance = balance;
      this.saveCheckingAccounts(accounts);
    }
    const transactions = this.getCheckingTransactionsForAccount(accountId);
    const updated = transactions.map(t => ({
      ...t,
      isReconciled: true,
      reconciledAt: new Date().toISOString(),
    }));
    this.saveCheckingTransactionsForAccount(accountId, updated);
  },

  unreconcileAccount(accountId: string): void {
    const accounts = this.getCheckingAccounts();
    const idx = accounts.findIndex(a => a.id === accountId);
    if (idx !== -1) {
      accounts[idx].lastReconciledAt = null;
      accounts[idx].lastReconciledBalance = null;
      this.saveCheckingAccounts(accounts);
    }
    const transactions = this.getCheckingTransactionsForAccount(accountId);
    const updated = transactions.map(t => ({
      ...t,
      isReconciled: false,
      reconciledAt: undefined,
    }));
    this.saveCheckingTransactionsForAccount(accountId, updated);
  },

  getCheckingTransactions(): CheckingTransaction[] {
    const accounts = this.getCheckingAccounts();
    if (accounts.length > 0) {
      return accounts.flatMap(a => this.getCheckingTransactionsForAccount(a.id));
    }
    const data = localStorage.getItem(STORAGE_KEYS.CHECKING_TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  },

  saveCheckingTransactions(transactions: CheckingTransaction[]): void {
    const accounts = this.getCheckingAccounts();
    const accountId = accounts.find(a => a.isDefault)?.id || accounts[0]?.id || 'default_checking';
    this.saveCheckingTransactionsForAccount(accountId, transactions);
  },

  getUnifiedPayments(): UnifiedPayment[] {
    const data = localStorage.getItem(STORAGE_KEYS.UNIFIED_PAYMENTS);
    return data ? JSON.parse(data) : [];
  },

  saveUnifiedPayments(payments: UnifiedPayment[]): void {
    localStorage.setItem(STORAGE_KEYS.UNIFIED_PAYMENTS, JSON.stringify(payments));
  },

  addUnifiedPayment(payment: UnifiedPayment): void {
    const payments = this.getUnifiedPayments();
    payments.push(payment);
    this.saveUnifiedPayments(payments);
  },

  deleteUnifiedPayment(paymentId: string): void {
    const payments = this.getUnifiedPayments().filter(p => p.id !== paymentId);
    this.saveUnifiedPayments(payments);
  },

  deduplicatePayments(): void {
    const payments = this.getUnifiedPayments();
    const seen = new Map<string, UnifiedPayment>();

    payments.forEach(payment => {
      const key = `${payment.debtId}-${payment.date}-${payment.amount}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, payment);
      } else {
        if (payment.source === 'checking' || payment.source === 'heloc') {
          seen.set(key, payment);
        }
      }
    });

    const deduped = Array.from(seen.values());
    this.saveUnifiedPayments(deduped);
  },
};
