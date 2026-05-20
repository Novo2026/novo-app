import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { CalculationService } from '../services/calculations';
import type { Debt } from '../types';
import NovoChat, { CHAT_CONTEXT } from './NovoChat';

const BEN_BOOKING_URL =
  'https://api.leadconnectorhq.com/widget/booking/Ms28gTzPwpR5BbzeU0Dc';

export { CHAT_CONTEXT };

export interface HelocTacticalImpact {
  interestSavings: number;
  freedCashFlow: number;
  targetSpendingCuts: number;
  totalMonthlyToHELOC: number;
  monthsToPayoffHELOC: number;
}

interface MyPlanProps {
  cashFlowAfterMinimums: number;
  highestRateDebt: Debt | undefined;
  helocRate: number;
  helocTacticalImpact: HelocTacticalImpact | null;
  hasHELOCAccount: boolean;
}

export default function MyPlan({
  cashFlowAfterMinimums,
  highestRateDebt,
  helocRate,
  helocTacticalImpact,
  hasHELOCAccount,
}: MyPlanProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState('');

  const openChat = (context: string) => {
    setChatContext(context);
    setChatOpen(true);
  };

  return (
    <>
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
              To unlock NOVO&apos;s debt acceleration strategies, you need positive cash flow of at least $200-500/month.
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
                    <p className="text-lg font-bold text-gray-900">
                      {CalculationService.formatCurrency(highestRateDebt.currentBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Minimum Payment</p>
                    <p className="text-lg font-bold text-gray-900">
                      {CalculationService.formatCurrency(highestRateDebt.minimumPayment)}/mo
                    </p>
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
                    <p>
                      Draw {CalculationService.formatCurrency(highestRateDebt.currentBalance)} from HELOC ({helocRate.toFixed(2)}% rate)
                    </p>
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
                    <span>
                      Trade {highestRateDebt.interestRate.toFixed(2)}% interest for {helocRate.toFixed(2)}% (save{' '}
                      {helocTacticalImpact.interestSavings.toFixed(2)}% on that balance)
                    </span>
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
                type="button"
                onClick={() => openChat(CHAT_CONTEXT.helocStrategy)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                Show My HELOC Strategy
              </button>
              <button
                type="button"
                onClick={() => openChat(CHAT_CONTEXT.learnMore)}
                className="bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 px-6 rounded-lg border-2 border-gray-300 transition-all"
              >
                {hasHELOCAccount ? 'Learn More' : "I Don't Have HELOC"}
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

        <div className="bg-white border-2 border-[#1E3A5F]/20 rounded-xl p-6 mb-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-[#1E3A5F] mb-4">Want to talk through your numbers with Ben?</p>
          <a
            href={BEN_BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#FF6B35] hover:bg-[#e85a28] text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm shadow-md"
          >
            Schedule a Strategy Call with Ben
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => openChat(CHAT_CONTEXT.updateBudget)}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-all"
          >
            Update My Budget
          </button>
          <button
            type="button"
            onClick={() => openChat(CHAT_CONTEXT.reduceExpenses)}
            className="bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 px-6 rounded-lg border-2 border-gray-300 transition-all"
          >
            Reduce Expenses
          </button>
          <button
            type="button"
            onClick={() => openChat(CHAT_CONTEXT.addIncome)}
            className="bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 px-6 rounded-lg border-2 border-gray-300 transition-all"
          >
            Add Income Source
          </button>
        </div>
      </div>

      <NovoChat open={chatOpen} onClose={() => setChatOpen(false)} context={chatContext} />
    </>
  );
}
