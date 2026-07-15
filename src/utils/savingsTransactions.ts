import { CalculationService } from '../services/calculations';
import { StorageService } from '../services/storage';
import type { CheckingTransaction, SavingsTransaction, SavingsTransactionType } from '../types';

export type SavingsEditType = 'deposit' | 'withdrawal' | 'interest' | 'transfer';

export function isSavingsInflow(type: SavingsTransactionType): boolean {
  return type === 'deposit' || type === 'interest' || type === 'transfer_from_checking';
}

export function isSavingsOutflow(type: SavingsTransactionType): boolean {
  return type === 'withdrawal' || type === 'transfer_to_checking';
}

export function getSavingsTypeLabel(type: SavingsTransactionType): string {
  switch (type) {
    case 'transfer_to_checking':
      return 'To Checking';
    case 'transfer_from_checking':
      return 'From Checking';
    case 'transfer':
      return 'Transfer';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

export function getSavingsCategory(transaction: SavingsTransaction): string {
  if (transaction.category) return transaction.category;
  return getSavingsTypeLabel(transaction.type);
}

export function toEditType(type: SavingsTransactionType): SavingsEditType {
  if (type === 'transfer_to_checking' || type === 'transfer_from_checking' || type === 'transfer') {
    return 'transfer';
  }
  return type;
}

export function recalculateSavingsTransactions(transactions: SavingsTransaction[]): {
  transactions: SavingsTransaction[];
  balance: number;
} {
  let balance = 0;
  const sorted = [...transactions].sort((a, b) =>
    CalculationService.compareDateStrings(a.date, b.date)
  );

  const updated = sorted.map((tx) => {
    if (isSavingsOutflow(tx.type)) {
      balance -= tx.amount;
    } else {
      balance += tx.amount;
    }
    balance = Math.max(0, Math.round(balance * 100) / 100);
    return {
      ...tx,
      date: CalculationService.normalizeDateString(tx.date),
      balanceAfter: balance,
    };
  });

  return { transactions: updated, balance };
}

export function recalculateCheckingBalances(
  transactions: CheckingTransaction[],
  startingBalance: number
): CheckingTransaction[] {
  let runningBalance = startingBalance;
  const sorted = [...transactions].sort((a, b) =>
    CalculationService.compareDateStrings(a.date, b.date)
  );

  return sorted.map((transaction) => {
    if (transaction.type === 'balance_adjustment') {
      // Amount is signed: positive credit / negative debit
      runningBalance += transaction.amount;
    } else if (
      transaction.type === 'deposit' ||
      transaction.type === 'transfer_from_heloc' ||
      transaction.type === 'transfer_from_checking' ||
      transaction.type === 'transfer_from_savings'
    ) {
      runningBalance += transaction.amount;
    } else {
      runningBalance -= transaction.amount;
    }
    runningBalance = Math.max(0, runningBalance);
    return {
      ...transaction,
      balance: Math.round(runningBalance * 100) / 100,
    };
  });
}

export function removeLinkedCheckingTransaction(
  checkingAccountId: string,
  linkedTransactionId: string
): void {
  const checkingAccount = StorageService.getCheckingAccounts().find((a) => a.id === checkingAccountId);
  const startingBalance = checkingAccount?.startingBalance ?? 0;
  const transactions = StorageService.getCheckingTransactionsForAccount(checkingAccountId).filter(
    (t) => t.id !== linkedTransactionId
  );
  const recalculated = recalculateCheckingBalances(transactions, startingBalance);
  StorageService.saveCheckingTransactionsForAccount(checkingAccountId, recalculated);
}

export function upsertLinkedCheckingTransaction(
  checkingAccountId: string,
  transaction: CheckingTransaction
): void {
  const checkingAccount = StorageService.getCheckingAccounts().find((a) => a.id === checkingAccountId);
  const startingBalance = checkingAccount?.startingBalance ?? 0;
  const transactions = StorageService.getCheckingTransactionsForAccount(checkingAccountId);
  const index = transactions.findIndex((t) => t.id === transaction.id);
  if (index === -1) {
    transactions.push(transaction);
  } else {
    transactions[index] = transaction;
  }
  const recalculated = recalculateCheckingBalances(transactions, startingBalance);
  StorageService.saveCheckingTransactionsForAccount(checkingAccountId, recalculated);
}

export interface RecordTransferToSavingsParams {
  checkingAccountId: string;
  checkingStartingBalance: number;
  savingsAccountId: string;
  amount: number;
  date: string;
  /** Checking-side description. Defaults to "Transfer to {savings name}". */
  description?: string;
  /** Name of the checking/source account for the savings-side description. */
  sourceAccountName?: string;
  /**
   * When set with linkExistingCheckingOnly, the checking cash movement already exists
   * (e.g. statement import). Only create/link the savings deposit.
   */
  existingCheckingTransactionId?: string;
  linkExistingCheckingOnly?: boolean;
}

export interface RecordTransferToSavingsResult {
  checkingTransactionId: string;
  savingsTransactionId: string;
  checkingBalance: number;
  savingsBalance: number;
  skippedDuplicate: boolean;
}

function datesMatch(a: string, b: string): boolean {
  const na = CalculationService.normalizeDateString(a) || a.slice(0, 10);
  const nb = CalculationService.normalizeDateString(b) || b.slice(0, 10);
  return na === nb;
}

/** True if this checking→savings transfer was already applied (idempotent re-import guard). */
export function isTransferToSavingsAlreadyLinked(
  checkingAccountId: string,
  checkingTransactionId: string | undefined,
  savingsAccountId: string,
  date: string,
  amount: number
): boolean {
  const savings = StorageService.getSavingsAccounts().find((a) => a.id === savingsAccountId);
  const savingsTxs = savings?.transactions || [];

  if (checkingTransactionId) {
    const checkingTx = StorageService.getCheckingTransactionsForAccount(checkingAccountId).find(
      (t) => t.id === checkingTransactionId
    );
    if (
      checkingTx?.linkedSavingsTransactionId &&
      checkingTx.linkedSavingsAccountId === savingsAccountId &&
      savingsTxs.some((t) => t.id === checkingTx.linkedSavingsTransactionId)
    ) {
      return true;
    }

    if (
      savingsTxs.some(
        (t) =>
          t.type === 'transfer_from_checking' &&
          t.linkedCheckingTransactionId === checkingTransactionId
      )
    ) {
      return true;
    }
  }

  // Re-import / Add Anyway may mint a new checking id — match prior savings deposit by date+amount.
  return savingsTxs.some(
    (t) =>
      t.type === 'transfer_from_checking' &&
      Math.abs(t.amount - amount) < 0.02 &&
      datesMatch(t.date, date)
  );
}

/**
 * Dual-write checking → savings transfer (same behavior as TransferToSavingsModal).
 * When linkExistingCheckingOnly + existingCheckingTransactionId, only adds the savings
 * side and stamps links on the existing checking row.
 */
export function recordTransferToSavings(
  params: RecordTransferToSavingsParams
): RecordTransferToSavingsResult {
  const {
    checkingAccountId,
    checkingStartingBalance,
    savingsAccountId,
    amount,
    description,
    sourceAccountName,
    existingCheckingTransactionId,
    linkExistingCheckingOnly,
  } = params;

  if (!checkingAccountId) {
    throw new Error('No checking account selected. Please select a checking account and try again.');
  }
  if (!savingsAccountId) {
    throw new Error('Please select a savings account.');
  }
  if (!amount || amount <= 0) {
    throw new Error('Please enter a valid amount.');
  }

  const transferDate = CalculationService.normalizeDateString(params.date);
  if (!transferDate) {
    throw new Error('Please select a valid date.');
  }

  if (
    isTransferToSavingsAlreadyLinked(
      checkingAccountId,
      existingCheckingTransactionId,
      savingsAccountId,
      transferDate,
      amount
    )
  ) {
    const checkingTxs = StorageService.getCheckingTransactionsForAccount(checkingAccountId);
    const checkingBalance =
      checkingTxs.length > 0 ? checkingTxs[checkingTxs.length - 1].balance : checkingStartingBalance;
    const savings = StorageService.getSavingsAccounts().find((a) => a.id === savingsAccountId);
    return {
      checkingTransactionId: existingCheckingTransactionId || '',
      savingsTransactionId: '',
      checkingBalance,
      savingsBalance: savings?.balance ?? 0,
      skippedDuplicate: true,
    };
  }

  const allSavings = StorageService.getSavingsAccounts();
  const savingsIndex = allSavings.findIndex((a) => a.id === savingsAccountId);
  if (savingsIndex === -1) {
    throw new Error('Selected savings account could not be found.');
  }

  const savingsAccount = allSavings[savingsIndex];
  const savingsTxId = `savings_tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const checkingTxId =
    existingCheckingTransactionId ||
    `checking_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const checkingDescription =
    description?.trim() || `Transfer to ${savingsAccount.name || 'Savings'}`;
  const savingsDescription =
    description?.trim() || `Transfer from ${sourceAccountName || 'Checking'}`;

  let checkingTransactions = StorageService.getCheckingTransactionsForAccount(checkingAccountId);

  if (linkExistingCheckingOnly && existingCheckingTransactionId) {
    const idx = checkingTransactions.findIndex((t) => t.id === existingCheckingTransactionId);
    if (idx === -1) {
      throw new Error('Imported checking transaction could not be found to link.');
    }
    checkingTransactions[idx] = {
      ...checkingTransactions[idx],
      type: 'transfer_to_savings',
      description: checkingTransactions[idx].description || checkingDescription,
      linkedSavingsTransactionId: savingsTxId,
      linkedSavingsAccountId: savingsAccountId,
    };
    checkingTransactions = recalculateCheckingBalances(
      checkingTransactions,
      checkingStartingBalance
    );
    StorageService.saveCheckingTransactionsForAccount(checkingAccountId, checkingTransactions);
  } else {
    const newCheckingTx: CheckingTransaction = {
      id: checkingTxId,
      accountId: checkingAccountId,
      date: transferDate,
      type: 'transfer_to_savings',
      amount,
      description: checkingDescription,
      balance: 0,
      isReconciled: false,
      linkedSavingsTransactionId: savingsTxId,
      linkedSavingsAccountId: savingsAccountId,
    };
    checkingTransactions = recalculateCheckingBalances(
      [...checkingTransactions, newCheckingTx],
      checkingStartingBalance
    );
    StorageService.saveCheckingTransactionsForAccount(checkingAccountId, checkingTransactions);
  }

  const newSavingsTransaction: SavingsTransaction = {
    id: savingsTxId,
    date: transferDate,
    type: 'transfer_from_checking',
    amount,
    description: savingsDescription,
    category: 'From Checking',
    balanceAfter: 0,
    linkedCheckingTransactionId: checkingTxId,
    linkedCheckingAccountId: checkingAccountId,
  };

  const { transactions: recalculatedSavings, balance: newSavingsBalance } =
    recalculateSavingsTransactions([...(savingsAccount.transactions || []), newSavingsTransaction]);

  allSavings[savingsIndex] = {
    ...savingsAccount,
    balance: newSavingsBalance,
    transactions: recalculatedSavings,
  };
  StorageService.saveSavingsAccounts(allSavings);

  const checkingBalance =
    checkingTransactions.length > 0
      ? checkingTransactions[checkingTransactions.length - 1].balance
      : checkingStartingBalance;

  return {
    checkingTransactionId: checkingTxId,
    savingsTransactionId: savingsTxId,
    checkingBalance,
    savingsBalance: newSavingsBalance,
    skippedDuplicate: false,
  };
}

