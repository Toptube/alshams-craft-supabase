/**
 * منظومة النقاط والمحافظ المنفصلة والعروض التحفيزية — المرحلة الثانية
 *
 * الضوابط الذهبية:
 * 1. محفظتان منفصلتان تماماً (Zero Cross-Spending):
 *    - محفظة الباقات (`packages_wallet`): للفنانين والورش والموردين والمدربين -> تُستخدم فقط لتغطية باقات واشتراكات المنصة (لا كاش أوت ولا تدخل في أرباح البائعين).
 *    - محفظة التسوق (`shopping_wallet`): للعملاء والمتسوقين -> تُستخدم فقط كخصم فوري في سلة التسوق بسقف 10–15% (قابل للتعديل من السوبر أدمن).
 * 2. قيمة النقطة مرنة بالكامل من لوحة السوبر أدمن (الافتراضي: 1 نقطة = 0.50 ج.م).
 * 3. حماية هوامش الورش (Margin Protection):
 *    - خصم نقاط العملاء مموّل بالكامل من المنصة ولا يُخصم جنيه واحد من صافي ربح الفنان.
 *    - عند إنشاء عرض على مستوى المتجر الخاص، يفحص النظام تلقائياً هامش الربح ويحذّر صاحب المتجر لو الخصم يهدد الحد الأدنى للربح.
 */

export type WalletType = 'packages_wallet' | 'shopping_wallet';

export interface LoyaltyEarningRules {
  verifiedOrderPer100Egp: number;
  verifiedReviewPts: number;
  firstWorkshopSetupPts: number;
  catalogCompletionPts: number;
  welcomeCustomerPts: number;
}

export interface LoyaltyEconomyConfig {
  enabled: boolean;
  /** قيمة النقطة الواحدة بالجنيه المصري (الافتراضي 0.50 ج.م — قابلة للتعديل من السوبر أدمن في أي وقت) */
  pointValueEgp: number;
  /** سقف خصم نقاط العميل في السلة (% من قيمة المنتجات — يُنصح بـ 10 إلى 15%) */
  customerMaxDiscountPercent: number;
  /** الحد الأدنى لهامش الربح لحماية الورش عند تفعيل عروض المتاجر (%) */
  workshopMinMarginGuardPercent: number;
  /** أقصى نسبة تغطية لباقات المنصة من محفظة الباقات (%) */
  packagesWalletMaxCoveragePercent: number;
  earningRules: LoyaltyEarningRules;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  walletType: WalletType;
  type: 'credit' | 'debit';
  points: number;
  egpEquivalent: number;
  reasonAr: string;
  referenceId?: string;
  createdAt: string;
}

export interface AccountLoyaltyWallets {
  accountId: string;
  packagesWalletPoints: number;
  shoppingWalletPoints: number;
  ledger: WalletTransaction[];
  updatedAt: string;
}

export type PromotionalOfferType =
  | 'bonus_points'
  | 'double_points'
  | 'free_shipping_threshold'
  | 'percent_discount'
  | 'bundle_save';

export interface PlatformPromotionalOffer {
  id: string;
  scope: 'platform' | 'store';
  storeId?: string;
  storeName?: string;
  titleAr: string;
  subtitleAr: string;
  badgeAr: string;
  offerType: PromotionalOfferType;
  value: number;
  minOrderEgp?: number;
  active: boolean;
  endsAt?: string;
  /** تم التحقق من أن العرض لا يضر بهامش ربح الورشة */
  marginSafeVerified: boolean;
  createdAt: string;
}

export interface ShoppingRedemptionResult {
  allowed: boolean;
  reasonAr?: string;
  maxRedeemablePoints: number;
  discountEgp: number;
  remainingPoints: number;
  capPercentApplied: number;
  platformFunded: boolean;
  marginProtectedNoteAr: string;
}

export interface PackagesRedemptionResult {
  allowed: boolean;
  reasonAr?: string;
  maxRedeemablePoints: number;
  coverageEgp: number;
  remainingDueEgp: number;
  remainingPoints: number;
}

export interface StoreOfferMarginSafetyResult {
  isSafe: boolean;
  discountedPriceEgp: number;
  netProfitEgp: number;
  resultingMarginPercent: number;
  minMarginGuardPercent: number;
  warningAr: string;
}

const LOYALTY_CONFIG_STORAGE_KEY = 'alshams_loyalty_economy_config_v1';
const PLATFORM_OFFERS_STORAGE_KEY = 'alshams_platform_promotional_offers_v1';
const ACCOUNT_WALLETS_STORAGE_KEY = 'alshams_loyalty_account_wallets_v1';

export const DEFAULT_LOYALTY_CONFIG: LoyaltyEconomyConfig = {
  enabled: true,
  pointValueEgp: 0.5,
  customerMaxDiscountPercent: 15,
  workshopMinMarginGuardPercent: 15,
  packagesWalletMaxCoveragePercent: 100,
  earningRules: {
    verifiedOrderPer100Egp: 2,
    verifiedReviewPts: 5,
    firstWorkshopSetupPts: 20,
    catalogCompletionPts: 15,
    welcomeCustomerPts: 10,
  },
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_PLATFORM_OFFERS: PlatformPromotionalOffer[] = [
  {
    id: 'offer_welcome_shopping_pts',
    scope: 'platform',
    titleAr: 'نقاط ترحيبية فورية في محفظة التسوق',
    subtitleAr: 'سجّل حسابك في سوق الشمساوية واحصل على 10 نقاط ترحيبية (خصم مموّل من المنصة بالكامل دون المساس بربح الفنان)',
    badgeAr: '+10 نقاط تسوق',
    offerType: 'bonus_points',
    value: 10,
    active: true,
    marginSafeVerified: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'offer_double_verified_pts',
    scope: 'platform',
    titleAr: 'نقاط مضاعفة على الطلبات والتقييمات الموثّقة',
    subtitleAr: 'اكسب نقاطاً مضاعفة تلقائياً على كل طلبية مكتملة وتقييم حقيقي بعد الاستلام داخل سوق الشمساوية',
    badgeAr: 'نقاط ×2',
    offerType: 'double_points',
    value: 2,
    minOrderEgp: 250,
    active: true,
    marginSafeVerified: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'offer_workshop_setup_pkg_pts',
    scope: 'platform',
    titleAr: 'مكافأة تجهيز الورشة والمتجر (محفظة الباقات)',
    subtitleAr: 'أكمل ملف ورشتك وأضف أول 3 منتجات معتمدة واكسب 20 نقطة في محفظة الباقات لتغطية اشتراكات المنصة',
    badgeAr: '+20 نقطة باقات',
    offerType: 'bonus_points',
    value: 20,
    active: true,
    marginSafeVerified: true,
    createdAt: new Date().toISOString(),
  },
];

// ============================================================================
// دوال الحساب النقية وحماية الهوامش والفصل الصارم بين المحافظ
// ============================================================================

export function sanitizeLoyaltyConfig(raw?: Partial<LoyaltyEconomyConfig> | null): LoyaltyEconomyConfig {
  const base = DEFAULT_LOYALTY_CONFIG;
  const pv = Number(raw?.pointValueEgp);
  const maxDisc = Number(raw?.customerMaxDiscountPercent);
  const minMargin = Number(raw?.workshopMinMarginGuardPercent);
  const pkgCap = Number(raw?.packagesWalletMaxCoveragePercent);

  return {
    enabled: raw?.enabled !== false,
    pointValueEgp: Number.isFinite(pv) ? Math.round(Math.min(50, Math.max(0.05, pv)) * 100) / 100 : base.pointValueEgp,
    customerMaxDiscountPercent: Number.isFinite(maxDisc)
      ? Math.round(Math.min(25, Math.max(5, maxDisc)))
      : base.customerMaxDiscountPercent,
    workshopMinMarginGuardPercent: Number.isFinite(minMargin)
      ? Math.round(Math.min(50, Math.max(5, minMargin)))
      : base.workshopMinMarginGuardPercent,
    packagesWalletMaxCoveragePercent: Number.isFinite(pkgCap)
      ? Math.round(Math.min(100, Math.max(10, pkgCap)))
      : base.packagesWalletMaxCoveragePercent,
    earningRules: {
      verifiedOrderPer100Egp: Math.max(
        0,
        Math.min(50, Number(raw?.earningRules?.verifiedOrderPer100Egp ?? base.earningRules.verifiedOrderPer100Egp))
      ),
      verifiedReviewPts: Math.max(
        0,
        Math.min(100, Number(raw?.earningRules?.verifiedReviewPts ?? base.earningRules.verifiedReviewPts))
      ),
      firstWorkshopSetupPts: Math.max(
        0,
        Math.min(500, Number(raw?.earningRules?.firstWorkshopSetupPts ?? base.earningRules.firstWorkshopSetupPts))
      ),
      catalogCompletionPts: Math.max(
        0,
        Math.min(500, Number(raw?.earningRules?.catalogCompletionPts ?? base.earningRules.catalogCompletionPts))
      ),
      welcomeCustomerPts: Math.max(
        0,
        Math.min(200, Number(raw?.earningRules?.welcomeCustomerPts ?? base.earningRules.welcomeCustomerPts))
      ),
    },
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  };
}

export function pointsToEgp(points: number, config: LoyaltyEconomyConfig = DEFAULT_LOYALTY_CONFIG): number {
  const safePts = Math.max(0, Math.floor(Number(points) || 0));
  return Math.round(safePts * config.pointValueEgp * 100) / 100;
}

export function egpToPoints(egp: number, config: LoyaltyEconomyConfig = DEFAULT_LOYALTY_CONFIG): number {
  const safeEgp = Math.max(0, Number(egp) || 0);
  if (config.pointValueEgp <= 0) return 0;
  return Math.floor(safeEgp / config.pointValueEgp);
}

/**
 * حساب استبدال نقاط «محفظة التسوق» في سلة السوق:
 * - يرفض تماماً أي محاولة لاستخدام `packages_wallet` داخل سلة التسوق.
 * - يطبق السقف الأقصى للخصم (10–15% حسب إعدادات السوبر أدمن).
 * - الخصم مموّل بالكامل من المنصة ولا يمس صافي ربح الفنان.
 */
export function calculateShoppingWalletRedemption(input: {
  cartSubtotalEgp: number;
  walletPoints: number;
  walletType: WalletType;
  config?: LoyaltyEconomyConfig;
}): ShoppingRedemptionResult {
  const config = sanitizeLoyaltyConfig(input.config || loadLoyaltyConfig());
  const marginNote =
    'الخصم مموّل بالكامل من نقاط منصة الشمساوية ولا يُخصم جنيه واحد من صافي ربح الفنان.';

  if (!config.enabled) {
    return {
      allowed: false,
      reasonAr: 'منظومة استبدال النقاط متوقفة مؤقتاً من إعدادات المنصة.',
      maxRedeemablePoints: 0,
      discountEgp: 0,
      remainingPoints: Math.max(0, Math.floor(input.walletPoints || 0)),
      capPercentApplied: config.customerMaxDiscountPercent,
      platformFunded: true,
      marginProtectedNoteAr: marginNote,
    };
  }

  if (input.walletType !== 'shopping_wallet') {
    return {
      allowed: false,
      reasonAr: 'محفظة الباقات مخصصة لاشتراكات المنصة فقط ولا يمكن استخدامها داخل سلة التسوق.',
      maxRedeemablePoints: 0,
      discountEgp: 0,
      remainingPoints: Math.max(0, Math.floor(input.walletPoints || 0)),
      capPercentApplied: config.customerMaxDiscountPercent,
      platformFunded: true,
      marginProtectedNoteAr: marginNote,
    };
  }

  const subtotal = Math.max(0, Number(input.cartSubtotalEgp) || 0);
  const availPts = Math.max(0, Math.floor(Number(input.walletPoints) || 0));

  if (subtotal <= 0 || availPts <= 0) {
    return {
      allowed: true,
      maxRedeemablePoints: 0,
      discountEgp: 0,
      remainingPoints: availPts,
      capPercentApplied: config.customerMaxDiscountPercent,
      platformFunded: true,
      marginProtectedNoteAr: marginNote,
    };
  }

  const maxAllowedDiscountEgp = Math.floor((subtotal * config.customerMaxDiscountPercent) / 100);
  const maxPointsByCap = egpToPoints(maxAllowedDiscountEgp, config);
  const redeemablePoints = Math.min(availPts, maxPointsByCap);
  const discountEgp = Math.min(maxAllowedDiscountEgp, Math.floor(pointsToEgp(redeemablePoints, config)));

  return {
    allowed: true,
    maxRedeemablePoints: redeemablePoints,
    discountEgp,
    remainingPoints: Math.max(0, availPts - redeemablePoints),
    capPercentApplied: config.customerMaxDiscountPercent,
    platformFunded: true,
    marginProtectedNoteAr: marginNote,
  };
}

/**
 * حساب تغطية اشتراكات وباقات المنصة من «محفظة الباقات»:
 * - يرفض تماماً أي محاولة لاستخدام `shopping_wallet` لتغطية الباقات.
 */
export function calculatePackagesWalletRedemption(input: {
  subscriptionTotalEgp: number;
  walletPoints: number;
  walletType: WalletType;
  config?: LoyaltyEconomyConfig;
}): PackagesRedemptionResult {
  const config = sanitizeLoyaltyConfig(input.config || loadLoyaltyConfig());
  const availPts = Math.max(0, Math.floor(Number(input.walletPoints) || 0));
  const subTotal = Math.max(0, Number(input.subscriptionTotalEgp) || 0);

  if (input.walletType !== 'packages_wallet') {
    return {
      allowed: false,
      reasonAr: 'محفظة التسوق مخصصة لمشتريات السوق فقط ولا يمكن استخدامها لتغطية باقات المنصة.',
      maxRedeemablePoints: 0,
      coverageEgp: 0,
      remainingDueEgp: subTotal,
      remainingPoints: availPts,
    };
  }

  if (!config.enabled || subTotal <= 0 || availPts <= 0) {
    return {
      allowed: config.enabled,
      maxRedeemablePoints: 0,
      coverageEgp: 0,
      remainingDueEgp: subTotal,
      remainingPoints: availPts,
    };
  }

  const maxCoverageEgp = Math.round(((subTotal * config.packagesWalletMaxCoveragePercent) / 100) * 100) / 100;
  const maxPointsNeeded = Math.ceil(maxCoverageEgp / Math.max(0.05, config.pointValueEgp));
  const redeemablePoints = Math.min(availPts, maxPointsNeeded);
  const coverageEgp = Math.min(maxCoverageEgp, pointsToEgp(redeemablePoints, config));

  return {
    allowed: true,
    maxRedeemablePoints: redeemablePoints,
    coverageEgp: Math.round(coverageEgp * 100) / 100,
    remainingDueEgp: Math.max(0, Math.round((subTotal - coverageEgp) * 100) / 100),
    remainingPoints: Math.max(0, availPts - redeemablePoints),
  };
}

/**
 * حارس حماية هوامش الورش عند إنشاء عروض المتاجر الخاصة:
 * يحسب صافي الربح بعد الخصم ويحذّر الورشة تلقائياً لو الخصم ينزل الهامش تحت الحد الآمن.
 */
export function evaluateStoreOfferMarginSafety(input: {
  regularPriceEgp: number;
  unitCostEgp: number;
  discountPercent: number;
  minMarginGuardPercent?: number;
}): StoreOfferMarginSafetyResult {
  const minGuard = input.minMarginGuardPercent ?? loadLoyaltyConfig().workshopMinMarginGuardPercent;
  const price = Math.max(0, Number(input.regularPriceEgp) || 0);
  const cost = Math.max(0, Number(input.unitCostEgp) || 0);
  const disc = Math.min(90, Math.max(0, Number(input.discountPercent) || 0));

  const discountedPriceEgp = Math.round(price * (1 - disc / 100) * 100) / 100;
  const netProfitEgp = Math.round((discountedPriceEgp - cost) * 100) / 100;
  const resultingMarginPercent =
    discountedPriceEgp > 0 ? Math.round((netProfitEgp / discountedPriceEgp) * 1000) / 10 : 0;

  const isSafe = netProfitEgp > 0 && resultingMarginPercent >= minGuard;
  const warningAr = isSafe
    ? `العرض آمن لورشتك ✅ — صافي ربحك بعد الخصم ${netProfitEgp} ج.م (هامش ${resultingMarginPercent}% أعلى من الحد الآمن ${minGuard}%).`
    : netProfitEgp <= 0
    ? `⚠️ تنبيه حماية الهامش: خصم ${disc}% سيجعل السعر (${discountedPriceEgp} ج.م) أقل من أو يساوي التكلفة (${cost} ج.م)! قلّل نسبة الخصم لحماية ربحك.`
    : `⚠️ تنبيه حماية الهامش: خصم ${disc}% سيخفض هامش ربحك إلى ${resultingMarginPercent}% وهو أقل من الحد الآمن الموصى به (${minGuard}%).`;

  return {
    isSafe,
    discountedPriceEgp,
    netProfitEgp,
    resultingMarginPercent,
    minMarginGuardPercent: minGuard,
    warningAr,
  };
}

// ============================================================================
// التخزين المحلي والمزامنة مع السيرفر
// ============================================================================

export function loadLoyaltyConfig(): LoyaltyEconomyConfig {
  if (typeof window === 'undefined') return DEFAULT_LOYALTY_CONFIG;
  try {
    const raw = localStorage.getItem(LOYALTY_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_LOYALTY_CONFIG;
    return sanitizeLoyaltyConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_LOYALTY_CONFIG;
  }
}

export function saveLoyaltyConfigLocal(next: Partial<LoyaltyEconomyConfig>): LoyaltyEconomyConfig {
  const merged = sanitizeLoyaltyConfig({ ...loadLoyaltyConfig(), ...next, updatedAt: new Date().toISOString() });
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOYALTY_CONFIG_STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('alshams_loyalty_config_updated', { detail: merged }));
    } catch {
      // ignore
    }
  }
  return merged;
}

export function loadPlatformOffers(storeId?: string): PlatformPromotionalOffer[] {
  if (typeof window === 'undefined') return DEFAULT_PLATFORM_OFFERS;
  try {
    const raw = localStorage.getItem(PLATFORM_OFFERS_STORAGE_KEY);
    const list: PlatformPromotionalOffer[] = raw ? JSON.parse(raw) : DEFAULT_PLATFORM_OFFERS;
    const safeList = Array.isArray(list) && list.length > 0 ? list : DEFAULT_PLATFORM_OFFERS;
    if (storeId) {
      return safeList.filter((o) => o.scope === 'platform' || (o.scope === 'store' && o.storeId === storeId));
    }
    return safeList;
  } catch {
    return DEFAULT_PLATFORM_OFFERS;
  }
}

export function getActivePublicOffers(storeId?: string): PlatformPromotionalOffer[] {
  const now = Date.now();
  return loadPlatformOffers(storeId).filter((o) => {
    if (!o.active) return false;
    if (o.endsAt) {
      const t = new Date(o.endsAt).getTime();
      if (Number.isFinite(t) && t < now) return false;
    }
    return true;
  });
}

export function savePlatformOffersLocal(offers: PlatformPromotionalOffer[]): PlatformPromotionalOffer[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PLATFORM_OFFERS_STORAGE_KEY, JSON.stringify(offers));
      window.dispatchEvent(new CustomEvent('alshams_loyalty_offers_updated', { detail: offers }));
    } catch {
      // ignore
    }
  }
  return offers;
}

function readAllLocalWalletsMap(): Record<string, AccountLoyaltyWallets> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ACCOUNT_WALLETS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllLocalWalletsMap(map: Record<string, AccountLoyaltyWallets>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACCOUNT_WALLETS_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('alshams_loyalty_wallets_updated'));
  } catch {
    // ignore
  }
}

export function getAccountWalletsLocal(accountId: string, initialShoppingFallback = 0): AccountLoyaltyWallets {
  const key = (accountId || 'guest').trim().toLowerCase();
  const map = readAllLocalWalletsMap();
  if (map[key]) return map[key];

  return {
    accountId: key,
    packagesWalletPoints: 0,
    shoppingWalletPoints: Math.max(0, Math.floor(Number(initialShoppingFallback) || 0)),
    ledger: [],
    updatedAt: new Date().toISOString(),
  };
}

export function mutateAccountWalletLocal(input: {
  accountId: string;
  walletType: WalletType;
  type: 'credit' | 'debit';
  points: number;
  reasonAr: string;
  referenceId?: string;
  config?: LoyaltyEconomyConfig;
}): AccountLoyaltyWallets {
  const cfg = input.config || loadLoyaltyConfig();
  const key = (input.accountId || 'guest').trim().toLowerCase();
  const map = readAllLocalWalletsMap();
  const current = map[key] || {
    accountId: key,
    packagesWalletPoints: 0,
    shoppingWalletPoints: 0,
    ledger: [],
    updatedAt: new Date().toISOString(),
  };

  const pts = Math.max(0, Math.floor(Number(input.points) || 0));
  if (pts <= 0) return current;

  const delta = input.type === 'credit' ? pts : -pts;
  const nextPackages =
    input.walletType === 'packages_wallet'
      ? Math.max(0, current.packagesWalletPoints + delta)
      : current.packagesWalletPoints;
  const nextShopping =
    input.walletType === 'shopping_wallet'
      ? Math.max(0, current.shoppingWalletPoints + delta)
      : current.shoppingWalletPoints;

  const tx: WalletTransaction = {
    id: `ltx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    walletType: input.walletType,
    type: input.type,
    points: pts,
    egpEquivalent: pointsToEgp(pts, cfg),
    reasonAr: input.reasonAr.trim().slice(0, 200),
    referenceId: input.referenceId,
    createdAt: new Date().toISOString(),
  };

  const updated: AccountLoyaltyWallets = {
    accountId: key,
    packagesWalletPoints: nextPackages,
    shoppingWalletPoints: nextShopping,
    ledger: [tx, ...(current.ledger || [])].slice(0, 100),
    updatedAt: new Date().toISOString(),
  };

  map[key] = updated;
  writeAllLocalWalletsMap(map);
  return updated;
}

export function listAllLocalWallets(): AccountLoyaltyWallets[] {
  return Object.values(readAllLocalWalletsMap()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function syncPublicLoyaltyFromServer(): Promise<{
  config: LoyaltyEconomyConfig;
  offers: PlatformPromotionalOffer[];
}> {
  try {
    const res = await fetch('/api/public/loyalty/config');
    if (res.ok) {
      const json = await res.json();
      const cfg = json?.config ? saveLoyaltyConfigLocal(json.config) : loadLoyaltyConfig();
      const offers =
        Array.isArray(json?.offers) && json.offers.length > 0
          ? savePlatformOffersLocal(json.offers)
          : loadPlatformOffers();
      return { config: cfg, offers };
    }
  } catch {
    // أوفلاين — نعتمد على التخزين المحلي بسلاسة
  }
  return { config: loadLoyaltyConfig(), offers: loadPlatformOffers() };
}

export async function saveAdminLoyaltyConfigToServer(
  accessToken: string | undefined,
  config: LoyaltyEconomyConfig,
  offers: PlatformPromotionalOffer[]
): Promise<{ ok: boolean; error?: string }> {
  saveLoyaltyConfigLocal(config);
  savePlatformOffersLocal(offers);
  if (!accessToken) return { ok: true };
  try {
    const res = await fetch('/api/admin/loyalty/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ config, offers }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.error || 'تعذر حفظ إعدادات النقاط على السيرفر' };
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export async function adminGrantWalletPointsToServer(
  accessToken: string | undefined,
  payload: {
    accountId: string;
    walletType: WalletType;
    type: 'credit' | 'debit';
    points: number;
    reasonAr: string;
  }
): Promise<{ ok: boolean; wallet: AccountLoyaltyWallets; error?: string }> {
  const localWallet = mutateAccountWalletLocal(payload);
  if (!accessToken) return { ok: true, wallet: localWallet };
  try {
    const res = await fetch('/api/admin/loyalty/grant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, wallet: localWallet, error: json?.error || 'تعذر تنفيذ التعديل على السيرفر' };
    }
    return { ok: true, wallet: json?.wallet || localWallet };
  } catch {
    return { ok: true, wallet: localWallet };
  }
}
