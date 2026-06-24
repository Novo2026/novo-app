import { useState } from 'react';
import { Plus, TrendingUp, DollarSign, Target, ChevronDown, ChevronUp, Edit2, Trash2, PiggyBank } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import AddSavingsAccountModal from './AddSavingsAccountModal';
import LogSavingsTransactionModal from './LogSavingsTransactionModal';
import {
  getSavingsCategory,
  getSavingsTypeLabel,
  isSavingsOutflow,
  recalculateSavingsTransactions,
  removeLinkedCheckingTransaction,
} from '../utils/savingsTransactions';
import EditSavingsTransactionModal from './EditSavingsTransactionModal';
import type { SavingsAccount, SavingsTransaction, SavingsTransactionType } from '../types';

export default function SavingsTracker() {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showLogTransaction, setShowLogTransaction] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [transactionType, setTransactionType] = useState<SavingsTransactionType>('deposit');
  const [editingAccount, setEditingAccount] = useState<SavingsAccount | undefined>(undefined);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState<{
    account: SavingsAccount;
    transaction: SavingsTransaction;
  } | null>(null);

  const accounts = StorageService.getSavingsAccounts();
  const metrics = CalculationService.calculateSavingsMetrics(accounts);
  const growthData = CalculationService.calculateSavingsGrowthData(accounts);

  const handleAddAccountClick = () => {
    setEditingAccount(undefined);
    setShowAddAccount(true);
  };

  const handleEditAccountClick = (account: SavingsAccount) => {
    setEditingAccount(account);
    setShowAddAccount(true);
  };

  const handleDeleteAccount = (accountId: string) => {
    if (confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
      const updatedAccounts = accounts.filter(acc => acc.id !== accountId);
      StorageService.saveSavingsAccounts(updatedAccounts);
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleLogTransactionClick = (accountId: string, type: SavingsTransactionType) => {
    setSelectedAccountId(accountId);
    setTransactionType(type);
    setShowLogTransaction(true);
  };

  const handleSuccess = () => {
    setShowAddAccount(false);
    setShowLogTransaction(false);
    setSelectedAccountId(null);
    setEditingAccount(undefined);
    setRefreshKey(prev => prev + 1);
  };

  const toggleAccountExpansion = (accountId: string) => {
    setExpandedAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  const handleDeleteTransaction = (account: SavingsAccount, transaction: SavingsTransaction) => {
    if (transaction.linkedCheckingTransactionId && transaction.linkedCheckingAccountId) {
      const deleteBoth = confirm(
        'This transaction is linked to a checking account transfer.\n\n' +
        'Click OK to delete both transactions, or Cancel to delete only the savings transaction.'
      );
      if (deleteBoth) {
        removeLinkedCheckingTransaction(
          transaction.linkedCheckingAccountId,
          transaction.linkedCheckingTransactionId
        );
      }
    } else if (!confirm('Delete this transaction? Balances will be recalculated.')) {
      return;
    }

    const remaining = account.transactions.filter((t) => t.id !== transaction.id);
    const { transactions, balance } = recalculateSavingsTransactions(remaining);
    const updatedAccounts = StorageService.getSavingsAccounts().map((acc) =>
      acc.id === account.id ? { ...acc, transactions, balance } : acc
    );
    StorageService.saveSavingsAccounts(updatedAccounts);
    setRefreshKey((prev) => prev + 1);
  };

  const getTransactionTypeClass = (transaction: SavingsTransaction) => {
    if (transaction.type === 'withdrawal' || transaction.type === 'transfer_to_checking') {
      return 'bg-red-100 text-red-700';
    }
    if (transaction.type === 'interest') {
      return 'bg-blue-100 text-blue-700';
    }
    if (transaction.type === 'transfer_from_checking') {
      return 'bg-yellow-100 text-yellow-700';
    }
    return 'bg-green-100 text-green-700';
  };

  const chartData = growthData.map(item => ({
    month: item.month,
    balance: item.balance,
  }));

  if (accounts.length === 0) {
    return (
      <>
        <div className="text-center py-16">
          <PiggyBank className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Start Building Your Savings</h2>
          <p className="text-gray-600 mb-6">
            Track your savings accounts, monitor growth, and achieve your financial goals.
          </p>
          <button
            onClick={handleAddAccountClick}
            className="inline-flex items-center space-x-2 bg-[#27AE60] hover:bg-[#229954] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Savings Account</span>
          </button>
        </div>

        {showAddAccount && (
          <AddSavingsAccountModal
            onClose={() => setShowAddAccount(false)}
            onSuccess={handleSuccess}
            existingAccount={editingAccount}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-8" key={refreshKey}>
      <div className="bg-gradient-to-br from-[#27AE60] to-[#229954] text-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6">Savings Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm opacity-90 mb-1">Total Savings</p>
            <p className="text-3xl font-bold">{CalculationService.formatCurrency(metrics.totalSavings)}</p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-1">Number of Accounts</p>
            <p className="text-3xl font-bold">{metrics.numberOfAccounts}</p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-1">Interest Earned (YTD)</p>
            <p className="text-3xl font-bold">{CalculationService.formatCurrency(metrics.totalInterestEarnedYTD)}</p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-1">Monthly Savings Rate</p>
            <p className="text-3xl font-bold">{CalculationService.formatCurrency(metrics.monthlySavingsRate)}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleAddAccountClick}
          className="flex items-center justify-center space-x-3 bg-[#27AE60] hover:bg-[#229954] text-white font-bold py-5 px-12 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          <Plus className="w-6 h-6" />
          <span className="text-lg">Add Savings Account</span>
        </button>
      </div>

      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">Savings Accounts</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {accounts.map(account => {
            const progress = account.goalAmount
              ? (account.balance / account.goalAmount) * 100
              : 0;
            const isExpanded = expandedAccounts.has(account.id);

            return (
              <div
                key={account.id}
                className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-lg text-gray-800">{account.name}</h4>
                      <p className="text-sm text-gray-500">{account.type}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditAccountClick(account)}
                        className="text-gray-400 hover:text-[#2D9CDB] transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(account.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-3xl font-bold text-[#27AE60] mb-1">
                      {CalculationService.formatCurrency(account.balance)}
                    </p>
                    {account.interestRate > 0 && (
                      <p className="text-sm text-gray-500">
                        {account.interestRate}% APY
                      </p>
                    )}
                  </div>

                  {account.goalAmount && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Goal Progress</span>
                        <span>{Math.min(progress, 100).toFixed(1)}% of {CalculationService.formatCurrency(account.goalAmount)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-[#27AE60] h-full rounded-full transition-all"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {account.notes && (
                    <p className="text-sm text-gray-600 mb-4 italic">{account.notes}</p>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleLogTransactionClick(account.id, 'deposit')}
                      className="text-xs bg-[#27AE60] hover:bg-[#229954] text-white font-semibold py-2 px-3 rounded transition-colors"
                    >
                      <Plus className="w-3 h-3 inline mr-1" />
                      Deposit
                    </button>
                    <button
                      onClick={() => handleLogTransactionClick(account.id, 'withdrawal')}
                      className="text-xs bg-[#FF6B35] hover:bg-[#E55A25] text-white font-semibold py-2 px-3 rounded transition-colors"
                    >
                      <TrendingUp className="w-3 h-3 inline mr-1" />
                      Withdraw
                    </button>
                    <button
                      onClick={() => handleLogTransactionClick(account.id, 'interest')}
                      className="text-xs bg-[#2D9CDB] hover:bg-[#1E8BBD] text-white font-semibold py-2 px-3 rounded transition-colors"
                    >
                      <DollarSign className="w-3 h-3 inline mr-1" />
                      Interest
                    </button>
                  </div>
                </div>

                {account.transactions.length > 0 && (
                  <div className="border-t border-gray-200">
                    <button
                      onClick={() => toggleAccountExpansion(account.id)}
                      className="w-full px-6 py-3 flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <span>Transaction History ({account.transactions.length})</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {isExpanded && (
                      <div className="px-6 pb-4 max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-gray-200">
                            <tr className="text-left text-gray-600">
                              <th className="pb-2">Date</th>
                              <th className="pb-2">Type</th>
                              <th className="pb-2">Category</th>
                              <th className="pb-2">Description</th>
                              <th className="pb-2 text-right">Amount</th>
                              <th className="pb-2 text-right">Balance</th>
                              <th className="pb-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...account.transactions]
                              .sort((a, b) => CalculationService.compareDateStrings(b.date, a.date))
                              .map(transaction => (
                                <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="py-2 text-gray-700">
                                    {CalculationService.formatLocalDateShort(transaction.date)}
                                  </td>
                                  <td className="py-2">
                                    <span
                                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getTransactionTypeClass(transaction)}`}
                                    >
                                      {getSavingsTypeLabel(transaction.type)}
                                    </span>
                                  </td>
                                  <td className="py-2 text-gray-600">
                                    {getSavingsCategory(transaction)}
                                  </td>
                                  <td className="py-2 text-gray-700">
                                    {transaction.description || '—'}
                                  </td>
                                  <td className="py-2 text-right font-medium">
                                    <span className={isSavingsOutflow(transaction.type) ? 'text-red-600' : 'text-green-600'}>
                                      {isSavingsOutflow(transaction.type) ? '-' : '+'}
                                      {CalculationService.formatCurrency(transaction.amount)}
                                    </span>
                                  </td>
                                  <td className="py-2 text-right text-gray-700">
                                    {CalculationService.formatCurrency(transaction.balanceAfter)}
                                  </td>
                                  <td className="py-2 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => setEditingTransaction({ account, transaction })}
                                        className="p-2 text-[#2D9CDB] hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Edit"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTransaction(account, transaction)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Savings Growth</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => CalculationService.formatCurrency(value)}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#27AE60"
                strokeWidth={2}
                dot={{ fill: '#27AE60' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {showAddAccount && (
        <AddSavingsAccountModal
          onClose={() => {
            setShowAddAccount(false);
            setEditingAccount(undefined);
          }}
          onSuccess={handleSuccess}
          existingAccount={editingAccount}
        />
      )}

      {showLogTransaction && selectedAccountId && (
        <LogSavingsTransactionModal
          onClose={() => {
            setShowLogTransaction(false);
            setSelectedAccountId(null);
          }}
          onSuccess={handleSuccess}
          accountId={selectedAccountId}
          transactionType={transactionType}
        />
      )}

      {editingTransaction && (
        <EditSavingsTransactionModal
          account={editingTransaction.account}
          transaction={editingTransaction.transaction}
          onClose={() => setEditingTransaction(null)}
          onSuccess={() => {
            setEditingTransaction(null);
            setRefreshKey((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}
