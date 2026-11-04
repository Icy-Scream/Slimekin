// Ranch rules: grown-up slimes living on the ranch, pearls, the Pearl Basket, slots,
// placement (selling to a good home) and auctions. No three.js, no DOM.
import { RANCH, BUYERS, BUYER_BY_ID, TRAIT_IDS, BREEDING, SPARK_BY_ID } from '../data/content.js';
import { rng } from './random.js';
import { makeEgg, sparkFor, pureFor, emptyLineage } from './breeding.js';

export function createRanch() {
  return {
    residents: [],
    slots: RANCH.startSlots,
    pearls: 0,
    totalPearls: 0,
    basket: { level: 0, stored: 0 },
    family: { bonus: 0, generation: 1, lifetime: 0 },
    placed: [],
    gift: false,
    lastVisit: 0,
    nursery: { eggs: [], made: 0, given: 0 },   // eggs waiting to start a generation
    sparks: {},       // what the family knows about each spark form: 'observed' | 'understood'
    nearMiss: {},     // spark babies that settled into a normal form, per spark form
    pures: [],        // forms raised Pure (same form as both parents)
  };
}

export function migrateRanch(saved) {
  const fresh = createRanch();
  if (!saved || typeof saved !== 'object') return fresh;
  const out = { ...fresh, ...saved };
  out.basket = { ...fresh.basket, ...(saved.basket || {}) };
  out.family = { ...fresh.family, ...(saved.family || {}) };
  if (!Array.isArray(out.residents)) out.residents = [];
  if (!Array.isArray(out.placed)) out.placed = [];
  out.nursery = { ...fresh.nursery, ...(saved.nursery || {}) };
  if (!Array.isArray(out.nursery.eggs)) out.nursery.eggs = [];
  for (const k of ['sparks', 'nearMiss']) if (!out[k] || typeof out[k] !== 'object' || Array.isArray(out[k])) out[k] = {};
  if (!Array.isArray(out.pures)) out.pures = [];
  // residents from before breeding: first of their family line, no parents on record
  for (const x of out.residents) {
    if (!x || typeof x !== 'object') continue;
    x.lineage = { ...emptyLineage(), ...(x.lineage || {}) };
    if (!Array.isArray(x.lineage.parents)) x.lineage.parents = [];
  }
  out.residents = out.residents.filter(x => x && typeof x === 'object');
  return out;
}

// Permanent Family Bonus (percent) earned by a generation, from all the jelly it made.
export const familyBonusFor = total => 5 * Math.cbrt(Math.max(0, total) / 1e7);
// Steady jelly a resident makes on the ranch, from all the jelly it made while it was growing up.
export const residentJpsFor = total => Math.round(4 * 2 ** Math.max(0, Math.log10(Math.max(1, total)) - 4));

export const dayNumber = (t = Date.now()) => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 86400000);

export class Ranch {
  constructor(state) { this.s = state; }
  get r() { return this.s.ranch; }
  get residents() { return this.r.residents; }
  resident(id) { return this.r.residents.find(x => x.id === id) || null; }
  free() { return this.r.slots - this.r.residents.length; }
  basketCap() { return RANCH.basket[this.r.basket.level].cap; }
  familyMult() { return 1 + this.r.family.bonus / 100; }
  jps() { let t = 0; for (const x of this.r.residents) t += x.jps || 0; return t; }

  happyMult(x) { return 0.4 + 0.6 * x.happiness / 100; }
  // pearls per second for one resident
  pearlRate(x) { return this.happyMult(x) * (1 + 0.05 * (x.bondLevel || 0)) / (RANCH.pearlMinutes * 60); }
  pearlsPerHour() { let t = 0; for (const x of this.r.residents) t += this.pearlRate(x) * 3600; return t; }

  // Live tick. A new pearl counts as in the basket right away (on screen it pops out into the grass
  // first, and can be picked up there). Returns the ids of residents that just made one.
  // Production pauses while the basket is full.
  tick(dt) {
    const made = [];
    const decay = RANCH.happyDecayPerHour / 3600 * dt;
    for (const x of this.r.residents) {
      x.happiness = Math.max(0, x.happiness - decay);
      if (this.r.basket.stored >= this.basketCap()) continue;
      x.pearlT = (x.pearlT || 0) + this.pearlRate(x) * dt;
      if (x.pearlT >= 1) { x.pearlT -= 1; this.r.basket.stored++; made.push(x.id); }
    }
    return made;
  }
  // Picking a pearl up from the grass takes it out of the basket count and into your pocket.
  pickPearl() {
    if (this.r.basket.stored <= 0) return 0;
    this.r.basket.stored--;
    this.addPearls(1);
    return 1;
  }

  // While the game was closed: happiness fades, pearls go straight into the basket.
  tickAway(seconds) {
    if (seconds <= 0 || !this.r.residents.length) return { pearls: 0, full: false };
    let made = 0;
    for (const x of this.r.residents) {
      const before = x.happiness;
      x.happiness = Math.max(0, x.happiness - RANCH.happyDecayPerHour / 3600 * seconds);
      const avg = { ...x, happiness: (before + x.happiness) / 2 };
      const t = (x.pearlT || 0) + this.pearlRate(avg) * seconds;
      made += Math.floor(t);
      x.pearlT = t % 1;
    }
    const before = this.r.basket.stored;
    this.r.basket.stored = Math.min(this.basketCap(), before + made);
    return { pearls: this.r.basket.stored - before, full: this.r.basket.stored >= this.basketCap() };
  }

  addPearls(n) { this.r.pearls += n; this.r.totalPearls += n; }
  collectBasket() {
    const n = this.r.basket.stored;
    if (n <= 0) return 0;
    this.addPearls(n);
    this.r.basket.stored = 0;
    return n;
  }
  spend(n) { if (this.r.pearls < n) return false; this.r.pearls -= n; return true; }

  // ---------- caring for residents ----------
  pet(id, now = Date.now()) {
    const x = this.resident(id);
    if (!x) return null;
    const fresh = now - (x.petAt || 0) > RANCH.petCooldown * 1000;
    if (fresh) { x.happiness = Math.min(100, x.happiness + RANCH.petHappy); x.petAt = now; }
    return { resident: x, counted: fresh };
  }
  // Coming to visit cheers everyone up a little (once in a while).
  visit(now = Date.now()) {
    if (now - (this.r.lastVisit || 0) < RANCH.visitCooldown * 1000) return false;
    this.r.lastVisit = now;
    for (const x of this.r.residents) x.happiness = Math.min(100, x.happiness + RANCH.visitHappy);
    return true;
  }

  // ---------- the Nursery (breeding) ----------
  eggs() { return this.r.nursery.eggs; }
  egg(id) { return this.r.nursery.eggs.find(e => e.id === id) || null; }
  // each resident can be a parent once per (local) calendar day
  restingToday(x, now = Date.now()) { return !!x && x.bredDay === dayNumber(now); }
  canBreed(aId, bId, now = Date.now()) {
    const a = this.resident(aId), b = this.resident(bId);
    if (!a || !b) return { ok: false, reason: 'missing' };
    if (a === b) return { ok: false, reason: 'same' };
    if (this.eggs().length >= BREEDING.maxEggs) return { ok: false, reason: 'full' };
    const resting = [a, b].filter(x => this.restingToday(x, now));
    if (resting.length) return { ok: false, reason: 'resting', who: resting.map(x => x.name) };
    if (this.r.pearls < BREEDING.cost) return { ok: false, reason: 'pearls', cost: BREEDING.cost };
    return { ok: true, cost: BREEDING.cost, spark: sparkFor(a, b)?.id || null, pure: pureFor(a, b) };
  }
  // Two residents make an egg. It waits in the Nursery until a grown slime moves out and you pick it.
  breed(aId, bId, now = Date.now()) {
    if (!this.canBreed(aId, bId, now).ok) return null;
    const a = this.resident(aId), b = this.resident(bId), n = this.r.nursery;
    this.spend(BREEDING.cost);
    const egg = makeEgg(a, b, { now, id: `e${now.toString(36)}-${n.made}` });
    n.made++;
    n.eggs.push(egg);
    a.bredDay = b.bredDay = dayNumber(now);
    if (egg.spark) this.learnSpark(egg.spark, 'observed');
    return { egg, cost: BREEDING.cost };
  }
  eggReady(egg, now = Date.now()) { return !!egg && now >= egg.readyAt; }
  eggSecondsLeft(egg, now = Date.now()) { return Math.max(0, (egg.readyAt - now) / 1000); }
  // A ready egg leaves the Nursery to start the next generation (early: one still warming may leave too; it
  // finishes warming on the cushion).
  takeEgg(id, now = Date.now(), { early = false } = {}) {
    const e = this.egg(id);
    if (!e || (!early && !this.eggReady(e, now))) return null;
    this.r.nursery.eggs = this.r.nursery.eggs.filter(x => x !== e);
    return e;
  }
  // A neighbor family raises an egg you can't make room for (no pearls back, nothing lost but the egg).
  giveEgg(id) {
    const e = this.egg(id);
    if (!e) return null;
    this.r.nursery.eggs = this.r.nursery.eggs.filter(x => x !== e);
    this.r.nursery.given++;
    return e;
  }
  // Journal knowledge of a spark form: unknown -> observed (an egg or a near miss) -> understood (raised one).
  learnSpark(id, level) {
    if (!SPARK_BY_ID[id]) return;
    const rank = { observed: 1, understood: 2 };
    if ((rank[this.r.sparks[id]] || 0) < rank[level]) this.r.sparks[id] = level;
  }

  // ---------- upgrades ----------
  slotCost() { return this.r.slots >= RANCH.maxSlots ? null : RANCH.slotCosts[this.r.slots - RANCH.startSlots]; }
  buySlot() {
    const c = this.slotCost();
    if (c === null || !this.spend(c)) return null;
    this.r.slots++;
    return { cost: c, slots: this.r.slots };
  }
  basketCost() { const next = RANCH.basket[this.r.basket.level + 1]; return next ? next.cost : null; }
  buyBasket() {
    const c = this.basketCost();
    if (c === null || !this.spend(c)) return null;
    this.r.basket.level++;
    return { cost: c, cap: this.basketCap() };
  }

  // ---------- placement and auctions ----------
  // What a resident is worth to a typical buyer, in pearls.
  value(x) {
    const jellyPart = 6 * Math.log10(Math.max(1e6, x.runTotal || 0) / 1e6);
    return 12 + 2 * (x.bondLevel || 0) + jellyPart;
  }
  // How well a resident suits a buyer: 0.75 (poor fit) .. 1.35 (perfect fit).
  fit(x, buyer) {
    const t = x.traits || {};
    const total = TRAIT_IDS.reduce((s, k) => s + (t[k] || 0), 0) || 1;
    if (!buyer.want.length) {
      const top = Math.max(...TRAIT_IDS.map(k => t[k] || 0)) / total;
      return 0.75 + 0.6 * Math.min(1, (1 - top) * 1.6);
    }
    const share = buyer.want.reduce((s, k) => s + (t[k] || 0), 0) / total;
    return 0.75 + 0.6 * Math.min(1, share * 1.25);
  }
  // Three buyers offer a home; the same offers all day.
  offers(x, now = Date.now()) {
    const rand = rng(`${x.id}:offers:${dayNumber(now)}`);
    const pool = [...BUYERS];
    // the best-fitting buyer is always among them; the other two are a surprise
    pool.sort((a, b) => this.fit(x, b) - this.fit(x, a));
    const picks = [pool.shift()];
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return picks.map(b => {
      const f = this.fit(x, b);
      return { buyer: b.id, name: b.name, line: b.line, fit: f, pearls: Math.max(5, Math.round(this.value(x) * f * (0.95 + rand() * 0.1))) };
    }).sort((a, b) => b.pearls - a.pearls);
  }
  place(id, buyerId, now = Date.now()) {
    const x = this.resident(id);
    if (!x) return null;
    const offer = this.offers(x, now).find(o => o.buyer === buyerId);
    if (!offer) return null;
    this.r.residents = this.r.residents.filter(r => r !== x);
    this.addPearls(offer.pearls);
    this.r.placed.push({ name: x.name, form: x.form, buyer: buyerId, at: now, cards: 0, lastCard: dayNumber(now) });
    if (this.r.placed.length > 60) this.r.placed.shift();
    return { resident: x, offer };
  }

  // An open auction: each bidder has a private top bid; the winner pays just above the runner-up.
  // Fixed for the day, so re-listing doesn't change the outcome.
  auction(x, now = Date.now()) {
    const rand = rng(`${x.id}:auction:${dayNumber(now)}`);
    const pool = [...BUYERS];
    const bidders = [];
    for (let i = 0; i < 4; i++) {
      const b = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      const max = Math.round(this.value(x) * (0.8 + 0.65 * (this.fit(x, b) - 0.75) / 0.6 + 0.3) * (0.9 + rand() * 0.25));
      bidders.push({ buyer: b.id, name: b.name, max });
    }
    bidders.sort((a, b) => b.max - a.max);
    const opening = Math.max(3, Math.round(this.value(x) * 0.4));
    const inc = cur => Math.max(1, Math.round(cur * 0.06));
    // play the bidding out step by step so the UI can show it
    const steps = [];
    let price = opening, leader = null;
    for (let guard = 0; guard < 200; guard++) {
      const next = leader ? price + inc(price) : price;
      const challenger = bidders.find(b => b !== leader && b.max >= next);
      if (!challenger) break;
      leader = challenger; price = next;
      steps.push({ buyer: leader.buyer, name: leader.name, price });
    }
    return { bidders, opening, steps, winner: leader, price: leader ? price : 0 };
  }
  sellAtAuction(id, now = Date.now()) {
    const x = this.resident(id);
    if (!x) return null;
    const a = this.auction(x, now);
    if (!a.winner) return null;
    this.r.residents = this.r.residents.filter(r => r !== x);
    this.addPearls(a.price);
    this.r.placed.push({ name: x.name, form: x.form, buyer: a.winner.buyer, at: now, cards: 0, lastCard: dayNumber(now), auction: true });
    if (this.r.placed.length > 60) this.r.placed.shift();
    return { resident: x, price: a.price, buyer: a.winner };
  }

  // Slimes placed in a new home send a postcard on some days during their first week.
  postcards(now = Date.now()) {
    const today = dayNumber(now);
    const out = [];
    for (const p of this.r.placed) {
      if (p.auction || today - dayNumber(p.at) > RANCH.postcardDays || p.lastCard >= today) continue;
      p.lastCard = today;
      const rand = rng(`${p.name}:${p.at}:${today}`);
      if (rand() > 0.6) continue;
      const pearls = 2 + Math.floor(rand() * 3);
      p.cards++;
      this.addPearls(pearls);
      out.push({ name: p.name, buyer: BUYER_BY_ID[p.buyer]?.name || 'their new home', text: BUYER_BY_ID[p.buyer]?.card || 'I am happy here!', pearls });
    }
    return out;
  }
}
