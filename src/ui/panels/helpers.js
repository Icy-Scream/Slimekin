// Shop > Helpers: one button per helper (a ??? teaser for the next one), its rate, how many you own and its price.
// A part of Hud (src/mixin.js): `this` is the Hud. Buying: game.buyHelper (src/game/shop.js).
import { HELPERS } from '../../data/content.js';
import { fmt, fmtShort, fmtRate } from '../../core/format.js';
import { DROP } from '../dom.js';

export class HelpersPanel {
  // ---------- helpers tab ----------
  buildHelpers() {
    const body = this.$('body-helpers');
    body.innerHTML = '<p class="sub" id="helperIntro">Helpers keep your slime happy and gather jelly on their own. You can see each one you buy.</p>';
    this.helperEls = {};
    for (const h of HELPERS) {
      const b = document.createElement('button');
      b.className = 'helper';
      b.id = 'helper-' + h.id;
      b.innerHTML = `${this.icon(h.id, h.name)}<div><div class="hn"></div><div class="hb"></div><div class="hr"></div></div><div class="side"><span class="owned"></span><span class="cost"></span></div>`;
      b.addEventListener('click', () => this.g.buyHelper(h.id));
      body.appendChild(b);
      this.helperEls[h.id] = { b, name: b.querySelector('.hn'), blurb: b.querySelector('.hb'), rate: b.querySelector('.hr'), owned: b.querySelector('.owned'), cost: b.querySelector('.cost') };
    }
  }
  updateHelpers() {
    const sim = this.g.sim, st = this.g.state;
    let teaserShown = false;
    HELPERS.forEach((h, i) => {
      const el = this.helperEls?.[h.id];
      if (!el) return;
      const owned = st.helpers[h.id];
      const cost = sim.helperCost(h.id);
      const revealed = owned > 0 || i === 0 || st.totalJelly >= h.cost * 0.5 || st.helpers[HELPERS[i - 1]?.id] > 0;
      if (!revealed) {
        if (teaserShown) { el.b.hidden = true; return; }
        teaserShown = true;
        el.b.hidden = false;
        el.b.classList.add('mystery');
        el.b.disabled = true;
        el.name.textContent = '???';
        el.blurb.textContent = 'Keep collecting jelly to find out.';
        el.rate.textContent = '';
        el.owned.textContent = '';
        el.cost.innerHTML = `${DROP}${fmtShort(cost)}`;
        el.cost.classList.add('poor');
        return;
      }
      el.b.hidden = false;
      el.b.disabled = false;
      el.b.classList.remove('mystery');
      el.name.textContent = h.name;
      el.blurb.textContent = h.blurb;
      const each = sim.helperJps(h.id) * sim.moodMult() * sim.bondMult() * sim.globalMult();
      el.rate.textContent = owned > 0 ? `${fmtRate(each)}/s each · ${fmtRate(each * owned)}/s total` : `${fmtRate(each)} jelly per second`;
      el.owned.textContent = owned > 0 ? owned : '';
      const html = `${DROP}${fmtShort(cost)}`;
      if (el.cost.dataset.v !== html) { el.cost.innerHTML = html; el.cost.dataset.v = html; }
      el.cost.classList.toggle('poor', !sim.canAfford(cost));
      el.b.setAttribute('aria-label', `Buy ${h.name} for ${fmt(cost)} jelly. You own ${owned}.`);
    });
  }
}
