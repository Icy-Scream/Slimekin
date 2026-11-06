// Ranch rules: grown-up slimes living on the ranch, pearls, the Pearl Basket, slots,
// placement (selling to a good home) and auctions. No three.js, no DOM.
import { RANCH, BUYERS, BUYER_BY_ID, TRAIT_IDS, BREEDING, SPARK_BY_ID, BREEDS } from '../data/content.js';
import { rng } from './random.js';
import { makeEgg, sparkFor, pureFor, emptyLineage } from './breeding.js';
import { residentMedal } from './medals.js';
import { heirloomMult } from './heirlooms.js';
import { oldBody, cleanBody, rollSpecialEgg } from './recipe.js';
import { createLife, migrateLife, migrateResident, pearlSkillMult, fadeMult, offerSkillMult, friendMult, busy } from './ranch-life.js';

export function createRanch() {
  return {
    residents: [],
    slots: RANCH.startSlots,
    pearls: 0,
    totalPearls: 0,
    basket: { level: 0, stored: 0 },
    // bonus: the Family Bonus (percent) every other system reads; lifetime: all jelly the family ever made;
    // legacy: an old save's hidden head start (extra lifetime jelly that reproduces the bonus it had before the
    // lifetime rule). bonus = familyBonusFor(lifetime + legacy), recomputed at each move-out; it never goes down.
    family: { bonus: 0, generation: 1, lifetime: 0, legacy: 0 },
    placed: [],
    gift: false,
    lastVisit: 0,
    nursery: { eggs: [], made: 0, given: 0, bought: 0 },   // eggs waiting to start a generation (bought: special eggs)
    sparks: {},       // what the family knows about each spark form: 'observed' | 'understood'
    nearMiss: {},     // spark babies that settled into a normal form, per spark form
    pures: [],        // forms raised Pure (same form as both parents)
    life: createLife(),   // ranch life (core/ranch-life.js): lanes, wagons, souvenirs, Friend of places
  };
}

export function migrateRanch(saved) {
  const fresh = createRanch();
  if (!saved || typeof saved !== 'object') return fresh;
  const out = { ...fresh, ...saved };
  out.basket = { ...fresh.basket, ...(saved.basket || {}) };
  out.family = { ...fresh.family, ...(saved.family || {}) };
  const num = v => (Number.isFinite(+v) && +v > 0 ? +v : 0);
  for (const k of ['bonus', 'lifetime']) out.family[k] = num(out.family[k]);
  // Family Legacy: a save from before the lifetime rule keeps its Family Bonus exactly. The extra lifetime jelly
  // that gives that bonus becomes a hidden head start, so every later move-out still raises it. Filled once.
  if (!Number.isFinite(saved.family?.legacy)) out.family.legacy = legacyFor(out.family.bonus, out.family.lifetime);
  if (!Array.isArray(out.residents)) out.residents = [];
  if (!Array.isArray(out.placed)) out.placed = [];
  out.nursery = { ...fresh.nursery, ...(saved.nursery || {}) };
  if (!Array.isArray(out.nursery.eggs)) out.nursery.eggs = [];
  for (const k of ['sparks', 'nearMiss']) if (!out[k] || typeof out[k] !== 'object' || Array.isArray(out[k])) out[k] = {};
  if (!Array.isArray(out.pures)) out.pures = [];
  out.life = migrateLife(saved.life);
  // residents from before breeding: first of their family line, no parents on record
  // (and from before ranch life: 0 stars in every skill, no lesson, no trip)
  for (const x of out.residents) {
    if (!x || typeof x !== 'object') continue;
    x.lineage = { ...emptyLineage(), ...(x.lineage || {}) };
    if (!Array.isArray(x.lineage.parents)) x.lineage.parents = [];
    // the recipe body: residents from before it are Curlys (plain, mix 0, neutral genes)
    Object.assign(x, 'breed' in x ? cleanBody(x) : oldBody());
    migrateResident(x);   // ranch life: skills, lesson, trip
  }
  // Nursery eggs from before the recipe body hatch Curlys
  for (const e of out.nursery.eggs) if (e && typeof e === 'object') e.body = e.body ? cleanBody(e.body) : oldBody();
  out.residents = out.residents.filter(x => x && typeof x === 'object');
  return out;
}

// Family Bonus (percent) from all the jelly the family ever made (Family Legacy: the lifetime rule).
export const familyBonusFor = total => RANCH.bonusPercent * Math.cbrt(Math.max(0, total) / RANCH.bonusJelly);
// The extra lifetime jelly that makes familyBonusFor(lifetime + legacy) equal an old save's bonus (0 if the
// lifetime alone already gives at least that much).
export const legacyFor = (bonus, lifetime) =>
  bonus > familyBonusFor(lifetime) ? Math.max(0, RANCH.bonusJelly * (bonus / RANCH.bonusPercent) ** 3 - lifetime) : 0;
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
  // The Family Bonus the lifetime rule gives, with `extra` jelly added to the family's lifetime (e.g. the jelly of
  // the slime that is about to move out). The stored bonus only changes at a move-out.
  familyBonusWith(extra = 0) { const f = this.r.family; return familyBonusFor((f.lifetime || 0) + (f.legacy || 0) + Math.max(0, extra || 0)); }
  jps() { let t = 0; for (const x of this.r.residents) t += x.jps || 0; return t; }

  happyMult(x) { return 0.4 + 0.6 * x.happiness / 100; }
  // Medal perks (core/medals.js, MEDALS in content.js): a resident's medal makes more pearls and fetches better
  // offers. Old residents get theirs from runTotal (nothing new is saved for residents). Heirlooms multiply on top:
  // Ranch Lanterns (pearls), Family Statue (what buyers pay).
  medal(x) { return residentMedal(x); }
  // Ranch life (core/ranch-life.js): Bounce stars add pearls, Charm stars add to offers.
  pearlMult(x) { return this.medal(x).pearls * heirloomMult(this.s, 'ranchPearls') * pearlSkillMult(x); }
  offerMult(x) { return (1 + this.medal(x).offers) * heirloomMult(this.s, 'buyerPay') * offerSkillMult(x); }
  // happiness lost per hour (the Family Portrait halves it; a resident's Sturdy stars and a Shy lean slow it down)
  happyDecay(x) { return RANCH.happyDecayPerHour * heirloomMult(this.s, 'happyDecay') * fadeMult(x); }
  // pearls per second for one resident
  pearlRate(x) { return this.happyMult(x) * (1 + 0.05 * (x.bondLevel || 0)) * this.pearlMult(x) / (RANCH.pearlMinutes * 60); }
  // (a slime on a trip makes no ranch pearls: its pearls come home in its bag)
  pearlsPerHour() { let t = 0; for (const x of this.r.residents) if (!x.trip) t += this.pearlRate(x) * 3600; return t; }

  // Live tick. A new pearl counts as in the basket right away (on screen it pops out into the grass
  // first, and can be picked up there). Returns the ids of residents that just made one.
  // Production pauses while the basket is full.
  // A slime on a trip is not here: no pearls, and its happiness does not fade.
  tick(dt) {
    const made = [];
    for (const x of this.r.residents) {
      if (x.trip) continue;
      x.happiness = Math.max(0, x.happiness - this.happyDecay(x) / 3600 * dt);
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

  // While the game was closed: happiness fades, pearls go straight into the basket (travelers skipped, as in tick;
  // RanchLife.passTime splits the time where a traveler came home or a lesson ended).
  tickAway(seconds) {
    if (seconds <= 0 || !this.r.residents.length) return { pearls: 0, full: false };
    let made = 0;
    for (const x of this.r.residents) {
      if (x.trip) continue;
      const before = x.happiness;
      x.happiness = Math.max(0, x.happiness - this.happyDecay(x) / 3600 * seconds);
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
    if (!x || x.trip) return null;
    const fresh = now - (x.petAt || 0) > RANCH.petCooldown * 1000;
    if (fresh) { x.happiness = Math.min(100, x.happiness + RANCH.petHappy); x.petAt = now; }
    return { resident: x, counted: fresh };
  }
  // Coming to visit cheers everyone up a little (once in a while).
  visit(now = Date.now()) {
    if (now - (this.r.lastVisit || 0) < RANCH.visitCooldown * 1000) return false;
    this.r.lastVisit = now;
    for (const x of this.r.residents) if (!x.trip) x.happiness = Math.min(100, x.happiness + RANCH.visitHappy);
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
    // ranch life: a slime on a trip or in a lesson can't be a parent until it is back / done
    const away = [a, b].filter(x => busy(x) === 'away'), learning = [a, b].filter(x => busy(x) === 'lesson');
    if (away.length) return { ok: false, reason: 'away', who: away.map(x => x.name) };
    if (learning.length) return { ok: false, reason: 'lesson', who: learning.map(x => x.name) };
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
    egg.readyAt = now + (egg.readyAt - now) * heirloomMult(this.s, 'eggTime');   // the Patchwork Quilt
    n.made++;
    n.eggs.push(egg);
    a.bredDay = b.bredDay = dayNumber(now);
    if (egg.spark) this.learnSpark(egg.spark, 'observed');
    return { egg, cost: BREEDING.cost };
  }
  // ---------- special eggs (pearls) ----------
  // A Cat-ear or Topknot egg (BREEDS.specialEggs): the type is guaranteed (a Dollop of that variant). It waits in the
  // Nursery like a bred egg: same warm time, same nest limit, chosen at move-out or put on the cushion.
  canBuySpecialEgg(variant) {
    const def = BREEDS.specialEggs[variant];
    if (!def) return { ok: false, reason: 'missing' };
    if (this.eggs().length >= BREEDING.maxEggs) return { ok: false, reason: 'full' };
    if (this.r.pearls < def.price) return { ok: false, reason: 'pearls', cost: def.price };
    return { ok: true, cost: def.price };
  }
  buySpecialEgg(variant, now = Date.now()) {
    if (!this.canBuySpecialEgg(variant).ok) return null;
    const def = BREEDS.specialEggs[variant], n = this.r.nursery;
    this.spend(def.price);
    const id = `s${now.toString(36)}-${n.made}`, seed = `${variant}|${id}`;
    const egg = { id, seed, laidAt: now, readyAt: now + this.newEggSeconds() * 1000, parents: [], special: variant, spark: null, pure: null,
      line: 1, bias: {}, personality: {}, favorite: null, body: rollSpecialEgg(variant, seed) };
    n.made++;
    n.bought = (n.bought || 0) + 1;
    n.eggs.push(egg);
    return { egg, cost: def.price, first: n.bought === 1 };
  }
  eggReady(egg, now = Date.now()) { return !!egg && now >= egg.readyAt; }
  // how long this egg warms in all (eggs made with the Patchwork Quilt warm faster)
  eggWarmSeconds(egg) { return egg && egg.laidAt > 0 && egg.readyAt > egg.laidAt ? (egg.readyAt - egg.laidAt) / 1000 : BREEDING.readyHours * 3600; }
  // how long a new egg would warm now
  newEggSeconds() { return BREEDING.readyHours * 3600 * heirloomMult(this.s, 'eggTime'); }
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
      // (Friend of a place: that place's buyer offers more; ranch life)
      return { buyer: b.id, name: b.name, line: b.line, fit: f, pearls: Math.max(5, Math.round(this.value(x) * f * (0.95 + rand() * 0.1) * this.offerMult(x) * friendMult(this.s, b.id))) };
    }).sort((a, b) => b.pearls - a.pearls);
  }
  place(id, buyerId, now = Date.now()) {
    const x = this.resident(id);
    if (!x || busy(x)) return null;   // (on a trip or in a lesson: not now)
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
      const max = Math.round(this.value(x) * (0.8 + 0.65 * (this.fit(x, b) - 0.75) / 0.6 + 0.3) * (0.9 + rand() * 0.25) * friendMult(this.s, b.id));
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
    // medal perk: the same bidding, every price scaled (a Ribbon slime's auction is exactly as before)
    const m = this.offerMult(x), up = n => (m === 1 ? n : Math.round(n * m));
    for (const b of bidders) b.max = up(b.max);
    for (const s of steps) s.price = up(s.price);
    return { bidders, opening: up(opening), steps, winner: leader, price: leader ? up(price) : 0 };
  }
  sellAtAuction(id, now = Date.now()) {
    const x = this.resident(id);
    if (!x || busy(x)) return null;   // (on a trip or in a lesson: not now)
    const a = this.auction(x, now);
    if (!a.winner) return null;
    this.r.residents = this.r.residents.filter(r => r !== x);
    this.addPearls(a.price);
    this.r.placed.push({ name: x.name, form: x.form, buyer: a.winner.buyer, at: now, cards: 0, lastCard: dayNumber(now), auction: true });
    if (this.r.placed.length > 60) this.r.placed.shift();
    return { resident: x, price: a.price, buyer: a.winner };
  }

  // Slimes placed in a new home send a postcard on some days during their first week. A baby's postcard is
  // written by a baby and has no pearls in it (babies are not a way to make pearls).
  postcards(now = Date.now()) {
    const today = dayNumber(now);
    const out = [];
    for (const p of this.r.placed) {
      if (p.auction || today - dayNumber(p.at) > RANCH.postcardDays || p.lastCard >= today) continue;
      p.lastCard = today;
      const rand = rng(`${p.name}:${p.at}:${today}`);
      if (rand() > 0.6) continue;
      if (p.baby) {
        p.cards++;
        out.push({ name: p.name, buyer: BUYER_BY_ID[p.buyer]?.name || 'their new home', text: BUYER_BY_ID[p.buyer]?.babyCard || 'I learned to hop on one side!', pearls: 0, baby: true });
        continue;
      }
      const pearls = 2 + Math.floor(rand() * 3);
      p.cards++;
      this.addPearls(pearls);
      out.push({ name: p.name, buyer: BUYER_BY_ID[p.buyer]?.name || 'their new home', text: BUYER_BY_ID[p.buyer]?.card || 'I am happy here!', pearls });
    }
    return out;
  }
}
