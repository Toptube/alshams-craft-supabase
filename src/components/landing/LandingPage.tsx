import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
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
import { LanguageSwitcher } from '../layout/LanguageSwitcher';
import { useTranslation } from '../../lib/i18n';
import { ArtisanSkillAssessment } from '../auth/ArtisanSkillAssessment';
import { ArtisanSkillLevel, getSkillLevelMeta } from '../../types/artisanGrowth';
import { syncGrowthHubConfigFromCloud } from '../../db/memberProfileService';
import { LANDING_COPY, LandingLocale } from './landingExperienceData';
import { GuidedDiscoverySection } from './GuidedDiscoverySection';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Calculator,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Cpu,
  FolderArchive,
  GraduationCap,
  HeartHandshake,
  Layers,
  MapPin,
  Menu,
  MessageSquare,
  Moon,
  PlayCircle,
  Send,
  Share2,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Sun,
  Truck,
  Users,
  Wallet,
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

interface AccentTokens {
  primaryBtn: string;
  primaryText: string;
  hoverText: string;
  primaryBorder: string;
  softSurface: string;
  activeTab: string;
}

const ACCENT_MAP: Record<LandingAccentTheme, AccentTokens> = {
  solar_orange: {
    primaryBtn: 'bg-[#EA580C] hover:bg-[#C2410C] text-white',
    primaryText: 'text-[#C2410C] dark:text-[#FBBF24]',
    hoverText: 'hover:text-[#C2410C] dark:hover:text-[#FBBF24]',
    primaryBorder: 'border-[#EA580C]/45 dark:border-[#FBBF24]/45',
    softSurface: 'bg-[#EA580C]/10 dark:bg-[#FBBF24]/12',
    activeTab: 'bg-[#EA580C] text-white',
  },
  emerald_craft: {
    primaryBtn: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    primaryText: 'text-emerald-700 dark:text-emerald-400',
    hoverText: 'hover:text-emerald-700 dark:hover:text-emerald-400',
    primaryBorder: 'border-emerald-600/45 dark:border-emerald-400/45',
    softSurface: 'bg-emerald-600/10 dark:bg-emerald-400/12',
    activeTab: 'bg-emerald-700 text-white',
  },
  royal_indigo: {
    primaryBtn: 'bg-indigo-700 hover:bg-indigo-800 text-white',
    primaryText: 'text-indigo-700 dark:text-indigo-400',
    hoverText: 'hover:text-indigo-700 dark:hover:text-indigo-400',
    primaryBorder: 'border-indigo-600/45 dark:border-indigo-400/45',
    softSurface: 'bg-indigo-600/10 dark:bg-indigo-400/12',
    activeTab: 'bg-indigo-700 text-white',
  },
  crimson_clay: {
    primaryBtn: 'bg-[#9F1239] hover:bg-[#881337] text-white',
    primaryText: 'text-[#9F1239] dark:text-rose-400',
    hoverText: 'hover:text-[#9F1239] dark:hover:text-rose-400',
    primaryBorder: 'border-[#9F1239]/45 dark:border-rose-400/45',
    softSurface: 'bg-[#9F1239]/10 dark:bg-rose-400/12',
    activeTab: 'bg-[#9F1239] text-white',
  },
};

const FAMILY_ELEMENT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  profiles: Users,
  gallery: ShoppingBag,
  posts: MessageSquare,
  levels: Award,
  lessons: PlayCircle,
  experts: GraduationCap,
};

const JOURNEY_STEP_ICONS = [
  Camera,
  Sparkles,
  Calculator,
  SlidersHorizontal,
  ShieldCheck,
  FolderArchive,
  BookOpen,
  Store,
  Share2,
];

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
  const prefersReducedMotion = useReducedMotion();
  const { lang, dir } = useTranslation();
  const locale: LandingLocale = lang === 'ar' || dir === 'rtl' ? 'ar' : 'en';
  const copy = LANDING_COPY[locale];
  const isRTL = locale === 'ar';
  const DirectionalArrow = isRTL ? ArrowLeft : ArrowRight;

  const [isWelcomeGateOpen, setIsWelcomeGateOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [liveCms, setLiveCms] = useState<LandingCmsConfig>(() => getStoredLandingCmsConfig());
  const flags = useFeatureFlags();

  const cms = previewCmsOverride || liveCms;
  const design = cms.designConfig;
  const activePreset: LandingLayoutPreset = design?.activePreset || 'editorial_craft';
  const accentKey: LandingAccentTheme = design?.accentTheme || 'solar_orange';
  const accent = ACCENT_MAP[accentKey] || ACCENT_MAP.solar_orange;

  // Interactive sections state
  const [activeCycleNode, setActiveCycleNode] = useState<'supplier' | 'artisan' | 'customer'>('artisan');
  const [workbenchTab, setWorkbenchTab] = useState<'simulator' | 'summary'>('simulator');
  const [simId, setSimId] = useState<
    'shamousa_or' | 'falcon_macrame' | 'falcon_soap' | 'shamousa_summary' | 'shamousa_stock'
  >('shamousa_or');
  const [summaryMode, setSummaryMode] = useState<'workshop' | 'supplier'>('workshop');
  const [activeJourneyStep, setActiveJourneyStep] = useState<number>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [materialsImgFailed, setMaterialsImgFailed] = useState(false);
  const [supplierImgFailed, setSupplierImgFailed] = useState(false);

  // Family Table skill preview state
  const [landingSkillLevel, setLandingSkillLevel] = useState<ArtisanSkillLevel>('intermediate');
  const [landingSkillScore, setLandingSkillScore] = useState<number | undefined>(undefined);
  const [previewGender, setPreviewGender] = useState<'male' | 'female'>('male');

  // Live Marketplace real data
  const [liveProducts, setLiveProducts] = useState<LiveMarketProduct[]>([]);
  const [liveSuppliers, setLiveSuppliers] = useState<LiveSupplierEntry[]>([]);
  const [marketsLoaded, setMarketsLoaded] = useState(false);

  // Feedback modal state (wired to real POST /api/public/feedback)
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackCraft, setFeedbackCraft] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Sync CMS & Growth config from cloud
  useEffect(() => {
    if (previewCmsOverride) return;
    const syncCms = () => setLiveCms(getStoredLandingCmsConfig());
    syncPlatformSettingsFromCloud()
      .then(() => setLiveCms(getStoredLandingCmsConfig()))
      .catch(() => {});
    syncGrowthHubConfigFromCloud().catch(() => {});
    window.addEventListener('alshams_landing_cms_updated', syncCms);
    return () => window.removeEventListener('alshams_landing_cms_updated', syncCms);
  }, [previewCmsOverride]);

  // Fetch real public marketplace previews safely (only for enabled marketplaces)
  useEffect(() => {
    if (isPreview) return;
    const controller = new AbortController();
    let mounted = true;

    const loadLiveMarkets = async () => {
      try {
        const requests: Promise<any>[] = [
          flags.artisanMarketplaceEnabled
            ? fetch('/api/marketplace/products', { signal: controller.signal }).then((r) =>
                r.ok ? r.json() : null
              )
            : Promise.resolve(null),
          flags.suppliersMarketplaceEnabled
            ? fetch('/api/suppliers-market', { signal: controller.signal }).then((r) =>
                r.ok ? r.json() : null
              )
            : Promise.resolve(null),
        ];

        const [prodRes, supRes] = await Promise.allSettled(requests);
        if (!mounted) return;

        if (prodRes.status === 'fulfilled' && prodRes.value && Array.isArray(prodRes.value.products)) {
          const validProducts = prodRes.value.products
            .filter((p: any) => p && p.product_name && p.store_slug)
            .slice(0, 3)
            .map((p: any) => ({
              id: String(p.id || p.product_name),
              brand_name: String(p.brand_name || p.artist_name || ''),
              artist_name: p.artist_name ? String(p.artist_name) : undefined,
              store_slug: String(p.store_slug),
              product_name: String(p.product_name),
              craft_name: p.craft_name ? String(p.craft_name) : undefined,
              category: p.category ? String(p.category) : undefined,
              store_price: Number(p.store_price || p.retail_price || 0) || undefined,
              retail_price: Number(p.retail_price || 0) || undefined,
              image_url: typeof p.image_url === 'string' && p.image_url.trim() ? p.image_url : null,
            }));
          setLiveProducts(validProducts);
        }

        if (supRes.status === 'fulfilled' && supRes.value && Array.isArray(supRes.value.entries)) {
          const validSuppliers = supRes.value.entries
            .map((e: any) => e?.supplier || e)
            .filter((s: any) => s && (s.brand_name || s.owner_name))
            .slice(0, 3)
            .map((s: any) => ({
              id: String(s.id || s.store_slug || s.brand_name),
              brand_name: String(s.brand_name || s.owner_name || ''),
              owner_name: s.owner_name ? String(s.owner_name) : undefined,
              governorate: s.governorate ? String(s.governorate) : undefined,
              store_slug: s.store_slug ? String(s.store_slug) : undefined,
              logo_url: typeof s.logo_url === 'string' && s.logo_url.trim() ? s.logo_url : null,
            }));
          setLiveSuppliers(validSuppliers);
        }
      } catch {
        // Silent graceful fallback
      } finally {
        if (mounted) setMarketsLoaded(true);
      }
    };

    loadLiveMarkets();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isPreview, flags.artisanMarketplaceEnabled, flags.suppliersMarketplaceEnabled]);

  useEffect(() => {
    setHeroImgFailed(false);
  }, [design?.heroImageUrl]);

  useEffect(() => {
    setMaterialsImgFailed(false);
  }, [design?.materialsImageUrl]);

  useEffect(() => {
    setSupplierImgFailed(false);
  }, [design?.supplierImageUrl]);

  // Close mobile drawer or feedback modal on Escape
  useEffect(() => {
    if (!isMobileMenuOpen && !isFeedbackModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        setIsFeedbackModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileMenuOpen, isFeedbackModalOpen]);

  // Real route navigation helpers
  const handleOpenMarketplace = () => {
    setIsMobileMenuOpen(false);
    if (!flags.artisanMarketplaceEnabled) return;
    if (onOpenMarketplace) {
      onOpenMarketplace();
      return;
    }
    window.location.hash = '#/market';
  };

  const handleOpenSuppliersMarket = () => {
    setIsMobileMenuOpen(false);
    if (!flags.suppliersMarketplaceEnabled) return;
    if (onOpenSuppliersMarket) {
      onOpenSuppliersMarket();
      return;
    }
    window.location.hash = '#/suppliers-market';
  };

  const handleOpenStore = (slug: string) => {
    if (!slug) return;
    if (onOpenStore) {
      onOpenStore(slug);
      return;
    }
    window.location.hash = `#/store/${encodeURIComponent(slug)}`;
  };

  const handleOpenSupplierStore = (slug?: string) => {
    if (!slug) {
      handleOpenSuppliersMarket();
      return;
    }
    if (onOpenSupplierStore) {
      onOpenSupplierStore(slug);
      return;
    }
    window.location.hash = `#/supplier/${encodeURIComponent(slug)}`;
  };

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    const cleanId = id.replace(/^#/, '');
    const el = document.getElementById(cleanId);
    if (el) {
      el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  };

  const handleStartWithSkillLevel = (overrideLevel?: ArtisanSkillLevel) => {
    const levelToStore = overrideLevel || landingSkillLevel;
    try {
      localStorage.setItem('alshams_pending_skill_level', levelToStore);
      if (!overrideLevel && typeof landingSkillScore === 'number') {
        localStorage.setItem('alshams_pending_skill_score', String(landingSkillScore));
      }
    } catch {}
    onOpenRegister();
  };

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
    setFeedbackError(null);
    try {
      const res = await fetch('/api/public/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: feedbackName.trim(),
          craft: feedbackCraft.trim() || (isRTL ? 'حرفي في الشمساوية' : 'alSHamsawiyah Maker'),
          rating: feedbackRating,
          message: feedbackMessage.trim(),
          contact: feedbackContact.trim(),
          source: 'landing',
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
        }, 1900);
      } else {
        setFeedbackError(copy.feedbackModal.errorBody);
      }
    } catch {
      setFeedbackError(copy.feedbackModal.errorBody);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Custom Injected Template Dispatch (Preserves Super Admin CMS custom HTML/CSS mode 100%)
  const injected = design?.injectedTemplate;
  if (activePreset === 'custom_injected' && injected?.enabled && injected.html.trim().length > 0) {
    return (
      <div className="min-h-screen w-full" dir={isRTL ? 'rtl' : 'ltr'}>
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

  // Preset-driven surface tuning
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

  const dividerBorderClass = isObsidianPreset
    ? 'border-[#1D2D52]'
    : 'border-[#D4CCBC]/80 dark:border-[#1E2E52]';

  const heroImageSrc = design?.heroImageUrl || DEFAULT_LANDING_MEDIA.heroImageUrl;
  const materialsImageSrc = design?.materialsImageUrl || DEFAULT_LANDING_MEDIA.materialsImageUrl;
  const supplierImageSrc = design?.supplierImageUrl || DEFAULT_LANDING_MEDIA.supplierImageUrl;

  const visibleNav = copy.nav.filter((lnk) => {
    if (lnk.id === 'family-table' && !flags.familyCommunityEnabled) return false;
    return true;
  });

  const currentCycle =
    copy.marketsSection.cycleNodes.find((n) => n.id === activeCycleNode) ||
    copy.marketsSection.cycleNodes[1];

  const currentSim =
    copy.simulatorScenarios.find((s) => s.id === simId) || copy.simulatorScenarios[0];
  const activeStep = copy.journeySection.steps[activeJourneyStep] || copy.journeySection.steps[0];
  const ActiveStepIcon = JOURNEY_STEP_ICONS[activeJourneyStep] || Sparkles;

  const selectedLevelMeta = getSkillLevelMeta(landingSkillLevel, previewGender);
  const cmsReviews = cms.sections.reviews?.items?.length
    ? cms.sections.reviews.items
    : DEFAULT_LANDING_CMS_CONFIG.sections.reviews.items;
  const cmsFaqs = cms.sections.faq?.items?.length
    ? cms.sections.faq.items
    : DEFAULT_LANDING_CMS_CONFIG.sections.faq.items;
  const cmsFooter = cms.sections.footer || DEFAULT_LANDING_CMS_CONFIG.sections.footer;

  const revealInitial = prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 };
  const revealAnimate = { opacity: 1, y: 0 };
  const revealTransition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`min-h-screen font-sans selection:bg-[#EA580C]/20 selection:text-[#0C1427] dark:selection:text-[#F7F3EA] transition-colors duration-300 ${pageCanvasClass}`}
    >
      {/* بوابة الترحيب التفاعلية بالنشيد */}
      {!isPreview && (
        <AlShamsWelcomeGate
          isOpen={isWelcomeGateOpen}
          onClose={() => setIsWelcomeGateOpen(false)}
          onEnter={handleGateEnter}
        />
      )}

      {/* ==================== 1. الشريط العلوي المتزن (3-Zone Header + Mobile Drawer) ==================== */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
          isObsidianPreset
            ? 'bg-[#080E1E]/92 border-[#1D2D52]'
            : 'bg-[#F2ECE1]/92 dark:bg-[#060B18]/92 border-[#D4CCBC] dark:border-[#1E2E52]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[74px] flex items-center justify-between gap-3">
          {/* Zone 1: Brand Identity */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
            }}
            className="flex items-center gap-2.5 shrink-0 focus:outline-none"
            aria-label={isRTL ? 'منظومة الشمساوية' : 'alSHamsawiyah'}
          >
            <AlShamsFalconEmblem size={36} isDark={isObsidianPreset || isDarkMode} />
            <AlShamsBrandLogo isDark={isObsidianPreset || isDarkMode} className="h-9 sm:h-10" />
          </a>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav
            aria-label={isRTL ? 'التنقل الرئيسي' : 'Primary Navigation'}
            className="hidden lg:flex items-center gap-6 xl:gap-7"
          >
            {visibleNav.map((lnk) => (
              <a
                key={lnk.id}
                href={lnk.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(lnk.href);
                }}
                className={`text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${
                  isObsidianPreset
                    ? 'text-[#CBD5E1] hover:text-[#FBBF24]'
                    : `text-[#334155] dark:text-[#CBD5E1] ${accent.hoverText}`
                }`}
              >
                {lnk.label}
              </a>
            ))}
          </nav>

          {/* Zone 3: Utilities + Language + Theme + Auth CTAs */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isPreview && (
              <div className="hidden md:block">
                <AlShamsAudioPlayer ref={audioPlayerRef} />
              </div>
            )}

            {!isPreview && (
              <div className="hidden xl:block">
                <PWAInstallButton compact />
              </div>
            )}

            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>

            {onToggleTheme && !isObsidianPreset && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={isDarkMode ? copy.header.themeLight : copy.header.themeDark}
                title={isDarkMode ? copy.header.themeLight : copy.header.themeDark}
                className="w-9 h-9 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center text-[#334155] dark:text-[#CBD5E1] hover:border-[#EA580C] transition cursor-pointer"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-[#FBBF24]" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenLogin}
              className={`hidden sm:inline-flex items-center px-3 py-2 text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                isObsidianPreset
                  ? 'text-[#E2E8F0] hover:text-[#FBBF24]'
                  : `text-[#0C1427] dark:text-[#F7F3EA] ${accent.hoverText}`
              }`}
            >
              {copy.header.login}
            </button>

            <button
              type="button"
              onClick={onOpenRegister}
              className={`px-3.5 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap shrink-0 transition cursor-pointer shadow-xs ${accent.primaryBtn}`}
            >
              {copy.header.startJourney}
            </button>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label={copy.header.openMenu}
              className="lg:hidden w-9 h-9 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden flex"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div
              className="fixed inset-0 bg-[#060B18]/70 backdrop-blur-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: isRTL ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '100%' : '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className={`relative z-10 w-[86%] max-w-sm h-full overflow-y-auto p-5 flex flex-col justify-between gap-6 border-e shadow-2xl ${
                isObsidianPreset
                  ? 'bg-[#080E1E] border-[#1D2D52] text-[#F7F3EA]'
                  : 'bg-[#F7F3EA] dark:bg-[#0B1328] border-[#D4CCBC] dark:border-[#1E2E52] text-[#0C1427] dark:text-[#F7F3EA]'
              }`}
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#D4CCBC] dark:border-[#1E2E52]">
                  <div className="flex items-center gap-2">
                    <AlShamsFalconEmblem size={30} isDark={isObsidianPreset || isDarkMode} />
                    <AlShamsBrandLogo isDark={isObsidianPreset || isDarkMode} className="h-8" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-label={copy.header.closeMenu}
                    className="w-9 h-9 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                <nav className="space-y-1.5">
                  {visibleNav.map((lnk) => (
                    <button
                      key={lnk.id}
                      type="button"
                      onClick={() => scrollToSection(lnk.href)}
                      className="w-full px-3.5 py-3 rounded-xl text-sm font-black text-start flex items-center justify-between hover:bg-[#EA580C]/10 transition cursor-pointer"
                    >
                      <span>{lnk.label}</span>
                      <DirectionalArrow className="w-4 h-4 opacity-50" />
                    </button>
                  ))}
                </nav>

                {(flags.artisanMarketplaceEnabled || flags.suppliersMarketplaceEnabled) && (
                  <div className="pt-4 border-t border-[#D4CCBC] dark:border-[#1E2E52] space-y-2">
                    <p className={`text-[11px] font-extrabold px-1 ${mutedTextClass}`}>
                      {copy.header.marketsQuickTitle}
                    </p>
                    {flags.artisanMarketplaceEnabled && (
                      <button
                        type="button"
                        onClick={handleOpenMarketplace}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-black flex items-center justify-between cursor-pointer ${surfaceCardClass}`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Store className="w-4 h-4 text-[#EA580C]" />
                          {copy.header.alshamsMarket}
                        </span>
                        <DirectionalArrow className="w-3.5 h-3.5 opacity-60" />
                      </button>
                    )}
                    {flags.suppliersMarketplaceEnabled && (
                      <button
                        type="button"
                        onClick={handleOpenSuppliersMarket}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-black flex items-center justify-between cursor-pointer ${surfaceCardClass}`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Truck className="w-4 h-4 text-[#EA580C]" />
                          {copy.header.suppliersMarket}
                        </span>
                        <DirectionalArrow className="w-3.5 h-3.5 opacity-60" />
                      </button>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-[#D4CCBC] dark:border-[#1E2E52] flex flex-wrap items-center gap-2.5">
                  <LanguageSwitcher />
                  {!isPreview && <AlShamsAudioPlayer ref={audioPlayerRef} />}
                  {!isPreview && <PWAInstallButton compact />}
                </div>

                {!isPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsWelcomeGateOpen(true);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-start flex items-center gap-2 ${accent.softSurface} ${accent.primaryText} cursor-pointer`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{copy.header.welcomeGateShort}</span>
                  </button>
                )}
              </div>

              <div className="pt-4 border-t border-[#D4CCBC] dark:border-[#1E2E52] grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenLogin();
                  }}
                  className="px-4 py-3 rounded-xl border border-[#C9BFA9] dark:border-[#2A3F6E] text-xs font-black cursor-pointer"
                >
                  {copy.header.login}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenRegister();
                  }}
                  className={`px-4 py-3 rounded-xl text-xs font-black cursor-pointer ${accent.primaryBtn}`}
                >
                  {copy.header.startJourney}
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 2. القسم الافتتاحي (Hero Section) ==================== */}
      <main id="top">
        <section className={`relative overflow-hidden border-b ${dividerBorderClass}`}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-36 start-1/4 w-[520px] h-[520px] rounded-full bg-[#EA580C]/10 dark:bg-[#EA580C]/12 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-36 end-10 w-[440px] h-[440px] rounded-full bg-[#0C1427]/8 dark:bg-[#FBBF24]/8 blur-3xl"
          />

          <div
            className={`relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${
              isConversionPreset
                ? 'pt-8 pb-10 sm:pt-12 sm:pb-14'
                : 'pt-10 pb-12 sm:pt-14 sm:pb-16 lg:pt-16 lg:pb-20'
            }`}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* Editorial Value Proposition Column */}
              <motion.div
                initial={revealInitial}
                animate={revealAnimate}
                transition={revealTransition}
                className={`${isConversionPreset ? 'lg:col-span-7' : 'lg:col-span-6'} flex flex-col justify-center space-y-5 sm:space-y-6`}
              >
                <p className={`text-xs sm:text-sm font-extrabold tracking-wide ${accent.primaryText}`}>
                  {copy.hero.eyebrow}
                </p>

                <h1 className="text-3xl sm:text-4xl lg:text-[3.05rem] font-black leading-[1.18] tracking-tight [text-wrap:balance]">
                  <span className="block">{copy.hero.headlineLine1}</span>
                  <span className={`block mt-1.5 ${accent.primaryText}`}>
                    {copy.hero.headlineHighlight}
                  </span>
                </h1>

                <div className="space-y-2 max-w-2xl">
                  <p className={`text-sm sm:text-base lg:text-[17px] leading-[1.85] ${mutedTextClass}`}>
                    {copy.hero.description}
                  </p>
                  <p className="text-xs sm:text-sm font-black">{copy.hero.companionLine}</p>
                </div>

                {/* 3 Direct Interactive CTAs */}
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => scrollToSection('guided-discovery')}
                    className={`px-6 py-3.5 rounded-xl text-sm sm:text-base font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-sm ${accent.primaryBtn}`}
                  >
                    <Compass className="w-4 h-4" />
                    <span>{copy.hero.ctaDiscoverRole}</span>
                    <DirectionalArrow className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={onOpenRegister}
                    className={`px-6 py-3.5 rounded-xl text-sm sm:text-base font-black border flex items-center justify-center gap-2 transition cursor-pointer ${
                      isObsidianPreset
                        ? 'bg-[#122042] border-[#294072] text-[#F7F3EA] hover:border-[#FBBF24]'
                        : 'bg-[#0C1427] text-[#F7F3EA] border-[#0C1427] hover:bg-[#162344] dark:bg-[#F7F3EA] dark:text-[#0C1427] dark:border-[#F7F3EA] dark:hover:bg-[#E7DFCE]'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-[#FBBF24] dark:text-[#EA580C]" />
                    <span>{copy.hero.ctaStartJourney}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenLogin}
                    className={`px-5 py-3.5 rounded-xl text-sm font-black border flex items-center justify-center gap-2 transition cursor-pointer ${
                      isObsidianPreset
                        ? 'border-[#294072] text-[#CBD5E1] hover:border-[#FBBF24] hover:text-white'
                        : 'bg-[#F7F3EA]/80 dark:bg-[#0D162E] border-[#C9BFA9] dark:border-[#2A3F6E] hover:border-[#EA580C]'
                    }`}
                  >
                    <span>{copy.hero.ctaEnterWorld}</span>
                  </button>
                </div>

                {/* Clean Single Trust Line */}
                <div
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs sm:text-[13px] font-bold ${mutedTextClass}`}
                >
                  {copy.hero.trustLine.map((item, idx) => (
                    <React.Fragment key={item}>
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        {item}
                      </span>
                      {idx < copy.hero.trustLine.length - 1 && (
                        <span aria-hidden="true" className="opacity-35 hidden sm:inline">
                          ·
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {!isPreview && (
                  <div className="pt-0.5 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setIsWelcomeGateOpen(true)}
                      className={`text-xs font-extrabold underline underline-offset-4 cursor-pointer inline-flex items-center gap-1.5 ${accent.primaryText}`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{copy.hero.welcomeGateLink}</span>
                    </button>
                  </div>
                )}
              </motion.div>

              {/* Editorial Craft Scene + Original Falcon & Shamousa Mascots */}
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                className={`${isConversionPreset ? 'lg:col-span-5' : 'lg:col-span-6'}`}
              >
                <div
                  className={`relative w-full min-h-[360px] sm:min-h-[455px] rounded-3xl overflow-hidden border shadow-xl flex flex-col justify-between ${surfaceCardClass}`}
                >
                  {!heroImgFailed ? (
                    <img
                      src={heroImageSrc}
                      alt={
                        isRTL
                          ? 'مشهد يجمع الحِرفة اليدوية والتجارة والتكنولوجيا في منظومة الشمساوية'
                          : 'Artisan craft, commerce and technology united in alSHamsawiyah'
                      }
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1A2B54] via-[#0D162E] to-[#431407]" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-[#060B18]/92 via-[#060B18]/25 to-[#060B18]/30" />

                  <div className="relative z-10 p-4 sm:p-6 flex items-center justify-between gap-3">
                    <span className="text-xs font-black text-[#F7F3EA]/95 tracking-wide drop-shadow-xs">
                      {copy.hero.visualCaptionTop}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#FBBF24] bg-[#060B18]/65 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/15">
                      alSHamsawiyah
                    </span>
                  </div>

                  <div className="relative z-10 p-4 sm:p-6 space-y-4">
                    <div className="flex items-end justify-between gap-4">
                      <motion.div
                        animate={prefersReducedMotion ? undefined : { y: [0, -5, 0] }}
                        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="flex flex-col items-center"
                      >
                        <div className="w-24 h-24 sm:w-32 sm:h-32 flex items-end justify-center">
                          <FalconMascotFull isDark height="100%" className="w-full h-full" />
                        </div>
                        <span className="mt-1 px-2.5 py-0.5 rounded-lg bg-[#060B18]/80 backdrop-blur-sm border border-[#FBBF24]/35 text-[11px] font-black text-[#FBBF24]">
                          {copy.hero.falconCaption}
                        </span>
                      </motion.div>

                      <motion.div
                        animate={prefersReducedMotion ? undefined : { y: [0, -5, 0] }}
                        transition={{ duration: 4.2, delay: 0.6, repeat: Infinity, ease: 'easeInOut' }}
                        className="flex flex-col items-center"
                      >
                        <div className="w-24 h-24 sm:w-32 sm:h-32 flex items-end justify-center">
                          <ShamousaMascotFull isDark height="100%" className="w-full h-full" />
                        </div>
                        <span className="mt-1 px-2.5 py-0.5 rounded-lg bg-[#060B18]/80 backdrop-blur-sm border border-[#FBBF24]/35 text-[11px] font-black text-[#FBBF24]">
                          {copy.hero.shamousaCaption}
                        </span>
                      </motion.div>
                    </div>

                    <div className="rounded-2xl bg-[#081024]/82 backdrop-blur-md border border-white/15 p-3.5 sm:p-4">
                      <p className="text-xs sm:text-sm font-black text-white leading-snug">
                        {copy.hero.visualCaptionBottomTitle}
                      </p>
                      <p className="text-[11px] sm:text-xs text-[#CBD5E1] mt-1 leading-relaxed">
                        {copy.hero.visualCaptionBottomSub}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* 4 Factual Architectural Pillars (Zero Unverified Numbers) */}
            <div
              className={`mt-10 sm:mt-14 pt-8 border-t ${dividerBorderClass} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-7`}
            >
              {copy.hero.pillars.map((p) => (
                <div key={p.id} className="space-y-1.5">
                  <span className={`text-[11px] font-extrabold block ${accent.primaryText}`}>
                    {p.badge}
                  </span>
                  <div className="text-sm sm:text-[15px] font-black">{p.title}</div>
                  <p className={`text-xs leading-relaxed ${mutedTextClass}`}>{p.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== 3. تجربة اكتشاف الزائر (5-Role Guided Discovery) ==================== */}
        <GuidedDiscoverySection
          copy={copy.discovery}
          isRTL={isRTL}
          isObsidianPreset={isObsidianPreset}
          surfaceCardClass={surfaceCardClass}
          mutedTextClass={mutedTextClass}
          dividerBorderClass={dividerBorderClass}
          accent={accent}
          flags={flags}
          onOpenLogin={onOpenLogin}
          onOpenRegister={onOpenRegister}
          onOpenRegisterSupplier={onOpenRegisterSupplier}
          onOpenMarketplace={handleOpenMarketplace}
          onOpenSuppliersMarket={handleOpenSuppliersMarket}
          onStartBeginner={() => handleStartWithSkillLevel('beginner')}
          onExploreExpertInFamily={() => {
            setLandingSkillLevel('expert_trainer');
            scrollToSection('family-table');
          }}
          onExploreFamily={() => scrollToSection('family-table')}
        />

        {/* ==================== 4. سوق الشمساوية وسوق الموردين (Connected Two-Market Ecosystem) ==================== */}
        <section id="markets" className={`py-16 sm:py-24 border-b ${dividerBorderClass}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
            <motion.div
              initial={revealInitial}
              whileInView={revealAnimate}
              viewport={{ once: true, amount: 0.2 }}
              transition={revealTransition}
              className="max-w-3xl space-y-3"
            >
              <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                {copy.marketsSection.eyebrow}
              </p>
              <h2 className="text-2xl sm:text-4xl font-black leading-tight [text-wrap:balance]">
                {copy.marketsSection.title}
              </h2>
              <p className={`text-sm sm:text-base leading-relaxed ${mutedTextClass}`}>
                {copy.marketsSection.subtitle}
              </p>
            </motion.div>

            {/* Interactive 3-Node Connected Economy Cycle */}
            <div className={`rounded-3xl border p-5 sm:p-7 space-y-5 ${surfaceCardClass}`}>
              <p className={`text-xs sm:text-sm font-black ${accent.primaryText}`}>
                {copy.marketsSection.cycleTitle}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {copy.marketsSection.cycleNodes.map((node) => {
                  const isActive = activeCycleNode === node.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setActiveCycleNode(node.id)}
                      className={`rounded-2xl border p-4 text-start transition-all cursor-pointer space-y-1.5 ${
                        isActive
                          ? 'bg-[#0C1427] text-[#F7F3EA] border-[#EA580C] shadow-md'
                          : isObsidianPreset
                            ? 'bg-[#091124] border-[#21335C] hover:border-[#FBBF24]/60'
                            : 'bg-[#EFE9DC]/65 dark:bg-[#091124] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-mono font-black ${
                            isActive ? 'text-[#FBBF24]' : accent.primaryText
                          }`}
                        >
                          {node.step}
                        </span>
                        <span
                          className={`text-[11px] font-extrabold ${
                            isActive ? 'text-[#CBD5E1]' : mutedTextClass
                          }`}
                        >
                          {node.role}
                        </span>
                      </div>
                      <div className="text-sm sm:text-[15px] font-black leading-snug">{node.title}</div>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentCycle.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isObsidianPreset
                      ? 'bg-[#091124] border-[#21335C]'
                      : 'bg-white/75 dark:bg-[#091124] border-[#D4CCBC] dark:border-[#22355E]'
                  }`}
                >
                  <p className="text-xs sm:text-sm font-bold leading-relaxed">
                    <span className={`${accent.primaryText} font-black`}>{currentCycle.role}: </span>
                    {currentCycle.detail}
                  </p>
                  <span className="text-[11px] font-mono font-black opacity-50 shrink-0">
                    {isRTL ? 'المورد ← الفنان ← العميل' : 'Supplier → Artisan → Customer'}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Two Market Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
              {/* Marketplace 1: سوق الشمساوية */}
              <motion.div
                initial={revealInitial}
                whileInView={revealAnimate}
                viewport={{ once: true, amount: 0.15 }}
                transition={revealTransition}
                className={`rounded-3xl border p-6 sm:p-8 flex flex-col justify-between gap-6 ${surfaceCardClass}`}
              >
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <span className={`text-xs font-extrabold ${accent.primaryText}`}>
                        {copy.marketsSection.alshamsMarket.badge}
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-black">
                        {copy.marketsSection.alshamsMarket.title}
                      </h3>
                      <p className="text-sm sm:text-base font-bold">
                        {copy.marketsSection.alshamsMarket.tagline}
                      </p>
                    </div>
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${accent.softSurface} ${accent.primaryText}`}
                    >
                      <Store className="w-6 h-6" />
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-xs sm:text-sm">
                    {copy.marketsSection.alshamsMarket.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span className={mutedTextClass}>{b}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Live Real Products Preview (only when artisanMarketplaceEnabled & real items exist) */}
                  {flags.artisanMarketplaceEnabled && liveProducts.length > 0 ? (
                    <div className="space-y-2.5 pt-2">
                      <span className={`text-[11px] font-extrabold block ${accent.primaryText}`}>
                        {copy.marketsSection.alshamsMarket.liveBadge}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {liveProducts.map((prod) => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => handleOpenStore(prod.store_slug)}
                            className={`rounded-2xl border p-2.5 text-start transition hover:border-[#EA580C] cursor-pointer flex flex-col justify-between gap-2 ${
                              isObsidianPreset
                                ? 'bg-[#091124] border-[#21335C]'
                                : 'bg-[#EFE9DC]/65 dark:bg-[#091124] border-[#D4CCBC] dark:border-[#22355E]'
                            }`}
                          >
                            {prod.image_url ? (
                              <img
                                src={prod.image_url}
                                alt={prod.product_name}
                                className="w-full h-24 object-cover rounded-xl bg-[#132040]"
                              />
                            ) : (
                              <div className="w-full h-24 rounded-xl bg-gradient-to-br from-[#EA580C]/15 to-[#0C1427]/20 flex items-center justify-center">
                                <ShoppingBag className="w-6 h-6 text-[#EA580C]" />
                              </div>
                            )}
                            <div className="space-y-0.5 min-w-0">
                              <p className="text-xs font-black truncate">{prod.product_name}</p>
                              <p className={`text-[11px] truncate ${mutedTextClass}`}>{prod.brand_name}</p>
                              {prod.store_price ? (
                                <p className={`text-xs font-mono font-black ${accent.primaryText}`}>
                                  {prod.store_price.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                                </p>
                              ) : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    marketsLoaded && (
                      <div
                        className={`rounded-2xl border p-4 text-xs font-bold leading-relaxed ${
                          isObsidianPreset
                            ? 'bg-[#091124] border-[#21335C] text-[#A8B7D1]'
                            : 'bg-[#EFE9DC]/65 dark:bg-[#091124] border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#94A3B8]'
                        }`}
                      >
                        {flags.artisanMarketplaceEnabled
                          ? copy.marketsSection.alshamsMarket.emptyNote
                          : copy.marketsSection.alshamsMarket.disabledNote}
                      </div>
                    )
                  )}
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  {flags.artisanMarketplaceEnabled ? (
                    <button
                      type="button"
                      onClick={handleOpenMarketplace}
                      className={`px-6 py-3.5 rounded-xl text-sm font-black inline-flex items-center gap-2 transition cursor-pointer shadow-xs ${accent.primaryBtn}`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>{copy.marketsSection.alshamsMarket.cta}</span>
                      <DirectionalArrow className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onOpenRegister}
                      className={`px-6 py-3.5 rounded-xl text-sm font-black inline-flex items-center gap-2 transition cursor-pointer shadow-xs ${accent.primaryBtn}`}
                    >
                      <span>{copy.hero.ctaStartJourney}</span>
                      <DirectionalArrow className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>

              {/* Marketplace 2: سوق الموردين */}
              {flags.supplierLandingPromoEnabled && (
                <motion.div
                  initial={revealInitial}
                  whileInView={revealAnimate}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ ...revealTransition, delay: prefersReducedMotion ? 0 : 0.08 }}
                  className={`rounded-3xl border overflow-hidden flex flex-col justify-between ${surfaceCardClass}`}
                >
                  <div>
                    <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-[#132040]">
                      {!supplierImgFailed ? (
                        <img
                          src={supplierImageSrc}
                          alt={
                            isRTL
                              ? 'سوق الموردين والخامات في منظومة الشمساوية'
                              : 'alSHamsawiyah Raw Materials Suppliers Market'
                          }
                          referrerPolicy="no-referrer"
                          onError={() => setSupplierImgFailed(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#132040] to-[#0C1427]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0C1427]/85 via-[#0C1427]/20 to-transparent" />
                      <div className="absolute bottom-4 start-6 end-6 flex items-end justify-between gap-3">
                        <div>
                          <span className="text-xs font-extrabold text-[#FBBF24] block">
                            {copy.marketsSection.suppliersMarket.badge}
                          </span>
                          <h3 className="text-2xl sm:text-3xl font-black text-white">
                            {copy.marketsSection.suppliersMarket.title}
                          </h3>
                        </div>
                        <div className="w-11 h-11 rounded-2xl bg-[#0C1427]/80 border border-white/20 flex items-center justify-center text-[#FBBF24] shrink-0">
                          <Truck className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    <div className="p-6 sm:p-8 space-y-5">
                      <p className="text-sm sm:text-base font-bold">
                        {copy.marketsSection.suppliersMarket.tagline}
                      </p>

                      <ul className="space-y-2.5 text-xs sm:text-sm">
                        {copy.marketsSection.suppliersMarket.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span className={mutedTextClass}>{b}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Live Real Suppliers Preview (Strictly gated on flags.suppliersMarketplaceEnabled) */}
                      {flags.suppliersMarketplaceEnabled && liveSuppliers.length > 0 ? (
                        <div className="space-y-2.5 pt-1">
                          <span className={`text-[11px] font-extrabold block ${accent.primaryText}`}>
                            {copy.marketsSection.suppliersMarket.liveBadge}
                          </span>
                          <div className="space-y-2">
                            {liveSuppliers.map((sup) => (
                              <button
                                key={sup.id}
                                type="button"
                                onClick={() => handleOpenSupplierStore(sup.store_slug)}
                                className={`w-full rounded-2xl border px-3.5 py-2.5 flex items-center justify-between gap-3 text-start transition hover:border-[#EA580C] cursor-pointer ${
                                  isObsidianPreset
                                    ? 'bg-[#091124] border-[#21335C]'
                                    : 'bg-[#EFE9DC]/65 dark:bg-[#091124] border-[#D4CCBC] dark:border-[#22355E]'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {sup.logo_url ? (
                                    <img
                                      src={sup.logo_url}
                                      alt={sup.brand_name}
                                      className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 shrink-0 border border-[#D4CCBC]"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-xl bg-[#EA580C]/15 text-[#EA580C] flex items-center justify-center font-black text-sm shrink-0">
                                      {sup.brand_name.charAt(0)}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs sm:text-sm font-black truncate">
                                      {sup.brand_name}
                                    </p>
                                    {sup.governorate && (
                                      <p className={`text-[11px] flex items-center gap-1 ${mutedTextClass}`}>
                                        <MapPin className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{sup.governorate}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className={`text-[11px] font-black shrink-0 ${accent.primaryText}`}>
                                  {copy.marketsSection.suppliersMarket.viewSupplier}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        marketsLoaded && (
                          <div
                            className={`rounded-2xl border p-4 text-xs font-bold leading-relaxed ${
                              isObsidianPreset
                                ? 'bg-[#091124] border-[#21335C] text-[#A8B7D1]'
                                : 'bg-[#EFE9DC]/65 dark:bg-[#091124] border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#94A3B8]'
                            }`}
                          >
                            {flags.suppliersMarketplaceEnabled
                              ? copy.marketsSection.suppliersMarket.emptyNote
                              : copy.marketsSection.suppliersMarket.disabledNote}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex flex-wrap items-center gap-3">
                    {flags.suppliersMarketplaceEnabled ? (
                      <button
                        type="button"
                        onClick={handleOpenSuppliersMarket}
                        className="px-6 py-3.5 rounded-xl text-sm font-black inline-flex items-center gap-2 transition cursor-pointer bg-[#0C1427] hover:bg-[#19284C] text-white dark:bg-[#F7F3EA] dark:text-[#0C1427] dark:hover:bg-[#E7DFCE]"
                      >
                        <Truck className="w-4 h-4" />
                        <span>{copy.marketsSection.suppliersMarket.cta}</span>
                        <DirectionalArrow className="w-4 h-4" />
                      </button>
                    ) : (
                      flags.supplierRegistrationEnabled && (
                        <button
                          type="button"
                          onClick={onOpenRegisterSupplier || onOpenRegister}
                          className="px-6 py-3.5 rounded-xl text-sm font-black inline-flex items-center gap-2 transition cursor-pointer bg-[#0C1427] hover:bg-[#19284C] text-white dark:bg-[#F7F3EA] dark:text-[#0C1427] dark:hover:bg-[#E7DFCE]"
                        >
                          <Truck className="w-4 h-4" />
                          <span>{copy.marketsSection.suppliersMarket.portalCta}</span>
                          <DirectionalArrow className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </section>

        {/* ==================== 5. طبلية العيلة — مجتمع الشمساوية ==================== */}
        {flags.familyCommunityEnabled && (
          <section id="family-table" className={`py-16 sm:py-24 border-b ${dividerBorderClass}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
                <motion.div
                  initial={revealInitial}
                  whileInView={revealAnimate}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={revealTransition}
                  className="lg:col-span-6 space-y-6"
                >
                  <div className="space-y-3">
                    <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                      {copy.familySection.eyebrow}
                    </p>
                    <h2 className="text-2xl sm:text-4xl font-black leading-tight [text-wrap:balance]">
                      {copy.familySection.title}
                    </h2>
                    <p className={`text-base sm:text-xl font-black leading-snug ${accent.primaryText}`}>
                      «{copy.familySection.tagline}»
                    </p>
                    <p className={`text-sm sm:text-base leading-relaxed ${mutedTextClass}`}>
                      {copy.familySection.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {copy.familySection.elements.map((el) => {
                      const ElIcon = FAMILY_ELEMENT_ICON_MAP[el.id] || Users;
                      return (
                        <div key={el.id} className={`rounded-2xl border p-4 space-y-1.5 ${surfaceCardClass}`}>
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${accent.softSurface} ${accent.primaryText}`}
                            >
                              <ElIcon className="w-4 h-4" />
                            </div>
                            <h3 className="text-xs sm:text-sm font-black">{el.title}</h3>
                          </div>
                          <p className={`text-xs leading-relaxed ${mutedTextClass}`}>{el.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>

                <motion.div
                  initial={revealInitial}
                  whileInView={revealAnimate}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ ...revealTransition, delay: prefersReducedMotion ? 0 : 0.08 }}
                  className={`lg:col-span-6 rounded-3xl border p-5 sm:p-7 space-y-5 ${surfaceCardClass}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={`text-xs font-extrabold ${mutedTextClass}`}>
                      {copy.familySection.genderPrompt}
                    </span>
                    <div className="inline-flex p-1 rounded-xl bg-[#E8E0D1] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                      <button
                        type="button"
                        onClick={() => setPreviewGender('male')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                          previewGender === 'male' ? accent.activeTab : mutedTextClass
                        }`}
                      >
                        {copy.familySection.genderMale}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewGender('female')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                          previewGender === 'female' ? accent.activeTab : mutedTextClass
                        }`}
                      >
                        {copy.familySection.genderFemale}
                      </button>
                    </div>
                  </div>

                  <ArtisanSkillAssessment
                    value={landingSkillLevel}
                    gender={previewGender}
                    onChange={(lvl, score) => {
                      setLandingSkillLevel(lvl);
                      setLandingSkillScore(score);
                    }}
                  />

                  <div className="space-y-3 pt-1">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleStartWithSkillLevel()}
                        className={`flex-1 px-6 py-3.5 rounded-xl text-sm font-black inline-flex items-center justify-center gap-2 transition cursor-pointer shadow-sm ${accent.primaryBtn}`}
                      >
                        <Users className="w-4 h-4" />
                        <span>
                          {copy.familySection.ctaEnterFamily}
                          {isRTL ? ` (${selectedLevelMeta.displayTitle})` : ''}
                        </span>
                        <DirectionalArrow className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={onOpenLogin}
                        className="px-5 py-3.5 rounded-xl text-xs sm:text-sm font-black border border-[#C9BFA9] dark:border-[#2A3F6E] hover:border-[#EA580C] transition cursor-pointer"
                      >
                        {copy.header.login}
                      </button>
                    </div>

                    <p className={`text-[11px] leading-relaxed ${mutedTextClass}`}>
                      {copy.familySection.ctaNote}
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 6. أبطال الشمساوية (صقر · شموسة + بحوث العمليات OR · موسوعة الخامات) ==================== */}
        <section
          id="platform-heroes"
          className="relative py-16 sm:py-24 bg-[#0C1427] text-[#F7F3EA] border-b border-[#1E2E52] overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 end-0 w-[440px] h-[440px] rounded-full bg-[#EA580C]/10 blur-3xl"
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <motion.div
              initial={revealInitial}
              whileInView={revealAnimate}
              viewport={{ once: true, amount: 0.2 }}
              transition={revealTransition}
              className="max-w-3xl space-y-3"
            >
              <p className="text-xs sm:text-sm font-extrabold text-[#FBBF24]">
                {copy.heroesSection.eyebrow}
              </p>
              <h2 className="text-2xl sm:text-4xl font-black leading-tight text-white [text-wrap:balance]">
                {copy.heroesSection.title}
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-[#A8B7D1]">
                {copy.heroesSection.subtitle}
              </p>
            </motion.div>

            {/* Top Row: Saqr & Shamousa (with Operations Research OR Spotlight) */}
            {flags.aiAssistantsEnabled && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Hero 1: صقر الشمساوية */}
                <motion.article
                  initial={revealInitial}
                  whileInView={revealAnimate}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={revealTransition}
                  className="lg:col-span-5 rounded-3xl bg-[#111C38] border border-[#243763] p-6 sm:p-7 flex flex-col justify-between gap-6 hover:border-[#FBBF24]/50 transition-colors"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-2xl bg-[#091124] border border-[#243763] p-2 flex items-center justify-center shrink-0">
                        <FalconMascotFull isDark height="100%" className="w-full h-full" />
                      </div>
                      <div>
                        <span className="text-[11px] font-extrabold text-[#FBBF24] block">
                          {copy.heroesSection.falcon.role}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                          {copy.heroesSection.falcon.name}
                        </h3>
                      </div>
                    </div>

                    <p className="text-sm sm:text-base font-black text-[#F7F3EA] leading-snug">
                      {copy.heroesSection.falcon.tagline}
                    </p>
                    <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
                      {copy.heroesSection.falcon.description}
                    </p>

                    {/* Exact 7-Step Visual Flow */}
                    <div className="rounded-2xl bg-[#091124] border border-[#243763] p-4 space-y-2.5">
                      <span className="text-[11px] font-extrabold text-[#FBBF24] block">
                        {copy.heroesSection.falcon.workflowTitle}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {copy.heroesSection.falcon.workflowSteps.map((step, i) => (
                          <React.Fragment key={step}>
                            <span className="px-2.5 py-1 rounded-lg bg-[#111C38] border border-[#243763] text-[11px] font-black text-[#F7F3EA]">
                              {step}
                            </span>
                            {i < copy.heroesSection.falcon.workflowSteps.length - 1 && (
                              <span aria-hidden="true" className="text-[#FBBF24] font-black text-xs">
                                {isRTL ? '←' : '→'}
                              </span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#243763] text-[11px] font-bold text-[#94A3B8]">
                    {copy.heroesSection.falcon.footnote}
                  </div>
                </motion.article>

                {/* Hero 2: شموسة + نظام بحوث العمليات (Operations Research — OR) */}
                <motion.article
                  initial={revealInitial}
                  whileInView={revealAnimate}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ ...revealTransition, delay: prefersReducedMotion ? 0 : 0.08 }}
                  className="lg:col-span-7 rounded-3xl bg-[#111C38] border border-[#FBBF24]/40 p-6 sm:p-7 flex flex-col justify-between gap-6"
                >
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-24 rounded-2xl bg-[#091124] border border-[#243763] p-2 flex items-center justify-center shrink-0">
                          <ShamousaMascotFull isDark height="100%" className="w-full h-full" />
                        </div>
                        <div>
                          <span className="text-[11px] font-extrabold text-[#FBBF24] block">
                            {copy.heroesSection.shamousa.role}
                          </span>
                          <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                            {copy.heroesSection.shamousa.name}
                          </h3>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EA580C]/20 border border-[#EA580C]/50 text-[#FBBF24] text-[11px] font-black self-start sm:self-center">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>{copy.heroesSection.shamousa.orBadge}</span>
                      </span>
                    </div>

                    <p className="text-sm sm:text-base font-black text-[#F7F3EA] leading-snug">
                      {copy.heroesSection.shamousa.tagline}
                    </p>
                    <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
                      {copy.heroesSection.shamousa.description}
                    </p>

                    {/* Operations Research (OR) 4-Pillar Grid */}
                    <div className="rounded-2xl bg-[#091124] border border-[#243763] p-4 sm:p-5 space-y-3">
                      <p className="text-xs sm:text-sm font-black text-[#FBBF24]">
                        {copy.heroesSection.shamousa.orTitle}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {copy.heroesSection.shamousa.orPillars.map((pillar) => (
                          <div
                            key={pillar.title}
                            className="rounded-xl bg-[#111C38] border border-[#243763] p-3.5 space-y-1"
                          >
                            <div className="text-xs font-black text-white flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{pillar.title}</span>
                            </div>
                            <p className="text-[11px] text-[#A8B7D1] leading-relaxed">{pillar.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#243763] text-[11px] font-bold text-[#94A3B8]">
                    {copy.heroesSection.shamousa.footnote}
                  </div>
                </motion.article>
              </div>
            )}

            {/* Hero 3: موسوعة الخامات الموحدة (Full-Width Feature Card) */}
            <motion.article
              initial={revealInitial}
              whileInView={revealAnimate}
              viewport={{ once: true, amount: 0.15 }}
              transition={revealTransition}
              className="rounded-3xl bg-[#111C38] border border-[#243763] overflow-hidden grid grid-cols-1 lg:grid-cols-12"
            >
              <div className="lg:col-span-5 relative min-h-[240px] bg-[#091124]">
                {!materialsImgFailed ? (
                  <img
                    src={materialsImageSrc}
                    alt={
                      isRTL
                        ? 'موسوعة الخامات الموحدة للحرف اليدوية في الشمساوية'
                        : 'Unified Materials Encyclopedia in alSHamsawiyah'
                    }
                    referrerPolicy="no-referrer"
                    onError={() => setMaterialsImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#292524] to-[#0C1427]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#091124]/90 via-transparent to-transparent" />

                <div className="absolute bottom-4 start-4 end-4 space-y-2">
                  <div
                    dir="ltr"
                    className="px-3.5 py-2.5 rounded-xl bg-[#080F22]/92 backdrop-blur-sm border border-[#243763] font-mono text-sm font-black tracking-wider flex items-center justify-between"
                  >
                    <span>
                      <span className="text-[#FBBF24]">TH</span>
                      <span className="text-sky-400">0001</span>
                      <span className="text-emerald-400">.01</span>
                      <span className="text-orange-400">#B003</span>
                    </span>
                    <span className="text-[10px] font-sans text-[#94A3B8]">
                      {copy.heroesSection.materials.codeLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {copy.heroesSection.materials.codeParts.map((part) => (
                      <div
                        key={part.code}
                        className="rounded-lg bg-[#080F22]/90 border border-[#243763]/80 py-1.5 px-1"
                      >
                        <span className={`block font-mono text-[11px] font-black ${part.colorClass}`}>
                          {part.code}
                        </span>
                        <span className="block text-[10px] text-[#CBD5E1] truncate">{part.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-5">
                <div className="space-y-3">
                  <span className="text-xs font-extrabold text-[#FBBF24] block">
                    {copy.heroesSection.materials.role}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    {copy.heroesSection.materials.name}
                  </h3>
                  <p className="text-sm sm:text-base font-bold text-[#F7F3EA]">
                    {copy.heroesSection.materials.tagline}
                  </p>
                  <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
                    {copy.heroesSection.materials.description}
                  </p>

                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs sm:text-[13px] text-[#E2E8F0]">
                    {copy.heroesSection.materials.bullets.map((b) => (
                      <li
                        key={b}
                        className="rounded-xl bg-[#091124] border border-[#243763] p-3 flex items-start gap-2 leading-relaxed"
                      >
                        <Layers className="w-4 h-4 text-[#FBBF24] shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-xs font-bold text-emerald-300 flex items-center gap-2 pt-2 border-t border-[#243763]">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{copy.heroesSection.materials.note}</span>
                </p>
              </div>
            </motion.article>

            {/* Interactive Workbench: Saqr, Shamousa (OR) & «هلخصهالك» Live Preview */}
            {flags.aiAssistantsEnabled && (
              <div className="rounded-3xl bg-[#091124] border border-[#243763] p-5 sm:p-7 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#1E2E52]">
                  <div className="space-y-1">
                    <h3 className="text-lg sm:text-xl font-black text-white">
                      {copy.heroesSection.workbench.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#94A3B8]">
                      {copy.heroesSection.workbench.subtitle}
                    </p>
                  </div>

                  <div className="inline-flex p-1 rounded-xl bg-[#111C38] border border-[#243763] self-start shrink-0">
                    <button
                      type="button"
                      onClick={() => setWorkbenchTab('simulator')}
                      className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                        workbenchTab === 'simulator'
                          ? accent.activeTab
                          : 'text-[#CBD5E1] hover:text-white'
                      }`}
                    >
                      {copy.heroesSection.workbench.tabSimulator}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkbenchTab('summary')}
                      className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                        workbenchTab === 'summary'
                          ? accent.activeTab
                          : 'text-[#CBD5E1] hover:text-white'
                      }`}
                    >
                      {copy.heroesSection.workbench.tabSummary}
                    </button>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {workbenchTab === 'simulator' ? (
                    <motion.div
                      key="sim-pane"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                      className="space-y-5"
                    >
                      <div className="flex flex-wrap gap-2">
                        {copy.simulatorScenarios.map((sc) => (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => setSimId(sc.id)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                              simId === sc.id
                                ? `${accent.activeTab} border-transparent`
                                : 'bg-[#111C38] border-[#243763] text-[#CBD5E1] hover:border-[#FBBF24]/60'
                            }`}
                          >
                            {sc.tabLabel}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                        <div className="lg:col-span-4 rounded-2xl bg-[#111C38] border border-[#243763] p-5 flex flex-col justify-between gap-4">
                          <div className="space-y-2.5">
                            <span className="text-[11px] font-extrabold text-[#94A3B8]">
                              {isRTL ? 'مثال سؤال من داخل الورشة:' : 'Example Workshop Question:'}
                            </span>
                            <p className="text-sm font-bold text-white leading-relaxed">
                              «{currentSim.userQuery}»
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={onOpenRegister}
                            className={`w-full px-4 py-3 rounded-xl text-xs font-black inline-flex items-center justify-center gap-2 transition cursor-pointer ${accent.primaryBtn}`}
                          >
                            <span>{copy.heroesSection.workbench.simulatorCta}</span>
                            <DirectionalArrow className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="lg:col-span-8 rounded-2xl bg-[#111C38] border border-[#FBBF24]/30 p-5 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-[#091124] border border-[#243763] p-1 flex items-center justify-center shrink-0">
                                {currentSim.speakerKind === 'falcon' ? (
                                  <FalconMascotFull isDark height="100%" className="w-full h-full" />
                                ) : (
                                  <ShamousaMascotFull isDark height="100%" className="w-full h-full" />
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-black text-white">
                                  {currentSim.speakerKind === 'falcon'
                                    ? copy.heroesSection.falcon.name
                                    : copy.heroesSection.shamousa.name}
                                </div>
                                <div className="text-[11px] font-bold text-[#FBBF24]">
                                  {currentSim.replyTitle}
                                </div>
                              </div>
                            </div>

                            {currentSim.badge && (
                              <span className="px-2.5 py-1 rounded-lg bg-[#EA580C]/20 border border-[#EA580C]/45 text-[11px] font-black text-[#FBBF24]">
                                {currentSim.badge}
                              </span>
                            )}
                          </div>

                          <ul className="space-y-2.5 text-xs sm:text-[13px] text-[#E2E8F0]">
                            {currentSim.bullets.map((line) => (
                              <li
                                key={line}
                                className="p-3 rounded-xl bg-[#091124]/90 border border-[#243763] leading-relaxed"
                              >
                                {line}
                              </li>
                            ))}
                          </ul>

                          <p className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>{currentSim.actionNote}</span>
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="summary-pane"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                      className="space-y-5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm sm:text-base font-black text-white">
                            {copy.heroesSection.workbench.summaryTitle}
                          </p>
                          <p className="text-xs text-[#94A3B8] mt-0.5">
                            {copy.heroesSection.workbench.summarySubtitle}
                          </p>
                        </div>
                        <div className="inline-flex p-1 rounded-xl bg-[#111C38] border border-[#243763] self-start">
                          <button
                            type="button"
                            onClick={() => setSummaryMode('workshop')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                              summaryMode === 'workshop' ? accent.activeTab : 'text-[#CBD5E1]'
                            }`}
                          >
                            {copy.heroesSection.workbench.summaryWorkshopTab}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSummaryMode('supplier')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                              summaryMode === 'supplier' ? accent.activeTab : 'text-[#CBD5E1]'
                            }`}
                          >
                            {copy.heroesSection.workbench.summarySupplierTab}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="rounded-2xl bg-[#111C38] border border-emerald-500/30 p-4 space-y-1.5">
                          <span className="text-[11px] font-bold text-emerald-300">
                            {isRTL ? 'معانا كام وفين الآن' : 'Cash on Hand Now'}
                          </span>
                          <div className="text-sm font-black text-white">
                            {summaryMode === 'workshop'
                              ? isRTL
                                ? 'خزينة الورشة · التحويلات · المحافظ'
                                : 'Workshop Drawer · Transfers · Wallets'
                              : isRTL
                                ? 'الخزينة الرئيسية · خزائن الفروع · التوريدات المعتمدة'
                                : 'Main Treasury · Branch Cashboxes · Approved Remittances'}
                          </div>
                          <p className="text-[11px] text-[#A8B7D1] leading-relaxed">
                            {summaryMode === 'workshop'
                              ? isRTL
                                ? 'رؤية لحظية للسيولة المتاحة داخل ورشتك بدون تعقيد دائن ومدين.'
                                : 'Instant liquidity snapshot across your workshop accounts.'
                              : isRTL
                                ? 'متابعة ما تم تسليمه للمحاسب وما اعتمده صاحب النشاط في خزينته.'
                                : 'Track shift handovers, accountant reviews, and owner approvals.'}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-[#111C38] border border-[#FBBF24]/30 p-4 space-y-1.5">
                          <span className="text-[11px] font-bold text-[#FBBF24]">
                            {isRTL ? 'لينا كام بره عند العملاء' : 'Client Receivables'}
                          </span>
                          <div className="text-sm font-black text-white">
                            {summaryMode === 'workshop'
                              ? isRTL
                                ? 'الفواتير والمستحقات والمتأخرات'
                                : 'Invoices, Deposits & Overdue Tracking'
                              : isRTL
                                ? 'أرصدة الورش والعملاء الخارجيين والمتجر'
                                : 'Workshop, External & Storefront Balances'}
                          </div>
                          <p className="text-[11px] text-[#A8B7D1] leading-relaxed">
                            {isRTL
                              ? 'متابعة واضحة لكل عميل ومدة التأخير لتسهيل التحصيل المنظم.'
                              : 'Clear visibility into every receivable for timely collections.'}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-[#111C38] border border-sky-400/30 p-4 space-y-1.5">
                          <span className="text-[11px] font-bold text-sky-300">
                            {isRTL ? 'علينا للموردين والمصانع' : 'Supplier & Factory Payables'}
                          </span>
                          <div className="text-sm font-black text-white">
                            {isRTL
                              ? 'فواتير الشراء ومواعيد الاستحقاق والعُهد'
                              : 'Purchase Invoices, Due Dates & Custodies'}
                          </div>
                          <p className="text-[11px] text-[#A8B7D1] leading-relaxed">
                            {isRTL
                              ? 'يحفظ استقرار السيولة ويمنع أي مفاجآت في مواعيد السداد.'
                              : 'Keeps cashflow predictable with zero payment surprises.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={
                            summaryMode === 'supplier' ? onOpenRegisterSupplier || onOpenRegister : onOpenRegister
                          }
                          className={`px-5 py-3 rounded-xl text-xs sm:text-sm font-black inline-flex items-center gap-2 transition cursor-pointer ${accent.primaryBtn}`}
                        >
                          <Wallet className="w-4 h-4" />
                          <span>{copy.heroesSection.workbench.summaryCta}</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>

        {/* ==================== 7. رحلة المنتج من الفكرة إلى السوق (Interactive 9-Step Connected Journey) ==================== */}
        <section id="product-journey" className={`py-16 sm:py-24 border-b ${dividerBorderClass}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <motion.div
              initial={revealInitial}
              whileInView={revealAnimate}
              viewport={{ once: true, amount: 0.2 }}
              transition={revealTransition}
              className="flex flex-col lg:flex-row lg:items-end justify-between gap-6"
            >
              <div className="max-w-3xl space-y-3">
                <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                  {copy.journeySection.eyebrow}
                </p>
                <h2 className="text-2xl sm:text-4xl font-black leading-tight [text-wrap:balance]">
                  {copy.journeySection.title}
                </h2>
                <p className={`text-sm sm:text-base leading-relaxed ${mutedTextClass}`}>
                  {copy.journeySection.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenRegister}
                className={`px-5 py-3 rounded-xl text-xs sm:text-sm font-black inline-flex items-center gap-2 shrink-0 self-start lg:self-end transition cursor-pointer ${accent.primaryBtn}`}
              >
                <span>{copy.journeySection.ctaStartFirstProduct}</span>
                <DirectionalArrow className="w-4 h-4" />
              </button>
            </motion.div>

            {/* 9 Connected Interactive Step Cards (3x3 Clean Grid on Desktop) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {copy.journeySection.steps.map((step, index) => {
                const StepIcon = JOURNEY_STEP_ICONS[index] || Sparkles;
                const isSelected = activeJourneyStep === index;
                return (
                  <button
                    key={step.stepNumber}
                    type="button"
                    onClick={() => setActiveJourneyStep(index)}
                    className={`rounded-2xl border p-4 text-start flex items-start gap-3.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0C1427] text-[#F7F3EA] border-[#EA580C] shadow-lg'
                        : `${surfaceCardClass} hover:border-[#EA580C]/65`
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-[#EA580C] text-white' : `${accent.softSurface} ${accent.primaryText}`
                      }`}
                    >
                      <StepIcon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-mono font-black tabular-nums ${
                            isSelected ? 'text-[#FBBF24]' : accent.primaryText
                          }`}
                        >
                          {step.stepNumber}
                        </span>
                        <span
                          className={`text-[11px] font-extrabold ${
                            isSelected ? 'text-[#CBD5E1]' : mutedTextClass
                          }`}
                        >
                          {step.shortLabel}
                        </span>
                      </div>
                      <span className="block text-xs sm:text-sm font-black leading-snug">{step.title}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Step Detail Inspector with Prev/Next Controls */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep.stepNumber}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className={`rounded-3xl border p-6 sm:p-8 space-y-6 ${surfaceCardClass} ${accent.primaryBorder}`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-7 space-y-3">
                    <div className="inline-flex items-center gap-2 text-xs font-extrabold">
                      <span className={`px-2.5 py-1 rounded-lg font-mono font-black ${accent.activeTab}`}>
                        {activeStep.stepNumber} / 09
                      </span>
                      <span className={accent.primaryText}>{copy.journeySection.activeStepLabel}</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black leading-snug flex items-center gap-2.5">
                      <ActiveStepIcon className={`w-6 h-6 shrink-0 ${accent.primaryText}`} />
                      <span>{activeStep.title}</span>
                    </h3>
                    <p className={`text-sm sm:text-base leading-relaxed ${mutedTextClass}`}>
                      {activeStep.description}
                    </p>
                  </div>

                  <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                    <div
                      className={`rounded-2xl border p-4 ${
                        isObsidianPreset
                          ? 'bg-[#091124] border-[#21335C]'
                          : 'bg-[#EFE9DC]/70 dark:bg-[#091124] border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      <span className={`text-[11px] font-extrabold block ${mutedTextClass}`}>
                        {copy.journeySection.moduleLabel}
                      </span>
                      <span className="text-sm font-black mt-1 block">{activeStep.moduleName}</span>
                    </div>

                    <div
                      className={`rounded-2xl border p-4 ${
                        isObsidianPreset
                          ? 'bg-[#091124] border-[#21335C]'
                          : 'bg-[#EFE9DC]/70 dark:bg-[#091124] border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      <span className={`text-[11px] font-extrabold block ${mutedTextClass}`}>
                        {copy.journeySection.outcomeLabel}
                      </span>
                      <span className="text-sm font-black mt-1 block text-emerald-700 dark:text-emerald-400">
                        {activeStep.outcome}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step Navigation Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-[#D4CCBC]/60 dark:border-[#22355E]">
                  <button
                    type="button"
                    disabled={activeJourneyStep === 0}
                    onClick={() => setActiveJourneyStep((prev) => Math.max(0, prev - 1))}
                    className="px-4 py-2 rounded-xl border border-[#C9BFA9] dark:border-[#2A3F6E] text-xs font-black disabled:opacity-40 hover:border-[#EA580C] transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    {copy.journeySection.prevStep}
                  </button>

                  <div className="flex items-center gap-1.5">
                    {copy.journeySection.steps.map((s, idx) => (
                      <button
                        key={s.stepNumber}
                        type="button"
                        aria-label={s.title}
                        onClick={() => setActiveJourneyStep(idx)}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          idx === activeJourneyStep
                            ? 'w-6 bg-[#EA580C]'
                            : 'w-2 bg-[#C9BFA9] dark:bg-[#2A3F6E]'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={activeJourneyStep === copy.journeySection.steps.length - 1}
                    onClick={() =>
                      setActiveJourneyStep((prev) =>
                        Math.min(copy.journeySection.steps.length - 1, prev + 1)
                      )
                    }
                    className={`px-4 py-2 rounded-xl text-xs font-black disabled:opacity-40 transition cursor-pointer disabled:cursor-not-allowed ${accent.primaryBtn}`}
                  >
                    {copy.journeySection.nextStep}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* ==================== 8. قسم «لماذا الشمساوية؟» (Sincere Philosophy) ==================== */}
        <section id="why-alshams" className={`py-16 sm:py-24 border-b ${dividerBorderClass}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <motion.div
              initial={revealInitial}
              whileInView={revealAnimate}
              viewport={{ once: true, amount: 0.2 }}
              transition={revealTransition}
              className="max-w-4xl space-y-4"
            >
              <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                {copy.whySection.eyebrow}
              </p>
              <h2 className="text-2xl sm:text-4xl font-black leading-tight [text-wrap:balance]">
                {copy.whySection.title}
              </h2>
              <blockquote
                className={`rounded-2xl border-s-4 border-[#EA580C] p-5 sm:p-6 text-base sm:text-xl font-black leading-relaxed ${surfaceCardClass}`}
              >
                {copy.whySection.manifesto}
              </blockquote>
              <p className={`text-sm sm:text-base leading-relaxed ${mutedTextClass}`}>
                {copy.whySection.subtitle}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {copy.whySection.pillars.map((pillar, idx) => (
                <motion.article
                  key={pillar.id}
                  initial={revealInitial}
                  whileInView={revealAnimate}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ ...revealTransition, delay: prefersReducedMotion ? 0 : idx * 0.04 }}
                  className={`rounded-2xl border p-5 space-y-2.5 ${surfaceCardClass}`}
                >
                  <div className="flex items-center justify-between">
                    <HeartHandshake className={`w-5 h-5 ${accent.primaryText}`} />
                    <span className="text-[11px] font-mono font-black opacity-35 tabular-nums">
                      0{idx + 1}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-[15px] font-black leading-snug">{pillar.title}</h3>
                  <p className={`text-xs leading-relaxed ${mutedTextClass}`}>{pillar.desc}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== 9. الشهادات والأسئلة الشائعة (Preserving CMS Sections) ==================== */}
        {cms.sections.reviews.visible && (
          <section id="reviews" className={`py-16 sm:py-20 border-b ${dividerBorderClass}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                <div className="space-y-2.5 max-w-2xl">
                  <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                    {copy.reviewsSection.eyebrow}
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-black leading-tight">
                    {isRTL ? cms.sections.reviews.title || copy.reviewsSection.title : copy.reviewsSection.title}
                  </h2>
                  <p className={`text-sm leading-relaxed ${mutedTextClass}`}>
                    {isRTL
                      ? cms.sections.reviews.subtitle || copy.reviewsSection.subtitle
                      : copy.reviewsSection.subtitle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFeedbackError(null);
                    setIsFeedbackModalOpen(true);
                  }}
                  className={`px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-black inline-flex items-center gap-2 self-start lg:self-end transition cursor-pointer hover:border-[#EA580C] ${surfaceCardClass}`}
                >
                  <MessageSquare className={`w-4 h-4 ${accent.primaryText}`} />
                  <span>{copy.reviewsSection.feedbackCta}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {cmsReviews.slice(0, 4).map((rev) => (
                  <article
                    key={rev.id}
                    className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 ${surfaceCardClass}`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-0.5 text-[#EA580C] dark:text-[#FBBF24]">
                        {Array.from({ length: Math.min(5, Math.max(1, rev.rating || 5)) }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-current" />
                        ))}
                      </div>
                      <p className="text-xs sm:text-[13px] leading-relaxed font-medium">«{rev.quote}»</p>
                    </div>
                    <div className="pt-3 border-t border-[#D4CCBC]/60 dark:border-[#22355E]">
                      <div className="text-xs font-black">{rev.author}</div>
                      <div className={`text-[11px] mt-0.5 ${mutedTextClass}`}>{rev.workshop}</div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {cms.sections.faq.visible && (
          <section id="faq" className={`py-16 sm:py-20 border-b ${dividerBorderClass}`}>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="text-center space-y-2.5">
                <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>
                  {copy.faqSection.eyebrow}
                </p>
                <h2 className="text-2xl sm:text-3xl font-black leading-tight">
                  {isRTL ? cms.sections.faq.title || copy.faqSection.title : copy.faqSection.title}
                </h2>
                <p className={`text-sm leading-relaxed ${mutedTextClass}`}>
                  {isRTL ? cms.sections.faq.subtitle || copy.faqSection.subtitle : copy.faqSection.subtitle}
                </p>
              </div>

              <div className="space-y-3">
                {cmsFaqs.map((item, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border overflow-hidden transition-colors ${surfaceCardClass} ${
                        isOpen ? accent.primaryBorder : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        aria-expanded={isOpen}
                        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-start cursor-pointer"
                      >
                        <span className="text-sm sm:text-[15px] font-black leading-snug">{item.q}</span>
                        {isOpen ? (
                          <ChevronUp className={`w-4.5 h-4.5 shrink-0 ${accent.primaryText}`} />
                        ) : (
                          <ChevronDown className="w-4.5 h-4.5 shrink-0 opacity-60" />
                        )}
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div
                              className={`px-5 pb-4 pt-1 text-xs sm:text-sm leading-relaxed border-t border-[#D4CCBC]/50 dark:border-[#22355E]/70 ${mutedTextClass}`}
                            >
                              {item.a}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ==================== 10. قسم الختام والدعوة للانضمام ==================== */}
        <section className="relative py-20 sm:py-28 bg-[#0C1427] text-[#F7F3EA] overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(234,88,12,0.22),transparent_58%)]"
          />
          <motion.div
            initial={revealInitial}
            whileInView={revealAnimate}
            viewport={{ once: true, amount: 0.2 }}
            transition={revealTransition}
            className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-7"
          >
            <div className="flex justify-center">
              <AlShamsFalconEmblem size={54} isDark />
            </div>

            <p className="text-xs sm:text-sm font-extrabold text-[#FBBF24] tracking-wide">
              {copy.closing.eyebrow}
            </p>

            <h2 className="text-2xl sm:text-4xl lg:text-[2.7rem] font-black leading-tight text-white [text-wrap:balance]">
              {copy.closing.headline}
            </h2>

            <p className="text-sm sm:text-lg leading-[1.9] text-[#CBD5E1] max-w-3xl mx-auto">
              {copy.closing.body}
            </p>

            <div className="py-4 px-6 rounded-3xl bg-[#111C38]/90 border border-[#FBBF24]/30 inline-block space-y-2">
              <p className="text-xl sm:text-2xl font-black text-[#FBBF24]">
                {copy.closing.familyStatement}
              </p>
              <p className="text-sm sm:text-base font-bold text-[#F7F3EA]">
                {copy.closing.threadLine}
              </p>
              <p
                dir="ltr"
                className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-[#A8B7D1] pt-1"
              >
                {copy.closing.luxuryLine}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={onOpenRegister}
                className={`w-full sm:w-auto px-8 py-4 rounded-2xl text-sm sm:text-base font-black inline-flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${accent.primaryBtn}`}
              >
                <span>{copy.closing.primaryCta}</span>
                <DirectionalArrow className="w-4.5 h-4.5" />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('guided-discovery')}
                className="w-full sm:w-auto px-7 py-4 rounded-2xl text-sm sm:text-base font-black border border-white/25 hover:border-[#FBBF24] text-white hover:text-[#FBBF24] inline-flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Compass className="w-4.5 h-4.5" />
                <span>{copy.closing.secondaryCta}</span>
              </button>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ==================== 11. التذييل (Clean Editorial Footer) ==================== */}
      <footer
        className={`border-t py-12 sm:py-16 ${
          isObsidianPreset
            ? 'bg-[#060B18] border-[#1D2D52] text-[#F7F3EA]'
            : 'bg-[#EBE3D5] dark:bg-[#050914] border-[#D4CCBC] dark:border-[#1E2E52]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <AlShamsFalconEmblem size={36} isDark={isObsidianPreset || isDarkMode} />
                <AlShamsBrandLogo isDark={isObsidianPreset || isDarkMode} className="h-9" />
              </div>
              <p className={`text-xs sm:text-sm leading-relaxed max-w-md ${mutedTextClass}`}>
                {isRTL ? cmsFooter.brandSubtitle || copy.hero.description : copy.hero.description}
              </p>
              <p
                dir="ltr"
                className={`text-xs font-extrabold tracking-[0.18em] uppercase ${accent.primaryText}`}
              >
                {copy.closing.luxuryLine}
              </p>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wide opacity-75">
                {copy.footer.quickLinksTitle}
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm font-bold">
                {visibleNav.map((lnk) => (
                  <li key={lnk.id}>
                    <a
                      href={lnk.href}
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToSection(lnk.href);
                      }}
                      className={`transition-colors ${mutedTextClass} ${accent.hoverText}`}
                    >
                      {lnk.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wide opacity-75">
                {copy.footer.marketsTitle}
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm font-bold">
                {flags.artisanMarketplaceEnabled && (
                  <li>
                    <button
                      type="button"
                      onClick={handleOpenMarketplace}
                      className={`transition-colors cursor-pointer ${mutedTextClass} ${accent.hoverText}`}
                    >
                      {copy.header.alshamsMarket}
                    </button>
                  </li>
                )}
                {flags.suppliersMarketplaceEnabled && (
                  <li>
                    <button
                      type="button"
                      onClick={handleOpenSuppliersMarket}
                      className={`transition-colors cursor-pointer ${mutedTextClass} ${accent.hoverText}`}
                    >
                      {copy.header.suppliersMarket}
                    </button>
                  </li>
                )}
                <li>
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    className={`transition-colors cursor-pointer ${mutedTextClass} ${accent.hoverText}`}
                  >
                    {copy.footer.loginBtn}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onOpenRegister}
                    className={`transition-colors cursor-pointer ${mutedTextClass} ${accent.hoverText}`}
                  >
                    {copy.footer.registerBtn}
                  </button>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-3 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wide opacity-75">
                {copy.footer.experienceTitle}
              </h3>
              <div className="space-y-2.5">
                {!isPreview && (
                  <button
                    type="button"
                    onClick={() => setIsWelcomeGateOpen(true)}
                    className={`w-full px-4 py-2.5 rounded-xl border text-xs font-black flex items-center justify-between cursor-pointer hover:border-[#EA580C] transition ${surfaceCardClass}`}
                  >
                    <span>{copy.footer.welcomeGateBtn}</span>
                    <Sparkles className={`w-4 h-4 ${accent.primaryText}`} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackError(null);
                    setIsFeedbackModalOpen(true);
                  }}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-black flex items-center justify-between cursor-pointer hover:border-[#EA580C] transition ${surfaceCardClass}`}
                >
                  <span>{copy.footer.feedbackBtn}</span>
                  <MessageSquare className={`w-4 h-4 ${accent.primaryText}`} />
                </button>
              </div>
            </div>
          </div>

          <div
            className={`pt-6 border-t ${dividerBorderClass} flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${mutedTextClass}`}
          >
            <p>{cmsFooter.copyrightText}</p>
            <p className="font-bold">{cmsFooter.subTagline}</p>
          </div>
        </div>
      </footer>

      {/* ==================== 12. نافذة إرسال الآراء والمقترحات (/api/public/feedback) ==================== */}
      <AnimatePresence>
        {isFeedbackModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className={`w-full max-w-lg rounded-3xl border p-6 shadow-2xl space-y-5 ${
                isObsidianPreset
                  ? 'bg-[#0E1833] border-[#21335C] text-[#F7F3EA]'
                  : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">{copy.feedbackModal.title}</h3>
                  <p className={`text-xs mt-1 ${mutedTextClass}`}>{copy.feedbackModal.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFeedbackModalOpen(false)}
                  aria-label={copy.header.closeMenu}
                  className="w-9 h-9 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {feedbackSuccess ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-black">{copy.feedbackModal.successTitle}</h4>
                  <p className={`text-xs ${mutedTextClass}`}>{copy.feedbackModal.successBody}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitFeedback} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold block">{copy.feedbackModal.nameLabel}</label>
                      <input
                        type="text"
                        required
                        value={feedbackName}
                        onChange={(e) => setFeedbackName(e.target.value)}
                        placeholder={copy.feedbackModal.namePlaceholder}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#091124] text-xs sm:text-sm outline-none focus:border-[#EA580C]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold block">{copy.feedbackModal.craftLabel}</label>
                      <input
                        type="text"
                        value={feedbackCraft}
                        onChange={(e) => setFeedbackCraft(e.target.value)}
                        placeholder={copy.feedbackModal.craftPlaceholder}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#091124] text-xs sm:text-sm outline-none focus:border-[#EA580C]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold block">{copy.feedbackModal.ratingLabel}</label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedbackRating(star)}
                          className="p-1 cursor-pointer"
                          aria-label={`${star} / 5`}
                        >
                          <Star
                            className={`w-5 h-5 transition ${
                              star <= feedbackRating
                                ? 'text-[#EA580C] dark:text-[#FBBF24] fill-current'
                                : 'text-[#94A3B8]'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold block">{copy.feedbackModal.messageLabel}</label>
                    <textarea
                      required
                      rows={3}
                      value={feedbackMessage}
                      onChange={(e) => setFeedbackMessage(e.target.value)}
                      placeholder={copy.feedbackModal.messagePlaceholder}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#091124] text-xs sm:text-sm outline-none focus:border-[#EA580C] resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold block">{copy.feedbackModal.contactLabel}</label>
                    <input
                      type="text"
                      value={feedbackContact}
                      onChange={(e) => setFeedbackContact(e.target.value)}
                      placeholder={copy.feedbackModal.contactPlaceholder}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#091124] text-xs sm:text-sm outline-none focus:border-[#EA580C]"
                    />
                  </div>

                  {feedbackError && (
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{feedbackError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={feedbackSubmitting}
                    className={`w-full py-3 rounded-xl text-sm font-black inline-flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 ${accent.primaryBtn}`}
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {feedbackSubmitting ? copy.feedbackModal.submitting : copy.feedbackModal.submit}
                    </span>
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
