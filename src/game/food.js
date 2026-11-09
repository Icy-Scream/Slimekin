// Snacks: tap or drag one from the tray, the toss, eating (chomp, chew, gulp), what it changes and how the slime reacts.
// A part of Game (src/mixin.js): `this` is the Game.
import * as THREE from 'three';
import { FOOD_BY_ID, STAGES, TRAITS, TRAIT_IDS } from '../data/content.js';
import { fmt } from '../core/format.js';
import { makeFood } from '../view/models.js';
import { esc } from '../ui/esc.js';
import { an, clamp, ease } from './shared.js';

export class FoodPart {
  // ---------- food ----------
  foodPointerDown(id, e, btn) {
    this.sfx.unlock();
    if (this.state.phase !== 'play' || e.button > 0) return;
    e.preventDefault();
    if (!this.sim.foodUnlocked(id)) {
      const f = FOOD_BY_ID[id];
      const st = STAGES.find(s => s.id === f.unlock);
      this.hud.shakeFood(id);
      this.sfx.error();
      this.hud.toast(`<b>${esc(f.name)}</b>Unlocks when ${esc(this.Name)} becomes a ${esc(st.name)}.`);
      return;
    }
    this.foodPress = { id, btn, pointerId: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
    try { btn.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  rejectFood(id, reason, btn) {
    const f = FOOD_BY_ID[id];
    if (reason === 'poor') {
      this.hud.shakeFood(id);
      this.sfx.error();
      this.hud.toast(`<b>Not enough jelly</b>${esc(an(f.name)).replace(/^a/, 'A')} costs ${fmt(this.sim.foodPrice(id))}. Boop or pet ${esc(this.Name)} to collect more.`);
    } else if (reason === 'full') {
      this.flash({ eyes: 'happy', mouth: 'flat', sweat: true }, 1.4);
      this.slime.leanX.v -= 1.2;
      this.sfx.grumble();
      this.hud.say('So full...', 1500);
    } else if (reason === 'asleep') {
      this.hud.toast(`<b>Shh</b>${esc(this.Name)} is napping. Snacks can wait.`);
    }
    return false;
  }

  startFoodDrag() {
    const fp = this.foodPress;
    fp.dragging = true;
    const obj = makeFood(fp.id);
    obj.scale.setScalar(1.55);
    this.scene.add(obj);
    this.held = { id: fp.id, obj, t: 0 };
    this.lastInteract = this.time;
    this.positionHeld(0);
  }

  positionHeld(dt) {
    const h = this.held;
    if (!h) return;
    h.t += dt;
    const p = this.pointerWorld;
    h.obj.position.set(p.x, p.y + Math.sin(h.t * 6) * 0.03, p.z);
    h.obj.rotation.y += dt * 1.2;
  }

  dropHeld(cancel) {
    const h = this.held;
    if (!h) return;
    this.held = null;
    const mouth = this.slime.mouthWorld(this.v1);
    const over = !!this.slime.hit(this.raycaster);
    const near = h.obj.position.distanceTo(mouth) < 0.65 + this.slime.size * 0.6;
    if (!cancel && (over || near)) {
      const can = this.sim.canFeed(h.id);
      if (can.ok && !this.eating) { this.beginEat(h.id, h.obj); return; }
      if (can.ok && this.eating) { this.feedQueue.push(h.id); this.scene.remove(h.obj); return; }
      this.rejectFood(h.id, can.reason);
    }
    this.falling.push({ obj: h.obj, v: new THREE.Vector3(0, 1, 0), t: 0 });
  }

  tossFood(id, btn, opts = {}) {
    if (this.state.phase !== 'play') return false;
    if (!this.sim.foodUnlocked(id)) { this.hud.shakeFood(id); return false; }
    const can = this.sim.canFeed(id);
    if (!can.ok) return this.rejectFood(id, can.reason, btn);
    if (this.flying || this.eating) {
      if (this.feedQueue.length < 2) this.feedQueue.push(id);
      return true;
    }
    this.lastInteract = this.time;
    const obj = makeFood(id);
    obj.scale.setScalar(1.4);
    let from;
    if (btn && btn.getBoundingClientRect) {
      const r = btn.getBoundingClientRect();
      const ndc = new THREE.Vector2((r.left + r.width / 2) / innerWidth * 2 - 1, -((r.top + r.height / 2) / innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.stage.camera);
      from = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.6), from)) from.set(0, 0.2, 2.6);
    } else {
      from = new THREE.Vector3(opts.auto ? -3.5 : 0, 0.3, 2.4);
    }
    obj.position.copy(from);
    this.scene.add(obj);
    this.flying = { id, obj, from, t: 0, dur: 0.55 };
    return true;
  }

  beginEat(id, obj) {
    this.eating = { id, obj, phase: 'approach', t: 0, from: obj.position.clone(), s0: obj.scale.x };
  }

  updateFood(dt) {
    if (this.held) this.positionHeld(dt);
    if (this.flying) {
      const f = this.flying;
      f.t += dt / f.dur;
      const mouth = this.slime.mouthWorld(this.v1);
      const k = clamp(f.t, 0, 1);
      f.obj.position.lerpVectors(f.from, mouth, ease(k));
      f.obj.position.y += Math.sin(k * Math.PI) * 1.2;
      f.obj.rotation.x += dt * 6; f.obj.rotation.z += dt * 4;
      if (f.t >= 1) {
        this.flying = null;
        const can = this.sim.canFeed(f.id);
        if (can.ok) this.beginEat(f.id, f.obj);
        else { this.rejectFood(f.id, can.reason); this.falling.push({ obj: f.obj, v: new THREE.Vector3(0.5, 2, 1), t: 0 }); }
      }
    }
    const e = this.eating;
    if (e) {
      e.t += dt;
      if (e.phase === 'approach') {
        const k = clamp(e.t / 0.16, 0, 1);
        const mouth = this.slime.mouthWorld(this.v1);
        e.obj.position.lerpVectors(e.from, mouth, ease(k));
        e.obj.scale.setScalar(e.s0 * (1 - k * 0.45));
        this.chompOpen = 1;
        if (k >= 1) {
          this.scene.remove(e.obj);
          const can = this.sim.canFeed(e.id);
          if (!can.ok) { this.rejectFood(e.id, can.reason); this.eating = null; this.chompOpen = 0; return; }
          const before = { ...this.state.slime.traits };
          const tummyBefore = this.state.slime.tummy;
          const r = this.sim.feed(e.id);
          e.r = r;
          this.afterFeed(r, before);
          this.behave.onFed(r, tummyBefore);
          this.sfx.munch(r.def.sound);
          this.slime.squish(0.9);
          if (e.id === 'cookie') this.fx.emit('crumbs', this.slime.mouthWorld(this.v1), {});
          e.phase = 'chew'; e.t = 0; e.chomps = 0;
        }
      } else if (e.phase === 'chew') {
        this.chompOpen = 0.65 * Math.abs(Math.sin(e.t * Math.PI / 0.17));
        const n = Math.floor(e.t / 0.17);
        if (n > e.chomps) { e.chomps = n; this.slime.squish(0.35); }
        if (e.t >= 0.52) {
          e.phase = 'gulp'; e.t = 0; this.chompOpen = 0;
          this.slime.startGulp();
          this.sfx.gulp();
        }
      } else if (e.phase === 'gulp') {
        if (e.t >= 0.28) {
          this.slime.addInner(e.id);
          this.eating = null;
          this.react(e.r);
          if (this.feedQueue.length) {
            const next = this.feedQueue.shift();
            this.after(0.25, () => this.tossFood(next, this.hud.foodEls?.[next]?.b));
          }
        }
      }
    }
    for (const f of this.falling) {
      f.t += dt;
      f.v.y -= 9 * dt;
      f.obj.position.addScaledVector(f.v, dt);
      f.obj.scale.multiplyScalar(Math.exp(-dt * 3));
    }
    const gone = this.falling.filter(f => f.t > 0.9);
    for (const f of gone) this.scene.remove(f.obj);
    if (gone.length) this.falling = this.falling.filter(f => f.t <= 0.9);
  }

  afterFeed(r, before) {
    const st = this.state, s = st.slime;
    const name = this.Name;
    this.slime.setTraits(s.traits);
    this.markDirty(true);
    if (st.stats.feeds === 1) this.remember(r.def.id, `${name}'s very first snack: ${an(r.def.name)}.`, 'feed1');
    else if (r.firstTime) this.remember(r.def.id, `${name} tried ${an(r.def.name)} for the first time.`, 'try-' + r.def.id);
    for (const k of TRAIT_IDS) {
      if (before[k] < 10 && s.traits[k] >= 10) {
        this.after(1.2, () => {
          this.remember('✨', `${name} grew ${TRAITS[k].look}!`, 'grew-' + k);
          this.hud.toast(`<b>${esc(name)} is changing</b>All those snacks gave them ${esc(TRAITS[k].look)}.`, '', 3800);
          this.fx.emit('sparkles', this.slime.headTopWorld(this.v1), { count: 12 });
          this.sfx.sparkle();
          this.hud.dot('slime');
        });
      }
    }
    // trait float text
    const main = Object.entries(r.traitDeltas).sort((a, b) => b[1] - a[1])[0];
    if (main) {
      const sp = this.screenOf(this.slime.headTopWorld(this.v1));
      this.after(0.5, () => this.hud.floatText(sp.x + 40, sp.y, `${TRAITS[main[0]].name} +${main[1].toFixed(1)}`, 'trait', TRAITS[main[0]].color));
    }
    // answering a craving with the snack it asked for
    const req = this.requests.active;
    if (req && req.type === 'craving' && req.food === r.def.id && !req.waiting) {
      const waited = req.waited;
      this.requests.clear();
      this.hud.hideAsk();
      st.stats.requests++;
      s.joy = clamp(s.joy + (waited ? 14 : 8), 0, 100);
      const b = this.sim.addBond(waited ? 8 : 4);
      if (waited) this.sim.nudge('patient', 2); else this.sim.nudge('bold', 1.5);
      this.sim.nudge('cuddly', 1);
      if (b) this.onBondUp(b);
      this.after(0.9, () => this.hud.say(waited ? 'Worth the wait! ♥' : 'Yay! ♥', 1500));
      this.remember(r.def.id, waited ? `${name} waited patiently, then got the ${r.def.name} they wanted.` : `You gave ${name} the ${r.def.name} they asked for.`, waited ? 'req-waitgive' : 'req-give');
    }
    if (st.tutorial === 1) st.tutorial = 2;
  }

  react(r) {
    const name = this.Name;
    const head = this.slime.headTopWorld(new THREE.Vector3());
    const mouth = this.slime.mouthWorld(new THREE.Vector3());
    const center = this.slime.centerWorld(new THREE.Vector3());
    if (r.liked === 'favorite') {
      this.flash({ eyes: 'heart', mouth: 'grin', blush: 1 }, 1.8);
      this.fx.emit('hearts', head, { count: 7 });
      this.sfx.coo();
      this.after(0.3, () => this.sfx.giggle());
      this.slime.hop(4.5);
      this.hud.say(r.discovered ? '!!! ♥♥♥' : '♥', 1400);
    } else if (r.liked === 'dislike') {
      this.flash({ eyes: 'wince', mouth: 'bleh', sweat: true, blush: 0.1 }, 1.6);
      this.sfx.bleh();
      this.slime.kick(0.07);
      this.hud.say('Bleh!', 1300);
    } else if (r.overfed) {
      this.flash({ eyes: 'happy', mouth: 'o', sweat: true, blush: 0.5 }, 1.4);
      this.hud.say('So full...', 1400);
    } else {
      this.flash({ eyes: 'happy', mouth: 'cat', blush: 0.7 }, 1.1);
      this.fx.emit('hearts', head, { count: 2 });
      this.sfx.coo();
    }
    switch (r.def.id) {
      case 'chili':
        this.fx.emit('steam', head, { count: 6 });
        this.slime.emissiveBoost = 0.35;
        this.after(1.0, () => {
          this.sfx.sneeze();
          this.fx.emit('sparks', this.slime.mouthWorld(this.v1), { count: 14, dir: new THREE.Vector3(0, 0, 2.5) });
          this.flash({ eyes: 'wince', mouth: 'open' }, 0.45);
          this.slime.hop(3);
          this.slime.emissiveBoost = 0;
        });
        break;
      case 'iron': this.fx.emit('clank', mouth, {}); this.slime.squish(1.4); break;
      case 'moss': this.fx.emit('leaves', head, {}); break;
      case 'berry': this.fx.emit('sparks', center, { count: 12 }); this.slime.kick(0.08); this.sfx.munch('zap'); break;
      case 'crystal': this.fx.emit('prism', center, {}); this.slime.pulseGlow(0.7); break;
    }
    if (r.discovered === 'favorite') {
      this.remember(r.def.id, `Discovered ${name}'s favorite food: ${r.def.name}!`, 'fav');
      this.hud.toast(`<b>Favorite found!</b>${esc(name)} loves ${esc(r.def.name)}. Favorites give extra joy and bond.`, 'love', 4200);
    } else if (r.discovered === 'dislike') {
      this.remember(r.def.id, `${name} is not a fan of ${r.def.name}, but ate it anyway.`, 'dislike');
      this.hud.toast(`<b>Noted</b>${esc(name)} does not like ${esc(r.def.name)}. It still counts as a meal.`);
    }
    if (r.combo) {
      this.sfx.combo();
      this.fx.emit('prism', center, { count: 16 });
      this.hud.toast(`<b>${r.comboNew ? 'New combo! ' : ''}${esc(r.combo.name)}</b>${esc(r.combo.effect)}`, 'combo', 4200);
      if (r.comboNew) { this.remember('✨', `Discovered the ${r.combo.name} combo.`, 'combo-' + r.combo.id); this.hud.dot('journal'); }
      if (r.combo.glimmer) this.after(0.8, () => this.spawnGlimmer());
    }
    if (r.bondUp) this.onBondUp(r.bondUp);
    if (r.stageAfter > r.stageBefore) this.after(1.1, () => this.stageUp(r));
  }
}
