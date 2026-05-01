import { useMemo, useState } from 'react';
import { AlertTriangle, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';

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

export default function WhatIfSimulator() {
  const profileAtLoad = useMemo(() => StorageService.getFinancialProfile(), []);
  const debtSnapshotAtLoad = useMemo(
    () => StorageService.getDebts().filter((d) => !d.isPaidOff).map((d) => ({ ...d })),
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

  const baselineResult = useMemo(
    () => CalculationService.simulateDashboardStylePayoff(debtSnapshotAtLoad, baselineInputs),
    [debtSnapshotAtLoad, baselineInputs]
  );

  const scenarioResult = useMemo(
    () => CalculationService.simulateDashboardStylePayoff(debtSnapshotAtLoad, inputs),
    [debtSnapshotAtLoad, inputs]
  );

  const monthsDifference =
    baselineResult.projection.totalMonths - scenarioResult.projection.totalMonths;
  const estimatedInterestSaved =
    baselineResult.projection.totalInterest - scenarioResult.projection.totalInterest;

  const setNumberInput = (field: keyof SimulatorInputs, value: string) => {
    const parsed = parseFloat(value);
    const nextValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setInputs((prev) => ({ ...prev, [field]: nextValue }));
  };

  const resetToProfileValues = () => {
    setInputs(baselineInputs);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-amber-50 border-2 border-amber-400 text-amber-900 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Sandbox Mode - No data is saved</p>
          <p className="text-sm">
            This simulator is a safe what-if space. Changes here do not affect your real NOVO profile,
            strategy, or debts. Payoff math uses the same calculation service as the Dashboard.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Input Scenario</h2>
            <button
              onClick={resetToProfileValues}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#2D9CDB] hover:text-[#1E8BBD] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Profile
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Monthly Income</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputs.monthlyNetIncome || ''}
                  onChange={(e) => setNumberInput('monthlyNetIncome', e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Essential Expenses</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputs.monthlyEssentialExpenses || ''}
                  onChange={(e) => setNumberInput('monthlyEssentialExpenses', e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Discretionary Expenses</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputs.monthlyDiscretionaryExpenses || ''}
                  onChange={(e) => setNumberInput('monthlyDiscretionaryExpenses', e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Monthly Savings Goal</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputs.monthlySavingsGoal || ''}
                  onChange={(e) => setNumberInput('monthlySavingsGoal', e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#1E3A5F]" />
                  <label className="text-sm font-semibold text-gray-700">Surplus Commitment</label>
                </div>
                <span className="text-sm font-bold text-[#1E3A5F]">{inputs.surplusCommitmentPercent}%</span>
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
                className="w-full accent-[#27AE60]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">One-Time Windfall / Bonus</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputs.oneTimeWindfall || ''}
                  onChange={(e) => setNumberInput('oneTimeWindfall', e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Extra Monthly Contribution</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputs.extraMonthlyContribution || ''}
                  onChange={(e) => setNumberInput('extraMonthlyContribution', e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Results (Instant)</h2>
          <div className="space-y-3">
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-600">Total surplus available</span>
              <span className="font-bold text-gray-900">
                {CalculationService.formatCurrency(scenarioResult.cashFlow.surplusAfterSavings)}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-600">Amount going to savings</span>
              <span className="font-bold text-[#27AE60]">
                {CalculationService.formatCurrency(scenarioResult.cashFlow.savingsCarveOut)}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-600">Amount going to debt</span>
              <span className="font-bold text-[#1E3A5F]">
                {CalculationService.formatCurrency(scenarioResult.extraPayment)}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-600">Projected debt-free date</span>
              <span className="font-bold text-[#1E3A5F]">
                {scenarioResult.projection.totalMonths > 0
                  ? CalculationService.formatMonthYear(scenarioResult.projection.debtFreeDate)
                  : 'No active debt'}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-600">Estimated interest saved</span>
              <span className={`font-bold ${estimatedInterestSaved >= 0 ? 'text-[#27AE60]' : 'text-red-600'}`}>
                {estimatedInterestSaved >= 0 ? '+' : '-'}{' '}
                {CalculationService.formatCurrency(Math.abs(estimatedInterestSaved))}
              </span>
            </div>
          </div>

          <div className="mt-6 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-1">Difference vs current plan</p>
            <p className="text-lg font-bold text-[#1E3A5F]">
              {monthsDifference > 0 &&
                `You'd be debt free ${monthsDifference} month${monthsDifference === 1 ? '' : 's'} sooner`}
              {monthsDifference < 0 &&
                `You'd be debt free ${Math.abs(monthsDifference)} month${Math.abs(monthsDifference) === 1 ? '' : 's'} later`}
              {monthsDifference === 0 && 'Your timeline is unchanged from your current plan'}
            </p>
          </div>

          {inputs.oneTimeWindfall > 0 && (
            <p className="mt-3 text-xs text-gray-500">
              Windfall is modeled as an immediate principal reduction on highest-rate debts first (same avalanche
              priority as the payoff engine).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
