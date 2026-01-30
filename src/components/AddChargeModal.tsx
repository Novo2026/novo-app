import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import type { Transaction } from '../types';

interface AddChargeModalProps {
  debtId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddChargeModal({ debtId, onClose, onSuccess }: AddChargeModalProps) {
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDate, setChargeDate] = useState(CalculationService.getTodayDateString());
  const [description, setDescription] = useState('');

  const debts = StorageService.getDebts();
  const debt = debts.find(d => d.id === debtId);

  if (!debt) {
    onClose();
    return null;
  }

  const amount = parseFloat(chargeAmount) || 0;
  const newBalance = debt.currentBalance + amount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!chargeAmount) return;

    const amount = parseFloat(chargeAmount);
    if (isNaN(amount) || amount <= 0) return;

    const newDebts = debts.map(d => {
      if (d.id === debtId) {
        return {
          ...d,
          currentBalance: d.currentBalance + amount,
          isPaidOff: false,
          paidOffDate: undefined,
          transferredToHELOC: undefined,
        };
      }
      return d;
    });

    const transaction: Transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      debtId,
      debtName: debt.accountName,
      date: chargeDate,
      type: 'charge',
      amount,
      previousBalance: debt.currentBalance,
      interestCharged: 0,
      principalPaid: 0,
      newBalance: debt.currentBalance + amount,
      notes: description.trim() || undefined,
    };

    const transactions = StorageService.getTransactions();
    transactions.push(transaction);

    StorageService.saveDebts(newDebts);
    StorageService.saveTransactions(transactions);

    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-2xl font-bold text-gray-800">Add Charge</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
            {debt.isPaidOff ? (
              <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-800">
                  <p className="font-bold mb-2">⚠️ This card was paid off{debt.paidOffDate ? ` on ${new Date(debt.paidOffDate).toLocaleDateString()}` : ''}.</p>
                  <p className="mb-2">Adding a charge will move it back to active debts.</p>
                  <p className="mb-2">If you're using this card responsibly and paying it off monthly, that's great! NOVO will continue tracking it.</p>
                  <p className="font-semibold">If this is new debt that you're carrying, make sure it fits your debt elimination strategy.</p>
                </div>
              </div>
            ) : (
              <div className="bg-[#F2C94C]/20 border border-[#F2C94C] rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-[#F2C94C] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-700">
                  <p className="font-semibold mb-1">Adding a charge to: {debt.accountName}</p>
                  <p>This will increase the balance on this debt.</p>
                </div>
              </div>
            )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Charge Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                placeholder="0.00"
                step="0.01"
                min="0.01"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={chargeDate}
              onChange={(e) => setChargeDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
              placeholder="e.g., New purchase, annual fee..."
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current Balance:</span>
              <span className="font-semibold">{CalculationService.formatCurrencyDetailed(debt.currentBalance)}</span>
            </div>
            <div className="flex justify-between text-sm text-red-600">
              <span>Charge Amount:</span>
              <span className="font-semibold">+{CalculationService.formatCurrencyDetailed(amount)}</span>
            </div>
            <div className="pt-2 border-t border-gray-300 flex justify-between font-bold">
              <span className="text-gray-800">New Balance:</span>
              <span className="text-gray-800">{CalculationService.formatCurrencyDetailed(newBalance)}</span>
            </div>
          </div>
          </div>

          <div className="flex space-x-3 p-6 pt-4 border-t border-gray-200 flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-[#F2C94C] hover:bg-[#E0B73C] text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Add Charge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
