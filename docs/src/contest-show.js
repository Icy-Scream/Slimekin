// The contest show on the barn's show stand (C1b, from the approved mock-ups). Three acts: in each the slime performs
// with the moves it already has (hops, spins, squashes), then the cheer ring: a pink ring closes on a gold one around
// the slime and your first tap is graded by the rules' own cheerGrade (Perfect / Good / Nice try). The barn dims with a
// spotlight on the stand (a 2D layer under the HUD: the top bar, the name card and the tab bar stay bright), a banner
// shows the contest and the cup with the score to beat, the name card says which act it is, and the act strip takes the
// ranch bar's place. Swapping, petting and the menu wait while the show runs; "Skip" ends it with no more cheers.
// The result is worked out by scoreShow and written by applyShow ONCE, when the show ends; nothing is saved during the
// show, so reopening the game mid-show simply cancels it (nothing paid). Reduced motion: no closing ring, every cheer is
// an automatic Good (the rules' Reduced motion), the slime still does small moves.
// Numbers: CONTESTS.show and CONTESTS.cheer (content.js). The cards before and after: ui/contests.js. Slime Sprint is a
// race now (race-view.js, RV2); this show is for the Beauty Show and the Bounce-Off (until RV3 / RV4).
import * as THREE from 'three';
import { CONTESTS, CONTEST_BY_ID, SKILL_BY_ID } from './data/content.js';
import { scoreShow, applyShow, canEnter, cheerGrade } from './core/contests.js';
import { cupIcon } from './ui/icons.js';
import { esc } from './ui/esc.js';

const C = CONTESTS;
const GRADE = { perfect: 'Perfect!', good: 'Good!', nice: 'Nice try!', none: '' };
// Each act's moves: [seconds into the act, move, size]. Reduced motion keeps only small hops and squashes.
const MOVES = {
  pose: [[0.3, 'squish', 0.6], [0.9, 'hop', 4], [1.7, 'spin', 1], [2.9, 'hop', 3], [3.8, 'squish', 0.8]],
  style: [[0.3, 'spin', 1], [1.5, 'spin', -1], [2.8, 'hop', 4], [3.7, 'kick', 0.05]],
  trick: [[0.4, 'hop', 5], [0.7, 'spin', 1], [2.2, 'hop', 5], [2.5, 'spin', -1], [3.7, 'squish', 0.8]],
  dash: [[0.2, 'hop', 3], [0.6, 'hop', 3], [1.0, 'hop', 3], [1.4, 'hop', 3], [2.4, 'spin', 1], [3.5, 'hop', 4]],
  hill: [[0.3, 'squish', 1], [1.2, 'hop', 5], [2.4, 'squish', 1], [3.3, 'hop', 5]],
  hoops: [[0.3, 'hop', 4.5], [0.6, 'spin', 1], [1.6, 'hop', 4.5], [1.9, 'spin', -1], [2.9, 'hop', 4.5], [3.2, 'spin', 1]],
  bigBounce: [[0.3, 'squish', 1.2], [1.0, 'hop', 8], [2.9, 'hop', 5]],
  runUp: [[0.2, 'hop', 2.5], [0.55, 'hop', 2.5], [0.9, 'hop', 3], [1.25, 'hop', 3.5], [1.6, 'hop', 4], [2.7, 'spin', 1]],
  landing: [[0.3, 'hop', 7], [1.6, 'squish', 1.2], [2.6, 'hop', 3], [3.5, 'squish', 0.6]],
};
const CSS = `
  #csLayer { position: fixed; inset: 0; z-index: 4; pointer-events: none; overflow: hidden; }
  #csLayer[hidden] { display: none; }
  #csLayer .cs-dim { position: absolute; inset: 0; pointer-events: auto; touch-action: none; opacity: 0; transition: opacity .6s ease; cursor: pointer; }
  #csLayer.on .cs-dim { opacity: 1; }
  #csLayer .cs-banner { position: absolute; left: 50%; top: 104px; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; padding: 7px 16px 7px 11px; border-radius: 19px; background: var(--panel-strong); box-shadow: 0 6px 16px -8px var(--shade); font-weight: 800; font-size: 14.5px; color: var(--ink); white-space: nowrap; max-width: calc(100vw - 32px); }
  #csLayer .cs-banner .gi.cup { width: 21px; height: 21px; }
  #csLayer .cs-beat { position: absolute; left: 50%; transform: translateX(-50%); padding: 3px 14px; border-radius: 12px; background: var(--cs-soft); border: 1px solid var(--cs-softline); color: var(--cs-pt); font-weight: 800; font-size: 12px; white-space: nowrap; }
  #csLayer .cs-skip { position: absolute; right: max(12px, env(safe-area-inset-right, 0px)); pointer-events: auto; border: 1px solid var(--edge); background: var(--panel); color: var(--ink-2); border-radius: 14px; padding: 4px 12px; font-weight: 800; font-size: 12px; cursor: pointer; }
  #csLayer .cs-prompt { position: absolute; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: 7px; opacity: 0; transition: opacity .25s; text-align: center; }
  #csLayer .cs-prompt.on { opacity: 1; }
  #csLayer .cs-prompt b { font-family: var(--display); font-weight: 700; font-size: 30px; line-height: 1.1; color: #fff;
    text-shadow: 2px 0 #6b4bd6, -2px 0 #6b4bd6, 0 2px #6b4bd6, 0 -2px #6b4bd6, 1.5px 1.5px #6b4bd6, -1.5px 1.5px #6b4bd6, 1.5px -1.5px #6b4bd6, -1.5px -1.5px #6b4bd6, 0 4px 10px rgba(40, 20, 80, .35); }
  #csLayer .cs-prompt span { padding: 3px 12px; border-radius: 12px; background: rgba(40, 25, 60, .62); color: #fff; font-weight: 800; font-size: 12.5px; }
  #csLayer .cs-prompt span:empty { display: none; }
  #csLayer .cs-rings { position: absolute; left: 0; top: 0; width: 0; height: 0; }
  #csLayer .cs-ring { position: absolute; border-radius: 50%; box-sizing: border-box; opacity: 0; transition: opacity .2s; }
  #csLayer .cs-ring.on { opacity: 1; }
  #csLayer .cs-ring.gold { border: 4px solid #ffe7a3; box-shadow: 0 0 12px 3px rgba(255, 214, 107, .8), inset 0 0 10px 2px rgba(255, 214, 107, .55); }
  #csLayer .cs-ring.pink { border: 5px solid #ff7cbb; box-shadow: 0 0 14px 4px rgba(255, 95, 168, .8), inset 0 0 12px 2px rgba(255, 95, 168, .5); will-change: transform; }
  #csLayer .cs-ring.hit { border-color: #fff4c4; box-shadow: 0 0 22px 8px rgba(255, 214, 107, .9); }
  #csLayer .cs-pop { position: absolute; left: 50%; transform: translate(-50%, -50%) scale(.6); opacity: 0; font-family: var(--display); font-weight: 700; font-size: 28px; color: #fff; white-space: nowrap;
    text-shadow: 2px 0 #e0558f, -2px 0 #e0558f, 0 2px #e0558f, 0 -2px #e0558f, 1.5px 1.5px #e0558f, -1.5px 1.5px #e0558f, 1.5px -1.5px #e0558f, -1.5px -1.5px #e0558f; transition: opacity .2s, transform .35s cubic-bezier(.3, 1.6, .6, 1); }
  #csLayer .cs-pop.on { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  #csLayer .cs-pop small { font-size: 22px; margin-left: 6px; }
  #csLayer .cs-pop.perfect { text-shadow: 2px 0 #d9890c, -2px 0 #d9890c, 0 2px #d9890c, 0 -2px #d9890c, 1.5px 1.5px #d9890c, -1.5px 1.5px #d9890c, 1.5px -1.5px #d9890c, -1.5px -1.5px #d9890c; }
  #csLayer .cs-pop.nice { font-size: 24px; text-shadow: 2px 0 #6b4bd6, -2px 0 #6b4bd6, 0 2px #6b4bd6, 0 -2px #6b4bd6, 1.5px 1.5px #6b4bd6, -1.5px 1.5px #6b4bd6, 1.5px -1.5px #6b4bd6, -1.5px -1.5px #6b4bd6; }
  body.cs-show #ui, body.cs-show #ui * { pointer-events: none !important; }
  body.cs-show .barn-card { pointer-events: none; }
  body.cs-show .barn-arrow { display: none !important; }
  #ranchBar.cs-on > :not(.cs-acts) { display: none !important; }
  #ranchBar .cs-acts { display: none; }
  #ranchBar.cs-on .cs-acts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; width: 100%; }
  #ranchBar.cs-on { padding: 6px; }
  .cs-acts > div { display: flex; align-items: center; justify-content: space-between; gap: 4px; min-height: 44px; padding: 0 11px; border-radius: 14px; background: var(--panel-strong); border: 1px solid var(--cs-line); font-weight: 800; font-size: 13.5px; color: var(--ink-2); box-sizing: border-box; min-width: 0; }
  .cs-acts > div span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .cs-acts > div b { font-size: 15px; color: var(--ink-2); flex: none; }
  .cs-acts > div.now { border: 1.6px solid var(--cs-p); color: var(--ink); } .cs-acts > div.now b { color: var(--cs-pt); }
  .cs-acts > div.done { color: var(--ink); background: var(--cs-soft); border-color: var(--cs-softline); } .cs-acts > div.done b { color: var(--cs-pt); }`;

export class ContestShow {
  constructor(game) {
    this.g = game;
    this.s = null;            // the show running now (null: none)
    this.last = null;         // the last show's result and what it brought (tests, the report)
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
    this.place = { x: -1, y: -1, rx: 0, ry: 0 };
  }
  get on() { return !!this.s || !!(this.g.raceView && this.g.raceView.on); }   // [race] the Sprint race counts as a show

  // ---------- the 2D layer (made the first time a show starts) ----------
  build() {
    if (this.el) return;
    if (!document.getElementById('contestShowCss')) {
      const css = document.createElement('style');
      css.id = 'contestShowCss';
      css.textContent = CSS;
      document.head.appendChild(css);
    }
    const el = this.el = document.createElement('div');
    el.id = 'csLayer';
    el.hidden = true;
    el.innerHTML = `<div class="cs-dim" id="csDim" aria-label="Tap when the rings meet"></div>
      <div class="cs-rings" id="csRings"><div class="cs-ring gold" id="csGold"></div><div class="cs-ring pink" id="csPink"></div></div>
      <div class="cs-prompt" id="csPrompt" aria-live="polite"><b id="csGo"></b><span id="csHint"></span></div>
      <div class="cs-pop" id="csPop"></div>
      <div class="cs-banner" id="csBanner"></div><div class="cs-beat" id="csBeat"></div>
      <button class="cs-skip" id="csSkip" type="button">Skip</button>`;
    document.body.appendChild(el);
    const $ = id => el.querySelector('#' + id);
    this.$ = { dim: $('csDim'), rings: $('csRings'), gold: $('csGold'), pink: $('csPink'), prompt: $('csPrompt'), go: $('csGo'), hint: $('csHint'), pop: $('csPop'), banner: $('csBanner'), beat: $('csBeat'), skip: $('csSkip') };
    this.$.dim.addEventListener('pointerdown', e => { e.preventDefault(); this.tap(e); });
    this.$.skip.addEventListener('click', e => { e.stopPropagation(); this.skip(); });
    window.addEventListener('keydown', e => {
      if (!this.s || this.g.hud.modalOpen) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.tap(e); }
      else if (e.key === 'Escape') this.skip();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.s && this.s.ring) this.s.ring.hidden = true; });
    window.addEventListener('resize', () => { if (this.s) this.placeTop(); });
    const bar = document.getElementById('ranchBar');
    const acts = this.actsEl = document.createElement('div');
    acts.className = 'cs-acts';
    acts.id = 'csActs';
    bar.appendChild(acts);
  }

  // ---------- start, skip, cancel, finish ----------
  // From the entry card's "Start the show": the slime comes up on the stand (if it is not on it), then the show.
  // [race] Slime Sprint runs as the pixel race (race-view.js); { stand: true }: the stand show (the race's files
  // could not load). Beauty and Bounce-Off stay here until RV3 / RV4.
  start(id, contest, cup, { stand = false } = {}) {
    const g = this.g, b = g.barnRanch;
    if (this.s) return false;
    if (contest === 'sprint' && !stand && g.raceView) return g.raceView.start(id, cup);
    const e = canEnter(g.state, id, contest, cup);
    if (!e.ok || !b || !b.active) { g.sfx.error && g.sfx.error(); return false; }
    this.build();
    const def = CONTEST_BY_ID[contest], cupDef = C.cups[e.cup - 1];
    const top = Math.max(...cupDef.rivals.map(r => r.score));
    this.s = { id, contest, cup: e.cup, name: e.x.name, def, cupDef, top, phase: 'swap', t: 0, act: -1, taps: [[], [], []], forced: [null, null, null], grades: [null, null, null], reduced: !!g.reduced, ring: null, moves: [] };
    g.hud.setSheet('closed', false);
    g.layoutChanged();
    document.body.classList.add('cs-show');
    b.view.performing = true;
    b.view.performExpr = null;
    if (b.curId !== id) b.show(id);
    const $ = this.$;
    $.banner.innerHTML = `${cupIcon(def.color, { tier: e.cup, champion: e.cup === C.cups.length })}<span>${esc(def.name)} · ${esc(cupDef.name)}</span>`;
    $.beat.textContent = `To beat: ${top}`;
    $.go.textContent = ''; $.hint.textContent = '';
    $.prompt.classList.remove('on'); $.pop.classList.remove('on');
    $.gold.classList.remove('on', 'hit'); $.pink.classList.remove('on', 'hit');
    this.el.hidden = false;
    this.el.classList.remove('on');
    requestAnimationFrame(() => this.el && this.el.classList.add('on'));
    document.getElementById('ranchBar').classList.add('cs-on');
    this.renderActs();
    this.placeTop();
    g.sfx.unlock && g.sfx.unlock();
    g.sfx.whee ? g.sfx.whee() : g.sfx.sparkle && g.sfx.sparkle();
    b.renderCard();
    return true;
  }
  // "Skip": the show ends now; the acts not cheered yet get no cheer (the rules: skipping = no cheers).
  skip() {
    const s = this.s;
    if (!s || s.phase === 'swap' || s.phase === 'done') return;
    this.stopRing();
    s.skipped = true;
    this.finish();
  }
  // The show stops without a result (left the ranch, the slime is gone): nothing is paid, nothing is saved.
  cancel() {
    if (this.g.raceView) this.g.raceView.cancel();   // [race]
    if (!this.s) return;
    this.stopRing();
    this.end();
  }
  // The result, once: the rules work the show out from the taps (seconds from each ring appearing) and write it into
  // the save; then the results card.
  finish() {
    const g = this.g, s = this.s;
    if (!s || s.phase === 'done') return;
    s.phase = 'done';
    // per act: its tap (seconds from the ring appearing; the rules grade it), or a grade a test gave (debugCheer)
    const cheers = s.taps.map((t, i) => (t.length ? t : s.forced[i] || []));
    const res = scoreShow(g.state, s.id, s.contest, { cup: s.cup, cheers, reducedMotion: s.reduced });
    if (!res.ok) { this.end(); return; }
    const given = applyShow(g.state, res, g.nowMs());
    this.last = { res, given, taps: s.taps.map(t => [...t]), skipped: !!s.skipped, seconds: { game: Math.round((s.game || 0) * 10) / 10, wall: Math.round((s.wall || 0) / 100) / 10 } };
    g.markDirty(true);
    g.saveNow(true);
    if (given && given.journal) g.hud.dot('journal');
    this.end();
    g.hud.renderRanch(true);
    if (res.won) {
      g.sfx.levelUp ? g.sfx.levelUp() : g.sfx.sparkle && g.sfx.sparkle();
      const v = g.barnRanch.view;
      if (!v.empty) { v.hop(5, 3); g.fx.emit('confetti', v.av.headTopWorld(this._v), { count: 26 }); }
    } else g.sfx.coo && g.sfx.coo();
    // the results card; closing it (Yay!, Okay) brings back the menu sheet the show was started from
    g.contestsUI.showResult(res, given, { onClose: () => { if (g.view === 'ranch' && !g.hud.panelVisible()) { g.hud.openTab('ranch'); if (g.ranchFocus !== s.id && g.sim.ranch.resident(s.id)) g.focusResident(s.id); } } });
  }
  end() {
    const g = this.g, b = g.barnRanch;
    this.s = null;
    if (this.el) { this.el.classList.remove('on'); this.el.hidden = true; }
    document.body.classList.remove('cs-show');
    document.getElementById('ranchBar').classList.remove('cs-on');
    if (b) { b.view.performing = false; b.view.performExpr = null; b.renderCard(); }
    g.layoutChanged();
  }

  // ---------- each frame ----------
  update(dt) {
    const s = this.s, g = this.g;
    if (!s) return;
    const b = g.barnRanch;
    if (g.view !== 'ranch' || !b.active) { this.cancel(); return; }
    // how long it ran (the report): the show's own clock, and the cheer ring's real time (the ring runs on the clock)
    if (s.phase !== 'swap') { if (s.phase !== 'ring' || s.reduced) s.game += dt; s.wall = performance.now() - s.wall0; }
    if (!g.sim.ranch.resident(s.id)) { this.cancel(); return; }
    this.placeRings(dt);
    // another card came up (the hiccup card, a postcard...): the show waits; a ring that was running starts again
    if (g.hud.modalOpen) { if (s.ring && !s.ring.graded) { this.stopRing(); s.phase = 'perform'; s.t = C.show.perform - 0.6; } return; }
    s.t += dt;
    const S = C.show;
    if (s.phase === 'swap') {
      if (b.curId === s.id && !b.view.swapping) { this.next('open'); s.game = 0; s.wall0 = performance.now(); s.wall = 0; }
      else if (s.t > S.swapWait && !b.view.swapping) this.cancel();
      return;
    }
    if (s.phase === 'open') { if (s.t >= S.open) this.startAct(0); return; }
    if (s.phase === 'perform') {
      this.runMoves();
      if (s.t >= S.perform) this.startRing();
      return;
    }
    if (s.phase === 'ring') {
      const r = s.ring;
      if (s.reduced) { if (s.t >= S.reducedCheer) this.graded(C.cheer.reduced); return; }
      if (r && !r.graded && performance.now() - r.t0 > C.cheer.window * 1000) {
        if (r.hidden) { this.stopRing(); this.startRing(); return; }   // the phone was put away during it: again
        this.graded('none');
      }
      return;
    }
    if (s.phase === 'pop') { if (s.t >= S.pop) { this.$.pop.classList.remove('on'); this.next('rest'); } return; }
    if (s.phase === 'rest') { if (s.t >= S.rest) { if (s.act < 2) this.startAct(s.act + 1); else this.startFinale(); } return; }
    if (s.phase === 'finale') { if (s.t >= S.finale) this.finish(); }
  }
  next(phase) { this.s.phase = phase; this.s.t = 0; }

  // ---------- the acts ----------
  actLabel(i) {
    const a = this.s.def.acts[i];
    return `${a.short} (${a.style ? 'outfits' : SKILL_BY_ID[a.skill]?.name || a.skill})`;
  }
  startAct(i) {
    const s = this.s, a = s.def.acts[i];
    s.act = i;
    this.next('perform');
    s.moves = (MOVES[a.id] || MOVES.pose).map(m => ({ at: m[0], kind: m[1], size: m[2], done: false }));
    this.$.prompt.classList.remove('on');
    this.renderActs();
    this.g.barnRanch.renderCard();
    this.g.sfx.mii && this.g.sfx.mii();
  }
  runMoves() {
    const s = this.s, v = this.g.barnRanch.view;
    if (v.empty || v.swapping) return;
    const av = v.av;
    for (const m of s.moves) {
      if (m.done || s.t < m.at) continue;
      m.done = true;
      if (s.reduced) {   // small moves only: a little hop or squash, no spins
        if (m.kind === 'hop') av.hop(Math.min(m.size, 2.5)); else av.squish(0.4);
        continue;
      }
      if (m.kind === 'hop') { av.hop(m.size); this.g.sfx.bounce && this.g.sfx.bounce(); }
      else if (m.kind === 'spin') av.spin(m.size);
      else if (m.kind === 'squish') av.squish(m.size);
      else if (m.kind === 'kick') av.kick(m.size);
    }
    v.performExpr = { eyes: 'happy', mouth: 'open', blush: 0.8 };
  }
  // The cheer ring: "Go, <name>!" and the pink ring closing on the gold one; the first tap after it appears counts.
  startRing() {
    const s = this.s, $ = this.$;
    this.next('ring');
    this.g.barnRanch.view.performExpr = { eyes: 'normal', mouth: 'smile', blush: 0.6 };
    $.go.textContent = `Go, ${s.name}!`;
    $.hint.textContent = s.reduced ? '' : 'Tap when the rings meet';
    $.prompt.classList.add('on');
    s.ring = { t0: performance.now(), w0: performance.now(), graded: false, hidden: false, anim: null };
    if (s.reduced) return;
    $.gold.classList.add('on'); $.pink.classList.add('on');
    $.gold.classList.remove('hit'); $.pink.classList.remove('hit');
    const W = C.cheer.window, k0 = C.show.ring, kEnd = k0 + (1 - k0) * (W / C.cheer.beat);
    const r = s.ring;
    if ($.pink.animate) {
      r.anim = $.pink.animate([{ transform: `scale(${k0})` }, { transform: `scale(${kEnd})` }], { duration: W * 1000, easing: 'linear', fill: 'forwards' });
      // the ring's own clock (the document timeline, the same clock as the taps' timeStamp)
      r.anim.ready.then(() => { if (s.ring === r && r.anim.startTime !== null) r.t0 = r.anim.startTime; }).catch(() => {});
    }
    this.g.sfx.question && this.g.sfx.question();
  }
  stopRing() {
    const s = this.s;
    if (!s || !s.ring) return;
    if (s.ring.anim) { try { s.ring.anim.cancel(); } catch { /* gone */ } }
    s.ring = null;
    this.$.gold.classList.remove('on'); this.$.pink.classList.remove('on');
  }
  tap(e) {
    const s = this.s;
    if (!s || s.reduced || !s.ring) return;
    const r = s.ring, at = (e && e.timeStamp > 0 ? e.timeStamp : performance.now());
    const t = (at - r.t0) / 1000;
    if (t < 0) return;   // (a touch from before the ring appeared)
    // A tap made in time that reaches the game late (a slow frame: the ring already ran out) still counts, once: its
    // own time is what is graded.
    const late = r.graded && !r.late && s.grades[s.act] === 'none' && (s.phase === 'pop' || s.phase === 'rest') && t < C.cheer.window;
    if (!late && (s.phase !== 'ring' || r.graded)) return;
    if (late) r.late = true;
    s.taps[s.act].push(Math.round(t * 1000) / 1000);
    this.g.sfx.unlock && this.g.sfx.unlock();
    this.graded(cheerGrade(s.taps[s.act]));
  }
  // (#debug, the picture tool) this act's cheer as if tapped with that grade, without waiting for the ring
  debugCheer(grade) {
    const s = this.s;
    if (!s || s.phase !== 'ring' || (s.ring && s.ring.graded) || C.cheer.points[grade] === undefined) return false;
    s.forced[s.act] = grade;
    this.graded(s.reduced ? C.cheer.reduced : grade);
    return true;
  }
  // An act's cheer is decided: the pop label, the chip fills in, the slime reacts.
  graded(grade) {
    const s = this.s, $ = this.$, g = this.g;
    s.grades[s.act] = grade;
    if (s.ring && !s.reduced && !s.ring.graded) s.game += (performance.now() - s.ring.w0) / 1000;
    if (s.ring) {
      s.ring.graded = true;
      if (s.ring.anim) { try { s.ring.anim.pause(); } catch { /* gone */ } }
      if (grade !== 'none') { $.pink.classList.add('hit'); $.gold.classList.add('hit'); }
    }
    const pts = C.cheer.points[grade] || 0;
    $.pop.className = `cs-pop ${grade}`;
    $.pop.innerHTML = grade === 'none' ? '' : `${esc(GRADE[grade])}<small>+${pts}</small>`;
    if (grade !== 'none') requestAnimationFrame(() => $.pop.classList.add('on'));
    $.prompt.classList.remove('on');
    this.g.after(0.45, () => { if (this.s === s && s.phase !== 'ring') { $.gold.classList.remove('on'); $.pink.classList.remove('on'); } });
    const v = g.barnRanch.view;
    if (!v.empty && grade !== 'none') {
      v.av.hop(s.reduced ? 2 : grade === 'perfect' ? 5 : 3.5);
      v.performExpr = { eyes: 'happy', mouth: 'open', blush: 0.9 };
      if (grade === 'perfect' && !s.reduced) g.fx.emit('hearts', v.av.headTopWorld(this._v), { count: 6 });
    }
    if (grade === 'perfect') g.sfx.sparkle && g.sfx.sparkle(); else if (grade === 'good') g.sfx.mii && g.sfx.mii(); else if (grade === 'nice') g.sfx.plip && g.sfx.plip();
    this.next('pop');
    this.renderActs();
  }
  startFinale() {
    const s = this.s;
    this.next('finale');
    this.$.go.textContent = 'The scores are in!';
    this.$.hint.textContent = '';
    this.$.prompt.classList.add('on');
    this.renderActs();
    this.g.barnRanch.renderCard();
    const v = this.g.barnRanch.view;
    if (!v.empty) v.av.hop(s.reduced ? 2 : 4);
  }

  // ---------- what the screen shows ----------
  // the name card while the show runs (barn-ranch.js renderCard asks)
  cardInfo() {
    const s = this.s;
    if (!s) return null;
    const line = s.phase === 'finale' || s.phase === 'done' ? 'The scores are in!'
      : s.act < 0 ? `${s.def.name} · ${s.cupDef.name}` : `Act ${s.act + 1} of 3 · ${this.actLabel(s.act)}`;
    return { name: s.name, act: { line, n: 3, on: s.act } };
  }
  renderActs() {
    const s = this.s;
    if (!s || !this.actsEl) return;
    const P = C.cheer.points;
    const html = s.def.acts.map((a, i) => {
      const gr = s.grades[i], now = i === s.act && gr === null;
      const v = gr ? (gr === 'none' ? '0' : `+${P[gr]}`) : now ? '···' : '—';
      return `<div class="${gr ? 'done' : now ? 'now' : ''}"><span>${esc(a.short)}</span><b>${v}</b></div>`;
    }).join('');
    if (this.actsEl.innerHTML !== html) this.actsEl.innerHTML = html;
  }
  // the banner and "To beat" under the top bar, Skip on the right
  placeTop() {
    const top = document.querySelector('.top'), y = (top ? top.getBoundingClientRect().bottom : 60) + 6;
    const $ = this.$;
    $.banner.style.top = Math.round(y) + 'px';
    $.beat.style.top = Math.round(y + 44) + 'px';
    $.skip.style.top = Math.round(y + 42) + 'px';
    this.minPrompt = y + 44 + 24 + 12;
    this.place.x = -1;   // (the prompt is placed again)
  }
  // the rings, the spotlight and the prompt follow the slime on the stand (its middle, as the camera sees it)
  // (smoothed, so the rings and the spotlight stay calm while it hops; snap: at once)
  placeRings(dt = 1 / 60, snap = false) {
    const g = this.g, v = g.barnRanch.view, cam = g.stage.camera;
    if (!v.ready || v.empty || v.swapping) return;
    const av = v.av, w = innerWidth, h = innerHeight;
    const c = av.centerWorld(this._v).project(cam);
    const top = av.headTopWorld(this._w).project(cam);
    const tx = (c.x + 1) / 2 * w, ty = (1 - c.y) / 2 * h, topY = (1 - top.y) / 2 * h;
    const half = Math.max(40, ty - topY);
    const trx = Math.max(110, Math.min(w * 0.4, half * 1.9));
    const sm = this.sm || (this.sm = { x: tx, y: ty, rx: trx });
    const k = snap || this.s.phase === 'swap' ? 1 : 1 - Math.exp(-dt * 2.5);
    sm.x += (tx - sm.x) * k; sm.y += (ty - sm.y) * k; sm.rx += (trx - sm.rx) * k;
    const cx = sm.x, cy = sm.y, rx = sm.rx, ry = rx * 0.69;
    const p = this.place;
    if (Math.abs(p.x - cx) < 0.5 && Math.abs(p.y - cy) < 0.5 && Math.abs(p.rx - rx) < 0.5) return;
    Object.assign(p, { x: cx, y: cy, rx, ry });
    const $ = this.$;
    $.rings.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
    for (const el of [$.gold, $.pink]) {
      el.style.width = (2 * rx).toFixed(1) + 'px'; el.style.height = (2 * ry).toFixed(1) + 'px';
      el.style.left = (-rx).toFixed(1) + 'px'; el.style.top = (-ry).toFixed(1) + 'px';
    }
    const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (document.documentElement.getAttribute('data-theme') !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const a = dark ? 0.6 : 0.55, sx = rx * 1.4, sy = ry * 1.65;
    $.dim.style.background = `radial-gradient(ellipse ${sx.toFixed(0)}px ${sy.toFixed(0)}px at ${cx.toFixed(0)}px ${(cy - ry * 0.25).toFixed(0)}px, rgba(12, 6, 24, 0) 55%, rgba(12, 6, 24, ${a}) 100%)`;
    // "Go, <name>!" above the gold ring, never over the banner and "To beat"
    $.prompt.style.top = Math.max(this.minPrompt || 150, cy - ry - 100).toFixed(0) + 'px';
    $.pop.style.top = (cy - ry - 18).toFixed(0) + 'px';
  }

  // (test hook) the show now: its phase, act, the ring's start (performance.now() ms), the grades and the taps
  info() {
    const s = this.s;
    if (!s) return { on: false, last: this.last ? { won: this.last.res.won, score: this.last.res.score, place: this.last.res.place, cheers: this.last.res.cheers, grades: this.last.res.acts.map(a => a.cheer), given: this.last.given, taps: this.last.taps, skipped: this.last.skipped, seconds: this.last.seconds } : null };
    return { on: true, phase: s.phase, act: s.act, t: s.t, ringT0: s.ring ? s.ring.t0 : null, graded: s.ring ? s.ring.graded : null, grades: [...s.grades], taps: s.taps.map(t => [...t]), reduced: s.reduced, beat: C.cheer.beat, window: C.cheer.window, place: { ...this.place } };
  }
}
