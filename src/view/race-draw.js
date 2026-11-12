// The Pixel Derby's picture (design/contests-race-view.md v2 §1.1, §3, §8 frame A; RV2): one canvas at art resolution
// (1 art px = 2 pt; 195 x 422 on a 390 x 844 phone, wider phones see more course), scaled up by the page with no
// smoothing. The course comes from the kit's sheet (course_sprint.png + palette_day.json), built once into strips:
// the sky, the hills and the tree line (with the windmill) at their parallax, the crowd behind the bunting and the
// fence, the verge, the four lanes with the near rail and grass, the lane flags. Then per frame: the gate, the hill,
// the hoops (back half, the runner, front half), the finish post and tapes, the four runners (their strips from
// race-kit.js), and the pooled effects (dust, sparkles, hearts, surge streaks, the mint trail, the form's small
// effects, confetti). Positions in whole art px. The draw loop makes nothing: the effects are a fixed pool and every
// strip is built before the race starts. drawCalls counts the drawImage/fillRect calls of the last frame.
import { CONTESTS } from '../data/content.js';
import { CAN } from './race-compose.js';
import { FRAMES, LAND } from './race-plan.js';

const V = () => CONTESTS.race.view;
const hex3 = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mod = (a, m) => ((a % m) + m) % m;
const lcm = (a, b) => { let x = a, y = b; while (y) [x, y] = [y, x % y]; return a / x * b; };
const PAR = { sky: 0.1, hills: 0.25, tree: 0.45, fence: 0.75, lanes: 1 };
// effect kinds (pool slots carry the number)
const K = { dust: 0, sparkle: 1, heart: 2, streak: 3, mint: 4, small: 5, confetti: 6 };
const POOL = 64;

function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
// an index sheet's rect -> a canvas, through a palette (index n -> pal[n - 1], [r, g, b] or null for clear)
function paint(sheet, [x0, y0, w, h], pal, into = null, dx = 0, dy = 0) {
  const c = into || canvas(w, h), ctx = c.getContext('2d'), im = ctx.getImageData(dx, dy, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = sheet.data[(y0 + y) * sheet.w + x0 + x];
    const col = v ? pal[v - 1] : null;
    if (!col) continue;
    const p = (y * w + x) * 4;
    im.data[p] = col[0]; im.data[p + 1] = col[1]; im.data[p + 2] = col[2]; im.data[p + 3] = 255;
  }
  ctx.putImageData(im, dx, dy);
  return c;
}
// a tile repeated across a strip of `w` px (and `reps` rows of it)
function strip(src, w, period, h = src.height, x0 = 0, rowsY = [0]) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  for (const y of rowsY) for (let x = -period + mod(x0, period); x < w; x += period) ctx.drawImage(src, x, y);
  return c;
}

export class RaceDraw {
  // kit: the loaded kit; runners: RunnerArt per runner (race order); opts: width/height (art px), low (Low quality),
  // reduced (Reduced motion: no effects), forms (each runner's FORM_LOOKS fx: { kind, every, color } or null)
  constructor(kit, runners, { width, height, low = false, reduced = false, fx = [], target = null }) {
    this.kit = kit; this.art = runners; this.W = width; this.H = height; this.low = low; this.reduced = reduced;
    this.oy = height - V().top;   // the course's bottom on the screen's bottom
    this.canvas = target || canvas(width, height);
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.drawCalls = 0;   // drawImage calls in the last frame (the design's budget: 60)
    this.fills = 0;       // fillRect calls in the last frame (pixel confetti and the mint trail)
    const C = kit.course, P = C.pieces, pal = kit.palette.map(hex3), sh = kit.sheets.course;
    this.pal = pal;
    const piece = (n, p = pal) => paint(sh, P[n].rect, p);
    this.pieces = {};
    for (const n of Object.keys(P)) if (!P[n].tile) this.pieces[n] = { c: piece(n), a: P[n].anchor || [0, 0], w: P[n].rect[2], h: P[n].rect[3] };
    // the hill on lanes 2 and 4: lane_a's green swapped for lane_b's
    const ia = kit.palette.indexOf('#86c672'), ib = kit.palette.indexOf('#77bb68');
    const palB = pal.slice(); palB[ia] = pal[ib];
    this.hillB = piece('hill', palB);
    this.hillA = this.pieces.hill.c;
    this.hillH = this.pieces.hill.h;
    // ---- strips (built once) ----
    const W = width;
    const sky = piece('sky'), hills = piece('hills'), tree = piece('tree_line'), sails = [0, 1, 2, 3].map(i => piece('windmill_sails_' + i));
    this.sky = { c: strip(sky, W + 96, 96), p: 96 };
    this.hills = { c: strip(hills, W + 192, 192), p: 192 };
    // the tree line with the windmill's sails on its tower (4 turns; Low: the first only)
    this.tree = { p: 196, c: [0, 1, 2, 3].map(i => { const c = strip(tree, W + 196, 196), x = c.getContext('2d'); for (let k = 0; k < W + 392; k += 196) x.drawImage(sails[low ? 0 : i], k + 150 - 21, 126 - 110 - 21); return c; }) };
    // the crowd: wee slimes in the place colours behind the bunting and the fence, two of them bouncing (2 versions)
    const cr = kit.fxj.crowd, crSheet = kit.sheets.crowd, places = Object.keys(CONTESTS.race.rivals);
    const colours = CONTESTS.cups.flatMap(c => c.rivals).reduce((m, r) => (m[r.place] = r.color, m), {});
    const wee = [];
    places.forEach((p, i) => {
      const body = hex3(colours[p] || '#ffc9a3'), pl = [hex3('#5c5470'), body, hex3('#2c2142')];
      const shape = i % 2 ? 'glimmer' : 'juniper';
      wee.push([`wee_${shape}_rest`, `wee_${shape}_bounce`].map(n => ({ c: paint(crSheet, cr.sprites[n].rect, pl), a: cr.sprites[n].anchor })));
    });
    const PERIOD = 192, fenceP = lcm(lcm(8, 96), PERIOD);
    const bunting = piece('bunting'), fence = piece('fence'), verge = piece('verge');
    this.fence = { p: fenceP, c: [0, 1].map(up => {
      const c = canvas(W + fenceP, 28), x = c.getContext('2d');   // rows 157..184 (the crowd's heads to the fence's foot)
      for (let k = 0; k < W + fenceP + PERIOD; k += PERIOD) V().crowd.forEach((cx, i) => {
        const bounce = V().crowdBounce.includes(i) && up && !low, s = wee[i % wee.length][bounce ? 1 : 0];
        x.drawImage(s.c, k + cx - s.a[0], 165 - s.a[1] - (bounce ? 4 : 0) - 157);
      });
      for (let k = -96 + 2; k < W + fenceP; k += 96) x.drawImage(bunting, k, 158 - 157);
      for (let k = 0; k < W + fenceP; k += 8) x.drawImage(fence, k, 160 - 157);
      return c;
    }) };
    this.verge = { c: strip(verge, W + 7, 7), p: 7 };
    // the lanes (4 lane tiles), the near verge, rail and grass: one strip, period lcm(32, 16, 10)
    const la = piece('lane_a'), lb = piece('lane_b'), rail = piece('near_rail'), grass = piece('near_grass');
    const LP = lcm(lcm(32, 16), 10), lanesH = 422 - 186;
    const lc = canvas(W + LP, lanesH), lx = lc.getContext('2d');
    const vergeRGB = `rgb(${pal[kit.palette.indexOf('#5f9f58')].join(',')})`;
    for (const [lane, y] of [[4, 186], [3, 216], [2, 246], [1, 276]]) for (let k = 0; k < W + LP; k += 32) lx.drawImage(lane % 2 ? la : lb, k, y - 186);
    lx.fillStyle = vergeRGB; lx.fillRect(0, 306 - 186, W + LP, 4); lx.fillRect(0, 320 - 186, W + LP, 1);
    for (let k = 0; k < W + LP; k += 16) lx.drawImage(rail, k, 310 - 186);
    for (let y = 321; y < 422; y += 12) for (let k = 0; k < W + LP; k += 10) lx.drawImage(grass, k, y - 186);
    this.lanes = { c: lc, p: LP };
    // the lane flags, every 60 px on each lane's back line (frame A x 58, 118, 178)
    const flag = this.pieces.flag;
    const fc = canvas(W + 60, 120), fgx = fc.getContext('2d');
    for (const y0 of [186, 216, 246, 276]) for (let k = -60 + 58; k < W + 60; k += V().flags) fgx.drawImage(flag.c, k - flag.a[0], y0 - flag.a[1] - 180);
    this.flags = { c: fc, p: 60, y: 180 };
    // ---- effects ----
    const fxs = kit.fxj, fxPal = fxs.palette.keys.map(k => hex3(fxs.palette.day[k]));
    const fxSprite = (name, recolour = null) => {
      const e = fxs.effects[name], pl = fxPal.slice();
      if (recolour) for (const [k, col] of Object.entries(recolour)) pl[fxs.palette.keys.indexOf(k)] = hex3(col);
      const [, , w, h] = e.rects[0], c = canvas(w * e.rects.length, h);
      e.rects.forEach((r, i) => paint(kit.sheets.fx, r, pl, c, i * w, 0));
      return { c, w, h, n: e.rects.length, a: e.anchor };
    };
    this.fx = { dust: fxSprite('dust'), sparkle: fxSprite('sparkle'), heart: fxSprite('heart'), streak: fxSprite('surge_streaks') };
    // each runner's small form effect (one every half second while running; Low: none)
    this.small = fx.map(f => {
      if (!f || !fxs.effects[f.kind] || low) return null;
      const rc = f.color ? { glint: f.color, pollen: f.color } : null;
      return fxSprite(f.kind, rc);
    });
    this.mint = `rgb(${hex3(fxs.palette.day.rb_m).join(',')})`;
    this.confettiCols = ['#ff74b0', '#3fa2ff', '#ff9b2f', '#f2c14e', '#fffaf0', '#9cf2a8'];
    // the pool
    this.pool = Array.from({ length: POOL }, () => ({ on: false, k: 0, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, front: false, r: 0, col: '' }));
    this.pi = 0;
    this.last = new Int32Array(runners.length).fill(-1);
    this.smallT = new Float64Array(runners.length);
    this.mintT = 0;
    this.streakT = 0;
    // each runner's body centre in its cell (x) and its strip
    this.cx = runners.map(a => Math.round(kit.j.families[a.cast.fam].frames.idle_0.anchors.centre[0]));
  }

  // ---------- the pool ----------
  spawn(k, x, y, vx, vy, life, front, r = 0, col = '') {
    if (this.reduced) return null;
    const p = this.pool[this.pi];
    this.pi = (this.pi + 1) % POOL;
    p.on = true; p.k = k; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.age = 0; p.life = life; p.front = front; p.r = r; p.col = col;
    return p;
  }
  clearFx() { for (let i = 0; i < POOL; i++) this.pool[i].on = false; }
  sparkles(x, y) { for (let i = 0; i < 3; i++) this.spawn(K.sparkle, x - 10 + i * 10, y - 4 * (i % 2), 0, -6, 0.6, true, i); }
  hearts(x, y, n) { for (let i = 0; i < n; i++) this.spawn(K.heart, x - 8 + i * 5, y + (i % 2) * 3, 0, -10, 1.3 + i * 0.12, true, i); }
  confetti(cam, n) {
    for (let i = 0; i < n; i++) {
      const s = (i * 2654435761) >>> 0;
      this.spawn(K.confetti, cam + (s % this.W), -this.oy + 150 + ((s >>> 8) % 40), ((s >>> 4) % 21) - 10, 18 + ((s >>> 12) % 22), 2.4, true, (s >>> 16) % 6);
    }
  }

  // ---------- each frame ----------
  // plan: RacePlan; t: race time; cam: camera x (world); dt: seconds since the last frame (effects)
  draw(plan, t, cam, dt) {
    const ctx = this.ctx, W = this.W, oy = this.oy, cr = Math.round(cam);
    let n = 0;
    // the backdrop
    this.fills = 0;
    if (oy > 0) { ctx.fillStyle = '#bfe0ef'; ctx.fillRect(0, 0, W, oy); this.fills++; }
    n += this.band(this.sky.c, this.sky.p, PAR.sky, cr, oy, 115);
    n += this.band(this.hills.c, this.hills.p, PAR.hills, cr, oy + 88, 47);
    const sail = this.low ? 0 : Math.floor(t * 4) & 3;
    n += this.band(this.tree.c[sail], this.tree.p, PAR.tree, cr, oy + 110, 65);
    n += this.band(this.fence.c[Math.floor(t * 2.5) & 1], this.fence.p, PAR.fence, cr, oy + 157, 28);
    n += this.band(this.verge.c, this.verge.p, PAR.lanes, cr, oy + 175, 11);
    n += this.band(this.lanes.c, this.lanes.p, PAR.lanes, cr, oy + 186, 422 - 186);
    n += this.band(this.flags.c, this.flags.p, PAR.lanes, cr, oy + this.flags.y, 120);
    // the effects behind the runners (dust, streaks, the mint trail); every effect moves on here, once a frame
    n += this.effects(t, cr, dt, false);
    // the finish post beside lane 4 (behind everything on the course)
    const L = V().lanes, P = this.pieces;
    n += this.piece(P.finish_post, plan.lineX, 186, cr);
    // lane by lane, back (4) to front (1)
    for (let lane = 4; lane >= 1; lane--) {
      const y1 = L[lane];
      n += this.drawImg(lane % 2 ? this.hillA : this.hillB, plan.hillX, y1 - 1 - (this.hillH - 1), cr, 64, this.hillH);
      for (let h = 0; h < 3; h++) n += this.piece(P.hoop_back, plan.hoopX[h], y1 - 1, cr);
      for (let i = 0; i < plan.n; i++) if (plan.lane[i] === lane) n += this.runner(plan, i, t, cr, dt);
      for (let h = 0; h < 3; h++) n += this.piece(P.hoop_front, plan.hoopX[h], y1 - 1, cr);
      // the finish tape: taut, pressed, snapped, parted as this lane's runner reaches it
      let tape = P.finish_tape_taut;
      for (let i = 0; i < plan.n; i++) if (plan.lane[i] === lane) {
        const d = plan.x(i, t) - plan.lineX;
        tape = d < -16 ? P.finish_tape_taut : d < -12 ? P.finish_tape_pressed : d < -6 ? P.finish_tape_snap : P.finish_tape_parted;
      }
      n += this.piece(tape, plan.lineX, y1 - 1, cr);
      // the start stall (ribbons across until the off)
      const g = t < plan.gate ? P.gate_closed : t < plan.gate + 0.08 ? P.gate_drop_1 : t < plan.gate + 0.16 ? P.gate_drop_2 : P.gate_open;
      n += this.drawImg(g.c, 1, y1 - 27, cr, g.w, g.h);
    }
    const bell = t >= plan.gate && t < plan.gate + 0.6 && (Math.floor(t * 10) & 1) ? P.bell_ring : P.bell_rest;
    n += this.piece(bell, 3, L[4] - 28, cr);
    // the effects in front (sparkles, hearts, the form's small effects, confetti)
    n += this.effects(t, cr, 0, true);
    this.drawCalls = n;
  }
  // a repeating band at its parallax (one drawImage)
  band(c, period, par, cr, y, h) {
    const sx = mod(Math.round(cr * par), period);
    this.ctx.drawImage(c, sx, 0, this.W, h, 0, y, this.W, h);
    return 1;
  }
  piece(pc, wx, wy, cr) { return this.drawImg(pc.c, wx - pc.a[0], wy - pc.a[1], cr, pc.w, pc.h); }
  drawImg(c, wx, wy, cr, w, h) {
    const x = Math.round(wx) - cr;
    if (x + w <= 0 || x >= this.W) return 0;
    this.ctx.drawImage(c, x, Math.round(wy) + this.oy);
    return 1;
  }
  runner(plan, i, t, cr, dt) {
    const f = plan.frame(i, t), x = plan.x(i, t), gy = plan.ground(i, x), sx = Math.round(x) - cr - this.cx[i];
    const y = gy - 50 - plan.lift(f) + this.oy;
    if (sx + CAN <= 0 || sx >= this.W) { this.last[i] = f; return 0; }
    // effects that come from the stride: dust on landing (hop and bound), the mint trail at 6-7 stars
    if (!this.reduced && t >= plan.gate) {
      if (f === LAND && this.last[i] !== LAND) this.spawn(K.dust, x - 12, gy, -8, 0, 0.34, false);
      if (plan.gaitOf(i, t) === 'trail' && t < plan.tLine && (this.mintT += dt) > 0.06) { this.mintT = 0; this.spawn(K.mint, x - 16, gy - 8 - (Math.floor(t * 12) % 3) * 3, -14, 0, 0.45, false); }
      const sm = this.small[i];
      if (sm && t < plan.tLine && (this.smallT[i] += dt) > 0.5) { this.smallT[i] = 0; this.spawn(K.small, x - 6 + (i * 7 % 13), gy - 34, 0, -12, 0.8, true, i); }
    }
    this.last[i] = f;
    this.ctx.drawImage(this.art[i].canvas, f * CAN, 0, CAN, CAN, sx, Math.round(y), CAN, CAN);
    return 1;
  }
  // front: false moves every effect on by dt and draws the ones behind the runners; true draws the ones in front
  effects(t, cr, dt, front) {
    const ctx = this.ctx, oy = this.oy;
    let n = 0;
    for (let k = 0; k < POOL; k++) {
      const p = this.pool[k];
      if (!p.on) continue;
      if (!front) {
        p.age += dt;
        if (p.age >= p.life) { p.on = false; continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (p.front !== front) continue;
      const sx = Math.round(p.x) - cr, sy = Math.round(p.y) + oy, u = p.age / p.life;
      if (sx < -20 || sx > this.W + 20) continue;
      let s = null;
      if (p.k === K.dust) s = this.fx.dust;
      else if (p.k === K.sparkle) s = this.fx.sparkle;
      else if (p.k === K.heart) s = this.fx.heart;
      else if (p.k === K.streak) s = this.fx.streak;
      else if (p.k === K.small) s = this.small[p.r];
      if (s) {
        const fi = Math.min(s.n - 1, Math.floor(u * s.n));
        ctx.drawImage(s.c, fi * s.w, 0, s.w, s.h, sx - s.a[0], sy - s.a[1], s.w, s.h);
        n++;
      } else if (p.k === K.mint) {
        ctx.fillStyle = this.mint; ctx.fillRect(sx, sy, u < 0.5 ? 2 : 1, 1); this.fills++;
      } else if (p.k === K.confetti) {
        ctx.fillStyle = this.confettiCols[p.r]; ctx.fillRect(sx, sy, (p.age * 6 | 0) & 1 ? 1 : 2, 1); this.fills++;
      }
    }
    return n;
  }
  // your slime's surge: speed lines behind it while it lasts
  surgeStep(plan, t, dt) {
    if (this.reduced || t - plan.surgeAt > CONTESTS.race.view.surge || t < plan.surgeAt) return;
    if ((this.streakT += dt) < 0.14) return;
    this.streakT = 0;
    const i = plan.youI, x = plan.x(i, t);
    this.spawn(K.streak, x - 18, plan.ground(i, x) - 10 - (Math.floor(t * 20) % 2) * 6, -20, 0, 0.26, false);
  }
}
