// Saving (local and cloud) and save safety: the autosave after a clean frame, the hiccup card, the lost 3D picture and
// the note about how this visit started (main.js). A part of Game (src/mixin.js): `this` is the Game.
import { esc } from '../ui/esc.js';
import { showNotice, copyText, agoText } from '../ui/notice.js';
import { BROKEN_KEY } from '../core/save.js';

const TROUBLE_FAILS = 3;   // save safety: failed frames in a row (each clean frame takes 0.1 off) before the hiccup card

export class SavingPart {
  // ---------- saving ----------
  serialize() {
    this.state.savedAt = Date.now();
    this.state.slime.belly = this.slime.bellySnapshot();
    return this.state;
  }
  // Save safety: nothing is saved while starting over, after the hiccup card, or right after a frame that failed (its
  // state may be half-done); the next clean frame's autosave catches up.
  canSave() { return !this.resetting && !this.trouble && !this.health.lastFailed; }
  saveNow(cloud = false) {
    if (!this.canSave()) return;
    const data = this.serialize();
    this.saved(this.store.saveLocal(data));
    if (cloud || this.cloudSoon) { this.store.saveCloud(data); this.lastCloud = this.time; this.cloudDirty = false; this.cloudSoon = false; }
  }
  // A save that did not go through (storage full or blocked): tell the player once per visit, not on every save.
  saved(ok) {
    if (ok !== false || this.saveWarned) return;
    this.saveWarned = true;
    try { this.hud.toast(`<b>Saving didn't work</b>This device's storage is full or blocked. To keep ${esc(this.Name)} safe, copy a save code in Settings.`, '', 7000); } catch (e) { console.error(e); }
  }
  updateSave(dt) {
    if (!this.canSave()) return;
    this.saveT -= dt;
    if (this.saveT <= 0) {
      this.saveT = 6;
      this.saved(this.store.saveLocal(this.serialize()));
    }
    if (this.cloudDirty && (this.cloudSoon ? this.time - this.lastCloud > 5 : this.time - this.lastCloud > 60)) {
      this.store.saveCloud(this.serialize());
      this.lastCloud = this.time;
      this.cloudDirty = false;
      this.cloudSoon = false;
    }
  }

  // Save safety: a frame with an error saves nothing; a few failed frames in a row (TROUBLE_FAILS; each clean frame
  // takes 0.1 off) stop all saving and show the hiccup card (Reload / Restore last good save).
  frameDone(dt, err) {
    const h = this.health;
    if (!err) {
      h.lastFailed = false;
      h.fails = Math.max(0, h.fails - 0.1);
      const ph = this.state.phase;
      if (ph === 'play' || ph === 'egg') {   // (the ranch keeps going while the egg waits; nothing to save while naming)
        try { this.updateSave(dt); } catch (e) { err = e; }
      }
      if (!err) return;
    }
    h.lastFailed = true;
    h.fails += 1;
    if (h.logged < 5) { h.logged++; console.error(err); }
    if (h.fails >= TROUBLE_FAILS && !this.trouble) this.showTrouble(err);
  }

  showTrouble(err) {
    this.trouble = true;
    let prev = null;
    try { prev = this.store.prevSave(); } catch { /* none */ }
    const name = esc((this.state && this.state.slime && this.state.slime.name) || 'Your slime');
    const buttons = [{ id: 'reload', label: 'Reload', primary: true, onClick: () => location.reload() }];
    if (prev) buttons.push({ id: 'restore', label: 'Restore last good save', onClick: () => { this.store.restorePrev(); location.reload(); } });
    showNotice({
      key: 'trouble',
      title: 'Oops, a hiccup!',
      body: `<p>Something in the game keeps going wrong. ${name} is safe: saving is paused, so nothing gets mixed up.</p><p>Reloading usually fixes it.${prev ? ` The last good save is from ${esc(agoText(prev.savedAt))}.` : ''}</p>`,
      buttons,
      note: 'Details: ' + String((err && (err.message || err)) || 'unknown').slice(0, 160),
    });
  }

  // The phone can take the 3D picture away when it is short on memory (iOS Safari does). The game keeps its place and
  // saves; a card offers a reload, and if the picture comes back by itself, carrying on.
  watchContext() {
    const c = this.canvas;
    if (!c || !c.addEventListener) return;
    c.addEventListener('webglcontextlost', e => {
      e.preventDefault();   // lets the browser give the picture back later
      this.glLost = true;
      this.saveNow(true);
      const name = esc(this.Name);
      this.glNotice = showNotice({
        key: 'gl',
        title: 'The picture fell asleep',
        body: `<p>The phone needed its graphics memory back for a moment. ${name} is safe and saved.</p><p>Reload to wake the picture up.</p>`,
        buttons: [{ id: 'reload', label: 'Reload', primary: true, onClick: () => location.reload() }],
      });
    });
    c.addEventListener('webglcontextrestored', () => {
      this.glLost = false;
      const name = esc(this.Name);
      this.glNotice?.set({
        title: 'The picture is back',
        body: `<p>${name} is right where you left them. If anything looks odd, reload.</p>`,
        buttons: [{ id: 'go', label: 'Carry on', primary: true, onClick: n => n.close() }, { id: 'reload', label: 'Reload', onClick: () => location.reload() }],
      });
    });
  }

  // How this visit started (main.js): a save that came back from a copy gets a short welcome; a save that could not be
  // read (and no copy that could) gets a gentle card. The unreadable text stays on this device (slimekin.save.broken).
  startNote() {
    const st = this.start;
    if (!st) return;
    if ((st.from === 'prev' || st.from === 'backup') && this.state.phase !== 'egg') {
      this.hud.toast(`<b>Welcome back, ${esc(this.Name)}!</b>Your save had a hiccup, so the game used the copy from ${esc(agoText(st.savedAt))}.`, 'love', 6000);
    } else if (st.from === 'prev' || st.from === 'backup') {
      this.hud.toast(`<b>Welcome back!</b>Your save had a hiccup, so the game used the copy from ${esc(agoText(st.savedAt))}.`, 'love', 6000);
    } else if (st.from === 'none' && st.broken) {
      showNotice({
        key: 'broken',
        title: 'Your old save could not be loaded',
        body: '<p>The save on this device was damaged, and there was no backup copy to bring back. So you are starting over with a new egg.</p><p>Nothing was deleted: the damaged save is kept safe on this device in case it can be fixed later.</p>',
        buttons: [
          { id: 'ok', label: 'Start with the new egg', primary: true, onClick: n => n.close() },
          { id: 'copy', label: 'Copy damaged save (for help)', onClick: async n => {
            let raw = '';
            try { raw = localStorage.getItem(BROKEN_KEY) || ''; } catch { /* blocked */ }
            const ok = raw && await copyText(raw);
            n.set({ body: `<p>${ok ? 'The damaged save is copied. Paste it into a message to whoever is helping you fix it.' : 'Copying did not work here.'}</p>`,
              buttons: [{ id: 'ok', label: 'OK', primary: true, onClick: m => m.close() }] });
          } },
        ],
      });
    }
  }
}
