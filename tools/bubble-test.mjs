// The travel bubble's plain math, in plain node (no browser): its size, the float path, the picture's edges, the room
// as the bubble sees it, and the pop rule for every set camera angle of the Greenhouse, the Meadow's open sky and
// cameras turned by hand anywhere inside the limits.
//   node tools/bubble-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';
import { SENDOFF as S, GREENHOUSE } from '../src/data/content.js';
import { bubbleSize, bubbleBottom, growAt, riseAt, floatAt, framePlanes, inPicture, clearance, greenhouseRoom, OPEN_SKY, sightLines, sightHit, seenMeeting, planFloat, popSwell, cameraMatrix, project } from '../src/view/bubble-math.js';
import { CamRig, camExcess, insideLimits, roomMeta } from '../src/view/greenhouse-math.js';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (cond, what, detail = '') => { if (cond) { pass++; console.log('ok  ', what, detail ? `(${detail})` : ''); } else { fail++; console.log('FAIL', what, detail); } };
// the room as the game completes it (gh.json + the terrarium's hutch, ferns and menu objects: roomMeta)
const readAsset = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/assets/greenhouse', f), 'utf8'));
const meta = roomMeta(readAsset('gh.json'), readAsset('tp_objects.json'));
const room = greenhouseRoom(meta, GREENHOUSE.roof);
const SLIME_Y = 0.27;
const PHONE = 393 / 852;

console.log('# 1. the timings');
ok(S.wave[0] < S.wave[1] && S.wave[1] <= S.grow[0] + 0.1, 'the wave is back in as the bubble starts', `wave ${S.wave.join('-')} s, bubble from ${S.grow[0]} s`);
ok(S.grow[0] + S.grow[1] <= S.lift, 'the bubble is whole before it lifts off', `${S.grow[0] + S.grow[1]} <= ${S.lift}`);
ok(S.lift < S.latest && S.latest < S.fade && S.fade < S.rule, 'lift-off < the latest pop < the white fade < the rule', `${S.lift} < ${S.latest} < ${S.fade} < ${S.rule}`);
ok(S.fade === 4.2 && S.rule === 5.3, 'the white fade and the rule at the same times as before (4.2 s, 5.3 s)');
ok(S.reduced.glow < S.reduced.fade[0] && S.reduced.fade[0] + S.reduced.fade[1] <= S.fade, 'Reduced motion: it glows, then has faded out before the white fade', `${S.reduced.fade[0] + S.reduced.fade[1]} <= ${S.fade}`);

console.log('# 2. the bubble holds the slime');
for (const [name, a, h] of [['a grown slime', 0.78, 1.25], ['a Sprout', 0.57, 0.91], ['a Hatchling', 0.45, 0.72], ['a tall one (ears, a hat)', 0.7, 1.7], ['a wide one', 1.0, 1.0]]) {
  const { r, lift } = bubbleSize(a, h);
  // the slime: an ellipse a by h/2 whose base sits `lift` above the bubble's bottom
  let worst = -Infinity;
  for (let i = 0; i < 360; i++) { const t = i / 360 * Math.PI * 2, x = a * Math.cos(t), y = -r + lift + h / 2 + (h / 2) * Math.sin(t); worst = Math.max(worst, Math.hypot(x, y) / r); }
  ok(worst <= 1 / S.pad + 1e-3, `${name}: inside the bubble with the same room to spare all round (pad ${S.pad})`, `r ${r.toFixed(3)}, the slime reaches ${(worst * 100).toFixed(1)}% of it, its base ${lift.toFixed(3)} over the bubble's bottom`);
}
{
  const a = bubbleSize(0.5, 0.8).r, b = bubbleSize(0.6, 0.96).r;
  ok(Math.abs(b / a - 1.2) < 0.01, 'a bigger slime gets a bubble bigger in step', `${a.toFixed(3)} -> ${b.toFixed(3)}`);
  const r = 0.9, inner = 0.6;
  let maxJump = 0, prev = growAt(0, r, inner), over = 0;
  for (let k = 1; k <= 1000; k++) { const v = growAt(k / 1000, r, inner); maxJump = Math.max(maxJump, Math.abs(v - prev)); over = Math.max(over, v); prev = v; }
  ok(Math.abs(growAt(0, r, inner) - inner) < 1e-9 && Math.abs(growAt(1, r, inner) - r) < 1e-9, 'growing: from inside the slime to its full size');
  ok(maxJump < 0.01 && over < r * 1.12, 'growing: smooth, with a soft overshoot (at most 12%)', `biggest step ${maxJump.toFixed(4)}, peak ${(over / r).toFixed(3)} x`);
}

console.log('# 3. the float');
{
  let prev = 0, maxV = 0, smooth = true;
  for (let i = 1; i <= 400; i++) { const t = i / 100, h = riseAt(t), v = (h - prev) * 100; if (v < -1e-9) smooth = false; maxV = Math.max(maxV, v); prev = h; }
  ok(riseAt(0) === 0 && smooth, 'it only ever rises, from the cushion');
  ok(maxV <= S.rise.top + 1e-6, `it eases in to at most ${S.rise.top} units a second`, `top ${maxV.toFixed(3)}`);
    let swayMax = 0;
  for (let i = 0; i <= 300; i++) { const t = i / 100, o = floatAt(t, { toward: [0, 1] }), h = riseAt(t); swayMax = Math.max(swayMax, Math.abs(o[0])); if (Math.abs(o[2] - S.toward * h) > 1e-9) smooth = false; }
  ok(swayMax <= S.sway.amp + 1e-9 && smooth, 'a gentle sway across the picture, and a little toward the camera as it rises', `sway at most ${swayMax.toFixed(3)}`);
  const b = floatAt(2, { toward: [0, 1], side: 1 }), g = floatAt(2, { toward: [0, 1] });
  ok(b[0] - g[0] > 0 && Math.abs(b[0] - g[0] - S.side * riseAt(2)) < 1e-9, 'a baby drifts a little toward its family\'s side (+x)', `${(b[0] - g[0]).toFixed(3)} after rising ${riseAt(2).toFixed(2)}`);
  const turned = floatAt(2, { toward: [0.6, 0.8] });
  ok(Math.abs(turned[0] / turned[2] - 0.6 / 0.8) < 0.2, 'toward a camera off to the side: it drifts toward that camera');
}

console.log('# 4. the picture');
{
  const cam = { pos: [0, 3.03, 13.6], look: [0, 1.09, 0], fov: 30, aspect: PHONE };
  const m = cameraMatrix(cam), P = framePlanes(m);
  ok(inPicture(P, cam.look, 0.01), 'the point the camera looks at is in the picture');
  const p = project(m, cam.look);
  ok(Math.abs(p[0]) < 1e-9 && Math.abs(p[1]) < 1e-9, 'it lands in the middle');
  ok(!inPicture(P, [0, 12, 0], 1) && inPicture(P, [0, 4.5, 0], 1), 'a bubble high over the stump is out; one at the top edge is still in');
  ok(!inPicture(P, [0, 2, 20], 0.5), 'behind the camera: out');
  const off = framePlanes(cameraMatrix({ ...cam, offY: 120 }));
  const top = y => inPicture(off, [0, y, 0], 0.5);
  let y0 = 0, y1 = 0; for (let y = 1; y < 12; y += 0.01) { if (inPicture(P, [0, y, 0], 0.5)) y0 = y; if (top(y)) y1 = y; }
  ok(y1 < y0, 'the view offset (the picture slid up above the menu) lowers the top edge', `${y0.toFixed(2)} -> ${y1.toFixed(2)}`);
  // against three.js itself, when it is here
  let THREE = null;
  try { THREE = createRequire(import.meta.url)('three'); } catch { /* not installed here */ }
  if (THREE) {
    let worst = 0;
    for (const c of [cam, { pos: [-3.4, 3.1, 7.6], look: [1.1, 1.3, -3], fov: 50, aspect: PHONE }, { pos: [0, 4.7, 9.6], look: [0, 1.3, -2.2], fov: 58, aspect: 1.6, offY: 90 }]) {
      const pc = new THREE.PerspectiveCamera(c.fov, c.aspect, 0.1, 120);
      if (c.offY) pc.setViewOffset(852 * c.aspect, 852, 0, c.offY, 852 * c.aspect, 852);
      pc.position.set(...c.pos); pc.lookAt(...c.look); pc.updateMatrixWorld(); pc.updateProjectionMatrix();
      const ref = new THREE.Matrix4().multiplyMatrices(pc.projectionMatrix, pc.matrixWorldInverse).elements, mine = cameraMatrix(c);
      worst = Math.max(worst, ...ref.map((v, i) => Math.abs(v - mine[i])));
    }
    ok(worst < 1e-9, 'the test cameras are three.js\'s own (projection x view, with the view offset)', `largest difference ${worst.toExponential(1)}`);
  } else console.log('     (three.js not found here: the matrix cross-check is skipped)');
}

console.log('# 5. the room as the bubble sees it');
{
  const R = GREENHOUSE.roof;
  const g0 = clearance([0, R.ridge - 1.2, 0], 1, room);
  ok(Math.abs(g0.gap - (1.2 / Math.hypot((R.ridge - R.eave) / R.half, 1) - 1)) < 1e-9 && g0.what === 'the roof', 'under the ridge: the gap to the roof (square to its slope)', `${g0.gap.toFixed(3)}`);
  const g1 = clearance([3, 2, 1], 0.5, room);
  ok(g1.what === 'the right wall' && Math.abs(g1.gap - (meta.room.x_in - 3.5)) < 1e-9, 'by a side wall: the gap to the wall', `${g1.gap.toFixed(3)}`);
  const L = meta.lantern, g2 = clearance([L[0], L[1] - 1.0, L[2]], 0.3, room);
  ok(g2.what === 'the lantern', 'under the hanging lantern: the lantern is the nearest', `${g2.gap.toFixed(3)}`);
  const g3 = clearance([0, 5, meta.room.z_side_end + 2], 1, room);
  ok(g3.gap > 1, 'past the front of the room the roof is not over it');
  const st = clearance([0, SLIME_Y + 1, 0], 0.9, room);
  ok(st.gap > S.gap.room, 'the stump it rises from is not an obstacle; on the stump it is clear of everything', `${st.gap.toFixed(2)} from ${st.what}`);
  ok(clearance([0, 3, 0], 1, OPEN_SKY).gap === Infinity, 'the open sky (Meadow, Classic): nothing over it');
}

console.log('# 6. what you can see of it');
{
  const V = GREENHOUSE.camera.views, wide = { ...V.wide, aspect: PHONE }, Pw = framePlanes(cameraMatrix(wide));
  const lines = sightLines(Pw, wide.pos, [0, 3, 0], 1);
  ok(lines.length === 51, 'a bubble in the middle of the picture: every line of sight through it is in the picture (51)', String(lines.length));
  const hit = sightHit(room, wide.pos, lines[0]);
  ok(hit.what === 'the back glass' && hit.t > Math.hypot(...wide.pos.map((v, i) => v - [0, 3, 0][i])), 'the line of sight to its middle meets the back glass, far behind it');
  ok(seenMeeting(Pw, wide.pos, [0, 3, 0], 1, room) === null, 'Wide, a bubble in the middle of the room: seen clear of everything');
  ok(seenMeeting(Pw, wide.pos, [0, 5.8, 0], 1, room) === 'the roof', 'Wide (the roof in the picture), a bubble up under the ridge: seen meeting the roof');
  const sl = 1.04, fr = { pos: [0, 2.25 + sl * 0.75, (7.6 + sl * 2.4) * (1 + (0.9 - PHONE) * 0.8)], look: [0, 0.3 + 0.35 + sl * 0.42, 0], fov: 30, aspect: PHONE }, Pf = framePlanes(cameraMatrix(fr));
  const c = [0, 5.75, 0.5];
  ok(inPicture(Pf, c, 1.4) && clearance(c, 1.4, room).gap < 0 && seenMeeting(Pf, fr.pos, c, 1.4, room) === null,
    'Front (the home camera: the roof is never in its picture), a bubble poking up past the roof\'s height: only its bottom is in the picture, and that is clear', `gap to the roof ${clearance(c, 1.4, room).gap.toFixed(2)}`);
  const L = meta.lantern, eye = [L[0] + 0.3, L[1] - 0.2, L[2] + 6], P2 = framePlanes(cameraMatrix({ pos: eye, look: L, fov: 50, aspect: PHONE }));
  ok(seenMeeting(P2, eye, [L[0], L[1], L[2] - 1.5], 0.5, room) === 'the lantern', 'something between the camera and the bubble (the lantern in front of it) counts too');
  const post = { planes: [], balls: [], posts: [{ x: 0, z: 0, r: 0.5, top: 1, what: 'a post' }] };
  ok(sightHit(post, [0, 0.5, 5], [0, 0, -1]).t === 4.5 && sightHit(post, [0, 2, 5], [0, 0, -1]).t === Infinity && Math.abs(sightHit(post, [0, 3, 0.2], [0, -1, 0]).t - 2) < 1e-9, 'an upright post: met from the side, missed over its top, met through its top');
}

console.log('# 7. the rule, for each camera');
const front = (size, aspect) => { const boost = aspect < 0.9 ? Math.min(1.5, 1 + (0.9 - aspect) * 0.8) : 1; return { pos: [0, 2.25 + size * 0.75, (7.6 + size * 2.4) * boost], look: [0, 0.3 + 0.35 + size * 0.42, 0], fov: 30 }; };
const V = GREENHOUSE.camera.views;
// the slimes as the game measures them (send-off-smoke: a grown Pebble, a Sprout)
const SLIMES = { grown: { size: 1.04, a: 1.24, h: 1.85 }, baby: { size: 0.84, a: 0.89, h: 1.49 } };
// the whole float at a frame rate (dt), then every frame it is drawn checked again far more finely (21 rings of 48 lines
// of sight): it is never seen within half the gap of the room (the rule itself keeps the whole gap with 51 lines), and
// never within SENDOFF.gap.camera of the camera
const DENSE = Array.from({ length: 21 }, (_, i) => [i / 20 * 0.999, i ? 48 : 1]);
function walk(cam, kind, rm, dt = 1 / 60) {
  const sl = SLIMES[kind], { r } = bubbleSize(sl.a, sl.h), m = cameraMatrix(cam), P = framePlanes(m);
  const start = [0, bubbleBottom(SLIME_Y, r) + r, 0], tw = [cam.pos[0], cam.pos[2] - 0], l = Math.hypot(...tw), o = { toward: [tw[0] / l, tw[1] / l], side: kind === 'baby' ? 1 : 0 };
  const plan = planFloat(P, cam.pos, start, r, rm, o, S, dt);
  let seen = null, camGap = Infinity, frames = 0;
  const look = c => {
    if (!inPicture(P, c, r)) return;
    frames++;
    camGap = Math.min(camGap, Math.hypot(c[0] - cam.pos[0], c[1] - cam.pos[1], c[2] - cam.pos[2]) - r);
    const R = r + S.gap.room / 2, lines = sightLines(P, cam.pos, c, R, DENSE) || [];
    for (const dir of lines) {
      const oc = cam.pos.map((v, i) => v - c[i]), bq = oc[0] * dir[0] + oc[1] * dir[1] + oc[2] * dir[2], cq = oc[0] ** 2 + oc[1] ** 2 + oc[2] ** 2 - R * R, disc = bq * bq - cq;
      if (disc < 0) continue;
      const h = sightHit(rm, cam.pos, dir);
      if (h.t < -bq + Math.sqrt(disc) && !seen) seen = { what: h.what, c };
    }
  };
  for (let t = 0; t < plan.t - 1e-9; t += dt) { const f = floatAt(t, o); look([start[0] + f[0], start[1] + f[1], start[2] + f[2]]); }
  if (plan.step === 'pop') look(plan.c);   // the pop frame, where it pops
  // (a camera pinched in so close that the whole bubble is already within the gap at lift-off: it pops right there)
  const atLift = Math.hypot(...start.map((v, i) => v - cam.pos[i])) - r;
  return { plan, seen, camGap: atLift < FLOOR && plan.t === 0 ? FLOOR : camGap, frames, r, atLift };
}
const FLOOR = S.gap.camera;
for (const kind of ['grown', 'baby']) {
  const sl = SLIMES[kind];
  const cams = { 'Front (phone)': { ...front(sl.size, PHONE), aspect: PHONE }, 'Front (computer)': { ...front(sl.size, 1.6), aspect: 1.6 }, Wide: { ...V.wide, aspect: PHONE }, Left: { ...V.left, aspect: PHONE }, Right: { ...V.right, aspect: PHONE } };
  for (const [name, cam] of Object.entries(cams)) {
    for (const dt of [1 / 30, 1 / 20]) { const w2 = walk(cam, kind, room, dt); ok(!w2.seen && w2.camGap >= FLOOR, `Greenhouse, ${name}, ${kind}, at ${Math.round(1 / dt)} frames a second: never seen meeting the room`, w2.seen ? JSON.stringify(w2.seen) : ''); }
    const w = walk(cam, kind, room);
    const what = w.plan.step === 'out' ? `floats out of the picture at ${(w.plan.t + S.lift).toFixed(2)} s` : `pops at ${(w.plan.t + S.lift).toFixed(2)} s before ${w.plan.why}`;
    ok(!w.seen && w.camGap >= FLOOR && w.plan.t + S.lift <= S.latest + 1e-9, `Greenhouse, ${name}, ${kind}: ${what}; never seen meeting the room (${w.frames} frames)`, w.seen ? JSON.stringify(w.seen) : '');
    if (name.startsWith('Front')) ok(w.plan.step === 'out', `Greenhouse, ${name}, ${kind}: the home camera sees it float all the way out`);
  }
  const m = walk({ ...front(sl.size, PHONE), aspect: PHONE }, kind, OPEN_SKY);
  ok(m.plan.step === 'out' && m.plan.t + S.lift < S.latest, `Meadow / Classic (open sky), ${kind}: it floats up and out of the picture`, `at ${(m.plan.t + S.lift).toFixed(2)} s`);
}
for (const r of [0.6, 1, 1.5]) { const b = bubbleBottom(SLIME_Y, r); ok(b - S.wobble * r >= SLIME_Y + 0.03 + S.gap.cushion - 1e-12, `a bubble of radius ${r}: even at the bottom of its wobble it stays ${S.gap.cushion} over the cushion's top (${(SLIME_Y + 0.03).toFixed(2)})`, `bottom ${b.toFixed(3)}`); }
ok(popSwell(1.5) * 1.5 <= S.gap.room - S.wobble * 1.5 - S.gap.cushion + 1e-12 && popSwell(0.3) * 0.3 <= S.popSwell * 0.3 + 1e-12, 'a pop swells by at most the gap it kept (less a sliver), so the swell is never seen meeting anything');
{
  // cameras turned by hand anywhere the Greenhouse allows (seeded), and pinched in and out
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let n = 0, pops = 0, outs = 0, bad = 0, first = '';
  const pivot = [0, 0.3 + 0.35 + 0.42 * 1.04, 0];
  for (let k = 0; k < 80; k++) {
    const rig = new CamRig();
    const start = k % 2 ? V.wide : V.left;
    rig.begin(start.pos, start.look, start.fov, pivot, 1.04);
    for (let i = 0; i < 12; i++) { rig.turn((rnd() - 0.5) * 400, (rnd() - 0.5) * 300, pivot); rig.pinch(0.5 + rnd() * 1.5, pivot); }
    const p = rig.pose(pivot);
    if (!insideLimits(camExcess(p.pos, p.look, pivot, 1.04), rig.slack)) continue;
    for (const kind of ['grown', 'baby']) {
      const w = walk({ pos: p.pos, look: p.look, fov: p.fov, aspect: PHONE }, kind, room, k % 3 === 0 ? 1 / 20 : 1 / 30);
      n++; if (w.plan.step === 'out') outs++; else pops++;
      if (w.seen || w.camGap < FLOOR || w.plan.t + S.lift > S.latest + 1e-9) { bad++; if (!first) first = JSON.stringify({ pos: p.pos.map(v => +v.toFixed(2)), kind, seen: w.seen }); }
    }
  }
  ok(n > 100 && bad === 0, `${n} cameras turned and pinched by hand: in every one it floats out or pops first, never seen meeting the room (some at 20 fps)`, `${outs} float out, ${pops} pop${first ? '; ' + first : ''}`);
}

console.log(`\n${pass}/${pass + fail} checks passed`);
console.log(fail ? 'FAILED' : 'OK');
process.exit(fail ? 1 : 0);
