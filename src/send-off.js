// The send-off (moving to the ranch, and a baby's new home): the travel bubble. game.js depart() starts it after the
// hearts and the say line, and calls update(dt) every frame of the goodbye; the white fade and the rule stay in
// depart() (their times are SENDOFF.fade and SENDOFF.rule). One path for both: a baby waves toward where its new family
// waits and drifts a little toward that side as it floats (side: +1, the side depart() looks toward).
//   wave -> a bubble grows around it -> it lifts off the cushion -> floats up and out of the picture with a trail of
//   sparkles. Each frame of the float the rule in view/bubble-math.js runs with the live camera (it can be turned
//   during the goodbye): once it has left the picture it is gone; if it would be seen meeting the room (the Greenhouse
//   roof, a wall, the lantern) or come near the camera while still in the picture, it pops in a burst of sparkles at
//   the last spot that keeps the gap. Reduced motion: no float; the bubble forms, glows and fades out in place.
import * as THREE from 'three';
import { SENDOFF, GREENHOUSE } from './data/content.js';
import { TravelBubble } from './view/travel-bubble.js';
import { bubbleSize, bubbleBottom, growAt, floatAt, framePlanes, floatFrame, popSwell, greenhouseRoom, OPEN_SKY } from './view/bubble-math.js';

const S = SENDOFF;
const TRAIL = ['#fff3b0', '#ffd1ec', '#c9f3ff', '#e2d4ff'];
const ease = p => p * p * (3 - 2 * p);

export class SendOff {
  constructor(game) {
    this.g = game;
    this.bubble = new TravelBubble(game.scene);
    this.s = null;
    this._m = new THREE.Matrix4();
    this._box = new THREE.Box3();
    this._v = new THREE.Vector3();
  }
  get on() { return !!this.s; }

  // From depart(), at the goodbye's start (the slime on the cushion at x = z = 0). baby: a baby's new home.
  start({ baby = false } = {}) {
    const g = this.g, sl = g.slime, root = sl.root;
    // the slime's own size (its body, ears, curl, hat... not its shadow), for the bubble that holds it
    sl.root.updateMatrixWorld(true);
    const box = this._box.makeEmpty();
    sl.body.traverseVisible(o => { if (o.isMesh && o !== sl.shadow && o.geometry) box.expandByObject(o, true); });
    const base = root.position.y;
    const a = Math.max(0.2, -box.min.x, box.max.x, -box.min.z, box.max.z), h = Math.max(0.3, box.max.y - base);
    const { r, lift } = bubbleSize(a, h), bottom = bubbleBottom(base, r);
    this.s = {
      t: 0, baby, side: baby ? 1 : 0, r, lift, base, bottom, a, h, step: 'wait', why: null, popT: null, trailT: 0, faded: null,
      c: [root.position.x, bottom + r, root.position.z], c0: null, toward: [0, 1], rNow: 0,
      room: g.home && g.home.inRoom ? greenhouseRoom(g.home.room.meta, GREENHOUSE.roof) : OPEN_SKY,
      reduced: g.reduced, log: [],
    };
    this.bubble.setQuality(g.resolvedQuality());
    // the wave: the nub a baby always waved with (a grown slime waves too), back in before the bubble closes
    sl.nub('wave', new THREE.Vector3(0.9, 0.32, 0.3), baby ? 0.46 : 0.42, { wave: 0.45, snap: 3 });
    g.after(S.wave[1], () => sl.nubIn('wave'));
    g.after(S.grow[0], () => { if (this.s) { this.s.step = 'grow'; this.bubble.show(true); g.sfx.wobble && g.sfx.wobble(); } });
  }

  update(dt) {
    const s = this.s;
    if (!s) return;
    const g = this.g, sl = g.slime, root = sl.root;
    s.t += dt;
    const t = s.t;
    this.bubble.update(dt, s.reduced);
    if (s.step === 'wait' || s.step === 'gone') return;
    const wob = s.reduced ? 0 : S.wobble;
    if (s.step === 'grow') {
      const k = (t - S.grow[0]) / S.grow[1];
      s.rNow = growAt(k, s.r, Math.min(s.a, s.h / 2) * 0.85);
      // its bottom stays just over the cushion; the slime lifts with it onto the bubble's floor
      const up = (s.bottom - s.base + s.lift) * ease(Math.min(1, Math.max(0, k)));
      s.c[1] = s.bottom + s.rNow;
      root.position.y = s.base + up;
      sl.shadowFade = 1 - 0.4 * Math.min(1, Math.max(0, k));
      this.bubble.set(s.c, s.rNow, { alpha: Math.min(1, Math.max(0, k) * 1.6), wob });
      if (k >= 1 && !s.ring) { s.ring = true; g.fx.emit('prism', this._v.set(s.c[0], s.c[1], s.c[2]), { count: 10, speed: s.r * 1.6, up: 0.2, gravity: 0, life: 0.6 }); g.sfx.sparkle(); }
      if (t >= S.lift) {
        if (s.reduced) { s.step = 'still'; return; }
        s.step = 'float';
        s.c0 = [...s.c];
        const cam = g.stage.camera.position, dx = cam.x - s.c[0], dz = cam.z - s.c[2], l = Math.hypot(dx, dz) || 1;
        s.toward = [dx / l, dz / l];
        g.flash({ eyes: 'sparkle', mouth: 'open', blush: 0.9 }, 3);
        g.sfx.whee ? g.sfx.whee() : g.sfx.sparkle();
      }
      return;
    }
    if (s.step === 'still') {   // Reduced motion: it glows, then the bubble and the slime fade out where they are
      const R = S.reduced, glow = Math.min(1, Math.max(0, (t - R.glow) / 0.6)), out = Math.min(1, Math.max(0, (t - R.fade[0]) / R.fade[1]));
      this.bubble.set(s.c, s.r, { alpha: 1 - out, glow, wob: 0 });
      this.fadeSlime(1 - out);
      sl.shadowFade = 0.6 * (1 - out);
      if (out >= 1) { s.step = 'gone'; this.bubble.show(false); root.visible = false; }
      return;
    }
    if (s.step === 'float') {
      const tf = t - S.lift, o = { toward: s.toward, side: s.side };
      const path = u => { const f = floatAt(u, o); return [s.c0[0] + f[0], s.c0[1] + f[1], s.c0[2] + f[2]]; };
      const cam = g.stage.camera;
      cam.updateMatrixWorld();
      const planes = framePlanes(this._m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).elements);
      const st = floatFrame(planes, [cam.position.x, cam.position.y, cam.position.z], path, s.r, s.room, s.tf || 0, tf);
      s.tf = tf;
      s.c = st.c;
      this.place(s.c, s.r, wob);
      if (st.step === 'out') { s.step = 'gone'; s.why = 'out'; this.bubble.show(false); root.visible = false; return; }
      if (st.step === 'pop') { s.step = 'pop'; s.why = st.why; s.popT = t; s.swell = popSwell(s.r); this.burst(st.why !== 'time'); return; }
      // a trail of sparkles behind it
      s.trailT -= dt;
      if (s.trailT <= 0) {
        s.trailT = S.trail;
        const p = this._v.set(s.c[0] + (Math.random() - 0.5) * s.r * 0.8, s.c[1] - s.r * 0.85, s.c[2] + (Math.random() - 0.5) * s.r * 0.5);
        g.fx.emit('glints', p, { color: TRAIL[(Math.random() * TRAIL.length) | 0], count: 1, speed: 0.25, up: -0.15, life: 0.7 });
      }
      return;
    }
    if (s.step === 'pop') {   // it swells and fades; the slime shrinks into the sparkles
      const k = Math.min(1, (t - s.popT) / S.popTime);
      this.bubble.set(s.c, s.r * (1 + s.swell * k), { alpha: 1 - k, wob: 0 });
      root.scale.setScalar(Math.max(0.001, 1 - ease(k)));
      if (k >= 1) { s.step = 'gone'; this.bubble.show(false); root.visible = false; }
    }
  }

  // the bubble at c, and the slime inside it on the bubble's floor
  place(c, r, wob) {
    const root = this.g.slime.root, s = this.s;
    root.position.set(c[0], c[1] - r + s.lift, c[2]);
    this.g.slime.shadowFade = 0;
    this.bubble.set(c, r, { alpha: 1, wob });
  }
  // a happy pop: a burst of sparkles where it is (near the room they spread less and drift down, away from it)
  burst(near) {
    const g = this.g, s = this.s, p = new THREE.Vector3(...s.c), k = near ? 0.75 : 1, up = near ? -0.5 : 0.1;
    g.fx.emit('prism', p, { count: 26, speed: 1.4 * k, up, gravity: near ? 1.2 : 0.2, life: 0.9 });
    g.fx.emit('sparkles', p, { count: 20, color: '#fff3b0', speed: 1.2 * k, up, gravity: near ? 1.2 : 0.2 });
    g.fx.emit('pop', p, { count: 12, speed: s.r * 2.2 * k, life: 0.3 });
    g.sfx.pop(); g.after(0.06, () => g.sfx.sparkle());
  }
  // Reduced motion: every material of the slime fades (the page reloads after, nothing to put back)
  fadeSlime(k) {
    this.g.slime.root.traverse(o => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        if (m.userData.sendOff === undefined) { m.userData.sendOff = m.opacity; if (!m.transparent) { m.transparent = true; m.needsUpdate = true; } }
        m.opacity = m.userData.sendOff * k;
      }
    });
  }
  // (tests) where it is now
  info() {
    const s = this.s;
    if (!s) return null;
    return { t: +s.t.toFixed(3), step: s.step, why: s.why, c: s.c.map(v => +v.toFixed(3)), r: +(s.step === 'grow' ? s.rNow : s.r).toFixed(3), lift: s.lift, a: +s.a.toFixed(3), h: +s.h.toFixed(3),
      toward: s.toward.map(v => +v.toFixed(3)), shown: this.bubble.group.visible, passes: this.bubble.passes(), slime: this.g.slime.root.visible, popT: s.popT };
  }
}
