import { PartyPopper, TrendingUp } from 'lucide-react';
import { CalculationService } from '../services/calculations';

interface CelebrationModalProps {
  debtName: string;
  debtAmount: number;
  freedPayment: number;
  previousCashFlow?: number;
  onViewPlan: () => void;
}

export default function CelebrationModal({
  debtName,
  debtAmount,
  freedPayment,
  previousCashFlow,
  onViewPlan,
}: CelebrationModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8 animate-fade-in">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#27AE60] to-[#229954] rounded-full mb-4 animate-bounce">
            <PartyPopper className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">
            Congratulations!
          </h2>
          <p className="text-xl text-gray-700 mb-2">
            You've paid off <span className="font-bold text-[#27AE60]">{debtName}</span>!
          </p>
        </div>

        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-6 mb-6">
          <div className="space-y-4">
            <div className="text-center pb-4 border-b-2 border-emerald-200">
              <p className="text-sm text-gray-600 mb-1">Total Debt Eliminated</p>
              <p className="text-3xl font-bold text-[#27AE60]">
                {CalculationService.formatCurrency(debtAmount)}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 bg-white rounded-lg p-4">
              <TrendingUp className="w-8 h-8 text-[#2D9CDB]" />
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Monthly Payment Now Free</p>
                <p className="text-2xl font-bold text-[#2D9CDB]">
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
                    <span className="font-semibold text-[#27AE60]">+{CalculationService.formatCurrency(freedPayment)}</span>
                  </div>
                  <div className="pt-2 border-t-2 border-blue-200 flex justify-between">
                    <span className="text-gray-700 font-bold">New cash flow:</span>
                    <span className="font-bold text-[#2D9CDB] text-lg">{CalculationService.formatCurrency(previousCashFlow + freedPayment)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gradient-to-r from-[#2D9CDB]/10 to-[#27AE60]/10 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-700 font-semibold">
                Your <span className="text-[#2D9CDB]">{CalculationService.formatCurrency(freedPayment)}</span> monthly payment now goes toward your next debt using the debt snowball method!
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onViewPlan}
          className="w-full bg-gradient-to-r from-[#27AE60] to-[#229954] hover:from-[#229954] hover:to-[#1D7F44] text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg text-lg"
        >
          See Updated Plan
        </button>
      </div>
    </div>
  );
}
