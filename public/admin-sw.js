// VK VASTRAM admin service worker: order alerts that open the right order.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = { title: 'VK VASTRAM Admin', body: 'There is an order update.', url: '/admin' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {}
  const options = {
    body: data.body || 'There is an order update.',
    icon: '/admin-icon-192.png',
    badge: '/admin-icon-192.png',
    tag: data.tag || 'vk-vastram-admin-order',
    renotify: true,
    requireInteraction: true,          // stays on screen until the admin taps it
    vibrate: [300, 120, 300, 120, 500],
    data: { url: data.url || '/admin' },
    actions: [{ action: 'open', title: 'Open order' }]
  };
  event.waitUntil(self.registration.showNotification(data.title || 'VK VASTRAM Admin', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/admin', self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.focus();
        try { await client.navigate(target); } catch (_) { client.postMessage({ type: 'vk-open-order', url: target }); }
        return;
      }
    }
    return self.clients.openWindow(target);
  })());
});
