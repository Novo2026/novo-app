import { X } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';

interface MortgageBalanceModalProps {
  onClose: () => void;
}

export default function MortgageBalanceModal({ onClose }: MortgageBalanceModalProps) {
  const mortgages = StorageService.getDebts().filter(
    (debt) => debt.category === 'Mortgage' && !debt.isPaidOff && debt.currentBalance > 0
  );
  const totalMortgageDebt = mortgages.reduce((sum, debt) => sum + debt.currentBalance, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-md bg-white shadow-2xl border border-brand-gray-border rounded-lg overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mortgage-balance-modal-title"
      >
        <div className="bg-brand-navy px-5 py-4 flex items-center justify-between border-b-4 border-brand-orange">
          <h2 id="mortgage-balance-modal-title" className="text-white text-base font-medium">
            Mortgage balances
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {mortgages.length === 0 ? (
            <p className="text-sm text-brand-gray">No active mortgage balances found.</p>
          ) : (
            <div className="space-y-3">
              {mortgages.map((mortgage) => (
                <div key={mortgage.id} className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-brand-navy truncate">
                    {mortgage.accountName}
                  </span>
                  <span className="text-sm text-brand-navy whitespace-nowrap">
                    {CalculationService.formatCurrency(mortgage.currentBalance)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {mortgages.length > 0 && (
            <>
              <div className="border-t border-brand-gray-border my-4" />
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-brand-navy">Total Mortgage Debt</span>
                <span className="text-sm font-medium text-brand-orange whitespace-nowrap">
                  {CalculationService.formatCurrency(totalMortgageDebt)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
