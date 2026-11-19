import React, { useState, useEffect, useRef } from 'react';
import {
  AlShamsFalconEmblem,
  AlShamsBrandLogo,
  FalconMascotFull,
  ShamousaMascotFull,
} from '../brand/BrandAssets';
import {
  LandingCmsConfig,
  LandingAccentTheme,
  LandingLayoutPreset,
  DEFAULT_LANDING_CMS_CONFIG,
  DEFAULT_LANDING_MEDIA,
  getStoredLandingCmsConfig,
} from '../../types/landingCms';
import { useFeatureFlags } from '../../types/featureFlags';
import { syncPlatformSettingsFromCloud } from '../../services/marketplaceCartService';
import { AlShamsWelcomeGate } from './AlShamsWelcomeGate';
import { AlShamsAudioPlayer, AlShamsAudioPlayerHandle } from './AlShamsAudioPlayer';
import { InjectedLandingRenderer } from './InjectedLandingRenderer';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import {
  Calculator,
  Layers,
  ShoppingBag,
  Wrench,
  ShieldCheck,
  Star,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  Bot,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  Moon,
  Sun,
  Check,
  Users,
  BookOpen,
  Store,
  Receipt,
  Scale,
  UserCheck,
  Truck,
  Building2,
  ArrowLeftRight,
  Printer,
  Wallet,
  Sparkles,
  Award,
  Camera,
  SlidersHorizontal,
} from 'lucide-react';

interface LandingPageProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenRegisterSupplier?: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  previewCmsOverride?: LandingCmsConfig;
  isPreview?: boolean;
}

interface AccentTokens {
  primaryBtn: string;
  primaryText: string;
  primaryBorder: string;
  softSurface: string;
  barFill: string;
  activeTab: string;
}

const ACCENT_MAP: Record<LandingAccentTheme, AccentTokens> = {
  solar_orange: {
    primaryBtn: 'bg-[#EA580C] hover:bg-[#C2410C] text-white',
    primaryText: 'text-[#C2410C] dark:text-[#FBBF24]',
    primaryBorder: 'border-[#EA580C]/40 dark:border-[#FBBF24]/40',
    softSurface: 'bg-[#EA580C]/8 dark:bg-[#FBBF24]/10',
    barFill: 'bg-[#EA580C] dark:bg-[#FBBF24]',
    activeTab: 'bg-[#EA580C] text-white',
  },
  emerald_craft: {
    primaryBtn: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    primaryText: 'text-emerald-700 dark:text-emerald-400',
    primaryBorder: 'border-emerald-600/40 dark:border-emerald-400/40',
    softSurface: 'bg-emerald-600/8 dark:bg-emerald-400/10',
    barFill: 'bg-emerald-600 dark:bg-emerald-400',
    activeTab: 'bg-emerald-700 text-white',
  },
  royal_indigo: {
    primaryBtn: 'bg-indigo-700 hover:bg-indigo-800 text-white',
    primaryText: 'text-indigo-700 dark:text-indigo-400',
    primaryBorder: 'border-indigo-600/40 dark:border-indigo-400/40',
    softSurface: 'bg-indigo-600/8 dark:bg-indigo-400/10',
    barFill: 'bg-indigo-600 dark:bg-indigo-400',
    activeTab: 'bg-indigo-700 text-white',
  },
  crimson_clay: {
    primaryBtn: 'bg-[#9F1239] hover:bg-[#881337] text-white',
    primaryText: 'text-[#9F1239] dark:text-rose-400',
    primaryBorder: 'border-[#9F1239]/40 dark:border-rose-400/40',
    softSurface: 'bg-[#9F1239]/8 dark:bg-rose-400/10',
    barFill: 'bg-[#9F1239] dark:bg-rose-400',
    activeTab: 'bg-[#9F1239] text-white',
  },
};

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLogin,
  onOpenRegister,
  onOpenRegisterSupplier,
  isDarkMode = false,
  onToggleTheme,
  previewCmsOverride,
  isPreview = false,
}) => {
  const audioPlayerRef = useRef<AlShamsAudioPlayerHandle | null>(null);
  const [isWelcomeGateOpen, setIsWelcomeGateOpen] = useState(false);
  const [liveCms, setLiveCms] = useState<LandingCmsConfig>(() => getStoredLandingCmsConfig());
  const flags = useFeatureFlags();

  const cms = previewCmsOverride || liveCms;
  const design = cms.designConfig;
  const activePreset: LandingLayoutPreset = design?.activePreset || 'editorial_craft';
  const accentKey: LandingAccentTheme = design?.accentTheme || 'solar_orange';
  const accent = ACCENT_MAP[accentKey] || ACCENT_MAP.solar_orange;

  // Interactive states
  const [summaryMode, setSummaryMode] = useState<'workshop' | 'supplier'>('workshop');
  const [simQuestion, setSimQuestion] = useState<
    'falcon_macrame' | 'falcon_soap' | 'shamousa_summary' | 'shamousa_stock'
  >('falcon_macrame');
  const [activeSuiteTab, setActiveSuiteTab] = useState<'store' | 'catalog' | 'crm' | 'maintenance'>('store');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [materialsImgFailed, setMaterialsImgFailed] = useState(false);
  const [supplierImgFailed, setSupplierImgFailed] = useState(false);

  // Feedback modal state
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackCraft, setFeedbackCraft] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  useEffect(() => {
    if (previewCmsOverride) return;
    const syncCms = () => setLiveCms(getStoredLandingCmsConfig());
    syncPlatformSettingsFromCloud()
      .then(() => setLiveCms(getStoredLandingCmsConfig()))
      .catch(() => {});
    window.addEventListener('alshams_landing_cms_updated', syncCms);
    return () => window.removeEventListener('alshams_landing_cms_updated', syncCms);
  }, [previewCmsOverride]);

  useEffect(() => {
    if (isPreview) return;
    try {
      const seen = localStorage.getItem('alshams_welcome_gate_seen');
      if (!seen) {
        const timer = setTimeout(() => {
          setIsWelcomeGateOpen(true);
        }, 550);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [isPreview]);

  useEffect(() => {
    setHeroImgFailed(false);
  }, [design?.heroImageUrl]);

  useEffect(() => {
    setMaterialsImgFailed(false);
  }, [design?.materialsImageUrl]);

  useEffect(() => {
    setSupplierImgFailed(false);
  }, [design?.supplierImageUrl]);

  const handleGateEnter = () => {
    try {
      localStorage.setItem('alshams_welcome_gate_seen', 'true');
    } catch {}
    audioPlayerRef.current?.playTrack();
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackName.trim() || !feedbackMessage.trim()) return;
    setFeedbackSubmitting(true);
    try {
      const res = await fetch('/api/landing/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: feedbackName.trim(),
          craftType: feedbackCraft.trim() || 'حرفي في الشمساوية',
          rating: feedbackRating,
          message: feedbackMessage.trim(),
          contact: feedbackContact.trim(),
        }),
      });
      if (res.ok) {
        setFeedbackSuccess(true);
        setTimeout(() => {
          setIsFeedbackModalOpen(false);
          setFeedbackSuccess(false);
          setFeedbackName('');
          setFeedbackCraft('');
          setFeedbackMessage('');
          setFeedbackContact('');
          setFeedbackRating(5);
        }, 1800);
      }
    } catch {
      // Fallback silent
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Custom Injected Template Dispatch (Auto-hydrates all CMS data into injected HTML/CSS)
  const injected = design?.injectedTemplate;
  if (activePreset === 'custom_injected' && injected?.enabled && injected.html.trim().length > 0) {
    return (
      <div className="min-h-screen w-full" dir="rtl">
        {!isPreview && (
          <AlShamsWelcomeGate
            isOpen={isWelcomeGateOpen}
            onClose={() => setIsWelcomeGateOpen(false)}
            onEnter={handleGateEnter}
          />
        )}
        <InjectedLandingRenderer
          cms={cms}
          isDarkMode={isDarkMode}
          isPreview={isPreview}
          onOpenLogin={onOpenLogin}
          onOpenRegister={onOpenRegister}
          onOpenRegisterSupplier={onOpenRegisterSupplier}
          onToggleTheme={onToggleTheme}
          onOpenWelcomeGate={() => setIsWelcomeGateOpen(true)}
        />
      </div>
    );
  }

  // Preset-driven surface & typography tuning (preserving brand palette while giving real architectural choice)
  const isObsidianPreset = activePreset === 'executive_obsidian';
  const isMinimalPreset = activePreset === 'gallery_minimal';
  const isConversionPreset = activePreset === 'conversion_split';

  const pageCanvasClass = isObsidianPreset
    ? 'bg-[#080E1E] text-[#F7F3EA]'
    : isMinimalPreset
      ? 'bg-[#FAF8F4] dark:bg-[#070C18] text-[#0C1427] dark:text-[#F7F3EA]'
      : 'bg-[#F2ECE1] dark:bg-[#060B18] text-[#0C1427] dark:text-[#F7F3EA]';

  const surfaceCardClass = isObsidianPreset
    ? 'bg-[#0E1833] border-[#21335C]'
    : isMinimalPreset
      ? 'bg-white dark:bg-[#0C1427] border-[#E4DDD0] dark:border-[#1E2E52]'
      : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]';

  const mutedTextClass = isObsidianPreset
    ? 'text-[#A8B7D1]'
    : 'text-[#475569] dark:text-[#94A3B8]';

  const unifiedSec = cms.sections.unifiedEngine || DEFAULT_LANDING_CMS_CONFIG.sections.unifiedEngine!;
  const familySec = cms.sections.familyProfile || DEFAULT_LANDING_CMS_CONFIG.sections.familyProfile!;
  const heroMetrics =
    cms.hero.metrics && cms.hero.metrics.length > 0
      ? cms.hero.metrics
      : DEFAULT_LANDING_CMS_CONFIG.hero.metrics!;

  const heroImageSrc = design?.heroImageUrl || DEFAULT_LANDING_MEDIA.heroImageUrl;
  const materialsImageSrc = design?.materialsImageUrl || DEFAULT_LANDING_MEDIA.materialsImageUrl;
  const supplierImageSrc = design?.supplierImageUrl || DEFAULT_LANDING_MEDIA.supplierImageUrl;

  const simulatorScenarios = {
    falcon_macrame: {
      tabLabel: 'صقر · تسعير مكرمية (ث1–ث6)',
      userQuery: 'عايز أسعر جدارية مكرمية 70×110 سم بخيط قطن محلول 3 مم مع عصا خشب زان وهامش ربح 35%',
      speaker: cms.sections.aiPartners.falconName,
      role: cms.sections.aiPartners.falconRoleBadge,
      replyTitle: 'تحليل هندسي جاهز للتصدير لحاسبة التكاليف:',
      bullets: [
        'خامة موحدة TH0001.01 (خيط قطن 3 مم): صافي 148 م + هالك موحد 10% (ث1 بدون ازدواجية) = 162.8 م ≈ 580 جم = 116 ج.م',
        'عصا خشب زان 80 سم (WD0012) + تغليف فاخر = 74 ج.م · مصنعية تنفيذ وتشطيب فعلي 3.5 ساعة (ث2) = 280 ج.م',
        'إجمالي التكلفة الحقيقية: 470 ج.م · سعر البيع العادل بهامش Margin 35% (وليس Markup) = 725 ج.م · صافي ربح مضمون 255 ج.م',
      ],
      actionNote: 'زر «تصدير للحاسبة» ينقل البنود والأكواد مباشرة ← الحفظ في الأرشيف ككارت صنف معتمد.',
    },
    falcon_soap: {
      tabLabel: 'صقر · صابون بارد وريزن (SAP)',
      userQuery: 'احسب لي دفعة 12 قطعة صابون بارد زيت زيتون وجوز هند بنسبة سوبرفات 6% وتصويب تالف 1 قطعة',
      speaker: cms.sections.aiPartners.falconName,
      role: cms.sections.aiPartners.falconRoleBadge,
      replyTitle: 'معادلة التصبن SAP والتحقق من الأمان (ث3–ث5):',
      bullets: [
        'الزيوت: 700 جم زيت زيتون + 300 جم جوز هند · هيدروكسيد الصوديوم NaOH بعد سوبرفات 6% = 138.4 جم (تحذير سلامة إلزامي)',
        'ماء مقطر (33%): 330 جم · وقت التصنيع الفعلي 75 دقيقة (يُستبعد وقت التصلب 4 أسابيع من أجر اليد — قاعدة ث2)',
        'إطفاء قالب السيليكون + توزيع تكلفة الدفعة على 11 قطعة سليمة فقط (ث4) = تكلفة القطعة 31.4 ج.م · السعر المقترح 75 ج.م',
      ],
      actionNote: 'دقيق لكل الـ 14 قسماً الحرفياً مع إمكانية دمج حِرفتين في قطعة واحدة (Craft Fusion).',
    },
    shamousa_summary: {
      tabLabel: 'شموسة · بطاقة «هلخصهالك»',
      userQuery: 'يا شموسة قوليلي وضع الورشة المالي النهارده في 10 ثواني ومين متأخر في السداد؟',
      speaker: cms.sections.aiPartners.shamousaName,
      role: cms.sections.aiPartners.shamousaRoleBadge,
      replyTitle: 'خلاصة خزينتك الحية اليوم:',
      bullets: [
        'معانا الآن 18,450 ج.م: درج الورشة 4,200 ج.م · إنستاباي 11,050 ج.م · محفظة فودافون كاش 3,200 ج.م',
        'لينا بره 3,850 ج.م عند 3 عملاء — أبرزهم (سارة محمود · متأخر 9 أيام بمبلغ 1,450 ج.م) — جهزت لك رسالة تذكير واتساب مهذبة',
        'علينا للموردين 2,100 ج.م (مورد خيوط النور · يستحق بعد 4 أيام) · صافي موقف السيولة: +20,200 ج.م مطمئن',
      ],
      actionNote: 'متاحة للورش وللموردين متعددي الفروع بنفس البساطة وبدون أي مصطلحات دائن ومدين.',
    },
    shamousa_stock: {
      tabLabel: 'شموسة · حركة المخزن والسوق',
      userQuery: 'إيه الخامات اللي قربت تخلص في المخزن وإيه منتجاتي المعتمدة في سوق الشمساوية؟',
      speaker: cms.sections.aiPartners.shamousaName,
      role: cms.sections.aiPartners.shamousaRoleBadge,
      replyTitle: 'رادار المخزن وسوق الشمساوية الآن:',
      bullets: [
        'تنبيه نواقص: خيط مكرمية 3 مم بيج (TH0001.01) المتبقي 2 بكرة فقط — أقل من حد الأمان · اقتراح: اطلبه من موردين الشمساوية بسعر الجملة',
        'صنف راكد: خرز خشب 16 مم أزرق لم يتحرك منذ 48 يوماً (140 قطعة) — اقترحنا عرض تصفية سريع',
        'سوق الشمساوية: لديك 9 منتجات بشارة الاعتماد الخضراء، ومنتجان بانتظار المراجعة بعد تعديل السعر الأخير',
      ],
      actionNote: 'شموسة تفتح لك الشاشة المطلوبة أو تصيغ لك أمر الشراء فوراً بدون بحث طويل.',
    },
  };

  const currentSim = simulatorScenarios[simQuestion];

  const suiteTabs = [
    {
      id: 'store' as const,
      label: 'المتجر وسوق الشمساوية',
      icon: Store,
      data: cms.sections.craftStore,
      visible: cms.sections.craftStore.visible && flags.artisanMarketplaceEnabled,
      metrics: [
        { k: 'التحكم بالنشر', v: 'قرار يدوي للفنان' },
        { k: 'حالة الاعتماد', v: 'شارة خضراء معتمدة' },
        { k: 'تعديل المنتج', v: 'إعادة مراجعة تلقائية' },
      ],
    },
    {
      id: 'catalog' as const,
      label: 'الكتالوج وعروض الأسعار',
      icon: BookOpen,
      data: cms.sections.smartCatalog,
      visible: cms.sections.smartCatalog.visible,
      metrics: [
        { k: 'الأصل المرجعي', v: 'الأرشيف (كارت الصنف)' },
        { k: 'عروض الأسعار', v: 'برقم مسلسل وعربون' },
        { k: 'تحويل لطلبية', v: 'بضغطة واحدة' },
      ],
    },
    {
      id: 'crm' as const,
      label: 'إدارة العملاء CRM',
      icon: Users,
      data: cms.sections.crmClients,
      visible: cms.sections.crmClients.visible,
      metrics: [
        { k: 'مصدر العميل', v: 'متجري · السوق · خارجي' },
        { k: 'المستحقات', v: 'عدّاد أيام تأخير حي' },
        { k: 'التواصل', v: 'رسالة واتساب مهذبة' },
      ],
    },
    {
      id: 'maintenance' as const,
      label: 'الأصول وصيانة العدد',
      icon: Wrench,
      data: cms.sections.toolMaintenance,
      visible: cms.sections.toolMaintenance.visible,
      metrics: [
        { k: 'إطفاء القوالب', v: 'يُحسب ضمن التكلفة' },
        { k: 'الصيانة الوقائية', v: 'تنبيهات دورية للمعدات' },
        { k: 'سجل الأصول', v: 'تاريخ أعطال وتكلفة' },
      ],
    },
  ].filter((t) => t.visible);

  const activeSuite = suiteTabs.find((t) => t.id === activeSuiteTab) || suiteTabs[0];

  const navLinks = (cms.header.navLinks || []).slice(0, 5);

  return (
    <div
      dir="rtl"
      className={`min-h-screen font-sans selection:bg-[#EA580C]/20 selection:text-[#0C1427] dark:selection:text-[#F7F3EA] transition-colors duration-300 ${pageCanvasClass}`}
    >
      {/* بوابة الترحيب التفاعلية للزائر الجديد */}
      {!isPreview && (
        <AlShamsWelcomeGate
          isOpen={isWelcomeGateOpen}
          onClose={() => setIsWelcomeGateOpen(false)}
          onEnter={handleGateEnter}
        />
      )}

      {/* ==================== 1. الشريط العلوي المتزن (3-Zone Top Bar) ==================== */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
          isObsidianPreset
            ? 'bg-[#080E1E]/92 border-[#1D2D52]'
            : 'bg-[#F2ECE1]/92 dark:bg-[#060B18]/92 border-[#D4CCBC] dark:border-[#1E2E52]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-4">
          {/* المنطقة 1: هوية المنظومة */}
          <a
            href="#top"
            className="flex items-center gap-2.5 shrink-0 focus:outline-none"
            aria-label="منظومة الشمساوية"
          >
            <AlShamsFalconEmblem size={36} isDark={isObsidianPreset || isDarkMode} />
            <AlShamsBrandLogo
              isDark={isObsidianPreset || isDarkMode}
              className="h-9 sm:h-10"
            />
          </a>

          {/* المنطقة 2: 5 روابط تنقل أحادية السطر بدون كبسولات */}
          <nav aria-label="التنقل الرئيسي" className="hidden lg:flex items-center gap-7">
            {navLinks.map((lnk) => (
              <a
                key={lnk.id}
                href={lnk.href}
                className={`text-sm font-bold whitespace-nowrap shrink-0 transition-colors hover:${accent.primaryText} ${
                  isObsidianPreset
                    ? 'text-[#CBD5E1] hover:text-[#FBBF24]'
                    : 'text-[#334155] dark:text-[#CBD5E1]'
                }`}
              >
                {lnk.label}
              </a>
            ))}
          </nav>

          {/* المنطقة 3: تحكم هادئ + زر إجراء أساسي واحد واضح */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {!isPreview && (
              <div className="hidden sm:block">
                <AlShamsAudioPlayer ref={audioPlayerRef} />
              </div>
            )}

            {!isPreview && (
              <div className="hidden xl:block">
                <PWAInstallButton compact />
              </div>
            )}

            {onToggleTheme && !isObsidianPreset && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="تبديل المظهر النهاري والليلي"
                title={isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
                className="w-9 h-9 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center text-[#334155] dark:text-[#CBD5E1] hover:border-[#EA580C] transition cursor-pointer"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-[#FBBF24]" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenLogin}
              className={`hidden sm:inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                isObsidianPreset
                  ? 'text-[#E2E8F0] hover:text-[#FBBF24]'
                  : 'text-[#0C1427] dark:text-[#F7F3EA] hover:text-[#C2410C] dark:hover:text-[#FBBF24]'
              }`}
            >
              دخول
            </button>

            <button
              type="button"
              onClick={onOpenRegister}
              className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap shrink-0 transition cursor-pointer shadow-xs ${accent.primaryBtn}`}
            >
              {cms.header.ctaButtonText}
            </button>
          </div>
        </div>
      </header>

      {/* ==================== 2. الواجهة الرئيسية (Hero Section) ==================== */}
      <main id="top">
        <section className="relative overflow-hidden border-b border-[#D4CCBC]/80 dark:border-[#1E2E52]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 sm:pt-14 sm:pb-16 lg:pt-16 lg:pb-20">
            <div
              className={`grid grid-cols-1 ${
                isConversionPreset ? 'lg:grid-cols-12' : 'lg:grid-cols-12'
              } gap-8 lg:gap-12 items-stretch`}
            >
              {/* عمود النص التحريري وصياغة القيمة */}
              <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                <p
                  className={`text-xs sm:text-sm font-extrabold tracking-wide ${accent.primaryText}`}
                >
                  الإصدار V 5.0 · {cms.hero.falconBadgeText}
                </p>

                <h1 className="text-3xl sm:text-5xl lg:text-[3.25rem] font-black leading-[1.15] tracking-tight [text-wrap:balance]">
                  <span className="block">{cms.hero.headlineLine1}</span>
                  <span className={`block mt-1.5 ${accent.primaryText}`}>
                    {cms.hero.headlineHighlight}
                  </span>
                </h1>

                <p className={`text-sm sm:text-base lg:text-[17px] leading-[1.85] max-w-2xl ${mutedTextClass}`}>
                  {cms.hero.description}
                </p>

                {/* أزرار القرار المزدوجة (فنان حرفي vs مورد خامات) */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onOpenRegister}
                    className={`px-6 py-3.5 rounded-xl text-sm sm:text-base font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-sm ${accent.primaryBtn}`}
                  >
                    <span>{cms.hero.primaryCtaText}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {flags.supplierLandingPromoEnabled && (
                    <button
                      type="button"
                      onClick={onOpenRegisterSupplier || onOpenRegister}
                      className={`px-6 py-3.5 rounded-xl text-sm sm:text-base font-black border flex items-center justify-center gap-2 transition cursor-pointer ${
                        isObsidianPreset
                          ? 'bg-[#122042] border-[#294072] text-[#F7F3EA] hover:border-[#FBBF24]'
                          : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#C9BFA9] dark:border-[#2A3F6E] hover:border-[#EA580C]'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      <span>{cms.hero.secondaryCtaText}</span>
                    </button>
                  )}
                </div>

                {/* سطر ثقة نظيف بدون كبسولات مكدسة */}
                <div
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-xs sm:text-[13px] font-bold ${mutedTextClass}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {cms.hero.trustBadge1}
                  </span>
                  <span aria-hidden="true" className="opacity-40">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {cms.hero.trustBadge2}
                  </span>
                  <span aria-hidden="true" className="opacity-40">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {cms.hero.trustBadge3}
                  </span>
                </div>

                {!isPreview && (
                  <div className="pt-1 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setIsWelcomeGateOpen(true)}
                      className={`text-xs font-extrabold underline underline-offset-4 cursor-pointer ${accent.primaryText}`}
                    >
                      {cms.header.welcomeGateButtonText} مع النشيد الترحيبي
                    </button>
                  </div>
                )}
              </div>

              {/* عمود المشهد البصري التحريري (Editorial Craft Photography + Live Atelier Telemetry Card) */}
              <div className="lg:col-span-6 flex">
                <div
                  className={`relative w-full min-h-[340px] sm:min-h-[430px] rounded-2xl overflow-hidden border flex flex-col justify-between ${surfaceCardClass}`}
                >
                  {!heroImgFailed ? (
                    <img
                      src={heroImageSrc}
                      alt="مشغل حرفي مصري منظم يعمل بمنظومة الشمساوية"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1A2B54] via-[#0D162E] to-[#431407]" />
                  )}

                  {/* غطاء تباين ناعم لقراءة النص دون تشتيت الصورة */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060B18]/92 via-[#060B18]/35 to-[#060B18]/20" />

                  {/* الشريط العلوي داخل الإطار */}
                  <div className="relative z-10 p-4 sm:p-6 flex items-center justify-between gap-3">
                    <span className="text-xs font-black text-[#F7F3EA]/90 tracking-wide">
                      منظومة الشمساوية · التشغيل اليومي الموحد
                    </span>
                    <span className="text-xs font-mono tabular-nums font-bold text-[#FBBF24]">
                      TH0001.01#B003
                    </span>
                  </div>

                  {/* بطاقة لقطة تشغيلية نظيفة أسفل الصورة */}
                  <div className="relative z-10 p-4 sm:p-6 space-y-3">
                    <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                      <div className="rounded-xl bg-[#081024]/82 backdrop-blur-md border border-white/15 p-3">
                        <span className="block text-[11px] font-bold text-[#CBD5E1]">خامة موحدة</span>
                        <span className="block text-base sm:text-lg font-black text-white font-mono tabular-nums mt-0.5">
                          +395
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#081024]/82 backdrop-blur-md border border-white/15 p-3">
                        <span className="block text-[11px] font-bold text-[#CBD5E1]">ورشة ومعادلة</span>
                        <span className="block text-base sm:text-lg font-black text-[#FBBF24] font-mono tabular-nums mt-0.5">
                          +50
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#081024]/82 backdrop-blur-md border border-white/15 p-3">
                        <span className="block text-[11px] font-bold text-[#CBD5E1]">المتجر والسوق</span>
                        <span className="block text-base sm:text-lg font-black text-emerald-400 mt-0.5">
                          متصل حي
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#081024]/85 backdrop-blur-md border border-white/15 p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white truncate">
                          الأرشيف (كارت الصنف) ← الكتالوج ← متجرك ← سوق الشمساوية
                        </p>
                        <p className="text-[11px] text-[#CBD5E1] mt-0.5">
                          حماية كاملة للهامش · فروع ومخازن الموردين · ذكاء اصطناعي فوري
                        </p>
                      </div>
                      <div className="flex items-center -space-x-2 space-x-reverse shrink-0">
                        <div className="w-9 h-9 rounded-full bg-[#132040] border border-white/20 flex items-center justify-center overflow-hidden p-1">
                          <FalconMascotFull className="w-full h-full object-contain" isDark />
                        </div>
                        <div className="w-9 h-9 rounded-full bg-[#132040] border border-white/20 flex items-center justify-center overflow-hidden p-1">
                          <ShamousaMascotFull className="w-full h-full object-contain" isDark />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* شريط الأرقام الموثقة (4-Column Quantitative Proof Strip) */}
            <div className="mt-10 sm:mt-14 pt-8 border-t border-[#D4CCBC] dark:border-[#1E2E52] grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {heroMetrics.map((m) => (
                <div key={m.id} className="space-y-1">
                  <div className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${accent.primaryText}`}>
                    {m.value}
                  </div>
                  <div className="text-sm font-black">{m.label}</div>
                  <p className={`text-xs leading-relaxed ${mutedTextClass}`}>{m.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== 3. القسم 01: منظومة الخامات الموحدة والورش الـ 14 ==================== */}
        {unifiedSec.visible && (
          <section id="unified-engine" className="py-16 sm:py-24 border-b border-[#D4CCBC]/70 dark:border-[#1E2E52]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-3 max-w-3xl">
                  <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                    {unifiedSec.badge}
                  </p>
                  <h2 className="text-2xl sm:text-4xl font-black leading-tight [text-wrap:balance]">
                    {unifiedSec.title}
                  </h2>
                  <p className={`text-sm sm:text-base leading-relaxed ${mutedTextClass}`}>
                    {unifiedSec.subtitle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onOpenRegister}
                  className={`px-5 py-3 rounded-xl text-xs sm:text-sm font-black inline-flex items-center gap-2 shrink-0 self-start lg:self-end transition cursor-pointer ${accent.primaryBtn}`}
                >
                  <Calculator className="w-4 h-4" />
                  <span>{unifiedSec.ctaText}</span>
                </button>
              </div>

              {/* شبكة غير متماثلة: بطاقة الخامات المرئية + بطاقات القواعد الهندسية الأربع */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* الصورة التحريرية للخامات + تفكيك الكود الرباعي */}
                <div className={`lg:col-span-5 rounded-2xl border overflow-hidden flex flex-col ${surfaceCardClass}`}>
                  <div className="relative h-60 sm:h-64 w-full overflow-hidden bg-[#132040]">
                    {!materialsImgFailed ? (
                      <img
                        src={materialsImageSrc}
                        alt="خامات حرفية موحدة: خيوط، خرز، ريزن، جلود، أخشاب وأدوات قياس"
                        referrerPolicy="no-referrer"
                        onError={() => setMaterialsImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#292524] to-[#0C1427]" />
                    )}
                  </div>

                  <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-5">
                    <div className="space-y-2">
                      <span className={`text-xs font-extrabold ${accent.primaryText}`}>
                        تشريح الكود الهندسي الرباعي للخامات
                      </span>
                      <div
                        dir="ltr"
                        className="p-3.5 rounded-xl bg-[#0C1427] text-[#F7F3EA] font-mono text-sm sm:text-base font-black tracking-wider flex items-center justify-between"
                      >
                        <span>
                          <span className="text-[#FBBF24]">TH</span>
                          <span className="text-sky-400">0001</span>
                          <span className="text-emerald-400">.01</span>
                          <span className="text-orange-400">#B003</span>
                        </span>
                        <span className="text-[11px] font-sans text-[#94A3B8]">4 مستويات</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E]">
                        <span className="font-mono font-black text-[#C2410C] dark:text-[#FBBF24]">TH</span>
                        <span className={`block mt-0.5 ${mutedTextClass}`}>القسم من 12 قسماً</span>
                      </div>
                      <div className="p-2.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E]">
                        <span className="font-mono font-black text-sky-700 dark:text-sky-400">0001</span>
                        <span className={`block mt-0.5 ${mutedTextClass}`}>الخامة الرئيسية</span>
                      </div>
                      <div className="p-2.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E]">
                        <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">.01</span>
                        <span className={`block mt-0.5 ${mutedTextClass}`}>المقاس / السمك / السعة</span>
                      </div>
                      <div className="p-2.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E]">
                        <span className="font-mono font-black text-orange-700 dark:text-orange-400">#B003</span>
                        <span className={`block mt-0.5 ${mutedTextClass}`}>الماركة + قاموس AL</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4 بطاقات معمارية للقواعد المصححة والأقسام */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  {unifiedSec.cards.map((card, index) => (
                    <article
                      key={card.id}
                      className={`rounded-2xl border p-5 sm:p-6 flex flex-col justify-between space-y-4 ${surfaceCardClass}`}
                    >
                      <div className="space-y-3">
                        <span className={`text-xs font-mono font-black tabular-nums ${accent.primaryText}`}>
                          0{index + 1}
                        </span>
                        <h3 className="text-base sm:text-lg font-black leading-snug">
                          {card.title}
                        </h3>
                        <p className={`text-xs sm:text-sm leading-relaxed ${mutedTextClass}`}>
                          {card.description}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              {/* شريط المسار الإنتاجي الستة (من الخامة إلى سوق الشمساوية) */}
              <div className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${surfaceCardClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-black">
                    تسلسل التشغيل المعتمد داخل المنظومة (6 مراحل مترابطة بدون تكرار إدخال)
                  </h3>
                  <span className={`text-xs font-bold ${mutedTextClass}`}>
                    البيانات تتدفق تلقائياً مع حفظ كامل لقرار الفنان
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {unifiedSec.pipelineSteps.map((step, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-[#D4CCBC] dark:border-[#22355E] p-3 flex flex-col justify-between gap-2"
                    >
                      <span className={`text-xs font-mono font-black tabular-nums ${accent.primaryText}`}>
                        المرحلة 0{i + 1}
                      </span>
                      <span className="text-xs sm:text-[13px] font-black leading-snug">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 4. القسم 02: المالية وبطاقة «هلخصهالك» التفاعلية ==================== */}
        {cms.sections.safeAccounts.visible && (
          <section id="safe-accounts" className="py-16 sm:py-24 border-b border-[#D4CCBC]/70 dark:border-[#1E2E52]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-5 space-y-4">
                  <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                    {cms.sections.safeAccounts.badge}
                  </p>
                  <h2 className="text-2xl sm:text-4xl font-black leading-tight [text-wrap:balance]">
                    {cms.sections.safeAccounts.title}
                  </h2>
                  <p className={`text-sm sm:text-base leading-relaxed ${mutedTextClass}`}>
                    {cms.sections.safeAccounts.subtitle}
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onOpenRegister}
                      className={`px-5 py-3 rounded-xl text-xs sm:text-sm font-black inline-flex items-center gap-2 transition cursor-pointer ${accent.primaryBtn}`}
                    >
                      <Wallet className="w-4 h-4" />
                      <span>{cms.sections.safeAccounts.ctaText}</span>
                    </button>
                  </div>
                </div>

                {/* معاينة تفاعلية حية لبطاقة «هلخصهالك» (تبديل: ورشة حرفية vs مورد خامات) */}
                <div className={`lg:col-span-7 rounded-2xl border p-5 sm:p-6 space-y-5 ${surfaceCardClass}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D4CCBC] dark:border-[#22355E]">
                    <div>
                      <h3 className="text-base sm:text-lg font-black">معاينة حية لبطاقة «هلخصهالك»</h3>
                      <p className={`text-xs mt-0.5 ${mutedTextClass}`}>
                        اختر نوع النشاط لترى كيف تلخص المنظومة موقفك المالي في 30 ثانية
                      </p>
                    </div>
                    <div className="inline-flex p-1 rounded-xl bg-[#E8E0D1] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] self-start">
                      <button
                        type="button"
                        onClick={() => setSummaryMode('workshop')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                          summaryMode === 'workshop' ? accent.activeTab : mutedTextClass
                        }`}
                      >
                        وضع الورشة الحرفية
                      </button>
                      <button
                        type="button"
                        onClick={() => setSummaryMode('supplier')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                          summaryMode === 'supplier' ? accent.activeTab : mutedTextClass
                        }`}
                      >
                        وضع مورد الخامات
                      </button>
                    </div>
                  </div>

                  {summaryMode === 'workshop' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="p-4 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">معانا كام وفين الآن</span>
                        <div className="text-xl font-black font-mono tabular-nums">18,450 ج.م</div>
                        <p className={`text-[11px] ${mutedTextClass}`}>
                          درج الورشة 4,200 · إنستاباي 11,050 · محفظة 3,200
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">لينا كام بره عند الزباين</span>
                        <div className="text-xl font-black font-mono tabular-nums">3,850 ج.م</div>
                        <p className={`text-[11px] ${mutedTextClass}`}>
                          3 عملاء · أعلى تأخير 9 أيام · زر تذكير واتساب مهذب جاهز
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-400">علينا كام للموردين</span>
                        <div className="text-xl font-black font-mono tabular-nums">2,100 ج.م</div>
                        <p className={`text-[11px] ${mutedTextClass}`}>
                          فاتورة خيوط آجلة تستحق خلال 4 أيام
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
                        <span className="text-xs font-bold text-sky-700 dark:text-sky-400">حركة المخزون (طاير vs نايم)</span>
                        <div className="text-sm font-black">الأسرع: خيط 3 مم بيج · الراكد: خرز أزرق 16 مم</div>
                        <p className={`text-[11px] ${mutedTextClass}`}>
                          تنبيه تلقائي قبل نفاد الخامة الأسرع طلباً
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="p-4 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">سيولة خزينة المالك والفروع</span>
                        <div className="text-xl font-black font-mono tabular-nums">142,800 ج.م</div>
                        <p className={`text-[11px] ${mutedTextClass}`}>
                          الخزينة الرئيسية 94,000 · فرع وسط البلد 29,300 · فرع المعادي 19,500
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">لينا بره عند الورش والتجار</span>
                        <div className="text-xl font-black font-mono tabular-nums">31,400 ج.م</div>
                        <p className={`text-[11px] ${mutedTextClass}`}>
                          11 ورشة · تحذير بيع آجل لورشتين + تذكير واتساب مهذب
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-400">علينا للمصانع والمستوردين</span>
                        <div className="text-xl font-black font-mono tabular-nums">48,000 ج.م</div>
                        <p className={`text-[11px] ${mutedTextClass}`}>
                          شحنة غزل قطن وريزن · توريدات مجدولة بدون انكشاف سيولة
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
                        <span className="text-xs font-bold text-sky-700 dark:text-sky-400">تحويلات قيد الاستلام بين الفروع</span>
                        <div className="text-sm font-black">3 شحنات معلقة بانتظار تأكيد أمين الفرع</div>
                        <p className={`text-[11px] ${mutedTextClass}`}>
                          كل حركة مسجلة بكارت الصنف — صفر ضياع بين المخزن والمحلات
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* البطاقات الأربع الشارحة للنظام المالي */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {cms.sections.safeAccounts.cards.map((card, i) => (
                  <div key={card.id} className={`rounded-2xl border p-5 space-y-2.5 ${surfaceCardClass}`}>
                    <span className={`text-xs font-mono font-black tabular-nums ${accent.primaryText}`}>
                      0{i + 1}
                    </span>
                    <h3 className="text-base font-black leading-snug">{card.title}</h3>
                    <p className={`text-xs sm:text-[13px] leading-relaxed ${mutedTextClass}`}>
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ==================== 5. القسم 03: صقر الشمساوية وشموسة AI ==================== */}
        {cms.sections.aiPartners.visible && flags.aiAssistantsEnabled && (
          <section id="ai-partners" className="py-16 sm:py-24 border-b border-[#D4CCBC]/70 dark:border-[#1E2E52]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
              <div className="space-y-3 max-w-3xl">
                <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                  {cms.sections.aiPartners.badge}
                </p>
                <h2 className="text-2xl sm:text-4xl font-black leading-tight [text-wrap:balance]">
                  {cms.sections.aiPartners.title}
                </h2>
                <p className={`text-sm sm:text-base leading-relaxed ${mutedTextClass}`}>
                  {cms.sections.aiPartners.subtitle}
                </p>
              </div>

              {/* بطاقتا الشريكين: صقر + شموسة */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                <div className={`rounded-2xl border p-6 flex flex-col sm:flex-row items-start gap-5 ${surfaceCardClass}`}>
                  <div className="w-20 h-20 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-2 shrink-0 flex items-center justify-center">
                    <FalconMascotFull className="w-full h-full object-contain" isDark={isObsidianPreset || isDarkMode} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="text-lg font-black">{cms.sections.aiPartners.falconName}</h3>
                      <span className={`text-xs font-extrabold ${accent.primaryText}`}>
                        · {cms.sections.aiPartners.falconRoleBadge}
                      </span>
                    </div>
                    <p className={`text-xs sm:text-sm leading-relaxed ${mutedTextClass}`}>
                      {cms.sections.aiPartners.falconDescription}
                    </p>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 pt-1">
                      {cms.sections.aiPartners.falconFootnote}
                    </p>
                  </div>
                </div>

                <div className={`rounded-2xl border p-6 flex flex-col sm:flex-row items-start gap-5 ${surfaceCardClass}`}>
                  <div className="w-20 h-20 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-2 shrink-0 flex items-center justify-center">
                    <ShamousaMascotFull className="w-full h-full object-contain" isDark={isObsidianPreset || isDarkMode} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="text-lg font-black">{cms.sections.aiPartners.shamousaName}</h3>
                      <span className={`text-xs font-extrabold ${accent.primaryText}`}>
                        · {cms.sections.aiPartners.shamousaRoleBadge}
                      </span>
                    </div>
                    <p className={`text-xs sm:text-sm leading-relaxed ${mutedTextClass}`}>
                      {cms.sections.aiPartners.shamousaDescription}
                    </p>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 pt-1">
                      {cms.sections.aiPartners.shamousaFootnote}
                    </p>
                  </div>
                </div>
              </div>

              {/* محاكي تفاعلي للردود الحية (4 سيناريوهات حقيقية) */}
              <div className={`rounded-2xl border p-5 sm:p-7 space-y-5 ${surfaceCardClass}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <Bot className={`w-5 h-5 ${accent.primaryText}`} />
                    <h3 className="text-base sm:text-lg font-black">
                      {cms.sections.aiPartners.simulatorTitle}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(Object.keys(simulatorScenarios) as Array<keyof typeof simulatorScenarios>).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSimQuestion(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer border ${
                          simQuestion === key
                            ? `${accent.activeTab} border-transparent`
                            : 'border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                        }`}
                      >
                        {simulatorScenarios[key].tabLabel}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                  <div className="lg:col-span-4 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <span className={`text-[11px] font-bold ${mutedTextClass}`}>سؤال الحرفي أو المورد</span>
                      <p className="text-sm font-black leading-relaxed">«{currentSim.userQuery}»</p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenRegister}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${accent.primaryBtn}`}
                    >
                      <span>{cms.sections.aiPartners.simulatorCtaText}</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="lg:col-span-8 rounded-xl bg-[#0C1427] text-[#F7F3EA] p-5 space-y-3 border border-[#22355E]">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                      <span className="text-sm font-black text-[#FBBF24]">
                        {currentSim.speaker} · {currentSim.role}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-400">استجابة فورية</span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-white">{currentSim.replyTitle}</p>
                    <ul className="space-y-2 text-xs sm:text-[13px] text-[#CBD5E1] leading-relaxed">
                      {currentSim.bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-[#FBBF24] shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="pt-2 border-t border-white/10 text-[11px] font-bold text-emerald-300">
                      {currentSim.actionNote}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 6. القسم 04: دورة حياة المشغولة + جناح المتجر والكتالوج وCRM ==================== */}
        {cms.sections.craftLifecycle.visible && (
          <section id="craft-lifecycle" className="py-16 sm:py-24 border-b border-[#D4CCBC]/70 dark:border-[#1E2E52]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-3 max-w-3xl">
                  <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                    {cms.sections.craftLifecycle.badge}
                  </p>
                  <h2 className="text-2xl sm:text-4xl font-black leading-tight [text-wrap:balance]">
                    {cms.sections.craftLifecycle.title}
                  </h2>
                  <p className={`text-sm sm:text-base leading-relaxed ${mutedTextClass}`}>
                    {cms.sections.craftLifecycle.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className={`px-5 py-3 rounded-xl text-xs sm:text-sm font-black inline-flex items-center gap-2 shrink-0 self-start lg:self-end transition cursor-pointer ${accent.primaryBtn}`}
                >
                  <span>{cms.sections.craftLifecycle.ctaText}</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>

              {/* 4 خطوات مرقمة لدورة الحياة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {cms.sections.craftLifecycle.steps.map((st) => (
                  <div key={st.id} className={`rounded-2xl border p-5 sm:p-6 space-y-3 ${surfaceCardClass}`}>
                    <span className={`text-xl font-mono font-black tabular-nums ${accent.primaryText}`}>
                      {st.stepNumber}
                    </span>
                    <h3 className="text-base font-black">{st.title}</h3>
                    <p className={`text-xs sm:text-sm leading-relaxed ${mutedTextClass}`}>{st.description}</p>
                  </div>
                ))}
              </div>

              {/* عرض مبوّب تفاعلي لأدوات الورشة الأربعة (المتجر والسوق / الكتالوج / CRM / الصيانة) */}
              {activeSuite && (
                <div className={`rounded-2xl border p-5 sm:p-8 space-y-6 ${surfaceCardClass}`}>
                  <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-[#D4CCBC] dark:border-[#22355E]">
                    {suiteTabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = tab.id === activeSuite.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveSuiteTab(tab.id)}
                          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black inline-flex items-center gap-2 transition cursor-pointer ${
                            isActive
                              ? accent.activeTab
                              : 'border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div className="lg:col-span-7 space-y-4">
                      <p className={`text-xs font-extrabold ${accent.primaryText}`}>
                        {activeSuite.data.badge}
                      </p>
                      <h3 className="text-xl sm:text-3xl font-black leading-tight [text-wrap:balance]">
                        {activeSuite.data.titleLine1}{' '}
                        <span className={accent.primaryText}>{activeSuite.data.titleHighlight}</span>
                      </h3>
                      <p className={`text-sm sm:text-base leading-relaxed ${mutedTextClass}`}>
                        {activeSuite.data.description}
                      </p>
                      <ul className="space-y-2.5 pt-1">
                        {activeSuite.data.bullets.map((bullet, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={onOpenRegister}
                          className={`px-5 py-3 rounded-xl text-xs sm:text-sm font-black inline-flex items-center gap-2 transition cursor-pointer ${accent.primaryBtn}`}
                        >
                          <span>{activeSuite.data.ctaText}</span>
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="lg:col-span-5 space-y-3">
                      {activeSuite.metrics.map((m, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-[#D4CCBC] dark:border-[#22355E] p-4 flex items-center justify-between gap-3"
                        >
                          <span className={`text-xs font-bold ${mutedTextClass}`}>{m.k}</span>
                          <span className="text-xs sm:text-sm font-black">{m.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ==================== 7. القسم 05: بوابة موردي وتجار ومصانع الخامات (B2B & B2C) ==================== */}
        {cms.sections.suppliersPromo.visible && flags.supplierLandingPromoEnabled && (
          <section id="suppliers-promo" className="py-16 sm:py-24 border-b border-[#D4CCBC]/70 dark:border-[#1E2E52]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
                {/* نص ومزايا بوابة الموردين */}
                <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
                  <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                    {cms.sections.suppliersPromo.badge}
                  </p>
                  <h2 className="text-2xl sm:text-4xl font-black leading-tight [text-wrap:balance]">
                    {cms.sections.suppliersPromo.titleLine1}{' '}
                    <span className={accent.primaryText}>{cms.sections.suppliersPromo.titleHighlight}</span>
                  </h2>
                  <p className={`text-sm sm:text-base leading-relaxed ${mutedTextClass}`}>
                    {cms.sections.suppliersPromo.description}
                  </p>

                  <ul className="space-y-3 pt-1">
                    {cms.sections.suppliersPromo.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm font-bold leading-relaxed">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className={`rounded-xl border p-3 ${surfaceCardClass}`}>
                      <Building2 className={`w-4 h-4 mb-1.5 ${accent.primaryText}`} />
                      <div className="text-xs font-black">فروع ومخزن مركزي</div>
                    </div>
                    <div className={`rounded-xl border p-3 ${surfaceCardClass}`}>
                      <Printer className={`w-4 h-4 mb-1.5 ${accent.primaryText}`} />
                      <div className="text-xs font-black">كاشير وريسيت 80 مم</div>
                    </div>
                    <div className={`rounded-xl border p-3 ${surfaceCardClass}`}>
                      <ArrowLeftRight className={`w-4 h-4 mb-1.5 ${accent.primaryText}`} />
                      <div className="text-xs font-black">تحويل على مرحلتين</div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onOpenRegisterSupplier || onOpenRegister}
                      className={`px-6 py-3.5 rounded-xl text-sm font-black inline-flex items-center gap-2 transition cursor-pointer ${accent.primaryBtn}`}
                    >
                      <Truck className="w-4 h-4" />
                      <span>{cms.sections.suppliersPromo.ctaText}</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* الصورة التحريرية لمعرض المورد + بطاقة شرائح الكميات الحية */}
                <div className={`lg:col-span-6 rounded-2xl border overflow-hidden flex flex-col ${surfaceCardClass}`}>
                  <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-[#132040]">
                    {!supplierImgFailed ? (
                      <img
                        src={supplierImageSrc}
                        alt="معرض مورد خامات حرفية مجهز بكاشير ونظام فروع"
                        referrerPolicy="no-referrer"
                        onError={() => setSupplierImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#064E3B] to-[#0C1427]" />
                    )}
                  </div>

                  <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black">مثال حي · شرائح تسعير الجملة والقطاعي</span>
                      <span className={`text-xs font-mono font-bold ${accent.primaryText}`}>POS 80mm</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="rounded-xl border border-[#D4CCBC] dark:border-[#22355E] p-3">
                        <span className={`block text-[11px] font-bold ${mutedTextClass}`}>قطاعي (1–9)</span>
                        <span className="block text-base font-black font-mono tabular-nums mt-0.5">85 ج.م</span>
                      </div>
                      <div className={`rounded-xl border p-3 ${accent.primaryBorder} ${accent.softSurface}`}>
                        <span className={`block text-[11px] font-bold ${accent.primaryText}`}>نصف جملة (+10)</span>
                        <span className="block text-base font-black font-mono tabular-nums mt-0.5">74 ج.م</span>
                      </div>
                      <div className="rounded-xl border border-[#D4CCBC] dark:border-[#22355E] p-3">
                        <span className={`block text-[11px] font-bold ${mutedTextClass}`}>جملة (+50)</span>
                        <span className="block text-base font-black font-mono tabular-nums mt-0.5">66 ج.م</span>
                      </div>
                    </div>

                    <p className={`text-xs leading-relaxed ${mutedTextClass}`}>
                      يدعم البيع بالوزن والكسور العشرية (مثل 2.4 كجم)، تثبيت شاشة جهاز الفرع (Kiosk Lock)، وتوريد الخزائن اليومي بضغطة تأكيد من المالك.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 8. القسم 06: طبلية عيلة الشمساوية والصفحة الشخصية ==================== */}
        {familySec.visible && (
          <section id="family-profile" className="py-16 sm:py-24 border-b border-[#D4CCBC]/70 dark:border-[#1E2E52]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-3 max-w-3xl">
                  <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                    {familySec.badge}
                  </p>
                  <h2 className="text-2xl sm:text-4xl font-black leading-tight [text-wrap:balance]">
                    {familySec.titleLine1}{' '}
                    <span className={accent.primaryText}>{familySec.titleHighlight}</span>
                  </h2>
                  <p className={`text-sm sm:text-base leading-relaxed ${mutedTextClass}`}>
                    {familySec.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onOpenRegister}
                  className={`px-5 py-3 rounded-xl text-xs sm:text-sm font-black inline-flex items-center gap-2 shrink-0 self-start lg:self-end transition cursor-pointer ${accent.primaryBtn}`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{familySec.ctaText}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                <div className={`rounded-2xl border p-6 sm:p-7 space-y-4 ${surfaceCardClass}`}>
                  <MessageSquare className={`w-6 h-6 ${accent.primaryText}`} />
                  <h3 className="text-lg sm:text-xl font-black">{familySec.communityTitle}</h3>
                  <p className={`text-sm leading-relaxed ${mutedTextClass}`}>{familySec.communityDesc}</p>
                </div>

                <div className={`rounded-2xl border p-6 sm:p-7 space-y-4 ${surfaceCardClass}`}>
                  <Camera className={`w-6 h-6 ${accent.primaryText}`} />
                  <h3 className="text-lg sm:text-xl font-black">{familySec.profileTitle}</h3>
                  <p className={`text-sm leading-relaxed ${mutedTextClass}`}>{familySec.profileDesc}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 9. القسم 07: شهادات الورش والموردين ==================== */}
        {cms.sections.reviews.visible && (
          <section id="reviews" className="py-16 sm:py-24 border-b border-[#D4CCBC]/70 dark:border-[#1E2E52]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2.5 max-w-2xl">
                  <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                    {cms.sections.reviews.badge}
                  </p>
                  <h2 className="text-2xl sm:text-4xl font-black leading-tight [text-wrap:balance]">
                    {cms.sections.reviews.title}
                  </h2>
                  <p className={`text-sm sm:text-base ${mutedTextClass}`}>
                    {cms.sections.reviews.subtitle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFeedbackModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs sm:text-sm font-black inline-flex items-center gap-2 self-start md:self-end transition cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{cms.sections.reviews.feedbackCtaText}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {cms.sections.reviews.items.map((rev) => (
                  <blockquote
                    key={rev.id}
                    className={`rounded-2xl border p-5 sm:p-6 flex flex-col justify-between gap-4 ${surfaceCardClass}`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: Math.min(5, Math.max(1, rev.rating || 5)) }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-current" />
                        ))}
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-relaxed">«{rev.quote}»</p>
                    </div>
                    <footer className="pt-3 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
                      <div className="text-xs sm:text-sm font-black">{rev.author}</div>
                      <div className={`text-[11px] font-bold mt-0.5 ${mutedTextClass}`}>{rev.workshop}</div>
                    </footer>
                  </blockquote>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ==================== 10. تحديثات الإصدار V 5.0 ==================== */}
        {cms.sections.whatsNew.visible && (
          <section id="whats-new" className="py-16 sm:py-20 border-b border-[#D4CCBC]/70 dark:border-[#1E2E52]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="space-y-2 max-w-2xl">
                <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                  {cms.sections.whatsNew.badge}
                </p>
                <h2 className="text-2xl sm:text-3xl font-black leading-tight">
                  {cms.sections.whatsNew.title}
                </h2>
                <p className={`text-sm ${mutedTextClass}`}>{cms.sections.whatsNew.subtitle}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {cms.sections.whatsNew.items.map((item) => (
                  <article key={item.id} className={`rounded-2xl border p-5 sm:p-6 space-y-2.5 ${surfaceCardClass}`}>
                    <div className={`text-xs font-extrabold ${accent.primaryText}`}>
                      {item.tag} · <span className="font-mono">{item.version}</span>
                    </div>
                    <h3 className="text-base font-black leading-snug">{item.title}</h3>
                    <p className={`text-xs sm:text-sm leading-relaxed ${mutedTextClass}`}>{item.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ==================== 11. الأسئلة الشائعة ==================== */}
        {cms.sections.faq.visible && (
          <section id="faq-section" className="py-16 sm:py-24 border-b border-[#D4CCBC]/70 dark:border-[#1E2E52]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="space-y-2.5">
                <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                  {cms.sections.faq.badge}
                </p>
                <h2 className="text-2xl sm:text-4xl font-black leading-tight">
                  {cms.sections.faq.title}
                </h2>
                <p className={`text-sm sm:text-base ${mutedTextClass}`}>{cms.sections.faq.subtitle}</p>
              </div>

              <div className="divide-y divide-[#D4CCBC] dark:divide-[#22355E] border-y border-[#D4CCBC] dark:border-[#22355E]">
                {cms.sections.faq.items.map((fq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div key={fq.id} className="py-4">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between gap-4 text-right cursor-pointer"
                        aria-expanded={isOpen}
                      >
                        <span className="text-sm sm:text-base font-black">{fq.q}</span>
                        {isOpen ? (
                          <ChevronUp className={`w-5 h-5 shrink-0 ${accent.primaryText}`} />
                        ) : (
                          <ChevronDown className={`w-5 h-5 shrink-0 ${mutedTextClass}`} />
                        )}
                      </button>
                      {isOpen && (
                        <p className={`mt-3 text-xs sm:text-sm leading-relaxed pl-6 ${mutedTextClass}`}>
                          {fq.a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ==================== 12. البانر الختامي النظيف ==================== */}
        {cms.sections.finalCta.visible && (
          <section className="py-16 sm:py-24">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="rounded-3xl bg-[#0C1427] text-[#F7F3EA] border border-[#22355E] p-8 sm:p-12 lg:p-14 text-center space-y-6">
                <h2 className="text-2xl sm:text-4xl font-black leading-tight [text-wrap:balance]">
                  {cms.sections.finalCta.title}
                </h2>
                <p className="text-sm sm:text-base text-[#CBD5E1] max-w-2xl mx-auto leading-relaxed">
                  {cms.sections.finalCta.subtitle}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onOpenRegister}
                    className={`w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm sm:text-base font-black inline-flex items-center justify-center gap-2 transition cursor-pointer ${accent.primaryBtn}`}
                  >
                    <span>{cms.sections.finalCta.ctaText}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  {flags.supplierLandingPromoEnabled && (
                    <button
                      type="button"
                      onClick={onOpenRegisterSupplier || onOpenRegister}
                      className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-black transition cursor-pointer"
                    >
                      {cms.hero.secondaryCtaText}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ==================== 13. التذييل الهادئ ==================== */}
      <footer className="border-t border-[#D4CCBC] dark:border-[#1E2E52] py-10 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <AlShamsFalconEmblem size={30} isDark={isObsidianPreset || isDarkMode} />
              <span className="text-base font-black">{cms.sections.footer.brandTitle}</span>
            </div>
            <p className={`text-xs max-w-md ${mutedTextClass}`}>{cms.sections.footer.brandSubtitle}</p>
          </div>

          <div className="space-y-1 md:text-left">
            <p className="text-xs font-bold">{cms.sections.footer.copyrightText}</p>
            <p className={`text-[11px] font-bold ${mutedTextClass}`}>{cms.sections.footer.subTagline}</p>
          </div>
        </div>
      </footer>

      {/* ==================== نافذة مشاركة الرأي والاقتراح ==================== */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#060B18]/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl border p-6 space-y-4 shadow-2xl ${surfaceCardClass}`}>
            <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
              <h3 className="text-base font-black">شاركنا رأيك أو اقتراحك لتطوير المنظومة</h3>
              <button
                type="button"
                onClick={() => setIsFeedbackModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {feedbackSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-sm font-black">تم استلام رأيك بنجاح، شكراً لكونك جزءاً من عيلة الشمساوية!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={feedbackName}
                    onChange={(e) => setFeedbackName(e.target.value)}
                    placeholder="الاسم أو اسم الورشة"
                    className="px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={feedbackCraft}
                    onChange={(e) => setFeedbackCraft(e.target.value)}
                    placeholder="مجال الحرفة أو التوريد"
                    className="px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                </div>
                <textarea
                  rows={3}
                  required
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="اكتب تجربتك أو اقتراحك..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className="p-1 cursor-pointer"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= feedbackRating ? 'text-amber-500 fill-current' : 'text-slate-400'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={feedbackSubmitting}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${accent.primaryBtn}`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{feedbackSubmitting ? 'جاري الإرسال...' : 'إرسال'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
