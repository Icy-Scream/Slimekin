// Offline cache for the home-screen app.
// Game files: network first (always fresh when online), cache as backup for offline play.
// Libraries and fonts from CDNs: cache first (their URLs never change).
// Each folder under src/assets/ (a baked room or ranch: big, rarely changed): its own cache, named by the folder and a
// hash of its files, cache first. A release that does not change a folder keeps its cache, so phones don't download
// it again.
const VERSION = 'slimekin-202611092354';
const CORE = ["./","index.html","manifest.webmanifest","src/audio/sfx.js","src/barn-ranch.js","src/behaviors.js","src/contest-show.js","src/core/breeding.js","src/core/contests.js","src/core/format.js","src/core/heirlooms.js","src/core/medals.js","src/core/movingday.js","src/core/ranch-life.js","src/core/ranch.js","src/core/random.js","src/core/recipe.js","src/core/requests.js","src/core/save-check.js","src/core/save.js","src/core/sim.js","src/core/talents.js","src/data/content.js","src/game.js","src/greenhouse-home.js","src/main.js","src/moving-day.js","src/platform/index.js","src/send-off.js","src/ui/barn-card.js","src/ui/camera-button.js","src/ui/contests.js","src/ui/eggs.js","src/ui/esc.js","src/ui/hud.js","src/ui/icons.js","src/ui/notice.js","src/ui/ranch-life.js","src/view/barn-math.js","src/view/barn.js","src/view/body.js","src/view/bubble-math.js","src/view/egg-spark.js","src/view/egg.js","src/view/face.js","src/view/forms.js","src/view/fx.js","src/view/greenhouse-math.js","src/view/greenhouse.js","src/view/helpers3d.js","src/view/medal-pin.js","src/view/models.js","src/view/ranch.js","src/view/scarf.js","src/view/scenery.js","src/view/slime.js","src/view/stage.js","src/view/travel-bubble.js","src/view/travel-bundle.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png"];
const ASSETS = [{"cache":"slimekin-asset-barn-cf098e2fa46e4980","files":["src/assets/barn/barn.bin","src/assets/barn/barn.json","src/assets/barn/floor_day.jpg","src/assets/barn/floor_night.jpg"]},{"cache":"slimekin-asset-greenhouse-dccaa03b303ba8df","files":["src/assets/greenhouse/floor_day.jpg","src/assets/greenhouse/floor_night.jpg","src/assets/greenhouse/gh.bin","src/assets/greenhouse/gh.json"]}];   // [{ cache: 'slimekin-asset-<folder>-<hash>', files: [...] }], one per folder
const CDN = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const assetCache = new Map(ASSETS.flatMap(a => a.files.map(f => [new URL(f, self.registration.scope).href, a.cache])));

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(VERSION).then(c => c.addAll(CORE)),
    // each folder: only the files its cache doesn't have yet; not fatal if it fails (the game fetches them later, or,
    // for the Greenhouse, shows the meadow when it can't)
    ...ASSETS.map(a => caches.open(a.cache).then(async c => {
      const have = await Promise.all(a.files.map(f => c.match(f)));
      const missing = a.files.filter((f, i) => !have[i]);
      if (missing.length) await c.addAll(missing).catch(() => {});
    })),
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && !ASSETS.some(a => a.cache === k)).map(k => caches.delete(k))))
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
  const asset = assetCache.get(url.origin + url.pathname);
  if (asset) {
    e.respondWith(caches.open(asset).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
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
