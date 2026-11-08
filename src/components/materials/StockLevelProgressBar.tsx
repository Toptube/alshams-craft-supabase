import React from 'react';

interface StockLevelProgressBarProps {
  currentStock: number;
  minThreshold: number;
  unitName?: string;
  maxTargetStock?: number;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const StockLevelProgressBar: React.FC<StockLevelProgressBarProps> = ({
  currentStock,
  minThreshold,
  unitName = 'وحدة',
  maxTargetStock,
  showLabels = true,
  size = 'md',
}) => {
  // Determine baseline target capacity (e.g. 2.5x the safety threshold or custom max)
  const safeTarget = maxTargetStock && maxTargetStock > minThreshold
    ? maxTargetStock
    : Math.max(minThreshold * 2.5, 10);

  // Compute stock ratio percentage (0% to 100%)
  const percentage = Math.min(100, Math.max(0, Math.round((currentStock / safeTarget) * 100)));

  // Critical threshold logic:
  // Red (< 20% or stock <= minThreshold): Critical safety level
  // Amber (20% - 50%): Approaching safety threshold
  // Green (> 50%): Safe and sufficient
  const isCritical = currentStock <= minThreshold || percentage < 20;
  const isWarning = !isCritical && percentage >= 20 && percentage <= 50;
  const isSafe = !isCritical && !isWarning && percentage > 50;

  let barGradient = 'bg-gradient-to-r from-emerald-500 to-emerald-400';
  let badgeBg = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
  let badgeLabel = '🟢 آمن ومكتمل';
  let badgeColor = 'text-emerald-600 dark:text-emerald-400';

  if (isCritical) {
    barGradient = 'bg-gradient-to-r from-rose-600 to-rose-500 animate-pulse';
    badgeBg = 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800 animate-pulse';
    badgeLabel = '🔴 حرج تحت الأمان';
    badgeColor = 'text-rose-600 dark:text-rose-400 font-black';
  } else if (isWarning) {
    barGradient = 'bg-gradient-to-r from-amber-500 to-amber-400';
    badgeBg = 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
    badgeLabel = '🟡 يقترب من حد الأمان';
    badgeColor = 'text-amber-600 dark:text-amber-400 font-bold';
  }

  const heightClass = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';

  return (
    <div className="w-full space-y-1.5 text-right font-sans" dir="rtl">
      {showLabels && (
        <div className="flex items-center justify-between text-[11px] leading-tight">
          <span className="font-extrabold flex items-center gap-1.5">
            <span className={badgeColor}>
              {currentStock} {unitName}
            </span>
            <span className="text-stone-400 font-normal">
              (حد الأمان: {minThreshold})
            </span>
          </span>

          <span className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-bold border ${badgeBg}`}>
            {badgeLabel} • {percentage}%
          </span>
        </div>
      )}

      {/* Visual Progress Bar Track */}
      <div className={`w-full ${heightClass} rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden relative shadow-inner`}>
        <div
          className={`${heightClass} rounded-full transition-all duration-300 ${barGradient}`}
          style={{ width: `${Math.max(percentage, isCritical ? 8 : 4)}%` }}
        />
      </div>
    </div>
  );
};
