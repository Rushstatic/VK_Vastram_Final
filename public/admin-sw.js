self.addEventListener('push', (event) => {
  let data = { title: 'VK VASTRAM Admin', body: 'There is an order update.', url: '/admin' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title || 'VK VASTRAM Admin', {
    body: data.body || 'There is an order update.',
    icon: '/favicon.svg', badge: '/favicon.svg',
    tag: data.tag || 'vk-vastram-admin-order', renotify: true,
    data: { url: data.url || '/admin' }
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/admin', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) { if (client.url.startsWith(self.location.origin) && 'focus' in client) { client.navigate(target); return client.focus(); } }
    return self.clients.openWindow(target);
  }));
});
