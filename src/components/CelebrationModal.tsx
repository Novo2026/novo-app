import { PartyPopper, TrendingUp, Zap } from 'lucide-react';
import { CalculationService } from '../services/calculations';

interface CelebrationModalProps {
  debtName: string;
  debtAmount: number;
  freedPayment: number;
  previousCashFlow?: number;
  nextDebtName?: string;
  monthsSavedByAcceleration?: number;
  onViewPlan: () => void;
}

export default function CelebrationModal({
  debtName,
  debtAmount,
  freedPayment,
  previousCashFlow,
  nextDebtName,
  monthsSavedByAcceleration,
  onViewPlan,
}: CelebrationModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8 animate-fade-in">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-brand-green to-[#229954] rounded-full mb-4 animate-bounce">
            <PartyPopper className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">
            Congratulations!
          </h2>
          <p className="text-xl text-gray-700 mb-2">
            You've paid off <span className="font-bold text-brand-green">{debtName}</span>!
          </p>
        </div>

        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-6 mb-6">
          <div className="space-y-4">
            <div className="text-center pb-4 border-b-2 border-emerald-200">
              <p className="text-sm text-gray-600 mb-1">Total Debt Eliminated</p>
              <p className="text-3xl font-bold text-brand-green">
                {CalculationService.formatCurrency(debtAmount)}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 bg-white rounded-lg p-4">
              <TrendingUp className="w-8 h-8 text-brand-blue" />
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Monthly Payment Now Free</p>
                <p className="text-2xl font-bold text-brand-blue">
                  {CalculationService.formatCurrency(freedPayment)}
                </p>
              </div>
            </div>

            {previousCashFlow !== undefined && (
              <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 border-2 border-blue-200">
                <p className="text-sm text-gray-700 font-semibold text-center mb-3">Cash Flow Impact</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Previous cash flow:</span>
                    <span className="font-semibold text-gray-800">{CalculationService.formatCurrency(previousCashFlow)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Freed payment:</span>
                    <span className="font-semibold text-brand-green">+{CalculationService.formatCurrency(freedPayment)}</span>
                  </div>
                  <div className="pt-2 border-t-2 border-blue-200 flex justify-between">
                    <span className="text-gray-700 font-bold">New cash flow:</span>
                    <span className="font-bold text-brand-blue text-lg">{CalculationService.formatCurrency(previousCashFlow + freedPayment)}</span>
                  </div>
                </div>
              </div>
            )}

            {nextDebtName && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border-2 border-amber-300">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900 mb-1">Snowball Acceleration Applied!</p>
                    <p className="text-sm text-amber-800">
                      <span className="font-semibold">{CalculationService.formatCurrency(freedPayment)}/month</span> is now being applied to{' '}
                      <span className="font-semibold">{nextDebtName}</span>
                      {monthsSavedByAcceleration && monthsSavedByAcceleration > 0 ? (
                        <>
                          {' '}— which now pays off{' '}
                          <span className="font-bold text-amber-900">
                            {monthsSavedByAcceleration} month{monthsSavedByAcceleration !== 1 ? 's' : ''} sooner!
                          </span>
                        </>
                      ) : '.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!nextDebtName && (
              <div className="bg-gradient-to-r from-brand-blue/10 to-brand-green/10 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-700 font-semibold">
                  Your <span className="text-brand-blue">{CalculationService.formatCurrency(freedPayment)}</span> monthly payment now goes toward your next debt using the debt snowball method!
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onViewPlan}
          className="w-full bg-gradient-to-r from-brand-green to-[#229954] hover:from-[#229954] hover:to-[#1D7F44] text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg text-lg"
        >
          See Updated Plan
        </button>
      </div>
    </div>
  );
}
