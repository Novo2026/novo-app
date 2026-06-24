import { useState, useEffect } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import DatePicker from './DatePicker';
import type { Debt, Transaction } from '../types';

interface EditPaymentModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditPaymentModal({ transaction, onClose, onSuccess }: EditPaymentModalProps) {
  const [selectedDebtId, setSelectedDebtId] = useState(transaction.debtId);
  const [paymentAmount, setPaymentAmount] = useState(transaction.amount.toString());
  const [paymentDate, setPaymentDate] = useState(transaction.date);
  const [isExtraPayment, setIsExtraPayment] = useState(transaction.isExtraPayment || false);
  const [notes, setNotes] = useState(transaction.notes || '');
  const [showSuccess, setShowSuccess] = useState(false);

  const debts = StorageService.getDebts().filter(d => d.category !== 'HELOC');
  const selectedDebt = debts.find(d => d.id === selectedDebtId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDebtId || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    const allTransactions = StorageService.getTransactions();
    const transactionIndex = allTransactions.findIndex(t => t.id === transaction.id);

    if (transactionIndex === -1) return;

    const updatedTransaction: Transaction = {
      ...transaction,
      debtId: selectedDebtId,
      debtName: selectedDebt?.accountName || transaction.debtName,
      date: paymentDate,
      amount,
      isExtraPayment,
      notes: notes.trim() || undefined,
    };

    allTransactions[transactionIndex] = updatedTransaction;

    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    recalculateAllBalances(allTransactions);

    StorageService.saveTransactions(allTransactions);

    setShowSuccess(true);
  };

  const handleClose = () => {
    if (showSuccess) {
      onSuccess();
    } else {
      onClose();
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-green rounded-full mb-4">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800">Payment Updated!</h3>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700 text-center">
              Payment updated successfully. All balances have been recalculated from {CalculationService.formatDate(paymentDate)} forward.
            </p>
          </div>

          <button
            onClick={handleClose}
            className="w-full bg-brand-blue hover:bg-[#1E8BBD] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-2xl font-bold text-gray-800">Edit Payment</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Which Debt?
            </label>
            <select
              value={selectedDebtId}
              onChange={(e) => setSelectedDebtId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              required
            >
              {debts.map(debt => (
                <option key={debt.id} value={debt.id}>
                  {debt.accountName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Payment Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                placeholder="0.00"
                step="0.01"
                min="0.01"
                required
              />
            </div>
          </div>

          <DatePicker
            label="Payment Date"
            value={paymentDate}
            onChange={setPaymentDate}
            demoMode={JSON.parse(localStorage.getItem('novo_demo_mode') || 'false')}
          />

          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isExtraPayment}
                onChange={(e) => setIsExtraPayment(e.target.checked)}
                className="w-4 h-4 text-brand-blue border-gray-300 rounded focus:ring-brand-blue"
              />
              <span className="text-sm text-gray-700">This was an extra payment (beyond minimum)</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent resize-none"
              rows={2}
              placeholder="Add any notes about this payment..."
            />
          </div>
          </div>

          <div className="flex space-x-3 p-6 pt-4 border-t border-gray-200 flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Update Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function recalculateAllBalances(transactions: Transaction[]) {
  const debts = StorageService.getDebts();
  const debtBalances: Record<string, number> = {};

  debts.forEach(debt => {
    debtBalances[debt.id] = debt.startingBalance;
  });

  transactions.forEach(transaction => {
    const debt = debts.find(d => d.id === transaction.debtId);
    if (!debt) return;

    const previousBalance = debtBalances[transaction.debtId];

    if (transaction.type === 'payment') {
      const calculation = debt.isAmortized
        ? CalculationService.calculateAmortizedPayment(
            { ...debt, currentBalance: previousBalance },
            transaction.amount
          )
        : CalculationService.calculatePayment(
            previousBalance,
            debt.interestRate,
            transaction.amount
          );

      transaction.previousBalance = previousBalance;
      transaction.interestCharged = calculation.interestCharged;
      transaction.principalPaid = calculation.principalPaid;
      transaction.newBalance = calculation.newBalance;

      debtBalances[transaction.debtId] = calculation.newBalance;
    } else if (transaction.type === 'charge') {
      transaction.previousBalance = previousBalance;
      transaction.interestCharged = 0;
      transaction.principalPaid = 0;
      transaction.newBalance = previousBalance + transaction.amount;

      debtBalances[transaction.debtId] = transaction.newBalance;
    }
  });

  const updatedDebts = debts.map(debt => {
    const newBalance = debtBalances[debt.id] !== undefined ? debtBalances[debt.id] : debt.currentBalance;
    const isPaidOff = newBalance === 0;

    return {
      ...debt,
      currentBalance: newBalance,
      isPaidOff,
      paidOffDate: isPaidOff && !debt.isPaidOff ? CalculationService.getTodayDateString() : debt.paidOffDate,
    };
  });

  StorageService.saveDebts(updatedDebts);
}
