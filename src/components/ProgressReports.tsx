import { Download, Trash2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import type { UnifiedPayment } from '../types';
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
  type TooltipProps,
} from 'recharts';

const CHART_GRID_STROKE = '#E5E7EB';
const CHART_AXIS_TICK = { fontSize: 11, fill: '#6B7280' };
const BRAND_ORANGE = '#FF6B35';
const BRAND_GRAY = '#6B7280';
const BRAND_NAVY = '#1E3A5F';
const BRAND_BLUE = '#2D9CDB';
const BRAND_RED = '#EB5757';

function PageHeader({ onExport }: { onExport: () => void }) {
  return (
    <div className="bg-brand-navy py-3 px-5">
      <div className="max-w-4xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-white text-lg font-medium leading-tight">Progress</h1>
          <p className="text-white/65 text-xs mt-0.5">See how far you&apos;ve come</p>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs sm:text-[13px] font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Export</span>
          <span className="hidden sm:inline">Export Report</span>
        </button>
      </div>
    </div>
  );
}

function BarChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-brand-gray-border rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-brand-navy mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="text-brand-gray">
          {entry.name}: {CalculationService.formatCurrency(Number(entry.value) || 0)}
        </p>
      ))}
    </div>
  );
}

function getSourceBadgeClass(source: UnifiedPayment['source']): string {
  if (source === 'checking') return 'bg-brand-navy text-white';
  if (source === 'direct') return 'bg-brand-orange text-white';
  return 'bg-brand-blue text-white';
}

function getSourceLabel(source: UnifiedPayment['source']): string {
  if (source === 'direct') return 'Direct';
  if (source === 'heloc') return 'HELOC';
  return 'Checking';
}

interface ProgressReportsProps {
  onDataUpdate: () => void;
}

export default function ProgressReports({ onDataUpdate }: ProgressReportsProps) {
  const [filterDebtId, setFilterDebtId] = useState<string>('all');
  const [pendingDelete, setPendingDelete] = useState<UnifiedPayment | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deletedPaymentIds, setDeletedPaymentIds] = useState<Set<string>>(new Set());
  const [editingPayment, setEditingPayment] = useState<UnifiedPayment | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);

  const debts = StorageService.getDebts();
  const allTransactions = StorageService.getTransactions();
  const strategyResult = StorageService.getStrategyResult();
  const unifiedPayments = CalculationService
    .getUnifiedPaymentHistory()
    .filter(payment => !deletedPaymentIds.has(payment.id));
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
    { name: 'Interest Paid', value: totalInterest, color: BRAND_RED },
    { name: 'Principal Paid', value: totalPrincipal, color: BRAND_NAVY },
  ];

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    applyDebtBalanceDelta(pendingDelete.debtId, pendingDelete.amount);
    StorageService.deleteTransaction(pendingDelete.id);
    StorageService.deleteUnifiedPayment(pendingDelete.id);
    setDeletedPaymentIds(prev => new Set(prev).add(pendingDelete.id));
    setPendingDelete(null);
    setDeleteSuccess(true);
    setTimeout(() => setDeleteSuccess(false), 3000);
    onDataUpdate();
  };

  const applyDebtBalanceDelta = (debtId: string, delta: number) => {
    const debts = StorageService.getDebts();
    const updatedDebts = debts.map(debt => {
      if (debt.id !== debtId) return debt;

      const nextBalance = Math.min(
        debt.startingBalance,
        Math.max(0, debt.currentBalance + delta)
      );

      return {
        ...debt,
        currentBalance: nextBalance,
        isPaidOff: nextBalance <= 0,
        paidOffDate: nextBalance <= 0 ? debt.paidOffDate : undefined,
      };
    });

    StorageService.saveDebts(updatedDebts);
  };

  const handleOpenEdit = (payment: UnifiedPayment) => {
    setEditingPayment(payment);
    setEditDate(payment.date);
    setEditAmount(payment.amount.toFixed(2));
    setEditDescription(payment.description || '');
  };

  const handleSaveEdit = () => {
    if (!editingPayment) return;

    const parsedAmount = parseFloat(editAmount);
    if (!editDate || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    const amountDelta = editingPayment.amount - parsedAmount;
    if (amountDelta !== 0) {
      applyDebtBalanceDelta(editingPayment.debtId, amountDelta);
    }

    const updatedPayments = StorageService.getUnifiedPayments().map(payment => {
      if (payment.id !== editingPayment.id) return payment;
      return {
        ...payment,
        date: editDate,
        amount: parsedAmount,
        description: editDescription.trim() || undefined,
      };
    });
    StorageService.saveUnifiedPayments(updatedPayments);

    const updatedTransactions = StorageService.getTransactions().map(transaction => {
      if (transaction.id !== editingPayment.id) return transaction;
      return {
        ...transaction,
        date: editDate,
        amount: parsedAmount,
        notes: editDescription.trim(),
      };
    });
    StorageService.saveTransactions(updatedTransactions);

    setEditingPayment(null);
    setEditSuccess(true);
    setTimeout(() => setEditSuccess(false), 3000);
    onDataUpdate();
  };

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
      <div className="bg-brand-gray-light min-h-screen">
        <PageHeader onExport={handleExportHistory} />
        <div className="max-w-4xl mx-auto px-5 py-16 text-center">
          <p className="text-base text-brand-navy">No payment history yet. Log your first payment to see progress reports.</p>
          <p className="text-sm text-brand-gray mt-2">
            Payments from Dashboard, HELOC Tracker, and Checking Register will all appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-gray-light min-h-screen">
      <PageHeader onExport={handleExportHistory} />

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-5">
        <h2 className="text-base font-medium text-brand-navy mt-5 mb-3">Progress Reports</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-brand-gray-border rounded-lg p-4 border-l-4 border-l-brand-orange">
            <p className="text-[11px] uppercase text-brand-gray tracking-wide">Total debt reduced</p>
            <p className="text-[22px] font-medium text-brand-navy mt-1">
              {CalculationService.formatCurrency(metrics.totalPaidOff)}
            </p>
            <p className="text-[11px] text-brand-gray mt-0.5">{metrics.progressPercentage.toFixed(1)}% complete</p>
          </div>

          <div className="bg-white border border-brand-gray-border rounded-lg p-4 border-l-4 border-l-brand-green">
            <p className="text-[11px] uppercase text-brand-gray tracking-wide">Principal paid</p>
            <p className="text-[22px] font-medium text-brand-navy mt-1">
              {CalculationService.formatCurrency(totalPrincipal)}
            </p>
            <p className="text-[11px] text-brand-gray mt-0.5">Actual debt eliminated</p>
          </div>

          <div className="bg-white border border-brand-gray-border rounded-lg p-4 border-l-4 border-l-brand-red">
            <p className="text-[11px] uppercase text-brand-gray tracking-wide">Interest paid</p>
            <p className="text-[22px] font-medium text-brand-red mt-1">
              {CalculationService.formatCurrency(totalInterest)}
            </p>
            <p className="text-[11px] text-brand-gray mt-0.5">
              {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="bg-white border border-brand-gray-border rounded-lg p-4 border-l-4 border-l-brand-blue">
            <p className="text-[11px] uppercase text-brand-gray tracking-wide">Remaining debt</p>
            <p className="text-[22px] font-medium text-brand-navy mt-1">
              {CalculationService.formatCurrency(metrics.totalCurrentBalance)}
            </p>
            <p className="text-[11px] text-brand-gray mt-0.5">
              {metrics.activeDebts.length} active debt{metrics.activeDebts.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

      {paymentBreakdown.total > 0 && (
        <div className="bg-white border border-brand-gray-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-brand-navy mb-3">Payment sources breakdown</h3>
          <div className="flex flex-wrap gap-4">
            {paymentBreakdown.directCount > 0 && (
              <div className="bg-orange-50 border border-brand-orange rounded-lg p-4 inline-block min-w-[200px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-brand-orange shrink-0" />
                  <p className="text-[13px] font-medium text-brand-navy">Direct Payments</p>
                </div>
                <p className="text-lg font-medium text-brand-navy mb-1">
                  {CalculationService.formatCurrency(paymentBreakdown.direct)}
                </p>
                <p className="text-[11px] text-brand-gray">
                  {paymentBreakdown.directCount} payment{paymentBreakdown.directCount !== 1 ? 's' : ''} ·{' '}
                  {((paymentBreakdown.direct / paymentBreakdown.total) * 100).toFixed(0)}% of total
                </p>
                <p className="text-[11px] text-brand-gray italic mt-1">Logged via Dashboard or My Debts</p>
              </div>
            )}

            {paymentBreakdown.helocCount > 0 && (
              <div className="bg-blue-50 border border-brand-blue rounded-lg p-4 inline-block min-w-[200px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-brand-blue shrink-0" />
                  <p className="text-[13px] font-medium text-brand-navy">HELOC Velocity Banking</p>
                </div>
                <p className="text-lg font-medium text-brand-navy mb-1">
                  {CalculationService.formatCurrency(paymentBreakdown.heloc)}
                </p>
                <p className="text-[11px] text-brand-gray">
                  {paymentBreakdown.helocCount} chunk{paymentBreakdown.helocCount !== 1 ? 's' : ''} ·{' '}
                  {((paymentBreakdown.heloc / paymentBreakdown.total) * 100).toFixed(0)}% of total
                </p>
                <p className="text-[11px] text-brand-gray italic mt-1">Debts paid off using HELOC draws</p>
              </div>
            )}

            {paymentBreakdown.checkingCount > 0 && (
              <div className="bg-green-50 border border-brand-green rounded-lg p-4 inline-block min-w-[200px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-brand-green shrink-0" />
                  <p className="text-[13px] font-medium text-brand-navy">Checking Register</p>
                </div>
                <p className="text-lg font-medium text-brand-navy mb-1">
                  {CalculationService.formatCurrency(paymentBreakdown.checking)}
                </p>
                <p className="text-[11px] text-brand-gray">
                  {paymentBreakdown.checkingCount} payment{paymentBreakdown.checkingCount !== 1 ? 's' : ''} ·{' '}
                  {((paymentBreakdown.checking / paymentBreakdown.total) * 100).toFixed(0)}% of total
                </p>
                <p className="text-[11px] text-brand-gray italic mt-1">Logged via Checking Register</p>
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-brand-gray-border flex justify-between items-center">
            <span className="text-[13px] text-brand-gray">Total Principal Paid</span>
            <span className="text-[13px] font-medium text-brand-navy">
              {CalculationService.formatCurrency(paymentBreakdown.total)}
            </span>
          </div>
        </div>
      )}

      {strategyResult && (
        <div className="bg-white border border-brand-gray-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-brand-navy mb-4">Projected vs. actual progress</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={projectedData}>
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(value: number) => CalculationService.formatCurrency(value)} />
              <Legend
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              />
              <Line
                type="monotone"
                dataKey="projected"
                stroke={BRAND_GRAY}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={{ fill: BRAND_GRAY, r: 3 }}
                name="Projected Balance"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke={BRAND_ORANGE}
                strokeWidth={2}
                dot={{ fill: BRAND_ORANGE, r: 3 }}
                name="Actual Balance"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {monthlyPaymentsArray.length > 0 && (
        <div className="bg-white border border-brand-gray-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-brand-navy mb-4">Monthly payments by source</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyPaymentsArray}>
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<BarChartTooltip />} />
              <Legend
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              />
              <Bar dataKey="checking" stackId="a" fill={BRAND_NAVY} name="Checking Register" />
              <Bar dataKey="direct" stackId="a" fill={BRAND_ORANGE} name="Direct Payments" />
              <Bar dataKey="heloc" stackId="a" fill={BRAND_BLUE} name="HELOC Chunks" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {totalInterest > 0 && (
        <div className="bg-white border border-brand-gray-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-brand-navy mb-4">Interest vs. principal</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={interestVsPrincipalData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent, x, y }) => (
                    <text
                      x={x}
                      y={y}
                      fill={name === 'Principal Paid' ? BRAND_NAVY : BRAND_RED}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11}
                    >
                      {`${name}: ${(percent * 100).toFixed(1)}%`}
                    </text>
                  )}
                  outerRadius={100}
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
              <p className="text-[11px] text-brand-gray">Interest Paid</p>
              <p className="text-lg font-medium text-brand-red mt-0.5">
                {CalculationService.formatCurrency(totalInterest)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-brand-gray">Principal Paid</p>
              <p className="text-lg font-medium text-brand-navy mt-0.5">
                {CalculationService.formatCurrency(totalPrincipal)}
              </p>
            </div>
          </div>
        </div>
      )}

      {homeEquity?.hasHELOC && helocTransactions.length > 0 && (
        <div className="bg-white border border-brand-gray-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-brand-navy mb-4">HELOC balance over time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={helocTransactions.map(t => ({
              date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              balance: t.balance,
              type: t.type,
            }))}>
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => CalculationService.formatCurrency(value)}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              <Line
                type="stepAfter"
                dataKey="balance"
                stroke={BRAND_BLUE}
                strokeWidth={2}
                name="HELOC Balance"
                dot={{ r: 3, fill: BRAND_BLUE }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 border border-brand-blue rounded-lg">
              <p className="text-[11px] text-brand-gray font-medium mb-1">Current Balance</p>
              <p className="text-lg font-medium text-brand-navy">
                {CalculationService.formatCurrency(helocTransactions[helocTransactions.length - 1]?.balance || 0)}
              </p>
            </div>
            <div className="text-center p-3 bg-green-50 border border-brand-green rounded-lg">
              <p className="text-[11px] text-brand-gray font-medium mb-1">Total Payments</p>
              <p className="text-lg font-medium text-brand-navy">
                {CalculationService.formatCurrency(helocTransactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0))}
              </p>
            </div>
            <div className="text-center p-3 bg-red-50 border border-brand-red rounded-lg">
              <p className="text-[11px] text-brand-gray font-medium mb-1">Total Draws</p>
              <p className="text-lg font-medium text-brand-navy">
                {CalculationService.formatCurrency(helocTransactions.filter(t => t.type === 'draw').reduce((sum, t) => sum + t.amount, 0))}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-brand-gray-border rounded-lg p-5">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h3 className="text-sm font-medium text-brand-navy">Payment history</h3>
          <div className="flex items-center gap-3">
            <select
              value={filterDebtId}
              onChange={(e) => setFilterDebtId(e.target.value)}
              className="px-3 py-1.5 border border-brand-gray-border rounded-md text-xs text-brand-gray bg-white focus:border-brand-navy outline-none"
            >
              <option value="all">All Debts</option>
              {debts.filter(debt => debt.category !== 'HELOC').map(debt => (
                <option key={debt.id} value={debt.id}>{debt.accountName}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportHistory}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:underline transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="bg-brand-gray-light border-b border-brand-gray-border">
                <th className="text-left py-2.5 px-5 text-[11px] uppercase tracking-wide font-medium text-brand-gray">Date</th>
                <th className="text-left py-2.5 px-2 text-[11px] uppercase tracking-wide font-medium text-brand-gray">Debt</th>
                <th className="text-left py-2.5 px-2 text-[11px] uppercase tracking-wide font-medium text-brand-gray">Source</th>
                <th className="text-right py-2.5 px-2 text-[11px] uppercase tracking-wide font-medium text-brand-gray">Principal</th>
                <th className="text-right py-2.5 px-2 text-[11px] uppercase tracking-wide font-medium text-brand-gray">Interest</th>
                <th className="text-left py-2.5 px-2 text-[11px] uppercase tracking-wide font-medium text-brand-gray">Description</th>
                <th className="py-2.5 px-5 text-[11px] uppercase tracking-wide font-medium text-brand-gray text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredPayments].reverse().map((p, index) => (
                <tr
                  key={p.id}
                  className={`border-b border-brand-gray-border ${
                    index % 2 === 0 ? 'bg-white' : 'bg-brand-gray-light'
                  }`}
                >
                  <td className="py-2.5 px-5 text-xs text-brand-gray">
                    {CalculationService.formatDate(p.date)}
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="text-[13px] text-brand-navy">{p.debtName}</span>
                    {p.transferredToHELOC && (
                      <div className="text-[11px] text-brand-blue italic mt-0.5">Transferred to HELOC</div>
                    )}
                    {p.isPaidOff && !p.transferredToHELOC && (
                      <div className="text-[11px] text-brand-green font-medium mt-0.5">Paid Off</div>
                    )}
                  </td>
                  <td className="py-2.5 px-2">
                    <span className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full ${getSourceBadgeClass(p.source)}`}>
                      {getSourceLabel(p.source)}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-[13px] text-right font-medium text-brand-navy">
                    {CalculationService.formatCurrencyDetailed(p.principalPaid)}
                  </td>
                  <td className="py-2.5 px-2 text-[13px] text-right font-medium text-brand-red">
                    {p.interestCharged > 0 ? CalculationService.formatCurrencyDetailed(p.interestCharged) : '-'}
                  </td>
                  <td className="py-2.5 px-2 text-xs text-brand-gray max-w-[200px] truncate">
                    {p.description || '-'}
                  </td>
                  <td className="py-2.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleOpenEdit(p); }}
                        className="text-xs font-medium text-brand-blue hover:underline"
                        title="Edit payment"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPendingDelete(p); }}
                        className="p-1 text-brand-gray hover:text-brand-red transition-colors"
                        title="Delete payment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-brand-gray-border border-l-4 border-l-brand-blue rounded-lg p-4">
        <h4 className="text-[13px] font-medium text-brand-navy mb-2">About unified payment history</h4>
        <p className="text-[12px] text-brand-gray leading-relaxed">
          This report combines payments from all sources: direct debt payments (Dashboard/My Debts), HELOC draws used to pay debts (HELOC Tracker), and checking account debt payments (Checking Register). This gives you a complete view of your debt elimination progress regardless of which method you use.
        </p>
      </div>
      </div>

      {deleteSuccess && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white px-5 py-3 rounded-lg shadow-xl text-sm font-medium animate-fade-in z-50">
          Payment deleted successfully
        </div>
      )}

      {editSuccess && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white px-5 py-3 rounded-lg shadow-xl text-sm font-medium animate-fade-in z-50">
          Payment updated successfully
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start space-x-4 mb-5">
              <div className="bg-red-100 rounded-full p-2 flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">Delete this payment?</h3>
                <div className="bg-gray-50 rounded-lg p-3 mt-2 text-sm space-y-1">
                  <p className="font-semibold text-gray-800">
                    {CalculationService.formatCurrency(pendingDelete.amount)} to {pendingDelete.debtName}
                  </p>
                  <p className="text-gray-600">
                    {CalculationService.formatDate(pendingDelete.date)}
                  </p>
                  <p className="text-gray-600">
                    Balance will change from{' '}
                    <span className="font-semibold text-gray-800">
                      {CalculationService.formatCurrency(pendingDelete.newBalance)}
                    </span>
                    {' '}to{' '}
                    <span className="font-semibold text-gray-800">
                      {CalculationService.formatCurrency(pendingDelete.previousBalance)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">Edit Payment</h3>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                placeholder="Optional description"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditingPayment(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-sm font-semibold text-white bg-brand-blue hover:bg-[#1E8BBD] rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
