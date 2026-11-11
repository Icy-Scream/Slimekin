// Auto quality's frame-rate watch (src/frame-pace.js) on made-up timelines: a display ticking at its rate, the browser
// calling the game's frame on the first tick after the last one's work, the game's 60 cap (and 30 when calm), and the
// work each frame takes. Plain node: node tools/auto-quality-test.mjs
import { FramePace } from '../src/frame-pace.js';
import { AUTO_QUALITY } from '../src/data/content.js';

let pass = 0, fail = 0;
const ok = (c, msg, extra = '') => { if (c) { pass++; console.log('ok  ', msg); } else { fail++; console.log('FAIL', msg, extra); } };

// run(spec) -> { pace, drawn, steps }. spec: hz (display), secs, work(t) ms for a drawn frame, skip work 0.1 ms,
// calm(t) (the game's 30 cap), gpu(t): the browser holds the next callback until the GPU is done (ms after a drawn
// frame), stall(t) a one-off pause (ms), judge
function run({ hz = 60, secs = 60, work = () => 3, calm = () => false, gpu = () => 0, stallAt = [], judge = true, pace = new FramePace() }) {
  const P = 1000 / hz;
  let now = 0, last = -1000, busyUntil = 0, drawn = 0;
  const stalls = [...stallAt];
  while (now < secs * 1000) {
    // the next callback: the first display tick once the main thread (and the GPU's hold) is free
    now = Math.max(now + P, Math.ceil((busyUntil - 1e-6) / P) * P);
    if (stalls.length && now >= stalls[0][0]) { now += stalls[0][1]; stalls.shift(); }
    pace.tick(now);
    const t = now / 1000, target = calm(t) ? 1000 / 30 : 1000 / 60, gap = now - last;
    if (gap < target - 2) { busyUntil = now + 0.1; continue; }
    last = now;
    const w = work(t);
    busyUntil = now + Math.max(w, gpu(t));
    drawn++;
    pace.frame(gap, target, w, judge, t);
  }
  return { pace, drawn, fps: drawn / secs, steps: pace.steps };
}
const at = (r, lvl) => (r.steps.find(s => s.level === lvl) || {}).at;
const show = r => `level ${r.pace.level}, beat ${r.pace.beat.toFixed(1)} ms, ${r.fps.toFixed(1)} fps, steps ${JSON.stringify(r.steps)}`;

// a fast phone on a 60 Hz screen
let r = run({ hz: 60, work: () => 3 });
ok(r.pace.level === 0 && Math.abs(r.pace.beat - 16.7) < 0.5, '60 Hz, quick frames: stays High, beat 16.7', show(r));
// Low Power Mode: the browser gives 30 callbacks a second; quick frames
r = run({ hz: 30, work: () => 6 });
ok(r.pace.level === 0 && Math.abs(r.pace.beat - 33.3) < 0.5, 'Low Power Mode (30 Hz), quick frames: stays High, beat 33.3', show(r));
r = run({ hz: 30, work: () => 14 });
ok(r.pace.level === 0, 'Low Power Mode, frames of 14 ms: stays High', show(r));
r = run({ hz: 30, work: t => (t < 4 ? 1 : 6), calm: t => t > 30 });
ok(r.pace.level === 0, 'Low Power Mode, a quick start, calm later: stays High', show(r));
// too slow for 60 on a 60 Hz screen, the main thread busy (24 ms a frame): steps down
r = run({ hz: 60, work: t => (t < 4 ? 2 : 24) });
ok(r.pace.level === 2 && at(r, 1) < 12 && at(r, 2) < 20, '60 Hz, 24 ms frames after a quick start: steps to 1.5, then Low', show(r));
r = run({ hz: 60, work: () => 24 });
ok(r.pace.level >= 1 && at(r, 1) < 12, '60 Hz, 24 ms frames from the very start: steps down', show(r));
// too slow for 60, the GPU the hold-up (quick JavaScript, the next callback held until the GPU is done)
r = run({ hz: 60, work: () => 3, gpu: t => (t < 4 ? 0 : 25) });
ok(r.pace.level >= 1 && at(r, 1) < 12, '60 Hz, the GPU holding every frame to 30 after a quick start: steps down', show(r));
// a 60 Hz phone in calm stretches (the game's own 30 cap) and with quick frames: not late
r = run({ hz: 60, work: () => 3, calm: t => Math.floor(t / 10) % 2 === 1 });
ok(r.pace.level === 0, '60 Hz with calm stretches (30 cap): stays High', show(r));
// one hitch every 2 s (a 100 ms frame), stalls (an alert: 2 s)
r = run({ hz: 60, work: t => (Math.abs(t % 2) < 0.017 ? 100 : 3), stallAt: [[20000, 2000], [40000, 900]] });
ok(r.pace.level === 0, '60 Hz with a hitch every 2 s and two stalls: stays High', show(r));
// a 120 Hz screen: the game draws every other callback (its 60 cap)
r = run({ hz: 120, work: () => 3 });
ok(r.pace.level === 0 && r.fps > 59, '120 Hz screen, the game at its 60 cap: stays High', show(r));
// Low Power Mode on a device too slow even for 30 (40 ms frames): steps down
r = run({ hz: 30, work: t => (t < 4 ? 2 : 40) });
ok(r.pace.level >= 1, 'Low Power Mode, 40 ms frames: steps down', show(r));
// a fixed setting (High or Low picked by hand) or a hidden page: never steps
r = run({ hz: 60, work: () => 30, judge: false });
ok(r.pace.level === 0 && !r.steps.length, 'not judged (a fixed setting): never steps', show(r));
// never more than two steps, never back up, and nothing judged in the first windows after the start or a step
r = run({ hz: 60, secs: 120, work: () => 40 });
ok(r.pace.level === 2 && r.steps.length === 2 && r.steps[0].at >= AUTO_QUALITY.window * (AUTO_QUALITY.settle + 1) - 0.1, 'two steps at most, the first after the start\'s settle', show(r));
const p = r.pace;
run({ hz: 60, secs: 30, work: () => 3, pace: p });
ok(p.level === 2, 'never back up in a visit');
// coming back to the app (welcome.js sets settle 1): the next window is not judged
const q = new FramePace();
run({ hz: 60, secs: 10, work: () => 3, pace: q });
q.settle = 1;
const before = q.steps.length;
run({ hz: 60, secs: AUTO_QUALITY.window * 1.05, work: () => 40, pace: q });
ok(q.steps.length === before, 'the window after coming back is not judged');

console.log(`\n${pass}/${pass + fail} checks passed`);
console.log(fail ? 'FAILED' : 'OK');
process.exit(fail ? 1 : 0);
