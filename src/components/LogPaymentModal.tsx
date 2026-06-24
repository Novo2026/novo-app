import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, CreditCard as Edit2, CreditCard, Home, FileText } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import CelebrationModal from './CelebrationModal';
import { MILESTONE_CELEBRATIONS_DISABLED } from '../utils/milestoneEngine';
import EditDebtModal from './EditDebtModal';
import DatePicker from './DatePicker';
import PaymentLoggingGuidance from './PaymentLoggingGuidance';
import type { Debt, Transaction, Milestone, CheckingTransaction, HELOCTransaction, UnifiedPayment } from '../types';

interface LogPaymentModalProps {
  preselectedDebtId: string | null;
  preselectedAmount?: number;
  onClose: () => void;
  onSuccess: () => void;
}

type PaymentType = 'minimum' | 'minimum-plus' | 'custom';
type PaymentSource = 'checking' | 'heloc' | 'other' | null;

export default function LogPaymentModal({ preselectedDebtId, preselectedAmount, onClose, onSuccess }: LogPaymentModalProps) {
  const [paymentSource, setPaymentSource] = useState<PaymentSource>(null);
  const [selectedDebtId, setSelectedDebtId] = useState(preselectedDebtId || '');
  const [paymentType, setPaymentType] = useState<PaymentType>(preselectedAmount ? 'custom' : 'minimum');
  const [extraAmount, setExtraAmount] = useState('');
  const [customAmount, setCustomAmount] = useState(preselectedAmount ? String(preselectedAmount) : '');
  const [paymentDate, setPaymentDate] = useState(CalculationService.getTodayDateString());
  const [notes, setNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [calculationResult, setCalculationResult] = useState<{
    debtName: string;
    previousBalance: number;
    interestCharged: number;
    paymentAmount: number;
    newBalance: number;
    principalPaid: number;
    progress: number;
    isPaidOff: boolean;
    freedPayment: number;
    totalDebtEliminated: number;
    previousCashFlow?: number;
  } | null>(null);

  const debts = StorageService.getDebts().filter(d => !d.isPaidOff && d.category !== 'HELOC');
  const selectedDebt = debts.find(d => d.id === selectedDebtId);

  const settings = JSON.parse(localStorage.getItem('novo_settings') || '{"useCheckingRegister":false,"useHELOC":false}');
  const { useCheckingRegister, useHELOC } = settings;

  useEffect(() => {
    if (useCheckingRegister && !useHELOC) {
      setPaymentSource('checking');
    } else if (!useCheckingRegister && useHELOC) {
      setPaymentSource('heloc');
    } else if (!useCheckingRegister && !useHELOC) {
      setPaymentSource('other');
    }
  }, []);

  const [initialDebtId] = useState(preselectedDebtId || '');
  useEffect(() => {
    if (selectedDebtId && selectedDebt && selectedDebtId !== initialDebtId) {
      setPaymentType('minimum');
      setExtraAmount('');
      setCustomAmount('');
    }
  }, [selectedDebtId]);

  const getPaymentAmount = (): number => {
    if (!selectedDebt) return 0;

    if (paymentType === 'minimum') {
      return selectedDebt.minimumPayment;
    } else if (paymentType === 'minimum-plus') {
      const extra = parseFloat(extraAmount) || 0;
      return selectedDebt.minimumPayment + extra;
    } else {
      return parseFloat(customAmount) || 0;
    }
  };

  const getTotalAmount = (): number => {
    return getPaymentAmount();
  };

  const isCustomBelowMinimum = (): boolean => {
    if (!selectedDebt || paymentType !== 'custom') return false;
    const amount = parseFloat(customAmount) || 0;
    return amount > 0 && amount < selectedDebt.minimumPayment;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDebtId || !paymentSource) return;

    const debt = debts.find(d => d.id === selectedDebtId);
    if (!debt) return;

    const amount = getPaymentAmount();
    if (isNaN(amount) || amount <= 0) return;

    const calculation = debt.isAmortized
      ? CalculationService.calculateAmortizedPayment(debt, amount)
      : CalculationService.calculatePayment(debt.currentBalance, debt.interestRate, amount);

    const newDebts = StorageService.getDebts().map(d => {
      if (d.id === selectedDebtId) {
        const isPaidOff = calculation.newBalance === 0;
        return {
          ...d,
          currentBalance: calculation.newBalance,
          isPaidOff,
          paidOffDate: isPaidOff ? paymentDate : d.paidOffDate,
        };
      }
      return d;
    });

    const isExtraPayment = paymentType === 'minimum-plus' ||
      (paymentType === 'custom' && amount > debt.minimumPayment);

    const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const isPaidOff = calculation.newBalance === 0;

    const unifiedPayment: UnifiedPayment = {
      id: paymentId,
      date: paymentDate,
      debtId: selectedDebtId,
      debtName: debt.accountName,
      amount,
      source: paymentSource === 'checking' ? 'checking' : paymentSource === 'heloc' ? 'heloc' : 'direct',
      interestCharged: calculation.interestCharged,
      principalPaid: calculation.principalPaid,
      previousBalance: debt.currentBalance,
      newBalance: calculation.newBalance,
      description: notes.trim() || undefined,
      isPaidOff,
    };

    StorageService.addUnifiedPayment(unifiedPayment);
    StorageService.saveDebts(newDebts);

    if (paymentSource === 'checking') {
      const checkingTransactions: CheckingTransaction[] = JSON.parse(
        localStorage.getItem('novo_checking_transactions') || '[]'
      );

      const checkingBalance = checkingTransactions.length > 0
        ? checkingTransactions[checkingTransactions.length - 1].balance
        : 0;

      const newCheckingTransaction: CheckingTransaction = {
        id: `checking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: paymentDate,
        type: 'withdrawal',
        amount,
        description: `Debt payment: ${debt.accountName}`,
        category: 'Debt Payment',
        balance: checkingBalance - amount,
      };

      checkingTransactions.push(newCheckingTransaction);
      checkingTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      for (let i = checkingTransactions.length - 1; i >= 0; i--) {
        if (i === checkingTransactions.length - 1) continue;
        const current = checkingTransactions[i];
        const previous = checkingTransactions[i + 1];

        if (current.type === 'deposit' || current.type === 'transfer_from_heloc') {
          current.balance = previous.balance + current.amount;
        } else {
          current.balance = previous.balance - current.amount;
        }
      }

      localStorage.setItem('novo_checking_transactions', JSON.stringify(checkingTransactions));
    } else if (paymentSource === 'heloc') {
      const helocTransactions: HELOCTransaction[] = JSON.parse(
        localStorage.getItem('novo_heloc_transactions') || '[]'
      );

      const helocBalance = helocTransactions.length > 0
        ? helocTransactions[helocTransactions.length - 1].balance
        : 0;

      const newHelocTransaction: HELOCTransaction = {
        id: `heloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: paymentDate,
        type: 'draw',
        amount,
        description: `Paid ${debt.accountName}`,
        debtLinked: selectedDebtId,
        balance: helocBalance + amount,
      };

      helocTransactions.push(newHelocTransaction);
      helocTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      for (let i = helocTransactions.length - 1; i >= 0; i--) {
        if (i === helocTransactions.length - 1) continue;
        const current = helocTransactions[i];
        const previous = helocTransactions[i + 1];

        if (current.type === 'draw') {
          current.balance = previous.balance + current.amount;
        } else {
          current.balance = previous.balance - current.amount;
        }
      }

      localStorage.setItem('novo_heloc_transactions', JSON.stringify(helocTransactions));
    }

    const paidOff = debt.startingBalance - calculation.newBalance;
    const progress = (paidOff / debt.startingBalance) * 100;

    let previousCashFlow: number | undefined;
    if (isPaidOff) {
      const profile = StorageService.getFinancialProfile();
      if (profile) {
        const allDebts = StorageService.getDebts();
        const activeDebts = allDebts.filter(d => !d.isPaidOff && d.id !== selectedDebtId);
        previousCashFlow = profile.monthlyNetIncome -
          profile.monthlyEssentialExpenses -
          profile.monthlyDiscretionaryExpenses -
          activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0);
      }
    }

    setCalculationResult({
      debtName: debt.accountName,
      previousBalance: debt.currentBalance,
      interestCharged: calculation.interestCharged,
      paymentAmount: amount,
      newBalance: calculation.newBalance,
      principalPaid: calculation.principalPaid,
      progress,
      isPaidOff,
      freedPayment: debt.minimumPayment,
      totalDebtEliminated: debt.startingBalance,
      previousCashFlow,
    });

    if (isPaidOff) {
      const milestone: Milestone = {
        id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'debt_payoff',
        title: `Paid off ${debt.accountName} - freed ${CalculationService.formatCurrency(debt.minimumPayment)}/month`,
        description: `Successfully eliminated ${CalculationService.formatCurrency(debt.startingBalance)} in debt. Your ${CalculationService.formatCurrency(debt.minimumPayment)} monthly payment is now freed up for other debts or savings!`,
        date: paymentDate,
        debtId: selectedDebtId,
        debtName: debt.accountName,
        amount: debt.startingBalance,
        freedPayment: debt.minimumPayment,
      };
      StorageService.addMilestone(milestone);

      const profile = StorageService.getFinancialProfile();
      if (profile) {
        profile.monthlyNetIncome += debt.minimumPayment;
        StorageService.saveFinancialProfile(profile);
      }

      const activeDebts = StorageService.getDebts().filter(d => !d.isPaidOff && d.id !== selectedDebtId);
      if (activeDebts.length > 0) {
        const strategy = StorageService.getStrategy();
        if (strategy && strategy.extraMonthlyPayment !== undefined) {
          strategy.extraMonthlyPayment += debt.minimumPayment;
          StorageService.saveStrategy(strategy);

          const strategyResult = CalculationService.projectDebtPayoff(activeDebts, strategy.extraMonthlyPayment);
          StorageService.saveStrategyResult(strategyResult);
        }
      }

      if (!MILESTONE_CELEBRATIONS_DISABLED) {
        setShowCelebration(true);
      } else {
        setShowSuccess(true);
      }
    } else {
      setShowSuccess(true);
    }

    // Track payment logged event in Google Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'payment_logged');
    }
  };

  const handleClose = () => {
    if (showSuccess || showCelebration) {
      onSuccess();
    } else {
      onClose();
    }
  };

  if (showCelebration && calculationResult && !MILESTONE_CELEBRATIONS_DISABLED) {
    return (
      <CelebrationModal
        debtName={calculationResult.debtName}
        debtAmount={calculationResult.totalDebtEliminated}
        freedPayment={calculationResult.freedPayment}
        previousCashFlow={calculationResult.previousCashFlow}
        onViewPlan={handleClose}
      />
    );
  }

  if (showSuccess && calculationResult) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-green rounded-full mb-4">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800">Payment Logged Successfully!</h3>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
            <div className="text-center pb-3 border-b border-gray-200">
              <p className="text-sm text-gray-600 mb-1">{calculationResult.debtName}</p>
              <p className="text-xs text-gray-500">{CalculationService.formatDate(paymentDate)}</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Previous Balance:</span>
                <span className="font-semibold">{CalculationService.formatCurrencyDetailed(calculationResult.previousBalance)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Interest Charged:</span>
                <span className="font-semibold">+{CalculationService.formatCurrencyDetailed(calculationResult.interestCharged)}</span>
              </div>
              <div className="flex justify-between text-brand-blue">
                <span>Payment Made:</span>
                <span className="font-semibold">-{CalculationService.formatCurrencyDetailed(calculationResult.paymentAmount)}</span>
              </div>
              <div className="pt-2 border-t-2 border-gray-300 flex justify-between font-bold text-base">
                <span className="text-gray-800">New Balance:</span>
                <span className={calculationResult.newBalance === 0 ? 'text-brand-green' : 'text-gray-800'}>
                  {CalculationService.formatCurrencyDetailed(calculationResult.newBalance)}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Principal Paid:</span>
                <span className="font-semibold text-brand-green">{CalculationService.formatCurrencyDetailed(calculationResult.principalPaid)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Progress:</span>
                <span className="font-semibold text-brand-blue">{calculationResult.progress.toFixed(1)}% paid off</span>
              </div>
            </div>
          </div>

          {calculationResult.newBalance === 0 && (
            <div className="bg-gradient-to-r from-brand-green to-[#229954] text-white text-center py-3 px-4 rounded-lg mb-6">
              <p className="font-bold text-lg">DEBT PAID OFF!</p>
              <p className="text-sm">Congratulations on eliminating this debt!</p>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              className="flex-1 bg-brand-blue hover:bg-[#1E8BBD] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              View Updated Balance
            </button>
            <button
              onClick={() => {
                const nextSource: PaymentSource =
                  useCheckingRegister && !useHELOC ? 'checking'
                  : !useCheckingRegister && useHELOC ? 'heloc'
                  : !useCheckingRegister && !useHELOC ? 'other'
                  : null;
                setShowSuccess(false);
                setCalculationResult(null);
                setPaymentSource(nextSource);
                setSelectedDebtId(preselectedDebtId || '');
                setPaymentType('minimum');
                setExtraAmount('');
                setCustomAmount('');
                setPaymentDate(CalculationService.getTodayDateString());
                setNotes('');
              }}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Log Another Payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (debts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-800">Log Payment</h3>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="text-center py-6">
            <p className="text-gray-600 mb-4">
              No debts available for payment logging.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              HELOC transactions must be logged in the HELOC Tracker tab.
            </p>
            <button
              onClick={handleClose}
              className="bg-brand-blue hover:bg-[#1E8BBD] text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showEditModal && selectedDebt) {
    return (
      <EditDebtModal
        debt={selectedDebt}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => {
          setShowEditModal(false);
        }}
      />
    );
  }

  if (paymentSource === null && (useCheckingRegister || useHELOC)) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-200 flex-shrink-0">
            <h3 className="text-2xl font-bold text-gray-800">How are you paying this debt?</h3>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="overflow-y-auto px-6 py-6 space-y-3 flex-1">
            {useCheckingRegister && (
              <button
                type="button"
                onClick={() => setPaymentSource('checking')}
                className="w-full p-5 border-2 border-gray-300 rounded-lg hover:border-brand-green hover:bg-green-50 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-brand-green transition-colors">
                    <CreditCard className="w-6 h-6 text-brand-green group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900 text-lg">Checking Account</div>
                    <div className="text-sm text-gray-600">Pay from checking register</div>
                  </div>
                </div>
              </button>
            )}

            {useHELOC && (
              <button
                type="button"
                onClick={() => setPaymentSource('heloc')}
                className="w-full p-5 border-2 border-gray-300 rounded-lg hover:border-brand-blue hover:bg-blue-50 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-brand-blue transition-colors">
                    <Home className="w-6 h-6 text-brand-blue group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900 text-lg">HELOC</div>
                    <div className="text-sm text-gray-600">Pay from HELOC draw</div>
                  </div>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => setPaymentSource('other')}
              className="w-full p-5 border-2 border-gray-300 rounded-lg hover:border-gray-500 hover:bg-gray-50 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-500 transition-colors">
                  <FileText className="w-6 h-6 text-gray-500 group-hover:text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-900 text-lg">Other / Direct</div>
                  <div className="text-sm text-gray-600">Just log debt reduction</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-2xl font-bold text-gray-800">Log Payment</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          {paymentSource && (useCheckingRegister || useHELOC) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {paymentSource === 'checking' && (
                  <>
                    <CreditCard className="w-4 h-4 text-brand-green" />
                    <span className="text-sm font-semibold text-gray-700">Paying from: Checking Account</span>
                  </>
                )}
                {paymentSource === 'heloc' && (
                  <>
                    <Home className="w-4 h-4 text-brand-blue" />
                    <span className="text-sm font-semibold text-gray-700">Paying from: HELOC</span>
                  </>
                )}
                {paymentSource === 'other' && (
                  <>
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">Paying from: Other/Direct</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPaymentSource(null)}
                className="text-xs text-brand-blue hover:text-[#1E8BBD] font-medium"
              >
                Change
              </button>
            </div>
          )}
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
              <option value="">Select a debt...</option>
              {debts.map(debt => (
                <option key={debt.id} value={debt.id}>
                  {debt.accountName} ({CalculationService.formatCurrency(debt.currentBalance)})
                </option>
              ))}
            </select>
            {selectedDebt && (
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="mt-2 text-sm text-brand-blue hover:text-[#1E8BBD] font-medium flex items-center gap-1 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Need to update this debt? Edit Debt
              </button>
            )}
          </div>

          {selectedDebt && (
            <>
            <PaymentLoggingGuidance
              debtId={selectedDebt.id}
              minimumPayment={selectedDebt.minimumPayment}
              onSelectAmount={(amount, source) => {
                if (source === 'minimum') {
                  setPaymentType('minimum');
                  setCustomAmount('');
                  setExtraAmount('');
                } else {
                  setPaymentType('custom');
                  setCustomAmount(amount.toFixed(2));
                  setExtraAmount('');
                }
              }}
            />
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">Payment Amount</span>
                <span className="text-xs text-emerald-700 font-semibold">
                  Minimum Payment: {CalculationService.formatCurrency(selectedDebt.minimumPayment)}
                </span>
              </div>

              <div className="space-y-3">
                <label className="flex items-start space-x-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="paymentType"
                    value="minimum"
                    checked={paymentType === 'minimum'}
                    onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                    className="mt-1 w-4 h-4 text-brand-blue border-gray-300 focus:ring-brand-blue"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800 group-hover:text-brand-blue">
                      Pay minimum only
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {CalculationService.formatCurrency(selectedDebt.minimumPayment)}
                    </div>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="paymentType"
                    value="minimum-plus"
                    checked={paymentType === 'minimum-plus'}
                    onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                    className="mt-1 w-4 h-4 text-brand-blue border-gray-300 focus:ring-brand-blue"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800 group-hover:text-brand-blue">
                      Pay minimum + extra
                    </div>
                    {paymentType === 'minimum-plus' && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="text-gray-600">
                          {CalculationService.formatCurrency(selectedDebt.minimumPayment)}
                        </span>
                        <span className="text-gray-400">+</span>
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                          <input
                            type="number"
                            value={extraAmount}
                            onChange={(e) => setExtraAmount(e.target.value)}
                            className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                            placeholder="0.00"
                            step="0.01"
                            min="0.01"
                          />
                        </div>
                        <span className="text-gray-400">=</span>
                        <span className="font-semibold text-brand-blue min-w-[80px]">
                          {CalculationService.formatCurrency(getTotalAmount())}
                        </span>
                      </div>
                    )}
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="paymentType"
                    value="custom"
                    checked={paymentType === 'custom'}
                    onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                    className="mt-1 w-4 h-4 text-brand-blue border-gray-300 focus:ring-brand-blue"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800 group-hover:text-brand-blue">
                      Custom amount
                    </div>
                    {paymentType === 'custom' && (
                      <div className="mt-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                            placeholder="0.00"
                            step="0.01"
                            min="0.01"
                          />
                        </div>
                        {isCustomBelowMinimum() && (
                          <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>
                              This payment is less than your required minimum of {CalculationService.formatCurrency(selectedDebt.minimumPayment)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
            </>
          )}

          <DatePicker
            label="Payment Date"
            value={paymentDate}
            onChange={setPaymentDate}
            demoMode={JSON.parse(localStorage.getItem('novo_demo_mode') || 'false')}
          />

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

          {selectedDebt && getTotalAmount() > 0 && (
            <div className="bg-brand-blue/10 border-2 border-brand-blue/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Total Payment:</span>
                <span className="text-2xl font-bold text-brand-blue">
                  {CalculationService.formatCurrency(getTotalAmount())}
                </span>
              </div>
            </div>
          )}
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
              disabled={!selectedDebt || getTotalAmount() <= 0}
              className="flex-1 bg-brand-orange hover:bg-brand-orange-dark disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Confirm Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
