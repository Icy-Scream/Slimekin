// Race view rules check, RV1 (plain node, no browser): core/race.js turns a contest show into a race that SHOWS
// scoreShow's result and never feeds back into it (design/contests-race-view.md v2 §2). Checked here:
//   the CONTESTS.race data (styles, caps, stamps), the rivals' leg splits (they add up, non-main legs capped, overflow to
//   the main leg) and their shown stars per cup (the design's 1/1/1, 2/3/2, 4/5/5, 5A/6A/7S);
//   for every cup, a spread of slimes, every seed and every tap pattern (64 graded patterns, ties, mashing, Skip,
//   Reduced motion): the finish order is scoreShow's places, your legs add up to your score, every runner's legs add up
//   to its score, the gaps fit, the order at the line is strict, a tie goes to your slime;
//   same inputs, same race (and the seed only picks looks: positions never depend on it);
//   margins in words, the photo finish rule, the quiet loss, "your chances" tiers (and Reduced motion's three lines),
//   the caller's lines, "How <name> ran", gaits; and core/race.js is pure (no Math.random, no DOM, no three.js).
//   node tools/race-test.mjs
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
let rnd = 4242; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);

const C = await import(SRC + '/data/content.js');
const K = await import(SRC + '/core/contests.js');
const RL = await import(SRC + '/core/ranch-life.js');
const TL = await import(SRC + '/core/talents.js');
const { createState } = await import(SRC + '/core/sim.js');
let R;
try { R = await import(SRC + '/core/race.js'); } catch (e) { console.log('FAIL - core/race.js loads | ' + e.message); console.log('\n0 passed, 1 failed'); process.exit(1); }
const { CONTESTS: CT, SKILL_IDS, PERSONALITY_IDS, BUYER_BY_ID } = C;
const RC = CT.race;

let fails = 0, passes = 0;
const ok = (cond, what, extra = '') => { if (cond) { passes++; console.log('ok   - ' + what + (extra ? ' | ' + extra : '')); } else { fails++; console.log('FAIL - ' + what + (extra ? ' | ' + extra : '')); } };
const mid = () => Object.fromEntries(PERSONALITY_IDS.map(k => [k, 50]));
const ones = () => Object.fromEntries(SKILL_IDS.map(k => [k, 1]));
const skills = (o = {}) => ({ ...RL.emptySkills(), ...o });
const FLAVOUR = { charm: 'sweet', bounce: 'heat', sturdy: 'mineral', speed: 'spark', smarts: 'prism' };
const LEAN = { charm: { cuddly: 70 }, bounce: { playful: 70 }, sturdy: { playful: 30 }, speed: { patient: 30 }, smarts: { patient: 70 } };
let nid = 0;
// a resident whose talent in `skill` is `grade` (as contest-test's helper)
function graded(skill, grade, o = {}) {
  const carrier = grade === 'C' ? SKILL_IDS.find(s => s !== skill) : skill;
  const potential = { ...ones(), [carrier]: { C: 1, B: 1, A: 3, S: 5 }[grade] };
  const personality = grade === 'S' ? { ...mid(), ...LEAN[carrier] } : mid();
  return { id: 'r' + (nid++), name: o.name || 'Juniper', form: { id: FLAVOUR[carrier] }, traits: { [FLAVOUR[carrier]]: 100 }, personality, potential,
    bondLevel: 2, runTotal: 5e8, jps: 4, generation: 1, happiness: 80, pearlT: 0, petAt: 0, lineage: { parents: [] }, skills: skills(), lesson: null, trip: null,
    talentsSeen: [], worn: { head: null, face: null, neck: null }, contests: K.createResidentContests(), ...o };
}
function world(list) {
  const st = createState();
  st.phase = 'play'; st.slime.name = 'Clover';
  st.ranch.residents = list; st.ranch.slots = 10;
  return st;
}
const CUPS = CT.cups.length;
const GR = ['perfect', 'good', 'nice', 'none'];
const PATTERNS = [];
for (const a of GR) for (const b of GR) for (const c of GR) PATTERNS.push([a, b, c]);

// ---------- 1. data ----------
console.log('\n# CONTESTS.race data (design §2.2, §2.8)');
ok(Object.values(RC.styles).every(s => s.length === 3 && s[0] + s[1] + s[2] === 100), 'race styles: main / support / tricks percents add up to 100', JSON.stringify(RC.styles));
ok(JSON.stringify(RC.styles) === JSON.stringify({ steady: [60, 20, 20], fast: [70, 15, 15], strong: [52, 20, 28] }), 'the design table: steady 60/20/20, fast starter 70/15/15, strong finisher 52/20/28');
ok(RC.legCap === CT.score.cap + CT.cheer.points.perfect, `a rival's non-main leg is capped at the act cap + a Perfect cheer (${RC.legCap})`);
ok(JSON.stringify(RC.styleByRank) === JSON.stringify(['steady', 'fast', 'strong']), 'in each cup: lowest steady, middle fast starter, top strong finisher');
ok(JSON.stringify(RC.legs.sprint) === JSON.stringify(['dash', 'hill', 'hoops']) && JSON.stringify(RC.legs.bounce) === JSON.stringify(['runUp', 'bigBounce', 'landing']),
  'legs in race order: Sprint dash / hill / hoops, Bounce-Off run-up / big bounce / landing');
ok(CT.contests.every(c => RC.legs[c.id] && RC.legs[c.id].length === 3 && new Set(RC.legs[c.id]).size === 3 && RC.legs[c.id].every(a => c.acts.some(x => x.id === a))), 'every contest has its 3 acts as legs, each once');
const T = RC.time;
ok(Math.abs(T.gate + 3 * T.leg + T.finish - 32) < 1e-9, `length: gate ${T.gate} + 3 legs of ${T.leg} + finish ${T.finish} = 32 s`);
ok(T.cheerAt.every(t => t >= 0 && t + CT.cheer.window <= T.leg), 'each cheer ring (and its whole window) sits inside its leg', JSON.stringify(T.cheerAt));
ok(CT.cups.every(c => c.rivals.every(r => RC.rivals[r.place] && RC.rivals[r.place].short)), 'every rival place has a race recipe and a short name');
ok(Object.entries(RC.rivals).every(([p, r]) => BUYER_BY_ID[p] && ['curly', 'dollop', 'mixed'].includes(r.breed) && ['plain', 'ears', 'topknot'].includes(r.variant) && (r.breed !== 'curly' || r.variant === 'plain')),
  'rival recipes: a buyer place, a breed, a variant only on a Dollop or mixed body');
const FORMS_OK = new Set(['mochi', ...Object.keys(C.FORM_BY_ID || {})]);
ok(Object.values(RC.rivals).every(r => C.OUTFIT_BY_ID[r.outfit]), 'rival recipes: one real outfit each');
{
  // the form matches what its place wants (design 4.5): the form's traits are the place's wants
  const want = p => [...BUYER_BY_ID[p].want].sort().join('+');
  const bad = Object.entries(RC.rivals).filter(([p, r]) => (BUYER_BY_ID[p].want.length ? r.form !== want(p) : r.form !== 'mochi'));
  ok(!bad.length, "each rival's form is what its place wants (a place that wants nothing in particular: the plain Marshmallow)", bad.map(([p, r]) => `${p}:${r.form}`).join(' '));
}
ok(!/Math\.random\s*\(/.test(fs.readFileSync(path.join(HERE, '../src/core/race.js'), 'utf8')), 'core/race.js never calls Math.random');
ok(!/from\s+['"]three['"]|document\.|window\./.test(fs.readFileSync(path.join(HERE, '../src/core/race.js'), 'utf8')), 'core/race.js uses no three.js and no DOM');

// ---------- 2. rivals: legs and shown stars ----------
console.log('\n# rivals: leg splits and shown stars (design §2.2, §2.8)');
{
  let allSum = true, allCap = true, mainMost = true;
  for (let s = 0; s <= 160; s++) for (const st of Object.keys(RC.styles)) {
    const l = R.rivalLegs(s, st);
    if (l[0] + l[1] + l[2] !== s) allSum = false;
    if (l[1] > RC.legCap || l[2] > RC.legCap || l[1] < 0 || l[2] < 0) allCap = false;
    if (s >= 10 && l[0] < Math.max(l[1], l[2])) mainMost = false;
  }
  ok(allSum, "a rival's three legs add up to its score (every score 0-160, every style)");
  ok(allCap, `a rival's support and tricks legs are never over ${RC.legCap}`);
  ok(mainMost, 'the main leg is the biggest (overflow and rounding go to it)');
  const l85 = R.rivalLegs(85, 'strong');
  ok(JSON.stringify(l85) === JSON.stringify([45, 17, 23]), 'Starlight 85, strong finisher: main 45, support 17, tricks 23 (24 capped, 1 to the main leg)', JSON.stringify(l85));
  const stars = CT.cups.map((c, ci) => c.rivals.map((_, i) => R.rivalCard(ci + 1, i, 'sprint')).sort((a, b) => a.score - b.score).map(r => `${r.stars}${r.stamp || ''}`).join('/'));
  ok(JSON.stringify(stars) === JSON.stringify(['1/1/1', '2/3/2', '4/5/5', '5A/6A/7S']), "rivals' shown main stars per cup: Little 1/1/1, Big 2/3/2, Grand 4/5/5, Champion 5A/6A/7S", JSON.stringify(stars));
  const g = CT.cups[2].rivals.map((_, i) => R.rivalCard(3, i, 'sprint'));
  const obs = g.find(r => r.place === 'observe');
  ok(obs && obs.styleWord === 'finishes strong' && obs.short === 'Starlight' && obs.line === 'Speed ★★★★★ · finishes strong', 'the race card line: "Speed ★★★★★ · finishes strong" (no numbers)', obs && obs.line);
  ok(g.every(r => !/\d/.test(r.line)), 'no rival line has a number in it', g.map(r => r.line).join(' | '));
  ok(CT.cups.slice(0, 3).every((c, ci) => c.rivals.every((_, i) => !R.rivalCard(ci + 1, i, 'sprint').stamp)), 'grade stamps only in the Champion Cup');
}

// ---------- 3. the race shows scoreShow ----------
console.log('\n# every cup, slime, seed and tap pattern: the race is scoreShow');
const cast = [];
for (const grade of ['C', 'B', 'A', 'S']) for (const sp of [0, 1, 3, 5, 7]) for (const st of [0, 2, 5]) for (const sm of [0, 3, 5]) for (const happy of [0, 55, 100]) {
  if (sp > 5 && !['A', 'S'].includes(grade)) continue;
  cast.push(graded('speed', grade, { skills: skills({ speed: sp, sturdy: st, smarts: sm }), happiness: happy }));
}
const st = world(cast);
let n = 0, orderBad = [], legsBad = [], rivalBad = [], fitBad = [], strictBad = [], tieBad = [], detBad = [], seedBad = [], cpBad = [];
const fit = RC.scale.fitLengths * RC.scale.lengthPx + 1e-9;
for (const x of cast) {
  x.contests.trophies.sprint = CUPS;   // every cup open (repeats are fine: the rules score them the same)
  for (let cup = 1; cup <= CUPS; cup++) {
    const scale = R.raceScale(st, x.id, 'sprint', cup);
    for (const pat of [...PATTERNS, 'skip', 'mash', [[0.1, 0.2, 1.5], [1.5, 1.6], [2.2]], [[1.49], [], [0.05, 0.06, 0.07]]]) {
      for (const reduced of [false, true]) {
        const shows = (n % 7);
        const race = R.raceOf(st, x.id, 'sprint', { cup, cheers: pat, reducedMotion: reduced, seed: R.raceSeed(x.id, 'sprint', cup, shows), scale });
        const res = K.scoreShow(st, x.id, 'sprint', { cup, cheers: R.cheersByAct('sprint', pat), reducedMotion: reduced });
        n++;
        if (!race.ok || !res.ok) { orderBad.push(`${x.id} cup ${cup}: not ok`); continue; }
        const you = race.runners.findIndex(r => r.you);
        const fo = race.finish.order;
        // the finish order: your place is scoreShow's, the rivals by score (high first), a tie to you
        if (fo.indexOf(you) + 1 !== res.place || race.finish.place !== res.place) orderBad.push(`${x.id} c${cup} ${JSON.stringify(pat)} race ${fo.indexOf(you) + 1} rules ${res.place}`);
        const rivalsInOrder = fo.filter(i => i !== you).map(i => race.runners[i].total);
        if (rivalsInOrder.some((v, i) => i && v > rivalsInOrder[i - 1])) orderBad.push(`${x.id} c${cup}: rivals out of order`);
        if (race.runners[you].total !== res.score || race.runners[you].legs.reduce((a, b) => a + b, 0) !== res.score) legsBad.push(`${x.id} c${cup} ${JSON.stringify(pat)}: legs ${race.runners[you].legs} score ${res.score}`);
        for (const r of race.runners) if (!r.you && (r.legs.reduce((a, b) => a + b, 0) !== r.total || r.legs.some(v => v < 0))) rivalBad.push(r.name);
        // cumulative checkpoints
        for (const r of race.runners) if (r.cum.length !== 3 || r.cum[2] !== r.total || r.cum[0] !== r.legs[0] || r.cum[1] !== r.legs[0] + r.legs[1]) cpBad.push(r.name);
        // positions: the leader at 0, everyone else behind, the widest gap fits; strict at the line
        for (const b of race.behind) { if (Math.min(...b) !== 0 || Math.max(...b) > fit || b.some(v => v < 0)) fitBad.push(`${x.id} c${cup} ${JSON.stringify(b)}`); }
        const fb = race.behind[3];
        for (let i = 1; i < fo.length; i++) if (!(fb[fo[i]] >= fb[fo[i - 1]] + RC.scale.tiePx - 1e-9)) strictBad.push(`${x.id} c${cup} ${JSON.stringify(fb)} ${fo}`);
        const top = Math.max(...race.runners.filter(r => !r.you).map(r => r.total));
        if (top === res.score && (fo[0] !== you || race.finish.margin.id !== 'wobble' || !race.finish.photo)) tieBad.push(`${x.id} c${cup}`);
        // same inputs, same race; another seed changes no position, order or word but the variants
        const again = R.raceOf(st, x.id, 'sprint', { cup, cheers: pat, reducedMotion: reduced, seed: R.raceSeed(x.id, 'sprint', cup, shows), scale });
        if (JSON.stringify(again) !== JSON.stringify(race)) detBad.push(`${x.id} c${cup}`);
        if (n % 5 === 0) {
          const other = R.raceOf(st, x.id, 'sprint', { cup, cheers: pat, reducedMotion: reduced, seed: R.raceSeed(x.id, 'sprint', cup, shows + 11), scale });
          if (JSON.stringify(other.behind) !== JSON.stringify(race.behind) || JSON.stringify(other.finish.order) !== JSON.stringify(race.finish.order) || other.finish.margin.id !== race.finish.margin.id) seedBad.push(`${x.id} c${cup}`);
        }
      }
    }
  }
}
ok(!orderBad.length, `finish order == scoreShow's places, rivals by score (${n} races: ${cast.length} slimes x 4 cups x 68 tap patterns x Reduced motion on/off)`, orderBad.slice(0, 3).join('; '));
ok(!legsBad.length, "your three legs add up to scoreShow's score (acts, flair in the main leg, mood in the first, each cheer in its leg)", legsBad.slice(0, 3).join('; '));
ok(!rivalBad.length, "every rival's legs add up to its fixed score, none below 0", rivalBad.slice(0, 3).join('; '));
ok(!cpBad.length, 'checkpoints are the running sums of the legs, the last = the score', cpBad.slice(0, 3).join('; '));
ok(!fitBad.length, `positions: the leader at 0, nobody in front of it, the widest gap within ${RC.scale.fitLengths} slime-lengths (${fit - 1e-9} art px)`, fitBad.slice(0, 2).join('; '));
ok(!strictBad.length, `at the line every runner is at least ${RC.scale.tiePx} art px behind the one placed ahead of it`, strictBad.slice(0, 2).join('; '));
ok(!tieBad.length, 'a tie with the top rival: your slime wins it, "by a wobble", with the photo finish', tieBad.slice(0, 3).join('; '));
ok(!detBad.length, 'same inputs, same race (byte for byte)', detBad.slice(0, 3).join('; '));
ok(!seedBad.length, 'the seed picks only looks: another seed, the same positions, order and margin', seedBad.slice(0, 3).join('; '));

// cheers: mashing never beats timing, Skip gives no cheers, Reduced motion is three Good
{
  const x = cast.find(c => c.skills.speed === 5 && c.skills.sturdy === 5 && c.skills.smarts === 5 && c.happiness === 55) || cast[0];
  const race = p => R.raceOf(st, x.id, 'sprint', { cup: 3, cheers: p, scale: R.raceScale(st, x.id, 'sprint', 3) });
  const mash = race([[0.01, 0.02, 0.03, 0.04, 1.5], [0, 0.1, 1.49, 1.5], [0.2, 1.5, 1.5]]);
  const timed = race([[1.5], [1.5], [1.5]]);
  ok(mash.runners[0].total < timed.runners[0].total && mash.res.cheers === 3, 'mashing: the first tap counts (3 Nice tries = 3), timing wins (9)', `${mash.res.cheers} vs ${timed.res.cheers}`);
  const sk = race('skip');
  ok(sk.res.cheers === 0 && sk.runners[0].legs.join() === race('none').runners[0].legs.join(), 'Skip: no cheers, the same race as no taps');
  const rm = R.raceOf(st, x.id, 'sprint', { cup: 3, cheers: 'perfect', reducedMotion: true, scale: R.raceScale(st, x.id, 'sprint', 3) });
  ok(rm.res.cheers === 6, 'Reduced motion: every cheer an automatic Good (6), whatever the taps');
  const leg = race(['none', 'perfect', 'none']);
  const base = race('none');
  ok(leg.runners[0].legs[1] - base.runners[0].legs[1] === 3 && leg.runners[0].legs[0] === base.runners[0].legs[0] && leg.runners[0].legs[2] === base.runners[0].legs[2], 'a cheer lands in the leg it was tapped in (the hill: +3 in leg 2 only)');
}

// your legs: what goes where
{
  const x = graded('speed', 'A', { skills: skills({ speed: 5, sturdy: 3, smarts: 2 }), happiness: 80 });
  const w = world([x]); x.contests.trophies.sprint = 2;
  const race = R.raceOf(w, x.id, 'sprint', { cup: 3, cheers: ['nice', 'good', 'good'], scale: R.raceScale(w, x.id, 'sprint', 3) });
  const res = race.res;
  ok(race.runners[0].legs.join() === `${50 + 6 + 4 + 1},${12 + 2},${8 + 2}` && res.score === 85,
    'Juniper (design §7): dash 50 + A flair 6 + mood 4 + Nice try 1 = 61, hill 12 + Good = 14, hoops 8 + Good = 10; 85 in all', race.runners[0].legs.join());
  ok(race.runners[0].cum.join() === '61,75,85', 'her checkpoints 61 / 75 / 85 (the storyboard)');
  const rv = race.runners.filter(r => !r.you).map(r => `${r.short}:${r.cum.join('/')}`).join(' ');
  ok(rv === 'Starlight:45/62/85 Glimmer:50/61/72 Pebblepeak:36/48/60', 'the rivals at the checkpoints: Starlight 45/62/85, Glimmer 50/61/72, Pebblepeak 36/48/60 (the storyboard)', rv);
  ok(race.runners.map(r => r.lane).join() === '1,2,3,4' && race.runners[1].short === 'Starlight' && race.runners[3].short === 'Pebblepeak', 'lanes: your slime in lane 1 (nearest), the rivals from the top score in lane 2 to the lowest in lane 4');
  ok(race.finish.place === 1 && race.finish.margin.id === 'wobble' && race.finish.photo && race.finish.margin.words === 'by a wobble', 'a tie at 85: Juniper wins "by a wobble", photo finish');
  ok(race.how.text === 'led from the gate, held on at the line.', 'How Juniper ran: "led from the gate, held on at the line."', race.how.text);
  const loss = R.raceOf(w, x.id, 'sprint', { cup: 3, cheers: ['none', 'good', 'good'], scale: R.raceScale(w, x.id, 'sprint', 3) });
  ok(loss.finish.place === 2 && loss.finish.margin.words === 'by a wobble' && loss.how.text === 'Starlight caught Juniper in the hoops.', 'no tap on the straight: 84 against 85, "2nd, by a wobble", "Starlight caught Juniper in the hoops."', `${loss.finish.place} ${loss.finish.margin.words} / ${loss.how.text}`);
  ok(race.runners[0].stars.join() === '5,3,2' && race.runners[0].gaits.join() === 'bound,hop,hop', 'your gait from your stars in each leg: Speed 5 bounds, Sturdy 3 hops, Smarts 2 hops', race.runners[0].gaits.join());
  ok(race.runners[0].stamp === 'A', 'your grade stamp in the main skill (A)');
  const ids = race.calls.map(c => c.id);
  ok(ids[0] === 'gate' && ids[1] === 'off' && ids.includes('natural') && ids.includes('photo') && ids.includes('hill') && ids.includes('hoops'), "the caller: gate, off, a natural (A/S), the hill, the hoops, the photo finish", ids.join(' '));
  ok(race.calls.every(c => typeof c.text === 'string' && c.text.length && !/[{}]/.test(c.text) && !/\d/.test(c.text)), 'every caller line is filled in and has no numbers', race.calls.map(c => c.text).join(' | '));
  const plain = graded('speed', 'C', { skills: skills({ speed: 5, sturdy: 3, smarts: 2 }) });
  const w2 = world([plain]); plain.contests.trophies.sprint = 2;
  ok(!R.raceOf(w2, plain.id, 'sprint', { cup: 3 }).calls.some(c => c.id === 'natural'), 'no "natural" line without an A or S in the main skill');
}

// ---------- 4. margins, the photo, the quiet loss ----------
console.log('\n# margins in words, the photo finish, the quiet loss');
{
  const w = [0, 1, 2, 4, 5, 9, 10, 19, 20, 29, 30, 47].map(g => `${g}:${R.marginOf(g).words}`);
  ok(JSON.stringify(w) === JSON.stringify(['0:by a wobble', '1:by a wobble', '2:by a hop', '4:by a hop', '5:by two hops', '9:by two hops', '10:by a slime-length', '19:by a slime-length', '20:by 2 slime-lengths', '29:by 2 slime-lengths', '30:by 3 slime-lengths', '47:by 4 slime-lengths']),
    'margins: 0-1 a wobble, 2-4 a hop, 5-9 two hops, 10-19 a slime-length, 20+ N slime-lengths', w.join(' '));
  const x = graded('speed', 'C', { skills: skills({ speed: 1, sturdy: 0, smarts: 0 }), happiness: 0 });
  const wo = world([x]); x.contests.trophies.sprint = 3;
  const big = R.raceOf(wo, x.id, 'sprint', { cup: 4 });
  ok(big.finish.place === 4 && big.finish.quiet && !big.finish.photo, 'losing by 10 or more: a quiet loss (only the place and the leg)', `place ${big.finish.place} quiet ${big.finish.quiet}`);
  ok(typeof big.lostLeg === 'number' && big.lostLeg >= 0 && big.lostLeg < 3, 'the leg where your slime lost the most ground is named', String(big.lostLeg));
}

// ---------- 5. your chances (design §2.8) ----------
console.log('\n# your chances, in words');
{
  const mk = (sp, st_, sm, happy = 100) => { const x = graded('speed', 'A', { skills: skills({ speed: sp, sturdy: st_, smarts: sm }), happiness: happy }); x.contests.trophies.sprint = 3; return x; };
  const tiers = [];
  for (let sp = 0; sp <= 6; sp++) for (const st_ of [0, 2, 4, 5]) for (const sm of [0, 2, 5]) for (const h of [0, 40, 100]) tiers.push(mk(sp, st_, sm, h));
  const w = world(tiers);
  let bad = [], seen = new Set(), rmSeen = new Set();
  for (const x of tiers) for (let cup = 1; cup <= 4; cup++) {
    const ch = R.chancesOf(w, x.id, 'sprint', cup);
    const none = K.scoreShow(w, x.id, 'sprint', { cup, cheers: 'none' }).won, good = K.scoreShow(w, x.id, 'sprint', { cup, cheers: 'good' }).won, perf = K.scoreShow(w, x.id, 'sprint', { cup, cheers: 'perfect' }).won;
    const want = none ? 'ready' : good ? 'good' : perf ? 'great' : 'notYet';
    seen.add(ch.tier);
    if (ch.tier !== want) bad.push(`${x.id} c${cup}: ${ch.tier} want ${want}`);
    if (/\d/.test(ch.text)) bad.push('number: ' + ch.text);
    const rm = R.chancesOf(w, x.id, 'sprint', cup, { reducedMotion: true });
    rmSeen.add(rm.tier);
  }
  ok(!bad.length && seen.size === 4, 'the tiers follow scoreShow with no cheers, three Good, three Perfect; no numbers in the words', bad.slice(0, 3).join('; ') + ` seen ${[...seen]}`);
  ok(!rmSeen.has('great') && rmSeen.has('ready') && rmSeen.has('notYet'), 'Reduced motion: only "Ready", "Can win with good cheers" and "Not yet" can show', [...rmSeen].join(','));
  const ny = R.chancesOf(w, tiers[0].id, 'sprint', 4);
  ok(ny.tier === 'notYet' && /^Not yet: [a-z].*\.$/.test(ny.text), 'not yet: "Not yet: " + the coach\'s tip', ny.text);
  ok(R.chancesOf(w, tiers[0].id, 'sprint', 1).text === RC.chances[R.chancesOf(w, tiers[0].id, 'sprint', 1).tier] || R.chancesOf(w, tiers[0].id, 'sprint', 1).tier === 'notYet', 'the words are CONTESTS.race.chances');
}

// ---------- 6. scale, seed, gait ----------
console.log('\n# the scale, the seed, gaits');
{
  ok(R.raceSeed('a', 'sprint', 1, 0) === R.raceSeed('a', 'sprint', 1, 0) && R.raceSeed('a', 'sprint', 1, 0) !== R.raceSeed('a', 'sprint', 1, 1) && R.raceSeed('a', 'sprint', 1, 0) !== R.raceSeed('b', 'sprint', 1, 0) && Number.isInteger(R.raceSeed('a', 'sprint', 2, 5)) && R.raceSeed('a', 'sprint', 2, 5) >= 0,
    'the seed: a whole number from (resident, contest, cup, show count); each part changes it');
  ok(['scoot', 'scoot', 'hop', 'hop', 'bound', 'bound', 'trail', 'trail'].every((g, s) => R.gaitOf(s) === g), 'gait: 0-1 scoot, 2-3 hop, 4-5 bound, 6-7 bound with the mint trail');
  const x = graded('speed', 'S', { skills: skills({ speed: 7, sturdy: 5, smarts: 5 }), happiness: 100 });
  const w = world([x]); x.contests.trophies.sprint = 0;
  const s = R.raceScale(w, x.id, 'sprint', 1);
  ok(s > 0 && s < RC.scale.pxPerPoint, `a runaway win (Little Cup, 7 Speed stars) shrinks the scale so the widest gap fits (${s.toFixed(3)} px a point)`);
  const r = R.raceOf(w, x.id, 'sprint', { cup: 1, cheers: 'perfect', scale: s });
  ok(Math.max(...r.behind.flat()) <= fit, 'and with every Perfect cheer it still fits');
  const y = graded('speed', 'A', { skills: skills({ speed: 5, sturdy: 3, smarts: 2 }), happiness: 80 });
  const w2 = world([y]); y.contests.trophies.sprint = 2;
  ok(R.raceScale(w2, y.id, 'sprint', 3) === RC.scale.pxPerPoint, `a close Grand Cup keeps ${RC.scale.pxPerPoint} px a point (10 points = one slime-length)`);
  ok(R.raceOf(w2, y.id, 'sprint', { cup: 9 }).ok === false && R.raceOf(w2, 'nobody', 'sprint', {}).ok === false, 'a race that cannot run says why (canEnter)');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
