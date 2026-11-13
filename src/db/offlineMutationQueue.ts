/**
 * طابور العمليات غير المتصلة (Offline Mutation Queue) لمنظومة الشمساوية
 *
 * يقوم بحفظ كافة عمليات الإضافة والتعديل والنشر محلياً (localStorage & IndexedDB)
 * عند انقطاع الإنترنت أو بطء الشبكة، وتفريغها تلقائياً ورفعها لسحابة Supabase
 * فور عودة الاتصال أو من خلال Service Worker Background Sync.
 */

import { supabase } from '../lib/supabase';

export interface OfflineMutation {
  id: string;
  workshopId: string;
  type:
    | 'marketplace_publish'
    | 'product_upsert'
    | 'order_create'
    | 'workshop_update'
    | 'workshop_order_upsert'
    | 'unit_upsert'
    | 'material_upsert'
    | 'customer_upsert'
    | 'supplier_upsert'
    | 'employee_upsert'
    | 'work_order_upsert'
    | 'supplier_invoice_upsert'
    | 'expense_upsert';
  payload: any;
  queuedAt: number;
  retryCount: number;
}

const STORAGE_KEY = 'alshams_offline_mutations_v2';
export const OFFLINE_QUEUE_EVENT = 'alshams:offline-queue-changed';
export const OFFLINE_SYNC_STATUS_EVENT = 'alshams:offline-sync-status';

function isValidCloudWorkshopId(workshopId?: string): boolean {
  return Boolean(
    workshopId &&
      workshopId !== 'default' &&
      workshopId !== 'central' &&
      workshopId !== 'workshop_demo' &&
      workshopId !== '00000000-0000-0000-0000-000000000000'
  );
}

function readQueue(): OfflineMutation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: OfflineMutation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(
      new CustomEvent(OFFLINE_QUEUE_EVENT, {
        detail: { pendingCount: queue.length },
      })
    );
  } catch (e) {
    console.warn('[Offline Queue] write error:', e);
  }
}

/**
 * إضافة عملية للطابور المحلي فورياً
 */
export function enqueueOfflineMutation(
  mutation: Omit<OfflineMutation, 'id' | 'queuedAt' | 'retryCount'>
): OfflineMutation {
  const queue = readQueue();
  const newMutation: OfflineMutation = {
    ...mutation,
    id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    queuedAt: Date.now(),
    retryCount: 0,
  };

  // Prevent duplicate operations for same entity if pending
  const existingIndex = queue.findIndex(
    (m) => m.type === newMutation.type && m.payload?.id && m.payload.id === newMutation.payload?.id
  );

  if (existingIndex >= 0) {
    queue[existingIndex] = newMutation;
  } else {
    queue.push(newMutation);
  }

  writeQueue(queue);

  // Try registering background sync if supported
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then((reg: any) => {
        if (reg?.sync?.register) {
          return reg.sync.register('alshams-background-sync');
        }
      })
      .catch(() => {});
  }

  return newMutation;
}

/**
 * استرجاع العمليات المعلقة
 */
export function getOfflineMutations(workshopId?: string): OfflineMutation[] {
  const all = readQueue();
  if (!workshopId) return all;
  return all.filter((m) => m.workshopId === workshopId);
}

/**
 * عدد العمليات المعلقة في الطابور
 */
export function getPendingOfflineMutationsCount(workshopId?: string): number {
  return getOfflineMutations(workshopId).length;
}

/**
 * حذف عملية بعد نجاح الرفع
 */
export function removeOfflineMutation(id: string): void {
  const queue = readQueue().filter((m) => m.id !== id);
  writeQueue(queue);
}

let isFlushing = false;

const MUTATION_PRIORITY: Record<OfflineMutation['type'], number> = {
  workshop_update: 1,
  unit_upsert: 2,
  supplier_upsert: 3,
  customer_upsert: 3,
  employee_upsert: 3,
  material_upsert: 4,
  product_upsert: 4,
  work_order_upsert: 5,
  workshop_order_upsert: 5,
  supplier_invoice_upsert: 5,
  expense_upsert: 5,
  marketplace_publish: 6,
  order_create: 6,
};

/**
 * تفريغ الطابور ورفع كافة العمليات المعلقة لسحابة Supabase
 */
export async function flushOfflineMutations(): Promise<{ synced: number; remaining: number }> {
  if (isFlushing) return { synced: 0, remaining: readQueue().length };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, remaining: readQueue().length };
  }

  const queue = readQueue();
  const pending = queue
    .filter((item) => (item.retryCount || 0) < 12)
    .sort((a, b) => {
      const pa = MUTATION_PRIORITY[a.type] ?? 10;
      const pb = MUTATION_PRIORITY[b.type] ?? 10;
      if (pa !== pb) return pa - pb;
      return (a.queuedAt || 0) - (b.queuedAt || 0);
    });
  if (pending.length === 0) {
    return { synced: 0, remaining: queue.length };
  }

  isFlushing = true;
  let synced = 0;

  try {
    // Ensure fresh auth token if available before flushing protected RLS rows
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const exp = sessionData?.session?.expires_at;
      if (sessionData?.session && exp && exp * 1000 - Date.now() < 60_000) {
        await supabase.auth.refreshSession().catch(() => {});
      }
    } catch {}

    window.dispatchEvent(
      new CustomEvent(OFFLINE_SYNC_STATUS_EVENT, {
        detail: { status: 'syncing', pending: pending.length },
      })
    );

    for (const item of pending) {
      let success = false;
      const wid = item.workshopId || item.payload?.workshop_id;

      // Skip synthetic local-only demo workspaces gracefully
      if (!isValidCloudWorkshopId(wid) && item.type !== 'order_create') {
        removeOfflineMutation(item.id);
        continue;
      }

      try {
        if (item.type === 'marketplace_publish') {
          const { error } = await supabase
            .from('marketplace_products')
            .upsert(item.payload, { onConflict: 'id' });
          if (!error) success = true;
        } else if (item.type === 'product_upsert') {
          const { error } = await supabase
            .from('products')
            .upsert(item.payload, { onConflict: 'id' });
          if (!error) success = true;
        } else if (item.type === 'order_create') {
          const { error } = await supabase
            .from('marketplace_orders')
            .upsert(item.payload, { onConflict: 'id' });
          if (!error) success = true;
        } else if (item.type === 'workshop_update') {
          const { error } = await supabase
            .from('workshops')
            .upsert(item.payload, { onConflict: 'id' });
          if (!error) success = true;
        } else if (item.type === 'workshop_order_upsert') {
          const { error } = await supabase
            .from('orders')
            .upsert(item.payload, { onConflict: 'id' });
          if (!error) success = true;
        } else if (item.type === 'unit_upsert') {
          const { error } = await supabase
            .from('units')
            .upsert(item.payload, { onConflict: 'id' });
          if (!error) success = true;
        } else if (item.type === 'customer_upsert') {
          const { error } = await supabase
            .from('customers')
            .upsert(item.payload, { onConflict: 'id' });
          if (!error) success = true;
        } else if (item.type === 'supplier_upsert') {
          const { error } = await supabase
            .from('suppliers')
            .upsert(item.payload, { onConflict: 'id' });
          if (!error) success = true;
        } else if (item.type === 'employee_upsert') {
          const { error } = await supabase
            .from('employees')
            .upsert(item.payload, { onConflict: 'id' });
          if (!error) success = true;
        } else if (item.type === 'work_order_upsert') {
          const { error } = await supabase
            .from('work_orders')
            .upsert(item.payload, { onConflict: 'id' });
          if (!error) success = true;
        } else if (item.type === 'supplier_invoice_upsert') {
          const { error } = await supabase
            .from('supplier_invoices')
            .upsert(item.payload, { onConflict: 'id' });
          if (!error) success = true;
        } else if (item.type === 'expense_upsert') {
          const { error } = await supabase
            .from('expenses')
            .upsert(item.payload, { onConflict: 'id' });
          if (!error) success = true;
        } else if (item.type === 'material_upsert') {
          if (item.payload?.unit_id) {
            const { error } = await supabase
              .from('materials')
              .upsert(item.payload, { onConflict: 'id' });
            if (!error) success = true;
          } else if (item.payload?.id && wid) {
            const { error } = await supabase
              .from('materials')
              .update({
                name: item.payload.name,
                purchase_price: item.payload.purchase_price,
                current_stock: item.payload.current_stock,
                min_limit: item.payload.min_limit,
              })
              .eq('id', item.payload.id)
              .eq('workshop_id', wid);
            if (!error) success = true;
          }
        }
      } catch (err) {
        console.warn(`[Offline Queue] Failed to sync mutation ${item.id}:`, err);
      }

      if (success) {
        removeOfflineMutation(item.id);
        synced++;
      } else {
        const currentQueue = readQueue();
        const target = currentQueue.find((m) => m.id === item.id);
        if (target) {
          target.retryCount = (target.retryCount || 0) + 1;
          writeQueue(currentQueue);
        }
      }
    }
  } finally {
    isFlushing = false;
    const remaining = readQueue().length;
    window.dispatchEvent(
      new CustomEvent(OFFLINE_SYNC_STATUS_EVENT, {
        detail: { status: remaining === 0 ? 'idle' : 'error', pending: remaining },
      })
    );
  }

  return { synced, remaining: readQueue().length };
}

/**
 * تفعيل مستمعي الشبكة والمزامنة التلقائية
 */
let listenersInitialized = false;
export function initOfflineSyncListeners(): () => void {
  if (typeof window === 'undefined' || listenersInitialized) return () => {};
  listenersInitialized = true;

  const handleOnline = () => {
    // Reset transient retry counts on reconnect so queued items retry cleanly
    const current = readQueue();
    if (current.some((m) => m.retryCount > 0)) {
      writeQueue(current.map((m) => ({ ...m, retryCount: 0 })));
    }
    flushOfflineMutations();
  };

  window.addEventListener('online', handleOnline);

  let handleMessage: any = null;
  if ('serviceWorker' in navigator) {
    handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TRIGGER_OFFLINE_SYNC') {
        flushOfflineMutations();
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
  }

  const interval = setInterval(() => {
    if (navigator.onLine && readQueue().length > 0) {
      flushOfflineMutations();
    }
  }, 20000);

  if (navigator.onLine && readQueue().length > 0) {
    setTimeout(flushOfflineMutations, 1000);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    if (handleMessage && 'serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
    clearInterval(interval);
    listenersInitialized = false;
  };
}
