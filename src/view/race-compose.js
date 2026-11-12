// The race runner composer (design/contests-race-view.md v2 §4; RV2). Builds one 56 x 56 art px frame of a pixel runner
// from Usopp's race kit (src/assets/race/, copied unchanged from usopp/race-kit @ 48c0f45): the body family's index
// sheet in the slime's 5-step ramp, the form's pattern tiles, props and diet accessories, the face stamps, the outfits,
// the Cat-ear / Topknot overlays, the Pure rim, the jelly glint, and the kit's clean-up folds.
//
// This is a faithful port of the kit's own reference composer (samples/race-kit/src/compose.py `compose` and
// compose_kit.py `compose_form`, the code that drew every sheet Nami checked), so the sheets checked are what the phone
// draws. tools/race-compose-test.mjs proves it pixel for pixel against that composer's output (tools/race-compose-ref.py).
// Python's rounding is kept where the reference uses it (round() is half-to-even; np.floor(x + .5) is floor), as are its
// iteration orders, so every fold and placement lands on the same pixel.
// Pure: no DOM, no three.js. Input: the decoded kit (race-kit.js loads it in the browser; the test decodes the PNGs in
// node). Output: RGBA bytes.
export const CAN = 56;
const N = CAN * CAN;
const N8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];   // (dy, dx), compose.py's order
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const GLINT = [[0, 0], [1, 0], [0, 1], [1, 1], [-2, -2]];
const PURE = '#f2c14e';
// owners (what drew a pixel)
const O = { '': 0, body: 1, pattern: 2, halo: 3, face: 4, blush: 5, hair: 6, neck: 7, head: 8, effect: 9, effect_halo: 10, glint: 11, prop: 12, acc: 13,
  breed: 14, rim: 15, face_outfit: 16, neck_shade: 17, detail: 18 };
const setOf = names => { const s = new Uint8Array(32); for (const n of names) s[O[n]] = 1; return s; };
const KEEP_OUT = setOf(['face', 'blush', 'neck', 'head', 'glint', 'hair', 'effect']);
const KEEP_OUT_PA = setOf(['face', 'blush', 'neck', 'head', 'glint', 'hair', 'effect', 'prop', 'acc']);
const KEEP_OUT_BR = setOf(['face', 'blush', 'neck', 'head', 'glint', 'hair', 'effect', 'breed']);
const STAMPS = setOf(['face', 'blush', 'hair', 'neck', 'head', 'effect']);
const BODYLIKE = setOf(['body', 'pattern', 'halo']);
const BASE_ALLOW = setOf(['body', 'pattern', 'halo', 'prop', 'acc', 'rim', '']);
const BASE_ALLOW_SH = setOf(['body', 'pattern', 'halo', 'prop', 'acc', 'rim', '', 'face', 'blush']);
const PROPLIKE = setOf(['prop', 'acc', 'breed']);
const BODY_PAT = setOf(['body', 'pattern']);

// ---------- the reference's numbers that live in its code (samples/race-kit/src @ 48c0f45) ----------
// tiles.py TILES (placement mode per pattern tile) and STARS_LAYOUT (Firework's whole stars, in body terms)
const TILE_MODE = { candy: 'xy', aurora: 'span', toast: 'top', flames: 'bottom', plates: 'belt', speckle: 'xy', stars: 'surface', drizzle: 'top',
  toastGold: 'top', honeycomb: 'xy', firelight: 'span', zigzag: 'xy', cracks: 'xy', spots: 'xy', circuit: 'xy', emberRise: 'xy' };
const STARS_LAYOUT = [[0.18, 0.72, 1], [0.42, 0.82, 2], [0.14, 0.32, 2], [0.42, 0.22, 1], [0.74, 0.18, 2]];
const WHOLE = { speckle: [1, 2], spots: [1, 2], emberRise: [1, 2], honeycomb: [2] };   // compose_kit.WHOLE: dot motifs drawn whole or not at all
const GLOWS = ['zigzag', 'cracks', 'spots', 'circuit', 'emberRise'];
// stamps.py BREED and BREED_AT (Cat-ear and Topknot, in the runner's ramp steps)
const BREED = {
  ears: {
    normal: [['1...', '11..', '131.', '1331'], ['...1', '..11', '.141', '1441']],
    squash: [['1...', '131.', '1331'], ['...1', '.141', '1441']],
    stretch: [['1...', '11..', '131.', '1331'], ['...1', '..11', '.141', '1441']],
  },
  topknot: {
    normal: ['.111.', '13551', '13541', '13441', '.232.', '.222.'],
    squash: ['.1111.', '134551', '134441', '.2332.', '..22..'],
    stretch: ['.111.', '13551', '13541', '13441', '13341', '.232.', '.222.'],
  },
};
const BREED_AT = { ears: { back: -3, front: 3 }, topknot: { centre: -3, centres: [-5, -4, -3, -2], seat: 2, crease: true } };
// outfits_stamps.py: the game's outfit colours, the head items (hand stamps, 3 poses), the worn pixel scarf's rules
const OC = { beret: '#e2506d', beret_d: '#b33a55', beret_k: '#8c2a40', party: '#8fd0ff', party_d: '#5fa8e0', party_dot: '#ffe680', pom: '#ff6fa3',
  gold: '#ffcf4a', gold_d: '#c99a2a', gem_p: '#ff6fa3', gem_b: '#8fd0ff', gem_w: '#ffffff', ring: '#6fbf55', ring_d: '#4f9a3d', fl_p: '#ff9fc6',
  fl_y: '#fff1a8', fl_l: '#c9b3ff', fl_w: '#ffffff', glass: '#3a2f52', shade_lens: '#2a1f3d', shade_frame: '#ffcf4a', knit: '#ff8a5c',
  knit_d: '#d9663f', stripe: '#fff1d6', knit_l: '#ffb48e', knit_o: '#a8442c' };
const HEAD = {
  beret: { keys: { B: OC.beret, b: OC.beret_d, k: OC.beret_k }, dx: -1, poses: {
    normal: ['....k...', '..BBBBB.', '.BBBBBBB', 'bbbbbbb.'], squash: ['....k....', '.BBBBBBB.', 'BBBBBBBBB', 'bbbbbbbb.'],
    stretch: ['...k..', '.BBBB.', 'BBBBBB', 'BBBBBb', '.bbbb.'] } },
  party: { keys: { c: OC.party, C: OC.party_d, d: OC.party_dot, p: OC.pom }, dx: 0, poses: {
    normal: ['..pp.', '..pp.', '..c..', '.cdC.', '.ccC.', 'cdccC', 'cccCC'], squash: ['.pp..', '.pp..', '.cdC.', 'cccCC', 'cdccC'],
    stretch: ['..pp', '..pp', '..c.', '.cC.', '.dC.', '.cC.', 'cdcC', 'ccCC'] } },
  crown: { keys: { g: OC.gold, G: OC.gold_d, r: OC.gem_p, b: OC.gem_b, w: OC.gem_w }, dx: 0, poses: {
    normal: ['g.g.g.g', 'ggggggg', 'grgbgwg', 'GGGGGGG'], squash: ['g..g..g', 'grgbgwgg', 'GGGGGGGG'],
    stretch: ['g.g.g.g', 'g.g.g.g', 'ggggggg', 'grgbgwg', 'GGGGGGG'] } },
  flowers: { keys: { g: OC.ring, d: OC.ring_d, p: OC.fl_p, y: OC.fl_y, l: OC.fl_l, w: OC.fl_w }, dx: 0, poses: {
    normal: ['...p..y..l..', '..pgggyggglg', 'wgdg....gdgw', 'gd........dg'], squash: ['..p...y...l...', 'wpgggggyggglgw', 'gdd........ddg'],
    stretch: ['..p..y..', '.pgggygl', 'wgd..dgl', 'gd....dg', 'g......g'] } },
};
const WORN = { L: OC.knit_l, K: OC.knit, k: OC.knit_d, O: OC.knit_o, s: OC.stripe };
const TAILS = { normal: [[[2, 1], 6], [[1, 2], 4]], squash: [[[2, 1], 6], [[1, 1], 3]], stretch: [[[6, 1], 7], [[3, 1], 5]] };
const SLOPES = [[1, 2], [1, 1], [2, 1], [3, 1], [6, 1]];
const KNOT = ['LKk', 'LKk', 'kkO'];
const PILOT_WORN = ['bowtie', 'ribbon'];
// the game's outfit ids -> the kit's (the Ribbon Bow is the pilot's 'ribbon')
export const KIT_OUTFIT = { bow: 'ribbon', bowtie: 'bowtie', glasses: 'glasses', shades: 'shades', flowers: 'flowers', beret: 'beret', party: 'party', crown: 'crown', scarf: 'scarf' };

// ---------- Python's numbers ----------
// round() on a float: half to even (Python and numpy)
export const rhe = x => { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); };
const fl5 = x => Math.floor(x + 0.5);                          // int(np.floor(x + 0.5))
const pmod = (a, m) => ((a % m) + m) % m;                       // Python's % for a positive modulus
const clip = (v, a, b) => Math.max(a, Math.min(b, v));
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const HEX = new Map();
export function hexrgb(h) {
  let v = HEX.get(h);
  if (!v) { const s = h.replace('#', ''); v = [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255]; HEX.set(h, v); }
  return v;
}
const col = c => (typeof c === 'string' ? hexrgb(c) : c);
const allclose = (a, o, b, p) => {
  for (let k = 0; k < 3; k++) if (!(Math.abs(a[o + k] - b[p + k]) <= 1e-8 + 1e-5 * Math.abs(b[p + k]))) return false;
  return true;
};

// ---------- colour (colour.py: sRGB <-> CIE L*a*b* D65) and the 4.2 ramp rule (pixel_kit.ramp_rule) ----------
const M = [[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]];
// np.linalg.inv(M), as numpy computes it (to the last bit: a hex can turn on it)
const MI = [[3.2404548360214087, -1.5371388501025751, -0.498531546868481], [-0.9692663898756538, 1.876010928842491, 0.041556082346673545],
  [0.05564341960421367, -0.20402585426769818, 1.057225162457929]];
const WP = [0.95047, 1.0, 1.08883];
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const enc = c => { c = clip(c, 0, 1); return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055; };
export function lab(rgb) {
  const l = rgb.map(lin);
  const xyz = [0, 1, 2].map(r => (l[0] * M[r][0] + l[1] * M[r][1] + l[2] * M[r][2]) / WP[r]);
  const e = 216 / 24389;
  const f = xyz.map(v => (v > e ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116));
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}
export function lab2rgb(L) {
  const fy = (L[0] + 16) / 116, fx = fy + L[1] / 500, fz = fy - L[2] / 200, e = 6 / 29;
  const inv = f => (f > e ? f ** 3 : 3 * e * e * (f - 4 / 29));
  const xyz = [inv(fx) * WP[0], inv(fy) * WP[1], inv(fz) * WP[2]];
  return [0, 1, 2].map(r => enc(xyz[0] * MI[r][0] + xyz[1] * MI[r][1] + xyz[2] * MI[r][2]));
}
export const rgbhex = c => '#' + c.map(v => clip(rhe(v * 255), 0, 255).toString(16).padStart(2, '0')).join('');
const deg = r => r * (180 / Math.PI);       // np.degrees
const rad = d => d * (Math.PI / 180);       // math.radians
const fromLch = (L, Cc, h) => lab2rgb([L, Cc * Math.cos(rad(h)), Cc * Math.sin(rad(h))]).map(v => clip(v, 0, 1));
const turn = (h, d) => { const target = h >= 40 && h < 200 ? 50.0 : 285.0; const dd = pmod(target - h + 540, 360) - 180; return pmod(h + (Math.abs(dd) > 1e-6 ? Math.sign(dd) * Math.min(Math.abs(dd), d) : 0.0), 360); };
// A body colour -> its five steps (outline, shadow, base, light, highlight), as hex: the kit's rule, for a rival's
// place colour (RIVAL_COLOR) or any colour the game shows.
export function rampRule(hex) {
  const Lb = lab(hexrgb(hex));
  const L = Lb[0], Cc = Math.hypot(Lb[1], Lb[2]), h = pmod(deg(Math.atan2(Lb[2], Lb[1])), 360);
  const neutral = Cc < 10, warm = h >= 40 && h < 110 && !neutral;
  const oL = L > 60 ? Math.min(45.0, Math.max(35.0, L - 36)) : Math.max(15.0, L - 30);
  const warmer = (hh, k) => pmod(hh + (pmod(95 - hh + 540, 360) - 180) * k, 360);
  let sh, ol;
  if (warm) { sh = { C: 1.45 * Cc, h: pmod(h - 15, 360) }; ol = { C: 1.37 * Cc, h: pmod(h - 33, 360) }; }
  else { sh = { C: neutral ? Cc : 1.05 * Cc, h: neutral ? h : turn(h, 15) }; ol = { C: neutral ? Cc : 0.9 * Cc, h: neutral ? h : turn(h, 30) }; }
  const out = {
    outline: fromLch(oL, ol.C, ol.h), shadow: fromLch(L - 13.5, sh.C, sh.h), base: fromLch(L, Cc, h),
    light: fromLch(Math.min(97.0, L + 8), Cc + (neutral ? 1 : 4), warmer(h, 0.03)), highlight: fromLch(Math.min(98.5, L + 14), 0.8 * Cc, warmer(h, 0.1)),
  };
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, rgbhex(v)]));
}

// ---------- the canvas ----------
class Canvas {
  constructor() { this.rgb = new Float64Array(N * 3); this.a = new Uint8Array(N); this.own = new Uint8Array(N); }
  put(x, y, c, owner) {
    if (x < 0 || x >= CAN || y < 0 || y >= CAN) return;
    const p = y * CAN + x, q = p * 3, v = col(c);
    this.rgb[q] = v[0]; this.rgb[q + 1] = v[1]; this.rgb[q + 2] = v[2];
    this.a[p] = 1; this.own[p] = O[owner];
  }
  copyTo(x, y, src, owner) { const p = y * CAN + x, q = p * 3, s = src * 3; this.rgb[q] = this.rgb[s]; this.rgb[q + 1] = this.rgb[s + 1]; this.rgb[q + 2] = this.rgb[s + 2]; this.a[p] = 1; this.own[p] = owner; }
  stamp(grid, keys, x0, y0, owner, only = null) {
    for (let j = 0; j < grid.length; j++) { const row = grid[j]; for (let i = 0; i < row.length; i++) { const ch = row[i]; if (Object.hasOwn(keys, ch) && (!only || only(x0 + i, y0 + j))) this.put(x0 + i, y0 + j, keys[ch], owner); } }
  }
  eq(p, q) { const a = p * 3, b = q * 3; return this.rgb[a] === this.rgb[b] && this.rgb[a + 1] === this.rgb[b + 1] && this.rgb[a + 2] === this.rgb[b + 2]; }
}
const pyi = v => (v < 0 ? v + CAN : v);   // numpy's negative index (only -1 ever reaches here)
const mirror = g => g.map(r => [...r].reverse().join(''));

// ---------- the kit ----------
// kit: { j: kit.json, fc: forms_colours.json, forms: forms.json by id, pj: props.json, sheets: { curly, dollop, mixed,
// props, acc } (each { w, h, data: Uint8Array of indexes }), tiles: { name: Uint8Array(256) }, zig: Uint8Array(256) }
export function prepareKit(raw) {
  const k = { ...raw, ids: raw.j.frames.map(f => f.id), restOwn: {}, idxCache: {} };
  return k;
}
function idxOf(kit, fam, fid) {
  const key = fam + ':' + fid;
  let v = kit.idxCache[key];
  if (!v) {
    const sh = kit.sheets[fam], i = kit.ids.indexOf(fid);
    v = new Uint8Array(N);
    for (let y = 0; y < CAN; y++) for (let x = 0; x < CAN; x++) v[y * CAN + x] = sh.data[y * sh.w + i * CAN + x];
    kit.idxCache[key] = v;
  }
  return v;
}
const frameOf = (kit, fam, fid) => kit.j.families[fam].frames[fid];
function topMap(F) {
  const rows = Object.keys(F.dome_rows).map(Number).sort((a, b) => a - b), top = new Map();
  for (const y of rows) { const [a, b] = F.dome_rows[y]; for (let x = a; x <= b; x++) if (!top.has(x)) top.set(x, y); }
  return top;
}
const sub = (sheet, x, y, w, h) => { const out = { w, h, data: new Uint8Array(w * h) }; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.data[j * w + i] = sheet.data[(y + j) * sheet.w + x + i]; return out; };
function sprite(kit, group, name, frame = 0, fam = null) {
  const m = kit.pj[group].sprites[name];
  const rects = (m.family_rects && fam && m.family_rects[fam]) || m.rects;
  const [x, y, w, h] = rects[Math.min(frame, rects.length - 1)];
  return [sub(kit.sheets[group], x, y, w, h), m];
}
const at = (a, j, i) => a.data[j * a.w + i];

// ---------- compose.py compose(): body, the Volt's zigzag and hair, face, the pilot's outfits, glint, fold, sparks ----------
function composeBase(kit, fam, fid, theme, expr, hair, worn, form, spark, rampsIn) {
  const F = frameOf(kit, fam, fid), FJ = kit.j.families[fam];
  const ramps = rampsIn || FJ.ramp;
  const ramp = Object.fromEntries(Object.entries(ramps[theme]).map(([s, v]) => [s, hexrgb(v)]));
  const steps = kit.j.steps;
  const idx = idxOf(kit, fam, fid);
  const cv = new Canvas();
  const info = { placed: {} };
  for (let p = 0; p < N; p++) if (idx[p]) cv.put(p % CAN, (p / CAN) | 0, ramp[steps[idx[p] - 1]], 'body');
  const an = F.anchors, D = F.dome;
  const topX = topMap(F);
  if (form === 'volt') {
    const tj = kit.j.tile_zigzag;
    const ox = rhe(an.centre[0]), oy = rhe(an.centre[1]) - 6;
    const line = hexrgb(tj.colours.line), under = hexrgb(tj.colours.under);
    const pat = new Uint8Array(N), span = Math.max(1, D.yB - D.yT);
    for (let p = 0; p < N; p++) {
      if (idx[p] < 2 || idx[p] > 4) continue;
      const y = (p / CAN) | 0, x = p % CAN;
      const drop = (topX.has(x) ? topX.get(x) : D.yT) - D.yT;
      const k = 0.7 * clip((D.yB - y) / span, 0, 1);
      const ys = y - Math.floor(k * drop + 0.5);
      const t = kit.zig[pmod(ys - oy, 16) * 16 + pmod(x - ox, 16)];
      if (t) { pat[p] = t; cv.put(x, y, t === 1 ? line : under, 'pattern'); }
    }
    const dL = lab(line)[0] - lab(hexrgb(ramps.day.base))[0];
    if (theme === 'night' && dL >= 15) {
      const halo = [0, 1, 2].map(k => clip(line[k] * 0.5 + ramp.base[k] * 0.5, 0, 1));
      const near = rollNear(pat, 1);
      for (let p = 0; p < N; p++) if (near[p] && idx[p] >= 2 && idx[p] <= 4 && !pat[p]) { const y = (p / CAN) | 0, x = p % CAN; if ((x + y) % 2 === 0) cv.put(x, y, halo, 'halo'); }
    }
  }
  // the face
  const fc = kit.j.faces[fam], ex = fc.expressions[expr], eg = ex.eye;
  const w = eg[0].length, h = eg.length;
  const eyes = [...an.eyes].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const sp = fc.spacing_px;
  const my0 = mean(eyes.map(e => e[1]));
  let mx = mean(eyes.map(e => e[0]));
  const ry = rhe(my0);
  let rowMax = -1;
  for (let x = 0; x < CAN; x++) if (idx[ry * CAN + x]) rowMax = x;
  mx = Math.min(mx, rowMax - 1 - w / 2 + 0.5 - sp / 2);
  const xl = Math.floor(mx - sp / 2 - w / 2 + 0.5);
  const tieJ = (kit.j.bow_tie_dollop && kit.j.bow_tie_dollop.families.includes(fam)) ? kit.j.bow_tie_dollop : null;
  const tie = (tieJ || kit.j.bow_tie).grid, tw = tie[0].length, th = tie.length;
  const body = p => idx[p] > 0;
  const tieAt = ey0 => {
    const yb = ey0 + h;
    const top = tieJ ? yb - 1 + tieJ.top_below_eyes_bottom_row : fam === 'curly' ? yb + 3 : yb + 1;
    const cx = (xl + xl + sp + w) / 2, tx0 = Math.floor(cx - tw / 2 + 0.5);
    let ok = true;
    for (let j = 0; j < th && ok; j++) {
      const yy = top + j;
      if (!(yy >= 0 && yy < CAN - 1)) { ok = false; break; }
      for (let x = tx0; x < tx0 + tw; x++) if (!(x >= 0 && x < CAN && body((yy + 1) * CAN + x))) { ok = false; break; }
      let mxr = -1; for (let x = 0; x < CAN; x++) if (body(yy * CAN + x)) mxr = x;
      if (!(mxr >= tx0 + tw)) ok = false;
    }
    return [tx0, top, ok];
  };
  let ey0 = Math.floor(my0 - h / 2 + 0.5);
  if (worn.includes('bowtie') && fam === 'curly' && !tieAt(ey0)[2]) ey0 -= 1;
  const placedEyes = [];
  [xl, xl + sp].forEach((x0, n) => { cv.stamp(ex.mirrored && n === 1 ? mirror(eg) : eg, fc.keys, x0, ey0, 'face'); placedEyes.push([x0, ey0]); });
  info.placed.eyes = placedEyes;
  const yb = ey0 + h;
  if (ex.mouth) {
    const mg = ex.mouth, x0 = rhe((placedEyes[0][0] + placedEyes[1][0] + w) / 2 - mg[0].length / 2);
    cv.stamp(mg, fc.keys, x0, yb, 'face');
    info.placed.mouth = [x0, yb];
  }
  const pk = hexrgb('#ff7896');
  const bl = [0, 1, 2].map(k => clip(ramp.base[k] * 0.55 + pk[k] * 0.45, 0, 1));
  const inner = (x, y) => x >= 0 && x < CAN && y >= 0 && y < CAN && idx[y * CAN + x] >= 2 && BODYLIKE[cv.own[y * CAN + x]];
  for (const [bx, by] of [[placedEyes[0][0] - 2, yb - 1], [placedEyes[1][0] + w, yb - 1]]) if (inner(bx, by) && inner(bx + 1, by)) cv.stamp(['ll'], { l: bl }, bx, by, 'blush');
  // the Volt's hair: 3 kinked bolts fanned at the crown
  let bolts = null;
  const foot = g => [...g[g.length - 1]].findIndex(c => c !== '.');
  if (form === 'volt') {
    const hk = { ...kit.j.hair.keys[hair], o: ramps[theme].outline }, H = kit.j.hair;
    const midX = fam === 'curly' || fam === 'mixed' ? an.curl_base[0] - 2 : Math.floor(an.crown[0] - 0.5 + 0.5);
    bolts = [[H.back, midX - 3], [H.mid, midX], [H.front, midX + 3]].map(([g, fx]) => {
      const bx0 = fx - foot(g), ht = topX.get(fx);
      return [bx0, (ht !== undefined ? ht : D.yT) - g.length + 1, g];
    });
    for (const [bx0, by0, g] of bolts) cv.stamp(g, hk, bx0, by0, 'hair');
  }
  // the pilot's outfits: the Bow Tie under the mouth, the Ribbon Bow on the back of the head
  const oc = FJ.outfits[theme];
  if (worn.includes('bowtie')) { const [tx0, ttop] = tieAt(ey0); cv.stamp(tie, oc.bowtie, tx0, ttop, 'neck'); }
  if (worn.includes('ribbon')) {
    const g = kit.j.ribbon_bow.poses[F.tag].grid, gw = g[0].length;
    let x0;
    if (fam === 'curly' || fam === 'mixed') x0 = an.curl_base[0] - gw + 2;
    else { const hx = form === 'volt' ? bolts[0][0] + foot(bolts[0][2]) : Math.trunc(an.crown[0]) - 2; x0 = hx - 1 - gw; }
    const tops = () => { const t = []; for (let x = x0; x < x0 + gw; x++) if (topX.has(x)) t.push(topX.get(x)); return t; };
    let y0 = Math.trunc(median(tops())) + 2 - g.length + 1;
    if (!(fam === 'curly' || fam === 'mixed') && form === 'volt') {
      const touches = () => {
        for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) {
          if (g[j][i] === '.') continue;
          for (let yy = Math.max(0, y0 + j - 1); yy < Math.min(CAN, y0 + j + 2); yy++) for (let xx = Math.max(0, x0 + i - 1); xx < Math.min(CAN, x0 + i + 2); xx++) if (cv.own[yy * CAN + xx] === O.hair) return true;
        }
        return false;
      };
      while (touches() && x0 > 2) { x0 -= 1; y0 = Math.trunc(median(tops())) + 2 - g.length + 1; }
    }
    cv.stamp(g, oc.ribbon, x0, y0, 'head');
  }
  // the jelly glint
  const [tx, ty] = F.glint_target;
  let best = null;
  for (const [strict, ring] of [[true, N8], [false, N8], [false, N4]]) {
    for (let dy = -5; dy < 6; dy++) for (let dx = -6; dx < 6; dx++) {
      const gx = fl5(tx) + dx - 1, gy = fl5(ty) + dy - 1;
      let okp = true;
      for (const [a, b] of GLINT) {
        const x = gx + a, y = gy + b;
        if (!(x >= 0 && x < CAN && y >= 0 && y < CAN)) { okp = false; break; }
        const v = idx[y * CAN + x];
        if (!(strict ? (v === 4 || v === 5) : (v >= 3 && v <= 5)) || STAMPS[cv.own[y * CAN + x]]) { okp = false; break; }
        for (const [ddy, ddx] of ring) {
          const yy = y + ddy, xx = x + ddx;
          if (!(xx >= 0 && xx < CAN && yy >= 0 && yy < CAN) || STAMPS[cv.own[yy * CAN + xx]]) okp = false;
        }
      }
      if (okp) { const sc = (gx + 1 - tx) ** 2 + (gy + 1 - ty) ** 2; if (!best || sc < best[0]) best = [sc, gx, gy]; }
    }
    if (best) break;
  }
  if (best) {
    const [, gx, gy] = best;
    for (const [a, b] of GLINT) for (let yy = gy + b - 1; yy < gy + b + 2; yy++) for (let xx = gx + a - 1; xx < gx + a + 2; xx++) {
      const p = pyi(yy) * CAN + pyi(xx);
      if (cv.own[p] === O.pattern || cv.own[p] === O.halo) cv.put(xx, yy, ramp[steps[idx[p] - 1]], 'body');
    }
    for (const [a, b] of GLINT) cv.put(gx + a, gy + b, '#ffffff', 'glint');
  }
  // the fold (compose.py): lone pattern pixels back to the ramp, lone body pixels to their neighbours' colour
  for (const owner of [O.pattern, O.body]) {
    for (let pass = 0; pass < 3; pass++) {
      let ch = 0;
      const list = [];
      for (let p = 0; p < N; p++) if (cv.own[p] === owner) list.push(p);
      for (const p of list) {
        const y = (p / CAN) | 0, x = p % CAN, nb = [];
        for (const [dy, dx] of N8) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < CAN && xx >= 0 && xx < CAN && cv.a[yy * CAN + xx]) nb.push(yy * CAN + xx); }
        if (nb.some(q => allclose(cv.rgb, q * 3, cv.rgb, p * 3))) continue;
        if (owner === O.pattern) { cv.put(x, y, ramp[steps[idx[p] - 1]], 'body'); ch++; }
        else {
          let cand = nb.filter(q => BODY_PAT[cv.own[q]]);
          if (!cand.length) cand = nb.filter(q => cv.own[q] === O.halo);
          if (cand.length) { cv.copyTo(x, y, mostCommon(cv, cand), O.body); ch++; }
          else if (idx[p] === 1) { cv.a[p] = 0; cv.own[p] = 0; cv.rgb[p * 3] = cv.rgb[p * 3 + 1] = cv.rgb[p * 3 + 2] = 0; ch++; }
        }
      }
      if (!ch) break;
    }
  }
  // the Volt's surge sparks, above the back
  if (spark !== null && spark !== undefined) {
    const g = kit.j.sparks.frames[spark], bb = F.bbox, sx0 = bb[0] - 2, sy0 = bb[1] + 4;
    cv.stamp(g, kit.j.sparks.keys, sx0, sy0, 'effect');
    if (theme === 'night') {
      const m = new Uint8Array(N);
      g.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.' && sy0 + j >= 0 && sy0 + j < CAN && sx0 + i >= 0 && sx0 + i < CAN) m[(sy0 + j) * CAN + sx0 + i] = 1; }));
      const near = rollNear(m, 1);
      const y_ = hexrgb(kit.j.sparks.keys.y), bg = hexrgb('#3a2d58');
      const halo = [0, 1, 2].map(k => y_[k] * 0.5 + bg[k] * 0.5);
      for (let p = 0; p < N; p++) if (near[p] && !m[p] && !cv.a[p]) { const y = (p / CAN) | 0, x = p % CAN; if ((x + y) % 2 === 0) cv.put(x, y, halo, 'effect_halo'); }
    }
  }
  return { cv, info, idx, F, ramp, ramps };
}
// the neighbours' most common colour (copied exactly); the first of the most common, in N8 order
function mostCommon(cv, cand) {
  let best = cand[0], bn = -1;
  for (const p of cand) { let n = 0; for (const q of cand) if (cv.eq(p, q)) n++; if (n > bn) { bn = n; best = p; } }
  return best;
}
// np.roll of a mask by every N8 offset, OR'ed: pixels next to (not counting) a set pixel, wrapping at the edges as numpy does
function rollNear(mask, v = 1) {
  const out = new Uint8Array(N);
  for (const [dy, dx] of N8) for (let y = 0; y < CAN; y++) for (let x = 0; x < CAN; x++) if (mask[y * CAN + x] === v) out[pmod(y + dy, CAN) * CAN + pmod(x + dx, CAN)] = 1;
  return out;
}
// compose_kit.near_own: within 1 px (itself included) of a drawn pixel owned by one of `owners` (a 32-slot set)
function nearOwn(cv, owners) {
  const m = new Uint8Array(N);
  for (let p = 0; p < N; p++) if (owners[cv.own[p]] && cv.a[p]) m[p] = 1;
  const out = rollNear(m, 1);
  for (let p = 0; p < N; p++) if (m[p]) out[p] = 1;
  return out;
}

// ---------- compose_kit.py ----------
function clusters(a) {
  const seen = new Uint8Array(a.w * a.h), out = [];
  for (let y0 = 0; y0 < a.h; y0++) for (let x0 = 0; x0 < a.w; x0++) {
    if (!at(a, y0, x0) || seen[y0 * a.w + x0]) continue;
    const st = [[y0, x0]], grp = [];
    seen[y0 * a.w + x0] = 1;
    while (st.length) {
      const [y, x] = st.pop();
      grp.push([y, x]);
      for (const [dy, dx] of N8) { const v = y + dy, u = x + dx; if (v >= 0 && v < a.h && u >= 0 && u < a.w && at(a, v, u) && !seen[v * a.w + u]) { seen[v * a.w + u] = 1; st.push([v, u]); } }
    }
    out.push(grp);
  }
  return out;
}
function interiorSpan(idx, y) {
  if (!(y >= 0 && y < CAN)) return null;
  let a = -1, b = -1;
  for (let x = 0; x < CAN; x++) if (idx[y * CAN + x] >= 2) { if (a < 0) a = x; b = x; }
  return a < 0 ? null : [a, b];
}
function restOwn(kit, fam) {
  if (!kit.restOwn[fam]) kit.restOwn[fam] = composeBase(kit, fam, 'idle_0', 'day', 'open', 0, [], 'plain', null, null).cv.own.slice();
  return kit.restOwn[fam];
}
function place(m, a, F, fam, top, idx) {
  const an = F.anchors, kind = m.place[0], off = m.offset || {};
  const fdx = off[fam] && off.dollop ? off[fam][0] - off.dollop[0] : 0.0;
  if (kind === 'top' || kind === 'float') {
    const dx = m.place[1];
    let last = -1;
    for (let j = 0; j < a.h; j++) for (let i = 0; i < a.w; i++) if (at(a, j, i)) last = j;
    const xs = []; for (let i = 0; i < a.w; i++) if (at(a, last, i)) xs.push(i);
    const ft = rhe(mean(xs));
    const fx = Math.floor(an.head_top[0] + dx + fdx + 0.5);
    const ty = top.has(fx) ? top.get(fx) : F.dome.yT;
    if (kind === 'top') return [fx - ft, ty - last];
    return [fx - ft, ty - m.place[2] - (last + 1)];
  }
  const [cx, cy] = an.centre;
  const dx = m.place[1], dy = m.place[2], lift = m.rows_added_on_top || 0;
  if (kind === 'around') return [Math.floor(cx + dx + 0.5), F.dome.yT + dy - lift];
  if (kind === 'back') {
    const [, ddy, ov, row] = m.place;
    const y0 = Math.floor(cy + ddy + 0.5) - lift;
    let xmin = CAN; for (let x = 0; x < CAN; x++) if (idx[(y0 + lift + row) * CAN + x] > 0) { xmin = x; break; }
    let tip = -1; for (let i = 0; i < a.w; i++) if (at(a, row + lift, i)) tip = i;
    return [xmin + ov - tip, y0];
  }
  if (kind === 'body') return [Math.floor(cx + dx + fdx + 0.5), Math.floor(cy + dy + 0.5) - lift];
  return [Math.floor(cx + dx + fdx + 0.5), F.bottom + dy - lift];
}
function drawSprite(cv, a, pal, x0, y0, layer, owner, idx) {
  for (let j = 0; j < a.h; j++) for (let i = 0; i < a.w; i++) {
    const v = at(a, j, i);
    if (!v) continue;
    const x = x0 + i, y = y0 + j;
    if (!(x >= 0 && x < CAN && y >= 0 && y < CAN)) continue;
    const p = y * CAN + x;
    if (KEEP_OUT[cv.own[p]]) continue;
    if (layer === 'behind' && cv.a[p]) continue;
    if (layer === 'inner' && !(idx[p] >= 2 && BODYLIKE[cv.own[p]])) continue;
    cv.put(x, y, pal[v - 1], owner);
  }
}
function drawSurface(cv, a, pal, region, owner, idx, F, kit, fam, margin = false, spacing = 0) {
  const [u0, u1, v0, v1] = region;
  const R = frameOf(kit, fam, 'idle_0'), idxR = idxOf(kit, fam, 'idle_0'), ownR = restOwn(kit, fam);
  const yTR = R.dome.yT, bR = R.bottom, yT = F.dome.yT, b = F.bottom, H = a.h, W = a.w;
  const steps = [];
  for (let sx = -2; sx < 3; sx++) for (let sy = -2; sy < 3; sy++) steps.push([sx, sy]);
  steps.sort((p, q) => (Math.abs(p[0]) + Math.abs(p[1])) - (Math.abs(q[0]) + Math.abs(q[1])) || Math.abs(p[1]) - Math.abs(q[1]));
  let placed = 0;
  const done = [], doneR = [];
  for (const grp of clusters(a)) {
    const gyc = mean(grp.map(g => g[0])), gxc = mean(grp.map(g => g[1]));
    const u = u0 + (u1 - u0) * gxc / Math.max(1, W - 1);
    const v = v1 - (v1 - v0) * gyc / Math.max(1, H - 1);
    const rel = grp.map(([y, x]) => [y - gyc, x - gxc]);
    const atf = (idx_, yT_, b_) => {
      const yy = b_ - v * (b_ - yT_);
      const sp = interiorSpan(idx_, Math.floor(yy + 0.5));
      if (!sp) return null;
      const xx = sp[0] + u * (sp[1] - sp[0]);
      return rel.map(([dy, dx]) => [Math.floor(yy + dy + 0.5), Math.floor(xx + dx + 0.5)]);
    };
    const pR = atf(idxR, yTR, bR);
    if (!pR) continue;
    const fits = (pts, idx_, own_, dn) => {
      for (const [y, x] of pts) {
        if (!(y >= 1 && y < CAN - 1 && x >= 1 && x < CAN - 1) || idx_[y * CAN + x] < 2 || KEEP_OUT_PA[own_[y * CAN + x]]) return false;
        if (margin && N8.some(([dy, dx]) => idx_[(y + dy) * CAN + x + dx] < 2 || KEEP_OUT[own_[(y + dy) * CAN + x + dx]])) return false;
        if (spacing && dn.some(([vv, uu]) => Math.max(Math.abs(y - vv), Math.abs(x - uu)) < spacing)) return false;
      }
      return true;
    };
    const st0 = steps.find(([sx, sy]) => fits(pR.map(([y, x]) => [y + sy, x + sx]), idxR, ownR, doneR)) || [0, 0];
    const pF = atf(idx, yT, b);
    if (!pF) continue;
    const tries = [];
    for (let sx = -3; sx < 4; sx++) for (let sy = -3; sy < 4; sy++) tries.push([sx, sy]);
    tries.sort((p, q) => (Math.abs(p[0] - st0[0]) + Math.abs(p[1] - st0[1])) - (Math.abs(q[0] - st0[0]) + Math.abs(q[1] - st0[1])) || Math.abs(p[1] - st0[1]) - Math.abs(q[1] - st0[1]));
    for (const [y, x] of pR) doneR.push([y + st0[1], x + st0[0]]);
    for (const [sx, sy] of tries) {
      const pts = pF.map(([y, x]) => [y + sy, x + sx]);
      if (fits(pts, idx, cv.own, done)) {
        pts.forEach(([y, x], k) => { const [j, i] = grp[k]; cv.put(x, y, pal[at(a, j, i) - 1], owner); });
        done.push(...pts);
        placed++;
        break;
      }
    }
  }
  return placed;
}
const stampPal = (m, theme, ramp) => (theme === 'night' ? m.palette_night : m.palette_day).map(c => (c.startsWith('step:') ? ramp[c.slice(5)] : hexrgb(c)));
function drawParts(cv, a, pal, m, F, fam, top, idx) {
  const near = nearOwn(cv, setOf(['face', 'blush', 'glint']));
  for (const part of m.parts) {
    const [c0, c1] = part.cols;
    let r0 = -1, r1 = -1;
    for (let j = 0; j < a.h; j++) for (let i = c0; i < c1; i++) if (at(a, j, i)) { if (r0 < 0) r0 = j; r1 = j; }
    const s = { w: c1 - c0, h: r1 - r0 + 1, data: null };
    s.data = new Uint8Array(s.w * s.h);
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) s.data[j * s.w + i] = at(a, r0 + j, c0 + i);
    let x0, y0;
    if (part.at[0] === 'top') [x0, y0] = place({ place: ['top', part.at[1]], offset: m.offset }, s, F, fam, top, idx);
    else {
      const [, side, v, inset] = part.at, yT = F.dome.yT, b = F.bottom;
      const yc = Math.floor(b - v * (b - yT) + 0.5);
      for (let k = 0; k < 7; k++) {
        const y = yc + k;
        let xmin = -1, xmax = -1;
        for (let x = 0; x < CAN; x++) if (idx[y * CAN + x] > 0) { if (xmin < 0) xmin = x; xmax = x; }
        x0 = side === 'front' ? xmax - inset + 1 : xmin + inset - s.w;
        y0 = y - Math.floor(s.h / 2);
        let hit = false;
        for (let j = 0; j < s.h && !hit; j++) for (let i = 0; i < s.w; i++) { if (!at(s, j, i)) continue; const yy = y0 + j, xx = x0 + i; if (yy >= 0 && yy < CAN && xx >= 0 && xx < CAN && near[yy * CAN + xx]) { hit = true; break; } }
        if (side !== 'front' || !hit) break;
      }
    }
    drawSprite(cv, s, pal, x0, y0, m.layer, 'prop', idx);
  }
}
function drawGraham(cv, a, pal, m, F, fam, top, idx, theme) {
  const b = F.bottom;
  let xmin = -1, xmax = -1;
  for (let x = 0; x < CAN; x++) if (idx[b * CAN + x] > 0) { if (xmin < 0) xmin = x; xmax = x; }
  const [x0, y0] = place({ place: ['base', m.place[1], m.place[2]], offset: m.offset }, a, F, fam, top, idx);
  drawSprite(cv, a, pal, x0, y0, 'behind', 'prop', idx);
  const ch = m.chocolate, c = hexrgb(theme === 'night' ? ch.night : ch.day);
  const xm = Math.floor((xmin + xmax) / 2.0 + 0.5), xr = xmax;
  for (let x = xm; x <= xr; x++) if (x >= 0 && x < CAN && b + 1 < CAN) cv.put(x, b + 1, c, 'prop');
  for (const f of ch.drips) { const x = xm + rhe(f * (xr - xm)); for (let k = 0; k < ch.drip_len; k++) if (b + 2 + k < CAN) cv.put(x, b + 2 + k, c, 'prop'); }
}
function drawTops(cv, a, pal, hx, F, top, owner, idx) {
  const W = a.w;
  const groups = clusters(a).map(g => ({ g, m: mean(g.map(p => p[1])) })).sort((p, q) => p.m - q.m).map(o => o.g);
  const feet = groups.map(grp => { const jb = Math.max(...grp.map(p => p[0])); return [jb, rhe(mean(grp.filter(p => p[0] === jb).map(p => p[1])))]; });
  let mid = 0; groups.forEach((g, i) => { if (g.length > groups[mid].length) mid = i; });
  const coltop = x => {
    if (!(x >= 0 && x < CAN) || !top.has(x)) return null;
    const ty = top.get(x);
    for (let y = ty; y < Math.min(ty + 4, CAN); y++) if (idx[y * CAN + x] > 0) return y;
    return null;
  };
  const X0n = Math.floor(hx + 0.5) - Math.floor(W / 2);
  let best = null;
  for (const sh of [0, -1, 1, -2, 2, -3, -4, -5, -6]) {
    const X0 = X0n + sh, ts = feet.map(([, fi]) => coltop(X0 + fi));
    if (ts.every(t => t !== null) && Math.max(...ts.map(t => Math.abs(t - ts[mid]))) <= 3) { best = [X0, ts]; break; }
  }
  if (!best) best = [X0n, feet.map(([, fi]) => { const c = coltop(X0n + fi); return c !== null ? c : F.dome.yT; })];
  const [X0, ts] = best;
  groups.forEach((grp, gi) => {
    const jb = feet[gi][0], ty = ts[gi];
    for (const [j, i] of grp) { const x = X0 + i, y = ty - (jb - j); if (x >= 0 && x < CAN && y >= 0 && y < CAN && !KEEP_OUT[cv.own[y * CAN + x]]) cv.put(x, y, pal[at(a, j, i) - 1], owner); }
  });
}
function drawCorners(cv, a, pal, idx, F, owner) {
  const b = F.bottom;
  let xL = -1, xR = -1;
  for (let x = 0; x < CAN; x++) if (idx[b * CAN + x] > 0) { if (xL < 0) xL = x; xR = x; }
  const W = a.w;
  for (const grp of clusters(a)) {
    let r0 = grp.filter(p => p[0] === 0).map(p => p[1]);
    if (!r0.length) r0 = grp.map(p => p[1]);
    const back = mean(grp.map(p => p[1])) < W / 2;
    const off = back ? xL - 1 - Math.max(...r0) : xR + 1 - Math.min(...r0);
    for (const [j, i] of grp) { const x = i + off, y = b + j; if (x >= 0 && x < CAN && y >= 0 && y < CAN && !cv.a[y * CAN + x]) cv.put(x, y, pal[at(a, j, i) - 1], owner); }
  }
}
function glass(cv, idx, F, ramp, top, part) {
  const D = F.dome, yT = D.yT, yB = D.yB, cy = F.anchors.centre[1], xP = F.anchors.crown[0];
  for (let p = 0; p < N; p++) {
    if (!idx[p] || cv.own[p] !== O.body) continue;
    const y = (p / CAN) | 0, x = p % CAN, s = idx[p];
    if (y === (top.has(x) ? top.get(x) : -9) + 1 && x >= xP && (s === 2 || s === 3 || s === 4)) { cv.put(x, y, ramp.highlight, 'body'); continue; }
    if (part) continue;
    if (s === 3 && y < cy) cv.put(x, y, ramp.light, 'body');
    else if ((s === 3 || s === 4) && y > yT + 2 * (yB - yT) / 3 && (x + y) % 2 === 0) cv.put(x, y, s === 3 ? ramp.light : ramp.base, 'body');
  }
}
function patterns(cv, idx, F, kit, form, fam, theme, ramp, top, fcf) {
  const an = F.anchors, D = F.dome, steps = kit.j.steps;
  const ox = rhe(an.centre[0]), oy = rhe(an.centre[1]) - 6;
  const span = Math.max(1, D.yB - D.yT);
  const bottom = new Map();
  for (let p = 0; p < N; p++) if (idx[p] > 0) { const y = (p / CAN) | 0, x = p % CAN; bottom.set(x, Math.max(bottom.get(x) || 0, y)); }
  for (const name of fcf.pattern_names) {
    if (name === 'aurora') {
      const bands = fcf.pattern.aurora.bands;
      let xL = CAN, xR = -1;
      for (let p = 0; p < N; p++) if (idx[p]) { const x = p % CAN; if (x < xL) xL = x; if (x > xR) xR = x; }
      for (let p = 0; p < N; p++) {
        if (!(idx[p] > 0) || cv.own[p] !== O.body) continue;
        const y = (p / CAN) | 0, x = p % CAN;
        let b = Math.min(3, Math.trunc((x - xL) * 4 / (xR - xL + 1)));
        const edge = Math.ceil(xL + b * (xR - xL + 1) / 4);
        if (b > 0 && x === edge && (x + y) % 2 === 0) b -= 1;
        const st = steps[idx[p] - 1];
        const br = theme === 'night' ? bands[b].ramp_night[fam] : bands[b].ramp;
        cv.put(x, y, st === 'outline' || st === 'highlight' ? ramp[st] : hexrgb(br[st]), 'body');
      }
      continue;
    }
    const tile = kit.tiles[name], mode = TILE_MODE[name];
    const cols = fcf.pattern[name][fam][theme].map(hexrgb);
    const pat = new Uint8Array(N);
    const nearF = nearOwn(cv, setOf(['glint', 'face', 'blush']));
    const clear = new Uint8Array(N);
    for (let p = 0; p < N; p++) if (cv.a[p] && cv.own[p] === O.body && idx[p] >= 2 && idx[p] <= 4 && !nearF[p]) clear[p] = 1;
    if (mode === 'surface') {
      const grid = { w: 21, h: 21, data: new Uint8Array(441) };
      for (const [u, v, ci] of STARS_LAYOUT) {
        const cx = rhe(u * 20), cy = rhe((1 - v) * 20);
        for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) grid.data[clip(cy + dy, 0, 20) * 21 + clip(cx + dx, 0, 20)] = ci;
      }
      drawSurface(cv, grid, cols, [0.0, 1.0, 0.0, 1.0], 'pattern', idx, F, kit, fam, true, 4);
      continue;
    }
    if (mode === 'belt') {
      const yT = D.yT, b = F.bottom;
      const ys = [0.30, 0.62].map(f => Math.floor(yT + f * (b - yT) + 0.5));
      const cx = rhe(an.centre[0]);
      const riv = [];
      ys.forEach((y, k) => { for (let x = 0; x < CAN; x++) { if (!clear[y * CAN + x]) continue; if (pmod(x - cx, 4) === (k === 0 ? 1 : 3)) riv.push([y, x]); else { cv.put(x, y, cols[0], 'pattern'); pat[y * CAN + x] = 1; } } });
      for (let y = ys[0] + 1; y < ys[1]; y++) for (let x = 0; x < CAN; x++) if (clear[y * CAN + x] && pmod(x - cx, 8) === 3) { cv.put(x, y, cols[0], 'pattern'); pat[y * CAN + x] = 1; }
      for (const [y, x] of riv) cv.put(x, y, cols[1], 'detail');
      continue;
    }
    const tileAt = (y, x) => {
      const drop = (top.has(x) ? top.get(x) : D.yT) - D.yT;
      const k = 0.7 * clip((D.yB - y) / span, 0, 1);
      return tile[pmod(y - Math.floor(k * drop + 0.5) - oy, 16) * 16 + pmod(x - ox, 16)];
    };
    let want = null;
    if (mode === 'xy' && WHOLE[name]) {
      want = { w: CAN, h: CAN, data: new Uint8Array(N) };
      for (let y = 0; y < CAN; y++) for (let x = 0; x < CAN; x++) want.data[y * CAN + x] = tileAt(y, x);
      for (const v of WHOLE[name]) {
        const m = { w: CAN, h: CAN, data: want.data.map(t => (t === v ? 1 : 0)) };
        for (const grp of clusters(m)) if (!grp.every(([y, x]) => clear[y * CAN + x])) for (const [y, x] of grp) want.data[y * CAN + x] = 0;
      }
    }
    for (let p = 0; p < N; p++) {
      if (!clear[p]) continue;
      const y = (p / CAN) | 0, x = p % CAN;
      let t;
      if (mode === 'xy') t = want ? want.data[p] : tileAt(y, x);
      else if (mode === 'top') { const r = y - (top.has(x) ? top.get(x) : D.yT) - 1; t = r >= 0 && r < 16 ? tile[r * 16 + pmod(x - ox, 16)] : 0; }
      else if (mode === 'bottom') { const r = 15 - ((bottom.has(x) ? bottom.get(x) : D.yB) - 1 - y); t = r >= 0 && r < 16 ? tile[r * 16 + pmod(x - ox, 16)] : 0; }
      else { const r = Math.trunc(clip((y - D.yT) * 16 / span, 0, 15)); t = tile[r * 16 + pmod(x - ox, 16)]; }
      if (t) { pat[p] = t; cv.put(x, y, cols[Math.min(t, 2) - 1], 'pattern'); }
    }
    if (GLOWS.includes(name) && theme === 'night') {
      const dL = lab(cols[0])[0] - lab(hexrgb(fcf.ramps[fam].day.base))[0];
      if (dL >= 15) {
        const halo = [0, 1, 2].map(k => clip(cols[0][k] * 0.5 + ramp.base[k] * 0.5, 0, 1));
        const near = rollNear(pat, 1);
        for (let p = 0; p < N; p++) if (near[p] && idx[p] >= 2 && idx[p] <= 4 && !pat[p]) { const y = (p / CAN) | 0, x = p % CAN; if ((x + y) % 2 === 0 && cv.own[p] === O.body) cv.put(x, y, halo, 'halo'); }
      }
    }
  }
}
function pureRim(cv, idx, F, top) {
  const cy = F.anchors.centre[1];
  for (const [x, yt] of top) { const y = yt + 1, p = y * CAN + x; if (y >= 0 && y < CAN && y < cy && idx[p] >= 2 && (BODYLIKE[cv.own[p]])) cv.put(x, y, PURE, 'rim'); }
}
function foldPattern(cv, idx, ramp, steps) {
  const list = [];
  for (let p = 0; p < N; p++) if (cv.own[p] === O.pattern) list.push(p);
  for (const p of list) {
    const y = (p / CAN) | 0, x = p % CAN;
    let any = false;
    for (const [dy, dx] of N8) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < CAN && xx >= 0 && xx < CAN && cv.a[yy * CAN + xx] && allclose(cv.rgb, (yy * CAN + xx) * 3, cv.rgb, p * 3)) { any = true; break; } }
    if (!any) cv.put(x, y, ramp[steps[idx[p] - 1]], 'body');
  }
}
let NIGHT_SHIFT = null;
function nightOutfit(kit, fam, hx, theme) {
  if (theme !== 'night') return hexrgb(hx);
  const oc = kit.j.families[fam].outfits;
  const dL = lab(hexrgb(oc.night.ribbon.P))[0] - lab(hexrgb(oc.day.ribbon.P))[0];
  const L = lab(hexrgb(hx));
  return lab2rgb([L[0] + dL, L[1], L[2]]).map(v => clip(v, 0, 1));
}
function stampOver(cv, g, keys, x0, y0, owner, allow, kit, fam, theme, only = null) {
  for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) {
    const ch = g[j][i];
    if (!Object.hasOwn(keys, ch)) continue;
    const x = x0 + i, y = y0 + j;
    if (!(x >= 0 && x < CAN && y >= 0 && y < CAN) || (!allow[cv.own[y * CAN + x]] && cv.a[y * CAN + x])) continue;
    if (only && !only(x, y)) continue;
    cv.put(x, y, nightOutfit(kit, fam, keys[ch], theme), owner);
  }
}
function glassesGrid(eyeW, eyeH, spacing) {
  const W_ = eyeW + 2, H_ = eyeH + 2;
  const L = [];
  for (let y = 0; y < H_; y++) { let r = ''; for (let x = 0; x < W_; x++) { const edge = x === 0 || x === W_ - 1 || y === 0 || y === H_ - 1, corner = (x === 0 || x === W_ - 1) && (y === 0 || y === H_ - 1); r += edge && !corner ? 'f' : '.'; } L.push(r); }
  const W = spacing + eyeW + 2 + 1, out = [];
  for (let y = 0; y < eyeH + 2; y++) {
    const row = new Array(W).fill('.');
    [...L[y]].forEach((c, i) => { if (c === 'f') { row[1 + i] = 'f'; row[1 + spacing + i] = 'f'; } });
    if (y === 1) { row[0] = 'f'; for (let x = 1 + eyeW + 2; x < 1 + spacing; x++) row[x] = 'f'; }
    out.push(row.join(''));
  }
  return [out, { f: OC.glass }, [-2, -1]];
}
function shadesGrid(eyeW, eyeH, spacing) {
  const W_ = eyeW + 2, H_ = eyeH + 2, cx = (W_ - 1) / 2, cy = (H_ - 1) / 2;
  const star = [];
  for (let y = 0; y < H_; y++) { let r = ''; for (let x = 0; x < W_; x++) { const dx = Math.abs(x - cx), dy = Math.abs(y - cy); r += (dx + dy <= Math.max(cx, cy) + 0.6 || dx < 1 || dy < 1) ? 'k' : '.'; } star.push(r); }
  star[star.length - 1] = [...star[star.length - 1]].map(c => (c === 'k' ? 'g' : '.')).join('');
  const W = spacing + W_ + 1, out = [];
  for (let y = 0; y < H_; y++) {
    const row = new Array(W).fill('.');
    [...star[y]].forEach((c, i) => { if (c !== '.') { row[1 + i] = c; row[1 + spacing + i] = c; } });
    if (y === Math.floor(H_ / 2) - 1) { for (let x = 1 + W_; x < 1 + spacing; x++) row[x] = 'g'; row[0] = 'g'; }
    out.push(row.join(''));
  }
  return [out, { k: OC.shade_lens, g: OC.shade_frame }, [-2, -1]];
}
function tailSteps(x0, y0, slope, n) {
  const [a, b] = slope, out = [];
  for (let i = 0; i < n; i++) {
    if (a > b) { const x = x0 - i, y = y0 + Math.floor((i * b) / a); out.push({ cells: [[x, y], [x, y + 1]], edge: [[x, y - 1], [x, y + 2]], fringe: [[x, y - 1], [x, y + 1]] }); }
    else { const y = y0 + i, x = x0 - Math.floor((i * a) / b); out.push({ cells: [[x - 1, y], [x, y]], edge: [[x - 2, y], [x + 1, y]], fringe: [[x - 2, y], [x, y]] }); }
  }
  return out;
}
function scarfWorn(idx, ytop, bottom, eyes, eyeW, tag) {
  const body = (y, x) => idx[y * CAN + x] > 0;
  const ex0 = eyes[0][0];
  const xstep = ex0 - 3;
  const px = new Map(), K = (x, y) => x * 1000 + y;   // (x, y) -> key, kept in insertion order like a dict
  const set = (x, y, k) => px.set(K(x, y), [x, y, k]);
  const rows = new Map();
  for (let y = ytop - 1; y < ytop + 3; y++) { let a = -1, b = -1; for (let x = 0; x < CAN; x++) if (body(y, x)) { if (a < 0) a = x; b = x; } if (a >= 0) rows.set(y, [a, b]); }
  const lo = Math.min(...[...rows.values()].map(v => v[0])) - 1, hi = Math.max(...[...rows.values()].map(v => v[1])) + 2;
  for (let x = lo; x < hi; x++) {
    const y0 = x < xstep ? ytop - 1 : ytop;
    for (const [r, key] of [[0, 'L'], [1, 'K'], [2, 'k']]) {
      const y = y0 + r;
      if (!rows.has(y)) continue;
      const [xl, xr] = rows.get(y);
      if (xl <= x && x <= xr) set(x, y, key);
      else if (x === xl - 1 || x === xr + 1) set(x, y, 'O');
    }
  }
  const kx = rows.get(ytop)[0], ky = ytop - 1;
  KNOT.forEach((r, j) => [...r].forEach((key, i) => set(kx - 1 + i, ky + j, key)));
  for (let y = ky; y < ky + 3; y++) for (const x of [kx - 2, kx + 2]) if (x === kx - 2 || px.has(K(x, y))) set(x, y, 'O');
  const tailsPx = [];
  for (const [which, [x0, y0]] of [['long', [kx - 3, ky]], ['short', [kx - 1, ky + 3]]]) {
    let [slope, n] = (TAILS[tag] || TAILS.normal)[which === 'long' ? 0 : 1];
    let st;
    for (;;) {
      st = tailSteps(x0, y0, slope, n);
      const low = Math.max(...st.flatMap(s => [...s.cells, ...s.fringe].map(c => c[1])));
      if (low <= bottom - 1 || (slope[0] === SLOPES[SLOPES.length - 1][0] && slope[1] === SLOPES[SLOPES.length - 1][1])) break;
      slope = SLOPES[SLOPES.findIndex(s => s[0] === slope[0] && s[1] === slope[1]) + 1];
    }
    tailsPx.push(st);
  }
  for (const st of tailsPx) for (const s of st.slice(0, -1)) for (const [x, y] of s.edge) if (!px.has(K(x, y))) set(x, y, 'O');
  for (const st of tailsPx) {
    const n = st.length;
    st.forEach((s, i) => {
      if (i === n - 1) for (const [x, y] of s.fringe) set(x, y, 'k');
      else s.cells.forEach(([x, y], k) => set(x, y, (i === n - 2 ? 'ss' : 'Kk')[k]));
    });
  }
  return [...px.values()].filter(([x, y]) => x >= 0 && x < CAN && y >= 0 && y < CAN).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
function outfits(cv, info, kit, fam, theme, expr, worn, idx, F, top) {
  const an = F.anchors, tag = F.tag;
  for (const n of worn) {
    if (HEAD[n]) {
      const H = HEAD[n], g = H.poses[tag], last = g.length - 1;
      const xs = []; [...g[last]].forEach((c, i) => { if (c !== '.') xs.push(i); });
      const ft = rhe(mean(xs)), fx = Math.floor(an.headwear[0] + H.dx + 0.5);
      const y0 = (top.has(fx) ? top.get(fx) : F.dome.yT) - last;
      stampOver(cv, g, H.keys, fx - ft, y0, 'head', BASE_ALLOW, kit, fam, theme);
    } else if (n === 'glasses' || n === 'shades') {
      const fc = kit.j.faces[kit.j.faces[fam] ? fam : 'dollop'], eg = fc.expressions[expr].eye;
      const [g, keys, off] = (n === 'glasses' ? glassesGrid : shadesGrid)(eg[0].length, eg.length, fc.spacing_px);
      const [ex, ey] = info.placed.eyes[0];
      stampOver(cv, g, keys, ex + off[0], ey + off[1], 'face_outfit', n === 'shades' ? BASE_ALLOW_SH : BASE_ALLOW, kit, fam, theme);
    } else if (n === 'scarf') {
      const fcj = kit.j.faces[kit.j.faces[fam] ? fam : 'dollop'], ex = fcj.expressions[expr];
      const mo = info.placed.mouth;
      const ytop = fam === 'curly' && mo && ex.mouth ? mo[1] + ex.mouth.length : info.placed.eyes[0][1] + ex.eye.length;
      for (const [x, y, key] of scarfWorn(idx, ytop, F.bottom, info.placed.eyes, ex.eye[0].length, F.tag)) {
        const p = y * CAN + x;
        if (!(BASE_ALLOW[cv.own[p]] || !cv.a[p])) continue;
        if (key === 'C') continue;
        cv.put(x, y, nightOutfit(kit, fam, WORN[key], theme), 'neck');
      }
    }
  }
}
function breedOverlay(cv, idx, F, kind, rampAt, top) {
  const tag = F.tag, xP = F.dome.xP, put = [];
  const topsOf = () => { const t = new Map(); for (let x = 0; x < CAN; x++) for (let y = 0; y < CAN; y++) if (idx[y * CAN + x] > 0) { t.set(x, y); break; } return t; };
  const tops_ = topsOf();
  if (kind === 'topknot') {
    const g = BREED.topknot[tag], w = g[0].length, seat = BREED_AT.topknot.seat;
    const tried = [];
    BREED_AT.topknot.centres.forEach((c, k) => {
      const cx = Math.floor(xP + c + 0.5), x0 = cx - Math.floor(w / 2);
      const y0 = (top.has(cx) ? top.get(cx) : F.dome.yT) - g.length + seat;
      let gap = 0;
      for (let i = 0; i < w; i++) {
        const js = []; for (let j = 0; j < g.length; j++) if (!'.0'.includes(g[j][i])) js.push(j);
        if (js.length) gap = Math.max(gap, tops_.has(x0 + i) ? tops_.get(x0 + i) - (y0 + Math.max(...js)) - 1 : 99);
      }
      tried.push([Math.max(gap, 1), k, c, x0, y0]);
    });
    tried.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    put.push([g, tried[0][3], tried[0][4]]);
  } else {
    BREED.ears[tag].forEach((g, si) => {
      const fx = Math.floor(xP + BREED_AT.ears[si === 0 ? 'back' : 'front'] + 0.5);
      put.push([g, fx - Math.floor(g[0].length / 2), (top.has(fx) ? top.get(fx) : F.dome.yT) - g.length + 1]);
    });
  }
  const seat = kind === 'topknot' ? BREED_AT.topknot.seat : 0;
  const drawn = [];
  for (const [g, x0, y0] of put) for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) {
    const c = g[j][i];
    if ('.0'.includes(c)) continue;
    const x = x0 + i, y = y0 + j;
    if (!(x >= 0 && x < CAN && y >= 0 && y < CAN) || KEEP_OUT[cv.own[y * CAN + x]]) continue;
    let v = +c;
    if (v === 1 && j >= g.length - seat && idx[y * CAN + x] > 0) v = 2;
    cv.put(x, y, rampAt(x, v), 'breed');
    drawn.push([x, y]);
  }
  if (kind === 'topknot' && BREED_AT.topknot.crease) {
    for (const [g, x0, y0] of put) {
      const j = g.length - seat, cols = []; [...g[j]].forEach((c, i) => { if (!'.0'.includes(c)) cols.push(i); });
      const y = y0 + j;
      for (const x of [x0 + Math.min(...cols) - 1, x0 + Math.max(...cols) + 1]) {
        if (x >= 0 && x < CAN && y >= 0 && y < CAN && idx[y * CAN + x] > 0 && !KEEP_OUT_BR[cv.own[y * CAN + x]]) { cv.put(x, y, rampAt(x, 2), 'breed'); drawn.push([x, y]); }
      }
    }
  }
  const colmax = new Map();
  for (const [x, y] of drawn) colmax.set(x, Math.max(colmax.has(x) ? colmax.get(x) : -1, y));
  if (colmax.size) {
    const xs = [...colmax.keys()].sort((a, b) => a - b);
    for (const [x, yb] of colmax) {
      if (tops_.has(x) && tops_.get(x) > yb + 2) {
        for (let y = yb + 1; y < tops_.get(x); y++) if (!KEEP_OUT[cv.own[y * CAN + x]]) cv.put(x, y, rampAt(x, x === xs[0] || x === xs[xs.length - 1] ? 1 : 2), 'breed');
      }
    }
  }
}
function foldAll(cv, idx, ramp, steps) {
  for (const owner of [O.pattern, O.body]) {
    for (let pass = 0; pass < 3; pass++) {
      let ch = 0;
      const list = [];
      for (let p = 0; p < N; p++) if (cv.own[p] === owner) list.push(p);
      for (const p of list) {
        const y = (p / CAN) | 0, x = p % CAN, nb = [];
        for (const [dy, dx] of N8) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < CAN && xx >= 0 && xx < CAN && cv.a[yy * CAN + xx]) nb.push(yy * CAN + xx); }
        if (nb.some(q => cv.eq(q, p))) continue;
        if (owner === O.pattern) { cv.put(x, y, ramp[steps[idx[p] - 1]], 'body'); ch++; continue; }
        let cand = nb.filter(q => BODY_PAT[cv.own[q]]);
        if (cand.length) { cv.copyTo(x, y, mostCommon(cv, cand), O.body); ch++; continue; }
        cand = nb.filter(q => PROPLIKE[cv.own[q]]);
        if (cand.length) { const b = mostCommon(cv, cand); cv.copyTo(x, y, b, cv.own[b]); ch++; }
      }
      if (!ch) break;
    }
  }
}

// ---------- compose_kit.compose_form, for the game ----------
// opts: fam ('curly' | 'dollop' | 'mixed'), frame (a kit frame id), form (a form id: 'spark', 'heat+sweet', ...), theme,
// expr (open, blink, happy, determined, cheer, think), worn (kit outfit names, head / face / neck order), pure, propFrame
// (0 | 1), spark (the Volt's surge spark frame or null), breed ('ears' | 'topknot' | null), ramps (a body ramp
// { day: {outline..highlight}, night: {...} } for a rival's place colour or a slime's own colour; null: the form's own,
// from the kit), fc (the form's forms_colours entry with its colours moved: race-colour.js; null: the kit's)
// Returns a Uint8ClampedArray(56 * 56 * 4).
export function composeRunner(kit, { fam, frame, form, theme = 'day', expr = 'open', worn = [], pure = false, propFrame = 0, spark = null, breed = null, ramps = null, fc = null }) {
  const FC = fc || kit.fc[form];   // fc: the form's colours moved to this slime's own (race-colour.js runnerColours)
  const fid = frame;
  const extra = worn.filter(w => !PILOT_WORN.includes(w));
  const pilot = worn.filter(w => PILOT_WORN.includes(w));
  let cv, info, idx, F, ramp;
  if (form === 'spark') {
    ({ cv, info, idx, F } = composeBase(kit, fam, fid, theme, expr, propFrame, pilot, 'volt', spark, ramps));
  } else {
    const fcf = FC;
    const rr = ramps || fcf.ramps[fam];
    ({ cv, info, idx, F, ramp } = composeBase(kit, fam, fid, theme, expr, 0, pilot, form, spark, rr));
    const top = topMap(F), formDef = kit.forms[form];
    if (fcf.glass) glass(cv, idx, F, ramp, top, fcf.glass === 'part');
    patterns(cv, idx, F, kit, formDef, fam, theme, ramp, top, fcf);
    foldPattern(cv, idx, ramp, kit.j.steps);
    const LAYERS = ['behind', 'inner', 'surface', 'front'];
    const props = (formDef.props || []).map((n, i) => ({ n, i })).sort((a, b) => LAYERS.indexOf(kit.pj.props.sprites[a.n].layer) - LAYERS.indexOf(kit.pj.props.sprites[b.n].layer) || a.i - b.i).map(o => o.n);
    for (const n of props) {
      const [a, m] = sprite(kit, 'props', n, propFrame, fam);
      const pal = stampPal(m, theme, ramp);
      const kind = m.place[0];
      if (kind === 'parts') { drawParts(cv, a, pal, m, F, fam, top, idx); continue; }
      if (kind === 'graham') { drawGraham(cv, a, pal, m, F, fam, top, idx, theme); continue; }
      if (kind === 'tops') {
        const off = m.offset || {}, fdx = off[fam] && off.dollop ? off[fam][0] - off.dollop[0] : 0.0;
        drawTops(cv, a, pal, F.anchors.head_top[0] + m.place[1] + fdx, F, top, 'prop', idx);
        continue;
      }
      if (kind === 'corners') { drawCorners(cv, a, pal, idx, F, 'prop'); continue; }
      const [x0, y0] = place(m, a, F, fam, top, idx);
      if (m.layer === 'surface') drawSurface(cv, a, pal, m.region, 'prop', idx, F, kit, fam, !!m.margin, m.spacing || 0);
      else drawSprite(cv, a, pal, x0, y0, m.layer, 'prop', idx);
    }
    for (const t of formDef.keep || []) {
      const accs = kit.pj.acc.sprites, names = Object.keys(accs);
      const name = names.find(n => accs[n].trait === t && (accs[n].for_forms || []).includes(form)) || names.find(n => accs[n].trait === t && !accs[n].for_forms);
      const [a, m] = sprite(kit, 'acc', name);
      const pal = stampPal(m, theme, ramp);
      const [x0, y0] = place(m, a, F, fam, top, idx);
      if (m.layer === 'surface') drawSurface(cv, a, pal, m.region, 'acc', idx, F, kit, fam, !!m.margin, m.spacing || 0);
      else drawSprite(cv, a, pal, x0, y0, m.layer, 'acc', idx);
    }
  }
  const top = topMap(F);
  if (breed) {
    const steps = kit.j.steps;
    const src = form === 'spark' ? (ramps || kit.j.families[fam].ramp) : (ramps || FC.ramps[fam]);
    const rp = Object.fromEntries(Object.entries(src[theme]).map(([s, v]) => [s, hexrgb(v)]));
    let rampAt;
    if (((FC || {}).pattern_names || []).includes('aurora')) {
      const bands = FC.pattern.aurora.bands;
      let xL = CAN, xR = -1;
      for (let p = 0; p < N; p++) if (idx[p]) { const x = p % CAN; if (x < xL) xL = x; if (x > xR) xR = x; }
      const pick = bd => (theme === 'night' ? bd.ramp_night[fam] : bd.ramp);
      rampAt = (x, i) => hexrgb(pick(bands[Math.trunc(clip((x - xL) * 4 / (xR - xL + 1), 0, 3))])[steps[i - 1]]);
    } else rampAt = (x, i) => rp[steps[i - 1]];
    breedOverlay(cv, idx, F, breed, rampAt, top);
  }
  if (pure) pureRim(cv, idx, F, top);
  if (extra.length) outfits(cv, info, kit, fam, theme, expr, extra, idx, F, top);
  if (form !== 'spark') foldAll(cv, idx, ramp, kit.j.steps);
  const out = new Uint8ClampedArray(N * 4);
  for (let p = 0; p < N; p++) {
    out[p * 4] = rhe(cv.rgb[p * 3] * 255); out[p * 4 + 1] = rhe(cv.rgb[p * 3 + 1] * 255); out[p * 4 + 2] = rhe(cv.rgb[p * 3 + 2] * 255);
    out[p * 4 + 3] = cv.a[p] ? 255 : 0;
  }
  return out;
}
