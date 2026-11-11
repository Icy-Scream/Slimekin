// A new generation: the move-out card (medal, the egg that comes next, Family Bonus, what you keep), the goodbye (the
// travel bubble, send-off.js), the moved-in card after the reload, and a baby's new home. A part of Game (src/mixin.js).
import * as THREE from 'three';
import { FORM_BY_ID, BREEDS, SENDOFF } from '../data/content.js';
import { fmtShort, fmtDuration } from '../core/format.js';
import { heirloomFlag } from '../core/heirlooms.js';
import { eggLabel } from '../core/breeding.js';
import { specialEggColors } from '../ui/eggs.js';
import { esc } from '../ui/esc.js';

export class MoveOutPart {
  // ---------- moving to the ranch (a new generation) ----------
  askMoveOut() {
    const sim = this.sim;
    if (!sim.canMoveOut()) return;
    const name = esc(this.Name), R = this.state.ranch;
    const pv = sim.moveOutPreview();
    if (!pv.room) {
      this.hud.showSimple('The ranch is full', `<p>There's room for ${R.slots} slimes. Buy more room with pearls, or find one of your ranch slimes a new home first.</p>`, 'OK');
      return;
    }
    const eggs = sim.ranch.eggs();
    const choice = this.eggChoiceHtml();
    // the medal it takes to the ranch, the Family Bonus now -> after, and any jelly that would stay behind
    const m = sim.medal(), left = Math.floor(this.state.jelly);
    const medalHtml = m ? `<div class="card mv-medal"><span class="medal-row">${this.hud.medalChip(m, 'big')}<b>${name} takes ${m.id === 'ribbon' ? 'the Grown-Up Ribbon' : `the ${esc(m.name)} medal`}</b></span><span class="sub">${m.id === 'ribbon' ? 'Every grown slime gets one.' : `On the ranch it makes pearls x${m.pearls} and buyers pay +${Math.round(m.offers * 100)}%.`}</span></div>` : '';
    const leftHtml = left >= 1 ? `<div class="card mv-leftover"><b>You still have ${fmtShort(left)} jelly.</b><span class="sub">It stays behind when ${name} moves out. Visit the Heirlooms first?</span><button class="btn" id="mvHeirlooms">Visit the Heirlooms</button></div>` : '';
    this.hud.openModal(`<h2>Move ${name} to the ranch?</h2>
      <p>${name} will live at the ranch barn, making jelly and pearls, and you can visit any time. ${eggs.length ? 'Then an egg goes on the cushion' : 'A new egg arrives'} and you raise a new baby.</p>
      ${medalHtml}
      ${choice}
      <div class="card mv-bonus"><b>Family Bonus +${pv.bonusNow.toFixed(1)}% → +${pv.bonusAfter.toFixed(1)}%</b><span class="sub">to all jelly, forever. It grows from all the jelly your family has ever made, so every bit ${name} makes counts.</span></div>
      ${leftHtml}
      ${this.keepHtml(name, true)}
      <div class="actions"><button class="btn" id="mvNo">Not yet</button><button class="btn primary" id="mvYes">Move to the ranch</button></div>`, {
      onOpen: card => {
        const pick = this.bindEggChoice(card);
        card.querySelector('#mvNo').addEventListener('click', () => this.hud.closeModal());
        card.querySelector('#mvYes').addEventListener('click', () => { this.hud.closeModal(); this.moveOut(pick() || null); });
        // (the move-out can be started again from the Slime or Ranch tab afterwards)
        card.querySelector('#mvHeirlooms')?.addEventListener('click', () => { this.hud.closeModal(); this.leaveRanch(false); this.hud.openTab('heirlooms'); });
      },
    });
  }
  // What stays and what starts over at a move-out or a baby's new home (heirlooms stay; the Golden Jar Lid keeps the jar).
  keepHtml(name, journal) {
    const jar = heirloomFlag(this.state, 'keepJar') ? 'what is in the Jelly Jar (the Golden Jar Lid keeps its size)' : 'the Jelly Jar';
    return `<div class="card"><b>You keep</b><span class="sub">Pearls, the ranch, heirlooms, outfits, combos you found and secrets.${journal ? ` ${name}'s journal goes with them.` : ''}</span><b>Starts over</b><span class="sub">Jelly, helpers, upgrades and ${jar}.</span></div>`;
  }

  // "Which egg comes next?": a plain egg, or any egg waiting in the Nursery. One still warming can be chosen too:
  // it goes on the cushion and finishes warming there.
  eggChoiceHtml() {
    const rr = this.sim.ranch, now = this.nowMs(), eggs = rr.eggs();
    if (!eggs.length) return '';
    return `<div class="sec-title">Which egg comes next?</div><div class="egg-choice" role="radiogroup" aria-label="Which egg comes next">
      <button class="card choice" role="radio" aria-checked="true" data-egg=""><span class="egg-ic" aria-hidden="true"></span><span><b>A new egg</b><span class="sub">A brand-new slime, all its own.</span></span></button>` +
      eggs.map(e => {
        const ready = rr.eggReady(e, now);
        const cols = (e.special ? specialEggColors(e.special) : this.eggColors(e.bias)) || [];
        const kind = e.special ? esc(BREEDS.specialEggs[e.special]?.blurb || '') : e.spark ? 'It twinkles: a family spark!' : e.pure ? `Both parents are ${esc(FORM_BY_ID[e.pure]?.name || 'the same')}s.` : 'Takes after its parents a little.';
        const note = ready ? kind : `Still warming: ready in ${fmtDuration(rr.eggSecondsLeft(e, now))}, it can finish on the cushion.${e.spark ? ' It twinkles!' : ''}`;
        return `<button class="card choice${e.spark ? ' spark' : ''}${ready ? '' : ' warming'}" role="radio" aria-checked="false" data-egg="${e.id}"><span class="egg-ic${e.spark ? ' spark' : ''}" style="--a:${cols[0] || '#9eefd3'};--b:${cols[1] || '#ffc2dc'}" aria-hidden="true"></span><span><b>${esc(eggLabel(e, { cap: true }))}</b><span class="sub">${note}</span></span></button>`;
      }).join('') + '</div>';
  }
  // returns a function that reads the chosen egg id ('' = a plain egg)
  bindEggChoice(card) {
    let eggId = '';
    for (const b of card.querySelectorAll('.choice')) b.addEventListener('click', () => {
      eggId = b.dataset.egg;
      for (const o of card.querySelectorAll('.choice')) o.setAttribute('aria-checked', String(o === b));
      this.sfx.plip();
    });
    return () => eggId;
  }

  moveOut(eggId = null) {
    if (this.departing || !this.sim.canMoveOut()) return;
    this.depart({ eggId, say: 'See you at the barn! ♥' });
  }

  // The goodbye: hearts, a wave, then the travel bubble carries it up and out of the picture (send-off.js; a baby waves
  // and drifts a little toward its new family), a white fade, then the rule runs and the page reloads into the egg.
  depart({ eggId = null, buyerId = null, say }) {
    this.leaveRanch();
    // the goodbye happens in view: a menu still open (the Slime tab) closes first
    if (window.matchMedia('(max-width: 860px)').matches && this.hud.sheetState() !== 'closed') this.hud.setSheet('closed');
    const baby = !!buyerId;
    this.movingDay.stop();
    this.slime.root.position.x = this.slime.root.position.z = 0;
    this.departing = { t: 0 };
    const name = this.Name;
    this.press = null;
    this.flash({ eyes: 'happy', mouth: 'grin', blush: 1 }, 3);
    this.sfx.mii();
    this.hud.say(say, 2200);
    this.fx.emit('hearts', this.slime.headTopWorld(this.v1), { count: 10 });
    // a baby looks toward where its new family waits (and drifts that way)
    if (baby) this.lookOverride = { target: new THREE.Vector3(6, 1.2, 2), until: this.time + 6 };
    this.sendOff.start({ baby });   // [bubble]
    this.after(SENDOFF.fade, () => {
      const fade = document.createElement('div');
      fade.className = 'fade-white';
      document.body.appendChild(fade);
      requestAnimationFrame(() => fade.classList.add('on'));
    });
    this.after(SENDOFF.rule, async () => {
      const eggOf = egg => egg ? { parents: egg.parents.map(p => p.name), spark: !!egg.spark, label: eggLabel(egg) } : null;
      if (baby) {
        const r = this.sim.rehomeBaby(this.nowMs(), { eggId, buyerId });
        if (!r) { location.reload(); return; }
        this.state.ranch.justMoved = { baby: true, name, buyer: r.buyer.name, egg: eggOf(r.egg) };
      } else {
        const r = this.sim.moveToRanch(this.nowMs(), { eggId });
        if (!r) { location.reload(); return; }
        this.state.ranch.justMoved = { name, form: r.resident.form?.name || '', bonus: r.bonus, gift: r.gift, egg: eggOf(r.egg) };
      }
      this.saveNow(false);
      try { await Promise.race([this.store.saveCloud(this.serialize()), new Promise(res => setTimeout(res, 2500))]); } catch { /* ignore */ }
      this.resetting = true;
      location.reload();
    });
  }

  updateDeparture(dt) {
    this.departing.t += dt;
    this.sendOff.update(dt);   // [bubble]
  }

  showMovedIn(j) {
    const R = this.state.ranch;
    const left = this.sim.eggSecondsLeft(this.nowMs());
    const warmIt = left > 0 ? `It is still warming: ready in ${fmtDuration(left)}. It can finish warming right there.` : 'Tap it to keep it warm.';
    const eggName = j.egg ? esc(j.egg.label || `${j.egg.parents[0]} and ${j.egg.parents[1]}'s egg`) : '';
    const eggLine = j.egg ? `<p>And look: ${eggName} is on the cushion${j.egg.spark ? ', twinkling' : ''}. ${warmIt}</p>` : '<p>And look: a new egg arrived. Tap it to keep it warm.</p>';
    if (j.baby) {
      this.hud.showSimple(`${esc(j.name)} has a new home!`, `<p>${esc(j.name)} went to live at ${esc(j.buyer)}, where they will be loved and looked after. Watch for postcards!</p>${eggLine}`, 'Hello, little egg!');
      this.saveNow(true);
      return;
    }
    const others = R.residents.length - 1;
    let body = `<p>${esc(j.name)} is settling in at the barn${others > 0 ? `, with ${others} other slime${others === 1 ? '' : 's'}` : ''}. Open the Ranch tab to visit.</p>`;
    body += `<div class="card"><b>Family Bonus +${j.bonus.toFixed(1)}%</b><span class="sub">Now +${R.family.bonus.toFixed(1)}% to all jelly, forever. This is generation ${R.family.generation}.</span></div>`;
    if (j.gift) body += `<div class="card"><b><i class="pearl"></i> ${j.gift} pearls</b><span class="sub">${esc(j.name)} found these on the way. Ranch slimes make pearls over time: spend them on more room and a bigger Pearl Basket.</span></div>`;
    body += eggLine;
    this.hud.showSimple(`${esc(j.name)} moved to the ranch!`, body, 'Hello, little egg!');
    this.saveNow(true);
  }

  // ---------- finding a baby a new home ----------
  // Not grown yet (Hatchling, Sprout, Rascal): a kind family raises them. No pearls, no Family Bonus, no ranch slot;
  // the same egg choice as moving out comes next.
  askRehome() {
    const sim = this.sim;
    if (!sim.canRehome() || this.departing) return;
    const buyer = sim.rehomeBuyer();
    const name = esc(this.Name);
    const choice = this.eggChoiceHtml();
    this.hud.openModal(`<h2>A new home for ${name}?</h2>
      <p><b>${esc(buyer.name)}</b> would love to raise ${name}. ${name} will be loved and looked after there, and will send you postcards about growing up.</p>
      ${choice || '<p>Then a new egg arrives on the cushion, and you raise a new baby.</p>'}
      <div class="card"><b>No pearls for a baby</b><span class="sub">Only grown-up slimes bring pearls and a Family Bonus. ${name} won't live on the ranch.</span></div>
      ${this.keepHtml(name, false)}
      <div class="actions"><button class="btn" id="rhNo">Keep ${name}</button><button class="btn primary" id="rhYes">Find a new home</button></div>`, {
      onOpen: card => {
        const pick = this.bindEggChoice(card);
        card.querySelector('#rhNo').addEventListener('click', () => this.hud.closeModal());
        card.querySelector('#rhYes').addEventListener('click', () => { this.hud.closeModal(); this.rehome(pick() || null, buyer.id); });
      },
    });
  }
  rehome(eggId, buyerId) {
    if (this.departing || !this.sim.canRehome()) return;
    this.depart({ eggId, buyerId, say: "Bye-bye! I'll write to you! ♥" });
  }
}
