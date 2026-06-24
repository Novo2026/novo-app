import { useState } from 'react';
import { X } from 'lucide-react';
import DatePicker from './DatePicker';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import {
  recalculateCheckingBalances,
  recalculateSavingsTransactions,
} from '../utils/savingsTransactions';
import type { CheckingTransaction, SavingsAccount, SavingsTransactionType } from '../types';

interface LogSavingsTransactionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  transactionType: SavingsTransactionType;
}

const EXTERNAL_DESTINATION = 'external';

export default function LogSavingsTransactionModal({
  onClose,
  onSuccess,
  accountId,
  transactionType,
}: LogSavingsTransactionModalProps) {
  const accounts = StorageService.getSavingsAccounts();
  const account = accounts.find((acc) => acc.id === accountId);
  const checkingAccounts = StorageService.getCheckingAccounts();

  const [formData, setFormData] = useState({
    date: CalculationService.getTodayDateString(),
    amount: '',
    description: '',
  });
  const [destination, setDestination] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amount = parseFloat(formData.amount);
    if (!formData.amount.trim() || isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }
    if (transactionType === 'withdrawal' && amount > account.balance) {
      setError(`Insufficient funds. Current balance: ${CalculationService.formatCurrency(account.balance)}`);
      return;
    }
    if (!formData.date) {
      setError('Please select a date.');
      return;
    }
    if (transactionType === 'withdrawal' && !destination) {
      setError('Please select where this withdrawal is going.');
      return;
    }

    const transferDate = CalculationService.normalizeDateString(formData.date);
    const isCheckingTransfer =
      transactionType === 'withdrawal' && destination !== EXTERNAL_DESTINATION;
    const destinationAccount = isCheckingTransfer
      ? checkingAccounts.find((a) => a.id === destination)
      : undefined;

    if (isCheckingTransfer && !destinationAccount) {
      setError('Selected checking account could not be found.');
      return;
    }

    const sharedDescription = formData.description.trim()
      || (isCheckingTransfer
        ? `Transfer to ${destinationAccount!.name}`
        : getDefaultDescription());

    setIsSubmitting(true);

    try {
      const savingsTxId = `savings_tx_${Date.now()}`;
      const checkingTxId = `checking_${Date.now()}`;

      const savingsType =
        transactionType === 'withdrawal' && isCheckingTransfer
          ? 'transfer_to_checking' as const
          : transactionType;

      const category =
        transactionType === 'withdrawal' && isCheckingTransfer
          ? 'To Checking'
          : transactionType === 'withdrawal'
            ? 'External / Cash'
            : transactionType === 'deposit'
              ? 'Deposit'
              : 'Interest';

      const newTransaction = {
        id: savingsTxId,
        date: transferDate,
        type: savingsType,
        amount,
        description: sharedDescription,
        category,
        balanceAfter: 0,
        ...(isCheckingTransfer
          ? {
              linkedCheckingTransactionId: checkingTxId,
              linkedCheckingAccountId: destination,
            }
          : {}),
      };

      const { transactions: recalculated, balance } = recalculateSavingsTransactions([
        ...account.transactions,
        newTransaction,
      ]);

      const updatedAccount: SavingsAccount = {
        ...account,
        balance,
        transactions: recalculated,
      };

      const updatedAccounts = accounts.map((acc) =>
        acc.id === accountId ? updatedAccount : acc
      );
      StorageService.saveSavingsAccounts(updatedAccounts);

      if (isCheckingTransfer && destinationAccount) {
        const startingBalance = destinationAccount.startingBalance ?? 0;
        const checkingTransactions = StorageService.getCheckingTransactionsForAccount(destination);
        const newCheckingTx: CheckingTransaction = {
          id: checkingTxId,
          accountId: destination,
          date: transferDate,
          type: 'transfer_from_savings',
          amount,
          description: sharedDescription,
          balance: 0,
          isReconciled: false,
          linkedSavingsTransactionId: savingsTxId,
          linkedSavingsAccountId: accountId,
        };

        checkingTransactions.push(newCheckingTx);
        const recalculatedChecking = recalculateCheckingBalances(
          checkingTransactions,
          startingBalance
        );
        StorageService.saveCheckingTransactionsForAccount(destination, recalculatedChecking);
      }

      onSuccess();
    } catch (err) {
      console.error('Failed to log savings transaction:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewBalance = (() => {
    const amount = parseFloat(formData.amount) || 0;
    if (transactionType === 'deposit' || transactionType === 'interest') {
      return Math.max(0, Math.round((account.balance + amount) * 100) / 100);
    }
    return Math.max(0, Math.round((account.balance - amount) * 100) / 100);
  })();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">{getTitle()}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto px-6 py-6 space-y-6 flex-1">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Account</p>
              <p className="text-lg font-bold text-gray-900">{account.name}</p>
              <p className="text-sm text-gray-600 mt-1">
                Current Balance:{' '}
                <span className="font-semibold text-gray-900">
                  {CalculationService.formatCurrency(account.balance)}
                </span>
              </p>
            </div>

            {transactionType === 'withdrawal' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Where is this going? *
                </label>
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                >
                  <option value="">Choose destination...</option>
                  {checkingAccounts.map((checkingAccount) => (
                    <option key={checkingAccount.id} value={checkingAccount.id}>
                      {checkingAccount.name}
                      {checkingAccount.bankName ? ` · ${checkingAccount.bankName}` : ''}
                    </option>
                  ))}
                  <option value={EXTERNAL_DESTINATION}>External / Cash</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Amount *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                />
              </div>
            </div>

            <DatePicker
              label="Date"
              value={formData.date}
              onChange={(value) => setFormData({ ...formData, date: value })}
              demoMode={JSON.parse(localStorage.getItem('novo_demo_mode') || 'false')}
            />

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description (Optional)
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={getDefaultDescription()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
            </div>

            {parseFloat(formData.amount) > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Balance after:</span>
                  <span className="font-semibold text-gray-800">
                    {CalculationService.formatCurrency(previewBalance)}
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
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-brand-green hover:bg-[#229954] disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
            >
              {isSubmitting
                ? 'Saving...'
                : `Log ${transactionType === 'deposit' ? 'Deposit' : transactionType === 'withdrawal' ? 'Withdrawal' : 'Interest'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
