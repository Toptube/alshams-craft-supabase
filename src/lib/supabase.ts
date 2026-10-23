import { createClient, SupabaseClient, SupportedStorage } from '@supabase/supabase-js';
import config from '../../supabase-config.json';

// In-memory fallback map (maintains session in-memory if storage APIs are restricted/fail)
const memoryStore = new Map<string, string>();

/**
 * Storage adapter implementing localStorage -> sessionStorage -> memoryStore (Map)
 * within robust try/catch blocks so session is never lost in iframe or private browsing.
 */
export const customStorageAdapter: SupportedStorage = {
  getItem: (key: string): string | null => {
    // 1. Try localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {
      // localStorage read failed or blocked
    }

    // 2. Try sessionStorage
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const val = window.sessionStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {
      // sessionStorage read failed or blocked
    }

    // 3. Fallback to memoryStore
    return memoryStore.get(key) || null;
  },

  setItem: (key: string, value: string): void => {
    // Always mirror to memory store as immediate guarantee
    memoryStore.set(key, value);

    let persisted = false;

    // 1. Try localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        persisted = true;
      }
    } catch (e) {
      // localStorage failed (quota exceeded, iframe sandbox, disabled)
    }

    // 2. If localStorage failed, try sessionStorage
    if (!persisted) {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(key, value);
          persisted = true;
        }
      } catch (e) {
        // sessionStorage failed
      }
    }
  },

  removeItem: (key: string): void => {
    memoryStore.delete(key);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {}

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch (e) {}
  },
};

/**
 * The single, unified Supabase client for the entire project
 */
export const supabase: SupabaseClient = createClient(config.url, config.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: customStorageAdapter,
  },
});

export default supabase;
