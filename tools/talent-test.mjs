// Talents rules check (plain node, no browser): the TALENTS mappings exactly as the design (2a diet, 2b nature, 2c form),
// points and grades, the cozy floor, Potential (seeded roll, inheritance 40/40/20, Pure rerolls), where Potential is
// made (plain egg, Nursery egg, special egg, the move to the ranch), the hooks in core/ranch-life.js (lesson time x
// grade, the x0.40 floor, star caps 5/6/7, stars 6 and 7), the barn card's reveal line, and old saves (every fixture,
// and tools/fixtures/talents/ranch-trained.json: a fully trained resident and lessons in flight).
//   node tools/talent-test.mjs
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
let rnd = 777; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);

const C = await import(SRC + '/data/content.js');
const TL = await import(SRC + '/core/talents.js');
const RL = await import(SRC + '/core/ranch-life.js');
const { Sim, createState, migrate } = await import(SRC + '/core/sim.js');
const { makeEgg, applyEgg } = await import(SRC + '/core/breeding.js');
const { checkSave } = await import(SRC + '/core/save-check.js');
const { cardLine } = await import(SRC + '/view/barn-math.js');
const { TALENTS: T, SKILL_IDS, PERSONALITY_IDS, TRAIT_IDS, FORM_IDS, SPARK_FORMS, RANCH_LIFE: L } = C;

let fails = 0, passes = 0;
const ok = (cond, what, extra = '') => { if (cond) { passes++; console.log('ok   - ' + what + (extra ? ' | ' + extra : '')); } else { fails++; console.log('FAIL - ' + what + (extra ? ' | ' + extra : '')); } };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const clone = o => JSON.parse(JSON.stringify(o));
const H = 3600e3, NOW = Date.UTC(2026, 10, 8, 9, 0, 0);
const mid = () => Object.fromEntries(PERSONALITY_IDS.map(k => [k, 50]));
const ones = () => Object.fromEntries(SKILL_IDS.map(k => [k, 1]));
const pot = o => ({ ...ones(), ...o });
// a resident: no diet, a calm personality, no form, Potential 1 everywhere unless given
let nid = 0;
const resident = (o = {}) => ({ id: 't' + (nid++), name: o.name || 'Pip', form: null, traits: {}, personality: mid(), potential: ones(), bondLevel: 2, runTotal: 5e8, jps: 4,
  generation: 1, happiness: 60, pearlT: 0, petAt: 0, lineage: { parents: [] }, skills: RL.emptySkills(), lesson: null, trip: null, talentsSeen: [], ...o });
function world(list, pearls = 5000) {
  const st = createState();
  st.phase = 'play'; st.slime.name = 'Clover';
  st.ranch.residents = list;
  st.ranch.pearls = st.ranch.totalPearls = pearls;
  st.ranch.slots = 10; st.ranch.life.lanes = 3;
  const sim = new Sim(st);
  return { st, sim, rl: sim.life, R: st.ranch };
}

// ---------- 1. the numbers are the design's ----------
console.log('\n# TALENTS data (design 2a, 2b, 2c, 2d, 3)');
const dietMap = Object.fromEntries(Object.entries(T.diet.skills).map(([k, v]) => [k, Object.entries(v).map(([s, f]) => `${s}${f === 1 ? '' : '/' + f}`).join('+')]));
ok(JSON.stringify(dietMap) === JSON.stringify({ sweet: 'charm', heat: 'bounce', mineral: 'sturdy', spark: 'speed', prism: 'smarts', nature: 'sturdy/0.5+smarts/0.5' }) && T.diet.scale === 3,
  '2a diet: Sweet Charm, Warm Bounce, Sturdy Sturdy, Zippy Speed, Prismatic Smarts, Leafy half Sturdy half Smarts; x3', JSON.stringify(dietMap));
const natureEnds = Object.entries(T.nature.ends).map(([k, [lo, hi]]) => `${C.PERSONALITY[k].low}>${lo},${C.PERSONALITY[k].high}>${hi}`).join(' ');
const want2b = { bounce: ['Playful', 'Bold'], speed: ['Impulsive', 'Independent'], sturdy: ['Mellow', 'Shy'], smarts: ['Patient', 'Endlessly curious'], charm: ['Cuddly', 'Likes the familiar'] };
const feeds = Object.fromEntries(SKILL_IDS.map(s => [s, []]));
for (const [k, [lo, hi]] of Object.entries(T.nature.ends)) { feeds[lo].push(C.PERSONALITY[k].low); feeds[hi].push(C.PERSONALITY[k].high); }
ok(SKILL_IDS.every(s => feeds[s].sort().join() === want2b[s].sort().join()) && T.nature.dead === 10 && T.nature.per === 10 && T.nature.max === 2,
  '2b nature: Bounce Playful+Bold, Speed Impulsive+Independent, Sturdy Mellow+Shy, Smarts Patient+Curious, Charm Cuddly+Likes the familiar; min(2, beyond 10 / 10)', natureEnds);
const want2c = { sweet: 'charm', heat: 'bounce', mineral: 'sturdy', nature: 'smarts', spark: 'speed', prism: 'smarts', smore: 'charm', honeycomb: 'charm', campfire: 'sturdy', storm: 'speed',
  'heat+sweet': 'charm', 'heat+mineral': 'sturdy', 'nature+sweet': 'charm', 'mineral+nature': 'sturdy', 'prism+spark': 'smarts', 'mineral+prism': 'smarts', 'heat+spark': 'bounce',
  'spark+sweet': 'bounce', 'nature+spark': 'speed', 'heat+nature': 'bounce', 'mineral+spark': 'speed', 'prism+sweet': 'charm', 'heat+prism': 'smarts', 'nature+prism': 'speed', 'mineral+sweet': 'sturdy' };
ok(JSON.stringify(Object.entries(T.form.skill).sort()) === JSON.stringify(Object.entries(want2c).sort()) && T.form.points === 2 && T.form.every.mochi === 1 && Object.keys(T.form.every).length === 1,
  '2c form: the 25 specialties of the table (+2) and Marshmallow +1 to every skill');
ok(FORM_IDS.every(id => T.form.skill[id] || T.form.every[id]) && SPARK_FORMS.every(s => T.form.skill[s.id]), `every form has a specialty: the ${FORM_IDS.length} diet forms and the ${SPARK_FORMS.length} spark forms`);
ok(T.potential.weights.join() === '15,30,30,18,7' && T.potential.copy === 0.4 && T.potential.pureRolls === 2, '2d Potential: weights 15/30/30/18/7, 40% / 40% / 20% fresh, Pure: best of two fresh rolls');
ok(T.grades.map(g => `${g.id}x${g.lessonTime}c${g.cap}`).join(' ') === 'Cx1c5 Bx0.85c5 Ax0.7c6 Sx0.55c7' && T.floor === 'B' && T.lessonFloor === 0.4,
  '3 grade effects as designed: C x1.00 cap 5, B x0.85 cap 5, A x0.70 cap 6, S x0.55 cap 7; cozy floor B; lessons never under x0.40');
ok(T.grades.map(g => g.min).join() === '0,6,8,10', 'grade cutoffs as tuned by tools/talent-sim.mjs: B 6, A 8, S 10 (design: B 4, A 6, S 10)');
ok(T.stars.pearls.join() === '80,120' && T.stars.minutes.join() === '480,1440', 'stars 6 and 7: 80 and 120 pearls, 8 h and 24 h');

// ---------- 2. points ----------
console.log('\n# points');
const D = TL.dietPoints;
ok(D({ sweet: 100 }).charm === 3 && SKILL_IDS.filter(s => s !== 'charm').every(s => D({ sweet: 100 })[s] === 0), 'diet: all Sweet = Charm 3, nothing else');
ok(D({ nature: 100 }).sturdy === 2 && D({ nature: 100 }).smarts === 2, 'diet: all Leafy = Sturdy round(1.5) = 2 and Smarts 2 (half each)');
ok(JSON.stringify(D({ heat: 50, mineral: 30, nature: 20 })) === JSON.stringify({ bounce: 2, speed: 0, sturdy: 1, smarts: 0, charm: 0 }), 'diet: Warm 50% / Sturdy 30% / Leafy 20% = Bounce round(1.5) 2, Sturdy round(1.2) 1, Smarts round(0.3) 0', JSON.stringify(D({ heat: 50, mineral: 30, nature: 20 })));
ok(SKILL_IDS.every(s => D({})[s] === 0) && SKILL_IDS.every(s => D(null)[s] === 0) && SKILL_IDS.every(s => D({ sweet: 'x', heat: -5 })[s] === 0), 'diet: no traits (or broken ones) = 0 everywhere');
const N = p => TL.naturePoints({ ...mid(), ...p });
ok(SKILL_IDS.every(s => N({})[s] === 0) && N({ playful: 60 }).bounce === 0 && N({ playful: 40 }).sturdy === 0, 'nature: within 10 of the middle gives nothing');
ok(near(N({ playful: 65 }).bounce, 0.5) && N({ playful: 70 }).bounce === 1 && N({ playful: 90 }).bounce === 2 && N({ playful: 100 }).bounce === 2, 'nature: 65 = 0.5, 70 = 1, 90 = 2, 100 = 2 (capped)');
ok(N({ playful: 0 }).sturdy === 2 && N({ playful: 0 }).bounce === 0, 'nature: the low end counts too (Mellow 0 = Sturdy 2)');
ok(N({ playful: 100, bold: 100 }).bounce === 4 && N({ patient: 0, cuddly: 0 }).speed === 4 && N({ curious: 100, patient: 100 }).smarts === 4 && N({ cuddly: 100, curious: 0 }).charm === 4 && N({ playful: 0, bold: 0 }).sturdy === 4,
  'nature: two ends per skill, up to 4');
const F = f => TL.formPoints(f);
ok(F({ id: 'heat' }).bounce === 2 && F({ id: 'heat+mineral' }).sturdy === 2 && F({ id: 'mineral+sweet' }).sturdy === 2 && F({ id: 'nature+prism' }).speed === 2, 'form: Blaze Bounce, Furnace Sturdy, Toffee Guardian Sturdy, Dewdrop Speed (+2)');
ok(SKILL_IDS.every(s => F({ id: 'mochi' })[s] === 1), 'form: Marshmallow +1 to every skill');
ok(F({ id: 'spark:smore', spark: 'smore' }).charm === 2 && F({ id: 'spark:storm', spark: 'storm' }).speed === 2, "form: spark forms by their spark id (S'more Charm, Storm Speed)");
ok(F({ id: 'sweet', pure: true, name: 'Pure Candy Slime' }).charm === 2, 'form: a Pure form takes its form\'s specialty');
ok(SKILL_IDS.every(s => F(null)[s] === 0 && F({ id: 'nope' })[s] === 0), 'form: none (not grown yet) or unknown = 0');
const parts = TL.talentParts(resident({ traits: { heat: 100 }, personality: { ...mid(), playful: 100, bold: 75 }, form: { id: 'heat' }, potential: pot({ bounce: 4 }) }));
ok(parts.total.bounce === 3 + 3.5 + 2 + 4 && parts.total.speed === 1, 'the total is diet + nature + form + Potential (Blaze, Playful 100, Bold 75, Potential 4: 3 + 3.5 + 2 + 4 = 12.5)', JSON.stringify(parts.total));

// ---------- 3. grades and the cozy floor ----------
console.log('\n# grades');
ok([1, 3, 5].every(n => TL.gradeFor(n) === 'C') && [6, 7].every(n => TL.gradeFor(n) === 'B') && [8, 9].every(n => TL.gradeFor(n) === 'A') && [10, 14].every(n => TL.gradeFor(n) === 'S'), 'C 1-5, B 6-7, A 8-9, S 10+');
ok(T.grades.slice(1).every((g, i) => TL.gradeFor(g.min) === g.id && TL.gradeFor(g.min - 0.1) === T.grades[i].id), 'between whole points: the grade it has reached (5.9 C, 7.9 B, 9.9 A)');
{
  const plain = resident();
  const g = TL.talentsOf(plain);
  ok(g.bounce === 'B' && SKILL_IDS.filter(s => s !== 'bounce').every(s => g[s] === 'C'), 'cozy floor: all C (every total 1) lifts the first best skill to B, only that one', JSON.stringify(g));
  const g2 = TL.talentsOf(resident({ potential: pot({ smarts: 3 }) }));
  ok(g2.smarts === 'B' && SKILL_IDS.filter(s => s !== 'smarts').every(s => g2[s] === 'C'), 'cozy floor: the best one (Smarts 3) is the one lifted', JSON.stringify(g2));
  const g3 = TL.talentsOf(resident({ potential: pot({ speed: 5, charm: 3 }), personality: { ...mid(), patient: 0 } }));
  ok(g3.speed === 'B' && g3.charm === 'C', 'cozy floor: not used when a skill is already B', JSON.stringify(g3));
  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    const r = TL.rollPotential('floor' + i);
    const p = Object.fromEntries(PERSONALITY_IDS.map((k, j) => [k, (i * 37 + j * 53) % 101]));
    const gg = TL.talentsOf(resident({ potential: r, personality: p, traits: { [TRAIT_IDS[i % 6]]: 10 + i % 7 } }));
    if (!SKILL_IDS.some(s => gg[s] !== 'C')) worst++;
  }
  ok(worst === 0, 'every slime has at least one skill at B or better (2000 mixed slimes)');
}

// ---------- 4. Potential ----------
console.log('\n# Potential');
{
  ok(JSON.stringify(TL.rollPotential('abc')) === JSON.stringify(TL.rollPotential('abc')) && JSON.stringify(TL.rollPotential('abc')) !== JSON.stringify(TL.rollPotential('abd')), 'same seed, same Potential; another seed, another');
  const n = 40000, hist = [0, 0, 0, 0, 0];
  for (let i = 0; i < n / 5; i++) { const p = TL.rollPotential('h' + i); for (const s of SKILL_IDS) hist[p[s] - 1]++; }
  const pct = hist.map(h => 100 * h / n);
  ok(pct.every((p, i) => Math.abs(p - T.potential.weights[i]) < 1), 'rolls follow the weights (40,000 rolls, each within 1 point)', pct.map(p => p.toFixed(1)).join('/'));
  ok(TL.validPotential(TL.rollPotential('x')) && !TL.validPotential({ bounce: 6 }) && !TL.validPotential(null) && !TL.validPotential({ ...ones(), speed: '3' }), 'a valid Potential is a whole 1-5 in every skill');
  // inheritance: 40% A, 40% B, 20% fresh
  const A = resident({ potential: { bounce: 5, speed: 5, sturdy: 5, smarts: 5, charm: 5 } }), B = resident({ potential: { bounce: 1, speed: 1, sturdy: 1, smarts: 1, charm: 1 } });
  let fromA = 0, fromB = 0, other = 0, tot = 0;
  // parents 5 and 1: a 5 is A's (or a fresh 5), a 1 is B's (or a fresh 1); fresh 2-4 is plainly fresh
  for (let i = 0; i < 8000; i++) { const p = TL.inheritPotential(A, B, 'inh' + i); for (const s of SKILL_IDS) { tot++; if (p[s] === 5) fromA++; else if (p[s] === 1) fromB++; else other++; } }
  const fA = fromA / tot, fB = fromB / tot, fo = other / tot;
  ok(Math.abs(fA - (0.4 + 0.2 * 0.07)) < 0.01 && Math.abs(fB - (0.4 + 0.2 * 0.15)) < 0.01 && Math.abs(fo - 0.2 * 0.78) < 0.01, 'bred: 40% parent A, 40% parent B, 20% a fresh roll (40,000 skills)', `A ${(100 * fA).toFixed(1)}% B ${(100 * fB).toFixed(1)}% fresh 2-4 ${(100 * fo).toFixed(1)}%`);
  let pureFive = 0, plainFive = 0, k = 0;
  const M = resident({ potential: pot({}) }), M2 = resident({ potential: pot({}) });
  for (let i = 0; i < 8000; i++) { const a = TL.inheritPotential(M, M2, 'p' + i, { pure: true }), b = TL.inheritPotential(M, M2, 'p' + i); for (const s of SKILL_IDS) { k++; if (a[s] === 5) pureFive++; if (b[s] === 5) plainFive++; } }
  ok(Math.abs(pureFive / k - 0.2 * (1 - 0.93 ** 2)) < 0.006 && Math.abs(plainFive / k - 0.2 * 0.07) < 0.004, 'Pure: fresh skills roll twice and keep the better (a fresh 5: 13.5% instead of 7%)', `pure ${(100 * pureFive / k).toFixed(2)}% vs ${(100 * plainFive / k).toFixed(2)}% of skills are a fresh 5`);
  ok(JSON.stringify(TL.inheritPotential(A, B, 's1')) === JSON.stringify(TL.inheritPotential(A, B, 's1')), 'bred: same seed, same Potential');
}

// ---------- 5. where Potential is made ----------
console.log('\n# where Potential comes from');
{
  const st = createState();
  ok(TL.validPotential(st.slime.potential) && JSON.stringify(st.slime.potential) === JSON.stringify(TL.rollPotential(st.egg.seed)), 'a plain egg: rolled from its seed (fixed when the egg is made, so hatching never rerolls it)');
  const { st: w, sim, R } = world([resident({ name: 'Ann', form: { id: 'sweet', name: 'Candy Slime' }, potential: pot({ charm: 5 }) }), resident({ name: 'Bo', form: { id: 'sweet', name: 'Candy Slime' }, potential: pot({ charm: 5 }) })]);
  const egg = makeEgg(R.residents[0], R.residents[1], { now: NOW, id: 'e1' });
  ok(TL.validPotential(egg.potential) && egg.pure === 'sweet' && JSON.stringify(egg.potential) === JSON.stringify(TL.inheritPotential(R.residents[0], R.residents[1], egg.seed, { pure: true })), 'a Nursery egg: inherited when it is laid (Pure when both parents share a form)', JSON.stringify(egg.potential));
  const baby = applyEgg(createState().slime, egg);
  ok(JSON.stringify(baby.potential) === JSON.stringify(egg.potential), 'the baby takes its egg\'s Potential');
  const sp = sim.ranch.buySpecialEgg('ears', NOW);
  ok(sp && TL.validPotential(sp.egg.potential) && JSON.stringify(sp.egg.potential) === JSON.stringify(TL.rollPotential(sp.egg.seed)), 'a special egg (pearls): a fresh roll from its seed');
  w.slime.growth = C.STAGES[3].minGrowth + 1; w.totalJelly = 1e9; w.slime.name = 'Clover';
  const mine = clone(w.slime.potential);
  const mv = sim.moveToRanch(NOW);
  ok(mv && JSON.stringify(mv.resident.potential) === JSON.stringify(mine) && Array.isArray(mv.resident.talentsSeen) && mv.resident.talentsSeen.length === 0, 'moving to the ranch: its Potential goes with it, nothing revealed yet');
  ok(TL.validPotential(w.slime.potential) && JSON.stringify(w.slime.potential) === JSON.stringify(TL.rollPotential(w.egg.seed)), 'the next plain egg has its own');
  // the game's random numbers are untouched (the economy simulator replays them)
  let calls = 0; const real = Math.random; Math.random = () => { calls++; return real(); };
  TL.rollPotential('z'); TL.inheritPotential(R.residents[0], R.residents[1], 'z'); TL.talentsOf(R.residents[0]);
  Math.random = real;
  ok(calls === 0, 'talents never call Math.random');
}

// ---------- 6. hooks: lesson time and star cap ----------
console.log('\n# lessons (core/ranch-life.js)');
{
  // one resident per grade in Bounce: C (1: the cozy floor lifts Charm 4 instead), B (form 2 + 4), A (form 2 + diet 3 + 3), S (2 + 3 + 5)
  const mk = (b, o = {}) => resident({ potential: pot({ bounce: b, charm: 4 }), ...o });
  const c = mk(1), b = mk(4, { form: { id: 'heat' } }), a = mk(3, { form: { id: 'heat' }, traits: { heat: 100 } }), s = mk(5, { form: { id: 'heat' }, traits: { heat: 100 } });
  const { rl } = world([c, b, a, s]);
  const g = x => TL.gradeOf(x, 'bounce');
  ok([c, b, a, s].map(g).join('') === 'CBAS', 'four slimes graded C, B, A, S in Bounce', [c, b, a, s].map(x => TL.talentParts(x).total.bounce).join(','));
  const sec = (x, star) => { x.skills.bounce = star - 1; const l = rl.lessonFor(x, 'bounce'); x.skills.bounce = 0; return l; };
  ok(sec(c, 1).seconds === 20 * 60 && sec(c, 5).seconds === 360 * 60 && sec(c, 1).pearls === 5, 'C: exactly as before talents (20 min, 6 h; 5 pearls)');
  ok(sec(b, 1).seconds === Math.round(20 * 60 * 0.85) && sec(a, 1).seconds === Math.round(20 * 60 * 0.7) && sec(s, 1).seconds === Math.round(20 * 60 * 0.55), 'B x0.85, A x0.70, S x0.55', [b, a, s].map(x => sec(x, 1).seconds).join('s, ') + 's');
  ok(sec(c, 6) === null && sec(b, 6) === null, 'C and B: five stars is the top');
  const a6 = sec(a, 6), s6 = sec(s, 6), s7 = sec(s, 7);
  ok(a6 && a6.pearls === 80 && a6.seconds === Math.round(480 * 60 * 0.7) && sec(a, 7) === null, 'A: a 6th star (80 pearls, 8 h x0.70), no 7th');
  ok(s6 && s7 && s6.pearls === 80 && s7.pearls === 120 && s7.seconds === Math.round(1440 * 60 * 0.55) && sec(s, 8) === null, 'S: 6th and 7th stars (80 / 120 pearls, 8 h / 24 h x0.55), no 8th');
  // multiplies with Smarts and loves, never under x0.40
  const fast = mk(5, { form: { id: 'heat' }, traits: { heat: 100 }, personality: { ...mid(), playful: 100 }, skills: { ...RL.emptySkills(), smarts: 5 } });
  ok(TL.gradeOf(fast, 'bounce') === 'S' && RL.lovesOf(fast) === 'playful', '(an S Bounce slime that loves Bounce, with Smarts 5)');
  ok(RL.lessonTimeMult(fast, 'bounce') === 0.4, 'S x Smarts 5 x loves = 0.55 x 0.75 x 0.75 = 0.309, held at the x0.40 floor', String(RL.lessonTimeMult(fast, 'bounce')));
  ok(near(RL.lessonTimeMult(fast, 'speed'), 0.75 * TL.talentLessonMult(fast, 'speed')), 'other skills: Smarts x their own grade (no loves)', String(RL.lessonTimeMult(fast, 'speed')));
  const cs = mk(1, { personality: { ...mid(), playful: 100 }, skills: { ...RL.emptySkills(), smarts: 5 } });
  ok(TL.gradeOf(cs, 'bounce') !== 'C' || near(RL.lessonTimeMult(cs, 'bounce'), 0.75 * 0.75), 'C: Smarts and loves exactly as before (x0.5625, the floor never touches it)');
  // each star keeps its per-star effect: 7 Bounce stars = +21% pearls
  const seven = mk(5, { form: { id: 'heat' }, traits: { heat: 100 }, skills: { ...RL.emptySkills(), bounce: 7 } });
  ok(near(RL.pearlSkillMult(seven), 1.21) && RL.stars(seven, 'bounce') === 7, 'a 7-star Bounce gives +21% pearls (each star its 3%)');
  // a lesson to a 6th star finishes like any other
  const { rl: rl2, st: st2 } = world([a]);
  a.skills.bounce = 5;
  const t = rl2.train(a.id, 'bounce', NOW);
  ok(t && t.lesson.star === 6 && t.cost === 80, 'training a 6th star: 80 pearls');
  const done = rl2.resolve(NOW + t.seconds * 1000);
  ok(done.length === 1 && a.skills.bounce === 6 && a.talentsSeen.includes('bounce'), 'it ends with 6 stars');
  const re = migrate(clone(st2));
  ok(re.ranch.residents[0].skills.bounce === 6, 'a 6th star survives a save and load');
}

// ---------- 7. the reveal line ----------
console.log('\n# the barn card\'s reveal line');
{
  const x = resident({ potential: pot({ bounce: 5, speed: 4, charm: 3 }), form: { id: 'heat' }, traits: { heat: 100 }, personality: { ...mid(), patient: 0 } });   // Bounce S, Speed B (4 + Impulsive 2), Charm C
  const { rl } = world([x]);
  ok(TL.revealLine(x) === '' && cardLine(x, { now: NOW, perHour: 4 }).talent === '', 'nothing before a first lesson');
  rl.train(x.id, 'charm', NOW); const d1 = rl.resolve(NOW + 3 * H);
  ok(d1[0].talent === '' && TL.revealLine(x) === '' && x.talentsSeen.join() === 'charm', 'a C skill\'s first lesson: seen, but it says nothing');
  rl.train(x.id, 'speed', NOW + 3 * H); const d2 = rl.resolve(NOW + 6 * H);
  ok(d2[0].talent === 'getting the hang of Speed' && TL.revealLine(x) === 'getting the hang of Speed', 'B: "getting the hang of Speed"');
  rl.train(x.id, 'bounce', NOW + 6 * H); rl.resolve(NOW + 9 * H);
  ok(TL.revealLine(x) === 'a natural at Bounce!' && cardLine(x, { now: NOW + 9 * H }).talent === 'a natural at Bounce!', 'S: "a natural at Bounce!" (the best one shown)');
  const y = resident({ potential: pot({ smarts: 4 }), form: { id: 'prism' }, traits: { prism: 100 } });
  y.talentsSeen = ['smarts'];
  ok(TL.gradeOf(y, 'smarts') === 'A' && TL.revealLine(y) === 'takes to Smarts quickly', 'A: "takes to Smarts quickly"');
  rl.train(x.id, 'speed', NOW + 9 * H); const d3 = rl.resolve(NOW + 12 * H);
  ok(d3[0].talent === null && TL.revealLine(x) === 'a natural at Bounce!', 'a second lesson reveals nothing new; it stays');
  const back = migrate(clone(world([x]).st)).ranch.residents[0];
  ok(back.talentsSeen.join() === 'charm,speed,bounce' && TL.revealLine(back) === 'a natural at Bounce!', 'once seen it stays (saved, through a save and load)');
}

// ---------- 8. old saves ----------
console.log('\n# old saves');
{
  const files = [...fs.readdirSync(path.join(HERE, 'fixtures')).filter(f => f.endsWith('.json')),
    ...['barn', 'talents'].flatMap(d => fs.readdirSync(path.join(HERE, 'fixtures', d)).filter(f => f.endsWith('.json')).map(f => `${d}/${f}`))];
  for (const f of files) {
    const save = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', f), 'utf8')).save;
    const m = migrate(clone(save));
    const res = m.ranch.residents;
    const seeded = res.every(x => TL.validPotential(x.potential) && JSON.stringify(x.potential) === JSON.stringify(TL.rollPotential('id:' + x.id)));
    const stars = res.every((x, i) => SKILL_IDS.every(k => x.skills[k] === Math.min(5, Math.max(0, Math.floor(+(save.ranch.residents[i].skills?.[k] || 0))))));
    const seen = res.every((x, i) => x.talentsSeen.join() === SKILL_IDS.filter(k => (save.ranch.residents[i].skills?.[k] || 0) > 0).join());
    const eggs = m.ranch.nursery.eggs.every(e => TL.validPotential(e.potential)) && (!m.egg.bred || TL.validPotential(m.egg.bred.potential));
    const home = TL.validPotential(m.slime.potential) && (!m.egg.bred || JSON.stringify(m.slime.potential) === JSON.stringify(m.egg.bred.potential));
    const twice = JSON.stringify(migrate(clone(m))) === JSON.stringify(m);
    const grades = res.every(x => SKILL_IDS.some(k => TL.gradeOf(x, k) !== 'C'));
    ok(seeded && stars && seen && eggs && home && twice && grades && checkSave(m).ok,
      `${f}: residents get Potential seeded from their id and keep every star; skills with stars count as revealed; eggs and the slime at home get one; migrating twice changes nothing`,
      `${res.length} residents: ${res.map(x => `${x.name} ${SKILL_IDS.map(k => TL.gradeOf(x, k)).join('')}`).join(', ')}`);
  }
  // the trained save: nobody loses a star, a lesson in progress finishes unchanged
  const save = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'talents', 'ranch-trained.json'), 'utf8')).save;
  const m = migrate(clone(save));
  const by = n => m.ranch.residents.find(x => x.name === n);
  const mochi = by('Mochi'), peaches = by('Peaches'), plum = by('Plum');
  ok(SKILL_IDS.every(k => mochi.skills[k] === 5), 'a fully trained resident keeps 5 stars in every skill, whatever its grades', SKILL_IDS.map(k => `${k} ${TL.gradeOf(mochi, k)}`).join(' '));
  const was = save.ranch.residents.find(x => x.name === 'Peaches').lesson;
  ok(JSON.stringify(peaches.lesson) === JSON.stringify(was) && JSON.stringify(plum.lesson) === JSON.stringify(save.ranch.residents.find(x => x.name === 'Plum').lesson), 'lessons in flight are kept exactly (skill, star, start, end, price)');
  const sim = new Sim(m);
  ok(sim.life.due(was.doneAt - 1).every(d => d.x !== peaches), 'Peaches\'s lesson is not done a moment early');
  const out = sim.life.passTime((was.doneAt + 1000 - (was.doneAt - 6 * H)) / 1000, was.doneAt + 1000);
  const r = out.done.find(d => d.name === 'Peaches');
  ok(r && r.star === 5 && peaches.skills.charm === 5 && r.at === was.doneAt && peaches.lesson === null, 'it finishes on time with its 5th Charm star, as it would have before talents');
  const caps = SKILL_IDS.map(k => [k, TL.starCap(mochi, k), sim.life.lessonFor(mochi, k)]);
  ok(caps.every(([, cap, l]) => (cap > 5 ? l && l.star === 6 && l.pearls === 80 : l === null)), 'the fully trained one: a 6th star only where its talent is A or S', caps.map(([k, cap, l]) => `${k} cap ${cap}${l ? ' next ' + l.star : ''}`).join(', '));
  // a broken Potential is repaired
  const bad = clone(save);
  bad.ranch.residents[0].potential = { bounce: 'x', speed: 9 };
  bad.slime.potential = 'nope';
  const mb = migrate(bad);
  ok(TL.validPotential(mb.ranch.residents[0].potential) && TL.validPotential(mb.slime.potential), 'a broken Potential (text, out of range) is repaired from its id / egg');
}

// ---------- 9. no numbers of its own ----------
{
  const code = fs.readFileSync(path.resolve(HERE, '../src/core/talents.js'), 'utf8').replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'|`[^`]*`/g, '').replace(/\b1e-9\b/g, '');
  const nums = [...code.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w])/g)].map(m => +m[1]);
  const stray = nums.filter(n => ![0, 1, 2, 50].includes(n));
  ok(stray.length === 0, 'core/talents.js has no tuning numbers of its own (0, 1, 2 for "both parents", 50 = the middle of a slider; 1e-9 rounding guard)', stray.join(',') || 'none');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
