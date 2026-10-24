/**
 * نظام تنبيهات المتصفح المحلي (Web Browser Notifications)
 * لمنظومة الشمس كرافت الحرفية ERP
 * يرسل إشعارات حية عبر المتصفح عند اقتراب موعد استحقاق أمر تشغيل أو انخفاض مخزون إحدى الخامات.
 */

import { tenantStorage } from '../db/dexieDB';
import { UserProfile } from '../types';
import { playUrgentNotificationSound, playAlertSound } from './sounds';

const NOTIFIED_CACHE_KEY = 'alshams_browser_notified_ids';

/**
 * فحص هل المتصفح يدعم خاصية Notifications API
 */
export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * الحصول على حالة إذن إشعارات المتصفح
 */
export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * طلب الإذن من المستخدم لتشغيل إشعارات المتصفح
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!isBrowserNotificationSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      sendBrowserNotification('تم تفعيل إشعارات المتصفح بنجاح! 🔔', {
        body: 'ستصلك تنبيهات فورية عند انخفاض مخزون الخامات أو اقتراب مواعيد تسليم أوامر التشغيل.',
        tag: 'welcome_notification',
      });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return false;
  }
}

/**
 * إرسال إشعار متصفح مع أيقونة المنظومة الرسمية والصوت التفاعلي
 */
export function sendBrowserNotification(
  title: string,
  options?: NotificationOptions & { playSound?: boolean }
): Notification | null {
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    if (options?.playSound !== false) {
      playAlertSound();
    }

    const notif = new Notification(title, {
      icon: '/alshams_falcon_emblem.png',
      badge: '/alshams_falcon_emblem.png',
      dir: 'rtl',
      lang: 'ar',
      ...options,
    });

    // إغلاق الإشعار تلقائياً بعد 8 ثوانٍ
    setTimeout(() => {
      try {
        notif.close();
      } catch {}
    }, 8000);

    return notif;
  } catch (err) {
    console.warn('Failed to send browser notification:', err);
    return null;
  }
}

/**
 * جلب المعرفات التي تم تنبيه المستخدم بها في هذه الجلسة لمنع التكرار المزعج
 */
function getNotifiedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(NOTIFIED_CACHE_KEY);
    if (!raw) return new Set<string>();
    return new Set<string>(JSON.parse(raw));
  } catch {
    return new Set<string>();
  }
}

/**
 * حفظ المعرفات المنبهة في sessionStorage
 */
function markIdAsNotified(id: string): void {
  try {
    const set = getNotifiedIds();
    set.add(id);
    sessionStorage.setItem(NOTIFIED_CACHE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

/**
 * فحص دوري ذكي لبيانات الورشة وإرسال إشعارات المتصفح المحلية
 * 1. انخفاض مخزون الخامات عن حد الإنذار
 * 2. اقتراب موعد استحقاق أمر تشغيل / طلبية عميل
 */
export async function checkAndTriggerProactiveBrowserNotifications(
  tenantId: string,
  profile?: UserProfile | null
): Promise<void> {
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  if (!tenantId) return;

  const notifiedIds = getNotifiedIds();
  const now = Date.now();
  const twoDaysMs = 48 * 60 * 60 * 1000;

  try {
    // 1. فحص انخفاض مخزون الخامات
    const materials = await tenantStorage.getRawMaterials(tenantId).catch(() => []);
    for (const mat of materials) {
      if (mat.isActive === false) continue;
      const threshold = mat.minAlertThreshold ?? 5;
      const currentStock = mat.currentStock ?? 0;

      if (currentStock <= threshold) {
        const notifKey = `mat_stock_${mat.id}_${Math.floor(now / (4 * 3600 * 1000))}`; // مرة كل 4 ساعات
        if (!notifiedIds.has(notifKey)) {
          markIdAsNotified(notifKey);
          playUrgentNotificationSound();
          const materialDisplayName = mat.materialName || (mat as any).name || 'خامة';
          sendBrowserNotification(`⚠️ تنبيه انخفاض المخزون: ${materialDisplayName}`, {
            body: `الرصيد المتبقي: ${currentStock} ${mat.unit || 'وحدة'} فقط (حد الأمان: ${threshold}). يرجى إصدار أمر توريد.`,
            tag: `stock_${mat.id}`,
            playSound: false, // تم تشغيله أعلاه بنغمة عاجلة
          });
          break; // إشعار واحد في الدورة الواحدة لتجنب الإزعاج
        }
      }
    }

    // 2. فحص مواعيد استحقاق أوامر التشغيل والطلبيات
    const orders = await tenantStorage.getOrders(tenantId).catch(() => []);
    for (const order of orders) {
      if (order.status === 'cancelled' || order.status === 'delivered') continue;

      const deliveryDate = order.deliveryDate ? new Date(order.deliveryDate).getTime() : null;
      if (deliveryDate) {
        const diffMs = deliveryDate - now;

        // إذا كان الموعد اليوم أو غداً أو متأخراً (أقل من 48 ساعة)
        if (diffMs <= twoDaysMs) {
          const isOverdue = diffMs < 0;
          const notifKey = `order_due_${order.id}_${Math.floor(now / (6 * 3600 * 1000))}`; // مرة كل 6 ساعات

          if (!notifiedIds.has(notifKey)) {
            markIdAsNotified(notifKey);
            playUrgentNotificationSound();

            const title = isOverdue
              ? `🚨 تأخر موعد تسليم طلبية: ${order.customerName || 'عميل'}`
              : `⏳ اقتراب موعد استحقاق أمر تشغيل: ${order.customerName || 'عميل'}`;

            const body = isOverdue
              ? `الطلبية رقم #${(order as any).invoiceNumber || order.id?.slice(-4)} تأخرت عن موعدها المحدد!`
              : `الطلبية رقم #${(order as any).invoiceNumber || order.id?.slice(-4)} موعد تسليمها خلال ساعات معدودة.`;

            sendBrowserNotification(title, {
              body,
              tag: `order_${order.id}`,
              playSound: false,
            });
            break;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error checking proactive browser notifications:', err);
  }
}
