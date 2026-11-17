self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'IKE Ops', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'IKE Ops', { body: d.body || '', icon: '/icon-192.png', badge: '/badge-96.png', data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    // App already open: bring it forward and tell it to show the announcements. Otherwise open it at the right address.
    for (const c of cs) if ('focus' in c) { c.postMessage({ type: 'open-notif' }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
