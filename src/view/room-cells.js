// The room's cells (terrarium-perf): plain math, no three.js (tools/greenhouse-test.mjs runs it in node).
// Each of the room's chunks (gh.bin) is one mesh with up to 120k triangles. Many of them are off the picture in any one
// camera angle (Front's picture shows about 40% of the room's triangles), and the slime's see-through body only ever
// shows the few behind it (about 6-9%). So, once at load, each chunk's triangles are re-sorted into small spatial cells
// (a k-d tree on the triangle centres, the long triangles kept apart so they don't stretch the small cells' boxes):
// every cell is a run of the sorted index list with a box round it. A pass then draws only the cells inside its
// frustum, through an index list of its own (CellPass): the picture the camera's frustum, the see-through pass the
// narrow frustums behind the see-through things. The baked vertex colours are untouched; it's the same triangles, fewer
// of them sent.
//
// Planes: a flat array of [nx, ny, nz, c] per plane (inside where n . p + c >= 0), six per frustum.

// Splits the triangles of one chunk. pos: the quantized positions (Int16, normalized to -1..1), center/half: the
// chunk's placement (world = center + half * pos), idx: its index list. leaf: the most triangles in a cell; big:
// triangles longer than this (world units) are split among themselves.
export function buildCells(pos, idx, center, half, { leaf = 500, big = 0.3 } = {}) {
  const nt = idx.length / 3, q = 1 / 32767;
  const cen = new Float32Array(nt * 3), lo = new Float32Array(nt * 3), hi = new Float32Array(nt * 3);
  const big3 = [], small3 = [];
  for (let t = 0; t < nt; t++) {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < 3; k++) {
      const v = idx[t * 3 + k] * 3;
      const x = center[0] + half[0] * Math.max(pos[v] * q, -1), y = center[1] + half[1] * Math.max(pos[v + 1] * q, -1), z = center[2] + half[2] * Math.max(pos[v + 2] * q, -1);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    lo[t * 3] = x0; lo[t * 3 + 1] = y0; lo[t * 3 + 2] = z0; hi[t * 3] = x1; hi[t * 3 + 1] = y1; hi[t * 3 + 2] = z1;
    cen[t * 3] = (x0 + x1) / 2; cen[t * 3 + 1] = (y0 + y1) / 2; cen[t * 3 + 2] = (z0 + z1) / 2;
    (Math.max(x1 - x0, y1 - y0, z1 - z0) > big ? big3 : small3).push(t);
  }
  const ids = Int32Array.from([...big3, ...small3]);
  const leaves = [];   // [start, end) ranges of ids, in tree order
  const split = (a, b) => {
    // (a cell keeps its triangles in the chunk's own order: where two flat triangles overlap, the same one wins as before)
    if (b - a <= leaf) { ids.subarray(a, b).sort(); leaves.push([a, b]); return; }
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = a; i < b; i++) {
      const c = ids[i] * 3, x = cen[c], y = cen[c + 1], z = cen[c + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    const ex = x1 - x0, ey = y1 - y0, ez = z1 - z0, ax = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
    const m = (a + b) >> 1;
    select(ids, cen, ax, a, b - 1, m);
    split(a, m); split(m, b);
  };
  if (big3.length) split(0, big3.length);
  if (small3.length) split(big3.length, nt);
  // the sorted index list and each cell's run and box
  const order = new (idx.constructor)(idx.length), n = leaves.length;
  const cells = { order, n, start: new Uint32Array(n), count: new Uint32Array(n), lo: new Float32Array(n * 3), hi: new Float32Array(n * 3), tris: nt };
  let w = 0;
  leaves.forEach(([a, b], c) => {
    cells.start[c] = w;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = a; i < b; i++) {
      const t = ids[i], s = t * 3;
      order[w++] = idx[s]; order[w++] = idx[s + 1]; order[w++] = idx[s + 2];
      if (lo[s] < x0) x0 = lo[s]; if (lo[s + 1] < y0) y0 = lo[s + 1]; if (lo[s + 2] < z0) z0 = lo[s + 2];
      if (hi[s] > x1) x1 = hi[s]; if (hi[s + 1] > y1) y1 = hi[s + 1]; if (hi[s + 2] > z1) z1 = hi[s + 2];
    }
    cells.count[c] = w - cells.start[c];
    cells.lo.set([x0, y0, z0], c * 3); cells.hi.set([x1, y1, z1], c * 3);
  });
  return cells;
}

// The six planes of a clip matrix (m: world -> clip, 16 numbers column-major as three.js keeps them) into
// planes[o .. o + 24): left, right, bottom, top, far, near. rect [x0, x1, y0, y1]: only that part of the picture (in
// its -1..1 coordinates; wider than -1..1 for a margin). near: a plane [nx, ny, nz, c] to use instead of the near one.
export function frustumPlanes(m, planes, o = 0, rect = null, near = null) {
  let r0 = [m[0], m[4], m[8], m[12]], r1 = [m[1], m[5], m[9], m[13]];
  const r2 = [m[2], m[6], m[10], m[14]], r3 = [m[3], m[7], m[11], m[15]];
  if (rect) {
    const [x0, x1, y0, y1] = rect, sx = 2 / (x1 - x0), sy = 2 / (y1 - y0), xc = (x0 + x1) / 2, yc = (y0 + y1) / 2;
    r0 = r0.map((v, i) => sx * v - sx * xc * r3[i]);
    r1 = r1.map((v, i) => sy * v - sy * yc * r3[i]);
  }
  const add = (a, s) => r3.map((v, i) => v + s * a[i]);
  const list = [add(r0, 1), add(r0, -1), add(r1, 1), add(r1, -1), add(r2, -1), near || add(r2, 1)];
  list.forEach((p, k) => {
    const l = Math.hypot(p[0], p[1], p[2]) || 1;
    for (let i = 0; i < 4; i++) planes[o + k * 4 + i] = p[i] / l;
  });
  return planes;
}

// The part of the picture a sphere (centre c [x, y, z], radius r, in the world) can cover, from the corners of the box
// round it: [x0, x1, y0, y1] in the picture's -1..1 coordinates (m: world -> clip, column-major), grown by padX and
// padY; null when it is off the picture; 'all' when part of it is behind the camera (then any of it may be needed).
export function sphereRect(m, c, r, padX = 0, padY = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let k = 0; k < 8; k++) {
    const x = c[0] + (k & 1 ? r : -r), y = c[1] + (k & 2 ? r : -r), z = c[2] + (k & 4 ? r : -r);
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 1e-3) return 'all';
    const px = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, py = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
  }
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
  if (x1 < -1 || x0 > 1 || y1 < -1 || y0 > 1) return null;
  return [x0, x1, y0, y1];
}

// Quickselect: puts the id whose centre is the k-th smallest along `ax` at k, smaller ones before it, larger after.
function select(ids, cen, ax, l, r, k) {
  while (r > l) {
    const pv = cen[ids[(l + r) >> 1] * 3 + ax];
    let i = l, j = r;
    while (i <= j) {
      while (cen[ids[i] * 3 + ax] < pv) i++;
      while (cen[ids[j] * 3 + ax] > pv) j--;
      if (i <= j) { const t = ids[i]; ids[i] = ids[j]; ids[j] = t; i++; j--; }
    }
    if (k <= j) r = j; else if (k >= i) l = i; else return;
  }
}

// Is the box (lo, hi at cell c) inside or across every plane of one frustum (6 planes at planes[o..o+24))?
function boxIn(cells, c, planes, o) {
  const L = cells.lo, H = cells.hi, b = c * 3;
  for (let p = o; p < o + 24; p += 4) {
    const nx = planes[p], ny = planes[p + 1], nz = planes[p + 2];
    const x = nx >= 0 ? H[b] : L[b], y = ny >= 0 ? H[b + 1] : L[b + 1], z = nz >= 0 ? H[b + 2] : L[b + 2];
    if (nx * x + ny * y + nz * z + planes[p + 3] < 0) return false;
  }
  return true;
}

// Marks the cells inside any of the frustums (planes: 24 numbers per frustum, end-to-end); returns their triangles.
export function markCells(cells, planes, mark) {
  let tris = 0;
  const nf = planes.length / 24;
  for (let c = 0; c < cells.n; c++) {
    let on = 0;
    for (let f = 0; f < nf && !on; f++) if (boxIn(cells, c, planes, f * 24)) on = 1;
    mark[c] = on;
    if (on) tris += cells.count[c] / 3;
  }
  return tris;
}

// The marked cells' triangles into `out` (an index list as long as the chunk's); returns how many indices.
export function fillIndex(cells, mark, out) {
  let w = 0;
  for (let c = 0; c < cells.n; c++) {
    if (!mark[c]) continue;
    const s = cells.start[c], n = cells.count[c];
    out.set(cells.order.subarray(s, s + n), w);
    w += n;
  }
  return w;
}

// One pass's cells for one chunk, with some slack so a small camera move doesn't rebuild its index list every frame:
// update(need, want) keeps what it has while every cell `need` (the frustums as they are) reaches is in it and it
// holds no more than about 1.5 x what `want` (the frustums with a margin) reaches; otherwise it takes want's cells. It
// returns true when the index list changed (out[0..count) to be sent to the GPU).
export class CellPass {
  constructor(cells, out) {
    this.cells = cells;
    this.out = out;
    this.have = new Uint8Array(cells.n);
    this.need = new Uint8Array(cells.n);
    this.want = new Uint8Array(cells.n);
    this.count = 0;
    this.tris = 0;
    this.fresh = false;
    this.orig = false;
    this.builds = 0;
  }
  update(need, want) {
    const C = this.cells, slack = C.tris * 0.02;
    let wTris = -1;
    if (this.fresh && !this.orig) {
      const nTris = markCells(C, need, this.need);
      let ok = true;
      for (let c = 0; c < C.n && ok; c++) if (this.need[c] && !this.have[c]) ok = false;
      if (ok && this.tris <= 1.5 * nTris + slack) return false;
      if (ok) {   // more than it needs: shrink only when the margin's cells are much fewer
        wTris = markCells(C, want, this.want);
        if (this.tris <= 1.5 * wTris + slack) return false;
      }
    }
    if (wTris < 0) wTris = markCells(C, want, this.want);
    this.orig = false;
    this.have.set(this.want);
    this.tris = wTris;
    this.count = fillIndex(C, this.have, this.out);
    this.fresh = true;
    this.builds++;
    return true;
  }
  // the chunk's own index list, in its own order (the tests' and the probe's "before": cells off)
  original(idx) {
    if (this.fresh && this.orig) return false;
    this.out.set(idx);
    this.count = idx.length;
    this.have.fill(1);
    this.tris = this.cells.tris;
    this.fresh = this.orig = true;
    this.builds++;
    return true;
  }
  all() {   // every cell (the pass can't tell what it needs)
    this.orig = false;
    if (this.fresh && this.tris === this.cells.tris) return false;
    this.have.fill(1);
    this.tris = this.cells.tris;
    this.count = fillIndex(this.cells, this.have, this.out);
    this.fresh = true;
    this.builds++;
    return true;
  }
}
