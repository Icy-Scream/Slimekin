// Greenhouse math with no three.js and no DOM, so node tests can run it: the room's ground height and roof, the
// camera you can turn (its limits, and drags and pinches that slide along a limit instead of jumping), where the
// slimeling pals may hop, and the helper spot check. Room coordinates: x right, y up, z toward you; the stump is at the
// origin. All numbers are in GREENHOUSE (src/data/content.js).
import { GREENHOUSE } from '../data/content.js';

const G = GREENHOUSE;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- the floor and the roof ----------
// Height of whatever is under a point: the stump's flat top, its side down to the rug, the braided rug, the planks.
export function groundY(x, z, g = G.ground) {
  const r = Math.hypot(x, z);
  if (r <= g.stumpFlat) return g.stumpTop;
  if (r <= g.stumpR) return g.stumpTop + (g.rugY - g.stumpTop) * (r - g.stumpFlat) / (g.stumpR - g.stumpFlat);
  if (r <= g.rugR) return g.rugY;
  if (r <= g.rugR + g.rugEdge) return g.rugY * (1 - (r - g.rugR) / g.rugEdge);
  return g.floorY;
}

// Height of the roof's underside above x (eaves on the side walls, the ridge over the middle).
export function roofY(x, R = G.roof) { return R.eave + (R.ridge - R.eave) * Math.max(0, R.half - Math.abs(x)) / R.half; }

// ---------- the camera ----------
// How far a camera is past each limit (0 or less = inside), in this order: side walls, floor, roof, front, too near
// the point it looks at, too far around the slime (degrees).
export const LIMIT_NAMES = ['side', 'floor', 'roof', 'front', 'near', 'around'];
export function camExcess(pos, look, pivot, size, L = G.camera.limits) {
  const [x, y, z] = pos;
  const near = L.near[0] + L.near[1] * size;
  const dl = Math.hypot(x - look[0], y - look[1], z - look[2]);
  const around = Math.abs(Math.atan2(x - pivot[0], z - pivot[2])) / DEG;   // 0 = straight on, 180 = from behind
  return [Math.abs(x) - L.x, L.yMin - y, y - (roofY(x) - L.roofGap), z - L.zMax, near - dl, around - L.around];
}
export const insideLimits = (e, slack = null, eps = 1e-6) => e.every((v, i) => v <= (slack ? slack[i] : 0) + eps);

// A turned camera, kept relative to the slime (the pivot): yaw around it (0 = straight on), pitch up from it, distance,
// and where it looks (an offset from the pivot per unit of distance, turning with the yaw, so a pinch zooms the whole
// picture about the slime and keeps it where it was on screen).
export function poseOf(st, pivot) {
  const cp = Math.cos(st.pitch), s = Math.sin(st.yaw), c = Math.cos(st.yaw), d = st.dist, [lx, ly, lz] = st.lo;
  return {
    pos: [pivot[0] + d * cp * s, pivot[1] + d * Math.sin(st.pitch), pivot[2] + d * cp * c],
    look: [pivot[0] + d * (lx * c + lz * s), pivot[1] + d * ly, pivot[2] + d * (-lx * s + lz * c)],
    fov: st.fov,
  };
}
export function stateOf(pos, look, fov, pivot) {
  const v = [pos[0] - pivot[0], pos[1] - pivot[1], pos[2] - pivot[2]];
  const dist = Math.max(1e-3, Math.hypot(...v));
  const yaw = Math.atan2(v[0], v[2]), pitch = Math.asin(clamp(v[1] / dist, -1, 1));
  const s = Math.sin(yaw), c = Math.cos(yaw), d = [look[0] - pivot[0], look[1] - pivot[1], look[2] - pivot[2]];
  return { yaw, pitch, dist, lo: [(d[0] * c - d[2] * s) / dist, d[1] / dist, (d[0] * s + d[2] * c) / dist], fov };
}

// The camera you turn yourself. begin() takes the camera from wherever it is (a set angle, or where a drag left it);
// turn() and pinch() move it; every move stops at the first limit on its way, one setting at a time, so a drag
// into a wall slides along it. A camera that starts outside a limit (the Front camera of a big slime on a phone sits a
// little past the front limit) is never moved further out, only in, and the limit tightens as it comes in.
export class CamRig {
  constructor(cfg = G.camera) { this.cfg = cfg; this.free = null; this.slack = null; this.size = 1; }
  reset() { this.free = null; this.slack = null; }
  begin(pos, look, fov, pivot, size) {
    if (!this.free) this.free = stateOf(pos, look, fov, pivot);
    this.size = size;
    const p = poseOf(this.free, pivot);
    // (a camera sitting on a limit, within rounding, is inside it: no slack creeps outward drag after drag)
    this.slack = camExcess(p.pos, p.look, pivot, size, this.cfg.limits).map(v => Math.max(0, v - 1e-6));
  }
  excess(st, pivot) { const p = poseOf(st, pivot); return camExcess(p.pos, p.look, pivot, this.size, this.cfg.limits); }
  ok(st, pivot) {
    const lim = this.cfg.limits.pitch * DEG;
    return Math.abs(st.pitch) <= lim && st.dist > 0.05 && insideLimits(this.excess(st, pivot), this.slack);
  }
  // move one setting toward `to`; stop at the first limit on the way
  step(key, to, pivot) {
    const st = this.free, from = st[key];
    const test = v => this.ok({ ...st, [key]: v }, pivot);
    if (test(to)) st[key] = to;
    else {
      let lo = 0, hi = 1;
      for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (test(from + (to - from) * m)) lo = m; else hi = m; }
      st[key] = from + (to - from) * lo;
    }
    const e = this.excess(st, pivot);
    this.slack = this.slack.map((s, i) => Math.max(0, Math.min(s, e[i])));
  }
  // a drag: dx, dy in pixels (right and down are positive). Grab-the-room feel: drag right and the room turns right
  // (the camera goes left around the slime); drag down and the camera rises.
  turn(dx, dy, pivot) {
    if (!this.free) return;
    if (dx) this.step('yaw', this.free.yaw - dx * this.cfg.turn, pivot);
    if (dy) this.step('pitch', this.free.pitch + dy * this.cfg.tilt, pivot);
  }
  // a pinch: k = finger distance now / before (fingers apart = nearer)
  pinch(k, pivot) {
    if (!this.free || !(k > 0)) return;
    const [a, b] = this.cfg.pinch;
    this.step('dist', this.free.dist / clamp(k, a, b), pivot);
  }
  pose(pivot) { return this.free ? poseOf(this.free, pivot) : null; }
}

// ---------- the slimeling pals ----------
// Pals hop on the rug and the floor in a ring around the stump (never into it), clear of every footprint and helper.
// blockers: [{ x, z, r }]. Returns a point or null (then the pal hops in place).
export function palSpotOk(x, z, blockers, palR = G.radius.slimeling, room = null) {
  const ring = G.spots.pals.ring, r = Math.hypot(x, z);
  if (r < ring[0] - 1e-9 || r > ring[1] + 1e-9) return false;
  if (room && (Math.abs(x) > room.x_in - palR || z < room.z_back_in + palR)) return false;
  return blockers.every(b => Math.hypot(x - b.x, z - b.z) >= b.r + palR);
}
// the hop from a to b stays clear of blockers too (checked along the way)
export function palHopOk(a, b, blockers, palR = G.radius.slimeling) {
  for (let i = 1; i < 8; i++) {
    const t = i / 8, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    if (!blockers.every(q => Math.hypot(x - q.x, z - q.z) >= q.r + palR)) return false;
  }
  return true;
}
export function palWander(from, rnd, blockers, room = null) {
  const P = G.spots.pals;
  const a0 = Math.atan2(from[0], from[1]);
  for (let k = 0; k < 10; k++) {
    const a = a0 + (rnd() * 2 - 1) * P.step, R = P.ring[0] + rnd() * (P.ring[1] - P.ring[0]);
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    if (palSpotOk(x, z, blockers, undefined, room) && palHopOk(from, [x, z], blockers)) return [x, z];
  }
  return null;
}
// a first spot for a new pal
export function palStart(rnd, blockers, room = null) {
  const P = G.spots.pals;
  for (let k = 0; k < 60; k++) {
    const a = rnd() * Math.PI * 2, R = P.ring[0] + rnd() * (P.ring[1] - P.ring[0]);
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    if (palSpotOk(x, z, blockers, undefined, room)) return [x, z];
  }
  return [0, P.ring[1]];
}
// one step of a pal's visit to the slime: around the ring toward the target, never across the stump
export function palToward(from, target, rnd, blockers, room = null) {
  const P = G.spots.pals;
  const a0 = Math.atan2(from[0], from[1]), a1 = Math.atan2(target[0], target[1]);
  let da = a1 - a0;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  if (Math.abs(da) <= P.step && palHopOk(from, target, blockers)) return target;
  const R = clamp(Math.hypot(...from), P.ring[0], P.ring[1]);
  for (const f of [1, 0.6, 0.3]) {
    const a = a0 + Math.sign(da) * Math.min(Math.abs(da), P.step) * f;
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    if (palSpotOk(x, z, blockers, undefined, room) && palHopOk(from, [x, z], blockers)) return [x, z];
  }
  return null;
}

// ---------- the helper spots ----------
// Every helper's place in the room for a number of copies shown: { id, x, z, r }.
export function helperSpots(shown) {
  const S = G.spots, R = G.radius, out = [];
  S.planters.slice(0, shown.garden).forEach(([x, z], i) => out.push({ id: 'planter' + i, x, z, r: R.planter }));
  S.lamps.slice(0, shown.lamp).forEach(([x, z], i) => out.push({ id: 'lamp' + i, x, z, r: R.lamp }));
  for (const id of ['bubbles', 'musicbox', 'fountain', 'spa', 'observatory']) out.push({ id, x: S[id][0], z: S[id][1], r: R[id] });
  return out;
}
// Problems with a set of spots: on a footprint, inside a wall or outside the room, on another helper.
// room and footprints come from gh.json.
export function spotProblems(spots, footprints, room, gap = 0.02) {
  const out = [];
  for (const s of spots) {
    if (Math.abs(s.x) + s.r > room.x_in - gap) out.push(`${s.id}: in a side wall (|x| ${Math.abs(s.x)} + r ${s.r} > ${room.x_in})`);
    if (s.z - s.r < room.z_back_in + gap) out.push(`${s.id}: in the back glass`);
    if (s.z + s.r > room.z_side_end) out.push(`${s.id}: past the end of the side walls`);
    for (const f of footprints) {
      const d = Math.hypot(s.x - f.x, s.z - f.z);
      if (d < s.r + f.r + gap) out.push(`${s.id}: on the ${f.name} (${d.toFixed(2)} < ${(s.r + f.r).toFixed(2)})`);
    }
  }
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
    const a = spots[i], b = spots[j], d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < a.r + b.r + gap) out.push(`${a.id} and ${b.id} overlap (${d.toFixed(2)} < ${(a.r + b.r).toFixed(2)})`);
  }
  return out;
}
