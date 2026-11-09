// Pearl simulator: 30 days of the ranch with the real rules (core/ranch.js + core/ranch-life.js, the real RANCH and
// RANCH_LIFE numbers), to check the ranch-life balance targets (design: ranch life, section 5).
// Usage: node tools/pearl-sim.mjs [engaged|casual|spam] [nolife|notrips|nolessons] [days=30] [quiet] [allc] [residents=<file>]
//   allc:    every talent grade C (the ranch from before talents; prints exactly what the simulator printed before them)
//   residents=<file>: the residents' traits, personality, form and Potential from a JSON list (tools/talent-sim.mjs
//            writes one from its raising runs), taken in turn by each slime that moves in; default: the stand-ins below
//   no profile: every profile with and without ranch life, and the table against the targets
//   engaged: checks in every ~3 h from 8:00 to 22:00 (sessions of 5-25 min, ~85 min a day)
//   casual:  twice a day (8:00 for 15 min, 20:00 for 25 min)
//   spam:    every 5 minutes from 8:00 to 22:00, the same choices
//   nolife:  no lessons or trips (the baseline); notrips: lessons only; nolessons: trips only
// The player model (the same for every profile): each check-in it visits the ranch (the visit cheer), pets every
// slime that is home, collects the Pearl Basket, then spends in this order: a bigger basket if it overflowed, a slot if
// a slime is about to move in, one Nursery egg per generation, then (ranch life) lessons in every free lane (lane 1
// keeps training the same "keeper" slime toward five stars in everything; other lanes take the cheapest lesson; it
// keeps back what the next basket, slot or egg needs when one is coming: a basket at least 3/4 full), a
// trip for every free wagon (the longest open trip that is home by the next check-in; overnight the longest), and
// another lane / wagon when there are pearls to spare. A new grown slime moves in every 6 days (casual: 10), with a
// Gold medal (the jelly loop's measured pace: engaged slimes move out around day 6 with Gold/Platinum, casual ones
// around day 10 with Gold); when the ranch is full and a slot is too dear, the least trained slime that is not busy
// goes to a new home.
import url from 'node:url';
import path from 'node:path';
const SRC = url.pathToFileURL(path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../src')).href;
const { createState } = await import(SRC + '/core/sim.js');
const { Ranch } = await import(SRC + '/core/ranch.js');
const { RanchLife, stars, emptySkills } = await import(SRC + '/core/ranch-life.js');
const { rng } = await import(SRC + '/core/random.js');
const C = await import(SRC + '/data/content.js');
const { RANCH, RANCH_LIFE, BREEDING, SKILL_IDS, PERSONALITY_IDS, TALENTS } = C;

const args = process.argv.slice(2);
// tune=<json>: try other RANCH_LIFE numbers without editing content.js, e.g. tune='{"wagons":{"costs":[120,300]}}'
const TUNE = args.find(a => a.startsWith('tune='));
if (TUNE) {
  const merge = (dst, src) => { for (const [k, v] of Object.entries(src)) { if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object') merge(dst[k], v); else dst[k] = v; } };
  merge(RANCH_LIFE, JSON.parse(TUNE.slice(5)));
  console.log('tuned RANCH_LIFE:', TUNE.slice(5));
}
if (args.includes('allc')) { TALENTS.grades.splice(1); TALENTS.floor = 'C'; }
const PROFILE_FILE = args.find(a => a.startsWith('residents='))?.slice(10);
const RAISED = PROFILE_FILE ? JSON.parse((await import('node:fs')).readFileSync(PROFILE_FILE, 'utf8')) : null;
const DAYS = +(args.find(a => /^days=\d+$/.test(a))?.slice(5) || 30);
const QUIET = args.includes('quiet');
const H = 3600e3, MIN = 60e3, DAY = 24 * H;
const T0 = Date.UTC(2026, 10, 9, 0, 0, 0);   // a Monday, midnight (the sim's clock is UTC; check-in hours are UTC)
let rnd = 4242; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);

const PROFILES = {
  engaged: { sessions: [[8, 25], [11, 10], [14, 20], [17, 10], [20, 15], [22, 5]], moveEvery: 6 },
  casual: { sessions: [[8, 15], [20, 25]], moveEvery: 10 },
  spam: { sessions: Array.from({ length: 14 * 12 + 1 }, (_, i) => [8 + i / 12, 0]), moveEvery: 6 },
};

function run(profile, mode) {
  const life = mode !== 'nolife', lessonsOn = life && mode !== 'nolessons', tripsOn = life && mode !== 'notrips';
  const P = PROFILES[profile];
  const st = createState();
  st.phase = 'play'; st.slime.name = 'Home';
  const R = st.ranch;
  const ranch = new Ranch(st);
  // a tiny stand-in for the Sim (the treat's bond); the slime at home is not simulated
  let bondGiven = 0;
  const rl = new RanchLife(st, ranch, { addBond: n => { bondGiven += n; return 0; } });
  const pick = rng(`pearl-sim:${profile}`);
  let made = 0;
  let raisedAt = 0;
  const newResident = (name, gen, bond, runTotal) => {
    const personality = Object.fromEntries(PERSONALITY_IDS.map(k => [k, Math.round(20 + pick() * 60)]));
    const x = { id: `${name}-${gen}`, name, form: { id: 'mochi', name: 'Marshmallow Slime' }, traits: { sweet: 60, heat: 40 }, personality, bondLevel: bond, runTotal, jps: 4,
      generation: gen, happiness: 90, pearlT: 0.6, petAt: 0, skills: emptySkills(), lesson: null, trip: null, lineage: { parents: [] } };
    // a raised slime's talents (the personality roll above still happens, so the rest of the run's dice stay the same)
    if (RAISED) { const r = RAISED[raisedAt++ % RAISED.length]; Object.assign(x, { form: r.form, traits: r.traits, personality: r.personality, potential: r.potential }); }
    return x;
  };
  // where a player who just got the update starts: two residents, 34 pearls (like tools/fixtures/main-gen3.json)
  R.residents.push(newResident('Juniper', 1, 2, 3e8), newResident('Pebble', 2, 1, 1.2e9));
  R.pearls = 34; R.totalPearls = 34; R.gift = true;
  const S = { trip: 0, gift: 0, sales: 0, spent: { lessons: 0, lanes: 0, wagons: 0, basket: 0, slots: 0, eggs: 0 }, events: [], pocket: [], firstStar: null, three: null, full: null, perDay: [], overflow: false, lastEggGen: 0, gen: 2 };
  const day = now => (now - T0) / DAY;
  const at = now => `d${Math.floor(day(now)) + 1} ${String(Math.floor((now % DAY) / H)).padStart(2, '0')}:${String(Math.floor((now % H) / MIN)).padStart(2, '0')}`;
  const ev = (now, what) => S.events.push({ t: day(now), at: at(now), what });
  const pearlsBefore = () => R.totalPearls;
  let now = T0 + 8 * H, lastOut = now;   // the game was last closed at lastOut
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

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    // closed until this session
    const [r1, got1] = income(() => rl.passTime((s.start - lastOut) / 1000, s.start));
    noteDone(r1.done);
    if (R.basket.stored >= ranch.basketCap()) S.overflow = true;
    const nearFull = R.basket.stored >= 0.75 * ranch.basketCap();
    now = s.start;
    // ---------- the check-in ----------
    ranch.visit(now);
    for (const x of R.residents) ranch.pet(x.id, now);
    const [, got2] = income(() => ranch.collectBasket());
    // a new slime moves in every few days (the morning check-in)
    const dueGen = 2 + Math.floor(day(now) / P.moveEvery);
    const moveSoon = 2 + Math.floor((day(now) + 1) / P.moveEvery) > S.gen;
    let sold = 0;
    const plan = () => {
      // 1. a bigger basket when it overflowed
      if (S.overflow) { const c = ranch.basketCost(); if (c !== null && R.pearls >= c) { ranch.buyBasket(); spend('basket', c); ev(now, `basket level ${R.basket.level + 1} (${ranch.basketCap()})`); S.overflow = false; } }
      // 2. a slot when someone is about to move in and the ranch is full
      if (moveSoon && ranch.free() <= 0) { const c = ranch.slotCost(); if (c !== null && R.pearls >= c) { ranch.buySlot(); spend('slots', c); ev(now, `slot ${R.slots}`); } }
      // 3. one Nursery egg per generation (the next baby comes from it)
      if (moveSoon && S.lastEggGen < S.gen + 1 && R.pearls >= BREEDING.cost && R.nursery.eggs.length < BREEDING.maxEggs) {
        const free = R.residents.filter(x => !x.trip && !x.lesson && !ranch.restingToday(x, now));
        if (free.length >= 2 && ranch.breed(free[0].id, free[1].id, now)) { spend('eggs', BREEDING.cost); S.lastEggGen = S.gen + 1; ev(now, `Nursery egg`); }
      }
      if (!life) return;
      // keep enough for what is coming: a bigger basket when it (nearly) overflowed, the slot before a move-in, the egg
      const reserve = (S.overflow || nearFull ? ranch.basketCost() || 0 : 0) + (moveSoon && ranch.free() <= 0 ? ranch.slotCost() || 0 : 0) + (moveSoon && S.lastEggGen < S.gen + 1 ? BREEDING.cost : 0);
      // 4. lessons: lane 1 trains the keeper (the most-starred home slime) toward five stars everywhere; other lanes the cheapest lesson
      const home = () => R.residents.filter(x => !x.trip && !x.lesson);
      const keeper = [...R.residents].sort((a, b) => SKILL_IDS.reduce((t, k) => t + stars(b, k), 0) - SKILL_IDS.reduce((t, k) => t + stars(a, k), 0) || a.generation - b.generation)[0];
      for (let guard = 0; lessonsOn && guard < 4 && rl.lanesFree() > 0; guard++) {
        let best = null;
        const cands = keeper && !keeper.trip && !keeper.lesson && !rl.learners().includes(keeper) ? [keeper] : home();
        for (const x of cands) for (const k of SKILL_IDS) { const l = rl.lessonFor(x, k); if (l && (!best || l.pearls < best.l.pearls || (l.pearls === best.l.pearls && l.seconds < best.l.seconds))) best = { x, k, l }; }
        if (!best || R.pearls - best.l.pearls < reserve) break;
        rl.train(best.x.id, best.k, now); spend('lessons', best.l.pearls);
      }
      // 5. trips for every free wagon: the longest open trip home by the next check-in (overnight: the longest)
      const until = nextSessionStart(i);
      for (let guard = 0; tripsOn && guard < 4 && rl.wagonsFree() > 0; guard++) {
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
      // 6. another lane / wagon when there are pearls to spare
      const lc = rl.laneCost(), wc = rl.wagonCost();
      if (lessonsOn && lc !== null && R.pearls >= lc + reserve + 30) { rl.buyLane(); spend('lanes', lc); ev(now, `lane ${R.life.lanes}`); }
      else if (tripsOn && wc !== null && R.pearls >= wc + reserve + 60) { rl.buyWagon(); spend('wagons', wc); ev(now, `wagon ${R.life.wagons}`); }
    };
    plan();
    // a move-in (if a slot is free; otherwise the least trained slime that is home goes to a new home)
    if (dueGen > S.gen) {
      if (ranch.free() <= 0) {
        const out = R.residents.filter(x => !x.trip && !x.lesson).sort((a, b) => SKILL_IDS.reduce((t, k) => t + stars(a, k), 0) - SKILL_IDS.reduce((t, k) => t + stars(b, k), 0))[0];
        if (out) { const o = ranch.offers(out, now)[0]; const r = ranch.place(out.id, o.buyer, now); if (r) { sold += r.offer.pearls; S.sales += r.offer.pearls; ev(now, `${out.name} to a new home (+${r.offer.pearls})`); } }
      }
      if (ranch.free() > 0) {
        S.gen++;
        const egg = R.nursery.eggs.shift();
        R.residents.push(newResident(`Gen${S.gen}`, S.gen, 3 + (S.gen % 3), 2e11));
        ev(now, `Gen${S.gen} moves in${egg ? ' (next baby from the Nursery egg)' : ''}`);
      }
    }
    // the session itself: the game is open; lessons can end and start again meanwhile
    const end = s.start + s.len;
    for (let t = now; t < end; t += 10e3) {
      ranch.tick(10);
      const done = rl.resolve(t + 10e3);
      if (done.length) { noteDone(done); now = t + 10e3; plan(); }
    }
    const [, got3] = income(() => ranch.collectBasket());
    now = end; lastOut = end;
    S.pocket.push([day(now), R.pearls]);
    // daily bookkeeping (at the last session of a day)
    const d = Math.floor(day(now));
    S.perDay[d] = { earned: R.totalPearls - S.sales, trip: S.trip, spent: Object.values(S.spent).reduce((a, b) => a + b, 0) };
  }
  S.made = R.totalPearls - 34 - S.sales;   // every pearl the ranch, trips and gifts brought (not sales)
  S.final = { pearls: R.pearls, residents: R.residents.length, slots: R.slots, basket: R.basket.level, lanes: R.life.lanes, wagons: R.life.wagons, souvenirs: Object.keys(R.life.souvenirs).length, friends: R.life.friends.length, trips: R.life.trips, lessons: R.life.lessons, treats: bondGiven / RANCH_LIFE.treat.bond };
  S.stars = R.residents.map(x => `${x.name}:${SKILL_IDS.reduce((t, k) => t + stars(x, k), 0)}`).join(' ');
  return S;
}

const fmtT = t => (t === null ? 'never' : `day ${(t + 1).toFixed(2)}`);
const firstOf = (S, re) => S.events.find(e => re.test(e.what))?.t ?? null;
function show(profile, mode, S) {
  const tag = `${profile}${mode ? ' ' + mode : ''}`;
  console.log(`\n=== ${tag} (${DAYS} days) ===`);
  console.log(`pearls made ${S.made} (${(S.made / DAYS).toFixed(1)}/day): trips ${S.trip} (${(100 * S.trip / Math.max(1, S.made)).toFixed(1)}%), Friend gifts ${S.gift}; new-home sales ${S.sales}`);
  console.log(`spent: ${Object.entries(S.spent).map(([k, v]) => `${k} ${v}`).join(', ')} | left ${S.final.pearls}`);
  console.log(`first star ${S.firstStar === null ? 'never' : fmtT((S.firstStar - T0) / DAY)}, a 3-star skill ${S.three === null ? 'never' : fmtT((S.three - T0) / DAY)}, a fully trained slime ${S.full === null ? 'never' : fmtT((S.full - T0) / DAY)}`);
  console.log(`final: ${JSON.stringify(S.final)} | stars ${S.stars}`);
  if (!QUIET) for (const e of S.events) console.log(`  ${e.at}  ${e.what}`);
  const per = [1, 2, 7, 14, 21, 30].filter(d => d <= DAYS).map(d => { const p = S.perDay[d - 1]; return `d${d}: made ${p.earned - 34} trips ${p.trip} spent ${p.spent}`; });
  console.log('  ' + per.join(' | '));
}

const only = Object.keys(PROFILES).find(p => args.includes(p));
const profiles = only ? [only] : Object.keys(PROFILES);
const MODES = ['nolife', 'notrips', 'nolessons'];
const modes = only ? [MODES.find(m => args.includes(m)) || ''] : ['', 'nolife', ...(args.includes('parts') ? ['notrips', 'nolessons'] : [])];
const results = {};
for (const p of profiles) for (const m of modes) { const S = run(p, m); results[`${p}${m ? ' ' + m : ''}`] = S; show(p, m, S); }

if (!only) {
  console.log('\n=== against the targets (design section 5) ===');
  const rows = [];
  const E = results.engaged, En = results['engaged nolife'], Cs = results.casual, Cn = results['casual nolife'], Sp = results.spam, Sn = results['spam nolife'];
  const gain = (a, b) => 100 * (a.made / b.made - 1);
  const dayOf = t => (t === null ? null : (t - T0) / DAY);
  rows.push(['engaged: first star in the first session (8:00-8:25 on day 1)', `${E.firstStar === null ? 'never' : fmtT(dayOf(E.firstStar))}`, E.firstStar !== null && E.firstStar <= T0 + 8 * H + 25 * MIN]);
  rows.push(['engaged: a skill at 3 stars by day 2', fmtT(dayOf(E.three)), E.three !== null && dayOf(E.three) < 2]);
  rows.push(['engaged: a fully trained slime in about 3-4 weeks (2 lanes)', `${fmtT(dayOf(E.full))}, lanes ${E.final.lanes}`, E.full !== null && dayOf(E.full) >= 17 && dayOf(E.full) <= 31]);
  rows.push(['engaged: trips add 15-30% (net, vs nolife)', `${gain(E, En).toFixed(1)}% net; trips ${(100 * E.trip / E.made).toFixed(1)}% of pearls made`, gain(E, En) >= 15 && gain(E, En) <= 30]);
  rows.push(['casual: a bit more than engaged, never > 40%', `${gain(Cs, Cn).toFixed(1)}% net; trips ${(100 * Cs.trip / Cs.made).toFixed(1)}%`, gain(Cs, Cn) >= gain(E, En) && gain(Cs, Cn) <= 40]);
  rows.push(['spam: no gain over engaged from ranch life (nothing is tap-driven)', `spam ${gain(Sp, Sn).toFixed(1)}% vs engaged ${gain(E, En).toFixed(1)}%`, gain(Sp, Sn) <= gain(E, En)]);
  for (const [name, A, B] of [['engaged', E, En], ['casual', Cs, Cn]]) {
    // bought at the same time or sooner; or, if bought later, there were already enough pearls for it when the nolife
    // player bought it (it was bought later only because it was not needed yet: e.g. travelers banked what would have
    // overflowed the basket)
    const costs = { 'basket level 2': RANCH.basket[1].cost, 'basket level 3': RANCH.basket[2].cost, 'basket level 4': RANCH.basket[3].cost, 'slot 4': RANCH.slotCosts[0], 'slot 5': RANCH.slotCosts[1], 'Nursery egg': BREEDING.cost };
    for (const [what, cost] of Object.entries(costs)) {
      const re = new RegExp('^' + what);
      const a = firstOf(A, re), b = firstOf(B, re);
      const had = b === null ? null : (A.pocket.findLast(([t]) => t <= b + 1e-9)?.[1] ?? 0);
      const okay = b === null || (a !== null && a <= b + 0.01) || (had !== null && had >= cost);
      rows.push([`${name}: ${what} at the same pace or sooner`, `${a === null ? 'never' : fmtT(a)} (nolife ${b === null ? 'never' : fmtT(b)})${a !== null && b !== null && a > b + 0.01 ? `; had ${had} pearls then (costs ${cost})` : ''}`, okay]);
    }
  }
  for (const [what, val, okay] of rows) console.log(`${okay ? 'MEETS ' : 'MISSES'} | ${what.padEnd(66)} | ${val}`);
}
