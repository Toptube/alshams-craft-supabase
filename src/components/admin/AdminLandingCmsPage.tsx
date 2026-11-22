import React, { useState, useRef, useEffect } from 'react';
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
  Code2,
  Monitor,
  Tablet,
  Smartphone,
  FileCode2,
  Palette,
  History,
  CheckCircle2,
  Layers,
  Copy,
} from 'lucide-react';
import {
  LandingCmsConfig,
  LandingAccentTheme,
  LandingLayoutPreset,
  DEFAULT_BRAND_ASSETS,
  DEFAULT_DESIGN_CONFIG,
  DEFAULT_LANDING_CMS_CONFIG,
  DEFAULT_LANDING_MEDIA,
  getStoredLandingCmsConfig,
  saveStoredLandingCmsConfig,
} from '../../types/landingCms';
import {
  LANDING_TEMPLATE_TOKENS,
  STARTER_INJECTED_TEMPLATES,
  LandingTokenInfo,
} from '../../utils/landingTemplateHydrator';
import { LandingPage } from '../landing/LandingPage';
import { LANDING_THEMES_LIST } from '../../lib/landingThemes';
import { syncPlatformSettingsFromCloud } from '../../services/marketplaceCartService';
import { processBrandAssetUpload } from '../../utils/imageTransparentProcessor';
import { playSuccessSound, playErrorSound } from '../../lib/sounds';
import { archiveReplacedImage } from '../../services/imageRollbackService';
import { ImageRollbackBar } from '../common/ImageRollbackBar';

export type CmsSectionTab =
  | 'design_injector'
  | 'header_hero'
  | 'brand_assets'
  | 'core_sections'
  | 'social_faq'
  | 'footer_gate';

interface AdminLandingCmsPageProps {
  onBack: () => void;
  onSaveToCloud: (cms: LandingCmsConfig) => Promise<void>;
  saving?: boolean;
  initialTab?: CmsSectionTab;
}

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
    recommendedMaxDim: 360,
    defaultSvgWrap: false,
  },
  {
    key: 'brandIcon',
    title: 'أيقونة المنظومة / الشعار المربع',
    subtitle: 'الأيقونة المربعة بجانب اسم المنظومة وفي التذييل وصفحات الدخول',
    recommendedMaxDim: 160,
    defaultSvgWrap: true,
  },
  {
    key: 'falconMascot',
    title: 'أيقونة وشخصية صقر الشمساوية AI',
    subtitle: 'شخصية صقر في صفحة الهبوط وبوابة الترحيب والمساعد الذكي',
    recommendedMaxDim: 300,
    defaultSvgWrap: false,
  },
  {
    key: 'shamousaMascot',
    title: 'أيقونة وشخصية شموسة',
    subtitle: 'شخصية شموسة في صفحة الهبوط وبوابة الترحيب وزر المساعدة العائم',
    recommendedMaxDim: 300,
    defaultSvgWrap: false,
  },
];

const LAYOUT_PRESETS: {
  id: LandingLayoutPreset;
  name: string;
  desc: string;
  swatches?: [string, string, string];
  isDark?: boolean;
}[] = [
  ...LANDING_THEMES_LIST.map((t) => ({
    id: t.id as LandingLayoutPreset,
    name: t.nameAr,
    desc: t.taglineAr,
    swatches: t.swatchColors,
    isDark: t.isDarkTheme,
  })),
  {
    id: 'custom_injected',
    name: 'تصميم محقون مخصص (HTML / CSS)',
    desc: 'عرض التصميم المحقون أدناه مع استيراد تلقائي فوري لكل بيانات الصفحة الحالية.',
  },
];

const ACCENT_THEMES: {
  id: LandingAccentTheme;
  name: string;
  swatch: string;
}[] = [
  { id: 'solar_orange', name: 'البرتقالي الشمسي (الهوية)', swatch: '#EA580C' },
  { id: 'emerald_craft', name: 'الزمردي الحرفي', swatch: '#047857' },
  { id: 'royal_indigo', name: 'النيلي الملكي', swatch: '#4338CA' },
  { id: 'crimson_clay', name: 'الطمي القرمزي', swatch: '#9F1239' },
];

export const AdminLandingCmsPage: React.FC<AdminLandingCmsPageProps> = ({
  onBack,
  onSaveToCloud,
  saving = false,
  initialTab = 'header_hero',
}) => {
  const [cms, setCms] = useState<LandingCmsConfig>(() => getStoredLandingCmsConfig());
  const [activeTab, setActiveTab] = useState<CmsSectionTab>(initialTab);
  const [showAssetsModal, setShowAssetsModal] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewDarkMode, setPreviewDarkMode] = useState<boolean>(false);
  const [tokenCategory, setTokenCategory] = useState<LandingTokenInfo['category']>('hero');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const hasDirtyChangesRef = useRef<boolean>(false);
  const [saveBanner, setSaveBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const htmlEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const htmlFileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // خيارات معالجة الصورة عند الرفع
  const [autoRemoveBg, setAutoRemoveBg] = useState<boolean>(true);
  const [convertToCompactSvg, setConvertToCompactSvg] = useState<boolean>(false);
  const [processingSlot, setProcessingSlot] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    syncPlatformSettingsFromCloud()
      .then(() => {
        if (!hasDirtyChangesRef.current) {
          setCms(getStoredLandingCmsConfig());
        }
      })
      .catch(() => {});
  }, []);

  const design = cms.designConfig || {
    ...DEFAULT_DESIGN_CONFIG,
    injectedTemplate: { ...DEFAULT_DESIGN_CONFIG.injectedTemplate },
  };

  const updateDesign = (updater: (prev: NonNullable<LandingCmsConfig['designConfig']>) => NonNullable<LandingCmsConfig['designConfig']>) => {
    hasDirtyChangesRef.current = true;
    setCms((prev) => {
      const currentDesign = prev.designConfig || {
        ...DEFAULT_DESIGN_CONFIG,
        injectedTemplate: { ...DEFAULT_DESIGN_CONFIG.injectedTemplate },
      };
      return {
        ...prev,
        designConfig: updater(currentDesign),
      };
    });
  };

  const handlePersist = async (targetCms: LandingCmsConfig = cms, recordInjectedSnapshot = false) => {
    setSaveBanner(null);
    let preparedCms = { ...targetCms };

    // حفظ نسخة أرشيفية تلقائية عند نشر تصميم محقون مخصص لسهولة التراجع بضغطة واحدة
    if (
      recordInjectedSnapshot &&
      preparedCms.designConfig?.activePreset === 'custom_injected' &&
      preparedCms.designConfig.injectedTemplate.html.trim()
    ) {
      const tpl = preparedCms.designConfig.injectedTemplate;
      const existingHistory = tpl.history || [];
      const alreadySame =
        existingHistory[0] &&
        existingHistory[0].html === tpl.html &&
        existingHistory[0].css === tpl.css;
      if (!alreadySame) {
        const snapshot = {
          id: 'snap_' + Date.now(),
          name: tpl.name?.trim() || 'نسخة تصميم محقون',
          html: tpl.html,
          css: tpl.css,
          savedAt: new Date().toISOString(),
        };
        preparedCms = {
          ...preparedCms,
          designConfig: {
            ...preparedCms.designConfig,
            injectedTemplate: {
              ...tpl,
              updatedAt: snapshot.savedAt,
              history: [snapshot, ...existingHistory].slice(0, 5),
            },
          },
        };
      }
    }

    const saved = saveStoredLandingCmsConfig({
      ...preparedCms,
      updatedAt: new Date().toISOString(),
    });
    setCms(saved);
    try {
      await onSaveToCloud(saved);
      hasDirtyChangesRef.current = false;
      setSaveBanner({
        type: 'success',
        text: 'تم الحفظ ونشر تعديلات وتصميم صفحة الهبوط سحابياً للجمهور بنجاح ✅',
      });
      playSuccessSound();
    } catch (err: any) {
      playErrorSound();
      setSaveBanner({
        type: 'error',
        text: err?.message || 'تعذر رفع التعديلات سحابياً، يرجى المحاولة مرة أخرى.',
      });
    }
  };

  const handleUploadHtmlFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      if (!raw.trim()) return;
      // استخراج كود <style> إن وجد ووضعه في حقل CSS مع إبقاء الهيكل في HTML
      const styleMatches = Array.from(raw.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi));
      const extractedCss = styleMatches.map((m) => m[1].trim()).filter(Boolean).join('\n\n');
      const cleanedHtml = raw.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
      const baseName = file.name.replace(/\.html?$/i, '') || 'تصميم HTML مرفوع';

      updateDesign((d) => ({
        ...d,
        activePreset: 'custom_injected',
        injectedTemplate: {
          ...d.injectedTemplate,
          enabled: true,
          name: baseName,
          html: cleanedHtml || raw,
          css: extractedCss || d.injectedTemplate.css,
          autoHydrate: true,
        },
      }));
      setSaveBanner({
        type: 'success',
        text: `تم استيراد ملف «${file.name}» بنجاح. اضغط «معاينة حية قبل النشر» للتأكد ثم انشر للجمهور.`,
      });
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleInsertToken = (token: string) => {
    const el = htmlEditorRef.current;
    updateDesign((d) => {
      const current = d.injectedTemplate.html || '';
      if (el && typeof el.selectionStart === 'number') {
        const start = el.selectionStart;
        const end = el.selectionEnd ?? start;
        const next = current.slice(0, start) + token + current.slice(end);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + token.length, start + token.length);
        }, 0);
        return {
          ...d,
          injectedTemplate: { ...d.injectedTemplate, html: next },
        };
      }
      return {
        ...d,
        injectedTemplate: { ...d.injectedTemplate, html: current + (current ? '\n' : '') + token },
      };
    });
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 1500);
  };

  const handleMediaImageUpload = (slot: 'heroImageUrl' | 'materialsImageUrl' | 'supplierImageUrl', file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1280;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          updateDesign((d) => ({ ...d, [slot]: dataUrl }));
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
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
      hasDirtyChangesRef.current = true;
      setCms((prev) => {
        const prevUrl = prev.brandAssets[slot][themeVariant];
        archiveReplacedImage(
          `cms_asset_${slot}_${themeVariant}`,
          `${meta.title} (${themeVariant === 'dark' ? 'ليلي' : 'نهاري'})`,
          prevUrl,
          processed.dataUrl
        );
        return {
          ...prev,
          brandAssets: {
            ...prev.brandAssets,
            [slot]: {
              ...prev.brandAssets[slot],
              [themeVariant]: processed.dataUrl,
            },
          },
        };
      });
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
    hasDirtyChangesRef.current = true;
    setCms((prev) => {
      const prevUrl = prev.brandAssets[slot][themeVariant];
      const defUrl = DEFAULT_BRAND_ASSETS[slot][themeVariant];
      archiveReplacedImage(`cms_asset_${slot}_${themeVariant}`, `${slot} (${themeVariant})`, prevUrl, defUrl);
      return {
        ...prev,
        brandAssets: {
          ...prev.brandAssets,
          [slot]: {
            ...prev.brandAssets[slot],
            [themeVariant]: defUrl,
          },
        },
      };
    });
    setUploadNotice((prev) => ({
      ...prev,
      [noticeKey]: 'تمت استعادة الشكل الافتراضي',
    }));
  };

  const handleResetAllTexts = async () => {
    const next: LandingCmsConfig = {
      ...DEFAULT_LANDING_CMS_CONFIG,
      brandAssets: cms.brandAssets,
      designConfig: cms.designConfig,
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

                      <div
                        className={`h-28 rounded-xl border flex items-center justify-center p-2 overflow-hidden relative ${
                          isDarkTile ? 'bg-[#081024] border-[#22355E]' : 'bg-white border-stone-200'
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
                          if (file) handleAssetUpload(meta.key, variant, file, meta);
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

                      <ImageRollbackBar
                        slotKey={`cms_asset_${meta.key}_${variant}`}
                        compact
                        onRestored={(oldUrl) => {
                          hasDirtyChangesRef.current = true;
                          setCms((prev) => ({
                            ...prev,
                            brandAssets: {
                              ...prev.brandAssets,
                              [meta.key]: {
                                ...prev.brandAssets[meta.key],
                                [variant]: oldUrl,
                              },
                            },
                          }));
                        }}
                      />
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

  const unifiedSec = cms.sections.unifiedEngine || DEFAULT_LANDING_CMS_CONFIG.sections.unifiedEngine!;
  const familySec = cms.sections.familyProfile || DEFAULT_LANDING_CMS_CONFIG.sections.familyProfile!;
  const heroMetrics =
    cms.hero.metrics && cms.hero.metrics.length > 0
      ? cms.hero.metrics
      : DEFAULT_LANDING_CMS_CONFIG.hero.metrics!;

  const filteredTokens = LANDING_TEMPLATE_TOKENS.filter((t) => t.category === tokenCategory);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-4 pb-12 space-y-5" dir="rtl">
      {/* شريط العنوان والإجراءات السريعة */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>رجوع</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              aria-label="إغلاق"
              title="إغلاق"
              className="w-8 h-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 hover:text-rose-600 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h1 className="text-base sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA]">
              لوحة تحكم صفحة الهبوط وحقن التصميمات
            </h1>
          </div>
          <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
            تحكم كامل في النصوص والشعارات والقوالب المعمارية، أو احقن تصميم HTML/CSS جديد يستورد بيانات الصفحة الحالية تلقائياً مع معاينة حية قبل النشر للجمهور.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('design_injector')}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer border transition ${
              activeTab === 'design_injector'
                ? 'bg-[#EA580C] text-white border-transparent'
                : 'bg-[#0C1427] hover:bg-[#1E293B] text-[#FBBF24] border-[#22355E]'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>حقن تصميم جديد</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Eye className="w-4 h-4" />
            <span>معاينة حية قبل النشر</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAssetsModal(true)}
            className="px-3 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <ImageIcon className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>الشعارات</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handlePersist(cms, true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white text-xs font-black flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>حفظ ونشر للجمهور</span>
          </button>
        </div>
      </div>

      {/* تنبيه نتيجة الحفظ */}
      {saveBanner && (
        <div
          className={`rounded-2xl p-3.5 text-xs font-black border flex items-center justify-between gap-2 ${
            saveBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/50 border-rose-400 text-rose-800 dark:text-rose-200'
          }`}
        >
          <span>{saveBanner.text}</span>
          <button
            type="button"
            onClick={() => setSaveBanner(null)}
            className="p-1 rounded-lg hover:bg-black/10 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* شريط التبويبات */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
        {[
          { id: 'design_injector' as const, label: 'حقن تصميم وقوالب + معاينة', icon: <Code2 className="w-3.5 h-3.5" /> },
          { id: 'header_hero' as const, label: 'الشريط العلوي والهيرو والأرقام', icon: <Sparkles className="w-3.5 h-3.5" /> },
          { id: 'brand_assets' as const, label: 'شعارات شموسة وصقر', icon: <ImageIcon className="w-3.5 h-3.5" /> },
          { id: 'core_sections' as const, label: 'الأقسام والمميزات والأزرار', icon: <Layout className="w-3.5 h-3.5" /> },
          { id: 'social_faq' as const, label: 'الشهادات والجديد والأسئلة', icon: <MessageSquareQuote className="w-3.5 h-3.5" /> },
          { id: 'footer_gate' as const, label: 'بوابة الترحيب والتذييل', icon: <DoorOpen className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[135px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
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

      {/* ==================== التبويب الجديد: استوديو حقن التصميمات والقوالب ==================== */}
      {activeTab === 'design_injector' && (
        <div className="space-y-5">
          {/* 1. القوالب المعمارية الجاهزة + الألوان */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span>1. اختيار نمط القالب المعماري ولوحة الألوان</span>
                </h2>
                <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
                  اختر من بين {LANDING_THEMES_LIST.length} سمات عالمية معمارية لصفحة الهبوط (تغيّر التصميم والهوية بالكامل بضغطة زر دون الحاجة لتغيير المحتوى) أو فعّل «تصميم محقون مخصص» أدناه.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black inline-flex items-center gap-1.5 self-start cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>معاينة النمط المختار</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {LAYOUT_PRESETS.map((preset) => {
                const isSelected = design.activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      updateDesign((d) => ({
                        ...d,
                        activePreset: preset.id,
                        injectedTemplate: {
                          ...d.injectedTemplate,
                          enabled: preset.id === 'custom_injected' ? true : false,
                        },
                      }))
                    }
                    className={`p-3.5 rounded-xl border text-right space-y-2 transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#EA580C]/10 dark:bg-[#FBBF24]/15 border-[#EA580C] dark:border-[#FBBF24] ring-1 ring-[#EA580C]/30'
                        : 'bg-[#EFE9DC]/70 dark:bg-[#132040]/70 border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                    }`}
                  >
                    <div className="space-y-1.5">
                      {preset.swatches && (
                        <div className="flex items-center justify-between gap-2 pb-1">
                          <div className="flex items-center gap-1">
                            {preset.swatches.map((hex, i) => (
                              <span
                                key={i}
                                className="w-5 h-3.5 rounded border border-black/15"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                            {preset.isDark ? 'طابع ليلي' : 'طابع نهاري'}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black">{preset.name}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />}
                      </div>
                      <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                        {preset.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* اختيار اللون الرئيسي */}
            <div className="pt-3 border-t border-[#D4CCBC] dark:border-[#22355E] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs font-black">اللون الأساسي للأزرار والعناوين المميزة:</span>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_THEMES.map((th) => {
                  const selected = design.accentTheme === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => updateDesign((d) => ({ ...d, accentTheme: th.id }))}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-black inline-flex items-center gap-2 cursor-pointer transition ${
                        selected
                          ? 'border-[#0C1427] dark:border-white bg-white dark:bg-[#132040]'
                          : 'border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: th.swatch }} />
                      <span>{th.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. استوديو حقن تصميم HTML / CSS جديد مع استيراد مباشر تلقائي لكل البيانات */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#EA580C]/40 dark:border-[#FBBF24]/40 p-4 sm:p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm sm:text-lg font-black flex items-center gap-2 text-[#0C1427] dark:text-[#F7F3EA]">
                  <FileCode2 className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span>2. محرك حقن تصميم جديد لصفحة الهبوط (استيراد تلقائي كامل للبيانات)</span>
                </h2>
                <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                  الصق كود HTML/CSS لأي تصميم جديد أو ارفع ملف <code className="font-mono">.html</code> من جهازك — وسيتولى المحرك تلقائياً استيراد شعاراتك ونصوص الهيرو والأرقام والورش والموردين والشهادات والأسئلة الشائعة وربط أزرار التسجيل والدخول دون إعادة كتابة حرف واحد.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <input
                  ref={htmlFileInputRef}
                  type="file"
                  accept=".html,.htm,text/html"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadHtmlFile(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => htmlFileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#FBBF24]" />
                  <span>رفع ملف .html من الجهاز</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateDesign((d) => ({
                      ...d,
                      activePreset: 'editorial_craft',
                      injectedTemplate: { ...d.injectedTemplate, enabled: false },
                    }))
                  }
                  className="px-3.5 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>العودة للتصميم القياسي</span>
                </button>
              </div>
            </div>

            {/* قوالب مرجعية جاهزة للحقن الفوري بضغطة واحدة */}
            <div className="rounded-xl bg-[#EFE9DC]/80 dark:bg-[#132040]/80 border border-[#D4CCBC] dark:border-[#22355E] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black">قوالب حقن جاهزة ومربوطة ببياناتك الحالية (اضغط لتحميلها وتجربتها فوراً):</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {STARTER_INJECTED_TEMPLATES.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3 flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      <h4 className="text-xs font-black">{tpl.name}</h4>
                      <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] mt-0.5 leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        updateDesign((d) => ({
                          ...d,
                          activePreset: 'custom_injected',
                          injectedTemplate: {
                            ...d.injectedTemplate,
                            enabled: true,
                            name: tpl.name,
                            html: tpl.html,
                            css: tpl.css,
                            autoHydrate: true,
                          },
                        }));
                        setSaveBanner({
                          type: 'success',
                          text: `تم تحميل «${tpl.name}» وربطه ببيانات صفحتك الحالية تلقائياً. افتح «معاينة حية قبل النشر» للمراجعة.`,
                        });
                      }}
                      className="w-full py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black cursor-pointer"
                    >
                      تحميل هذا القالب في المحرر + ربط بياناتي تلقائياً
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* إعدادات اسم القالب وتفعيل الحقن والاستيراد التلقائي */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              <div>
                <label className="block text-xs font-bold mb-1">اسم التصميم المحقون</label>
                <input
                  type="text"
                  value={design.injectedTemplate.name}
                  onChange={(e) =>
                    updateDesign((d) => ({
                      ...d,
                      injectedTemplate: { ...d.injectedTemplate, name: e.target.value },
                    }))
                  }
                  placeholder="مثال: تصميم رمضان 2026"
                  className="w-full px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={design.injectedTemplate.autoHydrate !== false}
                  onChange={(e) =>
                    updateDesign((d) => ({
                      ...d,
                      injectedTemplate: { ...d.injectedTemplate, autoHydrate: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-[#EA580C]"
                />
                <span className="text-xs font-black">استيراد مباشر تلقائي لكل بيانات الصفحة الحالية</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={design.activePreset === 'custom_injected' && design.injectedTemplate.enabled}
                  onChange={(e) =>
                    updateDesign((d) => ({
                      ...d,
                      activePreset: e.target.checked ? 'custom_injected' : 'editorial_craft',
                      injectedTemplate: { ...d.injectedTemplate, enabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="text-xs font-black">تفعيل التصميم المحقون عند النشر للجمهور</span>
              </label>
            </div>

            {/* شريط الرموز الذكية للاستيراد المباشر (Clickable Auto-Hydrate Tokens) */}
            <div className="rounded-xl border border-[#D4CCBC] dark:border-[#22355E] p-3.5 space-y-3 bg-[#EFE9DC]/50 dark:bg-[#132040]/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span>رموز الاستيراد المباشر للبيانات (اضغط أي رمز لإدراجه في كود HTML فوراً):</span>
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { id: 'brand', label: 'الشعارات والصور' },
                      { id: 'hero', label: 'الهيرو والأزرار' },
                      { id: 'sections', label: 'نصوص الأقسام' },
                      { id: 'lists', label: 'القوائم التلقائية' },
                      { id: 'actions', label: 'ربط الأزرار' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setTokenCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition ${
                        tokenCategory === cat.id
                          ? 'bg-[#EA580C] text-white'
                          : 'bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {filteredTokens.map((tk) => (
                  <button
                    key={tk.token}
                    type="button"
                    onClick={() => handleInsertToken(tk.token)}
                    title={`إدراج ${tk.token}`}
                    className="px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3 h-3 text-[#EA580C] dark:text-[#FBBF24]" />
                    <span>{tk.label}</span>
                    <code dir="ltr" className="text-[10px] font-mono text-[#475569] dark:text-[#94A3B8]">
                      {copiedToken === tk.token ? 'تم الإدراج ✓' : tk.token}
                    </code>
                  </button>
                ))}
              </div>
            </div>

            {/* محررا HTML و CSS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black">كود هيكل الصفحة (HTML)</label>
                  <span className="text-[10px] font-mono text-[#475569] dark:text-[#94A3B8]">
                    {design.injectedTemplate.html.length.toLocaleString()} حرف
                  </span>
                </div>
                <textarea
                  ref={htmlEditorRef}
                  rows={14}
                  dir="ltr"
                  value={design.injectedTemplate.html}
                  onChange={(e) =>
                    updateDesign((d) => ({
                      ...d,
                      activePreset: 'custom_injected',
                      injectedTemplate: {
                        ...d.injectedTemplate,
                        enabled: true,
                        html: e.target.value,
                      },
                    }))
                  }
                  placeholder="<!-- الصق كود HTML للتصميم الجديد هنا أو اختر أحد القوالب الجاهزة أعلاه -->"
                  className="w-full p-3.5 rounded-xl bg-[#0B1224] text-[#E2E8F0] border border-[#22355E] font-mono text-xs leading-relaxed outline-none focus:border-[#FBBF24]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black">كود التنسيقات والألوان (CSS)</label>
                  <span className="text-[10px] font-mono text-[#475569] dark:text-[#94A3B8]">
                    {design.injectedTemplate.css.length.toLocaleString()} حرف
                  </span>
                </div>
                <textarea
                  rows={14}
                  dir="ltr"
                  value={design.injectedTemplate.css}
                  onChange={(e) =>
                    updateDesign((d) => ({
                      ...d,
                      injectedTemplate: {
                        ...d.injectedTemplate,
                        css: e.target.value,
                      },
                    }))
                  }
                  placeholder="/* الصق كود CSS الخاص بالتصميم الجديد هنا (اختياري إذا كان مدمجاً) */"
                  className="w-full p-3.5 rounded-xl bg-[#0B1224] text-[#CBD5E1] border border-[#22355E] font-mono text-xs leading-relaxed outline-none focus:border-[#FBBF24]"
                />
              </div>
            </div>

            {/* أزرار المعاينة والحفظ والنشر */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#D4CCBC] dark:border-[#22355E]">
              <p className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                ملاحظة أمان: التعديلات هنا لا يراها الجمهور إلا بعد الضغط على «حفظ ونشر للجمهور»، ويمكنك معاينتها بالكامل قبل الاعتماد.
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Eye className="w-4 h-4" />
                  <span>معاينة التصميم قبل الحفظ والنشر</span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handlePersist(cms, true)}
                  className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>اعتماد وحفظ ونشر للجمهور</span>
                </button>
              </div>
            </div>

            {/* سجل النسخ المحفوظة للتراجع الفوري */}
            {(design.injectedTemplate.history || []).length > 0 && (
              <div className="pt-4 border-t border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
                <h3 className="text-xs font-black flex items-center gap-1.5">
                  <History className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span>سجل التصميمات المحقونة السابقة (استعادة بضغطة واحدة):</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {(design.injectedTemplate.history || []).map((snap) => (
                    <div
                      key={snap.id}
                      className="rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate">{snap.name}</div>
                        <div className="text-[10px] font-mono text-[#475569] dark:text-[#94A3B8]">
                          {new Date(snap.savedAt).toLocaleString('ar-EG')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          updateDesign((d) => ({
                            ...d,
                            activePreset: 'custom_injected',
                            injectedTemplate: {
                              ...d.injectedTemplate,
                              enabled: true,
                              name: snap.name,
                              html: snap.html,
                              css: snap.css,
                            },
                          }));
                          setShowPreviewModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#0C1427] text-white text-[11px] font-black shrink-0 cursor-pointer"
                      >
                        استعادة ومعاينة
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. صور صفحة الهبوط التحريرية (الهيرو / الخامات / الموردين) */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-4">
            <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>3. الصور التحريرية لصفحة الهبوط (تُستورد تلقائياً في القوالب المحقونة أيضاً)</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [
                  {
                    key: 'heroImageUrl' as const,
                    label: 'صورة الواجهة الرئيسية (Hero)',
                    def: DEFAULT_LANDING_MEDIA.heroImageUrl,
                  },
                  {
                    key: 'materialsImageUrl' as const,
                    label: 'صورة منظومة الخامات الموحدة',
                    def: DEFAULT_LANDING_MEDIA.materialsImageUrl,
                  },
                  {
                    key: 'supplierImageUrl' as const,
                    label: 'صورة معرض الموردين B2B',
                    def: DEFAULT_LANDING_MEDIA.supplierImageUrl,
                  },
                ]
              ).map((slot) => (
                <div
                  key={slot.key}
                  className="rounded-xl border border-[#D4CCBC] dark:border-[#22355E] p-3 space-y-2.5 bg-[#EFE9DC]/60 dark:bg-[#132040]/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black">{slot.label}</span>
                    <button
                      type="button"
                      onClick={() => updateDesign((d) => ({ ...d, [slot.key]: slot.def }))}
                      className="text-[10px] font-bold text-[#475569] hover:text-[#EA580C] cursor-pointer"
                    >
                      افتراضي
                    </button>
                  </div>
                  <div className="h-32 rounded-lg overflow-hidden bg-[#0C1427] border border-[#D4CCBC] dark:border-[#22355E]">
                    <img
                      src={design[slot.key] || slot.def}
                      alt={slot.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <input
                    ref={(el) => {
                      mediaInputRefs.current[slot.key] = el;
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleMediaImageUpload(slot.key, f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => mediaInputRefs.current[slot.key]?.click()}
                    className="w-full py-2 rounded-lg bg-[#0C1427] hover:bg-[#1E293B] text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>تغيير الصورة من الجهاز</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

      {/* التبويب 2: الشريط العلوي والهيرو ومؤشرات الأرقام */}
      {activeTab === 'header_hero' && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                1. الشريط العلوي وزر الدخول
              </h2>
              <button
                type="button"
                onClick={handleResetAllTexts}
                className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold hover:border-rose-500 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة نصوص V 5.0 الافتراضية</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">نص زر الشريط العلوي الرئيسي</label>
                <input
                  type="text"
                  value={cms.header.ctaButtonText}
                  onChange={(e) => {
                    hasDirtyChangesRef.current = true;
                    setCms((p) => ({ ...p, header: { ...p.header, ctaButtonText: e.target.value } }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">نص زر بوابة الترحيب</label>
                <input
                  type="text"
                  value={cms.header.welcomeGateButtonText}
                  onChange={(e) => {
                    hasDirtyChangesRef.current = true;
                    setCms((p) => ({
                      ...p,
                      header: { ...p.header, welcomeGateButtonText: e.target.value },
                    }));
                  }}
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
                      hasDirtyChangesRef.current = true;
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

          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-4">
            <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
              2. الواجهة الرئيسية (Hero Section) ومؤشرات الأرقام
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">السطر الأول من العنوان الرئيسي</label>
                <input
                  type="text"
                  value={cms.hero.headlineLine1}
                  onChange={(e) => {
                    hasDirtyChangesRef.current = true;
                    setCms((p) => ({ ...p, hero: { ...p.hero, headlineLine1: e.target.value } }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">السطر الثاني الملوّن من العنوان الرئيسي</label>
                <input
                  type="text"
                  value={cms.hero.headlineHighlight}
                  onChange={(e) => {
                    hasDirtyChangesRef.current = true;
                    setCms((p) => ({ ...p, hero: { ...p.hero, headlineHighlight: e.target.value } }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">الوصف التسويقي أسفل العنوان</label>
              <textarea
                rows={3}
                value={cms.hero.description}
                onChange={(e) => {
                  hasDirtyChangesRef.current = true;
                  setCms((p) => ({ ...p, hero: { ...p.hero, description: e.target.value } }));
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">نص الزر الأساسي (الفنان)</label>
                <input
                  type="text"
                  value={cms.hero.primaryCtaText}
                  onChange={(e) => {
                    hasDirtyChangesRef.current = true;
                    setCms((p) => ({ ...p, hero: { ...p.hero, primaryCtaText: e.target.value } }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">نص الزر الثانوي (المورد B2B)</label>
                <input
                  type="text"
                  value={cms.hero.secondaryCtaText}
                  onChange={(e) => {
                    hasDirtyChangesRef.current = true;
                    setCms((p) => ({ ...p, hero: { ...p.hero, secondaryCtaText: e.target.value } }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">العنوان التمهيدي العلوي</label>
                <input
                  type="text"
                  value={cms.hero.falconBadgeText}
                  onChange={(e) => {
                    hasDirtyChangesRef.current = true;
                    setCms((p) => ({ ...p, hero: { ...p.hero, falconBadgeText: e.target.value } }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
            </div>

            {/* شريط المؤشرات الأربع */}
            <div className="pt-3 border-t border-[#D4CCBC] dark:border-[#22355E] space-y-2">
              <label className="block text-xs font-black">مؤشرات الأرقام الأربعة أسفل الهيرو:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {heroMetrics.map((m, idx) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5"
                  >
                    <input
                      type="text"
                      value={m.value}
                      onChange={(e) => {
                        hasDirtyChangesRef.current = true;
                        const next = [...heroMetrics];
                        next[idx] = { ...next[idx], value: e.target.value };
                        setCms((p) => ({ ...p, hero: { ...p.hero, metrics: next } }));
                      }}
                      placeholder="الرقم (مثل +395)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border text-xs font-black font-mono"
                    />
                    <input
                      type="text"
                      value={m.label}
                      onChange={(e) => {
                        hasDirtyChangesRef.current = true;
                        const next = [...heroMetrics];
                        next[idx] = { ...next[idx], label: e.target.value };
                        setCms((p) => ({ ...p, hero: { ...p.hero, metrics: next } }));
                      }}
                      placeholder="العنوان"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={m.detail}
                      onChange={(e) => {
                        hasDirtyChangesRef.current = true;
                        const next = [...heroMetrics];
                        next[idx] = { ...next[idx], detail: e.target.value };
                        setCms((p) => ({ ...p, hero: { ...p.hero, metrics: next } }));
                      }}
                      placeholder="التفصيل المختصر"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border text-[11px]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* التبويب 3: الأقسام والمميزات ونصوص أزرارها */}
      {activeTab === 'core_sections' && (
        <div className="space-y-4">
          {/* قسم منظومة الخامات والورش الـ 14 */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">قسم 01: منظومة الخامات الموحدة والورش الـ 14 (ث1–ث6)</h3>
              <button
                type="button"
                onClick={() =>
                  setCms((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      unifiedEngine: { ...unifiedSec, visible: !unifiedSec.visible },
                    },
                  }))
                }
                className="px-3 py-1 rounded-xl border text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                {unifiedSec.visible ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-rose-600" />}
                <span>{unifiedSec.visible ? 'ظاهر' : 'مخفي'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={unifiedSec.title}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: { ...p.sections, unifiedEngine: { ...unifiedSec, title: e.target.value } },
                  }))
                }
                placeholder="عنوان القسم"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <input
                type="text"
                value={unifiedSec.ctaText}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: { ...p.sections, unifiedEngine: { ...unifiedSec, ctaText: e.target.value } },
                  }))
                }
                placeholder="نص الزر"
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>
            <textarea
              rows={2}
              value={unifiedSec.subtitle}
              onChange={(e) =>
                setCms((p) => ({
                  ...p,
                  sections: { ...p.sections, unifiedEngine: { ...unifiedSec, subtitle: e.target.value } },
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
          </div>

          {/* قسم المالية والسيولة */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">قسم 02: المالية وبطاقة «هلخصهالك»</h3>
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
              <h3 className="text-sm font-black">قسم 03: صقر وشموسة AI</h3>
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

          {/* بقية الأقسام القابلة للتعديل */}
          {(
            [
              { key: 'crmClients', label: 'قسم: إدارة العملاء (CRM الحرفي)' },
              { key: 'smartCatalog', label: 'قسم: الكتالوج وعروض الأسعار' },
              { key: 'craftStore', label: 'قسم: المتجر وسوق الشمساوية' },
              { key: 'toolMaintenance', label: 'قسم: صيانة العِدد وخطوط الإنتاج' },
              { key: 'suppliersPromo', label: 'قسم: بوابة موردي وتجار ومصانع الخامات (B2B)' },
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

          {/* قسم طبلية عيلة الشمساوية والصفحة الشخصية */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">قسم 06: طبلية عيلة الشمساوية والصفحة الشخصية</h3>
              <button
                type="button"
                onClick={() =>
                  setCms((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      familyProfile: { ...familySec, visible: !familySec.visible },
                    },
                  }))
                }
                className="px-3 py-1 rounded-xl border text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                {familySec.visible ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-rose-600" />}
                <span>{familySec.visible ? 'ظاهر' : 'مخفي'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={familySec.titleLine1}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: { ...p.sections, familyProfile: { ...familySec, titleLine1: e.target.value } },
                  }))
                }
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <input
                type="text"
                value={familySec.titleHighlight}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: { ...p.sections, familyProfile: { ...familySec, titleHighlight: e.target.value } },
                  }))
                }
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <input
                type="text"
                value={familySec.ctaText}
                onChange={(e) =>
                  setCms((p) => ({
                    ...p,
                    sections: { ...p.sections, familyProfile: { ...familySec, ctaText: e.target.value } },
                  }))
                }
                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>
            <textarea
              rows={2}
              value={familySec.description}
              onChange={(e) =>
                setCms((p) => ({
                  ...p,
                  sections: { ...p.sections, familyProfile: { ...familySec, description: e.target.value } },
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
          </div>
        </div>
      )}

      {/* التبويب 4: حكايات الورش + جديد المنظومة + الأسئلة الشائعة */}
      {activeTab === 'social_faq' && (
        <div className="space-y-5">
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
                            version: 'V 5.1',
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

      {/* ==================== نافذة المعاينة الحية الكاملة قبل الحفظ والنشر للجمهور ==================== */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-[#060B18]/90 backdrop-blur-md flex flex-col">
          {/* شريط أدوات المعاينة */}
          <div className="shrink-0 bg-[#0C1427] text-white border-b border-[#22355E] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm font-black text-[#FBBF24] flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                <span>معاينة حية لصفحة الهبوط قبل الحفظ والنشر للجمهور</span>
              </span>
              <span className="hidden md:inline text-[11px] text-[#94A3B8]">
                ({design.activePreset === 'custom_injected' ? `تصميم محقون: ${design.injectedTemplate.name}` : `القالب: ${design.activePreset}`})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* تبديل مقاس الشاشة */}
              <div className="inline-flex items-center rounded-xl bg-[#132040] p-1 border border-[#22355E]">
                <button
                  type="button"
                  onClick={() => setPreviewViewport('desktop')}
                  title="معاينة شاشة كمبيوتر"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer ${
                    previewViewport === 'desktop' ? 'bg-[#EA580C] text-white' : 'text-[#CBD5E1]'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">كمبيوتر</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport('tablet')}
                  title="معاينة تابلت"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer ${
                    previewViewport === 'tablet' ? 'bg-[#EA580C] text-white' : 'text-[#CBD5E1]'
                  }`}
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">تابلت</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport('mobile')}
                  title="معاينة موبايل"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer ${
                    previewViewport === 'mobile' ? 'bg-[#EA580C] text-white' : 'text-[#CBD5E1]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">موبايل</span>
                </button>
              </div>

              {/* تبديل النهاري والليلي في المعاينة */}
              <button
                type="button"
                onClick={() => setPreviewDarkMode((p) => !p)}
                className="px-3 py-1.5 rounded-xl bg-[#132040] border border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                {previewDarkMode ? <Sun className="w-3.5 h-3.5 text-[#FBBF24]" /> : <Moon className="w-3.5 h-3.5 text-sky-300" />}
                <span>{previewDarkMode ? 'نهاري' : 'ليلي'}</span>
              </button>

              {/* اعتماد ونشر مباشرة من المعاينة */}
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  await handlePersist(cms, true);
                  setShowPreviewModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>اعتماد ونشر التصميم للجمهور</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>العودة للتعديل</span>
              </button>
            </div>
          </div>

          {/* إطار العرض التفاعلي */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex justify-center bg-[#080E1E]">
            <div
              className={`bg-white dark:bg-[#060B18] rounded-2xl overflow-hidden shadow-2xl border border-[#22355E] transition-all duration-200 ${
                previewDarkMode ? 'dark' : ''
              }`}
              style={{
                width:
                  previewViewport === 'desktop'
                    ? '100%'
                    : previewViewport === 'tablet'
                      ? '768px'
                      : '390px',
                maxWidth: '100%',
                height: 'fit-content',
                minHeight: '100%',
              }}
            >
              <LandingPage
                previewCmsOverride={cms}
                isPreview={true}
                isDarkMode={previewDarkMode}
                onToggleTheme={() => setPreviewDarkMode((p) => !p)}
                onOpenLogin={() => {}}
                onOpenRegister={() => {}}
                onOpenRegisterSupplier={() => {}}
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
