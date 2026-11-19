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

  const memberCustomizations = options?.isSuperAdmin
    ? state.memberCustomizations
    : options?.memberId
    ? state.memberCustomizations.filter(
        (c) =>
          c.memberId === options.memberId &&
          (!options.memberRole || c.memberRole === options.memberRole)
      )
    : [];

  return {
    categories: UNIFIED_CATEGORIES,
    unitChains: UNIT_CHAINS,
    fixedConversions: FIXED_UNIT_CONVERSIONS,
    brands: Array.from(brandMap.values()),
    masters: Array.from(masterMap.values()),
    specs: Array.from(specMap.values()),
    aliases: Array.from(aliasMap.values()),
    notifications: options?.isSuperAdmin ? state.notifications : [],
    memberCustomizations,
    reservedMasterSeqs: state.reservedMasterSeqs,
    storageSource: 'local_fallback' as 'supabase' | 'local_fallback',
  };
}

// ---------------------------------------------------------------------------
// Row Mappers (App <-> Supabase snake_case)
// ---------------------------------------------------------------------------
function masterToRow(master: UnifiedMaterialMaster) {
  return {
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

      // 3. Masters (395+) in batches of 100
      const masterRows = merged.masters.map(masterToRow);
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

    const [mastersRes, specsRes, aliasesRes, brandsRes, notifsRes, customRes] = await Promise.all([
      db.from('unified_materials_master').select('*').order('code', { ascending: true }).limit(2000),
      db.from('unified_material_specs').select('*').order('spec_code', { ascending: true }).limit(2000),
      db.from('unified_material_aliases').select('*').order('alias_code', { ascending: true }).limit(2000),
      db.from('unified_material_brands').select('*').order('brand_code', { ascending: true }).limit(1000),
      options?.isSuperAdmin
        ? db.from('unified_material_notifications').select('*').order('created_at', { ascending: false }).limit(300)
        : Promise.resolve({ data: [], error: null }),
      options?.isSuperAdmin
        ? db.from('member_material_customizations').select('*').limit(1000)
        : options?.memberId
        ? db
            .from('member_material_customizations')
            .select('*')
            .eq('member_id', options.memberId)
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (mastersRes.error || !Array.isArray(mastersRes.data) || mastersRes.data.length === 0) {
      return fallback;
    }

    const masters = mastersRes.data.map(rowToMaster);
    const specs = Array.isArray(specsRes.data) ? specsRes.data.map(rowToSpec) : fallback.specs;
    const aliases = Array.isArray(aliasesRes.data) ? aliasesRes.data.map(rowToAlias) : fallback.aliases;
    const brands = Array.isArray(brandsRes.data) && brandsRes.data.length > 0
      ? brandsRes.data.map(rowToBrand)
      : fallback.brands;
    const notifications = Array.isArray(notifsRes.data) ? notifsRes.data.map(rowToNotif) : [];
    const memberCustomizations = Array.isArray(customRes.data)
      ? customRes.data
          .map(rowToCustom)
          .filter((c) => options?.isSuperAdmin || !options?.memberRole || c.memberRole === options.memberRole)
      : [];

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
    const { error } = await db
      .from('unified_materials_master')
      .upsert(masterToRow(master), { onConflict: 'code' });
    if (error) {
      if (error.code !== 'PGRST205') console.warn('[UnifiedMaterials] Master sync error:', error.message);
      return false;
    }
    return true;
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
  const { code, seqNum } = generateNextMasterCode(input.prefix, merged.masters, merged.reservedMasterSeqs);
  const catDef = UNIFIED_CATEGORIES.find((c) => c.prefix === input.prefix);
  const nowIso = new Date().toISOString();

  const master: UnifiedMaterialMaster = {
    code,
    prefix: input.prefix,
    seqNum,
    canonicalName: input.canonicalName.trim(),
    unitChain: input.unitChain || catDef?.defaultUnitChain || 'ل1',
    bridgeFields: Array.isArray(input.bridgeFields) ? input.bridgeFields : [],
    specFields: Array.isArray(input.specFields) ? input.specFields : [],
    artistAliases: Array.isArray(input.artistAliases) ? input.artistAliases.filter(Boolean) : [],
    supplierAliases: Array.isArray(input.supplierAliases) ? input.supplierAliases.filter(Boolean) : [],
    defaultBrands: [],
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

  let createdSpec: UnifiedMaterialSpec | null = null;
  if (input.initialSpecLabel?.trim()) {
    const { specCode, specIndex } = generateNextSpecCode(code, merged.specs);
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
  }

  let notif: UnifiedMaterialNotification | null = null;
  if (input.actorRole !== 'super_admin') {
    notif = {
      id: crypto.randomUUID(),
      eventType: 'new_master',
      targetCode: code,
      targetName: master.canonicalName,
      actorRole: input.actorRole,
      actorId: input.actorId,
      actorName: input.actorName,
      reason: `إضافة صنف خامة جديد من ${input.actorRole === 'supplier' ? 'مورد' : 'فنان'} ومزامنته فوراً`,
      payload: { master, initialSpec: createdSpec },
      status: 'pending',
      createdAt: nowIso,
    };
    state.notifications.unshift(notif);
  }

  saveUnifiedMaterialsState(state);
  const supabaseSynced = await trySyncMasterToSupabase(db, master);
  if (createdSpec) await trySyncSpecToSupabase(db, createdSpec);
  if (notif) await trySyncNotificationToSupabase(db, notif);

  return { master, spec: createdSpec, notification: notif, supabaseSynced };
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

  // Super Admin direct global control
  if (input.actorRole === 'super_admin') {
    const patch: Partial<UnifiedMaterialMaster> = {
      ...(state.masterPatches[upperCode] || {}),
      updatedAt: nowIso,
    };
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
      patch.reviewStatus = 'approved';
    }
    state.masterPatches[upperCode] = patch;
    const updatedMaster = { ...existing, ...patch };
    saveUnifiedMaterialsState(state);
    const supabaseSynced = await trySyncMasterToSupabase(db, updatedMaster);
    return { scope: 'global', master: updatedMaster, supabaseSynced };
  }

  // Artisan or Supplier: local customization only + Super Admin notification
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
    ...(input.action === 'remove_local' || input.action === 'archive' || input.action === 'delete_unused'
      ? { isHidden: true, hideReason: input.reason || 'إزالة من قائمة العضو فقط' }
      : { customName: input.canonicalName?.trim() || prevCustom.customName }),
    updatedAt: nowIso,
  };
  if (idx >= 0) state.memberCustomizations[idx] = nextCustom;
  else state.memberCustomizations.unshift(nextCustom);

  const notif: UnifiedMaterialNotification = {
    id: crypto.randomUUID(),
    eventType:
      input.action === 'remove_local' || input.action === 'archive' || input.action === 'delete_unused'
        ? 'member_local_remove'
        : 'member_edit_proposal',
    targetCode: upperCode,
    targetName: existing.canonicalName,
    actorRole: input.actorRole,
    actorId: input.actorId,
    actorName: input.actorName,
    reason:
      input.reason ||
      (input.action === 'remove_local'
        ? 'أزال العضو الصنف من قائمته الخاصة'
        : `اقترح العضو تعديل الاسم إلى "${input.canonicalName || existing.canonicalName}" (مطبّق لديه فقط حالياً)`),
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
    } else if (notif.eventType === 'member_edit_proposal' && master && notif.payload?.proposedName) {
      state.masterPatches[master.code] = {
        ...(state.masterPatches[master.code] || {}),
        canonicalName: String(notif.payload.proposedName),
        reviewStatus: 'approved',
        updatedAt: nowIso,
      };
      await trySyncMasterToSupabase(db, { ...master, ...state.masterPatches[master.code] });
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
