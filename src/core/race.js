// The race view's rules (design/contests-race-view.md v2 §2; RV1). Every show is a race, and the race only SHOWS what
// scoreShow (core/contests.js) decided: it never feeds back into a score, a place or a prize. From one show this works
// out, for the screens:
//   the legs (one per act, in race order): your slime's act points, its flair in the main leg, its mood in the first
//   leg, each cheer in the leg it was tapped in; each rival's fixed score split by its race style (steady, fast
//   starter, strong finisher by its rank in the cup; non-main legs capped, overflow and rounding to the main leg);
//   the checkpoints (running sums), the order and the leader at each, and how far each runner sits behind the leader
//   (points gap x one scale per race, so the widest gap the race can have fits in a few slime-lengths);
//   the finish: scoreShow's places (a tie goes to your slime, by a whisker at the line), the margin in words, the photo
//   finish, a quiet loss; the leg where your slime lost the most ground; "How <name> ran";
//   the caller's lines (ids, times and words; the seed picks the variants and nothing else);
//   the race card's words: each rival's shown stars and race style, and your chances (scoreShow with no cheers, three
//   Good, three Perfect).
// Pure: no three.js, no DOM, no Math.random. Same inputs, same race. Numbers and words: CONTESTS.race in content.js.
import { CONTESTS, CONTEST_BY_ID, SKILL_BY_ID } from '../data/content.js';
import { scoreShow, baseScore, canEnter } from './contests.js';

const C = CONTESTS;
const RC = () => C.race;
const ROLES = ['main', 'support', 'tricks'];
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const numWord = n => (Number.isInteger(n) && n >= 0 && n < NUM.length ? NUM[n] : String(n));
// "{name} takes the lead!" with { name: 'Starlight' }
export const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
const lowerFirst = s => (s ? s[0].toLowerCase() + s.slice(1) : s);
// digits in a sentence become words ("4 more Speed stars" -> "four more Speed stars": no numbers on the race screens)
const wordsForDigits = s => String(s).replace(/\b(\d+)\b/g, (_, d) => numWord(+d));

// ---------- the seed (looks only) ----------
// A whole number from (resident, contest, cup, show count): FNV-1a. It picks the caller's variants, the hop rhythm,
// the crowd and the confetti; never a position, an order or a word that matters.
export function raceSeed(id, contest, cup, shows) {
  const s = `${id}|${contest}|${cup}|${shows}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const pick = (seed, salt, n) => (n <= 1 ? 0 : (Math.imul((seed ^ Math.imul(salt + 1, 2654435761)) >>> 0, 2246822519) >>> 0) % n);

// ---------- legs ----------
// the contest's acts in race order (indexes into CONTEST_BY_ID[contest].acts)
export function legActs(contest) {
  const def = CONTEST_BY_ID[contest];
  return (RC().legs[contest] || def.acts.map(a => a.id)).map(id => def.acts.findIndex(a => a.id === id));
}
// cheers given per leg (race order) -> per act (scoreShow's order); a single grade name / 'skip' / 'mash' stays as is
export function cheersByAct(contest, perLeg) {
  if (!Array.isArray(perLeg)) return perLeg;
  const out = [null, null, null];
  legActs(contest).forEach((ai, k) => { out[ai] = perLeg[k] ?? 'none'; });
  return out.map(v => v ?? 'none');
}
const legName = (contest, k) => lowerFirst(CONTEST_BY_ID[contest].acts[legActs(contest)[k]].name);

// A rival's fixed score in its three legs, by role: [main, support, tricks]. The support and tricks legs are the
// style's share, rounded, at most legCap; the rest (overflow and rounding) is the main leg.
export function rivalLegs(score, style) {
  const [, ps, pt] = RC().styles[style] || RC().styles.steady, cap = RC().legCap;
  const s = Math.max(0, Math.min(cap, Math.round(score * ps / 100)));
  const t = Math.max(0, Math.min(cap, Math.round(score * pt / 100)));
  return [score - s - t, s, t];
}
// each rival's race style in a cup (index aligned with the cup's rivals): by its rank, lowest score first
export function rivalStyles(cup) {
  const rv = C.cups[cup - 1].rivals;
  const rank = rv.map((r, i) => i).sort((a, b) => rv[a].score - rv[b].score || a - b);
  const out = [];
  rank.forEach((i, k) => { out[i] = { style: RC().styleByRank[Math.min(k, RC().styleByRank.length - 1)], rank: k }; });
  return out;
}
const starsOf = (points, role, cap) => Math.max(0, Math.min(cap, Math.round(points / C.score[role])));
// What the race card shows of a rival (no numbers): its name, its main skill's stars and its race style; a grade stamp
// in the Champion Cup. stars: the main leg's; legStars: per leg in race order (its gait).
export function rivalCard(cup, i, contest) {
  const cupDef = C.cups[cup - 1], r = cupDef.rivals[i], def = CONTEST_BY_ID[contest];
  const { style, rank } = rivalStyles(cup)[i];
  const byRole = rivalLegs(r.score, style);
  const stamp = (RC().stamps[cupDef.id] || [])[rank] || null;
  const mainCap = stamp ? RC().stars.stampMax[stamp] : RC().stars.max;
  const stars = starsOf(byRole[0], 'main', mainCap);
  const legs = legActs(contest).map(ai => byRole[ROLES.indexOf(def.acts[ai].role)]);
  const legStars = legActs(contest).map((ai, k) => {
    const role = def.acts[ai].role;
    return role === 'main' ? stars : starsOf(legs[k], role, RC().stars.max);
  });
  const recipe = RC().rivals[r.place] || {};
  const main = def.acts.find(a => a.role === 'main');
  const skill = main.skill;
  const styleWord = RC().styleWords[style];
  return { place: r.place, name: r.name, short: recipe.short || r.name, color: r.color, score: r.score, style, styleWord, rank, stamp, stars, legs, legStars,
    skill, line: `${SKILL_BY_ID[skill]?.name || skill} ${'★'.repeat(stars)} · ${styleWord}`, recipe };
}

// ---------- words ----------
export function gaitOf(stars) {
  for (const [max, g] of RC().gait) if (stars <= max) return g;
  return RC().gait[RC().gait.length - 1][1];
}
export function marginOf(gap) {
  const g = Math.max(0, Math.round(gap));
  const [, id] = RC().margins.find(([max]) => g <= max);
  const n = Math.floor(g / 10);
  return { gap: g, id, n, words: fill(RC().marginWords[id], { n: numWord(n) }) };
}

// ---------- the scale ----------
// One scale per race (art px per point): pxPerPoint (10 points = one slime-length), less when the widest gap the race
// can have would not fit in fitLengths slime-lengths. "Can have": your cheers still to come (none to Perfect in every
// leg) and your mood one up or down (the pat at the gate, a little time passing) are all tried, so whatever happens in
// the race it fits, and the scale never changes mid-race.
export function raceScale(state, id, contest, cup) {
  const e = canEnter(state, id, contest, cup);
  const sc = RC().scale, fit = sc.fitLengths * sc.lengthPx;
  if (!e.ok) return sc.pxPerPoint;
  const base = baseScore(e.x, contest), def = CONTEST_BY_ID[contest], order = legActs(contest);
  const mainI = def.acts.findIndex(a => a.role === 'main');
  const legs0 = order.map((ai, k) => base.acts[ai].points + (ai === mainI ? base.flair.points : 0) + (k === 0 ? base.mood : 0));
  const rivals = C.cups[e.cup - 1].rivals.map((_, i) => rivalCard(e.cup, i, contest).legs);
  const P = C.cheer.points.perfect;
  let widest = 0;
  for (let m = 0; m < 8; m++) for (const dm of [-1, 0, 1]) {
    if (base.mood + dm < 0 || base.mood + dm > 5) continue;
    const mine = legs0.map((v, k) => v + ((m >> k) & 1 ? P : 0) + (k === 0 ? dm : 0));
    const cums = [mine, ...rivals].map(l => [l[0], l[0] + l[1], l[0] + l[1] + l[2]]);
    for (let k = 0; k < 3; k++) {
      const v = cums.map(c => c[k]);
      widest = Math.max(widest, Math.max(...v) - Math.min(...v));
    }
  }
  return widest > 0 ? Math.min(sc.pxPerPoint, fit / widest) : sc.pxPerPoint;
}

// ---------- the race ----------
// opts: cup (default: the next cup), cheers (per LEG in race order: tap times or grade names, or one grade name /
// 'skip' / 'mash' for all), reducedMotion, seed (raceSeed; looks only), scale (raceScale, set once at the race's start).
// Returns { ok: false, reason } when it can't run (canEnter), else the race (see the top of this file).
export function raceOf(state, id, contest, { cup = null, cheers = 'none', reducedMotion = false, seed = 0, scale = null } = {}) {
  const res = scoreShow(state, id, contest, { cup, cheers: cheersByAct(contest, cheers), reducedMotion });
  if (!res.ok) return { ok: false, reason: res.reason };
  const def = CONTEST_BY_ID[contest], order = legActs(contest), sc = RC().scale;
  const mainI = def.acts.findIndex(a => a.role === 'main');
  // your slime: lane 1 (the nearest)
  const legs = order.map((ai, k) => { const a = res.acts[ai]; return a.points + a.cheerPoints + (ai === mainI ? res.flair.points : 0) + (k === 0 ? res.mood : 0); });
  const yourStars = order.map(ai => { const a = res.acts[ai]; return a.style ? Math.min(RC().stars.max, Math.round(a.points / C.score.support)) : a.stars; });
  const runners = [{
    you: true, key: 'you', id: res.id, name: res.name, short: res.name, lane: 1, legs, total: res.score,
    stars: yourStars, gaits: yourStars.map(gaitOf), stamp: ['A', 'S'].includes(res.flair.grade) ? res.flair.grade : null,
  }];
  // the rivals: the top score in lane 2 down to the lowest in lane 4
  const cards = C.cups[res.cup - 1].rivals.map((_, i) => rivalCard(res.cup, i, contest)).sort((a, b) => b.score - a.score);
  cards.forEach((r, i) => runners.push({ you: false, key: r.place, name: r.name, short: r.short, color: r.color, lane: i + 2, legs: r.legs, total: r.score,
    stars: r.legStars, gaits: r.legStars.map(gaitOf), stamp: r.stamp, style: r.style, recipe: r.recipe }));
  for (const r of runners) r.cum = [r.legs[0], r.legs[0] + r.legs[1], r.legs[0] + r.legs[1] + r.legs[2]];
  // order at each checkpoint (k = 1..3): points first, a tie to your slime, then by lane
  const rank = vals => runners.map((_, i) => i).sort((a, b) => vals[b] - vals[a] || (runners[b].you ? 1 : 0) - (runners[a].you ? 1 : 0) || runners[a].lane - runners[b].lane);
  const orders = [runners.map((_, i) => i)];
  for (let k = 0; k < 3; k++) orders.push(rank(runners.map(r => r.cum[k])));
  const leader = orders.map(o => o[0]);
  // how far behind the leader, in art px, at the gate and each checkpoint
  const s = scale ?? raceScale(state, id, contest, res.cup);
  const behind = [runners.map(() => 0)];
  for (let k = 0; k < 3; k++) { const top = Math.max(...runners.map(r => r.cum[k])); behind.push(runners.map(r => (top - r.cum[k]) * s)); }
  // the finish: scoreShow's places; strictly in order at the line (a tie by tiePx), never past fitLengths
  const fo = orders[3], fb = behind[3], fit = sc.fitLengths * sc.lengthPx;
  for (let i = 1; i < fo.length; i++) fb[fo[i]] = Math.max(fb[fo[i]], fb[fo[i - 1]] + sc.tiePx);
  if (fb[fo[fo.length - 1]] > fit) {
    fb[fo[fo.length - 1]] = fit;
    for (let i = fo.length - 2; i >= 1; i--) fb[fo[i]] = Math.min(fb[fo[i]], fb[fo[i + 1]] - sc.tiePx);
  }
  const you = 0, place = fo.indexOf(you) + 1;
  const won = place === 1, winner = fo[0], second = fo[1];
  const tops = runners.map(r => r.total);
  const gap = won ? tops[you] - tops[second] : tops[fo[place - 2]] - tops[you];
  const margin = marginOf(gap);
  const photo = tops[winner] - tops[second] <= RC().photo.within;
  const quiet = !won && tops[winner] - tops[you] >= RC().quietLoss;
  // the leg where your slime lost the most ground to the winner (after a loss)
  let lostLeg = null;
  if (!won) {
    let worst = -Infinity, prev = 0;
    for (let k = 0; k < 3; k++) { const g = runners[winner].cum[k] - runners[you].cum[k], d = g - prev; prev = g; if (d > worst) { worst = d; lostLeg = k; } }
  }
  const race = {
    ok: true, contest, cup: res.cup, seed: seed >>> 0, scale: s, res,
    legs: order.map((ai, k) => ({ act: def.acts[ai].id, name: def.acts[ai].name, short: def.acts[ai].short, skill: def.acts[ai].skill || null, role: def.acts[ai].role, words: legName(contest, k) })),
    runners, orders, leader, behind,
    finish: { order: fo, place, won, winner, margin, photo, quiet },
    lostLeg,
  };
  race.how = howRan(race);
  race.calls = callsOf(race);
  return race;
}

// "How <name> ran" after a win (the words after "How Juniper ran: "), or the loss line ("Starlight caught Juniper in
// the hoops."; after a quiet loss only the leg: "The hill was the hard part."). Returns { id, text }.
export function howRan(race) {
  const H = RC().how, r = race.runners, you = 0, L = race.leader, f = race.finish;
  const leads = [1, 2, 3].map(k => L[k] === you);
  if (f.won) {
    if (leads[0] && leads[1]) { const id = f.margin.gap <= 4 ? 'ledHeld' : 'ledClear'; return { id, text: H[id] }; }
    let k = 2;
    while (k > 0 && leads[k - 1]) k--;
    return { id: 'cameBack', text: fill(H.cameBack, { leg: race.legs[k].words }) };
  }
  const w = f.winner;
  if (f.quiet) { const leg = race.legs[race.lostLeg ?? 0].words; return { id: 'quiet', text: fill(H.quiet, { leg: leg[0].toUpperCase() + leg.slice(1) }) }; }
  // the leg where the winner got ahead of your slime for good, after your slime was level or ahead of it
  const ahead = [1, 2, 3].map(k => r[w].cum[k - 1] > r[you].cum[k - 1]);
  let k = 2;
  while (k > 0 && ahead[k - 1]) k--;
  if (k > 0) return { id: 'caught', text: fill(H.caught, { who: r[w].short, name: r[you].short, leg: race.legs[k].words }) };
  return { id: 'quicker', text: fill(H.quicker, { who: r[w].short, leg: race.legs[race.lostLeg ?? 0].words }) };
}

// The caller's lines: { id, at (seconds on the race's clock, before any photo-finish slow motion), who, text }, in
// time order. The gate, the off, a natural (an A or S in the main skill, as the main leg starts), each later leg's
// start, the lead forming or changing (or a runner away clear), the run to the line (neck and neck), the photo finish
// or the winner, everyone home. The seed picks the variant of each line.
export function callsOf(race) {
  const T = RC().time, W = RC().caller, out = [], r = race.runners, seed = race.seed;
  const legStart = k => T.gate + k * T.leg;
  const say = (id, at, who = null, other = null) => {
    const vs = W[id];
    if (!vs || !vs.length) return;
    out.push({ id, at, who, text: fill(vs[pick(seed, out.length * 7 + id.length, vs.length)], { name: who !== null ? r[who].short : '', other: other !== null ? r[other].short : '' }) });
  };
  say('gate', 0);
  say('off', legStart(0));
  const mainK = race.legs.findIndex(l => l.role === 'main');
  if (r[0].stamp) say('natural', legStart(mainK) + 0.4, 0);
  for (let k = 1; k < 3; k++) say(race.legs[k].act, legStart(k));
  for (let k = 1; k <= 3; k++) {
    if (k === 3 && race.finish.photo) break;
    const lead = race.leader[k], prev = race.leader[k - 1];
    const cum = r.map(x => x.cum[k - 1]).sort((a, b) => b - a);
    const clear = cum[0] - cum[1] >= RC().quietLoss;
    if (k === 1 || lead !== prev) say(clear ? 'clear' : 'lead', legStart(k - 1) + T.leg * 0.62, lead);
    else if (clear && k < 3) say('clear', legStart(k - 1) + T.leg * 0.62, lead);
  }
  const lineAt = legStart(3);
  say(race.finish.photo ? 'neck' : 'line', lineAt - 1.9);
  if (race.finish.photo) say('photo', lineAt);
  say('win', lineAt + (race.finish.photo ? 0.05 : 0.1), race.finish.winner);
  say('home', lineAt + T.finish - 1.0);
  return out.sort((a, b) => a.at - b.at);
}

// ---------- the race card ----------
// Your chances, in words (the second line of your row): from scoreShow with no cheers, three Good, three Perfect. With
// Reduced motion every cheer is an automatic Good, so only "Ready", "good cheers" and "Not yet" can show.
export function chancesOf(state, id, contest, cup, { reducedMotion = false } = {}) {
  const W = RC().chances;
  const run = (cheers, rm = false) => scoreShow(state, id, contest, { cup, cheers, reducedMotion: rm });
  const none = run('none');
  if (!none.ok) return { tier: null, text: '', reason: none.reason };
  if (none.won) return { tier: 'ready', text: W.ready };
  if (reducedMotion) {
    const rm = run('good', true);
    if (rm.won) return { tier: 'good', text: W.good };
    return { tier: 'notYet', text: fill(W.notYet, { tip: wordsForDigits(lowerFirst(rm.tip?.text || '')) }) };
  }
  if (run('good').won) return { tier: 'good', text: W.good };
  const best = run('perfect');
  if (best.won) return { tier: 'great', text: W.great };
  return { tier: 'notYet', text: fill(W.notYet, { tip: wordsForDigits(lowerFirst(best.tip?.text || '')) }) };
}
