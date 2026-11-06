// Offline cache for the home-screen app.
// Game files: network first (always fresh when online), cache as backup for offline play.
// Libraries and fonts from CDNs: cache first (their URLs never change).
// The Greenhouse room's files (big, rarely changed): their own cache, named by a hash of their contents, cache first.
// A release that does not change the room keeps that cache, so phones don't download the room again.
const VERSION = 'slimekin-__VERSION__';
const CORE = __CORE__;
const ROOM_CACHE = 'slimekin-room-__ROOMHASH__';
const ROOM = __ROOM__;
const CDN = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const roomUrls = new Set(ROOM.map(f => new URL(f, self.registration.scope).href));

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(VERSION).then(c => c.addAll(CORE)),
    // only the room files this cache doesn't have yet; not fatal if it fails (the game fetches them later, or shows
    // the meadow when it can't)
    caches.open(ROOM_CACHE).then(async c => {
      const have = await Promise.all(ROOM.map(f => c.match(f)));
      const missing = ROOM.filter((f, i) => !have[i]);
      if (missing.length) await c.addAll(missing).catch(() => {});
    }),
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== ROOM_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (CDN.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (roomUrls.has(url.origin + url.pathname)) {
    e.respondWith(caches.open(ROOM_CACHE).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
