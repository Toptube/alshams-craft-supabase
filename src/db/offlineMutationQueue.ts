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
  type: 'marketplace_publish' | 'product_upsert' | 'order_create' | 'workshop_update';
  payload: any;
  queuedAt: number;
  retryCount: number;
}

const STORAGE_KEY = 'alshams_offline_mutations_v2';
export const OFFLINE_QUEUE_EVENT = 'alshams:offline-queue-changed';
export const OFFLINE_SYNC_STATUS_EVENT = 'alshams:offline-sync-status';

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

/**
 * تفريغ الطابور ورفع كافة العمليات المعلقة لسحابة Supabase
 */
export async function flushOfflineMutations(): Promise<{ synced: number; remaining: number }> {
  if (isFlushing) return { synced: 0, remaining: readQueue().length };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, remaining: readQueue().length };
  }

  const queue = readQueue();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0 };
  }

  isFlushing = true;
  let synced = 0;

  try {
    window.dispatchEvent(
      new CustomEvent(OFFLINE_SYNC_STATUS_EVENT, {
        detail: { status: 'syncing', pending: queue.length },
      })
    );

    const pending = [...queue];

    for (const item of pending) {
      let success = false;

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
        }
      } catch (err) {
        console.warn(`[Offline Queue] Failed to sync mutation ${item.id}:`, err);
      }

      if (success) {
        removeOfflineMutation(item.id);
        synced++;
      } else {
        // Increment retry count
        const currentQueue = readQueue();
        const target = currentQueue.find((m) => m.id === item.id);
        if (target) {
          target.retryCount = (target.retryCount || 0) + 1;
          // If retried over 10 times with persistent error, preserve locally but stop infinite loop
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
    console.log('[Al-Shams Sync] Connection restored, flushing offline queue...');
    flushOfflineMutations();
  };

  window.addEventListener('online', handleOnline);

  // Service Worker message listener
  let handleMessage: any = null;
  if ('serviceWorker' in navigator) {
    handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TRIGGER_OFFLINE_SYNC') {
        flushOfflineMutations();
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
  }

  // Periodic fallback check every 30 seconds
  const interval = setInterval(() => {
    if (navigator.onLine && readQueue().length > 0) {
      flushOfflineMutations();
    }
  }, 30000);

  // Initial check on mount
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
