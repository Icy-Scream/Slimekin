// Economy simulator: plays the real game rules with a simple player model, to check pacing.
// Usage: node tools/economy-sim.mjs [days] [casual] [quiet]
//   engaged (default): ~80 min of play a day, booping in bursts, buys the best-value helper
//   casual:            ~40 min of play a day, boops less, buys helpers at random
//   quiet:             only print the milestones
import url from 'node:url';
import path from 'node:path';
const SRC = url.pathToFileURL(path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../src')).href;
const args = process.argv.slice(2);
const DAYS = +(args.find(a => /^\d+$/.test(a)) || 10);
const CASUAL = args.includes('casual');
const QUIET = args.includes('quiet');
const { Sim, createState } = await import(SRC + '/core/sim.js');
const C = await import(SRC + '/data/content.js');
const fmt = n => n < 1e3 ? n.toFixed(0) : n < 1e6 ? (n / 1e3).toFixed(1) + 'K' : n < 1e9 ? (n / 1e6).toFixed(2) + 'M' : n < 1e12 ? (n / 1e9).toFixed(2) + 'B' : (n / 1e12).toFixed(2) + 'T';
let rnd = 12345; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);

const st = createState(); st.phase = 'play'; st.slime.name = 'Sim';
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
let burst = 0, offlineTotal = 0, boopTotal = 0;

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
  // boops: 20s bursts at 4.5/s, then 20s of petting/feeding/looking around
  burst = (burst + DT) % (CASUAL ? 60 : 40);
  if (!sim.asleep) {
    if (burst < (CASUAL ? 10 : 20)) { const n = Math.random() < 4.5 * DT % 1 ? Math.ceil(4.5 * DT) : Math.floor(4.5 * DT); for (let i = 0; i < n; i++) { const r = sim.boop(); boopTotal += r.gain || 0; } }
    else if (burst < 26) sim.pet(DT);
  }
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
      const r = sim.fillJar(sec);
      const got = sim.collectJar();
      offlineTotal += got;
      real += sec;
      if (kind === 'away' && sec > 8 * 3600) mark(`overnight jar +${fmt(got)}${r.full ? ' (full)' : ''}`);
    }
  }
  mark(`end of day ${d + 1}`);
}
if (!QUIET) console.log(log.join('\n')); else console.log(log.filter(l => /reached|end of day|first (Goo|Dream|Slime Spa|Rainbow)|Crown|Party/.test(l)).join('\n'));
console.log('\nhelpers:', JSON.stringify(st.helpers));
console.log('upgrades owned:', st.upgrades.length, 'of', C.UPGRADES.length, '| jar level', st.jar.level + 1, '| outfits', st.outfits.owned.length);
console.log('total from jar:', fmt(offlineTotal), '| from boops:', fmt(boopTotal), '| total made:', fmt(st.totalJelly));
