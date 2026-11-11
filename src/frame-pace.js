// [perf] Graphics quality "Auto": the frame-rate watch (terrarium-perf). Plain JS (no DOM, no three.js) so
// tools/auto-quality-test.mjs can play it made-up timelines. game.js feeds it every frame callback of the browser (tick)
// and every frame it draws (frame); the numbers are AUTO_QUALITY in content.js.
//
// A frame is late when it misses its beat: the display's own (60 Hz: 16.7 ms; an iPhone in Low Power Mode or a 30 Hz
// screen: 33.3 ms) or the game's cap when calm, whichever is longer. So a phone that shows 30 a second, steadily, is not
// struggling. The beat comes from gaps between callbacks that the game's own work didn't cause (the callback before took
// under half the gap: a skipped one, or a quick frame); a device too slow for 60 shows longer gaps after its long frames,
// and those mustn't read as a slower screen. Each window keeps the low quarter of its gaps, and the beat is the shortest
// of the last `beatKeep` windows': a display that showed 60 lately is a 60 one, a long stretch of slow frames doesn't
// change that. Auto steps down after `windows` windows in a row with `lateShare` of their frames late (or one with
// `veryLate`), never back up in a visit (no flip-flop); windows after the start, a step or coming back aren't judged
// (`settle`), nor one with a stall (the phone busy elsewhere, an alert).
import { AUTO_QUALITY } from './data/content.js';

export class FramePace {
  constructor(A = AUTO_QUALITY) {
    this.A = A;
    this.level = 0;            // Auto's step: 0 High, 1 pixel ratio A.ratio1, 2 Low
    this.beat = 1000 / 60;     // the display's beat, ms
    this.settle = A.settle;    // windows not judged
    this.steps = [];           // when Auto stepped down (for the probe and #debug)
    this.lateShare = 0;        // the last window's
    this.t = 0; this.frames = 0; this.work = 0; this.bad = 0; this.stalled = false;
    this.rafAt = 0; this.cbWork = 0; this.beats = new Float64Array(512); this.bn = 0; this.beatHist = [];
    this.win = new Float64Array(512); this.cap = new Float64Array(512);
  }

  // every frame callback of the browser, drawn or not
  tick(now) {
    const d = now - this.rafAt;
    this.rafAt = now;
    if (d > 0 && d < this.A.stall && this.cbWork < d * 0.5 && this.bn < this.beats.length) this.beats[this.bn++] = d;
    this.cbWork = 0;   // (frame() sets it when this callback draws)
  }

  // A drawn frame: the gap since the last one, the game's cap then and the work it took (ms). judge: Auto is in charge
  // (the setting is Auto, the page shows). At a window's end it returns { fps, work, step } (step: go down one level,
  // already counted in `level`), else null.
  frame(gap, target, workMs, judge, time = 0) {
    const A = this.A;
    this.cbWork = workMs;
    if (gap > A.stall) { this.stalled = true; return null; }
    if (this.frames < this.win.length) { this.win[this.frames] = gap; this.cap[this.frames] = target; }
    this.t += gap / 1000;
    this.frames++;
    this.work += workMs;
    if (this.t < A.window) return null;
    this.updateBeat();
    const n = Math.min(this.frames, this.win.length);
    let late = 0;
    for (let i = 0; i < n; i++) if (this.win[i] > Math.max(this.cap[i], this.beat) * A.late) late++;
    const out = { fps: this.frames / this.t, work: this.work / this.frames, step: false };
    const lateShare = this.lateShare = late / n;
    this.t = 0; this.frames = 0; this.work = 0;
    if (this.settle > 0 || this.stalled) { this.settle = Math.max(0, this.settle - 1); this.stalled = false; this.bad = 0; return out; }
    if (!judge || this.level >= 2) { this.bad = 0; return out; }
    this.bad = lateShare >= A.lateShare ? this.bad + 1 : 0;
    if (this.bad >= A.windows || lateShare >= A.veryLate) {
      this.level++;
      this.bad = 0;
      this.settle = A.settleAfter;
      this.steps.push({ at: +time.toFixed(1), level: this.level, lateShare: +lateShare.toFixed(2), beat: +this.beat.toFixed(1) });
      out.step = true;
    }
    return out;
  }

  updateBeat() {
    if (this.bn >= 4) {
      const s = this.beats.subarray(0, this.bn).sort();
      this.beatHist.push(s[this.bn >> 2]);
      if (this.beatHist.length > this.A.beatKeep) this.beatHist.shift();
      this.beat = Math.min(...this.beatHist);
    }
    this.bn = 0;
  }
}
