import { APP_VERSION, APP_VERSION_STORAGE_KEY } from '../config/app';

/** Never cleared during version migration. */
const PROTECTED_KEYS = new Set([
  APP_VERSION_STORAGE_KEY,
  'novo_access_record',
  'novo_admin_mode',
]);

/** Supabase auth session keys — never cleared. */
const PROTECTED_PREFIXES = ['sb-'];

/**
 * UI, coaching, and calculation-cache keys cleared when the stored app version
 * is older than APP_VERSION. User financial data is intentionally excluded.
 *
 * Durable Setup Guide progress is NOT cleared here — treat like financial data:
 * novo_start_here_dismissed, novo_smarter_payments_visited,
 * novo_first_chat_completed, novo_install_date.
 */
const MIGRATION_CLEAR_KEYS = [
  'novo_proactive_messages',
  'novo_proactive_ssages',
  'novo_detected_milestones',
  'novo_ben_tasks',
  'novo_strategy_calc_hash',
  'novo_data_hash',
  'askNovoClicked',
  'trackerTabNewSeen',
  'menuOpenCount',
  'welcomeTourCompleted',
  'onboardingProgress',
  'chunkingQuizPassed',
  'novo_demo_mode',
  'lastVisit',
];

function parseVersion(version: string): number[] {
  return version.split('.').map((part) => {
    const parsed = parseInt(part, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });
}

function isOlderVersion(storedVersion: string, currentVersion: string): boolean {
  const stored = parseVersion(storedVersion);
  const current = parseVersion(currentVersion);
  const length = Math.max(stored.length, current.length, 3);

  for (let i = 0; i < length; i += 1) {
    const storedPart = stored[i] ?? 0;
    const currentPart = current[i] ?? 0;
    if (storedPart < currentPart) return true;
    if (storedPart > currentPart) return false;
  }

  return false;
}

function isProtectedKey(key: string): boolean {
  if (PROTECTED_KEYS.has(key)) return true;
  return PROTECTED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function clearMigratableKeys(): void {
  for (const key of MIGRATION_CLEAR_KEYS) {
    if (!isProtectedKey(key)) {
      localStorage.removeItem(key);
    }
  }
}

export type VersionMigrationResult = 'unchanged' | 'initialized' | 'migrated';

/**
 * Runs synchronously on startup before the app bootstraps.
 * Returns `migrated` when stale UI cache was cleared and a reload is required.
 */
export function runVersionMigration(): VersionMigrationResult {
  const storedVersion = localStorage.getItem(APP_VERSION_STORAGE_KEY);

  if (!storedVersion) {
    localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
    return 'initialized';
  }

  if (storedVersion === APP_VERSION) {
    return 'unchanged';
  }

  if (isOlderVersion(storedVersion, APP_VERSION)) {
    clearMigratableKeys();
    localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
    return 'migrated';
  }

  // Stored version is newer than this build (e.g. rollback) — leave user data intact.
  return 'unchanged';
}
