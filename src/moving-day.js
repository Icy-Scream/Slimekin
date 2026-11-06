// Moving Day signs (MOVING_DAY in content.js; the math is in core/movingday.js). Now and then a grown slime shows,
// in its own way, that it is ready to leave the nest: one small behavior per personality lean, built from what the
// avatar already does (turning, gaze, hops, little hands, hums, hearts). Never while asleep, at the ranch, as an egg,
// or during another behavior; never sad; no text, no numbers; nothing changes if ignored. At "very ready" a tiny
// travel bundle sometimes sits by the cushion. Tester buttons (#debug) play each sign now: play(id), showBundle().
import * as THREE from 'three';
import { MOVING_DAY, FOOD_BY_ID } from './data/content.js';
import { movingDayRatio, movingDayLevel, movingDaySign } from './core/movingday.js';
import { RANCH_POS, RANCH_TOP } from './view/ranch.js';
import { CUSHION_TOP } from './view/stage.js';
import { makeFood } from './view/models.js';
import { makeTravelBundle } from './view/travel-bundle.js';

const rnd = ([a, b]) => a + Math.random() * (b - a);
const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// 0 -> 1 between a and b (eased)
const ramp = (t, a, b) => smooth((t - a) / (b - a));

export class MovingDay {
  constructor(game) {
    this.g = game;
    this.active = null;
    this.level = null;
    this.timer = rnd(MOVING_DAY.firstDelay);
    this.calmT = 0;
    this.off = new THREE.Vector2();          // where the sign has moved the slime (x, z), eased back to 0 after
    this.hill = new THREE.Vector3(RANCH_POS.x, RANCH_TOP + 0.8, RANCH_POS.z);   // even when Classic hides the hill
    this.v = new THREE.Vector3();
    this.bundle = null;
    this.bundleT = 0;
    this.bundleK = 0;
    this.played = 0;   // signs played this session, and the last one (for tests)
    this.last = null;
  }

  ratio() { return movingDayRatio(this.g.state); }
  signFor() { return movingDaySign(this.g.state.slime.personality); }

  // Nothing else going on at home: awake, not touched or fed lately, no card, request, game, trick or goodbye.
  calm() {
    const g = this.g, sim = g.sim, b = g.behave;
    return g.state.phase === 'play' && g.view !== 'ranch' && !sim.asleep && sim.dizzy <= 0 && !g.busy() && !g.press && !g.hud.modalOpen &&
      !g.departing && !g.hatching && !g.bubbleGame && !g.requests.active && !(g.glimmer && g.glimmer.watch) &&
      !(g.transient && g.transient.until > g.time) && !(g.lookOverride && g.lookOverride.until > g.time) &&
      b.emoteBusy < g.time && !b.highFive && !b.hiccups && b.melting < g.time && b.peekUntil < g.time && b.singUntil < g.time &&
      b.shake.until < g.time && !(g.danceUntil > g.time) && g.time - g.lastInteract > 3;
  }
  // Something else started (a touch, a snack, a nap, a card...): the sign stops and the slime eases back.
  interrupted() {
    const g = this.g;
    return g.state.phase !== 'play' || g.view === 'ranch' || g.sim.asleep || !!g.press || g.busy() || g.hud.modalOpen || !!g.departing || !!g.bubbleGame || !!g.requests.active ||
      g.behave.emoteBusy > g.time;
  }

  update(dt) {
    const g = this.g, sl = g.slime;
    this.updateBundle(dt);
    if (this.active) {
      if (this.interrupted() && !this.active.forced) this.stop();
      else this.step(dt);
    }
    // the slime eases back to the middle of the cushion when a sign is over
    if (!this.active && (Math.abs(this.off.x) > 1e-3 || Math.abs(this.off.y) > 1e-3)) this.off.multiplyScalar(Math.exp(-dt * 4));
    if (!g.departing && (this.active || this.off.lengthSq() > 1e-6)) { sl.root.position.x = this.off.x; sl.root.position.z = this.off.y; }
    if (this.active) return;

    // when is the next sign? (counts only while you're home with an awake slime)
    const lvl = movingDayLevel(this.ratio());
    if (!lvl) { this.level = null; this.timer = Math.max(this.timer, rnd(MOVING_DAY.firstDelay)); return; }
    if (!this.level) this.timer = rnd(MOVING_DAY.firstDelay);
    else if (lvl.at > this.level.at) this.timer = Math.min(this.timer, rnd(lvl.every));
    this.level = lvl;
    if (g.view === 'ranch' || g.sim.asleep) return;
    this.timer -= dt;
    this.calmT = this.calm() ? this.calmT + dt : 0;
    if (this.timer > 0 || this.calmT < 1.5) return;
    this.timer = rnd(lvl.every);
    this.play(this.signFor());
    if (lvl.bundle && Math.random() < lvl.bundle) this.showBundle();
  }

  // ---------- playing a sign ----------
  play(id, { forced = false } = {}) {
    const def = MOVING_DAY.signs[id];
    if (!def) return false;
    if (this.active) this.stop();
    const sl = this.g.slime;
    this.played++; this.last = id;
    this.active = { id, def, t: 0, side: Math.random() < 0.5 ? -1 : 1, done: new Set(), expr: null, lean: 0, bias: 0, forced, food: null };
    sl.turnRate = 3;
    return true;
  }
  stop() {
    const a = this.active, sl = this.g.slime;
    if (!a) return;
    this.active = null;
    sl.turnTarget = 0; sl.turnRate = 3;
    for (const n of ['mdPoint', 'mdOffer', 'mdPat']) sl.nubIn(n);
    if (a.food) { this.g.scene.remove(a.food); a.food = null; }
  }
  once(key, fn) { const a = this.active; if (a && !a.done.has(key)) { a.done.add(key); fn(); } }
  lookHill(sec = 0.3) { const g = this.g; g.lookOverride = { target: this.hill, until: g.time + sec }; }
  lookAt(v, sec = 0.3) { const g = this.g; g.lookOverride = { target: v, until: g.time + sec }; }
  turn(angle, rate = 3) { const sl = this.g.slime; sl.turnTarget = angle; sl.turnRate = rate; }

  step(dt) {
    const a = this.active, g = this.g, sl = g.slime, d = a.def, t = (a.t += dt), s = a.side;
    a.expr = null; a.lean = 0; a.bias = 0;
    const fx = g.fx, sfx = g.sfx;
    switch (a.id) {
      case 'curious': {   // keeps gazing at the ranch hill and wiggles toward it
        if (t < d.dur - 0.9) { this.turn(s * d.turn, 3); this.lookHill(); a.expr = { eyes: 'sparkle', mouth: 'o', blush: 0.6 }; } else this.turn(0, 3);
        this.once('q', () => g.after(0.8, () => sfx.question()));
        for (let i = 0; i < d.wiggles; i++) if (t > 1.5 + i * 0.8) this.once('w' + i, () => { sl.leanZ.v += 2.4; sl.roll.v += s * 1.6; sl.squish(0.35); });
        break;
      }
      case 'familiar': {  // tidies its cushion, then glances at the hill
        for (let i = 0; i < d.pats; i++) if (t > 0.25 + i * 0.7) this.once('p' + i, () => {
          const side = i % 2 ? -s : s;
          sl.nub('mdPat', this.v.set(side * 0.8, -0.55, 0.45), 0.3, { snap: 6 });
          g.after(0.25, () => sl.nubIn('mdPat'));
          sl.squish(0.5);
          fx.emit('sparkles', new THREE.Vector3(side * 1.05 + this.off.x, CUSHION_TOP + 0.06, 0.55 + this.off.y), { count: 4, color: '#fff4c8', speed: 0.8 });
          sfx.plip();
        });
        if (t < 0.25 + d.pats * 0.7) a.expr = { eyes: 'happy', mouth: 'cat', blush: 0.6 };
        else if (t < d.dur - 0.8) { this.turn(s * d.turn, 7); this.lookHill(); a.expr = { eyes: 'normal', mouth: 'o' }; }
        else { this.turn(0, 4); this.once('back', () => g.flash({ eyes: 'happy', mouth: 'smile', blush: 0.6 }, 0.8)); }
        break;
      }
      case 'bold': {      // little practice hops toward the edge, then puffs up bravely
        const out = ramp(t, 0.15, 1.6), back = ramp(t, 3.3, d.dur - 0.2);
        const k = Math.min(out, 1 - back);
        this.off.set(s * d.go * k, -d.go * 0.4 * k);
        for (let i = 0; i < d.hops; i++) if (t > 0.15 + i * 0.5) this.once('h' + i, () => { sl.hop(3.2); sfx.bounce(); });
        if (t > 3.35) this.once('hb1', () => sl.hop(3));
        if (t > 3.95) this.once('hb2', () => sl.hop(2.6));
        if (t < 3.2) this.turn(s * d.turn, 4); else this.turn(0, 4);
        if (t > 1.8 && t < 3.1) {
          this.once('puff', () => { sl.stretch(2.2); sl.pulseGlow(0.6); sfx.boing(); });
          this.lookHill();
          a.expr = { eyes: 'sparkle', mouth: 'grin', brows: 'determined', blush: 0.7 };
          a.bias = 0.06;
        }
        break;
      }
      case 'shy': {       // peeks at the hill, then hides toward you
        if (t < 1.5) { this.turn(s * d.turn, 4); this.lookHill(); a.expr = { eyes: 'wide', mouth: 'o', blush: 0.5 }; this.once('peek', () => g.after(0.3, () => sl.stretch(0.9))); }
        else if (t < d.dur - 0.7) {
          this.turn(0, 9);
          this.once('hide', () => { sfx.coo(); sl.hop(2.2); });
          this.lookAt(g.stage.camera.position);
          a.expr = { eyes: 'wince', mouth: 'flat', blush: 1 };
          a.bias = -0.2;
        } else this.once('ok', () => g.flash({ eyes: 'happy', mouth: 'cat', blush: 0.9 }, 0.9));
        const k = Math.min(ramp(t, 1.5, 2.1), 1 - ramp(t, d.dur - 0.8, d.dur));
        this.off.set(0, d.go * k);
        break;
      }
      case 'playful': {   // bounces higher than usual, then stretches toward the hill
        for (let i = 0; i < d.hops; i++) if (t > 0.1 + i * 0.85) this.once('h' + i, () => { sl.hop(d.hop); sfx.bounce(); g.after(0.4, () => sfx.giggle()); });
        if (t > 1.8 && t < d.dur - 0.4) {
          this.turn(s * d.turn, 5);
          this.lookHill();
          a.expr = { eyes: 'sparkle', mouth: 'open', blush: 0.8 };
          this.once('point', () => { sl.nub('mdPoint', this.v.set(0, 0.5, 1), 0.55, { snap: 4 }); sl.stretch(1.2); });
          if (t > d.dur - 0.7) this.once('in', () => sl.nubIn('mdPoint'));
        } else if (t >= d.dur - 0.4) { this.turn(0, 4); sl.nubIn('mdPoint'); }
        break;
      }
      case 'mellow': {    // sits facing the hill, swaying slowly
        if (t < d.dur - 1) {
          this.turn(s * d.turn, 1.6);
          this.lookHill();
          a.lean = Math.sin(t * 1.3) * 0.07 * ramp(t, 0.5, 1.5);
          a.bias = -0.08;
          a.expr = { eyes: 'happy', mouth: 'smile', blush: 0.5 };
        } else this.turn(0, 2.2);
        break;
      }
      case 'cuddly': {    // brings you its favorite snack to share: a thank-you
        const k = Math.min(ramp(t, 0.05, 0.7), 1 - ramp(t, 3.3, d.dur - 0.1));
        this.off.set(0, d.go * k);
        this.once('hop', () => sl.hop(3));
        this.lookAt(g.stage.camera.position);
        if (t > 0.8) this.once('offer', () => {
          // raised beside the face at shoulder height: in front of the face it covered an eye on a big grown slime, and
          // lower down it covered the medal pin (view/medal-pin.js, on the chest to the viewer's right)
          sl.nub('mdOffer', this.v.set(0.7 * s, 0.45, 0.6), 0.45, { snap: 4 });
          const id = FOOD_BY_ID[g.state.slime.favorite] ? g.state.slime.favorite : 'cookie';
          a.food = makeFood(id);
          a.food.scale.setScalar(0.01);
          g.scene.add(a.food);
          sfx.coo();
        });
        if (a.food) {
          const tip = sl.nubTipWorld('mdOffer', this.v);
          if (tip) a.food.position.copy(tip).add(new THREE.Vector3(0.05 * s, 0.06, 0.1));
          a.food.scale.setScalar(Math.min(1.1, 0.01 + (t - 0.8) * 3));
          a.food.rotation.y += dt * 1.5;
        }
        if (t > 1.3) this.once('heart', () => { fx.emit('hearts', sl.headTopWorld(this.v).clone(), { count: 3 }); g.hud.say('♥', 1100); });
        if (t > 2.8) this.once('share', () => {
          if (a.food) { fx.emit('sparkles', a.food.position.clone(), { count: 12, color: '#ffe7a8' }); g.scene.remove(a.food); a.food = null; }
          sl.nubIn('mdOffer'); sfx.pop(); g.after(0.15, () => sfx.giggle());
        });
        a.expr = { eyes: 'happy', mouth: 'grin', blush: 1 };
        break;
      }
      case 'independent': { // wanders a little farther across the cushion, exploring
        const k = Math.min(ramp(t, 0.3, 2.0), 1 - ramp(t, 3.6, d.dur - 0.3));
        this.off.set(s * d.go * k, -0.15 * k);
        for (const [i, at] of [0.4, 1.0, 1.6, 3.8, 4.4].entries()) if (t > at) this.once('h' + i, () => sl.hop(2));
        if (t < 2.0) this.turn(s * 1.3, 3);
        else if (t < 3.6) {
          this.turn(s * 0.5, 3);
          this.lookAt(t < 2.8 ? this.v.set(s * 7, 1.2, -3) : this.v.set(s * 3, 2.6, -12));
          a.expr = { eyes: 'wide', mouth: 'o', blush: 0.4 };
          this.once('q', () => g.after(0.2, () => sfx.question()));
        } else if (t < d.dur - 0.5) this.turn(-s * 1.2, 3);
        else this.turn(0, 4);
        break;
      }
      case 'patient': {   // hums a slow, different tune while looking at the hill
        if (t < d.dur - 0.8) {
          this.turn(s * d.turn, 2.5);
          this.lookHill();
          this.once('hum', () => g.after(0.5, () => sfx.dreamyHum()));
          for (let i = 0; i < 3; i++) if (t > 0.8 + i * 1.0) this.once('n' + i, () => fx.emit('notes', sl.headTopWorld(this.v).clone(), { count: 1, color: ['#b9d4f2', '#d9ccf0', '#bfeedd'][i] }));
          a.expr = { eyes: 'happy', mouth: 'o', mouthOpen: t > 0.5 && t < 3.6 ? 0.15 + 0.2 * Math.abs(Math.sin(t * Math.PI / 0.5)) : 0, blush: 0.5 };
        } else this.turn(0, 3);
        break;
      }
      case 'impulsive': { // a sudden zoomie toward the hill, then comes back a bit sheepish
        const go = ramp(t, 0.1, 0.55), back = ramp(t, 1.0, 2.6);
        this.off.set(0, -d.go * Math.min(go, 1 - back));
        this.once('go', () => { sl.stretch(1.6); sfx.whee(); });
        if (t < 0.9) { this.turn(s * d.turn, 10); this.lookHill(); a.expr = { eyes: 'sparkle', mouth: 'grin', blush: 0.6 }; }
        else { this.turn(0, 4); this.lookAt(g.stage.camera.position); a.expr = { eyes: 'happy', mouth: 'cat', blush: 1 }; }
        if (t > 0.6) this.once('stop', () => sl.squish(0.8));
        if (t > 1.2) this.once('h1', () => sl.hop(2));
        if (t > 1.8) this.once('h2', () => sl.hop(2));
        if (t > 2.7) this.once('gig', () => sfx.giggle());
        break;
      }
    }
    if (t >= d.dur) this.stop();
  }

  // game.computeExpression / computeMotion call these after the personality layer
  applyExpression(e) { if (this.active && this.active.expr) Object.assign(e, this.active.expr); }
  applyMotion() {
    const a = this.active, sl = this.g.slime;
    if (!a) return;
    sl.leanX.target += a.lean;
    sl.sqBias += a.bias;
  }

  // ---------- the travel bundle ("very ready", now and then) ----------
  showBundle() {
    if (!this.bundle) {
      this.bundle = makeTravelBundle();
      this.bundle.rotation.y = -0.9;
      this.bundle.scale.setScalar(0.001);
      this.g.scene.add(this.bundle);
    }
    // on the cushion's front-right edge (the cushion top slopes down to about 0.25 there), clear of a big slime; in the
    // Greenhouse the same spot is on the rug beside the stump
    const home = this.g.home;
    this.bundle.position.set(1.42, home && home.inRoom ? home.groundY(1.42, 1.08) - 0.02 : CUSHION_TOP - 0.06, 1.08);
    this.bundleT = MOVING_DAY.bundleSeconds;
  }
  updateBundle(dt) {
    if (!this.bundle) return;
    this.bundleT -= dt;
    const goal = this.bundleT > 0 && this.g.state.phase === 'play' ? 1 : 0;
    this.bundleK += (goal - this.bundleK) * (1 - Math.exp(-dt * 5));
    const pop = this.bundleK * (1 + Math.sin(Math.min(1, this.bundleK) * Math.PI) * 0.15);
    this.bundle.scale.setScalar(Math.max(0.001, pop));
    this.bundle.rotation.z = Math.sin(this.g.time * 1.6) * 0.03;
    if (goal === 0 && this.bundleK < 0.01) { this.g.scene.remove(this.bundle); this.bundle = null; this.bundleK = 0; }
  }
}
