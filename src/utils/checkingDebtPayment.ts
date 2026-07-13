import { CalculationService } from '../services/calculations';
import { StorageService } from '../services/storage';
import type { CheckingTransaction, MortgagePaymentBreakdown, UnifiedPayment } from '../types';

export type { MortgagePaymentBreakdown };

export interface RecordDebtPaymentParams {
  accountId: string;
  startingBalance: number;
  debtId: string;
  /** Total cash outflow (checking debit). */
  amount: number;
  date: string;
  description?: string;
  editCheckingTransactionId?: string;
  editUnifiedPaymentId?: string;
  /** Amount applied to debt balance. Defaults to `amount` for non-mortgage payments. */
  balanceReductionAmount?: number;
  mortgageBreakdown?: MortgagePaymentBreakdown;
}

export interface RecordDebtPaymentResult {
  checkingTransactions: CheckingTransaction[];
  updatedBalance: number;
  unifiedPaymentId: string;
}

export function calculateMortgageTotalPayment(breakdown: MortgagePaymentBreakdown): number {
  return (
    breakdown.piPayment +
    breakdown.additionalPrincipal +
    breakdown.escrow +
    breakdown.pmi
  );
}

export function calculateMortgageBalanceReduction(breakdown: MortgagePaymentBreakdown): number {
  return breakdown.piPayment + breakdown.additionalPrincipal;
}

export function formatMortgagePaymentDescription(
  lenderName: string,
  piPayment: number,
  escrow: number
): string {
  return `Mortgage Payment — ${lenderName} (P&I: ${CalculationService.formatCurrency(piPayment)} | Escrow: ${CalculationService.formatCurrency(escrow)})`;
}

function buildCheckingDebtPaymentTransaction({
  id,
  accountId,
  date,
  amount,
  description,
  debtId,
  debtName,
  isReconciled,
  reconciledAt,
}: {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  description: string;
  debtId: string;
  debtName: string;
  isReconciled?: boolean;
  reconciledAt?: string;
}): CheckingTransaction {
  return {
    id,
    accountId,
    date,
    type: 'debt_payment',
    amount,
    description,
    balance: 0,
    category: 'Debt Payment',
    isReconciled: isReconciled ?? false,
    reconciledAt,
    debtId,
    debtName,
  };
}

function recalculateCheckingBalances(
  transactions: CheckingTransaction[],
  startingBalance: number
): CheckingTransaction[] {
  let runningBalance = startingBalance;
  const sorted = [...transactions].sort((a, b) =>
    CalculationService.compareDateStrings(a.date, b.date)
  );

  return sorted.map((transaction) => {
    if (transaction.type === 'balance_adjustment') {
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

export function recordDebtPaymentFromChecking(
  params: RecordDebtPaymentParams
): RecordDebtPaymentResult {
  const {
    accountId,
    startingBalance,
    debtId,
    amount,
    description,
    editCheckingTransactionId,
    editUnifiedPaymentId,
    mortgageBreakdown,
  } = params;

  if (!accountId) {
    throw new Error('No checking account selected. Please select a checking account and try again.');
  }
  if (!debtId) {
    throw new Error('Please select a debt to pay.');
  }
  if (!amount || amount <= 0) {
    throw new Error('Please enter a valid payment amount.');
  }

  const paymentDate = CalculationService.normalizeDateString(params.date);
  if (!paymentDate) {
    throw new Error('Please select a valid payment date.');
  }

  const balanceReduction =
    params.balanceReductionAmount ??
    (mortgageBreakdown ? calculateMortgageBalanceReduction(mortgageBreakdown) : amount);

  if (!balanceReduction || balanceReduction <= 0) {
    throw new Error('P&I and additional principal must total more than $0 to reduce your balance.');
  }

  const allDebts = StorageService.getDebts();
  const debtIndex = allDebts.findIndex((d) => d.id === debtId);
  if (debtIndex === -1) {
    throw new Error('Selected debt could not be found.');
  }

  const debt = allDebts[debtIndex];
  const previousBalance = debt.currentBalance;
  const calculation = debt.isAmortized
    ? CalculationService.calculateAmortizedPayment(debt, balanceReduction)
    : CalculationService.calculatePayment(debt.currentBalance, debt.interestRate, balanceReduction);

  const isPaidOff = calculation.newBalance === 0;
  const paymentDescription = mortgageBreakdown
    ? formatMortgagePaymentDescription(
        debt.accountName,
        mortgageBreakdown.piPayment,
        mortgageBreakdown.escrow
      )
    : description?.trim() || `Paid ${debt.accountName}`;

  const priorCheckingTransactions = StorageService.getCheckingTransactionsForAccount(accountId);
  const priorCheckingSnapshot = JSON.stringify(priorCheckingTransactions);
  const priorDebtsSnapshot = JSON.stringify(allDebts);
  const priorUnifiedSnapshot = JSON.stringify(StorageService.getUnifiedPayments());

  const checkingTxId = editCheckingTransactionId || `checking_${Date.now()}`;
  const unifiedPaymentId = editUnifiedPaymentId || `payment_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  try {
    const existingChecking = editCheckingTransactionId
      ? priorCheckingTransactions.find((t) => t.id === editCheckingTransactionId)
      : undefined;

    const updatedCheckingTransactions = editCheckingTransactionId
      ? priorCheckingTransactions.map((t) =>
          t.id === editCheckingTransactionId
            ? buildCheckingDebtPaymentTransaction({
                id: checkingTxId,
                accountId,
                date: paymentDate,
                amount,
                description: paymentDescription,
                debtId: debt.id,
                debtName: debt.accountName,
                isReconciled: existingChecking?.isReconciled,
                reconciledAt: existingChecking?.reconciledAt,
              })
            : t
        )
      : [
          ...priorCheckingTransactions,
          buildCheckingDebtPaymentTransaction({
            id: checkingTxId,
            accountId,
            date: paymentDate,
            amount,
            description: paymentDescription,
            debtId: debt.id,
            debtName: debt.accountName,
          }),
        ];

    const recalculatedChecking = recalculateCheckingBalances(
      updatedCheckingTransactions,
      startingBalance
    );
    StorageService.saveCheckingTransactionsForAccount(accountId, recalculatedChecking);

    const updatedDebts = [...allDebts];
    updatedDebts[debtIndex] = {
      ...debt,
      currentBalance: calculation.newBalance,
      isPaidOff: isPaidOff || debt.isPaidOff,
      paidOffDate: isPaidOff && !debt.isPaidOff ? paymentDate : debt.paidOffDate,
    };
    StorageService.saveDebts(updatedDebts);

    const unifiedPayment: UnifiedPayment = {
      id: unifiedPaymentId,
      date: paymentDate,
      debtId: debt.id,
      debtName: debt.accountName,
      amount,
      source: 'checking',
      interestCharged: calculation.interestCharged,
      principalPaid: calculation.principalPaid,
      previousBalance,
      newBalance: calculation.newBalance,
      description: paymentDescription,
      isPaidOff,
      balanceReductionAmount: balanceReduction,
      ...(mortgageBreakdown && {
        piPayment: mortgageBreakdown.piPayment,
        additionalPrincipal: mortgageBreakdown.additionalPrincipal,
        escrowAmount: mortgageBreakdown.escrow,
        pmiAmount: mortgageBreakdown.pmi,
      }),
    };

    if (editUnifiedPaymentId) {
      const payments = StorageService.getUnifiedPayments().map((p) =>
        p.id === editUnifiedPaymentId ? unifiedPayment : p
      );
      StorageService.saveUnifiedPayments(payments);
    } else {
      StorageService.addUnifiedPayment(unifiedPayment);
    }

    const updatedBalance =
      recalculatedChecking.length > 0
        ? recalculatedChecking[recalculatedChecking.length - 1].balance
        : startingBalance;

    return {
      checkingTransactions: recalculatedChecking,
      updatedBalance,
      unifiedPaymentId,
    };
  } catch (error) {
    StorageService.saveCheckingTransactionsForAccount(
      accountId,
      JSON.parse(priorCheckingSnapshot)
    );
    StorageService.saveDebts(JSON.parse(priorDebtsSnapshot));
    StorageService.saveUnifiedPayments(JSON.parse(priorUnifiedSnapshot));
    throw error;
  }
}
