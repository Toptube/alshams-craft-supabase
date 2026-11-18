import { CalculationInput } from '../types';
import {
  applyWasteOnNet,
  lossFractionToWasteOnNet,
  sumDynamicExtraMaterials,
  WorkshopMathResult,
  WorkshopSpec,
  yieldToWasteOnNet,
} from './craftUnifiedFinancials';

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function makeWaste(
  netCost: number,
  wastePct: number,
  extraCost: number,
  netLabel: string,
  grossLabel: string,
  wasteMode: WorkshopMathResult['wasteMode'] = 'on_net',
  details: WorkshopMathResult['detailedLines'] = [],
  extras: Partial<WorkshopMathResult> = {}
): WorkshopMathResult {
  const safeExtra = Math.round(extraCost);
  const totalMaterials = Math.round(netCost + safeExtra);
  return {
    totalDirectMaterialsCost: totalMaterials,
    yarnCost: Math.round(netCost),
    extraMaterialsTotalCost: safeExtra,
    totalWeightKg: Number((extras.totalWeightKg || 0).toFixed(3)),
    totalWeightGrams: Math.round(extras.totalWeightGrams || 0),
    totalLengthMeters: extras.totalLengthMeters,
    energyCostExtra: extras.energyCostExtra || 0,
    moldCostExtra: extras.moldCostExtra || 0,
    wasteMode,
    wasteFactorPercent: Number(wastePct.toFixed(2)),
    wasteAmount: Number((extras.wasteAmount || 0).toFixed(2)),
    netQtyLabel: netLabel,
    grossQtyLabel: grossLabel,
    volumeCm3: extras.volumeCm3,
    areaCm2: extras.areaCm2,
    detailedLines: details,
  };
}

export const WORKSHOP_SPECS_PART_1: Record<string, WorkshopSpec> = {
  // =========================================================================
  // القسم 1: الحبال والنسيج (الورش المكملة للـ 6 محركات النصية الأساسية)
  // =========================================================================
  aqqada: {
    craftId: 'aqqada',
    mainSectionId: 'ropes_textiles',
    nameAr: 'العقادة والشرابات والحبال الزخرفية',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [45, 70],
    formulaSummaryAr: 'ط_خام = ط_نهائي × ل_برم | الشرابة: ن_لفات × 2 × ط_شرابة + خيط الربط',
    fields: [
      { key: 'finalCordMeters', labelAr: 'طول الحبل النهائي المطلوب', unitAr: 'م', type: 'number', defaultValue: 5, min: 0 },
      { key: 'twistFactor', labelAr: 'معامل البرم (ل_برم)', type: 'number', defaultValue: 1.35, min: 1, step: 0.05, isCalibration: true, hintAr: 'معامل مستقل لكل قطر وعدد جدلات' },
      { key: 'tasselWrapsCount', labelAr: 'عدد لفات الشرابات (ن_لفات)', type: 'number', defaultValue: 30, min: 0 },
      { key: 'tasselLengthCm', labelAr: 'طول الشرابة الواحدة', unitAr: 'سم', type: 'number', defaultValue: 18, min: 0 },
      { key: 'tasselCount', labelAr: 'عدد الشرابات', type: 'number', defaultValue: 2, min: 0 },
      { key: 'tieMeters', labelAr: 'خيط الربط والتقفيل', unitAr: 'م', type: 'number', defaultValue: 1.5, min: 0 },
      { key: 'weightPerMeterGrams', labelAr: 'وزن المتر المرجعي', unitAr: 'جم/م', type: 'number', defaultValue: 12, min: 0.5, isCalibration: true },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 50 },
      { key: 'pricePerKg', labelAr: 'سعر الكيلو للخيط', unitAr: 'ج/كجم', type: 'number', defaultValue: 180, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const kTwist = num(cal.twistFactor ?? p.twistFactor, 1.35);
      const wPerM = num(cal.weightPerMeterGrams ?? p.weightPerMeterGrams, 12);
      const cordRawM = num(p.finalCordMeters, 5) * kTwist;
      const tasselM = (num(p.tasselWrapsCount, 30) * 2 * (num(p.tasselLengthCm, 18) / 100) * num(p.tasselCount, 2)) + num(p.tieMeters, 1.5);
      const netM = cordRawM + tasselM;
      const wastePct = num(p.wastePercent, 5);
      const { gross: grossM, waste } = applyWasteOnNet(netM, wastePct);
      const grams = grossM * wPerM;
      const kg = grams / 1000;
      const pricePerKg = num(p.pricePerKg, num(input.pricePerKg, 180));
      const yarnCost = kg * pricePerKg;
      const extraCost = sumDynamicExtraMaterials(input);
      return makeWaste(
        yarnCost,
        wastePct,
        extraCost,
        `${netM.toFixed(1)} م (${(netM * wPerM).toFixed(0)} جم)`,
        `${grossM.toFixed(1)} م (${grams.toFixed(0)} جم)`,
        'on_net',
        [
          { label: 'خيط الحبل المبروم', value: `${cordRawM.toFixed(1)} م` },
          { label: 'خيط الشرابات والتقفيل', value: `${tasselM.toFixed(1)} م` },
          { label: 'الصافي ← المنصرف (+هالك)', value: `${netM.toFixed(1)} م ← ${grossM.toFixed(1)} م` },
        ],
        { totalWeightKg: kg, totalWeightGrams: grams, totalLengthMeters: Math.round(grossM), wasteAmount: waste * wPerM }
      );
    },
  },

  spinning: {
    craftId: 'spinning',
    mainSectionId: 'ropes_textiles',
    nameAr: 'الغزل اليدوي',
    defaultWastePercent: 13.64,
    isYieldOrNestingBased: true,
    indicativeHourlyRateRange: [35, 55],
    formulaSummaryAr: 'وزن الألياف الخام = الوزن النهائي ÷ (1 − ف) | طول الخيط (م) = الوزن × 1000 ÷ Tex',
    fields: [
      { key: 'finalYarnGrams', labelAr: 'الوزن النهائي المطلوب للخيط', unitAr: 'جم', type: 'number', defaultValue: 250, min: 1 },
      { key: 'fiberLossPercent', labelAr: 'نسبة الفقد من الإجمالي (ف)', unitAr: '%', type: 'number', defaultValue: 12, min: 0, max: 60, hintAr: 'يُحوّل تلقائياً لهالك مكافئ على الصافي w = f/(1-f)' },
      { key: 'texNumber', labelAr: 'رقم التكس (وزن 1000م بالجم)', unitAr: 'Tex', type: 'number', defaultValue: 600, min: 10, isCalibration: true },
      { key: 'fiberPricePerKg', labelAr: 'سعر كيلو الألياف الخام', unitAr: 'ج/كجم', type: 'number', defaultValue: 280, min: 0 },
      { key: 'washingDosePerKgCost', labelAr: 'تكلفة الغسيل والتليين لكل كجم ألياف', unitAr: 'ج/كجم', type: 'number', defaultValue: 25, min: 0, isCalibration: true },
    ],
    calculate: (input, p, cal) => {
      const mFinal = num(p.finalYarnGrams, 250);
      const lossPct = Math.min(80, Math.max(0, num(p.fiberLossPercent, 12)));
      const equivWastePct = lossFractionToWasteOnNet(lossPct);
      const f = lossPct / 100;
      const mFiber = mFinal / Math.max(0.1, 1 - f);
      const tex = num(cal.texNumber ?? p.texNumber, 600);
      const lengthM = (mFinal * 1000) / Math.max(1, tex);
      const fiberCost = (mFiber / 1000) * num(p.fiberPricePerKg, 280);
      const washCost = (mFiber / 1000) * num(cal.washingDosePerKgCost ?? p.washingDosePerKgCost, 25);
      const extraCost = sumDynamicExtraMaterials(input) + washCost;
      return makeWaste(
        fiberCost,
        equivWastePct,
        extraCost,
        `${mFinal.toFixed(0)} جم ناتج`,
        `${mFiber.toFixed(0)} جم ألياف خام`,
        'yield_factor',
        [
          { label: 'نسبة الفقد (ف) ⇐ هالك مكافئ على الصافي', value: `${lossPct}% ⇐ ${equivWastePct}%` },
          { label: 'كمية الألياف المطلوبة', value: `${mFiber.toFixed(1)} جم` },
          { label: 'الطول الناتج حسب Tex', value: `${lengthM.toFixed(0)} متر`, highlight: true },
        ],
        { totalWeightKg: mFiber / 1000, totalWeightGrams: mFiber, totalLengthMeters: Math.round(lengthM), wasteAmount: mFiber - mFinal }
      );
    },
  },

  knitting: {
    craftId: 'knitting',
    mainSectionId: 'ropes_textiles',
    nameAr: 'التريكو اليدوي والنول الدائري',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [40, 65],
    formulaSummaryAr: 'وزن الخيط = (وزن العينة ÷ مساحة العينة) × مساحة المنتج × (1 + ه)',
    fields: [
      { key: 'widthCm', labelAr: 'العرض النهائي', unitAr: 'سم', type: 'number', defaultValue: 50, min: 1 },
      { key: 'heightCm', labelAr: 'الارتفاع / الطول النهائي', unitAr: 'سم', type: 'number', defaultValue: 60, min: 1 },
      { key: 'stitchesPer10Cm', labelAr: 'عدد الغرز في 10 سم', type: 'number', defaultValue: 18, min: 1, isCalibration: true },
      { key: 'rowsPer10Cm', labelAr: 'عدد السطور في 10 سم', type: 'number', defaultValue: 24, min: 1, isCalibration: true },
      { key: 'sampleWeightGrams', labelAr: 'وزن عينة 10×10 سم (100 سم²)', unitAr: 'جم', type: 'number', defaultValue: 5.5, min: 0.1, isCalibration: true },
      { key: 'sampleAreaCm2', labelAr: 'مساحة العينة القياسية', unitAr: 'سم²', type: 'number', defaultValue: 100, min: 1, isCalibration: true },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 35 },
      { key: 'pricePerKg', labelAr: 'سعر كيلو الخيط', unitAr: 'ج/كجم', type: 'number', defaultValue: 260, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const w = num(p.widthCm, num(input.widthCm, 50));
      const h = num(p.heightCm, num(input.totalLengthCm, 60));
      const area = w * h;
      const dS = num(cal.stitchesPer10Cm ?? p.stitchesPer10Cm, 18) / 10;
      const dR = num(cal.rowsPer10Cm ?? p.rowsPer10Cm, 24) / 10;
      const totalStitches = Math.round(w * dS * h * dR);
      const sampleM = num(cal.sampleWeightGrams ?? p.sampleWeightGrams, 5.5);
      const sampleA = Math.max(1, num(cal.sampleAreaCm2 ?? p.sampleAreaCm2, 100));
      const netGrams = (sampleM / sampleA) * area;
      const wastePct = num(p.wastePercent, 5);
      const { gross: grossGrams, waste } = applyWasteOnNet(netGrams, wastePct);
      const kg = grossGrams / 1000;
      const yarnCost = kg * num(p.pricePerKg, num(input.pricePerKg, 260));
      const extraCost = sumDynamicExtraMaterials(input);
      return makeWaste(
        yarnCost,
        wastePct,
        extraCost,
        `${netGrams.toFixed(0)} جم`,
        `${grossGrams.toFixed(0)} جم`,
        'on_net',
        [
          { label: 'إجمالي الغرز التقديري', value: `${totalStitches.toLocaleString('ar-EG')} غرزة` },
          { label: 'المساحة الكلية', value: `${area.toFixed(0)} سم²` },
          { label: 'الوزن الصافي ← المنصرف', value: `${netGrams.toFixed(0)} جم ← ${grossGrams.toFixed(0)} جم` },
        ],
        { totalWeightKg: kg, totalWeightGrams: grossGrams, areaCm2: area, wasteAmount: waste }
      );
    },
  },

  felting: {
    craftId: 'felting',
    mainSectionId: 'ropes_textiles',
    nameAr: 'اللباد (Felting)',
    isNewStar: true,
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [45, 75],
    formulaSummaryAr: 'البعد قبل الانكماش = النهائي ÷ (1 − ق) | وزن الصوف = م_ابتدائية × كثافة_سطحية × الطبقات',
    fields: [
      { key: 'finalLengthCm', labelAr: 'الطول النهائي المطلوب', unitAr: 'سم', type: 'number', defaultValue: 35, min: 1 },
      { key: 'finalWidthCm', labelAr: 'العرض النهائي المطلوب', unitAr: 'سم', type: 'number', defaultValue: 25, min: 1 },
      { key: 'shrinkagePercent', labelAr: 'نسبة الانكماش الخطي (ق)', unitAr: '%', type: 'number', defaultValue: 25, min: 0, max: 60, isCalibration: true },
      { key: 'woolGsmPerCm2', labelAr: 'كثافة الصوف السطحية للطبقة', unitAr: 'جم/سم²', type: 'number', defaultValue: 0.025, step: 0.005, min: 0.001, isCalibration: true },
      { key: 'layersCount', labelAr: 'عدد طبقات الصوف', type: 'number', defaultValue: 3, min: 1 },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 30 },
      { key: 'woolPricePerKg', labelAr: 'سعر كيلو صوف اللباد', unitAr: 'ج/كجم', type: 'number', defaultValue: 450, min: 0 },
      { key: 'soapFixerPerKgCost', labelAr: 'صابون ومثبت اللباد لكل كجم صوف', unitAr: 'ج/كجم', type: 'number', defaultValue: 30, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const s = Math.min(0.7, Math.max(0, num(cal.shrinkagePercent ?? p.shrinkagePercent, 25) / 100));
      const lInit = num(p.finalLengthCm, 35) / (1 - s);
      const wInit = num(p.finalWidthCm, 25) / (1 - s);
      const aInit = lInit * wInit;
      const sigma = num(cal.woolGsmPerCm2 ?? p.woolGsmPerCm2, 0.025);
      const layers = num(p.layersCount, 3);
      const netGrams = aInit * sigma * layers;
      const wastePct = num(p.wastePercent, 5);
      const { gross: grossGrams, waste } = applyWasteOnNet(netGrams, wastePct);
      const kg = grossGrams / 1000;
      const woolCost = kg * num(p.woolPricePerKg, 450);
      const soapCost = kg * num(p.soapFixerPerKgCost, 30);
      const extraCost = sumDynamicExtraMaterials(input) + soapCost;
      return makeWaste(
        woolCost,
        wastePct,
        extraCost,
        `${netGrams.toFixed(0)} جم صوف`,
        `${grossGrams.toFixed(0)} جم صوف`,
        'on_net',
        [
          { label: 'أبعاد الفرش قبل الانكماش', value: `${lInit.toFixed(1)} × ${wInit.toFixed(1)} سم` },
          { label: 'مساحة الفرش الابتدائية', value: `${aInit.toFixed(0)} سم² (${layers} طبقات)` },
          { label: 'وزن الصوف المنصرف', value: `${grossGrams.toFixed(1)} جم`, highlight: true },
        ],
        { totalWeightKg: kg, totalWeightGrams: grossGrams, areaCm2: aInit, wasteAmount: waste }
      );
    },
  },

  dyeing: {
    craftId: 'dyeing',
    mainSectionId: 'ropes_textiles',
    nameAr: 'الصباغة اليدوية (Dyeing)',
    isNewStar: true,
    defaultWastePercent: 3,
    indicativeHourlyRateRange: [45, 75],
    formulaSummaryAr: 'الصبغة = وزن_جاف × %OWF | حمام الصباغة = وزن_جاف × نسبة الحمام (لتر/كجم)',
    fields: [
      { key: 'dryFiberGrams', labelAr: 'وزن الخامة الجافة المطلوب صباغتها', unitAr: 'جم', type: 'number', defaultValue: 500, min: 1 },
      { key: 'dyePercentOwf', labelAr: 'نسبة الصبغة من وزن الخامة (%OWF)', unitAr: '%', type: 'number', defaultValue: 4, step: 0.5, min: 0.1, isCalibration: true },
      { key: 'liquorRatio', labelAr: 'نسبة حمام الصباغة (لتر/كجم)', unitAr: 'لتر/كجم', type: 'number', defaultValue: 20, min: 1, isCalibration: true },
      { key: 'fixerPercentOwf', labelAr: 'نسبة المثبت / الملح', unitAr: '%', type: 'number', defaultValue: 8, min: 0, isCalibration: true },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصبغة والمثبت', unitAr: '%', type: 'number', defaultValue: 3, min: 0, max: 30 },
      { key: 'dyePricePerGram', labelAr: 'سعر جرام الصبغة', unitAr: 'ج/جم', type: 'number', defaultValue: 2.5, step: 0.1, min: 0 },
      { key: 'fixerPricePerGram', labelAr: 'سعر جرام المثبت', unitAr: 'ج/جم', type: 'number', defaultValue: 0.35, step: 0.05, min: 0 },
      { key: 'heatingFuelCost', labelAr: 'تكلفة الغاز أو التسخين للدفعة', unitAr: 'ج', type: 'number', defaultValue: 18, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const mDry = num(p.dryFiberGrams, 500);
      const dyeNetG = mDry * (num(cal.dyePercentOwf ?? p.dyePercentOwf, 4) / 100);
      const fixerNetG = mDry * (num(cal.fixerPercentOwf ?? p.fixerPercentOwf, 8) / 100);
      const lr = num(cal.liquorRatio ?? p.liquorRatio, 20);
      const vBathLiters = (mDry / 1000) * lr;
      const wastePct = num(p.wastePercent, 3);
      const { gross: dyeGrossG, waste: dyeW } = applyWasteOnNet(dyeNetG, wastePct);
      const { gross: fixerGrossG } = applyWasteOnNet(fixerNetG, wastePct);
      const dyeCost = dyeGrossG * num(p.dyePricePerGram, 2.5) + fixerGrossG * num(p.fixerPricePerGram, 0.35);
      const heatCost = num(p.heatingFuelCost, 18);
      const extraCost = sumDynamicExtraMaterials(input);
      return makeWaste(
        dyeCost,
        wastePct,
        extraCost,
        `${dyeNetG.toFixed(1)} جم صبغة + ${fixerNetG.toFixed(1)} جم مثبت`,
        `${dyeGrossG.toFixed(1)} جم صبغة + ${fixerGrossG.toFixed(1)} جم مثبت`,
        'on_net',
        [
          { label: 'حجم حمام الصباغة المطلوب', value: `${vBathLiters.toFixed(1)} لتر ماء` },
          { label: 'الصبغة المنصرفة (+هالك)', value: `${dyeGrossG.toFixed(1)} جم` },
          { label: 'المثبت المنصرف', value: `${fixerGrossG.toFixed(1)} جم` },
        ],
        { totalWeightKg: (dyeGrossG + fixerGrossG) / 1000, totalWeightGrams: dyeGrossG + fixerGrossG, energyCostExtra: heatCost, wasteAmount: dyeW }
      );
    },
  },

  // =========================================================================
  // القسم 2: الخرز والتطريز والإكسسوارات
  // =========================================================================
  beadwork: {
    craftId: 'beadwork',
    mainSectionId: 'beads_embroidery',
    nameAr: 'الخرز وشنط الخرز',
    defaultWastePercent: 3,
    indicativeHourlyRateRange: [40, 60],
    formulaSummaryAr: 'عدد الخرز = ن_طول × ن_عرض × ن_وحدة | الوزن = العدد ÷ خرز_في_الجرام | كل هالك على خامته (3% خرز / 10% خيط)',
    fields: [
      { key: 'lengthUnits', labelAr: 'عدد الوحدات الطولية (ن_طول)', type: 'number', defaultValue: 22, min: 1 },
      { key: 'widthUnits', labelAr: 'عدد الوحدات العرضية (ن_عرض)', type: 'number', defaultValue: 16, min: 1 },
      { key: 'beadsPerUnit', labelAr: 'عدد الخرز في الوحدة (ن_وحدة)', type: 'number', defaultValue: 4, min: 1 },
      { key: 'sideAndHandleBeadsCount', labelAr: 'خرز الجوانب واليد والقاعدة (إضافي)', type: 'number', defaultValue: 320, min: 0 },
      { key: 'beadsPerGram', labelAr: 'عدد الخرز في الجرام (معايرة حسب المقاس)', unitAr: 'خرزة/جم', type: 'number', defaultValue: 2.4, step: 0.1, min: 0.1, isCalibration: true },
      { key: 'beadsWastePercent', labelAr: 'هالك الخرز على الصافي', unitAr: '%', type: 'number', defaultValue: 3, min: 0, max: 30 },
      { key: 'beadPricePerKg', labelAr: 'سعر كيلو الخرز', unitAr: 'ج/كجم', type: 'number', defaultValue: 320, min: 0 },
      { key: 'rowsCount', labelAr: 'عدد صفوف الربط (خيط)', type: 'number', defaultValue: 32, min: 0 },
      { key: 'rowLengthMeters', labelAr: 'طول الصف المتوسط', unitAr: 'م', type: 'number', defaultValue: 0.65, step: 0.05, min: 0 },
      { key: 'threadPassFactor', labelAr: 'معامل مرور الخيط (ل_مرور)', type: 'number', defaultValue: 2.2, step: 0.1, min: 1, isCalibration: true },
      { key: 'threadWastePercent', labelAr: 'هالك خيط الربط على الصافي', unitAr: '%', type: 'number', defaultValue: 10, min: 0, max: 40 },
      { key: 'threadPricePerMeter', labelAr: 'سعر متر خيط الصنارة/الحرير', unitAr: 'ج/م', type: 'number', defaultValue: 0.8, step: 0.1, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const nMain = num(p.lengthUnits, 22) * num(p.widthUnits, 16) * num(p.beadsPerUnit, 4);
      const nTotalBeads = nMain + num(p.sideAndHandleBeadsCount, 320);
      const bpg = Math.max(0.05, num(cal.beadsPerGram ?? p.beadsPerGram, 2.4));
      const netBeadGrams = nTotalBeads / bpg;
      const beadWastePct = num(p.beadsWastePercent, 3);
      const { gross: grossBeadGrams, waste: beadWaste } = applyWasteOnNet(netBeadGrams, beadWastePct);
      const beadsCost = (grossBeadGrams / 1000) * num(p.beadPricePerKg, 320);

      const kPass = num(cal.threadPassFactor ?? p.threadPassFactor, 2.2);
      const netThreadM = num(p.rowsCount, 32) * num(p.rowLengthMeters, 0.65) * kPass;
      const threadWastePct = num(p.threadWastePercent, 10);
      const { gross: grossThreadM } = applyWasteOnNet(netThreadM, threadWastePct);
      const threadCost = grossThreadM * num(p.threadPricePerMeter, 0.8);

      const extraCost = sumDynamicExtraMaterials(input) + threadCost;
      return makeWaste(
        beadsCost,
        beadWastePct,
        extraCost,
        `${netBeadGrams.toFixed(0)} جم خرز + ${netThreadM.toFixed(1)} م خيط`,
        `${grossBeadGrams.toFixed(0)} جم خرز + ${grossThreadM.toFixed(1)} م خيط`,
        'on_net',
        [
          { label: 'إجمالي عدد الخرز الصافي', value: `${Math.round(nTotalBeads).toLocaleString('ar-EG')} خرزة` },
          { label: `الخرز المنصرف (هالك ${beadWastePct}%)`, value: `${grossBeadGrams.toFixed(0)} جم`, highlight: true },
          { label: `خيط الربط المنصرف (هالك ${threadWastePct}%)`, value: `${grossThreadM.toFixed(1)} متر (${threadCost.toFixed(0)} ج)` },
        ],
        { totalWeightKg: grossBeadGrams / 1000, totalWeightGrams: grossBeadGrams, totalLengthMeters: Math.round(grossThreadM), wasteAmount: beadWaste }
      );
    },
  },

  embroidery: {
    craftId: 'embroidery',
    mainSectionId: 'beads_embroidery',
    nameAr: 'التطريز اليدوي',
    defaultWastePercent: 8,
    indicativeHourlyRateRange: [50, 85],
    formulaSummaryAr: 'م_قماش = م_تصميم + هوامش الشد | ط_خيط = ط_مسار × ل_غرزة | الشلل = ⌈ط ÷ طول_الشلة_الفعلي⌉',
    fields: [
      { key: 'hoopOrWidthCm', labelAr: 'قطر الطارة أو عرض التصميم', unitAr: 'سم', type: 'number', defaultValue: 22, min: 1 },
      { key: 'heightCm', labelAr: 'ارتفاع التصميم (للمستطيل، اتركه مساوي للقطر للطارة)', unitAr: 'سم', type: 'number', defaultValue: 22, min: 1 },
      { key: 'tensionMarginCm', labelAr: 'هامش الشد من كل جانب', unitAr: 'سم', type: 'number', defaultValue: 6, min: 0, isCalibration: true },
      { key: 'stitchPathMeters', labelAr: 'إجمالي طول مسار الغرز', unitAr: 'م', type: 'number', defaultValue: 14, min: 0.1 },
      { key: 'stitchFactor', labelAr: 'معامل الغرزة وعدد الفتلات (ل_غرزة)', type: 'number', defaultValue: 2.6, step: 0.1, min: 1, isCalibration: true },
      { key: 'skeinUsableMeters', labelAr: 'الطول القابل للاستخدام في الشلة', unitAr: 'م', type: 'number', defaultValue: 7.5, step: 0.5, min: 1, isCalibration: true },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 8, min: 0, max: 35 },
      { key: 'fabricPricePerSqM', labelAr: 'سعر متر² القماش', unitAr: 'ج/م²', type: 'number', defaultValue: 180, min: 0 },
      { key: 'pricePerSkein', labelAr: 'سعر الشلة الواحدة', unitAr: 'ج/شلة', type: 'number', defaultValue: 22, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const margin = num(cal.tensionMarginCm ?? p.tensionMarginCm, 6) * 2;
      const fabW = num(p.hoopOrWidthCm, 22) + margin;
      const fabH = num(p.heightCm, 22) + margin;
      const fabAreaCm2 = fabW * fabH;
      const fabAreaSqM = fabAreaCm2 / 10000;
      const wastePct = num(p.wastePercent, 8);

      const kStitch = num(cal.stitchFactor ?? p.stitchFactor, 2.6);
      const netThreadM = num(p.stitchPathMeters, 14) * kStitch;
      const { gross: grossThreadM, waste } = applyWasteOnNet(netThreadM, wastePct);
      const usableM = Math.max(1, num(cal.skeinUsableMeters ?? p.skeinUsableMeters, 7.5));
      const skeinsNeeded = Math.ceil(grossThreadM / usableM);

      const threadCost = skeinsNeeded * num(p.pricePerSkein, 22);
      const fabricCost = fabAreaSqM * (1 + wastePct / 100) * num(p.fabricPricePerSqM, 180);
      const extraCost = sumDynamicExtraMaterials(input) + fabricCost;

      return makeWaste(
        threadCost,
        wastePct,
        extraCost,
        `${netThreadM.toFixed(1)} م خيط`,
        `${grossThreadM.toFixed(1)} م (${skeinsNeeded} شلة)`,
        'on_net',
        [
          { label: 'مساحة القماش شاملة هوامش الشد', value: `${fabW} × ${fabH} سم (${fabAreaSqM.toFixed(3)} م²)` },
          { label: 'طول الخيط المنصرف', value: `${grossThreadM.toFixed(1)} متر` },
          { label: 'عدد الشلل المطلوبة (تقريب لأعلى)', value: `${skeinsNeeded} شلة`, highlight: true },
        ],
        { areaCm2: fabAreaCm2, totalLengthMeters: Math.round(grossThreadM), wasteAmount: waste }
      );
    },
  },

  sirma_embroidery: {
    craftId: 'sirma_embroidery',
    mainSectionId: 'beads_embroidery',
    nameAr: 'تطريز السيرما والقصب المعدني',
    isNewStar: true,
    defaultWastePercent: 10,
    indicativeHourlyRateRange: [65, 110],
    formulaSummaryAr: 'ط_سيرما = ط_مسار × ل_سيرما × (1 + ه) | خامة التثبيت مستقلة',
    fields: [
      { key: 'pathLengthMeters', labelAr: 'إجمالي طول مسار السيرما', unitAr: 'م', type: 'number', defaultValue: 18, min: 0.1 },
      { key: 'sirmaFactor', labelAr: 'معامل السيرما (ل_سيرما)', type: 'number', defaultValue: 3.1, step: 0.1, min: 1, isCalibration: true },
      { key: 'gramsPerMeter', labelAr: 'وزن المتر من القصب/السيرما', unitAr: 'جم/م', type: 'number', defaultValue: 1.8, step: 0.1, min: 0.1, isCalibration: true },
      { key: 'wastePercent', labelAr: 'هالك السيرما على الصافي', unitAr: '%', type: 'number', defaultValue: 10, min: 0, max: 35 },
      { key: 'pricePerGram', labelAr: 'سعر جرام خيط السيرما/القصب', unitAr: 'ج/جم', type: 'number', defaultValue: 6.5, step: 0.5, min: 0 },
      { key: 'fixingMaterialCost', labelAr: 'تكلفة القماش والخيط التثبيتي', unitAr: 'ج', type: 'number', defaultValue: 95, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const k = num(cal.sirmaFactor ?? p.sirmaFactor, 3.1);
      const netM = num(p.pathLengthMeters, 18) * k;
      const wastePct = num(p.wastePercent, 10);
      const { gross: grossM, waste } = applyWasteOnNet(netM, wastePct);
      const grams = grossM * num(cal.gramsPerMeter ?? p.gramsPerMeter, 1.8);
      const sirmaCost = grams * num(p.pricePerGram, 6.5);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.fixingMaterialCost, 95);
      return makeWaste(
        sirmaCost,
        wastePct,
        extraCost,
        `${netM.toFixed(1)} م`,
        `${grossM.toFixed(1)} م (${grams.toFixed(1)} جم)`,
        'on_net',
        [
          { label: 'طول السيرما الصافي ← المنصرف', value: `${netM.toFixed(1)} م ← ${grossM.toFixed(1)} م` },
          { label: 'الوزن الفعلي للسيرما', value: `${grams.toFixed(1)} جم`, highlight: true },
        ],
        { totalWeightKg: grams / 1000, totalWeightGrams: grams, totalLengthMeters: Math.round(grossM), wasteAmount: waste }
      );
    },
  },

  jewelry: {
    craftId: 'jewelry',
    mainSectionId: 'beads_embroidery',
    nameAr: 'الحلي والإكسسوارات',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [45, 75],
    formulaSummaryAr: 'ط_سلسلة = الطول + القفل + التطويل | و_سلك = ط × وزن_المتر | أقفال وزرد بالعدد',
    fields: [
      { key: 'finalLengthCm', labelAr: 'الطول النهائي للقطعة', unitAr: 'سم', type: 'number', defaultValue: 45, min: 1 },
      { key: 'extensionLengthCm', labelAr: 'طول سلسلة التطويل', unitAr: 'سم', type: 'number', defaultValue: 5, min: 0 },
      { key: 'chainPricePerMeter', labelAr: 'سعر متر السلسلة', unitAr: 'ج/م', type: 'number', defaultValue: 45, min: 0 },
      { key: 'wireLengthMeters', labelAr: 'طول السلك المستخدم', unitAr: 'م', type: 'number', defaultValue: 0.8, step: 0.1, min: 0 },
      { key: 'wireGramsPerMeter', labelAr: 'وزن المتر للسلك', unitAr: 'جم/م', type: 'number', defaultValue: 4.5, step: 0.1, min: 0, isCalibration: true },
      { key: 'wirePricePerGram', labelAr: 'سعر جرام السلك', unitAr: 'ج/جم', type: 'number', defaultValue: 3.5, step: 0.5, min: 0 },
      { key: 'claspsCount', labelAr: 'عدد الأقفال', type: 'number', defaultValue: 1, min: 0 },
      { key: 'claspUnitPrice', labelAr: 'سعر القفل', unitAr: 'ج', type: 'number', defaultValue: 6, min: 0 },
      { key: 'jumpRingsCount', labelAr: 'عدد الزردات (نقاط الربط)', type: 'number', defaultValue: 6, min: 0 },
      { key: 'jumpRingUnitPrice', labelAr: 'سعر الزردة', unitAr: 'ج', type: 'number', defaultValue: 1.5, step: 0.5, min: 0 },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 30 },
    ],
    calculate: (input, p, cal) => {
      const chainNetM = (num(p.finalLengthCm, 45) + num(p.extensionLengthCm, 5)) / 100;
      const wastePct = num(p.wastePercent, 5);
      const { gross: chainGrossM, waste } = applyWasteOnNet(chainNetM, wastePct);
      const chainCost = chainGrossM * num(p.chainPricePerMeter, 45);
      const wireGrossM = num(p.wireLengthMeters, 0.8) * (1 + wastePct / 100);
      const wireG = wireGrossM * num(cal.wireGramsPerMeter ?? p.wireGramsPerMeter, 4.5);
      const wireCost = wireG * num(p.wirePricePerGram, 3.5);
      const fittingsCost = num(p.claspsCount, 1) * num(p.claspUnitPrice, 6) + num(p.jumpRingsCount, 6) * num(p.jumpRingUnitPrice, 1.5);
      const extraCost = sumDynamicExtraMaterials(input) + fittingsCost + wireCost;
      return makeWaste(
        chainCost,
        wastePct,
        extraCost,
        `${chainNetM.toFixed(2)} م سلسلة`,
        `${chainGrossM.toFixed(2)} م سلسلة + ${wireG.toFixed(1)} جم سلك`,
        'on_net',
        [
          { label: 'السلسلة المنصرفة (+هالك)', value: `${chainGrossM.toFixed(2)} م` },
          { label: 'وزن السلك المنصرف', value: `${wireG.toFixed(1)} جم` },
          { label: 'الأقفال والزردات', value: `${fittingsCost.toFixed(1)} ج` },
        ],
        { totalWeightKg: wireG / 1000, totalWeightGrams: wireG, totalLengthMeters: Number((chainGrossM + wireGrossM).toFixed(2)), wasteAmount: waste }
      );
    },
  },

  wire_wrapping: {
    craftId: 'wire_wrapping',
    mainSectionId: 'beads_embroidery',
    nameAr: 'تشكيل الأسلاك (Wire Wrapping)',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [50, 90],
    formulaSummaryAr: 'ط_سلك = مجموع اللفات والمسارات + التثبيت والقص | و = ط × وزن_المتر',
    fields: [
      { key: 'totalPathMeters', labelAr: 'إجمالي طول المسارات واللفات', unitAr: 'م', type: 'number', defaultValue: 2.5, step: 0.1, min: 0.1 },
      { key: 'tieAndTrimCm', labelAr: 'طول التثبيت والقص الصافي', unitAr: 'سم', type: 'number', defaultValue: 25, min: 0 },
      { key: 'wireGramsPerMeter', labelAr: 'وزن المتر للقطر والخامة', unitAr: 'جم/م', type: 'number', defaultValue: 6.2, step: 0.1, min: 0.1, isCalibration: true },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 30 },
      { key: 'wirePricePerGram', labelAr: 'سعر جرام السلك', unitAr: 'ج/جم', type: 'number', defaultValue: 4.5, step: 0.5, min: 0 },
      { key: 'stoneCabochonCost', labelAr: 'تكلفة الحجر / الكابوشون الأساسي', unitAr: 'ج', type: 'number', defaultValue: 45, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const netM = num(p.totalPathMeters, 2.5) + num(p.tieAndTrimCm, 25) / 100;
      const wastePct = num(p.wastePercent, 5);
      const { gross: grossM, waste } = applyWasteOnNet(netM, wastePct);
      const grams = grossM * num(cal.wireGramsPerMeter ?? p.wireGramsPerMeter, 6.2);
      const wireCost = grams * num(p.wirePricePerGram, 4.5);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.stoneCabochonCost, 45);
      return makeWaste(
        wireCost,
        wastePct,
        extraCost,
        `${netM.toFixed(2)} م سلك`,
        `${grossM.toFixed(2)} م (${grams.toFixed(1)} جم)`,
        'on_net',
        [
          { label: 'الطول الصافي ← المنصرف', value: `${netM.toFixed(2)} م ← ${grossM.toFixed(2)} م` },
          { label: 'الوزن الفعلي للسلك', value: `${grams.toFixed(1)} جم`, highlight: true },
        ],
        { totalWeightKg: grams / 1000, totalWeightGrams: grams, totalLengthMeters: Number(grossM.toFixed(2)), wasteAmount: waste }
      );
    },
  },

  sequins_rhinestones: {
    craftId: 'sequins_rhinestones',
    mainSectionId: 'beads_embroidery',
    nameAr: 'الترصيع والترتر والفصوص',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [50, 85],
    formulaSummaryAr: 'استهلاك الترتر = ن_غرز × ن_وحدات_في_الغرزة | الفصوص والتثبيت حسب النقاط أو المساحة',
    fields: [
      { key: 'stitchesCount', labelAr: 'عدد الغرز (ن_غرز)', type: 'number', defaultValue: 250, min: 0 },
      { key: 'unitsPerStitch', labelAr: 'عدد حبات الترتر في الغرزة', type: 'number', defaultValue: 2, min: 1 },
      { key: 'rhinestonesCount', labelAr: 'عدد الفصوص الإضافية', type: 'number', defaultValue: 40, min: 0 },
      { key: 'sequinPricePer100', labelAr: 'سعر 100 ترتر', unitAr: 'ج', type: 'number', defaultValue: 18, min: 0 },
      { key: 'rhinestoneUnitPrice', labelAr: 'سعر الفص الواحد', unitAr: 'ج', type: 'number', defaultValue: 1.2, step: 0.1, min: 0 },
      { key: 'adhesivePointsCost', labelAr: 'تكلفة الغراء/خيوط التثبيت', unitAr: 'ج', type: 'number', defaultValue: 20, min: 0 },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 30 },
    ],
    calculate: (input, p) => {
      const netSeq = num(p.stitchesCount, 250) * num(p.unitsPerStitch, 2);
      const wastePct = num(p.wastePercent, 5);
      const { gross: grossSeq, waste } = applyWasteOnNet(netSeq, wastePct);
      const grossRhine = num(p.rhinestonesCount, 40) * (1 + wastePct / 100);
      const seqCost = (grossSeq / 100) * num(p.sequinPricePer100, 18) + grossRhine * num(p.rhinestoneUnitPrice, 1.2);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.adhesivePointsCost, 20);
      return makeWaste(
        seqCost,
        wastePct,
        extraCost,
        `${netSeq} ترتر + ${num(p.rhinestonesCount, 40)} فص`,
        `${Math.ceil(grossSeq)} ترتر + ${Math.ceil(grossRhine)} فص`,
        'on_net',
        [
          { label: 'الترتر المنصرف (+هالك)', value: `${Math.ceil(grossSeq)} وحدة` },
          { label: 'الفصوص المنصرفة (+هالك)', value: `${Math.ceil(grossRhine)} فص` },
        ],
        { wasteAmount: waste }
      );
    },
  },

  // =========================================================================
  // القسم 3: الريزن والمواد الطينية والمركبة والجبس والشموع والصابون
  // =========================================================================
  resin: {
    craftId: 'resin',
    mainSectionId: 'clays_composites',
    nameAr: 'الريزن الإيبوكسي (Epoxy)',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [60, 100],
    safetyWarning: 'تنبيه سلامة: ارتدِ كمامة أبخرة عضوية (A1/P2) وقفازات نيتريل مع تهوية قوية أثناء الخلط والمعالجة.',
    formulaSummaryAr: 'و = ح × ث | أ = و × أ÷(أ+ب) | ب = و × ب÷(أ+ب) | الإضافات <= نسبة الشركة المصنعة',
    fields: [
      {
        key: 'moldShape',
        labelAr: 'شكل القالب',
        type: 'select',
        defaultValue: 'rect',
        options: [
          { value: 'rect', label: 'مستطيل (ط × ع × ر)' },
          { value: 'cylinder', label: 'دائري / أسطواني (π نق² ر)' },
          { value: 'irregular', label: 'قالب غير منتظم (قياس مباشر بالماء مل)' },
        ],
      },
      { key: 'lengthCm', labelAr: 'الطول (أو القطر للدائري)', unitAr: 'سم', type: 'number', defaultValue: 30, min: 0.1 },
      { key: 'widthCm', labelAr: 'العرض (للمستطيل)', unitAr: 'سم', type: 'number', defaultValue: 20, min: 0.1 },
      { key: 'depthCm', labelAr: 'السمك / العمق', unitAr: 'سم', type: 'number', defaultValue: 0.8, step: 0.1, min: 0.05 },
      { key: 'directVolumeMl', labelAr: 'الحجم المقاس بالماء (لغير المنتظم)', unitAr: 'مل / سم³', type: 'number', defaultValue: 450, min: 1 },
      { key: 'density', labelAr: 'كثافة الخليط (ث — قابلة للمعايرة)', unitAr: 'جم/سم³', type: 'number', defaultValue: 1.12, step: 0.01, min: 0.8, max: 2, isCalibration: true },
      { key: 'ratioA', labelAr: 'نسبة الجزء أ (الريزن)', type: 'number', defaultValue: 2, min: 0.1, step: 0.1, isCalibration: true },
      { key: 'ratioB', labelAr: 'نسبة الجزء ب (المصلب)', type: 'number', defaultValue: 1, min: 0.1, step: 0.1, isCalibration: true },
      { key: 'pigmentPercent', labelAr: 'نسبة الألوان والمايكا (من الوزن)', unitAr: '%', type: 'number', defaultValue: 3, step: 0.5, min: 0, max: 15, hintAr: 'تحقق من الحد الأقصى الموصى به في نشرة المنتج' },
      { key: 'wastePercent', labelAr: 'هالك الكوب والتفريغ على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 30 },
      { key: 'resinPricePerKg', labelAr: 'سعر كيلو طقم الريزن (أ+ب)', unitAr: 'ج/كجم', type: 'number', defaultValue: 480, min: 0 },
      { key: 'pigmentPricePerGram', labelAr: 'سعر جرام الصبغة / المايكا', unitAr: 'ج/جم', type: 'number', defaultValue: 2.5, step: 0.2, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const shape = String(p.moldShape || 'rect');
      let volume = 0;
      if (shape === 'irregular') {
        volume = num(p.directVolumeMl, 450);
      } else if (shape === 'cylinder') {
        const r = num(p.lengthCm, 30) / 2;
        volume = Math.PI * r * r * num(p.depthCm, 0.8);
      } else {
        volume = num(p.lengthCm, 30) * num(p.widthCm, 20) * num(p.depthCm, 0.8);
      }
      const rho = num(cal.density ?? p.density, 1.12);
      const netM = volume * rho;
      const wastePct = num(p.wastePercent, 5);
      const { gross: grossM, waste } = applyWasteOnNet(netM, wastePct);
      const rA = num(cal.ratioA ?? p.ratioA, 2);
      const rB = num(cal.ratioB ?? p.ratioB, 1);
      const partA = grossM * (rA / Math.max(0.1, rA + rB));
      const partB = grossM * (rB / Math.max(0.1, rA + rB));
      const pigmentG = grossM * (num(p.pigmentPercent, 3) / 100);
      const resinCost = (grossM / 1000) * num(p.resinPricePerKg, 480);
      const pigmentCost = pigmentG * num(p.pigmentPricePerGram, 2.5);
      const extraCost = sumDynamicExtraMaterials(input) + pigmentCost;
      return makeWaste(
        resinCost,
        wastePct,
        extraCost,
        `${netM.toFixed(1)} جم خليط`,
        `${grossM.toFixed(1)} جم (أ=${partA.toFixed(1)} جم، ب=${partB.toFixed(1)} جم)`,
        'on_net',
        [
          { label: 'حجم الصب المحسوب', value: `${volume.toFixed(1)} سم³ (مل)` },
          { label: `الجزء أ (${rA}) : الجزء ب (${rB})`, value: `${partA.toFixed(1)} جم : ${partB.toFixed(1)} جم`, highlight: true },
          { label: 'الألوان والمايكا', value: `${pigmentG.toFixed(1)} جم (${pigmentCost.toFixed(0)} ج)` },
        ],
        { totalWeightKg: grossM / 1000, totalWeightGrams: grossM, volumeCm3: volume, wasteAmount: waste }
      );
    },
  },

  uv_resin: {
    craftId: 'uv_resin',
    mainSectionId: 'clays_composites',
    nameAr: 'ريزن UV',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [50, 90],
    safetyWarning: 'تنبيه سلامة: تجنب ملامسة ريزن UV للجلد واستخدم نظارة حماية من الأشعة فوق البنفسجية.',
    formulaSummaryAr: 'ح = م_تغطية × السمك | و = ح × ث | كهرباء = طبقات × زمن_التعريض × قدرة_المصباح × سعر_KWh',
    fields: [
      { key: 'coverageAreaCm2', labelAr: 'مساحة التغطية', unitAr: 'سم²', type: 'number', defaultValue: 35, min: 0.1 },
      { key: 'thicknessCm', labelAr: 'السمك للطبقة', unitAr: 'سم', type: 'number', defaultValue: 0.25, step: 0.05, min: 0.01 },
      { key: 'layersCount', labelAr: 'عدد الطبقات', type: 'number', defaultValue: 2, min: 1 },
      { key: 'density', labelAr: 'كثافة ريزن UV', unitAr: 'جم/سم³', type: 'number', defaultValue: 1.1, step: 0.01, min: 0.5, isCalibration: true },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 30 },
      { key: 'pricePerGram', labelAr: 'سعر جرام ريزن UV', unitAr: 'ج/جم', type: 'number', defaultValue: 4.5, step: 0.5, min: 0 },
      { key: 'lampWatts', labelAr: 'قدرة مصباح UV', unitAr: 'وات', type: 'number', defaultValue: 48, min: 1 },
      { key: 'exposureSecondsPerLayer', labelAr: 'زمن تعريض الطبقة', unitAr: 'ثانية', type: 'number', defaultValue: 120, min: 1 },
    ],
    calculate: (input, p, cal) => {
      const vol = num(p.coverageAreaCm2, 35) * num(p.thicknessCm, 0.25) * num(p.layersCount, 2);
      const netM = vol * num(cal.density ?? p.density, 1.1);
      const wastePct = num(p.wastePercent, 5);
      const { gross: grossM, waste } = applyWasteOnNet(netM, wastePct);
      const cost = grossM * num(p.pricePerGram, 4.5);
      const lampKw = num(p.lampWatts, 48) / 1000;
      const runHours = (num(p.layersCount, 2) * num(p.exposureSecondsPerLayer, 120)) / 3600;
      const energyCost = lampKw * runHours * num(input.kwhPrice, 2.15);
      const extraCost = sumDynamicExtraMaterials(input);
      return makeWaste(
        cost,
        wastePct,
        extraCost,
        `${netM.toFixed(1)} جم`,
        `${grossM.toFixed(1)} جم`,
        'on_net',
        [
          { label: 'الحجم الإجمالي للطبقات', value: `${vol.toFixed(2)} سم³` },
          { label: 'تكلفة مصباح الأشعة فوق البنفسجية', value: `${energyCost.toFixed(2)} ج` },
        ],
        { totalWeightKg: grossM / 1000, totalWeightGrams: grossM, volumeCm3: vol, energyCostExtra: energyCost, wasteAmount: waste }
      );
    },
  },

  polyester_resin: {
    craftId: 'polyester_resin',
    mainSectionId: 'clays_composites',
    nameAr: 'ريزن البوليستر والألياف الزجاجية',
    defaultWastePercent: 7,
    indicativeHourlyRateRange: [60, 100],
    safetyWarning: 'تنبيه سلامة: البوليستر يحتوي على ستيرين متطاير ومصلب MEKP قابل للاشتعال — لا تخلط نسب مصلب الإيبوكسي معه مطلقاً واعمل في تهوية ميكانيكية.',
    formulaSummaryAr: 'ألياف زجاجية = م × ن_طبقات × GSM | راتنج = وزن_ألياف × نسبة_الراتنج | المصلب = و × %حسب_الحرارة',
    fields: [
      { key: 'areaSqM', labelAr: 'المساحة المطلوبة', unitAr: 'م²', type: 'number', defaultValue: 0.4, step: 0.05, min: 0.01 },
      { key: 'glassLayersCount', labelAr: 'عدد طبقات الألياف الزجاجية', type: 'number', defaultValue: 2, min: 1 },
      { key: 'glassGsm', labelAr: 'الوزن الجرامي للألياف', unitAr: 'جم/م²', type: 'number', defaultValue: 300, min: 50, isCalibration: true },
      { key: 'resinToFiberRatio', labelAr: 'نسبة الراتنج إلى الألياف (من عينة)', type: 'number', defaultValue: 2.2, step: 0.1, min: 1, isCalibration: true },
      { key: 'catalystPercent', labelAr: 'نسبة المصلب (MEKP حسب الحرارة)', unitAr: '%', type: 'number', defaultValue: 1.5, step: 0.25, min: 0.5, max: 4 },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 7, min: 0, max: 35 },
      { key: 'polyesterPricePerKg', labelAr: 'سعر كيلو البوليستر بالمصلب', unitAr: 'ج/كجم', type: 'number', defaultValue: 195, min: 0 },
      { key: 'glassPricePerKg', labelAr: 'سعر كيلو الألياف الزجاجية', unitAr: 'ج/كجم', type: 'number', defaultValue: 140, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const areaM2 = num(p.areaSqM, 0.4);
      const layers = num(p.glassLayersCount, 2);
      const gsm = num(cal.glassGsm ?? p.glassGsm, 300);
      const netGlassG = areaM2 * layers * gsm;
      const ratio = num(cal.resinToFiberRatio ?? p.resinToFiberRatio, 2.2);
      const netResinG = netGlassG * ratio;
      const wastePct = num(p.wastePercent, 7);
      const { gross: grossGlassG } = applyWasteOnNet(netGlassG, wastePct);
      const { gross: grossResinG, waste } = applyWasteOnNet(netResinG, wastePct);
      const catalystG = grossResinG * (num(p.catalystPercent, 1.5) / 100);
      const cost = (grossResinG / 1000) * num(p.polyesterPricePerKg, 195);
      const glassCost = (grossGlassG / 1000) * num(p.glassPricePerKg, 140);
      const extraCost = sumDynamicExtraMaterials(input) + glassCost;
      return makeWaste(
        cost,
        wastePct,
        extraCost,
        `${netResinG.toFixed(0)} جم بوليستر + ${netGlassG.toFixed(0)} جم ألياف`,
        `${grossResinG.toFixed(0)} جم بوليستر (${catalystG.toFixed(1)} جم مصلب) + ${grossGlassG.toFixed(0)} جم ألياف`,
        'on_net',
        [
          { label: 'الألياف الزجاجية المنصرفة', value: `${grossGlassG.toFixed(0)} جم` },
          { label: 'راتنج البوليستر + المصلب', value: `${grossResinG.toFixed(0)} جم + ${catalystG.toFixed(1)} جم مصلب`, highlight: true },
        ],
        { totalWeightKg: (grossResinG + grossGlassG) / 1000, totalWeightGrams: grossResinG + grossGlassG, areaCm2: areaM2 * 10000, wasteAmount: waste }
      );
    },
  },

  concrete: {
    craftId: 'concrete',
    mainSectionId: 'clays_composites',
    nameAr: 'الكونكريت الديكوري والترازو',
    defaultWastePercent: 7,
    indicativeHourlyRateRange: [45, 70],
    formulaSummaryAr: 'و_خلطة = ح × ث | كل مكون = و × نسبته من الوصفة المعتمدة | السيلر = م ÷ غ',
    fields: [
      { key: 'volumeCm3', labelAr: 'حجم القالب', unitAr: 'سم³ (مل)', type: 'number', defaultValue: 550, min: 1 },
      { key: 'mixDensity', labelAr: 'كثافة الخلطة المجرّبة', unitAr: 'جم/سم³', type: 'number', defaultValue: 2.05, step: 0.05, min: 1, isCalibration: true },
      { key: 'cementPercent', labelAr: 'نسبة الأسمنت الأبيض/الرمادي', unitAr: '%', type: 'number', defaultValue: 55, min: 10, max: 90, isCalibration: true },
      { key: 'aggregatePercent', labelAr: 'نسبة الركام / كسر الرخام', unitAr: '%', type: 'number', defaultValue: 25, min: 0, max: 80, isCalibration: true },
      { key: 'waterPercent', labelAr: 'نسبة الماء والإضافات', unitAr: '%', type: 'number', defaultValue: 20, min: 5, max: 45, isCalibration: true },
      { key: 'surfaceAreaCm2', labelAr: 'المساحة الخارجية للعزل (سيلر)', unitAr: 'سم²', type: 'number', defaultValue: 480, min: 0 },
      { key: 'sealerCoverageCm2PerMl', labelAr: 'معدل تغطية السيلر', unitAr: 'سم²/مل', type: 'number', defaultValue: 80, min: 1, isCalibration: true },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 7, min: 0, max: 35 },
      { key: 'mixPricePerKg', labelAr: 'سعر كيلو الخلطة الجافة المجمّعة', unitAr: 'ج/كجم', type: 'number', defaultValue: 38, min: 0 },
      { key: 'sealerPricePerMl', labelAr: 'سعر مل السيلر الواقي', unitAr: 'ج/مل', type: 'number', defaultValue: 0.65, step: 0.05, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const vol = num(p.volumeCm3, 550);
      const netMix = vol * num(cal.mixDensity ?? p.mixDensity, 2.05);
      const wastePct = num(p.wastePercent, 7);
      const { gross: grossMix, waste } = applyWasteOnNet(netMix, wastePct);
      const cPct = num(cal.cementPercent ?? p.cementPercent, 55);
      const aPct = num(cal.aggregatePercent ?? p.aggregatePercent, 25);
      const wPct = num(cal.waterPercent ?? p.waterPercent, 20);
      const sumPct = Math.max(1, cPct + aPct + wPct);
      const cementG = grossMix * (cPct / sumPct);
      const aggG = grossMix * (aPct / sumPct);
      const waterG = grossMix * (wPct / sumPct);
      const dryG = cementG + aggG;
      const mixCost = (dryG / 1000) * num(p.mixPricePerKg, 38);
      const sealerMl = num(p.surfaceAreaCm2, 480) / Math.max(1, num(cal.sealerCoverageCm2PerMl ?? p.sealerCoverageCm2PerMl, 80));
      const sealerCost = sealerMl * num(p.sealerPricePerMl, 0.65);
      const extraCost = sumDynamicExtraMaterials(input) + sealerCost;
      return makeWaste(
        mixCost,
        wastePct,
        extraCost,
        `${netMix.toFixed(0)} جم خلطة`,
        `${grossMix.toFixed(0)} جم (أسمنت ${cementG.toFixed(0)} + ركام ${aggG.toFixed(0)} + ماء ${waterG.toFixed(0)})`,
        'on_net',
        [
          { label: 'تفصيل الخلطة المنصرفة', value: `أسمنت ${cementG.toFixed(0)} جم | ركام ${aggG.toFixed(0)} جم | ماء ${waterG.toFixed(0)} مل`, highlight: true },
          { label: 'السيلر المطلوب للعزل', value: `${sealerMl.toFixed(1)} مل (${sealerCost.toFixed(1)} ج)` },
        ],
        { totalWeightKg: grossMix / 1000, totalWeightGrams: grossMix, volumeCm3: vol, areaCm2: num(p.surfaceAreaCm2, 480), wasteAmount: waste }
      );
    },
  },

  gypsum: {
    craftId: 'gypsum',
    mainSectionId: 'clays_composites',
    nameAr: 'الجبس الديكوري',
    defaultWastePercent: 7,
    indicativeHourlyRateRange: [40, 65],
    formulaSummaryAr: 'و_جبس = ح × معامل_الاستهلاك | و_ماء = و_جبس × نسبة_الماء | إضافات ولون %',
    fields: [
      { key: 'volumeCm3', labelAr: 'حجم القالب', unitAr: 'سم³', type: 'number', defaultValue: 400, min: 1 },
      { key: 'plasterConsumptionFactor', labelAr: 'معامل استهلاك الجبس (جم/سم³)', type: 'number', defaultValue: 1.15, step: 0.05, min: 0.5, isCalibration: true },
      { key: 'waterToPlasterRatio', labelAr: 'نسبة الماء إلى الجبس (مثلاً 0.40)', type: 'number', defaultValue: 0.4, step: 0.02, min: 0.2, isCalibration: true },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 7, min: 0, max: 35 },
      { key: 'plasterPricePerKg', labelAr: 'سعر كيلو الجبس', unitAr: 'ج/كجم', type: 'number', defaultValue: 22, min: 0 },
      { key: 'additivesCost', labelAr: 'تكلفة الألوان والورنيش', unitAr: 'ج', type: 'number', defaultValue: 10, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const vol = num(p.volumeCm3, 400);
      const netPlaster = vol * num(cal.plasterConsumptionFactor ?? p.plasterConsumptionFactor, 1.15);
      const wastePct = num(p.wastePercent, 7);
      const { gross: grossPlaster, waste } = applyWasteOnNet(netPlaster, wastePct);
      const waterMl = grossPlaster * num(cal.waterToPlasterRatio ?? p.waterToPlasterRatio, 0.4);
      const cost = (grossPlaster / 1000) * num(p.plasterPricePerKg, 22);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.additivesCost, 10);
      return makeWaste(
        cost,
        wastePct,
        extraCost,
        `${netPlaster.toFixed(0)} جم جبس`,
        `${grossPlaster.toFixed(0)} جم جبس + ${waterMl.toFixed(0)} مل ماء`,
        'on_net',
        [
          { label: 'بودرة الجبس المنصرفة', value: `${grossPlaster.toFixed(0)} جم` },
          { label: 'الماء المطلوب للخلط', value: `${waterMl.toFixed(0)} مل` },
        ],
        { totalWeightKg: grossPlaster / 1000, totalWeightGrams: grossPlaster, volumeCm3: vol, wasteAmount: waste }
      );
    },
  },

  jesmonite: {
    craftId: 'jesmonite',
    mainSectionId: 'clays_composites',
    nameAr: 'الجيسمونايت (Jesmonite AC100)',
    defaultWastePercent: 7,
    indicativeHourlyRateRange: [45, 70],
    formulaSummaryAr: 'و = ح × ث | بودرة = و × 2.5 ÷ 3.5 | سائل = و × 1 ÷ 3.5 (قابل للتعديل من نشرة المادة)',
    fields: [
      { key: 'volumeCm3', labelAr: 'حجم القالب', unitAr: 'سم³ (مل)', type: 'number', defaultValue: 350, min: 1 },
      { key: 'density', labelAr: 'كثافة الجيسمونايت المرجعية', unitAr: 'جم/سم³', type: 'number', defaultValue: 1.75, step: 0.05, min: 1, isCalibration: true },
      { key: 'powderParts', labelAr: 'نسبة البودرة (AC100 = 2.5)', type: 'number', defaultValue: 2.5, step: 0.1, min: 0.1, isCalibration: true },
      { key: 'liquidParts', labelAr: 'نسبة السائل (AC100 = 1)', type: 'number', defaultValue: 1, step: 0.1, min: 0.1, isCalibration: true },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 7, min: 0, max: 35 },
      { key: 'kitPricePerKg', labelAr: 'سعر كيلو طقم الجيسمونايت (بودرة+سائل)', unitAr: 'ج/كجم', type: 'number', defaultValue: 390, min: 0 },
      { key: 'pigmentAndSealerCost', labelAr: 'ألوان وعازل السيلر', unitAr: 'ج', type: 'number', defaultValue: 18, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const vol = num(p.volumeCm3, 350);
      const netM = vol * num(cal.density ?? p.density, 1.75);
      const wastePct = num(p.wastePercent, 7);
      const { gross: grossM, waste } = applyWasteOnNet(netM, wastePct);
      const pP = num(cal.powderParts ?? p.powderParts, 2.5);
      const lP = num(cal.liquidParts ?? p.liquidParts, 1);
      const totalParts = Math.max(0.1, pP + lP);
      const powderG = grossM * (pP / totalParts);
      const liquidG = grossM * (lP / totalParts);
      const cost = (grossM / 1000) * num(p.kitPricePerKg, 390);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.pigmentAndSealerCost, 18);
      return makeWaste(
        cost,
        wastePct,
        extraCost,
        `${netM.toFixed(0)} جم خليط`,
        `${grossM.toFixed(0)} جم (${powderG.toFixed(0)} جم بودرة + ${liquidG.toFixed(0)} جم سائل)`,
        'on_net',
        [
          { label: 'البودرة (الأساس)', value: `${powderG.toFixed(1)} جم`, highlight: true },
          { label: 'السائل (الرابط)', value: `${liquidG.toFixed(1)} جم`, highlight: true },
        ],
        { totalWeightKg: grossM / 1000, totalWeightGrams: grossM, volumeCm3: vol, wasteAmount: waste }
      );
    },
  },

  polymer_clay: {
    craftId: 'polymer_clay',
    mainSectionId: 'clays_composites',
    nameAr: 'الصلصال الحراري (Polymer Clay)',
    defaultWastePercent: 4,
    indicativeHourlyRateRange: [50, 80],
    formulaSummaryAr: 'و = ح × ث (أو وزن العينة) | تكلفة الخبز = قدرة × ساعات ÷ عدد_القطع_في_الدفعة',
    fields: [
      { key: 'netClayGrams', labelAr: 'الوزن الصافي للصلصال (أو احسب من الحجم=0)', unitAr: 'جم', type: 'number', defaultValue: 65, min: 0 },
      { key: 'volumeCm3', labelAr: 'الحجم (يُستخدم لو الوزن=0)', unitAr: 'سم³', type: 'number', defaultValue: 50, min: 0 },
      { key: 'density', labelAr: 'كثافة الصلصال', unitAr: 'جم/سم³', type: 'number', defaultValue: 1.32, step: 0.02, min: 0.8, isCalibration: true },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 4, min: 0, max: 30 },
      { key: 'pricePerGram', labelAr: 'سعر جرام الصلصال', unitAr: 'ج/جم', type: 'number', defaultValue: 2.2, step: 0.1, min: 0 },
      { key: 'varnishCost', labelAr: 'تكلفة الورنيش / التغليف السطحي', unitAr: 'ج', type: 'number', defaultValue: 8, min: 0 },
      { key: 'ovenKw', labelAr: 'قدرة الفرن الكهربائي', unitAr: 'kW', type: 'number', defaultValue: 1.5, step: 0.1, min: 0 },
      { key: 'bakeHours', labelAr: 'ساعات الخبز للدفعة', unitAr: 'ساعة', type: 'number', defaultValue: 0.5, step: 0.1, min: 0 },
      { key: 'piecesInOvenBatch', labelAr: 'عدد القطع في خبزة الفرن', type: 'number', defaultValue: 8, min: 1 },
    ],
    calculate: (input, p, cal) => {
      const directG = num(p.netClayGrams, 65);
      const netG = directG > 0 ? directG : num(p.volumeCm3, 50) * num(cal.density ?? p.density, 1.32);
      const wastePct = num(p.wastePercent, 4);
      const { gross: grossG, waste } = applyWasteOnNet(netG, wastePct);
      const cost = grossG * num(p.pricePerGram, 2.2);
      const bakeEnergy = (num(p.ovenKw, 1.5) * num(p.bakeHours, 0.5) * num(input.kwhPrice, 2.15)) / Math.max(1, num(p.piecesInOvenBatch, 8));
      const extraCost = sumDynamicExtraMaterials(input) + num(p.varnishCost, 8);
      return makeWaste(
        cost,
        wastePct,
        extraCost,
        `${netG.toFixed(1)} جم صلصال`,
        `${grossG.toFixed(1)} جم صلصال`,
        'on_net',
        [
          { label: 'حصة القطعة من خبز الفرن', value: `${bakeEnergy.toFixed(2)} ج` },
        ],
        { totalWeightKg: grossG / 1000, totalWeightGrams: grossG, energyCostExtra: bakeEnergy, wasteAmount: waste }
      );
    },
  },

  pottery: {
    craftId: 'pottery',
    mainSectionId: 'clays_composites',
    nameAr: 'الخزف والفخار',
    defaultWastePercent: 10,
    indicativeHourlyRateRange: [65, 110],
    formulaSummaryAr: 'البعد المصنوع = المطلوب ÷ (1 − ق) | وزن الطين الرطب = بعد الحرق ÷ ع_وزن | حرق البسكويت + الزجاج منفصلتان',
    fields: [
      { key: 'targetDiameterCm', labelAr: 'القطر أو البعد النهائي المطلوب', unitAr: 'سم', type: 'number', defaultValue: 14, min: 1 },
      { key: 'linearShrinkagePercent', labelAr: 'الانكماش الخطي للطينة (ق)', unitAr: '%', type: 'number', defaultValue: 12, min: 0, max: 30, isCalibration: true },
      { key: 'firedWeightGrams', labelAr: 'وزن القطعة المستهدف بعد الحرق', unitAr: 'جم', type: 'number', defaultValue: 450, min: 1 },
      { key: 'weightYieldFraction', labelAr: 'عائد الوزن (ع_وزن = المحروق ÷ الرطب)', type: 'number', defaultValue: 0.82, step: 0.02, min: 0.4, max: 1, isCalibration: true },
      { key: 'wastePercent', labelAr: 'هالك التشكيل والتقليم على الصافي', unitAr: '%', type: 'number', defaultValue: 10, min: 0, max: 40 },
      { key: 'clayPricePerKg', labelAr: 'سعر كيلو الطين الرطب', unitAr: 'ج/كجم', type: 'number', defaultValue: 42, min: 0 },
      { key: 'glazeAreaCm2', labelAr: 'مساحة التزجيج (الجليز)', unitAr: 'سم²', type: 'number', defaultValue: 420, min: 0 },
      { key: 'glazeGramsPerCm2', labelAr: 'استهلاك الجليز السطحي', unitAr: 'جم/سم²', type: 'number', defaultValue: 0.08, step: 0.01, min: 0, isCalibration: true },
      { key: 'glazePricePerKg', labelAr: 'سعر كيلو الجليز', unitAr: 'ج/كجم', type: 'number', defaultValue: 380, min: 0 },
      { key: 'bisqueKilnCostPerPiece', labelAr: 'حصة حرق البسكويت (الأولى)', unitAr: 'ج', type: 'number', defaultValue: 22, min: 0 },
      { key: 'glazeKilnCostPerPiece', labelAr: 'حصة حرق الجليز (الثانية)', unitAr: 'ج', type: 'number', defaultValue: 32, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const s = Math.min(0.4, Math.max(0, num(cal.linearShrinkagePercent ?? p.linearShrinkagePercent, 12) / 100));
      const dTarget = num(p.targetDiameterCm, 14);
      const dMake = dTarget / Math.max(0.5, 1 - s);
      const yW = Math.max(0.4, Math.min(1, num(cal.weightYieldFraction ?? p.weightYieldFraction, 0.82)));
      const wetNetG = num(p.firedWeightGrams, 450) / yW;
      const wastePct = num(p.wastePercent, 10);
      const { gross: wetGrossG, waste } = applyWasteOnNet(wetNetG, wastePct);
      const clayCost = (wetGrossG / 1000) * num(p.clayPricePerKg, 42);
      const glazeG = num(p.glazeAreaCm2, 420) * num(cal.glazeGramsPerCm2 ?? p.glazeGramsPerCm2, 0.08);
      const glazeCost = (glazeG / 1000) * num(p.glazePricePerKg, 380);
      const kilnCost = num(p.bisqueKilnCostPerPiece, 22) + num(p.glazeKilnCostPerPiece, 32);
      const extraCost = sumDynamicExtraMaterials(input) + glazeCost;
      return makeWaste(
        clayCost,
        wastePct,
        extraCost,
        `${wetNetG.toFixed(0)} جم طين رطب`,
        `${wetGrossG.toFixed(0)} جم طين رطب + ${glazeG.toFixed(0)} جم جليز`,
        'on_net',
        [
          { label: 'البعد الواجب تشكيله قبل الانكماش', value: `${dMake.toFixed(2)} سم (بدلاً من ${dTarget} سم)`, highlight: true },
          { label: 'الطين الرطب المنصرف', value: `${wetGrossG.toFixed(0)} جم` },
          { label: 'الجليز المستهلك', value: `${glazeG.toFixed(1)} جم (${glazeCost.toFixed(1)} ج)` },
          { label: 'تكلفة الحرقتين (بسكويت + جليز)', value: `${kilnCost.toFixed(0)} ج` },
        ],
        { totalWeightKg: wetGrossG / 1000, totalWeightGrams: wetGrossG, energyCostExtra: kilnCost, areaCm2: num(p.glazeAreaCm2, 420), wasteAmount: waste }
      );
    },
  },

  candles: {
    craftId: 'candles',
    mainSectionId: 'clays_composites',
    nameAr: 'الشموع (Candles)',
    defaultWastePercent: 3,
    indicativeHourlyRateRange: [40, 60],
    formulaSummaryAr: 'وزن الشمع = سعة_الوعاء × كثافة_الشمع | العطر إما من الشمع أو من الخليط النهائي (حسب الوصفة)',
    fields: [
      { key: 'vesselVolumeMl', labelAr: 'سعة الوعاء بالماء', unitAr: 'مل', type: 'number', defaultValue: 220, min: 1 },
      { key: 'waxDensity', labelAr: 'كثافة الشمع (من تجربة صب — لا تثبت 1)', unitAr: 'جم/مل', type: 'number', defaultValue: 0.86, step: 0.01, min: 0.5, isCalibration: true },
      {
        key: 'fragranceMode',
        labelAr: 'طريقة احتساب نسبة العطر',
        type: 'select',
        defaultValue: 'on_wax',
        options: [
          { value: 'on_wax', label: 'نسبة مضافة على وزن الشمع (M_f = M_wax × %)' },
          { value: 'of_total', label: 'نسبة من وزن الخليط النهائي (M_f = M_total × %)' },
        ],
      },
      { key: 'fragrancePercent', labelAr: 'نسبة الزيت العطري', unitAr: '%', type: 'number', defaultValue: 8, step: 0.5, min: 0, max: 15 },
      { key: 'dyePercent', labelAr: 'نسبة الصبغة من الشمع', unitAr: '%', type: 'number', defaultValue: 0.3, step: 0.1, min: 0, max: 5 },
      { key: 'wastePercent', labelAr: 'هالك الصهر والتفريغ على الصافي', unitAr: '%', type: 'number', defaultValue: 3, min: 0, max: 20 },
      { key: 'waxPricePerKg', labelAr: 'سعر كيلو الشمع', unitAr: 'ج/كجم', type: 'number', defaultValue: 260, min: 0 },
      { key: 'fragrancePricePerGram', labelAr: 'سعر جرام الزيت العطري', unitAr: 'ج/جم', type: 'number', defaultValue: 3.5, step: 0.5, min: 0 },
      { key: 'vesselAndWickCost', labelAr: 'تكلفة الوعاء + الفتيل والتثبيت', unitAr: 'ج', type: 'number', defaultValue: 38, min: 0 },
      { key: 'heaterKw', labelAr: 'قدرة سخان الصهر', unitAr: 'kW', type: 'number', defaultValue: 1.2, step: 0.1, min: 0 },
      { key: 'meltHours', labelAr: 'ساعات التشغيل للدُفعة ÷ عدد الشموع', unitAr: 'ساعة', type: 'number', defaultValue: 0.1, step: 0.05, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const vol = num(p.vesselVolumeMl, 220);
      const rho = num(cal.waxDensity ?? p.waxDensity, 0.86);
      const fPct = num(p.fragrancePercent, 8) / 100;
      const mode = String(p.fragranceMode || 'on_wax');
      const totalFillG = vol * rho;
      const netWaxG = mode === 'of_total' ? totalFillG * (1 - fPct) : totalFillG;
      const netFragG = mode === 'of_total' ? totalFillG * fPct : netWaxG * fPct;
      const wastePct = num(p.wastePercent, 3);
      const { gross: grossWaxG, waste } = applyWasteOnNet(netWaxG, wastePct);
      const { gross: grossFragG } = applyWasteOnNet(netFragG, wastePct);
      const waxCost = (grossWaxG / 1000) * num(p.waxPricePerKg, 260);
      const fragCost = grossFragG * num(p.fragrancePricePerGram, 3.5);
      const energyCost = num(p.heaterKw, 1.2) * num(p.meltHours, 0.1) * num(input.kwhPrice, 2.15);
      const extraCost = sumDynamicExtraMaterials(input) + fragCost + num(p.vesselAndWickCost, 38);
      return makeWaste(
        waxCost,
        wastePct,
        extraCost,
        `${netWaxG.toFixed(1)} جم شمع + ${netFragG.toFixed(1)} جم عطر`,
        `${grossWaxG.toFixed(1)} جم شمع + ${grossFragG.toFixed(1)} جم عطر`,
        'on_net',
        [
          { label: 'وزن الشمع المنصرف', value: `${grossWaxG.toFixed(1)} جم` },
          { label: `الزيت العطري (${mode === 'of_total' ? 'من الإجمالي' : 'على الشمع'})`, value: `${grossFragG.toFixed(1)} جم`, highlight: true },
          { label: 'كهرباء الصهر للقطعة', value: `${energyCost.toFixed(2)} ج` },
        ],
        { totalWeightKg: (grossWaxG + grossFragG) / 1000, totalWeightGrams: grossWaxG + grossFragG, volumeCm3: vol, energyCostExtra: energyCost, wasteAmount: waste }
      );
    },
  },

  cold_process_soap: {
    craftId: 'cold_process_soap',
    mainSectionId: 'clays_composites',
    nameAr: 'الصابون بالطريقة الباردة (Cold Process)',
    defaultWastePercent: 3,
    indicativeHourlyRateRange: [50, 75],
    safetyWarning: 'تحذير سلامة حرج: هيدروكسيد الصوديوم (NaOH) مادة كاوية حارقة! لا تعتمد الوصفة قبل المراجعة والاختبار وقياس الـ pH، وارتدِ نظارة كيميائية وقفازات مع التهوية.',
    formulaSummaryAr: 'NaOH_نظري = Σ(و_زيت × SAP) | بعد السوبرفات ×(1−SF) | ÷ النقاء | الماء = NaOH × (1−c) ÷ c',
    fields: [
      { key: 'oil1Grams', labelAr: 'الزيت 1 (مثل زيتون — SAP 0.135)', unitAr: 'جم', type: 'number', defaultValue: 500, min: 0 },
      { key: 'oil1Sap', labelAr: 'رقم تصبن الزيت 1 (جم NaOH/جم زيت)', type: 'number', defaultValue: 0.135, step: 0.001, min: 0.05, max: 0.3, isCalibration: true },
      { key: 'oil2Grams', labelAr: 'الزيت 2 (مثل جوز الهند — SAP 0.183)', unitAr: 'جم', type: 'number', defaultValue: 300, min: 0 },
      { key: 'oil2Sap', labelAr: 'رقم تصبن الزيت 2 (جم NaOH/جم زيت)', type: 'number', defaultValue: 0.183, step: 0.001, min: 0.05, max: 0.3, isCalibration: true },
      { key: 'oil3Grams', labelAr: 'الزيت 3 / زبدة (مثل شيا/نخيل — SAP 0.141)', unitAr: 'جم', type: 'number', defaultValue: 200, min: 0 },
      { key: 'oil3Sap', labelAr: 'رقم تصبن الزيت 3 (جم NaOH/جم زيت)', type: 'number', defaultValue: 0.141, step: 0.001, min: 0.05, max: 0.3, isCalibration: true },
      { key: 'superfatPercent', labelAr: 'فائض الدهون (Superfat)', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 20 },
      { key: 'naohPurityPercent', labelAr: 'نقاء الصودا الكاوية (NaOH)', unitAr: '%', type: 'number', defaultValue: 98, min: 70, max: 100, isCalibration: true },
      { key: 'lyeConcentrationPercent', labelAr: 'تركيز محلول الصودا (c)', unitAr: '%', type: 'number', defaultValue: 33, min: 20, max: 50, isCalibration: true },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 3, min: 0, max: 20 },
      { key: 'avgOilPricePerKg', labelAr: 'متوسط سعر كيلو خليط الزيوت', unitAr: 'ج/كجم', type: 'number', defaultValue: 240, min: 0 },
      { key: 'naohAndAdditivesCost', labelAr: 'تكلفة الصودا والعطر والطمي', unitAr: 'ج', type: 'number', defaultValue: 85, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const m1 = num(p.oil1Grams, 500);
      const m2 = num(p.oil2Grams, 300);
      const m3 = num(p.oil3Grams, 200);
      const sap1 = num(cal.oil1Sap ?? p.oil1Sap, 0.135);
      const sap2 = num(cal.oil2Sap ?? p.oil2Sap, 0.183);
      const sap3 = num(cal.oil3Sap ?? p.oil3Sap, 0.141);
      const naohTh = m1 * sap1 + m2 * sap2 + m3 * sap3;
      const sf = num(p.superfatPercent, 5) / 100;
      const naohAfterSf = naohTh * (1 - sf);
      const purity = Math.max(0.5, num(cal.naohPurityPercent ?? p.naohPurityPercent, 98) / 100);
      const naohWeigh = naohAfterSf / purity;
      const c = Math.max(0.15, Math.min(0.6, num(cal.lyeConcentrationPercent ?? p.lyeConcentrationPercent, 33) / 100));
      const waterG = naohAfterSf * ((1 - c) / c);
      const netOils = m1 + m2 + m3;
      const wastePct = num(p.wastePercent, 3);
      const { gross: grossOils, waste } = applyWasteOnNet(netOils, wastePct);
      const oilsCost = (grossOils / 1000) * num(p.avgOilPricePerKg, 240);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.naohAndAdditivesCost, 85);
      const totalBatchWeightG = grossOils + naohWeigh + waterG;
      return makeWaste(
        oilsCost,
        wastePct,
        extraCost,
        `${netOils.toFixed(0)} جم زيوت`,
        `${grossOils.toFixed(0)} جم زيوت + ${naohWeigh.toFixed(1)} جم NaOH + ${waterG.toFixed(0)} جم ماء`,
        'on_net',
        [
          { label: 'الصودا النظرية ← بعد السوبرفات ← الموزونة (نقاء)', value: `${naohTh.toFixed(1)} ← ${naohAfterSf.toFixed(1)} ← ${naohWeigh.toFixed(1)} جم`, highlight: true },
          { label: `الماء المقطر المطلوب (تركيز ${(c * 100).toFixed(0)}%)`, value: `${waterG.toFixed(1)} جم` },
          { label: 'إجمالي وزن دفعة العجين', value: `${totalBatchWeightG.toFixed(0)} جم` },
        ],
        { totalWeightKg: totalBatchWeightG / 1000, totalWeightGrams: totalBatchWeightG, wasteAmount: waste }
      );
    },
  },

  melt_pour_soap: {
    craftId: 'melt_pour_soap',
    mainSectionId: 'clays_composites',
    nameAr: 'الصابون بالصب (Melt & Pour)',
    isNewStar: true,
    defaultWastePercent: 3,
    indicativeHourlyRateRange: [35, 60],
    formulaSummaryAr: 'وزن القاعدة = حجم القالب × كثافة القاعدة | العطر = و × نسبة مسموحة',
    fields: [
      { key: 'moldVolumeMl', labelAr: 'حجم القالب', unitAr: 'مل (سم³)', type: 'number', defaultValue: 110, min: 1 },
      { key: 'baseDensity', labelAr: 'كثافة قاعدة الجليسرين', unitAr: 'جم/مل', type: 'number', defaultValue: 1.05, step: 0.01, min: 0.7, isCalibration: true },
      { key: 'fragrancePercent', labelAr: 'نسبة العطر الآمنة', unitAr: '%', type: 'number', defaultValue: 2.5, step: 0.5, min: 0, max: 5 },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 3, min: 0, max: 20 },
      { key: 'basePricePerKg', labelAr: 'سعر كيلو قاعدة الصابون', unitAr: 'ج/كجم', type: 'number', defaultValue: 190, min: 0 },
      { key: 'fragrancePricePerGram', labelAr: 'سعر جرام العطر واللون', unitAr: 'ج/جم', type: 'number', defaultValue: 3.5, step: 0.5, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const vol = num(p.moldVolumeMl, 110);
      const netM = vol * num(cal.baseDensity ?? p.baseDensity, 1.05);
      const wastePct = num(p.wastePercent, 3);
      const { gross: grossM, waste } = applyWasteOnNet(netM, wastePct);
      const fragG = grossM * (num(p.fragrancePercent, 2.5) / 100);
      const cost = (grossM / 1000) * num(p.basePricePerKg, 190);
      const extraCost = sumDynamicExtraMaterials(input) + fragG * num(p.fragrancePricePerGram, 3.5);
      return makeWaste(
        cost,
        wastePct,
        extraCost,
        `${netM.toFixed(1)} جم قاعدة`,
        `${grossM.toFixed(1)} جم قاعدة + ${fragG.toFixed(1)} جم عطر`,
        'on_net',
        [{ label: 'القاعدة المنصرفة والعطر', value: `${grossM.toFixed(1)} جم قاعدة | ${fragG.toFixed(1)} جم عطر`, highlight: true }],
        { totalWeightKg: grossM / 1000, totalWeightGrams: grossM, volumeCm3: vol, wasteAmount: waste }
      );
    },
  },

  mold_making: {
    craftId: 'mold_making',
    mainSectionId: 'clays_composites',
    nameAr: 'صناعة قوالب السيليكون',
    isNewStar: true,
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [55, 95],
    formulaSummaryAr: 'ح_سيليكون = ح_صندوق − ح_نموذج | و = ح × ث | المكونان بالوزن أ:ب | تُوزع على عدد الاستخدامات',
    fields: [
      { key: 'boxVolumeCm3', labelAr: 'حجم صندوق الصب', unitAr: 'سم³', type: 'number', defaultValue: 950, min: 1 },
      { key: 'modelVolumeCm3', labelAr: 'حجم النموذج الأصلي (الماستر)', unitAr: 'سم³', type: 'number', defaultValue: 320, min: 0 },
      { key: 'siliconeDensity', labelAr: 'كثافة مطاط السيليكون', unitAr: 'جم/سم³', type: 'number', defaultValue: 1.18, step: 0.01, min: 0.8, isCalibration: true },
      { key: 'partARatio', labelAr: 'نسبة المكون أ (سيليكون)', type: 'number', defaultValue: 100, min: 1, isCalibration: true },
      { key: 'partBRatio', labelAr: 'نسبة المكون ب (مصلب)', type: 'number', defaultValue: 2, min: 0.5, step: 0.5, isCalibration: true },
      { key: 'wastePercent', labelAr: 'هالك الصب على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 25 },
      { key: 'siliconePricePerKg', labelAr: 'سعر كيلو طقم السيليكون', unitAr: 'ج/كجم', type: 'number', defaultValue: 620, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const vSil = Math.max(1, num(p.boxVolumeCm3, 950) - num(p.modelVolumeCm3, 320));
      const netM = vSil * num(cal.siliconeDensity ?? p.siliconeDensity, 1.18);
      const wastePct = num(p.wastePercent, 5);
      const { gross: grossM, waste } = applyWasteOnNet(netM, wastePct);
      const rA = num(cal.partARatio ?? p.partARatio, 100);
      const rB = num(cal.partBRatio ?? p.partBRatio, 2);
      const partA = grossM * (rA / (rA + rB));
      const partB = grossM * (rB / (rA + rB));
      const cost = (grossM / 1000) * num(p.siliconePricePerKg, 620);
      const extraCost = sumDynamicExtraMaterials(input);
      return makeWaste(
        cost,
        wastePct,
        extraCost,
        `${netM.toFixed(1)} جم سيليكون`,
        `${grossM.toFixed(1)} جم (أ=${partA.toFixed(1)}، ب=${partB.toFixed(1)})`,
        'on_net',
        [
          { label: 'حجم السيليكون الفعلي', value: `${vSil.toFixed(0)} سم³` },
          { label: 'المكونان بالوزن', value: `أ: ${partA.toFixed(1)} جم | ب: ${partB.toFixed(1)} جم`, highlight: true },
        ],
        { totalWeightKg: grossM / 1000, totalWeightGrams: grossM, volumeCm3: vSil, wasteAmount: waste }
      );
    },
  },

  relative_recipes: {
    craftId: 'relative_recipes',
    mainSectionId: 'clays_composites',
    nameAr: 'الوصفات النسبية (بلسم، عطور، بخور)',
    isNewStar: true,
    defaultWastePercent: 4,
    indicativeHourlyRateRange: [45, 75],
    formulaSummaryAr: 'وزن كل مكون = وزن الدفعة × نسبته (المجموع 100%) + هالك الأواني والتعبئة',
    fields: [
      { key: 'batchWeightGrams', labelAr: 'وزن الدفعة الصافي الكلي', unitAr: 'جم', type: 'number', defaultValue: 500, min: 1 },
      { key: 'component1Percent', labelAr: 'نسبة المكون الأساسي 1', unitAr: '%', type: 'number', defaultValue: 70, min: 0, max: 100 },
      { key: 'component1PricePerKg', labelAr: 'سعر كيلو المكون 1', unitAr: 'ج/كجم', type: 'number', defaultValue: 300, min: 0 },
      { key: 'component2Percent', labelAr: 'نسبة المكون الوسطي 2', unitAr: '%', type: 'number', defaultValue: 20, min: 0, max: 100 },
      { key: 'component2PricePerKg', labelAr: 'سعر كيلو المكون 2', unitAr: 'ج/كجم', type: 'number', defaultValue: 850, min: 0 },
      { key: 'component3Percent', labelAr: 'نسبة المكون العطري/الفعّال 3', unitAr: '%', type: 'number', defaultValue: 10, min: 0, max: 100 },
      { key: 'component3PricePerKg', labelAr: 'سعر كيلو المكون 3', unitAr: 'ج/كجم', type: 'number', defaultValue: 2200, min: 0 },
      { key: 'wastePercent', labelAr: 'هالك الأواني والتعبئة على الصافي', unitAr: '%', type: 'number', defaultValue: 4, min: 0, max: 25 },
    ],
    calculate: (input, p) => {
      const netM = num(p.batchWeightGrams, 500);
      const wastePct = num(p.wastePercent, 4);
      const { gross: grossM, waste } = applyWasteOnNet(netM, wastePct);
      const pct1 = num(p.component1Percent, 70);
      const pct2 = num(p.component2Percent, 20);
      const pct3 = num(p.component3Percent, 10);
      const sum = Math.max(1, pct1 + pct2 + pct3);
      const m1 = grossM * (pct1 / sum);
      const m2 = grossM * (pct2 / sum);
      const m3 = grossM * (pct3 / sum);
      const cost = (m1 / 1000) * num(p.component1PricePerKg, 300) + (m2 / 1000) * num(p.component2PricePerKg, 850) + (m3 / 1000) * num(p.component3PricePerKg, 2200);
      const extraCost = sumDynamicExtraMaterials(input);
      return makeWaste(
        cost,
        wastePct,
        extraCost,
        `${netM.toFixed(0)} جم`,
        `${grossM.toFixed(0)} جم (م1:${m1.toFixed(0)} | م2:${m2.toFixed(0)} | م3:${m3.toFixed(0)})`,
        'on_net',
        [
          { label: 'أوزان المكونات للخلط (تُقاس بميزان 0.1 جم)', value: `م1: ${m1.toFixed(1)} جم | م2: ${m2.toFixed(1)} جم | م3: ${m3.toFixed(1)} جم`, highlight: true },
        ],
        { totalWeightKg: grossM / 1000, totalWeightGrams: grossM, wasteAmount: waste }
      );
    },
  },

  // =========================================================================
  // القسم 4: الأخشاب والخامات الطبيعية
  // =========================================================================
  bamboo: {
    craftId: 'bamboo',
    mainSectionId: 'woods',
    nameAr: 'البامبو والخيزران',
    defaultWastePercent: 8,
    indicativeHourlyRateRange: [60, 90],
    formulaSummaryAr: 'ط_شراء = Σط × (1+ه) | الوزن = ط × وزن_المتر | خامة الربط = ن_نقاط × متوسط_الربطة | الورنيش = م ÷ غ',
    fields: [
      { key: 'totalLengthMeters', labelAr: 'مجموع أطوال البامبو الصافية', unitAr: 'م', type: 'number', defaultValue: 8, min: 0.1 },
      { key: 'weightPerMeterGrams', labelAr: 'وزن المتر للقطر', unitAr: 'جم/م', type: 'number', defaultValue: 180, min: 10, isCalibration: true },
      { key: 'jointsCount', labelAr: 'عدد نقاط الربط', type: 'number', defaultValue: 16, min: 0 },
      { key: 'avgTieMeters', labelAr: 'متوسط طول الربطة الواحدة', unitAr: 'م', type: 'number', defaultValue: 0.7, step: 0.1, min: 0, isCalibration: true },
      { key: 'varnishAreaCm2', labelAr: 'المساحة المطلوبة للورنيش', unitAr: 'سم²', type: 'number', defaultValue: 2500, min: 0 },
      { key: 'varnishCoverageCm2PerMl', labelAr: 'معدل تغطية الورنيش', unitAr: 'سم²/مل', type: 'number', defaultValue: 60, min: 1, isCalibration: true },
      { key: 'wastePercent', labelAr: 'هالك البامبو على الصافي', unitAr: '%', type: 'number', defaultValue: 8, min: 0, max: 35 },
      { key: 'pricePerMeter', labelAr: 'سعر متر البامبو', unitAr: 'ج/م', type: 'number', defaultValue: 35, min: 0 },
      { key: 'tieAndVarnishCost', labelAr: 'تكلفة الرباط والورنيش', unitAr: 'ج', type: 'number', defaultValue: 40, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const netM = num(p.totalLengthMeters, 8);
      const wastePct = num(p.wastePercent, 8);
      const { gross: grossM, waste } = applyWasteOnNet(netM, wastePct);
      const weightG = grossM * num(cal.weightPerMeterGrams ?? p.weightPerMeterGrams, 180);
      const tieM = num(p.jointsCount, 16) * num(cal.avgTieMeters ?? p.avgTieMeters, 0.7);
      const varnishMl = num(p.varnishAreaCm2, 2500) / Math.max(1, num(cal.varnishCoverageCm2PerMl ?? p.varnishCoverageCm2PerMl, 60));
      const cost = grossM * num(p.pricePerMeter, 35);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.tieAndVarnishCost, 40);
      return makeWaste(
        cost,
        wastePct,
        extraCost,
        `${netM.toFixed(1)} م بامبو`,
        `${grossM.toFixed(1)} م (${(weightG / 1000).toFixed(2)} كجم)`,
        'on_net',
        [
          { label: 'طول الشراء (+هالك)', value: `${grossM.toFixed(1)} متر` },
          { label: 'خامة الربط المطلوبة', value: `${tieM.toFixed(1)} متر` },
          { label: 'الورنيش المحسوب بالمساحة', value: `${varnishMl.toFixed(0)} مل` },
        ],
        { totalWeightKg: weightG / 1000, totalWeightGrams: weightG, totalLengthMeters: Math.round(grossM), wasteAmount: waste }
      );
    },
  },

  wicker: {
    craftId: 'wicker',
    mainSectionId: 'woods',
    nameAr: 'الخوص وسعف النخيل',
    defaultWastePercent: 17.65,
    isYieldOrNestingBased: true,
    indicativeHourlyRateRange: [35, 55],
    formulaSummaryAr: 'الخوص الصالح = م × وزن/م² | الخام = الصالح ÷ العائد (Y) — بدون تطبيق هالك مكرر',
    fields: [
      { key: 'areaSqM', labelAr: 'مساحة القطعة المنسوجة', unitAr: 'م²', type: 'number', defaultValue: 0.45, step: 0.05, min: 0.05 },
      { key: 'gramsPerSqM', labelAr: 'معدل وزن الخوص لكل م²', unitAr: 'جم/م²', type: 'number', defaultValue: 650, min: 50, isCalibration: true },
      { key: 'sortingYield', labelAr: 'العائد بعد الفرز (Y من 0.5 إلى 1)', type: 'number', defaultValue: 0.85, step: 0.01, min: 0.4, max: 1, isCalibration: true, hintAr: 'لا يضاف هالك إضافي فوق العائد لمنع الازدواج' },
      { key: 'weavePathCm', labelAr: 'طول مسار النسج', unitAr: 'سم', type: 'number', defaultValue: 180, min: 1 },
      { key: 'stripSpacingCm', labelAr: 'المسافة بين الشرائح', unitAr: 'سم', type: 'number', defaultValue: 1.5, step: 0.1, min: 0.2 },
      { key: 'pricePerKg', labelAr: 'سعر كيلو الخوص الخام', unitAr: 'ج/كجم', type: 'number', defaultValue: 110, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const mValid = num(p.areaSqM, 0.45) * num(cal.gramsPerSqM ?? p.gramsPerSqM, 650);
      const y = Math.max(0.3, Math.min(1, num(cal.sortingYield ?? p.sortingYield, 0.85)));
      const mRaw = mValid / y;
      const equivWaste = yieldToWasteOnNet(y);
      const strips = Math.ceil(num(p.weavePathCm, 180) / Math.max(0.2, num(p.stripSpacingCm, 1.5)));
      const cost = (mRaw / 1000) * num(p.pricePerKg, 110);
      const extraCost = sumDynamicExtraMaterials(input);
      return makeWaste(
        cost,
        equivWaste,
        extraCost,
        `${mValid.toFixed(0)} جم صالح`,
        `${mRaw.toFixed(0)} جم خام (عائد ${Math.round(y * 100)}%)`,
        'yield_factor',
        [
          { label: 'الوزن الصالح ← الخام (بدون هالك مكرر)', value: `${mValid.toFixed(0)} جم ← ${mRaw.toFixed(0)} جم`, highlight: true },
          { label: 'عدد الشرائح المطلوبة', value: `${strips} شريحة` },
        ],
        { totalWeightKg: mRaw / 1000, totalWeightGrams: mRaw, areaCm2: num(p.areaSqM, 0.45) * 10000, wasteAmount: mRaw - mValid }
      );
    },
  },

  rattan: {
    craftId: 'rattan',
    mainSectionId: 'woods',
    nameAr: 'الراتان (Rattan)',
    isNewStar: true,
    defaultWastePercent: 12,
    indicativeHourlyRateRange: [55, 85],
    formulaSummaryAr: 'ط = مجموع أطوال المسارات والهيكل × (1 + ه) | الشرائح = ط_مسار ÷ المسافة',
    fields: [
      { key: 'totalLengthMeters', labelAr: 'أطوال مسارات الراتان والهيكل الصافية', unitAr: 'م', type: 'number', defaultValue: 12, min: 0.5 },
      { key: 'weightPerMeterGrams', labelAr: 'وزن المتر', unitAr: 'جم/م', type: 'number', defaultValue: 45, min: 1, isCalibration: true },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 12, min: 0, max: 35 },
      { key: 'pricePerMeter', labelAr: 'سعر متر الراتان', unitAr: 'ج/م', type: 'number', defaultValue: 28, min: 0 },
      { key: 'jointsCost', labelAr: 'تكلفة الربط والوصلات', unitAr: 'ج', type: 'number', defaultValue: 35, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const netM = num(p.totalLengthMeters, 12);
      const wastePct = num(p.wastePercent, 12);
      const { gross: grossM, waste } = applyWasteOnNet(netM, wastePct);
      const weightG = grossM * num(cal.weightPerMeterGrams ?? p.weightPerMeterGrams, 45);
      const cost = grossM * num(p.pricePerMeter, 28);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.jointsCost, 35);
      return makeWaste(
        cost,
        wastePct,
        extraCost,
        `${netM.toFixed(1)} م`,
        `${grossM.toFixed(1)} م (${(weightG / 1000).toFixed(2)} كجم)`,
        'on_net',
        [{ label: 'الراتان المنصرف (+هالك)', value: `${grossM.toFixed(1)} م`, highlight: true }],
        { totalWeightKg: weightG / 1000, totalWeightGrams: weightG, totalLengthMeters: Math.round(grossM), wasteAmount: waste }
      );
    },
  },

  scroll_saw: {
    craftId: 'scroll_saw',
    mainSectionId: 'woods',
    nameAr: 'الأركت والتفريغ',
    defaultWastePercent: 17.65,
    isYieldOrNestingBased: true,
    indicativeHourlyRateRange: [55, 85],
    formulaSummaryAr: 'عدد الألواح = ⌈م_قطع ÷ (م_لوح × ص_ك)⌉ (لا يُضاف هالك 15% فوق الكفاءة) | السنون = ⌈طول_القطع ÷ عمر_السن⌉',
    fields: [
      { key: 'partsAreaCm2', labelAr: 'مساحة القطع الصافية', unitAr: 'سم²', type: 'number', defaultValue: 2200, min: 1 },
      { key: 'boardAreaCm2', labelAr: 'مساحة اللوح القياسي', unitAr: 'سم²', type: 'number', defaultValue: 14884, min: 100, isCalibration: true, hintAr: 'مثال: 122×122 سم = 14884 سم²' },
      { key: 'nestingEfficiency', labelAr: 'كفاءة التعشيق (ص_ك = 0.60 إلى 0.92)', type: 'number', defaultValue: 0.85, step: 0.02, min: 0.3, max: 0.98, isCalibration: true },
      { key: 'boardPrice', labelAr: 'سعر اللوح الواحد', unitAr: 'ج', type: 'number', defaultValue: 320, min: 0 },
      { key: 'cutPathLengthCm', labelAr: 'طول مسار القص الإجمالي', unitAr: 'سم', type: 'number', defaultValue: 480, min: 1 },
      { key: 'bladeLifeCm', labelAr: 'العمر التشغيلي لسن الأركت', unitAr: 'سم', type: 'number', defaultValue: 200, min: 10, isCalibration: true },
      { key: 'bladePrice', labelAr: 'سعر السن (الريشة)', unitAr: 'ج', type: 'number', defaultValue: 12, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const aParts = num(p.partsAreaCm2, 2200);
      const aBoard = Math.max(1, num(cal.boardAreaCm2 ?? p.boardAreaCm2, 14884));
      const eta = Math.max(0.25, Math.min(0.98, num(cal.nestingEfficiency ?? p.nestingEfficiency, 0.85)));
      const exactBoards = aParts / (aBoard * eta);
      const boardsCeil = Math.ceil(exactBoards);
      const equivWaste = yieldToWasteOnNet(eta);
      const woodCost = boardsCeil * num(p.boardPrice, 320);
      const bladesCount = Math.ceil(num(p.cutPathLengthCm, 480) / Math.max(1, num(cal.bladeLifeCm ?? p.bladeLifeCm, 200)));
      const bladesCost = bladesCount * num(p.bladePrice, 12);
      const extraCost = sumDynamicExtraMaterials(input) + bladesCost;
      return makeWaste(
        woodCost,
        equivWaste,
        extraCost,
        `${aParts.toFixed(0)} سم² صافي`,
        `${boardsCeil} لوح (كفاءة التعشيق ${Math.round(eta * 100)}%)`,
        'nesting_efficiency',
        [
          { label: 'عدد الألواح المطلوب شراءها (تقريب لأعلى)', value: `${boardsCeil} لوح (كسري: ${exactBoards.toFixed(2)})`, highlight: true },
          { label: 'عدد سنون الأركت المستهلكة', value: `${bladesCount} سن (${bladesCost.toFixed(0)} ج)` },
        ],
        { areaCm2: aParts, wasteAmount: boardsCeil * aBoard - aParts }
      );
    },
  },

  arabesque: {
    craftId: 'arabesque',
    mainSectionId: 'woods',
    nameAr: 'الأرابيسك والتصديف',
    defaultWastePercent: 20,
    indicativeHourlyRateRange: [80, 140],
    formulaSummaryAr: 'حجم البرمق = π × نق² × ط | الوزن = الحجم الكلي × ث_خشب | الصدف = م_ترصيع × جرام/سم² (+20%)',
    fields: [
      { key: 'barmakRadiusCm', labelAr: 'نصف قطر البرمق (نق)', unitAr: 'سم', type: 'number', defaultValue: 0.8, step: 0.1, min: 0.1 },
      { key: 'barmakLengthCm', labelAr: 'طول البرمق', unitAr: 'سم', type: 'number', defaultValue: 12, min: 0.5 },
      { key: 'barmakCount', labelAr: 'عدد البرامق', type: 'number', defaultValue: 36, min: 0 },
      { key: 'woodDensity', labelAr: 'كثافة الخشب', unitAr: 'جم/سم³', type: 'number', defaultValue: 0.72, step: 0.02, min: 0.3, isCalibration: true },
      { key: 'woodPricePerKg', labelAr: 'سعر كيلو الخشب', unitAr: 'ج/كجم', type: 'number', defaultValue: 140, min: 0 },
      { key: 'inlayAreaCm2', labelAr: 'مساحة ترصيع الصدف', unitAr: 'سم²', type: 'number', defaultValue: 180, min: 0 },
      { key: 'shellGramsPerCm2', labelAr: 'وزن الصدف لكل سم²', unitAr: 'جم/سم²', type: 'number', defaultValue: 0.35, step: 0.05, min: 0, isCalibration: true },
      { key: 'shellWastePercent', labelAr: 'هالك الصدف على الصافي', unitAr: '%', type: 'number', defaultValue: 20, min: 0, max: 50 },
      { key: 'shellPricePerGram', labelAr: 'سعر جرام الصدف', unitAr: 'ج/جم', type: 'number', defaultValue: 6, min: 0 },
      { key: 'polishAndGlueCost', labelAr: 'فرنش بوليش وغراء', unitAr: 'ج', type: 'number', defaultValue: 55, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const r = num(p.barmakRadiusCm, 0.8);
      const l = num(p.barmakLengthCm, 12);
      const count = num(p.barmakCount, 36);
      const volTotal = Math.PI * r * r * l * count;
      const woodNetG = volTotal * num(cal.woodDensity ?? p.woodDensity, 0.72);
      const woodGrossG = woodNetG * 1.15;
      const woodCost = (woodGrossG / 1000) * num(p.woodPricePerKg, 140);

      const shellNetG = num(p.inlayAreaCm2, 180) * num(cal.shellGramsPerCm2 ?? p.shellGramsPerCm2, 0.35);
      const shellW = num(p.shellWastePercent, 20);
      const { gross: shellGrossG, waste } = applyWasteOnNet(shellNetG, shellW);
      const shellCost = shellGrossG * num(p.shellPricePerGram, 6);
      const extraCost = sumDynamicExtraMaterials(input) + woodCost + num(p.polishAndGlueCost, 55);
      return makeWaste(
        shellCost,
        shellW,
        extraCost,
        `${shellNetG.toFixed(1)} جم صدف + ${woodNetG.toFixed(0)} جم خشب`,
        `${shellGrossG.toFixed(1)} جم صدف + ${woodGrossG.toFixed(0)} جم خشب`,
        'on_net',
        [
          { label: 'حجم ووزن البرامق (15% هالك طبيعي)', value: `${volTotal.toFixed(0)} سم³ | ${woodGrossG.toFixed(0)} جم` },
          { label: `الصدف المنصرف (هالك ${shellW}%)`, value: `${shellGrossG.toFixed(1)} جم (${shellCost.toFixed(0)} ج)`, highlight: true },
        ],
        { totalWeightKg: (woodGrossG + shellGrossG) / 1000, totalWeightGrams: woodGrossG + shellGrossG, volumeCm3: volTotal, wasteAmount: waste }
      );
    },
  },

  carpentry: {
    craftId: 'carpentry',
    mainSectionId: 'woods',
    nameAr: 'النجارة والخراطة',
    defaultWastePercent: 15,
    indicativeHourlyRateRange: [70, 110],
    formulaSummaryAr: 'ح_صافي = ط×ع×ر | ح_خام = ح_صافي×(1+ه) | أو للألواح: ⌈م_قطع÷(م_لوح×ص_ك)⌉ | دهان = م×أوجه÷غ',
    fields: [
      {
        key: 'woodMode',
        labelAr: 'نوع الخشب',
        type: 'select',
        defaultValue: 'natural',
        options: [
          { value: 'natural', label: 'خشب طبيعي بالحجم م³ (هالك 15%)' },
          { value: 'sheet', label: 'ألواح بالمساحة والتعشيق ص_ك (12% مكافئ)' },
        ],
      },
      { key: 'lengthCm', labelAr: 'الطول', unitAr: 'سم', type: 'number', defaultValue: 60, min: 1 },
      { key: 'widthCm', labelAr: 'العرض', unitAr: 'سم', type: 'number', defaultValue: 35, min: 1 },
      { key: 'thicknessCm', labelAr: 'السمك', unitAr: 'سم', type: 'number', defaultValue: 2.5, step: 0.1, min: 0.2 },
      { key: 'woodDensityKgPerM3', labelAr: 'كثافة الخشب', unitAr: 'كجم/م³', type: 'number', defaultValue: 680, min: 200, isCalibration: true },
      { key: 'wastePercent', labelAr: 'نسبة الهالك للخشب الطبيعي', unitAr: '%', type: 'number', defaultValue: 15, min: 0, max: 45 },
      { key: 'nestingEfficiency', labelAr: 'كفاءة التعشيق للألواح (ص_ك)', type: 'number', defaultValue: 0.88, step: 0.02, min: 0.3, max: 0.98, isCalibration: true },
      { key: 'pricePerCubicMeter', labelAr: 'سعر المتر المكعب (للطبيعي)', unitAr: 'ج/م³', type: 'number', defaultValue: 19500, min: 0 },
      { key: 'sheetAreaSqM', labelAr: 'مساحة اللوح الكاملة (للألواح)', unitAr: 'م²', type: 'number', defaultValue: 2.9768, step: 0.01, min: 0.1, isCalibration: true },
      { key: 'sheetPrice', labelAr: 'سعر اللوح', unitAr: 'ج', type: 'number', defaultValue: 950, min: 0 },
      { key: 'paintCoats', labelAr: 'عدد أوجه الدهان والورنيش', type: 'number', defaultValue: 2, min: 0 },
      { key: 'paintCoverageSqMPerLiter', labelAr: 'تغطية الدهان', unitAr: 'م²/لتر', type: 'number', defaultValue: 10, min: 1, isCalibration: true },
      { key: 'paintPricePerLiter', labelAr: 'سعر لتر الدهان والورنيش', unitAr: 'ج/لتر', type: 'number', defaultValue: 260, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const lM = num(p.lengthCm, 60) / 100;
      const wM = num(p.widthCm, 35) / 100;
      const tM = num(p.thicknessCm, 2.5) / 100;
      const vNetM3 = lM * wM * tM;
      const areaSqM = lM * wM;
      const rho = num(cal.woodDensityKgPerM3 ?? p.woodDensityKgPerM3, 680);
      const mode = String(p.woodMode || 'natural');

      let woodCost = 0;
      let wastePct = num(p.wastePercent, 15);
      let grossKg = 0;
      let wasteMode: WorkshopMathResult['wasteMode'] = 'on_net';
      let grossLabel = '';
      if (mode === 'sheet') {
        const eta = Math.max(0.3, Math.min(0.98, num(cal.nestingEfficiency ?? p.nestingEfficiency, 0.88)));
        const aBoard = Math.max(0.1, num(cal.sheetAreaSqM ?? p.sheetAreaSqM, 2.9768));
        const boardsFraction = areaSqM / (aBoard * eta);
        const boardsNeeded = Math.ceil(boardsFraction);
        woodCost = boardsNeeded * num(p.sheetPrice, 950);
        wastePct = yieldToWasteOnNet(eta);
        wasteMode = 'nesting_efficiency';
        grossKg = vNetM3 * (1 / eta) * rho;
        grossLabel = `${boardsNeeded} لوح (معامل تعشيق ${Math.round(eta * 100)}%)`;
      } else {
        const { gross: vGross } = applyWasteOnNet(vNetM3, wastePct);
        woodCost = vGross * num(p.pricePerCubicMeter, 19500);
        grossKg = vGross * rho;
        grossLabel = `${vGross.toFixed(4)} م³ (${grossKg.toFixed(2)} كجم)`;
      }

      const coats = num(p.paintCoats, 2);
      const paintLiters = (areaSqM * 2 * coats) / Math.max(1, num(cal.paintCoverageSqMPerLiter ?? p.paintCoverageSqMPerLiter, 10));
      const paintCost = paintLiters * num(p.paintPricePerLiter, 260);
      const extraCost = sumDynamicExtraMaterials(input) + paintCost;
      return makeWaste(
        woodCost,
        wastePct,
        extraCost,
        `${vNetM3.toFixed(4)} م³ صافي`,
        grossLabel,
        wasteMode,
        [
          { label: 'الحجم الصافي للقطعة', value: `${vNetM3.toFixed(4)} م³` },
          { label: `الدهان والورنيش (${coats} أوجه)`, value: `${paintLiters.toFixed(2)} لتر (${paintCost.toFixed(0)} ج)` },
        ],
        { totalWeightKg: grossKg, totalWeightGrams: grossKg * 1000, volumeCm3: vNetM3 * 1e6, areaCm2: areaSqM * 10000 }
      );
    },
  },

  pyrography: {
    craftId: 'pyrography',
    mainSectionId: 'woods',
    nameAr: 'الحرق على الخشب (Pyrography)',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [50, 80],
    formulaSummaryAr: 'الخشب × (1+ه) | الكهرباء = قدرة_الجهاز × زمن_التنفيذ × سعر_KWh | الصنفرة والورنيش بالمساحة',
    fields: [
      { key: 'areaCm2', labelAr: 'مساحة اللوح الخشبي', unitAr: 'سم²', type: 'number', defaultValue: 600, min: 1 },
      { key: 'woodBlankPrice', labelAr: 'سعر قطعة الخشب الصافية', unitAr: 'ج', type: 'number', defaultValue: 65, min: 0 },
      { key: 'wastePercent', labelAr: 'نسبة الهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 30 },
      { key: 'burnerWatts', labelAr: 'قدرة ماكينة الحرق', unitAr: 'وات', type: 'number', defaultValue: 60, min: 5 },
      { key: 'burnHours', labelAr: 'زمن الحرق الفعلي', unitAr: 'ساعة', type: 'number', defaultValue: 3.5, step: 0.5, min: 0 },
      { key: 'finishAndSandCost', labelAr: 'الصنفرة والورنيش الواقي', unitAr: 'ج', type: 'number', defaultValue: 18, min: 0 },
    ],
    calculate: (input, p) => {
      const wastePct = num(p.wastePercent, 5);
      const woodCost = num(p.woodBlankPrice, 65) * (1 + wastePct / 100);
      const energyCost = (num(p.burnerWatts, 60) / 1000) * num(p.burnHours, 3.5) * num(input.kwhPrice, 2.15);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.finishAndSandCost, 18);
      return makeWaste(
        woodCost,
        wastePct,
        extraCost,
        `قطعة ${num(p.areaCm2, 600)} سم²`,
        `+ ${wastePct}% هالك`,
        'on_net',
        [{ label: 'كهرباء مكواة الحرق', value: `${energyCost.toFixed(2)} ج` }],
        { areaCm2: num(p.areaCm2, 600), energyCostExtra: energyCost }
      );
    },
  },

  decoupage: {
    craftId: 'decoupage',
    mainSectionId: 'woods',
    nameAr: 'الديكوباج (Decoupage)',
    defaultWastePercent: 10,
    indicativeHourlyRateRange: [50, 80],
    formulaSummaryAr: 'م_ورق = م_تصميم × ن_طبقات + هوامش القص (+10%) | الغراء والورنيش = م × أوجه ÷ غ',
    fields: [
      { key: 'designAreaCm2', labelAr: 'مساحة التصميم المطبوع', unitAr: 'سم²', type: 'number', defaultValue: 500, min: 1 },
      { key: 'paperLayers', labelAr: 'عدد طبقات الورق / المناديل', type: 'number', defaultValue: 1, min: 1 },
      { key: 'wastePercent', labelAr: 'هالك قص الورق على الصافي', unitAr: '%', type: 'number', defaultValue: 10, min: 0, max: 35 },
      { key: 'paperPricePer1000Cm2', labelAr: 'سعر ورق الديكوباج لكل 1000 سم²', unitAr: 'ج', type: 'number', defaultValue: 35, min: 0 },
      { key: 'basePieceCost', labelAr: 'تكلفة القاعدة (صينية/علبة خشب)', unitAr: 'ج', type: 'number', defaultValue: 95, min: 0 },
      { key: 'varnishAndGlueCoats', labelAr: 'عدد أوجه الغراء والورنيش', type: 'number', defaultValue: 3, min: 1 },
      { key: 'finishCoverageCm2PerMl', labelAr: 'معدل تغطية الغراء/الورنيش', unitAr: 'سم²/مل', type: 'number', defaultValue: 75, min: 1, isCalibration: true },
      { key: 'finishPricePerMl', labelAr: 'سعر مل المودبودج / الورنيش', unitAr: 'ج/مل', type: 'number', defaultValue: 0.9, step: 0.1, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const aNet = num(p.designAreaCm2, 500) * num(p.paperLayers, 1);
      const wastePct = num(p.wastePercent, 10);
      const { gross: aGross, waste } = applyWasteOnNet(aNet, wastePct);
      const paperCost = (aGross / 1000) * num(p.paperPricePer1000Cm2, 35);
      const finishMl = (num(p.designAreaCm2, 500) * num(p.varnishAndGlueCoats, 3)) / Math.max(1, num(cal.finishCoverageCm2PerMl ?? p.finishCoverageCm2PerMl, 75));
      const finishCost = finishMl * num(p.finishPricePerMl, 0.9);
      const extraCost = sumDynamicExtraMaterials(input) + finishCost + num(p.basePieceCost, 95);
      return makeWaste(
        paperCost,
        wastePct,
        extraCost,
        `${aNet.toFixed(0)} سم² ورق`,
        `${aGross.toFixed(0)} سم² ورق`,
        'on_net',
        [{ label: 'الغراء والورنيش المطلوب', value: `${finishMl.toFixed(1)} مل (${finishCost.toFixed(1)} ج)` }],
        { areaCm2: aGross, wasteAmount: waste }
      );
    },
  },

  wood_inlay: {
    craftId: 'wood_inlay',
    mainSectionId: 'woods',
    nameAr: 'تطعيم الخشب (Wood Inlay)',
    defaultWastePercent: 10,
    indicativeHourlyRateRange: [65, 110],
    formulaSummaryAr: 'ح_مادة = م_تطعيم × سمك | و = ح × ث | الغراء بالمساحة',
    fields: [
      { key: 'inlayAreaCm2', labelAr: 'مساحة التطعيم', unitAr: 'سم²', type: 'number', defaultValue: 150, min: 1 },
      { key: 'inlayThicknessCm', labelAr: 'سمك شريحة التطعيم', unitAr: 'سم', type: 'number', defaultValue: 0.3, step: 0.05, min: 0.05 },
      { key: 'materialDensity', labelAr: 'كثافة مادة التطعيم', unitAr: 'جم/سم³', type: 'number', defaultValue: 1.1, step: 0.05, min: 0.3, isCalibration: true },
      { key: 'wastePercent', labelAr: 'هالك التطعيم على الصافي', unitAr: '%', type: 'number', defaultValue: 10, min: 0, max: 35 },
      { key: 'inlayPricePerGram', labelAr: 'سعر جرام مادة التطعيم', unitAr: 'ج/جم', type: 'number', defaultValue: 3.5, step: 0.5, min: 0 },
      { key: 'baseAndGlueCost', labelAr: 'القاعدة الخشبية والغراء', unitAr: 'ج', type: 'number', defaultValue: 110, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const vol = num(p.inlayAreaCm2, 150) * num(p.inlayThicknessCm, 0.3);
      const netM = vol * num(cal.materialDensity ?? p.materialDensity, 1.1);
      const wastePct = num(p.wastePercent, 10);
      const { gross: grossM, waste } = applyWasteOnNet(netM, wastePct);
      const cost = grossM * num(p.inlayPricePerGram, 3.5);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.baseAndGlueCost, 110);
      return makeWaste(
        cost,
        wastePct,
        extraCost,
        `${netM.toFixed(1)} جم تطعيم`,
        `${grossM.toFixed(1)} جم تطعيم`,
        'on_net',
        [{ label: 'حجم التطعيم', value: `${vol.toFixed(1)} سم³` }],
        { totalWeightKg: grossM / 1000, totalWeightGrams: grossM, volumeCm3: vol, areaCm2: num(p.inlayAreaCm2, 150), wasteAmount: waste }
      );
    },
  },

  laser_cnc: {
    craftId: 'laser_cnc',
    mainSectionId: 'woods',
    nameAr: 'القص بالليزر والـ CNC',
    isNewStar: true,
    defaultWastePercent: 14.94,
    isYieldOrNestingBased: true,
    indicativeHourlyRateRange: [80, 140],
    formulaSummaryAr: 'ز_تشغيل = ط_قطع ÷ سرعة_القطع + م_نقش ÷ معدل_النقش | الألواح = ⌈م_قطع ÷ (م_لوح × ص_ك)⌉',
    fields: [
      { key: 'cutLengthCm', labelAr: 'طول مسار القص', unitAr: 'سم', type: 'number', defaultValue: 650, min: 0 },
      { key: 'cutSpeedCmPerMin', labelAr: 'سرعة القص المعايرة (للخامة والسمك)', unitAr: 'سم/دقيقة', type: 'number', defaultValue: 90, min: 1, isCalibration: true },
      { key: 'engraveAreaCm2', labelAr: 'مساحة النقش', unitAr: 'سم²', type: 'number', defaultValue: 180, min: 0 },
      { key: 'engraveRateCm2PerMin', labelAr: 'معدل النقش', unitAr: 'سم²/دقيقة', type: 'number', defaultValue: 45, min: 1, isCalibration: true },
      { key: 'machineRatePerMinute', labelAr: 'أجر دقيقة الماكينة', unitAr: 'ج/دقيقة', type: 'number', defaultValue: 4.5, step: 0.5, min: 0, isCalibration: true },
      { key: 'machineKw', labelAr: 'قدرة الليزر / CNC + الشفاط', unitAr: 'kW', type: 'number', defaultValue: 1.8, step: 0.1, min: 0, isCalibration: true },
      { key: 'partsAreaCm2', labelAr: 'مساحة الأجزاء الصافية', unitAr: 'سم²', type: 'number', defaultValue: 1600, min: 1 },
      { key: 'boardAreaCm2', labelAr: 'مساحة اللوح القياسي', unitAr: 'سم²', type: 'number', defaultValue: 14400, min: 100, isCalibration: true },
      { key: 'nestingEfficiency', labelAr: 'كفاءة التعشيق (ص_ك)', type: 'number', defaultValue: 0.87, step: 0.02, min: 0.3, max: 0.98, isCalibration: true },
      { key: 'boardPrice', labelAr: 'سعر اللوح', unitAr: 'ج', type: 'number', defaultValue: 280, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const cutMin = num(p.cutLengthCm, 650) / Math.max(1, num(cal.cutSpeedCmPerMin ?? p.cutSpeedCmPerMin, 90));
      const engMin = num(p.engraveAreaCm2, 180) / Math.max(1, num(cal.engraveRateCm2PerMin ?? p.engraveRateCm2PerMin, 45));
      const totalMin = cutMin + engMin;
      const runHrs = totalMin / 60;
      const opCost = totalMin * num(cal.machineRatePerMinute ?? p.machineRatePerMinute, 4.5) + runHrs * num(cal.machineKw ?? p.machineKw, 1.8) * num(input.kwhPrice, 2.15);

      const aParts = num(p.partsAreaCm2, 1600);
      const aBoard = Math.max(1, num(cal.boardAreaCm2 ?? p.boardAreaCm2, 14400));
      const eta = Math.max(0.25, Math.min(0.98, num(cal.nestingEfficiency ?? p.nestingEfficiency, 0.87)));
      const boards = Math.ceil(aParts / (aBoard * eta));
      const equivWaste = yieldToWasteOnNet(eta);
      const woodCost = boards * num(p.boardPrice, 280);
      const extraCost = sumDynamicExtraMaterials(input);
      return makeWaste(
        woodCost,
        equivWaste,
        extraCost,
        `${aParts.toFixed(0)} سم² قص`,
        `${boards} لوح (${totalMin.toFixed(1)} دقيقة تشغيل)`,
        'nesting_efficiency',
        [
          { label: 'زمن التشغيل الكلي (قص + نقش)', value: `${totalMin.toFixed(1)} دقيقة (${cutMin.toFixed(1)} قص + ${engMin.toFixed(1)} نقش)`, highlight: true },
          { label: 'تكلفة تشغيل الماكينة + الكهرباء', value: `${opCost.toFixed(1)} ج` },
          { label: 'الألواح المطلوبة (كفاءة التعشيق)', value: `${boards} لوح (كفاءة ${Math.round(eta * 100)}%)` },
        ],
        { areaCm2: aParts, energyCostExtra: opCost }
      );
    },
  },

  '3d_printing': {
    craftId: '3d_printing',
    mainSectionId: 'woods',
    nameAr: 'الطباعة ثلاثية الأبعاد (3D Printing)',
    isNewStar: true,
    defaultWastePercent: 12,
    indicativeHourlyRateRange: [50, 90],
    formulaSummaryAr: 'وزن الفيلامنت = وزن السلايسر × (1 + ه_دعامات) | الكهرباء = قدرة × ساعات × السعر | إهلاك بالساعة',
    fields: [
      { key: 'slicerWeightGrams', labelAr: 'الوزن الصافي من برنامج التقطيع (Slicer)', unitAr: 'جم', type: 'number', defaultValue: 145, min: 1 },
      { key: 'supportsWastePercent', labelAr: 'نسبة الدعامات والهالك (ه_دعامات)', unitAr: '%', type: 'number', defaultValue: 12, min: 0, max: 60 },
      { key: 'filamentPricePerKg', labelAr: 'سعر كيلو بكرة الفيلامنت', unitAr: 'ج/كجم', type: 'number', defaultValue: 680, min: 0 },
      { key: 'printHours', labelAr: 'ساعات الطباعة الفعلية', unitAr: 'ساعة', type: 'number', defaultValue: 6.5, step: 0.5, min: 0.1 },
      { key: 'printerKw', labelAr: 'قدرة الطابعة المتوسطة', unitAr: 'kW', type: 'number', defaultValue: 0.18, step: 0.02, min: 0.02, isCalibration: true },
      { key: 'printerHourlyDep', labelAr: 'إهلاك الطابعة والصيانة في الساعة', unitAr: 'ج/ساعة', type: 'number', defaultValue: 6, step: 0.5, min: 0, isCalibration: true },
    ],
    calculate: (input, p, cal) => {
      const mSlicer = num(p.slicerWeightGrams, 145);
      const wastePct = num(p.supportsWastePercent, 12);
      const { gross: grossG, waste } = applyWasteOnNet(mSlicer, wastePct);
      const filamentCost = (grossG / 1000) * num(p.filamentPricePerKg, 680);
      const hrs = num(p.printHours, 6.5);
      const kwhCost = hrs * num(cal.printerKw ?? p.printerKw, 0.18) * num(input.kwhPrice, 2.15);
      const depCost = hrs * num(cal.printerHourlyDep ?? p.printerHourlyDep, 6);
      const extraCost = sumDynamicExtraMaterials(input);
      return makeWaste(
        filamentCost,
        wastePct,
        extraCost,
        `${mSlicer.toFixed(0)} جم سلايسر`,
        `${grossG.toFixed(0)} جم (+دعامات)`,
        'on_net',
        [
          { label: 'كهرباء الطابعة', value: `${kwhCost.toFixed(1)} ج` },
          { label: 'إهلاك الطابعة والصيانة للقطعة', value: `${depCost.toFixed(1)} ج` },
        ],
        { totalWeightKg: grossG / 1000, totalWeightGrams: grossG, energyCostExtra: kwhCost + depCost, wasteAmount: waste }
      );
    },
  },
};
