// The travel-bubble send-off in a headless phone (393 x 852): a grown slime moves to the ranch and a baby goes to a new
// home, in each home Background (the Greenhouse in every camera angle it allows, the Meadow, Classic), at night, on Low
// graphics and with Reduced motion. From tools/fixtures/barn/barn-six.json (Pebble grown up, or a Sprout).
//   The check, every 1/15 s of the goodbye while the bubble shows: rays from the camera through the bubble's picture (its
//   middle, 8 halfway out and 12 just inside its outline, the ones inside the screen) must not meet anything drawn at home (the
//   room, the helpers, the meadow, the cushion; not the slime, the bubble itself, sparkles or the sky) before they have
//   passed through the whole bubble: nothing in front of it, nothing inside it. That holds until it has left the picture
//   or popped. The bubble never dips below the cushion, a baby drifts toward its family's side, and the page reloads
//   into the egg as before (the moved-in card says "settling in at the barn").
//   node tools/send-off-smoke.cjs [--quick] [--frames] [--only=front,front-baby,wide,...]
// --quick: only front, wide, meadow, classic, reduced (grown and baby where listed). --frames: screenshots of set
// moments of each goodbye for the sheets (tools/out/send-off/<case>-<t>.png, the game clock held for each).
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const OUT = path.join(__dirname, 'out', 'send-off');
fs.mkdirSync(OUT, { recursive: true });
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : (process.argv.includes('--' + k) ? true : d); };
const QUICK = !!arg('quick', false), FRAMES = !!arg('frames', false);
const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'barn', 'barn-six.json'), 'utf8')).save;
// every case: [name, { kind: grown | baby, scene, view, night, low, reduced, reload }]
const CASES = [
  ['front', { kind: 'grown', scene: 'greenhouse', view: 'front', reload: true }],
  ['front-baby', { kind: 'baby', scene: 'greenhouse', view: 'front', reload: true }],
  ['wide', { kind: 'grown', scene: 'greenhouse', view: 'wide' }],
  ['wide-baby', { kind: 'baby', scene: 'greenhouse', view: 'wide' }],
  ['left', { kind: 'grown', scene: 'greenhouse', view: 'left' }],
  ['left-baby', { kind: 'baby', scene: 'greenhouse', view: 'left' }],
  ['right', { kind: 'grown', scene: 'greenhouse', view: 'right' }],
  ['right-baby', { kind: 'baby', scene: 'greenhouse', view: 'right' }],
  ['turned', { kind: 'grown', scene: 'greenhouse', view: 'turned' }],       // turned by hand to the side limit, low, looking up
  ['turned-baby', { kind: 'baby', scene: 'greenhouse', view: 'turned' }],
  ['pinched', { kind: 'grown', scene: 'greenhouse', view: 'pinched' }],     // Wide, pinched out as far as it goes
  ['pinched-baby', { kind: 'baby', scene: 'greenhouse', view: 'pinched' }],
  ['meadow', { kind: 'grown', scene: 'meadow', reload: true }],
  ['meadow-baby', { kind: 'baby', scene: 'meadow' }],
  ['classic', { kind: 'grown', scene: 'classic' }],
  ['classic-baby', { kind: 'baby', scene: 'classic' }],
  ['night', { kind: 'grown', scene: 'greenhouse', view: 'front', night: true }],
  ['night-baby', { kind: 'baby', scene: 'greenhouse', view: 'front', night: true }],
  ['meadow-night', { kind: 'grown', scene: 'meadow', night: true }],
  ['low', { kind: 'grown', scene: 'greenhouse', view: 'front', low: true }],
  ['reduced', { kind: 'grown', scene: 'greenhouse', view: 'front', reduced: true }],
  ['reduced-baby', { kind: 'baby', scene: 'greenhouse', view: 'front', reduced: true }],
];
const QUICK_SET = ['front', 'front-baby', 'wide', 'meadow', 'classic', 'reduced'];
const only = arg('only', null);
const RUN = CASES.filter(([n]) => (only ? String(only).split(',').includes(n) : !QUICK || QUICK_SET.includes(n)));
const SHOTS = [0.5, 1.25, 1.7, 2.2, 2.7, 3.2];   // the moments for the sheets (s from the goodbye's start)

(async () => {
  const errors = [];
  const expect = (cond, what, detail = '') => { if (cond) log('ok', what, detail ? `| ${detail}` : ''); else { errors.push(what + (detail ? ': ' + detail : '')); log('FAIL', what, detail); } };
  let kit = null;
  watchdog(60, () => kit ? kit.current() : 'setup');
  try {
    kit = await setup({ contextOptions: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } });
    const { page, step, ev } = kit;
    page.setDefaultTimeout(30000);
    // the save for each page load (?kind=grown|baby&n=..: seeded once per n)
    await kit.context.addInitScript(save => {
      const q = new URLSearchParams(location.search), key = 'seeded-' + (q.get('n') || '0');
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      const s = JSON.parse(JSON.stringify(save)), now = Date.now();
      for (const x of s.ranch.residents) {
        if (x.trip) { x.trip.startAt = now - 600000; x.trip.homeAt = now + 3000000; }
        if (x.lesson) { x.lesson.startAt = now - 600000; x.lesson.doneAt = now + 7200000; }
      }
      s.slime.growth = q.get('kind') === 'baby' ? 300 : 1601.6;   // a Sprout, or grown up (Settled)
      s.ranch.slots = Math.max(s.ranch.slots || 0, s.ranch.residents.length + 2);
      s.savedAt = now - 60000; s.ranch.lastVisit = now;
      localStorage.setItem('slimekin.save.v1', JSON.stringify(s));
    }, SAVE);
    let n = 0;
    const boot = async kind => {
      await page.goto(`${kit.server.origin}/?kind=${kind}&n=${++n}#debug`);
      await page.waitForFunction(() => window.slimekin && window.slimekin.state && window.slimekin.home && document.getElementById('boot').hidden, null, { timeout: 120000 });
      await page.waitForFunction(() => window.slimekin.home.world !== 'loading', null, { timeout: 120000 });
    };
    // the check, in the page: rays from the camera through the bubble's picture against everything drawn at home
    const installCheck = () => ev(() => {
      const g = window.slimekin, V = g.v1.constructor, rc = new g.raycaster.constructor();
      const skip = new Set();
      const add = o => o && o.traverse(x => skip.add(x));
      add(g.slime.root); add(g.sendOff.bubble.group); add(g.fx.group);
      for (const o of [g.stage.sky, g.stage.stars, g.home.room.sky, g.scenery.sky]) add(o);
      const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
      const name = o => { let p = o, s = []; while (p && s.length < 3) { if (p.name) s.push(p.name); p = p.parent; } return s.join('<') || o.type; };
      window.__check = { steps: 0, rays: 0, bad: [], closest: Infinity, tris: 0 };
      window.__checkNow = () => {
        const s = g.sendOff.s, b = g.sendOff.bubble.group;
        if (!s || !b.visible) return null;
        const cam = g.stage.camera; cam.updateMatrixWorld();
        const targets = [];
        g.scene.traverse(o => { if (o.isMesh && !skip.has(o) && shown(o) && o.material && o.material.visible !== false && o.material.depthTest !== false) targets.push(o); });
        const c = b.position.clone(), r = b.scale.x * (1 + (s.reduced ? 0 : 0.035));   // (its wobble at most)
        const eye = cam.position.clone(), d0 = c.clone().sub(eye), dist = d0.length();
        if (dist <= r) return { inside: true };
        d0.normalize();
        const right = new V(1, 0, 0).applyQuaternion(cam.quaternion), up = new V(0, 1, 0).applyQuaternion(cam.quaternion);
        const ang = Math.asin(r / dist), dirs = [d0.clone()];
        for (const [k, n] of [[0.5, 8], [0.97, 12]]) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, ax = right.clone().multiplyScalar(-Math.sin(a)).add(up.clone().multiplyScalar(Math.cos(a))); dirs.push(d0.clone().applyAxisAngle(ax.normalize(), ang * k)); }
        const C = window.__check, out = { rays: 0, bad: 0 };
        C.steps++;
        for (const d of dirs) {
          // where the ray goes through the bubble
          const oc = eye.clone().sub(c), bq = oc.dot(d), cq = oc.lengthSq() - r * r, disc = bq * bq - cq;
          if (disc < 0) continue;
          const t0 = -bq - Math.sqrt(disc), t1 = -bq + Math.sqrt(disc);
          const p0 = eye.clone().addScaledVector(d, t0).project(cam);
          if (Math.abs(p0.x) > 1 || Math.abs(p0.y) > 1) continue;   // off the screen: not seen
          rc.set(eye, d); rc.near = 0.01; rc.far = t1 + 0.001;
          const hits = [];
          for (const o of targets) Object.getPrototypeOf(o).raycast.call(o, rc, hits);
          C.rays++; out.rays++;
          hits.sort((a, h) => a.distance - h.distance);
          if (hits.length) { out.bad++; if (C.bad.length < 12) C.bad.push({ t: +s.t.toFixed(2), what: name(hits[0].object), hit: +hits[0].distance.toFixed(3), t0: +t0.toFixed(3), t1: +t1.toFixed(3), y: +c.y.toFixed(2) }); }
        }
        return out;
      };
    });
    // the goodbye, stepped by hand (the game's own loop held still): the check every 1/15 s up to tEnd; it stops early
    // when the bubble starts to pop (once), so a frame of the pop can be taken
    const runUntil = tEnd => ev(tEnd => {
      const g = window.slimekin, R = window.__run || (window.__run = { W: [], shownAt: null, endT: null, first: null, popSeen: false });
      for (let k = 0; k < 200 && g.departing && g.departing.t < tEnd - 1e-6; k++) {
        g.advance(Math.min(1 / 15, tEnd - g.departing.t));
        const so = g.sendOff, s = so.s;
        if (s && so.bubble.group.visible && R.shownAt === null) R.shownAt = +s.t.toFixed(2);
        window.__checkNow();
        if (s && !R.first && s.step === 'float') R.first = { c: [...s.c], r: s.r, slimeY: +g.slime.root.position.y.toFixed(3), passes: so.bubble.passes() };
        if (s && (s.step === 'gone' || s.step === 'pop') && R.endT === null) R.endT = +s.t.toFixed(2);
        if (s) R.W.push(s.c[1]);
        if (s && so.bubble.group.visible) R.low = Math.min(R.low === undefined ? Infinity : R.low, so.bubble.group.position.y - so.bubble.group.scale.x * (1 + 0.035));   // its bottom, at the bottom of its wobble
        if (s && s.step === 'pop' && !R.popSeen) { R.popSeen = true; return { pop: +s.t.toFixed(3) }; }
      }
      return { t: g.departing ? +g.departing.t.toFixed(3) : null };
    }, tEnd);
    const shoot = async file => {
      await ev(() => { const g = window.slimekin; g.stage.render(); });
      await page.waitForTimeout(200);
      await page.screenshot({ path: file, timeout: 120000 });
    };

    for (const [name, c] of RUN) await step(name, async () => {
      await boot(c.kind);
      await ev(c => {
        const g = window.slimekin, s = g.state.settings;
        g.behave.hour = () => 14; g.hud.closeModal();
        s.quality = c.low ? 'low' : 'high'; s.reducedMotion = !!c.reduced; s.scene = c.scene;
        g.applySettings(); g.advance(1); g.hud.closeModal(); g.advance(0.5); g.hud.closeModal();
        g.requests && (g.requests.timer = 1e9);
        if (c.view && c.view !== 'turned' && c.view !== 'pinched') g.home.setView(c.view);
        if (c.view === 'turned') { g.home.setView('front'); g.advance(2); g.home.beginFree(); for (let i = 0; i < 6; i++) g.home.rig.turn(-90, -60, g.home.pivot()); }
        if (c.view === 'pinched') { g.home.setView('wide'); g.advance(3); g.home.beginFree(); for (let i = 0; i < 8; i++) g.home.rig.pinch(0.5, g.home.pivot()); }
        document.getElementById('panel').style.transition = 'none';
        document.getElementById('toasts').innerHTML = '';   // (setting the slime's growth by hand shows a Grown-Up Ribbon toast)
      }, c);
      if (c.night) { await ev(() => document.documentElement.setAttribute('data-theme', 'dark')); await page.waitForTimeout(150); }
      await ev(() => window.slimekin.advance(3.5));
      await ev(() => { document.getElementById('toasts').innerHTML = ''; });
      const pre = await ev(() => { const g = window.slimekin; return { phase: g.state.phase, stage: g.sim.stage().name, world: g.home.world, cam: g.stage.camPos.toArray().map(v => +v.toFixed(2)), modal: g.hud.modalOpen, size: +g.slime.size.toFixed(2) }; });
      if (pre.phase !== 'play' || pre.modal) throw new Error('not ready for the goodbye: ' + JSON.stringify(pre));
      await installCheck();
      await ev(() => { window.slimekin.last = Infinity; window.__run = null; });   // the game's own loop held: the goodbye moves only as stepped here
      const nav = c.reload ? page.waitForNavigation({ waitUntil: 'commit', timeout: 120000 }) : null;
      await ev(kind => { const g = window.slimekin; if (kind === 'baby') g.rehome(null, g.sim.rehomeBuyer().id); else g.moveOut(null); g.hud.say(kind === 'baby' ? "Bye-bye! I'll write to you! ♥" : 'See you at the barn! ♥', 60000); }, c.kind);
      for (const tEnd of [...(FRAMES ? SHOTS : []), 4.15]) {
        for (;;) {
          if (tEnd > 2.2) await ev(() => window.slimekin.hud.say('', 1));
          const st = await runUntil(tEnd);
          if (st.pop !== undefined) { if (FRAMES) { await runUntil(st.pop + 0.1); await shoot(path.join(OUT, `${name}-pop.png`)); } continue; }
          break;
        }
        if (tEnd < 4.15) await shoot(path.join(OUT, `${name}-${tEnd.toFixed(2)}.png`));
      }
      const r = await ev(() => {
        const g = window.slimekin, R = window.__run, so = g.sendOff;
        return { shownAt: R.shownAt, endT: R.endT, info: so.info(), first: R.first, check: window.__check, slimeX: +g.slime.root.position.x.toFixed(2), visible: g.slime.root.visible,
          bubble: so.bubble.group.visible, popT: so.s && so.s.popT, maxY: Math.max(...R.W), low: R.low, cushion: 0.3 };
      });
      const i = r.info, C = r.check;
      log(name, JSON.stringify({ pre, end: i.step, why: i.why, at: r.endT, r: i.r, a: i.a, h: i.h, lift: +i.lift.toFixed(3), c: i.c, passes: i.passes, steps: C.steps, rays: C.rays }));
      expect(C.bad.length === 0 && C.rays > 0, `${name}: the bubble never meets anything drawn at home (${C.rays} rays over ${C.steps} steps)`, C.bad.length ? JSON.stringify(C.bad.slice(0, 4)) : '');
      expect(r.low >= r.cushion + 0.02, `${name}: the bubble never dips into the cushion (its bottom, wobble and all)`, `lowest ${r.low && r.low.toFixed(3)} over the cushion's top ${r.cushion}`);
      if (c.reduced) {
        expect(i.step === 'gone' && Math.abs(i.c[1] - (r.first ? r.first.c[1] : i.c[1])) < 1e-6 && !r.visible && !r.bubble && Math.abs(r.slimeX) < 1e-6, `${name}: Reduced motion: no float; the bubble forms, glows and fades out in place with the slime`, `${i.step} at ${r.endT} s, y ${i.c[1]}`);
      } else {
        expect((i.step === 'gone' && i.why === 'out') || (i.step === 'gone' && r.popT !== null) || i.step === 'pop', `${name}: it ${i.why === 'out' ? 'floats up and out of the picture' : 'pops in a burst of sparkles before it reaches ' + i.why} (at ${r.endT} s)`, `bubble r ${i.r}, last middle ${i.c.join(', ')}`);
        expect(r.endT !== null && r.endT <= 4.0, `${name}: gone before the white fade (4.2 s)`, String(r.endT));
        if (c.scene !== 'greenhouse' || c.view === 'front') expect(i.why === 'out', `${name}: the home camera (no roof in its picture) sees it float all the way out`, i.why);
        if (c.kind === 'baby') expect(i.c[0] > 0.25, `${name}: the baby drifts toward its new family's side (+x)`, `x ${i.c[0]}`);
        if (c.low) expect(r.first && r.first.passes === 1, `${name}: Low graphics: the bubble in one pass (as it floats)`, `passes ${r.first && r.first.passes}`);
        else expect(r.first && r.first.passes === 2, `${name}: High: the bubble's far side drawn too (two passes, as it floats)`, `passes ${r.first && r.first.passes}`);
      }
      if (c.reload) {
        await ev(() => { const g = window.slimekin; g.hud.say('', 1); g.last = performance.now(); g.advance(3); });
        await nav;
        await page.waitForFunction(() => window.slimekin && window.slimekin.state && document.getElementById('boot').hidden, null, { timeout: 120000 });
        await ev(() => window.slimekin.advance(2));
        const after = await ev(() => ({ phase: window.slimekin.state.phase, card: document.getElementById('modalCard').innerText.replace(/\s+/g, ' ') }));
        expect(after.phase === 'egg' && (c.kind === 'baby' ? /has a new home!/.test(after.card) : /is settling in at the barn/.test(after.card)),
          `${name}: then the white fade, the rule and the reload into the egg, as before`, after.card.slice(0, 160));
      }
      if (c.night) await ev(() => document.documentElement.setAttribute('data-theme', 'light'));
    }, 900000);
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
