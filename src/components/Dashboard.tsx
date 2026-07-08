import { useEffect, useState } from 'react';
import {
  Plus,
  CheckCircle,
  CheckCircle2,
  DollarSign,
  CreditCard,
  Pencil,
  Trash2,
  Target,
  Sliders,
  Lightbulb,
  ArrowDown,
  ArrowUp,
  PiggyBank,
  ArrowLeftRight,
  type LucideIcon,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import { runMilestoneDetection } from '../utils/milestoneEngine';
import LogPaymentModal from './LogPaymentModal';
import EditPaymentModal from './EditPaymentModal';
import EditDebtModal from './EditDebtModal';
import StartHereRibbon from './StartHereRibbon';
import FinancialHealthScore, { computeFinancialHealthScore } from './FinancialHealthScore';
import MortgageBalanceModal from './MortgageBalanceModal';
import {
  formatLoanStartDateForDisplay,
  formatOriginalAmountForDisplay,
  formatProjectedPayoffMonthYear,
  getProjectedPayoffDate,
} from '../utils/installmentLoan';
import {
  calculateMonthlyPayoffForDebt,
  projectPayoffForFrequencyForDebt,
} from '../utils/paymentCalculations';
import type { Debt, Transaction } from '../types';

interface DashboardProps {
  onDataUpdate: () => void;
  onNavigateToSavings?: () => void;
  onNavigateToTracker?: () => void;
  onNavigateToSmarterPayments?: () => void;
  onNavigate?: (section: string) => void;
  onOpenChat?: (context: string) => void;
}

function getCheckingAccountBalance(accountId: string, startingBalance: number): number {
  const txs = StorageService.getCheckingTransactionsForAccount(accountId);
  if (txs.length === 0) return startingBalance;
  return txs[txs.length - 1].balance;
}

function formatPaidOffDate(date: string | undefined | null): string {
  if (!date || Number.isNaN(new Date(date).getTime())) {
    return 'Date not recorded';
  }
  return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getDebtProgressInfo(debt: Debt) {
  const originalBalance = debt.startingBalance;
  const paidOff = originalBalance - debt.currentBalance;
  const isOpenAccount = debt.currentBalance === 0 && originalBalance === 0;
  const percentage = originalBalance > 0 ? (paidOff / originalBalance) * 100 : 0;
  return { paidOff, percentage, isOpenAccount };
}

function formatDebtApr(debt: Debt): string {
  const precision = debt.category === 'Mortgage' ? 3 : 2;
  return debt.interestRate.toFixed(precision);
}

function isDebtFreedomDebt(debt: Debt): boolean {
  return debt.category !== 'Mortgage' && debt.category !== 'HELOC' && debt.id !== 'HELOC_VIRTUAL';
}

function formatMortgageStartedDate(debt: Debt): string {
  if (debt.loanStartDate) return formatLoanStartDateForDisplay(debt.loanStartDate);
  return new Date(debt.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getMortgagePayoffDateLabel(mortgages: Debt[]): string | null {
  let latest: Date | null = null;
  for (const mortgage of mortgages) {
    const payoff = getProjectedPayoffDate(mortgage);
    if (payoff && (!latest || payoff.getTime() > latest.getTime())) {
      latest = payoff;
    }
  }
  if (latest) {
    return latest.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  for (const mortgage of mortgages) {
    const label = formatProjectedPayoffMonthYear(mortgage);
    if (label) return label;
  }
  return null;
}

function getMortgageBiweeklyTip(mortgage: Debt): { monthsSaved: number; interestSaved: number } | null {
  if (mortgage.interestRate <= 6) return null;
  const monthly = calculateMonthlyPayoffForDebt(mortgage);
  const biweekly = projectPayoffForFrequencyForDebt(mortgage, 'biweekly');
  if (monthly.months >= 999 || biweekly.months >= 999) return null;
  const monthsSaved = Math.max(0, monthly.months - biweekly.months);
  const interestSaved = Math.max(0, monthly.totalInterest - biweekly.totalInterest);
  if (monthsSaved <= 0 && interestSaved <= 0) return null;
  return { monthsSaved, interestSaved };
}

function getDebtRowAccentBorder(debt: Debt, isOpenAccount: boolean): string {
  if (isOpenAccount) return 'border-l-brand-gray';
  switch (debt.category) {
    case 'Mortgage':
      return 'border-l-brand-blue';
    case 'Auto Loan':
      return 'border-l-brand-orange';
    case 'Credit Card':
      return 'border-l-brand-red';
    case 'Personal Loan':
      return 'border-l-brand-green';
    default:
      return 'border-l-brand-gray';
  }
}

function getActivityDisplayMeta(type: string): {
  iconBg: string;
  iconColor: string;
  Icon: LucideIcon;
} {
  switch (type) {
    case 'payment':
      return { iconBg: 'bg-purple-100', iconColor: 'text-purple-700', Icon: CreditCard };
    case 'checking_deposit':
    case 'heloc_payment':
    case 'transfer_from_savings':
      return { iconBg: 'bg-green-100', iconColor: 'text-green-700', Icon: ArrowDown };
    case 'charge':
    case 'heloc_interest':
    case 'checking_withdrawal':
      return { iconBg: 'bg-red-100', iconColor: 'text-red-700', Icon: ArrowUp };
    case 'transfer_to_savings':
      return { iconBg: 'bg-amber-100', iconColor: 'text-amber-700', Icon: PiggyBank };
    case 'heloc_draw':
    case 'checking_transfer':
    case 'transfer_to_checking':
      return { iconBg: 'bg-blue-100', iconColor: 'text-blue-700', Icon: ArrowLeftRight };
    case 'milestone':
      return { iconBg: 'bg-green-100', iconColor: 'text-green-700', Icon: CheckCircle };
    default:
      return { iconBg: 'bg-brand-gray-light', iconColor: 'text-brand-gray', Icon: ArrowDown };
  }
}

export default function Dashboard({
  onDataUpdate,
  onNavigateToSavings,
  onNavigate,
  onOpenChat,
}: DashboardProps) {
  useEffect(() => {
    runMilestoneDetection();
  }, []);

  const [showLogPayment, setShowLogPayment] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [quickPayAmount, setQuickPayAmount] = useState<number | undefined>(undefined);
  const [showEditPayment, setShowEditPayment] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showEditDebt, setShowEditDebt] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingDebt, setDeletingDebt] = useState<Debt | null>(null);
  const [showMortgageBalanceModal, setShowMortgageBalanceModal] = useState(false);

  const debts = StorageService.getDebts();
  const transactions = StorageService.getTransactions();
  const strategyResult = StorageService.getStrategyResult();
  const savingsAccounts = StorageService.getSavingsAccounts();
  const financialProfile = StorageService.getFinancialProfile();

  const metrics = CalculationService.calculateTotalDebtMetrics(debts, transactions);
  const savingsMetrics = CalculationService.calculateSavingsMetrics(savingsAccounts);

  const activeDebts = debts.filter(d => !d.isPaidOff);
  const planActiveDebts = debts.filter(d => !d.isPaidOff && d.currentBalance > 0);
  const totalMinimumPayments = planActiveDebts.reduce((sum, d) => sum + d.minimumPayment, 0);

  const [commitmentPercent, setCommitmentPercent] = useState<number>(
    financialProfile?.surplusCommitmentPercent ?? 100
  );

  useEffect(() => {
    setCommitmentPercent(financialProfile?.surplusCommitmentPercent ?? 100);
  }, [financialProfile?.surplusCommitmentPercent]);

  const cashFlowMetrics = financialProfile
    ? CalculationService.calculateCashFlow(
        financialProfile.monthlyNetIncome,
        financialProfile.monthlyEssentialExpenses,
        financialProfile.monthlyDiscretionaryExpenses,
        totalMinimumPayments,
        financialProfile.monthlySavingsGoal ?? 0,
        commitmentPercent
      )
    : null;

  const extraForDebtPayoff = cashFlowMetrics
    ? Math.max(0, cashFlowMetrics.recommendedExtraPayment)
    : 0;

  let optimizedProjection: { debtFreeDate: string; totalMonths: number } | null = null;
  if (financialProfile && planActiveDebts.length > 0) {
    const projection = CalculationService.projectDebtPayoff(planActiveDebts, extraForDebtPayoff);
    optimizedProjection = {
      debtFreeDate: projection.debtFreeDate,
      totalMonths: projection.totalMonths,
    };
  }

  const debtFreedomDebts = debts.filter(isDebtFreedomDebt);
  const hasDebtFreedomDebts = debtFreedomDebts.length > 0;
  const activeMortgages = debts.filter(
    (d) => d.category === 'Mortgage' && !d.isPaidOff && d.currentBalance > 0
  );
  const hasActiveMortgage = activeMortgages.length > 0;
  const mortgageOnlyClient = hasActiveMortgage && !hasDebtFreedomDebts;

  const dfStartingBalance = debtFreedomDebts.reduce((sum, d) => sum + d.startingBalance, 0);
  const dfCurrentBalance = debtFreedomDebts
    .filter((d) => !d.isPaidOff)
    .reduce((sum, d) => sum + d.currentBalance, 0);
  const dfProgressPercentage =
    dfStartingBalance > 0
      ? Math.min(100, ((dfStartingBalance - dfCurrentBalance) / dfStartingBalance) * 100)
      : 0;

  const debtFreedomIds = new Set(debtFreedomDebts.map((d) => d.id));
  const dfCashFlowPaidOff = StorageService.getUnifiedPayments()
    .filter((p) => debtFreedomIds.has(p.debtId) && (p.source !== 'heloc' || !p.transferredToHELOC))
    .reduce((sum, p) => sum + p.principalPaid, 0);

  const freedomPlanDebts = debtFreedomDebts.filter((d) => !d.isPaidOff && d.currentBalance > 0);
  let freedomProjection: { debtFreeDate: string; totalMonths: number } | null = null;
  if (financialProfile && freedomPlanDebts.length > 0) {
    const projection = CalculationService.projectDebtPayoff(freedomPlanDebts, extraForDebtPayoff);
    freedomProjection = {
      debtFreeDate: projection.debtFreeDate,
      totalMonths: projection.totalMonths,
    };
  }

  const mortgageTotalBalance = activeMortgages.reduce((sum, d) => sum + d.currentBalance, 0);
  const mortgagePayoffLabel = hasActiveMortgage ? getMortgagePayoffDateLabel(activeMortgages) : null;
  const mortgageProgressAvg =
    activeMortgages.length > 0
      ? activeMortgages.reduce((sum, m) => sum + getDebtProgressInfo(m).percentage, 0) /
        activeMortgages.length
      : 0;

  const metricDebtBalance = hasDebtFreedomDebts
    ? dfCurrentBalance
    : hasActiveMortgage
      ? mortgageTotalBalance
      : metrics.totalCurrentBalance;
  const metricDebtProgress = hasDebtFreedomDebts
    ? dfProgressPercentage
    : hasActiveMortgage
      ? mortgageProgressAvg
      : metrics.progressPercentage;
  const metricDebtDateLabel = hasDebtFreedomDebts
    ? freedomProjection
      ? CalculationService.formatMonthYear(freedomProjection.debtFreeDate)
      : '—'
    : hasActiveMortgage
      ? mortgagePayoffLabel ?? '—'
      : optimizedProjection
        ? CalculationService.formatMonthYear(optimizedProjection.debtFreeDate)
        : '—';
  const metricDebtDateSubtext = hasDebtFreedomDebts
    ? hasActiveMortgage
      ? 'Non-mortgage debts'
      : 'Non-mortgage debts'
    : hasActiveMortgage
      ? 'Mortgage'
      : 'Non-mortgage debts';
  const metricDebtCardLabel = mortgageOnlyClient ? 'Mortgage balance' : 'Total debt';

  const handleCommitmentChange = (value: number) => {
    setCommitmentPercent(value);
    if (financialProfile) {
      StorageService.saveFinancialProfile({
        ...financialProfile,
        surplusCommitmentPercent: value,
      });
    }
  };

  const handleCommitmentCommit = () => {
    onDataUpdate();
  };

  const nonHelocActive = activeDebts.filter(d => d.category !== 'HELOC');
  const targetDebt: Debt | null = (() => {
    if (strategyResult && strategyResult.payoffTimeline.length > 0) {
      const firstPayoffId = strategyResult.payoffTimeline[0].debtId;
      const found = nonHelocActive.find(d => d.id === firstPayoffId);
      if (found) return found;
    }
    if (nonHelocActive.length === 0) return null;
    return [...nonHelocActive].sort((a, b) => b.interestRate - a.interestRate)[0];
  })();

  const targetTotalPayment = targetDebt
    ? targetDebt.minimumPayment + extraForDebtPayoff
    : 0;

  const getTimeOfDay = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  };

  const handleLogPaymentClick = (debtId?: string) => {
    setSelectedDebtId(debtId || null);
    setQuickPayAmount(undefined);
    setShowLogPayment(true);
  };

  const handleQuickPay = () => {
    if (!targetDebt) return;
    setSelectedDebtId(targetDebt.id);
    setQuickPayAmount(Math.round(targetTotalPayment));
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
          amountColor: 'text-brand-green',
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
          amountColor: 'text-brand-green',
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
          icon: '',
          amount: ct.amount,
          amountColor: 'text-brand-blue',
          source: 'checking',
        });
      } else if (ct.type === 'bill_payment') {
        activities.push({
          date: ct.date,
          description: `Paid ${ct.category || 'bill'}`,
          type: 'checking_withdrawal',
          icon: '',
          amount: ct.amount,
          amountColor: 'text-red-600',
          source: 'checking',
        });
      } else if (ct.type === 'deposit') {
        activities.push({
          date: ct.date,
          description: ct.description || 'Deposit',
          type: 'checking_deposit',
          icon: '',
          amount: ct.amount,
          amountColor: 'text-brand-green',
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

  const checkingAccounts = StorageService.getCheckingAccounts();
  const cashOnHand = checkingAccounts.reduce(
    (sum, account) => sum + getCheckingAccountBalance(account.id, account.startingBalance),
    0
  );

  const healthScore = computeFinancialHealthScore({
    monthlyGrossIncome: financialProfile?.monthlyGrossIncome ?? 0,
    totalMinimumPayments,
    monthlySurplus: cashFlowMetrics?.grossSurplus ?? null,
    debtProgressPercent: hasDebtFreedomDebts ? dfProgressPercentage : mortgageProgressAvg,
    monthlySavingsGoal: financialProfile?.monthlySavingsGoal ?? 0,
    monthlySavingsRate: savingsMetrics.monthlySavingsRate,
  });

  const monthlyCashFlowTotal = financialProfile
    ? financialProfile.monthlyNetIncome
      - financialProfile.monthlyEssentialExpenses
      - financialProfile.monthlyDiscretionaryExpenses
    : 0;

  const monthlySurplusValue = cashFlowMetrics?.surplusAfterSavings ?? 0;
  const nonHelocActiveDebts = metrics.activeDebts.filter(debt => debt.category !== 'HELOC');

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

  const userName = localStorage.getItem('userName') || 'there';

  return (
    <div className="bg-brand-gray-light min-h-screen">
      <div className="bg-brand-navy py-3 px-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-white text-lg font-medium leading-tight">
              Good {getTimeOfDay()}, {userName}!
            </h1>
            <p className="text-white/65 text-xs mt-0.5">Your debt freedom command center</p>
          </div>
          <span className="bg-white/15 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap shrink-0">
            {healthScore.score} · {healthScore.label}
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 pb-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-5">
          <div className="bg-orange-50 border border-brand-gray-border rounded-lg p-3 sm:p-4 border-l-4 border-l-brand-orange min-w-0">
            <p className="text-[10px] sm:text-[11px] text-brand-gray uppercase tracking-wide truncate whitespace-nowrap overflow-hidden">
              {metricDebtCardLabel}
            </p>
            <p className="text-[18px] sm:text-[22px] font-medium text-brand-navy mt-1 whitespace-nowrap">
              {CalculationService.formatCurrency(metricDebtBalance)}
            </p>
            <p className="text-[10px] sm:text-[11px] text-brand-gray mt-0.5 line-clamp-2">
              {metricDebtProgress.toFixed(1)}% paid off
            </p>
            {hasDebtFreedomDebts && hasActiveMortgage && (
              <button
                type="button"
                onClick={() => setShowMortgageBalanceModal(true)}
                className="inline-flex items-center justify-center mt-1.5 min-h-7 rounded-full bg-brand-navy px-2 py-0.5 text-xs text-white/90 hover:bg-brand-navy/85 transition-colors"
              >
                + mortgage
              </button>
            )}
          </div>
          <div className="bg-green-50 border border-brand-gray-border rounded-lg p-3 sm:p-4 border-l-4 border-l-brand-green min-w-0">
            <p className="text-[10px] sm:text-[11px] text-brand-gray uppercase tracking-wide truncate whitespace-nowrap overflow-hidden">Cash on hand</p>
            <p className="text-[18px] sm:text-[22px] font-medium text-brand-navy mt-1 whitespace-nowrap">
              {CalculationService.formatCurrency(cashOnHand)}
            </p>
            <p className="text-[10px] sm:text-[11px] text-brand-gray mt-0.5 line-clamp-2">
              {checkingAccounts.length > 0
                ? `Across ${checkingAccounts.length} account${checkingAccounts.length !== 1 ? 's' : ''}`
                : 'No checking accounts'}
            </p>
          </div>
          <div className="bg-blue-50 border border-brand-gray-border rounded-lg p-3 sm:p-4 border-l-4 border-l-brand-blue min-w-0">
            <p className="text-[10px] sm:text-[11px] text-brand-gray uppercase tracking-wide truncate whitespace-nowrap overflow-hidden">Monthly surplus</p>
            <p className="text-[18px] sm:text-[22px] font-medium text-brand-navy mt-1 whitespace-nowrap">
              {CalculationService.formatCurrency(monthlySurplusValue)}
            </p>
            <p className="text-[10px] sm:text-[11px] text-brand-gray mt-0.5 line-clamp-2">After savings carve-out</p>
          </div>
          <div className="bg-purple-50 border border-brand-gray-border rounded-lg p-3 sm:p-4 border-l-4 border-l-brand-orange-dark min-w-0">
            <p className="text-[10px] sm:text-[11px] text-brand-gray uppercase tracking-wide truncate whitespace-nowrap overflow-hidden">Debt-free date</p>
            <p className="text-[18px] sm:text-[22px] font-medium text-brand-navy mt-1 whitespace-nowrap">
              {metricDebtDateLabel}
            </p>
            <p className="text-[10px] sm:text-[11px] text-brand-gray mt-0.5 line-clamp-2">{metricDebtDateSubtext}</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 min-w-0 space-y-5">
            <StartHereRibbon
              userName={userName}
              onNavigate={(section) => onNavigate?.(section)}
              onOpenChat={(context) => onOpenChat?.(context)}
            />
            {financialProfile && cashFlowMetrics && (
              <div className="bg-white border border-brand-gray-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-brand-navy">Monthly cash flow</h3>
                  <span className="text-lg font-medium text-brand-navy">
                    {CalculationService.formatCurrency(monthlyCashFlowTotal)}
                  </span>
                </div>

                <div className="rounded-lg overflow-hidden text-sm">
                  {[
                    { label: 'Net income', value: financialProfile.monthlyNetIncome, prefix: '' },
                    { label: 'Essential expenses', value: financialProfile.monthlyEssentialExpenses, prefix: '- ' },
                    { label: 'Discretionary expenses', value: financialProfile.monthlyDiscretionaryExpenses, prefix: '- ' },
                    { label: 'Minimum debt payments', value: totalMinimumPayments, prefix: '- ' },
                  ].map((row, index) => (
                    <div
                      key={row.label}
                      className={`flex justify-between px-3 py-2 ${index % 2 === 0 ? 'bg-brand-gray-light' : 'bg-white'}`}
                    >
                      <span className="text-brand-navy">{row.label}</span>
                      <span className="font-medium text-brand-navy">
                        {row.prefix}{CalculationService.formatCurrency(row.value)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-2 font-bold border-t border-brand-gray-border bg-white">
                    <span className="text-brand-navy">Gross monthly surplus</span>
                    <span className="text-brand-navy">
                      {CalculationService.formatCurrency(cashFlowMetrics.grossSurplus)}
                    </span>
                  </div>
                  <div className="flex justify-between px-3 py-2 bg-brand-blue-light text-brand-blue">
                    <span>Savings carve-out</span>
                    <span className="font-medium">
                      - {CalculationService.formatCurrency(cashFlowMetrics.savingsCarveOut)}
                    </span>
                  </div>
                  <div className="flex justify-between px-3 py-2 font-bold bg-white">
                    <span className="text-brand-navy">Surplus after savings</span>
                    <span className="text-brand-navy">
                      {CalculationService.formatCurrency(cashFlowMetrics.surplusAfterSavings)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-brand-gray-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-brand-navy">
                      <Sliders className="w-4 h-4" />
                      <span className="text-sm font-medium">Surplus commitment</span>
                    </div>
                    <span className="font-medium text-brand-navy">{commitmentPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={commitmentPercent}
                    onChange={(e) => handleCommitmentChange(parseInt(e.target.value, 10))}
                    onMouseUp={handleCommitmentCommit}
                    onTouchEnd={handleCommitmentCommit}
                    onKeyUp={handleCommitmentCommit}
                    className="slider-surplus"
                    aria-label="Percent of surplus committed to debt payoff"
                  />
                  <div className="flex justify-between text-[11px] text-brand-gray mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-brand-gray">Surplus available</span>
                    <span className="text-brand-navy">
                      {CalculationService.formatCurrency(cashFlowMetrics.surplusAfterSavings)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-gray">Committed</span>
                    <span className="text-brand-navy">{commitmentPercent}%</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-brand-gray-border">
                    <span className="text-brand-navy">Going to debt</span>
                    <span className="font-medium text-brand-orange">
                      {CalculationService.formatCurrency(extraForDebtPayoff)}
                    </span>
                  </div>
                  {optimizedProjection && (
                    <div className="flex justify-between">
                      <span className="text-brand-gray">Revised debt-free date</span>
                      <span className="text-brand-navy">
                        {CalculationService.formatMonthYear(optimizedProjection.debtFreeDate)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {targetDebt && (
              <div className="bg-orange-50 border border-brand-gray-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-brand-orange" />
                  <h3 className="text-sm font-medium text-brand-navy">Focus this month</h3>
                </div>
                {extraForDebtPayoff > 0 ? (
                  <>
                    <p className="text-sm text-brand-navy mb-3">
                      Apply extra{' '}
                      <span className="font-medium">{CalculationService.formatCurrency(extraForDebtPayoff)}</span>
                      {' '}to{' '}
                      <span className="font-medium">{targetDebt.accountName}</span>
                      <span className="ml-1.5 text-[11px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                        {formatDebtApr(targetDebt)}% APR
                      </span>
                    </p>
                    <div className="space-y-2 text-sm border-b border-brand-gray-border pb-3 mb-3">
                      <div className="flex justify-between">
                        <span className="text-brand-gray">Minimum payment</span>
                        <span className="text-brand-navy">{CalculationService.formatCurrency(targetDebt.minimumPayment)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-brand-gray">Extra cash flow</span>
                        <span className="text-brand-green">+ {CalculationService.formatCurrency(extraForDebtPayoff)}</span>
                      </div>
                      <div className="flex justify-between font-medium pt-2 border-t border-brand-gray-border">
                        <span className="text-brand-navy">Total to pay</span>
                        <span className="text-brand-navy">{CalculationService.formatCurrency(targetTotalPayment)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickPay}
                      className="w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Quick Pay {CalculationService.formatCurrency(targetTotalPayment)}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-brand-navy">
                    Pay minimum on{' '}
                    <span className="font-medium">{targetDebt.accountName}</span>
                    <span className="ml-1.5 text-[11px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                      {formatDebtApr(targetDebt)}% APR
                    </span>
                    <span className="ml-1 text-brand-gray">
                      — {CalculationService.formatCurrency(targetDebt.minimumPayment)}
                    </span>
                  </p>
                )}
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-base font-medium text-brand-navy mb-1">Active debts</h3>
              {nonHelocActiveDebts.length > 0 ? (
                <>
                  <p className="text-[11px] text-brand-gray italic text-right mb-2">
                    Sorted by payoff priority
                  </p>
                  <div className="bg-white border border-brand-gray-border rounded-lg overflow-hidden">
                  {nonHelocActiveDebts.map((debt, index) => {
                    const { paidOff, percentage, isOpenAccount } = getDebtProgressInfo(debt);
                    const isLast = index === nonHelocActiveDebts.length - 1;
                    return (
                      <div
                        key={debt.id}
                        className={`py-3 px-4 border-l-4 ${getDebtRowAccentBorder(debt, isOpenAccount)} ${
                          index % 2 === 0 ? 'bg-white' : 'bg-brand-gray-light'
                        } ${isLast ? '' : 'border-b border-brand-gray-border'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-[13px] font-medium text-brand-navy">{debt.accountName}</span>
                              <span className="text-[11px] text-brand-gray">{debt.category}</span>
                              <span className="text-[11px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                                {formatDebtApr(debt)}% APR
                              </span>
                            </div>
                            {isOpenAccount ? (
                              <span className="inline-flex text-[11px] bg-brand-gray-light text-brand-gray px-2 py-0.5 rounded-full">
                                Open account
                              </span>
                            ) : (
                              <div className="w-full bg-brand-gray-border rounded-full h-1 mt-1">
                                <div
                                  className="bg-brand-orange h-1 rounded-full transition-all"
                                  style={{ width: `${Math.min(percentage, 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="text-[13px] font-medium text-brand-navy">
                              {CalculationService.formatCurrency(debt.currentBalance)}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleLogPaymentClick(debt.id)}
                                className="text-[11px] px-3 py-1 rounded-md bg-brand-navy hover:bg-brand-navy-dark text-white font-medium transition-colors"
                              >
                                Log Payment
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleEditClick(debt, e)}
                                className="p-1 text-brand-gray hover:text-brand-blue rounded transition-colors"
                                title="Edit debt"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteClick(debt, e)}
                                className="p-1 text-brand-gray hover:text-red-600 rounded transition-colors"
                                title="Delete debt"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {!isOpenAccount && (
                              <span className="text-[11px] text-brand-gray">
                                {CalculationService.formatCurrency(paidOff)} paid off
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-brand-gray">No active non-HELOC debts.</p>
              )}
            </div>

            {metrics.paidOffDebts.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm text-brand-gray mb-3">Paid off</h3>
                <div className="bg-white border border-brand-gray-border rounded-lg overflow-hidden">
                  {metrics.paidOffDebts.map((debt, index) => (
                    <div
                      key={debt.id}
                      className={`flex items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t border-brand-gray-border' : ''}`}
                    >
                      <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0" />
                      <span className="text-[13px] text-brand-navy flex-1">{debt.accountName}</span>
                      <span className="text-[11px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {debt.transferredToHELOC ? 'Transferred' : 'Paid off'}
                      </span>
                      <span className="text-[11px] text-brand-gray shrink-0">
                        {formatPaidOffDate(debt.paidOffDate)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentActivity.length > 0 && (
              <div className="bg-white border border-brand-gray-border rounded-lg overflow-hidden">
                <div className="flex justify-between items-center px-4 py-3 border-b border-brand-gray-border">
                  <h3 className="text-sm font-medium text-brand-navy">Recent activity</h3>
                  <span className="text-[11px] text-brand-gray">Last 15 transactions</span>
                </div>
                <ul>
                  {recentActivity.map((activity, index) => {
                    const meta = getActivityDisplayMeta(activity.type);
                    const ActivityIcon = meta.Icon;
                    return (
                      <li
                        key={`${activity.type}-${activity.date}-${index}`}
                        className="flex items-center gap-3 px-4 py-3 border-b border-brand-gray-border last:border-b-0"
                      >
                        <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 ${meta.iconBg}`}>
                          <ActivityIcon className={`w-4 h-4 ${meta.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] truncate ${activity.type === 'milestone' ? 'text-brand-green' : 'text-brand-navy'}`}>
                            {activity.description}
                          </p>
                          <p className="text-[11px] text-brand-gray">
                            {CalculationService.formatDate(activity.date)} · {activity.source}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {activity.amount != null && (
                            <span className={`text-[13px] font-medium ${activity.amountColor || 'text-brand-navy'}`}>
                              {activity.amountColor === 'text-red-600' ? '+' : ''}
                              {CalculationService.formatCurrency(activity.amount)}
                            </span>
                          )}
                          {activity.transaction && activity.source === 'debt' && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTransaction(activity.transaction!);
                                setShowEditPayment(true);
                              }}
                              className="text-brand-blue hover:text-brand-navy transition-colors p-1"
                              title="Edit transaction"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <aside className="w-full lg:w-[300px] shrink-0 space-y-5">
            <FinancialHealthScore
              monthlyGrossIncome={financialProfile?.monthlyGrossIncome ?? 0}
              totalMinimumPayments={totalMinimumPayments}
              monthlySurplus={cashFlowMetrics?.grossSurplus ?? null}
              debtProgressPercent={hasDebtFreedomDebts ? dfProgressPercentage : mortgageProgressAvg}
              monthlySavingsGoal={financialProfile?.monthlySavingsGoal ?? 0}
              monthlySavingsRate={savingsMetrics.monthlySavingsRate}
              variant="sidebar"
            />

            {savingsAccounts.length > 0 && (
              <div className="bg-white border border-brand-gray-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-brand-navy">Savings summary</h3>
                  {onNavigateToSavings && (
                    <button
                      type="button"
                      onClick={onNavigateToSavings}
                      className="text-[12px] text-brand-blue hover:underline"
                    >
                      View details →
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] text-brand-gray uppercase tracking-wide">Total savings</p>
                    <p className="text-xl font-medium text-brand-navy mt-0.5">
                      {CalculationService.formatCurrency(savingsMetrics.totalSavings)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-brand-gray uppercase tracking-wide">Accounts</p>
                    <p className="text-xl font-medium text-brand-navy mt-0.5">
                      {savingsMetrics.numberOfAccounts}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-brand-gray uppercase tracking-wide">Interest earned YTD</p>
                    <p className="text-xl font-medium text-brand-navy mt-0.5">
                      {CalculationService.formatCurrency(savingsMetrics.totalInterestEarnedYTD)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className={hasDebtFreedomDebts && hasActiveMortgage ? 'space-y-5' : ''}>
              {hasDebtFreedomDebts && (
                <div className="bg-white border border-brand-gray-border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-brand-navy mb-3">Debt freedom progress</h3>
                  <div className="flex items-center justify-between text-[11px] text-brand-gray mb-1.5">
                    <span>{dfProgressPercentage.toFixed(1)}% paid off</span>
                    <span>{CalculationService.formatCurrency(dfCurrentBalance)} remaining</span>
                  </div>
                  <div className="w-full bg-brand-gray-border rounded-full h-2 overflow-hidden mb-3">
                    <div
                      className="h-full bg-brand-orange rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(dfProgressPercentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-brand-gray mb-2">
                    {CalculationService.formatCurrency(dfCurrentBalance)} remaining of{' '}
                    {CalculationService.formatCurrency(dfStartingBalance)} starting
                  </p>
                  {dfCashFlowPaidOff > 0 && (
                    <p className="text-[13px] font-medium text-brand-green mb-2">
                      You&apos;ve paid off {CalculationService.formatCurrency(dfCashFlowPaidOff)} from cash flow!
                    </p>
                  )}
                  {freedomProjection && (
                    <p className="text-xs text-brand-gray mb-2">
                      Debt-free: {CalculationService.formatMonthYear(freedomProjection.debtFreeDate)}
                    </p>
                  )}
                  {hasActiveMortgage && (
                    <p className="text-[11px] text-brand-gray italic">
                      Excludes mortgages — shown separately below
                    </p>
                  )}
                </div>
              )}

              {hasActiveMortgage && (
                <div
                  className={`bg-white border border-brand-gray-border rounded-lg ${
                    mortgageOnlyClient && activeMortgages.length === 1
                      ? 'border-l-4 border-l-brand-blue p-5'
                      : 'p-4'
                  }`}
                >
                  <h3 className="text-sm font-medium text-brand-navy mb-3">Mortgage progress</h3>
                  {mortgageOnlyClient && activeMortgages.length === 1 && (
                    <p className="text-[13px] text-brand-gray italic mb-4">
                      You&apos;re building equity every month. Keep going — every payment counts.
                    </p>
                  )}
                  {activeMortgages.map((mortgage, index) => {
                    const { percentage } = getDebtProgressInfo(mortgage);
                    const biweeklyTip = getMortgageBiweeklyTip(mortgage);
                    const projectedPayoff = formatProjectedPayoffMonthYear(mortgage);

                    return (
                      <div key={mortgage.id}>
                        {index > 0 && <div className="border-t border-brand-gray-border my-4" />}
                        <p className="text-[13px] font-medium text-brand-navy mb-2">{mortgage.name}</p>
                        <div className="flex items-center justify-between text-[11px] text-brand-gray mb-1.5">
                          <span>{percentage.toFixed(1)}% paid down</span>
                          <span>{CalculationService.formatCurrency(mortgage.currentBalance)} remaining</span>
                        </div>
                        <div className="w-full bg-brand-gray-border rounded-full h-2 overflow-hidden mb-2">
                          <div
                            className="h-full bg-brand-blue rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-brand-gray mb-1">
                          Original: {formatOriginalAmountForDisplay(mortgage.startingBalance)} · Started:{' '}
                          {formatMortgageStartedDate(mortgage)}
                        </p>
                        {projectedPayoff && (
                          <p className="text-xs text-brand-gray mb-2">
                            Projected payoff: {projectedPayoff}
                          </p>
                        )}
                        {biweeklyTip && (
                          <div className="flex items-start gap-2 mt-2">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-700">
                              Bi-weekly payments could save you {biweeklyTip.monthsSaved} months and{' '}
                              {CalculationService.formatCurrency(biweeklyTip.interestSaved)} in interest
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {showLogPayment && (
        <LogPaymentModal
          preselectedDebtId={selectedDebtId}
          preselectedAmount={quickPayAmount}
          onClose={() => {
            setShowLogPayment(false);
            setSelectedDebtId(null);
            setQuickPayAmount(undefined);
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

      {showMortgageBalanceModal && (
        <MortgageBalanceModal onClose={() => setShowMortgageBalanceModal(false)} />
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
