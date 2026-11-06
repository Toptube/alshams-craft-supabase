// Service Worker for Al-Shams Craft ERP / SaaS
const CACHE_NAME = 'alshams-v1';

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
    icon: '/favicon.ico',
    badge: '/favicon.ico',
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
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    vibrate: [200, 100, 200],
    tag: data.tag || 'alshams-alert',
    renotify: true,
    data: data.data || { url: '/' },
    actions: [
      { action: 'open', title: 'فتح المنظومة 🚪' },
      { action: 'dismiss', title: 'إغلاق' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
