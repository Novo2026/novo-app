import { RefreshCw, TrendingDown, Calendar, DollarSign } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { StrategyResult } from '../types';

interface StrategyResultsProps {
  result: StrategyResult;
  onRunNew: () => void;
}

export default function StrategyResults({ result, onRunNew }: StrategyResultsProps) {
  const debts = StorageService.getDebts().filter(d => !d.isPaidOff);
  const minimumOnly = CalculationService.projectMinimumPaymentsOnly(debts);

  const chartData = result.monthlyProjections
    .filter((_, i) => i % 3 === 0 || i === result.monthlyProjections.length - 1)
    .map((proj, index) => {
      const dataPoint: Record<string, string | number> = {
        month: `Mo ${proj.month}`,
        total: proj.totalBalance,
      };

      proj.debts.forEach(d => {
        const debt = debts.find(debt => debt.id === d.debtId);
        if (debt) {
          dataPoint[debt.accountName] = d.balance;
        }
      });

      return dataPoint;
    });

  const colors = ['#2D9CDB', '#27AE60', '#F2C94C', '#EB5757', '#9B51E0', '#FF6B35'];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Your Payoff Strategy</h2>
        <button
          onClick={onRunNew}
          className="flex items-center space-x-2 text-[#2D9CDB] hover:text-[#1E8BBD] font-semibold transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Run New Strategy</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-[#27AE60] to-[#229954] text-white rounded-lg shadow-lg p-6">
          <h3 className="text-sm font-semibold mb-2 opacity-90">Your Strategy (Optimized)</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Calendar className="w-8 h-8" />
              <div>
                <p className="text-2xl font-bold">
                  {Math.floor(result.totalMonths / 12)} years, {result.totalMonths % 12} months
                </p>
                <p className="text-sm opacity-90">Debt-Free: {CalculationService.formatMonthYear(result.debtFreeDate)}</p>
              </div>
            </div>
            <div className="pt-3 border-t border-white/20">
              <p className="text-sm opacity-90">Total Interest</p>
              <p className="text-xl font-bold">{CalculationService.formatCurrency(result.totalInterest)}</p>
            </div>
            <div className="pt-2">
              <p className="text-sm opacity-90">Total Paid</p>
              <p className="text-xl font-bold">{CalculationService.formatCurrency(result.totalPaid)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-md p-6">
          <h3 className="text-sm font-semibold mb-2 text-gray-600">Minimum Payments Only (Baseline)</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Calendar className="w-8 h-8 text-gray-400" />
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {Math.floor(minimumOnly.totalMonths / 12)} years, {minimumOnly.totalMonths % 12} months
                </p>
                <p className="text-sm text-gray-600">
                  Debt-Free: {CalculationService.formatMonthYear(minimumOnly.debtFreeDate)}
                </p>
              </div>
            </div>
            <div className="pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">Total Interest</p>
              <p className="text-xl font-bold text-gray-800">
                {CalculationService.formatCurrency(minimumOnly.totalInterest)}
              </p>
            </div>
            <div className="pt-2">
              <p className="text-sm text-gray-600">Total Paid</p>
              <p className="text-xl font-bold text-gray-800">
                {CalculationService.formatCurrency(minimumOnly.totalPaid)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#2D9CDB] to-[#1E8BBD] text-white rounded-lg shadow-lg p-6">
        <div className="flex items-start space-x-4">
          <div className="bg-white/20 p-3 rounded-lg">
            <TrendingDown className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2">
              YOU'LL SAVE {CalculationService.formatCurrency(minimumOnly.totalInterest - result.totalInterest)}!
            </h3>
            <p className="text-lg opacity-90">
              And be debt-free{' '}
              <span className="font-bold">
                {Math.floor((minimumOnly.totalMonths - result.totalMonths) / 12)} years,{' '}
                {(minimumOnly.totalMonths - result.totalMonths) % 12} months
              </span>{' '}
              sooner!
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-6">How to Execute Your Strategy</h3>

        <div className="space-y-6">
          <div className="bg-gradient-to-r from-[#2D9CDB]/10 to-[#27AE60]/10 rounded-lg p-5 border-l-4 border-[#2D9CDB]">
            <div className="flex items-center space-x-2 mb-3">
              <DollarSign className="w-6 h-6 text-[#2D9CDB]" />
              <h4 className="font-bold text-gray-800 text-lg">Your Total Monthly Payment</h4>
            </div>
            <p className="text-3xl font-bold text-gray-800 mb-2">
              {CalculationService.formatCurrency(
                debts.reduce((sum, d) => sum + d.minimumPayment, 0) + (result.strategy.extraMonthlyPayment || 0)
              )}
            </p>
            <p className="text-sm text-gray-600">
              (Minimums: {CalculationService.formatCurrency(debts.reduce((sum, d) => sum + d.minimumPayment, 0))} +
              Extra: {CalculationService.formatCurrency(result.strategy.extraMonthlyPayment || 0)})
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Payment Breakdown This Month:</h4>
            <div className="space-y-2">
              {debts
                .sort((a, b) => b.interestRate - a.interestRate)
                .map((debt, index) => {
                  const isTargetDebt = index === 0;
                  const paymentAmount = debt.minimumPayment + (isTargetDebt ? (result.strategy.extraMonthlyPayment || 0) : 0);

                  return (
                    <div
                      key={debt.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isTargetDebt ? 'bg-[#27AE60]/10 border-2 border-[#27AE60]' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex-1">
                        <span className="font-medium text-gray-800">{debt.accountName}:</span>
                        {isTargetDebt ? (
                          <span className="ml-2 text-gray-700">
                            {CalculationService.formatCurrency(debt.minimumPayment)} +
                            {CalculationService.formatCurrency(result.strategy.extraMonthlyPayment || 0)} =
                            <span className="font-bold text-[#27AE60]"> {CalculationService.formatCurrency(paymentAmount)}</span>
                          </span>
                        ) : (
                          <span className="ml-2 text-gray-700">
                            {CalculationService.formatCurrency(debt.minimumPayment)} <span className="text-gray-500">(minimum only)</span>
                          </span>
                        )}
                      </div>
                      {isTargetDebt && (
                        <span className="ml-3 bg-[#27AE60] text-white text-xs font-bold px-3 py-1 rounded-full">
                          FOCUS HERE
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Payment Priority (Automatic):</h4>
            <p className="text-sm text-gray-700 mb-3">
              The extra {CalculationService.formatCurrency(result.strategy.extraMonthlyPayment || 0)} always goes to your highest-interest debt first.
            </p>
            <div className="space-y-2">
              {result.payoffTimeline.map((item, index) => {
                const debt = debts.find(d => d.id === item.debtId);
                const startMonth = index === 0 ? 1 : result.payoffTimeline[index - 1].payoffMonth + 1;

                return (
                  <div key={item.debtId} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#2D9CDB] text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-gray-800">
                        Months {startMonth}-{item.payoffMonth}:
                      </span>
                      <span className="ml-2 text-gray-700">
                        {item.debtName}
                      </span>
                      {debt && (
                        <span className="ml-2 text-sm text-gray-600">
                          ({debt.interestRate.toFixed(2)}% interest)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#F2C94C]/10 rounded-lg p-5 border-l-4 border-[#F2C94C]">
            <h4 className="font-semibold text-gray-800 mb-3">How It Works:</h4>
            <ol className="space-y-2 text-gray-700">
              <li className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-[#2D9CDB] text-white rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>Each month, pay the minimum on ALL debts</span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-[#2D9CDB] text-white rounded-full flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>
                  Add the extra {CalculationService.formatCurrency(result.strategy.extraMonthlyPayment || 0)} to the debt with highest interest
                </span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-[#2D9CDB] text-white rounded-full flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>When a debt is paid off, move that entire payment to the next highest-interest debt</span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-[#2D9CDB] text-white rounded-full flex items-center justify-center text-xs font-bold">
                  4
                </span>
                <span>Repeat until debt-free</span>
              </li>
            </ol>
            <p className="mt-4 text-sm font-semibold text-gray-800 bg-white/50 rounded p-3">
              This strategy automatically targets high-interest debt first to save you the most money.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Debt Payoff Timeline</h3>
        <div className="space-y-4">
          {result.payoffTimeline.map((item, index) => (
            <div key={item.debtId} className="flex items-center space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-[#27AE60] text-white rounded-full flex items-center justify-center font-bold">
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{item.debtName}</p>
                <p className="text-sm text-gray-600">
                  Paid off in month {item.payoffMonth} ({CalculationService.formatMonthYear(item.payoffDate)})
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Month</p>
                <p className="font-bold text-[#2D9CDB]">{item.payoffMonth}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Payoff Projection Chart</h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number) => CalculationService.formatCurrency(value)}
              labelStyle={{ color: '#000' }}
            />
            <Legend />
            {debts.map((debt, index) => (
              <Area
                key={debt.id}
                type="monotone"
                dataKey={debt.accountName}
                stackId="1"
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Strategy Details</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Extra Monthly Payment:</span>
            <span className="font-semibold">
              {CalculationService.formatCurrency(result.strategy.extraMonthlyPayment || 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Starting Debt:</span>
            <span className="font-semibold">
              {CalculationService.formatCurrency(
                debts.reduce((sum, d) => sum + d.currentBalance, 0)
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Number of Debts:</span>
            <span className="font-semibold">{debts.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Strategy Calculated:</span>
            <span className="font-semibold">
              {CalculationService.formatDate(result.strategy.calculatedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
