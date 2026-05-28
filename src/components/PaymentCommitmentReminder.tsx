import { CalendarClock } from 'lucide-react';
import { CalculationService } from '../services/calculations';
import {
  formatFrequencyLabel,
  loadPaymentCommitments,
  paymentAmountForFrequency,
} from '../utils/paymentCalculations';

interface PaymentCommitmentReminderProps {
  debtId: string;
  minimumPayment: number;
  onSelectSuggestedAmount: (amount: number) => void;
}

export default function PaymentCommitmentReminder({
  debtId,
  minimumPayment,
  onSelectSuggestedAmount,
}: PaymentCommitmentReminderProps) {
  const commitment = loadPaymentCommitments()[debtId];
  if (!commitment || commitment.frequency === 'monthly') {
    return null;
  }

  const suggestedAmount =
    Math.round(
      paymentAmountForFrequency(minimumPayment, commitment.frequency) * 100
    ) / 100;
  const frequencyLabel = formatFrequencyLabel(commitment.frequency);

  return (
    <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-3">
      <div className="flex items-start gap-2">
        <CalendarClock className="w-4 h-4 text-teal-700 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-teal-900 leading-snug flex-1">
          You committed to {frequencyLabel} payments on this debt. Your suggested payment
          amount is {CalculationService.formatCurrencyDetailed(suggestedAmount)}.
        </p>
      </div>
      <button
        type="button"
        onClick={() => onSelectSuggestedAmount(suggestedAmount)}
        className="mt-2 w-full sm:w-auto text-sm font-semibold px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white transition-colors"
      >
        Use {CalculationService.formatCurrencyDetailed(suggestedAmount)}
      </button>
    </div>
  );
}
