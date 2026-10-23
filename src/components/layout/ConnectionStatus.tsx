import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ConnectionStatusProps {
  /**
   * Whether an active Supabase auth session is present.
   * If not provided, falls back to checking supabase.auth.getSession().
   */
  hasActiveSession?: boolean;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  hasActiveSession: propHasActiveSession,
  className = '',
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [internalHasSession, setInternalHasSession] = useState<boolean>(() => {
    return propHasActiveSession !== undefined ? propHasActiveSession : true;
  });
  const [showTooltip, setShowTooltip] = useState<boolean>(false);

  // Monitor browser network online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync internal session state with prop or check Supabase session if prop is omitted
  useEffect(() => {
    if (propHasActiveSession !== undefined) {
      setInternalHasSession(propHasActiveSession);
      return;
    }

    let isMounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        setInternalHasSession(Boolean(session?.access_token));
      }
    }).catch(() => {
      if (isMounted) {
        setInternalHasSession(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [propHasActiveSession]);

  // Combined connection status based on session presence and network connectivity
  const isConnected = isOnline && internalHasSession;

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        onClick={() => setShowTooltip((prev) => !prev)}
        aria-label={isConnected ? 'متصل: الجلسة نشطة' : 'غير متصل: لا توجد جلسة نشطة'}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl border transition cursor-pointer shadow-xs active:scale-95 ${
          isConnected
            ? 'border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40'
            : 'border-stone-200 dark:border-stone-700/80 bg-stone-50/80 dark:bg-stone-800/60 hover:bg-stone-100 dark:hover:bg-stone-800'
        }`}
      >
        {/* النبضة البصرية الملونة: خضراء عند توفر الجلسة ورمادية عند انقطاعها */}
        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isConnected
                ? 'bg-emerald-400'
                : 'bg-stone-400 dark:bg-stone-500'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isConnected
                ? 'bg-emerald-500'
                : 'bg-stone-400 dark:bg-stone-500'
            }`}
          />
        </span>

        {/* أيقونة الاتصال البسيطة تومض بالأخضر عند توفر الجلسة وبالرمادي عند انقطاعها */}
        {isConnected ? (
          <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse hidden xs:inline" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 animate-pulse hidden xs:inline" />
        )}

        {/* النص التوضيحي للحالة */}
        <span
          className={`hidden md:inline text-[11px] font-bold ${
            isConnected
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-stone-500 dark:text-stone-400'
          }`}
        >
          {isConnected ? 'متصل' : 'غير متصل'}
        </span>
      </button>

      {/* تفاصيل حالة الاتصال والجلسة */}
      {showTooltip && (
        <div className="absolute left-0 top-full mt-2 w-56 p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xl z-50 text-right animate-in fade-in zoom-in-95 duration-150">
          <p className="text-[11px] font-black text-stone-900 dark:text-stone-100 mb-2 border-b border-stone-100 dark:border-stone-800 pb-1.5 flex items-center justify-between">
            <span>حالة الاتصال والخدمة</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                isConnected
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
              }`}
            >
              {isConnected ? 'نشط' : 'معطل'}
            </span>
          </p>
          <div className="space-y-1.5 text-[10px] font-bold">
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-300">جلسة الدخول:</span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    internalHasSession ? 'bg-emerald-500' : 'bg-stone-400 dark:bg-stone-500'
                  }`}
                />
                <span
                  className={
                    internalHasSession
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-stone-500 dark:text-stone-400'
                  }
                >
                  {internalHasSession ? 'جلسة متوفرة' : 'لا توجد جلسة'}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-300">الشبكة المحلية:</span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-emerald-500' : 'bg-stone-400 dark:bg-stone-500'
                  }`}
                />
                <span
                  className={
                    isOnline
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-stone-500 dark:text-stone-400'
                  }
                >
                  {isOnline ? 'متصل بالإنترنت' : 'منقطع عن الإنترنت'}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
