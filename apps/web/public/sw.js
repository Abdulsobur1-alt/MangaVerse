/* eslint-disable no-restricted-globals */
// MangaVerse service worker.
// 1. Web push: handles incoming push events + notification clicks.
// 2. Offline reading (Phase 7 completion): serves chapter metadata and
//    page images from the "mangaverse-offline" cache, populated by the
//    download manager (apps/web/src/lib/downloads.ts).

const OFFLINE_CACHE = 'mangaverse-offline-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Drop caches from older builds (keep the offline one).
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('mangaverse-offline-') && k !== OFFLINE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'MangaVerse' };
  }

  const title = data.title || 'MangaVerse';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon.svg',
    badge: '/icon.svg',
    data: { url: data.link || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('navigate' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

// ─── Offline reading ──────────────────────────────────

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // Reader data endpoints — network-first, cache fallback (so a chapter you
  // downloaded still opens offline: metadata + page list are cached too).
  const isChapterPages = /^\/api\/chapters\/[^/]+\/pages$/.test(path);
  const isChapterMeta = /^\/api\/chapters\/[^/]+$/.test(path) && !isChapterPages;
  if (isChapterPages || isChapterMeta) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(OFFLINE_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => {
            if (cached) return cached;
            if (isChapterMeta) {
              // Offline and no cache — the UI shows its normal error state.
              return new Response(JSON.stringify({ success: false, error: { message: 'Offline' } }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              });
            }
            return Response.error();
          }),
        ),
    );
    return;
  }

  // Page images (proxied) — cache-first, populate on the fly (stale-while-revalidate).
  if (path.startsWith('/api/proxy/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(OFFLINE_CACHE).then((c) => c.put(req, clone));
            }
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || network;
      }),
    );
    return;
  }

  // App shell — network-first, cache fallback keeps the SPA usable offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(OFFLINE_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req)),
    );
  }
});
