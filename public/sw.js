// 푸시 알림 받기 (중개사 슈퍼앱·손님용 앱 공용)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch (err) { d = { title: '알림', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '알림', { body: d.body || '', tag: d.tag, data: { url: d.url || '/' }, icon: './icon.svg', badge: './icon.svg' }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const path = new URL(url).pathname;
      const open = list.find((c) => new URL(c.url).pathname === path);
      if (open) { open.postMessage({ type: 'push-open', url }); return open.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
