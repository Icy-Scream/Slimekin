// Going to the ranch (the barn, barn-ranch.js) and back home, and what you do there: pet a resident, pick up pearls,
// collect the Pearl Basket, buy more room and a bigger basket. A part of Game (src/mixin.js): `this` is the Game.
import * as THREE from 'three';

export class RanchPart {
  // ---------- the ranch ----------
  onTab(t) {
    this.barnRanch.noteTab(t);   // [barn]
    if (t === 'ranch') this.goRanch();
    else { this.barnRanch.cancelWait(); if (this.view === 'ranch') this.leaveRanch(false); }   // [barn] (a loading moment ends too)
  }

  // (also while an egg waits on the cushion: the family's ranch keeps going and can be visited)
  // [barn] The ranch screen is the barn. Until its files are in (they load ahead of time), home stays with a short
  // "Off to the barn" moment and the barn opens when they arrive (barn-ranch.js waitFor); the meadow ranch never shows.
  goRanch() {
    const phase = this.state.phase;
    if (this.view === 'ranch' || (phase !== 'play' && phase !== 'egg') || this.hatching || this.departing) return;
    if (!this.barnRanch.view.ready) { this.barnRanch.waitFor(); return; }   // [barn]
    this.view = 'ranch';
    this.press = null; this.swipe = null;
    if (this.hud.sheetState() === 'tall') this.hud.setSheet('normal', false);   // going to the ranch: the menu is back to normal
    document.body.classList.add('at-ranch');
    document.getElementById('ranchBar').hidden = false;
    this.hud.toggleEmotes(false);
    this.barnRanch.enter();   // [barn]
    this.sfx.whee ? this.sfx.whee() : this.sfx.sparkle();
    const R = this.state.ranch;
    if (R.residents.length && this.sim.ranch.visit()) {
      this.after(1.6, () => {
        for (const r of this.ranch.residents.values()) { r.av.hop(4 + Math.random() * 2); r.happyT = 1.8; }
        if (this.barnRanch.active) this.barnRanch.view.hop(4 + Math.random() * 2);   // [barn] the one on the stand
        this.sfx.mii();
        this.hud.toast('<b>Everyone is happy to see you!</b>A visit cheers up all your ranch slimes.', 'love', 2600);
      });
    }
    this.layoutChanged();
  }

  leaveRanch(selectTab = true) {
    if (this.view !== 'ranch') {   // [barn] "Back home" (or a goodbye) while the barn loads: the loading moment ends
      if (selectTab && this.barnRanch.waiting && this.hud.tab === 'ranch') { this.hud.setSheet('closed', false); this.hud.selectTab('helpers'); this.layoutChanged(); }
      return;
    }
    this.view = 'home';
    this.contestShow.cancel();   // [contests] a show still running stops: nothing paid
    this.barnRanch.leave();   // [barn]
    this.ranchFocus = null;
    this.ranchPage = null;
    this.rpress = null;
    document.body.classList.remove('at-ranch');
    document.getElementById('ranchBar').hidden = true;
    if (selectTab && this.hud.tab === 'ranch') {
      this.hud.setSheet('closed', false);
      this.hud.selectTab('helpers');
    } else if (this.hud.sheetState() === 'tall') this.hud.setSheet('normal', false);   // back home: the menu is back to normal
    this.layoutChanged();
  }

  focusResident(id) {
    if (id && this.view !== 'ranch') this.hud.openTab('ranch');
    if (id) this.ranchPage = null;
    this.ranchFocus = id || null;
    const x = id && this.sim.ranch.resident(id);
    if (this.barnRanch.active) {   // [barn] the one picked comes up on the stand (the camera stays)
      this.barnRanch.hint();
      if (x) { this.barnRanch.show(id); this.sfx.mii(); }
    }   // (still loading: the barn opens on it, barn-ranch.js enter)
    this.hud.renderRanch(true);
  }

  // Ranch slimes make pearls even while you're home; while you watch, they pop out into the grass.
  updateRanch(dt) {
    this.life.update(dt);   // lessons that end and travelers who come home
    const made = this.sim.ranch.tick(dt);
    for (const id of made) {
      if (this.barnRanch.active && this.barnRanch.spawnPearl(id)) { this.sfx.plip(); }   // [barn] (into the stand's straw)
    }
    if (made.length) this.markDirty(false);
    this.ranch.setBasket(this.state.ranch.basket.stored, this.sim.ranch.basketCap());
    this.barnRanch.view.setBasket(this.state.ranch.basket.stored, this.sim.ranch.basketCap());   // [barn]
  }

  // [barn] touch on the ranch screen (the barn): barn-ranch.js
  ranchDown(e) { this.rpress = { id: e.pointerId }; this.barnRanch.down(e); }
  ranchMove(e) { this.barnRanch.move(e); }
  ranchUp(e, cancel) { this.rpress = null; this.barnRanch.up(e, cancel); }

  petResident(id, stroke = false) {
    const r = this.sim.ranch.pet(id);
    if (!r) return;
    const v = this.barnRanch.active ? this.barnRanch.view.pet() : null;   // [barn] the one on the stand
    if (v) {
      const head = v.av.headTopWorld(new THREE.Vector3());
      this.fx.emit('hearts', head, { count: stroke ? 2 : 4 });
    }
    if (!stroke) this.sfx.mii(); else this.sfx.purr(true), this.after(0.4, () => this.sfx.purr(false));
    if (r.counted) {
      this.remember('🏡', `You visited ${r.resident.name} on the ranch.`, 'ranchpet-' + r.resident.id);
      this.markDirty(false);
    }
  }

  pickRanchPearl(p) {
    const got = this.sim.ranch.pickPearl();
    const rv = this.barnRanch.view;   // [barn] (pearls are only picked in the barn)
    const pos = rv.pearlWorld(p, new THREE.Vector3());
    rv.removePearl(p);
    if (!got) return;
    this.fx.emit('sparkles', pos, { count: 8, color: '#ffe6f6' });
    const sp = this.screenOf(pos);
    this.hud.floatText(sp.x, sp.y - 10, '+1 pearl', 'pearl-float');
    this.sfx.plip(); this.after(0.08, () => this.sfx.sparkle());
    this.remember('🫧', 'You picked up your first pearl on the ranch.', 'pearl1');
    this.markDirty(false);
  }

  collectBasket() {
    this.sfx.unlock();
    const n = this.sim.ranch.collectBasket();
    if (n <= 0) return;
    this.barnRanch.view.clearPearls();   // [barn]
    if (this.barnRanch.active) {   // [barn]
      const pos = this.barnRanch.view.basketWorld(new THREE.Vector3());
      this.fx.emit('sparkles', pos, { count: 16, color: '#ffe6f6', speed: 2.4 });
      const sp = this.screenOf(pos);
      this.hud.floatText(sp.x, sp.y - 20, `+${n} pearls`, 'pearl-float');
    } else this.hud.toast(`<b>+${n} pearls</b>Collected from the Pearl Basket.`, '', 2400);
    for (let i = 0; i < Math.min(6, n); i++) this.after(0.08 * i, () => this.sfx.plip());
    this.after(0.5, () => this.sfx.sparkle());
    this.hud.renderRanch(true);
    this.markDirty(true);
  }

  buyRanchSlot() {
    this.sfx.unlock();
    const r = this.sim.ranch.buySlot();
    if (!r) { this.sfx.error(); return; }
    this.sfx.buy();
    this.hud.toast(`<b>More room on the ranch</b>Space for ${r.slots} slimes now.`);
    this.hud.renderRanch(true);
    this.saveNow(true);
  }

  buyBasket() {
    this.sfx.unlock();
    const r = this.sim.ranch.buyBasket();
    if (!r) { this.sfx.error(); return; }
    this.sfx.buy();
    this.hud.toast(`<b>Bigger Pearl Basket</b>Holds ${r.cap} pearls now.`);
    this.hud.renderRanch(true);
    this.saveNow(true);
  }
}
