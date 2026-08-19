export const MORTGAGE_BALANCE_MATCH_TOLERANCE = 0.1;

export function parseGuardMoney(value: string | number | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return parseFloat(String(value || '').replace(/[^0-9.]/g, '')) || 0;
}

export function balancesLikelyMatch(a: number, b: number, tolerance = MORTGAGE_BALANCE_MATCH_TOLERANCE): boolean {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) / Math.max(a, b) <= tolerance;
}

export function normalizeGuardLabel(value: string | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function labelsLikelyMatch(a: string | undefined, b: string | undefined): boolean {
  const na = normalizeGuardLabel(a);
  const nb = normalizeGuardLabel(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 6 && nb.length >= 6 && (na.includes(nb) || nb.includes(na))) return true;

  const tokensA = new Set(na.split(' ').filter((t) => t.length > 1));
  const tokensB = nb.split(' ').filter((t) => t.length > 1);
  if (tokensA.size === 0 || tokensB.length === 0) return false;
  const overlap = tokensB.filter((t) => tokensA.has(t)).length;
  return overlap >= 2;
}

export type DuplicateMortgageMatch = {
  propertyName: string;
  propertyBalance: number;
  debtName: string;
  debtBalance: number;
  reason: 'balance' | 'label' | 'both';
};

type PropertyLike = {
  description?: string;
  mortgageBalance?: string;
};

type DebtLike = {
  name?: string;
  type?: string;
  balance?: string;
};

function matchReason(balanceMatch: boolean, labelMatch: boolean): DuplicateMortgageMatch['reason'] | null {
  if (balanceMatch && labelMatch) return 'both';
  if (balanceMatch) return 'balance';
  if (labelMatch) return 'label';
  return null;
}

export function findPropertyDebtDuplicates(
  properties: PropertyLike[] | undefined,
  debts: DebtLike[] | undefined
): DuplicateMortgageMatch[] {
  const matches: DuplicateMortgageMatch[] = [];
  const mortgageDebts = (debts || []).filter((d) => d.type === 'Mortgage');

  for (const prop of properties || []) {
    const propertyBalance = parseGuardMoney(prop.mortgageBalance);
    const propertyName = (prop.description || '').trim();
    if (propertyBalance <= 0 && !propertyName) continue;

    for (const debt of mortgageDebts) {
      const debtBalance = parseGuardMoney(debt.balance);
      const debtName = (debt.name || '').trim();
      const reason = matchReason(
        propertyBalance > 0 && debtBalance > 0 && balancesLikelyMatch(propertyBalance, debtBalance),
        labelsLikelyMatch(propertyName, debtName)
      );
      if (!reason) continue;
      matches.push({
        propertyName: propertyName || 'Additional property',
        propertyBalance,
        debtName: debtName || 'Mortgage',
        debtBalance,
        reason,
      });
    }
  }

  return matches;
}

export function findMatchingPropertyForMortgageDebt(
  debt: DebtLike,
  properties: PropertyLike[] | undefined
): DuplicateMortgageMatch | null {
  if (debt.type !== 'Mortgage') return null;
  return findPropertyDebtDuplicates(properties, [debt])[0] || null;
}

export function findMatchingMortgageForProperty(
  property: PropertyLike,
  debts: DebtLike[] | undefined
): DuplicateMortgageMatch | null {
  return findPropertyDebtDuplicates([property], debts)[0] || null;
}
