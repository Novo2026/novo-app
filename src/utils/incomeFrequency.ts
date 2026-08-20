export type IncomeFrequency = 'monthly' | 'quarterly' | 'biannual' | 'annual';

export const INCOME_FREQUENCY_OPTIONS: {
  value: IncomeFrequency;
  label: string;
  periodsPerYear: number;
}[] = [
  { value: 'monthly', label: 'Monthly', periodsPerYear: 12 },
  { value: 'quarterly', label: 'Quarterly', periodsPerYear: 4 },
  { value: 'biannual', label: 'Biannual (twice a year)', periodsPerYear: 2 },
  { value: 'annual', label: 'Annual', periodsPerYear: 1 },
];

export function periodsPerYear(frequency: IncomeFrequency): number {
  return INCOME_FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.periodsPerYear ?? 12;
}

/** Convert a per-period amount into a monthly equivalent. */
export function toMonthlyEquivalent(periodAmount: number, frequency: IncomeFrequency): number {
  return (periodAmount * periodsPerYear(frequency)) / 12;
}

/** Convert a stored monthly equivalent back to the selected period amount for display. */
export function fromMonthlyEquivalent(monthlyAmount: number, frequency: IncomeFrequency): number {
  return (monthlyAmount * 12) / periodsPerYear(frequency);
}

export function normalizeIncomeFrequency(value: string | undefined): IncomeFrequency {
  if (value === 'quarterly' || value === 'biannual' || value === 'annual' || value === 'monthly') {
    return value;
  }
  return 'monthly';
}

export function frequencyAmountLabel(frequency: IncomeFrequency, kind: 'net' | 'gross'): string {
  const kindLabel = kind === 'net' ? 'Take-Home Pay (after taxes)' : 'Gross amount (before taxes)';
  switch (frequency) {
    case 'quarterly':
      return `Quarterly ${kindLabel}`;
    case 'biannual':
      return `Biannual ${kindLabel}`;
    case 'annual':
      return `Annual ${kindLabel}`;
    default:
      return kind === 'net' ? 'Take-Home Pay (after taxes)' : 'Gross Monthly amount (before taxes)';
  }
}
