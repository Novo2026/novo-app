import { CalculationService } from '../services/calculations';
import { StorageService } from '../services/storage';
import {
  recalculateCheckingBalances,
  recalculateSavingsTransactions,
} from './savingsTransactions';
import type { CheckingTransaction, SavingsAccount, SavingsTransaction } from '../types';

const LINKED_CHECKING_TYPES = new Set<CheckingTransaction['type']>([
  'debt_payment',
  'transfer_to_savings',
  'transfer_to_checking',
  'transfer_from_checking',
  'transfer_from_savings',
]);

const LINKED_SAVINGS_TYPES = new Set<SavingsTransaction['type']>([
  'transfer_to_checking',
  'transfer_from_checking',
]);

interface StorageSnapshot {
  checking: Record<string, string>;
  savings: string;
  debts: string;
  unifiedPayments: string;
}

function snapshotStorage(accountIds: string[]): StorageSnapshot {
  const checking: Record<string, string> = {};
  for (const accountId of accountIds) {
    checking[accountId] = JSON.stringify(
      StorageService.getCheckingTransactionsForAccount(accountId)
    );
  }
  return {
    checking,
    savings: JSON.stringify(StorageService.getSavingsAccounts()),
    debts: JSON.stringify(StorageService.getDebts()),
    unifiedPayments: JSON.stringify(StorageService.getUnifiedPayments()),
  };
}

function restoreSnapshot(snapshot: StorageSnapshot): void {
  for (const [accountId, data] of Object.entries(snapshot.checking)) {
    StorageService.saveCheckingTransactionsForAccount(accountId, JSON.parse(data));
  }
  StorageService.saveSavingsAccounts(JSON.parse(snapshot.savings));
  StorageService.saveDebts(JSON.parse(snapshot.debts));
  StorageService.saveUnifiedPayments(JSON.parse(snapshot.unifiedPayments));
}

function findCheckingAccountIdForTransaction(transactionId: string): string | null {
  for (const account of StorageService.getCheckingAccounts()) {
    const transactions = StorageService.getCheckingTransactionsForAccount(account.id);
    if (transactions.some((t) => t.id === transactionId)) {
      return account.id;
    }
  }
  return null;
}

function findSavingsAccountWithTransaction(
  transactionId: string
): { account: SavingsAccount; accountIndex: number } | null {
  const accounts = StorageService.getSavingsAccounts();
  for (let i = 0; i < accounts.length; i++) {
    if (accounts[i].transactions.some((t) => t.id === transactionId)) {
      return { account: accounts[i], accountIndex: i };
    }
  }
  return null;
}

function removeCheckingTransaction(
  accountId: string,
  transactionId: string
): void {
  const account = StorageService.getCheckingAccounts().find((a) => a.id === accountId);
  const startingBalance = account?.startingBalance ?? 0;
  const filtered = StorageService.getCheckingTransactionsForAccount(accountId).filter(
    (t) => t.id !== transactionId
  );
  const recalculated = recalculateCheckingBalances(filtered, startingBalance);
  StorageService.saveCheckingTransactionsForAccount(accountId, recalculated);
}

function removeSavingsTransaction(savingsAccountId: string, transactionId: string): void {
  const accounts = StorageService.getSavingsAccounts();
  const accountIndex = accounts.findIndex((a) => a.id === savingsAccountId);
  if (accountIndex === -1) {
    throw new Error('Linked savings account could not be found.');
  }

  const account = accounts[accountIndex];
  const remaining = account.transactions.filter((t) => t.id !== transactionId);
  const { transactions, balance } = recalculateSavingsTransactions(remaining);
  accounts[accountIndex] = { ...account, transactions, balance };
  StorageService.saveSavingsAccounts(accounts);
}

function findUnifiedPaymentForDebtTransaction(transaction: CheckingTransaction) {
  const payments = StorageService.getUnifiedPayments();
  const txDate = CalculationService.normalizeDateString(transaction.date);

  const matches = payments.filter((p) => {
    if (p.source !== 'checking') return false;
    if (transaction.debtId && p.debtId !== transaction.debtId) return false;
    if (p.amount !== transaction.amount) return false;
    return CalculationService.normalizeDateString(p.date) === txDate;
  });

  if (matches.length === 0) {
    return null;
  }

  return matches[matches.length - 1];
}

function parseDebtNameFromDescription(description?: string): string | null {
  if (!description) return null;

  const mortgageMatch = description.match(/^Mortgage Payment\s*[—-]\s*(.+?)\s*\(P&I:/i);
  if (mortgageMatch?.[1]) {
    return mortgageMatch[1].trim();
  }

  const legacyMatch = description.replace(/^Payment\s*[—-]\s*/i, '').trim();
  return legacyMatch || null;
}

function resolveDebtForTransaction(transaction: CheckingTransaction) {
  const debts = StorageService.getDebts();
  if (transaction.debtId) {
    const debt = debts.find((d) => d.id === transaction.debtId);
    if (debt) return { debts, debt, debtIndex: debts.indexOf(debt) };
  }

  const parsedName = parseDebtNameFromDescription(transaction.description);
  if (parsedName) {
    const debt = debts.find(
      (d) => d.accountName.toLowerCase() === parsedName.toLowerCase()
    );
    if (debt) return { debts, debt, debtIndex: debts.indexOf(debt) };
  }

  if (transaction.debtName) {
    const debt = debts.find(
      (d) => d.accountName.toLowerCase() === transaction.debtName!.toLowerCase()
    );
    if (debt) return { debts, debt, debtIndex: debts.indexOf(debt) };
  }

  throw new Error(
    `Could not find debt record for ${transaction.debtName || transaction.description || 'this payment'}.`
  );
}

function reverseDebtPayment(transaction: CheckingTransaction): void {
  const { debts, debt, debtIndex } = resolveDebtForTransaction(transaction);
  const unifiedPayment = findUnifiedPaymentForDebtTransaction(transaction);
  const balanceToRestore =
    unifiedPayment?.balanceReductionAmount ?? transaction.amount;
  const newBalance = Math.round((debt.currentBalance + balanceToRestore) * 100) / 100;

  debts[debtIndex] = {
    ...debt,
    currentBalance: newBalance,
    isPaidOff: newBalance > 0 ? false : debt.isPaidOff,
    paidOffDate: newBalance > 0 ? undefined : debt.paidOffDate,
  };
  StorageService.saveDebts(debts);

  if (unifiedPayment) {
    const payments = StorageService.getUnifiedPayments().filter((p) => p.id !== unifiedPayment.id);
    StorageService.saveUnifiedPayments(payments);
  }
}

function reverseTransferToSavings(transaction: CheckingTransaction): void {
  const savingsTxId = transaction.linkedSavingsTransactionId;
  if (!savingsTxId) {
    throw new Error('Linked savings transaction could not be found for this transfer.');
  }

  if (transaction.linkedSavingsAccountId) {
    removeSavingsTransaction(transaction.linkedSavingsAccountId, savingsTxId);
    return;
  }

  const located = findSavingsAccountWithTransaction(savingsTxId);
  if (!located) {
    throw new Error('Linked savings transaction could not be found for this transfer.');
  }
  removeSavingsTransaction(located.account.id, savingsTxId);
}

function reverseLinkedCheckingTransaction(
  linkedTransactionId: string,
  expectedType?: CheckingTransaction['type']
): void {
  const linkedAccountId = findCheckingAccountIdForTransaction(linkedTransactionId);
  if (!linkedAccountId) {
    throw new Error('Linked checking transaction could not be found.');
  }

  const linkedTransactions = StorageService.getCheckingTransactionsForAccount(linkedAccountId);
  const linkedTransaction = linkedTransactions.find((t) => t.id === linkedTransactionId);
  if (!linkedTransaction) {
    throw new Error('Linked checking transaction could not be found.');
  }
  if (expectedType && linkedTransaction.type !== expectedType) {
    throw new Error('Linked checking transaction type does not match this transfer.');
  }

  removeCheckingTransaction(linkedAccountId, linkedTransactionId);
}

export function isLinkedCheckingDeleteType(type: CheckingTransaction['type']): boolean {
  return LINKED_CHECKING_TYPES.has(type);
}

export function isLinkedSavingsDeleteType(type: SavingsTransaction['type']): boolean {
  return LINKED_SAVINGS_TYPES.has(type);
}

export function getCheckingDeleteConfirmationMessage(transaction: CheckingTransaction): string {
  const amount = CalculationService.formatCurrency(transaction.amount);

  switch (transaction.type) {
    case 'debt_payment':
      return `Deleting this payment will also reverse the ${amount} payment on ${transaction.debtName || 'this debt'}. This cannot be undone. Are you sure?`;
    case 'transfer_to_savings':
      return `Deleting this transfer will also remove the ${amount} deposit from the linked savings account. This cannot be undone. Are you sure?`;
    case 'transfer_to_checking':
      return `Deleting this transfer will also remove the ${amount} deposit from the receiving checking account. This cannot be undone. Are you sure?`;
    case 'transfer_from_checking':
      return `Deleting this transfer will also remove the ${amount} withdrawal from the source checking account. This cannot be undone. Are you sure?`;
    case 'transfer_from_savings':
      return `Deleting this deposit will also remove the ${amount} withdrawal from the linked savings account. This cannot be undone. Are you sure?`;
    default:
      return 'Delete this transaction? All balances will be recalculated from this point forward.';
  }
}

export function getSavingsDeleteConfirmationMessage(
  transaction: SavingsTransaction
): string {
  const amount = CalculationService.formatCurrency(transaction.amount);

  if (transaction.type === 'transfer_to_checking') {
    return `Deleting this withdrawal will also remove the ${amount} deposit in the linked checking account. This cannot be undone. Are you sure?`;
  }
  if (transaction.type === 'transfer_from_checking') {
    return `Deleting this deposit will also remove the ${amount} transfer from the linked checking account. This cannot be undone. Are you sure?`;
  }

  return 'Delete this transaction? Balances will be recalculated.';
}

export function deleteCheckingTransactionWithLinkedReversal(
  accountId: string,
  transactionId: string
): { message: string } {
  if (!accountId) {
    throw new Error('No checking account selected.');
  }

  const transactions = StorageService.getCheckingTransactionsForAccount(accountId);
  const transaction = transactions.find((t) => t.id === transactionId);
  if (!transaction) {
    throw new Error('Transaction could not be found.');
  }

  const relatedAccountIds = new Set<string>([accountId]);
  if (transaction.linkedCheckingTransactionId) {
    const linkedAccountId = findCheckingAccountIdForTransaction(
      transaction.linkedCheckingTransactionId
    );
    if (linkedAccountId) {
      relatedAccountIds.add(linkedAccountId);
    }
  }

  const snapshot = snapshotStorage([...relatedAccountIds]);

  try {
    switch (transaction.type) {
      case 'debt_payment':
        reverseDebtPayment(transaction);
        break;
      case 'transfer_to_savings':
        reverseTransferToSavings(transaction);
        break;
      case 'transfer_to_checking':
        if (!transaction.linkedCheckingTransactionId) {
          throw new Error('Linked receiving checking transaction could not be found.');
        }
        reverseLinkedCheckingTransaction(
          transaction.linkedCheckingTransactionId,
          'transfer_from_checking'
        );
        break;
      case 'transfer_from_checking':
        if (!transaction.linkedCheckingTransactionId) {
          throw new Error('Linked source checking transaction could not be found.');
        }
        reverseLinkedCheckingTransaction(
          transaction.linkedCheckingTransactionId,
          'transfer_to_checking'
        );
        break;
      case 'transfer_from_savings':
        if (!transaction.linkedSavingsTransactionId) {
          throw new Error('Linked savings transaction could not be found.');
        }
        if (transaction.linkedSavingsAccountId) {
          removeSavingsTransaction(
            transaction.linkedSavingsAccountId,
            transaction.linkedSavingsTransactionId
          );
        } else {
          const located = findSavingsAccountWithTransaction(
            transaction.linkedSavingsTransactionId
          );
          if (!located) {
            throw new Error('Linked savings transaction could not be found.');
          }
          removeSavingsTransaction(located.account.id, transaction.linkedSavingsTransactionId);
        }
        break;
      default:
        break;
    }

    removeCheckingTransaction(accountId, transactionId);

    switch (transaction.type) {
      case 'debt_payment':
        return {
          message: `✓ Payment deleted and ${CalculationService.formatCurrency(transaction.amount)} reversed on ${transaction.debtName || 'debt'}.`,
        };
      case 'transfer_to_savings':
        return { message: '✓ Transfer deleted from checking and savings.' };
      case 'transfer_to_checking':
      case 'transfer_from_checking':
        return { message: '✓ Transfer deleted from both checking accounts.' };
      case 'transfer_from_savings':
        return { message: '✓ Transfer deleted from checking and savings.' };
      default:
        return { message: '✓ Transaction deleted. Balances updated.' };
    }
  } catch (error) {
    restoreSnapshot(snapshot);
    throw error;
  }
}

export function deleteSavingsTransactionWithLinkedReversal(
  savingsAccountId: string,
  transactionId: string
): { message: string } {
  const accounts = StorageService.getSavingsAccounts();
  const accountIndex = accounts.findIndex((a) => a.id === savingsAccountId);
  if (accountIndex === -1) {
    throw new Error('Savings account could not be found.');
  }

  const account = accounts[accountIndex];
  const transaction = account.transactions.find((t) => t.id === transactionId);
  if (!transaction) {
    throw new Error('Transaction could not be found.');
  }

  const relatedAccountIds = new Set<string>();
  if (transaction.linkedCheckingAccountId) {
    relatedAccountIds.add(transaction.linkedCheckingAccountId);
  } else if (transaction.linkedCheckingTransactionId) {
    const linkedAccountId = findCheckingAccountIdForTransaction(
      transaction.linkedCheckingTransactionId
    );
    if (linkedAccountId) {
      relatedAccountIds.add(linkedAccountId);
    }
  }

  const snapshot = snapshotStorage([...relatedAccountIds]);

  try {
    if (transaction.type === 'transfer_to_checking') {
      if (!transaction.linkedCheckingTransactionId || !transaction.linkedCheckingAccountId) {
        throw new Error('Linked checking transaction could not be found.');
      }
      removeCheckingTransaction(
        transaction.linkedCheckingAccountId,
        transaction.linkedCheckingTransactionId
      );
    } else if (transaction.type === 'transfer_from_checking') {
      if (!transaction.linkedCheckingTransactionId || !transaction.linkedCheckingAccountId) {
        throw new Error('Linked checking transaction could not be found.');
      }
      removeCheckingTransaction(
        transaction.linkedCheckingAccountId,
        transaction.linkedCheckingTransactionId
      );
    }

    removeSavingsTransaction(savingsAccountId, transactionId);

    if (transaction.type === 'transfer_to_checking') {
      return { message: '✓ Withdrawal deleted from savings and checking.' };
    }
    if (transaction.type === 'transfer_from_checking') {
      return { message: '✓ Deposit deleted from savings and checking.' };
    }

    return { message: '✓ Transaction deleted. Balances updated.' };
  } catch (error) {
    restoreSnapshot(snapshot);
    throw error;
  }
}

export function deleteSimpleCheckingTransaction(
  accountId: string,
  transactionId: string
): void {
  removeCheckingTransaction(accountId, transactionId);
}
