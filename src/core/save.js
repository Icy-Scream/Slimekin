// Saves locally right away, and to the viewer's private cloud slot when the
// page runs inside claude.ai (so the slime follows you between devices).
//
// Save safety (slice H1). Three keys on this device:
//   slimekin.save.v1      the save
//   slimekin.save.prev    the previous good save. Kept just before an overwrite: once per visit (so it is the save the
//                         visit started from) and again whenever it is PREV_EVERY_MS older than the save. Also the
//                         slime a save code replaced, and the save "go back" left. Only a save that reads is kept.
//   slimekin.save.broken  the text of a save that could not be read (kept, never deleted, so it can be rescued)
// Boot (loadBoot): the save if it reads; if it is missing or broken, the previous good save; else a new egg (and
// the broken text stays in .broken). In the iPhone app the phone's backup is tried first (src/platform/index.js).
import { readSave, checkSave } from './save-check.js';

export const KEY = 'slimekin.save.v1';
export const PREV_KEY = 'slimekin.save.prev';
export const BROKEN_KEY = 'slimekin.save.broken';
export const KEEP_PREV_KEY = 'slimekin.save.keepPrev';   // sessionStorage: the next page keeps .prev as it is (a code or "go back" set it)
export const PREV_EVERY_MS = 30 * 60 * 1000;

const timeout = (ms) => new Promise(r => setTimeout(() => r(null), ms));

// localStorage that never throws (blocked storage, private mode): get -> null, set -> false
export const local = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* blocked */ } },
};
// Keep the text of a save that could not be read (the newest one wins; it is never deleted).
export function keepBroken(text) {
  if (typeof text !== 'string' || !text) return;
  if (local.get(BROKEN_KEY) !== text) local.set(BROKEN_KEY, text);
}

export class SaveStore {
  constructor() {
    this.ref = null;
    this.cloudOk = false;
    this.writing = false;
    this.pending = null;
    this.wrote = null;        // the text this page last wrote or read as the save (it passed checkSave)
    this.wroteAt = 0;         // its savedAt
    this.prevAt = undefined;  // .prev's savedAt (undefined: not read yet; null: none that reads)
    this.kept = false;        // this visit has kept its .prev
    this.failed = false;      // the last write failed (storage full or blocked)
    try { if (sessionStorage.getItem(KEEP_PREV_KEY)) { sessionStorage.removeItem(KEEP_PREV_KEY); this.kept = true; } } catch { /* none */ }
  }

  // The save to start from: { save, from: 'local' | 'prev' | 'none', broken } (broken: a save that could not be read
  // was found; its text is kept in .broken). Never throws.
  loadBoot() {
    const raw = local.get(KEY);
    const save = readSave(raw);
    if (save) { this.wrote = raw; this.wroteAt = save.savedAt || 0; return { save, from: 'local', broken: false }; }
    const broken = typeof raw === 'string' && raw !== '';
    if (broken) keepBroken(raw);
    const prev = readSave(local.get(PREV_KEY));
    if (prev) return { save: prev, from: 'prev', broken, savedAt: prev.savedAt || 0 };
    return { save: null, from: 'none', broken };
  }

  loadLocal() { return readSave(local.get(KEY)); }

  // Write the save. Returns false (and writes nothing) when it does not have a save's shape or storage refused it.
  saveLocal(obj) {
    if (!checkSave(obj).ok) { this.failed = true; return false; }
    let text;
    try { text = JSON.stringify(obj); } catch { this.failed = true; return false; }
    this.keepPrev(text);
    let ok = local.set(KEY, text);
    if (!ok && local.get(PREV_KEY) != null) {   // storage full: the older copy makes room for the save itself
      local.del(PREV_KEY);
      this.prevAt = null;
      ok = local.set(KEY, text);
    }
    this.failed = !ok;
    if (ok) { this.wrote = text; this.wroteAt = obj.savedAt || 0; }
    return ok;
  }

  // Just before the stored save is overwritten: it becomes .prev if it reads and .prev is missing, or this visit has
  // not kept one yet, or .prev is PREV_EVERY_MS older than it.
  keepPrev(next) {
    const cur = local.get(KEY);
    if (cur == null || cur === next) return;
    let at;
    if (cur === this.wrote) at = this.wroteAt;
    else { const s = readSave(cur); if (!s) return; at = s.savedAt || 0; }
    if (this.prevAt === undefined) { const p = readSave(local.get(PREV_KEY)); this.prevAt = p ? (p.savedAt || 0) : null; }
    if (this.prevAt !== null && this.kept && at - this.prevAt < PREV_EVERY_MS) return;
    if (local.set(PREV_KEY, cur)) { this.prevAt = at; this.kept = true; }
  }

  // The previous good save: { save, savedAt } or null.
  prevSave() {
    const s = readSave(local.get(PREV_KEY));
    return s ? { save: s, savedAt: s.savedAt || 0 } : null;
  }

  // A save code replaces the slime: the replaced one (if it reads) becomes .prev, and the next page keeps it there.
  replaceWith(obj) {
    if (!checkSave(obj).ok) return false;
    const cur = local.get(KEY);
    if (readSave(cur)) { local.set(PREV_KEY, cur); this.prevAt = undefined; }
    else keepBroken(cur);
    this.markKeepPrev();
    this.kept = true;
    const text = JSON.stringify(obj);
    const ok = local.set(KEY, text);
    if (ok) { this.wrote = text; this.wroteAt = obj.savedAt || 0; }
    return ok;
  }

  // "Go back to the last good save": .prev becomes the save, and the save it replaces (if it reads) becomes .prev.
  restorePrev() {
    const prevText = local.get(PREV_KEY);
    if (!readSave(prevText)) return false;
    const cur = local.get(KEY);
    if (readSave(cur)) local.set(PREV_KEY, cur);
    else keepBroken(cur);
    this.markKeepPrev();
    this.prevAt = undefined;
    return local.set(KEY, prevText);
  }

  markKeepPrev() { try { sessionStorage.setItem(KEEP_PREV_KEY, '1'); } catch { /* none */ } }

  // "Start over": the save and its previous copy go (a broken save's text stays).
  clearLocal() {
    local.del(KEY);
    local.del(PREV_KEY);
    this.wrote = null;
    this.prevAt = null;
  }

  async connect(ms = 3000) {
    if (!window.claude || typeof window.claude.use !== 'function') return false;
    try {
      const pair = await Promise.race([Promise.all([window.claude.use('db'), window.claude.use('user')]), timeout(ms)]);
      if (!pair) return false;
      const [db, user] = pair;
      if (!db || !user) return false;
      const uid = await Promise.race([user.id(), timeout(ms)]);
      if (!uid) return false;
      this.ref = db.doc('data/users/' + uid + '/save');
      this.cloudOk = true;
      return true;
    } catch { return false; }
  }

  async loadCloud(ms = 3000) {
    if (!this.cloudOk) return null;
    try {
      const snap = await Promise.race([this.ref.get(), timeout(ms)]);
      if (snap && snap.exists) {
        const d = snap.data();
        if (d && typeof d.json === 'string') return readSave(d.json);   // only a save that reads
      }
    } catch { /* unreachable: play on the local copy */ }
    return null;
  }

  async saveCloud(obj) {
    if (!this.cloudOk || !checkSave(obj).ok) return;
    const body = { json: JSON.stringify(obj), savedAt: obj.savedAt, name: obj.slime?.name || '', v: obj.v };
    if (this.writing) { this.pending = body; return; }
    this.writing = true;
    let next = body;
    while (next) {
      try {
        await this.ref.set(next);
      } catch (e) {
        const code = e && e.code;
        if (code === 'invalid_argument' || code === 'not_granted' || code === 'revoked' || code === 'capability_disabled' || code === 'quota_exceeded') {
          this.cloudOk = false;
          this.pending = null;
        }
      }
      next = this.pending;
      this.pending = null;
    }
    this.writing = false;
  }

  async clearCloud() {
    if (!this.cloudOk) return;
    try { await this.ref.delete(); } catch { /* ignore */ }
  }
}
