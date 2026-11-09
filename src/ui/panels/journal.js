// The Journal page: Notes (combos, secrets, a Moving Day clue, memories by day) and the Family tree.
// A part of Hud (src/mixin.js): `this` is the Hud.
import { STAGES, TRAITS, COMBOS, SECRETS, SPARK_FORMS, FORM_BY_ID, FORM_IDS, PURE_LINE, MOVING_DAY } from '../../data/content.js';
import { ICON, memIcon, slimeArt, slimeUnknown } from '../icons.js';
import { residentMedal } from '../../core/medals.js';
import { eggOrigin } from '../eggs.js';
import { esc } from '../esc.js';

export class JournalPanel {
  // ---------- journal tab ----------
  renderJournal(force = false) {
    const st = this.g.state, R = st.ranch;
    const page = this.journalPage || 'notes';
    const key = page + '|' + st.memories.length + '|' + st.combos.join(',') + '|' + this.g.sim.stageIndex() + '|' + st.secrets.length + '|' +
      JSON.stringify(R.sparks) + '|' + R.pures.length + '|' + R.residents.length + '|' + (st.slime.form?.id || '') + '|' + st.slime.name;
    if (!force && key === this.journalKey) return;
    this.journalKey = key;
    const sim = this.g.sim;
    const seg = `<div class="seg journal-seg" role="group" aria-label="Journal pages"><button data-jp="notes" aria-pressed="${page === 'notes'}">Notes</button><button data-jp="family" aria-pressed="${page === 'family'}">Family tree</button></div>`;
    if (page === 'family') {
      this.$('body-journal').innerHTML = seg + this.familyTreeHtml();
      this.bindJournalSeg();
      return;
    }
    let html = seg + '<div class="sec-title">Combos</div><p class="sub">Feed two snacks in a row, quickly, to find combinations.</p>';
    for (const c of COMBOS) {
      const found = st.combos.includes(c.id);
      const ready = c.seq.every(id => sim.foodUnlocked(id));
      if (found) {
        html += `<div class="combo"><span class="pair">${this.icon(c.seq[0])}${this.icon(c.seq[1])}</span><span class="cn">${esc(c.name)}</span><span class="ce">${esc(c.effect)}</span></div>`;
      } else {
        html += `<div class="combo unknown"><span class="pair" style="opacity:.35">${ready ? '' : ''}</span><span class="cn">${ready ? esc(c.hint) : 'Needs snacks you have not unlocked yet'}</span><span class="ce">Undiscovered</span></div>`;
      }
    }
    html += `<div class="sec-title">Secrets <span class="count">${st.secrets.length} of ${SECRETS.length}</span></div><p class="sub">Hidden things your slime does. Each clue hints at one.</p>`;
    for (const sd of SECRETS) {
      if (st.secrets.includes(sd.id)) html += `<div class="combo secret"><span class="pair"><span class="sx">${ICON.sparkle}</span></span><span class="cn">${esc(sd.name)}</span><span class="ce">${esc(sd.text)}</span></div>`;
      else html += `<div class="combo unknown"><span class="pair"><span class="sx">?</span></span><span class="cn">${esc(sd.clue)}</span><span class="ce">Not found yet</span></div>`;
    }
    // one vague Moving Day clue, like the secrets, once the family has had a grown-up slime
    if (sim.stageIndex() === STAGES.length - 1 || R.residents.length || R.family.generation > 1) {
      html += `<div class="sec-title">Something to watch for</div><div class="combo unknown moving-day-clue"><span class="pair"><span class="sx">?</span></span><span class="cn">${esc(MOVING_DAY.clue)}</span><span class="ce">A clue</span></div>`;
    }
    html += '<div class="sec-title">Memories</div>';
    const born = st.slime.bornAt || st.createdAt;
    const mems = [...st.memories].reverse();
    if (!mems.length) html += '<p class="empty">Your story together starts soon.</p>';
    let lastDay = null;
    for (const m of mems) {
      const day = Math.max(1, Math.floor((m.t - born) / 86400000) + 1);
      if (day !== lastDay) { html += `<div class="mem-day">Day ${day}</div>`; lastDay = day; }
      const d = new Date(m.t);
      const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const ic = this.icons[m.icon] ? `<img src="${this.icons[m.icon]}" alt="">` : memIcon(m.icon, esc(m.icon || '•'));
      html += `<div class="mem"><span class="ic">${ic}</span><div>${esc(m.text)}<time>${time}</time></div></div>`;
    }
    this.$('body-journal').innerHTML = html;
    this.bindJournalSeg();
  }
  bindJournalSeg() {
    for (const b of this.$('body-journal').querySelectorAll('[data-jp]')) b.addEventListener('click', () => {
      this.journalPage = b.dataset.jp;
      this.$('body-journal').scrollTop = 0;
      this.renderJournal(true);
    });
  }

  // Family tree: the slime with its two parents, then the spark forms (unknown / observed / understood,
  // per the design doc's knowledge states), Pure forms raised, and the families living on the ranch.
  familyTreeHtml() {
    const g = this.g, st = g.state, R = st.ranch, s = st.slime, lin = s.lineage || {};
    // the same form colors as a drawn slime (pair forms split into their two snack colors)
    const formArt = (id, motif) => {
      if (!id) return slimeArt('#bfeedd');
      const sp = SPARK_FORMS.find(x => x.look === id);
      if (sp) return slimeArt(sp.color, sp.id);
      const ks = id.split('+').filter(k => TRAITS[k]);
      return slimeArt(ks.length ? ks.map(k => TRAITS[k].color) : '#fbeef4', motif);
    };
    const node = (name, formName, cls = '', formId = null, medal = null) => `<div class="tree-node ${cls}">${cls.includes('unknown') ? slimeUnknown() : formArt(formId)}<b>${esc(name)}${medal ? ' ' + this.medalChip(medal) : ''}</b><span class="sub">${esc(formName)}</span></div>`;
    // a parent still on the ranch shows its medal (one that moved away is not known here)
    const parentMedal = p => { const x = R.residents.find(r => r.id === p.id); return x ? residentMedal(x) : null; };
    const me = s.name || 'Your slime';
    const myForm = s.form ? s.form.name : st.phase === 'egg' ? 'Still an egg' : `${g.sim.stage().name}, still growing`;
    let html = `<div class="sec-title">${esc(me)}'s family</div><div class="card tree">`;
    if (lin.parents?.length === 2) {
      const [p, q] = lin.parents;
      html += `<div class="tree-parents">${node(p.name, p.form.name, 'parent', p.form.id, parentMedal(p))}<span class="tree-heart" aria-hidden="true">${ICON.heart}</span>${node(q.name, q.form.name, 'parent', q.form.id, parentMedal(q))}</div>
        <div class="tree-line" aria-hidden="true"></div>`;
    } else {
      html += `<div class="tree-parents">${node('?', eggOrigin(lin), 'parent unknown')}</div><div class="tree-line" aria-hidden="true"></div>`;
    }
    html += node(me, myForm, 'me' + (s.form?.pure ? ' pure' : '') + (s.form?.spark ? ' spark' : ''), s.form?.id || (st.phase === 'egg' ? null : 'mochi'), st.phase === 'play' ? g.sim.medalShown() : null);
    html += `<span class="sub tree-note">Generation ${R.family.generation} of your family.${lin.line > 1 ? ` ${esc(me)} is number ${lin.line} in its family line.` : ' The first of a new family line.'}</span>`;
    if (lin.spark) html += `<span class="sub spark-line">${ICON.sparkle}${esc(me)} carries a family spark.</span>`;
    if (lin.pure && FORM_BY_ID[lin.pure]) html += `<span class="sub">Both parents were ${esc(FORM_BY_ID[lin.pure].name)}s.</span>`;
    html += '</div>';

    const found = SPARK_FORMS.filter(x => R.sparks[x.id] === 'understood').length;
    html += `<div class="sec-title">Spark forms <span class="count">${found} of ${SPARK_FORMS.length}</span></div><p class="sub">Some pairs of parents share a family spark. Raised just right, their baby becomes something only they can pass on.</p>`;
    for (const x of SPARK_FORMS) {
      const k = R.sparks[x.id];
      const [fa, fb] = x.parents.map(id => FORM_BY_ID[id]?.name || '?');
      if (k === 'understood') {
        html += `<div class="combo spark-entry"><span class="pair">${slimeArt(x.color, x.id)}</span><span class="cn">${esc(x.name)}</span>
          <span class="ce">${esc(x.blurb)} ${esc(fa)} × ${esc(fb)}, raised on ${x.recipe.map(t => esc(TRAITS[t].name)).join(' + ')} snacks.</span></div>`;
      } else if (k === 'observed') {
        const misses = R.nearMiss[x.id] || 0;
        html += `<div class="combo unknown spark-entry"><span class="pair">${slimeUnknown()}</span><span class="cn">A spark between ${esc(fa)} and ${esc(fb)}</span>
          <span class="ce">${misses ? `Clue: ${esc(x.clue)} (${misses} near miss${misses === 1 ? '' : 'es'} so far)` : 'Seen in an egg. Their baby needs to be raised just right: try different snacks!'}</span></div>`;
      } else {
        html += `<div class="combo unknown spark-entry"><span class="pair">${slimeUnknown()}</span><span class="cn">${esc(x.hint)}</span><span class="ce">Not found yet</span></div>`;
      }
    }
    html += `<div class="sec-title">Pure forms <span class="count">${R.pures.length} of ${FORM_IDS.length}</span></div><p class="sub">Two parents of the same form, and a baby raised the same way, make a Pure version.</p>`;
    html += R.pures.length ? `<div class="badges">${R.pures.map(id => `<span class="badge pure-badge">${ICON.sparkle}${esc(PURE_LINE.name(FORM_BY_ID[id].name))}</span>`).join('')}</div>` : '<p class="empty">None yet.</p>';
    const fams = R.residents.filter(x => x.lineage?.parents?.length === 2);
    if (fams.length) {
      html += '<div class="sec-title">Families on the ranch</div><div class="card">';
      html += fams.map(x => `<div class="row-between"><span><b>${esc(x.name)}</b> ${this.medalChip(residentMedal(x))} <span class="sub">${esc(x.form?.name || '')}</span></span><span class="sub">${esc(x.lineage.parents[0].name)} × ${esc(x.lineage.parents[1].name)}</span></div>`).join('');
      html += '</div>';
    }
    return html;
  }
}
