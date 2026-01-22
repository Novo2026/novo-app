import { ArrowLeft, Download } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Debt, Transaction } from '../types';

interface DebtDetailViewProps {
  debt: Debt;
  onBack: () => void;
  onDataUpdate: () => void;
}

export default function DebtDetailView({ debt, onBack }: DebtDetailViewProps) {
  const transactions = StorageService.getTransactions()
    .filter(t => t.debtId === debt.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const paidOff = debt.startingBalance - debt.currentBalance;
  const progress = (paidOff / debt.startingBalance) * 100;

  const chartData = [
    { date: 'Start', balance: debt.startingBalance },
    ...transactions.map(t => ({
      date: CalculationService.formatDate(t.date),
      balance: t.newBalance,
    })),
  ];

  const handleExport = () => {
    const headers = ['Date', 'Type', 'Previous Balance', 'Interest', 'Principal', 'Payment/Charge', 'New Balance', 'Notes'];
    const rows = transactions.map(t => [
      t.date,
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
    a.download = `${debt.accountName}_history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-[#2D9CDB] hover:text-[#1E8BBD] font-semibold transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to My Debts</span>
      </button>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">{debt.accountName}</h2>
            <p className="text-gray-600">{debt.category}</p>
          </div>
          {debt.isPaidOff ? (
            <span className="bg-[#27AE60] text-white text-sm font-bold px-4 py-2 rounded-full">
              PAID OFF
            </span>
          ) : (
            <span className="bg-red-100 text-red-700 text-sm font-semibold px-3 py-2 rounded">
              {debt.interestRate}% APR
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Starting Balance</p>
            <p className="text-xl font-bold text-gray-800">
              {CalculationService.formatCurrency(debt.startingBalance)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Current Balance</p>
            <p className={`text-xl font-bold ${debt.isPaidOff ? 'text-[#27AE60]' : 'text-[#1E3A5F]'}`}>
              {CalculationService.formatCurrency(debt.currentBalance)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Amount Paid Off</p>
            <p className="text-xl font-bold text-[#27AE60]">
              {CalculationService.formatCurrency(paidOff)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Progress</p>
            <p className="text-xl font-bold text-[#2D9CDB]">
              {progress.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full ${debt.isPaidOff ? 'bg-[#27AE60]' : 'bg-[#2D9CDB]'}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {!debt.isPaidOff && (
          <div className="text-sm text-gray-600">
            Minimum Payment: {CalculationService.formatCurrency(debt.minimumPayment)}
          </div>
        )}
      </div>

      {chartData.length > 1 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Balance History</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value: number) => CalculationService.formatCurrency(value)} />
              <Line type="monotone" dataKey="balance" stroke="#2D9CDB" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {transactions.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Payment History</h3>
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 text-[#2D9CDB] hover:text-[#1E8BBD] text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Type</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Previous Balance</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Interest</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Principal</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Payment</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">New Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 text-sm text-gray-800">
                      {CalculationService.formatDate(t.date)}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        t.type === 'payment' ? 'bg-[#2D9CDB]/20 text-[#2D9CDB]' : 'bg-[#F2C94C]/20 text-[#F2C94C]'
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-sm text-right text-gray-800 font-mono">
                      {CalculationService.formatCurrencyDetailed(t.previousBalance)}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {transactions.some(t => t.notes) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">Notes:</p>
              {transactions
                .filter(t => t.notes)
                .map(t => (
                  <div key={t.id} className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">{CalculationService.formatDate(t.date)}:</span> {t.notes}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {transactions.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">No payment history yet. Log your first payment to see it here.</p>
        </div>
      )}
    </div>
  );
}
