// The Cozy Scarf's fit (pure math: no three.js, no DOM; view/slime.js draws with it, tools/recipe-test.mjs checks it).
// models.js knits the scarf as a round ring on a unit circle (the knit, a striped band and a tail). Worn, it follows the
// body's real outline at its height: every frame the body is sampled around the ring with the avatar's own shape() (so
// it rides squash, wobble, boops, growth and the breed blend), and each vertex is set on that outline at its angle,
// pushed out along the body's surface by a small gap plus its own place inside the knit. The tail comes out from under
// the knit at the front-right and hangs straight down, resting on the body wherever the body pushes out below it.
// Where (scarfHeight): just under the mouth (its lowest everyday point, face.js mouthLow), settling a little lower into
// a narrower neck when the body has one there; never in the goo lip or the puddle. Worked out on the body without its
// quick moves (squash, lean, boops, wobble), so a boop never makes it jump; it follows the goo's slow lumps.
import { TAU, clamp } from './body.js';

export const SCARF = {
  samples: 32,      // angles the body is sampled at around the ring, every frame
  gap: 0.006,       // between the body's surface and the inside of the knit (body units)
  tube: 0.085,      // the knit's radius in the model; worn, it scales with the body's width under the mouth...
  slim: 0.6,        // ...and slims down to this share of that on a body with less room under the mouth (a tiny baby)
  clear: 0.01,      // the knit's top stays this far under the mouth's lowest everyday point (body units)
  neck: 0.16,       // how much lower (radians on the body) it may settle into a narrower neck...
  neckDepth: 0.01,  // ...one at least this much narrower than above and below it (body units)
  floor: 0.1,       // the knit's bottom stays at least this high above the floor...
  lipTop: 0.5,      // ...and above a goo lip (its center plus this many of its widths; the mouth still wins)
  lipMin: 0.06,     // (a lip smaller than this hardly shows: a baby's)
  tailFloor: 0.06,  // the tail's end stays this high above the floor (the tail gets shorter when there is less room)
  tailMin: 0.3,     // ...but never shorter than this share of its length
  drape: 8,         // body samples under the tail, every frame...
  drapeSpan: 1.0,   // ...down this far (radians on the body) below the ring
};

// REACH: the body is also sampled this far (radians) above and below the ring, about the knit's own height: the
// surface's slope there tilts the knit, and in a tight crease (a hard squash) the knit rests on its walls instead
const STEP = 0.01, NECK_STEP = 0.02, REACH = 0.06, MOUTH_AZ = [Math.PI / 2, Math.PI / 2 - 0.11, Math.PI / 2 + 0.11];

// Once per worn scarf mesh (positions and normals already in the scarf's own space, the ring on the unit circle around
// the y axis): each vertex's angle, its offset from the knit's center line (dr outward, dy up), its normal in that frame
// (nr outward, nt along the ring, ny up) and its sample weights (Catmull-Rom for the outline, linear for its facing).
export function scarfLayout(pos, nrm, tail = false, N = SCARF.samples) {
  const n = pos.length / 3, F = k => new Float32Array(k);
  const L = { n, tail, N, i0: new Int32Array(n), f: F(n), w: F(n * 4), dw: F(n * 4), dr: F(n), dy: F(n), nr: F(n), nt: F(n), ny: F(n),
    drIn: Infinity, dyMin: Infinity, aMid: 0 };
  let mx = 0, mz = 0;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const a = Math.atan2(z, x), ca = Math.cos(a), sa = Math.sin(a);
    L.dr[i] = Math.hypot(x, z) - 1; L.dy[i] = y;
    const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
    L.nr[i] = nx * ca + nz * sa; L.nt[i] = -nx * sa + nz * ca; L.ny[i] = ny;
    let s = (a / TAU) % 1; if (s < 0) s += 1; s *= N;
    const i0 = Math.min(N - 1, Math.floor(s)), f = s - i0, f2 = f * f, f3 = f2 * f;
    L.i0[i] = i0; L.f[i] = f;
    L.w.set([(-f3 + 2 * f2 - f) / 2, (3 * f3 - 5 * f2 + 2) / 2, (-3 * f3 + 4 * f2 + f) / 2, (f3 - f2) / 2], i * 4);
    L.dw.set([(-3 * f2 + 4 * f - 1) / 2, (9 * f2 - 10 * f) / 2, (-9 * f2 + 8 * f + 1) / 2, (3 * f2 - 2 * f) / 2], i * 4);
    L.drIn = Math.min(L.drIn, L.dr[i]); L.dyMin = Math.min(L.dyMin, y);
    mx += x; mz += z;
  }
  L.aMid = Math.atan2(mz, mx);
  return L;
}

// Where the scarf sits on `body` (its shape() without the quick moves; body.S its recipe): el = the ring's elevation
// on the unit body (radians), t = the knit's radius, yC / top / bottom = the knit's center, top and bottom at the
// front. chinEl: the elevation of the mouth's lowest everyday point on the face's center line.
export function scarfHeight(body, chinEl, out = {}) {
  const S = body.S, o = { x: 0, y: 0, z: 0 };
  const front = e => body.shape(0, Math.sin(e), Math.cos(e), Math.PI / 2, o);
  const meanR = e => {
    const ce = Math.cos(e), se = Math.sin(e);
    body.shape(0, se, 0, 0, o); const cx = o.x, cz = o.z;
    let s = 0;
    for (let k = 0; k < 16; k++) { const a = k * TAU / 16; body.shape(ce * Math.cos(a), se, ce * Math.sin(a), a, o); s += Math.hypot(o.x - cx, o.z - cz); }
    return s / 16;
  };
  const yChin = front(chinEl).y;
  const t0 = SCARF.tube * meanR(chinEl);
  let t = t0;
  // the knit at elevation e, under the mouth (the front, and a little to each side: the mouth is that wide): out from
  // the surface along its normal (the body's slope tilts it)
  const at = (e, a) => body.shape(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a), a, o);
  const knit = e => {
    let top = -9, bottom = 9, cy0 = 0;
    for (const a of MOUTH_AZ) {
      at(e + REACH, a); const uy = o.y, ur = Math.hypot(o.x, o.z);
      at(e - REACH, a); const vy = uy - o.y, vr = ur - Math.hypot(o.x, o.z), l = Math.hypot(vy, vr) || 1;
      const cy = at(e, a).y + (-vr / l) * (SCARF.gap + t);
      top = Math.max(top, cy + t); bottom = Math.min(bottom, cy - t);
      if (a === MOUTH_AZ[0]) cy0 = cy;
    }
    return { top, bottom, cy: cy0 };
  };
  const yLip = S.lip >= SCARF.lipMin ? front(Math.asin(clamp(S.lipc + SCARF.lipTop * S.lipw, -1, 1))).y : 0;
  const yLow = Math.max(yLip, SCARF.floor);
  // just under the mouth: walk down until the knit's top clears it (a body with less room than the knit is thick
  // gets a slimmer knit)
  let e = chinEl;
  for (let pass = 0; pass < 4; pass++) {
    e = chinEl;
    while (e > -1.2 && knit(e).top > yChin - SCARF.clear) e -= STEP;
    // (then exactly where it clears, so the height moves smoothly as the goo does)
    let lo = e, hi = Math.min(chinEl, e + STEP);
    for (let k = 0; k < 5; k++) { const mid = (lo + hi) / 2; if (knit(mid).top > yChin - SCARF.clear) hi = mid; else lo = mid; }
    e = lo;
    const short = yLow - knit(e).bottom;
    if (short <= 0.001 || t <= t0 * SCARF.slim + 1e-6) break;
    t = Math.max(t0 * SCARF.slim, t - short / 2 - 0.001);
  }
  const eMouth = e;
  // a narrower neck a little lower (clearly narrower than under the mouth, and clearly wider again under it) holds it
  // better; a body that keeps getting narrower down there (a ball's round bottom), or whose slow lumps only ripple, has
  // no neck, so the scarf stays under the mouth
  const K = Math.round(SCARF.neck / NECK_STEP), Rs = [];
  for (let k = 0; k <= K; k++) Rs.push(meanR(e - k * NECK_STEP));
  let j = 0;
  for (let k = 1; k < K; k++) if (Rs[k] < Rs[j] && Rs[k] <= Rs[0] - SCARF.neckDepth && Math.max(...Rs.slice(k + 1)) >= Rs[k] + SCARF.neckDepth) j = k;
  e -= j * NECK_STEP;
  // never in the goo lip or the puddle: the knit's bottom stays above the lip's top and off the floor (but never
  // higher than just under the mouth)
  while (e < eMouth - 1e-9 && knit(e).bottom < yLow) e = Math.min(eMouth, e + STEP);
  const kn = knit(e);
  out.el = e; out.t = t; out.yC = kn.cy; out.top = kn.top; out.bottom = kn.bottom; out.yChin = yChin; out.yLip = yLip; out.neck = j * NECK_STEP;
  return out;
}

// Scratch buffers for fitScarf (one set per avatar).
export function scarfScratch(N = SCARF.samples) {
  const v3 = () => new Float64Array(N * 3);
  return { P: v3(), Qu: v3(), Qd: v3(), U: v3(), Sp: new Float64Array(N), D: new Float64Array((SCARF.drape + 1) * 2), o: { x: 0, y: 0, z: 0 }, C0: [0, 0, 0] };
}

// Every frame: sample the body (body.shape: the avatar's own, every physics term) around the ring at H.el and write
// each part's vertices (relative to the ring's center, returned) and normals into its pos / nrm arrays.
// parts: [{ L, pos, nrm }]. sq: the body's squash (a squash flattens the knit and shortens the tail, like the body).
export function fitScarf(body, H, parts, sq, X) {
  const N = SCARF.samples, { P, U, D, Qu, Qd, Sp, o } = X, el = H.el;
  const ce = Math.cos(el), se = Math.sin(el), cu = Math.cos(el + REACH), su = Math.sin(el + REACH), cd = Math.cos(el - REACH), sd = Math.sin(el - REACH);
  body.shape(0, se, 0, 0, o);
  const C0 = X.C0; C0[0] = o.x; C0[1] = o.y; C0[2] = o.z;
  for (let k = 0; k < N; k++) {
    const a = k * TAU / N, ca = Math.cos(a), sa = Math.sin(a), j = k * 3;
    body.shape(ce * ca, se, ce * sa, a, o); P[j] = o.x; P[j + 1] = o.y; P[j + 2] = o.z;
    body.shape(cu * ca, su, cu * sa, a, o); Qu[j] = o.x; Qu[j + 1] = o.y; Qu[j + 2] = o.z;
    body.shape(cd * ca, sd, cd * sa, a, o); Qd[j] = o.x; Qd[j + 1] = o.y; Qd[j + 2] = o.z;
  }
  const t = H.t, kk = t / SCARF.tube, g = SCARF.gap + t, nD = SCARF.drape + 1, fy = 1 + Math.min(0, sq);
  // the surface's outward normal at each sample (up the body, crossed with along the ring), and how much further out
  // the knit must sit to clear the body above and below it too (a crease tighter than the knit)
  for (let k = 0; k < N; k++) {
    const j = k * 3, jn = ((k + 1) % N) * 3, jp = ((k + N - 1) % N) * 3;
    const hx = P[jn] - P[jp], hy = P[jn + 1] - P[jp + 1], hz = P[jn + 2] - P[jp + 2], vx = Qu[j] - Qd[j], vy = Qu[j + 1] - Qd[j + 1], vz = Qu[j + 2] - Qd[j + 2];
    const nx = vy * hz - vz * hy, ny = vz * hx - vx * hz, nz = vx * hy - vy * hx, l = Math.hypot(nx, ny, nz) || 1;
    const ux = nx / l, uy = ny / l, uz = nz / l;
    U[j] = ux; U[j + 1] = uy; U[j + 2] = uz;
    let s = 0;
    for (const Q of [Qu, Qd]) {
      const wx = Q[j] - P[j] - ux * g, wy = Q[j + 1] - P[j + 1] - uy * g, wz = Q[j + 2] - P[j + 2] - uz * g;
      const ww = wx * wx + wy * wy + wz * wz, wu = wx * ux + wy * uy + wz * uz;
      if (ww < g * g) s = Math.max(s, wu + Math.sqrt(Math.max(0, wu * wu - ww + g * g)));
    }
    Sp[k] = s;
  }
  for (const part of parts) {
    const L = part.L, pos = part.pos, nrm = part.nrm;
    let ks = 1;
    if (L.tail) {
      // the tail's length: as much as fits above the floor (on the calm body), squashed along with the body
      ks = clamp((H.yC - SCARF.tailFloor) / (-L.dyMin * kk), SCARF.tailMin, 1) * (1 + Math.min(0, sq));
      // under the tail: how far the body pushes out below the ring (out from the ring's center, at the tail's angle)
      const a = L.aMid, ca = Math.cos(a), sa = Math.sin(a);
      body.shape(ce * ca, se, ce * sa, a, o);
      const px = o.x, pz = o.z, hl = Math.hypot(px - C0[0], pz - C0[2]) || 1, hx = (px - C0[0]) / hl, hz = (pz - C0[2]) / hl;
      D[0] = o.y; D[1] = 0;
      for (let m = 1; m < nD; m++) {
        const e2 = Math.max(-1.45, el - m * SCARF.drapeSpan / SCARF.drape), c2 = Math.cos(e2), s2 = Math.sin(e2);
        body.shape(c2 * ca, s2, c2 * sa, a, o);
        D[m * 2] = o.y; D[m * 2 + 1] = (o.x - px) * hx + (o.z - pz) * hz;
      }
    }
    for (let i = 0; i < L.n; i++) {
      const i0 = L.i0[i], f = L.f[i], b = i * 4;
      const jm = ((i0 + N - 1) % N) * 3, j0 = i0 * 3, j1 = ((i0 + 1) % N) * 3, j2 = ((i0 + 2) % N) * 3;
      const w0 = L.w[b], w1 = L.w[b + 1], w2 = L.w[b + 2], w3 = L.w[b + 3];
      const d0 = L.dw[b], d1 = L.dw[b + 1], d2 = L.dw[b + 2], d3 = L.dw[b + 3];
      // the body's outline at this vertex's angle, the ring's direction there and the surface's facing
      const px = w0 * P[jm] + w1 * P[j0] + w2 * P[j1] + w3 * P[j2];
      const py = w0 * P[jm + 1] + w1 * P[j0 + 1] + w2 * P[j1 + 1] + w3 * P[j2 + 1];
      const pz = w0 * P[jm + 2] + w1 * P[j0 + 2] + w2 * P[j1 + 2] + w3 * P[j2 + 2];
      let tx = d0 * P[jm] + d1 * P[j0] + d2 * P[j1] + d3 * P[j2];
      let ty = d0 * P[jm + 1] + d1 * P[j0 + 1] + d2 * P[j1 + 1] + d3 * P[j2 + 1];
      let tz = d0 * P[jm + 2] + d1 * P[j0 + 2] + d2 * P[j1 + 2] + d3 * P[j2 + 2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let ux = (1 - f) * U[j0] + f * U[j1], uy = (1 - f) * U[j0 + 1] + f * U[j1 + 1], uz = (1 - f) * U[j0 + 2] + f * U[j1 + 2];
      const ut = ux * tx + uy * ty + uz * tz; ux -= ut * tx; uy -= ut * ty; uz -= ut * tz;
      const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      const dr = L.dr[i], dy = L.dy[i], k3 = i * 3, nr = L.nr[i], nt = L.nt[i], ny = L.ny[i];
      if (!L.tail) {
        // the knit and its stripe: a tube around the outline, its inside touching the body (squashed along with it)
        const wx = ty * uz - tz * uy, wy = tz * ux - tx * uz, wz = tx * uy - ty * ux;
        const c = g + (1 - f) * Sp[i0] + f * Sp[(i0 + 1) % N], a = dr * kk, b = dy * kk * fy;
        pos[k3] = px + ux * c + a * ux + b * wx - C0[0];
        pos[k3 + 1] = py + uy * c + a * uy + b * wy - C0[1];
        pos[k3 + 2] = pz + uz * c + a * uz + b * wz - C0[2];
        const nu = nr * fy;
        nrm[k3] = nu * ux + nt * tx + ny * wx; nrm[k3 + 1] = nu * uy + nt * ty + ny * wy; nrm[k3 + 2] = nu * uz + nt * tz + ny * wz;
      } else {
        // the tail: its inside against the body at the ring, hanging straight down from there, resting on the body
        // where the body pushes out further below
        const hl = Math.hypot(ux, uz) || 1, hx = ux / hl, hz = uz / hl;
        const y = py + uy * g + dy * kk * ks;
        let out = 0;
        if (y < D[0]) {
          let m = 1; while (m < nD - 1 && D[m * 2] > y) m++;
          const ya = D[(m - 1) * 2], yb = D[m * 2], q = ya > yb ? clamp((ya - y) / (ya - yb), 0, 1) : 1;
          out = Math.max(0, D[(m - 1) * 2 + 1] + (D[m * 2 + 1] - D[(m - 1) * 2 + 1]) * q);
        }
        const r = SCARF.gap + (dr - L.drIn) * kk + out;
        pos[k3] = px + r * hx - C0[0];
        pos[k3 + 1] = y - C0[1];
        pos[k3 + 2] = pz + r * hz - C0[2];
        nrm[k3] = nr * hx - nt * hz; nrm[k3 + 1] = ny; nrm[k3 + 2] = nr * hz + nt * hx;
      }
    }
  }
  return C0;
}
