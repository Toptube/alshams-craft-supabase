import { supabase } from '../lib/supabase';
import { db, tenantStorage } from './dexieDB';
import {
  getTreasuryBalancesFromSupabase,
  rpcTreasuryDeposit,
  isValidUuid,
  type PaymentChannel,
} from './supabaseService';
import { flushProductSync } from './productsCloud';
import { flushOfflineMutations } from './offlineMutationQueue';
import { determineInvoiceStatus, calculateCustomerBalance } from '../lib/accounting';
import type {
  InvoiceRecord,
  InvoicePaymentRecord,
  InvoiceReturnRecord,
  CustomerRecord,
  FinishedProductItem,
  TreasuryItem,
  WorkOrderRecord,
  WorkOrderStatus,
} from '../types';

const INVOICES_CACHE_PREFIX = 'alshams_invoices_cache_';

function readLocalInvoicesCache(workshopId: string): InvoiceRecord[] {
  if (typeof window === 'undefined' || !workshopId) return [];
  try {
    const raw = localStorage.getItem(INVOICES_CACHE_PREFIX + workshopId);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalInvoicesCache(workshopId: string, invoices: InvoiceRecord[]): void {
  if (typeof window === 'undefined' || !workshopId) return;
  try {
    localStorage.setItem(INVOICES_CACHE_PREFIX + workshopId, JSON.stringify(invoices));
  } catch {
    // ignore storage quota errors
  }
}

function upsertLocalInvoiceCache(workshopId: string, invoice: InvoiceRecord): InvoiceRecord[] {
  const existing = readLocalInvoicesCache(workshopId);
  const idx = existing.findIndex((i) => i.id === invoice.id);
  const updated =
    idx >= 0
      ? existing.map((i, n) => (n === idx ? invoice : i))
      : [invoice, ...existing];
  writeLocalInvoicesCache(workshopId, updated);
  return updated;
}

function mapSupabaseInvoiceRow(row: any, localMatch?: InvoiceRecord): InvoiceRecord {
  const meta = row?.local_record && typeof row.local_record === 'object' ? row.local_record : {};
  const totalAmount = Number(row?.total_amount ?? localMatch?.totalAmount ?? meta.totalAmount ?? 0);
  const paidAmount = Number(row?.paid_amount ?? localMatch?.paidAmount ?? meta.paidAmount ?? 0);
  const remainingAmount =
    row?.remaining_amount !== undefined && row?.remaining_amount !== null
      ? Number(row.remaining_amount)
      : Math.max(0, totalAmount - paidAmount);

  return {
    ...(localMatch || {}),
    ...(meta || {}),
    id: row.id,
    workshopId: row.workshop_id || localMatch?.workshopId || '',
    invoiceNumber: row.invoice_number || localMatch?.invoiceNumber || meta.invoiceNumber || 'INV-0001',
    customerId: row.customer_id || localMatch?.customerId || meta.customerId || '',
    customerName: row.customer_name || localMatch?.customerName || meta.customerName || 'عميل',
    customerPhone: row.customer_phone ?? localMatch?.customerPhone ?? meta.customerPhone ?? '',
    currency: row.currency || localMatch?.currency || meta.currency || 'EGP',
    exchangeRate: Number(row.exchange_rate ?? localMatch?.exchangeRate ?? meta.exchangeRate ?? 1),
    baseCurrencyAmount: Number(
      row.base_currency_amount ?? localMatch?.baseCurrencyAmount ?? meta.baseCurrencyAmount ?? totalAmount
    ),
    originalAmount: Number(
      row.original_amount ?? localMatch?.originalAmount ?? meta.originalAmount ?? totalAmount
    ),
    items: Array.isArray(row.items)
      ? row.items
      : localMatch?.items || meta.items || [],
    subtotal: Number(row.subtotal ?? localMatch?.subtotal ?? meta.subtotal ?? totalAmount),
    discount: Number(row.discount ?? localMatch?.discount ?? meta.discount ?? 0),
    shipping: Number(row.shipping ?? localMatch?.shipping ?? meta.shipping ?? 0),
    vatEnabled: Boolean(row.vat_enabled ?? localMatch?.vatEnabled ?? meta.vatEnabled ?? false),
    vatPercent: Number(row.vat_percent ?? localMatch?.vatPercent ?? meta.vatPercent ?? 14),
    vatAmount: Number(row.vat_amount ?? localMatch?.vatAmount ?? meta.vatAmount ?? 0),
    returnsTotal: Number(row.returns_total ?? localMatch?.returnsTotal ?? meta.returnsTotal ?? 0),
    totalAmount,
    paidAmount,
    remainingAmount,
    status: (row.status || localMatch?.status || determineInvoiceStatus(totalAmount, paidAmount)) as any,
    payments: Array.isArray(row.payments)
      ? row.payments
      : localMatch?.payments || meta.payments || [],
    returns: Array.isArray(row.returns)
      ? row.returns
      : localMatch?.returns || meta.returns || [],
    isLocked: Boolean(row.is_locked ?? localMatch?.isLocked ?? meta.isLocked ?? false),
    notes: row.notes ?? localMatch?.notes ?? meta.notes ?? '',
    date: row.date || localMatch?.date || (row.created_at ? String(row.created_at).slice(0, 10) : ''),
    createdAt: row.created_at
      ? Date.parse(String(row.created_at)) || localMatch?.createdAt || Date.now()
      : localMatch?.createdAt || Date.now(),
    updatedAt: row.updated_at
      ? Date.parse(String(row.updated_at)) || Date.now()
      : localMatch?.updatedAt || Date.now(),
    createdBy: row.created_by || localMatch?.createdBy || meta.createdBy || '',
  };
}

function isMissingColumnError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    msg.includes('could not find the') ||
    (msg.includes('column') && msg.includes('does not exist'))
  );
}

/**
 * قراءة أوامر التشغيل الخاصة بالورشة مباشرة من جدول work_orders في Supabase
 */
export async function getWorkOrdersFromSupabase(workshopId: string): Promise<WorkOrderRecord[]> {
  if (!workshopId || workshopId === 'workshop_demo' || workshopId === '00000000-0000-0000-0000-000000000000') {
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('created_at', { ascending: false });

    if (error || !Array.isArray(data)) return [];

    return data.map((sw: any) => ({
      id: sw.id,
      workshopId: sw.workshop_id || workshopId,
      orderNumber: sw.order_number || 'WO-0001',
      productName: sw.product_name || 'مشغولة',
      craftId: sw.craft_id || 'macrame',
      category: sw.category || 'مشغولات يدوية',
      targetQuantity: Number(sw.target_quantity || 1),
      assignedEmployeeId: sw.assigned_employee_id,
      assignedEmployeeName: sw.assigned_employee_name,
      assignedEmployeeWage: Number(sw.assigned_employee_wage || 0),
      status: (sw.status as WorkOrderStatus) || 'open',
      pulledMaterials: Array.isArray(sw.pulled_materials) ? sw.pulled_materials : [],
      returnedMaterials: Array.isArray(sw.returned_materials) ? sw.returned_materials : [],
      finishedProductsProduced: Number(sw.finished_products_produced || 0),
      scrapItems: Array.isArray(sw.scrap_items) ? sw.scrap_items : [],
      totalConsumedMaterialsCost: Number(sw.total_consumed_materials_cost || 0),
      totalLaborCost: Number(sw.total_labor_cost || 0),
      totalProductionCost: Number(sw.total_production_cost || 0),
      unitCostCalculated: Number(sw.unit_cost_calculated || 0),
      startDate: sw.start_date || new Date().toISOString().split('T')[0],
      notes: sw.notes || '',
      createdAt: sw.created_at ? new Date(sw.created_at).getTime() : Date.now(),
      updatedAt: sw.updated_at ? new Date(sw.updated_at).getTime() : Date.now(),
      createdBy: sw.created_by || '',
    }));
  } catch {
    return [];
  }
}

/**
 * قراءة فواتير المبيعات من Supabase مع الدمج السلس مع الكاش المحلي
 */
export async function getInvoicesFromSupabase(workshopId: string): Promise<InvoiceRecord[]> {
  const localCache = readLocalInvoicesCache(workshopId);
  const localMap = new Map<string, InvoiceRecord>();
  localCache.forEach((i) => localMap.set(i.id, i));

  if (!workshopId || workshopId === 'workshop_demo' || workshopId === '00000000-0000-0000-0000-000000000000') {
    return localCache.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('created_at', { ascending: false });

    if (error || !Array.isArray(data)) {
      return localCache.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    const mergedMap = new Map<string, InvoiceRecord>();
    localCache.forEach((i) => mergedMap.set(i.id, i));
    data.forEach((row: any) => {
      mergedMap.set(row.id, mapSupabaseInvoiceRow(row, localMap.get(row.id)));
    });

    const result = Array.from(mergedMap.values()).sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
    writeLocalInvoicesCache(workshopId, result);
    return result;
  } catch {
    return localCache.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
}

export async function getNextInvoiceNumberFromSupabase(workshopId: string): Promise<string> {
  const list = await getInvoicesFromSupabase(workshopId);
  let maxNum = 0;
  for (const inv of list) {
    const match = String(inv.invoiceNumber || '').match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  return `INV-${String(maxNum + 1).padStart(4, '0')}`;
}

async function upsertInvoiceRowResilient(workshopId: string, invoice: InvoiceRecord): Promise<void> {
  const corePayload = {
    id: invoice.id,
    workshop_id: workshopId,
    invoice_number: invoice.invoiceNumber || 'INV-0001',
    customer_id: invoice.customerId || '',
    customer_name: invoice.customerName || 'عميل',
    total_amount: Number(invoice.totalAmount || 0),
    paid_amount: Number(invoice.paidAmount || 0),
    remaining_amount: Number(invoice.remainingAmount || 0),
    status: invoice.status || 'unpaid',
    items: invoice.items || [],
    date: invoice.date || new Date().toISOString().split('T')[0],
    notes: invoice.notes || '',
    created_at: new Date(invoice.createdAt || Date.now()).toISOString(),
    updated_at: new Date(invoice.updatedAt || Date.now()).toISOString(),
  };

  const extendedPayload = {
    ...corePayload,
    customer_phone: invoice.customerPhone || '',
    subtotal: Number(invoice.subtotal || 0),
    discount: Number(invoice.discount || 0),
    shipping: Number(invoice.shipping || 0),
    vat_enabled: Boolean(invoice.vatEnabled),
    vat_percent: Number(invoice.vatPercent || 14),
    vat_amount: Number(invoice.vatAmount || 0),
    returns_total: Number(invoice.returnsTotal || 0),
    currency: invoice.currency || 'EGP',
    exchange_rate: Number(invoice.exchangeRate || 1),
    base_currency_amount: Number(invoice.baseCurrencyAmount ?? invoice.totalAmount ?? 0),
    original_amount: Number(invoice.originalAmount ?? invoice.totalAmount ?? 0),
    payments: invoice.payments || [],
    returns: invoice.returns || [],
    is_locked: Boolean(invoice.isLocked),
    created_by: invoice.createdBy || '',
  };

  const { error } = await supabase.from('invoices').upsert(extendedPayload, { onConflict: 'id' });
  if (error && isMissingColumnError(error)) {
    const retry = await supabase.from('invoices').upsert(corePayload, { onConflict: 'id' });
    if (retry.error) {
      throw new Error(retry.error.message);
    }
  } else if (error) {
    throw new Error(error.message);
  }
}

export async function saveInvoiceToSupabase(workshopId: string, invoice: InvoiceRecord): Promise<void> {
  const cachedList = readLocalInvoicesCache(workshopId);
  const prevInvoice = cachedList.find((i) => i.id === invoice.id);
  if (prevInvoice?.isLocked) {
    throw new Error('لا يمكن تعديل هذه الفاتورة لأنها تابعة لفترة محاسبية مقفلة.');
  }

  const normalized: InvoiceRecord = {
    ...invoice,
    workshopId,
    updatedAt: Date.now(),
  };

  upsertLocalInvoiceCache(workshopId, normalized);

  if (workshopId && workshopId !== 'workshop_demo' && workshopId !== '00000000-0000-0000-0000-000000000000') {
    await upsertInvoiceRowResilient(workshopId, normalized);
  }

  // Update customer balance in Dexie + Supabase
  if (normalized.customerId) {
    try {
      const existingCustomer = await db.customers.get(normalized.customerId);
      if (existingCustomer) {
        const oldTotal = prevInvoice?.totalAmount || 0;
        const diff = (normalized.totalAmount || 0) - oldTotal;
        const newTotalInvoiced = Math.max(
          0,
          (existingCustomer.totalInvoiced ?? existingCustomer.totalPurchases ?? 0) + diff
        );
        const totalPaid = existingCustomer.totalPaid ?? 0;
        const totalReturned = existingCustomer.totalReturned ?? 0;
        const balRes = calculateCustomerBalance(newTotalInvoiced, totalPaid, totalReturned);

        await tenantStorage.saveCustomer({
          ...existingCustomer,
          totalInvoiced: newTotalInvoiced,
          totalPurchases: newTotalInvoiced,
          currentBalance: balRes.rawBalance,
          outstandingBalance: Math.max(0, balRes.rawBalance),
          updatedAt: Date.now(),
        });
      }
    } catch {
      // non-fatal customer sync
    }
  }
}

export async function recordInvoicePaymentInSupabase(
  workshopId: string,
  invoiceId: string,
  payment: InvoicePaymentRecord,
  userEmail: string
): Promise<void> {
  const allInvoices = await getInvoicesFromSupabase(workshopId);
  const invData = allInvoices.find((i) => i.id === invoiceId);
  if (!invData) throw new Error('الفاتورة غير موجودة');
  if (invData.isLocked) throw new Error('الفاتورة تابعة لفترة مقفلة');

  const updatedPayments = [...(invData.payments || []), payment];
  const newPaidAmount = updatedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalInv = Number(invData.totalAmount) || 0;
  const newRemaining = Math.max(0, Math.round((totalInv - newPaidAmount) * 100) / 100);
  const newStatus = determineInvoiceStatus(totalInv, newPaidAmount);

  const updatedInvoice: InvoiceRecord = {
    ...invData,
    payments: updatedPayments,
    paidAmount: newPaidAmount,
    remainingAmount: newRemaining,
    status: newStatus as any,
    updatedAt: Date.now(),
  };

  upsertLocalInvoiceCache(workshopId, updatedInvoice);
  if (workshopId && workshopId !== 'workshop_demo' && workshopId !== '00000000-0000-0000-0000-000000000000') {
    await upsertInvoiceRowResilient(workshopId, updatedInvoice);
  }

  // Deposit into Supabase treasury (or local safe fallback)
  const channel: PaymentChannel =
    payment.paymentMethod === 'instapay'
      ? 'instapay'
      : payment.paymentMethod === 'wallet'
      ? 'wallet'
      : 'cash';

  let depositedToCloudTreasury = false;
  if (payment.treasuryId && isValidUuid(payment.treasuryId) && isValidUuid(workshopId)) {
    const rpcRes = await rpcTreasuryDeposit(
      workshopId,
      payment.treasuryId,
      channel,
      payment.amount,
      'تحصيل مبيعات',
      `دفعة فاتورة ${invData.invoiceNumber || ''} - عميل: ${invData.customerName || ''}`.trim()
    );
    if (!rpcRes.error) {
      depositedToCloudTreasury = true;
    }
  }

  if (!depositedToCloudTreasury) {
    await tenantStorage.recordSafeTransaction({
      id: 'stx_inv_' + payment.id,
      workshopId,
      tenantId: workshopId,
      safeType: payment.treasuryId === 'sub' ? 'sub' : 'main',
      treasuryId: payment.treasuryId || 'main',
      treasuryName: payment.treasuryName || 'الخزينة الرئيسية',
      channel,
      type: 'deposit',
      amount: payment.amount,
      balanceAfter: 0,
      referenceType: 'invoice',
      referenceId: invData.invoiceNumber || invoiceId,
      notes: `دفعة فاتورة ${invData.invoiceNumber || ''} - عميل: ${invData.customerName || ''}`,
      date: payment.date,
      createdAt: Date.now(),
      createdBy: userEmail,
    });
  }

  // Update customer stats
  if (invData.customerId) {
    try {
      const cust = await db.customers.get(invData.customerId);
      if (cust) {
        const updatedTotalPaid = (cust.totalPaid || 0) + payment.amount;
        const totalInvCust = cust.totalInvoiced ?? cust.totalPurchases ?? 0;
        const balRes = calculateCustomerBalance(totalInvCust, updatedTotalPaid, cust.totalReturned || 0);
        await tenantStorage.saveCustomer({
          ...cust,
          totalPaid: updatedTotalPaid,
          currentBalance: balRes.rawBalance,
          outstandingBalance: Math.max(0, balRes.rawBalance),
          updatedAt: Date.now(),
        });
      }
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alshams_treasury_updated', { detail: { tenantId: workshopId } }));
    window.dispatchEvent(new CustomEvent('alshams_financials_updated', { detail: { tenantId: workshopId } }));
  }
}

export async function recordInvoiceReturnInSupabase(
  workshopId: string,
  invoiceId: string,
  returnRecord: InvoiceReturnRecord,
  userEmail: string
): Promise<void> {
  const allInvoices = await getInvoicesFromSupabase(workshopId);
  const invData = allInvoices.find((i) => i.id === invoiceId);
  if (!invData) throw new Error('الفاتورة غير موجودة');
  if (invData.isLocked) throw new Error('الفاتورة تابعة لفترة مقفلة');

  const updatedReturns = [...(invData.returns || []), returnRecord];
  const newReturnsTotal = updatedReturns.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
  const sub = invData.subtotal || 0;
  const disc = invData.discount || 0;
  const ship = invData.shipping || 0;
  const paid = invData.paidAmount || 0;
  const newGross = sub - disc + ship + (invData.vatAmount || 0);
  const newTotalAmount = Math.max(0, Math.round((newGross - newReturnsTotal) * 100) / 100);
  const newRemaining = Math.max(0, Math.round((newTotalAmount - paid) * 100) / 100);
  const newStatus = determineInvoiceStatus(newTotalAmount, paid);

  const updatedInvoice: InvoiceRecord = {
    ...invData,
    returns: updatedReturns,
    returnsTotal: newReturnsTotal,
    totalAmount: newTotalAmount,
    remainingAmount: newRemaining,
    status: newStatus as any,
    updatedAt: Date.now(),
  };

  upsertLocalInvoiceCache(workshopId, updatedInvoice);
  if (workshopId && workshopId !== 'workshop_demo' && workshopId !== '00000000-0000-0000-0000-000000000000') {
    await upsertInvoiceRowResilient(workshopId, updatedInvoice);
  }

  // Return items back into local + cloud products stock
  try {
    const localProds = await tenantStorage.getProducts(workshopId);
    for (const item of returnRecord.items) {
      const match = localProds.find(
        (p) => p.productName?.trim().toLowerCase() === item.productName?.trim().toLowerCase()
      );
      if (match) {
        await tenantStorage.mutateProduct({
          ...match,
          currentStock: (Number(match.currentStock) || 0) + (Number(item.quantity) || 0),
          updatedAt: Date.now(),
        });
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alshams_products_changed', { detail: { tenantId: workshopId } }));
    }
  } catch {}

  // Refund from treasury if selected
  if (returnRecord.refundMethod === 'treasury_refund' && returnRecord.treasuryId) {
    let refundedInCloud = false;
    if (isValidUuid(returnRecord.treasuryId) && isValidUuid(workshopId)) {
      try {
        const { error: txErr } = await supabase.from('treasury_transactions').insert({
          workshop_id: workshopId,
          treasury_id: returnRecord.treasuryId,
          channel: 'cash',
          kind: 'out',
          amount: Math.abs(returnRecord.totalAmount),
          category: 'مرتجع مبيعات',
          category_name: 'مرتجع مبيعات',
          ref_type: 'invoice',
          ref_id: invData.invoiceNumber || invoiceId,
          note: `رد نقدية مرتجع فاتورة #${invData.invoiceNumber || invoiceId}`,
          occurred_at: new Date().toISOString(),
        });
        if (!txErr) refundedInCloud = true;
      } catch {}
    }

    if (!refundedInCloud) {
      await tenantStorage.recordSafeTransaction({
        id: 'stx_ref_' + returnRecord.id,
        workshopId,
        tenantId: workshopId,
        safeType: returnRecord.treasuryId === 'sub' ? 'sub' : 'main',
        treasuryId: returnRecord.treasuryId,
        treasuryName: returnRecord.treasuryName || 'الخزينة الرئيسية',
        type: 'customer_refund',
        amount: -Math.abs(returnRecord.totalAmount),
        balanceAfter: 0,
        referenceType: 'invoice',
        referenceId: invData.invoiceNumber || invoiceId,
        notes: `رد نقدية مرتجع فاتورة #${invData.invoiceNumber || invoiceId}`,
        date: returnRecord.date,
        createdAt: Date.now(),
        createdBy: userEmail,
      });
    }
  }

  // Update customer totalReturned
  if (invData.customerId) {
    try {
      const cust = await db.customers.get(invData.customerId);
      if (cust) {
        const newTotalReturned = (cust.totalReturned || 0) + returnRecord.totalAmount;
        const totalInvCust = cust.totalInvoiced ?? cust.totalPurchases ?? 0;
        const balRes = calculateCustomerBalance(totalInvCust, cust.totalPaid || 0, newTotalReturned);
        await tenantStorage.saveCustomer({
          ...cust,
          totalReturned: newTotalReturned,
          currentBalance: balRes.rawBalance,
          outstandingBalance: Math.max(0, balRes.rawBalance),
          updatedAt: Date.now(),
        });
      }
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alshams_treasury_updated', { detail: { tenantId: workshopId } }));
    window.dispatchEvent(new CustomEvent('alshams_financials_updated', { detail: { tenantId: workshopId } }));
  }
}

export async function getWorkshopCustomersMerged(workshopId: string): Promise<CustomerRecord[]> {
  const local = await tenantStorage.getCustomers(workshopId).catch(() => []);
  const map = new Map<string, CustomerRecord>();
  local.forEach((c: any) =>
    map.set(c.id, {
      ...c,
      name: c.name || c.fullName || 'عميل',
      phone: c.phone || c.phoneNumber || '',
    })
  );

  if (workshopId && workshopId !== 'workshop_demo' && workshopId !== '00000000-0000-0000-0000-000000000000') {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('workshop_id', workshopId);
      if (!error && Array.isArray(data)) {
        data.forEach((rc: any) => {
          const prev = map.get(rc.id);
          map.set(rc.id, {
            ...(prev || {}),
            id: rc.id,
            workshopId,
            tenantId: workshopId,
            name: rc.name || rc.full_name || prev?.name || 'عميل',
            fullName: rc.full_name || rc.name || prev?.fullName || 'عميل',
            phone: rc.phone || rc.phone_number || prev?.phone || '',
            phoneNumber: rc.phone_number || rc.phone || prev?.phoneNumber || '',
            city: rc.city || prev?.city || '',
            address: rc.address || prev?.address || '',
            totalInvoiced: Number(rc.total_purchases ?? prev?.totalInvoiced ?? 0),
            totalPurchases: Number(rc.total_purchases ?? prev?.totalPurchases ?? 0),
            outstandingBalance: Number(rc.outstanding_balance ?? prev?.outstandingBalance ?? 0),
            currentBalance: Number(rc.outstanding_balance ?? prev?.currentBalance ?? 0),
          });
        });
      }
    } catch {}
  }

  return Array.from(map.values());
}

export async function saveWorkshopCustomerToSupabase(
  workshopId: string,
  customer: CustomerRecord
): Promise<void> {
  await tenantStorage.saveCustomer({
    ...(customer as any),
    tenantId: workshopId,
    workshopId,
    fullName: customer.fullName || customer.name || 'عميل',
    name: customer.name || customer.fullName || 'عميل',
    phoneNumber: customer.phoneNumber || customer.phone || '',
    phone: customer.phone || customer.phoneNumber || '',
  });
}

export async function getWorkshopFinishedProductsMerged(
  workshopId: string
): Promise<FinishedProductItem[]> {
  const localProds = await tenantStorage.getProducts(workshopId).catch(() => []);
  return localProds.map((p: any) => ({
    id: p.id,
    workshopId,
    productName: p.productName || 'منتج',
    craftId: String(p.category || 'macrame'),
    category: String(p.category || 'macrame'),
    currentStock: Number(p.currentStock ?? 1),
    costPerUnit: Number(p.costPrice ?? 0),
    sellingPrice: Number(p.retailPrice ?? p.storePrice ?? 0),
    productImageUrl: p.imageUrl,
    minAlertThreshold: 1,
    isActive: p.isActive !== false,
    createdAt: p.createdAt || Date.now(),
    updatedAt: p.updatedAt || Date.now(),
    createdBy: '',
  }));
}

export async function getWorkshopTreasuriesMerged(workshopId: string): Promise<TreasuryItem[]> {
  const res = await getTreasuryBalancesFromSupabase(workshopId).catch(() => ({ data: [] }));
  const rows = res.data || [];
  if (rows.length > 0) {
    return rows.map((t) => ({
      id: t.id,
      workshopId: t.workshop_id || workshopId,
      name: t.name,
      type: t.kind === 'custody' ? 'wallet' : 'cash',
      balance: Number(t.balance || 0),
      isMain: Boolean(t.is_main || t.kind === 'main'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: '',
    }));
  }

  const localSafe = await tenantStorage.getSafeBalances(workshopId).catch(() => ({ mainSafe: 0, subSafe: 0 }));
  return [
    {
      id: 'main',
      workshopId,
      name: 'الخزنة الرئيسية (كاش)',
      type: 'cash',
      balance: localSafe.mainSafe || 0,
      isMain: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: '',
    },
    {
      id: 'sub',
      workshopId,
      name: 'الخزنة الفرعية',
      type: 'cash',
      balance: localSafe.subSafe || 0,
      isMain: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: '',
    },
  ];
}

/**
 * ترحيل كافة البيانات المحلية (Dexie) الخاصة بالورشة إلى سحابة Supabase بأمان
 */
export async function migrateDexieToSupabase(
  workshopId: string,
  _userEmail: string,
  onProgress?: (percent: number, stepName: string) => void
): Promise<{ migratedCount: number }> {
  let migratedCount = 0;
  onProgress?.(10, 'استرجاع البيانات المسجلة محلياً على هذا المتصفح...');

  const [
    localMaterials,
    localSuppliers,
    localCustomers,
    localOrders,
    localEmployees,
    localWorkOrders,
    localProducts,
  ] = await Promise.all([
    tenantStorage.getRawMaterials(workshopId).catch(() => []),
    tenantStorage.getSuppliers(workshopId).catch(() => []),
    tenantStorage.getCustomers(workshopId).catch(() => []),
    tenantStorage.getOrders(workshopId).catch(() => []),
    tenantStorage.getEmployees(workshopId).catch(() => []),
    tenantStorage.getWorkOrders(workshopId).catch(() => []),
    tenantStorage.getProducts(workshopId).catch(() => []),
  ]);

  const totalItems =
    localMaterials.length +
    localSuppliers.length +
    localCustomers.length +
    localOrders.length +
    localEmployees.length +
    localWorkOrders.length +
    localProducts.length;

  if (totalItems === 0) {
    onProgress?.(100, 'لا توجد بيانات محلية غير مرفوعة للترحيل.');
    return { migratedCount: 0 };
  }

  onProgress?.(25, 'مزامنة الطلبيات المعلقة والمنتجات مع Supabase...');
  await Promise.allSettled([flushOfflineMutations(), flushProductSync(workshopId)]);
  migratedCount += localProducts.length;

  onProgress?.(45, 'رفع الموردين والعملاء إلى Supabase...');
  if (localSuppliers.length > 0) {
    const supRows = localSuppliers.map((s: any) => ({
      id: s.id,
      workshop_id: workshopId,
      name: s.name || s.companyName || 'مورد',
      company_name: s.companyName || s.name || '',
      phone: s.phoneNumber || s.phone || null,
      phone_number: s.phoneNumber || s.phone || null,
      address: s.address || null,
      material_specialty: s.materialSpecialty || null,
      outstanding_balance: Number(s.outstandingBalance || 0),
      notes: s.notes || null,
    }));
    const { error } = await supabase.from('suppliers').upsert(supRows, { onConflict: 'id' });
    if (!error) migratedCount += supRows.length;
  }

  if (localCustomers.length > 0) {
    const custRows = localCustomers.map((c: any) => ({
      id: c.id,
      workshop_id: workshopId,
      name: c.fullName || c.name || 'عميل',
      full_name: c.fullName || c.name || 'عميل',
      phone: c.phoneNumber || c.phone || null,
      phone_number: c.phoneNumber || c.phone || null,
      city: c.city || null,
      address: c.address || c.city || null,
      total_purchases: Number(c.totalPurchases || 0),
      outstanding_balance: Number(c.outstandingBalance || 0),
      notes: c.notes || null,
    }));
    const { error } = await supabase.from('customers').upsert(custRows, { onConflict: 'id' });
    if (!error) migratedCount += custRows.length;
  }

  onProgress?.(65, 'رفع الخامات والمخزون...');
  for (const m of localMaterials as any[]) {
    if (m.unitId) {
      const { error } = await supabase.from('materials').upsert(
        {
          id: m.id,
          workshop_id: workshopId,
          name: m.materialName || 'خامة',
          unit_id: m.unitId,
          kind: m.category === 'خامة إضافية' ? 'extra' : 'primary',
          purchase_price: Number(m.costPerUnit || 0),
          current_stock: Number(m.currentStock || 0),
          min_limit: Number(m.minAlertThreshold || 5),
        },
        { onConflict: 'id' }
      );
      if (!error) migratedCount++;
    }
  }

  onProgress?.(80, 'رفع الموظفين وأوامر التشغيل والطلبيات...');
  if (localEmployees.length > 0) {
    const empRows = localEmployees.map((e: any) => ({
      id: e.id,
      workshop_id: workshopId,
      full_name: e.fullName || 'عامل',
      role: e.role || 'artisan',
      phone: e.phone || e.phoneNumber || null,
      phone_number: e.phoneNumber || e.phone || null,
      base_wage: Number(e.baseWage || 0),
      wage_type: e.wageType || e.paymentType || 'piece_rate',
      current_balance: Number(e.currentBalance || 0),
      total_earned: Number(e.totalEarned || 0),
      total_paid: Number(e.totalPaid || 0),
      is_active: e.isActive !== false,
      notes: e.notes || null,
    }));
    const { error } = await supabase.from('employees').upsert(empRows, { onConflict: 'id' });
    if (!error) migratedCount += empRows.length;
  }

  if (localOrders.length > 0) {
    const ordRows = localOrders.map((o: any) => ({
      id: o.id,
      workshop_id: workshopId,
      order_number: o.invoiceNumber || o.orderNumber || `ORD-${String(o.id).slice(-4)}`,
      customer_id: o.customerId || null,
      customer_name: o.customerName || 'عميل',
      customer_phone: o.customerPhone || '',
      product_name: o.productName || o.items?.[0]?.productName || '',
      items: o.items || [],
      subtotal: Number(o.subtotal || 0),
      discount: Number(o.discount || 0),
      shipping: Number(o.shipping || 0),
      total_amount: Number(o.totalAmount || o.finalTotal || 0),
      final_total: Number(o.finalTotal || o.totalAmount || 0),
      paid_amount: Number(o.paidAmount || o.amountPaid || 0),
      amount_paid: Number(o.amountPaid || o.paidAmount || 0),
      remaining_amount: Number(o.remainingAmount || 0),
      status: o.status || 'pending',
      delivery_date: o.deliveryDate || null,
      notes: o.notes || '',
    }));
    const { error } = await supabase.from('orders').upsert(ordRows, { onConflict: 'id' });
    if (!error) migratedCount += ordRows.length;
  }

  if (localWorkOrders.length > 0) {
    const woRows = localWorkOrders.map((w: any) => ({
      id: w.id,
      workshop_id: workshopId,
      order_number: w.orderNumber || 'WO-0001',
      product_name: w.productName || '',
      craft_id: w.craftId || null,
      category: w.category || null,
      target_quantity: Number(w.targetQuantity || 1),
      status: w.status || 'open',
      assigned_employee_id: w.assignedEmployeeId || null,
      assigned_employee_name: w.assignedEmployeeName || null,
      assigned_employee_wage: Number(w.assignedEmployeeWage || 0),
      pulled_materials: w.pulledMaterials || [],
      returned_materials: w.returnedMaterials || [],
      scrap_items: w.scrapItems || [],
      finished_products_produced: Number(w.finishedProductsProduced || 0),
      total_consumed_materials_cost: Number(w.totalConsumedMaterialsCost || 0),
      total_labor_cost: Number(w.totalLaborCost || 0),
      total_production_cost: Number(w.totalProductionCost || 0),
      unit_cost_calculated: Number(w.unitCostCalculated || 0),
      start_date: w.startDate || null,
      notes: w.notes || '',
    }));
    const { error } = await supabase.from('work_orders').upsert(woRows, { onConflict: 'id' });
    if (!error) migratedCount += woRows.length;
  }

  onProgress?.(100, `تمت مزامنة ${migratedCount} سجلاً بنجاح مع سحابة Supabase!`);
  return { migratedCount };
}
