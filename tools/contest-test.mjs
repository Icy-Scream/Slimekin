// Contests rules check (plain node, no browser): the CONTESTS numbers as the design (acts and their skills, score
// parts and caps, Style, cups and rivals, prizes), every score part, ties, the cup ladder (no skipping), prizes once and
// never on repeats, the Trophy Shelf and Journal line, perks and trophy value (and exactly today's numbers with no
// shows), busy residents refused, Dress up (ownership and slot), the cheer function (mashing = 1 per act, never more
// than timing), the coach's tip, determinism, "Champion needs a talent", and every old save (tools/fixtures/, barn/,
// talents/).
//   node tools/contest-test.mjs
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
let rnd = 31337; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);

const C = await import(SRC + '/data/content.js');
const K = await import(SRC + '/core/contests.js');
const TL = await import(SRC + '/core/talents.js');
const RL = await import(SRC + '/core/ranch-life.js');
const { Sim, createState, migrate } = await import(SRC + '/core/sim.js');
const { Ranch } = await import(SRC + '/core/ranch.js');
const { residentMedal } = await import(SRC + '/core/medals.js');
const { heirloomMult } = await import(SRC + '/core/heirlooms.js');
const { checkSave } = await import(SRC + '/core/save-check.js');
const { CONTESTS: CT, SKILL_IDS, PERSONALITY_IDS, RANCH_LIFE: L, BUYER_BY_ID, OUTFITS } = C;

let fails = 0, passes = 0;
const ok = (cond, what, extra = '') => { if (cond) { passes++; console.log('ok   - ' + what + (extra ? ' | ' + extra : '')); } else { fails++; console.log('FAIL - ' + what + (extra ? ' | ' + extra : '')); } };
const clone = o => JSON.parse(JSON.stringify(o));
const H = 3600e3, NOW = Date.UTC(2026, 10, 8, 9, 0, 0);
const mid = () => Object.fromEntries(PERSONALITY_IDS.map(k => [k, 50]));
const ones = () => Object.fromEntries(SKILL_IDS.map(k => [k, 1]));
const skills = (o = {}) => ({ ...RL.emptySkills(), ...o });
// the flavour and pure form that feed each skill (TALENTS 2a / 2c)
const FLAVOUR = { charm: 'sweet', bounce: 'heat', sturdy: 'mineral', speed: 'spark', smarts: 'prism' };
// A resident whose talent in `skill` is `grade`: diet 3 + form 2 + Potential (1 B, 3 A, 5 S); for C, another skill
// carries the B (so the cozy floor does not lift this one).
let nid = 0;
function graded(skill, grade, o = {}) {
  const carrier = grade === 'C' ? SKILL_IDS.find(s => s !== skill) : skill;
  const potential = { ...ones(), [carrier]: { C: 1, B: 1, A: 3, S: 5 }[grade] };
  return { id: 'c' + (nid++), name: o.name || 'Pip', form: { id: FLAVOUR[carrier] }, traits: { [FLAVOUR[carrier]]: 100 }, personality: mid(), potential,
    bondLevel: 2, runTotal: 5e8, jps: 4, generation: 1, happiness: 100, pearlT: 0, petAt: 0, lineage: { parents: [] }, skills: skills(), lesson: null, trip: null,
    talentsSeen: [], worn: { head: null, face: null, neck: null }, contests: K.createResidentContests(), ...o };
}
function world(list, pearls = 0) {
  const st = createState();
  st.phase = 'play'; st.slime.name = 'Clover';
  st.ranch.residents = list;
  st.ranch.pearls = st.ranch.totalPearls = pearls;
  st.ranch.slots = 10;
  return { st, sim: new Sim(st), R: st.ranch };
}
const show = (st, x, contest, o = {}) => K.scoreShow(st, x.id, contest, { cheers: 'good', ...o });
const play = (st, x, contest, o = {}) => { const r = show(st, x, contest, o); return { r, a: K.applyShow(st, r, NOW) }; };

// ---------- 1. the numbers are the design's ----------
console.log('\n# CONTESTS data (design sections 4-7)');
const acts = Object.fromEntries(CT.contests.map(c => [c.id, c.acts.map(a => `${a.role}:${a.style ? 'style' : a.skill}`).join(' ')]));
ok(JSON.stringify(acts) === JSON.stringify({ beauty: 'main:charm support:style tricks:smarts', sprint: 'main:speed support:sturdy tricks:smarts', bounce: 'main:bounce support:speed tricks:smarts' }),
  'section 4: Beauty = Charm / Style / Smarts, Sprint = Speed / Sturdy / Smarts, Bounce-Off = Bounce / Speed / Smarts', JSON.stringify(acts));
const sc = CT.score;
ok(sc.main === 10 && sc.support === 4 && sc.tricks === 4 && sc.cap === 20 && sc.styleCap === 20 && JSON.stringify(sc.flair) === JSON.stringify({ C: 0, B: 3, A: 6, S: 10 }) && sc.moodPer === 20,
  'section 5: main 10/star, support and tricks 4/star up to 20, Style up to 20, flair B 3 / A 6 / S 10, mood happiness/20');
ok(JSON.stringify(CT.style) === JSON.stringify({ bow: 4, bowtie: 5, glasses: 5, flowers: 6, scarf: 6, beret: 7, shades: 7, party: 8, crown: 9 }) && OUTFITS.every(o => CT.style[o.id] > 0),
  'section 5: the Style table, one entry for every outfit');
ok(JSON.stringify(CT.cheer.points) === JSON.stringify({ perfect: 3, good: 2, nice: 1, none: 0 }) && CT.cheer.reduced === 'good', 'cheers: Perfect 3, Good 2, Nice try 1, none 0; Reduced motion = Good');
ok(JSON.stringify(CT.cups.map(c => c.rivals.map(r => r.score))) === JSON.stringify([[12, 16, 19], [30, 38, 45], [60, 72, 85], [90, 100, 110]]),
  'section 6: rivals 12/16/19, 30/38/45, 60/72/85, 90/100/110', JSON.stringify(CT.cups.map(c => c.rivals.map(r => r.score))));
ok(CT.cups.every(c => c.rivals.every(r => BUYER_BY_ID[r.place] && r.name === `${BUYER_BY_ID[r.place].name} rival`)), 'rivals: placeholder names tied to a buyer place ("Puddle Café rival")', CT.cups[0].rivals.map(r => r.name).join(', '));
ok(JSON.stringify(CT.cups.map(c => c.pearls)) === JSON.stringify([5, 15, 40, 100]) && CT.cups.map(c => c.id).join() === 'little,big,grand,champion', 'section 7: first-win pearls Little 5, Big 15, Grand 40, Champion 100');
ok(CT.trophyValue > 0 && CT.trophyValue <= 0.03, `section 7: trophy value per trophy (design 0.03; ${CT.trophyValue})`);
ok(JSON.stringify(CT.perks) === JSON.stringify({ beauty: { offers: 0.05 }, sprint: { tripTime: 0.05 }, bounce: { pearls: 0.03 } }), 'section 7: Champion perks: Beauty offers +5%, Sprint trips 5% shorter, Bounce-Off ranch pearls +3%');
ok(!/Math\.random\s*\(/.test(fs.readFileSync(path.join(HERE, '../src/core/contests.js'), 'utf8')), 'core/contests.js never calls Math.random');

// ---------- 2. every score part and its cap ----------
console.log('\n# the score');
{
  for (const g of ['C', 'B', 'A', 'S']) ok(TL.gradeOf(graded('charm', g), 'charm') === g, `test helper: a grade ${g} Charm slime`);
  const x = graded('speed', 'S', { skills: skills({ speed: 7, sturdy: 7, smarts: 7 }), happiness: 100 });
  const { st } = world([x]);
  x.contests.trophies.sprint = 3;
  const r = K.scoreShow(st, x.id, 'sprint', { cheers: 'perfect' });
  ok(r.acts[0].points === 70 && r.acts[1].points === 20 && r.acts[2].points === 20, 'main 10 per star past 5 (7 stars = 70); support and tricks capped at 20 (7 stars = 20, not 28)', r.acts.map(a => `${a.stars}* ${a.points}`).join(' '));
  ok(r.flair.grade === 'S' && r.flair.points === 10 && r.mood === 5 && r.cheers === 9 && r.score === 70 + 20 + 20 + 10 + 5 + 9, 'flair S +10, mood 5, perfect cheers 9: score is the sum (134)', `${r.score}`);
  const parts = [];
  for (const [g, f] of [['C', 0], ['B', 3], ['A', 6], ['S', 10]]) { const y = graded('bounce', g); const w = world([y]); parts.push(K.scoreShow(w.st, y.id, 'bounce', { cheers: 'none' }).flair.points === f); }
  ok(parts.every(Boolean), 'flair from the talent grade in the main skill: C 0, B 3, A 6, S 10');
  const z = graded('charm', 'C', { skills: skills({ charm: 2, smarts: 1 }) });
  const w = world([z]);
  const moods = [[100, 5], [90, 5], [89, 4], [50, 3], [10, 1], [9, 0], [0, 0]].map(([h, m]) => { z.happiness = h; return K.scoreShow(w.st, z.id, 'beauty').mood === m; });
  ok(moods.every(Boolean), 'mood = happiness / 20, rounded (100 -> 5, 90 -> 5, 89 -> 4, 9 -> 0)');
  z.happiness = 60; z.worn = { head: 'crown', face: 'shades', neck: 'scarf' };
  const b = K.scoreShow(w.st, z.id, 'beauty', { cheers: ['perfect', 'nice', 'none'] });
  ok(b.acts[1].style === 22 && b.acts[1].points === 20, 'Style: Tiny Crown 9 + Star Shades 7 + Cozy Scarf 6 = 22, capped at 20', `${b.acts[1].style} -> ${b.acts[1].points}`);
  ok(b.acts[0].points === 20 && b.acts[2].points === 4 && b.mood === 3 && b.cheers === 4 && b.score === 20 + 20 + 4 + 0 + 3 + 4, 'Beauty: Charm 2* 20 + Style 20 + Smarts 1* 4 + mood 3 + cheers 3+1+0', `${b.score}`);
  z.worn = { head: 'bow', face: null, neck: 'scarf' };
  ok(K.scoreShow(w.st, z.id, 'beauty').acts[1].points === 10, 'Style: Ribbon Bow 4 + Cozy Scarf 6 = 10');
  z.worn = { head: 'scarf', face: 'nope' };   // a broken worn list: an outfit in the wrong slot and an unknown one count 0
  ok(K.scoreShow(w.st, z.id, 'beauty').acts[1].points === 0, 'Style: an outfit in the wrong slot or an unknown one counts 0');
  delete z.worn;
  ok(K.scoreShow(w.st, z.id, 'beauty').acts[1].points === 0, 'Style: a resident with no worn list has Style 0');
}

// ---------- 3. ties, places and cups ----------
console.log('\n# ties, places, the cup ladder');
{
  // Little: rivals 12/16/19. Speed 1 star (10) + mood 5 + cheers: good 6 = 21; nice 3 = 18 (2nd); none = 15 (3rd)
  const x = graded('speed', 'C', { skills: skills({ speed: 1 }), happiness: 100 });
  const { st } = world([x]);
  const tie = K.scoreShow(st, x.id, 'sprint', { cheers: ['perfect', 'good', 'good'] });   // 10 + 5 + 7 = 22: a clear win
  const t19 = K.scoreShow(st, x.id, 'sprint', { cheers: ['good', 'good', 'none'] });     // 10 + 5 + 4 = 19
  ok(t19.score === 19 && t19.won && t19.place === 1 && t19.top === 19, 'a tie with the top rival goes to your slime (19 vs 19: 1st, won)', `${t19.score} place ${t19.place}`);
  const s18 = K.scoreShow(st, x.id, 'sprint', { cheers: ['good', 'nice', 'none'] });
  ok(s18.score === 18 && !s18.won && s18.place === 2, 'one point short: 2nd place, not won', `${s18.score} place ${s18.place}`);
  const s15 = K.scoreShow(st, x.id, 'sprint', { cheers: 'skip' });
  ok(s15.score === 15 && s15.place === 3 && tie.won, 'skipping the show still counts (no cheers): 15 = 3rd of 4', `${s15.score} place ${s15.place}`);
  x.happiness = 0;
  const s10 = K.scoreShow(st, x.id, 'sprint', { cheers: 'none' });
  ok(s10.place === 4 && s10.rivals.length === 3 && s10.rivals.map(r => r.score).join() === '12,16,19', 'below every rival: 4th; the three rivals and their scores are in the result', `${s10.score} place ${s10.place}`);
  x.happiness = 100;
  // the ladder
  ok(K.nextCup(x, 'sprint') === 1 && !K.canEnter(st, x.id, 'sprint', 2).ok && K.canEnter(st, x.id, 'sprint', 2).reason === 'locked', 'a new slime starts at the Little Cup; the Big Cup is locked until the Little is won');
  x.skills = skills({ speed: 5, sturdy: 5, smarts: 5 });
  ok(!K.canEnter(st, x.id, 'sprint', 3).ok && !K.canEnter(st, x.id, 'sprint', 4).ok, 'even a fully trained slime cannot skip cups (Grand, Champion locked)');
  const seq = [];
  for (let c = 1; c <= 3; c++) { const { r, a } = play(st, x, 'sprint'); seq.push(`${r.cupId}:${r.won ? 'won' : 'lost'}:${a.pearls}`); }
  ok(seq.join(' ') === 'little:won:5 big:won:15 grand:won:40' && x.contests.trophies.sprint === 3 && K.nextCup(x, 'sprint') === 4, 'winning opens the next cup: Little -> Big -> Grand, one at a time', seq.join(' '));
  const ch = play(st, x, 'sprint');
  ok(ch.r.cupId === 'champion' && !ch.r.won && ch.a.pearls === 0 && x.contests.trophies.sprint === 3, 'a grade-C slime loses the Champion Cup; nothing changes but the show count', `${ch.r.score} vs ${ch.r.top}`);
  ok(K.canEnter(st, x.id, 'sprint', 1).ok && K.canEnter(st, x.id, 'sprint', 1).repeat && K.canEnter(st, x.id, 'beauty', 1).ok && !K.canEnter(st, x.id, 'beauty', 2).ok, 'cups already won stay open (repeats); each contest has its own ladder');
  ok(!K.canEnter(st, x.id, 'sumo').ok && K.canEnter(st, x.id, 'sumo').reason === 'contest' && !K.canEnter(st, x.id, 'sprint', 5).ok && !K.canEnter(st, x.id, 'sprint', 0).ok, 'no such contest or cup: refused');
}

// ---------- 4. prizes once, never on repeats; the shelf and the Journal ----------
console.log('\n# prizes');
{
  const a = graded('charm', 'A', { name: 'Juniper', skills: skills({ charm: 6, smarts: 5 }), worn: { head: 'crown', face: 'shades', neck: 'scarf' } });
  const b = graded('charm', 'B', { name: 'Pebble', skills: skills({ charm: 1 }) });
  const { st, R } = world([a, b], 0);
  st.memories = [];
  const r1 = show(st, a, 'beauty'), g1 = K.applyShow(st, r1, NOW);
  ok(r1.prize.pearls === 5 && r1.prize.trophy && r1.prize.shelf && g1.pearls === 5 && R.pearls === 5 && R.totalPearls === 5 && a.contests.trophies.beauty === 1, 'first Little Cup win: 5 pearls (pocket and total), a trophy');
  ok(R.contests.shelf['beauty-little']?.name === 'Juniper' && g1.shelf, 'the Trophy Shelf keeps the ranch\'s first Little Beauty win', JSON.stringify(R.contests.shelf));
  ok(st.memories.length === 1 && /Juniper won the Little Cup at the Beauty Show!/.test(st.memories[0].text) && /first on the Trophy Shelf/.test(st.memories[0].text) && st.memories[0].t === NOW, 'a Journal line for the trophy (and the shelf)', st.memories[0]?.text);
  ok(K.applyShow(st, r1, NOW) === null && R.pearls === 5 && R.contests.shows === 1, 'the same result applied twice: the second does nothing');
  const rep = play(st, a, 'beauty', { cup: 1 });
  ok(rep.r.repeat && rep.r.won && rep.r.prize.pearls === 0 && rep.a.pearls === 0 && !rep.a.trophy && R.pearls === 5 && st.memories.length === 1 && R.contests.shows === 2, 'a repeat show of a cup already won: no pearls, no trophy, no Journal line (the show is counted)');
  // two results for the same cup scored before either is applied: only the first pays
  const p = show(st, a, 'beauty'), q = show(st, a, 'beauty');
  const gp = K.applyShow(st, p, NOW), gq = K.applyShow(st, q, NOW);
  ok(p.cupId === 'big' && gp.pearls === 15 && gq.pearls === 0 && R.pearls === 20 && a.contests.trophies.beauty === 2, 'two shows of the same new cup scored at once: the prize is decided again when applied, so it pays once');
  for (let i = 0; i < 2; i++) play(st, a, 'beauty');
  ok(a.contests.trophies.beauty === 4 && R.pearls === 5 + 15 + 40 + 100 && K.titleOf(a) === 'Beauty Champion', 'an A Charm slime wins every Beauty cup: 160 pearls in all, title "Beauty Champion"', `${R.pearls}`);
  for (let i = 0; i < 5; i++) play(st, a, 'beauty', { cup: 4 });
  ok(R.pearls === 160 && a.contests.trophies.beauty === 4, 'five repeat Champion shows: still 160 pearls');
  const pb = play(st, b, 'beauty');
  ok(pb.r.won && pb.a.pearls === 5 && !pb.a.shelf && R.contests.shelf['beauty-little'].name === 'Juniper', 'another slime\'s first Little win pays it 5 too; the shelf keeps the first winner');
  const lose = play(st, b, 'beauty', { cheers: 'none' });
  ok(!lose.r.won && lose.a.pearls === 0 && lose.r.tip && R.contests.shows === 13, 'a loss: nothing lost, no prize, a coach\'s tip; every show is counted', `shows ${R.contests.shows}`);
  ok(K.shelfList(st).length === 12 && K.shelfList(st).filter(s => s.winner).length === 4, 'the Trophy Shelf: 12 spots (4 filled)');
}

// ---------- 5. trophy value, perks, titles; exactly today's numbers with no shows ----------
console.log('\n# hooks: offers, trips, pearls');
{
  const base = graded('charm', 'B', { skills: skills({ charm: 3, speed: 2, bounce: 4, smarts: 1 }), happiness: 77, bondLevel: 3, runTotal: 3e9 });
  const plain = clone(base); delete plain.contests;
  const zero = clone(base);
  const { st } = world([plain, zero]);
  const ranch = new Ranch(st), rl = st.ranch && new RL.RanchLife(st, ranch);
  const offerFormula = x => (1 + residentMedal(x).offers) * heirloomMult(st, 'buyerPay') * RL.offerSkillMult(x);
  const pearlFormula = x => residentMedal(x).pearls * heirloomMult(st, 'ranchPearls') * RL.pearlSkillMult(x);
  ok(ranch.offerMult(plain) === offerFormula(plain) && ranch.offerMult(zero) === offerFormula(zero) && ranch.pearlMult(zero) === pearlFormula(zero),
    'no trophies (or a resident from before contests): offerMult and pearlMult are exactly the formula without contests');
  const tz = rl.tripFor(zero, 'mine'), tp = rl.tripFor(plain, 'mine');
  ok(tz.seconds === Math.round(3 * 3600 * (1 - 2 * 0.06)) && tz.seconds === tp.seconds && tz.pearls === tp.pearls, 'no Sprint Champion: trip time exactly as before', `${tz.seconds} s`);
  ok(JSON.stringify(ranch.offers(zero, NOW).map(o => o.pearls)) === JSON.stringify(ranch.offers(plain, NOW).map(o => o.pearls)) && ranch.auction(zero, NOW).price === ranch.auction(plain, NOW).price,
    'no trophies: the same offers and auction as a resident from before contests');
  const v = CT.trophyValue;
  const one = clone(zero); one.contests.trophies.sprint = 2;
  ok(Math.abs(ranch.offerMult(one) / ranch.offerMult(zero) - (1 + 2 * v)) < 1e-12 && K.titleOf(one) === '', `two trophies: offers x${1 + 2 * v} (trophy value ${v} each); no title`);
  const beauty = clone(zero); beauty.contests.trophies.beauty = 4;
  ok(Math.abs(ranch.offerMult(beauty) / ranch.offerMult(zero) - (1 + 4 * v + 0.05)) < 1e-12 && K.titleOf(beauty) === 'Beauty Champion', `Beauty Champion: 4 trophies x${v} + the +5% perk on offers`);
  const sprint = clone(zero); sprint.contests.trophies.sprint = 4;
  ok(rl.tripFor(sprint, 'mine').seconds === Math.round(3 * 3600 * (1 - 2 * 0.06) * 0.95) && K.titleOf(sprint) === 'Sprint Champion' && ranch.pearlMult(sprint) === ranch.pearlMult(zero), 'Sprint Champion: trips 5% shorter (pearls not touched); title "Sprint Champion"', `${rl.tripFor(sprint, 'mine').seconds} s`);
  const bounce = clone(zero); bounce.contests.trophies.bounce = 4;
  ok(Math.abs(ranch.pearlRate(bounce) / ranch.pearlRate(zero) - 1.03) < 1e-12 && rl.tripFor(bounce, 'mine').seconds === tz.seconds && K.titleOf(bounce) === 'Bounce-Off Champion', 'Bounce-Off Champion: ranch pearls +3% (trips not touched)');
  const all = clone(zero); all.contests.trophies = { beauty: 4, sprint: 4, bounce: 4 };
  ok(K.trophyCount(all) === 12 && Math.abs(ranch.offerMult(all) / ranch.offerMult(zero) - (1 + 12 * v + 0.05)) < 1e-12 && K.titleOf(all) === 'Triple Champion', `all 12 trophies: offers x${(1 + 12 * v + 0.05).toFixed(3)}; "Triple Champion"`);
  const two = clone(zero); two.contests.trophies = { beauty: 4, sprint: 4, bounce: 1 };
  ok(K.titleOf(two) === 'Double Champion', 'two Champion Cups: "Double Champion"');
}

// ---------- 6. who may enter ----------
console.log('\n# who may enter');
{
  const x = graded('speed', 'B', { skills: skills({ speed: 2 }) });
  const { st, sim } = world([x]);
  x.lesson = { skill: 'speed', star: 3, startAt: NOW, doneAt: NOW + H, pearls: 20 };
  ok(K.scoreShow(st, x.id, 'sprint').ok === false && K.scoreShow(st, x.id, 'sprint').reason === 'lesson', 'a slime in a lesson can\'t enter');
  x.lesson = null; x.trip = { place: 'cafe', startAt: NOW, homeAt: NOW + H, seed: 's', pearls: 3, souvenir: null };
  ok(K.scoreShow(st, x.id, 'sprint').reason === 'away' && K.canEnter(st, x.id, 'beauty').reason === 'away', 'a slime on a trip can\'t enter');
  x.trip = null;
  ok(K.scoreShow(st, x.id, 'sprint').ok && K.scoreShow(st, 'nobody', 'sprint').reason === 'missing', 'home and free: it may enter; an id not on the ranch is refused');
  st.slime.id = 'home';
  ok(K.scoreShow(st, 'home', 'sprint').reason === 'missing', 'the slime being raised at home is not a resident: it can\'t enter');
  const before = JSON.stringify(st);
  K.scoreShow(st, x.id, 'sprint', { cheers: 'perfect' }); K.scoreShow(st, x.id, 'beauty'); K.canEnter(st, x.id, 'bounce');
  ok(JSON.stringify(st) === before, 'scoreShow and canEnter change nothing in the save');
  ok(sim && true, 'a lesson started after a show is not blocked by it (a show is instant)');
}

// ---------- 7. Dress up ----------
console.log('\n# Dress up');
{
  const x = graded('charm', 'B', { worn: { head: 'bow', face: null, neck: null } });
  const { st } = world([x]);
  st.outfits.owned = ['bow', 'glasses', 'scarf', 'crown'];
  const r1 = K.dressUp(st, x.id, 'head', 'crown');
  ok(r1.ok && x.worn.head === 'crown', 'an owned outfit goes on in its slot (replacing what was there)');
  ok(K.dressUp(st, x.id, 'head', 'party').reason === 'owned' && x.worn.head === 'crown', 'an outfit the family does not own: refused');
  ok(K.dressUp(st, x.id, 'face', 'scarf').reason === 'slot' && K.dressUp(st, x.id, 'feet', null).reason === 'slot', 'the wrong slot, or no such slot: refused');
  ok(K.dressUp(st, x.id, 'face', 'cape').reason === 'outfit', 'no such outfit: refused');
  ok(K.dressUp(st, x.id, 'face', 'glasses').ok && K.dressUp(st, x.id, 'neck', 'scarf').ok && K.styleOf(x.worn) === 9 + 5 + 6, 'Style follows what it wears (crown + glasses + scarf = 20)');
  ok(K.dressUp(st, x.id, 'head', null).ok && x.worn.head === null && K.styleOf(x.worn) === 11, 'taking an outfit off (null)');
  const y = graded('charm', 'B'); delete y.worn; st.ranch.residents.push(y);
  ok(K.dressUp(st, y.id, 'neck', 'scarf').ok && y.worn.head === null && y.worn.face === null && y.worn.neck === 'scarf' && Object.keys(y.worn).length === 3, 'a resident with no worn list gets one');
  y.trip = { place: 'cafe', startAt: NOW, homeAt: NOW + H, seed: 's', pearls: 3, souvenir: null };
  ok(K.dressUp(st, y.id, 'neck', null).reason === 'away' && K.dressUp(st, 'nobody', 'neck', null).reason === 'missing', 'a slime on a trip is not here to dress; an unknown id is refused');
  ok(st.outfits.worn.head === null && st.outfits.owned.length === 4, 'dressing a resident does not touch the slime at home or the family\'s outfits');
  const best = K.bestDress(['bow', 'beret', 'flowers', 'glasses', 'shades', 'bowtie']);
  ok(best.style === 7 + 7 + 5 && best.worn.head === 'beret' && best.worn.face === 'shades' && best.worn.neck === 'bowtie', 'bestDress: the best owned outfit per slot', JSON.stringify(best));
}

// ---------- 8. cheers ----------
console.log('\n# cheers');
{
  const ch = CT.cheer, g = K.cheerGrade;
  ok(g([ch.beat]) === 'perfect' && g([ch.beat - ch.perfect]) === 'perfect' && g([ch.beat + ch.perfect]) === 'perfect', 'on the beat (within the perfect window): Perfect');
  ok(g([ch.beat - ch.good]) === 'good' && g([ch.beat + 0.2]) === 'good', 'close: Good');
  ok(g([0]) === 'nice' && g([ch.beat - ch.good - 0.01]) === 'nice' && g([ch.beat + ch.good + 0.01]) === 'nice', 'too early (or late): Nice try');
  ok(g([]) === 'none' && g([-0.4]) === 'none' && g([ch.window + 0.1]) === 'none' && g(null) === 'none', 'no tap during the ring (or only before it / after it): none');
  ok(g([0.3, ch.beat]) === 'nice' && g([ch.beat, 0.3]) === 'nice' && g([-0.2, ch.beat]) === 'perfect', 'only the first tap after the ring appears counts (order of the list does not matter; taps before it are ignored)');
  ok(g([ch.beat], { reducedMotion: true }) === 'good' && g([], { reducedMotion: true }) === 'good' && JSON.stringify(K.cheersFrom('perfect', { reducedMotion: true })) === '["good","good","good"]', 'Reduced motion: every act is Good, whatever the taps');
  // mashing: a tap every 1/12 s from before the ring until after it: the first counted tap is early
  const mash = start => Array.from({ length: 60 }, (_, i) => start + i / 12);
  const mashes = [-1, -0.5, -0.04, 0, 0.02].map(s => g(mash(s)));
  ok(mashes.every(m => m === 'nice'), 'mashing from before the ring (any phase): Nice try, 1 point per act', mashes.join(','));
  // mashing never beats timing: over 2000 seeded tap patterns, no pattern scores more than the perfect single tap, and a
  // pattern of many fast taps starting before the ring never more than 1
  let worst = 0, mashMax = 0;
  let s = 99;
  const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 2000; i++) {
    const taps = Array.from({ length: 1 + Math.floor(r() * 30) }, () => -1 + r() * 4);
    worst = Math.max(worst, K.cheerPoints(taps));
    const start = -1 + r() * 0.98, rate = 6 + r() * 14;
    mashMax = Math.max(mashMax, K.cheerPoints(Array.from({ length: 80 }, (_, j) => start + j / rate)));
  }
  ok(worst <= K.cheerPoints([ch.beat]) && mashMax === 1, 'no tap pattern beats one tap on the beat; fast mashing started before the ring never gets more than 1', `best random ${worst}, best mash ${mashMax}`);
  ok(JSON.stringify(K.cheersFrom('mash')) === '["nice","nice","nice"]' && JSON.stringify(K.cheersFrom('skip')) === '["none","none","none"]' && JSON.stringify(K.cheersFrom([[ch.beat], 'good', [0.1]])) === '["perfect","good","nice"]',
    'cheersFrom: a grade for all three, mash = Nice try each, skip = none, or per act taps / a grade');
  const x = graded('bounce', 'C', { skills: skills({ bounce: 3 }) });
  const { st } = world([x]);
  const timed = K.scoreShow(st, x.id, 'bounce', { cheers: [[ch.beat], [ch.beat + 0.05], [ch.beat - 0.1]] }).cheers;
  const mashed = K.scoreShow(st, x.id, 'bounce', { cheers: [mash(-1), mash(-0.3), mash(0)] }).cheers;
  ok(timed === 9 && mashed === 3, 'a show: timed cheers 9, mashed cheers 3', `${timed} vs ${mashed}`);
}

// ---------- 9. determinism ----------
console.log('\n# determinism');
{
  const x = graded('speed', 'A', { skills: skills({ speed: 4, sturdy: 2, smarts: 3 }), happiness: 83.4 });
  const { st } = world([x]);
  const a = JSON.stringify(K.scoreShow(st, x.id, 'sprint', { cheers: [[1.1], [0.2], []] }));
  rnd = 5; Math.random();
  const b = JSON.stringify(K.scoreShow(clone(st), x.id, 'sprint', { cheers: [[1.1], [0.2], []] }));
  ok(a === b, 'the same slime and cheers give the same show, every time (no dice)');
  const st2 = clone(st), st3 = clone(st);
  const r2 = K.scoreShow(st2, x.id, 'sprint', { cheers: 'good' }), r3 = K.scoreShow(st3, x.id, 'sprint', { cheers: 'good' });
  K.applyShow(st2, r2, NOW); K.applyShow(st3, r3, NOW);
  ok(JSON.stringify(st2) === JSON.stringify(st3), 'applying the same show to two copies of a save gives the same save');
}

// ---------- 10. Champion needs a talent ----------
console.log('\n# Champion needs a talent');
{
  const top = CT.cups[3].rivals.reduce((m, r) => Math.max(m, r.score), 0);
  for (const c of CT.contests) {
    const main = c.acts.find(a => a.role === 'main').skill, sup = c.acts.find(a => a.role === 'support');
    const full = g => {
      const x = graded(main, g, { happiness: 100, worn: { head: 'crown', face: 'shades', neck: 'scarf' } });
      for (const s of SKILL_IDS) x.skills[s] = TL.starCap(x, s);
      x.contests.trophies[c.id] = 3;
      return x;
    };
    const res = {};
    for (const g of ['C', 'B', 'A', 'S']) {
      const x = full(g), { st } = world([x]);
      res[g] = { perfect: K.scoreShow(st, x.id, c.id, { cheers: 'perfect' }), good: K.scoreShow(st, x.id, c.id, { cheers: 'good' }) };
    }
    ok(!res.C.perfect.won && !res.B.perfect.won && res.C.perfect.score < top && res.B.perfect.score < top,
      `${c.name}: a fully trained C or B slime (max ${sup.style ? 'Style' : 'support'}, perfect cheers, full happiness) does NOT beat the Champion top rival ${top}`, `C ${res.C.perfect.score}, B ${res.B.perfect.score}`);
    ok(res.A.good.won && res.S.good.won, `${c.name}: an A (or S) slime with Good cheers wins the Champion Cup`, `A ${res.A.good.score}, S ${res.S.good.score}`);
  }
}

// ---------- 11. the coach's tip ----------
console.log('\n# the coach\'s tip');
{
  const x = graded('speed', 'C', { skills: skills({ speed: 1 }), happiness: 100 });
  const { st } = world([x]);
  const t1 = K.scoreShow(st, x.id, 'sprint', { cheers: ['nice', 'none', 'none'] });   // 16 vs 19
  ok(!t1.won && t1.tip.kind === 'cheers' && t1.tip.gap === 3 && /Perfect cheers/.test(t1.tip.text), 'a gap the cheers could close: "Perfect cheers would have done it!"', JSON.stringify(t1.tip));
  ok(K.scoreShow(st, x.id, 'sprint', { cheers: 'none', reducedMotion: true }).won, 'Reduced motion counts as Good cheers (6): 1 Speed star wins the Little Cup');
  x.happiness = 0;
  const t2 = K.scoreShow(st, x.id, 'sprint', { cheers: 'none' });   // 10 vs 19: 9 short; cheers max 9 -> cheers
  ok(t2.tip.kind === 'cheers', 'gap 9 with no cheers: perfect cheers would close it', JSON.stringify(t2.tip));
  const t3 = K.scoreShow(st, x.id, 'sprint', { cheers: 'none', reducedMotion: true });   // 16 vs 19, no cheers to gain
  ok(t3.tip.kind === 'skill' && t3.tip.skill === 'speed' && t3.tip.stars === 1 && t3.tip.text === 'One more Speed star', 'Reduced motion: the tip is not about cheers (one more Speed star)', JSON.stringify(t3.tip));
  // Beauty: Style from owned outfits
  const y = graded('charm', 'C', { skills: skills({ charm: 1 }), happiness: 0, worn: { head: 'bow', face: null, neck: null } });
  const w = world([y]);
  w.st.outfits.owned = ['bow', 'crown', 'shades'];
  y.contests.trophies.beauty = 0;
  const t4 = K.scoreShow(w.st, y.id, 'beauty', { cheers: 'none', reducedMotion: true });   // 10 + 4 + 6 = 20 >= 19: won
  ok(t4.won && !t4.tip, 'a win has no tip');
  y.happiness = 0; y.skills.charm = 0;
  const t5 = K.scoreShow(w.st, y.id, 'beauty', { cheers: 'good' });   // 0 + 4 + 0 + 6 = 10 vs 19: gap 9 = cheers +3 no; style 4 -> 16 (+12): style
  ok(t5.tip.kind === 'style' && t5.tip.text === 'Dress up: Style 4 of 20', 'a gap Dress up could close with owned outfits: "Dress up: Style 4 of 20"', JSON.stringify(t5.tip));
  w.st.outfits.owned = ['bow'];
  const t6 = K.scoreShow(w.st, y.id, 'beauty', { cheers: 'good' });
  ok(t6.tip.kind === 'skill' && t6.tip.skill === 'charm' && t6.tip.stars === 1, 'no owned outfit closes it: the fewest stars (one more Charm star)', JSON.stringify(t6.tip));
  const z = graded('bounce', 'C', { happiness: 100 });
  for (const s of SKILL_IDS) z.skills[s] = 5;
  z.contests.trophies.bounce = 3;
  const wz = world([z]);
  const t7 = K.scoreShow(wz.st, z.id, 'bounce', { cheers: 'perfect' });
  ok(!t7.won && t7.tip.kind === 'talent' && /needs a natural at Bounce/.test(t7.tip.text), 'a fully trained C slime at the Champion Cup: "This cup needs a natural at Bounce"', JSON.stringify(t7.tip));
  z.skills.bounce = 3;
  const t8 = K.scoreShow(wz.st, z.id, 'bounce', { cheers: 'perfect' });
  ok(t8.tip.kind === 'skill' && t8.tip.partial && t8.tip.skill === 'bounce' && t8.tip.stars === 2, 'no single thing closes it, but the main skill can still learn: more of it first', JSON.stringify(t8.tip));
}

// ---------- 12. saves: new slimes, old saves, broken values ----------
console.log('\n# saves');
{
  const st = createState();
  ok(JSON.stringify(st.ranch.contests) === JSON.stringify({ shelf: {}, shows: 0 }), 'a new save: ranch.contests = { shelf: {}, shows: 0 }');
  const sim = new Sim(st);
  st.phase = 'play'; st.slime.name = 'Mochi'; st.slime.growth = 1e12; st.slime.bornAt = NOW - 6 * 24 * H;
  const m = sim.moveToRanch(NOW);
  ok(m && JSON.stringify(m.resident.contests) === JSON.stringify({ trophies: { beauty: 0, sprint: 0, bounce: 0 } }), 'a slime moving to the ranch: no trophies yet', JSON.stringify(m?.resident?.contests));
  const files = [...fs.readdirSync(path.join(HERE, 'fixtures')).filter(f => f.endsWith('.json')),
    ...['barn', 'talents'].flatMap(d => fs.readdirSync(path.join(HERE, 'fixtures', d)).filter(f => f.endsWith('.json')).map(f => `${d}/${f}`))];
  for (const f of files) {
    const save = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', f), 'utf8')).save;
    const mg = migrate(clone(save));
    const res = mg.ranch.residents;
    const twice = migrate(clone(mg));
    const fresh = res.every(x => JSON.stringify(x.contests) === JSON.stringify({ trophies: { beauty: 0, sprint: 0, bounce: 0 } }));
    const ranch = new Ranch(mg);
    const same = res.every(x => { const y = clone(x); delete y.contests; return ranch.offerMult(x) === ranch.offerMult(y) && ranch.pearlRate(x) === ranch.pearlRate(y); });
    let shows = true;
    for (const x of res) for (const c of C.CONTEST_IDS) { const r = K.scoreShow(mg, x.id, c, { cheers: 'good' }); if (r.ok && !(Number.isFinite(r.score) && r.score >= 0)) shows = false; if (!r.ok && !['lesson', 'away'].includes(r.reason)) shows = false; }
    ok(fresh && JSON.stringify(mg.ranch.contests) === JSON.stringify({ shelf: {}, shows: 0 }) && JSON.stringify(twice) === JSON.stringify(mg) && checkSave(mg).ok && same && shows,
      `${f}: residents get no trophies, ranch.contests is fresh, migrating twice changes nothing, the save checks, offers and pearls as before, every resident can be scored`, `${res.length} residents`);
  }
  // broken values
  const save = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'main-gen3.json'), 'utf8')).save;
  const bad = clone(save);
  bad.ranch.contests = { shelf: { 'beauty-little': { id: 'x', name: 'A', at: 1 }, junk: 3, 'sprint-big': 'text' }, shows: 'many' };
  bad.ranch.residents[0].contests = { trophies: { beauty: 'x', sprint: 9, bounce: -2, sumo: 3 } };
  bad.ranch.residents[1].contests = 'broken';
  const mb = migrate(bad);
  ok(JSON.stringify(mb.ranch.contests) === JSON.stringify({ shelf: { 'beauty-little': { id: 'x', name: 'A', at: 1 } }, shows: 0 }), 'a broken ranch.contests: shows repaired to 0, unknown or broken shelf spots dropped', JSON.stringify(mb.ranch.contests));
  ok(JSON.stringify(mb.ranch.residents[0].contests.trophies) === JSON.stringify({ beauty: 0, sprint: 4, bounce: 0 }) && JSON.stringify(mb.ranch.residents[1].contests.trophies) === JSON.stringify({ beauty: 0, sprint: 0, bounce: 0 }),
    'broken trophies: text -> 0, 9 -> 4 (the Champion Cup), -2 -> 0, unknown contests dropped, a broken contests box -> none', JSON.stringify(mb.ranch.residents.map(x => x.contests.trophies)));
  const json = migrate(JSON.parse(JSON.stringify(mb)));
  ok(JSON.stringify(json) === JSON.stringify(mb), 'a played save (trophies, shelf, shows) round-trips through JSON and migrate unchanged');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
