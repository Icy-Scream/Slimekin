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
    // shared by the egg, swap and rehome parts
    let skip = 0;
    const keepClock = () => ev(() => window.slimekin.timeSkip).then(v => { skip = v; });
    const reloadInto = async click => {
      // armed before the goodbye plays; it only waits for the new page to start, boot() then waits for the game
      const nav = page.waitForNavigation({ waitUntil: 'commit', timeout: 90000 });
      await click();
      await ev(() => window.slimekin.advance(6));               // goodbye, fade, save, reload
      await nav;
      await boot();
      await ev(s => { window.slimekin.timeSkip = s; }, skip);  // keep the test clock (the reload starts a new game object)
    };
    const growUp = () => ev(() => {
      const g = window.slimekin;
      g.state.tutorial = 5; g.requests.timer = 1e9;
      Object.assign(g.state.slime.traits, { sweet: 22, heat: 16 });
      for (let i = 0; i < 3; i++) { g.debug('grow'); g.advance(3); g.hud.closeModal(); }   // to Settled
      g.state.totalJelly = 3e9;
      g.advance(1); g.hud.closeModal();
    });
    const breedInNursery = async (a, b) => {
      await ev(() => { const g = window.slimekin; if (g.view !== 'ranch') g.hud.openTab('ranch'); g.advance(2); g.openNursery(); g.advance(2); });
      await page.click(`.parent-pick:has-text("${a}")`); await page.click(`.parent-pick:has-text("${b}")`);
      await page.click('#breedBtn');
      await ev(() => window.slimekin.advance(2));
    };
    const eggState = () => ev(() => { const g = window.slimekin, s = g.state; return { phase: s.phase, warmth: s.egg.warmth, bred: s.egg.bred && s.egg.bred.id,
      readyIn: Math.round(g.sim.eggSecondsLeft(g.nowMs()) / 60), parents: (s.slime.lineage.parents || []).map(p => p.name).join(' & '), title: document.getElementById('eggTitle').textContent,
      hint: document.getElementById('eggText').textContent, nursery: g.sim.ranch.eggs().map(e => e.parents.map(p => p.name).join(' & ')), given: s.ranch.nursery.given }; });

    // ---------- 2. move out with a Nursery egg that is still warming ----------
    if (ONLY.includes('egg')) {
      kit.mark('2. a warming Nursery egg at move-out');
      await ev(() => { const g = window.slimekin; g.debug('pearls'); g.advance(1); });
      await breedInNursery('Juniper', 'Pebble');
      const e0 = await ev(() => { const g = window.slimekin, e = g.sim.ranch.eggs()[0]; return { n: g.sim.ranch.eggs().length, readyIn: Math.round(g.sim.ranch.eggSecondsLeft(e, g.nowMs()) / 60) }; });
      expect(e0.n === 1 && e0.readyIn >= 59, 'Juniper and Pebble made an egg in the Nursery (still warming)', JSON.stringify(e0));
      await ev(() => window.slimekin.leaveRanch());
      await growUp();
      await page.click('#tab-ranch'); await ev(() => window.slimekin.advance(3));
      await page.click('#moveOutBtn');
      await page.waitForSelector('.egg-choice');
      const choice = await ev(() => [...document.querySelectorAll('.egg-choice .choice')].map(b => ({ egg: b.dataset.egg, disabled: b.disabled, text: b.innerText.replace(/\s+/g, ' ') })));
      note('egg choice:', JSON.stringify(choice));
      const warm = choice.find(c => c.egg);
      expect(warm && !warm.disabled && /Still warming: ready in \d+ min, it can finish on the cushion/.test(warm.text), 'the warming egg can be chosen and says it can finish on the cushion', warm && warm.text);
      await page.click('.choice[data-egg]:not([data-egg=""])');
      await shot('05-moveout-warming-choice');
      await keepClock();
      await reloadInto(() => page.click('#mvYes'));
      let es = await eggState();
      note('after moving out:', JSON.stringify(es));
      expect(es.phase === 'egg' && es.bred && es.readyIn >= 55 && es.parents === 'Juniper & Pebble', 'Juniper and Pebble\'s egg is on the cushion, still warming', `ready in ${es.readyIn} min`);
      await ev(() => window.slimekin.advance(2));
      const moved = await ev(() => document.getElementById('modalCard').innerText.replace(/\s+/g, ' '));
      expect(/still warming: ready in \d+ min/i.test(moved), 'the moved-in card says the egg is still warming', moved.slice(0, 260));
      await shot('06-moved-in-warming');
      await ev(() => { window.slimekin.hud.closeModal(); window.slimekin.advance(1.5); });
      // a real tap on the egg (through the canvas), then a few more: no warmth while it warms
      const at = await ev(() => { const g = window.slimekin, p = g.screenOf(g.egg.group.position.clone().add(new (g.v1.constructor)(0, 0.7, 0))); return { x: Math.round(p.x), y: Math.round(p.y) }; });
      await tap(at.x, at.y);
      await ev(() => { const g = window.slimekin; for (let i = 0; i < 4; i++) g.tapEgg(g.egg.group.position.clone()); g.advance(0.5); });
      es = await eggState();
      const toast = await ev(() => document.getElementById('toasts').innerText.replace(/\s+/g, ' '));
      expect(es.phase === 'egg' && es.warmth === 0 && /Still warming/.test(es.title) && /Ready in \d+ min/.test(es.hint) && /Not yet/.test(toast), 'taps before it is ready: a "not yet" shake and toast, no warmth, the hint counts down', `${es.title}: ${es.hint} | toast: ${toast}`);
      await shot('07-egg-still-warming');
      // an hour passes (wall clock: works while the game is closed; here g.advance moves the test clock)
      const t0 = Date.now();
      await ev(() => window.slimekin.advance(3605, 1 / 10), null, 300000);
      await ev(() => window.slimekin.advance(1.5));
      note(`advanced one hour of game time in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      es = await eggState();
      expect(es.readyIn === 0 && /Tap the egg/.test(es.hint), 'after the hour the egg is ready: taps work again', `${es.title}: ${es.hint}`);
      await ev(() => { const g = window.slimekin; for (let i = 0; i < 5; i++) g.tapEgg(g.egg.group.position.clone()); g.advance(4.5); });
      await page.waitForSelector('#slimeName');
      const title = await ev(() => document.querySelector('#modalCard h2').textContent);
      expect(/Juniper and Pebble's baby hatched/.test(title), 'it hatches', title);
      await page.fill('#slimeName', 'Pip'); await page.click('#nameOk');
      await calm();
    }

    // ---------- 3. swap the cushion egg (the captain's case) ----------
    // Move out with a plain egg, don't hatch it, visit the ranch while it waits, breed the slime that just moved out,
    // and put their egg on the cushion; then swap it for another Nursery egg (the first goes back to the Nursery).
    if (ONLY.includes('swap')) {
      kit.mark('3. swap the cushion egg');
      // parents rested, pearls, and room on the ranch for one more slime (the egg part moved one out already)
      const rest = () => ev(() => { const g = window.slimekin, R = g.state.ranch; for (const x of R.residents) x.bredDay = null; R.slots = Math.max(R.slots, R.residents.length + 2); g.debug('pearls'); g.advance(1); });
      await rest();
      await breedInNursery('Juniper', 'Pebble');                                  // egg A, warming
      await ev(() => window.slimekin.leaveRanch());
      await growUp();
      const mover = await ev(() => window.slimekin.state.slime.name);
      await page.click('#tab-ranch'); await ev(() => window.slimekin.advance(3));
      await page.click('#moveOutBtn');
      await page.waitForSelector('.egg-choice');
      await keepClock();
      await reloadInto(() => page.click('#mvYes'));                             // "A new egg" (plain) is the default
      await ev(() => { const g = window.slimekin; g.advance(2); g.hud.closeModal(); g.advance(0.5); });   // the moved-in card
      let es = await eggState();
      const ui = await ev(() => ({ hasRanch: document.getElementById('ui').classList.contains('has-ranch'),
        tabs: [...document.querySelectorAll('.tab')].filter(t => t.offsetParent).map(t => t.textContent.trim()), alt: !document.getElementById('eggAlt').hidden && document.getElementById('eggAlt').textContent }));
      expect(es.phase === 'egg' && !es.bred && es.nursery.length === 1, 'a plain egg on the cushion, and the Nursery egg still waiting', JSON.stringify(es));
      expect(ui.hasRanch && ui.tabs.join() === 'Ranch' && /Nursery egg instead/.test(ui.alt), 'while the egg waits: the Ranch tab and a "Nursery egg instead?" link', JSON.stringify(ui));
      await ev(() => { const g = window.slimekin; g.tapEgg(g.egg.group.position.clone()); g.tapEgg(g.egg.group.position.clone()); g.advance(0.5); });
      const warm0 = (await eggState()).warmth;
      await shot('08-egg-with-ranch-tab');
      // to the Nursery from the link under the egg; the slime that just moved out makes an egg with Juniper
      await page.click('#eggAlt');
      await ev(() => window.slimekin.advance(3));
      const view = await ev(() => ({ view: window.slimekin.view, page: window.slimekin.ranchPage, sheet: window.slimekin.hud.sheetState() }));
      expect(view.view === 'ranch' && view.page === 'nursery' && view.sheet === 'normal', 'the link opens the Nursery on the ranch (while the egg waits at home)', JSON.stringify(view));
      await rest();
      await ev(() => window.slimekin.openNursery());
      await page.click(`.parent-pick:has-text("${mover}")`); await page.click('.parent-pick:has-text("Juniper")');
      await page.click('#breedBtn');
      await ev(() => window.slimekin.advance(2));
      const nb = await ev(() => [...document.querySelectorAll('[data-act="cushion"]')].map(b => b.textContent));
      expect(nb.length === 2 && nb.every(t => t === 'Put on the cushion'), 'every Nursery egg has "Put on the cushion" (ready or warming)', nb.join(', '));
      await shot('09-nursery-put-on-cushion');
      // the new egg (the mover's) goes on the cushion; the plain egg goes to a neighbor family
      await page.click(`.egg-card:has-text("${mover}") [data-act="cushion"]`);
      await page.waitForSelector('#cuYes');
      const ask = await ev(() => document.getElementById('modalCard').innerText.replace(/\s+/g, ' '));
      expect(new RegExp(`Put ${mover} and Juniper's egg on the cushion\\?|Put Juniper and ${mover}'s egg on the cushion\\?`).test(ask) && /The egg there now will go to a neighbor family/.test(ask), 'the confirm step says where the egg there now goes', ask);
      await shot('10-swap-confirm-plain');
      await page.click('#cuYes');
      await ev(() => window.slimekin.advance(2));
      es = await eggState();
      expect(es.phase === 'egg' && es.bred && es.parents.includes(mover) && es.warmth === 0 && es.given >= 1 && es.nursery.length === 1 && warm0 > 0,
        'plain -> bred: their egg is on the cushion (warmth back to 0), the plain egg went to a neighbor family', JSON.stringify(es));
      const home = await ev(() => window.slimekin.view);
      expect(home === 'home', 'back home to see it on the cushion', home);
      await shot('11-swapped-egg-on-cushion');
      // and back: Juniper and Pebble's egg takes its place; the mover's egg goes back to the Nursery
      const given1 = es.given;
      await page.click('#eggAlt'); await ev(() => window.slimekin.advance(3));
      await page.click('.egg-card:has-text("Pebble") [data-act="cushion"]');
      await page.waitForSelector('#cuYes');
      const ask2 = await ev(() => document.getElementById('modalCard').innerText.replace(/\s+/g, ' '));
      expect(/will go back to the Nursery/.test(ask2), 'bred -> bred: the confirm step says the egg there now goes back to the Nursery', ask2);
      await shot('12-swap-confirm-bred');
      await page.click('#cuYes');
      await ev(() => window.slimekin.advance(2));
      es = await eggState();
      expect(es.parents === 'Juniper & Pebble' && es.given === given1 && es.nursery.length === 1 && es.nursery[0].includes(mover), 'bred -> bred: the other egg went back to the Nursery (nothing given away)', JSON.stringify(es));
      // it hatches when ready
      await ev(() => window.slimekin.advance(3605, 1 / 10), null, 300000);
      await ev(() => { const g = window.slimekin; g.advance(1.5); for (let i = 0; i < 5; i++) g.tapEgg(g.egg.group.position.clone()); g.advance(4.5); });
      await page.waitForSelector('#slimeName');
      await page.fill('#slimeName', 'Clover'); await page.click('#nameOk');
      await calm();
      const after = await ev(() => ({ phase: window.slimekin.state.phase, ui: document.getElementById('ui').className, tabs: [...document.querySelectorAll('.tab')].filter(t => t.offsetParent).length }));
      expect(after.phase === 'play' && !/has-ranch|egg/.test(after.ui) && after.tabs === 6, 'after hatching the menu is back to all six tabs', JSON.stringify(after));
    }

    // ---------- 4. find a baby a new home, and pick a Nursery egg ----------
    if (ONLY.includes('rehome')) {
      kit.mark('4. find a baby a new home');
      await ev(() => { const g = window.slimekin; for (const x of g.state.ranch.residents) x.bredDay = null; g.debug('pearls'); g.advance(1); });
      await breedInNursery('Juniper', 'Pebble');
      await ev(() => { const g = window.slimekin; g.leaveRanch(); g.sim.addJelly(54321); g.advance(1); });
      const before = await ev(() => { const g = window.slimekin, s = g.state, R = s.ranch; return { name: s.slime.name, stage: g.sim.stage().name, jelly: s.totalJelly, pearls: R.pearls, bonus: R.family.bonus, gen: R.family.generation,
        life: R.family.lifetime, residents: R.residents.length, placed: R.placed.length, eggs: g.sim.ranch.eggs().length, buyer: g.sim.rehomeBuyer().name, jps: g.sim.jps() }; });
      note('before:', JSON.stringify(before));
      await page.click('#tab-slime');
      await ev(() => { const g = window.slimekin; g.advance(1.2); document.getElementById('slimeRehome').scrollIntoView({ block: 'center' }); });
      const card = await ev(() => document.querySelector('.rehome-card').innerText.replace(/\s+/g, ' '));
      expect(new RegExp(`Find ${before.name} a new home`).test(card), `the Slime tab of a ${before.stage} shows "Find ${before.name} a new home"`, card);
      await shot('13-slime-tab-rehome');
      await page.click('#slimeRehome');
      await page.waitForSelector('#rhYes');
      const ask = await ev(() => document.getElementById('modalCard').innerText.replace(/\s+/g, ' '));
      expect(ask.includes(`${before.buyer} would love to raise ${before.name}`) && /No pearls for a baby/.test(ask) && /Still warming: ready in \d+ min/.test(ask),
        'one confirm step: the family that suits the baby, no pearls, and the same egg choice (warming eggs allowed)', ask.slice(0, 400));
      await page.click('.choice.warming');
      await shot('14-rehome-confirm');
      // the goodbye: a wave, then hops off to the side toward the new family
      await keepClock();
      const nav = page.waitForNavigation({ waitUntil: 'commit', timeout: 90000 });
      await ev(() => { document.getElementById('panel').style.transition = 'none'; });   // (the menu closes at once, for the first frame)
      await page.click('#rhYes');
      const bye = await ev(() => { const s = document.querySelector('#bubbleLayer .say'); return { say: s ? s.textContent : '', sheet: window.slimekin.hud.sheetState() }; });
      expect(/Bye-bye! I'll write to you/.test(bye.say) && bye.sheet === 'closed', 'the goodbye: the menu closes and the baby says "Bye-bye! I\'ll write to you!"', JSON.stringify(bye));
      // two frames of the goodbye at exact moments: the game loop is held still for each screenshot (software WebGL
      // draws slowly, and every real frame would move the goodbye along)
      const frameAt = (t, say) => ev(({ t, say }) => {
        const g = window.slimekin;
        if (say) g.hud.say(say, 60000);
        g.advance(Math.max(0, t - g.departing.t)); g.stage.render(); g.last = Infinity;
        return { t: +g.departing.t.toFixed(2), x: +g.slime.root.position.x.toFixed(2) };
      }, { t, say });
      const still = async name => { await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, name + '-day.png'), timeout: 120000 }); note('screenshot', name); };
      const f1 = await frameAt(1.0, bye.say);
      await still('15-rehome-goodbye-wave');
      const f2 = await frameAt(3.3);
      await still('15-rehome-goodbye-hop');
      expect(f2.x > f1.x + 1, 'it hops off to the side, toward its new family', `x ${f1.x} at ${f1.t} s -> ${f2.x} at ${f2.t} s`);
      await ev(() => { const g = window.slimekin; document.getElementById('panel').style.transition = ''; g.last = performance.now(); g.hud.say('', 1); g.advance(3); });
      await nav;
      await boot();
      await ev(s => { window.slimekin.timeSkip = s; }, skip);
      await ev(() => window.slimekin.advance(2));
      const moved = await ev(() => document.getElementById('modalCard').innerText.replace(/\s+/g, ' '));
      expect(moved.includes(`${before.name} has a new home!`) && moved.includes(before.buyer) && /still warming/i.test(moved), 'the next card: the baby has a new home, and the chosen egg is on the cushion, still warming', moved.slice(0, 300));
      await shot('16-baby-new-home-card');
      await ev(() => { window.slimekin.hud.closeModal(); window.slimekin.advance(1); });
      const after = await ev(() => { const g = window.slimekin, s = g.state, R = s.ranch; const p = R.placed[R.placed.length - 1]; return { phase: s.phase, bred: !!s.egg.bred, pearls: R.pearls, bonus: R.family.bonus, gen: R.family.generation,
        life: R.family.lifetime, residents: R.residents.length, placed: R.placed.length, last: p, eggs: g.sim.ranch.eggs().length, jelly: s.jelly, helpers: Object.values(s.helpers).reduce((a, b) => a + b, 0) }; });
      note('after:', JSON.stringify(after));
      expect(after.pearls === before.pearls && after.bonus === before.bonus && after.gen === before.gen && after.residents === before.residents,
        'no pearls, no Family Bonus, the same generation, no ranch slot', `pearls ${before.pearls} -> ${after.pearls}, bonus ${before.bonus.toFixed(1)} -> ${after.bonus.toFixed(1)}, generation ${after.gen}`);
      // (the game keeps running until the goodbye ends, so the baby made a little more jelly after "before" was read)
      const added = after.life - before.life;
      expect(added >= before.jelly && added <= before.jelly + before.jps * 30, 'its jelly counts toward the family lifetime total',
        `lifetime +${Math.round(added)} (it had ${Math.round(before.jelly)} when the goodbye started, then about ${Math.round(before.jps)} a second until it left)`);
      expect(after.phase === 'egg' && after.bred && after.eggs === before.eggs - 1 && after.jelly === 0 && after.helpers === 0 && after.last.baby === true && after.last.name === before.name,
        'the Nursery egg is on the cushion, jelly and helpers start over, and the baby is listed with its family (baby: true)', JSON.stringify(after.last));
      // a postcard written by the baby, with no pearls in it (the postcard days are on the wall clock: try the next days)
      const pc = await ev(name => {
        const g = window.slimekin, rr = g.sim.ranch, real = Date.now, orig = rr.postcards;
        let got = null, cards = [];
        rr.postcards = function (...a) { cards = orig.apply(this, a); return cards; };
        for (let d = 1; d <= 7 && !got; d++) {
          Date.now = () => real() + d * 86400000;
          try {
            const p0 = g.state.ranch.pearls; cards = [];
            g.checkPostcards();
            if (cards.some(c => c.name === name)) got = { day: d, pearls: g.state.ranch.pearls - p0, cards: cards.map(c => ({ name: c.name, text: c.text, pearls: c.pearls, baby: !!c.baby })) };
          } finally { Date.now = real; }
        }
        delete rr.postcards;
        g.advance(0.3);
        return { ...got, toast: document.getElementById('toasts').innerText.replace(/\s+/g, ' ') };
      }, before.name);
      expect(pc.day && pc.pearls === 0 && pc.cards.every(c => c.baby && c.pearls === 0) && pc.toast.includes(`Postcard from ${before.name}`) && !/pearls tucked inside/.test(pc.toast),
        'a postcard from the baby, written by a baby, with no pearls in it', JSON.stringify(pc));
      await shot('17-baby-postcard', { night: false });
      await page.click('#tab-ranch');
      await ev(() => { const g = window.slimekin; g.advance(2); const b = document.getElementById('body-ranch'); b.scrollTop = b.scrollHeight; g.advance(0.5); });
      const elsewhere = await ev(() => document.getElementById('body-ranch').innerText.replace(/\s+/g, ' '));
      expect(elsewhere.includes(`${before.name}`) && /growing up there/.test(elsewhere), 'the ranch lists the baby under "Living elsewhere" (growing up there)', elsewhere.slice(-200));
      await shot('18-living-elsewhere');
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
