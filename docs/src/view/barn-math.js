// The Barn ranch's plain math (no three.js, no DOM, so node tests run it; tools/barn-test.mjs): the burrow swap's pose
// curve and landing spring, which resident is on the stand next (the ranch's order, travelers left out, wrapping
// around), the swipe, the name card's words, fitting the stand between the top bar and the card, and the checks on the
// nest's and the basket's spots. All numbers are BARN in content.js.
import { BARN, SKILL_IDS, SKILL_BY_ID, PLACE_BY_ID } from '../data/content.js';
import { fmtDuration } from '../core/format.js';
import { bodyName } from '../core/recipe.js';
import { revealLine, maxStars } from '../core/talents.js';

const easeOut = p => 1 - (1 - p) * (1 - p);

// ---------- the burrow swap ----------
// The slime's pose u seconds into the swap: [visible, y, stretch, lean in degrees] (y0: the stand's top, where it
// sits), or null once it has landed (then the landing spring runs). It wiggles, sinks into the nest (taller as it
// goes), waits hidden under the straw (the next resident is put on), pops up past the stand and drops back onto it.
export function poseAt(u, y0, s = BARN.swap) {
  if (u < s.wiggle) return [true, y0, 1 - s.wiggleSquash * Math.sin(Math.PI * u / s.wiggle), s.wiggleDeg * Math.sin(2 * Math.PI * u / s.wiggleEvery)];
  if (u < s.sink) { const p = (u - s.wiggle) / (s.sink - s.wiggle); return [true, y0 - s.depth * p * p, 1 + s.stretch.sink * p, 0]; }
  if (u < s.under) return [false, y0 - s.hide, s.stretch.under, 0];
  if (u < s.rise) { const p = (u - s.under) / (s.rise - s.under); return [true, y0 - s.hide + (s.hide + s.over) * easeOut(p), s.stretch.under - s.stretch.rise * p, 0]; }
  if (u < s.land) {
    const p = (u - s.rise) / (s.land - s.rise), top = s.stretch.under - s.stretch.rise;
    return [true, y0 + s.over * (1 - p * p), top - s.stretch.land * p, 0];
  }
  return null;
}
// The landing spring v seconds after it lands: the stretch (1 = at rest). It starts with the landing squash.
export function springAt(v, k = BARN.swap.spring) {
  return v >= 0 && v < k.length ? 1 - k.squash * Math.exp(-v / k.decay) * Math.cos(2 * Math.PI * v / k.period) : 1;
}
// The clip plane (it sinks INTO the nest, not through the stand) is on between these.
export const clipOn = (u, s = BARN.swap) => u > s.clip[0] && u < s.clip[1];
// Reduced motion: the slime's opacity t seconds into the fade (out, the next one put on at the middle, in).
export function fadeAt(t, len = BARN.swap.fade) {
  if (t >= len) return 1;
  const h = len / 2;
  return t < h ? 1 - t / h : (t - h) / h;
}

// ---------- who is on the stand ----------
// The residents that can be on the stand, in the ranch's own order (the Ranch tab's list): travelers are away.
export const standOrder = residents => (residents || []).filter(x => x && !x.trip).map(x => x.id);
// One step along the order (dir +1 next, -1 previous), wrapping around. An id not in the order steps to the first
// (next) or the last (previous) one.
export function stepId(order, id, dir) {
  const n = order.length;
  if (!n) return null;
  const i = order.indexOf(id);
  if (i < 0) return dir < 0 ? order[n - 1] : order[0];
  return order[((i + dir) % n + n) % n];
}
// Who comes up when the barn opens: the resident asked for (a visit from the menu), else the one seen last, else the
// first; null when nobody is home.
export function startId(order, asked, last) {
  if (asked && order.includes(asked)) return asked;
  if (last && order.includes(last)) return last;
  return order[0] ?? null;
}
// The one on the stand left (a new home, an auction, a trip): who comes up is the next one that was after it in the
// old order and is still here (wrapping around); null when nobody is left.
export function nextAfterGone(oldOrder, order, goneId) {
  if (!order.length) return null;
  const i = oldOrder.indexOf(goneId);
  if (i < 0) return order[0];
  for (let k = 1; k <= oldOrder.length; k++) {
    const id = oldOrder[(i + k) % oldOrder.length];
    if (order.includes(id)) return id;
  }
  return order[0];
}

// ---------- the swipe ----------
// A quick sideways swipe: +1 = next (swiped left, like turning a page), -1 = previous, 0 = not a swipe.
export function swipeDir(dx, dy, ms, w = BARN.swipe) {
  if (Math.abs(dx) > w.minPx && Math.abs(dx) > Math.abs(dy) * w.ratio && ms < w.maxMs) return dx < 0 ? 1 : -1;
  return 0;
}
// A press on the slime pets only once it can no longer be a quick sideways swipe: it lasted longer than a swipe may,
// turned back sideways (a stroke goes back and forth), or went mostly up or down.
// p: { x0, y0, x, y, minX, maxX, t0 } (pixels, ms)
export function pastSwipe(p, nowMs, w = BARN.swipe) {
  if (nowMs - p.t0 >= w.maxMs) return true;
  const dx = p.x - p.x0, dy = p.y - p.y0;
  if ((p.maxX - p.x0 > w.turnPx && p.maxX - p.x > w.turnPx) || (p.x0 - p.minX > w.turnPx && p.x - p.minX > w.turnPx)) return true;
  return Math.abs(dy) > w.upPx && Math.abs(dy) > Math.abs(dx);
}

// ---------- the name card ----------
const stars = (x, id) => Math.max(0, Math.min(maxStars(), Math.round(x?.skills?.[id] || 0)));
// Its best skill: the most stars (the first in the Training Center's order on a tie), or null with no stars yet.
export function bestSkill(x) {
  let best = null;
  for (const id of SKILL_IDS) if (stars(x, id) > (best ? best.stars : 0)) best = { id, name: SKILL_BY_ID[id].name, stars: stars(x, id) };
  return best;
}
// The card's line for a resident: its body's name (Curly, Dollop, Cat-ear Dollop, Topknot Dollop, Curly × Dollop)
// and one short line from real data: in a lesson (time left), just back from a trip, its best skill and stars, or
// the pearls it makes an hour. now: ms; back: { place, at } of its last trip home (this session); perHour: pearls.
// talent: the best talent its lessons have shown so far, in words (core/talents.js revealLine), or ''.
export function cardLine(x, { now = Date.now(), back = null, perHour = 0 } = {}) {
  const breed = bodyName(x);
  let line;
  if (x.lesson && SKILL_BY_ID[x.lesson.skill]) line = `in a lesson: ${SKILL_BY_ID[x.lesson.skill].name}, ${fmtDuration(Math.max(0, (x.lesson.doneAt - now) / 1000))} left`;
  else if (back && PLACE_BY_ID[back.place] && now - back.at < BARN.justBack * 1000) line = `just back from ${PLACE_BY_ID[back.place].name}`;
  else {
    const b = bestSkill(x);
    if (b) line = `${b.name} ${'★'.repeat(b.stars)}`;
    else line = perHour > 0 ? `${perHour < 10 ? perHour.toFixed(1).replace(/\.0$/, '') : Math.round(perHour)} pearls an hour` : 'resting';
  }
  return { breed, line, talent: revealLine(x) };
}
// Dots for up to BARN.dots residents, else "3 of 12".
export function cardCount(n, i, max = BARN.dots) {
  return n <= max ? { dots: n, on: i, text: '' } : { dots: 0, on: i, text: `${i + 1} of ${n}` };
}

// ---------- framing ----------
// Fit the stand (its region on screen spans ndc nt..nb in the barn camera, top > bottom) into the band of the screen
// between the top bar and the name card (pixels from the top, a < b) on a screen h pixels tall. Returns the scale of
// the picture (1 = the barn camera as baked; under 1 = a wider lens) and how far to slide it up (pixels, the camera's
// view offset). When it fits as it is, it only slides as far as it must (0 when it already fits).
export function fitView(nt, nb, h, a, b) {
  const span = h / 2 * (nt - nb);
  const scale = span > 0 ? Math.min(1, (b - a) / span) : 1;
  if (scale < 1) return { scale, off: h / 2 * (1 - (nt + nb) / 2 * scale) - (a + b) / 2 };
  const top = h / 2 * (1 - nt), bot = h / 2 * (1 - nb);
  return { scale: 1, off: bot > b ? bot - b : top < a ? top - a : 0 };
}
// The lens for a picture scale: a wider vertical field of view (degrees) that shows 1/scale as much.
export const fovFor = (fov, scale) => 2 * Math.atan(Math.tan(fov * Math.PI / 360) / Math.max(0.2, scale)) * 180 / Math.PI;

// ---------- spots ----------
// The Pearl Basket's spot from the bake (barn.json `pearls`: the baked pearls in it): the middle and a radius.
export function basketSpot(pearls) {
  const n = pearls.length;
  const x = pearls.reduce((s, p) => s + p[0], 0) / n, z = pearls.reduce((s, p) => s + p[2], 0) / n;
  const y = pearls.reduce((s, p) => s + p[1], 0) / n;
  return { x, y, z, r: Math.max(...pearls.map(p => Math.hypot(p[0] - x, p[2] - z))) };
}
// What is wrong with a round spot { x, z, r } in the barn (room: barn.json `room`): [] when it is inside the aisle
// and clear of the stand (and of the other spots given).
export function spotProblems(spot, room, others = [], gap = 0.03) {
  const out = [];
  if (Math.abs(spot.x) + spot.r > room.aisle_half - gap) out.push('outside the aisle');
  if (Math.hypot(spot.x, spot.z) - spot.r < room.stand_r + gap) out.push('on the stand');
  if (spot.z + spot.r > room.z_front || spot.z - spot.r < room.z_end) out.push('outside the barn');
  for (const o of others) if (Math.hypot(spot.x - o.x, spot.z - o.z) < spot.r + o.r + gap) out.push('on ' + (o.name || 'another spot'));
  return out;
}
