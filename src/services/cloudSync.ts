import { supabase } from '../lib/supabase';

const EXCLUDE_PREFIXES = ['sb-'];

function shouldSyncKey(key: string): boolean {
  if (!key) return false;
  return !EXCLUDE_PREFIXES.some(prefix => key.startsWith(prefix));
}

export function collectLocalStorageSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !shouldSyncKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) out[key] = value;
  }
  return out;
}

export async function pushLocalStorageToCloud(userId: string): Promise<void> {
  const snapshot = collectLocalStorageSnapshot();
  const now = new Date().toISOString();
  const rows = Object.entries(snapshot).map(([data_key, data_value]) => ({
    user_id: userId,
    data_key,
    data_value,
    updated_at: now,
  }));

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from('user_data').upsert(chunk, {
      onConflict: 'user_id,data_key',
    });
    if (error) throw error;
  }
}

export async function pullRemoteToLocalStorage(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('user_data')
    .select('data_key, data_value')
    .eq('user_id', userId);

  if (error) throw error;
  if (!data?.length) return;

  for (const row of data) {
    if (row.data_key == null) continue;
    const v = row.data_value;
    if (v === null || v === undefined) {
      localStorage.removeItem(row.data_key);
    } else {
      localStorage.setItem(row.data_key, v);
    }
  }
}
