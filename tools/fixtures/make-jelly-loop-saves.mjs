// Makes the jelly-loop fixtures in this folder (run from the repo root):
//   node tools/fixtures/make-jelly-loop-saves.mjs
// 1. pre-jelly-gen2.json and pre-jelly-rushed.json: saves made by the rules as they were just before the jelly loop
//    (commit 828f3b9: breeding core, playtest fixes, UI pass 1). Files are read with `git show` into a temporary
//    folder (nothing is checked out). "Rushed": six slimes moved out as soon as they were grown up, which under the old
//    rule (each move-out added its own bonus) built a big Family Bonus that the new rule must keep exactly.
// 2. moving-day-almost.json: made by the current rules. A Settled slime whose Moving Day ratio is just under 2
//    ("restless"); it crosses "ready" after a few minutes of ordinary play (booping, a snack now and then).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OLD = '828f3b9';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'slimekin-pre-jelly-'));
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', OLD, 'src/core', 'src/data'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
for (const f of files) {
  fs.mkdirSync(path.join(TMP, path.dirname(f)), { recursive: true });
  fs.writeFileSync(path.join(TMP, f), execFileSync('git', ['show', `${OLD}:${f}`], { cwd: ROOT }));
}

// fixed clock and dice, so the fixtures are the same every time
let rnd = 4242; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
let clock = Date.UTC(2026, 10, 4, 15, 0, 0); Date.now = () => clock;

const save = (name, st, note, madeWith) => {
  st.savedAt = clock;
  fs.writeFileSync(path.join(HERE, name), JSON.stringify({ note, madeWith, save: st }, null, 1) + '\n');
  const f = st.ranch.family;
  console.log('wrote', name, '| phase', st.phase, '| generation', f.generation, '| bonus', f.bonus.toFixed(2) + '%', '| lifetime', f.lifetime.toExponential(3), '| residents', st.ranch.residents.length);
};
// raise the current slime to Settled on a diet (fed for free), then booping a while; `total` is the jelly it made
const raise = (sim, diet, name, total) => {
  const st = sim.s;
  st.phase = 'play'; st.slime.name = name; st.slime.bornAt = clock;
  let i = 0;
  for (let guard = 0; guard < 200000 && sim.stageIndex() < 3; guard++) {
    sim.tick(1); clock += 1000;
    if (st.slime.tummy < 72) { const pool = diet.filter(f => sim.foodUnlocked(f)); sim.feed((pool.length ? pool : ['cookie'])[i++ % (pool.length || 1)], { free: true }); }
  }
  for (let k = 0; k < 600; k++) { sim.boop(); sim.tick(0.5); clock += 500; }
  st.totalJelly = Math.max(st.totalJelly, total); st.jelly = 5e7;
};
const hatch = (sim, name) => { const st = sim.s; st.phase = 'play'; st.slime.name = name; st.slime.bornAt = clock; st.slime.growth = 0; };

// ---------- 1. saves from the rules before the jelly loop ----------
{
  const { Sim, createState } = await import(url.pathToFileURL(path.join(TMP, 'src/core/sim.js')).href);
  const made = `${OLD} (before the jelly loop)`;
  // generation 2, the normal way: a slime raised to 4B, moved out, a baby growing; pearls on the ranch
  let st = createState(), sim = new Sim(st);
  raise(sim, ['cookie', 'chili'], 'Maple', 4e9);
  sim.moveToRanch(clock); clock += 60000;
  sim = new Sim(st);
  sim.ranch.tickAway(4 * 3600); clock += 4 * 3600 * 1000;
  sim.ranch.collectBasket();
  hatch(sim, 'Sprout');
  for (let k = 0; k < 40; k++) { sim.tick(1); clock += 1000; if (st.slime.tummy < 72) sim.feed('berry', { free: true }); }
  save('pre-jelly-gen2.json', st, 'Save from just before the jelly loop: generation 2, one resident (4B jelly), a young baby, pearls.', made);

  // rushed: six slimes moved out as soon as they were grown up (2B each); the old rule added 5*cbrt(2e9/1e7) each time
  st = createState(); sim = new Sim(st);
  const names = ['Ash', 'Birch', 'Cedar', 'Dune', 'Elm', 'Fern'];
  for (const [i, name] of names.entries()) {
    if (i) hatch(sim, name);
    st.slime.growth = 0;
    raise(sim, ['cookie', 'chili', 'iron'], name, 2e9);
    // a full ranch: the oldest resident goes to a new home (best offer) to make room
    if (sim.ranch.free() <= 0) { const x = st.ranch.residents[0]; sim.ranch.place(x.id, sim.ranch.offers(x, clock)[0].buyer, clock); }
    if (!sim.moveToRanch(clock)) throw new Error('rushed: move-out failed for ' + name);
    clock += 60000;
    sim = new Sim(st);
    sim.ranch.tickAway(1800); clock += 1800 * 1000;
    sim.ranch.collectBasket();
  }
  hatch(sim, 'Gale');
  for (let k = 0; k < 40; k++) { sim.tick(1); clock += 1000; if (st.slime.tummy < 72) sim.feed('cookie', { free: true }); }
  save('pre-jelly-rushed.json', st, 'Save from just before the jelly loop, RUSHED: six slimes moved out as soon as grown up (2B each); a big old Family Bonus.', made);
}

// ---------- 2. the Moving Day tester save (current rules) ----------
{
  const { Sim, createState, migrate } = await import(url.pathToFileURL(path.join(ROOT, 'src/core/sim.js')).href);
  const { movingDayRatio } = await import(url.pathToFileURL(path.join(ROOT, 'src/core/movingday.js')).href);
  const { familyBonusFor } = await import(url.pathToFileURL(path.join(ROOT, 'src/core/ranch.js')).href);
  const { medalFor } = await import(url.pathToFileURL(path.join(ROOT, 'src/core/medals.js')).href);
  const { HELPERS } = await import(url.pathToFileURL(path.join(ROOT, 'src/data/content.js')).href);
  let st = createState(), sim = new Sim(st);
  raise(sim, ['cookie', 'chili'], 'Willow', 3e9);
  sim.moveToRanch(clock); clock += 60000;
  sim = new Sim(st);
  sim.ranch.tickAway(3 * 3600); clock += 3 * 3600 * 1000;
  sim.ranch.collectBasket();
  hatch(sim, 'Pip');
  raise(sim, ['berry', 'moss', 'crystal'], 'Pip', 0);
  // the helpers a player has by then: buy the cheapest helper, again and again, with a budget of 2e11
  st.jelly = 2e11;
  for (let guard = 0; guard < 5000; guard++) {
    const best = HELPERS.map(h => h.id).filter(id => sim.canAfford(sim.helperCost(id))).sort((a, b) => sim.helperCost(a) - sim.helperCost(b))[0];
    if (!best || !sim.buyHelper(best)) break;
  }
  st.jelly = 3e9;
  sim.recompute();
  // how much jelly 5 minutes of ordinary play makes (a boop a second, a snack when hungry), on a copy
  const f = st.ranch.family;
  const need = 1e7 * Math.pow((2 * (1 + f.bonus / 100) - 1) * 100 / 5, 3) - f.lifetime - f.legacy;   // total for R = 2
  const probe = new Sim(migrate(JSON.parse(JSON.stringify(st))));
  probe.s.totalJelly = need;
  const before = probe.s.totalJelly;
  for (let k = 0; k < 300; k++) { probe.boop(); probe.tick(1); if (probe.s.slime.tummy < 60) probe.feed('berry', { free: true }); }
  const gain = probe.s.totalJelly - before;
  st.totalJelly = need - gain * 0.6;   // crosses "ready" after about 3 minutes of that play
  st.slime.medalShown = medalFor(st.totalJelly, true)?.id || null;
  st.tutorial = 99;
  const R = movingDayRatio(st);
  if (!(R < 2 && R > 1.9)) throw new Error('moving-day fixture: R = ' + R);
  console.log('moving day: R', R.toFixed(4), '| R=2 at total', need.toExponential(4), '| 5 min of play makes', gain.toExponential(3), '| jps', sim.jps().toExponential(3), '| familyBonusFor', familyBonusFor(f.lifetime).toFixed(2));
  save('moving-day-almost.json', st, 'Moving Day tester: a Settled slime (Pip, generation 2) with the Moving Day ratio just under 2 ("restless"); it crosses "ready" after about 3 minutes of ordinary play (5 at most).', 'jelly-loop');
}

fs.rmSync(TMP, { recursive: true, force: true });
