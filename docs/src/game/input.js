// Input: pointer and keys on the scene (boops, petting, food drags, swipes, the egg, the camera, the barn).
// A part of Game (src/mixin.js): `this` is the Game.
import * as THREE from 'three';
import { FOODS } from '../data/content.js';
import { clamp } from './shared.js';

export class InputPart {
  // ---------- input ----------
  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', e => this.onDown(e));
    window.addEventListener('pointermove', e => this.onMove(e), { passive: true });
    window.addEventListener('pointerup', e => this.onUp(e));
    window.addEventListener('pointercancel', e => this.onUp(e, true));
    c.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => this.onKey(e));
    // Audio can only start from a user gesture; iPhones count the end of a tap, not the start.
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
      window.addEventListener(type, () => this.sfx.unlock(type), { capture: true, passive: true });
    }
  }

  setPointer(e) {
    this.pointerPx.x = e.clientX;
    this.pointerPx.y = e.clientY;
    this.ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.stage.camera);
    // [greenhouse] the drag plane in front of the slime faces the camera (straight on in Front, as always)
    const yaw = this.home ? this.home.yaw() : 0;
    this.plane.normal.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.raycaster.ray.intersectPlane(this.plane, this.pointerWorld);
    this.parallax.set(this.ndc.x, this.ndc.y);
  }

  onDown(e) {
    this.sfx.unlock();
    this.setPointer(e);
    this.lastPointerMove = this.time;
    this.lastInteract = this.time;
    const st = this.state;
    if (st.phase === 'egg') {
      if (this.view === 'ranch') { if (!this.hud.modalOpen) this.ranchDown(e); return; }
      if (this.home.second(e)) return;   // [greenhouse] a second finger while turning the camera: a pinch
      const h = this.egg && this.egg.hit(this.raycaster);
      if (h) this.tapEgg(h.point);
      else this.home.down(e);   // [greenhouse] empty background: turn the camera
      return;
    }
    if (st.phase !== 'play' || this.hud.modalOpen || this.departing) return;
    if (this.view === 'ranch') { this.ranchDown(e); return; }
    if (this.home.second(e)) { this.swipe = null; return; }   // [greenhouse] a second finger while turning the camera: a pinch
    if (this.behave.tryHighFive(this.raycaster)) return;
    if (this.glimmer && this.raycaster.ray.distanceSqToPoint(this.glimmer.obj.position) < 0.5 * 0.5) { this.catchGlimmer(); return; }
    const b = this.helpers3d.hitBubble(this.raycaster);
    if (b) { this.popBubble(b); return; }
    const hit = this.slime.hit(this.raycaster);
    if (!hit) {
      this.swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, t: this.time };
      this.home.down(e);   // [greenhouse] a drag from here turns the camera (a short swipe still counts for the secret code)
    }
    if (hit) {
      const region = this.slime.faceRegion(this.raycaster);
      this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: this.time, moved: 0, petting: false, over: true, lastMoveT: this.time, dir: 0, point: hit.point.clone() };
      this.behave.onPressStart(this.press, hit, region);
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (!this.sim.asleep) this.boop(hit.point, region);
      else this.slime.poke(hit.point, 0.3);
    }
  }

  onMove(e) {
    this.setPointer(e);
    this.lastPointerMove = this.time;
    if (this.rpress && e.pointerId === this.rpress.id) { this.ranchMove(e); return; }
    if (this.home.move(e)) return;   // [greenhouse] turning or pinching the camera
    if (this.foodPress && e.pointerId === this.foodPress.pointerId) {
      const fp = this.foodPress;
      if (!fp.dragging && Math.hypot(e.clientX - fp.x, e.clientY - fp.y) > 10) this.startFoodDrag();
      return;
    }
    const p = this.press;
    if (p && e.pointerId === p.id) {
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.moved += Math.hypot(dx, dy);
      p.x = e.clientX; p.y = e.clientY;
      const hit = this.slime.hit(this.raycaster);
      p.over = !!hit;
      this.behave.onPressMove(p, dx, dy);
      p.petting = p.mode === 'pet';
      this.canvas.classList.toggle('petting', p.mode === 'pet' || p.mode === 'pull');
      if (p.petting && hit && Math.hypot(dx, dy) > 0.5) { p.lastMoveT = this.time; p.dir = clamp(p.dir * 0.7 + dx * 0.01, -1, 1); this.lastInteract = this.time; }
      return;
    }
    if (this.state.phase === 'play' && e.pointerType === 'mouse') {
      const over = !this.hud.modalOpen && (!!this.slime.hit(this.raycaster) || !!this.helpers3d.hitBubble(this.raycaster) || (this.glimmer && this.raycaster.ray.distanceSqToPoint(this.glimmer.obj.position) < 0.25));
      this.canvas.classList.toggle('can-boop', over);
    } else if (this.state.phase === 'egg' && this.egg) {
      this.canvas.classList.toggle('can-boop', !!this.egg.hit(this.raycaster));
    }
  }

  onUp(e, cancel = false) {
    if (this.rpress && e.pointerId === this.rpress.id) { this.ranchUp(e, cancel); return; }
    this.home.up(e);   // [greenhouse]
    if (this.foodPress && e.pointerId === this.foodPress.pointerId) {
      const fp = this.foodPress;
      this.foodPress = null;
      if (fp.dragging) this.dropHeld(cancel);
      else if (!cancel) this.tossFood(fp.id, fp.btn);
      return;
    }
    const sw = this.swipe;
    if (sw && e.pointerId === sw.id) {
      this.swipe = null;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y, dist = Math.hypot(dx, dy);
      if (!cancel && this.time - sw.t < 0.8) {
        if (dist < 12) this.behave.onSwipe('tap');
        else if (dist > 45) this.behave.onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      }
    }
    const p = this.press;
    if (p && e.pointerId === p.id) {
      if (this.sim.asleep && !p.petting && this.time - p.t < 0.4) this.wakeUp('poked');
      this.behave.onPressUp(p, cancel);
      this.press = null;
      this.canvas.classList.remove('petting');
      this.sfx.purr(false);
    }
  }

  onKey(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || this.hud.modalOpen) return;
    if (this.barnRanch.active && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { this.barnRanch.request(e.key === 'ArrowRight' ? 1 : -1); return; }   // [barn]
    if (this.state.phase === 'egg' && this.view !== 'ranch' && (e.key === ' ' || e.key === 'Enter') && this.egg && e.target === this.canvas) {
      e.preventDefault();
      this.sfx.unlock();
      this.tapEgg(this.egg.group.position.clone().add(new THREE.Vector3(0, 0.8, 0.5)));
      return;
    }
    if (this.state.phase !== 'play') return;
    this.behave.onKey(e);
    if ((e.key === ' ' || e.key === 'Enter') && e.target === this.canvas) {
      e.preventDefault();
      this.sfx.unlock();
      if (this.sim.asleep) { this.wakeUp('poked'); return; }
      const f = this.slime.faceWorld(this.v1).clone();
      f.x += (Math.random() - 0.5) * 0.4; f.y += (Math.random() - 0.5) * 0.3;
      this.boop(f);
      return;
    }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= FOODS.length && !e.metaKey && !e.ctrlKey && !e.altKey) {
      this.sfx.unlock();
      this.tossFood(FOODS[n - 1].id, this.hud.foodEls?.[FOODS[n - 1].id]?.b);
    }
  }
}
