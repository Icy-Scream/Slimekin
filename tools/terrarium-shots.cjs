// The terrarium room in the game (P4): HOME at 390 x 844 (the frames the captain judges, beside Usopp's P2 frames), with
// numbers. From tools/fixtures/barn/barn-six.json (Pebble, a hatchling): Playwright's clock paused (the game moves only
// when the script runs it), Math.random seeded, Reduced motion on (no sway), graphics High unless Low is asked for.
//   node tools/terrarium-shots.cjs [--dpr 2] [--only front,night,angles,classic,low,helpers] [--out DIR]
//   front    Front, day                                 front-day.png
//   night    Front, night (the blend run to its end)    front-night.png
//   p2cam    Front day and night through the camera of Usopp's P2 frames (his capture: the same room at the same
//            spot on the screen, for his calm-zone numbers and a like-for-like look)   p2cam-day.png, p2cam-night.png;
//            and each again without the slime (p2cam-day-noslime.png...): the difference is the game's own silhouette
//   angles   Wide, Left, Right, day                     wide-day.png, left-day.png, right-day.png
//   classic  Settings > Background > Classic, day       classic-day.png (the plain floor; none of the room)
//   low      Graphics Low, Front, night                 low-night.png (no cloche glass, no fireflies)
//   helpers  every helper at the most copies shown on High, day: Front, Wide, Left, Right   helpers-<view>.png
// numbers.json: the room's counts, draw calls and triangles per frame (three.js renderer.info: the slime's see-through
// pass included) with the menu objects, without them, and with them in the see-through pass too (as before the layer),
// which objects are in that pass, page errors. Screenshots: tools/out/terrarium-p4/ (or --out). Setup as in
// tools/smoke-test.cjs (playwright and three@0.170.0 through NODE_PATH); runs offline on its own server
// (tools/browser-kit.cjs). On the captain's PC: /root/projects/slimekin-notes/tools/pc-test.sh.
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DPR = +arg('dpr', 2);
const ONLY = String(arg('only', 'front,night,p2cam,angles,classic,low,helpers')).split(',');
const OUT = path.resolve(arg('out', path.join(__dirname, 'out', 'terrarium-p4')));
fs.mkdirSync(OUT, { recursive: true });
const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/barn/barn-six.json'), 'utf8')).save;
const T0 = Date.UTC(2026, 10, 11, 14, 0, 0);   // 14:00 (UTC on the test machines): the slime is awake
// the camera of Usopp's P2 HOME frames (slimekin-notes-usopp-t2 samples/terrarium-p2/masks/pebble_cam.json: Pebble at
// growth 48, a hatchling, 390 x 844; the frames' menu was a mock, shorter than the game's, so the game's own Front camera
// sits a little lower and nearer)
const P2CAM = { matrixWorld: [1, 0, 0, 0, 0, 0.9894570799517027, -0.1448264027498085, 0, 0, 0.1448264027498085, 0.9894570799517027, 0, 0, 2.761029044872625, 12.467766497693578, 1],
  fov: 30, aspect: 0.46208530805687204, near: 0.1, far: 120, offsetY: 2.3874061196981495 };
const HELPERS = { feather: 6, bubbles: 1, garden: 6, slimeling: 5, musicbox: 1, lamp: 6, fountain: 1, observatory: 1, spa: 1, rainbow: 1 };

(async () => {
  const errors = [], numbers = { dpr: DPR, shots: {} };
  let kit = null;
  watchdog(60, () => (kit ? kit.current() : 'setup'));
  try {
    kit = await setup({ contextOptions: { viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true } });
    const { page, context, step, ev } = kit;
    await context.clock.install({ time: T0 });
    await context.clock.pauseAt(T0 + 1000);
    await context.addInitScript(([save, t0]) => {
      let a = 0x2545f491;   // seeded Math.random (mulberry32): the same dice every run
      Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const light = () => document.documentElement && document.documentElement.setAttribute('data-theme', 'light');
      if (document.documentElement) light(); else document.addEventListener('DOMContentLoaded', light);
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const s = JSON.parse(JSON.stringify(save)), now = t0 + 1000;
      for (const x of s.ranch.residents) {
        if (x.trip) { x.trip.startAt = now - 600000; x.trip.homeAt = now + 3000000; }
        if (x.lesson) { x.lesson.startAt = now - 600000; x.lesson.doneAt = now + 7200000; }
      }
      s.savedAt = now - 60000; s.ranch.lastVisit = now;
      s.settings.reducedMotion = true; s.settings.quality = 'high'; s.settings.scene = 'greenhouse'; s.settings.camView = 'front';
      localStorage.setItem('slimekin.save.v1', JSON.stringify(s));
    }, [SAVE, T0]);
    // network: wait (real time, the clock paused) until the named files are in and nothing has been in flight for a while
    const inflight = new Set(), done = new Set();
    page.on('request', r => inflight.add(r));
    page.on('requestfinished', r => { inflight.delete(r); done.add(r.url().split('/').slice(-2).join('/')); });
    page.on('requestfailed', r => { inflight.delete(r); done.add('FAILED ' + r.url()); });
    const settleNet = async (names, ms = 180000) => {
      const t = Date.now();
      let quiet = 0;
      while (Date.now() - t < ms) {
        const have = names.every(n => [...done].some(d => d.endsWith(n)));
        quiet = have && inflight.size === 0 ? quiet + 1 : 0;
        if (quiet >= 6) return;
        await page.waitForTimeout(100);
      }
      throw new Error('files not in: ' + names.filter(n => ![...done].some(d => d.endsWith(n))).join(', '));
    };
    const run = ms => context.clock.runFor(ms);
    const runSlices = async (ms, slice = 250) => { for (let t = 0; t < ms; t += slice) await run(Math.min(slice, ms - t)); };
    const until = async (fn, maxMs, what, slice = 100) => {
      for (let t = 0; t <= maxMs; t += slice) { if (await ev(fn)) return t; await run(slice); }
      throw new Error('never: ' + what);
    };
    const frame = () => ev(() => {
      const g = window.slimekin, r = g.stage.renderer, i = r.info.render;
      g.stage.render();
      return { calls: i.calls, tris: i.triangles };
    });
    const shot = async name => {
      await runSlices(600);
      await page.waitForTimeout(400);   // real time: the compositor catches up (the game is paused)
      const file = path.join(OUT, name + '.png');
      await page.screenshot({ path: file, animations: 'disabled', caret: 'hide', timeout: 180000 });
      const info = await ev(() => { const g = window.slimekin, r = g.home.room; return { world: g.home.world, view: g.home.view, night: +r.night.toFixed(4), quality: r.quality, counts: r.counts() }; });
      numbers.shots[name] = { ...info, frame: await frame() };
      log('picture', name, JSON.stringify(numbers.shots[name]));
    };
    const night = async dark => {
      await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark);
      const t = await until(dark ? () => window.slimekin.home.room.night === 1 : () => window.slimekin.home.room.night === 0, 20000, 'the blend', 100);
      log(`the blend to ${dark ? 'night' : 'day'} landed after ${t} ms of game time`);
    };
    const view = async v => { await ev(w => window.slimekin.home.setView(w), v); await runSlices(1500); };

    await step('boot', async () => {
      await page.goto(`${kit.server.origin}/#debug`);
      await page.waitForSelector('#tab-heirlooms', { state: 'attached', timeout: 120000 });
      await run(50);   // first frames: the room is asked for
      // the room and its menu objects load (real time; the game's clock waits), then the loading screen goes
      await settleNet(['greenhouse/gh.bin', 'greenhouse/floor_night.jpg', 'greenhouse/tp_objects.json', 'greenhouse/tp_stake_night.jpg', 'greenhouse/tp_glow.png']);
      await until(() => !!window.slimekin && window.slimekin.home.world === 'greenhouse', 60000, 'the Greenhouse at home', 200);
      // no snack request or glimmer in the pictures (one may already be up if the room took a while: drop it as care.js does)
      // (clear() restarts the request timer, so the timer is pushed away after it)
      await ev(() => { const g = window.slimekin; if (g.requests.active) { g.requests.clear(); g.hud.hideAsk(); } g.requests.timer = 1e9; g.glimmerT = 1e9; });
      await runSlices(2500);
      await ev(() => window.slimekin.hud.closeModal());
      await runSlices(1500);
      const info = await ev(() => { const g = window.slimekin, r = g.home.room; return { roomMs: r.loadMs, menu: !!r.menu, world: g.home.world, phase: g.state.phase, quality: g.resolvedQuality() }; });
      log('booted', JSON.stringify(info));
      if (!info.menu) throw new Error('the menu objects did not load');
    }, 900000);

    if (ONLY.includes('front')) await step('front day', () => shot('front-day'), 300000);
    // draw calls: with the menu objects; without them; with them in the see-through pass as well (no layer)
    await step('draw calls', async () => {
      numbers.drawCalls = await ev(() => {
        const g = window.slimekin, r = g.home.room, i = g.stage.renderer.info.render, cam = g.stage.camera, out = {};
        const count = () => { g.stage.render(); return { calls: i.calls, tris: i.triangles }; };
        out.withObjects = count();
        r.menu.group.visible = false; out.withoutObjects = count(); r.menu.group.visible = true;
        const keep = r.sky.onBeforeRender, layers = r.menu.items.map(it => it.mesh.layers.mask);
        r.sky.onBeforeRender = () => {}; r.menu.items.forEach(it => it.mesh.layers.set(0)); out.objectsInSeeThroughToo = count();
        r.sky.onBeforeRender = keep; r.menu.items.forEach((it, k) => { it.mesh.layers.mask = layers[k]; }); cam.layers.enable(1);
        out.again = count();
        out.seeThrough = g.slime.mat.transmission > 0;
        out.inSeeThrough = r.menu.counts().inSeeThrough;
        return out;
      });
      log('draw calls', JSON.stringify(numbers.drawCalls));
    }, 300000);
    if (ONLY.includes('night')) await step('front night', async () => { await night(true); await shot('front-night'); await night(false); }, 400000);
    if (ONLY.includes('p2cam')) {
      await step('the P2 camera', async () => {
        // pinned at every render (the game sets its camera's offset and eases its fov each frame), the see-through
        // check rerun for it; put back afterwards
        await ev(c => {
          const g = window.slimekin, st = g.stage, cam = st.camera, keep = { fov: cam.fov, aspect: cam.aspect, near: cam.near, far: cam.far };
          st.p2keep = { render: st.render, keep };
          st.render = function () {
            const root = g.slime.root, shown = root.visible;
            if (st.p2keep.noSlime) root.visible = false;
            cam.matrix.fromArray(c.matrixWorld); cam.matrix.decompose(cam.position, cam.quaternion, cam.scale);
            cam.fov = c.fov; cam.aspect = c.aspect; cam.near = c.near; cam.far = c.far;
            cam.setViewOffset(390, 844, 0, c.offsetY, 390, 844);
            cam.updateMatrixWorld(true);
            if (g.home.room.menu) g.home.room.menu.seeThrough(cam, g.home.slimeBox());
            st.p2keep.render.call(st);
            root.visible = shown;
          };
        }, P2CAM);
        const noSlime = on => ev(o => { window.slimekin.stage.p2keep.noSlime = o; }, on);
        await shot('p2cam-day');
        await noSlime(true); await shot('p2cam-day-noslime'); await noSlime(false);
        await night(true);
        await shot('p2cam-night');
        await noSlime(true); await shot('p2cam-night-noslime'); await noSlime(false);
        await night(false);
        await ev(() => {
          const st = window.slimekin.stage, cam = st.camera;
          st.render = st.p2keep.render; Object.assign(cam, st.p2keep.keep); cam.updateProjectionMatrix(); delete st.p2keep;
        });
        await runSlices(1500);
      }, 600000);
    }
    if (ONLY.includes('angles')) {
      for (const v of ['wide', 'left', 'right']) await step(v, async () => { await view(v); await shot(v + '-day'); }, 300000);
      await step('back to front', () => view('front'), 120000);
    }
    if (ONLY.includes('classic')) {
      await step('classic', async () => {
        await ev(() => { const g = window.slimekin; g.state.settings.scene = 'classic'; g.applySettings(); });
        await runSlices(1500);
        await shot('classic-day');
        numbers.classic = await ev(() => { const g = window.slimekin; return { world: g.home.world, roomVisible: g.home.room.group.visible, habitat: g.stage.habitat.some(m => m.visible) }; });
        await ev(() => { const g = window.slimekin; g.state.settings.scene = 'greenhouse'; g.applySettings(); });
        await until(() => window.slimekin.home.world === 'greenhouse', 20000, 'back in the Greenhouse');
        await runSlices(1500);
      }, 300000);
    }
    if (ONLY.includes('low')) {
      await step('low', async () => {
        await ev(() => { const g = window.slimekin; g.state.settings.quality = 'low'; g.applySettings(); });
        await night(true);
        await shot('low-night');
        numbers.low = await ev(() => { const r = window.slimekin.home.room; return { cloches: r.cloches.map(c => c.visible), fireflies: r.fly.pts.visible, bulbsSteady: !!r.bulbs.flat, seeThrough: window.slimekin.slime.mat.transmission }; });
        await night(false);
        await ev(() => { const g = window.slimekin; g.state.settings.quality = 'high'; g.applySettings(); });
        await runSlices(1000);
      }, 400000);
    }
    if (ONLY.includes('helpers')) {
      await step('helpers', async () => {
        await ev(h => { const g = window.slimekin; Object.assign(g.state.helpers, h); g.helpers3d.sync(g.state.helpers); }, HELPERS);
        await runSlices(3000);
        for (const v of ['front', 'wide', 'left', 'right']) { await view(v); await shot('helpers-' + v); }
        await view('front');
      }, 600000);
    }
    errors.push(...kit.errors);
    kit.report();
  } catch (e) {
    errors.push(e.message.split('\n')[0]);
    if (kit) errors.push(...kit.errors);
  } finally {
    if (kit) await kit.close();
  }
  numbers.errors = errors;
  fs.writeFileSync(path.join(OUT, 'numbers.json'), JSON.stringify(numbers, null, 1));
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log(`\nOK: pictures and numbers.json in ${OUT}`);
})();
