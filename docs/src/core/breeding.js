// Breeding rules: what a baby inherits from two ranch slimes, family sparks, Pure lines, and how a
// bred baby's form is decided when it settles. Pure functions; no three.js, no DOM.
import { BREEDING, SPARK_FORMS, SPARK_BY_ID, TRAIT_IDS, FOODS, FOOD_BY_ID, PERSONALITY_IDS, FORM_BY_ID, PURE_LINE, BREEDS } from '../data/content.js';
import { rng } from './random.js';
import { rollBredEgg, cleanBody } from './recipe.js';
import { inheritPotential, rollPotential, validPotential } from './talents.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round1 = v => Math.round(v * 10) / 10;

// The record every slime and resident keeps about where it came from.
// line: place in its family line (1 = hatched from a plain egg), parents: [{ id, name, form, line }],
// spark: the spark form id its egg carried, pure: the form both parents shared, bias: the head start it inherited.
export function emptyLineage() {
  return { line: 1, parents: [], spark: null, pure: null, egg: null, bias: null };
}

const formIdOf = x => (x && x.form && x.form.id) || null;

// The spark form a pair of parents shares (order does not matter), or null.
export function sparkFor(a, b) {
  const fa = formIdOf(a), fb = formIdOf(b);
  if (!fa || !fb) return null;
  return SPARK_FORMS.find(s => (s.parents[0] === fa && s.parents[1] === fb) || (s.parents[0] === fb && s.parents[1] === fa)) || null;
}
// Both parents had the same one of the 22 grown-up forms: the baby can grow into a Pure version of it.
export function pureFor(a, b) {
  const fa = formIdOf(a), fb = formIdOf(b);
  return fa && fa === fb && FORM_BY_ID[fa] ? fa : null;
}

// each parent's traits as shares of its own total (0..1 per channel)
function shares(x) {
  const t = (x && x.traits) || {};
  const total = TRAIT_IDS.reduce((s, k) => s + Math.max(0, t[k] || 0), 0);
  return Object.fromEntries(TRAIT_IDS.map(k => [k, total > 0 ? Math.max(0, t[k] || 0) / total : 0]));
}
// how much of a channel a parent itself inherited, as a share of the cap (0..1)
function lineShare(x, k) {
  const b = x && x.lineage && x.lineage.bias;
  if (!b) return 0;
  return clamp((b[k] || 0) / (BREEDING.cap * BREEDING.range), 0, 1);
}

// What a baby inherits from parents a and b. Same seed, same result.
// Returns { bias (trait points per channel, signed), personality (points to add), favorite (food id or null) }.
export function inherit(a, b, seed) {
  const B = BREEDING, w = B.weights, R = B.range;
  const rand = rng('inherit:' + seed);
  const sa = shares(a), sb = shares(b);
  const raw = {};
  for (const k of TRAIT_IDS) {
    const compat = Math.sqrt(sa[k] * sb[k]);
    const wobble = rand() - 0.5;
    const r = w.parent * sa[k] + w.parent * sb[k] + w.compat * compat + w.variation * wobble;
    // concentration: a line that keeps leaning this way gets a smaller cap (it drifts back toward normal)
    const limit = B.cap * (1 - B.regress * (lineShare(a, k) + lineShare(b, k)) / 2);
    const penalty = Math.max(0, r - limit);
    raw[k] = clamp(r - penalty, -B.cap, B.cap);
  }
  // all channels together stay under the total cap, so care always decides who the baby becomes
  const pos = TRAIT_IDS.reduce((s, k) => s + Math.max(0, raw[k]), 0);
  const scale = pos > B.totalCap ? B.totalCap / pos : 1;
  const bias = Object.fromEntries(TRAIT_IDS.map(k => [k, round1((raw[k] > 0 ? raw[k] * scale : raw[k]) * R)]));
  const personality = {};
  for (const id of PERSONALITY_IDS) {
    const avg = ((a?.personality?.[id] ?? 50) + (b?.personality?.[id] ?? 50)) / 2;
    personality[id] = round1(clamp((avg - 50) * B.personalityPull, -B.personalityCap, B.personalityCap));
  }
  let favorite = null;
  if (rand() < B.favoriteChance) {
    const favs = [a?.favorite, b?.favorite].filter(f => FOOD_BY_ID[f]);
    if (favs.length) favorite = favs[Math.floor(rand() * favs.length)];
  }
  return { bias, personality, favorite };
}

const parentRecord = p => ({
  id: p.id, name: p.name || 'Slime',
  form: { id: formIdOf(p), name: p.form?.name || 'Slime', pure: !!p.form?.pure, spark: p.form?.spark || null },
  line: p.lineage?.line || 1,
});

// A new egg from two residents. Parents are stored in a fixed order, so picking them the other way
// round makes the same egg.
export function makeEgg(a, b, { now, id, seed }) {
  const [p, q] = [a, b].sort((x, y) => (String(x.id) < String(y.id) ? -1 : 1));
  const s = seed ?? `${p.id}|${q.id}|${now}`;
  const spark = sparkFor(p, q);
  return {
    id, seed: s, laidAt: now, readyAt: now + BREEDING.readyHours * 3600 * 1000,
    parents: [parentRecord(p), parentRecord(q)],
    spark: spark ? spark.id : null,
    pure: pureFor(p, q),
    line: Math.max(p.lineage?.line || 1, q.lineage?.line || 1) + 1,
    ...inherit(p, q, s),
    // its hidden Potential (core/talents.js): partly from each parent; a Pure egg rerolls its fresh skills keeping the better
    potential: inheritPotential(p, q, s, { pure: !!pureFor(p, q) }),
    // the baby's body (core/recipe.js): two Curlys make a Curly, two Dollops a Dollop, a Curly x Dollop an in-between
    body: rollBredEgg(p, q, s),
  };
}

// The Nursery egg a cushion baby came from, rebuilt from its lineage (for eggs put on the cushion before the cushion
// remembered its egg). Its small temperament nudge and favorite-snack pick were not recorded, so they are not kept.
export function eggFromLineage(L) {
  return { id: L.egg || 'e-cushion', seed: null, laidAt: 0, readyAt: 0,
    parents: L.parents.map(p => ({ ...p, form: { ...p.form } })), spark: L.spark || null, pure: L.pure || null,
    line: L.line || 2, bias: { ...(L.bias || {}) }, personality: {}, favorite: null, rebuilt: true };
}

// An egg's Potential: its own, or (an egg from before talents) inherited from its parents when they still live on the
// ranch (residents), else a fresh roll from the egg's seed.
export function eggPotential(egg, residents = []) {
  if (validPotential(egg?.potential)) return egg.potential;
  const [a, b] = (egg?.parents || []).map(p => residents.find(x => x && x.id === p?.id));
  const seed = egg?.seed ?? egg?.id ?? 'egg';
  return a && b ? inheritPotential(a, b, seed, { pure: !!egg.pure }) : rollPotential(seed);
}

// Give a freshly created baby (createState().slime) what it inherited from its egg.
export function applyEgg(slime, egg) {
  for (const k of TRAIT_IDS) slime.traits[k] = Math.max(0, egg.bias?.[k] || 0);
  for (const id of PERSONALITY_IDS) slime.personality[id] = clamp(Math.round((slime.personality[id] ?? 50) + (egg.personality?.[id] || 0)), 0, 100);
  if (egg.favorite && FOOD_BY_ID[egg.favorite]) {
    slime.favorite = egg.favorite;
    if (slime.dislike === slime.favorite) {
      const i = FOODS.findIndex(f => f.id === slime.favorite);
      slime.dislike = FOODS[(i + 1) % FOODS.length].id;
    }
  }
  slime.lineage = { line: egg.line, parents: egg.parents.map(p => ({ ...p, form: { ...p.form } })), spark: egg.spark, pure: egg.pure, egg: egg.id, bias: { ...egg.bias } };
  if (egg.special) slime.lineage.special = egg.special;   // hatched from a special egg bought with pearls
  slime.potential = { ...eggPotential(egg) };
  Object.assign(slime, cleanBody(egg.body));   // its body was fixed when the egg was made (an older egg: a Curly)
  return slime;
}

// The recipe as a form id: the two-trait form a normal slime raised that way would get.
export const recipeKey = spark => [...spark.recipe].sort().join('+');

// Decide a settling slime's form from its diet form (Sim.formCandidate) and its lineage.
// Returns { form, spark?, pure?, nearMiss?, pureMiss? }.
export function resolveForm(candidate, lineage) {
  const L = lineage || {};
  const sp = L.spark && SPARK_BY_ID[L.spark];
  if (sp) {
    if (candidate.id === recipeKey(sp)) return { form: { id: sp.look, name: sp.name, blurb: sp.blurb, spark: sp.id }, spark: sp.id };
    return { form: candidate, nearMiss: { spark: sp.id, clue: sp.clue, got: candidate.name } };
  }
  if (L.pure && FORM_BY_ID[L.pure]) {
    if (candidate.id === L.pure) return { form: { ...candidate, name: PURE_LINE.name(candidate.name), pure: true }, pure: candidate.id };
    return { form: candidate, pureMiss: L.pure };
  }
  return { form: candidate };
}

// What an egg is called in a sentence: "Ann and Bo's egg", or "the Cat-ear egg" for a special egg bought with pearls.
// (cap: starting a sentence.)
export function eggLabel(e, { cap = false } = {}) {
  if (e && e.special && BREEDS.specialEggs[e.special]) return `${cap ? 'The' : 'the'} ${BREEDS.specialEggs[e.special].name}`;
  const [p, q] = (e && e.parents) || [];
  return p && q ? `${p.name} and ${q.name}'s egg` : `${cap ? 'A' : 'a'} new egg`;
}
