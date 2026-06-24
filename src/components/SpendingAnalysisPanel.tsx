import { useMemo, useState } from 'react';
import { TrendingDown, ChevronDown, ChevronUp, AlertCircle, Repeat } from 'lucide-react';
import { CalculationService } from '../services/calculations';
import { StorageService } from '../services/storage';
import { analyzeSpending, buildSpendingAnalysisContext } from '../utils/spendingAnalysis';
import { CHAT_CONTEXT } from './NovoChat';

interface SpendingAnalysisPanelProps {
  onOpenChat: (context: string) => void;
}

export default function SpendingAnalysisPanel({ onOpenChat }: SpendingAnalysisPanelProps) {
  const [daysBack, setDaysBack] = useState(60);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAllRecurring, setShowAllRecurring] = useState(false);

  const transactions = useMemo(() => {
    const stored = localStorage.getItem('novo_checking_transactions');
    return stored ? JSON.parse(stored) : [];
  }, []);

  const profile = StorageService.getFinancialProfile();

  const analysis = useMemo(
    () => analyzeSpending(transactions, profile, daysBack),
    [transactions, profile, daysBack]
  );

  const handleAskNOVO = () => {
    const spendingContext = buildSpendingAnalysisContext(analysis);
    const context = `${CHAT_CONTEXT.reduceExpenses}\n\nHere is the user's actual spending data — reference it specifically in your coaching, don't give generic advice:\n\n${spendingContext}`;
    onOpenChat(context);
  };

  if (analysis.transactionCount === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <TrendingDown className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-700 mb-2">No Transaction Data Yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Import a bank statement or log transactions in the Tracker to unlock spending analysis and subscription audit.
        </p>
      </div>
    );
  }

  const recurringToShow = showAllRecurring
    ? analysis.recurringCharges
    : analysis.recurringCharges.slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Spending Analysis</h2>
          <p className="text-sm text-gray-500 mt-0.5">{analysis.periodLabel} · {analysis.transactionCount} transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={daysBack}
            onChange={e => setDaysBack(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700"
          >
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Income', value: analysis.totalIncome, color: 'text-green-600' },
          { label: 'Expenses', value: analysis.totalExpenses, color: 'text-red-500' },
          { label: 'Debt Payments', value: analysis.totalDebtPayments, color: 'text-orange-500' },
          { label: 'Net Cash Flow', value: analysis.netCashFlow, color: analysis.netCashFlow >= 0 ? 'text-green-600' : 'text-red-500' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-lg font-bold ${card.color}`}>
              {card.value < 0 ? '-' : ''}{CalculationService.formatCurrency(Math.abs(card.value))}
            </p>
          </div>
        ))}
      </div>

      {analysis.potentialMonthlySavings > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-bold text-orange-900 text-sm">💡 Potential Monthly Savings Opportunity</p>
            <p className="text-orange-800 text-sm mt-0.5">
              Cutting {analysis.topSpendingCategory?.name} spending in half could free up{' '}
              <span className="font-bold">{CalculationService.formatCurrency(analysis.potentialMonthlySavings)}/month</span> for debt payoff.
            </p>
          </div>
          <button
            onClick={handleAskNOVO}
            className="flex-shrink-0 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            Ask NOVO
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Spending by Category</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {analysis.categories.length === 0 ? (
            <p className="text-sm text-gray-500 p-5">No categorized expenses found. Edit transaction categories in the Tracker.</p>
          ) : (
            analysis.categories.map(cat => {
              const isExpanded = expandedCategory === cat.name;
              const maxAmount = analysis.categories[0]?.total || 1;
              const barWidth = Math.round((cat.total / maxAmount) * 100);
              return (
                <div key={cat.name}>
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? null : cat.name)}
                    className="w-full px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-900">{CalculationService.formatCurrency(cat.total)}</span>
                        <span className="text-xs text-gray-400">{cat.count} txns</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-orange rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-3 space-y-1">
                      {cat.transactions.slice(0, 8).map((t, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-600 py-1 border-b border-gray-50">
                          <span className="truncate max-w-[60%]">{t.description}</span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-gray-400">{new Date(t.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            <span className="font-medium text-gray-800">{CalculationService.formatCurrency(t.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {cat.transactions.length > 8 && (
                        <p className="text-xs text-gray-400 pt-1">+{cat.transactions.length - 8} more transactions</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {analysis.recurringCharges.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-purple-500" />
              <h3 className="font-bold text-gray-900">Recurring Charges Detected</h3>
            </div>
            <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-1 rounded-full">
              {analysis.recurringCharges.length} found
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {recurringToShow.map((charge, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{charge.description}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {charge.frequency === 'monthly' ? 'Monthly' : charge.frequency === 'weekly' ? 'Weekly' : 'Recurring'} · {charge.occurrences}x seen
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">{CalculationService.formatCurrency(charge.amount)}</p>
                  <p className="text-xs text-purple-600 font-medium">{CalculationService.formatCurrency(charge.annualCost)}/yr</p>
                </div>
              </div>
            ))}
          </div>
          {analysis.recurringCharges.length > 5 && (
            <div className="px-5 py-3 border-t border-gray-100">
              <button
                onClick={() => setShowAllRecurring(!showAllRecurring)}
                className="text-sm text-brand-orange font-medium hover:underline"
              >
                {showAllRecurring ? 'Show less' : `Show all ${analysis.recurringCharges.length} recurring charges`}
              </button>
            </div>
          )}
          <div className="px-5 py-3 bg-purple-50 border-t border-purple-100">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-purple-800">
                Review these charges and cancel any you no longer use.{' '}
                <button onClick={handleAskNOVO} className="font-bold underline">Ask NOVO</button>{' '}
                to see the exact payoff impact of cutting specific subscriptions.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
