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

/**
 * تسجيل ملف Service Worker لتلقي الإشعارات في الخلفية
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return reg;
  } catch (err) {
    console.warn('[Al-Shams SW] Service Worker registration failed:', err);
    return null;
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

  const iconUrl = options?.icon || '/alshams_falcon_emblem.png';
  const targetUrl = options?.url || '/';

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body: options?.body || 'تنبيه جديد من منظومة الشمساوية',
          icon: iconUrl,
          badge: iconUrl,
          tag: options?.tag || 'artisan-alert',
          data: { url: targetUrl },
        });
        return;
      }
    }

    // Fallback standard notification
    new Notification(title, {
      body: options?.body,
      icon: iconUrl,
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
