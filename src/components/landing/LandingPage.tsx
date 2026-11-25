import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  AlShamsBrandIcon,
  AlShamsBrandLogo,
  AlShamsFalconEmblem,
} from '../brand/BrandAssets';
import {
  LandingCmsConfig,
  DEFAULT_LANDING_MEDIA,
  getStoredLandingCmsConfig,
} from '../../types/landingCms';
import { useFeatureFlags } from '../../types/featureFlags';
import { syncPlatformSettingsFromCloud } from '../../services/marketplaceCartService';
import { AlShamsWelcomeGate } from './AlShamsWelcomeGate';
import { AlShamsAudioPlayer, AlShamsAudioPlayerHandle } from './AlShamsAudioPlayer';
import { InjectedLandingRenderer } from './InjectedLandingRenderer';
import { LandingSystemsDrawer, LandingSystemsExplorerSection } from './LandingSystemsShowcase';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { LanguageSwitcher } from '../layout/LanguageSwitcher';
import { setStoredLanguage, useTranslation } from '../../lib/i18n';
import { localizeCraftTerm, setStoredPublicLocale } from '../../lib/publicLocale';
import { resolveWorldLandingTheme } from '../../lib/landingThemes';
import { WORLD_STOREFRONT_THEMES_LIST } from '../../lib/storefrontThemes';
import { useSubscriptionPackagesConfig } from '../../types/subscriptions';
import { getLandingPackageCopyEn } from './landingTranslationsEn';
import {
  LandingShamousaFilterBanner,
  ShamousaLandingWidget,
} from './ShamousaLandingWidget';
import type { LandingSectionFilter } from '../../services/shamousaLandingEngine';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gift,
  Layers,
  Menu,
  MessageSquare,
  Moon,
  Send,
  ShoppingBag,
  Star,
  Store,
  Sun,
  Truck,
  User,
  X,
} from 'lucide-react';

interface LiveMarketProduct {
  id: string;
  brand_name: string;
  artist_name?: string;
  store_slug: string;
  product_name: string;
  craft_name?: string;
  category?: string;
  store_price?: number;
  retail_price?: number;
  image_url?: string | null;
}

interface LiveSupplierEntry {
  id: string;
  brand_name: string;
  owner_name?: string;
  governorate?: string;
  store_slug?: string;
  logo_url?: string | null;
}

interface LandingPageProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenRegisterSupplier?: () => void;
  onOpenMarketplace?: () => void;
  onOpenSuppliersMarket?: () => void;
  onOpenStore?: (slug: string) => void;
  onOpenSupplierStore?: (slug: string) => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  previewCmsOverride?: LandingCmsConfig;
  isPreview?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLogin,
  onOpenRegister,
  onOpenRegisterSupplier,
  onOpenMarketplace,
  onOpenSuppliersMarket,
  onOpenStore,
  onOpenSupplierStore,
  isDarkMode = false,
  onToggleTheme,
  previewCmsOverride,
  isPreview = false,
}) => {
  const audioPlayerRef = useRef<AlShamsAudioPlayerHandle | null>(null);
  const { lang, dir } = useTranslation();
  const isEn = lang !== 'ar';
  const isRTL = !isEn && dir === 'rtl';
  const DirectionalArrow = isRTL ? ArrowLeft : ArrowRight;

  const handleQuickToggleLandingLang = () => {
    const next = isEn ? 'ar' : 'en';
    setStoredLanguage(next);
    setStoredPublicLocale(next);
  };

  const [isWelcomeGateOpen, setIsWelcomeGateOpen] = useState(false);
  const [isSystemsDrawerOpen, setIsSystemsDrawerOpen] = useState(false);
  const [liveCms, setLiveCms] = useState<LandingCmsConfig>(() => getStoredLandingCmsConfig());
  const flags = useFeatureFlags();

  const cms = previewCmsOverride || liveCms;
  const design = cms.designConfig;
  const theme = resolveWorldLandingTheme(design?.activePreset, isDarkMode);

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [liveProducts, setLiveProducts] = useState<LiveMarketProduct[]>([]);
  const [liveSuppliers, setLiveSuppliers] = useState<LiveSupplierEntry[]>([]);
  const [shamousaLandingFilter, setShamousaLandingFilter] = useState<LandingSectionFilter | null>(null);

  const isLandingSectionVisible = (sectionId: string) =>
    !shamousaLandingFilter || shamousaLandingFilter.visibleSectionIds.includes(sectionId);
  const [marketsLoaded, setMarketsLoaded] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [galleryImgFailed, setGalleryImgFailed] = useState(false);
  const [supplierImgFailed, setSupplierImgFailed] = useState(false);

  // Feedback modal (wired to POST /api/public/feedback)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackCraft, setFeedbackCraft] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const storefrontThemesCount = WORLD_STOREFRONT_THEMES_LIST.length;
  const subscriptionPackages = useSubscriptionPackagesConfig();

  useEffect(() => {
    if (previewCmsOverride) return;
    syncPlatformSettingsFromCloud()
      .then(() => setLiveCms(getStoredLandingCmsConfig()))
      .catch(() => {});
  }, [previewCmsOverride]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [prodRes, supRes] = await Promise.all([
          fetch('/api/public/marketplace?limit=6').then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch('/api/public/suppliers?limit=6').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (!active) return;
        const prods = Array.isArray(prodRes?.products)
          ? prodRes.products
          : Array.isArray(prodRes?.items)
          ? prodRes.items
          : [];
        const sups = Array.isArray(supRes?.suppliers)
          ? supRes.suppliers
          : Array.isArray(supRes?.items)
          ? supRes.items
          : [];
        setLiveProducts(prods.slice(0, 6));
        setLiveSuppliers(sups.slice(0, 6));
      } finally {
        if (active) setMarketsLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Custom Injected HTML/CSS Template fallback controlled by Super Admin
  const injected = design?.injectedTemplate;
  if (design?.activePreset === 'custom_injected' && injected?.enabled && injected.html.trim().length > 0) {
    return (
      <InjectedLandingRenderer
        cms={cms}
        isPreview={isPreview}
        onOpenLogin={onOpenLogin}
        onOpenRegister={onOpenRegister}
        onOpenRegisterSupplier={onOpenRegisterSupplier}
        onOpenWelcomeGate={() => setIsWelcomeGateOpen(true)}
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
      />
    );
  }

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackName.trim() || !feedbackMessage.trim()) return;
    setFeedbackSubmitting(true);
    try {
      const res = await fetch('/api/public/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: feedbackName.trim(),
          craft: feedbackCraft.trim(),
          rating: feedbackRating,
          message: feedbackMessage.trim(),
          contact: feedbackContact.trim(),
        }),
      });
      if (res.ok) {
        setFeedbackSuccess(true);
        setFeedbackName('');
        setFeedbackCraft('');
        setFeedbackMessage('');
        setFeedbackContact('');
      }
    } catch {
      // ignore transient network error
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const heroImageSrc =
    design?.heroImageUrl && !design.heroImageUrl.includes('179509526')
      ? design.heroImageUrl
      : DEFAULT_LANDING_MEDIA.heroImageUrl;
  const galleryImageSrc =
    design?.materialsImageUrl && !design.materialsImageUrl.includes('179509526')
      ? design.materialsImageUrl
      : DEFAULT_LANDING_MEDIA.materialsImageUrl;
  const supplierImageSrc =
    design?.supplierImageUrl && !design.supplierImageUrl.includes('179509526')
      ? design.supplierImageUrl
      : DEFAULT_LANDING_MEDIA.supplierImageUrl;

  const isCenteredHero = theme.heroVariant === 'centered_monument';
  const isSwissHero = theme.heroVariant === 'swiss_grid';

  const faqs = isEn
    ? [
        {
          q: 'What do I get free forever as soon as I sign up?',
          a: 'You immediately receive the forever-free Core Starter Package, including your complete Personal Profile (skill level, bio, showcase portfolio & expert lessons), daily launch guide, and access to the Al-Shamsawiya community.',
        },
        {
          q: 'Are all other pro packages really free for a limited time?',
          a: `Yes! To celebrate our launch, you can activate the Global Storefront (${storefrontThemesCount} themes and growing automatically), Cost Calculator, Inventory & Treasuries, HR Payroll, and Supplier Barcode POS completely free (0 EGP) for a limited time.`,
        },
        {
          q: 'Does the platform still work if my workshop or shop loses internet?',
          a: 'Yes — Al-Shamsawiya saves your invoices and inventory locally on your device without interruption, and automatically syncs everything securely to the cloud the moment your connection returns.',
        },
        {
          q: 'What is the difference between an Artisan/Workshop account and a Supplier account?',
          a: 'Artisan & Workshop accounts focus on precision cost & waste calculation, production work orders, smart catalogs, and global storefronts. Supplier accounts focus on central warehouses, wholesale/retail pricing tiers, lightning-fast POS terminals, multi-branch operations, and the B2B Suppliers Market.',
        },
      ]
    : [
        {
          q: 'ما الذي تحصل عليه مجاناً للأبد فور التسجيل؟',
          a: 'تحصل على الباقة الأساسية المجانية للأبد وتشمل «صفحتي الشخصية» لتحديد مستواك وعرض نبذتك ومعرض أعمالك ومشاركاتك التدريبية أو التسويقية، بالإضافة لدليل التأسيس اليومي ومجتمع عيلة الشمساوية.',
        },
        {
          q: 'هل فعلاً باقي الباقات مجانية حالياً لفترة محدودة؟',
          a: `نعم! بمناسبة الإطلاق، يمكنك تفعيل باقات المتجر العالمي (${storefrontThemesCount} سمة حالياً وتزيد تلقائياً)، حاسبة التكاليف، المخازن والخزائن، الموارد البشرية، وكاشير نقاط البيع للموردين مجاناً بالكامل (0 ج.م) لفترة محدودة.`,
        },
        {
          q: 'هل المنظومة تعمل لو الإنترنت قطع في الورشة أو المحل؟',
          a: 'نعم — تحفظ الشمساوية فواتيرك ومخزونك محلياً على جهازك دون توقف، وبمجرد عودة الإنترنت تتزامن كل البيانات تلقائياً مع السحابة بأمان تام.',
        },
        {
          q: 'ما الفرق بين حساب الفنان/الورشة وحساب المورد؟',
          a: 'حساب الفنان والورشة يركز على حاسبة التكاليف والهدر، أوامر التشغيل، الكتالوج والمتجر العالمي. وحساب المورد يركز على المخزن المركزي، شرائح الجملة والقطاعي، كاشير POS السريع، الفروع المتعددة، وسوق الموردين B2B.',
        },
      ];

  const handleOpenSupplierRegister = () => {
    if (onOpenRegisterSupplier) onOpenRegisterSupplier();
    else onOpenRegister();
  };

  return (
    <div
      style={{
        backgroundColor: theme.pageBg,
        color: theme.inkColor,
      }}
      className="min-h-screen w-full max-w-full overflow-x-clip font-sans transition-colors duration-300"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* 1. Clean Single-Row Top Bar: 3-Line Menu + Crisp Brand | Desktop Nav | Start Free + Day/Night + Audio */}
      <header
        style={{
          backgroundColor: theme.pageBg,
          borderColor: theme.borderColor,
        }}
        className="sticky top-0 z-40 w-full max-w-full overflow-x-clip border-b backdrop-blur-md bg-opacity-95"
      >
        <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4 min-w-0">
          {/* Zone 1 (Start): 3-Line Side Menu + Crisp Brand Mark */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
            <button
              type="button"
              onClick={() => setIsSystemsDrawerOpen(true)}
              aria-label={isEn ? 'Systems menu and explorer' : 'القائمة الجانبية واستكشاف الأنظمة'}
              title={isEn ? 'Explore Systems' : 'القائمة الجانبية والأنظمة'}
              style={{
                backgroundColor: theme.softSurfaceBg,
                borderColor: theme.borderColor,
                color: theme.inkColor,
              }}
              className={`w-8 h-8 sm:w-10 sm:h-10 ${theme.buttonRadius} border flex items-center justify-center shrink-0 hover:opacity-85 transition cursor-pointer`}
            >
              <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <a
              href="#top"
              className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink focus-visible:outline-none"
            >
              <AlShamsBrandIcon
                size="sm"
                isDark={theme.isDarkTheme}
                className="w-7 h-7 sm:w-9 sm:h-9 shrink-0"
              />
              <div className="min-w-0 leading-tight">
                <span
                  style={{ color: theme.inkColor }}
                  className="block text-[13px] sm:text-base font-black tracking-tight truncate"
                >
                  {isEn ? 'Al-Shamsawiya' : 'الشمساوية'}
                </span>
                <span
                  style={{ color: theme.mutedColor }}
                  className="hidden sm:block text-[10px] font-bold truncate"
                >
                  {isEn ? 'Workshops & Suppliers Cloud' : 'منظومة الورش والموردين'}
                </span>
              </div>
            </a>
          </div>

          {/* Zone 2: Concise Single-Line Navigation Links (Desktop Only) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-bold shrink-0" style={{ color: theme.mutedColor }}>
            <button
              type="button"
              onClick={() => setIsSystemsDrawerOpen(true)}
              style={{ color: theme.accentText }}
              className="inline-flex items-center gap-1.5 font-black hover:opacity-80 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>{isEn ? 'Explore Systems' : 'استكشف الأنظمة'}</span>
            </button>
            <a href="#systems-explorer" className="hover:opacity-80 transition whitespace-nowrap shrink-0">
              {isEn ? 'Workshops & Suppliers' : 'للورش والموردين'}
            </a>
            <a href="#packages" className="hover:opacity-80 transition whitespace-nowrap shrink-0">
              {isEn ? 'Packages & Launch Offer' : 'الباقات والعرض المجاني'}
            </a>
            {flags.artisanMarketplaceEnabled && onOpenMarketplace && (
              <button
                type="button"
                onClick={onOpenMarketplace}
                className="hover:opacity-80 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isEn ? 'Marketplace' : 'سوق الشمساوية'}
              </button>
            )}
            <button
              type="button"
              onClick={onOpenLogin}
              className="hover:opacity-80 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isEn ? 'Sign In' : 'تسجيل الدخول'}
            </button>
          </nav>

          {/* Zone 3 (End): "Start Free" + Sleek AR/EN Toggle + Day/Night + Audio */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenRegister}
              style={{ backgroundColor: theme.accentBg, color: theme.accentInk }}
              className={`px-2.5 sm:px-5 h-8 sm:h-10 ${theme.buttonRadius} text-[11px] sm:text-sm font-black whitespace-nowrap shrink-0 hover:opacity-90 transition cursor-pointer shadow-xs`}
            >
              {isEn ? 'Start Free' : 'ابدأ مجاناً'}
            </button>

            <button
              type="button"
              onClick={handleQuickToggleLandingLang}
              aria-label={isEn ? 'Switch to Arabic' : 'Switch to English'}
              title={isEn ? 'التبديل للعربية' : 'Switch to English'}
              style={{
                backgroundColor: theme.softSurfaceBg,
                borderColor: theme.borderColor,
                color: theme.inkColor,
              }}
              className={`h-8 sm:h-10 px-2 sm:px-3 ${theme.buttonRadius} border text-[11px] sm:text-xs font-black shrink-0 hover:opacity-85 transition cursor-pointer`}
            >
              {isEn ? 'عربي' : 'EN'}
            </button>

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={
                  isEn
                    ? theme.isDarkTheme
                      ? 'Switch to Light Mode'
                      : 'Switch to Dark Mode'
                    : theme.isDarkTheme
                    ? 'التبديل للوضع النهاري'
                    : 'التبديل للوضع الليلي'
                }
                title={
                  isEn
                    ? theme.isDarkTheme
                      ? 'Light Mode'
                      : 'Dark Mode'
                    : theme.isDarkTheme
                    ? 'الوضع النهاري'
                    : 'الوضع الليلي'
                }
                style={{
                  backgroundColor: theme.softSurfaceBg,
                  borderColor: theme.borderColor,
                  color: theme.inkColor,
                }}
                className={`w-8 h-8 sm:w-10 sm:h-10 ${theme.buttonRadius} border flex items-center justify-center shrink-0 hover:opacity-85 transition cursor-pointer`}
              >
                {theme.isDarkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            {!isPreview && (
              <AlShamsAudioPlayer
                ref={audioPlayerRef}
                variant="header_icon"
                buttonRadiusClass={theme.buttonRadius}
                buttonStyle={{
                  backgroundColor: theme.softSurfaceBg,
                  borderColor: theme.borderColor,
                  color: theme.inkColor,
                }}
              />
            )}
          </div>
        </div>
      </header>

      {/* شريط الفلتر التفاعلي لشموسة صفحة الهبوط (يظهر فقط عند التفعيل) */}
      <LandingShamousaFilterBanner
        filter={shamousaLandingFilter}
        onClear={() => setShamousaLandingFilter(null)}
        onCta={(action) => {
          if (action === 'register_supplier') handleOpenSupplierRegister();
          else if (action === 'open_marketplace') onOpenMarketplace?.();
          else if (action === 'open_suppliers_market') onOpenSuppliersMarket?.();
          else if (action === 'open_login') onOpenLogin();
          else onOpenRegister();
        }}
      />

      {/* 2. Architectural Hero Section — Adapts Dynamically to Active World Theme */}
      <div id="landing-hero" />
      <section
        id="top"
        style={{ backgroundImage: theme.heroGradient }}
        className="relative py-10 sm:py-16 lg:py-20 px-4 sm:px-6"
      >
        <div
          className={`max-w-7xl mx-auto ${
            isCenteredHero
              ? 'flex flex-col items-center text-center gap-10'
              : 'grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch'
          }`}
        >
          {/* Copy Column */}
          <div
            className={`${
              isCenteredHero
                ? 'max-w-3xl space-y-6'
                : 'lg:col-span-6 flex flex-col justify-center space-y-6'
            }`}
          >
            <div
              className={`flex flex-wrap items-center gap-2 text-xs font-bold ${
                isCenteredHero ? 'justify-center' : ''
              }`}
              style={{ color: theme.accentText }}
            >
              <span>{isEn ? 'Al-Shamsawiya Cloud Platform' : 'منظومة الشمساوية السحابية'}</span>
              <span aria-hidden="true">·</span>
              <span>{isEn ? 'For Handmade Workshops & Suppliers' : 'للورش الحرفية وموردي الخامات'}</span>
              <span aria-hidden="true">·</span>
              <span>{isEn ? 'Works Online & Offline' : 'تعمل أونلاين وأوفلاين'}</span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(2rem, 4.2vw, 3.6rem)',
                textWrap: 'balance',
                color: theme.inkColor,
              }}
              className="font-black leading-[1.15] tracking-tight"
            >
              {isEn
                ? 'Run Your Workshop or Trade, Launch Your Global Storefront, and Protect Every Profit.'
                : 'أدِر ورشتك أو تجارتك، أطلق متجرك العالمي، وحافظ على كل جنيه في مكان واحد.'}
            </h1>

            <p
              style={{ color: theme.mutedColor }}
              className="text-sm sm:text-base leading-relaxed max-w-xl"
            >
              {isEn ? (
                <>
                  An all-in-one cloud platform uniting manufacturing & costing (ERP), treasuries & net profits (FCA), fast supplier POS, CRM & global online storefronts with{' '}
                  <strong style={{ color: theme.inkColor }}>{storefrontThemesCount} architectural themes</strong>, plus your forever-free Personal Profile.
                </>
              ) : (
                <>
                  منصة عربية متكاملة تجمع بين التصنيع والتسعير (ERP)، الخزائن والأرباح (FCA)، كاشير نقاط البيع للموردين (POS)، العملاء والمتجر الإلكتروني بـ{' '}
                  <strong style={{ color: theme.inkColor }}>{storefrontThemesCount} سمة عالمية</strong>، وصفحتك الشخصية المجانية للأبد.
                </>
              )}
            </p>

            {/* Primary & Secondary Decision Actions */}
            <div
              className={`flex flex-wrap items-center gap-3 pt-1 ${
                isCenteredHero ? 'justify-center' : ''
              }`}
            >
              <button
                type="button"
                onClick={onOpenRegister}
                style={{ backgroundColor: theme.accentBg, color: theme.accentInk }}
                className={`px-6 py-3.5 ${theme.buttonRadius} text-sm font-black inline-flex items-center gap-2 hover:opacity-90 transition cursor-pointer shadow-sm`}
              >
                <span>{isEn ? 'Create Free Artisan / Workshop Account' : 'إنشاء حساب فنان / ورشة مجاناً'}</span>
                <DirectionalArrow className="w-4 h-4" />
              </button>

              {flags.supplierRegistrationEnabled && (
                <button
                  type="button"
                  onClick={handleOpenSupplierRegister}
                  style={{
                    backgroundColor: theme.surfaceBg,
                    borderColor: theme.borderColor,
                    color: theme.inkColor,
                  }}
                  className={`px-5 py-3.5 ${theme.buttonRadius} border text-sm font-black inline-flex items-center gap-2 hover:opacity-90 transition cursor-pointer`}
                >
                  <Truck className="w-4 h-4" style={{ color: theme.accentText }} />
                  <span>{isEn ? 'Supplier / Raw Materials Account' : 'حساب مورد / تاجر خامات'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsSystemsDrawerOpen(true)}
                className="px-3 py-2 text-xs sm:text-sm font-black underline underline-offset-4 hover:opacity-80 cursor-pointer"
                style={{ color: theme.accentText }}
              >
                {isEn ? 'Try Interactive Systems Now' : 'جرّب الأنظمة التفاعلية الآن'}
              </button>
            </div>

            {/* Quiet Unboxed Proof Line */}
            <div
              className={`flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs font-bold ${
                isCenteredHero ? 'justify-center' : ''
              }`}
              style={{ color: theme.mutedColor }}
            >
              <span>{isEn ? 'Core Package + Personal Profile Free Forever' : 'الباقة الأساسية + صفحتي الشخصية مجانية للأبد'}</span>
              <span aria-hidden="true">·</span>
              <span>{isEn ? 'Launch Offer: All Packages Free for a Limited Time' : 'عرض الإطلاق: كل الباقات مجاناً لفترة محدودة'}</span>
              <span aria-hidden="true">·</span>
              <span>{isEn ? 'No Credit Card Required' : 'بدون بطاقة بنكية'}</span>
            </div>
          </div>

          {/* Dominant 16:9 Architectural Studio Visual */}
          <div className={isCenteredHero ? 'w-full max-w-5xl' : 'lg:col-span-6 flex'}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                backgroundColor: theme.surfaceBg,
                borderColor: theme.borderColor,
              }}
              className={`relative w-full ${theme.cardRadius} ${
                isSwissHero ? 'border-2' : 'border'
              } ${theme.cardShadow} overflow-hidden min-h-[280px] sm:min-h-[380px] lg:min-h-[430px] flex flex-col`}
            >
              {!heroImgFailed ? (
                <img
                  src={heroImageSrc}
                  alt={isEn ? 'Al-Shamsawiya Handmade Craft Studio & Workshop' : 'استوديو وورشة الشمساوية للحرف اليدوية'}
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover flex-1"
                />
              ) : (
                <div
                  style={{ backgroundColor: theme.softSurfaceBg }}
                  className="w-full h-full flex-1 flex flex-col items-center justify-center p-8 gap-3"
                >
                  <AlShamsFalconEmblem className="w-16 h-16" />
                  <p className="text-sm font-black">
                    {isEn ? 'Al-Shamsawiya Studio & Platform' : 'استوديو ومنظومة الشمساوية'}
                  </p>
                </div>
              )}

              {/* Subtle bottom editorial caption scrim */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 text-white flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-amber-300">
                    {isEn ? 'Complete Operating Suite for Artisans & Suppliers' : 'بيئة عمل متكاملة للحرفي والمورد'}
                  </p>
                  <p className="text-sm sm:text-base font-black">
                    {isEn
                      ? 'From the first gram of raw material to customer delivery & net profit'
                      : 'من أول جرام خامة حتى استلام العميل وتحصيل الربح الصافي'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWelcomeGateOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-xs text-white text-xs font-black cursor-pointer transition"
                >
                  {isEn ? 'Welcome Gate' : 'بوابة الترحيب'}
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Full-Width 4-Column Quantitative Strip Below Hero Split */}
        <div className="max-w-7xl mx-auto mt-10 pt-8 border-t grid grid-cols-2 lg:grid-cols-4 gap-5" style={{ borderColor: theme.borderColor }}>
          {(isEn
            ? [
                { num: `${storefrontThemesCount}`, label: 'Ready Global Storefront Themes (Growing Automatically)' },
                { num: '7', label: 'Integrated Suites: ERP · POS · FCA · CRM · HR · AI · Cloud' },
                { num: '0 EGP', label: 'Core Package + Personal Profile Free Forever' },
                { num: '100%', label: 'Works Seamlessly Online in the Cloud & Offline' },
              ]
            : [
                { num: `${storefrontThemesCount}`, label: 'سمات متجر عالمية جاهزة (تزيد تلقائياً)' },
                { num: '7', label: 'أنظمة مدمجة: ERP · POS · FCA · CRM · HR · AI · Cloud' },
                { num: '0 ج.م', label: 'الباقة الأساسية + صفحتي الشخصية مجانية للأبد' },
                { num: '100%', label: 'يعمل أونلاين سحابياً وأوفلاين بدون إنترنت' },
              ]
          ).map((kpi, idx) => (
            <div key={idx} className="space-y-1">
              <p
                style={{ color: theme.accentText }}
                className="text-2xl sm:text-3xl font-black font-mono tabular-nums"
              >
                {kpi.num}
              </p>
              <p style={{ color: theme.mutedColor }} className="text-xs font-bold leading-relaxed">
                {kpi.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Section 01 — Interactive Live Systems Explorer (Artisans & Suppliers) */}
      {isLandingSectionVisible('landing-systems') && (
        <div id="landing-systems">
          <LandingSystemsExplorerSection
            theme={theme}
            isEn={isEn}
            onStartArtisan={onOpenRegister}
            onStartSupplier={handleOpenSupplierRegister}
          />
        </div>
      )}

      {/* 4. Section 02 — Asymmetric Visual Editorial Showcase (Artisans + Suppliers) */}
      {isLandingSectionVisible('landing-markets') && (
      <section id="landing-markets" className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-black" style={{ color: theme.accentText }}>
              {isEn ? '02 · Two Connected Worlds in One Ecosystem' : '02 · عالمين متصلين في منظومة واحدة'}
            </p>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
              {isEn
                ? 'Real Value for the Artisan, the Supplier, and the Buyer'
                : 'منفعة حقيقية للفنان، وللمورد، وللمشتري'}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Wide Card: Artisans & Personal Page + Global Store */}
            <div
              style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
              className={`lg:col-span-7 ${theme.cardRadius} border ${theme.cardShadow} overflow-hidden flex flex-col justify-between`}
            >
              <div className="aspect-[16/10] w-full overflow-hidden">
                {!galleryImgFailed ? (
                  <img
                    src={galleryImageSrc}
                    alt={isEn ? 'Curated Handmade Craft Gallery' : 'معرض مشغولات يدوية راقية'}
                    referrerPolicy="no-referrer"
                    onError={() => setGalleryImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div style={{ backgroundColor: theme.softSurfaceBg }} className="w-full h-full" />
                )}
              </div>
              <div className="p-5 sm:p-6 space-y-3">
                <p className="text-xs font-black" style={{ color: theme.accentText }}>
                  {isEn ? 'For Artisans & Handmade Workshops' : 'للفنانين وأصحاب الورش اليدوية'}
                </p>
                <h3 className="text-lg sm:text-2xl font-black">
                  {isEn
                    ? 'Your Free Personal Profile + Global Storefront + Profit-Protecting Cost Calculator'
                    : 'صفحتك الشخصية المجانية + متجرك العالمي + حاسبة تكاليف تحمي ربحك'}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: theme.mutedColor }}>
                  {isEn
                    ? 'Start immediately with your Personal Profile to showcase your craft level, story, and portfolio — and transform your workshop into a structured brand with an independent storefront, animated banners, coupons, and offers.'
                    : 'ابدأ فوراً بصفحتك الشخصية لتحديد مستواك وعرض أعمالك ومشاركاتك التدريبية، وحوّل ورشتك إلى براند منظم بمتجر مستقل وبانرات متحركة وأكواد خصم وعروض قبل وبعد.'}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onOpenRegister}
                    style={{ color: theme.accentText }}
                    className="text-xs sm:text-sm font-black inline-flex items-center gap-1.5 hover:underline cursor-pointer"
                  >
                    <span>{isEn ? 'Start Your Workshop Account Free' : 'ابدأ حساب الورشة مجاناً'}</span>
                    <DirectionalArrow className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Companion Card: Suppliers & Raw Materials ERP/POS */}
            <div
              style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
              className={`lg:col-span-5 ${theme.cardRadius} border ${theme.cardShadow} overflow-hidden flex flex-col justify-between`}
            >
              <div className="aspect-[4/3] w-full overflow-hidden">
                {!supplierImgFailed ? (
                  <img
                    src={supplierImageSrc}
                    alt={isEn ? 'Raw Materials Supplier Warehouse & Showroom' : 'معرض ومخزن موردي خامات الحرف'}
                    referrerPolicy="no-referrer"
                    onError={() => setSupplierImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div style={{ backgroundColor: theme.softSurfaceBg }} className="w-full h-full" />
                )}
              </div>
              <div className="p-5 sm:p-6 space-y-3">
                <p className="text-xs font-black" style={{ color: theme.accentText }}>
                  {isEn ? 'For Raw Material Suppliers & Factories' : 'لموردي وتجار ومصانع الخامات'}
                </p>
                <h3 className="text-lg sm:text-xl font-black">
                  {isEn
                    ? 'Central Warehouse + Branches + Fast POS + B2B Wholesale Store'
                    : 'مخزن مركزي + فروع + كاشير POS سريع + متجر جملة B2B'}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: theme.mutedColor }}>
                  {isEn
                    ? 'Connect every branch and high-speed checkout terminal with an automatic wholesale/retail catalog and reach thousands of active workshops directly.'
                    : 'اربط كل فروعك وكاشير المبيعات السريع مع كتالوج جملة وقطاعي بشرائح أسعار أوتوماتيكية وتواصل مباشر مع آلاف الورش.'}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleOpenSupplierRegister}
                    style={{ color: theme.accentText }}
                    className="text-xs sm:text-sm font-black inline-flex items-center gap-1.5 hover:underline cursor-pointer"
                  >
                    <span>{isEn ? 'Open Your Supplier Portal Free' : 'افتح بوابة المورد مجاناً'}</span>
                    <DirectionalArrow className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* 5. Section 03 — Subscription Packages + Free Launch Offer */}
      {isLandingSectionVisible('landing-packages') && (
      <div id="landing-packages">
      <section
        id="packages"
        className="py-12 sm:py-16 px-4 sm:px-6 border-y"
        style={{ backgroundColor: theme.softSurfaceBg, borderColor: theme.borderColor }}
      >
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-black flex items-center gap-1.5" style={{ color: theme.accentText }}>
                <Gift className="w-4 h-4" />
                <span>
                  {isEn
                    ? '03 · Flexible Al-Shamsawiya Packages — Limited-Time Free Launch Offer'
                    : '03 · باقات الشمساوية المرنة — عرض الإطلاق المجاني لفترة محدودة'}
                </span>
              </p>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
                {isEn
                  ? 'Start with the Core Package Free Forever — Activate Pro Packages Free Today'
                  : 'ابدأ بالباقة الأساسية مجاناً للأبد — واختر باقاتك الاحترافية مجاناً الآن'}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: theme.mutedColor }}>
                {isEn
                  ? 'Every member (artisan or supplier) gets the Core Starter Package including their Personal Profile free forever, and can activate any additional Pro package completely free during our launch window.'
                  : 'كل عضو (فنان أو مورد) يحصل فوراً على الباقة الأساسية شاملة «صفحتي الشخصية» مجاناً للأبد، ويقدر يفعّل باقي الباقات مجاناً بالكامل لفترة محدودة من صفحة «اشتراكاتي».'}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenRegister}
              style={{ backgroundColor: theme.accentBg, color: theme.accentInk }}
              className={`px-5 py-3 ${theme.buttonRadius} text-xs sm:text-sm font-black self-start md:self-auto cursor-pointer hover:opacity-90`}
            >
              {isEn ? 'Claim Your Free Launch Offer' : 'احجز عرض الإطلاق المجاني الآن'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subscriptionPackages.map((pkg) => {
              const pkgEn = isEn ? getLandingPackageCopyEn(pkg.id, storefrontThemesCount) : null;
              const titleText = pkgEn ? pkgEn.title : pkg.titleAr;
              const taglineText = pkgEn ? pkgEn.tagline : pkg.taglineAr;
              const highlightItems = pkgEn ? pkgEn.highlights : pkg.highlightsArtisan.slice(0, 3);
              return (
                <div
                  key={pkg.id}
                  style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
                  className={`${theme.cardRadius} border ${theme.cardShadow} p-5 flex flex-col justify-between gap-4`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                      <span style={{ color: theme.mutedColor }}>
                        {isEn
                          ? pkg.order === 0
                            ? 'Core Package'
                            : `Package ${pkg.order}`
                          : pkg.order === 0
                          ? 'الباقة الأساسية'
                          : `الباقة ${pkg.order}`}
                      </span>
                      <span style={{ color: pkg.isAlwaysFree ? '#059669' : theme.accentText }} className="font-black">
                        {isEn
                          ? pkg.isAlwaysFree
                            ? 'Free Forever'
                            : '0 EGP · Limited Time'
                          : pkg.isAlwaysFree
                          ? 'مجانية للأبد'
                          : '0 ج.م · لفترة محدودة'}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-black leading-snug">{titleText}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: theme.mutedColor }}>
                      {taglineText}
                    </p>
                    <ul className="space-y-1.5 pt-2 border-t" style={{ borderColor: theme.borderColor }}>
                      {highlightItems.map((item, idx) => (
                        <li key={idx} className="text-xs flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-3 border-t flex items-center justify-between font-mono tabular-nums text-xs" style={{ borderColor: theme.borderColor }}>
                    {pkg.isAlwaysFree ? (
                      <span className="font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Includes Personal Profile Free' : 'تشمل صفحتي الشخصية مجاناً'}</span>
                      </span>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-black" style={{ color: theme.accentText }}>
                          {isEn ? '0 EGP Now' : '0 ج.م الآن'}
                        </span>
                        <span className="line-through opacity-60 text-[11px]" style={{ color: theme.mutedColor }}>
                          {pkg.monthlyPriceEgp} {isEn ? 'EGP/mo' : 'ج.م/شهر'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      </div>
      )}

      {/* 6. Section 04 — Live Real Marketplace & Verified Suppliers */}
      {isLandingSectionVisible('landing-markets') && marketsLoaded && (liveProducts.length > 0 || liveSuppliers.length > 0) && (
        <section className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-black" style={{ color: theme.accentText }}>
                  {isEn ? '04 · Live from Al-Shamsawiya Stores' : '04 · مباشر من متاجر الشمساوية'}
                </p>
                <h2 className="text-2xl sm:text-3xl font-black">
                  {isEn
                    ? 'Real Handmade Pieces & Verified Suppliers Live Today'
                    : 'قطع وموردون حقيقيون يعملون على المنظومة الآن'}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {flags.artisanMarketplaceEnabled && onOpenMarketplace && (
                  <button
                    type="button"
                    onClick={onOpenMarketplace}
                    style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor, color: theme.inkColor }}
                    className={`px-4 py-2 ${theme.buttonRadius} border text-xs font-black inline-flex items-center gap-1.5 cursor-pointer`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" style={{ color: theme.accentText }} />
                    <span>{isEn ? 'Browse Handmade Market' : 'تصفح سوق المشغولات'}</span>
                  </button>
                )}
                {flags.suppliersMarketplaceEnabled && onOpenSuppliersMarket && (
                  <button
                    type="button"
                    onClick={onOpenSuppliersMarket}
                    style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor, color: theme.inkColor }}
                    className={`px-4 py-2 ${theme.buttonRadius} border text-xs font-black inline-flex items-center gap-1.5 cursor-pointer`}
                  >
                    <Store className="w-3.5 h-3.5" style={{ color: theme.accentText }} />
                    <span>{isEn ? 'Suppliers Market' : 'سوق الموردين'}</span>
                  </button>
                )}
              </div>
            </div>

            {liveProducts.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {liveProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => (onOpenStore && p.store_slug ? onOpenStore(p.store_slug) : onOpenMarketplace?.())}
                    style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
                    className={`${isEn ? 'text-left' : 'text-right'} ${theme.cardRadius} border ${theme.cardShadow} overflow-hidden hover:-translate-y-0.5 transition cursor-pointer flex flex-col`}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden" style={{ backgroundColor: theme.softSurfaceBg }}>
                      <img
                        src={p.image_url || '/alshams_falcon_emblem.png'}
                        alt={p.product_name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3.5 space-y-1">
                      <p className="text-[11px] truncate" style={{ color: theme.mutedColor }}>
                        {p.brand_name}{' '}
                        {p.craft_name
                          ? `· ${isEn ? localizeCraftTerm(p.craft_name, 'en') : p.craft_name}`
                          : ''}
                      </p>
                      <h3 className="text-xs sm:text-sm font-black line-clamp-1">{p.product_name}</h3>
                      <p className="text-xs sm:text-sm font-mono font-black tabular-nums" style={{ color: theme.accentText }}>
                        {Number(p.store_price || p.retail_price || 0).toLocaleString(isEn ? 'en-US' : 'ar-EG')}{' '}
                        {isEn ? 'EGP' : 'ج.م'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {liveSuppliers.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                {liveSuppliers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => (onOpenSupplierStore && s.store_slug ? onOpenSupplierStore(s.store_slug) : onOpenSuppliersMarket?.())}
                    style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
                    className={`p-3.5 ${theme.cardRadius} border flex items-center gap-3 ${isEn ? 'text-left' : 'text-right'} hover:opacity-90 cursor-pointer`}
                  >
                    <img
                      src={s.logo_url || '/default-store-icon.png'}
                      alt={s.brand_name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl object-cover shrink-0 border"
                      style={{ borderColor: theme.borderColor }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">{s.brand_name}</p>
                      <p className="text-[11px] truncate" style={{ color: theme.mutedColor }}>
                        {isEn ? 'Verified Materials Supplier' : 'مورد خامات معتمد'}{' '}
                        {s.governorate ? `· ${s.governorate}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 7. Section 05 — FAQ & Community Voice */}
      {isLandingSectionVisible('landing-faq') && (
      <section
        id="landing-faq"
        className="py-12 sm:py-16 px-4 sm:px-6 border-t"
        style={{ borderColor: theme.borderColor }}
      >
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-black" style={{ color: theme.accentText }}>
                {isEn ? '05 · Frequently Asked Questions' : '05 · أسئلة شائعة'}
              </p>
              <h2 className="text-2xl sm:text-3xl font-black">
                {isEn ? 'Everything You Need to Know Before Starting' : 'كل ما تحتاج معرفته قبل البدء'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setFeedbackSuccess(false);
                setIsFeedbackOpen(true);
              }}
              style={{ backgroundColor: theme.softSurfaceBg, borderColor: theme.borderColor, color: theme.inkColor }}
              className={`px-4 py-2 ${theme.buttonRadius} border text-xs font-black inline-flex items-center gap-1.5 cursor-pointer`}
            >
              <MessageSquare className="w-3.5 h-3.5" style={{ color: theme.accentText }} />
              <span>{isEn ? 'Share Feedback or Ideas' : 'شاركنا رأيك أو اقتراحك'}</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
                  className={`${theme.cardRadius} border overflow-hidden`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className={`w-full p-4 ${isEn ? 'text-left' : 'text-right'} flex items-center justify-between gap-3 cursor-pointer`}
                  >
                    <span className="text-xs sm:text-sm font-black">{item.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 shrink-0" style={{ color: theme.accentText }} />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0" style={{ color: theme.mutedColor }} />
                    )}
                  </button>
                  {isOpen && (
                    <div
                      className="px-4 pb-4 text-xs sm:text-sm leading-relaxed border-t pt-3"
                      style={{ color: theme.mutedColor, borderColor: theme.borderColor }}
                    >
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* 8. Quiet Editorial Footer */}
      <footer
        style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
        className="border-t py-8 px-4 sm:px-6"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
            <AlShamsBrandLogo maxWidth={112} maxHeight={28} className="h-7 w-auto object-contain" isDark={theme.isDarkTheme} />
            <span className="text-xs font-bold" style={{ color: theme.mutedColor }}>
              {isEn
                ? `© ${new Date().getFullYear()} Al-Shamsawiya Platform · All Rights Reserved`
                : `© ${new Date().getFullYear()} منظومة الشمساوية · جميع الحقوق محفوظة`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher />
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-xs font-black hover:underline cursor-pointer"
              style={{ color: theme.accentText }}
            >
              {isEn ? 'Sign In' : 'تسجيل الدخول'}
            </button>
          </div>
        </div>
      </footer>

      {/* Interactive Side Systems Drawer (Artisans & Suppliers) */}
      <LandingSystemsDrawer
        isOpen={isSystemsDrawerOpen}
        onClose={() => setIsSystemsDrawerOpen(false)}
        theme={theme}
        isEn={isEn}
        onStartArtisan={onOpenRegister}
        onStartSupplier={handleOpenSupplierRegister}
        onOpenLogin={onOpenLogin}
        onOpenMarketplace={flags.artisanMarketplaceEnabled ? onOpenMarketplace : undefined}
        onOpenSuppliersMarket={flags.suppliersMarketplaceEnabled ? onOpenSuppliersMarket : undefined}
      />

      {/* Welcome Gate Modal */}
      <AlShamsWelcomeGate
        isOpen={isWelcomeGateOpen}
        isEn={isEn}
        onEnter={() => {
          setIsWelcomeGateOpen(false);
          audioPlayerRef.current?.playTrack().catch(() => {});
        }}
        onClose={() => setIsWelcomeGateOpen(false)}
      />

      {/* Community Feedback Modal */}
      {isFeedbackOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          dir={isRTL ? 'rtl' : 'ltr'}
          onClick={() => setIsFeedbackOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor, color: theme.inkColor }}
            className={`w-full max-w-md ${theme.cardRadius} border p-5 space-y-4 shadow-2xl`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">
                {isEn ? 'Share Your Feedback or Idea with Al-Shamsawiya' : 'شاركنا رأيك أو اقتراحك في الشمساوية'}
              </h3>
              <button type="button" onClick={() => setIsFeedbackOpen(false)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {feedbackSuccess ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-black">
                  {isEn
                    ? 'Thank you! Your message has been sent to the Al-Shamsawiya team.'
                    : 'شكراً لك! وصلت رسالتك لفريق الشمساوية بنجاح.'}
                </p>
                <button
                  type="button"
                  onClick={() => setIsFeedbackOpen(false)}
                  style={{ backgroundColor: theme.accentBg, color: theme.accentInk }}
                  className={`px-5 py-2 ${theme.buttonRadius} text-xs font-black cursor-pointer`}
                >
                  {isEn ? 'Close' : 'إغلاق'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                <input
                  type="text"
                  required
                  value={feedbackName}
                  onChange={(e) => setFeedbackName(e.target.value)}
                  placeholder={isEn ? 'Your Name *' : 'الاسم *'}
                  style={{ backgroundColor: theme.softSurfaceBg, borderColor: theme.borderColor, color: theme.inkColor }}
                  className={`w-full h-10 px-3 ${theme.buttonRadius} border text-xs font-bold`}
                />
                <input
                  type="text"
                  value={feedbackCraft}
                  onChange={(e) => setFeedbackCraft(e.target.value)}
                  placeholder={isEn ? 'Your craft or supply specialty (optional)' : 'حرفتك أو نشاط التوريد (اختياري)'}
                  style={{ backgroundColor: theme.softSurfaceBg, borderColor: theme.borderColor, color: theme.inkColor }}
                  className={`w-full h-10 px-3 ${theme.buttonRadius} border text-xs font-bold`}
                />
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      className="p-1 cursor-pointer"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= feedbackRating ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  required
                  rows={3}
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder={isEn ? 'Write your feedback or suggestion here *' : 'اكتب ملاحظتك أو اقتراحك هنا *'}
                  style={{ backgroundColor: theme.softSurfaceBg, borderColor: theme.borderColor, color: theme.inkColor }}
                  className={`w-full p-3 ${theme.buttonRadius} border text-xs font-bold`}
                />
                <input
                  type="text"
                  value={feedbackContact}
                  onChange={(e) => setFeedbackContact(e.target.value)}
                  placeholder={isEn ? 'WhatsApp number or email (optional)' : 'رقم واتساب أو بريد للتواصل (اختياري)'}
                  style={{ backgroundColor: theme.softSurfaceBg, borderColor: theme.borderColor, color: theme.inkColor }}
                  className={`w-full h-10 px-3 ${theme.buttonRadius} border text-xs font-bold`}
                />
                <button
                  type="submit"
                  disabled={feedbackSubmitting}
                  style={{ backgroundColor: theme.accentBg, color: theme.accentInk }}
                  className={`w-full py-2.5 ${theme.buttonRadius} text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isEn
                      ? feedbackSubmitting
                        ? 'Sending...'
                        : 'Send Message'
                      : feedbackSubmitting
                      ? 'جاري الإرسال...'
                      : 'إرسال الرسالة'}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* شموسة التفاعلية الأوفلاين لصفحة الهبوط — تظهر من أول دقيقة بدون استهلاك AI */}
      <ShamousaLandingWidget
        activeFilter={shamousaLandingFilter}
        onApplyFilter={setShamousaLandingFilter}
        onNavigateAction={(action) => {
          if (action === 'register_supplier') handleOpenSupplierRegister();
          else if (action === 'open_marketplace') onOpenMarketplace?.();
          else if (action === 'open_suppliers_market') onOpenSuppliersMarket?.();
          else if (action === 'open_login') onOpenLogin();
          else onOpenRegister();
        }}
        isPreview={isPreview}
      />
    </div>
  );
};
