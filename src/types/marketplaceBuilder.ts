import { compressImageFile } from '../utils/imageCompressor';

export type MarketBlockId = 'promo' | 'hero' | 'categories' | 'featured_matrices' | 'catalog_grid';

export type MarketCouponType = 'percent' | 'fixed' | 'free_shipping' | 'bogo';

export type MarketThemePresetId =
  | 'shams_sand'
  | 'royal_navy'
  | 'emerald_linen'
  | 'rose_clay'
  | 'midnight_gallery'
  | 'clean_alabaster'
  | 'arch_boutique'
  | 'bento_studio'
  | 'cinema_lookbook'
  | 'pop_atelier';

export interface MarketThemePresetMeta {
  id: MarketThemePresetId;
  nameAr: string;
  subtitleAr: string;
  pageBgLight: string;
  surfaceLight: string;
  softLight: string;
  borderLight: string;
  inkLight: string;
  mutedLight: string;
  accentBg: string;
  accentHover: string;
  accentTextLight: string;
  accentTextDark: string;
  pageBgDark: string;
  surfaceDark: string;
  softDark: string;
  borderDark: string;
  inkDark: string;
}

export const MARKET_THEME_PRESETS: Record<MarketThemePresetId, MarketThemePresetMeta> = {
  shams_sand: {
    id: 'shams_sand',
    nameAr: 'رمل الشمساوية (الافتراضي)',
    subtitleAr: 'رملي دافئ ونحاسي متوازن لهوية المنظومة',
    pageBgLight: '#F2ECE1',
    surfaceLight: '#F7F3EA',
    softLight: '#E9E2D4',
    borderLight: '#D4CCBC',
    inkLight: '#0C1427',
    mutedLight: '#475569',
    accentBg: '#EA580C',
    accentHover: '#C2410C',
    accentTextLight: '#C2410C',
    accentTextDark: '#FBBF24',
    pageBgDark: '#060B18',
    surfaceDark: '#0D162E',
    softDark: '#132040',
    borderDark: '#22355E',
    inkDark: '#F7F3EA',
  },
  royal_navy: {
    id: 'royal_navy',
    nameAr: 'الكحلي الملكي والذهب',
    subtitleAr: 'أنيق وكلاسيكي بلمسات ذهبية هادئة',
    pageBgLight: '#EEF2F7',
    surfaceLight: '#F8FAFC',
    softLight: '#E2E8F0',
    borderLight: '#CBD5E1',
    inkLight: '#0F172A',
    mutedLight: '#475569',
    accentBg: '#1E3A8A',
    accentHover: '#172554',
    accentTextLight: '#1E3A8A',
    accentTextDark: '#FBBF24',
    pageBgDark: '#050A17',
    surfaceDark: '#0B142B',
    softDark: '#142244',
    borderDark: '#253C6E',
    inkDark: '#F8FAFC',
  },
  emerald_linen: {
    id: 'emerald_linen',
    nameAr: 'كتان زمردي حرفي',
    subtitleAr: 'طبيعي مريح مستوحى من الحرف اليدوية والخشب',
    pageBgLight: '#EDF3EF',
    surfaceLight: '#F7FAF8',
    softLight: '#DFECE4',
    borderLight: '#C3D7CB',
    inkLight: '#0A1F16',
    mutedLight: '#3F5A4E',
    accentBg: '#047857',
    accentHover: '#065F46',
    accentTextLight: '#047857',
    accentTextDark: '#34D399',
    pageBgDark: '#04120D',
    surfaceDark: '#0A1E17',
    softDark: '#112E24',
    borderDark: '#1E4A3B',
    inkDark: '#ECFDF5',
  },
  rose_clay: {
    id: 'rose_clay',
    nameAr: 'طين وتراكوتا دافئ',
    subtitleAr: 'طابع فخاري ومعارض ديكور عصرية',
    pageBgLight: '#F5ECE9',
    surfaceLight: '#FBF6F4',
    softLight: '#ECDDD8',
    borderLight: '#DAC3BC',
    inkLight: '#23120E',
    mutedLight: '#6B4840',
    accentBg: '#B45309',
    accentHover: '#92400E',
    accentTextLight: '#9A3412',
    accentTextDark: '#FDBA74',
    pageBgDark: '#160B09',
    surfaceDark: '#22120F',
    softDark: '#301A16',
    borderDark: '#4D2C25',
    inkDark: '#FDF6F3',
  },
  midnight_gallery: {
    id: 'midnight_gallery',
    nameAr: 'جاليري ليلي داكن',
    subtitleAr: 'يبرز ألوان المشغولات الفاخرة بتباين عالٍ',
    pageBgLight: '#ECEEEF',
    surfaceLight: '#F5F6F7',
    softLight: '#E1E4E7',
    borderLight: '#C9CED4',
    inkLight: '#111827',
    mutedLight: '#4B5563',
    accentBg: '#D97706',
    accentHover: '#B45309',
    accentTextLight: '#B45309',
    accentTextDark: '#FBBF24',
    pageBgDark: '#09090B',
    surfaceDark: '#121216',
    softDark: '#1C1C22',
    borderDark: '#2D2D37',
    inkDark: '#FAFAFA',
  },
  clean_alabaster: {
    id: 'clean_alabaster',
    nameAr: 'المرمر الهادئ (Minimal)',
    subtitleAr: 'تصميم خفيف وواسع لعرض أكبر للمنتجات',
    pageBgLight: '#F4F3F0',
    surfaceLight: '#FAF9F6',
    softLight: '#EAE8E3',
    borderLight: '#D8D5CD',
    inkLight: '#18181B',
    mutedLight: '#52525B',
    accentBg: '#0F172A',
    accentHover: '#EA580C',
    accentTextLight: '#0F172A',
    accentTextDark: '#FBBF24',
    pageBgDark: '#0C0F16',
    surfaceDark: '#141923',
    softDark: '#1D2432',
    borderDark: '#2C364A',
    inkDark: '#F4F4F5',
  },
  arch_boutique: {
    id: 'arch_boutique',
    nameAr: 'أقواس البوتيك (أشكال دائرية وأقواس)',
    subtitleAr: 'إطارات مقوّسة فاخرة وتصنيفات دائرية بهوية البوتيكات العالمية',
    pageBgLight: '#FAF6F0',
    surfaceLight: '#FFFFFF',
    softLight: '#F1E9DD',
    borderLight: '#DFD2C0',
    inkLight: '#2A2118',
    mutedLight: '#6F5E4C',
    accentBg: '#8B5E34',
    accentHover: '#6E4826',
    accentTextLight: '#8B5E34',
    accentTextDark: '#E5B887',
    pageBgDark: '#14100C',
    surfaceDark: '#1E1812',
    softDark: '#2A2119',
    borderDark: '#443527',
    inkDark: '#FAF6F0',
  },
  bento_studio: {
    id: 'bento_studio',
    nameAr: 'بنتو التفاعلي (توزيع معماري حديث)',
    subtitleAr: 'واجهة بطاقات بنتو تفاعلية ومنتج رئيسي عريض بستايل الاستوديوهات الحديثة',
    pageBgLight: '#F3F5F9',
    surfaceLight: '#FFFFFF',
    softLight: '#E7ECF4',
    borderLight: '#D0D9E8',
    inkLight: '#0E172A',
    mutedLight: '#475569',
    accentBg: '#2563EB',
    accentHover: '#1D4ED8',
    accentTextLight: '#2563EB',
    accentTextDark: '#60A5FA',
    pageBgDark: '#070D19',
    surfaceDark: '#0F182B',
    softDark: '#182540',
    borderDark: '#26385E',
    inkDark: '#F8FAFC',
  },
  cinema_lookbook: {
    id: 'cinema_lookbook',
    nameAr: 'لوك بوك العرض الجانبي (سينمائي)',
    subtitleAr: 'شريط عرض أفقي متدرج + بطاقات منتجات أفقية (صورة جنب التفاصيل)',
    pageBgLight: '#16110E',
    surfaceLight: '#211915',
    softLight: '#2E231D',
    borderLight: '#433329',
    inkLight: '#FAF3EB',
    mutedLight: '#C6B3A4',
    accentBg: '#E09F3E',
    accentHover: '#C8892B',
    accentTextLight: '#E09F3E',
    accentTextDark: '#F4C46D',
    pageBgDark: '#120E0B',
    surfaceDark: '#1C1511',
    softDark: '#271E18',
    borderDark: '#3E2F26',
    inkDark: '#FAF3EB',
  },
  pop_atelier: {
    id: 'pop_atelier',
    nameAr: 'ستوديو البولارويد الحر (تفاعلي جريء)',
    subtitleAr: 'إطارات بولارويد بظلال هندسية جريئة وشريط إعلاني متحرك وأزرار دائرية',
    pageBgLight: '#FFF8EB',
    surfaceLight: '#FFFFFF',
    softLight: '#FEEFD2',
    borderLight: '#18181B',
    inkLight: '#18181B',
    mutedLight: '#52525B',
    accentBg: '#E11D48',
    accentHover: '#BE123C',
    accentTextLight: '#E11D48',
    accentTextDark: '#FB7185',
    pageBgDark: '#141210',
    surfaceDark: '#1E1B18',
    softDark: '#2C2621',
    borderDark: '#F59E0B',
    inkDark: '#FFF8EB',
  },
};

export interface MarketPageBlock {
  id: MarketBlockId;
  labelAr: string;
  enabled: boolean;
}

export interface MarketDecorCategoryConfig {
  id: string;
  nameAr: string;
  keywords: string[];
  visible: boolean;
}

export interface MarketProductMatrixConfig {
  id: string;
  title: string;
  subtitle?: string;
  filterType: 'featured' | 'category' | 'craft' | 'all';
  filterValue?: string;
  desktopCols: 2 | 3 | 4;
  mobileCols: 1 | 2;
  limit: number;
  enabled: boolean;
}

export interface MarketCouponConfig {
  id: string;
  code: string;
  type: MarketCouponType;
  value: number; // percent (1-90), fixed amount in store currency, or 0 for free_shipping/bogo
  minOrder?: number;
  buyQty?: number; // for 'bogo' (e.g., buy 2)
  freeQty?: number; // for 'bogo' (e.g., get 1 free)
  currencyCode?: string; // store currency code
  startsAt?: string;
  endsAt?: string;
  showInBanner?: boolean;
  active: boolean; // whether redeemable in checkout
  visible: boolean; // whether shown in active vs archived/hidden list
  description?: string;
  createdAt: string;
}

export type ClientVisibilityMode = 'show_all' | 'hide_all' | 'custom_per_workshop';

export interface MarketFxConfig {
  autoSyncEnabled: boolean;
  silentBankBufferPercent: number;
  ratesAgainstEgp: Record<string, number>;
  lastSyncedAt?: string;
  sourceLabel?: string;
}

export interface MarketplaceBuilderConfig {
  promoBanner: {
    enabled: boolean;
    text: string;
    bgColor: string;
    textColor: string;
    linkedCouponCode?: string;
    showLinkedCoupon?: boolean;
  };
  tickerBanner: {
    enabled: boolean;
    text: string;
    position: 'above_hero' | 'below_hero';
    bgColor: string;
    linkedCouponCode?: string;
    showLinkedCoupon: boolean;
    speed: 'slow' | 'normal' | 'fast';
  };
  flashOffer: {
    enabled: boolean;
    title: string;
    endsAt: string;
    couponCode?: string;
    bgColor: string;
  };
  couponsEnabled: boolean;
  coupons: MarketCouponConfig[];
  loyalty: {
    enabled: boolean;
    pointsPer100Egp: number;
    egpPer100Points: number;
    bannerText: string;
  };
  showWorkshopOnCards: boolean;
  showWorkshopAndArtistInDetails: boolean;
  clientVisibilityMode: ClientVisibilityMode;
  workshopClientVisibility: Record<string, 'show' | 'hide'>;
  shippingModeNotices: {
    platformShippingMessage: string;
    workshopShippingMessage: string;
  };
  estimatedDelivery: {
    enabled: boolean;
    productionDaysMin: number;
    productionDaysMax: number;
    upperEgyptExtraDays: number;
  };
  productBadgesEnabled: boolean;
  productBadges: Record<string, string>;
  themePreset: MarketThemePresetId;
  freeShippingThresholdEnabled: boolean;
  freeShippingThresholdAmount: number;
  whatsappSupport: {
    enabled: boolean;
    phone: string;
    label: string;
  };
  heroEnabled: boolean;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroDesktopBg: string;
  heroMobileBg: string;
  heroImageOpacity: number; // 0.1 to 0.9
  heroOverlayColor: string;
  marketBgColor: string; // Optional custom override canvas hex, empty = theme default
  heroAccentColor: string;
  defaultDesktopCols: 2 | 3 | 4;
  defaultMobileCols: 1 | 2;
  pageBlocksOrder: MarketPageBlock[];
  decorCategoriesOrder: MarketDecorCategoryConfig[];
  productMatrices: MarketProductMatrixConfig[];
  fxConfig: MarketFxConfig;
  updatedAt?: string;
}

export const MARKET_BUILDER_STORAGE_KEY = 'alshams_market_builder_v1';

export const PRODUCT_BADGE_PRESETS = [
  'الأكثر طلباً',
  'صنع يدوي خاص',
  'إصدار محدود',
  'قطعة مميزة',
  'جديد',
];

export const DEFAULT_MARKET_BUILDER_CONFIG: MarketplaceBuilderConfig = {
  promoBanner: {
    enabled: false,
    text: '✨ شحن لكافة المحافظات مع ضمان جودة منظومة الشمساوية وفحص كل قطعة قبل التسليم',
    bgColor: '#0C1427',
    textColor: '#FBBF24',
    linkedCouponCode: 'SHAMS5',
    showLinkedCoupon: false,
  },
  tickerBanner: {
    enabled: false,
    text: '✨ قطع يدوية مصنوعة خصيصاً لمنزلك بأيدي أمهر فناني مصر · توصيل مؤمّن لكافة المحافظات',
    position: 'above_hero',
    bgColor: '#EA580C',
    linkedCouponCode: 'SHAMS5',
    showLinkedCoupon: true,
    speed: 'normal',
  },
  flashOffer: {
    enabled: false,
    title: '⏳ عرض خاص لفترة محدودة — ينتهي خلال:',
    endsAt: '',
    couponCode: 'SHAMS5',
    bgColor: '#0C1427',
  },
  couponsEnabled: true,
  coupons: [
    {
      id: 'coupon_shams5',
      code: 'SHAMS5',
      type: 'percent',
      value: 5,
      minOrder: 0,
      active: true,
      visible: true,
      description: 'خصم ترحيبي 5% على قيمة المشغولات',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  loyalty: {
    enabled: true,
    pointsPer100Egp: 10,
    egpPer100Points: 10,
    bannerText: 'اجمع نقاط الولاء مع كل طلب واستبدلها بخصومات مستقبلية',
  },
  showWorkshopOnCards: false,
  showWorkshopAndArtistInDetails: false,
  clientVisibilityMode: 'show_all',
  workshopClientVisibility: {},
  shippingModeNotices: {
    platformShippingMessage:
      'نتشرف بتوصيل منتجاتك بعناية فائقة وبضمان الشحن الآمن والفحص الكامل من منظومة الشمساوية حتى باب منزلك.',
    workshopShippingMessage:
      'سيتم شحن مشغولاتك مباشرة من ورش فناني الشمساوية المعتمدين إليك بعناية وتغليف خاص لضمان وصولها في أبهى صورة.',
  },
  estimatedDelivery: {
    enabled: true,
    productionDaysMin: 3,
    productionDaysMax: 5,
    upperEgyptExtraDays: 2,
  },
  productBadgesEnabled: true,
  productBadges: {},
  themePreset: 'shams_sand',
  freeShippingThresholdEnabled: false,
  freeShippingThresholdAmount: 1500,
  whatsappSupport: {
    enabled: true,
    phone: '201000996059',
    label: 'تواصل معنا',
  },
  heroEnabled: true,
  heroEyebrow: 'مشغولات يدوية · ديكور وأثاث منزلي',
  heroTitle: 'اقتنِ قطعاً يدوية أصيلة لمنزلك',
  heroSubtitle: 'تشكيلة مختارة من الديكورات والمشغولات الحرفية بتصنيع متقن وتوصيل لكافة المحافظات.',
  heroCtaText: 'تصفح المعروضات',
  heroDesktopBg: '/assets/aistudio/1794679364029_8e8e9eb9.jpg',
  heroMobileBg: '/assets/aistudio/1794679233184_3747c8da.jpg',
  heroImageOpacity: 0.18,
  heroOverlayColor: '',
  marketBgColor: '',
  heroAccentColor: '#EA580C',
  defaultDesktopCols: 4,
  defaultMobileCols: 2,
  pageBlocksOrder: [
    { id: 'promo', labelAr: 'شريط الإعلانات والعروض العلوي', enabled: false },
    { id: 'hero', labelAr: 'الواجهة الرئيسية والهيدلاين (Hero)', enabled: true },
    { id: 'categories', labelAr: 'أشرطة الأقسام والتصنيفات والبحث', enabled: true },
    { id: 'featured_matrices', labelAr: 'مصفوفات العروض المخصصة', enabled: true },
    { id: 'catalog_grid', labelAr: 'شبكة المنتجات الرئيسية للمتجر', enabled: true },
  ],
  decorCategoriesOrder: [
    { id: 'all', nameAr: 'كافة المعروضات', keywords: [], visible: true },
    { id: 'wall_hangings', nameAr: 'معلقات جدارية', keywords: ['معلق', 'جدار', 'تابلوه', 'طارة', 'برواز', 'مرآة'], visible: true },
    { id: 'cushions', nameAr: 'كوشن وتكايات', keywords: ['كوشن', 'مخد', 'تكا', 'غطاء'], visible: true },
    { id: 'bags_clutches', nameAr: 'شنط وكلاتشات', keywords: ['شنط', 'كلاتش', 'حقيب', 'zara'], visible: true },
    { id: 'rugs_runners', nameAr: 'سجاد ورانرات', keywords: ['سجاد', 'رانر', 'كليم', 'مفرش'], visible: true },
    { id: 'lighting', nameAr: 'إضاءة وأباجورات', keywords: ['إضاء', 'أباجور', 'نجف', 'فانوس', 'شمع'], visible: true },
    { id: 'baskets_trays', nameAr: 'صواني وباسكت', keywords: ['صين', 'باسكت', 'سبت', 'منظم', 'بوكس', 'سل'], visible: true },
    { id: 'furniture_decor', nameAr: 'أثاث وديكور', keywords: ['أثاث', 'كرسي', 'أرجوح', 'طربيز', 'بوف', 'فاز', 'ديكور'], visible: true },
  ],
  productMatrices: [
    {
      id: 'matrix_featured_1',
      title: 'مختارات الورش المميزة',
      subtitle: 'قطع حصرية منتقاة بأعلى معايير الإتقان الحرفي',
      filterType: 'featured',
      desktopCols: 4,
      mobileCols: 2,
      limit: 4,
      enabled: false,
    },
  ],
  fxConfig: {
    autoSyncEnabled: true,
    silentBankBufferPercent: 2.5,
    ratesAgainstEgp: {
      EGP: 1.0,
      USD: 50.5,
      EUR: 54.2,
      SAR: 13.45,
      AED: 13.75,
      KWD: 164.2,
      QAR: 13.85,
      GBP: 64.8,
      TRY: 1.45,
    },
    lastSyncedAt: '',
    sourceLabel: 'أسعار الصرف الافتراضية',
  },
};

export function isClientHiddenForWorkshop(
  builder: MarketplaceBuilderConfig,
  workshopId?: string,
  fallbackHidden = false
): boolean {
  const mode = builder.clientVisibilityMode || 'show_all';
  if (mode === 'show_all') return false;
  if (mode === 'hide_all') return true;
  if (workshopId && builder.workshopClientVisibility && workshopId in builder.workshopClientVisibility) {
    return builder.workshopClientVisibility[workshopId] === 'hide';
  }
  return fallbackHidden;
}

export function normalizeMarketBuilderConfig(raw?: Partial<MarketplaceBuilderConfig> | null): MarketplaceBuilderConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_MARKET_BUILDER_CONFIG };
  }
  const validPreset =
    raw.themePreset && raw.themePreset in MARKET_THEME_PRESETS
      ? raw.themePreset
      : DEFAULT_MARKET_BUILDER_CONFIG.themePreset;

  const validVisMode: ClientVisibilityMode =
    raw.clientVisibilityMode === 'show_all' ||
    raw.clientVisibilityMode === 'hide_all' ||
    raw.clientVisibilityMode === 'custom_per_workshop'
      ? raw.clientVisibilityMode
      : DEFAULT_MARKET_BUILDER_CONFIG.clientVisibilityMode;

  return {
    ...DEFAULT_MARKET_BUILDER_CONFIG,
    ...raw,
    themePreset: validPreset,
    clientVisibilityMode: validVisMode,
    workshopClientVisibility:
      raw.workshopClientVisibility && typeof raw.workshopClientVisibility === 'object'
        ? raw.workshopClientVisibility
        : {},
    productBadges:
      raw.productBadges && typeof raw.productBadges === 'object'
        ? raw.productBadges
        : {},
    promoBanner: {
      ...DEFAULT_MARKET_BUILDER_CONFIG.promoBanner,
      ...(raw.promoBanner || {}),
    },
    tickerBanner: {
      ...DEFAULT_MARKET_BUILDER_CONFIG.tickerBanner,
      ...(raw.tickerBanner || {}),
    },
    flashOffer: {
      ...DEFAULT_MARKET_BUILDER_CONFIG.flashOffer,
      ...(raw.flashOffer || {}),
    },
    loyalty: {
      ...DEFAULT_MARKET_BUILDER_CONFIG.loyalty,
      ...(raw.loyalty || {}),
    },
    shippingModeNotices: {
      ...DEFAULT_MARKET_BUILDER_CONFIG.shippingModeNotices,
      ...(raw.shippingModeNotices || {}),
    },
    estimatedDelivery: {
      ...DEFAULT_MARKET_BUILDER_CONFIG.estimatedDelivery,
      ...(raw.estimatedDelivery || {}),
    },
    whatsappSupport: {
      ...DEFAULT_MARKET_BUILDER_CONFIG.whatsappSupport,
      ...(raw.whatsappSupport || {}),
    },
    coupons: Array.isArray(raw.coupons)
      ? raw.coupons
      : DEFAULT_MARKET_BUILDER_CONFIG.coupons,
    pageBlocksOrder:
      Array.isArray(raw.pageBlocksOrder) && raw.pageBlocksOrder.length > 0
        ? raw.pageBlocksOrder
        : DEFAULT_MARKET_BUILDER_CONFIG.pageBlocksOrder,
    decorCategoriesOrder:
      Array.isArray(raw.decorCategoriesOrder) && raw.decorCategoriesOrder.length > 0
        ? raw.decorCategoriesOrder
        : DEFAULT_MARKET_BUILDER_CONFIG.decorCategoriesOrder,
    productMatrices:
      Array.isArray(raw.productMatrices)
        ? raw.productMatrices
        : DEFAULT_MARKET_BUILDER_CONFIG.productMatrices,
    fxConfig: {
      ...DEFAULT_MARKET_BUILDER_CONFIG.fxConfig,
      ...(raw.fxConfig || {}),
      silentBankBufferPercent:
        raw.fxConfig?.silentBankBufferPercent !== undefined && Number.isFinite(Number(raw.fxConfig.silentBankBufferPercent))
          ? Math.max(0, Math.min(25, Number(raw.fxConfig.silentBankBufferPercent)))
          : DEFAULT_MARKET_BUILDER_CONFIG.fxConfig.silentBankBufferPercent,
      ratesAgainstEgp: {
        ...DEFAULT_MARKET_BUILDER_CONFIG.fxConfig.ratesAgainstEgp,
        ...(raw.fxConfig?.ratesAgainstEgp || {}),
        EGP: 1.0,
      },
    },
  };
}

export function getStoredMarketBuilderConfig(): MarketplaceBuilderConfig {
  try {
    if (typeof window === 'undefined') return { ...DEFAULT_MARKET_BUILDER_CONFIG };
    const raw = localStorage.getItem(MARKET_BUILDER_STORAGE_KEY);
    if (raw) {
      return normalizeMarketBuilderConfig(JSON.parse(raw));
    }
  } catch {}
  return { ...DEFAULT_MARKET_BUILDER_CONFIG };
}

export function saveStoredMarketBuilderConfig(cfg: MarketplaceBuilderConfig): void {
  try {
    if (typeof window === 'undefined') return;
    const normalized = normalizeMarketBuilderConfig(cfg);
    localStorage.setItem(MARKET_BUILDER_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent('alshams_market_builder_updated', { detail: normalized }));
  } catch {}
}

export async function compressImageFileToDataUrl(
  file: File,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.8
): Promise<string> {
  return compressImageFile(file, {
    maxWidth,
    maxHeight,
    initialQuality: quality,
    targetMaxKb: maxWidth > 1100 ? 155 : 95,
    preserveTransparency: file.type === 'image/png' && maxWidth <= 512,
  });
}
