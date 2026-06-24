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
    if (
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
