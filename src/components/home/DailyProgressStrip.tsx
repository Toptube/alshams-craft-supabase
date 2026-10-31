import React from 'react';
import {
  TrendingUp,
  ShoppingBag,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Plus,
  Sparkles,
  PackageCheck,
  Truck,
} from 'lucide-react';
import { playButtonClickSound } from '../../lib/sounds';

interface DailyProgressStripProps {
  todaySalesTotal: number;
  todaySalesCount: number;
  todayCompletedProductionCount: number;
  lowStockMaterialsCount: number;
  currencySymbol: string;
  onOpenSupplierInvoice: () => void;
  onNavigateToSales?: () => void;
  onNavigateToWorkOrders?: () => void;
}

export const DailyProgressStrip: React.FC<DailyProgressStripProps> = ({
  todaySalesTotal,
  todaySalesCount,
  todayCompletedProductionCount,
  lowStockMaterialsCount,
  currencySymbol,
  onOpenSupplierInvoice,
  onNavigateToSales,
  onNavigateToWorkOrders,
}) => {
  return (
    <div className="p-3.5 sm:p-4 rounded-3xl bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white shadow-md border border-stone-800">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Strip Title & Badge */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-500 text-stone-950 flex items-center justify-center font-bold shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-amber-300 flex items-center gap-1.5">
              <span>إنجاز ورشتنا اليوم</span>
            </h4>
            <p className="text-[10px] text-stone-400">
              ملخص لحظي للمبيعات، الإنتاج، ونواقص الخامات
            </p>
          </div>
        </div>

        {/* 3 Metric Pills / Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
          {/* 1. مبيعات اليوم */}
          <div
            onClick={() => {
              playButtonClickSound();
              onNavigateToSales?.();
            }}
            className="p-2.5 sm:p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center justify-between gap-3 cursor-pointer group"
            title="عرض سجل المبيعات والفواتير"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-stone-400 block font-bold">مبيعات اليوم</span>
                <span className="text-xs sm:text-sm font-black font-mono text-emerald-400 block truncate">
                  {todaySalesTotal > 0 ? `+${todaySalesTotal.toLocaleString()}` : '0'}{' '}
                  <span className="text-[10px] font-normal">{currencySymbol}</span>
                </span>
              </div>
            </div>
            <div className="text-left shrink-0">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 font-bold border border-emerald-800 font-mono">
                {todaySalesCount} {todaySalesCount === 1 ? 'بيعة' : 'فواتير'}
              </span>
            </div>
          </div>

          {/* 2. الإنتاج المكتمل */}
          <div
            onClick={() => {
              playButtonClickSound();
              onNavigateToWorkOrders?.();
            }}
            className="p-2.5 sm:p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center justify-between gap-3 cursor-pointer group"
            title="عرض أوامر التشغيل والإنتاج"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <PackageCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-stone-400 block font-bold">الإنتاج المكتمل</span>
                <span className="text-xs sm:text-sm font-black text-blue-300 block truncate font-mono">
                  {todayCompletedProductionCount} مشغولات
                </span>
              </div>
            </div>
            <div className="text-left shrink-0">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 font-bold border border-blue-800">
                جاهز للتسليم
              </span>
            </div>
          </div>

          {/* 3. نواقص تستوجب الشراء */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  lowStockMaterialsCount > 0
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                    : 'bg-stone-700/40 text-stone-400 border border-stone-600/30'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-stone-400 block font-bold">نواقص تستوجب الشراء</span>
                <span
                  className={`text-xs sm:text-sm font-black block truncate font-mono ${
                    lowStockMaterialsCount > 0 ? 'text-amber-400' : 'text-stone-300'
                  }`}
                >
                  {lowStockMaterialsCount > 0 ? `${lowStockMaterialsCount} خامات ناقصة` : 'المخزون مكتمل'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playButtonClickSound();
                onOpenSupplierInvoice();
              }}
              className="px-2.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black shadow-xs flex items-center gap-1 cursor-pointer transition shrink-0"
              title="فتح نافذة طلب شراء وتوريد خامات جديدة"
            >
              <Truck className="w-3 h-3" />
              <span>طلب توريد</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
