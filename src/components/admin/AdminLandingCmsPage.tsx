import React, { useState, useRef } from 'react';
import {
  ArrowRight,
  Save,
  Sparkles,
  Image as ImageIcon,
  Sun,
  Moon,
  Upload,
  RotateCcw,
  Check,
  X,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Wand2,
  Layout,
  MessageSquareQuote,
  HelpCircle,
  DoorOpen,
} from 'lucide-react';
import {
  LandingCmsConfig,
  DEFAULT_BRAND_ASSETS,
  DEFAULT_LANDING_CMS_CONFIG,
  getStoredLandingCmsConfig,
  saveStoredLandingCmsConfig,
} from '../../types/landingCms';
import { processBrandAssetUpload } from '../../utils/imageTransparentProcessor';
import { playSuccessSound } from '../../lib/sounds';

interface AdminLandingCmsPageProps {
  onBack: () => void;
  onSaveToCloud: (cms: LandingCmsConfig) => Promise<void>;
  saving?: boolean;
}

type CmsSectionTab = 'brand_assets' | 'header_hero' | 'core_sections' | 'social_faq' | 'footer_gate';

type AssetSlotKey = 'platformLogo' | 'brandIcon' | 'falconMascot' | 'shamousaMascot';

const ASSET_SLOT_META: {
  key: AssetSlotKey;
  title: string;
  subtitle: string;
  recommendedMaxDim: number;
  defaultSvgWrap: boolean;
}[] = [
  {
    key: 'platformLogo',
    title: 'لوجو / شعار المنظومة المكتوب',
    subtitle: 'الشعار العريض في أعلى صفحة الهبوط وبوابة الترحيب والتسجيل',
    recommendedMaxDim: 420,
    defaultSvgWrap: false,
  },
  {
    key: 'brandIcon',
    title: 'أيقونة المنظومة / الشعار المربع',
    subtitle: 'الأيقونة المربعة بجانب اسم المنظومة وفي التذييل وصفحات الدخول',
    recommendedMaxDim: 192,
    defaultSvgWrap: true,
  },
  {
    key: 'falconMascot',
    title: 'أيقونة وشخصية صقر الشمساوية AI',
    subtitle: 'شخصية صقر في صفحة الهبوط وبوابة الترحيب والمساعد الذكي',
    recommendedMaxDim: 380,
    defaultSvgWrap: false,
  },
  {
    key: 'shamousaMascot',
    title: 'أيقونة وشخصية شموسة',
    subtitle: 'شخصية شموسة في صفحة الهبوط وبوابة الترحيب وزر المساعدة العائم',
    recommendedMaxDim: 380,
    defaultSvgWrap: false,
  },
];

export const AdminLandingCmsPage: React.FC<AdminLandingCmsPageProps> = ({
  onBack,
  onSaveToCloud,
  saving = false,
}) => {
  const [cms, setCms] = useState<LandingCmsConfig>(() => getStoredLandingCmsConfig());
  const [activeTab, setActiveTab] = useState<CmsSectionTab>('header_hero');
  const [showAssetsModal, setShowAssetsModal] = useState<boolean>(false);

  // خيارات معالجة الصورة عند الرفع
  const [autoRemoveBg, setAutoRemoveBg] = useState<boolean>(true);
  const [convertToCompactSvg, setConvertToCompactSvg] = useState<boolean>(false);
  const [processingSlot, setProcessingSlot] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handlePersist = async (targetCms: LandingCmsConfig = cms) => {
    const saved = saveStoredLandingCmsConfig(targetCms);
    setCms(saved);
    await onSaveToCloud(saved);
    playSuccessSound();
  };

  const handleAssetUpload = async (
    slot: AssetSlotKey,
    themeVariant: 'light' | 'dark',
    file: File,
    meta: (typeof ASSET_SLOT_META)[number]
  ) => {
    const noticeKey = `${slot}_${themeVariant}`;
    setProcessingSlot(noticeKey);
    try {
      const processed = await processBrandAssetUpload(file, {
        maxDimension: meta.recommendedMaxDim,
        autoRemoveBg,
        wrapAsCompactSvg: convertToCompactSvg || meta.defaultSvgWrap,
      });
      setCms((prev) => ({
        ...prev,
        brandAssets: {
          ...prev.brandAssets,
          [slot]: {
            ...prev.brandAssets[slot],
            [themeVariant]: processed.dataUrl,
          },
        },
      }));
      const kb = Math.max(1, Math.round(processed.finalBytes / 1024));
      setUploadNotice((prev) => ({
        ...prev,
        [noticeKey]: `تم التجهيز (${processed.format.toUpperCase()} · ${kb} KB${processed.backgroundRemoved ? ' · خلفية شفافة' : ''})`,
      }));
    } catch (err: any) {
      setUploadNotice((prev) => ({
        ...prev,
        [noticeKey]: err?.message || 'تعذر معالجة الصورة المختارة',
      }));
    } finally {
      setProcessingSlot(null);
    }
  };

  const handleRestoreAssetVariant = (slot: AssetSlotKey, themeVariant: 'light' | 'dark') => {
    const noticeKey = `${slot}_${themeVariant}`;
    setCms((prev) => ({
      ...prev,
      brandAssets: {
        ...prev.brandAssets,
        [slot]: {
          ...prev.brandAssets[slot],
          [themeVariant]: DEFAULT_BRAND_ASSETS[slot][themeVariant],
        },
      },
    }));
    setUploadNotice((prev) => ({
      ...prev,
      [noticeKey]: 'تمت استعادة الشكل الافتراضي',
    }));
  };

  const handleResetAllTexts = async () => {
    const next: LandingCmsConfig = {
      ...DEFAULT_LANDING_CMS_CONFIG,
      brandAssets: cms.brandAssets,
    };
    setCms(next);
    await handlePersist(next);
  };

  const renderBrandAssetsGrid = () => (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h4 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>خيارات التحويل التلقائي عند اختيار صورة من الهاتف</span>
          </h4>
          <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
            يتم ضغط الصورة وتفريغ الخلفية الموحدة تلقائياً لتحصل على أيقونة شفافة وخفيفة المساحة فور الحفظ.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer">
            <input
              type="checkbox"
              checked={autoRemoveBg}
              onChange={(e) => setAutoRemoveBg(e.target.checked)}
              className="w-4 h-4 accent-[#EA580C]"
            />
            <span>تفريغ الخلفية لتصبح شفافة</span>
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer">
            <input
              type="checkbox"
              checked={convertToCompactSvg}
              onChange={(e) => setConvertToCompactSvg(e.target.checked)}
              className="w-4 h-4 accent-[#EA580C]"
            />
            <span>تحويل الكل لغلاف SVG مضغوط</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ASSET_SLOT_META.map((meta) => {
          const pair = cms.brandAssets[meta.key];
          return (
            <div
              key={meta.key}
              className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-4"
            >
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  {meta.title}
                </h3>
                <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] mt-0.5">{meta.subtitle}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['light', 'dark'] as const).map((variant) => {
                  const keyId = `${meta.key}_${variant}`;
                  const isDarkTile = variant === 'dark';
                  const currentSrc = pair[variant];
                  const isBusy = processingSlot === keyId;
                  const notice = uploadNotice[keyId];

                  return (
                    <div
                      key={variant}
                      className="rounded-xl border border-[#D4CCBC] dark:border-[#22355E] p-3 space-y-2.5 bg-[#EFE9DC]/60 dark:bg-[#132040]/70"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                          {isDarkTile ? (
                            <>
                              <Moon className="w-3.5 h-3.5 text-amber-400" />
                              <span>النسخة الليلية — الحالي</span>
                            </>
                          ) : (
                            <>
                              <Sun className="w-3.5 h-3.5 text-[#EA580C]" />
                              <span>النسخة النهارية — الحالي</span>
                            </>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRestoreAssetVariant(meta.key, variant)}
                          title="استعادة الافتراضي"
                          className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] hover:text-[#EA580C] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>افتراضي</span>
                        </button>
                      </div>

                      {/* مربع عرض الشكل الحالي على خلفية نهارية أو ليلية للتأكد من الشفافية */}
                      <div
                        className={`h-28 rounded-xl border flex items-center justify-center p-2 overflow-hidden relative ${
                          isDarkTile
                            ? 'bg-[#081024] border-[#22355E]'
                            : 'bg-white border-stone-200'
                        }`}
                      >
                        <img
                          src={currentSrc}
                          alt={`${meta.title} (${variant})`}
                          className="max-h-full max-w-full object-contain select-none"
                        />
                      </div>

                      <input
                        ref={(el) => {
                          fileInputRefs.current[keyId] = el;
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleAssetUpload(meta.key, variant, file, meta);
                          }
                          e.target.value = '';
                        }}
                      />

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => fileInputRefs.current[keyId]?.click()}
                        className="w-full py-2 px-3 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] dark:bg-[#EA580C] dark:hover:bg-[#C2410C] text-white text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>اختيار أيقونة جديدة من الهاتف</span>
                          </>
                        )}
                      </button>

                      {notice && (
                        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 text-center">
                          {notice}
                        </p>
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
  );

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-4 pb-12 space-y-5" dir="rtl">
      {/* شريط العنوان والإجراءات السريعة */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع للرئيسية</span>
            </button>
            <h1 className="text-base sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA]">
              لوحة تحكم صفحة الهبوط والشعارات
            </h1>
          </div>
          <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
            عدّل كل عنوان ووصف ونص زر في صفحة الهبوط وبوابة الترحيب، أو غيّر شعارات وأيقونات شموسة وصقر (نهاري وليلي) بضغطة زر.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowAssetsModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] dark:bg-[#1A2B54] dark:hover:bg-[#22355E] text-[#FBBF24] border border-[#22355E] text-xs font-black flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <ImageIcon className="w-4 h-4" />
            <span>تغيير أيقونة شموسة وصقر والشعارات</span>
          </button>

          <button
            type="button"
            onClick={handleResetAllTexts}
            className="px-3 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#334155] dark:text-[#CBD5E1] hover:border-rose-500 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة النصوص</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handlePersist()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white text-xs font-black flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>تم الحفظ ونشر التعديلات</span>
          </button>
        </div>
      </div>

      {/* شريط التبويبات البسيط */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
        {[
          { id: 'header_hero' as const, label: 'الشريط العلوي والهيرو', icon: <Sparkles className="w-3.5 h-3.5" /> },
          { id: 'brand_assets' as const, label: 'أيقونات شموسة وصقر والشعار', icon: <ImageIcon className="w-3.5 h-3.5" /> },
          { id: 'core_sections' as const, label: 'الأقسام والمميزات والأزرار', icon: <Layout className="w-3.5 h-3.5" /> },
          { id: 'social_faq' as const, label: 'حكايات الورش والأسئلة والجديد', icon: <MessageSquareQuote className="w-3.5 h-3.5" /> },
          { id: 'footer_gate' as const, label: 'بوابة الترحيب والختام والتذييل', icon: <DoorOpen className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#EA580C] text-white shadow-xs'
                : 'text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F7F3EA]/70 dark:hover:bg-[#0D162E]/70'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* التبويب 1: الأيقونات والشعارات داخل الصفحة أيضاً */}
      {activeTab === 'brand_assets' && (
        <div className="space-y-4">
          {renderBrandAssetsGrid()}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => handlePersist()}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>تم الحفظ واعتماد الأيقونات الجديدة</span>
            </button>
          </div>
        </div>
      )}

      {/* التبويب 2: الشريط العلوي والهيرو */}
      {activeTab === 'header_hero' && (
        <div className="space-y-5">
          {/* الشريط العلوي */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-4">
            <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
              1. الشريط العلوي وزر الدخول
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">نص زر الشريط العلوي الرئيسي (الافتراضي: سجل الآن)</label>
                <input
                  type="text"
                  value={cms.header.ctaButtonText}
                  onChange={(e) =>
                    setCms((p) => ({ ...p, header: { ...p.header, ctaButtonText: e.target.value } }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">نص زر بوابة الترحيب في الشريط العلوي</label>
                <input
                  type="text"
                  value={cms.header.welcomeGateButtonText}
                  onChange={(e) =>
                    setCms((p) => ({
                      ...p,
                      header: { ...p.header, welcomeGateButtonText: e.target.value },
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold">روابط القائمة العلوية (5 روابط)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {cms.header.navLinks.map((lnk, idx) => (
                  <input
                    key={lnk.id}
                    type="text"
                    value={lnk.label}
                    onChange={(e) => {
                      const nextLinks = [...cms.header.navLinks];
                      nextLinks[idx] = { ...nextLinks[idx], label: e.target.value };
                      setCms((p) => ({ ...p, header: { ...p.header, navLinks: nextLinks } }));
                    }}
                    className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* واجهة الهيرو الأولى */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-4">
            <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
              2. الواجهة الرئيسية (Hero Section)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">السطر الأول من العنوان الرئيسي</label>
                <input
                  type="text"
                  value={cms.hero.headlineLine1}
                  onChange={(e) =>
                    setCms((p) => ({ ...p, hero: { ...p.hero, headlineLine1: e.target.value } }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">السطر الثاني الملوّن من العنوان الرئيسي</label>
                <input
                  type="text"
                  value={cms.hero.headlineHighlight}
                  onChange={(e) =>
                    setCms((p) => ({ ...p, hero: { ...p.hero, headlineHighlight: e.target.value } }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">الوصف التسويقي أسفل العنوان</label>
              <textarea
                rows={3}
                value={cms.hero.description}
                onChange={(e) =>
                  setCms((p) => ({ ...p, hero: { ...p.hero, description: e.target.value } }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">نص الزر الأساسي (CTA)</label>
                <input
                  type="text"
                  value={cms.hero.primaryCtaText}
                  onChange={(e) =>
                    setCms((p) => ({ ...p, hero: { ...p.hero, primaryCtaText: e.target.value } }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">نص الزر الثانوي</label>
                <input
                  type="text"
                  value={cms.hero.secondaryCtaText}
                  onChange={(e) =>
                    setCms((p) => ({ ...p, hero: { ...p.hero, secondaryCtaText: e.target.value } }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">شارة شخصية صقر</label>
                <input
                  type="text"
                  value={cms.hero.falconBadgeText}
                  onChange={(e) =>
                    setCms((p) => ({ ...p, hero: { ...p.hero, falconBadgeText: e.target.value } }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">شارة الثقة 1</label>
                <input
                  type="text"
                  value={cms.hero.trustBadge1}
                  onChange={(e) =>
                    setCms((p) => ({ ...p, hero: { ...p.hero, trustBadge1: e.target.value } }))
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">شارة الثقة 2</label>
                <input
                  type="text"
                  value={cms.hero.trustBadge2}
                  onChange={(e) =>
                    setCms((p) => ({ ...p, hero: { ...p.hero, trustBadge2: e.target.value } }))
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">شارة الثقة 3</label>
                <input
                  type="text"
                  value={cms.hero.trustBadge3}
                  onChange={(e) =>
                    setCms((p) => ({ ...p, hero: { ...p.hero, trustBadge3: e.target.value } }))
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* التبويب 3: الأقسام والمميزات ونصوص أزرارها */}
      {activeTab === 'core_sections' && (
        <div className="space-y-4">
          {/* قسم المالية والسيولة */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">قسم 1: عقلك الحرفي (المالية والخزائن)</h3>
              <button
                type="button"
                onClick={() =>
                  setCms((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      safeAccounts: { ...p.sections.safeAccounts, visible: !p.sections.safeAccounts.visible },
                    },
                  }))
                }
                className="px-3 py-1 rounded-xl border text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                {cms.sections.safeAccounts.visible ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-rose-600" />}
                <span>{cms.sections.safeAccounts.visible ? 'ظاهر للزوار' : 'مخفي'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={cms.sections.safeAccounts.title}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      safeAccounts: { ...p.sections.safeAccounts, title: e.target.value },
                    },
                  }))
                }
                placeholder="عنوان القسم"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <input
                type="text"
                value={cms.sections.safeAccounts.ctaText}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      safeAccounts: { ...p.sections.safeAccounts, ctaText: e.target.value },
                    },
                  }))
                }
                placeholder="نص الزر داخل القسم"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>
            <textarea
              rows={2}
              value={cms.sections.safeAccounts.subtitle}
              onChange={(e) =>
                setCms((p) => ({
                  ...p,
                  sections: {
                    ...p.sections,
                    safeAccounts: { ...p.sections.safeAccounts, subtitle: e.target.value },
                  },
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
          </div>

          {/* قسم صقر وشموسة */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">قسم 2: صقر وشموسة AI</h3>
              <button
                type="button"
                onClick={() =>
                  setCms((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      aiPartners: { ...p.sections.aiPartners, visible: !p.sections.aiPartners.visible },
                    },
                  }))
                }
                className="px-3 py-1 rounded-xl border text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                {cms.sections.aiPartners.visible ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-rose-600" />}
                <span>{cms.sections.aiPartners.visible ? 'ظاهر' : 'مخفي'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={cms.sections.aiPartners.title}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      aiPartners: { ...p.sections.aiPartners, title: e.target.value },
                    },
                  }))
                }
                placeholder="العنوان"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <input
                type="text"
                value={cms.sections.aiPartners.simulatorCtaText}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      aiPartners: { ...p.sections.aiPartners, simulatorCtaText: e.target.value },
                    },
                  }))
                }
                placeholder="نص زر المحاكي"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <textarea
                rows={2}
                value={cms.sections.aiPartners.falconDescription}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      aiPartners: { ...p.sections.aiPartners, falconDescription: e.target.value },
                    },
                  }))
                }
                placeholder="وصف دور صقر"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <textarea
                rows={2}
                value={cms.sections.aiPartners.shamousaDescription}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      aiPartners: { ...p.sections.aiPartners, shamousaDescription: e.target.value },
                    },
                  }))
                }
                placeholder="وصف دور شموسة"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>
          </div>

          {/* أقسام رحلة المشغولة + CRM + الكتالوج + السوق + صيانة العدد */}
          {(
            [
              { key: 'crmClients', label: 'قسم: إدارة العملاء (CRM الحرفي)' },
              { key: 'smartCatalog', label: 'قسم: الكتالوج وعروض الأسعار' },
              { key: 'craftStore', label: 'قسم: المتجر وسوق الشمساوية' },
              { key: 'toolMaintenance', label: 'قسم: صيانة العِدد وخطوط الإنتاج' },
            ] as const
          ).map((sec) => {
            const secData = cms.sections[sec.key];
            return (
              <div
                key={sec.key}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black">{sec.label}</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setCms((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          [sec.key]: { ...secData, visible: !secData.visible },
                        },
                      }))
                    }
                    className="px-3 py-1 rounded-xl border text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {secData.visible ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>{secData.visible ? 'ظاهر' : 'مخفي'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={secData.titleLine1}
                    onChange={(e) =>
                      setCms((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          [sec.key]: { ...secData, titleLine1: e.target.value },
                        },
                      }))
                    }
                    placeholder="العنوان (سطر 1)"
                    className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={secData.titleHighlight}
                    onChange={(e) =>
                      setCms((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          [sec.key]: { ...secData, titleHighlight: e.target.value },
                        },
                      }))
                    }
                    placeholder="العنوان المميز (سطر 2)"
                    className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={secData.ctaText}
                    onChange={(e) =>
                      setCms((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          [sec.key]: { ...secData, ctaText: e.target.value },
                        },
                      }))
                    }
                    placeholder="نص الزر"
                    className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                </div>
                <textarea
                  rows={2}
                  value={secData.description}
                  onChange={(e) =>
                    setCms((p) => ({
                      ...p,
                      sections: {
                        ...p.sections,
                        [sec.key]: { ...secData, description: e.target.value },
                      },
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* التبويب 4: حكايات الورش + جديد المنظومة + الأسئلة الشائعة */}
      {activeTab === 'social_faq' && (
        <div className="space-y-5">
          {/* قسم جديد المنظومة */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black">قسم: جديد عيلة الشمساوية</h3>
              <button
                type="button"
                onClick={() =>
                  setCms((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      whatsNew: {
                        ...p.sections.whatsNew,
                        items: [
                          ...p.sections.whatsNew.items,
                          {
                            id: 'wn_' + Date.now(),
                            tag: 'تحديث جديد',
                            version: 'V 3.1',
                            title: 'ميزة جديدة بالمنظومة',
                            description: 'اكتب وصف الميزة الجديدة هنا...',
                          },
                        ],
                      },
                    },
                  }))
                }
                className="px-3 py-1.5 rounded-xl bg-[#EA580C] text-white text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة تحديث</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {cms.sections.whatsNew.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2 relative"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const next = cms.sections.whatsNew.items.filter((_, i) => i !== idx);
                      setCms((p) => ({
                        ...p,
                        sections: { ...p.sections, whatsNew: { ...p.sections.whatsNew, items: next } },
                      }));
                    }}
                    className="text-rose-500 hover:text-rose-600 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={item.tag}
                      onChange={(e) => {
                        const next = [...cms.sections.whatsNew.items];
                        next[idx] = { ...next[idx], tag: e.target.value };
                        setCms((p) => ({
                          ...p,
                          sections: { ...p.sections, whatsNew: { ...p.sections.whatsNew, items: next } },
                        }));
                      }}
                      placeholder="الوسم"
                      className="px-2 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border text-[11px] font-bold"
                    />
                    <input
                      type="text"
                      value={item.version}
                      onChange={(e) => {
                        const next = [...cms.sections.whatsNew.items];
                        next[idx] = { ...next[idx], version: e.target.value };
                        setCms((p) => ({
                          ...p,
                          sections: { ...p.sections, whatsNew: { ...p.sections.whatsNew, items: next } },
                        }));
                      }}
                      placeholder="الإصدار"
                      className="px-2 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border text-[11px] font-bold"
                    />
                  </div>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => {
                      const next = [...cms.sections.whatsNew.items];
                      next[idx] = { ...next[idx], title: e.target.value };
                      setCms((p) => ({
                        ...p,
                        sections: { ...p.sections, whatsNew: { ...p.sections.whatsNew, items: next } },
                      }));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border text-xs font-bold"
                  />
                  <textarea
                    rows={2}
                    value={item.description}
                    onChange={(e) => {
                      const next = [...cms.sections.whatsNew.items];
                      next[idx] = { ...next[idx], description: e.target.value };
                      setCms((p) => ({
                        ...p,
                        sections: { ...p.sections, whatsNew: { ...p.sections.whatsNew, items: next } },
                      }));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border text-[11px] font-bold"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* الأسئلة الشائعة */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#EA580C]" />
                <span>الأسئلة الشائعة (FAQ)</span>
              </h3>
              <button
                type="button"
                onClick={() =>
                  setCms((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      faq: {
                        ...p.sections.faq,
                        items: [
                          ...p.sections.faq.items,
                          { id: 'fq_' + Date.now(), q: 'سؤال جديد؟', a: 'الإجابة الواضحة هنا...' },
                        ],
                      },
                    },
                  }))
                }
                className="px-3 py-1.5 rounded-xl bg-[#EA580C] text-white text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة سؤال</span>
              </button>
            </div>
            <div className="space-y-2.5">
              {cms.sections.faq.items.map((fq, idx) => (
                <div
                  key={fq.id}
                  className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={fq.q}
                      onChange={(e) => {
                        const next = [...cms.sections.faq.items];
                        next[idx] = { ...next[idx], q: e.target.value };
                        setCms((p) => ({
                          ...p,
                          sections: { ...p.sections, faq: { ...p.sections.faq, items: next } },
                        }));
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border text-xs font-black"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = cms.sections.faq.items.filter((_, i) => i !== idx);
                        setCms((p) => ({
                          ...p,
                          sections: { ...p.sections, faq: { ...p.sections.faq, items: next } },
                        }));
                      }}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={fq.a}
                    onChange={(e) => {
                      const next = [...cms.sections.faq.items];
                      next[idx] = { ...next[idx], a: e.target.value };
                      setCms((p) => ({
                        ...p,
                        sections: { ...p.sections, faq: { ...p.sections.faq, items: next } },
                      }));
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border text-xs font-bold"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* التبويب 5: بوابة الترحيب والبانر الختامي والتذييل */}
      {activeTab === 'footer_gate' && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
            <h3 className="text-sm sm:text-base font-black">بوابة الترحيب التفاعلية (Welcome Gate)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={cms.welcomeGate.headlineLine1}
                onChange={(e) =>
                  setCms((p) => ({ ...p, welcomeGate: { ...p.welcomeGate, headlineLine1: e.target.value } }))
                }
                placeholder="السطر الأول"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border text-xs font-bold"
              />
              <input
                type="text"
                value={cms.welcomeGate.headlineHighlight}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    welcomeGate: { ...p.welcomeGate, headlineHighlight: e.target.value },
                  }))
                }
                placeholder="السطر الملوّن"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border text-xs font-bold"
              />
              <input
                type="text"
                value={cms.welcomeGate.ctaText}
                onChange={(e) =>
                  setCms((p) => ({ ...p, welcomeGate: { ...p.welcomeGate, ctaText: e.target.value } }))
                }
                placeholder="نص زر الدخول لبوابة الترحيب"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border text-xs font-bold"
              />
              <input
                type="text"
                value={cms.welcomeGate.anthemHintText}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    welcomeGate: { ...p.welcomeGate, anthemHintText: e.target.value },
                  }))
                }
                placeholder="ملاحظة النشيد"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border text-xs font-bold"
              />
            </div>
            <textarea
              rows={2}
              value={cms.welcomeGate.description}
              onChange={(e) =>
                setCms((p) => ({ ...p, welcomeGate: { ...p.welcomeGate, description: e.target.value } }))
              }
              className="w-full px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border text-xs font-bold"
            />
          </div>

          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
            <h3 className="text-sm sm:text-base font-black">البانر الختامي والتذييل</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={cms.sections.finalCta.title}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: { ...p.sections, finalCta: { ...p.sections.finalCta, title: e.target.value } },
                  }))
                }
                placeholder="عنوان البانر الختامي"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border text-xs font-bold"
              />
              <input
                type="text"
                value={cms.sections.finalCta.ctaText}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: { ...p.sections, finalCta: { ...p.sections.finalCta, ctaText: e.target.value } },
                  }))
                }
                placeholder="نص زر البانر الختامي"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border text-xs font-bold"
              />
              <input
                type="text"
                value={cms.sections.footer.brandTitle}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: { ...p.sections, footer: { ...p.sections.footer, brandTitle: e.target.value } },
                  }))
                }
                placeholder="اسم المنظومة بالتذييل"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border text-xs font-bold"
              />
              <input
                type="text"
                value={cms.sections.footer.copyrightText}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: { ...p.sections, footer: { ...p.sections.footer, copyrightText: e.target.value } },
                  }))
                }
                placeholder="سطر حقوق النشر"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border text-xs font-bold"
              />
            </div>
          </div>
        </div>
      )}

      {/* نافذة تغيير أيقونات وشعارات المنظومة السريعة (نهاري / ليلي) */}
      {showAssetsModal && (
        <div className="fixed inset-0 z-50 bg-[#060B18]/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#EFE9DC] dark:bg-[#081024] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  تخصيص شعار المنظومة وأيقونات شموسة وصقر (نهاري / ليلي)
                </h3>
                <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                  شاهد الشكل الحالي لكل أيقونة في الوضعين، واختر الصورة الجديدة من هاتفك ليتم تفريغها وحفظها بخلفيتها الشفافة.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssetsModal(false)}
                className="p-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {renderBrandAssetsGrid()}

            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[#D4CCBC] dark:border-[#22355E]">
              <button
                type="button"
                onClick={() => setShowAssetsModal(false)}
                className="px-4 py-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  await handlePersist();
                  setShowAssetsModal(false);
                }}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>تم الحفظ واعتماد الشعارات والأيقونات</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
