import { createClient, SupabaseClient, SupportedStorage } from '@supabase/supabase-js';
import config from '../../supabase-config.json';

/**
 * Storage adapter detector:
 * Tests localStorage once at initialization (setItem + removeItem inside try/catch).
 * If localStorage is functional, returns undefined so supabase-js uses default localStorage.
 * If localStorage is blocked or fails (e.g. private mode, disabled storage), returns an in-memory Map adapter.
 */
function getStorageAdapter(): SupportedStorage | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const testKey = '__sb_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return undefined; // Use default supabase-js storage (localStorage)
  } catch {
    const memoryMap = new Map<string, string>();
    return {
      getItem: (key: string): string | null => memoryMap.get(key) || null,
      setItem: (key: string, value: string): void => {
        memoryMap.set(key, value);
      },
      removeItem: (key: string): void => {
        memoryMap.delete(key);
      },
    };
  }
}

const chosenStorage = getStorageAdapter();

/**
 * Single, unified Supabase client for the entire frontend application.
 */
export const supabase: SupabaseClient = createClient(config.url, config.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    ...(chosenStorage ? { storage: chosenStorage } : {}),
  },
});

export default supabase;
