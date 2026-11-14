import { supabase } from '../lib/supabase';
import { tenantStorage } from './dexieDB';
import type { SavedProductRecord, UserProfile } from '../types';
import { publishProductToMarketplace, fetchWorkshopMarketplaceProducts } from './marketplaceCloud';
import { flushOfflineMutations, getPendingOfflineMutationsCount } from './offlineMutationQueue';
import {
  markManyDirty,
  getPending,
  clearPending,
  pendingCount,
  emitSyncStatus,
  PRODUCTS_DIRTY_EVENT,
  PRODUCTS_PULLED_EVENT,
  type PendingEntry,
} from './productSyncQueue';

/**
 * مزامنة أرشيف المنتجات مع جدول products في Supabase
 * (عشان صقر الشمساوية يقدر يبحث فيه من السيرفر، وعشان البيانات ما تضيعش لو المتصفح اتمسح)
 */
function toLocalRecordSnapshot(record: SavedProductRecord): any {
  const copy: any = JSON.parse(JSON.stringify(record));
  if (typeof copy.imageUrl === 'string' && copy.imageUrl.startsWith('data:')) delete copy.imageUrl;
  return copy;
}

export function productToCloudRow(record: SavedProductRecord, workshopId: string, primaryMaterialName?: string) {
  const input: any = record.input || {};
  const output: any = record.output || {};

  const materialsUsed = [
    ...(input.cordTypeId
      ? [{ name: primaryMaterialName || input.cordTypeId, kind: 'خيط/خامة أساسية', weightKg: output.totalWeightKg, totalCost: output.yarnCost }]
      : []),
    ...((input.extraMaterials || []) as any[]).map((m) => ({
      name: m.name,
      unit: m.unit,
      quantity: m.quantity,
      unitPrice: m.unitPrice,
      totalCost: m.totalCost,
    })),
  ];

  return {
    id: record.id,
    workshop_id: workshopId,
    product_name: record.productName,
    product_code: record.productCode ?? null,
    serial_number: record.productSerialNumber ?? null,
    category: String(record.category ?? ''),
    product_type: record.productType ?? null,
    craft_name: record.craftName ?? null,
    main_section: record.mainSectionName ?? null,
    cost_price: record.costPrice ?? 0,
    retail_price: record.retailPrice ?? output.finalSellingPrice ?? 0,
    wholesale_price: record.wholesalePrice ?? 0,
    materials_used: materialsUsed,
    specs: {
      shape: input.shape3D,
      widthCm: input.widthCm,
      totalLengthCm: input.totalLengthCm,
      diameterCm: input.diameterCm,
      fringeLengthCm: input.fringeLengthCm,
      cordThicknessMm: input.cordThicknessMm,
      totalWeightGrams: output.totalWeightGrams,
      totalYarnLengthMeters: output.totalYarnLengthMeters,
      notes: input.personalNotes || '',
      materialsDescription: (record as any).materialsDescription || '',
      colorVariants: (record as any).colorVariants || '',
      marketingDescription: (record as any).marketingDescription || '',
      careInstructions: (record as any).careInstructions || '',
      tags: Array.isArray((record as any).tags) ? (record as any).tags : [],
    },
    image_url: record.imageUrl && !record.imageUrl.startsWith('data:') ? record.imageUrl : null,
    is_active: record.isActive !== false,
    local_record: toLocalRecordSnapshot(record),
    created_at: new Date(record.createdAt || Date.now()).toISOString(),
    updated_at: new Date(record.updatedAt || Date.now()).toISOString(),
  };
}

export async function upsertProductToCloud(
  record: SavedProductRecord,
  workshopId: string,
  primaryMaterialName?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('products')
    .upsert(productToCloudRow(record, workshopId, primaryMaterialName), { onConflict: 'id' });
  if (error) console.warn('[productsCloud] upsert failed:', error.message);
  return !error;
}

export async function deleteProductFromCloud(productId: string, workshopId: string): Promise<boolean> {
  const { error } = await supabase.from('products').delete().eq('id', productId).eq('workshop_id', workshopId);
  if (error) console.warn('[productsCloud] delete failed:', error.message);
  return !error;
}

async function enqueueExistingOnce(workshopId: string): Promise<void> {
  const flag = `alshams_products_backfilled_v2_${workshopId}`;
  try {
    if (localStorage.getItem(flag)) return;
  } catch {
    return;
  }
  const local = await tenantStorage.getProducts(workshopId);
  markManyDirty(workshopId, local.map((p) => p.id));
  try {
    localStorage.setItem(flag, String(Date.now()));
  } catch {
    /* ignore */
  }
}

const flushing = new Map<string, Promise<number>>();

export function flushProductSync(workshopId: string): Promise<number> {
  if (!workshopId) return Promise.resolve(0);
  const running = flushing.get(workshopId);
  if (running) return running;
  const job = doFlush(workshopId).finally(() => flushing.delete(workshopId));
  flushing.set(workshopId, job);
  return job;
}

async function doFlush(workshopId: string): Promise<number> {
  const snapshot = getPending(workshopId);
  const ids = Object.keys(snapshot);
  if (ids.length === 0) {
    emitSyncStatus(workshopId, 'idle', 0);
    return 0;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    emitSyncStatus(workshopId, 'offline', ids.length);
    return ids.length;
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    emitSyncStatus(workshopId, 'idle', ids.length);
    return ids.length;
  }

  emitSyncStatus(workshopId, 'syncing', ids.length);
  let hadError = false;
  for (let i = 0; i < ids.length; i += 100) {
    const chunkIds = ids.slice(i, i + 100);
    const rows: any[] = [];
    const done: Record<string, PendingEntry> = {};
    for (const id of chunkIds) {
      const record = await tenantStorage.getProductById(workshopId, id);
      if (!record) {
        done[id] = snapshot[id];
        continue;
      }
      rows.push(productToCloudRow(record, workshopId, snapshot[id].primaryMaterialName));
      done[id] = snapshot[id];
    }
    if (rows.length > 0) {
      try {
        const { error } = await supabase.from('products').upsert(rows, { onConflict: 'id' });
        if (error) {
          console.warn('[productsCloud] sync chunk failed:', error.message);
          hadError = true;
          continue;
        }
      } catch (err) {
        console.warn('[productsCloud] sync chunk failed (network):', err);
        hadError = true;
        continue;
      }
    }
    clearPending(workshopId, done);
  }
  const remaining = pendingCount(workshopId);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  emitSyncStatus(workshopId, remaining === 0 ? 'idle' : offline ? 'offline' : hadError ? 'error' : 'idle', remaining);
  return remaining;
}

const cursorKey = (w: string) => `alshams_products_pull_cursor_${w}`;
const pulling = new Map<string, Promise<number>>();

function rowToRecord(row: any, workshopId: string): SavedProductRecord {
  const specs = row.specs || {};
  return {
    id: row.id,
    tenantId: workshopId,
    workshopId,
    productName: row.product_name,
    productCode: row.product_code ?? undefined,
    productSerialNumber: row.serial_number ?? undefined,
    category: row.category,
    productType: row.product_type ?? undefined,
    craftName: row.craft_name ?? undefined,
    mainSectionName: row.main_section ?? undefined,
    costPrice: Number(row.cost_price ?? 0),
    retailPrice: Number(row.retail_price ?? 0),
    wholesalePrice: Number(row.wholesale_price ?? 0),
    input: {
      category: row.category,
      shape3D: specs.shape,
      widthCm: specs.widthCm,
      totalLengthCm: specs.totalLengthCm,
      diameterCm: specs.diameterCm,
      fringeLengthCm: specs.fringeLengthCm,
      cordThicknessMm: specs.cordThicknessMm,
      personalNotes: specs.notes || '',
      extraMaterials: [],
    },
    output: {
      totalWeightGrams: specs.totalWeightGrams,
      totalYarnLengthMeters: specs.totalYarnLengthMeters,
      finalSellingPrice: Number(row.retail_price ?? 0),
    },
    imageUrl: row.image_url ?? undefined,
    isActive: row.is_active !== false,
    createdAt: Date.parse(row.created_at) || Date.now(),
    updatedAt: Date.parse(row.updated_at) || Date.now(),
    materialsDescription: specs.materialsDescription,
    colorVariants: specs.colorVariants,
    marketingDescription: specs.marketingDescription,
    careInstructions: specs.careInstructions,
    tags: specs.tags,
  } as any;
}

async function applyRemoteRow(row: any, workshopId: string): Promise<boolean> {
  const remoteUpdated = Date.parse(row.updated_at) || 0;
  const local = await tenantStorage.getProductById(workshopId, row.id);
  const pending = getPending(workshopId)[row.id];

  if (local && (local.updatedAt || 0) >= remoteUpdated) {
    if ((local.updatedAt || 0) > remoteUpdated && !pending) markManyDirty(workshopId, [row.id]);
    return false;
  }

  const rec: any = row.local_record ? { ...row.local_record } : rowToRecord(row, workshopId);
  rec.id = row.id;
  rec.tenantId = workshopId;
  rec.workshopId = workshopId;
  rec.isActive = row.is_active !== false;
  rec.updatedAt = remoteUpdated || Date.now();
  if (rec.inStore === undefined && local?.inStore !== undefined) rec.inStore = local.inStore;
  if (rec.isPublishedInStore === undefined && local?.isPublishedInStore !== undefined) rec.isPublishedInStore = local.isPublishedInStore;
  if (rec.isMarketplaceApproved === undefined && local?.isMarketplaceApproved !== undefined) rec.isMarketplaceApproved = local.isMarketplaceApproved;
  if (!rec.imageUrl) rec.imageUrl = local?.imageUrl || row.image_url || undefined;
  await tenantStorage.applyRemoteProduct(rec);
  if (pending) clearPending(workshopId, { [row.id]: pending });
  return true;
}

export function pullProductsFromCloud(workshopId: string): Promise<number> {
  if (!workshopId) return Promise.resolve(0);
  const running = pulling.get(workshopId);
  if (running) return running;
  const job = doPull(workshopId).finally(() => pulling.delete(workshopId));
  pulling.set(workshopId, job);
  return job;
}

async function doPull(workshopId: string): Promise<number> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return 0;

  let cursor: string | null = null;
  try {
    cursor = localStorage.getItem(cursorKey(workshopId));
  } catch {
    /* ignore */
  }
  const firstPull = !cursor;
  if (firstPull) emitSyncStatus(workshopId, 'syncing', pendingCount(workshopId));

  const since = cursor ? new Date(Date.parse(cursor) - 5000).toISOString() : null;
  const PAGE = 500;
  let from = 0;
  let changed = 0;
  let maxSynced = cursor;

  let useUpdatedAtFallback = false;

  for (;;) {
    let q = supabase
      .from('products')
      .select('*')
      .eq('workshop_id', workshopId);

    if (useUpdatedAtFallback) {
      q = q.order('updated_at', { ascending: true }).order('id', { ascending: true }).range(from, from + PAGE - 1);
      if (since) q = q.gt('updated_at', since);
    } else {
      q = q.order('synced_at', { ascending: true }).order('id', { ascending: true }).range(from, from + PAGE - 1);
      if (since) q = q.gt('synced_at', since);
    }

    const { data: rows, error } = await q;
    if (error) {
      if (!useUpdatedAtFallback && (error.code === '42703' || error.message?.includes('synced_at'))) {
        useUpdatedAtFallback = true;
        from = 0;
        continue;
      }
      console.warn('[productsCloud] pull failed:', error.message);
      break;
    }
    for (const row of rows || []) {
      try {
        if (await applyRemoteRow(row, workshopId)) changed++;
      } catch (err) {
        console.warn('[productsCloud] apply failed for', row.id, err);
      }
      const syncStamp = row.synced_at || row.updated_at;
      if (syncStamp && (!maxSynced || Date.parse(syncStamp) > Date.parse(maxSynced))) maxSynced = syncStamp;
    }
    if (!rows || rows.length < PAGE) break;
    from += PAGE;
  }

  if (maxSynced && maxSynced !== cursor) {
    try {
      localStorage.setItem(cursorKey(workshopId), maxSynced);
    } catch {
      /* ignore */
    }
  }
  if (changed > 0) {
    try {
      window.dispatchEvent(new CustomEvent(PRODUCTS_PULLED_EVENT, { detail: { workshopId, changed } }));
      window.dispatchEvent(new CustomEvent('alshams_products_changed', { detail: { tenantId: workshopId, workshopId } }));
    } catch {
      /* ignore */
    }
  }
  emitSyncStatus(workshopId, 'idle', pendingCount(workshopId));
  return changed;
}

export async function syncProductsNow(workshopId: string): Promise<void> {
  await pullProductsFromCloud(workshopId).catch(() => 0);
  await flushProductSync(workshopId).catch(() => 0);
}

/**
 * مزامنة شاملة لكتالوج الورشة + معروضات متجر الورشة وسوق الشمساوية (ثنائية الاتجاه)
 */
export async function syncAllWorkshopProductsAndStore(profile: UserProfile): Promise<{
  pushedCatalog: number;
  pushedStore: number;
  pulled: number;
  pendingRemaining: number;
}> {
  const workshopId = profile.tenantId || profile.workshopId || profile.id || '';
  if (!workshopId || workshopId === 'workshop_demo' || workshopId === '00000000-0000-0000-0000-000000000000') {
    return { pushedCatalog: 0, pushedStore: 0, pulled: 0, pendingRemaining: 0 };
  }

  let pushedCatalog = 0;
  let pushedStore = 0;
  let pulled = 0;

  // 1. Ensure all local active products missing from remote `products` table are queued & flushed
  try {
    const localProds = await tenantStorage.getProducts(workshopId);
    let remoteCatalogIds = new Set<string>();
    const { data: sessData } = await supabase.auth.getSession();
    if (sessData?.session && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      const { data: rProds } = await supabase
        .from('products')
        .select('id')
        .eq('workshop_id', workshopId);
      if (Array.isArray(rProds)) {
        remoteCatalogIds = new Set(rProds.map((r: any) => r.id));
      }
      const missingIds = localProds.filter((p) => !remoteCatalogIds.has(p.id)).map((p) => p.id);
      if (missingIds.length > 0) {
        markManyDirty(workshopId, missingIds);
        pushedCatalog = missingIds.length;
      }
    }
  } catch {}

  await flushProductSync(workshopId).catch(() => 0);
  pulled += await pullProductsFromCloud(workshopId).catch(() => 0);

  // 2. Reconcile marketplace_products (public storefront + central marketplace submissions)
  try {
    const [localAfterPull, remoteStoreProds] = await Promise.all([
      tenantStorage.getProducts(workshopId),
      fetchWorkshopMarketplaceProducts(workshopId).catch(() => []),
    ]);

    const remoteMap = new Map(remoteStoreProds.map((rp) => [rp.id, rp]));
    const localMap = new Map(localAfterPull.map((lp) => [lp.id, lp]));

    // 2a. Push any local store-published product missing remotely or updated more recently
    for (const lp of localAfterPull) {
      if (lp.inStore && lp.isPublishedInStore !== false) {
        const rp = remoteMap.get(lp.id);
        const remoteUpdatedMs = rp?.updated_at
          ? typeof rp.updated_at === 'number'
            ? rp.updated_at
            : Date.parse(String(rp.updated_at)) || 0
          : 0;
        const localUpdatedMs = lp.updatedAt || 0;

        if (!rp || (localUpdatedMs > remoteUpdatedMs + 5000 && rp.status !== 'rejected')) {
          const res = await publishProductToMarketplace(lp, profile);
          if (res.cloudSynced) pushedStore++;
        } else if (rp) {
          // Reconcile remote approval/rejection status back into local Dexie
          const isApproved = rp.status === 'approved';
          const rejectReason = rp.rejection_reason || rp.rejectionReason || undefined;
          if (lp.isMarketplaceApproved !== isApproved || (lp as any).rejectReason !== rejectReason) {
            await tenantStorage.applyRemoteProduct({
              ...lp,
              isMarketplaceApproved: isApproved,
              ...(rejectReason ? { rejectReason } : {}),
            } as any);
            pulled++;
          }
        }
      }
    }

    // 2b. Recover any remote marketplace_products items missing locally in Dexie
    for (const rp of remoteStoreProds) {
      if (!localMap.has(rp.id)) {
        const recovered: SavedProductRecord = {
          id: rp.id,
          tenantId: workshopId,
          workshopId,
          productName: rp.product_name || rp.productName || 'مشغولة يدوية',
          category: (rp.category as any) || 'macrame',
          craftName: rp.craft_name || rp.craftName || rp.category,
          decorCategory: (rp.decor_category as any) || 'all',
          costPrice: Number(rp.cost_price ?? rp.costPrice ?? 0),
          retailPrice: Number(rp.retail_price ?? rp.retailPrice ?? rp.store_price ?? 0),
          wholesalePrice: Number(rp.wholesale_price ?? rp.wholesalePrice ?? 0),
          storePrice: Number(rp.store_price ?? rp.storePrice ?? rp.retail_price ?? 0),
          currentStock: Number(rp.current_stock ?? rp.currentStock ?? 1),
          imageUrl: rp.image_url || rp.imageUrl || undefined,
          storeDescription: rp.store_description || rp.storeDescription || '',
          availableColors: rp.available_colors || [],
          availableSizes: rp.available_sizes || [],
          inStore: true,
          isPublishedInStore: rp.status !== 'rejected',
          isMarketplaceApproved: rp.status === 'approved',
          isActive: true,
          input: {} as any,
          output: { finalSellingPrice: Number(rp.store_price ?? rp.retail_price ?? 0) } as any,
          createdAt: typeof rp.created_at === 'number' ? rp.created_at : Date.parse(String(rp.created_at || '')) || Date.now(),
          updatedAt: typeof rp.updated_at === 'number' ? rp.updated_at : Date.parse(String(rp.updated_at || '')) || Date.now(),
        };
        await tenantStorage.applyRemoteProduct(recovered);
        pulled++;
      }
    }
  } catch (err) {
    console.warn('[syncAllWorkshopProductsAndStore] store reconcile notice:', err);
  }

  // 3. Flush queued offline mutations (including any fallback marketplace_publish mutations)
  await flushOfflineMutations().catch(() => {});

  if (pulled > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PRODUCTS_PULLED_EVENT, { detail: { workshopId, changed: pulled } }));
    window.dispatchEvent(new CustomEvent('alshams_products_changed', { detail: { tenantId: workshopId, workshopId } }));
  }

  const pendingRemaining = pendingCount(workshopId) + getPendingOfflineMutationsCount(workshopId);
  return { pushedCatalog, pushedStore, pulled, pendingRemaining };
}

export function startProductSync(workshopId: string): () => void {
  if (!workshopId || typeof window === 'undefined') return () => {};
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  let fullTimer: ReturnType<typeof setTimeout> | undefined;

  const pushSoon = (ms = 2000) => {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => flushProductSync(workshopId).catch(() => {}), ms);
  };

  const syncSoon = (ms = 500) => {
    clearTimeout(fullTimer);
    fullTimer = setTimeout(() => syncProductsNow(workshopId).catch(() => {}), ms);
  };

  const onDirty = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (!d?.workshopId || d.workshopId === workshopId) pushSoon();
  };

  const onOnline = () => syncSoon(500);
  const onOffline = () => emitSyncStatus(workshopId, 'offline', pendingCount(workshopId));
  const onVisible = () => {
    if (document.visibilityState === 'visible') syncSoon(500);
  };

  window.addEventListener(PRODUCTS_DIRTY_EVENT, onDirty);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);

  let tick = 0;
  const interval = setInterval(() => {
    tick++;
    if (pendingCount(workshopId) > 0) flushProductSync(workshopId).catch(() => {});
    if (tick % 2 === 0 && document.visibilityState === 'visible') pullProductsFromCloud(workshopId).catch(() => {});
  }, 30_000);

  const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') syncSoon(500);
    // Ignore TOKEN_REFRESHED entirely to avoid product sync loops on silent token renewal.
  });

  let channel: any = null;
  try {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    channel = supabase
      .channel(`products-sync-${workshopId}-${uniqueSuffix}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'products', filter: `workshop_id=eq.${workshopId}` },
        () => {
          clearTimeout(fullTimer);
          fullTimer = setTimeout(() => pullProductsFromCloud(workshopId).catch(() => {}), 1000);
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('[productsCloud] realtime unavailable, using polling:', err);
  }

  pullProductsFromCloud(workshopId)
    .catch(() => 0)
    .then(() => enqueueExistingOnce(workshopId))
    .catch(() => {})
    .finally(() => pushSoon(300));

  return () => {
    clearTimeout(pushTimer);
    clearTimeout(fullTimer);
    clearInterval(interval);
    window.removeEventListener(PRODUCTS_DIRTY_EVENT, onDirty);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    authSub?.subscription?.unsubscribe();
    if (channel) supabase.removeChannel(channel).catch(() => {});
  };
}
