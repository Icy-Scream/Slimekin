// Jelly loop rules check (plain node, no browser): the Family Legacy bonus rule and its migration (every fixture save,
// saves made just before the jelly loop, a RUSHED save with a big old bonus), slime medals and their ranch perks,
// every heirloom effect, and the Moving Day ratio, levels and signs.
//   node tools/jelly-loop-test.mjs
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
let rnd = 777; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);

const { Sim, createState, migrate } = await import(SRC + '/core/sim.js');
const { Ranch, familyBonusFor, legacyFor } = await import(SRC + '/core/ranch.js');
const { medalFor, residentMedal, nextMedal } = await import(SRC + '/core/medals.js');
const { movingDayRatio, movingDayLevel, movingDaySign } = await import(SRC + '/core/movingday.js');
const C = await import(SRC + '/data/content.js');
const { RANCH, MEDALS, HEIRLOOMS, HEIRLOOM_BY_ID, MOVING_DAY, STAGES, BREEDING, PERSONALITY_IDS } = C;

let fails = 0, passes = 0;
const ok = (cond, what, extra = '') => { if (cond) { passes++; console.log('ok   - ' + what + (extra ? ' | ' + extra : '')); } else { fails++; console.log('FAIL - ' + what + (extra ? ' | ' + extra : '')); } };
const near = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
const HOUR = 3600 * 1000;
const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);
const clone = o => JSON.parse(JSON.stringify(o));
// every number anywhere in a save must be finite
const nanPaths = (o, p = '', out = []) => {
  if (typeof o === 'number') { if (!Number.isFinite(o)) out.push(p); }
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) nanPaths(v, p + '.' + k, out);
  return out;
};
const lastStage = STAGES[STAGES.length - 1];
// a Settled slime that made `total` jelly, being raised
function settled(st, total, name = 'Test') {
  st.phase = 'play'; st.slime.name = name; st.slime.growth = lastStage.minGrowth + 1;
  st.totalJelly = total; st.jelly = Math.min(total, 1e6);
  return st;
}
const fresh = () => { const st = createState(); return { st, sim: new Sim(st) }; };

// ---------- 1. Family Legacy: the rule ----------
console.log('\n# Family Legacy: the rule');
ok(near(familyBonusFor(1e7), 5) && near(familyBonusFor(8e7), 10) && familyBonusFor(0) === 0 && familyBonusFor(-5) === 0,
  'familyBonusFor(total) = 5 * cbrt(total / 1e7) (RANCH.bonusPercent / bonusJelly)', `1e7 -> ${familyBonusFor(1e7)}, 8e7 -> ${familyBonusFor(8e7)}`);
{
  const { st, sim } = fresh();
  const totals = [2e9, 5e7, 4e11, 1e6, 3e10, 0];
  let life = 0, prev = 0, monotone = true, exact = true;
  for (const [i, T] of totals.entries()) {
    settled(st, T, 'S' + i);
    const pv = sim.moveOutPreview();
    if (sim.ranch.free() <= 0) { const x = st.ranch.residents[0]; sim.ranch.place(x.id, sim.ranch.offers(x, NOW)[0].buyer, NOW); }
    const r = sim.moveToRanch(NOW + i * HOUR);
    life += T;
    const f = st.ranch.family;
    if (!(f.bonus >= prev)) monotone = false;
    if (!near(f.bonus, familyBonusFor(life)) || !near(r.bonusAfter, pv.bonusAfter) || !near(r.bonus, r.bonusAfter - r.bonusBefore)) exact = false;
    prev = f.bonus;
    st.phase = 'play'; st.slime.name = 'next';
  }
  ok(exact, 'each move-out: bonus = familyBonusFor(lifetime + legacy), and the preview says exactly what happens', `lifetime ${life.toExponential(3)} -> ${st.ranch.family.bonus.toFixed(3)}%`);
  ok(monotone, 'the Family Bonus never goes down across move-outs (even after a slime that made 0 jelly)');
  ok(st.ranch.family.generation === 7, 'generation counts every move-out', `generation ${st.ranch.family.generation}`);
}
{
  // the old rule rewarded rushing; the new one rewards the family's total, however it is split
  const one = familyBonusFor(6e9), six = familyBonusFor(6 * 1e9), sumOld = 6 * familyBonusFor(1e9);
  ok(near(one, six) && sumOld > one, 'one slime making 6B = six slimes making 1B each (the old rule paid the six more)', `new ${one.toFixed(1)}% vs old sum ${sumOld.toFixed(1)}%`);
}
{
  // preview fields
  const { st, sim } = fresh();
  st.ranch.family.bonus = 20; st.ranch.family.lifetime = 1e9; st.ranch.family.legacy = legacyFor(20, 1e9);
  settled(st, 5e10);
  const pv = sim.moveOutPreview();
  ok(near(pv.bonusNow, 20) && near(pv.bonusAfter, familyBonusFor(1e9 + st.ranch.family.legacy + 5e10)) && near(pv.bonus, pv.bonusAfter - pv.bonusNow),
    'moveOutPreview: bonusNow, bonusAfter, and bonus = the increase', `now ${pv.bonusNow.toFixed(2)} -> after ${pv.bonusAfter.toFixed(2)} (+${pv.bonus.toFixed(2)})`);
}
{
  // a baby's new home: no bonus, its jelly still counts toward the lifetime
  const { st, sim } = fresh();
  st.phase = 'play'; st.slime.name = 'Baby'; st.totalJelly = 3e8;
  const before = clone(st.ranch.family);
  const r = sim.rehomeBaby(NOW);
  const f = st.ranch.family;
  ok(r && f.bonus === before.bonus && near(f.lifetime, before.lifetime + 3e8) && f.generation === before.generation,
    "a baby's new home: no bonus now, its jelly counts in the lifetime (raises the next move-out's bonus)", `bonus ${f.bonus}, lifetime ${f.lifetime.toExponential(2)}`);
}

// ---------- 2. Family Legacy: migration ----------
console.log('\n# Family Legacy: old saves');
const FIX = path.resolve(HERE, 'fixtures');
const fixtures = fs.readdirSync(FIX).filter(f => f.endsWith('.json')).sort();
ok(fixtures.includes('pre-jelly-rushed.json') && fixtures.includes('pre-jelly-gen2.json') && fixtures.includes('moving-day-almost.json'),
  'fixtures present: saves from main, from just before the jelly loop (828f3b9: normal and RUSHED), the Moving Day tester', fixtures.join(', '));
for (const f of fixtures) {
  const raw = JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8')).save;
  const old = clone(raw.ranch?.family || { bonus: 0, generation: 1, lifetime: 0 });
  const m1 = migrate(clone(raw));
  const m2 = migrate(clone(m1));
  const fam = m1.ranch.family;
  const nan = nanPaths(m1);
  const legacyOk = 'legacy' in old ? near(fam.legacy, old.legacy)
    : old.bonus > familyBonusFor(old.lifetime) ? near(fam.legacy, 1e7 * Math.pow(old.bonus / 5, 3) - old.lifetime) : fam.legacy === 0;
  ok(fam.bonus >= old.bonus && near(fam.bonus, old.bonus), `${f}: Family Bonus kept exactly`, `${old.bonus.toFixed(4)}% -> ${fam.bonus.toFixed(4)}%`);
  ok(legacyOk && (fam.legacy === 0 || near(familyBonusFor(fam.lifetime + fam.legacy), fam.bonus, 1e-9)),
    `${f}: legacy correct (familyBonusFor(lifetime + legacy) reproduces the bonus)`, `legacy ${fam.legacy.toExponential(4)}, lifetime ${fam.lifetime.toExponential(3)}`);
  ok(JSON.stringify(m1) === JSON.stringify(m2), `${f}: migrating again changes nothing (idempotent)`);
  ok(nan.length === 0, `${f}: no NaN or Infinity anywhere after migrating`, nan.slice(0, 3).join(', '));
  // the next move-out never lowers it
  const sim = new Sim(m1);
  const st = m1;
  if (st.phase === 'play' || st.phase === 'egg') {
    settled(st, 0, 'Zero');
    if (sim.ranch.free() <= 0) { const x = st.ranch.residents[0]; sim.ranch.place(x.id, sim.ranch.offers(x, NOW)[0].buyer, NOW); }
    const r = sim.moveToRanch(NOW);
    ok(r && st.ranch.family.bonus >= old.bonus - 1e-9, `${f}: a move-out right after (a slime with 0 jelly) keeps the bonus`, `${old.bonus.toFixed(3)}% -> ${st.ranch.family.bonus.toFixed(3)}%`);
  }
}
{
  const raw = JSON.parse(fs.readFileSync(path.join(FIX, 'pre-jelly-rushed.json'), 'utf8')).save;
  const m = migrate(clone(raw)), f = m.ranch.family;
  ok(raw.ranch.family.bonus > familyBonusFor(raw.ranch.family.lifetime) * 2 && f.legacy > 10 * f.lifetime,
    'the RUSHED save: its old bonus is far above what its lifetime gives, so a big hidden legacy keeps it',
    `old ${raw.ranch.family.bonus.toFixed(2)}% vs lifetime alone ${familyBonusFor(raw.ranch.family.lifetime).toFixed(2)}%; legacy ${f.legacy.toExponential(3)}`);
  const sim = new Sim(m);
  settled(m, 1e10, 'Next');
  const pv = sim.moveOutPreview();
  ok(pv.bonusAfter > pv.bonusNow && near(pv.bonusAfter, familyBonusFor(f.lifetime + f.legacy + 1e10)),
    'the RUSHED save: the next slime still raises the bonus, from where it was', `${pv.bonusNow.toFixed(2)}% -> ${pv.bonusAfter.toFixed(2)}%`);
}
{
  // broken values are cleaned, never NaN
  const st = createState();
  st.ranch.family = { bonus: 'x', generation: 3, lifetime: -5 };
  const m = migrate(clone(st));
  ok(Number.isFinite(m.ranch.family.bonus) && m.ranch.family.lifetime >= 0 && Number.isFinite(m.ranch.family.legacy), 'a broken family record migrates to finite numbers', JSON.stringify(m.ranch.family));
}

// ---------- 3. Medals ----------
console.log('\n# Medals');
{
  ok(MEDALS.length === 9 && MEDALS[0].id === 'ribbon' && MEDALS[8].id === 'nova', 'nine medals, Ribbon to Nova', MEDALS.map(m => m.icon + ' ' + m.id).join(' '));
  const want = [[0, 'ribbon'], [1e9 - 1, 'ribbon'], [1e9, 'bronze'], [1e10, 'silver'], [1e11, 'gold'], [1e12, 'platinum'], [1e13, 'emerald'], [1e14, 'diamond'], [1e15, 'obsidian'], [1e16, 'nova'], [1e20, 'nova']];
  const got = want.map(([j]) => medalFor(j, true)?.id);
  ok(want.every(([, id], i) => got[i] === id), 'medalFor: each step at 1B, 10B ... 10Q (the slime\'s own jelly)', got.join(', '));
  ok(medalFor(1e12, false) === null, 'no medal before the slime is grown up (Settled)');
  const perks = MEDALS.map(m => `${m.pearls}/${Math.round(m.offers * 100)}`).join(' ');
  ok(perks === '1/0 1.1/5 1.2/10 1.35/20 1.5/30 1.75/45 2/60 2.5/80 3/100', 'perks: pearls x1 ... x3, offers +0% ... +100%', perks);
  ok(nextMedal(MEDALS[0])?.id === 'bronze' && nextMedal(MEDALS[8]) === null, 'nextMedal');
  // sim: medal only while Settled
  const { st, sim } = fresh();
  st.phase = 'play'; st.totalJelly = 5e11;
  ok(sim.medal() === null, 'the raised slime: no medal while still growing');
  settled(st, 5e11);
  ok(sim.medal()?.id === 'gold', 'the raised slime: Gold at 500B once Settled');
  // ceremonies: once per medal per slime
  st.slime.medalShown = null;
  const first = sim.takeNewMedals().map(m => m.id), again = sim.takeNewMedals();
  ok(first.join(',') === 'ribbon,bronze,silver,gold' && again.length === 0 && st.slime.medalShown === 'gold',
    'medals crossed at once: one ceremony (the newest, shown by the game) with a Journal line each; once (stored on the slime)', `first ${first}, again ${again.length}`);
  st.totalJelly = 2e12;
  ok(sim.takeNewMedals().map(m => m.id).join(',') === 'platinum', 'crossing the next step: one more ceremony');
  // not inherited
  sim.moveToRanch(NOW);
  ok(st.slime.medalShown === null && sim.medal() === null, 'never inherited: the next egg starts with no medal');
  const x = st.ranch.residents[0];
  ok(residentMedal(x)?.id === 'platinum', "a resident's medal comes from its runTotal (nothing new saved)", `runTotal ${x.runTotal.toExponential(2)}`);
  // old saves: no old ceremony replays
  const raw = JSON.parse(fs.readFileSync(path.join(FIX, 'main-settled.json'), 'utf8')).save;
  const m = migrate(clone(raw));
  const s2 = new Sim(m);
  ok(m.slime.medalShown === s2.medal()?.id && s2.takeNewMedals().length === 0, 'main-settled.json: the current medal counts as shown (no ceremony on load)', `medalShown ${m.slime.medalShown}`);
}
{
  // ranch perks: pearls, offers, auctions
  const { st, sim } = fresh();
  const rr = sim.ranch;
  const mk = (id, runTotal) => ({ id, name: id, form: 'jelly', traits: Object.fromEntries(C.TRAIT_IDS.map(k => [k, 0])), personality: Object.fromEntries(PERSONALITY_IDS.map(k => [k, 50])),
    jps: 1, runTotal, bondLevel: 2, happiness: 80, pearlT: 0, arrivedAt: NOW, lastPet: 0, generation: 1 });
  const ribbon = mk('rib', 5e6), gold = mk('gld', 2e11), nova = mk('nov', 5e16);
  st.ranch.residents.push(ribbon, gold, nova);
  const base = rr.happyMult(ribbon) * (1 + 0.05 * 2) / (RANCH.pearlMinutes * 60);
  ok(near(rr.pearlRate(ribbon), base) && near(rr.pearlRate(gold), base * 1.35) && near(rr.pearlRate(nova), base * 3), 'pearls per hour x the medal (Ribbon x1, Gold x1.35, Nova x3)',
    [ribbon, gold, nova].map(x => (rr.pearlRate(x) * 3600).toFixed(3)).join(' / '));
  // offers: the same resident with the perk switched off, then on (same dice, so the same buyers); pearls scaled
  const realMult = rr.offerMult.bind(rr);
  rr.offerMult = () => 1;
  const oa = rr.offers(gold, NOW), aa = rr.auction(gold, NOW);
  rr.offerMult = realMult;
  const ob = rr.offers(gold, NOW), ab = rr.auction(gold, NOW);
  ok(oa.every((o, i) => o.buyer === ob[i].buyer && Math.abs(ob[i].pearls - Math.round(o.pearls * 1.2)) <= 1), 'offers: the same buyers, pearls x (1 + offer bonus) (Gold +20%)',
    oa.map((o, i) => `${o.pearls}->${ob[i].pearls}`).join(', '));
  ok(aa.winner?.buyer === ab.winner?.buyer && aa.steps.length === ab.steps.length && Math.abs(ab.price - Math.round(aa.price * 1.2)) <= 1 && ab.opening === Math.round(aa.opening * 1.2),
    'auction: the same bidding, every price x 1.2 (Gold)', `price ${aa.price} -> ${ab.price}, ${aa.steps.length} steps`);
}

// ---------- 4. Heirlooms ----------
console.log('\n# Heirlooms');
{
  const exp = [['toybox', 1e7], ['cookietin', 1e8], ['clover', 1e9], ['jarlid', 1e10], ['lanterns', 1e11], ['quilt', 1e12], ['portrait', 1e13], ['statue', 1e14], ['wishstar', 1e15]];
  ok(HEIRLOOMS.length === 9 && exp.every(([id, p], i) => HEIRLOOMS[i].id === id && HEIRLOOMS[i].price === p && HEIRLOOMS[i].where && HEIRLOOMS[i].effect && HEIRLOOMS[i].icon),
    'nine heirlooms, 10M to 1Q, each with an icon, an effect and where it lives', HEIRLOOMS.map(h => h.icon).join(' '));
  const { st, sim } = fresh();
  settled(st, 2e15); st.jelly = 2e15;
  const ws = sim.canBuyHeirloom('wishstar');
  // (recipe body, slice B1: the Wishing Star got its real effect, rare eggs x2, and is for sale like the others)
  ok(ws.ok && HEIRLOOM_BY_ID.wishstar.buyable !== false && HEIRLOOM_BY_ID.wishstar.fx.rareEggs === 2 && !st.heirlooms.owned.includes('wishstar'), 'Wishing Star: for sale, with its real effect (rare eggs x2)');
  ok(HEIRLOOMS.filter(h => h.buyable !== false).every(h => Object.keys(h.fx).length > 0), 'every heirloom you can buy has a real effect');
  // buying: spends jelly only
  const fam = clone(st.ranch.family), tj = st.totalJelly, j0 = st.jelly;
  const pv0 = sim.moveOutPreview();
  const r = sim.buyHeirloom('toybox');
  ok(r && st.jelly === j0 - 1e7 && st.totalJelly === tj && JSON.stringify(st.ranch.family) === JSON.stringify(fam) && near(sim.moveOutPreview().bonusAfter, pv0.bonusAfter),
    'buying spends jelly and never changes totalJelly, the lifetime or the Family Bonus (now or after)');
  ok(sim.buyHeirloom('toybox') === null && sim.canBuyHeirloom('toybox').reason === 'owned', 'each heirloom is bought once');
  const poor = fresh(); settled(poor.st, 1e6); poor.st.jelly = 5e6;
  ok(poor.sim.canBuyHeirloom('toybox').reason === 'poor' && poor.sim.buyHeirloom('toybox') === null && poor.st.jelly === 5e6, 'not enough jelly: refused, nothing spent');
  // the glow: newly affordable, once
  const g = fresh(); settled(g.st, 1e8); g.st.jelly = 2e7;
  const na = g.sim.newlyAffordableHeirlooms().map(h => h.id);
  g.sim.markHeirloomsSeen();
  ok(na.join(',') === 'toybox' && g.sim.newlyAffordableHeirlooms().length === 0, 'the chest glows for a newly affordable heirloom until the page is seen', na.join(','));
  g.st.jelly = 2e8;
  ok(g.sim.newlyAffordableHeirlooms().map(h => h.id).join(',') === 'cookietin', '... and again for the next one');
}
{
  // every effect
  const own = (st, ...ids) => { st.heirlooms.owned.push(...ids); };
  // Cookie Tin
  let { st, sim } = fresh(); settled(st, 1e9);
  const p0 = sim.foodPrice('crystal'); own(st, 'cookietin'); const p1 = sim.foodPrice('crystal');
  ok(p1 === Math.ceil(C.FOOD_BY_ID.crystal.price * sim.stage().foodCost * 0.8), "Grandma's Cookie Tin: snacks x0.8", `${p0} -> ${p1}`);
  // Clover
  ({ st, sim } = fresh()); settled(st, 1e9); sim.recompute();
  const g0 = sim.fx.glimmerMult; own(st, 'clover'); sim.recompute();
  ok(near(sim.fx.glimmerMult, g0 * 2), 'Pressed Clover: Glimmer reward x2 (fx.glimmerMult)', `${g0} -> ${sim.fx.glimmerMult}`);
  // Toy Box + Jar Lid at move-out
  ({ st, sim } = fresh()); settled(st, 1e10); st.jar.level = 3; st.jar.stored = 12345; own(st, 'toybox', 'jarlid');
  sim.moveToRanch(NOW);
  ok(st.helpers.feather === 10 && st.helpers.bubbles === 5 && Object.entries(st.helpers).every(([k, n]) => ['feather', 'bubbles'].includes(k) || n === 0),
    'Toy Box: the next slime starts with 10 Tickle Feathers and 5 Bubble Wands', JSON.stringify(st.helpers));
  ok(st.jar.level === 3 && st.jar.stored === 0, 'Golden Jar Lid: the jar keeps its size at move-out (what is inside starts over)', JSON.stringify(st.jar));
  // ... and at a baby's new home; without the lid the jar starts over
  st.phase = 'play'; st.slime.name = 'Baby'; st.jar.stored = 99;
  sim.rehomeBaby(NOW + HOUR);
  ok(st.jar.level === 3 && st.helpers.feather === 10 && st.heirlooms.owned.join(',') === 'toybox,jarlid', "a baby's new home: heirlooms stay, the lid keeps the jar, the Toy Box fills the helpers");
  ({ st, sim } = fresh()); settled(st, 1e10); st.jar.level = 3;
  sim.moveToRanch(NOW);
  ok(st.jar.level === 0 && st.helpers.feather === 0, 'without heirlooms: the jar and helpers start over as before');
  // Lanterns + Statue + medal: multiply
  ({ st, sim } = fresh());
  settled(st, 2e11); sim.moveToRanch(NOW);
  const x = st.ranch.residents[0], rr = sim.ranch;
  const pr0 = rr.pearlRate(x), of0 = rr.offers(x, NOW), au0 = rr.auction(x, NOW);
  own(st, 'lanterns', 'statue');
  ok(near(rr.pearlRate(x), pr0 * 1.25), 'Ranch Lanterns: pearls x1.25, multiplied with the medal (Gold x1.35)', `${(pr0 * 3600).toFixed(3)} -> ${(rr.pearlRate(x) * 3600).toFixed(3)} /h`);
  const of1 = rr.offers(x, NOW), au1 = rr.auction(x, NOW);
  ok(near(rr.offerMult(x), 1.2 * 1.25) && of1.every((o, i) => o.buyer === of0[i].buyer && o.pearls > of0[i].pearls) && au1.price > au0.price,
    'Family Statue: offers and auction prices x1.25, multiplied with the medal (+20%)', `offers ${of0.map(o => o.pearls)} -> ${of1.map(o => o.pearls)}; auction ${au0.price} -> ${au1.price}`);
  // Portrait: live and closed
  x.happiness = 80;
  rr.tick(3600); const live0 = 80 - x.happiness;
  x.happiness = 80; rr.tickAway(3600); const away0 = 80 - x.happiness;
  own(st, 'portrait');
  x.happiness = 80; rr.tick(3600); const live1 = 80 - x.happiness;
  x.happiness = 80; rr.tickAway(3600); const away1 = 80 - x.happiness;
  ok(near(live1, live0 / 2) && near(away1, away0 / 2) && near(live0, RANCH.happyDecayPerHour), 'Family Portrait: ranch happiness fades half as fast, live and while closed',
    `per hour live ${live0.toFixed(2)} -> ${live1.toFixed(2)}, closed ${away0.toFixed(2)} -> ${away1.toFixed(2)}`);
  // Quilt: new Nursery eggs
  const a = { ...x, id: 'pa', bredDay: -1 }, b = { ...x, id: 'pb', bredDay: -1 };
  st.ranch.residents = [a, b]; st.ranch.pearls = 1000;
  const e0 = rr.breed('pa', 'pb', NOW).egg;
  a.bredDay = b.bredDay = -1;
  own(st, 'quilt');
  const e1 = rr.breed('pa', 'pb', NOW).egg;
  ok(e0.readyAt - e0.laidAt === BREEDING.readyHours * HOUR && e1.readyAt - e1.laidAt === BREEDING.readyHours * HOUR / 2 && rr.eggWarmSeconds(e1) === BREEDING.readyHours * 1800 && rr.newEggSeconds() === BREEDING.readyHours * 1800,
    'Patchwork Quilt: new Nursery eggs warm in half the time (eggs already warming keep theirs)', `${(e0.readyAt - e0.laidAt) / HOUR} h -> ${(e1.readyAt - e1.laidAt) / HOUR} h`);
  ok(rr.eggWarmSeconds(e0) === BREEDING.readyHours * 3600, 'an egg made before the Quilt keeps its own warming time');
}
{
  // heirlooms survive move-outs, rehomes and saving
  const { st, sim } = fresh(); settled(st, 1e12); st.jelly = 1e12;
  for (const id of ['toybox', 'cookietin', 'clover', 'jarlid']) sim.buyHeirloom(id);
  sim.moveToRanch(NOW);
  st.phase = 'play'; st.slime.name = 'B';
  sim.rehomeBaby(NOW + HOUR);
  const m = migrate(clone(st));
  ok(m.heirlooms.owned.join(',') === 'toybox,cookietin,clover,jarlid', 'owned heirlooms survive a move-out, a baby rehome and a reload', m.heirlooms.owned.join(','));
  const bad = migrate({ ...clone(st), heirlooms: { owned: ['toybox', 'nope', 'toybox'], seen: 'x' } });
  ok(bad.heirlooms.owned.join(',') === 'toybox' && Array.isArray(bad.heirlooms.seen), 'unknown or repeated heirloom ids are dropped on load');
  const old = migrate(JSON.parse(fs.readFileSync(path.join(FIX, 'main-gen3.json'), 'utf8')).save);
  ok(Array.isArray(old.heirlooms.owned) && old.heirlooms.owned.length === 0, 'old saves start with no heirlooms');
}

// ---------- 5. Moving Day ----------
console.log('\n# Moving Day');
{
  const lv = MOVING_DAY.levels;
  ok(lv.map(l => l.at).join(',') === '1.5,2,3' && lv[0].every[0] > lv[1].every[0] && lv[1].every[0] > lv[2].every[0], 'levels at R 1.5 / 2 / 3, signs rare -> regular -> frequent (content.js)',
    lv.map(l => `${l.id} every ${l.every.join('-')} s`).join('; '));
  ok(movingDayLevel(1.49) === null && movingDayLevel(1.5).id === 'restless' && movingDayLevel(2).id === 'ready' && movingDayLevel(2.99).id === 'ready' && movingDayLevel(3).id === 'veryReady', 'movingDayLevel thresholds');
  const { st, sim } = fresh();
  st.ranch.family.bonus = 20; st.ranch.family.lifetime = 1e9; st.ranch.family.legacy = legacyFor(20, 1e9);
  st.phase = 'play'; st.totalJelly = 1e12;
  ok(movingDayRatio(st) === 0, 'R = 0 while the slime is still growing');
  settled(st, 1e12);
  const f = st.ranch.family;
  const R = movingDayRatio(st), want = (1 + familyBonusFor(f.lifetime + f.legacy + 1e12) / 100) / (1 + 20 / 100);
  ok(near(R, want), 'R = (1 + familyBonusFor(lifetime + legacy + totalJelly)/100) / (1 + bonus/100)', `R ${R.toFixed(4)}`);
  ok(near(R, (1 + sim.moveOutPreview().bonusAfter / 100) / (1 + sim.moveOutPreview().bonusNow / 100)), 'R matches the move-out preview (bonus after / now)');
  st.phase = 'egg';
  ok(movingDayRatio(st) === 0, 'R = 0 in the egg phase');
  // a first slime: bonus 0, so R grows with its own jelly
  const a = fresh(); settled(a.st, 1e7 * Math.pow(2 * 100 / 5 / 2, 3));
  ok(near(movingDayRatio(a.st), 1 + familyBonusFor(a.st.totalJelly) / 100), 'generation 1: R = 1 + its own bonus/100', `R ${movingDayRatio(a.st).toFixed(3)} at ${a.st.totalJelly.toExponential(2)}`);
  // signs from the strongest lean
  const P = k => Object.fromEntries(PERSONALITY_IDS.map(id => [id, 50 + (k[id] || 0)]));
  const cases = [[{ curious: 30 }, 'curious'], [{ curious: -30 }, 'familiar'], [{ bold: 30 }, 'bold'], [{ bold: -30 }, 'shy'], [{ playful: 30 }, 'playful'], [{ playful: -30 }, 'mellow'],
    [{ cuddly: 30 }, 'cuddly'], [{ cuddly: -30 }, 'independent'], [{ patient: 30 }, 'patient'], [{ patient: -30 }, 'impulsive'], [{ curious: 10, bold: -25, playful: 20 }, 'shy']];
  const got = cases.map(([p]) => movingDaySign(P(p)));
  ok(cases.every(([, id], i) => got[i] === id), 'the sign comes from the strongest lean (all 10 signs, and a mixed slime)', got.join(', '));
  ok(Object.keys(MOVING_DAY.signs).length === 10 && Object.values(MOVING_DAY.signs).every(s => s.dur > 0), '10 signs in content.js, each with its tuning');
  // the tester save
  const raw = JSON.parse(fs.readFileSync(path.join(FIX, 'moving-day-almost.json'), 'utf8')).save;
  const m = migrate(clone(raw)), s3 = new Sim(m);
  const r0 = movingDayRatio(m);
  const t0 = m.totalJelly;
  let sec = 0;
  for (; sec < 600 && movingDayRatio(m) < 2; sec++) { s3.boop(); s3.tick(1); if (m.slime.tummy < 60) s3.feed('berry', { free: true }); }
  ok(r0 < 2 && r0 > 1.9 && sec <= 300, 'moving-day-almost.json: R just under 2, crosses "ready" within 5 minutes of ordinary play (a boop a second, snacks)',
    `R ${r0.toFixed(4)} -> ready after ${sec} s (+${(m.totalJelly - t0).toExponential(2)} jelly)`);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
