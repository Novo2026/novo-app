import { useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { StorageService } from '../services/storage';
import type { CheckingAccount } from '../types';

export default function AccountReconcileButton({
  account,
  currentBalance,
  onReconciled,
}: {
  account: CheckingAccount;
  currentBalance: number;
  onReconciled: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const isReconciled = !!account.lastReconciledAt;

  const handleReconcile = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    StorageService.reconcileAccount(account.id, currentBalance);
    setConfirming(false);
    onReconciled();
  };

  const handleUnreconcile = () => {
    StorageService.unreconcileAccount(account.id);
    onReconciled();
  };

  if (isReconciled) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Reconciled {new Date(account.lastReconciledAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <button
          onClick={handleUnreconcile}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
          title="Undo reconciliation"
        >
          <RotateCcw className="w-3 h-3" />
          Undo
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleReconcile}
      className={`flex items-center gap-2 text-sm font-semibold py-2 px-4 rounded-xl transition-all ${
        confirming
          ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
      }`}
    >
      <CheckCircle2 className="w-4 h-4" />
      {confirming ? 'Confirm Reconcile' : 'Reconcile Account'}
    </button>
  );
}
