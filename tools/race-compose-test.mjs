// The game's race composer (src/view/race-compose.js) against the race kit's own reference composer, pixel for pixel.
// The reference is Usopp's compose_kit.py (usopp/race-kit @ 48c0f45) run by tools/race-compose-ref.py on the same kit
// files (src/assets/race/, copied unchanged): every form on every body in every Sprint frame, each outfit, outfits
// together, Cat-ears and Topknots, Pure, the ten rivals in their place colours, the other faces, the Volt's sparks,
// a few at night. Also: the ramp rule for each RIVAL_COLOR, and how long a composite takes.
//   node tools/race-compose-test.mjs [--first N]
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { loadRaceKit } from './png-lite.mjs';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
const RC = await import(SRC + '/view/race-compose.js');
const { CONTESTS } = await import(SRC + '/data/content.js');
const REF = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures/race/compose-ref.json'), 'utf8'));
const kit = RC.prepareKit(loadRaceKit(path.resolve(HERE, '../src/assets/race')));
const FIRST = process.argv.includes('--first') ? +process.argv[process.argv.indexOf('--first') + 1] : Infinity;

let fails = 0, passes = 0;
const ok = (cond, what, extra = '') => { if (cond) { passes++; console.log('ok   - ' + what + (extra ? ' | ' + extra : '')); } else { fails++; console.log('FAIL - ' + what + (extra ? ' | ' + extra : '')); } };

// ramps for the place colours
const RIVAL_COLOR = Object.fromEntries(CONTESTS.cups.flatMap(c => c.rivals.map(r => [r.place, r.color])));
const rampBad = Object.entries(REF.rival_ramps).filter(([p, r]) => JSON.stringify(RC.rampRule(RIVAL_COLOR[p])) !== JSON.stringify(r));
ok(!rampBad.length, 'the 4.2 ramp rule: each RIVAL_COLOR gives the kit\'s five steps, hex for hex (10 places)', rampBad.map(([p]) => `${p}: ${JSON.stringify(RC.rampRule(RIVAL_COLOR[p]))} vs ${JSON.stringify(REF.rival_ramps[p])}`).join('; '));
const fest = kit.j.rivals.festival.ramp.day;
ok(JSON.stringify(RC.rampRule('#ff9f80')) === JSON.stringify(fest), "and the kit's own festival rival ramp (kit.json rivals.festival)");

const groups = {};
let n = 0, ms = 0, shown = 0;
const bad = [];
for (const c of REF.cases) {
  if (n >= FIRST) break;
  n++;
  const worn = c.worn.map(w => RC.KIT_OUTFIT[w]);
  const ramps = c.rival ? { day: REF.rival_ramps[c.rival], night: REF.rival_ramps[c.rival] } : null;
  const t0 = performance.now();
  const rgba = RC.composeRunner(kit, { fam: c.fam, frame: c.frame, form: c.form, theme: c.theme, expr: c.expr, worn, pure: c.pure, propFrame: c.prop, spark: c.spark, breed: c.breed, ramps });
  ms += performance.now() - t0;
  const md5 = crypto.createHash('md5').update(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength)).digest('hex');
  const g = c.rival ? 'rivals' : c.theme === 'night' ? 'night' : c.breed ? 'breeds' : c.pure ? 'pure' : c.worn.length > 1 ? 'outfit sets' : c.worn.length ? 'outfits' : c.spark !== null ? 'sparks' : c.expr !== REF.expr[c.frame] ? 'faces' : 'forms';
  groups[g] = groups[g] || [0, 0];
  groups[g][1]++;
  if (md5 === c.md5) { groups[g][0]++; continue; }
  bad.push(c);
  if (c.rgba && shown < 4) {
    shown++;
    const ref = Buffer.from(c.rgba, 'hex'), diff = [];
    for (let p = 0; p < 56 * 56 && diff.length < 6; p++) if (ref[p * 4] !== rgba[p * 4] || ref[p * 4 + 1] !== rgba[p * 4 + 1] || ref[p * 4 + 2] !== rgba[p * 4 + 2] || ref[p * 4 + 3] !== rgba[p * 4 + 3]) diff.push(`(${p % 56},${(p / 56) | 0}) ref ${[...ref.subarray(p * 4, p * 4 + 4)]} got ${[...rgba.subarray(p * 4, p * 4 + 4)]}`);
    console.log(`  diff ${c.form}/${c.fam}/${c.frame}/${c.expr} worn ${c.worn} breed ${c.breed} pure ${c.pure}: ${diff.join('; ')}`);
  }
}
for (const [g, [a, t]] of Object.entries(groups)) ok(a === t, `${g}: ${a} of ${t} composites byte-identical to the kit's composer`, bad.filter(c => (c.rival ? 'rivals' : '') === g).slice(0, 3).map(c => `${c.form}/${c.fam}/${c.frame}`).join(' '));
ok(!bad.length, `all ${n} reference composites byte-identical`, bad.slice(0, 6).map(c => `${c.form}/${c.fam}/${c.frame}/${c.expr}${c.worn.length ? '/' + c.worn : ''}${c.breed ? '/' + c.breed : ''}${c.rival ? '/' + c.rival : ''}`).join(' '));
console.log(`(${(ms / n).toFixed(2)} ms a composite in node, ${n} composites)`);
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
