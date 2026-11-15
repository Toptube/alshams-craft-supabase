// Custom Push Notification, System Sound, Notification Click & Background Sync handler
// Loaded inside Workbox Service Worker via importScripts('/sw-push.js')

self.addEventListener('push', (event) => {
  let data = {
    title: 'منظومة الشمساوية',
    body: 'لديك تنبيه تشغيلي جديد من ورشتك!',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'alshams-notification',
    url: '/',
    requireInteraction: true,
    data: { url: '/' },
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

  const targetUrl = (data.data && data.data.url) || data.url || '/';

  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'ar',
    silent: false,
    vibrate: [250, 100, 250, 100, 300],
    tag: data.tag || 'alshams-alert',
    renotify: true,
    requireInteraction: data.requireInteraction !== false,
    timestamp: Date.now(),
    data: { ...(data.data || {}), url: targetUrl },
    actions: [
      { action: 'open', title: 'فتح المنظومة' },
      { action: 'dismiss', title: 'إغلاق' },
    ],
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          try {
            client.postMessage({ type: 'PUSH_RECEIVED', payload: data });
          } catch {}
        });
      }),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          try {
            client.postMessage({ type: 'NOTIFICATION_CLICKED', url: targetUrl });
          } catch {}
          if ('navigate' in client && targetUrl && targetUrl !== '/') {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title || 'منظومة الشمساوية', {
      body: (options && options.body) || 'تنبيه ورشة جديد',
      icon: (options && options.icon) || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      silent: false,
      renotify: true,
      tag: (options && options.tag) || 'artisan-local-alert',
      data: (options && options.data) || { url: '/' },
      vibrate: [200, 100, 200],
    });
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'alshams-background-sync' || event.tag === 'sync-products') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_OFFLINE_SYNC' });
        });
      })
    );
  }
});
