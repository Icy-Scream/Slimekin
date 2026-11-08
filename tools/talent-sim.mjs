// Talent simulator: measures every balance target of the Talents design (section 6) from real raising runs: slimes are
// raised with the real rules (core/sim.js: feeding, booping, petting, naps, the real Requests and their answers'
// personality nudges as game.js applies them), settle into their real form, and their talents are worked out by
// core/talents.js at move-out (day 6, the engaged pace of the jelly loop). Prints the table target vs measured.
// Usage: node tools/talent-sim.mjs [n=<slimes per group>] [days=6] [quiet] [tune [tag=<name>]] [raiseonly] [with=<json>]
//   default n: 400 random players, 100 per "on purpose" skill, 40 normal, spamming and only-booping players, 2000 Pure
//   lines (T1b: more slimes than T1's 200 / 40, so the measured rates sit within about 1 / 4 points of the exact ones)
//   tune: exact trade-off of cutoffs and Potential weights over the raised slimes (writes base-points[-<tag>].json)
//   raiseonly: only the raising rows (no ranch, Pure lines or identity checks); with=<json>: try other numbers, e.g.
//   with='{"TUNING":{"boopPlayfulTo":70}}' (the ranch rows run pearl-sim with content.js as it is)
// The random players are also raised with the nudges from before T1b (no familiar snacks, boops all the way up), slime
// by slime from the same dice, to show where a varied player's slime ends then and now.
// Writes tools/out/talent-sim/raised-random.json (the random players' slimes) for tools/pearl-sim.mjs residents=<file>.
//
// The players (one per slime; dice seeded, so every run prints the same):
//   random:  a player with its own habits: favorite snacks (random weights), how much it boops and pets, and how it
//            answers each kind of request (give, wait, play, later, ignore; tuck in; play or not; pet or not)
//   purpose: a player raising for one skill who knows the mappings: that skill's snacks (diet and form) and the
//            answers and taps that lean the personality toward that skill's two slider ends
//   normal:  the economy simulator's engaged player (best-growth snacks, boops in 20 s bursts at 4.5 a second), who
//            answers requests kindly (gives, plays, tucks in, pets); spam: the same, tapping 11 times a second all along
// Requests: the real core/requests.js decides when and what; the answers' effects are game.js's (answerRequest,
// fulfillPets, the craving given in feed: give = bold +1.5 (patient +2 after waiting) and cuddly +1, waited = patient +3,
// play = curious +2 and playful +2, later = patient +1, expired = bold -0.5, tuck = cuddly +1 and patient +1 then a nap,
// sleepy refused = bold +1, play = playful +3, play refused = patient +2 and playful -1, pets = cuddly +3, pets
// refused = cuddly -1 and bold +0.5).
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
let rnd = 20261108; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);

const { Sim, createState } = await import(SRC + '/core/sim.js');
const { Requests } = await import(SRC + '/core/requests.js');
const { rng } = await import(SRC + '/core/random.js');
const TL = await import(SRC + '/core/talents.js');
const { makeEgg } = await import(SRC + '/core/breeding.js');
const C = await import(SRC + '/data/content.js');
const { FOODS, FOOD_BY_ID, STAGES, SKILL_IDS, HELPERS, TALENTS } = C;

const args = process.argv.slice(2);
const arg = (k, d) => { const a = args.find(x => x.startsWith(k + '=')); return a ? +a.slice(k.length + 1) : d; };
// with=<json>: try other numbers without editing content.js, e.g. with='{"TUNING":{"boopPlayfulTo":70},"TALENTS":{"grades":...}}'
const merge = (dst, src) => { for (const [k, v] of Object.entries(src)) { if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object') merge(dst[k], v); else dst[k] = v; } };
const WITH = args.find(a => a.startsWith('with='));
if (WITH) { const o = JSON.parse(WITH.slice(5)); for (const [k, v] of Object.entries(o)) merge(C[k], v); console.log('with:', WITH.slice(5)); }
// raiseonly: only the raising targets (skips the ranch, the Pure lines and the identity checks; for trying numbers)
const RAISE_ONLY = args.includes('raiseonly');
// tag=<name>: tune writes tools/out/talent-sim/base-points-<name>.json (several runs side by side)
const TAG = args.find(a => a.startsWith('tag=')) ? '-' + args.find(a => a.startsWith('tag=')).slice(4) : '';
const N = arg('n', 0);
const N_RANDOM = N || 400, N_PURPOSE = N ? Math.max(10, Math.round(N / 4)) : 100, N_TAP = N ? Math.max(10, Math.round(N / 5)) : 40, N_LINES = N ? N * 10 : 2000;
const DAYS = arg('days', 6);
const QUIET = args.includes('quiet');
const OUT = path.resolve(HERE, 'out/talent-sim');
fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const log = (...a) => { if (!QUIET) console.log(...a); };

// ---------- the players ----------
const STAGE = id => STAGES.findIndex(s => s.id === id);
// the purpose players: their snacks (the last one unlocked of the list; a craving for another snack is answered
// `other`), taps (boops a second during the boop part of each 40 s, pet seconds) and answers
const PURPOSE = {
  // Blaze; Playful (boops, play), Bold (chili, giving at once, sleepy refused, pets refused)
  bounce: { foods: ['chili'], other: 'later', boop: [4.5, 22], pet: 4, answers: { craving: 'give', sleepy: 'no', play: 'play', pets: 'no' } },
  // Volt (iron, then berry: Volt, or Dynamo, both Speed forms; T1's chili first grew 1 in 5 into a Firework, a Bounce
  // form, which no one raising for Speed would aim for); Impulsive (dizzy from hard booping), Independent (no petting)
  speed: { foods: ['iron', 'berry'], other: 'play', boop: [9, 30], pet: 0, answers: { craving: 'play', sleepy: 'no', play: 'play', pets: 'no' } },
  // Iron; Mellow (no boops: it pets instead; play refused), Shy (cravings left to pass)
  sturdy: { foods: ['iron'], other: 'ignore', boop: [0, 0], pet: 24, answers: { craving: 'ignore', sleepy: 'tuck', play: 'no', pets: 'pet' } },
  // Geode (iron, then crystal); Patient (waiting for its snack, play refused, tucked in), Curious (crystal, new snacks)
  smarts: { foods: ['iron', 'crystal'], other: 'later', boop: [3, 16], pet: 6, answers: { craving: 'wait', sleepy: 'tuck', play: 'no', pets: 'pet' } },
  // Candy; Cuddly (petting, pets, tuck in)
  charm: { foods: ['cookie'], other: 'later', boop: [3.5, 16], pet: 14, answers: { craving: 'give', sleepy: 'tuck', play: 'play', pets: 'pet' } },
};
const KIND = { craving: ['give', 'wait', 'play', 'later', 'ignore'], sleepy: ['tuck', 'no', 'ignore'], play: ['play', 'no', 'ignore'], pets: ['pet', 'no', 'ignore'] };
function randomStyle(i) {
  const r = rng('talent-sim:style:' + i);
  const w = () => r() ** 2 + 0.02;
  const answers = Object.fromEntries(Object.entries(KIND).map(([k, opts]) => [k, Object.fromEntries(opts.map(o => [o, w()]))]));
  return { kind: 'random', food: Object.fromEntries(FOODS.map(f => [f.id, w()])), boop: [1.5 + 4.5 * r(), 6 + 22 * r()], pet: 2 + 12 * r(), answers, pick: r };
}
const normalStyle = spam => ({ kind: spam ? 'spam' : 'normal', bestFood: true, boop: spam ? [11, 40] : [4.5, 20], pet: spam ? 0 : 6, spamWake: spam,
  answers: { craving: 'give', sleepy: 'tuck', play: 'play', pets: 'pet' } });
const weighted = (r, w) => { const e = Object.entries(w); let x = r() * e.reduce((t, [, v]) => t + v, 0); for (const [k, v] of e) { x -= v; if (x <= 0) return k; } return e[e.length - 1][0]; };

// ---------- one slime, raised from its egg to move-out ----------
function raise(seed, style) {
  const st = createState();
  st.phase = 'play'; st.slime.name = 'Sim';
  st.egg.seed = seed; st.slime.potential = TL.rollPotential(seed);   // what a plain egg with this seed gets
  const sim = new Sim(st);
  const req = new Requests(sim);
  const S = st.slime, DT = 0.5, CYCLE = 40;
  const dice = style.pick || rng('talent-sim:dice:' + seed);
  let burst = 0;
  const answer = r => {
    const a = typeof style.answers[r.type] === 'string' ? style.answers[r.type] : weighted(dice, style.answers[r.type]);
    return r.type === 'craving' && style.foods && style.other && !style.foods.includes(r.food) ? style.other : a;
  };
  const giveCraving = (r, waited) => {
    if (!sim.canFeed(r.food).ok) return false;
    sim.feed(r.food);
    S.joy = Math.min(100, S.joy + (waited ? 14 : 8)); sim.addBond(waited ? 8 : 4);
    if (waited) sim.nudge('patient', 2); else sim.nudge('bold', 1.5);
    sim.nudge('cuddly', 1);
    return true;
  };
  const handle = ev => {
    const r = ev.req;
    if (ev.event === 'expired') { S.joy = Math.max(0, S.joy - 4); sim.nudge('bold', -0.5); return; }
    if (ev.event === 'waited') {
      sim.nudge('patient', 3); S.joy = Math.min(100, S.joy + 3); sim.addBond(6);
      if ((!style.foods || style.foods.includes(r.food)) && giveCraving(r, true)) req.clear();
      return;
    }
    const a = answer(r);
    if (a === 'ignore') return;
    const done = () => { req.clear(); st.stats.requests++; };
    if (r.type === 'craving') {
      if (a === 'give') { if (giveCraving(r, false)) done(); }
      else if (a === 'wait') { r.waiting = true; r.waitLeft = 10; }
      else if (a === 'play') { done(); sim.nudge('curious', 2); sim.nudge('playful', 2); }
      else if (a === 'later') { done(); sim.nudge('patient', 1); }
    } else if (r.type === 'sleepy') {
      done();
      if (a === 'tuck') { sim.nudge('cuddly', 1); sim.nudge('patient', 1); sim.addBond(3); sim.asleep = true; } else sim.nudge('bold', 1);
    } else if (r.type === 'play') {
      done();
      if (a === 'play') { sim.nudge('playful', 3); sim.addBond(2); } else { sim.nudge('patient', 2); sim.nudge('playful', -1); }
    } else if (r.type === 'pets') {
      if (a === 'pet') { sim.pet(3); done(); S.joy = Math.min(100, S.joy + 8); sim.nudge('cuddly', 3); sim.addBond(6); } else { done(); sim.nudge('cuddly', -1); sim.nudge('bold', 0.5); }
    }
  };
  const foodChoice = () => {
    const open = FOODS.filter(f => sim.foodUnlocked(f.id) && sim.canFeed(f.id).ok && st.jelly > sim.foodPrice(f.id) * 2);
    if (!open.length) return null;
    if (style.bestFood) return open.sort((a, b) => (b.nutrition / sim.foodPrice(b.id)) - (a.nutrition / sim.foodPrice(a.id)))[0].id;
    if (style.foods) { const want = [...style.foods].reverse().find(id => open.some(f => f.id === id)); return want || null; }
    return weighted(dice, Object.fromEntries(open.map(f => [f.id, style.food[f.id]])));
  };
  const bestHelper = () => { let best = null, sc = Infinity; for (const h of HELPERS) { const s = sim.helperCost(h.id) / sim.helperJps(h.id); if (s < sc) { sc = s; best = h.id; } } return best; };
  const step = () => {
    sim.tick(DT);
    if (!sim.asleep && S.energy <= 0.5) sim.asleep = true;
    if (sim.asleep && S.energy >= 99) sim.asleep = false;
    if (style.spamWake && sim.asleep && sim.canWake()) sim.asleep = false;
    burst = (burst + DT) % CYCLE;
    if (!sim.asleep) {
      const [rate, sec] = style.boop;
      if (burst < sec) { const x = rate * DT, n = Math.floor(x) + (dice() < x % 1 ? 1 : 0); for (let i = 0; i < n; i++) sim.boop(); }
      else if (burst < sec + style.pet) { sim.pet(DT); sim.addBond(0.15 * DT); }
    }
    const ev = req.tick(DT, !sim.asleep);
    if (ev) handle(ev);
    if (!sim.asleep && S.tummy < 72) { const f = foodChoice(); if (f) sim.feed(f); }
    for (const u of sim.availableUpgrades()) if (sim.canAfford(u.cost)) sim.buyUpgrade(u.id);
    const jc = sim.jarUpgradeCost(); if (jc !== null && st.jelly > jc * 4) sim.buyJarUpgrade();
    const h = bestHelper(); if (h && sim.canAfford(sim.helperCost(h))) sim.buyHelper(h);
  };
  const DAY = [['play', 25 * 60], ['away', 3 * 3600], ['play', 20 * 60], ['away', 4 * 3600], ['play', 35 * 60], ['away', 24 * 3600 - 80 * 60 - 7 * 3600]];
  for (let d = 0; d < DAYS; d++) for (const [kind, sec] of DAY) {
    if (kind === 'play') for (let t = 0; t < sec; t += DT) step();
    else { if (sec > 600) sim.addBond(2); sim.fillJar(sec); sim.collectJar(); sim.asleep = false; }
  }
  const settled = sim.stageIndex() === STAGES.length - 1;
  const form = S.form || sim.formCandidate();
  return { seed, style: style.kind, settled, form: { id: form.id, name: form.name, ...(form.spark ? { spark: form.spark } : {}), ...(form.pure ? { pure: true } : {}) },
    traits: { ...S.traits }, personality: Object.fromEntries(Object.entries(S.personality).map(([k, v]) => [k, Math.round(v * 10) / 10])), potential: { ...S.potential } };
}

const gradesOf = x => TL.talentsOf(x);
const count = (g, ids) => SKILL_IDS.filter(s => ids.includes(g[s])).length;
const mean = a => a.reduce((t, v) => t + v, 0) / Math.max(1, a.length);
const pct = (a, f) => 100 * a.filter(f).length / Math.max(1, a.length);

// ---------- 1. random players ----------
log(`raising ${N_RANDOM} slimes (random players), ${DAYS} days each...`);
const RND0 = rnd;   // (1b raises the same slimes again from the same dice)
const randoms = Array.from({ length: N_RANDOM }, (_, i) => raise(`talent-sim:random:${i}`, randomStyle(i)));
fs.writeFileSync(path.join(OUT, 'raised-random.json'), JSON.stringify(randoms.map(({ form, traits, personality, potential }) => ({ form, traits, personality, potential }))));
const rg = randoms.map(gradesOf);
const formCount = {};
for (const x of randoms) formCount[x.form.name] = (formCount[x.form.name] || 0) + 1;
log(`  ${randoms.filter(x => x.settled).length}/${N_RANDOM} settled by day ${DAYS}; forms: ${Object.entries(formCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace(' Slime', '')} ${v}`).join(', ')}`);
const perSkill = Object.fromEntries(SKILL_IDS.map(s => [s, ['C', 'B', 'A', 'S'].map(g => rg.filter(x => x[s] === g).length)]));
log(`  grades per skill (C/B/A/S): ${SKILL_IDS.map(s => `${s} ${perSkill[s].join('/')}`).join(' | ')}`);

// ---------- 1b. the same players with the raising nudges from before T1b (no familiar snacks, boops all the way) ----
// A varied player's slime should end about where it did: its Curious lean as the slime page shows it (under 40
// "Likes the familiar", over 60 "Endlessly curious", else the middle) compared slime by slime.
const BEFORE_T1B = { familiar: { repeat: 0, favorite: 0 }, boopPlayfulTo: null };
const withTuning = (o, fn) => { const keep = JSON.parse(JSON.stringify(Object.fromEntries(Object.keys(o).map(k => [k, C.TUNING[k]])))); Object.assign(C.TUNING, o); try { return fn(); } finally { Object.assign(C.TUNING, keep); } };
log(`raising the same ${N_RANDOM} slimes with the nudges from before T1b...`);
const RND1 = rnd; rnd = RND0;
const randomsBefore = withTuning(BEFORE_T1B, () => Array.from({ length: N_RANDOM }, (_, i) => raise(`talent-sim:random:${i}`, randomStyle(i))));
rnd = RND1;   // the rest of the run rolls on as if 1b were not there
const leanOf = v => (v < 40 ? 'familiar' : v > 60 ? 'curious' : 'middle');
const leanShare = (xs, k) => Object.fromEntries(['familiar', 'middle', 'curious'].map(l => [l, pct(xs, x => leanOf(x.personality[k]) === l)]));
const sameLean = pct(randoms.map((x, i) => [x, randomsBefore[i]]), ([a, b]) => leanOf(a.personality.curious) === leanOf(b.personality.curious));
const fmtLean = s => `familiar ${s.familiar.toFixed(0)}% / middle ${s.middle.toFixed(0)}% / curious ${s.curious.toFixed(0)}%`;
log(`  Curious: now ${fmtLean(leanShare(randoms, 'curious'))} (mean ${mean(randoms.map(x => x.personality.curious)).toFixed(1)}); before T1b ${fmtLean(leanShare(randomsBefore, 'curious'))} (mean ${mean(randomsBefore.map(x => x.personality.curious)).toFixed(1)}); same lean ${sameLean.toFixed(0)}%`);
const p80 = xs => pct(xs, x => x.personality.playful >= 80);
log(`  Playful 80+ (2 Bounce points): now ${p80(randoms).toFixed(0)}% (mean ${mean(randoms.map(x => x.personality.playful)).toFixed(1)}), before T1b ${p80(randomsBefore).toFixed(0)}% (mean ${mean(randomsBefore.map(x => x.personality.playful)).toFixed(1)})`);
const rgBefore = randomsBefore.map(x => TL.talentsOf(x));
log(`  before T1b, grades per skill (C/B/A/S): ${SKILL_IDS.map(s => `${s} ${['C', 'B', 'A', 'S'].map(g => rgBefore.filter(x => x[s] === g).length).join('/')}`).join(' | ')}`);

// ---------- 2. raised on purpose ----------
const purpose = {};
for (const skill of SKILL_IDS) {
  log(`raising ${N_PURPOSE} slimes on purpose for ${skill}...`);
  purpose[skill] = Array.from({ length: N_PURPOSE }, (_, i) => raise(`talent-sim:${skill}:${i}`, { kind: 'purpose:' + skill, ...PURPOSE[skill] }));
  const fc = {}; for (const x of purpose[skill]) fc[x.form.name] = (fc[x.form.name] || 0) + 1;
  const parts = purpose[skill].map(x => TL.talentParts(x));
  log(`  forms: ${Object.entries(fc).map(([k, v]) => `${k.replace(' Slime', '')} ${v}`).join(', ')}; ${skill} points: diet ${mean(parts.map(p => p.diet[skill])).toFixed(2)} nature ${mean(parts.map(p => p.nature[skill])).toFixed(2)} form ${mean(parts.map(p => p.form[skill])).toFixed(2)} Potential ${mean(parts.map(p => p.potential[skill])).toFixed(2)}`);
}

// ---------- 3. normal vs spamming players ----------
// and a player who only boops: the normal player, but it never plays with its slime (play requests left to pass)
log(`raising ${N_TAP} slimes each with the normal, the spamming and the only-booping player...`);
const normals = RAISE_ONLY ? [] : Array.from({ length: N_TAP }, (_, i) => raise(`talent-sim:normal:${i}`, normalStyle(false)));
const spams = RAISE_ONLY ? [] : Array.from({ length: N_TAP }, (_, i) => raise(`talent-sim:normal:${i}`, normalStyle(true)));   // the same eggs
const boopers = Array.from({ length: N_TAP }, (_, i) => raise(`talent-sim:normal:${i}`, { ...normalStyle(false), kind: 'booper', answers: { ...normalStyle(false).answers, play: 'ignore' } }));
const bouncePts = x => TL.talentParts(x).nature.bounce;
log(`  only booping: Playful ${mean(boopers.map(x => x.personality.playful)).toFixed(1)} on average (80+: ${p80(boopers).toFixed(0)}%), Bounce nature points ${mean(boopers.map(bouncePts)).toFixed(2)}, Bounce at A or S ${pct(boopers, x => ['A', 'S'].includes(gradesOf(x).bounce)).toFixed(0)}%${RAISE_ONLY ? '' : `; normal player: Playful ${mean(normals.map(x => x.personality.playful)).toFixed(1)}`}`);
const asScore = xs => mean(xs.map(x => count(gradesOf(x), ['A', 'S'])));
const ptsScore = xs => mean(xs.map(x => SKILL_IDS.reduce((t, s) => t + TL.talentParts(x).total[s], 0)));

// ---------- tune: which grade cutoffs / Potential weights would meet the raising targets ----------
// Potential does not change how a slime is raised, so for other weights the targets can be worked out exactly from the
// raised slimes' other points (diet + nature + form): P(total >= m) = sum over Potential k of weight(k) x [base + k >= m].
const baseOf = x => { const p = TL.talentParts(x); return Object.fromEntries(SKILL_IDS.map(s => [s, p.total[s] - p.potential[s]])); };
const RB = randoms.map(baseOf), PB = Object.fromEntries(SKILL_IDS.map(s => [s, purpose[s].map(x => baseOf(x)[s])]));
function predict(cut, weights) {
  const W = weights.reduce((a, b) => a + b, 0), pw = weights.map(v => v / W);
  const atLeast = (base, m) => pw.reduce((t, p, i) => t + (base + i + 1 >= m - 1e-9 ? p : 0), 0);
  let as = 0, b = 0, anyS = 0;
  for (const base of RB) {
    let allC = 1, noS = 1;
    for (const s of SKILL_IDS) { const pB = atLeast(base[s], cut.B), pA = atLeast(base[s], cut.A), pS = atLeast(base[s], cut.S); as += pA; b += pB - pA; allC *= 1 - pB; noS *= 1 - pS; }
    b += allC; anyS += 1 - noS;
  }
  const n = RB.length;
  return { as: as / n, b: b / n, anyS: 100 * anyS / n, purpose: Object.fromEntries(SKILL_IDS.map(s => [s, 100 * mean(PB[s].map(v => atLeast(v, cut.S)))])) };
}
const meets = r => [r.as >= 0.75 && r.as <= 1.5, r.b >= 1 && r.b <= 2, r.anyS < 5, ...SKILL_IDS.map(s => r.purpose[s] >= 70)];
if (args.includes('tune')) {
  fs.writeFileSync(path.join(OUT, `base-points${TAG}.json`), JSON.stringify({ random: RB, purpose: PB }));
  const now = { B: TALENTS.grades[1].min, A: TALENTS.grades[2].min, S: TALENTS.grades[3].min }, w0 = TALENTS.potential.weights;
  const fmtR = r => `A/S ${r.as.toFixed(2)}, B ${r.b.toFixed(2)}, any S ${r.anyS.toFixed(1)}%, on purpose S ${SKILL_IDS.map(s => `${s} ${r.purpose[s].toFixed(0)}%`).join(' ')}`;
  console.log(`\n=== tune (exact over the raised slimes' diet + nature + form) ===\nnow: B ${now.B} A ${now.A} S ${now.S}, weights ${w0.join('/')}: ${fmtR(predict(now, w0))}`);
  const WEIGHTS = [w0, [15, 30, 30, 18, 7], [20, 35, 28, 12, 5], [25, 35, 25, 11, 4], [30, 35, 22, 9, 4], [10, 25, 35, 20, 10], [15, 25, 30, 20, 10], [35, 35, 20, 7, 3],
    [5, 18, 65, 6, 6], [10, 25, 35, 23, 7], [8, 22, 40, 23, 7], [5, 20, 45, 25, 5], [5, 25, 45, 20, 5], [10, 20, 40, 24, 6], [5, 15, 50, 25, 5], [5, 20, 50, 20, 5], [10, 20, 45, 20, 5], [5, 20, 40, 28, 7]];
  const cands = [];
  for (const w of WEIGHTS) for (let B = 3; B <= 8; B += 0.5) for (let A = B + 1; A <= 12; A += 0.5) for (let S = A + 1; S <= 15; S += 0.5) {
    const r = predict({ B, A, S }, w), m = meets(r);
    cands.push({ B, A, S, w, r, met: m.filter(Boolean).length, metRandom: m.slice(0, 3).filter(Boolean).length, dist: Math.abs(B - now.B) + Math.abs(A - now.A) + Math.abs(S - now.S) + (w === w0 ? 0 : 3) });
  }
  cands.sort((a, b) => b.met - a.met || a.dist - b.dist);
  for (const c of cands.slice(0, 12)) console.log(`${c.met}/8 met | B ${c.B} A ${c.A} S ${c.S} | weights ${c.w.join('/')} | ${fmtR(c.r)}`);
  const purposeBest = cands.filter(c => c.metRandom === 3).sort((a, b) => b.met - a.met || a.dist - b.dist)[0];
  if (purposeBest) console.log(`best with all three random-play targets: ${purposeBest.met}/8 | B ${purposeBest.B} A ${purposeBest.A} S ${purposeBest.S} | weights ${purposeBest.w.join('/')} | ${fmtR(purposeBest.r)}`);
  // the trade-off: for each limit on S by accident, the best worst on-purpose S rate (with about 1 A/S and 1-2 B)
  for (const lim of [5, 10, 15, 20, 30, 40]) {
    const ok = cands.filter(c => c.r.anyS < lim && meets(c.r)[0] && meets(c.r)[1]).map(c => ({ ...c, worst: Math.min(...SKILL_IDS.map(s => c.r.purpose[s])) }));
    const best = ok.sort((a, b) => b.worst - a.worst || a.dist - b.dist)[0];
    if (best) console.log(`S by accident under ${lim}%: at best every on-purpose skill reaches S ${best.worst.toFixed(0)}% | B ${best.B} A ${best.A} S ${best.S} | weights ${best.w.join('/')} | ${fmtR(best.r)}`);
  }
  console.log(`on purpose, the other points (diet + nature + form) per skill: ${SKILL_IDS.map(s => `${s} ${mean(PB[s]).toFixed(2)} (min ${Math.min(...PB[s]).toFixed(1)})`).join(', ')}`);
  console.log(`random play, the other points per skill: ${SKILL_IDS.map(s => `${s} ${mean(RB.map(b => b[s])).toFixed(2)} (90th pct ${[...RB.map(b => b[s])].sort((a, b) => a - b)[Math.floor(RB.length * 0.9)].toFixed(1)})`).join(', ')}`);
}

// ---------- the raising rows (T1b: the two raising fixes, and the design's raising targets) ----------
const row = (target, measured, pass) => ({ target, measured, pass });
const charmNature = mean(purpose.charm.map(x => TL.talentParts(x).nature.charm));
const raisingRows = [
  row('random play: about 1 skill at A or S per slime (0.75 to 1.5)', `${mean(rg.map(g => count(g, ['A', 'S']))).toFixed(2)} (${pct(rg, g => count(g, ['A', 'S'])).toFixed(0)}% have at least one)`, (v => v >= 0.75 && v <= 1.5)(mean(rg.map(g => count(g, ['A', 'S']))))),
  row('random play: 1-2 skills at B per slime', mean(rg.map(g => count(g, ['B'])).map(Number)).toFixed(2), (v => v >= 1 && v <= 2)(mean(rg.map(g => count(g, ['B']))))),
  row('random play: S by accident stays rare (under 5% of slimes have an S)', `${pct(rg, g => count(g, ['S']) > 0).toFixed(1)}%`, pct(rg, g => count(g, ['S']) > 0) < 5),
  ...SKILL_IDS.map(s => row(`raised on purpose for ${s} (diet + nature + form): ${s} at S at least 70%`, `${pct(purpose[s], x => gradesOf(x)[s] === 'S').toFixed(0)}% (A ${pct(purpose[s], x => gradesOf(x)[s] === 'A').toFixed(0)}%)`, pct(purpose[s], x => gradesOf(x)[s] === 'S') >= 70)),
  row('T1b fix 1: Charm raised on purpose (cookies only) reaches Likes the familiar: Charm nature 3.5+ of 4 on average', `${charmNature.toFixed(2)} (Curious ${mean(purpose.charm.map(x => x.personality.curious)).toFixed(1)} on average)`, charmNature >= 3.5),
  row('T1b fix 1: a varied player ends where it did (random play: Curious lean on the slime page unchanged for 80%+)', `${sameLean.toFixed(0)}% (now ${fmtLean(leanShare(randoms, 'curious'))}; before ${fmtLean(leanShare(randomsBefore, 'curious'))})`, sameLean >= 80),
  ...([row('T1b fix 2: booping alone is not a Bounce natural (only booped, never played with: Bounce at A or S under 30%)', `${pct(boopers, x => ['A', 'S'].includes(gradesOf(x).bounce)).toFixed(0)}% (Playful ${mean(boopers.map(x => x.personality.playful)).toFixed(1)}, Bounce nature ${mean(boopers.map(bouncePts)).toFixed(2)})`, pct(boopers, x => ['A', 'S'].includes(gradesOf(x).bounce)) < 30)]),
];
const printTable = (rows, what) => {
  console.log(`\n=== Talents: ${what} (${N_RANDOM} random, ${N_PURPOSE} per purpose skill, ${N_TAP} normal/spam/booping, ${N_LINES} lines; raised ${DAYS} days; ${((Date.now() - t0) / 1000).toFixed(0)} s) ===`);
  console.log(`grades: ${TALENTS.grades.map(g => `${g.id} ${g.min}+`).join(', ')}; Potential weights ${TALENTS.potential.weights.join('/')}; familiar ${C.TUNING.familiar.repeat}/${C.TUNING.familiar.favorite}, boops nudge Playful up to ${C.TUNING.boopPlayfulTo}`);
  const w = Math.max(...rows.map(r => r.target.length));
  for (const r of rows) console.log(`${r.pass ? 'PASS' : 'FAIL'} | ${r.target.padEnd(w)} | ${r.measured}`);
  const fails = rows.filter(r => !r.pass).length;
  console.log(`\n${rows.length - fails} PASS, ${fails} FAIL`);
  process.exit(fails ? 1 : 0);
};
if (RAISE_ONLY) printTable(raisingRows, 'the raising targets only (raiseonly)');

// ---------- 4. the ranch: pearl-sim with these slimes, talents on vs every grade C ----------
log('ranch pearls: tools/pearl-sim.mjs with the raised slimes, talents vs every grade C...');
const pearlSim = (...a) => execFileSync(process.execPath, [path.join(HERE, 'pearl-sim.mjs'), ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });
const week2 = out => { const d7 = +out.match(/d7: made (\d+)/)[1], d14 = +out.match(/d14: made (\d+)/)[1]; return d14 - d7; };
const prof = path.join(OUT, 'raised-random.json');
const profOf = xs => xs.map(({ form, traits, personality, potential }) => ({ form, traits, personality, potential }));
fs.writeFileSync(path.join(OUT, 'raised-normal.json'), JSON.stringify(profOf(normals)));
fs.writeFileSync(path.join(OUT, 'raised-spam.json'), JSON.stringify(profOf(spams)));
const ranch = {};
for (const p of ['engaged', 'casual', 'spam']) {
  const on = week2(pearlSim(p, 'days=14', 'quiet', 'residents=' + prof)), off = week2(pearlSim(p, 'days=14', 'quiet', 'residents=' + prof, 'allc'));
  ranch[p] = { on, off, gain: 100 * (on / off - 1) };
  log(`  ${p}: week 2 pearls ${off} (all C) -> ${on} with talents (${ranch[p].gain >= 0 ? '+' : ''}${ranch[p].gain.toFixed(1)}%)`);
}

// the same eggs raised by tapping 11 times a second vs normally: their week-2 ranch pearls (engaged ranch player)
const tapRanch = Object.fromEntries(['normal', 'spam'].map(k => [k, week2(pearlSim('engaged', 'days=14', 'quiet', 'residents=' + path.join(OUT, `raised-${k}.json`)))]));
log(`  the same eggs raised normally / by spamming, on an engaged ranch: week 2 pearls ${tapRanch.normal} / ${tapRanch.spam}`);

// ---------- 5. Pure lines ----------
// A Pure line: two founders hatched from plain eggs (line 1) grow into the same form; every generation the pair lays two
// Nursery eggs (the real makeEgg: Pure, so fresh skills roll twice), both are raised into that form again and are the
// next pair. Measured: the line number (the game's lineage.line: founders 1, their babies 2...) of the first member
// with Potential 5 in any skill.
log(`breeding ${N_LINES} Pure lines...`);
const lines = [], linesBred = [];
for (let i = 0; i < N_LINES; i++) {
  const form = { id: 'sweet', name: 'Candy Slime' };
  let pair = [0, 1].map(j => ({ id: `L${i}-1-${j}`, name: 'F', form, traits: { sweet: 100 }, personality: {}, potential: TL.rollPotential(`talent-sim:line:${i}:${j}`), lineage: { line: 1, parents: [] } }));
  const has5 = xs => xs.some(x => SKILL_IDS.some(s => x.potential[s] === 5));
  let first = has5(pair) ? 1 : null, firstBred = null;
  for (let g = 2; g <= 60 && (first === null || firstBred === null); g++) {
    const kids = [0, 1].map(j => { const e = makeEgg(pair[0], pair[1], { now: 1e12 + g * 1e6 + j, id: `e${i}-${g}-${j}` }); return { id: `L${i}-${g}-${j}`, name: 'K', form, traits: { sweet: 100 }, personality: {}, potential: e.potential, pure: e.pure, lineage: { line: e.line, parents: [] } }; });
    if (first === null && has5(kids)) first = g;
    if (firstBred === null && has5(kids)) firstBred = g;
    pair = kids;
  }
  lines.push(first ?? 61); linesBred.push(firstBred ?? 61);
}
const pureOk = lines.length && mean(lines);

// ---------- 6. the identity checks (economy and the all-C ranch) ----------
// the hashes are main @ 00f1430's output (git archive 00f1430 | tar -x; the same commands there), the start of this branch
const MAIN = { economy: '25f842705411', pearlAllC: 'e91d5de98290' };
const md5 = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 12);
const eco = ['12 quiet', '12 casual quiet', '2 quiet spam', '4 casual quiet gen2=1e9'].map(a => execFileSync(process.execPath, [path.join(HERE, 'economy-sim.mjs'), ...a.split(' ')], { encoding: 'utf8' })).join('');
const ecoHash = md5(eco), pearlHash = md5(pearlSim('allc'));

// ---------- the table ----------
const rows = [
  row('pre-ranch economy IDENTICAL (economy-sim, the 4 standard runs, md5 of the output vs main 00f1430)', `${ecoHash} (main ${MAIN.economy})`, ecoHash === MAIN.economy),
  row('a grade-C slime trains exactly as today (pearl-sim allc, md5 of the whole output vs main 00f1430)', `${pearlHash} (main ${MAIN.pearlAllC})`, pearlHash === MAIN.pearlAllC),
  ...raisingRows,
  row('ranch pearls with talents, engaged player, week 2: at most +8% over today (all C)', `${ranch.engaged.gain >= 0 ? '+' : ''}${ranch.engaged.gain.toFixed(1)}% (${ranch.engaged.off} -> ${ranch.engaged.on})`, ranch.engaged.gain <= 8),
  row('spam never beats normal play: ranch (week 2 with talents: checking in every 5 min makes no more than engaged)', `spam ${ranch.spam.on} vs engaged ${ranch.engaged.on} (talents' gain: spam ${ranch.spam.gain >= 0 ? '+' : ''}${ranch.spam.gain.toFixed(1)}%, engaged ${ranch.engaged.gain >= 0 ? '+' : ''}${ranch.engaged.gain.toFixed(1)}%)`, ranch.spam.on <= ranch.engaged.on),
  row('spam never beats normal play: raising (the same eggs raised by spamming make no more week-2 ranch pearls)', `spam-raised ${tapRanch.spam} vs normally raised ${tapRanch.normal} (A or S skills per slime ${asScore(spams).toFixed(2)} vs ${asScore(normals).toFixed(2)}; all points ${ptsScore(spams).toFixed(1)} vs ${ptsScore(normals).toFixed(1)})`, tapRanch.spam <= tapRanch.normal),
  row('a bred Pure line reaches a 5-Potential skill within about 3 generations on average (2 to 4)', `line ${pureOk.toFixed(2)} on average (founders = 1; ${pct(lines, v => v <= 3).toFixed(0)}% by line 3; first bred baby with a 5: line ${mean(linesBred).toFixed(2)})`, pureOk >= 2 && pureOk <= 4),
];
printTable(rows, 'design section 6 targets vs measured');
