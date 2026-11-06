// Recipe body smoke test (slice B1): plays the new body through the game in a headless phone-sized browser.
//   1. A Curly hatches and grows to Settled; at baby, teen and grown a real touch drag (CDP Input.dispatchTouchEvent)
//      grabs the curl's tip: the tip follows the finger, then boings back when let go.
//   2. A Cat-ear egg is bought with pearls in the Nursery and chosen at move-out; it hatches a Cat-ear Dollop, which
//      grows to Settled with the same touch pull on the top of its dome at baby, teen and grown.
//   3. The Curly and the Dollop, both on the ranch now, make an egg in the Nursery: its baby is an in-between
//      (mix 0.25 .. 0.75). It goes on the cushion, hatches, grows up and moves to the ranch too.
//   4. The ranch with all three (Curly, Cat-ear Dollop, in-between): every point of every body is finite; a visit.
// Fails on any page error or a failed check. Screenshots (day and night) go to tools/out/recipe-body/.
//
// Setup as in tools/smoke-test.cjs (playwright + three@0.170.0 outside the repo, found through NODE_PATH). Starts its
// own dev server on a free loopback port, runs offline, stops everything on exit (tools/browser-kit.cjs).
//   node tools/recipe-smoke.cjs [--dpr 2] [--quick]     (--quick: day screenshots only)
const path = require('path');
const fs = require('fs');
const { devices } = require('playwright');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const OUT = path.join(__dirname, 'out', 'recipe-body');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const DPR = Number(arg('dpr', 1));
const QUICK = process.argv.includes('--quick');
const ONLY = Number(arg('only', 4));   // run parts 1 .. ONLY
const VIEW = { width: 393, height: 852 };
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const errors = [], checks = [];
  const ok = (cond, what, detail = '') => { checks.push(!!cond); log(`${cond ? 'ok  ' : 'FAIL'} ${what}${detail ? ' | ' + detail : ''}`); if (!cond) errors.push('check failed: ' + what + (detail ? ' (' + detail + ')' : '')); };
  let kit = null;
  watchdog(40, () => kit ? kit.current() : 'setup');
  try {
    const dev = devices['iPhone 15 Pro'];
    kit = await setup({ contextOptions: { userAgent: dev.userAgent, isMobile: true, hasTouch: true, viewport: VIEW, screen: VIEW, deviceScaleFactor: DPR } });
    const { page, step } = kit;
    page.setDefaultTimeout(120000);
    const ev = (fn, a, ms) => kit.ev(fn, a, ms);
    const cdp = await kit.context.newCDPSession(page);
    const setTheme = async dark => { await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark); await page.waitForTimeout(300); await ev(() => window.slimekin.advance(0.5)); };
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
      log('screenshot', name);
    }, 300000);
    const boot = async () => {
      await page.waitForFunction(() => window.slimekin && window.slimekin.state, null, { timeout: 120000 });
      await page.waitForTimeout(2500);
      await ev(() => {
        const g = window.slimekin; g.behave.hour = () => 14; g.state.settings.quality = 'high'; g.applySettings(); g.debugInstant = true; g.instantEggs(); g.hud.closeModal();
        window.__pev = [];   // pointer events the page sees (printed when a pull check fails)
        for (const t of ['pointerdown', 'pointerup', 'pointercancel']) window.addEventListener(t, e => window.__pev.push(t + (e.target === g.canvas ? '' : '@' + (e.target.id || e.target.tagName))), true);
      });
    };
    const calm = () => ev(() => { const g = window.slimekin; g.state.tutorial = 5; g.requests.timer = 1e9; g.glimmerT = 1e9; g.debug('needs'); g.hud.closeModal(); });
    const hatchNow = async name => {
      await ev(() => { const g = window.slimekin; for (let i = 0; i < 5; i++) g.tapEgg(g.egg.group.position.clone()); g.advance(4.5); });
      await page.waitForSelector('#slimeName');
      await page.fill('#slimeName', name); await page.click('#nameOk');
      await calm();
    };
    const grow = () => ev(() => { const g = window.slimekin; g.debug('grow'); g.advance(3); g.hud.closeModal(); g.advance(1); g.hud.closeModal(); });
    // every point of the pet (and of every ranch resident) is a finite number
    const finite = () => ev(() => {
      const g = window.slimekin, bad = av => { let n = 0; for (const v of av.geo.attributes.position.array) if (!Number.isFinite(v)) n++; return n; };
      return { pet: bad(g.slime), points: g.slime.geo.attributes.position.count, residents: [...g.ranch.residents.values()].map(r => bad(r.av)) };
    });
    const touch = (type, x, y, ts) => cdp.send('Input.dispatchTouchEvent', { type, timestamp: ts,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });

    // A real touch pull: find a point on the curl near its tip (Curly) or the top of the dome (Dollop) that a finger
    // really hits, press there, drag away from the body, hold (the game runs on), check the tip followed the finger,
    // let go, and check it boings back.
    const pullTest = async (label, shotName) => step('pull ' + label, async () => {
      // (a notification over the slime would catch the finger first, as it does on a phone: clear them)
      await ev(() => { for (const t of document.querySelectorAll('.toast')) t.remove(); });
      const findSpot = () => ev(() => {
        const g = window.slimekin, sl = g.slime, V = g.v1.constructor, cam = g.stage.camera;
        const pos = sl.geo.attributes.position.array, base = sl.base, n = pos.length / 3;
        const A = [0.3, 1, -0.25], l = Math.hypot(...A); A[0] /= l; A[1] /= l; A[2] /= l;
        const curly = sl.S.armK > 0.3;
        // candidates: on the curl (Curly: from near the tip down), or the top of the dome (Dollop)
        const cand = [];
        for (let i = 0; i < n; i++) {
          const c = base[i * 3] * A[0] + base[i * 3 + 1] * A[1] + base[i * 3 + 2] * A[2];
          // (the upper three quarters of the curl, nearest the tip first: from some angles the tip hides behind the head)
          if (curly) { if (c > Math.cos(sl.curl.th * 0.82)) cand.push([i, c]); }
          else cand.push([i, pos[i * 3 + 1] + 0.35 * pos[i * 3 + 2]]);   // the top of the dome, a little toward the front (the very top is the outline)
        }
        cand.sort((a, b) => b[1] - a[1]);
        const scr = (i, out) => { const w = sl.body.localToWorld(new V(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])); out.w = w.clone(); const p = w.clone().project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; };
        const center = sl.centerWorld(new V()).project(cam), cx = (center.x + 1) / 2 * innerWidth, cy = (1 - center.y) / 2 * innerHeight;
        const hitAt = (x, y) => { g.ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); g.raycaster.setFromCamera(g.ndc, cam); return sl.hit(g.raycaster); };
        const why = { candidates: Math.min(900, cand.length), offScreen: 0, noHit: 0, hidden: 0, edge: 0 };
        for (const [i] of cand.slice(0, 900)) {
          const o = {}, s = scr(i, o);
          if (s.x < 10 || s.y < 60 || s.x > innerWidth - 10 || s.y > innerHeight - 200) { why.offScreen++; continue; }
          const h = hitAt(s.x, s.y);
          if (!h) { why.noHit++; continue; }
          if (h.point.distanceTo(o.w) > 0.05) { why.hidden++; continue; }
          // a point a finger can't miss while the body sways a little (software WebGL draws a few frames a second):
          // the slime is under the finger 7 px away in every direction too
          if (![[7, 0], [-7, 0], [0, 7], [0, -7]].every(([ox, oy]) => hitAt(s.x + ox, s.y + oy))) { why.edge++; continue; }
          // drag away from the body's middle (and a little up)
          let dx = s.x - cx, dy = s.y - cy; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl; dy -= 0.6; const d2 = Math.hypot(dx, dy); dx /= d2; dy /= d2;
          const el = document.elementFromPoint(s.x, s.y);
          return { x: s.x, y: s.y, dx, dy, vi: i, curly, top0: o.w.toArray(), loc0: [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], tip0: sl.body.localToWorld(new V(pos[0], pos[1], pos[2])).toArray(),
            el: el ? el.tagName + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') : 'none', modal: g.hud.modalOpen };
        }
        return { none: { ...why, modal: g.hud.modalOpen, hopY: +sl.hopY.toFixed(3), view: g.view, camY: +cam.position.y.toFixed(2) } };
      });
      // Aim, then touch. The slime keeps living between the two (idle moments, hops; software WebGL is slow), so a
      // finger can now and then land beside it: then it is lifted and the test aims again (up to 3 tries, reported).
      let at = null, tries = 0, t0 = 0;
      const D = 90, steps = 9;
      let none = null;
      for (tries = 1; tries <= 3; tries++) {
        at = await findSpot();
        if (at.none) {   // no spot a finger can't miss right now (it may be mid-hop): wait a moment and aim again
          none = at.none; at = null;
          log(`  (${label}: no spot to touch on try ${tries}: ${JSON.stringify(none)}; aiming again)`);
          await ev(() => window.slimekin.advance(1.5));
          continue;
        }
        t0 = Date.now() / 1000;
        await ev(() => { window.__pev = []; });
        await touch('touchStart', at.x, at.y, t0);
        at.start = await ev(() => { const g = window.slimekin; return (g.press ? g.press.mode : 'no press') + ' / ' + window.__pev.join(','); });
        if (!at.start.startsWith('no press')) break;
        const now = await ev(a => {   // is the slime under that spot now? (no: it moved; yes: a timing problem)
          const g = window.slimekin; g.ndc.set(a.x / innerWidth * 2 - 1, -(a.y / innerHeight) * 2 + 1); g.raycaster.setFromCamera(g.ndc, g.stage.camera);
          return { under: !!g.slime.hit(g.raycaster), hopY: +g.slime.hopY.toFixed(3), modal: g.hud.modalOpen };
        }, at);
        log(`  (${label}: the finger landed beside the slime, try ${tries}: slime under that spot now ${now.under}, hop ${now.hopY}, modal ${now.modal}; aiming again)`);
        await touch('touchEnd', 0, 0, t0 + 0.1);
        await ev(() => window.slimekin.advance(1.5));
      }
      if (!at) { ok(false, `${label}: found a point on the tip a finger can touch`, JSON.stringify(none)); return; }
      if (at.start.startsWith('no press')) { ok(false, `${label}: a finger landed on the slime in 3 tries`, at.start); return; }
      at.tries = Math.min(tries, 3);
      for (let i = 1; i <= steps; i++) await touch('touchMove', at.x + at.dx * D * i / steps, at.y + at.dy * D * i / steps, t0 + 0.06 * i);
      const held = await ev(a => {
        const g = window.slimekin, sl = g.slime, V = g.v1.constructor, pos = sl.geo.attributes.position.array;
        g.advance(0.5);
        const p = sl.body.localToWorld(new V(pos[a.vi * 3], pos[a.vi * 3 + 1], pos[a.vi * 3 + 2]));
        const tip = sl.body.localToWorld(new V(pos[0], pos[1], pos[2]));
        const k = sl.body.scale.x || 1;   // (in the body's own size: a baby is small)
        return { pev: window.__pev.join(','), mode: g.press && g.press.mode, tipGrab: sl.tipGrab, amt: sl.pull.amt, moved: p.distanceTo(new V(...a.top0)) / k, tipMoved: tip.distanceTo(new V(...a.tip0)) / k, up: p.y - a.top0[1] };
      }, at);
      if (shotName) await shot(shotName, { night: false });
      await touch('touchEnd', 0, 0, t0 + 0.06 * steps + 0.3);
      const after = await ev(a => {
        const g = window.slimekin, sl = g.slime, V = g.v1.constructor, pos = sl.geo.attributes.position.array;
        g.advance(2.5);
        // (on the body itself: the slime may hop or turn after a big pull)
        const i = a.vi * 3, back = Math.hypot(pos[i] - a.loc0[0], pos[i + 1] - a.loc0[1], pos[i + 2] - a.loc0[2]);   // body units
        return { amt: sl.pull.amt, tipGrab: sl.tipGrab, back };
      }, at);
      const what = at.curly ? 'the curl tip' : 'the top of the dome';
      ok(held.mode === 'pull' && held.amt > 0.15 && held.moved > 0.25 && (!at.curly || held.tipGrab > 0),
        `${label}: a real touch drag pulls ${what}; it follows the finger`, `${at.tries > 1 ? `try ${at.tries}, ` : ''}at (${at.x.toFixed(0)}, ${at.y.toFixed(0)}) on ${at.el}${at.modal ? ' (a modal is open)' : ''}${held.mode === 'pull' ? '' : `, on touch: ${at.start}; then ${held.pev}`}, mode ${held.mode}, tipGrab ${(+held.tipGrab).toFixed(2)}, pull ${held.amt.toFixed(2)}, the grabbed point moved ${held.moved.toFixed(2)} body units (curl tip ${held.tipMoved.toFixed(2)})`);
      ok(after.amt < 0.05 && after.tipGrab === 0 && after.back < held.moved * 0.5, `${label}: let go, it boings back`, `pull ${after.amt.toFixed(3)}, ${after.back.toFixed(2)} from where it started`);
    }, 300000);
    const perf = label => ev(lbl => {
      const g = window.slimekin, sl = g.slime, o = { x: 0, y: 0, z: 0 };
      const shapeMs = av => { const b = av.base, az = av.baseAz, t0 = performance.now(); for (let k = 0; k < 30; k++) for (let i = 0, j = 0; i < b.length; i += 3, j++) av.shape(b[i], b[i + 1], b[i + 2], az[j], o, true); return (performance.now() - t0) / 30; };
      const updMs = av => { const t0 = performance.now(); for (let k = 0; k < 30; k++) av.update(1 / 60); return (performance.now() - t0) / 30; };
      const res = [...g.ranch.residents.values()];
      return { label: lbl, petPoints: sl.geo.attributes.position.count, petShapeMs: +shapeMs(sl).toFixed(2), petUpdateMs: +updMs(sl).toFixed(2),
        residents: res.length, residentPoints: res[0]?.av.geo.attributes.position.count || 0,
        residentShapeMs: res.length ? +(res.reduce((s, r) => s + shapeMs(r.av), 0) / res.length).toFixed(2) : 0,
        residentUpdateMs: res.length ? +(res.reduce((s, r) => s + updMs(r.av), 0) / res.length).toFixed(2) : 0 };
    }, label);
    const moveOut = async eggId => step('move out' + (eggId ? ' with egg ' + eggId : ''), async () => {
      await ev(() => { const g = window.slimekin; g.state.totalJelly = Math.max(g.state.totalJelly, 3e9); g.hud.closeModal(); });
      await ev(() => { const g = window.slimekin; if (g.view !== 'ranch') g.hud.openTab('ranch'); g.closeNursery(); g.hud.openTab('ranch'); g.advance(3); });
      await page.click('#moveOutBtn');
      if (eggId) await page.click(`.choice[data-egg="${eggId}"]`);
      await page.click('#mvYes');
      const nav = page.waitForNavigation({ waitUntil: 'commit', timeout: 120000 });
      await ev(() => window.slimekin.advance(6));
      await nav;
      await page.waitForFunction(() => window.slimekin && window.slimekin.egg, null, { timeout: 120000 });
    }, 300000);

    // ---------- 1. a Curly grows up; the curl's tip pulls at every stage ----------
    await step('open the game', () => page.goto(`${kit.server.origin}/#debug`));
    await step('boot', boot);
    const plain = await ev(() => { const s = window.slimekin.state; return { seed: s.egg.seed, breed: s.slime.breed, mix: s.slime.mix, variant: s.slime.variant }; });
    ok(!!plain.seed && (plain.mix === 0 || plain.mix === 1) && ['curly', 'dollop'].includes(plain.breed), 'a plain egg has a seed and holds a pure Curly or Dollop', JSON.stringify(plain));
    await step('hatch the first slime', () => hatchNow('Curlo'));
    await ev(() => window.slimekin.debugBody({ mix: 0, variant: 'plain' }, { instant: true }));   // (plain eggs are random: this one is a Curly)
    const s1 = await ev(() => { const s = window.slimekin.state.slime; return { breed: s.breed, mix: s.mix, variant: s.variant }; });
    ok(s1.breed === 'curly' && s1.mix === 0, '#debug: the slime is set to a Curly', JSON.stringify(s1));
    await ev(() => window.slimekin.advance(1));
    let f = await finite(); ok(f.pet === 0, 'Curly baby: every point finite', `${f.points} points`);
    await shot('01-curly-baby');
    await pullTest('Curly baby', '02-curly-baby-pull');
    await grow();
    await ev(() => window.slimekin.advance(3));
    await shot('03-curly-teen');
    await pullTest('Curly teen', '04-curly-teen-pull');
    await grow(); await grow();
    await ev(() => { const g = window.slimekin; g.advance(4); g.hud.closeModal(); });
    const st1 = await ev(() => ({ stage: window.slimekin.sim.stageIndex(), m: window.slimekin.slime.m }));
    ok(st1.stage === 3 && st1.m > 0.99, 'the Curly is Settled (shape number m eased to 1)', JSON.stringify(st1));
    f = await finite(); ok(f.pet === 0, 'Curly grown: every point finite');
    await shot('05-curly-grown');
    await pullTest('Curly grown', '06-curly-grown-pull');
    const p1 = await perf('home, Curly grown'); log('perf', JSON.stringify(p1));

    if (ONLY < 2) throw new Error('stop');
    // ---------- 2. a Cat-ear egg for pearls, chosen at move-out; a Cat-ear Dollop grows up ----------
    await ev(() => { const g = window.slimekin; g.debug('pearls'); g.debug('pearls'); });
    await page.click('#tab-ranch');
    await ev(() => { const g = window.slimekin; g.advance(3); g.openNursery(); g.advance(1); });
    const before = await ev(() => ({ pearls: window.slimekin.state.ranch.pearls, eggs: window.slimekin.state.ranch.nursery.eggs.length }));
    await step('buy a Cat-ear egg', () => page.click('button[data-act="buySpecial"][data-variant="ears"]'));
    const bought = await ev(() => { const g = window.slimekin, R = g.state.ranch, e = R.nursery.eggs[R.nursery.eggs.length - 1]; return { pearls: R.pearls, eggs: R.nursery.eggs.length, special: e && e.special, body: e && e.body, id: e && e.id, mem: g.state.memories.some(m => /Cat-ear egg/.test(m.text)) }; });
    ok(bought.eggs === before.eggs + 1 && bought.pearls === before.pearls - 75 && bought.special === 'ears' && bought.body.breed === 'dollop' && bought.body.variant === 'ears',
      'the Cat-ear egg: 75 pearls, waits in the Nursery, a Dollop with ears guaranteed', `${before.pearls} -> ${bought.pearls} pearls, body ${JSON.stringify(bought.body)}`);
    ok(bought.mem, 'a Journal line for the first special egg');
    await ev(() => { const g = window.slimekin; g.debug('pearls'); g.state.ranch.pearls = 80; g.hud.renderRanch(true); });
    await step('buy a Topknot egg (fills the nest)', () => page.click('button[data-act="buySpecial"][data-variant="topknot"]'));
    const full = await ev(() => { const g = window.slimekin, R = g.state.ranch; return { eggs: R.nursery.eggs.length, why: g.sim.ranch.canBuySpecialEgg('ears'), disabled: document.querySelector('button[data-act="buySpecial"][data-variant="ears"]').disabled, msg: document.querySelector('.special-why')?.textContent || '' }; });
    ok(full.eggs === 2 && !full.why.ok && full.why.reason === 'full' && full.disabled && /nest is full/.test(full.msg), 'the nest is full: a friendly no, the button waits', full.msg);
    await ev(() => { const el = document.getElementById('body-ranch'); const t = el.querySelector('.special-egg'); if (t) el.scrollTop = Math.max(0, t.offsetTop - 160); });
    await shot('07-nursery-special-eggs');
    await moveOut(bought.id);
    await step('boot (gen 2)', boot);
    const e2 = await ev(() => { const s = window.slimekin.state; return { special: s.egg.bred && s.egg.bred.special, breed: s.slime.breed, variant: s.slime.variant, mix: s.slime.mix, res: s.ranch.residents.map(x => ({ breed: x.breed, mix: x.mix })) }; });
    ok(e2.special === 'ears' && e2.breed === 'dollop' && e2.variant === 'ears' && e2.mix === 1 && e2.res.length === 1 && e2.res[0].breed === 'curly',
      'moved out: the Curly lives on the ranch, the Cat-ear egg is on the cushion', JSON.stringify(e2));
    await step('hatch the Cat-ear egg', () => hatchNow('Kitty'));
    await ev(() => window.slimekin.advance(1));
    await shot('08-dollop-ears-baby');
    await pullTest('Cat-ear Dollop baby', '09-dollop-ears-baby-pull');
    await grow(); await ev(() => window.slimekin.advance(3));
    await shot('10-dollop-ears-teen');
    await pullTest('Cat-ear Dollop teen');
    await grow(); await grow(); await ev(() => { const g = window.slimekin; g.advance(4); g.hud.closeModal(); });
    f = await finite(); ok(f.pet === 0, 'Cat-ear Dollop grown: every point finite');
    await shot('11-dollop-ears-grown');
    await pullTest('Cat-ear Dollop grown', '12-dollop-ears-grown-pull');
    await moveOut(null);

    // ---------- 3. Curly x Dollop in the Nursery: an in-between ----------
    await step('boot (gen 3)', boot);
    await ev(() => { const g = window.slimekin; g.debug('pearls'); });
    await page.click('#tab-ranch');
    await ev(() => { const g = window.slimekin; g.advance(3); g.openNursery(); g.advance(1); });
    // (the breeding buttons themselves are tested in breeding-smoke.cjs; here they are pressed from the page)
    const domClick = sel => ev(q => { const b = document.querySelector(q); if (!b) throw new Error('no ' + q); b.scrollIntoView({ block: 'center' }); b.click(); }, sel);
    const ids = await ev(() => window.slimekin.state.ranch.residents.map(x => x.id));
    for (const id of ids) await domClick(`.parent-pick[data-id="${id}"]`);
    await step('make an egg', () => domClick('#breedBtn'));
    const bred = await ev(() => { const g = window.slimekin; g.instantEggs(); const e = g.state.ranch.nursery.eggs.find(x => !x.special); return e && { id: e.id, body: e.body }; });
    ok(bred && bred.body.mix >= 0.25 && bred.body.mix <= 0.75 && bred.body.breed === 'mixed', 'Curly x Dollop egg: an in-between (mix 0.25 .. 0.75)', bred && JSON.stringify(bred.body));
    await step('put it on the cushion', async () => { await domClick(`button[data-act="cushion"][data-egg="${bred.id}"]`); await domClick('#cuYes'); await ev(() => window.slimekin.advance(2)); });
    const cushion = await ev(() => { const s = window.slimekin.state; return { mix: s.slime.mix, breed: s.slime.breed }; });
    ok(Math.abs(cushion.mix - bred.body.mix) < 1e-9, 'the cushion egg carries the in-between body', JSON.stringify(cushion));
    await step('hatch the in-between', () => hatchNow('Swirl'));
    await ev(() => window.slimekin.advance(1));
    await shot('13-inbetween-baby');
    await grow(); await grow(); await grow(); await ev(() => { const g = window.slimekin; g.advance(4); g.hud.closeModal(); });
    f = await finite(); ok(f.pet === 0, 'in-between grown: every point finite');
    await shot('14-inbetween-grown');
    await moveOut(null);

    // ---------- 4. the ranch with all three ----------
    await step('boot (gen 4)', boot);
    await page.click('#tab-ranch');
    await ev(() => { const g = window.slimekin; g.advance(4); });
    const ranch = await ev(() => window.slimekin.state.ranch.residents.map(x => ({ name: x.name, breed: x.breed, variant: x.variant, mix: +x.mix.toFixed(3) })));
    ok(ranch.length === 3 && ranch.some(x => x.breed === 'curly') && ranch.some(x => x.breed === 'dollop' && x.variant === 'ears') && ranch.some(x => x.breed === 'mixed'),
      'the ranch: a Curly, a Cat-ear Dollop and an in-between', JSON.stringify(ranch));
    f = await finite(); ok(f.residents.length === 3 && f.residents.every(n => n === 0), 'every resident: every point finite', JSON.stringify(f.residents));
    await ev(() => { const g = window.slimekin; g.hud.setSheet && g.hud.setSheet('closed', false); g.advance(2); });
    await shot('15-ranch');
    const p2 = await perf('ranch, 3 residents'); log('perf', JSON.stringify(p2));
    await ev(id => { const g = window.slimekin; g.focusResident(id); g.advance(3); }, ids[1]);
    await shot('16-visit-dollop', { night: false });
    const visit = await ev(() => { const g = window.slimekin, r = g.ranch.resident(g.ranchFocus); return { focus: g.ranchFocus, fizz: r.av.fizz.visible, inner: r.av.inner.visible }; });
    ok(!!visit.focus && visit.fizz, 'visiting a resident: close-up, its bubbles show', JSON.stringify(visit));
  } catch (e) {
    if (e.message !== 'stop') errors.push('test error: ' + e.message);
  } finally {
    if (kit) { errors.unshift(...kit.errors); kit.report(); await kit.close(); }
  }
  log(`${checks.filter(Boolean).length} of ${checks.length} checks passed`);
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
