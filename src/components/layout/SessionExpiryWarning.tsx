import React, { useState, useEffect, useCallback } from 'react';
import { Clock, RefreshCw, X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SessionExpiryWarningProps {
  expiresAt?: number | null; // Unix timestamp in seconds
}

export const SessionExpiryWarning: React.FC<SessionExpiryWarningProps> = ({ expiresAt }) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Reset dismissed state whenever a new expiresAt is provided (e.g. after refresh)
  useEffect(() => {
    setIsDismissed(false);
    setRefreshError(null);
  }, [expiresAt]);

  // Tick every second to accurately calculate remaining time
  useEffect(() => {
    if (!expiresAt) {
      setSecondsRemaining(null);
      return;
    }

    const updateRemaining = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const diff = expiresAt - nowSec;
      setSecondsRemaining(diff);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.warn('[SessionExpiryWarning] Failed to refresh session:', error);
        setRefreshError('تعذر تجديد الجلسة تلقائياً. يُرجى حفظ العمل وإعادة الدخول إن لزم.');
      } else {
        // Success: onAuthStateChange will fire TOKEN_REFRESHED, updating expiresAt
        setIsDismissed(false);
      }
    } catch (err: any) {
      console.warn('[SessionExpiryWarning] Exception while refreshing session:', err);
      setRefreshError('تعذر تجديد الجلسة تلقائياً.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Alert triggers if remaining time is <= 120 seconds (2 minutes) and the session hasn't expired completely yet
  const shouldShow =
    !isDismissed &&
    secondsRemaining !== null &&
    secondsRemaining > 0 &&
    secondsRemaining <= 120;

  if (!shouldShow) {
    return null;
  }

  // Format remaining time nicely in Arabic
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeText =
    minutes > 0
      ? `دقيقة و ${seconds} ثانية`
      : `${seconds} ثانية`;

  return (
    <div
      role="alert"
      className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/90 dark:border-amber-800/60 text-amber-950 dark:text-amber-100 px-4 py-2.5 transition-all shadow-xs animate-in fade-in slide-in-from-top-1 duration-200"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        {/* تفاصيل التنبيه */}
        <div className="flex items-center gap-2.5 text-right w-full sm:w-auto">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <p className="font-bold leading-tight flex items-center gap-1.5">
              <span>تنبيه أمان الجلسة: أوشكت صلاحية الدخول على الانتهاء خلال</span>
              <span className="font-black text-amber-800 dark:text-amber-300 underline underline-offset-2">
                {timeText}
              </span>
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-normal mt-0.5">
              يُرجى حفظ أي تعديلات أو فواتير جارية الآن لضمان بقائها وعدم فقدان البيانات.
            </p>
            {refreshError && (
              <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{refreshError}</span>
              </p>
            )}
          </div>
        </div>

        {/* الإجراءات: تجديد الجلسة أو إغلاق التنبيه */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="تجديد مدة الجلسة الآن"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'جاري التجديد...' : 'تجديد الجلسة'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-xl text-amber-800 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-900/40 transition cursor-pointer"
            title="إخفاء التنبيه"
            aria-label="إخفاء التنبيه"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
