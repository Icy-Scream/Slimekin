// Makes the old-save fixtures in this folder by running the game rules as they are on `main` (before
// breeding), so tools/breeding-test.mjs can check that saves from phones today keep working.
// Files are read with `git show main:<path>` into a temporary folder (nothing is checked out).
//   node tools/fixtures/make-old-saves.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'slimekin-main-'));
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', 'main', 'src/core', 'src/data'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
for (const f of files) {
  fs.mkdirSync(path.join(TMP, path.dirname(f)), { recursive: true });
  fs.writeFileSync(path.join(TMP, f), execFileSync('git', ['show', `main:${f}`], { cwd: ROOT }));
}
const commit = execFileSync('git', ['rev-parse', '--short', 'main'], { cwd: ROOT, encoding: 'utf8' }).trim();

// fixed clock and dice, so the fixtures are the same every time
let rnd = 4242; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
let clock = Date.UTC(2026, 9, 20, 15, 0, 0); Date.now = () => clock;

const { Sim, createState } = await import(url.pathToFileURL(path.join(TMP, 'src/core/sim.js')).href);
const save = (name, st, note) => {
  st.savedAt = clock;
  fs.writeFileSync(path.join(HERE, name), JSON.stringify({ note, madeWith: `main ${commit}`, save: st }, null, 1) + '\n');
  console.log('wrote', name, '| phase', st.phase, '| generation', st.ranch.family.generation, '| residents', st.ranch.residents.length);
};
// raise the current slime to Settled on a diet (fed for free; the jelly shown is what play would have made)
const raise = (sim, diet, name) => {
  const st = sim.s;
  st.phase = 'play'; st.slime.name = name; st.slime.bornAt = clock;
  let i = 0;
  for (let guard = 0; guard < 200000 && sim.stageIndex() < 3; guard++) {
    sim.tick(1); clock += 1000;
    if (st.slime.tummy < 72) { const pool = diet.filter(f => sim.foodUnlocked(f)); sim.feed((pool.length ? pool : ['cookie'])[i++ % (pool.length || 1)], { free: true }); }
  }
  for (let k = 0; k < 600; k++) { sim.boop(); sim.tick(0.5); clock += 500; }
  st.totalJelly = Math.max(st.totalJelly, 2e9); st.jelly = 5e7;
  sim.remember('⭐', `${name} settled.`, 'form');
};

// 1. a brand-new egg
save('main-egg.json', createState(), 'Fresh save on main: an egg, nothing else.');

// 2. a grown-up (Settled) slime, never moved to the ranch
let st = createState();
let sim = new Sim(st);
raise(sim, ['cookie', 'chili'], 'Juniper');
st.outfits.owned.push('bow'); st.outfits.worn.head = 'bow';
save('main-settled.json', st, 'Save on main: generation 1, a Settled Hearth Slime, a bow, no ranch yet.');

// 3. generation 2: the Settled slime moved to the ranch, the new baby hatched and is growing
sim.moveToRanch(clock); clock += 60000;
sim = new Sim(st);
st.phase = 'play'; st.slime.name = 'Pebble'; st.slime.bornAt = clock;
for (let k = 0; k < 40; k++) { sim.tick(1); clock += 1000; if (st.slime.tummy < 72) sim.feed('iron', { free: true }); }
sim.ranch.tickAway(3 * 3600); clock += 3 * 3600 * 1000;
sim.ranch.collectBasket();
save('main-gen2.json', st, 'Save on main: generation 2 with one ranch resident (Juniper), a young baby, pearls.');

// 4. generation 3: two residents (a Hearth and a Marshmallow: a spark pair once breeding exists)
st.slime.growth = 0; st.slime.traits = Object.fromEntries(Object.keys(st.slime.traits).map(k => [k, 0]));
raise(sim, ['cookie', 'chili', 'iron', 'moss', 'berry', 'crystal'], 'Pebble');
sim.moveToRanch(clock); clock += 60000;
sim = new Sim(st);
sim.ranch.tickAway(6 * 3600); clock += 6 * 3600 * 1000;
sim.ranch.collectBasket();
save('main-gen3.json', st, 'Save on main: generation 3, two ranch residents (Hearth and Marshmallow), the new egg not hatched yet.');

fs.rmSync(TMP, { recursive: true, force: true });
