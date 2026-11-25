import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  Crown,
  Gift,
  Layers,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  ALL_AI_ASSISTANT_CHOICES,
  ALL_PACKAGE_IDS,
  AiAssistantChoice,
  SubscriptionPackageId,
  getEffectiveAiAssistantChoices,
  saveUserSubscription,
  syncUserSubscriptionAndData,
  useSubscriptionPackagesConfig,
  useUserSubscription,
} from '../../types/subscriptions';
import { WORLD_STOREFRONT_THEMES_LIST } from '../../lib/storefrontThemes';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';

interface MySubscriptionsPageProps {
  profile: UserProfile;
  onGoBack?: () => void;
  onGoHome?: () => void;
  onSaved?: (activeIds: SubscriptionPackageId[]) => void;
}

export const MySubscriptionsPage: React.FC<MySubscriptionsPageProps> = ({
  profile,
  onGoBack,
  onGoHome,
  onSaved,
}) => {
  const userId = profile.workshopId || profile.id || profile.email || '';
  const isSupplier = (profile as any)?.accountRole === 'supplier';
  const currentSub = useUserSubscription(profile);
  const packages = useSubscriptionPackagesConfig();
  const themesCount = WORLD_STOREFRONT_THEMES_LIST.length;

  const [selectedIds, setSelectedIds] = useState<SubscriptionPackageId[]>(() =>
    currentSub.activePackageIds.length > 0 ? currentSub.activePackageIds : ['core_free']
  );
  const [aiChoices, setAiChoices] = useState<AiAssistantChoice[]>(() =>
    getEffectiveAiAssistantChoices(currentSub)
  );
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const togglePkg = (id: SubscriptionPackageId) => {
    if (id === 'core_free') return;
    playButtonClickSound();
    if (id === 'ai_assistants') {
      const currentlyOn = selectedIds.includes('ai_assistants') && aiChoices.length > 0;
      if (currentlyOn) {
        setSelectedIds((prev) => prev.filter((x) => x !== 'ai_assistants'));
        setAiChoices([]);
      } else {
        setSelectedIds((prev) => (prev.includes('ai_assistants') ? prev : [...prev, 'ai_assistants']));
        setAiChoices([...ALL_AI_ASSISTANT_CHOICES]);
      }
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAiAssistant = (choice: AiAssistantChoice) => {
    playButtonClickSound();
    setAiChoices((prev) => {
      const next = prev.includes(choice)
        ? prev.filter((c) => c !== choice)
        : [...prev, choice];
      setSelectedIds((ids) => {
        if (next.length > 0) {
          return ids.includes('ai_assistants') ? ids : [...ids, 'ai_assistants'];
        }
        return ids.filter((x) => x !== 'ai_assistants');
      });
      return next;
    });
  };

  const handleSelectAllFreePromo = () => {
    playSuccessSound();
    setSelectedIds([...ALL_PACKAGE_IDS]);
    setAiChoices([...ALL_AI_ASSISTANT_CHOICES]);
  };

  const handleSave = async () => {
    const saved = saveUserSubscription(userId, {
      activePackageIds: selectedIds,
      aiAssistantChoices: aiChoices,
      hasSelectedPackages: true,
      promoClaimed: true,
      syncStatus: 'syncing',
    });
    playSuccessSound();
    setIsSyncing(true);
    setSavedNotice('جاري حفظ باقاتك ومزامنة وربط بياناتك القديمة مع الأقسام الجديدة تلقائياً...');
    onSaved?.(saved.activePackageIds);

    const res = await syncUserSubscriptionAndData(profile, saved, { forcePull: true });
    setIsSyncing(false);

    if (res.offline) {
      setSavedNotice(
        `تم تفعيل ${saved.activePackageIds.length} باقات محلياً بدون فقدان أي بيانات — وستتم المزامنة مع السحابة تلقائياً فور عودة الإنترنت.`
      );
    } else if (res.cloudSaved && res.dataSynced) {
      setSavedNotice(
        `تم تفعيل ${saved.activePackageIds.length} باقات ومزامنة بياناتك القديمة مع الأقسام الجديدة تلقائياً بالكامل بدون فقدان أي سجل!`
      );
    } else {
      setSavedNotice(
        `تم تفعيل ${saved.activePackageIds.length} باقات على جهازك، ويمكنك الضغط على «مزامنة الباقة الآن» لإعادة المحاولة عند استقرار الاتصال.`
      );
    }
    setTimeout(() => setSavedNotice(null), 6500);
  };

  const handleManualSyncNow = async () => {
    if (isSyncing) return;
    playButtonClickSound();
    setIsSyncing(true);
    setSavedNotice('جاري مزامنة الباقة وتحديث وربط كل بيانات حسابك مع السحابة...');
    const res = await syncUserSubscriptionAndData(profile, currentSub, { forcePull: true });
    setIsSyncing(false);
    if (res.offline) {
      setSavedNotice('أنت حالياً بدون إنترنت — ستتم المزامنة تلقائياً بمجرد عودة الاتصال.');
    } else {
      playSuccessSound();
      setSavedNotice('تمت مزامنة باقاتك وربط كافة بياناتك القديمة والجديدة بنجاح ✓');
    }
    setTimeout(() => setSavedNotice(null), 5000);
  };

  const regularTotalMonthly = useMemo(() => {
    return packages
      .filter((p) => selectedIds.includes(p.id) && !p.isAlwaysFree)
      .reduce((sum, p) => sum + p.monthlyPriceEgp, 0);
  }, [packages, selectedIds]);

  const formattedLastSync = useMemo(() => {
    if (!currentSub.syncedToCloudAt) return null;
    try {
      return new Date(currentSub.syncedToCloudAt).toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  }, [currentSub.syncedToCloudAt]);

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 overflow-x-clip" dir="rtl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="p-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] hover:border-[#EA580C] cursor-pointer shrink-0"
              aria-label="رجوع"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
              <span className="truncate">اشتراكاتي وباقات المنظومة</span>
            </h1>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
              فعّل الباقات التي تناسب حجم {isSupplier ? 'تجارتك ومخازنك' : 'ورشتك وفنك'} — وكل شيء يتزامن ويظهر في لوحتك فوراً.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSelectAllFreePromo}
          className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-[#0C1427] dark:bg-[#FBBF24] text-[#FBBF24] dark:text-[#0C1427] text-xs font-black flex items-center gap-1.5 hover:opacity-90 cursor-pointer shrink-0"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>تفعيل الباقة الشاملة (الكل مجاناً الآن)</span>
        </button>
      </div>

      {/* Automatic Non-Destructive Sync Guarantee Bar */}
      <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#FFFDF8] dark:bg-[#0D162E] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : currentSub.syncStatus === 'pending_offline' ? (
              <CloudOff className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                مزامنة تلقائية فورية بدون فقدان أي بيانات
              </span>
              {currentSub.syncStatus === 'pending_offline' ? (
                <span className="text-[10px] font-black text-amber-700 dark:text-amber-300">
                  · بانتظار الإنترنت للمزامنة التلقائية
                </span>
              ) : formattedLastSync ? (
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                  <Cloud className="w-3 h-3" />
                  <span>آخر مزامنة {formattedLastSync}</span>
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] leading-relaxed">
              عند ترقية أو إضافة أي باقة جديدة، تُحفظ باقتك تلقائياً على السحابة وتتربط بياناتك القديمة (منتجاتك، خاماتك، عملاؤك، وفواتيرك) بالأقسام الجديدة فوراً بدون ما تطير ولا تبدأ من الصفر.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualSyncNow}
          disabled={isSyncing}
          className="w-full sm:w-auto shrink-0 px-3.5 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#EA580C] ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة الباقة الآن'}</span>
        </button>
      </div>

      {/* Limited-Time Launch Promo Banner */}
      <div className="rounded-2xl border border-[#EA580C]/40 bg-gradient-to-l from-[#EA580C] via-[#C2410C] to-[#9A3412] text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1.5 min-w-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-black text-amber-200">
            <Gift className="w-4 h-4 shrink-0" />
            <span>عرض الإطلاق الحصري لفترة محدودة</span>
          </div>
          <h2 className="text-base sm:text-xl font-black leading-snug">
            اشترك الآن في أي باقة — مجاناً بالكامل (0 ج.م) لفترة محدودة!
          </h2>
          <p className="text-xs text-white/90 leading-relaxed max-w-2xl">
            الباقة الأساسية مجانية للأبد وتشمل «صفحتي الشخصية» لتحديد مستواك وعرض أعمالك وتدريباتك. وبقية الباقات الاحترافية (بما فيها كل سمات المتجر — {themesCount} سمة حالياً وتزيد تلقائياً) مفتوحة لك مجاناً الآن لتجربة المنظومة كاملة.
          </p>
        </div>

        <div className="shrink-0 rounded-xl bg-black/25 border border-white/20 p-3.5 text-center w-full sm:w-auto sm:min-w-[165px]">
          <p className="text-[11px] text-amber-200 font-bold">إجمالي اشتراكك الآن</p>
          <div className="flex items-baseline justify-center gap-1.5 mt-1 font-mono tabular-nums">
            <span className="text-2xl font-black text-white">0 ج.م</span>
            {regularTotalMonthly > 0 && (
              <span className="text-xs line-through text-white/65">
                {regularTotalMonthly.toLocaleString('ar-EG')} ج.م
              </span>
            )}
          </div>
          <p className="text-[10px] text-emerald-200 font-bold mt-1">
            {selectedIds.length} من {packages.length} باقات محددة
          </p>
        </div>
      </div>

      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-600/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs font-black flex items-center gap-2">
          {isSyncing ? (
            <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Packages Cards Grid (Mobile-First, Zero Tables) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {packages.map((pkg) => {
          const isSelected = selectedIds.includes(pkg.id);
          const title = isSupplier && pkg.supplierTitleAr ? pkg.supplierTitleAr : pkg.titleAr;
          const tagline = isSupplier && pkg.supplierTaglineAr ? pkg.supplierTaglineAr : pkg.taglineAr;
          const highlights = isSupplier ? pkg.highlightsSupplier : pkg.highlightsArtisan;

          return (
            <div
              key={pkg.id}
              onClick={() => togglePkg(pkg.id)}
              className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all ${
                pkg.isAlwaysFree ? 'cursor-default' : 'cursor-pointer hover:-translate-y-0.5'
              } ${
                isSelected
                  ? 'bg-[#FFFDF8] dark:bg-[#0D162E] border-[#EA580C] dark:border-[#FBBF24] ring-1 ring-[#EA580C]/30 dark:ring-[#FBBF24]/30'
                  : 'bg-[#F7F3EA]/70 dark:bg-[#0A1124] border-[#D4CCBC] dark:border-[#22355E] opacity-85 hover:opacity-100'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                      <span>
                        {pkg.order === 0 ? 'الباقة 0 · الأساس' : `الباقة ${pkg.order}`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          pkg.isAlwaysFree
                            ? 'text-emerald-700 dark:text-emerald-400 font-black'
                            : 'text-[#C2410C] dark:text-[#FBBF24] font-black'
                        }
                      >
                        {pkg.isAlwaysFree ? 'مجانية للأبد' : 'مجاناً لفترة محدودة'}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] leading-snug">
                      {title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    disabled={pkg.isAlwaysFree}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePkg(pkg.id);
                    }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
                      isSelected
                        ? 'bg-[#EA580C] text-white'
                        : 'border border-[#D4CCBC] dark:border-[#2D4475] bg-white dark:bg-[#132040] text-transparent'
                    }`}
                    aria-label={isSelected ? 'مفعّلة' : 'تفعيل الباقة'}
                  >
                    {pkg.isAlwaysFree ? <Lock className="w-3.5 h-3.5" /> : <Check className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                  {tagline}
                </p>

                {pkg.id === 'ai_assistants' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-xl border border-[#EA580C]/25 dark:border-[#FBBF24]/25 bg-[#FAF6EE] dark:bg-[#0B1328] p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA]">
                        اختار المساعد اللي يناسبك (واحد بس أو الاثنين معاً):
                      </span>
                      <span className="text-[10px] font-bold text-[#C2410C] dark:text-[#FBBF24]">
                        اختيار مرن داخل نفس الباقة
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(
                        [
                          {
                            key: 'shamousa' as AiAssistantChoice,
                            title: '☀️ شموسة مديرة أعمالك',
                            sub: 'الأكثر طلباً · متابعة يومية وتجهيز منتجاتك ومراجعة شغلك على قد باقاتك',
                          },
                          {
                            key: 'falcon' as AiAssistantChoice,
                            title: '🦅 صقر المستشار الهندسي AI',
                            sub: 'رؤية ذكية بالصور، دراسة سوق، واستشارات فنية وهندسية متخصصة',
                          },
                        ]
                      ).map((item) => {
                        const subChecked = aiChoices.includes(item.key);
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => toggleAiAssistant(item.key)}
                            className={`text-right p-2.5 rounded-xl border flex items-start gap-2 transition cursor-pointer ${
                              subChecked
                                ? 'bg-white dark:bg-[#132040] border-[#EA580C] dark:border-[#FBBF24] shadow-xs'
                                : 'bg-[#F7F3EA]/60 dark:bg-[#0D162E]/60 border-[#D4CCBC] dark:border-[#22355E] opacity-75 hover:opacity-100'
                            }`}
                          >
                            <span
                              className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition ${
                                subChecked
                                  ? 'bg-[#EA580C] text-white'
                                  : 'border border-[#94A3B8] bg-white dark:bg-[#0A1124] text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </span>
                            <span className="min-w-0 space-y-0.5">
                              <span className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                                {item.title}
                              </span>
                              <span className="block text-[10px] text-[#475569] dark:text-[#94A3B8] leading-snug">
                                {item.sub}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <ul className="space-y-1.5 pt-1 border-t border-[#E5DEC9] dark:border-[#1E2E52]">
                  {highlights.map((h, i) => (
                    <li
                      key={i}
                      className="text-xs text-[#0C1427] dark:text-[#E2E8F0] flex items-start gap-2 leading-relaxed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-[#E5DEC9] dark:border-[#1E2E52] flex items-center justify-between gap-2">
                <div className="font-mono tabular-nums text-xs">
                  {pkg.isAlwaysFree ? (
                    <span className="font-black text-emerald-700 dark:text-emerald-400">
                      0 ج.م / للأبد
                    </span>
                  ) : (
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-black text-[#C2410C] dark:text-[#FBBF24]">0 ج.م الآن</span>
                      <span className="text-[11px] line-through text-[#64748B]">
                        {pkg.monthlyPriceEgp} ج.م/شهر
                      </span>
                    </div>
                  )}
                </div>

                <span
                  className={`text-[11px] font-black ${
                    isSelected
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                >
                  {pkg.isAlwaysFree
                    ? 'مفعّلة تلقائياً دائماً'
                    : pkg.id === 'ai_assistants' && isSelected
                    ? aiChoices.length === 2
                      ? 'مختارة: شموسة + صقر ✓'
                      : aiChoices[0] === 'shamousa'
                      ? 'مختارة: شموسة فقط ✓'
                      : 'مختارة: صقر فقط ✓'
                    : isSelected
                    ? 'مختارة للتفعيل ✓'
                    : 'اضغط للإضافة +'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-[#475569] dark:text-[#94A3B8] text-center sm:text-right">
          <span className="font-black text-[#0C1427] dark:text-[#F7F3EA]">
            محدد حالياً: {selectedIds.length} باقات
          </span>{' '}
          · يمكنك تعديل باقاتك في أي وقت من «اشتراكاتي» بالقائمة الجانبية.
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer"
            >
              الرئيسية
            </button>
          )}
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSave}
            className="flex-1 sm:flex-none px-5 sm:px-6 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-65 text-white text-xs sm:text-sm font-black shadow-sm cursor-pointer transition inline-flex items-center justify-center gap-2"
          >
            {isSyncing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSyncing ? 'جاري التفعيل والمزامنة...' : 'حفظ وتفعيل ومزامنة باقاتي مجاناً'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface PackageSelectionOnboardingModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onComplete: (activeIds: SubscriptionPackageId[]) => void;
}

export const PackageSelectionOnboardingModal: React.FC<PackageSelectionOnboardingModalProps> = ({
  profile,
  isOpen,
  onComplete,
}) => {
  const userId = profile.workshopId || profile.id || profile.email || '';
  const isSupplier = (profile as any)?.accountRole === 'supplier';
  const packages = useSubscriptionPackagesConfig();
  const themesCount = WORLD_STOREFRONT_THEMES_LIST.length;

  const [selectedIds, setSelectedIds] = useState<SubscriptionPackageId[]>([...ALL_PACKAGE_IDS]);
  const [aiChoices, setAiChoices] = useState<AiAssistantChoice[]>([...ALL_AI_ASSISTANT_CHOICES]);

  if (!isOpen) return null;

  const togglePkg = (id: SubscriptionPackageId) => {
    if (id === 'core_free') return;
    playButtonClickSound();
    if (id === 'ai_assistants') {
      const currentlyOn = selectedIds.includes('ai_assistants') && aiChoices.length > 0;
      if (currentlyOn) {
        setSelectedIds((prev) => prev.filter((x) => x !== 'ai_assistants'));
        setAiChoices([]);
      } else {
        setSelectedIds((prev) => (prev.includes('ai_assistants') ? prev : [...prev, 'ai_assistants']));
        setAiChoices([...ALL_AI_ASSISTANT_CHOICES]);
      }
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAiAssistant = (choice: AiAssistantChoice) => {
    playButtonClickSound();
    setAiChoices((prev) => {
      const next = prev.includes(choice)
        ? prev.filter((c) => c !== choice)
        : [...prev, choice];
      setSelectedIds((ids) => {
        if (next.length > 0) {
          return ids.includes('ai_assistants') ? ids : [...ids, 'ai_assistants'];
        }
        return ids.filter((x) => x !== 'ai_assistants');
      });
      return next;
    });
  };

  const handleConfirm = (idsToSave: SubscriptionPackageId[], choicesToSave?: AiAssistantChoice[]) => {
    const saved = saveUserSubscription(userId, {
      activePackageIds: idsToSave,
      aiAssistantChoices:
        choicesToSave !== undefined
          ? choicesToSave
          : idsToSave.includes('ai_assistants')
          ? aiChoices
          : [],
      hasSelectedPackages: true,
      promoClaimed: true,
      syncStatus: 'syncing',
    });
    playSuccessSound();
    // مزامنة تلقائية في الخلفية فوراً بدون تعطيل دخول العضو وبدون فقدان أي بيانات سابقة
    syncUserSubscriptionAndData(profile, saved, { forcePull: true }).catch(() => {});
    onComplete(saved.activePackageIds);
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-[#060B18]/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-5"
      dir="rtl"
    >
      <div className="w-full max-w-3xl max-h-[92vh] rounded-3xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#FAF7F0] dark:bg-[#0A1124] shadow-2xl flex flex-col overflow-hidden">
        {/* Top Welcome Banner */}
        <div className="p-4 sm:p-6 bg-gradient-to-l from-[#EA580C] to-[#9A3412] text-white flex items-start justify-between gap-3 shrink-0">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-200">
              <Gift className="w-3.5 h-3.5" />
              <span>أهلاً بك من جديد في الشمساوية · عرض الإطلاق مجاناً لفترة محدودة</span>
            </div>
            <h2 className="text-base sm:text-xl font-black">
              اختر الباقات التي تريد ظهورها في {isSupplier ? 'لوحة المورد' : 'ورشتك'} الآن
            </h2>
            <p className="text-xs text-white/90 leading-relaxed">
              رتّبنا المنظومة في باقات واضحة (تبدأ بالأساسية المجانية شاملة «صفحتي الشخصية» + {themesCount} سمة متجر). اختر ما يناسبك — وكلها مجانية بالكامل لفترة محدودة!
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleConfirm([...ALL_PACKAGE_IDS], [...ALL_AI_ASSISTANT_CHOICES])}
            className="p-1.5 rounded-lg bg-black/20 hover:bg-black/35 text-white cursor-pointer shrink-0"
            title="تفعيل الكل والدخول مباشرة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selectable Packages List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {packages.map((pkg) => {
            const checked = selectedIds.includes(pkg.id);
            const title = isSupplier && pkg.supplierTitleAr ? pkg.supplierTitleAr : pkg.titleAr;
            const tagline = isSupplier && pkg.supplierTaglineAr ? pkg.supplierTaglineAr : pkg.taglineAr;

            return (
              <div
                key={pkg.id}
                onClick={() => togglePkg(pkg.id)}
                className={`w-full text-right p-3.5 rounded-2xl border space-y-2.5 transition cursor-pointer ${
                  checked
                    ? 'bg-white dark:bg-[#0F1A36] border-[#EA580C] dark:border-[#FBBF24]'
                    : 'bg-[#F2ECE1]/70 dark:bg-[#0D162E]/60 border-[#D4CCBC] dark:border-[#22355E] opacity-75'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                      checked
                        ? 'bg-[#EA580C] text-white'
                        : 'border border-[#94A3B8] text-transparent'
                    }`}
                  >
                    {pkg.isAlwaysFree ? <User className="w-3.5 h-3.5" /> : <Check className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                        {title}
                      </span>
                      <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400">
                        {pkg.isAlwaysFree ? 'مجانية للأبد' : '0 ج.م (مجاناً لفترة محدودة)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                      {tagline}
                    </p>
                  </div>
                </div>

                {pkg.id === 'ai_assistants' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#E5DEC9] dark:border-[#1E2E52]"
                  >
                    {(
                      [
                        { key: 'shamousa' as AiAssistantChoice, label: '☀️ شموسة مديرة أعمالك (فقط أو مع صقر)' },
                        { key: 'falcon' as AiAssistantChoice, label: '🦅 صقر المستشار الهندسي AI' },
                      ]
                    ).map((item) => {
                      const subOn = aiChoices.includes(item.key);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleAiAssistant(item.key)}
                          className={`p-2 rounded-xl border text-right flex items-center gap-2 text-xs font-black transition cursor-pointer ${
                            subOn
                              ? 'bg-[#FAF6EE] dark:bg-[#132040] border-[#EA580C] dark:border-[#FBBF24] text-[#0C1427] dark:text-[#F7F3EA]'
                              : 'bg-transparent border-[#D4CCBC] dark:border-[#22355E] text-[#64748B] opacity-75'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                              subOn ? 'bg-[#EA580C] text-white' : 'border border-[#94A3B8] text-transparent'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#D4CCBC] dark:border-[#22355E] bg-[#F2ECE1] dark:bg-[#0D162E] flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSelectedIds([...ALL_PACKAGE_IDS]);
              setAiChoices([...ALL_AI_ASSISTANT_CHOICES]);
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] hover:border-[#EA580C] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>تحديد الكل ({packages.length} باقات مجاناً)</span>
          </button>

          <button
            type="button"
            onClick={() => handleConfirm(selectedIds, aiChoices)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs sm:text-sm font-black shadow-sm cursor-pointer"
          >
            تفعيل باقاتي ({selectedIds.length}) والدخول الآن
          </button>
        </div>
      </div>
    </div>
  );
};
