import { CalculationInput, CalculationOutput } from '../types';
import {
  buildUnifiedFinancialOutput,
  getSavedCraftCalibrations,
  WorkshopSpec,
} from './craftUnifiedFinancials';
import { WORKSHOP_SPECS_PART_1 } from './craftWorkshopSpecsPart1';
import { WORKSHOP_SPECS_PART_2 } from './craftWorkshopSpecsPart2';

export * from './craftUnifiedFinancials';

const ceramicsSpec: WorkshopSpec = {
  ...WORKSHOP_SPECS_PART_1.pottery,
  craftId: 'ceramics',
  nameAr: 'السيراميك وبلاطات الخزف الفني',
};

export const WORKSHOP_SPECS: Record<string, WorkshopSpec> = {
  ...WORKSHOP_SPECS_PART_1,
  ...WORKSHOP_SPECS_PART_2,
  ceramics: ceramicsSpec,
};

const CRAFT_ALIASES: Record<string, string> = {
  kilim: 'kelim',
  tufting: 'tufting_gun',
  polyester: 'polyester_resin',
  uv: 'uv_resin',
  epoxy: 'resin',
  soap: 'cold_process_soap',
  cold_soap: 'cold_process_soap',
  melt_pour: 'melt_pour_soap',
  leather: 'leathercraft',
  forging: 'metalwork_forging',
  metals: 'metalwork_forging',
  silver: 'copper_silver_shaping',
  lighting: 'lighting_craft',
  dried_flowers: 'natural_dried_flowers',
  flowers: 'handmade_flowers',
  mosaic: 'mosaic_art',
  glass: 'stained_glass',
  laser: 'laser_cnc',
  cnc: 'laser_cnc',
  '3d': '3d_printing',
  kiln: 'kiln_machine_ops',
};

export function normalizeWorkshopId(craftId: string): string {
  const clean = (craftId || '').toLowerCase().trim();
  return CRAFT_ALIASES[clean] || clean;
}

export function getWorkshopSpec(craftId: string): WorkshopSpec | undefined {
  const norm = normalizeWorkshopId(craftId);
  return WORKSHOP_SPECS[norm];
}

export function getDefaultParamsForWorkshop(craftId: string): Record<string, number | string | boolean> {
  const spec = getWorkshopSpec(craftId);
  if (!spec) return {};
  const defaults: Record<string, number | string | boolean> = {};
  for (const field of spec.fields) {
    defaults[field.key] = field.defaultValue;
  }
  return defaults;
}

export function executeWorkshopSpec(craftId: string, input: CalculationInput): CalculationOutput | null {
  const spec = getWorkshopSpec(craftId);
  if (!spec) return null;

  const defaults = getDefaultParamsForWorkshop(spec.craftId);
  const params: Record<string, number | string | boolean> = {
    ...defaults,
    ...(input.workshopParams || {}),
  };

  // دمج ثوابت المعايرة المحفوظة محلياً مع التعديلات المباشرة من الجلسة
  const savedCal = getSavedCraftCalibrations(spec.craftId);
  const cal: Record<string, number> = {
    ...savedCal,
    ...(input.calibrationOverrides || {}),
  };

  const mathRes = spec.calculate(input, params, cal);

  return buildUnifiedFinancialOutput(input, {
    totalDirectMaterialsCost: mathRes.totalDirectMaterialsCost,
    yarnCost: mathRes.yarnCost,
    extraMaterialsTotalCost: mathRes.extraMaterialsTotalCost,
    totalWeightKg: mathRes.totalWeightKg,
    totalWeightGrams: mathRes.totalWeightGrams,
    totalYarnLengthMeters: mathRes.totalLengthMeters || 0,
    energyCostExtra: mathRes.energyCostExtra || 0,
    moldCostExtra: mathRes.moldCostExtra || 0,
    craftMetrics: {
      craftId: spec.craftId,
      craftNameAr: spec.nameAr,
      wasteMode: mathRes.wasteMode,
      wasteFactorPercent: mathRes.wasteFactorPercent,
      wasteAmount: mathRes.wasteAmount,
      netQtyLabel: mathRes.netQtyLabel,
      grossQtyLabel: mathRes.grossQtyLabel,
      volumeCm3: mathRes.volumeCm3,
      totalSurfaceAreaCm2: mathRes.areaCm2,
      equationSummaryAr: spec.formulaSummaryAr,
      safetyWarning: spec.safetyWarning,
      detailedLines: mathRes.detailedLines,
    },
  });
}
