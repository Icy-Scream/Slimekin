// Makes tools/fixtures/talents/ranch-trained.json: a save from before talents (no Potential, no revealed talents) with
// a fully trained resident and lessons in flight, for tools/talent-test.mjs (nobody loses a star; a lesson in progress
// finishes unchanged). It has the Greenhouse and ranch life, which the older saves in tools/fixtures/*.json must not
// have (the other node tests check that those get them by migration), so it lives in its own folder.
//   node tools/fixtures/make-trained-save.mjs
// From barn/barn-six.json (main @ 00f1430 rules): Mochi (Crystal) has 5 stars in every skill, Peaches (Candy) is in
// her 5th Charm lesson, Plum keeps her 1st Bounce lesson. Talent fields are stripped, so remaking it with newer rules
// still gives an old save.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const src = JSON.parse(fs.readFileSync(path.join(HERE, 'barn', 'barn-six.json'), 'utf8'));
const st = JSON.parse(JSON.stringify(src.save));
const clock = Date.UTC(2026, 10, 7, 12, 0, 0);
const by = name => st.ranch.residents.find(x => x.name === name);
by('Mochi').skills = { bounce: 5, speed: 5, sturdy: 5, smarts: 5, charm: 5 };
const peaches = by('Peaches');
peaches.skills = { bounce: 0, speed: 0, sturdy: 0, smarts: 0, charm: 4 };
peaches.lesson = { skill: 'charm', star: 5, startAt: clock - 2 * 3600e3, doneAt: clock + 4 * 3600e3, pearls: 50 };
st.ranch.life.lessons = 15;
st.ranch.life.lanes = 2;
// an old save: nothing about talents
const strip = o => { if (o && typeof o === 'object') { delete o.potential; delete o.talentsSeen; } };
strip(st.slime);
for (const x of st.ranch.residents) strip(x);
for (const e of st.ranch.nursery?.eggs || []) strip(e);
if (st.egg?.bred) strip(st.egg.bred);
const out = { note: 'Old save (pre-talents): Mochi has 5 stars in every skill, Peaches is in her 5th Charm lesson (done at 2026-11-07 16:00Z), Plum in her 1st Bounce lesson. Made by tools/fixtures/make-trained-save.mjs from barn/barn-six.json.', madeWith: src.madeWith, save: st };
fs.writeFileSync(path.join(HERE, 'talents', 'ranch-trained.json'), JSON.stringify(out, null, 1) + '\n');
console.log('wrote tools/fixtures/talents/ranch-trained.json:', st.ranch.residents.map(x => `${x.name} ${JSON.stringify(x.skills)}${x.lesson ? ' lesson ' + x.lesson.skill + ' ' + x.lesson.star : ''}`).join(' | '));
