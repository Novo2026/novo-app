/**
 * Display helpers for debt paydown progress.
 * Does not mutate startingBalance / currentBalance — display only.
 */

export type DebtPaydownDisplay = {
  /** True when current balance exceeds the original starting balance. */
  balanceIncreased: boolean;
  /** How much above starting balance (0 if not increased). */
  increaseAmount: number;
  /** Amount paid down vs starting, floored at 0. */
  paidOffAmount: number;
  /** Progress % vs starting, clamped to 0–100. */
  progressPercent: number;
};

export function getDebtPaydownDisplay(
  startingBalance: number,
  currentBalance: number
): DebtPaydownDisplay {
  const delta = startingBalance - currentBalance;
  const balanceIncreased = startingBalance > 0 && currentBalance > startingBalance;

  return {
    balanceIncreased,
    increaseAmount: balanceIncreased ? currentBalance - startingBalance : 0,
    paidOffAmount: Math.max(0, delta),
    progressPercent:
      startingBalance > 0
        ? Math.min(100, Math.max(0, (delta / startingBalance) * 100))
        : 0,
  };
}
