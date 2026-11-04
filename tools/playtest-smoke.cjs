// Playtest fixes 1 browser test (393x852, a phone in a headless browser), from an old generation-3 save
// (tools/fixtures/main-gen3.json, made with the code before breeding):
//   sheet   the stretchy menu sheet: real touch drags (CDP Input.dispatchTouchEvent) on the grip, the tab bar and
//           the list, at home and on the ranch; prints the sheet height before and after every gesture
//           (normal -> tall -> normal -> closed, a flick up, a drag up on the list at normal, a drag up on the list
//           when tall scrolls the list, home <-> ranch comes back at normal)
//   egg     move out choosing a Nursery egg that is still warming: taps before it is ready don't hatch it,
//           then time passes (g.advance) and it hatches
//   swap    put a Nursery egg on the cushion instead of the egg there
//   rehome  find a baby (not grown yet) a new home and pick a Nursery egg; no pearls, no Family Bonus
// Fails on any page error. Screenshots (day and night) go to tools/out/playtest/.
//
// Setup as in tools/smoke-test.cjs (playwright + three@0.170.0 outside the repo, found through NODE_PATH).
// Starts its own dev server on a free loopback port, runs offline and stops everything on exit; a stuck step
// fails with a note on what the browser was doing (tools/browser-kit.cjs).
//   node tools/playtest-smoke.cjs [--dpr 2] [--quick] [--only sheet,egg,swap,rehome]   (--quick: day screenshots only)
const path = require('path');
const fs = require('fs');
const { devices } = require('playwright');
const { setup, watchdog, log: stamp } = require('./browser-kit.cjs');

const OUT = path.join(__dirname, 'out', 'playtest');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const DPR = Number(arg('dpr', 2));
const QUICK = process.argv.includes('--quick');
const ONLY = arg('only', 'sheet,egg,swap,rehome').split(',');
const VIEW = { width: 393, height: 852 };
fs.mkdirSync(OUT, { recursive: true });
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'main-gen3.json'), 'utf8')).save;

(async () => {
  const errors = [];
  const log = [];
  const note = (...a) => { const s = a.join(' '); log.push(s); stamp(s); };
  const expect = (cond, what, got) => { note((cond ? 'ok   ' : 'FAIL ') + what + (got !== undefined ? ' | ' + got : '')); if (!cond) errors.push(what + (got !== undefined ? ' | ' + got : '')); };
  let kit = null;
  watchdog(50, () => kit ? kit.current() : 'setup');
  try {
    const dev = devices['iPhone 15 Pro'];
    kit = await setup({ contextOptions: { userAgent: dev.userAgent, isMobile: true, hasTouch: true, viewport: VIEW, screen: VIEW, deviceScaleFactor: DPR } });
    const { page, step } = kit;
    // the old save is on the "phone" before the new code first opens it
    await kit.context.addInitScript(save => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('slimekin.save.v1', JSON.stringify(save)); } }, { ...FIXTURE, savedAt: Date.now() - 60000 });
    page.setDefaultTimeout(120000);
    const ev = (fn, a, ms) => kit.ev(fn, a, ms);
    const cdp = await kit.context.newCDPSession(page);
    const setTheme = async dark => { await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark); await page.waitForTimeout(300); await ev(() => window.slimekin.advance(0.5)); };
    // Headless Chrome only advances CSS transitions when it draws, so screenshots double as "settle".
    // (a tiny clipped screenshot draws a frame just the same, and is quick to encode)
    const settle = async () => { for (let i = 0; i < 2; i++) { await page.waitForTimeout(250); await page.screenshot({ clip: { x: 0, y: 0, width: 8, height: 8 }, timeout: 120000 }); } };
    const shot = (name, { night = !QUICK } = {}) => step('screenshot ' + name, async () => {
      for (const dark of night ? [false, true] : [false]) {
        await setTheme(dark);
        for (let i = 0; i < 2; i++) {
          await ev(() => { const s = window.slimekin.slime; s.blinkT = 99; s.blinkPhase = -1; s.blink = 0; });
          await page.waitForTimeout(250);
          await page.screenshot({ path: path.join(OUT, `${name}-${dark ? 'night' : 'day'}.png`), timeout: 120000 });
        }
      }
      await setTheme(false);
      note('screenshot', name);
    }, 300000);
    const boot = async () => {
      await page.waitForFunction(() => window.slimekin && window.slimekin.state, null, { timeout: 120000 });
      await page.waitForTimeout(2500);
      await ev(() => { const g = window.slimekin; g.behave.hour = () => 14; g.state.settings.quality = 'high'; g.applySettings(); });
    };
    const calm = () => ev(() => { const g = window.slimekin; g.state.tutorial = 5; g.requests.timer = 1e9; g.glimmerT = 1e9; g.debug('needs'); });
    const hatchNow = async name => {
      await ev(() => { const g = window.slimekin; for (let i = 0; i < 5; i++) g.tapEgg(g.egg.group.position.clone()); g.advance(4.5); });
      await page.waitForSelector('#slimeName');
      await page.fill('#slimeName', name); await page.click('#nameOk');
      await calm();
    };

    // ---------- touch drags on the sheet (real touch events through CDP) ----------
    // Every event carries its own timestamp (seconds), so the speed the page sees is the one written here, not how
    // fast this machine happens to deliver the events: slow = 110 ms per step (~0.2-0.3 px/ms) and the finger rests
    // 250 ms before lifting; fast = three steps 16 ms apart (a flick).
    const touch = (type, x, y, ts) => cdp.send('Input.dispatchTouchEvent', { type, timestamp: ts,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
    const drag = async (x, y0, y1, { fast = false } = {}) => {
      const t0 = Date.now() / 1000, gap = fast ? 0.016 : 0.11, steps = fast ? 3 : 10;
      await touch('touchStart', x, y0, t0);
      for (let i = 1; i <= steps; i++) await touch('touchMove', x, y0 + (y1 - y0) * i / steps, t0 + gap * i);
      let tEnd = t0 + gap * steps;
      if (!fast) { tEnd += 0.25; await touch('touchMove', x, y1 + (y1 > y0 ? 1 : -1), tEnd); }
      await touch('touchEnd', 0, 0, tEnd + 0.016);
    };
    const tap = async (x, y) => { const t0 = Date.now() / 1000; await touch('touchStart', x, y, t0); await touch('touchEnd', 0, 0, t0 + 0.08); };
    const sheet = () => ev(() => { const g = window.slimekin, p = document.getElementById('panel'), r = p.getBoundingClientRect(), tb = document.querySelector('.tab-body:not([hidden])');
      return { state: g.hud.sheetState(), h: Math.round(r.height), top: Math.round(r.top), screen: innerHeight, topBar: Math.round(document.querySelector('.top').getBoundingClientRect().bottom),
        scroll: tb ? Math.round(tb.scrollTop) : 0, cls: p.className, inline: p.style.height }; });
    const openSheet = async () => { if ((await sheet()).state === 'closed') await page.click('#tab-slime'); await settle(); };
    // a scroll fling keeps going after the finger lifts: wait until the list is still, then put it back at the top
    const listToTop = async () => {
      for (let i = 0; i < 6; i++) {
        await settle();
        const a = await ev(() => document.querySelector('.tab-body:not([hidden])').scrollTop);
        await page.waitForTimeout(400);
        const b = await ev(() => document.querySelector('.tab-body:not([hidden])').scrollTop);
        if (a === b) break;
      }
      await ev(() => { document.querySelector('.tab-body:not([hidden])').scrollTop = 0; });
      await settle();
    };
    const where = async () => ev(() => {
      const c = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), top: Math.round(r.top), bottom: Math.round(r.bottom) }; };
      return { grip: c(document.getElementById('sheetGrip')), tabs: c(document.querySelector('.tabs')), list: c(document.querySelector('.tab-body:not([hidden])')) };
    });
    const gesture = async (what, fn, want) => {
      const before = await sheet();
      await fn(await where());
      await settle();
      const after = await sheet();
      const okState = !want || after.state === want.state;
      const okScroll = !want || want.scrolled === undefined || (want.scrolled ? after.scroll > before.scroll : true);
      expect(okState && okScroll, `${what}: ${before.state} ${before.h}px -> ${after.state} ${after.h}px`, `top bar ends at ${after.topBar}px, sheet top ${after.top}px, list scrolled ${before.scroll} -> ${after.scroll}${want ? `; wanted ${want.state}${want.scrolled ? ' and the list scrolled' : ''}` : ''}${okState && okScroll ? '' : ` (classes \"${after.cls}\", inline height \"${after.inline}\")`}`);
      return after;
    };

    // ---------- 0. the old save opens; the baby hatches ----------
    kit.mark('0. the old save opens');
    await page.goto(`${kit.server.origin}/#debug`);
    await boot();
    const st0 = await ev(() => { const g = window.slimekin; return { phase: g.state.phase, gen: g.state.ranch.family.generation, residents: g.state.ranch.residents.map(x => x.name + ' (' + x.form.name + ')'), egg: g.state.egg }; });
    note('old save opened:', JSON.stringify(st0));
    if (st0.phase !== 'egg' || st0.residents.length !== 2) errors.push('old save did not load as expected: ' + JSON.stringify(st0));
    await hatchNow('Hazel');

    // ---------- 1. the stretchy sheet ----------
    if (ONLY.includes('sheet')) {
      kit.mark('1. the stretchy sheet (home)');
      await page.click('#tab-slime');   // the Slime tab: a long list to scroll
      await settle();
      const s0 = await sheet();
      expect(s0.state === 'normal', `opens at normal: ${s0.h}px of ${s0.screen}px`, JSON.stringify(s0));
      await shot('01-home-normal');
      let s = await gesture('drag up from the grip (slow, most of the way)', w => drag(w.grip.x, w.grip.y, 160), { state: 'tall' });
      expect(Math.abs(s.top - (s.topBar + 8)) <= 2, `tall: the sheet top sits just under the top HUD bar (${(s.h / s.screen * 100).toFixed(0)}% of the screen)`, `sheet top ${s.top}, bar bottom ${s.topBar}`);
      await shot('02-home-tall');
      await gesture('drag down from the grip (slow, past halfway)', w => drag(w.grip.x, w.grip.y, w.grip.y + 170), { state: 'normal' });
      await gesture('drag down from the grip (slow, 150 px)', w => drag(w.grip.x, w.grip.y, w.grip.y + 150), { state: 'closed' });
      await openSheet();
      s = await sheet(); expect(s.state === 'normal', `reopens at normal (${s.h}px)`);
      await gesture('flick up from the grip (short and fast)', w => drag(w.grip.x, w.grip.y, w.grip.y - 50, { fast: true }), { state: 'tall' });
      await gesture('flick down from the tab bar', w => drag(w.tabs.x - 60, w.tabs.y, w.tabs.y + 60, { fast: true }), { state: 'normal' });
      await gesture('small drag up from the grip (40 px, slow): snaps back', w => drag(w.grip.x, w.grip.y, w.grip.y - 40), { state: 'normal' });
      await gesture('drag up on the list at normal', w => drag(w.list.x, w.list.y + 40, w.list.y - 200), { state: 'tall' });
      await gesture('drag up on the list when tall scrolls the list', w => drag(w.list.x, w.list.y + 120, w.list.y - 120), { state: 'tall', scrolled: true });
      await listToTop();
      await gesture('drag down on the list (scrolled to the top) when tall', w => drag(w.list.x, w.list.top + 30, w.list.top + 240), { state: 'normal' });
      await gesture('drag down on the list (top) at normal: closes', w => drag(w.list.x, w.list.top + 30, w.list.top + 180), { state: 'closed' });
      await openSheet();
      await gesture('drag up from the tab bar', w => drag(w.tabs.x - 60, w.tabs.y, 200), { state: 'tall' });
      const tabsOk = await ev(() => window.slimekin.hud.tab);
      expect(tabsOk === 'slime', 'a drag from the tab bar does not tap a tab', tabsOk);
      await gesture('tap on the grip closes', w => tap(w.grip.x, w.grip.y), { state: 'closed' });

      kit.mark('1b. the stretchy sheet (ranch)');
      await openSheet();
      await gesture('home: drag up to tall', w => drag(w.grip.x, w.grip.y, 160), { state: 'tall' });
      await page.click('#tab-ranch'); await ev(() => window.slimekin.advance(4)); await settle();
      s = await sheet(); expect(s.state === 'normal', `going to the ranch: back at normal (${s.h}px)`, JSON.stringify(s));
      await shot('03-ranch-normal');
      await gesture('ranch: drag up from the grip', w => drag(w.grip.x, w.grip.y, 160), { state: 'tall' });
      await shot('04-ranch-tall');
      await ev(() => window.slimekin.leaveRanch(false)); await settle();
      s = await sheet(); expect(s.state === 'normal' || s.state === 'closed', `back home from the ranch: not tall (${s.state} ${s.h}px)`);
      await ev(() => { const g = window.slimekin; g.hud.setSheet('closed'); g.hud.selectTab('helpers'); g.advance(1); });
    }
    const fin = await ev(() => ({ phase: window.slimekin.state.phase }));
    note('end:', JSON.stringify(fin));
  } catch (e) {
    errors.push('test error: ' + (e.stack || e.message));
    if (kit && !e.diagnosed) await kit.diagnose();
  } finally {
    if (kit) { errors.unshift(...kit.errors); kit.report(); await kit.close(); }
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n') + '\n' + (errors.length ? 'FAILED\n' + errors.join('\n') : 'OK') + '\n');
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
