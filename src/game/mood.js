// The slime's moment to moment life at home: the tutorial hint, idle moments, its face, where it looks and how it sways.
// A part of Game (src/mixin.js): `this` is the Game.
import * as THREE from 'three';
import { HELPERS } from '../data/content.js';
import { clamp } from './shared.js';

export class MoodPart {
  // ---------- per-frame ----------
  updateTutorial() {
    const st = this.state;
    const name = this.Name;
    const mobile = window.matchMedia('(max-width: 860px)').matches;
    if (st.tutorial === 0 && st.stats.boops >= 5) st.tutorial = 1;
    if (st.tutorial === 1 && st.stats.feeds >= 1) st.tutorial = 2;
    if (st.tutorial === 2 && st.stats.petTime >= 1.2) st.tutorial = 3;
    if (st.tutorial === 3 && Object.values(st.helpers).some(n => n > 0)) st.tutorial = 4;
    let hint = null;
    if (this.requests.active) hint = null;
    else if (st.tutorial === 0) hint = `Boop ${name} to collect jelly`;
    else if (st.tutorial === 1) hint = st.jelly >= this.sim.foodPrice('cookie') ? `${name} looks hungry. Drag a Cookie onto them, or tap it` : `Boop a little more to afford a Cookie`;
    else if (st.tutorial === 2) hint = `Hold and stroke ${name} to pet them`;
    else if (st.tutorial === 3) hint = st.jelly >= HELPERS[0].cost ? (mobile ? 'Open the Shop below and buy a Tickle Feather' : 'Buy a Tickle Feather in the Shop') : `Save ${HELPERS[0].cost} jelly for your first helper`;
    // (a low tummy shows as the "Hungry!" bubble by the slime and a pulsing ring, no hint needed)
    else if (this.sim.asleep) hint = `${name} is napping. Helpers gather extra dream jelly`;
    this.hud.setHint(hint);
  }

  updateIdle(dt) {
    const s = this.state.slime;
    this.idleT -= dt;
    if (this.idleT > 0) return;
    this.idleT = 4 + Math.random() * 6;
    if (this.busy() || this.sim.asleep || this.sim.dizzy > 0 || this.press || this.bubbleGame || this.transient && this.transient.until > this.time || this.movingDay.active) return;
    const p = s.personality;
    const bond = this.sim.bondLevel();
    const pointerNear = this.time - this.lastPointerMove < 2 && this.pointerWorld.distanceTo(this.slime.centerWorld(this.v1)) < 2.4;
    const opts = [
      [0.6 + p.playful / 50, () => { this.slime.hop(3 + p.playful / 40); this.sfx.bounce(); }],
      [0.5 + p.curious / 50, () => { this.lookOverride = { target: new THREE.Vector3((Math.random() - 0.5) * 8, 0.5 + Math.random() * 2.5, 1 + Math.random() * 2), until: this.time + 1.4 }; if (Math.random() < 0.4) this.sfx.question(); }],
      [0.4, () => { this.slime.kick(0.04); this.flash({ eyes: 'happy', mouth: 'cat' }, 0.8); }],
    ];
    if (s.energy < 35) opts.push([2, () => { this.flash({ eyes: 'sleep', mouth: 'yawn' }, 1.3); this.sfx.yawn(); }]);
    if (s.tummy < 20) opts.push([2, () => { this.flash({ eyes: 'normal', mouth: 'drool' }, 1.6); this.hud.say('...hungry', 1400); this.sfx.sad(); }]);
    if (bond >= 6 && s.joy > 70) opts.push([0.6, () => { this.sfx.hum(); this.fx.emit('notes', this.slime.headTopWorld(this.v1), { count: 2 }); this.flash({ eyes: 'happy', mouth: 'o' }, 1.2); }]);
    if (bond >= 5 && pointerNear) opts.push([0.8, () => { this.flash({ eyes: 'wink', mouth: 'kiss', blush: 1 }, 1.1); this.sfx.kiss(); this.fx.emit('hearts', this.slime.mouthWorld(this.v1), { count: 1, dir: new THREE.Vector3(0, 0.3, 2), size: 0.3 }); }]);
    if (bond >= 4 && pointerNear) opts.push([0.8, () => { this.fx.emit('hearts', this.slime.headTopWorld(this.v1), { count: 2 }); this.flash({ eyes: 'happy', mouth: 'cat', blush: 0.9 }, 1); }]);
    this.behave.idleOptions(opts, pointerNear);
    const total = opts.reduce((t, o) => t + o[0], 0);
    let r = Math.random() * total;
    for (const [w, fn] of opts) { r -= w; if (r <= 0) { fn(); break; } }
  }

  computeExpression() {
    const e = this.slime.expr;
    const s = this.state.slime;
    const sim = this.sim;
    e.eyes = 'normal'; e.mouth = 'smile'; e.mouthOpen = 0; e.blush = 0.35; e.eyeOpen = 1; e.tears = false; e.sweat = false; e.brows = null; e.eyeL = null; e.eyeR = null;
    if (s.joy > 78) { e.mouth = 'cat'; e.blush = 0.5; }
    else if (s.joy > 55) { e.mouth = 'smile'; }
    else if (s.joy > 32) { e.mouth = 'flat'; e.blush = 0.2; }
    else { e.mouth = 'frown'; e.brows = 'sad'; e.blush = 0.1; if (s.joy < 16) e.tears = true; }
    if (s.tummy < 15) e.mouth = 'drool';
    if (s.energy < 25) e.eyeOpen = 0.6;
    const req = this.requests.active;
    if (req) {
      if (req.waiting) { e.brows = 'determined'; e.mouth = 'pout'; }
      else if (req.type === 'sleepy') { e.eyeOpen = 0.5; e.mouth = 'o'; }
      else { e.eyes = 'sparkle'; e.mouth = 'o'; e.blush = 0.6; }
    }
    if (this.glimmer && this.glimmer.watch) { e.eyes = 'sparkle'; e.mouth = 'o'; }
    if (this.held || this.flying) {
      const id = (this.held || this.flying).id;
      const obj = (this.held || this.flying).obj;
      const d = obj.position.distanceTo(this.slime.mouthWorld(this.v2));
      const near = clamp(1 - (d - 0.4) / 2.2, 0, 1);
      if (s.tummy >= 97) { e.mouth = 'flat'; e.sweat = true; }
      else if (id === s.favorite) { e.eyes = 'sparkle'; e.mouth = 'open'; e.blush = 0.9; e.mouthOpen = 0.35 + near * 0.6; }
      else if (id === s.dislike) { e.eyes = 'normal'; e.mouth = 'wavy'; e.sweat = near > 0.4; e.brows = 'sad'; }
      else { e.eyes = 'wide'; e.mouth = 'o'; e.mouthOpen = near > 0.5 ? (near - 0.5) * 1.4 : 0; }
    }
    if (sim.fever) { e.eyes = 'happy'; e.mouth = 'grin'; e.blush = 0.85; }
    if (this.petActive) { e.eyes = 'happy'; e.mouth = 'cat'; e.blush = 0.95; }
    if (sim.dizzy > 0) { e.eyes = 'dizzy'; e.mouth = 'wavy'; e.blush = 0.2; e.sweat = true; e.brows = null; }
    if (sim.asleep) { e.eyes = 'sleep'; e.mouth = this.petActive ? 'cat' : 'o'; e.blush = this.petActive ? 0.8 : 0.4; e.mouthOpen = 0; e.brows = null; e.tears = false; }
    if (!sim.asleep) this.behave.applyExpression(e);
    if (!sim.asleep) this.movingDay.applyExpression(e);
    if (this.transient && this.transient.until > this.time) Object.assign(e, this.transient.expr);
    if (this.eating || this.chompOpen > 0) e.mouthOpen = Math.max(e.mouthOpen, this.chompOpen);
    if (this.state.phase === 'egg') { e.eyes = 'sleep'; }
  }

  computeLook() {
    const sl = this.slime;
    let target = null;
    if (this.lookOverride && this.lookOverride.until > this.time) target = this.lookOverride.target;
    else if (this.held) target = this.held.obj.position;
    else if (this.flying) target = this.flying.obj.position;
    else if (this.eating) target = null;
    else if (this.sim.asleep) target = null;
    else if (this.glimmer && this.glimmer.watch) target = this.glimmer.obj.position;
    else if (this.bubbleGame && this.helpers3d.bubbles.length) {
      const c = sl.centerWorld(this.v1);
      let best = null, bd = Infinity;
      for (const b of this.helpers3d.bubbles) { const d = b.m.position.distanceTo(c); if (b.game && d < bd) { bd = d; best = b; } }
      target = best ? best.m.position : null;
    } else if (this.time - this.lastPointerMove < 2.5 || this.sim.bondLevel() >= 1) target = this.pointerWorld;
    sl.lookTarget = target;
  }

  computeMotion() {
    const sl = this.slime;
    const t = this.time;
    let lx = 0, lz = 0, roll = 0;
    if (this.state.helpers.musicbox > 0 && !this.sim.asleep && !this.reduced) lx += Math.sin(t * 1.6) * 0.05;
    if (this.petActive && this.press) lx += clamp(this.press.dir * 0.18, -0.16, 0.16);
    else if (this.sim.bondLevel() >= 2 && !this.sim.asleep && this.time - this.lastPointerMove < 2) {
      const c = sl.centerWorld(this.v1);
      const dx = this.pointerWorld.x - c.x, dy = this.pointerWorld.y - c.y;
      if (Math.hypot(dx, dy) < 2.6) { lx += clamp(dx * 0.05, -0.08, 0.08); lz += 0.05; }
    }
    if (this.danceUntil > t) { lx += Math.sin(t * 9) * 0.13; if (Math.random() < 0.02) sl.hop(3.5); }
    if (this.sim.fever && !this.reduced) lx += Math.sin(t * 12) * 0.04;
    if (this.sim.dizzy > 0) { lx += Math.sin(t * 7) * 0.12; roll = Math.sin(t * 5) * 0.12; }
    const req = this.requests.active;
    if (req && !req.waiting) roll += 0.1;
    sl.leanX.target = lx;
    sl.leanZ.target = lz;
    sl.roll.target = roll;
    this.behave.applyMotion();
    this.movingDay.applyMotion();
    if (this.sim.asleep) { sl.breathAmp = 0.04; sl.breathRate = 1.3; }
    else if (this.sim.fever) { sl.breathAmp = 0.03; sl.breathRate = 5; }
    else { sl.breathAmp = 0.022; sl.breathRate = this.state.slime.energy < 25 ? 1.5 : 2.1; }
    if (!this.petActive && sl.emissiveBoost > 0 && !this.eating) sl.emissiveBoost *= 0.95;
  }
}
