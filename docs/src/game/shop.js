// Spending jelly: helpers and upgrades (Shop), the Jelly Jar (pour it out, a bigger jar), outfits (buy and wear) and
// heirlooms. The pages themselves are in hud.js. A part of Game (src/mixin.js): `this` is the Game.
import * as THREE from 'three';
import { HELPER_BY_ID, JAR_LEVELS, OUTFIT_BY_ID } from '../data/content.js';
import { fmt } from '../core/format.js';
import { esc } from '../ui/esc.js';
import { memIcon } from '../ui/icons.js';
import { an } from './shared.js';

export class ShopPart {
  collectJar(fromRect) {
    this.sfx.unlock();
    const amt = this.sim.collectJar();
    if (amt <= 0) return;
    const r = fromRect || document.getElementById('jarBtn').getBoundingClientRect();
    this.hud.pourJelly(r, amt);
    for (let i = 0; i < 6; i++) this.after(0.12 + i * 0.08, () => this.sfx.plip());
    this.after(0.7, () => { this.sfx.sparkle(); this.sfx.giggle(); });
    if (!this.sim.asleep) {
      this.flash({ eyes: 'sparkle', mouth: 'grin', blush: 0.9 }, 1.3);
      this.slime.hop(4);
    }
    this.remember('🫙', `You poured out the Jelly Jar for the first time: ${fmt(amt)} jelly.`, 'jar1');
    this.markDirty(true);
  }

  buyJar() {
    this.sfx.unlock();
    const r = this.sim.buyJarUpgrade();
    if (!r) { this.sfx.error(); return; }
    const lvl = JAR_LEVELS[r.level];
    this.sfx.buy();
    this.hud.toast(`<b>Bigger Jelly Jar</b>Now catches ${Math.round(lvl.rate * 100)}% of helper jelly for up to ${lvl.hours} hours.`);
    this.hud.upgradeKey = '';
    this.markDirty(true);
  }

  buyOutfit(id) {
    this.sfx.unlock();
    const def = this.sim.buyOutfit(id);
    if (!def) { this.sfx.error(); this.hud.toast(`<b>Not enough jelly</b>${esc(OUTFIT_BY_ID[id].name)} costs ${fmt(OUTFIT_BY_ID[id].cost)}.`); return; }
    this.sfx.buy();
    this.remember(id, `${this.Name} got a new outfit: ${def.name}.`, 'outfit-' + id);
    this.wearOutfit(id);
  }

  wearOutfit(id) {
    const r = this.sim.wear(id);
    if (!r) return;
    this.slime.setOutfits(this.state.outfits.worn);
    this.hud.outfitKey = '';
    this.markDirty(true);
    if (!r.on || this.sim.asleep) return;
    this.slime.hop(4);
    this.slime.spin(Math.random() < 0.5 ? -1 : 1);
    if (r.favorite) {
      this.flash({ eyes: 'heart', mouth: 'grin', blush: 1 }, 2);
      this.after(0.4, () => { this.sfx.coo(); this.sfx.giggle(); });
      this.fx.emit('hearts', this.slime.headTopWorld(this.v1), { count: 8 });
      this.hud.say(r.discovered ? 'I love it!! ♥' : '♥♥♥', 1600);
      if (r.discovered) {
        this.remember(id, `${this.Name}'s favorite outfit is the ${r.def.name}. They glow with joy wearing it.`, 'favoutfit');
        this.hud.toast(`<b>Favorite outfit found!</b>${esc(this.Name)} loves the ${esc(r.def.name)}. Wearing it keeps them extra happy.`, 'love', 4500);
      }
    } else {
      this.flash({ eyes: 'sparkle', mouth: 'open', blush: 0.8 }, 1.4);
      this.after(0.7, () => this.sfx.mii());
      this.hud.say(['Ooh!', 'How do I look?', 'Fancy!'][Math.floor(Math.random() * 3)], 1300);
    }
  }

  // ---------- shop ----------
  buyHelper(id) {
    this.sfx.unlock();
    const r = this.sim.buyHelper(id);
    const h = HELPER_BY_ID[id];
    if (!r) { this.sfx.error(); this.hud.toast(`<b>Not enough jelly</b>${esc(h.name)} costs ${fmt(this.sim.helperCost(id))}.`); return; }
    this.sfx.buy();
    this.helpers3d.sync(this.state.helpers);
    if (r.count === 1) {
      this.remember(id, `${an(h.name).replace(/^a/, 'A')} joined the nursery.`, 'helper-' + id);
      this.after(0.4, () => { this.lookOverride = { target: new THREE.Vector3(0, 1.6, 0).add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, 0)), until: this.time + 1 }; this.flash({ eyes: 'sparkle', mouth: 'o' }, 1); this.sfx.question(); });
      if (id === 'musicbox') this.after(1, () => this.hud.toast(`<b>A lullaby!</b>${esc(this.Name)} sways to the music box. Music can be turned off in settings.`));
    }
    if (this.state.tutorial === 3) this.state.tutorial = 4;
    this.markDirty(true);
  }

  buyUpgrade(id) {
    this.sfx.unlock();
    const u = this.sim.buyUpgrade(id);
    if (!u) { this.sfx.error(); return; }
    this.sfx.buy();
    this.sfx.sparkle();
    this.hud.toast(`<b>${esc(u.name)}</b>${esc(u.blurb)}`);
    this.hud.upgradeKey = '';
    this.markDirty(true);
  }

  // ---------- heirlooms ----------
  buyHeirloom(id) {
    this.sfx.unlock();
    const h = this.sim.buyHeirloom(id);
    if (!h) { this.sfx.error(); this.hud.renderHeirlooms(true); return null; }
    this.sfx.buy();
    this.after(0.25, () => this.sfx.sparkle());
    this.remember(h.icon, `The family got the ${h.name}. It lives ${h.where}. ${h.effect}`, 'heirloom-' + h.id);
    this.hud.toast(`<span class="medal-ic" aria-hidden="true">${memIcon(h.icon, esc(h.icon))}</span><b>${esc(h.name)}</b>${esc(h.effect)} It will live ${esc(h.where)}, for every slime in the family.`, 'medal-toast heirloom-toast', 5200);
    if (this.state.phase === 'play' && !this.sim.asleep && this.view !== 'ranch') {
      this.flash({ eyes: 'sparkle', mouth: 'open', blush: 0.9 }, 1.4);
      this.slime.hop(4);
      this.fx.emit('sparkles', this.slime.headTopWorld(this.v1), { count: 12, color: '#ffe08a' });
    }
    this.hud.renderHeirlooms(true);
    this.saveNow(true);
    return h;
  }
}
