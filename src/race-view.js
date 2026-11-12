// Slime Sprint as a race (design/contests-race-view.md v2, RV2: the Pixel Derby by day). It replaces the stand show
// for the Sprint only (Beauty and Bounce-Off keep it until RV3/RV4). The race SHOWS what the rules decide: scoreShow
// (core/contests.js) works out the result from your cheers, core/race.js turns it into legs, gaps and words, and
// nothing here feeds back into a score. Nothing is saved during the race: applyShow runs once, at the end (or on Skip),
// so a reload mid-race cancels it with nothing paid. The pat at the gate is the ranch's own pet.
//   The way in: the race card's "Race!" (ui/contests.js) -> start(): the kit and the four runners' strips (built while
//   the card was open), then the layer fades in over the barn and the 3D stops drawing (game.js draw()).
//   Each frame (update): the race clock (slow motion for the photo finish, still while the photo shows), the rings at
//   the course moments (C1b's timing: the first tap is graded by cheerGrade), the caller, the tote strip, the picture.
//   Reduced motion: still shots per leg, idle frames, no effects, no slow motion, every cheer an automatic Good.
// The pieces: view/race-plan.js (positions, frames), view/race-draw.js (the pixels), view/race-kit.js (the art),
// view/race-skin.js (every UI piece, one module). Numbers: CONTESTS.race (content.js).
import { CONTESTS } from './data/content.js';
import { scoreShow, applyShow, canEnter, cheerGrade, trophiesOf } from './core/contests.js';
import { raceOf, raceScale, raceSeed, cheersByAct } from './core/race.js';
import { RacePlan } from './view/race-plan.js';
import { RaceDraw } from './view/race-draw.js';
import { loadKit, kitNow, RunnerArt, castOfResident, castOfRival } from './view/race-kit.js';
import { FORM_LOOKS } from './view/forms.js';
import * as S from './view/race-skin.js';
import { RaceBridge } from './view/race-bridge.js';
import * as THREE from 'three';

const C = CONTESTS;
const yieldNow = () => new Promise(r => setTimeout(r, 0));

export class RaceView {
  constructor(game) {
    this.g = game;
    this.s = null;          // the race running now
    this.last = null;       // the last race's result (tests, the report)
    this.ui = null;
    this.order = new Int32Array(4);
    this.prog = new Float64Array(4);
    this.perf = { frames: 0, ms: 0, max: 0, draws: 0, maxDraws: 0, maxFills: 0, build: null };
    this.samples = new Float64Array(16384);   // each race frame's ms (the perf probe's median and p90)
    this.sn = 0;
    this._ys = { x: 0, y: 0 };
    // (made once: a closure written inside frame() would make V8 allocate frame()'s context on every call)
    this.hideStampLater = () => this.ui && S.hideStamp(this.ui);
    this.slideDone = () => { if (this.ui) this.ui.el.classList.remove('slide'); if (this.bridge && !(this.s && this.s.phase === 'bridge')) this.bridge.clear(); };
    this.snapWanted = false;
    this.bridge = null;
    this._ya = { x: 0, top: 0 };
  }
  get on() { return !!this.s; }
  get covers() { return !!(this.s && this.s.shown); }

  // ---------- the cast ----------
  // the race as it would run now (no cheers): its runners in lane order (yours first)
  preview(id, cup) { return raceOf(this.g.state, id, 'sprint', { cup }); }
  castsOf(race, x) { return race.runners.map(r => (r.you ? castOfResident(x) : castOfRival(r.key, r.color))); }
  // the kit and the four strips, built in slices (onFaces: once every face is in, for the race card)
  async prepare(id, cup, onFaces = null) {
    const kit = await loadKit();
    const x = this.g.sim.ranch.resident(id);
    if (!x) throw new Error('no resident');
    const race = this.preview(id, cup);
    if (!race.ok) throw new Error(race.reason);
    const t0 = performance.now();
    const arts = this.castsOf(race, x).map(c => RunnerArt.of(kit, c));
    const fresh = arts.filter(a => !a.done).length;
    // one frame at a time between the page's own frames (the card shows first; then each runner's first frame, its face)
    await yieldNow();
    for (const a of arts) if (!a.next) { a.step(0); await yieldNow(); }
    if (onFaces) onFaces(arts);
    while (!arts.every(a => a.done)) {
      for (const a of arts) if (!a.done) { a.step(6); break; }
      await yieldNow();
    }
    if (fresh) this.perf.build = { ms: Math.round(performance.now() - t0), runners: fresh };   // (idle slices: wall time, not work time)
    return { kit, arts, race };
  }

  // ---------- start, skip, cancel, finish ----------
  start(id, cup) {
    const g = this.g;
    if (this.s) return false;
    const e = canEnter(g.state, id, 'sprint', cup);
    if (!e.ok || !g.barnRanch || !g.barnRanch.active) { g.sfx.error && g.sfx.error(); return false; }
    const x = e.x;
    this.s = { id, cup: e.cup, name: x.name, shown: false, phase: 'load', reduced: !!g.reduced, low: g.resolvedQuality() === 'low',
      hints: !trophiesOf(x).sprint, t: 0, hold: 0, cheers: ['none', 'none', 'none'], taps: [[], [], []], grades: [null, null, null], forced: [null, null, null],
      ring: null, ringK: -1, leg: -2, callI: -2, patted: false, photoDone: false, confetti: false, heartsDone: false, skipped: false, wall0: performance.now() };
    const s = this.s;
    g.hud.setSheet('closed', false);
    document.body.classList.add('cs-show');
    g.sfx.unlock && g.sfx.unlock();
    this.prepare(id, e.cup).then(p => { if (this.s === s) this.begin(p); }).catch(err => {
      // the race's files could not load (offline before they were ever fetched): today's stand show runs instead
      console.warn('race view:', err && err.message);
      if (this.s !== s) return;
      this.s = null;
      document.body.classList.remove('cs-show');
      g.contestShow.start(id, 'sprint', e.cup, { stand: true });
    });
    return true;
  }
  begin({ kit, arts }) {
    const g = this.g, s = this.s;
    const ui = this.ui || (this.ui = this.buildUi());
    const W = Math.ceil(innerWidth / 2), H = Math.ceil(innerHeight / 2);
    s.W = W; s.H = H;
    s.seed = raceSeed(s.id, 'sprint', s.cup, (g.state.ranch.contests && g.state.ranch.contests.shows) || 0);
    s.scale = raceScale(g.state, s.id, 'sprint', s.cup);
    s.race = this.raceNow();
    if (!s.race.ok) { this.cancel(); return; }
    const hill = this.hillProfile(kit);
    s.plan = new RacePlan(s.race, { reduced: s.reduced, hill, width: W });
    S.layout(ui, W, H);
    s.draw = new RaceDraw(kit, arts, { width: W, height: H, low: s.low, reduced: s.reduced, target: ui.canvas,
      fx: arts.map(a => (FORM_LOOKS[a.cast.form] && FORM_LOOKS[a.cast.form].fx) || null) });
    s.arts = arts;
    s.youCy = kit.j.families[arts[0].cast.fam].frames.idle_0.anchors.centre[1];
    s.cam = s.plan.camera(0, 0);
    S.setFaces(ui, s.race.runners, arts);
    for (let i = 0; i < 4; i++) this.order[i] = i;
    S.setOrder(ui, this.order);
    S.setName(ui, s.name, `${C.contests.find(c => c.id === 'sprint').name} · ${C.cups[s.cup - 1].name}`, null);
    S.setActs(ui, s.race, -1, s.grades);
    S.setCaller(ui, '');
    S.hidePhoto(ui); S.hidePop(ui); S.hideGo(ui); S.hideStamp(ui);
    S.clearRings(ui);
    ui.el.classList.toggle('rm', s.reduced);
    ui.el.style.setProperty('--rv-slide', C.race.view.bridge.slide + 's');
    // the way in: the next frame the barn draws is copied (afterRender) and pixelates; Reduced motion: a crossfade
    if (!s.reduced && !g.noRender && !g.glLost) { s.phase = 'bridgeWait'; s.wait = 0; this.snapWanted = true; return; }
    this.go(false);
  }
  // the barn's frame was just drawn: copy it and start the bridge (game.js draw(), right after the render)
  afterRender(canvas) {
    if (!this.snapWanted) return;
    this.snapWanted = false;
    const s = this.s, ui = this.ui;
    if (!s || s.phase !== 'bridgeWait') return;
    this.bridge.take(canvas, this.youOnBarn());
    ui.el.classList.add('bridge', 'on');
    ui.el.hidden = false;
    document.body.classList.add('rv-on');
    s.shown = true; s.phase = 'bridge';
  }
  // your slime on the barn's stand, on the screen (CSS px), for the bridge
  youOnBarn() {
    const g = this.g;
    try {
      const av = g.barnRanch.view.av, v = av.centerWorld(new THREE.Vector3()).project(g.stage.camera);
      if (!Number.isFinite(v.x) || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) return null;
      return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, r: C.race.view.bridge.youR };
    } catch (e) { return null; }
  }
  // the race proper: the course (slid in after the bridge, or faded in), the clock at the gate
  go(bridged) {
    const g = this.g, s = this.s, ui = this.ui;
    ui.el.hidden = false;
    if (bridged) {
      ui.el.classList.remove('bridge');
      ui.el.classList.add('on', 'slide');
      g.after(C.race.view.bridge.slide + 0.1, this.slideDone);
    } else requestAnimationFrame(() => ui.el && ui.el.classList.add('on'));
    document.body.classList.add('rv-on');
    s.shown = true; s.phase = 'gate'; s.t = 0;
    s.wall0 = performance.now();
    this.perf.frames = 0; this.perf.ms = 0; this.perf.max = 0; this.perf.maxDraws = 0; this.perf.maxFills = 0;
    this.sn = 0;
    g.sfx.whee ? g.sfx.whee() : g.sfx.sparkle && g.sfx.sparkle();
    this.frame(0);
  }
  buildUi() {
    const ui = S.buildLayer();
    this.bridge = new RaceBridge(ui.bridge);
    ui.canvas.addEventListener('pointerdown', e => { e.preventDefault(); this.tap(e); });
    ui.photo.addEventListener('pointerdown', e => { e.preventDefault(); this.tap(e); });
    ui.skip.addEventListener('click', e => { e.stopPropagation(); this.skip(); });
    window.addEventListener('keydown', e => {
      if (!this.s || !this.s.shown || this.g.hud.modalOpen) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.tap(e); } else if (e.key === 'Escape') this.skip();
    });
    return ui;
  }
  hillProfile(kit) {
    const [x0, y0, w, h] = kit.course.pieces.hill.rect, sh = kit.sheets.course, out = [];
    for (let i = 0; i < w; i++) { let top = h; for (let j = 0; j < h; j++) if (sh.data[(y0 + j) * sh.w + x0 + i]) { top = j; break; } out.push(h - top); }
    return out;
  }
  // the race with the cheers given so far (the legs not cheered yet: none)
  raceNow() {
    const s = this.s;
    return raceOf(this.g.state, s.id, 'sprint', { cup: s.cup, cheers: s.cheers.slice(), reducedMotion: s.reduced, seed: s.seed, scale: s.scale });
  }
  rerace() {
    const s = this.s, r = this.raceNow();
    if (!r.ok) return;
    s.race = r;
    s.plan.set(r, s.t);
  }
  skip() {
    const s = this.s;
    if (!s || !s.shown || s.phase === 'done') return;
    s.skipped = true;
    this.finish();
  }
  cancel() { if (this.s) this.end(); }
  // the result, once: scoreShow from the cheers, written into the save by applyShow; then the results card
  finish() {
    const g = this.g, s = this.s;
    if (!s || s.phase === 'done') return;
    s.phase = 'done';
    const res = scoreShow(g.state, s.id, 'sprint', { cup: s.cup, cheers: cheersByAct('sprint', s.cheers.slice()), reducedMotion: s.reduced });
    if (!res.ok) { this.end(); return; }
    const race = raceOf(g.state, s.id, 'sprint', { cup: s.cup, cheers: s.cheers.slice(), reducedMotion: s.reduced, seed: s.seed, scale: s.scale });
    const shown = { place: s.race.finish.place, order: s.race.finish.order.slice(), words: s.race.finish.margin.words };
    const given = applyShow(g.state, res, g.nowMs());
    const wall = performance.now() - s.wall0;
    this.last = { res, race, given, shown, taps: s.taps.map(t => [...t]), grades: s.grades.slice(), skipped: s.skipped, reduced: s.reduced,
      seconds: { race: Math.round(s.t * 10) / 10, wall: Math.round(wall / 100) / 10 },
      perf: { frames: this.perf.frames, avgMs: this.perf.frames ? +(this.perf.ms / this.perf.frames).toFixed(3) : 0, maxMs: +this.perf.max.toFixed(2), maxDraws: this.perf.maxDraws, maxFills: this.perf.maxFills, build: this.perf.build } };
    g.markDirty(true);
    g.saveNow(true);
    if (given && given.journal) g.hud.dot('journal');
    this.end();
    g.hud.renderRanch(true);
    if (res.won) g.sfx.levelUp ? g.sfx.levelUp() : g.sfx.sparkle && g.sfx.sparkle(); else g.sfx.coo && g.sfx.coo();
    g.contestsUI.showResult(res, given, { race, onClose: () => { if (g.view === 'ranch' && !g.hud.panelVisible()) { g.hud.openTab('ranch'); if (g.ranchFocus !== s.id && g.sim.ranch.resident(s.id)) g.focusResident(s.id); } } });
  }
  end() {
    const g = this.g, ui = this.ui;
    if (this.s && this.s.draw) this.s.draw.clearFx();
    this.s = null;
    this.snapWanted = false;
    if (this.bridge) this.bridge.clear();
    if (ui) { ui.el.classList.remove('on', 'bridge', 'slide'); ui.el.hidden = true; S.clearRings(ui); }
    document.body.classList.remove('cs-show', 'rv-on');
    if (g.barnRanch) g.barnRanch.renderCard();
    g.layoutChanged();
  }

  // ---------- each frame ----------
  update(dt) {
    const s = this.s, g = this.g;
    if (!s) return;
    if (g.view !== 'ranch' || !g.barnRanch.active || !g.sim.ranch.resident(s.id)) { this.cancel(); return; }
    // the way in: waiting for the barn's next frame (half a second at most), then the bridge
    if (s.phase === 'bridgeWait') { if ((s.wait += dt) > 0.5) { this.snapWanted = false; this.go(false); } return; }
    if (s.phase === 'bridge') { if (this.bridge.update(dt)) this.go(true); return; }
    if (!s.shown || s.phase === 'done' || g.hud.modalOpen) return;
    const t0 = performance.now();
    this.frame(Math.min(dt, 0.1));
    const ms = performance.now() - t0, P = this.perf;
    P.frames++; P.ms += ms; if (ms > P.max) P.max = ms;
    if (this.sn < 16384) this.samples[this.sn++] = ms;
  }
  frame(dt) {
    const s = this.s, g = this.g, ui = this.ui, plan = s.plan, Wd = C.race.words;
    // the clock: still while the photo shows (a tap goes on), slow in the photo finish's last 0.6 s
    if (s.hold > 0) { s.hold -= dt; if (s.hold <= 0) this.endPhoto(); }
    else s.t += dt * plan.rate(s.t);
    const t = s.t;
    // the gate: mood hearts, the first-race note
    if (!s.heartsDone && t > 0.4) { s.heartsDone = true; const y = this.youArt(t); s.draw.hearts(y.x, y.top, Math.min(C.race.view.hearts, s.race.res.mood)); if (s.hints) this.patNote(true); }
    if (t >= plan.gate && s.phase === 'gate') { s.phase = 'run'; this.patNote(false); g.sfx.bell ? g.sfx.bell() : g.sfx.plip && g.sfx.plip(); }
    // the legs: the name card's leg tag, the act strip, a natural's stamp as the main leg starts
    const leg = plan.legOf(t);
    if (leg !== s.leg && t < plan.tLine) {
      s.leg = leg;
      if (leg >= 0) {
        const tag = S.legTag(s.race, leg);
        S.setName(ui, s.name, tag.line, tag.stars);
        S.setActs(ui, s.race, leg, s.grades);
        if (s.race.legs[leg].role === 'main' && s.race.runners[0].stamp && !s.reduced) {
          const y = this.youScreen(t);
          S.showStamp(ui, s.race.runners[0].stamp, y.x, y.y);
          g.after(1.2, this.hideStampLater);
        }
      }
    }
    // the rings
    for (let k = 0; k < 3; k++) if (s.ringK < k && t >= plan.rings[k] && s.grades[k] === null) this.startRing(k);
    const r = s.ring;
    if (r && !r.graded) {
      const el = (performance.now() - r.t0) / 1000;
      if (s.reduced) { if (el >= C.show.reducedCheer) this.graded(C.cheer.reduced); }
      else if (el > C.cheer.window) this.graded('none');
    }
    // the photo finish: freeze as the winner reaches the line
    if (s.race.finish.photo && !s.reduced && !s.photoDone && t >= plan.tLine) {
      s.photoDone = true; s.t = plan.tLine; s.hold = C.race.photo.hold;
      s.draw.draw(plan, s.t, s.cam, 0);
      S.showPhoto(ui, s.race, ui.canvas);
      g.sfx.camera ? g.sfx.camera() : g.sfx.sparkle && g.sfx.sparkle();
    }
    if (!s.confetti && t >= plan.tLine && s.hold <= 0 && s.race.finish.won) {
      s.confetti = true;
      s.draw.confetti(s.cam, s.low ? C.race.view.confetti / 2 : C.race.view.confetti);
      g.sfx.sparkle && g.sfx.sparkle();
    }
    if (t >= plan.tEnd && s.hold <= 0) { this.finish(); return; }
    // the picture
    const cam = s.cam = plan.camera(t, dt);
    s.draw.surgeStep(plan, t, dt);
    s.draw.draw(plan, t, cam, s.hold > 0 ? 0 : dt * plan.rate(t));
    this.perf.draws = s.draw.drawCalls;
    if (s.draw.drawCalls > this.perf.maxDraws) this.perf.maxDraws = s.draw.drawCalls;
    if (s.draw.fills > this.perf.maxFills) this.perf.maxFills = s.draw.fills;
    // the tote strip: the running order (moves only when it changes) and the pins
    const o = this.order, p = this.prog, span = plan.lineX - plan.x0;
    let changed = false;
    for (let i = 0; i < 4; i++) { const v = (plan.xs[i] - plan.x0) / span; p[i] = v < 0 ? 0 : v > 1 ? 1 : v; }
    for (let a = 1; a < 4; a++) {
      const v = o[a];
      let b = a - 1;
      while (b >= 0 && (p[o[b]] < p[v] || (p[o[b]] === p[v] && o[b] > v))) { o[b + 1] = o[b]; b--; changed = true; }
      o[b + 1] = v;
    }
    if (changed) S.setOrder(ui, o);
    S.drawTrack(ui, p, o, plan.youI);
    // the caller
    const ci = plan.callAt(t);
    if (ci !== s.callI) { s.callI = ci; S.setCaller(ui, ci >= 0 ? s.race.calls[ci].text : ''); }
    // the rings around your slime
    if (s.ring && !s.reduced) {
      const y = this.youScreen(t), el = (performance.now() - s.ring.t0) / 1000;
      const k0 = C.show.ring, k = s.ring.graded ? (s.ring.kAt || 1) : k0 - (k0 - 1) * (el / C.cheer.beat);
      s.ringWas = S.drawRings(ui, y.x, y.y, s.ring.gone ? 0 : Math.max(0.3, k), s.ring.graded && s.ring.grade !== 'none', s.ringWas);
    } else if (s.ringWas) s.ringWas = S.drawRings(ui, 0, 0, 0, false, true);
  }
  // your slime's body centre in art px (x, the top of its body) and on the screen (pt); one object each, reused
  youArt(t) {
    const s = this.s, plan = s.plan, i = plan.youI;
    plan.tick(t);
    const x = plan.xs[i], gy = plan.ground(i, x), o = this._ya;
    o.x = x; o.top = gy - 40;
    return o;
  }
  youScreen(t) {
    const s = this.s, plan = s.plan, i = plan.youI;
    plan.tick(t);
    const x = plan.xs[i], gy = plan.ground(i, x), o = this._ys;
    o.x = S.screenX(Math.round(x) - Math.round(s.cam) + 0.5); o.y = S.screenY(gy - 50 + s.youCy + s.draw.oy, s.H);
    return o;
  }
  patNote(on) {
    const s = this.s;
    if (!s.hints || s.patted) on = false;
    const y = this.youScreen(s.t);
    S.showPat(this.ui, s.name, y.x, y.y, on);
  }

  // ---------- the cheers ----------
  startRing(k) {
    const s = this.s, ui = this.ui;
    s.ringK = k;
    s.ring = { k, t0: performance.now(), graded: false, grade: null, gone: false };
    const y = this.youScreen(s.t);
    S.showGo(ui, s.name, y.x, y.y, s.hints && !s.reduced && k === 0);
    S.setActs(ui, s.race, k, s.grades);
    if (!s.reduced) this.g.sfx.question && this.g.sfx.question();
  }
  tap(e) {
    const s = this.s;
    if (!s || !s.shown || s.phase === 'done') return;
    this.g.sfx.unlock && this.g.sfx.unlock();
    if (s.hold > 0) { this.endPhoto(); return; }
    // the pat at the gate: a tap on your slime
    if (s.t < s.plan.gate) {
      if (s.patted || !e || e.clientX === undefined) return;
      const y = this.youScreen(s.t);
      if (Math.abs(e.clientX - y.x) < 44 && Math.abs(e.clientY - y.y) < 44) this.pat();
      return;
    }
    const r = s.ring;
    if (!r || s.reduced) return;
    const at = e && e.timeStamp > 0 ? e.timeStamp : performance.now(), t = (at - r.t0) / 1000;
    if (t < 0) return;
    // a tap made in time that reaches the game late (a slow frame: the ring just ran out) still counts, once
    const late = r.graded && r.grade === 'none' && !r.late && t < C.cheer.window;
    if (r.graded && !late) return;
    if (late) r.late = true;
    s.taps[r.k].push(Math.round(t * 1000) / 1000);
    this.graded(cheerGrade(s.taps[r.k]));
  }
  // (#debug, tests) this ring's cheer as if tapped with that grade
  debugCheer(grade) {
    const s = this.s;
    if (!s || !s.ring || s.ring.graded || C.cheer.points[grade] === undefined) return false;
    s.forced[s.ring.k] = grade;
    this.graded(s.reduced ? C.cheer.reduced : grade);
    return true;
  }
  graded(grade) {
    const s = this.s, ui = this.ui, g = this.g, r = s.ring, k = r.k;
    const el = (performance.now() - r.t0) / 1000;
    r.kAt = Math.max(0.3, C.show.ring - (C.show.ring - 1) * (el / C.cheer.beat));
    r.graded = true; r.grade = grade;
    s.grades[k] = grade;
    s.cheers[k] = s.taps[k].length ? s.taps[k].slice() : s.forced[k] || 'none';
    if (s.reduced) s.cheers[k] = C.cheer.reduced;
    this.rerace();
    const y = this.youScreen(s.t);
    S.hideGo(ui);
    S.showPop(ui, grade, y.x, y.y);
    S.setActs(ui, s.race, k, s.grades);
    if (grade !== 'none') {
      s.plan.surge(s.t);
      const a = this.youArt(s.t);
      if (grade === 'perfect') s.draw.sparkles(a.x, a.top);
      if (grade === 'perfect') g.sfx.sparkle && g.sfx.sparkle(); else if (grade === 'good') g.sfx.mii && g.sfx.mii(); else g.sfx.plip && g.sfx.plip();
    }
    g.after(0.45, () => { if (this.s === s && s.ring === r) r.gone = true; });
    g.after(1.4, () => { if (this.s === s) S.hidePop(ui); });
  }
  // the pat: the ranch's own pet (+happiness once every 40 s); mood can rise by a point, so the race is worked out again
  pat() {
    const s = this.s, g = this.g;
    s.patted = true;
    g.petResident(s.id);
    this.rerace();
    const a = this.youArt(s.t);
    s.draw.hearts(a.x, a.top, 2);
    this.patNote(false);
  }
  endPhoto() {
    const s = this.s;
    s.hold = 0;
    S.hidePhoto(this.ui);
  }

  // (test hook) the race now
  info() {
    const s = this.s, L = this.last;
    const last = L ? { won: L.res.won, score: L.res.score, place: L.res.place, cheers: L.res.cheers, grades: L.grades, taps: L.taps, skipped: L.skipped, given: L.given,
      shown: L.shown, words: { margin: L.race.finish.margin.words, how: L.race.how.text, quiet: L.race.finish.quiet, photo: L.race.finish.photo }, seconds: L.seconds, perf: L.perf, reduced: L.reduced } : null;
    if (!s) return { on: false, last };
    const ring = s.ring ? { k: s.ring.k, t0: s.ring.t0, graded: s.ring.graded } : null;
    let screen = null;
    if (s.shown) { const y = this.youScreen(s.t); screen = { x: y.x, y: y.y }; }
    return { on: true, shown: s.shown, phase: s.phase, t: s.t, hold: s.hold, ring, rings: s.plan ? s.plan.rings.slice() : null, gate: s.plan ? s.plan.gate : null,
      grades: s.grades.slice(), taps: s.taps.map(t => [...t]), reduced: s.reduced, low: s.low, beat: C.cheer.beat, window: C.cheer.window, you: screen,
      place: s.race ? s.race.finish.place : null, order: s.race ? s.race.finish.order.slice() : null, draws: this.perf.draws, perf: { ...this.perf }, last };
  }
}
