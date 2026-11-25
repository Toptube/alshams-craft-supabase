/**
 * محرك التسويق والتسعير والإنتاج لشموسة — الرسالة رقم 5 من 7 (الجزء ج)
 * يعمل محلياً أوفلاين 100% فوق بيانات الحساب المفتوح + منظومة الخامات الموحدة + المكتبة التسويقية.
 *
 * القواعد الثابتة الملتزم بها حرفياً:
 * 1) لا يغيّر أي معادلة تكاليف ولا أي شاشة حاسبة؛ عند الحاجة لحساب تكلفة يستدعي دالة الحاسبة
 *    الموجودة نفسها (`buildUnifiedFinancialOutput`) بمدخلات واضحة فقط بدون تخمين.
 * 2) باقات مستقلة بالكامل (`hasFeature`): لا يذكر تكلفة أو هامش عند غياب `costing`، ولا مخزون عند غياب `inventory`.
 * 3) منظومة الخامات الموحدة مفتوحة لجميع الحسابات بغض النظر عن الباقة.
 * 4) خصوصية كاملة لكل حساب: التعديلات المحلية للتواريخ والملاحظات لا تخرج أبداً عن `accountId`.
 * 5) لا اختلاق أرقام ولا ادعاءات ممنوعة (يمرّر النصوص على فلتر القاعدة 6).
 * 6) كل دالة محمية بـ try/catch بحيث لا تؤثر أي مشكلة على باقي شات شموسة.
 */

import {
  SEEDED_UNIFIED_ALIASES,
  SEEDED_UNIFIED_MASTERS,
  SEEDED_UNIFIED_SPECS,
  UNIFIED_CATEGORIES,
  UNIT_CHAINS,
  normalizeArabicText,
  searchUnifiedMaterials,
  type UnifiedMaterialMaster,
} from '../registry/unifiedMaterialsRegistry';
import {
  buildUnifiedFinancialOutput,
} from '../utils/craftUnifiedFinancials';
import type {
  CalculationInput,
  CalculationOutput,
  ExtraMaterialRow,
  InvoiceRecord,
  RawMaterialItem,
  SavedProductRecord,
} from '../types';
import {
  hasFeature,
  type AccountPackageQueryOptions,
} from '../types/subscriptions';
import {
  getEffectiveMarketingLibrary,
  loadAccountMarketingInsights,
  type AccountMarketingInsight,
} from './shamousaCustomLibrariesStore';
import {
  sanitizeForbiddenMarketingClaims,
  understandProductSentence,
} from './shamousaProductUnderstanding';

// ============================================================================
// أدوات مساعدة عامة
// ============================================================================

function normAr(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z0-9\s./-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function fmtMoney(n: number, currency = 'ج.م'): string {
  return `${Math.round(n).toLocaleString('ar-EG')} ${currency}`;
}

export interface ShamousaMarketingReplyBlock {
  reply: string;
  copyBlocks?: Array<{ id: string; title: string; content: string }>;
  options?: Array<{ id: string; label: string; queryText: string }>;
  awaitingFloorPriceFor?: { productName: string; listedPrice?: number };
}

// ============================================================================
// 1. قراءة منظومة الخامات الموحدة (مفتوحة لجميع الحسابات بدون قيد باقة)
// ============================================================================

export interface ShamousaUnifiedMaterialMatch {
  code: string;
  canonicalName: string;
  categoryNameAr: string;
  unitChainLabel: string;
  artistAliases: string[];
  supplierAliases: string[];
  workshopTags: string[];
  matchedVia: string;
}

export interface UnifiedMaterialLookupResponse {
  query: string;
  matches: ShamousaUnifiedMaterialMatch[];
  disambiguationMessage?: string;
  suggestedFromSpecialty?: {
    specialtyNameAr: string;
    typicalMaterials: Array<{
      typicalName: string;
      unifiedCode?: string;
      unifiedCanonicalName?: string;
      unitChainLabel?: string;
    }>;
  };
}

function formatUnitChain(master: UnifiedMaterialMaster): string {
  const chain = UNIT_CHAINS.find((c) => c.code === master.unitChain);
  if (!chain) return master.unitNote || master.unitChain;
  return `${chain.titleAr} (${chain.artisanUnits.join(' ← ')})`;
}

function getCategoryLabel(prefix: string): string {
  return UNIFIED_CATEGORIES.find((c) => c.prefix === prefix)?.nameAr || prefix;
}

/**
 * تبحث عن أي خامة ذكرها المستخدم (باسمها العامي أو الرسمي أو كودها) في منظومة الخامات الموحدة،
 * ولو الجملة فيها تخصص/منتج بتقترح الخامات النموذجية للتخصص وتطابقها بالاسم الموحد والكود.
 */
export function lookupUnifiedMaterialForShamousa(rawQuery: string): UnifiedMaterialLookupResponse {
  try {
    const clean = String(rawQuery || '').trim();
    const cleanedSearch = normAr(clean)
      .replace(/(عايز اعرف|ايه هي|ما هي|خامات نموذجيه|خامه|خامات|في منظومه الخامات|الخامات الموحده|كود خامه|وحدات قياس|الموحده|لصناعه|لعمل)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const searchInput = cleanedSearch || clean;
    const directRes = searchUnifiedMaterials(
      searchInput,
      SEEDED_UNIFIED_MASTERS,
      SEEDED_UNIFIED_SPECS,
      SEEDED_UNIFIED_ALIASES
    );

    // لو البحث الكامل ما جابش نتيجة، نجرّب الكلمات الأساسية ونجمع نقاط التطابق لكل كود
    let finalMatches = directRes.matches;
    let disambiguationMessage = directRes.disambiguationMessage;

    if (finalMatches.length === 0 && searchInput.includes(' ')) {
      const tokens = searchInput
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3);
      const byCode = new Map<string, (typeof finalMatches)[number]>();
      for (const tok of tokens) {
        const sub = searchUnifiedMaterials(
          tok,
          SEEDED_UNIFIED_MASTERS,
          SEEDED_UNIFIED_SPECS,
          SEEDED_UNIFIED_ALIASES
        );
        if (!disambiguationMessage && sub.disambiguationMessage) {
          disambiguationMessage = sub.disambiguationMessage;
        }
        for (const m of sub.matches.slice(0, 6)) {
          const prev = byCode.get(m.master.code);
          if (prev) {
            byCode.set(m.master.code, { ...prev, score: prev.score + m.score });
          } else {
            byCode.set(m.master.code, { ...m });
          }
        }
      }
      finalMatches = Array.from(byCode.values()).sort(
        (a, b) => b.score - a.score || a.master.code.localeCompare(b.master.code)
      );
    }

    const mappedMatches: ShamousaUnifiedMaterialMatch[] = finalMatches.slice(0, 6).map((m) => ({
      code: m.master.code,
      canonicalName: m.master.canonicalName,
      categoryNameAr: getCategoryLabel(m.master.prefix),
      unitChainLabel: formatUnitChain(m.master),
      artistAliases: m.master.artistAliases.slice(0, 4),
      supplierAliases: m.master.supplierAliases.slice(0, 3),
      workshopTags: m.master.workshopTags.slice(0, 4),
      matchedVia: m.matchedVia,
    }));

    // مطابقة الخامات النموذجية من المكتبة التسويقية لو التخصص واضح
    let suggestedFromSpecialty: UnifiedMaterialLookupResponse['suggestedFromSpecialty'];
    const understood = understandProductSentence(clean);
    if (understood.specialty && understood.specialty.typicalMaterials.length > 0) {
      const typicalMapped = understood.specialty.typicalMaterials.map((tm) => {
        const tmSearch = searchUnifiedMaterials(
          tm,
          SEEDED_UNIFIED_MASTERS,
          SEEDED_UNIFIED_SPECS,
          SEEDED_UNIFIED_ALIASES
        );
        let best = tmSearch.matches[0];
        if (!best) {
          // جرّب أول كلمتين من اسم الخامة النموذجية
          const subTokens = tm.split(/[\s/()]+/).filter((w) => w.length >= 3);
          for (const st of subTokens) {
            const subRes = searchUnifiedMaterials(
              st,
              SEEDED_UNIFIED_MASTERS,
              SEEDED_UNIFIED_SPECS,
              SEEDED_UNIFIED_ALIASES
            );
            if (subRes.matches[0]) {
              best = subRes.matches[0];
              break;
            }
          }
        }
        return {
          typicalName: tm,
          unifiedCode: best?.master.code,
          unifiedCanonicalName: best?.master.canonicalName,
          unitChainLabel: best ? formatUnitChain(best.master) : undefined,
        };
      });
      suggestedFromSpecialty = {
        specialtyNameAr: understood.specialty.nameAr,
        typicalMaterials: typicalMapped,
      };
    }

    return {
      query: clean,
      matches: mappedMatches,
      disambiguationMessage,
      suggestedFromSpecialty,
    };
  } catch {
    return { query: rawQuery, matches: [] };
  }
}

export function formatUnifiedMaterialReply(firstName: string, rawQuery: string): ShamousaMarketingReplyBlock {
  const res = lookupUnifiedMaterialForShamousa(rawQuery);
  const lines: string[] = [];

  if (res.matches.length > 0) {
    lines.push(`🧶 **من منظومة الخامات الموحدة (متاحة لكل الحسابات) يا ${firstName}:**`);
    for (const m of res.matches.slice(0, 4)) {
      const aliases = m.artistAliases.length > 0 ? ` — مسميات دارجة: ${m.artistAliases.join('، ')}` : '';
      lines.push(
        `• **[${m.code}] ${m.canonicalName}** (${m.categoryNameAr})\n` +
          `  ↳ سلسلة الوحدات: ${m.unitChainLabel}${aliases}`
      );
    }
    if (res.disambiguationMessage) {
      lines.push(`\n⚠️ ${res.disambiguationMessage}`);
    }
  }

  if (res.suggestedFromSpecialty) {
    lines.push(
      `\n📋 **الخامات النموذجية لتخصص «${res.suggestedFromSpecialty.specialtyNameAr}» ومطابقتها بالمنظومة الموحدة:**`
    );
    for (const item of res.suggestedFromSpecialty.typicalMaterials.slice(0, 6)) {
      if (item.unifiedCode) {
        lines.push(
          `• **${item.typicalName}** ← مطابقة: **[${item.unifiedCode}] ${item.unifiedCanonicalName}** (${item.unitChainLabel})`
        );
      } else {
        lines.push(`• **${item.typicalName}** *(خامة متخصصة — تُسجَّل بالوحدة المناسبة لورشتك)*`);
      }
    }
  }

  if (lines.length === 0) {
    return {
      reply:
        `ما لقيتش خامة مطابقة بالاسم ده في منظومة الخامات الموحدة يا ${firstName}.\n` +
        `اكتبلي اسم الخامة الدارج (مثلاً: «قطن مجدول» أو «ريزن» أو «شمع صويا» أو كود زي TH0001) وهجيبهالك بوحداتها فوراً!`,
      options: [
        { id: 'um_q1', label: 'خامة قطن مجدول 🧶', queryText: 'خامة قطن مجدول' },
        { id: 'um_q2', label: 'خامات الريزن ✨', queryText: 'خامات نموذجية للريزن' },
        { id: 'um_q3', label: 'خامات الشموع 🕯️', queryText: 'خامات نموذجية للشموع' },
      ],
    };
  }

  return {
    reply: lines.join('\n'),
    options: [
      { id: 'um_next_cost', label: 'احسبيلي تكلفة قطعة 💰', queryText: 'المنتج ده بيتكلف كام؟' },
      { id: 'um_next_cap', label: 'أقدر أصنع كام قطعة؟ 📦', queryText: 'أقدر أصنع كام قطعة بالمخزون الحالي؟' },
      { id: 'um_next_radar', label: 'أفكار منتجات من خاماتي 💡', queryText: 'اقترحيلي أفكار منتجات جديدة من خاماتي' },
    ],
  };
}

// ============================================================================
// 2. محرك التسعير والتكاليف (مربوط بباقة `costing` + دوال الحاسبة الموجودة نفسها)
// ============================================================================

export interface RealProductEconomics {
  id: string;
  productName: string;
  unitCost: number;
  hasRealCost: boolean;
  sellingPrice: number;
  hasSellingPrice: boolean;
  profitAmount: number;
  marginPercent: number;
}

export function extractRealProductEconomics(product: SavedProductRecord): RealProductEconomics {
  const unitCost = Number(
    product.output?.unifiedBreakdown?.totalUnitCost ??
      product.costPrice ??
      (product.output
        ? (product.output.totalDirectMaterialsCost || 0) +
          (product.output.laborWage || 0) +
          (product.output.packagingCost || 0) +
          (product.output.transitFees || 0) +
          (product.output.adminExpensesShare || 0)
        : 0)
  );
  const sellingPrice = Number(
    product.storePrice ?? product.retailPrice ?? product.output?.finalSellingPrice ?? 0
  );
  const hasRealCost = Number.isFinite(unitCost) && unitCost > 0;
  const hasSellingPrice = Number.isFinite(sellingPrice) && sellingPrice > 0;
  const profitAmount = hasRealCost && hasSellingPrice ? roundMoney(sellingPrice - unitCost) : 0;
  const marginPercent =
    hasRealCost && hasSellingPrice && sellingPrice > 0
      ? roundMoney(((sellingPrice - unitCost) / sellingPrice) * 100)
      : 0;

  return {
    id: product.id,
    productName: product.productName,
    unitCost: hasRealCost ? roundMoney(unitCost) : 0,
    hasRealCost,
    sellingPrice: hasSellingPrice ? roundMoney(sellingPrice) : 0,
    hasSellingPrice,
    profitAmount,
    marginPercent,
  };
}

export interface DraftCostMaterialInput {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface DraftCostCalculationParams {
  accountId?: string | null;
  packageOptions?: AccountPackageQueryOptions;
  firstName: string;
  currency?: string;
  productName: string;
  /** لو المنتج محفوظ في أرشيف الحساب */
  savedProducts?: SavedProductRecord[];
  /** مدخلات يذكرها المستخدم صراحةً (ممنوع التخمين) */
  explicitMaterials?: DraftCostMaterialInput[];
  laborWage?: number;
  packagingCost?: number;
  adminExpensesShare?: number;
  profitMarginPercent?: number;
  rawMaterialsInventory?: RawMaterialItem[];
}

export interface DraftCostCalculationResult extends ShamousaMarketingReplyBlock {
  allowed: boolean;
  source: 'blocked_no_costing' | 'saved_card' | 'calculator_draft' | 'missing_inputs';
  calculatorOutput?: CalculationOutput;
  missingFields?: string[];
}

/**
 * يستدعي دالة الحاسبة الموحدة الموجودة (`buildUnifiedFinancialOutput`) بنفسها بدون تعديل أو إعادة كتابة أي معادلة.
 */
export function runDraftCostCalculationViaExistingEngine(
  params: DraftCostCalculationParams
): DraftCostCalculationResult {
  try {
    const currency = params.currency || 'ج.م';
    const hasCosting = hasFeature('costing', params.accountId || undefined, params.packageOptions);

    if (!hasCosting) {
      return {
        allowed: false,
        source: 'blocked_no_costing',
        reply:
          `عشان أساعدك تسعّر **«${params.productName}»** صح من غير ما أخمّن أي رقم يا ${params.firstName} ☀️\n` +
          `قولي الأول: **أقل سعر تقبل تبيع بيه القطعة دي كام؟** (وهظبطلك عليها صيغة العرض والبيع فوراً).`,
        awaitingFloorPriceFor: { productName: params.productName },
        options: [
          { id: 'dc_no_cost_post', label: 'اكتبيلي بوستات تسويق ✍️', queryText: 'اكتبيلي بوستين للمتجر' },
          { id: 'dc_no_cost_um', label: 'خامات المنتج الموحدة 🧶', queryText: `خامات نموذجية ${params.productName}` },
        ],
      };
    }

    // 1) لو المنتج له بطاقة محفوظة بتكلفة حقيقية -> نقرأها مباشرة من الأرشيف
    const normTarget = normAr(params.productName);
    const matchedSaved = (params.savedProducts || []).find((p) => {
      const np = normAr(p.productName);
      return np && normTarget && (np === normTarget || np.includes(normTarget) || normTarget.includes(np));
    });

    if (matchedSaved && (!params.explicitMaterials || params.explicitMaterials.length === 0)) {
      const eco = extractRealProductEconomics(matchedSaved);
      if (eco.hasRealCost) {
        const alertLine =
          eco.hasSellingPrice && eco.sellingPrice < eco.unitCost
            ? `\n⚠️ **تنبيه مهم:** سعر البيع الحالي (${fmtMoney(eco.sellingPrice, currency)}) أقل من تكلفة الإنتاج (${fmtMoney(eco.unitCost, currency)})!`
            : eco.hasSellingPrice && eco.marginPercent < 20
              ? `\n⚠️ **تنبيه هامش:** الهامش الحالي **${eco.marginPercent}%** (أقل من الحد الآمن 20%).`
              : '';
        return {
          allowed: true,
          source: 'saved_card',
          calculatorOutput: matchedSaved.output,
          reply:
            `📊 **بيانات بطاقة «${eco.productName}» المحفوظة في أرشيفك يا ${params.firstName}:**\n` +
            `• **تكلفة القطعة المحسوبة:** ${fmtMoney(eco.unitCost, currency)}\n` +
            `• **سعر البيع المسجّل:** ${eco.hasSellingPrice ? fmtMoney(eco.sellingPrice, currency) : 'غير مسجّل'}\n` +
            (eco.hasSellingPrice
              ? `• **صافي الربح للقطعة:** ${fmtMoney(eco.profitAmount, currency)} (هامش **${eco.marginPercent}%**)`
              : '') +
            alertLine,
          options: [
            { id: 'dc_saved_price', label: 'حلّلي أسعار كل منتجاتي 📈', queryText: 'تحليل أسعاري ومقارنة منتجاتي' },
            { id: 'dc_saved_cap', label: 'أقدر أصنع كام قطعة؟ 📦', queryText: 'أقدر أصنع كام قطعة بالمخزون الحالي؟' },
            { id: 'dc_saved_bun', label: 'اعملّي عليه عرض تجميع 🎁', queryText: 'اقترحيلي عرض تجميع لمنتج راكد' },
          ],
        };
      }
    }

    // 2) لو منتج جديد: نتحقق إن المستخدم أدخل الخامات + الكميات صراحة (ممنوع التخمين!)
    const missingFields: string[] = [];
    const materials = params.explicitMaterials || [];
    if (materials.length === 0) {
      missingFields.push('أسماء الخامات المستخدمة وكمية كل خامة بدقة (أنا مش بخمّن كميات)');
    } else {
      const missingPriceMats = materials.filter((m) => !(m.unitPrice > 0));
      if (missingPriceMats.length > 0) {
        missingFields.push(
          `سعر الوحدة لـ: ${missingPriceMats.map((m) => m.name).join('، ')}`
        );
      }
      const missingQtyMats = materials.filter((m) => !(m.quantity > 0));
      if (missingQtyMats.length > 0) {
        missingFields.push(
          `الكمية الفعلية لـ: ${missingQtyMats.map((m) => m.name).join('، ')}`
        );
      }
    }

    if (missingFields.length > 0) {
      const umSuggestion = lookupUnifiedMaterialForShamousa(params.productName);
      const suggestedLine =
        umSuggestion.suggestedFromSpecialty && umSuggestion.suggestedFromSpecialty.typicalMaterials.length > 0
          ? `\n🧶 *خامات نموذجية مقترحة لتخصص «${umSuggestion.suggestedFromSpecialty.specialtyNameAr}»:* ` +
            umSuggestion.suggestedFromSpecialty.typicalMaterials
              .slice(0, 4)
              .map((t) => (t.unifiedCode ? `${t.typicalName} [${t.unifiedCode}]` : t.typicalName))
              .join(' • ')
          : '';
      return {
        allowed: true,
        source: 'missing_inputs',
        missingFields,
        reply:
          `عشان أعملك **«مسودة حساب من حاسبة التكاليف»** لمنتج **«${params.productName}»** بدقة ومن غير تخمين يا ${params.firstName}، محتاجة منك المدخلات الناقصة دي:\n` +
          missingFields.map((f, i) => `${i + 1}. ${f}`).join('\n') +
          `\n(واختياري: أجر الإيد والتغليف لو عايز تضيفهم — مثال: *خيط 0.5 كيلو بسعر 180، خشب 1 قطعة بسعر 35، شغل إيد 80، تغليف 15*)` +
          suggestedLine,
        options: [
          { id: 'dc_miss_um', label: 'اعرضي خامات التخصص الموحدة 🧶', queryText: `خامات نموذجية ${params.productName}` },
          { id: 'dc_miss_all', label: 'تحليل أسعار منتجاتي المحفوظة 📊', queryText: 'تحليل أسعاري ومقارنة منتجاتي' },
        ],
      };
    }

    // 3) استدعاء دالة الحاسبة الموجودة نفسها (`buildUnifiedFinancialOutput`) — صفر تعديل على المعادلات!
    const extraRows: ExtraMaterialRow[] = materials.map((m, idx) => ({
      id: `sh_draft_mat_${idx}`,
      name: m.name,
      unit: m.unit || 'وحدة',
      unitPrice: Number(m.unitPrice),
      quantity: Number(m.quantity),
      totalCost: roundMoney(Number(m.unitPrice) * Number(m.quantity)),
    }));
    const extraTotalCost = roundMoney(extraRows.reduce((s, r) => s + r.totalCost, 0));

    const draftInput: CalculationInput = {
      category: 'جدارية',
      productName: params.productName,
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
      extraMaterials: extraRows,
      laborWage: Math.max(0, Number(params.laborWage || 0)),
      packagingCost: Math.max(0, Number(params.packagingCost || 0)),
      transitFees: 0,
      adminExpensesShare: Math.max(0, Number(params.adminExpensesShare || 0)),
      profitMarginPercent: Number(params.profitMarginPercent ?? 25),
      pricingMode: 'margin',
      personalNotes: 'مسودة حساب من شات شموسة عبر الحاسبة الموحدة',
    };

    const calcOut = buildUnifiedFinancialOutput(draftInput, {
      totalDirectMaterialsCost: extraTotalCost,
      extraMaterialsTotalCost: extraTotalCost,
      yarnCost: 0,
      totalWeightGrams: 0,
      totalWeightKg: 0,
    });

    const totalUnitCost = calcOut.unifiedBreakdown?.totalUnitCost ?? extraTotalCost + draftInput.laborWage + draftInput.packagingCost;
    const suggestedPrice = calcOut.finalSellingPrice;
    const marginPct = calcOut.unifiedBreakdown?.marginPercent ?? draftInput.profitMarginPercent;
    const netProfit = roundMoney(suggestedPrice - totalUnitCost);

    const matLines = extraRows
      .map((r) => `  - ${r.name}: ${r.quantity} ${r.unit} × ${fmtMoney(r.unitPrice, currency)} = **${fmtMoney(r.totalCost, currency)}**`)
      .join('\n');

    return {
      allowed: true,
      source: 'calculator_draft',
      calculatorOutput: calcOut,
      reply:
        `🧮 **مسودة حساب من حاسبة التكاليف — «${params.productName}»**\n\n` +
        `• **الخامات المباشرة:** ${fmtMoney(extraTotalCost, currency)}\n${matLines}\n` +
        `• **شغل الإيد:** ${fmtMoney(draftInput.laborWage, currency)} | **التغليف:** ${fmtMoney(draftInput.packagingCost, currency)}\n` +
        `• **إجمالي تكلفة القطعة:** **${fmtMoney(totalUnitCost, currency)}**\n` +
        `• **السعر المقترح (بهامش ${Math.round(marginPct)}%):** **${fmtMoney(suggestedPrice, currency)}**\n` +
        `• **صافي الربح للقطعة:** **${fmtMoney(netProfit, currency)}**\n\n` +
        `💡 *دي مسودة سريعة محسوبة بنفس معادلة الحاسبة الموحدة — عشان تحفظها رسمياً كبطاقة منتج افتح حاسبة التكاليف.*`,
      options: [
        { id: 'dc_out_posts', label: 'اكتبيلي بوستات ورسالة واتساب ✍️', queryText: `اكتبيلي بوستين للمتجر عن ${params.productName}` },
        { id: 'dc_out_analyze', label: 'قارنيها بأسعار منتجاتي 📈', queryText: 'تحليل أسعاري ومقارنة منتجاتي' },
        { id: 'dc_out_cap', label: 'أقدر أصنع كام قطعة؟ 📦', queryText: 'أقدر أصنع كام قطعة بالمخزون الحالي؟' },
      ],
    };
  } catch {
    return {
      allowed: false,
      source: 'missing_inputs',
      reply: 'حصل تعثّر بسيط في حساب المسودة — جرّب تكتب الخامة والكمية والسعر تاني وهحسبهالك فوراً.',
    };
  }
}

/**
 * استخراج الخامات والكميات والأسعار الصريحة من نص المستخدم (بدون أي تخمين)
 * مثال: "خيط 0.5 كيلو بسعر 180، خشب 1 قطعة بسعر 35، شغل إيد 80، تغليف 15"
 */
export function parseExplicitDraftCostFromMessage(
  rawText: string,
  inventoryMaterials: RawMaterialItem[] = []
): {
  productName: string;
  materials: DraftCostMaterialInput[];
  laborWage: number;
  packagingCost: number;
  profitMarginPercent?: number;
} {
  const normalizedDigits = String(rawText || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const materials: DraftCostMaterialInput[] = [];
  let laborWage = 0;
  let packagingCost = 0;
  let profitMarginPercent: number | undefined;

  const laborMatch = normalizedDigits.match(/(?:شغل\s*ايد|شغل\s*إيد|اجر|أجر|عمالة|مصنعية)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  if (laborMatch) laborWage = Number(laborMatch[1]);

  const packMatch = normalizedDigits.match(/(?:تغليف|علبه|علبة|بوكس)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  if (packMatch) packagingCost = Number(packMatch[1]);

  const marginMatch = normalizedDigits.match(/(?:هامش|ربح)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (marginMatch) profitMarginPercent = Number(marginMatch[1]);

  // نمط: "<اسم خامة> <كمية> <وحدة؟> بسعر <سعر>"
  const segments = normalizedDigits.split(/[،,\n+]+/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    if (/(شغل\s*[اإ]يد|[اأ]جر|مصنعية|تغليف|هامش)/.test(seg)) continue;
    const m = seg.match(
      /^(.+?)\s+(\d+(?:\.\d+)?)\s*(كيلو|جرام|جم|متر|سم|لتر|مل|قطعه|قطعة|حبه|حبة|شله|شلة|بكره|بكرة|وحده|وحدة)?\s*(?:بسعر|سعر|بـ|ب)\s*(\d+(?:\.\d+)?)/i
    );
    if (m) {
      const rawName = m[1].replace(/^(احسب|احسبيلي|تكلفه|تكلفة|بيتكلف كام|منتج|لـ)\s+/gi, '').trim();
      const qty = Number(m[2]);
      const unit = m[3] || 'وحدة';
      const unitPrice = Number(m[4]);
      if (rawName && qty > 0 && unitPrice > 0) {
        // لو الخامة موجودة في المنظومة الموحدة نعرض اسمها الموحد
        const um = searchUnifiedMaterials(rawName, SEEDED_UNIFIED_MASTERS, SEEDED_UNIFIED_SPECS, SEEDED_UNIFIED_ALIASES);
        const canonical = um.matches[0]?.master.canonicalName || rawName;
        materials.push({ name: canonical, quantity: qty, unit, unitPrice });
      }
      continue;
    }

    // لو ذكر الكمية بس بدون سعر، نحاول نجيب سعر الشراء الفعلي من مخزون الحساب فقط (بدون تخمين!)
    const mQtyOnly = seg.match(
      /^(.+?)\s+(\d+(?:\.\d+)?)\s*(كيلو|جرام|جم|متر|لتر|قطعه|قطعة|حبه|حبة|شله|شلة)$/i
    );
    if (mQtyOnly && inventoryMaterials.length > 0) {
      const rawName = mQtyOnly[1].replace(/^(احسب|احسبيلي|تكلفه|تكلفة|منتج)\s+/gi, '').trim();
      const qty = Number(mQtyOnly[2]);
      const unit = mQtyOnly[3];
      const invMatch = inventoryMaterials.find((im) => normAr(im.materialName).includes(normAr(rawName)));
      if (invMatch && invMatch.costPerUnit > 0) {
        materials.push({
          name: invMatch.materialName,
          quantity: qty,
          unit: unit || invMatch.unit,
          unitPrice: invMatch.costPerUnit,
        });
      }
    }
  }

  const understood = understandProductSentence(normalizedDigits);
  const productName =
    understood.productType ||
    understood.specialty?.nameAr ||
    segments[0]?.replace(/\d+.*/g, '').replace(/(بيتكلف كام|احسبيلي تكلفه|احسبيلي تكلفة|تكلفه|تكلفة)/gi, '').trim() ||
    'المنتج الجديد';

  return { productName, materials, laborWage, packagingCost, profitMarginPercent };
}

/**
 * تحليل أسعار منتجات الحساب مقارنة ببعضها فقط (لا يقارن بالسوق الخارجي أبداً)
 */
export function analyzeAccountProductPricing(params: {
  accountId?: string | null;
  packageOptions?: AccountPackageQueryOptions;
  firstName: string;
  products: SavedProductRecord[];
  minMarginPercent?: number;
  currency?: string;
}): ShamousaMarketingReplyBlock & {
  allowed: boolean;
  lossProducts: RealProductEconomics[];
  lowMarginProducts: RealProductEconomics[];
  avgPrice: number;
} {
  try {
    const currency = params.currency || 'ج.م';
    const minMargin = params.minMarginPercent ?? 20;
    const hasCosting = hasFeature('costing', params.accountId || undefined, params.packageOptions);

    if (!hasCosting) {
      return {
        allowed: false,
        lossProducts: [],
        lowMarginProducts: [],
        avgPrice: 0,
        reply:
          `تحليل التكلفة والهامش بيشتغل لما باقة **حاسبة التكاليف** تكون مفعّلة يا ${params.firstName}.\n` +
          `لكن أقدر أساعدك في صياغة عروضك وبوستاتك من دلوقتي — قولي أقل سعر تقبل تبيع بيه أي منتج وهظبطلك عرضه فوراً!`,
        options: [
          { id: 'pa_no_cost_1', label: 'بوستين جاهزين للمتجر ✍️', queryText: 'اكتبيلي بوستين للمتجر' },
          { id: 'pa_no_cost_2', label: 'تقويم المواسم الجاية 🗓️', queryText: 'إيه المواسم الجاية؟' },
        ],
      };
    }

    const economics = (params.products || []).map(extractRealProductEconomics).filter((e) => e.hasSellingPrice);
    if (economics.length === 0) {
      return {
        allowed: true,
        lossProducts: [],
        lowMarginProducts: [],
        avgPrice: 0,
        reply: `لسه مفيش منتجات مسعّرة في حسابك يا ${params.firstName} عشان أعملك مقارنة داخلية بين أسعارك.`,
      };
    }

    const avgPrice = roundMoney(economics.reduce((s, e) => s + e.sellingPrice, 0) / economics.length);
    const highest = [...economics].sort((a, b) => b.sellingPrice - a.sellingPrice)[0];
    const lowest = [...economics].sort((a, b) => a.sellingPrice - b.sellingPrice)[0];
    const lossProducts = economics.filter((e) => e.hasRealCost && e.sellingPrice < e.unitCost);
    const lowMarginProducts = economics.filter(
      (e) => e.hasRealCost && e.sellingPrice >= e.unitCost && e.marginPercent < minMargin
    );

    const lines: string[] = [
      `📈 **تحليل أسعار منتجاتك (مقارنة داخلية بحسابك فقط) يا ${params.firstName}:**`,
      `• **عدد المنتجات المسعّرة:** ${economics.length} | **متوسط السعر في متجرك:** ${fmtMoney(avgPrice, currency)}`,
      `• **أعلى سعر عندك:** ${highest.productName} (${fmtMoney(highest.sellingPrice, currency)}) | **أقل سعر:** ${lowest.productName} (${fmtMoney(lowest.sellingPrice, currency)})`,
    ];

    if (lossProducts.length > 0) {
      lines.push(`\n🚨 **تنبيه فوري — منتجات سعرها أقل من تكلفة الإنتاج:**`);
      for (const p of lossProducts.slice(0, 4)) {
        lines.push(
          `• **${p.productName}:** السعر ${fmtMoney(p.sellingPrice, currency)} بينما التكلفة ${fmtMoney(p.unitCost, currency)} (خسارة ${fmtMoney(Math.abs(p.profitAmount), currency)} للقطعة!)`
        );
      }
    }

    if (lowMarginProducts.length > 0) {
      lines.push(`\n⚠️ **منتجات هامشها أقل من الحد الأدنى (${minMargin}%):**`);
      for (const p of lowMarginProducts.slice(0, 4)) {
        const safePrice = roundMoney(p.unitCost / (1 - minMargin / 100));
        lines.push(
          `• **${p.productName}:** هامش حالي **${p.marginPercent}%** (السعر الآمن لهامش ${minMargin}%: **${fmtMoney(safePrice, currency)}**)`
        );
      }
    }

    if (lossProducts.length === 0 && lowMarginProducts.length === 0) {
      lines.push(`\n✅ **ممتاز!** كل منتجاتك اللي ليها بطاقة تكلفة سعرها فوق التكلفة وبهامش آمن (≥ ${minMargin}%).`);
    }

    return {
      allowed: true,
      lossProducts,
      lowMarginProducts,
      avgPrice,
      reply: lines.join('\n'),
      options: [
        { id: 'pa_opt_bun', label: 'اقترحيلي عرض تجميع 🎁', queryText: 'اقترحيلي عرض تجميع لمنتج راكد' },
        { id: 'pa_opt_cap', label: 'أولويات الإنتاج والمخزون 📦', queryText: 'أقدر أصنع كام قطعة بالمخزون الحالي؟' },
        { id: 'pa_opt_top3', label: 'أهم 3 توصيات تسويقية ☀️', queryText: 'إيه أهم 3 توصيات تسويقية ليا النهاردة؟' },
      ],
    };
  } catch {
    return {
      allowed: false,
      lossProducts: [],
      lowMarginProducts: [],
      avgPrice: 0,
      reply: 'تعذّر تحليل الأسعار لحظياً — جرّب تاني بعد ثواني.',
    };
  }
}

// ============================================================================
// 3. محرك الإنتاج والمخزون (مربوط بباقة `inventory` / `costing`)
// ============================================================================

export interface ProductCapacityItem {
  productId: string;
  productName: string;
  maxUnits: number;
  bottleneckMaterialName: string;
  bottleneckCurrentStock: number;
  bottleneckRequiredPerUnit: number;
  bottleneckUnit: string;
  ordersCount: number;
  marginPercent?: number;
  priorityScore: number;
}

function findMatchingStockMaterial(
  recipeName: string,
  rawMaterials: RawMaterialItem[]
): RawMaterialItem | undefined {
  const nRecipe = normAr(recipeName);
  if (!nRecipe) return undefined;

  // 1) تطابق مباشر بالاسم
  const direct = rawMaterials.find((m) => {
    const nm = normAr(m.materialName);
    return nm === nRecipe || nm.includes(nRecipe) || nRecipe.includes(nm);
  });
  if (direct) return direct;

  // 2) تطابق عبر منظومة الخامات الموحدة (الاسم الدارج <-> الرسمي)
  const recipeUnified = searchUnifiedMaterials(
    recipeName,
    SEEDED_UNIFIED_MASTERS,
    SEEDED_UNIFIED_SPECS,
    SEEDED_UNIFIED_ALIASES
  ).matches[0];
  if (!recipeUnified) return undefined;

  const targetCode = recipeUnified.master.code;
  return rawMaterials.find((m) => {
    const mUnified = searchUnifiedMaterials(
      m.materialName,
      SEEDED_UNIFIED_MASTERS,
      SEEDED_UNIFIED_SPECS,
      SEEDED_UNIFIED_ALIASES
    ).matches[0];
    return mUnified?.master.code === targetCode;
  });
}

function countOrdersByProduct(orders: InvoiceRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ord of orders || []) {
    if (ord.status === 'cancelled' || ord.marketplaceStatus === 'cancelled') continue;
    if (Array.isArray(ord.items) && ord.items.length > 0) {
      for (const item of ord.items) {
        const key = normAr(item.productName || '');
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + Math.max(1, Number(item.quantity || 1)));
      }
    } else if (ord.productName) {
      const key = normAr(ord.productName);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

export function computeProductionCapacityFromStock(params: {
  accountId?: string | null;
  packageOptions?: AccountPackageQueryOptions;
  firstName: string;
  products: SavedProductRecord[];
  rawMaterials: RawMaterialItem[];
  orders?: InvoiceRecord[];
}): ShamousaMarketingReplyBlock & {
  allowed: boolean;
  items: ProductCapacityItem[];
} {
  try {
    const hasInv = hasFeature('inventory', params.accountId || undefined, params.packageOptions);
    const hasCost = hasFeature('costing', params.accountId || undefined, params.packageOptions);

    if (!hasInv) {
      return {
        allowed: false,
        items: [],
        reply:
          `حساب طاقة الإنتاج من رصيد الخامات متاح لما باقة **المخزون** تكون مفعّلة يا ${params.firstName}.\n` +
          `أقدر أساعدك دلوقتي في أفكار منتجات جديدة أو خطة المواسم أو بوستات المتجر!`,
        options: [
          { id: 'cap_no_inv_1', label: 'تقويم المواسم الجاية 🗓️', queryText: 'إيه المواسم الجاية؟' },
          { id: 'cap_no_inv_2', label: 'اكتبيلي بوستين للمتجر ✍️', queryText: 'اكتبيلي بوستين للمتجر' },
        ],
      };
    }

    const activeMats = (params.rawMaterials || []).filter((m) => m.isActive !== false);
    const orderCounts = countOrdersByProduct(params.orders || []);
    const capacities: ProductCapacityItem[] = [];

    for (const prod of params.products || []) {
      const recipeRequirements: Array<{ name: string; qty: number; unit: string }> = [];

      // 1) خامات إضافية مسجلة في وصفة المنتج
      if (Array.isArray(prod.input?.extraMaterials)) {
        for (const em of prod.input.extraMaterials) {
          if (em.name && Number(em.quantity) > 0) {
            recipeRequirements.push({
              name: em.name,
              qty: Number(em.quantity),
              unit: em.unit || 'وحدة',
            });
          }
        }
      }

      // 2) الخيط/الخامة الرئيسية إن كان لها وزن محسوب
      const yarnKg = Number(prod.output?.totalWeightKg || 0);
      if (yarnKg > 0 && prod.input?.cordTypeId) {
        recipeRequirements.push({
          name: prod.input.cordTypeId,
          qty: yarnKg,
          unit: 'كيلو',
        });
      }

      if (recipeRequirements.length === 0) continue;

      let maxUnits = Infinity;
      let bottleneck: { name: string; stock: number; req: number; unit: string } | null = null;
      let matchedAny = false;

      for (const req of recipeRequirements) {
        const stockMat = findMatchingStockMaterial(req.name, activeMats);
        if (!stockMat) {
          maxUnits = 0;
          bottleneck = { name: req.name, stock: 0, req: req.qty, unit: req.unit };
          matchedAny = true;
          break;
        }
        matchedAny = true;
        const possible = Math.floor(Math.max(0, Number(stockMat.currentStock || 0)) / req.qty);
        if (possible < maxUnits) {
          maxUnits = possible;
          bottleneck = {
            name: stockMat.materialName,
            stock: Number(stockMat.currentStock || 0),
            req: req.qty,
            unit: stockMat.unit || req.unit,
          };
        }
      }

      if (!matchedAny || !bottleneck || !Number.isFinite(maxUnits)) continue;

      const ordersCount = orderCounts.get(normAr(prod.productName)) || 0;
      const eco = hasCost ? extractRealProductEconomics(prod) : null;
      const marginPct = eco?.hasRealCost && eco.hasSellingPrice ? eco.marginPercent : undefined;

      // ترتيب الأولوية: سرعة البيع + الهامش (إن وجدت باقة التكاليف) + توفر الخامات
      const velocityScore = Math.min(40, ordersCount * 10);
      const marginScore = marginPct !== undefined ? Math.min(35, Math.max(0, marginPct)) : 15;
      const availScore = maxUnits > 0 ? Math.min(25, maxUnits * 3) : 0;

      capacities.push({
        productId: prod.id,
        productName: prod.productName,
        maxUnits,
        bottleneckMaterialName: bottleneck.name,
        bottleneckCurrentStock: bottleneck.stock,
        bottleneckRequiredPerUnit: bottleneck.req,
        bottleneckUnit: bottleneck.unit,
        ordersCount,
        marginPercent: marginPct,
        priorityScore: roundMoney(velocityScore + marginScore + availScore),
      });
    }

    capacities.sort((a, b) => b.priorityScore - a.priorityScore || b.maxUnits - a.maxUnits);

    if (capacities.length === 0) {
      return {
        allowed: true,
        items: [],
        reply:
          `عندك **${activeMats.length}** خامة في المخزون يا ${params.firstName}، لكن مفيش منتجات مربوطة بوصفة خامات في بطاقاتها لسه.\n` +
          `أول ما تحفظ منتج بخاماته في الأرشيف هحسبلك فوراً تقدر تصنّع منه كام قطعة وأول خامة هتخلص!`,
        options: [
          { id: 'cap_emp_radar', label: 'أفكار منتجات من خاماتي 💡', queryText: 'اقترحيلي أفكار منتجات جديدة من خاماتي' },
          { id: 'cap_emp_um', label: 'بحث في الخامات الموحدة 🧶', queryText: 'خامة قطن مجدول' },
        ],
      };
    }

    const lines: string[] = [
      `📦 **طاقة الإنتاج الحالية وأولويات التشغيل (من مخزونك الفعلي) يا ${params.firstName}:**`,
    ];

    capacities.slice(0, 5).forEach((item, idx) => {
      const marginTag =
        hasCost && item.marginPercent !== undefined ? ` • هامش ${item.marginPercent}%` : '';
      const salesTag = item.ordersCount > 0 ? ` • مبيعات: ${item.ordersCount}` : ' • بدون مبيعات مسجلة';
      lines.push(
        `${idx + 1}. **${item.productName}:** تقدر تصنّع **${item.maxUnits} قطعة**${salesTag}${marginTag}\n` +
          `   ↳ أول خامة هتخلص: **${item.bottleneckMaterialName}** (الرصيد: ${item.bottleneckCurrentStock} ${item.bottleneckUnit}، القطعة بتحتاج ${item.bottleneckRequiredPerUnit})`
      );
    });

    return {
      allowed: true,
      items: capacities,
      reply: lines.join('\n'),
      options: [
        { id: 'cap_opt_radar', label: 'أفكار منتجات جديدة من خاماتي 💡', queryText: 'اقترحيلي أفكار منتجات جديدة من خاماتي' },
        { id: 'cap_opt_bun', label: 'عرض تجميع لمنتج راكد 🎁', queryText: 'اقترحيلي عرض تجميع لمنتج راكد' },
        { id: 'cap_opt_seas', label: 'تجهيز الموسم الجاي 🗓️', queryText: 'إيه المواسم الجاية؟' },
      ],
    };
  } catch {
    return {
      allowed: false,
      items: [],
      reply: 'حصل تعثّر بسيط أثناء قراءة المخزون — جرّب تاني بعد لحظة.',
    };
  }
}

// ============================================================================
// 4. تقويم المواسم المصري (10 مواسم + حساب هجري محلي + تعديل خاص لكل حساب + تنبيه 3 أسابيع)
// ============================================================================

export type EgyptianSeasonId =
  | 'ramadan'
  | 'eid_fitr'
  | 'eid_adha'
  | 'mothers_day'
  | 'valentine'
  | 'sham_nessim'
  | 'back_to_school'
  | 'weddings_summer'
  | 'white_friday'
  | 'new_year_winter';

export interface EgyptianSeasonItem {
  id: EgyptianSeasonId;
  nameAr: string;
  isHijri: boolean;
  dateIso: string; // YYYY-MM-DD
  daysUntil: number;
  isWithinAlertWindow: boolean; // <= 21 يوماً (3 أسابيع)
  isOverriddenByUser: boolean;
  isApproximateNoteAr?: string;
  whatToMakeAr: string;
  whatToShowAr: string;
}

const SEASON_OVERRIDES_MEMORY = new Map<string, Record<string, string>>();

function seasonOverrideStorageKey(accountId: string): string {
  return `alshams_shamousa_season_overrides_${accountId || 'guest'}`;
}

export function loadAccountSeasonDateOverrides(accountId?: string | null): Record<string, string> {
  const key = accountId || 'guest';
  if (SEASON_OVERRIDES_MEMORY.has(key)) {
    return { ...(SEASON_OVERRIDES_MEMORY.get(key) || {}) };
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(seasonOverrideStorageKey(key));
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        SEASON_OVERRIDES_MEMORY.set(key, parsed);
        return { ...parsed };
      }
    } catch {
      // ignore
    }
  }
  return {};
}

export function saveAccountSeasonDateOverride(
  accountId: string | null | undefined,
  seasonId: EgyptianSeasonId,
  isoDate: string
): Record<string, string> {
  const key = accountId || 'guest';
  const current = loadAccountSeasonDateOverrides(key);
  const next = { ...current, [seasonId]: isoDate };
  SEASON_OVERRIDES_MEMORY.set(key, next);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(seasonOverrideStorageKey(key), JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearAccountSeasonOverridesForTest(accountId: string): void {
  SEASON_OVERRIDES_MEMORY.delete(accountId || 'guest');
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(seasonOverrideStorageKey(accountId || 'guest'));
    } catch {
      // ignore
    }
  }
}

function formatDateIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getHijriMonthDayLocal(d: Date): { month: number; day: number } | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
    const parts = fmt.formatToParts(d);
    const month = Number(parts.find((p) => p.type === 'month')?.value || 0);
    const day = Number(parts.find((p) => p.type === 'day')?.value || 0);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 30) {
      return { month, day };
    }
    return null;
  } catch {
    return null;
  }
}

function findNextHijriDate(fromDate: Date, targetHijriMonth: number, targetHijriDay: number): Date {
  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  for (let offset = 0; offset <= 370; offset++) {
    const candidate = new Date(start.getTime() + offset * 86400000);
    const hm = getHijriMonthDayLocal(candidate);
    if (hm && hm.month === targetHijriMonth && hm.day === targetHijriDay) {
      return candidate;
    }
  }
  // احتياطي رقمي لو البيئة لا تدعم تقويم islamic في Intl
  const fallback = new Date(start.getTime() + 60 * 86400000);
  return fallback;
}

function findNextGregorianDate(fromDate: Date, month1Based: number, day: number): Date {
  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  let cand = new Date(fromDate.getFullYear(), month1Based - 1, day);
  if (cand.getTime() < start.getTime()) {
    cand = new Date(fromDate.getFullYear() + 1, month1Based - 1, day);
  }
  return cand;
}

const EGYPTIAN_SEASONS_DEF: Array<{
  id: EgyptianSeasonId;
  nameAr: string;
  isHijri: boolean;
  month: number;
  day: number;
  whatToMakeAr: string;
  whatToShowAr: string;
}> = [
  {
    id: 'ramadan',
    nameAr: 'رمضان',
    isHijri: true,
    month: 9,
    day: 1,
    whatToMakeAr: 'فوانيس وهلال ونجمة، صواني ضيافة وتمر، رانرات ومفارش سفرة، مباخر وشموع دافية',
    whatToShowAr: 'باقات ضيافة جاهزة للإهداء + تصوير بأجواء دافية قبل الموسم بـ 3 أسابيع',
  },
  {
    id: 'eid_fitr',
    nameAr: 'عيد الفطر',
    isHijri: true,
    month: 10,
    day: 1,
    whatToMakeAr: 'علب عيدية وشوكولاتة، هدايا أطفال، إكسسوارات وشنط خروج، صواني ضيافة العيد',
    whatToShowAr: 'بوست «جاهز للتسليم الفوري قبل زحمة العيد» + خيارات تغليف هدايا',
  },
  {
    id: 'eid_adha',
    nameAr: 'عيد الأضحى',
    isHijri: true,
    month: 12,
    day: 10,
    whatToMakeAr: 'مفارش سفرة، صواني وكوسترات ضيافة، هدايا الزيارات العائلية، توزيعات بسيطة',
    whatToShowAr: 'أطقم ضيافة كاملة بسعر أوفر من القطعة المنفردة',
  },
  {
    id: 'mothers_day',
    nameAr: 'عيد الأم (21 مارس)',
    isHijri: false,
    month: 3,
    day: 21,
    whatToMakeAr: 'علب هدايا متكاملة (شال/مج/شمعة/شنطة/برواز بالاسم/صابون لطيف)',
    whatToShowAr: 'باقة جاهزة بالتغليف وكارت الإهداء + فتح الحجز المبكر بالاسم',
  },
  {
    id: 'valentine',
    nameAr: 'فالنتاين',
    isHijri: false,
    month: 2,
    day: 14,
    whatToMakeAr: 'هدايا بالاسم والحروف، شموع برائحة هادية، إكسسوارات، محافظ جلد وميداليات ثنائية',
    whatToShowAr: 'باقات ثنائية (لها + له) مع تغليف أنيق جاهز للإهداء',
  },
  {
    id: 'sham_nessim',
    nameAr: 'شم النسيم',
    isHijri: false,
    month: 4,
    day: 20,
    whatToMakeAr: 'ديكورات بألوان ربيعية مبهجة، مفارش وأطقم خروجات وحدائق، حوامل نباتات',
    whatToShowAr: 'صور في ضوء الشمس والألوان الزاهية + باقات ديكور الربيع',
  },
  {
    id: 'back_to_school',
    nameAr: 'العودة للمدارس',
    isHijri: false,
    month: 9,
    day: 15,
    whatToMakeAr: 'مقالم ومنظمات مكتب، شنط عملية، ميداليات بالاسم للشنط، فواصل كتب',
    whatToShowAr: 'أطقم مكتب أو شنطة + مقلمة بتفصيل الاسم للطلبة',
  },
  {
    id: 'weddings_summer',
    nameAr: 'الأفراح والصيف',
    isHijri: false,
    month: 7,
    day: 1,
    whatToMakeAr: 'شنط بحر وكروس صيفي، توزيعات أفراح وكتب كتاب، صواني خطوبة، كوسترات وتابلوهات بالاسم',
    whatToShowAr: 'عرض باقات التوزيعات بالكمية + حجز مسبق للعرايس',
  },
  {
    id: 'white_friday',
    nameAr: 'الجمعة البيضاء',
    isHijri: false,
    month: 11,
    day: 27,
    whatToMakeAr: 'باقات تجميع (أكثر منتج مبيعاً + منتج راكد) لتنشيط المخزون الجاهز',
    whatToShowAr: 'عرض واضح ومحدّد المدة بدون خسارة في الهامش + عرض القطع الجاهزة للشحن الفوري',
  },
  {
    id: 'new_year_winter',
    nameAr: 'رأس السنة والشتاء',
    isHijri: false,
    month: 12,
    day: 25,
    whatToMakeAr: 'شالات وكوفيات وجوانتيات شتوي، شموع دافية، بوكسات هدايا شتوية، أبلانكتس ومفارش دافية',
    whatToShowAr: 'بوكسات الدفا والهدايا الجاهزة للكريسماس وبداية السنة الجديدة',
  },
];

export function getEgyptianSeasonsCalendar(params?: {
  now?: Date;
  accountId?: string | null;
  customOverrides?: Record<string, string>;
}): EgyptianSeasonItem[] {
  try {
    const now = params?.now ? new Date(params.now.getTime()) : new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const storedOverrides = params?.customOverrides ?? loadAccountSeasonDateOverrides(params?.accountId);

    const items: EgyptianSeasonItem[] = EGYPTIAN_SEASONS_DEF.map((def) => {
      const overrideIso = storedOverrides[def.id];
      let targetDate: Date;
      let isOverridden = false;

      if (overrideIso && /^\d{4}-\d{2}-\d{2}$/.test(overrideIso)) {
        const [yy, mm, dd] = overrideIso.split('-').map(Number);
        targetDate = new Date(yy, mm - 1, dd);
        isOverridden = true;
      } else if (def.isHijri) {
        targetDate = findNextHijriDate(todayStart, def.month, def.day);
      } else {
        targetDate = findNextGregorianDate(todayStart, def.month, def.day);
      }

      const daysUntil = Math.round((targetDate.getTime() - todayStart.getTime()) / 86400000);

      return {
        id: def.id,
        nameAr: def.nameAr,
        isHijri: def.isHijri,
        dateIso: formatDateIsoLocal(targetDate),
        daysUntil,
        isWithinAlertWindow: daysUntil >= 0 && daysUntil <= 21,
        isOverriddenByUser: isOverridden,
        isApproximateNoteAr:
          def.isHijri && !isOverridden
            ? 'تاريخ هجري تقريبي — تقدر تعدّله في أي وقت'
            : def.id === 'sham_nessim' && !isOverridden
              ? 'تاريخ تقريبي — تقدر تعدّله حسب السنة'
              : undefined,
        whatToMakeAr: def.whatToMakeAr,
        whatToShowAr: def.whatToShowAr,
      };
    });

    return items.sort((a, b) => a.daysUntil - b.daysUntil);
  } catch {
    return [];
  }
}

export function formatEgyptianSeasonsReply(params: {
  firstName: string;
  accountId?: string | null;
  now?: Date;
  specialtyNameAr?: string;
}): ShamousaMarketingReplyBlock {
  const calendar = getEgyptianSeasonsCalendar({ now: params.now, accountId: params.accountId });
  const alertSeasons = calendar.filter((s) => s.isWithinAlertWindow);
  const upcoming = calendar.filter((s) => s.daysUntil >= 0).slice(0, 5);

  const lines: string[] = [`🗓️ **تقويم المواسم المصري (الـ 10 مواسم) يا ${params.firstName}:**`];

  if (alertSeasons.length > 0) {
    lines.push(`\n🔔 **تنبيه موسم قريب (خلال 3 أسابيع) — وقت التجهيز الآن:**`);
    for (const s of alertSeasons) {
      lines.push(
        `• **${s.nameAr}** (بعد **${s.daysUntil} يوم** — ${s.dateIso})${s.isApproximateNoteAr ? ` *(${s.isApproximateNoteAr})*` : ''}\n` +
          `  - **إيه تصنّع:** ${s.whatToMakeAr}\n` +
          `  - **إيه تعرض:** ${s.whatToShowAr}`
      );
    }
  } else {
    lines.push(`\n✅ مفيش موسم داخل خلال 21 يوم بالظبط، لكن دي أقرب المواسم الجاية عشان تستعد بدري:`);
  }

  lines.push(`\n📅 **أقرب 5 مواسم جاية:**`);
  for (const s of upcoming) {
    const note = s.isOverriddenByUser
      ? ' (معدّل بواسطتك)'
      : s.isHijri
        ? ' (هجري تقريبي)'
        : '';
    lines.push(`• **${s.nameAr}:** ${s.dateIso} — بعد ${s.daysUntil} يوم${note}`);
  }

  lines.push(
    `\n💡 لتعديل تاريخ أي موسم (خصوصاً المواسم الهجرية أو شم النسيم)، اكتبلي مثلاً: *«عدّل تاريخ رمضان 2027-02-08»*.`
  );

  return {
    reply: lines.join('\n'),
    options: [
      { id: 'seas_opt_1', label: 'أفكار منتجات للموسم الجاي 💡', queryText: 'اقترحيلي أفكار منتجات جديدة من خاماتي' },
      { id: 'seas_opt_2', label: 'جهّزي بوستين للمتجر ✍️', queryText: 'اكتبيلي بوستين للمتجر' },
      { id: 'seas_opt_3', label: 'عرض تجميع للراكد 🎁', queryText: 'اقترحيلي عرض تجميع لمنتج راكد' },
    ],
  };
}

export function tryParseSeasonDateOverrideCommand(rawText: string): {
  seasonId: EgyptianSeasonId;
  seasonNameAr: string;
  isoDate: string;
} | null {
  const digits = String(rawText || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const norm = normAr(digits);
  if (!/(عدل|غير|ظبط|حدث)\s+تاريخ/.test(norm)) return null;

  const dateMatch = digits.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!dateMatch) return null;
  const isoDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;

  const seasonKeywords: Array<{ id: EgyptianSeasonId; nameAr: string; re: RegExp }> = [
    { id: 'ramadan', nameAr: 'رمضان', re: /رمضان/ },
    { id: 'eid_fitr', nameAr: 'عيد الفطر', re: /(عيد الفطر|الفطر)/ },
    { id: 'eid_adha', nameAr: 'عيد الأضحى', re: /(عيد الاضحي|الاضحي)/ },
    { id: 'mothers_day', nameAr: 'عيد الأم', re: /(عيد الام|الام)/ },
    { id: 'valentine', nameAr: 'فالنتاين', re: /(فالنتاين|عيد الحب)/ },
    { id: 'sham_nessim', nameAr: 'شم النسيم', re: /شم النسيم/ },
    { id: 'back_to_school', nameAr: 'العودة للمدارس', re: /(المدارس|الدراسه)/ },
    { id: 'weddings_summer', nameAr: 'الأفراح والصيف', re: /(الافراح|الصيف)/ },
    { id: 'white_friday', nameAr: 'الجمعة البيضاء', re: /(الجمعه البيضاء|بلاك فرايداي)/ },
    { id: 'new_year_winter', nameAr: 'رأس السنة والشتاء', re: /(راس السنه|الشتاء)/ },
  ];

  for (const s of seasonKeywords) {
    if (s.re.test(norm)) {
      return { seasonId: s.id, seasonNameAr: s.nameAr, isoDate };
    }
  }
  return null;
}

// ============================================================================
// 5. ميزات الورش (الفنانين): معادلة التجميع + رادار الأفكار + بوستين + 3 أساليب واتساب
// ============================================================================

export interface HeroSlowBundleResult extends ShamousaMarketingReplyBlock {
  heroProduct?: RealProductEconomics;
  slowProduct?: RealProductEconomics;
  regularTotal?: number;
  bundlePrice?: number;
  profitBefore?: number;
  profitAfter?: number;
  usedCosting: boolean;
}

export function buildHeroSlowBundleOffer(params: {
  accountId?: string | null;
  packageOptions?: AccountPackageQueryOptions;
  firstName: string;
  brandName?: string;
  products: SavedProductRecord[];
  orders: InvoiceRecord[];
  minMarginPercent?: number;
  currency?: string;
}): HeroSlowBundleResult {
  try {
    const currency = params.currency || 'ج.م';
    const minMargin = params.minMarginPercent ?? 20;
    const hasCosting = hasFeature('costing', params.accountId || undefined, params.packageOptions);
    const products = params.products || [];

    if (products.length < 2) {
      return {
        usedCosting: false,
        reply: `عشان أعملك **معادلة التجميع** (منتج بطل + منتج راكد) محتاجين على الأقل منتجين في حسابك يا ${params.firstName}.`,
      };
    }

    const orderCounts = countOrdersByProduct(params.orders || []);
    const ranked = products.map((p) => ({
      eco: extractRealProductEconomics(p),
      orders: orderCounts.get(normAr(p.productName)) || 0,
    }));

    // البطل: الأعلى طلباً فعلياً (ثم الأعلى سعراً كفاصل فقط لو لم توجد طلبات)
    const sortedByOrders = [...ranked].sort((a, b) => b.orders - a.orders || b.eco.sellingPrice - a.eco.sellingPrice);
    const heroEntry = sortedByOrders[0];
    // الراكد: الأقل طلباً (مختلف عن البطل)
    const slowEntry = [...ranked]
      .filter((r) => r.eco.id !== heroEntry.eco.id)
      .sort((a, b) => a.orders - b.orders || a.eco.sellingPrice - b.eco.sellingPrice)[0];

    if (!heroEntry || !slowEntry) {
      return { usedCosting: false, reply: 'محتاجين منتجين مختلفين لتكوين باقة تجميع.' };
    }

    const hero = heroEntry.eco;
    const slow = slowEntry.eco;
    const regularTotal = roundMoney(hero.sellingPrice + slow.sellingPrice);
    const brandLabel = params.brandName?.trim() || 'متجرنا';

    // لو باقة التكاليف غير مفعلة أو التكلفة غير محسوبة -> نسأل أقل سعر يقبل بيه (قاعدة 7)
    if (!hasCosting || !hero.hasRealCost || !slow.hasRealCost || !(regularTotal > 0)) {
      const reply =
        `🎁 **فكرة باقة التجميع (بطل + راكد) لمتجر «${brandLabel}» يا ${params.firstName}:**\n` +
        `• **المنتج البطل (الأكثر طلباً):** ${hero.productName}${heroEntry.orders > 0 ? ` (${heroEntry.orders} طلب)` : ''}\n` +
        `• **المنتج الراكد (نحرّكه مع البطل):** ${slow.productName} (${slowEntry.orders} طلب)\n` +
        (regularTotal > 0 ? `• **مجموع سعرهم العادي:** ${fmtMoney(regularTotal, currency)}\n` : '') +
        `\nعشان أحددلك سعر الباقة من غير ما تخسر، قولي: **أقل سعر تقبل تبيع بيه الباقة دي كام؟**`;
      return {
        usedCosting: false,
        heroProduct: hero,
        slowProduct: slow,
        regularTotal: regularTotal > 0 ? regularTotal : undefined,
        awaitingFloorPriceFor: {
          productName: `باقة (${hero.productName} + ${slow.productName})`,
          listedPrice: regularTotal > 0 ? regularTotal : undefined,
        },
        reply,
        options: [
          { id: 'bun_no_cost_posts', label: 'اكتبيلي بوستين للمتجر ✍️', queryText: 'اكتبيلي بوستين للمتجر' },
        ],
      };
    }

    const combinedCost = roundMoney(hero.unitCost + slow.unitCost);
    const minSafeBundlePrice = roundMoney(combinedCost / (1 - minMargin / 100));
    const profitBefore = roundMoney(regularTotal - combinedCost);

    // نعرض خصم تجميع جذاب (حوالي 10% من المجموع) بشرط ألا يقل أبداً عن السعر الآمن للحفاظ على الحد الأدنى للهامش
    const targetTenPctOff = roundMoney(regularTotal * 0.9);
    const bundlePrice = Math.max(minSafeBundlePrice, Math.min(regularTotal, targetTenPctOff));
    const savings = roundMoney(Math.max(0, regularTotal - bundlePrice));
    const profitAfter = roundMoney(bundlePrice - combinedCost);
    const marginAfter = bundlePrice > 0 ? roundMoney((profitAfter / bundlePrice) * 100) : 0;

    const offerCopy = sanitizeForbiddenMarketingClaims(
      `🎁 عرض باقة خاصة من ${brandLabel}!\n` +
        `جمعنالك «${hero.productName}» + «${slow.productName}» في باقة واحدة متكاملة.\n` +
        `• السعر العادي للقطعتين: ${fmtMoney(regularTotal, currency)}\n` +
        `• سعر الباقة الآن: ${fmtMoney(bundlePrice, currency)}${savings > 0 ? ` (توفير ${fmtMoney(savings, currency)})` : ''}\n` +
        `ابعتلنا رسالة لحجز الباقة أو اختار ألوانك ☀️`,
      `${hero.productName} ${slow.productName}`
    );

    return {
      usedCosting: true,
      heroProduct: hero,
      slowProduct: slow,
      regularTotal,
      bundlePrice,
      profitBefore,
      profitAfter,
      reply:
        `🎁 **معادلة التجميع (بطل + راكد) المحسوبة من تكلفتك الحقيقية يا ${params.firstName}:**\n` +
        `• **المنتج البطل:** ${hero.productName} (${heroEntry.orders} طلب)\n` +
        `• **المنتج الراكد:** ${slow.productName} (${slowEntry.orders} طلب)\n\n` +
        `📊 **الأرقام قبل الموافقة:**\n` +
        `• **السعر العادي للقطعتين:** ${fmtMoney(regularTotal, currency)}\n` +
        `• **سعر الباقة المقترح:** **${fmtMoney(bundlePrice, currency)}** ${savings > 0 ? `(توفير للعميل ${fmtMoney(savings, currency)})` : '(الهامش ضيق فحافظنا على السعر الآمن)'}\n` +
        `• **ربحك قبل العرض:** ${fmtMoney(profitBefore, currency)}\n` +
        `• **ربحك بعد العرض:** **${fmtMoney(profitAfter, currency)}** (هامش آمن **${marginAfter}%** ≥ ${minMargin}%)\n\n` +
        `تحت هتلاقي صيغة العرض جاهزة للنسخ والنشر لو وافقت 👇`,
      copyBlocks: [
        {
          id: `bundle_copy_${Date.now()}`,
          title: `🎁 بوست باقة (${hero.productName} + ${slow.productName})`,
          content: offerCopy,
        },
      ],
      options: [
        { id: 'bun_opt_wa', label: 'رسالة واتساب بـ 3 أساليب 💬', queryText: `رسالة واتساب لمنتج ${hero.productName}` },
        { id: 'bun_opt_posts', label: 'بوستين جاهزين للمتجر ✍️', queryText: 'اكتبيلي بوستين للمتجر' },
        { id: 'bun_opt_top3', label: 'أهم 3 توصيات تسويقية ☀️', queryText: 'إيه أهم 3 توصيات تسويقية ليا النهاردة؟' },
      ],
    };
  } catch {
    return { usedCosting: false, reply: 'تعذّر تجهيز عرض التجميع حالياً — جرّب تاني.' };
  }
}

export interface ProductRadarSuggestion {
  ideaAr: string;
  availableMaterials: string[];
  missingMaterials: string[];
}

export function runNewProductStockRadar(params: {
  accountId?: string | null;
  packageOptions?: AccountPackageQueryOptions;
  firstName: string;
  specialtyHint?: string;
  products?: SavedProductRecord[];
  rawMaterials?: RawMaterialItem[];
}): ShamousaMarketingReplyBlock & {
  specialtyNameAr: string;
  ideas: ProductRadarSuggestion[];
} {
  try {
    const hasInv = hasFeature('inventory', params.accountId || undefined, params.packageOptions);
    const lib = getEffectiveMarketingLibrary();

    // تحديد التخصص من كلام المستخدم أو من منتجات الحساب
    const probeText = [
      params.specialtyHint || '',
      ...(params.products || []).slice(0, 5).map((p) => `${p.productName} ${p.craftName || ''}`),
    ].join(' ');
    const understood = understandProductSentence(probeText);
    const spec = understood.specialty || lib.specialties[0];

    const activeMats = hasInv
      ? (params.rawMaterials || []).filter((m) => m.isActive !== false && Number(m.currentStock || 0) > 0)
      : [];

    const existingNames = new Set((params.products || []).map((p) => normAr(p.productName)));
    const candidateIdeas = spec.popularItems
      .filter((item) => !existingNames.has(normAr(item)))
      .slice(0, 4);
    const finalIdeaNames = candidateIdeas.length > 0 ? candidateIdeas : spec.popularItems.slice(0, 3);

    const availableTypical: string[] = [];
    const missingTypical: string[] = [];

    if (hasInv) {
      for (const tm of spec.typicalMaterials) {
        const matched = findMatchingStockMaterial(tm, activeMats);
        if (matched) {
          availableTypical.push(`${tm} (متوفر: ${matched.materialName})`);
        } else {
          missingTypical.push(tm);
        }
      }
    }

    const ideas: ProductRadarSuggestion[] = finalIdeaNames.map((ideaAr) => ({
      ideaAr,
      availableMaterials: availableTypical.slice(0, 3),
      missingMaterials: missingTypical.slice(0, 3),
    }));

    const lines: string[] = [
      `💡 **رادار أفكار منتجات جديدة لتخصص «${spec.nameAr}» يا ${params.firstName}:**`,
      ...ideas.map((id, i) => `${i + 1}. **${id.ideaAr}**`),
    ];

    if (hasInv) {
      if (availableTypical.length > 0) {
        lines.push(`\n✅ **خامات جاهزة في مخزونك تنفع للأفكار دي:** ${availableTypical.slice(0, 4).join(' • ')}`);
      }
      if (missingTypical.length > 0) {
        lines.push(`⚠️ **خامات ناقصة هتحتاج توفرها لو نفّذتها:** ${missingTypical.slice(0, 4).join(' • ')}`);
      } else if (availableTypical.length > 0) {
        lines.push(`🎉 كل الخامات الأساسية للتخصص ده متوفرة في مخزونك حالياً!`);
      }
    } else {
      lines.push(
        `\n🧶 **الخامات النموذجية المقترحة للتخصص:** ${spec.typicalMaterials.slice(0, 5).join(' • ')}`
      );
    }

    return {
      specialtyNameAr: spec.nameAr,
      ideas,
      reply: lines.join('\n'),
      options: [
        { id: 'rad_opt_1', label: `جهّز منتج «${ideas[0]?.ideaAr || spec.nameAr}» ✨`, queryText: `عايز أعمل منتج ${ideas[0]?.ideaAr || spec.nameAr}` },
        { id: 'rad_opt_2', label: 'أفكار تصوير وفيديو 🎬', queryText: `أفكار فيديو وتصوير ${spec.nameAr}` },
        { id: 'rad_opt_3', label: 'مقترح باقات هدايا 🎁', queryText: `باقات ${spec.nameAr}` },
      ],
    };
  } catch {
    return {
      specialtyNameAr: 'عام',
      ideas: [],
      reply: 'تعذّر تشغيل رادار الأفكار لحظياً — قولي تخصص ورشتك وهقترحلك أفكار فوراً.',
    };
  }
}

export function buildArtisanStorePostsAndWhatsapp(params: {
  firstName: string;
  brandName?: string;
  productName: string;
  productDescription?: string;
  price?: number;
  currency?: string;
  specialtyHint?: string;
}): ShamousaMarketingReplyBlock & {
  offerPost: string;
  storyPost: string;
  whatsappStyles: { fast: string; friendly: string; formal: string };
} {
  const brand = (params.brandName || '').trim() || 'ورشتنا';
  const currency = params.currency || 'ج.م';
  const pricePart = params.price && params.price > 0 ? `السعر: ${fmtMoney(params.price, currency)}` : 'السعر وتفاصيل المقاس في الرسائل';
  const facts = `${params.productName} ${params.productDescription || ''} ${params.specialtyHint || ''}`;
  const understood = understandProductSentence(facts);
  const spec = understood.specialty;
  const sellingPoint = spec?.sellingPoints[0] || 'شغل يدوي متقن وتفاصيل معمولة بعناية';
  const hashtags = (spec?.hashtags || ['#هاندميد', '#صنع_يدوي']).slice(0, 5).join(' ');

  const offerPost = sanitizeForbiddenMarketingClaims(
    `☀️ جديد من ${brand}!\n` +
      `«${params.productName}» — ${sellingPoint}.\n` +
      `• ${pricePart}\n` +
      `• متاح اختيار الألوان والمقاس حسب طلبك.\n` +
      `ابعتلنا رسالة دلوقتي على صفحة ${brand} للحجز والتفاصيل ✨\n${hashtags}`,
    facts
  );

  const storyPost = sanitizeForbiddenMarketingClaims(
    `🧵 ورا الكواليس في ${brand}...\n` +
      `كل قطعة من «${params.productName}» بتاخد وقتها من أول اختيار الخامة لحد آخر تفصيلة في التشطيب عشان تطلع بالشكل اللي يفرحك.\n` +
      `قولولنا في التعليقات: تحبوا تشوفوا «${params.productName}» بأي لون المرة الجاية؟ 💬\n${hashtags}`,
    facts
  );

  const whatsappStyles = {
    fast: sanitizeForbiddenMarketingClaims(
      `أهلاً بحضرتك من ${brand} ☀️ بخصوص «${params.productName}»: ${pricePart}. لو حابب تحجز ابعتلي اللون والمقاس والعنوان ونأكد فوراً.`,
      facts
    ),
    friendly: sanitizeForbiddenMarketingClaims(
      `منورنا في ${brand} يا فندم 🌸 «${params.productName}» معمولة بالإيد بكل حب (${sellingPoint})، و${pricePart}. تحب أبعثلك الألوان المتاحة ونختار سوا الأنسب لك؟`,
      facts
    ),
    formal: sanitizeForbiddenMarketingClaims(
      `تحية طيبة من ${brand}. نشكر تواصلكم بخصوص «${params.productName}» (${pricePart}). يُرجى تأكيد المواصفات المطلوبة وبيانات التوصيل لتسجيل الطلب وتحديد موعد التسليم.`,
      facts
    ),
  };

  return {
    offerPost,
    storyPost,
    whatsappStyles,
    reply:
      `✍️ **جهّزتلك بوستين باسم متجرك «${brand}» + رسالة واتساب بـ 3 أساليب لمنتج «${params.productName}» يا ${params.firstName}:**\n` +
      `انسخ أي واحد منهم مباشرة من البطاقات اللي تحت 👇`,
    copyBlocks: [
      { id: `art_offer_${Date.now()}`, title: `📣 بوست 1 — عرض بيع (${brand})`, content: offerPost },
      { id: `art_story_${Date.now()}`, title: `🎬 بوست 2 — قصة ورا الكواليس (${brand})`, content: storyPost },
      {
        id: `art_wa_${Date.now()}`,
        title: `💬 رسالة واتساب بـ 3 أساليب (${params.productName})`,
        content:
          `⚡ [سريع]:\n${whatsappStyles.fast}\n\n` +
          `🌸 [ودود]:\n${whatsappStyles.friendly}\n\n` +
          `💼 [رسمي]:\n${whatsappStyles.formal}`,
      },
    ],
    options: [
      { id: 'art_p_opt1', label: 'عرض تجميع بطل + راكد 🎁', queryText: 'اقترحيلي عرض تجميع لمنتج راكد' },
      { id: 'art_p_opt2', label: 'المواسم الجاية 🗓️', queryText: 'إيه المواسم الجاية؟' },
      { id: 'art_p_opt3', label: 'أهم 3 توصيات تسويقية ☀️', queryText: 'إيه أهم 3 توصيات تسويقية ليا النهاردة؟' },
    ],
  };
}

// ============================================================================
// 6. ميزات الموردين: باقات خامات Starter Kits + خصم كميات للراكد + بوستين للورش
// ============================================================================

export interface SupplierStarterKitProposal {
  craftTitleAr: string;
  matchedMaterials: RawMaterialItem[];
  totalCost: number;
  suggestedKitPrice?: number;
  marginPercent?: number;
}

export function buildSupplierStarterKitsFromStock(params: {
  accountId?: string | null;
  packageOptions?: AccountPackageQueryOptions;
  firstName: string;
  brandName?: string;
  rawMaterials: RawMaterialItem[];
  minMarginPercent?: number;
  currency?: string;
}): ShamousaMarketingReplyBlock & {
  kits: SupplierStarterKitProposal[];
  usedCosting: boolean;
} {
  try {
    const currency = params.currency || 'ج.م';
    const minMargin = params.minMarginPercent ?? 20;
    const hasInv = hasFeature('inventory', params.accountId || undefined, params.packageOptions);
    const hasCost =
      hasFeature('costing', params.accountId || undefined, params.packageOptions) ||
      (params.packageOptions?.role === 'supplier' && hasInv);
    const lib = getEffectiveMarketingLibrary();
    const starterDefs = lib.suppliers?.starterKits || [];
    const activeMats = (params.rawMaterials || []).filter((m) => m.isActive !== false && Number(m.currentStock || 0) > 0);
    const brand = (params.brandName || '').trim() || 'متجر الخامات';

    if (!hasInv || activeMats.length === 0) {
      return {
        kits: [],
        usedCosting: false,
        reply:
          `📦 **أفكار باقات خامات جاهزة (Starter Kits) للموردين يا ${params.firstName}:**\n` +
          starterDefs.slice(0, 5).map((k, i) => `${i + 1}. **${k.titleAr}:** ${k.contentsAr}`).join('\n') +
          `\n\n💡 أول ما تضيف خاماتك في المخزون هجمعلك الباقات دي تلقائياً من رصيدك الفعلي.`,
        options: [
          { id: 'sup_k_posts', label: 'بوستين لأصحاب الورش 📣', queryText: 'اكتبيلي بوستين للمورد لأصحاب الورش' },
        ],
      };
    }

    const kits: SupplierStarterKitProposal[] = [];

    for (const def of starterDefs) {
      const parts = def.contentsAr.split('+').map((p) => p.trim()).filter(Boolean);
      const matched: RawMaterialItem[] = [];
      for (const part of parts) {
        const hit = findMatchingStockMaterial(part, activeMats);
        if (hit && !matched.some((m) => m.id === hit.id)) {
          matched.push(hit);
        }
      }
      if (matched.length >= 2) {
        const totalCost = roundMoney(matched.reduce((s, m) => s + Math.max(0, Number(m.costPerUnit || 0)), 0));
        const suggestedKitPrice =
          hasCost && totalCost > 0 ? roundMoney(totalCost / (1 - minMargin / 100)) : undefined;
        kits.push({
          craftTitleAr: def.titleAr,
          matchedMaterials: matched,
          totalCost,
          suggestedKitPrice,
          marginPercent: suggestedKitPrice ? minMargin : undefined,
        });
      }
    }

    // لو مخزون المورد فيه خامات متقاربة في القسم ولم تطابق تعريف محدد -> نكوّن باقة من نفس القسم
    if (kits.length === 0 && activeMats.length >= 2) {
      const topMats = activeMats.slice(0, 3);
      const totalCost = roundMoney(topMats.reduce((s, m) => s + Math.max(0, Number(m.costPerUnit || 0)), 0));
      const suggestedKitPrice =
        hasCost && totalCost > 0 ? roundMoney(totalCost / (1 - minMargin / 100)) : undefined;
      kits.push({
        craftTitleAr: `باقة خامات جاهزة من ${brand}`,
        matchedMaterials: topMats,
        totalCost,
        suggestedKitPrice,
        marginPercent: suggestedKitPrice ? minMargin : undefined,
      });
    }

    const lines: string[] = [
      `🎁 **باقات خامات متكاملة (Starter Kits) مجمّعة من مخزونك الفعلي يا ${params.firstName}:**`,
    ];
    kits.slice(0, 4).forEach((k, idx) => {
      const itemsList = k.matchedMaterials.map((m) => `${m.materialName} (${m.unit})`).join(' + ');
      const priceLine =
        hasCost && k.suggestedKitPrice
          ? `\n   ↳ التكلفة: ${fmtMoney(k.totalCost, currency)} | **سعر الباقة الآمن (هامش ${minMargin}%):** **${fmtMoney(k.suggestedKitPrice, currency)}**`
          : `\n   ↳ قولي أقل سعر تقبل بيه للباقة دي وأظبطلك بوست العرض فوراً!`;
      lines.push(`${idx + 1}. **${k.craftTitleAr}**\n   • المكونات المتوفرة عندك: ${itemsList}${priceLine}`);
    });

    return {
      kits,
      usedCosting: hasCost,
      reply: lines.join('\n'),
      options: [
        { id: 'sup_k_vol', label: 'خصم كميات على الراكد 📊', queryText: 'اقترحيلي خصم كميات على الخامات الراكدة' },
        { id: 'sup_k_posts', label: 'بوستين لأصحاب الورش 📣', queryText: 'اكتبيلي بوستين للمورد لأصحاب الورش' },
      ],
    };
  } catch {
    return { kits: [], usedCosting: false, reply: 'تعذّر تجميع باقات الخامات حالياً — جرّب تاني.' };
  }
}

export interface SupplierVolumeTier {
  minQty: number;
  discountPercent: number;
  unitPriceAfter: number;
  profitPerUnitAfter?: number;
  marginPercentAfter?: number;
}

export function buildSupplierSlowStockVolumeTiers(params: {
  accountId?: string | null;
  packageOptions?: AccountPackageQueryOptions;
  firstName: string;
  rawMaterials: RawMaterialItem[];
  orders?: InvoiceRecord[];
  minMarginPercent?: number;
  currency?: string;
}): ShamousaMarketingReplyBlock & {
  targetMaterial?: RawMaterialItem;
  tiers: SupplierVolumeTier[];
  usedCosting: boolean;
} {
  try {
    const currency = params.currency || 'ج.م';
    const minMargin = params.minMarginPercent ?? 15;
    const hasInv = hasFeature('inventory', params.accountId || undefined, params.packageOptions);
    const hasCost =
      hasFeature('costing', params.accountId || undefined, params.packageOptions) ||
      (params.packageOptions?.role === 'supplier' && hasInv);

    if (!hasInv) {
      return {
        tiers: [],
        usedCosting: false,
        reply: `خصم الكميات على المخزون الراكد بيشتغل مع باقة **المخزون** يا ${params.firstName}.`,
      };
    }

    const activeMats = (params.rawMaterials || []).filter((m) => m.isActive !== false && Number(m.currentStock || 0) > 0);
    if (activeMats.length === 0) {
      return {
        tiers: [],
        usedCosting: false,
        reply: `مفيش خامات برصيد متاح حالياً في المخزون يا ${params.firstName}.`,
      };
    }

    const salesByName = countOrdersByProduct(params.orders || []);
    // الراكد: أقل مبيعات + أعلى رصيد مخزون
    const slowSorted = [...activeMats].sort((a, b) => {
      const sa = salesByName.get(normAr(a.materialName)) || 0;
      const sb = salesByName.get(normAr(b.materialName)) || 0;
      if (sa !== sb) return sa - sb;
      return Number(b.currentStock || 0) - Number(a.currentStock || 0);
    });

    const target = slowSorted[0];
    const unitCost = Number(target.costPerUnit || 0);
    // سعر البيع العادي للوحدة: نفترض هامش أساسي 35% فوق التكلفة لو غير مسجل سعر بيع مستقل
    const baseSellingPrice = unitCost > 0 ? roundMoney(unitCost / (1 - 0.35)) : 0;

    if (!hasCost || !(unitCost > 0)) {
      return {
        targetMaterial: target,
        tiers: [],
        usedCosting: false,
        awaitingFloorPriceFor: { productName: target.materialName },
        reply:
          `📉 **أكثر خامة راكدة في مخزونك حالياً:** **${target.materialName}** (الرصيد: ${target.currentStock} ${target.unit}).\n` +
          `عشان أعملك شرائح خصم كميات (3+ / 6+ / 12+) تحركها بأمان، قولي: **أقل سعر للوحدة تقبل تبيع بيه كام؟**`,
      };
    }

    const minSafeUnitPrice = roundMoney(unitCost / (1 - minMargin / 100));
    const profitBefore = roundMoney(baseSellingPrice - unitCost);
    const marginBefore = roundMoney((profitBefore / baseSellingPrice) * 100);

    const rawTiers = [
      { minQty: 3, discountPercent: 5 },
      { minQty: 6, discountPercent: 10 },
      { minQty: 12, discountPercent: 15 },
    ];

    const tiers: SupplierVolumeTier[] = rawTiers.map((t) => {
      const discounted = roundMoney(baseSellingPrice * (1 - t.discountPercent / 100));
      const safePrice = Math.max(minSafeUnitPrice, discounted);
      const actualDisc = roundMoney(((baseSellingPrice - safePrice) / baseSellingPrice) * 100);
      const profitAfter = roundMoney(safePrice - unitCost);
      const marginAfter = roundMoney((profitAfter / safePrice) * 100);
      return {
        minQty: t.minQty,
        discountPercent: Math.max(0, actualDisc),
        unitPriceAfter: safePrice,
        profitPerUnitAfter: profitAfter,
        marginPercentAfter: marginAfter,
      };
    });

    const lines = [
      `📉 **خطة خصم الكميات لتحريك الخامة الراكدة «${target.materialName}» (رصيد: ${target.currentStock} ${target.unit}) يا ${params.firstName}:**`,
      `• **قبل الخصم:** السعر المرجعي ${fmtMoney(baseSellingPrice, currency)} | الربح للوحدة: ${fmtMoney(profitBefore, currency)} (هامش ${marginBefore}%)`,
      `\n📊 **الشرائح الآمنة بعد الخصم (تحفظ حد أدنى للهامش ${minMargin}%):**`,
      ...tiers.map(
        (t) =>
          `• **كمية ${t.minQty}+ ${target.unit}:** خصم ${t.discountPercent}% ← السعر **${fmtMoney(t.unitPriceAfter, currency)}** | الربح للوحدة **${fmtMoney(t.profitPerUnitAfter || 0, currency)}** (هامش ${t.marginPercentAfter}%)`
      ),
    ];

    return {
      targetMaterial: target,
      tiers,
      usedCosting: true,
      reply: lines.join('\n'),
      options: [
        { id: 'sup_v_kits', label: 'باقات خامات جاهزة 🎁', queryText: 'اقترحيلي باقات خامات للمورد' },
        { id: 'sup_v_posts', label: 'بوستين لأصحاب الورش 📣', queryText: 'اكتبيلي بوستين للمورد لأصحاب الورش' },
      ],
    };
  } catch {
    return { tiers: [], usedCosting: false, reply: 'تعذّر حساب شرائح خصم الكميات حالياً.' };
  }
}

export function buildSupplierWorkshopPosts(params: {
  firstName: string;
  brandName?: string;
  rawMaterials?: RawMaterialItem[];
}): ShamousaMarketingReplyBlock & { post1Quality: string; post2Speed: string } {
  const brand = (params.brandName || '').trim() || 'متجر الخامات';
  const topNames = (params.rawMaterials || [])
    .filter((m) => m.isActive !== false && m.materialName)
    .slice(0, 3)
    .map((m) => m.materialName);
  const matsLine = topNames.length > 0 ? topNames.join(' • ') : 'خامات الورش اليدوية الأساسية';
  const libSup = getEffectiveMarketingLibrary().suppliers;
  const hashtags = (libSup?.hashtags || ['#خامات_هاندميد', '#مورد_خامات', '#خامات_للورش']).slice(0, 5).join(' ');

  const post1Quality = sanitizeForbiddenMarketingClaims(
    `🏪 لأصحاب الورش والفنانين — جديد ${brand}!\n` +
      `متوفر الآن: ${matsLine}.\n` +
      `✅ خامات بجودة ثابتة وألوان متطابقة بين كل دفعة والتانية عشان شغلك يطلع بنفس المستوى دايماً.\n` +
      `ابعتلنا قائمة طلبات ورشتك على ${brand} ونجهزهالك بأسعار جملة للورش ☀️\n${hashtags}`,
    matsLine
  );

  const post2Speed = sanitizeForbiddenMarketingClaims(
    `🚚 شغلك واقف على خامة؟ ${brand} معاك في التوريد السريع!\n` +
      `جهّزنا باقات خامات جاهزة وكميات مرنة (${matsLine}) لأصحاب الورش عشان ما تعطّلش أي أوردر عميل.\n` +
      `راسل ${brand} دلوقتي لمعرفة المتاح وموعد الشحن السريع 📦\n${hashtags}`,
    matsLine
  );

  return {
    post1Quality,
    post2Speed,
    reply:
      `📣 **جهّزتلك بوستين موجهين لأصحاب الورش باسم «${brand}» يا ${params.firstName}:**\n` +
      `• بوست 1 يركز على **الجودة وثبات الألوان**\n` +
      `• بوست 2 يركز على **سرعة التوريد وعدم تعطيل أوردرات الورش**\n` +
      `انسخهم مباشرة من تحت 👇`,
    copyBlocks: [
      { id: `sup_post1_${Date.now()}`, title: `✨ بوست 1 — الجودة وثبات الألوان (${brand})`, content: post1Quality },
      { id: `sup_post2_${Date.now()}`, title: `🚚 بوست 2 — سرعة التوريد للورش (${brand})`, content: post2Speed },
    ],
    options: [
      { id: 'sup_p_kits', label: 'باقات خامات Starter Kits 🎁', queryText: 'اقترحيلي باقات خامات للمورد' },
      { id: 'sup_p_vol', label: 'خصم كميات للراكد 📊', queryText: 'اقترحيلي خصم كميات على الخامات الراكدة' },
    ],
  };
}

// ============================================================================
// 7. محرك الأولويات الاستباقي (3 اقتراحات بحد أقصى مرتبة حسب الأثر المتوقع)
// ============================================================================

export interface ProactiveMarketingSuggestion {
  id: string;
  badgeAr: string;
  titleAr: string;
  summaryAr: string;
  impactScore: number;
  queryText: string;
  category: 'pricing' | 'season' | 'bundle' | 'production' | 'supplier' | 'insight';
}

export function buildProactiveTop3MarketingSuggestions(params: {
  accountId?: string | null;
  packageOptions?: AccountPackageQueryOptions;
  isSupplier?: boolean;
  brandName?: string;
  products: SavedProductRecord[];
  rawMaterials: RawMaterialItem[];
  orders: InvoiceRecord[];
  now?: Date;
  currency?: string;
}): ProactiveMarketingSuggestion[] {
  try {
    const currency = params.currency || 'ج.م';
    const hasCost = hasFeature('costing', params.accountId || undefined, params.packageOptions);
    const hasInv = hasFeature('inventory', params.accountId || undefined, params.packageOptions);
    const candidates: ProactiveMarketingSuggestion[] = [];

    // 1) تنبيه موسم مصري خلال 3 أسابيع (متاح للجميع)
    const seasons = getEgyptianSeasonsCalendar({ now: params.now, accountId: params.accountId });
    const alertSeason = seasons.find((s) => s.isWithinAlertWindow);
    if (alertSeason) {
      candidates.push({
        id: `pro_season_${alertSeason.id}`,
        badgeAr: 'موسم قريب 🗓️',
        titleAr: `جهّز لموسم ${alertSeason.nameAr} (بعد ${alertSeason.daysUntil} يوم)`,
        summaryAr: `ابدأ التجهيز دلوقتي: ${alertSeason.whatToMakeAr.slice(0, 90)}...`,
        impactScore: 96 - Math.min(20, alertSeason.daysUntil),
        queryText: 'إيه المواسم الجاية؟',
        category: 'season',
      });
    }

    if (params.isSupplier) {
      // للمورد: خصم كميات على الراكد (لو المخزون مفعّل)
      if (hasInv && (params.rawMaterials || []).some((m) => m.isActive !== false && m.currentStock > 0)) {
        const vol = buildSupplierSlowStockVolumeTiers({
          accountId: params.accountId,
          packageOptions: params.packageOptions,
          firstName: 'مورد',
          rawMaterials: params.rawMaterials,
          orders: params.orders,
          currency,
        });
        if (vol.targetMaterial) {
          candidates.push({
            id: `pro_sup_slow_${vol.targetMaterial.id}`,
            badgeAr: 'تحريك راكد 📉',
            titleAr: `حرّك رصيد «${vol.targetMaterial.materialName}» بخصم كميات`,
            summaryAr: `الرصيد الحالي ${vol.targetMaterial.currentStock} ${vol.targetMaterial.unit} — شرائح كميات جاهزة تحركه للورش بدون خسارة.`,
            impactScore: 90,
            queryText: 'اقترحيلي خصم كميات على الخامات الراكدة',
            category: 'supplier',
          });
        }

        const kits = buildSupplierStarterKitsFromStock({
          accountId: params.accountId,
          packageOptions: params.packageOptions,
          firstName: 'مورد',
          brandName: params.brandName,
          rawMaterials: params.rawMaterials,
          currency,
        });
        if (kits.kits.length > 0) {
          candidates.push({
            id: 'pro_sup_kit',
            badgeAr: 'باقة خامات 🎁',
            titleAr: `اعرض «${kits.kits[0].craftTitleAr}» من مخزونك`,
            summaryAr: `مجمّعة من ${kits.kits[0].matchedMaterials.length} خامات متوفرة فعلياً عندك لزيادة متوسط قيمة الفاتورة.`,
            impactScore: 84,
            queryText: 'اقترحيلي باقات خامات للمورد',
            category: 'supplier',
          });
        }
      }

      candidates.push({
        id: 'pro_sup_posts',
        badgeAr: 'تسويق للورش 📣',
        titleAr: 'انشر بوستين جاهزين لأصحاب الورش',
        summaryAr: 'بوست عن الجودة وثبات الألوان + بوست عن سرعة التوريد باسم متجرك.',
        impactScore: 72,
        queryText: 'اكتبيلي بوستين للمورد لأصحاب الورش',
        category: 'supplier',
      });
    } else {
      // للورشة: (أ) تنبيه تسعير بالخسارة أو هامش منخفض (فقط لو باقة التكاليف مفعلة!)
      if (hasCost && (params.products || []).length > 0) {
        const pa = analyzeAccountProductPricing({
          accountId: params.accountId,
          packageOptions: params.packageOptions,
          firstName: 'فنان',
          products: params.products,
          currency,
        });
        if (pa.lossProducts.length > 0) {
          const lp = pa.lossProducts[0];
          candidates.push({
            id: `pro_loss_${lp.id}`,
            badgeAr: 'تنبيه تسعير 🚨',
            titleAr: `راجع سعر «${lp.productName}» فوراً`,
            summaryAr: `سعره (${fmtMoney(lp.sellingPrice, currency)}) أقل من تكلفته (${fmtMoney(lp.unitCost, currency)}) — تعديله يحمي ربحك مباشرة.`,
            impactScore: 99,
            queryText: 'تحليل أسعاري ومقارنة منتجاتي',
            category: 'pricing',
          });
        } else if (pa.lowMarginProducts.length > 0) {
          const lm = pa.lowMarginProducts[0];
          candidates.push({
            id: `pro_lowmargin_${lm.id}`,
            badgeAr: 'تحسين هامش ⚠️',
            titleAr: `هامش «${lm.productName}» منخفض (${lm.marginPercent}%)`,
            summaryAr: `تقدر ترفع ربحيتك بتعديل السعر أو دمجه في باقة تجميع ذكية.`,
            impactScore: 88,
            queryText: 'تحليل أسعاري ومقارنة منتجاتي',
            category: 'pricing',
          });
        }
      }

      // (ب) عرض تجميع (بطل + راكد) لو فيه منتجين فأكثر
      if ((params.products || []).length >= 2) {
        const bun = buildHeroSlowBundleOffer({
          accountId: params.accountId,
          packageOptions: params.packageOptions,
          firstName: 'فنان',
          brandName: params.brandName,
          products: params.products,
          orders: params.orders,
          currency,
        });
        if (bun.heroProduct && bun.slowProduct) {
          candidates.push({
            id: `pro_bundle_${bun.heroProduct.id}_${bun.slowProduct.id}`,
            badgeAr: 'معادلة التجميع 🎁',
            titleAr: `ادمج «${bun.heroProduct.productName}» + «${bun.slowProduct.productName}»`,
            summaryAr:
              hasCost && bun.bundlePrice
                ? `سعر الباقة الآمن ${fmtMoney(bun.bundlePrice, currency)} يحرّك الراكد ويحافظ على ربحك.`
                : `تجميعة ذكية تحرّك المنتج الأقل طلباً مع المنتج الأكثر مبيعاً عندك.`,
            impactScore: 86,
            queryText: 'اقترحيلي عرض تجميع لمنتج راكد',
            category: 'bundle',
          });
        }
      }

      // (ج) طاقة الإنتاج وأول خامة هتخلص (فقط لو باقة المخزون مفعلة!)
      if (hasInv && (params.products || []).length > 0 && (params.rawMaterials || []).length > 0) {
        const cap = computeProductionCapacityFromStock({
          accountId: params.accountId,
          packageOptions: params.packageOptions,
          firstName: 'فنان',
          products: params.products,
          rawMaterials: params.rawMaterials,
          orders: params.orders,
        });
        if (cap.items.length > 0) {
          const topCap = cap.items[0];
          candidates.push({
            id: `pro_prod_${topCap.productId}`,
            badgeAr: 'أولوية إنتاج 📦',
            titleAr: `أولوية التشغيل: «${topCap.productName}» (${topCap.maxUnits} قطعة)`,
            summaryAr: `أول خامة هتخلص فيه هي «${topCap.bottleneckMaterialName}» (رصيد ${topCap.bottleneckCurrentStock} ${topCap.bottleneckUnit}).`,
            impactScore: 82,
            queryText: 'أقدر أصنع كام قطعة بالمخزون الحالي؟',
            category: 'production',
          });
        }
      }

      // (د) تغذية ذاتية من ملاحظات شات نفس الحساب فقط (Rule 5)
      const selfInsights: AccountMarketingInsight[] = loadAccountMarketingInsights(params.accountId);
      if (selfInsights.length > 0) {
        const latest = selfInsights[0];
        candidates.push({
          id: `pro_self_${latest.id}`,
          badgeAr: 'من محادثاتك ✨',
          titleAr: latest.titleAr,
          summaryAr: latest.detailAr,
          impactScore: 76,
          queryText: latest.queryText,
          category: 'insight',
        });
      }

      // (هـ) بوستين جاهزين للمتجر (متاح للجميع)
      candidates.push({
        id: 'pro_art_posts',
        badgeAr: 'محتوى جاهز ✍️',
        titleAr: 'انشر بوست عرض + بوست ورا الكواليس',
        summaryAr: `مكتوبين باسم «${params.brandName || 'متجرك'}» مع 3 أساليب رد واتساب جاهزة للنسخ.`,
        impactScore: 70,
        queryText: 'اكتبيلي بوستين للمتجر',
        category: 'insight',
      });
    }

    // ترتيب تنازلي حسب الأثر المتوقع + بحد أقصى 3 اقتراحات فقط!
    const uniqueById = new Map<string, ProactiveMarketingSuggestion>();
    for (const c of candidates) {
      if (!uniqueById.has(c.id)) uniqueById.set(c.id, c);
    }

    return Array.from(uniqueById.values())
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export function formatProactiveTop3Reply(params: {
  firstName: string;
  suggestions: ProactiveMarketingSuggestion[];
}): ShamousaMarketingReplyBlock {
  const list = params.suggestions.slice(0, 3);
  if (list.length === 0) {
    return {
      reply: `أهلاً يا ${params.firstName} ☀️ أضف أول منتج في حسابك وهجهّزلك فوراً أهم 3 توصيات تسويقية وإنتاجية ليك!`,
    };
  }

  const lines = [
    `☀️ **أهم ${list.length} توصيات تسويقية وإنتاجية ليك النهاردة (مرتّبة حسب الأثر) يا ${params.firstName}:**`,
    ...list.map((s, i) => `${i + 1}. **[${s.badgeAr}] ${s.titleAr}**\n   ↳ ${s.summaryAr}`),
    `\nاضغط على أي توصية تحت عشان ننفّذها سوا خطوة بخطوة 👇`,
  ];

  return {
    reply: lines.join('\n'),
    options: list.map((s, i) => ({
      id: `top3_opt_${i}`,
      label: s.titleAr.slice(0, 34),
      queryText: s.queryText,
    })),
  };
}
