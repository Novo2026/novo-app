import { useState } from 'react';
import { X } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import type { SavingsAccount, SavingsTransactionType } from '../types';

interface LogSavingsTransactionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  transactionType: SavingsTransactionType;
}

export default function LogSavingsTransactionModal({
  onClose,
  onSuccess,
  accountId,
  transactionType,
}: LogSavingsTransactionModalProps) {
  const accounts = StorageService.getSavingsAccounts();
  const account = accounts.find(acc => acc.id === accountId);

  const [formData, setFormData] = useState({
    date: CalculationService.getTodayDateString(),
    amount: '',
    description: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!account) {
    return null;
  }

  const getTitle = () => {
    switch (transactionType) {
      case 'deposit':
        return 'Add Deposit';
      case 'withdrawal':
        return 'Record Withdrawal';
      case 'interest':
        return 'Record Interest';
      default:
        return 'Log Transaction';
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.amount = 'Amount must be greater than zero';
      }

      if (transactionType === 'withdrawal' && amount > account.balance) {
        newErrors.amount = `Insufficient funds. Current balance: $${account.balance.toFixed(2)}`;
      }
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const amount = parseFloat(formData.amount);
    let newBalance = account.balance;

    if (transactionType === 'deposit' || transactionType === 'interest') {
      newBalance += amount;
    } else if (transactionType === 'withdrawal') {
      newBalance -= amount;
    }

    newBalance = Math.max(0, newBalance);

    const newTransaction = {
      id: crypto.randomUUID(),
      date: formData.date,
      type: transactionType,
      amount: amount,
      description: formData.description.trim() || getDefaultDescription(),
      balanceAfter: Math.round(newBalance * 100) / 100,
    };

    const updatedAccount: SavingsAccount = {
      ...account,
      balance: Math.round(newBalance * 100) / 100,
      transactions: [...account.transactions, newTransaction].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    };

    const updatedAccounts = accounts.map(acc =>
      acc.id === accountId ? updatedAccount : acc
    );

    StorageService.saveSavingsAccounts(updatedAccounts);
    onSuccess();
  };

  const getDefaultDescription = (): string => {
    switch (transactionType) {
      case 'deposit':
        return 'Deposit';
      case 'withdrawal':
        return 'Withdrawal';
      case 'interest':
        return 'Interest earned';
      default:
        return 'Transaction';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">{getTitle()}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto px-6 py-6 space-y-6 flex-1">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Account</p>
            <p className="text-lg font-bold text-gray-900">{account.name}</p>
            <p className="text-sm text-gray-600 mt-1">
              Current Balance: <span className="font-semibold text-gray-900">${account.balance.toFixed(2)}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Date *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              max={CalculationService.getTodayDateString()}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent ${
                errors.date ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description (Optional)
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={getDefaultDescription()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
            />
          </div>

          {transactionType === 'withdrawal' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <span className="font-semibold">Warning:</span> This will reduce your account balance to ${(account.balance - parseFloat(formData.amount || '0')).toFixed(2)}
              </p>
            </div>
          )}
          </div>

          <div className="flex space-x-4 px-6 py-4 border-t border-gray-200 flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[#27AE60] hover:bg-[#229954] text-white font-semibold rounded-lg transition-colors"
            >
              Log {transactionType === 'deposit' ? 'Deposit' : transactionType === 'withdrawal' ? 'Withdrawal' : 'Interest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
