import { CalculationService } from '../services/calculations';
import { StorageService } from '../services/storage';
import { recalculateCheckingBalances } from './savingsTransactions';
import type { CheckingTransaction, HELOCTransaction, HomeEquity } from '../types';

/** Canonical id stamped on checking↔HELOC links (HELOC is a single line of credit). */
export const HELOC_LINK_ACCOUNT_ID = 'heloc';

export function getHelocBaselineBalance(homeEquity?: HomeEquity | null): number {
  const equity = homeEquity ?? StorageService.getHomeEquity();
  if (equity?.hasHELOC && equity.helocBalance !== undefined) {
    return equity.helocBalance;
  }
  return 0;
}

/**
 * Live HELOC balance — same rule as HELOCTracker:
 * last ledger transaction balance if any txs exist, else homeEquity.helocBalance.
 */
export function getCurrentHelocBalance(
  transactions?: HELOCTransaction[],
  homeEquity?: HomeEquity | null
): number {
  const txs = transactions ?? StorageService.getHELOCTransactions();
  if (txs.length > 0) {
    return txs[txs.length - 1].balance;
  }
  return getHelocBaselineBalance(homeEquity);
}

export function getHelocCreditLimit(homeEquity?: HomeEquity | null): number {
  const equity = homeEquity ?? StorageService.getHomeEquity();
  if (equity?.hasHELOC && equity.helocLimit !== undefined) {
    return equity.helocLimit;
  }
  if (
    equity?.ownsHome &&
    equity.homeValue !== undefined &&
    equity.mortgageBalance !== undefined
  ) {
    return Math.max(0, equity.homeValue * 0.9 - equity.mortgageBalance);
  }
  return 0;
}

/** Recalculate running balances from the home-equity baseline (mutates in place). */
export function recalculateHelocBalances(
  transactions: HELOCTransaction[],
  homeEquity?: HomeEquity | null
): HELOCTransaction[] {
  let runningBalance = getHelocBaselineBalance(homeEquity);

  for (const transaction of transactions) {
    if (transaction.type === 'draw' || transaction.type === 'interest') {
      runningBalance += transaction.amount;
    } else if (transaction.type === 'payment') {
      runningBalance -= transaction.amount;
    }
    runningBalance = Math.max(0, runningBalance);
    transaction.balance = Math.round(runningBalance * 100) / 100;
  }

  return transactions;
}

function datesMatch(a: string, b: string): boolean {
  const na = CalculationService.normalizeDateString(a) || a.slice(0, 10);
  const nb = CalculationService.normalizeDateString(b) || b.slice(0, 10);
  return na === nb;
}

function sortHelocByDate(transactions: HELOCTransaction[]): HELOCTransaction[] {
  return [...transactions].sort((a, b) =>
    CalculationService.compareDateStrings(a.date, b.date)
  );
}

export interface RecordHelocTransferParams {
  checkingAccountId: string;
  checkingStartingBalance: number;
  amount: number;
  date: string;
  description?: string;
  sourceAccountName?: string;
  /** When set with linkExistingCheckingOnly, only create/link the HELOC side. */
  existingCheckingTransactionId?: string;
  linkExistingCheckingOnly?: boolean;
  /** When false, only write the checking side (legacy checkbox off). Default true. */
  recordInHelocLedger?: boolean;
}

export interface RecordHelocTransferResult {
  checkingTransactionId: string;
  helocTransactionId: string;
  checkingBalance: number;
  helocBalance: number;
  skippedDuplicate: boolean;
}

/** Idempotent guard for checking → HELOC payment (pay down). */
export function isHelocPaymentAlreadyLinked(
  checkingAccountId: string,
  checkingTransactionId: string | undefined,
  date: string,
  amount: number
): boolean {
  const helocTxs = StorageService.getHELOCTransactions();

  if (checkingTransactionId) {
    const checkingTx = StorageService.getCheckingTransactionsForAccount(checkingAccountId).find(
      (t) => t.id === checkingTransactionId
    );
    if (
      checkingTx?.linkedHelocTransactionId &&
      helocTxs.some((t) => t.id === checkingTx.linkedHelocTransactionId)
    ) {
      return true;
    }
    if (
      helocTxs.some(
        (t) =>
          t.type === 'payment' &&
          t.linkedCheckingTransactionId === checkingTransactionId
      )
    ) {
      return true;
    }
  }

  return helocTxs.some(
    (t) =>
      t.type === 'payment' &&
      Math.abs(t.amount - amount) < 0.02 &&
      datesMatch(t.date, date) &&
      !!t.linkedCheckingTransactionId
  );
}

/** Idempotent guard for HELOC → checking draw. */
export function isHelocDrawAlreadyLinked(
  checkingAccountId: string,
  checkingTransactionId: string | undefined,
  date: string,
  amount: number
): boolean {
  const helocTxs = StorageService.getHELOCTransactions();

  if (checkingTransactionId) {
    const checkingTx = StorageService.getCheckingTransactionsForAccount(checkingAccountId).find(
      (t) => t.id === checkingTransactionId
    );
    if (
      checkingTx?.linkedHelocTransactionId &&
      helocTxs.some((t) => t.id === checkingTx.linkedHelocTransactionId)
    ) {
      return true;
    }
    if (
      helocTxs.some(
        (t) =>
          t.type === 'draw' &&
          t.linkedCheckingTransactionId === checkingTransactionId
      )
    ) {
      return true;
    }
  }

  return helocTxs.some(
    (t) =>
      t.type === 'draw' &&
      Math.abs(t.amount - amount) < 0.02 &&
      datesMatch(t.date, date) &&
      !!t.linkedCheckingTransactionId
  );
}

/**
 * Dual-write checking → HELOC payment (pay down HELOC).
 * Checking: transfer_to_heloc. HELOC ledger: payment.
 */
export function recordHelocPayment(
  params: RecordHelocTransferParams
): RecordHelocTransferResult {
  const {
    checkingAccountId,
    checkingStartingBalance,
    amount,
    description,
    sourceAccountName,
    existingCheckingTransactionId,
    linkExistingCheckingOnly,
    recordInHelocLedger = true,
  } = params;

  if (!checkingAccountId) {
    throw new Error('No checking account selected. Please select a checking account and try again.');
  }
  if (!amount || amount <= 0) {
    throw new Error('Please enter a valid transfer amount.');
  }

  const transferDate = CalculationService.normalizeDateString(params.date);
  if (!transferDate) {
    throw new Error('Please select a valid date.');
  }

  const checkingTxsPreview =
    StorageService.getCheckingTransactionsForAccount(checkingAccountId);
  const currentCheckingBalance =
    checkingTxsPreview.length > 0
      ? checkingTxsPreview[checkingTxsPreview.length - 1].balance
      : checkingStartingBalance;

  if (!linkExistingCheckingOnly && amount > currentCheckingBalance + 0.001) {
    throw new Error('Transfer amount cannot exceed current checking balance.');
  }

  if (
    recordInHelocLedger &&
    isHelocPaymentAlreadyLinked(
      checkingAccountId,
      existingCheckingTransactionId,
      transferDate,
      amount
    )
  ) {
    return {
      checkingTransactionId: existingCheckingTransactionId || '',
      helocTransactionId: '',
      checkingBalance: currentCheckingBalance,
      helocBalance: getCurrentHelocBalance(),
      skippedDuplicate: true,
    };
  }

  const helocTxId = recordInHelocLedger
    ? `heloc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    : '';
  const checkingTxId =
    existingCheckingTransactionId ||
    `checking_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const checkingDescription =
    description?.trim() || 'Transfer to HELOC';
  const helocDescription =
    description?.trim() ||
    `Payment from ${sourceAccountName || 'checking account'}`;

  let checkingTransactions =
    StorageService.getCheckingTransactionsForAccount(checkingAccountId);

  if (linkExistingCheckingOnly && existingCheckingTransactionId) {
    const idx = checkingTransactions.findIndex((t) => t.id === existingCheckingTransactionId);
    if (idx === -1) {
      throw new Error('Imported checking transaction could not be found to link.');
    }
    checkingTransactions[idx] = {
      ...checkingTransactions[idx],
      type: 'transfer_to_heloc',
      description: checkingTransactions[idx].description || checkingDescription,
      linkedHelocTransactionId: helocTxId || undefined,
      linkedHelocAccountId: HELOC_LINK_ACCOUNT_ID,
      isTransferToHeloc: true,
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
      type: 'transfer_to_heloc',
      amount,
      description: checkingDescription,
      balance: 0,
      isReconciled: false,
      linkedHelocTransactionId: helocTxId || undefined,
      linkedHelocAccountId: HELOC_LINK_ACCOUNT_ID,
      isTransferToHeloc: true,
    };
    checkingTransactions = recalculateCheckingBalances(
      [...checkingTransactions, newCheckingTx],
      checkingStartingBalance
    );
    StorageService.saveCheckingTransactionsForAccount(checkingAccountId, checkingTransactions);
  }

  if (recordInHelocLedger && helocTxId) {
    const homeEquity = StorageService.getHomeEquity();
    const helocTransactions = sortHelocByDate([
      ...StorageService.getHELOCTransactions(),
      {
        id: helocTxId,
        date: transferDate,
        type: 'payment',
        amount,
        description: helocDescription,
        balance: 0,
        linkedCheckingTransactionId: checkingTxId,
        isTransferFromChecking: true,
      },
    ]);
    recalculateHelocBalances(helocTransactions, homeEquity);
    StorageService.saveHELOCTransactions(helocTransactions);
  }

  const checkingBalance =
    checkingTransactions.length > 0
      ? checkingTransactions[checkingTransactions.length - 1].balance
      : checkingStartingBalance;

  return {
    checkingTransactionId: checkingTxId,
    helocTransactionId: helocTxId,
    checkingBalance,
    helocBalance: getCurrentHelocBalance(),
    skippedDuplicate: false,
  };
}

/**
 * Dual-write HELOC → checking draw (borrow / deposit into checking).
 * Checking: transfer_from_heloc. HELOC ledger: draw.
 */
export function recordHelocDraw(
  params: RecordHelocTransferParams
): RecordHelocTransferResult {
  const {
    checkingAccountId,
    checkingStartingBalance,
    amount,
    description,
    sourceAccountName,
    existingCheckingTransactionId,
    linkExistingCheckingOnly,
    recordInHelocLedger = true,
  } = params;

  if (!checkingAccountId) {
    throw new Error('No checking account selected. Please select a checking account and try again.');
  }
  if (!amount || amount <= 0) {
    throw new Error('Please enter a valid draw amount.');
  }

  const transferDate = CalculationService.normalizeDateString(params.date);
  if (!transferDate) {
    throw new Error('Please select a valid date.');
  }

  const homeEquity = StorageService.getHomeEquity();
  const currentHeloc = getCurrentHelocBalance(undefined, homeEquity);
  const limit = getHelocCreditLimit(homeEquity);
  const available = Math.max(0, limit - currentHeloc);
  if (recordInHelocLedger && amount > available + 0.001) {
    throw new Error(
      `Draw amount cannot exceed available HELOC credit (${CalculationService.formatCurrency(available)}).`
    );
  }

  const checkingTxsPreview =
    StorageService.getCheckingTransactionsForAccount(checkingAccountId);
  const currentCheckingBalance =
    checkingTxsPreview.length > 0
      ? checkingTxsPreview[checkingTxsPreview.length - 1].balance
      : checkingStartingBalance;

  if (
    recordInHelocLedger &&
    isHelocDrawAlreadyLinked(
      checkingAccountId,
      existingCheckingTransactionId,
      transferDate,
      amount
    )
  ) {
    return {
      checkingTransactionId: existingCheckingTransactionId || '',
      helocTransactionId: '',
      checkingBalance: currentCheckingBalance,
      helocBalance: currentHeloc,
      skippedDuplicate: true,
    };
  }

  const helocTxId = recordInHelocLedger
    ? `heloc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    : '';
  const checkingTxId =
    existingCheckingTransactionId ||
    `checking_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const checkingDescription =
    description?.trim() || 'Transfer from HELOC';
  const helocDescription =
    description?.trim() ||
    `Draw to ${sourceAccountName || 'checking account'}`;

  let checkingTransactions =
    StorageService.getCheckingTransactionsForAccount(checkingAccountId);

  if (linkExistingCheckingOnly && existingCheckingTransactionId) {
    const idx = checkingTransactions.findIndex((t) => t.id === existingCheckingTransactionId);
    if (idx === -1) {
      throw new Error('Imported checking transaction could not be found to link.');
    }
    checkingTransactions[idx] = {
      ...checkingTransactions[idx],
      type: 'transfer_from_heloc',
      description: checkingTransactions[idx].description || checkingDescription,
      linkedHelocTransactionId: helocTxId || undefined,
      linkedHelocAccountId: HELOC_LINK_ACCOUNT_ID,
      isTransferFromHeloc: true,
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
      type: 'transfer_from_heloc',
      amount,
      description: checkingDescription,
      balance: 0,
      isReconciled: false,
      linkedHelocTransactionId: helocTxId || undefined,
      linkedHelocAccountId: HELOC_LINK_ACCOUNT_ID,
      isTransferFromHeloc: true,
    };
    checkingTransactions = recalculateCheckingBalances(
      [...checkingTransactions, newCheckingTx],
      checkingStartingBalance
    );
    StorageService.saveCheckingTransactionsForAccount(checkingAccountId, checkingTransactions);
  }

  if (recordInHelocLedger && helocTxId) {
    const helocTransactions = sortHelocByDate([
      ...StorageService.getHELOCTransactions(),
      {
        id: helocTxId,
        date: transferDate,
        type: 'draw',
        amount,
        description: helocDescription,
        balance: 0,
        linkedCheckingTransactionId: checkingTxId,
        isTransferToChecking: true,
      },
    ]);
    recalculateHelocBalances(helocTransactions, homeEquity);
    StorageService.saveHELOCTransactions(helocTransactions);
  }

  const checkingBalance =
    checkingTransactions.length > 0
      ? checkingTransactions[checkingTransactions.length - 1].balance
      : checkingStartingBalance;

  return {
    checkingTransactionId: checkingTxId,
    helocTransactionId: helocTxId,
    checkingBalance,
    helocBalance: getCurrentHelocBalance(),
    skippedDuplicate: false,
  };
}

/** Remove a HELOC ledger row by id and recalculate running balances. Throws if not found. */
export function removeHelocTransaction(helocTransactionId: string): void {
  const existing = StorageService.getHELOCTransactions();
  const filtered = existing.filter((t) => t.id !== helocTransactionId);
  if (filtered.length === existing.length) {
    throw new Error(
      `Linked HELOC transaction ${helocTransactionId} was not found in the HELOC ledger.`
    );
  }
  recalculateHelocBalances(filtered);
  StorageService.saveHELOCTransactions(filtered);
}

export function findHelocTransactionFallback(
  checkingTransaction: CheckingTransaction,
  expectedType: 'payment' | 'draw'
): HELOCTransaction | null {
  const matches = StorageService.getHELOCTransactions().filter(
    (t) =>
      t.type === expectedType &&
      Math.abs(t.amount - checkingTransaction.amount) < 0.02 &&
      datesMatch(t.date, checkingTransaction.date)
  );
  if (matches.length === 1) return matches[0];
  if (checkingTransaction.id) {
    const byLink = matches.find((t) => t.linkedCheckingTransactionId === checkingTransaction.id);
    if (byLink) return byLink;
  }
  return null;
}
