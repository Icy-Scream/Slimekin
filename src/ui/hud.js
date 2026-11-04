// DOM interface: counters, snack tray, shop tabs, journal, slime profile,
// speech/request bubbles, floating numbers, toasts and modals.
import {
  FOODS, FOOD_BY_ID, HELPERS, STAGES, TRAITS, TRAIT_IDS, BOND, PERSONALITY, PERSONALITY_IDS, COMBOS, NAME_IDEAS,
  EMOTES, SECRETS, TRICK_LEARNED, JAR_LEVELS, OUTFITS, OUTFIT_BY_ID, RANCH, BUYER_BY_ID,
} from '../data/content.js';
import { fmt, fmtShort, fmtRate, fmtDuration } from '../core/format.js';

const DROP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c3.7 4.6 6.6 8.4 6.6 12a6.6 6.6 0 0 1-13.2 0c0-3.6 2.9-7.4 6.6-12z"/></svg>';
const DICE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM7.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>';
const FALLBACK = { cookie: '🍪', chili: '🌶️', iron: '🔩', moss: '🌿', berry: '🫐', crystal: '💎', feather: '🪶', bubbles: '🫧', garden: '🌱', slimeling: '💧', musicbox: '🎶', lamp: '🌙', fountain: '⛲', observatory: '🔭' };

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Hud {
  constructor(game) {
    this.g = game;
    this.$ = id => document.getElementById(id);
    this.icons = {};
    this.tab = 'helpers';
    this.slowT = 0;
    this.fastT = 0;
    this.upgradeKey = '';
    this.journalKey = '';
    this.askEl = null;
    this.sayEl = null;
    this.floats = 0;
    this.modalOpen = false;
    this.bindTabs();
    this.$('settingsBtn').addEventListener('click', () => this.g.openSettings());
    this.$('emoteBtn').addEventListener('click', () => this.toggleEmotes());
    this.$('emoteFab').addEventListener('click', () => this.toggleEmotes());
    this.$('jarBtn').addEventListener('click', () => this.g.collectJar());
    this.$('pearlBtn').addEventListener('click', () => this.openTab('ranch'));
    this.$('homeBtn').addEventListener('click', () => this.g.leaveRanch());
    this.$('basketBtn').addEventListener('click', () => this.g.collectBasket());
    this.ranchKey = '';
    this.$('body-ranch').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const g = this.g, id = b.dataset.id;
      if (b.id === 'moveOutBtn') g.askMoveOut();
      else if (b.id === 'collectBasket') g.collectBasket();
      else if (b.id === 'basketUp') g.buyBasket();
      else if (b.id === 'slotUp') g.buyRanchSlot();
      else if (b.id === 'ranchBack') g.focusResident(null);
      else if (b.id === 'ranchHome') g.leaveRanch();
      else if (b.dataset.act === 'visit') g.focusResident(id);
      else if (b.dataset.act === 'place') g.askPlace(id);
      else if (b.dataset.act === 'auction') g.startAuction(id);
    });
    this.pending = 0; this.pendingRate = 0;
    this.outfitKey = '';
    this.buildEmotes();
    this.setupSheetSwipe();
    this.setupToastDrag();
    this.$('nameBtn').addEventListener('click', () => { if (this.g.state.phase === 'play') this.g.behave.answerName(); });
    this.$('modal').addEventListener('pointerdown', e => {
      if (e.target === this.$('modal') && this.modalDismiss) this.closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.modalOpen && this.modalDismiss) this.closeModal();
    });
  }

  icon(id, alt = '') {
    if (this.icons[id]) return `<img src="${this.icons[id]}" alt="${esc(alt)}" draggable="false">`;
    return `<span style="font-size:30px;line-height:1" aria-hidden="true">${FALLBACK[id] || '•'}</span>`;
  }

  setIcons(icons) {
    this.icons = icons || {};
    this.buildTray();
    this.buildHelpers();
    this.upgradeKey = '';
    this.journalKey = '';
  }

  setPhase(phase) {
    this.$('ui').classList.toggle('egg', phase !== 'play');
  }

  // ---------- tabs / panel ----------
  bindTabs() {
    const panel = this.$('panel');
    for (const btn of panel.querySelectorAll('.tab')) {
      btn.addEventListener('click', () => {
        const t = btn.dataset.tab;
        const mobile = window.matchMedia('(max-width: 860px)').matches;
        if (mobile && panel.classList.contains('open') && this.tab === t) {
          panel.classList.remove('open');
        } else {
          if (mobile) panel.classList.add('open');
          if (this.tab !== t || t === 'ranch') this.selectTab(t);
        }
        this.g.layoutChanged();
      });
    }
  }
  selectTab(t) {
    this.tab = t;
    for (const btn of this.$('panel').querySelectorAll('.tab')) {
      btn.setAttribute('aria-selected', btn.dataset.tab === t ? 'true' : 'false');
      if (btn.dataset.tab === t) btn.querySelector('.dot').hidden = true;
    }
    for (const id of ['helpers', 'upgrades', 'outfits', 'journal', 'slime', 'ranch']) this.$('body-' + id).hidden = id !== t;
    if (t === 'ranch') { this.ranchKey = ''; this.renderRanch(); }
    this.g.onTab && this.g.onTab(t);
    if (t === 'outfits') { this.outfitKey = ''; this.renderOutfits(); }
    if (t === 'journal') { this.journalKey = ''; this.renderJournal(); }
    if (t === 'slime') this.renderSlime();
    if (t === 'upgrades') { this.upgradeKey = ''; this.renderUpgrades(); }
  }
  openTab(t) {
    const mobile = window.matchMedia('(max-width: 860px)').matches;
    if (mobile) this.$('panel').classList.add('open');
    this.selectTab(t);
    this.g.layoutChanged();
  }
  dot(tab) {
    if (this.tab === tab && this.panelVisible()) return;
    const b = this.$('tab-' + tab);
    if (b) b.querySelector('.dot').hidden = false;
  }
  panelVisible() {
    const mobile = window.matchMedia('(max-width: 860px)').matches;
    return !mobile || this.$('panel').classList.contains('open');
  }

  // ---------- emotes ----------
  buildEmotes() {
    const bar = this.$('emotes');
    bar.innerHTML = '';
    this.emoteEls = {};
    for (const e of EMOTES) {
      const b = document.createElement('button');
      b.className = 'emote';
      b.id = 'emote-' + e.id;
      b.innerHTML = `<span class="ei" aria-hidden="true">${e.icon}</span><span class="en">${esc(e.name)}</span><span class="ed">${'<i></i>'.repeat(TRICK_LEARNED)}</span>`;
      b.addEventListener('click', () => this.g.behave.doEmote(e.id, b));
      bar.appendChild(b);
      this.emoteEls[e.id] = { b, dots: [...b.querySelectorAll('.ed i')] };
    }
  }
  toggleEmotes(force) {
    const bar = this.$('emotes');
    const open = force ?? bar.hidden;
    bar.hidden = !open;
    for (const id of ['emoteBtn', 'emoteFab']) {
      this.$(id).setAttribute('aria-expanded', String(open));
      this.$(id).classList.remove('pulse');
    }
    if (open) this.updateEmotes();
    this.g.layoutChanged();
  }
  updateEmotes() {
    const bh = this.g.behave;
    if (!bh || !this.emoteEls) return;
    for (const e of EMOTES) {
      const el = this.emoteEls[e.id];
      const unlocked = bh.emoteUnlocked(e);
      const n = Math.min(TRICK_LEARNED, bh.practice(e.id));
      el.b.classList.toggle('locked', !unlocked);
      el.b.classList.toggle('learned', n >= TRICK_LEARNED);
      el.dots.forEach((d, i) => d.classList.toggle('on', i < n));
      const title = !unlocked ? `${e.name}: ${e.lock}` : n >= TRICK_LEARNED ? `${e.name}: learned! Your slime does this on its own now.` : `${e.name}: your slime copies you. Practice ${TRICK_LEARNED - n} more time${TRICK_LEARNED - n === 1 ? '' : 's'} to teach it.`;
      if (el.b.title !== title) { el.b.title = title; el.b.setAttribute('aria-label', title); }
    }
  }
  pulseEmoteButton() {
    for (const id of ['emoteBtn', 'emoteFab']) {
      const b = this.$(id);
      b.classList.add('pulse');
      setTimeout(() => b.classList.remove('pulse'), 12000);
    }
  }
  playerEmote(def, fromEl) {
    const el = fromEl || this.emoteEls?.[def.id]?.b;
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight - 160, width: 0, height: 0 };
    const f = document.createElement('div');
    f.className = 'float emoji';
    f.textContent = def.icon;
    f.style.left = (r.left + r.width / 2) + 'px';
    f.style.top = (r.top) + 'px';
    this.$('floatLayer').appendChild(f);
    f.addEventListener('animationend', () => f.remove());
    setTimeout(() => f.isConnected && f.remove(), 1800);
  }

  // ---------- snack tray ----------
  buildTray() {
    const tray = this.$('tray');
    tray.innerHTML = '';
    this.foodEls = {};
    FOODS.forEach((f, i) => {
      const b = document.createElement('button');
      b.className = 'food';
      b.id = 'food-' + f.id;
      b.innerHTML = `<span class="key" aria-hidden="true">${i + 1}</span>${this.icon(f.id, f.name)}<span class="fn">${esc(f.name)}</span><span class="fp"></span>`;
      b.addEventListener('pointerdown', e => this.g.foodPointerDown(f.id, e, b));
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.g.tossFood(f.id, b); } });
      b.addEventListener('contextmenu', e => e.preventDefault());
      tray.appendChild(b);
      this.foodEls[f.id] = { b, price: b.querySelector('.fp') };
    });
  }
  updateTray() {
    const sim = this.g.sim;
    const s = sim.slime;
    for (const f of FOODS) {
      const el = this.foodEls[f.id];
      if (!el) continue;
      const unlocked = sim.foodUnlocked(f.id);
      const price = sim.foodPrice(f.id);
      el.b.classList.toggle('locked', !unlocked);
      el.b.classList.toggle('poor', unlocked && !sim.canAfford(price));
      el.b.classList.toggle('fav', unlocked && s.knownFavorite && s.favorite === f.id);
      const stageName = STAGES.find(st => st.id === f.unlock).name;
      const html = unlocked ? `${DROP}${fmtShort(price)}` : `${stageName}`;
      if (el.price.dataset.v !== html) { el.price.innerHTML = html; el.price.dataset.v = html; }
      const title = unlocked ? `${f.name}: ${f.blurb} Drag onto your slime, or tap to toss it.` : `${f.name}: unlocks when your slime becomes a ${stageName}.`;
      if (el.b.title !== title) { el.b.title = title; el.b.setAttribute('aria-label', `${f.name}, ${unlocked ? fmt(price) + ' jelly' : 'locked'}`); }
    }
  }
  shakeFood(id) {
    const el = this.foodEls?.[id]?.b;
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

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

  pourJelly(rect, amt) {
    const target = this.$('jellyCount').getBoundingClientRect();
    const tx = target.left + target.width / 2, ty = target.top + target.height / 2;
    const sx = rect.left + rect.width / 2, sy = rect.top + rect.height / 2;
    for (let i = 0; i < 10; i++) {
      const d = document.createElement('div');
      d.className = 'pour';
      d.innerHTML = DROP;
      this.$('floatLayer').appendChild(d);
      const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 160, my = Math.min(sy, ty) - 60 - Math.random() * 60;
      const anim = d.animate([
        { transform: `translate(${sx}px, ${sy}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${mx}px, ${my}px) scale(1.1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${tx}px, ${ty}px) scale(.5)`, opacity: 0.2 },
      ], { duration: 650 + i * 45, delay: i * 40, easing: 'ease-in-out', fill: 'both' });
      anim.onfinish = () => d.remove();
      setTimeout(() => d.isConnected && d.remove(), 2000);
    }
    this.pending = amt;
    this.pendingRate = amt / 1.0;
    this.floatText(tx, ty + 40, '+' + fmt(amt), 'big');
    this.fastT = 0;
  }

  // ---------- journal tab ----------
  renderJournal(force = false) {
    const st = this.g.state;
    const key = st.memories.length + '|' + st.combos.join(',') + '|' + this.g.sim.stageIndex() + '|' + st.secrets.length;
    if (!force && key === this.journalKey) return;
    this.journalKey = key;
    const sim = this.g.sim;
    let html = '<div class="sec-title">Combos</div><p class="sub">Feed two snacks in a row, quickly, to find combinations.</p>';
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
      if (st.secrets.includes(sd.id)) html += `<div class="combo secret"><span class="pair"><span class="sx">✦</span></span><span class="cn">${esc(sd.name)}</span><span class="ce">${esc(sd.text)}</span></div>`;
      else html += `<div class="combo unknown"><span class="pair"><span class="sx">?</span></span><span class="cn">${esc(sd.clue)}</span><span class="ce">Not found yet</span></div>`;
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
      const ic = this.icons[m.icon] ? `<img src="${this.icons[m.icon]}" alt="">` : esc(m.icon || '•');
      html += `<div class="mem"><span class="ic">${ic}</span><div>${esc(m.text)}<time>${time}</time></div></div>`;
    }
    this.$('body-journal').innerHTML = html;
  }

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
      if (sim.canMoveOut()) html += `<div class="card"><b>Ready for the ranch</b><span class="sub">${name} is all grown up. Moving to the ranch starts a new generation and adds a Family Bonus of +${sim.moveOutPreview().bonus.toFixed(1)}% to all jelly, forever.</span><button class="btn" id="slimeMoveOut">Tell me more</button></div>`;
    } else if (si >= 2) {
      const f = sim.formCandidate();
      html += `<div class="card"><span class="sub">Looks like ${name} is becoming</span><span class="form-name">${esc(f.name)}?</span><span class="sub">${esc(f.blurb)} Still changing until they settle.</span></div>`;
    } else {
      html += `<div class="card"><span class="sub">Becoming</span><span class="form-name">Too young to tell</span><span class="sub">What ${name} eats now shapes the slime they grow into.</span></div>`;
    }

    const traits = TRAIT_IDS.map(k => [k, s.traits[k]]).filter(e => e[1] > 0.05).sort((a, b) => b[1] - a[1]);
    html += '<div class="sec-title">Body</div><div class="card">';
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
  }

  // ---------- ranch tab ----------
  renderRanch(force = false) {
    const g = this.g, sim = g.sim, st = g.state, R = st.ranch, rr = sim.ranch;
    const focus = g.ranchFocus ? rr.resident(g.ranchFocus) : null;
    const fm = rr.familyMult();
    const canMove = sim.canMoveOut();
    const key = [R.pearls, R.basket.stored, R.basket.level, R.slots, R.residents.map(x => x.id + ':' + Math.round(x.happiness / 5)).join(','), focus && focus.id, canMove, R.placed.length, st.slime.name].join('|');
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
      html += `<div class="card"><div class="row-between"><span class="form-name">${esc(x.name)}</span><span class="sub">Generation ${x.generation}</span></div>
        <b>${esc(x.form?.name || 'Slime')}</b><span class="sub">${esc(x.form?.blurb || '')}</span>
        <div class="row-between"><span class="sub">${happyWord(x.happiness)}</span><span class="sub">${Math.round(x.happiness)}%</span></div><div class="meter"><i style="width:${x.happiness.toFixed(0)}%;background:linear-gradient(90deg,#ffb0c8,var(--berry))"></i></div>
        <span class="sub">Tap or stroke ${esc(x.name)} to pet them. Happy slimes make pearls faster.</span></div>`;
      html += `<div class="stat-grid">
        <div class="stat"><div class="k">Jelly</div><div class="v">${fmtRate(x.jps * fm)}/s</div></div>
        <div class="stat"><div class="k">Pearls</div><div class="v">~${(rr.pearlRate(x) * 3600).toFixed(1)}/hour</div></div>
        <div class="stat"><div class="k">Made of</div><div class="v">${esc(traits || 'A bit of everything')}</div></div>
        <div class="stat"><div class="k">Favorite snack</div><div class="v">${esc(FOOD_BY_ID[x.favorite]?.name || '?')}</div></div></div>`;
      if (lean) html += `<p class="sub">Personality: ${esc(lean)}. Bond: ${esc(BOND[x.bondLevel || 0].title)}.</p>`;
      const mem = (x.memories || []).slice(-6).reverse();
      if (mem.length) html += `<div class="sec-title">${esc(x.name)}'s story</div><div class="card">` + mem.map(m => `<div class="sub">${m.icon} ${esc(m.text)}</div>`).join('') + '</div>';
      html += `<div class="res"><div class="acts"><button class="btn" data-act="place" data-id="${x.id}">Find a new home</button><button class="btn" data-act="auction" data-id="${x.id}">Auction</button></div></div>`;
    } else {
      html += `<button class="link-btn" id="ranchHome">← Back home</button>`;
      html += `<div class="card"><div class="row-between"><span class="form-name">Slime Ranch</span><span class="sub">Generation ${R.family.generation}</span></div>
        <div class="big-num"><i class="pearl big"></i>${fmt(R.pearls)}<span class="sub">pearls</span></div>
        <span class="sub">${R.family.bonus > 0 ? `Family Bonus: <b>+${R.family.bonus.toFixed(1)}%</b> to all jelly, forever.` : 'Every slime that moves here adds a Family Bonus to all your jelly, forever.'}</span>
        ${R.residents.length ? `<span class="sub">The ranch makes <b>${fmtRate(sim.ranchJps())}</b> jelly a second and about <b>${rr.pearlsPerHour().toFixed(1)}</b> pearls an hour.</span>` : ''}</div>`;
      const name = esc(st.slime.name || 'Your slime');
      if (canMove) {
        const pv = sim.moveOutPreview();
        html += `<div class="card"><b>${name} is all grown up</b><span class="sub">Moving to the ranch starts a new generation with a new egg. ${name} adds <b>+${pv.bonus.toFixed(1)}%</b> Family Bonus and makes ${fmtRate(pv.jps * (1 + (R.family.bonus + pv.bonus) / 100))} jelly a second plus pearls on the ranch. The longer you play first, the bigger the bonus.</span>
          <button class="btn primary" id="moveOutBtn">${pv.room ? `Move ${name} to the ranch` : 'The ranch is full'}</button></div>`;
      } else if (!R.residents.length) {
        html += `<div class="card"><b>Nobody lives here yet</b><span class="sub">When ${name} is all grown up (Settled), they can move to the ranch. They keep making jelly and pearls, you raise a new baby, and every generation adds a Family Bonus to all your jelly.</span></div>`;
      }
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
          html += `<div class="card res"><span class="nm">${esc(x.name)}</span><span class="sub">Gen ${x.generation}</span>
            <span class="sub">${esc(x.form?.name || 'Slime')}</span><span class="sub">${fmtRate(x.jps * fm)} jelly/s</span>
            <div class="meter" title="Happiness"><i style="width:${x.happiness.toFixed(0)}%"></i></div><span class="sub">${happyWord(x.happiness)}</span>
            <div class="acts"><button class="btn small" data-act="visit" data-id="${x.id}">Visit</button><button class="btn small" data-act="place" data-id="${x.id}">New home</button><button class="btn small" data-act="auction" data-id="${x.id}">Auction</button></div></div>`;
        }
        const sc = rr.slotCost();
        if (sc !== null) html += `<button class="upgrade${R.pearls < sc ? ' poor' : ''}" id="slotUp"><span class="un">More room</span><span class="ub">Space for one more slime (${R.slots + 1} in total).</span>${pearlCost(sc)}</button>`;
      }
      if (R.placed.length) {
        html += `<div class="sec-title">Living elsewhere</div><div class="card">` + R.placed.slice(-8).reverse().map(p => `<div class="row-between"><span>${esc(p.name)}</span><span class="sub">${esc(BUYER_BY_ID[p.buyer]?.name || '')}</span></div>`).join('') + '</div>';
      }
    }
    this.$('body-ranch').innerHTML = html;
  }

  // ---------- per-frame ----------
  update(dt) {
    const g = this.g, sim = g.sim, st = g.state, s = st.slime;
    if (this.pending > 0) this.pending = Math.max(0, this.pending - this.pendingRate * dt);
    this.fastT -= dt;
    if (this.fastT <= 0) {
      this.fastT = 1 / 15;
      const shown = Math.max(0, st.jelly - this.pending);
      this.$('jellyCount').textContent = (innerWidth < 560 && shown >= 1e6) ? fmtShort(shown) : fmt(shown);
      const jb = this.$('jarBtn');
      const stored = st.jar.stored;
      jb.hidden = stored < 1;
      if (stored >= 1) {
        const k = Math.min(1, stored / Math.max(1, sim.jarCapacity()));
        this.$('jarFill').setAttribute('y', (22 - 14 * k).toFixed(2));
        this.$('jarFill').setAttribute('height', (14 * k).toFixed(2));
        const t = `${fmtShort(stored)} ready`;
        if (this.$('jarAmt').textContent !== t) { this.$('jarAmt').textContent = t; jb.setAttribute('aria-label', `Pour out the Jelly Jar: ${fmt(stored)} jelly`); }
      }
      const R = st.ranch;
      const pb = this.$('pearlBtn');
      const showPearls = R.totalPearls > 0 || R.residents.length > 0;
      if (pb.hidden === showPearls) pb.hidden = !showPearls;
      if (showPearls) { const t = fmt(R.pearls); if (this.$('pearlCount').textContent !== t) this.$('pearlCount').textContent = t; }
      const bb = this.$('basketBtn');
      const bt = R.basket.stored > 0 ? `Collect ${R.basket.stored}` : '';
      if (bb.textContent !== bt) { bb.textContent = bt; bb.hidden = !bt; }
      const jps = sim.jps();
      this.$('jps').textContent = `${fmtRate(jps)} jelly per second${sim.asleep ? ' · dreaming' : ''}`;
      this.$('tummyFill').style.width = s.tummy.toFixed(1) + '%';
      this.$('joyFill').style.width = s.joy.toFixed(1) + '%';
      this.$('energyFill').style.width = s.energy.toFixed(1) + '%';
      this.$('needTummy').classList.toggle('low', s.tummy < 20);
      this.$('needJoy').classList.toggle('low', s.joy < 30);
      this.$('needEnergy').classList.toggle('low', s.energy < 15);
      this.$('needTummy').title = `Tummy ${Math.round(s.tummy)}%`;
      this.$('needJoy').title = `Joy ${Math.round(s.joy)}% · jelly x${sim.moodMult().toFixed(2)}`;
      this.$('needEnergy').title = `Energy ${Math.round(s.energy)}%`;
      this.$('bondFill').style.width = (sim.bondProgress() * 100).toFixed(1) + '%';

      // giggle meter
      const gg = this.$('giggle');
      const show = sim.giggle > 4 || sim.dizzy > 0;
      gg.hidden = !show;
      if (show) {
        const max = sim.dizzyThreshold();
        this.$('giggleFill').style.width = Math.min(100, sim.giggle / max * 100).toFixed(1) + '%';
        const z0 = sim.feverThreshold() / max * 100;
        const zone = this.$('giggleZone');
        zone.style.left = z0.toFixed(1) + '%';
        zone.style.width = (100 - z0).toFixed(1) + '%';
        gg.classList.toggle('fever', sim.fever);
        this.$('giggleLbl').textContent = sim.dizzy > 0 ? 'Dizzy!' : sim.fever ? `Giggle Fever x${sim.fx.feverMult}` : 'Giggles';
      }
    }
    this.slowT -= dt;
    if (this.slowT <= 0) {
      this.slowT = 0.25;
      const nb = this.$('nameBtn');
      if (nb.textContent !== (s.name || 'Slime')) nb.textContent = s.name || 'Slime';
      this.$('stagePill').textContent = sim.stage().name;
      this.$('bondTitle').textContent = BOND[sim.bondLevel()].title;
      this.$('tab-slime').firstChild.textContent = s.name || 'Slime';
      this.updateTray();
      this.updateHelpers();
      const n = this.renderUpgrades();
      if (n !== this.lastUpgradeCount) {
        if (n > (this.lastUpgradeCount || 0)) this.dot('upgrades');
        this.lastUpgradeCount = n;
      }
      if (this.tab === 'journal' && this.panelVisible()) this.renderJournal();
      if (this.tab === 'outfits' && this.panelVisible()) this.renderOutfits();
      this.slimeT = (this.slimeT || 0) - 0.25;
      if (this.tab === 'slime' && this.panelVisible() && this.slimeT <= 0) { this.slimeT = 1; this.renderSlime(); }
      this.renderBuffs();
      if (!this.$('emotes').hidden) this.updateEmotes();
      if (this.tab === 'ranch' && this.panelVisible()) this.renderRanch();
      const ready = sim.canMoveOut() || st.ranch.basket.stored >= sim.ranch.basketCap();
      if (ready && !this.ranchDotShown) { this.ranchDotShown = true; this.dot('ranch'); }
      if (!ready) this.ranchDotShown = false;
    }
  }

  renderBuffs() {
    const st = this.g.state;
    const html = st.buffs.map(b => `<span class="buff">${esc(b.name)} <b>${Math.ceil(b.t)}s</b></span>`).join('');
    const el = this.$('buffs');
    if (el.dataset.v !== html) { el.innerHTML = html; el.dataset.v = html; }
  }

  setSpeed(text) {
    const el = this.$('fpsMeter');
    el.hidden = !text;
    if (text) el.textContent = text;
  }

  setHint(text) {
    const h = this.$('hint');
    if (!text || !this.$('emotes').hidden) { h.hidden = true; return; }
    h.hidden = false;
    if (h.textContent !== text) h.textContent = text;
  }

  // ---------- bubbles ----------
  think(html, ms = 2200) { this.say(null, ms, html); }
  say(text, ms = 1600, html = null) {
    const layer = this.$('bubbleLayer');
    if (this.sayEl) this.sayEl.remove();
    const el = document.createElement('div');
    el.className = html ? 'say think' : 'say';
    if (html) el.innerHTML = html; else el.textContent = text;
    layer.appendChild(el);
    this.sayEl = el;
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => { if (this.sayEl === el) { el.remove(); this.sayEl = null; } }, ms);
  }

  showAsk(req, view) {
    this.hideAsk();
    const el = document.createElement('div');
    el.className = 'ask';
    el.innerHTML = `<div class="q">${view.icon ? this.icon(view.icon) : ''}<span>${esc(view.text)}</span></div><div class="opts"></div>${view.timer ? '<div class="timer"><i></i></div>' : ''}`;
    const opts = el.querySelector('.opts');
    for (const o of view.options) {
      const b = document.createElement('button');
      b.textContent = o.label;
      if (o.primary) b.className = 'primary';
      b.addEventListener('click', ev => { ev.stopPropagation(); this.g.answerRequest(o.id); });
      opts.appendChild(b);
    }
    el.addEventListener('pointerdown', ev => ev.stopPropagation());
    this.$('bubbleLayer').appendChild(el);
    this.askEl = el;
    this.askTimer = el.querySelector('.timer i');
  }
  hideAsk() {
    if (this.askEl) { this.askEl.remove(); this.askEl = null; this.askTimer = null; }
  }
  setAskTimer(k) { if (this.askTimer) this.askTimer.style.transform = `scaleX(${Math.max(0, Math.min(1, k))})`; }

  placeBubbles(x, y, visible, belowY = null, topLimit = 0) {
    const w = window.innerWidth;
    let stackTop = null;
    const place = (el, extra) => {
      if (!el) return;
      el.style.visibility = visible ? 'visible' : 'hidden';
      const ew = el.offsetWidth || 200, eh = el.offsetHeight || 60;
      const half = ew / 2;
      const cx = Math.max(16 + half, Math.min(w - 16 - half, x));
      let top = y - extra - eh;
      let below = false;
      if (top < topLimit + 8 && belowY !== null) { below = true; top = (stackTop ?? belowY + 16); stackTop = top + eh + 10; }
      else top = Math.max(topLimit + 8, top);
      el.classList.toggle('below', below);
      const ax = Math.round(Math.max(18, Math.min(ew - 18, x - (cx - half))));
      const tx = Math.round(cx - half), ty = Math.round(top);
      const last = el._pos || [-999, -999];
      if (Math.abs(last[0] - tx) > 1 || Math.abs(last[1] - ty) > 1) {
        el._pos = [tx, ty];
        el.style.setProperty('--arrow', `${ax}px`);
        el.style.transform = `translate(${tx}px, ${ty}px)`;
      }
    };
    place(this.askEl, 14);
    place(this.sayEl, this.askEl && !this.askEl.classList.contains('below') ? (this.askEl.offsetHeight + 26) : 14);
  }

  floatText(x, y, text, cls = '', color) {
    if (this.floats > 28) return;
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    if (color) el.style.setProperty('--c', color);
    this.$('floatLayer').appendChild(el);
    this.floats++;
    el.addEventListener('animationend', () => { el.remove(); this.floats--; });
    setTimeout(() => { if (el.isConnected) { el.remove(); this.floats--; } }, 1600);
  }

  toast(html, cls = '', ms = 3200) {
    const box = this.$('toasts');
    while (box.children.length > 2) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.innerHTML = html;
    box.appendChild(el);
    el.hideAt = performance.now() + ms;
    const tick = () => {
      if (!el.isConnected) return;
      if (el.held || performance.now() < el.hideAt) { setTimeout(tick, 250); return; }
      el.classList.add('out'); setTimeout(() => el.remove(), 420);
    };
    setTimeout(tick, ms);
  }

  // Notifications: tap or swipe sideways to dismiss, drag up or down to move them (remembered).
  setupToastDrag() {
    const box = this.$('toasts');
    const applyPos = () => {
      const y = this.g.state.settings.toastY;
      if (typeof y === 'number') { box.style.setProperty('--toast-top', Math.round(Math.max(0.04, Math.min(0.85, y)) * innerHeight) + 'px'); box.classList.add('moved'); }
      else box.classList.remove('moved');
    };
    this.applyToastPos = applyPos;
    applyPos();
    window.addEventListener('resize', applyPos);
    let d = null;
    box.addEventListener('pointerdown', e => {
      const el = e.target.closest('.toast');
      if (!el) return;
      e.stopPropagation();
      el.held = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      d = { el, id: e.pointerId, x0: e.clientX, y0: e.clientY, top0: box.getBoundingClientRect().top, mode: null };
      el.classList.add('dragging');
    });
    box.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.mode && Math.hypot(dx, dy) > 8) d.mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (d.mode === 'x') { d.el.style.transform = `translateX(${dx}px)`; d.el.style.opacity = String(Math.max(0.2, 1 - Math.abs(dx) / 220)); }
      if (d.mode === 'y') {
        const top = Math.max(8, Math.min(innerHeight - 90, d.top0 + dy));
        box.style.setProperty('--toast-top', top + 'px');
        box.classList.add('moved');
      }
    });
    const end = e => {
      if (!d || e.pointerId !== d.id) return;
      const { el, mode } = d;
      const dx = e.clientX - d.x0;
      d = null;
      el.held = false;
      el.classList.remove('dragging');
      if (!mode || (mode === 'x' && Math.abs(dx) > 70)) {
        // tap or swipe: dismiss
        el.classList.add('fling');
        el.style.transform = `translateX(${mode ? Math.sign(dx) * 420 : 0}px) scale(${mode ? 1 : 0.9})`;
        setTimeout(() => el.remove(), 260);
        return;
      }
      el.style.transform = ''; el.style.opacity = '';
      if (mode === 'y') {
        this.g.state.settings.toastY = box.getBoundingClientRect().top / innerHeight;
        this.g.markDirty(false);
      }
      el.hideAt = Math.max(el.hideAt, performance.now() + 1500);
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
  }

  // Phones: swipe the open menu down (from its grip, or from the top of the list) to close it.
  setupSheetSwipe() {
    const panel = this.$('panel');
    const mobile = () => window.matchMedia('(max-width: 860px)').matches;
    let d = null;
    panel.addEventListener('touchstart', e => {
      if (!mobile() || !panel.classList.contains('open') || e.touches.length !== 1 || e.target.closest('.tabs')) return;
      const t = e.touches[0];
      const body = e.target.closest('.tab-body');
      d = { y0: t.clientY, x0: t.clientX, body, active: false, h0: panel.getBoundingClientRect().height, t0: performance.now(), dy: 0 };
    }, { passive: true });
    panel.addEventListener('touchmove', e => {
      if (!d) return;
      const t = e.touches[0];
      const dy = t.clientY - d.y0, dx = t.clientX - d.x0;
      if (!d.active) {
        if (Math.hypot(dx, dy) < 8) return;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx) && (!d.body || d.body.scrollTop <= 0)) {
          d.active = true; d.y0 = t.clientY; d.t0 = performance.now();
          panel.classList.add('dragging');
        } else { d = null; return; }
      }
      e.preventDefault();
      d.dy = Math.max(0, t.clientY - d.y0);
      panel.style.height = Math.max(60, d.h0 - d.dy) + 'px';
    }, { passive: false });
    const end = () => {
      if (!d) return;
      const k = d; d = null;
      if (!k.active) return;
      const fast = k.dy / Math.max(1, performance.now() - k.t0) > 0.5;
      panel.classList.remove('dragging');
      panel.style.height = '';
      if (k.dy > 90 || (fast && k.dy > 30)) { panel.classList.remove('open'); this.g.layoutChanged(); }
    };
    panel.addEventListener('touchend', end);
    panel.addEventListener('touchcancel', end);
    // tapping the grip also closes it
    this.$('sheetGrip').addEventListener('click', () => { panel.classList.remove('open'); this.g.layoutChanged(); });
  }

  // ---------- modals ----------
  openModal(html, { dismiss = true, onOpen } = {}) {
    const card = this.$('modalCard');
    card.innerHTML = html;
    this.$('modal').hidden = false;
    this.modalOpen = true;
    this.modalDismiss = dismiss;
    onOpen && onOpen(card);
    const focus = card.querySelector('[autofocus]') || card.querySelector('button.primary') || card.querySelector('button');
    focus && setTimeout(() => focus.focus({ preventScroll: true }), 50);
  }
  closeModal() {
    this.$('modal').hidden = true;
    this.modalOpen = false;
    const cb = this.onModalClose;
    this.onModalClose = null;
    cb && cb();
  }

  showNaming(onDone, { rename = false, current = '' } = {}) {
    const idea = () => NAME_IDEAS[Math.floor(Math.random() * NAME_IDEAS.length)];
    this.openModal(`
      <h2>${rename ? 'A new name?' : 'Your slime hatched!'}</h2>
      <p>${rename ? 'Names can change. Your slime will still know it is you.' : 'They are looking right at you. What will you call them?'}</p>
      <form class="name-input" id="nameForm" autocomplete="off">
        <input id="slimeName" name="slimeName" maxlength="16" placeholder="${esc(idea())}" value="${esc(current)}" autofocus aria-label="Slime name">
        <button type="button" id="nameDice" aria-label="Suggest a name">${DICE}</button>
      </form>
      <div class="actions"><button class="btn primary" id="nameOk">${rename ? 'Save name' : "That's their name"}</button></div>`, {
      dismiss: rename,
      onOpen: card => {
        const input = card.querySelector('#slimeName');
        card.querySelector('#nameDice').addEventListener('click', () => { input.value = idea(); input.focus(); this.g.sfx.plip(); });
        const done = () => {
          const v = (input.value || input.placeholder || 'Mochi').trim().slice(0, 16) || 'Mochi';
          this.closeModal();
          onDone(v);
        };
        card.querySelector('#nameForm').addEventListener('submit', e => { e.preventDefault(); done(); });
        card.querySelector('#nameOk').addEventListener('click', done);
      },
    });
  }

  showRename() {
    if (this.g.state.phase !== 'play') return;
    this.showNaming(v => this.g.rename(v), { rename: true, current: this.g.state.slime.name });
  }

  showSimple(title, body, button = 'OK', onClose) {
    this.openModal(`<h2>${title}</h2>${body}<div class="actions"><button class="btn primary" id="modalOk">${esc(button)}</button></div>`, {
      onOpen: card => card.querySelector('#modalOk').addEventListener('click', () => this.closeModal()),
    });
    this.onModalClose = onClose || null;
  }
}
