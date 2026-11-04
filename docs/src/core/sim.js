// Game rules. No three.js, no DOM: the Sim owns the save state and returns
// plain result objects that the presentation layer turns into reactions.
import {
  TUNING, STAGES, TRAIT_IDS, FOODS, FOOD_BY_ID, HELPERS, HELPER_BY_ID, HELPER_GROWTH,
  UPGRADES, UPGRADE_BY_ID, COMBOS, BOND, PERSONALITY_IDS, PURE_FORMS, PAIR_FORMS, GENERALIST_FORM,
  UPGRADE_RENAMES, JAR_LEVELS, OUTFITS, OUTFIT_BY_ID, TRICK_LEARNED, RANCH,
} from '../data/content.js';
import { createRanch, migrateRanch, Ranch, familyBonusFor, residentJpsFor } from './ranch.js';

export const SAVE_VERSION = 1;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function createState() {
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
    egg: { warmth: 0 },
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
    settings: { sound: true, music: true, soundOnSilent: true, reducedMotion: false, quality: 'auto', showFps: false },
    ranch: createRanch(),
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
  out.egg = { ...fresh.egg, ...(save.egg || {}) };
  out.jar = { ...fresh.jar, ...(save.jar || {}) };
  out.outfits = { ...fresh.outfits, ...(save.outfits || {}) };
  out.outfits.worn = { ...fresh.outfits.worn, ...(save.outfits?.worn || {}) };
  if (!Array.isArray(out.outfits.owned)) out.outfits.owned = [];
  if (Array.isArray(save.upgrades)) out.upgrades = [...new Set(save.upgrades.map(id => UPGRADE_RENAMES[id] || id))];
  for (const k of ['upgrades', 'combos', 'buffs', 'memories', 'memKeys', 'secrets']) if (!Array.isArray(out[k])) out[k] = [];
  if (!Array.isArray(out.slime.belly)) out.slime.belly = [];
  out.slime.tricks = { ...(save.slime?.tricks || {}) };
  out.ranch = migrateRanch(save.ranch);
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
  noDizzy() { return this.hasBuffFlag('noDizzy') || this.bondLevel() >= 8; }

  helperCost(id, owned = this.s.helpers[id]) { return Math.ceil(HELPER_BY_ID[id].cost * Math.pow(HELPER_GROWTH, owned)); }
  foodPrice(id) { return Math.ceil(FOOD_BY_ID[id].price * this.stage().foodCost); }
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
    this.slime.bondXp += n;
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
    if (this.fever && !wasFever) { this.s.stats.fevers++; feverStarted = true; this.addBond(1.5); }

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
        this.dizzy = TUNING.dizzySeconds;
        this.giggle = 30;
        this.fever = false;
        this.s.stats.dizzies++;
        this.nudge('patient', -0.8);
        s.joy = clamp(s.joy - 3, 0, 100);
        return { gain: 0, becameDizzy: true, firstDizzy: this.s.stats.dizzies === 1 };
      }
    }
    const gain = this.boopValue();
    this.addJelly(gain);
    if (!this.hasBuffFlag('noEnergyDrain')) s.energy = clamp(s.energy - TUNING.boopEnergyCost, 0, 100);
    s.joy = clamp(s.joy + 0.5, 0, 100);
    const bondUp = this.addBond(0.04);
    this.s.stats.boops++;
    this.nudge('playful', 0.03);
    return { gain, fever: this.fever, exhausted: s.energy <= 0, bondUp };
  }

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
    let form = null;
    if (stageAfter > stageBefore && stageAfter === STAGES.length - 1) {
      form = this.formCandidate();
      s.form = form;
    }
    return { def, price, liked, overfed, growthGain, traitDeltas, joyDelta, bondUp, combo, comboNew, stageBefore, stageAfter, firstTime, discovered, form };
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

  // ---------- Moving to the ranch (a new generation) ----------
  canMoveOut() { return this.s.phase === 'play' && this.stageIndex() === STAGES.length - 1; }
  moveOutPreview() {
    const total = this.s.totalJelly;
    return { bonus: familyBonusFor(total), jps: residentJpsFor(total), room: this.ranch.free() > 0, generation: this.s.ranch.family.generation };
  }
  // The grown slime moves to the ranch and a new egg arrives. Everything bought with jelly resets
  // (jelly, helpers, upgrades, the Jelly Jar); outfits, combos, secrets, pearls and the ranch stay.
  moveToRanch(now = Date.now()) {
    const s = this.s, sl = s.slime, ranch = s.ranch;
    if (!this.canMoveOut() || this.ranch.free() <= 0) return null;
    const total = s.totalJelly;
    const bonus = familyBonusFor(total);
    const resident = {
      id: 'r' + now.toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: sl.name, form: sl.form || this.formCandidate(), traits: { ...sl.traits }, personality: { ...sl.personality },
      bondXp: sl.bondXp, bondLevel: this.bondLevel(), favorite: sl.favorite, dislike: sl.dislike, tricks: { ...sl.tricks },
      worn: { ...s.outfits.worn }, bornAt: sl.bornAt, movedAt: now, generation: ranch.family.generation,
      runTotal: total, jps: residentJpsFor(total), happiness: 90, pearlT: 0.6, petAt: 0,
      memories: s.memories.slice(-40),
    };
    ranch.residents.push(resident);
    ranch.family.bonus += bonus;
    ranch.family.generation++;
    ranch.family.lifetime += total;
    let gift = 0;
    if (!ranch.gift) { ranch.gift = true; gift = RANCH.welcomeGift; this.ranch.addPearls(gift); }

    const fresh = createState();
    s.phase = 'egg';
    s.egg = fresh.egg;
    s.slime = fresh.slime;
    s.jelly = 0;
    s.totalJelly = 0;
    s.jar = fresh.jar;
    s.helpers = fresh.helpers;
    s.upgrades = [];
    s.buffs = [];
    s.outfits.worn = { ...fresh.outfits.worn };
    s.outfits.favorite = fresh.outfits.favorite;
    s.outfits.knownFavorite = false;
    s.memKeys = s.memKeys.filter(k => k.startsWith('combo-') || k.startsWith('secret'));
    s.memories = [{ t: now, icon: '🏡', text: `${resident.name} moved to the ranch. A new egg arrived on the cushion.` }];
    this.giggle = 0; this.dizzy = 0; this.fever = false; this.asleep = false; this.recentFoods = []; this.lastFed = null;
    this.recompute();
    return { resident, bonus, gift };
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
  wear(id) {
    const def = OUTFIT_BY_ID[id];
    const o = this.s.outfits;
    if (!def || !o.owned.includes(id)) return null;
    const on = o.worn[def.slot] !== id;
    o.worn[def.slot] = on ? id : null;
    let discovered = false;
    if (on && id === o.favorite && !o.knownFavorite) { o.knownFavorite = true; discovered = true; }
    return { def, on, favorite: on && id === o.favorite, discovered };
  }
}
