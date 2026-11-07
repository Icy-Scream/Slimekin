// Save safety: what a readable save looks like, number repair for old or damaged saves, and the save code's text.
// No three.js, no DOM. Never calls Math.random (the economy simulator replays the game's own random numbers).
//
// checkSave(obj): the shape a save must have to be used at all. Required: a plain object, `phase` one of PHASES,
//   `slime` an object, `v` (when there) the save version; containers that are there (ranch, settings, ...) must be
//   objects. A save that fails is never loaded, written, mirrored or accepted as a save code.
// num(v, d): a number field from a save: a finite number (or a numeric string) stays, anything else becomes `d`.
//   migrate() (core/sim.js) and migrateRanch() (core/ranch.js) run every number of the save through it, so a
//   string or NaN in a number field can't turn into NaN in the game.

export const SAVE_VERSION = 1;
export const PHASES = ['egg', 'naming', 'play'];
export const CODE_PREFIX = 'SLIMEKIN1:';

const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
// containers a save may have; when there, each must be an object
const BOXES = ['slime', 'ranch', 'settings', 'stats', 'helpers', 'egg', 'jar', 'outfits', 'heirlooms'];

export function checkSave(obj) {
  if (!isObj(obj)) return { ok: false, why: 'not a save' };
  if ('v' in obj && obj.v !== SAVE_VERSION) return { ok: false, why: `save version ${JSON.stringify(obj.v)}` };
  if (!PHASES.includes(obj.phase)) return { ok: false, why: `unknown phase ${JSON.stringify(obj.phase)}` };
  if (!isObj(obj.slime)) return { ok: false, why: 'no slime' };
  for (const k of BOXES) if (k in obj && obj[k] != null && !isObj(obj[k])) return { ok: false, why: `${k} is not an object` };
  if ('name' in obj.slime && typeof obj.slime.name !== 'string') return { ok: false, why: 'the name is not text' };
  return { ok: true, why: '' };
}

// The text of a save (localStorage, the phone's backup, a cloud slot) -> the save, or null when it can't be used.
export function readSave(text) {
  if (typeof text !== 'string' || !text) return null;
  let obj;
  try { obj = JSON.parse(text); } catch { return null; }
  return checkSave(obj).ok ? obj : null;
}

// ---------- numbers ----------
export function num(v, d) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : d;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v)) return +v;
  return d;
}
// a time or "not yet": null stays null, a number stays, anything else becomes `d`
export const numOrNull = (v, d = null) => (v === null ? null : num(v, d));
// every value of an object of numbers (traits, helpers, stats...): keys of `fresh` get fresh's value when broken; other
// keys the save has are kept when they are numbers and dropped when not (a count must never be NaN)
export function nums(obj, fresh) {
  const out = {};
  const src = isObj(obj) ? obj : {};
  for (const k of Object.keys(src)) { const n = num(src[k], fresh && k in fresh ? fresh[k] : undefined); if (n !== undefined) out[k] = n; }
  if (fresh) for (const k of Object.keys(fresh)) if (!(k in out)) out[k] = fresh[k];
  return out;
}
// a whole number at least `lo` (generation, levels, slots)
export const count = (v, d, lo = 0) => Math.max(lo, Math.floor(num(v, d)));

// ---------- the save code (Settings: Copy save code / Load a save code) ----------
export function makeSaveCode(obj) {
  return CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
// What was pasted -> { ok: true, save } or { ok: false, msg } (msg is for the player).
export function readSaveCode(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { ok: false, msg: 'Paste a save code first. It starts with SLIMEKIN1:' };
  if (!text.startsWith(CODE_PREFIX)) return { ok: false, msg: "That isn't a Slimekin save code. A save code starts with SLIMEKIN1:" };
  let obj;
  try { obj = JSON.parse(decodeURIComponent(escape(atob(text.slice(CODE_PREFIX.length).replace(/\s+/g, ''))))); } catch {
    return { ok: false, msg: "That code is cut short or changed. Copy the whole code again, from SLIMEKIN1: to the end." };
  }
  const c = checkSave(obj);
  if (!c.ok) return { ok: false, msg: "That code doesn't hold a slime this game can read. Nothing was changed.", why: c.why };
  return { ok: true, save: obj };
}
