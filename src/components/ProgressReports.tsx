import { Download, Filter } from 'lucide-react';
import { useState } from 'react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
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

  const debts = StorageService.getDebts();
  const allTransactions = StorageService.getTransactions();
  const strategyResult = StorageService.getStrategyResult();
  const unifiedPayments = CalculationService.getUnifiedPaymentHistory();
  const paymentBreakdown = CalculationService.getPaymentSourceBreakdown();
  const homeEquity = StorageService.getHomeEquity();
  const helocTransactions = StorageService.getHELOCTransactions();

  const filteredPayments = filterDebtId === 'all'
    ? unifiedPayments
    : unifiedPayments.filter(p => p.debtId === filterDebtId);

  const metrics = CalculationService.calculateTotalDebtMetrics(debts, allTransactions);

  const projectedData = strategyResult?.monthlyProjections.map((proj, index) => ({
    month: `Mo ${proj.month}`,
    projected: proj.totalBalance,
    actual: index === 0 ? metrics.totalCurrentBalance : null,
  })) || [];

  const monthlyPaymentsData = filteredPayments.reduce((acc, p) => {
    const monthKey = new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    if (!acc[monthKey]) {
      acc[monthKey] = { month: monthKey, direct: 0, heloc: 0, checking: 0 };
    }

    if (p.source === 'direct') {
      acc[monthKey].direct += p.principalPaid;
    } else if (p.source === 'heloc') {
      acc[monthKey].heloc += p.principalPaid;
    } else if (p.source === 'checking') {
      acc[monthKey].checking += p.principalPaid;
    }

    return acc;
  }, {} as Record<string, { month: string; direct: number; heloc: number; checking: number }>);

  const monthlyPaymentsArray = Object.values(monthlyPaymentsData);

  const totalInterest = filteredPayments.reduce((sum, p) => sum + p.interestCharged, 0);
  const totalPrincipal = filteredPayments.reduce((sum, p) => sum + p.principalPaid, 0);

  const interestVsPrincipalData = [
    { name: 'Interest Paid', value: totalInterest, color: '#EB5757' },
    { name: 'Principal Paid', value: totalPrincipal, color: '#27AE60' },
  ];

  const handleExportHistory = () => {
    const headers = ['Date', 'Debt', 'Source', 'Amount', 'Principal', 'Interest', 'Description'];
    const rows = filteredPayments.map(p => [
      p.date,
      p.debtName,
      p.source === 'direct' ? 'Direct Payment' : p.source === 'heloc' ? 'HELOC Chunk' : 'Checking Register',
      p.amount.toFixed(2),
      p.principalPaid.toFixed(2),
      p.interestCharged.toFixed(2),
      p.description || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unified_payment_history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (unifiedPayments.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-xl text-gray-600">No payment history yet. Log your first payment to see progress reports.</p>
        <p className="text-gray-500 mt-2">Payments from Dashboard, HELOC Tracker, and Checking Register will all appear here.</p>
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
            {filteredPayments.length}
          </p>
          <div className="text-xs text-gray-500 mt-1">
            {paymentBreakdown.directCount > 0 && <span className="mr-2">Direct: {paymentBreakdown.directCount}</span>}
            {paymentBreakdown.helocCount > 0 && <span className="mr-2">HELOC: {paymentBreakdown.helocCount}</span>}
            {paymentBreakdown.checkingCount > 0 && <span>Checking: {paymentBreakdown.checkingCount}</span>}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-2">Debts Paid Off</p>
          <p className="text-3xl font-bold text-[#27AE60]">
            {metrics.paidOffDebts.length}
          </p>
          <p className="text-sm text-gray-500 mt-1">of {debts.length} total</p>
        </div>
      </div>

      {paymentBreakdown.total > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Payment Sources Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {paymentBreakdown.directCount > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="bg-[#2D9CDB] w-4 h-4 rounded"></div>
                  <p className="text-sm font-semibold text-gray-700">Direct Payments</p>
                </div>
                <p className="text-2xl font-bold text-[#2D9CDB] mb-1">
                  {CalculationService.formatCurrency(paymentBreakdown.direct)}
                </p>
                <p className="text-xs text-gray-600">
                  {paymentBreakdown.directCount} payment{paymentBreakdown.directCount !== 1 ? 's' : ''} · {((paymentBreakdown.direct / paymentBreakdown.total) * 100).toFixed(0)}% of total
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Logged via Dashboard or My Debts
                </p>
              </div>
            )}

            {paymentBreakdown.helocCount > 0 && (
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="bg-purple-600 w-4 h-4 rounded"></div>
                  <p className="text-sm font-semibold text-gray-700">HELOC Velocity Banking</p>
                </div>
                <p className="text-2xl font-bold text-purple-600 mb-1">
                  {CalculationService.formatCurrency(paymentBreakdown.heloc)}
                </p>
                <p className="text-xs text-gray-600">
                  {paymentBreakdown.helocCount} chunk{paymentBreakdown.helocCount !== 1 ? 's' : ''} · {((paymentBreakdown.heloc / paymentBreakdown.total) * 100).toFixed(0)}% of total
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Debts paid off using HELOC draws
                </p>
              </div>
            )}

            {paymentBreakdown.checkingCount > 0 && (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="bg-[#27AE60] w-4 h-4 rounded"></div>
                  <p className="text-sm font-semibold text-gray-700">Checking Register</p>
                </div>
                <p className="text-2xl font-bold text-[#27AE60] mb-1">
                  {CalculationService.formatCurrency(paymentBreakdown.checking)}
                </p>
                <p className="text-xs text-gray-600">
                  {paymentBreakdown.checkingCount} payment{paymentBreakdown.checkingCount !== 1 ? 's' : ''} · {((paymentBreakdown.checking / paymentBreakdown.total) * 100).toFixed(0)}% of total
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Logged via Checking Register
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">Total Principal Paid</span>
              <span className="text-xl font-bold text-gray-900">{CalculationService.formatCurrency(paymentBreakdown.total)}</span>
            </div>
          </div>
        </div>
      )}

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
          <h3 className="text-xl font-bold text-gray-800 mb-4">Monthly Payments by Source</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyPaymentsArray}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => CalculationService.formatCurrency(value)} />
              <Legend />
              <Bar dataKey="direct" stackId="a" fill="#2D9CDB" name="Direct Payments" />
              <Bar dataKey="heloc" stackId="a" fill="#9B59B6" name="HELOC Chunks" />
              <Bar dataKey="checking" stackId="a" fill="#27AE60" name="Checking Register" />
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

      {homeEquity?.hasHELOC && helocTransactions.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">HELOC Balance Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={helocTransactions.map(t => ({
              date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              balance: t.balance,
              type: t.type,
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => CalculationService.formatCurrency(value)}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <Line
                type="stepAfter"
                dataKey="balance"
                stroke="#9B59B6"
                strokeWidth={2}
                name="HELOC Balance"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-xs text-purple-700 font-semibold mb-1">Current Balance</p>
              <p className="text-lg font-bold text-purple-900">
                {CalculationService.formatCurrency(helocTransactions[helocTransactions.length - 1]?.balance || 0)}
              </p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-green-700 font-semibold mb-1">Total Payments</p>
              <p className="text-lg font-bold text-green-900">
                {CalculationService.formatCurrency(helocTransactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0))}
              </p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-xs text-red-700 font-semibold mb-1">Total Draws</p>
              <p className="text-lg font-bold text-red-900">
                {CalculationService.formatCurrency(helocTransactions.filter(t => t.type === 'draw').reduce((sum, t) => sum + t.amount, 0))}
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
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Source</th>
                <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Principal</th>
                <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Interest</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredPayments].reverse().map(p => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-2 text-sm text-gray-800">
                    {CalculationService.formatDate(p.date)}
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-800">
                    {p.debtName}
                    {p.transferredToHELOC && (
                      <div className="text-xs text-purple-600 italic mt-0.5">Transferred to HELOC</div>
                    )}
                    {p.isPaidOff && !p.transferredToHELOC && (
                      <div className="text-xs text-green-600 font-semibold mt-0.5">✓ Paid Off</div>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      p.source === 'direct' ? 'bg-[#2D9CDB]/20 text-[#2D9CDB]' :
                      p.source === 'heloc' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {p.source === 'direct' ? 'Direct' :
                       p.source === 'heloc' ? 'HELOC' :
                       'Checking'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-sm text-right text-[#27AE60] font-mono font-semibold">
                    {CalculationService.formatCurrencyDetailed(p.principalPaid)}
                  </td>
                  <td className="py-3 px-2 text-sm text-right text-red-600 font-mono">
                    {p.interestCharged > 0 ? CalculationService.formatCurrencyDetailed(p.interestCharged) : '-'}
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-700">
                    {p.description || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r mt-6">
        <h4 className="font-semibold text-blue-900 mb-2">About Unified Payment History</h4>
        <p className="text-blue-800 text-sm">
          This report combines payments from all sources: direct debt payments (Dashboard/My Debts), HELOC draws used to pay debts (HELOC Tracker), and checking account debt payments (Checking Register). This gives you a complete view of your debt elimination progress regardless of which method you use.
        </p>
      </div>
    </div>
  );
}
