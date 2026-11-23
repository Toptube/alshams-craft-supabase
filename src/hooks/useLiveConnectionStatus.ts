import { useCallback, useEffect, useRef, useState } from 'react';
import { authedFetch } from '../lib/apiClient';

export type SearchIndicatorState = 'off' | 'live' | 'disconnected';

export interface LiveConnectionStatus {
  /** Top header dot: true = green (internet connected), false = gray (offline) */
  isInternetOnline: boolean;
  /** Real status of live search APIs (Google Search primary + Groq Search backup + Web Search) */
  isSearchApiLive: boolean;
  /** 3-state bottom search button: 'off' | 'live' (green) | 'disconnected' (gray) */
  searchButtonState: SearchIndicatorState;
  /** Manually re-probe server search health (e.g. on toggle ON) */
  refreshSearchHealth: () => Promise<void>;
  /** Update live search status from real chat API response outcomes */
  reportSearchOutcome: (searchSucceeded: boolean, networkFailed?: boolean) => void;
}

/**
 * Stable, truthful two-level connectivity hook for Shamousa & Falcon:
 * 1) Top dot: tracks actual browser/network internet connectivity (green = online, gray = offline).
 * 2) Bottom search button: 3 truthful states with anti-flapping resilience:
 *    - 'off'          -> Search toggle is OFF
 *    - 'live'         -> Search toggle is ON and live search APIs are available (GREEN)
 *    - 'disconnected' -> Search toggle is ON, and internet or ALL live search tiers are genuinely down (GRAY)
 */
export function useLiveConnectionStatus(
  isSearchEnabled: boolean,
  isActive = true
): LiveConnectionStatus {
  const [isInternetOnline, setIsInternetOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [isSearchApiLive, setIsSearchApiLive] = useState<boolean>(true);
  const consecutiveFailuresRef = useRef<number>(0);

  const probeOnce = useCallback(async (): Promise<{ ok: boolean; live: boolean; networkDown: boolean }> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const res = await authedFetch('/api/ai/search-health', {
        method: 'GET',
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ok: false, live: false, networkDown: false };
      }
      const data = await res.json().catch(() => null);
      return { ok: true, live: Boolean(data?.liveSearchAvailable ?? true), networkDown: false };
    } catch {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      return { ok: false, live: false, networkDown: offline };
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  const refreshSearchHealth = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      consecutiveFailuresRef.current = 2;
      setIsInternetOnline(false);
      setIsSearchApiLive(false);
      return;
    }

    let result = await probeOnce();
    if (!result.ok && !result.networkDown) {
      // One fast retry before treating a single transient blip as a server outage
      await new Promise((r) => setTimeout(r, 1200));
      result = await probeOnce();
    }

    if (result.ok) {
      setIsInternetOnline(true);
      if (result.live) {
        consecutiveFailuresRef.current = 0;
        setIsSearchApiLive(true);
      } else {
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= 2) {
          setIsSearchApiLive(false);
        }
      }
      return;
    }

    if (result.networkDown) {
      consecutiveFailuresRef.current = 2;
      setIsInternetOnline(false);
      setIsSearchApiLive(false);
      return;
    }

    consecutiveFailuresRef.current += 1;
    if (consecutiveFailuresRef.current >= 2) {
      setIsSearchApiLive(false);
    }
  }, [probeOnce]);

  // Listen to browser online/offline transitions in real time
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      consecutiveFailuresRef.current = 0;
      setIsInternetOnline(true);
      void refreshSearchHealth();
    };
    const handleOffline = () => {
      consecutiveFailuresRef.current = 2;
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
    }, 90000);
    return () => window.clearInterval(timer);
  }, [isActive, isSearchEnabled, refreshSearchHealth]);

  const reportSearchOutcome = useCallback((searchSucceeded: boolean, networkFailed = false) => {
    if (networkFailed) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setIsInternetOnline(false);
      }
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 2 || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        setIsSearchApiLive(false);
      }
      return;
    }
    setIsInternetOnline(true);
    if (searchSucceeded) {
      consecutiveFailuresRef.current = 0;
      setIsSearchApiLive(true);
    } else {
      // Require 2 consecutive real search failures before turning the indicator gray
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 2) {
        setIsSearchApiLive(false);
      }
    }
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
