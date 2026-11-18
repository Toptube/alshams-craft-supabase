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

export const WORKSHOP_SPECS_PART_2: Record<string, WorkshopSpec> = {
  // =========================================================================
  // القسم 5: الجلود
  // =========================================================================
  leathercraft: {
    craftId: 'leathercraft',
    mainSectionId: 'leather',
    nameAr: 'صناعة الجلود (طبيعي وصناعي)',
    defaultWastePercent: 20,
    isYieldOrNestingBased: true,
    indicativeHourlyRateRange: [65, 100],
    formulaSummaryAr: 'مساحة الشراء = م_باترون ÷ ص_ك | القدم المربع = سم² ÷ 929.03 | خيط سادل ستيتش = ط_مسار × ل_خياطة',
    fields: [
      { key: 'patternAreaCm2', labelAr: 'مجموع مساحات أجزاء الباترون (م_باترون)', unitAr: 'سم²', type: 'number', defaultValue: 1850, min: 1 },
      { key: 'nestingEfficiency', labelAr: 'كفاءة التعشيق (طبيعي ~0.83، صناعي ~0.91)', type: 'number', defaultValue: 0.83, step: 0.01, min: 0.4, max: 0.98, isCalibration: true },
      { key: 'pricePerSqFt', labelAr: 'سعر القدم المربع للجلد', unitAr: 'ج/قدم²', type: 'number', defaultValue: 75, min: 0 },
      { key: 'seamLengthCm', labelAr: 'طول مسار الخياطة (ط_مسار)', unitAr: 'سم', type: 'number', defaultValue: 140, min: 0 },
      { key: 'stitchMultiplier', labelAr: 'معامل خيط السادل ستيتش (ل_خياطة 3.5–4.2)', type: 'number', defaultValue: 3.8, step: 0.1, min: 1, isCalibration: true },
      { key: 'threadPricePerMeter', labelAr: 'سعر متر الخيط المشمع', unitAr: 'ج/م', type: 'number', defaultValue: 2.5, step: 0.5, min: 0 },
      { key: 'edgePerimeterMeters', labelAr: 'طول الحواف المطلوب دهانها', unitAr: 'م', type: 'number', defaultValue: 1.6, step: 0.1, min: 0 },
      { key: 'edgePaintCostPerMeter', labelAr: 'تكلفة دهان الحواف للمتر', unitAr: 'ج/م', type: 'number', defaultValue: 12, min: 0, isCalibration: true },
      { key: 'liningFoamHardwareCost', labelAr: 'تكلفة البطانة والفوم والإكسسوارات (كبسولات/أبازيم)', unitAr: 'ج', type: 'number', defaultValue: 85, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const aPat = num(p.patternAreaCm2, 1850);
      const eta = Math.max(0.35, Math.min(0.98, num(cal.nestingEfficiency ?? p.nestingEfficiency, 0.83)));
      const aBuyCm2 = aPat / eta;
      const sqFtBuy = aBuyCm2 / 929.03;
      const equivWaste = yieldToWasteOnNet(eta);
      const leatherCost = sqFtBuy * num(p.pricePerSqFt, 75);

      const seamThreadM = (num(p.seamLengthCm, 140) / 100) * num(cal.stitchMultiplier ?? p.stitchMultiplier, 3.8);
      const threadCost = seamThreadM * num(p.threadPricePerMeter, 2.5);
      const edgeCost = num(p.edgePerimeterMeters, 1.6) * num(cal.edgePaintCostPerMeter ?? p.edgePaintCostPerMeter, 12);
      const extraCost = sumDynamicExtraMaterials(input) + threadCost + edgeCost + num(p.liningFoamHardwareCost, 85);

      return makeWaste(
        leatherCost,
        equivWaste,
        extraCost,
        `${(aPat / 929.03).toFixed(2)} قدم² باترون`,
        `${sqFtBuy.toFixed(2)} قدم² شراء (${aBuyCm2.toFixed(0)} سم²)`,
        'nesting_efficiency',
        [
          { label: 'المساحة المطلوب شراؤها بالقدم المربع', value: `${sqFtBuy.toFixed(2)} قدم² (معامل استغلال ${Math.round(eta * 100)}%)`, highlight: true },
          { label: 'خيط السادل ستيتش المشمع', value: `${seamThreadM.toFixed(2)} متر (${threadCost.toFixed(1)} ج)` },
          { label: 'دهان الحواف', value: `${edgeCost.toFixed(1)} ج` },
        ],
        { areaCm2: aBuyCm2, totalLengthMeters: Number(seamThreadM.toFixed(2)), wasteAmount: aBuyCm2 - aPat }
      );
    },
  },

  // =========================================================================
  // القسم 6: المعادن والحدادة وتشكيل النحاس والفضة
  // =========================================================================
  metalwork_forging: {
    craftId: 'metalwork_forging',
    mainSectionId: 'metals',
    nameAr: 'المعادن والحدادة (حديد / ألومنيوم / ستانلس)',
    defaultWastePercent: 8,
    indicativeHourlyRateRange: [75, 120],
    formulaSummaryAr: 'وزن المتر (كجم/م) = مساحة_المقطع(مم²) × الكثافة × 10⁻⁶ | للحديد دائري d²÷162 | لحام ودهان منفصلان',
    fields: [
      {
        key: 'metalType',
        labelAr: 'نوع المعدن (لتحديد الكثافة الصحيحة)',
        type: 'select',
        defaultValue: 'steel',
        options: [
          { value: 'steel', label: 'حديد صلب (7850 كجم/م³)' },
          { value: 'aluminum', label: 'ألومنيوم (2700 كجم/م³)' },
          { value: 'copper', label: 'نحاس أحمر/أصفر (8960 كجم/م³)' },
          { value: 'stainless', label: 'ستانلس ستيل (7930 كجم/م³)' },
        ],
      },
      {
        key: 'sectionShape',
        labelAr: 'شكل القطاع',
        type: 'select',
        defaultValue: 'round_bar',
        options: [
          { value: 'round_bar', label: 'قضيب دائري مصمت (d)' },
          { value: 'square_bar', label: 'قضيب مربع مصمت (الضلع)' },
          { value: 'flat_bar', label: 'خوصة / مسطح (العرض × السمك)' },
          { value: 'round_tube', label: 'ماسورة دائرية مجوفة (قطر × سمك)' },
        ],
      },
      { key: 'dim1Mm', labelAr: 'القطر أو الضلع أو العرض', unitAr: 'مم', type: 'number', defaultValue: 16, min: 0.5 },
      { key: 'dim2Mm', labelAr: 'السمك (للمسطح أو الماسورة المجوفة)', unitAr: 'مم', type: 'number', defaultValue: 2, min: 0.2 },
      { key: 'totalLengthMeters', labelAr: 'إجمالي طول الشاسيه والأجزاء', unitAr: 'م', type: 'number', defaultValue: 12, min: 0.1 },
      { key: 'wastePercent', labelAr: 'نسبة هالك القطعيات على الصافي', unitAr: '%', type: 'number', defaultValue: 8, min: 0, max: 35 },
      { key: 'pricePerKg', labelAr: 'سعر كيلو المعدن', unitAr: 'ج/كجم', type: 'number', defaultValue: 68, min: 0 },
      { key: 'weldMeters', labelAr: 'إجمالي أطوال اللحام', unitAr: 'م', type: 'number', defaultValue: 1.5, step: 0.1, min: 0 },
      { key: 'weldCostPerMeter', labelAr: 'استهلاك سلك وغاز اللحام للمتر', unitAr: 'ج/م', type: 'number', defaultValue: 45, min: 0, isCalibration: true },
      { key: 'coatingAndPrimerCost', labelAr: 'تكلفة البرايمر / الدهان أو الإلكتروستاتيك', unitAr: 'ج', type: 'number', defaultValue: 160, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const metalDensities: Record<string, number> = {
        steel: 7850,
        aluminum: 2700,
        copper: 8960,
        stainless: 7930,
      };
      const rho = metalDensities[String(p.metalType || 'steel')] || 7850;
      const shape = String(p.sectionShape || 'round_bar');
      const d1 = num(p.dim1Mm, 16);
      const d2 = num(p.dim2Mm, 2);

      let areaMm2 = 0;
      if (shape === 'round_bar') {
        areaMm2 = Math.PI * (d1 / 2) * (d1 / 2);
      } else if (shape === 'square_bar') {
        areaMm2 = d1 * d1;
      } else if (shape === 'flat_bar') {
        areaMm2 = d1 * d2;
      } else {
        areaMm2 = Math.PI * Math.max(0.5, d1 - d2) * d2;
      }
      const kgPerM = areaMm2 * rho * 1e-6;
      const netKg = kgPerM * num(p.totalLengthMeters, 12);
      const wastePct = num(p.wastePercent, 8);
      const { gross: grossKg, waste } = applyWasteOnNet(netKg, wastePct);
      const metalCost = grossKg * num(p.pricePerKg, 68);
      const weldCost = num(p.weldMeters, 1.5) * num(cal.weldCostPerMeter ?? p.weldCostPerMeter, 45);
      const extraCost = sumDynamicExtraMaterials(input) + weldCost + num(p.coatingAndPrimerCost, 160);

      return makeWaste(
        metalCost,
        wastePct,
        extraCost,
        `${netKg.toFixed(2)} كجم صافي`,
        `${grossKg.toFixed(2)} كجم (+${wastePct}% هالك)`,
        'on_net',
        [
          { label: `وزن المتر الطولي (كثافة ${rho} كجم/م³)`, value: `${kgPerM.toFixed(3)} كجم/م`, highlight: true },
          { label: 'إجمالي وزن المعدن المنصرف', value: `${grossKg.toFixed(2)} كجم` },
          { label: 'تكلفة اللحام + الطلاء/الإلكتروستاتيك', value: `${(weldCost + num(p.coatingAndPrimerCost, 160)).toFixed(0)} ج` },
        ],
        { totalWeightKg: grossKg, totalWeightGrams: grossKg * 1000, totalLengthMeters: num(p.totalLengthMeters, 12), wasteAmount: waste * 1000 }
      );
    },
  },

  copper_silver_shaping: {
    craftId: 'copper_silver_shaping',
    mainSectionId: 'metals',
    nameAr: 'تشكيل الفضة والنحاس والألومنيوم',
    defaultWastePercent: 8.7,
    isYieldOrNestingBased: true,
    indicativeHourlyRateRange: [85, 150],
    formulaSummaryAr: 'الوزن الخام = النهائي ÷ (1 − ف) | للفضة: وزن النقي = الوزن × العيار (925 = 0.925) والسعر يومي',
    fields: [
      { key: 'finalWeightGrams', labelAr: 'الوزن النهائي للقطعة المشكّلة', unitAr: 'جم', type: 'number', defaultValue: 22, min: 0.5 },
      { key: 'metalLossPercent', labelAr: 'نسبة الفقد في البرد والصياغة (ف)', unitAr: '%', type: 'number', defaultValue: 8, min: 0, max: 40, hintAr: 'يُحوّل تلقائياً لهالك على الصافي f/(1-f)' },
      { key: 'finenessRatio', labelAr: 'العيار (فضة 925 = 0.925 | نحاس صافي = 1)', type: 'number', defaultValue: 0.925, step: 0.005, min: 0.1, max: 1 },
      { key: 'pureMetalDailyPricePerGram', labelAr: 'السعر اليومي لجرام المعدن النقي', unitAr: 'ج/جم', type: 'number', defaultValue: 72, min: 0 },
      { key: 'stoneAndSolderCost', labelAr: 'الفصوص / اللحام والترميل', unitAr: 'ج', type: 'number', defaultValue: 65, min: 0 },
    ],
    calculate: (input, p) => {
      const mFinal = num(p.finalWeightGrams, 22);
      const lossPct = Math.min(70, Math.max(0, num(p.metalLossPercent, 8)));
      const equivWaste = lossFractionToWasteOnNet(lossPct);
      const mRaw = mFinal / Math.max(0.2, 1 - lossPct / 100);
      const fineness = Math.max(0.1, Math.min(1, num(p.finenessRatio, 0.925)));
      const pureGrams = mRaw * fineness;
      const metalCost = pureGrams * num(p.pureMetalDailyPricePerGram, 72);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.stoneAndSolderCost, 65);
      return makeWaste(
        metalCost,
        equivWaste,
        extraCost,
        `${mFinal.toFixed(1)} جم صافي`,
        `${mRaw.toFixed(1)} جم خام (${pureGrams.toFixed(1)} جم نقي عيار ${(fineness * 1000).toFixed(0)})`,
        'yield_factor',
        [
          { label: 'الوزن الخام المطلوب الصياغة منه', value: `${mRaw.toFixed(2)} جم` },
          { label: 'محتوى المعدن النقي المحاسب بسعر اليوم', value: `${pureGrams.toFixed(2)} جم`, highlight: true },
        ],
        { totalWeightKg: mRaw / 1000, totalWeightGrams: mRaw, wasteAmount: mRaw - mFinal }
      );
    },
  },

  // =========================================================================
  // القسم 7: الديكور والإضاءة والزهور والزجاج والأكريليك
  // =========================================================================
  lighting_craft: {
    craftId: 'lighting_craft',
    mainSectionId: 'decor_lighting_flowers',
    nameAr: 'وحدات الإضاءة والنجف والأباجورات',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [50, 80],
    safetyWarning: 'تنبيه سلامة إلزامي: يجب تنفيذ التوصيلات الكهربائية بواسطة شخص مؤهل، مع اختبار العزل والأرضي قبل التسليم.',
    formulaSummaryAr: 'ط_سلك = مجموع المسار + هالك 5% | اللمبات والمحولات بالعدد | كهرباء الاختبار = قدرة × ساعات × سعر_KWh',
    fields: [
      { key: 'wirePathMeters', labelAr: 'مجموع أطوال المسار الكهربائي لكل المصادر', unitAr: 'م', type: 'number', defaultValue: 3.5, step: 0.5, min: 0.2 },
      { key: 'wireWastePercent', labelAr: 'هالك السلك على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 25 },
      { key: 'wirePricePerMeter', labelAr: 'سعر متر السلك الكهربائي المعتمد', unitAr: 'ج/م', type: 'number', defaultValue: 22, min: 0 },
      { key: 'bulbsAndHoldersCost', labelAr: 'تكلفة الدوايات واللمبات والفيشة والمفتاح', unitAr: 'ج', type: 'number', defaultValue: 135, min: 0 },
      { key: 'driverTransformerCost', labelAr: 'تكلفة المحول / الدرايفر (إن وجد)', unitAr: 'ج', type: 'number', defaultValue: 65, min: 0 },
      { key: 'bodyStructureCost', labelAr: 'تكلفة شاسيه / جسم وحدة الإضاءة', unitAr: 'ج', type: 'number', defaultValue: 150, min: 0 },
      { key: 'testLoadWatts', labelAr: 'قدرة الاختبار الكلية', unitAr: 'وات', type: 'number', defaultValue: 24, min: 0 },
      { key: 'testHours', labelAr: 'ساعات اختبار العزل والتشغيل', unitAr: 'ساعة', type: 'number', defaultValue: 2, min: 0 },
    ],
    calculate: (input, p) => {
      const netM = num(p.wirePathMeters, 3.5);
      const wastePct = num(p.wireWastePercent, 5);
      const { gross: grossM, waste } = applyWasteOnNet(netM, wastePct);
      const wireCost = grossM * num(p.wirePricePerMeter, 22);
      const testEnergyCost = (num(p.testLoadWatts, 24) / 1000) * num(p.testHours, 2) * num(input.kwhPrice, 2.15);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.bulbsAndHoldersCost, 135) + num(p.driverTransformerCost, 65) + num(p.bodyStructureCost, 150);
      return makeWaste(
        wireCost,
        wastePct,
        extraCost,
        `${netM.toFixed(1)} م سلك`,
        `${grossM.toFixed(1)} م سلك + مكونات كهربائية`,
        'on_net',
        [
          { label: 'السلك الكهربائي (+هالك 5%)', value: `${grossM.toFixed(2)} م (${wireCost.toFixed(1)} ج)` },
          { label: 'كهرباء اختبار التشغيل والعزل', value: `${testEnergyCost.toFixed(2)} ج` },
        ],
        { totalLengthMeters: Number(grossM.toFixed(2)), energyCostExtra: testEnergyCost, wasteAmount: waste }
      );
    },
  },

  natural_dried_flowers: {
    craftId: 'natural_dried_flowers',
    mainSectionId: 'decor_lighting_flowers',
    nameAr: 'تنسيق الزهور الطبيعية والمجففة',
    defaultWastePercent: 7,
    indicativeHourlyRateRange: [50, 85],
    formulaSummaryAr: 'عدد الفروع حسب القطر والكثافة (+7% هالك) | الإسفنج = حجم القاعدة | الشريط اللاصق = ط_سيقان × معدل',
    fields: [
      { key: 'stemsCount', labelAr: 'عدد الفروع الصافية للتنسيق', type: 'number', defaultValue: 24, min: 1 },
      { key: 'wastePercent', labelAr: 'نسبة التالف والهالك على الصافي', unitAr: '%', type: 'number', defaultValue: 7, min: 0, max: 35 },
      { key: 'avgStemPrice', labelAr: 'متوسط سعر الفرع / الغصن', unitAr: 'ج', type: 'number', defaultValue: 18, min: 0 },
      { key: 'foamAndVaseCost', labelAr: 'تكلفة الفازة / القاعدة والإسفنج الزهري', unitAr: 'ج', type: 'number', defaultValue: 85, min: 0 },
      { key: 'floralTapeAndWrapCost', labelAr: 'تكلفة الفلورال تيب والشرائط', unitAr: 'ج', type: 'number', defaultValue: 25, min: 0 },
    ],
    calculate: (input, p) => {
      const net = num(p.stemsCount, 24);
      const wastePct = num(p.wastePercent, 7);
      const { gross, waste } = applyWasteOnNet(net, wastePct);
      const cost = Math.ceil(gross) * num(p.avgStemPrice, 18);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.foamAndVaseCost, 85) + num(p.floralTapeAndWrapCost, 25);
      return makeWaste(cost, wastePct, extraCost, `${net} فرع`, `${Math.ceil(gross)} فرع`, 'on_net', [{ label: 'عدد الفروع المنصرفة (+هالك)', value: `${Math.ceil(gross)} فرع`, highlight: true }], { wasteAmount: waste });
    },
  },

  handmade_flowers: {
    craftId: 'handmade_flowers',
    mainSectionId: 'decor_lighting_flowers',
    nameAr: 'صناعة الزهور اليدوية (ستان / فوم / ورق)',
    defaultWastePercent: 7,
    indicativeHourlyRateRange: [50, 85],
    formulaSummaryAr: 'ن_بتلات = ن_زهور × بتلات_الزهرة | م_قماش = م_بتلة × ن_بتلات | سلك + غراء نقاط',
    fields: [
      { key: 'flowersCount', labelAr: 'عدد الزهور في البوكيه / القطعة', type: 'number', defaultValue: 12, min: 1 },
      { key: 'petalsPerFlower', labelAr: 'عدد البتلات لكل زهرة', type: 'number', defaultValue: 14, min: 1 },
      { key: 'petalAreaCm2', labelAr: 'مساحة البتلة الواحدة', unitAr: 'سم²', type: 'number', defaultValue: 18, min: 1 },
      { key: 'wastePercent', labelAr: 'هالك قص القماش/الفوم على الصافي', unitAr: '%', type: 'number', defaultValue: 7, min: 0, max: 35 },
      { key: 'fabricPricePerSqM', labelAr: 'سعر متر² القماش أو الفوم', unitAr: 'ج/م²', type: 'number', defaultValue: 140, min: 0 },
      { key: 'stemWireLengthCm', labelAr: 'طول السلك للساق الواحدة', unitAr: 'سم', type: 'number', defaultValue: 30, min: 1 },
      { key: 'wirePricePerMeter', labelAr: 'سعر متر السلك', unitAr: 'ج/م', type: 'number', defaultValue: 6, min: 0 },
      { key: 'gluePointsCost', labelAr: 'تكلفة الغراء والفلورال تيب', unitAr: 'ج', type: 'number', defaultValue: 22, min: 0 },
    ],
    calculate: (input, p) => {
      const petals = num(p.flowersCount, 12) * num(p.petalsPerFlower, 14);
      const netAreaSqM = (petals * num(p.petalAreaCm2, 18)) / 10000;
      const wastePct = num(p.wastePercent, 7);
      const { gross: grossSqM, waste } = applyWasteOnNet(netAreaSqM, wastePct);
      const fabCost = grossSqM * num(p.fabricPricePerSqM, 140);
      const wireM = (num(p.flowersCount, 12) * num(p.stemWireLengthCm, 30)) / 100;
      const wireCost = wireM * num(p.wirePricePerMeter, 6);
      const extraCost = sumDynamicExtraMaterials(input) + wireCost + num(p.gluePointsCost, 22);
      return makeWaste(
        fabCost,
        wastePct,
        extraCost,
        `${petals} بتلة (${netAreaSqM.toFixed(2)} م²)`,
        `${grossSqM.toFixed(2)} م² قماش + ${wireM.toFixed(1)} م سلك`,
        'on_net',
        [
          { label: 'إجمالي البتلات المطلوبة', value: `${petals} بتلة` },
          { label: 'القماش/الفوم المنصرف', value: `${grossSqM.toFixed(3)} م²` },
          { label: 'سلك السيقان', value: `${wireM.toFixed(1)} متر` },
        ],
        { areaCm2: grossSqM * 10000, totalLengthMeters: wireM, wasteAmount: waste * 10000 }
      );
    },
  },

  acrylic_glass_decor: {
    craftId: 'acrylic_glass_decor',
    mainSectionId: 'decor_lighting_flowers',
    nameAr: 'ديكورات الزجاج والأكريليك',
    defaultWastePercent: 12,
    isYieldOrNestingBased: true,
    indicativeHourlyRateRange: [60, 100],
    formulaSummaryAr: 'هالك القص = م_لوح − م_القطع_الصالحة | الوزن = م × سمك × ث | بدون تكرار مساحة المتراكب',
    fields: [
      { key: 'partsAreaCm2', labelAr: 'مجموع مساحة القطع الصافية', unitAr: 'سم²', type: 'number', defaultValue: 1200, min: 1 },
      { key: 'thicknessCm', labelAr: 'سمك الأكريليك / الزجاج', unitAr: 'سم', type: 'number', defaultValue: 0.4, step: 0.1, min: 0.1 },
      { key: 'density', labelAr: 'الكثافة (أكريليك 1.19 | زجاج 2.5)', unitAr: 'جم/سم³', type: 'number', defaultValue: 1.19, step: 0.01, min: 0.8, isCalibration: true },
      { key: 'nestingEfficiency', labelAr: 'كفاءة التعشيق في اللوح (ص_ك)', type: 'number', defaultValue: 0.88, step: 0.02, min: 0.4, max: 0.98, isCalibration: true },
      { key: 'pricePerSqM', labelAr: 'سعر المتر² للأكريليك / الزجاج', unitAr: 'ج/م²', type: 'number', defaultValue: 650, min: 0 },
      { key: 'spacersAndGlueCost', labelAr: 'مسامير أستاند وغراء كلوروفورم/UV', unitAr: 'ج', type: 'number', defaultValue: 35, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const aNetCm2 = num(p.partsAreaCm2, 1200);
      const eta = Math.max(0.35, Math.min(0.98, num(cal.nestingEfficiency ?? p.nestingEfficiency, 0.88)));
      const aBuyCm2 = aNetCm2 / eta;
      const equivWaste = yieldToWasteOnNet(eta);
      const weightG = aNetCm2 * num(p.thicknessCm, 0.4) * num(cal.density ?? p.density, 1.19);
      const cost = (aBuyCm2 / 10000) * num(p.pricePerSqM, 650);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.spacersAndGlueCost, 35);
      return makeWaste(
        cost,
        equivWaste,
        extraCost,
        `${aNetCm2.toFixed(0)} سم² (${weightG.toFixed(0)} جم)`,
        `${aBuyCm2.toFixed(0)} سم² شراء`,
        'nesting_efficiency',
        [{ label: 'الوزن الفعلي للقطعة', value: `${weightG.toFixed(0)} جم` }],
        { totalWeightKg: weightG / 1000, totalWeightGrams: weightG, areaCm2: aBuyCm2, wasteAmount: aBuyCm2 - aNetCm2 }
      );
    },
  },

  // =========================================================================
  // القسم 8: الفنون والطباعة والخط
  // =========================================================================
  canvas_painting: {
    craftId: 'canvas_painting',
    mainSectionId: 'arts_printing_calligraphy',
    nameAr: 'لوحات الكانفاس والأكريليك',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [50, 90],
    formulaSummaryAr: 'الجيسو = م ÷ غ × أوجه | الورنيش = م ÷ غ | القماش والإطار بالمحيط أو القطعة',
    fields: [
      { key: 'widthCm', labelAr: 'عرض اللوحة', unitAr: 'سم', type: 'number', defaultValue: 50, min: 5 },
      { key: 'heightCm', labelAr: 'ارتفاع اللوحة', unitAr: 'سم', type: 'number', defaultValue: 70, min: 5 },
      { key: 'gessoCoats', labelAr: 'عدد أوجه الجيسو', type: 'number', defaultValue: 2, min: 0 },
      { key: 'coverageCm2PerMl', labelAr: 'معدل تغطية الجيسو/الورنيش', unitAr: 'سم²/مل', type: 'number', defaultValue: 45, min: 5, isCalibration: true },
      { key: 'canvasFrameCost', labelAr: 'تكلفة الشاسيه الخشب والكانفاس', unitAr: 'ج', type: 'number', defaultValue: 185, min: 0 },
      { key: 'paintAndMediumsCost', labelAr: 'تكلفة الألوان المستخدمة فعلياً', unitAr: 'ج', type: 'number', defaultValue: 110, min: 0 },
      { key: 'wastePercent', labelAr: 'هالك الألوان والقماش على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 30 },
    ],
    calculate: (input, p, cal) => {
      const areaCm2 = num(p.widthCm, 50) * num(p.heightCm, 70);
      const cov = Math.max(1, num(cal.coverageCm2PerMl ?? p.coverageCm2PerMl, 45));
      const gessoVarnishMl = (areaCm2 * (num(p.gessoCoats, 2) + 1)) / cov;
      const wastePct = num(p.wastePercent, 5);
      const { gross: paintGrossCost, waste } = applyWasteOnNet(num(p.paintAndMediumsCost, 110), wastePct);
      const prepCost = gessoVarnishMl * 0.45;
      const extraCost = sumDynamicExtraMaterials(input) + num(p.canvasFrameCost, 185) + prepCost;
      return makeWaste(
        paintGrossCost,
        wastePct,
        extraCost,
        `لوحة ${areaCm2} سم²`,
        `جيسو + ورنيش ${gessoVarnishMl.toFixed(0)} مل`,
        'on_net',
        [{ label: 'كمية الجيسو والورنيش المحسوبة', value: `${gessoVarnishMl.toFixed(0)} مل (${prepCost.toFixed(0)} ج)` }],
        { areaCm2, wasteAmount: waste }
      );
    },
  },

  oil_painting: {
    craftId: 'oil_painting',
    mainSectionId: 'arts_printing_calligraphy',
    nameAr: 'الرسم بالألوان الزيتية',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [55, 95],
    formulaSummaryAr: 'الألوان المستخدمة فعلياً (بالوزن قبل وبعد) | تحذير: زمن الجفاف ليس وقت عمل مأجور',
    fields: [
      { key: 'oilPaintGramsUsed', labelAr: 'وزن الألوان الزيتية المستهلكة (قبل − بعد)', unitAr: 'جم', type: 'number', defaultValue: 45, min: 1 },
      { key: 'wastePercent', labelAr: 'هالك الباليت على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 25 },
      { key: 'paintPricePerGram', labelAr: 'سعر جرام اللون الزيتي', unitAr: 'ج/جم', type: 'number', defaultValue: 4.2, step: 0.2, min: 0 },
      { key: 'canvasAndMediumCost', labelAr: 'الشاسيه والتربنتين واللينسيد', unitAr: 'ج', type: 'number', defaultValue: 220, min: 0 },
    ],
    calculate: (input, p) => {
      const net = num(p.oilPaintGramsUsed, 45);
      const wastePct = num(p.wastePercent, 5);
      const { gross, waste } = applyWasteOnNet(net, wastePct);
      const cost = gross * num(p.paintPricePerGram, 4.2);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.canvasAndMediumCost, 220);
      return makeWaste(cost, wastePct, extraCost, `${net} جم ألوان`, `${gross.toFixed(1)} جم ألوان`, 'on_net', [], { totalWeightGrams: gross, totalWeightKg: gross / 1000, wasteAmount: waste });
    },
  },

  watercolor_gouache: {
    craftId: 'watercolor_gouache',
    mainSectionId: 'arts_printing_calligraphy',
    nameAr: 'الألوان المائية والجواش',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [50, 85],
    formulaSummaryAr: 'الأوراق = عدد الأعمال × المحاولات | الماء ليس خامة ذات تكلفة',
    fields: [
      { key: 'worksCount', labelAr: 'عدد الأعمال', type: 'number', defaultValue: 1, min: 1 },
      { key: 'attemptsFactor', labelAr: 'معامل المحاولات والمسودات (مثلاً 1.25)', type: 'number', defaultValue: 1.2, step: 0.1, min: 1, isCalibration: true },
      { key: 'sheetPrice', labelAr: 'سعر فرخ الورق القطني (300 جم)', unitAr: 'ج', type: 'number', defaultValue: 55, min: 0 },
      { key: 'pigmentUsedCost', labelAr: 'استهلاك الألوان الفعلي', unitAr: 'ج', type: 'number', defaultValue: 35, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const att = num(cal.attemptsFactor ?? p.attemptsFactor, 1.2);
      const sheets = num(p.worksCount, 1) * att;
      const equivWaste = (att - 1) * 100;
      const paperCost = sheets * num(p.sheetPrice, 55);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.pigmentUsedCost, 35);
      return makeWaste(paperCost, equivWaste, extraCost, `${p.worksCount || 1} فرخ`, `${sheets.toFixed(1)} فرخ بالمَسودات`, 'on_net');
    },
  },

  surface_painting: {
    craftId: 'surface_painting',
    mainSectionId: 'arts_printing_calligraphy',
    nameAr: 'الرسم على الأسطح (زجاج / خزف / خشب)',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [50, 90],
    formulaSummaryAr: 'برايمر ولون ومثبت = م × أوجه ÷ غ | التثبيت الحراري يدخل كهرباء فقط عند الحاجة',
    fields: [
      { key: 'paintAreaCm2', labelAr: 'مساحة الرسم والتغطية', unitAr: 'سم²', type: 'number', defaultValue: 600, min: 1 },
      { key: 'coatsCount', labelAr: 'عدد الأوجه (برايمر + لون + مثبت)', type: 'number', defaultValue: 3, min: 1 },
      { key: 'coverageCm2PerMl', labelAr: 'معدل التغطية', unitAr: 'سم²/مل', type: 'number', defaultValue: 55, min: 5, isCalibration: true },
      { key: 'paintPricePerMl', labelAr: 'سعر مل اللون/المثبت', unitAr: 'ج/مل', type: 'number', defaultValue: 1.4, step: 0.1, min: 0 },
      { key: 'surfaceItemCost', labelAr: 'سعر السطح الخام (مج / لوح / مرآة)', unitAr: 'ج', type: 'number', defaultValue: 75, min: 0 },
      { key: 'thermalCuringKw', labelAr: 'قدرة فرن التثبيت الحراري (0 إن جف هوائياً)', unitAr: 'kW', type: 'number', defaultValue: 0, step: 0.1, min: 0 },
      { key: 'thermalCuringHours', labelAr: 'ساعات التثبيت الحراري', unitAr: 'ساعة', type: 'number', defaultValue: 0, step: 0.1, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const netMl = (num(p.paintAreaCm2, 600) * num(p.coatsCount, 3)) / Math.max(1, num(cal.coverageCm2PerMl ?? p.coverageCm2PerMl, 55));
      const { gross: grossMl, waste } = applyWasteOnNet(netMl, 5);
      const paintCost = grossMl * num(p.paintPricePerMl, 1.4);
      const energy = num(p.thermalCuringKw, 0) * num(p.thermalCuringHours, 0) * num(input.kwhPrice, 2.15);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.surfaceItemCost, 75);
      return makeWaste(paintCost, 5, extraCost, `${netMl.toFixed(1)} مل`, `${grossMl.toFixed(1)} مل`, 'on_net', [], { areaCm2: num(p.paintAreaCm2, 600), energyCostExtra: energy, wasteAmount: waste });
    },
  },

  screen_printing: {
    craftId: 'screen_printing',
    mainSectionId: 'arts_printing_calligraphy',
    nameAr: 'الطباعة على القماش والشبلونة (Screen Printing)',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [55, 95],
    formulaSummaryAr: 'الحبر = م_طباعة × معدل × ن_مرات | تكلفة الشاشة = التجهيز ÷ عدد القطع المتوقعة',
    fields: [
      { key: 'printAreaCm2', labelAr: 'مساحة الطباعة الواحدة', unitAr: 'سم²', type: 'number', defaultValue: 500, min: 1 },
      { key: 'passesCount', labelAr: 'عدد السحبات / الألوان', type: 'number', defaultValue: 2, min: 1 },
      { key: 'inkGramsPer1000Cm2', labelAr: 'استهلاك الحبر لكل 1000 سم²', unitAr: 'جم', type: 'number', defaultValue: 12, min: 1, isCalibration: true },
      { key: 'inkPricePerKg', labelAr: 'سعر كيلو الحبر', unitAr: 'ج/كجم', type: 'number', defaultValue: 480, min: 0 },
      { key: 'screenSetupCost', labelAr: 'تكلفة تجهيز الشاشة والحساس', unitAr: 'ج', type: 'number', defaultValue: 280, min: 0 },
      { key: 'expectedPrintRuns', labelAr: 'عدد القطع المتوقعة على الشاشة', type: 'number', defaultValue: 50, min: 1 },
      { key: 'blankGarmentCost', labelAr: 'تكلفة القماش/التيشيرت/الكيس الفارغ', unitAr: 'ج', type: 'number', defaultValue: 95, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const inkNetG = (num(p.printAreaCm2, 500) / 1000) * num(cal.inkGramsPer1000Cm2 ?? p.inkGramsPer1000Cm2, 12) * num(p.passesCount, 2);
      const { gross: inkGrossG, waste } = applyWasteOnNet(inkNetG, 5);
      const inkCost = (inkGrossG / 1000) * num(p.inkPricePerKg, 480);
      const screenShare = num(p.screenSetupCost, 280) / Math.max(1, num(p.expectedPrintRuns, 50));
      const extraCost = sumDynamicExtraMaterials(input) + num(p.blankGarmentCost, 95);
      return makeWaste(
        inkCost,
        5,
        extraCost,
        `${inkNetG.toFixed(1)} جم حبر`,
        `${inkGrossG.toFixed(1)} جم حبر`,
        'on_net',
        [{ label: 'حصة القطعة من تجهيز الشبلونة', value: `${screenShare.toFixed(1)} ج`, highlight: true }],
        { totalWeightGrams: inkGrossG, totalWeightKg: inkGrossG / 1000, moldCostExtra: screenShare, areaCm2: num(p.printAreaCm2, 500), wasteAmount: waste }
      );
    },
  },

  heat_vinyl: {
    craftId: 'heat_vinyl',
    mainSectionId: 'arts_printing_calligraphy',
    nameAr: 'الطباعة الحرارية والفينيل (HTV)',
    defaultWastePercent: 10,
    indicativeHourlyRateRange: [50, 85],
    formulaSummaryAr: 'م_فينيل = م_تصميم + هوامش القص والتعشيق (+10%) | كهرباء المكبس الحراري',
    fields: [
      { key: 'designAreaCm2', labelAr: 'مساحة التصميم الصافية', unitAr: 'سم²', type: 'number', defaultValue: 400, min: 1 },
      { key: 'wastePercent', labelAr: 'هالك التفريغ والقص على الصافي', unitAr: '%', type: 'number', defaultValue: 10, min: 0, max: 40 },
      { key: 'vinylPricePerSqM', labelAr: 'سعر متر² الفينيل الحراري', unitAr: 'ج/م²', type: 'number', defaultValue: 260, min: 0 },
      { key: 'blankProductCost', labelAr: 'سعر المنتج الخام المطبوع عليه', unitAr: 'ج', type: 'number', defaultValue: 110, min: 0 },
      { key: 'pressKw', labelAr: 'قدرة المكبس الحراري', unitAr: 'kW', type: 'number', defaultValue: 1.4, step: 0.1, min: 0 },
      { key: 'pressSeconds', labelAr: 'زمن الكبس', unitAr: 'ثانية', type: 'number', defaultValue: 25, min: 1 },
    ],
    calculate: (input, p) => {
      const aNet = num(p.designAreaCm2, 400);
      const w = num(p.wastePercent, 10);
      const { gross: aGross, waste } = applyWasteOnNet(aNet, w);
      const vinylCost = (aGross / 10000) * num(p.vinylPricePerSqM, 260);
      const energy = num(p.pressKw, 1.4) * (num(p.pressSeconds, 25) / 3600) * num(input.kwhPrice, 2.15);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.blankProductCost, 110);
      return makeWaste(vinylCost, w, extraCost, `${aNet} سم² فينيل`, `${aGross.toFixed(0)} سم² فينيل`, 'on_net', [], { areaCm2: aGross, energyCostExtra: energy, wasteAmount: waste });
    },
  },

  linocut: {
    craftId: 'linocut',
    mainSectionId: 'arts_printing_calligraphy',
    nameAr: 'الحفر والطباعة باللينوليوم (Linocut)',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [55, 95],
    formulaSummaryAr: 'الحبر = م × غ | الورق = ن_طبعات × م_ورقة | قالب اللينو يُوزع على عدد الطبعات',
    fields: [
      { key: 'blockAreaCm2', labelAr: 'مساحة القالب المحفور', unitAr: 'سم²', type: 'number', defaultValue: 300, min: 1 },
      { key: 'editionCount', labelAr: 'عدد الطبعات المتوقعة (Edition)', type: 'number', defaultValue: 20, min: 1 },
      { key: 'linoBlockCost', labelAr: 'تكلفة لوح اللينوليوم', unitAr: 'ج', type: 'number', defaultValue: 160, min: 0 },
      { key: 'inkAndPaperPerPrint', labelAr: 'ورق الطباعة + الحبر للطبعة الواحدة', unitAr: 'ج', type: 'number', defaultValue: 22, min: 0 },
    ],
    calculate: (input, p) => {
      const ed = Math.max(1, num(p.editionCount, 20));
      const share = num(p.linoBlockCost, 160) / ed;
      const matCost = num(p.inkAndPaperPerPrint, 22);
      const extraCost = sumDynamicExtraMaterials(input);
      return makeWaste(matCost, 5, extraCost, `طبعة واحدة`, `حصة القالب ${share.toFixed(1)} ج`, 'on_net', [], { areaCm2: num(p.blockAreaCm2, 300), moldCostExtra: share });
    },
  },

  calligraphy_gilding: {
    craftId: 'calligraphy_gilding',
    mainSectionId: 'arts_printing_calligraphy',
    nameAr: 'الخط العربي والتذهيب',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [60, 120],
    formulaSummaryAr: 'الورق = م_عمل | ورق الذهب = م_تذهيب + هوامش القص (+5%) | الأقلام والقصب أدوات وليست خامات مستهلكة',
    fields: [
      { key: 'sheetCost', labelAr: 'تكلفة الورق المُعالج (الأهر) والإطار', unitAr: 'ج', type: 'number', defaultValue: 145, min: 0 },
      { key: 'gildingLeavesCount', labelAr: 'عدد أوراق الذهب الصافية', type: 'number', defaultValue: 3, min: 0 },
      { key: 'goldLeafPrice', labelAr: 'سعر ورقة الذهب الواحدة', unitAr: 'ج', type: 'number', defaultValue: 32, min: 0 },
      { key: 'inkAndBinderCost', labelAr: 'تكلفة الحبر والميسون (المثبت)', unitAr: 'ج', type: 'number', defaultValue: 28, min: 0 },
      { key: 'wastePercent', labelAr: 'هالك ورق الذهب على الصافي', unitAr: '%', type: 'number', defaultValue: 5, min: 0, max: 35 },
    ],
    calculate: (input, p) => {
      const net = num(p.gildingLeavesCount, 3);
      const w = num(p.wastePercent, 5);
      const { gross, waste } = applyWasteOnNet(net, w);
      const goldCost = gross * num(p.goldLeafPrice, 32);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.sheetCost, 145) + num(p.inkAndBinderCost, 28);
      return makeWaste(goldCost, w, extraCost, `${net} ورقة ذهب`, `${gross.toFixed(2)} ورقة ذهب`, 'on_net', [], { wasteAmount: waste });
    },
  },

  sublimation: {
    craftId: 'sublimation',
    mainSectionId: 'arts_printing_calligraphy',
    nameAr: 'الطباعة بالتسامي (Sublimation)',
    isNewStar: true,
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [45, 80],
    formulaSummaryAr: 'الحبر = م × معدل مل/م² (من معايرة الطابعة) | الورق = م_تصميم × طبعات | كهرباء المكبس الحراري',
    fields: [
      { key: 'printAreaSqM', labelAr: 'مساحة الطباعة بالمتر المربع', unitAr: 'م²', type: 'number', defaultValue: 0.06, step: 0.01, min: 0.005 },
      { key: 'inkMlPerSqM', labelAr: 'معدل استهلاك الحبر (معايرة الطابعة)', unitAr: 'مل/م²', type: 'number', defaultValue: 18, min: 1, isCalibration: true },
      { key: 'inkPricePerMl', labelAr: 'سعر مل حبر السبلميشن', unitAr: 'ج/مل', type: 'number', defaultValue: 3.5, step: 0.2, min: 0 },
      { key: 'paperCostPerSheet', labelAr: 'تكلفة ورق التسامي واللاصق الحراري', unitAr: 'ج', type: 'number', defaultValue: 8, min: 0 },
      { key: 'blankSublimationCost', labelAr: 'سعر الخامة المجهزة للسبلميشن (مج/تيشيرت/خشب)', unitAr: 'ج', type: 'number', defaultValue: 65, min: 0 },
      { key: 'pressKw', labelAr: 'قدرة المكبس الحراري', unitAr: 'kW', type: 'number', defaultValue: 1.5, step: 0.1, min: 0 },
      { key: 'pressMinutes', labelAr: 'زمن الكبس بالدقائق', unitAr: 'دقيقة', type: 'number', defaultValue: 1.5, step: 0.5, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const aM2 = num(p.printAreaSqM, 0.06);
      const netMl = aM2 * num(cal.inkMlPerSqM ?? p.inkMlPerSqM, 18);
      const { gross: grossMl, waste } = applyWasteOnNet(netMl, 5);
      const inkCost = grossMl * num(p.inkPricePerMl, 3.5);
      const energy = num(p.pressKw, 1.5) * (num(p.pressMinutes, 1.5) / 60) * num(input.kwhPrice, 2.15);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.paperCostPerSheet, 8) + num(p.blankSublimationCost, 65);
      return makeWaste(inkCost, 5, extraCost, `${netMl.toFixed(2)} مل حبر`, `${grossMl.toFixed(2)} مل حبر`, 'on_net', [{ label: 'كهرباء المكبس الحراري', value: `${energy.toFixed(2)} ج` }], { areaCm2: aM2 * 10000, energyCostExtra: energy, wasteAmount: waste });
    },
  },

  // =========================================================================
  // ★ القسم 9: الورق والتجليد
  // =========================================================================
  paper_cards: {
    craftId: 'paper_cards',
    mainSectionId: 'paper_binding',
    nameAr: 'الورق والكروت والأوريجامي والكويلينج',
    isNewStar: true,
    defaultWastePercent: 8,
    isYieldOrNestingBased: true,
    indicativeHourlyRateRange: [40, 70],
    formulaSummaryAr: 'عدد الأجزاء في الورقة = ⌊م_ورقة × ص_ك ÷ م_جزء⌋ | الأفرخ = ⌈ن_أجزاء ÷ ن_في_الورقة⌉ | الوزن = م(م²) × GSM',
    fields: [
      { key: 'partsRequiredCount', labelAr: 'عدد الكروت أو الأجزاء المطلوبة', type: 'number', defaultValue: 50, min: 1 },
      { key: 'partAreaCm2', labelAr: 'مساحة الكارت/الجزء الواحد', unitAr: 'سم²', type: 'number', defaultValue: 150, min: 1 },
      { key: 'sheetAreaCm2', labelAr: 'مساحة الفرخ الكبير للورق', unitAr: 'سم²', type: 'number', defaultValue: 7000, min: 100, isCalibration: true },
      { key: 'nestingEfficiency', labelAr: 'كفاءة التعشيق (ص_ك)', type: 'number', defaultValue: 0.9, step: 0.02, min: 0.4, max: 0.98, isCalibration: true },
      { key: 'paperGsm', labelAr: 'الوزن الجرامي للورق (GSM)', unitAr: 'جم/م²', type: 'number', defaultValue: 300, min: 60, isCalibration: true },
      { key: 'sheetPrice', labelAr: 'سعر فرخ الورق الكبير', unitAr: 'ج', type: 'number', defaultValue: 28, min: 0 },
      { key: 'printCostTotal', labelAr: 'تكلفة الطباعة والتخريم/القص للدفعة', unitAr: 'ج', type: 'number', defaultValue: 90, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const aSheet = num(cal.sheetAreaCm2 ?? p.sheetAreaCm2, 7000);
      const aPart = Math.max(1, num(p.partAreaCm2, 150));
      const eta = Math.max(0.3, Math.min(0.98, num(cal.nestingEfficiency ?? p.nestingEfficiency, 0.9)));
      const partsPerSheet = Math.max(1, Math.floor((aSheet * eta) / aPart));
      const sheetsNeeded = Math.ceil(num(p.partsRequiredCount, 50) / partsPerSheet);
      const totalAreaM2 = (sheetsNeeded * aSheet) / 10000;
      const weightG = totalAreaM2 * num(cal.paperGsm ?? p.paperGsm, 300);
      const equivWaste = yieldToWasteOnNet(eta);
      const paperCost = sheetsNeeded * num(p.sheetPrice, 28);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.printCostTotal, 90);
      return makeWaste(
        paperCost,
        equivWaste,
        extraCost,
        `${num(p.partsRequiredCount, 50)} جزء`,
        `${sheetsNeeded} فرخ (${partsPerSheet} جزء/فرخ | ${weightG.toFixed(0)} جم)`,
        'nesting_efficiency',
        [
          { label: 'الأجزاء في الفرخ الواحد (توزيع صحيح لأسفل)', value: `${partsPerSheet} جزء/فرخ` },
          { label: 'عدد الأفرخ المطلوبة (تقريب لأعلى)', value: `${sheetsNeeded} فرخ`, highlight: true },
        ],
        { totalWeightKg: weightG / 1000, totalWeightGrams: weightG, areaCm2: totalAreaM2 * 10000 }
      );
    },
  },

  bookbinding: {
    craftId: 'bookbinding',
    mainSectionId: 'paper_binding',
    nameAr: 'التجليد الفني وصناعة الدفاتر',
    isNewStar: true,
    defaultWastePercent: 8,
    indicativeHourlyRateRange: [55, 90],
    formulaSummaryAr: 'الأوراق الداخلية = الصفحات ÷ 2 | م_غلاف = الغلافان + الكعب + هوامش الطي | الخيط = طول الكعب × أرباع × معامل',
    fields: [
      { key: 'pagesCount', labelAr: 'عدد الصفحات الكلي', type: 'number', defaultValue: 160, min: 4 },
      { key: 'innerPaperPricePer100Sheets', labelAr: 'سعر 100 ورقة داخلية', unitAr: 'ج', type: 'number', defaultValue: 45, min: 0 },
      { key: 'coverBoardAndFabricCost', labelAr: 'الكرتون الرمادي (الجراي بورد) + قماش/جلد الغلاف', unitAr: 'ج', type: 'number', defaultValue: 65, min: 0 },
      { key: 'spineLengthCm', labelAr: 'طول الكعب', unitAr: 'سم', type: 'number', defaultValue: 21, min: 5 },
      { key: 'signaturesCount', labelAr: 'عدد الكراريس / الأرباع (Signatures)', type: 'number', defaultValue: 8, min: 1 },
      { key: 'stitchThreadFactor', labelAr: 'معامل خيط حياكة الكراريس', type: 'number', defaultValue: 2.5, step: 0.1, min: 1, isCalibration: true },
      { key: 'glueAndHeadbandCost', labelAr: 'الغراء وشريط الكعب وعلامة الكتاب', unitAr: 'ج', type: 'number', defaultValue: 15, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const sheets = Math.ceil(num(p.pagesCount, 160) / 2);
      const { gross: grossSheets, waste } = applyWasteOnNet(sheets, 8);
      const innerCost = (grossSheets / 100) * num(p.innerPaperPricePer100Sheets, 45);
      const threadM = (num(p.spineLengthCm, 21) / 100) * num(p.signaturesCount, 8) * num(cal.stitchThreadFactor ?? p.stitchThreadFactor, 2.5);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.coverBoardAndFabricCost, 65) + num(p.glueAndHeadbandCost, 15) + threadM * 1.5;
      return makeWaste(
        innerCost,
        8,
        extraCost,
        `${sheets} ورقة داخلية`,
        `${Math.ceil(grossSheets)} ورقة + غلاف + ${threadM.toFixed(1)} م خيط`,
        'on_net',
        [{ label: 'خيط تجليد الكراريس', value: `${threadM.toFixed(1)} متر` }],
        { totalLengthMeters: threadM, wasteAmount: waste }
      );
    },
  },

  papier_mache: {
    craftId: 'papier_mache',
    mainSectionId: 'paper_binding',
    nameAr: 'عجينة الورق (Papier-Mâché)',
    isNewStar: true,
    defaultWastePercent: 10,
    isYieldOrNestingBased: true,
    indicativeHourlyRateRange: [40, 70],
    formulaSummaryAr: 'الورق الخام = وزن الجاف ÷ العائد (Y) | الغراء = وزن الجاف × نسبة الوصفة',
    fields: [
      { key: 'dryPulpGrams', labelAr: 'وزن عجينة الورق الجافة المستهدف', unitAr: 'جم', type: 'number', defaultValue: 350, min: 1 },
      { key: 'paperYield', labelAr: 'العائد من الورق المستعمل (Y)', type: 'number', defaultValue: 0.88, step: 0.02, min: 0.5, max: 1, isCalibration: true },
      { key: 'glueRatio', labelAr: 'نسبة الغراء الأبيض إلى الوزن الجاف', type: 'number', defaultValue: 0.45, step: 0.05, min: 0.1, isCalibration: true },
      { key: 'paperPricePerKg', labelAr: 'سعر كيلو الورق', unitAr: 'ج/كجم', type: 'number', defaultValue: 25, min: 0 },
      { key: 'gluePricePerKg', labelAr: 'سعر كيلو الغراء الأبيض والمثبت', unitAr: 'ج/كجم', type: 'number', defaultValue: 130, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const mDry = num(p.dryPulpGrams, 350);
      const y = Math.max(0.4, Math.min(1, num(cal.paperYield ?? p.paperYield, 0.88)));
      const rawPaperG = mDry / y;
      const equivWaste = yieldToWasteOnNet(y);
      const glueG = mDry * num(cal.glueRatio ?? p.glueRatio, 0.45);
      const paperCost = (rawPaperG / 1000) * num(p.paperPricePerKg, 25);
      const glueCost = (glueG / 1000) * num(p.gluePricePerKg, 130);
      const extraCost = sumDynamicExtraMaterials(input) + glueCost;
      return makeWaste(
        paperCost,
        equivWaste,
        extraCost,
        `${mDry} جم جاف`,
        `${rawPaperG.toFixed(0)} جم ورق خام + ${glueG.toFixed(0)} جم غراء`,
        'yield_factor',
        [{ label: 'كمية الغراء للوصفة', value: `${glueG.toFixed(0)} جم (${glueCost.toFixed(1)} ج)` }],
        { totalWeightGrams: rawPaperG + glueG, totalWeightKg: (rawPaperG + glueG) / 1000, wasteAmount: rawPaperG - mDry }
      );
    },
  },

  // =========================================================================
  // القسم 10: التغليف
  // =========================================================================
  packaging_boxes_bags: {
    craftId: 'packaging_boxes_bags',
    mainSectionId: 'packaging_crafts',
    nameAr: 'صناعة العلب والأكياس وتغليف المنتجات',
    defaultWastePercent: 12,
    isYieldOrNestingBased: true,
    indicativeHourlyRateRange: [40, 70],
    formulaSummaryAr: 'الكرتون = ⌈الفرد × ن ÷ (لوح × ص_ك)⌉ | الأكياس + الأيدي | الاستيكر = ⌈ن ÷ ن_في_الشيت⌉',
    fields: [
      { key: 'flatPatternAreaCm2', labelAr: 'مساحة الفرد للعلبة/الكيس (شاملة ألسنة اللصق)', unitAr: 'سم²', type: 'number', defaultValue: 1450, min: 10 },
      { key: 'boxesQuantity', labelAr: 'عدد العلب المطلوبة', type: 'number', defaultValue: 25, min: 1 },
      { key: 'boardAreaCm2', labelAr: 'مساحة لوح الكرتون', unitAr: 'سم²', type: 'number', defaultValue: 7000, min: 100, isCalibration: true },
      { key: 'nestingEfficiency', labelAr: 'كفاءة التعشيق (ص_ك)', type: 'number', defaultValue: 0.88, step: 0.02, min: 0.4, max: 0.98, isCalibration: true },
      { key: 'boardPrice', labelAr: 'سعر لوح الكرتون', unitAr: 'ج', type: 'number', defaultValue: 42, min: 0 },
      { key: 'ribbonsHandlesStickersTotalCost', labelAr: 'شرائط + حبل أيدي + طباعة واستيكرات', unitAr: 'ج', type: 'number', defaultValue: 120, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const qty = Math.max(1, num(p.boxesQuantity, 25));
      const aTotal = num(p.flatPatternAreaCm2, 1450) * qty;
      const eta = Math.max(0.3, Math.min(0.98, num(cal.nestingEfficiency ?? p.nestingEfficiency, 0.88)));
      const boards = Math.ceil(aTotal / (Math.max(1, num(cal.boardAreaCm2 ?? p.boardAreaCm2, 7000)) * eta));
      const equivWaste = yieldToWasteOnNet(eta);
      const cost = boards * num(p.boardPrice, 42);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.ribbonsHandlesStickersTotalCost, 120);
      return makeWaste(cost, equivWaste, extraCost, `${qty} علبة`, `${boards} لوح كرتون (لإجمالي ${qty} علبة)`, 'nesting_efficiency', [{ label: 'الألواح المطلوبة بالتعشيق', value: `${boards} لوح`, highlight: true }], { areaCm2: aTotal });
    },
  },

  // =========================================================================
  // القسم 11: الخياطة والتنجيد
  // =========================================================================
  sewing_garments: {
    craftId: 'sewing_garments',
    mainSectionId: 'sewing_upholstery',
    nameAr: 'الخياطة وتفصيل الملابس والشنط القماش',
    defaultWastePercent: 13.6,
    isYieldOrNestingBased: true,
    indicativeHourlyRateRange: [50, 85],
    formulaSummaryAr: 'م_خام = م_صافي ÷ ص_ك | الطول = م_خام ÷ عرض_القماش | الخيط = ط_خياطة × ل | الأستك = الطول × معامل_الشد',
    fields: [
      { key: 'patternNetSqM', labelAr: 'مجموع مساحة الباترون الصافية', unitAr: 'م²', type: 'number', defaultValue: 1.65, step: 0.05, min: 0.05 },
      { key: 'nestingEfficiency', labelAr: 'كفاءة التعشيق للباترون (ص_ك)', type: 'number', defaultValue: 0.88, step: 0.02, min: 0.4, max: 0.98, isCalibration: true },
      { key: 'fabricWidthMeters', labelAr: 'عرض ثوب القماش', unitAr: 'م', type: 'number', defaultValue: 1.5, step: 0.05, min: 0.4, isCalibration: true },
      { key: 'patternMatchMarginMeters', labelAr: 'هامش تطابق النقشة (إن وجد)', unitAr: 'م', type: 'number', defaultValue: 0.1, step: 0.05, min: 0 },
      { key: 'fabricPricePerMeter', labelAr: 'سعر المتر الطولي من القماش', unitAr: 'ج/م', type: 'number', defaultValue: 165, min: 0 },
      { key: 'seamLengthMeters', labelAr: 'إجمالي طول الخياطات', unitAr: 'م', type: 'number', defaultValue: 9, min: 0 },
      { key: 'seamThreadFactor', labelAr: 'معامل استهلاك الخيط (ل)', type: 'number', defaultValue: 3.2, step: 0.2, min: 1, isCalibration: true },
      { key: 'zippersButtonsInterfacingCost', labelAr: 'سوست + أزرار + فازلين + خيط', unitAr: 'ج', type: 'number', defaultValue: 45, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const aNet = num(p.patternNetSqM, 1.65);
      const eta = Math.max(0.35, Math.min(0.98, num(cal.nestingEfficiency ?? p.nestingEfficiency, 0.88)));
      const aRaw = aNet / eta;
      const fabW = Math.max(0.3, num(cal.fabricWidthMeters ?? p.fabricWidthMeters, 1.5));
      const lengthBuyM = aRaw / fabW + num(p.patternMatchMarginMeters, 0.1);
      const fabCost = lengthBuyM * num(p.fabricPricePerMeter, 165);
      const threadM = num(p.seamLengthMeters, 9) * num(cal.seamThreadFactor ?? p.seamThreadFactor, 3.2);
      const equivWaste = yieldToWasteOnNet(eta);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.zippersButtonsInterfacingCost, 45);
      return makeWaste(
        fabCost,
        equivWaste,
        extraCost,
        `${aNet.toFixed(2)} م² باترون`,
        `${lengthBuyM.toFixed(2)} م قماش + ${threadM.toFixed(1)} م خيط`,
        'nesting_efficiency',
        [
          { label: 'طول القماش المطلوب شراؤه', value: `${lengthBuyM.toFixed(2)} متر (عرض ${fabW} م)`, highlight: true },
          { label: 'خيط الخياطة المستهلك', value: `${threadM.toFixed(1)} متر` },
        ],
        { areaCm2: aRaw * 10000, totalLengthMeters: Number(lengthBuyM.toFixed(2)), wasteAmount: (aRaw - aNet) * 10000 }
      );
    },
  },

  cushions_upholstery: {
    craftId: 'cushions_upholstery',
    mainSectionId: 'sewing_upholstery',
    nameAr: 'الكوشن والتنجيد (فايبر + إسفنج + قماش)',
    defaultWastePercent: 12,
    indicativeHourlyRateRange: [55, 95],
    formulaSummaryAr: 'وزن الفايبر = الحجم الداخلي × كثافة الحشو المقاسة | الإسفنج = م × سمك × ث | القماش + 10–15% شد',
    fields: [
      { key: 'widthCm', labelAr: 'عرض الكوشن / المقعد', unitAr: 'سم', type: 'number', defaultValue: 45, min: 5 },
      { key: 'lengthCm', labelAr: 'طول الكوشن / المقعد', unitAr: 'سم', type: 'number', defaultValue: 45, min: 5 },
      { key: 'thicknessCm', labelAr: 'سمك / عمق الحشو', unitAr: 'سم', type: 'number', defaultValue: 14, min: 1 },
      { key: 'fiberFillDensityGPerLiter', labelAr: 'كثافة الفايبر المقاسة عند الامتلاء', unitAr: 'جم/لتر', type: 'number', defaultValue: 38, min: 5, isCalibration: true },
      { key: 'fiberPricePerKg', labelAr: 'سعر كيلو الفايبر أو الإسفنج', unitAr: 'ج/كجم', type: 'number', defaultValue: 115, min: 0 },
      { key: 'fabricAreaSqM', labelAr: 'مساحة القماش الصافية', unitAr: 'م²', type: 'number', defaultValue: 0.45, step: 0.05, min: 0.05 },
      { key: 'stretchPullMarginPercent', labelAr: 'هوامش الشد والطي على القماش', unitAr: '%', type: 'number', defaultValue: 12, min: 0, max: 35 },
      { key: 'fabricPricePerSqM', labelAr: 'سعر متر² قماش التنجيد', unitAr: 'ج/م²', type: 'number', defaultValue: 185, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const volLiters = (num(p.widthCm, 45) * num(p.lengthCm, 45) * num(p.thicknessCm, 14)) / 1000;
      const fiberG = volLiters * num(cal.fiberFillDensityGPerLiter ?? p.fiberFillDensityGPerLiter, 38);
      const fiberCost = (fiberG / 1000) * num(p.fiberPricePerKg, 115);
      const w = num(p.stretchPullMarginPercent, 12);
      const { gross: fabGrossSqM, waste } = applyWasteOnNet(num(p.fabricAreaSqM, 0.45), w);
      const fabCost = fabGrossSqM * num(p.fabricPricePerSqM, 185);
      const extraCost = sumDynamicExtraMaterials(input) + fiberCost;
      return makeWaste(
        fabCost,
        w,
        extraCost,
        `${num(p.fabricAreaSqM, 0.45)} م² + ${fiberG.toFixed(0)} جم فايبر`,
        `${fabGrossSqM.toFixed(2)} م² قماش + ${fiberG.toFixed(0)} جم حشو`,
        'on_net',
        [
          { label: 'وزن الفايبر/الإسفنج من الحجم × الكثافة', value: `${fiberG.toFixed(0)} جم (${volLiters.toFixed(1)} لتر)`, highlight: true },
        ],
        { totalWeightGrams: fiberG, totalWeightKg: fiberG / 1000, areaCm2: fabGrossSqM * 10000, volumeCm3: volLiters * 1000, wasteAmount: waste * 10000 }
      );
    },
  },

  // =========================================================================
  // القسم 12: الخامات المساعدة والتشطيب
  // =========================================================================
  finishing_adhesives_coatings: {
    craftId: 'finishing_adhesives_coatings',
    mainSectionId: 'finishing_aux',
    nameAr: 'التشطيب واللصق والدهان والعزل',
    defaultWastePercent: 5,
    indicativeHourlyRateRange: [40, 70],
    formulaSummaryAr: 'الغراء (بالمساحة أو النقطة أو الخط) | الدهان = م × أوجه ÷ غ | المخفف بند مستقل عن الدهان',
    fields: [
      { key: 'coatAreaCm2', labelAr: 'المساحة المراد دهانها / عزلها', unitAr: 'سم²', type: 'number', defaultValue: 2500, min: 0 },
      { key: 'coatsCount', labelAr: 'عدد الأوجه / الطبقات', type: 'number', defaultValue: 2, min: 1 },
      { key: 'coatingCoverageCm2PerMl', labelAr: 'معدل التغطية (غ)', unitAr: 'سم²/مل', type: 'number', defaultValue: 65, min: 1, isCalibration: true },
      { key: 'coatingPricePerMl', labelAr: 'سعر مل الدهان / العازل', unitAr: 'ج/مل', type: 'number', defaultValue: 0.75, step: 0.05, min: 0 },
      { key: 'thinnerSeparateCost', labelAr: 'تكلفة المخفف (مستقلة عن الدهان)', unitAr: 'ج', type: 'number', defaultValue: 18, min: 0 },
      { key: 'glueSticksOrPointsCost', labelAr: 'تكلفة الغراء (بالمساحة / النقط / الخط) والصنفرة', unitAr: 'ج', type: 'number', defaultValue: 24, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const mlNet = (num(p.coatAreaCm2, 2500) * num(p.coatsCount, 2)) / Math.max(1, num(cal.coatingCoverageCm2PerMl ?? p.coatingCoverageCm2PerMl, 65));
      const { gross: mlGross, waste } = applyWasteOnNet(mlNet, 5);
      const coatCost = mlGross * num(p.coatingPricePerMl, 0.75);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.thinnerSeparateCost, 18) + num(p.glueSticksOrPointsCost, 24);
      return makeWaste(coatCost, 5, extraCost, `${mlNet.toFixed(1)} مل دهان`, `${mlGross.toFixed(1)} مل دهان + مخفف وغراء`, 'on_net', [], { areaCm2: num(p.coatAreaCm2, 2500), wasteAmount: waste });
    },
  },

  // =========================================================================
  // ★ القسم 13: الزجاج والموزاييك
  // =========================================================================
  mosaic_art: {
    craftId: 'mosaic_art',
    mainSectionId: 'glass_mosaic',
    nameAr: 'فن الموزاييك (Mosaic Art)',
    isNewStar: true,
    defaultWastePercent: 12,
    indicativeHourlyRateRange: [60, 100],
    formulaSummaryAr: 'عدد القطع = ⌈م_تصميم × (1−نسبة_فواصل) ÷ م_قطعة⌉ | حجم الحشو = (م − ن×م_قطعة) × عمق_الفاصل | و = ح×ث',
    fields: [
      { key: 'designAreaCm2', labelAr: 'مساحة اللوحة / التصميم', unitAr: 'سم²', type: 'number', defaultValue: 900, min: 1 },
      { key: 'groutGapPercent', labelAr: 'نسبة الفواصل التقريبية (j)', unitAr: '%', type: 'number', defaultValue: 12, min: 1, max: 35, isCalibration: true },
      { key: 'tileAreaCm2', labelAr: 'مساحة القطعة (التيسيرا الواحدة)', unitAr: 'سم²', type: 'number', defaultValue: 1.44, step: 0.1, min: 0.1 },
      { key: 'gapDepthCm', labelAr: 'عمق الفاصل (لحساب معجون الحشو)', unitAr: 'سم', type: 'number', defaultValue: 0.4, step: 0.05, min: 0.1 },
      { key: 'groutDensity', labelAr: 'كثافة معجون الحشو (السقية)', unitAr: 'جم/سم³', type: 'number', defaultValue: 1.65, step: 0.05, min: 0.8, isCalibration: true },
      { key: 'wastePercent', labelAr: 'هالك التكسير والقص (10–15%) على الصافي', unitAr: '%', type: 'number', defaultValue: 12, min: 0, max: 40 },
      { key: 'tilePricePer100', labelAr: 'سعر 100 قطعة موزاييك', unitAr: 'ج', type: 'number', defaultValue: 48, min: 0 },
      { key: 'groutAndBaseCost', labelAr: 'تكلفة القاعدة والغراء والحشو', unitAr: 'ج', type: 'number', defaultValue: 95, min: 0 },
    ],
    calculate: (input, p, cal) => {
      const aDesign = num(p.designAreaCm2, 900);
      const j = Math.max(0.01, Math.min(0.45, num(cal.groutGapPercent ?? p.groutGapPercent, 12) / 100));
      const aPiece = Math.max(0.05, num(p.tileAreaCm2, 1.44));
      const nTilesNet = Math.ceil((aDesign * (1 - j)) / aPiece);
      const w = num(p.wastePercent, 12);
      const { gross: nTilesGross, waste } = applyWasteOnNet(nTilesNet, w);
      const groutArea = Math.max(0, aDesign - nTilesNet * aPiece);
      const groutVol = groutArea * num(p.gapDepthCm, 0.4);
      const groutWeightG = groutVol * num(cal.groutDensity ?? p.groutDensity, 1.65);
      const tilesCost = (Math.ceil(nTilesGross) / 100) * num(p.tilePricePer100, 48);
      const extraCost = sumDynamicExtraMaterials(input) + num(p.groutAndBaseCost, 95);
      return makeWaste(
        tilesCost,
        w,
        extraCost,
        `${nTilesNet} قطعة`,
        `${Math.ceil(nTilesGross)} قطعة + ${groutWeightG.toFixed(0)} جم سقية`,
        'on_net',
        [
          { label: 'عدد قطع الموزاييك المنصرفة (+هالك)', value: `${Math.ceil(nTilesGross)} قطعة`, highlight: true },
          { label: 'وزن معجون السقية المحسوب من الفراغات', value: `${groutWeightG.toFixed(0)} جم (${groutVol.toFixed(1)} سم³)` },
        ],
        { totalWeightGrams: groutWeightG, totalWeightKg: groutWeightG / 1000, areaCm2: aDesign, volumeCm3: groutVol, wasteAmount: waste }
      );
    },
  },

  stained_glass: {
    craftId: 'stained_glass',
    mainSectionId: 'glass_mosaic',
    nameAr: 'الزجاج المعشق (تيفاني ورصاص)',
    isNewStar: true,
    defaultWastePercent: 22,
    isYieldOrNestingBased: true,
    indicativeHourlyRateRange: [75, 130],
    formulaSummaryAr: 'الزجاج الخام = م_باترون ÷ ص_ك | شريط النحاس/الرصاص = مجموع خطوط الفصل ومحيط القطع | اللحام بطول الوصلات',
    fields: [
      { key: 'patternAreaCm2', labelAr: 'مساحة الباترون الصافية', unitAr: 'سم²', type: 'number', defaultValue: 900, min: 1 },
      { key: 'nestingEfficiency', labelAr: 'كفاءة استغلال لوح الزجاج (ص_ك)', type: 'number', defaultValue: 0.82, step: 0.02, min: 0.4, max: 0.98, isCalibration: true },
      { key: 'glassPricePerSqM', labelAr: 'سعر متر² الزجاج الملون المعشق', unitAr: 'ج/م²', type: 'number', defaultValue: 1850, min: 0 },
      { key: 'jointLinesMeters', labelAr: 'مجموع أطوال خطوط الفصل (تيفاني/رصاص)', unitAr: 'م', type: 'number', defaultValue: 8.5, step: 0.5, min: 0.1 },
      { key: 'foilLeadAndSolderPerMeterCost', labelAr: 'شريط النحاس + القصدير واللحام للمتر', unitAr: 'ج/م', type: 'number', defaultValue: 26, min: 0, isCalibration: true },
    ],
    calculate: (input, p, cal) => {
      const aPat = num(p.patternAreaCm2, 900);
      const eta = Math.max(0.35, Math.min(0.98, num(cal.nestingEfficiency ?? p.nestingEfficiency, 0.82)));
      const aRawCm2 = aPat / eta;
      const equivWaste = yieldToWasteOnNet(eta);
      const glassCost = (aRawCm2 / 10000) * num(p.glassPricePerSqM, 1850);
      const jointsM = num(p.jointLinesMeters, 8.5);
      const joinCost = jointsM * num(cal.foilLeadAndSolderPerMeterCost ?? p.foilLeadAndSolderPerMeterCost, 26);
      const extraCost = sumDynamicExtraMaterials(input) + joinCost;
      return makeWaste(
        glassCost,
        equivWaste,
        extraCost,
        `${aPat} سم² زجاج`,
        `${aRawCm2.toFixed(0)} سم² زجاج + ${jointsM} م قصدير ونحاس`,
        'nesting_efficiency',
        [{ label: 'الفويل واللحام والباتينا', value: `${joinCost.toFixed(1)} ج (${jointsM} م)` }],
        { areaCm2: aRawCm2, totalLengthMeters: jointsM, wasteAmount: aRawCm2 - aPat }
      );
    },
  },

  // =========================================================================
  // القسم 14: التشغيل والطاقة والوقت (الأفران والدفعات)
  // =========================================================================
  kiln_machine_ops: {
    craftId: 'kiln_machine_ops',
    mainSectionId: 'energy_time_ops',
    nameAr: 'تشغيل الأفران والماكينات والطاقة بالدفعات',
    defaultWastePercent: 0,
    indicativeHourlyRateRange: [50, 100],
    formulaSummaryAr: 'الكهرباء = Σ(قدرة × ساعات_تشغيل_فعلي × سعر_KWh) + الغاز | توزع الدفعة على عدد القطع السليمة',
    fields: [
      { key: 'device1Kw', labelAr: 'قدرة الجهاز/الفرن الأول', unitAr: 'kW', type: 'number', defaultValue: 3.5, step: 0.1, min: 0 },
      { key: 'device1ActiveHours', labelAr: 'ساعات التسخين/التشغيل الفعلية للجهاز 1', unitAr: 'ساعة', type: 'number', defaultValue: 4.5, step: 0.5, min: 0 },
      { key: 'device2Kw', labelAr: 'قدرة جهاز مساعد ثانٍ (اختياري)', unitAr: 'kW', type: 'number', defaultValue: 0.8, step: 0.1, min: 0 },
      { key: 'device2ActiveHours', labelAr: 'ساعات التشغيل الفعلية للجهاز 2', unitAr: 'ساعة', type: 'number', defaultValue: 1, step: 0.5, min: 0 },
      { key: 'fuelUnitsUsed', labelAr: 'وحدات الغاز/الوقود للدفعة (إن وجدت)', type: 'number', defaultValue: 0, min: 0 },
      { key: 'fuelUnitPrice', labelAr: 'سعر وحدة الغاز/الوقود', unitAr: 'ج', type: 'number', defaultValue: 25, min: 0 },
      { key: 'batchGoodPieces', labelAr: 'عدد القطع السليمة في الدفعة لتقسيم الطاقة', type: 'number', defaultValue: 12, min: 1 },
      { key: 'consumableMoldsOrSettersCost', labelAr: 'مستهلكات مساعدة للدفعة (رفوف/عوازل)', unitAr: 'ج', type: 'number', defaultValue: 24, min: 0 },
    ],
    calculate: (input, p) => {
      const kwhPrice = num(input.kwhPrice, 2.15);
      const e1 = num(p.device1Kw, 3.5) * num(p.device1ActiveHours, 4.5) * kwhPrice;
      const e2 = num(p.device2Kw, 0.8) * num(p.device2ActiveHours, 1) * kwhPrice;
      const gas = num(p.fuelUnitsUsed, 0) * num(p.fuelUnitPrice, 25);
      const good = Math.max(1, num(p.batchGoodPieces, 12));
      const energyPerPiece = (e1 + e2 + gas) / good;
      const matPerPiece = num(p.consumableMoldsOrSettersCost, 24) / good;
      const extraCost = sumDynamicExtraMaterials(input);
      return makeWaste(
        matPerPiece,
        0,
        extraCost,
        `دفعة (${good} قطعة)`,
        `طاقة الكلية ${(e1 + e2 + gas).toFixed(1)} ج (${energyPerPiece.toFixed(1)} ج/قطعة)`,
        'on_net',
        [
          { label: 'كهرباء الدفعة الكلية', value: `${(e1 + e2).toFixed(1)} ج` },
          { label: 'حصة القطعة السليمة من الطاقة', value: `${energyPerPiece.toFixed(2)} ج`, highlight: true },
        ],
        { energyCostExtra: energyPerPiece }
      );
    },
  },
};
