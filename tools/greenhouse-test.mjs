// The Greenhouse, plain node (no browser): the room's files and its menu objects, where the helpers stand, the
// slimeling pals' hops, the camera's limits, and the one-time move of old saves to the Greenhouse.
//   node tools/greenhouse-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { GREENHOUSE } from '../src/data/content.js';
import { groundY, roofY, camExcess, insideLimits, CamRig, LIMIT_NAMES, helperSpots, spotProblems, palStart, palWander, palToward, palSpotOk, palHopOk, roomMeta } from '../src/view/greenhouse-math.js';
import { createState, migrate } from '../src/core/sim.js';
import { cameraMatrix, project } from '../src/view/bubble-math.js';
import { readGLB } from '../src/view/glb.js';
import { buildCells, markCells, frustumPlanes, sphereRect, CellPass } from '../src/view/room-cells.js';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(root, 'src/assets/greenhouse');
let fails = 0, checks = 0;
const ok = (cond, what, detail = '') => { checks++; if (cond) console.log('ok  ', what); else { fails++; console.log('FAIL', what, detail); } };
const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// ---------- 1. the room's files (format 2) ----------
const meta = JSON.parse(fs.readFileSync(path.join(ASSETS, 'gh.json'), 'utf8'));
const bin = fs.readFileSync(path.join(ASSETS, 'gh.bin'));
const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
ok(meta.format === 2, 'gh.json is format 2');
const inFile = Object.entries(meta.chunks).filter(([, [o, n]]) => !(o >= 0 && n > 0 && o + n <= bin.length));
ok(!inFile.length, `every chunk lies inside gh.bin (${Object.keys(meta.chunks).length} chunks, ${bin.length} bytes)`, inFile.map(c => c[0]).join(', '));
const ends = Object.values(meta.chunks).map(([o, n]) => o + n).sort((a, b) => b - a)[0];
ok(ends === bin.length, 'the chunks fill gh.bin to its end', `${ends} vs ${bin.length}`);
const meshes = [...meta.room_chunks.map(c => ({ name: c.name, points: c.points, tris: c.tris, uv: false })), { name: 'floor', ...meta.floor, uv: true }];
let tris = 0;
for (const m of meshes) {
  const [po, pn] = meta.chunks[m.name + '.pos'], [io, iN] = meta.chunks[m.name + '.idx'];
  ok(pn === m.points * 3 * 2 && po % 2 === 0, `${m.name}.pos: ${m.points} points x 3 int16`, `${pn} bytes`);
  ok(iN === m.tris * 3 * 2 && io % 2 === 0, `${m.name}.idx: ${m.tris} triangles x 3 uint16`, `${iN} bytes`);
  const idx = new Uint16Array(buf, io, iN / 2);
  let max = 0; for (const v of idx) if (v > max) max = v;
  ok(max < m.points, `${m.name}: every index is below its point count (${max} < ${m.points})`);
  if (m.uv) { const [uo, un] = meta.chunks[m.name + '.uv']; ok(un === m.points * 2 * 4 && uo % 4 === 0, `${m.name}.uv: ${m.points} x 2 float32`); }
  else for (const k of ['day', 'night']) { const [, n] = meta.chunks[`${m.name}.${k}`]; ok(n === m.points * 3, `${m.name}.${k}: ${m.points} x 3 uint8 colors`); }
  tris += m.tris;
}
for (const f of ['floor_day.jpg', 'floor_night.jpg']) ok(fs.statSync(path.join(ASSETS, f)).size > 1000, `${f} is there`);
ok(Array.isArray(meta.footprints) && meta.footprints.length >= 7 && meta.room && meta.spots.some(s => s.name === 'telescope'), 'gh.json has the footprints, the room limits and the telescope spot');
const bytes = fs.readdirSync(ASSETS).reduce((s, f) => s + fs.statSync(path.join(ASSETS, f)).size, 0);
console.log(`     the room: ${tris} triangles in ${meshes.length} meshes, ${(bytes / 1e6).toFixed(2)} MB on disk`);

// ---------- 1b. [perf] the room's cells (src/view/room-cells.js): each pass draws only the cells it can show ----------
{
  const C = GREENHOUSE.cells, q = 1 / 32767, H = meta.qbox.half, Cn = meta.qbox.center;
  const PH = 393 / 852, size = 0.75;
  const pb = Math.min(1.5, 1 + (0.9 - PH) * 0.8);
  const cams = { front: { pos: [0, 2.25 + size * 0.75, (7.6 + size * 2.4) * pb], look: [0, 0.65 + size * 0.42, 0], fov: 30 },
    ...Object.fromEntries(Object.entries(GREENHOUSE.camera.views).map(([k, v]) => [k, v])) };
  const slime = { c: [0, 0.3 + size * 0.75, 0], r: size * 0.95 + 0.05 };   // a hatchling's body, roughly
  const all = { pic: {}, see: {} };
  let built = 0, ms = 0;
  for (const m of meta.room_chunks) {
    const [po, pn] = meta.chunks[m.name + '.pos'], [io, iN] = meta.chunks[m.name + '.idx'];
    const pos = new Int16Array(buf, po, pn / 2), idx = new Uint16Array(buf, io, iN / 2);
    const t0 = performance.now();
    const cells = buildCells(pos, idx, Cn, H, C);
    ms += performance.now() - t0;
    built += cells.n;
    // every triangle once, in order, inside its cell's box; no cell over the leaf size
    const key = (a, t) => `${a[t * 3]},${a[t * 3 + 1]},${a[t * 3 + 2]}`;
    const seen = new Map();
    for (let t = 0; t < m.tris; t++) seen.set(key(idx, t), (seen.get(key(idx, t)) || 0) + 1);
    for (let t = 0; t < m.tris; t++) { const k = key(cells.order, t); seen.set(k, (seen.get(k) || 0) - 1); }
    ok([...seen.values()].every(v => v === 0) && cells.order.length === idx.length, `${m.name}: the cells hold every triangle once (${cells.n} cells)`);
    let outside = 0, over = 0;
    const W = v => [Cn[0] + H[0] * Math.max(pos[v * 3] * q, -1), Cn[1] + H[1] * Math.max(pos[v * 3 + 1] * q, -1), Cn[2] + H[2] * Math.max(pos[v * 3 + 2] * q, -1)];
    for (let c = 0; c < cells.n; c++) {
      if (cells.count[c] / 3 > C.leaf) over++;
      for (let i = cells.start[c]; i < cells.start[c] + cells.count[c]; i++) {
        const p = W(cells.order[i]);
        for (let a = 0; a < 3; a++) if (p[a] < cells.lo[c * 3 + a] - 1e-4 || p[a] > cells.hi[c * 3 + a] + 1e-4) outside++;
      }
    }
    ok(!outside && !over, `${m.name}: every cell's box holds its triangles, none over ${C.leaf} triangles`, `${outside} outside, ${over} over`);
    // per angle: the cells marked hold every triangle the pass can show (none left out), and how many that is
    for (const [name, v] of Object.entries(cams)) {
      const M = cameraMatrix({ ...v, aspect: PH });
      const planes = frustumPlanes(M, new Float32Array(24));
      const mark = new Uint8Array(cells.n);
      const picTris = markCells(cells, planes, mark);
      const cellOf = new Uint32Array(m.tris);
      for (let c = 0; c < cells.n; c++) for (let t = cells.start[c] / 3; t < (cells.start[c] + cells.count[c]) / 3; t++) cellOf[t] = c;
      // the see-through frustum behind the slime (as greenhouse.js cull() makes it, with `grow`)
      const r = slime.r * C.grow, rect = sphereRect(M, slime.c, r, C.pad / PH, C.pad);
      const view = cameraMatrix({ ...v, aspect: PH, fov: 90 });   // (only its direction is used)
      const f = [v.look[0] - v.pos[0], v.look[1] - v.pos[1], v.look[2] - v.pos[2]], fl = Math.hypot(...f);
      const fwd = f.map(x => x / fl), fc = fwd[0] * v.pos[0] + fwd[1] * v.pos[1] + fwd[2] * v.pos[2];
      const depth = fwd[0] * slime.c[0] + fwd[1] * slime.c[1] + fwd[2] * slime.c[2] - fc;
      const sp = frustumPlanes(M, new Float32Array(24), 0, rect, [fwd[0], fwd[1], fwd[2], -fc - (depth - r)]);
      const smark = new Uint8Array(cells.n);
      const seeTris = markCells(cells, sp, smark);
      void view;
      let missPic = 0, missSee = 0;
      for (let t = 0; t < m.tris; t++) {
        const pts = [0, 1, 2].map(k => W(cells.order[t * 3 + k]));
        const pr = pts.map(p => project(M, p));
        // the picture: a triangle with a corner on the picture
        if (pr.some(p => p && Math.abs(p[0]) <= 1 && Math.abs(p[1]) <= 1) && !mark[cellOf[t]]) missPic++;
        // the see-through pass: a corner inside the slime's rect and beyond its front
        const inRect = pts.some((p, k) => pr[k] && pr[k][0] >= rect[0] && pr[k][0] <= rect[1] && pr[k][1] >= rect[2] && pr[k][1] <= rect[3] &&
          fwd[0] * p[0] + fwd[1] * p[1] + fwd[2] * p[2] - fc >= depth - r);
        if (inRect && !smark[cellOf[t]]) missSee++;
      }
      ok(!missPic && !missSee, `${m.name}, ${name}: no triangle the picture or the see-through pass can show is left out`, `${missPic} / ${missSee} left out`);
      all.pic[name] = (all.pic[name] || 0) + picTris;
      all.see[name] = (all.see[name] || 0) + seeTris;
    }
  }
  const total = meta.room_chunks.reduce((s, c) => s + c.tris, 0), pct = v => `${Math.round(v / 1000)}k (${Math.round(v / total * 100)}%)`;
  for (const name of Object.keys(cams)) console.log(`     ${name.padEnd(6)} the room's chunks drawn: picture ${pct(all.pic[name])}, see-through ${pct(all.see[name])} of ${Math.round(total / 1000)}k`);
  console.log(`     ${built} cells, built in ${Math.round(ms)} ms`);
  ok(Object.keys(cams).every(n => all.pic[n] < total * 0.85 && all.see[n] < total * 0.35), 'every angle draws fewer of the room\'s triangles (picture under 85%, see-through under 35%)');
  // CellPass: keeps its list while what it needs is in it; rebuilds when a needed cell is missing
  const [po, pn] = meta.chunks['r0.pos'];
  const pos = new Int16Array(buf, po, pn / 2), [io, iN] = meta.chunks['r0.idx'], idx = new Uint16Array(buf, io, iN / 2);
  const cells = buildCells(pos, idx, Cn, H, C), out = new Uint16Array(idx.length), pass = new CellPass(cells, out);
  const M = cameraMatrix({ ...cams.front, aspect: PH }), k = 1 + C.margin;
  const need = frustumPlanes(M, new Float32Array(24)), want = frustumPlanes(M, new Float32Array(24), 0, [-k, k, -k, k]);
  ok(pass.update(need, want) && pass.count > 0, 'a pass builds its list the first time');
  ok(!pass.update(need, want), 'and keeps it while the camera stays');
  const M2 = cameraMatrix({ ...cams.front, pos: [cams.front.pos[0] + 0.05, cams.front.pos[1], cams.front.pos[2]], aspect: PH });
  ok(!pass.update(frustumPlanes(M2, new Float32Array(24)), frustumPlanes(M2, new Float32Array(24), 0, [-k, k, -k, k])), 'and through a small sway');
  const M3 = cameraMatrix({ ...cams.left, aspect: PH });
  ok(pass.update(frustumPlanes(M3, new Float32Array(24)), frustumPlanes(M3, new Float32Array(24), 0, [-k, k, -k, k])), 'a new angle rebuilds it');
  ok(pass.all() && pass.count === idx.length, 'all(): every triangle');
}

// ---------- 2. the ground and the helper spots ----------
// the footprints as the game uses them: gh.json's, less the stool and the bowl, plus the hutch and the menu objects
const tp = JSON.parse(fs.readFileSync(path.join(ASSETS, 'tp_objects.json'), 'utf8'));
const live = roomMeta(meta, tp), feet = live.footprints;
const G = GREENHOUSE, room = meta.room, stump = feet.find(f => f.name === 'stump');
ok(near(groundY(0, 0), room.stump_top) && near(groundY(0, 0), stump.top), `the stump top is ${room.stump_top} (the slime's seat)`);
ok(near(groundY(1.8, 0), G.ground.rugY) && near(groundY(0, -3), G.ground.floorY), 'the rug and the floor');
ok(G.ground.stumpR === room.stump_r, `the ground's stump radius matches gh.json (${room.stump_r})`);
// the counts shown for High and Low, read from helpers3d.js (the prop limit lives there)
const h3d = fs.readFileSync(path.join(root, 'src/view/helpers3d.js'), 'utf8');
const shownSrc = h3d.match(/const SHOWN = \{\s*high: (\{[^}]*\}),\s*low: (\{[^}]*\}),?\s*\};/);
ok(!!shownSrc, 'found the prop limit (SHOWN) in helpers3d.js');
const parse = s => Object.fromEntries([...s.matchAll(/(\w+): (\d+)/g)].map(m => [m[1], +m[2]]));
const SHOWN = { high: parse(shownSrc[1]), low: parse(shownSrc[2]) };
ok(G.spots.planters.length >= SHOWN.high.garden && G.spots.lamps.length >= SHOWN.high.lamp, 'a spot for every planter and Moon Lamp shown on High');
for (const q of ['high', 'low']) {
  const spots = helperSpots(SHOWN[q]);
  const p = spotProblems(spots, feet, room);
  ok(!p.length, `${q}: ${spots.length} helpers, none on a footprint, in a wall, outside the room or on another helper`, '\n       ' + p.join('\n       '));
}
const tel = meta.spots.find(s => s.name === 'telescope'), ob = G.spots.observatory;
ok(Math.hypot(ob[0] - tel.x, ob[1] - tel.z) <= 0.15, `the Dream Telescope stands in the room's telescope spot (${Math.hypot(ob[0] - tel.x, ob[1] - tel.z).toFixed(2)} from it)`);
// the terrarium: the stool and the bowl are gone; the hutch and every menu object standing on the floor have footprints
ok(!feet.some(f => G.room.gone.includes(f.name)) && G.room.gone.every(n => meta.footprints.some(f => f.name === n)), `the footprints drop the ${G.room.gone.join(' and ')} (gh.json still lists them)`);
const floorObjs = Object.keys(tp.objects).filter(n => tp.objects[n].position[1] < G.room.shelfY);
ok(floorObjs.length === 6 && floorObjs.every(n => feet.some(f => f.name === 'tp_' + n && f.menu)), `a footprint for each menu object on the floor (${floorObjs.join(', ')}); the jar and the toy barn are on the shelf`);
{
  const hut = feet.filter(f => f.name === 'hutch'), H = G.room.hutch;
  const covered = x => hut.some(f => Math.abs(x - f.x) <= Math.sqrt(f.r * f.r - (H.z[1] - f.z) ** 2));
  let gaps = 0; for (let x = H.x[0]; x <= H.x[1]; x += 0.01) if (!covered(x)) gaps++;
  ok(hut.length >= 6 && gaps === 0, `the hutch: ${hut.length} footprints along its whole front (x ${H.x.join(' to ')})`);
}
// the calm space behind the slime (Front, a phone, the hatchling the frames were judged on: the planning box x 85-305,
// y 280-475 of 390 x 844 pt, design/terrarium-prod-brief.md 1): no helper stands in it. The planters, which stood
// behind the stump, are now out of the Front picture altogether for every slime size (so never on a menu object).
{
  const PH = 390 / 844, SIZES_F = [0.6, 0.681, 0.76, 0.9, 1.04, 1.16];
  const frontCam = s => { const b = Math.min(1.5, 1 + (0.9 - PH) * 0.8); return cameraMatrix({ pos: [0, 2.25 + s * 0.75, (7.6 + s * 2.4) * b], look: [0, 0.65 + s * 0.42, 0], fov: 30, aspect: PH, h: 844 }); };
  const ring = (x, z, r, h, m) => { const out = []; for (let a = 0; a < 16; a++) for (const y of [0, h]) { const q = project(m, [x + r * Math.cos(a * Math.PI / 8), y, z + r * Math.sin(a * Math.PI / 8)]); if (q) out.push([(q[0] + 1) / 2 * 390, (1 - q[1]) / 2 * 844]); } return out; };
  const hatch = frontCam(0.681), inZone = [];
  for (const s of helperSpots(SHOWN.high)) {
    const p = ring(s.x, s.z, s.r, 1.6, hatch), b = [Math.min(...p.map(v => v[0])), Math.min(...p.map(v => v[1])), Math.max(...p.map(v => v[0])), Math.max(...p.map(v => v[1]))];
    if (b[2] > 85 && b[0] < 305 && b[3] > 280 && b[1] < 475) inZone.push(s.id);
  }
  ok(!inZone.length, 'Front (hatchling, phone): no helper stands in the calm space behind the slime', inZone.join(', '));
  const seen = [];
  G.spots.planters.forEach(([x, z], i) => SIZES_F.forEach(s => { if (ring(x, z, G.radius.planter, 0.62, frontCam(s)).some(([u, v]) => u > 0 && u < 390 && v > 0 && v < 844)) seen.push(`planter ${i} (size ${s})`); }));
  ok(!seen.length, `Front (phone, slime sizes ${SIZES_F.join(', ')}): every planter spot is out of the picture`, seen.join(', '));
}
// the Rainbow Arch: over the garden, all of it behind the back glass
const A = G.spots.rainbow;
ok(A.pos[2] + A.tube < room.z_back_in - 2, `the Rainbow Arch is in the garden behind the back glass (z ${A.pos[2]})`);

// the slimeling pals: thousands of seeded hops (and visits) on the rug and the floor, never into the stump, the bench,
// a footprint, a helper or each other
{
  const statics = [...feet, ...helperSpots(SHOWN.high)].map(f => ({ x: f.x, z: f.z, r: f.r }));
  const rnd = seeded(7), pr = G.spots.pals.spacing / 2;
  const pals = [];
  for (let i = 0; i < SHOWN.high.slimeling; i++) pals.push(palStart(rnd, [...statics, ...pals.map(p => ({ x: p[0], z: p[1], r: pr }))], room));
  let bad = 0, hops = 0, stays = 0, visits = 0;
  const others = i => pals.filter((_, j) => j !== i).map(p => ({ x: p[0], z: p[1], r: pr }));
  pals.forEach((p, i) => { if (!palSpotOk(p[0], p[1], [...statics, ...others(i)], undefined, room)) bad++; });
  for (let n = 0; n < 6000; n++) {
    const i = n % pals.length, from = pals[i], bl = [...statics, ...others(i)];
    let to;
    if (n % 7 === 0) {   // a visit to the slime: around the ring toward a point beside it
      const a = (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6);
      to = palToward(from, [Math.sin(a) * 2.3, Math.cos(a) * 2.3], rnd, bl, room); visits++;
    } else to = palWander(from, rnd, bl, room);
    if (!to) { stays++; continue; }
    hops++;
    if (!palSpotOk(to[0], to[1], bl, undefined, room) && !(n % 7 === 0 && Math.hypot(...to) <= G.spots.pals.ring[1])) bad++;
    if (!palHopOk(from, to, bl)) bad++;
    pals[i] = to;
  }
  ok(bad === 0, `pals: ${hops} hops (${visits} visit steps, ${stays} hops in place), every one on the rug or the floor, clear of the stump, the bench, the footprints, the helpers and each other`, `${bad} bad`);
}

// ---------- 2b. the terrarium's menu objects (tp_objects.json, tp_<name>.glb, src/view/glb.js) ----------
{
  const names = Object.keys(tp.objects);
  ok(names.join() === 'chest,mirror,bench,jar,barn,basket,slate,stake', `tp_objects.json lists the 8 menu objects (${names.join(', ')})`);
  for (const [n, o] of Object.entries(tp.objects)) {
    let g = null, why = '';
    try { const b = fs.readFileSync(path.join(ASSETS, o.glb)); g = readGLB(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); } catch (e) { why = e.message; }
    ok(!!g, `${o.glb} reads (one mesh: positions, texture coordinates, indices; the anchors as child nodes)`, why);
    if (!g) continue;
    ok(g.tris === o.tris && g.tris <= 3000, `${n}: ${g.tris} triangles, as tp_objects.json says (<= 3000)`);
    const want = ['Glow_Anchor', 'Sparkle_Anchor', 'Tag_Anchor', 'Tap_' + n], d = Math.max(...want.map(k => g.nodes[k] && o.nodes[k] ? Math.max(...[0, 1, 2].map(i => Math.max(Math.abs(g.nodes[k].t[i] - o.nodes[k].t[i]), Math.abs(g.nodes[k].s[i] - o.nodes[k].s[i])))) : Infinity));
    ok(d < 1e-3, `${n}: its anchors (${want.join(', ')}) in the GLB, where tp_objects.json puts them`, `largest difference ${d}`);
    for (const t of [o.tex.day, o.tex.night]) ok(fs.statSync(path.join(ASSETS, t)).size > 1000, `${n}: ${t} is there`);
  }
  for (const f of Object.values(tp.sprites)) ok(fs.statSync(path.join(ASSETS, f)).size > 1000, `${f} is there`);
  ok(new Set(Object.values(tp.objects).map(o => o.shadow.opacity.join())).size === 1, 'every contact shadow fades the same way by night (they are drawn as one mesh)');
  ok(Object.values(tp.objects).filter(o => o.glow).map(o => o.glow.color).join() === '#ffd36a,#5fe3b8,#ffcf6a', 'three night glows: the chest, the jar and the toy barn');
  const L = tp.objects.stake.label;
  ok(L && L.day.fill && L.night.fill && L.w > 0 && L.h > 0, 'the stake carries a label (written at run time: the name and the number)');
  const total = fs.readdirSync(ASSETS).reduce((s, f) => s + fs.statSync(path.join(ASSETS, f)).size, 0);
  ok(total <= 4.7e6, `the room and its menu objects: ${(total / 1e6).toFixed(3)} MB (<= 4.7 MB)`);
}

// ---------- 3. the camera ----------
const C = G.camera, L = C.limits;
const CUSHION_TOP = 0.3;   // src/view/stage.js
const pivot = size => [0, CUSHION_TOP + 0.35 + 0.42 * size, 0];
const SIZES = [0.6, 0.76, 0.9, 1.04, 1.16];
// the Front camera exactly as the stage computes it (no sway, no menu zoom), for a phone (393 x 852) and a wide screen
const front = (size, aspect) => {
  const boost = aspect < 0.9 ? Math.min(1.5, 1 + (0.9 - aspect) * 0.8) : 1;
  return { pos: [0, 2.25 + size * 0.75, (7.6 + size * 2.4) * boost], look: pivot(size), fov: 30 };
};
const fmtE = e => e.map((v, i) => v > 1e-6 ? `${LIMIT_NAMES[i]} +${v.toFixed(3)}` : null).filter(Boolean).join(', ') || 'inside';
for (const v of ['wide', 'left', 'right']) {
  const V = C.views[v];
  const worst = SIZES.map(s => camExcess(V.pos, V.look, pivot(s), s)).find(e => !insideLimits(e));
  ok(!worst, `the ${v} angle is inside every limit (every slime size)`, worst ? fmtE(worst) : '');
}
ok(C.views.right.pos[0] === -C.views.left.pos[0] && C.views.right.look[0] === -C.views.left.look[0] && C.views.right.pos[2] === C.views.left.pos[2], 'Right is Left mirrored');
const frontNotes = [];
for (const aspect of [393 / 852, 393 / 659, 16 / 9]) for (const s of SIZES) {
  const f = front(s, aspect), e = camExcess(f.pos, f.look, pivot(s), s);
  const others = e.filter((v, i) => i !== 3 && v > 1e-6);
  if (others.length) frontNotes.push(`aspect ${aspect.toFixed(2)} size ${s}: ${fmtE(e)}`);
  if (e[3] > 1e-6) frontNotes.push(`(front limit) aspect ${aspect.toFixed(2)} size ${s}: z ${f.pos[2].toFixed(2)}`);
}
ok(!frontNotes.some(n => !n.startsWith('(front limit)')), 'Front (unchanged) is inside the side, floor, roof, near and around limits', frontNotes.join('; '));
const pastFront = frontNotes.filter(n => n.startsWith('(front limit)'));
console.log(`     note: Front for a grown slime on a phone stands a little past the front limit (z ${L.zMax}); Front is today's camera and is not moved: ${pastFront.length ? pastFront.join('; ') : 'none'}`);
ok(pastFront.every(n => +n.split('z ')[1] <= L.zMax + 0.6), 'Front is never more than 0.6 past the front limit');
// roof check against the brief's formula
ok(near(roofY(0), 6.7) && near(roofY(3.95), 4.7) && near(roofY(2), 4.7 + 2 * 1.95 / 3.95), 'the roof: eaves 4.7, ridge 6.7');

// thousands of seeded drags and pinches from every set angle: never past a limit (a camera that starts past one, the
// Front camera of a big slime on a phone, never goes further out), and every move at most what the finger asked for
{
  const rnd = seeded(12345);
  let ops = 0, bad = 0, jumps = 0, slid = 0;
  const starts = [];
  for (const s of SIZES) {
    for (const aspect of [393 / 852, 16 / 9]) starts.push({ name: `front ${s}`, ...front(s, aspect), size: s });
    for (const v of ['wide', 'left', 'right']) starts.push({ name: `${v} ${s}`, ...C.views[v], size: s });
  }
  const firstBad = [];
  for (const st of starts) {
    for (let seq = 0; seq < 120; seq++) {
      const rig = new CamRig(), P = pivot(st.size);
      rig.begin(st.pos, st.look, st.fov, P, st.size);
      const start = camExcess(st.pos, st.look, P, st.size).map(v => Math.max(0, v));
      for (let k = 0; k < 40; k++) {
        const before = { ...rig.free };
        if (rnd() < 0.75) {
          const dx = (rnd() * 2 - 1) * 260, dy = (rnd() * 2 - 1) * 200;
          rig.turn(dx, dy, P);
          const dyaw = Math.abs(rig.free.yaw - before.yaw), dpitch = Math.abs(rig.free.pitch - before.pitch);
          if (dyaw > Math.abs(dx) * C.turn + 1e-9 || dpitch > Math.abs(dy) * C.tilt + 1e-9) jumps++;
          if (dyaw < Math.abs(dx) * C.turn - 1e-6 || dpitch < Math.abs(dy) * C.tilt - 1e-6) slid++;
        } else {
          const kk = Math.exp((rnd() * 2 - 1) * 0.7);
          rig.pinch(kk, P);
          const r = rig.free.dist / before.dist;
          if (r > 1 / C.pinch[0] + 1e-9 || r < 1 / C.pinch[1] - 1e-9 || Math.abs(Math.log(r)) > Math.abs(Math.log(Math.min(Math.max(kk, C.pinch[0]), C.pinch[1]))) + 1e-9) jumps++;
        }
        // a new drag now and then (begin again from where the camera is)
        if (rnd() < 0.1) rig.begin(...Object.values(rig.pose(P)).slice(0, 3), P, st.size);
        ops++;
        const p = rig.pose(P), e = camExcess(p.pos, p.look, P, st.size);
        if (!insideLimits(e, start)) { bad++; if (firstBad.length < 3) firstBad.push(`${st.name}: ${fmtE(e.map((v, i) => v - start[i]))}`); }
      }
    }
  }
  ok(bad === 0, `camera: ${ops} seeded drags and pinches from ${starts.length} starts (Front, Wide, Left, Right x sizes) never leave the limits`, firstBad.join('; '));
  ok(jumps === 0, `camera: no move is bigger than the finger asked for (${slid} moves stopped or slid at a limit)`);
  ok(slid > 0, 'camera: the limits were actually reached (moves slid along them)');
}

// ---------- 4. the one-time move to the Greenhouse ----------
const fixture = name => JSON.parse(fs.readFileSync(path.join(root, 'tools/fixtures', name), 'utf8')).save;
const roundTrip = s => JSON.parse(JSON.stringify(s));
{
  const fresh = createState();
  ok(fresh.settings.scene === 'greenhouse' && fresh.settings.sceneMoved === true && fresh.settings.camView === 'front', 'a new save starts in the Greenhouse (Front camera)');
  for (const name of fs.readdirSync(path.join(root, 'tools/fixtures')).filter(f => f.endsWith('.json')).sort()) {   // every old save
    const old = fixture(name);
    const meadow = roundTrip(old); meadow.settings.scene = 'meadow';
    const a = migrate(roundTrip(meadow));
    ok(a.settings.scene === 'greenhouse' && a.settings.sceneMoved === true, `${name} on the Meadow (the old default) moves to the Greenhouse`);
    const twice = migrate(roundTrip(a));
    ok(JSON.stringify(twice) === JSON.stringify(a), `${name}: running migrate twice changes nothing`);
    const classic = roundTrip(old); classic.settings.scene = 'classic';
    const c = migrate(classic);
    ok(c.settings.scene === 'classic' && migrate(roundTrip(c)).settings.scene === 'classic', `${name} on Classic stays Classic`);
    const none = migrate(roundTrip(old));
    ok(none.settings.scene === 'greenhouse', `${name} with no background saved moves to the Greenhouse`);
    const picked = roundTrip(a); picked.settings.scene = 'meadow';
    const kept = migrate(roundTrip(migrate(picked)));
    ok(kept.settings.scene === 'meadow', `${name}: picking the Meadow after the move keeps the Meadow`);
  }
}

console.log(`\n${checks - fails}/${checks} checks passed`);
if (fails) { console.log('FAILED'); process.exit(1); }
console.log('OK');
