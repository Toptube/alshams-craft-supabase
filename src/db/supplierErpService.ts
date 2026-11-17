import { supabase } from '../lib/supabase';
import {
  LockedTerminalConfig,
  PurchaseLineInput,
  SupplierBranch,
  SupplierBranchInventoryItem,
  SupplierCategoryNode,
  SupplierErpOverview,
  SupplierHrLog,
  SupplierPosOrder,
  SupplierPosShift,
  SupplierPurchaseInvoice,
  SupplierStaffRole,
  SupplierStaffUser,
  SupplierStockMovement,
  SupplierTreasuryTransfer,
  SupplierVendor,
} from '../types/supplierErp';

const KIOSK_LOCK_STORAGE_KEY = 'alshams_locked_terminal_config';
const STAFF_TOKEN_STORAGE_KEY = 'alshams_supplier_staff_token';
export const KIOSK_LOCK_CHANGED_EVENT = 'alshams_kiosk_lock_changed';

export function getLockedTerminalConfig(): LockedTerminalConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KIOSK_LOCK_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LockedTerminalConfig) : null;
  } catch {
    return null;
  }
}

export function setLockedTerminalConfig(cfg: LockedTerminalConfig) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KIOSK_LOCK_STORAGE_KEY, JSON.stringify(cfg));
  window.dispatchEvent(new CustomEvent(KIOSK_LOCK_CHANGED_EVENT, { detail: cfg }));
}

export function clearLockedTerminalConfig() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KIOSK_LOCK_STORAGE_KEY);
  localStorage.removeItem(STAFF_TOKEN_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(KIOSK_LOCK_CHANGED_EVENT, { detail: null }));
}

export function getStaffTerminalToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STAFF_TOKEN_STORAGE_KEY) || '';
}

export function setStaffTerminalToken(token: string) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(STAFF_TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(STAFF_TOKEN_STORAGE_KEY);
}

let cachedErpAuth: { headers: Record<string, string>; ts: number } | null = null;
let inFlightErpAuth: Promise<Record<string, string>> | null = null;

async function erpHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  const staffToken = getStaffTerminalToken();
  if (staffToken) {
    headers['x-staff-token'] = staffToken;
  }
  const now = Date.now();
  if (cachedErpAuth && now - cachedErpAuth.ts < 3000) {
    return { ...cachedErpAuth.headers, ...headers };
  }
  if (!inFlightErpAuth) {
    inFlightErpAuth = (async () => {
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
      cachedErpAuth = { headers: base, ts: Date.now() };
      return base;
    })().finally(() => {
      inFlightErpAuth = null;
    });
  }
  const base = await inFlightErpAuth;
  return { ...base, ...headers };
}

export async function fetchSupplierErpOverview(): Promise<SupplierErpOverview | null> {
  try {
    const headers = await erpHeaders();
    const res = await fetch('/api/supplier/erp/overview', { headers });
    if (res.ok) {
      const json = await res.json();
      return json?.overview || null;
    }
  } catch {}
  return null;
}

export async function saveSupplierErpTree(payload: {
  hasCentralWarehouse?: boolean;
  ownerUnlockPin?: string;
  newBranch?: { name: string; governorate?: string; address?: string; phone?: string };
  updateBranch?: { id: string; name?: string; governorate?: string; address?: string; phone?: string; isActive?: boolean };
}): Promise<{ success: boolean; branches?: SupplierBranch[]; requiresAdminApproval?: boolean; error?: string }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/supplier/erp/tree', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      requiresAdminApproval: Boolean(json?.requiresAdminApproval),
      error: json?.error || 'تعذر حفظ شجرة الفروع',
    };
  }
  return { success: true, branches: json?.branches || [] };
}

export async function requestBranchExpansion(requestedCount: number, reason: string) {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/supplier/erp/request-branches', {
    method: 'POST',
    headers,
    body: JSON.stringify({ requestedCount, reason }),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function approveSupplierBranchExpansion(
  supplierId: string,
  approve: boolean,
  approvedMaxBranches: number,
  userEmail?: string
) {
  const headers = await erpHeaders({
    'Content-Type': 'application/json',
    ...(userEmail ? { 'x-user-email': userEmail } : {}),
  });
  const res = await fetch(`/api/admin/suppliers/${encodeURIComponent(supplierId)}/branch-approval`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ approve, approvedMaxBranches }),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function fetchAdminSupplierBranches(supplierId: string, userEmail?: string) {
  const headers = await erpHeaders(userEmail ? { 'x-user-email': userEmail } : {});
  const res = await fetch(`/api/admin/suppliers/${encodeURIComponent(supplierId)}/branches`, { headers });
  if (!res.ok) return { branches: [], branchTreasuries: [], totalItemsCount: 0 };
  return res.json();
}

export async function fetchErpCategories(): Promise<SupplierCategoryNode[]> {
  try {
    const headers = await erpHeaders();
    const res = await fetch('/api/supplier/erp/categories', { headers });
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json?.categories) ? json.categories : [];
    }
  } catch {}
  return [];
}

export async function saveErpCategory(name: string, parentId?: string | null): Promise<{ success: boolean; category?: SupplierCategoryNode }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/supplier/erp/categories', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, parentId: parentId || null }),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function deleteErpCategory(id: string): Promise<boolean> {
  const headers = await erpHeaders();
  const res = await fetch(`/api/supplier/erp/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
  return res.ok;
}

export async function fetchBranchInventory(branchId?: string): Promise<SupplierBranchInventoryItem[]> {
  try {
    const headers = await erpHeaders();
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    const res = await fetch(`/api/supplier/erp/inventory${qs}`, { headers });
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json?.items) ? json.items : [];
    }
  } catch {}
  return [];
}

export async function upsertBranchInventoryItem(payload: {
  id?: string;
  branchId: string;
  itemId?: string;
  skuCode?: string;
  itemName: string;
  categoryId?: string;
  subCategoryId?: string;
  purchaseUnit: string;
  saleUnit: string;
  conversionFactor: number;
  purchasePackages?: number;
  quantity?: number;
  minAlert?: number;
  avgCost: number;
  retailPrice: number;
  wholesalePrice: number;
}): Promise<{ success: boolean; item?: SupplierBranchInventoryItem; error?: string }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/supplier/erp/inventory', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function transferWarehouseStock(payload: {
  fromBranchId: string;
  toBranchId: string;
  itemId: string;
  quantity: number;
  notes?: string;
  requireConfirmation?: boolean;
}): Promise<{ success: boolean; pendingConfirmation?: boolean; referenceNo?: string; error?: string }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/supplier/erp/transfer', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function fetchPendingStockTransfers(): Promise<SupplierStockMovement[]> {
  try {
    const headers = await erpHeaders();
    const res = await fetch('/api/supplier/erp/transfers/pending', { headers });
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json?.transfers) ? json.transfers : [];
    }
  } catch {}
  return [];
}

export async function confirmStockTransferReceipt(
  movementId: string,
  approve: boolean
): Promise<{ success: boolean; approved?: boolean; error?: string }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`/api/supplier/erp/transfer/${encodeURIComponent(movementId)}/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ approve }),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function fetchItemHistoryCard(itemId: string, branchId?: string): Promise<SupplierStockMovement[]> {
  try {
    const headers = await erpHeaders();
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    const res = await fetch(`/api/supplier/erp/item-card/${encodeURIComponent(itemId)}${qs}`, { headers });
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json?.movements) ? json.movements : [];
    }
  } catch {}
  return [];
}

export async function fetchErpVendors(): Promise<SupplierVendor[]> {
  try {
    const headers = await erpHeaders();
    const res = await fetch('/api/supplier/erp/vendors', { headers });
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json?.vendors) ? json.vendors : [];
    }
  } catch {}
  return [];
}

export async function saveErpVendor(payload: {
  id?: string;
  name: string;
  phone?: string;
  vendorType?: string;
  address?: string;
  balanceOwed?: number;
  notes?: string;
}): Promise<{ success: boolean; vendor?: SupplierVendor }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/supplier/erp/vendors', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function fetchErpPurchases(): Promise<SupplierPurchaseInvoice[]> {
  try {
    const headers = await erpHeaders();
    const res = await fetch('/api/supplier/erp/purchases', { headers });
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json?.purchases) ? json.purchases : [];
    }
  } catch {}
  return [];
}

export async function createErpPurchaseInvoice(payload: {
  branchId: string;
  vendorId?: string;
  vendorName?: string;
  invoiceNo?: string;
  items: PurchaseLineInput[];
  paidAmount: number;
  treasuryChannel: 'cash' | 'instapay' | 'wallet' | 'credit';
  notes?: string;
}): Promise<{ success: boolean; purchase?: SupplierPurchaseInvoice; error?: string }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/supplier/erp/purchases', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function fetchBranchShifts(branchId?: string): Promise<SupplierPosShift[]> {
  try {
    const headers = await erpHeaders();
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    const res = await fetch(`/api/supplier/erp/shifts${qs}`, { headers });
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json?.shifts) ? json.shifts : [];
    }
  } catch {}
  return [];
}

export async function openPosShift(branchId: string, openingCash = 0): Promise<{ success: boolean; shift?: SupplierPosShift }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/supplier/erp/shifts/open', {
    method: 'POST',
    headers,
    body: JSON.stringify({ branchId, openingCash }),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function closePosShift(shiftId: string): Promise<{ success: boolean; shift?: SupplierPosShift }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`/api/supplier/erp/shifts/${encodeURIComponent(shiftId)}/close`, {
    method: 'POST',
    headers,
  });
  return res.json().catch(() => ({ success: false }));
}

export async function fetchPosOrders(branchId?: string): Promise<SupplierPosOrder[]> {
  try {
    const headers = await erpHeaders();
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    const res = await fetch(`/api/supplier/erp/pos-orders${qs}`, { headers });
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json?.orders) ? json.orders : [];
    }
  } catch {}
  return [];
}

export async function createPosOrder(payload: {
  branchId: string;
  shiftId?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  salesChannel: 'branch_walkin' | 'online';
  deliveryGovernorate?: string;
  deliveryAddress?: string;
  shippingFee?: number;
  items: Array<{
    inventoryId: string;
    itemId: string;
    skuCode: string;
    itemName: string;
    saleUnit: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
  }>;
  discount?: number;
  paidAmount: number;
  paymentMethod: 'cash' | 'instapay' | 'wallet' | 'credit';
  notes?: string;
}): Promise<{ success: boolean; order?: SupplierPosOrder; shift?: SupplierPosShift; error?: string }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/supplier/erp/pos-orders', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function submitBranchTreasuryTransfer(payload: {
  branchId: string;
  cashAmount?: number;
  instapayAmount?: number;
  walletAmount?: number;
  notes?: string;
}): Promise<{ success: boolean; transfer?: SupplierTreasuryTransfer; error?: string }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/supplier/erp/treasury-transfers', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function confirmOwnerTreasuryTransfer(
  transferId: string,
  approve: boolean
): Promise<{ success: boolean; transfer?: SupplierTreasuryTransfer; error?: string }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`/api/supplier/erp/treasury-transfers/${encodeURIComponent(transferId)}/confirm`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ approve }),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function fetchSupplierStaffAndHr(): Promise<{ staff: SupplierStaffUser[]; hrLogs: SupplierHrLog[] }> {
  try {
    const headers = await erpHeaders();
    const res = await fetch('/api/supplier/erp/staff', { headers });
    if (res.ok) {
      const json = await res.json();
      return {
        staff: Array.isArray(json?.staff) ? json.staff : [],
        hrLogs: Array.isArray(json?.hrLogs) ? json.hrLogs : [],
      };
    }
  } catch {}
  return { staff: [], hrLogs: [] };
}

export async function saveSupplierStaffUser(payload: {
  id?: string;
  branchId?: string | null;
  fullName: string;
  username: string;
  password?: string;
  role: SupplierStaffRole;
  jobTitle?: string;
  phone?: string;
  baseSalary: number;
  isActive?: boolean;
}): Promise<{ success: boolean; staff?: SupplierStaffUser; error?: string }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/supplier/erp/staff', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function addSupplierHrLog(payload: {
  staffId: string;
  branchId?: string | null;
  logType: SupplierHrLog['logType'];
  amount?: number;
  notes?: string;
}): Promise<{ success: boolean; hrLog?: SupplierHrLog }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/supplier/erp/hr-logs', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function staffTerminalLogin(payload: {
  supplierId: string;
  branchId?: string;
  username: string;
  password: string;
  deviceToken?: string;
}): Promise<{ success: boolean; staffToken?: string; staff?: SupplierStaffUser; clientIp?: string; error?: string }> {
  const res = await fetch('/api/supplier/erp/staff-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function bindDeviceTerminal(): Promise<{ success: boolean; deviceToken?: string; boundIp?: string; lockedAt?: string }> {
  const headers = await erpHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/supplier/erp/device-bind', {
    method: 'POST',
    headers,
  });
  return res.json().catch(() => ({ success: false }));
}

export async function unlockDeviceTerminal(supplierId: string, ownerPin: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/supplier/erp/device-unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supplierId, ownerPin }),
  });
  return res.json().catch(() => ({ success: false }));
}
