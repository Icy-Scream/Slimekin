// Outfits rules check (plain node, no browser): wearing at home (Sim.wear, the Outfits page) and Dress up on the ranch
// (dressUp) for every slot and every pair of outfits in it, in both orders: the new one goes on, the old one comes off,
// the other slots stay as they were, the same one again takes it off, and a save keeps it (JSON and migrate). An outfit a
// slime wears that the family does not own (the :8822 test ranch's Mochi in her Artist Beret, tools/fixtures/talents/
// ranch-trained.json): it can come off, and it never goes back on until the family owns it. `worn` values a save can't
// use (an unknown outfit, one in another slot's place, text, a missing box, a stray key) are cleaned on load, and every
// old save (tools/fixtures/, barn/, talents/) keeps every outfit it wears. Dress up's rows (Sim.outfitChoice: Wearing,
// Wear, Buy & wear, Needs N jelly) and its Buy & wear (Sim.buyAndDress: the Outfits page's price, nothing spent when it
// can't go on).
//   node tools/outfit-test.mjs
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
let rnd = 4242; Math.random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);

const { OUTFITS, OUTFIT_BY_ID } = await import(SRC + '/data/content.js');
const K = await import(SRC + '/core/contests.js');
const { Sim, createState, migrate } = await import(SRC + '/core/sim.js');
const { checkSave } = await import(SRC + '/core/save-check.js');

let fails = 0, passes = 0;
const ok = (cond, what, extra = '') => { if (cond) { passes++; console.log('ok   - ' + what + (extra ? ' | ' + extra : '')); } else { fails++; console.log('FAIL - ' + what + (extra ? ' | ' + extra : '')); } };
const clone = o => JSON.parse(JSON.stringify(o));
const ALL = OUTFITS.map(o => o.id);
const SLOTS = [...new Set(OUTFITS.map(o => o.slot))];
const inSlot = s => OUTFITS.filter(o => o.slot === s).map(o => o.id);
const none = () => Object.fromEntries(SLOTS.map(s => [s, null]));
// the same outfits in the same slots (the key order a save happens to have does not matter)
const same = (a, b) => SLOTS.every(s => (a?.[s] ?? null) === (b?.[s] ?? null));
const show = w => SLOTS.map(s => `${s} ${w?.[s] ?? '-'}`).join(', ');
// a valid `worn`: an object with exactly the slots, each null or an outfit of that slot
const valid = w => !!w && typeof w === 'object' && !Array.isArray(w) && Object.keys(w).length === SLOTS.length
  && SLOTS.every(s => s in w && (w[s] === null || OUTFIT_BY_ID[w[s]]?.slot === s));
const load = st => migrate(clone(st));   // what the next visit loads

function home({ owned = ALL } = {}) {
  const st = createState();
  st.phase = 'play'; st.slime.name = 'Clover'; st.outfits.owned = [...owned];
  return { st, sim: new Sim(st) };
}
const resident = (id, o = {}) => ({ id, name: id, form: { id: 'prism' }, traits: { prism: 100 }, skills: {}, lesson: null, trip: null,
  worn: none(), contests: K.createResidentContests(), happiness: 60, ...o });
function ranch(list, { owned = ALL } = {}) {
  const { st, sim } = home({ owned });
  st.ranch.residents = list; st.ranch.slots = 10;
  return { st, sim };
}

// ---------- 1. at home: every slot, every pair, both orders ----------
console.log('\n# at home (Sim.wear, the Outfits page): every pair in every slot');
{
  let n = 0, bad = [];
  for (const slot of SLOTS) for (const a of inSlot(slot)) for (const b of inSlot(slot)) {
    if (a === b) continue;
    const { st, sim } = home();
    // the other slots wear something, so a change in this slot must leave them alone
    const others = Object.fromEntries(SLOTS.filter(s => s !== slot).map(s => [s, inSlot(s)[0]]));
    for (const id of Object.values(others)) sim.wear(id);
    const ra = sim.wear(a), rb = sim.wear(b);
    const want = { ...none(), ...others, [slot]: b };
    const now = clone(st.outfits.worn), after = load(st);
    const off = sim.wear(b);
    n++;
    if (!(ra?.on && rb?.on && same(now, want) && same(after.outfits.worn, want) && off && !off.on && same(st.outfits.worn, { ...want, [slot]: null })))
      bad.push(`${slot}: ${a} -> ${b} gives ${show(now)}`);
  }
  ok(!bad.length, `${n} pairs: the new outfit on, the old one off, the other slots untouched; a save keeps it; the same one again takes it off`, bad.slice(0, 4).join('; '));
  const { st, sim } = home({ owned: ['bow'] });
  ok(sim.wear('crown') === null && same(st.outfits.worn, none()), 'an outfit the family does not own can\'t be put on');
}

// ---------- 2. on the ranch: Dress up, every slot, every pair, both orders ----------
console.log('\n# on the ranch (dressUp, the Dress up card): every pair in every slot');
{
  let n = 0, bad = [];
  for (const slot of SLOTS) for (const a of inSlot(slot)) for (const b of inSlot(slot)) {
    if (a === b) continue;
    const others = Object.fromEntries(SLOTS.filter(s => s !== slot).map(s => [s, inSlot(s).at(-1)]));
    const { st } = ranch([resident('r1', { worn: { ...none(), ...others } }), resident('r2')]);
    const x = st.ranch.residents[0];
    const ra = K.dressUp(st, 'r1', slot, a), rb = K.dressUp(st, 'r1', slot, b);
    const want = { ...none(), ...others, [slot]: b };
    const now = clone(x.worn), after = load(st).ranch.residents[0];
    const off = K.dressUp(st, 'r1', slot, null);
    n++;
    if (!(ra.ok && rb.ok && same(now, want) && same(rb.worn, want) && same(after.worn, want) && off.ok && same(x.worn, { ...want, [slot]: null }) && same(st.ranch.residents[1].worn, none())))
      bad.push(`${slot}: ${a} -> ${b} gives ${show(now)}`);
  }
  ok(!bad.length, `${n} pairs: the new outfit on, the old one off, the other slots and the other slimes untouched; a save keeps it; taking it off empties the slot`, bad.slice(0, 4).join('; '));
  const { st } = ranch([resident('r1')], { owned: ['bow'] });
  ok(K.dressUp(st, 'r1', 'head', 'crown').reason === 'owned' && K.dressUp(st, 'r1', 'face', 'bow').reason === 'slot' && same(st.ranch.residents[0].worn, none()),
    'Dress up: only an outfit the family owns, and only in its own slot');
}

// ---------- 3. an outfit it wears that the family does not own (the :8822 test ranch) ----------
console.log('\n# an outfit a slime wears that the family does not own');
{
  const save = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'talents', 'ranch-trained.json'), 'utf8')).save;
  save.outfits.owned = ['bow', 'bowtie', 'flowers', 'glasses', 'scarf'];   // as the test copy's "Load the test ranch"
  const st = load(save), sim = new Sim(st);
  const mochi = st.ranch.residents.find(x => x.name === 'Mochi');
  ok(mochi.worn.head === 'beret' && !st.outfits.owned.includes('beret'), 'the test ranch: Mochi wears the Artist Beret, and the family does not own one', show(mochi.worn));
  const crown = K.dressUp(st, mochi.id, 'head', 'crown');
  ok(crown.reason === 'owned' && mochi.worn.head === 'beret', 'the Tiny Crown (not owned) can\'t go on: she keeps the beret (the card has to say so)');
  const flowers = K.dressUp(st, mochi.id, 'head', 'flowers');
  ok(flowers.ok && mochi.worn.head === 'flowers' && same(load(st).ranch.residents.find(x => x.name === 'Mochi').worn, mochi.worn), 'an outfit the family owns replaces it, and the save keeps that', show(mochi.worn));
  ok(K.dressUp(st, mochi.id, 'head', 'beret').reason === 'owned' && mochi.worn.head === 'flowers', 'the beret does not go back on once it is off (the family does not own one)');
  st.outfits.owned.push('crown');
  ok(K.dressUp(st, mochi.id, 'head', 'crown').ok && mochi.worn.head === 'crown', 'once the family owns the Tiny Crown it goes on');
  // the same at home: the slime wears something the family does not own (only a hand-made save can do that)
  st.outfits.worn.head = 'party';
  const off = sim.wear('party');
  ok(!!off && off.on === false && st.outfits.worn.head === null, 'at home: an outfit it wears that the family does not own can be taken off (the Outfits page shows it as worn)', JSON.stringify(off && { on: off.on }));
  ok(sim.wear('party') === null && st.outfits.worn.head === null, '...and does not go back on');
  const st2 = load(save), m2 = st2.ranch.residents.find(x => x.name === 'Mochi');
  const unk = K.dressUp(st2, m2.id, 'head', null);
  ok(unk.ok && m2.worn.head === null && same(load(st2).ranch.residents.find(x => x.name === 'Mochi').worn, none()), 'Dress up: the beret the family does not own can be taken off, and the save keeps that');
}

// ---------- 4. worn values a save can't use, cleaned on load ----------
console.log('\n# broken worn values');
{
  const { st } = ranch([
    resident('r1', { worn: { head: 'scarf', face: 'nope', neck: 'bowtie', hat: 'bow' } }),
    resident('r2', { worn: 'party hat' }),
    resident('r3', { worn: { head: 7, face: { id: 'glasses' } } }),
    resident('r4', { worn: undefined }),
    resident('r5', { worn: { head: '__proto__', face: 'constructor', neck: 'toString' } }),
  ]);
  st.outfits.worn = { head: 'glasses', face: 'shades', neck: 'scarf', cape: 'crown' };
  const m = load(st), R = m.ranch.residents;
  ok(valid(m.outfits.worn) && same(m.outfits.worn, { head: null, face: 'shades', neck: 'scarf' }), 'at home: an outfit in another slot\'s place is taken off, a stray key goes, the rest stays', JSON.stringify(m.outfits.worn));
  ok(valid(R[0].worn) && same(R[0].worn, { head: null, face: null, neck: 'bowtie' }), 'a resident: an outfit in another slot\'s place and an unknown one are taken off, a stray key goes', JSON.stringify(R[0].worn));
  ok(R.slice(1).every(x => valid(x.worn) && same(x.worn, none())), 'text, numbers, objects, nothing, or names that are not outfits: nothing worn', R.slice(1).map(x => JSON.stringify(x.worn)).join(' '));
  ok(JSON.stringify(load(m)) === JSON.stringify(m) && checkSave(m).ok, 'loading the cleaned save again changes nothing; it is a good save');
  st.outfits = 'broken';
  const m2 = load(st);
  ok(valid(m2.outfits.worn) && Array.isArray(m2.outfits.owned), 'a broken outfits box: nothing worn, nothing owned', JSON.stringify(m2.outfits));
}

// ---------- 5. every old save ----------
console.log('\n# old saves');
{
  const files = [...fs.readdirSync(path.join(HERE, 'fixtures')).filter(f => f.endsWith('.json')),
    ...['barn', 'talents'].flatMap(d => fs.readdirSync(path.join(HERE, 'fixtures', d)).filter(f => f.endsWith('.json')).map(f => `${d}/${f}`))];
  for (const f of files) {
    const save = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', f), 'utf8')).save;
    const m = load(save), was = save.ranch?.residents || [];
    const kept = (a, b) => SLOTS.every(s => (b?.[s] ?? null) === null || a[s] === b[s]);
    const homeOk = valid(m.outfits.worn) && kept(m.outfits.worn, save.outfits?.worn);
    const resOk = m.ranch.residents.every((x, i) => valid(x.worn) && kept(x.worn, was[i]?.worn));
    const style = m.ranch.residents.every((x, i) => K.styleOf(x.worn) === K.styleOf(was[i]?.worn));
    ok(homeOk && resOk && style && JSON.stringify(load(m)) === JSON.stringify(m), `${f}: every outfit worn at home and on the ranch is kept, each slot holds its own kind, Style is unchanged`,
      `home ${show(m.outfits.worn)}; ${m.ranch.residents.filter(x => SLOTS.some(s => x.worn[s])).map(x => `${x.name}: ${SLOTS.map(s => x.worn[s]).filter(Boolean).join('+')}`).join(', ') || 'no resident wears anything'}`);
  }
}

// ---------- 6. Dress up's rows: Wearing, Wear, Buy & wear, Needs N jelly (the captain, 11 Nov) ----------
// "Dress up, menu I should be able to wear items from my outfits and select wear too": every outfit is choosable from
// the card. One rule names a row for both pages (Sim.outfitChoice); Buy & wear (Sim.buyAndDress) buys with the Outfits
// page's rule and price (Sim.buyOutfit) and puts it on the resident; nothing is spent when it can't go on.
console.log('\n# Dress up: Buy & wear, and the rows\' labels');
{
  const save = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'talents', 'ranch-trained.json'), 'utf8')).save;
  save.outfits.owned = ['bow', 'bowtie', 'flowers', 'glasses', 'scarf'];   // as the test copy's "Load the test ranch"
  const fresh = () => { const st = load(save), sim = new Sim(st); return { st, sim, mochi: st.ranch.residents.find(x => x.name === 'Mochi') }; };
  const crown = OUTFIT_BY_ID.crown;
  {
    const { st, sim, mochi } = fresh();
    ok(typeof sim.outfitChoice === 'function' && typeof sim.buyAndDress === 'function', 'Sim has outfitChoice (the row\'s label) and buyAndDress (Dress up\'s Buy & wear)');
    try {
      const kinds = Object.fromEntries(ALL.map(o => [o, sim.outfitChoice(o, mochi.worn)]));
      ok(kinds.beret === 'wearing' && kinds.flowers === 'wear' && kinds.bow === 'wear' && kinds.glasses === 'wear' && kinds.crown === 'needs' && kinds.party === 'needs',
        `Mochi on the test ranch (${Math.round(st.jelly)} jelly): the beret she wears "Wearing", owned ones "Wear", the rest "Needs N jelly"`, JSON.stringify(kinds));
      st.jelly = 1e10;
      const k2 = Object.fromEntries(ALL.map(o => [o, sim.outfitChoice(o, mochi.worn)]));
      ok(k2.party === 'buy' && k2.shades === 'buy' && k2.crown === 'needs' && k2.beret === 'wearing' && k2.flowers === 'wear', 'with 10B jelly: the Party Hat (5B) and Star Shades "Buy & wear", the Tiny Crown (100B) still "Needs"', JSON.stringify(k2));
      st.jelly = crown.cost;
      ok(sim.outfitChoice('crown', mochi.worn) === 'buy', 'exactly the price is enough (the Outfits page\'s canAfford)');
      ok(sim.outfitChoice('crown') === 'buy' && sim.outfitChoice('bow') === 'wear' && sim.outfitChoice('nope') === null, 'at home (no worn given): the slime at home\'s outfits; an unknown outfit has no row');
      st.outfits.worn.head = 'bow';
      ok(sim.outfitChoice('bow') === 'wearing' && sim.outfitChoice('bow', mochi.worn) === 'wear', 'the label follows whose outfits they are: Pebble wears the bow, Mochi does not');
    } catch (e) { ok(false, 'the rows\' labels', e.message); }
  }
  try {
    // Buy & wear the Tiny Crown on Mochi: the same jelly as buying it on the Outfits page
    const { st, sim, mochi } = fresh();
    const twin = fresh();
    st.jelly = twin.st.jelly = 1.5e11 + 0.37;
    const home0 = clone(st.outfits.worn), others0 = clone(st.ranch.residents.filter(x => x !== mochi).map(x => x.worn));
    twin.sim.buyOutfit('crown');
    const before = st.jelly, r = sim.buyAndDress(mochi.id, 'crown');
    ok(r.ok && st.jelly === before - crown.cost && st.jelly === twin.st.jelly, `Buy & wear the Tiny Crown: jelly down by exactly its Outfits price (${crown.cost}), the same as buying it on the Outfits page`, `${before} -> ${st.jelly} (Outfits page: ${twin.st.jelly})`);
    ok(st.outfits.owned.filter(o => o === 'crown').length === 1 && JSON.stringify(st.outfits.owned) === JSON.stringify(twin.st.outfits.owned), 'the family owns one Tiny Crown (the same list as buying it on the Outfits page)', st.outfits.owned.join(','));
    ok(mochi.worn.head === 'crown' && !Object.values(mochi.worn).includes('beret') && same(mochi.worn, { ...none(), head: 'crown' }) && same(r.worn, mochi.worn), 'Mochi wears the crown; the beret is off; her other slots are as they were', show(mochi.worn));
    ok(same(st.outfits.worn, home0) && st.ranch.residents.filter(x => x !== mochi).every((x, i) => same(x.worn, others0[i])), 'Pebble at home and every other resident wear what they wore (buying for Mochi dresses only Mochi)');
    const after = load(st), m2 = after.ranch.residents.find(x => x.name === 'Mochi');
    ok(same(m2.worn, mochi.worn) && after.outfits.owned.includes('crown') && after.jelly === st.jelly && checkSave(after).ok, 'a reload keeps it: she wears the crown, the family owns it, the jelly is what was left; a good save');
    ok(sim.outfitChoice('crown', mochi.worn) === 'wearing' && sim.outfitChoice('crown') === 'wear' && sim.outfitChoice('beret', mochi.worn) === 'buy', 'now her crown row reads "Wearing", Pebble\'s "Wear" (owned by the family), and the beret "Buy & wear"');
    const jun = st.ranch.residents.find(x => x.name === 'Juniper');
    ok(K.dressUp(st, jun.id, 'head', 'crown').ok && jun.worn.head === 'crown', 'family-wide: Juniper can wear the crown Mochi\'s Dress up bought');
    // again on an owned outfit: it goes on, nothing is spent
    const j1 = st.jelly, again = sim.buyAndDress(mochi.id, 'flowers');
    ok(again.ok && mochi.worn.head === 'flowers' && st.jelly === j1 && st.outfits.owned.length === 6, 'an outfit the family owns: it goes on and nothing is spent', `${j1} -> ${st.jelly}`);
  } catch (e) { ok(false, 'Buy & wear the Tiny Crown on Mochi', e.message); }
  try {
    // what can't happen spends nothing and changes nothing
    const { st, sim, mochi } = fresh();
    const keep = () => JSON.stringify({ j: st.jelly, o: st.outfits, r: st.ranch.residents.map(x => x.worn) });
    const k0 = keep(), poor = sim.buyAndDress(mochi.id, 'crown');
    ok(!poor.ok && poor.reason === 'poor' && keep() === k0, `can't afford (${Math.round(st.jelly)} jelly, the crown is ${crown.cost}): nothing bought, nothing worn, no jelly spent; she keeps the beret`, JSON.stringify(poor));
    st.jelly = 1e12;
    const k1 = keep();
    const bub = st.ranch.residents.find(x => x.name === 'Bubblegum');
    const away = sim.buyAndDress(bub.id, 'crown'), missing = sim.buyAndDress('nobody', 'crown'), unknown = sim.buyAndDress(mochi.id, 'tophat');
    ok(away.reason === 'away' && missing.reason === 'missing' && unknown.reason === 'outfit' && keep() === k1, 'a slime on a trip, one not on the ranch, an outfit that does not exist: nothing spent, nothing changes', [away, missing, unknown].map(x => x.reason).join(' '));
    // the Outfits page's own buy (Sim.buyOutfit) is unchanged
    const j = st.jelly;
    sim.buyOutfit('party');
    ok(st.jelly === j - OUTFIT_BY_ID.party.cost && st.outfits.owned.includes('party'), 'the Outfits page\'s buy (Sim.buyOutfit) is the same rule as before');
  } catch (e) { ok(false, 'Buy & wear when it can\'t happen', e.message); }
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
