import { useState } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';
import { StorageService } from '../services/storage';

interface BatchEntryModalProps {
  debtId: string;
  debtName: string;
  currentBalance: number;
  minimumPayment: number;
  onClose: () => void;
  onComplete: () => void;
}

export default function BatchEntryModal({
  debtId,
  debtName,
  currentBalance,
  minimumPayment,
  onClose,
  onComplete,
}: BatchEntryModalProps) {
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [frequency, setFrequency] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly');
  const [numEntries, setNumEntries] = useState(12);
  const [amount, setAmount] = useState(minimumPayment.toString());
  const [useMinimum, setUseMinimum] = useState(true);

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getFrequencyDays = () => {
    switch (frequency) {
      case 'weekly': return 7;
      case 'biweekly': return 14;
      case 'monthly': return 30;
      default: return 30;
    }
  };

  const generateEntries = () => {
    const entries = [];
    const startDate = new Date(startYear, startMonth - 1, 1);
    const paymentAmount = useMinimum ? minimumPayment : parseFloat(amount) || 0;

    if (paymentAmount <= 0) {
      alert('Payment amount must be greater than 0');
      return;
    }

    let currentBalance = StorageService.getDebts().find(d => d.id === debtId)?.currentBalance || 0;

    for (let i = 0; i < numEntries; i++) {
      const entryDate = new Date(startDate);

      if (frequency === 'monthly') {
        entryDate.setMonth(startDate.getMonth() + i);
      } else {
        const days = getFrequencyDays();
        entryDate.setDate(startDate.getDate() + (i * days));
      }

      const actualPayment = Math.min(paymentAmount, currentBalance);

      if (actualPayment <= 0) break;

      entries.push({
        id: `batch_${debtId}_${Date.now()}_${i}`,
        debtId,
        amount: actualPayment,
        date: entryDate.toISOString(),
        type: 'payment' as const,
        balanceAfter: currentBalance - actualPayment,
        notes: 'Batch entry (historical data)',
      });

      currentBalance -= actualPayment;
    }

    const existingTransactions = StorageService.getTransactions();
    const allTransactions = [...existingTransactions, ...entries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    localStorage.setItem('novo_transactions', JSON.stringify(allTransactions));

    const debt = StorageService.getDebts().find(d => d.id === debtId);
    if (debt) {
      const latestEntry = entries[entries.length - 1];
      debt.currentBalance = latestEntry.balanceAfter;
      StorageService.saveDebts(StorageService.getDebts());
    }

    onComplete();
    onClose();
  };

  const previewTotal = useMinimum
    ? minimumPayment * numEntries
    : (parseFloat(amount) || 0) * numEntries;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold">Batch Entry Mode</h2>
            <p className="text-sm text-blue-100">For demonstrations and historical data</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-900 font-medium mb-1">
                Entering historical data for: {debtName}
              </p>
              <p className="text-xs text-blue-700">
                This will create multiple backdated transactions. Use this for demonstrations or testing scenarios.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Starting Month
              </label>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {months.map((month, idx) => (
                  <option key={month} value={idx + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Starting Year
              </label>
              <select
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Frequency
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFrequency('monthly')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  frequency === 'monthly'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setFrequency('biweekly')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  frequency === 'biweekly'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Bi-weekly
              </button>
              <button
                type="button"
                onClick={() => setFrequency('weekly')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  frequency === 'weekly'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Weekly
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Entries
            </label>
            <input
              type="number"
              value={numEntries}
              onChange={(e) => setNumEntries(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
              min="1"
              max="24"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum 24 entries</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Amount
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={useMinimum}
                  onChange={() => setUseMinimum(true)}
                  className="w-4 h-4 text-emerald-600"
                />
                <span className="text-sm text-gray-700">
                  Use minimum payment (${minimumPayment.toFixed(2)})
                </span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={!useMinimum}
                  onChange={() => setUseMinimum(false)}
                  className="w-4 h-4 text-emerald-600"
                />
                <span className="text-sm text-gray-700">Custom amount</span>
              </label>
            </div>
            {!useMinimum && (
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                step="0.01"
                min="0"
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            )}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">Preview</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Starting Date</p>
                <p className="font-semibold text-gray-800">
                  {months[startMonth - 1]} {startYear}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Frequency</p>
                <p className="font-semibold text-gray-800 capitalize">{frequency}</p>
              </div>
              <div>
                <p className="text-gray-600">Number of Payments</p>
                <p className="font-semibold text-gray-800">{numEntries}</p>
              </div>
              <div>
                <p className="text-gray-600">Total Amount</p>
                <p className="font-semibold text-gray-800">
                  ${previewTotal.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={generateEntries}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
            >
              Generate Entries
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
