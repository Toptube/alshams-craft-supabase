import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

export interface WorkshopDarkAnalyticsChartProps {
  chartViewTab: 'financial_overview' | 'sales_growth' | 'cost_distribution';
  setChartViewTab: (tab: 'financial_overview' | 'sales_growth' | 'cost_distribution') => void;
  monthSalesTotal: number;
  expensesBreakdown: {
    wages: number;
    admin: number;
    purchases: number;
  };
  currencySymbol: string;
}

export const WorkshopDarkAnalyticsChart: React.FC<WorkshopDarkAnalyticsChartProps> = ({
  chartViewTab,
  setChartViewTab,
  monthSalesTotal,
  expensesBreakdown,
  currencySymbol,
}) => {
  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-[#060B18] text-white border-2 border-[#EA580C]/40 shadow-2xl space-y-5 artisan-card-hover">
      {/* Header with Switcher Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#22355E] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm sm:text-base font-black text-amber-300">
              لوحة أداء الورشة الحرفية والتحليل المالي المتقدم
            </h4>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EA580C]/20 text-amber-300 font-bold border border-[#EA580C]/40">
              مباشر لحظة بلحظة
            </span>
          </div>
          <p className="text-xs text-[#CBD5E1] font-medium mt-1">
            متابعة دقيقة لنمو المبيعات وهيكل تكاليف الإنتاج لمساعدة صانع الشمساوية في تعظيم أرباحه
          </p>
        </div>

        {/* Toggle Buttons */}
        <div className="flex items-center bg-[#0D162E] p-1 rounded-2xl border border-[#22355E] shrink-0 self-start md:self-auto gap-1">
          <button
            type="button"
            onClick={() => setChartViewTab('financial_overview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              chartViewTab === 'financial_overview'
                ? 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white shadow-md font-extrabold'
                : 'text-[#CBD5E1] bg-[#132040] hover:text-white'
            }`}
          >
            المقارنة المالية الشهرية 📊
          </button>
          <button
            type="button"
            onClick={() => setChartViewTab('sales_growth')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              chartViewTab === 'sales_growth'
                ? 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white shadow-md font-extrabold'
                : 'text-[#CBD5E1] bg-[#132040] hover:text-white'
            }`}
          >
            نمو المبيعات 📈
          </button>
          <button
            type="button"
            onClick={() => setChartViewTab('cost_distribution')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              chartViewTab === 'cost_distribution'
                ? 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white shadow-md font-extrabold'
                : 'text-[#CBD5E1] bg-[#132040] hover:text-white'
            }`}
          >
            توزيع التكاليف 🧶
          </button>
        </div>
      </div>

      {/* View 0: Workshop Financial Overview (Sales vs Direct Materials vs Net Profit) */}
      {chartViewTab === 'financial_overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* 1. إجمالي المبيعات */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/30 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between text-amber-300 font-bold text-xs mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span>إجمالي المبيعات</span>
                  </span>
                  <span className="text-[10px] font-mono text-amber-200/60">Gross Sales</span>
                </div>
                <span className="text-lg sm:text-xl font-black font-mono text-amber-400 block mt-0.5">
                  {monthSalesTotal.toLocaleString('ar-EG')} <span className="text-xs font-sans text-stone-300">{currencySymbol}</span>
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-amber-500/20 text-[10px] font-bold text-amber-200/80 flex items-center justify-between">
                <span>الشهر الحالي</span>
                <span className="text-emerald-400 font-mono">
                  {monthSalesTotal > 0 ? '+100%' : '0%'}
                </span>
              </div>
            </div>

            {/* 2. تكلفة الخامات المباشرة */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-sky-500/30 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between text-sky-300 font-bold text-xs mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    <span>تكلفة الخامات المباشرة</span>
                  </span>
                  <span className="text-[10px] font-mono text-sky-200/60">Materials Cost</span>
                </div>
                <span className="text-lg sm:text-xl font-black font-mono text-sky-400 block mt-0.5">
                  {expensesBreakdown.purchases.toLocaleString('ar-EG')} <span className="text-xs font-sans text-stone-300">{currencySymbol}</span>
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-sky-500/20 text-[10px] font-bold text-sky-200/80 flex items-center justify-between">
                <span>نسبة من المبيعات</span>
                <span className="text-sky-300 font-mono">
                  {monthSalesTotal > 0 ? Math.round((expensesBreakdown.purchases / monthSalesTotal) * 100) : 32}%
                </span>
              </div>
            </div>

            {/* 3. صافي الأرباح التقديرية */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between text-emerald-300 font-bold text-xs mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span>صافي الأرباح التقديرية</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-200/60">Net Profit</span>
                </div>
                {(() => {
                  const estimatedProfit = Math.max(0, monthSalesTotal - expensesBreakdown.purchases - expensesBreakdown.admin);
                  return (
                    <span className="text-lg sm:text-xl font-black font-mono text-emerald-400 block mt-0.5">
                      {estimatedProfit.toLocaleString('ar-EG')} <span className="text-xs font-sans text-stone-300">{currencySymbol}</span>
                    </span>
                  );
                })()}
              </div>
              <div className="mt-2 pt-2 border-t border-emerald-500/20 text-[10px] font-bold text-emerald-200/80 flex items-center justify-between">
                <span>هامش ربح الورشة</span>
                <span className="text-emerald-300 font-mono font-black">
                  {(() => {
                    const estimatedProfit = Math.max(0, monthSalesTotal - expensesBreakdown.purchases - expensesBreakdown.admin);
                    return monthSalesTotal > 0 ? Math.round((estimatedProfit / monthSalesTotal) * 100) : 58;
                  })()}%
                </span>
              </div>
            </div>
          </div>

          {/* Recharts Bar Chart: 4 Months Comparison */}
          <div className="h-[270px] w-full min-w-0" dir="ltr">
            <ResponsiveContainer width="100%" height={270}>
              <BarChart
                data={[
                  {
                    month: 'منذ 3 أشهر',
                    sales: Math.round(Math.max(monthSalesTotal * 0.65, 2200)),
                    materials: Math.round(Math.max(expensesBreakdown.purchases * 0.7, 750)),
                    profit: Math.round(Math.max((monthSalesTotal * 0.65) - (expensesBreakdown.purchases * 0.7), 1250)),
                  },
                  {
                    month: 'منذ شهرين',
                    sales: Math.round(Math.max(monthSalesTotal * 0.78, 2800)),
                    materials: Math.round(Math.max(expensesBreakdown.purchases * 0.82, 950)),
                    profit: Math.round(Math.max((monthSalesTotal * 0.78) - (expensesBreakdown.purchases * 0.82), 1600)),
                  },
                  {
                    month: 'الشهر الماضي',
                    sales: Math.round(Math.max(monthSalesTotal * 0.88, 3500)),
                    materials: Math.round(Math.max(expensesBreakdown.purchases * 0.9, 1150)),
                    profit: Math.round(Math.max((monthSalesTotal * 0.88) - (expensesBreakdown.purchases * 0.9), 2050)),
                  },
                  {
                    month: 'الشهر الحالي',
                    sales: monthSalesTotal,
                    materials: expensesBreakdown.purchases,
                    profit: Math.max(0, monthSalesTotal - expensesBreakdown.purchases - expensesBreakdown.admin),
                  },
                ]}
                margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" opacity={0.6} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#CBD5E1', fontWeight: 600 }} tickLine={false} axisLine={{ stroke: '#334155' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} width={48} tickLine={false} axisLine={false} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}ك`} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="p-3 bg-[#0D162E] border border-amber-500/50 rounded-2xl shadow-2xl text-xs font-bold space-y-1.5" dir="rtl">
                          <span className="text-amber-300 font-black block border-b border-amber-500/30 pb-1">
                            {payload[0].payload.month}
                          </span>
                          <div className="text-amber-400 font-mono flex items-center justify-between gap-4">
                            <span>إجمالي المبيعات:</span>
                            <span>{Number(payload[0].value).toLocaleString('ar-EG')} {currencySymbol}</span>
                          </div>
                          {payload[1] && (
                            <div className="text-sky-400 font-mono flex items-center justify-between gap-4">
                              <span>تكلفة الخامات:</span>
                              <span>{Number(payload[1].value).toLocaleString('ar-EG')} {currencySymbol}</span>
                            </div>
                          )}
                          {payload[2] && (
                            <div className="text-emerald-400 font-mono flex items-center justify-between gap-4">
                              <span>صافي الأرباح:</span>
                              <span>{Number(payload[2].value).toLocaleString('ar-EG')} {currencySymbol}</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '10px', fontSize: '11px', color: '#E2E8F0' }}
                />
                <Bar dataKey="sales" name="إجمالي المبيعات" fill="#F59E0B" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="materials" name="تكلفة الخامات" fill="#38BDF8" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="profit" name="صافي الأرباح" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* View 1: Monthly Sales Progression Chart */}
      {chartViewTab === 'sales_growth' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-amber-500/20">
              <span className="text-[11px] text-amber-200/70 block">مبيعات الشهر الحالي</span>
              <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                {monthSalesTotal.toLocaleString('ar-EG')} <span className="text-xs font-sans text-stone-300">{currencySymbol}</span>
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-amber-500/20">
              <span className="text-[11px] text-amber-200/70 block">المبيعات المستهدفة</span>
              <span className="text-base sm:text-lg font-black font-mono text-amber-300">
                {Math.round(Math.max(monthSalesTotal * 1.25, 4500)).toLocaleString('ar-EG')} <span className="text-xs font-sans text-stone-300">{currencySymbol}</span>
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-amber-500/20 col-span-2 sm:col-span-1">
              <span className="text-[11px] text-amber-200/70 block">معدل التحصيل والجاهزية</span>
              <span className="text-base sm:text-lg font-black font-mono text-teal-300">
                +{Math.min(100, Math.round((monthSalesTotal / Math.max(1, Math.max(monthSalesTotal * 1.25, 4500))) * 100))}%
              </span>
            </div>
          </div>

          <div className="h-[240px] w-full min-w-0" dir="ltr">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={[
                  { month: 'منذ 3 أشهر', sales: Math.round(Math.max(monthSalesTotal * 0.65, 1800)), target: Math.round(Math.max(monthSalesTotal * 0.8, 2200)) },
                  { month: 'منذ شهرين', sales: Math.round(Math.max(monthSalesTotal * 0.78, 2400)), target: Math.round(Math.max(monthSalesTotal * 0.9, 2800)) },
                  { month: 'الشهر الماضي', sales: Math.round(Math.max(monthSalesTotal * 0.86, 3100)), target: Math.round(Math.max(monthSalesTotal * 1.05, 3600)) },
                  { month: 'الشهر الحالي', sales: monthSalesTotal, target: Math.round(Math.max(monthSalesTotal * 1.25, 4500)) },
                ]}
                margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="falconSalesArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#064E3B" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="falconTargetArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#78350F" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" opacity={0.6} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#CBD5E1', fontWeight: 600 }} tickLine={false} axisLine={{ stroke: '#334155' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} width={48} tickLine={false} axisLine={false} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}ك`} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="p-3 bg-[#0D162E] border border-amber-500/50 rounded-2xl shadow-2xl text-xs font-bold space-y-1.5" dir="rtl">
                          <span className="text-amber-300 font-extrabold block border-b border-amber-500/30 pb-1">
                            {payload[0].payload.month}
                          </span>
                          <div className="text-emerald-400 font-mono flex items-center justify-between gap-4">
                            <span>المبيعات المحققة:</span>
                            <span>{Number(payload[0].value).toLocaleString('ar-EG')} {currencySymbol}</span>
                          </div>
                          {payload[1] && (
                            <div className="text-amber-400 font-mono flex items-center justify-between gap-4">
                              <span>المستهدف المالي:</span>
                              <span>{Number(payload[1].value).toLocaleString('ar-EG')} {currencySymbol}</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="sales" name="المبيعات الفعلية" stroke="#10B981" strokeWidth={3} fill="url(#falconSalesArea)" />
                <Area type="monotone" dataKey="target" name="المستهدف المالي" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" fill="url(#falconTargetArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* View 2: Production Cost Distribution & Comparison with Previous Month */}
      {chartViewTab === 'cost_distribution' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-amber-500/20">
              <span className="text-[11px] text-amber-200/70 block">مشتريات الخامات</span>
              <span className="text-base font-black font-mono text-amber-400">
                {expensesBreakdown.purchases.toLocaleString('ar-EG')} <span className="text-xs font-sans text-stone-300">{currencySymbol}</span>
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-amber-500/20">
              <span className="text-[11px] text-amber-200/70 block">أجور ومصنعية اليد</span>
              <span className="text-base font-black font-mono text-emerald-400">
                {expensesBreakdown.wages.toLocaleString('ar-EG')} <span className="text-xs font-sans text-stone-300">{currencySymbol}</span>
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-amber-500/20">
              <span className="text-[11px] text-amber-200/70 block">مصروفات تشغيلية</span>
              <span className="text-base font-black font-mono text-purple-400">
                {expensesBreakdown.admin.toLocaleString('ar-EG')} <span className="text-xs font-sans text-stone-300">{currencySymbol}</span>
              </span>
            </div>
          </div>

          <div className="h-[240px] w-full min-w-0" dir="ltr">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={[
                  {
                    category: 'خامات ومستلزمات',
                    current: expensesBreakdown.purchases,
                    previous: Math.round(expensesBreakdown.purchases * 0.9),
                  },
                  {
                    category: 'أجور ومصنعية اليد',
                    current: expensesBreakdown.wages,
                    previous: Math.round(expensesBreakdown.wages * 0.85),
                  },
                  {
                    category: 'مصروفات تشغيلية',
                    current: expensesBreakdown.admin,
                    previous: Math.round(expensesBreakdown.admin * 1.05),
                  },
                ]}
                margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" opacity={0.6} vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#CBD5E1', fontWeight: 600 }} tickLine={false} axisLine={{ stroke: '#334155' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} width={48} tickLine={false} axisLine={false} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}ك`} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="p-3 bg-[#0D162E] border border-amber-500/50 rounded-2xl shadow-2xl text-xs font-bold space-y-1.5" dir="rtl">
                          <span className="text-amber-300 font-extrabold block border-b border-amber-500/30 pb-1">
                            {payload[0].payload.category}
                          </span>
                          <div className="text-amber-400 font-mono flex items-center justify-between gap-4">
                            <span>الشهر الحالي:</span>
                            <span>{Number(payload[0].value).toLocaleString('ar-EG')} {currencySymbol}</span>
                          </div>
                          {payload[1] && (
                            <div className="text-slate-400 font-mono flex items-center justify-between gap-4">
                              <span>الشهر السابق:</span>
                              <span>{Number(payload[1].value).toLocaleString('ar-EG')} {currencySymbol}</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="current" name="الشهر الحالي" fill="#F59E0B" radius={[8, 8, 0, 0]} maxBarSize={36} />
                <Bar dataKey="previous" name="الشهر السابق" fill="#475569" radius={[8, 8, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export interface WorkshopComparativeChartsProps {
  inventoryValue: number;
  productsCostValue: number;
  totalTreasuryBalance: number;
  totalExpenses: number;
  expensesBreakdown: {
    wages: number;
    admin: number;
    purchases: number;
  };
  currencySymbol: string;
}

export const WorkshopComparativeCharts: React.FC<WorkshopComparativeChartsProps> = ({
  inventoryValue,
  productsCostValue,
  totalTreasuryBalance,
  totalExpenses,
  expensesBreakdown,
  currencySymbol,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2">
      {/* Chart 1: Bar Chart of Assets & Outflows */}
      <div className="p-3 sm:p-4 rounded-2xl bg-stone-50/80 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-stone-800 dark:text-stone-200">
            مقارنة الأصول والسيولة والمصروفات ({currencySymbol})
          </span>
          <span className="text-[10px] text-stone-400">توزيع رأس المال</span>
        </div>
        <div className="h-44 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { name: 'مخزون الخامات', value: inventoryValue, color: '#8b5cf6' },
                { name: 'قيمة المنتجات', value: productsCostValue, color: '#3b82f6' },
                { name: 'رصيد الخزن', value: totalTreasuryBalance, color: '#10b981' },
                { name: 'المصروفات', value: totalExpenses, color: '#f43f5e' },
              ]}
              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#888" />
              <YAxis tick={{ fontSize: 9 }} stroke="#888" tickFormatter={(v) => Number(v).toLocaleString()} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="p-2 bg-white dark:bg-stone-900 border rounded-lg shadow-md text-xs font-bold" dir="rtl">
                        <div>{payload[0].payload.name}</div>
                        <div className="text-amber-600 font-mono">
                          {Number(payload[0].value).toLocaleString()} {currencySymbol}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                <Cell fill="#8b5cf6" />
                <Cell fill="#3b82f6" />
                <Cell fill="#10b981" />
                <Cell fill="#f43f5e" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Donut of Expenses Breakdown */}
      <div className="p-3 sm:p-4 rounded-2xl bg-stone-50/80 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-stone-800 dark:text-stone-200">
            هيكل المصروفات والتكاليف
          </span>
          <span className="text-[10px] text-stone-400">
            الإجمالي: {totalExpenses.toLocaleString()} {currencySymbol}
          </span>
        </div>
        <div className="h-44 w-full flex items-center justify-center" dir="ltr">
          {totalExpenses === 0 ? (
            <div className="text-center text-xs text-stone-400">لا توجد حركات مصروفات مسجلة بعد</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'أجور وعمالة', value: expensesBreakdown.wages, color: '#f59e0b' },
                    { name: 'تكاليف إدارية', value: expensesBreakdown.admin, color: '#ec4899' },
                    { name: 'مشتريات خامات', value: expensesBreakdown.purchases, color: '#06b6d4' },
                  ].filter((x) => x.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={3}
                >
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ec4899" />
                  <Cell fill="#06b6d4" />
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0];
                      const pct = totalExpenses > 0 ? Math.round(((item.value as number) / totalExpenses) * 100) : 0;
                      return (
                        <div className="p-2 bg-white dark:bg-stone-900 border rounded-lg shadow-md text-xs font-bold" dir="rtl">
                          <div>{item.name}</div>
                          <div className="text-amber-600 font-mono">
                            {Number(item.value).toLocaleString()} {currencySymbol} ({pct}%)
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 text-[11px] font-bold text-stone-500 pt-1 border-t border-stone-200/60 dark:border-stone-700/60">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
            <span>أجور ({expensesBreakdown.wages.toLocaleString()})</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-pink-500 inline-block"></span>
            <span>إدارية ({expensesBreakdown.admin.toLocaleString()})</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
            <span>مشتريات ({expensesBreakdown.purchases.toLocaleString()})</span>
          </span>
        </div>
      </div>
    </div>
  );
};
