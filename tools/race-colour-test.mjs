// Race colour check (plain node): the runner's colours from the colour the game shows (design 4.2; RV2 call approved
// 2026-11-12: "your slime's pixel colour is shifted per design 4.2, and a slime that matches the sample gets the kit's
// colours exactly"). Checked here:
//   shownColour (view/race-colour.js, no three.js) == SlimeAvatar's own body colour (setTraits + the form's tint + Pure +
//   the Dollop's deeper skin, slime.js), computed with three.js the way slime.js does, for 2,400 diets x forms x Pure x mix;
//   the sample diets (the catalog's) give the kit's colours exactly (the same objects, no rounding trip);
//   another diet moves every ramp step and plain pattern colour by the same L*a*b* step; glow patterns and Aurora's bands
//   stay; the Volt (its ramp lives in kit.json) moves too; rivals keep the kit's RIVAL_COLOR ramps.
//   node tools/race-colour-test.mjs
import url from 'node:url';
import path from 'node:path';
import * as THREE from 'three';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
const { TRAITS, TRAIT_IDS } = await import(SRC + '/data/content.js');
const { FORM_LOOKS } = await import(SRC + '/view/forms.js');
const RCOMP = await import(SRC + '/view/race-compose.js');
const { loadRaceKit } = await import('./png-lite.mjs');
let RCOL;
try { RCOL = await import(SRC + '/view/race-colour.js'); } catch (e) { console.log('FAIL - view/race-colour.js loads | ' + e.message); console.log('\n0 passed, 1 failed'); process.exit(1); }
const kit = RCOMP.prepareKit(loadRaceKit(path.resolve(HERE, '../src/assets/race')));

let fails = 0, passes = 0;
const ok = (cond, what, extra = '') => { if (cond) { passes++; console.log('ok   - ' + what + (extra ? ' | ' + extra : '')); } else { fails++; console.log('FAIL - ' + what + (extra ? ' | ' + extra : '')); } };

// slime.js, line for line (setTraits, then update()'s colour block with the colour settled on its target)
const BASE_COLOR = new THREE.Color('#7ee6c3');
const TC = Object.fromEntries(TRAIT_IDS.map(k => [k, new THREE.Color(TRAITS[k].color)]));
function threeShown(traits, look, pure, mk) {
  const entries = TRAIT_IDS.map(k => [k, traits[k] || 0]).filter(e => e[1] > 0.01).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, e) => s + e[1], 0);
  const c = BASE_COLOR.clone();
  if (total > 0) {
    const mix = TC[entries[0][0]].clone();
    if (entries[1]) mix.lerp(TC[entries[1][0]], 0.38 * entries[1][1] / entries[0][1]);
    c.lerp(mix, Math.min(0.85, total / (total + 22)));
    const hsl = {};
    c.getHSL(hsl, THREE.SRGBColorSpace);
    c.setHSL(hsl.h, Math.max(hsl.s, 0.6), Math.min(0.78, Math.max(0.6, hsl.l)), THREE.SRGBColorSpace);
  }
  const shown = c.clone(), h = {};
  if (look && look.tint) shown.lerp(new THREE.Color(look.tint), look.tintAmt || 0.5);
  if (pure) { shown.getHSL(h, THREE.SRGBColorSpace); shown.setHSL(h.h, Math.min(1, h.s * 1.2 + 0.06), Math.min(0.86, h.l + 0.05), THREE.SRGBColorSpace); }
  shown.getHSL(h, THREE.SRGBColorSpace);
  if (mk > 0.001) { h.l = Math.max(0.2, h.l - 0.09 * mk); shown.setHSL(h.h, h.s, h.l, THREE.SRGBColorSpace); }
  return '#' + shown.getHexString();
}

// 1. the shown colour
let rnd = 7;
const R = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
const forms = Object.keys(kit.fc);
let n = 0, bad = [];
for (let i = 0; i < 2400; i++) {
  const traits = {};
  for (const k of TRAIT_IDS) traits[k] = R() < 0.45 ? Math.round(R() * 400 * 100) / 100 : 0;
  if (i % 9 === 0) for (const k of TRAIT_IDS) traits[k] = 0;
  const form = forms[i % forms.length], pure = i % 5 === 0, mk = [0, 0.5, 1, 0.42, 0.77][i % 5];
  const want = threeShown(traits, FORM_LOOKS[form], pure, mk);
  const got = RCOL.shownColour(traits, FORM_LOOKS[form], { pure, mk }).hex;
  n++;
  if (want !== got) bad.push(`${form} ${JSON.stringify(traits)} pure ${pure} mk ${mk}: three ${want} mine ${got}`);
}
ok(!bad.length, `shownColour == slime.js's body colour, hex for hex (${n} diets x 26 forms x Pure x mix)`, bad.slice(0, 2).join('; '));

// 2. the sample: the kit's colours exactly
const fams = ['curly', 'dollop', 'mixed'];
let same = 0, total = 0;
for (const form of forms) for (const fam of fams) {
  total++;
  const c = RCOL.runnerColours(kit, { form, fam, traits: RCOL.SAMPLE_TRAITS(form), pure: false, mix: RCOL.FAMILY_MIX[fam], look: FORM_LOOKS[form] });
  const base = form === 'spark' ? kit.j.families[fam].ramp : kit.fc[form].ramps[fam];
  if (c.shift === null && c.ramps === base && c.fc === kit.fc[form]) same++;
}
ok(same === total, `a slime with the sample's diet (the catalog's) gets the kit's own colour objects: ${same} of ${total} (26 forms x 3 bodies)`);

// 3. another diet: one L*a*b* step for the whole runner
{
  const traits = { heat: 300, sweet: 40 }, form = 'heat', fam = 'curly';
  const c = RCOL.runnerColours(kit, { form, fam, traits, pure: false, mix: 0, look: FORM_LOOKS[form] });
  const d = c.shift;
  const step = (a, b) => { const A = RCOMP.lab(RCOMP.hexrgb(a)), B = RCOMP.lab(RCOMP.hexrgb(b)); return [B[0] - A[0], B[1] - A[1], B[2] - A[2]]; };
  const base = kit.fc[form].ramps[fam].day;
  const moved = Object.keys(base).map(s => step(base[s], c.ramps.day[s]));
  // every step moves by the step, except where sRGB clips it (a light step of a saturated body at the gamut's edge): those
  // move the same way, less far
  const bi = Object.keys(base).indexOf('base');
  const dot = m => (m[0] * d[0] + m[1] * d[1] + m[2] * d[2]) / Math.hypot(...d) ** 2;
  const close = Math.abs(moved[bi][0] - d[0]) < 1.2 && Math.abs(moved[bi][1] - d[1]) < 1.6 && Math.abs(moved[bi][2] - d[2]) < 1.6 && moved.every(m => dot(m) > 0.2 && dot(m) < 1.3);
  ok(d && Math.hypot(...d) > 1 && close, `a hotter Blaze moves its five steps by one L*a*b* step (${d.map(v => v.toFixed(1)).join(', ')}; the base exactly, the light steps clipped by sRGB, the same way)`, moved.map(m => m.map(v => v.toFixed(1)).join('/')).join(' '));
  const want = threeShown(traits, FORM_LOOKS[form], false, 0), sample = threeShown(RCOL.SAMPLE_TRAITS(form), FORM_LOOKS[form], false, 0);
  const dw = step(sample, want);
  ok(Math.abs(dw[0] - d[0]) < 1e-9 && Math.abs(dw[1] - d[1]) < 1e-9, 'the step is (the colour this slime shows) - (the colour the sample shows)', `${sample} -> ${want}`);
  ok(c.fc.pattern.flames && JSON.stringify(c.fc.pattern.flames[fam].day) !== JSON.stringify(kit.fc[form].pattern.flames[fam].day), 'its plain pattern (flames) moves with it');
  ok(c.fc !== kit.fc[form] && kit.fc[form].ramps[fam].day.base === base.base, 'the kit itself is untouched (a copy is shifted)');
}
{
  const c = RCOL.runnerColours(kit, { form: 'heat+mineral', fam: 'dollop', traits: { heat: 250, mineral: 220 }, pure: false, mix: 1, look: FORM_LOOKS['heat+mineral'] });
  ok(c.shift && JSON.stringify(c.fc.pattern.cracks) === JSON.stringify(kit.fc['heat+mineral'].pattern.cracks), 'glow patterns keep their colours (Furnace cracks)');
  const a = RCOL.runnerColours(kit, { form: 'prism+spark', fam: 'dollop', traits: { prism: 300, spark: 50 }, pure: true, mix: 1, look: FORM_LOOKS['prism+spark'] });
  ok(a.shift && JSON.stringify(a.fc.pattern.aurora) === JSON.stringify(kit.fc['prism+spark'].pattern.aurora) && a.ramps.day.base !== kit.fc['prism+spark'].ramps.dollop.day.base, "Aurora's four bands stay; its body ramp moves");
  const v = RCOL.runnerColours(kit, { form: 'spark', fam: 'mixed', traits: { spark: 400 }, pure: false, mix: 0.5, look: FORM_LOOKS.spark });
  ok(v.shift && v.ramps.day.base !== kit.j.families.mixed.ramp.day.base, "the Volt's ramp (kit.json's) moves too");
  const px = RCOMP.composeRunner(kit, { fam: 'mixed', frame: 'idle_0', form: 'spark', ramps: v.ramps });
  ok(px.length === 56 * 56 * 4, 'and composes');
}
// 4. tiny steps: a slime within rounding of the sample keeps the kit's colours
{
  const t = { ...RCOL.SAMPLE_TRAITS('nature'), nature: RCOL.SAMPLE_TRAITS('nature').nature + 0.001 };
  const c = RCOL.runnerColours(kit, { form: 'nature', fam: 'dollop', traits: t, pure: false, mix: 1, look: FORM_LOOKS.nature });
  ok(c.shift === null, 'a slime whose colour shows the same hex as the sample keeps the kit\'s colours exactly');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
