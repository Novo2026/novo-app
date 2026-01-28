import { useState, useMemo } from 'react';
import { Plus, Download, Edit2, X, DollarSign, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CalculationService } from '../services/calculations';
import { StorageService } from '../services/storage';

interface CheckingTransaction {
  id: string;
  date: string;
  type: 'deposit' | 'withdrawal' | 'debt_payment';
  amount: number;
  description: string;
  balance: number;
  category?: string;
  subcategory?: string;
  debtId?: string;
  debtName?: string;
}

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

export function CheckingTracker() {
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<CheckingTransaction | null>(null);
  const [modalType, setModalType] = useState<'deposit' | 'withdrawal' | 'debt_payment'>('deposit');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const transactions = useMemo(() => {
    const stored = localStorage.getItem('novo_checking_transactions');
    return stored ? JSON.parse(stored) as CheckingTransaction[] : [];
  }, [refreshTrigger]);

  const startingBalance = parseFloat(localStorage.getItem('novo_checking_starting_balance') || '0');
  const currentBalance = transactions.length > 0
    ? transactions[transactions.length - 1].balance
    : startingBalance;

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
      const date = new Date(t.date);
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
      const txDate = new Date(t.date);
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
            onClick={() => {
              const balance = prompt('Enter your starting balance:', startingBalance.toString());
              if (balance !== null) {
                localStorage.setItem('novo_checking_starting_balance', balance);
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
        onEdit={(transaction) => openModal(transaction.type, transaction)}
        onDelete={(id) => {
          if (confirm('Delete this transaction? All balances will be recalculated from this point forward.')) {
            const filtered = transactions.filter(t => t.id !== id);
            recalculateBalances(filtered, startingBalance);
            localStorage.setItem('novo_checking_transactions', JSON.stringify(filtered));
            setSuccessMessage('✓ Transaction deleted. Balances updated.');
            setRefreshTrigger(prev => prev + 1);
            setTimeout(() => setSuccessMessage(null), 5000);
          }
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
            setTimeout(() => setSuccessMessage(null), 5000);
          }}
          currentBalance={currentBalance}
          startingBalance={startingBalance}
          editTransaction={editingTransaction}
          type={modalType}
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
    a.download = `checking_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortedTransactions = [...transactions].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
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
                    {new Date(transaction.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      transaction.type === 'deposit' ? 'bg-green-100 text-green-800' :
                      transaction.type === 'debt_payment' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {transaction.type === 'debt_payment' ? 'Debt Payment' :
                       transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {transaction.subcategory || transaction.category || '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-800">{transaction.description}</td>
                  <td className={`py-3 px-4 text-right font-semibold ${
                    transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'deposit' ? '+' : '-'}{CalculationService.formatCurrency(transaction.amount)}
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
  editTransaction,
  type
}: {
  onClose: () => void;
  onSuccess: (message: string) => void;
  currentBalance: number;
  startingBalance: number;
  editTransaction: CheckingTransaction | null;
  type: 'deposit' | 'withdrawal' | 'debt_payment';
}) {
  const debts = StorageService.getDebts().filter(d => !d.isPaidOff);

  const [amount, setAmount] = useState(editTransaction?.amount.toString() || '');
  const [date, setDate] = useState(editTransaction?.date || new Date().toISOString().split('T')[0]);
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

    const transactions: CheckingTransaction[] = JSON.parse(
      localStorage.getItem('novo_checking_transactions') || '[]'
    );

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
      date,
      type: editTransaction?.type || type,
      amount: transactionAmount,
      description: finalDescription,
      balance: 0,
      category,
      subcategory: finalSubcategory,
      debtId: type === 'debt_payment' ? selectedDebt : undefined,
      debtName: type === 'debt_payment' ? selectedDebtObj?.accountName : undefined
    };

    if (editTransaction) {
      const index = transactions.findIndex(t => t.id === editTransaction.id);
      transactions[index] = newTransaction;
    } else {
      transactions.push(newTransaction);
    }

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    recalculateBalances(transactions, startingBalance);

    localStorage.setItem('novo_checking_transactions', JSON.stringify(transactions));

    if (type === 'debt_payment' && selectedDebtObj) {
      const allDebts = StorageService.getDebts();
      const debtIndex = allDebts.findIndex(d => d.id === selectedDebt);

      if (debtIndex !== -1) {
        const debt = allDebts[debtIndex];
        const previousBalance = debt.currentBalance;
        const interestCharged = 0;
        const principalPaid = transactionAmount;
        const newDebtBalance = Math.max(0, previousBalance - transactionAmount);

        debt.currentBalance = newDebtBalance;

        if (newDebtBalance === 0 && !debt.isPaidOff) {
          debt.isPaidOff = true;
          debt.paidOffDate = date;
        }

        const debtTransaction = {
          id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          debtId: debt.id,
          debtName: debt.accountName,
          date,
          type: 'payment' as const,
          amount: transactionAmount,
          previousBalance,
          interestCharged,
          principalPaid,
          newBalance: newDebtBalance,
          notes: `Paid from checking account: ${finalDescription}`
        };

        const allTransactions = StorageService.getTransactions();
        allTransactions.push(debtTransaction);

        StorageService.saveDebts(allDebts);
        StorageService.saveTransactions(allTransactions);
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

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#27AE60] focus:border-transparent"
            />
          </div>

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

function recalculateBalances(transactions: CheckingTransaction[], startingBalance: number) {
  let runningBalance = startingBalance;

  transactions.forEach(transaction => {
    if (transaction.type === 'deposit') {
      runningBalance += transaction.amount;
    } else {
      runningBalance -= transaction.amount;
    }
    runningBalance = Math.max(0, runningBalance);
    transaction.balance = Math.round(runningBalance * 100) / 100;
  });
}
