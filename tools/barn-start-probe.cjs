// The game's start, measured: does loading the barn ahead of time slow it? A headless phone (393 x 852) opens the game
// from tools/fixtures/barn/barn-six.json (the Greenhouse home, 7 ranch slimes) several times and reads, from the moment
// the page is asked for:
//   boot      the "Warming the nest" screen is gone (the game is built and drawing)
//   room      the Greenhouse room is in (home as it is meant to look)
//   barn      the barn's files are in and built (only when they load ahead of time; never in the window otherwise)
//   frames    in the first 12 s after boot: frames drawn, the longest gap between two frames, gaps over 50 ms, and the
//             main thread's long tasks (over 50 ms, total)
//   ranch     then the Ranch tab is tapped: how long until the barn shows (at once when it loaded ahead of time)
//   node tools/barn-start-probe.cjs [--runs=4] [--rounds=2] [--before=<folder>]
// --before=<folder>: also measure an older copy of the game (served from that folder; it may lack anything barn-r3 added)
// in alternating blocks, and print both. Times are a headless desktop browser's, not a phone's: compare the two columns,
// not the numbers with a phone.
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const RUNS = +arg('runs', 4), ROUNDS = +arg('rounds', 2), BEFORE = arg('before', null);
const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'barn', 'barn-six.json'), 'utf8')).save;
const WINDOW = 12000;

async function measure(label, root) {
  const kit = await setup({ root, contextOptions: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } });
  const { page, ev } = kit;
  // every page load: a fresh copy of the save, and a recorder that starts before the game's own code
  await kit.context.addInitScript(save => {
    const s = JSON.parse(JSON.stringify(save)), now = Date.now();
    for (const x of s.ranch.residents) {
      if (x.trip) { x.trip.startAt = now - 600000; x.trip.homeAt = now + 3000000; }
      if (x.lesson) { x.lesson.startAt = now - 600000; x.lesson.doneAt = now + 7200000; }
    }
    s.savedAt = now - 60000; s.ranch.lastVisit = now;
    localStorage.setItem('slimekin.save.v1', JSON.stringify(s));
    const R = window.__start = { frames: [], long: [], boot: null, room: null, barn: null };
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) R.long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch { /* no long tasks here */ }
    const tick = t => {
      R.frames.push(t);
      const b = document.getElementById('boot'), g = window.slimekin;
      if (R.boot === null && b && b.hidden) R.boot = t;
      if (g && R.room === null && g.home && g.home.world === 'greenhouse') R.room = t;
      if (g && R.barn === null && g.barnRanch && g.barnRanch.view.ready) R.barn = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, SAVE);
  const out = [];
  // one warm-up load (the browser's cache, as a returning player), not counted
  for (let i = 0; i <= RUNS; i++) {
    await page.goto(`${kit.server.origin}/?run=${i}#debug`);
    await page.waitForFunction(() => window.__start.boot !== null && window.__start.room !== null, null, { timeout: 120000 });
    await page.waitForFunction(w => performance.now() > window.__start.boot + w, WINDOW, { timeout: 120000, polling: 250 });
    const r = await ev(w => {
      const R = window.__start, a = R.boot, b = a + w, f = R.frames.filter(t => t >= a && t <= b);
      let gap = 0, slow = 0;
      for (let i = 1; i < f.length; i++) { const d = f[i] - f[i - 1]; gap = Math.max(gap, d); if (d > 50) slow++; }
      const long = R.long.filter(([s]) => s >= a && s <= b);
      return { boot: Math.round(R.boot), room: Math.round(R.room), barn: R.barn === null ? null : Math.round(R.barn), frames: f.length, gap: Math.round(gap), slow,
        longN: long.length, longMs: Math.round(long.reduce((s, [, d]) => s + d, 0)) };
    }, WINDOW);
    const t0 = Date.now();
    await page.click('#tab-ranch');
    await page.waitForFunction(() => window.slimekin.barnRanch.on || window.slimekin.barnRanch.view.on, null, { timeout: 120000, polling: 16 });
    r.ranch = Date.now() - t0;
    if (i > 0) { out.push(r); log(label, `run ${i}:`, JSON.stringify(r)); }
  }
  if (kit.errors.length) log(label, 'page errors:', kit.errors.slice(0, 3).join(' | '));
  await kit.close();
  return out;
}

const stats = (rs, k) => {
  const v = rs.map(r => r[k]).filter(x => x !== null && x !== undefined).sort((a, b) => a - b);
  if (!v.length) return 'never';
  const med = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return `${Math.round(med)} (${v[0]}..${v[v.length - 1]})`;
};

(async () => {
  watchdog(60, () => 'start probe');
  const res = { after: [], before: [] };
  for (let k = 0; k < ROUNDS; k++) {
    res.after.push(...await measure('after', null));
    if (BEFORE) res.before.push(...await measure('before', BEFORE));
  }
  const rows = [['boot', 'boot screen gone (ms)'], ['room', 'Greenhouse room in (ms)'], ['barn', 'barn ready (ms)'], ['frames', `frames in the first ${WINDOW / 1000} s`],
    ['gap', 'longest frame gap (ms)'], ['slow', 'frame gaps over 50 ms'], ['longN', 'long tasks'], ['longMs', 'long tasks, total ms'], ['ranch', 'Ranch tap to barn (ms)']];
  console.log(`\nmedian (min..max) of ${res.after.length} runs each${BEFORE ? '' : ' (no --before)'}:`);
  for (const [k, name] of rows) console.log(`  ${name.padEnd(30)} after ${stats(res.after, k).padEnd(22)}${BEFORE ? ' before ' + stats(res.before, k) : ''}`);
  console.log('OK');
  process.exit(0);
})().catch(e => { console.log('FAILED', e && e.stack || e); process.exit(1); });
