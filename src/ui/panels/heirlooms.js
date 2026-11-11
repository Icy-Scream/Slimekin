// The Heirlooms page and its tab's glow (the tab button itself is made in hud.js mountJellyLoop).
// A part of Hud (src/mixin.js): `this` is the Hud. Buying: game.buyHeirloom (src/game/shop.js).
import { HEIRLOOMS, HEIRLOOM_TAB } from '../../data/content.js';
import { fmt, fmtShort } from '../../core/format.js';
import { memIcon } from '../icons.js';
import { DROP } from '../dom.js';
import { esc } from '../esc.js';

export class HeirloomsPanel {
  // ---------- the Heirlooms page (its own tab; see mountJellyLoop) ----------
  // Owned ones say where they live; the next few unowned show price, effect and Buy; the rest are silhouettes.
  renderHeirlooms(force = false) {
    const sim = this.g.sim, st = this.g.state, H = st.heirlooms;
    if (this.tab === 'heirlooms' && this.panelVisible() && sim.markHeirloomsSeen()) this.g.markDirty(false);
    const next = HEIRLOOMS.filter(h => !H.owned.includes(h.id)).slice(0, HEIRLOOM_TAB.showNext).map(h => h.id);
    const key = H.owned.join(',') + '|' + next.map(id => id + (sim.canBuyHeirloom(id).ok ? '+' : '-')).join(',');
    const body = this.$('body-heirlooms');
    if (!force && key === this.heirloomKey) return;
    this.heirloomKey = key;
    let html = `<div class="card heirloom-intro"><span class="form-name">Heirlooms</span><span class="sub">Family treasures, bought with jelly. They stay forever and help every slime after this one. Spending jelly never lowers the Family Bonus: it counts all the jelly your family ever made.</span></div>`;
    for (const h of HEIRLOOMS) {
      const ic = (cls = '') => `<span class="hl-ic${cls}" aria-hidden="true">${memIcon(h.icon, esc(h.icon))}</span>`;
      if (H.owned.includes(h.id)) {
        html += `<div class="card heirloom owned" data-id="${h.id}">${ic()}<div class="hl-txt"><b>${esc(h.name)}</b><span class="sub">${esc(h.effect)}</span><span class="sub hl-where">Lives ${esc(h.where)}</span></div></div>`;
      } else if (next.includes(h.id)) {
        const ok = sim.canBuyHeirloom(h.id).ok;
        const act = h.buyable === false ? `<span class="sub hl-soon">${esc(h.soon || 'Not for sale yet.')}</span>`
          : `<button class="btn${ok ? ' primary' : ''} hl-buy" data-buy="${h.id}" ${ok ? '' : 'disabled'} aria-label="Buy the ${esc(h.name)} for ${fmt(h.price)} jelly">Buy <span class="cost${ok ? '' : ' poor'}">${DROP}${fmtShort(h.price)}</span></button>`;
        html += `<div class="card heirloom next${ok ? ' can' : ''}" data-id="${h.id}">${ic()}<div class="hl-txt"><b>${esc(h.name)}</b><span class="sub">${esc(h.effect)}</span><span class="sub hl-where">Will live ${esc(h.where)}</span>${act}</div></div>`;
      } else {
        html += `<div class="card heirloom unknown" data-id="${h.id}">${ic(' sil')}<div class="hl-txt"><b>???</b><span class="sub">A family treasure still to find.</span></div></div>`;
      }
    }
    body.innerHTML = html;
  }
  // The chest glows while an heirloom you don't own has just become affordable; looking at the page stops it.
  updateHeirloomTab() {
    const sim = this.g.sim, onPage = this.tab === 'heirlooms' && this.panelVisible();
    if (onPage) this.renderHeirlooms();
    const glow = !onPage && sim.newlyAffordableHeirlooms().length > 0;
    const t = this.$('tab-heirlooms');
    if (t.classList.contains('glow') !== glow) t.classList.toggle('glow', glow);
  }
}
