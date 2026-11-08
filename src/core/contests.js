// Contests: the Beauty Show, the Slime Sprint and the Bounce-Off. A ranch resident performs three acts from what it
// trained (the main skill, a support skill or Style, and Smarts), plus a natural flair from its talent in the main skill
// (core/talents.js), its mood and your cheers. Three friendly rivals per cup have fixed scores; a tie goes to your slime.
// Win a cup and the next one opens for that slime in that contest (Little -> Big -> Grand -> Champion). All numbers are
// CONTESTS in content.js.
//
// Two steps, kept apart: scoreShow() works the whole show out and changes nothing (the entry card's preview, the show,
// the results card all read it); applyShow() writes its result into the save once (trophy, first-win pearls, the
// Trophy Shelf, a Journal line, the show count). Cozy rules: no dice decide a result, nothing is lost on a loss, there is
// no entry fee, and a cup already won pays nothing again. Pure functions; no three.js, no DOM, no Math.random.
import { CONTESTS, CONTEST_BY_ID, CONTEST_IDS, OUTFITS, OUTFIT_BY_ID, SKILL_BY_ID } from '../data/content.js';
import { gradeOf, starCap } from './talents.js';
// (ranch-life.js imports this file for the Sprint perk: a harmless cycle, nothing here runs at load time)
import { stars, busy } from './ranch-life.js';

const C = CONTESTS;
const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const CUP_COUNT = () => C.cups.length;
export const SLOTS = [...new Set(OUTFITS.map(o => o.slot))];

// ---------- save ----------
// Per resident: the highest cup won in each contest (0 = none yet, 4 = Champion). Per save (ranch.contests): the Trophy
// Shelf (the ranch's first win of each cup ever: { 'beauty-little': { id, name, at } }) and how many shows were played.
export const createResidentContests = () => ({ trophies: Object.fromEntries(CONTEST_IDS.map(id => [id, 0])) });
export const createRanchContests = () => ({ shelf: {}, shows: 0 });
// A resident from before contests gets no trophies; a broken count becomes a whole number 0..4. Keeps what is valid.
export function migrateResidentContests(x) {
  if (!isObj(x)) return x;
  const saved = isObj(x.contests) && isObj(x.contests.trophies) ? x.contests.trophies : {};
  const cups = C.cups.length;
  x.contests = { ...(isObj(x.contests) ? x.contests : {}), trophies: Object.fromEntries(CONTEST_IDS.map(id => {
    const v = Number.isFinite(+saved[id]) ? Math.floor(+saved[id]) : 0;
    return [id, clamp(v, 0, cups)];
  })) };
  return x;
}
export function migrateRanchContests(saved) {
  const out = { ...createRanchContests(), ...(isObj(saved) ? saved : {}) };
  out.shows = Number.isFinite(+out.shows) && +out.shows > 0 ? Math.floor(+out.shows) : 0;
  const shelf = isObj(out.shelf) ? out.shelf : {};
  out.shelf = {};
  for (const [k, v] of Object.entries(shelf)) if (shelfKeys().includes(k) && isObj(v)) out.shelf[k] = v;
  return out;
}
export const shelfKey = (contestId, cup) => `${contestId}-${C.cups[cup - 1]?.id}`;
export const shelfKeys = () => CONTEST_IDS.flatMap(c => C.cups.map((_, i) => shelfKey(c, i + 1)));

// ---------- trophies, titles and perks ----------
// the highest cup won per contest (a resident from before contests, or a stand-in in a simulator: none)
export function trophiesOf(x) {
  const t = x?.contests?.trophies;
  return Object.fromEntries(CONTEST_IDS.map(id => [id, clamp(Math.floor(Number.isFinite(+t?.[id]) ? +t[id] : 0), 0, C.cups.length)]));
}
// trophies in all (one per cup won, up to 12)
export const trophyCount = x => Object.values(trophiesOf(x)).reduce((a, b) => a + b, 0);
// the contests it is Champion in
export const championsOf = x => { const t = trophiesOf(x); return CONTEST_IDS.filter(id => t[id] >= C.cups.length); };
// the name-card title ('' for none): one contest's Champion title, or Double / Triple Champion
export function titleOf(x) {
  const ch = championsOf(x);
  if (!ch.length) return '';
  return ch.length === 1 ? CONTEST_BY_ID[ch[0]].title : C.titles[ch.length] || C.titles[CONTEST_IDS.length];
}
const perk = (x, contestId, key) => (championsOf(x).includes(contestId) ? C.perks[contestId]?.[key] || 0 : 0);
// The hooks (exactly 1 with no trophies, so nothing changes until a show is won):
// buyers pay more: trophyValue per trophy, plus the Beauty Champion perk (new homes and auctions; core/ranch.js offerMult)
export function contestOfferMult(x) {
  const n = trophyCount(x);
  return n ? 1 + C.trophyValue * n + perk(x, 'beauty', 'offers') : 1;
}
// trips x shorter: the Sprint Champion perk (core/ranch-life.js tripTimeMult)
export const contestTripMult = x => 1 - perk(x, 'sprint', 'tripTime');
// ranch pearls +x: the Bounce-Off Champion perk (core/ranch.js pearlMult)
export const contestPearlMult = x => 1 + perk(x, 'bounce', 'pearls');

// ---------- Style (the Beauty Show's support act) ----------
// the Style of what it wears (not capped; the act's points are)
export function styleOf(worn) {
  const w = isObj(worn) ? worn : {};
  return SLOTS.reduce((t, slot) => t + (OUTFIT_BY_ID[w[slot]] && OUTFIT_BY_ID[w[slot]].slot === slot ? C.style[w[slot]] || 0 : 0), 0);
}
// the most Style the family's outfits can dress a slime in (the best owned outfit per slot), and that outfit per slot
export function bestDress(owned) {
  const have = new Set(Array.isArray(owned) ? owned : []);
  const worn = Object.fromEntries(SLOTS.map(slot => [slot, null]));
  for (const o of OUTFITS) if (have.has(o.id) && (C.style[o.id] || 0) > (C.style[worn[o.slot]] || 0)) worn[o.slot] = o.id;
  return { worn, style: styleOf(worn) };
}

// ---------- Dress up (rules only) ----------
// Put an outfit the family owns on a resident in its slot (outfitId null: take that slot's outfit off). A slime on a
// trip is not here to dress. Returns { ok, reason?, worn }.
export function dressUp(state, id, slot, outfitId = null) {
  const x = state?.ranch?.residents?.find(r => r.id === id);
  if (!x) return { ok: false, reason: 'missing' };
  if (busy(x) === 'away') return { ok: false, reason: 'away' };
  if (!SLOTS.includes(slot)) return { ok: false, reason: 'slot' };
  if (outfitId !== null) {
    const def = OUTFIT_BY_ID[outfitId];
    if (!def) return { ok: false, reason: 'outfit' };
    if (def.slot !== slot) return { ok: false, reason: 'slot' };
    if (!(state.outfits?.owned || []).includes(outfitId)) return { ok: false, reason: 'owned' };
  }
  x.worn = { ...Object.fromEntries(SLOTS.map(s => [s, null])), ...(isObj(x.worn) ? x.worn : {}), [slot]: outfitId };
  return { ok: true, worn: { ...x.worn } };
}

// ---------- cheers ----------
// One act's cheer from the taps during it (seconds from its ring appearing, any order): only the first tap at or after
// 0 counts (taps after it do nothing, so mashing gets a Nice try); none before `window` = no cheer. Reduced motion:
// every act is Good. The screens share this one function. Returns 'perfect' | 'good' | 'nice' | 'none'.
export function cheerGrade(taps, { reducedMotion = false } = {}) {
  const ch = C.cheer;
  if (reducedMotion) return ch.reduced;
  const list = (Array.isArray(taps) ? taps : [taps]).filter(t => typeof t === 'number' && Number.isFinite(t) && t >= 0 && t < ch.window);
  if (!list.length) return 'none';
  const off = Math.abs(Math.min(...list) - ch.beat);
  return off <= ch.perfect + 1e-9 ? 'perfect' : off <= ch.good + 1e-9 ? 'good' : 'nice';
}
export const cheerPoints = (taps, opts) => C.cheer.points[cheerGrade(taps, opts)];
// The three acts' cheers from what a caller has: per act a list of tap times, or a grade name ('perfect', 'good',
// 'nice', 'none'); a single grade name (or 'skip' / 'mash') for all three. Returns three grade names.
export function cheersFrom(cheers, { reducedMotion = false } = {}) {
  const ch = C.cheer;
  if (reducedMotion) return [ch.reduced, ch.reduced, ch.reduced];
  const one = c => {
    if (typeof c === 'string') return c === 'mash' ? 'nice' : c === 'skip' ? 'none' : ch.points[c] !== undefined ? c : 'none';
    if (Array.isArray(c) || typeof c === 'number') return cheerGrade(c);
    return 'none';
  };
  if (!Array.isArray(cheers)) return [0, 1, 2].map(() => one(cheers ?? 'none'));
  return [0, 1, 2].map(i => one(cheers[i] ?? 'none'));
}

// ---------- who may enter, and which cup ----------
// the cup a slime would enter next in a contest (1 = Little .. 4 = Champion; after the Champion Cup, Champion again)
export const nextCup = (x, contestId) => Math.min(C.cups.length, trophiesOf(x)[contestId] + 1);
// Ranch residents only, home and not in a lesson; a cup it has won, or the next one (no skipping cups).
export function canEnter(state, id, contestId, cup = null) {
  const x = state?.ranch?.residents?.find(r => r.id === id);
  if (!x) return { ok: false, reason: 'missing' };
  if (!CONTEST_BY_ID[contestId]) return { ok: false, reason: 'contest' };
  const b = busy(x);
  if (b) return { ok: false, reason: b };   // 'away' (on a trip) or 'lesson'
  const c = cup === null ? nextCup(x, contestId) : cup;
  if (!Number.isInteger(c) || c < 1 || c > C.cups.length) return { ok: false, reason: 'cup' };
  if (c > nextCup(x, contestId)) return { ok: false, reason: 'locked', cup: c, next: nextCup(x, contestId) };
  return { ok: true, x, cup: c, repeat: c <= trophiesOf(x)[contestId] };
}

// ---------- the score ----------
const S = () => C.score;
function actScore(x, act) {
  if (act.style) { const style = styleOf(x.worn); return { style, points: Math.min(S().styleCap, style) }; }
  const n = stars(x, act.skill), raw = n * S()[act.role];
  return { skill: act.skill, stars: n, points: act.role === 'main' ? raw : Math.min(S().cap, raw) };
}
export const moodOf = x => Math.round(clamp(Number.isFinite(+x?.happiness) ? +x.happiness : 0, 0, 100) / S().moodPer);
export function flairOf(x, contestId) {
  const main = CONTEST_BY_ID[contestId].acts.find(a => a.role === 'main').skill;
  const grade = gradeOf(x, main);
  return { skill: main, grade, points: S().flair[grade] || 0 };
}
// The score without cheers (the entry card's preview) and its parts.
export function baseScore(x, contestId) {
  const def = CONTEST_BY_ID[contestId];
  const acts = def.acts.map(a => ({ id: a.id, name: a.name, role: a.role, ...actScore(x, a) }));
  const flair = flairOf(x, contestId), mood = moodOf(x);
  return { acts, flair, mood, score: acts.reduce((t, a) => t + a.points, 0) + flair.points + mood };
}
export const rivalsFor = cup => C.cups[cup - 1].rivals.map(r => ({ ...r }));

// The coach's tip after a loss: the closest single thing that would have won it. In order: better cheers (free), Style
// from outfits the family already owns (free), then the fewest stars in one act's skill (within its star cap and the
// act's points cap). When no single thing closes the gap: more stars in the main skill while it can still learn, else
// (a Champion Cup without a talent) the cup needs a natural in the main skill.
function coachTip(state, x, contestId, base, cheers, gap, reducedMotion) {
  const def = CONTEST_BY_ID[contestId], sc = S();
  const ch = C.cheer.points, maxCheers = 3 * ch.perfect;
  const main = def.acts.find(a => a.role === 'main').skill;
  if (!reducedMotion && maxCheers - cheers >= gap) return { kind: 'cheers', gap, text: 'Perfect cheers would have done it!' };
  const opts = [];
  for (const a of def.acts) {
    if (a.style) {
      const now = Math.min(sc.styleCap, styleOf(x.worn)), best = Math.min(sc.styleCap, bestDress(state?.outfits?.owned).style);
      if (best - now >= gap) return { kind: 'style', gap, style: now, of: sc.styleCap, text: `Dress up: Style ${now} of ${sc.styleCap}` };
      continue;
    }
    const per = sc[a.role], have = stars(x, a.skill);
    const room = a.role === 'main' ? starCap(x, a.skill) - have : Math.min(starCap(x, a.skill), Math.ceil(sc.cap / per)) - have;
    const need = Math.ceil(gap / per);
    if (room > 0) opts.push({ skill: a.skill, role: a.role, need, room });
  }
  const fits = opts.filter(o => o.need <= o.room).sort((a, b) => a.need - b.need);
  const say = (skill, n) => `${n === 1 ? 'One' : n === 2 ? 'Two' : n === 3 ? 'Three' : String(n)} more ${skillName(skill)} star${n === 1 ? '' : 's'}`;
  if (fits.length) return { kind: 'skill', gap, skill: fits[0].skill, stars: fits[0].need, text: say(fits[0].skill, fits[0].need) };
  const m = opts.find(o => o.role === 'main');
  if (m) return { kind: 'skill', gap, skill: main, stars: m.room, partial: true, text: `${say(main, m.room)}, then try again` };
  return { kind: 'talent', gap, skill: main, text: `This cup needs a natural at ${skillName(main)}` };
}
const skillName = id => SKILL_BY_ID[id]?.name || id;

// The whole show, worked out; changes nothing. opts: cup (default: the next cup), cheers (see cheersFrom), reducedMotion.
// Returns { ok, reason } when it can't enter; else the acts (points and cheer each), flair, mood, cheers, score, the
// rivals and place, won, repeat (a cup already won), the prize it would bring and, after a loss, the coach's tip.
export function scoreShow(state, id, contestId, { cup = null, cheers = 'none', reducedMotion = false } = {}) {
  const e = canEnter(state, id, contestId, cup);
  if (!e.ok) return e;
  const x = e.x, c = e.cup, def = CONTEST_BY_ID[contestId], cupDef = C.cups[c - 1];
  const base = baseScore(x, contestId);
  const grades = cheersFrom(cheers, { reducedMotion });
  const acts = base.acts.map((a, i) => ({ ...a, cheer: grades[i], cheerPoints: C.cheer.points[grades[i]] }));
  const cheerTotal = acts.reduce((t, a) => t + a.cheerPoints, 0);
  const score = base.score + cheerTotal;
  const rivals = rivalsFor(c);
  const top = Math.max(...rivals.map(r => r.score));
  const place = 1 + rivals.filter(r => r.score > score).length;   // a tie goes to your slime
  const won = place === 1, first = won && !e.repeat;
  const key = shelfKey(contestId, c);
  return {
    ok: true, id: x.id, name: x.name, contest: contestId, contestName: def.name, cup: c, cupId: cupDef.id, cupName: cupDef.name,
    acts, flair: base.flair, mood: base.mood, cheers: cheerTotal, score, rivals, top, place, won, repeat: e.repeat,
    prize: { pearls: first ? cupDef.pearls : 0, trophy: first, shelf: first && !state.ranch.contests?.shelf?.[key], champion: first && c === C.cups.length },
    tip: won ? null : coachTip(state, x, contestId, base, cheerTotal, top - score, reducedMotion),
  };
}

// Writes a show's result into the save, once: the show count; and for a cup won the first time, the trophy, its pearls,
// the Trophy Shelf spot (the ranch's first win of that cup ever) and a Journal line. A result is applied only once, and
// a cup already won by then pays nothing (the prize is decided again here, from the save as it is now).
export function applyShow(state, res, now = Date.now()) {
  if (!res || !res.ok || res.applied) return null;
  const x = state?.ranch?.residents?.find(r => r.id === res.id);
  if (!x) return null;
  res.applied = true;
  const R = state.ranch;
  R.contests = migrateRanchContests(R.contests);
  R.contests.shows++;
  const out = { pearls: 0, trophy: false, shelf: false, champion: false, title: titleOf(x), journal: null };
  migrateResidentContests(x);
  if (!res.won || res.cup <= x.contests.trophies[res.contest]) return out;
  const cupDef = C.cups[res.cup - 1], def = CONTEST_BY_ID[res.contest];
  x.contests.trophies[res.contest] = res.cup;
  out.trophy = true;
  out.pearls = cupDef.pearls;
  R.pearls += out.pearls; R.totalPearls += out.pearls;
  const key = shelfKey(res.contest, res.cup);
  if (!R.contests.shelf[key]) { R.contests.shelf[key] = { id: x.id, name: x.name, at: now }; out.shelf = true; }
  out.champion = res.cup === C.cups.length;
  out.title = titleOf(x);
  out.journal = `${x.name || 'Your slime'} won the ${cupDef.name} at the ${def.name}!${out.shelf ? ' It is the first on the Trophy Shelf.' : ''}`;
  if (Array.isArray(state.memories)) {
    state.memories.push({ t: now, icon: '🏆', text: out.journal });
    if (state.memories.length > 300) state.memories.splice(20, state.memories.length - 300);
  }
  return out;
}

// The Trophy Shelf as a list (12 spots, in contest and cup order; empty spots have no winner).
export function shelfList(state) {
  const shelf = state?.ranch?.contests?.shelf || {};
  return CONTEST_IDS.flatMap(c => C.cups.map((cup, i) => ({ contest: c, cup: i + 1, cupName: cup.name, winner: shelf[shelfKey(c, i + 1)] || null })));
}
