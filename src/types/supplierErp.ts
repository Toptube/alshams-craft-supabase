export type SupplierBranchType = 'central_warehouse' | 'shop';
export type SupplierStaffRole =
  | 'cashier'
  | 'warehouse'
  | 'accountant'
  | 'hr_manager'
  | 'branch_manager';

export type TerminalModuleKey = 'pos' | 'warehouse' | 'finance';

export interface SupplierBranch {
  id: string;
  supplierId: string;
  name: string;
  code: string;
  branchType: SupplierBranchType;
  governorate?: string;
  address?: string;
  phone?: string;
  posEnabled: boolean;
  isActive: boolean;
  status: 'active' | 'pending_approval';
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierCategoryNode {
  id: string;
  supplierId: string;
  parentId?: string | null;
  name: string;
  createdAt?: string;
}

/** Zero-Image Branch Inventory Item with Package->Sale Unit Conversion */
export interface SupplierBranchInventoryItem {
  id: string;
  supplierId: string;
  branchId: string;
  itemId: string;
  skuCode: string;
  itemName: string;
  categoryId?: string;
  subCategoryId?: string;
  purchaseUnit: string;
  saleUnit: string;
  conversionFactor: number;
  quantity: number;
  minAlert: number;
  avgCost: number;
  retailPrice: number;
  wholesalePrice: number;
  updatedAt?: string;
}

export type StockMovementType =
  | 'purchase_in'
  | 'transfer_out'
  | 'transfer_in'
  | 'transfer_pending'
  | 'transfer_rejected'
  | 'pos_sale'
  | 'b2b_sale'
  | 'adjustment';

export interface SupplierStockMovement {
  id: string;
  supplierId: string;
  branchId: string;
  toBranchId?: string | null;
  itemId: string;
  skuCode?: string;
  itemName: string;
  movementType: StockMovementType;
  qtyDelta: number;
  balanceAfter: number;
  unitLabel: string;
  unitCost: number;
  referenceNo?: string;
  actorStaffId?: string;
  actorName: string;
  notes?: string;
  createdAt?: string;
}

export interface SupplierStaffUser {
  id: string;
  supplierId: string;
  branchId?: string | null;
  fullName: string;
  username: string;
  role: SupplierStaffRole;
  jobTitle?: string;
  phone?: string;
  baseSalary: number;
  isActive: boolean;
  deviceLockToken?: string;
  deviceIp?: string;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export type HrLogType =
  | 'attendance_in'
  | 'attendance_out'
  | 'penalty'
  | 'bonus'
  | 'advance'
  | 'salary_paid';

export interface SupplierHrLog {
  id: string;
  supplierId: string;
  staffId: string;
  branchId?: string | null;
  logType: HrLogType;
  amount: number;
  notes?: string;
  actorName?: string;
  eventTime: string;
  createdAt?: string;
}

export interface SupplierPosShift {
  id: string;
  supplierId: string;
  branchId: string;
  staffId?: string;
  staffName: string;
  openedAt: string;
  closedAt?: string | null;
  closedByName?: string;
  openingCash: number;
  cashTotal: number;
  instapayTotal: number;
  walletTotal: number;
  deferredTotal: number;
  ordersCount: number;
  status: 'open' | 'closed';
  settledToBranchAt?: string | null;
}

export interface SupplierBranchTreasury {
  id: string;
  supplierId: string;
  branchId: string;
  cashBalance: number;
  instapayBalance: number;
  walletBalance: number;
  updatedAt?: string;
}

export interface SupplierTreasuryTransfer {
  id: string;
  supplierId: string;
  branchId: string;
  branchName: string;
  shiftId?: string | null;
  sentByName: string;
  cashAmount: number;
  instapayAmount: number;
  walletAmount: number;
  totalAmount: number;
  status: 'pending_owner_confirmation' | 'confirmed' | 'rejected';
  confirmedBy?: string;
  confirmedAt?: string | null;
  notes?: string;
  createdAt?: string;
}

export interface PosOrderLineItem {
  inventoryId: string;
  itemId: string;
  skuCode: string;
  itemName: string;
  saleUnit: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
}

export type PosPaymentMethod = 'cash' | 'instapay' | 'wallet' | 'credit';
export type PosSalesChannel = 'branch_walkin' | 'online';

export interface SupplierPosOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  branchId: string;
  shiftId?: string | null;
  staffId?: string;
  staffName: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  salesChannel: PosSalesChannel;
  deliveryGovernorate?: string;
  deliveryAddress?: string;
  shippingFee: number;
  items: PosOrderLineItem[];
  subtotal: number;
  discount: number;
  finalTotal: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: PosPaymentMethod;
  paymentStatus: 'paid' | 'partial' | 'credit';
  notes?: string;
  createdAt?: string;
}

export interface SupplierVendor {
  id: string;
  supplierId: string;
  name: string;
  phone?: string;
  vendorType?: string;
  address?: string;
  balanceOwed: number;
  notes?: string;
  createdAt?: string;
}

export interface PurchaseLineInput {
  itemId?: string;
  skuCode?: string;
  itemName: string;
  categoryId?: string;
  subCategoryId?: string;
  purchaseUnit: string;
  saleUnit: string;
  conversionFactor: number;
  purchaseQty: number;
  packageCost: number;
  retailPrice?: number;
  wholesalePrice?: number;
}

export interface SupplierPurchaseInvoice {
  id: string;
  supplierId: string;
  branchId: string;
  vendorId?: string | null;
  vendorName?: string;
  invoiceNo: string;
  items: PurchaseLineInput[];
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  treasuryChannel: 'cash' | 'instapay' | 'wallet' | 'credit';
  actorName: string;
  notes?: string;
  createdAt?: string;
}

export interface SupplierErpOverview {
  supplierId: string;
  brandName: string;
  currencySymbol: string;
  hasCentralWarehouse: boolean;
  maxBranchesApproved: number;
  branchExpansionRequested: number;
  branchExpansionReason: string;
  branchExpansionStatus: 'none' | 'pending' | 'approved' | 'rejected';
  ownerUnlockPinSet: boolean;
  branches: SupplierBranch[];
  branchTreasuries: SupplierBranchTreasury[];
  pendingTransfers: SupplierTreasuryTransfer[];
  confirmedTransfersCount: number;
  openShifts: SupplierPosShift[];
  kpis: {
    ownerMainTreasuryTotal: number;
    branchesPendingTreasuryTotal: number;
    totalCashOnHand: number;
    receivablesFromCustomers: number;
    payablesToVendors: number;
    totalStockValuation: number;
    todayPosSales: number;
    todayPosOrdersCount: number;
  };
}

export interface LockedTerminalConfig {
  supplierId: string;
  supplierBrand: string;
  branchId: string;
  branchName: string;
  moduleKey: TerminalModuleKey;
  deviceToken: string;
  boundIp?: string;
  rememberStaffId?: string;
  rememberUsername?: string;
  activeStaff?: {
    id: string;
    fullName: string;
    username: string;
    role: SupplierStaffRole;
  } | null;
  lockedAt: string;
}

// Precision math helpers (3 decimal places for fractional weights e.g. 2.450 kg)
export function round3(n: number): number {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function convertPurchaseToSaleQty(purchaseQty: number, conversionFactor: number): number {
  const f = Math.max(0.001, Number(conversionFactor) || 1);
  return round3((Number(purchaseQty) || 0) * f);
}

export function calculateFractionalLineTotal(saleQty: number, unitPrice: number): number {
  return round2((Number(saleQty) || 0) * (Number(unitPrice) || 0));
}

export function generateAutoSku(prefix = 'MAT'): string {
  const cleanPrefix = String(prefix || 'MAT')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4) || 'MAT';
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${cleanPrefix}-${num}`;
}

export const COMMON_PURCHASE_UNITS = ['طرد', 'كرتونة', 'شيكارة', 'بالة', 'لفة كبيرة', 'دستة', 'كيلو', 'قطعة'];
export const COMMON_SALE_UNITS = ['كيلو', 'جرام', 'متر', 'بكرة', 'قطعة', 'لتر', 'شلة'];

export const STAFF_ROLE_LABELS: Record<SupplierStaffRole, string> = {
  cashier: 'كاشير نقاط البيع (POS)',
  warehouse: 'أمين مخزن',
  accountant: 'محاسب مالي',
  hr_manager: 'مسؤول شؤون عاملين (HR)',
  branch_manager: 'مدير فرع',
};
