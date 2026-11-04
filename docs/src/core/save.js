// Saves locally right away, and to the viewer's private cloud slot when the
// page runs inside claude.ai (so the slime follows you between devices).
const KEY = 'slimekin.save.v1';

const timeout = (ms) => new Promise(r => setTimeout(() => r(null), ms));

export class SaveStore {
  constructor() {
    this.ref = null;
    this.cloudOk = false;
    this.writing = false;
    this.pending = null;
  }

  loadLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  saveLocal(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch { /* storage blocked: keep playing */ }
  }

  clearLocal() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
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
        if (d && typeof d.json === 'string') return JSON.parse(d.json);
      }
    } catch { /* unreachable: play on the local copy */ }
    return null;
  }

  async saveCloud(obj) {
    if (!this.cloudOk) return;
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
