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

const STATE_FILE = path.resolve(process.cwd(), 'data/unified_materials_state.json');

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
        (c) => c.memberId === options.memberId && (!options.memberRole || c.memberRole === options.memberRole)
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
  };
}

// Sync non-blocking to Supabase tables if migration has been run
async function trySyncMasterToSupabase(db: SupabaseClient | null | undefined, master: UnifiedMaterialMaster) {
  if (!db) return;
  try {
    await db.from('unified_materials_master').upsert(
      {
        code: master.code,
        prefix: master.prefix,
        seq_num: master.seqNum,
        canonical_name: master.canonicalName,
        unit_chain: master.unitChain,
        unit_note: master.unitNote || '',
        bridge_fields: master.bridgeFields,
        spec_fields: master.specFields,
        artist_aliases: master.artistAliases,
        supplier_aliases: master.supplierAliases,
        default_brands: master.defaultBrands,
        workshop_tags: master.workshopTags,
        safety_note: master.safetyNote || '',
        is_asset_only: Boolean(master.isAssetOnly),
        is_added_for_equations: Boolean(master.isAddedForEquations),
        status: master.status,
        review_status: master.reviewStatus,
        created_by_role: master.createdByRole,
        created_by_id: master.createdById || '',
        created_by_name: master.createdByName || '',
        archive_reason: master.archiveReason || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'code' }
    );
  } catch {}
}

async function trySyncSpecToSupabase(db: SupabaseClient | null | undefined, spec: UnifiedMaterialSpec) {
  if (!db) return;
  try {
    await db.from('unified_material_specs').upsert(
      {
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
        status: spec.status,
        review_status: spec.reviewStatus,
        created_by_role: spec.createdByRole,
        created_by_id: spec.createdById || '',
        created_by_name: spec.createdByName || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'spec_code' }
    );
  } catch {}
}

async function trySyncAliasToSupabase(db: SupabaseClient | null | undefined, alias: UnifiedMaterialAlias) {
  if (!db) return;
  try {
    await db.from('unified_material_aliases').upsert(
      {
        alias_code: alias.aliasCode,
        target_code: alias.targetCode,
        alias_name: alias.aliasName,
        alias_type: alias.aliasType,
        context_hint: alias.contextHint || '',
        is_ambiguous: Boolean(alias.isAmbiguous),
        created_by_role: alias.createdByRole || 'system',
        created_by_id: alias.createdById || '',
      },
      { onConflict: 'alias_code' }
    );
  } catch {}
}

async function trySyncNotificationToSupabase(
  db: SupabaseClient | null | undefined,
  notif: UnifiedMaterialNotification
) {
  if (!db) return;
  try {
    await db.from('unified_material_notifications').upsert(
      {
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
      },
      { onConflict: 'id' }
    );
  } catch {}
}

async function trySyncMemberCustomizationToSupabase(
  db: SupabaseClient | null | undefined,
  custom: MemberMaterialCustomization
) {
  if (!db) return;
  try {
    await db.from('member_material_customizations').upsert(
      {
        member_role: custom.memberRole,
        member_id: custom.memberId,
        master_code: custom.masterCode,
        spec_code: custom.specCode || '',
        custom_name: custom.customName || '',
        is_hidden: Boolean(custom.isHidden),
        hide_reason: custom.hideReason || '',
        bridge_overrides: custom.bridgeOverrides || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'member_role,member_id,master_code,spec_code' }
    );
  } catch {}
}

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
  const merged = buildMergedUnifiedSnapshot(state, { isSuperAdmin: true });
  const { code, seqNum } = generateNextMasterCode(input.prefix, merged.masters, state.reservedMasterSeqs);
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
  await trySyncMasterToSupabase(db, master);
  if (createdSpec) await trySyncSpecToSupabase(db, createdSpec);
  if (notif) await trySyncNotificationToSupabase(db, notif);

  return { master, spec: createdSpec, notification: notif };
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
  const merged = buildMergedUnifiedSnapshot(state, { isSuperAdmin: true });
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
  await trySyncSpecToSupabase(db, spec);
  if (notif) await trySyncNotificationToSupabase(db, notif);
  return { spec, notification: notif };
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
  const merged = buildMergedUnifiedSnapshot(state, { isSuperAdmin: true });
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
  await trySyncAliasToSupabase(db, alias);
  if (notif) await trySyncNotificationToSupabase(db, notif);
  return { alias, notification: notif };
}

export async function createUnifiedBrandItem(
  db: SupabaseClient | null | undefined,
  input: { brandName: string; categoryHint?: string }
) {
  const state = loadUnifiedMaterialsState();
  const merged = buildMergedUnifiedSnapshot(state, { isSuperAdmin: true });
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
      await db.from('unified_material_brands').upsert({
        brand_code: brand.brandCode,
        brand_name: brand.brandName,
        category_hint: brand.categoryHint,
        status: 'active',
      });
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
  const merged = buildMergedUnifiedSnapshot(state, { isSuperAdmin: true });
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
      // Reserve seqNum permanently so code number is never reused!
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
    await trySyncMasterToSupabase(db, updatedMaster);
    return { scope: 'global', master: updatedMaster };
  }

  // Artisan or Supplier: NEVER alters or deletes global registry for others!
  // Saves local customization for that member ONLY and notifies Super Admin.
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
  await trySyncMemberCustomizationToSupabase(db, nextCustom);
  await trySyncNotificationToSupabase(db, notif);

  return { scope: 'member_only', customization: nextCustom, notification: notif };
}

export async function resolveUnifiedMaterialNotification(
  db: SupabaseClient | null | undefined,
  notifId: string,
  decision: 'accept_global' | 'keep_local' | 'archive' | 'dismiss',
  adminEmail: string
) {
  const state = loadUnifiedMaterialsState();
  const idx = state.notifications.findIndex((n) => n.id === notifId);
  if (idx < 0) throw new Error('الإشعار غير موجود');
  const notif = state.notifications[idx];
  const merged = buildMergedUnifiedSnapshot(state, { isSuperAdmin: true });
  const nowIso = new Date().toISOString();

  if (decision === 'accept_global') {
    const master = merged.masters.find((m) => m.code === notif.targetCode);
    if (notif.eventType === 'new_master' && master) {
      state.masterPatches[master.code] = { ...(state.masterPatches[master.code] || {}), reviewStatus: 'approved', updatedAt: nowIso };
      await trySyncMasterToSupabase(db, { ...master, ...state.masterPatches[master.code] });
    } else if (notif.eventType === 'new_spec') {
      const spec = merged.specs.find((s) => s.specCode === notif.targetCode);
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
    const master = merged.masters.find((m) => m.code === notif.targetCode);
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
    // If it was a member_edit_proposal or member_local_remove, member customization remains local-only!
    // If it was a new_master added by mistake globally, archive from global so only creator uses it.
    if (notif.eventType === 'new_master') {
      const master = merged.masters.find((m) => m.code === notif.targetCode);
      if (master) {
        state.masterPatches[master.code] = {
          ...(state.masterPatches[master.code] || {}),
          status: 'archived',
          archiveReason: 'مقتصر على العضو المُضيف فقط (قرار السوبر أدمن)',
          updatedAt: nowIso,
        };
      }
    }
    notif.status = 'kept_local';
  } else {
    notif.status = 'dismissed';
  }

  notif.resolvedBy = adminEmail;
  notif.resolvedAt = nowIso;
  state.notifications[idx] = notif;
  saveUnifiedMaterialsState(state);
  await trySyncNotificationToSupabase(db, notif);

  return notif;
}
