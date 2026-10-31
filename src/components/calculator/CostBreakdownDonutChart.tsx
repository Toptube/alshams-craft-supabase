import React, { useState } from 'react';
import { Sparkles, PieChart, Info, ShieldCheck } from 'lucide-react';

export interface CostBreakdownItem {
  id: string;
  name: string;
  description: string;
  value: number;
  percentage: number;
  color: string;
  hoverColor: string;
  badgeBg: string;
  textColor: string;
}

interface CostBreakdownDonutChartProps {
  directMaterialsCost: number;
  laborWage: number;
  profitAmount: number;
  indirectCosts: number;
  totalSellingPrice: number;
  currencySymbol: string;
}

export const CostBreakdownDonutChart: React.FC<CostBreakdownDonutChartProps> = ({
  directMaterialsCost,
  laborWage,
  profitAmount,
  indirectCosts,
  totalSellingPrice,
  currencySymbol,
}) => {
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  const laborAndProfit = Math.max(0, laborWage + profitAmount);
  const materials = Math.max(0, directMaterialsCost);
  const indirect = Math.max(0, indirectCosts);

  const effectiveTotal = Math.max(1, materials + laborAndProfit + indirect);

  const materialsPercent = Math.round((materials / effectiveTotal) * 100);
  const laborAndProfitPercent = Math.round((laborAndProfit / effectiveTotal) * 100);
  // Ensure sum equals 100
  const indirectPercent = Math.max(0, 100 - materialsPercent - laborAndProfitPercent);

  const items: CostBreakdownItem[] = [
    {
      id: 'materials',
      name: 'تكلفة الخامات المباشرة',
      description: 'الخيوط، الأقمشة، الخرز والملحقات الأساسية',
      value: Math.round(materials),
      percentage: materialsPercent,
      color: '#f59e0b', // عسلي كهرماني دافئ
      hoverColor: '#d97706',
      badgeBg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      id: 'labor_profit',
      name: 'أجر اليد وهامش الربح المقدر',
      description: 'مصنعية الفنان والربح الحرفي المعزول',
      value: Math.round(laborAndProfit),
      percentage: laborAndProfitPercent,
      color: '#10b981', // أخضر زمردي
      hoverColor: '#059669',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'indirect',
      name: 'الهالك والمصروفات العامة والتغليف',
      description: 'التغليف، النقل، وهالك الخامات والمصاريف الإدارية',
      value: Math.round(indirect),
      percentage: indirectPercent,
      color: '#6366f1', // أزرق حريري متناسق
      hoverColor: '#4f46e5',
      badgeBg: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
      textColor: 'text-indigo-600 dark:text-indigo-400',
    },
  ];

  // SVG Donut calculation
  const size = 200;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate segment offsets
  let accumulatedPercent = 0;
  const segments = items.map((item) => {
    const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += item.percentage;
    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const activeItem = activeSegmentId ? items.find((it) => it.id === activeSegmentId) : null;

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-md space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-2xs">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <span>تشريح تكلفة المشغولة والتسعير العادل</span>
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              رسم بياني يوضح نسب الخامات، أجر اليد والربح، والتكاليف المساعدة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>تسعير عادل ودقيق</span>
        </div>
      </div>

      {/* Main Donut + Center Content */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
        {/* SVG Donut */}
        <div className="relative w-[180px] h-[180px] shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
            {/* Background Circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-stone-100 dark:text-stone-800 fill-none"
            />
            {/* Donut Segments */}
            {segments.map((seg) => {
              const isHovered = activeSegmentId === seg.id;
              return (
                <circle
                  key={seg.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={isHovered ? seg.hoverColor : seg.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  strokeLinecap="butt"
                  className="fill-none transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setActiveSegmentId(seg.id)}
                  onMouseLeave={() => setActiveSegmentId(null)}
                  onClick={() => setActiveSegmentId(activeSegmentId === seg.id ? null : seg.id)}
                />
              );
            })}
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
            {activeItem ? (
              <>
                <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 line-clamp-1">
                  {activeItem.name}
                </span>
                <span className={`text-xl font-black font-mono ${activeItem.textColor}`}>
                  {activeItem.percentage}%
                </span>
                <span className="text-[11px] font-mono text-stone-600 dark:text-stone-300 font-bold">
                  {activeItem.value.toLocaleString()} {currencySymbol}
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-bold text-stone-400">سعر البيع النهائي</span>
                <span className="text-xl font-black font-mono text-stone-900 dark:text-stone-100">
                  {Math.round(totalSellingPrice).toLocaleString()}
                </span>
                <span className="text-[10px] text-stone-500 font-bold">{currencySymbol}</span>
              </>
            )}
          </div>
        </div>

        {/* Legend Cards */}
        <div className="flex-1 w-full space-y-2">
          {items.map((item) => {
            const isHovered = activeSegmentId === item.id;
            return (
              <div
                key={item.id}
                onMouseEnter={() => setActiveSegmentId(item.id)}
                onMouseLeave={() => setActiveSegmentId(null)}
                onClick={() => setActiveSegmentId(activeSegmentId === item.id ? null : item.id)}
                className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isHovered
                    ? 'bg-stone-50 dark:bg-stone-800/90 border-amber-400 dark:border-amber-500 shadow-xs scale-[1.01]'
                    : 'bg-stone-50/70 dark:bg-stone-850/50 border-stone-200/70 dark:border-stone-800 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-stone-900 dark:text-stone-100 truncate">
                        {item.name}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold border ${item.badgeBg}`}>
                        {item.percentage}%
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  <span className={`text-xs font-black font-mono block ${item.textColor}`}>
                    {item.value.toLocaleString()} {currencySymbol}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Assurance Note */}
      <div className="p-2.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/30 flex items-center gap-2 text-[11px] text-amber-900 dark:text-amber-300 font-medium">
        <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>
          التسعير المعزول يضمن استرداد تكاليف الخامات والمصروفات كاملة مع تأمين ربحك الحرفي دون زيادة غير مبررة على العميل.
        </span>
      </div>
    </div>
  );
};
