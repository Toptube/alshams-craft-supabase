// Service Worker for Al-Shams Craft ERP / SaaS
// محرك الإشعارات والتشغيل في الخلفية لمنظومة الشمساوية

const CACHE_NAME = 'alshams-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// التعامل مع إشعارات Web Push حتى عند إغلاق التبويب
self.addEventListener('push', (event) => {
  let data = {
    title: 'منظومة الشمساوية 🦅☀️',
    body: 'لديك تنبيه تشغيلي جديد من ورشتك!',
    icon: '/alshams_falcon_emblem.png',
    badge: '/alshams_falcon_emblem.png',
    tag: 'alshams-notification',
    data: { url: '/' }
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/alshams_falcon_emblem.png',
    badge: data.badge || '/alshams_falcon_emblem.png',
    vibrate: [250, 100, 250, 100, 250],
    tag: data.tag || 'alshams-alert',
    renotify: true,
    data: data.data || { url: '/' },
    actions: [
      { action: 'open', title: 'فتح المنظومة 🚪' },
      { action: 'dismiss', title: 'إغلاق ✕' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// التعامل مع النقر على الإشعار من شاشة القفل أو شريط النظام
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // إذا كان هناك تبويب مفتوح للمنظومة، نركز عليه ونوجهه للصفحة المطلوبة
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // إذا لم يكن هناك أي تبويب مفتوح، نفتح نافذة جديدة بالرابط المحدد
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// استقبال الرسائل المباشرة من التطبيق لإظهار إشعارات الخلفية المجدولة
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title || 'منظومة الشمساوية', {
      body: options?.body || 'تنبيه ورشة جديد',
      icon: options?.icon || '/alshams_falcon_emblem.png',
      badge: '/alshams_falcon_emblem.png',
      tag: options?.tag || 'artisan-local-alert',
      data: options?.data || { url: '/' },
      vibrate: [200, 100, 200],
    });
  }
});

// المزامنة التلقائية في الخلفية عند عودة الاتصال بالإنترنت (Background Sync)
self.addEventListener('sync', (event) => {
  if (event.tag === 'alshams-background-sync' || event.tag === 'sync-products') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_OFFLINE_SYNC' });
        });
      })
    );
  }
});
