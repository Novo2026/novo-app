import { Download, Filter, Edit2, X } from 'lucide-react';
import { useState } from 'react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import EditPaymentModal from './EditPaymentModal';
import type { Transaction } from '../types';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ProgressReportsProps {
  onDataUpdate: () => void;
}

export default function ProgressReports({ onDataUpdate }: ProgressReportsProps) {
  const [filterDebtId, setFilterDebtId] = useState<string>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleDeletePayment = (transaction: Transaction) => {
    if (!confirm('Delete this payment? All balances will be recalculated from this point forward.')) {
      return;
    }

    const allTransactions = StorageService.getTransactions();
    const filtered = allTransactions.filter(t => t.id !== transaction.id);

    filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    recalculateAllBalances(filtered);

    StorageService.saveTransactions(filtered);

    alert('Payment deleted. Balances updated.');
    onDataUpdate();
  };

  const debts = StorageService.getDebts();
  const allTransactions = StorageService.getTransactions();
  const strategyResult = StorageService.getStrategyResult();

  const transactions = filterDebtId === 'all'
    ? allTransactions
    : allTransactions.filter(t => t.debtId === filterDebtId);

  const metrics = CalculationService.calculateTotalDebtMetrics(debts, allTransactions);

  const paymentTransactions = transactions.filter(t => t.type === 'payment');

  const projectedData = strategyResult?.monthlyProjections.map((proj, index) => ({
    month: `Mo ${proj.month}`,
    projected: proj.totalBalance,
    actual: index === 0 ? metrics.totalCurrentBalance : null,
  })) || [];

  const monthlyPaymentsData = paymentTransactions.reduce((acc, t) => {
    const monthKey = new Date(t.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    if (!acc[monthKey]) {
      acc[monthKey] = { month: monthKey, minimum: 0, extra: 0 };
    }

    const debt = debts.find(d => d.id === t.debtId);
    if (debt) {
      if (t.isExtraPayment) {
        acc[monthKey].extra += t.amount - debt.minimumPayment;
        acc[monthKey].minimum += debt.minimumPayment;
      } else {
        acc[monthKey].minimum += t.amount;
      }
    }

    return acc;
  }, {} as Record<string, { month: string; minimum: number; extra: number }>);

  const monthlyPaymentsArray = Object.values(monthlyPaymentsData);

  const totalInterest = paymentTransactions.reduce((sum, t) => sum + t.interestCharged, 0);
  const totalPrincipal = paymentTransactions.reduce((sum, t) => sum + t.principalPaid, 0);

  const interestVsPrincipalData = [
    { name: 'Interest Paid', value: totalInterest, color: '#EB5757' },
    { name: 'Principal Paid', value: totalPrincipal, color: '#27AE60' },
  ];

  const handleExportHistory = () => {
    const headers = ['Date', 'Debt', 'Type', 'Previous Balance', 'Interest', 'Principal', 'Payment/Charge', 'New Balance', 'Notes'];
    const rows = transactions.map(t => [
      t.date,
      t.debtName,
      t.type,
      t.previousBalance.toFixed(2),
      t.interestCharged.toFixed(2),
      t.principalPaid.toFixed(2),
      t.amount.toFixed(2),
      t.newBalance.toFixed(2),
      t.notes || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payment_history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-xl text-gray-600">No payment history yet. Log your first payment to see progress reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Progress Reports</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-2">Total Paid Off</p>
          <p className="text-3xl font-bold text-[#27AE60]">
            {CalculationService.formatCurrency(metrics.totalPaidOff)}
          </p>
          <p className="text-sm text-gray-500 mt-1">{metrics.progressPercentage.toFixed(1)}% complete</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-2">Remaining Debt</p>
          <p className="text-3xl font-bold text-[#1E3A5F]">
            {CalculationService.formatCurrency(metrics.totalCurrentBalance)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-2">Total Payments</p>
          <p className="text-3xl font-bold text-[#2D9CDB]">
            {paymentTransactions.length}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-2">Debts Paid Off</p>
          <p className="text-3xl font-bold text-[#27AE60]">
            {metrics.paidOffDebts.length}
          </p>
          <p className="text-sm text-gray-500 mt-1">of {debts.length} total</p>
        </div>
      </div>

      {strategyResult && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Projected vs. Actual Progress</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={projectedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => CalculationService.formatCurrency(value)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="projected"
                stroke="#9CA3AF"
                strokeWidth={2}
                name="Projected Balance"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#2D9CDB"
                strokeWidth={3}
                name="Actual Balance"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {monthlyPaymentsArray.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Monthly Payments</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyPaymentsArray}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => CalculationService.formatCurrency(value)} />
              <Legend />
              <Bar dataKey="minimum" stackId="a" fill="#9CA3AF" name="Minimum Payments" />
              <Bar dataKey="extra" stackId="a" fill="#27AE60" name="Extra Payments" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {totalInterest > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Interest vs. Principal</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={interestVsPrincipalData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {interestVsPrincipalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => CalculationService.formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Interest Paid</p>
              <p className="text-2xl font-bold text-[#EB5757]">
                {CalculationService.formatCurrency(totalInterest)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Principal Paid</p>
              <p className="text-2xl font-bold text-[#27AE60]">
                {CalculationService.formatCurrency(totalPrincipal)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">Payment History</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterDebtId}
                onChange={(e) => setFilterDebtId(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
              >
                <option value="all">All Debts</option>
                {debts.filter(debt => debt.category !== 'HELOC').map(debt => (
                  <option key={debt.id} value={debt.id}>{debt.accountName}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleExportHistory}
              className="flex items-center space-x-2 text-[#2D9CDB] hover:text-[#1E8BBD] text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Debt</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Type</th>
                <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Interest</th>
                <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Principal</th>
                <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Payment</th>
                <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">New Balance</th>
                <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...transactions].reverse().map(t => (
                <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-2 text-sm text-gray-800">
                    {CalculationService.formatDate(t.date)}
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-800">
                    {t.debtName}
                    {debts.find(d => d.id === t.debtId)?.isAmortized && (
                      <div className="text-xs text-emerald-600 italic mt-0.5">Based on original loan terms</div>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      t.type === 'payment' ? 'bg-[#2D9CDB]/20 text-[#2D9CDB]' : 'bg-[#F2C94C]/20 text-[#F2C94C]'
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-sm text-right text-red-600 font-mono">
                    {t.type === 'payment' ? CalculationService.formatCurrencyDetailed(t.interestCharged) : '-'}
                  </td>
                  <td className="py-3 px-2 text-sm text-right text-[#27AE60] font-mono">
                    {t.type === 'payment' ? CalculationService.formatCurrencyDetailed(t.principalPaid) : '-'}
                  </td>
                  <td className={`py-3 px-2 text-sm text-right font-mono font-semibold ${
                    t.type === 'payment' ? 'text-[#2D9CDB]' : 'text-red-600'
                  }`}>
                    {t.type === 'payment' ? '-' : '+'}
                    {CalculationService.formatCurrencyDetailed(t.amount)}
                  </td>
                  <td className="py-3 px-2 text-sm text-right text-gray-800 font-mono font-semibold">
                    {CalculationService.formatCurrencyDetailed(t.newBalance)}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {t.type === 'payment' && (
                      <div className="flex justify-end items-center space-x-2">
                        <button
                          onClick={() => setEditingTransaction(t)}
                          className="inline-flex items-center space-x-1 text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors text-xs font-semibold"
                          title="Edit Payment"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeletePayment(t)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete Payment"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingTransaction && (
        <EditPaymentModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSuccess={() => {
            setEditingTransaction(null);
            onDataUpdate();
          }}
        />
      )}
    </div>
  );
}

function recalculateAllBalances(transactions: Transaction[]) {
  const debts = StorageService.getDebts();
  const debtBalances: Record<string, number> = {};

  debts.forEach(debt => {
    debtBalances[debt.id] = debt.startingBalance;
  });

  transactions.forEach(transaction => {
    const debt = debts.find(d => d.id === transaction.debtId);
    if (!debt) return;

    const previousBalance = debtBalances[transaction.debtId];

    if (transaction.type === 'payment') {
      const calculation = debt.isAmortized
        ? CalculationService.calculateAmortizedPayment(
            { ...debt, currentBalance: previousBalance },
            transaction.amount
          )
        : CalculationService.calculatePayment(
            previousBalance,
            debt.interestRate,
            transaction.amount
          );

      transaction.previousBalance = previousBalance;
      transaction.interestCharged = calculation.interestCharged;
      transaction.principalPaid = calculation.principalPaid;
      transaction.newBalance = calculation.newBalance;

      debtBalances[transaction.debtId] = calculation.newBalance;
    } else if (transaction.type === 'charge') {
      transaction.previousBalance = previousBalance;
      transaction.interestCharged = 0;
      transaction.principalPaid = 0;
      transaction.newBalance = previousBalance + transaction.amount;

      debtBalances[transaction.debtId] = transaction.newBalance;
    }
  });

  const updatedDebts = debts.map(debt => {
    const newBalance = debtBalances[debt.id] !== undefined ? debtBalances[debt.id] : debt.currentBalance;
    const isPaidOff = newBalance === 0;

    return {
      ...debt,
      currentBalance: newBalance,
      isPaidOff,
      paidOffDate: isPaidOff && !debt.isPaidOff ? new Date().toISOString().split('T')[0] : debt.paidOffDate,
    };
  });

  StorageService.saveDebts(updatedDebts);
}
