import { supabase } from '../lib/supabase';
import {
  SupplierProfile,
  SupplierCatalogItem,
  SupplierPriceTier,
  SupplierReview,
  SupplierOfferAlert,
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

let cachedAuthBase: { headers: Record<string, string>; ts: number } | null = null;
let inFlightAuthBase: Promise<Record<string, string>> | null = null;

async function getAuthHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedAuthBase && now - cachedAuthBase.ts < 3000) {
    return { ...cachedAuthBase.headers, ...extra };
  }
  if (!inFlightAuthBase) {
    inFlightAuthBase = (async () => {
      const base: Record<string, string> = {};
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          base['Authorization'] = `Bearer ${session.access_token}`;
        }
        if (session?.user?.email) {
          base['x-user-email'] = session.user.email;
        }
      } catch {}
      cachedAuthBase = { headers: base, ts: Date.now() };
      return base;
    })().finally(() => {
      inFlightAuthBase = null;
    });
  }
  const base = await inFlightAuthBase;
  return { ...base, ...extra };
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
    reviewsCount: Number(row.reviews_count ?? row.reviewsCount ?? 0),
    featuredRank: Number(row.featured_rank ?? row.featuredRank ?? 0),
    hideStorefront: Boolean(row.hide_storefront ?? row.hideStorefront),
    hideFromMarket: Boolean(row.hide_from_market ?? row.hideFromMarket),
    hasCentralWarehouse: Boolean(row.has_central_warehouse ?? row.hasCentralWarehouse),
    maxBranchesApproved: Number(row.max_branches_approved ?? row.maxBranchesApproved ?? 1),
    branchExpansionRequested: Number(row.branch_expansion_requested ?? row.branchExpansionRequested ?? 0),
    branchExpansionReason: row.branch_expansion_reason || row.branchExpansionReason || '',
    branchExpansionStatus: (row.branch_expansion_status || row.branchExpansionStatus || 'none') as any,
    termsAcceptedAt: row.terms_accepted_at || row.termsAcceptedAt,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

export async function getCurrentSupplierFromSupabase(): Promise<UserProfile | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    let user = session?.user ?? null;
    if (!user) {
      const {
        data: { user: fetchedUser },
      } = await supabase.auth.getUser();
      user = fetchedUser;
    }
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

export interface UpdateSupplierProfileInput {
  brandName?: string;
  ownerName?: string;
  gender?: Gender;
  phone?: string;
  country?: string;
  governorate?: string;
  currency?: string;
  currencySymbol?: string;
  storeSlug?: string;
  logoUrl?: string;
  businessTypes?: SupplierBusinessType[];
  pricingModes?: SupplierPricingMode[];
  supplySections?: MainSectionId[];
  suppliedMaterials?: string[];
  socials?: {
    facebook?: string;
    instagram?: string;
  };
}

export async function updateSupplierProfileInBackend(
  input: UpdateSupplierProfileInput
): Promise<{ success: boolean; supplier?: SupplierProfile; userProfile?: UserProfile; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/suppliers/profile', {
      method: 'PUT',
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
      return { success: true, supplier: mapped, userProfile: uProf };
    }
    return {
      success: false,
      error: json?.error || `تعذر حفظ بيانات المورد (${res.status})`,
    };
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
  const rawTiers = Array.isArray(r.tier_pricing || r.tierPricing)
    ? r.tier_pricing || r.tierPricing
    : [];
  const tierPricing: SupplierPriceTier[] = rawTiers
    .map((t: any) => ({
      minQty: Math.max(1, Number(t?.minQty ?? t?.min_qty ?? 0)),
      unitPrice: Math.max(0, Number(t?.unitPrice ?? t?.unit_price ?? 0)),
    }))
    .filter((t: SupplierPriceTier) => t.minQty > 0 && t.unitPrice > 0)
    .sort((a: SupplierPriceTier, b: SupplierPriceTier) => a.minQty - b.minQty);

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
    tierPricing,
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
    walkinOrdersCount: Number(r.walkin_orders_count ?? r.walkinOrdersCount ?? 0),
    onlineOrdersCount: Number(r.online_orders_count ?? r.onlineOrdersCount ?? 0),
    lastAddress: r.last_address || r.lastAddress || '',
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

// =============================================================
// Public Suppliers Market & Direct B2B Orders / Receiving
// =============================================================
export interface MarketEntryMapped {
  supplier: SupplierProfile;
  items: SupplierCatalogItem[];
  minRetailPrice: number;
  maxRetailPrice: number;
  minWholesalePrice: number;
  maxWholesalePrice: number;
  hasWholesale: boolean;
  ratingAvg?: number;
  reviewsCount?: number;
}

export async function fetchSuppliersMarket(): Promise<MarketEntryMapped[]> {
  try {
    const res = await fetch('/api/suppliers-market');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.entries)) {
        return json.entries.map((entry: any) => ({
          supplier: mapDbSupplierRowToProfile(entry.supplier),
          items: Array.isArray(entry.items) ? entry.items.map(mapDbCatalogItem) : [],
          minRetailPrice: Number(entry.minRetailPrice || 0),
          maxRetailPrice: Number(entry.maxRetailPrice || 0),
          minWholesalePrice: Number(entry.minWholesalePrice || 0),
          maxWholesalePrice: Number(entry.maxWholesalePrice || 0),
          hasWholesale: Boolean(entry.hasWholesale),
          ratingAvg: Number(entry.ratingAvg ?? entry.supplier?.rating_stars ?? 5),
          reviewsCount: Number(entry.reviewsCount ?? entry.supplier?.reviews_count ?? 0),
        }));
      }
    }
  } catch {}
  return [];
}

export function mapDbSupplierReview(r: any): SupplierReview {
  return {
    id: r.id,
    supplierId: r.supplier_id || r.supplierId || '',
    workshopId: r.workshop_id || r.workshopId || '',
    reviewerName: r.reviewer_name || r.reviewerName || 'فنان بالشمساوية',
    reviewerBrand: r.reviewer_brand || r.reviewerBrand || '',
    reviewerRole: r.reviewer_role || r.reviewerRole || 'artisan',
    rating: Math.min(5, Math.max(1, Number(r.rating || 5))),
    comment: r.comment || '',
    createdAt: r.created_at || r.createdAt,
  };
}

export function mapDbOfferAlert(r: any): SupplierOfferAlert {
  return {
    id: r.id,
    supplierId: r.supplier_id || r.supplierId || '',
    supplierBrand: r.supplier_brand || r.supplierBrand || 'مورد معتمد',
    supplierSlug: r.supplier_slug || r.supplierSlug || '',
    alertType: (r.alert_type || r.alertType || 'offer') as SupplierOfferAlert['alertType'],
    title: r.title || '',
    message: r.message || '',
    sectionId: r.section_id || r.sectionId || 'all',
    discountBadge: r.discount_badge || r.discountBadge || '',
    createdAt: r.created_at || r.createdAt,
  };
}

export async function fetchSupplierReviews(supplierId: string): Promise<{
  reviews: SupplierReview[];
  ratingAvg: number;
  reviewsCount: number;
}> {
  try {
    const res = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/reviews`);
    if (res.ok) {
      const json = await res.json();
      return {
        reviews: Array.isArray(json?.reviews) ? json.reviews.map(mapDbSupplierReview) : [],
        ratingAvg: Number(json?.ratingAvg ?? 5),
        reviewsCount: Number(json?.reviewsCount ?? 0),
      };
    }
  } catch {}
  return { reviews: [], ratingAvg: 5, reviewsCount: 0 };
}

export async function submitSupplierReview(
  supplierId: string,
  payload: {
    rating: number;
    comment: string;
    workshopId?: string;
    reviewerName?: string;
    reviewerBrand?: string;
    reviewerRole?: string;
  }
): Promise<{ success: boolean; review?: SupplierReview; ratingAvg?: number; reviewsCount?: number; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/reviews`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.review) {
      return {
        success: true,
        review: mapDbSupplierReview(json.review),
        ratingAvg: Number(json.ratingAvg ?? 5),
        reviewsCount: Number(json.reviewsCount ?? 0),
      };
    }
    return { success: false, error: json?.error || 'تعذر إرسال التقييم' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال' };
  }
}

export async function fetchSupplierOfferAlerts(): Promise<SupplierOfferAlert[]> {
  try {
    const res = await fetch('/api/suppliers/offer-alerts');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.alerts)) return json.alerts.map(mapDbOfferAlert);
    }
  } catch {}
  return [];
}

export async function publishSupplierOfferAlert(payload: {
  alertType: 'offer' | 'new_stock' | 'price_drop';
  title: string;
  message: string;
  sectionId?: string;
  discountBadge?: string;
}): Promise<{ success: boolean; alert?: SupplierOfferAlert; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/suppliers/offer-alerts', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.alert) {
      return { success: true, alert: mapDbOfferAlert(json.alert) };
    }
    return { success: false, error: json?.error || 'تعذر إرسال التنبيه للورش' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال' };
  }
}

export async function fetchPublicSupplierStore(slug: string): Promise<{
  supplier: SupplierProfile | null;
  items: SupplierCatalogItem[];
  memberProfile?: any;
  reviews?: SupplierReview[];
  ratingAvg?: number;
  reviewsCount?: number;
  suspended?: boolean;
  hiddenStorefront?: boolean;
  suspensionReason?: string;
} | null> {
  try {
    const res = await fetch(`/api/public/supplier-store/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.supplier) return null;
    return {
      supplier: mapDbSupplierRowToProfile(json.supplier),
      items: Array.isArray(json.items) ? json.items.map(mapDbCatalogItem) : [],
      memberProfile: json.memberProfile || null,
      reviews: Array.isArray(json.reviews) ? json.reviews.map(mapDbSupplierReview) : [],
      ratingAvg: Number(json.ratingAvg ?? json.supplier?.rating_stars ?? 5),
      reviewsCount: Number(json.reviewsCount ?? 0),
      suspended: Boolean(json.suspended),
      hiddenStorefront: Boolean(json.hiddenStorefront),
      suspensionReason: json.suspensionReason,
    };
  } catch {
    return null;
  }
}

export async function placeB2BSupplyOrder(payload: {
  supplierId: string;
  workshopId?: string;
  orderSource?: 'suppliers_market' | 'direct_supplier_store';
  items: {
    catalogItemId: string;
    name: string;
    unit: string;
    variantLabel?: string;
    quantity: number;
    retailPrice: number;
    wholesalePrice: number;
    minWholesaleQty: number;
    tierPricing?: SupplierPriceTier[];
    discountType?: 'none' | 'percent' | 'fixed';
    discountValue?: number;
  }[];
  shippingFee?: number;
  discount?: number;
  paidAmount?: number;
  paymentMethod?: string;
  notes?: string;
  buyerInfo?: {
    workshopBrand?: string;
    name?: string;
    phone?: string;
    country?: string;
    governorate?: string;
    address?: string;
  };
}): Promise<{ success: boolean; order?: B2BSupplyOrder; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/b2b/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.order) {
      return { success: true, order: mapDbB2BOrder(json.order) };
    }
    return { success: false, error: json?.error || 'تعذر إرسال طلب التوريد' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال بالخادم' };
  }
}

export interface WorkshopB2BOrderRow extends B2BSupplyOrder {
  supplierBrandName?: string;
  supplierPhone?: string;
  supplierSlug?: string;
  currencySymbol?: string;
}

export async function fetchWorkshopB2BOrders(workshopId: string): Promise<WorkshopB2BOrderRow[]> {
  if (!workshopId) return [];
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/b2b/workshop-orders?workshopId=${encodeURIComponent(workshopId)}`, { headers });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.orders)) {
        return json.orders.map((r: any) => ({
          ...mapDbB2BOrder(r),
          supplierBrandName: r.supplierBrandName || 'مورد معتمد',
          supplierPhone: r.supplierPhone || '',
          supplierSlug: r.supplierSlug || r.supplier_id,
          currencySymbol: r.currencySymbol || 'ج.م',
        }));
      }
    }
  } catch {}
  return [];
}

export async function receiveB2BSupplyOrder(
  orderId: string,
  payload: {
    workshopTreasuryId?: string | null;
    paidAmount?: number;
    paymentMethod?: string;
  }
): Promise<{ success: boolean; alreadySynced?: boolean; order?: B2BSupplyOrder; error?: string }> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`/api/b2b/orders/${encodeURIComponent(orderId)}/receive`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) {
      return {
        success: true,
        alreadySynced: Boolean(json.alreadySynced),
        order: json.order ? mapDbB2BOrder(json.order) : undefined,
      };
    }
    return { success: false, error: json?.error || 'تعذر اعتماد استلام البضاعة' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال بالخادم' };
  }
}

// =============================================================
// Super Admin Suppliers, Customers & Granular Visibility APIs
// =============================================================
export interface AdminEnrichedSupplier extends SupplierProfile {
  itemsCount: number;
  marketItemsCount: number;
  ordersCount: number;
  customersCount: number;
  totalRevenue: number;
}

export async function fetchAdminSuppliers(userEmail?: string): Promise<AdminEnrichedSupplier[]> {
  try {
    const headers = await getAuthHeaders(userEmail ? { 'x-user-email': userEmail } : {});
    const res = await fetch('/api/admin/suppliers', { headers });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.suppliers)) {
        return json.suppliers.map((s: any) => ({
          ...mapDbSupplierRowToProfile(s),
          itemsCount: Number(s.itemsCount || 0),
          marketItemsCount: Number(s.marketItemsCount || 0),
          ordersCount: Number(s.ordersCount || 0),
          customersCount: Number(s.customersCount || 0),
          totalRevenue: Number(s.totalRevenue || 0),
        }));
      }
    }
  } catch {}
  return [];
}

export async function fetchAdminSupplierCatalog(supplierId: string, userEmail?: string): Promise<SupplierCatalogItem[]> {
  try {
    const headers = await getAuthHeaders(userEmail ? { 'x-user-email': userEmail } : {});
    const res = await fetch(`/api/admin/suppliers/${encodeURIComponent(supplierId)}/catalog`, { headers });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.items)) return json.items.map(mapDbCatalogItem);
    }
  } catch {}
  return [];
}

export async function updateSupplierVisibility(
  supplierId: string,
  payload: { hideStorefront?: boolean; hideFromMarket?: boolean },
  userEmail?: string
): Promise<{ success: boolean; cloudSynced?: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders({
      'Content-Type': 'application/json',
      ...(userEmail ? { 'x-user-email': userEmail } : {}),
    });
    const res = await fetch(`/api/admin/suppliers/${encodeURIComponent(supplierId)}/visibility`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    return { success: res.ok && Boolean(json?.success), cloudSynced: json?.cloudSynced, error: json?.error };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function moderateAdminSupplier(
  supplierId: string,
  payload: {
    status?: 'active' | 'suspended' | 'banned';
    isFrozen?: boolean;
    suspensionReason?: string;
    medal?: string | null;
    ratingStars?: number;
    appealStatus?: string;
    rejectionReason?: string;
  },
  userEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders({
      'Content-Type': 'application/json',
      ...(userEmail ? { 'x-user-email': userEmail } : {}),
    });
    const res = await fetch(`/api/admin/suppliers/${encodeURIComponent(supplierId)}/moderation`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    return { success: res.ok && Boolean(json?.success), error: json?.error };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function updateWorkshopVisibility(
  workshopId: string,
  payload: { hideStorefront?: boolean; hideFromMarket?: boolean },
  userEmail?: string
): Promise<{ success: boolean; cloudSynced?: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders({
      'Content-Type': 'application/json',
      ...(userEmail ? { 'x-user-email': userEmail } : {}),
    });
    const res = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/visibility`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    return { success: res.ok && Boolean(json?.success), cloudSynced: json?.cloudSynced, error: json?.error };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function fetchAdminCustomersDirectory(userEmail?: string): Promise<any[]> {
  try {
    const headers = await getAuthHeaders(userEmail ? { 'x-user-email': userEmail } : {});
    const res = await fetch('/api/admin/customers-directory', { headers });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.customers)) return json.customers;
    }
  } catch {}
  return [];
}

export interface AdminSuppliersMarketCatalogRow extends SupplierCatalogItem {
  supplierBrandName: string;
  supplierSlug: string;
  supplierGovernorate: string;
  supplierCurrencySymbol: string;
}

export interface AdminSuppliersMarketReviewRow extends SupplierReview {
  supplierBrandName: string;
}

export interface AdminSuppliersMarketOrderRow extends B2BSupplyOrder {
  supplierBrandName: string;
  currencySymbol: string;
}

export interface AdminSuppliersMarketOverview {
  suppliers: SupplierProfile[];
  catalogItems: AdminSuppliersMarketCatalogRow[];
  offerAlerts: SupplierOfferAlert[];
  reviews: AdminSuppliersMarketReviewRow[];
  b2bOrders: AdminSuppliersMarketOrderRow[];
}

export async function fetchAdminSuppliersMarketOverview(
  userEmail?: string
): Promise<AdminSuppliersMarketOverview> {
  try {
    const headers = await getAuthHeaders(userEmail ? { 'x-user-email': userEmail } : {});
    const res = await fetch('/api/admin/suppliers-market/overview', { headers });
    if (res.ok) {
      const json = await res.json();
      return {
        suppliers: Array.isArray(json?.suppliers)
          ? json.suppliers.map(mapDbSupplierRowToProfile)
          : [],
        catalogItems: Array.isArray(json?.catalogItems)
          ? json.catalogItems.map((it: any) => ({
              ...mapDbCatalogItem(it),
              supplierBrandName: it.supplierBrandName || 'مورد معتمد',
              supplierSlug: it.supplierSlug || it.supplier_id || '',
              supplierGovernorate: it.supplierGovernorate || '',
              supplierCurrencySymbol: it.supplierCurrencySymbol || 'ج.م',
            }))
          : [],
        offerAlerts: Array.isArray(json?.offerAlerts)
          ? json.offerAlerts.map(mapDbOfferAlert)
          : [],
        reviews: Array.isArray(json?.reviews)
          ? json.reviews.map((r: any) => ({
              ...mapDbSupplierReview(r),
              supplierBrandName: r.supplierBrandName || 'مورد',
            }))
          : [],
        b2bOrders: Array.isArray(json?.b2bOrders)
          ? json.b2bOrders.map((o: any) => ({
              ...mapDbB2BOrder(o),
              supplierBrandName: o.supplierBrandName || 'مورد',
              currencySymbol: o.currencySymbol || 'ج.م',
            }))
          : [],
      };
    }
  } catch {}
  return {
    suppliers: [],
    catalogItems: [],
    offerAlerts: [],
    reviews: [],
    b2bOrders: [],
  };
}

export async function adminUpdateSupplierCatalogItem(
  itemId: string,
  payload: { inMarket?: boolean; isApproved?: boolean; retailPrice?: number; wholesalePrice?: number },
  userEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders({
      'Content-Type': 'application/json',
      ...(userEmail ? { 'x-user-email': userEmail } : {}),
    });
    const res = await fetch(`/api/admin/suppliers-market/catalog/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    return { success: res.ok && Boolean(json?.success), error: json?.error };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function adminPublishOfferAlert(
  payload: {
    supplierId?: string;
    supplierBrand?: string;
    supplierSlug?: string;
    alertType?: 'offer' | 'new_arrival' | 'price_drop';
    title: string;
    message: string;
    sectionId?: string;
    discountBadge?: string;
  },
  userEmail?: string
): Promise<{ success: boolean; alert?: SupplierOfferAlert; error?: string }> {
  try {
    const headers = await getAuthHeaders({
      'Content-Type': 'application/json',
      ...(userEmail ? { 'x-user-email': userEmail } : {}),
    });
    const res = await fetch('/api/admin/suppliers-market/offer-alerts', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.alert) {
      return { success: true, alert: mapDbOfferAlert(json.alert) };
    }
    return { success: false, error: json?.error || 'تعذر نشر التنبيه' };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function adminDeleteOfferAlert(
  alertId: string,
  userEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders(userEmail ? { 'x-user-email': userEmail } : {});
    const res = await fetch(`/api/admin/suppliers-market/offer-alerts/${encodeURIComponent(alertId)}`, {
      method: 'DELETE',
      headers,
    });
    const json = await res.json().catch(() => ({}));
    return { success: res.ok && Boolean(json?.success), error: json?.error };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function adminDeleteSupplierReview(
  reviewId: string,
  userEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders(userEmail ? { 'x-user-email': userEmail } : {});
    const res = await fetch(`/api/admin/suppliers-market/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'DELETE',
      headers,
    });
    const json = await res.json().catch(() => ({}));
    return { success: res.ok && Boolean(json?.success), error: json?.error };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function adminUpdateB2BOrderStatus(
  orderId: string,
  payload: { status?: string; notes?: string },
  userEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders({
      'Content-Type': 'application/json',
      ...(userEmail ? { 'x-user-email': userEmail } : {}),
    });
    const res = await fetch(`/api/admin/suppliers-market/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    return { success: res.ok && Boolean(json?.success), error: json?.error };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

