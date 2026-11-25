/**
 * محرك «شموسة» الأوفلاين 100% للأسواق والمتاجر الخاصة:
 * (سوق الشمسية + سوق الموردين + المتاجر الخاصة للفنانين + المتاجر الخاصة للموردين)
 *
 * الضوابط:
 * - أوفلاين بالكامل (صفر استهلاك API / كوتا من الزوار أو العابثين).
 * - تأمين خصوصية البيانات (Sanitizer صارم): لا يقرأ ولا يكشف أي تكاليف أو هوامش ربح أو أرقام خاصة للورش.
 * - احترام كامل لإعدادات المتجر الخاص (إخفاء السعر / إغلاق الطلبات / إخفاء الواتساب).
 * - فلترة حقيقية لشبكة المنتجات في الصفحة نفسها + زر «إلغاء الفلتر / عرض الكل».
 * - معالج «هدية سريعة» (سؤالين: المناسبة + الميزانية).
 * - مكتبة المشاكل الفنية مفتوحة بالكامل أوفلاين (الحل الكامل + تحذيرات السلامة بدون حجب) مع دعوة تسجيل سياقية «سجّل دلوقتي» لكل زائر حسب كلامه.
 * - الرد الأوفلاين على عروض المنصة ونظام النقاط والمحافظ المنفصلة (قيمة النقطة + سقف الخصم + حماية هوامش الورش).
 */

import { normalizeArabicKnowledgeText, trigramSimilarity } from './shamousaKnowledgeStore';
import { diagnoseTechnicalProblemOffline } from './shamousaAnalyticBrains';
import { understandProductSentence } from './shamousaProductUnderstanding';
import { detectSameStoreShippingGroups } from './marketCompareService';
import {
  getActivePublicOffers,
  loadLoyaltyConfig,
} from './loyaltyWalletsService';

export type MarketSurfaceMode =
  | 'alshams_market'
  | 'suppliers_market'
  | 'artisan_storefront'
  | 'supplier_storefront';

export interface StorePrivacySettings {
  hidePrices?: boolean;
  disableDirectOrders?: boolean;
  disableWhatsapp?: boolean;
  disableCustomNotes?: boolean;
}

/**
 * كائن منتج عام مُعقَّم تماماً — خالٍ من أي تكلفة أو هامش أو بيانات داخلية للورشة
 */
export interface SanitizedPublicCatalogItem {
  id: string;
  name: string;
  description?: string;
  craftOrCategory?: string;
  priceEgp: number;
  wholesalePriceEgp?: number;
  minWholesaleQty?: number;
  unitLabel?: string;
  colors?: string[];
  sizes?: string[];
  prepDays?: number;
  inStock: boolean;
  isFreeShipping?: boolean;
  hasDiscount?: boolean;
  ratingAvg?: number;
  storeId?: string;
  storeName: string;
  storeSlug?: string;
  imageUrl?: string;
}

export interface MarketShamousaActiveFilter {
  labelAr: string;
  matchedIds: string[];
  queryText?: string;
  maxPriceEgp?: number;
  minPriceEgp?: number;
  occasionAr?: string;
  readyNowOnly?: boolean;
  freeShippingOnly?: boolean;
  wholesaleOnly?: boolean;
  sortBy?: 'featured' | 'price_asc' | 'price_desc';
}

export interface ShamousaMarketQuickOption {
  id: string;
  label: string;
  action: 'query' | 'gift_occasion' | 'gift_budget' | 'clear_filter' | 'open_compare' | 'open_favorites' | 'open_register';
  payload?: string;
}

export interface ShamousaMarketReply {
  text: string;
  filterToApply?: MarketShamousaActiveFilter | null;
  clearFilter?: boolean;
  options: ShamousaMarketQuickOption[];
  isLeadMagnetLocked?: boolean;
  leadMagnetTitleAr?: string;
  shippingSaveHintAr?: string;
}

/**
 * دالة تعقيم صارمة تضمن عدم تسريب أي حقول تكلفة أو هوامش أو أرقام داخلية إلى كود البحث/الفلترة
 */
export function sanitizePublicMarketItem(raw: {
  id: string;
  name: string;
  description?: string;
  craftOrCategory?: string;
  priceEgp?: number;
  wholesalePriceEgp?: number;
  minWholesaleQty?: number;
  unitLabel?: string;
  colors?: string[];
  sizes?: string[];
  prepDays?: number;
  inStock?: boolean;
  isFreeShipping?: boolean;
  hasDiscount?: boolean;
  ratingAvg?: number;
  storeId?: string;
  storeName: string;
  storeSlug?: string;
  imageUrl?: string;
}): SanitizedPublicCatalogItem {
  return {
    id: String(raw.id),
    name: String(raw.name || '').trim(),
    description: raw.description ? String(raw.description).slice(0, 260) : undefined,
    craftOrCategory: raw.craftOrCategory ? String(raw.craftOrCategory).trim() : undefined,
    priceEgp: Math.max(0, Number(raw.priceEgp || 0)),
    wholesalePriceEgp: raw.wholesalePriceEgp ? Math.max(0, Number(raw.wholesalePriceEgp)) : undefined,
    minWholesaleQty: raw.minWholesaleQty ? Math.max(1, Number(raw.minWholesaleQty)) : undefined,
    unitLabel: raw.unitLabel ? String(raw.unitLabel).trim() : undefined,
    colors: Array.isArray(raw.colors) ? raw.colors.map(String).slice(0, 8) : undefined,
    sizes: Array.isArray(raw.sizes) ? raw.sizes.map(String).slice(0, 8) : undefined,
    prepDays: raw.prepDays !== undefined ? Number(raw.prepDays) : undefined,
    inStock: raw.inStock !== false,
    isFreeShipping: Boolean(raw.isFreeShipping),
    hasDiscount: Boolean(raw.hasDiscount),
    ratingAvg: raw.ratingAvg !== undefined ? Number(raw.ratingAvg) : undefined,
    storeId: raw.storeId ? String(raw.storeId) : undefined,
    storeName: String(raw.storeName || '').trim(),
    storeSlug: raw.storeSlug ? String(raw.storeSlug) : undefined,
    imageUrl: raw.imageUrl ? String(raw.imageUrl) : undefined,
  };
}

export const QUICK_GIFT_OCCASIONS: Array<{ id: string; labelAr: string; keywords: string[] }> = [
  { id: 'mothers_day', labelAr: 'عيد الأم / هدية لماما 💐', keywords: ['مكرم', 'شنط', 'شال', 'طقم', 'برواز', 'شمع', 'ديكور', 'صيني', 'اكسسوار'] },
  { id: 'wedding_home', labelAr: 'عروسة / بيت جديد 🏡', keywords: ['جدار', 'مفرش', 'كوشن', 'صيني', 'فاز', 'شمعدان', 'مراي', 'سجاد', 'اباجور', 'ديكور'] },
  { id: 'baby', labelAr: 'مولود / سبوع 🍼', keywords: ['اميجوروم', 'كروشيه', 'بطاني', 'غرف', 'اطفال', 'توزيعات', 'طارة', 'ميدالي'] },
  { id: 'birthday', labelAr: 'عيد ميلاد / هدية لصديق 🎁', keywords: ['شنط', 'محفظ', 'جلد', 'مج', 'سلسل', 'اسور', 'شمع', 'نوت بوك', 'ميدالي'] },
  { id: 'corporate', labelAr: 'هدايا شركات / كميات 🏢', keywords: ['نوت', 'مج', 'كوستر', 'ميدالي', 'جلد', 'شمع', 'باقة', 'تغليف', 'خشب'] },
];

export const QUICK_GIFT_BUDGETS: Array<{ id: string; labelAr: string; minEgp?: number; maxEgp?: number }> = [
  { id: 'under_300', labelAr: 'تحت 300 ج.م', maxEgp: 300 },
  { id: '300_700', labelAr: 'من 300 إلى 700 ج.م', minEgp: 300, maxEgp: 700 },
  { id: 'over_700', labelAr: 'أعلى من 700 ج.م (هدايا فخمة)', minEgp: 700 },
  { id: 'any_budget', labelAr: 'أي ميزانية (اعرض الأنسب)' },
];

const ARABIC_COLOR_SYNONYMS: Array<{ label: string; tokens: string[] }> = [
  { label: 'بيج', tokens: ['بيج', 'اوف وايت', 'كريمي', 'سكري'] },
  { label: 'أسود', tokens: ['اسود', 'أسود', 'سودا', 'بلاك'] },
  { label: 'أبيض', tokens: ['ابيض', 'أبيض', 'بيضا'] },
  { label: 'ذهبي', tokens: ['ذهبي', 'دهبي', 'جولد'] },
  { label: 'بني', tokens: ['بني', 'كافيه', 'هافان', 'جملي', 'خشبي'] },
  { label: 'أخضر', tokens: ['اخضر', 'أخضر', 'زيتي', 'مينت'] },
  { label: 'أزرق', tokens: ['ازرق', 'أزرق', 'كحلي', 'سماوي', 'تركواز'] },
  { label: 'وردي', tokens: ['بينك', 'وردي', 'كشمير', 'زهري', 'روز'] },
  { label: 'أحمر', tokens: ['احمر', 'أحمر', 'نبيتي', 'برجندي'] },
];

function extractPriceBounds(raw: string): { minPriceEgp?: number; maxPriceEgp?: number } {
  const cleaned = raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const rangeMatch = cleaned.match(/(?:من|بين)\s*(\d{2,6})\s*(?:لـ|ل|الى|إلى|و|-)\s*(\d{2,6})/);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    return { minPriceEgp: Math.min(a, b), maxPriceEgp: Math.max(a, b) };
  }
  const maxMatch = cleaned.match(/(?:تحت|اقل من|أقل من|حد اقصى|حد أقصى|في حدود|بـ|ب)\s*(\d{2,6})/);
  if (maxMatch) {
    return { maxPriceEgp: Number(maxMatch[1]) };
  }
  const minMatch = cleaned.match(/(?:فوق|اكتر من|أكثر من|اعلى من|أعلى من)\s*(\d{2,6})/);
  if (minMatch) {
    return { minPriceEgp: Number(minMatch[1]) };
  }
  return {};
}

export type GuestCtaContext =
  | 'technical_problem'
  | 'gift_shopping'
  | 'supplier_materials'
  | 'offers_loyalty'
  | 'general_market';

/**
 * دعوة تسجيل سياقية لطيفة ومخصصة حسب الكلام اللي الزائر بيسأل عنه (بدون أي قفل أو حجب للمعلومة)
 */
export function buildContextualGuestRegisterCta(
  context: GuestCtaContext,
  storeName?: string
): { lineAr: string; buttonLabelAr: string } {
  const cfg = loadLoyaltyConfig();
  const welcomePts = cfg.earningRules.welcomeCustomerPts;
  const welcomeEgp = Math.round(welcomePts * cfg.pointValueEgp * 100) / 100;

  switch (context) {
    case 'technical_problem':
      return {
        lineAr:
          `✨ **سجّل دلوقتي مجاناً** عشان تحتفظ بحساب ورشتك وتستخدم حاسبة التكاليف ومنظومة الخامات الموحدة وشموسة على بيانات شغلك (وتكسب نقاط باقات ترحيبية!).`,
        buttonLabelAr: 'سجّل ورشتك دلوقتي مجاناً ✨',
      };
    case 'supplier_materials':
      return {
        lineAr:
          `✨ **سجّل دلوقتي مجاناً** كفنان أو مورّد عشان تحفظ قائمة خاماتك وموردينك المفضلين وتجمع نقاط في **محفظة الباقات** تغطّي بيها اشتراكاتك!`,
        buttonLabelAr: 'سجّل دلوقتي مجاناً (ورشة / مورّد) 📦',
      };
    case 'offers_loyalty':
      return {
        lineAr:
          `✨ **سجّل دلوقتي مجاناً** واستلم **+${welcomePts} نقاط ترحيبية** (${welcomeEgp} ج.م في محفظة التسوق) تبدأ بيهم خصمك الفوري على أول طلب!`,
        buttonLabelAr: `سجّل دلوقتي واكسب +${welcomePts} نقطة 🎁`,
      };
    case 'gift_shopping':
      return {
        lineAr:
          `✨ **سجّل دلوقتي مجاناً** عشان تحفظ هداياك ومفضلتك (❤️) على كل أجهزتك وتكسب **+${welcomePts} نقاط تسوق** (الخصم مموّل من المنصة بالكامل!).`,
        buttonLabelAr: 'سجّل دلوقتي واحفظ اختياراتك ✨',
      };
    default:
      return {
        lineAr:
          `✨ **سجّل دلوقتي مجاناً** في ${storeName ? `«${storeName}» ومنصة الشمساوية` : 'الشمساوية'} عشان تحفظ مفضلتك ومقارنتك وتكسب نقاط تسوق فورية مع كل طلب!`,
        buttonLabelAr: 'سجّل دلوقتي مجاناً ✨',
      };
  }
}

function attachGuestContextualCta(
  reply: ShamousaMarketReply,
  isAuthenticated: boolean,
  context: GuestCtaContext,
  storeName?: string
): ShamousaMarketReply {
  if (isAuthenticated) return reply;
  const cta = buildContextualGuestRegisterCta(context, storeName);
  const alreadyHasRegister = reply.options.some((o) => o.action === 'open_register');
  return {
    ...reply,
    text: `${reply.text}\n\n${cta.lineAr}`,
    options: alreadyHasRegister
      ? reply.options
      : [
          ...reply.options,
          {
            id: `ctx_reg_${context}`,
            label: cta.buttonLabelAr,
            action: 'open_register',
          },
        ],
  };
}

/**
 * تشخيص المشاكل الفنية أوفلاين 100%:
 * الحل الكامل + كل الخطوات العملية + تحذيرات السلامة مفتوحة بالكامل لكل زائر بدون أي حجب،
 * مع دعوة تسجيل سياقية «سجّل دلوقتي» مخصصة للحرفة/الورشة للزائر غير المسجّل.
 */
export function checkTechnicalProblemLeadMagnetOffline(
  rawQuery: string,
  isAuthenticated: boolean
): ShamousaMarketReply | null {
  const diag = diagnoseTechnicalProblemOffline(rawQuery, 'فنان');
  if (!diag.matched || !diag.entry) return null;

  const baseReply: ShamousaMarketReply = {
    text: diag.reply,
    isLeadMagnetLocked: false,
    options: [
      { id: 'lm_clear', label: 'رجوع لتصفح السوق 🛍️', action: 'clear_filter' },
    ],
  };

  return attachGuestContextualCta(baseReply, isAuthenticated, 'technical_problem');
}

/**
 * معالج «هدية سريعة» (سؤالين: المناسبة + الميزانية) -> يفلتر شبكة المنتجات فوراً
 */
export function runQuickGiftWizardOffline(
  occasionId: string,
  budgetId: string,
  catalog: SanitizedPublicCatalogItem[],
  privacy?: StorePrivacySettings,
  isAuthenticated = false
): ShamousaMarketReply {
  const occ = QUICK_GIFT_OCCASIONS.find((o) => o.id === occasionId) || QUICK_GIFT_OCCASIONS[0];
  const bud = QUICK_GIFT_BUDGETS.find((b) => b.id === budgetId) || QUICK_GIFT_BUDGETS[3];

  const scored = catalog
    .filter((item) => {
      if (privacy?.hidePrices) return true;
      if (bud.maxEgp && item.priceEgp > bud.maxEgp) return false;
      if (bud.minEgp && item.priceEgp < bud.minEgp) return false;
      return true;
    })
    .map((item) => {
      const hay = normalizeArabicKnowledgeText(
        `${item.name} ${item.craftOrCategory || ''} ${item.description || ''}`
      );
      let score = item.inStock ? 2 : 0;
      for (const kw of occ.keywords) {
        if (hay.includes(normalizeArabicKnowledgeText(kw))) score += 5;
      }
      if (item.hasDiscount) score += 1.5;
      if (item.isFreeShipping) score += 1;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  const matched = scored.filter((x) => x.score >= 5).map((x) => x.item);
  const finalList = matched.length > 0 ? matched : scored.slice(0, 8).map((x) => x.item);

  const sameStore = detectSameStoreShippingGroups(finalList);
  const shippingSaveHintAr =
    sameStore.length > 0
      ? `💡 وفّر شحن: في ${sameStore[0].count} هدايا مناسبة من نفس المتجر «${sameStore[0].storeName}» تقدر تجمعهم بشحن واحد!`
      : undefined;

  if (finalList.length === 0) {
    return {
      text: `يا أهلاً ☀️ ما لقيتش قطع مطابقة تماماً للميزانية (${bud.labelAr}) دلوقتي. تحب نوسّع الميزانية شوية أو أعرضلك كل المعروضات؟`,
      options: [
        { id: 'gw_any', label: 'اعرض كل الميزانيات 🎁', action: 'gift_budget', payload: `${occ.id}|any_budget` },
        { id: 'gw_all', label: 'إلغاء الفلتر / عرض الكل', action: 'clear_filter' },
      ],
    };
  }

  return attachGuestContextualCta(
    {
      text:
        `🎁 **فلترتلك الصفحة فوراً على أفضل هدايا (${occ.labelAr.replace(/\s*[💐🏡🍼🎁🏢]/g, '')})**` +
        (privacy?.hidePrices ? '' : ` في ميزانية **${bud.labelAr}**`) +
        ` — لقيتلك **${finalList.length}** اختيار مميز ظاهرين قدامك دلوقتي!\n` +
        `تقدر تضغط على أيقونة الميزان (⚖️) على أكتر من قطعة عشان نقارن بينهم سوا.` +
        (shippingSaveHintAr ? `\n\n${shippingSaveHintAr}` : ''),
      filterToApply: {
        labelAr: `هدية: ${occ.labelAr.replace(/\s*[💐🏡🍼🎁🏢]/g, '')}${!privacy?.hidePrices && bud.id !== 'any_budget' ? ` · ${bud.labelAr}` : ''}`,
        matchedIds: finalList.map((i) => i.id),
        maxPriceEgp: privacy?.hidePrices ? undefined : bud.maxEgp,
        minPriceEgp: privacy?.hidePrices ? undefined : bud.minEgp,
        occasionAr: occ.labelAr,
        sortBy: 'featured',
      },
      shippingSaveHintAr,
      options: [
        { id: 'gw_cheapest', label: 'رتّبهم من الأرخص 💰', action: 'query', payload: 'رتب الأرخص' },
        { id: 'gw_compare', label: 'افتح المقارنة (⚖️)', action: 'open_compare' },
        { id: 'gw_reset', label: 'إلغاء الفلتر / عرض الكل', action: 'clear_filter' },
      ],
    },
    isAuthenticated,
    'gift_shopping'
  );
}

/**
 * الدالة الرئيسية لمعالجة أي رسالة في شموسة الأسواق والمتاجر الخاصة (أوفلاين 100%)
 */
export function processMarketShamousaMessage(input: {
  rawQuery: string;
  mode: MarketSurfaceMode;
  catalog: SanitizedPublicCatalogItem[];
  storeName?: string;
  storeId?: string;
  privacy?: StorePrivacySettings;
  isAuthenticated?: boolean;
  compareCount?: number;
  favoritesCount?: number;
}): ShamousaMarketReply {
  const { rawQuery, mode, catalog, storeName, storeId, privacy, isAuthenticated = false } = input;
  const qNorm = normalizeArabicKnowledgeText(rawQuery);
  const isSupplierSurface = mode === 'suppliers_market' || mode === 'supplier_storefront';
  const defaultCtaContext: GuestCtaContext = isSupplierSurface ? 'supplier_materials' : 'general_market';

  if (!qNorm) {
    return {
      text: `أهلاً بيك يا فندم ☀️ اكتبلي بتدور على إيه (مثلاً: ${
        isSupplierSurface ? 'خيط قطن 4 مم جملة أو شمع صويا' : 'هدية لعيد الأم تحت 500 جنيه أو شنطة مكرمية'
      }) وهفلترلك الصفحة فوراً!`,
      options: buildDefaultMarketOptions(isSupplierSurface),
    };
  }

  // 1) إلغاء الفلتر / عرض الكل
  if (/^(الغاء الفلتر|اعرض الكل|عرض الكل|الكل|رجع كل المنتجات|امسح الفلتر)$/.test(qNorm)) {
    return attachGuestContextualCta(
      {
        text: `تمام ☀️ رجّعتلك كل المعروضات (${catalog.length}) على الصفحة بدون أي فلتر.`,
        clearFilter: true,
        options: buildDefaultMarketOptions(isSupplierSurface),
      },
      isAuthenticated,
      defaultCtaContext,
      storeName
    );
  }

  // 2) بدء معالج «هدية سريعة»
  if (/(هديه سريعه|عايز هديه|عاوزه هديه|بدور على هديه|اختارلي هديه|معالج الهديه)/.test(qNorm) && !extractPriceBounds(rawQuery).maxPriceEgp) {
    return attachGuestContextualCta(
      {
        text: `🎁 **معالج الهدية السريعة (خطوتين بس):**\nقولي المناسبة إيه الأول عشان أصفّيلك أنسب القطع على الشاشة؟`,
        options: QUICK_GIFT_OCCASIONS.slice(0, 4).map((o) => ({
          id: `occ_${o.id}`,
          label: o.labelAr,
          action: 'gift_occasion',
          payload: o.id,
        })),
      },
      isAuthenticated,
      'gift_shopping',
      storeName
    );
  }

  // 2.5) عروض المنصة والمتاجر ونظام النقاط والمحافظ المنفصلة (أوفلاين 100%)
  if (/(عروض|عرض|خصم|خصومات|نقاط|النقطه بكام|النقاط|محفظه|محفظة|ولاء|كاش باك)/.test(qNorm)) {
    const loyaltyCfg = loadLoyaltyConfig();
    const activeOffers = getActivePublicOffers(storeId);
    const offersLines =
      activeOffers.length > 0
        ? activeOffers
            .slice(0, 4)
            .map((o, idx) => `${idx + 1}. **${o.titleAr}** (${o.badgeAr}) — ${o.subtitleAr}`)
            .join('\n')
        : '• لا توجد حملات إضافية مفعّلة حالياً، لكن نظام النقاط يعمل تلقائياً على كل طلب موثّق!';

    return attachGuestContextualCta(
      {
        text:
          `🎁 **عروض ونقاط الشمساوية النشطة حالياً:**\n` +
          `• **قيمة النقطة الآن:** كل **1 نقطة = ${loyaltyCfg.pointValueEgp} ج.م** (تُحدّث بمرونة من إدارة المنصة).\n` +
          `• **محفظة التسوق للعملاء:** تخصم حتى **${loyaltyCfg.customerMaxDiscountPercent}%** من قيمة السلة — والخصم مموّل بالكامل من المنصة ولا يُخصم جنيه واحد من صافي ربح الفنان!\n` +
          `• **محفظة الباقات للورش والموردين:** منفصلة تماماً وتُستخدم فقط لتغطية اشتراكات وباقات المنصة.\n\n` +
          `🔥 **العروض المفعّلة دلوقتي:**\n${offersLines}`,
        options: [
          ...(!isSupplierSurface
            ? [{ id: 'off_gift', label: 'معالج هدية سريعة 🎁', action: 'query' as const, payload: 'هدية سريعة' }]
            : [{ id: 'off_wh', label: 'خامات بسعر الجملة 📦', action: 'query' as const, payload: 'خامات جملة' }]),
          { id: 'off_all', label: 'تصفح كل المعروضات ☀️', action: 'clear_filter' },
        ],
      },
      isAuthenticated,
      'offers_loyalty',
      storeName
    );
  }

  // 3) مكتبة المشاكل الفنية مفتوحة بالكامل أوفلاين (بدون قفل 3 سطور!)
  const techDiagnosis = checkTechnicalProblemLeadMagnetOffline(rawQuery, isAuthenticated);
  if (techDiagnosis) return techDiagnosis;

  // 4) سؤال عن السعر والمتجر قافل عرض الأسعار (احترام خصوصية المتجر!)
  if (privacy?.hidePrices && /(سعر|بكام|تحت|ارخص|أرخص|ميزانيه|جنيه)/.test(qNorm)) {
    return attachGuestContextualCta(
      {
        text: `بناءً على إعدادات متجر **${storeName || 'المتجر'}**، الأسعار غير معروضة علناً في الكتالوج حالياً.${
          privacy.disableWhatsapp
            ? ' تقدر تضغط على أي منتج لمعرفة تفاصيله ومقاساته المتاحة.'
            : ' تقدر تختار القطع اللي عجبتك في المفضلة (❤️) أو المقارنة (⚖️) وتتواصل مع المتجر مباشرة للاستفسار عن السعر.'
        }`,
        options: [
          { id: 'pr_fav', label: 'افتح المفضلة ❤️', action: 'open_favorites' },
          { id: 'pr_cmp', label: 'افتح المقارنة ⚖️', action: 'open_compare' },
          { id: 'pr_all', label: 'عرض كل المنتجات', action: 'clear_filter' },
        ],
      },
      isAuthenticated,
      defaultCtaContext,
      storeName
    );
  }

  // 5) طلب مساعدة في المقارنة
  if (/(قارن|مقارنه|محتار بين|ساعدني اختار|الميزان)/.test(qNorm)) {
    return attachGuestContextualCta(
      {
        text:
          (input.compareCount || 0) > 0
            ? `عندك حالياً **${input.compareCount}** عناصر في المقارنة (⚖️) منفصلة تماماً عن السلة! افتح شاشة المقارنة دلوقتي واضغط «خلّي شموسة تساعدني أختار» عشان أصفّيهم لأفضل 2–3 خيارات.`
            : `فكرة ممتازة! اضغط على أيقونة الميزان **(⚖️)** على أي عدد من المنتجات اللي عجبتك (حتى 12 منتج بدون ما تزحم السلة)، وبعدها افتح المقارنة وهساعدك تختار الأنسب.`,
        options: [
          { id: 'cmp_open', label: 'افتح شاشة المقارنة (⚖️)', action: 'open_compare' },
          { id: 'cmp_fav', label: 'افتح المفضلة (❤️)', action: 'open_favorites' },
        ],
      },
      isAuthenticated,
      defaultCtaContext,
      storeName
    );
  }

  // 6) تحليل نية الفلترة الذكية (ميزانية + لون + مناسبة + شحن مجاني + جاهز + جملة + حرفة/كلمات)
  const priceBounds = privacy?.hidePrices ? {} : extractPriceBounds(rawQuery);
  const freeShippingOnly = /(شحن مجاني|توصيل مجاني|ببلاش شحن)/.test(qNorm);
  const readyNowOnly = /(جاهز|فوري|سريع|متوفر الان|متاح الان)/.test(qNorm);
  const wholesaleOnly = /(جمله|كميات|توريد|موردين|سعر الجمله|شرايح)/.test(qNorm);
  const sortBy: 'featured' | 'price_asc' | 'price_desc' = /(ارخص|أرخص|اقل سعر|أقل سعر|توفير)/.test(qNorm)
    ? 'price_asc'
    : /(اغلى|أغلى|فخم|اعلى سعر)/.test(qNorm)
    ? 'price_desc'
    : 'featured';

  const matchedColor = ARABIC_COLOR_SYNONYMS.find((c) => c.tokens.some((tk) => qNorm.includes(tk)));
  const matchedOccasion = QUICK_GIFT_OCCASIONS.find((o) =>
    qNorm.includes(normalizeArabicKnowledgeText(o.labelAr.split('/')[0])) ||
    (o.id === 'mothers_day' && /(عيد الام|ماما|والدتي|امي)/.test(qNorm)) ||
    (o.id === 'wedding_home' && /(عروسه|فرح|زفاف|بيت جديد|عرايس)/.test(qNorm)) ||
    (o.id === 'baby' && /(مولود|سبوع|بيبي|طفل)/.test(qNorm)) ||
    (o.id === 'corporate' && /(شركات|شركه|موظفين|كميات هدايا)/.test(qNorm))
  );

  // استخدام محرك فهم المنتج للتعرف على الحرفة حتى مع الأخطاء الإملائية
  const understood = understandProductSentence(rawQuery);
  const specialtyKeywords = understood.specialty
    ? [understood.specialty.nameAr, ...understood.specialty.keywords.slice(0, 8)]
    : [];

  const stopWords = new Set([
    'عايز', 'عاوزه', 'عاوز', 'بدور', 'على', 'في', 'من', 'عن', 'تحت', 'اقل', 'اكتر', 'فوق',
    'جنيه', 'جم', 'سعر', 'ارخص', 'اغلى', 'رتب', 'هاتلي', 'وريني', 'عندك', 'فيه', 'موجود',
    'هديه', 'هدايا', 'شحن', 'مجاني', 'جاهز', 'فوري', 'جمله', 'كميات', 'لو', 'سمحت', 'ممكن',
  ]);
  const queryTokens = qNorm
    .split(' ')
    .filter((t) => t.length >= 2 && !stopWords.has(t) && !/^\d+$/.test(t));

  let filtered = catalog.filter((item) => {
    if (!privacy?.hidePrices) {
      const effectivePrice =
        isSupplierSurface && wholesaleOnly && item.wholesalePriceEgp
          ? item.wholesalePriceEgp
          : item.priceEgp;
      if (priceBounds.maxPriceEgp && effectivePrice > priceBounds.maxPriceEgp) return false;
      if (priceBounds.minPriceEgp && effectivePrice < priceBounds.minPriceEgp) return false;
    }
    if (freeShippingOnly && !item.isFreeShipping) return false;
    if (readyNowOnly && !item.inStock) return false;
    if (wholesaleOnly && isSupplierSurface && !item.wholesalePriceEgp) return false;
    return true;
  });

  // تسجيل درجات التطابق النصي والحرفي واللوني
  const hasSemanticCriteria =
    queryTokens.length > 0 || Boolean(matchedColor) || Boolean(matchedOccasion) || specialtyKeywords.length > 0;

  if (hasSemanticCriteria) {
    const scored = filtered.map((item) => {
      const hay = normalizeArabicKnowledgeText(
        `${item.name} ${item.craftOrCategory || ''} ${item.description || ''} ${item.storeName} ${(item.colors || []).join(' ')} ${(item.sizes || []).join(' ')}`
      );
      let score = 0;

      for (const tok of queryTokens) {
        if (hay.includes(tok)) score += 6;
        else if (trigramSimilarity(tok, hay) >= 0.36) score += 3;
      }
      if (specialtyKeywords.length > 0) {
        for (const sk of specialtyKeywords) {
          const nsk = normalizeArabicKnowledgeText(sk);
          if (nsk.length >= 3 && hay.includes(nsk)) {
            score += 5;
            break;
          }
        }
      }
      if (matchedColor) {
        if (matchedColor.tokens.some((tk) => hay.includes(tk))) score += 6;
      }
      if (matchedOccasion) {
        if (matchedOccasion.keywords.some((kw) => hay.includes(normalizeArabicKnowledgeText(kw)))) {
          score += 5;
        }
      }
      return { item, score };
    });

    const positives = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
    if (positives.length > 0) {
      filtered = positives.map((p) => p.item);
    } else if (
      !priceBounds.maxPriceEgp &&
      !priceBounds.minPriceEgp &&
      !freeShippingOnly &&
      !readyNowOnly &&
      !wholesaleOnly &&
      sortBy === 'featured'
    ) {
      // لا يوجد تطابق مباشر -> نرجع اقتراحات توضيحية ذكية بدون إخفاء كل السوق
      return attachGuestContextualCta(
        {
          text: `ما لقيتش تطابق حرفي لـ «${rawQuery.trim()}» في المعروضات الحالية (${catalog.length} صنف).\nتحب تجرّب اختيار من دول أو نلغي الفلتر ونشوف الكل؟`,
          options: [
            ...(isSupplierSurface
              ? [
                  { id: 'nf_w', label: 'خامات بسعر الجملة 📦', action: 'query' as const, payload: 'خامات جملة' },
                  { id: 'nf_c', label: 'الأرخص سعراً 💰', action: 'query' as const, payload: 'رتب الأرخص' },
                ]
              : [
                  { id: 'nf_g', label: 'معالج هدية سريعة 🎁', action: 'query' as const, payload: 'هدية سريعة' },
                  { id: 'nf_c', label: 'الأرخص سعراً 💰', action: 'query' as const, payload: 'رتب الأرخص' },
                ]),
            { id: 'nf_all', label: 'عرض الكل ☀️', action: 'clear_filter' },
          ],
        },
        isAuthenticated,
        defaultCtaContext,
        storeName
      );
    }
  }

  // الترتيب النهائي
  if (sortBy === 'price_asc') {
    filtered = [...filtered].sort((a, b) => a.priceEgp - b.priceEgp);
  } else if (sortBy === 'price_desc') {
    filtered = [...filtered].sort((a, b) => b.priceEgp - a.priceEgp);
  }

  const labelParts: string[] = [];
  if (matchedOccasion) labelParts.push(matchedOccasion.labelAr.replace(/\s*[💐🏡🍼🎁🏢]/g, ''));
  if (understood.specialty) labelParts.push(understood.specialty.nameAr);
  else if (queryTokens.length > 0) labelParts.push(queryTokens.slice(0, 3).join(' '));
  if (matchedColor) labelParts.push(`لون ${matchedColor.label}`);
  if (priceBounds.minPriceEgp && priceBounds.maxPriceEgp) {
    labelParts.push(`${priceBounds.minPriceEgp}–${priceBounds.maxPriceEgp} ج.م`);
  } else if (priceBounds.maxPriceEgp) {
    labelParts.push(`تحت ${priceBounds.maxPriceEgp} ج.م`);
  } else if (priceBounds.minPriceEgp) {
    labelParts.push(`فوق ${priceBounds.minPriceEgp} ج.م`);
  }
  if (freeShippingOnly) labelParts.push('شحن مجاني');
  if (readyNowOnly) labelParts.push('جاهز الآن');
  if (wholesaleOnly) labelParts.push('جملة');
  if (sortBy === 'price_asc') labelParts.push('الأرخص أولاً');

  const labelAr = labelParts.length > 0 ? labelParts.join(' · ') : rawQuery.trim().slice(0, 35);
  const sameStoreGroups = detectSameStoreShippingGroups(filtered);
  const shippingSaveHintAr =
    sameStoreGroups.length > 0 && (mode === 'alshams_market' || mode === 'suppliers_market')
      ? `💡 وفّر شحن: في ${sameStoreGroups[0].count} اختيارات من «${sameStoreGroups[0].storeName}» — تقدر تجمعهم في طلب واحد بشحن واحد!`
      : undefined;

  if (filtered.length === 0) {
    return attachGuestContextualCta(
      {
        text: `ما لقيتش نتائج مطابقة للفلتر (**${labelAr}**) في المعروضات الحالية.\nجرب تزود الميزانية شوية أو اضغط «إلغاء الفلتر / عرض الكل».`,
        options: [
          { id: 'z_all', label: 'إلغاء الفلتر / عرض الكل', action: 'clear_filter' },
          { id: 'z_cheap', label: 'اعرض الأرخص المتاح 💰', action: 'query', payload: 'رتب الأرخص' },
        ],
      },
      isAuthenticated,
      defaultCtaContext,
      storeName
    );
  }

  return attachGuestContextualCta(
    {
      text:
        `✨ **فلترتلك الصفحة على (${filtered.length}) ${isSupplierSurface ? 'صنف خامة' : 'منتج'}** حسب طلبك (**${labelAr}**).\n` +
        `تقدر تضيف أي قطع للمقارنة (⚖️) أو المفضلة (❤️) أو تلغي الفلتر من الشريط اللي فوق في أي لحظة.` +
        (shippingSaveHintAr ? `\n\n${shippingSaveHintAr}` : ''),
      filterToApply: {
        labelAr,
        matchedIds: filtered.map((i) => i.id),
        queryText: rawQuery.trim(),
        maxPriceEgp: priceBounds.maxPriceEgp,
        minPriceEgp: priceBounds.minPriceEgp,
        readyNowOnly,
        freeShippingOnly,
        wholesaleOnly,
        sortBy,
      },
      shippingSaveHintAr,
      options: [
        ...(sortBy !== 'price_asc' && !privacy?.hidePrices
          ? [{ id: 'opt_cheap', label: 'رتّب الأرخص 💰', action: 'query' as const, payload: `${rawQuery} أرخص` }]
          : []),
        { id: 'opt_cmp', label: 'افتح المقارنة ⚖️', action: 'open_compare' },
        { id: 'opt_clear', label: 'إلغاء الفلتر / عرض الكل', action: 'clear_filter' },
      ],
    },
    isAuthenticated,
    matchedOccasion ? 'gift_shopping' : defaultCtaContext,
    storeName
  );
}

function buildDefaultMarketOptions(isSupplierSurface: boolean): ShamousaMarketQuickOption[] {
  if (isSupplierSurface) {
    return [
      { id: 'sup_1', label: 'خامات بسعر الجملة 📦', action: 'query', payload: 'خامات جملة' },
      { id: 'sup_2', label: 'العروض والنقاط 🎁', action: 'query', payload: 'العروض والنقاط' },
      { id: 'sup_3', label: 'قارن الخامات (⚖️)', action: 'open_compare' },
    ];
  }
  return [
    { id: 'mkt_1', label: 'معالج هدية سريعة 🎁', action: 'query', payload: 'هدية سريعة' },
    { id: 'mkt_2', label: 'عروض ونقاط السوق 🔥', action: 'query', payload: 'العروض والنقاط' },
    { id: 'mkt_3', label: 'المقارنة (⚖️)', action: 'open_compare' },
  ];
}
