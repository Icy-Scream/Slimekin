// The Greenhouse offline: the service worker keeps each folder under src/assets/ (the Greenhouse room, the barn) in
// its own cache, named by the folder and a hash of its files, so a release that doesn't change a folder doesn't
// download it again, and none of those files is in the core list.
//   node tools/greenhouse-offline.cjs
// Builds the web app twice into tools/out/web-test/ (never docs/) with two different VERSIONs and the same asset files,
// serves that folder on a loopback port that logs every request, and opens it in a headless browser with service
// workers on:
//   1. first visit: the worker installs, each asset folder fills its own cache (none of their files in CORE), the
//      game shows the room
//   2. a new release (new VERSION, same assets): the update installs and activates without one request for any asset
//      folder's files, the old version cache is gone, the asset caches are kept, and the game's room comes from its cache
//   3. a release with a different room (the room's cache name changed): the room downloads again, the old room cache
//      goes; the barn's cache stays and the barn is not downloaded again
//   4. offline: the game still opens and shows the room; the barn's files come from their cache
// Runs offline like the other browser tests (three.js from node_modules, every outside request aborted).
const { execFileSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';   // so the worker's own requests are routed too (three.js)
const { chromium } = require('playwright');
const { watchdog, deadline, log, ROOT } = require('./browser-kit.cjs');

const OUT = path.join(ROOT, 'tools/out/web-test');
const SHOTS = path.join(ROOT, 'tools/out/greenhouse');
const THREE = path.resolve(path.dirname(require.resolve('three')), '..');
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.bin': 'application/octet-stream' };
const build = v => log(execFileSync(process.execPath, [path.join(ROOT, 'tools/build-web.mjs'), OUT, '--version=' + v], { encoding: 'utf8' }).trim());
// from the built sw.js: the core list and one cache per asset folder ({ greenhouse: 'slimekin-asset-greenhouse-<hash>', ... })
const swList = name => JSON.parse(fs.readFileSync(path.join(OUT, 'sw.js'), 'utf8').match(new RegExp(`const ${name} = (\\[.*\\]);`))[1]);
const cachesOf = () => Object.fromEntries(swList('ASSETS').map(a => [a.files[0].split('/')[2], a.cache]));
const FOLDERS = ['barn', 'greenhouse'];

const errors = [];
const expect = (cond, what, detail = '') => { if (cond) log('ok', what); else { errors.push(what + (detail ? ': ' + detail : '')); log('FAIL', what, detail); } };

(async () => {
  watchdog(14, () => 'offline test');
  fs.mkdirSync(SHOTS, { recursive: true });
  build('gh-a');
  // a plain static server for the built folder, logging every request
  const seen = [];
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    seen.push(p);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(OUT, p);
    if (!file.startsWith(OUT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  log('serving', path.relative(ROOT, OUT), 'at', origin);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
  const context = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await context.route(() => true, route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    if (url.startsWith(CDN)) return route.fulfill({ path: path.join(THREE, url.slice(CDN.length).split(/[?#]/)[0]), contentType: 'text/javascript' });
    if (url.startsWith('https://fonts.googleapis.com/')) return route.fulfill({ body: '', contentType: 'text/css' });
    return route.abort('internetdisconnected');
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const ev = (fn, arg) => deadline(page.evaluate(fn, arg), 120000, 'page.evaluate');
  const keys = () => ev(() => caches.keys().then(k => k.sort()));
  const roomShown = () => deadline(page.waitForFunction(() => window.slimekin && window.slimekin.home && (window.slimekin.home.room.ready || window.slimekin.home.room.failed), null, { timeout: 150000 }), 160000, 'the room')
    .then(() => ev(() => ({ ready: window.slimekin.home.room.ready, world: window.slimekin.home.world })));
  const roomFiles = () => seen.filter(p => p.includes('/src/assets/greenhouse/'));
  const barnFiles = () => seen.filter(p => p.includes('/src/assets/barn/'));
  // the caches are exactly `want` (polled from here: the worker installs and activates in the background)
  const waitKeys = async (want, what) => {
    const t = Date.now();
    for (;;) {
      const k = await keys();
      if (JSON.stringify(k) === JSON.stringify([...want].sort())) return k;
      if (Date.now() - t > 120000) throw new Error(`${what}: caches are ${JSON.stringify(k)}`);
      await page.waitForTimeout(500);
    }
  };
  // ask the browser to look for a new sw.js now (it also does on its own when the app opens)
  const checkUpdate = () => ev(() => navigator.serviceWorker.getRegistration().then(r => r && r.update()).then(() => true));
  try {
    // 1. first visit
    const c1 = cachesOf(), room1 = c1.greenhouse, barn1 = c1.barn;
    expect(JSON.stringify(Object.keys(c1).sort()) === JSON.stringify(FOLDERS), `1. one cache per asset folder (${Object.values(c1).join(', ')})`, JSON.stringify(c1));
    const inCore = swList('CORE').filter(f => f.includes('src/assets/'));
    expect(inCore.length === 0, `1. no asset file in the core list (${swList('CORE').length} core files)`, inCore.join(', '));
    await page.goto(origin + '/#debug');
    await deadline(page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), null, { timeout: 120000 }), 130000, 'the worker');
    await waitKeys(['slimekin-gh-a', room1, barn1], 'first install');
    for (const [folder, name, big] of [['greenhouse', room1, 'gh.bin'], ['barn', barn1, 'barn.bin']]) {
      const inCache = await ev(n => caches.open(n).then(c => c.keys()).then(r => r.map(x => new URL(x.url).pathname).sort()), name);
      expect(inCache.length === 4 && inCache.every(p => p.includes(`/src/assets/${folder}/`)) && inCache.some(p => p.endsWith('/' + big)), `1. first visit: the ${folder}'s ${inCache.length} files are in their own cache ${name}`, inCache.join(', '));
    }
    let r = await roomShown();
    expect(r.ready && r.world === 'greenhouse', '1. the game shows the room', JSON.stringify(r));
    log('first visit: room file requests', JSON.stringify(roomFiles()));

    // 2. a new release with the same room
    await page.reload();
    await roomShown();
    seen.length = 0;
    build('gh-b');
    expect(cachesOf().greenhouse === room1 && cachesOf().barn === barn1, '2. the new build has the same asset cache names (same files)');
    await page.reload();
    await roomShown();
    await checkUpdate();   // the browser finds the new sw.js; it installs and takes over
    await waitKeys(['slimekin-gh-b', room1, barn1], 'the update');
    await page.reload();   // now served by the new worker
    r = await roomShown();
    const roomReq = roomFiles();
    expect(r.ready && r.world === 'greenhouse', '2. after the update the game shows the room', JSON.stringify(r));
    expect(seen.includes('/sw.js') && seen.filter(p => p.endsWith('.js') && p.startsWith('/src/')).length > 20, `2. the update really happened (sw.js and ${seen.filter(p => p.startsWith('/src/') && p.endsWith('.js')).length} game files fetched again)`);
    expect(roomReq.length === 0, '2. no request for the room\'s files at all (gh.bin came from the kept room cache)', JSON.stringify(roomReq));
    expect(barnFiles().length === 0, '2. no request for the barn\'s files at all (its cache is kept)', JSON.stringify(barnFiles()));
    expect(JSON.stringify(await keys()) === JSON.stringify(['slimekin-gh-b', room1, barn1].sort()), '2. the old version cache is gone, the room and barn caches stay', JSON.stringify(await keys()));
    await page.screenshot({ path: path.join(SHOTS, 'offline-2-update.png') });

    // 3. a release with a different room (simulated: the same files under a new room cache name)
    seen.length = 0;
    build('gh-c');
    const room3 = 'slimekin-asset-greenhouse-test-changed';
    fs.writeFileSync(path.join(OUT, 'sw.js'), fs.readFileSync(path.join(OUT, 'sw.js'), 'utf8').replace(room1, room3));
    await page.reload();
    await roomShown();
    await checkUpdate();
    await waitKeys(['slimekin-gh-c', room3, barn1], 'the room update');
    await page.reload();
    r = await roomShown();
    expect(roomFiles().filter(p => p.endsWith('/gh.bin')).length >= 1, `3. a new room downloads again (${roomFiles().length} room file requests)`);
    expect(JSON.stringify(await keys()) === JSON.stringify(['slimekin-gh-c', room3, barn1].sort()), '3. the old room cache is gone, the barn\'s cache stays', JSON.stringify(await keys()));
    expect(barnFiles().length === 0, '3. the barn is not downloaded again (its files did not change)', JSON.stringify(barnFiles()));

    // 4. offline
    await context.setOffline(true);
    seen.length = 0;
    await page.reload();
    r = await roomShown();
    expect(r.ready && r.world === 'greenhouse', '4. offline: the game opens and shows the room', JSON.stringify(r));
    // the barn is not in the game yet (next slice): read its files the way the game will, through the worker
    const barn = await ev(() => Promise.all(['barn.json', 'barn.bin', 'floor_day.jpg', 'floor_night.jpg'].map(f => fetch('src/assets/barn/' + f).then(x => x.ok ? x.arrayBuffer().then(b => b.byteLength) : -x.status, () => 'failed'))));
    const barnOnDisk = ['barn.json', 'barn.bin', 'floor_day.jpg', 'floor_night.jpg'].map(f => fs.statSync(path.join(OUT, 'src/assets/barn', f)).size);
    expect(JSON.stringify(barn) === JSON.stringify(barnOnDisk), `4. offline: the barn's 4 files come from their cache (${barn.join(', ')} bytes)`, JSON.stringify({ barn, barnOnDisk }));
    expect(seen.length === 0, '4. offline: nothing reached the server', JSON.stringify(seen.slice(0, 5)));
    await page.screenshot({ path: path.join(SHOTS, 'offline-4-offline.png') });
    await context.setOffline(false);
  } catch (e) {
    errors.push('test error: ' + e.message);
  } finally {
    await deadline(browser.close(), 30000, 'closing the browser').catch(() => {});
    server.close();
  }
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
