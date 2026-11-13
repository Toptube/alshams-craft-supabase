import { MarketplaceCartItem, CustomerAuthUser, InvoiceRecord } from '../types';
import { tenantStorage } from '../db/dexieDB';
import { supabase } from '../lib/supabase';
import { dispatchArtisanNotification } from '../lib/pushNotifications';
import { playPostaNotificationSound } from '../lib/sounds';
import { enqueueOfflineMutation } from '../db/offlineMutationQueue';

const CART_STORAGE_KEY = 'alshams_marketplace_cart';
const CUSTOMER_STORAGE_KEY = 'alshams_customer_session';
const SHIPPING_RATES_KEY = 'alshams_shipping_rates';
const PRIVACY_TOGGLE_KEY = 'alshams_central_shipping_privacy';
const REVIEWS_STORAGE_KEY = 'alshams_marketplace_reviews';
const MARKETPLACE_ORDERS_KEY = 'alshams_marketplace_central_orders';

export const OFFICIAL_PAYMENT_PHONE = '01000996059';
export const OFFICIAL_SUPPORT_PHONE = '01000996059';
export const ADVANCE_PAYMENT_MIN_RATIO = 0.33; // 33%

export interface GovernoratesShippingConfig {
  governorateRates: Record<string, number>;
  packagingFee: number; // مصاريف التغليف والحفظ
  storageAndHandlingFee: number; // مصاريف الفحص والمناولة
  commissionPercent?: number;
  advancePaymentRatio?: number;
}

export const DEFAULT_SHIPPING_CONFIG: GovernoratesShippingConfig = {
  governorateRates: {
    'القاهرة': 50,
    'الجيزة': 50,
    'الإسكندرية': 65,
    'القليوبية': 65,
    'المنوفية': 70,
    'الغربية': 70,
    'الدقهلية': 75,
    'الشرقية': 75,
    'كفر الشيخ': 75,
    'البحيرة': 75,
    'دمياط': 75,
    'بورسعيد': 80,
    'الإسماعيلية': 80,
    'السويس': 80,
    'الفيوم': 85,
    'بني سويف': 85,
    'المنيا': 90,
    'أسيوط': 100,
    'سوهاج': 105,
    'قنا': 110,
    'الأقصر': 115,
    'أسوان': 120,
    'البحر الأحمر': 135,
    'جنوب سيناء': 140,
    'شمال سيناء': 140,
    'مطروح': 135,
    'الوادي الجديد': 145,
  },
  packagingFee: 25,
  storageAndHandlingFee: 20,
};

// Helper to set cookie for 30 days
function setCookie(name: string, value: string, days = 30) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

// 1. Cart Management
export function getStoredCart(): MarketplaceCartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY) || getCookie(CART_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed reading cart:', e);
  }
  return [];
}

export function saveStoredCart(cart: MarketplaceCartItem[]): void {
  try {
    const raw = JSON.stringify(cart);
    localStorage.setItem(CART_STORAGE_KEY, raw);
    setCookie(CART_STORAGE_KEY, raw);
    window.dispatchEvent(new CustomEvent('alshams_cart_updated', { detail: cart }));
  } catch (e) {
    console.warn('Failed saving cart:', e);
  }
}

export function addToCart(item: MarketplaceCartItem): MarketplaceCartItem[] {
  const current = getStoredCart();
  const existingIndex = current.findIndex(
    (c) =>
      c.productId === item.productId &&
      c.selectedColor === item.selectedColor &&
      c.selectedSize === item.selectedSize
  );

  if (existingIndex > -1) {
    current[existingIndex].quantity += item.quantity;
    if (item.customNotes) {
      current[existingIndex].customNotes = item.customNotes;
    }
  } else {
    current.push({
      ...item,
      id: 'cart_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    });
  }

  saveStoredCart(current);
  return current;
}

export function updateCartItemQuantity(cartItemId: string, newQty: number): MarketplaceCartItem[] {
  const current = getStoredCart();
  if (newQty <= 0) {
    return removeCartItem(cartItemId);
  }
  const item = current.find((c) => c.id === cartItemId);
  if (item) {
    item.quantity = newQty;
    saveStoredCart(current);
  }
  return current;
}

export function removeCartItem(cartItemId: string): MarketplaceCartItem[] {
  const current = getStoredCart().filter((c) => c.id !== cartItemId);
  saveStoredCart(current);
  return current;
}

export function clearCart(): void {
  saveStoredCart([]);
}

// 2. Customer Auth & Session
export function getStoredCustomerSession(): CustomerAuthUser | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY) || getCookie(CUSTOMER_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed reading customer session:', e);
  }
  return null;
}

export function saveStoredCustomerSession(customer: CustomerAuthUser | null): void {
  try {
    if (customer) {
      const raw = JSON.stringify(customer);
      localStorage.setItem(CUSTOMER_STORAGE_KEY, raw);
      setCookie(CUSTOMER_STORAGE_KEY, raw);
    } else {
      localStorage.removeItem(CUSTOMER_STORAGE_KEY);
      if (typeof document !== 'undefined') {
        document.cookie = `${CUSTOMER_STORAGE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    }
    window.dispatchEvent(new CustomEvent('alshams_customer_updated', { detail: customer }));
  } catch (e) {
    console.warn('Failed saving customer session:', e);
  }
}

// 3. Shipping Rates Config
export function getShippingConfig(): GovernoratesShippingConfig {
  try {
    const raw = localStorage.getItem(SHIPPING_RATES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SHIPPING_CONFIG,
        ...parsed,
        governorateRates: {
          ...DEFAULT_SHIPPING_CONFIG.governorateRates,
          ...(parsed.governorateRates || {}),
        },
      };
    }
  } catch (e) {
    console.warn('Failed reading shipping config:', e);
  }
  return DEFAULT_SHIPPING_CONFIG;
}

export function saveShippingConfig(cfg: GovernoratesShippingConfig): void {
  try {
    localStorage.setItem(SHIPPING_RATES_KEY, JSON.stringify(cfg));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alshams_shipping_updated', { detail: cfg }));
    }
  } catch (e) {
    console.warn('Failed saving shipping config:', e);
  }
}

export function calculateShippingRate(governorate: string): number {
  const cfg = getShippingConfig();
  return cfg.governorateRates[governorate] ?? 70;
}

// 4. Client Privacy Toggle (Super Admin)
// Default is TRUE (hidden client contact details from artisan unless superadmin enables it)
export function getClientPrivacyActive(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(PRIVACY_TOGGLE_KEY);
  if (raw === null) return true; // default true
  return raw === 'true';
}

export function setClientPrivacyActive(active: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRIVACY_TOGGLE_KEY, String(active));
  window.dispatchEvent(new CustomEvent('alshams_privacy_updated', { detail: active }));
}

export async function syncPlatformSettingsFromCloud(): Promise<GovernoratesShippingConfig | null> {
  try {
    const res = await fetch('/api/platform-settings');
    if (res.ok) {
      const data = await res.json();
      const s = data?.settings;
      if (s) {
        const mergedCfg: GovernoratesShippingConfig = {
          ...DEFAULT_SHIPPING_CONFIG,
          ...s,
          governorateRates: {
            ...DEFAULT_SHIPPING_CONFIG.governorateRates,
            ...(s.governorateRates || {}),
          },
        };
        saveShippingConfig(mergedCfg);
        if (typeof s.centralShippingPrivacy === 'boolean') {
          setClientPrivacyActive(s.centralShippingPrivacy);
        }
        return mergedCfg;
      }
    }
  } catch {}
  return null;
}

// 5. Central Marketplace Orders Storage
export function getCentralMarketplaceOrders(): InvoiceRecord[] {
  try {
    const raw = localStorage.getItem(MARKETPLACE_ORDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed reading central marketplace orders:', e);
  }
  return [];
}

export function saveCentralMarketplaceOrder(order: InvoiceRecord): void {
  try {
    const orders = getCentralMarketplaceOrders();
    const existingIndex = orders.findIndex((o) => o.id === order.id);
    if (existingIndex > -1) {
      orders[existingIndex] = order;
    } else {
      orders.unshift(order);
    }
    localStorage.setItem(MARKETPLACE_ORDERS_KEY, JSON.stringify(orders));

    // Also persist to Dexie tenant storage under the order's workshopId or 'central'
    const workshopId = order.workshopId || order.tenantId || 'central';
    tenantStorage.saveOrder(order).catch((err) => console.warn('Dexie save order error:', err));

    // 1. Instant Artisan & Workshop Notification in Dexie
    const notifItem = {
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      tenantId: workshopId,
      title: `🛍️ طلبية جديدة برقم #${order.invoiceNumber}!`,
      message: `تم استلام طلبية جديدة بقيمة ${order.finalTotal} ج.م (عربون: ${order.advancePaymentAmount} ج.م) من العميل: ${order.customerName}`,
      type: 'order' as const,
      isRead: false,
      timestamp: Date.now(),
      createdAt: Date.now(),
    };
    tenantStorage.putNotification(notifItem).catch(() => {});

    // 2. Play Audio Alert
    try {
      playPostaNotificationSound();
    } catch {}

    // 3. Web Push Notification
    dispatchArtisanNotification(`🛍️ طلبية شراء جديدة #${order.invoiceNumber}`, {
      body: `طلب جديد بقيمة ${order.finalTotal} ج.م - مطلوب تجهيز المشغولات لتسليم الطلبية.`,
      tag: `order-${order.id}`,
    }).catch(() => {});

    // 4. Broadcast global event for live panels
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alshams_new_order_received', { detail: order }));
    }

    // 5. Cloud Sync via server /api/marketplace/orders (with Supabase & offline queue fallback)
    const cloudPayload = {
      id: order.id,
      order_number: order.invoiceNumber || `SHAMS-${Date.now().toString().slice(-5)}`,
      workshop_id: workshopId,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      customer_address: order.detailedAddress || '',
      governorate: order.governorate || 'القاهرة',
      items: order.items || [],
      subtotal: order.subtotal || 0,
      shipping_fee: order.shipping || order.shippingCost || 0,
      total_amount: order.finalTotal || order.totalAmount || 0,
      deposit_paid: order.advancePaymentAmount || order.paidAmount || 0,
      remaining_amount: order.remainingAmount || 0,
      payment_method: order.paymentMethod || 'vodafone_cash',
      status: 'pending',
      marketplaceStatus: order.marketplaceStatus || 'pending_approval',
      advancePaymentConfirmed: Boolean(order.advancePaymentConfirmed),
      isClientDataHiddenFromArtisan: order.isClientDataHiddenFromArtisan !== false,
      notes: order.notes || '',
      created_at: new Date(order.createdAt || Date.now()).toISOString(),
      updated_at: new Date(order.updatedAt || Date.now()).toISOString(),
    };

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      fetch('/api/marketplace/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cloudPayload),
      })
        .then(async (res) => {
          if (!res.ok) {
            const { error } = await supabase.from('marketplace_orders').insert({
              id: cloudPayload.id,
              order_number: cloudPayload.order_number,
              workshop_id: cloudPayload.workshop_id,
              customer_name: cloudPayload.customer_name,
              customer_phone: cloudPayload.customer_phone,
              customer_address: cloudPayload.customer_address,
              governorate: cloudPayload.governorate,
              items: cloudPayload.items,
              subtotal: cloudPayload.subtotal,
              shipping_fee: cloudPayload.shipping_fee,
              total_amount: cloudPayload.total_amount,
              deposit_paid: cloudPayload.deposit_paid,
              remaining_amount: cloudPayload.remaining_amount,
              payment_method: cloudPayload.payment_method,
              status: cloudPayload.status,
              notes: cloudPayload.notes,
              created_at: cloudPayload.created_at,
              updated_at: cloudPayload.updated_at,
            });
            if (error) {
              enqueueOfflineMutation({ workshopId, type: 'order_create', payload: cloudPayload });
            }
          }
        })
        .catch(() => {
          enqueueOfflineMutation({ workshopId, type: 'order_create', payload: cloudPayload });
        });
    } else {
      enqueueOfflineMutation({ workshopId, type: 'order_create', payload: cloudPayload });
    }
  } catch (e) {
    console.warn('Failed saving central order:', e);
  }
}

export function mergeCloudOrdersIntoLocal(cloudOrders: any[]): InvoiceRecord[] {
  const local = getCentralMarketplaceOrders();
  const map = new Map<string, any>();
  local.forEach((o) => {
    if (o && o.id) map.set(o.id, o);
  });

  (cloudOrders || []).forEach((row: any) => {
    if (!row || !row.id) return;
    const prev = map.get(row.id) || {};
    const metaMatch = String(row.notes || '').match(/\[META:([^\]]+)\]/);
    let hidden = row.isClientDataHiddenFromArtisan;
    let confirmed = row.advancePaymentConfirmed;
    let mpStatus = row.marketplaceStatus;
    if (metaMatch) {
      if (hidden === undefined) hidden = !metaMatch[1].includes('hidden=0');
      if (confirmed === undefined) confirmed = metaMatch[1].includes('confirmed=1');
      if (!mpStatus) {
        const mSt = metaMatch[1].match(/mpStatus=([^;\]]+)/);
        if (mSt) mpStatus = mSt[1];
      }
    }
    const cleanNotes = String(row.notes || prev.notes || '').replace(/\[META:[^\]]+\]/g, '').trim();
    map.set(row.id, {
      ...prev,
      id: row.id,
      invoiceNumber: row.invoiceNumber || row.order_number || prev.invoiceNumber || row.id,
      workshopId: row.workshopId || row.workshop_id || prev.workshopId || 'central',
      tenantId: row.workshopId || row.workshop_id || prev.tenantId || 'central',
      customerName: row.customerName || row.customer_name || prev.customerName || 'عميل',
      customerPhone: row.customerPhone || row.customer_phone || prev.customerPhone || '',
      detailedAddress: row.detailedAddress || row.customer_address || prev.detailedAddress || '',
      governorate: row.governorate || prev.governorate || 'القاهرة',
      items: Array.isArray(row.items) ? row.items : (prev.items || []),
      subtotal: Number(row.subtotal ?? prev.subtotal ?? 0),
      shipping: Number(row.shipping_fee ?? row.shippingCost ?? prev.shipping ?? 0),
      shippingCost: Number(row.shippingCost ?? row.shipping_fee ?? prev.shippingCost ?? 0),
      finalTotal: Number(row.finalTotal ?? row.total_amount ?? prev.finalTotal ?? 0),
      totalAmount: Number(row.totalAmount ?? row.total_amount ?? row.finalTotal ?? prev.totalAmount ?? 0),
      advancePaymentAmount: Number(row.advancePaymentAmount ?? row.deposit_paid ?? prev.advancePaymentAmount ?? 0),
      remainingAmount: Number(row.remainingAmount ?? row.remaining_amount ?? prev.remainingAmount ?? 0),
      paymentMethod: row.paymentMethod || row.payment_method || prev.paymentMethod || 'instapay',
      status: row.status || prev.status || 'pending',
      marketplaceStatus: mpStatus || prev.marketplaceStatus || 'pending_approval',
      advancePaymentConfirmed: confirmed !== undefined ? Boolean(confirmed) : Boolean(prev.advancePaymentConfirmed),
      isClientDataHiddenFromArtisan: hidden !== undefined ? Boolean(hidden) : (prev.isClientDataHiddenFromArtisan !== false),
      notes: cleanNotes || undefined,
      targetDeliveryDate: row.targetDeliveryDate || prev.targetDeliveryDate,
      createdAt: prev.createdAt || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
      updatedAt: row.updatedAt || (row.updated_at ? new Date(row.updated_at).getTime() : Date.now()),
    });
  });

  const merged = Array.from(map.values()).sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
  try {
    localStorage.setItem(MARKETPLACE_ORDERS_KEY, JSON.stringify(merged));
  } catch {}
  return merged;
}

export async function updateCentralMarketplaceOrderStatus(
  orderId: string,
  updates: Partial<InvoiceRecord>,
  userEmail?: string
): Promise<{ success: boolean; cloudSynced?: boolean }> {
  const orders = getCentralMarketplaceOrders();
  const order = orders.find((o) => o.id === orderId);
  if (order) {
    Object.assign(order, updates, { updatedAt: Date.now() });
    localStorage.setItem(MARKETPLACE_ORDERS_KEY, JSON.stringify(orders));
    tenantStorage.saveOrder(order).catch((err) => console.warn('Dexie save order error:', err));
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userEmail) headers['x-user-email'] = userEmail;
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) headers['Authorization'] = `Bearer ${data.session.access_token}`;
    } catch {}

    const res = await fetch(`/api/admin/marketplace/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      return { success: true, cloudSynced: Boolean(json.cloudSynced) };
    }
  } catch {}

  return { success: false, cloudSynced: false };
}

// 6. Verified Reviews & Rating Guard
export interface ProductReviewItem {
  id: string;
  productId: string;
  authorName: string;
  authorPhone?: string;
  rating: number; // 1 - 5
  comment: string;
  date: string;
  verifiedBuyer: boolean;
  orderId?: string;
}

export function getProductReviews(productId: string): ProductReviewItem[] {
  try {
    const raw = localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (raw) {
      const all: Record<string, ProductReviewItem[]> = JSON.parse(raw);
      return all[productId] || [];
    }
  } catch (e) {
    console.warn('Failed reading reviews:', e);
  }
  return [];
}

export function addProductReview(
  productId: string,
  review: Omit<ProductReviewItem, 'id' | 'date'>
): ProductReviewItem {
  const raw = localStorage.getItem(REVIEWS_STORAGE_KEY);
  const all: Record<string, ProductReviewItem[]> = raw ? JSON.parse(raw) : {};
  const current = all[productId] || [];

  const newRev: ProductReviewItem = {
    ...review,
    id: 'rev_' + Date.now(),
    date: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
  };

  all[productId] = [newRev, ...current];
  localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(all));
  return newRev;
}

// Check if customer is a verified buyer who actually received this product
export function canCustomerReviewProduct(productId: string, customerPhone?: string): { allowed: boolean; reason?: string } {
  if (!customerPhone || !customerPhone.trim()) {
    return {
      allowed: false,
      reason: 'يجب تسجيل الدخول أو إدخال رقم هاتفك للتحقق من سجل استلام المشغولة.',
    };
  }

  const orders = getCentralMarketplaceOrders();
  const normalizedPhone = customerPhone.replace(/\D/g, '');

  const deliveredOrderWithProduct = orders.find((o) => {
    const orderPhone = (o.customerPhone || '').replace(/\D/g, '');
    const phoneMatches = orderPhone.length >= 8 && normalizedPhone.endsWith(orderPhone.slice(-8));
    const isDelivered = o.status === 'completed' || o.marketplaceStatus === 'delivered';
    const hasProduct = o.items?.some((i) => i.productId === productId);
    return phoneMatches && isDelivered && hasProduct;
  });

  if (!deliveredOrderWithProduct) {
    return {
      allowed: false,
      reason: 'حماية الشمساوية: التقييم متاح فقط للعملاء الذين استلموا هذه المشغولة بنجاح وتم فحصها وتسليمها.',
    };
  }

  return { allowed: true };
}
