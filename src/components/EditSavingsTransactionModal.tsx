import { useState } from 'react';
import { X } from 'lucide-react';
import DatePicker from './DatePicker';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import {
  getSavingsCategory,
  recalculateCheckingBalances,
  recalculateSavingsTransactions,
  toEditType,
  type SavingsEditType,
} from '../utils/savingsTransactions';
import type { SavingsAccount, SavingsTransaction } from '../types';

interface EditSavingsTransactionModalProps {
  account: SavingsAccount;
  transaction: SavingsTransaction;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditSavingsTransactionModal({
  account,
  transaction,
  onClose,
  onSuccess,
}: EditSavingsTransactionModalProps) {
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [date, setDate] = useState(CalculationService.normalizeDateString(transaction.date));
  const [description, setDescription] = useState(transaction.description);
  const [type, setType] = useState<SavingsEditType>(toEditType(transaction.type));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const previewBalance = (() => {
    const others = account.transactions.filter((t) => t.id !== transaction.id);
    const edited: SavingsTransaction = {
      ...transaction,
      amount: parsedAmount,
      date: CalculationService.normalizeDateString(date),
      type:
        type === 'transfer'
          ? transaction.type === 'transfer_from_checking' || transaction.type === 'transfer_to_checking'
            ? transaction.type
            : 'transfer'
          : type,
      description: description.trim() || transaction.description,
    };
    return recalculateSavingsTransactions([...others, edited]).balance;
  })();

  const handleSubmit = () => {
    setError(null);

    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!date) {
      setError('Please select a date.');
      return;
    }

    const transferDate = CalculationService.normalizeDateString(date);
    const trimmedDescription = description.trim();

    setIsSubmitting(true);

    try {
      const resolvedType =
        type === 'transfer'
          ? transaction.type === 'transfer_from_checking' || transaction.type === 'transfer_to_checking'
            ? transaction.type
            : 'transfer'
          : type;

      const category =
        resolvedType === 'transfer_to_checking'
          ? 'To Checking'
          : resolvedType === 'transfer_from_checking'
            ? 'From Checking'
            : resolvedType === 'withdrawal'
              ? transaction.category === 'External / Cash'
                ? 'External / Cash'
                : 'Withdrawal'
              : resolvedType === 'deposit'
                ? 'Deposit'
                : resolvedType === 'interest'
                  ? 'Interest'
                  : getSavingsCategory(transaction);

      const updatedTransaction: SavingsTransaction = {
        ...transaction,
        date: transferDate,
        amount: parsedAmount,
        type: resolvedType,
        description: trimmedDescription || transaction.description,
        category,
      };

      const otherTransactions = account.transactions.filter((t) => t.id !== transaction.id);
      const { transactions: recalculated, balance } = recalculateSavingsTransactions([
        ...otherTransactions,
        updatedTransaction,
      ]);

      const updatedAccount: SavingsAccount = {
        ...account,
        balance,
        transactions: recalculated,
      };

      const allAccounts = StorageService.getSavingsAccounts().map((acc) =>
        acc.id === account.id ? updatedAccount : acc
      );
      StorageService.saveSavingsAccounts(allAccounts);

      if (
        transaction.linkedCheckingTransactionId &&
        transaction.linkedCheckingAccountId
      ) {
        const checkingAccount = StorageService.getCheckingAccounts().find(
          (a) => a.id === transaction.linkedCheckingAccountId
        );
        const startingBalance = checkingAccount?.startingBalance ?? 0;
        const checkingTransactions = StorageService.getCheckingTransactionsForAccount(
          transaction.linkedCheckingAccountId
        );
        const checkingIndex = checkingTransactions.findIndex(
          (t) => t.id === transaction.linkedCheckingTransactionId
        );

        if (checkingIndex !== -1) {
          const existing = checkingTransactions[checkingIndex];
          checkingTransactions[checkingIndex] = {
            ...existing,
            date: transferDate,
            amount: parsedAmount,
            description: trimmedDescription || existing.description,
          };
          const recalculatedChecking = recalculateCheckingBalances(
            checkingTransactions,
            startingBalance
          );
          StorageService.saveCheckingTransactionsForAccount(
            transaction.linkedCheckingAccountId,
            recalculatedChecking
          );
        }
      }

      onSuccess();
    } catch (err) {
      console.error('Failed to update savings transaction:', err);
      setError(err instanceof Error ? err.message : 'Update failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isInflow =
    type === 'deposit' ||
    type === 'interest' ||
    (type === 'transfer' && transaction.type === 'transfer_from_checking');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">Edit Transaction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6 space-y-4 flex-1">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Account</p>
            <p className="text-lg font-bold text-gray-900">{account.name}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SavingsEditType)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
            >
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="interest">Interest</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
            </div>
          </div>

          <DatePicker
            label="Date"
            value={date}
            onChange={setDate}
            demoMode={JSON.parse(localStorage.getItem('novo_demo_mode') || 'false')}
          />

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
            />
          </div>

          {parsedAmount > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Balance after update:</span>
                <span className="font-semibold text-gray-800">
                  {CalculationService.formatCurrency(previewBalance)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Impact:</span>
                <span className={`font-semibold ${isInflow ? 'text-green-600' : 'text-red-600'}`}>
                  {isInflow ? '+' : '-'}
                  {CalculationService.formatCurrency(parsedAmount)}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">
              {error}
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
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-brand-green hover:bg-[#229954] disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {isSubmitting ? 'Updating...' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}
