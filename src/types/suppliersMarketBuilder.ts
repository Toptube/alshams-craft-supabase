import { MarketThemePresetId, MARKET_THEME_PRESETS } from './marketplaceBuilder';
import { SUPPLIER_SUPPLY_SECTIONS } from './supplier';

export type SuppliersMarketBlockId =
  | 'ticker'
  | 'hero'
  | 'offer_alerts'
  | 'filters'
  | 'main_content';

export interface SuppliersMarketPageBlock {
  id: SuppliersMarketBlockId;
  labelAr: string;
  enabled: boolean;
}

export interface SuppliersMarketSectionConfig {
  id: string;
  titleAr: string;
  enabled: boolean;
}

export interface SuppliersMarketBuilderConfig {
  themePreset: MarketThemePresetId;
  marketStatus: 'open' | 'maintenance';
  maintenanceMessage: string;
  tickerBanner: {
    enabled: boolean;
    text: string;
    bgColor: string;
  };
  heroEnabled: boolean;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  defaultViewMode: 'suppliers' | 'materials' | 'compare';
  pageBlocksOrder: SuppliersMarketPageBlock[];
  sectionsOrder: SuppliersMarketSectionConfig[];
  featuredSupplierIds: string[];
  featureToggles: {
    showOfferAlertsStrip: boolean;
    showComparisonTab: boolean;
    showWorkshopReviews: boolean;
    showTierPricingBadges: boolean;
    allowGuestBrowsing: boolean;
  };
  b2bPolicy: {
    minOrderAmountEgp: number;
    defaultPlatformShippingNotice: string;
    whatsappSupportEnabled: boolean;
    whatsappSupportPhone: string;
    whatsappSupportLabel: string;
    officialB2BCommissionNote: string;
  };
  updatedAt?: string;
}

export const SUPPLIERS_MARKET_BUILDER_STORAGE_KEY = 'alshams_suppliers_market_builder_v1';

export const DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG: SuppliersMarketBuilderConfig = {
  themePreset: 'shams_sand',
  marketStatus: 'open',
  maintenanceMessage: 'جاري تحديث قوائم الأسعار وعروض الموردين حالياً، سيعود سوق موردين الشمساوية للعمل خلال دقائق.',
  tickerBanner: {
    enabled: true,
    text: '🚚 توريد مباشر من المصانع والمستوردين المعتمدين إلى ورشتك · أسعار جملة وشرائح كميات شفافة وتحديث فوري للمخزون',
    bgColor: '#0C1427',
  },
  heroEnabled: true,
  heroEyebrow: 'سوق الخامات B2B · مصانع ومستوردون معتمدون',
  heroTitle: 'سوق موردين الشمساوية للخامات (B2B)',
  heroSubtitle: 'قارن أسعار القطاعي والجملة وشرائح الكميات، واطلب خامات ورشتك لترحيلها آلياً للمخزن والخزينة.',
  defaultViewMode: 'suppliers',
  pageBlocksOrder: [
    { id: 'ticker', labelAr: 'شريط الأخبار وعروض التوريد العلوي', enabled: true },
    { id: 'hero', labelAr: 'بطاقة العنوان التعريفي للسوق (Hero)', enabled: true },
    { id: 'filters', labelAr: 'أشرطة البحث والتصفية وأوضاع العرض', enabled: true },
    { id: 'offer_alerts', labelAr: 'شريط تنبيهات العروض والوصول الجديد', enabled: true },
    { id: 'main_content', labelAr: 'دليل الموردين وجداول المقارنة والخامات', enabled: true },
  ],
  sectionsOrder: SUPPLIER_SUPPLY_SECTIONS.map((s) => ({
    id: s.id,
    titleAr: s.titleAr,
    enabled: true,
  })),
  featuredSupplierIds: [],
  featureToggles: {
    showOfferAlertsStrip: true,
    showComparisonTab: true,
    showWorkshopReviews: true,
    showTierPricingBadges: true,
    allowGuestBrowsing: true,
  },
  b2bPolicy: {
    minOrderAmountEgp: 0,
    defaultPlatformShippingNotice:
      'يتم تجهيز طلبات التوريد وتأكيد الفاتورة ومواعيد الشحن مباشرة بين الورشة والمورد المعتمد تحت إشراف منظومة الشمساوية.',
    whatsappSupportEnabled: true,
    whatsappSupportPhone: '201000996059',
    whatsappSupportLabel: 'دعم التوريد B2B',
    officialB2BCommissionNote: 'تخضع كافة طلبات التوريد لسياسة جودة الخامات وضمان التسليم بالمنظومة.',
  },
};

export function normalizeSuppliersMarketBuilderConfig(
  raw?: Partial<SuppliersMarketBuilderConfig> | null
): SuppliersMarketBuilderConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG };
  }

  const validPreset =
    raw.themePreset && raw.themePreset in MARKET_THEME_PRESETS
      ? raw.themePreset
      : DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG.themePreset;

  const validViewMode =
    raw.defaultViewMode === 'suppliers' ||
    raw.defaultViewMode === 'materials' ||
    raw.defaultViewMode === 'compare'
      ? raw.defaultViewMode
      : DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG.defaultViewMode;

  const defaultSectionsMap = new Map(
    DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG.sectionsOrder.map((s) => [s.id, s])
  );
  let sectionsOrder = DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG.sectionsOrder;
  if (Array.isArray(raw.sectionsOrder) && raw.sectionsOrder.length > 0) {
    const seen = new Set<string>();
    const normalized: SuppliersMarketSectionConfig[] = [];
    raw.sectionsOrder.forEach((sec) => {
      if (sec?.id && !seen.has(sec.id)) {
        seen.add(sec.id);
        const fallback = defaultSectionsMap.get(sec.id);
        normalized.push({
          id: sec.id,
          titleAr: sec.titleAr || fallback?.titleAr || sec.id,
          enabled: sec.enabled !== false,
        });
      }
    });
    DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG.sectionsOrder.forEach((defSec) => {
      if (!seen.has(defSec.id)) normalized.push(defSec);
    });
    sectionsOrder = normalized;
  }

  return {
    ...DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG,
    ...raw,
    themePreset: validPreset,
    marketStatus: raw.marketStatus === 'maintenance' ? 'maintenance' : 'open',
    defaultViewMode: validViewMode,
    tickerBanner: {
      ...DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG.tickerBanner,
      ...(raw.tickerBanner || {}),
    },
    pageBlocksOrder:
      Array.isArray(raw.pageBlocksOrder) && raw.pageBlocksOrder.length > 0
        ? raw.pageBlocksOrder
        : DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG.pageBlocksOrder,
    sectionsOrder,
    featuredSupplierIds: Array.isArray(raw.featuredSupplierIds) ? raw.featuredSupplierIds : [],
    featureToggles: {
      ...DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG.featureToggles,
      ...(raw.featureToggles || {}),
    },
    b2bPolicy: {
      ...DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG.b2bPolicy,
      ...(raw.b2bPolicy || {}),
    },
  };
}

export function getStoredSuppliersMarketBuilderConfig(): SuppliersMarketBuilderConfig {
  try {
    if (typeof window === 'undefined') return { ...DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG };
    const raw = localStorage.getItem(SUPPLIERS_MARKET_BUILDER_STORAGE_KEY);
    if (raw) {
      return normalizeSuppliersMarketBuilderConfig(JSON.parse(raw));
    }
  } catch {}
  return { ...DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG };
}

export function saveStoredSuppliersMarketBuilderConfig(cfg: SuppliersMarketBuilderConfig): void {
  try {
    if (typeof window === 'undefined') return;
    const normalized = normalizeSuppliersMarketBuilderConfig(cfg);
    localStorage.setItem(SUPPLIERS_MARKET_BUILDER_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent('alshams_suppliers_market_builder_updated', { detail: normalized }));
  } catch {}
}
