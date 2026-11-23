import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  CloudUpload,
  Crown,
  Eye,
  EyeOff,
  Layers,
  Lock,
  Palette,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  ADMIN_SYSTEM_ACTIONS_ARTISAN,
  ADMIN_SYSTEM_ACTIONS_SUPPLIER,
  PlatformPackagesAdminConfig,
  SubscriptionPackageDefinition,
  SubscriptionPackageId,
  SubscriptionPackageOverride,
  getDefaultSubscriptionPackages,
  getStoredSubscriptionPackagesConfig,
  getSubscriptionPackages,
  resetSubscriptionPackagesConfig,
  saveStoredSubscriptionPackagesConfig,
} from '../../types/subscriptions';
import {
  ARTISAN_ACTION_CATALOG,
  SUPPLIER_ACTION_CATALOG,
  getUiIcon,
  useUiLayoutConfig,
} from '../../types/uiLayoutConfig';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';

interface AdminPackagesManagerPageProps {
  onBack: () => void;
  onOpenUiLayoutStudio?: () => void;
  onSaveToCloud: (nextConfig: PlatformPackagesAdminConfig) => Promise<void>;
  saving?: boolean;
}

type AudienceTab = 'artisan' | 'supplier';

function buildInitialPackagesList(): SubscriptionPackageDefinition[] {
  return getSubscriptionPackages(true);
}

function buildConfigFromPackages(
  pkgs: SubscriptionPackageDefinition[]
): PlatformPackagesAdminConfig {
  const map: Record<string, SubscriptionPackageOverride> = {};
  pkgs.forEach((p, idx) => {
    map[p.id] = {
      id: p.id,
      order: idx,
      enabled: p.isAlwaysFree ? true : p.enabled !== false,
      titleAr: p.titleAr,
      supplierTitleAr: p.supplierTitleAr,
      taglineAr: p.taglineAr,
      supplierTaglineAr: p.supplierTaglineAr,
      monthlyPriceEgp: p.isAlwaysFree ? 0 : Math.max(0, Number(p.monthlyPriceEgp) || 0),
      promoFreeLimitedTime: p.isAlwaysFree ? false : Boolean(p.promoFreeLimitedTime),
      allowedActionsArtisan: Array.from(new Set(p.allowedActionsArtisan || [])),
      allowedActionsSupplier: Array.from(new Set(p.allowedActionsSupplier || [])),
    };
  });
  return {
    packages: map,
    updatedAt: new Date().toISOString(),
  };
}

export const AdminPackagesManagerPage: React.FC<AdminPackagesManagerPageProps> = ({
  onBack,
  onOpenUiLayoutStudio,
  onSaveToCloud,
  saving = false,
}) => {
  const uiLayout = useUiLayoutConfig();
  const [audience, setAudience] = useState<AudienceTab>('artisan');
  const [packages, setPackages] = useState<SubscriptionPackageDefinition[]>(() =>
    buildInitialPackagesList()
  );
  const [selectedPkgId, setSelectedPkgId] = useState<SubscriptionPackageId>('core_free');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [showMetaEditor, setShowMetaEditor] = useState(false);

  const selectedPkg = useMemo(
    () => packages.find((p) => p.id === selectedPkgId) || packages[0],
    [packages, selectedPkgId]
  );

  const audienceCards = useMemo(() => {
    return audience === 'supplier' ? uiLayout.supplier.home.cards : uiLayout.artisan.home.cards;
  }, [audience, uiLayout]);

  const systemActions = useMemo(() => {
    return audience === 'supplier' ? ADMIN_SYSTEM_ACTIONS_SUPPLIER : ADMIN_SYSTEM_ACTIONS_ARTISAN;
  }, [audience]);

  const actionField: 'allowedActionsArtisan' | 'allowedActionsSupplier' =
    audience === 'supplier' ? 'allowedActionsSupplier' : 'allowedActionsArtisan';

  const actionMetaLookup = useMemo(() => {
    const labelMap: Record<string, string> = {};
    const descMap: Record<string, string> = {};
    const catalog = audience === 'supplier' ? SUPPLIER_ACTION_CATALOG : ARTISAN_ACTION_CATALOG;
    catalog.forEach((c) => {
      labelMap[c.actionKey] = c.defaultLabel;
      descMap[c.actionKey] = c.description;
    });
    systemActions.forEach((a) => {
      labelMap[a.actionKey] = a.label;
      descMap[a.actionKey] = a.description;
    });
    audienceCards.forEach((card) => {
      if (card.directActionKey) {
        labelMap[card.directActionKey] = card.label;
      }
      card.items.forEach((it) => {
        if (it.actionKey) labelMap[it.actionKey] = it.label;
      });
    });
    return { labelMap, descMap };
  }, [audience, systemActions, audienceCards]);

  const actionLabelLookup = actionMetaLookup.labelMap;
  const actionDescLookup = actionMetaLookup.descMap;

  // خريطة لمعرفة كل زرار موجود في أي باقات أخرى
  const actionOtherPackagesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    packages.forEach((pkg) => {
      if (pkg.id === selectedPkg.id) return;
      const pkgTitle =
        audience === 'supplier' && pkg.supplierTitleAr ? pkg.supplierTitleAr : pkg.titleAr;
      const list = pkg[actionField] || [];
      list.forEach((key) => {
        if (!map[key]) map[key] = [];
        map[key].push(pkgTitle);
      });
    });
    return map;
  }, [packages, selectedPkg.id, audience, actionField]);

  const showQuickNotice = (msg: string) => {
    setLocalNotice(msg);
    setTimeout(() => setLocalNotice(null), 4000);
  };

  const updatePackage = (
    pkgId: SubscriptionPackageId,
    updater: (pkg: SubscriptionPackageDefinition) => SubscriptionPackageDefinition
  ) => {
    setPackages((prev) => prev.map((p) => (p.id === pkgId ? updater(p) : p)));
    setHasUnsavedChanges(true);
  };

  const toggleActionInSelectedPackage = (actionKey: string) => {
    playButtonClickSound();
    updatePackage(selectedPkg.id, (pkg) => {
      const current = pkg[actionField] || [];
      const exists = current.includes(actionKey);
      const next = exists ? current.filter((k) => k !== actionKey) : [...current, actionKey];
      return { ...pkg, [actionField]: next };
    });
  };

  const toggleAllCardItemsInSelectedPackage = (cardActionKeys: string[]) => {
    if (cardActionKeys.length === 0) return;
    playButtonClickSound();
    updatePackage(selectedPkg.id, (pkg) => {
      const current = new Set(pkg[actionField] || []);
      const allSelected = cardActionKeys.every((k) => current.has(k));
      if (allSelected) {
        cardActionKeys.forEach((k) => current.delete(k));
      } else {
        cardActionKeys.forEach((k) => current.add(k));
      }
      return { ...pkg, [actionField]: Array.from(current) };
    });
  };

  const moveActionToAnotherPackage = (
    actionKey: string,
    targetPkgId: SubscriptionPackageId
  ) => {
    if (!targetPkgId || targetPkgId === selectedPkg.id) return;
    playSuccessSound();
    setPackages((prev) =>
      prev.map((pkg) => {
        const list = pkg[actionField] || [];
        if (pkg.id === selectedPkg.id) {
          return { ...pkg, [actionField]: list.filter((k) => k !== actionKey) };
        }
        if (pkg.id === targetPkgId) {
          return {
            ...pkg,
            [actionField]: list.includes(actionKey) ? list : [...list, actionKey],
          };
        }
        return pkg;
      })
    );
    setHasUnsavedChanges(true);
    const targetPkg = packages.find((p) => p.id === targetPkgId);
    const targetName =
      targetPkg && audience === 'supplier' && targetPkg.supplierTitleAr
        ? targetPkg.supplierTitleAr
        : targetPkg?.titleAr || '';
    showQuickNotice(`تم نقل «${actionLabelLookup[actionKey] || actionKey}» إلى «${targetName}» ✓`);
  };

  const movePackageOrder = (pkgId: SubscriptionPackageId, direction: -1 | 1) => {
    playButtonClickSound();
    setPackages((prev) => {
      const idx = prev.findIndex((p) => p.id === pkgId);
      const targetIdx = idx + direction;
      if (idx < 0 || targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      return copy.map((p, i) => ({ ...p, order: i }));
    });
    setHasUnsavedChanges(true);
  };

  const togglePackageEnabled = (pkgId: SubscriptionPackageId) => {
    const pkg = packages.find((p) => p.id === pkgId);
    if (!pkg || pkg.isAlwaysFree) return;
    playButtonClickSound();
    updatePackage(pkgId, (p) => ({ ...p, enabled: p.enabled === false ? true : false }));
  };

  const handleSaveAndPublish = async () => {
    const cfg = buildConfigFromPackages(packages);
    saveStoredSubscriptionPackagesConfig(cfg);
    await onSaveToCloud(cfg);
    setHasUnsavedChanges(false);
    playSuccessSound();
    showQuickNotice('تم حفظ ونشر إعدادات الباقات والصلاحيات فوراً لكل المستخدمين ✅');
  };

  const handleResetDefaults = async () => {
    playButtonClickSound();
    const defaults = getDefaultSubscriptionPackages();
    setPackages(defaults);
    const emptyCfg = resetSubscriptionPackagesConfig();
    setHasUnsavedChanges(false);
    await onSaveToCloud(emptyCfg);
    showQuickNotice('تمت استعادة التوزيع الافتراضي للباقات ونشره للجميع ✓');
  };

  const selectedActions = selectedPkg[actionField] || [];
  const selectedPkgTitle =
    audience === 'supplier' && selectedPkg.supplierTitleAr
      ? selectedPkg.supplierTitleAr
      : selectedPkg.titleAr;

  // نتحقق لو في تعديلات محفوظة حالياً
  const hasCustomOverrides = Object.keys(getStoredSubscriptionPackagesConfig().packages || {}).length > 0;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 pb-24" dir="rtl">
      {/* Header */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer shrink-0"
              aria-label="رجوع"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
                <span>إدارة الباقات والصلاحيات (تحكم بالزرار الواحد)</span>
              </h1>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-1 leading-relaxed">
                حدّد بالظبط إيه البطاقات والأزرار اللي تظهر لكل مشترك في كل باقة (فنانين أو موردين). لو علّمت على زرار واحد جوه بطاقة، يظهر الزرار ده لوحده فوراً بدون أي تسريب من باقي النظام!
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenUiLayoutStudio && (
              <button
                type="button"
                onClick={onOpenUiLayoutStudio}
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
                <span>هندسة الواجهات والترتيب</span>
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={handleResetDefaults}
              className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 text-xs font-bold text-[#475569] dark:text-[#CBD5E1] hover:text-rose-600 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveAndPublish}
              className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{saving ? 'جاري النشر...' : 'حفظ ونشر للجميع'}</span>
            </button>
          </div>
        </div>

        {/* Audience Switcher + Always-Unlocked Guarantee */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                playButtonClickSound();
                setAudience('artisan');
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 border transition cursor-pointer ${
                audience === 'artisan'
                  ? 'bg-[#0C1427] dark:bg-[#FBBF24] text-[#FBBF24] dark:text-[#0C1427] border-[#0C1427] dark:border-[#FBBF24]'
                  : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]'
              }`}
            >
              <Store className="w-4 h-4 shrink-0" />
              <span>باقات الفنانين والورش</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playButtonClickSound();
                setAudience('supplier');
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 border transition cursor-pointer ${
                audience === 'supplier'
                  ? 'bg-[#0C1427] dark:bg-[#FBBF24] text-[#FBBF24] dark:text-[#0C1427] border-[#0C1427] dark:border-[#FBBF24]'
                  : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]'
              }`}
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span>باقات الموردين والتجار</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-xl">
            <Settings className="w-3.5 h-3.5 shrink-0" />
            <span>«الإعدادات» و «اشتراكاتي» مفتوحين تلقائياً لجميع الباقات دائماً</span>
          </div>
        </div>
      </div>

      {localNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-600/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs font-black flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{localNotice}</span>
        </div>
      )}

      {/* Main Split Layout: Packages List + Granular Button Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Right Column (RTL): Packages List with Reordering & Toggle */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-[#475569] dark:text-[#94A3B8] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>اختر الباقة لتعديل أزرارها ({packages.length} باقات)</span>
            </h2>
            {hasCustomOverrides && (
              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                مخصّصة ✓
              </span>
            )}
          </div>

          <div className="space-y-2">
            {packages.map((pkg, idx) => {
              const isSelected = pkg.id === selectedPkg.id;
              const isDisabled = pkg.enabled === false;
              const pkgTitle =
                audience === 'supplier' && pkg.supplierTitleAr ? pkg.supplierTitleAr : pkg.titleAr;
              const count = (pkg[actionField] || []).length;

              return (
                <div
                  key={pkg.id}
                  onClick={() => {
                    playButtonClickSound();
                    setSelectedPkgId(pkg.id);
                  }}
                  className={`rounded-2xl border p-3 transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#FFFDF8] dark:bg-[#0F1B38] border-[#EA580C] dark:border-[#FBBF24] ring-1 ring-[#EA580C]/35 shadow-sm'
                      : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]/60'
                  } ${isDisabled ? 'opacity-55' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-[#475569] dark:text-[#94A3B8]">
                        <span className="px-1.5 py-0.5 rounded bg-[#EFE9DC] dark:bg-[#132040] font-mono">
                          #{idx}
                        </span>
                        {pkg.isAlwaysFree ? (
                          <span className="text-emerald-700 dark:text-emerald-400">مجانية للأبد</span>
                        ) : pkg.promoFreeLimitedTime ? (
                          <span className="text-[#C2410C] dark:text-[#FBBF24]">
                            مجاناً مؤقتاً ({pkg.monthlyPriceEgp} ج.م)
                          </span>
                        ) : (
                          <span>{pkg.monthlyPriceEgp} ج.م / شهر</span>
                        )}
                      </div>
                      <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] leading-snug">
                        {pkgTitle}
                      </h3>
                      <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                        {count} {count === 1 ? 'زر مفعّل' : 'أزرار مفعّلة'} في هذه الباقة
                      </p>
                    </div>

                    {/* Controls: Reorder + Enable/Disable */}
                    <div
                      className="flex flex-col items-end gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => movePackageOrder(pkg.id, -1)}
                          title="تحريك لأعلى"
                          className="w-6 h-6 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center text-[#0C1427] dark:text-[#F7F3EA] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === packages.length - 1}
                          onClick={() => movePackageOrder(pkg.id, 1)}
                          title="تحريك لأسفل"
                          className="w-6 h-6 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center text-[#0C1427] dark:text-[#F7F3EA] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      {pkg.isAlwaysFree ? (
                        <span
                          title="الباقة الأساسية مفعّلة دائماً"
                          className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10"
                        >
                          <Lock className="w-2.5 h-2.5" />
                          <span>أساسية</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => togglePackageEnabled(pkg.id)}
                          className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg border cursor-pointer ${
                            isDisabled
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {isDisabled ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                          <span>{isDisabled ? 'مخفية' : 'ظاهرة'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Left Column (RTL): Active Package Editor + Live Preview + Cards/Buttons Matrix */}
        <div className="lg:col-span-8 space-y-4">
          {/* Package Summary & Collapsible Metadata Editor */}
          <div className="rounded-2xl bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-black text-[#EA580C] dark:text-[#FBBF24]">
                  الباقة المحددة حالياً ({audience === 'supplier' ? 'الموردين' : 'الفنانين والورش'})
                </span>
                <h2 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  {selectedPkgTitle}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowMetaEditor((v) => !v)}
                className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer"
              >
                {showMetaEditor ? 'إخفاء تعديل الاسم والسعر' : 'تعديل الاسم والوصف والسعر'}
              </button>
            </div>

            {showMetaEditor && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
                <label className="space-y-1">
                  <span className="text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
                    اسم الباقة ({audience === 'supplier' ? 'للموردين' : 'للفنانين'})
                  </span>
                  <input
                    type="text"
                    value={
                      audience === 'supplier'
                        ? selectedPkg.supplierTitleAr || selectedPkg.titleAr
                        : selectedPkg.titleAr
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      updatePackage(selectedPkg.id, (p) =>
                        audience === 'supplier' ? { ...p, supplierTitleAr: val } : { ...p, titleAr: val }
                      );
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
                      السعر الشهري (ج.م)
                    </span>
                    <input
                      type="number"
                      min={0}
                      disabled={selectedPkg.isAlwaysFree}
                      value={selectedPkg.monthlyPriceEgp}
                      onChange={(e) => {
                        const num = Math.max(0, Number(e.target.value) || 0);
                        updatePackage(selectedPkg.id, (p) => ({ ...p, monthlyPriceEgp: num }));
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-black text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C] disabled:opacity-50"
                    />
                  </label>

                  <label className="flex items-center gap-2 pt-5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={selectedPkg.isAlwaysFree}
                      checked={selectedPkg.promoFreeLimitedTime}
                      onChange={(e) =>
                        updatePackage(selectedPkg.id, (p) => ({
                          ...p,
                          promoFreeLimitedTime: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-[#EA580C] cursor-pointer"
                    />
                    <span className="text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA]">
                      عرض مجاني مؤقت
                    </span>
                  </label>
                </div>

                <label className="sm:col-span-2 space-y-1">
                  <span className="text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
                    وصف الباقة للمشترك
                  </span>
                  <textarea
                    rows={2}
                    value={
                      audience === 'supplier'
                        ? selectedPkg.supplierTaglineAr || selectedPkg.taglineAr
                        : selectedPkg.taglineAr
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      updatePackage(selectedPkg.id, (p) =>
                        audience === 'supplier'
                          ? { ...p, supplierTaglineAr: val }
                          : { ...p, taglineAr: val }
                      );
                    }}
                    className="w-full p-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
                  />
                </label>
              </div>
            )}

            {/* Live Subscriber Preview Strip */}
            <div className="rounded-xl bg-[#F7F3EA] dark:bg-[#081024] border border-[#D4CCBC] dark:border-[#1E2E52] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>معاينة فورية: ده بالظبط اللي هيفتح للمشترك في الباقة دي ({selectedActions.length})</span>
                </span>
              </div>
              {selectedActions.length === 0 ? (
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  لم يتم تحديد أي أزرار لهذه الباقة بعد — علّم على الأزرار اللي عايزها من الأسفل.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedActions.map((key) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFFDF8] dark:bg-[#132040] border border-[#EA580C]/40 text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA]"
                    >
                      <Check className="w-3 h-3 text-[#EA580C]" />
                      <span>{actionLabelLookup[key] || key}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 1: Top Navbar, Quick Add & Summary Widgets */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden">
            <div className="px-4 py-3 bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  أزرار الشريط العلوي والإضافة السريعة وملخص الشاشة
                </h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  toggleAllCardItemsInSelectedPackage(systemActions.map((a) => a.actionKey))
                }
                className="text-[11px] font-black text-[#C2410C] dark:text-[#FBBF24] hover:underline cursor-pointer"
              >
                {systemActions.every((a) => selectedActions.includes(a.actionKey))
                  ? 'إلغاء الكل'
                  : 'تحديد الكل'}
              </button>
            </div>

            <div className="p-3 divide-y divide-[#D4CCBC]/60 dark:divide-[#1E2E52]">
              {systemActions.map((act) => {
                const checked = selectedActions.includes(act.actionKey);
                const otherPkgs = actionOtherPackagesMap[act.actionKey] || [];
                return (
                  <div
                    key={act.actionKey}
                    className="py-2.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => toggleActionInSelectedPackage(act.actionKey)}
                      className="flex items-start gap-2.5 text-right cursor-pointer min-w-0 flex-1"
                    >
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-[#64748B] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                          {act.label}
                        </p>
                        <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                          {act.description}
                        </p>
                        {otherPkgs.length > 0 && (
                          <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
                            مفعّل أيضاً في: {otherPkgs.join(' · ')}
                          </p>
                        )}
                      </div>
                    </button>

                    {checked && (
                      <div className="flex items-center gap-1.5 shrink-0 pr-6 sm:pr-0">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-[#64748B]" />
                        <select
                          value=""
                          onChange={(e) =>
                            moveActionToAnotherPackage(
                              act.actionKey,
                              e.target.value as SubscriptionPackageId
                            )
                          }
                          aria-label={`نقل ${act.label} إلى باقة أخرى`}
                          className="h-8 px-2 rounded-lg bg-[#FFFDF8] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-bold text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer outline-none focus:border-[#EA580C]"
                        >
                          <option value="">نقل لباقة أخرى...</option>
                          {packages
                            .filter((p) => p.id !== selectedPkg.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {audience === 'supplier' && p.supplierTitleAr
                                  ? p.supplierTitleAr
                                  : p.titleAr}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Every Home Card & Every Internal Button */}
          <div className="space-y-3">
            {audienceCards.map((card) => {
              const CardIcon = getUiIcon(card.iconKey);
              const effectiveItems =
                card.items.length > 0
                  ? card.items.map((it) => ({
                      id: it.id,
                      actionKey: it.actionKey,
                      label: it.label,
                      description: actionDescLookup[it.actionKey] || '',
                    }))
                  : card.directActionKey
                  ? [
                      {
                        id: `${card.id}_direct`,
                        actionKey: card.directActionKey,
                        label: card.label,
                        description:
                          card.subtitle || actionDescLookup[card.directActionKey] || 'بطاقة مباشرة بضغطة واحدة',
                      },
                    ]
                  : [];

              const cardKeys = effectiveItems.map((it) => it.actionKey).filter(Boolean);
              if (cardKeys.length === 0) return null;
              const activeCount = cardKeys.filter((k) => selectedActions.includes(k)).length;
              const allActive = cardKeys.length > 0 && activeCount === cardKeys.length;

              return (
                <div
                  key={card.id}
                  className={`rounded-2xl border overflow-hidden transition ${
                    activeCount > 0
                      ? 'bg-[#FFFDF8] dark:bg-[#0D162E] border-[#EA580C]/50 dark:border-[#FBBF24]/40'
                      : 'bg-[#F7F3EA] dark:bg-[#0A1124] border-[#D4CCBC] dark:border-[#22355E]'
                  }`}
                >
                  {/* Card Master Header */}
                  <div className="px-4 py-3 bg-[#EFE9DC]/80 dark:bg-[#132040]/80 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center shrink-0">
                        <CardIcon className="w-4 h-4 text-[#C2410C] dark:text-[#FBBF24]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                          بطاقة: {card.label}
                        </h3>
                        <p className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                          مفعّل {activeCount} من {cardKeys.length}{' '}
                          {cardKeys.length === 1 ? 'زر مباشر' : 'أزرار داخل البطاقة'}
                          {activeCount === 1
                            ? ' (هيظهر كزرار مباشر لوحده بدون بطاقة فاضية)'
                            : activeCount === 0
                            ? ' (البطاقة مخفية تماماً في الباقة دي)'
                            : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleAllCardItemsInSelectedPackage(cardKeys)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border cursor-pointer shrink-0 transition ${
                        allActive
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                          : 'bg-[#EA580C]/10 border-[#EA580C]/35 text-[#C2410C] dark:text-[#FBBF24]'
                      }`}
                    >
                      {allActive ? 'إلغاء البطاقة كلها' : 'تحديد البطاقة كلها'}
                    </button>
                  </div>

                  {/* Card Individual Buttons */}
                  <div className="p-3 divide-y divide-[#D4CCBC]/50 dark:divide-[#1E2E52]">
                    {effectiveItems.map((item) => {
                      const checked = selectedActions.includes(item.actionKey);
                      const otherPkgs = actionOtherPackagesMap[item.actionKey] || [];

                      return (
                        <div
                          key={item.id}
                          className="py-2.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <button
                            type="button"
                            onClick={() => toggleActionInSelectedPackage(item.actionKey)}
                            className="flex items-start gap-2.5 text-right cursor-pointer min-w-0 flex-1"
                          >
                            {checked ? (
                              <CheckSquare className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
                            ) : (
                              <Square className="w-4 h-4 text-[#64748B] shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <p
                                className={`text-xs font-black ${
                                  checked
                                    ? 'text-[#0C1427] dark:text-[#F7F3EA]'
                                    : 'text-[#475569] dark:text-[#94A3B8]'
                                }`}
                              >
                                {item.label}
                              </p>
                              {item.description && (
                                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                  {item.description}
                                </p>
                              )}
                              {otherPkgs.length > 0 && (
                                <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
                                  مفعّل أيضاً في: {otherPkgs.join(' · ')}
                                </p>
                              )}
                            </div>
                          </button>

                          {checked && (
                            <div className="flex items-center gap-1.5 shrink-0 pr-6 sm:pr-0">
                              <ArrowLeftRight className="w-3.5 h-3.5 text-[#64748B]" />
                              <select
                                value=""
                                onChange={(e) =>
                                  moveActionToAnotherPackage(
                                    item.actionKey,
                                    e.target.value as SubscriptionPackageId
                                  )
                                }
                                aria-label={`نقل ${item.label} إلى باقة أخرى`}
                                className="h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-bold text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer outline-none focus:border-[#EA580C]"
                              >
                                <option value="">نقل لباقة أخرى...</option>
                                {packages
                                  .filter((p) => p.id !== selectedPkg.id)
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {audience === 'supplier' && p.supplierTitleAr
                                        ? p.supplierTitleAr
                                        : p.titleAr}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Bottom Save Bar */}
      <div className="fixed bottom-3 inset-x-3 sm:inset-x-6 z-40 max-w-5xl mx-auto">
        <div className="rounded-2xl bg-[#0C1427]/95 dark:bg-[#0B142A]/95 backdrop-blur-md border border-[#EA580C]/50 p-3 sm:px-5 flex flex-col sm:flex-row items-center justify-between gap-2.5 shadow-xl">
          <div className="text-xs text-[#F7F3EA] font-bold text-center sm:text-right">
            {hasUnsavedChanges ? (
              <span className="text-[#FBBF24] font-black">
                لديك تعديلات غير منشورة بعد — اضغط حفظ لتطبيقها فوراً على كل الحسابات
              </span>
            ) : (
              <span>كل التعديلات متزامنة وجاهزة للتطبيق الفوري على الفنانين والموردين</span>
            )}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveAndPublish}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جاري النشر السحابي...' : 'حفظ ونشر الباقات والصلاحيات الآن'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
