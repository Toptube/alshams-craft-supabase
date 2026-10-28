/**
 * طابور مزامنة المنتجات (Outbox) — محفوظ على جهاز الفنان.
 *
 * أي حفظ/تعديل/حذف لمنتج بيتسجّل هنا فوراً حتى لو مفيش نت.
 * productsCloud.ts بيفضّي الطابور ويرفع للداتا بيز أول ما النت يرجع.
 * الملف ده من غير أي import عشان dexieDB يقدر يستخدمه من غير دوائر استيراد.
 */

const KEY = 'alshams_products_outbox_v1';
export const PRODUCTS_DIRTY_EVENT = 'alshams:products-dirty';
export const PRODUCTS_SYNC_EVENT = 'alshams:products-sync-status';
export const PRODUCTS_PULLED_EVENT = 'alshams:products-pulled';

export interface PendingEntry {
  queuedAt: number;
  primaryMaterialName?: string;
}
type Outbox = Record<string, Record<string, PendingEntry>>; // workshopId -> productId -> entry

function read(): Outbox {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Outbox) : {};
  } catch {
    return {};
  }
}

function write(box: Outbox): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(box));
  } catch {
    /* localStorage غير متاح */
  }
}

function emit(name: string, detail: any): void {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    /* SSR / بيئة من غير window */
  }
}

/** علّم منتج إنه محتاج يترفع (بيتنادى تلقائياً من dexieDB مع كل حفظ) */
export function markProductDirty(workshopId: string, productId: string, primaryMaterialName?: string): void {
  if (!workshopId || !productId) return;
  const box = read();
  const ws = (box[workshopId] ||= {});
  const prev = ws[productId];
  ws[productId] = {
    queuedAt: Date.now(),
    primaryMaterialName: primaryMaterialName || prev?.primaryMaterialName,
  };
  write(box);
  emit(PRODUCTS_DIRTY_EVENT, { workshopId, productId });
}

export function markManyDirty(workshopId: string, productIds: string[]): void {
  if (!workshopId || productIds.length === 0) return;
  const box = read();
  const ws = (box[workshopId] ||= {});
  const now = Date.now();
  for (const id of productIds) ws[id] = { queuedAt: now, primaryMaterialName: ws[id]?.primaryMaterialName };
  write(box);
  emit(PRODUCTS_DIRTY_EVENT, { workshopId });
}

export function getPending(workshopId: string): Record<string, PendingEntry> {
  return { ...(read()[workshopId] || {}) };
}

export function pendingCount(workshopId: string): number {
  return Object.keys(read()[workshopId] || {}).length;
}

export function isPending(workshopId: string, productId: string): boolean {
  return !!read()[workshopId]?.[productId];
}

/**
 * شيل المنتجات اللي اترفعت — بس لو ما اتعدلتش تاني أثناء الرفع
 * (لو queuedAt اتغير يبقى فيه تعديل أحدث ولازم يترفع هو كمان).
 */
export function clearPending(workshopId: string, snapshot: Record<string, PendingEntry>): void {
  const box = read();
  const ws = box[workshopId];
  if (!ws) return;
  for (const [id, entry] of Object.entries(snapshot)) {
    if (ws[id] && ws[id].queuedAt === entry.queuedAt) delete ws[id];
  }
  if (Object.keys(ws).length === 0) delete box[workshopId];
  write(box);
}

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';
export function emitSyncStatus(workshopId: string, state: SyncState, pending: number): void {
  emit(PRODUCTS_SYNC_EVENT, { workshopId, state, pending });
}
