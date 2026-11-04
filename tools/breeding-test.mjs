// Breeding rules check (plain node, no browser): inheritance caps, seeded eggs, family sparks and their
// recipes, near misses, Pure lines, the Nursery's cost / cooldown / egg slots, no farming, and old saves.
//   node tools/breeding-test.mjs            (add "verbose" to print every egg it checks)
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
const VERBOSE = process.argv.includes('verbose');
let rnd = 2024; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);

const { Sim, createState, migrate } = await import(SRC + '/core/sim.js');
const { Ranch, createRanch, dayNumber } = await import(SRC + '/core/ranch.js');
const B = await import(SRC + '/core/breeding.js');
const C = await import(SRC + '/data/content.js');
const { BREEDING, SPARK_FORMS, TRAIT_IDS, FORM_BY_ID } = C;

let fails = 0, passes = 0;
const ok = (cond, what, extra = '') => { if (cond) { passes++; console.log('ok   - ' + what + (extra ? ' | ' + extra : '')); } else { fails++; console.log('FAIL - ' + what + (extra ? ' | ' + extra : '')); } };
const fmtT = t => TRAIT_IDS.filter(k => (t[k] || 0) > 0.05).map(k => `${k} ${Math.round(t[k])}`).join(', ') || 'none';
const CAP = BREEDING.cap * BREEDING.range, TOTAL = BREEDING.totalCap * BREEDING.range;
const HOUR = 3600 * 1000;
const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);

// ---------- helpers: raise a slime with the real rules ----------
// diet: an array of foods, or { hatchling, sprout, rascal, settled } arrays per stage (cycled in order)
function raise(sim, diet) {
  const st = sim.s; st.phase = 'play'; st.slime.name = st.slime.name || 'Test';
  let i = 0, settled = null;
  for (let guard = 0; guard < 300000 && sim.stageIndex() < 3; guard++) {
    sim.tick(1);
    if (st.slime.tummy < 72) {
      const list = Array.isArray(diet) ? diet : diet[C.STAGES[sim.stageIndex()].id] || diet.hatchling;
      const pool = list.filter(f => sim.foodUnlocked(f));
      const r = sim.feed((pool.length ? pool : ['cookie'])[i++ % Math.max(1, pool.length)], { free: true });
      if (r.form) settled = r;
    }
  }
  return settled;
}
function grown(diet, name, id) {
  const st = createState(); st.slime.name = name;
  const sim = new Sim(st);
  raise(sim, diet);
  return { id, name, form: st.slime.form, traits: { ...st.slime.traits }, personality: { ...st.slime.personality }, favorite: st.slime.favorite, lineage: { ...st.slime.lineage } };
}
function babyFrom(egg, diet) {
  const st = createState(); st.slime.name = 'Baby';
  B.applyEgg(st.slime, egg);
  const start = { ...st.slime.traits };
  const sim = new Sim(st);
  const r = raise(sim, diet);
  return { st, sim, r, start };
}
const DIETS = {
  'sweet': ['cookie'],
  'heat': ['chili'],
  'mineral': ['iron'],
  'heat+sweet': ['cookie', 'chili'],
  'nature+sweet': { hatchling: ['cookie'], sprout: ['cookie', 'moss'], rascal: ['cookie', 'moss'], settled: ['cookie'] },
  'mineral+nature': ['iron', 'moss'],
  'heat+spark': ['chili', 'berry'],
  'mochi': ['cookie', 'chili', 'iron', 'moss', 'berry', 'crystal'],
  'heat+nature': { hatchling: ['chili'], sprout: ['chili', 'moss'], rascal: ['chili', 'moss'], settled: ['chili'] },
  'prism+spark': { hatchling: ['iron'], sprout: ['berry'], rascal: ['crystal', 'crystal', 'berry'], settled: ['crystal'] },
  'spark': { hatchling: ['iron'], sprout: ['berry'], rascal: ['berry'], settled: ['berry'] },
};
const parentOf = (formId, name, id) => {
  const p = grown(DIETS[formId], name, id);
  if (p.form.id !== formId) throw new Error(`test setup: diet for ${formId} gave ${p.form.id}`);
  return p;
};

// ---------- 0. the mature channel range the cap is based on ----------
console.log('\n# 0. Mature channel range (top trait at Settled, 13 diets, real rules)');
{
  const diets = [['cookie'], ['chili'], ['iron'], ['cookie', 'moss'], ['chili', 'berry'], ['iron', 'crystal'], ['moss', 'cookie'], ['berry', 'chili'],
    ['crystal', 'berry', 'cookie'], ['cookie', 'chili'], ['iron', 'moss'], ['crystal', 'berry'], ['cookie', 'chili', 'iron', 'moss', 'berry', 'crystal']];
  // five slimes per diet (each has its own hidden favorite snack, which changes how fast it grows)
  const tops = diets.flatMap(d => Array.from({ length: 5 }, () => { const p = grown(d, 'M', 'm'); return Math.max(...TRAIT_IDS.map(k => p.traits[k])); })).sort((a, b) => a - b);
  const median = tops[Math.floor(tops.length / 2)];
  console.log(`top channel at Settled over ${tops.length} slimes: min ${tops[0].toFixed(1)}, median ${median.toFixed(1)}, max ${tops[tops.length - 1].toFixed(1)}`);
  console.log(`BREEDING.range ${BREEDING.range}, cap ${BREEDING.cap} -> ${CAP.toFixed(1)} points per channel, total cap ${TOTAL.toFixed(1)} points`);
  ok(Math.abs(BREEDING.range - median) / median < 0.1, 'BREEDING.range is within 10% of the measured median', `range ${BREEDING.range} vs measured ${median.toFixed(1)}`);
  ok(BREEDING.cap >= 0.2 && BREEDING.cap <= 0.25, 'cap is 0.20-0.25 of the range (design doc)', String(BREEDING.cap));
}

// ---------- 1. caps hold ----------
console.log('\n# 1. Caps hold over many seeded pairs');
{
  let worst = 0, worstTotal = 0, n = 0, worstConc = 0;
  const randTraits = r => Object.fromEntries(TRAIT_IDS.map(k => [k, r() < 0.4 ? 0 : r() * 300]));
  let seed = 1;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ids = C.FORM_IDS;
  for (let i = 0; i < 3000; i++) {
    const conc = i % 3 === 0;   // every third pair: both parents already inherited a full cap in every channel
    const lin = conc ? { line: 3, bias: Object.fromEntries(TRAIT_IDS.map(k => [k, CAP])) } : null;
    const a = { id: 'a' + i, name: 'A', form: { id: ids[i % ids.length] }, traits: randTraits(r), personality: { curious: r() * 100, patient: r() * 100, playful: r() * 100, cuddly: r() * 100, bold: r() * 100 }, favorite: 'cookie', lineage: lin };
    const b = { id: 'b' + i, name: 'B', form: { id: ids[(i * 7) % ids.length] }, traits: randTraits(r), personality: { curious: 0, patient: 100, playful: 50, cuddly: 0, bold: 100 }, favorite: 'iron', lineage: lin };
    const e = B.makeEgg(a, b, { now: NOW + i, id: 'e' + i });
    const top = Math.max(...TRAIT_IDS.map(k => e.bias[k]));
    const tot = TRAIT_IDS.reduce((s, k) => s + Math.max(0, e.bias[k]), 0);
    worst = Math.max(worst, top); worstTotal = Math.max(worstTotal, tot);
    if (conc) worstConc = Math.max(worstConc, top);
    for (const id of C.PERSONALITY_IDS) if (Math.abs(e.personality[id]) > BREEDING.personalityCap + 1e-9) worst = Infinity;
    n++;
  }
  ok(worst <= CAP + 0.051, `no channel above the cap in ${n} eggs (and temperament nudges within ±${BREEDING.personalityCap})`, `largest ${worst.toFixed(1)} <= ${CAP.toFixed(1)}`);
  ok(worstTotal <= TOTAL + 0.31, `head start over all channels within the total cap`, `largest ${worstTotal.toFixed(1)} <= ${TOTAL.toFixed(1)}`);
  const concCap = CAP * (1 - BREEDING.regress);
  ok(worstConc <= concCap + 0.051, 'a line that keeps concentrating regresses (cap shrinks by the regress share)', `largest ${worstConc.toFixed(1)} <= ${concCap.toFixed(1)}`);
}

// ---------- 2. seeded eggs ----------
console.log('\n# 2. Same seed, same egg');
const hearth = parentOf('heat+sweet', 'Juniper', 'r-hearth');
const marsh = parentOf('mochi', 'Pebble', 'r-marsh');
{
  const e1 = B.makeEgg(hearth, marsh, { now: NOW, id: 'x' });
  const e2 = B.makeEgg(hearth, marsh, { now: NOW, id: 'x' });
  const e3 = B.makeEgg(marsh, hearth, { now: NOW, id: 'x' });
  const e4 = B.makeEgg(hearth, marsh, { now: NOW + 1, id: 'x' });
  ok(JSON.stringify(e1) === JSON.stringify(e2), 'the same parents at the same moment make the same egg');
  ok(JSON.stringify(e1) === JSON.stringify(e3), 'picking the parents the other way round makes the same egg');
  ok(JSON.stringify(e1.bias) !== JSON.stringify(e4.bias), 'another moment gives another seed (a different wobble)', `${fmtT(e1.bias)} vs ${fmtT(e4.bias)}`);
  if (VERBOSE) console.log(JSON.stringify(e1));
}

// ---------- 3 + 4. family sparks: recipe and near miss ----------
console.log('\n# 3. Each spark pair + its recipe -> the spark form; # 4. + another diet -> a normal form and a clue');
const RECIPE = { smore: DIETS['heat+sweet'], honeycomb: DIETS['nature+sweet'], campfire: DIETS['heat+nature'], storm: DIETS['prism+spark'] };
const OTHER = { smore: ['cookie'], honeycomb: ['iron'], campfire: ['cookie'], storm: ['cookie', 'chili'] };
for (const sp of SPARK_FORMS) {
  const [fa, fb] = sp.parents;
  const a = parentOf(fa, 'Mom', 'r-' + sp.id + '-a'), b = parentOf(fb, 'Dad', 'r-' + sp.id + '-b');
  const egg = B.makeEgg(a, b, { now: NOW, id: 'e-' + sp.id });
  ok(egg.spark === sp.id, `${FORM_BY_ID[fa].name} x ${FORM_BY_ID[fb].name} lays a spark egg (${sp.id})`, `head start ${fmtT(egg.bias)}`);
  const good = babyFrom(egg, RECIPE[sp.id]);
  ok(good.st.slime.form?.id === sp.look && good.st.slime.form?.spark === sp.id, `raised on the recipe (${sp.recipe.join(' + ')}) it becomes ${sp.name}`,
    `form ${good.st.slime.form?.name} | traits at Settled ${fmtT(good.st.slime.traits)}`);
  ok(good.st.ranch.sparks[sp.id] === 'understood', `the family now understands ${sp.name}`);
  const bad = babyFrom(egg, OTHER[sp.id]);
  ok(bad.st.slime.form && !bad.st.slime.form.spark && bad.r?.nearMiss?.spark === sp.id && bad.r.nearMiss.clue === sp.clue,
    `raised on ${OTHER[sp.id].join(' + ')} it settles into a normal form, with a near-miss clue`, `form ${bad.st.slime.form?.name} | clue "${bad.r?.nearMiss?.clue}"`);
  ok(bad.st.ranch.sparks[sp.id] === 'observed' && bad.st.ranch.nearMiss[sp.id] === 1, 'the near miss is recorded as observed');
}
{
  const notSpark = B.makeEgg(parentOf('sweet', 'A', 'r1'), parentOf('mineral', 'B', 'r2'), { now: NOW, id: 'n' });
  ok(notSpark.spark === null, 'a pair that is not a spark pair lays a normal egg (Candy x Iron)');
}

// ---------- 5. Pure lines ----------
console.log('\n# 5. Two same-form parents + that form\'s diet -> Pure');
for (const f of ['sweet', 'heat', 'mineral', 'heat+sweet', 'nature+sweet', 'mineral+nature', 'heat+spark', 'mochi']) {
  const a = parentOf(f, 'A', 'p-' + f + '-a'), b = parentOf(f, 'B', 'p-' + f + '-b');
  const egg = B.makeEgg(a, b, { now: NOW, id: 'pe-' + f });
  const kid = babyFrom(egg, DIETS[f]);
  const form = kid.st.slime.form;
  ok(egg.pure === f && form?.pure === true && form.id === f && form.name === 'Pure ' + FORM_BY_ID[f].name && kid.st.ranch.pures.includes(f),
    `${FORM_BY_ID[f].name} x ${FORM_BY_ID[f].name} raised the same way -> ${form?.name}`);
}
{
  const a = parentOf('sweet', 'A', 'q1'), b = parentOf('sweet', 'B', 'q2');
  const kid = babyFrom(B.makeEgg(a, b, { now: NOW, id: 'q' }), ['cookie', 'chili']);
  ok(!kid.st.slime.form.pure && kid.r.pureMiss === 'sweet', 'Candy x Candy raised on cookie + chili is a normal (not Pure) form', kid.st.slime.form.name);
}

// ---------- 6. care dominates ----------
console.log('\n# 6. Care dominates: a baby of two Candy Slimes fed only Iron Scrap');
{
  const a = parentOf('sweet', 'Sugar', 'c1'), b = parentOf('sweet', 'Sprinkle', 'c2');
  const egg = B.makeEgg(a, b, { now: NOW, id: 'cd' });
  const kid = babyFrom(egg, ['iron']);
  const t = kid.st.slime.traits;
  const top = TRAIT_IDS.reduce((m, k) => (t[k] > t[m] ? k : m), 'sweet');
  ok(top === 'mineral', 'Sturdy is its top trait', `started with ${fmtT(kid.start)}, settled with ${fmtT(t)}`);
  ok(kid.st.slime.form.id !== 'sweet' && !kid.st.slime.form.pure, 'it does not become a (Pure) Candy Slime', `it became ${kid.st.slime.form.name}`);
  // and the strongest possible head start still leaves the lightest diet its own form
  const worst = { traits: Object.fromEntries(TRAIT_IDS.map(k => [k, k === 'mineral' ? 0 : 1])), lineage: { bias: null } };
  const top2 = B.makeEgg({ ...worst, id: 'w1', name: 'W', form: { id: 'mochi' } }, { ...worst, id: 'w2', name: 'V', form: { id: 'mochi' } }, { now: NOW, id: 'w' });
  const kid2 = babyFrom(top2, ['iron']);
  ok(kid2.st.slime.form.id === 'mineral', 'even a full head start in every other channel still lets Iron Scrap give an Iron Slime', `start ${fmtT(kid2.start)} -> ${kid2.st.slime.form.name}`);
}

// ---------- 7. the Nursery: cost, cooldown, egg slots, timer ----------
console.log('\n# 7. Cost, cooldown and egg slots are enforced');
{
  const st = createState();
  const sim = new Sim(st);
  const R = st.ranch, rr = sim.ranch;
  R.slots = 5;
  R.residents.push({ ...hearth, id: 'h' }, { ...marsh, id: 'm' }, { ...parentOf('sweet', 'Candy', 'c'), id: 'c' }, { ...parentOf('mineral', 'Iron', 'i'), id: 'i' });
  R.pearls = 60;
  ok(rr.canBreed('h', 'h', NOW).reason === 'same', 'a slime cannot breed with itself');
  const r1 = rr.breed('h', 'm', NOW);
  ok(!!r1 && R.pearls === 60 - BREEDING.cost && rr.eggs().length === 1 && r1.egg.spark === 'smore', `an egg costs ${BREEDING.cost} pearls`, `pearls ${R.pearls}, eggs ${rr.eggs().length}`);
  ok(rr.canBreed('h', 'c', NOW + HOUR).reason === 'resting', 'a parent rests for the rest of the day', JSON.stringify(rr.canBreed('h', 'c', NOW + HOUR)));
  ok(rr.canBreed('c', 'i', NOW + HOUR).ok, 'two other residents can still make an egg today');
  const r2 = rr.breed('c', 'i', NOW + HOUR);
  ok(!!r2 && R.pearls === 60 - 2 * BREEDING.cost, 'second egg paid');
  const tomorrow = NOW + 26 * HOUR;
  ok(dayNumber(tomorrow) !== dayNumber(NOW), '(test clock moved to the next day)');
  ok(rr.canBreed('h', 'c', tomorrow).reason === 'full', `at most ${BREEDING.maxEggs} eggs wait in the Nursery`);
  ok(rr.takeEgg(r1.egg.id, NOW + HOUR - 1000) === null, `an egg is not ready before ${BREEDING.readyHours} hour(s)`);
  ok(rr.eggReady(r1.egg, NOW + BREEDING.readyHours * HOUR), 'ready after the timer (wall clock, so it counts while the game is closed)');
  rr.giveEgg(r2.egg.id);
  ok(rr.eggs().length === 1 && R.pearls === 60 - 2 * BREEDING.cost && R.nursery.given === 1, 'giving an egg to a neighbor frees its spot and gives no pearls back');
  ok(rr.canBreed('h', 'c', tomorrow).reason === 'pearls', `needs ${BREEDING.cost} pearls`, `pearls ${R.pearls}`);
  R.pearls = 100;
  ok(rr.canBreed('h', 'c', tomorrow).ok, 'the next day, with pearls, the first parent can breed again');
  // moving out with an egg that is not ready changes nothing
  raise(sim, ['cookie']);
  const before = JSON.stringify(st);
  const early = sim.moveToRanch(NOW + 0.5 * HOUR, { eggId: r1.egg.id });
  ok(early === null && JSON.stringify(st) === before, 'moving out with an egg that is not ready yet is refused and changes nothing');
  const moved = sim.moveToRanch(NOW + 2 * HOUR, { eggId: r1.egg.id });
  ok(!!moved && st.phase === 'egg' && st.slime.lineage.spark === 'smore' && st.slime.lineage.parents.map(p => p.name).join(' & ') === 'Juniper & Pebble' && rr.eggs().length === 0,
    'moving out with a ready egg starts the next generation from it', `new baby: line ${st.slime.lineage.line}, parents ${st.slime.lineage.parents.map(p => p.name + ' (' + p.form.name + ')').join(' x ')}, head start ${fmtT(st.slime.traits)}`);
  ok(moved.resident.lineage && moved.resident.lineage.line === 1 && Array.isArray(moved.resident.lineage.parents), 'the resident that moved out keeps its own lineage record');
}

// ---------- 8. no farming, no rewards yet ----------
console.log('\n# 8. Breeding is not a way to farm pearls or jelly; spark and Pure slimes are valued like any resident');
{
  const st = createState(); const sim = new Sim(st); const rr = sim.ranch;
  const twin = (form, extra = {}) => ({ id: 'z' + Math.random(), name: 'Z', form, traits: { sweet: 120, heat: 110 }, bondLevel: 4, runTotal: 3e9, jps: 400, happiness: 80, lineage: B.emptyLineage(), ...extra });
  const plain = twin({ id: 'heat+sweet', name: 'Hearth Slime' });
  const spark = twin({ id: 'spark:smore', name: "S'more Slime", spark: 'smore' });
  const pure = twin({ id: 'heat+sweet', name: 'Pure Hearth Slime', pure: true });
  ok(rr.value(plain) === rr.value(spark) && rr.value(plain) === rr.value(pure), 'spark and Pure slimes are worth the same as a normal one (rewards come later)', `value ${rr.value(plain).toFixed(1)}`);
  let fitOk = true;
  for (const b of C.BUYERS) { const f = rr.fit(spark, b); if (!Number.isFinite(f) || f !== rr.fit(plain, b)) fitOk = false; }
  ok(fitOk, 'buyer fit works on spark ids (same as the same traits on a normal form)');
  ok(rr.offers(spark, NOW).length === 3 && rr.auction(spark, NOW).winner, 'offers and auctions work for a spark resident');
  ok(rr.pearlRate(spark) === rr.pearlRate(plain), 'pearls per hour are the same');
  st.ranch.residents.push(plain, spark); st.ranch.pearls = 25;
  const jelly0 = st.jelly, jps0 = sim.jps();
  rr.breed(plain.id, spark.id, NOW);
  ok(st.ranch.pearls === 0 && st.jelly === jelly0 && sim.jps() === jps0, 'making an egg only costs pearls: no jelly, no pearls, no jelly per second come out of it');
}

// ---------- 9. old saves ----------
console.log('\n# 9. Old saves (made with the code on main) load and play');
for (const f of ['main-egg', 'main-settled', 'main-gen2', 'main-gen3']) {
  const fx = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', f + '.json'), 'utf8'));
  const raw = JSON.parse(JSON.stringify(fx.save));
  const st = migrate(raw);
  const keep = ['phase', 'jelly', 'totalJelly'].every(k => JSON.stringify(st[k]) === JSON.stringify(fx.save[k])) &&
    JSON.stringify(st.slime.traits) === JSON.stringify(fx.save.slime.traits) && st.slime.name === fx.save.slime.name &&
    st.ranch.residents.length === fx.save.ranch.residents.length && st.ranch.pearls === fx.save.ranch.pearls &&
    JSON.stringify(st.slime.form) === JSON.stringify(fx.save.slime.form) &&
    st.ranch.residents.every((x, i) => x.name === fx.save.ranch.residents[i].name && JSON.stringify(x.traits) === JSON.stringify(fx.save.ranch.residents[i].traits));
  let sim, err = null;
  try { sim = new Sim(st); sim.tick(1); JSON.parse(JSON.stringify(st)); } catch (e) { err = e; }
  ok(!err && keep && st.slime.lineage.line === 1 && Array.isArray(st.ranch.nursery.eggs) && st.ranch.residents.every(x => x.lineage && x.lineage.line === 1),
    `${f} (${fx.madeWith}) loads: nothing lost, lineage and Nursery filled in`, err ? err.message : `phase ${st.phase}, generation ${st.ranch.family.generation}, residents ${st.ranch.residents.map(x => x.name).join(', ') || 'none'}`);
  if (f === 'main-gen3') {
    const [a, b] = st.ranch.residents;
    const now = fx.save.savedAt + 1000;
    const r = sim.ranch.breed(a.id, b.id, now);
    ok(!!r && r.egg.spark === 'smore', `the old residents (${a.form.name} and ${b.form.name}) can make a spark egg`, `pearls left ${st.ranch.pearls}`);
    st.slime.name = 'Hazel';
    raise(sim, ['cookie']);
    const m = sim.moveToRanch(now + 2 * HOUR, { eggId: r.egg.id });
    const baby = new Sim(st);
    raise(baby, RECIPE.smore);
    ok(!!m && st.slime.form.id === 'spark:smore', 'and their baby, raised on the recipe, becomes a S\'more Slime', `generation ${st.ranch.family.generation}, ${st.slime.form.name}`);
    const again = migrate(JSON.parse(JSON.stringify(st)));
    ok(JSON.stringify(again.slime.lineage) === JSON.stringify(st.slime.lineage) && again.ranch.residents.length === 3, 'a save with breeding data loads again unchanged');
  }
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
