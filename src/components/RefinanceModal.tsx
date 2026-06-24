import { useState, useEffect } from 'react';
import { X, AlertTriangle, Info, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import DatePicker from './DatePicker';
import type { Debt, Transaction, RefinanceRecord } from '../types';

interface RefinanceModalProps {
  debt: Debt;
  onClose: () => void;
  onSuccess: () => void;
}

type RefinanceSubtype =
  | 'rate_term'
  | 'cash_out'
  | 'refinanced'
  | 'consolidated'
  | 'new_card'
  | 'personal_loan';

function getModalTitle(debt: Debt): string {
  if (debt.category === 'Credit Card') return `Transfer Balance from ${debt.accountName}`;
  if (debt.category === 'Student Loan') return `Refinance/Consolidate ${debt.accountName}`;
  return `Refinance ${debt.accountName}`;
}

function getModalSubtitle(debt: Debt): string {
  if (debt.category === 'Credit Card')
    return 'Update after transferring balance to a new card or loan. Payment history will be preserved.';
  if (debt.category === 'Student Loan')
    return 'Update after refinancing or consolidating your loan. Payment history will be preserved.';
  return 'Update your loan after refinancing. Payment history will be preserved.';
}

function getDefaultSubtype(debt: Debt): RefinanceSubtype {
  if (debt.category === 'Credit Card') return 'new_card';
  if (debt.category === 'Student Loan') return 'refinanced';
  return 'rate_term';
}

export default function RefinanceModal({ debt, onClose, onSuccess }: RefinanceModalProps) {
  const [refinanceDate, setRefinanceDate] = useState(CalculationService.getTodayDateString());
  const [newLender, setNewLender] = useState('');
  const [newAccountName, setNewAccountName] = useState(debt.accountName);
  const [newBalance, setNewBalance] = useState(debt.currentBalance.toFixed(2));
  const [newRate, setNewRate] = useState(debt.interestRate.toString());
  const [newPayment, setNewPayment] = useState(debt.minimumPayment.toFixed(2));
  const [newTerm, setNewTerm] = useState(debt.loanTerm?.toString() || '');
  const [subtype, setSubtype] = useState<RefinanceSubtype>(getDefaultSubtype(debt));
  const [isZeroIntro, setIsZeroIntro] = useState(false);
  const [introEndDate, setIntroEndDate] = useState('');
  const [rateAfterIntro, setRateAfterIntro] = useState('');
  const [showWarning, setShowWarning] = useState<'balance' | 'rate' | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [consolidatedDebtIds, setConsolidatedDebtIds] = useState<string[]>([]);
  const [showConsolidation, setShowConsolidation] = useState(false);

  // Get all other active debts that could have been paid off by this refinance
  const allDebts = StorageService.getDebts();
  const otherActiveDebts = allDebts.filter(d =>
    !d.isPaidOff &&
    d.currentBalance > 0
  );

  const consolidatedTotal = otherActiveDebts
    .filter(d => consolidatedDebtIds.includes(d.id))
    .reduce((sum, d) => sum + d.currentBalance, 0);

  const isCreditCard = debt.category === 'Credit Card';
  const isStudentLoan = debt.category === 'Student Loan';
  const isMortgageOrAuto = debt.category === 'Mortgage' || debt.category === 'Auto Loan';
  const isPersonalLoan = debt.category === 'Personal Loan' || debt.category === 'Other';
  const showTermField = isMortgageOrAuto || isStudentLoan || isPersonalLoan;

  const parsedNewBalance = parseFloat(newBalance.replace(/[^0-9.]/g, '')) || 0;
  const parsedNewRate = parseFloat(newRate) || 0;

  useEffect(() => {
    if (isCreditCard && parseFloat(newRate) === 0) {
      setIsZeroIntro(true);
    }
  }, [newRate]);

  const handleRateChange = (val: string) => {
    setNewRate(val);
    if (isCreditCard) {
      const r = parseFloat(val);
      setIsZeroIntro(r === 0);
    }
  };

  const checkAndSubmit = () => {
    const balanceIncreased = parsedNewBalance > debt.currentBalance;
    const rateIncreased = parsedNewRate > debt.interestRate;

    if (balanceIncreased && !pendingSubmit) {
      setShowWarning('balance');
      setPendingSubmit(true);
      return;
    }
    if (rateIncreased && !pendingSubmit) {
      setShowWarning('rate');
      setPendingSubmit(true);
      return;
    }

    doSubmit();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPendingSubmit(false);
    checkAndSubmit();
  };

  const confirmWarning = () => {
    setShowWarning(null);
    doSubmit();
  };

  const doSubmit = () => {
    const debts = StorageService.getDebts();
    const idx = debts.findIndex(d => d.id === debt.id);
    if (idx === -1) return;

    const parsedBalance = parseFloat(newBalance.replace(/[^0-9.]/g, '')) || 0;
    const parsedRate = parseFloat(newRate) || 0;
    const parsedPayment = parseFloat(newPayment.replace(/[^0-9.]/g, '')) || 0;
    const parsedTerm = newTerm ? parseInt(newTerm) : undefined;

    const refinanceRecord: RefinanceRecord = {
      id: `refi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: refinanceDate,
      type: subtype === 'cash_out' ? 'cash_out' :
            subtype === 'consolidated' ? 'consolidation' :
            subtype === 'new_card' || subtype === 'personal_loan' ? 'balance_transfer' :
            'refinance',
      previousBalance: debt.currentBalance,
      newBalance: parsedBalance,
      previousRate: debt.interestRate,
      newRate: parsedRate,
      previousPayment: debt.minimumPayment,
      newPayment: parsedPayment,
      previousTerm: debt.loanTerm,
      newTerm: parsedTerm,
      newLender: newLender.trim() || undefined,
      newAccountName: newAccountName.trim() !== debt.accountName ? newAccountName.trim() : undefined,
      introRate: isZeroIntro && isCreditCard ? 0 : undefined,
      introEndDate: isZeroIntro && introEndDate ? introEndDate : undefined,
      rateAfterIntro: isZeroIntro && rateAfterIntro ? parseFloat(rateAfterIntro) : undefined,
    };

    const updatedDebt: Debt = {
      ...debts[idx],
      accountName: newAccountName.trim() || debts[idx].accountName,
      currentBalance: parsedBalance,
      interestRate: parsedRate,
      minimumPayment: parsedPayment,
      loanTerm: parsedTerm ?? debts[idx].loanTerm,
      introRate: isZeroIntro && isCreditCard ? 0 : undefined,
      introEndDate: isZeroIntro && introEndDate ? introEndDate : undefined,
      rateAfterIntro: isZeroIntro && rateAfterIntro ? parseFloat(rateAfterIntro) : undefined,
      refinanceHistory: [...(debts[idx].refinanceHistory || []), refinanceRecord],
    };

    debts[idx] = updatedDebt;
    StorageService.saveDebts(debts);

    // Mark consolidated debts as paid off via refinance
    if (consolidatedDebtIds.length > 0) {
      const now = new Date().toISOString();
      const currentDebts = StorageService.getDebts();

      // If the current debt is being consolidated (replaced by a new loan)
      // we need to ADD the new loan as a separate debt entry instead of
      // updating the existing one in place
      const currentDebtConsolidated = consolidatedDebtIds.includes(debt.id);

      if (currentDebtConsolidated) {
        // Create the new loan as a fresh debt entry
        const newDebt: Debt = {
          id: `debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          accountName: newAccountName.trim() || debt.accountName,
          category: debt.category,
          currentBalance: parsedBalance,
          startingBalance: parsedBalance,
          interestRate: parsedRate,
          minimumPayment: parsedPayment,
          loanTerm: parsedTerm ?? debt.loanTerm,
          loanStartDate: refinanceDate,
          isPaidOff: false,
          createdAt: now,
          notes: `New loan from refinance on ${refinanceDate}. Replaced ${debt.accountName}${newLender ? ` with ${newLender}` : ''}.`,
          refinanceHistory: [],
        };

        // Mark ALL selected debts (including current) as paid off/consolidated
        const withConsolidated = currentDebts.map(d => {
          if (consolidatedDebtIds.includes(d.id)) {
            return {
              ...d,
              isPaidOff: true,
              currentBalance: 0,
              paidOffDate: now,
              paidOffAt: now,
              notes: `${d.notes || ''} Paid off via refinance into ${newDebt.accountName} on ${refinanceDate}.`.trim(),
            };
          }
          return d;
        });

        // Add the new loan
        withConsolidated.push(newDebt);
        StorageService.saveDebts(withConsolidated);
      } else {
        // Standard consolidation — current debt updated, others marked paid off
        const withConsolidated = currentDebts.map(d => {
          if (consolidatedDebtIds.includes(d.id)) {
            return {
              ...d,
              isPaidOff: true,
              currentBalance: 0,
              paidOffDate: now,
              paidOffAt: now,
              notes: `${d.notes || ''} Consolidated into ${newAccountName.trim() || debt.accountName} refinance on ${refinanceDate}.`.trim(),
            };
          }
          return d;
        });
        StorageService.saveDebts(withConsolidated);
      }
    }

    const typeLabel = isCreditCard ? 'Balance Transfer' :
                      isStudentLoan && subtype === 'consolidated' ? 'Consolidation' :
                      'Refinanced';

    const rateChangeText = parsedRate !== debt.interestRate
      ? ` New rate: ${parsedRate}%, was ${debt.interestRate}%.`
      : '';

    const refinanceTransaction: Transaction = {
      id: `txn_refi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      debtId: debt.id,
      debtName: newAccountName.trim() || debt.accountName,
      date: refinanceDate,
      type: 'refinance',
      amount: 0,
      previousBalance: debt.currentBalance,
      interestCharged: 0,
      principalPaid: 0,
      newBalance: parsedBalance,
      notes: `${typeLabel} - New balance: ${CalculationService.formatCurrency(parsedBalance)}, New rate: ${parsedRate}%.${newLender ? ` Lender: ${newLender}.` : ''}${rateChangeText}`,
    };

    const transactions = StorageService.getTransactions();
    transactions.push(refinanceTransaction);
    StorageService.saveTransactions(transactions);

    onSuccess();
  };

  const balanceDiff = parsedNewBalance - debt.currentBalance;
  const rateDiff = parsedNewRate - debt.interestRate;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-6 pb-4 rounded-t-xl z-10">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3">
              <div className="bg-brand-blue/10 p-2 rounded-lg">
                {isCreditCard ? (
                  <ArrowRightLeft className="w-5 h-5 text-brand-blue" />
                ) : (
                  <RefreshCw className="w-5 h-5 text-brand-blue" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">{getModalTitle(debt)}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{getModalSubtitle(debt)}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4 flex-shrink-0">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {showWarning && (
          <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                {showWarning === 'balance' ? (
                  <>
                    <p className="text-sm font-semibold text-amber-800">Balance Increased</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Balance will increase by {CalculationService.formatCurrency(balanceDiff)}. Make sure this was intentional (e.g., cash-out refinance).
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-amber-800">Interest Rate Increased</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Rate will increase from {debt.interestRate}% to {parsedNewRate}%. This will cost more in interest over time.
                    </p>
                  </>
                )}
                <div className="flex space-x-3 mt-3">
                  <button
                    onClick={() => { setShowWarning(null); setPendingSubmit(false); }}
                    className="text-sm font-semibold text-gray-600 hover:text-gray-800"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={confirmWarning}
                    className="text-sm font-semibold text-amber-700 hover:text-amber-900"
                  >
                    Confirm & Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {isCreditCard ? 'Transfer Date' : isStudentLoan ? 'Refinance Date' : 'Refinance Date'}
            </label>
            <DatePicker
              value={refinanceDate}
              onChange={setRefinanceDate}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
            />
          </div>

          {isCreditCard && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Transferred To
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'new_card', label: 'New Credit Card', sub: 'Balance transfer' },
                  { value: 'personal_loan', label: 'Personal Loan', sub: 'Debt consolidation' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSubtype(opt.value as RefinanceSubtype)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      subtype === opt.value
                        ? 'border-brand-blue bg-brand-blue/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isStudentLoan && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'refinanced', label: 'Refinanced', sub: 'Single loan, new terms' },
                  { value: 'consolidated', label: 'Consolidated', sub: 'Combined multiple loans' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSubtype(opt.value as RefinanceSubtype)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      subtype === opt.value
                        ? 'border-brand-blue bg-brand-blue/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(isMortgageOrAuto || isPersonalLoan) && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Refinance Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'rate_term', label: 'Rate & Term', sub: 'Lower rate or shorter term' },
                  { value: 'cash_out', label: 'Cash-Out', sub: 'Increased balance' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSubtype(opt.value as RefinanceSubtype)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      subtype === opt.value
                        ? 'border-brand-blue bg-brand-blue/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {isCreditCard ? 'New Lender / Card Name' : 'New Lender'}{' '}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={newLender}
              onChange={e => setNewLender(e.target.value)}
              placeholder={
                debt.category === 'Mortgage' ? 'e.g., Rocket Mortgage' :
                isCreditCard ? 'e.g., Chase Slate' :
                isStudentLoan ? 'e.g., SoFi' :
                'e.g., LightStream'
              }
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Rename Account <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={newAccountName}
              onChange={e => setNewAccountName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Balance</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={newBalance}
                  onChange={e => setNewBalance(e.target.value)}
                  required
                  className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                />
              </div>
              {parsedNewBalance > debt.currentBalance && (
                <p className="text-xs text-amber-600 mt-1 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>+{CalculationService.formatCurrency(balanceDiff)} from current</span>
                </p>
              )}
              {parsedNewBalance < debt.currentBalance && parsedNewBalance > 0 && (
                <p className="text-xs text-brand-green mt-1">
                  -{CalculationService.formatCurrency(debt.currentBalance - parsedNewBalance)} from current
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Interest Rate</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={newRate}
                  onChange={e => handleRateChange(e.target.value)}
                  required
                  className="w-full pl-4 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">%</span>
              </div>
              {parsedNewRate < debt.interestRate && parsedNewRate >= 0 && (
                <p className="text-xs text-brand-green mt-1">
                  -{(debt.interestRate - parsedNewRate).toFixed(2)}% improvement
                </p>
              )}
              {parsedNewRate > debt.interestRate && (
                <p className="text-xs text-amber-600 mt-1 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>+{rateDiff.toFixed(2)}% from current</span>
                </p>
              )}
            </div>
          </div>

          {isCreditCard && isZeroIntro && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
              <div className="flex items-start space-x-2">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Make sure to pay off before the intro rate expires to maximize savings!
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Intro Period Ends</label>
                  <DatePicker
                    value={introEndDate}
                    onChange={setIntroEndDate}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Rate After Intro</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={rateAfterIntro}
                      onChange={e => setRateAfterIntro(e.target.value)}
                      placeholder="e.g., 24.99"
                      className="w-full pl-4 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Monthly Payment</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
              <input
                type="number"
                step="0.001"
                min="0"
                value={newPayment}
                onChange={e => setNewPayment(e.target.value)}
                required
                className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
            </div>
          </div>

          {showTermField && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                New Loan Term (years) <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={newTerm}
                onChange={e => setNewTerm(e.target.value)}
                placeholder="e.g., 30"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
            </div>
          )}

          {debt.refinanceHistory && debt.refinanceHistory.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Previous Refinances</p>
              <div className="space-y-2">
                {debt.refinanceHistory.map((r, i) => (
                  <div key={r.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-gray-500">
                      {i === 0 ? 'Original' : `Refinance ${i}`}: {CalculationService.formatCurrency(r.previousBalance)} @ {r.previousRate}%
                    </span>
                    <span className="text-gray-400 text-xs">{CalculationService.formatDate(r.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debt Consolidation Section */}
          {otherActiveDebts.length > 0 && (
            <div className="border border-blue-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowConsolidation(!showConsolidation)}
                className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-blue-900">Did this refinance pay off other debts?</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    {consolidatedDebtIds.length > 0
                      ? `${consolidatedDebtIds.length} debt${consolidatedDebtIds.length > 1 ? 's' : ''} selected — ${CalculationService.formatCurrency(consolidatedTotal)} will be marked paid off`
                      : 'Common in cash-out refinances and consolidation loans'}
                  </p>
                </div>
                <span className="text-blue-600 text-lg">{showConsolidation ? '−' : '+'}</span>
              </button>

              {showConsolidation && (
                <div className="p-4 space-y-2 bg-white">
                  <p className="text-xs text-gray-500 mb-3">
                    Select any debts that were paid off using proceeds from this refinance.
                    They will be marked as consolidated and removed from your payoff plan.
                  </p>
                  {otherActiveDebts.map(d => (
                    <label key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={consolidatedDebtIds.includes(d.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setConsolidatedDebtIds([...consolidatedDebtIds, d.id]);
                          } else {
                            setConsolidatedDebtIds(consolidatedDebtIds.filter(id => id !== d.id));
                          }
                        }}
                        className="w-4 h-4 text-brand-orange rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">
                          {d.accountName}
                          {d.id === debt.id && (
                            <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              This loan
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{d.category} · {CalculationService.formatCurrency(d.currentBalance)} remaining</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-brand-blue hover:bg-[#1E8BBD] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              {isCreditCard ? 'Update' : 'Update Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
