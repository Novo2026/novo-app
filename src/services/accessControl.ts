import { supabase } from '../lib/supabase';

export type NOVOTier = 'free' | 'pro';

export interface AccessRecord {
  tier: NOVOTier;
  code: string;
  activatedAt: string;
  expiresAt: string | null;
}

const ACCESS_KEY = 'novo_access_record';

const PERMANENT_CODES: Record<string, NOVOTier> = {
  WINDMILL: 'pro',
  WINDMILLPRO: 'pro',
};

const WEBINAR_PREFIX = 'WEB-';

// Save tier to Supabase for the current logged-in user
async function saveTierToSupabase(record: AccessRecord): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('users')
      .update({
        tier: record.tier,
        access_code: record.code,
        tier_activated_at: record.activatedAt,
        tier_expires_at: record.expiresAt,
      })
      .eq('id', user.id);
  } catch (err) {
    console.error('Failed to save tier to Supabase:', err);
  }
}

// Load tier from Supabase and sync to localStorage
export async function syncTierFromSupabase(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('users')
      .select('tier, access_code, tier_activated_at, tier_expires_at')
      .eq('id', user.id)
      .single();

    if (error || !data) return;
    if (data.tier !== 'pro') return;

    // Check if pro has expired
    if (data.tier_expires_at) {
      const expires = new Date(data.tier_expires_at);
      if (expires < new Date()) return; // expired — leave as free
    }

    // Sync to localStorage so isPro() works synchronously
    const record: AccessRecord = {
      tier: data.tier as NOVOTier,
      code: data.access_code || '',
      activatedAt: data.tier_activated_at || new Date().toISOString(),
      expiresAt: data.tier_expires_at || null,
    };
    localStorage.setItem(ACCESS_KEY, JSON.stringify(record));
  } catch (err) {
    console.error('Failed to sync tier from Supabase:', err);
  }
}

export function activateCode(code: string): { success: boolean; tier: NOVOTier; message: string } {
  const upper = code.trim().toUpperCase();

  if (PERMANENT_CODES[upper]) {
    const record: AccessRecord = {
      tier: PERMANENT_CODES[upper],
      code: upper,
      activatedAt: new Date().toISOString(),
      expiresAt: null,
    };
    localStorage.setItem(ACCESS_KEY, JSON.stringify(record));
    // Save to Supabase in background
    saveTierToSupabase(record);
    return { success: true, tier: 'pro', message: 'Full Pro access activated. Welcome to NOVO Pro.' };
  }

  if (upper.startsWith(WEBINAR_PREFIX) && upper.length >= 8) {
    const expires = new Date();
    expires.setDate(expires.getDate() + 90);
    const record: AccessRecord = {
      tier: 'pro',
      code: upper,
      activatedAt: new Date().toISOString(),
      expiresAt: expires.toISOString(),
    };
    localStorage.setItem(ACCESS_KEY, JSON.stringify(record));
    // Save to Supabase in background
    saveTierToSupabase(record);
    const expireLabel = expires.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return { success: true, tier: 'pro', message: `Pro access activated through ${expireLabel}. Enjoy NOVO Pro.` };
  }

  return { success: false, tier: 'free', message: 'Invalid code. Check for typos and try again.' };
}

export function getCurrentTier(): NOVOTier {
  try {
    const stored = localStorage.getItem(ACCESS_KEY);
    if (!stored) return 'free';
    const record: AccessRecord = JSON.parse(stored);
    if (record.expiresAt) {
      const expires = new Date(record.expiresAt);
      if (expires < new Date()) return 'free';
    }
    return record.tier;
  } catch {
    return 'free';
  }
}

export function getAccessRecord(): AccessRecord | null {
  try {
    const stored = localStorage.getItem(ACCESS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

export function isProExpired(): boolean {
  try {
    const record = getAccessRecord();
    if (!record || !record.expiresAt) return false;
    return new Date(record.expiresAt) < new Date();
  } catch { return false; }
}

export function isPro(): boolean {
  return getCurrentTier() === 'pro';
}

export const PRO_FEATURES = [
  'Tracker',
  'Savings',
  'Spending Analysis',
  'Statement Import',
  'What-If Simulator',
  'Progress Reports',
  'Home Ready',
  'Full NOVO Coaching',
] as const;

export const FREE_FEATURES = [
  'Dashboard',
  'My Debts',
  'My Plan',
  'Smarter Payments',
  'Basic Ask NOVO',
] as const;
