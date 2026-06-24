import { useState } from 'react';
import { X } from 'lucide-react';
import { StorageService } from '../services/storage';
import type { SavingsAccount, SavingsAccountType } from '../types';

interface AddSavingsAccountModalProps {
  onClose: () => void;
  onSuccess: () => void;
  existingAccount?: SavingsAccount;
}

export default function AddSavingsAccountModal({
  onClose,
  onSuccess,
  existingAccount,
}: AddSavingsAccountModalProps) {
  const [formData, setFormData] = useState({
    name: existingAccount?.name || '',
    type: existingAccount?.type || 'High-Yield Savings' as SavingsAccountType,
    balance: existingAccount?.balance.toString() || '',
    interestRate: existingAccount?.interestRate.toString() || '0',
    goalAmount: existingAccount?.goalAmount?.toString() || '',
    notes: existingAccount?.notes || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const accountTypes: SavingsAccountType[] = [
    'High-Yield Savings',
    'Money Market',
    'CD',
    'Checking',
    'Other',
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Account name is required';
    }

    if (!formData.balance.trim()) {
      newErrors.balance = 'Current balance is required';
    } else {
      const balance = parseFloat(formData.balance);
      if (isNaN(balance) || balance < 0) {
        newErrors.balance = 'Balance must be a valid positive number';
      }
    }

    if (formData.interestRate.trim()) {
      const rate = parseFloat(formData.interestRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        newErrors.interestRate = 'Interest rate must be between 0 and 100';
      }
    }

    if (formData.goalAmount.trim()) {
      const goal = parseFloat(formData.goalAmount);
      if (isNaN(goal) || goal < 0) {
        newErrors.goalAmount = 'Goal amount must be a valid positive number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const accounts = StorageService.getSavingsAccounts();

    const accountData: SavingsAccount = {
      id: existingAccount?.id || crypto.randomUUID(),
      name: formData.name.trim(),
      type: formData.type,
      balance: parseFloat(formData.balance),
      interestRate: parseFloat(formData.interestRate) || 0,
      goalAmount: formData.goalAmount.trim() ? parseFloat(formData.goalAmount) : null,
      notes: formData.notes.trim(),
      transactions: existingAccount?.transactions || [],
      createdAt: existingAccount?.createdAt || new Date().toISOString(),
    };

    if (existingAccount) {
      const updatedAccounts = accounts.map(acc =>
        acc.id === existingAccount.id ? accountData : acc
      );
      StorageService.saveSavingsAccounts(updatedAccounts);
    } else {
      StorageService.saveSavingsAccounts([...accounts, accountData]);
    }

    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {existingAccount ? 'Edit Savings Account' : 'Add Savings Account'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Account Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Emergency Fund, Down Payment, etc."
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Account Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as SavingsAccountType })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
            >
              {accountTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Current Balance *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                placeholder="0.00"
                className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent ${
                  errors.balance ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.balance && <p className="mt-1 text-sm text-red-600">{errors.balance}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Interest Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.interestRate}
              onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
              placeholder="0.00"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent ${
                errors.interestRate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.interestRate && <p className="mt-1 text-sm text-red-600">{errors.interestRate}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Goal Amount (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={formData.goalAmount}
                onChange={(e) => setFormData({ ...formData, goalAmount: e.target.value })}
                placeholder="0.00"
                className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent ${
                  errors.goalAmount ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.goalAmount && <p className="mt-1 text-sm text-red-600">{errors.goalAmount}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes about this account..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
            />
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-brand-blue hover:bg-[#1E8BBD] text-white font-semibold rounded-lg transition-colors"
            >
              {existingAccount ? 'Update Account' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
