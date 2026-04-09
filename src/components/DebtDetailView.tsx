import { ArrowLeft, Download, RefreshCw, Home } from 'lucide-react';
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
            <span className={`flex items-center space-x-1.5 text-white text-sm font-bold px-4 py-2 rounded-full ${
              debt.homeSold ? 'bg-amber-500' : 'bg-[#27AE60]'
            }`}>
              {debt.homeSold && <Home className="w-4 h-4" />}
              <span>{debt.homeSold ? 'Home Sold' : 'PAID OFF'}</span>
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

      {debt.homeSold && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <div className="flex items-center space-x-2 mb-4">
            <Home className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-bold text-amber-800">Home Sale Details</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {debt.homeSaleDate && (
              <div>
                <p className="text-amber-600 font-medium mb-0.5">Sale Date</p>
                <p className="font-bold text-gray-800">{CalculationService.formatDate(debt.homeSaleDate)}</p>
              </div>
            )}
            {debt.homeSalePrice && (
              <div>
                <p className="text-amber-600 font-medium mb-0.5">Sale Price</p>
                <p className="font-bold text-gray-800">{CalculationService.formatCurrency(debt.homeSalePrice)}</p>
              </div>
            )}
            {debt.homeSaleNetProceeds != null && debt.homeSaleNetProceeds > 0 && (
              <div>
                <p className="text-amber-600 font-medium mb-0.5">Net Proceeds</p>
                <p className="font-bold text-emerald-700 text-base">{CalculationService.formatCurrency(debt.homeSaleNetProceeds)}</p>
              </div>
            )}
            {debt.replacedByDebtId && (
              <div className="col-span-2 md:col-span-3 pt-2 border-t border-amber-200">
                <p className="text-amber-600 font-medium">Replaced by new mortgage</p>
              </div>
            )}
          </div>
        </div>
      )}

      {debt.replacedDebtName && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center space-x-3">
          <Home className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Replacement Mortgage</p>
            <p className="text-sm text-amber-700">
              Replaced {debt.replacedDebtName}
              {debt.replacementRelationship && (
                <span className="ml-1 capitalize">
                  ({debt.replacementRelationship === 'investment' ? 'investment property' : debt.replacementRelationship})
                </span>
              )}
            </p>
          </div>
        </div>
      )}

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
                {transactions.map(t => {
                  const isRefinance = t.type === 'refinance';
                  return (
                    <tr key={t.id} className={`border-b border-gray-100 hover:bg-gray-50 ${isRefinance ? 'bg-blue-50/40' : ''}`}>
                      <td className="py-3 px-2 text-sm text-gray-800">
                        {CalculationService.formatDate(t.date)}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center space-x-1 text-xs font-semibold px-2 py-1 rounded ${
                          isRefinance ? 'bg-blue-100 text-blue-700' :
                          t.type === 'payment' ? 'bg-[#2D9CDB]/20 text-[#2D9CDB]' : 'bg-[#F2C94C]/20 text-yellow-700'
                        }`}>
                          {isRefinance && <RefreshCw className="w-3 h-3" />}
                          <span>{isRefinance ? 'refinance' : t.type}</span>
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
                        isRefinance ? 'text-blue-600' :
                        t.type === 'payment' ? 'text-[#2D9CDB]' : 'text-red-600'
                      }`}>
                        {isRefinance ? '—' : (t.type === 'payment' ? '-' : '+') + CalculationService.formatCurrencyDetailed(t.amount)}
                      </td>
                      <td className="py-3 px-2 text-sm text-right text-gray-800 font-mono font-semibold">
                        {CalculationService.formatCurrencyDetailed(t.newBalance)}
                      </td>
                    </tr>
                  );
                })}
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

      {debt.refinanceHistory && debt.refinanceHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <RefreshCw className="w-5 h-5 text-[#2D9CDB]" />
            <h3 className="text-xl font-bold text-gray-800">Refinance History</h3>
          </div>
          <div className="space-y-3">
            {debt.refinanceHistory.map((r, i) => {
              const rateImproved = r.newRate < r.previousRate;
              const balanceChanged = r.newBalance !== r.previousBalance;
              const typeLabel =
                r.type === 'balance_transfer' ? 'Balance Transfer' :
                r.type === 'consolidation' ? 'Consolidation' :
                r.type === 'cash_out' ? 'Cash-Out Refinance' :
                'Refinanced';
              return (
                <div key={r.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-gray-800">{typeLabel}</span>
                      {i === 0 && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">First</span>
                      )}
                      {i === (debt.refinanceHistory!.length - 1) && debt.refinanceHistory!.length > 1 && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Current</span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">{CalculationService.formatDate(r.date)}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Balance</p>
                      <p className="font-semibold text-gray-800">
                        {CalculationService.formatCurrency(r.previousBalance)}
                        <span className="text-gray-400 mx-1">→</span>
                        <span className={balanceChanged ? (r.newBalance > r.previousBalance ? 'text-amber-600' : 'text-[#27AE60]') : ''}>
                          {CalculationService.formatCurrency(r.newBalance)}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Rate</p>
                      <p className="font-semibold text-gray-800">
                        {r.previousRate}%
                        <span className="text-gray-400 mx-1">→</span>
                        <span className={rateImproved ? 'text-[#27AE60]' : r.newRate > r.previousRate ? 'text-amber-600' : ''}>
                          {r.newRate}%
                        </span>
                        {rateImproved && (
                          <span className="ml-1 text-xs text-[#27AE60]">(-{(r.previousRate - r.newRate).toFixed(2)}%)</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Monthly Payment</p>
                      <p className="font-semibold text-gray-800">
                        {CalculationService.formatCurrency(r.previousPayment)}
                        <span className="text-gray-400 mx-1">→</span>
                        {CalculationService.formatCurrency(r.newPayment)}
                      </p>
                    </div>
                    {r.newLender && (
                      <div>
                        <p className="text-gray-500 text-xs">Lender</p>
                        <p className="font-semibold text-gray-800">{r.newLender}</p>
                      </div>
                    )}
                    {r.newTerm && (
                      <div>
                        <p className="text-gray-500 text-xs">Term</p>
                        <p className="font-semibold text-gray-800">{r.newTerm} years</p>
                      </div>
                    )}
                    {r.introEndDate && (
                      <div>
                        <p className="text-gray-500 text-xs">Intro Rate Ends</p>
                        <p className="font-semibold text-amber-600">{CalculationService.formatDate(r.introEndDate)}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
