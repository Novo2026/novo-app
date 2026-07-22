import { CalculationService } from '../services/calculations';
import { StorageService } from '../services/storage';
import {
  findHelocTransactionFallback,
  removeHelocTransaction,
} from './helocTransactions';
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
  'transfer_to_heloc',
  'transfer_from_heloc',
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
  heloc: string;
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
    heloc: JSON.stringify(StorageService.getHELOCTransactions()),
  };
}

function restoreSnapshot(snapshot: StorageSnapshot): void {
  for (const [accountId, data] of Object.entries(snapshot.checking)) {
    StorageService.saveCheckingTransactionsForAccount(accountId, JSON.parse(data));
  }
  StorageService.saveSavingsAccounts(JSON.parse(snapshot.savings));
  StorageService.saveDebts(JSON.parse(snapshot.debts));
  StorageService.saveUnifiedPayments(JSON.parse(snapshot.unifiedPayments));
  StorageService.saveHELOCTransactions(JSON.parse(snapshot.heloc));
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
  const beforeCount = account.transactions.length;
  const remaining = account.transactions.filter((t) => t.id !== transactionId);
  if (remaining.length === beforeCount) {
    throw new Error(
      `Linked savings transaction ${transactionId} was not found in the savings account.`
    );
  }
  const { transactions, balance } = recalculateSavingsTransactions(remaining);
  accounts[accountIndex] = { ...account, transactions, balance };
  StorageService.saveSavingsAccounts(accounts);
}

function datesMatchForLink(a: string, b: string): boolean {
  const na = CalculationService.normalizeDateString(a) || a.slice(0, 10);
  const nb = CalculationService.normalizeDateString(b) || b.slice(0, 10);
  return na === nb;
}

function savingsAccountHasTransaction(savingsAccountId: string, transactionId: string): boolean {
  const account = StorageService.getSavingsAccounts().find((a) => a.id === savingsAccountId);
  return !!account?.transactions.some((t) => t.id === transactionId);
}

/** Fallback when linkedSavingsTransactionId is missing or stale: match amount + date + type. */
function findSavingsTransferFallback(
  checkingTx: CheckingTransaction,
  preferredSavingsAccountId?: string,
  allowBroaden = true
): { accountId: string; savingsTxId: string } | null {
  const accounts = StorageService.getSavingsAccounts();
  const searchAccounts = preferredSavingsAccountId
    ? accounts.filter((a) => a.id === preferredSavingsAccountId)
    : accounts;

  for (const account of searchAccounts) {
    const matches = (account.transactions || []).filter(
      (t) =>
        t.type === 'transfer_from_checking' &&
        Math.abs(t.amount - checkingTx.amount) < 0.02 &&
        datesMatchForLink(t.date, checkingTx.date)
    );

    if (matches.length === 0) continue;

    const linkedExactly = matches.find((t) => t.linkedCheckingTransactionId === checkingTx.id);
    if (linkedExactly) {
      return { accountId: account.id, savingsTxId: linkedExactly.id };
    }

    if (matches.length === 1) {
      return { accountId: account.id, savingsTxId: matches[0].id };
    }
  }

  // If preferred account had nothing, broaden to all accounts (import may have wrong account id).
  if (preferredSavingsAccountId && allowBroaden) {
    return findSavingsTransferFallback(checkingTx, undefined, false);
  }

  return null;
}

function findUnifiedPaymentForDebtTransaction(transaction: CheckingTransaction) {
  const payments = StorageService.getUnifiedPayments();
  const txDate = CalculationService.normalizeDateString(transaction.date);

  const matches = payments.filter((p) => {
    if (p.source !== 'checking') return false;
    if (transaction.debtId && p.debtId !== transaction.debtId) return false;
    if (Math.abs(p.amount - transaction.amount) > 0.02) return false;
    return CalculationService.normalizeDateString(p.date) === txDate;
  });

  if (matches.length === 0) {
    return null;
  }

  return matches[matches.length - 1];
}

/** Looser unified-payment match when exact debtId/amount/date lookup fails. */
function findUnifiedPaymentFallback(transaction: CheckingTransaction) {
  const payments = StorageService.getUnifiedPayments();
  const txDate = CalculationService.normalizeDateString(transaction.date);

  const matches = payments.filter((p) => {
    if (p.source !== 'checking') return false;
    if (Math.abs(p.amount - transaction.amount) > 0.02) return false;
    if (CalculationService.normalizeDateString(p.date) !== txDate) return false;
    if (transaction.debtId && p.debtId === transaction.debtId) return true;
    if (
      transaction.debtName &&
      p.debtName?.toLowerCase() === transaction.debtName.toLowerCase()
    ) {
      return true;
    }
    // Last resort: same day/amount checking payment with no conflicting debtId on the checking tx.
    return !transaction.debtId;
  });

  if (matches.length === 0) return null;
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
    'Could not find the linked debt to reverse. The checking transaction was NOT deleted — please check My Debts manually or contact support.'
  );
}

function reverseDebtPayment(transaction: CheckingTransaction): void {
  console.log('[NOVO delete] reverseDebtPayment links', {
    checkingTransactionId: transaction.id,
    debtId: transaction.debtId,
    debtName: transaction.debtName,
    amount: transaction.amount,
    date: transaction.date,
  });

  const { debts, debt, debtIndex } = resolveDebtForTransaction(transaction);

  let unifiedPayment = findUnifiedPaymentForDebtTransaction(transaction);
  if (!unifiedPayment) {
    const fallback = findUnifiedPaymentFallback(transaction);
    if (fallback) {
      console.warn(
        '[NOVO delete] Exact unified payment lookup failed; removed payment history via amount+date fallback',
        {
          checkingTransactionId: transaction.id,
          fallbackPaymentId: fallback.id,
          debtId: fallback.debtId,
        }
      );
      unifiedPayment = fallback;
    }
  }

  if (!unifiedPayment) {
    throw new Error(
      'Could not find the linked payment history entry to remove. The checking transaction was NOT deleted — please check My Debts / Payment History manually or contact support.'
    );
  }

  const balanceToRestore = unifiedPayment.balanceReductionAmount ?? transaction.amount;
  const newBalance = Math.round((debt.currentBalance + balanceToRestore) * 100) / 100;

  debts[debtIndex] = {
    ...debt,
    currentBalance: newBalance,
    isPaidOff: newBalance > 0 ? false : debt.isPaidOff,
    paidOffDate: newBalance > 0 ? undefined : debt.paidOffDate,
  };
  StorageService.saveDebts(debts);

  const payments = StorageService.getUnifiedPayments().filter((p) => p.id !== unifiedPayment!.id);
  StorageService.saveUnifiedPayments(payments);
}

function reverseTransferToSavings(transaction: CheckingTransaction): void {
  console.log('[NOVO delete] reverseTransferToSavings links', {
    checkingTransactionId: transaction.id,
    linkedSavingsTransactionId: transaction.linkedSavingsTransactionId,
    linkedSavingsAccountId: transaction.linkedSavingsAccountId,
    amount: transaction.amount,
    date: transaction.date,
  });

  const orphanBlockMessage =
    'Could not find the linked savings entry to remove. The checking transaction was NOT deleted — please check Joint Savings manually or contact support.';

  const savingsTxId = transaction.linkedSavingsTransactionId;
  const savingsAccountId = transaction.linkedSavingsAccountId;

  // Prefer exact ID match when both link fields are present and valid.
  if (savingsTxId) {
    try {
      if (savingsAccountId && savingsAccountHasTransaction(savingsAccountId, savingsTxId)) {
        removeSavingsTransaction(savingsAccountId, savingsTxId);
        return;
      }

      const located = findSavingsAccountWithTransaction(savingsTxId);
      if (located) {
        if (savingsAccountId && located.account.id !== savingsAccountId) {
          console.warn(
            '[NOVO delete] linkedSavingsAccountId did not match located account; removing by transaction id',
            {
              linkedSavingsAccountId: savingsAccountId,
              locatedAccountId: located.account.id,
              savingsTxId,
            }
          );
        }
        removeSavingsTransaction(located.account.id, savingsTxId);
        return;
      }
    } catch (err) {
      // Fall through to amount+date fallback rather than blocking immediately.
      console.warn('[NOVO delete] ID-based savings removal failed; trying fallback', err);
    }
  }

  const fallback = findSavingsTransferFallback(transaction, savingsAccountId);
  if (fallback) {
    console.warn(
      '[NOVO delete] linkedSavingsTransactionId lookup failed; removed savings entry via amount+date fallback',
      {
        expectedId: savingsTxId ?? null,
        fallbackId: fallback.savingsTxId,
        savingsAccountId: fallback.accountId,
        checkingTransactionId: transaction.id,
      }
    );
    removeSavingsTransaction(fallback.accountId, fallback.savingsTxId);
    return;
  }

  throw new Error(orphanBlockMessage);
}

function reverseHelocLinkedTransfer(
  transaction: CheckingTransaction,
  expectedHelocType: 'payment' | 'draw'
): void {
  console.log('[NOVO delete] reverseHelocLinkedTransfer links', {
    checkingTransactionId: transaction.id,
    linkedHelocTransactionId: transaction.linkedHelocTransactionId,
    linkedHelocAccountId: transaction.linkedHelocAccountId,
    expectedHelocType,
    amount: transaction.amount,
    date: transaction.date,
  });

  const orphanBlockMessage =
    'Could not find the linked HELOC entry to remove. The checking transaction was NOT deleted — please check the HELOC Tracker manually or contact support.';

  const helocTxId = transaction.linkedHelocTransactionId;

  if (helocTxId) {
    try {
      const exists = StorageService.getHELOCTransactions().some((t) => t.id === helocTxId);
      if (exists) {
        removeHelocTransaction(helocTxId);
        return;
      }
    } catch (err) {
      console.warn('[NOVO delete] ID-based HELOC removal failed; trying fallback', err);
    }
  }

  const fallback = findHelocTransactionFallback(transaction, expectedHelocType);
  if (fallback) {
    console.warn(
      '[NOVO delete] linkedHelocTransactionId lookup failed; removed HELOC entry via amount+date fallback',
      {
        expectedId: helocTxId ?? null,
        fallbackId: fallback.id,
        checkingTransactionId: transaction.id,
      }
    );
    removeHelocTransaction(fallback.id);
    return;
  }

  // Checking-only transfer (user unchecked "record in HELOC Tracker") — allow delete.
  if (!helocTxId) {
    console.warn(
      '[NOVO delete] No HELOC ledger link on checking transfer; deleting checking side only',
      { checkingTransactionId: transaction.id, expectedHelocType }
    );
    return;
  }

  throw new Error(orphanBlockMessage);
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
    case 'transfer_to_heloc':
      return `Deleting this transfer will also remove the ${amount} payment from your HELOC ledger. This cannot be undone. Are you sure?`;
    case 'transfer_from_heloc':
      return `Deleting this deposit will also remove the ${amount} draw from your HELOC ledger. This cannot be undone. Are you sure?`;
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
      case 'transfer_to_heloc':
        reverseHelocLinkedTransfer(transaction, 'payment');
        break;
      case 'transfer_from_heloc':
        reverseHelocLinkedTransfer(transaction, 'draw');
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
      case 'transfer_to_heloc':
      case 'transfer_from_heloc':
        return { message: '✓ Transfer deleted from checking and HELOC.' };
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
