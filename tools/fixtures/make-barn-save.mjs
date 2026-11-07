// Makes tools/fixtures/barn/barn-six.json: the Barn ranch's test save, made by the current rules (so it lives in its own
// folder: the node tests read every tools/fixtures/*.json as an OLD save).
//   node tools/fixtures/make-barn-save.mjs
// From main-gen2.json (generation 2, the baby Pebble at home, Juniper on the ranch), migrated, with six more residents,
// one of each kind the barn shows: Juniper (Curly, the old resident), Mochi (Curly with stars), Peaches (Dollop),
// Biscuit (Cat-ear Dollop), Plum (Topknot Dollop, in a lesson), Swirl (an in-between) and Bubblegum (on a trip, so not
// on the stand). 8 ranch slots, two Training Center lanes and two wagons, pearls to spend. The trip's and the lesson's times are fixed here; the barn smoke test
// moves them to its own clock when it loads the save.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { migrate } from '../../src/core/sim.js';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const clock = Date.UTC(2026, 10, 7, 12, 0, 0);
const base = JSON.parse(fs.readFileSync(path.join(HERE, 'main-gen2.json'), 'utf8')).save;
const st = migrate(JSON.parse(JSON.stringify(base)));
const j = st.ranch.residents[0];
const genes = (t, w, l, s) => ({ tall: t, wide: w, lump: l, side: s });
const skills = (o = {}) => ({ bounce: 0, speed: 0, sturdy: 0, smarts: 0, charm: 0, ...o });
const T = (o = {}) => ({ sweet: 0, heat: 0, mineral: 0, nature: 0, spark: 0, prism: 0, ...o });
const make = (id, name, body, form, traits, extra = {}) => ({
  ...JSON.parse(JSON.stringify(j)), id, name, ...body, form, traits, skills: skills(extra.skills), lesson: extra.lesson || null, trip: extra.trip || null,
  worn: { head: null, face: null, neck: null, ...(extra.worn || {}) }, happiness: extra.happiness ?? 80, pearlT: 0, petAt: 0, bredDay: null,
  memories: [{ t: clock - 86400000, icon: '⭐', text: `${name} settled.` }], movedAt: clock - 86400000, generation: 1,
});
const F = id => ({ id, name: { mochi: 'Marshmallow Slime', sweet: 'Candy Slime', nature: 'Moss Slime', prism: 'Crystal Slime', spark: 'Volt Slime', heat: 'Blaze Slime' }[id], blurb: '' });
st.ranch.residents.push(
  make('rbarnmochi', 'Mochi', { breed: 'curly', variant: 'plain', mix: 0, genes: genes(1.04, 0.97, 1.1, 0.02) }, F('prism'), T({ prism: 150, spark: 30 }), { skills: { bounce: 3, speed: 1 }, worn: { head: 'beret' } }),
  make('rbarnpeach', 'Peaches', { breed: 'dollop', variant: 'plain', mix: 1, genes: genes(0.96, 1.05, 1.2, -0.02) }, F('sweet'), T({ sweet: 170, heat: 20 }), { skills: { charm: 2 } }),
  make('rbarnbisc', 'Biscuit', { breed: 'dollop', variant: 'ears', mix: 1, genes: genes(0.95, 0.98, 1.3, 0.01) }, F('mochi'), T({ sweet: 40, mineral: 30, nature: 30 }), { skills: { smarts: 1 } }),
  make('rbarnplum', 'Plum', { breed: 'dollop', variant: 'topknot', mix: 1, genes: genes(1.02, 1.0, 1.15, 0) }, F('spark'), T({ spark: 160 }), { skills: { sturdy: 2 }, lesson: { skill: 'bounce', star: 1, startAt: clock - 600000, doneAt: clock + 7200000, pearls: 5 } }),
  make('rbarnswirl', 'Swirl', { breed: 'mixed', variant: 'plain', mix: 0.42, genes: genes(0.98, 1.02, 1.1, -0.01) }, F('nature'), T({ nature: 150, sweet: 25 }), { worn: { neck: 'scarf' } }),
  make('rbarnbub', 'Bubblegum', { breed: 'curly', variant: 'plain', mix: 0, genes: genes(1.0, 1.0, 1.0, 0) }, F('heat'), T({ heat: 160 }), { trip: { place: 'cafe', startAt: clock - 600000, homeAt: clock + 3000000, seed: 'rbarnbub:cafe:1', pearls: 5, souvenir: 'cupHat' } }),
);
st.ranch.slots = 8;
st.ranch.life.lanes = 2;    // Plum's lesson takes one lane; the other is free for a test's Train
st.ranch.life.wagons = 2;   // Bubblegum's trip takes one wagon; the other is free for a test's trip
st.ranch.pearls = 300;
st.ranch.basket.stored = 6;
st.savedAt = clock;
const again = migrate(JSON.parse(JSON.stringify(st)));
if (JSON.stringify(again) !== JSON.stringify(st)) throw new Error('migrating the barn save again changes it');
const out = { note: 'Barn ranch test save: 7 residents (Curly, Curly with stars, Dollop, Cat-ear Dollop, Topknot Dollop in a lesson, an in-between, a Curly on a trip), 8 slots. Made by tools/fixtures/make-barn-save.mjs from main-gen2.json.', madeWith: 'art (barn R2)', save: st };
fs.writeFileSync(path.join(HERE, 'barn', 'barn-six.json'), JSON.stringify(out, null, 1) + '\n');
console.log('wrote barn/barn-six.json | residents', st.ranch.residents.map(x => `${x.name} (${x.breed}${x.variant !== 'plain' ? ' ' + x.variant : ''}${x.trip ? ', trip' : ''}${x.lesson ? ', lesson' : ''})`).join(', '));
