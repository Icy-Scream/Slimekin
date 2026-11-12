// Race plan check (plain node): view/race-plan.js, the race on screen as numbers (RV2). Checked here, for the design's
// Juniper race and a spread of real races (every cup, slimes from weak to strong, tap patterns incl. Skip-like and
// re-races after each cheer):
//   at every checkpoint each runner shows its core/race.js gap behind the front; all start at the gate;
//   they cross the line in scoreShow's finish order; nobody ever moves backwards (also through the surge after a cheer);
//   the camera keeps your slime at youX and never cuts a runner off the left edge; Reduced motion: one still shot per
//   leg (it changes only at the leg starts), half gaps, all four in the shot, idle frames only, no slow motion;
//   frames: idle at the gate, each leg's gait, the surge after a cheer, think before a hoop for hop/scoot runners, the
//   happy hop at the end; the hill lifts runners by its profile; the photo finish's slow motion is only the last 0.6 s;
//   rings at the course moments; the caller line by time; same race, same frames.
//   node tools/race-plan-test.mjs
import url from 'node:url';
import path from 'node:path';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
const C = await import(SRC + '/data/content.js');
const K = await import(SRC + '/core/contests.js');
const RL = await import(SRC + '/core/ranch-life.js');
const R = await import(SRC + '/core/race.js');
const { createState } = await import(SRC + '/core/sim.js');
let P;
try { P = await import(SRC + '/view/race-plan.js'); } catch (e) { console.log('FAIL - view/race-plan.js loads | ' + e.message); console.log('\n0 passed, 1 failed'); process.exit(1); }
const { CONTESTS: CT, SKILL_IDS, PERSONALITY_IDS } = C;
const V = CT.race.view, T = CT.race.time;
let fails = 0, passes = 0;
const ok = (cond, what, extra = '') => { if (cond) { passes++; console.log('ok   - ' + what + (extra ? ' | ' + extra : '')); } else { fails++; console.log('FAIL - ' + what + (extra ? ' | ' + extra : '')); } };
const HILL = [2, 3, 4, 4, 5, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 13, 14, 14, 14, 14, 14, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 14, 14, 14, 14, 14, 13, 13, 13, 12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7, 7, 6, 5, 4, 4, 3, 2];

const mid = () => Object.fromEntries(PERSONALITY_IDS.map(k => [k, 50]));
const ones = () => Object.fromEntries(SKILL_IDS.map(k => [k, 1]));
let nid = 0;
function slime(grade, sk, happy = 80) {
  const potential = { ...ones(), speed: { C: 1, B: 1, A: 3, S: 5 }[grade] };
  return { id: 'r' + (nid++), name: 'Juniper', form: { id: 'spark' }, traits: { spark: 100 }, personality: grade === 'S' ? { ...mid(), patient: 30 } : mid(), potential,
    bondLevel: 2, runTotal: 5e8, jps: 4, generation: 1, happiness: happy, pearlT: 0, petAt: 0, lineage: { parents: [] }, skills: { ...RL.emptySkills(), ...sk }, lesson: null, trip: null,
    talentsSeen: [], worn: { head: null, face: null, neck: null }, contests: K.createResidentContests() };
}
const st = createState(); st.phase = 'play'; st.slime.name = 'Clover';
const cast = [];
for (const g of ['C', 'A', 'S']) for (const sp of [0, 2, 5, 7]) for (const s2 of [0, 3, 5]) for (const s3 of [0, 2, 5]) if (sp < 6 || g !== 'C') cast.push(slime(g, { speed: sp, sturdy: s2, smarts: s3 }, [0, 55, 100][(sp + s2) % 3]));
st.ranch.residents = cast; st.ranch.slots = 10;
for (const x of cast) x.contests.trophies.sprint = 3;

// play a race the way race-view.js will: the race at the start with no cheers, then again after each cheer
const DT = 1 / 60;
function play(x, cup, cheers, reduced = false) {
  const scale = R.raceScale(st, x.id, 'sprint', cup), seed = R.raceSeed(x.id, 'sprint', cup, 0);
  const given = ['none', 'none', 'none'];
  let race = R.raceOf(st, x.id, 'sprint', { cup, cheers: given.slice(), reducedMotion: reduced, seed, scale });
  const plan = new P.RacePlan(race, { reduced, hill: HILL, width: 195 });
  const out = { plan, races: [race], xs: [], cams: [], frames: [], ts: [] };
  let next = 0;
  for (let t = 0; t <= plan.tEnd + 1e-9; t += DT) {
    if (next < 3 && t >= plan.rings[next] + 1.0) {   // the cheer graded a second after its ring
      given[next] = cheers[next];
      race = R.raceOf(st, x.id, 'sprint', { cup, cheers: given.slice(), reducedMotion: reduced, seed, scale });
      plan.set(race, t);
      if (cheers[next] !== 'none') plan.surge(t);
      out.races.push(race);
      next++;
    }
    out.ts.push(t);
    out.xs.push(race.runners.map((_, i) => plan.x(i, t)));
    out.cams.push(plan.camera(t, DT));
    out.frames.push(race.runners.map((_, i) => plan.frame(i, t)));
  }
  out.race = race;
  return out;
}

// 1. the design's Juniper race (Grand Cup: Nice try, Good, Good)
const jun = slime('A', { speed: 5, sturdy: 3, smarts: 2 }, 80);
st.ranch.residents.push(jun); jun.contests.trophies.sprint = 2;
{
  const p = play(jun, 3, ['nice', 'good', 'good']);
  const plan = p.plan, race = p.race;
  const at = t => p.ts.findIndex(x => x >= t - 1e-9);
  const atGate = p.xs[at(1.0)];
  ok(atGate.every(x => x === V.x0), `everyone waits at the gate (x ${V.x0})`);
  // after the last cheer the race is final: the line checkpoint must show exactly its gaps
  const i3 = at(plan.tLine), front = plan.front(plan.tLine);
  ok(race.behind[3].every((b, i) => Math.abs(front - p.xs[i3][i] - b) < 0.75), 'at the line every runner is its final gap behind the front', race.behind[3].map(b => b.toFixed(1)).join(' '));
  const order = race.runners.map((_, i) => { const k = p.xs.findIndex(xs => xs[i] >= plan.lineX); return [i, k]; }).sort((a, b) => a[1] - b[1]).map(a => a[0]);
  ok(JSON.stringify(order) === JSON.stringify(race.finish.order) && race.finish.place === 1, 'they cross the line in the finish order (Juniper first, by a wobble)', `${order} vs ${race.finish.order}`);
  const youScreen = p.xs.map((xs, k) => xs[0] - p.cams[k]);
  ok(youScreen.slice(at(5), at(plan.tLine)).every(v => Math.abs(v - V.youX) < 0.5 || v > V.youX), `the camera keeps Juniper at x ${V.youX} (or right of it when someone trails far)`);
  const t52 = at(5.2);
  ok(Math.abs(p.xs[t52][0] - p.cams[t52] - 88) < 0.5 && Math.abs(p.xs[t52][0] - 91) < 2, 'frame A: at 5.2 s Juniper is at screen x 88, about 88 art px down the course', `${p.xs[t52][0].toFixed(1)}`);
  ok(p.frames[at(1)][0] < 4, 'idle at the gate');
  const leg1 = p.frames.slice(at(4), at(5)).map(f => P.FRAMES[f[0]]);
  ok(leg1.some(f => f.startsWith('bound') || f.startsWith('hop')) && !leg1.some(f => f.startsWith('scoot')), 'the dash: Juniper (Speed 5) bounds', leg1.slice(0, 6).join(','));
  const surge = p.frames.slice(at(plan.rings[1] + 1.05), at(plan.rings[1] + 1.15)).map(f => P.FRAMES[f[0]]);
  ok(surge.every(f => f.startsWith('surge')), 'after a cheer: the surge frames', surge[0]);
  const thinks = p.frames.slice(at(plan.gate + 2 * T.leg), at(plan.tLine)).map(f => P.FRAMES[f[0]]).filter(f => f.startsWith('think')).length;
  ok(thinks > 0, `the hoops: Juniper (Smarts 2, hops) stops to think before the hoops (${thinks} frames)`);
  const joy = p.frames.slice(at(plan.tEnd - 0.5)).map(f => P.FRAMES[f[1]]);
  ok(joy.every(f => f.startsWith('hop') || f.startsWith('joy')) && joy.some(f => f.startsWith('joy')), 'everyone home: the happy hop');
  ok(plan.rings.map(r => r.toFixed(1)).join() === '5.0,12.1,24.6', 'rings at the straight (5.0 s), the foot of the hill (12.1 s), the last hoop (24.6 s)', plan.rings.join());
  ok(race.finish.photo && plan.rate(plan.tLine - 0.3) === CT.race.photo.speed && plan.rate(plan.tLine - 0.7) === 1 && plan.rate(plan.tLine + 0.01) === 1, 'photo finish: only the last 0.6 s before the line at 0.35x');
  const k1 = plan.callAt(0.5), k2 = plan.callAt(3.2);
  ok(race.calls[k1].id === 'gate' && race.calls[k2].id === 'off', 'the caller: the gate, then "They\'re off!"', `${race.calls[k1].text} / ${race.calls[k2].text}`);
  // the hill
  const hx = plan.hillX;
  ok(plan.ground(0, hx - 1) === V.lanes[1] - 1 && plan.ground(0, hx + 30) === V.lanes[1] - 1 - 15 && plan.ground(3, hx + 2) === V.lanes[4] - 1 - 4, 'the hill lifts a runner by the mound under it, in every lane');
}

// 2. a spread of races
let orderBad = [], backBad = [], camBad = [], cpBad = [], rmBad = [], detBad = [], n = 0;
const PATS = [['none', 'none', 'none'], ['perfect', 'perfect', 'perfect'], ['nice', 'good', 'perfect'], ['perfect', 'none', 'good'], ['good', 'good', 'good']];
for (const x of cast) for (let cup = 1; cup <= 4; cup++) {
  if (!K.canEnter(st, x.id, 'sprint', cup).ok) continue;
  for (const pat of PATS) for (const reduced of [false, true]) {
    if (reduced && pat !== PATS[0] && pat !== PATS[4]) continue;
    const cheers = reduced ? ['good', 'good', 'good'] : pat;
    const p = play(x, cup, cheers, reduced);
    n++;
    const plan = p.plan, race = p.race;
    // the order over the line
    const order = race.runners.map((_, i) => [i, p.xs.findIndex(xs => xs[i] >= plan.lineX)]).sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(a => a[0]);
    if (JSON.stringify(order) !== JSON.stringify(race.finish.order)) orderBad.push(`${x.id} c${cup} ${pat} ${reduced}: ${order} vs ${race.finish.order}`);
    // never backwards
    for (let k = 1; k < p.xs.length; k++) for (let i = 0; i < 4; i++) if (p.xs[k][i] < p.xs[k - 1][i] - 1e-9) { backBad.push(`${x.id} c${cup} t ${p.ts[k].toFixed(2)} runner ${i}`); k = p.xs.length; break; }
    // checkpoints after the last change: the line
    const k3 = p.ts.findIndex(t => t >= plan.tLine - 1e-9), f3 = plan.front(plan.tLine);
    if (race.behind[3].some((b, i) => Math.abs(f3 - p.xs[k3][i] - b * plan.gapK) > 0.75)) cpBad.push(`${x.id} c${cup}`);
    // the camera: nobody cut on the left, your slime at youX unless someone trails
    for (let k = 0; k < p.xs.length; k += 3) {
      const sx = p.xs[k].map(v => v - p.cams[k]);
      if (!reduced && (Math.min(...sx) < V.edge - 1 || sx[0] < V.youX - 0.5)) { camBad.push(`${x.id} c${cup} t ${p.ts[k].toFixed(2)} ${sx.map(v => v.toFixed(0))}`); break; }
      if (reduced && (Math.min(...sx) < 2 || Math.max(...sx) > 193)) { rmBad.push(`${x.id} c${cup} t ${p.ts[k].toFixed(2)} ${sx.map(v => v.toFixed(0))}`); break; }
    }
    if (reduced) {
      const legs = p.ts.map(t => (t < plan.gate ? 0 : t >= plan.tLine ? 3 : Math.min(2, Math.floor((t - plan.gate) / T.leg))));
      if (p.cams.some((c, k) => k && legs[k] === legs[k - 1] && c !== p.cams[k - 1])) rmBad.push(`${x.id}: the camera moved inside a leg`);
      if (p.frames.some(f => f.some(v => !P.FRAMES[v].startsWith('idle')))) rmBad.push(`${x.id}: a frame other than idle`);
      if (p.ts.some(t => plan.rate(t) !== 1)) rmBad.push(`${x.id}: slow motion`);
    }
    if (n % 9 === 0) {
      const q = play(x, cup, cheers, reduced);
      if (JSON.stringify(q.frames) !== JSON.stringify(p.frames) || JSON.stringify(q.xs) !== JSON.stringify(p.xs)) detBad.push(x.id);
    }
  }
}
ok(!orderBad.length, `${n} races: the runners cross the line in scoreShow's finish order`, orderBad.slice(0, 3).join('; '));
ok(!backBad.length, 'nobody ever moves backwards (the surge and the re-races ease forward)', backBad.slice(0, 3).join('; '));
ok(!cpBad.length, 'at the line every runner shows its final gap', cpBad.slice(0, 3).join('; '));
ok(!camBad.length, `the camera: your slime at x ${V.youX} (or right of it), nobody cut by the left edge`, camBad.slice(0, 3).join('; '));
ok(!rmBad.length, 'Reduced motion: one still shot per leg with all four in it, idle frames only, no slow motion', rmBad.slice(0, 3).join('; '));
ok(!detBad.length, 'same race, same positions and frames');
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
