/**
 * Smart International Unit Conversion Chain Engine
 * Allows artisans & suppliers to define custom local/commercial units (e.g., طرد -> ربطة -> كيلو -> جرام)
 * and automatically prompts until the chain reaches an internationally recognized base unit (SI).
 */

export interface StandardBaseUnitDef {
  id: string;
  labelAr: string;
  aliases: string[];
  dimension: 'weight' | 'length' | 'volume' | 'area' | 'count';
  baseUnitAr: string;
  toBaseFactor: number;
}

export const STANDARD_BASE_UNITS: StandardBaseUnitDef[] = [
  // Weight -> base: جرام
  { id: 'g', labelAr: 'جرام', aliases: ['جرام', 'جم', 'غرام', 'g', 'gr', 'gram', 'grams'], dimension: 'weight', baseUnitAr: 'جرام', toBaseFactor: 1 },
  { id: 'kg', labelAr: 'كيلو', aliases: ['كيلو', 'كيلوجرام', 'كجم', 'كغ', 'كيلوغرام', 'kg', 'kilogram'], dimension: 'weight', baseUnitAr: 'جرام', toBaseFactor: 1000 },
  { id: 'ton', labelAr: 'طن', aliases: ['طن', 'ton', 'tonne'], dimension: 'weight', baseUnitAr: 'جرام', toBaseFactor: 1000000 },
  { id: 'oz', labelAr: 'أوقية', aliases: ['أوقية', 'اوقية', 'أونصة', 'اونصة', 'oz'], dimension: 'weight', baseUnitAr: 'جرام', toBaseFactor: 28.3495 },

  // Length -> base: سم
  { id: 'mm', labelAr: 'ملليمتر', aliases: ['مم', 'مللي', 'ملي', 'ملليمتر', 'mm'], dimension: 'length', baseUnitAr: 'سم', toBaseFactor: 0.1 },
  { id: 'cm', labelAr: 'سم', aliases: ['سم', 'سنتيمتر', 'سنتي', 'cm'], dimension: 'length', baseUnitAr: 'سم', toBaseFactor: 1 },
  { id: 'm', labelAr: 'متر', aliases: ['متر', 'م', 'm', 'meter', 'metre'], dimension: 'length', baseUnitAr: 'سم', toBaseFactor: 100 },
  { id: 'yd', labelAr: 'ياردة', aliases: ['ياردة', 'يارده', 'yd', 'yard'], dimension: 'length', baseUnitAr: 'سم', toBaseFactor: 91.44 },
  { id: 'in', labelAr: 'بوصة', aliases: ['بوصة', 'بوصه', 'إنش', 'انش', 'inch', 'in'], dimension: 'length', baseUnitAr: 'سم', toBaseFactor: 2.54 },

  // Volume -> base: ملليلتر
  { id: 'ml', labelAr: 'ملليلتر', aliases: ['مل', 'مللي لتر', 'ملليلتر', 'سم3', 'ml'], dimension: 'volume', baseUnitAr: 'ملليلتر', toBaseFactor: 1 },
  { id: 'l', labelAr: 'لتر', aliases: ['لتر', 'ل', 'l', 'liter', 'litre'], dimension: 'volume', baseUnitAr: 'ملليلتر', toBaseFactor: 1000 },

  // Area -> base: سم²
  { id: 'cm2', labelAr: 'سم²', aliases: ['سم2', 'سم²', 'سنتيمتر مربع', 'cm2'], dimension: 'area', baseUnitAr: 'سم²', toBaseFactor: 1 },
  { id: 'm2', labelAr: 'متر²', aliases: ['متر2', 'متر²', 'م2', 'م²', 'متر مربع', 'm2'], dimension: 'area', baseUnitAr: 'سم²', toBaseFactor: 10000 },
  { id: 'ft2', labelAr: 'قدم²', aliases: ['قدم', 'قدم2', 'قدم²', 'قدم مربع', 'ft2', 'sqft'], dimension: 'area', baseUnitAr: 'سم²', toBaseFactor: 929.03 },

  // Count -> base: قطعة
  { id: 'pc', labelAr: 'قطعة', aliases: ['قطعة', 'قطعه', 'حبة', 'حبه', 'وحدة', 'وحده', 'عدد', 'pc', 'pcs', 'piece'], dimension: 'count', baseUnitAr: 'قطعة', toBaseFactor: 1 },
  { id: 'sheet', labelAr: 'فرخ / ورقة', aliases: ['فرخ', 'ورقة', 'ورقه', 'لوح', 'sheet'], dimension: 'count', baseUnitAr: 'قطعة', toBaseFactor: 1 },
  { id: 'dozen', labelAr: 'دستة', aliases: ['دستة', 'دسته', 'دزينة', 'دزينه', 'dozen'], dimension: 'count', baseUnitAr: 'قطعة', toBaseFactor: 12 },
];

function normUnitToken(raw?: string | null): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

export function findStandardBaseUnit(unitName?: string | null): StandardBaseUnitDef | null {
  const norm = normUnitToken(unitName);
  if (!norm) return null;
  for (const def of STANDARD_BASE_UNITS) {
    if (normUnitToken(def.labelAr) === norm) return def;
    if (def.aliases.some((a) => normUnitToken(a) === norm)) return def;
  }
  return null;
}

export interface UnitEquationStep {
  fromUnit: string;
  multiplier: number;
  toUnit: string;
}

export interface EvaluatedUnitChain {
  isComplete: boolean;
  needsDefinitionForUnit?: string;
  steps: UnitEquationStep[];
  topUnit: string;
  resolvedStandardUnit?: StandardBaseUnitDef;
  totalInResolvedStandard?: number;
  totalInBaseUnit?: number;
  baseUnitAr?: string;
  formulaAr: string;
}

function formatNumAr(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n - Math.round(n)) < 1e-6) {
    return Math.round(n).toLocaleString('en-US');
  }
  return Number(n.toFixed(3)).toLocaleString('en-US');
}

/**
 * Evaluates a user-built multi-step unit chain.
 * Example:
 *   Step 1: 1 طرد = 5 ربطة  -> incomplete! needsDefinitionForUnit = 'ربطة'
 *   Step 2: 1 ربطة = 5 كيلو -> COMPLETE!
 *   Result: 1 طرد = 5 ربطة = 25 كيلو = 25,000 جرام
 */
export function evaluateUnitEquationChain(steps: UnitEquationStep[]): EvaluatedUnitChain {
  const validSteps = steps
    .map((s) => ({
      fromUnit: String(s.fromUnit || '').trim(),
      multiplier: Number(s.multiplier) || 0,
      toUnit: String(s.toUnit || '').trim(),
    }))
    .filter((s) => s.fromUnit && s.toUnit && s.multiplier > 0);

  if (validSteps.length === 0) {
    return {
      isComplete: false,
      steps: [],
      topUnit: '',
      formulaAr: '',
    };
  }

  const topUnit = validSteps[0].fromUnit;
  let runningFactor = 1;
  const parts: string[] = [`1 ${topUnit}`];

  for (const st of validSteps) {
    runningFactor *= st.multiplier;
    parts.push(`${formatNumAr(runningFactor)} ${st.toUnit}`);
  }

  const lastUnit = validSteps[validSteps.length - 1].toUnit;
  const stdUnit = findStandardBaseUnit(lastUnit);

  if (!stdUnit) {
    return {
      isComplete: false,
      needsDefinitionForUnit: lastUnit,
      steps: validSteps,
      topUnit,
      formulaAr: parts.join(' = '),
    };
  }

  const totalInBase = runningFactor * stdUnit.toBaseFactor;
  if (stdUnit.toBaseFactor !== 1 && normUnitToken(stdUnit.labelAr) !== normUnitToken(stdUnit.baseUnitAr)) {
    parts.push(`${formatNumAr(totalInBase)} ${stdUnit.baseUnitAr}`);
  }

  return {
    isComplete: true,
    steps: validSteps,
    topUnit,
    resolvedStandardUnit: stdUnit,
    totalInResolvedStandard: runningFactor,
    totalInBaseUnit: totalInBase,
    baseUnitAr: stdUnit.baseUnitAr,
    formulaAr: parts.join(' = '),
  };
}

/**
 * Parse saved unit equation lines stored inside master.unitNote (delimited by " | ")
 */
export function parseUnitEquationsFromNote(unitNote?: string | null): string[] {
  if (!unitNote) return [];
  return String(unitNote)
    .split(/\s*\|\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
