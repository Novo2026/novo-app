import { useMemo, useState } from 'react';
import {
  Plus,
  DollarSign,
  Pencil,
  Trash2,
  RefreshCw,
  ArrowRightLeft,
  Home,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Trophy,
  X,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import AddDebtModal from './AddDebtModal';
import AddChargeModal from './AddChargeModal';
import DebtDetailView from './DebtDetailView';
import EditDebtModal from './EditDebtModal';
import BatchEntryModal from './BatchEntryModal';
import RefinanceModal from './RefinanceModal';
import SoldHomeModal from './SoldHomeModal';
import HomeSaleCelebrationModal from './HomeSaleCelebrationModal';
import AddReplacementMortgageModal from './AddReplacementMortgageModal';
import CelebrationModal from './CelebrationModal';
import { MILESTONE_CELEBRATIONS_DISABLED } from '../utils/milestoneEngine';
import {
  formatLoanStartDateForDisplay,
  formatLoanTermForDisplay,
  formatProjectedPayoffMonthYear,
  hasProjectedPayoffMetadata,
  isInstallmentLoanCategory,
} from '../utils/installmentLoan';
import type { Debt, Transaction, Milestone } from '../types';

interface MyDebtsProps {
  onDataUpdate: () => void;
}

function getDebtAccentBorder(debt: Debt, isOpenAccount: boolean): string {
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

function getDebtHeaderTintBg(debt: Debt, isOpenAccount: boolean): string {
  if (isOpenAccount) return 'bg-gray-50';
  switch (debt.category) {
    case 'Mortgage':
      return 'bg-blue-50';
    case 'Auto Loan':
      return 'bg-orange-50';
    case 'Credit Card':
      return 'bg-red-50';
    case 'Personal Loan':
      return 'bg-green-50';
    default:
      return 'bg-gray-50';
  }
}

function formatPaidOffDisplayDate(debt: Debt): string {
  const date = debt.paidOffDate ?? debt.homeSaleDate;
  if (!date || Number.isNaN(new Date(date).getTime())) {
    return 'date not recorded';
  }
  return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

type DebtSortOption = 'balance-desc' | 'balance-asc' | 'apr-desc' | 'apr-asc' | 'name-asc';

const DEBT_SORT_LABELS: Record<DebtSortOption, string> = {
  'balance-desc': 'Balance (high to low)',
  'balance-asc': 'Balance (low to high)',
  'apr-desc': 'APR (high to low)',
  'apr-asc': 'APR (low to high)',
  'name-asc': 'Name (A-Z)',
};

function sortActiveDebts(debts: Debt[], sortBy: DebtSortOption): Debt[] {
  const sorted = [...debts];
  switch (sortBy) {
    case 'balance-desc':
      return sorted.sort((a, b) => b.currentBalance - a.currentBalance);
    case 'balance-asc':
      return sorted.sort((a, b) => a.currentBalance - b.currentBalance);
    case 'apr-desc':
      return sorted.sort((a, b) => b.interestRate - a.interestRate);
    case 'apr-asc':
      return sorted.sort((a, b) => a.interestRate - b.interestRate);
    case 'name-asc':
      return sorted.sort((a, b) => a.accountName.localeCompare(b.accountName));
    default:
      return sorted;
  }
}

export default function MyDebts({ onDataUpdate }: MyDebtsProps) {
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [showEditDebt, setShowEditDebt] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingDebt, setDeletingDebt] = useState<Debt | null>(null);
  const [showBatchEntry, setShowBatchEntry] = useState(false);
  const [batchEntryDebt, setBatchEntryDebt] = useState<Debt | null>(null);
  const [showRefinance, setShowRefinance] = useState(false);
  const [refinancingDebt, setRefinancingDebt] = useState<Debt | null>(null);
  const [showSoldHome, setShowSoldHome] = useState(false);
  const [soldHomeDebt, setSoldHomeDebt] = useState<Debt | null>(null);
  const [showHomeSaleCelebration, setShowHomeSaleCelebration] = useState(false);
  const [homeSaleCelebrationData, setHomeSaleCelebrationData] = useState<{
    mortgageName: string;
    mortgageId: string;
    saleDate: string;
    netProceeds: number | null;
  } | null>(null);
  const [showAddReplacementMortgage, setShowAddReplacementMortgage] = useState(false);
  const [paidOffExpanded, setPaidOffExpanded] = useState(false);
  const [showMarkPaidOffConfirm, setShowMarkPaidOffConfirm] = useState(false);
  const [markingPaidOffDebt, setMarkingPaidOffDebt] = useState<Debt | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    debtName: string;
    debtAmount: number;
    freedPayment: number;
    previousCashFlow?: number;
    nextDebtName?: string;
    monthsSavedByAcceleration?: number;
  } | null>(null);
  const [debtSort, setDebtSort] = useState<DebtSortOption>('balance-desc');

  const allDebts = StorageService.getDebts().filter(d => d.category !== 'HELOC');
  const activeDebts = allDebts.filter(d => !d.isPaidOff);
  const paidOffDebts = allDebts.filter(d => d.isPaidOff);
  const zeroBalanceActiveDebts = activeDebts.filter(d => d.currentBalance === 0);
  const paidDownToZeroDebts = zeroBalanceActiveDebts.filter(d => d.startingBalance > 0);
  const isAdminMode = localStorage.getItem('novo_admin_mode') === 'true';
  const totalOwed = activeDebts.reduce((sum, d) => sum + d.currentBalance, 0);
  const totalMinimums = activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0);
  const totalEliminated = paidOffDebts.reduce((sum, d) => sum + d.startingBalance, 0);
  const sortedActiveDebts = useMemo(
    () => sortActiveDebts(activeDebts, debtSort),
    [activeDebts, debtSort]
  );

  const handleAddCharge = (debtId: string) => {
    setSelectedDebtId(debtId);
    setShowAddCharge(true);
  };

  const handleViewDetail = (debt: Debt) => {
    setSelectedDebt(debt);
  };

  const handleBackToList = () => {
    setSelectedDebt(null);
  };

  const handleDebtAdded = () => {
    setShowAddDebt(false);
    onDataUpdate();
  };

  const handleChargeAdded = () => {
    setShowAddCharge(false);
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

  const handleRefinanceClick = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation();
    setRefinancingDebt(debt);
    setShowRefinance(true);
  };

  const handleRefinanceDone = () => {
    setShowRefinance(false);
    setRefinancingDebt(null);
    onDataUpdate();
  };

  const handleSoldHomeClick = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation();
    setSoldHomeDebt(debt);
    setShowSoldHome(true);
  };

  const handleSoldHomeConfirm = (data: {
    saleDate: string;
    payoffAmount: number;
    salePrice: number | null;
    netProceeds: number | null;
  }) => {
    if (!soldHomeDebt) return;

    const debts = StorageService.getDebts();
    const idx = debts.findIndex(d => d.id === soldHomeDebt.id);
    if (idx === -1) return;

    debts[idx] = {
      ...debts[idx],
      currentBalance: 0,
      isPaidOff: true,
      paidOffDate: data.saleDate,
      homeSold: true,
      homeSaleDate: data.saleDate,
      homeSalePrice: data.salePrice ?? undefined,
      homeSaleNetProceeds: data.netProceeds ?? undefined,
    };
    StorageService.saveDebts(debts);

    const saleTxn: Transaction = {
      id: `txn_homesale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      debtId: soldHomeDebt.id,
      debtName: soldHomeDebt.accountName,
      date: data.saleDate,
      type: 'payment',
      amount: data.payoffAmount,
      previousBalance: soldHomeDebt.currentBalance,
      interestCharged: 0,
      principalPaid: data.payoffAmount,
      newBalance: 0,
      notes: `Final payoff from home sale${data.salePrice ? ` - Sale price: ${CalculationService.formatCurrency(data.salePrice)}` : ''}`,
    };
    const transactions = StorageService.getTransactions();
    transactions.push(saleTxn);
    StorageService.saveTransactions(transactions);

    const milestone: Milestone = {
      id: `milestone_homesale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'debt_payoff',
      title: `Sold home - Paid off ${soldHomeDebt.accountName}`,
      description: `Home sold on ${CalculationService.formatDate(data.saleDate)}. Mortgage fully paid off from sale proceeds.${data.netProceeds && data.netProceeds > 0 ? ` Net proceeds: ${CalculationService.formatCurrency(data.netProceeds)}.` : ''}`,
      date: data.saleDate,
      debtId: soldHomeDebt.id,
      debtName: soldHomeDebt.accountName,
      amount: data.payoffAmount,
      freedPayment: soldHomeDebt.minimumPayment,
    };
    StorageService.addMilestone(milestone);

    setShowSoldHome(false);
    setHomeSaleCelebrationData({
      mortgageName: soldHomeDebt.accountName,
      mortgageId: soldHomeDebt.id,
      saleDate: data.saleDate,
      netProceeds: data.netProceeds,
    });
    setSoldHomeDebt(null);
    if (!MILESTONE_CELEBRATIONS_DISABLED) {
      setShowHomeSaleCelebration(true);
    }
    onDataUpdate();
  };

  const handleAddReplacementMortgageSuccess = () => {
    setShowAddReplacementMortgage(false);
    setShowHomeSaleCelebration(false);
    setHomeSaleCelebrationData(null);
    onDataUpdate();
  };

  const handleMarkPaidOff = (debt: Debt) => {
    const now = new Date().toISOString();
    const debts = StorageService.getDebts();
    const updated = debts.map(d => d.id === debt.id
      ? {
          ...d,
          isPaidOff: true,
          currentBalance: 0,
          paidOffDate: now,
          paidOffAt: now,
        }
      : d
    );
    StorageService.saveDebts(updated);
    onDataUpdate();
  };

  const handleCloseAccountClick = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation();
    if (debt.startingBalance === 0) {
      handleMarkPaidOff(debt);
      return;
    }
    setMarkingPaidOffDebt(debt);
    setShowMarkPaidOffConfirm(true);
  };

  const handleConfirmMarkPaidOff = () => {
    if (!markingPaidOffDebt) return;

    const today = CalculationService.getTodayDateString();
    const allDebtsRaw = StorageService.getDebts();

    const previousStrategyResult = StorageService.getStrategyResult();

    const updatedDebts = allDebtsRaw.map(d =>
      d.id === markingPaidOffDebt.id ? { ...d, isPaidOff: true, paidOffDate: today } : d
    );
    StorageService.saveDebts(updatedDebts);

    const milestone: Milestone = {
      id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'debt_payoff',
      title: `Paid off ${markingPaidOffDebt.accountName} - freed ${CalculationService.formatCurrency(markingPaidOffDebt.minimumPayment)}/month`,
      description: `Successfully eliminated ${CalculationService.formatCurrency(markingPaidOffDebt.startingBalance)} in debt.`,
      date: today,
      debtId: markingPaidOffDebt.id,
      debtName: markingPaidOffDebt.accountName,
      amount: markingPaidOffDebt.startingBalance,
      freedPayment: markingPaidOffDebt.minimumPayment,
    };
    StorageService.addMilestone(milestone);

    const profile = StorageService.getFinancialProfile();

    let previousCashFlow: number | undefined;
    if (profile) {
      const activeBeforePayoff = allDebtsRaw.filter(d => !d.isPaidOff && d.category !== 'HELOC');
      previousCashFlow = profile.monthlyNetIncome -
        profile.monthlyEssentialExpenses -
        profile.monthlyDiscretionaryExpenses -
        activeBeforePayoff.reduce((sum, d) => sum + d.minimumPayment, 0);
    }

    const remainingActive = updatedDebts.filter(d => !d.isPaidOff && d.category !== 'HELOC');
    let nextDebtName: string | undefined;
    let monthsSavedByAcceleration: number | undefined;

    if (remainingActive.length > 0) {
      const newStrategyResult = CalculationService.calculateCurrentStrategy();

      if (newStrategyResult) {
        StorageService.saveStrategyResult(newStrategyResult);
        StorageService.markStrategyCalculated();

        const sortedByRate = [...remainingActive].sort((a, b) => b.interestRate - a.interestRate);
        nextDebtName = sortedByRate[0]?.accountName;

        if (previousStrategyResult && nextDebtName) {
          const prevItem = previousStrategyResult.payoffTimeline.find(
            t => t.debtName === nextDebtName
          );
          const newItem = newStrategyResult.payoffTimeline.find(
            t => t.debtName === nextDebtName
          );
          if (prevItem && newItem) {
            monthsSavedByAcceleration = Math.max(0, prevItem.payoffMonth - newItem.payoffMonth);
          }
        }
      }
    }

    setCelebrationData({
      debtName: markingPaidOffDebt.accountName,
      debtAmount: markingPaidOffDebt.startingBalance,
      freedPayment: markingPaidOffDebt.minimumPayment,
      previousCashFlow,
      nextDebtName,
      monthsSavedByAcceleration,
    });

    setShowMarkPaidOffConfirm(false);
    setMarkingPaidOffDebt(null);
    if (!MILESTONE_CELEBRATIONS_DISABLED) {
      setShowCelebration(true);
    }
    onDataUpdate();
  };

  const getLastRefinanceDate = (debt: Debt): string | null => {
    if (!debt.refinanceHistory || debt.refinanceHistory.length === 0) return null;
    const last = debt.refinanceHistory[debt.refinanceHistory.length - 1];
    return CalculationService.formatDate(last.date);
  };

  const didRateImprove = (debt: Debt): boolean => {
    if (!debt.refinanceHistory || debt.refinanceHistory.length === 0) return false;
    const last = debt.refinanceHistory[debt.refinanceHistory.length - 1];
    return last.newRate < last.previousRate;
  };

  const getLastPaymentForDebt = (debtId: string) => {
    const payments = StorageService.getUnifiedPayments()
      .filter(p => p.debtId === debtId)
      .sort((a, b) => CalculationService.compareDateStrings(b.date, a.date));
    return payments[0] ?? null;
  };

  if (selectedDebt) {
    return (
      <DebtDetailView
        debt={selectedDebt}
        onBack={handleBackToList}
        onDataUpdate={onDataUpdate}
      />
    );
  }

  if (showCelebration && celebrationData && !MILESTONE_CELEBRATIONS_DISABLED) {
    return (
      <CelebrationModal
        debtName={celebrationData.debtName}
        debtAmount={celebrationData.debtAmount}
        freedPayment={celebrationData.freedPayment}
        previousCashFlow={celebrationData.previousCashFlow}
        nextDebtName={celebrationData.nextDebtName}
        monthsSavedByAcceleration={celebrationData.monthsSavedByAcceleration}
        onViewPlan={() => {
          setShowCelebration(false);
          setCelebrationData(null);
        }}
      />
    );
  }

  if (allDebts.length === 0) {
    return (
      <div className="bg-brand-gray-light min-h-screen">
        <div className="bg-brand-navy py-3 px-5">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div>
              <h1 className="text-white text-lg font-medium leading-tight">My Debts</h1>
              <p className="text-white/65 text-xs mt-0.5">Track and manage every debt in one place</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddDebt(true)}
              className="inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-[13px] font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Debt</span>
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-5 py-16 text-center">
          <DollarSign className="w-16 h-16 text-brand-gray mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-brand-navy mb-2">No Debts Added Yet</h2>
          <p className="text-brand-gray mb-6">
            Add your first debt to start tracking your payoff progress.
          </p>
          <button
            type="button"
            onClick={() => setShowAddDebt(true)}
            className="inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Your First Debt</span>
          </button>
        </div>

        {showAddDebt && (
          <AddDebtModal
            onClose={() => setShowAddDebt(false)}
            onSuccess={handleDebtAdded}
          />
        )}
      </div>
    );
  }

  const renderDebtCard = (debt: Debt) => {
    const isOpenAccount = debt.currentBalance === 0 && !debt.isPaidOff && debt.startingBalance === 0;
    const isPaidDownToZero = debt.currentBalance === 0 && !debt.isPaidOff && debt.startingBalance > 0;
    const paidOffAmount = debt.startingBalance - debt.currentBalance;
    const progress = debt.startingBalance > 0 ? (paidOffAmount / debt.startingBalance) * 100 : 0;
    const lastPayment = getLastPaymentForDebt(debt.id);
    const projectedPayoff = hasProjectedPayoffMetadata(debt) && formatProjectedPayoffMonthYear(debt)
      ? formatProjectedPayoffMonthYear(debt)
      : '\u2014';

    return (
      <div
        key={debt.id}
        className={`bg-white border border-brand-gray-border rounded-lg border-l-4 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] ${getDebtAccentBorder(debt, isOpenAccount)}`}
      >
        <div className={`${getDebtHeaderTintBg(debt, isOpenAccount)} -mx-px -mt-px rounded-t-lg px-4 py-3`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[15px] font-medium text-brand-navy">{debt.accountName}</h3>
              <p className="text-[11px] text-brand-gray mt-0.5">{debt.category}</p>
              {debt.refinanceHistory && debt.refinanceHistory.length > 0 && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 ${
                    didRateImprove(debt) ? 'bg-green-50 text-brand-green' : 'bg-brand-blue-light text-brand-blue'
                  }`}
                >
                  <RefreshCw className="w-3 h-3" />
                  {didRateImprove(debt) ? 'Rate improved' : 'Refinanced'} {getLastRefinanceDate(debt)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isOpenAccount && (
                <span className="text-[10px] bg-blue-50 text-brand-blue border border-brand-blue px-2 py-0.5 rounded-full font-medium">
                  Open
                </span>
              )}
              <span className="text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                {debt.interestRate}% APR
              </span>
              <button
                type="button"
                onClick={(e) => handleEditClick(debt, e)}
                className="p-1 text-brand-gray hover:text-brand-navy rounded transition-colors"
                title="Edit debt"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteClick(debt, e)}
                className="p-1 text-brand-gray hover:text-brand-navy rounded transition-colors"
                title="Delete debt"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4">
          {isPaidDownToZero && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
              <Trophy className="w-4 h-4 text-brand-green shrink-0" />
              <p className="text-xs font-medium text-brand-green">Balance reached $0 {'\u2014'} close this account when ready.</p>
            </div>
          )}

          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wide text-brand-gray">Current Balance</p>
            <p className={`text-[22px] font-medium mt-0.5 ${isOpenAccount ? 'text-brand-gray' : 'text-brand-navy'}`}>
              {CalculationService.formatCurrency(debt.currentBalance)}
            </p>
            <p className="text-[11px] text-brand-gray mt-0.5">
              Started at {CalculationService.formatCurrency(debt.startingBalance)}
            </p>
          </div>

          {isOpenAccount ? (
            <p className="text-[11px] text-brand-gray mb-3">No balance yet</p>
          ) : (
            <div className="mb-3">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-brand-gray">{progress.toFixed(1)}% paid off</span>
                <span className="text-brand-green">{CalculationService.formatCurrency(paidOffAmount)} paid off</span>
              </div>
              <div className="w-full bg-brand-gray-border rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-brand-orange rounded-full transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          )}

          {!isOpenAccount && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <p className="text-[10px] text-brand-gray">Min payment</p>
                <p className="text-[13px] text-brand-navy">{CalculationService.formatCurrency(debt.minimumPayment)}</p>
              </div>
              <div>
                <p className="text-[10px] text-brand-gray">Last payment</p>
                <p className="text-[13px] text-brand-navy">
                  {lastPayment
                    ? (
                      <>
                        {CalculationService.formatCurrency(lastPayment.amount)}
                        {' \u00B7 '}
                        {CalculationService.formatLocalDateShort(lastPayment.date)}
                      </>
                    )
                    : '\u2014'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-brand-gray">Projected payoff</p>
                <p className="text-[13px] text-brand-navy">{projectedPayoff}</p>
              </div>
            </div>
          )}

          {isInstallmentLoanCategory(debt.category) &&
            (debt.loanStartDate || (debt.loanTerm != null && debt.loanTerm > 0)) && (
              <div className="text-[11px] text-brand-gray mb-3">
                {debt.loanStartDate && (
                  <span>Loan start {formatLoanStartDateForDisplay(debt.loanStartDate)}</span>
                )}
                {debt.loanStartDate && debt.loanTerm != null && debt.loanTerm > 0 && <span>{' \u00B7 '}</span>}
                {debt.loanTerm != null && debt.loanTerm > 0 && (
                  <span>Term {formatLoanTermForDisplay(debt.loanTerm, debt.loanTermUnit, debt.isAmortized)}</span>
                )}
                {hasProjectedPayoffMetadata(debt) && formatProjectedPayoffMonthYear(debt) && (
                  <span className="text-brand-blue">
                    {' \u00B7 '}Payoff {formatProjectedPayoffMonthYear(debt)}
                  </span>
                )}
              </div>
            )}

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-brand-gray-border">
            <button
              type="button"
              onClick={() => handleViewDetail(debt)}
              className="text-[13px] font-medium px-4 py-2 rounded-lg border border-brand-navy text-brand-navy hover:bg-brand-navy hover:text-white transition-colors"
            >
              View Details
            </button>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {isOpenAccount ? (
                <button
                  type="button"
                  onClick={(e) => handleCloseAccountClick(debt, e)}
                  className="inline-flex items-center gap-1 text-[12px] text-brand-red hover:underline"
                >
                  <X className="w-3.5 h-3.5" />
                  Close Account
                </button>
              ) : (
                <>
                  {debt.category !== 'Credit Card' && (
                    <button
                      type="button"
                      onClick={(e) => handleRefinanceClick(debt, e)}
                      className="inline-flex items-center gap-1 text-[12px] text-brand-blue hover:underline"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Refinance
                    </button>
                  )}
                  {debt.category === 'Credit Card' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAddCharge(debt.id)}
                        className="inline-flex items-center gap-1 text-[12px] text-brand-orange hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Charge
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleRefinanceClick(debt, e)}
                        className="inline-flex items-center gap-1 text-[12px] text-brand-blue hover:underline"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        Transfer Balance
                      </button>
                    </>
                  )}
                  {!debt.isPaidOff && debt.currentBalance > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkPaidOff(debt);
                      }}
                      className="inline-flex items-center gap-1 text-[12px] text-brand-green hover:underline"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark as Paid Off
                    </button>
                  )}
                  {debt.category === 'Mortgage' && (
                    <button
                      type="button"
                      onClick={(e) => handleSoldHomeClick(debt, e)}
                      className="inline-flex items-center gap-1 text-[12px] text-brand-orange hover:underline"
                    >
                      <Home className="w-3.5 h-3.5" />
                      Sold Home
                    </button>
                  )}
                </>
              )}
              {isAdminMode && (
                <button
                  type="button"
                  onClick={() => {
                    setBatchEntryDebt(debt);
                    setShowBatchEntry(true);
                  }}
                  className="inline-flex items-center gap-1 text-[12px] text-brand-gray hover:underline"
                >
                  Batch Entry (Demo)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPaidOffRow = (debt: Debt, index: number) => (
    <div
      key={debt.id}
      className={`flex items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t border-brand-gray-border' : ''}`}
    >
      <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-brand-navy">{debt.accountName}</p>
        <p className="text-[11px] text-brand-gray">{debt.category}</p>
      </div>
      <span className="text-[11px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full shrink-0">
        {debt.homeSold ? 'Home sold' : debt.transferredToHELOC ? 'Transferred' : `Paid off ${formatPaidOffDisplayDate(debt)}`}
      </span>
      <span className="text-[13px] font-medium text-brand-navy shrink-0">
        {CalculationService.formatCurrency(debt.startingBalance)}
      </span>
      <button
        type="button"
        onClick={() => handleViewDetail(debt)}
        className="text-[12px] text-brand-blue hover:underline shrink-0"
      >
        History
      </button>
      <button
        type="button"
        onClick={(e) => handleDeleteClick(debt, e)}
        className="p-1 text-brand-gray hover:text-brand-navy shrink-0"
        title="Delete debt"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const pageHeader = (
    <div className="bg-brand-navy py-3 px-5">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <div>
          <h1 className="text-white text-lg font-medium leading-tight">My Debts</h1>
          <p className="text-white/65 text-xs mt-0.5">Track and manage every debt in one place</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddDebt(true)}
          className="inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-[13px] font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Debt</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-brand-gray-light min-h-screen">
      {pageHeader}

      <div className="max-w-5xl mx-auto px-5 pb-8">
        {activeDebts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-5">
            <div className="bg-white border border-brand-gray-border rounded-lg p-4 border-l-4 border-l-brand-orange">
              <p className="text-[11px] text-brand-gray uppercase tracking-wide">Active debts</p>
              <p className="text-[22px] font-medium text-brand-navy mt-1">{activeDebts.length}</p>
            </div>
            <div className="bg-white border border-brand-gray-border rounded-lg p-4 border-l-4 border-l-brand-red">
              <p className="text-[11px] text-brand-gray uppercase tracking-wide">Total owed</p>
              <p className="text-[22px] font-medium text-brand-navy mt-1">
                {CalculationService.formatCurrency(totalOwed)}
              </p>
            </div>
            <div className="bg-white border border-brand-gray-border rounded-lg p-4 border-l-4 border-l-brand-blue">
              <p className="text-[11px] text-brand-gray uppercase tracking-wide">Monthly minimums</p>
              <p className="text-[22px] font-medium text-brand-navy mt-1">
                {CalculationService.formatCurrency(totalMinimums)}
              </p>
            </div>
          </div>
        )}

        {paidDownToZeroDebts.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3 mb-5">
            <Trophy className="w-5 h-5 text-brand-green shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-brand-green text-sm">
                {paidDownToZeroDebts.length === 1
                  ? `${paidDownToZeroDebts[0].accountName} is at $0!`
                  : `${paidDownToZeroDebts.length} debts are at $0!`}
              </p>
              <p className="text-sm text-brand-gray mt-0.5">
                Click &quot;Close Account&quot; on {paidDownToZeroDebts.length === 1 ? 'the card below' : 'each card below'} to move it to your paid-off history.
              </p>
            </div>
          </div>
        )}

        {activeDebts.length === 0 && paidOffDebts.length > 0 ? (
          <div className="text-center py-12 bg-white border border-brand-gray-border rounded-lg">
            <Trophy className="w-16 h-16 text-brand-green mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-brand-navy mb-2">All Debts Paid Off!</h3>
            <p className="text-brand-gray mb-4">You&apos;ve eliminated all your tracked debts. Amazing work!</p>
            <button
              type="button"
              onClick={() => setShowAddDebt(true)}
              className="inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Debt</span>
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mt-5 mb-3">
              <h2 className="text-base font-medium text-brand-navy">My Debts</h2>
              <label className="sr-only" htmlFor="debt-sort">Sort debts</label>
              <select
                id="debt-sort"
                value={debtSort}
                onChange={(e) => setDebtSort(e.target.value as DebtSortOption)}
                className="text-[12px] text-brand-gray border border-brand-gray-border rounded-md px-2 py-1.5 bg-white"
              >
                {(Object.keys(DEBT_SORT_LABELS) as DebtSortOption[]).map((option) => (
                  <option key={option} value={option}>
                    Sort by: {DEBT_SORT_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {sortedActiveDebts.map((debt) => renderDebtCard(debt))}
            </div>
          </>
        )}

        {paidOffDebts.length > 0 && (
          <div className="mt-6 bg-white border border-brand-gray-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setPaidOffExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-brand-gray-light/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0" />
                <span className="text-sm font-medium text-brand-navy">Paid Off Debts</span>
                <span className="text-[11px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {paidOffDebts.length}
                </span>
                <span className="text-[11px] text-brand-gray hidden sm:inline">
                  {' \u00B7 '}{CalculationService.formatCurrency(totalEliminated)} eliminated
                </span>
              </div>
              {paidOffExpanded ? (
                <ChevronUp className="w-5 h-5 text-brand-gray shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-brand-gray shrink-0" />
              )}
            </button>

            {paidOffExpanded && (
              <div className="border-t border-brand-gray-border">
                {paidOffDebts.map((debt, index) => renderPaidOffRow(debt, index))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddDebt && (
        <AddDebtModal
          onClose={() => setShowAddDebt(false)}
          onSuccess={handleDebtAdded}
        />
      )}

      {showAddCharge && selectedDebtId && (
        <AddChargeModal
          debtId={selectedDebtId}
          onClose={() => {
            setShowAddCharge(false);
            setSelectedDebtId(null);
          }}
          onSuccess={handleChargeAdded}
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

      {showBatchEntry && batchEntryDebt && (
        <BatchEntryModal
          debtId={batchEntryDebt.id}
          debtName={batchEntryDebt.accountName}
          currentBalance={batchEntryDebt.currentBalance}
          minimumPayment={batchEntryDebt.minimumPayment}
          onClose={() => {
            setShowBatchEntry(false);
            setBatchEntryDebt(null);
          }}
          onComplete={() => {
            onDataUpdate();
          }}
        />
      )}

      {showRefinance && refinancingDebt && (
        <RefinanceModal
          debt={refinancingDebt}
          onClose={() => {
            setShowRefinance(false);
            setRefinancingDebt(null);
          }}
          onSuccess={handleRefinanceDone}
        />
      )}

      {showSoldHome && soldHomeDebt && (
        <SoldHomeModal
          debt={soldHomeDebt}
          onClose={() => {
            setShowSoldHome(false);
            setSoldHomeDebt(null);
          }}
          onConfirm={handleSoldHomeConfirm}
        />
      )}

      {showHomeSaleCelebration && homeSaleCelebrationData && !MILESTONE_CELEBRATIONS_DISABLED && (
        <HomeSaleCelebrationModal
          mortgageName={homeSaleCelebrationData.mortgageName}
          saleDate={homeSaleCelebrationData.saleDate}
          netProceeds={homeSaleCelebrationData.netProceeds}
          onAddNewMortgage={() => {
            setShowHomeSaleCelebration(false);
            setShowAddReplacementMortgage(true);
          }}
          onClose={() => {
            setShowHomeSaleCelebration(false);
            setHomeSaleCelebrationData(null);
          }}
        />
      )}

      {showAddReplacementMortgage && homeSaleCelebrationData && (
        <AddReplacementMortgageModal
          previousMortgageName={homeSaleCelebrationData.mortgageName}
          previousMortgageId={homeSaleCelebrationData.mortgageId}
          previousSaleDate={homeSaleCelebrationData.saleDate}
          onClose={() => {
            setShowAddReplacementMortgage(false);
            setHomeSaleCelebrationData(null);
          }}
          onSuccess={handleAddReplacementMortgageSuccess}
        />
      )}

      {showMarkPaidOffConfirm && markingPaidOffDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-center w-14 h-14 bg-emerald-100 rounded-full mx-auto mb-4">
              <Trophy className="w-8 h-8 text-brand-green" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">Close Account?</h3>
            <p className="text-gray-600 mb-1 text-center">
              You&apos;re closing <strong>{markingPaidOffDebt.accountName}</strong>.
            </p>
            <p className="text-sm text-gray-500 text-center mb-6">
              This will free up <strong>{CalculationService.formatCurrency(markingPaidOffDebt.minimumPayment)}/month</strong> and move it to your Paid Off Debts section.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowMarkPaidOffConfirm(false);
                  setMarkingPaidOffDebt(null);
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2.5 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMarkPaidOff}
                className="flex-1 bg-brand-green hover:bg-[#229954] text-white font-bold py-2.5 px-4 rounded-lg transition-colors"
              >
                Celebrate!
              </button>
            </div>
          </div>
        </div>
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
