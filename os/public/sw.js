const CACHE_NAME = 'gym-app-runtime-v3'
const APP_SCOPE = '/GYM-APP/'
const APP_SHELL = `${APP_SCOPE}`

self.addEventListener('install', (event) => {
  // Cache the app shell, but do not replace the active worker automatically.
  // The user activates the waiting worker through the in-app update banner.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(new Request(APP_SHELL, { cache: 'reload' }))).catch(() => undefined),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith('gym-app-runtime-') && key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_SCOPE)) return

  // Never cache the version marker or the service worker itself. Both must
  // always come from the current deployment so update detection cannot go stale.
  if (url.pathname === `${APP_SCOPE}version.txt` || url.pathname === `${APP_SCOPE}sw.js`) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, copy))
          }
          return response
        })
        .catch(async () => (await caches.match(APP_SHELL)) || Response.error()),
    )
    return
  }

  // Hashed Vite assets are immutable for a deployment. Serve a cached copy
  // immediately when available, otherwise fetch and remember it for offline use.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
