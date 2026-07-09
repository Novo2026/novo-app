import { recalculateCheckingBalances } from '../utils/savingsTransactions';
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
  ACCOUNT_TYPE: 'novo_account_type',
  IMPORT_BATCHES: 'novo_import_batches',
};

export type ImportBatchRecord = {
  batchId: string;
  accountId: string;
  accountName: string;
  importedAt: string;
  transactionCount: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  totalDebits: number;
  totalCredits: number;
  status: 'active' | 'undone';
};

export type LegacyDuplicatePair = {
  manual: CheckingTransaction & { source?: 'import' | 'manual'; batchId?: string };
  imported: CheckingTransaction & { source?: 'import' | 'manual'; batchId?: string };
};

type ExtendedCheckingTransaction = CheckingTransaction & {
  source?: 'import' | 'manual';
  batchId?: string;
  originalDescription?: string;
};

function normalizeDescriptionForMatch(description: string): string {
  return description
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function descriptionsAreSimilar(a: string, b: string): boolean {
  const normalizedA = normalizeDescriptionForMatch(a);
  const normalizedB = normalizeDescriptionForMatch(b);
  if (normalizedA === normalizedB) return true;
  if (
    normalizedA.length >= 4 &&
    normalizedB.length >= 4 &&
    (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA))
  ) {
    return true;
  }

  const wordsA = new Set(normalizedA.split(' ').filter((word) => word.length > 2));
  const wordsB = new Set(normalizedB.split(' ').filter((word) => word.length > 2));
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap += 1;
  }
  const minSize = Math.min(wordsA.size, wordsB.size);
  return minSize > 0 && overlap / minSize >= 0.6;
}

function isLikelyImportedTransaction(tx: ExtendedCheckingTransaction): boolean {
  if (tx.batchId) return true;
  if (tx.source === 'import') return true;
  if (tx.id.startsWith('import_') || tx.id.startsWith('cc_payment_')) return true;
  if (tx.originalDescription && tx.originalDescription !== tx.description) return true;
  return false;
}

export const StorageService = {
  saveAccountType(type: 'solo' | 'couple' | 'family'): void {
    localStorage.setItem(STORAGE_KEYS.ACCOUNT_TYPE, type);
  },

  getAccountType(): 'solo' | 'couple' | 'family' {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNT_TYPE);
    if (raw === 'couple' || raw === 'family' || raw === 'solo') return raw;
    const legacy = localStorage.getItem('userAccountType');
    if (legacy === 'couple' || legacy === 'family' || legacy === 'solo') return legacy;
    return 'solo';
  },

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

  syncCheckingAccountBalance(accountId: string, transactions: CheckingTransaction[]): void {
    const accounts = this.getCheckingAccounts();
    const idx = accounts.findIndex((a) => a.id === accountId);
    if (idx === -1) return;

    const account = accounts[idx];
    const balance =
      transactions.length > 0
        ? transactions[transactions.length - 1].balance
        : account.startingBalance;
    accounts[idx] = { ...account, currentBalance: balance };
    this.saveCheckingAccounts(accounts);
  },

  updateTransaction(
    accountId: string,
    transactionId: string,
    updatedFields: Partial<CheckingTransaction>
  ): CheckingTransaction[] {
    const sourceAccount = this.getCheckingAccounts().find((a) => a.id === accountId);
    const sourceStarting = sourceAccount?.startingBalance ?? 0;
    const sourceTransactions = this.getCheckingTransactionsForAccount(accountId);
    const index = sourceTransactions.findIndex((t) => t.id === transactionId);
    if (index === -1) {
      throw new Error('Transaction not found');
    }

    const existing = sourceTransactions[index];
    if (existing.isReconciled) {
      throw new Error('Cannot edit reconciled transactions');
    }

    const targetAccountId = updatedFields.accountId ?? accountId;
    const merged: CheckingTransaction = {
      ...existing,
      ...updatedFields,
      id: transactionId,
      accountId: targetAccountId,
      isReconciled: existing.isReconciled,
      reconciledAt: existing.reconciledAt,
    };

    if (targetAccountId !== accountId) {
      const fromFiltered = sourceTransactions.filter((t) => t.id !== transactionId);
      const fromRecalculated = recalculateCheckingBalances(fromFiltered, sourceStarting);
      this.saveCheckingTransactionsForAccount(accountId, fromRecalculated);
      this.syncCheckingAccountBalance(accountId, fromRecalculated);

      const targetAccount = this.getCheckingAccounts().find((a) => a.id === targetAccountId);
      const targetStarting = targetAccount?.startingBalance ?? 0;
      const toTransactions = [...this.getCheckingTransactionsForAccount(targetAccountId), merged];
      const toRecalculated = recalculateCheckingBalances(toTransactions, targetStarting);
      this.saveCheckingTransactionsForAccount(targetAccountId, toRecalculated);
      this.syncCheckingAccountBalance(targetAccountId, toRecalculated);
      return toRecalculated;
    }

    const updatedList = [...sourceTransactions];
    updatedList[index] = merged;
    const recalculated = recalculateCheckingBalances(updatedList, sourceStarting);
    this.saveCheckingTransactionsForAccount(accountId, recalculated);
    this.syncCheckingAccountBalance(accountId, recalculated);
    return recalculated;
  },

  deleteTransaction(accountIdOrTransactionId: string, checkingTransactionId?: string): number | void {
    if (checkingTransactionId !== undefined) {
      const accountId = accountIdOrTransactionId;
      const transactions = this.getCheckingTransactionsForAccount(accountId);
      const target = transactions.find((t) => t.id === checkingTransactionId);
      if (!target) return 0;
      if (target.isReconciled) {
        throw new Error('Cannot delete reconciled transactions');
      }

      const account = this.getCheckingAccounts().find((a) => a.id === accountId);
      const startingBalance = account?.startingBalance ?? 0;
      const filtered = transactions.filter((t) => t.id !== checkingTransactionId);
      const recalculated = recalculateCheckingBalances(filtered, startingBalance);
      this.saveCheckingTransactionsForAccount(accountId, recalculated);
      this.syncCheckingAccountBalance(accountId, recalculated);
      return 1;
    }

    const transactionId = accountIdOrTransactionId;
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

    const accessRecord = localStorage.getItem('novo_access_record');
    localStorage.clear();
    if (accessRecord) {
      localStorage.setItem('novo_access_record', accessRecord);
    }

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
      if (stored) {
        return JSON.parse(stored).map((t: CheckingTransaction & { source?: 'import' | 'manual'; originalDescription?: string }) => ({
          ...t,
          source: t.source ?? 'manual',
          originalDescription: t.originalDescription ?? t.description,
        }));
      }

      if (accountId === 'default_checking') {
        const old = localStorage.getItem('novo_checking_transactions');
        if (old) {
          const transactions = JSON.parse(old).map((t: CheckingTransaction & { accountId?: string; isReconciled?: boolean }) => ({
            ...t,
            accountId: 'default_checking',
            isReconciled: t.isReconciled ?? false,
            source: (t as CheckingTransaction & { source?: 'import' | 'manual' }).source ?? 'manual',
            originalDescription: (t as CheckingTransaction & { originalDescription?: string }).originalDescription ?? t.description,
          }));
          this.saveCheckingTransactionsForAccount(accountId, transactions);
          return transactions;
        }
      }
      return [];
    } catch { return []; }
  },

  saveCheckingTransactionsForAccount(accountId: string, transactions: CheckingTransaction[]): void {
    const normalized = transactions.map((t) => ({
      ...t,
      source: (t as CheckingTransaction & { source?: 'import' | 'manual' }).source ?? 'manual',
      originalDescription: (t as CheckingTransaction & { originalDescription?: string }).originalDescription ?? t.description,
    }));
    localStorage.setItem(`novo_checking_transactions_${accountId}`, JSON.stringify(normalized));
  },

  saveBatchRecord(batch: ImportBatchRecord): void {
    const existing = localStorage.getItem(STORAGE_KEYS.IMPORT_BATCHES);
    const batches: ImportBatchRecord[] = existing ? JSON.parse(existing) : [];
    batches.push(batch);
    localStorage.setItem(STORAGE_KEYS.IMPORT_BATCHES, JSON.stringify(batches));
  },

  undoImportBatch(batchId: string, accountId: string): number {
    const account = this.getCheckingAccounts().find((a) => a.id === accountId);
    const startingBalance = account?.startingBalance ?? 0;
    const transactions = this.getCheckingTransactionsForAccount(accountId);
    const removedCount = transactions.filter(
      (tx) =>
        (tx as ExtendedCheckingTransaction).batchId === batchId && !tx.isReconciled
    ).length;
    const filtered = transactions.filter(
      (tx) =>
        (tx as ExtendedCheckingTransaction).batchId !== batchId || tx.isReconciled
    );
    const recalculated = recalculateCheckingBalances(filtered, startingBalance);
    this.saveCheckingTransactionsForAccount(accountId, recalculated);
    this.syncCheckingAccountBalance(accountId, recalculated);

    const existing = localStorage.getItem(STORAGE_KEYS.IMPORT_BATCHES);
    const batches: ImportBatchRecord[] = existing ? JSON.parse(existing) : [];
    const updated = batches.map((batch) =>
      batch.batchId === batchId ? { ...batch, status: 'undone' as const } : batch
    );
    localStorage.setItem(STORAGE_KEYS.IMPORT_BATCHES, JSON.stringify(updated));

    return removedCount;
  },

  getImportBatches(accountId?: string): ImportBatchRecord[] {
    const existing = localStorage.getItem(STORAGE_KEYS.IMPORT_BATCHES);
    const batches: ImportBatchRecord[] = existing ? JSON.parse(existing) : [];
    return batches
      .filter((batch) => (accountId ? batch.accountId === accountId : true))
      .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
  },

  findLegacyImportDuplicatePairs(accountId: string): LegacyDuplicatePair[] {
    const transactions = this.getCheckingTransactionsForAccount(accountId) as ExtendedCheckingTransaction[];
    const pairs: LegacyDuplicatePair[] = [];
    const usedIds = new Set<string>();

    for (let i = 0; i < transactions.length; i += 1) {
      const first = transactions[i];
      if (usedIds.has(first.id)) continue;

      for (let j = i + 1; j < transactions.length; j += 1) {
        const second = transactions[j];
        if (usedIds.has(second.id)) continue;
        if (first.date !== second.date) continue;
        if (Math.abs(first.amount - second.amount) > 0.001) continue;
        if (first.type !== second.type) continue;
        if (!descriptionsAreSimilar(first.description, second.description)) continue;

        if (first.batchId && second.batchId) continue;

        const firstImported = isLikelyImportedTransaction(first);
        const secondImported = isLikelyImportedTransaction(second);

        let manual: ExtendedCheckingTransaction;
        let imported: ExtendedCheckingTransaction;

        if (firstImported && !secondImported) {
          imported = first;
          manual = second;
        } else if (secondImported && !firstImported) {
          imported = second;
          manual = first;
        } else {
          manual = first;
          imported = second;
        }

        if (imported.isReconciled) continue;

        pairs.push({ manual, imported });
        usedIds.add(manual.id);
        usedIds.add(imported.id);
        break;
      }
    }

    return pairs;
  },

  removeCheckingTransactionsByIds(accountId: string, transactionIds: string[]): number {
    const account = this.getCheckingAccounts().find((a) => a.id === accountId);
    const startingBalance = account?.startingBalance ?? 0;
    const transactions = this.getCheckingTransactionsForAccount(accountId);
    const idsToRemove = new Set(transactionIds);
    const removedCount = transactions.filter(
      (tx) => idsToRemove.has(tx.id) && !tx.isReconciled
    ).length;
    const filtered = transactions.filter(
      (tx) => !idsToRemove.has(tx.id) || tx.isReconciled
    );
    const recalculated = recalculateCheckingBalances(filtered, startingBalance);
    this.saveCheckingTransactionsForAccount(accountId, recalculated);
    this.syncCheckingAccountBalance(accountId, recalculated);
    return removedCount;
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
