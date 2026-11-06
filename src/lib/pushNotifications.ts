// Helper for Web Push, Service Worker & Browser Permissions in Al-Shams

export interface BrowserPermissionsState {
  notifications: PermissionState | 'unsupported';
  microphone: PermissionState | 'unsupported';
  camera: PermissionState | 'unsupported';
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
    console.log('[Al-Shams SW] Service Worker registered successfully with scope:', reg.scope);
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
  };

  if (typeof window === 'undefined') return result;

  // 1. Notifications
  if ('Notification' in window) {
    const perm = Notification.permission;
    result.notifications = perm === 'default' ? 'prompt' : perm;
  }

  // 2. Microphone & Camera via Permissions API
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const micStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      result.microphone = micStatus.state;
    } catch {
      // Some browsers don't support 'microphone' query
    }

    try {
      const camStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      result.camera = camStatus.state;
    } catch {
      // Some browsers don't support 'camera' query
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

  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
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
    // إيقاف التسجيل فور التحقق من الصلاحية
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

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body: options?.body || 'تنبيه جديد من منظومة الشمساوية',
          icon: options?.icon || '/favicon.ico',
          badge: '/favicon.ico',
          tag: options?.tag || 'artisan-alert',
          data: { url: options?.url || '/' },
        });
        return;
      }
    }

    // Fallback standard notification
    new Notification(title, {
      body: options?.body,
      icon: options?.icon || '/favicon.ico',
      tag: options?.tag,
    });
  } catch (e) {
    console.warn('Could not dispatch browser notification:', e);
  }
}
