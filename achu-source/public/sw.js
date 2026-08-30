/* eslint-disable no-undef */
/**
 * ACHU service worker — Sesiunea 35 (ACHU-235).
 *
 * ─── This file exists ONLY to receive push notifications ─────────────────
 * It deliberately does NOT cache anything. Offline caching sounds like a free
 * bonus and is the opposite: a cached shell serves a stale version of a business
 * app, and someone would be looking at yesterday's job list with no indication
 * that it is stale. Caching is a decision to make on purpose, with a versioning
 * strategy, not a side effect of wanting notifications.
 *
 * ─── Why it lives in public/ and not src/ ────────────────────────────────
 * A service worker can only control pages at or below its own URL. Served from
 * `/sw.js` it controls the whole origin; bundled into `/assets/…` it would control
 * nothing useful. Vite copies `public/` to the root untouched, which is exactly
 * what is needed — and means this file is NOT transpiled, so it is plain ES5-safe
 * JavaScript with no imports.
 *
 * ─── Lifecycle ──────────────────────────────────────────────────────────
 * `skipWaiting` + `clients.claim` so a new version takes over immediately instead
 * of waiting for every tab to close. For a notification handler that matters: the
 * alternative is a fixed bug that does not take effect for days.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  // Defaults for every field. A malformed or empty payload must still produce a
  // visible notification: on Chrome, a push event that shows nothing eventually
  // costs the site its push permission entirely, so silence is not a safe
  // fallback.
  /**
   * 🔴 ACHU-439 (Sesiunea 95). `tag` defaulted to the literal 'achu', so every
   * notification that carried no explicit tag REPLACED the previous one on the
   * device — a reschedule request wiping out a new-enquiry alert, and two enquiries
   * showing as one. The bell was right; the phone quietly kept only the last.
   *
   * ⚠️ A missing tag means "this does not collapse", so the default has to be
   * UNIQUE, not shared. Time plus a random suffix is enough: the only requirement
   * is that it never equals another live notification's tag.
   */
  var payload = { title: 'ACHU', body: '', linkPath: '/', tag: 'achu-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) };
  try {
    if (event.data) {
      var parsed = event.data.json();
      payload.title = parsed.title || payload.title;
      payload.body = parsed.body || '';
      payload.linkPath = parsed.linkPath || '/';
      // Only an EXPLICIT tag collapses. `parsed.tag` is the sender's `dedupeKey`,
      // which exists precisely when repeats should replace each other (a chat
      // thread); absent, the unique default above stands.
      payload.tag = parsed.tag || payload.tag;
    }
  } catch {
    // Keep the defaults and carry on — see above.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      // Collapses repeats on the DEVICE, mirroring the in-app dedupe: twenty
      // messages in one conversation replace each other instead of stacking into
      // twenty separate buzzes.
      tag: payload.tag,
      // With `renotify`, a replaced notification still alerts. Without it, the
      // second message in a conversation would update silently and the person
      // would never know it arrived.
      renotify: true,
      // Carried through to the click handler; there is no other way to pass data
      // from here to there.
      data: { linkPath: payload.linkPath },
      // No custom icon: none is bundled, and pointing at a missing file makes
      // some platforms drop the notification rather than fall back.
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  var linkPath = (event.notification.data && event.notification.data.linkPath) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Prefer an EXISTING window. Opening a second tab of a business app the
      // person already has open is a nuisance, and on a phone it loses whatever
      // they were part-way through typing.
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          // The page decides where to go, because only it knows the user's role —
          // the same reason the server sends a role-relative path (ACHU-233). A
          // service worker cannot know whether /chat means /admin/chat or a tab in
          // the cleaner portal.
          client.postMessage({ type: 'achu:notification-click', linkPath: linkPath });
          return client.focus();
        }
      }
      // Nothing open: a full load, where the app resolves the path on startup.
      return self.clients.openWindow('/?notify=' + encodeURIComponent(linkPath));
    }),
  );
});

