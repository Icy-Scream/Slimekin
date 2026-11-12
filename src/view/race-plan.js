// The race on screen, as plain numbers (design/contests-race-view.md v2 §1, §2.3, §3; RV2): where each runner is at
// any moment, where the camera is, which sprite frame each runner shows, when the rings come, how fast the clock runs
// (the photo finish). race-view.js asks it every frame; race-draw.js draws what it says. Pure: no DOM, no three.js,
// no Math.random; nothing here allocates per frame (pre-sized arrays only), so the race loop stays allocation-free.
//
// Positions: the field's front (the leader's place on the course) moves at one steady pace, a leg's length per leg; every
// runner sits behind it by its gap at each checkpoint (core/race.js `behind`), eased between checkpoints, so the lead
// changes only where the legs say so. After a cheer (or the pat) the race is worked out again and every runner eases
// from where it is to its new place over the surge. After the line the front slows to a stop and everyone closes up.
// Numbers: CONTESTS.race.time / .photo / .view.
import { CONTESTS } from '../data/content.js';

const RC = () => CONTESTS.race;
// the atlas's frames: the kit's 20 (kit.json order) + the 4 idle frames with the think face (before a hoop)
export const KIT_FRAMES = ['idle_0', 'idle_1', 'idle_2', 'idle_3', 'scoot_0', 'scoot_1', 'scoot_2', 'scoot_3', 'hop_crouch', 'hop_launch', 'hop_air1',
  'hop_air2', 'hop_land', 'hop_recover', 'bound_lean', 'bound_flat', 'surge_long', 'surge_spark', 'surge_back', 'joy_stretch'];
export const FRAMES = [...KIT_FRAMES, 'think_0', 'think_1', 'think_2', 'think_3'];
export const FI = Object.fromEntries(FRAMES.map((f, i) => [f, i]));
// each frame's face in the race (the kit's own sequences: samples/race-kit/src/compose.py SETS)
export const EXPR = { idle: 'open', scoot: 'determined', hop: 'determined', bound: 'determined', surge: 'cheer', joy: 'happy', think: 'think' };
export const exprOf = id => EXPR[id.split('_')[0]] || 'open';
// the kit frame a think frame is drawn from
export const kitFrameOf = id => (id.startsWith('think_') ? 'idle_' + id.slice(6) : id);
const CYC = {
  idle: [FI.idle_0, FI.idle_1, FI.idle_2, FI.idle_3],
  think: [FI.think_0, FI.think_1, FI.think_2, FI.think_3],
  scoot: [FI.scoot_0, FI.scoot_1, FI.scoot_2, FI.scoot_3],
  hop: [FI.hop_crouch, FI.hop_launch, FI.hop_air1, FI.hop_air2, FI.hop_land, FI.hop_recover],
  bound: [FI.hop_crouch, FI.hop_launch, FI.bound_lean, FI.bound_flat, FI.hop_land, FI.hop_recover],
  joy: [FI.hop_crouch, FI.hop_launch, FI.joy_stretch, FI.hop_air2, FI.hop_land, FI.hop_recover],
};
CYC.trail = CYC.bound;
export const LAND = FI.hop_land;
const smooth = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const pick = (seed, salt, n) => (Math.imul((seed ^ Math.imul(salt + 1, 2654435761)) >>> 0, 2246822519) >>> 0) % n;

export class RacePlan {
  // race: core/race.js raceOf; opts: reduced (Reduced motion), hill (the mound's height per column, from the kit),
  // width (the screen in art px)
  constructor(race, { reduced = false, hill = [], width = 195 } = {}) {
    const V = RC().view, T = RC().time;
    this.reduced = !!reduced;
    this.width = width;
    this.n = race.runners.length;
    this.hill = Float64Array.from(hill);
    this.leg = reduced ? V.legReduced : V.leg;
    this.gapK = reduced ? V.gapReduced : 1;
    this.v = this.leg / T.leg;
    this.gate = T.gate;
    this.legT = T.leg;
    this.tLine = T.gate + 3 * T.leg;
    this.tEnd = this.tLine + T.finish;
    this.x0 = V.x0;
    this.lineX = V.x0 + 3 * this.leg;
    this.hillX = V.x0 + this.leg + Math.round(V.hill * this.leg);
    this.hoopX = V.hoops.map(f => V.x0 + 2 * this.leg + Math.round(f * this.leg));
    this.rings = T.cheerAt.map((a, k) => T.gate + k * T.leg + a);
    // per runner (pre-sized: nothing is made per frame)
    this.b = [new Float64Array(this.n), new Float64Array(this.n), new Float64Array(this.n), new Float64Array(this.n)];
    this.off = new Float64Array(this.n);
    this.offAt = -1e9;
    this.phase = new Float64Array(this.n);
    this.gait = [];
    this.lane = new Int32Array(this.n);
    this.youI = 0;
    this.surgeAt = -1e9;
    this.camO = 0;
    this.camT = -1;
    this.race = null;
    this.set(race, 0, true);
  }
  // A new race (after a cheer or the pat), at race time t: every runner eases from where it shows now.
  set(race, t, first = false) {
    const was = first ? null : Float64Array.from({ length: this.n }, (_, i) => this.behind(i, t));
    this.race = race;
    this.seed = race.seed >>> 0;
    for (let k = 0; k < 4; k++) for (let i = 0; i < this.n; i++) this.b[k][i] = race.behind[k][i] * this.gapK;
    this.gait = race.runners.map(r => r.gaits.slice());
    for (let i = 0; i < this.n; i++) {
      this.lane[i] = race.runners[i].lane;
      if (race.runners[i].you) this.youI = i;
      this.phase[i] = pick(this.seed, i + 3, 12) / RC().view.fps;
    }
    if (was) {
      this.offAt = -1e9;
      for (let i = 0; i < this.n; i++) this.off[i] = was[i] - this.behind(i, t);
      this.offAt = t;
    }
  }
  surge(t) { this.surgeAt = t; }

  // ---------- where ----------
  front(t) {
    if (t <= this.gate) return this.x0;
    if (t <= this.tLine) return this.x0 + this.v * (t - this.gate);
    const s = RC().view.settle;
    return this.lineX + this.v * s * (1 - Math.exp(-(t - this.tLine) / s));
  }
  // how far behind the front runner i shows at race time t (art px)
  behind(i, t) {
    let b;
    if (t <= this.gate) b = 0;
    else if (t < this.tLine) {
      const u = (t - this.gate) / this.legT, k = Math.min(2, Math.floor(u));
      b = this.b[k][i] + (this.b[k + 1][i] - this.b[k][i]) * smooth(u - k);
    } else b = this.b[3][i] * (1 - smooth((t - this.tLine) / RC().view.gather));
    if (this.offAt > -1e8) b += this.off[i] * (1 - smooth((t - this.offAt) / RC().view.surge));
    return b;
  }
  x(i, t) { return this.front(t) - this.behind(i, t); }
  hillAt(x) {
    const c = Math.floor(x - this.hillX);
    return c >= 0 && c < this.hill.length ? this.hill[c] : 0;
  }
  // the y of runner i's ground (its sprite's bottom row) at world x: its lane's front line, 1 px up, over the hill
  ground(i, x) { return RC().view.lanes[this.lane[i]] - 1 - this.hillAt(x); }

  // ---------- the camera ----------
  // Normal: your slime at youX, unless a runner would be cut by the left edge (eased). Reduced motion: one still shot per
  // leg (cut at each leg's start). Returns the world x at the screen's left edge.
  camera(t, dt) {
    const V = RC().view;
    if (this.reduced) {
      const k = t < this.gate ? 0 : t >= this.tLine ? 3 : Math.min(2, Math.floor((t - this.gate) / this.legT));
      const at = k === 3 ? this.tLine : this.gate + k * this.legT;
      return this.front(at) - V.shotReduced;
    }
    const want = this.x(this.youI, t) - V.youX;
    let minX = 1e9;
    for (let i = 0; i < this.n; i++) { const x = this.x(i, t); if (x < minX) minX = x; }
    const o = Math.max(0, want - (minX - V.edge));
    if (dt <= 0 && this.camT >= 0) return want - Math.max(o, this.camO);   // a look without moving the camera on
    if (this.camT < 0) this.camO = o;
    else this.camO = Math.max(o, this.camO + (o - this.camO) * (1 - Math.exp(-dt * 4)));   // never cuts anyone; eases back
    this.camT = t;
    return want - this.camO;
  }

  // ---------- which frame ----------
  legOf(t) { return t < this.gate ? -1 : Math.min(2, Math.floor((t - this.gate) / this.legT)); }
  // runner i's atlas frame index at race time t
  frame(i, t) {
    const V = RC().view, ph = this.phase[i];
    if (this.reduced || t < this.gate) return CYC.idle[Math.floor((t + ph) * V.idleFps) % 4];
    if (i === this.youI && t - this.surgeAt < V.surge && t - this.surgeAt >= 0) {
      const u = (t - this.surgeAt) / V.surge;
      return u < 0.42 ? FI.surge_long : u < 0.75 ? FI.surge_spark : FI.surge_back;
    }
    if (t >= this.tLine + V.gather) return CYC.joy[Math.floor((t + ph) * V.fps * 0.8) % 6];
    const k = Math.max(0, this.legOf(t)), g = this.gait[i][Math.min(k, 2)];
    if (k === 2 && (g === 'scoot' || g === 'hop') && t < this.tLine) {
      const x = this.x(i, t);
      for (let h = 0; h < 3; h++) {
        const d = this.hoopX[h] - 20 - x;
        if (d >= 0 && d < V.think * this.v) return CYC.think[Math.floor((t + ph) * V.idleFps) % 4];
      }
    }
    const c = CYC[g] || CYC.hop;
    return c[Math.floor((t + ph) * V.fps) % c.length];
  }
  lift(f) { return RC().view.lift[FRAMES[f]] || 0; }
  gaitOf(i, t) { return this.gait[i][Math.max(0, Math.min(2, this.legOf(t)))]; }

  // ---------- the clock ----------
  // how fast the race clock runs at race time t: the photo finish's slow motion before the line (not with Reduced motion)
  rate(t) {
    const P = RC().photo;
    if (this.reduced || !this.race.finish.photo) return 1;
    return t >= this.tLine - P.slow && t < this.tLine ? P.speed : 1;
  }
  // the caller line showing at race time t (an index into race.calls, -1 before the first)
  callAt(t) {
    const c = this.race.calls;
    let k = -1;
    for (let i = 0; i < c.length; i++) if (c[i].at <= t) k = i;
    return k;
  }
}
