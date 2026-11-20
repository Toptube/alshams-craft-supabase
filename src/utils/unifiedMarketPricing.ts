import type { UnifiedMaterialMaster } from '../registry/unifiedMaterialsRegistry';

/**
 * Realistic Egyptian Craft Market Baseline Pricing Engine (EGP per primary unit)
 * - Every single unified material gets an initial market average price matching its category & unit chain.
 * - Known commercial brands carry realistic brand price multipliers / specific prices.
 * - Unpriced brands automatically inherit the average of priced brands on the same material,
 *   or fall back to the material's general market price ("سعر اعتباري").
 */

// Exact overrides for core high-frequency craft materials (EGP per primary unit)
const EXACT_CODE_MARKET_PRICES: Record<string, number> = {
  // TH: Macrame & Cords (per كيلو unless unitChain differs)
  TH0001: 185, // قطن مجدول (كيلو)
  TH0002: 195, // حبل قطن (كيلو)
  TH0003: 175, // كردون مبطن (كيلو)
  TH0004: 155, // جوت (كيلو)
  TH0005: 165, // قنب (كيلو)
  TH0006: 150, // خيش خيط/حبل (كيلو)
  TH0007: 340, // صوف (كيلو)
  TH0008: 280, // أكريليك (كيلو)
  TH0009: 310, // قطن حياكة (كيلو)
  TH0010: 145, // خيط تيشيرت وماكسي (كيلو)
  TH0011: 360, // خيط مخملي / قطيفة (كيلو)
  TH0012: 390, // خيط فرو وبوكلية (كيلو)
  TH0013: 420, // خيط معدني ولامع (كيلو)
  TH0014: 25,  // خيط خياطة (بكرة)
  TH0015: 22,  // خيط تطريز مولينيه (شلة)
  TH0016: 65,  // خيط سيرما وقصب (بكرة)
  TH0017: 35,  // نايلون شفاف خيط صيد (بكرة)
  TH0018: 45,  // أستك وخيط مطاطي (بكرة/لفة)
  TH0019: 110, // قماش قطن (متر)
  TH0020: 185, // كتان (متر)
  TH0021: 195, // جينز (متر)
  TH0022: 120, // جوخ (متر)
  TH0023: 95,  // لباد (متر)
  TH0024: 175, // كانفاس (متر)
  TH0025: 150, // تويل (متر)
  TH0026: 190, // قطيفة (متر)
  TH0027: 210, // مخمل (متر)
  TH0028: 95,  // ساتان (متر)
  TH0029: 115, // حرير صناعي (متر)
  TH0030: 135, // دانتيل (متر)
  TH0031: 65,  // تل وشيفون (متر)
  TH0032: 145, // قماش تنجيد (متر)
  TH0033: 75,  // قماش بطانة (متر)
  TH0034: 45,  // غير منسوج (متر)
  TH0035: 240, // قماش تافت وبانش نيدل (متر)
  TH0036: 85,  // قماش خيش (متر)
  TH0037: 25,  // شريط ساتان (بكرة)
  TH0038: 45,  // شريط دانتيل (لفة)
  TH0039: 35,  // شريط بوم بوم وفرنشة (متر/لفة)
  TH0040: 40,  // فيلكرو (متر/لفة)
  TH0041: 55,  // شريط حزام شنط (لفة)
  TH0042: 65,  // فازلين لاصق (متر)
  TH0043: 50,  // فازلين عادي (متر)
  TH0044: 95,  // شبك تطريز وتافت (متر)
  TH0045: 75,  // شبك شنط بلاستيك (فرخ)
  TH0046: 290, // صوف لباد فلتنج (كيلو)
  TH0047: 160, // كليم (كيلو)
  TH0048: 135, // حشو فايبر (كيلو)
  TH0049: 150, // إسفنج شيت (متر)
  TH0050: 110, // بوري وبطانة شنط (متر)
  TH0051: 190, // قطن مبروم (كيلو)
  TH0052: 160, // بوليستر مصري (كيلو)
  TH0053: 170, // كردون فاضي (كيلو)
  TH0054: 185, // قطن محلول (كيلو)
  TH0055: 180, // كردون الزجزاج (كيلو)
  TH0056: 220, // قطن مجدول أو مبروم سلب (كيلو)

  // CL: Resin, Clay, Wax, Soap
  CL0001: 520, // ريزن إيبوكسي (كيلو)
  CL0002: 215, // ريزن بوليستر (كيلو)
  CL0003: 680, // ريزن UV (كيلو/عبوة)
  CL0004: 480, // سيليكون رابر (كيلو)
};

// Realistic brand price multipliers relative to material base market price
const BRAND_PRICE_MULTIPLIERS: Array<{ pattern: RegExp; factor: number }> = [
  { pattern: /أليز|alize/i, factor: 1.32 },
  { pattern: /يارن\s*آرت|yarn\s*art|yarnart/i, factor: 1.35 },
  { pattern: /ناكو|nako/i, factor: 1.25 },
  { pattern: /هيمالايا|himalaya/i, factor: 1.28 },
  { pattern: /كارتوبو|kartopu/i, factor: 1.22 },
  { pattern: /دي\s*إم\s*سي|dmc/i, factor: 1.65 },
  { pattern: /أنكور|anchor/i, factor: 1.45 },
  { pattern: /سواروفسكي|swarovski/i, factor: 2.8 },
  { pattern: /تشيكي|preciosa/i, factor: 1.75 },
  { pattern: /ميوكي|miyuki|توهو|toho/i, factor: 2.1 },
  { pattern: /ykk/i, factor: 1.45 },
  { pattern: /كيمابوكسي|kemapoxy|سيتا|sika/i, factor: 1.15 },
  { pattern: /إيطالي|ألماني|تركي|مستورد|اوروبي/i, factor: 1.3 },
  { pattern: /محلي|مصري|شعبي|صيني|عادي/i, factor: 0.92 },
  { pattern: /غزل\s*المحلة|مصر\s*المحلة/i, factor: 1.05 },
  { pattern: /فابر|وينسور|winsor|faber|ليكويديكس|liquitex/i, factor: 1.55 },
  { pattern: /جوتن|jotun|جي\s*إل\s*سي|glc|سايبس|ميدو|كابسي/i, factor: 1.12 },
];

function normAr(raw?: string | null): string {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

/**
 * Computes a realistic initial Egyptian market average price (EGP) for ANY of the 401 materials.
 */
export function getDefaultMarketBasePrice(master: Pick<UnifiedMaterialMaster, 'code' | 'prefix' | 'canonicalName' | 'unitChain'>): number {
  const code = String(master.code || '').toUpperCase();
  if (EXACT_CODE_MARKET_PRICES[code]) {
    return EXACT_CODE_MARKET_PRICES[code];
  }

  const name = normAr(master.canonicalName);
  const p = master.prefix;

  // Smart keyword-based Egyptian market averages
  if (p === 'TH') {
    if (name.includes('قماش') || name.includes('كتان') || name.includes('مخمل') || name.includes('كانفاس')) return 145;
    if (name.includes('شريط') || name.includes('دانتيل')) return 40;
    if (name.includes('خيط تطريز') || name.includes('مولينيه')) return 25;
    if (name.includes('صوف') || name.includes('مخملي') || name.includes('فرو')) return 320;
    return 180;
  }
  if (p === 'BD') {
    if (name.includes('حجر طبيعي') || name.includes('عقيق') || name.includes('فيروز')) return 140;
    if (name.includes('كريستال') || name.includes('لولي')) return 65;
    if (name.includes('سلسله') || name.includes('سلاسل') || name.includes('قفل') || name.includes('حلقات')) return 85;
    if (name.includes('شنط') || name.includes('يد') || name.includes('قاعده') || name.includes('سوسته')) return 75;
    return 55;
  }
  if (p === 'CL') {
    if (name.includes('ريزن') || name.includes('ايبوكسي')) return 510;
    if (name.includes('سيليكون')) return 460;
    if (name.includes('شمع عسل')) return 360;
    if (name.includes('شمع صويا') || name.includes('شمع')) return 210;
    if (name.includes('صابون') || name.includes('جلسرين')) return 175;
    if (name.includes('صلصال حراري') || name.includes('بوليمر')) return 95;
    if (name.includes('جبس') || name.includes('اسمنت') || name.includes('خرسانه')) return 45;
    if (name.includes('جسمونيت') || name.includes('اكريليك ريزن')) return 245;
    if (name.includes('عطر') || name.includes('زيت')) return 185;
    return 160;
  }
  if (p === 'WD') {
    if (name.includes('لوح') || name.includes('mdf') || name.includes('كونتر') || name.includes('ابلكاش')) return 420;
    if (name.includes('زان') || name.includes('ارو') || name.includes('موسكي') || name.includes('طبيعي')) return 320;
    if (name.includes('راتان') || name.includes('خيزران') || name.includes('بامبو') || name.includes('خوص')) return 190;
    if (name.includes('حلقه') || name.includes('عصا') || name.includes('قاعده')) return 45;
    return 130;
  }
  if (p === 'LT') {
    if (name.includes('جلد طبيعي') || name.includes('بقري') || name.includes('ماعز') || name.includes('حور')) return 115;
    if (name.includes('جلد صناعي') || name.includes('سكاي') || name.includes('بي في سي')) return 135;
    if (name.includes('صبغه') || name.includes('ورنيش') || name.includes('شمع')) return 145;
    if (name.includes('خيط')) return 95;
    return 110;
  }
  if (p === 'MT') {
    if (name.includes('فضه')) return 1450;
    if (name.includes('نحاس')) return 520;
    if (name.includes('ستانلس') || name.includes('استانلس')) return 220;
    if (name.includes('سلك') || name.includes('صاج') || name.includes('شاسيه')) return 165;
    return 140;
  }
  if (p === 'DC') {
    if (name.includes('اكريليك') || name.includes('مرايا') || name.includes('مرايه')) return 240;
    if (name.includes('ورق ذهب') || name.includes('ذهب')) return 95;
    if (name.includes('الوان') || name.includes('ورنيش') || name.includes('دهان') || name.includes('لاكيه')) return 155;
    if (name.includes('ورد') || name.includes('مجفف')) return 85;
    return 110;
  }
  if (p === 'AR') {
    if (name.includes('زيت') || name.includes('اكريليك') || name.includes('جواش') || name.includes('مائي')) return 165;
    if (name.includes('كانفاس') || name.includes('توال') || name.includes('شاسيه')) return 140;
    if (name.includes('فرش') || name.includes('اقلام')) return 120;
    return 135;
  }
  if (p === 'PK') {
    if (name.includes('علبه') || name.includes('بوكس') || name.includes('كرتون')) return 22;
    if (name.includes('كيس') || name.includes('شنطه')) return 12;
    if (name.includes('ستيكر') || name.includes('كارت') || name.includes('تاك') || name.includes('لوجو')) return 85;
    if (name.includes('بابلز') || name.includes('فوم') || name.includes('استرتش')) return 95;
    return 35;
  }
  if (p === 'PP') {
    if (name.includes('ورق') || name.includes('كانسون') || name.includes('كرافت')) return 45;
    return 65;
  }
  if (p === 'GL') {
    if (name.includes('زجاج') || name.includes('موزاييك') || name.includes('فسيفساء')) return 185;
    return 150;
  }
  if (p === 'AX') {
    if (name.includes('غراء') || name.includes('لاصق') || name.includes('كله') || name.includes('شمع')) return 95;
    if (name.includes('مقص') || name.includes('مسدس') || name.includes('اداه') || name.includes('قالب')) return 140;
    return 85;
  }
  return 100;
}

/**
 * Generates initial realistic brand prices for any defaultBrands on a material,
 * respecting realistic market tier differences (e.g., Turkish / European brands vs local).
 */
export function getDefaultBrandPrices(
  master: Pick<UnifiedMaterialMaster, 'code' | 'prefix' | 'canonicalName' | 'unitChain' | 'defaultBrands'>,
  basePriceOverride?: number
): Record<string, number> {
  const base = Number(basePriceOverride) > 0 ? Number(basePriceOverride) : getDefaultMarketBasePrice(master);
  const out: Record<string, number> = {};
  for (const br of master.defaultBrands || []) {
    const clean = String(br || '').trim();
    if (!clean) continue;
    let factor = 1;
    for (const rule of BRAND_PRICE_MULTIPLIERS) {
      if (rule.pattern.test(clean)) {
        factor = rule.factor;
        break;
      }
    }
    // Round cleanly to nearest 5 EGP for prices >= 50, else nearest integer
    const rawPrice = base * factor;
    out[clean] = rawPrice >= 50 ? Math.round(rawPrice / 5) * 5 : Math.max(1, Math.round(rawPrice));
  }
  return out;
}

export interface ResolvedBrandPrice {
  price: number;
  source: 'personal' | 'brand_market' | 'brands_average_fallback' | 'market_base_fallback';
  sourceLabelAr: string;
}

/**
 * Resolves the effective price for a brand on a given material:
 * 1. Member's personal price override for this brand (if entered)
 * 2. Official/averaged brand market price (if recorded for this brand)
 * 3. Average of other priced brands on the same material ("سعر اعتباري — متوسط الماركات")
 * 4. Material's general market price ("سعر اعتباري — متوسط السوق")
 */
export function resolveEffectiveBrandPrice(
  master: UnifiedMaterialMaster,
  brandName: string,
  personalBrandPrices?: Record<string, number>,
  personalBasePrice?: number
): ResolvedBrandPrice {
  const cleanBrand = String(brandName || '').trim();

  // 1. Personal override for this specific brand
  const personalBr = personalBrandPrices?.[cleanBrand];
  if (Number(personalBr) > 0) {
    return {
      price: Number(personalBr),
      source: 'personal',
      sourceLabelAr: 'سعرك الخاص لهذه الماركة',
    };
  }

  // 2. Global brand price (explicitly saved or seeded)
  const mergedBrandPrices: Record<string, number> = {
    ...getDefaultBrandPrices(master, master.marketBasePrice),
    ...(master.brandPrices || {}),
  };
  if (Number(mergedBrandPrices[cleanBrand]) > 0) {
    return {
      price: Number(mergedBrandPrices[cleanBrand]),
      source: 'brand_market',
      sourceLabelAr: 'سعر سوق الماركة',
    };
  }

  // 3. Fallback: Average of all priced brands on the same material
  const otherBrandValues = Object.values(mergedBrandPrices).filter((v) => Number(v) > 0);
  if (otherBrandValues.length > 0) {
    const avg = Math.round(otherBrandValues.reduce((s, v) => s + v, 0) / otherBrandValues.length);
    return {
      price: avg,
      source: 'brands_average_fallback',
      sourceLabelAr: 'سعر اعتباري (متوسط الماركات)',
    };
  }

  // 4. Fallback: Material's personal base price or general market price
  const basePrice =
    Number(personalBasePrice) > 0
      ? Number(personalBasePrice)
      : Number(master.marketBasePrice) > 0
      ? Number(master.marketBasePrice)
      : getDefaultMarketBasePrice(master);

  return {
    price: basePrice,
    source: 'market_base_fallback',
    sourceLabelAr: 'سعر اعتباري (متوسط السوق)',
  };
}

/**
 * Computes average across priced brands on a material (or returns general market price).
 */
export function getBrandsAveragePrice(master: UnifiedMaterialMaster): number {
  const mergedBrandPrices: Record<string, number> = {
    ...getDefaultBrandPrices(master, master.marketBasePrice),
    ...(master.brandPrices || {}),
  };
  const vals = Object.values(mergedBrandPrices).filter((v) => Number(v) > 0);
  if (vals.length === 0) {
    return Number(master.marketBasePrice) > 0 ? Number(master.marketBasePrice) : getDefaultMarketBasePrice(master);
  }
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

/**
 * Computes a safe, outlier-resistant market average from multiple artisan/supplier observations.
 * - Requires at least 2 independent observations so a single member never shifts the global market price.
 * - Trims highest & lowest outlier when 4+ observations exist.
 */
export function computeTrimmedMarketAverage(values: number[]): number | null {
  const valid = values
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (valid.length < 2) return null;

  const slice = valid.length >= 4 ? valid.slice(1, valid.length - 1) : valid;
  const mean = slice.reduce((acc, v) => acc + v, 0) / slice.length;
  return mean >= 50 ? Math.round(mean) : Number(mean.toFixed(2));
}
