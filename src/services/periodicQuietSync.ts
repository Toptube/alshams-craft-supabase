/**
 * آلية المزامنة الدورية الهادئة في الخلفية — كل 30 دقيقة
 * تقوم بمطابقة بيانات الورشة (الخامات، المنتجات، المبيعات) مع جداول Supabase
 * لضمان تحديث الأرصدة بدون أي تعطيل أو إشغال للفنان أثناء عمله.
 */

import { supabase } from '../lib/supabase';
import { db, tenantStorage } from '../db/dexieDB';
import { flushProductSync, pullProductsFromCloud } from '../db/productsCloud';
import { flushOfflineMutations } from '../db/offlineMutationQueue';
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
    // 1. رفع أي تعديلات أو عمليات مسجلة أثناء انقطاع الإنترنت + مزامنة المنتجات
    await Promise.allSettled([
      flushOfflineMutations(),
      flushProductSync(workshopId),
    ]);
    await pullProductsFromCloud(workshopId).catch(() => {});

    // 2. مطابقة وتحديث أرصدة وأسعار الخامات من Supabase
    try {
      const { data: remoteMaterials, error: matErr } = await getMaterialsFromSupabase(workshopId);
      if (!matErr && Array.isArray(remoteMaterials) && remoteMaterials.length > 0) {
        for (const rm of remoteMaterials as any[]) {
          const localMat = await db.rawMaterials.get(rm.id);
          if (localMat) {
            await tenantStorage.saveRawMaterial(
              {
                ...localMat,
                materialName: rm.name || localMat.materialName,
                costPerUnit: Number(rm.purchase_price ?? localMat.costPerUnit),
                currentStock:
                  rm.current_stock !== undefined && rm.current_stock !== null
                    ? Number(rm.current_stock)
                    : localMat.currentStock,
                minAlertThreshold:
                  rm.min_limit !== undefined && rm.min_limit !== null
                    ? Number(rm.min_limit)
                    : localMat.minAlertThreshold,
                updatedAt: Date.now(),
              },
              { skipCloudQueue: true }
            );
          }
        }
      }
    } catch {
      // هادئ تماماً
    }

    // 3. مطابقة المبيعات والأوردرات وتحديث الحالات والمقبوضات
    try {
      let remoteOrders: any[] = [];
      const { data: ordData, error: ordErr } = await supabase
        .from('orders')
        .select('*')
        .eq('workshop_id', workshopId);

      if (!ordErr && Array.isArray(ordData)) {
        remoteOrders = ordData;
      }

      const { data: mktData, error: mktErr } = await supabase
        .from('marketplace_orders')
        .select('*')
        .eq('workshop_id', workshopId);

      if (!mktErr && Array.isArray(mktData)) {
        remoteOrders = [...remoteOrders, ...mktData];
      }

      if (remoteOrders.length > 0) {
        for (const ro of remoteOrders) {
          const localOrder = await db.orders.get(ro.id);
          if (localOrder) {
            await db.orders.put({
              ...localOrder,
              status: ro.status || localOrder.status,
              paidAmount: Number(ro.paid_amount ?? ro.amount_paid ?? ro.deposit_paid ?? localOrder.paidAmount),
              remainingAmount: Number(ro.remaining_amount ?? localOrder.remainingAmount),
              totalAmount: Number(ro.total_amount ?? ro.final_total ?? localOrder.totalAmount),
              updatedAt: Date.now(),
            });
          }
        }
      }
    } catch {
      // هادئ تماماً
    }

    // 4. مطابقة العملاء والموردين وأوامر التشغيل والموظفين بصمت
    try {
      const [custRes, supRes, woRes, empRes] = await Promise.all([
        supabase.from('customers').select('*').eq('workshop_id', workshopId),
        supabase.from('suppliers').select('*').eq('workshop_id', workshopId),
        supabase.from('work_orders').select('*').eq('workshop_id', workshopId),
        supabase.from('employees').select('*').eq('workshop_id', workshopId),
      ]);

      if (!custRes.error && Array.isArray(custRes.data)) {
        for (const rc of custRes.data as any[]) {
          const exists = await db.customers.get(rc.id);
          if (!exists) {
            await tenantStorage.saveCustomer(
              {
                id: rc.id,
                tenantId: workshopId,
                workshopId,
                fullName: rc.full_name || rc.name || 'عميل',
                name: rc.name || rc.full_name || 'عميل',
                phoneNumber: rc.phone_number || rc.phone || '',
                phone: rc.phone || rc.phone_number || '',
                city: rc.city || '',
                address: rc.address || '',
                notes: rc.notes || '',
                totalPurchases: Number(rc.total_purchases || 0),
                outstandingBalance: Number(rc.outstanding_balance || 0),
                createdAt: Date.now(),
                updatedAt: Date.now(),
              } as any,
              { skipCloudQueue: true }
            );
          }
        }
      }

      if (!supRes.error && Array.isArray(supRes.data)) {
        for (const rs of supRes.data as any[]) {
          const exists = await db.suppliers.get(rs.id);
          if (!exists) {
            await tenantStorage.saveSupplier(
              {
                id: rs.id,
                tenantId: workshopId,
                workshopId,
                name: rs.name || rs.company_name || 'مورد',
                companyName: rs.company_name || rs.name || '',
                phoneNumber: rs.phone_number || rs.phone || '',
                phone: rs.phone || rs.phone_number || '',
                address: rs.address || '',
                materialSpecialty: rs.material_specialty || '',
                outstandingBalance: Number(rs.outstanding_balance || 0),
                notes: rs.notes || '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              } as any,
              { skipCloudQueue: true }
            );
          }
        }
      }

      if (!woRes.error && Array.isArray(woRes.data)) {
        for (const rw of woRes.data as any[]) {
          const exists = await db.workOrders.get(rw.id);
          if (!exists) {
            await tenantStorage.saveWorkOrder(
              {
                id: rw.id,
                tenantId: workshopId,
                workshopId,
                orderNumber: rw.order_number,
                productName: rw.product_name,
                craftId: rw.craft_id,
                category: rw.category,
                targetQuantity: Number(rw.target_quantity || 1),
                status: rw.status || 'pending',
                assignedEmployeeId: rw.assigned_employee_id,
                assignedEmployeeName: rw.assigned_employee_name,
                assignedEmployeeWage: Number(rw.assigned_employee_wage || 0),
                pulledMaterials: rw.pulled_materials || [],
                returnedMaterials: rw.returned_materials || [],
                scrapItems: rw.scrap_items || [],
                finishedProductsProduced: Number(rw.finished_products_produced || 0),
                totalConsumedMaterialsCost: Number(rw.total_consumed_materials_cost || 0),
                totalLaborCost: Number(rw.total_labor_cost || 0),
                totalProductionCost: Number(rw.total_production_cost || 0),
                unitCostCalculated: Number(rw.unit_cost_calculated || 0),
                startDate: rw.start_date,
                notes: rw.notes || '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              } as any,
              { skipCloudQueue: true }
            );
          }
        }
      }

      if (!empRes.error && Array.isArray(empRes.data)) {
        for (const re of empRes.data as any[]) {
          const exists = await db.employees.get(re.id);
          if (!exists) {
            await tenantStorage.saveEmployee(
              {
                id: re.id,
                tenantId: workshopId,
                workshopId,
                fullName: re.full_name || 'عامل',
                role: re.role || 'artisan',
                phone: re.phone || re.phone_number || '',
                phoneNumber: re.phone_number || re.phone || '',
                baseWage: Number(re.base_wage || 0),
                wageType: re.wage_type || 'piece_rate',
                currentBalance: Number(re.current_balance || 0),
                totalEarned: Number(re.total_earned || 0),
                totalPaid: Number(re.total_paid || 0),
                isActive: re.is_active !== false,
                notes: re.notes || '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              } as any,
              { skipCloudQueue: true }
            );
          }
        }
      }
    } catch {
      // هادئ تماماً
    }

    // 5. مطابقة أرصدة الخزن والسيولة الفعلية
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

  // تشغيل أولي هادئ بعد 5 ثوانٍ من استقرار تشغيل التطبيق
  const initialTimeout = setTimeout(() => {
    performQuietSync(profile);
  }, 5000);

  // تكرار دوري كل 30 دقيقة
  syncTimer = setInterval(() => {
    performQuietSync(profile);
  }, QUIET_SYNC_INTERVAL_MS);

  // مستمع فوري لعودة الإنترنت: تشغيل مزامنة تلقائية لحظية دون انتظار الدورة
  let onlineTimeout: any = null;
  const handleOnline = () => {
    // تفريغ فوري للطابور المحلي عند عودة الإنترنت
    flushOfflineMutations().catch(() => {});
    if (onlineTimeout) clearTimeout(onlineTimeout);
    onlineTimeout = setTimeout(() => {
      performQuietSync(profile).catch(() => {});
    }, 1000);
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

