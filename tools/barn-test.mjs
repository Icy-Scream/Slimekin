// The Barn ranch, plain node (no browser): the barn's files, the burrow swap's pose curve, who is on the stand (the
// order, wrapping around, travelers left out), the swipe, the name card's line, the framing, and the nest's and the
// basket's spots.
//   node tools/barn-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { BARN, RANCH_LIFE } from '../src/data/content.js';
import { poseAt, springAt, clipOn, fadeAt, standOrder, stepId, startId, nextAfterGone, swipeDir, pastSwipe, bestSkill, cardLine, cardCount, fitView, fovFor, basketSpot, spotProblems } from '../src/view/barn-math.js';
import { createState, migrate } from '../src/core/sim.js';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(root, 'src/assets/barn');
let fails = 0, checks = 0;
const ok = (cond, what, detail = '') => { checks++; if (cond) console.log('ok  ', what); else { fails++; console.log('FAIL', what, detail); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// ---------- 1. the barn's files (format 2, the same as the Greenhouse room) ----------
console.log('# 1. the barn\'s files');
const meta = JSON.parse(fs.readFileSync(path.join(ASSETS, 'barn.json'), 'utf8'));
const bin = fs.readFileSync(path.join(ASSETS, 'barn.bin'));
const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
ok(meta.format === 2, 'barn.json is format 2');
const inFile = Object.entries(meta.chunks).filter(([, [o, n]]) => !(o >= 0 && n > 0 && o + n <= bin.length));
ok(!inFile.length, `every chunk lies inside barn.bin (${Object.keys(meta.chunks).length} chunks, ${bin.length} bytes)`, inFile.map(c => c[0]).join(', '));
const ends = Object.values(meta.chunks).map(([o, n]) => o + n).sort((a, b) => b - a)[0];
ok(ends === bin.length, 'the chunks fill barn.bin to its end', `${ends} vs ${bin.length}`);
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
const R = meta.room;
ok(Array.isArray(meta.cam.pos) && Array.isArray(meta.cam.look) && meta.cam.fov > 0, `barn.json has the camera (pos ${meta.cam.pos}, look ${meta.cam.look}, fov ${meta.cam.fov})`);
ok(R && R.stand_top > 0 && R.stand_r > 0 && R.aisle_half > R.stand_r && R.z_front > 0 && R.z_end < 0, `barn.json has the room (stand top ${R.stand_top}, stand radius ${R.stand_r}, aisle half ${R.aisle_half})`);
ok(meta.lanterns.length >= 1 && meta.bulbs.length > 10 && meta.pearls.length > 10, `the glow spots: ${meta.lanterns.length} lanterns, ${meta.bulbs.length} bulbs, ${meta.pearls.length} basket pearls`);
for (const k of ['day', 'night']) {
  const L = meta.slime_light[k];
  ok(L && L.hemi.length === 3 && L.key.length === 2 && L.rim.length === 2 && L.env > 0 && meta.sky[k].length >= 2 && meta.fog[k].length === 4, `the slime's light, the sky and the fog by ${k}`);
}
const bytes = fs.readdirSync(ASSETS).reduce((s, f) => s + fs.statSync(path.join(ASSETS, f)).size, 0);
console.log(`     the barn: ${tris} triangles in ${meshes.length} meshes, ${(bytes / 1e6).toFixed(2)} MB on disk`);

// ---------- 2. BARN's numbers ----------
console.log('# 2. BARN in content.js');
const S = BARN.swap;
ok(S.wiggle < S.sink && S.sink < S.under && S.under < S.rise && S.rise < S.land, `the swap's parts in order (${S.wiggle}, ${S.sink}, ${S.under}, ${S.rise}, ${S.land} s)`);
ok(Math.abs(S.land - 0.68) < 1e-9 && S.land < 0.8, `the swap takes ${S.land} s (about 0.7 s, the test page's)`);
for (const q of ['high', 'low']) { const k = BARN.straw[q]; ok(k.burst1 + k.burst2 <= k.strips, `${q}: the two poofs (${k.burst1} + ${k.burst2}) fit in the straw (${k.strips} strips)`); }
ok(BARN.straw.low.strips < BARN.straw.high.strips, 'Low draws fewer straw strips', `${BARN.straw.low.strips} vs ${BARN.straw.high.strips}`);
ok(BARN.swipe.minPx === 60 && BARN.swipe.maxMs === 700, 'a swipe: more than 60 px in under 0.7 s (the brief\'s numbers)');

// ---------- 3. the burrow swap's pose curve ----------
console.log('# 3. the pose curve');
const y0 = R.stand_top, dt = 1e-4;
const rest = poseAt(0, y0);
ok(rest[0] && near(rest[1], y0) && near(rest[2], 1) && near(rest[3], 0), 'it starts at rest on the stand (visible, y = stand top, stretch 1, no lean)', JSON.stringify(rest));
let worst = 0, hiddenFrom = null, hiddenTo = null, belowNoClip = [], worstAt = 0;
for (let u = 0; u < S.land; u += dt) {
  const a = poseAt(u, y0), b = poseAt(u + dt, y0);
  if (!a[0] && hiddenFrom === null) hiddenFrom = u;
  if (a[0] && hiddenFrom !== null && hiddenTo === null) hiddenTo = u;
  if (a[0] && a[1] < y0 - 1e-9 && !clipOn(u)) belowNoClip.push(+u.toFixed(4));
  if (b && a[0] && b[0]) { const j = Math.max(Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]), Math.abs(a[3] - b[3]) / 90); if (j > worst) { worst = j; worstAt = u; } }
}
ok(worst < 0.01, `continuous while it shows: the biggest change in ${dt} s is ${worst.toFixed(5)} (at ${worstAt.toFixed(3)} s)`);
ok(near(hiddenFrom, S.sink, 2 * dt) && near(hiddenTo, S.under, 2 * dt), `hidden only from ${hiddenFrom.toFixed(3)} to ${hiddenTo.toFixed(3)} s (under the straw)`);
ok(S.burst1 <= hiddenFrom && hiddenTo <= S.burst1 + BARN.dust, `the straw poof (at ${S.burst1} s, its dust lives ${BARN.dust} s) covers the whole time it is hidden`);
ok(S.wear > hiddenFrom && S.wear < hiddenTo, `the next resident is put on while it is hidden (${S.wear} s)`);
ok(!belowNoClip.length, 'whenever it is below the stand\'s top, the clip plane is on (it sinks INTO the nest)', belowNoClip.slice(0, 5).join(', '));
ok(poseAt(S.land, y0) === null && poseAt(S.land + 0.3, y0) === null, `after ${S.land} s the pose is over (the landing spring runs)`);
const last = poseAt(S.land - 1e-6, y0);
ok(near(last[1], y0, 1e-4) && near(last[2], 1, 1e-4), `it lands on the stand at full height (y ${last[1].toFixed(4)}, stretch ${last[2].toFixed(4)})`);
ok(near(springAt(0), 1 - S.spring.squash), `the landing spring starts with the landing squash (${springAt(0).toFixed(2)})`);
let sj = 0; for (let v = 0; v < S.spring.length; v += dt) sj = Math.max(sj, Math.abs(springAt(v + dt) - springAt(v)));
ok(sj < 0.01, `the spring is smooth (biggest change in ${dt} s: ${sj.toFixed(5)})`);
let settle = 0; for (let v = 0; v < S.spring.length; v += 0.001) if (Math.abs(springAt(v) - 1) > 0.002) settle = v;
ok(settle < S.spring.length && springAt(S.spring.length) === 1 && springAt(5) === 1, `back at rest: within 0.2% of rest after ${settle.toFixed(2)} s, exactly at rest after ${S.spring.length} s`);
ok(near(fadeAt(0), 1) && near(fadeAt(S.fade / 2), 0) && near(fadeAt(S.fade), 1) && fadeAt(S.fade + 1) === 1, `Reduced motion: the fade goes 1 -> 0 (the next one put on) -> 1 in ${S.fade} s`);

// ---------- 4. who is on the stand ----------
console.log('# 4. the order');
const res = [{ id: 'a' }, { id: 'b', trip: { place: 'cafe' } }, { id: 'c' }, { id: 'd' }];
const order = standOrder(res);
ok(order.join() === 'a,c,d', 'the ranch\'s own order, the traveler left out', order.join());
ok(stepId(order, 'a', 1) === 'c' && stepId(order, 'd', 1) === 'a', 'next wraps around (d -> a)');
ok(stepId(order, 'a', -1) === 'd' && stepId(order, 'c', -1) === 'a', 'previous wraps around (a -> d)');
ok(stepId(order, 'b', 1) === 'a' && stepId(order, 'b', -1) === 'd' && stepId([], 'a', 1) === null, 'from someone not on the list: the first (next) or the last (previous); nobody: null');
ok(stepId(['a'], 'a', 1) === 'a', 'one resident: it stays');
ok(startId(order, 'd', 'c') === 'd' && startId(order, null, 'c') === 'c' && startId(order, 'b', 'zz') === 'a' && startId([], 'a', 'b') === null, 'opening: the one asked for, else the one seen last, else the first (a traveler asked for: the first)');
ok(nextAfterGone(['a', 'c', 'd'], ['a', 'd'], 'c') === 'd' && nextAfterGone(['a', 'c', 'd'], ['a', 'c'], 'd') === 'a' && nextAfterGone(['a'], [], 'a') === null, 'the one on the stand leaves: the next one after it comes up (wrapping); nobody left: null');
ok(nextAfterGone(['a', 'c', 'd', 'e'], ['a', 'e'], 'c') === 'e', 'two left at once: the next one still here');
const withNew = standOrder([...res.map(x => (x.id === 'b' ? { id: 'b' } : x))]);
ok(withNew.join() === 'a,b,c,d', 'a traveler coming home joins the order in its place', withNew.join());

// ---------- 5. the swipe and petting ----------
console.log('# 5. the swipe');
ok(swipeDir(-80, 10, 300) === 1 && swipeDir(80, -10, 300) === -1, 'swipe left = next, swipe right = previous');
ok(swipeDir(-55, 0, 200) === 0 && swipeDir(-80, 60, 300) === 0 && swipeDir(-80, 10, 750) === 0, 'not a swipe: 60 px or less, not mostly sideways, or slower than 0.7 s');
const P0 = { x0: 100, y0: 300, x: 100, y: 300, minX: 100, maxX: 100, t0: 0 };
ok(!pastSwipe({ ...P0, x: 60, minX: 60 }, 200), 'a press going one way sideways might still be a swipe (no petting yet)');
ok(pastSwipe({ ...P0, x: 112, minX: 80, maxX: 112 }, 200), 'a press that turned back sideways is a stroke (it pets)');
ok(pastSwipe({ ...P0, x: 110, y: 340, maxX: 110 }, 200), 'a press going mostly up or down is a stroke (it pets)');
ok(pastSwipe({ ...P0 }, 700) && !pastSwipe({ ...P0 }, 699), 'a press longer than a swipe can be pets');

// ---------- 6. the name card ----------
console.log('# 6. the name card');
const now = 1.8e12;
const curly = { id: 'a', name: 'Mochi', breed: 'curly', mix: 0, variant: 'plain', skills: { bounce: 0, speed: 0, sturdy: 0, smarts: 0, charm: 0 } };
const c1 = cardLine(curly, { now, perHour: 4.2 });
ok(c1.breed === 'Curly' && c1.line === '4.2 pearls an hour', 'no stars yet: the pearls it makes an hour', JSON.stringify(c1));
ok(cardLine(curly, { now, perHour: 12.4 }).line === '12 pearls an hour' && cardLine(curly, { now, perHour: 4 }).line === '4 pearls an hour', 'whole numbers from 10 on, no ".0"');
const dollop = { ...curly, breed: 'dollop', mix: 1, skills: { bounce: 2, speed: 0, sturdy: 3, smarts: 0, charm: 3 } };
const c2 = cardLine(dollop, { now, perHour: 4 });
ok(c2.breed === 'Dollop' && c2.line === 'Sturdy ★★★', 'with stars: its best skill and its stars (a tie goes to the Training Center\'s order)', JSON.stringify(c2));
ok(bestSkill(curly) === null && bestSkill(dollop).id === 'sturdy', 'best skill: none without stars');
const lesson = { ...dollop, lesson: { skill: 'bounce', star: 3, startAt: now - 1000, doneAt: now + 2 * 3600 * 1000 } };
ok(cardLine(lesson, { now }).line === 'in a lesson: Bounce, 2h left', 'in a lesson: the skill and the time left', cardLine(lesson, { now }).line);
const back = { place: 'cafe', at: now - 60000 };
ok(cardLine(dollop, { now, back }).line === `just back from ${RANCH_LIFE.places.find(p => p.id === 'cafe').name}`, 'just back from a trip', cardLine(dollop, { now, back }).line);
ok(cardLine(dollop, { now: now + BARN.justBack * 1000, back }).line === 'Sturdy ★★★', `after ${BARN.justBack / 60} min it is its skills again`);
ok(cardLine({ ...lesson }, { now, back }).line.startsWith('in a lesson'), 'a lesson goes before "just back"');
const names = [[{ breed: 'dollop', mix: 1, variant: 'ears' }, 'Cat-ear Dollop'], [{ breed: 'dollop', mix: 1, variant: 'topknot' }, 'Topknot Dollop'], [{ breed: 'mixed', mix: 0.4, variant: 'plain' }, 'Curly × Dollop'], [{ name: 'Old' }, 'Curly']];
for (const [b, n] of names) ok(cardLine({ ...b, skills: {} }, { now }).breed === n, `the body's own name: ${n}`);
ok(JSON.stringify(cardCount(6, 2)) === JSON.stringify({ dots: 6, on: 2, text: '' }) && cardCount(8, 7).dots === 8, `dots for up to ${BARN.dots} residents`);
ok(cardCount(12, 2).dots === 0 && cardCount(12, 2).text === '3 of 12', '"3 of 12" beyond that');

// ---------- 7. the nest and the basket ----------
console.log('# 7. the nest and the basket');
const basket = basketSpot(meta.pearls);
ok(!spotProblems(basket, R).length, `the baked basket's pearls (x ${basket.x.toFixed(2)}, z ${basket.z.toFixed(2)}, r ${basket.r.toFixed(2)}) are inside the aisle and clear of the stand`, spotProblems(basket, R).join(', '));
const nest = { ...BARN.nest, name: 'the nest' };
ok(near(nest.x, -basket.x, 0.02) && near(nest.z, basket.z, 0.02), `the nest is the basket's spot mirrored (x ${nest.x}, z ${nest.z})`);
ok(!spotProblems(nest, R, [{ ...basket, name: 'the basket' }]).length, `the nest (r ${nest.r}) is inside the aisle, clear of the stand and of the basket`, spotProblems(nest, R, [{ ...basket, name: 'the basket' }]).join(', '));
ok(spotProblems({ x: 0, z: 0.5, r: 0.3 }, R).includes('on the stand') && spotProblems({ x: 1.9, z: 1, r: 0.3 }, R).includes('outside the aisle'), 'the spot check catches a spot on the stand and one outside the aisle');
const ring = BARN.pearlRing, slimeBase = 0.97;   // the slime's base radius on the stand at BARN.size (measured on screen: 0.97)
ok(ring.r[0] - 0.1 > slimeBase - 0.1 && ring.r[1] + 0.1 <= R.stand_r + 0.05 && ring.arc < 90, `pearls land in the stand's straw ring in front of the slime (${ring.r.join(' to ')} from its middle, ${ring.arc} degrees either side)`);

// ---------- 8. framing ----------
console.log('# 8. framing');
const h = 852;
const f1 = fitView(-0.1, -0.6, h, 110, 700);
ok(f1.scale === 1 && near(f1.off, 0), 'it fits as it is: the barn camera as baked (no slide, no wider lens)', JSON.stringify(f1));
const f2 = fitView(-0.1, -0.6, h, 110, 600);
ok(f2.scale === 1 && near(h / 2 * (1 + 0.6) - f2.off, 600), 'the card is higher: it only slides up as far as it must', JSON.stringify(f2));
const f3 = fitView(0.2, -0.6, h, 110, 380);
const t3 = h / 2 * (1 - 0.2 * f3.scale) - f3.off, b3 = h / 2 * (1 + 0.6 * f3.scale) - f3.off;
ok(f3.scale < 1 && near(t3, 110, 1e-6) && near(b3, 380, 1e-6), `the menu sheet is open: a wider lens (scale ${f3.scale.toFixed(3)}) and a slide fit it between ${t3.toFixed(0)} and ${b3.toFixed(0)} px`);
ok(near(fovFor(38, 1), 38) && fovFor(38, 0.8) > 38 && near(Math.tan(fovFor(38, 0.5) * Math.PI / 360), 2 * Math.tan(38 * Math.PI / 360), 1e-9), 'the wider lens shows exactly 1 / scale as much');

// ---------- 9. saves ----------
console.log('# 9. saves');
const fresh = JSON.stringify(createState());
ok(!/barn/i.test(fresh), 'a new save has nothing of the barn in it (it adds no save fields)');
const fixtures = fs.readdirSync(path.join(root, 'tools/fixtures')).filter(f => f.endsWith('.json'));
for (const f of fixtures) {
  const s = JSON.parse(fs.readFileSync(path.join(root, 'tools/fixtures', f), 'utf8')).save;
  const m = migrate(JSON.parse(JSON.stringify(s)));
  ok(!/barn/i.test(JSON.stringify(m)) || /barn/i.test(JSON.stringify(s)), `${f}: migrating adds nothing of the barn`);
}

console.log(`\n${checks - fails}/${checks} checks passed`);
console.log(fails ? 'FAILED' : 'OK');
process.exit(fails ? 1 : 0);
