// The Outfits page: every outfit, owned or not, worn or not, and the favorite once it is found. Each tile has the same
// label as its row in Dress up (Sim.outfitChoice): "✓ Wearing" (a touch takes it off), "Wear", "<price> Buy & wear" or
// "Needs N jelly" (a touch does nothing).
// A part of Hud (src/mixin.js): `this` is the Hud. Buying and wearing: src/game/shop.js.
import { OUTFITS, OUTFIT_BY_ID } from '../../data/content.js';
import { fmtShort } from '../../core/format.js';
import { DROP } from '../dom.js';
import { ICON } from '../icons.js';
import { esc } from '../esc.js';

export class OutfitsPanel {
  // ---------- outfits tab ----------
  renderOutfits() {
    const sim = this.g.sim, st = this.g.state, o = st.outfits;
    const key = o.owned.join(',') + '|' + JSON.stringify(o.worn) + '|' + o.knownFavorite;
    const body = this.$('body-outfits');
    if (key !== this.outfitKey) {
      this.outfitKey = key;
      const name = esc(st.slime.name || 'your slime');
      const fav = o.knownFavorite ? `${name}'s favorite: <b>${esc(OUTFIT_BY_ID[o.favorite].name)}</b>. Wearing it makes them extra happy.` : `${name} secretly has a favorite outfit. Wearing it makes them extra happy.`;
      let html = `<p class="sub">Dress-up for ${name}. One item per spot: head, face and neck. ${fav}</p><div class="outfits">`;
      for (const def of OUTFITS) {
        const owned = o.owned.includes(def.id);
        // what it wears reads Wearing (and a touch takes it off), owned or not: the page shows what the slime wears
        const worn = sim.outfitChoice(def.id) === 'wearing';
        const isFav = o.knownFavorite && o.favorite === def.id;
        // one the family does not own: both labels are drawn and the jelly picks one (the `poor` toggle below)
        const price = fmtShort(def.cost);
        const action = worn ? `<span class="wear on">${ICON.check}Wearing</span>` : owned ? '<span class="wear">Wear</span>'
          : `<span class="cost buy">${DROP}<span><b>${price}</b> Buy &amp; wear</span></span><span class="needs">Needs ${price} jelly</span>`;
        html += `<button class="outfit${worn ? ' worn' : ''}${owned ? ' owned' : ''}" data-id="${def.id}" aria-pressed="${worn}">${isFav ? '<span class="fav-dot" title="Favorite"></span>' : ''}${this.icon(def.id, def.name)}<span class="on">${esc(def.name)}</span><span class="ob">${esc(def.blurb)}</span>${action}</button>`;
      }
      html += '</div>';
      body.innerHTML = html;
      for (const b of body.querySelectorAll('.outfit')) {
        b.addEventListener('click', () => {
          const id = b.dataset.id;
          // what the tile shows decides: "Needs N jelly" does nothing
          if (b.classList.contains('poor')) return;
          if (st.outfits.owned.includes(id) || st.outfits.worn[OUTFIT_BY_ID[id].slot] === id) this.g.wearOutfit(id); else this.g.buyOutfit(id);
          this.renderOutfits();
        });
      }
    }
    for (const b of body.querySelectorAll('.outfit:not(.owned):not(.worn)')) {
      const poor = sim.outfitChoice(b.dataset.id) === 'needs';
      b.classList.toggle('poor', poor);
      if (poor) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
    }
  }
}
