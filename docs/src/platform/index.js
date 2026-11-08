// The iPhone app's seam to the phone (Capacitor). Rules:
// - The web version (GitHub Pages, the claude.ai artifact, the dev server) is untouched: there `isNative` is false,
//   every export is a no-op, and haptic() does exactly what buzz() always did (navigator.vibrate).
// - Native detection lives here and only here: window.Capacitor?.isNativePlatform?.() === true.
// - No imports from the app's npm packages (@capacitor/*): the game has no bundler and the web must not load them.
//   In the app, Capacitor's iOS runtime defines window.Capacitor and one object per installed plugin
//   (window.Capacitor.Plugins.Preferences, .Haptics) before any script runs (@capacitor/ios JSExport.swift).
// - Every call into the phone is guarded: a missing plugin, a throw or a rejected promise is swallowed and the game
//   plays on. Nothing here ever blocks the game for long (the one await, at boot, gives up after RESTORE_MS).
//
// In the app:
// - Save backup. iOS may clear a web view's localStorage when the phone is short on storage. Every local save
//   ('slimekin.save.v1' only) is copied into Preferences (iOS UserDefaults): at most once every MIRROR_MS, and at once
//   when the app goes to the background or the page unloads. At boot, if localStorage has no save, or one that can't
//   be read, the copy is written back before the game reads it (the unreadable text is kept in slimekin.save.broken;
//   if the device's own previous save, slimekin.save.prev, is newer, that one is used instead: src/core/save.js).
//   Only a save that reads back is ever copied, and if the phone did not answer at boot while the copy was needed,
//   nothing is copied over it until a later boot has looked at it (if the copy is a different game, it comes back and
//   the game played meanwhile becomes slimekin.save.prev). "Start over" drops the copy too. Deleting the app
//   deletes both; the Save Code in Settings stays the backup and the way to move a slime to another device.
// - Haptics. buzz(ms) becomes a light tap (a medium one for a buzz longer than 20 ms; never heavy).
// - A brand-new game starts with "Sound when phone is on silent" Off (freshState); the web keeps it On.
// - Slots for later, both null: `store` (in-app purchases, slice W2) and `ads` (not decided).

import { readSave } from '../core/save-check.js';
import { keepBroken, PREV_KEY, KEEP_PREV_KEY } from '../core/save.js';

export const SAVE_KEY = 'slimekin.save.v1';            // the key src/core/save.js writes; the only one mirrored
const CLEARED_KEY = 'slimekin.platform.cleared';       // "Start over" ran: the next boot drops the copy, not restores it
const UNCHECKED_KEY = 'slimekin.platform.unchecked';   // the copy was needed at boot but the phone did not answer
export const MIRROR_MS = 3000;                         // at most one copy every 3 s while the game is on screen
const RESTORE_MS = 1500;                               // boot waits at most this long for the phone's answer
const HAPTIC_GAP_MS = 60;                              // taps closer than this make one tap

function detect() {
  try { return window.Capacitor?.isNativePlatform?.() === true; } catch { return false; }
}
export const isNative = detect();

export const store = null;   // W2: in-app purchases
export const ads = null;     // not decided; nothing about ads is built

function plugin(name) {
  if (!isNative) return null;
  try { return window.Capacitor?.Plugins?.[name] || null; } catch { return null; }
}
// Call into the phone without ever throwing or leaving a rejected promise behind.
function quietly(call) {
  try {
    const p = call();
    if (p && typeof p.then === 'function') return Promise.resolve(p).catch(() => null);
    return Promise.resolve(p);
  } catch { return Promise.resolve(null); }
}
const within = (promise, ms) => Promise.race([promise, new Promise(r => setTimeout(() => r(null), ms))]);

// Boot, before the game reads its save: bring back a save iOS cleared from localStorage, or one that can't be read.
// True when the copy came back. lastRestore tells the game what happened ({ broken }: an unreadable save was set aside).
export let lastRestore = null;
let held = false;   // the copy could not be looked at this visit: never write over it
export async function restoreSave() {
  if (!isNative) return false;
  try {
    const prefs = plugin('Preferences');
    if (!prefs) return false;
    if (localStorage.getItem(CLEARED_KEY)) {
      await within(quietly(() => prefs.remove({ key: SAVE_KEY })), RESTORE_MS);
      localStorage.removeItem(CLEARED_KEY);
      localStorage.removeItem(UNCHECKED_KEY);
      return false;
    }
    const raw = localStorage.getItem(SAVE_KEY);
    const local = readSave(raw);
    const unchecked = !!localStorage.getItem(UNCHECKED_KEY);
    if (local && !unchecked) return false;              // a readable save and nothing pending: the fast path
    const r = await within(quietly(() => prefs.get({ key: SAVE_KEY })), RESTORE_MS);
    if (!r) {                                          // no answer: play on, but never copy over what the phone holds
      held = true;
      try { localStorage.setItem(UNCHECKED_KEY, '1'); } catch { /* storage blocked */ }
      if (raw && !local) keepBroken(raw);
      return false;
    }
    localStorage.removeItem(UNCHECKED_KEY);
    const json = r && typeof r.value === 'string' ? r.value : '';
    const copy = readSave(json);                       // only a readable save is written back
    if (local) {   // a boot the phone did not answer before: the copy may be a different game (the one this phone lost)
      if (!copy || copy.createdAt === local.createdAt) return false;   // nothing there, or a copy of this same game
      // a different game: it comes back, and the game played meanwhile is kept as .prev (and stays there next page)
      localStorage.setItem(PREV_KEY, raw);
      try { sessionStorage.setItem(KEEP_PREV_KEY, '1'); } catch { /* none */ }
      localStorage.setItem(SAVE_KEY, json);
      lastRestore = { broken: false };
      return true;
    }
    if (raw) keepBroken(raw);                          // the unreadable save's text is kept, never deleted
    if (!copy) {
      if (json && !localStorage.getItem('slimekin.save.broken')) keepBroken(json);
      return false;
    }
    const prev = readSave(localStorage.getItem(PREV_KEY));
    if (prev && (prev.savedAt || 0) > (copy.savedAt || 0)) return false;   // this device's own previous save is newer
    localStorage.setItem(SAVE_KEY, json);
    lastRestore = { broken: !!raw };
    return true;
  } catch { return false; }
}

// A brand-new game state (src/core/sim.js createState()), used only when the game starts without a save: no save on
// this phone, no copy brought back by restoreSave(), and so also right after "Start over". In the app, "Sound when
// phone is on silent" starts Off, so the game follows the silent switch until the player turns it on in Settings. A
// save that already exists, a restored copy and a pasted save code never come through here: they keep their own value.
// On the web the state is returned untouched (the game's default stays On).
export function freshState(state) {
  if (isNative && state && state.settings) state.settings.soundOnSilent = false;
  return state;
}

// ---------- the copy ----------
let pending = null;
let timer = null;
let leaving = false;
function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (held) { pending = null; return; }
  if (pending === null) return;
  const value = pending;
  pending = null;
  const prefs = plugin('Preferences');
  if (prefs) quietly(() => prefs.set({ key: SAVE_KEY, value }));
}
// Queue a copy of this save (a JSON string). Written within MIRROR_MS, or at once while the app is hidden or leaving.
// Nothing while the copy is held (the phone did not answer at boot when the copy was needed).
export function mirrorSave(json) {
  if (!isNative || held || typeof json !== 'string' || !json) return;
  pending = json;
  let hidden = leaving;
  try { hidden = hidden || document.visibilityState === 'hidden'; } catch { /* no document */ }
  if (hidden) flush();
  else if (!timer) timer = setTimeout(flush, MIRROR_MS);
}
function forget() {
  pending = null;
  if (timer) { clearTimeout(timer); timer = null; }
  try { localStorage.setItem(CLEARED_KEY, '1'); } catch { /* storage blocked */ }
  const prefs = plugin('Preferences');
  if (prefs) quietly(() => prefs.remove({ key: SAVE_KEY }));
}
// Hooks a SaveStore (src/core/save.js) so each local save is mirrored and "Start over" drops the copy. The copy is
// read back from localStorage, so it is always exactly what the game wrote there, and only when it reads back as a
// save (src/core/save-check.js). Returns the same store; saveLocal still returns whether the write worked.
export function mirrorSaves(saveStore) {
  if (!isNative || !saveStore) return saveStore;
  const save = saveStore.saveLocal, clear = saveStore.clearLocal, replace = saveStore.replaceWith;
  const copy = () => {
    try { const json = localStorage.getItem(SAVE_KEY); if (readSave(json)) mirrorSave(json); } catch { /* storage blocked */ }
  };
  saveStore.saveLocal = function (obj) {
    const ok = save.call(this, obj);
    if (ok) copy();
    return ok;
  };
  if (replace) saveStore.replaceWith = function (obj) {   // (a save code: the player chose it, so the copy follows)
    const ok = replace.call(this, obj);
    if (ok) { held = false; try { localStorage.removeItem(UNCHECKED_KEY); } catch { /* blocked */ } copy(); }
    return ok;
  };
  saveStore.clearLocal = function () {
    clear.call(this);
    forget();
  };
  return saveStore;
}
if (isNative) {
  try {
    window.addEventListener('pagehide', () => { leaving = true; flush(); });
    window.addEventListener('pageshow', () => { leaving = false; });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  } catch { /* no window */ }
}

// ---------- haptics ----------
let lastTap = -Infinity;
export function haptic(ms) {
  if (!isNative) {
    try { navigator.vibrate && navigator.vibrate(ms); } catch { /* not supported */ }
    return;
  }
  const now = performance.now();
  if (now - lastTap < HAPTIC_GAP_MS) return;
  lastTap = now;
  const h = plugin('Haptics');
  if (h) quietly(() => h.impact({ style: ms > 20 ? 'MEDIUM' : 'LIGHT' }));
}
