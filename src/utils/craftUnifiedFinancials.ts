import { CalculationInput, CalculationOutput, UnifiedPricingMode } from '../types';

export interface CraftParamField {
  key: string;
  labelAr: string;
  unitAr?: string;
  type: 'number' | 'select' | 'boolean';
  defaultValue: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  isCalibration?: boolean;
  hintAr?: string;
  options?: Array<{ value: string | number; label: string }>;
}

export interface WorkshopMathResult {
  totalDirectMaterialsCost: number;
  yarnCost: number;
  extraMaterialsTotalCost: number;
  totalWeightKg: number;
  totalWeightGrams: number;
  totalLengthMeters?: number;
  energyCostExtra?: number;
  moldCostExtra?: number;
  wasteMode: 'on_net' | 'nesting_efficiency' | 'yield_factor';
  wasteFactorPercent: number;
  wasteAmount: number;
  netQtyLabel: string;
  grossQtyLabel: string;
  volumeCm3?: number;
  areaCm2?: number;
  detailedLines: Array<{ label: string; value: string; highlight?: boolean }>;
}

export interface WorkshopSpec {
  craftId: string;
  mainSectionId: string;
  nameAr: string;
  isNewStar?: boolean;
  defaultWastePercent: number;
  isYieldOrNestingBased?: boolean;
  indicativeHourlyRateRange: [number, number];
  safetyWarning?: string;
  formulaSummaryAr: string;
  fields: CraftParamField[];
  calculate: (
    input: CalculationInput,
    params: Record<string, number | string | boolean>,
    calibrations: Record<string, number>
  ) => WorkshopMathResult;
}

// =========================================================================
// ثوابت وقواعد المعادلات الموحدة المصححة (Unified Corrected Formulas)
// =========================================================================

/** ث1: تحويل نسبة الفقد (f) من الشراء إلى نسبة هالك مكافئة على الصافي (ه) */
export function lossFractionToWasteOnNet(lossPercent: number): number {
  const f = Math.max(0, Math.min(95, Number(lossPercent) || 0)) / 100;
  return Number(((f / (1 - f)) * 100).toFixed(2));
}

/** ث1: تحويل كفاءة الاستغلال أو العائد (Y) إلى هالك مكافئ على الصافي */
export function yieldToWasteOnNet(yieldFraction: number): number {
  const y = Math.max(0.05, Math.min(1, Number(yieldFraction) || 1));
  return Number((((1 / y) - 1) * 100).toFixed(2));
}

/** ث1: حساب الكمية الإجمالية بتطبيق الهالك على الصافي */
export function applyWasteOnNet(netQty: number, wastePercent: number): { gross: number; waste: number } {
  const net = Math.max(0, Number(netQty) || 0);
  const w = Math.max(0, Number(wastePercent) || 0) / 100;
  const waste = net * w;
  return { gross: net + waste, waste };
}

/** ث1: حساب تكلفة الوحدة الفعلية عند الشراء شاملة الشحن والضريبة غير المستردة */
export function computeUnitIssuePrice(purchasePrice: number, shipping: number, nonRecoverableTax: number, usableUnits: number): number {
  const n = Math.max(0.0001, Number(usableUnits) || 1);
  return (Math.max(0, purchasePrice) + Math.max(0, shipping) + Math.max(0, nonRecoverableTax)) / n;
}

/** ث6: تحويل الزيادة على التكلفة (ز_ي) إلى هامش ربح من سعر البيع (ر) */
export function markupToMarginPercent(markupPercent: number): number {
  const u = Math.max(0, Number(markupPercent) || 0) / 100;
  return Number(((u / (1 + u)) * 100).toFixed(2));
}

/** ث6: تحويل هامش الربح من سعر البيع (ر) إلى زيادة على التكلفة (ز_ي) */
export function marginToMarkupPercent(marginPercent: number): number {
  const m = Math.max(0, Math.min(95, Number(marginPercent) || 0)) / 100;
  return Number(((m / (1 - m)) * 100).toFixed(2));
}

/** قراءة/حفظ ثوابت المعايرة المحلية لكل ورشة في المتصفح */
const CALIBRATION_STORAGE_KEY = 'alshams_craft_calibrations_v1';

export function getSavedCraftCalibrations(craftId: string): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed?.[craftId] && typeof parsed[craftId] === 'object' ? parsed[craftId] : {};
  } catch {
    return {};
  }
}

export function saveCraftCalibrations(craftId: string, values: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[craftId] = values;
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

export function clearCraftCalibrations(craftId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    delete parsed[craftId];
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

/** حساب تكلفة الخامات الإضافية الحرة من جدول الخامات */
export function sumDynamicExtraMaterials(input: CalculationInput): number {
  const rowsSum = (input.extraMaterials || []).reduce((sum, row) => {
    const cost = Number(row.totalCost) || (Number(row.quantity) * Number(row.unitPrice)) || 0;
    return sum + cost;
  }, 0);
  return Math.round(
    rowsSum +
      (Number(input.curtainRodCost) || 0) +
      (Number(input.cushionCoverCost) || 0) +
      (Number(input.fiberCost) || 0) +
      (Number(input.bagAccessoriesCost) || 0)
  );
}

/**
 * تطبيق القواعد المالية الموحدة المصححة (ث2..ث6) على أي مخرج ورشة
 */
export function buildUnifiedFinancialOutput(
  input: CalculationInput,
  base: {
    totalDirectMaterialsCost: number;
    yarnCost?: number;
    extraMaterialsTotalCost?: number;
    totalWeightKg?: number;
    totalWeightGrams?: number;
    totalYarnLengthMeters?: number;
    baseStrandsCount?: number;
    workingCordsCount?: number;
    singleStrandLengthCm?: number;
    energyCostExtra?: number;
    moldCostExtra?: number;
    craftMetrics?: CalculationOutput['craftMetrics'];
    isOverridden?: CalculationOutput['isOverridden'];
  }
): CalculationOutput {
  const materialsCost = Math.round(Math.max(0, base.totalDirectMaterialsCost || 0));

  // ث2: أجرة اليد (إما من الإدخال المباشر أو من تفصيل الساعات × الأجر × معامل الصعوبة)
  const setupH = Number(input.setupHours) || 0;
  const prodH = Number(input.productionHours) || 0;
  const finH = Number(input.finishingHours) || 0;
  const hasHoursBreakdown = setupH + prodH + finH > 0;
  const difficulty = Math.max(0.5, Number(input.difficultyMultiplier) || 1);
  const hourlyRate = Number(input.hourlyRateOverride) || 50;
  const computedLaborFromHours = hasHoursBreakdown
    ? Math.round((setupH + prodH + finH) * hourlyRate * difficulty)
    : Number(input.laborWage) || 0;
  const laborWage = Math.round(Math.max(0, computedLaborFromHours));
  const customDesignFee = Math.round(Math.max(0, Number(input.customDesignFee) || 0));

  // ث3: الطاقة الكهربائية + الغاز + إهلاك الآلات + إهلاك القوالب + المصاريف الإدارية
  const kwhPrice = Number(input.kwhPrice) || 2.15;
  const machineEnergy = (Number(input.machinePowerKw) || 0) * (Number(input.machineRunHours) || 0) * kwhPrice;
  const energyCost = Math.round(machineEnergy + (Number(input.fuelGasCost) || 0) + (base.energyCostExtra || 0));

  const moldTotal = Number(input.moldTotalCost) || 0;
  const moldUses = Math.max(1, Number(input.moldExpectedUses) || 1);
  const moldCostPerPiece = Math.round((moldTotal > 0 ? moldTotal / moldUses : 0) + (base.moldCostExtra || 0));

  const packagingCost = Math.round(Math.max(0, Number(input.packagingCost) || 0));
  const transitFees = Math.round(Math.max(0, Number(input.transitFees) || 0));
  const adminExpensesShare = Math.round(Math.max(0, Number(input.adminExpensesShare) || 0));

  const toolDepRate = Number(input.toolDepreciationRatePercent) || 0;
  const hourlyToolDep = (Number(input.toolHourlyDepreciation) || 0) * (hasHoursBreakdown ? setupH + prodH + finH : 1);
  const toolDepreciationCost = Math.round(
    hourlyToolDep > 0 ? hourlyToolDep : ((materialsCost + laborWage) * toolDepRate) / 100
  );

  const totalOperationalOverhead =
    adminExpensesShare + energyCost + toolDepreciationCost + moldCostPerPiece + transitFees;

  // ث5: التكلفة الأساسية للوحدة وتكلفة الدفعة والقطعة السليمة
  const totalUnitCost = Math.round(
    materialsCost + laborWage + customDesignFee + totalOperationalOverhead + packagingCost
  );

  const batchQty = Math.max(1, Math.round(Number(input.batchQuantity) || 1));
  const goodQty = Math.max(1, Math.min(batchQty, Math.round(Number(input.goodPiecesCount) || batchQty)));
  const batchSetupCost = Math.round(Math.max(0, Number(input.batchSetupCost) || 0));
  const batchTotalCost = Math.round(totalUnitCost * batchQty + batchSetupCost);
  const goodPieceCost = Math.round(batchTotalCost / goodQty);

  const effectiveCostForPricing = batchQty > 1 ? goodPieceCost : totalUnitCost;

  // ث6: التسعير — الهامش (من سعر البيع) مقابل الزيادة (على التكلفة) مقابل الوضع المعزول التاريخي
  const pricingMode: UnifiedPricingMode = input.pricingMode || 'margin';
  const rawPct = Math.max(0, Number(input.profitMarginPercent) || 0);
  const commPct = Math.max(0, Math.min(60, Number(input.platformCommissionPercent) || 0));
  const discPct = Math.max(0, Math.min(80, Number(input.advertisedDiscountPercent) || 0));
  const vatPct = Math.max(0, Math.min(50, Number(input.vatPercent) || 0));

  let priceBeforeDiscountAndVat = 0;
  let profitAmount = 0;
  let marginPercent = 0;
  let markupPercent = 0;

  if (pricingMode === 'insulated') {
    profitAmount = Math.round(materialsCost * (rawPct / 100));
    const commDenom = Math.max(0.05, 1 - commPct / 100);
    priceBeforeDiscountAndVat = Math.round((effectiveCostForPricing + profitAmount) / commDenom);
    marginPercent = priceBeforeDiscountAndVat > 0 ? Number(((profitAmount / priceBeforeDiscountAndVat) * 100).toFixed(1)) : 0;
    markupPercent = effectiveCostForPricing > 0 ? Number(((profitAmount / effectiveCostForPricing) * 100).toFixed(1)) : 0;
  } else if (pricingMode === 'markup') {
    const u = rawPct / 100;
    const commDenom = Math.max(0.05, 1 - commPct / 100);
    const targetNetPrice = effectiveCostForPricing * (1 + u);
    priceBeforeDiscountAndVat = Math.round(targetNetPrice / commDenom);
    profitAmount = Math.round(effectiveCostForPricing * u);
    markupPercent = Number(rawPct.toFixed(1));
    marginPercent = markupToMarginPercent(rawPct);
  } else {
    // 'margin' (ر من سعر البيع — المعادلة المصححة: P = TC / (1 - r - c))
    const clampedMargin = Math.min(85, rawPct);
    const denom = Math.max(0.05, 1 - clampedMargin / 100 - commPct / 100);
    priceBeforeDiscountAndVat = Math.round(effectiveCostForPricing / denom);
    const commAmount = Math.round(priceBeforeDiscountAndVat * (commPct / 100));
    profitAmount = Math.max(0, priceBeforeDiscountAndVat - effectiveCostForPricing - commAmount);
    marginPercent = clampedMargin;
    markupPercent = marginToMarkupPercent(clampedMargin);
  }

  const platformCommissionAmount = Math.round(priceBeforeDiscountAndVat * (commPct / 100));
  const listPriceBeforeDiscount = Math.round(priceBeforeDiscountAndVat / Math.max(0.1, 1 - discPct / 100));
  const vatAmount = Math.round(priceBeforeDiscountAndVat * (vatPct / 100));
  const finalPriceWithVat = priceBeforeDiscountAndVat + vatAmount;

  return {
    baseStrandsCount: base.baseStrandsCount || 0,
    workingCordsCount: base.workingCordsCount || 0,
    singleStrandLengthCm: base.singleStrandLengthCm || 0,
    totalYarnLengthMeters: base.totalYarnLengthMeters || 0,
    totalWeightKg: Number((base.totalWeightKg || 0).toFixed(3)),
    totalWeightGrams: Math.round(base.totalWeightGrams || 0),
    yarnCost: Math.round(base.yarnCost || 0),
    extraMaterialsTotalCost: Math.round(base.extraMaterialsTotalCost || 0),
    totalDirectMaterialsCost: materialsCost,
    insulatedProfitAmount: profitAmount,
    laborWage: laborWage + customDesignFee,
    packagingCost,
    transitFees,
    adminExpensesShare: adminExpensesShare + energyCost + moldCostPerPiece,
    toolDepreciationRatePercent: toolDepRate,
    toolDepreciationCost,
    finalSellingPrice: priceBeforeDiscountAndVat,
    isOverridden: base.isOverridden || { strands: false, strandLength: false, weight: false },
    unifiedBreakdown: {
      pricingMode,
      energyCost,
      moldCostPerPiece,
      customDesignFee,
      totalOperationalOverhead,
      totalUnitCost,
      batchQuantity: batchQty,
      goodPiecesCount: goodQty,
      batchTotalCost,
      goodPieceCost,
      marginPercent,
      markupPercent,
      platformCommissionPercent: commPct,
      platformCommissionAmount,
      priceBeforeDiscountAndVat,
      listPriceBeforeDiscount,
      vatAmount,
      finalPriceWithVat,
    },
    craftMetrics: base.craftMetrics,
  };
}
