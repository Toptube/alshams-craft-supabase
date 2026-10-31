/**
 * آلية المزامنة الدورية الهادئة في الخلفية — كل 30 دقيقة
 * تقوم بمطابقة بيانات الورشة (الخامات، المنتجات، المبيعات) مع جداول Supabase
 * لضمان تحديث الأرصدة بدون أي تعطيل أو إشغال للفنان أثناء عمله.
 */

import { supabase } from '../lib/supabase';
import { db, tenantStorage } from '../db/dexieDB';
import { flushProductSync, pullProductsFromCloud } from '../db/productsCloud';
import { getMaterialsFromSupabase, getTreasuryBalancesFromSupabase } from '../db/supabaseService';
import type { UserProfile } from '../types';

export const QUIET_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 دقيقة

let syncTimer: any = null;
let isSyncRunning = false;

/**
 * تنفيذ دورة مزامنة هادئة واحدة بدون إزعاج أو تنبيهات معطلة
 */
export async function performQuietSync(profile: UserProfile): Promise<void> {
  const workshopId = profile.tenantId || profile.workshopId || profile.id;
  if (
    !workshopId ||
    workshopId === 'workshop_demo' ||
    workshopId === '00000000-0000-0000-0000-000000000000'
  ) {
    return;
  }
  if (isSyncRunning) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  isSyncRunning = true;
  try {
    // 1. مزامنة المنتجات والكتالوج (رفع التعديلات المعلقة وسحب أي إضافات جديدة)
    await Promise.allSettled([
      flushProductSync(workshopId),
      pullProductsFromCloud(workshopId),
    ]);

    // 2. مطابقة وتحديث أرصدة وأسعار الخامات من Supabase
    try {
      const { data: remoteMaterials, error: matErr } = await getMaterialsFromSupabase(workshopId);
      if (!matErr && Array.isArray(remoteMaterials) && remoteMaterials.length > 0) {
        for (const rm of remoteMaterials) {
          const localMat = await db.rawMaterials.get(rm.id);
          if (localMat) {
            await tenantStorage.saveRawMaterial({
              ...localMat,
              materialName: rm.name || localMat.materialName,
              costPerUnit: Number(rm.purchase_price ?? localMat.costPerUnit),
              updatedAt: Date.now(),
            });
          }
        }
      }
    } catch {
      // هادئ تماماً
    }

    // 3. مطابقة المبيعات والأوردرات وتحديث الحالات والمقبوضات
    try {
      const { data: remoteOrders, error: ordErr } = await supabase
        .from('orders')
        .select('*')
        .eq('workshop_id', workshopId);

      if (!ordErr && Array.isArray(remoteOrders) && remoteOrders.length > 0) {
        for (const ro of remoteOrders) {
          const localOrder = await db.orders.get(ro.id);
          if (localOrder) {
            await tenantStorage.saveOrder({
              ...localOrder,
              status: ro.status || localOrder.status,
              paidAmount: Number(ro.paid_amount ?? localOrder.paidAmount),
              remainingAmount: Number(ro.remaining_amount ?? localOrder.remainingAmount),
              totalAmount: Number(ro.total_amount ?? localOrder.totalAmount),
              updatedAt: Date.now(),
            });
          }
        }
      }
    } catch {
      // هادئ تماماً
    }

    // 4. مطابقة أرصدة الخزن والسيولة الفعلية
    try {
      await getTreasuryBalancesFromSupabase(workshopId);
    } catch {
      // هادئ تماماً
    }
  } catch (err) {
    console.debug('[Quiet Sync Notice]', err);
  } finally {
    isSyncRunning = false;
  }
}

/**
 * بدء دورة المزامنة الدورية كل 30 دقيقة مع مستمع فوري لعودة الإنترنت
 */
export function startQuietBackgroundSync(profile: UserProfile): () => void {
  stopQuietBackgroundSync();

  // تشغيل أولي هادئ بعد 8 ثوانٍ من استقرار تشغيل التطبيق
  const initialTimeout = setTimeout(() => {
    performQuietSync(profile);
  }, 8000);

  // تكرار دوري كل 30 دقيقة
  syncTimer = setInterval(() => {
    performQuietSync(profile);
  }, QUIET_SYNC_INTERVAL_MS);

  // مستمع فوري لعودة الإنترنت: تشغيل مزامنة تلقائية لحظية دون انتظار الدورة
  let onlineTimeout: any = null;
  const handleOnline = () => {
    // مهلة قصيرة (1.5 ثانية) لضمان استقرار قنوات الاتصال بالشبكة
    if (onlineTimeout) clearTimeout(onlineTimeout);
    onlineTimeout = setTimeout(() => {
      performQuietSync(profile).catch(() => {});
    }, 1500);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
  }

  return () => {
    clearTimeout(initialTimeout);
    if (onlineTimeout) {
      clearTimeout(onlineTimeout);
      onlineTimeout = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
    }
    stopQuietBackgroundSync();
  };
}

/**
 * إطلاق مزامنة فورية مباشرة عند الطلب
 */
export async function triggerInstantSync(profile: UserProfile): Promise<void> {
  return performQuietSync(profile);
}

/**
 * إيقاف دورة المزامنة عند تسجيل الخروج
 */
export function stopQuietBackgroundSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

