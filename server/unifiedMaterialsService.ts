import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  UNIFIED_CATEGORIES,
  UNIT_CHAINS,
  FIXED_UNIT_CONVERSIONS,
  SEEDED_BRANDS,
  SEEDED_UNIFIED_MASTERS,
  SEEDED_UNIFIED_SPECS,
  SEEDED_UNIFIED_ALIASES,
  UnifiedCategoryPrefix,
  UnifiedBrandRecord,
  UnifiedMaterialMaster,
  UnifiedMaterialSpec,
  UnifiedMaterialAlias,
  UnifiedMaterialNotification,
  MemberMaterialCustomization,
  generateNextMasterCode,
  generateNextSpecCode,
  generateNextAliasCode,
  generateNextBrandCode,
} from '../src/registry/unifiedMaterialsRegistry.js';
import {
  getDefaultMarketBasePrice,
  getDefaultBrandPrices,
  computeTrimmedMarketAverage,
} from '../src/utils/unifiedMarketPricing.js';

export const GLOBAL_PRICING_MEMBER_ID = '__GLOBAL_MARKET_PRICING__';
export const GLOBAL_PRICE_SPEC_CODE = '__PRICE__';
export const MEMBER_PRICE_OBS_SPEC_CODE = '__PRICE_OBS__';
const AUTO_PRICE_AVG_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
let lastAutoPriceAvgAt = 0;

interface GlobalPricingOverride {
  marketBasePrice?: number;
  brandPrices?: Record<string, number>;
  priceSource?: 'seeded_market' | 'super_admin' | 'auto_average';
  priceLastUpdatedAt?: string;
  observationsCount?: number;
}

function sanitizePositivePrice(v: unknown): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) return undefined;
  return n >= 50 ? Math.round(n) : Number(n.toFixed(2));
}

function sanitizeBrandPricesMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const cleanKey = String(k || '').trim();
    const cleanVal = sanitizePositivePrice(v);
    if (cleanKey && cleanVal !== undefined) {
      out[cleanKey] = cleanVal;
    }
  }
  return out;
}

function extractGlobalPricingAndObsCounts(customizations: MemberMaterialCustomization[]) {
  const globalMap = new Map<string, GlobalPricingOverride>();
  const obsMembersByMaster = new Map<string, Set<string>>();

  for (const c of customizations) {
    const code = String(c.masterCode || '').toUpperCase();
    if (!code) continue;
    if (c.memberId === GLOBAL_PRICING_MEMBER_ID && c.specCode === GLOBAL_PRICE_SPEC_CODE) {
      const ov = (c.bridgeOverrides || {}) as Record<string, any>;
      globalMap.set(code, {
        marketBasePrice: sanitizePositivePrice(ov.marketBasePrice),
        brandPrices: sanitizeBrandPricesMap(ov.brandPrices),
        priceSource:
          ov.priceSource === 'super_admin' || ov.priceSource === 'auto_average'
            ? ov.priceSource
            : 'seeded_market',
        priceLastUpdatedAt: typeof ov.priceLastUpdatedAt === 'string' ? ov.priceLastUpdatedAt : c.updatedAt,
        observationsCount: Number(ov.observationsCount || 0),
      });
    } else if (c.specCode === MEMBER_PRICE_OBS_SPEC_CODE && c.memberId !== GLOBAL_PRICING_MEMBER_ID) {
      const set = obsMembersByMaster.get(code) || new Set<string>();
      set.add(`${c.memberRole}:${c.memberId}`);
      obsMembersByMaster.set(code, set);
    }
  }

  const obsCounts = new Map<string, number>();
  for (const [code, set] of obsMembersByMaster.entries()) {
    obsCounts.set(code, set.size);
  }
  return { globalMap, obsCounts };
}

function hydrateMasterPricing(
  master: UnifiedMaterialMaster,
  globalOverride?: GlobalPricingOverride,
  obsCount?: number
): UnifiedMaterialMaster {
  const basePrice =
    globalOverride?.marketBasePrice ??
    sanitizePositivePrice(master.marketBasePrice) ??
    getDefaultMarketBasePrice(master);

  const mergedBrands: Record<string, number> = {
    ...getDefaultBrandPrices(master, basePrice),
    ...sanitizeBrandPricesMap(master.brandPrices),
    ...(globalOverride?.brandPrices || {}),
  };

  return {
    ...master,
    marketBasePrice: basePrice,
    brandPrices: mergedBrands,
    priceSource: globalOverride?.priceSource || master.priceSource || 'seeded_market',
    priceLastUpdatedAt: globalOverride?.priceLastUpdatedAt || master.priceLastUpdatedAt,
    priceObservationsCount: Math.max(
      Number(globalOverride?.observationsCount || 0),
      Number(obsCount || 0),
      Number(master.priceObservationsCount || 0)
    ),
  };
}

export interface UnifiedMaterialsPersistedState {
  customMasters: UnifiedMaterialMaster[];
  masterPatches: Record<string, Partial<UnifiedMaterialMaster>>;
  customSpecs: UnifiedMaterialSpec[];
  specPatches: Record<string, Partial<UnifiedMaterialSpec>>;
  customAliases: UnifiedMaterialAlias[];
  customBrands: UnifiedBrandRecord[];
  notifications: UnifiedMaterialNotification[];
  memberCustomizations: MemberMaterialCustomization[];
  reservedMasterSeqs: Record<string, number>;
  updatedAt: string;
}

export interface UnifiedSupabaseSyncReport {
  ok: boolean;
  tablesReady: boolean;
  tablesMissing: string[];
  seededCounts: {
    categories: number;
    brands: number;
    masters: number;
    specs: number;
    aliases: number;
    notifications: number;
    memberCustomizations: number;
  };
  verifiedCounts: {
    categories: number;
    brands: number;
    masters: number;
    specs: number;
    aliases: number;
    notifications: number;
    memberCustomizations: number;
  };
  error?: string;
  syncedAt: string;
}

const STATE_FILE = path.resolve(process.cwd(), 'data/unified_materials_state.json');

let autoSeedCompletedInMemory = false;
let autoSeedInFlight: Promise<UnifiedSupabaseSyncReport> | null = null;
let legacyHiddenCleanupDone = false;

function getEmptyState(): UnifiedMaterialsPersistedState {
  return {
    customMasters: [],
    masterPatches: {},
    customSpecs: [],
    specPatches: {},
    customAliases: [],
    customBrands: [],
    notifications: [],
    memberCustomizations: [],
    reservedMasterSeqs: {},
    updatedAt: new Date().toISOString(),
  };
}

export function loadUnifiedMaterialsState(): UnifiedMaterialsPersistedState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...getEmptyState(),
        ...(parsed || {}),
      };
    }
  } catch (err) {
    console.warn('[UnifiedMaterials] Read state error:', err);
  }
  return getEmptyState();
}

export function saveUnifiedMaterialsState(state: UnifiedMaterialsPersistedState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[UnifiedMaterials] Write state error:', err);
  }
}

export function buildMergedUnifiedSnapshot(
  state: UnifiedMaterialsPersistedState,
  options?: {
    memberRole?: 'artisan' | 'supplier';
    memberId?: string;
    isSuperAdmin?: boolean;
  }
) {
  const masterMap = new Map<string, UnifiedMaterialMaster>();
  for (const m of SEEDED_UNIFIED_MASTERS) {
    const patch = state.masterPatches[m.code];
    masterMap.set(m.code, patch ? { ...m, ...patch } : m);
  }
  for (const cm of state.customMasters) {
    const patch = state.masterPatches[cm.code];
    masterMap.set(cm.code, patch ? { ...cm, ...patch } : cm);
  }

  const specMap = new Map<string, UnifiedMaterialSpec>();
  for (const s of SEEDED_UNIFIED_SPECS) {
    const patch = state.specPatches[s.specCode];
    specMap.set(s.specCode, patch ? { ...s, ...patch } : s);
  }
  for (const cs of state.customSpecs) {
    const patch = state.specPatches[cs.specCode];
    specMap.set(cs.specCode, patch ? { ...cs, ...patch } : cs);
  }

  const aliasMap = new Map<string, UnifiedMaterialAlias>();
  for (const a of SEEDED_UNIFIED_ALIASES) aliasMap.set(a.aliasCode, a);
  for (const ca of state.customAliases) aliasMap.set(ca.aliasCode, ca);

  const brandMap = new Map<string, UnifiedBrandRecord>();
  for (const b of SEEDED_BRANDS) brandMap.set(b.brandCode, b);
  for (const cb of state.customBrands) brandMap.set(cb.brandCode, cb);

  const { globalMap, obsCounts } = extractGlobalPricingAndObsCounts(state.memberCustomizations);

  const hydratedMasters = Array.from(masterMap.values()).map((m) =>
    hydrateMasterPricing(m, globalMap.get(m.code), obsCounts.get(m.code))
  );

  const memberCustomizations = (options?.isSuperAdmin
    ? state.memberCustomizations.filter((c) => c.memberId !== GLOBAL_PRICING_MEMBER_ID)
    : options?.memberId
    ? state.memberCustomizations.filter(
        (c) =>
          c.memberId !== GLOBAL_PRICING_MEMBER_ID &&
          c.memberId === options.memberId &&
          (!options.memberRole || c.memberRole === options.memberRole)
      )
    : []
  ).map((c) => ({ ...c, isHidden: false }));

  const cleanNotifications = options?.isSuperAdmin
    ? state.notifications.filter((n) => n.eventType !== 'member_local_remove')
    : [];

  return {
    categories: UNIFIED_CATEGORIES,
    unitChains: UNIT_CHAINS,
    fixedConversions: FIXED_UNIT_CONVERSIONS,
    brands: Array.from(brandMap.values()),
    masters: hydratedMasters,
    specs: Array.from(specMap.values()),
    aliases: Array.from(aliasMap.values()),
    notifications: cleanNotifications,
    memberCustomizations,
    reservedMasterSeqs: state.reservedMasterSeqs,
    storageSource: 'local_fallback' as 'supabase' | 'local_fallback',
  };
}

// ---------------------------------------------------------------------------
// Row Mappers (App <-> Supabase snake_case)
// ---------------------------------------------------------------------------
function masterToRow(master: UnifiedMaterialMaster, includePricingCols = false) {
  const baseRow: Record<string, any> = {
    code: master.code,
    prefix: master.prefix,
    seq_num: master.seqNum,
    canonical_name: master.canonicalName,
    unit_chain: master.unitChain,
    unit_note: master.unitNote || '',
    bridge_fields: Array.isArray(master.bridgeFields) ? master.bridgeFields : [],
    spec_fields: Array.isArray(master.specFields) ? master.specFields : [],
    artist_aliases: Array.isArray(master.artistAliases) ? master.artistAliases : [],
    supplier_aliases: Array.isArray(master.supplierAliases) ? master.supplierAliases : [],
    default_brands: Array.isArray(master.defaultBrands) ? master.defaultBrands : [],
    workshop_tags: Array.isArray(master.workshopTags) ? master.workshopTags : [],
    safety_note: master.safetyNote || '',
    is_asset_only: Boolean(master.isAssetOnly),
    is_added_for_equations: Boolean(master.isAddedForEquations),
    status: master.status || 'active',
    review_status: master.reviewStatus || 'approved',
    created_by_role: master.createdByRole || 'system',
    created_by_id: master.createdById || '',
    created_by_name: master.createdByName || '',
    archive_reason: master.archiveReason || '',
    updated_at: master.updatedAt || new Date().toISOString(),
  };
  if (includePricingCols) {
    baseRow.market_base_price = Number(master.marketBasePrice || 0);
    baseRow.brand_prices = master.brandPrices && typeof master.brandPrices === 'object' ? master.brandPrices : {};
    baseRow.price_source = master.priceSource || 'seeded_market';
    baseRow.price_last_updated_at = master.priceLastUpdatedAt || null;
    baseRow.price_observations_count = Number(master.priceObservationsCount || 0);
  }
  return baseRow;
}

function rowToMaster(r: any): UnifiedMaterialMaster {
  return {
    code: String(r.code),
    prefix: String(r.prefix) as UnifiedCategoryPrefix,
    seqNum: Number(r.seq_num || 0),
    canonicalName: String(r.canonical_name || ''),
    unitChain: r.unit_chain || 'ل1',
    unitNote: r.unit_note || undefined,
    bridgeFields: Array.isArray(r.bridge_fields) ? r.bridge_fields : [],
    specFields: Array.isArray(r.spec_fields) ? r.spec_fields : [],
    artistAliases: Array.isArray(r.artist_aliases) ? r.artist_aliases : [],
    supplierAliases: Array.isArray(r.supplier_aliases) ? r.supplier_aliases : [],
    defaultBrands: Array.isArray(r.default_brands) ? r.default_brands : [],
    workshopTags: Array.isArray(r.workshop_tags) ? r.workshop_tags : [],
    safetyNote: r.safety_note || undefined,
    isAssetOnly: Boolean(r.is_asset_only),
    isAddedForEquations: Boolean(r.is_added_for_equations),
    marketBasePrice: sanitizePositivePrice(r.market_base_price),
    brandPrices: r.brand_prices && typeof r.brand_prices === 'object' ? sanitizeBrandPricesMap(r.brand_prices) : undefined,
    priceSource:
      r.price_source === 'super_admin' || r.price_source === 'auto_average' || r.price_source === 'seeded_market'
        ? r.price_source
        : undefined,
    priceLastUpdatedAt: r.price_last_updated_at || undefined,
    priceObservationsCount: Number(r.price_observations_count || 0) || undefined,
    status: (r.status || 'active') as any,
    reviewStatus: (r.review_status || 'approved') as any,
    createdByRole: (r.created_by_role || 'system') as any,
    createdById: r.created_by_id || undefined,
    createdByName: r.created_by_name || undefined,
    archiveReason: r.archive_reason || undefined,
    createdAt: r.created_at || undefined,
    updatedAt: r.updated_at || undefined,
  };
}

function specToRow(spec: UnifiedMaterialSpec) {
  return {
    spec_code: spec.specCode,
    master_code: spec.masterCode,
    spec_index: spec.specIndex,
    label: spec.label,
    thickness_mm: spec.thicknessMm ?? null,
    plies: spec.plies ?? null,
    size_label: spec.sizeLabel || '',
    color: spec.color || '',
    origin: spec.origin || '',
    bridge_values: spec.bridgeValues || {},
    status: spec.status || 'active',
    review_status: spec.reviewStatus || 'approved',
    created_by_role: spec.createdByRole || 'system',
    created_by_id: spec.createdById || '',
    created_by_name: spec.createdByName || '',
    updated_at: new Date().toISOString(),
  };
}

function rowToSpec(r: any): UnifiedMaterialSpec {
  return {
    specCode: String(r.spec_code),
    masterCode: String(r.master_code),
    specIndex: Number(r.spec_index || 1),
    label: String(r.label || ''),
    thicknessMm: r.thickness_mm !== null && r.thickness_mm !== undefined ? Number(r.thickness_mm) : undefined,
    plies: r.plies !== null && r.plies !== undefined ? Number(r.plies) : undefined,
    sizeLabel: r.size_label || undefined,
    color: r.color || undefined,
    origin: r.origin || undefined,
    bridgeValues: r.bridge_values && typeof r.bridge_values === 'object' ? r.bridge_values : {},
    status: (r.status || 'active') as any,
    reviewStatus: (r.review_status || 'approved') as any,
    createdByRole: (r.created_by_role || 'system') as any,
    createdById: r.created_by_id || undefined,
    createdByName: r.created_by_name || undefined,
    createdAt: r.created_at || undefined,
  };
}

function aliasToRow(alias: UnifiedMaterialAlias) {
  return {
    alias_code: alias.aliasCode,
    target_code: alias.targetCode,
    alias_name: alias.aliasName,
    alias_type: alias.aliasType || 'common',
    context_hint: alias.contextHint || '',
    is_ambiguous: Boolean(alias.isAmbiguous),
    created_by_role: alias.createdByRole || 'system',
    created_by_id: alias.createdById || '',
  };
}

function rowToAlias(r: any): UnifiedMaterialAlias {
  return {
    aliasCode: String(r.alias_code),
    targetCode: String(r.target_code),
    aliasName: String(r.alias_name),
    aliasType: (r.alias_type || 'common') as any,
    contextHint: r.context_hint || undefined,
    isAmbiguous: Boolean(r.is_ambiguous),
    createdByRole: (r.created_by_role || 'system') as any,
    createdById: r.created_by_id || undefined,
  };
}

function brandToRow(brand: UnifiedBrandRecord) {
  return {
    brand_code: brand.brandCode,
    brand_name: brand.brandName,
    category_hint: brand.categoryHint || '',
    needs_review: Boolean(brand.needsReview),
    review_note: brand.reviewNote || '',
    status: brand.status || 'active',
  };
}

function rowToBrand(r: any): UnifiedBrandRecord {
  return {
    brandCode: String(r.brand_code),
    brandName: String(r.brand_name),
    categoryHint: r.category_hint || '',
    needsReview: Boolean(r.needs_review),
    reviewNote: r.review_note || undefined,
    status: (r.status || 'active') as any,
  };
}

function notifToRow(notif: UnifiedMaterialNotification) {
  return {
    id: notif.id,
    event_type: notif.eventType,
    target_code: notif.targetCode,
    target_name: notif.targetName,
    actor_role: notif.actorRole,
    actor_id: notif.actorId,
    actor_name: notif.actorName,
    reason: notif.reason || '',
    payload: notif.payload || {},
    status: notif.status,
    resolved_by: notif.resolvedBy || '',
    resolved_at: notif.resolvedAt || null,
    created_at: notif.createdAt,
  };
}

function rowToNotif(r: any): UnifiedMaterialNotification {
  return {
    id: String(r.id),
    eventType: r.event_type,
    targetCode: String(r.target_code),
    targetName: String(r.target_name || ''),
    actorRole: r.actor_role || 'artisan',
    actorId: String(r.actor_id || ''),
    actorName: String(r.actor_name || ''),
    reason: r.reason || '',
    payload: r.payload || {},
    status: r.status || 'pending',
    resolvedBy: r.resolved_by || undefined,
    resolvedAt: r.resolved_at || undefined,
    createdAt: r.created_at || new Date().toISOString(),
  };
}

function customToRow(custom: MemberMaterialCustomization) {
  return {
    member_role: custom.memberRole,
    member_id: custom.memberId,
    master_code: custom.masterCode,
    spec_code: custom.specCode || '',
    custom_name: custom.customName || '',
    is_hidden: Boolean(custom.isHidden),
    hide_reason: custom.hideReason || '',
    bridge_overrides: custom.bridgeOverrides || {},
    updated_at: custom.updatedAt || new Date().toISOString(),
  };
}

function rowToCustom(r: any): MemberMaterialCustomization {
  return {
    memberRole: r.member_role === 'supplier' ? 'supplier' : 'artisan',
    memberId: String(r.member_id),
    masterCode: String(r.master_code),
    specCode: r.spec_code || '',
    customName: r.custom_name || undefined,
    isHidden: Boolean(r.is_hidden),
    hideReason: r.hide_reason || undefined,
    bridgeOverrides: r.bridge_overrides && typeof r.bridge_overrides === 'object' ? r.bridge_overrides : {},
    updatedAt: r.updated_at || undefined,
  };
}

// ---------------------------------------------------------------------------
// Full Idempotent Seeding & Cloud Sync to Supabase (All 7 Unified Tables)
// ---------------------------------------------------------------------------
export async function syncAllUnifiedMaterialsToSupabase(
  db: SupabaseClient | null | undefined,
  options?: { force?: boolean }
): Promise<UnifiedSupabaseSyncReport> {
  const syncedAt = new Date().toISOString();
  const emptyCounts = {
    categories: 0,
    brands: 0,
    masters: 0,
    specs: 0,
    aliases: 0,
    notifications: 0,
    memberCustomizations: 0,
  };

  if (!db) {
    return {
      ok: false,
      tablesReady: false,
      tablesMissing: ['supabase_client_unavailable'],
      seededCounts: emptyCounts,
      verifiedCounts: emptyCounts,
      error: 'عميل Supabase غير مهيأ على الخادم',
      syncedAt,
    };
  }

  if (autoSeedInFlight && !options?.force) {
    return autoSeedInFlight;
  }

  const run = async (): Promise<UnifiedSupabaseSyncReport> => {
    const requiredTables = [
      'unified_material_categories',
      'unified_material_brands',
      'unified_materials_master',
      'unified_material_specs',
      'unified_material_aliases',
      'unified_material_notifications',
      'member_material_customizations',
    ];

    const missing: string[] = [];
    for (const tbl of requiredTables) {
      const { error } = await db.from(tbl).select('*', { count: 'exact', head: true });
      if (error && (error.code === 'PGRST205' || error.code === '42P01' || /Could not find the table/i.test(error.message))) {
        missing.push(tbl);
      }
    }

    if (missing.length > 0) {
      return {
        ok: false,
        tablesReady: false,
        tablesMissing: missing,
        seededCounts: emptyCounts,
        verifiedCounts: emptyCounts,
        error: `جداول الخامات الموحدة غير منشأة بعد في Supabase (${missing.length} جدول مفقود). شغّل ملف SQL المرفق في Supabase SQL Editor ثم اضغط مزامنة.`,
        syncedAt,
      };
    }

    const state = loadUnifiedMaterialsState();
    const merged = buildMergedUnifiedSnapshot(state, { isSuperAdmin: true });

    try {
      // 1. Categories (12)
      const catRows = UNIFIED_CATEGORIES.map((c, idx) => ({
        prefix: c.prefix,
        name_ar: c.nameAr,
        default_unit_chain: c.defaultUnitChain || 'ل1',
        next_seq: Math.max(
          1,
          Number(state.reservedMasterSeqs[c.prefix] || 0) + 1,
          ...merged.masters.filter((m) => m.prefix === c.prefix).map((m) => Number(m.seqNum || 0) + 1)
        ),
        sort_order: idx + 1,
        updated_at: syncedAt,
      }));
      if (catRows.length > 0) {
        const { error } = await db.from('unified_material_categories').upsert(catRows, { onConflict: 'prefix' });
        if (error) throw new Error(`unified_material_categories: ${error.message}`);
      }

      // 2. Brands (54+)
      const brandRows = merged.brands.map(brandToRow);
      if (brandRows.length > 0) {
        const { error } = await db.from('unified_material_brands').upsert(brandRows, { onConflict: 'brand_code' });
        if (error) throw new Error(`unified_material_brands: ${error.message}`);
      }

      // 3. Masters (401+) in batches of 100 — auto-detect if dedicated pricing columns exist on unified_materials_master
      const { error: priceColProbe } = await db
        .from('unified_materials_master')
        .select('code, market_base_price, brand_prices')
        .limit(1);
      const hasNativePricingCols = !priceColProbe;
      const masterRows = merged.masters.map((m) => masterToRow(m, hasNativePricingCols));
      for (let i = 0; i < masterRows.length; i += 100) {
        const batch = masterRows.slice(i, i + 100);
        const { error } = await db.from('unified_materials_master').upsert(batch, { onConflict: 'code' });
        if (error) throw new Error(`unified_materials_master batch ${i}: ${error.message}`);
      }

      // 4. Specs (12+)
      const specRows = merged.specs.map(specToRow);
      if (specRows.length > 0) {
        const { error } = await db.from('unified_material_specs').upsert(specRows, { onConflict: 'spec_code' });
        if (error) throw new Error(`unified_material_specs: ${error.message}`);
      }

      // 5. Aliases (12+)
      const aliasRows = merged.aliases.map(aliasToRow);
      if (aliasRows.length > 0) {
        const { error } = await db.from('unified_material_aliases').upsert(aliasRows, { onConflict: 'alias_code' });
        if (error) throw new Error(`unified_material_aliases: ${error.message}`);
      }

      // 6. Notifications
      const notifRows = state.notifications.map(notifToRow);
      if (notifRows.length > 0) {
        const { error } = await db.from('unified_material_notifications').upsert(notifRows, { onConflict: 'id' });
        if (error) throw new Error(`unified_material_notifications: ${error.message}`);
      }

      // 7. Member Customizations
      const customRows = state.memberCustomizations.map(customToRow);
      if (customRows.length > 0) {
        const { error } = await db
          .from('member_material_customizations')
          .upsert(customRows, { onConflict: 'member_role,member_id,master_code,spec_code' });
        if (error) throw new Error(`member_material_customizations: ${error.message}`);
      }

      // Verify exact counts from Supabase
      const [cCat, cBrand, cMaster, cSpec, cAlias, cNotif, cCustom] = await Promise.all([
        db.from('unified_material_categories').select('prefix', { count: 'exact', head: true }),
        db.from('unified_material_brands').select('brand_code', { count: 'exact', head: true }),
        db.from('unified_materials_master').select('code', { count: 'exact', head: true }),
        db.from('unified_material_specs').select('spec_code', { count: 'exact', head: true }),
        db.from('unified_material_aliases').select('alias_code', { count: 'exact', head: true }),
        db.from('unified_material_notifications').select('id', { count: 'exact', head: true }),
        db.from('member_material_customizations').select('id', { count: 'exact', head: true }),
      ]);

      autoSeedCompletedInMemory = true;
      return {
        ok: true,
        tablesReady: true,
        tablesMissing: [],
        seededCounts: {
          categories: catRows.length,
          brands: brandRows.length,
          masters: masterRows.length,
          specs: specRows.length,
          aliases: aliasRows.length,
          notifications: notifRows.length,
          memberCustomizations: customRows.length,
        },
        verifiedCounts: {
          categories: cCat.count ?? 0,
          brands: cBrand.count ?? 0,
          masters: cMaster.count ?? 0,
          specs: cSpec.count ?? 0,
          aliases: cAlias.count ?? 0,
          notifications: cNotif.count ?? 0,
          memberCustomizations: cCustom.count ?? 0,
        },
        syncedAt,
      };
    } catch (err: any) {
      return {
        ok: false,
        tablesReady: true,
        tablesMissing: [],
        seededCounts: emptyCounts,
        verifiedCounts: emptyCounts,
        error: err?.message || 'حدث خطأ أثناء ترحيل الخامات إلى Supabase',
        syncedAt,
      };
    }
  };

  autoSeedInFlight = run().finally(() => {
    autoSeedInFlight = null;
  });
  return autoSeedInFlight;
}

// ---------------------------------------------------------------------------
// Supabase-First Snapshot Loader (Auto-Seeds if Tables Exist & Empty)
// ---------------------------------------------------------------------------
export async function loadUnifiedMaterialsSnapshotFromSupabase(
  db: SupabaseClient | null | undefined,
  options?: {
    memberRole?: 'artisan' | 'supplier';
    memberId?: string;
    isSuperAdmin?: boolean;
  }
) {
  const localState = loadUnifiedMaterialsState();
  const fallback = buildMergedUnifiedSnapshot(localState, options);

  if (!db) return fallback;

  try {
    // Quick check on master table + count
    const { count: masterCount, error: probeErr } = await db
      .from('unified_materials_master')
      .select('code', { count: 'exact', head: true });

    if (probeErr) {
      // Tables not created in Supabase yet -> serve local snapshot seamlessly
      return fallback;
    }

    // If tables exist in Supabase but are empty or missing the 395 seeded records, auto-seed them!
    if (!autoSeedCompletedInMemory && (masterCount ?? 0) < SEEDED_UNIFIED_MASTERS.length) {
      await syncAllUnifiedMaterialsToSupabase(db);
    }

    // One-time automatic repair: un-hide any legacy hidden customizations & remove bogus member_local_remove alerts
    if (!legacyHiddenCleanupDone) {
      legacyHiddenCleanupDone = true;
      try {
        await db
          .from('member_material_customizations')
          .update({ is_hidden: false, hide_reason: '' })
          .eq('is_hidden', true);
      } catch {}
      try {
        await db
          .from('unified_material_notifications')
          .delete()
          .eq('event_type', 'member_local_remove');
      } catch {}
    }

    const [mastersRes, specsRes, aliasesRes, brandsRes, notifsRes, customRes] = await Promise.all([
      db.from('unified_materials_master').select('*').order('code', { ascending: true }).limit(2000),
      db.from('unified_material_specs').select('*').order('spec_code', { ascending: true }).limit(2000),
      db.from('unified_material_aliases').select('*').order('alias_code', { ascending: true }).limit(2000),
      db.from('unified_material_brands').select('*').order('brand_code', { ascending: true }).limit(1000),
      options?.isSuperAdmin
        ? db.from('unified_material_notifications').select('*').order('created_at', { ascending: false }).limit(300)
        : Promise.resolve({ data: [], error: null }),
      options?.isSuperAdmin
        ? db.from('member_material_customizations').select('*').limit(5000)
        : options?.memberId
        ? db
            .from('member_material_customizations')
            .select('*')
            .or(`member_id.eq.${GLOBAL_PRICING_MEMBER_ID},member_id.eq.${options.memberId}`)
            .limit(2000)
        : db
            .from('member_material_customizations')
            .select('*')
            .eq('member_id', GLOBAL_PRICING_MEMBER_ID)
            .limit(1000),
    ]);

    if (mastersRes.error || !Array.isArray(mastersRes.data) || mastersRes.data.length === 0) {
      return fallback;
    }

    const rawCustomizations = Array.isArray(customRes.data) ? customRes.data.map(rowToCustom) : [];
    const { globalMap: localGlobalMap, obsCounts: localObsCounts } = extractGlobalPricingAndObsCounts(
      localState.memberCustomizations
    );
    const { globalMap: sbGlobalMap, obsCounts: sbObsCounts } = extractGlobalPricingAndObsCounts(rawCustomizations);

    const masters = mastersRes.data.map((r) => {
      const m = rowToMaster(r);
      const ov = sbGlobalMap.get(m.code) || localGlobalMap.get(m.code);
      const obsCount = Math.max(sbObsCounts.get(m.code) || 0, localObsCounts.get(m.code) || 0);
      return hydrateMasterPricing(m, ov, obsCount);
    });
    const specs = Array.isArray(specsRes.data) ? specsRes.data.map(rowToSpec) : fallback.specs;
    const aliases = Array.isArray(aliasesRes.data) ? aliasesRes.data.map(rowToAlias) : fallback.aliases;
    const brands = Array.isArray(brandsRes.data) && brandsRes.data.length > 0
      ? brandsRes.data.map(rowToBrand)
      : fallback.brands;
    const notifications = Array.isArray(notifsRes.data)
      ? notifsRes.data.map(rowToNotif).filter((n) => n.eventType !== 'member_local_remove')
      : [];
    const memberCustomizations = rawCustomizations
      .filter((c) => c.memberId !== GLOBAL_PRICING_MEMBER_ID)
      .map((c) => ({ ...c, isHidden: false }))
      .filter((c) => options?.isSuperAdmin || !options?.memberRole || c.memberRole === options.memberRole);

    // Non-blocking periodic market average recalculation (runs at most once every 6 hours)
    if (Date.now() - lastAutoPriceAvgAt > AUTO_PRICE_AVG_INTERVAL_MS) {
      lastAutoPriceAvgAt = Date.now();
      recalculatePeriodicMarketAverages(db).catch(() => {});
    }

    // Compute reserved sequences from live Supabase rows + local reserved list
    const reservedMasterSeqs: Record<string, number> = { ...localState.reservedMasterSeqs };
    for (const m of masters) {
      reservedMasterSeqs[m.prefix] = Math.max(Number(reservedMasterSeqs[m.prefix] || 0), Number(m.seqNum || 0));
    }

    return {
      categories: UNIFIED_CATEGORIES,
      unitChains: UNIT_CHAINS,
      fixedConversions: FIXED_UNIT_CONVERSIONS,
      brands,
      masters,
      specs,
      aliases,
      notifications: options?.isSuperAdmin ? notifications : [],
      memberCustomizations,
      reservedMasterSeqs,
      storageSource: 'supabase' as const,
    };
  } catch (err) {
    console.warn('[UnifiedMaterials] Supabase load fallback:', err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Authoritative Single-Record Sync Helpers
// ---------------------------------------------------------------------------
async function trySyncMasterToSupabase(
  db: SupabaseClient | null | undefined,
  master: UnifiedMaterialMaster
): Promise<boolean> {
  if (!db) return false;
  try {
    // Try syncing with native pricing columns first (if SQL migration 20261120_01 was applied)
    const { error } = await db
      .from('unified_materials_master')
      .upsert(masterToRow(master, true), { onConflict: 'code' });
    if (!error) return true;
    // Fallback cleanly to base columns if pricing columns haven't been added yet
    if (error.code === 'PGRST204' || /market_base_price|brand_prices|column/i.test(error.message)) {
      const { error: baseErr } = await db
        .from('unified_materials_master')
        .upsert(masterToRow(master, false), { onConflict: 'code' });
      if (!baseErr) return true;
      if (baseErr.code !== 'PGRST205') console.warn('[UnifiedMaterials] Master sync error:', baseErr.message);
      return false;
    }
    if (error.code !== 'PGRST205') console.warn('[UnifiedMaterials] Master sync error:', error.message);
    return false;
  } catch {
    return false;
  }
}

async function trySyncSpecToSupabase(
  db: SupabaseClient | null | undefined,
  spec: UnifiedMaterialSpec
): Promise<boolean> {
  if (!db) return false;
  try {
    const { error } = await db
      .from('unified_material_specs')
      .upsert(specToRow(spec), { onConflict: 'spec_code' });
    if (error) {
      if (error.code !== 'PGRST205') console.warn('[UnifiedMaterials] Spec sync error:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function trySyncAliasToSupabase(
  db: SupabaseClient | null | undefined,
  alias: UnifiedMaterialAlias
): Promise<boolean> {
  if (!db) return false;
  try {
    const { error } = await db
      .from('unified_material_aliases')
      .upsert(aliasToRow(alias), { onConflict: 'alias_code' });
    if (error) {
      if (error.code !== 'PGRST205') console.warn('[UnifiedMaterials] Alias sync error:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function trySyncNotificationToSupabase(
  db: SupabaseClient | null | undefined,
  notif: UnifiedMaterialNotification
): Promise<boolean> {
  if (!db) return false;
  try {
    const { error } = await db
      .from('unified_material_notifications')
      .upsert(notifToRow(notif), { onConflict: 'id' });
    if (error) {
      if (error.code !== 'PGRST205') console.warn('[UnifiedMaterials] Notification sync error:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function trySyncMemberCustomizationToSupabase(
  db: SupabaseClient | null | undefined,
  custom: MemberMaterialCustomization
): Promise<boolean> {
  if (!db) return false;
  try {
    const { error } = await db
      .from('member_material_customizations')
      .upsert(customToRow(custom), { onConflict: 'member_role,member_id,master_code,spec_code' });
    if (error) {
      if (error.code !== 'PGRST205') console.warn('[UnifiedMaterials] Member custom sync error:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function upsertGlobalPricingRecord(
  db: SupabaseClient | null | undefined,
  state: UnifiedMaterialsPersistedState,
  masterCode: string,
  patch: {
    marketBasePrice?: number;
    brandPrices?: Record<string, number>;
    replaceBrandPrices?: boolean;
    priceSource: 'seeded_market' | 'super_admin' | 'auto_average';
    observationsCount?: number;
    priceLastUpdatedAt?: string;
  }
): Promise<MemberMaterialCustomization> {
  const upperCode = masterCode.toUpperCase();
  const nowIso = patch.priceLastUpdatedAt || new Date().toISOString();
  const idx = state.memberCustomizations.findIndex(
    (c) =>
      c.memberId === GLOBAL_PRICING_MEMBER_ID &&
      c.masterCode === upperCode &&
      c.specCode === GLOBAL_PRICE_SPEC_CODE
  );
  const existingOv = idx >= 0 ? ((state.memberCustomizations[idx].bridgeOverrides || {}) as Record<string, any>) : {};
  const nextBrandPrices = patch.replaceBrandPrices
    ? sanitizeBrandPricesMap(patch.brandPrices)
    : {
        ...sanitizeBrandPricesMap(existingOv.brandPrices),
        ...sanitizeBrandPricesMap(patch.brandPrices),
      };
  const nextMarketBasePrice =
    sanitizePositivePrice(patch.marketBasePrice) ?? sanitizePositivePrice(existingOv.marketBasePrice);

  const nextRec: MemberMaterialCustomization = {
    memberRole: 'artisan',
    memberId: GLOBAL_PRICING_MEMBER_ID,
    masterCode: upperCode,
    specCode: GLOBAL_PRICE_SPEC_CODE,
    isHidden: false,
    hideReason: '',
    bridgeOverrides: {
      ...existingOv,
      ...(nextMarketBasePrice !== undefined ? { marketBasePrice: nextMarketBasePrice } : {}),
      brandPrices: nextBrandPrices,
      priceSource: patch.priceSource,
      priceLastUpdatedAt: nowIso,
      observationsCount:
        patch.observationsCount !== undefined
          ? patch.observationsCount
          : Number(existingOv.observationsCount || 0),
    },
    updatedAt: nowIso,
  };

  if (idx >= 0) state.memberCustomizations[idx] = nextRec;
  else state.memberCustomizations.unshift(nextRec);

  await trySyncMemberCustomizationToSupabase(db, nextRec);
  return nextRec;
}

async function upsertMemberPriceObservation(
  db: SupabaseClient | null | undefined,
  state: UnifiedMaterialsPersistedState,
  input: {
    memberRole: 'artisan' | 'supplier';
    memberId: string;
    actorName: string;
    masterCode: string;
    personalBasePrice?: number;
    personalBrandPrices?: Record<string, number>;
  }
): Promise<MemberMaterialCustomization> {
  const upperCode = input.masterCode.toUpperCase();
  const nowIso = new Date().toISOString();
  const idx = state.memberCustomizations.findIndex(
    (c) =>
      c.memberRole === input.memberRole &&
      c.memberId === input.memberId &&
      c.masterCode === upperCode &&
      c.specCode === MEMBER_PRICE_OBS_SPEC_CODE
  );
  const prevOv = idx >= 0 ? ((state.memberCustomizations[idx].bridgeOverrides || {}) as Record<string, any>) : {};
  const mergedBrands = {
    ...sanitizeBrandPricesMap(prevOv.personalBrandPrices),
    ...sanitizeBrandPricesMap(input.personalBrandPrices),
  };
  const nextBase =
    sanitizePositivePrice(input.personalBasePrice) ?? sanitizePositivePrice(prevOv.personalBasePrice);

  const nextRec: MemberMaterialCustomization = {
    memberRole: input.memberRole,
    memberId: input.memberId,
    masterCode: upperCode,
    specCode: MEMBER_PRICE_OBS_SPEC_CODE,
    isHidden: false,
    hideReason: '',
    bridgeOverrides: {
      ...prevOv,
      ...(nextBase !== undefined ? { personalBasePrice: nextBase } : {}),
      personalBrandPrices: mergedBrands,
      actorName: input.actorName,
      updatedAt: nowIso,
    },
    updatedAt: nowIso,
  };

  if (idx >= 0) state.memberCustomizations[idx] = nextRec;
  else state.memberCustomizations.unshift(nextRec);

  await trySyncMemberCustomizationToSupabase(db, nextRec);
  return nextRec;
}

// ---------------------------------------------------------------------------
// Mutations (Write to Supabase + Local Cache Mirror)
// ---------------------------------------------------------------------------
export async function createUnifiedMasterItem(
  db: SupabaseClient | null | undefined,
  input: {
    prefix: UnifiedCategoryPrefix;
    canonicalName: string;
    unitChain?: any;
    bridgeFields?: any[];
    specFields?: string[];
    artistAliases?: string[];
    supplierAliases?: string[];
    defaultBrands?: string[];
    availableThicknessesMm?: number[];
    optionalSupplierName?: string;
    workshopTags?: string[];
    safetyNote?: string;
    initialSpecLabel?: string;
    initialSpecThicknessMm?: number;
    initialSpecOrigin?: string;
    initialBridgeValues?: Record<string, any>;
    actorRole: 'super_admin' | 'artisan' | 'supplier';
    actorId: string;
    actorName: string;
  }
) {
  const state = loadUnifiedMaterialsState();
  const merged = await loadUnifiedMaterialsSnapshotFromSupabase(db, { isSuperAdmin: true });
  const cleanName = input.canonicalName.trim();
  const normKey = (s: string) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ');

  // Prevent duplicate master creation within the same category
  const existingDuplicate = merged.masters.find(
    (m) => m.status === 'active' && m.prefix === input.prefix && normKey(m.canonicalName) === normKey(cleanName)
  );
  if (existingDuplicate) {
    return {
      master: existingDuplicate,
      spec: merged.specs.find((s) => s.masterCode === existingDuplicate.code) || null,
      notification: null,
      supabaseSynced: true,
      alreadyExisted: true,
    };
  }

  const { code, seqNum } = generateNextMasterCode(input.prefix, merged.masters, merged.reservedMasterSeqs);
  const catDef = UNIFIED_CATEGORIES.find((c) => c.prefix === input.prefix);
  const nowIso = new Date().toISOString();

  const cleanedThicknesses = Array.isArray(input.availableThicknessesMm)
    ? Array.from(
        new Set(
          input.availableThicknessesMm
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0 && n <= 100)
        )
      ).sort((a, b) => a - b)
    : [];

  const cleanedBrands = Array.isArray(input.defaultBrands)
    ? Array.from(new Set(input.defaultBrands.map((b) => String(b || '').trim()).filter(Boolean)))
    : [];

  const master: UnifiedMaterialMaster = {
    code,
    prefix: input.prefix,
    seqNum,
    canonicalName: cleanName,
    unitChain: input.unitChain || catDef?.defaultUnitChain || 'ل1',
    bridgeFields: Array.isArray(input.bridgeFields) ? input.bridgeFields : [],
    specFields: Array.isArray(input.specFields) ? input.specFields : [],
    artistAliases: Array.isArray(input.artistAliases) ? input.artistAliases.filter(Boolean) : [],
    supplierAliases: Array.isArray(input.supplierAliases) ? input.supplierAliases.filter(Boolean) : [],
    defaultBrands: cleanedBrands,
    availableThicknessesMm: cleanedThicknesses.length > 0 ? cleanedThicknesses : undefined,
    workshopTags: Array.isArray(input.workshopTags) ? input.workshopTags.filter(Boolean) : [],
    safetyNote: input.safetyNote || '',
    status: 'active',
    reviewStatus: input.actorRole === 'super_admin' ? 'approved' : 'new',
    createdByRole: input.actorRole,
    createdById: input.actorId,
    createdByName: input.actorName,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  state.customMasters.unshift(master);
  state.reservedMasterSeqs[input.prefix] = Math.max(
    Number(state.reservedMasterSeqs[input.prefix] || 0),
    seqNum
  );

  // Auto-register any new brand names in unified_material_brands
  const newCreatedBrands: UnifiedBrandRecord[] = [];
  const allBrands = [...merged.brands];
  for (const bName of cleanedBrands) {
    const exists = allBrands.some((b) => normKey(b.brandName) === normKey(bName));
    if (!exists) {
      const brandCode = generateNextBrandCode(allBrands);
      const brandRec: UnifiedBrandRecord = {
        brandCode,
        brandName: bName,
        categoryHint: input.prefix,
        status: 'active',
      };
      allBrands.push(brandRec);
      state.customBrands.push(brandRec);
      newCreatedBrands.push(brandRec);
    }
  }

  // Create specs: either all thicknesses provided OR initialSpecLabel
  let createdSpec: UnifiedMaterialSpec | null = null;
  const createdSpecs: UnifiedMaterialSpec[] = [];
  const runningSpecs = [...merged.specs];

  if (cleanedThicknesses.length > 0) {
    for (const th of cleanedThicknesses) {
      const { specCode, specIndex } = generateNextSpecCode(code, runningSpecs);
      const sp: UnifiedMaterialSpec = {
        specCode,
        masterCode: code,
        specIndex,
        label: `${cleanName} ${th} مم`,
        thicknessMm: th,
        origin: input.initialSpecOrigin?.trim() || undefined,
        bridgeValues: input.initialBridgeValues || {},
        status: 'active',
        reviewStatus: input.actorRole === 'super_admin' ? 'approved' : 'new',
        createdByRole: input.actorRole,
        createdById: input.actorId,
        createdByName: input.actorName,
        createdAt: nowIso,
      };
      runningSpecs.push(sp);
      state.customSpecs.unshift(sp);
      createdSpecs.push(sp);
    }
    createdSpec = createdSpecs[0] || null;
  } else if (input.initialSpecLabel?.trim()) {
    const { specCode, specIndex } = generateNextSpecCode(code, runningSpecs);
    createdSpec = {
      specCode,
      masterCode: code,
      specIndex,
      label: input.initialSpecLabel.trim(),
      thicknessMm: input.initialSpecThicknessMm,
      origin: input.initialSpecOrigin?.trim() || undefined,
      bridgeValues: input.initialBridgeValues || {},
      status: 'active',
      reviewStatus: input.actorRole === 'super_admin' ? 'approved' : 'new',
      createdByRole: input.actorRole,
      createdById: input.actorId,
      createdByName: input.actorName,
      createdAt: nowIso,
    };
    state.customSpecs.unshift(createdSpec);
    createdSpecs.push(createdSpec);
  }

  let notif: UnifiedMaterialNotification | null = null;
  if (input.actorRole !== 'super_admin') {
    const extras: string[] = [];
    if (cleanedThicknesses.length > 0) extras.push(`السماكات: ${cleanedThicknesses.join('، ')} مم`);
    if (cleanedBrands.length > 0) extras.push(`الماركات: ${cleanedBrands.join('، ')}`);
    if (input.optionalSupplierName?.trim()) extras.push(`المورد المقترح: ${input.optionalSupplierName.trim()}`);
    notif = {
      id: crypto.randomUUID(),
      eventType: 'new_master',
      targetCode: code,
      targetName: master.canonicalName,
      actorRole: input.actorRole,
      actorId: input.actorId,
      actorName: input.actorName,
      reason: `إضافة صنف خامة جديد من ${input.actorRole === 'supplier' ? 'مورد' : 'فنان'} ومزامنته فوراً${
        extras.length ? ` (${extras.join(' | ')})` : ''
      }`,
      payload: {
        master,
        initialSpec: createdSpec,
        specs: createdSpecs,
        brands: cleanedBrands,
        optionalSupplierName: input.optionalSupplierName?.trim() || undefined,
      },
      status: 'pending',
      createdAt: nowIso,
    };
    state.notifications.unshift(notif);
  }

  saveUnifiedMaterialsState(state);
  const supabaseSynced = await trySyncMasterToSupabase(db, master);
  for (const sp of createdSpecs) {
    await trySyncSpecToSupabase(db, sp);
  }
  if (db && newCreatedBrands.length > 0) {
    for (const br of newCreatedBrands) {
      try {
        await db.from('unified_material_brands').upsert(brandToRow(br), { onConflict: 'brand_code' });
      } catch {}
    }
  }
  if (notif) await trySyncNotificationToSupabase(db, notif);

  return { master, spec: createdSpec, specs: createdSpecs, notification: notif, supabaseSynced, alreadyExisted: false };
}

export async function createUnifiedSpecItem(
  db: SupabaseClient | null | undefined,
  input: {
    masterCode: string;
    label: string;
    thicknessMm?: number;
    plies?: number;
    sizeLabel?: string;
    color?: string;
    origin?: string;
    bridgeValues?: Record<string, any>;
    actorRole: 'super_admin' | 'artisan' | 'supplier';
    actorId: string;
    actorName: string;
  }
) {
  const state = loadUnifiedMaterialsState();
  const merged = await loadUnifiedMaterialsSnapshotFromSupabase(db, { isSuperAdmin: true });
  const master = merged.masters.find((m) => m.code === input.masterCode.toUpperCase());
  if (!master) throw new Error('كود الصنف الأم غير موجود');

  const { specCode, specIndex } = generateNextSpecCode(master.code, merged.specs);
  const nowIso = new Date().toISOString();
  const spec: UnifiedMaterialSpec = {
    specCode,
    masterCode: master.code,
    specIndex,
    label: input.label.trim(),
    thicknessMm: input.thicknessMm,
    plies: input.plies,
    sizeLabel: input.sizeLabel?.trim() || undefined,
    color: input.color?.trim() || undefined,
    origin: input.origin?.trim() || undefined,
    bridgeValues: input.bridgeValues || {},
    status: 'active',
    reviewStatus: input.actorRole === 'super_admin' ? 'approved' : 'new',
    createdByRole: input.actorRole,
    createdById: input.actorId,
    createdByName: input.actorName,
    createdAt: nowIso,
  };
  state.customSpecs.unshift(spec);

  let notif: UnifiedMaterialNotification | null = null;
  if (input.actorRole !== 'super_admin') {
    notif = {
      id: crypto.randomUUID(),
      eventType: 'new_spec',
      targetCode: specCode,
      targetName: `${master.canonicalName} — ${spec.label}`,
      actorRole: input.actorRole,
      actorId: input.actorId,
      actorName: input.actorName,
      reason: 'إضافة مواصفة جديدة للصنف الأم',
      payload: { spec },
      status: 'pending',
      createdAt: nowIso,
    };
    state.notifications.unshift(notif);
  }

  saveUnifiedMaterialsState(state);
  const supabaseSynced = await trySyncSpecToSupabase(db, spec);
  if (notif) await trySyncNotificationToSupabase(db, notif);
  return { spec, notification: notif, supabaseSynced };
}

export async function createUnifiedAliasItem(
  db: SupabaseClient | null | undefined,
  input: {
    targetCode: string;
    aliasName: string;
    aliasType: 'artisan' | 'supplier' | 'common';
    contextHint?: string;
    isAmbiguous?: boolean;
    actorRole: 'super_admin' | 'artisan' | 'supplier';
    actorId: string;
    actorName: string;
  }
) {
  const state = loadUnifiedMaterialsState();
  const merged = await loadUnifiedMaterialsSnapshotFromSupabase(db, { isSuperAdmin: true });
  const aliasCode = generateNextAliasCode(merged.aliases);
  const nowIso = new Date().toISOString();
  const alias: UnifiedMaterialAlias = {
    aliasCode,
    targetCode: input.targetCode.toUpperCase(),
    aliasName: input.aliasName.trim(),
    aliasType: input.aliasType,
    contextHint: input.contextHint?.trim() || undefined,
    isAmbiguous: Boolean(input.isAmbiguous),
    createdByRole: input.actorRole,
    createdById: input.actorId,
  };
  state.customAliases.unshift(alias);

  let notif: UnifiedMaterialNotification | null = null;
  if (input.actorRole !== 'super_admin') {
    notif = {
      id: crypto.randomUUID(),
      eventType: 'new_alias',
      targetCode: alias.targetCode,
      targetName: alias.aliasName,
      actorRole: input.actorRole,
      actorId: input.actorId,
      actorName: input.actorName,
      reason: `إضافة اسم دارج مرتبط (${aliasCode})`,
      payload: { alias },
      status: 'pending',
      createdAt: nowIso,
    };
    state.notifications.unshift(notif);
  }

  saveUnifiedMaterialsState(state);
  const supabaseSynced = await trySyncAliasToSupabase(db, alias);
  if (notif) await trySyncNotificationToSupabase(db, notif);
  return { alias, notification: notif, supabaseSynced };
}

export async function createUnifiedBrandItem(
  db: SupabaseClient | null | undefined,
  input: { brandName: string; categoryHint?: string }
) {
  const state = loadUnifiedMaterialsState();
  const merged = await loadUnifiedMaterialsSnapshotFromSupabase(db, { isSuperAdmin: true });
  const brandCode = generateNextBrandCode(merged.brands);
  const brand: UnifiedBrandRecord = {
    brandCode,
    brandName: input.brandName.trim(),
    categoryHint: input.categoryHint?.trim() || 'عام',
    status: 'active',
  };
  state.customBrands.push(brand);
  saveUnifiedMaterialsState(state);
  if (db) {
    try {
      await db.from('unified_material_brands').upsert(brandToRow(brand), { onConflict: 'brand_code' });
    } catch {}
  }
  return brand;
}

export async function updateOrProposeUnifiedMaster(
  db: SupabaseClient | null | undefined,
  code: string,
  input: {
    action: 'update' | 'archive' | 'restore' | 'delete_unused' | 'approve' | 'remove_local';
    canonicalName?: string;
    unitChain?: any;
    bridgeFields?: any[];
    artistAliases?: string[];
    supplierAliases?: string[];
    workshopTags?: string[];
    safetyNote?: string;
    marketBasePrice?: number;
    brandPrices?: Record<string, number>;
    reason?: string;
    actorRole: 'super_admin' | 'artisan' | 'supplier';
    actorId: string;
    actorName: string;
  }
) {
  const upperCode = code.toUpperCase();
  const state = loadUnifiedMaterialsState();
  const merged = await loadUnifiedMaterialsSnapshotFromSupabase(db, { isSuperAdmin: true });
  const existing = merged.masters.find((m) => m.code === upperCode);
  if (!existing) throw new Error('الصنف المطلوب غير موجود');
  const nowIso = new Date().toISOString();

  // Removing a material from an artist's/supplier's personal list ("خاماتي") MUST NEVER
  // remove, archive, or hide the item from the Unified Materials System for anyone.
  if (input.action === 'remove_local') {
    return { scope: 'member_only', master: existing, supabaseSynced: true };
  }

  // Strictly forbid non-super-admin from archiving or deleting global unified materials
  if (input.actorRole !== 'super_admin' && (input.action === 'archive' || input.action === 'delete_unused')) {
    throw new Error('حذف أو أرشفة الخامات من المنظومة الموحدة مخصص للسوبر أدمن فقط');
  }

  // Super Admin direct global control
  if (input.actorRole === 'super_admin') {
    const patch: Partial<UnifiedMaterialMaster> = {
      ...(state.masterPatches[upperCode] || {}),
      updatedAt: nowIso,
    };
    let pricingChanged = false;
    const cleanMarketBase = sanitizePositivePrice(input.marketBasePrice);
    const hasBrandPrices = input.brandPrices !== undefined && typeof input.brandPrices === 'object';
    const cleanBrandPrices = hasBrandPrices ? sanitizeBrandPricesMap(input.brandPrices) : undefined;

    if (input.action === 'approve') {
      patch.reviewStatus = 'approved';
    } else if (input.action === 'archive') {
      patch.status = 'archived';
      patch.archiveReason = input.reason || 'مؤرشف من قِبل السوبر أدمن (مستخدم سابقاً أو خارج التداول)';
    } else if (input.action === 'restore') {
      patch.status = 'active';
      patch.archiveReason = '';
    } else if (input.action === 'delete_unused') {
      state.reservedMasterSeqs[existing.prefix] = Math.max(
        Number(state.reservedMasterSeqs[existing.prefix] || 0),
        existing.seqNum
      );
      patch.status = 'reserved_deleted';
      patch.archiveReason = input.reason || 'محذوف (غير مستخدم — الكود محجوز نهائياً ولا يُعاد استخدامه)';
    } else if (input.action === 'update') {
      if (input.canonicalName !== undefined) patch.canonicalName = input.canonicalName.trim();
      if (input.unitChain !== undefined) patch.unitChain = input.unitChain;
      if (input.bridgeFields !== undefined) patch.bridgeFields = input.bridgeFields;
      if (input.artistAliases !== undefined) patch.artistAliases = input.artistAliases;
      if (input.supplierAliases !== undefined) patch.supplierAliases = input.supplierAliases;
      if (input.workshopTags !== undefined) patch.workshopTags = input.workshopTags;
      if (input.safetyNote !== undefined) patch.safetyNote = input.safetyNote;
      if (cleanMarketBase !== undefined) {
        patch.marketBasePrice = cleanMarketBase;
        patch.priceSource = 'super_admin';
        patch.priceLastUpdatedAt = nowIso;
        pricingChanged = true;
      }
      if (hasBrandPrices && cleanBrandPrices) {
        patch.brandPrices = cleanBrandPrices;
        patch.priceSource = 'super_admin';
        patch.priceLastUpdatedAt = nowIso;
        pricingChanged = true;
      }
      patch.reviewStatus = 'approved';
    }
    state.masterPatches[upperCode] = patch;
    const updatedMaster = { ...existing, ...patch };
    if (pricingChanged) {
      await upsertGlobalPricingRecord(db, state, upperCode, {
        marketBasePrice: cleanMarketBase ?? existing.marketBasePrice,
        brandPrices: cleanBrandPrices ?? existing.brandPrices,
        replaceBrandPrices: hasBrandPrices,
        priceSource: 'super_admin',
        priceLastUpdatedAt: nowIso,
      });
    }
    saveUnifiedMaterialsState(state);
    const supabaseSynced = await trySyncMasterToSupabase(db, updatedMaster);
    return { scope: 'global', master: updatedMaster, supabaseSynced };
  }

  // Artisan or Supplier: local rename customization + Super Admin review notification (NEVER hides material)
  const idx = state.memberCustomizations.findIndex(
    (c) => c.memberRole === input.actorRole && c.memberId === input.actorId && c.masterCode === upperCode && !c.specCode
  );
  const prevCustom = idx >= 0 ? state.memberCustomizations[idx] : {
    memberRole: input.actorRole,
    memberId: input.actorId,
    masterCode: upperCode,
    specCode: '',
  };

  const nextCustom: MemberMaterialCustomization = {
    ...prevCustom,
    isHidden: false,
    hideReason: '',
    customName: input.canonicalName?.trim() || prevCustom.customName,
    updatedAt: nowIso,
  };
  if (idx >= 0) state.memberCustomizations[idx] = nextCustom;
  else state.memberCustomizations.unshift(nextCustom);

  const notif: UnifiedMaterialNotification = {
    id: crypto.randomUUID(),
    eventType: 'member_edit_proposal',
    targetCode: upperCode,
    targetName: existing.canonicalName,
    actorRole: input.actorRole,
    actorId: input.actorId,
    actorName: input.actorName,
    reason:
      input.reason ||
      `اقترح العضو تعديل الاسم إلى "${input.canonicalName || existing.canonicalName}"`,
    payload: {
      proposedName: input.canonicalName?.trim(),
      action: input.action,
    },
    status: 'pending',
    createdAt: nowIso,
  };
  state.notifications.unshift(notif);
  saveUnifiedMaterialsState(state);
  const supabaseSynced = await trySyncMemberCustomizationToSupabase(db, nextCustom);
  await trySyncNotificationToSupabase(db, notif);

  return { scope: 'member_only', customization: nextCustom, notification: notif, supabaseSynced };
}

/**
 * Direct Contribution to an Existing Unified Material Master:
 * Artisans & Suppliers can directly add new aliases, new thicknesses/specs, new brands,
 * and smart unit conversion equations to the global Unified Materials database,
 * accompanied by an optional advisory suggestion note sent ONLY to the Super Admin.
 */
export async function contributeToUnifiedMaster(
  db: SupabaseClient | null | undefined,
  code: string,
  input: {
    newAliases?: string[];
    newThicknessesMm?: number[];
    newSpecLabels?: string[];
    newBrands?: string[];
    newUnitEquations?: Array<{
      formulaAr: string;
      topUnit: string;
      baseUnitAr: string;
      totalInBaseUnit: number;
    }>;
    /** Member's own personal base price (recorded as observation; NEVER overwrites global baseline directly) */
    personalBasePrice?: number;
    /** Member's own personal brand prices (recorded as observations; NEVER overwrite global brand prices directly) */
    personalBrandPrices?: Record<string, number>;
    suggestionNote?: string;
    actorRole: 'super_admin' | 'artisan' | 'supplier';
    actorId: string;
    actorName: string;
  }
) {
  const upperCode = code.toUpperCase();
  const state = loadUnifiedMaterialsState();
  const merged = await loadUnifiedMaterialsSnapshotFromSupabase(db, { isSuperAdmin: true });
  const existing = merged.masters.find((m) => m.code === upperCode);
  if (!existing) throw new Error('الصنف المطلوب غير موجود في منظومة الخامات');

  const nowIso = new Date().toISOString();
  const norm = (s: string) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ');

  const nextMaster: UnifiedMaterialMaster = {
    ...existing,
    artistAliases: [...(existing.artistAliases || [])],
    supplierAliases: [...(existing.supplierAliases || [])],
    defaultBrands: [...(existing.defaultBrands || [])],
    availableThicknessesMm: Array.isArray(existing.availableThicknessesMm)
      ? [...existing.availableThicknessesMm]
      : undefined,
    updatedAt: nowIso,
  };

  const addedAliases: string[] = [];
  const createdAliasRows: UnifiedMaterialAlias[] = [];
  const runningAliases = [...merged.aliases];
  const existingAliasNorms = new Set(
    [
      existing.canonicalName,
      ...nextMaster.artistAliases,
      ...nextMaster.supplierAliases,
      ...merged.aliases.filter((a) => a.targetCode === upperCode).map((a) => a.aliasName),
    ].map(norm)
  );

  for (const rawAl of input.newAliases || []) {
    const clean = String(rawAl || '').trim();
    if (!clean || existingAliasNorms.has(norm(clean))) continue;
    existingAliasNorms.add(norm(clean));
    if (input.actorRole === 'supplier') {
      nextMaster.supplierAliases.push(clean);
    } else {
      nextMaster.artistAliases.push(clean);
    }
    const aliasCode = generateNextAliasCode(runningAliases);
    const aliasRec: UnifiedMaterialAlias = {
      aliasCode,
      targetCode: upperCode,
      aliasName: clean,
      aliasType: input.actorRole === 'supplier' ? 'supplier' : 'artisan',
      createdByRole: input.actorRole,
      createdById: input.actorId,
    };
    runningAliases.push(aliasRec);
    state.customAliases.unshift(aliasRec);
    createdAliasRows.push(aliasRec);
    addedAliases.push(clean);
  }

  const addedThicknessesMm: number[] = [];
  const addedSpecs: UnifiedMaterialSpec[] = [];
  const runningSpecs = [...merged.specs];
  const existingThicknessSet = new Set<number>(
    [
      ...(existing.availableThicknessesMm || []),
      ...merged.specs
        .filter((s) => s.masterCode === upperCode && typeof s.thicknessMm === 'number')
        .map((s) => Number(s.thicknessMm)),
    ].filter((n) => Number.isFinite(n) && n > 0)
  );

  for (const rawTh of input.newThicknessesMm || []) {
    const th = Number(rawTh);
    if (!Number.isFinite(th) || th <= 0 || th > 200 || existingThicknessSet.has(th)) continue;
    existingThicknessSet.add(th);
    addedThicknessesMm.push(th);
    const { specCode, specIndex } = generateNextSpecCode(upperCode, runningSpecs);
    const sp: UnifiedMaterialSpec = {
      specCode,
      masterCode: upperCode,
      specIndex,
      label: `${existing.canonicalName} ${th} مم`,
      thicknessMm: th,
      bridgeValues: {},
      status: 'active',
      reviewStatus: input.actorRole === 'super_admin' ? 'approved' : 'new',
      createdByRole: input.actorRole,
      createdById: input.actorId,
      createdByName: input.actorName,
      createdAt: nowIso,
    };
    runningSpecs.push(sp);
    state.customSpecs.unshift(sp);
    addedSpecs.push(sp);
  }
  if (addedThicknessesMm.length > 0) {
    nextMaster.availableThicknessesMm = Array.from(existingThicknessSet).sort((a, b) => a - b);
  }

  const existingSpecLabelNorms = new Set(
    merged.specs.filter((s) => s.masterCode === upperCode).map((s) => norm(s.label))
  );
  for (const rawLbl of input.newSpecLabels || []) {
    const clean = String(rawLbl || '').trim();
    if (!clean || existingSpecLabelNorms.has(norm(clean))) continue;
    existingSpecLabelNorms.add(norm(clean));
    const { specCode, specIndex } = generateNextSpecCode(upperCode, runningSpecs);
    const sp: UnifiedMaterialSpec = {
      specCode,
      masterCode: upperCode,
      specIndex,
      label: clean,
      bridgeValues: {},
      status: 'active',
      reviewStatus: input.actorRole === 'super_admin' ? 'approved' : 'new',
      createdByRole: input.actorRole,
      createdById: input.actorId,
      createdByName: input.actorName,
      createdAt: nowIso,
    };
    runningSpecs.push(sp);
    state.customSpecs.unshift(sp);
    addedSpecs.push(sp);
  }

  const addedBrands: UnifiedBrandRecord[] = [];
  const addedBrandNames: string[] = [];
  const allBrands = [...merged.brands];
  const existingMasterBrandNorms = new Set(nextMaster.defaultBrands.map(norm));
  for (const rawBrand of input.newBrands || []) {
    const clean = String(rawBrand || '').trim();
    if (!clean) continue;
    if (!existingMasterBrandNorms.has(norm(clean))) {
      existingMasterBrandNorms.add(norm(clean));
      nextMaster.defaultBrands.push(clean);
      addedBrandNames.push(clean);
    }
    const existsGlobal = allBrands.some((b) => norm(b.brandName) === norm(clean));
    if (!existsGlobal) {
      const brandCode = generateNextBrandCode(allBrands);
      const brandRec: UnifiedBrandRecord = {
        brandCode,
        brandName: clean,
        categoryHint: existing.prefix,
        status: 'active',
      };
      allBrands.push(brandRec);
      state.customBrands.push(brandRec);
      addedBrands.push(brandRec);
    }
  }

  const addedUnitEquations: string[] = [];
  const existingNoteParts = String(nextMaster.unitNote || '')
    .split(/\s*\|\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const existingNoteNorms = new Set(existingNoteParts.map(norm));

  for (const eq of input.newUnitEquations || []) {
    const formula = String(eq?.formulaAr || '').trim();
    if (!formula || existingNoteNorms.has(norm(formula))) continue;
    existingNoteNorms.add(norm(formula));
    existingNoteParts.push(formula);
    addedUnitEquations.push(formula);
  }
  if (addedUnitEquations.length > 0) {
    nextMaster.unitNote = existingNoteParts.join(' | ');
  }

  const cleanSuggestionNote = String(input.suggestionNote || '').trim();
  const hasDbChanges =
    addedAliases.length > 0 ||
    addedThicknessesMm.length > 0 ||
    addedSpecs.length > 0 ||
    addedBrands.length > 0 ||
    addedBrandNames.length > 0 ||
    addedUnitEquations.length > 0;

  let supabaseSynced = true;
  if (hasDbChanges) {
    state.masterPatches[upperCode] = {
      ...(state.masterPatches[upperCode] || {}),
      artistAliases: nextMaster.artistAliases,
      supplierAliases: nextMaster.supplierAliases,
      defaultBrands: nextMaster.defaultBrands,
      availableThicknessesMm: nextMaster.availableThicknessesMm,
      unitNote: nextMaster.unitNote,
      updatedAt: nowIso,
    };
    supabaseSynced = await trySyncMasterToSupabase(db, nextMaster);
    for (const sp of addedSpecs) {
      await trySyncSpecToSupabase(db, sp);
    }
    for (const al of createdAliasRows) {
      await trySyncAliasToSupabase(db, al);
    }
    if (db && addedBrands.length > 0) {
      for (const br of addedBrands) {
        try {
          await db.from('unified_material_brands').upsert(brandToRow(br), { onConflict: 'brand_code' });
        } catch {}
      }
    }
  }

  // Record individual member price observations cleanly isolated from global baseline pricing.
  // A single artisan/supplier price edit NEVER overwrites global baseline prices!
  const submittedBasePrice = sanitizePositivePrice(input.personalBasePrice);
  const submittedBrandPrices = sanitizeBrandPricesMap(input.personalBrandPrices);
  const hasPriceObservation =
    submittedBasePrice !== undefined || Object.keys(submittedBrandPrices).length > 0;

  if (hasPriceObservation) {
    await upsertMemberPriceObservation(db, state, {
      memberRole: input.actorRole === 'supplier' ? 'supplier' : 'artisan',
      memberId: input.actorId,
      actorName: input.actorName,
      masterCode: upperCode,
      personalBasePrice: submittedBasePrice,
      personalBrandPrices: submittedBrandPrices,
    });
  }

  // Send a clear structured notification to Super Admin (suggestionNote is strictly advisory, NEVER stored on master DB!)
  let notif: UnifiedMaterialNotification | null = null;
  if (hasDbChanges || cleanSuggestionNote || hasPriceObservation) {
    const summaryParts: string[] = [];
    if (addedAliases.length > 0) summaryParts.push(`مسميات جديدة: ${addedAliases.join('، ')}`);
    if (addedThicknessesMm.length > 0) summaryParts.push(`سماكات جديدة: ${addedThicknessesMm.map((t) => `${t} مم`).join('، ')}`);
    const customSpecLabels = addedSpecs.filter((s) => !s.thicknessMm).map((s) => s.label);
    if (customSpecLabels.length > 0) summaryParts.push(`مواصفات جديدة: ${customSpecLabels.join('، ')}`);
    if (addedBrandNames.length > 0) summaryParts.push(`ماركات جديدة: ${addedBrandNames.join('، ')}`);
    if (addedUnitEquations.length > 0) summaryParts.push(`معادلات قياس جديدة: ${addedUnitEquations.join(' | ')}`);
    if (submittedBasePrice !== undefined) summaryParts.push(`رصد سعر مبدئي: ${submittedBasePrice} ج.م`);
    if (Object.keys(submittedBrandPrices).length > 0) {
      const bpSummary = Object.entries(submittedBrandPrices)
        .map(([k, v]) => `${k}: ${v} ج.م`)
        .join('، ');
      summaryParts.push(`أسعار ماركات مرصودة: ${bpSummary}`);
    }

    notif = {
      id: crypto.randomUUID(),
      eventType: 'member_edit_proposal',
      targetCode: upperCode,
      targetName: existing.canonicalName,
      actorRole: input.actorRole,
      actorId: input.actorId,
      actorName: input.actorName,
      reason: summaryParts.length > 0 ? summaryParts.join(' · ') : 'رسالة مقترح من العضو حول الصنف',
      payload: {
        kind: 'direct_contribution',
        addedAliases,
        addedThicknessesMm,
        addedSpecLabels: customSpecLabels,
        addedBrands: addedBrandNames,
        addedUnitEquations,
        submittedBasePrice,
        submittedBrandPrices: Object.keys(submittedBrandPrices).length > 0 ? submittedBrandPrices : undefined,
        // Advisory message ONLY for Super Admin — never written into material DB fields
        suggestionNote: cleanSuggestionNote || undefined,
      },
      status: 'pending',
      createdAt: nowIso,
    };
    state.notifications.unshift(notif);
    await trySyncNotificationToSupabase(db, notif);
  }

  saveUnifiedMaterialsState(state);

  return {
    master: nextMaster,
    addedAliases,
    addedThicknessesMm,
    addedSpecs,
    addedBrands,
    addedUnitEquations,
    submittedBasePrice,
    submittedBrandPrices,
    notification: notif,
    supabaseSynced,
  };
}

/**
 * Periodic Automatic Market Price Averaging Engine:
 * Aggregates independent price observations from artists & suppliers across Supabase + local state.
 * Only updates global marketBasePrice / brandPrices for items/brands with >= minObservations (default 2)
 * distinct participating members, using outlier trimming when >= 4 observations exist.
 */
export async function recalculatePeriodicMarketAverages(
  db: SupabaseClient | null | undefined,
  options?: { minObservations?: number }
): Promise<{
  updatedMastersCount: number;
  updatedBrandsCount: number;
  totalObservationsScanned: number;
  ranAt: string;
}> {
  const minObs = Math.max(2, Number(options?.minObservations || 2));
  const ranAt = new Date().toISOString();
  const state = loadUnifiedMaterialsState();

  const allObsRows: MemberMaterialCustomization[] = [];

  if (db) {
    try {
      const { data, error } = await db
        .from('member_material_customizations')
        .select('*')
        .eq('spec_code', MEMBER_PRICE_OBS_SPEC_CODE)
        .limit(10000);
      if (!error && Array.isArray(data)) {
        for (const r of data) allObsRows.push(rowToCustom(r));
      }
    } catch {}
  }

  // Merge local observations if not already present
  const seenKeys = new Set(
    allObsRows.map((c) => `${c.masterCode}|${c.memberRole}|${c.memberId}`)
  );
  for (const c of state.memberCustomizations) {
    if (c.specCode !== MEMBER_PRICE_OBS_SPEC_CODE || c.memberId === GLOBAL_PRICING_MEMBER_ID) continue;
    const key = `${c.masterCode}|${c.memberRole}|${c.memberId}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      allObsRows.push(c);
    }
  }

  // Group deduplicated observations per masterCode
  const byMaster = new Map<string, Map<string, MemberMaterialCustomization>>();
  for (const obs of allObsRows) {
    const code = String(obs.masterCode || '').toUpperCase();
    if (!code) continue;
    const memberKey = `${obs.memberRole}:${obs.memberId}`;
    const mMap = byMaster.get(code) || new Map<string, MemberMaterialCustomization>();
    const prev = mMap.get(memberKey);
    if (!prev || String(obs.updatedAt || '') >= String(prev.updatedAt || '')) {
      mMap.set(memberKey, obs);
    }
    byMaster.set(code, mMap);
  }

  let updatedMastersCount = 0;
  let updatedBrandsCount = 0;

  for (const [masterCode, memberObsMap] of byMaster.entries()) {
    const baseValues: number[] = [];
    const brandValuesMap = new Map<string, number[]>();

    for (const obs of memberObsMap.values()) {
      const ov = (obs.bridgeOverrides || {}) as Record<string, any>;
      const bp = sanitizePositivePrice(ov.personalBasePrice);
      if (bp !== undefined) baseValues.push(bp);

      const brMap = sanitizeBrandPricesMap(ov.personalBrandPrices);
      for (const [brandName, price] of Object.entries(brMap)) {
        const arr = brandValuesMap.get(brandName) || [];
        arr.push(price);
        brandValuesMap.set(brandName, arr);
      }
    }

    const avgBase = baseValues.length >= minObs ? computeTrimmedMarketAverage(baseValues) : null;
    const averagedBrandPrices: Record<string, number> = {};
    for (const [brandName, vals] of brandValuesMap.entries()) {
      if (vals.length >= minObs) {
        const avgBr = computeTrimmedMarketAverage(vals);
        if (avgBr !== null) {
          averagedBrandPrices[brandName] = avgBr;
          updatedBrandsCount += 1;
        }
      }
    }

    if (avgBase !== null || Object.keys(averagedBrandPrices).length > 0) {
      await upsertGlobalPricingRecord(db, state, masterCode, {
        marketBasePrice: avgBase ?? undefined,
        brandPrices: averagedBrandPrices,
        priceSource: 'auto_average',
        observationsCount: memberObsMap.size,
        priceLastUpdatedAt: ranAt,
      });
      updatedMastersCount += 1;
    }
  }

  if (updatedMastersCount > 0) {
    saveUnifiedMaterialsState(state);
  }
  lastAutoPriceAvgAt = Date.now();

  return {
    updatedMastersCount,
    updatedBrandsCount,
    totalObservationsScanned: allObsRows.length,
    ranAt,
  };
}

export async function resolveUnifiedMaterialNotification(
  db: SupabaseClient | null | undefined,
  notifId: string,
  decision: 'accept_global' | 'keep_local' | 'archive' | 'dismiss',
  adminEmail: string
) {
  const state = loadUnifiedMaterialsState();
  const merged = await loadUnifiedMaterialsSnapshotFromSupabase(db, { isSuperAdmin: true });
  let notif = state.notifications.find((n) => n.id === notifId) || merged.notifications.find((n) => n.id === notifId);
  if (!notif) throw new Error('الإشعار غير موجود');
  notif = { ...notif };
  const nowIso = new Date().toISOString();

  if (decision === 'accept_global') {
    const master = merged.masters.find((m) => m.code === notif!.targetCode);
    if (notif.eventType === 'new_master' && master) {
      state.masterPatches[master.code] = { ...(state.masterPatches[master.code] || {}), reviewStatus: 'approved', updatedAt: nowIso };
      await trySyncMasterToSupabase(db, { ...master, ...state.masterPatches[master.code] });
    } else if (notif.eventType === 'new_spec') {
      const spec = merged.specs.find((s) => s.specCode === notif!.targetCode);
      if (spec) {
        state.specPatches[spec.specCode] = { ...(state.specPatches[spec.specCode] || {}), reviewStatus: 'approved' };
        await trySyncSpecToSupabase(db, { ...spec, ...state.specPatches[spec.specCode] });
      }
    } else if (notif.eventType === 'member_edit_proposal' && master) {
      if (notif.payload?.proposedName) {
        state.masterPatches[master.code] = {
          ...(state.masterPatches[master.code] || {}),
          canonicalName: String(notif.payload.proposedName),
          reviewStatus: 'approved',
          updatedAt: nowIso,
        };
        await trySyncMasterToSupabase(db, { ...master, ...state.masterPatches[master.code] });
      }
      // If notification carried submitted market/brand prices, Super Admin approving adopts them globally!
      const approvedBase = sanitizePositivePrice(notif.payload?.submittedBasePrice);
      const approvedBrands = sanitizeBrandPricesMap(notif.payload?.submittedBrandPrices);
      if (approvedBase !== undefined || Object.keys(approvedBrands).length > 0) {
        await upsertGlobalPricingRecord(db, state, master.code, {
          marketBasePrice: approvedBase,
          brandPrices: approvedBrands,
          priceSource: 'super_admin',
          priceLastUpdatedAt: nowIso,
        });
      }
    } else if (notif.eventType === 'member_local_remove' && master) {
      state.masterPatches[master.code] = {
        ...(state.masterPatches[master.code] || {}),
        status: 'archived',
        archiveReason: notif.reason || 'مؤرشف بموافقة السوبر أدمن بناءً على طلب عضو',
        updatedAt: nowIso,
      };
      await trySyncMasterToSupabase(db, { ...master, ...state.masterPatches[master.code] });
    }
    notif.status = 'accepted_global';
  } else if (decision === 'archive') {
    const master = merged.masters.find((m) => m.code === notif!.targetCode);
    if (master) {
      state.masterPatches[master.code] = {
        ...(state.masterPatches[master.code] || {}),
        status: 'archived',
        archiveReason: notif.reason || 'مؤرشف من قِبل السوبر أدمن',
        updatedAt: nowIso,
      };
      await trySyncMasterToSupabase(db, { ...master, ...state.masterPatches[master.code] });
    }
    notif.status = 'archived';
  } else if (decision === 'keep_local') {
    if (notif.eventType === 'new_master') {
      const master = merged.masters.find((m) => m.code === notif!.targetCode);
      if (master) {
        state.masterPatches[master.code] = {
          ...(state.masterPatches[master.code] || {}),
          status: 'archived',
          archiveReason: 'مقتصر على العضو المُضيف فقط (قرار السوبر أدمن)',
          updatedAt: nowIso,
        };
        await trySyncMasterToSupabase(db, { ...master, ...state.masterPatches[master.code] });
      }
    }
    notif.status = 'kept_local';
  } else {
    notif.status = 'dismissed';
  }

  notif.resolvedBy = adminEmail;
  notif.resolvedAt = nowIso;
  const localIdx = state.notifications.findIndex((n) => n.id === notifId);
  if (localIdx >= 0) state.notifications[localIdx] = notif;
  else state.notifications.unshift(notif);
  saveUnifiedMaterialsState(state);
  await trySyncNotificationToSupabase(db, notif);

  return notif;
}
