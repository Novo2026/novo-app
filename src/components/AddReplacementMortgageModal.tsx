import { useState } from 'react';
import { X, Home } from 'lucide-react';
import { StorageService } from '../services/storage';
import DatePicker from './DatePicker';
import type { Debt } from '../types';

type ReplacementRelationship = 'upgraded' | 'downsized' | 'relocated' | 'investment';

interface AddReplacementMortgageModalProps {
  previousMortgageName: string;
  previousMortgageId: string;
  previousSaleDate: string;
  onClose: () => void;
  onSuccess: (newDebtId: string) => void;
}

const RELATIONSHIP_OPTIONS: { value: ReplacementRelationship; label: string; sub: string }[] = [
  { value: 'upgraded', label: 'Upgraded', sub: 'Bought larger / better home' },
  { value: 'downsized', label: 'Downsized', sub: 'Bought smaller home' },
  { value: 'relocated', label: 'Relocated', sub: 'Moved to different area' },
  { value: 'investment', label: 'Investment Property', sub: 'Kept old home as rental' },
];

export default function AddReplacementMortgageModal({
  previousMortgageName,
  previousMortgageId,
  previousSaleDate,
  onClose,
  onSuccess,
}: AddReplacementMortgageModalProps) {
  const [accountName, setAccountName] = useState('');
  const [lender, setLender] = useState('');
  const [balance, setBalance] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [minimumPayment, setMinimumPayment] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [loanStartDate, setLoanStartDate] = useState(previousSaleDate);
  const [loanTerm, setLoanTerm] = useState('30');
  const [relationship, setRelationship] = useState<ReplacementRelationship>('upgraded');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const balanceNum = parseFloat(balance) || 0;
    const rateNum = parseFloat(interestRate) || 0;
    const paymentNum = parseFloat(minimumPayment) || 0;
    const trimmedOriginal = originalAmount.trim();
    const parsedOriginal = trimmedOriginal
      ? parseFloat(trimmedOriginal.replace(/[^0-9.]/g, ''))
      : NaN;
    const hasOriginal =
      trimmedOriginal.length > 0 && !Number.isNaN(parsedOriginal) && parsedOriginal > 0;

    if (balanceNum <= 0 || rateNum < 0 || paymentNum < 0) return;

    const newDebtId = `debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newDebt: Debt = {
      id: newDebtId,
      accountName: accountName.trim() || (lender ? `${lender} Mortgage` : 'New Mortgage'),
      category: 'Mortgage',
      startingBalance: balanceNum,
      currentBalance: balanceNum,
      interestRate: rateNum,
      minimumPayment: paymentNum,
      isPaidOff: false,
      createdAt: new Date().toISOString(),
      ...(hasOriginal ? { originalAmount: parsedOriginal } : {}),
      loanStartDate,
      loanTerm: parseInt(loanTerm),
      loanTermUnit: 'years',
      isAmortized:
        hasOriginal && Boolean(loanStartDate.trim()) && !Number.isNaN(parseInt(loanTerm, 10)),
      replacedDebtId: previousMortgageId,
      replacedDebtName: previousMortgageName,
      replacementRelationship: relationship,
    };

    const debts = StorageService.getDebts();

    const prevIdx = debts.findIndex(d => d.id === previousMortgageId);
    if (prevIdx !== -1) {
      debts[prevIdx] = {
        ...debts[prevIdx],
        replacedByDebtId: newDebtId,
      };
    }

    debts.push(newDebt);
    StorageService.saveDebts(debts);

    onSuccess(newDebtId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-6 pb-4 rounded-t-xl z-10">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3">
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                <Home className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Add New Mortgage</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Replacing {previousMortgageName}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4 flex-shrink-0">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Relationship to Previous Home
            </label>
            <div className="grid grid-cols-2 gap-3">
              {RELATIONSHIP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRelationship(opt.value)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    relationship === opt.value
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Account Name</label>
              <input
                type="text"
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                placeholder="e.g., Rocket Mortgage – Main St"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Lender <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={lender}
                onChange={e => setLender(e.target.value)}
                placeholder="e.g., Wells Fargo"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Current Balance</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={balance}
                  onChange={e => setBalance(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Interest Rate</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={interestRate}
                  onChange={e => setInterestRate(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full pl-4 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Monthly Payment</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={minimumPayment}
                  onChange={e => setMinimumPayment(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Original Loan Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={originalAmount}
                  onChange={e => setOriginalAmount(e.target.value)}
                  placeholder="Same as balance"
                  className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Start Date</label>
              <DatePicker
                value={loanStartDate}
                onChange={setLoanStartDate}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Term</label>
              <select
                value={loanTerm}
                onChange={e => setLoanTerm(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              >
                {[10, 15, 20, 25, 30].map(y => (
                  <option key={y} value={y}>{y} years</option>
                ))}
              </select>
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
              Add New Mortgage
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
