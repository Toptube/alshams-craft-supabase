/**
 * العقول التحليلية الثلاثة لشموسة (أوفلاين 100% — على بيانات الحساب الحالي وبحسب الباقات المفعّلة فقط)
 * (الرسالة رقم 6 من 7 — الجزء E، البند 7 و 8)
 *
 * 1) العقل الاستراتيجي (Strategic Brain):
 *    - تصنيف المنتجات من الطلبات (وبالهامش لو التكاليف مفعّلة): نجوم / حصّالة / فرص / راكد
 *    - التركّز (> 40% من الإيراد من منتج واحد أو عميل واحد)
 *    - الاعتماد (خامة واحدة أو مورد واحد في معظم المنتجات — لو المخزون مفعّل)
 *    - الموسمية من تواريخ الطلبات وتقويم المواسم
 *    - السيولة والمتأخرات (فقط لو الباقات المالية مفعّلة)
 *    - طاقة الإنتاج مقابل الطلبات (فقط لو المخزون/التصنيع مفعّل)
 *    - خيارات النمو (جملة / هدايا شركات / باقات / تخصيص بالاسم) بشرط الربحية
 *
 * 2) العقل الفني (Technical Brain):
 *    - مكتبة المشاكل الفنية لكل حرفة (العَرَض ← الأسباب المحتملة ← أسئلة تشخيص باختيارات ← الحل ← الوقاية ← السلامة)
 *    - تحليل الهالك والوقت من بيانات الحساب (فقط لو التكاليف مفعّلة)
 *    - ترتيب الشغل ونقص الخامات قبل أمر التشغيل + اقتراح خامة بديلة من المنظومة الموحدة بنفس الاستخدام
 *      مع تنبيه إلزامي أن البديل يؤثر على الجودة والتكلفة ويحتاج تأكيد المستخدم
 *
 * 3) العقل التسويقي (Marketing Brain):
 *    - يدمج محرك التسويق من الجزء 5 + مكتبة أساليب التسويق القابلة للتوسيع
 *
 * كل توصية بنفس الصيغة الخماسية:
 * المشكلة / الدليل من أرقام حسابك / الحل / الخطوة الجاية / الأثر المتوقع (تقدير بدون وعد)
 * بحد أقصى 3 توصيات على الشاشة، مع أزرار (هنفّذ / أجّل / مش مناسب) محفوظة محلياً لكل حساب فقط!
 */

import {
  SHAMOUSA_TECHNICAL_PROBLEMS_LIBRARY,
  type TechnicalProblemEntry,
} from '../data/shamousaTechnicalProblemsLibrary';
import {
  SHAMOUSA_MARKETING_METHODS_LIBRARY,
  type MarketingMethodEntry,
} from '../data/shamousaMarketingMethodsLibrary';
import { getAccountBrainOrderBoost } from './shamousaSelfCheckAndLearning';
import {
  SEEDED_UNIFIED_ALIASES,
  SEEDED_UNIFIED_MASTERS,
  SEEDED_UNIFIED_SPECS,
  searchUnifiedMaterials,
} from '../registry/unifiedMaterialsRegistry';
import type {
  InvoiceRecord,
  RawMaterialItem,
  SavedProductRecord,
  WorkOrderRecord,
} from '../types';
import {
  hasFeature,
  type AccountPackageQueryOptions,
} from '../types/subscriptions';
import {
  buildProactiveTop3MarketingSuggestions,
  computeProductionCapacityFromStock,
  extractRealProductEconomics,
  getEgyptianSeasonsCalendar,
} from './shamousaMarketingPricingEngine';
import {
  normalizeArabicKnowledgeText,
  trigramSimilarity,
} from './shamousaKnowledgeStore';

// ============================================================================
// أنواع البيانات الموحدة وحفظ قرارات المستخدم (هنفّذ / أجّل / مش مناسب) لكل حساب فقط
// ============================================================================

export type AnalyticBrainType = 'strategic' | 'technical' | 'marketing';
export type RecommendationUserDecision = 'will_do' | 'snoozed' | 'not_suitable';

export interface AnalyticBrainRecommendation {
  id: string;
  brain: AnalyticBrainType;
  brainLabelAr: string;
  titleAr: string;
  problemAr: string; // المشكلة
  evidenceAr: string; // الدليل من أرقام حسابك
  solutionAr: string; // الحل
  nextStepAr: string; // الخطوة الجاية
  expectedImpactAr: string; // الأثر المتوقع (تقدير بدون وعد)
  safetyWarningAr?: string;
  impactScore: number;
  queryText: string;
}

export interface AnalyticBrainsInput {
  accountId?: string | null;
  packageOptions?: AccountPackageQueryOptions;
  isSupplier?: boolean;
  firstName?: string;
  brandName?: string;
  currency?: string;
  products: SavedProductRecord[];
  rawMaterials: RawMaterialItem[];
  orders: InvoiceRecord[];
  workOrders?: WorkOrderRecord[];
  treasuryBalance?: number;
  now?: Date;
}

export interface ProductPortfolioBuckets {
  stars: string[]; // نجوم: مبيعات عالية وهامش جيد
  cashCowsLowMargin: string[]; // حصّالة: مبيعات عالية وهامش ضعيف
  opportunities: string[]; // فرص: هامش عالي ومبيعات قليلة
  stagnant: string[]; // راكد
  usedCosting: boolean;
}

export interface AllThreeBrainsReport {
  topThreeRecommendations: AnalyticBrainRecommendation[]; // حد أقصى 3 على الشاشة
  strategicCount: number;
  technicalCount: number;
  marketingCount: number;
  portfolio: ProductPortfolioBuckets;
  activeDecisions: Record<string, RecommendationUserDecision>;
}

const BRAIN_DECISIONS_MEM = new Map<string, Record<string, RecommendationUserDecision>>();

function brainDecisionKey(accountId?: string | null): string {
  return `alshams_shamousa_brain_decisions_${accountId || 'guest'}`;
}

export function loadAccountBrainDecisions(
  accountId?: string | null
): Record<string, RecommendationUserDecision> {
  const key = accountId || 'guest';
  if (BRAIN_DECISIONS_MEM.has(key)) {
    return { ...(BRAIN_DECISIONS_MEM.get(key) || {}) };
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(brainDecisionKey(key));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          BRAIN_DECISIONS_MEM.set(key, parsed);
          return { ...parsed };
        }
      }
    } catch {
      // ignore
    }
  }
  return {};
}

export function setAccountBrainDecision(
  accountId: string | null | undefined,
  recommendationId: string,
  decision: RecommendationUserDecision
): Record<string, RecommendationUserDecision> {
  const key = accountId || 'guest';
  const current = loadAccountBrainDecisions(key);
  const next = { ...current, [recommendationId]: decision };
  BRAIN_DECISIONS_MEM.set(key, next);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(brainDecisionKey(key), JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearAccountBrainDecisionsForTest(accountId: string): void {
  const key = accountId || 'guest';
  BRAIN_DECISIONS_MEM.delete(key);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(brainDecisionKey(key));
    } catch {
      // ignore
    }
  }
}

function fmtMoney(n: number, currency = 'ج.م'): string {
  return `${Math.round(n).toLocaleString('ar-EG')} ${currency}`;
}

// ============================================================================
// 1. العقل الاستراتيجي (Strategic Brain)
// ============================================================================

export function runStrategicBrainOffline(input: AnalyticBrainsInput): {
  recommendations: AnalyticBrainRecommendation[];
  portfolio: ProductPortfolioBuckets;
} {
  const recs: AnalyticBrainRecommendation[] = [];
  const portfolio: ProductPortfolioBuckets = {
    stars: [],
    cashCowsLowMargin: [],
    opportunities: [],
    stagnant: [],
    usedCosting: false,
  };

  try {
    const accId = input.accountId || undefined;
    const hasCost = hasFeature('costing', accId, input.packageOptions);
    const hasInv = hasFeature('inventory', accId, input.packageOptions);
    const hasFinance = hasFeature('finance', accId, input.packageOptions);
    const hasCrm = hasFeature('sales_crm', accId, input.packageOptions);
    const currency = input.currency || 'ج.م';

    portfolio.usedCosting = hasCost;

    const validOrders = (input.orders || []).filter(
      (o) => o.status !== 'cancelled' && o.marketplaceStatus !== 'cancelled'
    );
    const products = input.products || [];

    // حساب المبيعات والإيراد الفعلي لكل منتج ولكل عميل
    const productSalesQty = new Map<string, number>();
    const productRevenue = new Map<string, number>();
    const customerRevenue = new Map<string, number>();
    let totalRevenue = 0;

    for (const ord of validOrders) {
      const ordRev = Number(ord.finalTotal ?? ord.totalAmount ?? ord.price ?? 0);
      totalRevenue += Math.max(0, ordRev);
      const custKey = (ord.customerName || ord.customerId || '').trim();
      if (custKey) {
        customerRevenue.set(custKey, (customerRevenue.get(custKey) || 0) + Math.max(0, ordRev));
      }
      if (Array.isArray(ord.items) && ord.items.length > 0) {
        for (const item of ord.items) {
          const pName = (item.productName || '').trim();
          if (!pName) continue;
          const norm = normalizeArabicKnowledgeText(pName);
          productSalesQty.set(norm, (productSalesQty.get(norm) || 0) + Math.max(1, Number(item.quantity || 1)));
          productRevenue.set(norm, (productRevenue.get(norm) || 0) + Math.max(0, Number(item.totalPrice || 0)));
        }
      } else if (ord.productName) {
        const norm = normalizeArabicKnowledgeText(ord.productName);
        productSalesQty.set(norm, (productSalesQty.get(norm) || 0) + 1);
        productRevenue.set(norm, (productRevenue.get(norm) || 0) + Math.max(0, ordRev));
      }
    }

    // (أ) تصنيف المنتجات: نجوم / حصّالة / فرص / راكد
    if (products.length > 0) {
      const salesValues = products.map((p) => productSalesQty.get(normalizeArabicKnowledgeText(p.productName)) || 0);
      const avgSales = salesValues.reduce((s, v) => s + v, 0) / Math.max(1, salesValues.length);
      const highSalesCut = Math.max(2, avgSales);

      for (const p of products) {
        const qty = productSalesQty.get(normalizeArabicKnowledgeText(p.productName)) || 0;
        const eco = hasCost ? extractRealProductEconomics(p) : null;
        const margin = eco && eco.hasRealCost && eco.hasSellingPrice ? eco.marginPercent : undefined;

        if (qty === 0) {
          portfolio.stagnant.push(p.productName);
        } else if (hasCost && margin !== undefined) {
          if (qty >= highSalesCut && margin >= 25) {
            portfolio.stars.push(p.productName);
          } else if (qty >= highSalesCut && margin < 20) {
            portfolio.cashCowsLowMargin.push(p.productName);
          } else if (qty < highSalesCut && margin >= 30) {
            portfolio.opportunities.push(p.productName);
          } else {
            portfolio.stars.push(p.productName);
          }
        } else {
          if (qty >= highSalesCut) portfolio.stars.push(p.productName);
          else portfolio.opportunities.push(p.productName);
        }
      }

      if (hasCost && portfolio.cashCowsLowMargin.length > 0) {
        const target = portfolio.cashCowsLowMargin[0];
        recs.push({
          id: `strat_cashcow_${normalizeArabicKnowledgeText(target).slice(0, 16)}`,
          brain: 'strategic',
          brainLabelAr: 'العقل الاستراتيجي 🧭',
          titleAr: `منتج «حصّالة»: مبيعاته عالية لكن هامشه ضعيف (${target})`,
          problemAr: `المنتج «${target}» بيطلبوه كتير لكن هامشه أقل من 20% فبيستهلك وقت وخامات بربح قليل.`,
          evidenceAr: `من طلبات حسابك وبطاقة التكلفة: مبيعات عالية مع هامش منخفض مقارنة بباقي منتجاتك.`,
          solutionAr: `راجع تسعيره تدريجياً أو اعرضه جوه باقة تجميع مع منتج هامشه أعلى لرفع متوسط الربح.`,
          nextStepAr: `افتح مراجعة أسعاري في شات شموسة أو عدّل السعر في بطاقة «${target}».`,
          expectedImpactAr: `تقدير بدون وعد: تحسين صافي الربح الشهري من نفس حجم الطلبات الحالية.`,
          impactScore: 95,
          queryText: 'تحليل أسعاري ومقارنة منتجاتي',
        });
      }

      if (hasCost && portfolio.opportunities.length > 0) {
        const opp = portfolio.opportunities[0];
        recs.push({
          id: `strat_opp_${normalizeArabicKnowledgeText(opp).slice(0, 16)}`,
          brain: 'strategic',
          brainLabelAr: 'العقل الاستراتيجي 🧭',
          titleAr: `فرصة نمو جاهزة للتسويق: «${opp}»`,
          problemAr: `«${opp}» هامشه الربحي عالي (≥ 30%) لكن مبيعاته لسه قليلة مقارنة بإمكانياته.`,
          evidenceAr: `من أرشيف حسابك: هامش ممتاز مع عدد طلبات أقل من متوسط منتجاتك.`,
          solutionAr: `سلّط عليه الضوء ببوست عرض + بوست ورا الكواليس أو اعرضه كخيار هدايا شركات/تخصيص بالاسم.`,
          nextStepAr: `اضغط «اسأل شموسة» لتجهيز بوستين ورسائل واتساب لـ «${opp}».`,
          expectedImpactAr: `تقدير بدون وعد: زيادة الربح الصافي بمجهود تسويقي أقل من المنتجات منخفضة الهامش.`,
          impactScore: 84,
          queryText: `اكتبيلي بوستين للمتجر عن ${opp}`,
        });
      }
    }

    // (ب) فحص التركّز: > 40% من الإيراد من منتج واحد أو عميل واحد
    if (totalRevenue > 0) {
      let topProdName = '';
      let topProdRev = 0;
      productRevenue.forEach((rev, name) => {
        if (rev > topProdRev) {
          topProdRev = rev;
          topProdName = name;
        }
      });
      const prodShare = Math.round((topProdRev / totalRevenue) * 100);
      if (prodShare > 40 && productRevenue.size >= 1) {
        recs.push({
          id: 'strat_concentration_product',
          brain: 'strategic',
          brainLabelAr: 'العقل الاستراتيجي 🧭',
          titleAr: `تركّز إيراد عالي على منتج واحد (${prodShare}%)`,
          problemAr: `أكتر من 40% من إيراد حسابك معتمد على منتج واحد («${topProdName}»)، وأي هدوء في طلبه هيأثر على الدخل.`,
          evidenceAr: `إيراد «${topProdName}» = ${fmtMoney(topProdRev, currency)} من إجمالي ${fmtMoney(totalRevenue, currency)} (${prodShare}%).`,
          solutionAr: `ابنِ منتج مكمّل له أو باقة هدايا توزّع الإيراد على 2–3 أصناف أساسية.`,
          nextStepAr: `اطلب من شموسة خطة باقة تجميع أو أفكار منتجات جديدة مكمّلة.`,
          expectedImpactAr: `تقدير بدون وعد: تقليل مخاطرة توقف الدخل ورفع استقرار المبيعات الشهرية.`,
          impactScore: 91,
          queryText: 'اقترحيلي عرض تجميع لمنتج راكد',
        });
      }

      let topCustName = '';
      let topCustRev = 0;
      customerRevenue.forEach((rev, cname) => {
        if (rev > topCustRev) {
          topCustRev = rev;
          topCustName = cname;
        }
      });
      const custShare = Math.round((topCustRev / totalRevenue) * 100);
      if (custShare > 40 && validOrders.length >= 2) {
        recs.push({
          id: 'strat_concentration_customer',
          brain: 'strategic',
          brainLabelAr: 'العقل الاستراتيجي 🧭',
          titleAr: `تركّز إيراد على عميل واحد (${custShare}%)`,
          problemAr: `العميل «${topCustName}» يمثل ${custShare}% من إجمالي إيرادك المسجّل (أكتر من حد الأمان 40%).`,
          evidenceAr: `مشتريات هذا العميل ${fmtMoney(topCustRev, currency)} من أصل ${fmtMoney(totalRevenue, currency)}.`,
          solutionAr: `حافظ على علاقتك بيه، وفي نفس الوقت افتح قناة عملاء جدد عبر عروض مواسم أو هدايا شركات.`,
          nextStepAr: `جهّز بوستين لاستقطاب عملاء جدد هذا الأسبوع.`,
          expectedImpactAr: `تقدير بدون وعد: حماية الورشة من الاعتماد الكلي على عميل واحد.`,
          impactScore: 87,
          queryText: 'اكتبيلي بوستين للمتجر',
        });
      }
    }

    // (ج) الاعتماد على خامة واحدة أو مورد واحد (فقط لو باقة المخزون مفعّلة)
    if (hasInv && (input.rawMaterials || []).length > 0) {
      const activeMats = input.rawMaterials.filter((m) => m.isActive !== false);
      const supplierCounts = new Map<string, number>();
      for (const m of activeMats) {
        const sup = (m.supplierName || '').trim();
        if (sup) supplierCounts.set(sup, (supplierCounts.get(sup) || 0) + 1);
      }
      let topSup = '';
      let topSupCnt = 0;
      supplierCounts.forEach((cnt, sup) => {
        if (cnt > topSupCnt) {
          topSupCnt = cnt;
          topSup = sup;
        }
      });
      if (activeMats.length >= 2 && topSup && topSupCnt / activeMats.length >= 0.7) {
        const pct = Math.round((topSupCnt / activeMats.length) * 100);
        recs.push({
          id: 'strat_supplier_dependency',
          brain: 'strategic',
          brainLabelAr: 'العقل الاستراتيجي 🧭',
          titleAr: `اعتماد مرتفع على مورد واحد (${pct}% من خاماتك)`,
          problemAr: `${pct}% من خامات مخزونك مرتبطة بمورد واحد («${topSup}»)، ولو حصل عنده نقص الشغل ممكن يقف.`,
          evidenceAr: `${topSupCnt} من أصل ${activeMats.length} خامة مسجلة في مخزونك تحت نفس المورد.`,
          solutionAr: `سجّل مورد بديل واحد على الأقل لأهم خامتين أساسيتين عندك وقارن الجودة وسرعة التوريد.`,
          nextStepAr: `راجع منظومة الخامات الموحدة وسوق الموردين لتحديد بديل موثوق.`,
          expectedImpactAr: `تقدير بدون وعد: منع تعطل أوردرات العملاء عند نقص أي خامة مفاجئ.`,
          impactScore: 80,
          queryText: 'خامة قطن مجدول',
        });
      }
    }

    // (د) السيولة والمتأخرات (فقط لو باقة المالية أو المبيعات مفعّلة)
    if (hasFinance || hasCrm) {
      const overdueTotal = validOrders.reduce((s, o) => s + Math.max(0, Number(o.remainingAmount || 0)), 0);
      const overdueCount = validOrders.filter((o) => Number(o.remainingAmount || 0) > 0).length;
      if (overdueTotal > 0 && overdueCount > 0) {
        recs.push({
          id: 'strat_overdue_liquidity',
          brain: 'strategic',
          brainLabelAr: 'العقل الاستراتيجي 🧭',
          titleAr: `تحصيل متأخرات فواتير (${fmtMoney(overdueTotal, currency)})`,
          problemAr: `عندك ${overdueCount} فواتير عليها مبالغ متبقية لم تُحصّل بعد، وده بيضغط على سيولة شراء الخامات.`,
          evidenceAr: `إجمالي المتبقي التحصيل من فواتير حسابك: ${fmtMoney(overdueTotal, currency)}` +
            (input.treasuryBalance !== undefined ? ` مقابل رصيد خزينة ${fmtMoney(input.treasuryBalance, currency)}.` : '.'),
          solutionAr: `ابعت تذكير لطيف للعملاء أصحاب المبالغ المتبقية وطبّق نظام عربون واضح للطلبات الجديدة.`,
          nextStepAr: `راجع قائمة الفواتير غير المسددة وابدأ بأكبر فاتورتين.`,
          expectedImpactAr: `تقدير بدون وعد: توفير سيولة فورية تغطي خامات الشغل القادم بدون سحب من ربحك.`,
          impactScore: 93,
          queryText: 'التحليل والحلول الذكية',
        });
      }
    }

    // (هـ) طاقة الإنتاج مقابل أوامر التشغيل المفتوحة (فقط لو المخزون مفعّل)
    if (hasInv && products.length > 0 && (input.rawMaterials || []).length > 0) {
      const cap = computeProductionCapacityFromStock({
        accountId: accId,
        packageOptions: input.packageOptions,
        firstName: input.firstName || 'فنان',
        products,
        rawMaterials: input.rawMaterials,
        orders: validOrders,
      });
      const openWoQty = (input.workOrders || [])
        .filter((w) => w.status !== 'completed' && w.status !== 'cancelled')
        .reduce((s, w) => s + Math.max(1, Number((w as any).quantity ?? (w as any).targetQuantity ?? 1)), 0);

      const zeroCapItem = cap.items.find((i) => i.maxUnits === 0);
      if (zeroCapItem) {
        recs.push({
          id: `strat_cap_zero_${zeroCapItem.productId}`,
          brain: 'strategic',
          brainLabelAr: 'العقل الاستراتيجي 🧭',
          titleAr: `توقف طاقة إنتاج «${zeroCapItem.productName}» لنقص خامة`,
          problemAr: `المخزون الحالي لا يكفي لإنتاج قطعة واحدة من «${zeroCapItem.productName}».`,
          evidenceAr: `خامة «${zeroCapItem.bottleneckMaterialName}» رصيدها ${zeroCapItem.bottleneckCurrentStock} ${zeroCapItem.bottleneckUnit} بينما القطعة تحتاج ${zeroCapItem.bottleneckRequiredPerUnit}` +
            (openWoQty > 0 ? ` (مع ${openWoQty} قطع في أوامر تشغيل مفتوحة).` : '.'),
          solutionAr: `اطلب توريد «${zeroCapItem.bottleneckMaterialName}» أو اختار خامة بديلة متوافقة من المنظومة الموحدة بعد التأكد من الجودة والتكلفة.`,
          nextStepAr: `اطلب من شموسة تقرير طاقة الإنتاج الكامل أو البدائل المتاحة.`,
          expectedImpactAr: `تقدير بدون وعد: تجنّب تأخير التسليم للعملاء واستمرار خط الإنتاج.`,
          impactScore: 92,
          queryText: 'أقدر أصنع كام قطعة بالمخزون الحالي؟',
        });
      }
    }

    // (و) الموسمية + خيارات النمو المربحة
    const seasons = getEgyptianSeasonsCalendar({ now: input.now, accountId: accId });
    const nearSeason = seasons.find((s) => s.isWithinAlertWindow);
    if (nearSeason) {
      recs.push({
        id: `strat_season_${nearSeason.id}`,
        brain: 'strategic',
        brainLabelAr: 'العقل الاستراتيجي 🧭',
        titleAr: `استعد استراتيجياً لموسم ${nearSeason.nameAr} (بعد ${nearSeason.daysUntil} يوم)`,
        problemAr: `الموسم قرب جداً والتأخير في تجهيز العروض أو الباقات بيضيع ذروة الطلب.`,
        evidenceAr: `تقويم المواسم المصري يسجّل ${nearSeason.nameAr} بتاريخ ${nearSeason.dateIso} (ضمن نافذة الـ 3 أسابيع).`,
        solutionAr: `ركّز على: ${nearSeason.whatToMakeAr} — واعرض خيارات هدايا أو تخصيص بالاسم لزيادة قيمة السلة.`,
        nextStepAr: `اطلب خطة الموسم وبوستاته الجاهزة من شموسة دلوقتي.`,
        expectedImpactAr: `تقدير بدون وعد: التقاط موجة الشراء الموسمية قبل زحمة المنافسين.`,
        impactScore: 89,
        queryText: 'إيه المواسم الجاية؟',
      });
    } else if (portfolio.stars.length > 0) {
      const starName = portfolio.stars[0];
      recs.push({
        id: 'strat_growth_options',
        brain: 'strategic',
        brainLabelAr: 'العقل الاستراتيجي 🧭',
        titleAr: `خيار نمو مربح حول نجم ورشتك «${starName}»`,
        problemAr: `الاعتماد على بيع القطعة الفردية فقط بيحط سقف لحجم المبيعات الشهرية.`,
        evidenceAr: `«${starName}» ضمن أقوى منتجات حسابك مبيعاً فعلياً.`,
        solutionAr: hasCost
          ? `افتح له خط نمو: باقات هدايا، تخصيص بالاسم، أو عروض جملة/هدايا شركات بشرط الحفاظ على حد الربح الأدنى.`
          : `افتح له خط نمو: باقات هدايا أو تخصيص بالاسم — وحدد أقل سعر تقبل بيه لأي طلب كمية قبل الخصم.`,
        nextStepAr: `اسأل شموسة عن باقات أو بوستات مخصّصة لـ «${starName}».`,
        expectedImpactAr: `تقدير بدون وعد: مضاعفة قيمة الطلب الواحد بدون زيادة نفس تكلفة التسويق.`,
        impactScore: 74,
        queryText: `اكتبيلي بوستين للمتجر عن ${starName}`,
      });
    }
  } catch {
    // حماية باقي العقول
  }

  return { recommendations: recs, portfolio };
}

// ============================================================================
// 2. العقل الفني (Technical Brain): مشاكل فنية + هالك ووقت + نقص خامات وبدائل موحدة
// ============================================================================

export interface TechnicalDiagnosisResult {
  matched: boolean;
  entry?: TechnicalProblemEntry;
  reply: string;
  options: Array<{ id: string; label: string; queryText: string }>;
}

/**
 * يطابق أي مشكلة فنية يذكرها الفنان في مكتبة المشاكل الفنية (قراءة حية — أي إضافة جديدة تعمل بدون تعديل كود)
 */
export function diagnoseTechnicalProblemOffline(
  rawQuery: string,
  firstName = 'فنان',
  library: TechnicalProblemEntry[] = SHAMOUSA_TECHNICAL_PROBLEMS_LIBRARY
): TechnicalDiagnosisResult {
  try {
    const qNorm = normalizeArabicKnowledgeText(rawQuery);
    if (!qNorm) return { matched: false, reply: '', options: [] };

    let best: { entry: TechnicalProblemEntry; score: number } | null = null;
    for (const item of library) {
      let score = 0;
      const symNorm = normalizeArabicKnowledgeText(item.symptomAr);
      const craftNorm = normalizeArabicKnowledgeText(item.craftNameAr);

      if (qNorm.includes(symNorm) || symNorm.includes(qNorm)) score += 10;
      if (craftNorm && qNorm.includes(craftNorm)) score += 3;

      for (const kw of item.keywords) {
        const nkw = normalizeArabicKnowledgeText(kw);
        if (nkw.length >= 3 && qNorm.includes(nkw)) {
          score += nkw.includes(' ') ? 7 : 4;
        }
      }

      const sim = trigramSimilarity(qNorm, `${item.craftNameAr} ${item.symptomAr}`);
      if (sim >= 0.32) score += sim * 10;

      if (score >= 4.5 && (!best || score > best.score)) {
        best = { entry: item, score };
      }
    }

    if (!best) return { matched: false, reply: '', options: [] };
    const e = best.entry;
    const diagQ = e.diagnosticQuestions[0];

    const lines: string[] = [
      `🔧 **تشخيص فني (${e.craftNameAr}) يا ${firstName}:**`,
      `• **العَرَض:** ${e.symptomAr}`,
      `• **الأسباب المحتملة:** ${e.possibleCausesAr.join(' • ')}`,
      `\n✅ **الحل العملي:**`,
      ...e.solutionStepsAr.map((s, i) => `${i + 1}. ${s}`),
      `\n🛡️ **الوقاية:** ${e.preventionAr.join(' • ')}`,
    ];

    if (e.safetyWarningAr) {
      lines.push(`\n⚠️ **تحذير السلامة:** ${e.safetyWarningAr}`);
    }
    if (diagQ) {
      lines.push(`\n❓ **للتشخيص الأدق:** ${diagQ.questionAr}`);
    }

    const options = diagQ
      ? diagQ.choices.slice(0, 3).map((c) => ({
          id: c.id,
          label: c.labelAr.slice(0, 36),
          queryText: `تشخيص ${e.craftNameAr}: ${c.labelAr} (${c.focusedTipAr})`,
        }))
      : [
          { id: `tech_alt_${e.id}`, label: 'خامات التخصص الموحدة 🧶', queryText: `خامات نموذجية ${e.craftNameAr}` },
        ];

    return {
      matched: true,
      entry: e,
      reply: lines.join('\n'),
      options,
    };
  } catch {
    return { matched: false, reply: '', options: [] };
  }
}

export interface UnifiedAlternativeSuggestion {
  missingMaterialName: string;
  alternativeCode: string;
  alternativeNameAr: string;
  warningAr: string;
}

/**
 * يقترح خامة بديلة من منظومة الخامات الموحدة بنفس القسم والاستخدام مع تنبيه الجودة والتكلفة الإلزامي
 */
export function suggestUnifiedMaterialAlternative(
  missingMaterialName: string
): UnifiedAlternativeSuggestion | null {
  try {
    const tryQueries = [
      missingMaterialName,
      missingMaterialName.replace(/\d+(?:\.\d+)?\s*(?:مم|سم|متر|جم|كجم|مل|mm|cm|g|kg)/gi, '').trim(),
      ...normalizeArabicKnowledgeText(missingMaterialName)
        .split(' ')
        .filter((w) => w.length >= 3 && !/^\d+$/.test(w)),
    ].filter(Boolean);

    let primary = undefined;
    for (const q of tryQueries) {
      const res = searchUnifiedMaterials(
        q,
        SEEDED_UNIFIED_MASTERS,
        SEEDED_UNIFIED_SPECS,
        SEEDED_UNIFIED_ALIASES
      );
      if (res.matches[0]?.master) {
        primary = res.matches[0].master;
        break;
      }
    }
    if (!primary) return null;

    const alt =
      SEEDED_UNIFIED_MASTERS.find(
        (m) =>
          m.code !== primary!.code &&
          m.status === 'active' &&
          m.prefix === primary!.prefix &&
          m.workshopTags.some((t) => primary!.workshopTags.includes(t))
      ) ||
      SEEDED_UNIFIED_MASTERS.find(
        (m) =>
          m.code !== primary!.code &&
          m.status === 'active' &&
          (m.prefix === primary!.prefix || m.workshopTags.some((t) => primary!.workshopTags.includes(t)))
      );
    if (!alt) return null;

    return {
      missingMaterialName,
      alternativeCode: alt.code,
      alternativeNameAr: alt.canonicalName,
      warningAr:
        'تنبيه مهم: الخامة البديلة قد تؤثر على الجودة والملمس والتكلفة، وتحتاج تأكيدك ومراجعة السعر قبل التنفيذ.',
    };
  } catch {
    return null;
  }
}

export function runTechnicalBrainOffline(input: AnalyticBrainsInput): AnalyticBrainRecommendation[] {
  const recs: AnalyticBrainRecommendation[] = [];

  try {
    const accId = input.accountId || undefined;
    const hasCost = hasFeature('costing', accId, input.packageOptions);
    const hasInv = hasFeature('inventory', accId, input.packageOptions);
    const currency = input.currency || 'ج.م';
    const products = input.products || [];

    // (أ) تحليل الهالك والوقت/المصنعية (فقط لو باقة التكاليف مفعّلة!)
    if (hasCost && products.length > 0) {
      // 1) هالك أعلى من المعتاد
      const wasteEntries = products
        .map((p) => ({
          name: p.productName,
          wastePct: Number(p.output?.craftMetrics?.wasteFactorPercent || 0),
        }))
        .filter((x) => x.wastePct > 0);

      if (wasteEntries.length > 0) {
        const avgWaste = wasteEntries.reduce((s, w) => s + w.wastePct, 0) / wasteEntries.length;
        const highWaste = wasteEntries
          .filter((w) => w.wastePct >= Math.max(15, avgWaste * 1.35))
          .sort((a, b) => b.wastePct - a.wastePct)[0];

        if (highWaste) {
          recs.push({
            id: `tech_waste_${normalizeArabicKnowledgeText(highWaste.name).slice(0, 16)}`,
            brain: 'technical',
            brainLabelAr: 'العقل الفني 🔧',
            titleAr: `نسبة هالك أعلى من المعتاد في «${highWaste.name}» (${highWaste.wastePct}%)`,
            problemAr: `هالك الخامة في «${highWaste.name}» وصل ${highWaste.wastePct}% وهو أعلى من متوسط ورشتك (${Math.round(avgWaste)}%).`,
            evidenceAr: `من بطاقة تكلفة «${highWaste.name}»: نسبة الهالك ${highWaste.wastePct}% مقابل متوسط ${Math.round(avgWaste)}%.`,
            solutionAr: `راجع مقاسات القص أو التجهيز المسبق بالدفعة واستغل قصاقيص الخامة في منتجات صغيرة مكمّلة.`,
            nextStepAr: `راجع خطوة القص في أمر التشغيل القادم وقارن وزن الخامة قبل وبعد.`,
            expectedImpactAr: `تقدير بدون وعد: خفض تكلفة الخامة المباشرة للقطعة بدون المساس بالجودة.`,
            impactScore: 86,
            queryText: 'تحليل أسعاري ومقارنة منتجاتي',
          });
        }
      }

      // 2) مصنعية/وقت أعلى من المعتاد مقارنة بالتكلفة
      const laborRatios = products
        .map((p) => {
          const eco = extractRealProductEconomics(p);
          const labor = Number(p.input?.laborWage ?? p.output?.laborWage ?? 0);
          const ratio = eco.unitCost > 0 ? Math.round((labor / eco.unitCost) * 100) : 0;
          return { name: p.productName, labor, unitCost: eco.unitCost, ratio };
        })
        .filter((x) => x.labor > 0 && x.unitCost > 0);

      if (laborRatios.length > 0) {
        const avgRatio = laborRatios.reduce((s, l) => s + l.ratio, 0) / laborRatios.length;
        const heavyLabor = laborRatios
          .filter((l) => l.ratio >= Math.max(50, avgRatio + 15))
          .sort((a, b) => b.ratio - a.ratio)[0];

        if (heavyLabor) {
          recs.push({
            id: `tech_labor_${normalizeArabicKnowledgeText(heavyLabor.name).slice(0, 16)}`,
            brain: 'technical',
            brainLabelAr: 'العقل الفني 🔧',
            titleAr: `وقت/مصنعية مرتفعة في «${heavyLabor.name}» (${heavyLabor.ratio}% من التكلفة)`,
            problemAr: `المصنعية تمثل ${heavyLabor.ratio}% من إجمالي تكلفة «${heavyLabor.name}» (${fmtMoney(heavyLabor.labor, currency)} من ${fmtMoney(heavyLabor.unitCost, currency)}).`,
            evidenceAr: `مقارنة داخلية ببطاقات حسابك: متوسط نسبة المصنعية ${Math.round(avgRatio)}% بينما هذا المنتج ${heavyLabor.ratio}%.`,
            solutionAr: `نفّذ مراحل التجهيز والقص بالدفعة (مثلاً 5 قطع معاً) بدل قطعة بقطعة لتوفير الوقت، وتأكد إن السعر يغطي مجهودك.`,
            nextStepAr: `جرّب تجهيز دفعة مصغّرة من 3 قطع وسجّل الوقت الفعلي.`,
            expectedImpactAr: `تقدير بدون وعد: توفير وقت إنتاج يتيح تنفيذ طلبات إضافية بنفس الأسبوع.`,
            impactScore: 81,
            queryText: 'أقدر أصنع كام قطعة بالمخزون الحالي؟',
          });
        }
      }
    }

    // (ب) نقص الخامات قبل أمر التشغيل + اقتراح خامة بديلة من المنظومة الموحدة
    if (hasInv && (input.rawMaterials || []).length > 0) {
      const lowMats = input.rawMaterials
        .filter((m) => m.isActive !== false && Number(m.currentStock || 0) <= Number(m.minAlertThreshold || 2))
        .sort((a, b) => Number(a.currentStock || 0) - Number(b.currentStock || 0));

      if (lowMats.length > 0) {
        const urgentMat = lowMats[0];
        const alt = suggestUnifiedMaterialAlternative(urgentMat.materialName);
        const altLine = alt
          ? ` ويمكن مؤقتاً النظر في بديل من المنظومة الموحدة: **[${alt.alternativeCode}] ${alt.alternativeNameAr}** (${alt.warningAr})`
          : '';

        recs.push({
          id: `tech_shortage_${urgentMat.id}`,
          brain: 'technical',
          brainLabelAr: 'العقل الفني 🔧',
          titleAr: `نقص خامة قبل التشغيل: «${urgentMat.materialName}»`,
          problemAr: `رصيد «${urgentMat.materialName}» وصل ${urgentMat.currentStock} ${urgentMat.unit} (أقل من حد الأمان ${urgentMat.minAlertThreshold}).`,
          evidenceAr: `من رصيد مخزون حسابك الفعلي: خامة «${urgentMat.materialName}» قربت تخلص قبل تنفيذ أوامر الشغل الجاية.`,
          solutionAr: `رتّب أولوية الشغل للقطع المتوفر خاماتها الآن، واطلب توريد «${urgentMat.materialName}».${altLine}`,
          nextStepAr: `راجع مخزون الخامات وأكّد طلب التوريد أو اختيار البديل قبل بدء أمر التشغيل.`,
          expectedImpactAr: `تقدير بدون وعد: منع توقف قطعة في نص الشغل والحفاظ على مواعيد التسليم.`,
          safetyWarningAr: alt?.warningAr,
          impactScore: 90,
          queryText: `خامة ${urgentMat.materialName}`,
        });
      }
    }
  } catch {
    // حماية باقي العقول
  }

  return recs;
}

// ============================================================================
// 3. العقل التسويقي (Marketing Brain) — يجمع الجزء 5 + مكتبة أساليب التسويق
// ============================================================================

export function runMarketingBrainOffline(
  input: AnalyticBrainsInput,
  methodsLibrary: MarketingMethodEntry[] = SHAMOUSA_MARKETING_METHODS_LIBRARY
): AnalyticBrainRecommendation[] {
  const recs: AnalyticBrainRecommendation[] = [];
  try {
    const topMarketing = buildProactiveTop3MarketingSuggestions({
      accountId: input.accountId,
      packageOptions: input.packageOptions,
      isSupplier: input.isSupplier,
      brandName: input.brandName,
      products: input.products,
      rawMaterials: input.rawMaterials,
      orders: input.orders,
      now: input.now,
      currency: input.currency || 'ج.م',
    });

    for (const m of topMarketing) {
      const matchedMethod = methodsLibrary.find(
        (ml) =>
          (ml.suitableFor === 'both' || ml.suitableFor === (input.isSupplier ? 'supplier' : 'artisan')) &&
          (m.category === 'bundle' ? ml.category === 'offer' : ml.category === 'content')
      );
      recs.push({
        id: `mkt_${m.id}`,
        brain: 'marketing',
        brainLabelAr: 'العقل التسويقي 📣',
        titleAr: m.titleAr,
        problemAr: m.titleAr,
        evidenceAr: m.summaryAr,
        solutionAr: matchedMethod
          ? `${matchedMethod.titleAr}: ${matchedMethod.howToApplyStepsAr[0]}`
          : `نفّذ خطة التسويق المقترحة بناءً على بيانات متجرك الحالية.`,
        nextStepAr: `اضغط «اسأل شموسة» لتوليد البوستات والعروض الجاهزة باسم متجرك.`,
        expectedImpactAr:
          matchedMethod?.expectedImpactNoteAr ||
          'تقدير بدون وعد: زيادة التفاعل وتحريك الطلبات على منتجاتك الحالية.',
        impactScore: m.impactScore,
        queryText: m.queryText,
      });
    }
  } catch {
    // حماية
  }
  return recs;
}

// ============================================================================
// 4. المنسّق الموحد للعقول الثلاثة (حد أقصى 3 توصيات على الشاشة + فلترة قرارات الحساب)
// ============================================================================

export function runAllThreeAnalyticBrainsOffline(input: AnalyticBrainsInput): AllThreeBrainsReport {
  const activeDecisions = loadAccountBrainDecisions(input.accountId);
  const strategic = runStrategicBrainOffline(input);
  const technical = runTechnicalBrainOffline(input);
  const marketing = runMarketingBrainOffline(input);

  const combined = [...strategic.recommendations, ...technical, ...marketing].filter((r) => {
    const d = activeDecisions[r.id];
    return d !== 'not_suitable' && d !== 'snoozed';
  });

  // إزالة التكرار بالعنوان + ترتيب تنازلي حسب الأثر مع ترجيح تعلّم الأسلوب المحلي للحساب (بدون مساس بقفل الباقات) + حد أقصى 3 توصيات فقط!
  const seen = new Set<string>();
  const deduped: AnalyticBrainRecommendation[] = [];
  const scoredCombined = [...combined].sort((a, b) => {
    const scoreA = a.impactScore + getAccountBrainOrderBoost(input.accountId, a.brain);
    const scoreB = b.impactScore + getAccountBrainOrderBoost(input.accountId, b.brain);
    return scoreB - scoreA;
  });
  for (const item of scoredCombined) {
    const key = normalizeArabicKnowledgeText(item.titleAr);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return {
    topThreeRecommendations: deduped.slice(0, 3),
    strategicCount: strategic.recommendations.length,
    technicalCount: technical.length,
    marketingCount: marketing.length,
    portfolio: strategic.portfolio,
    activeDecisions,
  };
}

export function formatAnalyticBrainsReply(
  firstName: string,
  report: AllThreeBrainsReport,
  focusBrain?: AnalyticBrainType
): {
  reply: string;
  options: Array<{ id: string; label: string; queryText: string }>;
} {
  const list = focusBrain
    ? report.topThreeRecommendations.filter((r) => r.brain === focusBrain).slice(0, 3)
    : report.topThreeRecommendations.slice(0, 3);

  const effectiveList = list.length > 0 ? list : report.topThreeRecommendations.slice(0, 3);

  if (effectiveList.length === 0) {
    return {
      reply:
        `أهلاً يا ${firstName} ☀️ العقول التحليلية الثلاثة (الاستراتيجي + الفني + التسويقي) جاهزة، لكن حسابك لسه محتاج تضيف منتجات أو طلبات عشان أطلعلك توصيات بأرقام حقيقية من شغلك.`,
      options: [
        { id: 'br_emp_1', label: 'ابدأ منتج جديد ✨', queryText: 'عايز أعمل منتج جديد' },
        { id: 'br_emp_2', label: 'تقويم المواسم المصري 🗓️', queryText: 'إيه المواسم الجاية؟' },
        { id: 'br_emp_3', label: 'خامات موحدة 🧶', queryText: 'خامة قطن مجدول' },
      ],
    };
  }

  const portfolioLine =
    report.portfolio.stars.length + report.portfolio.stagnant.length > 0
      ? `\n📊 *تصنيف منتجاتك:* نجوم (${report.portfolio.stars.length}) • فرص (${report.portfolio.opportunities.length}) • راكد (${report.portfolio.stagnant.length})` +
        (report.portfolio.usedCosting ? ` • حصّالة هامش ضعيف (${report.portfolio.cashCowsLowMargin.length})` : '') +
        `\n`
      : '';

  const blocks = effectiveList.map(
    (r, idx) =>
      `${idx + 1}) **[${r.brainLabelAr}] ${r.titleAr}**\n` +
      `• **المشكلة:** ${r.problemAr}\n` +
      `• **الدليل من أرقام حسابك:** ${r.evidenceAr}\n` +
      `• **الحل:** ${r.solutionAr}\n` +
      `• **الخطوة الجاية:** ${r.nextStepAr}\n` +
      `• **الأثر المتوقع:** ${r.expectedImpactAr}` +
      (r.safetyWarningAr ? `\n• ⚠️ **تنبيه:** ${r.safetyWarningAr}` : '')
  );

  return {
    reply:
      `🧠 **خلاصة العقول التحليلية الثلاثة (أهم ${effectiveList.length} توصيات من بيانات حسابك فقط) يا ${firstName}:**${portfolioLine}\n` +
      blocks.join('\n\n') +
      `\n\nتقدر تضغط على أي توصية تحت لتنفيذها أو إدارتها (هنفّذ / أجّل / مش مناسب) في تبويب «النتائج» 👇`,
    options: effectiveList.map((r, i) => ({
      id: `br_opt_${i}`,
      label: `${r.brainLabelAr.split(' ')[1] || 'نفّذ'}: ${r.titleAr.slice(0, 26)}`,
      queryText: r.queryText,
    })),
  };
}
