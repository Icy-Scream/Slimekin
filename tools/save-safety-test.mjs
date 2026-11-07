// Save safety check in plain node (slice H1): no save is ever lost, and a save must have a save's shape.
//   (a) a broken local save + a good backup: the old slime comes back and the backup is not written over
//       (the iPhone app's Preferences copy, the device's own previous save .prev, and a phone that did not answer)
//   (b) a broken local save and no backup: the broken text is kept in slimekin.save.broken, a new egg starts
//   (c) save codes: empty or bad codes are refused with a message; a good one replaces the slime only through
//       replaceWith, which keeps the replaced one as .prev (and the next visit keeps it there)
//   (d) NaN or strings in number fields are repaired (migrate); a save without a known phase or a slime is rejected
//   (e) .prev: kept once per visit and every PREV_EVERY_MS, not on every save; full storage drops .prev for the save
// localStorage, sessionStorage and the iPhone app's Capacitor Preferences are small fakes here.
//   node tools/save-safety-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = url.pathToFileURL(path.resolve(HERE, '../src')).href;
const results = [], errors = [];
const check = (cond, what, extra = '') => {
  const line = (cond ? 'ok   ' : 'FAIL ') + what + (extra ? ' | ' + extra : '');
  results.push(line); console.log(line); if (!cond) errors.push(line);
};

// ---------- fakes ----------
class FakeStorage {
  constructor(quota = Infinity) { this.m = new Map(); this.quota = quota; this.blocked = false; }
  size() { let n = 0; for (const [k, v] of this.m) n += k.length + v.length; return n; }
  getItem(k) { if (this.blocked) throw new Error('SecurityError'); return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) {
    if (this.blocked) throw new Error('SecurityError');
    v = String(v);
    const old = this.m.has(k) ? k.length + this.m.get(k).length : 0;
    if (this.size() - old + k.length + v.length > this.quota) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
    this.m.set(k, v);
  }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const listeners = {};
globalThis.localStorage = new FakeStorage();
globalThis.sessionStorage = new FakeStorage();
globalThis.document = { visibilityState: 'visible', addEventListener: (t, f) => (listeners['doc:' + t] ||= []).push(f) };
const prefs = { m: new Map(), sets: 0, gets: 0, mute: false };
const Preferences = {
  get: ({ key }) => { prefs.gets++; return prefs.mute ? new Promise(() => {}) : Promise.resolve({ value: prefs.m.has(key) ? prefs.m.get(key) : null }); },
  set: ({ key, value }) => { prefs.sets++; prefs.m.set(key, value); return Promise.resolve(); },
  remove: ({ key }) => { prefs.m.delete(key); return Promise.resolve(); },
};
globalThis.window = {
  Capacitor: { isNativePlatform: () => true, Plugins: { Preferences } },
  addEventListener: (t, f) => (listeners['win:' + t] ||= []).push(f),
};
const fire = t => { for (const f of listeners['win:' + t] || []) f({}); };

const { SaveStore, KEY, PREV_KEY, BROKEN_KEY, PREV_EVERY_MS } = await import(SRC + '/core/save.js');
const { checkSave, readSave, readSaveCode, makeSaveCode, num } = await import(SRC + '/core/save-check.js');
const { migrate, createState, Sim } = await import(SRC + '/core/sim.js');
let visit = 0;
const platform = () => import(SRC + '/platform/index.js?visit=' + (++visit));   // a fresh module = a fresh app start

const PEBBLE = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'main-gen2.json'), 'utf8')).save;   // "Pebble", playing
const pebbleText = JSON.stringify({ ...PEBBLE, savedAt: Date.now() - 60000 });
const reset = () => { localStorage.clear(); sessionStorage.clear(); prefs.m.clear(); prefs.sets = 0; prefs.gets = 0; prefs.mute = false; };
const nameIn = text => { try { return JSON.parse(text).slime.name; } catch { return '(unreadable)'; } };
const wait = ms => new Promise(r => setTimeout(r, ms));
// what main.js and the game do at boot and then for a while: restore, load, a few autosaves, the app going away
async function bootAndPlay(p, { saves = 3 } = {}) {
  const restored = await p.restoreSave();
  const store = p.mirrorSaves(new SaveStore());
  const start = store.loadBoot();
  const state = start.save ? migrate(start.save) : createState();
  for (let i = 0; i < saves; i++) { state.savedAt = Date.now() + i; store.saveLocal(state); }
  fire('pagehide'); fire('pageshow');   // the copy is written at once when the app goes away
  await wait(5);
  return { restored, store, start, state };
}

// ---------- (a) broken local + good backup ----------
{
  reset();
  const truncated = pebbleText.slice(0, 400);   // a cut-off write
  localStorage.setItem(KEY, truncated);
  prefs.m.set(KEY, pebbleText);
  const p = await platform();
  const { restored, start, state } = await bootAndPlay(p);
  check(restored === true, '(a) app: an unreadable save + a good phone backup: the backup is written back');
  check(start.save && start.save.slime.name === 'Pebble' && state.phase === 'play', '(a) app: the game starts with Pebble, not a new egg', start.save ? start.save.slime.name : 'no save');
  check(localStorage.getItem(BROKEN_KEY) === truncated, '(a) app: the unreadable text is kept in slimekin.save.broken');
  check(nameIn(prefs.m.get(KEY)) === 'Pebble', '(a) app: after the autosaves and pagehide the phone backup still holds Pebble', `backup: ${nameIn(prefs.m.get(KEY))}, ${prefs.sets} copy write(s)`);
  check(p.lastRestore && p.lastRestore.broken === true, '(a) app: the game is told an unreadable save was set aside (for the gentle note)');
}
{
  reset();
  localStorage.setItem(KEY, 'null');   // parses, but is not a save
  prefs.m.set(KEY, pebbleText);
  const p = await platform();
  const { start } = await bootAndPlay(p);
  check(start.save && start.save.slime.name === 'Pebble', '(a) app: a save that parses to null is treated as unreadable: Pebble comes back');
}
{
  reset();   // the web: no phone backup, but the device's own previous good save
  const store0 = new SaveStore();
  const s1 = migrate(JSON.parse(pebbleText));
  store0.saveLocal(s1);
  s1.jelly += 5; s1.savedAt += 6000; store0.saveLocal(s1);   // the second write keeps the first as .prev
  check(nameIn(localStorage.getItem(PREV_KEY)) === 'Pebble', '(a) web: the first overwrite of a visit keeps the save as .prev');
  localStorage.setItem(KEY, '{"v":1,"phase":"pl');   // then the save breaks
  const store = new SaveStore();
  const start = store.loadBoot();
  check(start.from === 'prev' && start.save.slime.name === 'Pebble' && start.broken, '(a) web: a broken save + a good .prev: Pebble comes back from .prev', `${start.from} ${start.save?.slime?.name}`);
  const state = migrate(start.save);
  store.saveLocal(state);
  check(nameIn(localStorage.getItem(KEY)) === 'Pebble' && nameIn(localStorage.getItem(PREV_KEY)) === 'Pebble', '(a) web: the next save writes Pebble; .prev still holds Pebble (the broken text never becomes .prev)');
  check(localStorage.getItem(BROKEN_KEY) === '{"v":1,"phase":"pl', '(a) web: the broken text is kept');
}
{
  reset();   // app: the backup and .prev both read: the newer one wins
  const older = JSON.stringify({ ...JSON.parse(pebbleText), jelly: 1, savedAt: Date.now() - 3600000 });
  localStorage.setItem(KEY, 'garbage');
  localStorage.setItem(PREV_KEY, pebbleText);
  prefs.m.set(KEY, older);
  const p = await platform();
  const restored = await p.restoreSave();
  const start = new SaveStore().loadBoot();
  check(!restored && start.from === 'prev' && start.save.jelly === PEBBLE.jelly, '(a) app: .prev newer than the phone backup: .prev is used', `${start.from}, jelly ${start.save?.jelly}`);
}
{
  reset();   // app: the phone does not answer at boot while the copy is needed
  prefs.m.set(KEY, pebbleText);
  prefs.mute = true;
  const p = await platform();
  const t0 = Date.now();
  const { restored, start } = await bootAndPlay(p);
  check(!restored && start.from === 'none' && Date.now() - t0 < 2500, '(a) app: no answer from the phone: the boot goes on with a new egg (within ~1.5 s)', `${Date.now() - t0} ms`);
  check(nameIn(prefs.m.get(KEY)) === 'Pebble' && prefs.sets === 0, '(a) app: ...and nothing is copied over the backup while it could not be checked', `${prefs.sets} write(s)`);
  prefs.mute = false;
  const p2 = await platform();   // the next start: the phone answers; the new egg was never touched, so Pebble comes back
  const second = await bootAndPlay(p2);
  check(second.restored && second.start.save.slime.name === 'Pebble' && nameIn(prefs.m.get(KEY)) === 'Pebble', '(a) app: the next start looks again: Pebble comes back over the brand-new egg', second.start.save?.slime?.name);
}
{
  reset();   // the mirror only copies a save that reads back
  const p = await platform();
  await p.restoreSave();
  const store = p.mirrorSaves(new SaveStore());
  const bad = { phase: 'dance', slime: {} };
  const ok = store.saveLocal(bad);
  fire('pagehide'); fire('pageshow');
  check(ok === false && localStorage.getItem(KEY) === null && !prefs.m.has(KEY), '(a) a state without a save\'s shape is never written or copied to the backup');
}

// ---------- (b) broken local, no backup ----------
{
  reset();
  localStorage.setItem(KEY, '{"v":1,"phase":"play","slime":{"name":"Peb');
  const p = await platform();
  const { restored, start, state } = await bootAndPlay(p);
  check(!restored && start.from === 'none' && start.broken === true, '(b) app: a broken save and no backup: a new egg, and the game is told (broken)', JSON.stringify({ from: start.from, broken: start.broken }));
  check(state.phase === 'egg', '(b) app: the new game is an egg');
  check(localStorage.getItem(BROKEN_KEY) === '{"v":1,"phase":"play","slime":{"name":"Peb', '(b) app: the broken text is kept in slimekin.save.broken after the new egg saved');
  const store = new SaveStore();
  store.clearLocal();   // "Start over" later: the save and .prev go, the broken text stays
  check(localStorage.getItem(BROKEN_KEY) !== null && localStorage.getItem(KEY) === null && localStorage.getItem(PREV_KEY) === null, '(b) Start over removes the save and .prev but keeps slimekin.save.broken');
}
{
  reset();
  localStorage.setItem(KEY, 'not a save at all');
  const store = new SaveStore();
  const start = store.loadBoot();
  check(start.from === 'none' && start.broken && localStorage.getItem(BROKEN_KEY) === 'not a save at all', '(b) web: same: new egg, text kept');
  store.saveLocal(createState());
  check(localStorage.getItem(BROKEN_KEY) === 'not a save at all' && localStorage.getItem(PREV_KEY) === null, '(b) web: the new egg\'s save never moves the broken text into .prev');
}

// ---------- (c) save codes ----------
{
  const b64 = s => 'SLIMEKIN1:' + Buffer.from(s, 'utf8').toString('base64');
  const bad = {
    'empty': '', 'spaces': '   ', 'no prefix': 'hello there', 'not base64': 'SLIMEKIN1:%%%%', 'cut short': makeSaveCode(PEBBLE).slice(0, 60),
    '{}': b64('{}'), '[]': b64('[1,2]'), 'null': b64('null'), 'a number': b64('42'), 'unknown phase': b64(JSON.stringify({ ...PEBBLE, phase: 'dance' })),
    'no slime': b64(JSON.stringify({ ...PEBBLE, slime: null })), 'slime is text': b64(JSON.stringify({ ...PEBBLE, slime: 'x' })),
    'ranch is text': b64(JSON.stringify({ ...PEBBLE, ranch: 'x' })), 'other version': b64(JSON.stringify({ ...PEBBLE, v: 7 })),
    'name is a number': b64(JSON.stringify({ ...PEBBLE, slime: { ...PEBBLE.slime, name: 5 } })),
  };
  for (const [what, code] of Object.entries(bad)) {
    const r = readSaveCode(code);
    check(!r.ok && typeof r.msg === 'string' && r.msg.length > 10, `(c) a bad code is refused with a message: ${what}`, r.ok ? 'ACCEPTED' : r.msg);
  }
  const good = readSaveCode('  ' + makeSaveCode(PEBBLE) + '\n');
  check(good.ok && good.save.slime.name === 'Pebble', '(c) a good code (with spaces around it) reads: Pebble');
  const emoji = readSaveCode(makeSaveCode({ ...PEBBLE, slime: { ...PEBBLE.slime, name: 'Mochi ✿' } }));
  check(emoji.ok && emoji.save.slime.name === 'Mochi ✿', '(c) a name with non-ASCII letters survives the code');

  reset();   // the replace: the slime here becomes .prev, and the next visit keeps it there
  const store = new SaveStore();
  const here = migrate(JSON.parse(pebbleText));
  here.slime.name = 'Here'; store.saveLocal(here);
  const incoming = migrate(good.save); incoming.slime.name = 'Incoming'; incoming.savedAt = Date.now();
  check(store.replaceWith(incoming) === true, '(c) replaceWith writes the code\'s slime');
  check(nameIn(localStorage.getItem(KEY)) === 'Incoming' && nameIn(localStorage.getItem(PREV_KEY)) === 'Here', '(c) the replaced slime is kept as .prev', `${nameIn(localStorage.getItem(KEY))} / prev ${nameIn(localStorage.getItem(PREV_KEY))}`);
  const next = new SaveStore();   // the page reloads (sessionStorage carries "keep .prev")
  const st = migrate(next.loadBoot().save);
  for (let i = 0; i < 4; i++) { st.savedAt = Date.now() + i * 6000; next.saveLocal(st); }
  check(nameIn(localStorage.getItem(PREV_KEY)) === 'Here', '(c) after the reload and four autosaves .prev still holds the replaced slime');
  check(replaceIsChecked(store), '(c) replaceWith refuses something without a save\'s shape');
  function replaceIsChecked(s) { const before = localStorage.getItem(KEY); return s.replaceWith({ phase: 'x' }) === false && localStorage.getItem(KEY) === before; }
}

// ---------- (d) numbers and shape ----------
{
  const s = JSON.parse(pebbleText);
  const trait = Object.keys(s.slime.traits)[0];
  const helper = Object.keys(s.helpers)[0];
  Object.assign(s, { jelly: 'abc', totalJelly: null, savedAt: 'yesterday', tutorial: 'x' });
  Object.assign(s.slime, { growth: '12', tummy: NaN, joy: {}, bondXp: [] });
  s.slime.traits[trait] = 'lots';
  s.helpers[helper] = null;
  s.stats.boops = '5';
  s.ranch.pearls = 'many'; s.ranch.basket.stored = NaN; s.ranch.family.generation = 'two';
  if (s.ranch.residents[0]) { s.ranch.residents[0].runTotal = {}; s.ranch.residents[0].happiness = 'very'; }
  const text = JSON.stringify(s);   // (NaN becomes null in JSON, as it would in a real save)
  const m = migrate(JSON.parse(text));
  const bad = [];
  const walk = (o, at) => { for (const [k, v] of Object.entries(o || {})) { if (typeof v === 'number' && !Number.isFinite(v)) bad.push(at + k); else if (v && typeof v === 'object') walk(v, at + k + '.'); } };
  walk(m, '');
  check(m.jelly === 0 && m.totalJelly === 0 && Number.isFinite(m.savedAt) && m.tutorial === 0, '(d) top-level numbers repaired (jelly "abc" -> 0, totalJelly null -> 0, savedAt "yesterday" -> now)', JSON.stringify({ jelly: m.jelly, totalJelly: m.totalJelly, tutorial: m.tutorial }));
  check(m.slime.growth === 12 && Number.isFinite(m.slime.tummy) && Number.isFinite(m.slime.joy) && m.slime.bondXp === 0, '(d) slime numbers: "12" -> 12, NaN and objects -> the fresh value', JSON.stringify({ g: m.slime.growth, t: m.slime.tummy, j: m.slime.joy, b: m.slime.bondXp }));
  check(m.slime.traits[trait] === 0 && m.helpers[helper] === 0 && m.stats.boops === 5, '(d) traits, helpers and stats repaired', JSON.stringify({ t: m.slime.traits[trait], h: m.helpers[helper], b: m.stats.boops }));
  check(m.ranch.pearls === 0 && m.ranch.basket.stored === 0 && m.ranch.family.generation === 1, '(d) ranch numbers repaired', JSON.stringify({ p: m.ranch.pearls, s: m.ranch.basket.stored, g: m.ranch.family.generation }));
  if (m.ranch.residents[0]) check(m.ranch.residents[0].runTotal === 0 && m.ranch.residents[0].happiness === 90, '(d) a resident\'s numbers repaired', JSON.stringify({ r: m.ranch.residents[0].runTotal, h: m.ranch.residents[0].happiness }));
  check(bad.length === 0, '(d) no NaN or Infinity anywhere in the repaired save', bad.join(', '));
  const sim = new Sim(m);
  for (let i = 0; i < 60; i++) sim.tick(0.5);
  check(Number.isFinite(m.jelly) && Number.isFinite(m.slime.growth) && Number.isFinite(m.slime.tummy), '(d) the repaired save plays 30 s with finite numbers', JSON.stringify({ jelly: m.jelly, growth: m.slime.growth }));
  for (const [what, obj] of [['phase "dance"', { ...PEBBLE, phase: 'dance' }], ['no phase', { ...PEBBLE, phase: undefined }], ['slime missing', { ...PEBBLE, slime: undefined }], ['an array', [PEBBLE]], ['settings is text', { ...PEBBLE, settings: 'loud' }]]) {
    check(!checkSave(obj).ok && readSave(JSON.stringify(obj)) === null, `(d) rejected: ${what}`, checkSave(obj).why);
  }
  check(checkSave(PEBBLE).ok && checkSave(createState()).ok, '(d) a real save and a brand-new state pass');
  check(num(3.5, 0) === 3.5 && num('7', 0) === 7 && num('', 1) === 1 && num(true, 1) === 1 && num([], 2) === 2 && num(Infinity, 4) === 4, '(d) num(): finite numbers and numeric text stay, everything else becomes the default');
  const fixtures = fs.readdirSync(path.join(HERE, 'fixtures')).filter(f => f.endsWith('.json'));
  const fails = fixtures.filter(f => { const j = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', f), 'utf8')); return !checkSave(j.save || j).ok; });
  check(fails.length === 0, `(d) every old save in tools/fixtures passes the shape check (${fixtures.length})`, fails.join(', '));
}

// ---------- (e) .prev rotation and full storage ----------
{
  reset();
  const store = new SaveStore();
  const st = migrate(JSON.parse(pebbleText));
  const t0 = Date.now();
  const at = sec => { st.savedAt = t0 + sec * 1000; st.jelly = sec; store.saveLocal(st); };
  at(0); at(6);
  const prevAfter2 = JSON.parse(localStorage.getItem(PREV_KEY)).jelly;
  at(12); at(18); at(24);
  const prevLater = JSON.parse(localStorage.getItem(PREV_KEY)).jelly;
  check(prevAfter2 === 0 && prevLater === 0, '(e) .prev is the save the visit started from, not rewritten on every save', `${prevAfter2}, ${prevLater}`);
  const later = PREV_EVERY_MS / 1000 + 30;
  at(later);   // (the save being replaced, 24 s, is not yet 30 min newer than .prev)
  const stillFirst = JSON.parse(localStorage.getItem(PREV_KEY)).jelly;
  at(later + 6);   // the save being replaced is now 30 min newer than .prev: it becomes .prev
  check(stillFirst === 0 && JSON.parse(localStorage.getItem(PREV_KEY)).jelly === later, `(e) ...and moves on once the save it would keep is ${PREV_EVERY_MS / 60000} min newer`, `${stillFirst} -> ${JSON.parse(localStorage.getItem(PREV_KEY)).jelly}`);
  const r = store.restorePrev();
  check(r && JSON.parse(localStorage.getItem(KEY)).jelly === later && JSON.parse(localStorage.getItem(PREV_KEY)).jelly === later + 6, '(e) restorePrev ("Restore last good save") swaps: .prev becomes the save, the save becomes .prev');

  reset();
  const big = migrate(JSON.parse(pebbleText));
  const one = JSON.stringify(big).length;
  globalThis.localStorage = new FakeStorage(one * 2 + 100);   // room for about two saves
  const s2 = new SaveStore();
  big.savedAt = Date.now(); s2.saveLocal(big);
  big.memories = [...big.memories, ...Array.from({ length: 20 }, (_, i) => ({ t: i, icon: '✨', text: 'a longer memory to grow the save '.repeat(2) }))];
  big.savedAt += 6000;
  const ok = s2.saveLocal(big);
  check(ok && JSON.parse(localStorage.getItem(KEY)).memories.length === big.memories.length, '(e) storage nearly full: .prev makes room and the save itself is written', `ok ${ok}, prev ${localStorage.getItem(PREV_KEY) ? 'kept' : 'dropped'}`);
  globalThis.localStorage.blocked = true;
  check(s2.saveLocal(big) === false && s2.failed === true, '(e) storage blocked: saveLocal returns false (the game shows one toast)');
  globalThis.localStorage = new FakeStorage();
}

console.log(errors.length ? `\nFAILED (${errors.length} of ${results.length} checks)\n${errors.join('\n')}` : `\nOK (${results.length} checks)`);
process.exit(errors.length ? 1 : 0);
