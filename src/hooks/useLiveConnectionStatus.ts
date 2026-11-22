import { useCallback, useEffect, useState } from 'react';
import { authedFetch } from '../lib/apiClient';

export type SearchIndicatorState = 'off' | 'live' | 'disconnected';

export interface LiveConnectionStatus {
  /** Top header dot: true = green (internet connected), false = gray (offline) */
  isInternetOnline: boolean;
  /** Real status of live search APIs (Google Search primary + Groq Search backup) */
  isSearchApiLive: boolean;
  /** 3-state bottom search button: 'off' | 'live' (green) | 'disconnected' (gray) */
  searchButtonState: SearchIndicatorState;
  /** Manually re-probe server search health (e.g. on toggle ON) */
  refreshSearchHealth: () => Promise<void>;
  /** Update live search status from real chat API response outcomes */
  reportSearchOutcome: (searchSucceeded: boolean, networkFailed?: boolean) => void;
}

/**
 * Real-time, zero-lie two-level connectivity hook for Shamousa & Falcon:
 * 1) Top dot: tracks actual browser/network internet connectivity (green = online, gray = offline).
 * 2) Bottom search button: 3 truthful states:
 *    - 'off'          -> Search toggle is OFF
 *    - 'live'         -> Search toggle is ON and live search APIs (Google Search / Groq backup) are actually working (GREEN)
 *    - 'disconnected' -> Search toggle is ON, but internet or search APIs/quotas are down (GRAY)
 */
export function useLiveConnectionStatus(
  isSearchEnabled: boolean,
  isActive = true
): LiveConnectionStatus {
  const [isInternetOnline, setIsInternetOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [isSearchApiLive, setIsSearchApiLive] = useState<boolean>(true);

  const refreshSearchHealth = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setIsInternetOnline(false);
      setIsSearchApiLive(false);
      return;
    }
    try {
      const res = await authedFetch('/api/ai/search-health', { method: 'GET' });
      if (!res.ok) {
        // Server reachable but returned error -> online is true, search API status uncertain/down
        setIsInternetOnline(true);
        setIsSearchApiLive(false);
        return;
      }
      const data = await res.json().catch(() => null);
      setIsInternetOnline(true);
      setIsSearchApiLive(Boolean(data?.liveSearchAvailable));
    } catch {
      // Fetch failed completely -> offline or network unreachable
      setIsInternetOnline(false);
      setIsSearchApiLive(false);
    }
  }, []);

  // Listen to browser online/offline transitions in real time
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      setIsInternetOnline(true);
      void refreshSearchHealth();
    };
    const handleOffline = () => {
      setIsInternetOnline(false);
      setIsSearchApiLive(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshSearchHealth]);

  // Check real search API health whenever chat becomes active or search is turned ON
  useEffect(() => {
    if (!isActive) return;
    void refreshSearchHealth();
    if (!isSearchEnabled) return;
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void refreshSearchHealth();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [isActive, isSearchEnabled, refreshSearchHealth]);

  const reportSearchOutcome = useCallback((searchSucceeded: boolean, networkFailed = false) => {
    if (networkFailed) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setIsInternetOnline(false);
      }
      setIsSearchApiLive(false);
      return;
    }
    setIsInternetOnline(true);
    setIsSearchApiLive(searchSucceeded);
  }, []);

  const searchButtonState: SearchIndicatorState = !isSearchEnabled
    ? 'off'
    : isInternetOnline && isSearchApiLive
    ? 'live'
    : 'disconnected';

  return {
    isInternetOnline,
    isSearchApiLive,
    searchButtonState,
    refreshSearchHealth,
    reportSearchOutcome,
  };
}
