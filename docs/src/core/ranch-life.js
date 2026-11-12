// Ranch life rules: the Training Center (five skills, lessons, lanes) and trips (six places, wagons, souvenirs,
// treats, stories, Friend of a place). All numbers are in RANCH_LIFE (content.js). No three.js, no DOM; everything
// that depends on time takes `now` (ms, the wall clock: game.nowMs()).
//
// Cozy rules: nothing fails and nothing is lost (a lesson always finishes, a trip always comes home); real time only,
// so tapping never speeds anything up; no luck in progress (souvenirs come in a fixed order, a trip's pearls and
// souvenir are fixed when it leaves; seeded dice only pick the story line).
import { RANCH_LIFE, TALENTS, SKILL_IDS, SKILL_BY_ID, PLACE_BY_ID } from '../data/content.js';
import { rng } from './random.js';
import { talentLessonMult, starCap, maxStars, migrateTalents, revealSkill, gradeOf, revealText } from './talents.js';
// (movingday.js imports ranch.js, which imports this file: a harmless cycle, nothing here runs at load time)
import { movingDaySign } from './movingday.js';
// (contests.js imports this file too: the same kind of harmless cycle)
import { contestTripMult } from './contests.js';

const L = RANCH_LIFE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// stars a skill can hold: up to 7 (grade S, core/talents.js); a skill's own cap only limits new lessons, so nobody loses one
const clampStars = v => clamp(Math.floor(Number.isFinite(+v) ? +v : 0), 0, maxStars());
// The Nth star's lesson: stars 1-5 from RANCH_LIFE.lesson, 6 and 7 (talents) from TALENTS.stars.
const starPearls = n => (n <= L.maxStars ? L.lesson.pearls[n - 1] : TALENTS.stars.pearls[n - L.maxStars - 1]);
const starMinutes = n => (n <= L.maxStars ? L.lesson.minutes[n - 1] : TALENTS.stars.minutes[n - L.maxStars - 1]);

// ---------- save ----------
// ranch.life: lanes and wagons owned, souvenirs found ({ souvenirId: { at, by } }), places you are a Friend of,
// and how many lessons and trips ever finished.
export function createLife() {
  return { lanes: L.lanes.start, wagons: L.wagons.start, souvenirs: {}, friends: [], trips: 0, lessons: 0 };
}
export function migrateLife(saved) {
  const fresh = createLife();
  const out = { ...fresh, ...(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}) };
  const count = (v, lo, hi) => clamp(Math.floor(Number.isFinite(+v) ? +v : lo), lo, hi);
  out.lanes = count(out.lanes, L.lanes.start, L.lanes.start + L.lanes.costs.length);
  out.wagons = count(out.wagons, L.wagons.start, L.wagons.start + L.wagons.costs.length);
  out.trips = count(out.trips, 0, Infinity);
  out.lessons = count(out.lessons, 0, Infinity);
  if (!out.souvenirs || typeof out.souvenirs !== 'object' || Array.isArray(out.souvenirs)) out.souvenirs = {};
  out.friends = Array.isArray(out.friends) ? [...new Set(out.friends.filter(id => PLACE_BY_ID[id]))] : [];
  return out;
}
export const emptySkills = () => Object.fromEntries(SKILL_IDS.map(id => [id, 0]));
// A resident from before ranch life: 0 stars, no lesson, no trip. Keeps a valid lesson/trip; drops a broken one.
// From before talents: Potential seeded from its id; the skills it already had lessons in count as revealed.
export function migrateResident(x) {
  x.skills = { ...emptySkills(), ...(x.skills && typeof x.skills === 'object' ? x.skills : {}) };
  for (const id of SKILL_IDS) x.skills[id] = clampStars(x.skills[id]);
  const l = x.lesson;
  if (!(l && typeof l === 'object' && SKILL_BY_ID[l.skill] && Number.isFinite(l.doneAt) && Number.isFinite(l.startAt))) x.lesson = null;
  const t = x.trip;
  if (!(t && typeof t === 'object' && PLACE_BY_ID[t.place] && Number.isFinite(t.homeAt) && Number.isFinite(t.startAt))) x.trip = null;
  migrateTalents(x);
  return x;
}

// ---------- what skills and loves do (also used by core/ranch.js) ----------
export const stars = (x, id) => clampStars(x?.skills?.[id]);
// The star places a skill's row shows (the resident page, the Train picker, a finished lesson's toast and card): 5, or
// its talent's cap (6 for grade A, 7 for S) once a lesson has shown the talent there; never fewer than the stars it has.
// Each place shown is one it has or can still learn: lessonFor stops at the same starCap.
export const starSlots = (x, id) => Math.max(stars(x, id), (Array.isArray(x?.talentsSeen) && x.talentsSeen.includes(id)) ? starCap(x, id) : L.maxStars);
// Sum over the five skills of stars x that skill's per-star effect `key` (RANCH_LIFE.skills[].fx).
const skillFx = (x, key) => L.skills.reduce((t, s) => t + stars(x, s.id) * (s.fx[key] || 0), 0);
// Personality "loves": the sign id of the strongest lean (movingDaySign), and its RANCH_LIFE.loves entry.
export const lovesOf = x => movingDaySign(x?.personality);
export const lovesDef = x => L.loves[lovesOf(x)] || null;
const loveFx = (x, key) => lovesDef(x)?.fx?.[key] || 0;

export const pearlSkillMult = x => 1 + skillFx(x, 'pearls');                                  // Bounce
export const fadeMult = x => (x ? (1 - skillFx(x, 'fade')) * (1 - loveFx(x, 'fade')) : 1);       // Sturdy, Shy
export const offerSkillMult = x => 1 + skillFx(x, 'offers');                                   // Charm
// Speed, Independent; the Sprint Champion perk (core/contests.js: exactly 1 without it)
export const tripTimeMult = x => (1 - skillFx(x, 'tripTime')) * (1 - loveFx(x, 'tripTime')) * contestTripMult(x);
export const tripPearlMult = x => 1 + skillFx(x, 'tripPearls') + loveFx(x, 'tripPearls');       // Smarts, Curious
// Smarts shortens every lesson; a "loves" lesson bonus counts for its own skill (or every skill when it names none);
// the talent in that skill (core/talents.js) multiplies with both. Never under TALENTS.lessonFloor (grade C: as before
// talents, whose shortest was x0.5625, so the floor never touches it).
export function lessonTimeMult(x, skill) {
  const lv = lovesDef(x)?.fx || {};
  const love = lv.lessonTime && (!lv.skill || lv.skill === skill) ? lv.lessonTime : 0;
  return Math.max(TALENTS.lessonFloor, (1 - skillFx(x, 'lessonTime')) * (1 - love) * talentLessonMult(x, skill));
}
// Friend of a place: its buyer pays more for any of your slimes (new homes and auctions).
export function friendMult(state, buyerId) {
  const friends = state?.ranch?.life?.friends || [];
  return friends.some(id => PLACE_BY_ID[id]?.buyer === buyerId) ? 1 + L.friend.offers : 1;
}
// Busy slimes can't be parents, find a new home or go to an auction: 'away' (on a trip), 'lesson', or null.
export const busy = x => (x?.trip ? 'away' : x?.lesson ? 'lesson' : null);
export const isHome = x => !x?.trip;
// Sturdy stars a place needs (0 = always open); Bold slimes reach the far places sooner.
export function placeNeeds(x, place) {
  if (place.reach === 'middle') return L.trip.middleAt;
  if (place.reach === 'far') return loveFx(x, 'farAt') || L.trip.farAt;
  return 0;
}
// Total souvenirs in the game (18).
export const SOUVENIR_TOTAL = L.places.reduce((t, p) => t + p.souvenirs.length, 0);

export class RanchLife {
  // state: the save; ranch: its Ranch (core/ranch.js); sim: the Sim (for the treat's bond), optional
  constructor(state, ranch, sim = null) { this.s = state; this.ranch = ranch; this.sim = sim; }
  get life() { return this.s.ranch.life; }
  get residents() { return this.s.ranch.residents; }
  learners() { return this.residents.filter(x => x.lesson); }
  travelers() { return this.residents.filter(x => x.trip); }
  home() { return this.residents.filter(x => !x.trip); }
  lanesFree() { return this.life.lanes - this.learners().length; }
  wagonsFree() { return this.life.wagons - this.travelers().length; }

  // ---------- lanes and wagons ----------
  laneCost() { return L.lanes.costs[this.life.lanes - L.lanes.start] ?? null; }
  wagonCost() { return L.wagons.costs[this.life.wagons - L.wagons.start] ?? null; }
  buyLane() {
    const c = this.laneCost();
    if (c === null || !this.ranch.spend(c)) return null;
    this.life.lanes++;
    return { cost: c, lanes: this.life.lanes };
  }
  buyWagon() {
    const c = this.wagonCost();
    if (c === null || !this.ranch.spend(c)) return null;
    this.life.wagons++;
    return { cost: c, wagons: this.life.wagons };
  }

  // ---------- lessons ----------
  // The next lesson in a skill: the star it earns, its price and its length for this slime (null at its star cap:
  // 5, or 6 and 7 for a talent graded A and S).
  lessonFor(x, skill) {
    if (!x || !SKILL_BY_ID[skill]) return null;
    const star = stars(x, skill) + 1;
    if (star > starCap(x, skill)) return null;
    return { skill, star, pearls: starPearls(star), seconds: Math.round(starMinutes(star) * 60 * lessonTimeMult(x, skill)) };
  }
  canTrain(id, skill) {
    const x = this.ranch.resident(id);
    if (!x) return { ok: false, reason: 'missing' };
    if (!SKILL_BY_ID[skill]) return { ok: false, reason: 'skill' };
    if (x.trip) return { ok: false, reason: 'away' };
    if (x.lesson) return { ok: false, reason: 'lesson' };
    const l = this.lessonFor(x, skill);
    if (!l) return { ok: false, reason: 'max' };
    if (this.lanesFree() <= 0) return { ok: false, reason: 'lanes', ...l };
    if (this.s.ranch.pearls < l.pearls) return { ok: false, reason: 'pearls', ...l };
    return { ok: true, ...l };
  }
  train(id, skill, now = Date.now()) {
    const c = this.canTrain(id, skill);
    if (!c.ok || !this.ranch.spend(c.pearls)) return null;
    const x = this.ranch.resident(id);
    x.lesson = { skill, star: c.star, startAt: now, doneAt: now + c.seconds * 1000, pearls: c.pearls };
    return { resident: x, lesson: x.lesson, cost: c.pearls, seconds: c.seconds };
  }
  // A lesson ends: one more star, a little happier. The first lesson in a skill reveals its talent there (talent: the
  // barn card's words, '' for grade C).
  finishLesson(x) {
    const l = x.lesson;
    if (!l) return null;
    x.skills = { ...emptySkills(), ...(x.skills || {}) };
    x.skills[l.skill] = Math.max(stars(x, l.skill), clampStars(l.star));
    x.happiness = Math.min(100, (x.happiness || 0) + L.lesson.happy);
    x.lesson = null;
    this.life.lessons++;
    const revealed = revealSkill(x, l.skill);
    return { kind: 'lesson', id: x.id, name: x.name, skill: l.skill, star: x.skills[l.skill], at: l.doneAt,
      talent: revealed ? revealText(gradeOf(x, l.skill), l.skill) : null };
  }

  // ---------- trips ----------
  found(placeId) { const p = PLACE_BY_ID[placeId]; return p ? p.souvenirs.filter(s => this.life.souvenirs[s.id]).length : 0; }
  foundTotal() { return L.places.reduce((t, p) => t + this.found(p.id), 0); }
  // The next souvenir a full trip there brings: the first in order not found yet and not already promised to a slime
  // travelling there now (two wagons to the same place bring the next two). null when all three are found or promised.
  nextSouvenir(placeId, except = null) {
    const p = PLACE_BY_ID[placeId];
    if (!p) return null;
    const promised = new Set(this.travelers().filter(x => x !== except && x.trip.place === placeId).map(x => x.trip.souvenir));
    return p.souvenirs.find(s => !this.life.souvenirs[s.id] && !promised.has(s.id)) || null;
  }
  // What a trip there would be for this slime: its length, the pearls in its bag (its own pearl rate if it were
  // perfectly happy, for that long, plus Smarts and loves), the souvenir it would find, and whether it is open yet.
  tripFor(x, placeId) {
    const p = PLACE_BY_ID[placeId];
    if (!x || !p) return null;
    const seconds = Math.round(p.hours * 3600 * tripTimeMult(x));
    const pearls = Math.round(this.ranch.pearlRate({ ...x, happiness: 100 }) * seconds * tripPearlMult(x));
    const needs = placeNeeds(x, p);
    return { place: p, seconds, pearls, souvenir: this.nextSouvenir(placeId, x), needs, open: stars(x, 'sturdy') >= needs };
  }
  canSend(id, placeId) {
    const x = this.ranch.resident(id);
    if (!x) return { ok: false, reason: 'missing' };
    const t = this.tripFor(x, placeId);
    if (!t) return { ok: false, reason: 'place' };
    if (x.trip) return { ok: false, reason: 'away' };
    if (x.lesson) return { ok: false, reason: 'lesson' };
    if (!t.open) return { ok: false, reason: 'locked', ...t };
    if (this.wagonsFree() <= 0) return { ok: false, reason: 'wagons', ...t };
    return { ok: true, ...t };
  }
  // Off it goes. Trips are free. Everything it brings home is fixed now (seed: the story line).
  send(id, placeId, now = Date.now()) {
    const c = this.canSend(id, placeId);
    if (!c.ok) return null;
    const x = this.ranch.resident(id);
    x.trip = { place: placeId, startAt: now, homeAt: now + c.seconds * 1000, seed: `${x.id}:${placeId}:${now}`, pearls: c.pearls, souvenir: c.souvenir?.id || null };
    return { resident: x, trip: x.trip, ...c };
  }
  // The story line: one of the place's lines, or (half the time, when the place has one) the line for its lean.
  story(x, trip = x.trip) {
    const p = PLACE_BY_ID[trip?.place];
    if (!p) return '';
    const rand = rng(String(trip.seed));
    const leanLine = p.lean?.[lovesOf(x)];
    const a = rand(), b = rand();
    const line = leanLine && a < 0.5 ? leanLine : p.stories[Math.floor(b * p.stories.length)];
    return line.replaceAll('{name}', x.name || 'Your slime');
  }
  // Coming home. A full trip brings everything; an early one (Call home early) brings its share of the pearls and
  // the happiness for the time it travelled, and its story (the souvenir and the treat only come with a full trip).
  finishTrip(x, now = Date.now()) {
    const t = x.trip;
    if (!t) return null;
    const full = now >= t.homeAt;
    const frac = full ? 1 : clamp((now - t.startAt) / Math.max(1, t.homeAt - t.startAt), 0, 1);
    const pearls = full ? t.pearls : Math.floor(t.pearls * frac);
    const p = PLACE_BY_ID[t.place];
    const out = { kind: 'trip', id: x.id, name: x.name, place: t.place, early: !full, pearls, story: this.story(x, t), souvenir: null, friend: null, gift: 0, treat: null, bondUp: 0, at: full ? t.homeAt : now };
    this.ranch.addPearls(pearls);
    x.happiness = Math.min(100, (x.happiness || 0) + L.trip.happy * frac);
    if (full) {
      // the souvenir (the one promised at departure; if it was found meanwhile, the next one)
      const s = (t.souvenir && !this.life.souvenirs[t.souvenir] && p.souvenirs.find(q => q.id === t.souvenir)) || p.souvenirs.find(q => !this.life.souvenirs[q.id]) || null;
      if (s) {
        this.life.souvenirs[s.id] = { at: out.at, by: x.name };
        out.souvenir = s;
        if (this.found(p.id) === p.souvenirs.length && !this.life.friends.includes(p.id)) {
          this.life.friends.push(p.id);
          this.ranch.addPearls(L.friend.gift);
          out.friend = p; out.gift = L.friend.gift;
        }
      }
      // the treat: for the slime at home (joy and bond, no traits), or the traveler's own while an egg waits
      const s0 = this.s;
      if (s0.phase === 'play' && s0.slime) {
        s0.slime.joy = clamp((s0.slime.joy || 0) + L.treat.joy, 0, 100);
        out.bondUp = this.sim ? this.sim.addBond(L.treat.bond) : 0;
        out.treat = { what: p.treat, to: s0.slime.name || 'your slime' };
      } else {
        x.happiness = Math.min(100, x.happiness + L.treat.happy);
        out.treat = { what: p.treat, to: null };
      }
    }
    x.trip = null;
    this.life.trips++;
    return out;
  }
  callHome(id, now = Date.now()) {
    const x = this.ranch.resident(id);
    return x && x.trip ? this.finishTrip(x, now) : null;
  }

  // ---------- time ----------
  // Lessons and trips that are over by `now`, oldest first.
  due(now = Date.now()) {
    const out = [];
    for (const x of this.residents) {
      if (x.lesson && x.lesson.doneAt <= now) out.push({ x, kind: 'lesson', at: x.lesson.doneAt });
      if (x.trip && x.trip.homeAt <= now) out.push({ x, kind: 'trip', at: x.trip.homeAt });
    }
    return out.sort((a, b) => a.at - b.at);
  }
  finish(d, now) { return d.kind === 'lesson' ? this.finishLesson(d.x) : this.finishTrip(d.x, Math.max(now, d.at)); }
  // Live: finish whatever is over now.
  resolve(now = Date.now()) {
    const done = [];
    for (const d of this.due(now)) { const r = this.finish(d, now); if (r) done.push(r); }
    return done;
  }
  // While the game was closed (or hidden) for `seconds` up to `now`: the ranch runs in pieces, split where a lesson
  // ended or a traveler came home, so a slime only makes pearls (and its happiness only fades) while it is home,
  // and each happiness bonus lands when it happened. Returns the ranch's { pearls, full } and what finished.
  passTime(seconds, now = Date.now()) {
    let t = now - Math.max(0, seconds) * 1000, pearls = 0, full = false;
    const done = [];
    const run = until => { if (until > t) { const r = this.ranch.tickAway((until - t) / 1000); pearls += r.pearls; full = r.full; t = until; } };
    for (let guard = 0; guard < 1000; guard++) {
      const d = this.due(now)[0];
      if (!d) break;
      run(d.at);
      const r = this.finish(d, now);
      if (r) done.push(r);
    }
    run(now);
    return { pearls, full: full || this.s.ranch.basket.stored >= this.ranch.basketCap(), done };
  }
}
