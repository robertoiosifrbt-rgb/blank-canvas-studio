const BASE_PATH = new URL(self.registration.scope).pathname;
const asset = (path = '') => `${BASE_PATH}${path}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open('tasks-calendar-v4').then((cache) => cache.addAll([asset(), asset('manifest.webmanifest'), asset('icon.svg')])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== 'tasks-calendar-v4').map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open('tasks-calendar-v4').then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match(asset()))));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const notificationUrl = !data.url || data.url === '/' ? asset() : data.url;
  event.waitUntil(self.registration.showNotification(data.title || 'Tasks & Calendar', {
    body: data.body || '',
    icon: asset('icon.svg'),
    badge: asset('icon.svg'),
    data: { url: notificationUrl },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || asset(), self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) { existing.navigate(target); return existing.focus(); }
    return clients.openWindow(target);
  }));
});
