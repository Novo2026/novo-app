import { useState } from 'react';
import { Plus, DollarSign, Pencil, Trash2, Calendar, RefreshCw, ArrowRightLeft, Home, ChevronDown, ChevronUp, CheckCircle, Trophy } from 'lucide-react';
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
import {
  formatLoanStartDateForDisplay,
  formatLoanTermForDisplay,
  formatOriginalAmountForDisplay,
  formatProjectedPayoffMonthYear,
  getMonthsRemainingUntilProjectedPayoff,
  hasCompleteInstallmentMetadata,
  hasProjectedPayoffMetadata,
  isInstallmentLoanCategory,
} from '../utils/installmentLoan';
import type { Debt, Transaction, Milestone } from '../types';

interface MyDebtsProps {
  onDataUpdate: () => void;
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

  const allDebts = StorageService.getDebts().filter(d => d.category !== 'HELOC');
  const activeDebts = allDebts.filter(d => !d.isPaidOff);
  const paidOffDebts = allDebts.filter(d => d.isPaidOff);
  const zeroBalanceActiveDebts = activeDebts.filter(d => d.currentBalance === 0);

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
    setShowHomeSaleCelebration(true);
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

  const handleMarkPaidOffClick = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation();
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
    setShowCelebration(true);
    onDataUpdate();
  };

  const getRefinanceButtonLabel = (debt: Debt): string => {
    if (debt.category === 'Credit Card') return 'Transfer Balance';
    if (debt.category === 'Student Loan') return 'Refinance/Consolidate';
    return 'Refinance This Loan';
  };

  const getRefinanceIcon = (debt: Debt) => {
    if (debt.category === 'Credit Card') return <ArrowRightLeft className="w-3.5 h-3.5" />;
    return <RefreshCw className="w-3.5 h-3.5" />;
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

  const getDebtPaymentHistory = (debtId: string) => {
    const payments = StorageService.getUnifiedPayments().filter(p => p.debtId === debtId);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalInterest = payments.reduce((sum, p) => sum + p.interestCharged, 0);
    return { totalPaid, totalInterest };
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

  if (showCelebration && celebrationData) {
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
      <>
        <div className="text-center py-16">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Debts Added Yet</h2>
          <p className="text-gray-600 mb-6">
            Add your first debt to start tracking your payoff progress.
          </p>
          <button
            onClick={() => setShowAddDebt(true)}
            className="inline-flex items-center space-x-2 bg-[#FF6B35] hover:bg-[#E55A25] text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors"
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
      </>
    );
  }

  const renderDebtCard = (debt: Debt, isPaidOffCard = false) => {
    const paidOff = debt.startingBalance - debt.currentBalance;
    const progress = (paidOff / debt.startingBalance) * 100;
    const isZeroBalance = debt.currentBalance === 0 && !debt.isPaidOff;

    if (isPaidOffCard) {
      const { totalPaid, totalInterest } = getDebtPaymentHistory(debt.id);
      return (
        <div
          key={debt.id}
          className={`bg-white rounded-lg shadow-md border-2 transition-all ${
            debt.homeSold ? 'border-amber-400' :
            debt.transferredToHELOC ? 'border-[#F2994A]' : 'border-[#27AE60]'
          }`}
        >
          <div className="p-6">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-700 line-through decoration-gray-400 mb-1">{debt.accountName}</h3>
                <p className="text-sm text-gray-500">{debt.category}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`flex items-center space-x-1 text-white text-xs font-bold px-3 py-1 rounded-full ${
                  debt.homeSold ? 'bg-amber-500' :
                  debt.transferredToHELOC ? 'bg-[#F2994A]' : 'bg-[#27AE60]'
                }`}>
                  {debt.homeSold ? <Home className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                  <span>
                    {debt.homeSold ? 'HOME SOLD' :
                     debt.transferredToHELOC ? 'TRANSFERRED' : 'PAID OFF'}
                  </span>
                </span>
                <button
                  onClick={(e) => handleDeleteClick(debt, e)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete debt"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Original Balance</p>
                <p className="font-bold text-gray-800">{CalculationService.formatCurrency(debt.startingBalance)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Date Paid Off</p>
                <p className="font-bold text-[#27AE60]">
                  {debt.paidOffDate && !isNaN(new Date(debt.paidOffDate).getTime())
                    ? new Date(debt.paidOffDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : debt.homeSaleDate && !isNaN(new Date(debt.homeSaleDate).getTime())
                      ? new Date(debt.homeSaleDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Recently'}
                </p>
              </div>
              {totalPaid > 0 && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Total Paid</p>
                  <p className="font-bold text-[#2D9CDB]">{CalculationService.formatCurrency(totalPaid)}</p>
                </div>
              )}
              {totalInterest > 0 && (
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Total Interest Paid</p>
                  <p className="font-bold text-red-600">{CalculationService.formatCurrency(totalInterest)}</p>
                </div>
              )}
            </div>

            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full bg-[#27AE60] w-full" />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">100% paid off</p>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => handleViewDetail(debt)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold py-2 px-4 rounded transition-colors"
              >
                View Payment History
              </button>
              <button
                onClick={(e) => handleDeleteClick(debt, e)}
                className="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold py-2 px-4 rounded transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={debt.id}
        className={`bg-white rounded-lg shadow-md border-2 transition-all hover:shadow-lg ${
          isZeroBalance ? 'border-[#27AE60] ring-2 ring-[#27AE60]/20' : 'border-gray-200'
        }`}
      >
        <div className="p-6">
          {isZeroBalance && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
              <Trophy className="w-4 h-4 text-[#27AE60] flex-shrink-0" />
              <p className="text-sm font-semibold text-[#27AE60]">Balance reached $0 — ready to mark as paid off!</p>
            </div>
          )}
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="font-bold text-xl text-gray-800 mb-1">{debt.accountName}</h3>
              <p className="text-sm text-gray-500">{debt.category}</p>
            </div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              {debt.refinanceHistory && debt.refinanceHistory.length > 0 && (
                <span
                  className={`flex items-center space-x-1 text-xs font-semibold px-2 py-1 rounded-full ${
                    didRateImprove(debt)
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                  title={`Refinanced on ${getLastRefinanceDate(debt)}`}
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>
                    {didRateImprove(debt) ? 'Rate Improved' : 'Refinanced'} {getLastRefinanceDate(debt)}
                    {(() => {
                      const lastRefi = debt.refinanceHistory?.[debt.refinanceHistory.length - 1];
                      return lastRefi?.newLender ? (
                        <span className="text-xs text-gray-500 ml-1">· {lastRefi.newLender}</span>
                      ) : null;
                    })()}
                  </span>
                </span>
              )}
              <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded">
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
            <p className="text-sm text-gray-600 mb-1">Current Balance</p>
            <p className={`text-3xl font-bold ${isZeroBalance ? 'text-[#27AE60]' : 'text-[#1E3A5F]'}`}>
              {CalculationService.formatCurrency(debt.currentBalance)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Started at {CalculationService.formatCurrency(debt.startingBalance)}
            </p>
            {debt.replacedByDebtId && (
              <p className="text-xs text-gray-500 mt-1">Replaced by new mortgage</p>
            )}
            {debt.replacedDebtName && (
              <p className="text-xs text-amber-600 mt-1">Replaced {debt.replacedDebtName}</p>
            )}
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Amount Paid Off: {CalculationService.formatCurrency(paidOff)}</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isZeroBalance ? 'bg-[#27AE60]' : 'bg-[#2D9CDB]'}`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          <div className="text-sm text-gray-600 mb-4">
            <p>Minimum Payment: {CalculationService.formatCurrency(debt.minimumPayment)}</p>
          </div>

          {isInstallmentLoanCategory(debt.category) &&
            (debt.originalAmount != null ||
              debt.loanStartDate ||
              (debt.loanTerm != null && debt.loanTerm > 0)) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4 text-sm">
                {debt.originalAmount != null && debt.originalAmount > 0 && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">Original balance</p>
                    <p className="font-semibold text-gray-800">
                      {formatOriginalAmountForDisplay(debt.originalAmount)}
                    </p>
                  </div>
                )}
                {debt.loanStartDate && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">Loan start</p>
                    <p className="font-semibold text-gray-800">
                      {formatLoanStartDateForDisplay(debt.loanStartDate)}
                    </p>
                  </div>
                )}
                {debt.loanTerm != null && debt.loanTerm > 0 && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">Term</p>
                    <p className="font-semibold text-gray-800">
                      {formatLoanTermForDisplay(debt.loanTerm, debt.loanTermUnit, debt.isAmortized)}
                      {hasCompleteInstallmentMetadata(debt) && (
                        <span className="block text-xs font-normal text-gray-500 mt-0.5">
                          Installment-aware payoff estimates
                        </span>
                      )}
                    </p>
                    {hasProjectedPayoffMetadata(debt) && formatProjectedPayoffMonthYear(debt) && (
                      <p className="text-xs text-[#1E3A5F] mt-1.5 font-medium">
                        Projected payoff: {formatProjectedPayoffMonthYear(debt)}
                        {(() => {
                          const monthsLeft = getMonthsRemainingUntilProjectedPayoff(debt);
                          return monthsLeft != null
                            ? ` · ${monthsLeft} month${monthsLeft !== 1 ? 's' : ''} left`
                            : '';
                        })()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

          <div className="flex flex-col space-y-2">
            {isZeroBalance && (
              <button
                onClick={(e) => handleMarkPaidOffClick(debt, e)}
                className="w-full bg-[#27AE60] hover:bg-[#229954] text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-md"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Mark as Paid Off</span>
              </button>
            )}
            <div className="flex space-x-2">
              <button
                onClick={() => handleViewDetail(debt)}
                className="flex-1 bg-[#2D9CDB] hover:bg-[#1E8BBD] text-white text-sm font-semibold py-2 px-4 rounded transition-colors"
              >
                View Details
              </button>
              {debt.category === 'Credit Card' && (
                <button
                  onClick={() => handleAddCharge(debt.id)}
                  className="bg-[#F2C94C] hover:bg-[#E0B73C] text-gray-800 text-sm font-semibold py-2 px-4 rounded transition-colors"
                >
                  Add Charge
                </button>
              )}
            </div>
            <button
              onClick={(e) => handleRefinanceClick(debt, e)}
              className="w-full bg-[#1E3A5F]/5 hover:bg-[#1E3A5F]/10 text-[#1E3A5F] text-sm font-semibold py-2 px-4 rounded transition-colors flex items-center justify-center space-x-2"
            >
              {getRefinanceIcon(debt)}
              <span>{getRefinanceButtonLabel(debt)}</span>
            </button>
            {!debt.isPaidOff && (
              <button
                onClick={(e) => { e.stopPropagation(); handleMarkPaidOff(debt); }}
                className="w-full text-center py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200 mt-1"
              >
                ✓ Mark as Paid Off
              </button>
            )}
            {debt.category === 'Mortgage' && (
              <button
                onClick={(e) => handleSoldHomeClick(debt, e)}
                className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-semibold py-2 px-4 rounded transition-colors flex items-center justify-center space-x-2"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Sold Home</span>
              </button>
            )}
            <button
              onClick={() => {
                setBatchEntryDebt(debt);
                setShowBatchEntry(true);
              }}
              className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold py-2 px-4 rounded transition-colors flex items-center justify-center space-x-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Batch Entry (Demo)</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">My Debts</h2>
        <button
          onClick={() => setShowAddDebt(true)}
          className="inline-flex items-center space-x-2 bg-[#FF6B35] hover:bg-[#E55A25] text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Debt</span>
        </button>
      </div>

      {zeroBalanceActiveDebts.length > 0 && (
        <div className="bg-emerald-50 border-2 border-[#27AE60] rounded-xl p-4 flex items-start gap-3">
          <Trophy className="w-5 h-5 text-[#27AE60] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#27AE60] text-sm">
              {zeroBalanceActiveDebts.length === 1
                ? `${zeroBalanceActiveDebts[0].accountName} is at $0!`
                : `${zeroBalanceActiveDebts.length} debts are at $0!`}
            </p>
            <p className="text-sm text-emerald-700">
              Click "Mark as Paid Off" on {zeroBalanceActiveDebts.length === 1 ? 'the card below' : 'each card below'} to celebrate and move it to your paid-off history.
            </p>
          </div>
        </div>
      )}

      {activeDebts.length === 0 && paidOffDebts.length > 0 ? (
        <div className="text-center py-12 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200">
          <Trophy className="w-16 h-16 text-[#27AE60] mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-800 mb-2">All Debts Paid Off!</h3>
          <p className="text-gray-600 mb-4">You've eliminated all your tracked debts. Amazing work!</p>
          <button
            onClick={() => setShowAddDebt(true)}
            className="inline-flex items-center space-x-2 bg-[#FF6B35] hover:bg-[#E55A25] text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Debt</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {activeDebts.map(debt => renderDebtCard(debt, false))}
        </div>
      )}

      {paidOffDebts.length > 0 && (
        <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setPaidOffExpanded(prev => !prev)}
            className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-[#27AE60] rounded-full">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-bold text-gray-800">Paid Off Debts</span>
                <span className="ml-2 text-sm font-semibold text-[#27AE60] bg-emerald-100 px-2 py-0.5 rounded-full">
                  {paidOffDebts.length}
                </span>
              </div>
              <span className="text-sm text-gray-500 hidden sm:inline">
                — {CalculationService.formatCurrency(paidOffDebts.reduce((s, d) => s + d.startingBalance, 0))} eliminated
              </span>
            </div>
            {paidOffExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {paidOffExpanded && (
            <div className="p-6 bg-white">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {paidOffDebts.map(debt => renderDebtCard(debt, true))}
              </div>
            </div>
          )}
        </div>
      )}

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

      {showHomeSaleCelebration && homeSaleCelebrationData && (
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
              <Trophy className="w-8 h-8 text-[#27AE60]" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">Mark as Paid Off?</h3>
            <p className="text-gray-600 mb-1 text-center">
              You're marking <strong>{markingPaidOffDebt.accountName}</strong> as fully paid off.
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
                className="flex-1 bg-[#27AE60] hover:bg-[#229954] text-white font-bold py-2.5 px-4 rounded-lg transition-colors"
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
