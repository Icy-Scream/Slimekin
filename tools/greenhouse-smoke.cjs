// The Greenhouse in a headless phone (393 x 852): the room, the camera you can turn, and that nothing else changed.
//   node tools/greenhouse-smoke.cjs [--quick] [--only room,touch,sheet,settings,ranch,helpers,egg]
// From tools/fixtures/main-settled.json (an old save on main: it moves to the Greenhouse) and main-egg.json (a fresh egg):
//   room      the room loads with no page errors; the camera button steps Front, Wide, Left, Right (day and night)
//   touch     real touch events (CDP Input.dispatchTouchEvent): a one-finger drag on the background turns the camera, a
//             two-finger pinch zooms, the button then goes back to Front; a petting stroke and a boop on the slime, a
//             snack dragged to it, and the secret swipe code all still work in a turned camera
//   sheet     the menu sheet open in each set angle: the slime stays above it
//   settings  Settings > Background: Meadow, Classic, back to Greenhouse (the button hides outside the Greenhouse)
//   ranch     a ranch visit and back (the room hides at the ranch, the meadow shows; back home the room is back)
//   helpers   every helper at the most copies shown on High and on Low, day and night; each model's real size is
//             measured against its radius in GREENHOUSE.radius
//   egg       a fresh egg on the stump, tapped
// Screenshots: tools/out/greenhouse/. Runs offline on its own server (tools/browser-kit.cjs).
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const OUT = path.join(__dirname, 'out', 'greenhouse');
fs.mkdirSync(OUT, { recursive: true });
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : (process.argv.includes('--' + k) ? true : d); };
const QUICK = !!arg('quick', false);
const ONLY = String(arg('only', 'room,touch,sheet,settings,ranch,helpers,egg')).split(',');
const fixture = n => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8')).save;
const FIX = { settled: fixture('main-settled.json'), egg: fixture('main-egg.json') };

(async () => {
  const errors = [];
  const expect = (cond, what, detail = '') => { if (cond) log('ok', what); else { errors.push(what + (detail ? ': ' + detail : '')); log('FAIL', what, detail); } };
  let kit = null;
  watchdog(40, () => kit ? kit.current() : 'setup');
  try {
    kit = await setup({ contextOptions: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } });
    const { page, step, ev } = kit;
    page.setDefaultTimeout(120000);
    // the fixture for each page load: ?fx=egg or the settled save (once per tab)
    await kit.context.addInitScript(fx => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const which = new URLSearchParams(location.search).get('fx') || 'settled';
      localStorage.setItem('slimekin.save.v1', JSON.stringify({ ...fx[which], savedAt: Date.now() - 60000 }));
    }, FIX);
    const cdp = await kit.context.newCDPSession(page);
    const settle = async () => { for (let i = 0; i < 2; i++) { await page.waitForTimeout(200); await page.screenshot({ clip: { x: 0, y: 0, width: 8, height: 8 }, timeout: 120000 }); } };
    const setTheme = async dark => { await ev(d => { document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'); }, dark); await page.waitForTimeout(200); await ev(() => { const g = window.slimekin; g.home.room.setNight(g.stage.dark, true); g.advance(0.2); }); };
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
    }, 400000);
    // real touches: every event carries its own timestamp (seconds)
    const touch = (type, pts, ts) => cdp.send('Input.dispatchTouchEvent', { type, timestamp: ts, touchPoints: type === 'touchEnd' ? [] : pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
    const drag = async (path, { gap = 0.03 } = {}) => {
      const t0 = Date.now() / 1000;
      await touch('touchStart', [path[0]], t0);
      for (let i = 1; i < path.length; i++) await touch('touchMove', [path[i]], t0 + gap * i);
      await touch('touchEnd', [], t0 + gap * path.length + 0.02);
    };
    const line = (x0, y0, x1, y1, n = 8) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
    const tap = async (x, y) => { const t0 = Date.now() / 1000; await touch('touchStart', [[x, y]], t0); await touch('touchEnd', [], t0 + 0.06); };
    const boot = async (fx = '') => {
      await page.goto(`${kit.server.origin}/${fx ? '?fx=' + fx : ''}#debug`);
      await page.waitForFunction(() => window.slimekin && window.slimekin.state && window.slimekin.home, null, { timeout: 120000 });
      await page.waitForFunction(() => window.slimekin.home.room.ready || window.slimekin.home.room.failed, null, { timeout: 120000 });
      await ev(() => { const g = window.slimekin; g.behave.hour = () => 14; g.state.settings.quality = 'high'; g.applySettings(); g.hud.closeModal(); });
    };
    const calm = () => ev(() => { const g = window.slimekin; g.state.tutorial = 5; g.requests.timer = 1e9; g.glimmerT = 1e9; g.debug('needs'); if (g.sim.asleep) g.wakeUp('rested'); g.idleT = 1e9; g.hud.closeModal(); g.advance(0.5); });
    const cam = () => ev(() => { const g = window.slimekin, h = g.home, p = g.stage.camPos; return { view: h.view, free: h.free, saved: g.state.settings.camView, pos: [p.x, p.y, p.z].map(v => +v.toFixed(3)), fov: +g.stage.camera.fov.toFixed(2), rig: h.rig.free && { yaw: +h.rig.free.yaw.toFixed(4), pitch: +h.rig.free.pitch.toFixed(4), dist: +h.rig.free.dist.toFixed(4) }, btn: !document.getElementById('camBtn').hidden, btnView: document.getElementById('camBtn').dataset.view }; });
    const glide = () => ev(() => window.slimekin.advance(2.5));
    const slimeScreen = () => ev(() => { const g = window.slimekin, c = g.screenOf(g.slime.centerWorld(g.v1.clone())); const top = g.screenOf(g.slime.headTopWorld(g.v2.clone())); return { x: c.x, y: c.y, top: top.y }; });

    // ---------- room ----------
    if (ONLY.includes('room') || ONLY.includes('touch') || ONLY.includes('sheet') || ONLY.includes('settings') || ONLY.includes('ranch') || ONLY.includes('helpers')) {
      kit.mark('room');
      const t0 = Date.now();
      await step('open the game (old Meadow save)', () => boot(), 200000);
      const info = await ev(() => { const g = window.slimekin; return { scene: g.state.settings.scene, moved: g.state.settings.sceneMoved, world: g.home.world, counts: g.home.room.counts(), ready: g.home.room.ready, readyAt: Math.round(performance.now()) }; });
      expect(info.ready && info.world === 'greenhouse' && info.scene === 'greenhouse' && info.moved === true, 'the old save moved to the Greenhouse and the room loaded', JSON.stringify(info));
      log('room:', JSON.stringify(info.counts), `page start to room ready ${info.readyAt} ms (headless, loopback)`);
      await calm();
      const vis = await ev(() => { const g = window.slimekin; return { room: g.home.room.group.visible, meadow: g.scenery.group.visible, cushion: g.stage.habitat.some(m => m.visible), sky: g.stage.sky.visible, ranch: g.ranch.group.visible, raycast: (() => { let n = 0; g.home.room.group.traverse(o => { if ((o.isMesh || o.isSprite || o.isPoints) && o.raycast.toString().replace(/\s/g, '') !== '()=>{}') n++; }); return n; })() }; });
      expect(vis.room && !vis.meadow && !vis.cushion && !vis.sky && !vis.ranch, 'at home: the room shows; the meadow, the cushion, the sky and the ranch hill are hidden', JSON.stringify(vis));
      expect(vis.raycast === 0, 'nothing in the room is tappable (raycast off)', `${vis.raycast} tappable`);
      // the camera button steps the set angles
      const views = [];
      let c = await cam();
      expect(c.btn && c.view === 'front' && c.btnView === 'front', 'the camera button shows in the Greenhouse, on Front', JSON.stringify(c));
      const btn = await ev(() => { const r = document.getElementById('camBtn').getBoundingClientRect(), t = document.getElementById('tray').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, trayTop: t.top }; });
      expect(btn.w >= 44 && btn.h >= 44, `the button is a 44 x 44 target (${btn.w} x ${btn.h} at ${Math.round(btn.x)}, ${Math.round(btn.y)})`);
      for (const want of ONLY.includes('room') ? ['wide', 'left', 'right', 'front'] : []) {
        await page.click('#camBtn');
        await glide();
        c = await cam();
        views.push(c.view);
        expect(c.view === want && c.saved === want && !c.free, `the button steps to ${want} (saved in settings.camView)`, JSON.stringify(c));
        const s = await slimeScreen();
        expect(s.y > btn.y + btn.h && s.y < btn.trayTop, `${want}: the slime is between the button and the tray`, JSON.stringify(s));
        await shot(`room-${want}`);
      }
      log('render (High quality):', JSON.stringify(await ev(() => { const g = window.slimekin; g.stage.render(); const i = g.stage.renderer.info.render; return { tris: i.triangles, calls: i.calls }; })));
    }

    // ---------- touch ----------
    if (ONLY.includes('touch')) {
      kit.mark('touch');
      await calm();
      // empty background: left of the slime, under the button
      const bg = [60, 520];
      const before = await cam();
      await step('one-finger drag on the background', () => drag(line(bg[0], bg[1], bg[0] + 150, bg[1] - 60, 10)));
      await ev(() => window.slimekin.advance(0.6));
      let c = await cam();
      expect(c.free && c.btnView === 'free' && c.rig && Math.abs(c.rig.yaw) > 0.2, 'a one-finger drag turns the camera (the button shows it is off the set angles)', JSON.stringify(c));
      expect(JSON.stringify(c.pos) !== JSON.stringify(before.pos), 'the camera moved', `${before.pos} -> ${c.pos}`);
      await shot('touch-turned', { night: false });
      const d0 = c.rig.dist;
      await step('two-finger pinch', async () => {
        const t0 = Date.now() / 1000;
        // the first finger on the background (left edge), the second anywhere (here on the slime): a pinch, no boop
        const boops = await ev(() => window.slimekin.state.stats.boops);
        await touch('touchStart', [[40, 330]], t0);
        await touch('touchStart', [[40, 330], [200, 420]], t0 + 0.02);
        for (let i = 1; i <= 8; i++) await touch('touchMove', [[40, 330 - i * 12], [200 + i * 8, 420 + i * 12]], t0 + 0.02 + i * 0.03);
        await touch('touchEnd', [], t0 + 0.4);
        expect(await ev(() => window.slimekin.state.stats.boops) === boops, 'the pinch\'s second finger on the slime does not boop it');
      });
      await ev(() => window.slimekin.advance(0.6));
      c = await cam();
      expect(c.rig && c.rig.dist < d0 - 0.2, `fingers apart zoom in (distance ${d0} -> ${c.rig && c.rig.dist})`);
      const lim = await ev(() => { const g = window.slimekin, h = g.home, p = h.rig.pose(h.pivot()); return { e: h.rig.excess(h.rig.free, h.pivot()), pos: p.pos }; });
      expect(lim.e.every((v, i) => v <= 1e-6 || (i === 3)), 'the turned camera is inside the limits', JSON.stringify(lim));
      await shot('touch-pinched', { night: false });
      // the swipe code on the background still counts (up up down down left right left right tap tap)
      await step('the secret swipe code', async () => {
        const [x, y] = [70, 560];
        const sw = { up: [0, -80], down: [0, 80], left: [-80, 0], right: [80, 0] };
        for (const d of ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right']) await drag(line(x, y, x + sw[d][0], y + sw[d][1], 4), { gap: 0.02 });
        await tap(x, y); await tap(x, y);
      });
      await ev(() => window.slimekin.advance(0.3));
      const rain = await ev(() => ({ secrets: window.slimekin.state.secrets, rainbow: window.slimekin.behave.rainbowUntil > window.slimekin.behave.time }));
      expect(rain.secrets.includes('rainbow') || rain.rainbow, 'the secret swipe code still makes a rainbow in a turned camera', JSON.stringify(rain));
      await ev(() => window.slimekin.hud.closeModal());
      await calm();
      // a boop
      let s = await slimeScreen();
      const boops0 = await ev(() => window.slimekin.state.stats.boops);
      await tap(s.x + 10, s.y - 10);
      await ev(() => window.slimekin.advance(0.3));
      const boops1 = await ev(() => window.slimekin.state.stats.boops);
      expect(boops1 === boops0 + 1, `a tap on the slime still boops it (${boops0} -> ${boops1})`);
      // a petting stroke
      await ev(() => window.slimekin.advance(1));
      s = await slimeScreen();
      const pet0 = await ev(() => window.slimekin.state.stats.petTime);
      await step('a petting stroke on the slime', async () => {
        let t = Date.now() / 1000;
        await touch('touchStart', [[s.x - 40, s.y]], t);
        for (let k = 0; k < 6; k++) {
          for (let i = 1; i <= 6; i++) { t += 0.03; await touch('touchMove', [[s.x - 40 + (k % 2 ? 6 - i : i) * 14, s.y + Math.sin(i) * 4]], t); }
          await ev(() => window.slimekin.advance(0.15));
        }
        await touch('touchEnd', [], t + 0.05);
      });
      const pet1 = await ev(() => window.slimekin.state.stats.petTime);
      expect(pet1 > pet0, `stroking the slime still pets it (pet time ${pet0.toFixed(2)} -> ${pet1.toFixed(2)})`);
      // a snack dragged to the slime
      await ev(() => { const g = window.slimekin; g.state.slime.tummy = 30; g.state.jelly = Math.max(g.state.jelly, 1e9); g.advance(0.5); });
      const food = await ev(() => { const r = document.getElementById('food-cookie').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      s = await slimeScreen();
      const feeds0 = await ev(() => window.slimekin.state.stats.feeds);
      await step('drag a snack to the slime', () => drag(line(food.x, food.y, s.x, s.y, 12), { gap: 0.03 }));
      await ev(() => window.slimekin.advance(2.5));
      const feeds1 = await ev(() => window.slimekin.state.stats.feeds);
      expect(feeds1 === feeds0 + 1, `a snack dragged onto the slime is eaten (feeds ${feeds0} -> ${feeds1})`);
      // back to the front view from a turned camera
      await page.click('#camBtn');
      await glide();
      c = await cam();
      expect(!c.free && c.view === 'front' && c.btnView === 'front', 'after turning it, the button goes back to Front', JSON.stringify(c));
      // a reload remembers the set angle, not the turn
      await page.click('#camBtn');   // wide
      await ev(() => window.slimekin.saveNow(true));
      await step('reload', () => boot(), 200000);
      c = await cam();
      expect(c.view === 'wide' && !c.free, 'after a reload the camera is on the last set angle (Wide)', JSON.stringify(c));
      await ev(() => { window.slimekin.home.setView('front'); window.slimekin.advance(2); });
      await calm();
    }

    // ---------- the menu sheet in each angle ----------
    if (ONLY.includes('sheet')) {
      kit.mark('sheet');
      await calm();
      for (const v of ['front', 'wide', 'left', 'right']) {
        await ev(v => { const g = window.slimekin; g.home.setView(v); g.advance(2.5); }, v);
        await page.click('#tab-shop');
        await settle();
        await ev(() => window.slimekin.advance(2));
        await settle();
        const s = await slimeScreen();
        const panelTop = await ev(() => document.getElementById('panel').getBoundingClientRect().top);
        const btnOn = await ev(() => !document.getElementById('camBtn').hidden);
        expect(s.y < panelTop - 20 && s.top > 60, `${v}, menu open: the slime stays above the sheet (center ${Math.round(s.y)}, head ${Math.round(s.top)}, sheet top ${Math.round(panelTop)})`);
        expect(btnOn, `${v}, menu open: the camera button still shows`);
        await shot(`sheet-${v}`, { night: false });
        await ev(() => { window.slimekin.hud.setSheet('closed'); window.slimekin.advance(1); });
        await settle();
      }
      await ev(() => { window.slimekin.home.setView('front'); window.slimekin.advance(2); });
    }

    // ---------- settings ----------
    if (ONLY.includes('settings')) {
      kit.mark('settings');
      for (const [scene, label] of [['meadow', 'Meadow'], ['classic', 'Classic'], ['greenhouse', 'Greenhouse']]) {
        await ev(() => window.slimekin.openSettings());
        await settle();
        await page.click(`.seg button[data-k="scene"][data-v="${scene}"]`);
        await page.click('#setDone');
        await ev(() => window.slimekin.advance(2.5));
        const w = await ev(() => { const g = window.slimekin; return { scene: g.state.settings.scene, world: g.home.world, room: g.home.room.group.visible, meadow: g.scenery.group.visible, cushion: g.stage.habitat[2].visible, btn: !document.getElementById('camBtn').hidden, cam: g.stage.cam, layout: g.helpers3d.layout }; });
        const good = scene === 'greenhouse' ? w.room && !w.meadow && !w.cushion && w.btn && w.layout === 'greenhouse'
          : scene === 'meadow' ? !w.room && w.meadow && w.cushion && !w.btn && w.cam === null && w.layout === 'meadow'
            : !w.room && !w.meadow && w.cushion && !w.btn && w.cam === null && w.layout === 'meadow';
        expect(w.scene === scene && w.world === scene && good, `Settings > Background > ${label}`, JSON.stringify(w));
        await shot(`settings-${scene}`, { night: false });
      }
    }

    // ---------- ranch ----------
    if (ONLY.includes('ranch')) {
      kit.mark('ranch');
      await ev(() => { const g = window.slimekin; g.home.setView('wide'); g.advance(2); });
      await page.click('#tab-ranch');
      await ev(() => window.slimekin.advance(4));
      let w = await ev(() => { const g = window.slimekin; return { view: g.view, room: g.home.room.group.visible, meadow: g.scenery.group.visible, ranch: g.ranch.group.visible, helpers: g.helpers3d.group.visible, btn: !document.getElementById('camBtn').hidden }; });
      expect(w.view === 'ranch' && !w.room && w.meadow && w.ranch && !w.btn, 'at the ranch: the room hides, the meadow and the ranch show, no camera button', JSON.stringify(w));
      await shot('ranch-visit', { night: false });
      await page.click('#ranchHome');
      await ev(() => window.slimekin.advance(4));
      w = await ev(() => { const g = window.slimekin; return { view: g.view, room: g.home.room.group.visible, meadow: g.scenery.group.visible, ranch: g.ranch.group.visible, btn: !document.getElementById('camBtn').hidden, camView: g.home.view }; });
      expect(w.view === 'home' && w.room && !w.meadow && !w.ranch && w.btn && w.camView === 'wide', 'back home: the room is back, on the same angle (Wide)', JSON.stringify(w));
      await shot('ranch-back', { night: false });
      await ev(() => { const g = window.slimekin; g.home.setView('front'); g.advance(2); });
    }

    // ---------- helpers ----------
    if (ONLY.includes('helpers')) {
      kit.mark('helpers');
      await calm();
      const sizes = await ev(async () => {
        const g = window.slimekin, THREE = await import('three');
        Object.assign(g.state.helpers, { feather: 12, bubbles: 3, garden: 12, slimeling: 12, musicbox: 1, lamp: 12, fountain: 1, observatory: 1, spa: 1, rainbow: 1 });
        g.helpers3d.sync(g.state.helpers);
        g.advance(2);
        const { GREENHOUSE } = await import('/src/data/content.js');
        const h = g.helpers3d, out = {}, box = new THREE.Box3(), R = GREENHOUSE.radius;
        const measure = (o, key) => { o.updateMatrixWorld(true); box.setFromObject(o); const p = o.position; const r = Math.max(p.x - box.min.x, box.max.x - p.x, p.z - box.min.z, box.max.z - p.z); out[key] = { r: +r.toFixed(3), limit: R[key], minY: +(box.min.y - g.home.groundY(p.x, p.z)).toFixed(3) }; };
        for (const id of ['bubbles', 'musicbox', 'fountain', 'observatory', 'spa']) measure(h.singles[id], id);
        measure(h.planters[0].obj, 'planter');
        measure(h.lamps[0].obj, 'lamp');
        measure(h.slimelings[0].obj, 'slimeling');
        return { out, counts: { planters: h.planters.length, lamps: h.lamps.length, pals: h.slimelings.length, feathers: h.feathers.length } };
      });
      log('helpers shown (High):', JSON.stringify(sizes.counts));
      for (const [k, v] of Object.entries(sizes.out)) {
        // a pal hops, so its real width is checked at rest; the lamp's hook overhangs at post height only
        expect(v.r <= v.limit + 0.02, `${k}: its model fits its radius in GREENHOUSE.radius (${v.r} <= ${v.limit})`);
        expect(v.minY > -0.12 && v.minY < 0.08, `${k}: stands on the floor (bottom ${v.minY} from the ground)`);
      }
      const pals = await ev(() => { const g = window.slimekin; g.advance(12); return g.helpers3d.slimelings.map(s => ({ x: +s.obj.position.x.toFixed(2), z: +s.obj.position.z.toFixed(2), y: +(s.obj.position.y - g.home.groundY(s.obj.position.x, s.obj.position.z)).toFixed(3), r: +Math.hypot(s.obj.position.x, s.obj.position.z).toFixed(2), hop: s.hopping })); });
      expect(pals.every(p => p.r >= 1.84 || p.hop), 'after 12 s of hopping, no pal is on the stump', JSON.stringify(pals));
      for (const v of ['front', 'wide', 'left', 'right']) {
        await ev(v => { const g = window.slimekin; g.home.setView(v); g.advance(2.5); }, v);
        await shot(`helpers-high-${v}`);
      }
      log('render with every helper (High):', JSON.stringify(await ev(() => { const g = window.slimekin; g.stage.render(); const i = g.stage.renderer.info.render; return { tris: i.triangles, calls: i.calls }; })));
      await ev(() => { const g = window.slimekin; g.state.settings.quality = 'low'; g.applySettings(); g.advance(2); });
      const low = await ev(() => { const h = window.slimekin.helpers3d; return { planters: h.planters.length, lamps: h.lamps.length, pals: h.slimelings.length, feathers: h.feathers.length }; });
      log('helpers shown (Low):', JSON.stringify(low));
      for (const v of ['front', 'wide']) {
        await ev(v => { const g = window.slimekin; g.home.setView(v); g.advance(2.5); }, v);
        await shot(`helpers-low-${v}`, { night: false });
      }
      log('render with every helper (Low):', JSON.stringify(await ev(() => { const g = window.slimekin; g.stage.render(); const i = g.stage.renderer.info.render; return { tris: i.triangles, calls: i.calls }; })));
      await ev(() => { const g = window.slimekin; g.state.settings.quality = 'high'; g.applySettings(); g.home.setView('front'); g.advance(2); });
    }

    // ---------- egg ----------
    if (ONLY.includes('egg')) {
      kit.mark('egg');
      const p2 = await kit.context.newPage();
      p2.on('pageerror', e => errors.push('pageerror (egg page): ' + e.message));
      await page.close();
      kit.page = p2;
      const ev2 = (fn, a) => p2.evaluate(fn, a);
      await step('open a fresh egg', async () => {
        await p2.goto(`${kit.server.origin}/?fx=egg#debug`);
        await p2.waitForFunction(() => window.slimekin && window.slimekin.egg && window.slimekin.home && (window.slimekin.home.room.ready || window.slimekin.home.room.failed), null, { timeout: 120000 });
      }, 200000);
      const e = await ev2(() => { const g = window.slimekin; g.advance(1); return { phase: g.state.phase, world: g.home.world, y: g.egg.group.position.y, warmth: g.state.egg.warmth, btn: !document.getElementById('camBtn').hidden }; });
      expect(e.phase === 'egg' && e.world === 'greenhouse' && Math.abs(e.y - 0.27) < 0.01, 'a fresh egg sits on the stump in the Greenhouse', JSON.stringify(e));
      expect(e.btn, 'the camera button shows while the egg waits');
      const cdp2 = await kit.context.newCDPSession(p2);
      const eg = await ev2(() => { const g = window.slimekin, c = g.screenOf(g.egg.group.position.clone().add(new g.v1.constructor(0, 0.5, 0))); return c; });
      const t0 = Date.now() / 1000;
      await cdp2.send('Input.dispatchTouchEvent', { type: 'touchStart', timestamp: t0, touchPoints: [{ x: eg.x, y: eg.y, id: 1 }] });
      await cdp2.send('Input.dispatchTouchEvent', { type: 'touchEnd', timestamp: t0 + 0.06, touchPoints: [] });
      const w = await ev2(() => { window.slimekin.advance(0.3); return window.slimekin.state.egg.warmth; });
      expect(w > e.warmth, `a tap on the egg warms it (${e.warmth} -> ${w})`);
      for (const dark of QUICK ? [false] : [false, true]) {
        await ev2(d => { document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'); }, dark);
        await p2.waitForTimeout(200);
        await ev2(() => { const g = window.slimekin; g.home.room.setNight(g.stage.dark, true); g.advance(0.5); });
        for (let i = 0; i < 2; i++) { await p2.waitForTimeout(250); await p2.screenshot({ path: path.join(OUT, `egg-${dark ? 'night' : 'day'}.png`) }); }
      }
      log('screenshot egg');
    }
  } catch (e) {
    errors.push('test error: ' + e.message);
  } finally {
    if (kit) { errors.unshift(...kit.errors); kit.report(); await kit.close(); }
  }
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
