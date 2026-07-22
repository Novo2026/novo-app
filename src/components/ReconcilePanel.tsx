import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, X, AlertCircle, Trash2 } from 'lucide-react';
import { CalculationService } from '../services/calculations';
import { StorageService } from '../services/storage';
import { recalculateCheckingBalances } from '../utils/savingsTransactions';
import type { CheckingTransaction } from '../types';

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

function loadTransactionsForAccount(accountId: string): Transaction[] {
  try {
    const stored = localStorage.getItem(`novo_checking_transactions_${accountId}`)
      || localStorage.getItem('novo_checking_transactions')
      || '[]';
    return JSON.parse(stored).sort((a: Transaction, b: Transaction) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  } catch {
    return [];
  }
}

export default function ReconcilePanel({
  accountName,
  accountId,
  currentBalance,
  lastReconciledAt,
  onClose,
  onComplete,
}: ReconcilePanelProps) {
  const transactionsRef = useRef<Transaction[]>(loadTransactionsForAccount(accountId));
  const startedAtRef = useRef<string>(new Date().toISOString());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [statementBalance, setStatementBalance] = useState('');
  const [showQuickConfirm, setShowQuickConfirm] = useState(false);
  const [filterUnchecked, setFilterUnchecked] = useState(false);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [savedProgress, setSavedProgress] = useState<ReturnType<typeof StorageService.getReconcileProgress>>(null);
  const [canAutoSave, setCanAutoSave] = useState(false);
  const [showProgressSaved, setShowProgressSaved] = useState(false);

  useEffect(() => {
    const progress = StorageService.getReconcileProgress(accountId);
    if (progress && progress.checkedTransactionIds.length > 0) {
      setSavedProgress(progress);
      setShowResumeBanner(true);
      setCanAutoSave(false);
    } else {
      setSavedProgress(null);
      setShowResumeBanner(false);
      setCanAutoSave(true);
      startedAtRef.current = new Date().toISOString();
    }
  }, [accountId]);

  const unreconciledTransactions = transactionsRef.current.filter(
    (t) => !t.isReconciled && !deletedIds.has(t.id)
  );

  const displayTransactions = filterUnchecked
    ? unreconciledTransactions.filter((t) => !checkedIds.has(t.id))
    : unreconciledTransactions;

  const checkedCount = checkedIds.size;
  const totalCount = unreconciledTransactions.length;
  const allChecked = checkedCount === totalCount && totalCount > 0;

  const statementBalanceNum = parseFloat(statementBalance) || null;
  const balanceDiff = statementBalanceNum !== null
    ? Math.abs(statementBalanceNum - currentBalance)
    : null;
  const balanceMatches = balanceDiff !== null && balanceDiff < 0.02;

  const persistProgress = useCallback(() => {
    if (!canAutoSave) return;

    StorageService.saveReconcileProgress(accountId, {
      checkedTransactionIds: Array.from(checkedIds),
      statementBalance: statementBalanceNum ?? 0,
      startedAt: startedAtRef.current,
      lastSavedAt: new Date().toISOString(),
    });

    setShowProgressSaved(true);
    window.setTimeout(() => setShowProgressSaved(false), 1000);
  }, [accountId, canAutoSave, checkedIds, statementBalanceNum]);

  useEffect(() => {
    if (!canAutoSave) return;
    if (checkedIds.size === 0 && !statementBalance) return;
    persistProgress();
  }, [checkedIds, statementBalance, canAutoSave, persistProgress]);

  const persistSessionChanges = (reconciledIds: string[] = []) => {
    const account = StorageService.getCheckingAccounts().find((a) => a.id === accountId);
    const startingBalance = account?.startingBalance ?? 0;
    const reconciledSet = new Set(reconciledIds);

    const updated = transactionsRef.current
      .filter((t) => !deletedIds.has(t.id))
      .map((t) =>
        reconciledSet.has(t.id)
          ? { ...t, isReconciled: true, reconciledAt: new Date().toISOString() }
          : t
      ) as CheckingTransaction[];

    const recalculated = recalculateCheckingBalances(updated, startingBalance);
    StorageService.saveCheckingTransactionsForAccount(accountId, recalculated);
    StorageService.syncCheckingAccountBalance(accountId, recalculated);
    transactionsRef.current = recalculated as Transaction[];
  };

  const finalizeReconciliation = (reconciledIds: string[]) => {
    const reconciledTxs = transactionsRef.current.filter((t) => reconciledIds.includes(t.id));
    const dates = reconciledTxs.map((t) => t.date).sort();
    const statementEnding = statementBalanceNum ?? currentBalance;
    const difference = statementEnding - currentBalance;
    const status = Math.abs(difference) < 0.02 ? 'reconciled' : 'needs_review';

    StorageService.saveReconciliationRecord(accountId, {
      id: `recon_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      completedAt: new Date().toISOString(),
      statementEndingBalance: statementEnding,
      novoCalculatedBalance: currentBalance,
      difference,
      transactionCount: reconciledIds.length,
      status,
      periodStart: dates[0] ?? CalculationService.getTodayDateString(),
      periodEnd: dates[dates.length - 1] ?? CalculationService.getTodayDateString(),
    });

    StorageService.clearReconcileProgress(accountId);
    persistSessionChanges(reconciledIds);
    onComplete(reconciledIds, statementBalanceNum);
  };

  const handleResume = () => {
    if (!savedProgress) return;
    setCheckedIds(new Set(savedProgress.checkedTransactionIds));
    setStatementBalance(
      savedProgress.statementBalance > 0 ? savedProgress.statementBalance.toString() : ''
    );
    startedAtRef.current = savedProgress.startedAt;
    setShowResumeBanner(false);
    setCanAutoSave(true);
  };

  const handleStartFresh = () => {
    StorageService.clearReconcileProgress(accountId);
    setSavedProgress(null);
    setShowResumeBanner(false);
    setCheckedIds(new Set());
    setStatementBalance('');
    startedAtRef.current = new Date().toISOString();
    setCanAutoSave(true);
  };

  const toggleTransaction = (id: string) => {
    setCheckedIds((prev) => {
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
      setCheckedIds(new Set(unreconciledTransactions.map((t) => t.id)));
    }
  };

  const handleDelete = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (deletingIds.has(id) || deletedIds.has(id)) return;

    setDeletingIds((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setDeletedIds((prev) => new Set(prev).add(id));
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setCheckedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  };

  const handleSaveAndClose = () => {
    if (deletedIds.size > 0) {
      persistSessionChanges();
    }
    onClose();
  };

  const handleComplete = () => {
    finalizeReconciliation(Array.from(checkedIds));
  };

  const handleQuickReconcile = () => {
    const allIds = unreconciledTransactions.map((t) => t.id);
    finalizeReconciliation(allIds);
  };

  const typeColor = (type: string) => {
    if (type === 'deposit' || type === 'transfer_from_heloc' || type === 'transfer_from_checking' || type === 'transfer_from_savings') return 'text-emerald-600';
    if (type === 'debt_payment') return 'text-orange-600';
    return 'text-red-500';
  };

  const typeSign = (type: string) => {
    return type === 'deposit' || type === 'transfer_from_heloc' || type === 'transfer_from_checking' || type === 'transfer_from_savings' ? '+' : '-';
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-0 md:p-4 overflow-hidden">
      <div className="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl mt-auto md:mt-0">

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-brand-navy">Reconcile — {accountName}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {lastReconciledAt
                ? `Last reconciled ${new Date(lastReconciledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Never reconciled'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showProgressSaved && (
              <span className="text-xs text-brand-gray animate-pulse transition-opacity">
                Progress saved
              </span>
            )}
            <button onClick={handleSaveAndClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {showResumeBanner && savedProgress && (
          <div className="px-6 py-3 bg-brand-orange/10 border-b border-brand-orange/20 flex-shrink-0">
            <p className="text-sm text-brand-navy font-medium mb-2">
              You have an unfinished reconciliation. Resume where you left off?
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleResume}
                className="text-xs font-semibold bg-brand-navy text-white px-3 py-1.5 rounded-lg hover:bg-brand-navy-dark transition-colors"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={handleStartFresh}
                className="text-xs font-semibold text-brand-navy border border-brand-gray-border px-3 py-1.5 rounded-lg hover:bg-white transition-colors"
              >
                Start Fresh
              </button>
            </div>
          </div>
        )}

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">NOVO Balance</p>
              <p className="text-xl font-bold text-brand-navy">{CalculationService.formatCurrency(currentBalance)}</p>
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
                  className="w-full pl-7 pr-4 py-1.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange outline-none"
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
                className="text-xs text-gray-500 hover:text-brand-orange transition-colors"
              >
                {filterUnchecked ? 'Show all' : 'Hide reviewed'}
              </button>
              <button
                onClick={toggleAll}
                className="text-xs font-semibold text-brand-orange hover:text-brand-orange-dark transition-colors"
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

        <div
          className="flex-shrink-0 overflow-y-auto"
          style={{ height: '65vh', overscrollBehavior: 'contain' }}
        >
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
              {displayTransactions.map((tx) => {
                const isChecked = checkedIds.has(tx.id);
                const isDeleting = deletingIds.has(tx.id);
                return (
                  <div
                    key={tx.id}
                    className={`reconcile-row flex items-center gap-2 ${
                      isDeleting ? 'deleting' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleTransaction(tx.id)}
                      className={`flex-1 px-6 py-3.5 flex items-center gap-4 text-left transition-colors ${
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
                    <button
                      type="button"
                      onClick={(event) => handleDelete(tx.id, event)}
                      className="mr-4 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                      title="Delete transaction"
                      aria-label={`Delete ${tx.description}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
                onClick={handleSaveAndClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
              >
                Save & Close
              </button>
              {checkedCount > 0 && (
                <button
                  onClick={handleComplete}
                  className="flex-1 bg-brand-navy hover:bg-brand-navy-dark text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Reconcile {checkedCount} Reviewed
                </button>
              )}
            </div>
          )}

          {!showQuickConfirm ? (
            <button
              onClick={() => setShowQuickConfirm(true)}
              className="w-full text-sm font-medium text-gray-500 hover:text-brand-navy py-2 px-4 rounded-xl border border-gray-200 hover:border-brand-navy/30 bg-white transition-all flex items-center justify-center gap-2"
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

      <style>{`
        .reconcile-row {
          overflow: hidden;
          transition: opacity 0.2s ease, max-height 0.2s ease, padding 0.2s ease;
          max-height: 120px;
        }
        .reconcile-row.deleting {
          opacity: 0;
          max-height: 0;
          padding-top: 0;
          padding-bottom: 0;
        }
      `}</style>
    </div>
  );
}
