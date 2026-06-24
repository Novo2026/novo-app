import { useState, useMemo, useEffect, type ComponentType } from 'react';
import {
  Plus,
  Upload,
  CreditCard as Edit2,
  X,
  DollarSign,
  CreditCard,
  Building2,
  PlusCircle,
  MinusCircle,
  PiggyBank,
  ArrowLeftRight,
  Home,
  SlidersHorizontal,
} from 'lucide-react';
import StatementUploadModal from './StatementUploadModal';
import { CalculationService } from '../services/calculations';
import { StorageService } from '../services/storage';
import DatePicker from './DatePicker';
import PaymentLoggingGuidance from './PaymentLoggingGuidance';
import type { CheckingAccount, CheckingTransaction } from '../types';
import {
  deleteCheckingTransactionWithLinkedReversal,
  deleteSimpleCheckingTransaction,
  getCheckingDeleteConfirmationMessage,
  isLinkedCheckingDeleteType,
} from '../utils/linkedTransactionDelete';
import {
  recordDebtPaymentFromChecking,
  calculateMortgageTotalPayment,
  calculateMortgageBalanceReduction,
  formatMortgagePaymentDescription,
} from '../utils/checkingDebtPayment';
import { recalculateSavingsTransactions } from '../utils/savingsTransactions';
import {
  getActiveCheckingAccountId,
  setActiveCheckingAccountId,
} from '../utils/activeAccountSession';
import AddCheckingAccountModal from './AddCheckingAccountModal';
import ReconcilePanel from './ReconcilePanel';

const ESSENTIAL_CATEGORIES = [
  'Rent/Housing',
  'Utilities',
  'Groceries',
  'Insurance',
  'Transportation/Gas',
  'Childcare',
  'Medical',
  'Other Essential'
];

const DISCRETIONARY_CATEGORIES = [
  'Dining Out',
  'Entertainment',
  'Shopping/Clothing',
  'Hobbies',
  'Subscriptions',
  'Travel',
  'Other Discretionary'
];

const ACCOUNT_DOT_COLORS = [
  'bg-brand-navy',
  'bg-brand-navy-light',
  'bg-brand-blue',
  'bg-brand-navy/70',
  'bg-brand-blue/70',
];

type SummaryPeriod = 'month' | 'ytd' | 'annual';

function getCheckingAccountBalance(accountId: string, startingBalance: number): number {
  const txs = StorageService.getCheckingTransactionsForAccount(accountId);
  if (txs.length === 0) return startingBalance;
  return txs[txs.length - 1].balance;
}

function filterTransactionsByPeriod(
  transactions: CheckingTransaction[],
  period: SummaryPeriod
): CheckingTransaction[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return transactions.filter((t) => {
    const d = CalculationService.parseLocalDate(t.date);
    if (period === 'month') {
      return d.getMonth() === month && d.getFullYear() === year;
    }
    if (period === 'ytd') {
      return d.getFullYear() === year && d <= now;
    }
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);
    return d >= yearStart && d <= yearEnd;
  });
}

function computeCashFlowSummary(transactions: CheckingTransaction[]) {
  const income = transactions
    .filter((t) => t.type === 'deposit' || t.type === 'transfer_from_checking' || t.type === 'transfer_from_savings' || t.type === 'transfer_from_heloc')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = transactions
    .filter((t) => t.type === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0);

  const debtPayments = transactions
    .filter((t) => t.type === 'debt_payment')
    .reduce((sum, t) => sum + t.amount, 0);

  const toSavings = transactions
    .filter((t) => t.type === 'transfer_to_savings')
    .reduce((sum, t) => sum + t.amount, 0);

  const other = transactions
    .filter((t) =>
      t.type === 'transfer_to_heloc' ||
      t.type === 'transfer_to_checking'
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const outflows = expenses + debtPayments + toSavings + other;
  const netChange = income - outflows;

  return { income, expenses, debtPayments, toSavings, other, netChange };
}

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  textClass,
  borderClass,
  bgClass,
  hoverBgClass,
  disabled,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  textClass: string;
  borderClass: string;
  bgClass: string;
  hoverBgClass: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium leading-tight py-3 px-2 rounded-md border-[0.5px] transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${textClass} ${borderClass} ${bgClass} ${hoverBgClass}`}
    >
      <Icon className="w-[22px] h-[22px] shrink-0" />
      <span className="text-center">{label}</span>
    </button>
  );
}

export function CheckingTracker({ onDataUpdate }: { onDataUpdate?: () => void }) {
  const [showModal, setShowModal] = useState(false);
  const [showStatementUpload, setShowStatementUpload] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSavingsTransferModal, setShowSavingsTransferModal] = useState(false);
  const [showCheckingTransferModal, setShowCheckingTransferModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<CheckingTransaction | null>(null);
  const [modalType, setModalType] = useState<'deposit' | 'withdrawal' | 'debt_payment'>('deposit');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<CheckingAccount[]>(() => StorageService.getCheckingAccounts());
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() =>
    getActiveCheckingAccountId(StorageService.getCheckingAccounts())
  );
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showReconcilePanel, setShowReconcilePanel] = useState(false);
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>('month');
  const [allAccountsCombined, setAllAccountsCombined] = useState(false);

  useEffect(() => {
    const accts = StorageService.getCheckingAccounts();
    setAccounts(accts);
    setSelectedAccountId((current) => {
      if (current && accts.some((a) => a.id === current)) {
        return current;
      }
      const fallback = getActiveCheckingAccountId(accts);
      if (fallback) {
        setActiveCheckingAccountId(fallback);
      }
      return fallback;
    });
  }, [refreshTrigger]);

  const selectCheckingAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    setActiveCheckingAccountId(accountId);
  };

  const handleAddAccount = (account: CheckingAccount) => {
    const updated = [...accounts, account];
    StorageService.saveCheckingAccounts(updated);
    setAccounts(updated);
    selectCheckingAccount(account.id);
    setShowAddAccount(false);
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) || accounts[0];

  const transactions = useMemo(() => {
    if (!selectedAccountId) return [];
    return StorageService.getCheckingTransactionsForAccount(selectedAccountId);
  }, [refreshTrigger, selectedAccountId]);

  const startingBalance = selectedAccount?.startingBalance ?? 0;
  const currentBalance = transactions.length > 0
    ? transactions[transactions.length - 1].balance
    : startingBalance;
  const canTransferToChecking = accounts.length > 1;

  const recentDeposits = transactions
    .filter(t => t.type === 'deposit')
    .slice(-3)
    .map(t => t.amount);

  const averageDeposit = recentDeposits.length > 0
    ? recentDeposits.reduce((sum, amt) => sum + amt, 0) / recentDeposits.length
    : 0;

  const allAccountSummaries = useMemo(() => {
    return accounts.map((account, index) => {
      const balance = getCheckingAccountBalance(account.id, account.startingBalance);
      return { account, balance, dotColor: ACCOUNT_DOT_COLORS[index % ACCOUNT_DOT_COLORS.length] };
    });
  }, [accounts, refreshTrigger]);

  const totalCash = allAccountSummaries.reduce((sum, a) => sum + a.balance, 0);

  const summaryTransactions = useMemo(() => {
    const sourceAccounts = allAccountsCombined ? accounts : accounts.filter((a) => a.id === selectedAccountId);
    return sourceAccounts.flatMap((a) => StorageService.getCheckingTransactionsForAccount(a.id));
  }, [accounts, selectedAccountId, allAccountsCombined, refreshTrigger]);

  const cashFlowSummary = useMemo(() => {
    const filtered = filterTransactionsByPeriod(summaryTransactions, summaryPeriod);
    return computeCashFlowSummary(filtered);
  }, [summaryTransactions, summaryPeriod]);

  const openModal = (type: 'deposit' | 'withdrawal' | 'debt_payment', transaction: CheckingTransaction | null = null) => {
    setModalType(type);
    setEditingTransaction(transaction);
    setShowModal(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-stretch gap-3 flex-wrap sm:flex-nowrap">
        {accounts.map((account) => {
          const balance = getCheckingAccountBalance(account.id, account.startingBalance);
          const isActive = selectedAccountId === account.id;
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => selectCheckingAccount(account.id)}
              className={`flex-1 min-w-[140px] flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                isActive
                  ? 'border-2 border-brand-navy bg-white'
                  : 'border border-brand-gray-border bg-white hover:border-brand-navy/30'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-brand-blue-light flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-brand-navy" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-brand-navy truncate">{account.name}</p>
                <p className="text-[11px] text-brand-gray truncate">{account.bankName || 'Checking account'}</p>
                <p className="text-sm font-medium text-brand-navy mt-0.5">
                  {CalculationService.formatCurrency(balance)}
                </p>
              </div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowAddAccount(true)}
          className="flex-1 min-w-[120px] flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-brand-gray-border text-brand-gray text-sm font-medium hover:border-brand-orange hover:text-brand-orange transition-colors bg-white min-h-[72px]"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {successMessage && (
        <div className="bg-brand-green-light border border-green-200 text-green-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-green-700 hover:text-green-900 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="flex-1 min-w-0 space-y-5 w-full">
          <div className="bg-white border border-brand-gray-border rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-base font-semibold text-brand-navy">{selectedAccount?.name}</h2>
                <p className="text-xs text-brand-gray">{selectedAccount?.bankName || 'Checking account'}</p>
              </div>
            </div>

            <p className="text-[28px] font-medium text-brand-navy leading-none mb-1">
              {CalculationService.formatCurrency(currentBalance)}
            </p>
            <p className="text-xs text-brand-gray">
              Starting {CalculationService.formatCurrency(startingBalance)}
              {averageDeposit > 0 && (
                <> · Avg deposit {CalculationService.formatCurrency(averageDeposit)}</>
              )}
            </p>

            <div className="mt-3 pt-3 border-t border-brand-gray-border">
              <p className="text-[11px] uppercase font-semibold text-brand-navy tracking-[0.5px] mb-2">
                Quick actions
              </p>
              <div className="grid grid-cols-4 gap-2 mb-2">
                <QuickActionButton
                  icon={PlusCircle}
                  label="Deposit"
                  onClick={() => openModal('deposit')}
                  textClass="text-green-700"
                  borderClass="border-green-200"
                  bgClass="bg-green-50"
                  hoverBgClass="hover:bg-green-100"
                />
                <QuickActionButton
                  icon={MinusCircle}
                  label="Withdraw"
                  onClick={() => openModal('withdrawal')}
                  textClass="text-red-700"
                  borderClass="border-red-200"
                  bgClass="bg-red-50"
                  hoverBgClass="hover:bg-red-100"
                />
                <QuickActionButton
                  icon={CreditCard}
                  label="Debt payment"
                  onClick={() => openModal('debt_payment')}
                  textClass="text-blue-700"
                  borderClass="border-blue-200"
                  bgClass="bg-blue-50"
                  hoverBgClass="hover:bg-blue-100"
                />
                <QuickActionButton
                  icon={Upload}
                  label="Import statement"
                  onClick={() => setShowStatementUpload(true)}
                  textClass="text-brand-gray"
                  borderClass="border-brand-gray-border"
                  bgClass="bg-gray-50"
                  hoverBgClass="hover:bg-gray-100"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <QuickActionButton
                  icon={PiggyBank}
                  label="To Savings"
                  onClick={() => setShowSavingsTransferModal(true)}
                  textClass="text-amber-700"
                  borderClass="border-amber-200"
                  bgClass="bg-amber-50"
                  hoverBgClass="hover:bg-amber-100"
                />
                <QuickActionButton
                  icon={ArrowLeftRight}
                  label="To Checking"
                  onClick={() => canTransferToChecking && setShowCheckingTransferModal(true)}
                  disabled={!canTransferToChecking}
                  title={!canTransferToChecking ? 'Add another checking account to enable transfers' : undefined}
                  textClass="text-purple-700"
                  borderClass="border-purple-200"
                  bgClass="bg-purple-50"
                  hoverBgClass="hover:bg-purple-100"
                />
                <QuickActionButton
                  icon={Home}
                  label="To HELOC"
                  onClick={() => setShowTransferModal(true)}
                  textClass="text-pink-700"
                  borderClass="border-pink-200"
                  bgClass="bg-pink-50"
                  hoverBgClass="hover:bg-pink-100"
                />
                <QuickActionButton
                  icon={DollarSign}
                  label="Set Balance"
                  onClick={() => {
                    const balance = prompt('Enter your starting balance:', startingBalance.toString());
                    if (balance !== null && selectedAccountId) {
                      const updatedAccounts = StorageService.getCheckingAccounts().map((a) =>
                        a.id === selectedAccountId
                          ? { ...a, startingBalance: parseFloat(balance) || 0 }
                          : a
                      );
                      StorageService.saveCheckingAccounts(updatedAccounts);
                      setAccounts(updatedAccounts);
                      setSuccessMessage(`✓ Starting balance updated to ${CalculationService.formatCurrency(parseFloat(balance))}`);
                      setRefreshTrigger((prev) => prev + 1);
                      setTimeout(() => setSuccessMessage(null), 5000);
                    }
                  }}
                  textClass="text-brand-gray"
                  borderClass="border-brand-gray-border"
                  bgClass="bg-gray-50"
                  hoverBgClass="hover:bg-gray-100"
                />
              </div>
              {selectedAccount && (
                <button
                  type="button"
                  onClick={() => setShowReconcilePanel(true)}
                  className="w-full mt-3 flex items-center justify-center gap-2 bg-brand-navy hover:bg-brand-navy-dark text-white text-[13px] font-medium py-2.5 rounded-md transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Reconcile account
                </button>
              )}
            </div>
          </div>

          <TransactionLedger
            transactions={transactions}
            onEdit={(transaction) => openModal(transaction.type as 'deposit' | 'withdrawal' | 'debt_payment', transaction)}
            onDelete={(id) => {
              const transaction = transactions.find((t) => t.id === id);
              if (!transaction) return;

              if (transaction.linkedHelocTransactionId) {
                const choice = confirm(
                  'This transaction is linked to a HELOC transaction.\n\n' +
                  'Click OK to delete both transactions, or Cancel to delete only this one.'
                );

                try {
                  if (choice) {
                    const filteredHeloc = JSON.parse(
                      localStorage.getItem('novo_heloc_transactions') || '[]'
                    ).filter((t: { id: string }) => t.id !== transaction.linkedHelocTransactionId);

                    const homeEquity = JSON.parse(localStorage.getItem('novo_home_equity') || '{}');
                    const helocBalance = homeEquity.helocBalance || 0;
                    let runningBalance = helocBalance;
                    filteredHeloc.forEach((txn: { type: string; amount: number; balance: number }) => {
                      if (txn.type === 'draw' || txn.type === 'interest') {
                        runningBalance += txn.amount;
                      } else {
                        runningBalance -= txn.amount;
                      }
                      runningBalance = Math.max(0, runningBalance);
                      txn.balance = Math.round(runningBalance * 100) / 100;
                    });

                    localStorage.setItem('novo_heloc_transactions', JSON.stringify(filteredHeloc));
                  }

                  deleteSimpleCheckingTransaction(selectedAccountId, id);
                  setSuccessMessage(
                    choice
                      ? '✓ Both linked transactions deleted. Balances updated.'
                      : '✓ Checking transaction deleted. HELOC transaction kept.'
                  );
                } catch (err) {
                  setSuccessMessage(
                    err instanceof Error ? err.message : 'Delete failed. Please try again.'
                  );
                }
              } else if (isLinkedCheckingDeleteType(transaction.type)) {
                if (!confirm(getCheckingDeleteConfirmationMessage(transaction))) {
                  return;
                }

                try {
                  const result = deleteCheckingTransactionWithLinkedReversal(
                    selectedAccountId,
                    id
                  );
                  setSuccessMessage(result.message);
                } catch (err) {
                  setSuccessMessage(
                    err instanceof Error ? err.message : 'Delete failed. Please try again.'
                  );
                }
              } else {
                if (!confirm(getCheckingDeleteConfirmationMessage(transaction))) {
                  return;
                }

                try {
                  deleteSimpleCheckingTransaction(selectedAccountId, id);
                  setSuccessMessage('✓ Transaction deleted. Balances updated.');
                } catch (err) {
                  setSuccessMessage(
                    err instanceof Error ? err.message : 'Delete failed. Please try again.'
                  );
                }
              }

              setRefreshTrigger((prev) => prev + 1);
              onDataUpdate?.();
              setTimeout(() => setSuccessMessage(null), 5000);
            }}
          />
        </div>

        <aside className="w-full lg:w-[320px] shrink-0 space-y-5">
          <AllAccountsPanel accounts={allAccountSummaries} totalCash={totalCash} />
          <MonthlySummarySidebar
            summary={cashFlowSummary}
            period={summaryPeriod}
            onPeriodChange={setSummaryPeriod}
            allAccountsCombined={allAccountsCombined}
            onToggleAllAccounts={() => setAllAccountsCombined((v) => !v)}
          />
        </aside>
      </div>

      {showModal && (
        <TransactionModal
          onClose={() => {
            setShowModal(false);
            setEditingTransaction(null);
          }}
          onSuccess={(message) => {
            setShowModal(false);
            setEditingTransaction(null);
            setSuccessMessage(message);
            setRefreshTrigger(prev => prev + 1);
            onDataUpdate?.();
            setTimeout(() => setSuccessMessage(null), 5000);
          }}
          currentBalance={currentBalance}
          startingBalance={startingBalance}
          accountId={selectedAccountId}
          editTransaction={editingTransaction}
          type={modalType}
        />
      )}

      {showTransferModal && (
        <TransferToHelocModal
          onClose={() => setShowTransferModal(false)}
          onSuccess={(message) => {
            setShowTransferModal(false);
            setSuccessMessage(message);
            setRefreshTrigger(prev => prev + 1);
            setTimeout(() => setSuccessMessage(null), 5000);
          }}
          currentBalance={currentBalance}
          startingBalance={startingBalance}
          accountId={selectedAccountId}
        />
      )}

      {showSavingsTransferModal && (
        <TransferToSavingsModal
          onClose={() => setShowSavingsTransferModal(false)}
          onSuccess={(message) => {
            setShowSavingsTransferModal(false);
            setSuccessMessage(message);
            setRefreshTrigger(prev => prev + 1);
            onDataUpdate?.();
            setTimeout(() => setSuccessMessage(null), 5000);
          }}
          currentBalance={currentBalance}
          startingBalance={startingBalance}
          accountId={selectedAccountId}
          sourceAccountName={selectedAccount?.name || 'Checking'}
        />
      )}

      {showCheckingTransferModal && (
        <TransferToCheckingModal
          onClose={() => setShowCheckingTransferModal(false)}
          onSuccess={(message) => {
            setShowCheckingTransferModal(false);
            setSuccessMessage(message);
            setRefreshTrigger(prev => prev + 1);
            onDataUpdate?.();
            setTimeout(() => setSuccessMessage(null), 5000);
          }}
          sourceAccountId={selectedAccountId}
          sourceAccountName={selectedAccount?.name || 'Checking'}
          currentBalance={currentBalance}
          startingBalance={startingBalance}
          checkingAccounts={accounts}
        />
      )}

      {showStatementUpload && (
        <StatementUploadModal
          onClose={() => setShowStatementUpload(false)}
          onSuccess={(message) => {
            setShowStatementUpload(false);
            setSuccessMessage(message);
            setRefreshTrigger(prev => prev + 1);
            onDataUpdate?.();
            setTimeout(() => setSuccessMessage(null), 5000);
          }}
          startingBalance={startingBalance}
          currentBalance={currentBalance}
          defaultCheckingAccountId={selectedAccountId}
        />
      )}

      {showAddAccount && (
        <AddCheckingAccountModal
          onClose={() => setShowAddAccount(false)}
          onSave={handleAddAccount}
        />
      )}

      {showReconcilePanel && (
        <ReconcilePanel
          accountName={accounts.find(a => a.id === selectedAccountId)?.name || 'Checking'}
          accountId={selectedAccountId}
          currentBalance={currentBalance}
          lastReconciledAt={accounts.find(a => a.id === selectedAccountId)?.lastReconciledAt || null}
          onClose={() => setShowReconcilePanel(false)}
          onComplete={(reconciledIds, statementBalance) => {
            const key = `novo_checking_transactions_${selectedAccountId}`;
            const fallbackKey = 'novo_checking_transactions';
            const stored = localStorage.getItem(key) || localStorage.getItem(fallbackKey) || '[]';
            const transactions = JSON.parse(stored);
            const updated = transactions.map((t: CheckingTransaction) =>
              reconciledIds.includes(t.id)
                ? { ...t, isReconciled: true, reconciledAt: new Date().toISOString() }
                : t
            );
            localStorage.setItem(key, JSON.stringify(updated));

            const allAccounts = StorageService.getCheckingAccounts();
            const idx = allAccounts.findIndex(a => a.id === selectedAccountId);
            if (idx !== -1) {
              allAccounts[idx].lastReconciledAt = new Date().toISOString();
              allAccounts[idx].lastReconciledBalance = statementBalance || currentBalance;
              StorageService.saveCheckingAccounts(allAccounts);
              setAccounts(allAccounts);
            }

            setRefreshTrigger(prev => prev + 1);
            setShowReconcilePanel(false);
          }}
        />
      )}
    </div>
  );
}

function AllAccountsPanel({
  accounts,
  totalCash,
}: {
  accounts: { account: CheckingAccount; balance: number; dotColor: string }[];
  totalCash: number;
}) {
  return (
    <div className="bg-white border border-brand-gray-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-brand-navy mb-3">All accounts</h3>
      <div className="space-y-3">
        {accounts.map(({ account, balance, dotColor }) => (
          <div key={account.id} className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-brand-navy truncate">{account.name}</p>
              <p className="text-[11px] text-brand-gray truncate">{account.bankName || 'Checking'}</p>
            </div>
            <span className="text-[13px] font-medium text-brand-navy shrink-0">
              {CalculationService.formatCurrency(balance)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-brand-gray-border mt-3 pt-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-brand-navy">Total cash</span>
        <span className="text-[13px] font-medium text-brand-navy">
          {CalculationService.formatCurrency(totalCash)}
        </span>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  bgClass,
  textClass,
}: {
  label: string;
  value: number;
  bgClass: string;
  textClass: string;
}) {
  return (
    <div className={`rounded-lg p-2.5 ${bgClass}`}>
      <p className="text-[10px] text-brand-gray mb-0.5">{label}</p>
      <p className={`text-xs font-semibold ${textClass}`}>
        {CalculationService.formatCurrency(value)}
      </p>
    </div>
  );
}

function MonthlySummarySidebar({
  summary,
  period,
  onPeriodChange,
  allAccountsCombined,
  onToggleAllAccounts,
}: {
  summary: ReturnType<typeof computeCashFlowSummary>;
  period: SummaryPeriod;
  onPeriodChange: (p: SummaryPeriod) => void;
  allAccountsCombined: boolean;
  onToggleAllAccounts: () => void;
}) {
  const periods: { id: SummaryPeriod; label: string }[] = [
    { id: 'month', label: 'This month' },
    { id: 'ytd', label: 'YTD' },
    { id: 'annual', label: 'Annual' },
  ];

  return (
    <div className="bg-white border border-brand-gray-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-brand-navy mb-3">Monthly summary</h3>

      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs text-brand-gray">All accounts combined</span>
        <button
          type="button"
          role="switch"
          aria-checked={allAccountsCombined}
          onClick={onToggleAllAccounts}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            allAccountsCombined ? 'bg-brand-navy' : 'bg-brand-gray-border'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              allAccountsCombined ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="flex gap-1 mb-4">
        {periods.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPeriodChange(p.id)}
            className={`flex-1 text-[11px] py-1.5 px-2 rounded-full border transition-colors ${
              period === p.id
                ? 'bg-brand-navy text-white border-brand-navy'
                : 'bg-white text-brand-gray border-brand-gray-border hover:border-brand-navy/30'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <SummaryCard label="Income" value={summary.income} bgClass="bg-brand-green-light" textClass="text-green-700" />
        <SummaryCard label="Expenses" value={summary.expenses} bgClass="bg-brand-red-light" textClass="text-red-700" />
        <SummaryCard
          label="Net change"
          value={summary.netChange}
          bgClass="bg-brand-blue-light"
          textClass={summary.netChange >= 0 ? 'text-blue-700' : 'text-red-700'}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="Debt payments" value={summary.debtPayments} bgClass="bg-purple-50" textClass="text-purple-700" />
        <SummaryCard label="To savings" value={summary.toSavings} bgClass="bg-amber-50" textClass="text-amber-700" />
        <SummaryCard label="Other" value={summary.other} bgClass="bg-brand-gray-light" textClass="text-brand-gray" />
      </div>
    </div>
  );
}

function getTransactionDisplayMeta(transaction: CheckingTransaction) {
  switch (transaction.type) {
    case 'deposit':
    case 'transfer_from_heloc':
    case 'transfer_from_checking':
    case 'transfer_from_savings':
      return {
        iconBg: 'bg-green-100',
        iconColor: 'text-green-700',
        Icon: PlusCircle,
        isPositive: true,
        typeLabel: transaction.type === 'deposit' ? 'Deposit' : 'Incoming transfer',
      };
    case 'debt_payment':
      return {
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-700',
        Icon: CreditCard,
        isPositive: false,
        typeLabel: 'Debt payment',
      };
    case 'transfer_to_savings':
      return {
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-700',
        Icon: PiggyBank,
        isPositive: false,
        typeLabel: 'To savings',
      };
    case 'transfer_to_checking':
      return {
        iconBg: 'bg-brand-blue-light',
        iconColor: 'text-blue-700',
        Icon: ArrowLeftRight,
        isPositive: false,
        typeLabel: 'To checking',
      };
    case 'transfer_to_heloc':
      return {
        iconBg: 'bg-pink-100',
        iconColor: 'text-pink-700',
        Icon: Home,
        isPositive: false,
        typeLabel: 'To HELOC',
      };
    default:
      return {
        iconBg: 'bg-red-100',
        iconColor: 'text-red-700',
        Icon: MinusCircle,
        isPositive: false,
        typeLabel: transaction.category || 'Withdrawal',
      };
  }
}

function TransactionLedger({
  transactions,
  onEdit,
  onDelete
}: {
  transactions: CheckingTransaction[];
  onEdit: (t: CheckingTransaction) => void;
  onDelete: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayLimit = 10;

  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Subcategory', 'Description', 'Amount', 'Balance'];
    const rows = transactions.map(t => [
      t.date,
      t.type === 'debt_payment' ? 'Debt Payment' : t.type.charAt(0).toUpperCase() + t.type.slice(1),
      t.category || '',
      t.subcategory || '',
      t.description,
      t.type === 'deposit' ? `+$${t.amount.toFixed(2)}` : `-$${t.amount.toFixed(2)}`,
      `$${t.balance.toFixed(2)}`
    ]);

    const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
    const totalWithdrawals = transactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0);
    const totalDebtPayments = transactions.filter(t => t.type === 'debt_payment').reduce((sum, t) => sum + t.amount, 0);
    const currentBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;

    rows.push([]);
    rows.push(['Summary', '', '', '', '', '', '']);
    rows.push(['Total Deposits', '', '', '', '', `$${totalDeposits.toFixed(2)}`, '']);
    rows.push(['Total Withdrawals', '', '', '', '', `-$${totalWithdrawals.toFixed(2)}`, '']);
    rows.push(['Total Debt Payments', '', '', '', '', `-$${totalDebtPayments.toFixed(2)}`, '']);
    rows.push(['Current Balance', '', '', '', '', '', `$${currentBalance.toFixed(2)}`]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checking_transactions_${CalculationService.getTodayDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortedTransactions = [...transactions].sort((a, b) =>
    CalculationService.compareDateStrings(b.date, a.date)
  );

  const visibleTransactions = showAll
    ? sortedTransactions
    : sortedTransactions.slice(0, displayLimit);

  return (
    <div className="bg-white border border-brand-gray-border rounded-lg overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 border-b border-brand-gray-border">
        <h3 className="text-sm font-medium text-brand-navy">Transaction history</h3>
        {transactions.length > 0 && (
          <button
            type="button"
            onClick={exportCSV}
            className="text-xs text-brand-blue hover:underline font-medium"
          >
            Export CSV
          </button>
        )}
      </div>

      {transactions.length === 0 ? (
        <p className="text-brand-gray text-sm text-center py-10 px-4">
          No transactions yet. Use quick actions above to record your first entry.
        </p>
      ) : (
        <>
          <ul>
            {visibleTransactions.map((transaction) => {
              const meta = getTransactionDisplayMeta(transaction);
              const TxIcon = meta.Icon;
              return (
                <li
                  key={transaction.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-brand-gray-border/80 last:border-b-0 hover:bg-brand-gray-light/50 group"
                >
                  <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 ${meta.iconBg}`}>
                    <TxIcon className={`w-4 h-4 ${meta.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-brand-navy truncate">{transaction.description}</p>
                    <p className="text-[11px] text-brand-gray">
                      {CalculationService.formatLocalDateShort(transaction.date)} · {meta.typeLabel}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-[13px] font-medium ${meta.isPositive ? 'text-green-700' : 'text-red-700'}`}>
                      {meta.isPositive ? '+' : '-'}
                      {CalculationService.formatCurrency(transaction.amount)}
                    </p>
                    <p className="text-[11px] text-brand-gray">
                      {CalculationService.formatCurrency(transaction.balance)}
                    </p>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => onEdit(transaction)}
                      className="p-1.5 text-brand-blue hover:bg-brand-blue-light rounded"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(transaction.id)}
                      className="p-1.5 text-red-600 hover:bg-brand-red-light rounded"
                      title="Delete"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {sortedTransactions.length > displayLimit && (
            <div className="py-3 text-center border-t border-brand-gray-border">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-xs text-brand-blue font-medium hover:underline"
              >
                {showAll ? 'Show fewer transactions' : 'View all transactions'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TransactionModal({
  onClose,
  onSuccess,
  currentBalance,
  startingBalance,
  accountId,
  editTransaction,
  type
}: {
  onClose: () => void;
  onSuccess: (message: string) => void;
  currentBalance: number;
  startingBalance: number;
  accountId: string;
  editTransaction: CheckingTransaction | null;
  type: 'deposit' | 'withdrawal' | 'debt_payment';
}) {
  const debts = StorageService.getDebts().filter(d => !d.isPaidOff);

  const [amount, setAmount] = useState(editTransaction?.amount.toString() || '');
  const [piPayment, setPiPayment] = useState('');
  const [additionalPrincipal, setAdditionalPrincipal] = useState('');
  const [escrow, setEscrow] = useState('');
  const [pmi, setPmi] = useState('');
  const [date, setDate] = useState(
    editTransaction?.date
      ? CalculationService.normalizeDateString(editTransaction.date)
      : CalculationService.getTodayDateString()
  );
  const [description, setDescription] = useState(editTransaction?.description || '');
  const [selectedDebt, setSelectedDebt] = useState(editTransaction?.debtId || (debts.length > 0 ? debts[0].id : ''));
  const [expenseType, setExpenseType] = useState<'essential' | 'discretionary' | 'other'>(
    editTransaction?.category === 'Essential Expense' ? 'essential' :
    editTransaction?.category === 'Discretionary Expense' ? 'discretionary' : 'other'
  );
  const [subcategory, setSubcategory] = useState(editTransaction?.subcategory || '');
  const [error, setError] = useState<string | null>(null);

  const selectedDebtObj = debts.find(d => d.id === selectedDebt);
  const isMortgagePayment = type === 'debt_payment' && selectedDebtObj?.category === 'Mortgage';

  const mortgageBreakdownValues = {
    piPayment: parseFloat(piPayment) || 0,
    additionalPrincipal: parseFloat(additionalPrincipal) || 0,
    escrow: parseFloat(escrow) || 0,
    pmi: parseFloat(pmi) || 0,
  };
  const mortgageTotalPayment = isMortgagePayment
    ? calculateMortgageTotalPayment(mortgageBreakdownValues)
    : 0;
  const mortgageBalanceReduction = isMortgagePayment
    ? calculateMortgageBalanceReduction(mortgageBreakdownValues)
    : 0;
  const autoMortgageDescription = selectedDebtObj
    ? formatMortgagePaymentDescription(
        selectedDebtObj.accountName,
        mortgageBreakdownValues.piPayment,
        mortgageBreakdownValues.escrow
      )
    : '';

  useEffect(() => {
    if (type !== 'debt_payment' || editTransaction) return;
    const debt = StorageService.getDebts().find((d) => d.id === selectedDebt && !d.isPaidOff);
    if (!debt || debt.category !== 'Mortgage') return;
    setPiPayment(debt.minimumPayment.toString());
    setAdditionalPrincipal('');
    setEscrow('');
    setPmi('');
  }, [selectedDebt, type, editTransaction]);

  const amountInputValue = isMortgagePayment
    ? (mortgageTotalPayment > 0 ? mortgageTotalPayment.toFixed(2) : '')
    : amount;

  const transactionAmount = isMortgagePayment ? mortgageTotalPayment : (parseFloat(amount) || 0);
  const newBalance = type === 'deposit'
    ? currentBalance + transactionAmount
    : Math.max(0, currentBalance - transactionAmount);

  const handleSubmit = () => {
    setError(null);

    if (!accountId) {
      setError('No checking account selected. Please select a checking account and try again.');
      return;
    }

    if (!transactionAmount || transactionAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    if (type === 'debt_payment' && !selectedDebt) {
      setError('Please select a debt to pay.');
      return;
    }

    if (type === 'debt_payment' && selectedDebtObj) {
      try {
        const mortgageBreakdown = isMortgagePayment
          ? {
              piPayment: mortgageBreakdownValues.piPayment,
              additionalPrincipal: mortgageBreakdownValues.additionalPrincipal,
              escrow: mortgageBreakdownValues.escrow,
              pmi: mortgageBreakdownValues.pmi,
            }
          : undefined;

        if (isMortgagePayment && mortgageBalanceReduction <= 0) {
          setError('P&I and additional principal must total more than $0 to reduce your balance.');
          return;
        }

        const result = recordDebtPaymentFromChecking({
          accountId,
          startingBalance,
          debtId: selectedDebt,
          amount: transactionAmount,
          balanceReductionAmount: isMortgagePayment ? mortgageBalanceReduction : undefined,
          mortgageBreakdown,
          date,
          description: isMortgagePayment ? autoMortgageDescription : (description.trim() || undefined),
          editCheckingTransactionId: editTransaction?.id,
        });

        const message = `✓ Debt Payment recorded: -${CalculationService.formatCurrency(transactionAmount)}. New balance: ${CalculationService.formatCurrency(result.updatedBalance)}`;
        onSuccess(message);
      } catch (err) {
        console.error('Debt payment failed:', err);
        setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      }
      return;
    }

    const transactions: CheckingTransaction[] = StorageService.getCheckingTransactionsForAccount(accountId);
    const paymentDate = CalculationService.normalizeDateString(date);

    let category = undefined;
    let finalSubcategory = undefined;
    let finalDescription = description;

    if (type === 'withdrawal') {
      if (expenseType === 'essential') {
        category = 'Essential Expense';
        finalSubcategory = subcategory;
      } else if (expenseType === 'discretionary') {
        category = 'Discretionary Expense';
        finalSubcategory = subcategory;
      }
      if (!finalDescription) {
        finalDescription = 'Expense/Withdrawal';
      }
    } else if (type === 'deposit' && !finalDescription) {
      finalDescription = 'Cash Flow Deposit';
    }

    const newTransaction: CheckingTransaction = {
      id: editTransaction?.id || `checking_${Date.now()}`,
      accountId,
      date: paymentDate,
      type: editTransaction?.type || type,
      amount: transactionAmount,
      description: finalDescription,
      balance: 0,
      category,
      subcategory: finalSubcategory,
      isReconciled: editTransaction?.isReconciled ?? false,
      reconciledAt: editTransaction?.reconciledAt,
    };

    if (editTransaction) {
      const index = transactions.findIndex(t => t.id === editTransaction.id);
      transactions[index] = newTransaction;
    } else {
      transactions.push(newTransaction);
    }

    transactions.sort((a, b) => CalculationService.compareDateStrings(a.date, b.date));
    recalculateBalances(transactions, startingBalance);

    StorageService.saveCheckingTransactionsForAccount(accountId, transactions);

    const typeLabel = type === 'deposit' ? 'Deposit' : 'Withdrawal';
    const message = `✓ ${typeLabel} recorded: ${type === 'deposit' ? '+' : '-'}${CalculationService.formatCurrency(transactionAmount)}. New balance: ${CalculationService.formatCurrency(newBalance)}`;
    onSuccess(message);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-lg w-full p-6 max-h-[90vh] overflow-y-auto ${isMortgagePayment ? 'max-w-lg' : 'max-w-md'}`}>
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {editTransaction ? 'Edit' : 'Record'} {type === 'deposit' ? 'Deposit' : type === 'debt_payment' ? 'Debt Payment' : 'Withdrawal'}
        </h3>

        <div className="space-y-4">
          {type === 'debt_payment' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Select Debt</label>
              <select
                value={selectedDebt}
                onChange={(e) => {
                  setSelectedDebt(e.target.value);
                  const debt = debts.find(d => d.id === e.target.value);
                  if (debt) {
                    if (debt.category === 'Mortgage') {
                      setPiPayment(debt.minimumPayment.toString());
                      setAdditionalPrincipal('');
                      setEscrow('');
                      setPmi('');
                    } else {
                      setAmount(debt.minimumPayment.toString());
                      setDescription(`Paid ${debt.accountName}`);
                    }
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              >
                {debts.map(debt => (
                  <option key={debt.id} value={debt.id}>
                    {debt.accountName} ({debt.category}) - Balance: {CalculationService.formatCurrency(debt.currentBalance)}
                  </option>
                ))}
              </select>
              {selectedDebtObj && (
                <p className="text-xs text-gray-600 mt-1">
                  Min payment: {CalculationService.formatCurrency(selectedDebtObj.minimumPayment)}
                </p>
              )}
            </div>
          )}

          {type === 'debt_payment' && selectedDebtObj && !isMortgagePayment && (
            <PaymentLoggingGuidance
              debtId={selectedDebtObj.id}
              minimumPayment={selectedDebtObj.minimumPayment}
              onSelectAmount={(amount) => {
                setAmount(amount.toFixed(2));
              }}
            />
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-600">$</span>
              <input
                type="number"
                value={amountInputValue}
                onChange={(e) => setAmount(e.target.value)}
                readOnly={isMortgagePayment}
                className={`w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent ${
                  isMortgagePayment ? 'bg-gray-50 text-gray-700 cursor-default' : ''
                }`}
                placeholder="0.00"
                step="0.01"
              />
            </div>
            {isMortgagePayment && (
              <p className="text-xs text-gray-500 mt-1">Auto-calculated from payment breakdown below</p>
            )}
          </div>

          {isMortgagePayment && selectedDebtObj && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
              <h4 className="text-sm font-bold text-brand-navy">Mortgage Payment Breakdown</h4>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  P&I Payment
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-600 text-sm">$</span>
                  <input
                    type="number"
                    value={piPayment}
                    onChange={(e) => setPiPayment(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">This is what reduces your balance</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Additional Principal
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-600 text-sm">$</span>
                  <input
                    type="number"
                    value={additionalPrincipal}
                    onChange={(e) => setAdditionalPrincipal(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Extra amount applied directly to balance</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Escrow (Tax & Insurance)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-600 text-sm">$</span>
                  <input
                    type="number"
                    value={escrow}
                    onChange={(e) => setEscrow(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Does not reduce balance — held in escrow</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  PMI (if applicable)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-600 text-sm">$</span>
                  <input
                    type="number"
                    value={pmi}
                    onChange={(e) => setPmi(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Does not reduce balance</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Total Payment
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-600 text-sm">$</span>
                  <input
                    type="text"
                    readOnly
                    aria-readonly="true"
                    value={mortgageTotalPayment > 0 ? mortgageTotalPayment.toFixed(2) : '0.00'}
                    className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-800 font-semibold cursor-default"
                  />
                </div>
              </div>

              <div className="bg-[#FFF8E7] border border-brand-navy/10 rounded-lg px-3 py-2.5">
                <p className="text-xs text-brand-navy leading-relaxed">
                  Only your P&I and any extra principal reduce your mortgage balance. Escrow covers taxes and insurance and is held by your lender.
                </p>
              </div>
            </div>
          )}

          {type === 'debt_payment' && selectedDebtObj && isMortgagePayment && (
            <PaymentLoggingGuidance
              debtId={selectedDebtObj.id}
              minimumPayment={selectedDebtObj.minimumPayment}
              onSelectAmount={(selectedAmount) => {
                setPiPayment(selectedAmount.toFixed(2));
              }}
            />
          )}

          <DatePicker
            label="Date"
            value={date}
            onChange={setDate}
            demoMode={JSON.parse(localStorage.getItem('novo_demo_mode') || 'false')}
          />

          {type === 'withdrawal' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Expense Type</label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      value="essential"
                      checked={expenseType === 'essential'}
                      onChange={(e) => setExpenseType(e.target.value as 'essential')}
                      className="w-4 h-4 text-brand-green focus:ring-brand-green"
                    />
                    <span className="text-gray-800">Essential Expense</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      value="discretionary"
                      checked={expenseType === 'discretionary'}
                      onChange={(e) => setExpenseType(e.target.value as 'discretionary')}
                      className="w-4 h-4 text-brand-green focus:ring-brand-green"
                    />
                    <span className="text-gray-800">Discretionary Expense</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      value="other"
                      checked={expenseType === 'other'}
                      onChange={(e) => setExpenseType(e.target.value as 'other')}
                      className="w-4 h-4 text-brand-green focus:ring-brand-green"
                    />
                    <span className="text-gray-800">Other Withdrawal</span>
                  </label>
                </div>
              </div>

              {expenseType === 'essential' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                  >
                    <option value="">Select category...</option>
                    {ESSENTIAL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              {expenseType === 'discretionary' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                  >
                    <option value="">Select category...</option>
                    {DISCRETIONARY_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {type === 'debt_payment' && isMortgagePayment ? (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                {autoMortgageDescription || 'Mortgage payment description will be generated automatically.'}
              </div>
            </div>
          ) : (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
              placeholder={
                type === 'deposit' ? 'Extra paycheck, windfalls, etc.' :
                type === 'debt_payment' ? 'Payment details...' :
                'Expense details...'
              }
            />
          </div>
          )}

          {transactionAmount > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Previous Balance:</span>
                <span className="font-semibold text-gray-800">{CalculationService.formatCurrency(currentBalance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {type === 'deposit' ? 'Deposit:' : type === 'debt_payment' ? 'Debt Payment:' : 'Withdrawal:'}
                </span>
                <span className={`font-semibold ${type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                  {type === 'deposit' ? '+' : '-'}{CalculationService.formatCurrency(transactionAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                <span className="text-gray-800 font-semibold">New Balance:</span>
                <span className="font-bold text-gray-800">{CalculationService.formatCurrency(newBalance)}</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={`flex-1 ${
              type === 'deposit' ? 'bg-brand-green hover:bg-[#229954]' :
              type === 'debt_payment' ? 'bg-brand-blue hover:bg-[#1E6F9E]' :
              'bg-brand-red hover:bg-[#C0392B]'
            } text-white font-semibold py-3 px-6 rounded-lg transition-colors`}
          >
            {editTransaction ? 'Update' : 'Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferToHelocModal({
  onClose,
  onSuccess,
  currentBalance,
  startingBalance,
  accountId
}: {
  onClose: () => void;
  onSuccess: (message: string) => void;
  currentBalance: number;
  startingBalance: number;
  accountId: string;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(CalculationService.getTodayDateString());
  const [reason, setReason] = useState<'excess' | 'extra_payment' | 'other'>('excess');
  const [description, setDescription] = useState('');
  const [autoRecordInHeloc, setAutoRecordInHeloc] = useState(true);

  const transferAmount = parseFloat(amount) || 0;
  const newBalance = Math.max(0, currentBalance - transferAmount);

  const handleReasonChange = (newReason: 'excess' | 'extra_payment' | 'other') => {
    setReason(newReason);
    if (newReason === 'excess') {
      setDescription('Transfer excess funds to HELOC');
    } else if (newReason === 'extra_payment') {
      setDescription('Extra payment to HELOC');
    } else {
      setDescription('');
    }
  };

  const handleSubmit = () => {
    if (!transferAmount || transferAmount <= 0) {
      alert('Please enter a valid transfer amount');
      return;
    }

    if (transferAmount > currentBalance) {
      alert('Transfer amount cannot exceed current checking balance');
      return;
    }

    const checkingTransactions = StorageService.getCheckingTransactionsForAccount(accountId);

    const helocTransactionId = autoRecordInHeloc
      ? `heloc_${Date.now()}_linked`
      : undefined;

    const newCheckingTransaction: CheckingTransaction = {
      id: `checking_${Date.now()}`,
      accountId,
      date,
      type: 'transfer_to_heloc',
      amount: transferAmount,
      description: description || 'Transfer to HELOC',
      balance: 0,
      isReconciled: false,
      linkedHelocTransactionId: helocTransactionId,
      isTransferToHeloc: true
    };

    checkingTransactions.push(newCheckingTransaction);
    checkingTransactions.sort((a, b) => CalculationService.compareDateStrings(a.date, b.date));
    recalculateBalances(checkingTransactions, startingBalance);

    StorageService.saveCheckingTransactionsForAccount(accountId, checkingTransactions);

    if (autoRecordInHeloc && helocTransactionId) {
      const helocTransactions = JSON.parse(
        localStorage.getItem('novo_heloc_transactions') || '[]'
      );

      const homeEquity = JSON.parse(localStorage.getItem('novo_home_equity') || '{}');
      const helocBalance = homeEquity.helocBalance || 0;

      let currentHelocBalance = helocBalance;
      if (helocTransactions.length > 0) {
        currentHelocBalance = helocTransactions[helocTransactions.length - 1].balance;
      }

      const newHelocTransaction = {
        id: helocTransactionId,
        date,
        type: 'payment' as const,
        amount: transferAmount,
        description: 'Payment from checking account',
        balance: 0,
        linkedCheckingTransactionId: newCheckingTransaction.id,
        isTransferFromChecking: true
      };

      helocTransactions.push(newHelocTransaction);
      helocTransactions.sort((a: any, b: any) => CalculationService.compareDateStrings(a.date, b.date));

      let runningHelocBalance = helocBalance;
      helocTransactions.forEach((txn: any) => {
        if (txn.type === 'draw' || txn.type === 'interest') {
          runningHelocBalance += txn.amount;
        } else {
          runningHelocBalance -= txn.amount;
        }
        runningHelocBalance = Math.max(0, runningHelocBalance);
        txn.balance = Math.round(runningHelocBalance * 100) / 100;
      });

      localStorage.setItem('novo_heloc_transactions', JSON.stringify(helocTransactions));
    }

    const message = `✓ Transfer recorded: -${CalculationService.formatCurrency(transferAmount)}. New checking balance: ${CalculationService.formatCurrency(newBalance)}`;
    onSuccess(message);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          Transfer to HELOC
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Transfer funds from your checking account to pay down your HELOC
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Transfer Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-600">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9B59B6] focus:border-transparent"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Available: {CalculationService.formatCurrency(currentBalance)}</p>
          </div>

          <DatePicker
            label="Date"
            value={date}
            onChange={setDate}
            demoMode={JSON.parse(localStorage.getItem('novo_demo_mode') || 'false')}
          />

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Reason</label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  value="excess"
                  checked={reason === 'excess'}
                  onChange={() => handleReasonChange('excess')}
                  className="w-4 h-4 text-[#9B59B6] focus:ring-[#9B59B6]"
                />
                <span className="text-gray-800">Excess funds</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  value="extra_payment"
                  checked={reason === 'extra_payment'}
                  onChange={() => handleReasonChange('extra_payment')}
                  className="w-4 h-4 text-[#9B59B6] focus:ring-[#9B59B6]"
                />
                <span className="text-gray-800">Extra payment</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  value="other"
                  checked={reason === 'other'}
                  onChange={() => handleReasonChange('other')}
                  className="w-4 h-4 text-[#9B59B6] focus:ring-[#9B59B6]"
                />
                <span className="text-gray-800">Other</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9B59B6] focus:border-transparent"
              placeholder="Transfer details..."
            />
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRecordInHeloc}
                onChange={(e) => setAutoRecordInHeloc(e.target.checked)}
                className="w-5 h-5 text-[#9B59B6] rounded focus:ring-[#9B59B6]"
              />
              <div>
                <div className="font-semibold text-gray-800">Automatically record in HELOC Tracker</div>
                <div className="text-sm text-gray-600">Creates a matching payment in your HELOC account</div>
              </div>
            </label>
          </div>

          {transferAmount > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current Balance:</span>
                <span className="font-semibold text-gray-800">{CalculationService.formatCurrency(currentBalance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Transfer Amount:</span>
                <span className="font-semibold text-red-600">-{CalculationService.formatCurrency(transferAmount)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                <span className="text-gray-800 font-semibold">New Balance:</span>
                <span className="font-bold text-gray-800">{CalculationService.formatCurrency(newBalance)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 bg-[#9B59B6] hover:bg-[#8E44AD] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Record Transfer
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferToSavingsModal({
  onClose,
  onSuccess,
  currentBalance,
  startingBalance,
  accountId,
  sourceAccountName,
}: {
  onClose: () => void;
  onSuccess: (message: string) => void;
  currentBalance: number;
  startingBalance: number;
  accountId: string;
  sourceAccountName: string;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(CalculationService.getTodayDateString());
  const [description, setDescription] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const savingsAccounts = StorageService.getSavingsAccounts().filter(a => !('isArchived' in a && a.isArchived));

  const transferAmount = parseFloat(amount) || 0;
  const newBalance = Math.max(0, currentBalance - transferAmount);
  const selectedAccount = savingsAccounts.find(a => a.id === selectedAccountId);

  const handleSubmit = () => {
    setError(null);

    if (!accountId) {
      setError('No checking account selected. Please select a checking account and try again.');
      return;
    }
    if (!transferAmount || transferAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (transferAmount > currentBalance) {
      setError('Transfer amount cannot exceed your current checking balance.');
      return;
    }
    if (!selectedAccountId) {
      setError('Please select a savings account.');
      return;
    }
    if (!date) {
      setError('Please select a date.');
      return;
    }

    const transferDate = CalculationService.normalizeDateString(date);

    setIsSubmitting(true);

    try {
      const savingsTxId = `savings_tx_${Date.now()}`;
      const checkingTxId = `checking_${Date.now()}`;
      const checkingDescription = description.trim() || `Transfer to ${selectedAccount?.name || 'Savings'}`;
      const savingsDescription = description.trim() || `Transfer from ${sourceAccountName}`;

      const checkingTransactions = StorageService.getCheckingTransactionsForAccount(accountId);
      const newCheckingTx: CheckingTransaction = {
        id: checkingTxId,
        accountId,
        date: transferDate,
        type: 'transfer_to_savings',
        amount: transferAmount,
        description: checkingDescription,
        balance: 0,
        isReconciled: false,
        linkedSavingsTransactionId: savingsTxId,
        linkedSavingsAccountId: selectedAccountId,
      };
      checkingTransactions.push(newCheckingTx);
      checkingTransactions.sort((a, b) => CalculationService.compareDateStrings(a.date, b.date));
      recalculateBalances(checkingTransactions, startingBalance);
      StorageService.saveCheckingTransactionsForAccount(accountId, checkingTransactions);

      const allAccounts = StorageService.getSavingsAccounts();
      const accountIndex = allAccounts.findIndex(a => a.id === selectedAccountId);
      if (accountIndex === -1) {
        throw new Error('Selected savings account could not be found.');
      }

      const account = allAccounts[accountIndex];
      const newSavingsTransaction = {
        id: savingsTxId,
        date: transferDate,
        type: 'transfer_from_checking' as const,
        amount: transferAmount,
        description: savingsDescription,
        category: 'From Checking',
        balanceAfter: 0,
        linkedCheckingTransactionId: checkingTxId,
        linkedCheckingAccountId: accountId,
      };

      const { transactions: recalculated, balance: newSavingsBalance } = recalculateSavingsTransactions([
        ...(account.transactions || []),
        newSavingsTransaction,
      ]);

      allAccounts[accountIndex] = {
        ...account,
        balance: newSavingsBalance,
        transactions: recalculated,
      };
      StorageService.saveSavingsAccounts(allAccounts);

      onSuccess(
        `Transfer complete — ${CalculationService.formatCurrency(transferAmount)} moved to ${selectedAccount?.name || 'Savings'}. Checking balance: ${CalculationService.formatCurrency(newBalance)}`
      );
    } catch (err) {
      console.error('Transfer to Savings failed:', err);
      setError(err instanceof Error ? err.message : 'Transfer failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-gray-800 mb-2">Transfer to Savings</h3>
        <p className="text-sm text-gray-600 mb-4">Move money from checking into a savings account</p>

        {savingsAccounts.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-amber-800 text-sm font-medium">No savings accounts set up yet.</p>
            <p className="text-amber-700 text-xs mt-1">Add a savings account in the Savings tab first.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Select Savings Account</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
              >
                <option value="">Choose account...</option>
                {savingsAccounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} — Balance: {CalculationService.formatCurrency(a.balance)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-600">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Available: {CalculationService.formatCurrency(currentBalance)}</p>
            </div>

            <DatePicker
              label="Date"
              value={date}
              onChange={setDate}
              demoMode={JSON.parse(localStorage.getItem('novo_demo_mode') || 'false')}
            />

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
                placeholder="e.g. Monthly savings deposit"
              />
            </div>

            {transferAmount > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Checking balance after:</span>
                  <span className="font-semibold text-gray-800">{CalculationService.formatCurrency(newBalance)}</span>
                </div>
                {selectedAccount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Savings balance after:</span>
                    <span className="font-semibold text-green-700">{CalculationService.formatCurrency(selectedAccount.balance + transferAmount)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex space-x-3 mt-6">
          <button onClick={onClose} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={savingsAccounts.length === 0 || isSubmitting}
            className="flex-1 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {isSubmitting ? 'Transferring...' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferToCheckingModal({
  onClose,
  onSuccess,
  sourceAccountId,
  sourceAccountName,
  currentBalance,
  startingBalance,
  checkingAccounts,
}: {
  onClose: () => void;
  onSuccess: (message: string) => void;
  sourceAccountId: string;
  sourceAccountName: string;
  currentBalance: number;
  startingBalance: number;
  checkingAccounts: CheckingAccount[];
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(CalculationService.getTodayDateString());
  const [description, setDescription] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otherCheckingAccounts = checkingAccounts.filter(a => a.id !== sourceAccountId);
  const destinationAccount = otherCheckingAccounts.find(a => a.id === destinationAccountId);
  const destinationBalance = destinationAccountId && destinationAccount
    ? getCheckingAccountBalance(destinationAccountId, destinationAccount.startingBalance)
    : 0;

  const transferAmount = parseFloat(amount) || 0;
  const sourceBalanceAfter = Math.max(0, currentBalance - transferAmount);
  const destinationBalanceAfter = destinationAccountId
    ? Math.round((destinationBalance + transferAmount) * 100) / 100
    : destinationBalance;

  const handleSubmit = () => {
    setError(null);

    if (!sourceAccountId) {
      setError('No source checking account selected.');
      return;
    }
    if (!transferAmount || transferAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (transferAmount > currentBalance) {
      setError('Transfer amount cannot exceed your current checking balance.');
      return;
    }
    if (!destinationAccountId) {
      setError('Please select a receiving checking account.');
      return;
    }
    if (!date) {
      setError('Please select a date.');
      return;
    }

    const transferDate = CalculationService.normalizeDateString(date);
    const sharedDescription = description.trim()
      || `Transfer: ${sourceAccountName} → ${destinationAccount?.name || 'Checking'}`;

    setIsSubmitting(true);

    try {
      const sourceTxId = `checking_${Date.now()}_out`;
      const destTxId = `checking_${Date.now()}_in`;

      const sourceTransactions = StorageService.getCheckingTransactionsForAccount(sourceAccountId);
      const newSourceTx: CheckingTransaction = {
        id: sourceTxId,
        accountId: sourceAccountId,
        date: transferDate,
        type: 'transfer_to_checking',
        amount: transferAmount,
        description: sharedDescription,
        balance: 0,
        isReconciled: false,
        linkedCheckingTransactionId: destTxId,
      };
      sourceTransactions.push(newSourceTx);
      sourceTransactions.sort((a, b) => CalculationService.compareDateStrings(a.date, b.date));
      recalculateBalances(sourceTransactions, startingBalance);
      StorageService.saveCheckingTransactionsForAccount(sourceAccountId, sourceTransactions);

      const destAccount = checkingAccounts.find(a => a.id === destinationAccountId);
      if (!destAccount) {
        throw new Error('Receiving checking account could not be found.');
      }

      const destStartingBalance = destAccount.startingBalance ?? 0;
      const destTransactions = StorageService.getCheckingTransactionsForAccount(destinationAccountId);
      const newDestTx: CheckingTransaction = {
        id: destTxId,
        accountId: destinationAccountId,
        date: transferDate,
        type: 'transfer_from_checking',
        amount: transferAmount,
        description: sharedDescription,
        balance: 0,
        isReconciled: false,
        linkedCheckingTransactionId: sourceTxId,
      };
      destTransactions.push(newDestTx);
      destTransactions.sort((a, b) => CalculationService.compareDateStrings(a.date, b.date));
      recalculateBalances(destTransactions, destStartingBalance);
      StorageService.saveCheckingTransactionsForAccount(destinationAccountId, destTransactions);

      onSuccess(
        `Transfer complete — ${CalculationService.formatCurrency(transferAmount)} moved to ${destinationAccount?.name || 'Checking'}. This account balance: ${CalculationService.formatCurrency(sourceBalanceAfter)}`
      );
    } catch (err) {
      console.error('Transfer to Checking failed:', err);
      setError(err instanceof Error ? err.message : 'Transfer failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-gray-800 mb-2">Transfer to Checking</h3>
        <p className="text-sm text-gray-600 mb-4">Move money to another checking account</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Checking Account</label>
            <select
              value={destinationAccountId}
              onChange={(e) => setDestinationAccountId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
            >
              <option value="">Choose account...</option>
              {otherCheckingAccounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.bankName ? ` · ${a.bankName}` : ''} — Balance: {CalculationService.formatCurrency(getCheckingAccountBalance(a.id, a.startingBalance))}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-600">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Available: {CalculationService.formatCurrency(currentBalance)}</p>
          </div>

          <DatePicker
            label="Date"
            value={date}
            onChange={setDate}
            demoMode={JSON.parse(localStorage.getItem('novo_demo_mode') || 'false')}
          />

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
              placeholder="e.g. Move funds to joint account"
            />
          </div>

          {transferAmount > 0 && destinationAccountId && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">This account balance after:</span>
                <span className="font-semibold text-gray-800">{CalculationService.formatCurrency(sourceBalanceAfter)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Receiving account balance after:</span>
                <span className="font-semibold text-gray-800">{CalculationService.formatCurrency(destinationBalanceAfter)}</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex space-x-3 mt-6">
          <button onClick={onClose} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={otherCheckingAccounts.length === 0 || isSubmitting}
            className="flex-1 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {isSubmitting ? 'Transferring...' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function recalculateBalances(transactions: CheckingTransaction[], startingBalance: number) {
  let runningBalance = startingBalance;

  transactions.forEach(transaction => {
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
    transaction.balance = Math.round(runningBalance * 100) / 100;
  });
}
