// Ranch residents leaving for a new home: the offers, the auction, the goodbye, and the postcards they send.
// A part of Game (src/mixin.js): `this` is the Game.
import { esc } from '../ui/esc.js';

export class NewHomesPart {
  // ---------- new homes and auctions ----------
  askPlace(id) {
    const x = this.sim.ranch.resident(id);
    if (!x || this.life.refuse(x)) return;   // (busy: on a trip or in a lesson)
    const offers = this.sim.ranch.offers(x);
    const hearts = f => { const n = Math.max(1, Math.min(5, Math.round((f - 0.75) / 0.6 * 4) + 1)); return '♥'.repeat(n) + '♡'.repeat(5 - n); };
    const name = esc(x.name);
    this.hud.openModal(`<h2>A new home for ${name}</h2>
      <p class="sub">These places would love ${name}. A better fit pays more, and ${name} will send you postcards for a week.</p>
      ${offers.map(o => `<button class="card offer" data-buyer="${o.buyer}"><b>${esc(o.name)}</b><span class="cost"><i class="pearl"></i> ${o.pearls}</span><span class="sub">${esc(o.line)}</span><span class="fit" title="How well ${name} fits">${hearts(o.fit)}</span></button>`).join('')}
      <div class="actions"><button class="btn" id="plNo">Keep ${name}</button></div>`, {
      onOpen: card => {
        card.querySelector('#plNo').addEventListener('click', () => this.hud.closeModal());
        for (const b of card.querySelectorAll('.offer')) b.addEventListener('click', () => {
          const o = offers.find(q => q.buyer === b.dataset.buyer);
          this.hud.closeModal();
          this.confirmPlace(x, o);
        });
      },
    });
  }

  confirmPlace(x, o) {
    const name = esc(x.name);
    this.hud.openModal(`<h2>Say goodbye to ${name}?</h2><p>${name} will go live at ${esc(o.name)}. You get <b>${o.pearls} pearls</b>, and ${name} will write to you.</p>
      <div class="actions"><button class="btn" id="cpNo">Keep ${name}</button><button class="btn primary" id="cpYes">Say goodbye</button></div>`, {
      onOpen: card => {
        card.querySelector('#cpNo').addEventListener('click', () => this.hud.closeModal());
        card.querySelector('#cpYes').addEventListener('click', () => {
          this.hud.closeModal();
          const r = this.sim.ranch.place(x.id, o.buyer);
          if (!r) { this.sfx.error(); return; }
          this.farewell(x, `${x.name} went to live at ${o.name}.`, r.offer.pearls, `They'll send you postcards.`);
        });
      },
    });
  }

  startAuction(id) {
    const x = this.sim.ranch.resident(id);
    if (!x || this.life.refuse(x)) return;   // (busy: on a trip or in a lesson)
    const a = this.sim.ranch.auction(x);
    const name = esc(x.name);
    this.hud.openModal(`<h2>Auction: ${name}</h2><p class="sub" id="aucLine">Buyers are taking their seats...</p>
      <div class="auction-price"><i class="pearl big"></i><span id="aucPrice">${a.opening}</span></div>
      <div class="bids">${a.bidders.map(b => `<div class="bid" data-buyer="${b.buyer}"><span>${esc(b.name)}</span><span class="sub">waiting</span></div>`).join('')}</div>
      <p class="sub">The same buyers come all day, so the result won't change if you try again later today.</p>
      <div class="actions" id="aucActs"><button class="btn" id="aucStop">Keep ${name}</button></div>`, {
      dismiss: false,
      onOpen: card => card.querySelector('#aucStop').addEventListener('click', () => { this.auction = null; this.hud.closeModal(); }),
    });
    const run = this.auction = { id };
    const alive = () => this.auction === run && document.getElementById('aucPrice');
    let t = 1.0;
    a.steps.forEach((st, i) => {
      t += i < 4 ? 0.7 : 0.45;
      this.after(t, () => {
        if (!alive()) return;
        document.getElementById('aucPrice').textContent = st.price;
        document.getElementById('aucLine').textContent = `${st.name} bids ${st.price}!`;
        for (const el of document.querySelectorAll('.bid')) {
          const lead = el.dataset.buyer === st.buyer;
          el.classList.toggle('lead', lead);
          if (lead) el.lastElementChild.textContent = `${st.price} pearls`;
        }
        this.sfx.plip();
      });
    });
    const end = t;
    this.after(end + 0.9, () => { if (alive()) { document.getElementById('aucLine').textContent = 'Going once...'; this.sfx.tickle && this.sfx.tickle(); } });
    this.after(end + 1.8, () => { if (alive()) document.getElementById('aucLine').textContent = 'Going twice...'; });
    this.after(end + 2.7, () => {
      if (!alive()) return;
      for (const el of document.querySelectorAll('.bid')) if (!el.classList.contains('lead')) el.classList.add('out');
      document.getElementById('aucLine').innerHTML = `<b>Sold to ${esc(a.winner.name)} for ${a.price} pearls!</b>`;
      this.sfx.levelUp();
      const acts = document.getElementById('aucActs');
      acts.innerHTML = `<button class="btn" id="aucKeep">Keep ${name}</button><button class="btn primary" id="aucSell">Sell for ${a.price}</button>`;
      acts.querySelector('#aucKeep').addEventListener('click', () => { this.auction = null; this.hud.closeModal(); });
      acts.querySelector('#aucSell').addEventListener('click', () => {
        this.auction = null;
        this.hud.closeModal();
        const r = this.sim.ranch.sellAtAuction(x.id);
        if (!r) { this.sfx.error(); return; }
        this.farewell(x, `${x.name} was sold at auction to ${r.buyer.name}.`, r.price, '');
      });
    });
  }

  // a resident leaves the ranch for its new home
  farewell(x, line, pearls, extra) {
    this.remember('💌', line);
    if (this.ranchFocus === x.id) this.focusResident(null);
    if (this.view === 'ranch') {
      const r = this.ranch.resident(x.id);
      if (r) { r.happyT = 3; r.av.hop(5); }
      this.ranch.leave(x.id, () => this.ranch.sync(this.life.homeResidents()));
    } else this.ranch.sync(this.life.homeResidents());
    this.sfx.sparkle();
    this.hud.toast(`<b>Bye-bye, ${esc(x.name)}! +${pearls} pearls</b>${esc(line)} ${esc(extra)}`, 'love', 4200);
    this.hud.renderRanch(true);
    this.saveNow(true);
  }

  checkPostcards() {
    const cards = this.sim.ranch.postcards();
    cards.forEach((c, i) => this.after(i * 3.5, () => {
      this.remember('💌', `A postcard from ${c.name} at ${c.buyer}: "${c.text}"`);
      this.hud.toast(`<b>Postcard from ${esc(c.name)}</b>"${esc(c.text)}"${c.pearls > 0 ? ` (+${c.pearls} pearls tucked inside)` : ''}`, 'love', 5200);
      this.sfx.sparkle();
    }));
    if (cards.length) this.markDirty(true);
  }
}
