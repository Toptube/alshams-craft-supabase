import React from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, justReconnected } = useOnlineStatus();

  if (isOnline && !justReconnected) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      dir="rtl"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-[60] pointer-events-none"
    >
      <div
        className={`px-3.5 py-2.5 rounded-xl border shadow-xl flex items-center gap-2.5 text-xs font-black pointer-events-auto ${
          !isOnline
            ? 'bg-[#0C1427] text-[#FDBA74] border-[#EA580C]'
            : 'bg-emerald-950 text-emerald-200 border-emerald-500'
        }`}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 text-[#EA580C] shrink-0" />
            <span className="leading-snug">
              الإنترنت منقطع — بيانات ورشتك محفوظة محلياً وستتم المزامنة تلقائياً عند عودة الشبكة.
            </span>
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="leading-snug">تمت استعادة الاتصال بالإنترنت وتحديث بيانات الورشة.</span>
          </>
        )}
      </div>
    </div>
  );
};
