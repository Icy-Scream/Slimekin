// Recipe body check (plain node, no browser): the recipes and blends (BREEDS in content.js, core/recipe.js), the
// body points they make (view/body.js, the same pure math the slime draws), the body's dice (plain eggs, Nursery eggs,
// special eggs; seeded, never rerolled), special eggs for pearls, the Wishing Star, and old saves.
//   node tools/recipe-test.mjs                 (add "verbose" for more detail)
//   RECIPE_BASE=<checkout of the base commit> node tools/recipe-test.mjs
//        also migrates every fixture with that checkout's code and checks that, without the new body fields, the
//        saves come out byte for byte the same
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
const VERBOSE = process.argv.includes('verbose');
let rnd = 777; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);

const { Sim, createState, migrate } = await import(SRC + '/core/sim.js');
const R = await import(SRC + '/core/recipe.js');
const Bd = await import(SRC + '/core/breeding.js');
const Body = await import(SRC + '/view/body.js');
const C = await import(SRC + '/data/content.js');
const { BREEDS, BREEDING, HEIRLOOM_BY_ID } = C;

let fails = 0, passes = 0;
const ok = (cond, what, extra = '') => { if (cond) { passes++; console.log('ok   - ' + what + (extra ? ' | ' + extra : '')); } else { fails++; console.log('FAIL - ' + what + (extra ? ' | ' + extra : '')); } };
const clone = x => JSON.parse(JSON.stringify(x));
const HOUR = 3600 * 1000;
const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);
const BODIES = [];   // every breed x variant: { name, mix, variant }
for (const variant of R.VARIANTS) BODIES.push({ name: `dollop/${variant}`, mix: 1, variant });
BODIES.push({ name: 'curly', mix: 0, variant: 'plain' });
const M_GRID = Array.from({ length: 21 }, (_, i) => i / 20);
const MIX_GRID = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1];
const GENE_SETS = [R.neutralGenes(), { tall: 1.08, wide: 1.07, lump: 1.35, side: 0.04 }, { tall: 0.92, wide: 0.93, lump: 0.65, side: -0.04 }];

// ---------- 1. recipes, blends and the body they make ----------
console.log('# 1. Every recipe and blend is a sound body (breeds x variants x growth x mix x genes)');
{
  // directions to sample the body at: rings from the top to the bottom, all the way around
  const dirs = [];
  for (const el of [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 85]) for (let az = 0; az < 360; az += 30) {
    const e = el * Math.PI / 180, a = az * Math.PI / 180;
    dirs.push([Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a), a]);
  }
  let n = 0, badNum = [], badBody = [], minR = 9, minTop = 9, minCurl = 9, maxR = 0;
  const o = { x: 0, y: 0, z: 0 };
  for (const variant of R.VARIANTS) for (const mix of MIX_GRID) for (const m of M_GRID) for (const genes of GENE_SETS) {
    if (mix === 0 && variant !== 'plain') continue;
    const S = R.recipeFor({ mix, variant, genes }, m);
    n++;
    const nums = [...R.KEYS.map(k => S[k]), ...S.bumps.flatMap(([d, a, w]) => [...d, a, w]), ...S.knobs.flatMap(([d, a, w, k]) => [...d, a, w, k])];
    if (!nums.every(Number.isFinite)) { badNum.push(`${variant} mix ${mix} m ${m}`); continue; }
    // the resting body: every sampled point finite; the waist wide, the top high, the curl thick enough
    for (const T of [0, 7.3]) {
      let rWaist = 9, top = -9, fin = true;
      for (const [x, y, z, a] of dirs) {
        Body.restShape(x, y, z, a, S, T, null, o);
        if (!Number.isFinite(o.x + o.y + o.z)) fin = false;
        if (Math.abs(y) < 0.01) rWaist = Math.min(rWaist, Math.hypot(o.x, o.z));
        top = Math.max(top, o.y);
      }
      const F = Body.curlFrame(S, T, null, { sx: 0, sz: 0 }, 0, 0, 0);
      const curlOk = S.armK <= 0.001 || (F && Number.isFinite(F.r0 + F.C[0] + F.C[1] + F.C[2]) && F.r0 > S.ra && Math.min(S.ra, S.rt) > 0.08);
      minR = Math.min(minR, rWaist); maxR = Math.max(maxR, rWaist); minTop = Math.min(minTop, top);
      if (S.armK > 0.001) minCurl = Math.min(minCurl, S.ra, S.rt);
      if (!fin || rWaist < 0.6 || top < 0.9 || !curlOk) badBody.push(`${variant} mix ${mix} m ${m} T ${T}: waist ${rWaist.toFixed(2)}, top ${top.toFixed(2)}, curl ${curlOk}`);
    }
  }
  ok(!badNum.length, `every recipe number is finite (${n} recipes)`, badNum.slice(0, 3).join('; '));
  ok(!badBody.length, 'every body point is finite; nothing collapses: waist radius >= 0.6, top >= 0.9, curl thickness >= 0.08 (its base wider than its tip ring)',
    badBody.length ? badBody.slice(0, 3).join('; ') : `waist ${minR.toFixed(2)}..${maxR.toFixed(2)}, lowest top ${minTop.toFixed(2)}, thinnest curl ${minCurl.toFixed(3)}`);
  // the topologies: the pet's and the light body
  for (const kind of ['full', 'lite']) {
    const T = Body.bodyTopology(kind);
    let maxI = 0; for (const i of T.index) maxI = Math.max(maxI, i);
    const unit = [...Array(T.count).keys()].every(i => Math.abs(Math.hypot(T.base[i * 3], T.base[i * 3 + 1], T.base[i * 3 + 2]) - 1) < 1e-5);
    ok(T.count === (kind === 'full' ? 5618 : 1370) && maxI === T.count - 1 && T.index.length % 3 === 0 && unit, `the ${kind} body: ${T.count} points on the unit sphere, ${T.index.length / 3} triangles, every index in range`);
  }
}

// ---------- 2. blending ----------
console.log('\n# 2. Blending: every number lerps, features grow or melt by their size');
{
  const near = (a, b, e = 1e-12) => Math.abs(a - b) <= e;
  const sumByDir = list => { const m = new Map(); for (const [d, a] of list) { const k = d.map(v => v.toFixed(6)).join(','); m.set(k, (m.get(k) || 0) + a); } return m; };
  let same = true;
  for (const b of BODIES) for (const m of [0, 0.3, 0.5, 0.8, 1]) for (const t of [0, 0.37, 1]) {
    const a = R.recipeFor(b, m), x = R.blend(a, a, t);
    if (!R.KEYS.every(k => near(x[k], a[k]))) same = false;
    for (const key of ['bumps', 'knobs']) {
      const sa = sumByDir(a[key]), sx = sumByDir(x[key]);
      for (const [k, v] of sa) if (!near(sx.get(k) || 0, v, 1e-12)) same = false;
    }
  }
  ok(same, 'blend(a, a, t) == a for every breed, growth and t (numbers equal; each bump and knob keeps its size)');
  const cur = R.recipeFor({ mix: 0 }, 1), ears = R.recipeFor({ mix: 1, variant: 'ears' }, 0);
  const b0 = R.blend(cur, ears, 0), b1 = R.blend(cur, ears, 1);
  ok(b0.knobs.length === ears.knobs.length && b0.knobs.every(k => k[1] === 0) && b1.bumps.slice(0, cur.bumps.length).every(k => k[1] === 0) && b1.knobs.every((k, i) => k[1] === ears.knobs[i][1]),
    'features fade by size: at t = 0 the far recipe\'s knobs are size 0, at t = 1 the near one\'s are', `${ears.knobs.length} ear knobs`);
  ok(R.recipeFor({ mix: 0 }, 0).knobs.length === 0 && R.recipeFor({ mix: 0 }, 0).armK === 1 && R.recipeFor({ mix: 1 }, 1).armK === 0, 'a Curly has its curl and no knobs; a Dollop has no curl');
  const e0 = R.recipeFor({ mix: 1, variant: 'ears' }, 0), e1 = R.recipeFor({ mix: 1, variant: 'ears' }, 1), t1 = R.recipeFor({ mix: 1, variant: 'topknot' }, 1), p1 = R.recipeFor({ mix: 1, variant: 'plain' }, 1);
  const live = S => S.knobs.filter(k => k[1] > 0.002).map(k => +k[1].toFixed(3));
  ok(live(e0).join() === '0.26,0.25' && live(e1).join() === '0.17,0.16' && live(t1).join() === '0.15' && live(p1).length === 0,
    'special types keep a smaller ear / knob when grown (the special-types sheet); a plain Dollop grows into the plain dome', `ears ${live(e0)} -> ${live(e1)}, topknot -> ${live(t1)}, plain -> none`);
  const half = R.recipeFor({ mix: 0.5, variant: 'ears' }, 1);
  ok(near(half.armK, 0.5) && live(half).join() === '0.085,0.08', 'an in-between (mix 0.5) has half a curl and half-size ears', `armK ${half.armK}, ears ${live(half)}`);
  // growth eases along the stages
  ok(R.stageM(0, 0) === 0 && R.stageM(1, 0) === 0.35 && Math.abs(R.stageM(1, 0.5) - 0.5) < 1e-12 && R.stageM(3, 0) === 1 && R.stageM(2, 1) === 1, 'shape number m for the stages: 0, 0.35, 0.65, 1, blended along each stage');
}

// ---------- 3. the body's dice ----------
console.log('\n# 3. The body\'s dice: plain eggs hatch pure, Nursery eggs blend, special eggs are guaranteed');
{
  const N = 20000; let cur = 0, dol = 0, sp = 0, spEars = 0, other = 0, geneOut = 0;
  for (let i = 0; i < N; i++) {
    const b = R.rollPlainEgg('t' + i);
    if (b.mix === 0 && b.breed === 'curly' && b.variant === 'plain') cur++;
    else if (b.mix === 1 && b.breed === 'dollop') { dol++; if (b.variant !== 'plain') { sp++; if (b.variant === 'ears') spEars++; } }
    else other++;
    const G = BREEDS.geneRange;
    if (Math.abs(b.genes.tall - 1) > G.tall || Math.abs(b.genes.wide - 1) > G.wide || Math.abs(b.genes.lump - 1) > G.lump || Math.abs(b.genes.side) > G.side) geneOut++;
  }
  ok(other === 0, `plain eggs hatch only pure bodies: mix 0 (Curly) or 1 (Dollop), never an in-between (${N} eggs)`, `${cur} Curly, ${dol} Dollop`);
  ok(Math.abs(cur / N - 0.5) < 0.02, 'Curly and Dollop about 50 / 50 (BREEDS.hatch)', `${(cur / N * 100).toFixed(1)}% Curly`);
  ok(Math.abs(sp / dol - BREEDS.surprise) < 0.008 && Math.abs(spEars / sp - 0.5) < 0.08, 'a surprise special Dollop in about 1 of 20 Dollop hatches, ears or topknot about evenly', `${sp} of ${dol} (${(sp / dol * 100).toFixed(2)}%), ${spEars} with ears`);
  ok(geneOut === 0, 'genes stay inside BREEDS.geneRange');
  let sp2 = 0, d2 = 0;
  for (let i = 0; i < N; i++) { const b = R.rollPlainEgg('t' + i, { surpriseMult: 2 }); if (b.mix === 1) { d2++; if (b.variant !== 'plain') sp2++; } }
  ok(Math.abs(sp2 / d2 - 2 * BREEDS.surprise) < 0.01, 'with the Wishing Star (rareEggs x2): about 1 in 10', `${sp2} of ${d2} (${(sp2 / d2 * 100).toFixed(2)}%)`);
  ok(JSON.stringify(R.rollPlainEgg('same')) === JSON.stringify(R.rollPlainEgg('same')) && JSON.stringify(R.rollPlainEgg('same')) !== JSON.stringify(R.rollPlainEgg('other')), 'same seed, same body; another seed, another body');

  // Nursery eggs
  const res = (id, mix, variant = 'plain', genes = R.neutralGenes()) => ({ id, name: id, form: { id: 'sweet', name: 'Candy Slime' }, traits: { sweet: 200 }, personality: {}, breed: R.breedOf(mix), mix, variant, genes, lineage: { line: 1, parents: [] } });
  let mixes = [], cc = new Set(), dd = new Set(), passEars = 0, nEars = 0, flip = 0;
  for (let i = 0; i < 2000; i++) {
    const now = NOW + i * 1000;
    const e = Bd.makeEgg(res('a', 0), res('b', 1, i % 2 ? 'ears' : 'plain', { tall: 1.06, wide: 0.95, lump: 1.2, side: 0.02 }), { now, id: 'e' + i });
    mixes.push(e.body.mix);
    if (i % 2) { nEars++; if (e.body.variant === 'ears') passEars++; }
    cc.add(Bd.makeEgg(res('a', 0), res('c', 0), { now, id: 'x' }).body.mix);
    const d = Bd.makeEgg(res('a', 1, 'topknot'), res('c', 1), { now, id: 'y' }).body; dd.add(d.mix + d.breed);
    if (JSON.stringify(Bd.makeEgg(res('a', 0), res('b', 1), { now, id: 'z' }).body) !== JSON.stringify(Bd.makeEgg(res('b', 1), res('a', 0), { now, id: 'z' }).body)) flip++;
  }
  const lo = Math.min(...mixes), hi = Math.max(...mixes);
  ok(lo >= 0.25 && hi <= 0.75 && hi - lo > 0.45 && mixes.every(m => R.breedOf(m) === 'mixed'), 'Curly x Dollop eggs: an in-between, mix seeded in 0.25 .. 0.75', `${mixes.length} eggs, mix ${lo.toFixed(3)} .. ${hi.toFixed(3)}`);
  ok(cc.size === 1 && cc.has(0) && dd.size === 1 && dd.has('1dollop'), 'two Curlys make a Curly, two Dollops a Dollop');
  ok(Math.abs(passEars / nEars - BREEDS.passSpecial) < 0.06, 'a parent with ears passes them on by a fair seeded chance (about half), else plain', `${passEars} of ${nEars}`);
  ok(flip === 0, 'the same egg whichever way round the parents are picked');
  const g = Bd.makeEgg(res('a', 0, 'plain', { tall: 1.08, wide: 1.07, lump: 1.35, side: 0.04 }), res('b', 0, 'plain', { tall: 1.08, wide: 1.07, lump: 1.35, side: 0.04 }), { now: NOW, id: 'g' }).body.genes;
  ok(g.tall <= 1.08 && g.wide <= 1.07 && g.lump <= 1.35 && g.side <= 0.04 && g.tall > 1.05, 'genes: the parents\' average plus a small wobble, never past what an egg can hatch', JSON.stringify(g));
}

// ---------- 4. saves: fixed when the egg is made ----------
console.log('\n# 4. A slime\'s body is fixed when its egg is made, and survives saving and reloading');
{
  const st = createState();
  ok(typeof st.egg.seed === 'string' && ['curly', 'dollop'].includes(st.slime.breed) && JSON.stringify(R.rollPlainEgg(st.egg.seed)) === JSON.stringify({ breed: st.slime.breed, variant: st.slime.variant, mix: st.slime.mix, genes: st.slime.genes }),
    'a new game: the egg has a seed and the slime the body rolled from it', `${st.egg.seed} -> ${R.bodyName(st.slime)}`);
  const again = migrate(clone(st));
  ok(['breed', 'variant', 'mix', 'genes'].every(k => JSON.stringify(again.slime[k]) === JSON.stringify(st.slime[k])) && again.egg.seed === st.egg.seed, 'save and reload: the same breed, variant, mix and genes (never rerolled)');
  // move-out: a plain egg next; the resident keeps its body
  const sim = new Sim(st); st.phase = 'play'; st.slime.name = 'Ann'; st.slime.growth = 1601; st.slime.form = { id: 'sweet', name: 'Candy Slime' };
  const body = R.cleanBody(st.slime);
  const r = sim.moveToRanch(NOW);
  const x = st.ranch.residents[0];
  ok(r && JSON.stringify(R.cleanBody(x)) === JSON.stringify(body) && x.breed === body.breed, 'moving to the ranch: the resident keeps its body', R.bodyName(x));
  ok(st.egg.seed && JSON.stringify(R.rollPlainEgg(st.egg.seed)) === JSON.stringify(R.cleanBody(st.slime)), 'the next plain egg has its own seed and body', `${st.egg.seed} -> ${R.bodyName(st.slime)}`);
  // the Wishing Star: the next plain egg's surprise chance doubles (same dice)
  let seedHit = null;
  for (let i = 0; i < 5000 && !seedHit; i++) { const a = R.rollPlainEgg('w' + i), b = R.rollPlainEgg('w' + i, { surpriseMult: 2 }); if (a.variant === 'plain' && b.variant !== 'plain') seedHit = 'w' + i; }
  const st2 = createState(); const sim2 = new Sim(st2); st2.egg.seed = seedHit; st2.heirlooms.owned.push('wishstar');
  sim2.rollPlainBody();
  ok(HEIRLOOM_BY_ID.wishstar.buyable !== false && HEIRLOOM_BY_ID.wishstar.fx.rareEggs === 2 && st2.slime.variant !== 'plain', 'the Wishing Star is for sale and really works: an egg that would hatch plain hatches special with it', `${seedHit}: ${R.bodyName(st2.slime)}`);
}

// ---------- 5. special eggs for pearls ----------
console.log('\n# 5. Special eggs: bought with pearls, the type guaranteed, the nest limit, friendly refusals');
{
  const st = createState(); const sim = new Sim(st); const rr = sim.ranch, Rn = st.ranch;
  Rn.pearls = 100;
  ok(rr.canBuySpecialEgg('shark').reason === 'missing', 'an unknown special egg: refused');
  const a = rr.buySpecialEgg('ears', NOW);
  ok(a && Rn.pearls === 100 - BREEDS.specialEggs.ears.price && a.egg.special === 'ears' && a.egg.body.breed === 'dollop' && a.egg.body.variant === 'ears' && a.egg.body.mix === 1 && a.first,
    `a Cat-ear egg costs ${BREEDS.specialEggs.ears.price} pearls and is a Cat-ear Dollop, guaranteed`, `${Rn.pearls} pearls left`);
  ok(a.egg.readyAt - a.egg.laidAt === BREEDING.readyHours * HOUR && rr.eggs().length === 1 && a.egg.parents.length === 0, 'it waits in the Nursery like a bred egg (same warm time)', `${(a.egg.readyAt - a.egg.laidAt) / 60000} min`);
  const poor = rr.canBuySpecialEgg('topknot');
  ok(!poor.ok && poor.reason === 'pearls' && poor.cost === 75 && rr.buySpecialEgg('topknot', NOW) === null && Rn.pearls === 25, 'not enough pearls: refused, nothing spent', JSON.stringify(poor));
  Rn.pearls = 200;
  rr.buySpecialEgg('topknot', NOW + 1);
  const full = rr.canBuySpecialEgg('ears');
  ok(!full.ok && full.reason === 'full' && rr.buySpecialEgg('ears', NOW + 2) === null && rr.eggs().length === BREEDING.maxEggs && Rn.pearls === 125, `the nest holds ${BREEDING.maxEggs}: refused when full`, JSON.stringify(full));
  ok(Bd.eggLabel(a.egg) === 'the Cat-ear egg' && Bd.eggLabel(a.egg, { cap: true }) === 'The Cat-ear egg', 'its name in sentences: "the Cat-ear egg"');
  // chosen at move-out (still warming), then hatched
  st.phase = 'play'; st.slime.name = 'Bo'; st.slime.growth = 1601; st.slime.form = { id: 'sweet', name: 'Candy Slime' };
  const m = sim.moveToRanch(NOW + 10 * 60000, { eggId: a.egg.id });
  ok(m && st.phase === 'egg' && st.egg.bred.special === 'ears' && st.slime.breed === 'dollop' && st.slime.variant === 'ears' && st.slime.lineage.special === 'ears' && st.slime.lineage.parents.length === 0 && !sim.eggReady(NOW + 10 * 60000),
    'chosen at move-out while still warming: it goes on the cushion, a Cat-ear Dollop inside', st.memories[0].text);
  // swapped onto the cushion instead
  const swap = sim.swapCushionEgg(rr.eggs()[0].id, NOW + 20 * 60000);
  ok(swap && st.slime.variant === 'topknot' && st.slime.mix === 1 && rr.eggs().some(e => e.special === 'ears'), 'swapped onto the cushion: a Topknot Dollop inside; the Cat-ear egg goes back to the Nursery');
  // the Patchwork Quilt halves the warm time, as for bred eggs
  const st3 = createState(); const s3 = new Sim(st3); st3.ranch.pearls = 75; st3.heirlooms.owned.push('quilt');
  const q = s3.ranch.buySpecialEgg('topknot', NOW);
  ok(q.egg.readyAt - q.egg.laidAt === 0.5 * HOUR, 'the Patchwork Quilt makes it warm twice as fast, like a bred egg');
  ok(JSON.stringify(migrate(clone(st)).ranch.nursery.eggs) === JSON.stringify(st.ranch.nursery.eggs), 'special eggs survive saving and reloading');
}

// ---------- 6. every number comes from content.js ----------
console.log('\n# 6. Every number comes from BREEDS in content.js');
{
  const keep = clone({ hatch: BREEDS.hatch, surprise: BREEDS.surprise, price: BREEDS.specialEggs.ears.price, mixBetween: BREEDS.mixBetween, geneRange: BREEDS.geneRange, tall: BREEDS.curly.grow.tall, teen: BREEDS.dollop.variants.plain.teen.body.tall, stageM: BREEDS.stageM, passSpecial: BREEDS.passSpecial });
  const changes = [];
  BREEDS.hatch = { curly: 0, dollop: 1 }; changes.push(['hatch weights', R.rollPlainEgg('q1').breed === 'dollop' && R.rollPlainEgg('q2').breed === 'dollop']);
  BREEDS.surprise = 1; changes.push(['surprise chance', R.rollPlainEgg('q3').variant !== 'plain']);
  BREEDS.specialEggs.ears.price = 10; { const st = createState(); st.ranch.pearls = 10; changes.push(['special egg price', new Sim(st).ranch.buySpecialEgg('ears', NOW) && st.ranch.pearls === 0]); }
  BREEDS.mixBetween = [0.5, 0.5]; changes.push(['in-between mix', R.rollBredEgg({ mix: 0 }, { mix: 1 }, 's').mix === 0.5]);
  BREEDS.geneRange = { tall: 0, wide: 0, lump: 0, side: 0 }; changes.push(['gene range', JSON.stringify(R.rollPlainEgg('q4').genes) === JSON.stringify(R.neutralGenes())]);
  BREEDS.curly.grow.tall = [2, 2]; changes.push(['Curly recipe', R.recipeFor({ mix: 0 }, 0.5).tall === 2]);
  BREEDS.dollop.variants.plain.teen.body.tall = 3; changes.push(['Dollop recipe', R.recipeFor({ mix: 1 }, 0.5).tall === 3]);
  BREEDS.stageM = [0, 0.5, 0.6, 1]; changes.push(['stage growth', R.stageM(1, 0) === 0.5]);
  BREEDS.passSpecial = 1; changes.push(['passing ears on', R.rollBredEgg({ mix: 1, variant: 'ears' }, { mix: 1 }, 's').variant === 'ears']);
  Object.assign(BREEDS, { hatch: keep.hatch, surprise: keep.surprise, mixBetween: keep.mixBetween, geneRange: keep.geneRange, stageM: keep.stageM, passSpecial: keep.passSpecial });
  BREEDS.specialEggs.ears.price = keep.price; BREEDS.curly.grow.tall = keep.tall; BREEDS.dollop.variants.plain.teen.body.tall = keep.teen;
  ok(changes.every(c => c[1]), 'changing BREEDS changes the rules and the recipes', changes.map(([k, v]) => `${k} ${v ? 'yes' : 'NO'}`).join(', '));
  const src = fs.readFileSync(path.resolve(HERE, '../src/core/recipe.js'), 'utf8').replace(/\/\/.*$/gm, '');
  const nums = [...src.matchAll(/(?<![\w.])(\d+\.\d+|\d{2,})(?![\w.])/g)].map(m => m[1]).filter(v => !['0.001', '0.999', '1e-6'].includes(v));
  ok(nums.length === 0, 'core/recipe.js has no tuning numbers of its own (only 0, 1, 2 and the blend guards 0.001 / 0.999)', nums.join(', ') || 'none');
}

// ---------- 7. old saves ----------
console.log('\n# 7. Old saves: every slime, resident and egg becomes a Curly (plain, mix 0, neutral genes); nothing else changes');
{
  const FIX = path.resolve(HERE, 'fixtures');
  const BASE = process.env.RECIPE_BASE ? url.pathToFileURL(path.resolve(process.env.RECIPE_BASE, 'src')).href : null;
  const baseSim = BASE ? await import(BASE + '/core/sim.js') : null;
  const isOld = x => x && x.breed === 'curly' && x.variant === 'plain' && x.mix === 0 && JSON.stringify(x.genes) === JSON.stringify(R.neutralGenes());
  const leaves = (x, p = '', out = []) => { if (x && typeof x === 'object') { for (const k of Object.keys(x)) leaves(x[k], p + '/' + k, out); } else out.push([p, x]); return out; };
  const strip = st => {
    const s = clone(st);
    for (const k of ['breed', 'variant', 'mix', 'genes']) delete s.slime[k];
    delete s.egg.seed; if (s.egg.bred) delete s.egg.bred.body; delete s.slime.lineage.special;
    for (const x of s.ranch.residents) for (const k of ['breed', 'variant', 'mix', 'genes']) delete x[k];
    for (const e of s.ranch.nursery.eggs) delete e.body;
    delete s.ranch.nursery.bought;
    return s;
  };
  for (const f of fs.readdirSync(FIX).filter(f => f.endsWith('.json')).sort()) {
    const raw = JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8')).save;
    const st = migrate(clone(raw));
    const all = [st.slime, ...st.ranch.residents, ...st.ranch.nursery.eggs.map(e => e.body), ...(st.egg.bred ? [st.egg.bred.body] : [])];
    ok(all.every(isOld) && st.egg.seed === null, `${f}: ${all.length} bod${all.length === 1 ? 'y' : 'ies'} (the slime${st.ranch.residents.length ? `, ${st.ranch.residents.length} resident(s)` : ''}${st.ranch.nursery.eggs.length ? `, ${st.ranch.nursery.eggs.length} Nursery egg(s)` : ''}), all Curly, plain, mix 0, neutral genes; the old egg has no seed`, `phase ${st.phase}`);
    // nothing the save already had changes
    const before = new Map(leaves(raw)), changed = [];
    for (const [p, v] of leaves(st)) if (before.has(p) && JSON.stringify(before.get(p)) !== JSON.stringify(v) && !/^\/(v|savedAt)$/.test(p)) changed.push(p);
    ok(changed.length === 0, `${f}: every value the save already had is unchanged`, changed.slice(0, 4).join(', '));
    ok(JSON.stringify(migrate(clone(st))) === JSON.stringify(st), `${f}: migrating again changes nothing`);
    if (baseSim) {
      Math.random = (() => { let r = 99; return () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648); })();
      const a = baseSim.migrate(clone(raw));
      Math.random = (() => { let r = 99; return () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648); })();
      const b = strip(migrate(clone(raw)));
      a.createdAt = b.createdAt = 0;
      ok(JSON.stringify(a) === JSON.stringify(b), `${f}: the same save as the base commit's migration, apart from the new body fields`);
    }
  }
  if (!baseSim) console.log('(set RECIPE_BASE to a checkout of the base commit to compare migrations byte for byte)');
}

// ---------- 8. the Cozy Scarf fits every body ----------
// The avatar's own shape() (view/slime.js, every physics term) on a stand-in for the avatar, so this checks exactly
// what is drawn; view/slime.js imports three.js, so this section needs it (as the browser tests do, through NODE_PATH).
console.log('\n# 8. The Cozy Scarf follows the body\'s real outline just under the mouth (every body, stage, form; squash, lean, wobble, boops)');
{
  const mod = await import('node:module');
  let three = null;
  try { three = path.resolve(path.dirname(mod.createRequire(import.meta.url).resolve('three')), '..'); } catch { /* not installed */ }
  if (three && (mod.registerHooks || mod.register)) {
    const to = f => url.pathToFileURL(path.join(three, f)).href;
    if (mod.registerHooks) mod.registerHooks({ resolve: (s, c, next) => s === 'three' ? { url: to('build/three.module.js'), shortCircuit: true }
      : s.startsWith('three/addons/') ? { url: to('examples/jsm/' + s.slice(13)), shortCircuit: true } : next(s, c) });
    else mod.register('data:text/javascript,' + encodeURIComponent(`const M=${JSON.stringify(to('build/three.module.js'))},A=${JSON.stringify(to('examples/jsm/'))};
      export async function resolve(s,c,n){return s==='three'?{url:M,shortCircuit:true}:s.startsWith('three/addons/')?{url:A+s.slice(13),shortCircuit:true}:n(s,c);}`));
  }
  const V = three ? await import(SRC + '/view/slime.js').catch(e => (console.log(String(e)), null)) : null;
  if (!V) ok(false, 'the scarf check needs three.js next to the browser tests (npm install --no-save three@0.170.0, see tools/smoke-test.cjs)');
  else {
    const Sc = await import(SRC + '/view/scarf.js');
    const { FORM_LOOKS } = await import(SRC + '/view/forms.js');
    const { OUTFIT_MAKERS } = await import(SRC + '/view/models.js');
    const { FACE_H, FaceRenderer } = await import(SRC + '/view/face.js');
    const P = V.SlimeAvatar.prototype, F = FaceRenderer.prototype, TAU = Math.PI * 2, o = { x: 0, y: 0, z: 0 };
    // face.js draws the mouth at mouthY 196 on the face canvas, which covers 0.9 radians of the body (slime.js
    // setFaceEl); the mouth reaches mouthLow() px under that (the Curly's smile, or the mouth open to eat)
    const MOUTH_Y = 196, FACE_EL = 0.9;
    const avatar = (body, m, form = null, T = 0, dyn = {}) => {
      const S = R.recipeFor(body, m), look = form ? FORM_LOOKS[form] : null;
      const face = { mixK: body.mix, grown: Body.smooth(0.5, 1, m), smileK: F.smileK };
      return { S, curl: null, time: T, formShape: look && look.shape ? { tall: 1, wide: 1, lumpy: 0, square: 0, ...look.shape } : null,
        wobble: dyn.wobble || 0, dents: dyn.dents || [], gulp: null, nubList: [], pull: { amt: 0 }, sq: { x: dyn.sq || 0 }, leanX: { x: dyn.lx || 0 },
        leanZ: { x: dyn.lz || 0 }, tipGrab: 0, liveSizes: P.liveSizes, shape: P.shape,
        chinEl: S.faceEl + (0.5 - (MOUTH_Y + F.mouthLow.call(face)) / FACE_H) * FACE_EL };
    };
    // the body's radius around the ring's axis at height y, at azimuth phi (the direction found by bisection)
    const surface = (av, phi, y, C) => {
      let dp = phi;
      for (let it = 0; it < 2; it++) {
        let lo = -1.5, hi = 1.5;
        for (let k = 0; k < 24; k++) { const e = (lo + hi) / 2; av.shape(Math.cos(e) * Math.cos(dp), Math.sin(e), Math.cos(e) * Math.sin(dp), dp, o); if (o.y < y) lo = e; else hi = e; }
        const d = Math.atan2(o.z - C[2], o.x - C[0]) - phi; dp -= Math.atan2(Math.sin(d), Math.cos(d));
      }
      return Math.hypot(o.x - C[0], o.z - C[2]);
    };
    const parts = V.scarfParts(OUTFIT_MAKERS.scarf()), X = Sc.scarfScratch();
    // fit the scarf on a body and measure it: the knit's inside against the body at each of the knit's 48 angles, any
    // vertex inside the body, the knit's top at the front against the mouth, its bottom, the tail's end
    const measure = av => {
      const H = Sc.scarfHeight(P.calmView.call(av), av.chinEl, {});
      const C = Sc.fitScarf(av, H, parts, av.sq.x, X);
      const near = new Map();
      let inside = 0, worst = 0, top = -9, bottom = 9, low = 9, tailEnd = 9, n = 0;
      for (const p of parts) for (let i = 0; i < p.L.n; i++) {
        const x = p.pos[i * 3] + C[0], y = p.pos[i * 3 + 1] + C[1], z = p.pos[i * 3 + 2] + C[2], phi = Math.atan2(z - C[2], x - C[0]);
        const d = Math.hypot(x - C[0], z - C[2]) - surface(av, phi, y, C);
        n++;
        if (d < -0.002) { inside++; worst = Math.min(worst, d); }
        if (p.L.tail) { tailEnd = Math.min(tailEnd, y); continue; }
        const k = Math.round(((phi / TAU) % 1 + 1) % 1 * 48) % 48;
        near.set(k, Math.min(near.get(k) ?? 9, d));
        if (Math.abs(phi - Math.PI / 2) < 0.15) top = Math.max(top, y);
        if (Math.abs(phi - Math.PI / 2) < 0.4) bottom = Math.min(bottom, y);
        low = Math.min(low, y);
      }
      av.shape(0, Math.sin(av.chinEl), Math.cos(av.chinEl), Math.PI / 2, o);
      const gaps = [...near.values()];
      return { H, n, inside, worst, gapMin: Math.min(...gaps), gapMax: Math.max(...gaps), top, mouth: o.y, bottom, low, tailEnd };
    };
    const BODIES8 = [['Curly', { mix: 0, variant: 'plain' }], ['Dollop', { mix: 1, variant: 'plain' }], ['Cat-ear Dollop', { mix: 1, variant: 'ears' }],
      ['Topknot Dollop', { mix: 1, variant: 'topknot' }], ['mix 0.25', { mix: 0.25, variant: 'plain' }], ['mix 0.5', { mix: 0.5, variant: 'plain' }], ['mix 0.75', { mix: 0.75, variant: 'plain' }]];
    const shapeForms = Object.keys(FORM_LOOKS).filter(id => FORM_LOOKS[id].shape);
    const runs = [];   // [label, measure, rest?]
    for (const [name, b] of BODIES8) for (const m of [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1]) for (const genes of GENE_SETS) for (const T of [0, 7.3, 15.1])
      runs.push([`${name} m ${m}`, measure(avatar({ ...b, genes }, m, null, T)), true]);
    for (const [name, b] of BODIES8) for (const f of shapeForms) runs.push([`${name} ${FORM_LOOKS[f].title}`, measure(avatar({ ...b, genes: R.neutralGenes() }, 1, f, 3)), true]);
    const DYN = [['squashed', { sq: -0.2 }], ['squashed hard', { sq: -0.3 }], ['stretched', { sq: 0.25 }], ['leaning', { lx: 0.12, lz: -0.08 }],
      ['wobbling', { wobble: 0.08 }], ['booped', { dents: [{ x: 0.42, y: 0.12, z: 0.9, a: 0.12 }], sq: -0.15, wobble: 0.04 }]];
    for (const [name, b] of BODIES8) for (const [m, f] of [[0, null], [0.65, null], [1, null], [1, 'mochi']]) for (const [dn, dyn] of DYN)
      runs.push([`${name} m ${m}${f ? ' Marshmallow' : ''} ${dn}`, measure(avatar({ ...b, genes: R.neutralGenes() }, m, f, 3, dyn)), false]);
    const rest = runs.filter(r => r[2]), live = runs.filter(r => !r[2]);
    const span = (rs, k) => `${Math.min(...rs.map(r => r[1][k])).toFixed(4)}..${Math.max(...rs.map(r => r[1][k])).toFixed(4)}`;
    const verts = runs.reduce((s, r) => s + r[1].n, 0);
    let bad = runs.filter(r => r[1].inside);
    ok(!bad.length, `nothing inside the body: ${verts} scarf vertices (knit, stripe, tail) on ${runs.length} bodies (${rest.length} resting: every breed, mix, stage, gene set, form with a shape; ${live.length} squashed, stretched, leaning, wobbling, booped)`,
      bad.length ? bad.slice(0, 3).map(r => `${r[0]}: ${r[1].inside} inside, ${r[1].worst.toFixed(4)}`).join('; ') : 'none more than 0.002 inside');
    bad = rest.filter(r => r[1].gapMin < 0 || r[1].gapMax > 0.015);
    ok(!bad.length, 'touching all the way round, at rest: at each of the knit\'s 48 angles its inside is 0 .. 0.015 from the body (no gap, nothing sunk in)',
      bad.length ? bad.slice(0, 3).map(r => `${r[0]}: ${r[1].gapMin.toFixed(4)}..${r[1].gapMax.toFixed(4)}`).join('; ') : `${span(rest, 'gapMin')} (closest) .. ${span(rest, 'gapMax')} (furthest)`);
    bad = live.filter(r => r[1].gapMin < 0 || r[1].gapMax > 0.025);
    ok(!bad.length, 'it rides the body: squashed, stretched, leaning, wobbling or booped, the inside stays 0 .. 0.025 from the body',
      bad.length ? bad.slice(0, 3).map(r => `${r[0]}: ${r[1].gapMin.toFixed(4)}..${r[1].gapMax.toFixed(4)}`).join('; ') : `${span(live, 'gapMin')} .. ${span(live, 'gapMax')}`);
    bad = rest.filter(r => r[1].top > r[1].mouth + 0.005);
    ok(!bad.length, 'just under the mouth: at rest the knit\'s top stays under the mouth\'s lowest everyday point (smile, or open to eat)',
      bad.length ? bad.slice(0, 3).map(r => `${r[0]}: top ${r[1].top.toFixed(3)}, mouth ${r[1].mouth.toFixed(3)}`).join('; ') : `top - mouth ${span(rest.map(r => [r[0], { d: r[1].top - r[1].mouth }]), 'd')}`);
    // (under the face, where the lip shows; all the way round the ring follows the goo's lumps, so only the floor counts)
    bad = live.filter(r => r[1].top > r[1].mouth + 0.005);
    ok(!bad.length, 'and while it moves: squashed, stretched, leaning, wobbling or booped, the knit\'s top stays under the mouth (the ring slides down the body for the moment)',
      bad.length ? bad.slice(0, 3).map(r => `${r[0]}: top ${r[1].top.toFixed(3)}, mouth ${r[1].mouth.toFixed(3)}`).join('; ') : `top - mouth ${span(live.map(r => [r[0], { d: r[1].top - r[1].mouth }]), 'd')}`);
    const held = rest.filter(r => r[1].H.yLip > 0 && r[1].bottom < r[1].H.yLip - 0.002);
    bad = rest.filter(r => r[1].bottom < r[1].H.yLip - 0.03 || r[1].low < 0.06);
    ok(!bad.length, 'never in the goo lip or the puddle: under the face the knit\'s bottom stays above the lip (a baby with little room may touch its top: the mouth wins), and all the way round off the floor',
      bad.length ? bad.slice(0, 3).map(r => `${r[0]}: bottom ${r[1].bottom.toFixed(3)}, lip ${r[1].H.yLip.toFixed(3)}, lowest ${r[1].low.toFixed(3)}`).join('; ')
        : `bottom - lip ${span(rest.filter(r => r[1].H.yLip > 0).map(r => [r[0], { d: r[1].bottom - r[1].H.yLip }]), 'd')}; lowest point ${Math.min(...rest.map(r => r[1].low)).toFixed(3)}; ${held.length} bod${held.length === 1 ? 'y' : 'ies'} touching the lip's top (${held.slice(0, 2).map(r => r[0]).join(', ')}${held.length > 2 ? ', ...' : ''})`);
    bad = runs.filter(r => r[1].tailEnd < 0.02);
    ok(!bad.length, 'the tail hangs above the floor', bad.length ? bad.slice(0, 3).map(r => `${r[0]}: ${r[1].tailEnd.toFixed(3)}`).join('; ') : `lowest end ${Math.min(...runs.map(r => r[1].tailEnd)).toFixed(3)}`);
    const necks = rest.filter(r => r[1].H.neck > 0);
    if (VERBOSE) for (const [name, r] of runs) console.log(`  ${name}: el ${r.H.el.toFixed(2)} t ${r.H.t.toFixed(3)} gap ${r.gapMin.toFixed(4)}..${r.gapMax.toFixed(4)} top ${r.top.toFixed(3)} mouth ${r.mouth.toFixed(3)} bottom ${r.bottom.toFixed(3)} (lowest ${r.low.toFixed(3)}) lip ${r.H.yLip.toFixed(3)} tail ${r.tailEnd.toFixed(3)}`);
    console.log(`(${necks.length} resting bod${necks.length === 1 ? 'y settles' : 'ies settle'} into a narrower neck below the mouth${necks.length ? ': ' + necks.slice(0, 4).map(r => r[0]).join(', ') : ''})`);
  }
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
