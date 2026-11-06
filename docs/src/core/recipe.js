// The recipe body: every slime is the same soft body plus a recipe, a short list of numbers (BREEDS in content.js).
// Growing up, and the in-betweens bred from a Curly and a Dollop, only blend numbers: bumps and knobs fade in and out
// by their size, so a feature grows or melts away and never pops. Also the body's dice: what a plain egg, a bred egg
// and a special egg hatch into (seeded, so reopening the game never rerolls an egg). Pure; no three.js, no DOM.
import { BREEDS } from '../data/content.js';
import { rng } from './random.js';

// The numbers every recipe has (bumps and knobs are lists on top).
export const KEYS = ['tall', 'wide', 'peak', 'side', 'flat', 'lip', 'crease', 'lump', 'skirtWave', 'lipc', 'lipw', 'sag', 'flowA', 'flow2',
  'baseFlow', 'theta', 'L', 'bend', 'ra', 'rt', 'armK', 'feet', 'faceEl'];
export const VARIANTS = ['plain', 'ears', 'topknot'];
export const GENE_KEYS = ['tall', 'wide', 'lump', 'side'];
export const neutralGenes = () => ({ tall: 1, wide: 1, lump: 1, side: 0 });
// What every slime from before the recipe body (and every old resident) is.
export const oldBody = () => ({ breed: 'curly', variant: 'plain', mix: 0, genes: neutralGenes() });

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const nrm = ([x, y, z]) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const bumpsOf = list => (list || []).map(([d, a, w]) => [nrm(d), a, w]);
const knobsOf = list => (list || []).map(([d, a, w, k = 0]) => [nrm(d), a, w, k]);

// The breed a mix shows: 0 = Curly, 1 = Dollop, anything between = an in-between (bred Curly × Dollop).
export const breedOf = mix => (mix <= 0 ? 'curly' : mix >= 1 ? 'dollop' : 'mixed');
export const isVariant = v => VARIANTS.includes(v);

// ---------- recipes ----------
// Curly at shape number m (0 = the baby drop with feet and a short curl .. 1 = the grown dome with its goo lip).
export function curlyRecipe(m) {
  const C = BREEDS.curly, S = { ...C.fixed, bumps: [], knobs: [] };
  for (const [k, [a, b, how]] of Object.entries(C.grow)) {
    const t = how && how.sm ? sm(how.sm[0], how.sm[1], m) : how && how.lin ? clamp((m - how.lin[0]) / (how.lin[1] - how.lin[0]), 0, 1) : m;
    S[k] = lerp(a, b, t);
  }
  return S;
}
function dollopPart(part, extra) {
  const D = BREEDS.dollop, S = { ...D.base, ...(part.body || {}), ...((extra && extra.body) || {}) };
  S.bumps = bumpsOf(part.bumps).concat(bumpsOf(extra && extra.bumps));
  S.knobs = knobsOf(part.knobs).concat(knobsOf(extra && extra.knobs));
  return S;
}
// Dollop at shape number m: its baby (m = 0), teen (m = teenAt), then the grown dome; a special one keeps a smaller
// ear or knob when grown.
export function dollopRecipe(m, variant = 'plain') {
  const D = BREEDS.dollop, V = D.variants[variant] || D.variants.plain;
  const baby = dollopPart(V.baby), teen = dollopPart(V.teen);
  if (m <= D.teenAt) return blend(baby, teen, clamp(m / D.teenAt, 0, 1));
  return blend(teen, dollopPart(D.grown, V.keep), clamp((m - D.teenAt) / (1 - D.teenAt), 0, 1));
}
// Blend two recipes: every number lerps; a's bumps and knobs shrink by (1 - t), b's grow by t.
export function blend(a, b, t) {
  const o = {};
  for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t;
  o.bumps = a.bumps.map(([d, x, w]) => [d, x * (1 - t), w]).concat(b.bumps.map(([d, x, w]) => [d, x * t, w]));
  o.knobs = a.knobs.map(([d, x, w, k]) => [d, x * (1 - t), w, k]).concat(b.knobs.map(([d, x, w, k]) => [d, x * t, w, k]));
  return o;
}
// A slime's recipe at shape number m: its mix of the two breeds, with its genes on top.
// body: { mix, variant, genes } (breed is only a label; mix decides the blend).
export function recipeFor(body, m) {
  const mix = clamp(Number.isFinite(body?.mix) ? body.mix : 0, 0, 1), variant = body?.variant || 'plain';
  const S = mix < 0.001 ? curlyRecipe(m) : mix > 0.999 ? dollopRecipe(m, variant) : blend(curlyRecipe(m), dollopRecipe(m, variant), mix);
  const G = { ...neutralGenes(), ...(body?.genes || {}) };
  S.tall *= G.tall; S.wide *= G.wide; S.lump *= G.lump; S.side += G.side;
  return S;
}
// The shape number m for a growth stage (index into STAGES) and how far along that stage it is (0..1).
export function stageM(stageIndex, progress = 0) {
  const M = BREEDS.stageM, i = clamp(stageIndex | 0, 0, M.length - 1);
  return i >= M.length - 1 ? 1 : lerp(M[i], M[i + 1], clamp(progress, 0, 1));
}

// ---------- the body's dice ----------
const pickWeighted = (weights, r) => {
  const e = Object.entries(weights).filter(([, w]) => w > 0), total = e.reduce((s, [, w]) => s + w, 0);
  let x = r * total;
  for (const [k, w] of e) { x -= w; if (x < 0) return k; }
  return e[e.length - 1][0];
};
const quirks = rand => {
  const R = BREEDS.geneRange, q = a => (rand() * 2 - 1) * a;
  return { tall: 1 + q(R.tall), wide: 1 + q(R.wide), lump: 1 + q(R.lump), side: q(R.side) };
};
// genes stay inside the hatch ranges (breeding can't push a quirk further than an egg could hatch it)
export function clampGenes(G) {
  const R = BREEDS.geneRange, g = { ...neutralGenes(), ...(G || {}) };
  return { tall: clamp(g.tall, 1 - R.tall, 1 + R.tall), wide: clamp(g.wide, 1 - R.wide, 1 + R.wide), lump: clamp(g.lump, 1 - R.lump, 1 + R.lump), side: clamp(g.side, -R.side, R.side) };
}
// A plain egg: a pure Curly or Dollop (weights), with its own quirks. A Dollop is plain, except for a small surprise
// chance of a special one (the Wishing Star multiplies it: surpriseMult).
export function rollPlainEgg(seed, { surpriseMult = 1 } = {}) {
  const rand = rng('body:' + seed);
  const breed = pickWeighted(BREEDS.hatch, rand());
  const genes = quirks(rand);
  const surprise = rand(), which = rand();
  const variant = breed === 'dollop' && surprise < BREEDS.surprise * surpriseMult ? pickWeighted(BREEDS.surpriseVariants, which) : 'plain';
  return { breed, variant, mix: breed === 'dollop' ? 1 : 0, genes };
}
// A special egg bought with pearls: a Dollop of that variant, with its own quirks.
export function rollSpecialEgg(variant, seed) {
  const rand = rng('special:' + seed);
  return { breed: 'dollop', variant: isVariant(variant) ? variant : 'plain', mix: 1, genes: quirks(rand) };
}
const bodyOf = x => {
  const mix = Number.isFinite(x?.mix) ? clamp(x.mix, 0, 1) : 0;
  return { mix, variant: isVariant(x?.variant) ? x.variant : 'plain', genes: clampGenes(x?.genes) };
};
// A Nursery egg from two parents (residents, or any { mix, variant, genes }). Two Curlys make a Curly, two Dollops a
// Dollop; a Curly × Dollop egg lands between them (mixBetween of the way). Ears or a topknot pass on by a fair seeded
// chance (passSpecial), only to a baby with some Dollop in it. Genes: the parents' average, plus a small wobble.
export function rollBredEgg(a, b, seed) {
  const rand = rng('body-bred:' + seed);
  const A = bodyOf(a), B = bodyOf(b);
  const lo = Math.min(A.mix, B.mix), hi = Math.max(A.mix, B.mix);
  const [m0, m1] = BREEDS.mixBetween;
  const t = rand();
  const mix = hi - lo < 1e-6 ? lo : lo + (hi - lo) * lerp(m0, m1, t);
  const specials = [A, B].filter(x => x.variant !== 'plain' && x.mix > 0).map(x => x.variant);
  const pass = rand(), which = rand();
  const variant = mix > 0 && specials.length && pass < BREEDS.passSpecial ? specials[Math.floor(which * specials.length) % specials.length] : 'plain';
  const W = BREEDS.geneWobble, genes = {};
  for (const k of GENE_KEYS) genes[k] = (A.genes[k] + B.genes[k]) / 2 + (rand() * 2 - 1) * W[k];
  return { breed: breedOf(mix), variant, mix, genes: clampGenes(genes) };
}
// The body fields of a save object (slime, resident or egg), cleaned up: anything missing or broken becomes the old
// body (Curly, plain, mix 0, neutral genes). Returns a new object.
export function cleanBody(x) {
  if (!x || typeof x !== 'object' || !('breed' in x)) return oldBody();
  const b = bodyOf(x);
  return { breed: breedOf(b.mix), variant: b.mix > 0 ? b.variant : 'plain', mix: b.mix, genes: b.genes };
}
// A short name for a body: Curly, Dollop, Cat-ear Dollop, Topknot Dollop, or Curly × Dollop.
export function bodyName(x) {
  const b = cleanBody(x);
  if (b.breed === 'curly') return BREEDS.names.curly;
  if (b.breed === 'dollop') return BREEDS.variantNames[b.variant] || BREEDS.names.dollop;
  return BREEDS.names.mixed;
}
