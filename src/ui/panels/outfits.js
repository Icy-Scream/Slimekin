// The Outfits page: every outfit, owned or not, worn or not, and the favorite once it is found.
// A part of Hud (src/mixin.js): `this` is the Hud. Buying and wearing: src/game/shop.js.
import { OUTFITS, OUTFIT_BY_ID } from '../../data/content.js';
import { fmtShort } from '../../core/format.js';
import { DROP } from '../dom.js';
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
        const worn = o.worn[def.slot] === def.id;
        const isFav = o.knownFavorite && o.favorite === def.id;
        const action = !owned ? `<span class="cost">${DROP}${fmtShort(def.cost)}</span>` : worn ? '<span class="wear on">Wearing</span>' : '<span class="wear">Wear</span>';
        html += `<button class="outfit${worn ? ' worn' : ''}${owned ? ' owned' : ''}" data-id="${def.id}" aria-pressed="${worn}">${isFav ? '<span class="fav-dot" title="Favorite"></span>' : ''}${this.icon(def.id, def.name)}<span class="on">${esc(def.name)}</span><span class="ob">${esc(def.blurb)}</span>${action}</button>`;
      }
      html += '</div>';
      body.innerHTML = html;
      for (const b of body.querySelectorAll('.outfit')) {
        b.addEventListener('click', () => {
          const id = b.dataset.id;
          if (st.outfits.owned.includes(id)) this.g.wearOutfit(id); else this.g.buyOutfit(id);
          this.renderOutfits();
        });
      }
    }
    for (const b of body.querySelectorAll('.outfit:not(.owned)')) b.classList.toggle('poor', !sim.canAfford(OUTFIT_BY_ID[b.dataset.id].cost));
  }
}
