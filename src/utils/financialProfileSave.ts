import type { FinancialProfile } from '../types';
import { StorageService } from '../services/storage';

const PROFILE_CHANGE_CONFIRM =
  "You're changing your financial profile. This affects your debt payoff plan, surplus calculations, and Ask Novo's advice throughout the app. Continue?";

const COMPARE_FIELDS = [
  'monthlyGrossIncome',
  'monthlyNetIncome',
  'monthlyEssentialExpenses',
  'monthlyDiscretionaryExpenses',
  'monthlySavingsGoal',
] as const;

function num(value: number | undefined): number {
  return value ?? 0;
}

/** True if any of the five income/expense fields differ from the saved profile. */
export function financialProfileCoreFieldsChanged(
  incoming: FinancialProfile,
  existing: FinancialProfile
): boolean {
  return COMPARE_FIELDS.some((field) => num(existing[field]) !== num(incoming[field]));
}

/**
 * Returns true if save should proceed.
 * - No existing profile → first-time setup, no warning
 * - Existing profile, same core fields → no-op, no warning
 * - Existing profile, core fields changed → confirm(); cancel aborts
 */
export function confirmFinancialProfileSaveIfNeeded(
  incoming: FinancialProfile,
  existing: FinancialProfile | null = StorageService.getFinancialProfile()
): boolean {
  if (!existing) return true;
  if (!financialProfileCoreFieldsChanged(incoming, existing)) return true;
  return confirm(PROFILE_CHANGE_CONFIRM);
}
