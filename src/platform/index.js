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
//   when the app goes to the background or the page unloads. At boot, if localStorage has no save but the copy does,
//   the copy is written back before the game reads it. "Start over" drops the copy too. Deleting the app deletes
//   both; the Save Code in Settings stays the backup and the way to move a slime to another device.
// - Haptics. buzz(ms) becomes a light tap (a medium one for a buzz longer than 20 ms; never heavy).
// - Slots for later, both null: `store` (in-app purchases, slice W2) and `ads` (not decided).

export const SAVE_KEY = 'slimekin.save.v1';            // the key src/core/save.js writes; the only one mirrored
const CLEARED_KEY = 'slimekin.platform.cleared';       // "Start over" ran: the next boot drops the copy, not restores it
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

// Boot, before the game reads its save: bring back a save iOS cleared from localStorage. True when one came back.
export async function restoreSave() {
  if (!isNative) return false;
  try {
    const prefs = plugin('Preferences');
    if (!prefs) return false;
    if (localStorage.getItem(CLEARED_KEY)) {
      await within(quietly(() => prefs.remove({ key: SAVE_KEY })), RESTORE_MS);
      localStorage.removeItem(CLEARED_KEY);
      return false;
    }
    if (localStorage.getItem(SAVE_KEY)) return false;
    const r = await within(quietly(() => prefs.get({ key: SAVE_KEY })), RESTORE_MS);
    const json = r && typeof r.value === 'string' ? r.value : '';
    if (!json) return false;
    JSON.parse(json);                                  // only a readable save is written back
    localStorage.setItem(SAVE_KEY, json);
    return true;
  } catch { return false; }
}

// ---------- the copy ----------
let pending = null;
let timer = null;
let leaving = false;
function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (pending === null) return;
  const value = pending;
  pending = null;
  const prefs = plugin('Preferences');
  if (prefs) quietly(() => prefs.set({ key: SAVE_KEY, value }));
}
// Queue a copy of this save (a JSON string). Written within MIRROR_MS, or at once while the app is hidden or leaving.
export function mirrorSave(json) {
  if (!isNative || typeof json !== 'string' || !json) return;
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
// read back from localStorage, so it is always exactly what the game wrote there. Returns the same store.
export function mirrorSaves(saveStore) {
  if (!isNative || !saveStore) return saveStore;
  const save = saveStore.saveLocal, clear = saveStore.clearLocal;
  saveStore.saveLocal = function (obj) {
    save.call(this, obj);
    try { mirrorSave(localStorage.getItem(SAVE_KEY)); } catch { /* storage blocked */ }
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
