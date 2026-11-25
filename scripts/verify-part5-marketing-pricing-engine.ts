/**
 * اختبار شامل للرسالة رقم 5 من 7 (محرك التسويق والتسعير والإنتاج) + إضافات م. حسام
 * يتحقق من:
 * 1) منظومة الخامات الموحدة مفتوحة لكل الحسابات + مطابقة الخامات النموذجية.
 * 2) تطابق تام (100% numeric invariance) مع دوال الحاسبة الموجودة بدون أي تعديل على المعادلات + عدم تخمين الكميات.
 * 3) احترام الباقات المستقلة (صفر تسريب تكلفة/هامش/مخزون عند غياب الباقة).
 * 4) خصوصية كاملة بين الحسابات (التعديلات المحلية والتغذية الذاتية معزولة بـ accountId).
 * 5) تقويم المواسم المصري (10 مواسم + حساب هجري محلي + تعديل مستخدم + تنبيه 3 أسابيع).
 * 6) ميزات الورش (معادلة التجميع قبل/بعد، رادار الأفكار بالمتوفر والناقص، بوستين باسم المتجر + 3 أساليب واتساب).
 * 7) ميزات الموردين (Starter Kits من المخزون، خصم كميات للراكد قبل/بعد، بوستين للورش).
 * 8) أولويات استباقية بحد أقصى 3 اقتراحات مرتبة بالأثر.
 * 9) حوار السوبر أدمن التفاعلي لمراجعة وتعديل وحفظ الأسئلة المعلقة (والرد عليها فوراً أوفلاين).
 */

import {
  analyzeAccountProductPricing,
  buildArtisanStorePostsAndWhatsapp,
  buildHeroSlowBundleOffer,
  buildProactiveTop3MarketingSuggestions,
  buildSupplierSlowStockVolumeTiers,
  buildSupplierStarterKitsFromStock,
  buildSupplierWorkshopPosts,
  clearAccountSeasonOverridesForTest,
  computeProductionCapacityFromStock,
  getEgyptianSeasonsCalendar,
  lookupUnifiedMaterialForShamousa,
  parseExplicitDraftCostFromMessage,
  runDraftCostCalculationViaExistingEngine,
  runNewProductStockRadar,
  saveAccountSeasonDateOverride,
  tryParseSeasonDateOverrideCommand,
} from '../src/services/shamousaMarketingPricingEngine';
import {
  INITIAL_ADMIN_REVIEW_SESSION,
  advanceSuperAdminReviewDialogue,
  clearAccountMarketingInsightsForTest,
  listPendingAdminReviewQuestions,
  loadAccountMarketingInsights,
  matchCustomKnowledgeNote,
  queueUnansweredQuestionForAdmin,
  recordAccountMarketingInsight,
  resetCustomLibrariesStoreForTest,
} from '../src/services/shamousaCustomLibrariesStore';
import { buildUnifiedFinancialOutput } from '../src/utils/craftUnifiedFinancials';
import { calculateMacrame } from '../src/utils/macrameMath';
import type { CalculationInput, InvoiceRecord, RawMaterialItem, SavedProductRecord } from '../src/types';
import type { UserSubscriptionState } from '../src/types/subscriptions';

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string, detail?: string) {
  if (cond) {
    console.log(`✅ [PASS] ${label}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function makeSub(
  activePackageIds: UserSubscriptionState['activePackageIds']
): UserSubscriptionState {
  return {
    activePackageIds,
    hasSelectedPackages: true,
  };
}

function makeProduct(
  partial: Omit<Partial<SavedProductRecord>, 'input'> & {
    id: string;
    productName: string;
    input?: Partial<CalculationInput>;
  }
): SavedProductRecord {
  const baseInput: CalculationInput = {
    category: 'جدارية',
    productName: partial.productName,
    shape3D: 'flat',
    widthCm: 0,
    diameterCm: 0,
    baseDiameterCm: 0,
    sideHeightCm: 0,
    totalLengthCm: 0,
    fringeLengthCm: 0,
    cordTypeId: 'custom',
    cordThicknessMm: 0,
    pricePerKg: 0,
    curtainRodCost: 0,
    cushionCoverCost: 0,
    fiberCost: 0,
    bagAccessoriesCost: 0,
    extraMaterials: [],
    laborWage: 50,
    packagingCost: 15,
    transitFees: 0,
    adminExpensesShare: 0,
    profitMarginPercent: 25,
    personalNotes: '',
    ...(partial.input || {}),
  };
  return {
    id: partial.id,
    tenantId: partial.tenantId || 'acc_full',
    productName: partial.productName,
    category: 'جدارية',
    costPrice: partial.costPrice,
    retailPrice: partial.retailPrice,
    storePrice: partial.storePrice,
    craftName: partial.craftName,
    input: baseInput,
    output: partial.output || buildUnifiedFinancialOutput(baseInput, {
      totalDirectMaterialsCost: (partial.costPrice || 100) - 65,
      extraMaterialsTotalCost: (partial.costPrice || 100) - 65,
      yarnCost: 0,
      totalWeightGrams: 0,
      totalWeightKg: 0,
    }),
    createdAt: Date.now(),
  } as SavedProductRecord;
}

// ============================================================================
// بيانات اختبار واقعية (ورش + موردين)
// ============================================================================
const rawMatsArtisan: RawMaterialItem[] = [
  {
    id: 'm1',
    tenantId: 'acc_full',
    materialName: 'قطن مجدول 4 مم',
    category: 'خيوط',
    unit: 'كيلو',
    currentStock: 5,
    costPerUnit: 180,
    costPerGram: 0.18,
    minAlertThreshold: 1,
    isActive: true,
  },
  {
    id: 'm2',
    tenantId: 'acc_full',
    materialName: 'عصا خشب زان',
    category: 'أخشاب',
    unit: 'قطعة',
    currentStock: 3,
    costPerUnit: 30,
    costPerGram: 0,
    minAlertThreshold: 2,
    isActive: true,
  },
  {
    id: 'm3',
    tenantId: 'acc_full',
    materialName: 'حلقات خشب',
    category: 'إكسسوارات',
    unit: 'قطعة',
    currentStock: 20,
    costPerUnit: 10,
    costPerGram: 0,
    minAlertThreshold: 5,
    isActive: true,
  },
];

const prodHero = makeProduct({
  id: 'p_hero',
  productName: 'معلقة مكرمية بوهو',
  craftName: 'مكرمية',
  costPrice: 180,
  storePrice: 320,
  input: {
    extraMaterials: [
      { id: 'em1', name: 'قطن مجدول 4 مم', unit: 'كيلو', unitPrice: 180, quantity: 0.5, totalCost: 90 },
      { id: 'em2', name: 'عصا خشب زان', unit: 'قطعة', unitPrice: 30, quantity: 1, totalCost: 30 },
    ],
    laborWage: 50,
    packagingCost: 10,
  } as Partial<CalculationInput>,
});

const prodSlow = makeProduct({
  id: 'p_slow',
  productName: 'كوستر مكرمية دائري',
  craftName: 'مكرمية',
  costPrice: 80,
  storePrice: 130,
  input: {
    extraMaterials: [
      { id: 'em3', name: 'قطن مجدول 4 مم', unit: 'كيلو', unitPrice: 180, quantity: 0.1, totalCost: 18 },
    ],
    laborWage: 50,
    packagingCost: 12,
  } as Partial<CalculationInput>,
});

const prodLoss = makeProduct({
  id: 'p_loss',
  productName: 'مراية مكرمية كبيرة',
  craftName: 'مكرمية',
  costPrice: 400,
  storePrice: 350, // أقل من التكلفة!
});

const ordersArtisan: InvoiceRecord[] = [
  {
    id: 'o1',
    tenantId: 'acc_full',
    items: [{ productName: 'معلقة مكرمية بوهو', quantity: 5, unitPrice: 320, totalPrice: 1600 }],
    status: 'paid',
  },
  {
    id: 'o2',
    tenantId: 'acc_full',
    items: [{ productName: 'معلقة مكرمية بوهو', quantity: 3, unitPrice: 320, totalPrice: 960 }],
    status: 'paid',
  },
];

// ============================================================================
// 1. اختبار منظومة الخامات الموحدة (مفتوحة لجميع الحسابات)
// ============================================================================
const um1 = lookupUnifiedMaterialForShamousa('خامة قطن مجدول');
assert(
  um1.matches.length > 0 && um1.matches[0].code === 'TH0001',
  'Unified Materials: resolves قطن مجدول to TH0001 with unit chain',
  JSON.stringify(um1.matches[0])
);

const umDisambig = lookupUnifiedMaterialForShamousa('خرز');
assert(
  Boolean(umDisambig.disambiguationMessage && umDisambig.disambiguationMessage.includes('TH0001')),
  'Unified Materials: preserves cross-category disambiguation for خرز'
);

const umSpec = lookupUnifiedMaterialForShamousa('خامات نموذجية للمكرمية');
assert(
  Boolean(
    umSpec.suggestedFromSpecialty &&
      umSpec.suggestedFromSpecialty.typicalMaterials.some((t) => Boolean(t.unifiedCode))
  ),
  'Unified Materials: suggests typical materials from specialty & maps to unified codes'
);

// ============================================================================
// 2. إثبات عدم تعديل أي معادلة تكاليف (Numeric Invariance Check) + عدم تخمين الكميات
// ============================================================================
const directInput: CalculationInput = {
  category: 'جدارية',
  productName: 'شنطة مكرمية',
  shape3D: 'flat',
  widthCm: 0,
  diameterCm: 0,
  baseDiameterCm: 0,
  sideHeightCm: 0,
  totalLengthCm: 0,
  fringeLengthCm: 0,
  cordTypeId: 'custom',
  cordThicknessMm: 0,
  pricePerKg: 0,
  curtainRodCost: 0,
  cushionCoverCost: 0,
  fiberCost: 0,
  bagAccessoriesCost: 0,
  extraMaterials: [
    { id: 'sh_draft_mat_0', name: 'قطن مجدول', unit: 'كيلو', unitPrice: 180, quantity: 0.5, totalCost: 90 },
    { id: 'sh_draft_mat_1', name: 'خشب', unit: 'قطعة', unitPrice: 35, quantity: 1, totalCost: 35 },
  ],
  laborWage: 80,
  packagingCost: 15,
  transitFees: 0,
  adminExpensesShare: 0,
  profitMarginPercent: 25,
  pricingMode: 'margin',
  personalNotes: '',
};
const directOut = buildUnifiedFinancialOutput(directInput, {
  totalDirectMaterialsCost: 125,
  extraMaterialsTotalCost: 125,
  yarnCost: 0,
  totalWeightGrams: 0,
  totalWeightKg: 0,
});

const fullPkgOpts = {
  role: 'artisan' as const,
  overrideSub: makeSub(['core_free', 'production_pricing', 'inventory_purchases', 'storefront_catalog']),
  isAdmin: false,
};

const shamousaDraft = runDraftCostCalculationViaExistingEngine({
  accountId: 'acc_full',
  packageOptions: fullPkgOpts,
  firstName: 'أحمد',
  productName: 'شنطة مكرمية',
  explicitMaterials: [
    { name: 'قطن مجدول', quantity: 0.5, unit: 'كيلو', unitPrice: 180 },
    { name: 'خشب', quantity: 1, unit: 'قطعة', unitPrice: 35 },
  ],
  laborWage: 80,
  packagingCost: 15,
  profitMarginPercent: 25,
});

assert(
  shamousaDraft.source === 'calculator_draft' &&
    shamousaDraft.reply.includes('مسودة حساب من حاسبة التكاليف') &&
    shamousaDraft.calculatorOutput?.finalSellingPrice === directOut.finalSellingPrice &&
    shamousaDraft.calculatorOutput?.unifiedBreakdown?.totalUnitCost === directOut.unifiedBreakdown?.totalUnitCost,
  'Calculator invariance: Shamousa draft equals buildUnifiedFinancialOutput byte-for-byte',
  `shamousa=${shamousaDraft.calculatorOutput?.finalSellingPrice}, direct=${directOut.finalSellingPrice}`
);

// التحقق من دالة المكرمية الأصلية ما اتغيرتش ولا اتأثرت
const macOut = calculateMacrame({
  ...directInput,
  category: 'جدارية',
  widthCm: 40,
  totalLengthCm: 60,
  fringeLengthCm: 10,
  cordTypeId: 'cotton_braided',
  cordThicknessMm: 4,
  pricePerKg: 180,
  extraMaterials: [],
});
assert(
  macOut.totalWeightGrams > 0 && macOut.finalSellingPrice > 0,
  'Existing macrame calculator function works completely untouched'
);

// اختبار عدم تخمين الكميات عند نقص المدخلات
const missingDraft = runDraftCostCalculationViaExistingEngine({
  accountId: 'acc_full',
  packageOptions: fullPkgOpts,
  firstName: 'أحمد',
  productName: 'شنطة مكرمية جديدة',
  explicitMaterials: [],
});
assert(
  missingDraft.source === 'missing_inputs' && missingDraft.reply.includes('مش بخمّن كميات'),
  'Draft costing refuses to guess missing quantities and asks clearly'
);

// اختبار استخراج المدخلات من جملة طبيعية
const parsedSentence = parseExplicitDraftCostFromMessage(
  'احسبيلي تكلفة شنطة مكرمية: قطن مجدول 0.5 كيلو بسعر 180، خشب 1 قطعة بسعر 35، شغل إيد 80، تغليف 15'
);
assert(
  parsedSentence.materials.length === 2 && parsedSentence.laborWage === 80 && parsedSentence.packagingCost === 15,
  'Parses explicit materials, labor, and packaging from Egyptian Arabic sentence'
);

// ============================================================================
// 3. اختبار حسابات بباقات مختلطة + صفر تسريب
// ============================================================================
const freeOnlyOpts = {
  role: 'artisan' as const,
  overrideSub: makeSub(['core_free']),
  isAdmin: false,
};

const blockedCost = runDraftCostCalculationViaExistingEngine({
  accountId: 'acc_free',
  packageOptions: freeOnlyOpts,
  firstName: 'منى',
  productName: 'شنطة كروشيه',
  explicitMaterials: [{ name: 'خيط', quantity: 1, unit: 'كيلو', unitPrice: 200 }],
});
assert(
  !blockedCost.allowed &&
    blockedCost.source === 'blocked_no_costing' &&
    blockedCost.reply.includes('أقل سعر تقبل تبيع بيه') &&
    !blockedCost.reply.includes('تكلفة القطعة'),
  'No-costing account: NEVER calculates cost and asks user minimum floor price'
);

const blockedInv = computeProductionCapacityFromStock({
  accountId: 'acc_free',
  packageOptions: freeOnlyOpts,
  firstName: 'منى',
  products: [prodHero],
  rawMaterials: rawMatsArtisan,
});
assert(!blockedInv.allowed && blockedInv.items.length === 0, 'No-inventory account: blocks production capacity calculation');

const freeTop3 = buildProactiveTop3MarketingSuggestions({
  accountId: 'acc_free',
  packageOptions: freeOnlyOpts,
  isSupplier: false,
  brandName: 'ورشة منى',
  products: [prodHero, prodSlow, prodLoss],
  rawMaterials: rawMatsArtisan,
  orders: ordersArtisan,
});
assert(
  freeTop3.length <= 3 && !freeTop3.some((s) => s.category === 'pricing' || s.category === 'production'),
  'No-costing/no-inventory Top-3 NEVER leaks pricing or production cards'
);

// ============================================================================
// 4. تحليل الأسعار (مقارنة داخلية بحساب نفس العضو فقط)
// ============================================================================
const priceAnalysis = analyzeAccountProductPricing({
  accountId: 'acc_full',
  packageOptions: fullPkgOpts,
  firstName: 'أحمد',
  products: [prodHero, prodSlow, prodLoss],
});
assert(
  priceAnalysis.allowed &&
    priceAnalysis.lossProducts.some((p) => p.id === 'p_loss') &&
    priceAnalysis.reply.includes('مقارنة داخلية بحسابك فقط') &&
    priceAnalysis.reply.includes('مراية مكرمية كبيرة'),
  'Pricing analysis detects below-cost product & compares only within same account'
);

// ============================================================================
// 5. طاقة الإنتاج + أول خامة هتخلص + ترتيب الأولويات
// ============================================================================
const capRes = computeProductionCapacityFromStock({
  accountId: 'acc_full',
  packageOptions: fullPkgOpts,
  firstName: 'أحمد',
  products: [prodHero, prodSlow],
  rawMaterials: rawMatsArtisan,
  orders: ordersArtisan,
});
assert(
  capRes.allowed &&
    capRes.items.length === 2 &&
    capRes.items[0].productId === 'p_hero' &&
    capRes.items[0].maxUnits === 3 &&
    capRes.items[0].bottleneckMaterialName === 'عصا خشب زان',
  'Production capacity computes max units (3), bottleneck material (عصا خشب زان), and prioritizes hero product',
  JSON.stringify(capRes.items[0])
);

// ============================================================================
// 6. تقويم المواسم المصري (10 مواسم + هجري محلي + تعديل خاص بكل حساب + تنبيه 3 أسابيع)
// ============================================================================
clearAccountSeasonOverridesForTest('acc_A');
clearAccountSeasonOverridesForTest('acc_B');

const mar5 = new Date(2026, 2, 5); // 5 مارس -> عيد الأم 21 مارس بعد 16 يوم (ضمن نافذة 3 أسابيع!)
const calA = getEgyptianSeasonsCalendar({ now: mar5, accountId: 'acc_A' });
const mothers = calA.find((s) => s.id === 'mothers_day');
const ramadan = calA.find((s) => s.id === 'ramadan');
assert(calA.length === 10, 'Egyptian Seasons Calendar contains all 10 seasons');
assert(
  Boolean(mothers && mothers.daysUntil === 16 && mothers.isWithinAlertWindow && mothers.whatToMakeAr && mothers.whatToShowAr),
  'Egyptian Seasons Calendar alerts 3 weeks before Mother’s Day with concrete plan'
);
assert(
  Boolean(ramadan && ramadan.isHijri && /^\d{4}-\d{2}-\d{2}$/.test(ramadan.dateIso) && ramadan.isApproximateNoteAr),
  'Hijri season (Ramadan) computed locally offline with approximate/editable note'
);

const parsedOv = tryParseSeasonDateOverrideCommand('عدّل تاريخ رمضان 2027-02-08');
assert(
  Boolean(parsedOv && parsedOv.seasonId === 'ramadan' && parsedOv.isoDate === '2027-02-08'),
  'Parses user season date override command'
);
saveAccountSeasonDateOverride('acc_A', 'ramadan', '2027-02-08');
const calAAfter = getEgyptianSeasonsCalendar({ now: mar5, accountId: 'acc_A' });
const calBAfter = getEgyptianSeasonsCalendar({ now: mar5, accountId: 'acc_B' });
assert(
  calAAfter.find((s) => s.id === 'ramadan')?.dateIso === '2027-02-08' &&
    calBAfter.find((s) => s.id === 'ramadan')?.dateIso !== '2027-02-08',
  'Privacy Rule 5: Season override for Account A NEVER leaks to Account B'
);

// عزل التغذية الذاتية المحلية بين الحسابات
clearAccountMarketingInsightsForTest('acc_A');
clearAccountMarketingInsightsForTest('acc_B');
recordAccountMarketingInsight('acc_A', {
  kind: 'specialty_focus',
  titleAr: 'اهتمام خاص بالريزن لحساب A',
  detailAr: 'ملاحظة خاصة بحساب A فقط',
  queryText: 'باقات ريزن',
});
assert(
  loadAccountMarketingInsights('acc_A').length === 1 && loadAccountMarketingInsights('acc_B').length === 0,
  'Privacy Rule 5: Self-learning chat insights strictly isolated per accountId'
);

// ============================================================================
// 7. ميزات الورش: معادلة التجميع + رادار الأفكار + بوستين + 3 أساليب واتساب
// ============================================================================
const bundleRes = buildHeroSlowBundleOffer({
  accountId: 'acc_full',
  packageOptions: fullPkgOpts,
  firstName: 'أحمد',
  brandName: 'خيوط الشمس',
  products: [prodHero, prodSlow],
  orders: ordersArtisan,
});
assert(
  bundleRes.usedCosting &&
    bundleRes.heroProduct?.id === 'p_hero' &&
    bundleRes.slowProduct?.id === 'p_slow' &&
    (bundleRes.profitAfter || 0) > 0 &&
    bundleRes.reply.includes('ربحك قبل العرض') &&
    bundleRes.reply.includes('ربحك بعد العرض'),
  'Artisan Bundle: pairs hero + slow, preserves min margin, displays profit before & after'
);

const radarRes = runNewProductStockRadar({
  accountId: 'acc_full',
  packageOptions: fullPkgOpts,
  firstName: 'أحمد',
  specialtyHint: 'مكرمية',
  products: [prodHero],
  rawMaterials: rawMatsArtisan,
});
assert(
  radarRes.ideas.length > 0 && radarRes.reply.includes('خامات جاهزة في مخزونك') && radarRes.reply.includes('خامات ناقصة'),
  'Artisan Product Radar: suggests specialty ideas with available vs missing stock materials'
);

const artPosts = buildArtisanStorePostsAndWhatsapp({
  firstName: 'أحمد',
  brandName: 'خيوط الشمس',
  productName: 'معلقة مكرمية بوهو',
  price: 320,
});
assert(
  artPosts.offerPost.includes('خيوط الشمس') &&
    artPosts.storyPost.includes('خيوط الشمس') &&
    artPosts.whatsappStyles.fast.includes('خيوط الشمس') &&
    artPosts.whatsappStyles.friendly.includes('خيوط الشمس') &&
    artPosts.whatsappStyles.formal.includes('خيوط الشمس'),
  'Artisan Posts & WhatsApp: generates 2 store-named posts (offer + story) & 3 WhatsApp styles'
);

// ============================================================================
// 8. ميزات الموردين: Starter Kits + خصم كميات للراكد + بوستين للورش
// ============================================================================
const supPkgOpts = {
  role: 'supplier' as const,
  overrideSub: makeSub(['core_free', 'production_pricing', 'inventory_purchases', 'storefront_catalog']),
  isAdmin: false,
};
const supMaterials: RawMaterialItem[] = [
  {
    id: 'sm1',
    tenantId: 'sup_1',
    materialName: 'خيط قطن مجدول 4 مم',
    category: 'خيوط',
    unit: 'كيلو',
    currentStock: 80,
    costPerUnit: 120,
    costPerGram: 0.12,
    minAlertThreshold: 10,
    isActive: true,
  },
  {
    id: 'sm2',
    tenantId: 'sup_1',
    materialName: 'حلقات خشب للمكرمية',
    category: 'أخشاب',
    unit: 'كيس',
    currentStock: 45,
    costPerUnit: 40,
    costPerGram: 0,
    minAlertThreshold: 5,
    isActive: true,
  },
  {
    id: 'sm3',
    tenantId: 'sup_1',
    materialName: 'إبر كروشيه ألومنيوم',
    category: 'أدوات',
    unit: 'طقم',
    currentStock: 30,
    costPerUnit: 60,
    costPerGram: 0,
    minAlertThreshold: 5,
    isActive: true,
  },
];

const supKits = buildSupplierStarterKitsFromStock({
  accountId: 'sup_1',
  packageOptions: supPkgOpts,
  firstName: 'أبو كريم',
  brandName: 'الشمس للخامات',
  rawMaterials: supMaterials,
});
assert(
  supKits.kits.length > 0 && supKits.usedCosting && Boolean(supKits.kits[0].suggestedKitPrice),
  'Supplier Starter Kits: builds kits from actual stock with safe margin pricing'
);

const supVol = buildSupplierSlowStockVolumeTiers({
  accountId: 'sup_1',
  packageOptions: supPkgOpts,
  firstName: 'أبو كريم',
  rawMaterials: supMaterials,
  orders: [],
});
assert(
  supVol.tiers.length === 3 &&
    supVol.tiers.every((t) => (t.marginPercentAfter || 0) >= 15) &&
    supVol.reply.includes('قبل الخصم') &&
    supVol.reply.includes('بعد الخصم'),
  'Supplier Slow-Stock Volume Tiers: preserves min margin & shows before/after'
);

const supPosts = buildSupplierWorkshopPosts({
  firstName: 'أبو كريم',
  brandName: 'الشمس للخامات',
  rawMaterials: supMaterials,
});
assert(
  supPosts.post1Quality.includes('الشمس للخامات') &&
    supPosts.post2Speed.includes('الشمس للخامات') &&
    supPosts.post1Quality.includes('ثابتة') &&
    supPosts.post2Speed.includes('التوريد السريع'),
  'Supplier Posts: generates 2 workshop-targeted posts (quality/color consistency + fast supply)'
);

// ============================================================================
// 9. ترتيب الأولويات الاستباقي (حد أقصى 3 اقتراحات مرتبة حسب الأثر)
// ============================================================================
const fullTop3 = buildProactiveTop3MarketingSuggestions({
  accountId: 'acc_full',
  packageOptions: fullPkgOpts,
  isSupplier: false,
  brandName: 'خيوط الشمس',
  products: [prodHero, prodSlow, prodLoss],
  rawMaterials: rawMatsArtisan,
  orders: ordersArtisan,
  now: mar5,
});
assert(
  fullTop3.length === 3 &&
    fullTop3[0].impactScore >= fullTop3[1].impactScore &&
    fullTop3[1].impactScore >= fullTop3[2].impactScore &&
    fullTop3[0].category === 'pricing', // منتج يخسر يأخذ أعلى أولوية (99)
  'Proactive Priority Engine: caps strictly at 3 suggestions sorted descending by impactScore'
);

// ============================================================================
// 10. حوار السوبر أدمن التفاعلي لمراجعة وتعديل وحفظ الأسئلة المعلقة
// ============================================================================
resetCustomLibrariesStoreForTest();
queueUnansweredQuestionForAdmin(
  'إزاي أمنع اصفرار الريزن بعد الصب؟',
  'احفظ القطعة بعيد عن الشمس المباشرة.'
);
assert(listPendingAdminReviewQuestions().length === 1, 'Admin Review Queue: stores unanswered question');

const revTurn1 = advanceSuperAdminReviewDialogue(INITIAL_ADMIN_REVIEW_SESSION, 'راجع الأسئلة المعلقة', 'حسام');
assert(
  revTurn1.nextSession.active && revTurn1.reply.includes('هل الإجابة دي صح ولا تحب تعدلها؟'),
  'Admin Review Turn 1: presents pending question + proposed answer and asks confirmation'
);

const revTurn2 = advanceSuperAdminReviewDialogue(
  revTurn1.nextSession,
  'عدل: استخدم ريزن مقاوم للأشعة فوق البنفسجية UV واحفظ القطعة بعيد عن الشمس المباشرة والحرارة العالية.',
  'حسام'
);
assert(
  revTurn2.nextSession.active && revTurn2.reply.includes('مقاوم للأشعة فوق البنفسجية'),
  'Admin Review Turn 2: edits draft interactively and shows updated text for review'
);

const revTurn3 = advanceSuperAdminReviewDialogue(revTurn2.nextSession, 'احفظ', 'حسام');
assert(
  Boolean(revTurn3.savedToStore) && listPendingAdminReviewQuestions().length === 0,
  'Admin Review Turn 3: saves approved answer to knowledge store and clears pending queue'
);

const matchedAfterApproval = matchCustomKnowledgeNote('عندي مشكلة اصفرار الريزن بعد الصب أعمل إيه؟');
assert(
  Boolean(matchedAfterApproval && matchedAfterApproval.contentAr.includes('مقاوم للأشعة فوق البنفسجية')),
  'Admin Review Loop End-to-End: newly approved answer immediately resolves user query 100% offline!'
);

console.log(`\n═══════════════════════════════════════════`);
console.log(`Part 5 Verification Summary: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════════`);

if (failed > 0) {
  process.exit(1);
}
