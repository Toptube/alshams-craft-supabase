import {
  CalculationInput,
  CalculationOutput,
  ExtraMaterialRow,
} from '../types';
import { calculateMacrame } from './macrameMath';

export interface CraftEngineResult extends CalculationOutput {}

/**
 * 1. حاسبة كروشيه (Crochet Math Engine)
 * ضبط هندسي متقدم: أبعاد مجسمة 3D مع عمق الجانب، قاعدة صلبة اختيارية، وتوزيع غرز مرجح بمعاملات السحب
 */
export const CROCHET_STITCH_FACTORS: Record<string, { label: string; factor: number }> = {
  sc: { label: 'غرزة حشو (Single Crochet - SC)', factor: 1.0 },
  slst: { label: 'منزلقة (Slip Stitch)', factor: 0.6 },
  hdc: { label: 'نصف عمود (Half Double - HDC)', factor: 1.25 },
  dc: { label: 'عمود بلفة (Double Crochet - DC)', factor: 1.5 },
  tr: { label: 'عمود بلفتين (Treble - TR)', factor: 1.85 },
  puff: { label: 'غرز منتفخة/باف/جراني/ياسمينة (Puff/Bobble)', factor: 2.5 },
};

export function calculateCrochet(input: CalculationInput): CalculationOutput {
  const isCircle = input.shape3D === 'circle' || input.shape3D === 'cylinder';
  const diameter = Number(input.diameterCm) || Number(input.baseDiameterCm) || 20;
  const width = Number(input.widthCm) || 20;
  const length = Number(input.totalLengthCm) || width;
  const height = Number(input.sideHeightCm) || Number(input.crochetWallHeightCm) || 15;
  const depth = Number(input.crochetDepthCm) || 0;
  const pricePerKg = Number(input.pricePerKg) || 160;
  const cordThicknessMm = Number(input.cordThicknessMm) || 4;
  const thicknessFactor = Math.max(0.6, cordThicknessMm / 4);

  // 1. معامل سحب الغرز المرجح (Weighted Stitch Factor)
  let weightedStitchFactor = 1.0;
  const distributions = input.crochetStitchDistributions;
  if (Array.isArray(distributions) && distributions.length > 0) {
    let totalPct = 0;
    let sumWeight = 0;
    distributions.forEach((d) => {
      const pct = Math.max(0, Math.min(100, Number(d.percentage) || 0));
      const factor = CROCHET_STITCH_FACTORS[d.stitchType]?.factor || 1.0;
      sumWeight += (pct / 100) * factor;
      totalPct += pct;
    });
    if (totalPct < 100) {
      // المتبقي يُحسب بغرزة الحشو الأساسية 1.0
      const remainingPct = 100 - totalPct;
      sumWeight += (remainingPct / 100) * 1.0;
    }
    weightedStitchFactor = Math.max(0.6, Math.min(3.0, sumWeight));
  }

  // 2. هندسة الأبعاد ثلاثية الأبعاد (3D Depth) وحساب المساحة والمحيط
  let baseAreaCm2 = 0;
  let basePerimeterCm = 0;
  let wallAreaCm2 = 0;

  if (isCircle) {
    const r = diameter / 2;
    baseAreaCm2 = Math.PI * r * r;
    basePerimeterCm = Math.PI * diameter;
    wallAreaCm2 = basePerimeterCm * height;
  } else {
    if (depth > 0) {
      // شنطة أو بوكس مجسم 3D بوجود عمق/عرض جانب
      baseAreaCm2 = width * depth;
      basePerimeterCm = 2 * (width + depth);
      // مساحة الجدران: واجهتين أمامية وخلفية + جانبان
      wallAreaCm2 = 2 * (width + depth) * height;
    } else {
      // مشغولة مسطحة كشال، مفرش، أو قطعة مستطيلة
      baseAreaCm2 = width * length;
      basePerimeterCm = 2 * (width + length);
      wallAreaCm2 = height > 0 ? basePerimeterCm * height : 0;
    }
  }

  // 3. احتساب القاعدة (اختيارية كقاعدة صلبة خشب/جلد أو نسيج خيط متصل)
  const hasSolidBase = !!input.hasSolidBase;
  const baseType = hasSolidBase ? (input.crochetBaseType || 'wooden') : 'yarn';
  let woodenBaseCost = 0;
  let baseWeightGrams = 0;

  if (hasSolidBase && baseType !== 'yarn') {
    // قاعدة صلبة خشبية أو جلدية مثقوبة ليزر
    woodenBaseCost = Number(input.crochetWoodenBaseCost) || (baseType === 'wooden' ? 35 : 50);
    const holes = Number(input.crochetBaseHolesCount) || Math.round(basePerimeterCm / 1.5);
    const increaseRate = Number(input.crochetBaseIncreasesRate) || 1.5;
    // استهلاك خيط الغرز في الثقوب وحافة التثبيت
    baseWeightGrams = Math.round(holes * increaseRate * 0.85 * weightedStitchFactor * thicknessFactor);
  } else {
    // قطعة نسيجية متصلة بالكامل من خيط الكروشيه (أو مفرش/شال بدون قاعدة صلبة)
    baseWeightGrams = Math.round(baseAreaCm2 * 0.40 * weightedStitchFactor * thicknessFactor);
  }

  // 4. استهلاك خيط جدران المشغولة (أو جسم المشغولة)
  const wallWeightGrams = Math.round(wallAreaCm2 * 0.38 * weightedStitchFactor * thicknessFactor);

  // 5. إجمالي الوزن الصافي مع تطبيق هالك التشغيل 5% برمجياً في الخلفية
  const netWeightGrams = baseWeightGrams + wallWeightGrams;
  const wasteFactor = 1.05; // 5% هالك
  const totalWeightGrams = Math.round(netWeightGrams * wasteFactor);
  const totalWeightKg = Number((totalWeightGrams / 1000).toFixed(2));

  // تقدير طول الخيط بالأمتار
  const totalYarnLengthMeters = Math.round(totalWeightGrams / (3.5 * thicknessFactor));

  // 6. تكلفة الخيط والمواد المباشرة
  const yarnCost = Math.round(totalWeightKg * pricePerKg);

  const dynamicExtraCost = (input.extraMaterials || []).reduce((sum, row) => {
    const cost = Number(row.totalCost) || (Number(row.quantity) * Number(row.unitPrice)) || 0;
    return sum + cost;
  }, 0);

  const extraMaterialsTotalCost = Math.round(
    woodenBaseCost +
    (Number(input.bagAccessoriesCost) || 0) +
    dynamicExtraCost
  );

  const totalDirectMaterialsCost = yarnCost + extraMaterialsTotalCost;

  // 7. هامش الربح المعزول على الخامات والتسعير النهائي
  const profitMarginPercent = Number(input.profitMarginPercent) || 80;
  const insulatedProfitAmount = Math.round(totalDirectMaterialsCost * (profitMarginPercent / 100));

  const laborWage = Math.round(Number(input.laborWage) || 90);
  const packagingCost = Math.round(Number(input.packagingCost) || 20);
  const transitFees = Math.round(Number(input.transitFees) || 0);
  const adminExpensesShare = Math.round(Number(input.adminExpensesShare) || 25);

  const finalSellingPrice = Math.round(
    totalDirectMaterialsCost +
    insulatedProfitAmount +
    laborWage +
    packagingCost +
    transitFees +
    adminExpensesShare
  );

  return {
    baseStrandsCount: hasSolidBase ? (input.crochetBaseHolesCount || Math.round(basePerimeterCm / 1.5)) : 1,
    workingCordsCount: Math.round(basePerimeterCm),
    singleStrandLengthCm: Math.round(totalYarnLengthMeters * 100),
    totalYarnLengthMeters,
    totalWeightKg,
    totalWeightGrams,
    yarnCost,
    extraMaterialsTotalCost,
    totalDirectMaterialsCost,
    insulatedProfitAmount,
    laborWage,
    packagingCost,
    transitFees,
    adminExpensesShare,
    finalSellingPrice,
    isOverridden: {
      strands: false,
      strandLength: false,
      weight: false,
    },
    craftMetrics: {
      craftId: 'crochet',
      craftNameAr: 'كروشيه منزلي ومشغولات',
      baseWeightGrams,
      wallWeightGrams,
      totalYarnGrams: totalWeightGrams,
      woodenBaseCost,
      wasteFactorPercent: 5,
      wasteAmount: Math.round(netWeightGrams * 0.05),
      weightedStitchFactor: Math.round(weightedStitchFactor * 100) / 100,
      depthCm: depth,
      hasSolidBase,
    },
  };
}

/**
 * 2. حاسبة حبال الزجزاج وخياطة الماكينة (Woven Ropes / Zigzag Machine Math Engine)
 * ضبط هندسي فيزيائي دقيق:
 * - طبيعة المشغولة: مسطحة (Flat)، مجسمة (3D)، أو كلاتش/محفظة مسطحة
 * - شكل القاعدة: دائرية، مستطيلة/مربعة، أو بيضاوية بمعادلة رامانوجان الدقيقة
 * - المساحة السطحية المتكاملة (قاعدة + جدران) لحساب أمتار الحبل الصافية (Area / Diameter)
 * - خامات السوق المصري: حبل قطن زجزاج محشي أو بوليستر، خيط مكوك 3.6م/م، وبطانة وسوست وإكسسوارات
 */
export function calculateZigzag(input: CalculationInput): CalculationOutput {
  // 1. طبيعة المشغولة (Piece Nature)
  const pieceType = input.zigzagPieceType || (input.sideHeightCm && input.sideHeightCm > 0 ? '3d' : 'flat');
  const is3D = pieceType === '3d';
  const isClutch = pieceType === 'clutch';

  // 2. شكل القاعدة والهندسة (Base Shape & Geometry)
  // Base shape fallback
  let baseShape = input.zigzagBaseShape || input.zigzagBaseType;
  if (!baseShape) {
    if (input.shape3D === 'circle') baseShape = 'circle';
    else if (input.shape3D === 'square' || input.shape3D === 'rectangle') baseShape = 'rectangle';
    else baseShape = 'oval';
  }

  const diameterCm = Number(input.diameterCm) || Number(input.baseDiameterCm) || 25;
  const widthCm = Number(input.widthCm) || 20;
  const lengthCm = Number(input.totalLengthCm) || 30;
  // الارتفاع: إجباري إذا كانت 3D، ويلغى تماماً إذا كانت مسطحة أو كلاتش
  const sideHeightCm = is3D ? Math.max(1, Number(input.sideHeightCm) || 12) : 0;

  // 3. حساب مساحة القاعدة ومحيطها الفيزيائي الدقيق
  let baseAreaCm2 = 0;
  let basePerimeterCm = 0;

  if (baseShape === 'circle') {
    const r = diameterCm / 2;
    baseAreaCm2 = Math.PI * r * r;
    basePerimeterCm = Math.PI * diameterCm;
  } else if (baseShape === 'rectangle') {
    baseAreaCm2 = widthCm * lengthCm;
    basePerimeterCm = 2 * (widthCm + lengthCm);
  } else {
    // بيضاوية (Oval) - أنصاف الأقطار a و b
    const a = Math.max(0.1, lengthCm / 2);
    const b = Math.max(0.1, widthCm / 2);
    // مساحة البيضاوي: π × a × b
    baseAreaCm2 = Math.PI * a * b;
    // محيط البيضاوي الهندسي الدقيق بمعادلة رامانوجان (Ramanujan):
    // P ≈ π [ 3(a + b) - √((3a + b)(a + 3b)) ]
    basePerimeterCm = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  }

  // 4. مساحة الجدران الرأسية وإجمالي مساحة السطح
  // مساحة الجدران = المحيط × الارتفاع (صفر للمسطح والكلاتش)
  const wallAreaCm2 = is3D ? basePerimeterCm * sideHeightCm : 0;
  const totalSurfaceAreaCm2 = baseAreaCm2 + wallAreaCm2;

  // 5. قطر الحبل والأمتار الصافية بالمعادلة الفيزيائية: L_raw = Total Area / Diameter
  const ropeDiameterMm = Number(input.zigzagRopeDiameterMm) || 8;
  const ropeDiameterCm = ropeDiameterMm / 10;
  // أمتار الحبل من المساحة السطحية = مساحة سم² ÷ (قطر سم × 100)
  const surfaceRopeMeters = totalSurfaceAreaCm2 / (ropeDiameterCm * 100);

  // أمتار حبل الأيادي (إن وجدت)
  const handlesCount = isClutch ? 1 : (Number(input.zigzagHandlesCount) ?? (is3D ? 2 : 0));
  const handleLengthCm = Number(input.zigzagHandleLengthCm) || 35;
  const handlesRopeMeters = (handlesCount * handleLengthCm) / 100;

  // أمتار حبل القاعدة المنفردة وجدران المشغولة للتقارير
  const baseRopeMeters = baseAreaCm2 / (ropeDiameterCm * 100);
  const wallRopeMeters = wallAreaCm2 / (ropeDiameterCm * 100);

  // 6. معامل اللف والدوران والانحناءات (+8%) + هالك الحياكة والتشغيل (+7%)
  const rawRopeMeters = surfaceRopeMeters + handlesRopeMeters;
  const netWithCurves = rawRopeMeters * 1.08; // 8% معامل دوران وانحناء الحبل
  const wasteFactor = 1.07; // 7% هالك تشغيل وتشذيب
  const totalRopeMeters = Number((netWithCurves * wasteFactor).toFixed(1));

  // 7. وزن الحبل بالكيلوجرام بناءً على الوزن الخطي
  // (حبل قطن زجزاج محشي 5-8 مم يزن 45-55 جم/م، بينما البوليستر أخف بنسبة 25%)
  const ropeType = input.zigzagRopeType || 'cotton_padded';
  const isPolyester = ropeType === 'polyester';
  // معادلة الوزن الخطي الدقيق للقطن المحشي (جم / متر)
  const cottonLinearGramsPerMeter = Math.pow(ropeDiameterMm, 1.82) * 1.22;
  const linearGramsPerMeter = isPolyester ? cottonLinearGramsPerMeter * 0.72 : cottonLinearGramsPerMeter;
  const totalWeightGrams = Math.round(totalRopeMeters * linearGramsPerMeter);
  const totalWeightKg = Number((totalWeightGrams / 1000).toFixed(2));

  // 8. استهلاك خيط المكوك والماكينة (كل متر حبل يستهلك 3.6 أمتار خيط زجزاج)
  const sewingThreadMeters = Math.round(totalRopeMeters * 3.6);
  const sewingThreadBobbins = Number((sewingThreadMeters / 1000).toFixed(2));
  const sewingThreadCost = Math.round(sewingThreadBobbins * 25); // بكرة خيط مكوك متين 1000م بـ 25 ج

  // 9. تكلفة الحبل الأساسي
  const pricePerKg = Number(input.pricePerKg) || (isPolyester ? 140 : 165);
  const ropeCost = Math.round(totalWeightKg * pricePerKg);

  // 10. الإكسسوارات والخامات التكميلية (بطانة، سوستة، أيدي جلد، حلقات ميتاليك)
  const hasLining = input.zigzagHasLining !== undefined ? input.zigzagHasLining : isClutch;
  const hasZipper = input.zigzagHasZipper !== undefined ? input.zigzagHasZipper : isClutch;
  const hasHandlesAccessories = input.zigzagHasHandles !== undefined ? input.zigzagHasHandles : (isClutch || handlesCount > 0);

  // تكلفة البطانة (قماش ستان / سالسا / دك حسب مساحة المشغولة)
  let liningCost = 0;
  if (hasLining) {
    liningCost = Number(input.zigzagLiningCost) || Math.round((totalSurfaceAreaCm2 / 10000) * 85 + 20);
  }

  // تكلفة السوستة والجرارات
  let zipperCost = 0;
  if (hasZipper) {
    zipperCost = Number(input.zigzagZipperCost) || (isClutch ? 20 : 25);
  }

  // تكلفة الأيدي الجلد والحلقات الميتاليك
  let accessoriesCost = 0;
  if (hasHandlesAccessories) {
    accessoriesCost = Number(input.zigzagAccessoriesCost) || (Number(input.bagAccessoriesCost) || (isClutch ? 45 : 30));
  }

  // الخامات الإضافية الديناميكية
  const dynamicExtraCost = (input.extraMaterials || []).reduce((sum, row) => {
    const cost = Number(row.totalCost) || (Number(row.quantity) * Number(row.unitPrice)) || 0;
    return sum + cost;
  }, 0);

  const extraMaterialsTotalCost = Math.round(
    sewingThreadCost +
    liningCost +
    zipperCost +
    accessoriesCost +
    dynamicExtraCost
  );

  const totalDirectMaterialsCost = ropeCost + extraMaterialsTotalCost;

  // 11. هامش الربح المعزول والتسعير النهائي
  const profitMarginPercent = Number(input.profitMarginPercent) || 75;
  const insulatedProfitAmount = Math.round(totalDirectMaterialsCost * (profitMarginPercent / 100));

  const laborWage = Math.round(Number(input.laborWage) || (isClutch ? 95 : 85));
  const packagingCost = Math.round(Number(input.packagingCost) || 25);
  const transitFees = Math.round(Number(input.transitFees) || 0);
  const adminExpensesShare = Math.round(Number(input.adminExpensesShare) || 20);

  const finalSellingPrice = Math.round(
    totalDirectMaterialsCost +
    insulatedProfitAmount +
    laborWage +
    packagingCost +
    transitFees +
    adminExpensesShare
  );

  return {
    baseStrandsCount: 1,
    workingCordsCount: is3D ? Math.round(sideHeightCm / ropeDiameterCm) : 1,
    singleStrandLengthCm: Math.round(totalRopeMeters * 100),
    totalYarnLengthMeters: Math.round(totalRopeMeters),
    totalWeightKg,
    totalWeightGrams,
    yarnCost: ropeCost,
    extraMaterialsTotalCost,
    totalDirectMaterialsCost,
    insulatedProfitAmount,
    laborWage,
    packagingCost,
    transitFees,
    adminExpensesShare,
    finalSellingPrice,
    isOverridden: {
      strands: false,
      strandLength: false,
      weight: false,
    },
    craftMetrics: {
      craftId: 'zigzag',
      craftNameAr: 'حبال الزجزاج وخياطة الماكينة',
      pieceType,
      baseShape,
      baseAreaCm2: Math.round(baseAreaCm2),
      wallAreaCm2: Math.round(wallAreaCm2),
      totalSurfaceAreaCm2: Math.round(totalSurfaceAreaCm2),
      perimeterCm: Math.round(basePerimeterCm),
      totalRopeMeters,
      baseRopeMeters: Number(baseRopeMeters.toFixed(1)),
      wallRopeMeters: Number(wallRopeMeters.toFixed(1)),
      handlesRopeMeters: Number(handlesRopeMeters.toFixed(1)),
      ropeWeightKg: totalWeightKg,
      ropeType: isPolyester ? 'حبل زجزاج بوليستر' : 'حبل قطن زجزاج محشي',
      sewingThreadMeters,
      sewingThreadBobbins,
      liningCost,
      zipperCost,
      accessoriesCost,
      wasteFactorPercent: 7,
      wasteAmount: Number((rawRopeMeters * 0.07).toFixed(1)),
    },
  };
}

/**
 * 3. حاسبة الكليم والنسيج اليدوي (Kilim & Tapestry Math Engine)
 * تحسب خيوط السداء (EPI)، فاقد النول 40 سم، انكماش الشد 10%، صوف اللحمة 1.4 كجم/م²، وهالك 15%
 */
export function calculateKilim(input: CalculationInput): CalculationOutput {
  const widthCm = Number(input.widthCm) || 80;
  const lengthCm = Number(input.totalLengthCm) || 120;
  const epiDensity = Number(input.kilimEpiDensity) || 4; // 4 خيوط سداء لكل سنتيمتر
  const loomWasteCm = Number(input.kilimLoomWasteCm) || 40; // فاقد ربط النول
  const shrinkageFactor = Number(input.kilimShrinkageFactor) || 0.10; // 10% انكماش شد
  const weftWoolKgPerSqM = Number(input.kilimWeftWoolKgPerSqM) || 1.4; // 1.4 كجم صوف لكل متر مربع
  const pricePerKg = Number(input.pricePerKg) || 220; // سعر صوف الكليم

  // 1. حساب السداء (Warp)
  const warpThreadsCount = Math.round(widthCm * epiDensity);
  const singleWarpLengthCm = Math.round((lengthCm + loomWasteCm) * (1 + shrinkageFactor));
  const totalWarpLengthMeters = Math.round((warpThreadsCount * singleWarpLengthCm) / 100);

  // وزن خيوط قطن السداء (المتر ~ 2.4 جرام)
  const warpWeightKg = Number(((totalWarpLengthMeters * 2.4) / 1000).toFixed(2));
  const warpCost = Math.round(warpWeightKg * 180); // سعر قطن السداء ~ 180 ج/كجم

  // 2. حساب اللحمة الصوف (Weft)
  const netAreaSqM = (widthCm * lengthCm) / 10000;
  const netWoolKg = netAreaSqM * weftWoolKgPerSqM;
  const woolWasteFactor = 1.15; // 15% هالك عقد وتغيير ألوان
  const weftWoolWeightKg = Number((netWoolKg * woolWasteFactor).toFixed(2));
  const woolCost = Math.round(weftWoolWeightKg * pricePerKg);

  // إجمالي الأوزان والتكاليف
  const totalWeightKg = Number((warpWeightKg + weftWoolWeightKg).toFixed(2));
  const totalWeightGrams = Math.round(totalWeightKg * 1000);
  const totalDirectYarnCost = woolCost + warpCost;

  const dynamicExtraCost = (input.extraMaterials || []).reduce((sum, row) => {
    const cost = Number(row.totalCost) || (Number(row.quantity) * Number(row.unitPrice)) || 0;
    return sum + cost;
  }, 0);

  const extraMaterialsTotalCost = Math.round(
    (Number(input.fringeLengthCm) ? 30 : 0) +
    dynamicExtraCost
  );

  const totalDirectMaterialsCost = totalDirectYarnCost + extraMaterialsTotalCost;

  const profitMarginPercent = Number(input.profitMarginPercent) || 85;
  const insulatedProfitAmount = Math.round(totalDirectMaterialsCost * (profitMarginPercent / 100));

  const laborWage = Math.round(Number(input.laborWage) || 250);
  const packagingCost = Math.round(Number(input.packagingCost) || 35);
  const transitFees = Math.round(Number(input.transitFees) || 0);
  const adminExpensesShare = Math.round(Number(input.adminExpensesShare) || 40);

  const finalSellingPrice = Math.round(
    totalDirectMaterialsCost +
    insulatedProfitAmount +
    laborWage +
    packagingCost +
    transitFees +
    adminExpensesShare
  );

  return {
    baseStrandsCount: warpThreadsCount,
    workingCordsCount: warpThreadsCount,
    singleStrandLengthCm: singleWarpLengthCm,
    totalYarnLengthMeters: totalWarpLengthMeters,
    totalWeightKg,
    totalWeightGrams,
    yarnCost: totalDirectYarnCost,
    extraMaterialsTotalCost,
    totalDirectMaterialsCost,
    insulatedProfitAmount,
    laborWage,
    packagingCost,
    transitFees,
    adminExpensesShare,
    finalSellingPrice,
    isOverridden: {
      strands: false,
      strandLength: false,
      weight: false,
    },
    craftMetrics: {
      craftId: 'kilim',
      craftNameAr: 'الكليم والنسيج اليدوي',
      warpThreadsCount,
      totalWarpLengthMeters,
      warpWeightKg,
      weftWoolWeightKg,
      totalWoolWeightKg: totalWeightKg,
      wasteFactorPercent: 15,
      wasteAmount: Number((netWoolKg * 0.15).toFixed(2)),
    },
  };
}

/**
 * 4. حاسبة البانش نيدل / الإبرة الشرقية (Punch Needle Math Engine)
 * قماش الكانفاه المخرم أو الدك القطني المصري (+10 سم حواف للطارة)، طول خيط الصوف بناءً على ارتفاع الغرزة، غراء اللاتكس 250 جم/م²، وهالك 5%
 */
export function calculatePunchNeedle(input: CalculationInput): CalculationOutput {
  const widthCm = Number(input.widthCm) || 40;
  const heightCm = Number(input.sideHeightCm) || Number(input.totalLengthCm) || 40;
  const marginCm = Number(input.punchMonksClothMarginCm) || 10;
  const loopHeightMm = Number(input.punchLoopHeightMm) || 5;
  const latexGramsPerSqM = Number(input.punchLatexGramsPerSqM) || 250;
  const pricePerKg = Number(input.pricePerKg) || 190;

  // 1. مساحة وتكلفة قماش التطريز المصري (مع زيادة 10 سم من كل جانب للشد على الطارة)
  // أنواع الأقمشة الدارجة في السوق المصري: كانفاه مخرم، دك قطن مصري، كتان تطريز
  const cutWidthCm = widthCm + 2 * marginCm;
  const cutHeightCm = heightCm + 2 * marginCm;
  const fabricAreaSqM = Number(((cutWidthCm * cutHeightCm) / 10000).toFixed(2));

  const fabricType = input.punchFabricType || 'cotton_canvas';
  const fabricDefaultPrice =
    fabricType === 'duck_fabric' ? 110 : fabricType === 'linen' ? 160 : 130;
  const fabricPricePerSqM = Number(input.punchFabricCost) || Number(input.punchMonksClothCost) || fabricDefaultPrice;
  const fabricTotalCost = Math.round(fabricAreaSqM * fabricPricePerSqM);

  const fabricTypeLabels: Record<string, string> = {
    cotton_canvas: 'قماش كانفاه مخرم عالي الجودة',
    duck_fabric: 'قماش دك قطن مصري متين',
    linen: 'قماش كتان مخصص للتطريز',
    monks_cloth: 'قماش كانفاه مخرم أصلي',
  };
  const fabricTypeName = fabricTypeLabels[fabricType] || 'قماش كانفاه مخرم';

  // 2. مساحة التصميم واستهلاك الخيط
  const designAreaCm2 = widthCm * heightCm;
  const designAreaSqM = designAreaCm2 / 10000;

  // استهلاك الخيط: 30 متر لكل 10×10 سم (100 سم²) عند غرزة 5 مم
  const loopFactor = loopHeightMm / 5;
  const netYarnLengthMeters = Math.round((designAreaCm2 / 100) * 30 * loopFactor);
  const yarnWasteFactor = 1.05; // 5% هالك
  const totalYarnLengthMeters = Math.round(netYarnLengthMeters * yarnWasteFactor);

  // وزن صوف البانش نيدل (~ 0.95 كجم لكل متر مربع)
  const totalWeightKg = Number((designAreaSqM * 0.95 * yarnWasteFactor).toFixed(2));
  const totalWeightGrams = Math.round(totalWeightKg * 1000);
  const yarnCost = Math.round(totalWeightKg * pricePerKg);

  // 3. غراء اللاتكس السائل لتثبيت الظهر (250 جم لكل م² تصميم)
  const latexGlueKg = Number(((designAreaSqM * latexGramsPerSqM) / 1000).toFixed(2));
  const latexCost = Math.round(latexGlueKg * 120); // 120 ج/كجم لاتكس سائل نقي

  const dynamicExtraCost = (input.extraMaterials || []).reduce((sum, row) => {
    const cost = Number(row.totalCost) || (Number(row.quantity) * Number(row.unitPrice)) || 0;
    return sum + cost;
  }, 0);

  const extraMaterialsTotalCost = Math.round(
    fabricTotalCost +
    latexCost +
    dynamicExtraCost
  );

  const totalDirectMaterialsCost = yarnCost + extraMaterialsTotalCost;

  const profitMarginPercent = Number(input.profitMarginPercent) || 80;
  const insulatedProfitAmount = Math.round(totalDirectMaterialsCost * (profitMarginPercent / 100));

  const laborWage = Math.round(Number(input.laborWage) || 120);
  const packagingCost = Math.round(Number(input.packagingCost) || 25);
  const transitFees = Math.round(Number(input.transitFees) || 0);
  const adminExpensesShare = Math.round(Number(input.adminExpensesShare) || 25);

  const finalSellingPrice = Math.round(
    totalDirectMaterialsCost +
    insulatedProfitAmount +
    laborWage +
    packagingCost +
    transitFees +
    adminExpensesShare
  );

  return {
    baseStrandsCount: 1,
    workingCordsCount: Math.round(totalYarnLengthMeters / 10),
    singleStrandLengthCm: totalYarnLengthMeters * 100,
    totalYarnLengthMeters,
    totalWeightKg,
    totalWeightGrams,
    yarnCost,
    extraMaterialsTotalCost,
    totalDirectMaterialsCost,
    insulatedProfitAmount,
    laborWage,
    packagingCost,
    transitFees,
    adminExpensesShare,
    finalSellingPrice,
    isOverridden: {
      strands: false,
      strandLength: false,
      weight: false,
    },
    craftMetrics: {
      craftId: 'punch_needle',
      craftNameAr: 'البانش نيدل / الإبرة الشرقية',
      fabricAreaSqM,
      fabricCost: fabricTotalCost,
      fabricTypeName,
      monksClothAreaSqM: fabricAreaSqM,
      monksClothCost: fabricTotalCost,
      punchYarnLengthMeters: totalYarnLengthMeters,
      punchYarnWeightKg: totalWeightKg,
      latexGlueKg,
      latexCost,
      wasteFactorPercent: 5,
      wasteAmount: Math.round(netYarnLengthMeters * 0.05),
    },
  };
}

/**
 * 5. حاسبة مسدس التافت وصناعة السجاد (Tufting Gun Math Engine)
 * قماش التافت الأساسي وقماش الظهر المقاوم للانزلاق (+0.20م زيادة للفريم)، استهلاك خيط الوبرة 2.1 كجم/م²، غراء اللاتكس 1.1 كجم/م²، وهالك 10%
 */
export function calculateTufting(input: CalculationInput): CalculationOutput {
  const widthM = (Number(input.widthCm) || 70) / 100;
  const lengthM = (Number(input.totalLengthCm) || 90) / 100;
  const netAreaSqM = Number((widthM * lengthM).toFixed(2));
  const pileType = input.tuftingPileType || 'cut';
  const pricePerKg = Number(input.pricePerKg) || 195;

  // 1. قماش التافت الأساسي (زيادة 20 سم من كل طرف للشد على الفريم)
  const frameMarginM = Number(input.tuftingPrimaryClothMarginM) || 0.20;
  const primaryClothWidthM = widthM + 2 * frameMarginM;
  const primaryClothLengthM = lengthM + 2 * frameMarginM;
  const primaryClothAreaSqM = Number((primaryClothWidthM * primaryClothLengthM).toFixed(2));
  const primaryClothCost = Math.round(primaryClothAreaSqM * 115); // 115 ج/م² قماش تافت مسطر

  // 2. قماش الظهر المقاوم للانزلاق (شاش تافت قطني مانع للانزلاق)
  const backingClothAreaSqM = Number((netAreaSqM * 1.10).toFixed(2));
  const backingClothCost = Math.round(backingClothAreaSqM * 80); // 80 ج/م²

  // 3. خيوط الوبرة (الأكريليك أو الصوف)
  // Cut pile = 2.1 كجم/م²، Loop pile = 1.8 كجم/م²
  const yarnPerSqM = pileType === 'loop' ? 1.8 : 2.1;
  const netYarnWeightKg = netAreaSqM * yarnPerSqM;
  const yarnWasteFactor = 1.10; // 10% هالك نحت وقص الحواف
  const tuftingYarnWeightKg = Number((netYarnWeightKg * yarnWasteFactor).toFixed(2));
  const totalWeightGrams = Math.round(tuftingYarnWeightKg * 1000);
  const yarnCost = Math.round(tuftingYarnWeightKg * pricePerKg);

  // 4. غراء اللاتكس السجاد (1.1 كجم لكل م²)
  const latexPerSqM = Number(input.tuftingLatexGlueKgPerSqM) || 1.1;
  const tuftingLatexKg = Number((netAreaSqM * latexPerSqM).toFixed(2));
  const tuftingLatexCost = Math.round(tuftingLatexKg * 95); // 95 ج/كجم لاتكس سجاد

  // 5. شريط التنسيل وحواف السجاد (Twill Tape)
  const perimeterM = 2 * (widthM + lengthM);
  const twillTapeCost = Math.round(perimeterM * 15); // 15 ج/متر

  const dynamicExtraCost = (input.extraMaterials || []).reduce((sum, row) => {
    const cost = Number(row.totalCost) || (Number(row.quantity) * Number(row.unitPrice)) || 0;
    return sum + cost;
  }, 0);

  const extraMaterialsTotalCost = Math.round(
    primaryClothCost +
    backingClothCost +
    tuftingLatexCost +
    twillTapeCost +
    dynamicExtraCost
  );

  const totalDirectMaterialsCost = yarnCost + extraMaterialsTotalCost;

  const profitMarginPercent = Number(input.profitMarginPercent) || 85;
  const insulatedProfitAmount = Math.round(totalDirectMaterialsCost * (profitMarginPercent / 100));

  const laborWage = Math.round(Number(input.laborWage) || 220); // تشمل الضرب والنحت بالمقص وماكينة التنعيم
  const packagingCost = Math.round(Number(input.packagingCost) || 40);
  const transitFees = Math.round(Number(input.transitFees) || 0);
  const adminExpensesShare = Math.round(Number(input.adminExpensesShare) || 35);

  const finalSellingPrice = Math.round(
    totalDirectMaterialsCost +
    insulatedProfitAmount +
    laborWage +
    packagingCost +
    transitFees +
    adminExpensesShare
  );

  return {
    baseStrandsCount: 1,
    workingCordsCount: Math.round(perimeterM * 10),
    singleStrandLengthCm: Math.round(perimeterM * 100),
    totalYarnLengthMeters: Math.round(tuftingYarnWeightKg * 300), // تقدير أمتار الخيط
    totalWeightKg: tuftingYarnWeightKg,
    totalWeightGrams,
    yarnCost,
    extraMaterialsTotalCost,
    totalDirectMaterialsCost,
    insulatedProfitAmount,
    laborWage,
    packagingCost,
    transitFees,
    adminExpensesShare,
    finalSellingPrice,
    isOverridden: {
      strands: false,
      strandLength: false,
      weight: false,
    },
    craftMetrics: {
      craftId: 'tufting',
      craftNameAr: 'مسدس التافت وصناعة السجاد',
      primaryClothAreaSqM,
      backingClothAreaSqM,
      clothTotalCost: primaryClothCost + backingClothCost,
      tuftingYarnWeightKg,
      tuftingLatexKg,
      tuftingLatexCost,
      wasteFactorPercent: 10,
      wasteAmount: Number((netYarnWeightKg * 0.10).toFixed(2)),
    },
  };
}

/**
 * Dispatcher الرئيسي لقسم [الحبال والنسيج]:
 * يوجّه المدخلات تلقائياً إلى المحرك الرياضي المتخصص
 */
export function calculateTextileCraft(craftId: string, input: CalculationInput): CalculationOutput {
  const normId = (craftId || '').toLowerCase().trim();

  switch (normId) {
    case 'macrame':
      return calculateMacrame(input);

    case 'crochet':
      return calculateCrochet(input);

    case 'zigzag':
      return calculateZigzag(input);

    case 'kilim':
    case 'kelim':
      return calculateKilim(input);

    case 'punch_needle':
      return calculatePunchNeedle(input);

    case 'tufting':
    case 'tufting_gun':
      return calculateTufting(input);

    default:
      return calculateMacrame(input);
  }
}
