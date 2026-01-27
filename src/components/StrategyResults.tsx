import { RefreshCw, TrendingDown, Calendar, DollarSign, BarChart3, AlertTriangle, Mail, Phone } from 'lucide-react';
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
import type { StrategyResult } from '../types';

interface StrategyResultsProps {
  result: StrategyResult;
  onRunNew: () => void;
}

export default function StrategyResults({ result, onRunNew }: StrategyResultsProps) {
  const allStoredDebts = StorageService.getDebts();
  const debts = allStoredDebts.filter(d => !d.isPaidOff);
  const paidOffDebts = allStoredDebts.filter(d => d.isPaidOff);
  const financialProfile = StorageService.getFinancialProfile();

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
  const interestSaved = minimumOnly.totalInterest - result.totalInterest;
  const monthsSaved = minimumOnly.totalMonths - result.totalMonths;
  const isValidComparison = interestSaved >= 0 && monthsSaved >= 0;

  console.log('💰 STRATEGY COMPARISON:');
  console.log('  Baseline (minimums only):');
  console.log('    - Months:', minimumOnly.totalMonths);
  console.log('    - Interest:', minimumOnly.totalInterest);
  console.log('  Optimized (with extra payments):');
  console.log('    - Months:', result.totalMonths);
  console.log('    - Interest:', result.totalInterest);
  console.log('    - Extra payment:', result.strategy.extraMonthlyPayment);
  console.log('  SAVINGS:');
  console.log('    - Interest saved:', interestSaved);
  console.log('    - Months saved:', monthsSaved);
  console.log('    - Valid comparison?', isValidComparison);

  const chartData = result.monthlyProjections
    .filter((_, i) => i % 3 === 0 || i === result.monthlyProjections.length - 1)
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

  const colors = ['#2D9CDB', '#27AE60', '#F2C94C', '#EB5757', '#9B51E0', '#FF6B35'];

  const hasRateArbitrageWarnings = result.strategy.type === 'heloc-velocity' &&
    allDebts.some(d => d.interestRate < helocRate && d.id !== 'HELOC_VIRTUAL');

  // Calculate cash flow after debt minimums
  const totalMinimumPayments = allDebts.reduce((sum, d) => sum + d.minimumPayment, 0);
  const cashFlowAfterMinimums = financialProfile
    ? financialProfile.monthlyNetIncome -
      financialProfile.monthlyEssentialExpenses -
      financialProfile.monthlyDiscretionaryExpenses -
      totalMinimumPayments
    : result.strategy.extraMonthlyPayment || 0;

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
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Your Payoff Strategy</h2>
        <button
          onClick={onRunNew}
          className="flex items-center space-x-2 text-[#2D9CDB] hover:text-[#1E8BBD] font-semibold transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Run New Strategy</span>
        </button>
      </div>

{hasLowCashFlow ? (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-400 rounded-xl shadow-lg p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Strategy Optimization Not Available Yet</h2>
              <div className="bg-white/60 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700 mb-1">Your current cash flow after debt payments:</p>
                <p className={`text-3xl font-bold ${cashFlowAfterMinimums < 0 ? 'text-red-600' : 'text-amber-700'}`}>
                  {CalculationService.formatCurrency(cashFlowAfterMinimums)}/month
                </p>
              </div>
              <p className="text-lg text-gray-800 mb-4">
                To unlock NOVO's debt acceleration strategies, you need positive cash flow of at least $200-500/month.
              </p>
            </div>
          </div>

          {highestRateDebt && helocRate > 0 && highestRateDebt.interestRate > helocRate && helocTacticalImpact && (
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-500 rounded-xl p-6 mb-6 shadow-md">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-blue-600 text-2xl flex-shrink-0">✅</span>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-blue-900 mb-2">
                    Use HELOC Tactically {hasHELOCAccount ? '(Recommended)' : '(Recommended if you have home equity)'}
                  </h3>
                  {!hasHELOCAccount && (
                    <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mb-4">
                      <p className="text-sm font-semibold text-blue-900">
                        Note: Consider opening a HELOC if you have home equity. This strategy can create immediate cash flow relief.
                      </p>
                    </div>
                  )}
                  <p className="text-gray-700 mb-4">
                    If you have a HELOC, you can create immediate cash flow relief by strategically eliminating your highest-interest debt.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-5 mb-4">
                <h4 className="font-bold text-gray-900 mb-3">Your highest-interest debt:</h4>
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
                  <p className="text-xl font-bold text-red-900 mb-1">{highestRateDebt.accountName}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600">Interest Rate</p>
                      <p className="text-lg font-bold text-red-700">{highestRateDebt.interestRate.toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Current Balance</p>
                      <p className="text-lg font-bold text-gray-900">{CalculationService.formatCurrency(highestRateDebt.currentBalance)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Minimum Payment</p>
                      <p className="text-lg font-bold text-gray-900">{CalculationService.formatCurrency(highestRateDebt.minimumPayment)}/mo</p>
                    </div>
                    <div>
                      <p className="text-gray-600">HELOC Rate</p>
                      <p className="text-lg font-bold text-blue-700">{helocRate.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-400 rounded-lg p-5">
                  <h4 className="font-bold text-emerald-900 mb-3 text-lg">The Tactical Strategy:</h4>
                  <div className="space-y-2 text-gray-800">
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <p>Draw {CalculationService.formatCurrency(highestRateDebt.currentBalance)} from HELOC ({helocRate.toFixed(2)}% rate)</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <p>Pay off {highestRateDebt.accountName} completely</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                      <p>Free up {CalculationService.formatCurrency(helocTacticalImpact.freedCashFlow)}/month in cash flow</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                      <p>Combine with spending cuts ({CalculationService.formatCurrency(helocTacticalImpact.targetSpendingCuts)}/month)</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
                      <p>Now you have {CalculationService.formatCurrency(helocTacticalImpact.totalMonthlyToHELOC)}/month to attack HELOC</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">6</span>
                      <p>HELOC paid off in approximately {helocTacticalImpact.monthsToPayoffHELOC} months</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">7</span>
                      <p className="font-semibold text-emerald-900">Cash flow turns strongly positive</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">8</span>
                      <p className="font-semibold text-emerald-900">Attack remaining debts with freed payments</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 bg-blue-50 border border-blue-300 rounded-lg p-4">
                  <h5 className="font-bold text-blue-900 mb-2">Why this works:</h5>
                  <ul className="space-y-1 text-sm text-gray-800">
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0">•</span>
                      <span>Trade {highestRateDebt.interestRate.toFixed(2)}% interest for {helocRate.toFixed(2)}% (save {helocTacticalImpact.interestSavings.toFixed(2)}% on that balance)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0">•</span>
                      <span>Creates immediate breathing room</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0">•</span>
                      <span>Short-term strategy ({helocTacticalImpact.monthsToPayoffHELOC} months) for long-term gain</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0">•</span>
                      <span>Requires discipline but highly effective</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-4 bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                    <h5 className="font-bold text-amber-900">Important: This only works if you commit to:</h5>
                  </div>
                  <ul className="space-y-1 text-sm text-gray-800 ml-7">
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0">•</span>
                      <span className="font-semibold">Not using the paid-off credit card</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0">•</span>
                      <span className="font-semibold">Cutting spending to pay down HELOC quickly</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0">•</span>
                      <span className="font-semibold">Tracking your HELOC balance weekly</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => {
                    const message = encodeURIComponent(
                      `I'm interested in the HELOC tactical strategy to eliminate my ${highestRateDebt.accountName} debt (${CalculationService.formatCurrency(highestRateDebt.currentBalance)} at ${highestRateDebt.interestRate.toFixed(2)}%). Can you help me set this up?`
                    );
                    window.location.href = `mailto:ben@windmillmortgage.com?subject=NOVO%20HELOC%20Tactical%20Strategy&body=${message}`;
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-md hover:shadow-lg"
                >
                  Show My HELOC Strategy
                </button>
                <button
                  onClick={() => {
                    const message = encodeURIComponent(
                      `I don't currently have a HELOC but I'm interested in learning more about using one tactically to improve my cash flow. Can you help?`
                    );
                    window.location.href = `mailto:ben@windmillmortgage.com?subject=NOVO%20HELOC%20Options&body=${message}`;
                  }}
                  className="bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 px-6 rounded-lg border-2 border-gray-300 transition-all"
                >
                  {hasHELOCAccount ? 'Learn More' : 'I Don\'t Have HELOC'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Additional ways to improve your cash flow:</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-emerald-600 text-xl flex-shrink-0">✅</span>
                <div>
                  <p className="font-semibold text-gray-900">Reduce discretionary expenses</p>
                  <p className="text-sm text-gray-600">Cut back on dining out, shopping, entertainment, and subscriptions</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-emerald-600 text-xl flex-shrink-0">✅</span>
                <div>
                  <p className="font-semibold text-gray-900">Increase income</p>
                  <p className="text-sm text-gray-600">Side hustle, overtime hours, or ask for a raise</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-emerald-600 text-xl flex-shrink-0">✅</span>
                <div>
                  <p className="font-semibold text-gray-900">Pay off one small debt</p>
                  <p className="text-sm text-gray-600">Free up its minimum payment to increase cash flow</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-emerald-600 text-xl flex-shrink-0">✅</span>
                <div>
                  <p className="font-semibold text-gray-900">Consider debt consolidation</p>
                  <p className="text-sm text-gray-600">Lower monthly payments through refinancing or consolidation</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-blue-900 mb-3">Current Action Plan:</h3>
            <ul className="space-y-2 text-blue-900">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0">•</span>
                <span>Focus on making all minimum payments on time</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0">•</span>
                <span>Track spending to find areas to cut</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0">•</span>
                <span>Build $1,000 emergency fund</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0">•</span>
                <span>Once cash flow improves, return here for optimized strategy</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-lg p-6 mb-6">
            <p className="text-lg font-semibold text-emerald-900 mb-3">Need personalized guidance?</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-emerald-800">
                <Mail className="w-5 h-5 flex-shrink-0" />
                <a href="mailto:ben@windmillmortgage.com" className="hover:underline font-medium text-lg">
                  ben@windmillmortgage.com
                </a>
              </div>
              <div className="flex items-center gap-3 text-emerald-800">
                <Phone className="w-5 h-5 flex-shrink-0" />
                <a href="tel:614-327-2213" className="hover:underline font-medium text-lg">
                  614-327-2213
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => window.location.href = '/settings'}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-all"
            >
              Update My Budget
            </button>
            <button
              onClick={() => {
                const message = encodeURIComponent('I want to reduce my expenses and increase my cash flow. Can you help me identify areas where I can cut back?');
                window.location.href = `mailto:ben@windmillmortgage.com?subject=NOVO%20Expense%20Reduction%20Help&body=${message}`;
              }}
              className="bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 px-6 rounded-lg border-2 border-gray-300 transition-all"
            >
              Reduce Expenses
            </button>
            <button
              onClick={() => {
                const message = encodeURIComponent('I want to explore ways to increase my income. What side hustles or opportunities would you recommend?');
                window.location.href = `mailto:ben@windmillmortgage.com?subject=NOVO%20Income%20Increase%20Help&body=${message}`;
              }}
              className="bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 px-6 rounded-lg border-2 border-gray-300 transition-all"
            >
              Add Income Source
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-[#27AE60] to-[#229954] text-white rounded-lg shadow-lg p-6">
              <h3 className="text-sm font-semibold mb-2 opacity-90">Your Strategy (Optimized)</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-8 h-8" />
                  <div>
                    <p className="text-2xl font-bold">
                      {Math.floor(result.totalMonths / 12)} years, {result.totalMonths % 12} months
                    </p>
                    <p className="text-sm opacity-90">Debt-Free: {CalculationService.formatMonthYear(result.debtFreeDate)}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-white/20">
                  <p className="text-sm opacity-90">Total Interest</p>
                  <p className="text-xl font-bold">{CalculationService.formatCurrency(result.totalInterest)}</p>
                </div>
                <div className="pt-2">
                  <p className="text-sm opacity-90">Total Paid</p>
                  <p className="text-xl font-bold">{CalculationService.formatCurrency(result.totalPaid)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-300 rounded-lg shadow-md p-6">
              <h3 className="text-sm font-semibold mb-2 text-gray-600">Minimum Payments Only (Baseline)</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-8 h-8 text-gray-400" />
                  <div>
                    <p className="text-2xl font-bold text-gray-800">
                      {Math.floor(minimumOnly.totalMonths / 12)} years, {minimumOnly.totalMonths % 12} months
                    </p>
                    <p className="text-sm text-gray-600">
                      Debt-Free: {CalculationService.formatMonthYear(minimumOnly.debtFreeDate)}
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">Total Interest</p>
                  <p className="text-xl font-bold text-gray-800">
                    {CalculationService.formatCurrency(minimumOnly.totalInterest)}
                  </p>
                </div>
                <div className="pt-2">
                  <p className="text-sm text-gray-600">Total Paid</p>
                  <p className="text-xl font-bold text-gray-800">
                    {CalculationService.formatCurrency(minimumOnly.totalPaid)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {isValidComparison ? (
            <div className="bg-gradient-to-br from-[#2D9CDB] to-[#1E8BBD] text-white rounded-lg shadow-lg p-6">
              <div className="flex items-start space-x-4">
                <div className="bg-white/20 p-3 rounded-lg">
                  <TrendingDown className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">
                    YOU'LL SAVE {CalculationService.formatCurrency(interestSaved)}!
                  </h3>
                  <p className="text-lg opacity-90">
                    And be debt-free{' '}
                    <span className="font-bold">
                      {Math.floor(monthsSaved / 12)} years,{' '}
                      {monthsSaved % 12} months
                    </span>{' '}
                    sooner!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border-2 border-amber-500 rounded-lg shadow-lg p-6">
              <div className="flex items-start space-x-4">
                <div className="bg-amber-500/20 p-3 rounded-lg">
                  <TrendingDown className="w-8 h-8 text-amber-700" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2 text-amber-900">
                    Strategy Comparison Unavailable
                  </h3>
                  <p className="text-amber-800">
                    Unable to calculate accurate baseline comparison. Please verify all debt information is correct,
                    especially minimum payments and interest rates. If you have a mortgage, ensure the P&I payment
                    matches your actual monthly payment.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-6">How to Execute Your Strategy</h3>

        <div className="space-y-6">
          <div className="bg-gradient-to-r from-[#2D9CDB]/10 to-[#27AE60]/10 rounded-lg p-5 border-l-4 border-[#2D9CDB]">
            <div className="flex items-center space-x-2 mb-3">
              <DollarSign className="w-6 h-6 text-[#2D9CDB]" />
              <h4 className="font-bold text-gray-800 text-lg">Your Total Monthly Cash Flow</h4>
            </div>
            {financialProfile ? (
              <>
                <p className="text-3xl font-bold text-gray-800 mb-2">
                  {CalculationService.formatCurrency(
                    financialProfile.monthlyNetIncome -
                    financialProfile.monthlyEssentialExpenses -
                    financialProfile.monthlyDiscretionaryExpenses
                  )}
                </p>
                <div className="mt-3 space-y-2 text-sm bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Minimum payments:</span>
                    <span className="font-semibold text-gray-800">
                      {CalculationService.formatCurrency(
                        allDebts.reduce((sum, d) => sum + d.minimumPayment, 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Extra for debt payoff:</span>
                    <span className="font-semibold text-gray-800">
                      {CalculationService.formatCurrency(
                        financialProfile.monthlyNetIncome -
                        financialProfile.monthlyEssentialExpenses -
                        financialProfile.monthlyDiscretionaryExpenses -
                        allDebts.reduce((sum, d) => sum + d.minimumPayment, 0)
                      )}
                    </span>
                  </div>
                  {paidOffDebts.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-gray-200">
                      <div className="flex items-start gap-2">
                        <span className="text-[#27AE60] font-semibold">✓</span>
                        <p className="text-gray-700 flex-1">
                          <span className="font-semibold text-[#27AE60]">
                            {CalculationService.formatCurrency(paidOffDebts.reduce((sum, d) => sum + d.minimumPayment, 0))}
                          </span> freed from paid-off debts is included in your extra payment!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-gray-600">Set up your financial profile to see cash flow details.</p>
            )}
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Payment Breakdown This Month:</h4>
            <div className="space-y-2">
              {allDebts
                .sort((a, b) => b.interestRate - a.interestRate)
                .map((debt, index) => {
                  const isTargetDebt = index === 0;
                  const paymentAmount = debt.minimumPayment + (isTargetDebt ? (result.strategy.extraMonthlyPayment || 0) : 0);
                  const isHELOC = debt.id === 'HELOC_VIRTUAL';

                  return (
                    <div
                      key={debt.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isTargetDebt ? 'bg-[#27AE60]/10 border-2 border-[#27AE60]' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex-1">
                        <span className="font-medium text-gray-800">{debt.accountName}:</span>
                        {isTargetDebt ? (
                          <span className="ml-2 text-gray-700">
                            {isHELOC ? (
                              <>
                                {CalculationService.formatCurrency(0)} (no minimum) +{' '}
                                {CalculationService.formatCurrency(result.strategy.extraMonthlyPayment || 0)} ={' '}
                                <span className="font-bold text-[#27AE60]">{CalculationService.formatCurrency(paymentAmount)}</span>
                              </>
                            ) : (
                              <>
                                {CalculationService.formatCurrency(debt.minimumPayment)} +{' '}
                                {CalculationService.formatCurrency(result.strategy.extraMonthlyPayment || 0)} ={' '}
                                <span className="font-bold text-[#27AE60]">{CalculationService.formatCurrency(paymentAmount)}</span>
                              </>
                            )}
                          </span>
                        ) : (
                          <span className="ml-2 text-gray-700">
                            {CalculationService.formatCurrency(debt.minimumPayment)} <span className="text-gray-500">(minimum only)</span>
                          </span>
                        )}
                      </div>
                      {isTargetDebt && (
                        <span className="ml-3 bg-[#27AE60] text-white text-xs font-bold px-3 py-1 rounded-full">
                          FOCUS HERE
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
            {helocDebt && allDebts[0].id === 'HELOC_VIRTUAL' && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Pay down your HELOC balance first</span> - it has the highest interest rate at {helocRate.toFixed(2)}%.
                  Once HELOC reaches $0, extra payments will automatically move to your next highest-rate debt.
                </p>
              </div>
            )}
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Payment Priority (Automatic):</h4>
            <p className="text-sm text-gray-700 mb-3">
              The extra {CalculationService.formatCurrency(result.strategy.extraMonthlyPayment || 0)} always goes to your highest-interest debt first.
            </p>
            <div className="space-y-2">
              {result.payoffTimeline.map((item, index) => {
                const debt = allDebts.find(d => d.id === item.debtId);
                const startMonth = index === 0 ? 1 : result.payoffTimeline[index - 1].payoffMonth + 1;
                const isHELOC = item.debtId === 'HELOC_VIRTUAL';

                return (
                  <div key={item.debtId} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#2D9CDB] text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-gray-800">
                        Months {startMonth}-{item.payoffMonth}:
                      </span>
                      <span className="ml-2 text-gray-700">
                        {item.debtName}
                      </span>
                      {debt && (
                        <span className="ml-2 text-sm text-gray-600">
                          ({debt.interestRate.toFixed(2)}% interest)
                        </span>
                      )}
                      {isHELOC && index === 0 && (
                        <span className="ml-2 text-sm font-semibold text-blue-600">
                          ← Pay HELOC balance of {CalculationService.formatCurrency(helocBalance)} first
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#F2C94C]/10 rounded-lg p-5 border-l-4 border-[#F2C94C]">
            <h4 className="font-semibold text-gray-800 mb-3">How It Works:</h4>
            <ol className="space-y-2 text-gray-700">
              <li className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-[#2D9CDB] text-white rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>Each month, pay the minimum on ALL debts</span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-[#2D9CDB] text-white rounded-full flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>
                  Add the extra {CalculationService.formatCurrency(result.strategy.extraMonthlyPayment || 0)} to the debt with highest interest
                  {helocDebt && allDebts[0].id === 'HELOC_VIRTUAL' && (
                    <span className="block mt-1 text-blue-600 font-semibold">
                      (Start with HELOC - eliminate your {CalculationService.formatCurrency(helocBalance)} balance first)
                    </span>
                  )}
                </span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-[#2D9CDB] text-white rounded-full flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>When a debt is paid off, move that entire payment to the next highest-interest debt</span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-[#2D9CDB] text-white rounded-full flex items-center justify-center text-xs font-bold">
                  4
                </span>
                <span>Repeat until debt-free</span>
              </li>
            </ol>
            <p className="mt-4 text-sm font-semibold text-gray-800 bg-white/50 rounded p-3">
              This strategy automatically targets high-interest debt first to save you the most money.
            </p>
          </div>
        </div>
      </div>

      {result.strategy.type === 'heloc-velocity' && financialProfile && homeEquity && (
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

      <Accordion
        emoji="❓"
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
              Yes! Life changes, and so can your strategy. Click "Run New Strategy" at the top to:
            </p>
            <ul className="text-gray-700 space-y-1 ml-4">
              <li>• Update your cash flow if income/expenses changed</li>
              <li>• Switch between standard payoff and HELOC velocity banking</li>
              <li>• Recalculate after adding or paying off debts</li>
              <li>• Adjust your extra payment amount</li>
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
        emoji="📅"
        title="Debt Payoff Timeline"
        defaultOpen={false}
      >
        <div className="pt-4 space-y-4">
          {result.payoffTimeline.map((item, index) => (
            <div key={item.debtId} className="flex items-center space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-[#27AE60] text-white rounded-full flex items-center justify-center font-bold">
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{item.debtName}</p>
                <p className="text-sm text-gray-600">
                  Paid off in month {item.payoffMonth} ({CalculationService.formatMonthYear(item.payoffDate)})
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Month</p>
                <p className="font-bold text-[#2D9CDB]">{item.payoffMonth}</p>
              </div>
            </div>
          ))}
        </div>
      </Accordion>

      <Accordion
        emoji="📊"
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
        emoji="📋"
        title="Strategy Details"
        defaultOpen={false}
      >
        <div className="pt-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Extra Monthly Payment:</span>
            <span className="font-semibold">
              {CalculationService.formatCurrency(result.strategy.extraMonthlyPayment || 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Starting Debt:</span>
            <span className="font-semibold">
              {CalculationService.formatCurrency(
                allDebts.reduce((sum, d) => sum + d.currentBalance, 0)
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Number of Debts:</span>
            <span className="font-semibold">{allDebts.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Strategy Calculated:</span>
            <span className="font-semibold">
              {CalculationService.formatDate(result.strategy.calculatedAt)}
            </span>
          </div>
        </div>
      </Accordion>
    </div>
  );
}
