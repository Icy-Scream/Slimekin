// Boops, petting and naps, a bond level going up, a little dance and the phone's buzz.
// A part of Game (src/mixin.js): `this` is the Game.
import * as THREE from 'three';
import { TUNING, BOND } from '../data/content.js';
import { fmt } from '../core/format.js';
import { esc } from '../ui/esc.js';
import { haptic } from '../platform/index.js';
import { clamp } from './shared.js';

export class CarePart {
  // ---------- boop / pet ----------
  boop(point, region = null) {
    const r = this.sim.boop();
    this.markDirty(false);
    if (r.becameDizzy) {
      this.slime.poke(point, 1.3);
      this.slime.kick(0.07);
      this.sfx.dizzy();
      this.hud.say('@_@ too much!', 1600);
      if (r.firstDizzy) {
        this.remember('💫', `Too many boops at once made ${this.Name} dizzy.`, 'dizzy');
        this.hud.toast(`<b>Whoa, dizzy!</b>Boop in a steady rhythm to keep ${esc(this.Name)} giggling without overdoing it.`, '', 4800);
      }
      return;
    }
    if (r.dizzy) { this.slime.poke(point, 0.5); return; }
    this.slime.poke(point, this.sim.fever ? 1.15 : 1);
    this.sfx.boop(this.sim.fever ? 1.15 : 1);
    this.buzz(8);
    if (this.sim.fever ? Math.random() < 0.5 : Math.random() < 0.12) this.sfx.giggle();
    this.fx.emit('drops', point, { color: this.slimeHex(), count: this.sim.fever ? 7 : 4 });
    if (this.sim.fever) this.fx.emit('sparkles', point, { count: 3, rainbow: true });
    this.hud.floatText(this.pointerPx.x, this.pointerPx.y - 10, '+' + fmt(r.gain), this.sim.fever ? 'big' : '');
    this.flash({ eyes: this.sim.fever ? 'happy' : 'wince', mouth: this.sim.fever ? 'grin' : 'open', blush: 0.7 }, this.sim.fever ? 0.5 : 0.14);
    if (Math.random() < 0.25) this.helpers3d.cheer();
    if (r.bondUp) this.onBondUp(r.bondUp);
    if (r.exhausted) this.after(0.3, () => this.fallAsleep('exhausted'));
    if (this.state.stats.boops === 1) this.remember('👆', `First boop! ${this.Name} giggled.`, 'boop1');
    if (this.state.stats.boops === 1000) this.remember('👆', `A thousand boops together.`, 'boop1000');
    this.behave.onBoop(point, region, r);
  }

  updatePetting(dt) {
    const p = this.press;
    const active = !!(p && p.petting && p.over && this.time - p.lastMoveT < 0.22);
    this.petActive = active;
    if (!active) { this.sfx.purr(false); return; }
    const r = this.sim.pet(dt);
    if (this.sim.asleep) {
      this.sim.addBond(0.15 * dt);
      this.heartT -= dt;
      if (this.heartT <= 0) { this.heartT = 0.6; this.fx.emit('hearts', this.slime.headTopWorld(this.v1), { count: 1, size: 0.16 }); }
      return;
    }
    this.sfx.purr(true);
    this.petAccum += r.gain;
    this.petTextT -= dt;
    if (this.petTextT <= 0 && this.petAccum > 0) {
      this.petTextT = 0.5;
      this.hud.floatText(this.pointerPx.x, this.pointerPx.y - 26, '+' + fmt(this.petAccum));
      this.petAccum = 0;
    }
    this.heartT -= dt;
    if (this.heartT <= 0) {
      this.heartT = 0.32;
      const h = this.slime.headTopWorld(this.v1);
      h.x += (Math.random() - 0.5) * 0.8 * this.slime.size;
      this.fx.emit('hearts', h, { count: 1 });
    }
    if (this.sim.bondLevel() >= 7) this.slime.emissiveBoost = 0.12;
    if (r.bondUp) this.onBondUp(r.bondUp);
    const req = this.requests.active;
    if (req && req.type === 'pets') {
      req.petProgress += dt;
      if (req.petProgress >= 2) this.fulfillPets();
    }
    if (this.state.stats.petTime > 1 && !this.state.memKeys.includes('pet1')) this.remember('🤲', `${this.Name} melted into their first pets.`, 'pet1');
    this.markDirty(false);
  }

  // ---------- sleep ----------
  fallAsleep(reason) {
    if (this.sim.asleep || this.state.phase !== 'play') return;
    if (this.requests.active) { this.requests.clear(); this.hud.hideAsk(); }
    this.sim.asleep = true;
    this.slime.cap.on = true;
    this.sleepT = 0;
    this.state.stats.naps++;
    this.sfx.yawn();
    this.flash({ eyes: 'sleep', mouth: 'yawn', blush: 0.3 }, 1.2);
    if (reason === 'exhausted') this.hud.say('so... tired...', 1600);
    if (!this.state.memKeys.includes('nap1')) this.remember('🌙', reason === 'tucked' ? `You tucked ${this.Name} in for their first nap.` : `${this.Name} dozed off for their first nap.`, 'nap1');
    this.markDirty(true);
  }

  wakeUp(kind) {
    if (!this.sim.asleep) return;
    if (kind === 'poked' && !this.sim.canWake()) {
      // too sleepy: it rolls over and keeps napping (no spamming a worn-out slime)
      this.slime.squish(0.4);
      this.sfx.grumble();
      this.hud.say(['Zzz... five more minutes...', 'mmmnope... zzz', '*snore*'][Math.floor(Math.random() * 3)], 1500);
      return;
    }
    this.sim.asleep = false;
    this.slime.cap.on = false;
    this.lastInteract = this.time;
    const s = this.state.slime;
    if (kind === 'poked' && s.energy < 60) {
      this.flash({ eyes: 'normal', mouth: 'pout', brows: 'determined', eyeOpen: 0.6 }, 1.8);
      this.sfx.grumble();
      this.hud.say('Hmph...', 1400);
      s.joy = clamp(s.joy - 4, 0, 100);
      this.slime.squish(0.6);
    } else {
      this.flash({ eyes: 'happy', mouth: 'open', blush: 0.6 }, 1.3);
      this.slime.stretch(1.4);
      this.sfx.mii();
      this.hud.say(kind === 'rested' ? 'Mmm, all better!' : '!', 1500);
    }
  }

  updateSleep(dt) {
    const s = this.state.slime;
    if (!this.sim.asleep) {
      const idle = this.time - this.lastInteract;
      if (s.energy <= 0.5) this.fallAsleep('exhausted');
      const night = this.behave.isNight();
      if (s.energy < (night ? 50 : 30) && idle > (night ? 40 : TUNING.autoSleepIdle) && !this.busy() && !this.press) this.fallAsleep('dozed');
      return;
    }
    this.sleepT += dt;
    this.zzzT -= dt;
    if (this.zzzT <= 0) {
      this.zzzT = 1.3;
      const h = this.slime.headTopWorld(this.v1);
      h.x += 0.25 * this.slime.size;
      this.fx.emit('zzz', h, {});
    }
    this.snoreT -= dt;
    if (this.snoreT <= 0) { this.snoreT = 3.2; this.sfx.snore(); }
    if (Math.random() < dt * 0.8) this.fx.emit('dream', this.slime.centerWorld(this.v1).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.4, 0.3)), {});
    if (s.energy >= 99.5 && this.sleepT > 4) this.wakeUp('rested');
  }

  onBondUp(level) {
    const b = BOND[level];
    this.hud.toast(`<b>Bond grew: ${esc(b.title)}</b>${esc(b.unlock || '')}`, 'love', 4200);
    this.fx.emit('hearts', this.slime.headTopWorld(this.v1), { count: 8 });
    this.sfx.sparkle();
    this.remember('❤️', `Your bond grew: ${b.title}.`, 'bond-' + level);
    this.hud.dot('slime');
  }

  dance(sec) { this.danceUntil = this.time + sec; }

  buzz(ms) {
    if (!this.state.settings.sound || this.reduced) return;
    haptic(ms);   // web: navigator.vibrate as before; iPhone app: a light tap
  }
}
