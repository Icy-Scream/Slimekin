// Contest simulator: measures every target of the Contests design (section 9) from the game's own rules (core/ranch.js,
// core/ranch-life.js, core/talents.js, core/contests.js and their real numbers). The ranch is pearl-sim's: the same
// players (engaged, casual, spam), the same check-ins, the same spending and the same residents (its loop is copied
// below, and checked against tools/pearl-sim.mjs at every run: with no shows it must make exactly what pearl-sim makes).
// Shows are entered at every check-in (and whenever a lesson ends while the game is open), before the lessons start.
// Usage: node tools/contest-sim.mjs [days=30] [quiet] [raised] [tune=<json>]
//   raised:  the residents' talents from real raising runs (tools/out/talent-sim/raised-random.json, made by
//            tools/talent-sim.mjs; run it first) instead of pearl-sim's stand-ins (Marshmallows, mostly grade B and C)
//   tune:    other rival scores and prizes without editing content.js, e.g.
//            tune='{"rivals":[[12,16,19],[30,38,45],[60,72,85],[90,100,110]],"pearls":[5,15,40,100],"trophyValue":0.03}'
// The show players: a normal player (engaged or casual) dresses each resident in the family's best outfits for the
// Beauty Show (Dress up, free) and enters every contest's next cup when its entry card shows it would win with Good
// cheers; a spamming player checks in every 5 minutes and enters every contest's next cup AND every cup it has won again,
// every time, mashing (Nice try) or skipping (no cheers). The family's outfits: the 7 that economy-sim's engaged and
// casual players own by their first move-out (Ribbon Bow ... Star Shades; the Party Hat and the Tiny Crown come later).
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
const { createState } = await import(SRC + '/core/sim.js');
const { Ranch } = await import(SRC + '/core/ranch.js');
const { RanchLife, stars, emptySkills, busy } = await import(SRC + '/core/ranch-life.js');
const { rng } = await import(SRC + '/core/random.js');
const TL = await import(SRC + '/core/talents.js');
const K = await import(SRC + '/core/contests.js');
const C = await import(SRC + '/data/content.js');
const { RANCH_LIFE, BREEDING, SKILL_IDS, PERSONALITY_IDS, CONTESTS, CONTEST_BY_ID, CONTEST_IDS } = C;

const args = process.argv.slice(2);
const t0 = Date.now();
const TUNE = args.find(a => a.startsWith('tune='));
if (TUNE) {
  const t = JSON.parse(TUNE.slice(5));
  if (t.rivals) t.rivals.forEach((row, i) => row.forEach((v, j) => { CONTESTS.cups[i].rivals[j].score = v; }));
  if (t.pearls) t.pearls.forEach((v, i) => { CONTESTS.cups[i].pearls = v; });
  if (t.trophyValue !== undefined) CONTESTS.trophyValue = t.trophyValue;
  console.log('tuned CONTESTS:', TUNE.slice(5));
}
const DAYS = +(args.find(a => /^days=\d+$/.test(a))?.slice(5) || 30);
const QUIET = args.includes('quiet');
const RAISED_FILE = path.join(HERE, 'out/talent-sim/raised-random.json');
const RAISED = args.includes('raised') ? JSON.parse(fs.readFileSync(RAISED_FILE, 'utf8')) : null;
const H = 3600e3, MIN = 60e3, DAY = 24 * H;
const T0 = Date.UTC(2026, 10, 9, 0, 0, 0);   // pearl-sim's clock
const LCG = seed => { let r = seed; return () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648); };
const OWNED = ['bow', 'bowtie', 'glasses', 'flowers', 'scarf', 'beret', 'shades'];

const PROFILES = {
  engaged: { sessions: [[8, 25], [11, 10], [14, 20], [17, 10], [20, 15], [22, 5]], moveEvery: 6 },
  casual: { sessions: [[8, 15], [20, 25]], moveEvery: 10 },
  spam: { sessions: Array.from({ length: 14 * 12 + 1 }, (_, i) => [8 + i / 12, 0]), moveEvery: 6 },
};
// the subject of a focus run: a resident whose talent in `skill` is `grade` (diet 3 + form 2 + Potential 1/3/5; for C,
// another skill carries the B so the cozy floor leaves this one at C), a calm personality (no loves, no nature points);
// an S leans one nature point toward its skill (T1b: S from 11 points), so it also loves that skill, as a real S does
const FLAVOUR = { charm: 'sweet', bounce: 'heat', sturdy: 'mineral', speed: 'spark', smarts: 'prism' };
const LEAN = { charm: { cuddly: 70 }, bounce: { playful: 70 }, sturdy: { playful: 30 }, speed: { patient: 30 }, smarts: { patient: 70 } };
function subject(x, skill, grade) {
  const carrier = grade === 'C' ? SKILL_IDS.find(s => s !== skill) : skill;
  const calm = Object.fromEntries(PERSONALITY_IDS.map(k => [k, 50]));
  Object.assign(x, { form: { id: FLAVOUR[carrier] }, traits: { [FLAVOUR[carrier]]: 100 }, personality: grade === 'S' ? { ...calm, ...LEAN[carrier] } : calm,
    potential: { ...Object.fromEntries(SKILL_IDS.map(s => [s, 1])), [carrier]: { C: 1, B: 1, A: 3, S: 5 }[grade] } });
  if (TL.gradeOf(x, skill) !== grade) throw new Error(`subject: wanted ${skill} ${grade}, got ${TL.gradeOf(x, skill)}`);
  return x;
}

// ---------- one 30-day ranch (pearl-sim's run(), with shows) ----------
// o.shows: null (none) | { player: 'normal' | 'spam', cheers: 'good' | 'perfect' | 'nice' | 'none' }
// o.focus: { contest, grade }: the first resident (the keeper) is the subject, trains its contest's main skill to its
//   cap first, then Smarts, then the support skill (design section 9's model), and only enters that contest
function run(profile, o = {}) {
  Math.random = LCG(4242);   // (pearl-sim seeds Math.random so at its start; nothing in these rules reads it)
  const P = PROFILES[profile];
  const st = createState();
  st.phase = 'play'; st.slime.name = 'Home';
  st.outfits.owned = [...OWNED];
  const R = st.ranch;
  const ranch = new Ranch(st);
  let bondGiven = 0;
  const rl = new RanchLife(st, ranch, { addBond: n => { bondGiven += n; return 0; } });
  const pick = rng(`pearl-sim:${profile}`);
  let raisedAt = 0;
  const newResident = (name, gen, bond, runTotal) => {
    const personality = Object.fromEntries(PERSONALITY_IDS.map(k => [k, Math.round(20 + pick() * 60)]));
    const x = { id: `${name}-${gen}`, name, form: { id: 'mochi', name: 'Marshmallow Slime' }, traits: { sweet: 60, heat: 40 }, personality, bondLevel: bond, runTotal, jps: 4,
      generation: gen, happiness: 90, pearlT: 0.6, petAt: 0, skills: emptySkills(), lesson: null, trip: null, lineage: { parents: [] } };
    if (RAISED) { const r = RAISED[raisedAt++ % RAISED.length]; Object.assign(x, { form: r.form, traits: r.traits, personality: r.personality, potential: r.potential }); }
    return x;
  };
  R.residents.push(newResident('Juniper', 1, 2, 3e8), newResident('Pebble', 2, 1, 1.2e9));
  const focus = o.focus ? { ...o.focus, main: CONTEST_BY_ID[o.focus.contest].acts.find(a => a.role === 'main').skill, support: CONTEST_BY_ID[o.focus.contest].acts.find(a => a.role === 'support').skill || null } : null;
  if (focus) subject(R.residents[0], focus.main, focus.grade);
  R.pearls = 34; R.totalPearls = 34; R.gift = true;
  const S = { trip: 0, gift: 0, sales: 0, spent: { lessons: 0, lanes: 0, wagons: 0, basket: 0, slots: 0, eggs: 0 }, events: [], pocket: [], firstStar: null, three: null, full: null, perDay: [], overflow: false, lastEggGen: 0, gen: 2,
    prizes: 0, shows: 0, wins: [], cupDay: {}, firstLittle: null, firstLittleNoStyle: null, salesNoTrophies: 0 };
  const day = now => (now - T0) / DAY;
  const at = now => `d${Math.floor(day(now)) + 1} ${String(Math.floor((now % DAY) / H)).padStart(2, '0')}:${String(Math.floor((now % H) / MIN)).padStart(2, '0')}`;
  const ev = (now, what) => S.events.push({ t: day(now), at: at(now), what });
  const pearlsBefore = () => R.totalPearls;
  let now = T0 + 8 * H, lastOut = now;
  const sessions = [];
  for (let d = 0; d < DAYS; d++) for (const [h, m] of P.sessions) sessions.push({ start: T0 + d * DAY + h * H, len: m * MIN });
  const income = (fn) => { const b = pearlsBefore(); const r = fn(); return [r, R.totalPearls - b]; };
  const noteDone = done => {
    for (const r of done) {
      if (r.kind === 'trip') { S.trip += r.pearls; S.gift += r.gift || 0; if (r.friend) ev(r.at, `Friend of ${r.friend.name} (+${r.gift})`); }
      else {
        const x = ranch.resident(r.id);
        const total = SKILL_IDS.reduce((t, k) => t + stars(x, k), 0);
        if (!S.firstStar) S.firstStar = r.at;
        if (!S.three && r.star >= 3) S.three = r.at;
        if (!S.full && total === SKILL_IDS.length * RANCH_LIFE.maxStars) { S.full = r.at; ev(r.at, `${x.name} fully trained`); }
      }
    }
  };
  const spend = (cat, n) => { S.spent[cat] += n; };
  const nextSessionStart = i => sessions[i + 1]?.start ?? now + 12 * H;

  // ---------- the shows (new) ----------
  const shows = () => {
    if (!o.shows) return;
    for (const x of R.residents) {
      if (busy(x)) continue;
      const dress = K.bestDress(st.outfits.owned).worn;
      for (const slot of K.SLOTS) if ((x.worn?.[slot] || null) !== dress[slot]) K.dressUp(st, x.id, slot, dress[slot]);
      for (const c of focus && x === R.residents[0] ? [focus.contest] : focus ? [] : CONTEST_IDS) {
        const won = K.trophiesOf(x)[c], next = K.nextCup(x, c);
        const cups = o.shows.player === 'spam' ? Array.from({ length: next }, (_, i) => i + 1) : won >= CONTESTS.cups.length ? [] : [next];
        for (const cup of cups) {
          const res = K.scoreShow(st, x.id, c, { cup, cheers: o.shows.cheers });
          if (!res.ok || (o.shows.player !== 'spam' && !res.won)) continue;   // (a normal player reads the entry card first)
          const g = K.applyShow(st, res, now);
          S.shows++;
          if (g.trophy) {
            S.prizes += g.pearls;
            S.wins.push({ t: day(now), at: at(now), name: x.name, contest: c, cup: res.cupId, pearls: g.pearls, score: res.score });
            const key = `${x === R.residents[0] ? 'keeper' : 'any'}:${c}:${res.cupId}`;
            if (S.cupDay[key] === undefined) S.cupDay[key] = day(now);
            if (S.cupDay[`any:${c}:${res.cupId}`] === undefined) S.cupDay[`any:${c}:${res.cupId}`] = day(now);
            if (res.cupId === 'little' && S.firstLittle === null) S.firstLittle = { t: day(now), at: at(now), contest: c, name: x.name };
            if (res.cupId === 'little' && c !== 'beauty' && S.firstLittleNoStyle === null) S.firstLittleNoStyle = { t: day(now), at: at(now), contest: c, name: x.name };
            if (!QUIET) ev(now, `${x.name} wins the ${res.cupName} at the ${res.contestName} (${res.score} vs ${res.top}; +${g.pearls})`);
          }
        }
      }
    }
  };
  // the keeper's next lesson in a focus run: main skill to its cap, then Smarts, then support, then the rest (cheapest)
  const focusLesson = x => {
    for (const k of [focus.main, 'smarts', focus.support].filter(Boolean)) { const l = rl.lessonFor(x, k); if (l) return { x, k, l }; }
    return null;
  };

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const [r1] = income(() => rl.passTime((s.start - lastOut) / 1000, s.start));
    noteDone(r1.done);
    if (R.basket.stored >= ranch.basketCap()) S.overflow = true;
    const nearFull = R.basket.stored >= 0.75 * ranch.basketCap();
    now = s.start;
    ranch.visit(now);
    for (const x of R.residents) ranch.pet(x.id, now);
    income(() => ranch.collectBasket());
    const dueGen = 2 + Math.floor(day(now) / P.moveEvery);
    const moveSoon = 2 + Math.floor((day(now) + 1) / P.moveEvery) > S.gen;
    const plan = () => {
      shows();
      if (S.overflow) { const c = ranch.basketCost(); if (c !== null && R.pearls >= c) { ranch.buyBasket(); spend('basket', c); ev(now, `basket level ${R.basket.level + 1} (${ranch.basketCap()})`); S.overflow = false; } }
      if (moveSoon && ranch.free() <= 0) { const c = ranch.slotCost(); if (c !== null && R.pearls >= c) { ranch.buySlot(); spend('slots', c); ev(now, `slot ${R.slots}`); } }
      if (moveSoon && S.lastEggGen < S.gen + 1 && R.pearls >= BREEDING.cost && R.nursery.eggs.length < BREEDING.maxEggs) {
        const free = R.residents.filter(x => !x.trip && !x.lesson && !ranch.restingToday(x, now));
        if (free.length >= 2 && ranch.breed(free[0].id, free[1].id, now)) { spend('eggs', BREEDING.cost); S.lastEggGen = S.gen + 1; ev(now, `Nursery egg`); }
      }
      const reserve = (S.overflow || nearFull ? ranch.basketCost() || 0 : 0) + (moveSoon && ranch.free() <= 0 ? ranch.slotCost() || 0 : 0) + (moveSoon && S.lastEggGen < S.gen + 1 ? BREEDING.cost : 0);
      const home = () => R.residents.filter(x => !x.trip && !x.lesson);
      const keeper = [...R.residents].sort((a, b) => SKILL_IDS.reduce((t, k) => t + stars(b, k), 0) - SKILL_IDS.reduce((t, k) => t + stars(a, k), 0) || a.generation - b.generation)[0];
      for (let guard = 0; guard < 4 && rl.lanesFree() > 0; guard++) {
        let best = null;
        const keeperFree = keeper && !keeper.trip && !keeper.lesson && !rl.learners().includes(keeper);
        const subj = focus && R.residents[0];
        if (subj && !subj.trip && !subj.lesson) best = focusLesson(subj);   // (a focus run: the subject first, on any lane)
        const cands = keeperFree ? [keeper] : home();
        if (!best) for (const x of cands) for (const k of SKILL_IDS) { const l = rl.lessonFor(x, k); if (l && (!best || l.pearls < best.l.pearls || (l.pearls === best.l.pearls && l.seconds < best.l.seconds))) best = { x, k, l }; }
        if (!best || R.pearls - best.l.pearls < reserve) break;
        rl.train(best.x.id, best.k, now); spend('lessons', best.l.pearls);
      }
      const until = nextSessionStart(i);
      for (let guard = 0; guard < 4 && rl.wagonsFree() > 0; guard++) {
        const x = home().filter(y => y !== keeper || rl.lanesFree() <= 0).sort((a, b) => a.happiness - b.happiness)[0];
        if (!x) break;
        let best = null;
        for (const p of RANCH_LIFE.places) {
          const t = rl.tripFor(x, p.id);
          if (!t.open) continue;
          const fits = now + t.seconds * 1000 <= until;
          const score = (fits ? 1e6 : 0) + (fits ? t.seconds : -t.seconds) + (t.souvenir ? 1 : 0);
          if (!best || score > best.score) best = { p, t, score };
        }
        if (!best) break;
        rl.send(x.id, best.p.id, now);
      }
      const lc = rl.laneCost(), wc = rl.wagonCost();
      if (lc !== null && R.pearls >= lc + reserve + 30) { rl.buyLane(); spend('lanes', lc); ev(now, `lane ${R.life.lanes}`); }
      else if (wc !== null && R.pearls >= wc + reserve + 60) { rl.buyWagon(); spend('wagons', wc); ev(now, `wagon ${R.life.wagons}`); }
    };
    plan();
    if (dueGen > S.gen) {
      if (ranch.free() <= 0) {
        const out = R.residents.filter(x => !x.trip && !x.lesson).sort((a, b) => SKILL_IDS.reduce((t, k) => t + stars(a, k), 0) - SKILL_IDS.reduce((t, k) => t + stars(b, k), 0))[0];
        if (out) {
          const plain = { ...out, contests: K.createResidentContests() };
          const o0 = ranch.offers(plain, now)[0];
          const offer = ranch.offers(out, now).find(q => q.buyer === o0.buyer) || ranch.offers(out, now)[0];
          const r = ranch.place(out.id, offer.buyer, now);
          if (r) { S.sales += r.offer.pearls; S.salesNoTrophies += o0.pearls; ev(now, `${out.name} to a new home (+${r.offer.pearls})`); }
        }
      }
      if (ranch.free() > 0) {
        S.gen++;
        const egg = R.nursery.eggs.shift();
        R.residents.push(newResident(`Gen${S.gen}`, S.gen, 3 + (S.gen % 3), 2e11));
        ev(now, `Gen${S.gen} moves in${egg ? ' (next baby from the Nursery egg)' : ''}`);
      }
    }
    const end = s.start + s.len;
    for (let t = now; t < end; t += 10e3) {
      ranch.tick(10);
      const done = rl.resolve(t + 10e3);
      if (done.length) { noteDone(done); now = t + 10e3; plan(); }
    }
    income(() => ranch.collectBasket());
    now = end; lastOut = end;
    S.pocket.push([day(now), R.pearls]);
    const d = Math.floor(day(now));
    S.perDay[d] = { earned: R.totalPearls - S.sales, trip: S.trip, prizes: S.prizes };
  }
  S.made = R.totalPearls - 34 - S.sales;
  S.final = { pearls: R.pearls, residents: R.residents.length, slots: R.slots, basket: R.basket.level, lanes: R.life.lanes, wagons: R.life.wagons, souvenirs: Object.keys(R.life.souvenirs).length, friends: R.life.friends.length, trips: R.life.trips, lessons: R.life.lessons, treats: bondGiven / RANCH_LIFE.treat.bond };
  S.stars = R.residents.map(x => `${x.name}:${SKILL_IDS.reduce((t, k) => t + stars(x, k), 0)}`).join(' ');
  S.trophies = R.residents.map(x => `${x.name}:${K.trophyCount(x)}${K.titleOf(x) ? ` (${K.titleOf(x)})` : ''}`).join(' ');
  S.st = st; S.ranch = ranch; S.end = now;
  return S;
}

const fmtD = t => (t === null || t === undefined ? 'never' : `day ${(t + 1).toFixed(2)}`);
const row = (what, target, val, pass) => ({ what, target, val, pass });
const rows = [];
const log = (...a) => { if (!QUIET) console.log(...a); };

// ---------- 0. the copy of pearl-sim's player is pearl-sim (no shows: the same pearls, residents, stars) ----------
const pearlSim = (...a) => execFileSync(process.execPath, [path.join(HERE, 'pearl-sim.mjs'), ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });
const base = {};
const copyOk = [];
for (const p of Object.keys(PROFILES)) {
  base[p] = run(p);
  const out = pearlSim(p, 'quiet', `days=${DAYS}`, ...(RAISED ? [`residents=${RAISED_FILE}`] : []));
  const made = +out.match(/pearls made (\d+)/)[1], final = out.match(/final: (\{.*?\}) \| stars (.*)/);
  copyOk.push(made === base[p].made && final[1] === JSON.stringify(base[p].final) && final[2].trim() === base[p].stars);
  log(`${p}, no shows: made ${base[p].made} (pearl-sim ${made}); final ${JSON.stringify(base[p].final)}`);
}

// ---------- 1. the normal players with shows (Good cheers), and the spamming player ----------
const withShows = {};
for (const p of ['engaged', 'casual']) {
  const S = withShows[p] = run(p, { shows: { player: 'normal', cheers: 'good' } });
  const B = base[p];
  log(`\n=== ${p} with shows (Good cheers) ===`);
  log(`pearls made ${S.made} (no shows ${B.made}): +${(100 * (S.made / B.made - 1)).toFixed(1)}%; first-win prizes ${S.prizes} (${(100 * S.prizes / B.made).toFixed(1)}% of the no-show pearls); shows ${S.shows}`);
  log(`new-home sales ${S.sales} (the same slimes' offers with no trophies: ${S.salesNoTrophies})`);
  log(`trophies at the end: ${S.trophies}`);
  log(`first Little Cup: ${S.firstLittle ? `${S.firstLittle.at} (${S.firstLittle.name}, ${CONTEST_BY_ID[S.firstLittle.contest].name})` : 'never'}; first without Style: ${S.firstLittleNoStyle ? `${S.firstLittleNoStyle.at} (${S.firstLittleNoStyle.name}, ${CONTEST_BY_ID[S.firstLittleNoStyle.contest].name})` : 'never'}`);
  if (!QUIET) for (const w of S.wins) console.log(`  ${w.at}  ${w.name} ${CONTEST_BY_ID[w.contest].name} ${w.cup} (${w.score}) +${w.pearls}`);
  const per = [1, 2, 7, 14, 21, 30].filter(d => d <= DAYS).map(d => { const q = S.perDay[d - 1], b = B.perDay[d - 1]; return `d${d}: ${q.earned - 34} vs ${b.earned - 34} (prizes ${q.prizes})`; });
  log('  made with vs without shows: ' + per.join(' | '));
}
const spam = { mash: run('spam', { shows: { player: 'spam', cheers: 'nice' } }), skip: run('spam', { shows: { player: 'spam', cheers: 'none' } }) };
log(`\n=== spam with shows (every 5 min; every cup again each time) ===`);
for (const [k, S] of Object.entries(spam)) log(`${k}: made ${S.made} (no shows ${base.spam.made}), prizes ${S.prizes}, shows ${S.shows}; trophies ${S.trophies}`);

// ---------- 2. per grade: the day each cup is first won (focus runs, engaged) ----------
const GRADES = ['C', 'B', 'A', 'S'];
const MODEL = { C: [1.3, 1.8, 3.5, null], B: [1.3, 1.8, 3.3, null], A: [1.3, 1.6, 2.9, 4.1], S: [1.3, 1.6, 3.1, 4.3] };
const focusDays = {};
for (const c of CONTEST_IDS) for (const g of GRADES) {
  const S = run('engaged', { shows: { player: 'normal', cheers: 'good' }, focus: { contest: c, grade: g } });
  focusDays[`${c}:${g}`] = CONTESTS.cups.map(cup => S.cupDay[`keeper:${c}:${cup.id}`] ?? null);
}
log('\n=== per grade (the keeper trains its main skill first, then Smarts, then support; engaged; Good cheers): day each cup is first won ===');
log(`${'contest'.padEnd(14)} grade  ${CONTESTS.cups.map(c => c.name.padEnd(12)).join(' ')} | design model (Little/Big/Grand/Champion)`);
for (const c of CONTEST_IDS) for (const g of GRADES) log(`${CONTEST_BY_ID[c].name.padEnd(14)} ${g}      ${focusDays[`${c}:${g}`].map(t => fmtD(t).padEnd(12)).join(' ')} | ${MODEL[g].map(d => (d === null ? 'never' : `day ${d}`)).join(' / ')}`);

// ---------- 3. a fully trophied slime at auction and in new-home offers ----------
const auctionRatios = [], offerRatios = [];
{
  const S = withShows.engaged, ranch = S.ranch;
  const pool = [...S.st.ranch.residents, ...base.engaged.st.ranch.residents];
  for (const x of pool) for (let d = 0; d < 7; d++) {
    const when = S.end + d * DAY;
    const none = { ...x, contests: K.createResidentContests() }, all = { ...x, contests: { trophies: Object.fromEntries(CONTEST_IDS.map(id => [id, CONTESTS.cups.length])) } };
    const a0 = ranch.auction(none, when).price, a1 = ranch.auction(all, when).price;
    if (a0 > 0) auctionRatios.push(a1 / a0);
    const o0 = ranch.offers(none, when)[0].pearls, o1 = ranch.offers(all, when).find(o => o.buyer === ranch.offers(none, when)[0].buyer).pearls;
    offerRatios.push(o1 / o0);
  }
}
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const pct = r => `${(100 * (r - 1)).toFixed(1)}%`;

// ---------- 4. identity (no shows): economy-sim vs main 00f1430, pearl-sim vs talents-t1b de7c4d3 ----------
const md5 = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 12);
// main @ 00f1430 and talents-t1b @ de7c4d3 (git archive <rev> | tar -x; the same commands there; T1b's Potential
// weights move the all-profiles pearl-sim, its all-C run is the same as T1's)
const REF = { economy: '25f842705411', pearl: '0d94560db4d6', pearlAllC: 'e91d5de98290' };
const eco = ['12 quiet', '12 casual quiet', '2 quiet spam', '4 casual quiet gen2=1e9'].map(a => execFileSync(process.execPath, [path.join(HERE, 'economy-sim.mjs'), ...a.split(' ')], { encoding: 'utf8' })).join('');
const ecoHash = md5(eco), pearlHash = md5(pearlSim()), pearlAllC = md5(pearlSim('allc'));

// ---------- the table ----------
const E = withShows.engaged, Cs = withShows.casual, Eb = base.engaged, Cb = base.casual;
const firstEnd = T0 + 8 * H + PROFILES.engaged.sessions[0][1] * MIN;
const gain = (a, b) => a.made / b.made - 1;
rows.push(row('pearl-sim\'s player, copied here: with no shows it makes exactly what pearl-sim makes', 'engaged, casual, spam identical', copyOk.map((v, i) => `${Object.keys(PROFILES)[i]} ${v ? 'same' : 'DIFFERENT'}`).join(', '), copyOk.every(Boolean)));
rows.push(row('first Little Cup win in the first ranch session (engaged, day 1 08:00-08:25)', 'by d1 08:25',
  `${E.firstLittle ? `${E.firstLittle.at} ${CONTEST_BY_ID[E.firstLittle.contest].name}` : 'never'}; without Style (Sprint/Bounce-Off): ${E.firstLittleNoStyle ? `${E.firstLittleNoStyle.at} ${CONTEST_BY_ID[E.firstLittleNoStyle.contest].name}` : 'never'}`,
  !!E.firstLittle && T0 + E.firstLittle.t * DAY <= firstEnd));
for (const c of CONTEST_IDS) for (const g of GRADES) {
  const d = focusDays[`${c}:${g}`], champ = g === 'A' || g === 'S';
  const okLadder = d[0] !== null && d[1] !== null && d[2] !== null && (champ ? d[3] !== null : d[3] === null) && d.filter(v => v !== null).every((v, i, a) => i === 0 || v >= a[i - 1]);
  rows.push(row(`${CONTEST_BY_ID[c].name}, grade ${g}: the day each cup is first won (Little/Big/Grand/Champion)`, `Grand ${champ ? 'and Champion' : 'yes, Champion never'} (model ${MODEL[g].map(v => v ?? '-').join('/')})`,
    d.map(v => (v === null ? 'never' : (v + 1).toFixed(2))).join(' / '), okLadder));
}
rows.push(row('contest pearls, engaged, 30 days (pearls made with shows vs without)', 'at most +20%', `${pct(1 + gain(E, Eb))} (${Eb.made} -> ${E.made}); first-win prizes ${E.prizes} = ${(100 * E.prizes / Eb.made).toFixed(1)}%`, gain(E, Eb) <= 0.20));
rows.push(row('contest pearls, casual, 30 days', 'at most +25%', `${pct(1 + gain(Cs, Cb))} (${Cb.made} -> ${Cs.made}); first-win prizes ${Cs.prizes} = ${(100 * Cs.prizes / Cb.made).toFixed(1)}%`, gain(Cs, Cb) <= 0.25));
for (const [k, S] of Object.entries(spam)) rows.push(row(`spam (${k === 'mash' ? 'mash' : 'skip'}, every 5 min, every cup again each time) never beats normal play`, 'spam pearls <= engaged pearls (with shows)',
  `spam ${S.made} (prizes ${S.prizes}, ${S.shows} shows) vs engaged ${E.made} (prizes ${E.prizes})`, S.made <= E.made));
rows.push(row('a fully trophied slime (12 trophies, Beauty Champion): auction income', 'at most +25%', `+${(100 * (Math.max(...auctionRatios) - 1)).toFixed(1)}% max, ${pct(mean(auctionRatios))} mean (${auctionRatios.length} auctions); new-home offers ${pct(mean(offerRatios))}`, Math.max(...auctionRatios) <= 1.25));
rows.push(row('economy-sim IDENTICAL with no shows (the 4 standard runs, md5 vs main 00f1430)', REF.economy, ecoHash, ecoHash === REF.economy));
rows.push(row('pearl-sim IDENTICAL with no shows (all profiles, md5 vs talents-t1b de7c4d3)', REF.pearl, pearlHash, pearlHash === REF.pearl));
rows.push(row('pearl-sim allc IDENTICAL (every grade C, md5 vs talents-t1b de7c4d3)', REF.pearlAllC, pearlAllC, pearlAllC === REF.pearlAllC));

console.log(`\n=== Contests: design section 9 targets vs measured (${DAYS} days; residents: ${RAISED ? 'raised slimes (talent-sim)' : 'pearl-sim stand-ins'}; ${((Date.now() - t0) / 1000).toFixed(0)} s) ===`);
console.log(`rivals ${CONTESTS.cups.map(c => c.rivals.map(r => r.score).join('/')).join(', ')}; prizes ${CONTESTS.cups.map(c => c.pearls).join('/')}; trophy value ${CONTESTS.trophyValue}`);
for (const r of rows) console.log(`${r.pass ? 'PASS' : 'FAIL'} | ${r.what.padEnd(100)} | ${r.target} | ${r.val}`);
console.log(`\n${rows.filter(r => r.pass).length} PASS, ${rows.filter(r => !r.pass).length} FAIL`);
process.exit(rows.every(r => r.pass) ? 0 : 1);
