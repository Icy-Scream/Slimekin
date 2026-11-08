// Ranch life menus: the Training Center and trips, as plain cards (existing card, button and row styles; emoji
// placeholders for icons, listed in UI-CHANGES.md "Ranch life"). hud.js calls this from a few marked places (the
// resident page, the ranch tab row, the resident rows, the Nursery); game.js calls passTime/update/refuse.
// Rules live in core/ranch-life.js; numbers and words in RANCH_LIFE (content.js).
import { RANCH_LIFE, SKILL_BY_ID, PLACE_BY_ID } from '../data/content.js';
import { fmt, fmtDuration } from '../core/format.js';
import { stars, lovesDef, busy, SOUVENIR_TOTAL } from '../core/ranch-life.js';

const L = RANCH_LIFE;
import { esc } from './esc.js';
import { memIcon } from './icons.js';
const starText = n => '★'.repeat(n) + '☆'.repeat(L.maxStars - n);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const pearlCost = n => `<span class="cost"><i class="pearl"></i>${fmt(n)}</span>`;
// a few small rules for the new pieces only (the UI pass restyles them; see UI-CHANGES.md "Ranch life")
const CSS = `
  .rl-pick:disabled { opacity: .55; cursor: default; }
  .rl-ic { font-size: 24px; line-height: 1; width: 32px; text-align: center; flex: none; }
  .rl-stars { letter-spacing: 1px; color: var(--honey, #e0a526); font-weight: 800; white-space: nowrap; }
  .res .rl-status { grid-column: 1 / -1; }
  .rl-card .upgrades { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rl-card .upgrades .upgrade { min-height: 44px; }
  .rl-return .story { font-style: italic; }`;

export class RanchLifeUI {
  constructor(game) {
    this.g = game;
    this.pending = [];        // finished trips/lessons waiting for the return card
    this.shown = null;        // what the return card on screen lists (put back in the queue if another card replaces it)
    this.cardAt = 3;          // (game seconds) not before this: the welcome-back card goes first
    this.checkT = 0;
    if (typeof document !== 'undefined' && !document.getElementById('ranchLifeCss')) {
      const css = document.createElement('style');
      css.id = 'ranchLifeCss';
      css.textContent = CSS;
      document.head.appendChild(css);
    }
  }
  get rl() { return this.g.sim.life; }
  get rr() { return this.g.sim.ranch; }
  now() { return this.g.nowMs(); }

  // ---------- words ----------
  // "5:10 pm" (today), "tomorrow 7:30 am", or a weekday further out
  clock(ms) {
    const d = new Date(ms), n = new Date(this.now());
    const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    const day = x => Math.floor((x.getTime() - x.getTimezoneOffset() * 60000) / 86400000);
    const gap = day(d) - day(n);
    return gap <= 0 ? t : gap === 1 ? `tomorrow ${t}` : `${d.toLocaleDateString([], { weekday: 'long' })} ${t}`;
  }
  // One status line for a busy slime (null when it is free).
  status(x) {
    if (x.trip) { const p = PLACE_BY_ID[x.trip.place]; return `On a trip to ${p.name}, home at ${this.clock(x.trip.homeAt)}`; }
    if (x.lesson) return `In a ${SKILL_BY_ID[x.lesson.skill].name} lesson (star ${x.lesson.star}), done at ${this.clock(x.lesson.doneAt)}`;
    return null;
  }
  loves(x) { const d = lovesDef(x); return d ? `Loves: ${d.label} (${d.does}).` : ''; }
  // What changes the ranch tab / Nursery must re-render for.
  key() {
    const l = this.g.state.ranch.life;
    return [l.lanes, l.wagons, Object.keys(l.souvenirs).length, l.friends.length,
      this.g.state.ranch.residents.map(x => `${x.id}:${x.lesson ? x.lesson.doneAt : ''}:${x.trip ? x.trip.homeAt : ''}:${Object.values(x.skills || {}).join('')}`).join(',')].join('/');
  }
  away(id) { return !!this.rr.resident(id)?.trip; }
  homeResidents() { return (this.g.state.ranch?.residents || []).filter(x => !x.trip); }

  // ---------- hud hooks ----------
  // Resident page: skills, loves, status, Train / Send on a trip / Call home early.
  residentHtml(x) {
    const total = Object.values(x.skills || {}).reduce((a, b) => a + b, 0);
    const rows = L.skills.map(s => `<div class="row-between"><span>${s.icon} ${esc(s.name)}</span><span class="rl-stars" aria-label="${stars(x, s.id)} of ${L.maxStars} stars">${starText(stars(x, s.id))}</span></div>`).join('');
    const st = this.status(x);
    const id = esc(x.id);
    const acts = x.trip ? `<button class="btn" data-rl="callHome" data-id="${id}">Call home early</button>`
      : x.lesson ? ''
      : `<button class="btn" data-rl="train" data-id="${id}">Train</button><button class="btn" data-rl="trip" data-id="${id}">Send on a trip</button>`;
    return `<div class="sec-title">Skills <span class="count">${total} of ${L.skills.length * L.maxStars} stars</span></div>
      <div class="card rl-skills">${rows}<span class="sub">${esc(this.loves(x))}</span>
        ${st ? `<span class="sub rl-busy"><b>${esc(st)}.</b>${x.trip ? ` ${esc(x.name)} is not on the ranch now.` : ` ${esc(x.name)} keeps making pearls meanwhile.`}</span>` : ''}
        ${acts ? `<div class="res"><div class="acts">${acts}</div></div>` : ''}</div>`;
  }
  // One line on a resident's row in the list.
  rowHtml(x) { const st = this.status(x); return st ? `<span class="sub rl-status">${memIcon(x.trip ? '🧳' : '🎓', '')} ${esc(st)}</span>` : ''; }
  // The "Ranch life" row on the ranch tab.
  ranchRowHtml() {
    const R = this.g.state.ranch, l = R.life, rl = this.rl;
    const lc = rl.laneCost(), wc = rl.wagonCost();
    const ups = [
      lc !== null ? `<button class="upgrade${R.pearls < lc ? ' poor' : ''}" data-rl="lane"><span class="un">Another lane</span><span class="ub">${l.lanes + 1} slimes learn at once.</span>${pearlCost(lc)}</button>` : '',
      wc !== null ? `<button class="upgrade${R.pearls < wc ? ' poor' : ''}" data-rl="wagon"><span class="un">Another wagon</span><span class="ub">${l.wagons + 1} slimes travel at once.</span>${pearlCost(wc)}</button>` : '',
    ].join('');
    return `<div class="card rl-card"><div class="row-between"><b>Ranch life</b><span class="sub">Training Center and trips</span></div>
      <div class="row-between"><span>${memIcon('🎓', '')} Lessons</span><b>${rl.learners().length} / ${plural(l.lanes, 'lane')}</b></div>
      <div class="row-between"><span>${memIcon('🧳', '')} Travelers</span><b>${rl.travelers().length} / ${plural(l.wagons, 'wagon')}</b></div>
      <span class="sub">Tap a slime to visit it, then train it or send it on a trip. Lessons and trips go on while the game is closed.</span>
      ${ups ? `<div class="upgrades">${ups}</div>` : ''}
      <button class="btn" data-rl="shelf">Souvenirs ${rl.foundTotal()} / ${SOUVENIR_TOTAL}</button></div>`;
  }
  // Nursery: why a slime can't be picked as a parent right now (null when it can).
  pickNote(x) { return x.trip ? 'On a trip' : x.lesson ? 'In a lesson' : null; }
  // Nursery message for canBreed's 'away' / 'lesson' reasons.
  breedReason(c) {
    if (c.reason === 'away') return `${esc(c.who.join(' and '))} ${c.who.length > 1 ? 'are' : 'is'} on a trip. Parents need to be home.`;
    if (c.reason === 'lesson') return `${esc(c.who.join(' and '))} ${c.who.length > 1 ? 'are' : 'is'} in a lesson. Try again when it ends.`;
    return '';
  }
  click(b) {
    const k = b.dataset.rl, id = b.dataset.id;
    if (k === 'train') this.openTrain(id);
    else if (k === 'trip') this.openTrips(id);
    else if (k === 'callHome') this.askCallHome(id);
    else if (k === 'lane') this.buy('lane');
    else if (k === 'wagon') this.buy('wagon');
    else if (k === 'shelf') this.openShelf();
  }

  // ---------- refusals (new home, auction) ----------
  // A friendly no for a busy slime (true = refused).
  refuse(x) {
    const why = busy(x);
    if (!why) return false;
    this.g.sfx.error && this.g.sfx.error();
    if (why === 'away') this.g.hud.toast(`<b>${esc(x.name)} is on a trip</b>Home at ${esc(this.clock(x.trip.homeAt))}. New homes and auctions can wait until then.`, '', 3600);
    else this.g.hud.toast(`<b>${esc(x.name)} is in a lesson</b>Done at ${esc(this.clock(x.lesson.doneAt))}. New homes and auctions can wait until then.`, '', 3600);
    return true;
  }

  // ---------- buying lanes and wagons ----------
  buy(what) {
    const g = this.g;
    g.sfx.unlock();
    const r = what === 'lane' ? this.rl.buyLane() : this.rl.buyWagon();
    if (!r) { g.sfx.error(); return; }
    g.sfx.buy();
    g.hud.toast(what === 'lane' ? `<b>Another lane</b>${r.lanes} slimes can learn at the Training Center at once.` : `<b>Another wagon</b>${r.wagons} slimes can travel at once.`);
    g.hud.renderRanch(true);
    g.saveNow(true);
  }

  // ---------- the Train picker ----------
  openTrain(id) {
    const g = this.g, x = this.rr.resident(id);
    if (!x) return;
    const R = g.state.ranch, name = esc(x.name);
    const free = this.rl.lanesFree();
    const items = L.skills.map(s => {
      const c = this.rl.canTrain(id, s.id);
      const n = stars(x, s.id);
      const per = Object.entries(s.fx).map(([k, v]) => ({ pearls: `+${Math.round(v * 100)}% ranch pearls`, tripTime: `trips ${Math.round(v * 100)}% shorter`, fade: `happiness fades ${Math.round(v * 100)}% slower`, lessonTime: `lessons ${Math.round(v * 100)}% shorter`, tripPearls: `trips bring ${Math.round(v * 100)}% more pearls`, offers: `offers +${Math.round(v * 100)}%` }[k])).join(', ');
      const extra = s.id === 'sturdy' ? `; opens the farther trips` : '';
      const line = c.reason === 'max' ? 'All five stars!' : `Star ${c.star}: ${fmtDuration(c.seconds)} · <i class="pearl"></i> ${c.pearls}`;
      return `<button class="card choice rl-pick" data-skill="${s.id}" ${c.ok ? '' : 'disabled'}><span class="rl-ic" aria-hidden="true">${s.icon}</span>
        <span><b>${esc(s.name)} <span class="rl-stars">${starText(n)}</span></b><span class="sub">${line}</span><span class="sub">Each star: ${esc(per + extra)}.</span></span></button>`;
    }).join('');
    const note = free <= 0 ? `<p class="sub"><b>The Training Center is full</b> (${plural(R.life.lanes, 'lane')}). ${this.rl.laneCost() !== null ? 'Another lane is on the Ranch tab.' : ''}</p>`
      : `<p class="sub">You have <i class="pearl"></i> ${fmt(R.pearls)} pearls.</p>`;
    g.hud.openModal(`<h2>Train ${name}</h2><p>One lesson is one more star. ${name} stays on the ranch and keeps making pearls. ${esc(this.loves(x))}</p>${note}
      <div class="egg-choice">${items}</div><div class="actions"><button class="btn" id="rlNo">Not now</button></div>`, {
      onOpen: card => {
        card.querySelector('#rlNo').addEventListener('click', () => g.hud.closeModal());
        for (const b of card.querySelectorAll('[data-skill]')) b.addEventListener('click', () => { g.hud.closeModal(); this.train(id, b.dataset.skill); });
      },
    });
  }
  train(id, skill) {
    const g = this.g;
    g.sfx.unlock();
    const r = this.rl.train(id, skill, this.now());
    if (!r) { g.sfx.error(); g.hud.renderRanch(true); return null; }
    const x = r.resident, s = SKILL_BY_ID[skill];
    g.sfx.buy();
    const v = g.ranch.resident(id); if (v) { v.av.hop(4); v.happyT = 1.6; }
    g.hud.toast(`<b>${esc(x.name)} started a ${esc(s.name)} lesson</b>Star ${r.lesson.star}, done at ${esc(this.clock(r.lesson.doneAt))}.`, '', 3200);
    g.remember('🎓', `${x.name} started learning ${s.name} at the Training Center.`, `lesson1-${x.id}`);
    g.hud.renderRanch(true);
    g.saveNow(true);
    return r;
  }

  // ---------- the trip picker ----------
  openTrips(id) {
    const g = this.g, x = this.rr.resident(id);
    if (!x) return;
    const name = esc(x.name), home = g.state.phase === 'play' ? esc(g.state.slime.name || 'your slime') : null;
    const free = this.rl.wagonsFree();
    const items = L.places.map(p => {
      const c = this.rl.canSend(id, p.id);
      const found = this.rl.found(p.id);
      const line = c.open ? `${fmtDuration(c.seconds)} · about <i class="pearl"></i> ${c.pearls} · souvenirs ${found}/${p.souvenirs.length}`
        : `Opens at Sturdy ${starText(c.needs).replace(/☆/g, '')} (${name} has ${stars(x, 'sturdy')})`;
      return `<button class="card choice rl-pick" data-place="${p.id}" ${c.ok ? '' : 'disabled'}><span class="rl-ic" aria-hidden="true">${p.icon}</span>
        <span><b>${esc(p.name)}</b><span class="sub">${line}</span>${this.rl.life.friends.includes(p.id) ? '<span class="sub">You are a Friend of this place.</span>' : ''}</span></button>`;
    }).join('');
    const note = free <= 0 ? `<p class="sub"><b>Every wagon is out</b> (${plural(this.rl.life.wagons, 'wagon')}). ${this.rl.wagonCost() !== null ? 'Another wagon is on the Ranch tab.' : ''}</p>` : '';
    g.hud.openModal(`<h2>Send ${name} on a trip</h2><p>Trips are free. ${name} comes home on their own with pearls in their bag, a souvenir, ${home ? `a treat for ${home}` : 'a treat'} and a little story.</p>${note}
      <div class="egg-choice">${items}</div><div class="actions"><button class="btn" id="rlNo">Not now</button></div>`, {
      onOpen: card => {
        card.querySelector('#rlNo').addEventListener('click', () => g.hud.closeModal());
        for (const b of card.querySelectorAll('[data-place]')) b.addEventListener('click', () => { g.hud.closeModal(); this.send(id, b.dataset.place); });
      },
    });
  }
  send(id, placeId) {
    const g = this.g;
    g.sfx.unlock();
    const r = this.rl.send(id, placeId, this.now());
    if (!r) { g.sfx.error(); g.hud.renderRanch(true); return null; }
    const x = r.resident, p = PLACE_BY_ID[placeId];
    g.sfx.sparkle();
    // it hops out through the gate (the scene leaves travelers out); its page stays open, and the camera follows it out
    // (the scene's own focus would hold it still, so only the page keeps it)
    if (g.ranch.focusId === id) g.ranch.focusId = null;
    if (g.view === 'ranch') g.ranch.leave(id, () => g.ranch.sync(this.homeResidents()));
    else g.ranch.sync(this.homeResidents());
    g.hud.toast(`<b>${esc(x.name)} is off to ${esc(p.name)}!</b>Home at ${esc(this.clock(r.trip.homeAt))}.`, 'love', 3400);
    g.remember('🧳', `${x.name} went on a first trip, to ${p.name}.`, `trip1-${x.id}`);
    g.hud.renderRanch(true);
    g.saveNow(true);
    return r;
  }
  askCallHome(id) {
    const g = this.g, x = this.rr.resident(id);
    if (!x || !x.trip) return;
    const t = x.trip, p = PLACE_BY_ID[t.place], name = esc(x.name);
    const frac = Math.max(0, Math.min(1, (this.now() - t.startAt) / Math.max(1, t.homeAt - t.startAt)));
    g.hud.openModal(`<h2>Call ${name} home early?</h2><p>${name} comes straight home from ${esc(p.name)} with ${Math.floor(t.pearls * frac)} of their ${t.pearls} pearls and their story. The souvenir and the treat only come with a full trip (home at ${esc(this.clock(t.homeAt))}).</p>
      <div class="actions"><button class="btn" id="rlNo">Let ${name} finish</button><button class="btn primary" id="rlYes">Call home</button></div>`, {
      onOpen: card => {
        card.querySelector('#rlNo').addEventListener('click', () => g.hud.closeModal());
        card.querySelector('#rlYes').addEventListener('click', () => { g.hud.closeModal(); this.callHome(id); });
      },
    });
  }
  callHome(id) {
    const r = this.rl.callHome(id, this.now());
    if (!r) return null;
    this.announce([r], { live: true });
    return r;
  }

  // ---------- the souvenir shelf ----------
  openShelf() {
    const g = this.g, l = g.state.ranch.life;
    const cards = L.places.map(p => {
      const n = this.rl.found(p.id), friend = l.friends.includes(p.id);
      const chips = p.souvenirs.map(s => (l.souvenirs[s.id] ? `<span title="Found by ${esc(l.souvenirs[s.id].by || '')}">${s.icon} ${esc(s.name)}</span>` : '<span>? ? ?</span>')).join('');
      return `<div class="card"><div class="row-between"><b>${p.icon} ${esc(p.name)}</b><span class="sub">${n} / ${p.souvenirs.length}</span></div>
        <div class="owned-list">${chips}</div>${friend ? `<span class="sub"><b>Friend of ${esc(p.name)}:</b> its buyer offers ${Math.round(L.friend.offers * 100)}% more for your slimes.</span>` : ''}</div>`;
    }).join('');
    g.hud.openModal(`<h2>Souvenirs ${this.rl.foundTotal()} / ${SOUVENIR_TOTAL}</h2><p>Every full trip brings home the next souvenir from that place. Find all three and you become a Friend of the place.</p>
      ${cards}<div class="actions"><button class="btn primary" id="rlOk">Done</button></div>`, {
      onOpen: card => card.querySelector('#rlOk').addEventListener('click', () => g.hud.closeModal()),
    });
  }

  // ---------- time: on load, back from hidden, live ----------
  // The game was closed or hidden for `seconds`: run the ranch in pieces (core passTime) and announce what finished
  // as one card. Returns the ranch's { pearls, full } like Ranch.tickAway.
  passTime(seconds) {
    const r = seconds > 5 ? this.rl.passTime(seconds, this.now()) : { pearls: 0, full: false, done: this.rl.resolve(this.now()) };
    if (r.done.length) { this.g.ranch.sync(this.homeResidents()); this.announce(r.done, { live: false }); }
    return { pearls: r.pearls, full: r.full };
  }
  update(dt) {
    const g = this.g;
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 0.5;
      const done = this.rl.resolve(this.now());
      if (done.length) this.announce(done, { live: true });
    }
    // the card was closed (seen), or another card took its place before it was seen: show it again later
    if (this.shown && !g.hud.modalOpen) {
      if (!document.querySelector('#modalCard [data-rl-card]')) this.pending.unshift(...this.shown);
      this.shown = null;
    }
    if (this.pending.length && g.time >= this.cardAt && !g.hud.modalOpen && !g.hatching && !g.departing && !g.auction && g.state.phase !== 'naming') this.showCard();
  }
  // Toasts and Journal lines now; trips (and anything that finished while the game was closed) also get the card.
  announce(done, { live }) {
    const g = this.g;
    let sync = false;
    for (const r of done) {
      if (r.kind === 'lesson') {
        const s = SKILL_BY_ID[r.skill];
        g.remember('🎓', `${r.name} earned ${plural(r.star, 'star')} in ${s.name} at the Training Center.`);
        if (live) {
          g.hud.toast(`<b>${esc(r.name)} earned ${plural(r.star, 'star')} in ${esc(s.name)}!</b>${starText(r.star)} · a happy slime after a good lesson.`, 'love', 3400);
          g.sfx.levelUp ? g.sfx.levelUp() : g.sfx.sparkle();
          const v = g.ranch.resident(r.id); if (v) { v.av.hop(5); v.happyT = 2; }
        } else this.pending.push(r);
      } else {
        sync = true;
        g.barnRanch && g.barnRanch.noteBack(r);   // [barn] the name card says "just back from ..." for a while
        const p = PLACE_BY_ID[r.place];
        g.remember('🧳', `${r.name} came home from ${p.name}${r.early ? ' early' : ''}. ${r.story}${r.souvenir ? ` Found: ${r.souvenir.name}.` : ''}`);
        if (r.friend) g.remember('💌', `A thank-you postcard from ${p.name}: the family is a Friend of ${p.name} now (+${r.gift} pearls).`);
        if (r.bondUp) g.onBondUp && g.onBondUp(r.bondUp);
        if (live) {
          g.hud.toast(`<b>${esc(r.name)} is home from ${esc(p.name)}!</b>${r.pearls ? `+${r.pearls} pearls in the bag` : 'Back home'}${r.souvenir ? ` and a ${esc(r.souvenir.name)}` : ''}.`, 'love', 3200);
          g.sfx.sparkle();
          if (r.treat?.to && g.state.phase === 'play' && g.view !== 'ranch' && !g.sim.asleep) {
            g.slime.hop(4);
            g.fx.emit('hearts', g.slime.headTopWorld(g.v1), { count: 5 });
          }
          this.cardAt = Math.max(this.cardAt, g.time + 1.6);
        }
        this.pending.push(r);
      }
    }
    if (sync) g.ranch.sync(this.homeResidents());
    g.hud.renderRanch(true);
    g.markDirty(true);
  }
  // One card for everything waiting: trips (pearls, souvenir, treat, story) and lessons that ended while closed.
  showCard() {
    const g = this.g, list = this.pending.splice(0);
    const trips = list.filter(r => r.kind === 'trip'), lessons = list.filter(r => r.kind === 'lesson');
    const tripHtml = trips.map(r => {
      const p = PLACE_BY_ID[r.place];
      const treat = r.treat ? (r.treat.to ? `${esc(r.name)} brought ${esc(r.treat.to)} ${esc(r.treat.what)}!` : `${esc(r.name)} ate ${esc(r.treat.what)} on the way home. Yum!`) : '';
      return `<div class="card rl-return"><div class="row-between"><b>${p.icon} ${esc(r.name)} · ${esc(p.name)}</b>${r.pearls ? `<span class="cost"><i class="pearl"></i>+${r.pearls}</span>` : ''}</div>
        <span class="sub story">"${esc(r.story)}"</span>
        ${r.souvenir ? `<span class="sub">Found a souvenir: ${r.souvenir.icon} <b>${esc(r.souvenir.name)}</b> (${this.rl.found(r.place)}/${p.souvenirs.length} from ${esc(p.name)}).</span>` : ''}
        ${treat ? `<span class="sub">${treat}</span>` : ''}
        ${r.early ? '<span class="sub">Home early: the souvenir and the treat wait for a full trip.</span>' : ''}
        ${r.friend ? `<span class="sub"><b>Friend of ${esc(p.name)}!</b> A thank-you postcard with ${r.gift} pearls. Its buyer offers ${Math.round(L.friend.offers * 100)}% more for your slimes now.</span>` : ''}</div>`;
    }).join('');
    const lessonHtml = lessons.map(r => `<div class="card"><div class="row-between"><b>${memIcon('🎓', '')} ${esc(r.name)} · ${esc(SKILL_BY_ID[r.skill].name)}</b><span class="rl-stars">${starText(r.star)}</span></div><span class="sub">${esc(r.name)} earned ${plural(r.star, 'star')} in ${esc(SKILL_BY_ID[r.skill].name)}.</span></div>`).join('');
    const title = list.length > 1 ? 'While you were away' : trips.length ? `${esc(trips[0].name)} is home!` : 'Lesson done!';
    this.shown = list;
    g.hud.openModal(`<h2 data-rl-card>${title}</h2>${tripHtml}${lessonHtml}<div class="actions"><button class="btn primary" id="rlOk">Yay!</button></div>`, {
      onOpen: card => card.querySelector('#rlOk').addEventListener('click', () => g.hud.closeModal()),
    });
    g.sfx.mii && g.sfx.mii();
  }

  // ---------- #debug ----------
  debugFinish(kind) {
    const now = this.now();
    for (const x of this.g.state.ranch.residents) {
      if (kind === 'lessons' && x.lesson) x.lesson.doneAt = Math.min(x.lesson.doneAt, now);
      if (kind === 'trips' && x.trip) x.trip.homeAt = Math.min(x.trip.homeAt, now);
    }
    this.checkT = 0;
  }
}
