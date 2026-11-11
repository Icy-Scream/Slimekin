// Your slime's page: stage and growth, form, medals, a new home for a baby, family, body, personality, tastes, tummy,
// tricks, bond and stats. A part of Hud (src/mixin.js): `this` is the Hud.
import {
  FOOD_BY_ID, STAGES, TRAITS, TRAIT_IDS, BOND, PERSONALITY, PERSONALITY_IDS, EMOTES, TRICK_LEARNED, SPARK_BY_ID,
  FORM_BY_ID, PURE_LINE, MEDALS,
} from '../../data/content.js';
import { fmt, fmtShort, fmtDuration } from '../../core/format.js';
import { ICON } from '../icons.js';
import { nextMedal } from '../../core/medals.js';
import { breedHtml } from '../eggs.js';
import { esc } from '../esc.js';

export class SlimePanel {
  // ---------- slime tab ----------
  renderSlime() {
    const g = this.g, sim = g.sim, st = g.state, s = st.slime;
    const si = sim.stageIndex();
    const stage = STAGES[si], next = STAGES[si + 1];
    const name = esc(s.name || 'Your slime');
    let html = '';
    html += `<div class="card"><div class="row-between"><span class="form-name">${esc(stage.name)}</span><span class="sub">Day ${g.dayCount()} · <button class="link-btn" id="renameBtn">Rename</button></span></div><span class="sub">${esc(stage.blurb)}</span>`;
    if (next) html += `<div class="meter"><i style="width:${(sim.stageProgress() * 100).toFixed(1)}%"></i></div><div class="row-between"><span class="sub">Growth to ${esc(next.name)}</span><b>${fmt(s.growth)} / ${fmt(next.minGrowth)}</b></div>`;
    html += '</div>';

    if (s.form) {
      html += `<div class="card"><span class="sub">Settled form</span><span class="form-name">${esc(s.form.name)}</span><span class="sub">${esc(s.form.blurb)}</span></div>`;
      if (sim.canMoveOut()) html += `<div class="card"><b>Ready for the ranch</b><span class="sub">${name} is all grown up. Moving to the ranch starts a new generation and raises the Family Bonus by +${sim.moveOutPreview().bonus.toFixed(1)}% to all jelly, forever. The bonus grows from all the jelly your family has ever made.</span><button class="btn" id="slimeMoveOut">Tell me more</button></div>`;
    } else if (si >= 2) {
      const f = sim.formCandidate();
      const sp = s.lineage?.spark && SPARK_BY_ID[s.lineage.spark];
      const stirring = sp && f.id === [...sp.recipe].sort().join('+') ? `<span class="sub spark-line">${ICON.sparkle}Something sparkly is stirring inside ${name}...</span>` : '';
      html += `<div class="card"><span class="sub">Looks like ${name} is becoming</span><span class="form-name">${esc(f.name)}?</span><span class="sub">${esc(f.blurb)} Still changing until they settle.</span>${stirring}</div>`;
    } else {
      html += `<div class="card"><span class="sub">Becoming</span><span class="form-name">Too young to tell</span><span class="sub">What ${name} eats now shapes the slime they grow into.</span></div>`;
    }
    // medals: the one its ceremony played for, and the next step (a medal every x10 of its own jelly)
    {
      const m = sim.medalShown(), nx = m ? nextMedal(m) : MEDALS[0];
      if (m) {
        html += `<div class="card medal-card"><div class="row-between"><span class="medal-row">${this.medalChip(m, 'big')}<b>${esc(m.id === 'ribbon' ? m.name : `${m.name} medal`)}</b></span><span class="sub">${MEDALS.indexOf(m) + 1} of ${MEDALS.length}</span></div>`;
        if (nx) {
          const k = Math.max(0, Math.min(1, (st.totalJelly - m.jelly) / (nx.jelly - m.jelly)));
          html += `<div class="meter"><i style="width:${(k * 100).toFixed(1)}%"></i></div><span class="sub">Next: ${esc(nx.name)} at ${fmtShort(nx.jelly)} of ${name}'s own jelly (${fmtShort(st.totalJelly)} so far).</span>`;
        } else html += `<span class="sub">The very top of the ladder. Wow!</span>`;
        html += `<span class="sub">On the ranch, ${m.id === 'ribbon' ? 'every medal after this one makes more pearls and gets better offers.' : `this medal makes pearls x${m.pearls} and buyers pay +${Math.round(m.offers * 100)}%.`}</span></div>`;
      } else if (si >= 1) {
        html += `<div class="card medal-card"><span class="sub">Medals</span><span class="sub">When ${name} is all grown up they get the Grown-Up Ribbon, then a medal every time their own jelly grows ten times bigger, from Bronze (${fmtShort(MEDALS[1].jelly)}) to Nova (${fmtShort(MEDALS[MEDALS.length - 1].jelly)}).</span></div>`;
      }
    }
    // not grown yet: a kind family can raise them (no pearls and no Family Bonus for a baby)
    if (sim.canRehome()) {
      html += `<div class="card rehome-card"><b>Raising a different egg?</b><span class="sub">A kind family would love to raise ${name}, and ${name} will send you postcards. Babies don't bring pearls or a Family Bonus.</span>
        <button class="btn" id="slimeRehome">Find ${name} a new home</button></div>`;
    }

    const lin = s.lineage || {};
    if (lin.parents?.length === 2) {
      const [p, q] = lin.parents;
      const leaned = TRAIT_IDS.filter(k => (lin.bias?.[k] || 0) >= 5).sort((a, b) => lin.bias[b] - lin.bias[a]).slice(0, 2).map(k => TRAITS[k].name);
      html += `<div class="card"><span class="sub">Family</span><b>Child of ${esc(p.name)} and ${esc(q.name)}</b><span class="sub">${esc(p.form.name)} × ${esc(q.form.name)}.${leaned.length ? ` ${name} started out a little ${esc(leaned.join(' and ').toLowerCase())}, like them.` : ''}</span>`;
      const sp = lin.spark && SPARK_BY_ID[lin.spark];
      if (sp && !s.form) {
        html += `<span class="sub spark-line">${ICON.sparkle}A family spark glows in ${name}. Raised just right, they could grow into something only ${esc(p.name)} and ${esc(q.name)} can pass on.</span>`;
        // the clue comes after a near miss (or once the form is known); before that, finding it is the fun
        if (st.ranch.nearMiss[sp.id] || st.ranch.sparks[sp.id] === 'understood') html += `<span class="sub">Journal clue: ${esc(sp.clue)}</span>`;
      }
      if (lin.pure && !s.form && FORM_BY_ID[lin.pure]) html += `<span class="sub">Both parents are ${esc(FORM_BY_ID[lin.pure].name)}s. If ${name} grows up the same way, they become a ${esc(PURE_LINE.name(FORM_BY_ID[lin.pure].name))}.</span>`;
      html += '</div>';
    }

    const traits = TRAIT_IDS.map(k => [k, s.traits[k]]).filter(e => e[1] > 0.05).sort((a, b) => b[1] - a[1]);
    html += '<div class="sec-title">Body</div><div class="card">';
    html += breedHtml(s);   // recipe body: Curly, Dollop or an in-between (ui/eggs.js)
    if (!traits.length) html += `<span class="sub">No snacks yet. Each snack leaves a trace in ${name}'s body.</span>`;
    const maxT = Math.max(30, ...traits.map(t => t[1]));
    for (const [k, v] of traits) {
      html += `<div class="trait" style="--c:${TRAITS[k].color}"><span>${esc(TRAITS[k].name)}</span><div class="meter"><i style="width:${Math.min(100, v / maxT * 100).toFixed(1)}%"></i></div><span class="n">${Math.round(v)}</span></div>`;
    }
    const badges = traits.filter(([, v]) => v >= 10);
    if (badges.length) html += '<div class="badges">' + badges.map(([k]) => `<span class="badge" style="--c:${TRAITS[k].color}">${esc(TRAITS[k].badge)}</span>`).join('') + '</div>';
    html += '</div>';

    html += '<div class="sec-title">Personality</div><div class="card">';
    let trend = null, trendMag = 0;
    for (const id of PERSONALITY_IDS) {
      const v = s.personality[id];
      const p = PERSONALITY[id];
      const lean = v < 40 ? 'lean-l' : v > 60 ? 'lean-r' : '';
      html += `<div class="persona ${lean}"><span>${esc(p.low)}</span><div class="slider"><i style="left:${v.toFixed(1)}%"></i></div><span>${esc(p.high)}</span></div>`;
      const r = s.recent[id];
      if (Math.abs(r) > trendMag) { trendMag = Math.abs(r); trend = r > 0 ? p.grow : p.shrink; }
    }
    if (trend && trendMag > 0.8) html += `<span class="trend">Lately ${name} is becoming ${esc(trend)}.</span>`;
    html += '</div>';

    const fav = s.knownFavorite ? FOOD_BY_ID[s.favorite].name : '???';
    const dis = s.knownDislike ? FOOD_BY_ID[s.dislike].name : '???';
    html += `<div class="sec-title">Tastes</div><div class="stat-grid"><div class="stat"><div class="k">Favorite</div><div class="v">${esc(fav)}</div></div><div class="stat"><div class="k">Dislikes</div><div class="v">${esc(dis)}</div></div></div>`;
    if (!s.knownFavorite || !s.knownDislike) html += `<p class="sub">Watch ${name}'s face when you hold a snack nearby.</p>`;

    const belly = g.slime.innerItems;
    html += '<div class="sec-title">In the tummy</div>';
    if (!belly.length) html += `<p class="sub">Empty. Snacks stay visible inside ${name} while they dissolve.</p>`;
    else {
      html += '<div class="belly">' + belly.map(it => {
        const left = Math.max(0, 1 - it.age / it.life);
        const label = left > 0.45 ? 'whole' : left > 0.2 ? 'crumbs' : 'almost gone';
        return `<div class="bi" title="${esc(FOOD_BY_ID[it.id].name)}: ${label}">${this.icon(it.id)}<div class="meter"><i style="width:${(left * 100).toFixed(0)}%"></i></div></div>`;
      }).join('') + '</div>';
    }

    html += '<div class="sec-title">Tricks</div><div class="card">';
    for (const em of EMOTES) {
      const n = g.behave.practice(em.id);
      const status = !g.behave.emoteUnlocked(em) ? esc(em.lock) : n >= TRICK_LEARNED ? '<b>Learned</b>' : n > 0 ? `Practicing ${n}/${TRICK_LEARNED}` : 'Not tried yet';
      html += `<div class="row-between"><span>${em.icon} ${esc(em.name)}</span><span class="sub">${status}</span></div>`;
    }
    html += `<span class="sub">Open the smile button and do an emote. ${name} copies you and learns after ${TRICK_LEARNED} tries.</span></div>`;

    const bl = sim.bondLevel();
    const nb = BOND[bl + 1];
    html += `<div class="sec-title">Bond</div><div class="card"><div class="row-between"><b>${esc(BOND[bl].title)}</b><span class="sub">Level ${bl + 1} of ${BOND.length}</span></div>`;
    if (nb) html += `<div class="meter"><i style="width:${(sim.bondProgress() * 100).toFixed(1)}%;background:var(--berry)"></i></div><span class="sub">Next: ${esc(nb.title)}. ${esc(nb.unlock || '')}</span>`;
    html += `<span class="sub">Bond adds ${Math.round((sim.bondMult() - 1) * 100)}% to all jelly. Pet, feed favorites and answer requests to grow it.</span></div>`;

    html += `<div class="sec-title">Together</div><div class="stat-grid">
      <div class="stat"><div class="k">Boops</div><div class="v">${fmt(st.stats.boops)}</div></div>
      <div class="stat"><div class="k">Snacks</div><div class="v">${fmt(st.stats.feeds)}</div></div>
      <div class="stat"><div class="k">Pets</div><div class="v">${fmtDuration(st.stats.petTime)}</div></div>
      <div class="stat"><div class="k">Naps</div><div class="v">${fmt(st.stats.naps)}</div></div>
      <div class="stat"><div class="k">Jelly made</div><div class="v">${fmtShort(st.totalJelly)}</div></div>
      <div class="stat"><div class="k">Time played</div><div class="v">${fmtDuration(st.stats.playTime)}</div></div></div>`;
    this.$('body-slime').innerHTML = html;
    const rb = this.$('renameBtn');
    if (rb) rb.addEventListener('click', () => this.showRename());
    const mo = this.$('slimeMoveOut');
    if (mo) mo.addEventListener('click', () => this.g.askMoveOut());
    const rh = this.$('slimeRehome');
    if (rh) rh.addEventListener('click', () => this.g.askRehome());
  }
}
