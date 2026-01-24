import { useState } from 'react';
import { X } from 'lucide-react';
import { StorageService } from '../services/storage';
import type { Debt, DebtCategory } from '../types';

interface EditDebtModalProps {
  debt: Debt;
  onClose: () => void;
  onSuccess: () => void;
}

const DEBT_CATEGORIES: DebtCategory[] = [
  'Mortgage',
  'Auto Loan',
  'Student Loan',
  'Credit Card',
  'Personal Loan',
  'HELOC',
  'Other',
];

export default function EditDebtModal({ debt, onClose, onSuccess }: EditDebtModalProps) {
  const [accountName, setAccountName] = useState(debt.accountName);
  const [category, setCategory] = useState<DebtCategory>(debt.category);
  const [balance, setBalance] = useState(debt.currentBalance.toString());
  const [interestRate, setInterestRate] = useState(debt.interestRate.toString());
  const [minimumPayment, setMinimumPayment] = useState(debt.minimumPayment.toString());
  const [originalAmount, setOriginalAmount] = useState(debt.originalAmount?.toString() || '');
  const [loanStartDate, setLoanStartDate] = useState(debt.loanStartDate || '');
  const [loanTerm, setLoanTerm] = useState(debt.loanTerm?.toString() || '30');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const balanceNum = parseFloat(balance);
    const rateNum = parseFloat(interestRate);
    const minPaymentNum = parseFloat(minimumPayment);

    if (isNaN(balanceNum) || isNaN(rateNum) || isNaN(minPaymentNum)) return;
    if (balanceNum < 0 || rateNum < 0 || minPaymentNum < 0) return;

    const updatedDebt: Debt = {
      ...debt,
      accountName: accountName.trim(),
      category,
      currentBalance: balanceNum,
      interestRate: rateNum,
      minimumPayment: minPaymentNum,
      isPaidOff: balanceNum === 0,
    };

    if (category === 'Mortgage' && originalAmount && loanStartDate) {
      updatedDebt.originalAmount = parseFloat(originalAmount);
      updatedDebt.loanStartDate = loanStartDate;
      updatedDebt.loanTerm = parseInt(loanTerm || '30');
      updatedDebt.isAmortized = true;
    }

    const debts = StorageService.getDebts();
    const index = debts.findIndex(d => d.id === debt.id);
    if (index !== -1) {
      debts[index] = updatedDebt;
      StorageService.saveDebts(debts);
    }

    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-800">Edit Debt</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Account Name
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
              placeholder="e.g., Chase Sapphire"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DebtCategory)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
              required
            >
              {DEBT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Current Balance
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Interest Rate (APR)
            </label>
            <div className="relative">
              <input
                type="number"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="w-full px-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
              <span className="absolute right-3 top-2 text-gray-500">%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Minimum Payment
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={minimumPayment}
                onChange={(e) => setMinimumPayment(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>
          </div>

          {category === 'Mortgage' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Original Loan Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={originalAmount}
                    onChange={(e) => setOriginalAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Loan Start Date
                </label>
                <input
                  type="date"
                  value={loanStartDate}
                  onChange={(e) => setLoanStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Loan Term (years)
                </label>
                <select
                  value={loanTerm}
                  onChange={(e) => setLoanTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                >
                  <option value="10">10 years</option>
                  <option value="15">15 years</option>
                  <option value="20">20 years</option>
                  <option value="25">25 years</option>
                  <option value="30">30 years</option>
                </select>
              </div>
            </>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-[#FF6B35] hover:bg-[#E55A25] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
