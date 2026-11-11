// The Settings card, save codes (copy one, load one) and starting over with a new egg.
// A part of Game (src/mixin.js): `this` is the Game.
import { migrate } from '../core/sim.js';
import { esc } from '../ui/esc.js';
import { readSaveCode, makeSaveCode } from '../core/save-check.js';
import { DEBUG } from './shared.js';

export class SettingsPart {
  // ---------- settings ----------
  openSettings() {
    const st = this.state.settings;
    const seg = (key, opts) => `<span class="seg" role="group">${opts.map(([v, l]) => `<button data-k="${key}" data-v="${v}" aria-pressed="${String(st[key]) === String(v)}">${l}</button>`).join('')}</span>`;
    const debug = DEBUG ? `<div class="sec-title">Debug</div><div class="actions">
      <button class="btn" data-dbg="jelly">+10K jelly</button><button class="btn" data-dbg="mega">+10M jelly</button>
      <button class="btn" data-dbg="grow">+Growth</button><button class="btn" data-dbg="needs">Fill needs</button>
      <button class="btn" data-dbg="glim">Glimmer</button><button class="btn" data-dbg="req">Request</button><button class="btn" data-dbg="bond">+Bond</button>
      <button class="btn" data-dbg="tera">+1T jelly</button><button class="btn" data-dbg="pearls">+100 pearls</button>
      <button class="btn" data-dbg="instant" aria-pressed="${this.debugInstant}">Instant eggs: ${this.debugInstant ? 'On' : 'Off'}</button>
      <button class="btn" data-dbg="rlLessons">Finish lessons</button><button class="btn" data-dbg="rlTrips">Bring travelers home</button>
      <button class="btn" data-dbg="contests">Contest stars</button></div>
      ${this.bodyDebugHtml()}
      ${this.movingDayDebugHtml()}` : '';
    this.hud.openModal(`<h2>Settings</h2>
      <div class="setting"><span>Sound</span>${seg('sound', [[true, 'On'], [false, 'Off']])}</div>
      <div class="setting"><span>Music box lullaby</span>${seg('music', [[true, 'On'], [false, 'Off']])}</div>
      <div class="setting"><span>Happy hum while petting</span>${seg('purr', [[true, 'On'], [false, 'Off']])}</div>
      ${navigator.audioSession ? `<div class="setting"><span>Sound when phone is on silent</span>${seg('soundOnSilent', [[true, 'On'], [false, 'Off']])}</div>` : ''}
      <div class="setting"><span>Sound check<br><span class="sub" id="audioStatus">${esc(this.sfx.status())}</span></span><button class="btn small" id="testSound">Test sound</button></div>
      <div class="setting"><span>Background<br><span class="sub">${this.home.room.failed && st.scene === 'greenhouse' ? 'The Greenhouse could not load here, so the meadow shows for now.' : 'In the Greenhouse, the camera button and a drag on the background turn the view. Classic is just your slime.'}</span></span>${seg('scene', [['greenhouse', 'Greenhouse'], ['meadow', 'Meadow'], ['classic', 'Classic']])}</div>
      <div class="setting"><span>Motion</span>${seg('reducedMotion', [[false, 'Full'], [true, 'Reduced']])}</div>
      <div class="setting"><span>Graphics</span>${seg('quality', [['auto', 'Auto'], ['high', 'High'], ['low', 'Low']])}</div>
      <div class="setting"><span>Speed meter</span>${seg('showFps', [[false, 'Off'], [true, 'On']])}</div>
      <div class="setting"><span>Notifications<br><span class="sub">Drag one up or down to move them. Tap or swipe sideways to dismiss.</span></span>${typeof st.toastY === 'number' ? '<button class="btn small" id="toastReset">Reset spot</button>' : ''}</div>
      <p class="sub">Progress saves on this device${this.store.cloudOk ? ' and to your Claude account' : ''}. Nothing bad happens to ${esc(this.Name)} while you are away.</p>
      <div class="sec-title">Move to another device</div>
      <p class="sub">Copy a save code here, then load it on your other device (for example the home-screen app on your phone).</p>
      <div class="actions"><button class="btn" id="copySave">Copy save code</button><button class="btn" id="loadSave">Load a save code</button></div>
      ${debug}
      <div class="actions"><button class="btn primary" id="setDone">Done</button><button class="btn" id="setReset">Start a new egg</button></div>`, {
      onOpen: card => {
        for (const b of card.querySelectorAll('.seg button')) {
          b.addEventListener('click', () => {
            const k = b.dataset.k;
            let v = b.dataset.v;
            if (v === 'true') v = true; else if (v === 'false') v = false;
            st[k] = v;
            this.applySettings();
            this.markDirty(true);
            this.openSettings();
          });
        }
        card.querySelector('#setDone').addEventListener('click', () => this.hud.closeModal());
        card.querySelector('#setReset').addEventListener('click', () => this.confirmReset());
        card.querySelector('#testSound').addEventListener('click', () => {
          this.sfx.test();
          const el = card.querySelector('#audioStatus');
          for (const ms of [150, 800, 1600]) setTimeout(() => { el.textContent = this.sfx.status(); }, ms);
        });
        card.querySelector('#toastReset')?.addEventListener('click', () => { delete st.toastY; this.hud.applyToastPos(); this.markDirty(true); this.openSettings(); });
        card.querySelector('#copySave').addEventListener('click', () => this.copySaveCode());
        card.querySelector('#loadSave').addEventListener('click', () => this.loadSaveCode());
        for (const b of card.querySelectorAll('[data-dbg]')) b.addEventListener('click', () => this.debug(b.dataset.dbg));
      },
    });
  }

  saveCode() {
    return makeSaveCode(this.serialize());
  }

  copySaveCode() {
    const code = this.saveCode();
    const show = copied => this.hud.openModal(`<h2>${copied ? 'Save code copied' : 'Your save code'}</h2>
      <p>${copied ? `Paste it on your other device: Settings, then Load a save code.` : 'Select all of this text and copy it, then paste it on your other device: Settings, then Load a save code.'}</p>
      <textarea class="save-code" id="saveCodeOut" readonly>${esc(code)}</textarea>
      <div class="actions"><button class="btn primary" id="codeDone">Done</button></div>`, {
      onOpen: card => {
        const ta = card.querySelector('#saveCodeOut');
        ta.addEventListener('focus', () => ta.select());
        card.querySelector('#codeDone').addEventListener('click', () => this.hud.closeModal());
      },
    });
    try {
      navigator.clipboard.writeText(code).then(() => show(true), () => show(false));
    } catch { show(false); }
  }

  // Save safety: a code is checked (core/save-check.js: an empty, cut or changed code, or one that holds no slime, is
  // refused with a clear message), then the game asks before it replaces the slime here; the replaced one is kept as
  // this device's previous good save (slimekin.save.prev).
  loadSaveCode() {
    this.hud.openModal(`<h2>Load a save code</h2>
      <p>Paste a code copied from Settings on your other device. The game shows which slime it holds before anything changes.</p>
      <textarea class="save-code" id="saveCodeIn" placeholder="SLIMEKIN1:..." autofocus></textarea>
      <p class="sub code-msg" id="codeMsg" role="status"></p>
      <div class="actions"><button class="btn primary" id="codeLoad">Load</button><button class="btn" id="codeCancel">Cancel</button></div>`, {
      onOpen: card => {
        card.querySelector('#codeCancel').addEventListener('click', () => this.hud.closeModal());
        card.querySelector('#codeLoad').addEventListener('click', () => {
          const r = readSaveCode(card.querySelector('#saveCodeIn').value);
          if (!r.ok) {
            const msg = card.querySelector('#codeMsg');
            msg.textContent = r.msg;
            msg.classList.add('bad');
            this.sfx.error();
            return;
          }
          this.confirmLoadCode(r.save);
        });
      },
    });
  }

  confirmLoadCode(code) {
    const save = migrate(code);
    const st = this.state;
    const who = s => (s.phase === 'egg' || !s.slime.name ? (s.phase === 'egg' ? 'your egg' : 'your slime') : s.slime.name);
    const mine = esc(who(st)), Mine = mine.charAt(0).toUpperCase() + mine.slice(1);
    const gen = save.ranch.family.generation;
    const theirs = `${save.phase === 'egg' ? 'an egg' : esc(save.slime.name || 'a slime')} (generation ${gen}${save.ranch.residents.length ? `, ${save.ranch.residents.length} on the ranch` : ''})`;
    this.hud.openModal(`<h2>Replace ${mine}?</h2>
      <p>This code holds ${theirs}. It takes ${mine}'s place on this device.</p>
      <p>${Mine} is kept as this device's last good save, just in case.</p>
      <div class="actions"><button class="btn primary" id="codeKeep">Keep ${mine}</button><button class="btn danger" id="codeReplace">Replace ${mine}</button></div>`, {
      onOpen: card => {
        card.querySelector('#codeKeep').addEventListener('click', () => this.hud.closeModal());
        card.querySelector('#codeReplace').addEventListener('click', async () => {
          this.saveNow();                    // the slime here as it is right now...
          this.resetting = true;             // ...then nothing more is saved from this page
          save.savedAt = Date.now();
          if (!this.store.replaceWith(save)) {   // (it becomes .prev inside replaceWith)
            this.resetting = false;
            this.hud.showSimple('That did not work', '<p>This device would not save the new slime (its storage may be full). Nothing was changed.</p>');
            return;
          }
          try { await Promise.race([this.store.saveCloud(save), new Promise(res => setTimeout(res, 2500))]); } catch { /* the local copy is what counts */ }
          location.reload();
        });
      },
    });
  }

  confirmReset() {
    const name = esc(this.Name);
    this.hud.openModal(`<h2>Start over with a new egg?</h2><p>This erases ${name}'s save, memories and helpers on this device${this.store.cloudOk ? ' and in your Claude account' : ''}. It can't be undone.</p>
      <div class="actions"><button class="btn primary" id="keep">Keep ${name}</button><button class="btn danger" id="reset">Erase and start over</button></div>`, {
      onOpen: card => {
        card.querySelector('#keep').addEventListener('click', () => this.hud.closeModal());
        card.querySelector('#reset').addEventListener('click', async () => {
          this.resetting = true;
          this.store.clearLocal();
          await this.store.clearCloud();
          location.reload();
        });
      },
    });
  }
}
