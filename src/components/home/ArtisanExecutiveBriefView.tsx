import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Coins,
  Flame,
  Home,
  Layers,
  Package,
  PhoneCall,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  ArtisanExecutiveBrief,
  buildArtisanExecutiveBrief,
} from '../../services/executiveBriefService';
import { extractUserFirstName } from '../ai/ShamousaChatWidget';

interface ArtisanExecutiveBriefViewProps {
  profile: UserProfile;
  onGoBack: () => void;
  onGoHome: () => void;
  onNavigateToView: (view: string) => void;
}

export const ArtisanExecutiveBriefView: React.FC<ArtisanExecutiveBriefViewProps> = ({
  profile,
  onGoBack,
  onGoHome,
  onNavigateToView,
}) => {
  const workshopId = profile.tenantId || profile.workshopId || profile.id || '';
  const currency = profile.currencySymbol || 'ج.م';
  const firstName =
    extractUserFirstName(
      (profile as any).fullName || (profile as any).name || profile.artistName
    ) || 'صديقي';

  const [brief, setBrief] = useState<ArtisanExecutiveBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBrief = useCallback(
    async (isManual = false) => {
      if (!workshopId) return;
      if (isManual) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await buildArtisanExecutiveBrief(workshopId, currency);
        setBrief(res);
      } catch (err) {
        console.error('Failed to build executive brief:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workshopId, currency]
  );

  useEffect(() => {
    loadBrief(false);

    const onUpdated = () => {
      loadBrief(true);
    };
    window.addEventListener('alshams_treasury_updated', onUpdated);
    window.addEventListener('alshams_financials_updated', onUpdated);
    window.addEventListener('alshams_materials_updated', onUpdated);
    return () => {
      window.removeEventListener('alshams_treasury_updated', onUpdated);
      window.removeEventListener('alshams_financials_updated', onUpdated);
      window.removeEventListener('alshams_materials_updated', onUpdated);
    };
  }, [loadBrief]);

  const fmt = (n: number) => Math.round(n || 0).toLocaleString('ar-EG');

  return (
    <div dir="rtl" className="max-w-6xl mx-auto px-3 sm:px-6 py-4 space-y-5">
      {/* شريط العنوان العلوي والتنقل السريع */}
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
              <span>هلخصهالك — الملخص البسيط لورشتك</span>
            </h1>
            <p className="text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
              يا {firstName}، هنا الخلاصة كلها بالبلدي ومن غير تعقيدات حسابات — معاك كام وفين، ليك عند مين، وعليك لمين، والمخزن ماشي إزاي.
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
            ثواني بنجمع لك كل أرقام الفلوس والمخازن من دفاتر الورشة...
          </p>
        </div>
      ) : (
        <>
          {/* القسم الأول: حديث المدير المالي */}
          <section className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#EA580C]/40 flex items-center justify-center text-[#EA580C] dark:text-[#FBBF24]">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    أولاً: كلام المدير المالي — الفلوس رايحة فين وجاية منين؟
                  </h2>
                  <p className="text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
                    إجمالي اللي في إيدك واللي ليك بره واللي عليك للموردين، محسوب لحظياً.
                  </p>
                </div>
              </div>

              <div className="text-xs font-black tabular-nums text-[#0C1427] dark:text-[#FBBF24] bg-[#EFE9DC] dark:bg-[#132040] px-3.5 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E]">
                صافي وضعك المالي: {fmt(brief.financial.netWorkingPosition)} {currency}
              </div>
            </div>

            {/* ملخص الأرقام الثلاثة الأساسية بلغة بسيطة */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* 1. معانا كام وفين */}
              <div className="rounded-2xl bg-emerald-50/75 dark:bg-[#061A14] border border-emerald-300 dark:border-emerald-700/60 p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-900 dark:text-emerald-300">
                      معانا كام دلوقتي وفين؟
                    </span>
                    <Wallet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black tabular-nums text-emerald-800 dark:text-emerald-200">
                    {fmt(brief.financial.liquidity.totalLiquidity)}{' '}
                    <span className="text-xs font-bold">{currency}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-emerald-950/90 dark:text-emerald-100/90">
                    {brief.financial.liquidity.totalLiquidity > 0 ? (
                      <>
                        يا {firstName}، معانا سيولة جاهزة إجماليها{' '}
                        <strong className="tabular-nums">
                          {fmt(brief.financial.liquidity.totalLiquidity)} {currency}
                        </strong>
                        :{' '}
                        <strong className="tabular-nums">
                          {fmt(brief.financial.liquidity.cashTotal)} {currency}
                        </strong>{' '}
                        كاش، و{' '}
                        <strong className="tabular-nums">
                          {fmt(brief.financial.liquidity.instapayBankTotal)} {currency}
                        </strong>{' '}
                        في إنستاباي والبنك، و{' '}
                        <strong className="tabular-nums">
                          {fmt(brief.financial.liquidity.walletsCustodyTotal)} {currency}
                        </strong>{' '}
                        في المحافظ والعُهد.
                      </>
                    ) : (
                      'حالياً رصيد الخزائن مسجّل صفر — تقدر تسجل أول إيداع أو مبيعات من شاشة الخزائن.'
                    )}
                  </p>
                </div>

                {brief.financial.liquidity.treasuries.length > 0 && (
                  <div className="pt-2.5 border-t border-emerald-200 dark:border-emerald-800/60 space-y-1.5">
                    {brief.financial.liquidity.treasuries.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between text-[11px] font-bold text-emerald-950 dark:text-emerald-100"
                      >
                        <span className="truncate">
                          {t.name} <span className="opacity-70">({t.kindLabel})</span>
                        </span>
                        <span className="tabular-nums shrink-0 mr-2">
                          {fmt(t.balance)} {currency}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onNavigateToView('treasuries')}
                  className="w-full py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black transition cursor-pointer"
                >
                  فتح الخزائن والعُهد بالتفصيل
                </button>
              </div>

              {/* 2. لينا كام بره وعند مين */}
              <div className="rounded-2xl bg-amber-50/75 dark:bg-[#191206] border border-amber-300 dark:border-amber-700/60 p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-900 dark:text-amber-300">
                      لينا كام بره وعند مين؟
                    </span>
                    <Users className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div className="text-2xl font-black tabular-nums text-amber-800 dark:text-amber-200">
                    {fmt(brief.financial.receivablesTotal)}{' '}
                    <span className="text-xs font-bold">{currency}</span>
                  </div>

                  {brief.financial.debtors.length === 0 ? (
                    <p className="text-xs leading-relaxed text-amber-950/90 dark:text-amber-100/90">
                      ما شاء الله، مفيش أي فلوس متأخرة بره عند العملاء دلوقتي — كل الفواتير متحصلة تمام.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs leading-relaxed text-amber-950/90 dark:text-amber-100/90">
                        إنت ليك بره عند <strong>{brief.financial.debtors.length}</strong>{' '}
                        {brief.financial.debtors.length === 1 ? 'عميل' : 'عملاء'}
                        {brief.financial.overdueDebtorsCount > 0 && (
                          <span className="text-rose-700 dark:text-rose-300 font-black">
                            {' '}
                            (منهم {brief.financial.overdueDebtorsCount} متأخر عن ميعاد السداد!)
                          </span>
                        )}
                      </p>

                      <div className="space-y-2 max-h-60 overflow-y-auto pl-1">
                        {brief.financial.debtors.map((d) => (
                          <div
                            key={d.key}
                            className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                              d.isOverdue
                                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700'
                                : 'bg-white/80 dark:bg-[#0D162E] border-amber-200 dark:border-amber-800/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                                إنت ليك عند {d.name}
                              </span>
                              <span className="font-black tabular-nums text-[#C2410C] dark:text-[#FBBF24] shrink-0">
                                {fmt(d.totalOwed)} {currency}
                              </span>
                            </div>

                            {d.warningText && (
                              <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-start gap-1 leading-snug">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>{d.warningText}</span>
                              </p>
                            )}

                            {d.phone && (
                              <a
                                href={`tel:${d.phone}`}
                                className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 dark:text-emerald-300 hover:underline pt-0.5"
                              >
                                <PhoneCall className="w-3 h-3" />
                                <span>كلم {d.name}: {d.phone}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToView('customers')}
                  className="w-full py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black transition cursor-pointer"
                >
                  فتح كشف حساب العملاء
                </button>
              </div>

              {/* 3. علينا كام ولمين */}
              <div className="rounded-2xl bg-rose-50/70 dark:bg-[#190A0D] border border-rose-300 dark:border-rose-800/60 p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-rose-900 dark:text-rose-300">
                      علينا كام ولمين؟
                    </span>
                    <Truck className="w-4 h-4 text-rose-700 dark:text-rose-400" />
                  </div>
                  <div className="text-2xl font-black tabular-nums text-rose-800 dark:text-rose-200">
                    {fmt(brief.financial.payablesTotal)}{' '}
                    <span className="text-xs font-bold">{currency}</span>
                  </div>

                  {brief.financial.creditors.length === 0 ? (
                    <p className="text-xs leading-relaxed text-rose-950/90 dark:text-rose-100/90">
                      مفيش علينا أي فواتير أو التزامات آجلة للموردين دلوقتي — حساباتنا معاهم خالصة.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs leading-relaxed text-rose-950/90 dark:text-rose-100/90">
                        علينا للموردين والالتزامات إجمالي{' '}
                        <strong className="tabular-nums">
                          {fmt(brief.financial.payablesTotal)} {currency}
                        </strong>{' '}
                        متوزعين كالتالي:
                      </p>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pl-1">
                        {brief.financial.creditors.map((c) => (
                          <div
                            key={c.key}
                            className="p-2.5 rounded-xl bg-white/80 dark:bg-[#0D162E] border border-rose-200 dark:border-rose-800/50 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-black text-[#0C1427] dark:text-[#F7F3EA] block truncate">
                                علينا لـ {c.name}
                              </span>
                              {c.oldestDateLabel && (
                                <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                                  من تاريخ {c.oldestDateLabel} ({c.invoicesCount} فاتورة)
                                </span>
                              )}
                            </div>
                            <span className="font-black tabular-nums text-rose-700 dark:text-rose-300 shrink-0">
                              {fmt(c.totalOwed)} {currency}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToView('suppliers')}
                  className="w-full py-2 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] dark:bg-rose-700 dark:hover:bg-rose-800 text-white text-xs font-black transition cursor-pointer"
                >
                  فتح حسابات الموردين والمشتريات
                </button>
              </div>
            </div>

            {/* خلاصة المدير المالي في جملة واحدة */}
            <div className="rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 text-xs sm:text-sm font-bold text-[#0C1427] dark:text-[#F7F3EA] leading-relaxed">
              💡 <strong>الخلاصة بالمختصر يا {firstName}:</strong> معانا في الخزائن{' '}
              <span className="text-emerald-700 dark:text-emerald-300 tabular-nums">
                {fmt(brief.financial.liquidity.totalLiquidity)} {currency}
              </span>
              ، ولينا بره عند العملاء{' '}
              <span className="text-amber-800 dark:text-amber-300 tabular-nums">
                {fmt(brief.financial.receivablesTotal)} {currency}
              </span>
              ، وعلينا للموردين{' '}
              <span className="text-rose-700 dark:text-rose-300 tabular-nums">
                {fmt(brief.financial.payablesTotal)} {currency}
              </span>
              . يعني صافي فلوسنا بعد تسديد كل اللي علينا هو{' '}
              <span className="underline decoration-[#EA580C] tabular-nums">
                {fmt(brief.financial.netWorkingPosition)} {currency}
              </span>
              .
            </div>
          </section>

          {/* القسم الثاني: حديث مدير المخزن */}
          <section className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#EA580C]/40 flex items-center justify-center text-[#EA580C] dark:text-[#FBBF24]">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    ثانياً: كلام مدير المخزن — الخامات والمنتجات وإيه اللي ماشي معانا؟
                  </h2>
                  <p className="text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
                    تقييم مخزن الخامات ومخزن المنتجات وحركة السحب والمبيعات الفعلية.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* بطاقة مخزن الخامات */}
              <div className="rounded-2xl bg-[#EFE9DC]/65 dark:bg-[#132040]/70 border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#EA580C]" />
                      <span>مخزن الخامات ({brief.warehouse.materialsCount} صنف)</span>
                    </h3>
                    <span className="text-sm font-black tabular-nums text-[#C2410C] dark:text-[#FBBF24]">
                      {fmt(brief.warehouse.materialsTotalValue)} {currency}
                    </span>
                  </div>

                  {/* نواقص حد الأمان */}
                  {brief.warehouse.lowStockMaterials.length > 0 ? (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/35 border border-rose-300 dark:border-rose-800 space-y-1">
                      <p className="text-xs font-black text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>خامات قربت تخلص ({brief.warehouse.lowStockMaterials.length}):</span>
                      </p>
                      <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300 leading-relaxed">
                        {brief.warehouse.lowStockMaterials
                          .slice(0, 4)
                          .map((m) => `${m.name} (متبقي ${m.currentStock} ${m.unit})`)
                          .join(' · ')}
                      </p>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>كل الخامات في الأمان ومفيش حاجة تحت حد الطلب دلوقتي.</span>
                    </div>
                  )}

                  {/* أكتر خامات بتتسحب */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" />
                      <span>أكتر خامات بتتسحب كتير في الشغل:</span>
                    </h4>
                    {brief.warehouse.fastMovingMaterials.length === 0 ? (
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        لسه مفيش حركات صرف خامات مسجلة عشان نقيس سرعة السحب — أول ما تصرف لأمر تشغيل هتبان هنا فوراً.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {brief.warehouse.fastMovingMaterials.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between text-xs bg-white/80 dark:bg-[#060B18] px-3 py-1.5 rounded-xl border border-[#D4CCBC]/70 dark:border-[#22355E]"
                          >
                            <span className="font-bold text-[#0C1427] dark:text-[#F7F3EA] truncate">
                              {m.name}
                            </span>
                            <span className="font-black tabular-nums text-emerald-700 dark:text-emerald-300 shrink-0 mr-2">
                              اتسحب {m.consumedQty} {m.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* خامات سحبها قليل جداً */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>خامات سحبها قليل جداً (مركونة في المخزن):</span>
                    </h4>
                    {brief.warehouse.slowMovingMaterials.length === 0 ? (
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        ممتاز — كل الخامات الموجودة بتتحرك وبتدخل في الشغل.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {brief.warehouse.slowMovingMaterials.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between text-xs bg-white/80 dark:bg-[#060B18] px-3 py-1.5 rounded-xl border border-[#D4CCBC]/70 dark:border-[#22355E]"
                          >
                            <span className="font-bold text-[#0C1427] dark:text-[#F7F3EA] truncate">
                              {m.name}
                            </span>
                            <span className="text-[11px] font-bold tabular-nums text-[#64748B] dark:text-[#94A3B8] shrink-0 mr-2">
                              الرصيد {m.currentStock} {m.unit} ({fmt(m.stockValue)} {currency})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigateToView('materials')}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] text-white text-xs font-black transition cursor-pointer"
                  >
                    فتح مخزن الخامات
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToView('suppliers_market')}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black transition cursor-pointer"
                  >
                    طلب خامات من السوق
                  </button>
                </div>
              </div>

              {/* بطاقة مخزن المنتجات */}
              <div className="rounded-2xl bg-[#EFE9DC]/65 dark:bg-[#132040]/70 border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-[#EA580C]" />
                      <span>مخزن المنتجات الجاهزة ({brief.warehouse.productsCount} منتج)</span>
                    </h3>
                    <div className="text-left">
                      <span className="text-xs font-black tabular-nums text-[#C2410C] dark:text-[#FBBF24] block">
                        التكلفة: {fmt(brief.warehouse.productsCostValue)} {currency}
                      </span>
                      <span className="text-[11px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300 block">
                        القيمة البيعية: {fmt(brief.warehouse.productsRetailValue)} {currency}
                      </span>
                    </div>
                  </div>

                  {/* أكتر منتج ماشي معانا */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>أكتر منتجات ماشية وشغالة معانا (الأكثر مبيعاً):</span>
                    </h4>
                    {brief.warehouse.bestSellingProducts.length === 0 ? (
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        لسه مفيش فواتير بيع مسجلة للمنتجات عشان نحدد النجم اللي ماشي أكتر في الورشة.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {brief.warehouse.bestSellingProducts.map((p, idx) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between text-xs bg-white/80 dark:bg-[#060B18] px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50"
                          >
                            <span className="font-bold text-[#0C1427] dark:text-[#F7F3EA] truncate">
                              {idx === 0 ? '⭐ ' : ''}{p.name}
                            </span>
                            <span className="font-black tabular-nums text-emerald-700 dark:text-emerald-300 shrink-0 mr-2">
                              اتـباع {p.soldQty} قطعة ({fmt(p.soldRevenue)} {currency})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* أقل منتج شغال */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />
                      <span>أقل منتجات شغالة (محتاجة تسويق أو عرض):</span>
                    </h4>
                    {brief.warehouse.slowestProducts.length === 0 ? (
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        كل منتجاتك شغالة وبتتحرك في البيع، ربنا يبارك!
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {brief.warehouse.slowestProducts.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between text-xs bg-white/80 dark:bg-[#060B18] px-3 py-1.5 rounded-xl border border-[#D4CCBC]/70 dark:border-[#22355E]"
                          >
                            <span className="font-bold text-[#0C1427] dark:text-[#F7F3EA] truncate">
                              {p.name}
                            </span>
                            <span className="text-[11px] font-bold tabular-nums text-[#64748B] dark:text-[#94A3B8] shrink-0 mr-2">
                              {p.soldQty === 0 ? 'مبيعات صفر حتى الآن' : `اتـباع ${p.soldQty} فقط`} · متاح {p.currentStock}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigateToView('catalog')}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] text-white text-xs font-black transition cursor-pointer"
                  >
                    فتح كتالوج المنتجات
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToView('sales')}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black transition cursor-pointer"
                  >
                    سجل المبيعات والطلبات
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
