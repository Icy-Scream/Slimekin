// Game rules. No three.js, no DOM: the Sim owns the save state and returns
// plain result objects that the presentation layer turns into reactions.
import {
  TUNING, STAGES, TRAIT_IDS, FOODS, FOOD_BY_ID, HELPERS, HELPER_BY_ID, HELPER_GROWTH,
  UPGRADES, UPGRADE_BY_ID, COMBOS, BOND, PERSONALITY_IDS, PURE_FORMS, PAIR_FORMS, GENERALIST_FORM,
  UPGRADE_RENAMES, JAR_LEVELS, OUTFITS, OUTFIT_BY_ID, TRICK_LEARNED, RANCH, BREEDING, BUYERS, BUYER_BY_ID,
  MEDALS, MEDAL_BY_ID, HEIRLOOM_BY_ID,
} from '../data/content.js';
import { createRanch, migrateRanch, Ranch, residentJpsFor, dayNumber } from './ranch.js';
import { emptySkills, RanchLife } from './ranch-life.js';
import { emptyLineage, applyEgg, resolveForm, eggFromLineage, eggLabel, eggPotential } from './breeding.js';
import { rollPotential, validPotential, migrateTalents } from './talents.js';
import { medalFor, medalRank } from './medals.js';
import { createHeirlooms, migrateHeirlooms, heirloomMult, heirloomFlag, startHelpers, forSale, ownsHeirloom } from './heirlooms.js';
import { rollPlainEgg, oldBody, cleanBody } from './recipe.js';
import { SAVE_VERSION, num, numOrNull, nums, count } from './save-check.js';
import { createResidentContests, cleanWorn } from './contests.js';

export { SAVE_VERSION };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
// A plain egg's seed: its body (breed, variant, genes) is rolled from it once, when the egg is made, and saved, so
// reopening the game never rerolls it. Made from the clock and a counter (no Math.random: the economy simulator
// replays the game's own random numbers and must see exactly the same ones as before).
let eggCount = 0;
export const newEggSeed = (now = Date.now()) => `p${now.toString(36)}-${(eggCount++).toString(36)}`;

export function createState() {
  const seed = newEggSeed();
  const foods = FOODS.map(f => f.id);
  const favorite = pick(foods);
  const dislike = pick(foods.filter(f => f !== favorite));
  const personality = {};
  for (const id of PERSONALITY_IDS) personality[id] = Math.round(42 + Math.random() * 16);
  return {
    v: SAVE_VERSION,
    createdAt: Date.now(),
    savedAt: Date.now(),
    phase: 'egg', // egg -> naming -> play
    // the egg on the cushion: warmth from taps; bred = the Nursery egg it is (null for a plain egg), so it can go
    // back to the Nursery; readyAt = when a bred egg is done warming (it can finish warming on the cushion);
    // seed = what a plain egg's body was rolled from (null for a Nursery egg and for eggs from before the recipe body)
    egg: { warmth: 0, bred: null, readyAt: null, seed },
    slime: {
      name: '',
      bornAt: null,
      growth: 0,
      tummy: 35,
      joy: 62,
      energy: 85,
      traits: Object.fromEntries(TRAIT_IDS.map(t => [t, 0])),
      personality,
      recent: Object.fromEntries(PERSONALITY_IDS.map(t => [t, 0])),
      bondXp: 0,
      favorite,
      dislike,
      knownFavorite: false,
      knownDislike: false,
      eaten: {},
      form: null,
      belly: [],
      tricks: {},
      lineage: emptyLineage(),   // where it came from (parents, family spark, Pure line); see core/breeding.js
      medalShown: null,          // the last medal this slime's ceremony played for (id in MEDALS; null = none yet)
      // its body (core/recipe.js, BREEDS in content.js), fixed when the egg is made: breed 'curly' | 'dollop' | 'mixed',
      // variant 'plain' | 'ears' | 'topknot', mix 0 (Curly) .. 1 (Dollop), genes (small quirks)
      ...rollPlainEgg(seed),
      // its hidden Potential (core/talents.js), fixed by the egg: a plain egg's seed, or its Nursery egg's (applyEgg)
      potential: rollPotential(seed),
    },
    jelly: 0,
    totalJelly: 0,
    jar: { level: 0, stored: 0, lastFill: 0 },
    outfits: { owned: [], worn: { head: null, face: null, neck: null }, favorite: pick(OUTFITS).id, knownFavorite: false },
    helpers: Object.fromEntries(HELPERS.map(h => [h.id, 0])),
    upgrades: [],
    combos: [],
    buffs: [],
    memories: [],
    memKeys: [],
    secrets: [],
    lastMorning: null,
    stats: { boops: 0, feeds: 0, petTime: 0, fevers: 0, dizzies: 0, naps: 0, glimmers: 0, requests: 0, playTime: 0, visits: 1 },
    tutorial: 0,
    // scene: home's background ('greenhouse' | 'meadow' | 'classic'); sceneMoved: this save has had the one-time move to
    // the Greenhouse (see migrate); camView: the Greenhouse camera's last set angle ('front' | 'wide' | 'left' | 'right')
    settings: { sound: true, music: true, purr: true, soundOnSilent: true, reducedMotion: false, quality: 'auto', showFps: false,
      scene: 'greenhouse', sceneMoved: true, camView: 'front' },
    ranch: createRanch(),
    heirlooms: createHeirlooms(),   // family treasures (core/heirlooms.js): they stay through every move-out
  };
}

// Fill in anything an older save is missing, so saves keep working as content grows.
export function migrate(save) {
  const fresh = createState();
  if (!save || typeof save !== 'object') return fresh;
  const out = { ...fresh, ...save };
  out.slime = { ...fresh.slime, ...(save.slime || {}) };
  out.slime.traits = { ...fresh.slime.traits, ...(save.slime?.traits || {}) };
  out.slime.personality = { ...fresh.slime.personality, ...(save.slime?.personality || {}) };
  out.slime.recent = { ...fresh.slime.recent, ...(save.slime?.recent || {}) };
  out.helpers = { ...fresh.helpers, ...(save.helpers || {}) };
  out.stats = { ...fresh.stats, ...(save.stats || {}) };
  out.settings = { ...fresh.settings, ...(save.settings || {}) };
  // The Greenhouse, once: the game used to write 'meadow' into every save (the old default), so a chosen Meadow can't be
  // told from it. A save from before the Greenhouse moves there one time; a Classic save stays Classic (a real choice).
  // After the move, a player who picks the Meadow again keeps it.
  if (!(save.settings && save.settings.sceneMoved)) {
    if (out.settings.scene !== 'classic') out.settings.scene = 'greenhouse';
    out.settings.sceneMoved = true;
  }
  out.egg = { ...fresh.egg, ...(save.egg || {}) };
  out.jar = { ...fresh.jar, ...(save.jar || {}) };
  out.outfits = { ...fresh.outfits, ...(save.outfits || {}) };
  // what it wears: one outfit of the right kind per slot (an unknown one or one in another slot's place comes off)
  out.outfits.worn = cleanWorn({ ...fresh.outfits.worn, ...(save.outfits?.worn || {}) });
  if (!Array.isArray(out.outfits.owned)) out.outfits.owned = [];
  if (Array.isArray(save.upgrades)) out.upgrades = [...new Set(save.upgrades.map(id => UPGRADE_RENAMES[id] || id))];
  for (const k of ['upgrades', 'combos', 'buffs', 'memories', 'memKeys', 'secrets']) if (!Array.isArray(out[k])) out[k] = [];
  if (!Array.isArray(out.slime.belly)) out.slime.belly = [];
  out.slime.tricks = { ...(save.slime?.tricks || {}) };
  out.slime.lineage = { ...emptyLineage(), ...(save.slime?.lineage || {}) };
  if (!Array.isArray(out.slime.lineage.parents)) out.slime.lineage.parents = [];
  // the recipe body: a slime (or egg) from before it is a Curly (plain, mix 0, neutral genes); the egg had no seed
  Object.assign(out.slime, save.slime && 'breed' in save.slime ? cleanBody(out.slime) : oldBody());
  if (!(save.egg && 'seed' in save.egg)) out.egg.seed = null;
  if (out.egg.bred && typeof out.egg.bred === 'object' && !out.egg.bred.body) out.egg.bred.body = cleanBody(out.slime);
  // a bred egg put on the cushion before the cushion remembered its egg: rebuild that egg from the baby's lineage
  if (out.phase === 'egg' && !out.egg.bred && out.slime.lineage.parents.length === 2) out.egg.bred = { ...eggFromLineage(out.slime.lineage), body: cleanBody(out.slime) };
  // numbers (save safety): a string or NaN in a number field becomes the fresh value, so it never turns into NaN in the
  // game (core/save-check.js). A finite number is kept exactly as it is.
  for (const k of ['jelly', 'totalJelly', 'createdAt', 'savedAt']) out[k] = num(out[k], fresh[k]);
  out.tutorial = count(out.tutorial, 0);
  const sl = out.slime, fs = fresh.slime;
  if (typeof sl.name !== 'string') sl.name = '';
  for (const k of ['growth', 'tummy', 'joy', 'energy', 'bondXp']) sl[k] = num(sl[k], fs[k]);
  sl.bornAt = numOrNull(sl.bornAt);
  sl.traits = nums(sl.traits, fs.traits);
  sl.personality = nums(sl.personality, fs.personality);
  sl.recent = nums(sl.recent, fs.recent);
  sl.eaten = nums(sl.eaten);
  out.helpers = nums(out.helpers, fresh.helpers);
  out.stats = nums(out.stats, fresh.stats);
  out.jar.level = count(out.jar.level, 0);
  for (const k of ['stored', 'lastFill']) out.jar[k] = num(out.jar[k], fresh.jar[k]);
  out.egg.warmth = num(out.egg.warmth, 0);
  out.egg.readyAt = numOrNull(out.egg.readyAt);
  // medals: a save from before medals starts with the medal its slime already has, so no old ceremony replays
  if (!('medalShown' in (save.slime || {}))) {
    const grown = (out.slime.growth || 0) >= STAGES[STAGES.length - 1].minGrowth;
    out.slime.medalShown = medalFor(out.totalJelly, out.phase === 'play' && grown)?.id || null;
  }
  if (out.slime.medalShown && !MEDAL_BY_ID[out.slime.medalShown]) out.slime.medalShown = null;
  out.ranch = migrateRanch(save.ranch);
  // talents (core/talents.js): a save from before them gets the Potential its egg would have given: a Nursery egg's
  // (inherited from its parents when they still live on the ranch), else a roll from the plain egg's seed, else from
  // when the slime was born
  if (out.egg.bred && typeof out.egg.bred === 'object') out.egg.bred.potential = { ...eggPotential(out.egg.bred, out.ranch.residents) };
  if (!validPotential(save.slime?.potential)) {
    out.slime.potential = out.egg.bred && typeof out.egg.bred === 'object' ? { ...out.egg.bred.potential }
      : rollPotential(out.egg.seed ?? `slime:${out.createdAt}:${out.slime.bornAt}`);
  }
  out.heirlooms = migrateHeirlooms(save.heirlooms);
  out.v = SAVE_VERSION;
  return out;
}

export class Sim {
  constructor(state) {
    this.s = state;
    this.time = 0;          // runtime seconds (not saved)
    this.giggle = 0;
    this.dizzy = 0;
    this.fever = false;
    this.asleep = false;
    this.sinceBoop = 99;
    this.lastFed = null;
    this.recentFoods = [];
    this.ranch = new Ranch(state);
    this.life = new RanchLife(state, this.ranch, this);   // ranch life: lessons and trips (core/ranch-life.js)
    this.recompute();
  }

  get slime() { return this.s.slime; }

  // ---------- derived values ----------
  stageIndex() {
    const g = this.slime.growth;
    let i = 0;
    for (let k = 0; k < STAGES.length; k++) if (g >= STAGES[k].minGrowth) i = k;
    return i;
  }
  stage() { return STAGES[this.stageIndex()]; }
  stageProgress() {
    const i = this.stageIndex();
    const cur = STAGES[i], next = STAGES[i + 1];
    if (!next) return 1;
    return clamp((this.slime.growth - cur.minGrowth) / (next.minGrowth - cur.minGrowth), 0, 1);
  }
  size() {
    const i = this.stageIndex();
    const cur = STAGES[i], next = STAGES[i + 1];
    if (!next) return cur.size + Math.min(0.12, (this.slime.growth - cur.minGrowth) / 20000);
    return cur.size + (next.size - cur.size) * this.stageProgress() * 0.85;
  }
  bondLevel() {
    let lvl = 0;
    for (let i = 0; i < BOND.length; i++) if (this.slime.bondXp >= BOND[i].xp) lvl = i;
    return lvl;
  }
  bondProgress() {
    const l = this.bondLevel();
    const next = BOND[l + 1];
    if (!next) return 1;
    return clamp((this.slime.bondXp - BOND[l].xp) / (next.xp - BOND[l].xp), 0, 1);
  }

  recompute() {
    const fx = { boopMult: 1, boopJps: 0, helper: {}, feverMult: 2, feverWindow: 0, autoFeed: false, digestMult: 1,
      napMult: 1, glimmerRate: 1, bondBonus: 0, petMult: 1, comboDur: 1, trickBonus: 0, secretBonus: 0, globalMult: 1, glimmerMult: 1 };
    const MULT = ['boopMult', 'digestMult', 'napMult', 'glimmerRate', 'petMult', 'comboDur', 'globalMult', 'glimmerMult'];
    for (const id of this.s.upgrades) {
      const u = UPGRADE_BY_ID[id];
      if (!u) continue;
      for (const [k, v] of Object.entries(u.fx)) {
        if (k === 'helper') for (const [h, m] of Object.entries(v)) fx.helper[h] = (fx.helper[h] || 1) * m;
        else if (MULT.includes(k)) fx[k] *= v;
        else if (k === 'feverMult') fx.feverMult = Math.max(fx.feverMult, v);
        else if (typeof v === 'boolean') fx[k] = v;
        else fx[k] += v;
      }
    }
    fx.glimmerMult *= heirloomMult(this.s, 'glimmerMult');   // Pressed Clover
    this.fx = fx;
  }

  buff(key) {
    let m = 1;
    for (const b of this.s.buffs) if (typeof b[key] === 'number') m *= b[key];
    return m;
  }
  hasBuffFlag(key) { return this.s.buffs.some(b => b[key]); }

  moodMult() { return 0.6 + 0.8 * this.slime.joy / 100; }
  bondMult() { const l = this.bondLevel(); return 1 + 0.03 * l + this.fx.bondBonus * l; }
  helperJps(id) { return HELPER_BY_ID[id].jps * (this.fx.helper[id] || 1); }
  baseJps() {
    let t = 0;
    for (const h of HELPERS) t += this.helperJps(h.id) * this.s.helpers[h.id];
    return t;
  }
  dreamMult() { return this.asleep ? 1 + 0.25 * this.fx.napMult : 1; }
  tricksLearned() { return Object.values(this.slime.tricks || {}).filter(n => n >= TRICK_LEARNED).length; }
  // Permanent multiplier from upgrades, learned tricks and found secrets.
  // Includes the Family Bonus earned by every generation that moved to the ranch.
  globalMult() {
    return this.fx.globalMult * (1 + this.fx.trickBonus * this.tricksLearned() + this.fx.secretBonus * this.s.secrets.length) * this.ranch.familyMult();
  }
  // Steady jelly from the slimes living on the ranch.
  ranchJps() { return this.ranch.jps() * this.ranch.familyMult(); }
  jps() { return this.baseJps() * this.moodMult() * this.bondMult() * this.globalMult() * this.buff('jpsMult') * this.dreamMult() + this.ranchJps(); }
  // Helper output used while you're away: no mood, buffs or naps, just the steady part.
  awayJps() { return this.baseJps() * this.bondMult() * this.globalMult() + this.ranchJps(); }
  boopValue() {
    const fever = this.fever ? this.fx.feverMult : 1;
    return this.stage().boop * this.fx.boopMult * this.moodMult() * fever * this.buff('boopMult') + this.jps() * this.fx.boopJps;
  }
  dizzyThreshold() {
    return TUNING.dizzyAt + this.fx.feverWindow + (this.slime.personality.patient - 50) * 0.3;
  }
  feverThreshold() { return TUNING.feverAt - this.fx.feverWindow * 0.5; }
  noDizzy() { return this.hasBuffFlag('noDizzy'); }

  helperCost(id, owned = this.s.helpers[id]) { return Math.ceil(HELPER_BY_ID[id].cost * Math.pow(HELPER_GROWTH, owned)); }
  foodPrice(id) { return Math.ceil(FOOD_BY_ID[id].price * this.stage().foodCost * heirloomMult(this.s, 'foodPrice')); }
  foodUnlocked(id) {
    const need = STAGES.findIndex(st => st.id === FOOD_BY_ID[id].unlock);
    return this.stageIndex() >= need;
  }
  canAfford(c) { return this.s.jelly + 1e-9 >= c; }

  // A snapshot used by upgrade unlock rules.
  view() {
    return { stats: this.s.stats, helpers: this.s.helpers, stageIndex: this.stageIndex(), bondLevel: this.bondLevel(), jps: this.jps(),
      combos: this.s.combos.length, tricks: this.tricksLearned(), secrets: this.s.secrets.length };
  }
  availableUpgrades() {
    const v = this.view();
    return UPGRADES.filter(u => !this.s.upgrades.includes(u.id) && u.req(v));
  }

  formCandidate() {
    const t = this.slime.traits;
    const entries = TRAIT_IDS.map(k => [k, t[k]]).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, e) => s + e[1], 0);
    if (total < 18) return { ...GENERALIST_FORM, id: 'mochi' };
    const [top, second] = entries;
    const share = top[1] / total;
    if (share >= 0.66) return { ...PURE_FORMS[top[0]], id: top[0] };
    if (share < 0.3) return { ...GENERALIST_FORM, id: 'mochi' };
    const key = [top[0], second[0]].sort().join('+');
    return { ...(PAIR_FORMS[key] || GENERALIST_FORM), id: key };
  }
  // The form it settles into: the diet form, unless its egg carried a family spark (and it was raised on
  // the recipe) or both parents had this same form (a Pure line). Records what the family learned.
  settleForm() {
    const res = resolveForm(this.formCandidate(), this.slime.lineage);
    const R = this.s.ranch;
    if (res.spark) this.ranch.learnSpark(res.spark, 'understood');
    if (res.nearMiss) { this.ranch.learnSpark(res.nearMiss.spark, 'observed'); R.nearMiss[res.nearMiss.spark] = (R.nearMiss[res.nearMiss.spark] || 0) + 1; }
    if (res.pure && !R.pures.includes(res.pure)) R.pures.push(res.pure);
    return res;
  }

  // ---------- medals (core/medals.js) ----------
  // The medal this slime has earned from its own jelly (null until it is grown up).
  medal() { return medalFor(this.s.totalJelly, this.s.phase === 'play' && this.stageIndex() === STAGES.length - 1); }
  // The medal its ceremony last played for (what the badges show).
  medalShown() { return MEDAL_BY_ID[this.slime.medalShown] || null; }
  // Medals reached since the last ceremony, oldest first; marks them as shown (once per medal per slime).
  takeNewMedals() {
    const cur = this.medal(), from = medalRank(this.slime.medalShown), to = medalRank(cur);
    if (to <= from) return [];
    this.slime.medalShown = cur.id;
    return MEDALS.slice(from + 1, to + 1);
  }

  // ---------- memories ----------
  remember(icon, text, key) {
    if (key) {
      if (this.s.memKeys.includes(key)) return false;
      this.s.memKeys.push(key);
    }
    this.s.memories.push({ t: Date.now(), icon, text });
    if (this.s.memories.length > 300) this.s.memories.splice(20, this.s.memories.length - 300);
    return true;
  }

  nudge(axis, amount) {
    const p = this.slime.personality;
    const before = p[axis];
    p[axis] = clamp(p[axis] + amount, 0, 100);
    this.slime.recent[axis] += p[axis] - before;
  }

  addJelly(n) {
    this.s.jelly += n;
    this.s.totalJelly += n;
  }
  addBond(n) {
    const before = this.bondLevel();
    this.slime.bondXp += n * TUNING.bondGain * (TUNING.bondCurve[before] ?? 0.1);
    const after = this.bondLevel();
    return after > before ? after : 0;
  }
  addBuff(def) {
    const existing = this.s.buffs.find(b => b.id === def.id);
    if (existing) { existing.t = Math.max(existing.t, def.dur); return; }
    this.s.buffs.push({ ...def, t: def.dur });
  }

  // ---------- per-frame ----------
  tick(dt) {
    const s = this.slime;
    this.time += dt;
    this.sinceBoop += dt;
    this.s.stats.playTime += dt;

    const digest = TUNING.tummyDecayPerSec * this.fx.digestMult * (this.asleep ? 0.5 : 1);
    s.tummy = clamp(s.tummy - digest * dt, 0, 100);
    if (this.asleep) s.energy = clamp(s.energy + TUNING.sleepRegenPerSec * this.fx.napMult * dt, 0, 100);
    else s.energy = clamp(s.energy + TUNING.energyRegenPerSec * dt * (this.sinceBoop > 2 ? 1 : 0.15), 0, 100);

    // Joy drifts toward a mood set by needs and bond.
    let target = 62 + this.bondLevel() * 1.6;
    if (s.tummy > 60) target += 10;
    else if (s.tummy < 25) target -= 22;
    if (s.energy < 20) target -= 10;
    if (this.wearingFavorite()) target += 8;
    s.joy += (clamp(target, 0, 100) - s.joy) * (1 - Math.exp(-dt / 28));

    // Giggle meter.
    this.giggle -= this.giggle * TUNING.giggleDecay * dt;
    if (this.dizzy > 0) this.dizzy = Math.max(0, this.dizzy - dt);
    const wasFever = this.fever;
    this.fever = this.dizzy <= 0 && this.giggle >= this.feverThreshold();
    let feverStarted = false;
    if (this.fever && !wasFever) {
      this.s.stats.fevers++; feverStarted = true;
      if (this.time - (this.feverBondAt ?? -1e9) >= TUNING.feverBondEvery) { this.feverBondAt = this.time; this.addBond(1.5); }
    }

    for (const b of this.s.buffs) b.t -= dt;
    this.s.buffs = this.s.buffs.filter(b => b.t > 0);

    for (const k of PERSONALITY_IDS) s.recent[k] *= Math.exp(-dt / 300);

    this.addBond(dt * 0.01);
    this.addJelly(this.jps() * dt);
    return { feverStarted };
  }

  // ---------- player actions ----------
  boop() {
    const s = this.slime;
    this.sinceBoop = 0;
    if (this.asleep) return { asleep: true, gain: 0 };
    if (this.dizzy > 0) return { gain: 0, dizzy: true };
    this.giggle += TUNING.giggleAdd;
    if (this.giggle >= this.dizzyThreshold()) {
      if (this.noDizzy()) {
        this.giggle = this.dizzyThreshold() - 1;
      } else {
        this.dizzy = TUNING.dizzySeconds * (this.bondLevel() >= 8 ? 0.5 : 1);
        this.giggle = 30;
        this.fever = false;
        this.s.stats.dizzies++;
        this.nudge('patient', -0.8);
        s.joy = clamp(s.joy - 3, 0, 100);
        return { gain: 0, becameDizzy: true, firstDizzy: this.s.stats.dizzies === 1 };
      }
    }
    const tired = s.energy < 8;
    const gain = this.boopValue() * (tired ? TUNING.tiredBoop : 1);
    this.addJelly(gain);
    if (!this.hasBuffFlag('noEnergyDrain')) s.energy = clamp(s.energy - TUNING.boopEnergyCost, 0, 100);
    s.joy = clamp(s.joy + 0.5, 0, 100);
    const bondUp = this.addBond(0.012);
    this.s.stats.boops++;
    const to = TUNING.boopPlayfulTo;
    this.nudge('playful', 0.03 * (to == null ? 1 : clamp((to - s.personality.playful) / (to - 50), 0, 1)));
    return { gain, fever: this.fever, exhausted: s.energy <= 0, bondUp, tired };
  }
  // A napping slime only lets itself be poked awake once it has rested a little.
  canWake() { return this.slime.energy >= TUNING.wakeEnergy; }

  pet(dt) {
    const s = this.slime;
    if (this.asleep) return { gain: 0, bondUp: 0 };
    const m = this.fx.petMult;
    const gain = this.stage().boop * this.fx.boopMult * this.moodMult() * 1.4 * m * dt;
    this.addJelly(gain);
    s.joy = clamp(s.joy + 6 * dt, 0, 100);
    s.energy = clamp(s.energy + 0.6 * dt, 0, 100);
    this.s.stats.petTime += dt;
    this.nudge('cuddly', 0.12 * dt);
    const bondUp = this.addBond(0.5 * m * dt);
    return { gain, bondUp };
  }

  canFeed(id) {
    const def = FOOD_BY_ID[id];
    if (!def) return { ok: false, reason: 'unknown' };
    if (!this.foodUnlocked(id)) return { ok: false, reason: 'locked' };
    if (this.asleep) return { ok: false, reason: 'asleep' };
    if (this.slime.tummy >= 97) return { ok: false, reason: 'full' };
    if (!this.canAfford(this.foodPrice(id))) return { ok: false, reason: 'poor' };
    return { ok: true };
  }

  feed(id, { free = false } = {}) {
    const def = FOOD_BY_ID[id];
    const s = this.slime;
    const st = this.stage();
    const price = free ? 0 : this.foodPrice(id);
    this.s.jelly -= price;

    const liked = id === s.favorite ? 'favorite' : id === s.dislike ? 'dislike' : 'normal';
    const overfed = s.tummy > 85;
    const assimilation = overfed ? 0.5 : 1;
    const firstTime = !s.eaten[id];
    s.eaten[id] = (s.eaten[id] || 0) + 1;

    // Repeating the same food shapes the body less each time (staple value stays).
    this.recentFoods.push(id);
    if (this.recentFoods.length > 6) this.recentFoods.shift();
    const same = this.recentFoods.filter(f => f === id).length;
    const adapt = Math.max(0.55, 1 - 0.09 * (same - 1));

    const traitDeltas = {};
    for (const [k, v] of Object.entries(def.traits)) {
      const d = v * assimilation * adapt * st.traitSens;
      s.traits[k] += d;
      traitDeltas[k] = d;
    }

    const stageBefore = this.stageIndex();
    const hungryBefore = s.tummy < 30;
    const growthGain = def.nutrition * st.nutrition * assimilation * (liked === 'favorite' ? 1.15 : 1);
    s.growth += growthGain;
    s.tummy = clamp(s.tummy + def.fullness, 0, 100);
    s.energy = clamp(s.energy + def.energy, 0, 100);
    let joyDelta = def.joy + (liked === 'favorite' ? 14 : liked === 'dislike' ? -8 : 0) + (hungryBefore ? 4 : 0) - (overfed ? 4 : 0);
    s.joy = clamp(s.joy + joyDelta, 0, 100);
    let bondUp = this.addBond(liked === 'favorite' ? 4 : liked === 'dislike' ? 0.5 : 1);

    const personalityNudge = { chili: ['bold', 0.6], moss: ['patient', 0.5], cookie: ['cuddly', 0.3], berry: ['playful', 0.5], iron: ['patient', 0.3], crystal: ['curious', 0.6] }[id];
    if (personalityNudge) this.nudge(personalityNudge[0], personalityNudge[1]);
    if (firstTime) this.nudge('curious', 2);
    else {
      const F = TUNING.familiar, down = F.repeat * (same - 1) + (liked === 'favorite' ? F.favorite : 0);
      if (down > 0) this.nudge('curious', -down);
    }

    let discovered = null;
    if (liked === 'favorite' && !s.knownFavorite) { s.knownFavorite = true; discovered = 'favorite'; }
    if (liked === 'dislike' && !s.knownDislike) { s.knownDislike = true; discovered = 'dislike'; }

    this.s.stats.feeds++;

    // Combos: two foods in order inside the window.
    let combo = null, comboNew = false;
    if (this.lastFed && this.time - this.lastFed.t <= TUNING.comboWindow) {
      combo = COMBOS.find(c => c.seq[0] === this.lastFed.id && c.seq[1] === id) || null;
    }
    if (combo) {
      comboNew = !this.s.combos.includes(combo.id);
      if (comboNew) this.s.combos.push(combo.id);
      if (combo.buff) this.addBuff({ ...combo.buff, dur: combo.buff.dur * this.fx.comboDur });
      if (combo.growth) s.growth += combo.growth * st.nutrition;
      const b2 = this.addBond(comboNew ? 5 : 1);
      bondUp = bondUp || b2;
      this.lastFed = null;
    } else {
      this.lastFed = { id, t: this.time };
    }

    const stageAfter = this.stageIndex();
    let form = null, settled = null;
    if (stageAfter > stageBefore && stageAfter === STAGES.length - 1) {
      settled = this.settleForm();
      form = settled.form;
      s.form = form;
    }
    return { def, price, liked, overfed, growthGain, traitDeltas, joyDelta, bondUp, combo, comboNew, stageBefore, stageAfter, firstTime, discovered, form,
      nearMiss: settled?.nearMiss || null, pureMiss: settled?.pureMiss || null };
  }

  buyHelper(id) {
    const cost = this.helperCost(id);
    if (!this.canAfford(cost)) return null;
    this.s.jelly -= cost;
    this.s.helpers[id]++;
    return { cost, count: this.s.helpers[id] };
  }

  buyUpgrade(id) {
    const u = UPGRADE_BY_ID[id];
    if (!u || this.s.upgrades.includes(id) || !this.canAfford(u.cost)) return null;
    this.s.jelly -= u.cost;
    this.s.upgrades.push(id);
    this.recompute();
    return u;
  }

  // ---------- Jelly Jar ----------
  jar() { return JAR_LEVELS[this.s.jar.level]; }
  jarCapacity() { const j = this.jar(); return this.awayJps() * j.rate * j.hours * 3600; }
  // Helpers keep working while you're away, into the jar. Needs freeze: nothing bad happens.
  fillJar(seconds) {
    const j = this.jar();
    const add = this.awayJps() * j.rate * Math.min(seconds, j.hours * 3600);
    const before = this.s.jar.stored;
    this.s.jar.stored = Math.min(this.jarCapacity(), before + add);
    const gained = this.s.jar.stored - before;
    return { gained, full: seconds > j.hours * 3600 || this.s.jar.stored >= this.jarCapacity() - 1e-6, seconds };
  }
  collectJar() {
    const amt = this.s.jar.stored;
    if (amt <= 0) return 0;
    this.addJelly(amt);
    this.s.jar.stored = 0;
    return amt;
  }
  jarUpgradeCost() {
    const next = JAR_LEVELS[this.s.jar.level + 1];
    if (!next) return null;
    return Math.ceil(Math.max(next.floor, this.awayJps() * 60 * next.minutes));
  }
  buyJarUpgrade() {
    const cost = this.jarUpgradeCost();
    if (cost === null || !this.canAfford(cost)) return null;
    this.s.jelly -= cost;
    this.s.jar.level++;
    return { cost, level: this.s.jar.level };
  }

  // ---------- The egg on the cushion ----------
  // A bred egg can still be warming (readyAt); a plain egg is ready at once. Wall clock, like the Nursery.
  eggReady(now = Date.now()) { return !this.s.egg.readyAt || now >= this.s.egg.readyAt; }
  eggSecondsLeft(now = Date.now()) { return this.s.egg.readyAt ? Math.max(0, (this.s.egg.readyAt - now) / 1000) : 0; }
  // A tap on the egg: warms it once it is ready (5 taps hatch it); before that, nothing changes.
  warmEgg(now = Date.now()) {
    if (this.s.phase !== 'egg') return null;
    if (!this.eggReady(now)) return { ok: false, left: this.eggSecondsLeft(now) };
    const e = this.s.egg;
    e.warmth = Math.min(1, e.warmth + 0.2);
    return { ok: true, warmth: e.warmth, hatch: e.warmth >= 1 };
  }
  // A Nursery egg goes on the cushion: the baby takes after its parents a little (see core/breeding.js).
  placeEgg(egg) {
    this.s.egg = { warmth: 0, bred: egg, readyAt: egg.readyAt ?? null, seed: null };
    applyEgg(this.s.slime, egg);
  }
  // A plain egg's body: a pure Curly or Dollop from its seed (the Wishing Star makes a surprise special Dollop likelier).
  rollPlainBody() {
    const e = this.s.egg;
    if (!e.seed) return;
    Object.assign(this.s.slime, rollPlainEgg(e.seed, { surpriseMult: heirloomMult(this.s, 'rareEggs') }));
  }
  // Everything bought with jelly starts over and an egg goes on the cushion: a plain egg, or (eggId) one from the
  // Nursery, ready or still warming (it finishes warming on the cushion). Outfits, combos, secrets, pearls and the
  // ranch stay. Used by moving to the ranch and by finding a baby a new home.
  startNextEgg(now, eggId = null) {
    const s = this.s;
    const fresh = createState();
    s.phase = 'egg';
    s.egg = fresh.egg;
    s.slime = fresh.slime;
    const egg = eggId ? this.ranch.takeEgg(eggId, now, { early: true }) : null;
    if (egg) this.placeEgg(egg);
    else this.rollPlainBody();
    s.jelly = 0;
    s.totalJelly = 0;
    // heirlooms: the Golden Jar Lid keeps the jar's size (not what is in it); the Toy Box gives the new slime helpers
    s.jar = heirloomFlag(s, 'keepJar') ? { ...fresh.jar, level: s.jar.level } : fresh.jar;
    s.helpers = fresh.helpers;
    for (const [id, n] of Object.entries(startHelpers(s))) if (id in s.helpers) s.helpers[id] = Math.max(s.helpers[id], n);
    s.upgrades = [];
    s.buffs = [];
    s.outfits.worn = { ...fresh.outfits.worn };
    s.outfits.favorite = fresh.outfits.favorite;
    s.outfits.knownFavorite = false;
    s.memKeys = s.memKeys.filter(k => k.startsWith('combo-') || k.startsWith('secret'));
    this.giggle = 0; this.dizzy = 0; this.fever = false; this.asleep = false; this.recentFoods = []; this.lastFed = null;
    this.recompute();
    return egg;
  }
  // Before the egg on the cushion hatches, a Nursery egg (ready or still warming) can take its place. It is an
  // exchange: the chosen egg leaves the Nursery first, then the egg it replaces goes back there if it came from
  // there and there is room, otherwise a neighbor family raises it (counted like a given Nursery egg).
  cushionSwap(eggId) {
    const n = this.s.ranch.nursery, old = this.s.egg.bred || null;
    const left = n.eggs.length - (this.ranch.egg(eggId) ? 1 : 0);
    return { old, oldTo: old && left < BREEDING.maxEggs ? 'nursery' : 'neighbor' };
  }
  swapCushionEgg(eggId, now = Date.now()) {
    const s = this.s, n = s.ranch.nursery;
    if (s.phase !== 'egg' || !this.ranch.egg(eggId)) return null;
    const { old, oldTo } = this.cushionSwap(eggId);
    const egg = this.ranch.takeEgg(eggId, now, { early: true });
    if (oldTo === 'nursery') n.eggs.push(old);
    else n.given++;
    s.slime = createState().slime;
    this.placeEgg(egg);
    return { egg, old, oldTo };
  }

  // ---------- Moving to the ranch (a new generation) ----------
  canMoveOut() { return this.s.phase === 'play' && this.stageIndex() === STAGES.length - 1; }
  // Family Legacy: moving out recomputes the Family Bonus from all the jelly the family ever made (this slime's
  // included). bonusNow -> bonusAfter; bonus = how much it goes up (never below 0).
  moveOutPreview() {
    const total = this.s.totalJelly;
    const bonusNow = this.s.ranch.family.bonus;
    const bonusAfter = Math.max(bonusNow, this.ranch.familyBonusWith(total));
    return { bonus: bonusAfter - bonusNow, bonusNow, bonusAfter, jps: residentJpsFor(total), room: this.ranch.free() > 0, generation: this.s.ranch.family.generation };
  }
  // The grown slime moves to the ranch and a new egg arrives: a plain egg, or (eggId) an egg from the Nursery
  // (ready or still warming). See startNextEgg for what starts over.
  moveToRanch(now = Date.now(), { eggId = null } = {}) {
    const s = this.s, sl = s.slime, ranch = s.ranch;
    if (!this.canMoveOut() || this.ranch.free() <= 0) return null;
    if (eggId && !this.ranch.egg(eggId)) return null;
    const total = s.totalJelly;
    const resident = {
      id: 'r' + now.toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: sl.name, form: sl.form || this.formCandidate(), traits: { ...sl.traits }, personality: { ...sl.personality },
      bondXp: sl.bondXp, bondLevel: this.bondLevel(), favorite: sl.favorite, dislike: sl.dislike, tricks: { ...sl.tricks },
      worn: { ...s.outfits.worn }, bornAt: sl.bornAt, movedAt: now, generation: ranch.family.generation,
      runTotal: total, jps: residentJpsFor(total), happiness: 90, pearlT: 0.6, petAt: 0,
      memories: s.memories.slice(-40),
      lineage: { ...emptyLineage(), ...(sl.lineage || {}) },
      ...cleanBody(sl),   // its body (breed, variant, mix, genes) moves with it
      skills: emptySkills(), lesson: null, trip: null,   // ranch life (core/ranch-life.js)
      potential: { ...(sl.potential || {}) }, talentsSeen: [],   // talents (core/talents.js): its Potential moves with it
      contests: createResidentContests(),   // contests (core/contests.js): no trophies yet
    };
    migrateTalents(resident);   // (a Potential that is not valid: seeded from its new id)
    ranch.residents.push(resident);
    // Family Legacy: the bonus comes from all the jelly the family ever made, so it is recomputed (never lowered)
    const bonusBefore = ranch.family.bonus;
    ranch.family.lifetime += total;
    ranch.family.bonus = Math.max(bonusBefore, this.ranch.familyBonusWith(0));
    const bonus = ranch.family.bonus - bonusBefore;
    ranch.family.generation++;
    let gift = 0;
    if (!ranch.gift) { ranch.gift = true; gift = RANCH.welcomeGift; this.ranch.addPearls(gift); }

    const egg = this.startNextEgg(now, eggId);
    const arrived = egg ? `${eggLabel(egg, { cap: true })} is waiting on the cushion.` : 'A new egg arrived on the cushion.';
    s.memories = [{ t: now, icon: '🏡', text: `${resident.name} moved to the ranch. ${arrived}` }];
    return { resident, bonus, bonusBefore, bonusAfter: ranch.family.bonus, gift, egg };
  }

  // ---------- Finding a baby a new home ----------
  // A slime that is not grown yet (Hatchling, Sprout, Rascal) can go to a family that will raise it. No pearls
  // (so hatching and giving away can't be farmed), no Family Bonus and no ranch slot (it never lived on the ranch),
  // the generation stays. Its jelly still counts toward the family's lifetime total. It sends postcards.
  canRehome() { return this.s.phase === 'play' && this.stageIndex() < STAGES.length - 1; }
  // The family that suits this baby best; a balanced baby goes to one that wants nothing in particular.
  rehomeBuyer() {
    const x = { traits: this.slime.traits };
    let best = null, bestFit = -Infinity;
    for (const b of BUYERS) {
      const f = this.ranch.fit(x, b) + (b.want.length ? 0 : 1e-9);
      if (f > bestFit) { bestFit = f; best = b; }
    }
    return best;
  }
  rehomeBaby(now = Date.now(), { eggId = null, buyerId = null } = {}) {
    const s = this.s, sl = s.slime, R = s.ranch;
    if (!this.canRehome()) return null;
    if (eggId && !this.ranch.egg(eggId)) return null;
    const buyer = buyerId ? BUYER_BY_ID[buyerId] : this.rehomeBuyer();
    if (!buyer) return null;
    const name = sl.name || 'Your slime', stage = this.stage(), jelly = s.totalJelly;
    R.family.lifetime += jelly;   // all jelly ever made counts
    R.placed.push({ name, form: null, buyer: buyer.id, at: now, cards: 0, lastCard: dayNumber(now), baby: true, stage: stage.id });
    if (R.placed.length > 60) R.placed.shift();
    const egg = this.startNextEgg(now, eggId);
    const arrived = egg ? `${eggLabel(egg, { cap: true })} is waiting on the cushion.` : 'A new egg arrived on the cushion.';
    s.memories = [{ t: now, icon: '💌', text: `${name} went to live at ${buyer.name}, where they will be loved and looked after. ${arrived}` }];
    return { buyer, name, stage, egg, jelly };
  }

  // ---------- Heirlooms (core/heirlooms.js) ----------
  // Bought with jelly in hand: never changes the jelly this slime made (totalJelly), the family lifetime or the bonus.
  canBuyHeirloom(id) {
    const h = HEIRLOOM_BY_ID[id];
    if (!h) return { ok: false, reason: 'unknown' };
    if (h.buyable === false) return { ok: false, reason: 'soon' };
    if (ownsHeirloom(this.s, id)) return { ok: false, reason: 'owned' };
    if (!this.canAfford(h.price)) return { ok: false, reason: 'poor' };
    return { ok: true };
  }
  buyHeirloom(id) {
    if (!this.canBuyHeirloom(id).ok) return null;
    const h = HEIRLOOM_BY_ID[id];
    this.s.jelly -= h.price;
    this.s.heirlooms.owned.push(id);
    if (!this.s.heirlooms.seen.includes(id)) this.s.heirlooms.seen.push(id);
    this.recompute();
    return h;
  }
  // Heirlooms that just became affordable and were not announced yet (the tab glows for them).
  newlyAffordableHeirlooms() { return forSale(this.s).filter(h => this.canAfford(h.price) && !this.s.heirlooms.seen.includes(h.id)); }
  // Opening the Heirlooms page: everything affordable now has been seen (the glow stops).
  markHeirloomsSeen() {
    const seen = this.s.heirlooms.seen;
    let n = 0;
    for (const h of this.newlyAffordableHeirlooms()) { seen.push(h.id); n++; }
    return n;
  }

  // ---------- Outfits ----------
  wearingFavorite() {
    const o = this.s.outfits;
    return !!o && Object.values(o.worn).includes(o.favorite);
  }
  buyOutfit(id) {
    const def = OUTFIT_BY_ID[id];
    const o = this.s.outfits;
    if (!def || o.owned.includes(id) || !this.canAfford(def.cost)) return null;
    this.s.jelly -= def.cost;
    o.owned.push(id);
    return def;
  }
  // Put an outfit the family owns on (the one in its slot comes off), or take the one it wears off. Anything it wears
  // can come off, even one the family does not own (a hand-made save); only an owned one goes on.
  wear(id) {
    const def = OUTFIT_BY_ID[id];
    const o = this.s.outfits;
    if (!def) return null;
    const on = o.worn[def.slot] !== id;
    if (on && !o.owned.includes(id)) return null;
    o.worn[def.slot] = on ? id : null;
    let discovered = false;
    if (on && id === o.favorite && !o.knownFavorite) { o.knownFavorite = true; discovered = true; }
    return { def, on, favorite: on && id === o.favorite, discovered };
  }
}
