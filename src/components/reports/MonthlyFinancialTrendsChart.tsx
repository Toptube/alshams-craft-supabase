import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
} from 'lucide-react';
import {
  SupplierPurchaseInvoice,
  CustomerOrder,
  EmployeePayoutRecord,
  AdminCostRecord,
} from '../../types';

interface MonthlyFinancialTrendsChartProps {
  supplierInvoices: SupplierPurchaseInvoice[];
  orders: CustomerOrder[];
  employeePayouts: EmployeePayoutRecord[];
  adminCosts: AdminCostRecord[];
  currencySymbol: string;
}

export const MonthlyFinancialTrendsChart: React.FC<MonthlyFinancialTrendsChartProps> = ({
  supplierInvoices,
  orders,
  employeePayouts,
  adminCosts,
  currencySymbol,
}) => {
  const trendsData = useMemo(() => {
    const arabicMonths = [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth();

    const monthSlots: Array<{
      monthLabel: string;
      startTimestamp: number;
      endTimestamp: number;
    }> = [];

    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonthIdx - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const startTimestamp = new Date(y, m, 1).getTime();
      const endTimestamp = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();

      monthSlots.push({
        monthLabel: `${arabicMonths[m]}${y !== currentYear ? ` '${String(y).slice(2)}` : ''}`,
        startTimestamp,
        endTimestamp,
      });
    }

    return monthSlots.map((slot) => {
      // 1. Material purchases in this month
      const matSpending = supplierInvoices
        .filter((inv) => {
          const t = inv.createdAt || (inv.date ? new Date(inv.date).getTime() : 0);
          return t >= slot.startTimestamp && t <= slot.endTimestamp;
        })
        .reduce((sum, inv) => sum + (Number(inv.paidAmount || inv.totalAmount) || 0), 0);

      // 2. Sales revenues in this month
      const salesRev = orders
        .filter((ord) => {
          const t = ord.createdAt || (ord.date ? new Date(ord.date).getTime() : 0);
          return t >= slot.startTimestamp && t <= slot.endTimestamp && ord.status !== 'cancelled';
        })
        .reduce(
          (sum, ord) => sum + (ord.finalTotal || ord.totalAmount || ord.subtotal || 0),
          0
        );

      // 3. Operating expenses (Wages + Admin)
      const wages = employeePayouts
        .filter((p) => {
          const t = p.createdAt || (p.date ? new Date(p.date).getTime() : 0);
          return t >= slot.startTimestamp && t <= slot.endTimestamp;
        })
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const admin = adminCosts
        .filter((a) => {
          const t = a.createdAt || (a.date ? new Date(a.date).getTime() : 0);
          return t >= slot.startTimestamp && t <= slot.endTimestamp;
        })
        .reduce((sum, a) => sum + (Number(a.baseCurrencyAmount || a.amount) || 0), 0);

      const netProfit = Math.round(salesRev - (matSpending + wages + admin));

      return {
        month: slot.monthLabel,
        materialSpending: Math.round(matSpending),
        netProfit: netProfit,
        salesRevenue: Math.round(salesRev),
      };
    });
  }, [supplierInvoices, orders, employeePayouts, adminCosts]);

  // Compute growth indicator between current month and previous month
  const growthStats = useMemo(() => {
    if (trendsData.length < 2) {
      return { growthPercent: 0, isPositive: true };
    }
    const current = trendsData[trendsData.length - 1].netProfit;
    const prev = trendsData[trendsData.length - 2].netProfit;

    if (prev === 0) {
      return { growthPercent: current > 0 ? 100 : 0, isPositive: current >= 0 };
    }

    const diff = current - prev;
    const pct = Math.round((diff / Math.abs(prev)) * 100);
    return {
      growthPercent: Math.abs(pct),
      isPositive: pct >= 0,
    };
  }, [trendsData]);

  const latestMonth = trendsData[trendsData.length - 1] || {
    materialSpending: 0,
    netProfit: 0,
  };

  // Custom Tooltip Formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 rounded-2xl bg-stone-900 text-white border border-stone-700 shadow-xl text-right text-xs space-y-1.5">
          <p className="font-black text-amber-300 border-b border-stone-800 pb-1">{label}</p>
          <div className="flex items-center justify-between gap-4">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>صافي الأرباح:</span>
            </span>
            <span className="font-mono font-black text-emerald-300">
              {Number(payload[0]?.value || 0).toLocaleString()} {currencySymbol}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>إنفاق الخامات:</span>
            </span>
            <span className="font-mono font-black text-amber-300">
              {Number(payload[1]?.value || 0).toLocaleString()} {currencySymbol}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-5">
      {/* Header & Growth Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100">
                لوحة تحليل اتجاهات الإنفاق والأرباح الشهرية
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300 font-bold border border-emerald-300/60 dark:border-emerald-800">
                تحليل آخر ٦ أشهر
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              مقارنة مسار الإنفاق على خامات التوريد بصافي الأرباح المحققة شهرياً
            </p>
          </div>
        </div>

        {/* Growth Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-black self-start sm:self-center ${
            growthStats.isPositive
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
          }`}
        >
          {growthStats.isPositive ? (
            <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          )}
          <span>
            {growthStats.isPositive ? '+' : '-'}
            {growthStats.growthPercent}% نمو الأرباح هذا الشهر
          </span>
        </div>
      </div>

      {/* 2 Quick KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
        {/* Net Profit Card */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0 shadow-2xs" />
            <div>
              <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 block">
                صافي الأرباح المحققة (هذا الشهر)
              </span>
              <span className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400 block mt-0.5">
                {latestMonth.netProfit >= 0 ? `+${latestMonth.netProfit.toLocaleString()}` : latestMonth.netProfit.toLocaleString()}{' '}
                {currencySymbol}
              </span>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold">
            صافي العائد الحرفي
          </span>
        </div>

        {/* Materials Spending Card */}
        <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0 shadow-2xs" />
            <div>
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 block">
                الإنفاق على الخامات (هذا الشهر)
              </span>
              <span className="text-lg font-black font-mono text-amber-700 dark:text-amber-400 block mt-0.5">
                {latestMonth.materialSpending.toLocaleString()} {currencySymbol}
              </span>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold">
            مشتريات التوريد
          </span>
        </div>
      </div>

      {/* Visual Recharts Area Chart */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={trendsData}
            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
          >
            <defs>
              <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="materialGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#78716c' }}
              interval={0}
              tickMargin={8}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#78716c' }}
              tickFormatter={(v) => `${v.toLocaleString()}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => {
                if (value === 'netProfit') return 'صافي الأرباح المحققة (الأخضر الزمردي)';
                if (value === 'materialSpending') return 'الإنفاق على الخامات (العسلي الدافئ)';
                return value;
              }}
            />
            {/* Area 1: Net Profit (Emerald) */}
            <Area
              type="monotone"
              dataKey="netProfit"
              stroke="#10b981"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#profitGrad)"
              name="netProfit"
            />
            {/* Area 2: Material Spending (Warm Amber) */}
            <Area
              type="monotone"
              dataKey="materialSpending"
              stroke="#f59e0b"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#materialGrad)"
              name="materialSpending"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Explanatory Craft Footer Note */}
      <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200/80 dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-400 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>
            كلما زادت الفجوة بين خط الأرباح (الأخضر) وخط الخامات (العسلي)، دل ذلك على ارتفاع كفاءة التشغيل وهوامش أمان ممتازة لورشتك.
          </span>
        </span>
      </div>
    </div>
  );
};
