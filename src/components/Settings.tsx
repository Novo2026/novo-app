import { useState, useEffect } from 'react';
import { Trash2, Download, AlertTriangle, CheckCircle, User, DollarSign } from 'lucide-react';
import { StorageService } from '../services/storage';
import type { FinancialProfile } from '../types';

interface SettingsProps {
  onDataUpdate: () => void;
}

export default function Settings({ onDataUpdate }: SettingsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [showProfileSuccess, setShowProfileSuccess] = useState(false);
  const [showFinancialSuccess, setShowFinancialSuccess] = useState(false);
  const [financialProfile, setFinancialProfile] = useState<FinancialProfile>({
    monthlyGrossIncome: 0,
    monthlyNetIncome: 0,
    monthlyEssentialExpenses: 0,
    monthlyDiscretionaryExpenses: 0,
  });

  useEffect(() => {
    const profile = StorageService.getFinancialProfile();
    if (profile) {
      setFinancialProfile(profile);
    }
  }, []);

  const handleExportPaymentHistory = () => {
    const transactions = StorageService.getTransactions();
    const headers = ['Date', 'Debt', 'Type', 'Previous Balance', 'Interest', 'Principal', 'Payment/Charge', 'New Balance', 'Notes'];
    const rows = transactions.map(t => [
      t.date,
      t.debtName,
      t.type,
      t.previousBalance.toFixed(2),
      t.interestCharged.toFixed(2),
      t.principalPaid.toFixed(2),
      t.amount.toFixed(2),
      t.newBalance.toFixed(2),
      t.notes || '',
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    downloadCSV(csv, 'payment_history.csv');
  };

  const handleExportDebtSummary = () => {
    const debts = StorageService.getDebts();
    const headers = ['Account Name', 'Category', 'Starting Balance', 'Current Balance', 'Amount Paid Off', 'Interest Rate', 'Minimum Payment', 'Status'];
    const rows = debts.map(d => [
      d.accountName,
      d.category,
      d.startingBalance.toFixed(2),
      d.currentBalance.toFixed(2),
      (d.startingBalance - d.currentBalance).toFixed(2),
      d.interestRate.toString(),
      d.minimumPayment.toFixed(2),
      d.isPaidOff ? 'Paid Off' : 'Active',
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    downloadCSV(csv, 'debt_summary.csv');
  };

  const handleExportFullReport = () => {
    const data = StorageService.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novo_full_report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveProfile = () => {
    if (userName.trim()) {
      localStorage.setItem('userName', userName.trim());
      setShowProfileSuccess(true);
      setTimeout(() => {
        setShowProfileSuccess(false);
      }, 3000);
    }
  };

  const handleSaveFinancialProfile = () => {
    if (financialProfile.monthlyGrossIncome > 0 && financialProfile.monthlyNetIncome > 0) {
      StorageService.saveFinancialProfile(financialProfile);
      setShowFinancialSuccess(true);
      onDataUpdate();
      setTimeout(() => {
        setShowFinancialSuccess(false);
      }, 3000);
    }
  };

  const handleClearAllData = () => {
    if (deleteConfirmText !== 'DELETE') {
      return;
    }

    StorageService.clearAllData();
    localStorage.removeItem('userName');
    localStorage.removeItem('lastVisit');
    localStorage.removeItem('userAddress');
    setShowDeleteConfirm(false);
    setShowSuccess(true);

    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
  };

  if (showSuccess) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#27AE60] rounded-full mb-6">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">All Data Cleared</h2>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Settings</h2>
        <p className="text-gray-600">Manage your profile, data, and export options.</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <User className="w-6 h-6 text-[#1E3A5F]" />
          <h3 className="text-xl font-bold text-gray-800">Edit Profile</h3>
        </div>
        <p className="text-gray-600 mb-6">
          Update your personal information.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              maxLength={50}
            />
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={!userName.trim()}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Save Changes
          </button>

          {showProfileSuccess && (
            <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Profile updated successfully!</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="w-6 h-6 text-[#1E3A5F]" />
          <h3 className="text-xl font-bold text-gray-800">Financial Profile</h3>
        </div>
        <p className="text-gray-600 mb-6">
          Update your income and expense information. These values are used in payment strategy calculations.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Gross Monthly Income
            </label>
            <p className="text-xs text-gray-500 mb-2">Total income before taxes and deductions</p>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={financialProfile.monthlyGrossIncome || ''}
                onChange={(e) => setFinancialProfile({ ...financialProfile, monthlyGrossIncome: parseFloat(e.target.value) || 0 })}
                onFocus={(e) => {
                  if (e.target.value === '0') e.target.value = '';
                }}
                placeholder="Enter amount"
                className="w-full pl-8 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Net Monthly Income
            </label>
            <p className="text-xs text-gray-500 mb-2">Take-home pay after taxes and deductions</p>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={financialProfile.monthlyNetIncome || ''}
                onChange={(e) => setFinancialProfile({ ...financialProfile, monthlyNetIncome: parseFloat(e.target.value) || 0 })}
                onFocus={(e) => {
                  if (e.target.value === '0') e.target.value = '';
                }}
                placeholder="Enter amount"
                className="w-full pl-8 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Monthly Essential Expenses
            </label>
            <p className="text-xs text-gray-500 mb-2">Housing, utilities, groceries, insurance, transportation</p>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={financialProfile.monthlyEssentialExpenses || ''}
                onChange={(e) => setFinancialProfile({ ...financialProfile, monthlyEssentialExpenses: parseFloat(e.target.value) || 0 })}
                onFocus={(e) => {
                  if (e.target.value === '0') e.target.value = '';
                }}
                placeholder="Enter amount"
                className="w-full pl-8 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Monthly Discretionary Expenses
            </label>
            <p className="text-xs text-gray-500 mb-2">Entertainment, dining out, shopping, subscriptions</p>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={financialProfile.monthlyDiscretionaryExpenses || ''}
                onChange={(e) => setFinancialProfile({ ...financialProfile, monthlyDiscretionaryExpenses: parseFloat(e.target.value) || 0 })}
                onFocus={(e) => {
                  if (e.target.value === '0') e.target.value = '';
                }}
                placeholder="Enter amount"
                className="w-full pl-8 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <button
            onClick={handleSaveFinancialProfile}
            disabled={!(financialProfile.monthlyGrossIncome > 0 && financialProfile.monthlyNetIncome > 0)}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Save Financial Profile
          </button>

          {showFinancialSuccess && (
            <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Financial profile updated successfully!</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Export Data</h3>
        <p className="text-gray-600 mb-6">
          Download your data for backup or analysis purposes.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleExportPaymentHistory}
            className="w-full flex items-center justify-between bg-[#2D9CDB] hover:bg-[#1E8BBD] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <span>Export Payment History</span>
            <Download className="w-5 h-5" />
          </button>

          <button
            onClick={handleExportDebtSummary}
            className="w-full flex items-center justify-between bg-[#2D9CDB] hover:bg-[#1E8BBD] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <span>Export Debt Summary</span>
            <Download className="w-5 h-5" />
          </button>

          <button
            onClick={handleExportFullReport}
            className="w-full flex items-center justify-between bg-[#1E3A5F] hover:bg-[#152A45] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <span>Export Full Report (JSON)</span>
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border-2 border-red-200 p-6">
        <div className="flex items-start space-x-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-xl font-bold text-red-600 mb-2">Danger Zone</h3>
            <p className="text-gray-700">
              This action will permanently delete all your data from NOVO. This cannot be undone.
            </p>
          </div>
        </div>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            <span>Clear All Data</span>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-300 rounded-lg p-4">
              <p className="font-bold text-red-800 mb-3">
                This will permanently delete:
              </p>
              <ul className="list-disc list-inside space-y-1 text-red-700 text-sm mb-4">
                <li>All debts</li>
                <li>Payment history</li>
                <li>Financial profile</li>
                <li>Strategy results</li>
              </ul>
              <p className="font-bold text-red-800 mb-2">
                This action cannot be undone!
              </p>
              <p className="text-sm text-red-700">
                Type <span className="font-bold">DELETE</span> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full mt-2 px-4 py-2 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Type DELETE"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                disabled={deleteConfirmText !== 'DELETE'}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Yes, Delete Everything
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#2D9CDB]/10 border border-[#2D9CDB] rounded-lg p-6">
        <h3 className="font-bold text-gray-800 mb-2">About NOVO</h3>
        <p className="text-sm text-gray-700 mb-4">
          NOVO is a comprehensive debt payoff calculator designed to help mortgage consultants coach clients on accelerated debt elimination strategies.
        </p>
        <div className="text-sm text-gray-600 space-y-1">
          <p><span className="font-semibold">Version:</span> 1.0.0</p>
          <p><span className="font-semibold">Data Storage:</span> Local (Browser)</p>
          <p><span className="font-semibold">Privacy:</span> All data stays on your device</p>
        </div>
      </div>
    </div>
  );
}
