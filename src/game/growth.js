// Growing up: the stage-up card (and the grown-up form), the medal ceremony, and the grown-up form's little effects.
// A part of Game (src/mixin.js): `this` is the Game.
import * as THREE from 'three';
import { FOODS, STAGES, PURE_LINE } from '../data/content.js';
import { fmtShort } from '../core/format.js';
import { setMedalPin } from '../view/medal-pin.js';
import { esc } from '../ui/esc.js';
import { ICON, memIcon } from '../ui/icons.js';
import { an } from './shared.js';

export class GrowthPart {
  stageUp(r) {
    const st = STAGES[r.stageAfter];
    const name = this.Name;
    this.sfx.voice = st.voice;
    if (r.form) this.slime.setForm(r.form.id, { pure: r.form.pure });
    this.slime.pulseGlow(1.4);
    this.slime.spin();
    this.slime.hop(6.5);
    this.flash({ eyes: 'sparkle', mouth: 'grin', blush: 1 }, 2.5);
    const head = this.slime.headTopWorld(this.v1).clone();
    this.fx.emit('confetti', head, { count: 50 });
    this.fx.emit('sparkles', head, { count: 20, speed: 2.5 });
    this.sfx.levelUp();
    this.remember('⭐', `${name} grew into a ${st.name}!`, 'stage-' + st.id);
    if (r.form) this.remember('⭐', `${name} settled into ${an(r.form.name)}. ${r.form.blurb}`, 'form');
    const lin = this.state.slime.lineage || {};
    const parents = lin.parents?.length ? `${lin.parents[0].name} and ${lin.parents[1].name}` : 'its parents';
    if (r.form?.spark) {
      this.remember('✦', `The family spark came true! ${name} became ${an(r.form.name)}, something only ${parents} could pass on.`, 'spark-' + r.form.spark);
      this.after(2.4, () => { this.fx.emit('prism', this.slime.headTopWorld(this.v1).clone(), { count: 24, speed: 2 }); this.sfx.combo(); });
    } else if (r.nearMiss) {
      this.remember('✦', `${name} carried a family spark but grew into ${an(r.form.name)}. Clue: ${r.nearMiss.clue}`, 'nearmiss');
      this.after(4.5, () => this.hud.toast(`<b>So close!</b>${esc(name)} had a family spark from ${esc(parents)}. Clue for next time: ${esc(r.nearMiss.clue)}`, 'combo', 6500));
    } else if (r.form?.pure) {
      this.remember('✦', `${name} grew up just like ${parents}: ${an(r.form.name)}.`, 'pure');
    }
    const foods = FOODS.filter(f => f.unlock === st.id);
    let body = `<p>${esc(st.blurb)}</p><div class="unlocks">`;
    body += `<div class="unlock"><span style="font-size:22px;width:34px;text-align:center">x${st.boop}</span>Boops now give ${st.boop} base jelly</div>`;
    for (const f of foods) body += `<div class="unlock">${this.hud.icon(f.id)}New snack: ${esc(f.name)}</div>`;
    body += '</div>';
    const extra = r.form?.spark ? `<span class="sub spark-line">${ICON.sparkle}A family spark! Only ${esc(parents)} could pass this on.</span>`
      : r.form?.pure ? `<span class="sub spark-line">${ICON.sparkle}${esc(PURE_LINE.note)}</span>`
      : r.nearMiss ? `<span class="sub">${esc(name)} carried a family spark, but grew up a little differently. The Journal kept a clue.</span>` : '';
    if (r.form) body = `<p>Everything you shared shaped who ${esc(name)} became.</p><div class="card"><span class="form-name">${esc(r.form.name)}</span><span class="sub">${esc(r.form.blurb)}</span>${extra}</div>` + body;
    else if (r.stageAfter >= 1) body += '<p>Snacks cost more now, since bigger slimes eat bigger portions.</p>';
    this.after(1.6, () => this.hud.showSimple(r.form ? `${esc(name)} is all grown up!` : `${esc(name)} is now a ${esc(st.name)}!`, body, 'Yay!'));
    this.medalHold = this.time + 4;   // the Grown-Up Ribbon's ceremony waits for this card
    this.saveNow(true);
  }

  // ---------- medals: earned live, a small ceremony once per medal per slime (also after a reload) ----------
  // Waits for a calm moment at home: not asleep, not eating, no card open, not mid-goodbye.
  updateMedals(dt) {
    this.medalT = (this.medalT ?? 1) - dt;
    if (this.medalT > 0) return;
    this.medalT = 0.5;
    if (this.view === 'ranch' || this.hud.modalOpen || this.sim.asleep || this.busy() || this.departing || this.hatching || this.time < (this.medalHold || 0)) return;
    const got = this.sim.takeNewMedals();
    if (got.length) this.medalCeremony(got);
  }
  medalCeremony(list) {
    const m = list[list.length - 1], name = this.Name;
    for (const x of list) {
      this.remember(x.icon, x.id === 'ribbon' ? `${name} earned the Grown-Up Ribbon: all grown up!` : `${name} earned the ${x.name} medal: ${fmtShort(x.jelly)} jelly of their own.`, 'medal-' + x.id);
    }
    const head = this.slime.headTopWorld(this.v1).clone();
    this.fx.emit('confetti', head, { count: 40 });
    this.fx.emit('sparkles', head, { count: 16, speed: 2.4, color: '#ffe08a' });
    this.slime.pulseGlow(1);
    this.slime.hop(6);
    this.after(0.35, () => this.slime.spin());
    this.flash({ eyes: 'sparkle', mouth: 'grin', blush: 1 }, 2.2);
    this.sfx.levelUp();
    this.after(0.6, () => this.sfx.mii());
    this.hud.say(`${m.icon}!`, 1800);
    const perk = m.id === 'ribbon' ? 'All grown up. Every grown slime wears one.' : `${fmtShort(m.jelly)} jelly of their own! On the ranch: pearls x${m.pearls}, buyers pay +${Math.round(m.offers * 100)}%.`;
    this.hud.toast(`<span class="medal-ic" aria-hidden="true">${memIcon(m.icon, esc(m.icon))}</span><b>${esc(name)} earned ${esc(m.title)}!</b>${esc(perk)}`, 'medal-toast', 5200);
    this.hud.dot('slime');
    this.hud.updateMedalBadge();
    setMedalPin(this.slime, this.sim.medalShown());
    this.saveNow(true);
  }

  // Small signature effects of a grown-up form (steam, glints, sparks, pollen, smoke...).
  updateFormFx(dt) {
    const fx = this.slime.form?.fx;
    if (!fx || this.reduced) return;
    this.formFxT -= dt;
    if (this.formFxT > 0) return;
    this.formFxT = fx.every * (0.6 + Math.random() * 0.8);
    const sl = this.slime;
    const head = sl.headTopWorld(this.v1);
    const at = sl.formAnchor && sl.formAnchor.visible !== false && sl.formAnchor.parent?.visible !== false
      ? sl.formAnchor.getWorldPosition(new THREE.Vector3()) : head.clone();
    const r = 0.9 * sl.size;
    const side = new THREE.Vector3((Math.random() - 0.5) * 2 * r, -Math.random() * r, (Math.random() - 0.2) * r).add(head);
    const col = fx.color ? { color: fx.color } : {};
    switch (fx.kind) {
      case 'steam': this.fx.emit('steam', at, { count: 2, size: 0.2 }); break;
      case 'smoke': this.fx.emit('steam', at, { count: 1, size: 0.16, color: '#c9c2c2', speed: 0.15 }); break;
      case 'glints': this.fx.emit('glints', side, { size: 0.2, life: 0.9, ...col }); break;
      case 'sparks': this.fx.emit('sparks', at, { count: 3, speed: 1.6, ...col }); break;
      case 'embers': this.fx.emit('sparks', at, { count: 2, speed: 0.8, gravity: -1.5, life: 0.9, color: '#ff9a3d' }); break;
      case 'pollen': this.fx.emit('dream', side, { color: fx.color || '#ffe27a', size: 0.09, life: 2.6 }); break;
      case 'prism': this.fx.emit('prism', side, { count: 2, speed: 0.6, size: 0.14 }); break;
      case 'fizz': this.fx.emit('dream', head.clone().add(new THREE.Vector3((Math.random() - 0.5) * r, -0.1, (Math.random() - 0.3) * r)), { color: '#ffffff', size: 0.07, life: 0.8, speed: 0.4 }); break;
      case 'firework':
        this.fx.emit('sparks', at, { count: 2, speed: 0.9, life: 0.4, color: '#ffd75a' });
        this.fireworkT = (this.fireworkT || 0) + 1;
        if (this.fireworkT % 24 === 0) {
          const p = head.clone(); p.y += 1.6 * sl.size; p.x += (Math.random() - 0.5) * 1.2;
          this.fx.emit('prism', p, { count: 18, speed: 2.6 });
          this.fx.emit('sparks', p, { count: 10, speed: 2.4, color: '#fff3b0' });
          this.sfx.plip && this.sfx.plip();
        }
        break;
    }
  }
}
