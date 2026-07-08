import { useState } from 'react';
import { X } from 'lucide-react';
import { StorageService } from '../services/storage';
import InstallmentLoanFields from './InstallmentLoanFields';
import {
  applyInstallmentFieldsToDebt,
  isInstallmentLoanCategory,
  readInstallmentFieldsFromDebt,
  type LoanTermUnit,
} from '../utils/installmentLoan';
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
  const initialInstallment = readInstallmentFieldsFromDebt(debt);

  const [accountName, setAccountName] = useState(debt.accountName);
  const [category, setCategory] = useState<DebtCategory>(debt.category);
  const [balance, setBalance] = useState(debt.currentBalance.toString());
  const [startingBalance, setStartingBalance] = useState(debt.startingBalance.toString());
  const [showOriginalBalanceField, setShowOriginalBalanceField] = useState(false);
  const [showBalanceCorrectionPrompt, setShowBalanceCorrectionPrompt] = useState(false);
  const [interestRate, setInterestRate] = useState(
    debt.category === 'Mortgage' ? debt.interestRate.toFixed(3) : debt.interestRate.toFixed(2)
  );
  const [minimumPayment, setMinimumPayment] = useState(debt.minimumPayment.toString());
  const [originalAmount, setOriginalAmount] = useState(initialInstallment.originalAmount);
  const [loanStartDate, setLoanStartDate] = useState(initialInstallment.loanStartDate);
  const [loanTerm, setLoanTerm] = useState(initialInstallment.loanTerm);
  const [loanTermUnit, setLoanTermUnit] = useState<LoanTermUnit>(initialInstallment.loanTermUnit);

  const showInstallmentFields = isInstallmentLoanCategory(category);
  const isMortgage = category === 'Mortgage';

  const handleBalanceChange = (value: string) => {
    setBalance(value);
    const balanceNum = parseFloat(value);
    if (
      !isNaN(balanceNum) &&
      balanceNum !== debt.currentBalance &&
      debt.startingBalance !== balanceNum
    ) {
      setShowBalanceCorrectionPrompt(true);
    } else {
      setShowBalanceCorrectionPrompt(false);
    }
  };

  const handleConfirmUpdateOriginal = () => {
    setShowOriginalBalanceField(true);
    setStartingBalance(balance);
    setShowBalanceCorrectionPrompt(false);
  };

  const handleKeepOriginal = () => {
    setShowOriginalBalanceField(false);
    setStartingBalance(debt.startingBalance.toString());
    setShowBalanceCorrectionPrompt(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const balanceNum = parseFloat(balance);
    const rateNum = parseFloat(interestRate);
    const minPaymentNum = parseFloat(minimumPayment);
    const startingBalanceNum = showOriginalBalanceField
      ? parseFloat(startingBalance)
      : debt.startingBalance;

    if (isNaN(balanceNum) || isNaN(rateNum) || isNaN(minPaymentNum)) return;
    if (balanceNum < 0 || rateNum < 0 || minPaymentNum < 0) return;
    if (showOriginalBalanceField && (isNaN(startingBalanceNum) || startingBalanceNum < 0)) return;

    let updatedDebt: Debt = {
      ...debt,
      accountName: accountName.trim(),
      category,
      currentBalance: balanceNum,
      startingBalance: startingBalanceNum,
      interestRate: rateNum,
      minimumPayment: minPaymentNum,
      isPaidOff: balanceNum === 0,
    };

    updatedDebt = applyInstallmentFieldsToDebt(updatedDebt, {
      originalAmount,
      loanStartDate,
      loanTerm,
      loanTermUnit,
    });

    const debts = StorageService.getDebts();
    const index = debts.findIndex(d => d.id === debt.id);
    if (index !== -1) {
      debts[index] = updatedDebt;
      StorageService.saveDebts(debts);
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
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
                onChange={(e) => handleBalanceChange(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>
            {showBalanceCorrectionPrompt && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800 mb-2">
                  Looks like you&apos;re correcting a balance — do you also want to update the original starting balance?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmUpdateOriginal}
                    className="text-xs font-semibold px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                  >
                    Yes, update it
                  </button>
                  <button
                    type="button"
                    onClick={handleKeepOriginal}
                    className="text-xs font-semibold px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg transition-colors"
                  >
                    No, keep original
                  </button>
                </div>
              </div>
            )}
          </div>

          {showOriginalBalanceField && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Original Balance
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Used for progress tracking and &quot;Started at&quot; on your debt card.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Interest Rate (APR)
            </label>
            <div className="relative">
              <input
                type="number"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="w-full px-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                placeholder={isMortgage ? '0.000' : '0.00'}
                step={isMortgage ? '0.001' : '0.01'}
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
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
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
              className="flex-1 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
