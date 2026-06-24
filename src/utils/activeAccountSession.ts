const ACTIVE_CHECKING_KEY = 'novo_active_checking_account_id';
const ACTIVE_SAVINGS_KEY = 'novo_active_savings_account_id';

export function getActiveCheckingAccountId(
  accounts: { id: string; isDefault?: boolean }[]
): string {
  try {
    const stored = sessionStorage.getItem(ACTIVE_CHECKING_KEY);
    if (stored && accounts.some((a) => a.id === stored)) {
      return stored;
    }
  } catch {
    // sessionStorage unavailable
  }
  return accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || '';
}

export function setActiveCheckingAccountId(accountId: string): void {
  try {
    sessionStorage.setItem(ACTIVE_CHECKING_KEY, accountId);
  } catch {
    // sessionStorage unavailable
  }
}

export function getActiveSavingsAccountId(
  accounts: { id: string }[]
): string | null {
  try {
    const stored = sessionStorage.getItem(ACTIVE_SAVINGS_KEY);
    if (stored && accounts.some((a) => a.id === stored)) {
      return stored;
    }
  } catch {
    // sessionStorage unavailable
  }
  return accounts[0]?.id ?? null;
}

export function setActiveSavingsAccountId(accountId: string): void {
  try {
    sessionStorage.setItem(ACTIVE_SAVINGS_KEY, accountId);
  } catch {
    // sessionStorage unavailable
  }
}
