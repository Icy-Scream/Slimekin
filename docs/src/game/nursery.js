// The Nursery (breeding): its eggs and their colors, the Nursery page, making an egg, special eggs for pearls, giving an
// egg to a neighbor, and putting a Nursery egg on the cushion. A part of Game (src/mixin.js): `this` is the Game.
import * as THREE from 'three';
import { TRAITS, TRAIT_IDS, BREEDS } from '../data/content.js';
import { fmtDuration } from '../core/format.js';
import { eggLabel } from '../core/breeding.js';
import { specialEggColors, specialEggRefusal } from '../ui/eggs.js';
import { esc } from '../ui/esc.js';

export class NurseryPart {
  // ---------- the Nursery (breeding) ----------
  // Wall clock for egg timers; advance() (tests) moves it along with game time.
  nowMs() { return Date.now() + this.timeSkip; }
  // Spot colors for a bred egg: what its parents passed on (their strongest snack colors).
  eggColors(bias) {
    const top = TRAIT_IDS.map(k => [k, bias?.[k] || 0]).filter(e => e[1] > 1).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => TRAITS[k].color);
    return top.length ? [...top, '#fff1c9'] : null;
  }
  syncNursery() {
    const rr = this.sim.ranch, now = this.nowMs();
    const eggs = rr.eggs().map(e => ({ id: e.id, spark: !!e.spark, colors: e.special ? specialEggColors(e.special) : this.eggColors(e.bias), ready: rr.eggReady(e, now) }));
    this.ranch.setNursery(eggs);
    if (this.barnRanch?.active) this.barnRanch.view.setNursery(eggs);   // [barn] the nest at the front left of the stand (built before the barn)
  }
  openNursery() {
    if ((this.state.phase !== 'play' && this.state.phase !== 'egg') || this.hatching) return;
    if (this.view !== 'ranch') this.hud.openTab('ranch');
    if (this.view !== 'ranch' && !this.barnRanch.waiting) return;   // [barn] (while the barn loads, its page shows at once)
    if (this.ranchFocus) this.focusResident(null);
    this.ranchPage = 'nursery';
    document.getElementById('body-ranch').scrollTop = 0;
    this.barnRanch.hint();   // [barn]
    this.hud.openTab('ranch');
    this.hud.renderRanch(true);
    this.sfx.mii();
  }
  closeNursery() {
    this.ranchPage = null;
    document.getElementById('body-ranch').scrollTop = 0;
    this.barnRanch.hint();   // [barn]
    this.hud.renderRanch(true);
  }
  breed(aId, bId) {
    this.sfx.unlock();
    const rr = this.sim.ranch;
    const r = rr.breed(aId, bId, this.nowMs());
    if (!r) { this.sfx.error(); this.hud.renderRanch(true); return null; }
    this.instantEggs();
    const [p, q] = r.egg.parents;
    this.sfx.buy(); this.after(0.3, () => this.sfx.sparkle());
    for (const id of [aId, bId]) { const v = this.ranch.resident(id); if (v) { v.av.hop(5); v.happyT = 2.4; } }
    this.syncNursery();
    const nest = (this.barnRanch.active ? this.barnRanch.view : this.ranch).nest.getWorldPosition(new THREE.Vector3());   // [barn]
    this.fx.emit('hearts', nest.clone().add(new THREE.Vector3(0, 0.5, 0)), { count: 6 });
    if (r.egg.spark) {
      this.fx.emit('sparkles', nest.clone().add(new THREE.Vector3(0, 0.4, 0)), { count: 14, color: '#ffe08a' });
      this.remember('✦', `${p.name} and ${q.name} made an egg that twinkles. They share a family spark!`, 'sparkegg-' + r.egg.spark);
      this.hud.toast(`<b>A twinkly egg!</b>${esc(p.name)} and ${esc(q.name)} share a family spark. Something special could hatch, if the baby is raised just right.`, 'love', 5200);
    } else {
      this.remember('🥚', `${p.name} and ${q.name} made an egg together in the Nursery.`);
      const when = this.state.phase === 'egg' ? 'You can put it on the cushion instead of the egg there now.' : `Choose it when ${esc(this.Name)} moves to the ranch.`;
      this.hud.toast(`<b>A new egg in the Nursery</b>${esc(p.name)} and ${esc(q.name)}'s egg is ${this.debugInstant ? 'ready now (debug: instant eggs)' : `ready in ${fmtDuration(rr.eggWarmSeconds(r.egg))}`}. ${when}`, 'love', 4600);
    }
    this.hud.nurseryPick = [];
    this.hud.renderRanch(true);
    this.saveNow(true);
    return r;
  }
  // A special egg bought with pearls (recipe body, ui/eggs.js): it waits in the Nursery like any egg.
  buySpecialEgg(variant) {
    this.sfx.unlock();
    const rr = this.sim.ranch, c = rr.canBuySpecialEgg(variant);
    if (!c.ok) {
      this.sfx.error();
      const why = specialEggRefusal(this, variant, c);
      if (why) this.hud.toast(`<b>Not right now</b>${why}`, '', 3600);
      this.hud.renderRanch(true);
      return null;
    }
    const r = rr.buySpecialEgg(variant, this.nowMs());
    this.instantEggs();
    const def = BREEDS.specialEggs[variant];
    this.sfx.buy(); this.after(0.3, () => this.sfx.sparkle());
    this.syncNursery();
    const nest = (this.barnRanch.active ? this.barnRanch.view : this.ranch).nest.getWorldPosition(new THREE.Vector3());   // [barn]
    this.fx.emit('sparkles', nest.clone().add(new THREE.Vector3(0, 0.4, 0)), { count: 12, color: def.colors[1] });
    if (r.first) this.remember('🥚', `You brought home a ${def.name} for ${def.price} pearls. A ${BREEDS.variantNames[variant]} will hatch from it.`, 'specialegg');
    const when = this.state.phase === 'egg' ? 'You can put it on the cushion instead of the egg there now.' : `Choose it when ${esc(this.Name)} moves to the ranch.`;
    this.hud.toast(`<b>A ${esc(def.name)} in the Nursery</b>It is ${this.debugInstant ? 'ready now (debug: instant eggs)' : `ready in ${fmtDuration(rr.eggWarmSeconds(r.egg))}`}. ${when}`, 'love', 4600);
    this.hud.renderRanch(true);
    this.saveNow(true);
    return r;
  }
  giveEgg(id) {
    const e = this.sim.ranch.egg(id);
    if (!e) return;
    const label = esc(eggLabel(e));
    this.hud.openModal(`<h2>Give the egg to a neighbor?</h2><p>A kind family down the road would love to raise ${label}. It frees a spot in the nest. You don't get pearls back.</p>
      <div class="actions"><button class="btn" id="geNo">Keep it</button><button class="btn primary" id="geYes">Give it</button></div>`, {
      onOpen: card => {
        card.querySelector('#geNo').addEventListener('click', () => this.hud.closeModal());
        card.querySelector('#geYes').addEventListener('click', () => {
          this.hud.closeModal();
          if (!this.sim.ranch.giveEgg(id)) return;
          this.remember('💌', `${eggLabel(e, { cap: true })} went to a neighbor family who will love the baby.`);
          this.hud.toast(`<b>Off to a loving home</b>The neighbors promised to send pictures.`, 'love', 3600);
          this.sfx.sparkle();
          this.syncNursery();
          this.hud.renderRanch(true);
          this.saveNow(true);
        });
      },
    });
  }

  // ---------- the egg on the cushion: a Nursery egg can take its place before it hatches ----------
  askCushion(id) {
    const rr = this.sim.ranch, e = rr.egg(id);
    if (!e || this.state.phase !== 'egg' || this.hatching) return;
    const sw = this.sim.cushionSwap(id);
    const label = esc(eggLabel(e)), Label = esc(eggLabel(e, { cap: true }));
    const left = rr.eggSecondsLeft(e, this.nowMs());
    const there = sw.old ? `${esc(eggLabel(sw.old, { cap: true }))} (on the cushion now)` : 'The egg there now';
    const goes = sw.oldTo === 'nursery' ? 'will go back to the Nursery' : 'will go to a neighbor family who will love the baby';
    this.hud.openModal(`<h2>Put ${label} on the cushion?</h2>
      <p>${there} ${goes}.${left > 0 ? ` ${Label} is still warming: ready in ${fmtDuration(left)}. It can finish warming on the cushion.` : ''}</p>
      <div class="actions"><button class="btn" id="cuNo">Not now</button><button class="btn primary" id="cuYes">Put it on the cushion</button></div>`, {
      onOpen: card => {
        card.querySelector('#cuNo').addEventListener('click', () => this.hud.closeModal());
        card.querySelector('#cuYes').addEventListener('click', () => { this.hud.closeModal(); this.swapEgg(id); });
      },
    });
  }
  swapEgg(id) {
    this.sfx.unlock();
    const r = this.sim.swapCushionEgg(id, this.nowMs());
    if (!r) { this.sfx.error(); this.hud.renderRanch(true); return; }
    const old = r.old ? eggLabel(r.old, { cap: true }) : 'The plain egg';
    const was = r.oldTo === 'nursery' ? `${old} went back to the Nursery.` : `${old} went to a neighbor family who will love the baby.`;
    this.remember('🥚', `${eggLabel(r.egg, { cap: true })} went on the cushion. ${was}`);
    this.makeEggView();
    this.slime.setRecipe(this.state.slime, { instant: true });   // the baby in this egg has the egg's own body
    this.slime.setStage(0, 0, true);
    this.eggWarming = !this.sim.eggReady(this.nowMs());
    this.updateEggHint();
    this.syncNursery();
    this.hud.renderRanch(true);
    this.saveNow(true);
    // home, to see it on the cushion
    this.leaveRanch();
    this.hud.toast(`<b>${esc(eggLabel(r.egg, { cap: true }))} is on the cushion</b>${esc(was)}`, 'love', 4200);
    this.after(0.6, () => {
      if (!this.egg) return;
      this.egg.tap();
      this.fx.emit('sparkles', this.egg.group.position.clone().add(new THREE.Vector3(0, 0.9, 0)), { count: 14, color: r.egg.spark ? '#ffe08a' : '#ffe7a8' });
      this.sfx.sparkle();
    });
  }
}
