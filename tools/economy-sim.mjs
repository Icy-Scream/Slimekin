// Economy simulator: plays the real game rules with a simple player model, to check pacing.
// Usage: node tools/economy-sim.mjs [days] [casual] [quiet] [gen2=<jelly>]
//   engaged (default): ~80 min of play a day, booping in bursts, buys the best-value helper
//   casual:            ~40 min of play a day, boops less, buys helpers at random
//   quiet:             only print the milestones
//   spam:              taps as fast as possible (about 11 a second) the whole time, and wakes the slime right away
//   gen2=<jelly>:      start as generation 2, after a slime that made <jelly> moved to the ranch (e.g. gen2=1e9)
//   bred:              with gen2: two slimes live on the ranch and the new baby comes from their egg (Nursery)
import url from 'node:url';
import path from 'node:path';
const SRC = url.pathToFileURL(path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../src')).href;
const args = process.argv.slice(2);
const DAYS = +(args.find(a => /^\d+$/.test(a)) || 10);
const CASUAL = args.includes('casual');
const QUIET = args.includes('quiet');
const SPAM = args.includes('spam');
const BRED = args.includes('bred');
const { Sim, createState } = await import(SRC + '/core/sim.js');
const C = await import(SRC + '/data/content.js');
const fmt = n => n < 1e3 ? n.toFixed(0) : n < 1e6 ? (n / 1e3).toFixed(1) + 'K' : n < 1e9 ? (n / 1e6).toFixed(2) + 'M' : n < 1e12 ? (n / 1e9).toFixed(2) + 'B' : (n / 1e12).toFixed(2) + 'T';
let rnd = 12345; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);

const st = createState(); st.phase = 'play'; st.slime.name = 'Sim';
const GEN2 = args.find(a => a.startsWith('gen2='));
if (GEN2) {
  // a previous generation already lives on the ranch
  const { familyBonusFor, residentJpsFor } = await import(SRC + '/core/ranch.js');
  const total = Number(GEN2.split('=')[1]);
  st.ranch.family.bonus = familyBonusFor(total);
  st.ranch.family.generation = 2;
  st.ranch.residents.push({ id: 'r1', name: 'Gen1', traits: {}, jps: residentJpsFor(total), happiness: 80, bondLevel: 4, runTotal: total, generation: 1 });
  console.log(`generation 2: Family Bonus +${st.ranch.family.bonus.toFixed(1)}%, ranch slime makes ${residentJpsFor(total)} jelly/s`);
  if (BRED) {
    // two grown Candy Slimes (what this player model raises) made an egg in the Nursery; the baby hatches from it.
    // The second parent makes no jelly here, so the only difference from plain gen2 is what the baby inherited.
    // pfav=<food>,<food> sets the parents' favorite snacks (default iron,moss: not the snack this player feeds).
    const B = await import(SRC + '/core/breeding.js');
    const pf = (args.find(a => a.startsWith('pfav=')) || 'pfav=iron,moss').slice(5).split(',');
    const candy = (id, fav) => ({ id, name: id, form: { id: 'sweet', name: 'Candy Slime' }, traits: { sweet: 259 }, personality: { curious: 60, patient: 55, playful: 65, cuddly: 60, bold: 45 }, favorite: fav });
    st.ranch.residents[0] = { ...st.ranch.residents[0], ...candy('r1', pf[0]) };
    st.ranch.residents.push({ ...st.ranch.residents[0], ...candy('r0', pf[1] || pf[0]), jps: 0 });
    const egg = B.makeEgg(st.ranch.residents[0], st.ranch.residents[1], { now: 1e12, id: 'e1' });
    B.applyEgg(st.slime, egg);
    console.log(`bred: the baby starts with ${JSON.stringify(egg.bias)}, favorite ${st.slime.favorite}, from ${egg.parents.map(p => p.name).join(' x ')} (2 residents)`);
  }
}
// fav=<food>: force the baby's favorite snack (to compare runs fairly)
const FAV = args.find(a => a.startsWith('fav='));
if (FAV) { st.slime.favorite = FAV.slice(4); if (st.slime.dislike === st.slime.favorite) st.slime.dislike = C.FOODS.find(f => f.id !== st.slime.favorite).id; console.log(`favorite snack set to ${st.slime.favorite}`); }
const sim = new Sim(st);
const DT = 0.25;
// daily schedule (seconds): play/away pairs. ~80 min of play per day.
const DAY = CASUAL ? [['play', 15 * 60], ['away', 6 * 3600], ['play', 25 * 60], ['away', 24 * 3600 - 40 * 60 - 6 * 3600]]
  : [['play', 25 * 60], ['away', 3 * 3600], ['play', 20 * 60], ['away', 4 * 3600], ['play', 35 * 60], ['away', 24 * 3600 - (80 * 60) - 7 * 3600]];
let active = 0, real = 0;
const log = [];
const mark = (what) => log.push(`${(active / 60).toFixed(0).padStart(5)} min played | day ${(real / 86400 + 1).toFixed(1).padStart(4)} | ${what.padEnd(34)} | jps ${fmt(sim.jps()).padStart(8)} | bank ${fmt(st.jelly).padStart(8)}`);
let lastStage = 0;
const firstHelper = {};
let burst = 0, offlineTotal = 0, boopTotal = 0, lastBond = 0, reqT = 75;

function bestHelper() {
  let best = null, bestScore = Infinity;
  for (const h of C.HELPERS) {
    const cost = sim.helperCost(h.id);
    const gain = sim.helperJps(h.id);
    const score = cost / gain;
    if (score < bestScore) { bestScore = score; best = { id: h.id, cost }; }
  }
  return best;
}

function playStep() {
  const s = st.slime;
  const tk = sim.tick(DT);
  // fall asleep when exhausted, nap until rested
  if (!sim.asleep && s.energy <= 0.5) sim.asleep = true;
  if (sim.asleep && s.energy >= 99) sim.asleep = false;
  if (SPAM && sim.asleep && sim.canWake?.() !== false) sim.asleep = false;   // a spammer pokes it awake at once
  const bl = sim.bondLevel();
  if (bl > lastBond) { lastBond = bl; if (bl >= 3) mark('bond ' + C.BOND[bl].title); }
  // boops: 20s bursts at 4.5/s, then 20s of petting/feeding/looking around
  burst = (burst + DT) % (CASUAL ? 60 : 40);
  if (!sim.asleep) {
    if (SPAM) { sim.time += 0; const n = Math.floor(11 * DT) + (Math.random() < (11 * DT) % 1 ? 1 : 0); for (let i = 0; i < n; i++) { const r = sim.boop(); boopTotal += r.gain || 0; } }
    else if (burst < (CASUAL ? 10 : 20)) { const n = Math.random() < 4.5 * DT % 1 ? Math.ceil(4.5 * DT) : Math.floor(4.5 * DT); for (let i = 0; i < n; i++) { const r = sim.boop(); boopTotal += r.gain || 0; } }
    else if (burst < 26) { sim.pet(DT); sim.addBond(0.15 * DT); }
  }
  // answer a request now and then (the real game asks every 45-100 s)
  reqT -= DT;
  if (reqT <= 0) { reqT = 75; if (!sim.asleep) sim.addBond(4); }
  // feed when there's room in the tummy: the unlocked food with the best growth per jelly
  if (!sim.asleep && s.tummy < 72) {
    const foods = C.FOODS.filter(f => sim.foodUnlocked(f.id)).sort((a, b) => (b.nutrition / sim.foodPrice(b.id)) - (a.nutrition / sim.foodPrice(a.id)));
    const f = foods.find(f => sim.canFeed(f.id).ok);
    if (f && st.jelly > sim.foodPrice(f.id) * 2) {
      const before = sim.stageIndex();
      const r = sim.feed(f.id);
      if (r.stageAfter > before) mark('reached ' + C.STAGES[r.stageAfter].name);
    }
  }
  // buy every unlocked upgrade we can afford (players love upgrades), then the best helper
  for (const u of sim.availableUpgrades()) if (sim.canAfford(u.cost * (CASUAL ? 1.5 : 1))) sim.buyUpgrade(u.id);
  const jc = sim.jarUpgradeCost();
  if (jc !== null && st.jelly > jc * 4) { sim.buyJarUpgrade(); mark('jar level ' + (st.jar.level + 1)); }
  const b = CASUAL ? (() => { const af = C.HELPERS.filter(h => sim.canAfford(sim.helperCost(h.id))); const h = af[Math.floor(Math.random() * af.length)]; return h ? { id: h.id, cost: sim.helperCost(h.id) } : null; })() : bestHelper();
  if (b && sim.canAfford(b.cost)) {
    sim.buyHelper(b.id);
    if (!firstHelper[b.id]) { firstHelper[b.id] = true; mark('first ' + C.HELPER_BY_ID[b.id].name); }
  }
  // outfits: buy when they cost less than 10% of the bank
  for (const o of C.OUTFITS) if (!st.outfits.owned.includes(o.id) && st.jelly * 0.1 > o.cost) { sim.buyOutfit(o.id); mark('outfit ' + o.name); }
  active += DT; real += DT;
}

for (let d = 0; d < DAYS; d++) {
  for (const [kind, sec] of DAY) {
    if (kind === 'play') { for (let t = 0; t < sec; t += DT) playStep(); }
    else {
      if (sec > 600) sim.addBond(2);
      const r = sim.fillJar(sec);
      const got = sim.collectJar();
      offlineTotal += got;
      real += sec;
      if (kind === 'away' && sec > 8 * 3600) mark(`overnight jar +${fmt(got)}${r.full ? ' (full)' : ''}`);
    }
  }
  mark(`end of day ${d + 1}`);
}
if (!QUIET) console.log(log.join('\n')); else console.log(log.filter(l => /reached|end of day|first (Goo|Dream|Slime Spa|Rainbow)|Crown|Party|bond/.test(l)).join('\n'));
console.log('\nhelpers:', JSON.stringify(st.helpers));
console.log('upgrades owned:', st.upgrades.length, 'of', C.UPGRADES.length, '| jar level', st.jar.level + 1, '| outfits', st.outfits.owned.length);
console.log('total from jar:', fmt(offlineTotal), '| from boops:', fmt(boopTotal), '| total made:', fmt(st.totalJelly));
