import { useState, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// File-level execution guard for React 18 StrictMode and one-time token consumption
let hasHandledRecoveryHash = false;
let initialRecoveryMode = false;
let initialRecoveryError: string | null = null;

if (typeof window !== 'undefined' && !hasHandledRecoveryHash) {
  try {
    const rawHash = window.location.hash ? window.location.hash.substring(1) : '';
    if (rawHash) {
      const hashParams = new URLSearchParams(rawHash);
      const errorCode = hashParams.get('error_code');
      const error = hashParams.get('error');
      const type = hashParams.get('type');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (errorCode || error) {
        hasHandledRecoveryHash = true;
        initialRecoveryError = 'رابط استعادة كلمة المرور منتهي أو استُخدم من قبل. اطلب رابطاً جديداً.';
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      } else if (type === 'recovery' && accessToken && refreshToken) {
        hasHandledRecoveryHash = true;
        initialRecoveryMode = true;
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }

        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).catch((err) => {
          console.error('[useAuthSession] Failed to set recovery session:', err);
        });
      }
    }
  } catch (err) {
    console.error('[useAuthSession] Error parsing recovery hash:', err);
  }
}

export interface AuthSessionState {
  session: Session | null;
  userId: string | null;
  isAuthChecked: boolean;
  isRecoveryMode: boolean;
  setIsRecoveryMode: (val: boolean) => void;
  recoveryError: string | null;
  clearRecoveryError: () => void;
}

/**
 * Custom hook acting as the single source of truth for the user's authentication session.
 * Uses native supabase-js autoRefreshToken: true and persistSession: true.
 * Keeps the session active indefinitely without arbitrary countdowns, warnings, or forced timeouts.
 */
export function useAuthSession(): AuthSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(initialRecoveryMode);
  const [recoveryError, setRecoveryError] = useState<string | null>(initialRecoveryError);

  const clearRecoveryError = () => {
    setRecoveryError(null);
  };

  const initializedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession }, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error('[AuthSession] خطأ أثناء استرجاع الجلسة الأولية:', error);
        }
        setSession(initialSession);
        setIsAuthChecked(true);
        initializedRef.current = true;
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('[AuthSession] استثناء أثناء استرجاع الجلسة:', err);
        setIsAuthChecked(true);
        initializedRef.current = true;
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      // Ignore token refresh noise: it is a transport detail, not a user auth change.
      if (event === 'TOKEN_REFRESHED') return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        if (newSession) setSession(newSession);
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        setSession(newSession);
        setIsAuthChecked(true);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setIsAuthChecked(true);
        setIsRecoveryMode(false);
      }
    });

    const handleVisibilityOrFocus = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const { data } = await supabase.auth.getSession();
          if (isMounted && data?.session) {
            setSession(data.session);
          }
        } catch {
          // Ignore background verification errors
        }
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  return {
    session,
    userId: session?.user?.id || null,
    isAuthChecked,
    isRecoveryMode,
    setIsRecoveryMode,
    recoveryError,
    clearRecoveryError,
  };
}
