import { MainSectionId } from '../registry/craftsRegistry';
import { UserProfile, Gender } from './index';

export type SupplierBusinessType = 'online' | 'shop' | 'factory';
export type SupplierPricingMode = 'retail' | 'wholesale' | 'both';
export type SupplierOrderSource =
  | 'direct_supplier_store'
  | 'suppliers_market'
  | 'external_manual';

export interface SupplierStoreCoupon {
  code: string;
  discountPercent: number;
  active: boolean;
}

export interface SupplierStoreConfig {
  tagline?: string;
  description?: string;
  themePreset?:
    | 'shams_sand'
    | 'royal_navy'
    | 'emerald_linen'
    | 'rose_clay'
    | 'midnight_gallery'
    | 'clean_alabaster'
    | 'arch_boutique'
    | 'bento_studio'
    | 'cinema_lookbook'
    | 'pop_atelier'
    | 'warm_atelier'
    | 'deep_navy'
    | 'emerald_craft'
    | 'minimal_stone';
  whatsappNumber?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  shippingNote?: string;
  freeShippingAbove?: number;
  coupons?: SupplierStoreCoupon[];
  acceptedCurrencies?: string[];
  showWholesalePricesPublicly?: boolean;
}

export interface SupplierProfile {
  id: string;
  ownerUid: string;
  email: string;
  brandName: string;
  ownerName: string;
  gender: Gender;
  phone: string;
  country: string;
  governorate?: string;
  currency: string;
  currencySymbol: string;
  storeSlug?: string;
  logoUrl?: string;
  businessTypes: SupplierBusinessType[];
  pricingModes: SupplierPricingMode[];
  supplySections: MainSectionId[];
  suppliedMaterials: string[];
  storeConfig?: SupplierStoreConfig;
  status: 'pending' | 'active' | 'suspended' | 'banned';
  isFrozen?: boolean;
  suspensionReason?: string;
  suspensionDuration?: string;
  suspendedUntil?: string | null;
  appealStatus?: 'none' | 'pending' | 'under_review' | 'accepted' | 'rejected';
  appealMessage?: string;
  rejectionReason?: string;
  medal?: string;
  ratingStars?: number;
  reviewsCount?: number;
  featuredRank?: number;
  hideStorefront?: boolean;
  hideFromMarket?: boolean;
  hasCentralWarehouse?: boolean;
  maxBranchesApproved?: number;
  branchExpansionRequested?: number;
  branchExpansionReason?: string;
  branchExpansionStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  termsAcceptedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierMarketEntry {
  supplier: SupplierProfile;
  items: SupplierCatalogItem[];
  minRetailPrice: number;
  maxRetailPrice: number;
  minWholesalePrice: number;
  maxWholesalePrice: number;
  hasWholesale: boolean;
  ratingAvg?: number;
  reviewsCount?: number;
}

export interface AdminCustomerDirectoryRow {
  id: string;
  workshopId: string;
  workshopBrand: string;
  artistName: string;
  name: string;
  phone: string;
  email?: string;
  country?: string;
  governorate?: string;
  source?: string;
  totalSpent: number;
  ordersCount: number;
  createdAt?: string;
}

export interface SupplierCatalogVariant {
  id: string;
  colorOrSize: string;
  thicknessOrSpec?: string;
  sku?: string;
  stockQty: number;
  retailPriceOverride?: number;
  wholesalePriceOverride?: number;
}

export interface SupplierPriceTier {
  minQty: number;
  unitPrice: number;
}

export interface SupplierReview {
  id: string;
  supplierId: string;
  workshopId?: string;
  reviewerName: string;
  reviewerBrand?: string;
  reviewerRole?: string;
  rating: number;
  comment: string;
  createdAt?: string;
}

export interface SupplierOfferAlert {
  id: string;
  supplierId: string;
  supplierBrand: string;
  supplierSlug?: string;
  alertType: 'offer' | 'new_stock' | 'price_drop';
  title: string;
  message: string;
  sectionId?: string;
  discountBadge?: string;
  createdAt?: string;
}

export interface SupplierCatalogItem {
  id: string;
  supplierId: string;
  sectionId: MainSectionId;
  craftId?: string;
  name: string;
  unit: string;
  description?: string;
  images: string[];
  videoUrl?: string;
  variants: SupplierCatalogVariant[];
  tierPricing?: SupplierPriceTier[];
  stockQty: number;
  retailPrice: number;
  wholesalePrice: number;
  minWholesaleQty: number;
  discountType: 'none' | 'percent' | 'fixed';
  discountValue: number;
  inStore: boolean;
  inMarket: boolean;
  isApproved: boolean;
  marketStatus?: 'none' | 'pending_approval' | 'approved' | 'rejected';
  reSubmitForApproval?: boolean;
  sourceCurrency?: string;
  unifiedCode?: string;
  specCode?: string;
  brandCode?: string;
  skuCode?: string;
  unitChain?: string;
  bridgeValues?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export function resolveSupplierItemPricing(
  item: Pick<
    SupplierCatalogItem,
    'retailPrice' | 'wholesalePrice' | 'minWholesaleQty' | 'tierPricing' | 'discountType' | 'discountValue'
  >,
  qty: number
) {
  const safeQty = Math.max(0.01, Number(qty || 1));
  const tiers = Array.isArray(item.tierPricing)
    ? [...item.tierPricing]
        .filter((t) => Number(t.minQty) > 0 && Number(t.unitPrice) > 0)
        .sort((a, b) => Number(b.minQty) - Number(a.minQty))
    : [];

  const matchedTier = tiers.find((t) => safeQty >= Number(t.minQty));
  const wholesaleReady =
    Number(item.wholesalePrice || 0) > 0 &&
    safeQty >= Math.max(1, Number(item.minWholesaleQty || 1));

  let base = Number(item.retailPrice || 0);
  let appliedMode: 'retail' | 'wholesale' | 'tier' = 'retail';

  if (matchedTier) {
    base = Number(matchedTier.unitPrice);
    appliedMode = 'tier';
  } else if (wholesaleReady) {
    base = Number(item.wholesalePrice);
    appliedMode = 'wholesale';
  }

  if (item.discountType === 'percent' && item.discountValue > 0 && item.discountValue <= 100) {
    base = Math.max(0, Number((base * (1 - item.discountValue / 100)).toFixed(2)));
  } else if (item.discountType === 'fixed' && item.discountValue > 0) {
    base = Math.max(0, Number((base - item.discountValue).toFixed(2)));
  }

  const savingsPerUnit =
    appliedMode !== 'retail' && Number(item.retailPrice || 0) > base
      ? Number((Number(item.retailPrice) - base).toFixed(2))
      : 0;

  return {
    unitPrice: base,
    isWholesale: appliedMode !== 'retail',
    appliedMode,
    matchedTierMinQty: matchedTier ? Number(matchedTier.minQty) : undefined,
    savingsPerUnit,
    lineTotal: Number((base * safeQty).toFixed(2)),
  };
}

export interface B2BSupplyOrderItem {
  catalogItemId: string;
  name: string;
  unit: string;
  variantLabel?: string;
  quantity: number;
  unitPrice: number;
  appliedTier: 'retail' | 'wholesale';
  lineTotal: number;
}

export interface B2BSupplyOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  workshopId?: string | null;
  externalBuyer?: {
    name: string;
    workshopBrand?: string;
    phone?: string;
    country?: string;
    governorate?: string;
    address?: string;
  } | null;
  orderSource: SupplierOrderSource;
  items: B2BSupplyOrderItem[];
  pricingTierApplied: 'retail' | 'wholesale' | 'mixed';
  subtotal: number;
  discount: number;
  shippingFee: number;
  finalTotal: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: string;
  workshopTreasuryId?: string | null;
  supplierTreasuryId?: string | null;
  status: 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'received' | 'cancelled';
  workshopApprovedAt?: string | null;
  inventorySyncedAt?: string | null;
  financialPostedAt?: string | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierCustomer {
  id: string;
  supplierId: string;
  workshopId?: string | null;
  name: string;
  phone: string;
  country: string;
  governorate?: string;
  sourceType: 'direct_store' | 'suppliers_market' | 'external';
  totalPurchases: number;
  balanceDue: number;
  walkinOrdersCount?: number;
  onlineOrdersCount?: number;
  lastAddress?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierTreasury {
  id: string;
  supplierId: string;
  name: string;
  channelType: 'cash' | 'instapay' | 'vodafone_cash' | 'bank' | 'other';
  balance: number;
  currency: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierTreasuryTransaction {
  id: string;
  supplierId: string;
  treasuryId: string;
  b2bOrderId?: string | null;
  txType: 'income' | 'expense' | 'deposit' | 'withdrawal' | 'adjustment';
  amount: number;
  description: string;
  createdAt?: string;
}

export interface SupplierExpense {
  id: string;
  supplierId: string;
  treasuryId?: string | null;
  category: string;
  amount: number;
  notes?: string;
  expenseDate: string;
  createdAt?: string;
}

export interface SupplierSupplySectionMeta {
  id: MainSectionId;
  titleAr: string;
  subtitleAr: string;
  presetMaterials: string[];
}

export const SUPPLIER_SUPPLY_SECTIONS: SupplierSupplySectionMeta[] = [
  {
    id: 'ropes_textiles',
    titleAr: 'الحبال والنسيج والخيوط',
    subtitleAr: 'المكرمية، الكروشيه، التافتنج، الكليم والعقادة',
    presetMaterials: [
      'خيط مكرمية قطن مجدول (3مم / 4مم / 5مم)',
      'خيط مكرمية قطن محلول (شراشيب 3مم / 4مم)',
      'حبل قطن مضفور للشنط والديكور',
      'خيط كليم قطن (مجدول / عادي)',
      'خيط سلسلـة حرير / رافيـا',
      'خيط كروشيه وتريكو (قطن مصري / أليزيه)',
      'قماش مونكس للتافتنج (Tufting Cloth)',
      'خيوط أكرليك وصوف تافتنج',
      'غراء لاتكس خلفي للسجاد وقماش فينيش',
      'بطانات شنط وسوست وإكسسوارات حبال',
    ],
  },
  {
    id: 'beads_embroidery',
    titleAr: 'الخرز والتطريز والإكسسوارات',
    subtitleAr: 'الخرز الكريستال، اللولي، الكنفاه، التطريز والأحجار',
    presetMaterials: [
      'خرز كريستال (4مم / 6مم / 8مم)',
      'خرز لولي ومايوركا وتفسيرة',
      'خرز ميوياكي وسيد بيدز (Seed Beads)',
      'واير صلب وأقفال وزرد ومسامير إكسسوار',
      'أطواق تطريز خشبية وبلاستيك (تارات)',
      'خيوط تطريز مولينيه ومبروم وحرير',
      'قماش كنفاه وإيتامين وكتان للتطريز',
      'أحجار كريمة وعقيق وفواصل معدن مطلي',
      'حلقات شنط معدن وأيدي سلسلة',
    ],
  },
  {
    id: 'clays_composites',
    titleAr: 'تشكيل الخامات الطينية والمركبة والريزن',
    subtitleAr: 'الريزن الإيبوكسي، الكونكريت، الصلصال الحراري، الخزف والشموع',
    presetMaterials: [
      'ريزن إيبوكسي شفاف ومصلب (3:1 / 2:1 / 1:1)',
      'قوالب سيليكون (صواني / كوسترات / إكسسوار)',
      'ألوان مايكا وبودرة لؤلؤية وألوان ريزن معتمة',
      'ورق ذهب وفضة وأحجار زينة للصب',
      'أسمنت أبيض / جسو / كونكريت فائق النعومة',
      'عوازل وملمعات كونكريت (سيلر مائي ومذيب)',
      'صلصال حراري (Polymer Clay) وأدوات نحت',
      'طين أسواني وأبيض وألوان جليز للخزف',
      'شمع صويا وبرافين وفتائل وزيوت عطرية',
    ],
  },
  {
    id: 'woods',
    titleAr: 'الأخشاب والخوص والبامبو',
    subtitleAr: 'القواعد الخشبية، البامبو، الخوص، الأركت والأرابيسك',
    presetMaterials: [
      'دوائر وقواعد خشبية ليزر للمكرمية والكروشيه',
      'طارات وأعواد خشب زان وموسكي مصنفرة',
      'ألواح أخشاب MDF وكونتر وطبيعي للتقطيع',
      'حلقات بامبو وخرز خشب مثقوب (12مم - 30مم)',
      'خوص ونخيل وجريد وأعواد رتان طبيعية',
      'ماكينات ومناشير أركت وريش تقطيع',
      'ورنيش مائي ولاكيه ودهانات أخشاب طبيعية',
    ],
  },
];

export const SUPPLIER_DEFAULT_UNITS = [
  'بكرة',
  'كيلو',
  'جرام',
  'متر',
  'قطعة',
  'طقم',
  'شلة',
  'لتر',
  'لوح',
  'باكيت',
];

export const SUPPLIER_EXPENSE_CATEGORIES = [
  'شحن وتوصيل',
  'تغليف وكراتين',
  'إيجار مخزن / محل',
  'كهرباء وإنترنت',
  'رواتب وعمالة',
  'دعاية وتسويق',
  'صيانة وتشغيل',
  'أخرى',
];

export function supplierProfileToUserProfile(s: SupplierProfile): UserProfile {
  const ts = s.createdAt ? new Date(s.createdAt).getTime() : Date.now();
  return {
    id: s.id,
    workshopId: s.id,
    tenantId: s.id,
    ownerUid: s.ownerUid,
    email: s.email,
    brandName: s.brandName,
    artistName: s.ownerName,
    gender: s.gender || 'male',
    phoneNumber: s.phone || '',
    country: s.country || 'مصر',
    governorate: s.governorate || '',
    currency: s.currency || 'EGP',
    currencySymbol: s.currencySymbol || 'ج.م',
    selectedCrafts: s.supplySections || [],
    defaultVatPercent: 0,
    showTaxInfoOnInvoice: false,
    logoUrl: s.logoUrl || '/alshams_falcon_emblem.png',
    storeSlug: s.storeSlug || '',
    store_slug: s.storeSlug || '',
    accountRole: 'supplier',
    supplierId: s.id,
    businessTypes: s.businessTypes || ['online'],
    pricingModes: s.pricingModes || ['retail'],
    supplySections: s.supplySections || [],
    suppliedMaterials: s.suppliedMaterials || [],
    storeConfig: s.storeConfig || {},
    status: s.status === 'pending' ? 'active' : s.status || 'active',
    isFrozen: Boolean(s.isFrozen),
    suspensionReason: s.suspensionReason,
    suspensionDuration: s.suspensionDuration,
    suspendedUntil: s.suspendedUntil,
    appealStatus: s.appealStatus,
    appealMessage: s.appealMessage,
    rejectionReason: s.rejectionReason,
    medal: (s.medal as any) || null,
    ratingStars: s.ratingStars || 5,
    createdAt: isNaN(ts) ? Date.now() : ts,
    updatedAt: Date.now(),
    createdBy: s.ownerUid,
  };
}
