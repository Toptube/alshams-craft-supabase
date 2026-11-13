/**
 * آلية المزامنة الدورية الهادئة في الخلفية — كل 30 دقيقة
 * تقوم بمطابقة بيانات الورشة (الخامات، المنتجات، المبيعات) مع جداول Supabase
 * لضمان تحديث الأرصدة بدون أي تعطيل أو إشغال للفنان أثناء عمله.
 */

import { supabase } from '../lib/supabase';
import { db, tenantStorage } from '../db/dexieDB';
import { flushProductSync, pullProductsFromCloud } from '../db/productsCloud';
import { PRODUCTS_PULLED_EVENT } from '../db/productSyncQueue';
import { fetchWorkshopMarketplaceProducts } from '../db/marketplaceCloud';
import { flushOfflineMutations } from '../db/offlineMutationQueue';
import { getMaterialsFromSupabase, getTreasuryBalancesFromSupabase } from '../db/supabaseService';
import type { SavedProductRecord, UserProfile } from '../types';

export const QUIET_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 دقيقة

let syncTimer: any = null;
let isSyncRunning = false;

function mapCloudCatalogRowToLocal(row: any, workshopId: string): SavedProductRecord {
  const lr = row.local_record && typeof row.local_record === 'object' ? { ...row.local_record } : {};
  const specs = row.specs && typeof row.specs === 'object' ? row.specs : {};
  const mktStatus = row.marketplace_status || row.status;
  return {
    ...lr,
    id: row.id,
    tenantId: workshopId,
    workshopId,
    productName: lr.productName || row.product_name || row.name || 'منتج حرفي',
    productCode: lr.productCode ?? row.product_code ?? undefined,
    productSerialNumber: lr.productSerialNumber ?? row.serial_number ?? undefined,
    category: (lr.category || row.category || 'macrame') as any,
    productType: lr.productType ?? row.product_type ?? undefined,
    craftName: lr.craftName ?? row.craft_name ?? row.category ?? undefined,
    mainSectionName: lr.mainSectionName ?? row.main_section ?? undefined,
    costPrice: Number(lr.costPrice ?? row.cost_price ?? 0),
    retailPrice: Number(lr.retailPrice ?? row.retail_price ?? row.store_price ?? 0),
    wholesalePrice: Number(lr.wholesalePrice ?? row.wholesale_price ?? 0),
    storePrice: Number(lr.storePrice ?? row.store_price ?? row.retail_price ?? 0),
    currentStock: Number(lr.currentStock ?? row.current_stock ?? row.stock_quantity ?? 1),
    storeDescription:
      lr.storeDescription ??
      row.store_description ??
      specs.marketingDescription ??
      specs.materialsDescription ??
      '',
    availableColors: Array.isArray(lr.availableColors)
      ? lr.availableColors
      : Array.isArray(row.available_colors)
      ? row.available_colors
      : [],
    availableSizes: Array.isArray(lr.availableSizes)
      ? lr.availableSizes
      : Array.isArray(row.available_sizes)
      ? row.available_sizes
      : [],
    inStore: lr.inStore !== undefined ? Boolean(lr.inStore) : row.in_store !== false,
    isPublishedInStore:
      lr.isPublishedInStore !== undefined
        ? Boolean(lr.isPublishedInStore)
        : mktStatus !== 'rejected',
    isMarketplaceApproved:
      mktStatus === 'approved' ? true : Boolean(lr.isMarketplaceApproved),
    imageUrl: lr.imageUrl || row.image_url || undefined,
    isActive: row.is_active !== false,
    input: lr.input || {
      category: row.category || 'macrame',
      shape3D: specs.shape,
      widthCm: specs.widthCm,
      totalLengthCm: specs.totalLengthCm,
      diameterCm: specs.diameterCm,
      fringeLengthCm: specs.fringeLengthCm,
      cordThicknessMm: specs.cordThicknessMm,
      personalNotes: specs.notes || '',
      extraMaterials: [],
    },
    output: lr.output || {
      totalWeightGrams: specs.totalWeightGrams,
      totalYarnLengthMeters: specs.totalYarnLengthMeters,
      finalSellingPrice: Number(row.retail_price ?? row.store_price ?? 0),
    },
    createdAt:
      typeof row.created_at === 'number'
        ? row.created_at
        : Date.parse(String(row.created_at || '')) || lr.createdAt || Date.now(),
    updatedAt:
      typeof row.updated_at === 'number'
        ? row.updated_at
        : Date.parse(String(row.updated_at || '')) || lr.updatedAt || Date.now(),
  } as SavedProductRecord;
}

/**
 * سحب وحقن كافة بيانات الورشة السحابية داخل Dexie المحلي (يُستخدم عند الدخول للورشة كسوبر أدمن أو فتح جهاز جديد)
 */
export async function hydrateWorkshopIntoDexie(
  workshopId: string,
  options?: { asSuperAdmin?: boolean; userEmail?: string }
): Promise<{ productsCount: number; materialsCount: number; ordersCount: number }> {
  if (!workshopId || workshopId === 'workshop_demo' || workshopId === '00000000-0000-0000-0000-000000000000') {
    return { productsCount: 0, materialsCount: 0, ordersCount: 0 };
  }

  let productsRows: any[] = [];
  let marketplaceRows: any[] = [];
  let materialsRows: any[] = [];
  let ordersRows: any[] = [];
  let customersRows: any[] = [];
  let suppliersRows: any[] = [];
  let employeesRows: any[] = [];
  let workOrdersRows: any[] = [];

  if (options?.asSuperAdmin) {
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const token = sessData?.session?.access_token;
      const res = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/deep-data`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': options.userEmail || 'hmb.top.tube@gmail.com',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) productsRows = data.products;
        if (Array.isArray(data.marketplaceProducts)) marketplaceRows = data.marketplaceProducts;
        if (Array.isArray(data.materials)) materialsRows = data.materials;
        if (Array.isArray(data.orders)) ordersRows = data.orders;
        if (Array.isArray(data.customers)) customersRows = data.customers;
        if (Array.isArray(data.suppliers)) suppliersRows = data.suppliers;
        if (Array.isArray(data.employees)) employeesRows = data.employees;
        if (Array.isArray(data.workOrders)) workOrdersRows = data.workOrders;
      }
    } catch {}
  }

  // Fallback / supplement from direct Supabase queries
  try {
    const [pRes, mktRes, matRes, ordRes, mktOrdRes, custRes, supRes, empRes, woRes] = await Promise.all([
      supabase.from('products').select('*').eq('workshop_id', workshopId),
      fetchWorkshopMarketplaceProducts(workshopId).catch(() => []),
      supabase.from('materials').select('*').eq('workshop_id', workshopId),
      supabase.from('orders').select('*').eq('workshop_id', workshopId),
      supabase.from('marketplace_orders').select('*').eq('workshop_id', workshopId),
      supabase.from('customers').select('*').eq('workshop_id', workshopId),
      supabase.from('suppliers').select('*').eq('workshop_id', workshopId),
      supabase.from('employees').select('*').eq('workshop_id', workshopId),
      supabase.from('work_orders').select('*').eq('workshop_id', workshopId),
    ]);

    if (!pRes.error && Array.isArray(pRes.data) && pRes.data.length > 0) {
      const mergedP = new Map<string, any>();
      productsRows.forEach((r: any) => mergedP.set(r.id, r));
      pRes.data.forEach((r: any) => mergedP.set(r.id, { ...(mergedP.get(r.id) || {}), ...r }));
      productsRows = Array.from(mergedP.values());
    }
    if (Array.isArray(mktRes) && mktRes.length > 0) {
      const mergedMkt = new Map<string, any>();
      marketplaceRows.forEach((r: any) => mergedMkt.set(r.id, r));
      mktRes.forEach((r: any) => mergedMkt.set(r.id, { ...(mergedMkt.get(r.id) || {}), ...r }));
      marketplaceRows = Array.from(mergedMkt.values());
    }
    if (!matRes.error && Array.isArray(matRes.data) && matRes.data.length > materialsRows.length) {
      materialsRows = matRes.data;
    }
    const directOrders = [
      ...(!ordRes.error && Array.isArray(ordRes.data) ? ordRes.data : []),
      ...(!mktOrdRes.error && Array.isArray(mktOrdRes.data) ? mktOrdRes.data : []),
    ];
    if (directOrders.length > ordersRows.length) ordersRows = directOrders;
    if (!custRes.error && Array.isArray(custRes.data) && custRes.data.length > customersRows.length) {
      customersRows = custRes.data;
    }
    if (!supRes.error && Array.isArray(supRes.data) && supRes.data.length > suppliersRows.length) {
      suppliersRows = supRes.data;
    }
    if (!empRes.error && Array.isArray(empRes.data) && empRes.data.length > employeesRows.length) {
      employeesRows = empRes.data;
    }
    if (!woRes.error && Array.isArray(woRes.data) && woRes.data.length > workOrdersRows.length) {
      workOrdersRows = woRes.data;
    }
  } catch {}

  // Merge catalog products + marketplace products
  const combinedProductsMap = new Map<string, any>();
  productsRows.forEach((r: any) => combinedProductsMap.set(r.id, r));
  marketplaceRows.forEach((mr: any) => {
    const prev = combinedProductsMap.get(mr.id);
    combinedProductsMap.set(mr.id, {
      ...(prev || {}),
      ...mr,
      marketplace_status: mr.status || prev?.marketplace_status,
      in_store: true,
    });
  });

  let savedProducts = 0;
  for (const row of combinedProductsMap.values()) {
    try {
      const localRec = mapCloudCatalogRowToLocal(row, workshopId);
      await tenantStorage.applyRemoteProduct(localRec);
      savedProducts++;
    } catch {}
  }

  let savedMaterials = 0;
  for (const rm of materialsRows) {
    try {
      const localMat = await db.rawMaterials.get(rm.id);
      await tenantStorage.saveRawMaterial(
        {
          ...(localMat || {}),
          id: rm.id,
          tenantId: workshopId,
          workshopId,
          materialName: rm.name || localMat?.materialName || 'خامة',
          category: rm.kind === 'extra' ? 'خامة إضافية' : localMat?.category || 'خامة أساسية',
          unit: localMat?.unit || rm.unit_name || 'كيلو',
          costPerUnit: Number(rm.purchase_price ?? rm.unit_cost ?? localMat?.costPerUnit ?? 0),
          currentStock: Number(rm.current_stock ?? localMat?.currentStock ?? 0),
          minAlertThreshold: Number(rm.min_limit ?? localMat?.minAlertThreshold ?? 5),
          reorderLevel: Number(rm.min_limit ?? localMat?.reorderLevel ?? 5),
          isActive: rm.is_active !== false,
          createdAt: localMat?.createdAt || Date.parse(rm.created_at || '') || Date.now(),
          updatedAt: Date.now(),
        } as any,
        { skipCloudQueue: true }
      );
      savedMaterials++;
    } catch {}
  }

  let savedOrders = 0;
  for (const ro of ordersRows) {
    try {
      const localOrd = await db.orders.get(ro.id);
      await db.orders.put({
        ...(localOrd || {}),
        id: ro.id,
        tenantId: workshopId,
        workshopId,
        orderNumber: ro.order_number || (localOrd as any)?.orderNumber || localOrd?.invoiceNumber || ro.id?.slice(-6),
        customerId: ro.customer_id || localOrd?.customerId || '',
        customerName: ro.customer_name || localOrd?.customerName || 'عميل',
        customerPhone: ro.customer_phone || localOrd?.customerPhone || '',
        productName: ro.product_name || localOrd?.productName || 'طلبية',
        items: Array.isArray(ro.items) ? ro.items : localOrd?.items || [],
        totalAmount: Number(ro.total_amount ?? ro.final_total ?? localOrd?.totalAmount ?? 0),
        finalTotal: Number(ro.final_total ?? ro.total_amount ?? localOrd?.finalTotal ?? 0),
        paidAmount: Number(ro.paid_amount ?? ro.amount_paid ?? ro.deposit_paid ?? localOrd?.paidAmount ?? 0),
        amountPaid: Number(ro.amount_paid ?? ro.paid_amount ?? ro.deposit_paid ?? localOrd?.amountPaid ?? 0),
        remainingAmount: Number(ro.remaining_amount ?? localOrd?.remainingAmount ?? 0),
        status: ro.status || localOrd?.status || 'pending',
        deliveryDate: ro.delivery_date || localOrd?.deliveryDate || '',
        date: ro.delivery_date || (ro.created_at ? String(ro.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10)),
        notes: ro.notes || localOrd?.notes || '',
        createdAt: localOrd?.createdAt || Date.parse(ro.created_at || '') || Date.now(),
        updatedAt: Date.now(),
      } as any);
      savedOrders++;
    } catch {}
  }

  for (const rc of customersRows) {
    try {
      if (!(await db.customers.get(rc.id))) {
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
    } catch {}
  }

  for (const rs of suppliersRows) {
    try {
      if (!(await db.suppliers.get(rs.id))) {
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
    } catch {}
  }

  for (const re of employeesRows) {
    try {
      if (!(await db.employees.get(re.id))) {
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
    } catch {}
  }

  for (const rw of workOrdersRows) {
    try {
      if (!(await db.workOrders.get(rw.id))) {
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
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PRODUCTS_PULLED_EVENT, { detail: { workshopId, changed: savedProducts } }));
    window.dispatchEvent(new CustomEvent('alshams_products_changed', { detail: { tenantId: workshopId, workshopId } }));
    window.dispatchEvent(new CustomEvent('alshams_materials_changed', { detail: { tenantId: workshopId } }));
    window.dispatchEvent(new CustomEvent('alshams_orders_changed', { detail: { tenantId: workshopId } }));
  }

  return { productsCount: savedProducts, materialsCount: savedMaterials, ordersCount: savedOrders };
}

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

    // 2. مطابقة وتحديث أرصدة وأسعار الخامات من Supabase (إضافة الناقص وتحديث الموجود)
    try {
      const { data: remoteMaterials, error: matErr } = await getMaterialsFromSupabase(workshopId);
      if (!matErr && Array.isArray(remoteMaterials) && remoteMaterials.length > 0) {
        for (const rm of remoteMaterials as any[]) {
          const localMat = await db.rawMaterials.get(rm.id);
          await tenantStorage.saveRawMaterial(
            {
              ...(localMat || {}),
              id: rm.id,
              tenantId: workshopId,
              workshopId,
              materialName: rm.name || localMat?.materialName || 'خامة',
              category: rm.kind === 'extra' ? 'خامة إضافية' : localMat?.category || 'خامة أساسية',
              unit: localMat?.unit || rm.unit_name || 'كيلو',
              costPerUnit: Number(rm.purchase_price ?? localMat?.costPerUnit ?? 0),
              currentStock:
                rm.current_stock !== undefined && rm.current_stock !== null
                  ? Number(rm.current_stock)
                  : localMat?.currentStock ?? 0,
              minAlertThreshold:
                rm.min_limit !== undefined && rm.min_limit !== null
                  ? Number(rm.min_limit)
                  : localMat?.minAlertThreshold ?? 5,
              reorderLevel:
                rm.min_limit !== undefined && rm.min_limit !== null
                  ? Number(rm.min_limit)
                  : localMat?.reorderLevel ?? 5,
              isActive: rm.is_active !== false,
              createdAt: localMat?.createdAt || Date.parse(rm.created_at || '') || Date.now(),
              updatedAt: Date.now(),
            } as any,
            { skipCloudQueue: true }
          );
        }
      }
    } catch {
      // هادئ تماماً
    }

    // 3. مطابقة المبيعات والأوردرات وتحديث الحالات والمقبوضات (إضافة الناقص وتحديث الموجود)
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
          await db.orders.put({
            ...(localOrder || {}),
            id: ro.id,
            tenantId: workshopId,
            workshopId,
            orderNumber: ro.order_number || (localOrder as any)?.orderNumber || localOrder?.invoiceNumber || ro.id?.slice(-6),
            customerId: ro.customer_id || localOrder?.customerId || '',
            customerName: ro.customer_name || localOrder?.customerName || 'عميل',
            customerPhone: ro.customer_phone || localOrder?.customerPhone || '',
            productName: ro.product_name || localOrder?.productName || 'طلبية',
            items: Array.isArray(ro.items) ? ro.items : localOrder?.items || [],
            status: ro.status || localOrder?.status || 'pending',
            paidAmount: Number(ro.paid_amount ?? ro.amount_paid ?? ro.deposit_paid ?? localOrder?.paidAmount ?? 0),
            amountPaid: Number(ro.amount_paid ?? ro.paid_amount ?? ro.deposit_paid ?? localOrder?.amountPaid ?? 0),
            remainingAmount: Number(ro.remaining_amount ?? localOrder?.remainingAmount ?? 0),
            totalAmount: Number(ro.total_amount ?? ro.final_total ?? localOrder?.totalAmount ?? 0),
            finalTotal: Number(ro.final_total ?? ro.total_amount ?? localOrder?.finalTotal ?? 0),
            deliveryDate: ro.delivery_date || localOrder?.deliveryDate || '',
            date: ro.delivery_date || (ro.created_at ? String(ro.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10)),
            createdAt: localOrder?.createdAt || Date.parse(ro.created_at || '') || Date.now(),
            updatedAt: Date.now(),
          } as any);
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

