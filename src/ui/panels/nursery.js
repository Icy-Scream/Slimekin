// The Nursery page (inside the Ranch tab): waiting eggs, special eggs, picking two parents, making an egg.
// A part of Hud (src/mixin.js): `this` is the Hud. What the buttons do: src/game/nursery.js.
import { BREEDING, FORM_BY_ID, PURE_LINE } from '../../data/content.js';
import { fmt, fmtDuration } from '../../core/format.js';
import { ICON } from '../icons.js';
import { specialEggsHtml, specialEggColors, nurseryEggTitle, nurseryEggNote } from '../eggs.js';
import { esc } from '../esc.js';

export class NurseryPanel {
  // ---------- the Nursery (inside the Ranch tab) ----------
  pickParent(id) {
    const p = this.nurseryPick;
    if (p.includes(id)) this.nurseryPick = p.filter(x => x !== id);
    else { p.push(id); if (p.length > 2) p.shift(); }
    this.g.sfx.plip();
    this.renderNursery(true);
  }
  renderNursery(force = false) {
    const g = this.g, st = g.state, R = st.ranch, rr = g.sim.ranch, now = g.nowMs();
    const eggs = rr.eggs();
    this.nurseryPick = this.nurseryPick.filter(id => rr.resident(id) && !rr.restingToday(rr.resident(id), now) && !g.life.pickNote(rr.resident(id)));
    const pick = this.nurseryPick;
    const eggPhase = st.phase === 'egg';
    const key = ['nursery', R.pearls, eggs.map(e => e.id + ':' + Math.ceil(rr.eggSecondsLeft(e, now) / 60)).join(','),
      R.residents.map(x => x.id + (rr.restingToday(x, now) ? 'r' : '')).join(','), pick.join(','), JSON.stringify(R.sparks), st.slime.name, st.phase, st.egg.bred?.id || '', g.life.key()].join('|');
    if (!force && key === this.ranchKey) return;
    this.ranchKey = key;
    const cur = esc(st.slime.name || 'your slime');
    const pname = x => esc(x.name);
    let html = `<button class="link-btn" id="nurseryBack">← Back to the ranch</button>`;
    html += `<div class="card"><div class="row-between"><span class="form-name">Nursery</span><span class="sub"><i class="pearl"></i> ${fmt(R.pearls)} pearls</span></div>
      <span class="sub">Two ranch slimes can make an egg together. The baby takes after them a little, but how you raise it decides who it becomes.</span>
      <span class="sub">An egg costs <b>${BREEDING.cost} pearls</b> and is ready in ${fmtDuration(rr.newEggSeconds())} (even while the game is closed). Each slime can be a parent once a day.</span>
      ${eggPhase ? '<span class="sub"><b>An egg is waiting on the cushion at home.</b> Before it hatches, you can put a Nursery egg there instead, even one that is still warming.</span>' : ''}</div>`;
    html += `<div class="sec-title">Waiting eggs <span class="count">${eggs.length} of ${BREEDING.maxEggs}</span></div>`;
    if (!eggs.length) html += '<p class="sub">No eggs yet. Pick two parents below.</p>';
    for (const e of eggs) {
      const left = rr.eggSecondsLeft(e, now), ready = left <= 0, [p, q] = e.parents;
      const cols = (e.special ? specialEggColors(e.special) : g.eggColors(e.bias)) || [];   // recipe body: special eggs
      const done = 1 - left / rr.eggWarmSeconds(e);
      html += `<div class="card egg-card${e.spark ? ' spark' : ''}"><div class="egg-row"><span class="egg-ic${e.spark ? ' spark' : ''}" style="--a:${cols[0] || '#9eefd3'};--b:${cols[1] || '#ffc2dc'}" aria-hidden="true"></span>
        <div>${nurseryEggTitle(e)}${nurseryEggNote(e)}<span class="sub">${ready ? (eggPhase ? 'Ready!' : `Ready! Choose it when ${cur} moves to the ranch.`) : `Ready in ${fmtDuration(left)}${eggPhase ? ' (it can finish warming on the cushion)' : ''}`}</span></div></div>
        ${ready ? '' : `<div class="meter"><i style="width:${(done * 100).toFixed(0)}%"></i></div>`}
        ${e.spark ? `<span class="sub spark-line">${ICON.sparkle}It twinkles! ${pname(p)} and ${pname(q)} share a family spark.</span>` : ''}
        ${e.pure ? `<span class="sub">Both parents are ${esc(FORM_BY_ID[e.pure].name)}s. Raised the same way, the baby becomes a ${esc(PURE_LINE.name(FORM_BY_ID[e.pure].name))}.</span>` : ''}
        <div class="egg-acts">${eggPhase ? `<button class="btn small primary" data-act="cushion" data-egg="${e.id}">Put on the cushion</button>` : ''}<button class="btn small" data-act="giveEgg" data-egg="${e.id}">Give to a neighbor</button></div></div>`;
    }
    html += specialEggsHtml(g);   // recipe body: Cat-ear and Topknot eggs for pearls (ui/eggs.js)
    html += '<div class="sec-title">Pick two parents</div>';
    if (R.residents.length < 2) {
      html += `<div class="card"><span class="sub">Two slimes need to live on the ranch first. When ${cur} is all grown up, move them here too.</span></div>`;
    } else {
      html += '<div class="parent-grid">' + R.residents.map(x => {
        const rest = rr.restingToday(x, now), on = pick.includes(x.id), busy = g.life.pickNote(x);   // (ranch life: on a trip / in a lesson)
        return `<button class="parent-pick" data-act="pickParent" data-id="${x.id}" aria-pressed="${on}" ${rest || busy ? 'disabled' : ''}><b>${pname(x)}</b><span class="sub">${esc(x.form?.name || 'Slime')}</span>${busy ? `<span class="sub">${busy}</span>` : rest ? '<span class="sub">Resting today</span>' : ''}</button>`;
      }).join('') + '</div>';
      const c = pick.length === 2 ? rr.canBreed(pick[0], pick[1], now) : null;
      let msg = pick.length === 0 ? 'Tap two slimes to pick them.' : pick.length === 1 ? 'Now pick one more.' : '';
      if (c && !c.ok) msg = c.reason === 'full' ? (eggPhase ? 'The nest is full. Put a waiting egg on the cushion, or give one to a neighbor.' : `The nest is full. Choose a waiting egg when ${cur} moves to the ranch, or give one to a neighbor.`)
        : c.reason === 'pearls' ? `An egg costs ${BREEDING.cost} pearls. You have ${fmt(R.pearls)}.`
        : c.reason === 'resting' ? `${esc(c.who.join(' and '))} already made an egg today.` : g.life.breedReason(c);
      if (c && c.ok) {
        const [a, b] = pick.map(id => rr.resident(id));
        msg = `${pname(a)} and ${pname(b)} would make a lovely egg.`;
        if (c.spark && R.sparks[c.spark]) msg += ` <span class="spark-line">${ICON.sparkle}They share a family spark!</span>`;
        if (c.pure) msg += ` Both are ${esc(FORM_BY_ID[c.pure].name)}s: their baby could be a ${esc(PURE_LINE.name(FORM_BY_ID[c.pure].name))}.`;
      }
      html += `<p class="sub" id="breedMsg">${msg}</p><button class="btn primary" id="breedBtn" ${c && c.ok ? '' : 'disabled'}>Make an egg · <i class="pearl"></i> ${BREEDING.cost}</button>`;
    }
    this.$('body-ranch').innerHTML = html;
  }
}
