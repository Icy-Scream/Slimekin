// Ranch life rules check (plain node, no browser): the Training Center (lessons, costs, lengths, lanes, stars) and
// trips (unlocks, lengths, rewards fixed at departure, early return, souvenir order, Friend of, treats, wagons), busy
// slimes refused by the Nursery / new homes / auctions, the hooks in core/ranch.js (Bounce, Charm, Sturdy, Shy,
// travelers skipped), time while the game is closed, every number coming from RANCH_LIFE, and every old fixture save.
//   node tools/ranch-life-test.mjs
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
let rnd = 31337; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);

const { Sim, createState, migrate } = await import(SRC + '/core/sim.js');
const { migrateRanch, createRanch } = await import(SRC + '/core/ranch.js');
const RL = await import(SRC + '/core/ranch-life.js');
const { movingDaySign } = await import(SRC + '/core/movingday.js');
const C = await import(SRC + '/data/content.js');
const { RANCH, RANCH_LIFE: L, SKILL_IDS, PLACE_BY_ID, BUYER_BY_ID, TUNING, TRAIT_IDS, PERSONALITY_IDS } = C;

let fails = 0, passes = 0;
const ok = (cond, what, extra = '') => { if (cond) { passes++; console.log('ok   - ' + what + (extra ? ' | ' + extra : '')); } else { fails++; console.log('FAIL - ' + what + (extra ? ' | ' + extra : '')); } };
const near = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
const clone = o => JSON.parse(JSON.stringify(o));
const H = 3600e3, MIN = 60e3;
const NOW = Date.UTC(2026, 10, 6, 9, 0, 0);
// a personality whose strongest lean is `lean` (a Moving Day sign id), all others in the middle
const leaning = lean => {
  const p = Object.fromEntries(PERSONALITY_IDS.map(k => [k, 50]));
  const [axis, end] = C.MOVING_DAY.signs[lean].lean;
  p[axis] = end === 'high' ? 90 : 10;
  return p;
};
let nid = 0;
const resident = (o = {}) => ({ id: 'r' + (nid++), name: o.name || 'Pip', form: { id: 'mochi', name: 'Marshmallow Slime' }, traits: { sweet: 60, heat: 50, mineral: 0, nature: 0, spark: 0, prism: 0 },
  personality: leaning(o.lean || 'curious'), bondLevel: 2, runTotal: 5e8, jps: 4, generation: 1, happiness: 60, pearlT: 0, petAt: 0, lineage: { parents: [] },
  skills: RL.emptySkills(), lesson: null, trip: null, ...o });
// a playing save with some residents and pearls
function world(list = [{}, {}], pearls = 1000) {
  const st = createState();
  st.phase = 'play'; st.slime.name = 'Clover';
  st.ranch.residents = list.map(o => resident(o));
  st.ranch.pearls = st.ranch.totalPearls = pearls;
  st.ranch.slots = 10;
  const sim = new Sim(st);
  return { st, sim, rl: sim.life, rr: sim.ranch, R: st.ranch, x: st.ranch.residents };
}

// ---------- 1. data ----------
console.log('\n# RANCH_LIFE data');
ok(L.skills.length === 5 && SKILL_IDS.join(',') === 'bounce,speed,sturdy,smarts,charm', 'five skills: Bounce, Speed, Sturdy, Smarts, Charm');
ok(L.lesson.pearls.join(',') === '5,10,20,35,50' && L.lesson.minutes.join(',') === '20,45,90,180,360' && L.lesson.pearls.reduce((a, b) => a + b) === 120,
  'lesson prices 5/10/20/35/50 (120 a skill) and times 20 min / 45 min / 1.5 h / 3 h / 6 h (the design)');
ok(L.places.length === 6 && L.places.every(p => p.souvenirs.length === 3 && p.stories.length >= 4 && BUYER_BY_ID[p.buyer] && p.treat && p.hours > 0),
  'six places, each a buyer\'s home, with a treat, three souvenirs and at least four story lines', L.places.map(p => `${p.name} ${p.hours}h`).join(', '));
ok(RL.SOUVENIR_TOTAL === 18 && new Set(L.places.flatMap(p => p.souvenirs.map(s => s.id))).size === 18, '18 souvenirs, all different');
ok(Object.keys(L.loves).sort().join(',') === Object.keys(C.MOVING_DAY.signs).sort().join(','), 'a "loves" entry for every lean (the Moving Day sign ids)');
ok(L.places.every(p => Object.values(p.lean || {}).concat(p.stories).every(t => t.includes('{name}'))), 'every story line names the traveler');

// ---------- 2. old saves ----------
console.log('\n# old saves (every fixture)');
for (const f of fs.readdirSync(path.join(HERE, 'fixtures')).filter(f => f.endsWith('.json'))) {
  const save = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', f), 'utf8')).save;
  const m = migrate(clone(save));
  const res = m.ranch.residents;
  const zero = res.every(x => SKILL_IDS.every(k => x.skills[k] === 0) && x.lesson === null && x.trip === null);
  const life = JSON.stringify(m.ranch.life) === JSON.stringify(RL.createLife());
  // the rest of each resident is exactly as saved (only skills, lesson and trip are new; lineage only gains its defaults;
  // the recipe body's breed, variant, mix and genes are new too, and tools/recipe-test.mjs checks those)
  const orig = save.ranch?.residents || [];
  const same = orig.every((o, i) => Object.keys(o).every(k => k === 'lineage' || JSON.stringify(o[k]) === JSON.stringify(res[i][k])) &&
    Object.keys(res[i]).filter(k => !(k in o)).every(k => ['skills', 'lesson', 'trip', 'lineage', 'breed', 'variant', 'mix', 'genes'].includes(k)));
  // and the rest of the ranch as saved (residents above; family, nursery and life are filled in by their own migrations)
  const ranchSame = Object.keys(save.ranch || {}).filter(k => !['residents', 'family', 'nursery', 'life'].includes(k)).every(k => JSON.stringify(save.ranch[k]) === JSON.stringify(m.ranch[k]));
  const twice = JSON.stringify(migrate(clone(m)).ranch) === JSON.stringify(m.ranch);
  ok(zero && life && same && ranchSame && twice, `${f}: residents start at 0 stars with no lesson or trip, ranch.life is fresh, everything else as saved, migrating twice changes nothing`, `${res.length} residents`);
}
{
  // broken or half-written ranch-life fields are repaired, never crash
  const r = migrateRanch({ residents: [{ id: 'a', name: 'A', skills: { bounce: 9, speed: -2, sturdy: 'x', smarts: 2.7 }, lesson: { skill: 'juggling' }, trip: { place: 'moon', homeAt: 1 } }], life: { lanes: 99, wagons: 0, souvenirs: [], friends: ['cafe', 'nowhere', 'cafe'], trips: -1 } });
  const a = r.residents[0], l = r.life;
  ok(a.skills.bounce === 5 && a.skills.speed === 0 && a.skills.sturdy === 0 && a.skills.smarts === 2 && a.skills.charm === 0 && a.lesson === null && a.trip === null &&
    l.lanes === 3 && l.wagons === 1 && !Array.isArray(l.souvenirs) && l.friends.join(',') === 'cafe' && l.trips === 0, 'broken ranch-life fields are repaired (stars 0..5, unknown lesson/trip dropped, lanes and wagons in range)', JSON.stringify({ skills: a.skills, life: l }));
  ok(JSON.stringify(createRanch().life) === JSON.stringify(RL.createLife()) && createRanch().life.lanes === 1 && createRanch().life.wagons === 1, 'a new ranch starts with 1 lane and 1 wagon');
  const { st, sim } = world([]);
  st.slime.growth = C.STAGES[3].minGrowth + 1; st.totalJelly = 1e9;
  const mv = sim.moveToRanch(NOW);
  ok(mv && SKILL_IDS.every(k => mv.resident.skills[k] === 0) && mv.resident.lesson === null && mv.resident.trip === null, 'a slime moving to the ranch now starts at 0 stars');
}

// ---------- 3. lessons ----------
console.log('\n# lessons');
{
  const { rl, R, x, rr } = world([{ lean: 'curious' }, { lean: 'curious' }], 100);
  const a = x[0];
  const c = rl.canTrain(a.id, 'bounce');
  ok(c.ok && c.star === 1 && c.pearls === 5 && c.seconds === 20 * 60, 'Bounce star 1: 5 pearls, 20 minutes', JSON.stringify(c));
  const r = rl.train(a.id, 'bounce', NOW);
  ok(r && R.pearls === 95 && a.lesson.doneAt === NOW + 20 * MIN && a.lesson.star === 1, 'starting it takes the pearls and sets the end time');
  ok(rl.canTrain(x[1].id, 'speed').reason === 'lanes', 'one lane: a second slime waits (reason "lanes")');
  ok(rl.canTrain(a.id, 'speed').reason === 'lesson', 'one lesson at a time per slime');
  ok(rl.canSend(a.id, 'cafe').reason === 'lesson', "a slime in a lesson can't go on a trip");
  ok(rl.resolve(NOW + 20 * MIN - 1).length === 0, 'not done a moment early');
  a.happiness = 50;
  const done = rl.resolve(NOW + 20 * MIN);
  ok(done.length === 1 && done[0].kind === 'lesson' && a.skills.bounce === 1 && a.lesson === null && a.happiness === 50 + L.lesson.happy && R.life.lessons === 1, 'done on time: one star, +10 happiness, counted', JSON.stringify(done[0]));
  ok(rl.laneCost() === 60, 'a second lane costs 60');
  R.pearls = 59; ok(rl.buyLane() === null && R.life.lanes === 1, "can't buy a lane without the pearls");
  R.pearls = 1000; ok(rl.buyLane()?.lanes === 2 && R.pearls === 940 && rl.laneCost() === 150, 'the second lane (60), then a third for 150');
  ok(rl.buyLane()?.lanes === 3 && rl.laneCost() === null && rl.buyLane() === null, 'three lanes at most');
  R.pearls = 4;
  ok(rl.canTrain(x[1].id, 'speed').reason === 'pearls' && rl.train(x[1].id, 'speed', NOW) === null && x[1].lesson === null, "a lesson can't start without the pearls");
  R.pearls = 1000;
  // the whole ladder: 120 pearls and about 11.5 hours a skill
  let paid = 0, secs = 0, t = NOW;
  for (let s = 1; s <= 5; s++) { const q = rl.train(x[1].id, 'charm', t); paid += q.cost; secs += q.seconds; t = x[1].lesson.doneAt; rl.resolve(t); }
  ok(x[1].skills.charm === 5 && paid === 120 && near(secs / 3600, 11.5833, 1e-3), 'a whole skill: 5 lessons, 120 pearls, 11 h 35 min', `${paid} pearls, ${(secs / 3600).toFixed(2)} h`);
  ok(rl.canTrain(x[1].id, 'charm').reason === 'max' && rl.lessonFor(x[1], 'charm') === null, 'five stars is the top');
}
{
  // lengths: Smarts 5% a star (all lessons), loves: 25% for its own skill, "likes the familiar" 10% for all
  const { rl, x } = world([{ lean: 'playful' }, { lean: 'familiar' }, { lean: 'curious', skills: { ...RL.emptySkills(), smarts: 4 } }]);
  ok(rl.lessonFor(x[0], 'bounce').seconds === 15 * 60 && rl.lessonFor(x[0], 'speed').seconds === 20 * 60, 'Playful loves Bounce: Bounce lessons 25% shorter, others as usual');
  ok(rl.lessonFor(x[1], 'charm').seconds === 18 * 60 && rl.lessonFor(x[1], 'bounce').seconds === 18 * 60, 'Likes the familiar: every lesson 10% shorter');
  ok(rl.lessonFor(x[2], 'speed').seconds === Math.round(20 * 60 * 0.8), 'Smarts 4 stars: lessons 20% shorter');
  const both = world([{ lean: 'patient', skills: { ...RL.emptySkills(), smarts: 2 } }]);
  ok(both.rl.lessonFor(both.x[0], 'smarts').seconds === Math.round(90 * 60 * 0.9 * 0.75), 'Smarts and loves multiply (Patient, Smarts 2: star 3 of Smarts = 90 min x 0.9 x 0.75)');
}

// ---------- 4. trips ----------
console.log('\n# trips');
{
  const { rl, rr, R, x, st } = world([{ lean: 'curious' }, { lean: 'bold' }, { lean: 'independent' }], 100);
  const [a, b, c] = x;
  ok(rl.canSend(a.id, 'cafe').ok && rl.canSend(a.id, 'garden').ok, 'the 1-hour places are always open');
  ok(rl.canSend(a.id, 'mine').reason === 'locked' && rl.canSend(a.id, 'mine').needs === 1 && rl.canSend(a.id, 'festival').needs === 3, 'the 3-hour places need Sturdy 1, the 6-hour ones Sturdy 3');
  a.skills.sturdy = 1; ok(rl.canSend(a.id, 'springs').ok && !rl.canSend(a.id, 'observatory').ok, 'Sturdy 1 opens the 3-hour places');
  a.skills.sturdy = 3; ok(rl.canSend(a.id, 'observatory').ok, 'Sturdy 3 opens the far places');
  b.skills.sturdy = 2; ok(rl.canSend(b.id, 'festival').ok && rl.canSend(b.id, 'festival').needs === 2, 'Bold (loves adventure): the far places open at Sturdy 2');
  ok(rl.tripFor(c, 'cafe').seconds === 3600 * 0.9, 'Independent: trips 10% shorter');
  c.skills.speed = 5; ok(rl.tripFor(c, 'mine').seconds === Math.round(3 * 3600 * 0.7 * 0.9), 'Speed 5 stars: 30% shorter (and multiplies with Independent)');
  // pearls: the slime's own rate at 100% happiness, for that long, plus Smarts and loves
  a.happiness = 20; a.skills.smarts = 2;
  const want = Math.round(rr.pearlRate({ ...a, happiness: 100 }) * 3600 * (1 + 2 * 0.05 + 0.10));
  const t = rl.tripFor(a, 'cafe');
  ok(t.pearls === want, 'trip pearls = its pearl rate if perfectly happy x the trip length x (1 + Smarts 5% a star + Curious 10%)', `${t.pearls} (rate at 100%: ${(rr.pearlRate({ ...a, happiness: 100 }) * 3600).toFixed(2)}/h)`);
  const s = rl.send(a.id, 'cafe', NOW);
  ok(s && a.trip.homeAt === NOW + 3600e3 && a.trip.pearls === want && a.trip.souvenir === 'cupHat' && R.pearls === 100, 'trips are free; the pearls and the souvenir are fixed when it leaves');
  ok(rl.canSend(b.id, 'garden').reason === 'wagons', 'one wagon: a second traveler waits (reason "wagons")');
  ok(rl.canTrain(a.id, 'bounce').reason === 'away', "a traveler can't take a lesson");
  ok(rl.wagonCost() === 80, 'a second wagon costs 80');
  // fixed at departure: a reload, a sadder slime, the Lanterns or more Bounce on the way don't change what comes home
  const reloaded = migrate(clone(st));
  const sim2 = new Sim(reloaded), a2 = reloaded.ranch.residents[0];
  a2.happiness = 0; reloaded.heirlooms.owned.push('lanterns');
  const story1 = rl.story(a), story2 = sim2.life.story(a2);
  const r2 = sim2.life.resolve(NOW + 3600e3)[0];
  const r1 = rl.resolve(NOW + 3600e3)[0];
  ok(r1.pearls === want && r2.pearls === want && r1.story === r2.story && story1 === r1.story && r1.souvenir.id === 'cupHat' && r2.souvenir.id === 'cupHat',
    'what comes home does not change when the game reloads (pearls, souvenir, story), even with the Lanterns bought meanwhile', `"${r1.story}"`);
  ok(R.pearls === 100 + want && a.trip === null && R.life.souvenirs.cupHat && R.life.trips === 1, 'home: the pearls go straight to your pocket (not the basket), the souvenir to the shelf');
}
{
  // happiness and the treat
  const { rl, x, st, sim } = world([{ lean: 'curious', happiness: 40 }]);
  const a = x[0], joy0 = st.slime.joy = 50, bond0 = st.slime.bondXp, traits0 = JSON.stringify(st.slime.traits);
  rl.send(a.id, 'garden', NOW);
  const r = rl.resolve(NOW + H)[0];
  const lvl = sim.bondLevel();
  ok(a.happiness === 40 + L.trip.happy && r.treat.to === 'Clover' && r.treat.what === 'a garden berry', `a full trip comes home happy (+${L.trip.happy}) with a treat for the slime at home`);
  ok(st.slime.joy === joy0 + L.treat.joy && near(st.slime.bondXp - bond0, L.treat.bond * TUNING.bondGain * TUNING.bondCurve[lvl]) && JSON.stringify(st.slime.traits) === traits0,
    'the treat: joy and bond for your slime, never traits', `joy +${st.slime.joy - joy0}, bondXp +${(st.slime.bondXp - bond0).toFixed(2)}`);
  st.phase = 'egg'; a.happiness = 40;
  rl.send(a.id, 'garden', NOW + 2 * H);
  const r2 = rl.resolve(NOW + 3 * H)[0];
  ok(r2.treat.to === null && a.happiness === 40 + L.trip.happy + L.treat.happy && st.slime.joy === joy0 + L.treat.joy, 'an egg on the cushion: the traveler eats its own treat (+happiness), nobody else is fed');
}
{
  // early return never pays more than the full trip; no souvenir or treat
  const { rl, x, R, st } = world([{ lean: 'curious', skills: { ...RL.emptySkills(), sturdy: 3, smarts: 5 }, bondLevel: 9, runTotal: 1e15 }]);
  const a = x[0];
  let worst = -Infinity, okAll = true;
  for (const f of [0, 0.01, 0.25, 0.5, 0.75, 0.999]) {
    a.happiness = 30;
    rl.send(a.id, 'observatory', NOW);
    const full = a.trip.pearls, p0 = R.pearls, s0 = Object.keys(R.life.souvenirs).length, joy0 = st.slime.joy;
    const r = rl.callHome(a.id, NOW + f * 6 * 3600e3);
    const got = R.pearls - p0;
    worst = Math.max(worst, got - full);
    if (!(r.early && got === Math.floor(full * f) && got <= full && !r.souvenir && !r.treat && Object.keys(R.life.souvenirs).length === s0 && st.slime.joy === joy0 && near(a.happiness, 30 + L.trip.happy * f))) okAll = false;
  }
  ok(okAll && worst <= 0, 'Call home early: its share of the pearls and happiness for the time it travelled (never more than the full trip), its story, no souvenir or treat', `worst got - full = ${worst}`);
  ok(rl.callHome(a.id, NOW) === null, 'calling home a slime that is home does nothing');
}
{
  // souvenirs in order; after all three, trips still bring pearls, a treat and a story; Friend of (+20 once, offers +10%)
  const { rl, x, R, rr } = world([{ lean: 'curious' }, { lean: 'mellow', traits: { sweet: 100, heat: 0, mineral: 0, nature: 0, spark: 0, prism: 0 } }], 0);
  const a = x[0], b = x[1];
  // a day when Puddle Café is among b's offers and its auction bidders (offers and auctions are fixed per day)
  let DAYT = NOW;
  for (let d = 0; d < 400; d++) { const t = NOW + d * 24 * H; if (rr.offers(b, t).some(o => o.buyer === 'cafe') && rr.auction(b, t).bidders.some(q => q.buyer === 'cafe')) { DAYT = t; break; } }
  const offers0 = rr.offers(b, DAYT).map(o => [o.buyer, o.pearls]);
  const auc0 = rr.auction(b, DAYT);
  const order = [];
  let t = NOW;
  for (let i = 0; i < 4; i++) { rl.send(a.id, 'cafe', t); t += H; const r = rl.resolve(t)[0]; order.push(r.souvenir?.id || '-'); if (r.friend) order.push(`friend+${r.gift}`); }
  ok(order.join(',') === 'cupHat,sprinkleJar,napkin,friend+20,-', 'souvenirs come in order; the third makes you a Friend of the place (+20 pearls, once); a fourth trip brings none', order.join(','));
  ok(R.life.friends.join(',') === 'cafe' && rl.found('cafe') === 3 && rl.foundTotal() === 3, 'the shelf: 3 of 18');
  const offers1 = rr.offers(b, DAYT).map(o => [o.buyer, o.pearls]);
  const cafe0 = offers0.find(o => o[0] === 'cafe'), cafe1 = offers1.find(o => o[0] === 'cafe');
  ok(cafe0 && cafe1 && Math.abs(cafe1[1] - cafe0[1] * 1.1) <= 1 && cafe1[1] > cafe0[1] && offers1.filter(o => o[0] !== 'cafe').every(o => offers0.find(q => q[0] === o[0])?.[1] === o[1]),
    'Friend of Puddle Café: its offer is 10% higher, the others are unchanged', `${JSON.stringify(cafe0)} -> ${JSON.stringify(cafe1)}`);
  const auc1 = rr.auction(b, DAYT);
  const cafeBid0 = auc0.bidders.find(q => q.buyer === 'cafe'), cafeBid1 = auc1.bidders.find(q => q.buyer === 'cafe');
  ok(cafeBid0 && cafeBid1 && Math.abs(cafeBid1.max - Math.round(cafeBid0.max * 1.1)) <= 1 && cafeBid1.max > cafeBid0.max, 'Friend of: that buyer bids 10% more at auctions', `${cafeBid0?.max} -> ${cafeBid1?.max}`);
  // two wagons to the same place: the next two souvenirs
  const w = world([{ lean: 'curious' }, { lean: 'curious' }], 500);
  w.rl.buyWagon();
  w.rl.send(w.x[0].id, 'garden', NOW); w.rl.send(w.x[1].id, 'garden', NOW);
  ok(w.x[0].trip.souvenir === 'seeds' && w.x[1].trip.souvenir === 'snailShell', 'two travelers to the same place bring the next two souvenirs');
  const back = w.rl.resolve(NOW + H).map(r => r.souvenir.id).sort().join(',');
  ok(back === 'seeds,snailShell' && w.rl.found('garden') === 2, 'both come home with theirs');
}

// ---------- 5. busy slimes refused ----------
console.log('\n# busy slimes refused');
{
  const { rl, rr, x, R } = world([{ lean: 'curious', bredDay: null }, { lean: 'mellow' }, { lean: 'shy' }], 1000);
  const [a, b, c] = x;
  rl.send(a.id, 'cafe', NOW);
  rl.train(b.id, 'sturdy', NOW);
  ok(rr.canBreed(a.id, c.id, NOW).reason === 'away' && rr.canBreed(c.id, a.id, NOW).who.join() === a.name, 'the Nursery: a traveler can\'t be a parent (reason "away")');
  ok(rr.canBreed(b.id, c.id, NOW).reason === 'lesson', 'the Nursery: nor a slime in a lesson (reason "lesson")');
  ok(rr.breed(a.id, c.id, NOW) === null && R.nursery.eggs.length === 0, 'no egg, no pearls spent');
  const o = rr.offers(a, NOW)[0];
  ok(rr.place(a.id, o.buyer, NOW) === null && rr.place(b.id, rr.offers(b, NOW)[0].buyer, NOW) === null && rr.sellAtAuction(a.id, NOW) === null && rr.sellAtAuction(b.id, NOW) === null && R.residents.length === 3,
    'new homes and auctions refuse a traveler and a slime in a lesson');
  rl.resolve(NOW + 2 * H);
  ok(rr.canBreed(a.id, b.id, NOW + 2 * H).ok && rr.place(a.id, rr.offers(a, NOW + 2 * H)[0].buyer, NOW + 2 * H), 'once home / done, all of it works again');
}

// ---------- 6. the hooks in core/ranch.js ----------
console.log('\n# hooks in core/ranch.js');
{
  const { rr, x, st } = world([{ lean: 'curious' }, { lean: 'shy' }, { lean: 'curious' }]);
  const [a, s, t] = x;
  a.happiness = 70;
  const p0 = rr.pearlRate(a);
  a.skills.bounce = 5; ok(near(rr.pearlRate(a), p0 * 1.15), 'Bounce 5 stars: +15% ranch pearls');
  const m0 = rr.offerMult(a); a.skills.charm = 5; ok(near(rr.offerMult(a), m0 * 1.2), 'Charm 5 stars: offers and auction prices +20%');
  ok(near(rr.happyDecay(t), RANCH.happyDecayPerHour) && near(rr.happyDecay(s), RANCH.happyDecayPerHour * 0.9), 'Shy (loves quiet days): happiness fades 10% slower');
  t.skills.sturdy = 5; ok(near(rr.happyDecay(t), RANCH.happyDecayPerHour * 0.75), 'Sturdy 5 stars: 25% slower');
  s.skills.sturdy = 2; ok(near(rr.happyDecay(s), RANCH.happyDecayPerHour * 0.9 * 0.9), 'they multiply (Shy with Sturdy 2: x0.9 x0.9)');
  // live and closed: same fade rule
  for (const y of x) y.happiness = 80;
  rr.tick(3600); const live = x.map(y => 80 - y.happiness);
  for (const y of x) y.happiness = 80;
  rr.tickAway(3600); const away = x.map(y => 80 - y.happiness);
  ok(x.every((y, i) => near(live[i], rr.happyDecay(y)) && near(away[i], rr.happyDecay(y))), 'the per-slime fade is used live and while closed', live.map(v => v.toFixed(2)).join(' / '));
  // travelers: no pearls, no fade, not cheered by a visit, not petted
  a.trip = { place: 'cafe', startAt: NOW, homeAt: NOW + H, seed: 's', pearls: 4, souvenir: null };
  a.happiness = 50; a.pearlT = 0.9;
  st.ranch.basket.stored = 0;
  rr.tick(3600); rr.tickAway(7200);
  ok(a.happiness === 50 && a.pearlT === 0.9, 'a traveler makes no ranch pearls and its happiness does not fade (live and closed)');
  ok(!rr.pet(a.id, NOW) && (rr.visit(NOW + 9 * H), a.happiness === 50), 'a traveler is not petted or cheered by a visit (it is not there)');
  ok(near(rr.pearlsPerHour(), x.filter(y => !y.trip).reduce((q, y) => q + rr.pearlRate(y) * 3600, 0)), 'the ranch\'s pearls an hour leaves travelers out');
}

// ---------- 7. time while the game is closed ----------
console.log('\n# while the game is closed');
{
  // nothing busy: passTime is exactly tickAway
  const A = world([{ lean: 'curious', happiness: 90 }, { lean: 'mellow', happiness: 30 }]);
  const B = world([{ lean: 'curious', happiness: 90 }, { lean: 'mellow', happiness: 30 }]);
  B.x.forEach((y, i) => { y.id = A.x[i].id; });
  A.R.basket.level = B.R.basket.level = 4;
  const ra = A.rl.passTime(5 * 3600, NOW), rb = B.rr.tickAway(5 * 3600);
  ok(ra.pearls === rb.pearls && ra.done.length === 0 && JSON.stringify(A.x.map(y => y.happiness)) === JSON.stringify(B.x.map(y => y.happiness)), 'nothing going on: the same as before ranch life', `${ra.pearls} pearls`);
}
{
  // a traveler who came home in the middle: pearls only for the time after it was home; a lesson that ended meanwhile
  const { rl, rr, x, R } = world([{ lean: 'curious', happiness: 100 }, { lean: 'mellow', happiness: 50 }], 1000);
  R.basket.level = 4;
  const [a, b] = x;
  rl.send(a.id, 'cafe', NOW);              // home at NOW + 1 h
  rl.train(b.id, 'sturdy', NOW);           // mellow loves Sturdy: 15 min
  // compare with doing it by hand: a is away for 1 h then home for 4 h; b learns for 15 min then +10 happiness
  const ref = world([{ lean: 'curious', happiness: 100 }, { lean: 'mellow', happiness: 50 }], 0);
  ref.R.basket.level = 4;
  const [ra, rb] = ref.x;
  ref.x.splice(0, 1);                      // (a is away for the first hour)
  ref.rr.tickAway(15 * 60);
  rb.happiness += L.lesson.happy; rb.skills.sturdy = 1;
  ref.rr.tickAway(45 * 60);
  ref.x.unshift(ra);
  ra.happiness = Math.min(100, ra.happiness + L.trip.happy);
  ref.rr.tickAway(4 * 3600);
  const fixed = a.trip.pearls;
  const r = rl.passTime(5 * 3600, NOW + 5 * H);
  ok(r.done.map(d => d.kind).join(',') === 'lesson,trip' && R.basket.stored === ref.R.basket.stored && near(a.happiness, ra.happiness) && near(b.happiness, rb.happiness) && b.skills.sturdy === 1,
    'closed for 5 hours: the lesson ends at 15 min, the traveler is home at 1 h, and each only makes pearls and fades while home', `basket ${R.basket.stored} (by hand ${ref.R.basket.stored}), happiness ${a.happiness.toFixed(1)}/${b.happiness.toFixed(1)}`);
  ok(r.done[1].pearls === fixed && R.pearls === 1000 - 5 + fixed, 'and the trip paid its fixed pearls into your pocket (the lesson cost 5)', `${fixed}`);
}
{
  // several trips and lessons finishing while closed come back in time order (one card in the game)
  const { rl, x } = world([{ lean: 'curious' }, { lean: 'curious' }, { lean: 'curious' }], 1000);
  rl.buyWagon(); rl.buyLane();
  rl.send(x[0].id, 'garden', NOW); rl.send(x[1].id, 'cafe', NOW + 10 * MIN); rl.train(x[2].id, 'charm', NOW + 5 * MIN);
  const r = rl.passTime(3 * 3600, NOW + 3 * H);
  ok(r.done.length === 3 && r.done.map(d => d.at).every((v, i, a) => i === 0 || a[i - 1] <= v) && r.done.map(d => d.kind).join(',') === 'lesson,trip,trip', 'several finished while closed: all of them, oldest first', r.done.map(d => `${d.kind}@${(d.at - NOW) / MIN}m`).join(' '));
}

// ---------- 8. every number comes from RANCH_LIFE ----------
console.log('\n# every number comes from RANCH_LIFE');
{
  // change the numbers in RANCH_LIFE and the rules follow
  const save = clone(L);
  L.lesson.pearls[0] = 7; L.lesson.minutes[0] = 11; L.lanes.costs[0] = 61; L.wagons.costs[0] = 81; L.trip.happy = 3; L.lesson.happy = 4; L.trip.middleAt = 2;
  L.places[0].hours = 2; L.skills[0].fx.pearls = 0.1; L.friend.gift = 21; L.treat.joy = 1;
  const { rl, rr, x, R, st } = world([{ lean: 'curious', happiness: 50 }, { lean: 'curious', happiness: 50 }], 1000);
  const c = rl.canTrain(x[0].id, 'bounce');
  const p0 = rr.pearlRate(x[0]); x[0].skills.bounce = 1; const p1 = rr.pearlRate(x[0]); x[0].skills.bounce = 0;
  rl.train(x[0].id, 'bounce', NOW); rl.resolve(NOW + 11 * MIN);
  const happyL = x[0].happiness;
  rl.send(x[1].id, 'cafe', NOW); const tr = x[1].trip;
  st.slime.joy = 10; rl.resolve(NOW + 2 * H);
  const follows = c.pearls === 7 && c.seconds === 11 * 60 && rl.laneCost() === 61 && rl.wagonCost() === 81 && happyL === 54 && x[1].happiness === 53 && tr.homeAt - tr.startAt === 2 * H &&
    rl.tripFor(x[0], 'mine').needs === 2 && near(p1, p0 * 1.1) && st.slime.joy === 11;
  ok(follows, 'changing RANCH_LIFE changes the rules (prices, times, lanes, wagons, happiness, places, unlocks, skill effects, treats)');
  // put everything back
  for (const k of Object.keys(save)) L[k] = save[k];
  ok(JSON.stringify(L) === JSON.stringify(save), '(RANCH_LIFE restored)');
  // and core/ranch-life.js has no tuning numbers of its own (only units and the story's coin flip)
  const code = fs.readFileSync(path.resolve(HERE, '../src/core/ranch-life.js'), 'utf8').replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'|`[^`]*`/g, '');
  const nums = [...code.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w])/g)].map(m => +m[1]);
  const allowed = new Set([0, 1, 60, 1000, 3600, 100, 0.5]);   // units (s/min, ms/s, s/h), 100 = full happiness/joy, the coin flip
  const stray = nums.filter(n => !allowed.has(n));
  ok(stray.length === 0, 'core/ranch-life.js has no tuning numbers of its own (only 0, 1, time units, 100 = full happiness, the story coin flip 0.5)', stray.join(',') || 'none');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
