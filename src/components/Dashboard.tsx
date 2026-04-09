import { useState } from 'react';
import { Plus, CheckCircle, DollarSign, PiggyBank, ArrowRight, CreditCard as Edit2, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import LogPaymentModal from './LogPaymentModal';
import EditPaymentModal from './EditPaymentModal';
import EditDebtModal from './EditDebtModal';
import DailyTip from './DailyTip';
import type { Debt, Transaction } from '../types';

interface DashboardProps {
  onDataUpdate: () => void;
  onNavigateToSavings?: () => void;
}

export default function Dashboard({ onDataUpdate, onNavigateToSavings }: DashboardProps) {
  const [showLogPayment, setShowLogPayment] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [showEditPayment, setShowEditPayment] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showEditDebt, setShowEditDebt] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingDebt, setDeletingDebt] = useState<Debt | null>(null);

  const debts = StorageService.getDebts();
  const transactions = StorageService.getTransactions();
  const strategyResult = StorageService.getStrategyResult();
  const savingsAccounts = StorageService.getSavingsAccounts();
  const financialProfile = StorageService.getFinancialProfile();

  const metrics = CalculationService.calculateTotalDebtMetrics(debts, transactions);
  const savingsMetrics = CalculationService.calculateSavingsMetrics(savingsAccounts);

  const activeDebts = debts.filter(d => !d.isPaidOff);
  const totalMinimumPayments = activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0);

  let optimizedProjection: { debtFreeDate: string; totalMonths: number } | null = null;
  if (financialProfile && activeDebts.length > 0) {
    const cashFlowMetrics = CalculationService.calculateCashFlow(
      financialProfile.monthlyNetIncome,
      financialProfile.monthlyEssentialExpenses,
      financialProfile.monthlyDiscretionaryExpenses,
      totalMinimumPayments
    );
    const extraPayment = Math.max(0, cashFlowMetrics.recommendedExtraPayment);
    const projection = CalculationService.projectDebtPayoff(activeDebts, extraPayment);
    optimizedProjection = {
      debtFreeDate: projection.debtFreeDate,
      totalMonths: projection.totalMonths
    };
  }

  const getGreeting = (): string => {
    const userName = localStorage.getItem('userName');
    const lastVisit = localStorage.getItem('lastVisit');
    const now = new Date();
    const hour = now.getHours();

    let timeGreeting = '';
    if (hour < 12) {
      timeGreeting = 'Good morning';
    } else if (hour < 18) {
      timeGreeting = 'Good afternoon';
    } else {
      timeGreeting = 'Good evening';
    }

    if (!lastVisit) {
      localStorage.setItem('lastVisit', now.toISOString());
      return `Welcome, ${userName}`;
    }

    const lastVisitDate = new Date(lastVisit);
    const daysSinceLastVisit = Math.floor((now.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));

    localStorage.setItem('lastVisit', now.toISOString());

    if (daysSinceLastVisit > 0) {
      return `Welcome back, ${userName}`;
    }

    return `${timeGreeting}, ${userName}`;
  };

  const handleLogPaymentClick = (debtId?: string) => {
    setSelectedDebtId(debtId || null);
    setShowLogPayment(true);
  };

  const handlePaymentLogged = () => {
    setShowLogPayment(false);
    setSelectedDebtId(null);
    onDataUpdate();
  };

  const handleEditClick = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDebt(debt);
    setShowEditDebt(true);
  };

  const handleDeleteClick = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingDebt(debt);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deletingDebt) {
      StorageService.deleteDebt(deletingDebt.id);
      setShowDeleteConfirm(false);
      setDeletingDebt(null);
      onDataUpdate();
    }
  };

  const handleDebtEdited = () => {
    setShowEditDebt(false);
    setEditingDebt(null);
    onDataUpdate();
  };

  const getRecentActivity = (): { date: string; description: string; type: string; transaction?: Transaction; icon: string; amount?: number; amountColor?: string; source: string }[] => {
    const activities: { date: string; description: string; type: string; transaction?: Transaction; icon: string; amount?: number; amountColor?: string; source: string }[] = [];

    const sortedTransactions = [...transactions].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    sortedTransactions.slice(0, 10).forEach(t => {
      if (t.type === 'payment') {
        const paidWithHELOC = t.paidWithHELOC;
        activities.push({
          date: t.date,
          description: paidWithHELOC
            ? `Paid ${t.debtName} from HELOC`
            : `Paid ${t.debtName}`,
          type: 'payment',
          transaction: t,
          icon: '💰',
          amount: t.amount,
          amountColor: 'text-[#27AE60]',
          source: paidWithHELOC ? 'heloc' : 'debt',
        });
      } else if (t.type === 'charge') {
        activities.push({
          date: t.date,
          description: `Added charge to ${t.debtName}`,
          type: 'charge',
          transaction: t,
          icon: '💳',
          amount: t.amount,
          amountColor: 'text-red-600',
          source: 'debt',
        });
      }
    });

    const helocTransactions = (() => {
      const stored = localStorage.getItem('novo_heloc_transactions');
      return stored ? JSON.parse(stored) : [];
    })();

    helocTransactions.forEach((ht: any) => {
      if (ht.type === 'draw') {
        activities.push({
          date: ht.date,
          description: ht.debtLinked
            ? `Transferred ${ht.debtLinked} to HELOC`
            : ht.description.includes('checking') || ht.description.toLowerCase().includes('expense')
              ? `Transferred to checking for expenses`
              : `HELOC draw`,
          type: 'heloc_draw',
          icon: '🏦',
          amount: ht.amount,
          amountColor: 'text-red-600',
          source: 'heloc',
        });
      } else if (ht.type === 'payment') {
        activities.push({
          date: ht.date,
          description: ht.description.includes('paycheck') || ht.description.includes('income')
            ? `Deposited paycheck to HELOC`
            : ht.description.includes('bonus')
              ? `Deposited bonus to HELOC`
              : `HELOC payment`,
          type: 'heloc_payment',
          icon: '💰',
          amount: ht.amount,
          amountColor: 'text-[#27AE60]',
          source: 'heloc',
        });
      } else if (ht.type === 'interest') {
        activities.push({
          date: ht.date,
          description: 'HELOC interest charge',
          type: 'heloc_interest',
          icon: '💳',
          amount: ht.amount,
          amountColor: 'text-red-600',
          source: 'heloc',
        });
      }
    });

    const checkingTransactions = (() => {
      const stored = localStorage.getItem('novo_checking_transactions');
      return stored ? JSON.parse(stored) : [];
    })();

    checkingTransactions.forEach((ct: any) => {
      if (ct.type === 'transfer_from_heloc') {
        activities.push({
          date: ct.date,
          description: `Received from HELOC for expenses`,
          type: 'checking_transfer',
          icon: '🏦',
          amount: ct.amount,
          amountColor: 'text-[#2D9CDB]',
          source: 'checking',
        });
      } else if (ct.type === 'bill_payment') {
        activities.push({
          date: ct.date,
          description: `Paid ${ct.category || 'bill'}`,
          type: 'checking_withdrawal',
          icon: '💳',
          amount: ct.amount,
          amountColor: 'text-red-600',
          source: 'checking',
        });
      } else if (ct.type === 'deposit') {
        activities.push({
          date: ct.date,
          description: ct.description || 'Deposit',
          type: 'checking_deposit',
          icon: '💰',
          amount: ct.amount,
          amountColor: 'text-[#27AE60]',
          source: 'checking',
        });
      }
    });

    const milestones = StorageService.getMilestones();
    milestones.forEach(m => {
      activities.push({
        date: m.date,
        description: m.title,
        type: 'milestone',
        icon: '🎉',
        source: 'milestone',
      });
    });

    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);
  };

  const recentActivity = getRecentActivity();

  if (debts.length === 0) {
    return (
      <div className="text-center py-16">
        <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to NOVO</h2>
        <p className="text-gray-600 mb-6">Get started by adding your debts and creating a payoff strategy.</p>
        <p className="text-sm text-gray-500 mb-8">
          Track your progress, log payments, and watch your debt disappear over time.
        </p>
      </div>
    );
  }

  const userName = localStorage.getItem('userName');

  return (
    <div className="space-y-8">
      {userName && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{getGreeting()}!</h1>
          <p className="text-gray-600 mt-1">Here's your debt freedom progress</p>
        </div>
      )}

      <DailyTip debts={debts} />

      <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2D5A8A] text-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-4">Total Debt Progress</h2>
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>{metrics.progressPercentage.toFixed(1)}% paid off</span>
            <span>{CalculationService.formatCurrency(metrics.totalCurrentBalance)} remaining</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-4 overflow-hidden">
            <div
              className="bg-[#2D9CDB] h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(metrics.progressPercentage, 100)}%` }}
            />
          </div>
        </div>
        <p className="text-lg mb-2">
          <span className="font-bold">{CalculationService.formatCurrency(metrics.totalCurrentBalance)}</span> remaining of{' '}
          <span className="font-bold">{CalculationService.formatCurrency(metrics.totalStartingBalance)}</span> starting
        </p>
        <div className="group relative">
          <p className="text-xl font-bold text-[#27AE60]">
            You've paid off {CalculationService.formatCurrency(metrics.actualDebtEliminated)} from cash flow!
          </p>
          {(metrics.traditionalDebtPrincipal > 0 || metrics.helocNetPaydown > 0) && (
            <div className="absolute hidden group-hover:block bg-white text-gray-800 rounded-lg shadow-xl p-4 mt-2 z-10 min-w-[300px]">
              <p className="font-semibold text-sm mb-2">Breakdown:</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Traditional debt principal:</span>
                  <span className="font-semibold">{CalculationService.formatCurrency(metrics.traditionalDebtPrincipal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">HELOC net paydown:</span>
                  <span className="font-semibold">{CalculationService.formatCurrency(metrics.helocNetPaydown)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-gray-200">
                  <span className="font-semibold">Total:</span>
                  <span className="font-bold text-[#27AE60]">{CalculationService.formatCurrency(metrics.actualDebtEliminated)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        {optimizedProjection && (
          <p className="mt-4 text-sm opacity-90">
            Projected debt-free date: <span className="font-semibold">{CalculationService.formatMonthYear(optimizedProjection.debtFreeDate)}</span>
          </p>
        )}
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => handleLogPaymentClick()}
          className="flex items-center justify-center space-x-3 bg-[#FF6B35] hover:bg-[#E55A25] text-white font-bold py-5 px-12 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          <Plus className="w-6 h-6" />
          <span className="text-lg">Log Payment</span>
        </button>
      </div>

      {financialProfile && (
        <div className="bg-gradient-to-br from-[#2D9CDB] to-[#1E8BBD] text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <TrendingUp className="w-8 h-8" />
            <h3 className="text-xl font-bold">Total Monthly Cash Flow</h3>
          </div>
          <p className="text-4xl font-bold mb-4">
            {CalculationService.formatCurrency(
              financialProfile.monthlyNetIncome -
              financialProfile.monthlyEssentialExpenses -
              financialProfile.monthlyDiscretionaryExpenses
            )}
          </p>
          <div className="space-y-2 text-sm bg-white/10 rounded-lg p-4 mb-4">
            <p className="font-semibold mb-2">Breakdown:</p>
            <div className="flex justify-between">
              <span className="opacity-90">Minimum debt payments:</span>
              <span className="font-semibold">
                {CalculationService.formatCurrency(
                  metrics.activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0)
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-90">Extra for debt payoff:</span>
              <span className="font-semibold">
                {CalculationService.formatCurrency(
                  financialProfile.monthlyNetIncome -
                  financialProfile.monthlyEssentialExpenses -
                  financialProfile.monthlyDiscretionaryExpenses -
                  metrics.activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0)
                )}
              </span>
            </div>
          </div>
          {metrics.paidOffDebts.length > 0 && (
            <div className="bg-[#27AE60]/20 border-2 border-[#27AE60] rounded-lg p-3">
              <p className="text-sm font-semibold">
                {CalculationService.formatCurrency(
                  metrics.paidOffDebts.reduce((sum, d) => sum + d.minimumPayment, 0)
                )} freed from {metrics.paidOffDebts.length} paid-off debt{metrics.paidOffDebts.length !== 1 ? 's' : ''} now accelerating payoff!
              </p>
            </div>
          )}
        </div>
      )}

      {savingsAccounts.length > 0 && (
        <div className="bg-gradient-to-br from-[#27AE60] to-[#229954] text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <PiggyBank className="w-8 h-8" />
              <h3 className="text-xl font-bold">Savings Summary</h3>
            </div>
            {onNavigateToSavings && (
              <button
                onClick={onNavigateToSavings}
                className="flex items-center space-x-2 text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
              >
                <span>View Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm opacity-90 mb-1">Total Savings</p>
              <p className="text-2xl font-bold">{CalculationService.formatCurrency(savingsMetrics.totalSavings)}</p>
            </div>
            <div>
              <p className="text-sm opacity-90 mb-1">Accounts</p>
              <p className="text-2xl font-bold">{savingsMetrics.numberOfAccounts}</p>
            </div>
            <div>
              <p className="text-sm opacity-90 mb-1">Interest Earned (YTD)</p>
              <p className="text-2xl font-bold">{CalculationService.formatCurrency(savingsMetrics.totalInterestEarnedYTD)}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">Active Debts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {metrics.activeDebts.filter(debt => debt.category !== 'HELOC').map(debt => {
            const paidOff = debt.startingBalance - debt.currentBalance;
            const progress = (paidOff / debt.startingBalance) * 100;

            return (
              <div
                key={debt.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-200"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-lg text-gray-800">{debt.accountName}</h4>
                    <p className="text-sm text-gray-500">{debt.category}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-medium">
                      {debt.interestRate}% APR
                    </span>
                    <button
                      onClick={(e) => handleEditClick(debt, e)}
                      className="p-1.5 text-gray-500 hover:text-[#2D9CDB] hover:bg-blue-50 rounded transition-colors"
                      title="Edit debt"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(debt, e)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete debt"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-3xl font-bold text-[#1E3A5F] mb-1">
                    {CalculationService.formatCurrency(debt.currentBalance)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {CalculationService.formatCurrency(paidOff)} paid off
                  </p>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{progress.toFixed(1)}% complete</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#2D9CDB] h-full rounded-full"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleLogPaymentClick(debt.id)}
                  className="w-full mt-3 bg-[#FF6B35] hover:bg-[#E55A25] text-white text-sm font-semibold py-2 px-4 rounded transition-colors"
                >
                  Log Payment
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {metrics.paidOffDebts.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4">Paid Off Debts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.paidOffDebts.map(debt => (
              <div
                key={debt.id}
                className={`${
                  debt.transferredToHELOC
                    ? 'bg-gradient-to-br from-[#F2994A] to-[#E67E22]'
                    : 'bg-gradient-to-br from-[#27AE60] to-[#229954]'
                } text-white rounded-lg shadow-md p-6`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-bold text-lg">{debt.accountName}</h4>
                  <CheckCircle className="w-6 h-6" />
                </div>
                <p className="text-2xl font-bold mb-1">
                  {debt.transferredToHELOC ? 'Transferred to HELOC' : 'PAID OFF!'}
                </p>
                <p className="text-sm opacity-90">
                  {debt.paidOffDate && CalculationService.formatMonthYear(debt.paidOffDate)}
                </p>
                {debt.transferredToHELOC && (
                  <p className="text-xs opacity-80 mt-2">
                    This debt was moved to your HELOC for lower interest
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {recentActivity.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Recent Activity</h3>
            <span className="text-xs text-gray-500 uppercase tracking-wide">Last 15 transactions</span>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-start space-x-3 flex-1">
                    <span className="text-2xl mt-0.5">{activity.icon}</span>
                    <div className="flex-1">
                      <p className={`font-medium ${activity.type === 'milestone' ? 'text-[#27AE60]' : 'text-gray-800'}`}>
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-gray-500">{CalculationService.formatDate(activity.date)}</p>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs text-gray-400 capitalize">{activity.source}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activity.amount && (
                      <span className={`font-semibold text-sm ${activity.amountColor || 'text-gray-800'}`}>
                        {activity.amountColor === 'text-red-600' ? '+' : ''}{CalculationService.formatCurrency(activity.amount)}
                      </span>
                    )}
                    {activity.transaction && activity.source === 'debt' && (
                      <button
                        onClick={() => {
                          setEditingTransaction(activity.transaction!);
                          setShowEditPayment(true);
                        }}
                        className="text-[#2D9CDB] hover:text-[#1E8BBD] transition-colors p-1"
                        title="Edit transaction"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showLogPayment && (
        <LogPaymentModal
          preselectedDebtId={selectedDebtId}
          onClose={() => {
            setShowLogPayment(false);
            setSelectedDebtId(null);
          }}
          onSuccess={handlePaymentLogged}
        />
      )}

      {showEditPayment && editingTransaction && (
        <EditPaymentModal
          transaction={editingTransaction}
          onClose={() => {
            setShowEditPayment(false);
            setEditingTransaction(null);
          }}
          onSuccess={() => {
            setShowEditPayment(false);
            setEditingTransaction(null);
            onDataUpdate();
          }}
        />
      )}

      {showEditDebt && editingDebt && (
        <EditDebtModal
          debt={editingDebt}
          onClose={() => {
            setShowEditDebt(false);
            setEditingDebt(null);
          }}
          onSuccess={handleDebtEdited}
        />
      )}

      {showDeleteConfirm && deletingDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Delete Debt</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deletingDebt.accountName}</strong>? This will also delete all associated payment history. This cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingDebt(null);
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
