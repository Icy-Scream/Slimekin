// Offline cache for the home-screen app.
// Game files: network first (always fresh when online), cache as backup for offline play.
// Libraries and fonts from CDNs: cache first (their URLs never change).
const VERSION = 'slimekin-202611042259';
const CORE = ["./","index.html","manifest.webmanifest","src/audio/sfx.js","src/behaviors.js","src/core/breeding.js","src/core/format.js","src/core/ranch.js","src/core/random.js","src/core/requests.js","src/core/save.js","src/core/sim.js","src/data/content.js","src/game.js","src/main.js","src/ui/hud.js","src/view/egg-spark.js","src/view/egg.js","src/view/face.js","src/view/forms.js","src/view/fx.js","src/view/helpers3d.js","src/view/models.js","src/view/ranch.js","src/view/slime.js","src/view/stage.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png"];
const CDN = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
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
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
