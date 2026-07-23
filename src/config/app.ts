/**
 * Bump this manually on any release that:
 * - changes stored localStorage data shapes, or
 * - needs UI/coaching cache keys cleared via runVersionMigration().
 * Not auto-incremented on deploy — financial data is never wiped by a bump.
 */
export const APP_VERSION = '1.1.0';

export const APP_VERSION_STORAGE_KEY = 'novo_app_version';
