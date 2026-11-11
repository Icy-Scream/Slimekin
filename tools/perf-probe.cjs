// What a frame costs at home in the Greenhouse (terrarium-perf): draw calls and triangles per pass, and frame times,
// for each graphics quality, camera angle and time of day. Same save, dice and view as tools/terrarium-shots.cjs
// (tools/fixtures/barn/barn-six.json: Pebble, a hatchling; snack requests and glimmers off).
//   node tools/perf-probe.cjs [--dpr 3] [--cpu 1] [--frames 90] [--live 0] [--helpers 0]
//                             [--only high,auto1,low] [--views front,wide] [--times day,night] [--out FILE.json]
//   --dpr     the phone's device pixel ratio (the game caps it: High 2, Auto 2 then 1.5 / 1, Low 1)
//   --cpu     Chromium's CPU slow-down (CDP Emulation.setCPUThrottlingRate; 4-6 stands in for a phone's CPU). It slows
//             the page's JavaScript only, not the GPU.
//   --frames  frames per measurement; --live S: also S seconds of the game's own loop (rAF) per case: fps, late frames
//             and what Auto did
//   --raf30 1: frame callbacks at 30 a second (Safari in Low Power Mode); --profile N / --spikes N: where the time goes
//   --look DIR: each case's frame drawn as before terrarium-perf and as now (see look() below)
//   --helpers 1: every helper at the most copies shown (as terrarium-shots' helpers pictures)
// Per case: calls and triangles of one frame, split into the see-through pass (rt: the slime's transmission buffer) and
// the picture (main); cpu = ms of JavaScript per frame (the game's update(): world, draw calls, overlay); gpu = ms the GPU
// spent on that frame (WebGL timer queries, where the browser has them); sync = ms per frame with the GPU waited for after
// each frame (cpu + gpu + the wait; the slow upper bound); thru = ms per frame of N frames back to back (what a steady
// stream of frames costs). Medians and 90th percentiles. Prints a table; writes the numbers to --out.
// SLIMEKIN_ROOT=<folder> measures another copy of the game (tools/browser-kit.cjs), e.g. the code before a change.
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DPR = +arg('dpr', 3), CPU = +arg('cpu', 1), FRAMES = +arg('frames', 90), LIVE = +arg('live', 0), HELP = +arg('helpers', 0), PROFILE = +arg('profile', 0), SPIKES = +arg('spikes', 0), RAF30 = +arg('raf30', 0), LOOK = arg('look', null);
const QUALS = String(arg('only', 'high,auto1,low')).split(',');
const VIEWS = String(arg('views', 'front,wide')).split(',');
const TIMES = String(arg('times', 'day,night')).split(',');
const OUT = path.resolve(arg('out', path.join(__dirname, 'out', 'perf-probe.json')));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/barn/barn-six.json'), 'utf8')).save;
// --variants: experiments on top of each case (apply, undo), to tell what a frame's cost is made of
const VARIANTS = String(arg('variants', 'base')).split(',');
const ROOM = 'g.home.room.group.children.filter(m => m.isMesh && m.material.uniforms && m.material.uniforms.uNight && !m.material.transparent && m !== g.home.room.sky)';
const VARIANT = {
  base: ['', ''],
  noslime: ['g.slime.root.visible = false;', 'g.slime.root.visible = true;'],                     // no slime: no see-through pass
  noroom: [`${ROOM}.forEach(m => { m.visible = false; });`, `${ROOM}.forEach(m => { m.visible = true; });`],
  rtnoroom: [`${ROOM}.forEach(m => m.layers.set(1));`, `${ROOM}.forEach(m => m.layers.set(0));`],   // the room left out of the see-through pass
  // the see-through buffer at half its size (three.js sizes it from camera.viewport when there is one)
  rthalf: ['const T = await import("three"), gl = g.stage.renderer.getContext(); g.stage.camera.viewport = new T.Vector4(0, 0, Math.round(gl.drawingBufferWidth / 2), Math.round(gl.drawingBufferHeight / 2));',
    'delete g.stage.camera.viewport;'],
};
const HELPERS = { feather: 6, bubbles: 1, garden: 6, slimeling: 5, musicbox: 1, lamp: 6, fountain: 1, observatory: 1, spa: 1, rainbow: 1 };

(async () => {
  const errors = [], out = { dpr: DPR, cpu: CPU, frames: FRAMES, root: process.env.SLIMEKIN_ROOT || null, cases: [] };
  let kit = null;
  watchdog(90, () => (kit ? kit.current() : 'setup'));
  try {
    kit = await setup({ contextOptions: { viewport: { width: 393, height: 852 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true } });
    const { page, context, step, ev } = kit;
    // --raf30 1: the browser's frame callbacks at 30 a second (as Safari gives them in Low Power Mode)
    if (RAF30) await context.addInitScript(() => { const r0 = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => r0(() => r0(cb)); });
    await context.addInitScript(save => {
      let a = 0x2545f491;   // seeded Math.random (mulberry32)
      Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      // the game's loop can be held (the probe runs frames itself) and let go again
      const raf = window.requestAnimationFrame.bind(window);
      window.__held = [];
      window.requestAnimationFrame = cb => raf(t => { if (window.__hold) window.__held.push(cb); else cb(t); });
      window.__release = () => { window.__hold = false; const q = window.__held; window.__held = []; for (const cb of q) raf(cb); };
      const light = () => document.documentElement && document.documentElement.setAttribute('data-theme', 'light');
      if (document.documentElement) light(); else document.addEventListener('DOMContentLoaded', light);
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const s = JSON.parse(JSON.stringify(save)), now = Date.now();
      for (const x of s.ranch.residents) {
        if (x.trip) { x.trip.startAt = now - 600000; x.trip.homeAt = now + 3000000; }
        if (x.lesson) { x.lesson.startAt = now - 600000; x.lesson.doneAt = now + 7200000; }
      }
      s.savedAt = now - 60000; s.ranch.lastVisit = now;
      s.settings.reducedMotion = true; s.settings.quality = 'high'; s.settings.scene = 'greenhouse'; s.settings.camView = 'front';
      localStorage.setItem('slimekin.save.v1', JSON.stringify(s));
    }, SAVE);

    await step('boot', async () => {
      await page.goto(`${kit.server.origin}/#debug`);
      await page.waitForFunction(() => window.slimekin && window.slimekin.home.room.ready && window.slimekin.home.world === 'greenhouse', null, { timeout: 600000, polling: 500 });
      await ev(() => { const g = window.slimekin; if (g.requests.active) { g.requests.clear(); g.hud.hideAsk(); } g.requests.timer = 1e9; g.glimmerT = 1e9; });
      await page.waitForTimeout(3000);
      await ev(() => window.slimekin.hud.closeModal());
      await ev(() => { document.getElementById('bubbleLayer').style.visibility = 'hidden'; });
      await page.waitForTimeout(2000);
      out.gpuTimer = await ev(() => !!window.slimekin.stage.renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2'));
      out.renderer = await ev(() => { const gl = window.slimekin.stage.renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
      log('booted; GPU timer queries:', out.gpuTimer, '; renderer:', out.renderer);
      if (HELP) {
        await ev(h => { const g = window.slimekin; Object.assign(g.state.helpers, h); g.helpers3d.sync(g.state.helpers); }, HELPERS);
        await page.waitForTimeout(3000);
      }
    }, 900000);

    if (CPU > 1) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
      log(`CPU slowed down ${CPU}x`);
    }

    // one frame's draws, split by pass; then the timings. Runs inside the page with the game's loop held.
    const measure = (n) => ev(async n => {
      const g = window.slimekin, rd = g.stage.renderer, gl = rd.getContext(), info = rd.info.render;
      const now = () => performance.now();
      const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); };
      // draws per pass
      const per = { rt: { calls: 0, tris: 0 }, main: { calls: 0, tris: 0 } }, keep = rd.renderBufferDirect;
      rd.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
        const c0 = info.calls, t0 = info.triangles, r = keep.apply(this, arguments), p = rd.getRenderTarget() === null ? per.main : per.rt;
        p.calls += info.calls - c0; p.tris += info.triangles - t0;
        return r;
      };
      g.update(1 / 60);
      rd.renderBufferDirect = keep;
      const counts = { calls: info.calls, tris: info.triangles, rt: per.rt, main: per.main, dpr: rd.getPixelRatio(),
        size: [gl.drawingBufferWidth, gl.drawingBufferHeight] };
      const px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let i = 0; i < 20; i++) g.update(1 / 60);   // warm up
      sync();
      // cpu (and gpu by timer query)
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), cpu = [], queries = [];
      for (let i = 0; i < n; i++) {
        let qq = null;
        if (ext) { qq = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, qq); }
        const t = now();
        g.update(1 / 60);
        cpu.push(now() - t);
        if (ext) { gl.endQuery(ext.TIME_ELAPSED_EXT); queries.push(qq); }
        if (ext && i % 10 === 9) await new Promise(r => setTimeout(r, 0));   // let query results come in
      }
      sync();
      let gpu = [];
      if (ext) {
        for (let k = 0; k < 60 && queries.some(x => !gl.getQueryParameter(x, gl.QUERY_RESULT_AVAILABLE)); k++) await new Promise(r => setTimeout(r, 16));
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu = queries.filter(x => gl.getQueryParameter(x, gl.QUERY_RESULT_AVAILABLE)).map(x => gl.getQueryParameter(x, gl.QUERY_RESULT) / 1e6);
        queries.forEach(x => gl.deleteQuery(x));
      }
      // sync: the GPU waited for after every frame
      const sy = [];
      for (let i = 0; i < Math.min(n, 40); i++) { const t = now(); g.update(1 / 60); sync(); sy.push(now() - t); }
      // thru: back to back, one wait at the end
      const m = Math.min(n, 60), t0 = now();
      for (let i = 0; i < m; i++) g.update(1 / 60);
      sync();
      const thru = (now() - t0) / m;
      return { counts, cpu: { med: q(cpu, 0.5), p90: q(cpu, 0.9) }, gpu: gpu.length ? { med: q(gpu, 0.5), p90: q(gpu, 0.9), n: gpu.length } : null,
        sync: { med: q(sy, 0.5), p90: q(sy, 0.9) }, thru: +thru.toFixed(2) };
    }, n, 900000);

    const setCase = (qual, view, time) => ev(async ([qual, view, time]) => {
      const g = window.slimekin;
      window.__release();
      g.state.settings.quality = qual === 'auto1' ? 'auto' : qual;
      g.perf.level = qual === 'auto1' ? 1 : 0;
      g.applySettings();
      g.home.setView(view);
      document.documentElement.setAttribute('data-theme', time === 'night' ? 'dark' : 'light');
      // the blend and the camera's glide run their course
      const t0 = performance.now();
      while (performance.now() - t0 < 60000) {
        await new Promise(r => setTimeout(r, 200));
        const r = g.home.room, st = g.stage;
        if (r.night === (time === 'night' ? 1 : 0) && performance.now() - t0 > 2500) break;
        void st;
      }
      window.__hold = true;
      await new Promise(r => setTimeout(r, 100));
      return { quality: g.resolvedQuality(), level: g.perf.level, night: g.home.room.night, view: g.home.view };
    }, [qual, view, time], 120000);

    // the game's own loop for a while: what a player would see (rAF cadence, late frames, Auto's steps)
    const live = (sec) => ev(async sec => {
      const g = window.slimekin, gaps = [], works = [], levels = [];
      const keepTrack = g.trackSpeed;
      g.trackSpeed = function (gap, target, work) { gaps.push(gap); works.push(work); const r = keepTrack.call(this, gap, target, work); levels.push(this.perf.level); return r; };
      Object.assign(g.perf, { t: 0, frames: 0, slow: 0, work: 0, bad: 0, settle: 2, steps: [] });   // (as at a start)
      window.__release();
      const t0 = performance.now();
      while (performance.now() - t0 < sec * 1000) { g.lastInteract = g.time; await new Promise(r => setTimeout(r, 250)); }
      window.__hold = true;
      g.trackSpeed = keepTrack;
      const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2) : null; };
      const late = gaps.filter(x => x > 16.7 * 1.5 + 4).length;
      return { frames: gaps.length, fps: +(gaps.length / sec).toFixed(1), gap: { med: q(gaps, 0.5), p90: q(gaps, 0.9) }, work: { med: q(works, 0.5), p90: q(works, 0.9) },
        lateShare: +(late / Math.max(1, gaps.length)).toFixed(2), levelEnd: g.perf.level, levelMax: Math.max(0, ...levels), quality: g.resolvedQuality(),
        beat: g.perf.beat ? +g.perf.beat.toFixed(1) : null, steps: g.perf.steps || null };
    }, sec, sec * 1000 + 120000);

    // where the JavaScript time goes: a CPU profile of n frames run back to back (CDP Profiler), self time per function
    const profile = async n => {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
      await cdp.send('Profiler.start');
      await ev(n => { const g = window.slimekin; for (let i = 0; i < n; i++) g.update(1 / 60); }, n, 600000);
      const { profile: p } = await cdp.send('Profiler.stop');
      await cdp.detach();
      const byId = new Map(p.nodes.map(x => [x.id, x])), self = new Map(), incl = new Map(), parent = new Map();
      for (const x of p.nodes) for (const c of x.children || []) parent.set(c, x.id);
      const dt = p.timeDeltas, total = (p.endTime - p.startTime) / 1000;
      const key = f => `${f.functionName || '(anon)'} ${(f.url || '').split('/').slice(-2).join('/')}:${f.lineNumber + 1}`;
      p.samples.forEach((id, i) => {
        const ms = (dt[i] || 0) / 1000, k = key(byId.get(id).callFrame);
        self.set(k, (self.get(k) || 0) + ms);
        const seen = new Set();
        for (let n = id; n !== undefined; n = parent.get(n)) { const kk = key(byId.get(n).callFrame); if (!seen.has(kk)) { seen.add(kk); incl.set(kk, (incl.get(kk) || 0) + ms); } }
      });
      const topOf = m => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 45).map(([k, v]) => [k, +(v / n).toFixed(3)]);
      return { frames: n, msPerFrame: +(total / n).toFixed(2), self: topOf(self), inclusive: topOf(incl) };
    };

    // which parts of a frame make the slow frames slow: per-frame time of the game's main parts (wrapped for the run)
    const spikes = n => ev(n => {
      const g = window.slimekin, parts = {
        'slime.update': [g.slime, 'update'], 'slime.deform': [g.slime, 'deform'], 'face.draw': [g.slime.face || {}, 'draw'], 'ranch.update': [g.ranch, 'update'],
        'helpers3d.update': [g.helpers3d, 'update'], 'home.update': [g.home, 'update'], 'room.update': [g.home.room, 'update'], 'barnRanch.update': [g.barnRanch, 'update'],
        'hud.update': [g.hud, 'update'], 'stage.render': [g.stage, 'render'], 'updateOverlay': [g, 'updateOverlay'], 'fx.update': [g.fx, 'update'],
        'behave.update': [g.behave, 'update'], 'scenery.update': [g.scenery, 'update'], 'syncNursery': [g, 'syncNursery'], 'updateFood': [g, 'updateFood'],
        'computeExpression': [g, 'computeExpression'], 'contestShow.update': [g.contestShow, 'update'], 'slimeBox': [g.home, 'slimeBox'], 'updateRequests': [g, 'updateRequests'],
      };
      const acc = {}, keep = [];
      for (const [k, [o, m]] of Object.entries(parts)) {
        if (!o || typeof o[m] !== 'function') continue;
        const f = o[m], own = Object.prototype.hasOwnProperty.call(o, m);
        keep.push([o, m, f, own]);
        o[m] = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { acc[k] = (acc[k] || 0) + performance.now() - t; } };
      }
      const frames = [];
      for (let i = 0; i < n; i++) {
        for (const k in acc) acc[k] = 0;
        const t = performance.now();
        g.update(1 / 60);
        frames.push({ ms: performance.now() - t, parts: { ...acc } });
      }
      for (const [o, m, f, own] of keep) { if (own) o[m] = f; else delete o[m]; }
      const sorted = frames.slice().sort((a, b) => a.ms - b.ms), slow = sorted.slice(Math.floor(n * 0.85)), mid = sorted.slice(Math.floor(n * 0.3), Math.floor(n * 0.7));
      const avg = (list, k) => +(list.reduce((s, f) => s + (f.parts[k] || 0), 0) / list.length).toFixed(2);
      const keys = Object.keys(parts);
      return { n, medMs: +mid[Math.floor(mid.length / 2)].ms.toFixed(2), slowMs: +(slow.reduce((s, f) => s + f.ms, 0) / slow.length).toFixed(2),
        parts: Object.fromEntries(keys.map(k => [k, [avg(mid, k), avg(slow, k)]]).filter(([, v]) => v[0] > 0.01 || v[1] > 0.01)),
        slowest: slow.slice(-5).map(f => ({ ms: +f.ms.toFixed(1), top: Object.entries(f.parts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(1)}`) })) };
    }, n, 600000);

    // --look DIR: the same frame (the game held, nothing moves) drawn the way it was before terrarium-perf (the see-through
    // buffer full size, the room's chunks whole) = <case>-A.png, as it is now = -B.png, and without the slime = -N.png
    // (Pebble's silhouette); the canvas only (no HUD). Compare with reports/terrarium-perf-logs/look-compare.py --ab.
    const look = async name => {
      const shots = await ev(async () => {
        const g = window.slimekin, S = (await import('/src/view/see-through.js')).SEE, r = g.home.room, keep = S.scale;
        const shot = () => { g.stage.render(); return g.canvas.toDataURL('image/png'); };
        S.scale = 1; r.cellsOff = true; shot(); const A = shot();
        S.scale = keep; r.cellsOff = false; shot(); const B = shot();
        g.slime.root.visible = false; shot(); const N = shot(); g.slime.root.visible = true;
        shot();
        return { A, B, N };
      }, null, 300000);
      fs.mkdirSync(LOOK, { recursive: true });
      for (const [k, v] of Object.entries(shots)) fs.writeFileSync(path.join(LOOK, `${name}-${k}.png`), Buffer.from(v.split(',')[1], 'base64'));
    };

    for (const qual of QUALS) for (const view of VIEWS) for (const time of TIMES) for (const vr of VARIANTS) {
      const name = `${qual}/${view}/${time}` + (vr === 'base' ? '' : '/' + vr);
      await step(name, async () => {
        const st = await setCase(qual, view, time);
        await ev(async ([code]) => { const g = window.slimekin; await (0, eval)('(async (g) => {' + code + '})')(g); }, [VARIANT[vr][0]]);
        const m = await measure(FRAMES);
        const c = { name, variant: vr, ...st, ...m };
        if (LIVE) c.live = await live(LIVE);
        if (LOOK) await look(name.replace(/\//g, '-'));
        if (PROFILE) c.profile = await profile(PROFILE);
        if (SPIKES) c.spikes = await spikes(SPIKES);
        await ev(async ([code]) => { const g = window.slimekin; await (0, eval)('(async (g) => {' + code + '})')(g); }, [VARIANT[vr][1]]);
        out.cases.push(c);
        log(name, JSON.stringify(c));
      }, 1200000);
    }
    errors.push(...kit.errors);
    kit.report();
  } catch (e) {
    errors.push(e.message.split('\n')[0]);
    if (kit) errors.push(...kit.errors);
  } finally {
    if (kit) await kit.close();
  }
  out.errors = errors;
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\n${out.renderer || ''}  dpr ${DPR}  cpu x${CPU}  (ms: median / p90)`);
  console.log(pad('case', 22) + pad('calls rt+main', 15) + pad('tris rt+main', 20) + pad('cpu', 13) + pad('gpu', 13) + pad('sync', 13) + 'thru');
  for (const c of out.cases) {
    const k = c.counts, f = o => (o ? `${o.med}/${o.p90}` : '-');
    console.log(pad(c.name, 22) + pad(`${k.rt.calls}+${k.main.calls}`, 15) + pad(`${k.rt.tris}+${k.main.tris}`, 20) + pad(f(c.cpu), 13) + pad(f(c.gpu), 13) + pad(f(c.sync), 13) + c.thru +
      (c.live ? `   live ${c.live.fps} fps, gap ${c.live.gap.med}/${c.live.gap.p90}, late ${c.live.lateShare}, Auto level ${c.live.levelEnd}` : ''));
  }
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log(`\nOK: ${OUT}`);
})();
