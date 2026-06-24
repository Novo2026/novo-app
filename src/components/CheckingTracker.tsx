import { useState, useMemo, useEffect } from 'react';
import { Plus, Download, Upload, CreditCard as Edit2, X, DollarSign, CreditCard, TrendingUp, TrendingDown, Link2, ArrowRightLeft, PiggyBank, CheckCircle2, Building2 } from 'lucide-react';
import StatementUploadModal from './StatementUploadModal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CalculationService } from '../services/calculations';
import { StorageService } from '../services/storage';
import DatePicker from './DatePicker';
import PaymentLoggingGuidance from './PaymentLoggingGuidance';
import type { CheckingAccount, CheckingTransaction, UnifiedPayment } from '../types';
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

  const chartData = useMemo(() => {
    const data: { month: string; balance: number }[] = [];

    transactions.forEach((t) => {
      const date = CalculationService.parseLocalDate(t.date);
      const monthStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (data.length === 0 || data[data.length - 1].month !== monthStr) {
        data.push({ month: monthStr, balance: t.balance });
      } else {
        data[data.length - 1].balance = t.balance;
      }
    });

    return data;
  }, [transactions]);

  const monthlySummary = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const currentMonthTransactions = transactions.filter(t => {
      const txDate = CalculationService.parseLocalDate(t.date);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    });

    const income = currentMonthTransactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);

    const essentialExpenses = currentMonthTransactions
      .filter(t => t.type === 'withdrawal' && t.category === 'Essential Expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const discretionaryExpenses = currentMonthTransactions
      .filter(t => t.type === 'withdrawal' && t.category === 'Discretionary Expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const debtPayments = currentMonthTransactions
      .filter(t => t.type === 'debt_payment')
      .reduce((sum, t) => sum + t.amount, 0);

    const otherWithdrawals = currentMonthTransactions
      .filter(t => t.type === 'withdrawal' && !t.category)
      .reduce((sum, t) => sum + t.amount, 0);

    const netChange = income - essentialExpenses - discretionaryExpenses - debtPayments - otherWithdrawals;

    return {
      income,
      essentialExpenses,
      discretionaryExpenses,
      debtPayments,
      otherWithdrawals,
      netChange
    };
  }, [transactions]);

  const openModal = (type: 'deposit' | 'withdrawal' | 'debt_payment', transaction: CheckingTransaction | null = null) => {
    setModalType(type);
    setEditingTransaction(transaction);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {accounts.map(account => (
          <button
            key={account.id}
            onClick={() => selectCheckingAccount(account.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
              selectedAccountId === account.id
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-white text-[#1E3A5F] border-[#e8d8c4] hover:border-[#1E3A5F]/40'
            }`}
          >
            {account.accountType === 'checking' ? '🏦' : '💰'} {account.name}
            {account.bankName && <span className="opacity-60 text-xs">· {account.bankName}</span>}
          </button>
        ))}
        <button
          onClick={() => setShowAddAccount(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-gray-500 border border-dashed border-gray-300 hover:border-[#FF6B35] hover:text-[#FF6B35] transition-all"
        >
          + Add Account
        </button>
      </div>

      {successMessage && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-lg shadow-md animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-700 hover:text-green-900 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-[#27AE60] to-[#229954] text-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Checking Account Overview</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <div className="text-sm opacity-90">Current Balance</div>
            <div className="text-2xl font-bold">{CalculationService.formatCurrency(currentBalance)}</div>
          </div>
          <div>
            <div className="text-sm opacity-90">Starting Balance</div>
            <div className="text-2xl font-bold">{CalculationService.formatCurrency(startingBalance)}</div>
          </div>
          <div>
            <div className="text-sm opacity-90">Average Deposit</div>
            <div className="text-2xl font-bold">{CalculationService.formatCurrency(averageDeposit)}</div>
          </div>
        </div>

        {selectedAccount && (
          <div className="mb-4">
            <button
              onClick={() => setShowReconcilePanel(true)}
              className="flex items-center gap-2 text-sm font-semibold py-2 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              {accounts.find(a => a.id === selectedAccountId)?.lastReconciledAt
                ? `Reconciled ${new Date(accounts.find(a => a.id === selectedAccountId)!.lastReconciledAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — Review Again`
                : 'Reconcile Account'}
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => openModal('deposit')}
            className="flex items-center space-x-2 bg-white text-[#27AE60] hover:bg-gray-100 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Record Deposit</span>
          </button>
          <button
            onClick={() => openModal('withdrawal')}
            className="flex items-center space-x-2 bg-[#EB5757] hover:bg-[#C0392B] font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Record Withdrawal</span>
          </button>
          <button
            onClick={() => openModal('debt_payment')}
            className="flex items-center space-x-2 bg-[#2D9CDB] hover:bg-[#1E6F9E] font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            <span>Record Debt Payment</span>
          </button>
          <button
            onClick={() => setShowStatementUpload(true)}
            className="flex items-center space-x-2 bg-white text-[#1E3A5F] border-2 border-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Import Statement</span>
          </button>
          <button
            onClick={() => setShowSavingsTransferModal(true)}
            className="flex items-center space-x-2 bg-[#F59E0B] hover:bg-[#D97706] text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <PiggyBank className="w-4 h-4" />
            <span>Transfer to Savings</span>
          </button>
          <button
            onClick={() => canTransferToChecking && setShowCheckingTransferModal(true)}
            disabled={!canTransferToChecking}
            title={!canTransferToChecking ? 'Add another checking account to enable transfers between accounts' : undefined}
            className={`flex items-center space-x-2 font-semibold py-2 px-4 rounded-lg transition-colors ${
              canTransferToChecking
                ? 'bg-[#F59E0B] hover:bg-[#D97706] text-white'
                : 'bg-[#F59E0B]/40 text-white/80 cursor-not-allowed'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Transfer to Checking</span>
          </button>
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center space-x-2 bg-[#9B59B6] hover:bg-[#8E44AD] font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Transfer to HELOC</span>
          </button>
          <button
            onClick={() => {
              const balance = prompt('Enter your starting balance:', startingBalance.toString());
              if (balance !== null && selectedAccountId) {
                const updatedAccounts = StorageService.getCheckingAccounts().map(a =>
                  a.id === selectedAccountId
                    ? { ...a, startingBalance: parseFloat(balance) || 0 }
                    : a
                );
                StorageService.saveCheckingAccounts(updatedAccounts);
                setAccounts(updatedAccounts);
                setSuccessMessage(`✓ Starting balance updated to ${CalculationService.formatCurrency(parseFloat(balance))}`);
                setRefreshTrigger(prev => prev + 1);
                setTimeout(() => setSuccessMessage(null), 5000);
              }
            }}
            className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            <span>Set Starting Balance</span>
          </button>
        </div>
      </div>

      <MonthlySummary summary={monthlySummary} />

      <TransactionLedger
        transactions={transactions}
        onEdit={(transaction) => openModal(transaction.type as any, transaction)}
        onDelete={(id) => {
          const transaction = transactions.find(t => t.id === id);
          if (!transaction) return;

          if (transaction.linkedHelocTransactionId) {
            const choice = confirm(
              'This transaction is linked to a HELOC transaction.\n\n' +
              'Click OK to delete both transactions, or Cancel to delete only this one.'
            );

            const filtered = transactions.filter(t => t.id !== id);
            recalculateBalances(filtered, startingBalance);
            StorageService.saveCheckingTransactionsForAccount(selectedAccountId, filtered);

            if (choice) {
              const helocTransactions = JSON.parse(localStorage.getItem('novo_heloc_transactions') || '[]');
              const filteredHeloc = helocTransactions.filter((t: any) => t.id !== transaction.linkedHelocTransactionId);

              const homeEquity = JSON.parse(localStorage.getItem('novo_home_equity') || '{}');
              const helocBalance = homeEquity.helocBalance || 0;
              let runningBalance = helocBalance;
              filteredHeloc.forEach((txn: any) => {
                if (txn.type === 'draw' || txn.type === 'interest') {
                  runningBalance += txn.amount;
                } else {
                  runningBalance -= txn.amount;
                }
                runningBalance = Math.max(0, runningBalance);
                txn.balance = Math.round(runningBalance * 100) / 100;
              });

              localStorage.setItem('novo_heloc_transactions', JSON.stringify(filteredHeloc));
              setSuccessMessage('✓ Both linked transactions deleted. Balances updated.');
            } else {
              setSuccessMessage('✓ Checking transaction deleted. HELOC transaction kept.');
            }
          } else {
            if (confirm('Delete this transaction? All balances will be recalculated from this point forward.')) {
              const filtered = transactions.filter(t => t.id !== id);
              recalculateBalances(filtered, startingBalance);
              StorageService.saveCheckingTransactionsForAccount(selectedAccountId, filtered);
              setSuccessMessage('✓ Transaction deleted. Balances updated.');
            }
          }

          setRefreshTrigger(prev => prev + 1);
          onDataUpdate?.();
          setTimeout(() => setSuccessMessage(null), 5000);
        }}
      />

      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Checking Balance Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => CalculationService.formatCurrency(value as number)} />
              <Line type="monotone" dataKey="balance" stroke="#27AE60" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

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

function MonthlySummary({ summary }: { summary: {
  income: number;
  essentialExpenses: number;
  discretionaryExpenses: number;
  debtPayments: number;
  otherWithdrawals: number;
  netChange: number;
}}) {
  const now = new Date();
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">This Month's Summary</h3>
        <span className="text-sm text-gray-600">{monthName}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-green-50 border-l-4 border-green-500 rounded-r-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-1">Income Deposited</div>
              <div className="text-2xl font-bold text-green-700">
                {CalculationService.formatCurrency(summary.income)}
              </div>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-orange-50 border-l-4 border-orange-500 rounded-r-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Essential Expenses</div>
          <div className="text-xl font-bold text-orange-700">
            {CalculationService.formatCurrency(summary.essentialExpenses)}
          </div>
        </div>

        <div className="bg-purple-50 border-l-4 border-purple-500 rounded-r-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Discretionary Expenses</div>
          <div className="text-xl font-bold text-purple-700">
            {CalculationService.formatCurrency(summary.discretionaryExpenses)}
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Debt Payments</div>
          <div className="text-xl font-bold text-blue-700">
            {CalculationService.formatCurrency(summary.debtPayments)}
          </div>
        </div>

        <div className="bg-gray-50 border-l-4 border-gray-400 rounded-r-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Other Withdrawals</div>
          <div className="text-xl font-bold text-gray-700">
            {CalculationService.formatCurrency(summary.otherWithdrawals)}
          </div>
        </div>

        <div className={`${summary.netChange >= 0 ? 'bg-green-50 border-green-600' : 'bg-red-50 border-red-600'} border-l-4 rounded-r-lg p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-1">Net Change</div>
              <div className={`text-2xl font-bold ${summary.netChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {summary.netChange >= 0 ? '+' : ''}{CalculationService.formatCurrency(summary.netChange)}
              </div>
            </div>
            {summary.netChange >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-600" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">Checking Transaction History</h3>
        {transactions.length > 0 && (
          <button
            onClick={exportCSV}
            className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      {transactions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No checking transactions yet. Record your first deposit or withdrawal above.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Amount</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Balance</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-800">
                    {CalculationService.formatLocalDateShort(transaction.date)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        transaction.type === 'deposit' ? 'bg-green-100 text-green-800' :
                        transaction.type === 'debt_payment' ? 'bg-blue-100 text-blue-800' :
                        transaction.type === 'transfer_to_savings' ? 'bg-yellow-100 text-yellow-800' :
                        transaction.type === 'transfer_from_savings' ? 'bg-yellow-100 text-yellow-800' :
                        transaction.type === 'transfer_to_checking' ? 'bg-sky-100 text-sky-800' :
                        transaction.type === 'transfer_from_checking' ? 'bg-sky-100 text-sky-800' :
                        transaction.type === 'transfer_from_heloc' ? 'bg-purple-100 text-purple-800' :
                        transaction.type === 'transfer_to_heloc' ? 'bg-purple-100 text-purple-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {transaction.type === 'debt_payment' ? 'Debt Payment' :
                         transaction.type === 'transfer_to_savings' ? 'To Savings' :
                         transaction.type === 'transfer_from_savings' ? 'From Savings' :
                         transaction.type === 'transfer_to_checking' ? 'To Checking' :
                         transaction.type === 'transfer_from_checking' ? 'From Checking' :
                         transaction.type === 'transfer_from_heloc' ? 'From HELOC' :
                         transaction.type === 'transfer_to_heloc' ? 'To HELOC' :
                         transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                      </span>
                      {(transaction.linkedHelocTransactionId) && (
                        <div className="relative group">
                          <Link2 className="w-4 h-4 text-purple-600" />
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            Linked to HELOC transaction
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {transaction.subcategory || transaction.category || '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-800">{transaction.description}</td>
                  <td className={`py-3 px-4 text-right font-semibold ${
                    transaction.type === 'deposit' || transaction.type === 'transfer_from_heloc' || transaction.type === 'transfer_from_checking' || transaction.type === 'transfer_from_savings' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'deposit' || transaction.type === 'transfer_from_heloc' || transaction.type === 'transfer_from_checking' || transaction.type === 'transfer_from_savings' ? '+' : '-'}{CalculationService.formatCurrency(transaction.amount)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-800">
                    {CalculationService.formatCurrency(transaction.balance)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onEdit(transaction)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(transaction.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

  const selectedDebtObj = debts.find(d => d.id === selectedDebt);

  const transactionAmount = parseFloat(amount) || 0;
  const newBalance = type === 'deposit'
    ? currentBalance + transactionAmount
    : Math.max(0, currentBalance - transactionAmount);

  const handleSubmit = () => {
    if (!transactionAmount || transactionAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (type === 'debt_payment' && !selectedDebt) {
      alert('Please select a debt to pay');
      return;
    }

    const transactions: CheckingTransaction[] = StorageService.getCheckingTransactionsForAccount(accountId);

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
    } else if (type === 'debt_payment') {
      finalDescription = description || `Paid ${selectedDebtObj?.accountName}`;
    } else if (type === 'deposit' && !finalDescription) {
      finalDescription = 'Cash Flow Deposit';
    }

    const newTransaction: CheckingTransaction = {
      id: editTransaction?.id || `checking_${Date.now()}`,
      accountId,
      date,
      type: editTransaction?.type || type,
      amount: transactionAmount,
      description: finalDescription,
      balance: 0,
      category,
      subcategory: finalSubcategory,
      isReconciled: editTransaction?.isReconciled ?? false,
      reconciledAt: editTransaction?.reconciledAt,
      debtId: type === 'debt_payment' ? selectedDebt : undefined,
      debtName: type === 'debt_payment' ? selectedDebtObj?.accountName : undefined
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

    if (type === 'debt_payment' && selectedDebtObj) {
      const allDebts = StorageService.getDebts();
      const debtIndex = allDebts.findIndex(d => d.id === selectedDebt);

      if (debtIndex !== -1) {
        const debt = allDebts[debtIndex];

        const calculation = debt.isAmortized
          ? CalculationService.calculateAmortizedPayment(debt, transactionAmount)
          : CalculationService.calculatePayment(debt.currentBalance, debt.interestRate, transactionAmount);

        const isPaidOff = calculation.newBalance === 0;

        debt.currentBalance = calculation.newBalance;

        if (isPaidOff && !debt.isPaidOff) {
          debt.isPaidOff = true;
          debt.paidOffDate = date;
        }

        const unifiedPayment: UnifiedPayment = {
          id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          date,
          debtId: debt.id,
          debtName: debt.accountName,
          amount: transactionAmount,
          source: 'checking',
          interestCharged: calculation.interestCharged,
          principalPaid: calculation.principalPaid,
          previousBalance: debt.currentBalance,
          newBalance: calculation.newBalance,
          description: finalDescription,
          isPaidOff,
        };

        StorageService.addUnifiedPayment(unifiedPayment);
        StorageService.saveDebts(allDebts);
      }
    }

    const typeLabel = type === 'deposit' ? 'Deposit' : type === 'debt_payment' ? 'Debt Payment' : 'Withdrawal';
    const message = `✓ ${typeLabel} recorded: ${type === 'deposit' ? '+' : '-'}${CalculationService.formatCurrency(transactionAmount)}. New balance: ${CalculationService.formatCurrency(newBalance)}`;
    onSuccess(message);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
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
                    setAmount(debt.minimumPayment.toString());
                    setDescription(`Paid ${debt.accountName}`);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
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

          {type === 'debt_payment' && selectedDebtObj && (
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#27AE60] focus:border-transparent"
                placeholder="0.00"
                step="0.01"
              />
            </div>
          </div>

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
                      className="w-4 h-4 text-[#27AE60] focus:ring-[#27AE60]"
                    />
                    <span className="text-gray-800">Essential Expense</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      value="discretionary"
                      checked={expenseType === 'discretionary'}
                      onChange={(e) => setExpenseType(e.target.value as 'discretionary')}
                      className="w-4 h-4 text-[#27AE60] focus:ring-[#27AE60]"
                    />
                    <span className="text-gray-800">Discretionary Expense</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      value="other"
                      checked={expenseType === 'other'}
                      onChange={(e) => setExpenseType(e.target.value as 'other')}
                      className="w-4 h-4 text-[#27AE60] focus:ring-[#27AE60]"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#27AE60] focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#27AE60] focus:border-transparent"
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

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#27AE60] focus:border-transparent"
              placeholder={
                type === 'deposit' ? 'Extra paycheck, windfalls, etc.' :
                type === 'debt_payment' ? 'Payment details...' :
                'Expense details...'
              }
            />
          </div>

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
              type === 'deposit' ? 'bg-[#27AE60] hover:bg-[#229954]' :
              type === 'debt_payment' ? 'bg-[#2D9CDB] hover:bg-[#1E6F9E]' :
              'bg-[#EB5757] hover:bg-[#C0392B]'
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
  const destinationBalance = destinationAccountId
    ? getCheckingAccountBalance(destinationAccountId, checkingAccounts)
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
                  {a.name}{a.bankName ? ` · ${a.bankName}` : ''} — Balance: {CalculationService.formatCurrency(getCheckingAccountBalance(a.id, checkingAccounts))}
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

function getCheckingAccountBalance(accountId: string, accounts: CheckingAccount[]): number {
  const account = accounts.find(a => a.id === accountId);
  const txs = StorageService.getCheckingTransactionsForAccount(accountId);
  const starting = account?.startingBalance ?? 0;
  return txs.length > 0 ? txs[txs.length - 1].balance : starting;
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
