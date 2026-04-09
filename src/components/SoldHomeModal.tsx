import { useState } from 'react';
import { X, Home, Info } from 'lucide-react';
import { CalculationService } from '../services/calculations';
import DatePicker from './DatePicker';
import type { Debt } from '../types';

interface SoldHomeModalProps {
  debt: Debt;
  onClose: () => void;
  onConfirm: (data: {
    saleDate: string;
    payoffAmount: number;
    salePrice: number | null;
    netProceeds: number | null;
  }) => void;
}

export default function SoldHomeModal({ debt, onClose, onConfirm }: SoldHomeModalProps) {
  const [saleDate, setSaleDate] = useState(CalculationService.getTodayDateString());
  const [payoffAmount, setPayoffAmount] = useState(debt.currentBalance.toFixed(2));
  const [salePrice, setSalePrice] = useState('');
  const [closingCostPct, setClosingCostPct] = useState('2.5');

  const parsedPayoff = parseFloat(payoffAmount) || 0;
  const parsedSalePrice = parseFloat(salePrice) || 0;
  const parsedClosingPct = parseFloat(closingCostPct) || 0;
  const closingCosts = parsedSalePrice * (parsedClosingPct / 100);
  const netProceeds = parsedSalePrice > 0
    ? parsedSalePrice - parsedPayoff - closingCosts
    : null;
  const soldAtLoss = netProceeds !== null && netProceeds < 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      saleDate,
      payoffAmount: parsedPayoff,
      salePrice: parsedSalePrice > 0 ? parsedSalePrice : null,
      netProceeds: netProceeds,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-6 pb-4 rounded-t-xl z-10">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3">
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                <Home className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Congratulations on Selling Your Home!</h3>
                <p className="text-sm text-gray-500 mt-0.5">Let's record the details of your sale</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4 flex-shrink-0">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Sale Date</label>
            <DatePicker
              value={saleDate}
              onChange={setSaleDate}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Final Payoff Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={payoffAmount}
                onChange={e => setPayoffAmount(e.target.value)}
                required
                className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Auto-filled from current balance. Adjust if your actual payoff differs.
            </p>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Sale Details <span className="font-normal normal-case text-gray-400">(optional)</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Sale Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salePrice}
                    onChange={e => setSalePrice(e.target.value)}
                    placeholder="e.g., 450000"
                    className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>
              </div>

              {parsedSalePrice > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Estimated Closing Costs
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={closingCostPct}
                        onChange={e => setClosingCostPct(e.target.value)}
                        className="w-full pl-4 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">%</span>
                    </div>
                    <span className="text-sm text-gray-500 min-w-[80px]">
                      ≈ {CalculationService.formatCurrency(closingCosts)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Typically 2–3% of sale price</p>
                </div>
              )}

              {netProceeds !== null && !soldAtLoss && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-emerald-800">Estimated Net Proceeds</p>
                      <p className="text-2xl font-bold text-emerald-700 mt-1">
                        {CalculationService.formatCurrency(netProceeds)}
                      </p>
                      <p className="text-xs text-emerald-600 mt-1">
                        {CalculationService.formatCurrency(parsedSalePrice)} sale price
                        {' - '}{CalculationService.formatCurrency(parsedPayoff)} payoff
                        {' - '}{CalculationService.formatCurrency(closingCosts)} closing costs
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {soldAtLoss && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-amber-800">Note: Sale at a Loss</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Payoff amount exceeds sale price minus closing costs. Net proceeds calculation not shown.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Mark as Sold
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
