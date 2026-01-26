import { AlertTriangle, ArrowLeft, Mail, Phone } from 'lucide-react';
import { CalculationService } from '../services/calculations';

interface CashFlowWarningModalProps {
  cashFlow: number;
  onContinue: () => void;
  onReviewExpenses: () => void;
  onContactCoach: () => void;
}

export default function CashFlowWarningModal({
  cashFlow,
  onContinue,
  onReviewExpenses,
  onContactCoach,
}: CashFlowWarningModalProps) {
  const isNegative = cashFlow < 0;
  const isLow = cashFlow >= 0 && cashFlow < 500;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-sm" onClick={onContinue} />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-300">
        <div className="flex items-start gap-4 mb-6">
          <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
            isNegative ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            <AlertTriangle className={`w-6 h-6 ${isNegative ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isNegative ? '🚨 Budget Alert' : '⚠️ Cash Flow Alert'}
            </h2>
            <p className="text-gray-600">
              {isNegative
                ? 'Your expenses exceed your income.'
                : 'You may have limited cash flow for debt acceleration.'}
            </p>
          </div>
        </div>

        <div className={`rounded-lg p-4 mb-6 ${
          isNegative ? 'bg-red-50 border-2 border-red-200' : 'bg-amber-50 border-2 border-amber-200'
        }`}>
          <div className="text-center">
            <p className="text-sm text-gray-700 mb-2">Your estimated available cash flow:</p>
            <p className={`text-4xl font-bold ${isNegative ? 'text-red-700' : 'text-amber-700'}`}>
              {CalculationService.formatCurrency(cashFlow)}
            </p>
            <p className="text-xs text-gray-600 mt-1">(Net Income - Essential - Discretionary)</p>
          </div>
        </div>

        {isNegative ? (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-800 font-semibold mb-2">
                ⚠️ Your current budget shows a deficit
              </p>
              <p className="text-sm text-gray-700 mb-3">
                Before proceeding, please review your income and expenses to ensure they're accurate.
                A negative cash flow means you're spending more than you earn, which makes debt payoff impossible without adjustments.
              </p>
              <p className="text-sm text-gray-700">
                <strong>Next steps:</strong>
              </p>
              <ul className="text-sm text-gray-700 mt-2 space-y-1 list-disc list-inside ml-2">
                <li>Double-check your income amounts</li>
                <li>Review your expense categories</li>
                <li>Identify areas where you can reduce spending</li>
                <li>Contact a coach for personalized guidance</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-800 font-semibold mb-2">
                💡 How NOVO Works Best
              </p>
              <p className="text-sm text-gray-700 mb-2">
                NOVO's debt acceleration strategies work best when you have at least <strong>$500/month</strong> available
                after basic expenses. With less than this, debt payoff strategies have limited impact.
              </p>
              <p className="text-sm text-gray-700">
                <strong>Your options:</strong>
              </p>
              <ul className="text-sm text-gray-700 mt-2 space-y-1 list-disc list-inside ml-2">
                <li>Continue anyway (we'll help you find opportunities)</li>
                <li>Review your expenses to increase cash flow</li>
                <li>Reduce discretionary spending by 20-30%</li>
                <li>Contact a coach for personalized strategies</li>
              </ul>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-4 mt-6">
          <p className="text-sm font-semibold text-emerald-900 mb-2">📞 Need Help?</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-emerald-800">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <a href="mailto:ben@windmillmortgage.com" className="hover:underline font-medium">
                ben@windmillmortgage.com
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-800">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <a href="tel:614-327-2213" className="hover:underline font-medium">
                614-327-2213
              </a>
            </div>
            <p className="text-xs text-emerald-700 mt-2">
              Ben Hulshof - Personal Financial Coach
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-6">
          {!isNegative && (
            <button
              onClick={onContinue}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-all"
            >
              Continue Anyway
            </button>
          )}

          <button
            onClick={onReviewExpenses}
            className="w-full bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 px-6 rounded-lg border-2 border-gray-300 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Review My Expenses
          </button>

          <button
            onClick={onContactCoach}
            className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold py-3 px-6 rounded-lg border-2 border-emerald-300 transition-all"
          >
            Contact Coach
          </button>
        </div>
      </div>
    </div>
  );
}
