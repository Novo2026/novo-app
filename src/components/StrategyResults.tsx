import { useState } from 'react';
import {
  RefreshCw,
  TrendingDown,
  DollarSign,
  CheckCircle,
  Info,
  Plus,
  Zap,
  CheckCircle2,
  HelpCircle,
  Calendar,
  LineChart,
  FileText,
} from 'lucide-react';
import MyPlan from './MyPlan';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import Accordion from './Accordion';
import ChunkingRecommendation from './ChunkingRecommendation';
import ChunkingScenarioComparison from './ChunkingScenarioComparison';
import ChunkingPlanCalculator from './ChunkingPlanCalculator';
import AdvancedVelocityBanking from './AdvancedVelocityBanking';
import ChunkingRiskAssessment from './ChunkingRiskAssessment';
import SmartChunkingCalculator from './SmartChunkingCalculator';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Debt, StrategyResult } from '../types';

function getDebtAccentBorder(debt: Debt): string {
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

function getDebtTypePillClasses(debt: Debt): string {
  switch (debt.category) {
    case 'Mortgage':
      return 'inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-brand-blue border border-brand-blue';
    case 'Auto Loan':
      return 'inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-brand-orange-dark border border-brand-orange';
    case 'Credit Card':
      return 'inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-brand-red border border-brand-red';
    case 'Personal Loan':
      return 'inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-brand-green border border-brand-green';
    default:
      return 'inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-50 text-brand-gray border border-brand-gray';
  }
}

interface StrategyResultsProps {
  result: StrategyResult;
  onRunNew: () => void;
  showAutoUpdateBanner?: boolean;
  isAutoCalculating?: boolean;
  onNavigateToSmarterPayments?: () => void;
}

export default function StrategyResults({
  result,
  onRunNew,
  showAutoUpdateBanner,
  isAutoCalculating,
  onNavigateToSmarterPayments,
}: StrategyResultsProps) {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [currentResult, setCurrentResult] = useState(result);

  const handleRecalculate = () => {
    setIsRecalculating(true);

    setTimeout(() => {
      const newResult = CalculationService.calculateCurrentStrategy();

      if (newResult) {
        // Validate: check if timeline changed dramatically
        const oldMonths = currentResult.totalMonths;
        const newMonths = newResult.totalMonths;
        const monthsChange = Math.abs(newMonths - oldMonths);
        const percentChange = (monthsChange / oldMonths) * 100;

        if (percentChange > 50) {
          console.warn('⚠️ WARNING: Timeline changed significantly:', {
            oldMonths,
            newMonths,
            change: monthsChange,
            percentChange: percentChange.toFixed(1) + '%'
          });
        }

        setCurrentResult(newResult);
        StorageService.saveStrategyResult(newResult);
        StorageService.markStrategyCalculated();
        console.log('✅ Strategy recalculated successfully');
      }

      setIsRecalculating(false);
    }, 300);
  };

  const allStoredDebts = StorageService.getDebts();
  const debts = allStoredDebts.filter(d => !d.isPaidOff);
  const paidOffDebts = allStoredDebts.filter(d => d.isPaidOff);
  const hasMortgages = allStoredDebts.some(d => d.category === 'Mortgage' && !d.isPaidOff);
  const mortgageCount = allStoredDebts.filter(d => d.category === 'Mortgage' && !d.isPaidOff).length;
  const financialProfile = StorageService.getFinancialProfile();
  const featurePreferences = StorageService.getFeaturePreferences();

  // Get HELOC balance to display if exists
  const helocTransactions = JSON.parse(localStorage.getItem('novo_heloc_transactions') || '[]');
  const homeEquity = JSON.parse(localStorage.getItem('novo_home_equity') || '{}');
  const helocBalance = helocTransactions.length > 0
    ? helocTransactions[helocTransactions.length - 1].balance
    : (homeEquity.hasHELOC && homeEquity.helocBalance !== undefined ? homeEquity.helocBalance : 0);
  const helocRate = homeEquity.hasHELOC && homeEquity.helocRate ? homeEquity.helocRate : 0;

  // Create virtual HELOC debt for display purposes
  const helocDebt = helocBalance > 0 && helocRate > 0 ? {
    id: 'HELOC_VIRTUAL',
    accountName: 'HELOC',
    category: 'HELOC' as const,
    startingBalance: helocBalance,
    currentBalance: helocBalance,
    interestRate: helocRate,
    minimumPayment: 0,
    isPaidOff: false,
    createdAt: new Date().toISOString(),
  } : null;

  // Include HELOC in debt list for display
  const allDebts = helocDebt ? [...debts, helocDebt] : debts;

  const minimumOnly = CalculationService.projectMinimumPaymentsOnly(debts);

  // Validate strategy comparison
  const interestSaved = minimumOnly.totalInterest - currentResult.totalInterest;
  const monthsSaved = minimumOnly.totalMonths - currentResult.totalMonths;
  const isValidComparison = interestSaved >= 0 && monthsSaved >= 0;

  console.log('💰 STRATEGY COMPARISON:');
  console.log('  Baseline (minimums only):');
  console.log('    - Months:', minimumOnly.totalMonths);
  console.log('    - Interest:', minimumOnly.totalInterest);
  console.log('  Optimized (with extra payments):');
  console.log('    - Months:', currentResult.totalMonths);
  console.log('    - Interest:', currentResult.totalInterest);
  console.log('    - Extra payment:', currentResult.strategy.extraMonthlyPayment);
  console.log('  SAVINGS:');
  console.log('    - Interest saved:', interestSaved);
  console.log('    - Months saved:', monthsSaved);
  console.log('    - Valid comparison?', isValidComparison);

  const chartData = currentResult.monthlyProjections
    .filter((_, i) => i % 3 === 0 || i === currentResult.monthlyProjections.length - 1)
    .map((proj, index) => {
      const dataPoint: Record<string, string | number> = {
        month: `Mo ${proj.month}`,
        total: proj.totalBalance,
      };

      proj.debts.forEach(d => {
        const debt = allDebts.find(debt => debt.id === d.debtId);
        if (debt) {
          dataPoint[debt.accountName] = d.balance;
        }
      });

      return dataPoint;
    });

  const colors = [
    'var(--brand-blue)',
    'var(--brand-green)',
    'var(--brand-orange)',
    'var(--brand-red)',
    'var(--brand-navy)',
    'var(--brand-orange-dark)',
  ];

  const hasRateArbitrageWarnings = currentResult.strategy.type === 'heloc-velocity' &&
    allDebts.some(d => d.interestRate < helocRate && d.id !== 'HELOC_VIRTUAL');

  // Calculate cash flow after debt minimums, savings carve-out, and commitment %
  const totalMinimumPayments = allDebts
    .filter(d => d.currentBalance > 0)
    .reduce((sum, d) => sum + d.minimumPayment, 0);
  const cashFlowMetricsForResults = financialProfile
    ? CalculationService.calculateCashFlow(
        financialProfile.monthlyNetIncome,
        financialProfile.monthlyEssentialExpenses,
        financialProfile.monthlyDiscretionaryExpenses,
        totalMinimumPayments,
        financialProfile.monthlySavingsGoal ?? 0,
        financialProfile.surplusCommitmentPercent ?? 100
      )
    : null;
  const cashFlowAfterMinimums = cashFlowMetricsForResults
    ? cashFlowMetricsForResults.recommendedExtraPayment
    : currentResult.strategy.extraMonthlyPayment || 0;

  const hasLowCashFlow = cashFlowAfterMinimums < 200;

  // Find highest-interest debt for HELOC tactical recommendation
  const sortedDebtsByRate = [...allDebts]
    .filter(d => d.id !== 'HELOC_VIRTUAL')
    .sort((a, b) => b.interestRate - a.interestRate);
  const highestRateDebt = sortedDebtsByRate[0];
  const hasHELOCAccount = allDebts.some(d => d.category === 'HELOC' || d.id === 'HELOC_VIRTUAL');

  // Calculate HELOC tactical strategy impact
  const calculateHelocTacticalImpact = () => {
    if (!highestRateDebt || !helocRate) return null;

    const interestSavings = highestRateDebt.interestRate - helocRate;
    const freedCashFlow = highestRateDebt.minimumPayment;
    const targetSpendingCuts = 500;
    const totalMonthlyToHELOC = freedCashFlow + targetSpendingCuts;
    const monthsToPayoffHELOC = Math.ceil(highestRateDebt.currentBalance / totalMonthlyToHELOC);

    return {
      interestSavings,
      freedCashFlow,
      targetSpendingCuts,
      totalMonthlyToHELOC,
      monthsToPayoffHELOC,
    };
  };

  const helocTacticalImpact = calculateHelocTacticalImpact();

  return (
    <div className="bg-brand-gray-light min-h-screen">
      <div className="bg-brand-navy py-3 px-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-white text-lg font-medium leading-tight">My Plan</h1>
            <p className="text-white/65 text-xs mt-0.5">Your fastest path to debt freedom</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleRecalculate}
              disabled={isRecalculating}
              className="inline-flex items-center gap-2 border border-white text-white text-xs px-3 py-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>{isRecalculating ? 'Refreshing...' : 'Refresh Strategy'}</span>
            </button>
            <button
              type="button"
              onClick={onRunNew}
              className="inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Strategy</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-3">
      {showAutoUpdateBanner && (
        <div className="bg-green-50 border border-green-200 border-l-4 border-l-brand-green rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-brand-green shrink-0" />
          <p className="text-sm font-medium text-brand-navy">Strategy updated based on recent activity</p>
        </div>
      )}

      {isAutoCalculating && (
        <div className="bg-brand-blue-light border border-brand-blue rounded-lg p-4 flex items-center gap-3 text-brand-blue">
          <RefreshCw className="w-5 h-5 shrink-0 animate-spin" />
          <p className="text-sm font-medium">Recalculating strategy with updated data...</p>
        </div>
      )}

{hasLowCashFlow ? (
        <MyPlan
          cashFlowAfterMinimums={cashFlowAfterMinimums}
          highestRateDebt={highestRateDebt}
          helocRate={helocRate}
          helocTacticalImpact={helocTacticalImpact}
          hasHELOCAccount={hasHELOCAccount}
          onNavigateToSmarterPayments={onNavigateToSmarterPayments}
        />
      ) : (
        <>
          <div id="strategy-comparison" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-brand-navy text-white rounded-lg border-t-4 border-t-brand-orange p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[11px] uppercase text-white/70 tracking-wide">Your Strategy</span>
                <span className="bg-brand-orange text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">Optimized</span>
              </div>
              <p className="text-[26px] font-medium leading-tight">
                {Math.floor(currentResult.totalMonths / 12)} years, {currentResult.totalMonths % 12} months
              </p>
              <p className="text-xs text-white/70 mt-1">
                Debt-Free: {CalculationService.formatMonthYear(currentResult.debtFreeDate)}
              </p>
              <div className="border-t border-white/15 my-4" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-white/60">Total Interest</p>
                  <p className="text-base font-medium mt-0.5">{CalculationService.formatCurrency(currentResult.totalInterest)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-white/60">Total Paid</p>
                  <p className="text-base font-medium mt-0.5">{CalculationService.formatCurrency(result.totalPaid)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-brand-gray-border rounded-lg border-t-4 border-t-brand-gray p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[11px] uppercase text-brand-gray tracking-wide">Minimum Payments Only</span>
                <span className="bg-brand-gray-light text-brand-gray text-[10px] font-medium px-2 py-0.5 rounded-full border border-brand-gray-border">Baseline</span>
              </div>
              <p className="text-[26px] font-medium text-brand-navy leading-tight">
                {Math.floor(minimumOnly.totalMonths / 12)} years, {minimumOnly.totalMonths % 12} months
              </p>
              <p className="text-xs text-brand-gray mt-1">
                Debt-Free: {CalculationService.formatMonthYear(minimumOnly.debtFreeDate)}
              </p>
              <div className="border-t border-brand-gray-border my-4" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-brand-gray">Total Interest</p>
                  <p className="text-base font-medium text-brand-navy mt-0.5">
                    {CalculationService.formatCurrency(minimumOnly.totalInterest)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-brand-gray">Total Paid</p>
                  <p className="text-base font-medium text-brand-navy mt-0.5">
                    {CalculationService.formatCurrency(minimumOnly.totalPaid)}
                  </p>
                </div>
              </div>
              {hasMortgages && (
                <p className="text-[11px] text-brand-gray italic mt-4">
                  Excludes mortgages — shown on fixed payment schedule
                </p>
              )}
            </div>
          </div>

          {hasMortgages && (
            <div className="bg-brand-blue-light border-l-4 border-brand-blue rounded-r-lg p-3 text-[11px] text-brand-blue flex items-start gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p>
                <strong>Note:</strong> Mortgage{mortgageCount > 1 ? 's' : ''} are on fixed payment schedules and not included in the accelerated payoff strategy. Your debt-free date above reflects your non-mortgage debts.
              </p>
            </div>
          )}

          {isValidComparison ? (
            <div className="bg-green-50 border border-green-200 border-l-4 border-l-brand-green rounded-lg p-4 flex items-start gap-3">
              <TrendingDown className="w-5 h-5 text-brand-green shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-medium text-brand-navy">
                  You&apos;ll save {CalculationService.formatCurrency(interestSaved)} in interest
                </p>
                <p className="text-[13px] text-brand-green mt-0.5">
                  And be debt-free{' '}
                  {Math.floor(monthsSaved / 12)} years, {monthsSaved % 12} months sooner
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 border-l-4 border-brand-orange rounded-lg p-4 flex items-start gap-3">
              <TrendingDown className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-medium text-brand-navy">Strategy Comparison Unavailable</p>
                <p className="text-[13px] text-brand-gray mt-1">
                  Unable to calculate accurate baseline comparison. Please verify all debt information is correct,
                  especially minimum payments and interest rates. If you have a mortgage, ensure the P&I payment
                  matches your actual monthly payment.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <div className="bg-white border border-brand-gray-border rounded-lg p-5">
        <h3 className="text-sm font-medium text-brand-navy mb-5">How to Execute Your Strategy</h3>

        <div className="space-y-5">
          <div className="bg-brand-gray-light border border-brand-gray-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-brand-orange shrink-0" />
              <h4 className="text-xs text-brand-gray">Your Total Monthly Cash Flow</h4>
            </div>
            {financialProfile ? (
              <>
                <p className="text-2xl font-medium text-brand-navy mb-3">
                  {CalculationService.formatCurrency(
                    financialProfile.monthlyNetIncome -
                    financialProfile.monthlyEssentialExpenses -
                    financialProfile.monthlyDiscretionaryExpenses
                  )}
                </p>
                <div className="space-y-0 text-sm border-t border-brand-gray-border">
                  <div className="flex justify-between py-2 border-b border-brand-gray-border">
                    <span className="text-brand-gray">Minimum payments</span>
                    <span className="font-medium text-brand-navy">
                      {CalculationService.formatCurrency(
                        allDebts.reduce((sum, d) => sum + d.minimumPayment, 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-brand-gray">Extra for debt payoff</span>
                    <span className="font-medium text-brand-navy">
                      {CalculationService.formatCurrency(
                        financialProfile.monthlyNetIncome -
                        financialProfile.monthlyEssentialExpenses -
                        financialProfile.monthlyDiscretionaryExpenses -
                        allDebts.reduce((sum, d) => sum + d.minimumPayment, 0)
                      )}
                    </span>
                  </div>
                  {paidOffDebts.length > 0 && (
                    <div className="pt-2 mt-1 border-t border-brand-gray-border">
                      <p className="text-xs text-brand-green flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          <span className="font-medium">
                            {CalculationService.formatCurrency(paidOffDebts.reduce((sum, d) => sum + d.minimumPayment, 0))}
                          </span>{' '}
                          freed from paid-off debts is included in your extra payment!
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-brand-gray text-sm">Set up your financial profile to see cash flow details.</p>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-brand-navy mb-3">Payment Breakdown This Month</h4>
            {paidOffDebts.length > 0 && (
              <div className="mb-3 bg-amber-50 border border-amber-200 border-l-4 border-brand-orange rounded-lg p-3 flex items-start gap-2">
                <Zap className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                <p className="text-[13px] text-brand-navy">
                  <span className="font-medium">Snowball active:</span>{' '}
                  {CalculationService.formatCurrency(paidOffDebts.reduce((s, d) => s + d.minimumPayment, 0))}/month freed from{' '}
                  {paidOffDebts.length} paid-off debt{paidOffDebts.length !== 1 ? 's' : ''} is rolled into your target debt payment automatically.
                </p>
              </div>
            )}
            <div className="space-y-3">
              {(() => {
                const sortedDebts = [...allDebts].sort((a, b) => b.interestRate - a.interestRate);
                const targetDebt = sortedDebts[0];
                const otherDebts = sortedDebts.slice(1);
                const extraPayment = currentResult.strategy.extraMonthlyPayment || 0;
                const freedMinimums = paidOffDebts.reduce((s, d) => s + d.minimumPayment, 0);
                const baseCashFlow = extraPayment - freedMinimums;
                const isHELOC = targetDebt?.id === 'HELOC_VIRTUAL';
                const targetPayment = targetDebt
                  ? targetDebt.minimumPayment + extraPayment
                  : 0;

                return (
                  <>
                    {targetDebt && (
                      <div className="bg-blue-50 border border-brand-blue rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-medium text-brand-navy">{targetDebt.accountName}</span>
                              <span className={getDebtTypePillClasses(targetDebt)}>{targetDebt.category}</span>
                            </div>
                          </div>
                          <span className="bg-brand-orange text-white text-[10px] font-medium px-2 py-1 rounded-md shrink-0">
                            FOCUS HERE
                          </span>
                        </div>
                        <p className="text-[13px] text-brand-navy">
                          {isHELOC ? (
                            <>
                              <span className="text-brand-gray">{CalculationService.formatCurrency(0)} min</span>
                              {' + '}
                              <span className="text-brand-blue">{CalculationService.formatCurrency(extraPayment)} extra</span>
                              {' = '}
                              <span className="font-semibold text-brand-navy">{CalculationService.formatCurrency(targetPayment)}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-brand-gray">{CalculationService.formatCurrency(targetDebt.minimumPayment)} min</span>
                              {freedMinimums > 0 && (
                                <>
                                  {' + '}
                                  <span className="text-brand-green">{CalculationService.formatCurrency(freedMinimums)} freed</span>
                                </>
                              )}
                              {baseCashFlow > 0 && (
                                <>
                                  {' + '}
                                  <span className="text-brand-blue">{CalculationService.formatCurrency(baseCashFlow)} extra</span>
                                </>
                              )}
                              {' = '}
                              <span className="font-semibold text-brand-navy">{CalculationService.formatCurrency(targetPayment)}</span>
                            </>
                          )}
                        </p>
                      </div>
                    )}
                    {otherDebts.length > 0 && (
                      <div className="bg-white border border-brand-gray-border rounded-lg overflow-hidden">
                        {otherDebts.map((debt, index) => (
                          <div
                            key={debt.id}
                            className={`flex items-center justify-between gap-3 px-4 py-3 border-b border-brand-gray-border last:border-b-0 border-l-4 ${getDebtAccentBorder(debt)} ${
                              index % 2 === 0 ? 'bg-white' : 'bg-brand-gray-light'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <span className="text-[13px] text-brand-navy">{debt.accountName}</span>
                              <span className={getDebtTypePillClasses(debt)}>{debt.category}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[13px] font-medium text-brand-navy">
                                {CalculationService.formatCurrency(debt.minimumPayment)}
                              </span>
                              <span className="text-[11px] text-brand-gray ml-1.5">(minimum only)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            {helocDebt && allDebts[0].id === 'HELOC_VIRTUAL' && (
              <div className="mt-3 bg-brand-blue-light border-l-4 border-brand-blue rounded-r-lg p-3 text-[11px] text-brand-blue">
                <p>
                  <span className="font-medium">Pay down your HELOC balance first</span> — it has the highest interest rate at {helocRate.toFixed(2)}%.
                  Once HELOC reaches $0, extra payments will automatically move to your next highest-rate debt.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white border border-brand-gray-border rounded-lg p-5">
            <h4 className="text-sm font-medium text-brand-navy">Payment Priority (Automatic)</h4>
            <p className="text-xs text-brand-gray mt-1 mb-4">
              Extra {CalculationService.formatCurrency(currentResult.strategy.extraMonthlyPayment || 0)} always targets highest-interest debt first
            </p>
            <div>
              {currentResult.payoffTimeline.map((item, index) => {
                const debt = allDebts.find(d => d.id === item.debtId);
                const startMonth = index === 0 ? 1 : currentResult.payoffTimeline[index - 1].payoffMonth + 1;
                const isHELOC = item.debtId === 'HELOC_VIRTUAL';

                return (
                  <div
                    key={item.debtId}
                    className="flex items-center gap-3 py-3 border-b border-brand-gray-border last:border-b-0"
                  >
                    <div className="flex-shrink-0 w-6 h-6 bg-brand-navy text-white rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-brand-gray">
                        Months {startMonth}-{item.payoffMonth}:
                      </p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-[13px] font-medium text-brand-navy">{item.debtName}</span>
                        {debt && (
                          <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-gray-light text-brand-gray border border-brand-gray-border">
                            {debt.interestRate.toFixed(2)}% APR
                          </span>
                        )}
                        {isHELOC && index === 0 && (
                          <span className="text-xs text-brand-blue">
                            Pay HELOC balance of {CalculationService.formatCurrency(helocBalance)} first
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-brand-cream border-l-4 border-brand-orange rounded-lg p-4">
            <h4 className="text-sm font-medium text-brand-navy mb-3">How It Works</h4>
            <ol className="space-y-2">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-brand-navy text-white rounded-full flex items-center justify-center text-xs font-medium">
                  1
                </span>
                <span className="text-[13px] text-brand-navy">Each month, pay the minimum on ALL debts</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-brand-navy text-white rounded-full flex items-center justify-center text-xs font-medium">
                  2
                </span>
                <span className="text-[13px] text-brand-navy">
                  Add the extra {CalculationService.formatCurrency(currentResult.strategy.extraMonthlyPayment || 0)} to the debt with highest interest
                  {helocDebt && allDebts[0].id === 'HELOC_VIRTUAL' && (
                    <span className="block mt-1 text-brand-blue font-medium">
                      Start with HELOC — eliminate your {CalculationService.formatCurrency(helocBalance)} balance first
                    </span>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-brand-navy text-white rounded-full flex items-center justify-center text-xs font-medium">
                  3
                </span>
                <span className="text-[13px] text-brand-navy">When a debt is paid off, move that entire payment to the next highest-interest debt</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-brand-navy text-white rounded-full flex items-center justify-center text-xs font-medium">
                  4
                </span>
                <span className="text-[13px] text-brand-navy">Repeat until debt-free</span>
              </li>
            </ol>
            <p className="mt-4 text-[13px] font-medium text-brand-navy">
              This strategy automatically targets high-interest debt first to save you the most money.
            </p>
          </div>
        </div>
      </div>

      {currentResult.strategy.type === 'heloc-velocity' && financialProfile && homeEquity && !featurePreferences.helocEnabled && (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-6 shadow-lg">
          <div className="flex items-start space-x-4">
            <div className="text-4xl">💡</div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Want to accelerate your debt payoff even faster?
              </h3>
              <p className="text-gray-700 mb-4 leading-relaxed">
                If you're a homeowner with equity, a HELOC can help you eliminate high-interest debt faster by trading expensive rates for lower HELOC rates. Enable HELOC features to access advanced velocity banking tools and tracking.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    const guideSection = document.querySelector('[data-section="heloc-guide"]');
                    if (guideSection) {
                      guideSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="inline-flex items-center px-4 py-2 bg-white hover:bg-gray-50 text-blue-600 font-semibold rounded-lg border-2 border-blue-200 transition-colors"
                >
                  Learn About HELOC Strategy
                </a>
                <button
                  onClick={() => {
                    window.location.hash = 'settings';
                    window.location.reload();
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                >
                  Enable HELOC Features
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentResult.strategy.type === 'heloc-velocity' && financialProfile && homeEquity && featurePreferences.helocEnabled && (
        <div className="space-y-4">
          <Accordion
            emoji="📊"
            title="HELOC Velocity Banking Overview"
            defaultOpen={false}
          >
            <div className="pt-4">
              <ChunkingRecommendation
                monthlyCashFlow={
                  financialProfile.monthlyNetIncome -
                  financialProfile.monthlyEssentialExpenses -
                  financialProfile.monthlyDiscretionaryExpenses -
                  allDebts.reduce((sum, d) => sum + d.minimumPayment, 0)
                }
                currentHELOCBalance={helocBalance}
                helocLimit={homeEquity.helocLimit || 0}
                helocRate={helocRate}
              />
            </div>
          </Accordion>

          <Accordion
            emoji="⚠️"
            title="HELOC Strategy Guidance & Warnings"
            defaultOpen={hasRateArbitrageWarnings}
            badge={hasRateArbitrageWarnings ? "IMPORTANT" : undefined}
          >
            <div className="pt-4">
              {hasRateArbitrageWarnings && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r mb-4">
                  <h4 className="font-bold text-amber-900 mb-2">Rate Arbitrage Warning</h4>
                  <p className="text-amber-800 mb-3">
                    Some of your debts have interest rates lower than your HELOC rate of {helocRate.toFixed(2)}%.
                    Using HELOC to pay these debts would cost you more in interest.
                  </p>
                  <div className="space-y-2">
                    {allDebts
                      .filter(d => d.interestRate < helocRate && d.id !== 'HELOC_VIRTUAL')
                      .map(debt => (
                        <div key={debt.id} className="bg-white rounded p-3">
                          <p className="font-semibold text-gray-800">{debt.accountName}</p>
                          <p className="text-sm text-gray-600">
                            Rate: {debt.interestRate.toFixed(2)}% (Lower than HELOC {helocRate.toFixed(2)}%)
                          </p>
                          <p className="text-sm font-semibold text-red-600">
                            ✗ Do NOT use HELOC for this debt
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r">
                <h4 className="font-bold text-green-900 mb-2">
                  {hasRateArbitrageWarnings ? 'Safe to Use HELOC For:' : 'HELOC Rate Arbitrage Guide'}
                </h4>
                {!hasRateArbitrageWarnings && (
                  <p className="text-green-800 mb-3">
                    All your debts have interest rates higher than or equal to your HELOC rate of {helocRate.toFixed(2)}%,
                    making them good candidates for HELOC velocity banking.
                  </p>
                )}
                <div className="space-y-2">
                  {allDebts
                    .filter(d => d.interestRate >= helocRate && d.id !== 'HELOC_VIRTUAL')
                    .map(debt => (
                      <div key={debt.id} className="bg-white rounded p-3">
                        <p className="font-semibold text-gray-800">{debt.accountName}</p>
                        <p className="text-sm text-gray-600">
                          Rate: {debt.interestRate.toFixed(2)}% (Higher than HELOC {helocRate.toFixed(2)}%)
                        </p>
                        <p className="text-sm font-semibold text-green-600">
                          ✓ Can use HELOC to save on interest
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </Accordion>

          {(() => {
            const mortgageDebt = allDebts.find(d => d.category === 'Mortgage');
            const cashFlow = financialProfile.monthlyNetIncome -
              financialProfile.monthlyEssentialExpenses -
              financialProfile.monthlyDiscretionaryExpenses -
              allDebts.reduce((sum, d) => sum + d.minimumPayment, 0);

            if (mortgageDebt && homeEquity.helocLimit) {
              return (
                <Accordion
                  emoji="🎯"
                  title="Smart Chunking Calculator (Advanced)"
                  defaultOpen={false}
                >
                  <div className="pt-4">
                    <SmartChunkingCalculator
                      monthlyNetIncome={financialProfile.monthlyNetIncome}
                      monthlyExpenses={
                        financialProfile.monthlyEssentialExpenses +
                        financialProfile.monthlyDiscretionaryExpenses
                      }
                      helocBalance={helocBalance}
                      helocLimit={homeEquity.helocLimit}
                      helocRate={helocRate}
                      mortgageBalance={mortgageDebt.currentBalance}
                      mortgageRate={mortgageDebt.interestRate}
                    />
                  </div>
                </Accordion>
              );
            }
            return null;
          })()}
        </div>
      )}

      <div className="space-y-3">
      <Accordion
        icon={<HelpCircle className="w-5 h-5 text-brand-orange" />}
        title="Understanding Your Strategy & FAQ"
        defaultOpen={false}
      >
        <div className="pt-4 space-y-6">
          <div>
            <h4 className="font-bold text-gray-800 mb-3 text-xl">Understanding Your Strategy</h4>
            <div className="space-y-4">
              <div>
                <h5 className="font-bold text-gray-800 mb-2">Debt Avalanche Method</h5>
                <p className="text-gray-700 mb-3">
                  Your strategy uses the "debt avalanche" approach, which targets the highest-interest debt first.
                  This is mathematically proven to save you the most money and get you debt-free faster.
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h5 className="font-bold text-gray-800 mb-2">Why Highest Interest First?</h5>
                <p className="text-gray-700 mb-3">
                  High-interest debt costs you the most money over time. By eliminating it first, you:
                </p>
                <ul className="space-y-1 text-gray-700">
                  <li>• Stop bleeding money on expensive interest charges</li>
                  <li>• Free up more cash flow as each debt is paid off</li>
                  <li>• Build momentum as payments "snowball" to the next debt</li>
                  <li>• Reach debt-free status in the shortest time possible</li>
                </ul>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <h5 className="font-bold text-gray-800 mb-2">The Snowball Effect</h5>
                <p className="text-gray-700 mb-2">
                  As you pay off each debt, that entire payment amount rolls into the next debt:
                </p>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    <strong>Month 1:</strong> Extra payment goes to Debt #1
                  </p>
                  <p>
                    <strong>Debt #1 paid off:</strong> Extra payment + Debt #1 minimum → Debt #2
                  </p>
                  <p>
                    <strong>Debt #2 paid off:</strong> Extra + Debt #1 + Debt #2 → Debt #3
                  </p>
                  <p className="font-semibold text-green-700">
                    Your payment power grows with each debt eliminated!
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="font-bold text-gray-800 mb-2">Staying on Track</h5>
                <ul className="space-y-2 text-gray-700">
                  <li>• Set up automatic payments for your minimum amounts</li>
                  <li>• Log extra payments in NOVO as you make them</li>
                  <li>• Review your progress monthly</li>
                  <li>• Celebrate each debt payoff milestone</li>
                  <li>• Don't take on new debt during your payoff journey</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-bold text-gray-800 mb-4 text-xl">Frequently Asked Questions</h4>
          </div>

          <div>
            <h5 className="font-bold text-gray-800 mb-2">Why is NOVO recommending I pay this debt first?</h5>
            <p className="text-gray-700">
              NOVO prioritizes debts by interest rate. Your highest-rate debt ({allDebts[0]?.accountName} at {allDebts[0]?.interestRate.toFixed(2)}%)
              costs you the most money every month, so paying it off first saves you the maximum amount in interest charges.
            </p>
          </div>

          <div>
            <h5 className="font-bold text-gray-800 mb-2">Should I use my HELOC for this debt?</h5>
            <p className="text-gray-700 mb-2">
              Only use your HELOC to pay off debts with interest rates <strong>higher</strong> than your HELOC rate ({helocRate.toFixed(2)}%).
              This is called "rate arbitrage" - you're swapping expensive debt for cheaper debt.
            </p>
            <p className="text-gray-700">
              Never use HELOC for debts with lower rates, as you'll pay more interest overall.
            </p>
          </div>

          <div>
            <h5 className="font-bold text-gray-800 mb-2">What happens when I pay off a debt?</h5>
            <p className="text-gray-700 mb-2">
              Celebrate! Then immediately redirect that entire payment amount to your next highest-rate debt.
              This "snowball effect" accelerates your progress dramatically.
            </p>
            <p className="text-gray-700">
              In NOVO, mark the debt as paid off so your strategy automatically updates to show the new payment allocation.
            </p>
          </div>

          <div>
            <h5 className="font-bold text-gray-800 mb-2">How does the snowball effect work?</h5>
            <p className="text-gray-700 mb-2">
              Every time you eliminate a debt, you free up both the minimum payment and any extra payment you were making.
              All of that money immediately rolls into the next debt on your list.
            </p>
            <p className="text-gray-700">
              Example: If you're paying $500/month on Debt #1, when it's gone, you now pay $500 extra on Debt #2 on top of its minimum.
              Your payment power compounds with each victory!
            </p>
          </div>

          <div>
            <h5 className="font-bold text-gray-800 mb-2">Can I change my strategy?</h5>
            <p className="text-gray-700 mb-2">
              Yes! Your strategy automatically recalculates when you log payments, add/remove debts, or update your income/expenses. Click "Refresh Strategy" at the top to manually recalculate with current data, or run a new strategy wizard to:
            </p>
            <ul className="text-gray-700 space-y-1 ml-4">
              <li>• Switch between standard payoff and HELOC velocity banking</li>
              <li>• Adjust your extra payment amount manually</li>
              <li>• Run different scenarios with updated parameters</li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-gray-800 mb-2">What if I can't make the extra payment this month?</h5>
            <p className="text-gray-700">
              Life happens! At minimum, always pay the required minimums on all debts to avoid late fees and credit damage.
              If you can't make the extra payment one month, just get back on track next month. Progress, not perfection!
            </p>
          </div>
        </div>
      </Accordion>

      <Accordion
        icon={<Calendar className="w-5 h-5 text-brand-blue" />}
        title="Debt Payoff Timeline"
        defaultOpen={false}
      >
        <div className="pt-4 space-y-4">
          {currentResult.payoffTimeline.map((item, index) => (
            <div key={item.debtId} className="flex items-center gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-brand-navy text-white rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-brand-navy">{item.debtName}</p>
                <p className="text-xs text-brand-gray">
                  Paid off in month {item.payoffMonth} ({CalculationService.formatMonthYear(item.payoffDate)})
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-brand-gray">Month</p>
                <p className="text-sm font-medium text-brand-navy">{item.payoffMonth}</p>
              </div>
            </div>
          ))}
        </div>
      </Accordion>

      <Accordion
        icon={<LineChart className="w-5 h-5 text-brand-green" />}
        title="Payoff Projection Chart"
        defaultOpen={false}
      >
        <div className="pt-4">
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => CalculationService.formatCurrency(value)}
                labelStyle={{ color: '#000' }}
              />
              <Legend />
              {allDebts.map((debt, index) => (
                <Area
                  key={debt.id}
                  type="monotone"
                  dataKey={debt.accountName}
                  stackId="1"
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Accordion>

      <Accordion
        icon={<FileText className="w-5 h-5 text-brand-gray" />}
        title="Strategy Details"
        defaultOpen={false}
      >
        <div className="pt-4 space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-brand-gray-border">
            <span className="text-brand-gray">Extra Monthly Payment</span>
            <span className="font-medium text-brand-navy">
              {CalculationService.formatCurrency(currentResult.strategy.extraMonthlyPayment || 0)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-brand-gray-border">
            <span className="text-brand-gray">Starting Debt</span>
            <span className="font-medium text-brand-navy">
              {CalculationService.formatCurrency(
                allDebts.reduce((sum, d) => sum + d.currentBalance, 0)
              )}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-brand-gray-border">
            <span className="text-brand-gray">Number of Debts</span>
            <span className="font-medium text-brand-navy">{allDebts.length}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-brand-gray">Strategy Calculated</span>
            <span className="font-medium text-brand-navy">
              {CalculationService.formatDate(currentResult.strategy.calculatedAt)}
            </span>
          </div>
        </div>
      </Accordion>
      </div>
      </div>
    </div>
  );
}
