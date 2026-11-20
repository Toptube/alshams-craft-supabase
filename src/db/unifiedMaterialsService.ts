import { supabase } from '../lib/supabase';
import {
  UNIFIED_CATEGORIES,
  UNIT_CHAINS,
  FIXED_UNIT_CONVERSIONS,
  SEEDED_BRANDS,
  SEEDED_UNIFIED_MASTERS,
  SEEDED_UNIFIED_SPECS,
  SEEDED_UNIFIED_ALIASES,
  UnifiedMaterialsSnapshot,
  UnifiedCategoryPrefix,
  UnitChainCode,
  BridgeFieldKey,
  UnifiedMaterialMaster,
  UnifiedMaterialSpec,
  UnifiedMaterialAlias,
  UnifiedBrandRecord,
  UnifiedMaterialNotification,
} from '../registry/unifiedMaterialsRegistry';

const CACHE_KEY = 'alshams_unified_materials_snapshot_v1';

async function getAuthHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    if (session?.user?.email) {
      headers['x-user-email'] = session.user.email;
    }
  } catch {}
  return headers;
}

export function getSeededFallbackSnapshot(): UnifiedMaterialsSnapshot {
  return {
    categories: UNIFIED_CATEGORIES,
    unitChains: UNIT_CHAINS,
    fixedConversions: FIXED_UNIT_CONVERSIONS,
    brands: SEEDED_BRANDS,
    masters: SEEDED_UNIFIED_MASTERS,
    specs: SEEDED_UNIFIED_SPECS,
    aliases: SEEDED_UNIFIED_ALIASES,
    notifications: [],
    memberCustomizations: [],
    reservedMasterSeqs: {},
  };
}

export function readCachedUnifiedSnapshot(): UnifiedMaterialsSnapshot {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        Array.isArray(parsed.masters) &&
        parsed.masters.length >= SEEDED_UNIFIED_MASTERS.length
      ) {
        return parsed;
      }
    }
  } catch {}
  return getSeededFallbackSnapshot();
}

export async function fetchUnifiedMaterialsSnapshot(options?: {
  role?: 'artisan' | 'supplier' | 'super_admin';
  memberId?: string;
}): Promise<UnifiedMaterialsSnapshot> {
  try {
    const headers = await getAuthHeaders();
    const qs = new URLSearchParams();
    if (options?.role) qs.set('role', options.role === 'supplier' ? 'supplier' : 'artisan');
    if (options?.memberId) qs.set('memberId', options.memberId);

    const res = await fetch(`/api/unified-materials?${qs.toString()}`, { headers });
    if (res.ok) {
      const json = await res.json();
      if (json?.success && Array.isArray(json.masters)) {
        const snapshot: UnifiedMaterialsSnapshot & { storageSource?: 'supabase' | 'local_fallback' } = {
          categories: json.categories || UNIFIED_CATEGORIES,
          unitChains: json.unitChains || UNIT_CHAINS,
          fixedConversions: json.fixedConversions || FIXED_UNIT_CONVERSIONS,
          brands: json.brands || SEEDED_BRANDS,
          masters: json.masters,
          specs: json.specs || SEEDED_UNIFIED_SPECS,
          aliases: json.aliases || SEEDED_UNIFIED_ALIASES,
          notifications: Array.isArray(json.notifications) ? json.notifications : [],
          memberCustomizations: Array.isArray(json.memberCustomizations) ? json.memberCustomizations : [],
          reservedMasterSeqs: json.reservedMasterSeqs || {},
          storageSource: json.storageSource === 'supabase' ? 'supabase' : 'local_fallback',
        };
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
        } catch {}
        return snapshot;
      }
    }
  } catch {}
  return readCachedUnifiedSnapshot();
}

export async function syncUnifiedMaterialsToSupabaseApi(): Promise<{
  success: boolean;
  tablesReady?: boolean;
  tablesMissing?: string[];
  verifiedCounts?: {
    categories: number;
    brands: number;
    masters: number;
    specs: number;
    aliases: number;
    notifications: number;
    memberCustomizations: number;
  };
  error?: string;
}> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/admin/unified-materials/sync-supabase', {
      method: 'POST',
      headers,
    });
    const json = await res.json().catch(() => ({}));
    return {
      success: Boolean(res.ok && json?.success),
      tablesReady: json?.tablesReady,
      tablesMissing: json?.tablesMissing,
      verifiedCounts: json?.verifiedCounts,
      error: json?.error,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال بالسيرفر' };
  }
}

export async function createUnifiedMasterApi(payload: {
  prefix: UnifiedCategoryPrefix;
  canonicalName: string;
  unitChain?: UnitChainCode;
  bridgeFields?: BridgeFieldKey[];
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
}): Promise<{
  success: boolean;
  master?: UnifiedMaterialMaster;
  spec?: UnifiedMaterialSpec | null;
  specs?: UnifiedMaterialSpec[];
  notification?: UnifiedMaterialNotification | null;
  alreadyExisted?: boolean;
  error?: string;
}> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/unified-materials/master', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) return json;
    return { success: false, error: json?.error || 'تعذر حفظ الخامة الموحدة' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال' };
  }
}

export async function createUnifiedSpecApi(payload: {
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
}): Promise<{ success: boolean; spec?: UnifiedMaterialSpec; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/unified-materials/spec', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) return json;
    return { success: false, error: json?.error || 'تعذر إضافة المواصفة' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال' };
  }
}

export async function createUnifiedAliasApi(payload: {
  targetCode: string;
  aliasName: string;
  aliasType: 'artisan' | 'supplier' | 'common';
  contextHint?: string;
  isAmbiguous?: boolean;
  actorRole: 'super_admin' | 'artisan' | 'supplier';
  actorId: string;
  actorName: string;
}): Promise<{ success: boolean; alias?: UnifiedMaterialAlias; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/unified-materials/alias', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) return json;
    return { success: false, error: json?.error || 'تعذر إضافة الاسم الدارج' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال' };
  }
}

export async function createUnifiedBrandApi(payload: {
  brandName: string;
  categoryHint?: string;
}): Promise<{ success: boolean; brand?: UnifiedBrandRecord; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/unified-materials/brand', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) return json;
    return { success: false, error: json?.error || 'تعذر إضافة الماركة' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال' };
  }
}

export async function updateOrProposeUnifiedMasterApi(
  code: string,
  payload: {
    action: 'update' | 'archive' | 'restore' | 'delete_unused' | 'approve' | 'remove_local';
    canonicalName?: string;
    unitChain?: UnitChainCode;
    bridgeFields?: BridgeFieldKey[];
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
): Promise<{ success: boolean; scope?: 'global' | 'member_only'; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`/api/unified-materials/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) return json;
    return { success: false, error: json?.error || 'تعذر تحديث الخامة' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال' };
  }
}

export async function contributeUnifiedMasterApi(
  code: string,
  payload: {
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
    /** Member's own personal base price observation (never overwrites global baseline directly) */
    personalBasePrice?: number;
    /** Member's own personal brand price observations (never overwrite global brand prices directly) */
    personalBrandPrices?: Record<string, number>;
    /** Advisory note sent ONLY to Super Admin (never stored inside material DB fields) */
    suggestionNote?: string;
    actorRole: 'super_admin' | 'artisan' | 'supplier';
    actorId: string;
    actorName: string;
  }
): Promise<{
  success: boolean;
  master?: UnifiedMaterialMaster;
  addedAliases?: string[];
  addedThicknessesMm?: number[];
  addedSpecs?: UnifiedMaterialSpec[];
  addedBrands?: UnifiedBrandRecord[];
  addedUnitEquations?: string[];
  submittedBasePrice?: number;
  submittedBrandPrices?: Record<string, number>;
  notification?: UnifiedMaterialNotification | null;
  supabaseSynced?: boolean;
  error?: string;
}> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`/api/unified-materials/${encodeURIComponent(code)}/contribute`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) return json;
    return { success: false, error: json?.error || 'تعذر حفظ التعديلات في منظومة الخامات' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال بالسيرفر' };
  }
}

export async function resolveUnifiedMaterialNotificationApi(
  notifId: string,
  decision: 'accept_global' | 'keep_local' | 'archive' | 'dismiss'
): Promise<{ success: boolean; notification?: UnifiedMaterialNotification; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`/api/unified-materials/notifications/${encodeURIComponent(notifId)}/resolve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ decision }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) return json;
    return { success: false, error: json?.error || 'تعذر تنفيذ القرار' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال' };
  }
}

export async function recalculateUnifiedMarketPricesApi(minObservations = 2): Promise<{
  success: boolean;
  updatedMastersCount?: number;
  updatedBrandsCount?: number;
  totalObservationsScanned?: number;
  ranAt?: string;
  error?: string;
}> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/admin/unified-materials/recalculate-prices', {
      method: 'POST',
      headers,
      body: JSON.stringify({ minObservations }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) return json;
    return { success: false, error: json?.error || 'تعذر تحديث متوسطات السوق تلقائياً' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال بالسيرفر' };
  }
}

export function getMemberMaterialCodeMapKey(role: 'artisan' | 'supplier', memberId: string): string {
  return `alshams_member_unified_map_${role}_${memberId}`;
}

export interface LocalMaterialCodeMapping {
  masterCode: string;
  specCode?: string;
  brandCode?: string;
  skuCode?: string;
  unitChain?: string;
  selectedThicknessesMm?: number[];
  selectedAliases?: string[];
  selectedBrands?: string[];
  selectedUnitEquation?: string;
  personalBasePrice?: number;
  personalBrandPrices?: Record<string, number>;
}

export function getLocalMaterialCodeMap(
  role: 'artisan' | 'supplier',
  memberId: string
): Record<string, LocalMaterialCodeMapping> {
  try {
    const raw = localStorage.getItem(getMemberMaterialCodeMapKey(role, memberId));
    if (raw) return JSON.parse(raw) || {};
  } catch {}
  return {};
}

export function saveLocalMaterialCodeMapping(
  role: 'artisan' | 'supplier',
  memberId: string,
  localMaterialId: string,
  mapping: LocalMaterialCodeMapping
): void {
  try {
    const current = getLocalMaterialCodeMap(role, memberId);
    current[localMaterialId] = mapping;
    localStorage.setItem(getMemberMaterialCodeMapKey(role, memberId), JSON.stringify(current));
  } catch {}
}

/**
 * Remove a deleted workshop material ID from localStorage code map so it is NEVER
 * falsely locked as "already owned" in the Unified Materials Picker!
 */
export function removeLocalMaterialCodeMapping(
  role: 'artisan' | 'supplier',
  memberId: string,
  localMaterialId: string
): void {
  try {
    const current = getLocalMaterialCodeMap(role, memberId);
    if (current[localMaterialId]) {
      delete current[localMaterialId];
      localStorage.setItem(getMemberMaterialCodeMapKey(role, memberId), JSON.stringify(current));
    }
  } catch {}
}

/**
 * Prune any stale material IDs from localStorage code map that no longer exist
 * in the workshop's live materials list.
 */
export function pruneLocalMaterialCodeMap(
  role: 'artisan' | 'supplier',
  memberId: string,
  activeMaterialIds: Set<string>
): Record<string, LocalMaterialCodeMapping> {
  const current = getLocalMaterialCodeMap(role, memberId);
  let changed = false;
  const cleaned: Record<string, LocalMaterialCodeMapping> = {};
  for (const [id, val] of Object.entries(current)) {
    if (activeMaterialIds.has(id)) {
      cleaned[id] = val;
    } else {
      changed = true;
    }
  }
  if (changed) {
    try {
      localStorage.setItem(getMemberMaterialCodeMapKey(role, memberId), JSON.stringify(cleaned));
    } catch {}
  }
  return cleaned;
}

