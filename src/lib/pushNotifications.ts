// Helper for Web Push, Service Worker & Browser Permissions in Al-Shams Craft ERP
// منظومة الأذونات والتشغيل في الخلفية وإشعارات الورشة الدائمة

import { tenantStorage } from '../db/dexieDB';
import { FixedAsset } from '../types';

export interface BrowserPermissionsState {
  notifications: PermissionState | 'unsupported';
  microphone: PermissionState | 'unsupported';
  camera: PermissionState | 'unsupported';
  geolocation: PermissionState | 'unsupported';
  persistentStorage: boolean;
}

let swLookupPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * الحصول على تسجيل Service Worker النشط (يُدار بصورة موحدة عبر VitePWA)
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  if (swLookupPromise) {
    return swLookupPromise;
  }

  swLookupPromise = (async () => {
    try {
      const existing = await navigator.serviceWorker.getRegistration('/');
      if (existing) {
        return existing;
      }

      // Allow virtual:pwa-register (initialized in main.tsx) to finish registering
      const ready = await Promise.race<ServiceWorkerRegistration | null>([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 3500)),
      ]);
      if (ready) {
        return ready;
      }

      const afterWait = await navigator.serviceWorker.getRegistration('/');
      if (afterWait) {
        return afterWait;
      }

      const swUrl = import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js';
      const reg = await navigator.serviceWorker.register(swUrl, {
        scope: '/',
        type: 'classic',
      });
      return reg;
    } catch (err) {
      console.warn('[Al-Shams SW] Service Worker lookup/registration notice:', err);
      return null;
    } finally {
      swLookupPromise = null;
    }
  })();

  return swLookupPromise;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushSubscriptionIdentity {
  workshopId?: string;
  email?: string;
  isSuperAdmin?: boolean;
}

/**
 * الاشتراك في إشعارات الخلفية الفعلية (VAPID Web Push) ليصل صوت الإشعار حتى مع إغلاق المتصفح
 */
export async function subscribeToWebPush(identity: PushSubscriptionIdentity): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return false;
  }

  try {
    const reg = (await registerServiceWorker()) || (await navigator.serviceWorker.ready);
    if (!reg || !reg.pushManager) return false;

    const keyRes = await fetch('/api/push/vapid-public-key');
    if (!keyRes.ok) return false;
    const { publicKey } = await keyRes.json();
    if (!publicKey) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        workshopId: identity.workshopId || '',
        email: identity.email || '',
        isSuperAdmin: Boolean(identity.isSuperAdmin),
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Al-Shams Push] Web Push subscription skipped/failed:', err);
    return false;
  }
}

/**
 * إلغاء ربط اشتراك Push الحالي عند تسجيل الخروج
 */
export async function unsubscribeFromWebPush(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {}
}

/**
 * إرسال إشعار تجريبي فعلي عبر خادم Web Push للتأكد من عمل الصوت في الخلفية
 */
export async function sendServerTestPush(identity: PushSubscriptionIdentity): Promise<boolean> {
  try {
    await subscribeToWebPush(identity);
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workshopId: identity.workshopId || '',
        email: identity.email || '',
        isSuperAdmin: Boolean(identity.isSuperAdmin),
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.sent && data.sent > 0);
  } catch {
    return false;
  }
}

/**
 * التحقق من حالة أذونات المتصفح الحالية
 */
export async function checkBrowserPermissions(): Promise<BrowserPermissionsState> {
  const result: BrowserPermissionsState = {
    notifications: 'unsupported',
    microphone: 'unsupported',
    camera: 'unsupported',
    geolocation: 'unsupported',
    persistentStorage: false,
  };

  if (typeof window === 'undefined') return result;

  // 1. Notifications
  if ('Notification' in window) {
    const perm = Notification.permission;
    result.notifications = perm === 'default' ? 'prompt' : perm;
  }

  // 2. Microphone, Camera & Geolocation via Permissions API
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const micStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      result.microphone = micStatus.state;
    } catch {
      // Not supported
    }

    try {
      const camStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      result.camera = camStatus.state;
    } catch {
      // Not supported
    }

    try {
      const geoStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      result.geolocation = geoStatus.state;
    } catch {
      // Not supported
    }
  }

  // 3. Persistent Storage
  if (navigator.storage && navigator.storage.persisted) {
    try {
      result.persistentStorage = await navigator.storage.persisted();
    } catch {
      result.persistentStorage = false;
    }
  }

  return result;
}

/**
 * طلب إذن الإشعارات من المستخدم
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  // Ensure Service Worker is registered
  if ('serviceWorker' in navigator) {
    registerServiceWorker().catch(() => {});
  }

  try {
    let perm: NotificationPermission = 'denied';
    try {
      const p = Notification.requestPermission();
      if (p && typeof p.then === 'function') {
        perm = await p;
      }
    } catch {
      perm = await new Promise((resolve) => {
        Notification.requestPermission((res) => resolve(res));
      });
    }

    if (perm === 'granted') {
      try {
        localStorage.setItem('alshams_notifications_granted', 'true');
      } catch {}
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Error requesting notification permission:', e);
    return false;
  }
}

/**
 * طلب إذن الميكروفون (للمستشار الصوتي صقر وشموسة)
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (err) {
    console.warn('Microphone permission denied:', err);
    return false;
  }
}

/**
 * طلب إذن الكاميرا (لمسح أكواد QR وفحص المشغولات)
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (err) {
    console.warn('Camera permission denied:', err);
    return false;
  }
}

/**
 * طلب إذن الموقع الجغرافي (لتحديد نطاق الورشة واحتساب الشحن التلقائي)
 */
export async function requestGeolocationPermission(): Promise<{ lat: number; lng: number } | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        console.warn('Geolocation permission denied:', err);
        resolve(null);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}

/**
 * تفعيل التخزين الدائم (Persistent Storage & IndexedDB Protection)
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.storage?.persist) {
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persist();
    return isPersisted;
  } catch (err) {
    console.warn('Persistent storage request failed:', err);
    return false;
  }
}

/**
 * إرسال إشعار فوري للمستخدم (عبر Service Worker أو Notification API)
 */
export async function dispatchArtisanNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    url?: string;
  }
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission !== 'granted') {
    const granted = await requestNotificationPermission();
    if (!granted) return;
  }

  const iconUrl = options?.icon || '/pwa-192x192.png';
  const targetUrl = options?.url || '/';

  try {
    if ('serviceWorker' in navigator) {
      const reg = (await navigator.serviceWorker.getRegistration('/')) || (await navigator.serviceWorker.ready);
      if (reg && reg.showNotification) {
        const notifOpts: NotificationOptions & Record<string, any> = {
          body: options?.body || 'تنبيه جديد من منظومة الشمساوية',
          icon: iconUrl,
          badge: '/pwa-192x192.png',
          dir: 'rtl',
          lang: 'ar',
          silent: false,
          renotify: true,
          vibrate: [250, 100, 250],
          tag: options?.tag || 'artisan-alert',
          data: { url: targetUrl },
        };
        await reg.showNotification(title, notifOpts);
        return;
      }
    }

    // Fallback standard notification
    new Notification(title, {
      body: options?.body,
      icon: iconUrl,
      dir: 'rtl',
      lang: 'ar',
      silent: false,
      tag: options?.tag,
    });
  } catch (e) {
    console.warn('Could not dispatch browser notification:', e);
  }
}

/**
 * 1. إشعار طلبية جديدة في المتجر أو سوق الشمساوية
 */
export async function notifyNewOrder(orderNumber: string, customerName: string, totalAmount: number): Promise<void> {
  await dispatchArtisanNotification(`🛍️ طلبية جديدة (#${orderNumber})!`, {
    body: `قام العميل ${customerName} بتأكيد طلب جديد بقيمة ${totalAmount.toLocaleString()} ج.م، افتح لإعداد أمر الشغل.`,
    tag: `order-${orderNumber}`,
    url: '/#orders',
  });
}

/**
 * 2. إشعار رسالة جديدة أو استفسار عميل
 */
export async function notifyNewMessage(senderName: string, messagePreview: string): Promise<void> {
  await dispatchArtisanNotification(`✉️ رسالة جديدة من ${senderName}`, {
    body: messagePreview.length > 80 ? `${messagePreview.slice(0, 80)}...` : messagePreview,
    tag: `msg-${Date.now()}`,
    url: '/#messages',
  });
}

/**
 * 3. تنبيه شموسة الاستباقي بمواعيد تسليم المشغولات (قبل الموعد بـ 24 ساعة)
 */
export async function notifyDeliveryDeadline(orderNumber: string, productName: string, hoursLeft: number = 24): Promise<void> {
  await dispatchArtisanNotification(`⏳ موعد تسليم يقترب: #${orderNumber}`, {
    body: `تذكير شموسة: متبقي ${hoursLeft} ساعة على موعد تسليم المشغولة "${productName}". هل انتهيت من التغليف؟`,
    tag: `delivery-${orderNumber}`,
    url: '/#orders',
  });
}

/**
 * 4. تنبيه هبوط رصيد خامة تحت حد الأمان
 */
export async function notifyLowStock(materialName: string, currentAmount: number, unit: string): Promise<void> {
  await dispatchArtisanNotification(`⚠️ انخفاض رصيد خامة: ${materialName}`, {
    body: `الرصيد المتبقي في الورشة ${currentAmount} ${unit} فقط، وهو أقل من حد الأمان. يرجى تدبير كميات جديدة.`,
    tag: `low-stock-${materialName}`,
    url: '/#inventory',
  });
}

/**
 * 5. تنبيه دوري بصيانة ماكينات ومعدات الورشة (يسبق الموعد بـ 3 أيام)
 */
export async function notifyToolMaintenance(toolName: string, daysLeft: number): Promise<void> {
  const daysText = daysLeft === 0 ? 'مستحق اليوم!' : daysLeft === 1 ? 'خلال يوم واحد' : daysLeft === 2 ? 'خلال يومين' : 'خلال 3 أيام';
  await dispatchArtisanNotification(`🛠️ تذكير صيانة ورشة: ${toolName}`, {
    body: `موعد صيانة وتزييت "${toolName}" ${daysText}. حافظ على كفاءة معداتك لتفادي تعطل خط الإنتاج.`,
    tag: `maint-${toolName}`,
    url: '/#fixed-assets',
  });
}

/**
 * فحص أصول ومعدات الورشة وإرسال تنبيهات الصيانة الاستباقية للقطع المستحقة خلال 3 أيام
 */
export async function checkAndDispatchEquipmentMaintenanceAlerts(tenantId: string): Promise<number> {
  if (typeof window === 'undefined') return 0;
  if (!('Notification' in window) || Notification.permission !== 'granted') return 0;

  try {
    const assets = await tenantStorage.getFixedAssets(tenantId);
    if (!assets || assets.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    let alertsCount = 0;

    for (const asset of assets) {
      if (!asset.nextMaintenanceDate && !asset.lastMaintenanceDate) continue;

      const nextDateStr = asset.nextMaintenanceDate || asset.lastMaintenanceDate;
      if (!nextDateStr) continue;

      const nextDate = new Date(nextDateStr);
      nextDate.setHours(0, 0, 0, 0);

      const diffTime = nextDate.getTime() - today.getTime();
      const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // إذا كان الموعد متبقي عليه من 0 إلى 3 أيام
      if (daysUntil >= 0 && daysUntil <= 3) {
        const alertKey = `alshams_maint_alert_${asset.id}_${todayStr}`;
        if (!localStorage.getItem(alertKey)) {
          await notifyToolMaintenance(asset.assetName, daysUntil);
          localStorage.setItem(alertKey, 'sent');
          alertsCount++;
        }
      }
    }

    return alertsCount;
  } catch (err) {
    console.warn('Failed to check equipment maintenance alerts:', err);
    return 0;
  }
}
