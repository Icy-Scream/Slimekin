// Bubble play (from a request) and the Lucky Glimmer that flies by. A part of Game (src/mixin.js): `this` is the Game.
import * as THREE from 'three';
import { TUNING } from '../data/content.js';
import { fmt } from '../core/format.js';
import { clamp } from './shared.js';

export class PlayPart {
  // ---------- bubbles ----------
  startBubblePlay() {
    this.bubbleGame = { t: 0, popped: 0, total: 6 };
    const c = this.slime.centerWorld(new THREE.Vector3());
    for (let i = 0; i < 6; i++) this.after(i * 0.22, () => this.helpers3d.spawnBubble(true, c));
    this.hud.say('Pop them!', 1500);
    this.flash({ eyes: 'sparkle', mouth: 'open', blush: 0.8 }, 1.4);
    this.slime.hop(4);
    this.sfx.mii();
  }

  popBubble(b) {
    this.helpers3d.popBubble(b);
    this.sfx.pop();
    this.lastInteract = this.time;
    const gain = b.game ? Math.max(this.sim.boopValue() * 4, this.sim.jps() * 3) : this.sim.boopValue();
    this.sim.addJelly(gain);
    this.hud.floatText(this.pointerPx.x, this.pointerPx.y - 10, '+' + fmt(gain));
    this.lookOverride = { target: b.m.position.clone(), until: this.time + 0.6 };
    if (b.game && this.bubbleGame) {
      this.bubbleGame.popped++;
      this.slime.hop(3);
      this.sfx.giggle();
      this.flash({ eyes: 'happy', mouth: 'grin', blush: 0.8 }, 0.6);
      if (this.bubbleGame.popped >= this.bubbleGame.total) this.finishBubbleGame(true);
    }
  }

  finishBubbleGame(all) {
    if (!this.bubbleGame) return;
    this.bubbleGame = null;
    const s = this.state.slime;
    s.joy = clamp(s.joy + (all ? 10 : 5), 0, 100);
    const b = this.sim.addBond(all ? 4 : 2);
    if (b) this.onBondUp(b);
    this.hud.say(all ? 'Again! Again!' : 'That was fun!', 1600);
    this.sfx.coo();
    if (all) this.remember('🫧', `You popped every bubble with ${this.Name}.`, 'bubbles-all');
  }

  // ---------- glimmers ----------
  spawnGlimmer() {
    if (this.glimmer) return;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 2), new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#ffbf2e', emissiveIntensity: 1.6, roughness: 0.3 })));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.helpers3d.glowTex, color: '#ffd76a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(1.2);
    g.add(glow);
    const side = Math.random() < 0.5 ? -1 : 1;
    const y = 1.1 + Math.random() * 1.0;
    const path = [new THREE.Vector3(side * 5.5, y, 0.6), new THREE.Vector3(side * 1.5, y + 1.4, 2.2), new THREE.Vector3(-side * 1.5, y + 0.4, 1.8), new THREE.Vector3(-side * 5.5, y + 0.8, 0.4)];
    this.scene.add(g);
    this.glimmer = { obj: g, t: 0, dur: 14, path, trail: 0 };
    const curious = this.state.slime.personality.curious;
    this.glimmer.watch = Math.random() < 0.5 + curious / 150;
    if (this.glimmer.watch && !this.sim.asleep) this.after(0.8, () => { if (this.glimmer) { this.hud.say('!', 900); this.sfx.question(); } });
  }

  updateGlimmer(dt) {
    if (!this.glimmer) {
      if (this.state.phase === 'play' && this.state.tutorial >= 2) {
        this.glimmerT -= dt * this.sim.fx.glimmerRate;
        if (this.glimmerT <= 0) {
          this.glimmerT = TUNING.glimmerEvery[0] + Math.random() * (TUNING.glimmerEvery[1] - TUNING.glimmerEvery[0]);
          this.spawnGlimmer();
        }
      }
      return;
    }
    const gl = this.glimmer;
    gl.t += dt / gl.dur;
    const t = clamp(gl.t, 0, 1), u = 1 - t, p = gl.path;
    const pos = new THREE.Vector3()
      .addScaledVector(p[0], u * u * u).addScaledVector(p[1], 3 * u * u * t)
      .addScaledVector(p[2], 3 * u * t * t).addScaledVector(p[3], t * t * t);
    pos.y += Math.sin(this.time * 3) * 0.12;
    gl.obj.position.copy(pos);
    gl.obj.rotation.y += dt * 2;
    gl.obj.children[1].material.opacity = 0.7 + 0.3 * Math.sin(this.time * 8);
    gl.trail -= dt;
    if (gl.trail <= 0) { gl.trail = 0.07; this.fx.emit('glints', pos, {}); }
    if (gl.t >= 1) { this.scene.remove(gl.obj); this.glimmer = null; }
  }

  catchGlimmer() {
    const gl = this.glimmer;
    if (!gl) return;
    this.scene.remove(gl.obj);
    this.glimmer = null;
    const pos = gl.obj.position;
    this.fx.emit('sparkles', pos, { count: 24, speed: 3, color: '#ffe08a' });
    this.sfx.sparkle();
    this.after(0.15, () => this.sfx.giggle());
    const st = this.state;
    st.stats.glimmers++;
    const roll = Math.random();
    const jps = this.sim.jps(), bv = this.sim.boopValue();
    let msg;
    if (roll < 0.45) {
      this.sim.addBuff({ id: 'rush', name: 'Jelly Rush', dur: 30, jpsMult: 5 });
      msg = '<b>Jelly Rush!</b>Jelly per second x5 for 30 seconds.';
    } else if (roll < 0.82) {
      const amt = (Math.max(bv * 25 + 10, Math.min(st.jelly * 0.15, jps * 600) + jps * 30)) * this.sim.fx.glimmerMult;
      this.sim.addJelly(amt);
      msg = `<b>Lucky!</b>+${fmt(amt)} jelly.`;
      this.hud.floatText(this.pointerPx.x, this.pointerPx.y - 20, '+' + fmt(amt), 'big');
    } else {
      this.sim.addBuff({ id: 'sugar', name: 'Sugar Rush', dur: 15, boopMult: 7 });
      msg = '<b>Sugar Rush!</b>Boops give x7 for 15 seconds. Boop away!';
    }
    this.hud.toast(msg, 'combo', 3600);
    if (!this.sim.asleep) {
      this.flash({ eyes: 'sparkle', mouth: 'grin', blush: 1 }, 1.4);
      this.slime.hop(5);
      this.hud.say('Yay!', 1000);
    }
    this.remember('✨', `You caught a Lucky Glimmer while ${this.Name} cheered.`, 'glimmer1');
    this.markDirty(true);
  }
}
