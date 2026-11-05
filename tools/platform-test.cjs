// iPhone app seam test (src/platform/index.js), in a headless phone-sized browser. A fake window.Capacitor (a fake
// Preferences plugin kept in sessionStorage so it survives reloads, and a fake Haptics plugin) is put in before the
// game boots, the way Capacitor's iOS runtime does it, and every call is recorded. Proves:
//   (a) a fresh start restores nothing (the egg comes), and #debug does nothing in the app;
//   (b) localStorage wiped but the copy present: the game boots with that slime;
//   (c) copies are debounced (a burst of saves makes one write, at most one every MIRROR_MS) and flushed at once on
//       pagehide (the game's own last save included), and "Start over" drops the copy so the old slime stays gone;
//   (d) haptics: light for the game's 8 ms buzz, medium for a long one, never heavy, close taps merge; a boop on the
//       real game makes a light tap; failures of the phone's plugins never reach the game;
//   (e) with no Capacitor (or Capacitor that is not native) nothing changes: isNative false, no plugin is touched,
//       navigator.vibrate is called as before, and #debug still works on the web.
// Setup and running as in tools/smoke-test.cjs (playwright + three@0.170.0 outside the repo, found through NODE_PATH).
//   node tools/platform-test.cjs
const path = require('path');
const fs = require('fs');
const { devices } = require('playwright');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const OUT = path.join(__dirname, 'out', 'platform');
fs.mkdirSync(OUT, { recursive: true });
const KEY = 'slimekin.save.v1';
const PEBBLE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'main-gen2.json'), 'utf8')).save;   // "Pebble", playing
const VIEW = { width: 393, height: 852 };

// Runs in the page before any script. The scenario comes from ?pt=<name>; the fake plugins' storage and the call log
// live in sessionStorage under that name (a reload keeps them; the first visit clears localStorage).
function fakePhone({ seeds }) {
  const s = new URLSearchParams(location.search).get('pt');
  if (!s) return;
  const K = n => `pt.${s}.${n}`;
  if (!sessionStorage.getItem(K('started'))) {
    sessionStorage.setItem(K('started'), '1');
    try { localStorage.clear(); } catch { /* blocked */ }
    sessionStorage.setItem(K('prefs'), JSON.stringify(seeds[s] || {}));
    sessionStorage.setItem(K('calls'), '[]');
  }
  const calls = () => JSON.parse(sessionStorage.getItem(K('calls')));
  const rec = c => { const a = calls(); a.push({ ...c, t: Date.now() }); sessionStorage.setItem(K('calls'), JSON.stringify(a)); };
  const prefs = () => JSON.parse(sessionStorage.getItem(K('prefs')));
  const keep = p => sessionStorage.setItem(K('prefs'), JSON.stringify(p));
  window.__pt = { calls, prefs, rec };
  try { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: ms => { rec({ m: 'vibrate', ms }); return true; } }); } catch { /* ignore */ }
  if (s.startsWith('capweb')) {   // Capacitor on a web page: not native, and its plugins must not be touched
    window.Capacitor = { isNativePlatform: () => false, Plugins: new Proxy({}, { get: (o, k) => { rec({ m: 'plugins-access', k: String(k) }); return undefined; } }) };
    return;
  }
  if (s.startsWith('web')) return;
  const Preferences = {
    get: async ({ key }) => { const v = prefs()[key]; rec({ m: 'get', key, found: v != null }); return { value: v == null ? null : v }; },
    set: async ({ key, value }) => { rec({ m: 'set', key, value }); const p = prefs(); p[key] = value; keep(p); },
    remove: async ({ key }) => { rec({ m: 'remove', key }); const p = prefs(); delete p[key]; keep(p); },
  };
  const Haptics = { impact: async o => { rec({ m: 'impact', style: o && o.style }); } };
  window.Capacitor = { isNativePlatform: () => true, Plugins: { Preferences, Haptics } };
}

(async () => {
  const errors = [];
  const results = [];
  const check = (cond, what, extra = '') => { const line = (cond ? 'ok   ' : 'FAIL ') + what + (extra ? ' | ' + extra : ''); results.push(line); log(line); if (!cond) errors.push(what + (extra ? ' | ' + extra : '')); };
  let kit = null;
  watchdog(15, () => kit ? kit.current() : 'setup');
  try {
    const dev = devices['iPhone 15 Pro'];
    kit = await setup({ contextOptions: { userAgent: dev.userAgent, isMobile: true, hasTouch: true, viewport: VIEW, screen: VIEW, deviceScaleFactor: 1 } });
    const { page, step, ev } = kit;
    page.setDefaultTimeout(120000);
    const seeds = { restore: { [KEY]: JSON.stringify({ ...PEBBLE, savedAt: Date.now() - 60000 }) }, unitbad: { [KEY]: '{not json' } };
    await kit.context.addInitScript(fakePhone, { seeds });
    // A blank page on the test server for the module-level checks (no game running, so nothing else saves).
    await page.route(u => new URL(u).pathname === '/__pt.html', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>platform test</title><body>platform test</body>' }));
    const calls = () => ev(() => window.__pt.calls());
    const booted = () => page.waitForFunction(() => document.getElementById('boot')?.hidden === true, null, { timeout: 120000 });
    const lsSave = () => ev(k => { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }, KEY);
    const shot = name => step('screenshot ' + name, async () => { for (let i = 0; i < 2; i++) { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 120000 }); } }, 200000);

    // ---------- (a) fresh start in the app ----------
    await step('(a) open the app fresh', async () => { await page.goto(`${kit.server.origin}/?pt=fresh#debug`); await booted(); });
    await page.waitForTimeout(1500);
    {
      const c = await calls();
      const gets = c.filter(x => x.m === 'get');
      check(gets.length === 1 && gets[0].key === KEY && gets[0].found === false, '(a) one look for a copy at boot, none found', JSON.stringify(gets.map(g => [g.key, g.found])));
      const st = await lsSave();
      check(!st || st.phase === 'egg', '(a) nothing restored: a new egg', st ? `phase ${st.phase}` : 'no save yet');
      check(await ev(() => !document.getElementById('eggHint')?.hidden), '(a) the egg hint shows');
      check(await ev(() => window.slimekin === undefined), '(a) #debug does not expose the game in the app (window.slimekin undefined)');
      await shot('a-fresh');
    }

    // ---------- (b) localStorage wiped, the copy is there ----------
    await step('(b) open the app with only the copy', async () => { await page.goto(`${kit.server.origin}/?pt=restore#debug`); await booted(); });
    await page.waitForTimeout(1500);
    {
      const c = await calls();
      check(c.some(x => x.m === 'get' && x.key === KEY && x.found), '(b) the copy was read at boot');
      const st = await lsSave();
      check(st && st.slime && st.slime.name === 'Pebble' && st.phase === 'play' && st.ranch.family.generation === 2, '(b) localStorage has Pebble back', st ? `${st.slime.name} ${st.phase} gen ${st.ranch.family.generation}` : 'no save');
      const name = await ev(() => document.getElementById('nameBtn')?.innerText || '');
      check(/Pebble/.test(name), '(b) the game shows Pebble', JSON.stringify(name));
      check(await ev(() => !!document.getElementById('eggHint')?.hidden), '(b) no egg: the slime is back');
      await shot('b-restored');
      check(await ev(() => window.slimekin === undefined), '(b) #debug does not expose the game in the app');
      await page.click('#settingsBtn');
      await page.waitForSelector('#setDone');
      const dbg = await ev(() => ({ buttons: document.querySelectorAll('#modalCard [data-dbg]').length, text: /Debug/.test(document.getElementById('modalCard').innerText) }));
      check(dbg.buttons === 0 && !dbg.text, '(b) #debug: no Debug section in Settings in the app', JSON.stringify(dbg));
      await shot('b-settings-no-debug');
      await page.click('#setDone');
    }

    // ---------- (c) the game's own saves are copied, at most one write per MIRROR_MS; pagehide flushes ----------
    await step('(c) wait for two of the game\'s own saves to be copied', () => page.waitForFunction(() => window.__pt.calls().filter(x => x.m === 'set').length >= 2, null, { timeout: 170000 }), 180000);
    {
      const c = await calls();
      const sets = c.filter(x => x.m === 'set');
      const ls = await ev(k => localStorage.getItem(k), KEY);
      check(sets.every(x => x.key === KEY), '(c) only slimekin.save.v1 is copied', [...new Set(sets.map(x => x.key))].join(','));
      check(sets.length >= 1 && JSON.parse(sets[sets.length - 1].value).slime.name === 'Pebble', '(c) the game\'s save was copied', `${sets.length} write(s)`);
      const gaps = sets.slice(1).map((x, i) => x.t - sets[i].t);
      check(gaps.length >= 1 && gaps.every(g => g >= 2900), '(c) writes from play are at least 3 s apart', JSON.stringify(gaps));
      const before = c.length;
      const r = await ev(k => {
        const n = window.__pt.calls().length;
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));   // the game saves (saveNow) and the copy follows at once
        const after = window.__pt.calls().slice(n);
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        return { after, ls: localStorage.getItem(k) };
      }, KEY);
      const flushed = r.after.filter(x => x.m === 'set');
      check(flushed.length >= 1 && flushed[flushed.length - 1].value === r.ls, '(c) pagehide: the game\'s last save is copied at once (same text as localStorage)', `${flushed.length} write(s) during the event, ${before} calls before`);
      void ls;
    }

    // ---------- (d) a boop on the real game makes a light tap ----------
    {
      let impacts = [];
      for (const y of [0.56, 0.6, 0.52, 0.64, 0.48]) {
        await page.mouse.click(VIEW.width / 2, VIEW.height * y);
        await page.waitForTimeout(400);
        impacts = (await calls()).filter(x => x.m === 'impact');
        if (impacts.length) break;
      }
      check(impacts.length >= 1 && impacts.every(x => x.style === 'LIGHT'), '(d) a boop on the slime makes a LIGHT tap', JSON.stringify(impacts.map(x => x.style)));
      check(!(await calls()).some(x => x.m === 'vibrate'), '(d) navigator.vibrate is not used in the app');
    }

    // ---------- (c) "Start over" drops the copy ----------
    await step('(c) start over', async () => {
      await page.click('#settingsBtn');
      await page.click('#setReset');
      const nav = page.waitForNavigation({ waitUntil: 'commit', timeout: 90000 });
      await page.click('#reset');
      await nav;
      await booted();
    });
    await page.waitForTimeout(1500);
    {
      const c = await calls();
      const st = await lsSave();
      check(c.some(x => x.m === 'remove' && x.key === KEY), '(c) Start over removed the copy');
      check(!st || st.phase === 'egg', '(c) after Start over: a new egg, Pebble is not restored', st ? `phase ${st.phase}, name ${JSON.stringify(st.slime.name)}` : 'no save yet');
      const prefs = await ev(() => window.__pt.prefs());
      const kept = prefs[KEY] ? JSON.parse(prefs[KEY]) : null;
      check(!kept || kept.slime.name !== 'Pebble', '(c) the copy no longer holds Pebble', kept ? `copy: phase ${kept.phase}` : 'no copy');
      check(await ev(() => localStorage.getItem('slimekin.platform.cleared') === null), '(c) the Start over marker is gone after the boot that used it');
      await shot('c-after-start-over');
    }

    // ---------- module checks on a blank page (no game) ----------
    await step('(c) module: burst of saves, one write', async () => { await page.goto(`${kit.server.origin}/__pt.html?pt=unit`); });
    {
      const r = await ev(async () => {
        const p = await import('/src/platform/index.js');
        const sets = () => window.__pt.calls().filter(x => x.m === 'set');
        const t0 = Date.now();
        for (let i = 1; i <= 5; i++) p.mirrorSave('m' + i);
        await new Promise(r => setTimeout(r, 200));
        const early = sets().length;
        await new Promise(r => setTimeout(r, p.MIRROR_MS + 300));
        const first = sets().map(x => ({ v: x.value, dt: x.t - t0 }));
        p.mirrorSave('m6'); p.mirrorSave('m7');
        await new Promise(r => setTimeout(r, p.MIRROR_MS + 300));
        const second = sets().map(x => ({ v: x.value, dt: x.t - t0 }));
        // pagehide flushes at once, and while leaving every save is written at once; pageshow ends that
        p.mirrorSave('p1');
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
        const atHide = sets().map(x => x.value);
        p.mirrorSave('p2');
        const whileLeaving = sets().map(x => x.value);
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        p.mirrorSave('p3');
        await new Promise(r => setTimeout(r, 100));
        const afterShow = sets().map(x => x.value);
        return { isNative: p.isNative, store: p.store, ads: p.ads, MIRROR_MS: p.MIRROR_MS, early, first, second, atHide, whileLeaving, afterShow };
      });
      check(r.isNative === true && r.store === null && r.ads === null, '(c) module: isNative true with the fake runtime; store and ads slots are null');
      check(r.early === 0, '(c) module: no write right after a burst of five saves', `${r.early}`);
      check(r.first.length === 1 && r.first[0].v === 'm5' && r.first[0].dt >= r.MIRROR_MS - 50, '(c) module: one write, the last save, after MIRROR_MS', JSON.stringify(r.first));
      check(r.second.length === 2 && r.second[1].v === 'm7' && r.second[1].dt - r.second[0].dt >= r.MIRROR_MS, '(c) module: the next burst is one more write, MIRROR_MS later', JSON.stringify(r.second));
      check(r.atHide[r.atHide.length - 1] === 'p1', '(c) module: pagehide writes the pending save at once', JSON.stringify(r.atHide.slice(-2)));
      check(r.whileLeaving[r.whileLeaving.length - 1] === 'p2', '(c) module: a save during pagehide is written at once', JSON.stringify(r.whileLeaving.slice(-2)));
      check(r.afterShow[r.afterShow.length - 1] === 'p2', '(c) module: after pageshow saves wait again', JSON.stringify(r.afterShow.slice(-2)));
    }
    {
      const r = await ev(async () => {
        const p = await import('/src/platform/index.js');
        const taps = () => window.__pt.calls().filter(x => x.m === 'impact').map(x => x.style);
        p.haptic(8); const a = taps();
        p.haptic(8); const merged = taps();
        await new Promise(r => setTimeout(r, 120));
        p.haptic(40); const b = taps();
        await new Promise(r => setTimeout(r, 120));
        p.haptic(500); const c = taps();
        const vib = window.__pt.calls().filter(x => x.m === 'vibrate').length;
        // the phone's plugins failing: throws and rejections never reach the game
        const rejections = [];
        window.addEventListener('unhandledrejection', e => rejections.push(String(e.reason)));
        const P = window.Capacitor.Plugins.Preferences, H = window.Capacitor.Plugins.Haptics;
        let threw = null;
        try {
          P.set = () => { throw new Error('set throws'); };
          p.mirrorSave('t1');
          window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
          P.set = () => Promise.reject(new Error('set rejects'));
          p.mirrorSave('t2');
          window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
          H.impact = () => Promise.reject(new Error('impact rejects'));
          await new Promise(r => setTimeout(r, 120));
          p.haptic(8);
          delete window.Capacitor.Plugins.Haptics;
          await new Promise(r => setTimeout(r, 120));
          p.haptic(8);
        } catch (e) { threw = e.message; }
        // a copy that never answers: boot waits at most RESTORE_MS, then plays on
        P.get = () => new Promise(() => {});
        localStorage.removeItem('slimekin.save.v1');
        const t0 = Date.now();
        const restored = await p.restoreSave();
        const waited = Date.now() - t0;
        await new Promise(r => setTimeout(r, 300));
        return { a, merged, b, c, vib, threw, rejections, restored, waited };
      });
      check(JSON.stringify(r.a) === '["LIGHT"]', '(d) module: haptic(8) (the boop) is a LIGHT tap', JSON.stringify(r.a));
      check(r.merged.length === 1, '(d) module: a second tap within 60 ms is merged', JSON.stringify(r.merged));
      check(r.b[r.b.length - 1] === 'MEDIUM' && r.c[r.c.length - 1] === 'MEDIUM' && !r.c.includes('HEAVY'), '(d) module: a long buzz is MEDIUM, never HEAVY', JSON.stringify(r.c));
      check(r.vib === 0, '(d) module: navigator.vibrate is not called in the app');
      check(r.threw === null && r.rejections.length === 0, '(d) module: plugin throws and rejections never reach the game', JSON.stringify({ threw: r.threw, rejections: r.rejections }));
      check(r.restored === false && r.waited >= 1400 && r.waited < 3000, '(b) module: a copy that never answers holds the boot at most ~1.5 s', `${r.waited} ms`);
    }
    await step('(b) module: an unreadable copy is not restored', async () => { await page.goto(`${kit.server.origin}/__pt.html?pt=unitbad`); });
    {
      const r = await ev(async () => {
        const p = await import('/src/platform/index.js');
        const restored = await p.restoreSave();
        return { restored, ls: localStorage.getItem('slimekin.save.v1') };
      });
      check(r.restored === false && r.ls === null, '(b) module: an unreadable copy is not written back', JSON.stringify(r));
    }

    // ---------- (e) no Capacitor, and Capacitor that is not native ----------
    for (const s of ['web', 'capweb']) {
      await step(`(e) module on the web (${s})`, async () => { await page.goto(`${kit.server.origin}/__pt.html?pt=${s}`); });
      const r = await ev(async () => {
        const p = await import('/src/platform/index.js');
        const obj = { saveLocal() {}, clearLocal() {} };
        const sl = obj.saveLocal, cl = obj.clearLocal;
        const same = p.mirrorSaves(obj) === obj && obj.saveLocal === sl && obj.clearLocal === cl;
        p.mirrorSave('{"x":1}');
        p.haptic(8);
        const restored = await p.restoreSave();
        await new Promise(r => setTimeout(r, p.MIRROR_MS + 300));
        const c = window.__pt.calls();
        return { isNative: p.isNative, same, restored, vib: c.filter(x => x.m === 'vibrate').map(x => x.ms), plugin: c.filter(x => x.m !== 'vibrate') };
      });
      check(r.isNative === false, `(e) ${s}: isNative is false`);
      check(r.same, `(e) ${s}: the save store is left exactly as it is`);
      check(r.restored === false && r.plugin.length === 0, `(e) ${s}: no plugin is touched`, JSON.stringify(r.plugin));
      check(JSON.stringify(r.vib) === '[8]', `(e) ${s}: haptic(8) calls navigator.vibrate(8), as buzz() always did`, JSON.stringify(r.vib));
    }
    await step('(e) the web game with #debug', async () => { await page.goto(`${kit.server.origin}/?pt=webgame#debug`); await page.waitForFunction(() => window.slimekin && window.slimekin.egg, null, { timeout: 120000 }); });
    {
      const r = await ev(() => {
        const g = window.slimekin;
        g.state.settings.sound = true; g.reduced = false;
        g.buzz(8);
        return { vib: window.__pt.calls().filter(x => x.m === 'vibrate').map(x => x.ms), debug: !!g, cap: typeof window.Capacitor };
      });
      check(r.debug && r.cap === 'undefined', '(e) web: #debug still exposes the game (window.slimekin)');
      check(JSON.stringify(r.vib) === '[8]', '(e) web: the game\'s buzz(8) calls navigator.vibrate(8)', JSON.stringify(r.vib));
      const dbg = await ev(() => { window.slimekin.openSettings(); return document.querySelectorAll('#modalCard [data-dbg]').length; });
      check(dbg > 0, '(e) web: Settings still has the Debug section', `${dbg} debug buttons`);
    }
  } catch (e) {
    errors.push('test error: ' + e.message);
  } finally {
    if (kit) { errors.unshift(...kit.errors); kit.report(); await kit.close(); }
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), results.join('\n') + '\n' + (errors.length ? 'FAILED\n' + errors.join('\n') : 'OK') + '\n');
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log(`\nOK (${results.length} checks)`);
})();
