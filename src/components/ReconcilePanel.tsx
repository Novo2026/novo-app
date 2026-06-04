import { useState, useMemo } from 'react';
import { CheckCircle2, Circle, X, AlertCircle } from 'lucide-react';
import { CalculationService } from '../services/calculations';

interface Transaction {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string;
  balance: number;
  category?: string;
  isReconciled?: boolean;
}

interface ReconcilePanelProps {
  accountName: string;
  accountId: string;
  currentBalance: number;
  lastReconciledAt: string | null;
  onClose: () => void;
  onComplete: (reconciledIds: string[], statementBalance: number | null) => void;
}

export default function ReconcilePanel({
  accountName,
  accountId,
  currentBalance,
  lastReconciledAt,
  onClose,
  onComplete,
}: ReconcilePanelProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [statementBalance, setStatementBalance] = useState('');
  const [showQuickConfirm, setShowQuickConfirm] = useState(false);
  const [filterUnchecked, setFilterUnchecked] = useState(false);

  const allTransactions: Transaction[] = useMemo(() => {
    try {
      const stored = localStorage.getItem(`novo_checking_transactions_${accountId}`)
        || localStorage.getItem('novo_checking_transactions')
        || '[]';
      return JSON.parse(stored).sort((a: Transaction, b: Transaction) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch { return []; }
  }, [accountId]);

  const unreconciledTransactions = allTransactions.filter(t => !t.isReconciled);
  const displayTransactions = filterUnchecked
    ? unreconciledTransactions.filter(t => !checkedIds.has(t.id))
    : unreconciledTransactions;

  const checkedCount = checkedIds.size;
  const totalCount = unreconciledTransactions.length;
  const allChecked = checkedCount === totalCount && totalCount > 0;

  const statementBalanceNum = parseFloat(statementBalance) || null;
  const balanceDiff = statementBalanceNum !== null
    ? Math.abs(statementBalanceNum - currentBalance)
    : null;
  const balanceMatches = balanceDiff !== null && balanceDiff < 0.02;

  const toggleTransaction = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(unreconciledTransactions.map(t => t.id)));
    }
  };

  const handleComplete = () => {
    onComplete(Array.from(checkedIds), statementBalanceNum);
  };

  const handleQuickReconcile = () => {
    const allIds = unreconciledTransactions.map(t => t.id);
    onComplete(allIds, statementBalanceNum);
  };

  const typeColor = (type: string) => {
    if (type === 'deposit' || type === 'transfer_from_heloc') return 'text-emerald-600';
    if (type === 'debt_payment') return 'text-orange-600';
    return 'text-red-500';
  };

  const typeSign = (type: string) => {
    return type === 'deposit' || type === 'transfer_from_heloc' ? '+' : '-';
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-0 md:p-4 overflow-hidden">
      <div className="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl mt-auto md:mt-0">

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-[#1E3A5F]">Reconcile — {accountName}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {lastReconciledAt
                ? `Last reconciled ${new Date(lastReconciledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Never reconciled'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">NOVO Balance</p>
              <p className="text-xl font-bold text-[#1E3A5F]">{CalculationService.formatCurrency(currentBalance)}</p>
            </div>
            <div className="text-gray-300 text-2xl hidden md:block">=</div>
            <div className="flex-1 min-w-[180px]">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Your Bank Statement Balance</p>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  value={statementBalance}
                  onChange={e => setStatementBalance(e.target.value)}
                  placeholder="Enter statement balance"
                  className="w-full pl-7 pr-4 py-1.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] outline-none"
                  step="0.01"
                />
              </div>
            </div>
            {statementBalanceNum !== null && (
              <div className={`flex items-center gap-1.5 text-sm font-semibold ${balanceMatches ? 'text-emerald-600' : 'text-red-500'}`}>
                {balanceMatches ? (
                  <><CheckCircle2 className="w-4 h-4" /> Balances match!</>
                ) : (
                  <><AlertCircle className="w-4 h-4" /> Off by {CalculationService.formatCurrency(balanceDiff!)}</>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-semibold text-gray-700">
              {checkedCount} of {totalCount} transactions reviewed
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setFilterUnchecked(!filterUnchecked)}
                className="text-xs text-gray-500 hover:text-[#FF6B35] transition-colors"
              >
                {filterUnchecked ? 'Show all' : 'Hide reviewed'}
              </button>
              <button
                onClick={toggleAll}
                className="text-xs font-semibold text-[#FF6B35] hover:text-[#E55A25] transition-colors"
              >
                {allChecked ? 'Uncheck all' : 'Check all'}
              </button>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: totalCount > 0 ? `${(checkedCount / totalCount) * 100}%` : '0%' }}
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {displayTransactions.length === 0 ? (
            <div className="text-center py-12">
              {totalCount === 0 ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <p className="font-semibold text-gray-700">No transactions to reconcile</p>
                  <p className="text-sm text-gray-500 mt-1">All transactions are already reconciled</p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <p className="font-semibold text-gray-700">All transactions reviewed!</p>
                  <p className="text-sm text-gray-500 mt-1">Scroll down to complete reconciliation</p>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {displayTransactions.map(tx => {
                const isChecked = checkedIds.has(tx.id);
                return (
                  <button
                    key={tx.id}
                    onClick={() => toggleTransaction(tx.id)}
                    className={`w-full px-6 py-3.5 flex items-center gap-4 text-left transition-colors ${
                      isChecked ? 'bg-emerald-50/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {isChecked
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        : <Circle className="w-5 h-5 text-gray-300" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isChecked ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {tx.description}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-400">
                          {new Date(tx.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                        </p>
                        {tx.category && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tx.category}</span>
                        )}
                      </div>
                    </div>
                    <div className={`text-sm font-bold flex-shrink-0 ${isChecked ? 'text-gray-400' : typeColor(tx.type)}`}>
                      {typeSign(tx.type)}{CalculationService.formatCurrency(tx.amount)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 space-y-3">
          {allChecked && totalCount > 0 ? (
            <button
              onClick={handleComplete}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              Complete Reconciliation — {totalCount} transactions confirmed
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
              >
                Save & Close
              </button>
              {checkedCount > 0 && (
                <button
                  onClick={handleComplete}
                  className="flex-1 bg-[#1E3A5F] hover:bg-[#152C47] text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Reconcile {checkedCount} Reviewed
                </button>
              )}
            </div>
          )}

          {!showQuickConfirm ? (
            <button
              onClick={() => setShowQuickConfirm(true)}
              className="w-full text-sm font-medium text-gray-500 hover:text-[#1E3A5F] py-2 px-4 rounded-xl border border-gray-200 hover:border-[#1E3A5F]/30 bg-white transition-all flex items-center justify-center gap-2"
            >
              ⚡ Skip review — Quick Reconcile all {totalCount} transactions
            </button>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
              <p className="text-xs text-amber-800 font-medium">Mark all {totalCount} transactions as reconciled without reviewing?</p>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => setShowQuickConfirm(false)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Cancel</button>
                <button onClick={handleQuickReconcile} className="text-xs text-amber-700 hover:text-amber-900 font-bold">Yes, skip</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
