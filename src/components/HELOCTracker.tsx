import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Plus, Download, Edit2, X, CreditCard, Wallet, PenLine } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import { CheckingTracker } from './CheckingTracker';
import Accordion from './Accordion';
import ChunkingRecommendation from './ChunkingRecommendation';
import ChunkingScenarioComparison from './ChunkingScenarioComparison';
import ChunkingPlanCalculator from './ChunkingPlanCalculator';
import AdvancedVelocityBanking from './AdvancedVelocityBanking';
import ChunkingRiskAssessment from './ChunkingRiskAssessment';
import type { Debt } from '../types';

interface HELOCTransaction {
  id: string;
  date: string;
  type: 'draw' | 'payment' | 'interest';
  amount: number;
  description: string;
  debtLinked?: string;
  balance: number;
}

type TrackingType = 'heloc' | 'checking' | 'both';

interface SuccessBanner {
  type: 'draw' | 'payment' | 'interest';
  amount: number;
  newBalance: number;
}

export function HELOCTracker() {
  const [trackingType, setTrackingType] = useState<TrackingType>(() => {
    const saved = localStorage.getItem('novo_tracking_type');
    return (saved as TrackingType) || 'heloc';
  });
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<HELOCTransaction | null>(null);
  const [transactionJustLogged, setTransactionJustLogged] = useState(false);
  const [successBanner, setSuccessBanner] = useState<SuccessBanner | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const homeEquity = StorageService.getHomeEquity();
  const financialProfile = StorageService.getFinancialProfile();
  const debts = StorageService.getDebts().filter(d => !d.isPaidOff);
  const totalMinimumPayments = debts.reduce((sum, d) => sum + d.minimumPayment, 0);

  const handleTrackingTypeChange = (type: TrackingType) => {
    setTrackingType(type);
    localStorage.setItem('novo_tracking_type', type);
  };
  const hasHomeEquity = homeEquity.ownsHome && homeEquity.homeValue && homeEquity.mortgageBalance !== undefined;

  const transactions = useMemo(() => {
    const stored = localStorage.getItem('novo_heloc_transactions');
    return stored ? JSON.parse(stored) as HELOCTransaction[] : [];
  }, [refreshTrigger]);

  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => {
        setSuccessBanner(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  const helocLimit = homeEquity.hasHELOC && homeEquity.helocLimit
    ? homeEquity.helocLimit
    : hasHomeEquity
      ? (homeEquity.homeValue! * 0.9) - homeEquity.mortgageBalance!
      : 0;

  const currentBalance = transactions.length > 0
    ? transactions[transactions.length - 1].balance
    : (homeEquity.hasHELOC && homeEquity.helocBalance !== undefined ? homeEquity.helocBalance : 0);

  const availableCredit = helocLimit - currentBalance;
  const interestRate = homeEquity.hasHELOC && homeEquity.helocRate ? homeEquity.helocRate : 8.5;
  const monthlyInterest = currentBalance * (interestRate / 12 / 100);
  const dailyInterest = (currentBalance * interestRate / 100) / 365;
  const monthlyProjection = dailyInterest * 30;

  const recentPayments = transactions
    .filter(t => t.type === 'payment')
    .slice(-3)
    .map(t => t.amount);

  const averagePayment = recentPayments.length > 0
    ? recentPayments.reduce((sum, amt) => sum + amt, 0) / recentPayments.length
    : 0;

  const monthsToPayoff = averagePayment > 0
    ? Math.ceil((currentBalance / averagePayment) * 1.1)
    : 0;

  const payoffDate = monthsToPayoff > 0
    ? new Date(new Date().setMonth(new Date().getMonth() + monthsToPayoff))
    : null;

  const chartData = useMemo(() => {
    const data: { month: string; balance: number }[] = [];
    let balance = homeEquity.hasHELOC && homeEquity.helocBalance !== undefined ? homeEquity.helocBalance : 0;

    transactions.forEach((t, idx) => {
      const date = new Date(t.date);
      const monthStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (data.length === 0 || data[data.length - 1].month !== monthStr) {
        data.push({ month: monthStr, balance: t.balance });
      } else {
        data[data.length - 1].balance = t.balance;
      }
    });

    return data;
  }, [transactions, homeEquity]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-4 mb-6">
          <label className="text-sm font-semibold text-gray-700">What are you tracking?</label>
          <select
            value={trackingType}
            onChange={(e) => handleTrackingTypeChange(e.target.value as TrackingType)}
            className="flex-1 max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent bg-white text-gray-800 font-medium"
          >
            <option value="heloc">HELOC Account</option>
            <option value="checking">Checking/Cash Flow Account</option>
            <option value="both">Both</option>
          </select>
        </div>

        <div className="bg-blue-50 border-l-4 border-[#2D9CDB] p-4 rounded-r-lg">
          <p className="text-sm text-gray-700">
            {trackingType === 'heloc' && 'Track your HELOC draws, payments, and interest for velocity banking.'}
            {trackingType === 'checking' && 'Track your checking account deposits, withdrawals, and cash flow for strategic debt payments.'}
            {trackingType === 'both' && 'Track both your HELOC and checking account for advanced velocity banking strategies.'}
          </p>
        </div>
      </div>

      {successBanner && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-500 rounded-lg shadow-lg p-6 animate-slide-down">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">✓</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-emerald-900 mb-2">
                {successBanner.type === 'payment' && 'Payment Recorded!'}
                {successBanner.type === 'draw' && 'Draw Recorded!'}
                {successBanner.type === 'interest' && 'Interest Recorded!'}
              </h3>
              <p className="text-gray-800 mb-4">
                New HELOC balance: <span className="font-bold text-2xl">{CalculationService.formatCurrency(successBanner.newBalance)}</span>
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setSuccessBanner(null);
                    setEditingTransaction(null);
                    setShowPaymentModal(true);
                  }}
                  className="flex items-center space-x-2 bg-[#27AE60] hover:bg-[#229954] text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record Another Payment</span>
                </button>
                <button
                  onClick={() => {
                    setSuccessBanner(null);
                    setEditingTransaction(null);
                    setShowDrawModal(true);
                  }}
                  className="flex items-center space-x-2 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2 px-4 rounded-lg border-2 border-gray-300 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record Draw</span>
                </button>
                <button
                  onClick={() => {
                    setSuccessBanner(null);
                    setEditingTransaction(null);
                    setShowInterestModal(true);
                  }}
                  className="flex items-center space-x-2 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2 px-4 rounded-lg border-2 border-gray-300 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record Interest</span>
                </button>
                <button
                  onClick={() => setSuccessBanner(null)}
                  className="flex items-center space-x-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Done</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(trackingType === 'heloc' || trackingType === 'both') && !hasHomeEquity && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No HELOC Configured</h2>
          <p className="text-gray-600 mb-6">
            Go to Payment Strategies to add your home equity information first.
          </p>
          <button
            onClick={() => window.location.href = '#payment-strategies'}
            className="bg-[#2D9CDB] hover:bg-[#1E7BB5] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Go to Payment Strategies
          </button>
        </div>
      )}

      {(trackingType === 'heloc' || trackingType === 'both') && hasHomeEquity && (
        <>
          <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2D5A8A] text-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6">HELOC Overview</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div>
                <div className="text-sm opacity-90">Credit Limit</div>
                <div className="text-2xl font-bold">{CalculationService.formatCurrency(helocLimit)}</div>
              </div>
              <div>
                <div className="text-sm opacity-90">Current Balance</div>
                <div className="text-2xl font-bold">{CalculationService.formatCurrency(currentBalance)}</div>
              </div>
              <div>
                <div className="text-sm opacity-90">Available Credit</div>
                <div className="text-2xl font-bold text-[#27AE60]">{CalculationService.formatCurrency(availableCredit)}</div>
              </div>
              <div>
                <div className="text-sm opacity-90">Interest Rate</div>
                <div className="text-2xl font-bold">{interestRate.toFixed(2)}% APR</div>
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4 mb-4">
              <div className="text-sm mb-2">Monthly Interest Accruing: <span className="font-bold">{CalculationService.formatCurrency(monthlyInterest)}</span></div>
              {monthsToPayoff > 0 && averagePayment > 0 && (
                <div className="text-sm">
                  Payoff Projection: At <span className="font-bold">{CalculationService.formatCurrency(averagePayment)}</span>/month,
                  HELOC will be paid off in <span className="font-bold">{monthsToPayoff} months</span>
                  {payoffDate && <> ({payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})</>}
                </div>
              )}
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span>{CalculationService.formatCurrency(currentBalance)} used</span>
                <span>{CalculationService.formatCurrency(helocLimit)} limit</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div
                  className="bg-[#F2C94C] h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((currentBalance / helocLimit) * 100, 100)}%` }}
                />
              </div>
            </div>

            {currentBalance > 0 && (
              <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-300/30 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-bold mb-3 flex items-center">
                  <span className="text-orange-200">Daily Interest Accrual</span>
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/90">Today's interest charge:</span>
                    <span className="text-xl font-bold text-orange-200">{CalculationService.formatCurrency(dailyInterest)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/80">Monthly projection (if balance stays constant):</span>
                    <span className="text-lg font-semibold text-white">{CalculationService.formatCurrency(monthlyProjection)}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/20">
                  <p className="text-xs text-white/80 leading-relaxed">
                    💡 Every dollar you pay down today stops accruing interest immediately. The faster you pay down your HELOC, the more you save.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setShowDrawModal(true);
                }}
                className="flex items-center space-x-2 bg-white text-[#1E3A5F] hover:bg-gray-100 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Record Draw</span>
              </button>
              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setShowPaymentModal(true);
                }}
                className="flex items-center space-x-2 bg-[#27AE60] hover:bg-[#229954] font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Record Payment</span>
              </button>
              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setShowInterestModal(true);
                }}
                className="flex items-center space-x-2 bg-[#F2994A] hover:bg-[#E67E22] font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Record Interest</span>
              </button>
            </div>
          </div>

          <Accordion
            emoji="📊"
            title="HELOC Transaction History"
            defaultOpen={transactionJustLogged}
          >
            <div className="pt-4">
              <TransactionLedger
                transactions={transactions}
                onEdit={(transaction) => {
                  setEditingTransaction(transaction);
                  if (transaction.type === 'draw') setShowDrawModal(true);
                  else if (transaction.type === 'payment') setShowPaymentModal(true);
                  else setShowInterestModal(true);
                }}
                onDelete={(id) => {
                  if (confirm('Delete this transaction? All balances will be recalculated from this point forward.')) {
                    const filtered = transactions.filter(t => t.id !== id);
                    recalculateBalances(filtered);
                    localStorage.setItem('novo_heloc_transactions', JSON.stringify(filtered));
                    setRefreshTrigger(prev => prev + 1);
                  }
                }}
              />
            </div>
          </Accordion>

          {chartData.length > 0 && (
            <Accordion
              emoji="📈"
              title="HELOC Balance Over Time"
              defaultOpen={false}
            >
              <div className="pt-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => CalculationService.formatCurrency(value as number)} />
                    <Line type="monotone" dataKey="balance" stroke="#2D9CDB" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Accordion>
          )}

          {financialProfile && (() => {
            const mortgageDebt = debts.find(d => d.category === 'Mortgage');
            const cashFlow = financialProfile.monthlyNetIncome -
              financialProfile.monthlyEssentialExpenses -
              financialProfile.monthlyDiscretionaryExpenses -
              totalMinimumPayments;

            const recommendedChunkSize = Math.floor((cashFlow * 2.5) / 1000) * 1000;

            if (mortgageDebt && recommendedChunkSize >= 5000) {
              return (
                <Accordion
                  emoji="🎯"
                  title="Smart Chunking Guide"
                  defaultOpen={currentBalance > 0}
                >
                  <div className="pt-4 space-y-6">
                    <ChunkingRecommendation
                      monthlyCashFlow={cashFlow}
                      currentHELOCBalance={currentBalance}
                      helocLimit={helocLimit}
                      helocRate={interestRate}
                    />
                    <ChunkingScenarioComparison
                      chunkAmount={recommendedChunkSize}
                      mortgageBalance={mortgageDebt.currentBalance}
                      mortgageRate={mortgageDebt.interestRate}
                      helocRate={interestRate}
                      monthlyCashFlow={cashFlow}
                    />
                    <ChunkingPlanCalculator
                      initialChunkAmount={recommendedChunkSize}
                      monthlyCashFlow={cashFlow}
                      helocRate={interestRate}
                      currentHELOCBalance={currentBalance}
                    />
                    <AdvancedVelocityBanking
                      chunkAmount={recommendedChunkSize}
                      biweeklyPaycheck={financialProfile.monthlyNetIncome / 2}
                      monthlyBills={financialProfile.monthlyEssentialExpenses + financialProfile.monthlyDiscretionaryExpenses}
                      helocRate={interestRate}
                    />
                    <ChunkingRiskAssessment />
                  </div>
                </Accordion>
              );
            }
            return null;
          })()}

          <Accordion
            emoji="💡"
            title="How HELOC Velocity Banking Works"
            defaultOpen={false}
          >
            <div className="pt-4 space-y-6">
              <div>
                <h4 className="font-bold text-gray-800 mb-3 text-lg">The 3-Step HELOC Cycle</h4>
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-[#2D9CDB]">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-[#2D9CDB] text-white rounded-full flex items-center justify-center font-bold">
                        1
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-800 mb-1">Draw from HELOC</h5>
                        <p className="text-gray-700 text-sm">
                          Use your HELOC to pay off high-interest debt (credit cards, personal loans). This swaps expensive debt for cheaper HELOC debt.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4 border-l-4 border-[#27AE60]">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-[#27AE60] text-white rounded-full flex items-center justify-center font-bold">
                        2
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-800 mb-1">Deposit Cash Flow</h5>
                        <p className="text-gray-700 text-sm">
                          Deposit your paycheck and extra cash flow directly into the HELOC. This immediately reduces the balance and stops interest from accruing on that amount.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-4 border-l-4 border-[#F2994A]">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-[#F2994A] text-white rounded-full flex items-center justify-center font-bold">
                        3
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-800 mb-1">Pay Bills from HELOC</h5>
                        <p className="text-gray-700 text-sm">
                          As bills come due, draw from your HELOC to pay them. Your cash flow sits in the HELOC reducing interest, only being used when needed.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-bold text-gray-800 mb-3 text-lg">When HELOC Velocity Banking Makes Sense</h4>
                <div className="bg-green-50 rounded-lg p-4">
                  <ul className="space-y-2 text-gray-700 text-sm">
                    <li className="flex items-start space-x-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>You have high-interest debt (credit cards, personal loans at 15%+ APR)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>Your HELOC rate is significantly lower than your debt rates</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>You have consistent monthly cash flow to pay down the HELOC</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>You're disciplined and won't rack up new debt</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-bold text-gray-800 mb-3 text-lg">Common Mistakes to Avoid</h4>
                <div className="bg-red-50 rounded-lg p-4">
                  <ul className="space-y-2 text-gray-700 text-sm">
                    <li className="flex items-start space-x-2">
                      <span className="text-red-600 font-bold">✗</span>
                      <span>Using HELOC to pay off debt with LOWER interest rates than your HELOC</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-red-600 font-bold">✗</span>
                      <span>Not depositing cash flow consistently into the HELOC</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-red-600 font-bold">✗</span>
                      <span>Taking on new credit card debt after paying them off with HELOC</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-red-600 font-bold">✗</span>
                      <span>Ignoring the HELOC balance and letting it grow unchecked</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-bold text-gray-800 mb-3 text-lg">Safety Rules</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2 text-gray-700 text-sm">
                    <li className="flex items-start space-x-2">
                      <span className="text-[#2D9CDB] font-bold">►</span>
                      <span>Track every HELOC transaction in NOVO - never lose sight of your balance</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-[#2D9CDB] font-bold">►</span>
                      <span>Set up automatic payments to ensure you're always paying down the HELOC</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-[#2D9CDB] font-bold">►</span>
                      <span>Keep an emergency fund separate from your HELOC strategy</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-[#2D9CDB] font-bold">►</span>
                      <span>Review your HELOC balance weekly to ensure you're on track</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </Accordion>

          <Accordion
            emoji="❓"
            title="HELOC Tracker FAQ"
            defaultOpen={false}
          >
            <div className="pt-4 space-y-6">
              <div>
                <h5 className="font-bold text-gray-800 mb-2">How do I record a HELOC transaction?</h5>
                <p className="text-gray-700 text-sm">
                  Use the quick action buttons above: "Record Draw" when you take money from your HELOC,
                  "Record Payment" when you pay it down, and "Record Interest" to log monthly interest charges.
                  All transactions will appear in the Transaction History section.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-gray-800 mb-2">What's the difference between a draw and a payment?</h5>
                <p className="text-gray-700 text-sm mb-2">
                  A <strong>draw</strong> increases your HELOC balance (borrowing money), while a <strong>payment</strong>
                  decreases it (paying money back). Interest charges also increase your balance.
                </p>
                <ul className="text-gray-700 text-sm space-y-1 ml-4">
                  <li>• Draw: Use HELOC funds to pay off a credit card → HELOC balance goes up</li>
                  <li>• Payment: Deposit paycheck into HELOC → HELOC balance goes down</li>
                  <li>• Interest: Monthly interest charge → HELOC balance goes up</li>
                </ul>
              </div>

              <div>
                <h5 className="font-bold text-gray-800 mb-2">When should I record interest charges?</h5>
                <p className="text-gray-700 text-sm">
                  Record interest charges at the end of each month, typically the last day of the month or whenever your
                  HELOC statement posts. NOVO can auto-calculate the interest based on your balance and rate, or you can
                  enter the exact amount from your statement.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-gray-800 mb-2">What does the balance chart show me?</h5>
                <p className="text-gray-700 text-sm">
                  The "HELOC Balance Over Time" chart visualizes how your HELOC balance changes month by month.
                  You want to see this line trending downward over time, indicating you're paying down the HELOC faster than you're drawing from it.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-gray-800 mb-2">Can I edit or delete a transaction?</h5>
                <p className="text-gray-700 text-sm">
                  Yes! In the Transaction History section, each transaction has Edit and Delete buttons.
                  When you edit or delete a transaction, all subsequent balances are automatically recalculated to maintain accuracy.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-gray-800 mb-2">What does "Payoff Projection" mean?</h5>
                <p className="text-gray-700 text-sm">
                  The payoff projection estimates when you'll pay off your HELOC based on your recent payment history.
                  It analyzes your last 3 payments, calculates the average, and projects forward. If you increase your payments,
                  the payoff date will move closer.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-gray-800 mb-2">How do I export my transaction history?</h5>
                <p className="text-gray-700 text-sm">
                  In the Transaction History section, click the "Export CSV" button to download all your transactions as a spreadsheet.
                  This is useful for tax purposes, sharing with a financial advisor, or keeping backup records.
                </p>
              </div>
            </div>
          </Accordion>
        </>
      )}

      {(trackingType === 'checking' || trackingType === 'both') && (
        <CheckingTracker />
      )}

      {showDrawModal && (
        <RecordDrawModal
          onClose={() => {
            setShowDrawModal(false);
            setEditingTransaction(null);
          }}
          onSuccess={(amount, newBalance) => {
            setShowDrawModal(false);
            setEditingTransaction(null);
            setSuccessBanner({ type: 'draw', amount, newBalance });
            setRefreshTrigger(prev => prev + 1);
            setTransactionJustLogged(true);
          }}
          currentBalance={currentBalance}
          editTransaction={editingTransaction}
        />
      )}

      {showPaymentModal && (
        <RecordPaymentModal
          onClose={() => {
            setShowPaymentModal(false);
            setEditingTransaction(null);
          }}
          onSuccess={(amount, newBalance) => {
            setShowPaymentModal(false);
            setEditingTransaction(null);
            setSuccessBanner({ type: 'payment', amount, newBalance });
            setRefreshTrigger(prev => prev + 1);
            setTransactionJustLogged(true);
          }}
          currentBalance={currentBalance}
          editTransaction={editingTransaction}
        />
      )}

      {showInterestModal && (
        <RecordInterestModal
          onClose={() => {
            setShowInterestModal(false);
            setEditingTransaction(null);
          }}
          onSuccess={(amount, newBalance) => {
            setShowInterestModal(false);
            setEditingTransaction(null);
            setSuccessBanner({ type: 'interest', amount, newBalance });
            setRefreshTrigger(prev => prev + 1);
            setTransactionJustLogged(true);
          }}
          currentBalance={currentBalance}
          interestRate={interestRate}
          editTransaction={editingTransaction}
        />
      )}
    </div>
  );
}

function TransactionLedger({
  transactions,
  onEdit,
  onDelete
}: {
  transactions: HELOCTransaction[];
  onEdit: (t: HELOCTransaction) => void;
  onDelete: (id: string) => void;
}) {
  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Balance'];
    const rows = transactions.map(t => [
      t.date,
      t.type.charAt(0).toUpperCase() + t.type.slice(1),
      t.description,
      t.type === 'payment' ? `-$${t.amount.toFixed(2)}` : `+$${t.amount.toFixed(2)}`,
      `$${t.balance.toFixed(2)}`
    ]);

    const totalDraws = transactions.filter(t => t.type === 'draw').reduce((sum, t) => sum + t.amount, 0);
    const totalPayments = transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
    const totalInterest = transactions.filter(t => t.type === 'interest').reduce((sum, t) => sum + t.amount, 0);
    const currentBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;

    rows.push([]);
    rows.push(['Summary', '', '', '', '']);
    rows.push(['Total Draws', '', '', `$${totalDraws.toFixed(2)}`, '']);
    rows.push(['Total Payments', '', '', `-$${totalPayments.toFixed(2)}`, '']);
    rows.push(['Total Interest', '', '', `$${totalInterest.toFixed(2)}`, '']);
    rows.push(['Current Balance', '', '', '', `$${currentBalance.toFixed(2)}`]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heloc_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortedTransactions = [...transactions].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div>
      {transactions.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={exportCSV}
            className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      )}

      {transactions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No HELOC transactions yet. Record your first draw or payment above.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Amount</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Balance</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-800">
                    {new Date(transaction.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      transaction.type === 'draw' ? 'bg-red-100 text-red-800' :
                      transaction.type === 'payment' ? 'bg-green-100 text-green-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-800">{transaction.description}</td>
                  <td className={`py-3 px-4 text-right font-semibold ${
                    transaction.type === 'payment' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'payment' ? '-' : '+'}{CalculationService.formatCurrency(transaction.amount)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-800">
                    {CalculationService.formatCurrency(transaction.balance)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onEdit(transaction)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(transaction.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecordDrawModal({
  onClose,
  onSuccess,
  currentBalance,
  editTransaction
}: {
  onClose: () => void;
  onSuccess: (amount: number, newBalance: number) => void;
  currentBalance: number;
  editTransaction: HELOCTransaction | null;
}) {
  const [amount, setAmount] = useState(editTransaction?.amount.toString() || '');
  const [date, setDate] = useState(editTransaction?.date || new Date().toISOString().split('T')[0]);
  const [purpose, setPurpose] = useState(editTransaction?.debtLinked ? 'Pay Off Debt' : 'Other');
  const [selectedDebt, setSelectedDebt] = useState(editTransaction?.debtLinked || '');
  const [description, setDescription] = useState(editTransaction?.description || '');
  const [paymentType, setPaymentType] = useState<'minimum' | 'full' | 'custom'>('minimum');

  const debts = StorageService.getDebts().filter(d => !d.isPaidOff);

  const handleDebtSelection = (debtId: string) => {
    setSelectedDebt(debtId);
    if (debtId) {
      const debt = debts.find(d => d.id === debtId);
      if (debt) {
        if (paymentType === 'minimum') {
          setAmount(debt.minimumPayment.toString());
          setDescription(`Paid ${debt.accountName} minimum payment`);
        } else if (paymentType === 'full') {
          setAmount(debt.currentBalance.toString());
          setDescription(`Paid off ${debt.accountName} in full`);
        } else {
          setAmount('');
          setDescription(`Paid toward ${debt.accountName}`);
        }
      }
    }
  };

  const handlePaymentTypeChange = (type: 'minimum' | 'full' | 'custom') => {
    setPaymentType(type);
    if (selectedDebt) {
      const debt = debts.find(d => d.id === selectedDebt);
      if (debt) {
        if (type === 'minimum') {
          setAmount(debt.minimumPayment.toString());
          setDescription(`Paid ${debt.accountName} minimum payment`);
        } else if (type === 'full') {
          setAmount(debt.currentBalance.toString());
          setDescription(`Paid off ${debt.accountName} in full`);
        } else {
          setAmount('');
          setDescription(`Paid toward ${debt.accountName}`);
        }
      }
    }
  };

  const handleSubmit = () => {
    const drawAmount = parseFloat(amount);
    if (!drawAmount || drawAmount <= 0) {
      alert('Please enter a valid draw amount');
      return;
    }

    const transactions: HELOCTransaction[] = JSON.parse(
      localStorage.getItem('novo_heloc_transactions') || '[]'
    );

    const newTransaction: HELOCTransaction = {
      id: editTransaction?.id || `heloc_${Date.now()}`,
      date,
      type: 'draw',
      amount: drawAmount,
      description: description || `HELOC Draw - ${purpose}`,
      debtLinked: selectedDebt || undefined,
      balance: 0
    };

    if (editTransaction) {
      const index = transactions.findIndex(t => t.id === editTransaction.id);
      transactions[index] = newTransaction;
    } else {
      transactions.push(newTransaction);
    }

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    recalculateBalances(transactions);

    localStorage.setItem('novo_heloc_transactions', JSON.stringify(transactions));

    if (selectedDebt && purpose === 'Pay Off Debt') {
      const debt = debts.find(d => d.id === selectedDebt);
      if (debt) {
        const previousBalance = debt.currentBalance;
        const interestCharged = previousBalance * (debt.interestRate / 12 / 100);
        const principalPaid = Math.max(0, drawAmount - interestCharged);
        const newDebtBalance = Math.max(0, previousBalance - principalPaid);

        debt.currentBalance = newDebtBalance;

        if (paymentType === 'full' || newDebtBalance === 0) {
          debt.isPaidOff = true;
          debt.transferredToHELOC = true;
          debt.paidOffDate = date;
          debt.currentBalance = 0;
        }

        const allDebts = StorageService.getDebts();
        const updated = allDebts.map(d => d.id === selectedDebt ? debt : d);
        localStorage.setItem('novo_debts', JSON.stringify(updated));

        const allTransactions = JSON.parse(localStorage.getItem('novo_transactions') || '[]');
        const debtTransaction = {
          id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          debtId: selectedDebt,
          debtName: debt.accountName,
          date,
          type: 'payment',
          amount: drawAmount,
          previousBalance,
          interestCharged,
          principalPaid,
          newBalance: newDebtBalance,
          isExtraPayment: paymentType !== 'minimum' && drawAmount > debt.minimumPayment,
          notes: paymentType === 'full' ? 'Paid off in full with HELOC' : 'Paid from HELOC',
          paidWithHELOC: true,
          transferredToHELOC: paymentType === 'full',
        };
        allTransactions.push(debtTransaction);
        localStorage.setItem('novo_transactions', JSON.stringify(allTransactions));
      }
    }

    const newBalance = currentBalance + drawAmount;
    onSuccess(drawAmount, newBalance);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {editTransaction ? 'Edit' : 'Record'} HELOC Draw
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Record money withdrawn FROM your HELOC (debt payments, living expenses, emergencies, etc.)
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Purpose</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
            >
              <option value="Pay Off Debt">Pay Off Debt</option>
              <option value="Home Improvement">Home Improvement</option>
              <option value="Emergency Expense">Emergency Expense</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {purpose === 'Pay Off Debt' && debts.length > 0 && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select debt to pay</label>
                <select
                  value={selectedDebt}
                  onChange={(e) => handleDebtSelection(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent bg-white"
                >
                  <option value="">Choose a debt...</option>
                  {debts.map(debt => (
                    <option key={debt.id} value={debt.id}>
                      {debt.accountName} - Balance: {CalculationService.formatCurrency(debt.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDebt && (
                <div className="mt-6 pt-6 border-t-2 border-gray-200">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="w-6 h-6 text-[#2D9CDB]" />
                      <h3 className="text-xl font-bold text-gray-900">
                        How much do you want to pay on {debts.find(d => d.id === selectedDebt)?.accountName}?
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 ml-8">
                      Select one of the options below:
                    </p>
                  </div>

                  <div className="space-y-3">
                    {debts.find(d => d.id === selectedDebt) && (
                      <>
                        <label className="flex items-center cursor-pointer p-4 border-2 rounded-xl transition-all hover:bg-blue-50 hover:border-blue-200 has-[:checked]:border-[#2D9CDB] has-[:checked]:border-[3px] has-[:checked]:bg-blue-100 has-[:checked]:shadow-md group">
                          <input
                            type="radio"
                            name="paymentType"
                            checked={paymentType === 'minimum'}
                            onChange={() => handlePaymentTypeChange('minimum')}
                            className="mr-4 h-5 w-5 text-[#2D9CDB] focus:ring-[#2D9CDB] focus:ring-2"
                          />
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-has-[:checked]:bg-[#2D9CDB]">
                              <CreditCard className="w-5 h-5 text-[#2D9CDB] group-has-[:checked]:text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="font-bold text-gray-900 text-base">Pay minimum payment</div>
                              <div className="text-base text-gray-700 font-semibold mt-0.5">
                                {CalculationService.formatCurrency(debts.find(d => d.id === selectedDebt)!.minimumPayment)}
                              </div>
                            </div>
                          </div>
                        </label>

                        <label className="flex items-center cursor-pointer p-4 border-2 rounded-xl transition-all hover:bg-blue-50 hover:border-blue-200 has-[:checked]:border-[#2D9CDB] has-[:checked]:border-[3px] has-[:checked]:bg-blue-100 has-[:checked]:shadow-md group">
                          <input
                            type="radio"
                            name="paymentType"
                            checked={paymentType === 'full'}
                            onChange={() => handlePaymentTypeChange('full')}
                            className="mr-4 h-5 w-5 text-[#2D9CDB] focus:ring-[#2D9CDB] focus:ring-2"
                          />
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-has-[:checked]:bg-green-600">
                              <Wallet className="w-5 h-5 text-green-600 group-has-[:checked]:text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="font-bold text-gray-900 text-base">Pay off in full</div>
                              <div className="text-base text-gray-700 font-semibold mt-0.5">
                                {CalculationService.formatCurrency(debts.find(d => d.id === selectedDebt)!.currentBalance)}
                              </div>
                            </div>
                          </div>
                        </label>

                        <label className="flex items-center cursor-pointer p-4 border-2 rounded-xl transition-all hover:bg-blue-50 hover:border-blue-200 has-[:checked]:border-[#2D9CDB] has-[:checked]:border-[3px] has-[:checked]:bg-blue-100 has-[:checked]:shadow-md group">
                          <input
                            type="radio"
                            name="paymentType"
                            checked={paymentType === 'custom'}
                            onChange={() => handlePaymentTypeChange('custom')}
                            className="mr-4 h-5 w-5 text-[#2D9CDB] focus:ring-[#2D9CDB] focus:ring-2"
                          />
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center group-has-[:checked]:bg-amber-500">
                              <PenLine className="w-5 h-5 text-amber-600 group-has-[:checked]:text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="font-bold text-gray-900 text-base">Enter custom amount</div>
                              <div className="text-sm text-gray-600 mt-0.5">Specify your own payment amount</div>
                            </div>
                          </div>
                        </label>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Draw Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-600">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                placeholder="0.00"
                step="0.01"
                disabled={purpose === 'Pay Off Debt' && selectedDebt && paymentType !== 'custom'}
              />
            </div>
            {purpose === 'Pay Off Debt' && selectedDebt && paymentType !== 'custom' && (
              <p className="text-xs text-gray-500 mt-1">Amount auto-filled based on payment type selected above</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
              placeholder="Used HELOC to pay off Capital One credit card"
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {editTransaction ? 'Update' : 'Record'} Draw
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordPaymentModal({
  onClose,
  onSuccess,
  currentBalance,
  editTransaction
}: {
  onClose: () => void;
  onSuccess: (amount: number, newBalance: number) => void;
  currentBalance: number;
  editTransaction: HELOCTransaction | null;
}) {
  const [amount, setAmount] = useState(editTransaction?.amount.toString() || '');
  const [date, setDate] = useState(editTransaction?.date || new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(editTransaction?.description || '');

  const paymentAmount = parseFloat(amount) || 0;
  const newBalance = Math.max(0, currentBalance - paymentAmount);

  const handleSubmit = () => {
    if (!paymentAmount || paymentAmount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const transactions: HELOCTransaction[] = JSON.parse(
      localStorage.getItem('novo_heloc_transactions') || '[]'
    );

    const newTransaction: HELOCTransaction = {
      id: editTransaction?.id || `heloc_${Date.now()}`,
      date,
      type: 'payment',
      amount: paymentAmount,
      description: description || 'Income deposit',
      balance: 0
    };

    if (editTransaction) {
      const index = transactions.findIndex(t => t.id === editTransaction.id);
      transactions[index] = newTransaction;
    } else {
      transactions.push(newTransaction);
    }

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    recalculateBalances(transactions);

    localStorage.setItem('novo_heloc_transactions', JSON.stringify(transactions));

    onSuccess(paymentAmount, newBalance);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {editTransaction ? 'Edit' : 'Record'} HELOC Payment
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Record money deposited INTO your HELOC (paychecks, bonuses, tax refunds, etc.)
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-600">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                placeholder="0.00"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
              placeholder="Paycheck deposit"
            />
          </div>

          {paymentAmount > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Previous Balance:</span>
                <span className="font-semibold text-gray-800">{CalculationService.formatCurrency(currentBalance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment:</span>
                <span className="font-semibold text-green-600">-{CalculationService.formatCurrency(paymentAmount)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                <span className="text-gray-800 font-semibold">New Balance:</span>
                <span className="font-bold text-gray-800">{CalculationService.formatCurrency(newBalance)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 bg-[#27AE60] hover:bg-[#229954] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {editTransaction ? 'Update' : 'Record'} Payment
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordInterestModal({
  onClose,
  onSuccess,
  currentBalance,
  interestRate,
  editTransaction
}: {
  onClose: () => void;
  onSuccess: (amount: number, newBalance: number) => void;
  currentBalance: number;
  interestRate: number;
  editTransaction: HELOCTransaction | null;
}) {
  const currentDate = new Date();
  const [month, setMonth] = useState(editTransaction?.date.substring(0, 7) || currentDate.toISOString().substring(0, 7));
  const [manualAmount, setManualAmount] = useState(editTransaction?.amount.toString() || '');
  const [useManual, setUseManual] = useState(!!editTransaction);

  const autoCalculatedInterest = currentBalance * (interestRate / 12 / 100);
  const interestAmount = useManual && manualAmount ? parseFloat(manualAmount) : autoCalculatedInterest;

  const lastDayOfMonth = new Date(month + '-01');
  lastDayOfMonth.setMonth(lastDayOfMonth.getMonth() + 1);
  lastDayOfMonth.setDate(0);
  const date = editTransaction?.date || lastDayOfMonth.toISOString().split('T')[0];

  const handleSubmit = () => {
    if (!interestAmount || interestAmount <= 0) {
      alert('Please enter a valid interest amount');
      return;
    }

    const transactions: HELOCTransaction[] = JSON.parse(
      localStorage.getItem('novo_heloc_transactions') || '[]'
    );

    const newTransaction: HELOCTransaction = {
      id: editTransaction?.id || `heloc_${Date.now()}`,
      date,
      type: 'interest',
      amount: interestAmount,
      description: `Monthly interest for ${new Date(month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      balance: 0
    };

    if (editTransaction) {
      const index = transactions.findIndex(t => t.id === editTransaction.id);
      transactions[index] = newTransaction;
    } else {
      transactions.push(newTransaction);
    }

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    recalculateBalances(transactions);

    localStorage.setItem('novo_heloc_transactions', JSON.stringify(transactions));

    const newBalance = currentBalance + interestAmount;
    onSuccess(interestAmount, newBalance);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {editTransaction ? 'Edit' : 'Record'} Interest Charge
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">For the month of:</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current Balance:</span>
              <span className="font-semibold text-gray-800">{CalculationService.formatCurrency(currentBalance)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Interest Rate:</span>
              <span className="font-semibold text-gray-800">{interestRate.toFixed(2)}% APR</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
              <span className="text-gray-800 font-semibold">Auto-calculated Interest:</span>
              <span className="font-bold text-gray-800">{CalculationService.formatCurrency(autoCalculatedInterest)}</span>
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2 text-sm text-gray-700 mb-2">
              <input
                type="checkbox"
                checked={useManual}
                onChange={(e) => setUseManual(e.target.checked)}
                className="rounded"
              />
              <span>Manual override (enter exact amount from statement)</span>
            </label>
            {useManual && (
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-600">$</span>
                <input
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 bg-[#F2994A] hover:bg-[#E67E22] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {editTransaction ? 'Update' : 'Record'} Interest
          </button>
        </div>
      </div>
    </div>
  );
}

function recalculateBalances(transactions: HELOCTransaction[]) {
  const homeEquity = StorageService.getHomeEquity();
  let runningBalance = homeEquity.hasHELOC && homeEquity.helocBalance !== undefined
    ? homeEquity.helocBalance
    : 0;

  transactions.forEach(transaction => {
    if (transaction.type === 'draw' || transaction.type === 'interest') {
      runningBalance += transaction.amount;
    } else if (transaction.type === 'payment') {
      runningBalance -= transaction.amount;
    }
    runningBalance = Math.max(0, runningBalance);
    transaction.balance = Math.round(runningBalance * 100) / 100;
  });
}
