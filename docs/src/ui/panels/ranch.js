// The Ranch page: the barn overview (pearls, Family Bonus, moving out, Nursery, ranch life, Pearl Basket, residents,
// slimes living elsewhere) or one resident's page. A part of Hud (src/mixin.js): `this` is the Hud. What the buttons
// do: the click handler on #body-ranch in hud.js, and src/game/ranch.js, nursery.js, new-homes.js.
import { FOOD_BY_ID, TRAITS, BOND, PERSONALITY, PERSONALITY_IDS, RANCH, BUYER_BY_ID } from '../../data/content.js';
import { fmt, fmtShort, fmtRate } from '../../core/format.js';
import { memIcon } from '../icons.js';
import { residentMedal } from '../../core/medals.js';
import { esc } from '../esc.js';

export class RanchPanel {
  // ---------- ranch tab ----------
  renderRanch(force = false) {
    if (this.g.ranchPage === 'nursery') return this.renderNursery(force);
    const g = this.g, sim = g.sim, st = g.state, R = st.ranch, rr = sim.ranch;
    const focus = g.ranchFocus ? rr.resident(g.ranchFocus) : null;
    const fm = rr.familyMult();
    const canMove = sim.canMoveOut();
    const eggPhase = st.phase === 'egg';
    const key = [R.pearls, R.basket.stored, R.basket.level, R.slots, R.residents.map(x => x.id + ':' + Math.round(x.happiness / 5)).join(','), focus && focus.id, canMove, R.placed.length, st.slime.name, rr.eggs().length, st.phase, g.life.key()].join('|');
    if (!force && key === this.ranchKey) return;
    this.ranchKey = key;
    const happyWord = h => h > 80 ? 'Very happy' : h > 55 ? 'Happy' : h > 30 ? 'A little lonely' : 'Misses you';
    const pearlCost = n => `<span class="cost"><i class="pearl"></i>${fmt(n)}</span>`;
    let html = '';
    if (focus) {
      const x = focus;
      const traits = Object.entries(x.traits || {}).filter(e => e[1] > 1).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => TRAITS[k].name).join(' + ');
      const lean = PERSONALITY_IDS.map(id => [id, x.personality?.[id] ?? 50]).sort((a, b) => Math.abs(b[1] - 50) - Math.abs(a[1] - 50)).slice(0, 2)
        .map(([id, v]) => (v >= 50 ? PERSONALITY[id].high : PERSONALITY[id].low)).join(', ');
      html += `<button class="link-btn" id="ranchBack">← All ranch slimes</button>`;
      const xm = residentMedal(x);
      html += `<div class="card"><div class="row-between"><span class="form-name">${esc(x.name)} ${this.medalChip(xm)}</span><span class="sub">Generation ${x.generation}</span></div>
        <b>${esc(x.form?.name || 'Slime')}</b><span class="sub">${esc(x.form?.blurb || '')}</span>
        <span class="sub medal-line">${esc(xm.id === 'ribbon' ? 'Grown-Up Ribbon' : `${xm.name} medal: pearls x${xm.pearls}, buyers pay +${Math.round(xm.offers * 100)}%`)} (${fmtShort(x.runTotal || 0)} jelly made growing up).</span>${g.contestsUI.residentLine(x)}
        <div class="row-between"><span class="sub">${happyWord(x.happiness)}</span><span class="sub">${Math.round(x.happiness)}%</span></div><div class="meter"><i style="width:${x.happiness.toFixed(0)}%;background:linear-gradient(90deg,#ffb0c8,var(--berry))"></i></div>
        ${x.trip ? '' : `<span class="sub">Tap or stroke ${esc(x.name)} to pet them. Happy slimes make pearls faster.</span>`}
        ${x.lineage?.parents?.length ? `<span class="sub">Child of ${esc(x.lineage.parents[0].name)} (${esc(x.lineage.parents[0].form.name)}) and ${esc(x.lineage.parents[1].name)} (${esc(x.lineage.parents[1].form.name)}).</span>` : ''}</div>`;
      html += `<div class="stat-grid">
        <div class="stat"><div class="k">Jelly</div><div class="v">${fmtRate(x.jps * fm)}/s</div></div>
        <div class="stat"><div class="k">Pearls</div><div class="v">+${(rr.pearlRate(x) * 3600).toFixed(1)}/hour</div></div>
        <div class="stat"><div class="k">Made of</div><div class="v">${esc(traits || 'A bit of everything')}</div></div>
        <div class="stat"><div class="k">Favorite snack</div><div class="v">${esc(FOOD_BY_ID[x.favorite]?.name || '?')}</div></div></div>`;
      if (lean) html += `<p class="sub">Personality: ${esc(lean)}. Bond: ${esc(BOND[x.bondLevel || 0].title)}.</p>`;
      html += g.life.residentHtml(x);   // ranch life: skills, loves, Train / Send on a trip (ui/ranch-life.js)
      const mem = (x.memories || []).slice(-6).reverse();
      if (mem.length) html += `<div class="sec-title">${esc(x.name)}'s story</div><div class="card">` + mem.map(m => `<div class="sub mem-line">${memIcon(m.icon, esc(m.icon || ''))} <span>${esc(m.text)}</span></div>`).join('') + '</div>';
      html += `<div class="res"><div class="acts"><button class="btn" data-act="place" data-id="${x.id}">Find a new home</button><button class="btn" data-act="auction" data-id="${x.id}">Auction</button></div></div>`;
    } else {
      html += `<button class="link-btn" id="ranchHome">← Back home</button>`;
      html += `<div class="card"><div class="row-between"><span class="form-name">The Barn</span><span class="sub">Generation ${R.family.generation}</span></div>
        <div class="big-num"><i class="pearl big"></i>${fmt(R.pearls)}<span class="sub">pearls</span></div>
        <span class="sub">${R.family.bonus > 0 ? `Family Bonus: <b>+${R.family.bonus.toFixed(1)}%</b> to all jelly, forever. It grows from all the jelly your family has ever made.` : 'Every slime that moves here grows a Family Bonus on all your jelly, forever, from all the jelly your family has ever made.'}</span>
        ${R.residents.length ? `<span class="sub">The ranch makes <b>${fmtRate(sim.ranchJps())}</b> jelly a second and about <b>${rr.pearlsPerHour().toFixed(1)}</b> pearls an hour.</span>` : ''}</div>`;
      const name = esc(st.slime.name || 'Your slime');
      if (canMove) {
        const pv = sim.moveOutPreview();
        html += `<div class="card"><b>${name} is all grown up</b><span class="sub">Moving to the ranch starts a new generation with a new egg. The Family Bonus goes up <b>+${pv.bonus.toFixed(1)}%</b>, and ${name} makes ${fmtRate(pv.jps * (1 + pv.bonusAfter / 100))} jelly a second plus pearls on the ranch. The bonus grows from all the jelly your family has ever made.</span>
          <button class="btn primary" id="moveOutBtn">${pv.room ? `Move ${name} to the ranch` : 'The ranch is full'}</button></div>`;
      } else if (!R.residents.length && !eggPhase) {
        html += `<div class="card"><b>Nobody lives here yet</b><span class="sub">When ${name} is all grown up (Settled), they can move to the ranch. They keep making jelly and pearls, you raise a new baby, and the Family Bonus on all your jelly grows from all the jelly your family makes.</span></div>`;
      }
      if (R.residents.length || rr.eggs().length) {
        const n = rr.eggs().length;
        html += `<div class="card nursery-card"><div class="row-between"><b>Nursery</b><span class="sub">${n ? `${n} egg${n === 1 ? '' : 's'} waiting` : 'No eggs yet'}</span></div>
          <span class="sub">${eggPhase && n ? 'Before the egg at home hatches, you can put a Nursery egg on the cushion instead.' : R.residents.length < 2 ? 'When two slimes live here, they can make an egg together.' : eggPhase ? 'Two ranch slimes can make an egg together, then put it on the cushion.' : `Two ranch slimes can make an egg together. Choose it when ${name} moves to the ranch.`}</span>
          <button class="btn" data-act="nursery">Open the Nursery</button></div>`;
      }
      if (R.residents.length) html += g.life.ranchRowHtml();   // ranch life: lanes, wagons, souvenirs (ui/ranch-life.js)
      if (R.residents.length || R.basket.stored > 0) {
        const cap = rr.basketCap(), next = RANCH.basket[R.basket.level + 1];
        html += `<div class="sec-title">Pearl Basket</div><div class="card"><div class="row-between"><span>Pearls waiting</span><b>${R.basket.stored} / ${cap}</b></div>
          <div class="meter"><i style="width:${(R.basket.stored / cap * 100).toFixed(0)}%;background:linear-gradient(90deg,#efd9f5,#b9d4f2)"></i></div>
          <span class="sub">Ranch slimes make pearls. They pop out into the grass (tap them!) and roll into the basket. When the basket is full, they take a break.</span>
          <button class="btn primary" id="collectBasket" ${R.basket.stored ? '' : 'disabled'}>${R.basket.stored ? `Collect ${R.basket.stored} pearl${R.basket.stored === 1 ? '' : 's'}` : 'Basket is empty'}</button>
          ${next ? `<button class="upgrade${R.pearls < next.cost ? ' poor' : ''}" id="basketUp"><span class="un">Bigger basket</span><span class="ub">Holds ${next.cap} pearls.</span>${pearlCost(next.cost)}</button>` : ''}</div>`;
      }
      if (R.residents.length) {
        html += `<div class="sec-title">Living here · ${R.residents.length} of ${R.slots}</div>`;
        for (const x of R.residents) {
          html += `<div class="card res"><span class="nm">${esc(x.name)} ${this.medalChip(residentMedal(x))}</span><span class="sub">Gen ${x.generation}</span>
            <span class="sub">${esc(x.form?.name || 'Slime')}</span><span class="sub">${fmtRate(x.jps * fm)} jelly/s</span>
            <div class="meter" title="Happiness"><i style="width:${x.happiness.toFixed(0)}%"></i></div><span class="sub">${happyWord(x.happiness)}</span>${g.life.rowHtml(x)}
            <div class="acts"><button class="btn small" data-act="visit" data-id="${x.id}">Visit</button><button class="btn small" data-act="place" data-id="${x.id}">New home</button><button class="btn small" data-act="auction" data-id="${x.id}">Auction</button></div></div>`;
        }
        const sc = rr.slotCost();
        if (sc !== null) html += `<button class="upgrade${R.pearls < sc ? ' poor' : ''}" id="slotUp"><span class="un">More room</span><span class="ub">Space for one more slime (${R.slots + 1} in total).</span>${pearlCost(sc)}</button>`;
      }
      if (R.placed.length) {
        html += `<div class="sec-title">Living elsewhere</div><div class="card">` + R.placed.slice(-8).reverse().map(p => `<div class="row-between"><span>${esc(p.name)}</span><span class="sub">${esc(BUYER_BY_ID[p.buyer]?.name || '')}${p.baby ? ' · growing up there' : ''}</span></div>`).join('') + '</div>';
      }
    }
    this.$('body-ranch').innerHTML = html;
  }
}
