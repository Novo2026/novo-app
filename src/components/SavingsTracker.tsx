import { useState } from 'react';
import {
  Plus,
  DollarSign,
  ChevronDown,
  Edit2,
  Trash2,
  PiggyBank,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import AddSavingsAccountModal from './AddSavingsAccountModal';
import LogSavingsTransactionModal from './LogSavingsTransactionModal';
import {
  deleteSavingsTransactionWithLinkedReversal,
  getSavingsDeleteConfirmationMessage,
  isLinkedSavingsDeleteType,
} from '../utils/linkedTransactionDelete';
import {
  getSavingsTypeLabel,
  isSavingsOutflow,
  recalculateSavingsTransactions,
} from '../utils/savingsTransactions';
import EditSavingsTransactionModal from './EditSavingsTransactionModal';
import {
  getActiveSavingsAccountId,
  setActiveSavingsAccountId,
} from '../utils/activeAccountSession';
import type { SavingsAccount, SavingsTransaction, SavingsTransactionType } from '../types';

function formatChartMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getTransactionDotClass(type: SavingsTransactionType): string {
  if (type === 'withdrawal' || type === 'transfer_to_checking') {
    return 'bg-brand-red';
  }
  if (type === 'interest') {
    return 'bg-brand-blue';
  }
  return 'bg-brand-green';
}

function getTransactionDescription(transaction: SavingsTransaction): string {
  if (transaction.description) {
    return transaction.description;
  }
  return getSavingsTypeLabel(transaction.type);
}

export default function SavingsTracker() {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showLogTransaction, setShowLogTransaction] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(() =>
    getActiveSavingsAccountId(StorageService.getSavingsAccounts())
  );
  const [transactionType, setTransactionType] = useState<SavingsTransactionType>('deposit');
  const [editingAccount, setEditingAccount] = useState<SavingsAccount | undefined>(undefined);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(() => {
    const activeId = getActiveSavingsAccountId(StorageService.getSavingsAccounts());
    return activeId ? new Set([activeId]) : new Set();
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState<{
    account: SavingsAccount;
    transaction: SavingsTransaction;
  } | null>(null);

  const accounts = StorageService.getSavingsAccounts();
  const metrics = CalculationService.calculateSavingsMetrics(accounts);
  const growthData = CalculationService.calculateSavingsGrowthData(accounts);

  const selectActiveAccount = (accountId: string) => {
    setActiveAccountId(accountId);
    setActiveSavingsAccountId(accountId);
    setExpandedAccounts((prev) => new Set(prev).add(accountId));
  };

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
      if (activeAccountId === accountId) {
        const nextActive = updatedAccounts[0]?.id ?? null;
        if (nextActive) {
          selectActiveAccount(nextActive);
        } else {
          setActiveAccountId(null);
        }
      }
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleLogTransactionClick = (accountId: string, type: SavingsTransactionType) => {
    selectActiveAccount(accountId);
    setTransactionType(type);
    setShowLogTransaction(true);
  };

  const handleSuccess = () => {
    setShowAddAccount(false);
    setShowLogTransaction(false);
    setEditingAccount(undefined);
    setRefreshKey((prev) => prev + 1);
  };

  const toggleAccountExpansion = (accountId: string) => {
    selectActiveAccount(accountId);
    setExpandedAccounts((prev) => {
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
    if (!confirm(getSavingsDeleteConfirmationMessage(transaction))) {
      return;
    }

    try {
      if (isLinkedSavingsDeleteType(transaction.type)) {
        deleteSavingsTransactionWithLinkedReversal(account.id, transaction.id);
      } else {
        const remaining = account.transactions.filter((t) => t.id !== transaction.id);
        const { transactions, balance } = recalculateSavingsTransactions(remaining);
        const updatedAccounts = StorageService.getSavingsAccounts().map((acc) =>
          acc.id === account.id ? { ...acc, transactions, balance } : acc
        );
        StorageService.saveSavingsAccounts(updatedAccounts);
      }
      selectActiveAccount(account.id);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed. Please try again.');
    }
  };

  const chartData = growthData.map(item => ({
    month: formatChartMonth(item.month),
    balance: item.balance,
  }));

  const header = (
    <div className="bg-brand-navy py-3 px-5">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div>
          <h1 className="text-white text-lg font-medium leading-tight">Savings</h1>
          <p className="text-white/65 text-xs mt-0.5">Build your financial cushion</p>
        </div>
        <button
          type="button"
          onClick={handleAddAccountClick}
          className="inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-[13px] font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Savings Account</span>
        </button>
      </div>
    </div>
  );

  if (accounts.length === 0) {
    return (
      <div className="bg-brand-gray-light min-h-screen">
        {header}
        <div className="max-w-4xl mx-auto px-5 py-16 text-center">
          <PiggyBank className="w-16 h-16 text-brand-gray mx-auto mb-4" />
          <h2 className="text-xl font-medium text-brand-navy mb-2">Start Building Your Savings</h2>
          <p className="text-sm text-brand-gray">
            Track your savings accounts, monitor growth, and achieve your financial goals.
          </p>
        </div>

        {showAddAccount && (
          <AddSavingsAccountModal
            onClose={() => setShowAddAccount(false)}
            onSuccess={handleSuccess}
            existingAccount={editingAccount}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-brand-gray-light min-h-screen">
      {header}

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-brand-gray-border rounded-lg p-4 border-l-4 border-l-brand-green">
            <p className="text-[11px] uppercase text-brand-gray tracking-wide">Total savings</p>
            <p className="text-[22px] font-medium text-brand-navy mt-1">
              {CalculationService.formatCurrency(metrics.totalSavings)}
            </p>
          </div>
          <div className="bg-white border border-brand-gray-border rounded-lg p-4 border-l-4 border-l-brand-blue">
            <p className="text-[11px] uppercase text-brand-gray tracking-wide">Accounts</p>
            <p className="text-[22px] font-medium text-brand-navy mt-1">{metrics.numberOfAccounts}</p>
          </div>
          <div className="bg-white border border-brand-gray-border rounded-lg p-4 border-l-4 border-l-brand-orange">
            <p className="text-[11px] uppercase text-brand-gray tracking-wide">Interest earned YTD</p>
            <p className="text-[22px] font-medium text-brand-navy mt-1">
              {CalculationService.formatCurrency(metrics.totalInterestEarnedYTD)}
            </p>
          </div>
          <div className="bg-white border border-brand-gray-border rounded-lg p-4 border-l-4 border-l-brand-purple">
            <p className="text-[11px] uppercase text-brand-gray tracking-wide">Monthly savings rate</p>
            <p className="text-[22px] font-medium text-brand-navy mt-1">
              {CalculationService.formatCurrency(metrics.monthlySavingsRate)}
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-base font-medium text-brand-navy mt-5 mb-3">Savings accounts</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {accounts.map(account => {
              const progress = account.goalAmount
                ? (account.balance / account.goalAmount) * 100
                : 0;
              const isExpanded = expandedAccounts.has(account.id);

              return (
                <div
                  key={`${account.id}-${refreshKey}`}
                  className="bg-white border border-brand-gray-border rounded-lg border-t-[3px] border-t-brand-green shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start gap-3 mb-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-[15px] font-medium text-brand-navy">{account.name}</h4>
                          <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-brand-green border border-brand-green">
                            {account.type}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditAccountClick(account)}
                          className="p-1.5 text-brand-gray hover:text-brand-navy transition-colors"
                          title="Edit account"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(account.id)}
                          className="p-1.5 text-brand-gray hover:text-brand-red transition-colors"
                          title="Delete account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-[10px] uppercase text-brand-gray tracking-wide">Current Balance</p>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <p className="text-[22px] font-medium text-brand-navy">
                          {CalculationService.formatCurrency(account.balance)}
                        </p>
                        {account.interestRate > 0 && (
                          <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-brand-green border border-brand-green">
                            {account.interestRate}% APY
                          </span>
                        )}
                      </div>
                    </div>

                    {account.goalAmount && (
                      <div className="mb-4">
                        <div className="flex justify-between text-[11px] text-brand-gray mb-1.5">
                          <span>Goal Progress</span>
                          <span>
                            {Math.min(progress, 100).toFixed(1)}% of{' '}
                            {CalculationService.formatCurrency(account.goalAmount)}
                          </span>
                        </div>
                        <div className="w-full bg-brand-gray-border rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-brand-green h-full rounded-full transition-all"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {account.notes && (
                      <p className="text-xs text-brand-gray mb-4 italic">{account.notes}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleLogTransactionClick(account.id, 'deposit')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 border border-brand-green text-brand-green bg-white hover:bg-green-50 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Deposit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLogTransactionClick(account.id, 'withdrawal')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 border border-brand-red text-brand-red bg-white hover:bg-red-50 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                      >
                        <MinusCircle className="w-3.5 h-3.5" />
                        Withdraw
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLogTransactionClick(account.id, 'interest')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 border border-brand-blue text-brand-blue bg-white hover:bg-blue-50 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Interest
                      </button>
                    </div>
                  </div>

                  {account.transactions.length > 0 && (
                    <div className="border-t border-brand-gray-border">
                      <button
                        type="button"
                        onClick={() => toggleAccountExpansion(account.id)}
                        className="w-full px-5 py-3 flex items-center justify-between text-[13px] font-medium text-brand-navy hover:bg-brand-gray-light transition-colors"
                      >
                        <span>Transaction History ({account.transactions.length})</span>
                        <ChevronDown
                          className={`w-4 h-4 text-brand-gray transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="max-h-64 overflow-y-auto">
                          {[...account.transactions]
                            .sort((a, b) => CalculationService.compareDateStrings(b.date, a.date))
                            .map((transaction, index) => (
                              <div
                                key={transaction.id}
                                className={`flex items-center gap-3 px-5 py-2.5 border-b border-brand-gray-border last:border-b-0 ${
                                  index % 2 === 0 ? 'bg-white' : 'bg-brand-gray-light'
                                }`}
                              >
                                <span className="text-[11px] text-brand-gray w-16 shrink-0">
                                  {CalculationService.formatLocalDateShort(transaction.date)}
                                </span>
                                <div className="flex items-center gap-2 flex-1">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${getTransactionDotClass(transaction.type)}`}
                                  />
                                  <span className="text-[13px] text-brand-navy">
                                    {getTransactionDescription(transaction)}
                                  </span>
                                </div>
                                <span
                                  className={`text-[13px] font-medium shrink-0 ${
                                    isSavingsOutflow(transaction.type) ? 'text-brand-red' : 'text-brand-green'
                                  }`}
                                >
                                  {isSavingsOutflow(transaction.type) ? '-' : '+'}
                                  {CalculationService.formatCurrency(transaction.amount)}
                                </span>
                                <span className="text-[11px] text-brand-gray w-20 text-right shrink-0 hidden sm:block">
                                  {CalculationService.formatCurrency(transaction.balanceAfter)}
                                </span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      selectActiveAccount(account.id);
                                      setEditingTransaction({ account, transaction });
                                    }}
                                    className="p-1.5 text-brand-gray hover:text-brand-navy transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      selectActiveAccount(account.id);
                                      handleDeleteTransaction(account, transaction);
                                    }}
                                    className="p-1.5 text-brand-gray hover:text-brand-red transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
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
          <div className="bg-white border border-brand-gray-border rounded-lg p-5">
            <h3 className="text-sm font-medium text-brand-navy mb-4">Savings growth</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="savingsGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(39,174,96,0.15)" />
                    <stop offset="100%" stopColor="rgba(39,174,96,0)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number) => CalculationService.formatCurrency(value)}
                  contentStyle={{
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#27AE60"
                  strokeWidth={2}
                  fill="url(#savingsGrowthGradient)"
                  dot={{ fill: '#27AE60', r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

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

      {showLogTransaction && activeAccountId && (
        <LogSavingsTransactionModal
          onClose={() => {
            setShowLogTransaction(false);
          }}
          onSuccess={handleSuccess}
          accountId={activeAccountId}
          transactionType={transactionType}
        />
      )}

      {editingTransaction && (
        <EditSavingsTransactionModal
          account={editingTransaction.account}
          transaction={editingTransaction.transaction}
          onClose={() => setEditingTransaction(null)}
          onSuccess={() => {
            selectActiveAccount(editingTransaction.account.id);
            setEditingTransaction(null);
            setRefreshKey((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}
