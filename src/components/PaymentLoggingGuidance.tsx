import { useEffect, useState } from 'react';
import { CalculationService } from '../services/calculations';
import {
  formatCommitmentDueDate,
  formatFrequencyLabel,
  getCommitmentFollowUpMessage,
  getNextCommitmentDueDate,
  loadPaymentCommitments,
  paymentAmountForFrequency,
  type PaymentFrequency,
} from '../utils/paymentCalculations';

export type PaymentGuidanceSelection = 'commitment' | 'minimum' | 'recommended';

interface PaymentLoggingGuidanceProps {
  debtId: string;
  minimumPayment: number;
  onSelectAmount: (amount: number, source: PaymentGuidanceSelection) => void;
}

function isAcceleratedCommitment(
  frequency: PaymentFrequency
): frequency is Exclude<PaymentFrequency, 'monthly'> {
  return frequency === 'biweekly' || frequency === 'weekly';
}

export default function PaymentLoggingGuidance({
  debtId,
  minimumPayment,
  onSelectAmount,
}: PaymentLoggingGuidanceProps) {
  const [showRecommendedFollowUp, setShowRecommendedFollowUp] = useState(false);

  useEffect(() => {
    setShowRecommendedFollowUp(false);
  }, [debtId]);

  const commitment = loadPaymentCommitments()[debtId];
  const guidance = CalculationService.getPaymentGuidance(debtId);
  const hasCommitment =
    commitment != null && isAcceleratedCommitment(commitment.frequency);

  if (!guidance && !hasCommitment) {
    return null;
  }

  const suggestedAmount = hasCommitment
    ? Math.round(
        paymentAmountForFrequency(minimumPayment, commitment.frequency) * 100
      ) / 100
    : null;
  const frequencyLabel = hasCommitment
    ? formatFrequencyLabel(commitment.frequency)
    : '';
  const nextDueDate = hasCommitment
    ? getNextCommitmentDueDate(commitment.committedAt, commitment.frequency)
    : null;
  const isFocusWithExtra =
    Boolean(guidance?.isPriority) &&
    (guidance?.extraAmount ?? 0) > 0 &&
    (guidance?.recommendedPayment ?? 0) > minimumPayment;

  const logCommitmentLabel = hasCommitment
    ? `Log ${frequencyLabel} Payment: ${CalculationService.formatCurrencyDetailed(suggestedAmount!)}`
    : null;

  return (
    <div className={`${hasCommitment ? 'bg-teal-50 border-l-4 border-teal-500' : 'bg-blue-50 border-l-4 border-blue-500'} p-4 rounded-r`}>
      <h4 className={`font-semibold mb-2 text-sm ${hasCommitment ? 'text-teal-900' : 'text-blue-900'}`}>
        {hasCommitment ? '✓ Smarter Payments commitment active' : 'Payment coaching'}
      </h4>

      {hasCommitment && suggestedAmount != null && nextDueDate && (
        <>
          <p className="text-sm text-teal-900 leading-relaxed mb-2">
            You committed to <strong>{frequencyLabel}</strong> payments on this debt. Your next scheduled payment of{' '}
            <strong>{CalculationService.formatCurrencyDetailed(suggestedAmount)}</strong> is due around{' '}
            <strong>{formatCommitmentDueDate(nextDueDate)}</strong>.
          </p>
          <p className="text-xs text-teal-700 leading-relaxed mb-2">
            💡 After logging this payment, consider adding extra principal whenever you have spare cash to accelerate your payoff further.
          </p>
        </>
      )}

      {hasCommitment && isFocusWithExtra && (
        <p className="text-sm text-blue-900 leading-relaxed mb-2">
          You&apos;re also applying extra cash flow to this debt — paying more today accelerates
          your payoff.
        </p>
      )}

      {guidance && !hasCommitment && guidance.hasStrategy && guidance.isPriority && (
        <p className="text-sm text-blue-900 leading-relaxed mb-2">
          This is your focus debt right now — extra dollars here save you the most interest.
        </p>
      )}

      {guidance && (
        <div className="space-y-1.5 text-sm text-blue-800 mb-3">
          <div className="flex justify-between gap-2">
            <span>Minimum due</span>
            <span className="font-semibold text-blue-900">
              {CalculationService.formatCurrency(guidance.minimumPayment)}
            </span>
          </div>
          {guidance.hasStrategy && guidance.recommendedPayment > guidance.minimumPayment && (
            <div className="flex justify-between gap-2">
              <span>Recommended today</span>
              <span className="font-bold text-blue-900">
                {CalculationService.formatCurrency(guidance.recommendedPayment)}
              </span>
            </div>
          )}
        </div>
      )}

      {showRecommendedFollowUp && hasCommitment && (
        <p className="text-sm text-blue-800 bg-blue-100/80 border border-blue-200 rounded-md px-3 py-2 mb-3 leading-relaxed">
          {getCommitmentFollowUpMessage(commitment.frequency)}
        </p>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        {hasCommitment && suggestedAmount != null && logCommitmentLabel && (
          <button
            type="button"
            onClick={() => {
              setShowRecommendedFollowUp(false);
              onSelectAmount(suggestedAmount, 'commitment');
            }}
            className="flex-1 min-w-[140px] bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-3 px-3 rounded-md transition-colors shadow-sm"
          >
            {logCommitmentLabel}
          </button>
        )}
        {guidance?.hasStrategy && (
          <button
            type="button"
            onClick={() => {
              setShowRecommendedFollowUp(false);
              onSelectAmount(guidance.minimumPayment, 'minimum');
            }}
            className="flex-1 min-w-[140px] bg-white hover:bg-gray-50 text-blue-700 text-xs font-semibold py-2.5 px-3 rounded border border-blue-300 transition-colors"
          >
            Pay Minimum: {CalculationService.formatCurrency(guidance.minimumPayment)}
          </button>
        )}
        {guidance &&
          guidance.hasStrategy &&
          guidance.recommendedPayment > guidance.minimumPayment && (
            <button
              type="button"
              onClick={() => {
                onSelectAmount(guidance.recommendedPayment, 'recommended');
                if (hasCommitment) {
                  setShowRecommendedFollowUp(true);
                }
              }}
              className="flex-1 min-w-[140px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 px-3 rounded-md transition-colors"
            >
              Pay Recommended: {CalculationService.formatCurrency(guidance.recommendedPayment)}
            </button>
          )}
      </div>
    </div>
  );
}
