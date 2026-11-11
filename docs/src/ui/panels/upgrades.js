// Shop > Upgrades: the Jelly Jar card, the upgrades you can buy, the ones you own, and your jelly bonuses.
// A part of Hud (src/mixin.js): `this` is the Hud. Buying: game.buyUpgrade, game.buyJar (src/game/shop.js).
import { JAR_LEVELS } from '../../data/content.js';
import { fmtShort, fmtRate } from '../../core/format.js';
import { DROP } from '../dom.js';
import { esc } from '../esc.js';

export class UpgradesPanel {
  // ---------- upgrades tab ----------
  renderUpgrades() {
    const sim = this.g.sim, st = this.g.state;
    const avail = sim.availableUpgrades().sort((a, b) => a.cost - b.cost);
    const jarCost = sim.jarUpgradeCost();
    const key = avail.map(u => u.id).join(',') + '|' + st.upgrades.join(',') + '|' + st.jar.level + '|' + fmtShort(jarCost || 0);
    const body = this.$('body-upgrades');
    if (key !== this.upgradeKey) {
      this.upgradeKey = key;
      let html = '';
      const lvl = JAR_LEVELS[st.jar.level], next = JAR_LEVELS[st.jar.level + 1];
      html += `<div class="card jar-card"><div class="row-between"><b>Jelly Jar</b><span class="sub">Level ${st.jar.level + 1} of ${JAR_LEVELS.length}</span></div>
        <span class="sub">While you're away, it catches ${Math.round(lvl.rate * 100)}% of what your helpers make, for up to ${lvl.hours} hours.</span>`;
      if (next) html += `<button class="upgrade jar-up" id="jarUp"><span class="un">Bigger jar</span><span class="ub">Catches ${Math.round(next.rate * 100)}% for up to ${next.hours} hours.</span><span class="cost">${DROP}${fmtShort(jarCost)}</span></button>`;
      else html += '<span class="sub"><b>Biggest jar there is.</b></span>';
      html += '</div>';
      if (avail.length) {
        html += '<div class="upgrades">' + avail.map(u => `<button class="upgrade" id="up-${u.id}" data-id="${u.id}"><span class="un">${esc(u.name)}</span><span class="ub">${esc(u.blurb)}</span><span class="cost">${DROP}${fmtShort(u.cost)}</span></button>`).join('') + '</div>';
      } else {
        html += '<p class="empty">No upgrades right now.<br>New ones appear as you boop, feed, pet and grow together.</p>';
      }
      if (st.upgrades.length) {
        html += `<div class="sec-title">Owned</div><div class="owned-list">${st.upgrades.map(id => `<span>${esc((this.g.upgradeName(id)))}</span>`).join('')}</div>`;
      }
      html += '<div class="sec-title">Your jelly bonuses</div><div class="card" id="bonusCard"></div>';
      body.innerHTML = html;
      for (const b of body.querySelectorAll('.upgrade[data-id]')) b.addEventListener('click', () => this.g.buyUpgrade(b.dataset.id));
      const ju = body.querySelector('#jarUp');
      if (ju) ju.addEventListener('click', () => this.g.buyJar());
    }
    const ju = body.querySelector('#jarUp');
    if (ju) ju.classList.toggle('poor', !sim.canAfford(jarCost));
    const bc = body.querySelector('#bonusCard');
    if (bc) {
      const pct = m => (m >= 1 ? '+' : '') + Math.round((m - 1) * 100) + '%';
      const rows = [
        ['Joy', `x${sim.moodMult().toFixed(2)}`],
        ['Bond', pct(sim.bondMult())],
        ['Upgrades, tricks and secrets', pct(sim.globalMult() / sim.ranch.familyMult())],
      ];
      if (st.ranch.family.bonus > 0) rows.push(['Family Bonus (ranch)', pct(sim.ranch.familyMult())]);
      if (sim.ranchJps() > 0) rows.push(['Ranch slimes', `+${fmtRate(sim.ranchJps())}/s`]);
      if (sim.buff('jpsMult') !== 1) rows.push(['Active effects', `x${sim.buff('jpsMult').toFixed(1)}`]);
      if (sim.asleep) rows.push(['Dream jelly (napping)', `x${sim.dreamMult().toFixed(2)}`]);
      const html = rows.map(([k, v]) => `<div class="row-between"><span>${k}</span><b>${v}</b></div>`).join('');
      if (bc.dataset.v !== html) { bc.innerHTML = html; bc.dataset.v = html; }
    }
    for (const b of body.querySelectorAll('.upgrade[data-id]')) {
      const u = avail.find(x => x.id === b.dataset.id);
      if (u) b.classList.toggle('poor', !sim.canAfford(u.cost));
    }
    return avail.length;
  }
}
