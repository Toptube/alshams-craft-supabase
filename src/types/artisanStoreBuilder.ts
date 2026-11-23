import {
  MarketCouponConfig,
  MarketThemePresetId,
  MARKET_THEME_PRESETS,
} from './marketplaceBuilder';
import { convertBetweenCurrencies, getCurrencyInfo, toEgpAmount } from '../lib/currency';
import { supabase } from '../lib/supabase';

export interface ProductSizeVariant {
  id: string;
  label: string;
  price: number; // Price in product's sourceCurrency
  egpPrice?: number; // Auto-normalized EGP price for central marketplace
}

export type ProductOfferType =
  | 'percent'
  | 'fixed'
  | 'free_shipping'
  | 'before_after'
  | 'bogo'
  | 'special_offer';

export interface ProductDiscountConfig {
  enabled: boolean;
  type: ProductOfferType;
  value: number;
  applyMode?: 'automatic' | 'coupon';
  linkedCouponCode?: string;
  originalPrice?: number;
  offerPrice?: number;
  buyQty?: number;
  freeQty?: number;
  isLimitedTime: boolean;
  startsAt?: string;
  endsAt?: string;
  badgeText?: string;
  isBestSeller?: boolean;
  isSpecialOffer?: boolean;
}

export interface ArtisanPortfolioGalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  beforeImageUrl?: string;
  caption?: string;
}

export type BannerMotionMode = 'static' | 'marquee' | 'slide' | 'vertical_ticker';
export type BannerOrientation = 'horizontal' | 'vertical';
export type BannerDirection = 'rtl' | 'ltr' | 'up' | 'down';
export type BannerSpeed = 'slow' | 'normal' | 'fast';

export interface ArtisanStorePromoBanner {
  enabled: boolean;
  text: string;
  subText: string;
  showSubText: boolean;
  triggerType: 'limited_time' | 'min_order' | 'always';
  endsAt?: string;
  minOrderAmount?: number;
  discountLabel: string;
  showDiscountLabel: boolean;
  bgColor: string;
  motionMode?: BannerMotionMode;
  orientation?: BannerOrientation;
  direction?: BannerDirection;
  speed?: BannerSpeed;
  extraMessages?: string[];
  showActiveCouponsInBanner?: boolean;
}

export type ArtisanContactDisplayMode = 'both' | 'footer' | 'floating_bubble';

export interface ArtisanSocialLinksConfig {
  displayMode: ArtisanContactDisplayMode;
  bubbleLabel: string;
  phone: string;
  showPhone: boolean;
  whatsapp: string;
  showWhatsapp: boolean;
  facebook: string;
  showFacebook: boolean;
  instagram: string;
  showInstagram: boolean;
  tiktok: string;
  showTiktok: boolean;
  youtube: string;
  showYoutube: boolean;
  website: string;
  showWebsite: boolean;
}

export interface ArtisanBundleDealConfig {
  enabled: boolean;
  minQuantity: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  label: string;
}

export type StorefrontSectionId =
  | 'promo_banner'
  | 'hero_header'
  | 'products_grid'
  | 'portfolio_gallery'
  | 'contact_footer';

export const DEFAULT_STOREFRONT_SECTION_ORDER: StorefrontSectionId[] = [
  'promo_banner',
  'hero_header',
  'products_grid',
  'portfolio_gallery',
  'contact_footer',
];

export interface ArtisanStoreConfig {
  themePreset: MarketThemePresetId;
  storeCurrency: string;
  coverUrl: string;
  showCover: boolean;
  showBrandTitle: boolean;
  showArtistSubtitle: boolean;
  welcomeMessage: string;
  showWelcomeMessage: boolean;
  artistStory: string;
  showArtistStory: boolean;
  craftBadge: string;
  showCraftBadge: boolean;
  workingHours: string;
  showWorkingHours: boolean;
  productionTurnaround: string;
  showProductionTurnaround: boolean;
  customOrderBadgeText: string;
  showCustomOrderBadge: boolean;
  showPhoneButtons: boolean;
  showDeliveryBadge: boolean;
  promoBanner: ArtisanStorePromoBanner;
  couponsEnabled: boolean;
  coupons: MarketCouponConfig[];
  bundleDeal: ArtisanBundleDealConfig;
  socialLinks: ArtisanSocialLinksConfig;
  showPortfolioGallery: boolean;
  portfolioTitle: string;
  portfolioItems: ArtisanPortfolioGalleryItem[];
  sectionOrder?: StorefrontSectionId[];
  hiddenSections?: StorefrontSectionId[];
  updatedAt?: string;
}

export const ARTISAN_STORE_CONFIG_PREFIX = 'alshams_artisan_store_cfg_';
export const ARTISAN_STORE_COUPONS_INDEX_KEY = 'alshams_artisan_store_coupons_index';
export const ARTISAN_STORE_BUNDLES_INDEX_KEY = 'alshams_artisan_store_bundles_index';

export const DEFAULT_ARTISAN_STORY =
  'نصنع كل قطعة يدوياً بخامات مختارة بعناية ولمسات فنية فريدة تعكس روح الحرفة المصرية الأصيلة.';

export const DEFAULT_ARTISAN_STORE_CONFIG: ArtisanStoreConfig = {
  themePreset: 'shams_sand',
  storeCurrency: 'EGP',
  coverUrl: '',
  showCover: true,
  showBrandTitle: true,
  showArtistSubtitle: true,
  welcomeMessage: 'أهلاً بك في متجرنا — قطع يدوية مصنوعة بحب وإتقان خصيصاً لمنزلك',
  showWelcomeMessage: true,
  artistStory: DEFAULT_ARTISAN_STORY,
  showArtistStory: true,
  craftBadge: 'مشغولات يدوية أصلية 100%',
  showCraftBadge: true,
  workingHours: 'يومياً من 10 صباحاً حتى 10 مساءً',
  showWorkingHours: true,
  productionTurnaround: 'مدة التنفيذ من 3 إلى 6 أيام عمل',
  showProductionTurnaround: true,
  customOrderBadgeText: 'متاح التنفيذ الخاص بألوان ومقاسات حسب الطلب',
  showCustomOrderBadge: true,
  showPhoneButtons: true,
  showDeliveryBadge: true,
  promoBanner: {
    enabled: false,
    text: 'عرض خاص في متجرنا لفترة محدودة على كافة المشغولات المختارة',
    subText: 'تغليف هدايا فاخر وضمان جودة على كل قطعة',
    showSubText: true,
    triggerType: 'limited_time',
    endsAt: '',
    minOrderAmount: 1000,
    discountLabel: 'خصم حصري',
    showDiscountLabel: true,
    bgColor: '#C2410C',
    motionMode: 'marquee',
    orientation: 'horizontal',
    direction: 'rtl',
    speed: 'normal',
    extraMessages: [],
    showActiveCouponsInBanner: true,
  },
  couponsEnabled: true,
  coupons: [],
  bundleDeal: {
    enabled: false,
    minQuantity: 2,
    discountType: 'percent',
    discountValue: 10,
    label: 'عرض الباقة: اشترِ قطعتين أو أكثر واحصل على خصم إضافي تلقائي بالسلة',
  },
  socialLinks: {
    displayMode: 'both',
    bubbleLabel: 'تواصل معي',
    phone: '',
    showPhone: true,
    whatsapp: '',
    showWhatsapp: true,
    facebook: '',
    showFacebook: true,
    instagram: '',
    showInstagram: true,
    tiktok: '',
    showTiktok: true,
    youtube: '',
    showYoutube: true,
    website: '',
    showWebsite: true,
  },
  showPortfolioGallery: false,
  portfolioTitle: 'معرض أعمالنا السابقة ولمسات التنفيذ (قبل وبعد)',
  portfolioItems: [],
  sectionOrder: [...DEFAULT_STOREFRONT_SECTION_ORDER],
  hiddenSections: [],
};

export function normalizeArtisanStoreConfig(
  raw?: Partial<ArtisanStoreConfig> | null
): ArtisanStoreConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_ARTISAN_STORE_CONFIG,
      promoBanner: { ...DEFAULT_ARTISAN_STORE_CONFIG.promoBanner },
      bundleDeal: { ...DEFAULT_ARTISAN_STORE_CONFIG.bundleDeal },
      socialLinks: { ...DEFAULT_ARTISAN_STORE_CONFIG.socialLinks },
      coupons: [],
      portfolioItems: [],
      sectionOrder: [...DEFAULT_STOREFRONT_SECTION_ORDER],
      hiddenSections: [],
    };
  }
  const validPreset =
    raw.themePreset && raw.themePreset in MARKET_THEME_PRESETS
      ? raw.themePreset
      : DEFAULT_ARTISAN_STORE_CONFIG.themePreset;

  const validDisplayMode: ArtisanContactDisplayMode =
    raw.socialLinks?.displayMode === 'footer' ||
    raw.socialLinks?.displayMode === 'floating_bubble' ||
    raw.socialLinks?.displayMode === 'both'
      ? raw.socialLinks.displayMode
      : 'both';

  const validSectionSet = new Set<StorefrontSectionId>(DEFAULT_STOREFRONT_SECTION_ORDER);
  const rawOrder = Array.isArray(raw.sectionOrder)
    ? raw.sectionOrder.filter((s): s is StorefrontSectionId => validSectionSet.has(s as StorefrontSectionId))
    : [];
  const mergedOrder: StorefrontSectionId[] = [
    ...Array.from(new Set(rawOrder)),
    ...DEFAULT_STOREFRONT_SECTION_ORDER.filter((s) => !rawOrder.includes(s)),
  ];
  const hiddenSections: StorefrontSectionId[] = Array.isArray(raw.hiddenSections)
    ? Array.from(
        new Set(
          raw.hiddenSections.filter((s): s is StorefrontSectionId => validSectionSet.has(s as StorefrontSectionId))
        )
      )
    : [];

  return {
    ...DEFAULT_ARTISAN_STORE_CONFIG,
    ...raw,
    themePreset: validPreset,
    storeCurrency: getCurrencyInfo(raw.storeCurrency || 'EGP').code,
    promoBanner: {
      ...DEFAULT_ARTISAN_STORE_CONFIG.promoBanner,
      ...(raw.promoBanner || {}),
    },
    bundleDeal: {
      ...DEFAULT_ARTISAN_STORE_CONFIG.bundleDeal,
      ...(raw.bundleDeal || {}),
      minQuantity: Math.max(2, Number(raw.bundleDeal?.minQuantity) || 2),
      discountValue: Math.max(0, Number(raw.bundleDeal?.discountValue) || 0),
    },
    socialLinks: {
      ...DEFAULT_ARTISAN_STORE_CONFIG.socialLinks,
      ...(raw.socialLinks || {}),
      displayMode: validDisplayMode,
      bubbleLabel: raw.socialLinks?.bubbleLabel?.trim() || 'تواصل معي',
    },
    coupons: Array.isArray(raw.coupons) ? raw.coupons : [],
    portfolioItems: Array.isArray(raw.portfolioItems) ? raw.portfolioItems : [],
    sectionOrder: mergedOrder,
    hiddenSections,
  };
}

export function seedArtisanSocialDefaults(
  cfg: ArtisanStoreConfig,
  fallbackPhone?: string
): ArtisanStoreConfig {
  const cleanPhone = (fallbackPhone || '').trim();
  if (!cleanPhone) return cfg;
  const sl = cfg.socialLinks || DEFAULT_ARTISAN_STORE_CONFIG.socialLinks;
  if (sl.phone?.trim() && sl.whatsapp?.trim()) return cfg;
  return {
    ...cfg,
    socialLinks: {
      ...sl,
      phone: sl.phone?.trim() || cleanPhone,
      whatsapp: sl.whatsapp?.trim() || cleanPhone,
    },
  };
}

export function getStoredArtisanStoreConfig(workshopId?: string): ArtisanStoreConfig {
  if (!workshopId || typeof window === 'undefined') {
    return normalizeArtisanStoreConfig(null);
  }
  try {
    const raw = localStorage.getItem(`${ARTISAN_STORE_CONFIG_PREFIX}${workshopId}`);
    if (raw) {
      return normalizeArtisanStoreConfig(JSON.parse(raw));
    }
  } catch {}
  return normalizeArtisanStoreConfig(null);
}

function updateLocalCouponsIndex(workshopId: string, cfg: ArtisanStoreConfig): void {
  if (typeof window === 'undefined' || !workshopId) return;
  try {
    const rawIdx = localStorage.getItem(ARTISAN_STORE_COUPONS_INDEX_KEY);
    const map: Record<string, MarketCouponConfig[]> = rawIdx ? JSON.parse(rawIdx) : {};
    map[workshopId] = cfg.couponsEnabled ? cfg.coupons.filter((c) => c.active) : [];
    localStorage.setItem(ARTISAN_STORE_COUPONS_INDEX_KEY, JSON.stringify(map));

    const rawBundles = localStorage.getItem(ARTISAN_STORE_BUNDLES_INDEX_KEY);
    const bMap: Record<string, ArtisanBundleDealConfig | null> = rawBundles ? JSON.parse(rawBundles) : {};
    bMap[workshopId] = cfg.bundleDeal?.enabled ? cfg.bundleDeal : null;
    localStorage.setItem(ARTISAN_STORE_BUNDLES_INDEX_KEY, JSON.stringify(bMap));
  } catch {}
}

export function getLocalWorkshopCouponsMap(): Record<string, MarketCouponConfig[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ARTISAN_STORE_COUPONS_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getLocalWorkshopBundlesMap(): Record<string, ArtisanBundleDealConfig> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ARTISAN_STORE_BUNDLES_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    const cleaned: Record<string, ArtisanBundleDealConfig> = {};
    Object.entries(parsed).forEach(([wid, b]: [string, any]) => {
      if (b && b.enabled) cleaned[wid] = b;
    });
    return cleaned;
  } catch {
    return {};
  }
}

export function saveStoredArtisanStoreConfig(
  workshopId: string,
  cfg: ArtisanStoreConfig
): ArtisanStoreConfig {
  const normalized = normalizeArtisanStoreConfig({
    ...cfg,
    updatedAt: new Date().toISOString(),
  });
  if (typeof window !== 'undefined' && workshopId) {
    try {
      localStorage.setItem(`${ARTISAN_STORE_CONFIG_PREFIX}${workshopId}`, JSON.stringify(normalized));
      updateLocalCouponsIndex(workshopId, normalized);
      window.dispatchEvent(
        new CustomEvent('alshams_artisan_store_config_updated', {
          detail: { workshopId, config: normalized },
        })
      );
    } catch {}
  }
  return normalized;
}

export async function saveArtisanStoreConfigCloud(
  workshopId: string,
  cfg: ArtisanStoreConfig,
  userEmail?: string
): Promise<{ success: boolean; cloudSynced?: boolean; config: ArtisanStoreConfig }> {
  const saved = saveStoredArtisanStoreConfig(workshopId, cfg);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userEmail) headers['x-user-email'] = userEmail;
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers['Authorization'] = `Bearer ${data.session.access_token}`;
      }
    } catch {}

    const res = await fetch('/api/store/config', {
      method: 'POST',
      headers,
      body: JSON.stringify({ workshopId, storeConfig: saved }),
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      return { success: true, cloudSynced: Boolean(json.cloudSynced), config: saved };
    }
  } catch {}
  return { success: true, cloudSynced: false, config: saved };
}

export interface ResolvedOfferPricing {
  sourceCurrency: string;
  displayCurrency: string;
  displaySymbol: string;
  originalPrice: number;
  finalPrice: number;
  egpOriginalPrice: number;
  egpFinalPrice: number;
  hasDiscount: boolean;
  discountPercent: number;
  isFreeShipping: boolean;
  isLimitedTimeActive: boolean;
  badgeText: string | null;
  bogoLabel: string | null;
  couponRequiredCode: string | null;
  isBestSeller: boolean;
  isSpecialOffer: boolean;
  endsAt?: string;
}

export function isLimitedOfferCurrentlyActive(discount?: ProductDiscountConfig | null): boolean {
  if (!discount || !discount.enabled || !discount.isLimitedTime) return false;
  const now = Date.now();
  if (discount.startsAt) {
    const startMs = new Date(discount.startsAt).getTime();
    if (Number.isFinite(startMs) && startMs > now) return false;
  }
  if (!discount.endsAt) return true;
  const endMs = new Date(discount.endsAt).getTime();
  if (!Number.isFinite(endMs)) return true;
  return endMs > now;
}

export function resolveProductOfferPricing(
  product: {
    store_price?: number;
    storePrice?: number;
    retail_price?: number;
    retailPrice?: number;
    source_currency?: string;
    sourceCurrency?: string;
    size_variants?: ProductSizeVariant[];
    sizeVariants?: ProductSizeVariant[];
    product_discount?: ProductDiscountConfig;
    productDiscount?: ProductDiscountConfig;
  },
  selectedSizeLabel?: string,
  targetDisplayCurrency = 'EGP',
  priceAlreadyNormalizedToEgp = false
): ResolvedOfferPricing {
  const sourceCurrency = getCurrencyInfo(
    product.source_currency || product.sourceCurrency || 'EGP'
  ).code;
  const displayMeta = getCurrencyInfo(targetDisplayCurrency);

  const variants = product.size_variants || product.sizeVariants || [];
  const matchedVariant =
    selectedSizeLabel && variants.length > 0
      ? variants.find((v) => v.label === selectedSizeLabel)
      : undefined;

  let baseRawPrice = Number(
    product.store_price ?? product.storePrice ?? product.retail_price ?? product.retailPrice ?? 0
  );

  if (matchedVariant) {
    if (priceAlreadyNormalizedToEgp) {
      baseRawPrice =
        Number(matchedVariant.egpPrice) > 0
          ? Number(matchedVariant.egpPrice)
          : toEgpAmount(Number(matchedVariant.price) || 0, sourceCurrency);
    } else {
      baseRawPrice = Number(matchedVariant.price) || baseRawPrice;
    }
  }

  const effectiveSourceCode = priceAlreadyNormalizedToEgp ? 'EGP' : sourceCurrency;
  let egpOriginal = Math.max(0, toEgpAmount(baseRawPrice, effectiveSourceCode));

  const discount = product.product_discount || product.productDiscount;
  let egpAfterDiscount = egpOriginal;
  let isFreeShipping = false;
  let hasDiscount = false;
  let discountPercent = 0;
  let bogoLabel: string | null = null;
  let couponRequiredCode: string | null = null;

  const isLimitedActive = isLimitedOfferCurrentlyActive(discount);
  const discountValid = Boolean(
    discount &&
      discount.enabled &&
      (!discount.isLimitedTime || isLimitedActive)
  );
  const isCouponOnly = discountValid && discount?.applyMode === 'coupon' && Boolean(discount?.linkedCouponCode?.trim());
  if (isCouponOnly && discount?.linkedCouponCode) {
    couponRequiredCode = discount.linkedCouponCode.trim().toUpperCase();
  }

  if (discountValid && discount) {
    if (discount.type === 'free_shipping') {
      isFreeShipping = true;
    } else if (discount.type === 'bogo') {
      const buyQty = Math.max(1, Number(discount.buyQty) || 2);
      const freeQty = Math.max(1, Number(discount.freeQty) || 1);
      bogoLabel = `اشتري ${buyQty} + ${freeQty} مجاناً`;
    } else if (discount.type === 'before_after') {
      const customBefore = Number(discount.originalPrice || 0);
      const customAfter = Number(discount.offerPrice || 0);
      const beforeEgp = customBefore > 0 ? toEgpAmount(customBefore, sourceCurrency) : egpOriginal;
      const afterEgp = customAfter > 0 ? toEgpAmount(customAfter, sourceCurrency) : egpOriginal;
      if (beforeEgp > afterEgp && afterEgp > 0) {
        egpOriginal = beforeEgp;
        if (!isCouponOnly) {
          egpAfterDiscount = afterEgp;
          hasDiscount = true;
        }
        discountPercent = Math.max(1, Math.round(((beforeEgp - afterEgp) / beforeEgp) * 100));
      }
    } else if (discount.type === 'percent' && discount.value > 0) {
      const pct = Math.min(90, Math.max(1, Number(discount.value) || 0));
      discountPercent = Math.round(pct);
      if (!isCouponOnly) {
        egpAfterDiscount = Math.max(1, Math.round(egpOriginal * (1 - pct / 100)));
        hasDiscount = egpAfterDiscount < egpOriginal;
      }
    } else if (discount.type === 'fixed' && discount.value > 0) {
      const fixedInEgp = toEgpAmount(Number(discount.value) || 0, sourceCurrency);
      const computedAfter = Math.max(1, Math.round(egpOriginal - fixedInEgp));
      if (egpOriginal > 0 && computedAfter < egpOriginal) {
        discountPercent = Math.max(1, Math.round(((egpOriginal - computedAfter) / egpOriginal) * 100));
        if (!isCouponOnly) {
          egpAfterDiscount = computedAfter;
          hasDiscount = true;
        }
      }
    }
  }

  const originalDisplay = convertBetweenCurrencies(egpOriginal, 'EGP', displayMeta.code);
  const finalDisplay = convertBetweenCurrencies(egpAfterDiscount, 'EGP', displayMeta.code);

  let badgeText: string | null = null;
  if (discountValid && discount) {
    if (discount.badgeText?.trim()) {
      badgeText = discount.badgeText.trim();
    } else if (bogoLabel) {
      badgeText = bogoLabel;
    } else if (couponRequiredCode) {
      badgeText = discountPercent > 0 ? `خصم ${discountPercent}% بكود ${couponRequiredCode}` : `عرض بكود ${couponRequiredCode}`;
    } else if (discount.isLimitedTime && isLimitedActive) {
      badgeText = discountPercent > 0 ? `عرض لفترة محدودة -${discountPercent}%` : 'سعر خاص لفترة محدودة';
    } else if (discount.type === 'free_shipping') {
      badgeText = 'شحن مجاني';
    } else if (discount.type === 'special_offer') {
      badgeText = 'عرض خاص';
    } else if (hasDiscount && discountPercent > 0) {
      badgeText = `خصم ${discountPercent}%`;
    }
  }

  return {
    sourceCurrency,
    displayCurrency: displayMeta.code,
    displaySymbol: displayMeta.symbol,
    originalPrice: originalDisplay,
    finalPrice: finalDisplay,
    egpOriginalPrice: egpOriginal,
    egpFinalPrice: egpAfterDiscount,
    hasDiscount,
    discountPercent,
    isFreeShipping,
    isLimitedTimeActive: isLimitedActive,
    badgeText,
    bogoLabel,
    couponRequiredCode,
    isBestSeller: Boolean(discount?.isBestSeller),
    isSpecialOffer: Boolean(discountValid && (discount?.isSpecialOffer || hasDiscount || bogoLabel || isFreeShipping || discount?.type === 'special_offer')),
    endsAt: discount?.isLimitedTime ? discount.endsAt : undefined,
  };
}
