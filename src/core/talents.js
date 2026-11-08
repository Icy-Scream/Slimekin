// Talents: raising shapes what a slime is good at. Four sources add up to talent points for each of the five ranch
// skills: diet (what it ate), nature (its personality sliders), its grown-up form's specialty, and its hidden Potential
// (rolled from the egg, partly inherited). The total gives a grade C/B/A/S per skill; the grade makes that skill's
// lessons shorter and lifts its star cap (core/ranch-life.js). All numbers are TALENTS in content.js.
//
// Talents are worked out when they are needed (talentsOf), never stored: a resident's traits, personality and form
// do not change on the ranch, the math is a few dozen operations, and nothing cached can go stale (or need its own
// migration) when the numbers are tuned. Only Potential is saved: on the slime from its egg, and moved with it to the
// ranch. Pure functions; no three.js, no DOM, no Math.random (the economy simulator replays the game's random numbers).
import { TALENTS, SKILL_IDS, SKILL_BY_ID, TRAIT_IDS, PERSONALITY_IDS } from '../data/content.js';
import { rng } from './random.js';

const T = TALENTS;
const zero = () => Object.fromEntries(SKILL_IDS.map(id => [id, 0]));
// (read at call time, so a simulator or test can tune TALENTS without reloading)
const gradeRank = id => T.grades.findIndex(g => g.id === id);

// ---------- Potential (the hidden IVs) ----------
const WEIGHT_SUM = T.potential.weights.reduce((a, b) => a + b, 0);
function rollOne(rand) {
  let r = rand() * WEIGHT_SUM;
  for (let i = 0; i < T.potential.weights.length; i++) { r -= T.potential.weights[i]; if (r < 0) return i + 1; }
  return T.potential.weights.length;
}
// A fresh egg's Potential: 1-5 per skill, fixed by the seed (same seed, same Potential).
export function rollPotential(seed) {
  const rand = rng('potential:' + String(seed));
  return Object.fromEntries(SKILL_IDS.map(id => [id, rollOne(rand)]));
}
// A saved Potential that can be used as it is: every skill a whole number 1-5.
export function validPotential(p) {
  return !!p && typeof p === 'object' && !Array.isArray(p) && SKILL_IDS.every(id => Number.isInteger(p[id]) && p[id] >= 1 && p[id] <= T.potential.weights.length);
}
// A slime's or resident's Potential: its own, or (one from before talents, not migrated yet) seeded from its id.
export const potentialOf = x => (validPotential(x?.potential) ? x.potential : rollPotential('id:' + String(x?.id ?? x?.name ?? '')));
// A bred egg's Potential: per skill, parent A's (copy), parent B's (copy) or a fresh roll; a Pure egg rolls its fresh
// skills pureRolls times and keeps the best. a, b: the parents (residents); same seed, same result.
export function inheritPotential(a, b, seed, { pure = false } = {}) {
  const rand = rng('potential-inherit:' + String(seed));
  const pa = potentialOf(a), pb = potentialOf(b), P = T.potential;
  const out = {};
  for (const id of SKILL_IDS) {
    const r = rand();
    if (r < P.copy) out[id] = pa[id];
    else if (r < 2 * P.copy) out[id] = pb[id];
    else {
      let v = rollOne(rand);
      if (pure) for (let i = 1; i < P.pureRolls; i++) v = Math.max(v, rollOne(rand));
      out[id] = v;
    }
  }
  return out;
}

// ---------- points ----------
// Diet: round(scale x the share of the skill's flavours in its traits).
export function dietPoints(traits) {
  const t = traits && typeof traits === 'object' ? traits : {};
  const total = TRAIT_IDS.reduce((s, k) => s + Math.max(0, +t[k] || 0), 0);
  const share = zero();
  if (total > 0) for (const k of TRAIT_IDS) for (const [skill, part] of Object.entries(T.diet.skills[k] || {})) share[skill] += part * Math.max(0, +t[k] || 0) / total;
  return Object.fromEntries(SKILL_IDS.map(id => [id, Math.round(T.diet.scale * share[id] + 1e-9)]));
}
// Nature: every slider that leans far from the middle, from the end it leans to (both ends count).
export function naturePoints(personality) {
  const p = personality && typeof personality === 'object' ? personality : {};
  const N = T.nature, out = zero();
  for (const k of PERSONALITY_IDS) {
    const v = Number.isFinite(+p[k]) ? +p[k] : 50;
    const pts = Math.min(N.max, Math.max(0, Math.abs(v - 50) - N.dead) / N.per);
    if (pts > 0) out[N.ends[k][v > 50 ? 1 : 0]] += pts;
  }
  return out;
}
// Form: its specialty (+points), or +every to each skill for a balanced form. Spark forms by their spark id.
export function formPoints(form) {
  const out = zero();
  const key = form?.spark || form?.id;
  if (!key) return out;
  if (T.form.every[key]) { for (const id of SKILL_IDS) out[id] += T.form.every[key]; return out; }
  const skill = T.form.skill[key];
  if (skill) out[skill] += T.form.points;
  return out;
}
// Every part and the total per skill (form: a resident's x.form; the slime at home has none until it settles).
export function talentParts(x) {
  const diet = dietPoints(x?.traits), nature = naturePoints(x?.personality), form = formPoints(x?.form), potential = potentialOf(x);
  const total = Object.fromEntries(SKILL_IDS.map(id => [id, diet[id] + nature[id] + form[id] + potential[id]]));
  return { diet, nature, form, potential, total };
}

// ---------- grades ----------
export const gradeFor = points => T.grades.reduce((g, d) => (points >= d.min ? d : g), T.grades[0]).id;
// The grade per skill, with the cozy rule: when all five come out C, the best one (most points; on a tie the first in
// the Training Center's order) is lifted to T.floor.
export function talentsOf(x) {
  const { total } = talentParts(x);
  const grades = Object.fromEntries(SKILL_IDS.map(id => [id, gradeFor(total[id])]));
  if (SKILL_IDS.every(id => grades[id] === 'C')) {
    const best = SKILL_IDS.reduce((b, id) => (total[id] > total[b] ? id : b), SKILL_IDS[0]);
    grades[best] = T.floor;
  }
  return grades;
}
export const gradeOf = (x, skill) => talentsOf(x)[skill] || 'C';
export const gradeDef = id => T.grades.find(g => g.id === id) || T.grades[0];
// What a talent does: lessons in that skill take x this long; it can learn up to this many stars.
export const talentLessonMult = (x, skill) => gradeDef(gradeOf(x, skill)).lessonTime;
export const starCap = (x, skill) => gradeDef(gradeOf(x, skill)).cap;
// the most stars any skill can have (7: grade S)
export const maxStars = () => Math.max(...T.grades.map(g => g.cap));

// ---------- finding talents (the barn card) ----------
// The first lesson in a skill reveals how it takes to it; once seen it stays (x.talentsSeen, saved).
export function revealSkill(x, skill) {
  if (!SKILL_BY_ID[skill]) return false;
  if (!Array.isArray(x.talentsSeen)) x.talentsSeen = [];
  if (x.talentsSeen.includes(skill)) return false;
  x.talentsSeen.push(skill);
  return true;
}
// The line for one revealed skill ('' for grade C).
export function revealText(grade, skill) {
  const t = T.reveal[grade];
  return t && SKILL_BY_ID[skill] ? t.replace('{skill}', SKILL_BY_ID[skill].name) : '';
}
// The card's talent line: the best revealed talent (highest grade; on a tie the one revealed last), or '' (none
// revealed yet, or only grade C ones).
export function revealLine(x) {
  const seen = Array.isArray(x?.talentsSeen) ? x.talentsSeen.filter(id => SKILL_BY_ID[id]) : [];
  if (!seen.length) return '';
  const g = talentsOf(x);
  let best = null;
  for (const id of seen) if (!best || gradeRank(g[id]) >= gradeRank(g[best])) best = id;
  return revealText(g[best], best);
}

// ---------- saves ----------
// A resident or slime from before talents: Potential seeded from its id (or the seed given), nothing revealed yet
// except the skills it already had lessons in (stars > 0: its first lesson there is over). Keeps what is valid.
export function migrateTalents(x, seed = null) {
  if (!x || typeof x !== 'object') return x;
  if (!validPotential(x.potential)) x.potential = seed !== null ? rollPotential(seed) : potentialOf({ id: x.id, name: x.name });
  if (!Array.isArray(x.talentsSeen)) x.talentsSeen = x.skills && typeof x.skills === 'object' ? SKILL_IDS.filter(id => (+x.skills[id] || 0) > 0) : [];
  else x.talentsSeen = [...new Set(x.talentsSeen.filter(id => SKILL_BY_ID[id]))];
  return x;
}
