// The recipe body's pure math (no three.js, no DOM, so node tests run it too; view/slime.js draws with it).
// One body for every slime: unit directions in rings around the curl's axis A0 (leaning back and to the right),
// denser along the curl, so the same points can be the baby drop, a Dollop's dome or a Curly's curl. restShape is the
// resting body for a recipe (core/recipe.js, BREEDS in content.js) with slow goo motion and a grown-up form's shape on
// top; curlFrame is the curl's base ring and centerline for this frame.

export const BOTTOM = 0.42;      // depth of the flattened lower half
export const HEIGHT = 1.39;      // total rest height (local units)
export const CENTER_Y = 0.6;
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const nrm3 = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
export const A0 = nrm3(0.3, 1, -0.25);
export const B0 = (() => { const b = [1, 0, -0.35], d = b[0] * A0[0] + b[1] * A0[1] + b[2] * A0[2]; return nrm3(b[0] - d * A0[0], b[1] - d * A0[1], b[2] - d * A0[2]); })();
export const N0 = [A0[1] * B0[2] - A0[2] * B0[1], A0[2] * B0[0] - A0[0] * B0[2], A0[0] * B0[1] - A0[1] * B0[0]];
const [A0x, A0y, A0z] = A0;

// curl rings, body rings, points around each ring: the pet's body (5,618 points) and a lighter one (1,370 points)
// for ranch residents (and the pet on Low graphics). Same math, fewer rings.
export const BODY_RES = { full: [34, 46, 72], lite: [17, 23, 36] };
export const ARM_THETA = 0.5;   // the ring band reserved for the curl (radians around A0); denser toward the tip
const TOPOLOGY = {};
export function bodyTopology(kind) {
  if (TOPOLOGY[kind]) return TOPOLOGY[kind];
  const [armRings, bodyRings, seg] = BODY_RES[kind], p = 1.5, th = [];
  for (let j = armRings; j >= 1; j--) { const t = ARM_THETA * Math.pow(1 - j / armRings, 1 / p); if (t > 1e-6) th.push(t); }
  for (let i = 1; i < bodyRings; i++) th.push(ARM_THETA + (Math.PI - ARM_THETA) * i / bodyRings);
  const dirs = [A0.slice()];
  for (const t of th) for (let k = 0; k < seg; k++) {
    const f = TAU * k / seg, c = Math.cos(t), s = Math.sin(t), cf = Math.cos(f), sf = Math.sin(f);
    dirs.push([c * A0[0] + s * (cf * B0[0] + sf * N0[0]), c * A0[1] + s * (cf * B0[1] + sf * N0[1]), c * A0[2] + s * (cf * B0[2] + sf * N0[2])]);
  }
  dirs.push([-A0[0], -A0[1], -A0[2]]);
  const tris = [];
  for (let k = 0; k < seg; k++) tris.push([0, 1 + k, 1 + (k + 1) % seg]);
  for (let r = 0; r < th.length - 1; r++) {
    const a = 1 + r * seg, b = 1 + (r + 1) * seg;
    for (let k = 0; k < seg; k++) { const k1 = (k + 1) % seg; tris.push([a + k, b + k, b + k1]); tris.push([a + k, b + k1, a + k1]); }
  }
  const last = 1 + (th.length - 1) * seg, bot = dirs.length - 1;
  for (let k = 0; k < seg; k++) tris.push([last + k, bot, last + (k + 1) % seg]);
  // wind every triangle outward
  const idx = [];
  for (const [i, j, k] of tris) {
    const a = dirs[i], b = dirs[j], c = dirs[k];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * (a[0] + b[0] + c[0]) + ny * (a[1] + b[1] + c[1]) + nz * (a[2] + b[2] + c[2]) >= 0) idx.push(i, j, k); else idx.push(i, k, j);
  }
  const n = dirs.length, base = new Float32Array(n * 3), baseAz = new Float32Array(n), uvs = new Float32Array(n * 2);
  dirs.forEach((d, i) => {
    base.set(d, i * 3); baseAz[i] = Math.atan2(d[2], d[0]);
    // wrap-around UVs (seam at the back) so grown-up forms can paint patterns on the body
    uvs[i * 2] = 0.5 + Math.atan2(d[0], d[2]) / TAU; uvs[i * 2 + 1] = 0.5 + Math.asin(clamp(d[1], -1, 1)) / Math.PI;
  });
  TOPOLOGY[kind] = { base, baseAz, uvs, index: n > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), count: n };
  return TOPOLOGY[kind];
}

// The resting body for a recipe S at time T (slow goo motion), with a grown-up form's shape F on top (or null).
export function restShape(px, py, pz, az, S, T, F, o) {
  let x, y, z;
  if (py < 0) { const t = -py, tt = 1 - t; y = -BOTTOM * (1 - tt * tt * tt); const w = 1 + 0.14 * t; x = px * w * S.wide; z = pz * w * S.wide; }
  else { y = py * 0.97; const w = 1 - 0.07 * py * py; x = px * w * S.wide; z = pz * w * S.wide; }
  let al = px * A0x + py * A0y + pz * A0z; al = al > 0 ? al : 0; const k = al * al * al;
  if (py > 0) y *= S.tall * (1 + S.peak * k * 0.32);
  const f = 1 - S.peak * k * 0.8; x *= f; z *= f;
  if (S.side) { const f2 = 1 + S.side * Math.sin(Math.PI * clamp(py, 0, 1)); x *= f2; z *= f2; }
  if (S.flat && py > 0) { const c1 = clamp(py, 0, 1); y *= 1 - S.flat * c1 * c1 * c1 * c1; }
  const q = (py - S.lipc) / S.lipw; let lb = Math.exp(-q * q); if (py < S.lipc) lb = 0.9 + 0.1 * lb;
  const flow = 1 + S.flowA * (0.25 * Math.sin(az * 3 + 0.7 + T * 0.45) + 0.14 * Math.sin(az * 5 + 2.0 - T * 0.6) + S.flow2 * Math.sin(az * 2 + 2.6 + T * 0.3));
  const qc = (py - 0.02) / 0.1;
  let kr = 1 + S.lip * lb * flow - S.crease * (0.5 + 0.5 * Math.sin(az * 2 + 1.0)) * Math.exp(-qc * qc);
  if (S.skirtWave) { const qs = (py + 0.12) / 0.16; kr += S.skirtWave * Math.sin(az * 4 + 1.0 + T * 0.35) * Math.exp(-qs * qs); }
  if (S.baseFlow) { const qb = (py + 0.26) / 0.22; kr += S.baseFlow * (0.6 * Math.sin(az * 3 + 0.7 + T * 0.45) + 0.4 * Math.sin(az * 5 + 2.0 - T * 0.6)) * Math.exp(-qb * qb); }
  x *= kr; z *= kr;
  if (py < 0) y += (-BOTTOM - y) * Math.min(1, S.lip * lb * S.sag);
  // a grown-up form's shape on top (forms.js `shape`): squarer, wider, taller, a pointed top
  if (F) {
    if (F.square) {
      const r2 = Math.sqrt(x * x + z * z);
      if (r2 > 1e-4) { const r4 = Math.sqrt(Math.sqrt(x ** 4 + z ** 4)); const kk = 1 + (r2 / r4 - 1) * F.square; x *= kk; z *= kk; }
    }
    if (F.wide !== 1) { x *= F.wide; z *= F.wide; }
    if (F.tall !== 1 && py > 0) y *= F.tall;
    if (F.peak && py > 0) { const kk = py * py * py; x *= 1 - F.peak * kk * 0.8; z *= 1 - F.peak * kk * 0.8; y *= 1 + F.peak * kk * 0.32; }
  }
  o.x = x; o.y = y + BOTTOM; o.z = z;
  return o;
}

// The curl's frame for this frame (null without a curl): its base ring (center C, radius r0), axis A, the bend
// plane (Bv, N) and the centerline (cA, cB, ph: 129 samples). It lags behind the lean (dyn: the sway spring), droops
// when squashed (sqx) and straightens while its tip is pulled (pullAmt, tipGrab). out: reused arrays (optional).
export function curlFrame(S, T, F, dyn, sqx, pullAmt, tipGrab, out = null) {
  if (S.armK <= 0.001) return null;
  const o = { x: 0, y: 0, z: 0 }, R = [];
  const th = S.theta, c0 = Math.cos(th), s0 = Math.sin(th);
  for (let i = 0; i < 12; i++) {
    const f = TAU * i / 12, cf = Math.cos(f), sf = Math.sin(f);
    const dx = c0 * A0[0] + s0 * (cf * B0[0] + sf * N0[0]), dy = c0 * A0[1] + s0 * (cf * B0[1] + sf * N0[1]), dz = c0 * A0[2] + s0 * (cf * B0[2] + sf * N0[2]);
    restShape(dx, dy, dz, Math.atan2(dz, dx), S, T, F, o); R.push([o.x, o.y, o.z]);
  }
  const C = [0, 0, 0]; for (const r of R) { C[0] += r[0] / 12; C[1] += r[1] / 12; C[2] += r[2] / 12; }
  let r0 = 0; for (const r of R) r0 += Math.hypot(r[0] - C[0], r[1] - C[1], r[2] - C[2]) / 12; r0 *= 0.97;
  const X = [R[0][0] - R[6][0], R[0][1] - R[6][1], R[0][2] - R[6][2]], Y = [R[3][0] - R[9][0], R[3][1] - R[9][1], R[3][2] - R[9][2]];
  let A = nrm3(X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]); if (A[1] < 0) A = [-A[0], -A[1], -A[2]];
  const bx = X[0] + dyn.sx, by = X[1], bz = X[2] + dyn.sz;
  const dA = bx * A[0] + by * A[1] + bz * A[2];
  const Bv = nrm3(bx - dA * A[0], by - dA * A[1], bz - dA * A[2]);
  const N = [A[1] * Bv[2] - A[2] * Bv[1], A[2] * Bv[0] - A[0] * Bv[2], A[0] * Bv[1] - A[1] * Bv[0]];
  const st = tipGrab ? Math.min(1, (pullAmt || 0) / 0.6) : 0;   // pulling the tip straightens the curl
  const bend = (S.bend + clamp(-sqx * 1.4, -0.5, 0.8) + Math.sin(T * 1.6) * 0.06) * (1 - 0.6 * st);
  const cA = out ? out.cA : new Float32Array(129), cB = out ? out.cB : new Float32Array(129), ph = out ? out.ph : new Float32Array(129);
  const dl = S.L / 128;
  for (let i = 0; i <= 128; i++) ph[i] = bend * Math.pow(i / 128, 1.6);
  cA[0] = 0; cB[0] = 0;
  for (let i = 1; i <= 128; i++) { cA[i] = cA[i - 1] + Math.cos(ph[i - 1]) * dl; cB[i] = cB[i - 1] + Math.sin(ph[i - 1]) * dl; }
  return { th, c0, C, r0, A, Bv, N, cA, cB, ph };
}
