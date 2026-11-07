// The travel bubble's plain math (no three.js, no DOM, so node tests can run it): how big the bubble is for a slime,
// where it floats, whether it has left the picture, how close it is to the room, and the pop rule. All numbers are in
// SENDOFF (src/data/content.js). Room coordinates: x right, y up, z toward the front of the room; the cushion (or the
// Greenhouse stump) is at the origin.
//   The rule, each frame of the float: once the bubble has left the picture it is gone (it floated out). While any of it
//   is in the picture, the part of it you can see must stay clear of the room (the Greenhouse roof, walls, lantern and
//   furniture) by SENDOFF.gap.room: every line of sight through its picture passes through the whole bubble, grown by
//   the gap, before it meets anything. (Above the top of the picture, out of sight, it may rise past the roof's height:
//   from the home camera the roof is never in the picture.) And it keeps SENDOFF.gap.camera from the camera. Else it
//   pops in a burst of sparkles at the last moment that still holds; by SENDOFF.latest it pops anyway, before the white
//   fade. So the bubble is never seen touching or passing through anything, at any frame rate.
import { SENDOFF } from '../data/content.js';

const S0 = SENDOFF;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- the bubble's size ----------
// The smallest bubble that holds a slime of half width a and height h (an ellipse a by h/2) sitting `rest` x that
// radius above its bottom, made SENDOFF.pad times bigger about the same middle (so the slime has the same room to spare
// all round). Returns { r, lift }: the radius, and how far the slime's base sits above the bubble's bottom.
export function bubbleSize(a, h, S = S0) {
  const b = h / 2, fits = R => {
    const cy = -R + S.rest * R + b;   // the ellipse's middle, from the bubble's middle
    for (let i = 0; i < 72; i++) { const t = i / 72 * Math.PI * 2, x = a * Math.cos(t), y = cy + b * Math.sin(t); if (x * x + y * y > R * R) return false; }
    return true;
  };
  let lo = Math.max(a, b), hi = 4 * Math.max(a, b, 0.05);
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; }
  const r = hi * S.pad;
  return { r, lift: r - hi + S.rest * hi };
}

// How high the bubble's bottom sits while it grows and lifts off, for a slime resting at y = base (it sinks 0.03 into
// the cushion, whose top is base + 0.03): SENDOFF.gap.cushion over the cushion's top, plus room for its wobble (which
// moves its surface by up to SENDOFF.wobble of its radius r), so it never dips into the cushion.
export function bubbleBottom(base, r, S = S0) {
  return base + 0.03 + S.gap.cushion + S.wobble * r;
}

// The bubble growing around the slime (k: 0 -> 1 over SENDOFF.grow[1]): its radius starts just inside the slime's
// widest part (hidden in the body), then grows with a soft overshoot to its full size.
export function growAt(k, r, inner) {
  const p = clamp(k, 0, 1), c = 1.70158;
  const e = 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);   // easeOutBack
  return inner + (r - inner) * e;
}

// ---------- the float ----------
// How far it has risen t seconds after lift-off: eases in at rise.accel up to rise.top units a second.
export function riseAt(t, S = S0) {
  if (t <= 0) return 0;
  const a = S.rise.accel, v = S.rise.top, tv = v / a;
  return t < tv ? 0.5 * a * t * t : 0.5 * a * tv * tv + v * (t - tv);
}
// Where the bubble's middle is t seconds after lift-off, from where it lifted off: up, a little toward the camera
// (toward: the camera's direction on the floor, [x, z], length 1), a gentle sway across that direction, and for the
// baby a little toward the side its new family waits on (side: +1 or -1 along x; 0 for a grown slime).
export function floatAt(t, { toward = [0, 1], side = 0 } = {}, S = S0) {
  const h = riseAt(t, S), w = S.toward * h;
  const sway = S.sway.amp * Math.sin(t * S.sway.hz * Math.PI * 2) * clamp(h / 0.6, 0, 1);
  const [tx, tz] = toward;
  return [tx * w + tz * sway + side * S.side * h, h, tz * w - tx * sway];
}

// ---------- the picture ----------
// The picture's six edges from a camera's projection x view matrix (16 numbers, column-major, as three.js keeps them;
// the view offset that slides the picture above the menu is part of the projection). Each plane [a, b, c, d] faces
// in (a x + b y + c z + d >= 0 inside), in order: left, right, bottom, top, near, far.
export function framePlanes(m) {
  const row = i => [m[i], m[i + 4], m[i + 8], m[i + 12]], r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  const add = (p, q, s) => { const v = p.map((x, i) => x + s * q[i]), l = Math.hypot(v[0], v[1], v[2]) || 1; return v.map(x => x / l); };
  return [add(r3, r0, 1), add(r3, r0, -1), add(r3, r1, 1), add(r3, r1, -1), add(r3, r2, 1), add(r3, r2, -1)];
}
const side = (p, c) => p[0] * c[0] + p[1] * c[1] + p[2] * c[2] + p[3];
// Is any of the bubble (middle c, radius r) in the picture? False once it is wholly past one edge (or behind the
// camera's near plane).
export function inPicture(planes, c, r) {
  for (let i = 0; i < 5; i++) if (side(planes[i], c) < -r) return false;
  return true;
}

// ---------- the room ----------
// room: { planes: [{ n: [x, y, z], d, zMax? }] (inside where n.p + d >= 0; zMax: the plane only reaches that far toward
// the front, like the roof), balls: [{ c: [x, y, z], r, what }] (the lantern, jars), posts: [{ x, z, r, top, what }]
// (upright things on the floor) }. Returns the smallest gap between the bubble and any of them, and what it is.
export function clearance(c, r, room) {
  let gap = Infinity, what = null;
  const near = (g, w) => { if (g < gap) { gap = g; what = w; } };
  for (const p of room.planes || []) {
    if (p.zMax !== undefined && c[2] - r > p.zMax) continue;
    near(p.n[0] * c[0] + p.n[1] * c[1] + p.n[2] * c[2] + p.d - r, p.what || 'the room');
  }
  for (const b of room.balls || []) near(Math.hypot(c[0] - b.c[0], c[1] - b.c[1], c[2] - b.c[2]) - b.r - r, b.what || 'something');
  for (const q of room.posts || []) {
    const dxz = Math.hypot(c[0] - q.x, c[2] - q.z), dy = Math.max(0, c[1] - q.top);
    near(Math.hypot(Math.max(0, dxz - q.r), dy) - r, q.what || 'something');
  }
  return { gap, what };
}

// The Greenhouse as the bubble sees it, from gh.json (meta) and GREENHOUSE.roof: the two halves of the roof (they
// reach to the front of the side walls), the side walls, the back glass, the hanging lantern and jars, and the
// furniture on the floor. The stump the bubble rises from is left out.
export function greenhouseRoom(meta, roof) {
  const R = meta.room, s = (roof.ridge - roof.eave) / roof.half, k = Math.hypot(s, 1);
  return {
    planes: [
      { n: [-s / k, -1 / k, 0], d: roof.ridge / k, zMax: R.z_side_end, what: 'the roof' },
      { n: [s / k, -1 / k, 0], d: roof.ridge / k, zMax: R.z_side_end, what: 'the roof' },
      { n: [-1, 0, 0], d: R.x_in, zMax: R.z_side_end, what: 'the right wall' },
      { n: [1, 0, 0], d: R.x_in, zMax: R.z_side_end, what: 'the left wall' },
      { n: [0, 0, 1], d: -R.z_back_in, what: 'the back glass' },
    ],
    balls: [{ c: meta.lantern, r: 0.45, what: 'the lantern' }, ...(meta.jars || []).map(c => ({ c, r: 0.25, what: 'a jar' }))],
    posts: (meta.footprints || []).filter(f => f.name !== 'stump').map(f => ({ x: f.x, z: f.z, r: f.r, top: f.top, what: 'the ' + f.name })),
  };
}
// The open sky (the Meadow, the Classic look): nothing over it.
export const OPEN_SKY = { planes: [], balls: [], posts: [] };
// ---------- what you can see of it ----------
// Lines of sight through the bubble's picture: from the eye toward its middle and around rings out to just inside its
// outline (rings: [share of its outline, how many]), the ones inside the picture (the 4 side edges of planes).
export const SIGHT_RINGS = [[0, 1], [0.35, 6], [0.65, 10], [0.88, 14], [0.985, 20]];
export function sightLines(planes, eye, c, r, rings = SIGHT_RINGS) {
  const d = [c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]], dist = Math.hypot(...d);
  if (dist <= r) return null;   // (the eye inside the bubble)
  const f = d.map(v => v / dist), up = Math.abs(f[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0];
  const u = norm(cross(f, up)), v = cross(u, f), ang = Math.asin(r / dist), out = [];
  for (const [k, n] of rings) for (let i = 0; i < n; i++) {
    const a = k * ang, b = i / n * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a);
    const dir = [0, 1, 2].map(j => f[j] * ca + (u[j] * Math.cos(b) + v[j] * Math.sin(b)) * sa);
    const q = [eye[0] + dir[0], eye[1] + dir[1], eye[2] + dir[2]];
    let inside = true;
    for (let p = 0; p < 4; p++) if (side(planes[p], q) < 0) { inside = false; break; }
    if (inside) out.push(dir);
  }
  return out;
}
// Where a line of sight (from eye, along unit dir) first enters something of the room, or Infinity.
export function sightHit(room, eye, dir) {
  let best = Infinity, what = null;
  const take = (t, w) => { if (t >= 0 && t < best) { best = t; what = w; } };
  for (const p of room.planes || []) {
    // the solid side of a plane (n.p + d < 0), only as far toward the front as zMax
    const nd = p.n[0] * dir[0] + p.n[1] * dir[1] + p.n[2] * dir[2], ne = p.n[0] * eye[0] + p.n[1] * eye[1] + p.n[2] * eye[2] + p.d;
    let lo = 0, hi = Infinity;
    if (ne >= 0) { if (nd >= 0) continue; lo = -ne / nd; } else if (nd > 0) hi = -ne / nd;
    if (p.zMax !== undefined) {
      if (eye[2] > p.zMax) { if (dir[2] >= 0) continue; lo = Math.max(lo, (p.zMax - eye[2]) / dir[2]); } else if (dir[2] > 0) hi = Math.min(hi, (p.zMax - eye[2]) / dir[2]);
    }
    if (lo <= hi) take(lo, p.what || 'the room');
  }
  for (const b of room.balls || []) {
    const o = [eye[0] - b.c[0], eye[1] - b.c[1], eye[2] - b.c[2]], bq = o[0] * dir[0] + o[1] * dir[1] + o[2] * dir[2], cq = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - b.r * b.r, disc = bq * bq - cq;
    if (disc >= 0) take(Math.max(0, -bq - Math.sqrt(disc)), b.what || 'something');
  }
  for (const q of room.posts || []) {
    // an upright cylinder from the floor (y 0) to its top
    const ox = eye[0] - q.x, oz = eye[2] - q.z, A = dir[0] * dir[0] + dir[2] * dir[2], B = ox * dir[0] + oz * dir[2], C = ox * ox + oz * oz - q.r * q.r;
    let lo = 0, hi = Infinity;
    if (A < 1e-12) { if (C > 0) continue; } else { const disc = B * B - A * C; if (disc < 0) continue; lo = (-B - Math.sqrt(disc)) / A; hi = (-B + Math.sqrt(disc)) / A; }
    if (Math.abs(dir[1]) < 1e-12) { if (eye[1] > q.top || eye[1] < 0) continue; }
    else { const y0 = (0 - eye[1]) / dir[1], y1 = (q.top - eye[1]) / dir[1]; lo = Math.max(lo, Math.min(y0, y1)); hi = Math.min(hi, Math.max(y0, y1)); }
    if (lo <= hi && hi >= 0) take(Math.max(0, lo), q.what || 'something');
  }
  return { t: best, what };
}
// Is the bubble (grown by `pad`) seen meeting the room? A line of sight through its picture that meets the room before
// it has passed through the whole of it. Returns null (clear) or what it meets.
export function seenMeeting(planes, eye, c, r, room, pad = S0.gap.room) {
  const R = r + pad, lines = sightLines(planes, eye, c, R);
  if (!lines) return 'the camera';
  for (const dir of lines) {
    const o = [eye[0] - c[0], eye[1] - c[1], eye[2] - c[2]], bq = o[0] * dir[0] + o[1] * dir[1] + o[2] * dir[2], cq = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - R * R, disc = bq * bq - cq;
    if (disc < 0) continue;
    const t1 = -bq + Math.sqrt(disc), h = sightHit(room, eye, dir);
    if (h.t < t1) return h.what;
  }
  return null;
}

// ---------- the rule ----------
// One frame of the float, from the last frame (t0, when it was clear) to this one (t1); path(t) = the bubble's middle;
// eye: the camera.
//   'out'   it has left the picture: it is gone;
//   'pop'   it is still in the picture and would be seen within SENDOFF.gap.room of the room, or within
//           SENDOFF.gap.camera of the camera: it pops at the last moment on the way that still holds (t, c), so no
//           frame ever shows it nearer, whatever the frame rate; or it is SENDOFF.latest (it pops where it is);
//   'float' on it goes.
export function floatFrame(planes, eye, path, r, room, t0, t1, S = S0) {
  const c1 = path(t1);
  if (!inPicture(planes, c1, r)) return { step: 'out', t: t1, c: c1 };
  const bad = c => (Math.hypot(c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]) - r < S.gap.camera ? 'the camera' : seenMeeting(planes, eye, c, r, room, S.gap.room));
  const why = bad(c1);
  if (!why) return t1 >= S.latest - S.lift ? { step: 'pop', why: 'time', t: t1, c: c1 } : { step: 'float', t: t1, c: c1 };
  let lo = t0, hi = t1;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (!bad(path(m))) lo = m; else hi = m; }
  return { step: 'pop', why, t: lo, c: path(lo) };
}
// How much the bubble swells as it pops (a share of its radius): up to SENDOFF.popSwell, and never by more than the gap
// it kept from the room less its wobble and a sliver, so the swell is never seen meeting anything either.
export function popSwell(r, S = S0) {
  return Math.min(S.popSwell * r, S.gap.room - S.wobble * r - S.gap.cushion) / r;
}
// The whole float for a camera that holds still (node tests): from lift-off, a frame every dt. start: the bubble's
// middle at lift-off; eye: the camera; o: floatAt's options. Returns the last frame: { step: 'out' | 'pop', t, c, why }.
export function planFloat(planes, eye, start, r, room, o = {}, S = S0, dt = 1 / 60) {
  const path = t => { const f = floatAt(t, o, S); return [start[0] + f[0], start[1] + f[1], start[2] + f[2]]; };
  for (let t = 0; ; t += dt) {
    const s = floatFrame(planes, eye, path, r, room, Math.max(0, t - dt), t, S);
    if (s.step !== 'float') return s;
  }
}

// ---------- a camera, for the node tests ----------
// The projection x view matrix of a three.js PerspectiveCamera at pos looking at look (up +y), vertical fov in
// degrees, with an optional view offset (offY pixels of a picture h pixels high, as Stage.resize sets).
export function cameraMatrix({ pos, look, fov, aspect, near = 0.1, far = 120, offY = 0, h = 852 }) {
  // view: lookAt
  const z = norm(sub(pos, look)), x = norm(cross([0, 1, 0], z)), y = cross(z, x);
  const view = [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, pos), -dot(y, pos), -dot(z, pos), 1];
  // projection with the view offset (three.js PerspectiveCamera.updateProjectionMatrix)
  let top = near * Math.tan(fov * Math.PI / 360), height = 2 * top, width = aspect * height, left = -0.5 * width;
  top -= offY * height / h;
  const right = left + width, bottom = top - height;
  const proj = [2 * near / (right - left), 0, 0, 0, 0, 2 * near / (top - bottom), 0, 0,
    (right + left) / (right - left), (top + bottom) / (top - bottom), -(far + near) / (far - near), -1, 0, 0, -2 * far * near / (far - near), 0];
  return mul(proj, view);
}
// where a point lands in the picture (-1..1 both ways, y up), or null behind the camera
export function project(m, p) {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return w > 0 ? [x / w, y / w] : null;
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
