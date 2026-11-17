import React, { useEffect, useState } from 'react';
import { Clock, RotateCcw, Trash2 } from 'lucide-react';
import {
  ImageRollbackEntry,
  confirmPermanentPurge,
  formatRemainingRollbackTime,
  getRollbackEntry,
  purgeExpiredImageArchives,
  restoreRollbackEntry,
} from '../../services/imageRollbackService';

interface ImageRollbackBarProps {
  slotKey: string;
  onRestored: (restoredUrl: string) => void;
  onPurged?: () => void;
  compact?: boolean;
}

export const ImageRollbackBar: React.FC<ImageRollbackBarProps> = ({
  slotKey,
  onRestored,
  onPurged,
  compact = false,
}) => {
  const [entry, setEntry] = useState<ImageRollbackEntry | null>(() => getRollbackEntry(slotKey));
  const [, setTick] = useState(0);

  useEffect(() => {
    setEntry(getRollbackEntry(slotKey));

    const refresh = () => {
      purgeExpiredImageArchives();
      setEntry(getRollbackEntry(slotKey));
      setTick((t) => t + 1);
    };

    window.addEventListener('alshams_image_rollback_updated', refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('alshams_image_rollback_updated', refresh);
      window.clearInterval(interval);
    };
  }, [slotKey]);

  if (!entry) return null;

  const remainingText = formatRemainingRollbackTime(entry.expiresAt);

  const handleRestore = () => {
    const prevUrl = restoreRollbackEntry(slotKey);
    if (prevUrl) {
      onRestored(prevUrl);
      setEntry(null);
    }
  };

  const handleConfirmNoUndo = () => {
    confirmPermanentPurge(slotKey);
    setEntry(null);
    if (onPurged) onPurged();
  };

  return (
    <div
      dir="rtl"
      className={`rounded-2xl border border-amber-400/70 dark:border-amber-600/50 bg-amber-50/90 dark:bg-amber-950/35 ${
        compact ? 'p-2.5 space-y-2' : 'p-3 sm:p-3.5 space-y-2.5'
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={entry.previousUrl}
            alt="النسخة السابقة"
            className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-[#060B18] border border-amber-300 dark:border-amber-700 p-0.5 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-black text-amber-950 dark:text-amber-100 truncate">
              النسخة السابقة محفوظة مؤقتاً (تُحذف تلقائياً بعد 8 ساعات)
            </p>
            <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1 tabular-nums">
              <Clock className="w-3 h-3 shrink-0" />
              <span>{remainingText}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleRestore}
            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#0D162E] border border-amber-500/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-[#1A2B54] text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>تراجع واسترجاع القديم</span>
          </button>

          <button
            type="button"
            onClick={handleConfirmNoUndo}
            className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition"
          >
            <Trash2 className="w-3 h-3" />
            <span>لن أتراجع (حذف القديم نهائياً)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
