import { useState } from 'react';
import type { CheckingAccount } from '../types';

export default function AddCheckingAccountModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (account: CheckingAccount) => void;
}) {
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
  const [startingBalance, setStartingBalance] = useState('');

  const handleSave = () => {
    if (!name.trim()) { alert('Please enter an account name'); return; }
    const newAccount: CheckingAccount = {
      id: `account_${Date.now()}`,
      name: name.trim(),
      bankName: bankName.trim(),
      accountType,
      startingBalance: parseFloat(startingBalance) || 0,
      currentBalance: parseFloat(startingBalance) || 0,
      lastReconciledAt: null,
      lastReconciledBalance: null,
      createdAt: new Date().toISOString(),
      isDefault: false,
    };
    onSave(newAccount);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
        <h3 className="text-xl font-bold text-brand-navy mb-4">Add Account</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Account Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Chase Checking, Joint Account"
              className="novo-input"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Bank Name (optional)</label>
            <input
              type="text"
              value={bankName}
              onChange={e => setBankName(e.target.value)}
              placeholder="e.g. Chase, Bank of America"
              className="novo-input"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Account Type</label>
            <select
              value={accountType}
              onChange={e => setAccountType(e.target.value as 'checking' | 'savings')}
              className="novo-input"
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Starting Balance</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                type="number"
                value={startingBalance}
                onChange={e => setStartingBalance(e.target.value)}
                placeholder="0.00"
                className="novo-input pl-7"
                step="0.01"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-3 rounded-xl transition-colors">
            Add Account
          </button>
        </div>
      </div>
    </div>
  );
}
