// The Barn ranch in a headless phone (393 x 852): the ranch screen is the baked barn, one resident on the stand.
//   node tools/barn-smoke.cjs [--quick] [--only=open,swipe,touch,card,life,pearls,nursery,leave,sheet,low,reduced,empty,fail,slow]
// From tools/fixtures/barn/barn-six.json (7 residents: Curlys, a Dollop, a Cat-ear Dollop, a Topknot Dollop in a lesson, an
// in-between, and Bubblegum on a trip). Real touches are CDP Input.dispatchTouchEvent (each with its own timestamp).
//   open     the Ranch tab opens the barn with no page errors; home is hidden; the stand shows the first resident; the
//            traveler is never in the order; draw calls and triangles by day and by night (sheet closed)
//   swipe    real touch swipes on the barn: left = next, right = previous, wrapping around; the ‹ › buttons; a swap asked
//            for during a swap queues one more
//   touch    a quick swipe across the slime swaps and does not pet; a tap on it pets (hearts); a slow stroke pets again
//   card     the card's words for each kind of resident (Curly, Dollop, Cat-ear, Topknot in a lesson, in-between; stars;
//            dots); tapping the card opens that resident's page
//   life     from that page: Train (the card says "in a lesson"), Send on a trip (it burrows out, the next one comes up);
//            a traveler coming home joins the order and its card says "just back from"; the menu's Visit brings a
//            resident up on the stand; "Everyone is happy to see you" makes the one on the stand hop
//   pearls   pearls made while you watch land on the straw beside the stand (from the stand and from a stall); a tap
//            picks one up; a tap on the basket collects; the Collect button still works
//   nursery  an egg in the Nursery: the nest shows at the front left; tapping it opens the Nursery (the camera stays)
//   leave    a new home for the one on the stand: the next one comes up
//   sheet    the menu sheet at its normal height and closed: the slime and the name card show above it
//   low      Low graphics: half the straw, the slime in one pass (fewer triangles)
//   reduced  Reduced motion: a fade, no straw
//   empty    nobody home (everyone on a trip; then nobody at all): an empty stand and a card that says so
//   fail     the barn's files can't load: the preload fails quietly; Ranch stays home (back on the page it came from),
//            one toast, no meadow ranch drawn, logged once per try; the next tap tries again and opens the barn
//   slow     the barn's files are slow: they load ahead of time (before Ranch is tapped); Ranch while they are still
//            coming: home stays with "Off to the barn", the meadow ranch is never drawn (every frame checked), another
//            tab calls it off, and the barn opens the moment they arrive (Greenhouse and Meadow homes)
// Screenshots: tools/out/barn/. Runs offline on its own server (tools/browser-kit.cjs).
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const OUT = path.join(__dirname, 'out', 'barn');
fs.mkdirSync(OUT, { recursive: true });
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : (process.argv.includes('--' + k) ? true : d); };
const QUICK = !!arg('quick', false);
const ONLY = String(arg('only', 'open,swipe,touch,card,life,pearls,nursery,leave,sheet,low,reduced,empty,fail,slow')).split(',');
const FIX = { six: JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'barn', 'barn-six.json'), 'utf8')).save };

(async () => {
  const errors = [];
  const expect = (cond, what, detail = '') => { if (cond) log('ok', what, detail ? `| ${detail}` : ''); else { errors.push(what + (detail ? ': ' + detail : '')); log('FAIL', what, detail); } };
  let kit = null;
  watchdog(45, () => kit ? kit.current() : 'setup');
  try {
    kit = await setup({ contextOptions: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } });
    const { page, step, ev } = kit;
    page.setDefaultTimeout(30000);   // (clicks; the waits name their own)
    const consoleLines = [];
    page.on('console', m => consoleLines.push(`${m.type()}: ${m.text()}`));
    // the save for each page load (?fx=..&n=..: seeded once per n); the trip and the lesson move to this clock
    await kit.context.addInitScript(fx => {
      const q = new URLSearchParams(location.search), key = 'seeded-' + (q.get('n') || '0');
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      const s = JSON.parse(JSON.stringify(fx[q.get('fx') || 'six'])), now = Date.now();
      for (const x of s.ranch.residents) {
        if (x.trip) { x.trip.startAt = now - 600000; x.trip.homeAt = now + 3000000; }
        if (x.lesson) { x.lesson.startAt = now - 600000; x.lesson.doneAt = now + 7200000 + 30000; }
      }
      s.savedAt = now - 60000;
      s.ranch.lastVisit = now;   // (no "everyone is happy" visit unless a part asks for it)
      localStorage.setItem('slimekin.save.v1', JSON.stringify(s));
    }, FIX);
    const cdp = await kit.context.newCDPSession(page);
    let bootN = 0;
    const boot = async (fx = 'six') => {
      await page.goto(`${kit.server.origin}/?fx=${fx}&n=${++bootN}#debug`);
      await page.waitForFunction(() => window.slimekin && window.slimekin.state && window.slimekin.barnRanch && document.getElementById('boot').hidden, null, { timeout: 120000 });
      await ev(() => {
        const g = window.slimekin;
        g.behave.hour = () => 14; g.state.settings.quality = 'high'; g.applySettings(); g.hud.closeModal();
        g._pets = [];
        const pet = g.petResident.bind(g);
        g.petResident = (id, stroke) => { g._pets.push({ id, stroke: !!stroke }); return pet(id, stroke); };
      });
    };
    // open the ranch with the Ranch tab (a real tap) and wait for the barn
    const openRanch = async () => {
      await page.click('#tab-ranch');
      await page.waitForFunction(() => { const b = window.slimekin.barnRanch; return (b.on && b.view.ready) || b.view.failed; }, null, { timeout: 120000 });
      await settle();
    };
    const settle = async (n = 2) => { for (let i = 0; i < n; i++) { await page.waitForTimeout(150); await page.screenshot({ clip: { x: 0, y: 0, width: 8, height: 8 }, timeout: 120000 }); } };
    const info = () => ev(() => window.slimekin.barnRanch.info());
    const waitSwap = () => page.waitForFunction(() => !window.slimekin.barnRanch.view.swapping && !window.slimekin.barnRanch.queued, null, { timeout: 120000 });
    const cur = () => ev(() => window.slimekin.barnRanch.curId);
    const nameOf = id => ev(i => window.slimekin.sim.ranch.resident(i)?.name, id);
    // night mode the way the game sets it; the barn follows on its own (its 3 s blend: 3.2 s of game time)
    const setTheme = async dark => {
      await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark);
      await page.waitForTimeout(150);
      await ev(() => window.slimekin.advance(3.2));
    };
    const shot = (name, { night = !QUICK } = {}) => step('screenshot ' + name, async () => {
      for (const dark of night ? [false, true] : [false]) {
        await setTheme(dark);
        for (let i = 0; i < 2; i++) {
          await ev(() => { const s = window.slimekin.barnRanch.view.av; s.blinkT = 99; s.blinkPhase = -1; s.blink = 0; });
          await page.waitForTimeout(200);
          await page.screenshot({ path: path.join(OUT, `${name}-${dark ? 'night' : 'day'}.png`), timeout: 120000 });
        }
      }
      await setTheme(false);
      log('screenshot', name);
    }, 400000);
    const touch = (type, pts, ts) => cdp.send('Input.dispatchTouchEvent', { type, timestamp: ts, touchPoints: type === 'touchEnd' ? [] : pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
    const drag = async (pts, gap = 0.03) => {
      const t0 = Date.now() / 1000;
      await touch('touchStart', [pts[0]], t0);
      for (let i = 1; i < pts.length; i++) await touch('touchMove', [pts[i]], t0 + gap * i);
      await touch('touchEnd', [], t0 + gap * pts.length);
    };
    const line = (x0, y0, x1, y1, n = 8) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
    const tap = async (x, y) => { const t0 = Date.now() / 1000; await touch('touchStart', [[x, y]], t0); await touch('touchEnd', [], t0 + 0.06); };
    // where a world point of the barn is on the screen
    const screenOf = p => ev(([x, y, z]) => { const g = window.slimekin, v = new g.v1.constructor(x, y, z); g.stage.camera.updateMatrixWorld(); const s = g.screenOf(v); return [s.x, s.y]; }, p);
    const slimeAt = () => ev(() => { const g = window.slimekin, v = g.barnRanch.view.av.centerWorld(new g.v1.constructor()); const s = g.screenOf(v); return [s.x, s.y]; });
    const frameCounts = () => ev(() => {
      const g = window.slimekin, r = g.stage.renderer;
      g.noRender = true; r.info.autoReset = false; r.info.reset(); g.stage.render();
      const out = { calls: r.info.render.calls, tris: r.info.render.triangles };
      r.info.autoReset = true; g.noRender = false;
      return out;
    });
    const part = (name, fn) => step(name, fn, 900000);   // one part of the test (each check inside has its own wait)
    const sheetClosed = async () => { await ev(() => window.slimekin.hud.setSheet('closed', false)); await page.waitForTimeout(500); await settle(); };
    // Every frame drawn from now on: is any of it the meadow ranch as the ranch screen? (the ranch view without the
    // barn on, the meadow ranch drawn in the Greenhouse, the camera flying over to the hill, the barn shown before it is
    // on); and how many frames showed "Off to the barn".
    const watchRanch = () => ev(() => {
      const g = window.slimekin, w = window.__rw = { frames: 0, ranchScreen: 0, waitFrames: 0, pill: 0, why: [] };
      if (!g.stage.__render) g.stage.__render = g.stage.render.bind(g.stage);
      g.stage.render = () => {
        const W = window.__rw;
        W.frames++;
        const why = g.view === 'ranch' && !g.barnRanch.on ? 'ranch view without the barn'
          : g.ranch.group.visible && g.home.world !== 'meadow' ? 'the meadow ranch drawn (' + g.home.world + ')'
          : g.stage.camPos.z < 3 ? 'the camera over at the hill' : g.barnRanch.view.group.visible && !g.barnRanch.on ? 'the barn drawn before it is on' : '';
        if (why) { W.ranchScreen++; if (W.why.length < 3) W.why.push(why); }
        if (g.barnRanch.waiting) W.waitFrames++;
        if (!document.getElementById('barnWait').hidden) W.pill++;
        return g.stage.__render();
      };
    });
    const watched = () => ev(() => window.__rw);
    const toastsWith = re => ev(r => [...document.querySelectorAll('#toasts .toast')].filter(t => new RegExp(r).test(t.innerText)).length, re);

    // ---------- open ----------
    if (ONLY.includes('open')) await part('open', async () => {
      await boot();
      const t0 = Date.now();
      await openRanch();
      const i = await info();
      const home = await ev(() => { const g = window.slimekin; return { room: g.home.room.group.visible, pet: g.slime.root.visible, meadow: g.ranch.group.visible, helpers: g.helpers3d.group.visible, barn: g.barnRanch.view.group.visible, motes: g.stage.motes.some(m => m.m.visible), counts: g.barnRanch.view.counts() }; });
      log('barn:', JSON.stringify(home.counts), `Ranch tab to barn ready ${Date.now() - t0} ms (headless, loopback; first visit; ${i.preloaded ? 'loaded ahead of time' : 'not asked ahead yet'})`);
      expect(i.on && i.ready && home.barn, 'the Ranch tab opens the barn');
      expect(!home.room && !home.pet && !home.meadow && !home.helpers && !home.motes, 'home is not drawn in the barn (the room, the pet, the meadow ranch, the helpers, the motes)', JSON.stringify(home));
      const order = await ev(() => window.slimekin.state.ranch.residents.filter(x => !x.trip).map(x => x.id));
      const travelers = await ev(() => window.slimekin.state.ranch.residents.filter(x => x.trip).map(x => x.name));
      expect(JSON.stringify(i.order) === JSON.stringify(order) && travelers.length === 1, `the stand's order is the ranch's, without the traveler (${travelers.join(', ')})`, `${i.order.length} on the list`);
      expect(i.cur === order[0], `the first resident is on the stand (${await nameOf(i.cur)})`);
      const pageErrors = kit.errors.length;
      expect(pageErrors === 0, 'no page errors', kit.errors.slice(0, 3).join(' | '));
      await shot('open-sheet');
      await sheetClosed();
      const day = await frameCounts();
      await setTheme(true);
      const blend = await ev(() => window.slimekin.barnRanch.view.night);
      const night = await frameCounts();
      await setTheme(false);
      const blendBack = await ev(() => window.slimekin.barnRanch.view.night);
      expect(blend === 1 && blendBack === 0, 'night mode on and off: the barn blends to night and back by itself', `${blend} -> ${blendBack}`);
      log('frame (High, sheet closed):', JSON.stringify({ day, night }));
      expect(day.calls <= 44 && night.calls <= 55, `draw calls within 10% of the test page's (about 40 by day, 50 at night): ${day.calls} by day, ${night.calls} at night`);
      await shot('open-closed');
    });

    // ---------- swipe ----------
    if (ONLY.includes('swipe')) await part('swipe', async () => {
      if (!ONLY.includes('open')) { await boot(); await openRanch(); }
      await sheetClosed();
      const order = (await info()).order;
      const start = await cur();
      const idx = id => order.indexOf(id);
      await drag(line(330, 300, 90, 300, 6));
      await waitSwap();
      const a = await cur();
      expect(idx(a) === (idx(start) + 1) % order.length, 'a swipe left on the barn: the next resident', `${await nameOf(start)} -> ${await nameOf(a)}`);
      await drag(line(90, 300, 330, 300, 6));
      await waitSwap();
      const b = await cur();
      expect(b === start, 'a swipe right: the previous one', `-> ${await nameOf(b)}`);
      await drag(line(90, 300, 330, 300, 6));
      await waitSwap();
      const c = await cur();
      expect(c === order[order.length - 1], 'a swipe right from the first one wraps around to the last', `-> ${await nameOf(c)}`);
      await drag(line(330, 300, 90, 300, 6));
      await waitSwap();
      expect(await cur() === order[0], 'and left from the last wraps to the first');
      const slow = await (async () => { const t0 = Date.now() / 1000; const pts = line(330, 300, 90, 300, 6); await touch('touchStart', [pts[0]], t0); for (let i = 1; i < pts.length; i++) await touch('touchMove', [pts[i]], t0 + 0.2 * i); await touch('touchEnd', [], t0 + 1.4); await settle(1); return ev(() => window.slimekin.barnRanch.view.swapping); })();
      expect(!slow && await cur() === order[0], 'a slow drag (1.4 s) is not a swipe');
      const short = await (async () => { await drag(line(200, 300, 150, 300, 4)); await settle(1); return ev(() => window.slimekin.barnRanch.view.swapping); })();
      expect(!short && await cur() === order[0], 'a short one (50 px) is not a swipe');
      await page.click('#barnNext');
      await waitSwap();
      expect(await cur() === order[1], 'the › button: the next one');
      await page.click('#barnPrev');
      await waitSwap();
      expect(await cur() === order[0], 'the ‹ button: the previous one');
      const btn = await ev(() => [...document.querySelectorAll('.barn-arrow')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), b.querySelector('svg') ? 1 : 0, b.textContent.trim().length]; }));
      expect(btn.every(([w, h, svg, txt]) => w >= 44 && h >= 44 && svg && !txt), 'the ‹ › buttons are 44 px drawn icons (no text)', JSON.stringify(btn));
      // two taps quickly: the second queues one more swap
      await ev(() => { const b = window.slimekin.barnRanch; b.request(1); b.request(1); });
      const q = await ev(() => window.slimekin.barnRanch.queued !== null);
      await waitSwap();
      expect(q && await cur() === order[2], 'a swap asked for during a swap queues one more (two steps)', await nameOf(await cur()));
      // the swap frames (for the sheet): the swap's own clock held and stepped by hand
      await ev(() => window.slimekin.advance(3));   // (the last swap's straw and sparkles settle first)
      await ev(() => { const b = window.slimekin.barnRanch; b.view.hold = true; b.request(1); });
      let prev = 0;
      for (const u of [0.08, 0.24, 0.32, 0.47, 0.6, 0.8]) {
        await ev(d => window.slimekin.barnRanch.view.step(d), u - prev);
        prev = u;
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(OUT, `swap-${String(u).replace('0.', '0').padEnd(3, '0')}-day.png`), timeout: 120000 });
      }
      await ev(() => { window.slimekin.barnRanch.view.hold = false; });
      await waitSwap();
      // a swap runs at the full frame rate: the game counts it as not calm (it drops to 30 fps when calm)
      const calm = await ev(() => { const g = window.slimekin; g.advance(2); g.lastInteract = -1e9; g.lastPointerMove = -1e9; const before = g.calm(); g.barnRanch.request(1); g.advance(0.2); const during = g.calm(); return { before, during }; });
      await waitSwap();
      expect(calm.before && !calm.during, 'a swap runs at the full frame rate (the game is not "calm" during it)', JSON.stringify(calm));
      log('screenshot', 'swap frames');
    });

    // ---------- touch on the slime ----------
    if (ONLY.includes('touch')) await part('touch', async () => {
      if (!ONLY.includes('open') && !ONLY.includes('swipe')) { await boot(); await openRanch(); }
      await sheetClosed();
      await ev(() => { const g = window.slimekin; g._pets.length = 0; for (const x of g.state.ranch.residents) x.petAt = 0; });
      const before = await cur();
      let [sx, sy] = await slimeAt();
      await drag(line(sx + 75, sy, sx - 75, sy, 6));
      await waitSwap();
      const pets = await ev(() => window.slimekin._pets.length);
      expect(await cur() !== before && pets === 0, 'a quick swipe across the slime swaps and does not pet', `pets ${pets}`);
      [sx, sy] = await slimeAt();
      const fx0 = await ev(() => window.slimekin.fx.live.length);
      await tap(sx, sy);
      await settle(1);
      const t = await ev(() => ({ pets: window.slimekin._pets.slice(), fx: window.slimekin.fx.live.length }));
      expect(t.pets.length === 1 && !t.pets[0].stroke && t.fx > fx0 && !(await info()).swapping, 'a tap on the slime pets it (hearts), no swap', JSON.stringify(t.pets));
      // a slow stroke back and forth over it (1.6 s)
      const pts = [];
      for (let i = 0; i <= 16; i++) pts.push([sx + 30 * Math.sin(i / 16 * Math.PI * 3), sy + 4 * Math.sin(i)]);
      const t0 = Date.now() / 1000;
      await touch('touchStart', [pts[0]], t0);
      for (let i = 1; i < pts.length; i++) { await touch('touchMove', [pts[i]], t0 + 0.1 * i); await page.waitForTimeout(110); }
      await touch('touchEnd', [], t0 + 1.75);
      await settle(1);
      const s = await ev(() => window.slimekin._pets.slice(1));
      expect(s.length >= 2 && !(await info()).swapping, `a slow stroke on it keeps petting (${s.length} pets), no swap`, JSON.stringify(s.map(p => p.stroke)));
    });

    // ---------- the card ----------
    if (ONLY.includes('card')) await part('card', async () => {
      await boot(); await openRanch(); await sheetClosed();
      const want = { Juniper: /^Curly · [\d.]+ pearls an hour$/, Mochi: /^Curly · Bounce ★★★$/, Peaches: /^Dollop · Charm ★★$/, Biscuit: /^Cat-ear Dollop · Smarts ★$/, Plum: /^Topknot Dollop · in a lesson: Bounce, (?:2h|1h [45]\dm) left$/, Swirl: /^Curly × Dollop · [\d.]+ pearls an hour$/ };
      const order = (await info()).order;
      for (let i = 0; i < order.length; i++) {
        const c = await ev(() => { const el = document.getElementById('barnCard'); return { name: el.querySelector('b').textContent, line: el.querySelector('.bc-line').textContent, dots: el.querySelectorAll('.bc-dots u').length, on: [...el.querySelectorAll('.bc-dots u')].findIndex(u => u.classList.contains('on')) }; });
        const re = want[c.name];
        expect(re && re.test(c.line) && c.dots === order.length && c.on === i, `card: ${c.name} · ${c.line} (dot ${c.on + 1} of ${c.dots})`);
        await shot(`card-${c.name.toLowerCase()}`, { night: false });
        await ev(() => window.slimekin.barnRanch.request(1));
        await waitSwap();
      }
      // tapping the card opens that resident's page
      const id = await cur();
      const r = await ev(() => { const b = document.getElementById('barnCard').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
      await tap(r[0], r[1]);
      await page.waitForTimeout(600);
      const pg = await ev(() => ({ focus: window.slimekin.ranchFocus, sheet: window.slimekin.hud.sheetState(), text: document.getElementById('body-ranch').innerText.slice(0, 200) }));
      expect(pg.focus === id && pg.sheet === 'normal' && pg.text.includes(await nameOf(id)), `tapping the card opens ${await nameOf(id)}'s page`, JSON.stringify(pg).slice(0, 160));
      await shot('card-page');
    });

    // ---------- Ranch life from the barn ----------
    if (ONLY.includes('life')) await part('life', async () => {
      await boot(); await openRanch(); await sheetClosed();
      // Mochi's page from the card, then Train
      await ev(() => window.slimekin.barnRanch.show('rbarnmochi'));
      await waitSwap();
      expect(await cur() === 'rbarnmochi', 'the menu brings Mochi up on the stand');
      await ev(() => window.slimekin.barnRanch.openPage());
      await page.waitForTimeout(500);
      await page.click('#body-ranch [data-rl="train"]');
      await page.waitForSelector('#modalCard [data-skill]:not([disabled])');
      await page.click('#modalCard [data-skill="speed"]');
      await page.waitForFunction(() => /in a lesson/.test(document.querySelector('#barnCard .bc-line').textContent), null, { timeout: 30000 }).catch(() => {});
      const line = await ev(() => document.querySelector('#barnCard .bc-line').textContent);
      expect(/in a lesson: Speed/.test(line), 'Train from the page: the card says it is in a lesson', line);
      // Send Juniper on a trip from its page: it burrows out and the next one comes up
      await ev(() => window.slimekin.focusResident('rmvgvzpxcf'));
      await waitSwap();
      const before = (await info()).order;
      await page.click('#body-ranch [data-rl="trip"]');
      await page.waitForSelector('#modalCard [data-place]:not([disabled])');
      await page.click('#modalCard [data-place="cafe"]');
      await page.waitForFunction(() => window.slimekin.barnRanch.view.swapping, null, { timeout: 60000 }).catch(() => {});
      await waitSwap();
      const after = await info();
      const k = before.indexOf('rmvgvzpxcf');
      expect(!after.order.includes('rmvgvzpxcf') && after.cur === before[(k + 1) % before.length] && after.order.length === before.length - 1, `Send on a trip: Juniper burrows out and ${await nameOf(after.cur)} comes up; the dots go ${before.length} -> ${after.order.length}`);
      await shot('life-trip', { night: false });
      // a traveler comes home (#debug: bring travelers home): Bubblegum joins the order; its card says "just back"
      await ev(() => { const g = window.slimekin; g.life.debugFinish('trips'); });
      await page.waitForFunction(() => window.slimekin.barnRanch.order.includes('rbarnbub'), null, { timeout: 60000 });
      await ev(() => window.slimekin.hud.closeModal());
      await ev(() => window.slimekin.hud.openTab('ranch'));
      await ev(() => window.slimekin.focusResident(null));
      await page.waitForTimeout(400);
      await page.click('#body-ranch [data-act="visit"][data-id="rbarnbub"]');
      await waitSwap();
      const bl = await ev(() => document.querySelector('#barnCard .bc-line').textContent);
      expect(await cur() === 'rbarnbub' && /just back from Puddle Café/.test(bl), 'a traveler home joins the order; Visit in the menu brings it up; its card says "just back from"', bl);
      // "Everyone is happy to see you!": the one on the stand hops
      await ev(() => { const g = window.slimekin; g.leaveRanch(); g.state.ranch.lastVisit = 0; });
      await page.waitForTimeout(300);
      await openRanch();
      await page.waitForFunction(() => window.slimekin.barnRanch.view.res.happyT > 0, null, { timeout: 60000 }).catch(() => {});
      const hop = await ev(() => ({ happy: window.slimekin.barnRanch.view.res.happyT > 0, toast: document.getElementById('toasts').innerText }));
      expect(hop.happy && /happy to see you/.test(hop.toast), '"Everyone is happy to see you!": the one on the stand hops', JSON.stringify(hop).slice(0, 120));
    });

    // ---------- pearls and the basket ----------
    if (ONLY.includes('pearls')) await part('pearls', async () => {
      await boot(); await openRanch(); await sheetClosed();
      await ev(() => { const g = window.slimekin, st = g.barnRanch.curId; for (const x of g.state.ranch.residents) if (!x.trip && (x.id === st || x.id === 'rbarnpeach')) x.pearlT = 0.99999; g.state.ranch.basket.stored = 2; });
      await page.waitForFunction(() => window.slimekin.barnRanch.view.pearls.length >= 2, null, { timeout: 60000 });
      await ev(() => window.slimekin.advance(1.5));
      const ps = await ev(() => window.slimekin.barnRanch.view.pearls.map(p => ({ landed: p.landed, x: p.mesh.position.x, y: p.mesh.position.y, z: p.mesh.position.z })));
      const room = await ev(() => window.slimekin.barnRanch.view.meta.room);
      const onScreen = await ev(ps => ps.map(p => { const g = window.slimekin, s = g.screenOf(new g.v1.constructor(p.x, p.y, p.z)), c = document.getElementById('barnCard').getBoundingClientRect(); return s.x > 20 && s.x < innerWidth - 20 && s.y < c.top - 8; }), ps);
      expect(ps.length >= 2 && ps.every((p, i) => p.landed && onScreen[i] && Math.hypot(p.x, p.z) < room.stand_r && p.z > 0), 'pearls made while you watch land in the stand\'s straw in front of the slime, on screen, above the card (one from the stand, one from a stall)', JSON.stringify(ps.map(p => [p.x.toFixed(2), p.z.toFixed(2)])));
      await shot('pearls', { night: false });
      const p0 = await ev(() => window.slimekin.state.ranch.pearls);
      const [px, py] = await screenOf([ps[0].x, ps[0].y, ps[0].z]);
      await tap(px, py);
      await settle(1);
      const p1 = await ev(() => ({ pearls: window.slimekin.state.ranch.pearls, left: window.slimekin.barnRanch.view.pearls.length }));
      expect(p1.pearls === p0 + 1 && p1.left === ps.length - 1, 'a tap on a pearl picks it up (+1 pearl)', JSON.stringify(p1));
      const stored = await ev(() => window.slimekin.state.ranch.basket.stored);
      const [bx, by] = await screenOf(await ev(() => { const b = window.slimekin.barnRanch.view.basketAt; return [b.x, b.y + 0.1, b.z]; }));
      await tap(bx, by);
      await settle(1);
      const p2 = await ev(() => ({ pearls: window.slimekin.state.ranch.pearls, stored: window.slimekin.state.ranch.basket.stored, fill: window.slimekin.barnRanch.view.basketPearls.count }));
      expect(stored > 0 && p2.stored === 0 && p2.pearls === p1.pearls + stored && p2.fill === 0, `a tap on the baked basket collects it (+${stored}); its live pearls show it empty`, JSON.stringify(p2));
      await ev(() => { window.slimekin.state.ranch.basket.stored = 5; });
      await page.waitForFunction(() => !document.getElementById('basketBtn').hidden && window.slimekin.barnRanch.view.basketPearls.count > 0, null, { timeout: 60000 });
      const fill = await ev(() => window.slimekin.barnRanch.view.basketPearls.count);
      await page.click('#basketBtn');
      await settle(1);
      const p3 = await ev(() => window.slimekin.state.ranch.basket.stored);
      expect(fill > 0 && p3 === 0, `the basket fills (${fill} live pearls for 5) and the Collect button still collects`);
    });

    // ---------- the Nursery's nest ----------
    if (ONLY.includes('nursery')) await part('nursery', async () => {
      await boot(); await openRanch(); await sheetClosed();
      const vis0 = await ev(() => window.slimekin.barnRanch.view.nest.visible);
      await ev(() => window.slimekin.buySpecialEgg('ears'));
      await page.waitForTimeout(400);
      await ev(() => window.slimekin.hud.setSheet('closed', false));
      await page.waitForTimeout(500);
      const n = await ev(() => { const v = window.slimekin.barnRanch.view; return { vis: v.nest.visible, eggs: v.nestEggs.size, x: v.nest.position.x, z: v.nest.position.z }; });
      expect(!vis0 && n.vis && n.eggs === 1 && n.x < 0, 'no nest without eggs; an egg in the Nursery sits in the nest at the front left of the stand', JSON.stringify(n));
      await shot('nursery-nest');
      const cam0 = await ev(() => window.slimekin.stage.camera.position.toArray());
      const [nx, ny] = await screenOf([n.x, 0.25, n.z]);
      await tap(nx, ny);
      await page.waitForTimeout(600);
      const r = await ev(() => ({ page: window.slimekin.ranchPage, cam: window.slimekin.stage.camera.position.toArray(), text: document.getElementById('body-ranch').innerText.slice(0, 60) }));
      expect(r.page === 'nursery' && r.cam.every((v, i) => Math.abs(v - cam0[i]) < 1e-6), 'tapping the nest opens the Nursery; the camera does not move', JSON.stringify(r).slice(0, 140));
    });

    // ---------- a new home for the one on the stand ----------
    if (ONLY.includes('leave')) await part('leave', async () => {
      await boot(); await openRanch(); await sheetClosed();
      await ev(() => window.slimekin.barnRanch.show('rbarnswirl'));
      await waitSwap();
      const before = (await info()).order;
      await ev(() => window.slimekin.askPlace('rbarnswirl'));
      await page.waitForSelector('#modalCard .offer');
      await page.click('#modalCard .offer');
      await page.waitForSelector('#modalCard #cpYes');
      await page.click('#modalCard #cpYes');
      await page.waitForFunction(() => window.slimekin.barnRanch.view.swapping, null, { timeout: 60000 }).catch(() => {});
      await waitSwap();
      const a = await info();
      const k = before.indexOf('rbarnswirl');
      expect(!a.order.includes('rbarnswirl') && a.cur === before[(k + 1) % before.length], `a new home for Swirl (on the stand): it burrows out and ${await nameOf(a.cur)} comes up`);
      // one leaving off the stand only changes the dots
      const on = a.cur;
      await ev(() => { const g = window.slimekin; const x = g.sim.ranch.resident('rbarnbisc'); const o = g.sim.ranch.offers(x)[0]; g.sim.ranch.place(x.id, o.buyer); g.farewell(x, 'test', o.pearls, ''); });
      await settle(2);
      const b = await info();
      const dots = await ev(() => document.querySelectorAll('#barnCard .bc-dots u').length);
      expect(b.cur === on && !b.swapping && dots === a.order.length - 1, `one leaving off the stand (Biscuit) only changes the dots (${a.order.length} -> ${dots})`);
    });

    // ---------- the menu sheet ----------
    if (ONLY.includes('sheet')) await part('sheet', async () => {
      await boot(); await openRanch();
      const check = async label => {
        await settle(3);
        await ev(() => window.slimekin.advance(1));
        await settle(2);
        const m = await ev(() => {
          const g = window.slimekin, av = g.barnRanch.view.av, V = g.v1.constructor;
          const top = g.screenOf(av.headTopWorld(new V())), stand = g.screenOf(new V(0, 0.05, 1.17)), mid = g.screenOf(av.centerWorld(new V()));
          const card = document.getElementById('barnCard').getBoundingClientRect(), panel = document.getElementById('panel').getBoundingClientRect(), bar = document.querySelector('.top').getBoundingClientRect();
          return { head: top.y, stand: stand.y, mid: mid.y, cardTop: card.top, cardBottom: card.bottom, panelTop: panel.top, topBar: bar.bottom, sheet: g.hud.sheetState() };
        });
        expect(m.head > m.topBar - 10 && m.stand < m.cardTop && m.cardBottom <= m.panelTop + 1, `${label}: the slime (head ${Math.round(m.head)}, stand front ${Math.round(m.stand)}) and its card (${Math.round(m.cardTop)}..${Math.round(m.cardBottom)}) show above the menu (${Math.round(m.panelTop)}), under the top bar (${Math.round(m.topBar)})`);
        return m;
      };
      await check('sheet at its normal height');
      await shot('sheet-normal');
      await sheetClosed();
      await check('sheet closed');
      const off = await ev(() => ({ fov: window.slimekin.stage.camera.fov, scale: window.slimekin.barnRanch.scale }));
      expect(Math.abs(off.fov - 38) < 0.01, `sheet closed: the barn's own lens (fov ${off.fov.toFixed(2)})`);
    });

    // ---------- Low graphics ----------
    if (ONLY.includes('low')) await part('low', async () => {
      if (!(await ev(() => window.slimekin?.barnRanch?.on).catch(() => false))) { await boot(); await openRanch(); }
      await sheetClosed();
      const high = await frameCounts();
      await ev(() => { const g = window.slimekin; g.state.settings.quality = 'low'; g.applySettings(); });
      await settle(2);
      const low = await frameCounts();
      const v = await ev(() => { const b = window.slimekin.barnRanch.view; return { straw: b.straw.count, transmission: b.av.mat.transmission }; });
      log('frame High vs Low:', JSON.stringify({ high, low }));
      expect(v.straw === 380 && v.transmission === 0 && low.tris < high.tris * 0.7, `Low: ${v.straw} straw strips, the slime in one pass (${low.tris} vs ${high.tris} triangles)`);
      await ev(() => window.slimekin.barnRanch.request(1));
      await ev(() => window.slimekin.advance(0.32));
      const live = await ev(() => window.slimekin.barnRanch.view.liveStraw());
      expect(live > 0 && live <= 380, `Low: the poof uses at most the Low straw (${live} strips)`);
      await waitSwap();
      await shot('low', { night: false });
      await ev(() => { const g = window.slimekin; g.state.settings.quality = 'high'; g.applySettings(); });
    });

    // ---------- Reduced motion ----------
    if (ONLY.includes('reduced')) await part('reduced', async () => {
      if (!(await ev(() => window.slimekin?.barnRanch?.on).catch(() => false))) { await boot(); await openRanch(); }
      await waitSwap();
      await ev(() => window.slimekin.advance(3));   // (the straw of an earlier swap settles first)
      const id0 = await cur();
      await ev(() => { const g = window.slimekin; g.state.settings.reducedMotion = true; g.applySettings(); g.barnRanch.request(1); });
      await ev(() => window.slimekin.advance(0.12));
      const mid = await ev(() => { const v = window.slimekin.barnRanch.view; let o = 1; v.av.root.traverse(x => { if (x.material && x.material.opacity !== undefined && x === v.av.mesh) o = x.material.opacity; }); return { kind: v.sw.kind, straw: v.liveStraw(), opacity: o, y: v.av.root.position.y }; });
      await waitSwap();
      const after = await ev(() => ({ id: window.slimekin.barnRanch.curId, opacity: window.slimekin.barnRanch.view.av.mat.opacity, transparent: window.slimekin.barnRanch.view.av.mat.transparent }));
      expect(mid.kind === 'fade' && mid.straw === 0 && mid.opacity < 0.9 && Math.abs(mid.y - 0.27) < 1e-6 && after.id !== id0 && after.opacity === 1 && after.transparent === false, 'Reduced motion: a fade in place (no burrow, no straw), the next one comes up, the slime is solid again after', JSON.stringify({ mid, after }));
      await ev(() => { const g = window.slimekin; g.state.settings.reducedMotion = false; g.applySettings(); });
    });

    // ---------- an empty ranch ----------
    if (ONLY.includes('empty')) await part('empty', async () => {
      await boot(); await openRanch(); await sheetClosed();
      await ev(() => { const g = window.slimekin, now = g.nowMs(); for (const x of g.state.ranch.residents) if (!x.trip) { x.lesson = null; x.trip = { place: 'park', startAt: now, homeAt: now + 3600000 * 3, seed: 'x', pearls: 1, souvenir: null }; } });
      await waitSwap();
      await ev(() => window.slimekin.advance(1.5));
      const a = await ev(() => ({ empty: window.slimekin.barnRanch.view.empty, vis: window.slimekin.barnRanch.view.av.root.visible, card: document.getElementById('barnCard').innerText, arrows: [...document.querySelectorAll('.barn-arrow')].every(b => b.hidden) }));
      expect(a.empty && !a.vis && /Everyone is on a trip/.test(a.card) && a.arrows, 'everyone on a trip: the stand is empty and the card says when the first one is home (no ‹ ›)', a.card.replace(/\n/g, ' / '));
      await shot('empty-trips', { night: false });
      await ev(() => { const g = window.slimekin; g.state.ranch.residents.length = 0; g.ranch.sync([]); });
      await ev(() => window.slimekin.advance(0.5));
      const b = await ev(() => document.getElementById('barnCard').innerText);
      expect(/Nobody lives here yet/.test(b) && /all grown up \(Settled\)/.test(b), 'nobody at all: the card says the ranch is empty and how to fill it (today\'s words)', b.replace(/\n/g, ' / '));
      await shot('empty');
    });

    // ---------- the barn can't load ----------
    if (ONLY.includes('fail')) await part('fail', async () => {
      let blocked = 0;
      const errAt = kit.errors.length;
      await page.route('**/src/assets/barn/**', r => { blocked++; return r.abort(); });
      await boot();
      consoleLines.length = 0;
      await watchRanch();
      // ahead of time, in the background: it fails quietly (no toast, home as it is)
      await page.waitForFunction(() => window.slimekin.barnRanch.view.failed, null, { timeout: 120000 });
      await settle(2);
      const pre = await ev(() => ({ asked: window.slimekin.barnRanch.pre.asked, view: window.slimekin.view, tab: window.slimekin.hud.tab }));
      const preToasts = await toastsWith('barn needs the internet');
      expect(pre.asked && pre.view === 'home' && preToasts === 0 && blocked > 0, 'the barn loads ahead of time; when it can\'t, nothing shows (home as it is, no toast)', JSON.stringify(pre));
      // the Ranch tab (a real tap): it tries again, fails, and home stays
      await page.click('#tab-ranch');
      await page.waitForFunction(() => !window.slimekin.barnRanch.waiting, null, { timeout: 120000 });
      await settle(2);
      const s = await ev(() => { const g = window.slimekin; return { view: g.view, barn: g.barnRanch.on, ranchBar: !document.getElementById('ranchBar').hidden, atRanch: document.body.classList.contains('at-ranch'), card: !document.getElementById('barnCard').hidden, pill: !document.getElementById('barnWait').hidden, tab: g.hud.tab, room: g.home.room.group.visible }; });
      const toasts1 = await toastsWith('barn needs the internet the first time');
      const toastText = await ev(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.innerText.replace(/\n/g, ' ')).find(t => /barn needs/.test(t)) || '');
      expect(s.view === 'home' && !s.barn && !s.ranchBar && !s.atRanch && !s.card && !s.pill && s.room, 'the barn can\'t load: Ranch keeps you home (no ranch bar, no card, the room still drawn)', JSON.stringify(s));
      expect(toasts1 === 1 && /^The barn needs the internet the first time\. ?Try again in a moment\.$/.test(toastText), 'one friendly toast', toastText);
      expect(s.tab === 'helpers', 'the menu goes back to the page it was on (Helpers)', s.tab);
      await page.screenshot({ path: path.join(OUT, 'fail-toast-day.png') });
      // the next tap tries again (a second try, a second toast)
      await page.waitForTimeout(400);
      await page.click('#tab-ranch');
      await page.waitForFunction(() => !window.slimekin.barnRanch.waiting, null, { timeout: 120000 });
      await settle(2);
      const warns = consoleLines.filter(l => /Barn: the barn could not load/.test(l)).length;
      const tries = await ev(() => window.slimekin.view);
      expect(tries === 'home' && warns === 3, `each try is one more load, logged once each (3 tries: ahead of time and two taps; ${warns} lines)`);
      // the files come back: the next tap opens the barn
      await page.unroute('**/src/assets/barn/**');
      await ev(() => window.slimekin.advance(4));   // (the toasts go)
      await page.click('#tab-ranch');
      await page.waitForFunction(() => window.slimekin.barnRanch.on || (window.slimekin.barnRanch.view.failed && !window.slimekin.barnRanch.waiting), null, { timeout: 120000 });
      await settle(2);
      const back = await ev(() => ({ on: window.slimekin.barnRanch.on, view: window.slimekin.view, card: !document.getElementById('barnCard').hidden }));
      expect(back.on && back.view === 'ranch' && back.card, 'the files are back: the next tap opens the barn', JSON.stringify(back));
      const w = await watched();
      expect(w.ranchScreen === 0 && w.frames > 0, `the meadow ranch was never drawn (${w.frames} frames checked)`, w.why.join('; '));
      // the blocked files' own "Failed to load resource" lines are expected here; any other page error still fails
      const expected = kit.errors.filter(e => /^console: Failed to load resource: net::ERR_FAILED$/.test(e)).length;
      for (let i = kit.errors.length - 1; i >= errAt; i--) if (/^console: Failed to load resource: net::ERR_FAILED$/.test(kit.errors[i])) kit.errors.splice(i, 1);
      log('fail:', `${expected} expected "Failed to load resource" lines for the ${blocked} blocked requests`);
    });

    // ---------- the barn's files are slow ----------
    if (ONLY.includes('slow')) await part('slow', async () => {
      for (const scene of ['greenhouse', 'meadow']) {
        let release = null, held = 0;
        const gate = new Promise(r => { release = r; });
        await page.route('**/src/assets/barn/**', async r => { held++; await gate; return r.continue().catch(() => {}); });
        await boot();
        if (scene === 'meadow') await ev(() => { const g = window.slimekin; g.state.settings.scene = 'meadow'; g.applySettings(); });
        await watchRanch();
        // ahead of time: the barn's files are asked for before anyone taps Ranch (and held here)
        await page.waitForFunction(() => window.slimekin.barnRanch.pre.asked && !!window.slimekin.barnRanch.view.loading, null, { timeout: 120000 });
        for (let i = 0; i < 100 && !held; i++) await page.waitForTimeout(100);
        const asked = await ev(() => ({ asked: window.slimekin.barnRanch.pre.asked, ready: window.slimekin.barnRanch.view.ready, t: Math.round(performance.now()) }));
        expect(asked.asked && !asked.ready && held > 0, `${scene}: the barn's files are asked for ahead of time, before Ranch is tapped (${held} held)`, JSON.stringify(asked));
        await page.click('#tab-ranch');
        await settle(2);
        const a = await ev(() => { const g = window.slimekin, p = document.getElementById('barnWait'); return { view: g.view, waiting: g.barnRanch.waiting, pill: !p.hidden, text: p.innerText.trim(), tab: g.hud.tab, ranchBar: !document.getElementById('ranchBar').hidden, cam: g.stage.camPos.z.toFixed(2) }; });
        expect(a.view === 'home' && a.waiting && a.pill && /^Off to the barn$/.test(a.text) && a.tab === 'ranch' && !a.ranchBar, `${scene}: Ranch while they are still coming: home stays, "Off to the barn" shows`, JSON.stringify(a));
        if (scene === 'greenhouse') {
          for (const dark of [false, true]) {
            await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark);
            await page.waitForTimeout(300);
            await ev(() => window.slimekin.advance(3.2));
            await page.screenshot({ path: path.join(OUT, `slow-wait-${dark ? 'night' : 'day'}.png`), timeout: 120000 });
          }
          await ev(() => document.documentElement.setAttribute('data-theme', 'light'));
          // another tab calls it off; Ranch again waits again
          await page.click('#tab-shop');
          await settle(2);
          const off = await ev(() => ({ waiting: window.slimekin.barnRanch.waiting, pill: !document.getElementById('barnWait').hidden, tab: window.slimekin.hud.tab }));
          expect(!off.waiting && !off.pill && off.tab !== 'ranch', 'another tab while waiting calls it off (the pill goes)', JSON.stringify(off));
          await page.click('#tab-ranch');
          await settle(1);
        } else {
          await page.screenshot({ path: path.join(OUT, 'slow-wait-meadow-day.png'), timeout: 120000 });
          // the Ranch page's "Back home" calls it off too (home, the menu closed)
          await page.click('#ranchHome');
          await settle(2);
          const off = await ev(() => ({ waiting: window.slimekin.barnRanch.waiting, pill: !document.getElementById('barnWait').hidden, tab: window.slimekin.hud.tab, sheet: window.slimekin.hud.sheetState(), view: window.slimekin.view }));
          expect(!off.waiting && !off.pill && off.tab === 'helpers' && off.sheet === 'closed' && off.view === 'home', '"Back home" while waiting calls it off (home, the menu closed)', JSON.stringify(off));
          await page.click('#tab-ranch');
          await settle(1);
        }
        await page.waitForTimeout(1200);
        const t0 = Date.now();
        release();
        await page.waitForFunction(() => window.slimekin.barnRanch.on, null, { timeout: 120000 });
        await settle(2);
        const b = await ev(() => { const g = window.slimekin; return { view: g.view, on: g.barnRanch.on, pill: !document.getElementById('barnWait').hidden, card: !document.getElementById('barnCard').hidden, cur: g.barnRanch.curId }; });
        const w = await watched();
        expect(b.view === 'ranch' && b.on && !b.pill && b.card && !!b.cur, `${scene}: the barn opens the moment they arrive (${Date.now() - t0} ms after; the pill goes)`, JSON.stringify(b));
        expect(w.ranchScreen === 0 && w.waitFrames > 0 && w.pill > 0, `${scene}: while waiting, the meadow ranch was never drawn (${w.frames} frames checked, ${w.waitFrames} of them waiting)`, w.why.join('; '));
        await page.unroute('**/src/assets/barn/**');
      }
    });
  } catch (e) {
    errors.push(String(e && e.stack || e));
    log('FAIL', String(e && e.message || e));
    if (kit) await kit.diagnose().catch(() => {});
  }
  const pageErrors = kit ? kit.errors : [];
  if (pageErrors.length) errors.push('page errors: ' + pageErrors.slice(0, 5).join(' | '));
  if (kit) await kit.close();
  if (errors.length) { console.log('FAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('OK');
  process.exit(0);
})();
