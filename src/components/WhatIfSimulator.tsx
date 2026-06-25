import { useMemo, useState } from 'react';
import { AlertTriangle, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { CalculationService } from '../services/calculations';
import { StorageService } from '../services/storage';
import {
  getInstallmentRemainingTermMonths,
  hasCompleteInstallmentMetadata,
} from '../utils/installmentLoan';

interface SimulatorInputs {
  monthlyNetIncome: number;
  monthlyEssentialExpenses: number;
  monthlyDiscretionaryExpenses: number;
  monthlySavingsGoal: number;
  surplusCommitmentPercent: number;
  oneTimeWindfall: number;
  extraMonthlyContribution: number;
}

const clampPercentToStep = (value: number): number => {
  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped / 5) * 5;
};

interface SimDebt {
  id: string;
  accountName: string;
  category: string;
  balance: number;
  annualRate: number;
  minimumPayment: number;
  transferredToHELOC?: boolean;
  /** Installment loan: max simulated months when loan metadata is complete */
  maxPayoffMonths?: number;
}

interface SimulatorFinancialInputs {
  monthlyNetIncome: number;
  monthlyEssentialExpenses: number;
  monthlyDiscretionaryExpenses: number;
  monthlySavingsGoal: number;
  surplusCommitmentPercent: number;
  extraMonthlyContribution: number;
}

interface SimResult {
  months: number;
  totalInterest: number;
  windfallApplied: number;
  surplusAfterSavings: number;
  amountGoingToDebt: number;
}

const MAX_SIM_MONTHS = 1200;

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatMonthYearFromMonths = (monthsFromNow: number): string => {
  if (monthsFromNow <= 0) return 'No active debt';
  const date = new Date();
  date.setMonth(date.getMonth() + monthsFromNow);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const shouldExcludeHelocDebt = (debt: {
  accountName: string;
  category: string;
  id: string;
  transferredToHELOC?: boolean;
}): boolean => {
  const name = debt.accountName.toLowerCase();
  const type = debt.category.toLowerCase();
  const id = debt.id.toLowerCase();
  return (
    name.includes('heloc') ||
    type.includes('heloc') ||
    id.includes('heloc') ||
    debt.transferredToHELOC === true
  );
};

const filterTraditionalSimulationDebts = (debts: SimDebt[]): SimDebt[] =>
  debts.filter((d) => !shouldExcludeHelocDebt(d));

const cloneSimDebts = (debts: SimDebt[]): SimDebt[] =>
  debts.map((d) => ({
    id: d.id,
    accountName: d.accountName,
    category: d.category,
    balance: d.balance,
    annualRate: d.annualRate,
    minimumPayment: d.minimumPayment,
    transferredToHELOC: d.transferredToHELOC,
    maxPayoffMonths: d.maxPayoffMonths,
  }));

/** Apply one-time principal reduction (highest rate first); always subtracts from balance. */
const applyWindfallToBalances = (debts: SimDebt[], windfall: number): number => {
  const safeWindfall = Math.max(0, Number(windfall) || 0);
  if (safeWindfall <= 0) return 0;

  let remainingWindfall = safeWindfall;
  let windfallApplied = 0;
  const targets = [...debts]
    .filter((d) => d.balance > 0.005)
    .sort((a, b) => b.annualRate - a.annualRate || b.balance - a.balance);

  for (const target of targets) {
    if (remainingWindfall <= 0.005) break;
    const principalReduction = Math.min(remainingWindfall, target.balance);
    target.balance = Math.max(0, target.balance - principalReduction);
    windfallApplied += principalReduction;
    remainingWindfall -= principalReduction;
  }

  return Math.round(windfallApplied * 100) / 100;
};

const runPayoffSimulation = (
  debts: SimDebt[],
  financial: SimulatorFinancialInputs,
  windfall: number
): SimResult => {
  const filteredDebts = filterTraditionalSimulationDebts(debts);
  const working = cloneSimDebts(filteredDebts);

  // Month 0: lump-sum windfall on highest-rate debt(s) before the monthly payment loop.
  const windfallApplied = applyWindfallToBalances(working, windfall);

  const activeDebts = working.filter((d) => d.balance > 0.005);
  const totalMinimumPayments = activeDebts.reduce(
    (sum, debt) => sum + Math.max(0, debt.minimumPayment),
    0
  );

  const cashFlow = CalculationService.calculateCashFlow(
    financial.monthlyNetIncome,
    financial.monthlyEssentialExpenses,
    financial.monthlyDiscretionaryExpenses,
    totalMinimumPayments,
    financial.monthlySavingsGoal,
    financial.surplusCommitmentPercent
  );

  const amountGoingToDebt =
    Math.max(0, cashFlow.recommendedExtraPayment) + Math.max(0, financial.extraMonthlyContribution);
  let extraPool = amountGoingToDebt;

  let months = 0;
  let totalInterest = 0;
  const debtMonthsSimulated = new Map<string, number>();

  const canSimulateDebt = (debt: SimDebt) => {
    if (debt.balance <= 0.005) return false;
    const simulated = debtMonthsSimulated.get(debt.id) ?? 0;
    if (debt.maxPayoffMonths != null && simulated >= debt.maxPayoffMonths) return false;
    return true;
  };

  const isWithinInstallmentCap = (debt: SimDebt, monthsThisDebt: number) =>
    debt.maxPayoffMonths == null || monthsThisDebt <= debt.maxPayoffMonths;

  while (activeDebts.some(canSimulateDebt) && months < MAX_SIM_MONTHS) {
    months += 1;
    let freedMinimums = 0;

    // 1) Add monthly interest to each active debt balance.
    for (const debt of activeDebts) {
      if (debt.balance <= 0.005) continue;
      const monthsThisDebt = (debtMonthsSimulated.get(debt.id) ?? 0) + 1;
      debtMonthsSimulated.set(debt.id, monthsThisDebt);
      if (!isWithinInstallmentCap(debt, monthsThisDebt)) {
        continue;
      }
      const monthlyRate = debt.annualRate / 100 / 12;
      const interest = debt.balance * monthlyRate;
      totalInterest += interest;
      debt.balance += interest;
    }

    // 2) Pay minimums on all active debts.
    for (const debt of activeDebts) {
      if (debt.balance <= 0.005) continue;
      const monthsThisDebt = debtMonthsSimulated.get(debt.id) ?? 0;
      if (!isWithinInstallmentCap(debt, monthsThisDebt)) {
        continue;
      }
      const minPay = Math.max(0, debt.minimumPayment);
      const payment = Math.min(minPay, debt.balance);
      debt.balance -= payment;

      if (debt.balance <= 0.005) {
        debt.balance = 0;
        freedMinimums += minPay;
      }
    }

    // 3) Avalanche extra to highest-rate remaining debt.
    const target = [...activeDebts]
      .filter((d) => {
        if (d.balance <= 0.005) return false;
        const monthsThisDebt = debtMonthsSimulated.get(d.id) ?? 0;
        return isWithinInstallmentCap(d, monthsThisDebt);
      })
      .sort((a, b) => b.annualRate - a.annualRate || b.balance - a.balance)[0];

    if (target && extraPool > 0) {
      const extraPayment = Math.min(extraPool, target.balance);
      target.balance -= extraPayment;

      if (target.balance <= 0.005) {
        target.balance = 0;
        freedMinimums += Math.max(0, target.minimumPayment);
      }
    }

    // 4) Snowball/snowflake effect: freed minimums increase future extra pool.
    extraPool += freedMinimums;
  }

  return {
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    windfallApplied: Math.round(windfallApplied * 100) / 100,
    surplusAfterSavings: Math.round(cashFlow.surplusAfterSavings * 100) / 100,
    amountGoingToDebt: Math.round(amountGoingToDebt * 100) / 100,
  };
};

export default function WhatIfSimulator() {
  const profileAtLoad = useMemo(() => StorageService.getFinancialProfile(), []);
  const simulationDebts = useMemo(
    () =>
      StorageService.getDebts()
        .filter((d) => !d.isPaidOff && d.currentBalance > 0 && !shouldExcludeHelocDebt(d))
        .map(
          (d): SimDebt => ({
            id: d.id,
            accountName: d.accountName,
            category: d.category,
            balance: d.currentBalance,
            annualRate: d.interestRate,
            minimumPayment: d.minimumPayment,
            transferredToHELOC: d.transferredToHELOC,
            maxPayoffMonths: hasCompleteInstallmentMetadata(d)
              ? getInstallmentRemainingTermMonths(d) ?? undefined
              : undefined,
          })
        ),
    []
  );

  const baselineInputs = useMemo<SimulatorInputs>(
    () => ({
      monthlyNetIncome: profileAtLoad?.monthlyNetIncome ?? 0,
      monthlyEssentialExpenses: profileAtLoad?.monthlyEssentialExpenses ?? 0,
      monthlyDiscretionaryExpenses: profileAtLoad?.monthlyDiscretionaryExpenses ?? 0,
      monthlySavingsGoal: profileAtLoad?.monthlySavingsGoal ?? 0,
      surplusCommitmentPercent: clampPercentToStep(profileAtLoad?.surplusCommitmentPercent ?? 100),
      oneTimeWindfall: 0,
      extraMonthlyContribution: 0,
    }),
    [profileAtLoad]
  );

  const [inputs, setInputs] = useState<SimulatorInputs>(baselineInputs);

  const scenarioFinancial = useMemo<SimulatorFinancialInputs>(
    () => ({
      monthlyNetIncome: inputs.monthlyNetIncome,
      monthlyEssentialExpenses: inputs.monthlyEssentialExpenses,
      monthlyDiscretionaryExpenses: inputs.monthlyDiscretionaryExpenses,
      monthlySavingsGoal: inputs.monthlySavingsGoal,
      surplusCommitmentPercent: inputs.surplusCommitmentPercent,
      extraMonthlyContribution: inputs.extraMonthlyContribution,
    }),
    [inputs]
  );

  const baselineFinancial = useMemo<SimulatorFinancialInputs>(
    () => ({
      ...scenarioFinancial,
      surplusCommitmentPercent: baselineInputs.surplusCommitmentPercent,
      extraMonthlyContribution: 0,
    }),
    [scenarioFinancial, baselineInputs.surplusCommitmentPercent]
  );

  const baselineResult = useMemo(
    () => runPayoffSimulation(simulationDebts, baselineFinancial, 0),
    [simulationDebts, baselineFinancial]
  );

  const scenarioResult = useMemo(
    () => runPayoffSimulation(simulationDebts, scenarioFinancial, Math.max(0, inputs.oneTimeWindfall)),
    [simulationDebts, scenarioFinancial, inputs.oneTimeWindfall]
  );
  const baselineTotalMonths = baselineResult.months;
  const scenarioTotalMonths = scenarioResult.months;
  const baselineTotalInterest = baselineResult.totalInterest;
  const scenarioTotalInterest = scenarioResult.totalInterest;

  /** Positive = scenario pays off sooner / saves interest vs current plan. */
  const monthsDifference = baselineTotalMonths - scenarioTotalMonths;
  const estimatedInterestSaved = baselineTotalInterest - scenarioTotalInterest;

  const setNumberInput = (field: keyof SimulatorInputs, value: string) => {
    const parsed = parseFloat(value);
    const nextValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setInputs((prev) => ({ ...prev, [field]: nextValue }));
  };

  const resetToProfileValues = () => {
    setInputs(baselineInputs);
  };

  const inputClassName =
    'w-full pl-8 pr-3 py-2 border border-brand-gray-border rounded-lg focus:border-brand-navy outline-none';

  const differenceImproved = monthsDifference > 0;
  const differenceWorse = monthsDifference < 0;
  const differenceUnchanged = monthsDifference === 0;

  return (
    <div className="bg-brand-gray-light min-h-screen">
      <div className="bg-brand-navy py-3 px-5">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-white text-lg font-medium leading-tight">What-If Simulator</h1>
          <p className="text-white/65 text-xs mt-0.5">Explore scenarios before you commit</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-5">
        <div className="bg-amber-50 border border-amber-200 border-l-4 border-brand-orange rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-brand-navy">Sandbox mode — no data is saved</p>
            <p className="text-xs text-brand-gray mt-1">
              This simulator is a safe what-if space. Changes here do not affect your real NOVO profile,
              strategy, or debts. This version uses a local, explicit month-by-month avalanche loop.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-brand-gray-border rounded-lg border-t-[3px] border-t-brand-orange shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-medium text-brand-navy">Input Scenario</h2>
              <button
                type="button"
                onClick={resetToProfileValues}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:opacity-80 transition-opacity"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to Profile
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-brand-gray mb-1.5">Monthly Income</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-brand-gray">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inputs.monthlyNetIncome || ''}
                    onChange={(e) => setNumberInput('monthlyNetIncome', e.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-gray mb-1.5">Essential Expenses</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-brand-gray">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inputs.monthlyEssentialExpenses || ''}
                    onChange={(e) => setNumberInput('monthlyEssentialExpenses', e.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-gray mb-1.5">Discretionary Expenses</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-brand-gray">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inputs.monthlyDiscretionaryExpenses || ''}
                    onChange={(e) => setNumberInput('monthlyDiscretionaryExpenses', e.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-gray mb-1.5">Monthly Savings Goal</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-brand-gray">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inputs.monthlySavingsGoal || ''}
                    onChange={(e) => setNumberInput('monthlySavingsGoal', e.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-brand-gray">Surplus Commitment</label>
                  <span className="text-xs font-medium text-brand-navy">{inputs.surplusCommitmentPercent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={inputs.surplusCommitmentPercent}
                  onChange={(e) =>
                    setInputs((prev) => ({
                      ...prev,
                      surplusCommitmentPercent: clampPercentToStep(parseInt(e.target.value, 10)),
                    }))
                  }
                  className="slider-surplus"
                  aria-label="Surplus commitment percent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-gray mb-1.5">One-Time Windfall / Bonus</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-brand-gray">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inputs.oneTimeWindfall || ''}
                    onChange={(e) => setNumberInput('oneTimeWindfall', e.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-gray mb-1.5">Extra Monthly Contribution</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-brand-gray">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inputs.extraMonthlyContribution || ''}
                    onChange={(e) => setNumberInput('extraMonthlyContribution', e.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
          <div className="bg-white border border-brand-gray-border rounded-lg border-t-[3px] border-t-brand-green shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-[15px] font-medium text-brand-navy">Results</h2>
              <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-gray-light text-brand-gray border border-brand-gray-border">
                Instant
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center py-3 border-b border-brand-gray-border">
                <span className="text-[13px] text-brand-gray">Total surplus available</span>
                <span className="text-[13px] font-medium text-brand-navy">
                  {formatCurrency(scenarioResult.surplusAfterSavings)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-brand-gray-border">
                <span className="text-[13px] text-brand-gray">Amount going to savings</span>
                <span className="text-[13px] font-medium text-brand-green">{formatCurrency(inputs.monthlySavingsGoal)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-brand-gray-border">
                <span className="text-[13px] text-brand-gray">Amount going to debt</span>
                <span className="text-[13px] font-medium text-brand-navy">
                  {formatCurrency(scenarioResult.amountGoingToDebt)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-brand-gray-border">
                <span className="text-[13px] text-brand-gray">Projected debt-free date</span>
                <span className="text-[13px] font-semibold text-brand-navy">
                  {scenarioTotalMonths > 0
                    ? formatMonthYearFromMonths(scenarioTotalMonths)
                    : 'No active debt'}
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-[13px] text-brand-gray">Estimated interest saved</span>
                <span className={`text-[13px] font-medium ${estimatedInterestSaved >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                  {estimatedInterestSaved >= 0 ? '+' : '-'}{' '}
                  {formatCurrency(Math.abs(estimatedInterestSaved))}
                </span>
              </div>
            </div>

            <div
              className={`mt-5 rounded-lg p-4 ${
                differenceImproved
                  ? 'bg-green-50 border border-green-200'
                  : differenceWorse
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-brand-gray-light border border-brand-gray-border'
              }`}
            >
              <p className="text-[13px] font-medium text-brand-gray mb-1">Difference vs current plan</p>
              {differenceUnchanged ? (
                <p className="text-[13px] text-brand-gray italic">Your timeline is unchanged from your current plan</p>
              ) : (
                <p
                  className={`text-[13px] font-medium flex items-start gap-2 ${
                    differenceImproved ? 'text-brand-green' : 'text-brand-red'
                  }`}
                >
                  {differenceImproved ? (
                    <TrendingDown className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>
                    {differenceImproved &&
                      `You'd be debt free ${monthsDifference} month${monthsDifference === 1 ? '' : 's'} sooner`}
                    {differenceWorse &&
                      `You'd be debt free ${Math.abs(monthsDifference)} month${Math.abs(monthsDifference) === 1 ? '' : 's'} later`}
                  </span>
                </p>
              )}
            </div>

            {inputs.oneTimeWindfall > 0 && (
              <p className="mt-3 text-xs text-brand-gray">
                Windfall is modeled as an immediate principal reduction on highest-rate debts first (same avalanche
                priority as the payoff engine).
              </p>
            )}
          </div>
          <p className="text-[11px] text-brand-gray italic px-1">
            Note: Simulator projections use a simplified calculation and may differ slightly from your My Plan
            results. Use this tool to explore directional scenarios, not exact dates.
          </p>
          </div>
        </div>
      </div>
    </div>
  );
}
