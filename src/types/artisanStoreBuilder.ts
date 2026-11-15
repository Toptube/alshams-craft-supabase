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

export interface ProductDiscountConfig {
  enabled: boolean;
  type: 'percent' | 'fixed' | 'free_shipping';
  value: number;
  isLimitedTime: boolean;
  endsAt?: string;
  badgeText?: string;
}

export interface ArtisanPortfolioGalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  beforeImageUrl?: string;
  caption?: string;
}

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
}

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
  showPortfolioGallery: boolean;
  portfolioTitle: string;
  portfolioItems: ArtisanPortfolioGalleryItem[];
  updatedAt?: string;
}

export const ARTISAN_STORE_CONFIG_PREFIX = 'alshams_artisan_store_cfg_';
export const ARTISAN_STORE_COUPONS_INDEX_KEY = 'alshams_artisan_store_coupons_index';

export const DEFAULT_ARTISAN_STORE_CONFIG: ArtisanStoreConfig = {
  themePreset: 'shams_sand',
  storeCurrency: 'EGP',
  coverUrl: '',
  showCover: true,
  showBrandTitle: true,
  showArtistSubtitle: true,
  welcomeMessage: 'أهلاً بك في متجرنا — قطع يدوية مصنوعة بحب وإتقان خصيصاً لمنزلك',
  showWelcomeMessage: true,
  artistStory: 'نصنع كل قطعة يدوياً بخامات مختارة بعناية ولمسات فنية فريدة تعكس روح الحرفة المصرية الأصيلة.',
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
  },
  couponsEnabled: true,
  coupons: [],
  showPortfolioGallery: false,
  portfolioTitle: 'معرض أعمالنا السابقة ولمسات التنفيذ (قبل وبعد)',
  portfolioItems: [],
};

export function normalizeArtisanStoreConfig(
  raw?: Partial<ArtisanStoreConfig> | null
): ArtisanStoreConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_ARTISAN_STORE_CONFIG,
      promoBanner: { ...DEFAULT_ARTISAN_STORE_CONFIG.promoBanner },
      coupons: [],
      portfolioItems: [],
    };
  }
  const validPreset =
    raw.themePreset && raw.themePreset in MARKET_THEME_PRESETS
      ? raw.themePreset
      : DEFAULT_ARTISAN_STORE_CONFIG.themePreset;

  return {
    ...DEFAULT_ARTISAN_STORE_CONFIG,
    ...raw,
    themePreset: validPreset,
    storeCurrency: getCurrencyInfo(raw.storeCurrency || 'EGP').code,
    promoBanner: {
      ...DEFAULT_ARTISAN_STORE_CONFIG.promoBanner,
      ...(raw.promoBanner || {}),
    },
    coupons: Array.isArray(raw.coupons) ? raw.coupons : [],
    portfolioItems: Array.isArray(raw.portfolioItems) ? raw.portfolioItems : [],
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
}

export function isLimitedOfferCurrentlyActive(discount?: ProductDiscountConfig | null): boolean {
  if (!discount || !discount.enabled || !discount.isLimitedTime) return false;
  if (!discount.endsAt) return true;
  const endMs = new Date(discount.endsAt).getTime();
  if (!Number.isFinite(endMs)) return true;
  return endMs > Date.now();
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
  const egpOriginal = Math.max(0, toEgpAmount(baseRawPrice, effectiveSourceCode));

  const discount = product.product_discount || product.productDiscount;
  let egpAfterDiscount = egpOriginal;
  let isFreeShipping = false;
  let hasDiscount = false;
  let discountPercent = 0;

  const isLimitedActive = isLimitedOfferCurrentlyActive(discount);
  const discountValid = Boolean(
    discount &&
      discount.enabled &&
      (!discount.isLimitedTime || isLimitedActive)
  );

  if (discountValid && discount) {
    if (discount.type === 'free_shipping') {
      isFreeShipping = true;
    } else if (discount.type === 'percent' && discount.value > 0) {
      const pct = Math.min(90, Math.max(1, Number(discount.value) || 0));
      egpAfterDiscount = Math.max(1, Math.round(egpOriginal * (1 - pct / 100)));
      discountPercent = Math.round(pct);
      hasDiscount = egpAfterDiscount < egpOriginal;
    } else if (discount.type === 'fixed' && discount.value > 0) {
      const fixedInEgp = toEgpAmount(Number(discount.value) || 0, sourceCurrency);
      egpAfterDiscount = Math.max(1, Math.round(egpOriginal - fixedInEgp));
      if (egpOriginal > 0 && egpAfterDiscount < egpOriginal) {
        discountPercent = Math.max(1, Math.round(((egpOriginal - egpAfterDiscount) / egpOriginal) * 100));
        hasDiscount = true;
      }
    }
  }

  const originalDisplay = convertBetweenCurrencies(egpOriginal, 'EGP', displayMeta.code);
  const finalDisplay = convertBetweenCurrencies(egpAfterDiscount, 'EGP', displayMeta.code);

  let badgeText: string | null = null;
  if (discountValid && discount) {
    if (discount.isLimitedTime && isLimitedActive) {
      badgeText = discount.badgeText?.trim() || 'عرض لفترة محدودة';
    } else if (discount.type === 'free_shipping') {
      badgeText = discount.badgeText?.trim() || 'شحن مجاني';
    } else if (hasDiscount && discountPercent > 0) {
      badgeText = discount.badgeText?.trim() || `خصم ${discountPercent}%`;
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
  };
}
