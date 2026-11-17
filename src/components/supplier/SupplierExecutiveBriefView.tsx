import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Coins,
  Factory,
  GitBranch,
  Home,
  MessageCircle,
  PhoneCall,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  SupplierExecutiveBrief,
  buildPoliteCollectionWhatsAppUrl,
  buildSupplierExecutiveBrief,
} from '../../services/executiveBriefService';
import { extractUserFirstName } from '../ai/ShamousaChatWidget';

interface SupplierExecutiveBriefViewProps {
  profile: UserProfile;
  onGoBack: () => void;
  onGoHome: () => void;
  onNavigateToView: (view: string) => void;
}

export const SupplierExecutiveBriefView: React.FC<SupplierExecutiveBriefViewProps> = ({
  profile,
  onGoBack,
  onGoHome,
  onNavigateToView,
}) => {
  const currency = profile.currencySymbol || 'ج.م';
  const firstName =
    extractUserFirstName(
      (profile as any).ownerName || (profile as any).fullName || profile.artistName
    ) || 'صديقي';

  const [brief, setBrief] = useState<SupplierExecutiveBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBrief = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await buildSupplierExecutiveBrief(
          currency,
          profile.brandName || 'متجر المورد'
        );
        setBrief(res);
      } catch (err) {
        console.error('Failed loading supplier executive brief:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currency, profile.brandName]
  );

  useEffect(() => {
    loadBrief(false);
  }, [loadBrief]);

  const fmt = (n: number) => Math.round(n || 0).toLocaleString('ar-EG');

  return (
    <div dir="rtl" className="max-w-6xl mx-auto px-3 sm:px-6 py-4 space-y-5">
      {/* شريط العنوان */}
      <div className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onGoBack}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
          >
            <ArrowRight className="w-4 h-4 text-[#EA580C]" />
            <span>رجوع</span>
          </button>

          <button
            type="button"
            onClick={onGoHome}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
          >
            <Home className="w-4 h-4 text-[#EA580C]" />
            <span>الرئيسية</span>
          </button>

          <div className="pr-1">
            <h1 className="text-base sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>هلخصهالك للموردين — الخلاصة البسيطة لفروعك وخزينتك</span>
            </h1>
            <p className="text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
              يا {firstName}، دي خلاصة وضع الفلوس في خزينة المالك وعهد الفروع، اللي ليك عند الورش، اللي عليك للمصانع، وجرد الفروع بالمختصر المفيد.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadBrief(true)}
          disabled={refreshing}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] dark:bg-[#EA580C] dark:hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>تحديث الأرقام الآن</span>
        </button>
      </div>

      {loading || !brief ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
          <div className="w-9 h-9 border-4 border-[#EA580C] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-[#475569] dark:text-[#CBD5E1]">
            ثواني بنراجع خزائن الفروع وكشوف الورش والمصانع...
          </p>
        </div>
      ) : (
        <>
          {/* أولاً: المدير المالي لشجرة المورد */}
          <section className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#EA580C]/40 flex items-center justify-center text-[#EA580C] dark:text-[#FBBF24]">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    أولاً: موقف الفلوس — في خزنة المالك vs في الفروع
                  </h2>
                  <p className="text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
                    إجمالي السيولة المتاحة لحظياً في الشركة كلها، ومبيعات الكاشير النهارده.
                  </p>
                </div>
              </div>

              <div className="text-xs font-black tabular-nums text-[#0C1427] dark:text-[#FBBF24] bg-[#EFE9DC] dark:bg-[#132040] px-3.5 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E]">
                صافي مركزك المالي: {fmt(brief.financial.netWorkingPosition)} {currency}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* 1. معانا كام وفين */}
              <div className="rounded-2xl bg-emerald-50/75 dark:bg-[#061A14] border border-emerald-300 dark:border-emerald-700/60 p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-900 dark:text-emerald-300">
                      معانا كام وفين؟
                    </span>
                    <Wallet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black tabular-nums text-emerald-800 dark:text-emerald-200">
                    {fmt(brief.financial.totalCashOnHand)}{' '}
                    <span className="text-xs font-bold">{currency}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-emerald-950/90 dark:text-emerald-100/90">
                    يا {firstName}، في خزينة المالك المعتمدة معانا{' '}
                    <strong className="tabular-nums">
                      {fmt(brief.financial.ownerMainTreasuryTotal)} {currency}
                    </strong>
                    ، ولسه في عُهد وخزائن الفروع قبل التوريد{' '}
                    <strong className="tabular-nums">
                      {fmt(brief.financial.branchesPendingTreasuryTotal)} {currency}
                    </strong>
                    .
                    {brief.financial.pendingTransfersCount > 0 && (
                      <span className="block mt-1 font-black text-[#C2410C] dark:text-amber-300">
                        تنبيه: فيه {brief.financial.pendingTransfersCount} توريدات من الفروع مستنية تأكيد استلامك!
                      </span>
                    )}
                  </p>
                </div>

                {brief.financial.branchesSummary.length > 0 && (
                  <div className="pt-2.5 border-t border-emerald-200 dark:border-emerald-800/60 space-y-1.5">
                    {brief.financial.branchesSummary.map((b) => (
                      <div
                        key={b.branchId}
                        className="flex items-center justify-between text-[11px] font-bold text-emerald-950 dark:text-emerald-100"
                      >
                        <span className="truncate">{b.branchName}</span>
                        <span className="tabular-nums shrink-0 mr-2">
                          {fmt(b.total)} {currency}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onNavigateToView('supplier_erp_hub')}
                  className="w-full py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black transition cursor-pointer"
                >
                  فتح مركز الفروع والتوريدات
                </button>
              </div>

              {/* 2. لينا كام بره عند الورش والعملاء */}
              <div className="rounded-2xl bg-amber-50/75 dark:bg-[#191206] border border-amber-300 dark:border-amber-700/60 p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-900 dark:text-amber-300">
                      لينا كام بره عند الورش والعملاء؟
                    </span>
                    <Users className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div className="text-2xl font-black tabular-nums text-amber-800 dark:text-amber-200">
                    {fmt(brief.financial.receivablesTotal)}{' '}
                    <span className="text-xs font-bold">{currency}</span>
                  </div>

                  {brief.financial.debtors.length === 0 ? (
                    <p className="text-xs leading-relaxed text-amber-950/90 dark:text-amber-100/90">
                      {brief.financial.receivablesTotal > 0
                        ? `إجمالي الآجل المسجل على الكاشير هو ${fmt(brief.financial.receivablesTotal)} ${currency}. تقدر تراجع تفاصيله من كاشير الفروع.`
                        : 'ما شاء الله، مفيش مديونيات آجلة بره عند الورش والعملاء حالياً.'}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pl-1">
                      {brief.financial.debtors.map((d) => (
                        <div
                          key={d.key}
                          className="p-2.5 rounded-xl bg-white/80 dark:bg-[#0D162E] border border-amber-200 dark:border-amber-800/50 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                              لينا عند {d.name}
                            </span>
                            <span className="font-black tabular-nums text-[#C2410C] dark:text-[#FBBF24] shrink-0">
                              {fmt(d.totalOwed)} {currency}
                            </span>
                          </div>
                          {d.warningText && (
                            <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-start gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span>{d.warningText}</span>
                            </p>
                          )}
                          {d.phone && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <a
                                href={`tel:${d.phone}`}
                                className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 dark:text-emerald-300 hover:underline"
                              >
                                <PhoneCall className="w-3 h-3" />
                                <span>اتصال: {d.phone}</span>
                              </a>
                              <a
                                href={buildPoliteCollectionWhatsAppUrl(
                                  d.phone,
                                  d.name,
                                  d.totalOwed,
                                  currency,
                                  brief.brandName
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black transition"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>تذكير لطيف بالواتساب</span>
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToView('supplier_customers')}
                  className="w-full py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black transition cursor-pointer"
                >
                  فتح دليل العملاء والورش
                </button>
              </div>

              {/* 3. علينا كام للمصانع والموردين */}
              <div className="rounded-2xl bg-rose-50/70 dark:bg-[#190A0D] border border-rose-300 dark:border-rose-800/60 p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-rose-900 dark:text-rose-300">
                      علينا كام للمصانع؟
                    </span>
                    <Factory className="w-4 h-4 text-rose-700 dark:text-rose-400" />
                  </div>
                  <div className="text-2xl font-black tabular-nums text-rose-800 dark:text-rose-200">
                    {fmt(brief.financial.payablesTotal)}{' '}
                    <span className="text-xs font-bold">{currency}</span>
                  </div>

                  {brief.financial.creditors.length === 0 ? (
                    <p className="text-xs leading-relaxed text-rose-950/90 dark:text-rose-100/90">
                      مفيش أي مستحقات آجلة للمصانع أو التجار الكبار حالياً — حسابك خالص معاهم.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pl-1">
                      {brief.financial.creditors.map((c) => (
                        <div
                          key={c.key}
                          className="p-2.5 rounded-xl bg-white/80 dark:bg-[#0D162E] border border-rose-200 dark:border-rose-800/50 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-black truncate">علينا لمصنع {c.name}</span>
                          <span className="font-black tabular-nums text-rose-700 dark:text-rose-300 shrink-0">
                            {fmt(c.totalOwed)} {currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToView('supplier_warehouse_erp')}
                  className="w-full py-2 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] dark:bg-rose-700 dark:hover:bg-rose-800 text-white text-xs font-black transition cursor-pointer"
                >
                  فتح حسابات المصانع والمشتريات
                </button>
              </div>
            </div>

            {/* شريط مبيعات اليوم */}
            <div className="rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-bold">
              <span>
                🛒 مبيعات الكاشير اليوم: <strong className="tabular-nums text-[#EA580C]">{brief.financial.todayPosOrdersCount}</strong> فاتورة بإجمالي{' '}
                <strong className="tabular-nums text-emerald-700 dark:text-emerald-300">
                  {fmt(brief.financial.todayPosSales)} {currency}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => onNavigateToView('supplier_pos')}
                className="px-3.5 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>فتح شاشة الكاشير (POS)</span>
              </button>
            </div>
          </section>

          {/* ثانياً: وضع مخازن الفروع */}
          <section className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#EA580C]/40 flex items-center justify-center text-[#EA580C] dark:text-[#FBBF24]">
                  <Warehouse className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    ثانياً: وضع المخازن في الفروع — عندنا بضاعة بكام وإيه اللي ناقص؟
                  </h2>
                  <p className="text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
                    إجمالي قيمة البضاعة في {brief.warehouse.branchesCount} فروع ومخازن ({brief.warehouse.itemsCount} صنف مسجل).
                  </p>
                </div>
              </div>
              <div className="text-xs font-black tabular-nums bg-[#EFE9DC] dark:bg-[#132040] px-3.5 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E]">
                قيمة المخزون: {fmt(brief.warehouse.totalStockValuation)} {currency}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* نواقص المخزون */}
              <div className="rounded-2xl bg-[#EFE9DC]/65 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
                <h3 className="text-xs font-black flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4" />
                  <span>أصناف وصلت لحد التنبيه أو قربت تخلص ({brief.warehouse.lowStockItems.length})</span>
                </h3>
                {brief.warehouse.lowStockItems.length === 0 ? (
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>كل الفروع والمخازن متغطية تمام — مفيش نواقص دلوقتي.</span>
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {brief.warehouse.lowStockItems.map((it) => (
                      <div key={it.id} className="p-2 rounded-xl bg-white/80 dark:bg-[#0D162E] flex items-center justify-between text-xs">
                        <div>
                          <span className="font-black block">{it.name}</span>
                          <span className="text-[10px] text-[#64748B]">{it.branchName} · {it.skuCode}</span>
                        </div>
                        <span className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-300">
                          متاح {it.quantity} {it.saleUnit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* أعلى الأصناف قيمة بالمخزن */}
              <div className="rounded-2xl bg-[#EFE9DC]/65 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
                <h3 className="text-xs font-black flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <TrendingUp className="w-4 h-4" />
                  <span>أكبر مخزون فلوسه واقفة في البضاعة (أعلى قيمة)</span>
                </h3>
                {brief.warehouse.highestValueItems.length === 0 ? (
                  <p className="text-xs text-[#64748B]">لسه مفيش أصناف مضافة في جرد الفروع.</p>
                ) : (
                  <div className="space-y-1.5">
                    {brief.warehouse.highestValueItems.map((it) => (
                      <div key={it.id} className="p-2 rounded-xl bg-white/80 dark:bg-[#0D162E] flex items-center justify-between text-xs">
                        <div>
                          <span className="font-black block">{it.name}</span>
                          <span className="text-[10px] text-[#64748B]">{it.branchName} · رصيد {it.quantity} {it.saleUnit}</span>
                        </div>
                        <span className="font-mono tabular-nums font-black text-emerald-700 dark:text-emerald-300">
                          {fmt(it.valuation)} {currency}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigateToView('supplier_warehouse_erp')}
                className="px-4 py-2 rounded-xl bg-[#0C1427] dark:bg-[#EA580C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>فتح جرد المخازن وكارت الصنف</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateToView('supplier_erp_hub')}
                className="px-4 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <GitBranch className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>إدارة شجرة الفروع</span>
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
