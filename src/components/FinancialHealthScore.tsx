import { useMemo } from 'react';

const PAYMENT_COMMITMENTS_KEY = 'novo_payment_commitments';

export interface FinancialHealthScoreInput {
  monthlyGrossIncome: number;
  totalMinimumPayments: number;
  monthlySurplus: number | null;
  debtProgressPercent: number;
  monthlySavingsGoal: number;
  monthlySavingsRate: number;
}

export interface FinancialHealthScoreResult {
  score: number;
  label: string;
  actionLine: string;
  colorClass: string;
  strokeColor: string;
}

function countPaymentCommitments(): number {
  try {
    const raw = localStorage.getItem(PAYMENT_COMMITMENTS_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.keys(parsed).length;
  } catch {
    return 0;
  }
}

function scoreDti(dtiPercent: number): number {
  if (dtiPercent < 36) return 30;
  if (dtiPercent < 43) return 20;
  if (dtiPercent < 50) return 10;
  return 0;
}

function scoreCashFlow(surplus: number): number {
  if (surplus > 500) return 25;
  if (surplus > 200) return 15;
  if (surplus > 0) return 8;
  return 0;
}

function scoreDebtProgress(progressPercent: number): number {
  const clamped = Math.min(100, Math.max(0, progressPercent));
  return (clamped / 100) * 25;
}

function scoreSmarterPayments(): number {
  return countPaymentCommitments() > 0 ? 10 : 0;
}

function scoreSavings(monthlySavingsGoal: number, monthlySavingsRate: number): number {
  if (monthlySavingsGoal > 0 && monthlySavingsRate >= monthlySavingsGoal) return 10;
  if (monthlySavingsGoal > 0) return 5;
  return 0;
}

function getLabelAndColors(score: number): {
  label: string;
  colorClass: string;
  strokeColor: string;
} {
  if (score >= 86) {
    return { label: 'Excellent', colorClass: 'text-emerald-600', strokeColor: '#16a34a' };
  }
  if (score >= 66) {
    return { label: 'On Track', colorClass: 'text-[#2D9CDB]', strokeColor: '#2D9CDB' };
  }
  if (score >= 41) {
    return { label: 'Building Momentum', colorClass: 'text-orange-600', strokeColor: '#ea580c' };
  }
  return { label: 'Needs Work', colorClass: 'text-red-600', strokeColor: '#dc2626' };
}

function getTopActionLine(input: {
  dtiPercent: number;
  dtiPoints: number;
  cashFlowPoints: number;
  monthlySurplus: number;
  smarterPaymentsPoints: number;
  savingsPoints: number;
  monthlySavingsGoal: number;
  totalScore: number;
}): string {
  if (input.totalScore >= 86) {
    return 'Your finances are in excellent shape - keep it up';
  }

  const opportunities: { message: string; gain: number }[] = [];

  if (input.smarterPaymentsPoints < 10) {
    opportunities.push({ message: 'Switch to bi-weekly payments to gain 10 points', gain: 10 });
  }

  if (input.savingsPoints < 10) {
    if (input.monthlySavingsGoal <= 0) {
      opportunities.push({ message: 'Set a monthly savings goal to gain 5 points', gain: 5 });
    } else if (input.savingsPoints < 10) {
      opportunities.push({ message: 'Meet your monthly savings goal to gain 5 points', gain: 5 });
    }
  }

  if (input.dtiPoints < 30) {
    if (input.dtiPercent >= 50) {
      opportunities.push({ message: 'Reduce your DTI below 50% to gain 10 points', gain: 10 });
    } else if (input.dtiPercent >= 43) {
      opportunities.push({ message: 'Reduce your DTI below 43% to gain 10 points', gain: 10 });
    } else if (input.dtiPercent >= 36) {
      opportunities.push({ message: 'Reduce your DTI below 36% to gain 10 points', gain: 10 });
    }
  }

  if (input.cashFlowPoints < 25) {
    if (input.monthlySurplus <= 0) {
      opportunities.push({ message: 'Improve monthly cash flow above $0 to gain 8 points', gain: 8 - input.cashFlowPoints });
    } else if (input.monthlySurplus <= 200) {
      opportunities.push({
        message: 'Build monthly surplus over $200 to gain 7 points',
        gain: 15 - input.cashFlowPoints,
      });
    } else if (input.monthlySurplus <= 500) {
      opportunities.push({
        message: 'Build monthly surplus over $500 to gain 10 points',
        gain: 25 - input.cashFlowPoints,
      });
    }
  }

  if (opportunities.length === 0) {
    return 'Keep paying down debt and maintaining positive cash flow to improve your score';
  }

  opportunities.sort((a, b) => b.gain - a.gain);
  return opportunities[0].message;
}

export function computeFinancialHealthScore(input: FinancialHealthScoreInput): FinancialHealthScoreResult {
  const dtiPercent =
    input.monthlyGrossIncome > 0
      ? (input.totalMinimumPayments / input.monthlyGrossIncome) * 100
      : 100;

  const monthlySurplus = input.monthlySurplus ?? -1;
  const dtiPoints = scoreDti(dtiPercent);
  const cashFlowPoints = scoreCashFlow(monthlySurplus);
  const debtPoints = scoreDebtProgress(input.debtProgressPercent);
  const smarterPaymentsPoints = scoreSmarterPayments();
  const savingsPoints = scoreSavings(input.monthlySavingsGoal, input.monthlySavingsRate);

  const rawScore =
    dtiPoints + cashFlowPoints + debtPoints + smarterPaymentsPoints + savingsPoints;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  const { label, colorClass, strokeColor } = getLabelAndColors(score);
  const actionLine = getTopActionLine({
    dtiPercent,
    dtiPoints,
    cashFlowPoints,
    monthlySurplus,
    smarterPaymentsPoints,
    savingsPoints,
    monthlySavingsGoal: input.monthlySavingsGoal,
    totalScore: score,
  });

  return { score, label, actionLine, colorClass, strokeColor };
}

interface FinancialHealthScoreProps {
  monthlyGrossIncome: number;
  totalMinimumPayments: number;
  monthlySurplus: number | null;
  debtProgressPercent: number;
  monthlySavingsGoal: number;
  monthlySavingsRate: number;
}

export default function FinancialHealthScore({
  monthlyGrossIncome,
  totalMinimumPayments,
  monthlySurplus,
  debtProgressPercent,
  monthlySavingsGoal,
  monthlySavingsRate,
}: FinancialHealthScoreProps) {
  const result = useMemo(
    () =>
      computeFinancialHealthScore({
        monthlyGrossIncome,
        totalMinimumPayments,
        monthlySurplus,
        debtProgressPercent,
        monthlySavingsGoal,
        monthlySavingsRate,
      }),
    [
      monthlyGrossIncome,
      totalMinimumPayments,
      monthlySurplus,
      debtProgressPercent,
      monthlySavingsGoal,
      monthlySavingsRate,
    ]
  );

  const arcRadius = 52;
  const arcLength = Math.PI * arcRadius;
  const progress = result.score / 100;
  const dashOffset = arcLength * (1 - progress);

  return (
    <div className="bg-white border border-[#e8d8c4]/60 rounded-2xl p-6" style={{ boxShadow: '0 1px 3px rgba(30,58,95,0.06), 0 4px 12px rgba(30,58,95,0.04)' }}>
      <p className="text-sm font-semibold text-[#1E3A5F]/50 uppercase tracking-wide text-center mb-4">
        Monthly Financial Health Score
      </p>
      <div className="flex flex-col items-center">
        <div className="relative w-40 h-28 mb-2">
          <svg viewBox="0 0 120 70" className="w-full h-full" aria-hidden>
            <path
              d="M 10 60 A 50 50 0 0 1 110 60"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 10 60 A 50 50 0 0 1 110 60"
              fill="none"
              stroke={result.strokeColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${arcLength}`}
              strokeDashoffset={dashOffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-end justify-center pb-1">
            <span className={`text-4xl font-bold tabular-nums ${result.colorClass}`}>{result.score}</span>
          </div>
        </div>
        <p className={`text-lg font-semibold ${result.colorClass}`}>{result.label}</p>
        <p className="text-sm text-gray-600 text-center mt-3 max-w-md leading-relaxed">{result.actionLine}</p>
      </div>
    </div>
  );
}
