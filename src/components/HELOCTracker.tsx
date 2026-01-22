import { useState, useMemo } from 'react';
import { TrendingUp, Plus, Download, Edit2, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import type { Debt } from '../types';

interface HELOCTransaction {
  id: string;
  date: string;
  type: 'draw' | 'payment' | 'interest';
  amount: number;
  description: string;
  debtLinked?: string;
  balance: number;
}

export function HELOCTracker() {
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<HELOCTransaction | null>(null);

  const homeEquity = StorageService.getHomeEquity();
  const hasHomeEquity = homeEquity.ownsHome && homeEquity.homeValue && homeEquity.mortgageBalance !== undefined;

  const transactions = useMemo(() => {
    const stored = localStorage.getItem('novo_heloc_transactions');
    return stored ? JSON.parse(stored) as HELOCTransaction[] : [];
  }, [showDrawModal, showPaymentModal, showInterestModal]);

  const helocLimit = homeEquity.hasHELOC && homeEquity.helocLimit
    ? homeEquity.helocLimit
    : hasHomeEquity
      ? (homeEquity.homeValue! * 0.9) - homeEquity.mortgageBalance!
      : 0;

  const currentBalance = transactions.length > 0
    ? transactions[transactions.length - 1].balance
    : (homeEquity.hasHELOC && homeEquity.helocBalance !== undefined ? homeEquity.helocBalance : 0);

  const availableCredit = helocLimit - currentBalance;
  const interestRate = homeEquity.hasHELOC && homeEquity.helocRate ? homeEquity.helocRate : 8.5;
  const monthlyInterest = currentBalance * (interestRate / 12 / 100);

  const recentPayments = transactions
    .filter(t => t.type === 'payment')
    .slice(-3)
    .map(t => t.amount);

  const averagePayment = recentPayments.length > 0
    ? recentPayments.reduce((sum, amt) => sum + amt, 0) / recentPayments.length
    : 0;

  const monthsToPayoff = averagePayment > 0
    ? Math.ceil((currentBalance / averagePayment) * 1.1)
    : 0;

  const payoffDate = monthsToPayoff > 0
    ? new Date(new Date().setMonth(new Date().getMonth() + monthsToPayoff))
    : null;

  const chartData = useMemo(() => {
    const data: { month: string; balance: number }[] = [];
    let balance = homeEquity.hasHELOC && homeEquity.helocBalance !== undefined ? homeEquity.helocBalance : 0;

    transactions.forEach((t, idx) => {
      const date = new Date(t.date);
      const monthStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (data.length === 0 || data[data.length - 1].month !== monthStr) {
        data.push({ month: monthStr, balance: t.balance });
      } else {
        data[data.length - 1].balance = t.balance;
      }
    });

    return data;
  }, [transactions, homeEquity]);

  if (!hasHomeEquity) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No HELOC Configured</h2>
          <p className="text-gray-600 mb-6">
            Go to Payment Strategies to add your home equity information first.
          </p>
          <button
            onClick={() => window.location.href = '#payment-strategies'}
            className="bg-[#2D9CDB] hover:bg-[#1E7BB5] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Go to Payment Strategies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2D5A8A] text-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">HELOC Overview</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <div className="text-sm opacity-90">Credit Limit</div>
            <div className="text-2xl font-bold">{CalculationService.formatCurrency(helocLimit)}</div>
          </div>
          <div>
            <div className="text-sm opacity-90">Current Balance</div>
            <div className="text-2xl font-bold">{CalculationService.formatCurrency(currentBalance)}</div>
          </div>
          <div>
            <div className="text-sm opacity-90">Available Credit</div>
            <div className="text-2xl font-bold text-[#27AE60]">{CalculationService.formatCurrency(availableCredit)}</div>
          </div>
          <div>
            <div className="text-sm opacity-90">Interest Rate</div>
            <div className="text-2xl font-bold">{interestRate.toFixed(2)}% APR</div>
          </div>
        </div>

        <div className="bg-white/10 rounded-lg p-4 mb-4">
          <div className="text-sm mb-2">Monthly Interest Accruing: <span className="font-bold">{CalculationService.formatCurrency(monthlyInterest)}</span></div>
          {monthsToPayoff > 0 && averagePayment > 0 && (
            <div className="text-sm">
              Payoff Projection: At <span className="font-bold">{CalculationService.formatCurrency(averagePayment)}</span>/month,
              HELOC will be paid off in <span className="font-bold">{monthsToPayoff} months</span>
              {payoffDate && <> ({payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})</>}
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>{CalculationService.formatCurrency(currentBalance)} used</span>
            <span>{CalculationService.formatCurrency(helocLimit)} limit</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3">
            <div
              className="bg-[#F2C94C] h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((currentBalance / helocLimit) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setEditingTransaction(null);
              setShowDrawModal(true);
            }}
            className="flex items-center space-x-2 bg-white text-[#1E3A5F] hover:bg-gray-100 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Record Draw</span>
          </button>
          <button
            onClick={() => {
              setEditingTransaction(null);
              setShowPaymentModal(true);
            }}
            className="flex items-center space-x-2 bg-[#27AE60] hover:bg-[#229954] font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
          <button
            onClick={() => {
              setEditingTransaction(null);
              setShowInterestModal(true);
            }}
            className="flex items-center space-x-2 bg-[#F2994A] hover:bg-[#E67E22] font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Record Interest</span>
          </button>
        </div>
      </div>

      <TransactionLedger
        transactions={transactions}
        onEdit={(transaction) => {
          setEditingTransaction(transaction);
          if (transaction.type === 'draw') setShowDrawModal(true);
          else if (transaction.type === 'payment') setShowPaymentModal(true);
          else setShowInterestModal(true);
        }}
        onDelete={(id) => {
          if (confirm('Delete this payment? All balances will be recalculated from this point forward.')) {
            const filtered = transactions.filter(t => t.id !== id);
            recalculateBalances(filtered);
            localStorage.setItem('novo_heloc_transactions', JSON.stringify(filtered));
            alert('Payment deleted. Balances updated.');
            window.location.reload();
          }
        }}
      />

      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">HELOC Balance Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => CalculationService.formatCurrency(value as number)} />
              <Line type="monotone" dataKey="balance" stroke="#2D9CDB" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {showDrawModal && (
        <RecordDrawModal
          onClose={() => {
            setShowDrawModal(false);
            setEditingTransaction(null);
          }}
          currentBalance={currentBalance}
          editTransaction={editingTransaction}
        />
      )}

      {showPaymentModal && (
        <RecordPaymentModal
          onClose={() => {
            setShowPaymentModal(false);
            setEditingTransaction(null);
          }}
          currentBalance={currentBalance}
          editTransaction={editingTransaction}
        />
      )}

      {showInterestModal && (
        <RecordInterestModal
          onClose={() => {
            setShowInterestModal(false);
            setEditingTransaction(null);
          }}
          currentBalance={currentBalance}
          interestRate={interestRate}
          editTransaction={editingTransaction}
        />
      )}
    </div>
  );
}

function TransactionLedger({
  transactions,
  onEdit,
  onDelete
}: {
  transactions: HELOCTransaction[];
  onEdit: (t: HELOCTransaction) => void;
  onDelete: (id: string) => void;
}) {
  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Balance'];
    const rows = transactions.map(t => [
      t.date,
      t.type.charAt(0).toUpperCase() + t.type.slice(1),
      t.description,
      t.type === 'payment' ? `-$${t.amount.toFixed(2)}` : `+$${t.amount.toFixed(2)}`,
      `$${t.balance.toFixed(2)}`
    ]);

    const totalDraws = transactions.filter(t => t.type === 'draw').reduce((sum, t) => sum + t.amount, 0);
    const totalPayments = transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
    const totalInterest = transactions.filter(t => t.type === 'interest').reduce((sum, t) => sum + t.amount, 0);
    const currentBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;

    rows.push([]);
    rows.push(['Summary', '', '', '', '']);
    rows.push(['Total Draws', '', '', `$${totalDraws.toFixed(2)}`, '']);
    rows.push(['Total Payments', '', '', `-$${totalPayments.toFixed(2)}`, '']);
    rows.push(['Total Interest', '', '', `$${totalInterest.toFixed(2)}`, '']);
    rows.push(['Current Balance', '', '', '', `$${currentBalance.toFixed(2)}`]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heloc_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortedTransactions = [...transactions].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">HELOC Transaction History</h3>
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
          No HELOC transactions yet. Record your first draw or payment above.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
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
                      transaction.type === 'draw' ? 'bg-red-100 text-red-800' :
                      transaction.type === 'payment' ? 'bg-green-100 text-green-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-800">{transaction.description}</td>
                  <td className={`py-3 px-4 text-right font-semibold ${
                    transaction.type === 'payment' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'payment' ? '-' : '+'}{CalculationService.formatCurrency(transaction.amount)}
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

function RecordDrawModal({
  onClose,
  currentBalance,
  editTransaction
}: {
  onClose: () => void;
  currentBalance: number;
  editTransaction: HELOCTransaction | null;
}) {
  const [amount, setAmount] = useState(editTransaction?.amount.toString() || '');
  const [date, setDate] = useState(editTransaction?.date || new Date().toISOString().split('T')[0]);
  const [purpose, setPurpose] = useState('Other');
  const [selectedDebt, setSelectedDebt] = useState(editTransaction?.debtLinked || '');
  const [description, setDescription] = useState(editTransaction?.description || '');

  const debts = StorageService.getDebts().filter(d => !d.isPaidOff);

  const handleSubmit = () => {
    const drawAmount = parseFloat(amount);
    if (!drawAmount || drawAmount <= 0) {
      alert('Please enter a valid draw amount');
      return;
    }

    const transactions: HELOCTransaction[] = JSON.parse(
      localStorage.getItem('novo_heloc_transactions') || '[]'
    );

    const newTransaction: HELOCTransaction = {
      id: editTransaction?.id || `heloc_${Date.now()}`,
      date,
      type: 'draw',
      amount: drawAmount,
      description: description || `HELOC Draw - ${purpose}`,
      debtLinked: selectedDebt || undefined,
      balance: 0
    };

    if (editTransaction) {
      const index = transactions.findIndex(t => t.id === editTransaction.id);
      transactions[index] = newTransaction;
    } else {
      transactions.push(newTransaction);
    }

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    recalculateBalances(transactions);

    localStorage.setItem('novo_heloc_transactions', JSON.stringify(transactions));

    if (selectedDebt && purpose === 'Pay Off Debt') {
      const debt = debts.find(d => d.id === selectedDebt);
      if (debt && Math.abs(debt.currentBalance - drawAmount) < 10) {
        debt.isPaidOff = true;
        debt.currentBalance = 0;
        const allDebts = StorageService.getDebts();
        const updated = allDebts.map(d => d.id === selectedDebt ? debt : d);
        localStorage.setItem('novo_debts', JSON.stringify(updated));
      }
    }

    alert(`✓ Draw recorded: +${CalculationService.formatCurrency(drawAmount)}. New HELOC balance: ${CalculationService.formatCurrency(currentBalance + drawAmount)}`);
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {editTransaction ? 'Edit' : 'Record'} HELOC Draw
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Draw Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-600">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Purpose</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
            >
              <option value="Pay Off Debt">Pay Off Debt</option>
              <option value="Home Improvement">Home Improvement</option>
              <option value="Emergency Expense">Emergency Expense</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {purpose === 'Pay Off Debt' && debts.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Which debt did this pay?</label>
              <select
                value={selectedDebt}
                onChange={(e) => setSelectedDebt(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
              >
                <option value="">Select a debt...</option>
                {debts.map(debt => (
                  <option key={debt.id} value={debt.id}>
                    {debt.accountName} - {CalculationService.formatCurrency(debt.currentBalance)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
              placeholder="Used HELOC to pay off Capital One credit card"
            />
          </div>
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
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {editTransaction ? 'Update' : 'Record'} Draw
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordPaymentModal({
  onClose,
  currentBalance,
  editTransaction
}: {
  onClose: () => void;
  currentBalance: number;
  editTransaction: HELOCTransaction | null;
}) {
  const [amount, setAmount] = useState(editTransaction?.amount.toString() || '');
  const [date, setDate] = useState(editTransaction?.date || new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(editTransaction?.description || '');

  const paymentAmount = parseFloat(amount) || 0;
  const newBalance = Math.max(0, currentBalance - paymentAmount);

  const handleSubmit = () => {
    if (!paymentAmount || paymentAmount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const transactions: HELOCTransaction[] = JSON.parse(
      localStorage.getItem('novo_heloc_transactions') || '[]'
    );

    const newTransaction: HELOCTransaction = {
      id: editTransaction?.id || `heloc_${Date.now()}`,
      date,
      type: 'payment',
      amount: paymentAmount,
      description: description || 'HELOC Payment',
      balance: 0
    };

    if (editTransaction) {
      const index = transactions.findIndex(t => t.id === editTransaction.id);
      transactions[index] = newTransaction;
    } else {
      transactions.push(newTransaction);
    }

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    recalculateBalances(transactions);

    localStorage.setItem('novo_heloc_transactions', JSON.stringify(transactions));

    alert(`✓ Payment recorded: -${CalculationService.formatCurrency(paymentAmount)}. New HELOC balance: ${CalculationService.formatCurrency(newBalance)}`);
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {editTransaction ? 'Edit' : 'Record'} HELOC Payment
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-600">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
              placeholder="Monthly cash flow deposit"
            />
          </div>

          {paymentAmount > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Previous Balance:</span>
                <span className="font-semibold text-gray-800">{CalculationService.formatCurrency(currentBalance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment:</span>
                <span className="font-semibold text-green-600">-{CalculationService.formatCurrency(paymentAmount)}</span>
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
            className="flex-1 bg-[#27AE60] hover:bg-[#229954] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {editTransaction ? 'Update' : 'Record'} Payment
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordInterestModal({
  onClose,
  currentBalance,
  interestRate,
  editTransaction
}: {
  onClose: () => void;
  currentBalance: number;
  interestRate: number;
  editTransaction: HELOCTransaction | null;
}) {
  const currentDate = new Date();
  const [month, setMonth] = useState(editTransaction?.date.substring(0, 7) || currentDate.toISOString().substring(0, 7));
  const [manualAmount, setManualAmount] = useState(editTransaction?.amount.toString() || '');
  const [useManual, setUseManual] = useState(!!editTransaction);

  const autoCalculatedInterest = currentBalance * (interestRate / 12 / 100);
  const interestAmount = useManual && manualAmount ? parseFloat(manualAmount) : autoCalculatedInterest;

  const lastDayOfMonth = new Date(month + '-01');
  lastDayOfMonth.setMonth(lastDayOfMonth.getMonth() + 1);
  lastDayOfMonth.setDate(0);
  const date = editTransaction?.date || lastDayOfMonth.toISOString().split('T')[0];

  const handleSubmit = () => {
    if (!interestAmount || interestAmount <= 0) {
      alert('Please enter a valid interest amount');
      return;
    }

    const transactions: HELOCTransaction[] = JSON.parse(
      localStorage.getItem('novo_heloc_transactions') || '[]'
    );

    const newTransaction: HELOCTransaction = {
      id: editTransaction?.id || `heloc_${Date.now()}`,
      date,
      type: 'interest',
      amount: interestAmount,
      description: `Monthly interest for ${new Date(month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      balance: 0
    };

    if (editTransaction) {
      const index = transactions.findIndex(t => t.id === editTransaction.id);
      transactions[index] = newTransaction;
    } else {
      transactions.push(newTransaction);
    }

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    recalculateBalances(transactions);

    localStorage.setItem('novo_heloc_transactions', JSON.stringify(transactions));

    alert(`✓ Interest recorded: +${CalculationService.formatCurrency(interestAmount)}. New HELOC balance: ${CalculationService.formatCurrency(currentBalance + interestAmount)}`);
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {editTransaction ? 'Edit' : 'Record'} Interest Charge
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">For the month of:</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current Balance:</span>
              <span className="font-semibold text-gray-800">{CalculationService.formatCurrency(currentBalance)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Interest Rate:</span>
              <span className="font-semibold text-gray-800">{interestRate.toFixed(2)}% APR</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
              <span className="text-gray-800 font-semibold">Auto-calculated Interest:</span>
              <span className="font-bold text-gray-800">{CalculationService.formatCurrency(autoCalculatedInterest)}</span>
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2 text-sm text-gray-700 mb-2">
              <input
                type="checkbox"
                checked={useManual}
                onChange={(e) => setUseManual(e.target.checked)}
                className="rounded"
              />
              <span>Manual override (enter exact amount from statement)</span>
            </label>
            {useManual && (
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-600">$</span>
                <input
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            )}
          </div>
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
            className="flex-1 bg-[#F2994A] hover:bg-[#E67E22] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {editTransaction ? 'Update' : 'Record'} Interest
          </button>
        </div>
      </div>
    </div>
  );
}

function recalculateBalances(transactions: HELOCTransaction[]) {
  const homeEquity = StorageService.getHomeEquity();
  let runningBalance = homeEquity.hasHELOC && homeEquity.helocBalance !== undefined
    ? homeEquity.helocBalance
    : 0;

  transactions.forEach(transaction => {
    if (transaction.type === 'draw' || transaction.type === 'interest') {
      runningBalance += transaction.amount;
    } else if (transaction.type === 'payment') {
      runningBalance -= transaction.amount;
    }
    runningBalance = Math.max(0, runningBalance);
    transaction.balance = Math.round(runningBalance * 100) / 100;
  });
}
