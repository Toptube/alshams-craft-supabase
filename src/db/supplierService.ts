import { supabase } from '../lib/supabase';
import {
  SupplierProfile,
  SupplierCatalogItem,
  B2BSupplyOrder,
  SupplierCustomer,
  SupplierTreasury,
  SupplierTreasuryTransaction,
  SupplierExpense,
  SupplierStoreConfig,
  SupplierBusinessType,
  SupplierPricingMode,
  supplierProfileToUserProfile,
} from '../types/supplier';
import { MainSectionId } from '../registry/craftsRegistry';
import { UserProfile, Gender } from '../types';

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

const LOCAL_SUPPLIER_PROFILE_KEY = 'alshams_supplier_profile';

export function mapDbSupplierRowToProfile(row: any): SupplierProfile {
  return {
    id: row.id,
    ownerUid: row.owner_uid || row.ownerUid || '',
    email: row.email || '',
    brandName: row.brand_name || row.brandName || '',
    ownerName: row.owner_name || row.ownerName || '',
    gender: (row.gender === 'female' ? 'female' : 'male') as Gender,
    phone: row.phone || '',
    country: row.country || 'مصر',
    governorate: row.governorate || '',
    currency: row.currency || 'EGP',
    currencySymbol: row.currency_symbol || row.currencySymbol || 'ج.م',
    storeSlug: row.store_slug || row.storeSlug || '',
    logoUrl: row.logo_url || row.logoUrl || '/alshams_falcon_emblem.png',
    businessTypes: Array.isArray(row.business_types || row.businessTypes)
      ? row.business_types || row.businessTypes
      : ['online'],
    pricingModes: Array.isArray(row.pricing_modes || row.pricingModes)
      ? row.pricing_modes || row.pricingModes
      : ['retail'],
    supplySections: Array.isArray(row.supply_sections || row.supplySections)
      ? row.supply_sections || row.supplySections
      : [],
    suppliedMaterials: Array.isArray(row.supplied_materials || row.suppliedMaterials)
      ? row.supplied_materials || row.suppliedMaterials
      : [],
    storeConfig:
      (row.store_config && typeof row.store_config === 'object' ? row.store_config : null) ||
      row.storeConfig ||
      {},
    status: row.status || 'active',
    isFrozen: Boolean(row.is_frozen ?? row.isFrozen),
    suspensionReason: row.suspension_reason || row.suspensionReason,
    suspensionDuration: row.suspension_duration || row.suspensionDuration,
    suspendedUntil: row.suspended_until || row.suspendedUntil,
    appealStatus: row.appeal_status || row.appealStatus,
    appealMessage: row.appeal_message || row.appealMessage,
    rejectionReason: row.rejection_reason || row.rejectionReason,
    medal: row.medal,
    ratingStars: Number(row.rating_stars ?? row.ratingStars ?? 5),
    featuredRank: Number(row.featured_rank ?? row.featuredRank ?? 0),
    termsAcceptedAt: row.terms_accepted_at || row.termsAcceptedAt,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

export async function getCurrentSupplierFromSupabase(): Promise<UserProfile | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // 1. Check backend API first (combines Supabase + JSON store seamlessly)
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/suppliers/me', { headers });
      if (res.ok) {
        const json = await res.json();
        if (json?.supplier) {
          const mapped = mapDbSupplierRowToProfile(json.supplier);
          const uProf = supplierProfileToUserProfile(mapped);
          try {
            localStorage.setItem(LOCAL_SUPPLIER_PROFILE_KEY, JSON.stringify(mapped));
          } catch {}
          return uProf;
        }
      }
    } catch {}

    // 2. Direct Supabase query fallback
    const { data: row } = await supabase
      .from('platform_suppliers')
      .select('*')
      .or(`owner_uid.eq.${user.id},email.eq.${(user.email || '').toLowerCase()}`)
      .maybeSingle();

    if (row) {
      const mapped = mapDbSupplierRowToProfile(row);
      try {
        localStorage.setItem(LOCAL_SUPPLIER_PROFILE_KEY, JSON.stringify(mapped));
      } catch {}
      return supplierProfileToUserProfile(mapped);
    }

    // 3. Cached fallback if matching uid/email
    try {
      const raw = localStorage.getItem(LOCAL_SUPPLIER_PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SupplierProfile;
        if (
          parsed.ownerUid === user.id ||
          (parsed.email &&
            user.email &&
            parsed.email.toLowerCase() === user.email.toLowerCase())
        ) {
          return supplierProfileToUserProfile(parsed);
        }
      }
    } catch {}
  } catch {}
  return null;
}

export interface RegisterSupplierInput {
  brandName: string;
  ownerName: string;
  gender: Gender;
  phone: string;
  email: string;
  country: string;
  governorate: string;
  currency: string;
  currencySymbol: string;
  businessTypes: SupplierBusinessType[];
  pricingModes: SupplierPricingMode[];
  supplySections: MainSectionId[];
  suppliedMaterials: string[];
  ownerUid?: string;
}

export async function registerSupplierAccount(
  input: RegisterSupplierInput
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/suppliers/register', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.supplier) {
      const mapped = mapDbSupplierRowToProfile(json.supplier);
      const uProf = supplierProfileToUserProfile(mapped);
      try {
        localStorage.setItem(LOCAL_SUPPLIER_PROFILE_KEY, JSON.stringify(mapped));
        localStorage.setItem('alshams_profile', JSON.stringify(uProf));
      } catch {}
      return { success: true, profile: uProf };
    }
    return {
      success: false,
      error: json?.error || `تعذر تسجيل حساب المورد (${res.status})`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'حدث خطأ في الاتصال أثناء تسجيل حساب المورد',
    };
  }
}

export async function updateSupplierStoreConfig(
  storeConfig: SupplierStoreConfig,
  updates?: { storeSlug?: string; brandName?: string; phone?: string; governorate?: string }
): Promise<{ success: boolean; supplier?: SupplierProfile; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/suppliers/store-config', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ storeConfig, ...(updates || {}) }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.supplier) {
      const mapped = mapDbSupplierRowToProfile(json.supplier);
      try {
        localStorage.setItem(LOCAL_SUPPLIER_PROFILE_KEY, JSON.stringify(mapped));
      } catch {}
      return { success: true, supplier: mapped };
    }
    return { success: false, error: json?.error || 'تعذر حفظ إعدادات متجر المورد' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'تعذر الاتصال بالخادم' };
  }
}

// =============================================================
// Catalog CRUD
// =============================================================
export async function fetchSupplierCatalog(): Promise<SupplierCatalogItem[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/suppliers/catalog', { headers });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.items)) {
        return json.items.map(mapDbCatalogItem);
      }
    }
  } catch {}
  return [];
}

export function mapDbCatalogItem(r: any): SupplierCatalogItem {
  return {
    id: r.id,
    supplierId: r.supplier_id || r.supplierId || '',
    sectionId: (r.section_id || r.sectionId || 'ropes_textiles') as MainSectionId,
    craftId: r.craft_id || r.craftId || '',
    name: r.name || '',
    unit: r.unit || 'بكرة',
    description: r.description || '',
    images: Array.isArray(r.images) ? r.images : [],
    variants: Array.isArray(r.variants) ? r.variants : [],
    stockQty: Number(r.stock_qty ?? r.stockQty ?? 0),
    retailPrice: Number(r.retail_price ?? r.retailPrice ?? 0),
    wholesalePrice: Number(r.wholesale_price ?? r.wholesalePrice ?? 0),
    minWholesaleQty: Number(r.min_wholesale_qty ?? r.minWholesaleQty ?? 1),
    discountType: r.discount_type || r.discountType || 'none',
    discountValue: Number(r.discount_value ?? r.discountValue ?? 0),
    inStore: r.in_store !== undefined ? Boolean(r.in_store) : r.inStore !== false,
    inMarket: r.in_market !== undefined ? Boolean(r.in_market) : r.inMarket !== false,
    isApproved: r.is_approved !== undefined ? Boolean(r.is_approved) : r.isApproved !== false,
    sourceCurrency: r.source_currency || r.sourceCurrency || 'EGP',
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt,
  };
}

export async function upsertSupplierCatalogItem(
  item: Partial<SupplierCatalogItem>
): Promise<{ success: boolean; item?: SupplierCatalogItem; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const isEdit = Boolean(item.id);
    const res = await fetch(
      isEdit ? `/api/suppliers/catalog/${item.id}` : '/api/suppliers/catalog',
      {
        method: isEdit ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(item),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.item) {
      return { success: true, item: mapDbCatalogItem(json.item) };
    }
    return { success: false, error: json?.error || 'تعذر حفظ الخامة' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال' };
  }
}

export async function deleteSupplierCatalogItem(id: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/suppliers/catalog/${id}`, { method: 'DELETE', headers });
    return res.ok;
  } catch {
    return false;
  }
}

// =============================================================
// Orders CRUD
// =============================================================
export function mapDbB2BOrder(r: any): B2BSupplyOrder {
  return {
    id: r.id,
    orderNumber: r.order_number || r.orderNumber || r.id,
    supplierId: r.supplier_id || r.supplierId || '',
    workshopId: r.workshop_id || r.workshopId || null,
    externalBuyer: r.external_buyer || r.externalBuyer || null,
    orderSource: r.order_source || r.orderSource || 'external_manual',
    items: Array.isArray(r.items) ? r.items : [],
    pricingTierApplied: r.pricing_tier_applied || r.pricingTierApplied || 'retail',
    subtotal: Number(r.subtotal ?? 0),
    discount: Number(r.discount ?? 0),
    shippingFee: Number(r.shipping_fee ?? r.shippingFee ?? 0),
    finalTotal: Number(r.final_total ?? r.finalTotal ?? 0),
    paidAmount: Number(r.paid_amount ?? r.paidAmount ?? 0),
    remainingAmount: Number(r.remaining_amount ?? r.remainingAmount ?? 0),
    paymentMethod: r.payment_method || r.paymentMethod || 'cash',
    workshopTreasuryId: r.workshop_treasury_id || r.workshopTreasuryId || null,
    supplierTreasuryId: r.supplier_treasury_id || r.supplierTreasuryId || null,
    status: r.status || 'pending',
    workshopApprovedAt: r.workshop_approved_at || r.workshopApprovedAt || null,
    inventorySyncedAt: r.inventory_synced_at || r.inventorySyncedAt || null,
    financialPostedAt: r.financial_posted_at || r.financialPostedAt || null,
    notes: r.notes || '',
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt,
  };
}

export async function fetchSupplierOrders(): Promise<B2BSupplyOrder[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/suppliers/orders', { headers });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.orders)) {
        return json.orders.map(mapDbB2BOrder);
      }
    }
  } catch {}
  return [];
}

export async function createSupplierOrder(
  payload: Partial<B2BSupplyOrder>
): Promise<{ success: boolean; order?: B2BSupplyOrder; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/suppliers/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.order) {
      return { success: true, order: mapDbB2BOrder(json.order) };
    }
    return { success: false, error: json?.error || 'تعذر حفظ الطلب' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ في الاتصال' };
  }
}

export async function updateSupplierOrderStatus(
  orderId: string,
  status: B2BSupplyOrder['status'],
  paidAmount?: number,
  supplierTreasuryId?: string
): Promise<{ success: boolean; order?: B2BSupplyOrder; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`/api/suppliers/orders/${orderId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status, paidAmount, supplierTreasuryId }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.order) {
      return { success: true, order: mapDbB2BOrder(json.order) };
    }
    return { success: false, error: json?.error || 'تعذر تحديث حالة الطلب' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ في الاتصال' };
  }
}

// =============================================================
// Customers CRUD
// =============================================================
export function mapDbSupplierCustomer(r: any): SupplierCustomer {
  return {
    id: r.id,
    supplierId: r.supplier_id || r.supplierId || '',
    workshopId: r.workshop_id || r.workshopId || null,
    name: r.name || '',
    phone: r.phone || '',
    country: r.country || 'مصر',
    governorate: r.governorate || '',
    sourceType: r.source_type || r.sourceType || 'external',
    totalPurchases: Number(r.total_purchases ?? r.totalPurchases ?? 0),
    balanceDue: Number(r.balance_due ?? r.balanceDue ?? 0),
    notes: r.notes || '',
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt,
  };
}

export async function fetchSupplierCustomers(): Promise<SupplierCustomer[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/suppliers/customers', { headers });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.customers)) {
        return json.customers.map(mapDbSupplierCustomer);
      }
    }
  } catch {}
  return [];
}

export async function upsertSupplierCustomer(
  customer: Partial<SupplierCustomer>
): Promise<{ success: boolean; customer?: SupplierCustomer; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const isEdit = Boolean(customer.id);
    const res = await fetch(
      isEdit ? `/api/suppliers/customers/${customer.id}` : '/api/suppliers/customers',
      {
        method: isEdit ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(customer),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.customer) {
      return { success: true, customer: mapDbSupplierCustomer(json.customer) };
    }
    return { success: false, error: json?.error || 'تعذر حفظ بيانات العميل' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ في الاتصال' };
  }
}

export async function deleteSupplierCustomer(id: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/suppliers/customers/${id}`, { method: 'DELETE', headers });
    return res.ok;
  } catch {
    return false;
  }
}

// =============================================================
// Finance: Treasuries, Transactions & Expenses
// =============================================================
export function mapDbTreasury(r: any): SupplierTreasury {
  return {
    id: r.id,
    supplierId: r.supplier_id || r.supplierId || '',
    name: r.name || 'الخزينة الرئيسية',
    channelType: r.channel_type || r.channelType || 'cash',
    balance: Number(r.balance ?? 0),
    currency: r.currency || 'EGP',
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt,
  };
}

export function mapDbTx(r: any): SupplierTreasuryTransaction {
  return {
    id: r.id,
    supplierId: r.supplier_id || r.supplierId || '',
    treasuryId: r.treasury_id || r.treasuryId || '',
    b2bOrderId: r.b2b_order_id || r.b2bOrderId || null,
    txType: r.tx_type || r.txType || 'income',
    amount: Number(r.amount ?? 0),
    description: r.description || '',
    createdAt: r.created_at || r.createdAt,
  };
}

export function mapDbExpense(r: any): SupplierExpense {
  return {
    id: r.id,
    supplierId: r.supplier_id || r.supplierId || '',
    treasuryId: r.treasury_id || r.treasuryId || null,
    category: r.category || 'تشغيل',
    amount: Number(r.amount ?? 0),
    notes: r.notes || '',
    expenseDate: r.expense_date || r.expenseDate || new Date().toISOString().slice(0, 10),
    createdAt: r.created_at || r.createdAt,
  };
}

export async function fetchSupplierFinance(): Promise<{
  treasuries: SupplierTreasury[];
  transactions: SupplierTreasuryTransaction[];
  expenses: SupplierExpense[];
}> {
  try {
    const headers = await getAuthHeaders();
    const [trRes, exRes] = await Promise.all([
      fetch('/api/suppliers/treasuries', { headers }),
      fetch('/api/suppliers/expenses', { headers }),
    ]);
    const trJson = trRes.ok ? await trRes.json() : {};
    const exJson = exRes.ok ? await exRes.json() : {};
    return {
      treasuries: Array.isArray(trJson?.treasuries)
        ? trJson.treasuries.map(mapDbTreasury)
        : [],
      transactions: Array.isArray(trJson?.transactions)
        ? trJson.transactions.map(mapDbTx)
        : [],
      expenses: Array.isArray(exJson?.expenses)
        ? exJson.expenses.map(mapDbExpense)
        : [],
    };
  } catch {
    return { treasuries: [], transactions: [], expenses: [] };
  }
}

export async function createSupplierTreasury(payload: {
  name: string;
  channelType: SupplierTreasury['channelType'];
  balance: number;
  currency?: string;
}): Promise<{ success: boolean; treasury?: SupplierTreasury; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/suppliers/treasuries', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.treasury) {
      return { success: true, treasury: mapDbTreasury(json.treasury) };
    }
    return { success: false, error: json?.error || 'تعذر إنشاء الخزينة' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ في الاتصال' };
  }
}

export async function recordSupplierTreasuryTx(payload: {
  treasuryId: string;
  txType: 'deposit' | 'withdrawal' | 'adjustment';
  amount: number;
  description: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/suppliers/transactions', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) return { success: true };
    return { success: false, error: json?.error || 'تعذر تسجيل الحركة المالية' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ في الاتصال' };
  }
}

export async function addSupplierExpense(
  payload: Partial<SupplierExpense>
): Promise<{ success: boolean; expense?: SupplierExpense; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/suppliers/expenses', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.expense) {
      return { success: true, expense: mapDbExpense(json.expense) };
    }
    return { success: false, error: json?.error || 'تعذر تسجيل المصروف' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ في الاتصال' };
  }
}

export async function deleteSupplierExpense(id: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/suppliers/expenses/${id}`, { method: 'DELETE', headers });
    return res.ok;
  } catch {
    return false;
  }
}
