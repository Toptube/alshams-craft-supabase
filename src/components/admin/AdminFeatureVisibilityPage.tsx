import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  X,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  Layers,
  ShieldCheck,
  Globe,
  Check,
} from 'lucide-react';
import {
  PlatformFeatureFlags,
  DEFAULT_PLATFORM_FEATURE_FLAGS,
  FEATURE_FLAG_ITEMS,
  getStoredFeatureFlags,
  saveStoredFeatureFlags,
} from '../../types/featureFlags';
import {
  LandingCmsConfig,
  getStoredLandingCmsConfig,
  saveStoredLandingCmsConfig,
} from '../../types/landingCms';
import { syncPlatformSettingsFromCloud } from '../../services/marketplaceCartService';
import { playSuccessSound, playErrorSound } from '../../lib/sounds';

interface AdminFeatureVisibilityPageProps {
  onBack: () => void;
  saving?: boolean;
  onSaveToCloud: (flags: PlatformFeatureFlags, cms: LandingCmsConfig) => Promise<void>;
}

const LANDING_SECTION_TOGGLE_META: {
  key: keyof Pick<
    LandingCmsConfig['sections'],
    | 'safeAccounts'
    | 'aiPartners'
    | 'craftLifecycle'
    | 'crmClients'
    | 'smartCatalog'
    | 'craftStore'
    | 'toolMaintenance'
    | 'suppliersPromo'
    | 'reviews'
    | 'whatsNew'
    | 'faq'
    | 'finalCta'
  >;
  label: string;
}[] = [
  { key: 'safeAccounts', label: 'قسم: عقلك الحرفي والسيولة المنضبطة' },
  { key: 'aiPartners', label: 'قسم: صقر وشموسة AI' },
  { key: 'craftLifecycle', label: 'قسم: رحلة المشغولة (4 خطوات)' },
  { key: 'crmClients', label: 'قسم: إدارة وعلاقات العملاء (CRM)' },
  { key: 'smartCatalog', label: 'قسم: الكتالوج وعروض الأسعار' },
  { key: 'craftStore', label: 'قسم: متجري وسوق الشمساوية' },
  { key: 'toolMaintenance', label: 'قسم: صيانة العِدد وخطوط الإنتاج' },
  { key: 'suppliersPromo', label: 'قسم: بوابة موردي وتجار ومصانع الخامات' },
  { key: 'reviews', label: 'قسم: حكايات الورش والتقييمات' },
  { key: 'whatsNew', label: 'قسم: جديد عيلة الشمساوية' },
  { key: 'faq', label: 'قسم: الأسئلة الشائعة' },
  { key: 'finalCta', label: 'قسم: دعوة التسجيل الختامية' },
];

export const AdminFeatureVisibilityPage: React.FC<AdminFeatureVisibilityPageProps> = ({
  onBack,
  saving = false,
  onSaveToCloud,
}) => {
  const [flags, setFlags] = useState<PlatformFeatureFlags>(() => getStoredFeatureFlags());
  const [cms, setCms] = useState<LandingCmsConfig>(() => getStoredLandingCmsConfig());
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    syncPlatformSettingsFromCloud()
      .then(() => {
        setFlags(getStoredFeatureFlags());
        setCms(getStoredLandingCmsConfig());
      })
      .catch(() => {});
  }, []);

  const toggleFlag = (key: keyof Omit<PlatformFeatureFlags, 'updatedAt'>) => {
    setFlags((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleLandingSection = (
    key: (typeof LANDING_SECTION_TOGGLE_META)[number]['key']
  ) => {
    setCms((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [key]: {
          ...prev.sections[key],
          visible: !prev.sections[key].visible,
        },
      },
    }));
  };

  const applyArtisanOnlyPreset = () => {
    setFlags((prev) => ({
      ...prev,
      supplierRegistrationEnabled: false,
      supplierPortalEnabled: false,
      supplierLandingPromoEnabled: false,
      suppliersMarketplaceEnabled: false,
      supplierErpEnabled: false,
    }));
    setBanner({
      type: 'success',
      text: 'تم تطبيق وضع الفنانين فقط مؤقتاً — اضغط "حفظ ونشر إعدادات الظهور" للاعتماد للجميع.',
    });
  };

  const applyEnableAllReadyPreset = () => {
    setFlags((prev) => ({
      ...DEFAULT_PLATFORM_FEATURE_FLAGS,
      supplierRegistrationEnabled: true,
      supplierPortalEnabled: true,
      supplierLandingPromoEnabled: true,
      supplierErpEnabled: true,
      suppliersMarketplaceEnabled: prev.suppliersMarketplaceEnabled,
    }));
    setBanner({
      type: 'success',
      text: 'تم تفعيل جميع الأقسام والمزايا الجاهزة — اضغط "حفظ ونشر إعدادات الظهور" للاعتماد للجميع.',
    });
  };

  const handleSave = async () => {
    setBanner(null);
    const stampedFlags = saveStoredFeatureFlags({
      ...flags,
      updatedAt: new Date().toISOString(),
    });
    const stampedCms = saveStoredLandingCmsConfig({
      ...cms,
      updatedAt: new Date().toISOString(),
    });
    setFlags(stampedFlags);
    setCms(stampedCms);

    try {
      await onSaveToCloud(stampedFlags, stampedCms);
      playSuccessSound();
      setBanner({
        type: 'success',
        text: 'تم حفظ ونشر إعدادات الظهور والإخفاء لحظياً لجميع حسابات المنظومة.',
      });
    } catch (err: any) {
      playErrorSound();
      setBanner({
        type: 'error',
        text: err?.message || 'تعذر حفظ الإعدادات سحابياً، حاول مرة أخرى.',
      });
    }
  };

  const supplierFlags = FEATURE_FLAG_ITEMS.filter((i) => i.group === 'suppliers');
  const coreFlags = FEATURE_FLAG_ITEMS.filter((i) => i.group === 'workshop_core');

  const renderSwitch = (
    checked: boolean,
    onToggle: () => void,
    label: string
  ) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
        checked
          ? 'bg-emerald-600 border-emerald-700'
          : 'bg-slate-300 dark:bg-slate-700 border-slate-400 dark:border-slate-600'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? '-translate-x-7' : '-translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-4 pb-12 space-y-5" dir="rtl">
      {/* Header with BOTH رجوع and × close buttons */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>رجوع</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              aria-label="إغلاق"
              title="إغلاق"
              className="w-9 h-9 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 hover:text-rose-600 text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h1 className="text-base sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>التحكم في ظهور الصفحات والمزايا</span>
            </h1>
          </div>
          <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
            تحكّم فورياً في إظهار أو إخفاء أي صفحة أو نظام (بدون حذف أي بيانات من قاعدة البيانات). عند الإخفاء يظهر النظام للزوار والفنانين بالشكل المستقر فقط.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>حفظ ونشر الإعدادات للجميع</span>
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`rounded-2xl p-3.5 text-xs font-black border flex items-center justify-between gap-2 ${
            banner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-800 dark:text-rose-200'
          }`}
        >
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} className="p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Presets */}
      <div className="rounded-2xl bg-[#EFE9DC]/80 dark:bg-[#132040]/70 border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
          أوضاع تشغيل سريعة بضغطة زر (يمكنك بعدها التعديل بحرية ثم الحفظ):
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyArtisanOnlyPreset}
            className="px-3.5 py-2 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] text-[#FBBF24] text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>وضع الفنانين فقط (إخفاء منظومة الموردين مؤقتاً)</span>
          </button>
          <button
            type="button"
            onClick={applyEnableAllReadyPreset}
            className="px-3.5 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-emerald-500 text-[#0C1427] dark:text-[#F7F3EA] text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
            <span>تفعيل جميع المزايا الجاهزة</span>
          </button>
        </div>
      </div>

      {/* Group 1: منظومة الموردين */}
      <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
          <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>1. منظومة الموردين وسوق الخامات</span>
          </h2>
          <span className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
            آمن للإيقاف عند الصيانة أو التطوير
          </span>
        </div>

        <div className="divide-y divide-[#D4CCBC]/70 dark:divide-[#22355E]">
          {supplierFlags.map((item) => {
            const isOn = Boolean(flags[item.key]);
            return (
              <div key={item.key} className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                      {item.title}
                    </span>
                    <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                      · {isOn ? 'ظاهر للمستخدمين' : 'مخفي تماماً'}
                      {item.isBeta ? ' · قيد الإعداد' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                    {item.description}
                  </p>
                </div>
                {renderSwitch(isOn, () => toggleFlag(item.key), item.title)}
              </div>
            );
          })}
        </div>
      </section>

      {/* Group 2: الصفحات والأقسام الرئيسية للورش */}
      <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
          <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>2. الصفحات والأقسام الرئيسية للورش والحسابات</span>
          </h2>
          <span className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
            السوبر أدمن يظل قادراً على معاينة الإعدادات دائماً
          </span>
        </div>

        <div className="divide-y divide-[#D4CCBC]/70 dark:divide-[#22355E]">
          {coreFlags.map((item) => {
            const isOn = Boolean(flags[item.key]);
            return (
              <div key={item.key} className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                      {item.title}
                    </span>
                    <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                      · {isOn ? 'مفعّل' : 'مخفي'}
                    </span>
                  </div>
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                    {item.description}
                  </p>
                </div>
                {renderSwitch(isOn, () => toggleFlag(item.key), item.title)}
              </div>
            );
          })}
        </div>
      </section>

      {/* Group 3: أقسام صفحة الهبوط */}
      <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
          <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>3. ظهور وإخفاء أقسام صفحة الهبوط للزوار</span>
          </h2>
          <span className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
            مربوط مباشرة بصفحة الهبوط
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {LANDING_SECTION_TOGGLE_META.map((sec) => {
            const isVisible = cms.sections[sec.key]?.visible !== false;
            return (
              <div
                key={sec.key}
                className="rounded-xl bg-[#EFE9DC]/65 dark:bg-[#132040]/70 border border-[#D4CCBC] dark:border-[#22355E] p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                    {sec.label}
                  </p>
                  <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                    {isVisible ? 'ظاهر في الصفحة العامة' : 'مخفي من الصفحة العامة'}
                  </p>
                </div>
                {renderSwitch(isVisible, () => toggleLandingSection(sec.key), sec.label)}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="px-6 py-3 rounded-2xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          <span>حفظ ونشر جميع إعدادات الظهور</span>
        </button>
      </div>
    </div>
  );
};
