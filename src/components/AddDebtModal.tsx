import { useState } from 'react';
import { X } from 'lucide-react';
import { StorageService } from '../services/storage';
import InstallmentLoanFields from './InstallmentLoanFields';
import {
  applyInstallmentFieldsToDebt,
  isInstallmentLoanCategory,
  type LoanTermUnit,
} from '../utils/installmentLoan';
import type { Debt, DebtCategory } from '../types';

interface AddDebtModalProps {
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

export default function AddDebtModal({ onClose, onSuccess }: AddDebtModalProps) {
  const [accountName, setAccountName] = useState('');
  const [category, setCategory] = useState<DebtCategory>('Credit Card');
  const [balance, setBalance] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [minimumPayment, setMinimumPayment] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [loanStartDate, setLoanStartDate] = useState('');
  const [loanTerm, setLoanTerm] = useState('');
  const [loanTermUnit, setLoanTermUnit] = useState<LoanTermUnit>('years');

  const showInstallmentFields = isInstallmentLoanCategory(category);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const balanceNum = parseFloat(balance);
    const rateNum = parseFloat(interestRate);
    const minPaymentNum = parseFloat(minimumPayment);

    if (isNaN(balanceNum) || isNaN(rateNum) || isNaN(minPaymentNum)) return;
    if (balanceNum < 0 || rateNum < 0 || minPaymentNum < 0) return;

    let newDebt: Debt = {
      id: `debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      accountName: accountName.trim(),
      category,
      startingBalance: balanceNum,
      currentBalance: balanceNum,
      interestRate: rateNum,
      minimumPayment: minPaymentNum,
      isPaidOff: false,
      createdAt: new Date().toISOString(),
    };

    if (showInstallmentFields) {
      newDebt = applyInstallmentFieldsToDebt(newDebt, {
        originalAmount,
        loanStartDate,
        loanTerm,
        loanTermUnit,
      });
    }

    const debts = StorageService.getDebts();
    debts.push(newDebt);
    StorageService.saveDebts(debts);

    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'debt_added');
    }

    onSuccess();
  };

  const handleCategoryChange = (next: DebtCategory) => {
    setCategory(next);
    if (!isInstallmentLoanCategory(next)) {
      setOriginalAmount('');
      setLoanStartDate('');
      setLoanTerm('');
      setLoanTermUnit('years');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-800">Add New Debt</h3>
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
              onChange={(e) => handleCategoryChange(e.target.value as DebtCategory)}
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
            {balance !== '' && parseFloat(balance) === 0 && !isNaN(parseFloat(balance)) && (
              <p className="text-xs text-gray-500 mt-1">
                Open account with no current balance — we&apos;ll track it if you add charges later.
              </p>
            )}
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

          {showInstallmentFields && (
            <InstallmentLoanFields
              originalAmount={originalAmount}
              loanStartDate={loanStartDate}
              loanTerm={loanTerm}
              loanTermUnit={loanTermUnit}
              onOriginalAmountChange={setOriginalAmount}
              onLoanStartDateChange={setLoanStartDate}
              onLoanTermChange={setLoanTerm}
              onLoanTermUnitChange={setLoanTermUnit}
            />
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
              Add Debt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
