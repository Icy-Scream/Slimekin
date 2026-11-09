// DOM interface: counters, snack tray, shop tabs, journal, slime profile,
// speech/request bubbles, floating numbers, toasts and modals.
import {
  FOODS, FOOD_BY_ID, STAGES, TRAITS, BOND, PERSONALITY, PERSONALITY_IDS, NAME_IDEAS, EMOTES, TRICK_LEARNED, RANCH,
  BUYER_BY_ID, BREEDING, FORM_BY_ID, PURE_LINE, HEIRLOOM_TAB,
} from '../data/content.js';
import { fmt, fmtShort, fmtRate, fmtDuration } from '../core/format.js';
import { ICON, memIcon } from './icons.js';
import { residentMedal } from '../core/medals.js';
import { specialEggsHtml, specialEggColors, nurseryEggTitle, nurseryEggNote } from './eggs.js';   // recipe body
import { DROP } from './dom.js';

const DICE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM7.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>';
// the gold chest from the approved 7th-tab layout check: the Heirlooms tab's placeholder until the UI branch draws one
const CHEST = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10a6 6 0 0 1 6-6h6a6 6 0 0 1 6 6v1H3z" fill="#e0a526"/><rect x="3" y="11" width="18" height="9" rx="2" fill="#f2c14e"/><rect x="3" y="10" width="18" height="2.4" fill="#b7791f"/><rect x="10.5" y="10" width="3" height="5" rx="1" fill="#8a5a12"/></svg>';
const FALLBACK = { cookie: '🍪', chili: '🌶️', iron: '🔩', moss: '🌿', berry: '🫐', crystal: '💎', feather: '🪶', bubbles: '🫧', garden: '🌱', slimeling: '💧', musicbox: '🎶', lamp: '🌙', fountain: '⛲', observatory: '🔭' };

const GROUP_OF = { helpers: 'shop', upgrades: 'shop', outfits: 'outfits', slime: 'me', journal: 'me', ranch: 'ranch', heirlooms: 'heirlooms' };
const GROUP_TAB = { shop: 'tab-shop', outfits: 'tab-outfits', me: 'tab-slime', ranch: 'tab-ranch', heirlooms: 'tab-heirlooms' };
const SUB_ID = { helpers: 'tab-helpers', upgrades: 'tab-upgrades', slime: 'sub-slime', journal: 'tab-journal' };

import { esc } from './esc.js';
import { HelpersPanel } from './panels/helpers.js';
import { UpgradesPanel } from './panels/upgrades.js';
import { OutfitsPanel } from './panels/outfits.js';
import { HeirloomsPanel } from './panels/heirlooms.js';
import { JournalPanel } from './panels/journal.js';
import { SlimePanel } from './panels/slime.js';
import { mixParts } from '../mixin.js';
export { esc };   // (one shared copy: ./esc.js)

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
    this.mountJellyLoop();   // (before bindTabs: it adds the Heirlooms tab)
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
      if (b.dataset.rl) { g.life.click(b); return; }   // ranch life (ui/ranch-life.js)
      if (b.dataset.cs) { g.contestsUI.click(b); return; }   // [contests] (ui/contests.js)
      if (b.id === 'moveOutBtn') g.askMoveOut();
      else if (b.id === 'collectBasket') g.collectBasket();
      else if (b.id === 'basketUp') g.buyBasket();
      else if (b.id === 'slotUp') g.buyRanchSlot();
      else if (b.id === 'ranchBack') g.focusResident(null);
      else if (b.id === 'ranchHome') g.leaveRanch();
      else if (b.dataset.act === 'visit') g.focusResident(id);
      else if (b.dataset.act === 'place') g.askPlace(id);
      else if (b.dataset.act === 'auction') g.startAuction(id);
      else if (b.dataset.act === 'nursery') g.openNursery();
      else if (b.id === 'nurseryBack') g.closeNursery();
      else if (b.dataset.act === 'pickParent') this.pickParent(id);
      else if (b.id === 'breedBtn' && this.nurseryPick.length === 2) g.breed(this.nurseryPick[0], this.nurseryPick[1]);
      else if (b.dataset.act === 'giveEgg') g.giveEgg(b.dataset.egg);
      else if (b.dataset.act === 'cushion') g.askCushion(b.dataset.egg);
      else if (b.dataset.act === 'buySpecial') g.buySpecialEgg(b.dataset.variant);   // recipe body: special eggs (ui/eggs.js)
    });
    this.nurseryPick = [];
    this.pending = 0; this.pendingRate = 0;
    this.outfitKey = '';
    this.buildEmotes();
    this.setupSheetSwipe();
    this.setupToastDrag();
    this.$('nameBtn').addEventListener('click', () => { if (this.g.state.phase === 'play') this.g.behave.answerName(); });
    // the bond heart and the need rings open your slime's page with all the details
    for (const id of ['bondBtn', 'needTummy', 'needJoy', 'needEnergy']) this.$(id).addEventListener('click', () => { if (this.g.state.phase === 'play') this.openTab('slime'); });
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

  // ---------- jelly loop: the medal badge by the name and the Heirlooms tab ----------
  // Elements are made here (stable ids/classes, listed in UI-CHANGES.md) so the HUD and tab-bar markup in index.html
  // stays as is (the UI branch rewrites it).
  mountJellyLoop() {
    const badge = document.createElement('span');
    badge.className = 'medal-badge';
    badge.id = 'medalBadge';
    badge.hidden = true;
    this.$('nameBtn').insertAdjacentElement('afterend', badge);
    // ===== Heirlooms tab: ONE block (button + its CSS + its page body). =====
    // Its own tab after the four (group 'heirlooms'): the placeholder chest icon (HEIRLOOM_TAB.icon through memIcon; until
    // the UI branch draws that key it shows the gold chest from the approved layout check), no text label, in a fixed
    // 44 px last column of the tab bar (44 px: the smallest comfortable tap target).
    // `.glow` while an heirloom you don't own just became affordable (stops once the page is opened).
    // The page itself does not care how it is reached: selectTab('heirlooms') / openTab('heirlooms'), renderHeirlooms().
    const css = document.createElement('style');
    css.id = 'heirloomTabCss';
    css.textContent = `
      #panel .tabs { grid-template-columns: repeat(4, minmax(0, 1fr)) 44px; }
      .tab.tab-chest { display: grid; place-items: center; padding-left: 0; padding-right: 0; }
      .tab-chest .chest-ic { display: grid; place-items: center; font-size: 21px; line-height: 1; opacity: .8; transition: transform .2s, filter .3s, opacity .2s; }
      .tab-chest .chest-ic svg { width: 24px; height: 24px; }
      .tab-chest[aria-selected="true"] .chest-ic { opacity: 1; transform: translateY(-1px) scale(1.08); }
      .tab-chest.glow .chest-ic { opacity: 1; animation: chest-glow 2.2s ease-in-out infinite; }
      @keyframes chest-glow { 0%, 100% { filter: drop-shadow(0 0 2px rgba(255, 196, 64, .55)); } 50% { filter: drop-shadow(0 0 7px rgba(255, 196, 64, .95)); transform: scale(1.08); } }`;
    document.head.appendChild(css);
    const tab = document.createElement('button');
    tab.className = 'tab tab-chest';
    tab.id = 'tab-heirlooms';
    tab.dataset.tab = 'heirlooms';
    tab.dataset.group = 'heirlooms';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('aria-label', HEIRLOOM_TAB.label);
    tab.title = HEIRLOOM_TAB.label;
    tab.innerHTML = `<span class="chest-ic" aria-hidden="true">${memIcon(HEIRLOOM_TAB.icon, CHEST)}</span><span class="dot" hidden></span>`;
    this.$('panel').querySelector('.tabs').appendChild(tab);
    const body = document.createElement('div');
    body.className = 'tab-body';
    body.id = 'body-heirlooms';
    body.hidden = true;
    this.$('body-ranch').insertAdjacentElement('afterend', body);
    body.addEventListener('click', e => { const b = e.target.closest('button[data-buy]'); if (b && !b.disabled) this.g.buyHeirloom(b.dataset.buy); });
    // ===== end of the Heirlooms tab block =====
  }
  // A small medal badge (placeholder emoji icon from content.js, drawn through memIcon so the UI branch can swap it).
  medalChip(m, cls = '') {
    if (!m) return '';
    const label = m.id === 'ribbon' ? m.name : `${m.name} medal`;
    return `<span class="medal-badge${cls ? ' ' + cls : ''}" role="img" aria-label="${esc(label)}" title="${esc(label)}">${memIcon(m.icon, esc(m.icon))}</span>`;
  }
  // The HUD badge next to the slime's name: the medal its last ceremony played for.
  updateMedalBadge() {
    const el = this.$('medalBadge'), m = this.g.sim.medalShown(), key = m ? m.id : '';
    if (!el || el.dataset.m === key) return;
    el.dataset.m = key;
    el.hidden = !m;
    el.innerHTML = m ? memIcon(m.icon, esc(m.icon)) : '';
    const label = m ? (m.id === 'ribbon' ? m.name : `${m.name} medal`) : '';
    el.title = label;
    if (m) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', label); }
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
    this.updateEggRanch();
  }
  // While an egg waits on the cushion, a family with a ranch (or eggs in the Nursery) can still visit the ranch:
  // the menu shows just the Ranch tab.
  updateEggRanch() {
    const st = this.g.state, R = st.ranch;
    const on = st.phase === 'egg' && !this.g.hatching && (R.residents.length > 0 || R.nursery.eggs.length > 0);
    if (this.$('ui').classList.contains('has-ranch') !== on) { this.$('ui').classList.toggle('has-ranch', on); this.g.layoutChanged(); }
  }
  // the per-frame part that still runs while an egg waits (the ranch keeps going)
  updateEggPhase(dt) {
    this.slowT -= dt;
    if (this.slowT > 0) return;
    this.slowT = 0.25;
    this.updateEggRanch();
    this.updateBasketBtn();
    if (this.tab === 'ranch' && this.panelVisible()) this.renderRanch();
  }
  updateBasketBtn() {
    const R = this.g.state.ranch, bb = this.$('basketBtn');
    const bt = R.basket.stored > 0 ? `Collect ${R.basket.stored}` : '';
    if (bb.textContent !== bt) { bb.textContent = bt; bb.hidden = !bt; }
  }

  // ---------- tabs / panel ----------
  // Four tabs on the menu bar; Shop (Helpers + Upgrades) and your slime's tab (its page + the Journal)
  // switch between their two pages with a toggle at the top of the sheet. The pages keep their own names
  // (this.tab is 'helpers', 'upgrades', 'outfits', 'slime', 'journal' or 'ranch').
  bindTabs() {
    const panel = this.$('panel');
    this.lastPage = { shop: 'helpers', me: 'slime' };
    for (const btn of panel.querySelectorAll('.tab')) {
      btn.addEventListener('click', () => {
        const group = btn.dataset.group;
        const t = this.lastPage[group] || btn.dataset.tab;
        const mobile = window.matchMedia('(max-width: 860px)').matches;
        if (mobile && panel.classList.contains('open') && GROUP_OF[this.tab] === group) {
          this.setSheet('closed', false);
        } else {
          if (mobile && !panel.classList.contains('open')) this.setSheet('normal', false);   // always opens at its normal size
          if (this.tab !== t || t === 'ranch') this.selectTab(t);
        }
        this.g.layoutChanged();
      });
    }
    for (const b of panel.querySelectorAll('.subseg .sub')) {
      b.addEventListener('click', () => { if (this.tab !== b.dataset.tab) { this.selectTab(b.dataset.tab); this.g.layoutChanged(); } });
    }
  }
  selectTab(t) {
    this.tab = t;
    const group = GROUP_OF[t];
    if (this.lastPage && (group === 'shop' || group === 'me')) this.lastPage[group] = t;
    for (const btn of this.$('panel').querySelectorAll('.tab')) btn.setAttribute('aria-selected', btn.dataset.group === group ? 'true' : 'false');
    let anySeg = false;
    for (const seg of this.$('panel').querySelectorAll('.subseg')) {
      const on = seg.dataset.group === group;
      seg.hidden = !on;
      anySeg = anySeg || on;
      for (const b of seg.querySelectorAll('.sub')) b.setAttribute('aria-pressed', b.dataset.tab === t ? 'true' : 'false');
    }
    this.$('subtabs').hidden = !anySeg;
    this.clearDot(t);
    for (const id of ['helpers', 'upgrades', 'outfits', 'journal', 'slime', 'ranch', 'heirlooms']) this.$('body-' + id).hidden = id !== t;
    if (t === 'ranch') { this.ranchKey = ''; this.renderRanch(); }
    this.g.onTab && this.g.onTab(t);
    if (t === 'outfits') { this.outfitKey = ''; this.renderOutfits(); }
    if (t === 'journal') { this.journalKey = ''; this.renderJournal(); }
    if (t === 'slime') this.renderSlime();
    if (t === 'upgrades') { this.upgradeKey = ''; this.renderUpgrades(); }
    if (t === 'heirlooms') { this.heirloomKey = ''; this.renderHeirlooms(); }
  }
  openTab(t) {
    const mobile = window.matchMedia('(max-width: 860px)').matches;
    if (mobile && !this.$('panel').classList.contains('open')) this.setSheet('normal', false);
    this.selectTab(t);
    this.g.layoutChanged();
  }
  // a red dot for a page shows on its toggle button and on its group's tab
  dot(tab) {
    if (this.tab === tab && this.panelVisible()) return;
    const sub = SUB_ID[tab] && this.$(SUB_ID[tab]);
    if (sub) sub.querySelector('.dot').hidden = false;
    const g = this.$(GROUP_TAB[GROUP_OF[tab]]);
    if (g) g.querySelector('.dot').hidden = false;
  }
  clearDot(tab) {
    const sub = SUB_ID[tab] && this.$(SUB_ID[tab]);
    if (sub) sub.querySelector('.dot').hidden = true;
    const group = GROUP_OF[tab];
    const g = this.$(GROUP_TAB[group]);
    const others = Object.keys(GROUP_OF).filter(k => GROUP_OF[k] === group && k !== tab && SUB_ID[k] && !this.$(SUB_ID[k]).querySelector('.dot').hidden);
    if (g && !others.length) g.querySelector('.dot').hidden = true;
  }

  // A small bubble by the slime while one of its needs is low (the most urgent one).
  updateNeedBubble(s, sim) {
    const g = this.g;
    const sheetUp = window.matchMedia('(max-width: 860px)').matches && this.$('panel').classList.contains('open');   // the rings show it then
    const k = g.state.phase !== 'play' || sim.asleep || g.view === 'ranch' || g.departing || sheetUp ? null
      : s.tummy < 20 ? 'tummy' : s.energy < 15 ? 'energy' : s.joy < 30 ? 'joy' : null;
    if (k === this.needKey) return;
    this.needKey = k;
    if (this.needEl) { this.needEl.remove(); this.needEl = null; }
    if (!k) return;
    const el = document.createElement('div');
    el.className = 'say need-say ' + k;
    const icon = this.$('need' + k[0].toUpperCase() + k.slice(1)).querySelector('.nic').outerHTML;
    el.innerHTML = icon + ({ tummy: 'Hungry!', energy: 'Sleepy...', joy: 'Lonely...' })[k];
    el.style.visibility = 'hidden';
    this.$('bubbleLayer').appendChild(el);
    this.needEl = el;
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
      if (el.b.title !== title) el.b.title = title;
      // (the label carries the price, which changes with the stage and the Cookie Tin)
      const label = `${f.name}, ${unlocked ? fmt(price) + ' jelly' : 'locked'}`;
      if (el.b.getAttribute('aria-label') !== label) el.b.setAttribute('aria-label', label);
    }
  }
  shakeFood(id) {
    const el = this.foodEls?.[id]?.b;
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
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

  // ---------- ranch tab ----------
  renderRanch(force = false) {
    if (this.g.ranchPage === 'nursery') return this.renderNursery(force);
    const g = this.g, sim = g.sim, st = g.state, R = st.ranch, rr = sim.ranch;
    const focus = g.ranchFocus ? rr.resident(g.ranchFocus) : null;
    const fm = rr.familyMult();
    const canMove = sim.canMoveOut();
    const eggPhase = st.phase === 'egg';
    const key = [R.pearls, R.basket.stored, R.basket.level, R.slots, R.residents.map(x => x.id + ':' + Math.round(x.happiness / 5)).join(','), focus && focus.id, canMove, R.placed.length, st.slime.name, rr.eggs().length, st.phase, g.life.key()].join('|');
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
      const xm = residentMedal(x);
      html += `<div class="card"><div class="row-between"><span class="form-name">${esc(x.name)} ${this.medalChip(xm)}</span><span class="sub">Generation ${x.generation}</span></div>
        <b>${esc(x.form?.name || 'Slime')}</b><span class="sub">${esc(x.form?.blurb || '')}</span>
        <span class="sub medal-line">${esc(xm.id === 'ribbon' ? 'Grown-Up Ribbon' : `${xm.name} medal: pearls x${xm.pearls}, buyers pay +${Math.round(xm.offers * 100)}%`)} (${fmtShort(x.runTotal || 0)} jelly made growing up).</span>${g.contestsUI.residentLine(x)}
        <div class="row-between"><span class="sub">${happyWord(x.happiness)}</span><span class="sub">${Math.round(x.happiness)}%</span></div><div class="meter"><i style="width:${x.happiness.toFixed(0)}%;background:linear-gradient(90deg,#ffb0c8,var(--berry))"></i></div>
        ${x.trip ? '' : `<span class="sub">Tap or stroke ${esc(x.name)} to pet them. Happy slimes make pearls faster.</span>`}
        ${x.lineage?.parents?.length ? `<span class="sub">Child of ${esc(x.lineage.parents[0].name)} (${esc(x.lineage.parents[0].form.name)}) and ${esc(x.lineage.parents[1].name)} (${esc(x.lineage.parents[1].form.name)}).</span>` : ''}</div>`;
      html += `<div class="stat-grid">
        <div class="stat"><div class="k">Jelly</div><div class="v">${fmtRate(x.jps * fm)}/s</div></div>
        <div class="stat"><div class="k">Pearls</div><div class="v">+${(rr.pearlRate(x) * 3600).toFixed(1)}/hour</div></div>
        <div class="stat"><div class="k">Made of</div><div class="v">${esc(traits || 'A bit of everything')}</div></div>
        <div class="stat"><div class="k">Favorite snack</div><div class="v">${esc(FOOD_BY_ID[x.favorite]?.name || '?')}</div></div></div>`;
      if (lean) html += `<p class="sub">Personality: ${esc(lean)}. Bond: ${esc(BOND[x.bondLevel || 0].title)}.</p>`;
      html += g.life.residentHtml(x);   // ranch life: skills, loves, Train / Send on a trip (ui/ranch-life.js)
      const mem = (x.memories || []).slice(-6).reverse();
      if (mem.length) html += `<div class="sec-title">${esc(x.name)}'s story</div><div class="card">` + mem.map(m => `<div class="sub mem-line">${memIcon(m.icon, esc(m.icon || ''))} <span>${esc(m.text)}</span></div>`).join('') + '</div>';
      html += `<div class="res"><div class="acts"><button class="btn" data-act="place" data-id="${x.id}">Find a new home</button><button class="btn" data-act="auction" data-id="${x.id}">Auction</button></div></div>`;
    } else {
      html += `<button class="link-btn" id="ranchHome">← Back home</button>`;
      html += `<div class="card"><div class="row-between"><span class="form-name">The Barn</span><span class="sub">Generation ${R.family.generation}</span></div>
        <div class="big-num"><i class="pearl big"></i>${fmt(R.pearls)}<span class="sub">pearls</span></div>
        <span class="sub">${R.family.bonus > 0 ? `Family Bonus: <b>+${R.family.bonus.toFixed(1)}%</b> to all jelly, forever. It grows from all the jelly your family has ever made.` : 'Every slime that moves here grows a Family Bonus on all your jelly, forever, from all the jelly your family has ever made.'}</span>
        ${R.residents.length ? `<span class="sub">The ranch makes <b>${fmtRate(sim.ranchJps())}</b> jelly a second and about <b>${rr.pearlsPerHour().toFixed(1)}</b> pearls an hour.</span>` : ''}</div>`;
      const name = esc(st.slime.name || 'Your slime');
      if (canMove) {
        const pv = sim.moveOutPreview();
        html += `<div class="card"><b>${name} is all grown up</b><span class="sub">Moving to the ranch starts a new generation with a new egg. The Family Bonus goes up <b>+${pv.bonus.toFixed(1)}%</b>, and ${name} makes ${fmtRate(pv.jps * (1 + pv.bonusAfter / 100))} jelly a second plus pearls on the ranch. The bonus grows from all the jelly your family has ever made.</span>
          <button class="btn primary" id="moveOutBtn">${pv.room ? `Move ${name} to the ranch` : 'The ranch is full'}</button></div>`;
      } else if (!R.residents.length && !eggPhase) {
        html += `<div class="card"><b>Nobody lives here yet</b><span class="sub">When ${name} is all grown up (Settled), they can move to the ranch. They keep making jelly and pearls, you raise a new baby, and the Family Bonus on all your jelly grows from all the jelly your family makes.</span></div>`;
      }
      if (R.residents.length || rr.eggs().length) {
        const n = rr.eggs().length;
        html += `<div class="card nursery-card"><div class="row-between"><b>Nursery</b><span class="sub">${n ? `${n} egg${n === 1 ? '' : 's'} waiting` : 'No eggs yet'}</span></div>
          <span class="sub">${eggPhase && n ? 'Before the egg at home hatches, you can put a Nursery egg on the cushion instead.' : R.residents.length < 2 ? 'When two slimes live here, they can make an egg together.' : eggPhase ? 'Two ranch slimes can make an egg together, then put it on the cushion.' : `Two ranch slimes can make an egg together. Choose it when ${name} moves to the ranch.`}</span>
          <button class="btn" data-act="nursery">Open the Nursery</button></div>`;
      }
      if (R.residents.length) html += g.life.ranchRowHtml();   // ranch life: lanes, wagons, souvenirs (ui/ranch-life.js)
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
          html += `<div class="card res"><span class="nm">${esc(x.name)} ${this.medalChip(residentMedal(x))}</span><span class="sub">Gen ${x.generation}</span>
            <span class="sub">${esc(x.form?.name || 'Slime')}</span><span class="sub">${fmtRate(x.jps * fm)} jelly/s</span>
            <div class="meter" title="Happiness"><i style="width:${x.happiness.toFixed(0)}%"></i></div><span class="sub">${happyWord(x.happiness)}</span>${g.life.rowHtml(x)}
            <div class="acts"><button class="btn small" data-act="visit" data-id="${x.id}">Visit</button><button class="btn small" data-act="place" data-id="${x.id}">New home</button><button class="btn small" data-act="auction" data-id="${x.id}">Auction</button></div></div>`;
        }
        const sc = rr.slotCost();
        if (sc !== null) html += `<button class="upgrade${R.pearls < sc ? ' poor' : ''}" id="slotUp"><span class="un">More room</span><span class="ub">Space for one more slime (${R.slots + 1} in total).</span>${pearlCost(sc)}</button>`;
      }
      if (R.placed.length) {
        html += `<div class="sec-title">Living elsewhere</div><div class="card">` + R.placed.slice(-8).reverse().map(p => `<div class="row-between"><span>${esc(p.name)}</span><span class="sub">${esc(BUYER_BY_ID[p.buyer]?.name || '')}${p.baby ? ' · growing up there' : ''}</span></div>`).join('') + '</div>';
      }
    }
    this.$('body-ranch').innerHTML = html;
  }

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
      this.updateBasketBtn();
      const jps = sim.jps();
      // phones: a short label, so the top row has room for the name and its medal
      const jt = innerWidth < 560 ? `${fmtRate(jps)} /sec${sim.asleep ? ' · zzz' : ''}` : `${fmtRate(jps)} jelly per second${sim.asleep ? ' · dreaming' : ''}`;
      if (this.$('jps').textContent !== jt) this.$('jps').textContent = jt;
      // need rings (stroke length out of 100) and the bond heart (fills up toward the next level)
      this.$('tummyFill').style.strokeDasharray = `${s.tummy.toFixed(1)} 100`;
      this.$('joyFill').style.strokeDasharray = `${s.joy.toFixed(1)} 100`;
      this.$('energyFill').style.strokeDasharray = `${s.energy.toFixed(1)} 100`;
      this.$('needTummy').classList.toggle('low', s.tummy < 20);
      this.$('needJoy').classList.toggle('low', s.joy < 30);
      this.$('needEnergy').classList.toggle('low', s.energy < 15);
      this.$('needTummy').title = `Tummy ${Math.round(s.tummy)}%`;
      this.$('needJoy').title = `Joy ${Math.round(s.joy)}% · jelly x${sim.moodMult().toFixed(2)}`;
      this.$('needEnergy').title = `Energy ${Math.round(s.energy)}%`;
      this.$('bondFill').setAttribute('y', (24 - 24 * (0.12 + 0.76 * sim.bondProgress())).toFixed(2));
      const lv = String(sim.bondLevel() + 1);
      if (this.$('bondLv').textContent !== lv) this.$('bondLv').textContent = lv;
      this.updateNeedBubble(s, sim);

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
      this.fitName(nb);
      this.updateMedalBadge();
      this.$('stagePill').textContent = sim.stage().name;
      this.$('bondTitle').textContent = BOND[sim.bondLevel()].title;
      this.$('bondBtn').title = `Bond: ${BOND[sim.bondLevel()].title} (level ${sim.bondLevel() + 1})`;
      for (const id of ['tab-slime', 'sub-slime']) {
        const tl = this.$(id).querySelector('.tl');
        if (tl.textContent !== (s.name || 'Slime')) tl.textContent = s.name || 'Slime';
      }
      this.updateTray();
      this.updateHelpers();
      const n = this.renderUpgrades();
      if (n !== this.lastUpgradeCount) {
        if (n > (this.lastUpgradeCount || 0)) this.dot('upgrades');
        this.lastUpgradeCount = n;
      }
      if (this.tab === 'journal' && this.panelVisible()) this.renderJournal();
      if (this.tab === 'outfits' && this.panelVisible()) this.renderOutfits();
      this.updateHeirloomTab();
      this.slimeT = (this.slimeT || 0) - 0.25;
      if (this.tab === 'slime' && this.panelVisible() && this.slimeT <= 0 && !this.panelPress) { this.slimeT = 1; this.renderSlime(); }
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
    if (this.needEl) {
      if (this.askEl || this.sayEl) this.needEl.style.visibility = 'hidden';
      else place(this.needEl, 14);
    }
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

  // ---------- the phone menu sheet: closed, normal or tall ----------
  // Open sizes: normal (the CSS heights) and tall (its top just under the top HUD bar). It always opens at normal;
  // closing it, or going home <-> ranch, brings it back to normal. Desktop (> 860 px) has no sheet.
  sheetState() {
    const p = this.$('panel');
    return !p.classList.contains('open') ? 'closed' : p.classList.contains('tall') ? 'tall' : 'normal';
  }
  setSheet(s, layout = true) {
    const p = this.$('panel');
    p.classList.toggle('instant', !!this.g.reduced);   // reduced motion: no snap animation
    if (s === 'tall') { this.measureTall(); p.classList.add('open', 'tall'); }
    else { p.classList.remove('tall'); p.classList.toggle('open', s !== 'closed'); }
    if (layout) this.g.layoutChanged();
  }
  // The tall height: from just under the top HUD bar (slime card + jelly column) to the bottom of the screen.
  measureTall() {
    const p = this.$('panel'), top = document.querySelector('.top');
    const r = top && top.offsetParent ? top.getBoundingClientRect() : null;
    const h = r && r.height > 0 ? innerHeight - (r.bottom + 8) : innerHeight * 0.88;
    const px = Math.round(Math.max(this.measureNormal() + 40, Math.min(innerHeight - 8, h)));
    p.style.setProperty('--sheet-tall', px + 'px');
    return px;
  }
  // The normal open height right now (home and ranch differ), measured without a visible change: transitions stay
  // off until the classes are back and the style is flushed, so putting them back doesn't animate anything.
  measureNormal() {
    const p = this.$('panel');
    const keep = { tall: p.classList.contains('tall'), open: p.classList.contains('open'), drag: p.classList.contains('dragging'), h: p.style.height };
    p.classList.add('dragging', 'open'); p.classList.remove('tall'); p.style.height = '';
    const h = p.getBoundingClientRect().height;
    p.classList.toggle('tall', keep.tall); p.classList.toggle('open', keep.open); p.style.height = keep.h;
    void p.offsetHeight;
    p.classList.toggle('dragging', keep.drag);
    return h;
  }

  // Phones: drag the open menu. Up (from the grip, the tab bar, or the list while it is at normal) stretches it to
  // tall, following the finger; down goes tall -> normal -> closed (from the grip or the tab bar, or from the list
  // when it is scrolled to the top). On release it snaps: past halfway or a quick flick. Once tall, upward drags on
  // the list scroll the list. A tap on the grip closes it.
  // The move and end listeners sit on the touched element itself: lists re-render while open (the Slime tab every
  // second), and touch events aimed at a removed element no longer bubble up to the panel.
  setupSheetSwipe() {
    const panel = this.$('panel');
    const mobile = () => window.matchMedia('(max-width: 860px)').matches;
    let d = null;
    const release = () => { if (d && d.off) d.off(); };
    panel.addEventListener('touchstart', e => {
      release(); d = null;
      if (!mobile() || !panel.classList.contains('open') || e.touches.length !== 1) return;
      const t = e.touches[0];
      const body = e.target.closest('.tab-body');
      const tall = panel.classList.contains('tall');
      const tallH = this.measureTall(), normalH = this.measureNormal();
      // at normal the list belongs to the sheet: native scrolling never starts, so an upward drag can stretch it
      d = { y0: t.clientY, x0: t.clientX, body, tall, own: !!body && !tall, st0: body ? body.scrollTop : 0, mode: null,
        h0: panel.getBoundingClientRect().height, tallH, normalH, pts: [{ y: t.clientY, t: e.timeStamp }] };
      const el = e.target;
      el.addEventListener('touchmove', move, { passive: false });
      el.addEventListener('touchend', end);
      el.addEventListener('touchcancel', end);
      d.off = () => { el.removeEventListener('touchmove', move); el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end); };
    }, { passive: true });
    const move = e => {
      if (!d) return;
      const t = e.touches[0];
      const dy = t.clientY - d.y0, dx = t.clientX - d.x0;
      if (!d.mode) {
        if (d.own && e.cancelable) e.preventDefault();
        if (Math.hypot(dx, dy) < 6) return;
        if (Math.abs(dx) > Math.abs(dy)) { release(); d = null; return; }   // sideways: not a sheet drag
        if (dy < 0) {
          if (d.tall && d.body) { release(); d = null; return; }             // tall: the list scrolls
          d.mode = 'size';
        } else if (!d.body || d.body.scrollTop <= 0) d.mode = 'size';
        else if (d.own) d.mode = 'scroll';                                   // normal, list scrolled down: scroll it back up by hand
        else { release(); d = null; return; }                                // tall, list scrolled down: the list scrolls
        d.y0 = t.clientY; d.x0 = t.clientX;
        if (d.mode === 'size') panel.classList.add('dragging');
      }
      if (e.cancelable) e.preventDefault();
      const my = t.clientY - d.y0;
      if (d.mode === 'scroll') { d.body.scrollTop = Math.max(0, d.st0 - my); return; }
      panel.style.height = Math.max(60, Math.min(d.tallH + 16, d.h0 - my)) + 'px';
      // speed from the input's own timestamps (a busy frame on the main thread must not look like a flick)
      const now = e.timeStamp;
      d.pts.push({ y: t.clientY, t: now });
      while (d.pts.length > 2 && now - d.pts[0].t > 120) d.pts.shift();
    };
    const end = e => {
      if (!d) return;
      release();
      const k = d; d = null;
      if (k.mode !== 'size') return;
      const h = panel.getBoundingClientRect().height;
      const a = k.pts[0], b = k.pts[k.pts.length - 1];
      // px per ms, + is downward; a finger that stopped before lifting is not a flick
      const v = e.timeStamp - b.t > 100 ? 0 : (b.y - a.y) / Math.max(16, b.t - a.t);
      const flickUp = v < -0.5, flickDown = v > 0.5;
      let to;
      if (h > k.normalH + 1) to = flickDown ? 'normal' : (flickUp || h - k.normalH > (k.tallH - k.normalH) / 2) ? 'tall' : 'normal';
      else { const drop = k.normalH - h; to = (drop > 90 || (flickDown && drop > 30)) ? 'closed' : 'normal'; }
      panel.classList.remove('dragging');
      panel.style.height = '';
      this.setSheet(to);
    };
    // while a finger is down on the menu, the Slime tab waits with its once-a-second refresh (so a tap or a drag
    // there never loses the button under the finger)
    panel.addEventListener('pointerdown', () => { this.panelPress = true; });
    for (const t of ['pointerup', 'pointercancel']) window.addEventListener(t, () => { this.panelPress = false; }, true);
    // tapping the grip still closes it
    this.$('sheetGrip').addEventListener('click', () => this.setSheet('closed'));
  }

  // A name that does not fit next to the rings (narrow phones: 375 px left about 50 px, "Pebble" became "Pe...") gets
  // the pill's first line to itself; a name that fits keeps the one-line pill. Measured only when the name, the
  // width, the fonts or the pill's visibility change.
  fitName(nb) {
    const card = nb.closest('.slime-card');
    if (!card) return;
    const key = `${nb.textContent}|${innerWidth}|${nb.offsetParent ? 1 : 0}|${document.fonts ? document.fonts.status : ''}`;
    if (key === this.nameFitKey) return;
    this.nameFitKey = key;
    card.classList.remove('long-name');
    if (nb.offsetParent && nb.scrollWidth > nb.clientWidth + 1) card.classList.add('long-name');
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

  // title/text: already-escaped html for a baby from the Nursery
  showNaming(onDone, { rename = false, current = '', title = null, text = null } = {}) {
    const idea = () => NAME_IDEAS[Math.floor(Math.random() * NAME_IDEAS.length)];
    this.openModal(`
      <h2>${rename ? 'A new name?' : title || 'Your slime hatched!'}</h2>
      <p>${rename ? 'Names can change. Your slime will still know it is you.' : text || 'They are looking right at you. What will you call them?'}</p>
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

// the rest of Hud: its parts (./panels/), mixed into Hud.prototype (src/mixin.js)
mixParts(Hud, HelpersPanel, UpgradesPanel, OutfitsPanel, HeirloomsPanel, JournalPanel, SlimePanel);
