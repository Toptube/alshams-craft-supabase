import {
  UnifiedMaterialMaster,
  SEEDED_UNIFIED_MASTERS,
} from '../registry/unifiedMaterialsRegistry';
import type { SupabaseMaterial } from '../db/supabaseService';
import type { SavedProductRecord } from '../types';

/**
 * Normalize Arabic/English material name for accurate duplicate & legacy matching.
 * Strips noise words like "خيط " and single-thickness suffixes like "4 مم", "3mm".
 */
export function normalizeMaterialKey(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    // strip ONLY thickness/size parenthetical notes like "(2 - 6 مم)" or "(كل السماكات)"
    // while preserving semantic qualifiers like "(ألواح)", "(بوليستر)", "(نايلون)", "(خيط صيد)"
    .replace(/\([^)]*(?:مم|مللي|ملي|mm|سماك)[^)]*\)/gi, ' ')
    // strip thickness ranges like "من 2 الي 6 مم" / "4 و 6 مم" / "8، 10، 12 مم"
    .replace(/(?:من\s+)?\d+(?:\.\d+)?(?:\s*(?:الي|الى|و|،|,|-|—)\s*\d+(?:\.\d+)?)*\s*(?:مم|مللي|ملي|mm)/gi, ' ')
    // strip phrases like "كل السماكات" / "جميع السماكات"
    .replace(/(?:كل|جميع)\s+السماكات/g, ' ')
    // strip common leading noise words "خيط " / "خيوط " ONLY when followed by specific cord names
    .replace(/^(?:خيط|خيوط)\s+(?=(?:قطن|بوليستر|كردون|كوردون|سلب|مكرمي))/g, '')
    .replace(/[()\/\-—_،,.:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match a legacy/manual material name (or code) to an official UnifiedMaterialMaster.
 * Uses strict exact canonical match + UNIQUE-only aliases + safe legacy CORD_TYPES fallback
 * so distinct materials NEVER falsely collapse into each other.
 */
export function matchMaterialToUnifiedMaster(
  materialName: string,
  masters: UnifiedMaterialMaster[] = SEEDED_UNIFIED_MASTERS
): UnifiedMaterialMaster | null {
  const norm = normalizeMaterialKey(materialName);
  if (!norm) return null;

  const activeMasters = masters.filter((m) => m.status === 'active');

  // 1. Exact canonical name match (highest precision, zero false collisions)
  const exactMatches = activeMasters.filter((m) => normalizeMaterialKey(m.canonicalName) === norm);
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }
  if (exactMatches.length > 1) {
    // Ambiguous across categories (e.g. MT0027 vs AX0023); return first only if unambiguous in caller
    return exactMatches[0];
  }

  // 2. Exact alias match — ONLY if the alias uniquely maps to a SINGLE active master!
  // (Prevents shared category aliases like "قماش قطن", "صوف", "شريط ساتان" from colliding 5-18 distinct items)
  const aliasHits: UnifiedMaterialMaster[] = [];
  for (const m of activeMasters) {
    const aliases = [...(m.artistAliases || []), ...(m.supplierAliases || [])];
    if (aliases.some((a) => normalizeMaterialKey(a) === norm)) {
      aliasHits.push(m);
    }
  }
  if (aliasHits.length === 1) {
    return aliasHits[0];
  }

  // 3. Smart domain rules ONLY for legacy default CORD_TYPES & common Arabic cord names
  // (Never hijacks distinct fabrics like "قماش خيش" or "جوت" because Step 1 already handled them!)
  const findByCode = (code: string) => activeMasters.find((m) => m.code === code) || null;
  if (norm.includes('سلب')) return findByCode('TH0056');
  if (norm.includes('زجزاج') || norm.includes('zigzag')) return findByCode('TH0055');
  if (norm.includes('بوليستر مصري') || (norm.includes('بوليستر') && norm.includes('مصري'))) return findByCode('TH0052');
  if (norm.includes('كردون مبطن') || norm.includes('كوردون مبطن') || (norm.includes('قيطان') && norm.includes('فايبر'))) return findByCode('TH0003');
  if (norm.includes('كردون فاضي') || norm.includes('كوردون فاضي') || norm.includes('كردون مجوف')) return findByCode('TH0053');
  if (norm.includes('قطن محلول') || norm.includes('مكرميه محلول')) return findByCode('TH0054');
  if (norm.includes('قطن مبروم') || norm.includes('قطن مضفور') || norm.includes('3 فتله')) return findByCode('TH0051');
  if (norm.includes('قطن مجدول') || norm.includes('مكرميه قطن') || norm.includes('قيطان مجدول')) return findByCode('TH0001');
  if (norm === 'حبل قطن' || norm === 'حبال قطن') return findByCode('TH0002');
  if (norm === 'خيش' || norm === 'حبل خيش' || norm === 'خيط خيش') return findByCode('TH0006');
  if (norm === 'جوت' || norm === 'حبل جوت' || norm === 'خيط جوت') return findByCode('TH0004');

  return null;
}

export interface MaterialDuplicateGroup {
  groupKey: string;
  keep: SupabaseMaterial;
  duplicates: SupabaseMaterial[];
  resolvedMaster?: UnifiedMaterialMaster | null;
  mergedPrice: number;
  mergedStock: number;
}

export interface LegacyUnlinkedItem {
  material: SupabaseMaterial;
  suggestedMaster: UnifiedMaterialMaster | null;
}

export interface MaterialsHealthReport {
  duplicateGroups: MaterialDuplicateGroup[];
  totalDuplicateRows: number;
  legacyUnlinked: LegacyUnlinkedItem[];
  hasIssues: boolean;
}

/**
 * Analyze a workshop's materials to detect:
 * 1. Exact & fuzzy duplicates (e.g. importing 56 cords twice, or legacy manual item + unified item)
 * 2. Legacy materials not yet linked to the Unified Materials System
 */
export function analyzeMaterialsHealth(
  materials: SupabaseMaterial[],
  localUnifiedMap: Record<string, { masterCode: string; specCode?: string; unitChain?: string }>,
  stockData: Record<string, { currentStock: number; minAlertThreshold: number; warehouseTracked?: boolean }>,
  masters: UnifiedMaterialMaster[] = SEEDED_UNIFIED_MASTERS
): MaterialsHealthReport {
  const buckets = new Map<string, { items: SupabaseMaterial[]; master?: UnifiedMaterialMaster | null }>();

  for (const m of materials) {
    const mappedCode = (
      localUnifiedMap[m.id]?.masterCode ||
      (m as any).unified_code ||
      ''
    )
      .trim()
      .toUpperCase();

    const matchedMaster =
      (mappedCode ? masters.find((x) => x.code === mappedCode) : null) ||
      matchMaterialToUnifiedMaster(m.name, masters);

    const groupKey = matchedMaster
      ? `MASTER:${matchedMaster.code}`
      : mappedCode
      ? `CODE:${mappedCode}`
      : `NAME:${normalizeMaterialKey(m.name) || m.id}`;

    const entry = buckets.get(groupKey) || { items: [], master: matchedMaster };
    entry.items.push(m);
    if (!entry.master && matchedMaster) entry.master = matchedMaster;
    buckets.set(groupKey, entry);
  }

  const duplicateGroups: MaterialDuplicateGroup[] = [];
  let totalDuplicateRows = 0;
  const legacyUnlinked: LegacyUnlinkedItem[] = [];

  for (const [groupKey, { items, master }] of buckets.entries()) {
    if (items.length > 1) {
      // Score each item to pick the best single row to keep
      const scored = [...items].sort((a, b) => {
        const aLinked = Boolean(localUnifiedMap[a.id]?.masterCode || (a as any).unified_code) ? 100 : 0;
        const bLinked = Boolean(localUnifiedMap[b.id]?.masterCode || (b as any).unified_code) ? 100 : 0;
        const aPrice = Number(a.purchase_price) > 0 ? 50 : 0;
        const bPrice = Number(b.purchase_price) > 0 ? 50 : 0;
        const aStock = (stockData[a.id]?.currentStock || 0) > 0 ? 40 : 0;
        const bStock = (stockData[b.id]?.currentStock || 0) > 0 ? 40 : 0;
        const aSup = a.supplier_id ? 10 : 0;
        const bSup = b.supplier_id ? 10 : 0;
        return bLinked + bPrice + bStock + bSup - (aLinked + aPrice + aStock + aSup);
      });

      const keep = scored[0];
      const duplicates = scored.slice(1);
      const mergedPrice = Math.max(0, ...items.map((x) => Number(x.purchase_price) || 0));
      const mergedStock = Math.max(0, ...items.map((x) => Number(stockData[x.id]?.currentStock) || 0));

      duplicateGroups.push({
        groupKey,
        keep,
        duplicates,
        resolvedMaster: master || null,
        mergedPrice,
        mergedStock,
      });
      totalDuplicateRows += duplicates.length;
    } else if (items.length === 1) {
      const only = items[0];
      const hasUnified = Boolean(localUnifiedMap[only.id]?.masterCode || (only as any).unified_code);
      if (!hasUnified && master) {
        legacyUnlinked.push({
          material: only,
          suggestedMaster: master,
        });
      }
    }
  }

  return {
    duplicateGroups,
    totalDuplicateRows,
    legacyUnlinked,
    hasIssues: totalDuplicateRows > 0 || legacyUnlinked.length > 0,
  };
}

export interface ProductLegacyIssue {
  product: SavedProductRecord;
  legacyCordName?: string;
  legacyCordId?: string;
  suggestedCordMaterial?: SupabaseMaterial | null;
  legacyExtras: Array<{
    index: number;
    oldName: string;
    oldId?: string;
    suggestedMaterial?: SupabaseMaterial | null;
  }>;
}

/**
 * Scan saved products to detect any product referencing legacy/deleted/unlinked materials
 * so the artist receives a clear alert to swap them to the new Unified Materials System and save.
 */
export function scanProductsForLegacyMaterials(
  products: SavedProductRecord[],
  materials: SupabaseMaterial[],
  localUnifiedMap: Record<string, { masterCode: string; specCode?: string }>,
  masters: UnifiedMaterialMaster[] = SEEDED_UNIFIED_MASTERS
): ProductLegacyIssue[] {
  const matById = new Map<string, SupabaseMaterial>();
  const matByMasterCode = new Map<string, SupabaseMaterial>();
  const matByNormName = new Map<string, SupabaseMaterial>();

  for (const m of materials) {
    matById.set(m.id, m);
    const code = (localUnifiedMap[m.id]?.masterCode || (m as any).unified_code || '').toUpperCase();
    if (code && !matByMasterCode.has(code)) matByMasterCode.set(code, m);
    const nk = normalizeMaterialKey(m.name);
    if (nk && !matByNormName.has(nk)) matByNormName.set(nk, m);
  }

  const findReplacementInWorkshop = (rawName?: string): SupabaseMaterial | null => {
    if (!rawName) return null;
    const nk = normalizeMaterialKey(rawName);
    if (matByNormName.has(nk)) return matByNormName.get(nk)!;
    const matchedMaster = matchMaterialToUnifiedMaster(rawName, masters);
    if (matchedMaster && matByMasterCode.has(matchedMaster.code)) {
      return matByMasterCode.get(matchedMaster.code)!;
    }
    return null;
  };

  const issues: ProductLegacyIssue[] = [];

  for (const prod of products) {
    const inp = prod?.input;
    if (!inp) continue;

    let legacyCordName: string | undefined;
    let legacyCordId: string | undefined;
    let suggestedCordMaterial: SupabaseMaterial | null = null;

    const cordId = String(inp.cordTypeId || (inp as any).cordType || '').trim();
    const cordName = String((inp as any).cordTypeName || '').trim();
    const currentCordMat = cordId ? matById.get(cordId) : undefined;
    const cordIsUnified =
      currentCordMat && Boolean(localUnifiedMap[currentCordMat.id]?.masterCode || (currentCordMat as any).unified_code);

    // Flag if cord references legacy static id (cord_*) OR deleted material OR unlinked legacy material
    const looksLegacyCord =
      Boolean(cordId || cordName) &&
      (cordId.startsWith('cord_') || !currentCordMat || !cordIsUnified);

    if (looksLegacyCord) {
      const displayOld = currentCordMat?.name || cordName || cordId;
      legacyCordId = cordId;
      legacyCordName = displayOld;
      suggestedCordMaterial = findReplacementInWorkshop(displayOld);
    }

    const legacyExtras: ProductLegacyIssue['legacyExtras'] = [];
    const extras = Array.isArray(inp.extraMaterials) ? inp.extraMaterials : [];
    extras.forEach((ex: any, idx: number) => {
      const exId = String(ex?.materialId || '').trim();
      const exName = String(ex?.name || '').trim();
      if (!exName && !exId) return;
      const foundMat = exId ? matById.get(exId) : matByNormName.get(normalizeMaterialKey(exName));
      const exIsUnified =
        foundMat && Boolean(localUnifiedMap[foundMat.id]?.masterCode || (foundMat as any).unified_code);
      if (!foundMat || !exIsUnified) {
        const rep = findReplacementInWorkshop(exName || foundMat?.name);
        if (rep && rep.id !== exId) {
          legacyExtras.push({
            index: idx,
            oldName: exName || foundMat?.name || 'خامة إضافية',
            oldId: exId || undefined,
            suggestedMaterial: rep,
          });
        }
      }
    });

    if (legacyCordName || legacyExtras.length > 0) {
      issues.push({
        product: prod,
        legacyCordName,
        legacyCordId,
        suggestedCordMaterial,
        legacyExtras,
      });
    }
  }

  return issues;
}
