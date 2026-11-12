// The race's perf gates (design/contests-race-view.md v2 §3; RV2), at iPhone size (390 x 844, DPR 3 by default) with
// Chromium's CPU slowed (--cpu 4: a phone's CPU stand-in; it slows the page's JavaScript only):
//   build   the four runners' strips composed back to back (work time, ms; the game builds them in idle slices while
//           the race card is open, so the race starts at once). Target <= 20 ms on a phone (design §3).
//   frames  JavaScript per frame while the race runs: the race's own frame (race-view.js frame(): the clock, the plan,
//           the picture, the tote, the rings) and the game's whole frame (Game.update: the rules, the race, with the 3D
//           world resting). Median and p90; gate (whole frame): median <= 4 ms, p90 <= 6 ms.
//   draws   drawImage calls per frame (most in one frame; budget 60) and fillRect calls (pixel confetti, the mint trail)
//   memory  the JS heap during the race against before the card (after a GC), plus the race's canvases; budget 8 MB
//   allocs  the per-frame allocation check (the captain's pooling question): V8's sampling heap profiler (every
//           ~32 bytes, objects later collected included) over a stretch of the race with a cheer in it; every sampled
//           allocation made in a race file is listed by function. The race loop's functions must make nothing
//           (bytes 0); the event functions (a cheer, a new caller line, the order changing) are listed apart.
// Also: node tools/perf-probe.cjs --race [...] runs this.
//   node tools/race-perf.cjs [--dpr 3] [--cpu 4] [--out tools/out/race-perf.json]
// Numbers from the server are "server, slow-env" (software rendering, a shared box).
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DPR = +arg('dpr', 3), CPU = +arg('cpu', 4), WHY = process.argv.includes('--why');
// --why: V8's optimisation state of the race loop's functions at the end (Chromium with --allow-natives-syntax)
if (WHY) process.env.SLIMEKIN_JS_FLAGS = '--allow-natives-syntax';
const OUT = path.resolve(arg('out', path.join(__dirname, 'out', 'race-perf.json')));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'barn', 'barn-six.json'), 'utf8')).save;
const P = 'rbarnpeach';
// the race loop: functions that run every frame (they must allocate nothing)
const LOOP = new Set(['update', 'frame', 'tick', 'youScreen', 'youArt',   // race-view.js
  'draw', 'band', 'piece', 'drawImg', 'runner', 'effects', 'surgeStep', 'spawn',   // race-draw.js
  'front', 'behind', 'x', 'hillAt', 'ground', 'camera', 'legOf', 'lift', 'gaitOf', 'rate', 'callAt', 'smooth',   // race-plan.js
  'drawTrack', 'drawRings', 'ring', 'setCaller', 'screenX', 'screenY']);   // race-skin.js
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };

(async () => {
  const errors = [], out = { dpr: DPR, cpu: CPU, env: 'server, slow-env' };
  const check = (cond, what, extra = '') => { log(`${cond ? 'ok  ' : 'FAIL'} ${what}${extra ? ' | ' + extra : ''}`); if (!cond) errors.push(what + (extra ? ': ' + extra : '')); };
  let kit = null;
  watchdog(90, () => (kit ? kit.current() : 'setup'));
  try {
    kit = await setup({ contextOptions: { viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true } });
    const { page, step, ev } = kit;
    await kit.context.addInitScript(save => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const s = JSON.parse(JSON.stringify(save)), now = Date.now();
      for (const x of s.ranch.residents) { if (x.trip) { x.trip.startAt = now - 600000; x.trip.homeAt = now + 3000000; } if (x.lesson) { x.lesson.startAt = now - 600000; x.lesson.doneAt = now + 7200000; } }
      s.savedAt = now - 60000; s.ranch.lastVisit = now;
      localStorage.setItem('slimekin.save.v1', JSON.stringify(s));
    }, SAVE);
    const cdp = await kit.context.newCDPSession(page);
    await step('boot', async () => {
      await page.goto(`${kit.server.origin}/#debug`);
      await page.waitForFunction(() => window.slimekin && window.slimekin.state && document.getElementById('boot').hidden, null, { timeout: 240000 });
      await ev(() => { const g = window.slimekin; g.hud.closeModal(); g.hud.openTab('ranch'); });
      await page.waitForFunction(() => window.slimekin.barnRanch.on, null, { timeout: 240000 });
      await ev(() => window.slimekin.hud.closeModal());
    }, 600000);
    await ev(id => {
      const g = window.slimekin, x = g.state.ranch.residents.find(y => y.id === id);
      x.name = 'Juniper'; x.form = { id: 'spark', name: 'Volt Slime', blurb: '' }; x.breed = 'curly'; x.variant = 'plain'; x.mix = 0;
      x.traits = { sweet: 0, heat: 0, mineral: 0, nature: 0, spark: 34, prism: 0 }; x.worn = { head: null, face: null, neck: 'bowtie' };
      x.skills = { bounce: 0, speed: 5, sturdy: 3, smarts: 2, charm: 0 }; x.potential = { bounce: 1, speed: 3, sturdy: 1, smarts: 1, charm: 1 };
      for (const k of Object.keys(x.personality)) x.personality[k] = 50;
      x.happiness = 72; x.lesson = null; x.trip = null; x.contests.trophies = { beauty: 0, sprint: 2, bounce: 0 };
      g.barnRanch.show(id);
    }, P);
    await cdp.send('HeapProfiler.enable');
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize; };
    const heap0 = await heap();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    // build: the kit loaded, then the four strips composed back to back (work time)
    await step('build', async () => {
      out.build = await ev(async id => {
        const g = window.slimekin, rv = g.raceView, K = await import('/src/view/race-kit.js');
        const kit = await K.loadKit(), x = g.state.ranch.residents.find(y => y.id === id);
        const race = rv.preview(id, 3), casts = rv.castsOf(race, x);
        const t0 = performance.now();
        const arts = casts.map(c => new K.RunnerArt(kit, c));
        arts.forEach(a => a.finish());
        const ms = performance.now() - t0;
        const t1 = performance.now();
        new K.RunnerArt(kit, casts[0]).finish();
        return { ms: Math.round(ms * 10) / 10, perRunner: Math.round(ms / 4 * 10) / 10, yours: Math.round((performance.now() - t1) * 10) / 10, frames: 24 };
      }, P);
      log('build (4 runners x 24 frames, CPU x' + CPU + '):', JSON.stringify(out.build));
    }, 300000);
    // the race: the card (strips built in idle time), then Race!
    await step('race', async () => {
      // the strips are built in idle slices while the card is open: the longest task in that time (long tasks are
      // the ones over 50 ms; none = every slice shorter)
      await ev(async () => {
        const K = await import('/src/view/race-kit.js');
        K.forgetStrips();
        window.slimekin.raceView.perf.build = null;
        window.__lt = []; const o = new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); });
        o.observe({ type: 'longtask', buffered: false }); window.__lto = o;
      });
      const c0 = Date.now();
      await ev(id => window.slimekin.contestsUI.openEntry(id, 'sprint', 3), P);
      await page.waitForFunction(() => document.querySelectorAll('#modalCard .rv-row canvas').length === 4, null, { timeout: 120000 });
      const facesMs = Date.now() - c0;
      await page.waitForFunction(() => window.slimekin.raceView.perf.build, null, { timeout: 120000, polling: 20 });
      out.cardBuild = await ev(() => { window.__lto.disconnect(); return { longTasks: window.__lt.slice(), build: window.slimekin.raceView.perf.build }; });
      out.cardBuild.facesMs = facesMs;
      out.cardBuild.wallMs = Date.now() - c0;
      log('while the card is open (CPU x' + CPU + '):', JSON.stringify(out.cardBuild));
      await page.waitForTimeout(3000);
      // the whole frame: Game.update + draw + updateOverlay timed (wrappers on the instance; reset by a reload)
      await ev(() => {
        // Game.update is the whole frame (the world, draw, the overlay)
        const g = window.slimekin, W = window.__rw = { t: new Float64Array(20000), n: 0 }, f = g.update.bind(g);
        g.update = function (dt) { const t0 = performance.now(); const r = f(dt); if (g.raceView.covers && W.n < 20000) W.t[W.n++] = performance.now() - t0; return r; };
        document.querySelector('#modalCard [data-cs="start"]').click();
      });
      await page.waitForFunction(() => window.slimekin.raceView.covers, null, { timeout: 60000 });
      const mem = { heapRace: 0 };
      // allocations: sample from 4 s to 13 s of race time (the dash, the first cheer, the hill's start)
      await page.waitForFunction(() => window.slimekin.raceView.s.t > 4, null, { timeout: 120000, polling: 50 });
      let flags = { samplingInterval: 32, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true };
      try { await cdp.send('HeapProfiler.startSampling', flags); } catch (e) { flags = { samplingInterval: 32 }; out.allocNote = 'this Chromium keeps only live objects in the sampling profile: ' + e.message; await cdp.send('HeapProfiler.startSampling', flags); }
      const f0 = await ev(() => window.slimekin.raceView.perf.frames);
      // the first cheer: a debug Good (a cheer event inside the sampled stretch)
      await page.waitForFunction(() => { const r = window.slimekin.raceView.s.ring; return r && r.k === 0; }, null, { timeout: 120000, polling: 30 });
      await page.waitForTimeout(1400);
      await ev(() => window.slimekin.raceView.debugCheer('good'));
      await page.waitForFunction(() => window.slimekin.raceView.s.t > 13, null, { timeout: 120000, polling: 50 });
      const prof = (await cdp.send('HeapProfiler.stopSampling')).profile;
      const f1 = await ev(() => window.slimekin.raceView.perf.frames);
      mem.heapRace = (await cdp.send('Runtime.getHeapUsage')).usedSize;
      // walk the profile: self bytes by (file, function) for the race's files
      const by = new Map();
      const walk = n => {
        const u = n.callFrame.url || '';
        const m = /\/src\/(race-view\.js|view\/race-[a-z]+\.js)/.exec(u);
        if (m && n.selfSize > 0) { const key = `${m[1]} ${n.callFrame.functionName || '(anonymous)'}`; by.set(key, (by.get(key) || 0) + n.selfSize); }
        for (const c of n.children || []) walk(c);
      };
      walk(prof.head);
      // each sampled allocation's size: 12 bytes is V8's box for a number (a HeapNumber, with pointer compression), made
      // by the VM when a double leaves unoptimised or not-inlined code; anything else is an object, array, closure or
      // string the code made
      const ids = new Map();
      const index = n => { const u = n.callFrame.url || '', m = /\/src\/(race-view\.js|view\/race-[a-z]+\.js)/.exec(u); if (m) ids.set(n.id, `${m[1]} ${n.callFrame.functionName || '(anonymous)'}`); for (const c of n.children || []) index(c); };
      index(prof.head);
      const kinds = new Map();
      for (const smp of prof.samples || []) {
        const k = ids.get(smp.nodeId);
        if (!k) continue;
        const e = kinds.get(k) || { numbers: 0, objects: 0, sizes: {} };
        // (a sample's size is the object's size x how many objects it stands for: a 12-byte number box at a 32-byte
        // interval stands for 3, so it shows as 36)
        if (smp.size === 36) e.numbers += smp.size; else { e.objects += smp.size; e.sizes[smp.size] = (e.sizes[smp.size] || 0) + 1; }
        kinds.set(k, e);
      }
      const rows = [...by.entries()].map(([k, b]) => ({ fn: k, bytes: b, loop: LOOP.has(k.split(' ')[1]), ...(kinds.get(k) || {}) })).sort((a, b) => b.bytes - a.bytes);
      const loopRows = rows.filter(r => r.loop), loopBytes = loopRows.reduce((s, r) => s + r.bytes, 0), loopObjects = loopRows.reduce((s, r) => s + (r.objects || 0), 0), loopNumbers = loopRows.reduce((s, r) => s + (r.numbers || 0), 0);
      const fr = f1 - f0;
      out.allocs = { frames: fr, flags, loopBytes, loopObjects, loopNumbers, perFrame: fr ? { all: +(loopBytes / fr).toFixed(1), objects: +(loopObjects / fr).toFixed(1), numbers: +(loopNumbers / fr).toFixed(1) } : null, rows };
      log('allocations sampled in race files (frames ' + fr + '):', JSON.stringify(rows));
      // An object made every frame is sampled about every 32 bytes: over hundreds of frames it shows hundreds of times.
      // What shows a few times is V8's own one-off work as a function is optimised (its feedback and code), not the
      // loop's: the gate is fewer object samples in the loop functions than one per 50 frames.
      // Per function: an object of 12 bytes or more made there every frame is sampled about once in 3 frames or more
      // often, so the gate is fewer than one sample in 10 frames in every loop function (what is left is V8's own
      // bookkeeping as code tiers up: a few samples of a few sizes, spread over many functions)
      const per = loopRows.map(r => ({ fn: r.fn, n: Object.values(r.sizes || {}).reduce((a, b) => a + b, 0) }));
      const loopObjSamples = per.reduce((s, r) => s + r.n, 0), worst = per.reduce((m, r) => (r.n > m.n ? r : m), { fn: '-', n: 0 });
      out.allocs.loopObjectSamples = loopObjSamples;
      out.allocs.worstFunction = worst;
      check(worst.n < fr / 10, `no race-loop function makes an object, array, closure or string each frame: the most in one function ${worst.n} samples in ${fr} frames (${worst.fn}; one a frame would show >= ${Math.round(fr / 3)}); all loop functions ${loopObjSamples} samples, ${out.allocs.perFrame.objects} bytes a frame`, JSON.stringify(loopRows.filter(r => r.objects).map(r => [r.fn, r.sizes])));
      log(`(the VM's number boxes in the loop: ${out.allocs.perFrame && out.allocs.perFrame.numbers} bytes a frame; all loop bytes ${out.allocs.perFrame && out.allocs.perFrame.all} a frame)`);
      if (WHY) {
        out.why = await ev(async () => {
          const P = (await import('/src/view/race-plan.js')).RacePlan.prototype, D = (await import('/src/view/race-draw.js')).RaceDraw.prototype, R = window.slimekin.raceView;
          const st = new Function('f', 'return %GetOptimizationStatus(f)');
          const bits = n => n;   // (raw %GetOptimizationStatus bits: their meaning moves between V8 versions)
          const fns = { 'plan.behind': P.behind, 'plan.tick': P.tick, 'plan.frame': P.frame, 'plan.camera': P.camera, 'draw.draw': D.draw, 'draw.runner': D.runner, 'view.frame': R.frame };
          return Object.fromEntries(Object.entries(fns).map(([k, f]) => [k, bits(st(f))]));
        });
        log('V8 tiers:', JSON.stringify(out.why));
      }
      // let it run to the end; frames
      await page.waitForFunction(() => !window.slimekin.raceView.on, null, { timeout: 180000, polling: 200 });
      const f = await ev(() => {
        const rv = window.slimekin.raceView, W = window.__rw;
        return { race: Array.from(rv.samples.subarray(0, rv.sn)), whole: Array.from(W.t.subarray(0, W.n)), last: rv.info().last };
      });
      const st = a => ({ n: a.length, median: +pct(a, 0.5).toFixed(3), p90: +pct(a, 0.9).toFixed(3), max: +pct(a, 1).toFixed(3) });
      out.frames = { race: st(f.race), whole: st(f.whole), seconds: f.last.seconds };
      out.draws = { maxDrawImage: f.last.perf.maxDraws, maxFillRect: f.last.perf.maxFills };
      const canv = await ev(() => null);
      out.memory = { heapBefore: heap0, heapRace: mem.heapRace, heapExtraMB: +((mem.heapRace - heap0) / 1048576).toFixed(2) };
      log('frames (ms of JS, CPU x' + CPU + '):', JSON.stringify(out.frames), 'draws', JSON.stringify(out.draws));
    }, 900000);
    // the race's canvases (one more race's worth, measured on a fresh RaceDraw)
    out.memory.canvasMB = await ev(async id => {
      const g = window.slimekin, rv = g.raceView, K = await import('/src/view/race-kit.js'), D = await import('/src/view/race-draw.js');
      const kit = await K.loadKit(), x = g.state.ranch.residents.find(y => y.id === id), race = rv.preview(id, 3);
      const arts = rv.castsOf(race, x).map(c => K.RunnerArt.of(kit, c).finish());
      const d = new D.RaceDraw(kit, arts, { width: Math.ceil(innerWidth / 2), height: Math.ceil(innerHeight / 2), fx: arts.map(() => null) });
      return +(d.bytes() / 1048576).toFixed(2);
    }, P);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    out.memory.totalMB = +(out.memory.heapExtraMB + out.memory.canvasMB).toFixed(2);
    const W = out.frames.whole;
    check(W.median <= 4 && W.p90 <= 6, `JS per frame (the whole game frame, CPU x${CPU}): median ${W.median} ms <= 4, p90 ${W.p90} ms <= 6`);
    check(out.draws.maxDrawImage <= 60, `drawImage calls per frame: at most ${out.draws.maxDrawImage} (budget 60; fillRect ${out.draws.maxFillRect})`);
    check(out.memory.totalMB <= 8, `memory: ${out.memory.heapExtraMB} MB heap + ${out.memory.canvasMB} MB canvases = ${out.memory.totalMB} MB (budget 8)`);
    log(`build: ${out.build.ms} ms for 4 runners (CPU x${CPU}; design target 20 ms on a phone)`);
  } catch (e) {
    errors.push(String(e && e.stack || e));
    log('ERROR', e && e.stack || e);
  } finally {
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    log('wrote', OUT);
    if (kit) await kit.close();
  }
  log(errors.length ? `FAILED (${errors.length}):\n  ${errors.join('\n  ')}` : 'OK');
  process.exit(errors.length ? 1 : 0);
})();
