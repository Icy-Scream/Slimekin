// Coming back: the welcome-back moment and card (what the Jelly Jar and the ranch made while you were away), and
// returning to the game after the phone hid it. A part of Game (src/mixin.js): `this` is the Game.
import { JAR_LEVELS } from '../data/content.js';
import { fmt, fmtDuration } from '../core/format.js';
import { esc } from '../ui/esc.js';

export class WelcomePart {
  welcomeBack() {
    const st = this.state;
    const away = (Date.now() - (st.savedAt || Date.now())) / 1000;
    this.behave.morningCheck();
    if (away < 45) return;
    if (this.behave.learned('wave')) this.after(2.2, () => this.behave.perform('wave'));
    const jar = this.sim.fillJar(away);
    st.stats.visits++;
    if (away > 600) this.sim.addBond(2);
    const name = this.Name;
    const bond = this.sim.bondLevel();
    this.after(0.6, () => {
      this.flash({ eyes: 'sparkle', mouth: 'grin', blush: 1 }, 2.2);
      this.sfx.mii();
      this.slime.hop(5);
      this.hud.say(bond >= 3 ? '!!! ♥' : '!!', 2000);
      if (bond >= 3) { this.dance(2.4); this.after(0.7, () => this.slime.spin()); }
      this.fx.emit('hearts', this.slime.headTopWorld(this.v1), { count: 6 });
    });
    if (away > 120) this.after(1.2, () => this.showWelcome(away, jar));
  }

  showWelcome(away, jar) {
    const name = this.Name;
    const st = this.state;
    const lvl = JAR_LEVELS[st.jar.level];
    let jarHtml = '';
    if (st.jar.stored > 0) {
      jarHtml = `<div class="card"><div class="row-between"><b>Jelly Jar</b><span class="sub">Level ${st.jar.level + 1}</span></div>
        <span class="form-name">${fmt(st.jar.stored)} jelly</span>
        <span class="sub">Your helpers kept working and the jar caught ${Math.round(lvl.rate * 100)}% of it${jar.full ? `, until it filled up after ${lvl.hours} hours` : ''}.${jar.full && JAR_LEVELS[st.jar.level + 1] ? ' A bigger jar (Shop → Upgrades) catches more.' : ''}</span></div>`;
    }
    let ranchHtml = '';
    if (this.ranchAway && this.ranchAway.pearls > 0) {
      ranchHtml = `<div class="card"><div class="row-between"><b>The ranch</b><span class="sub">${st.ranch.basket.stored} / ${this.sim.ranch.basketCap()}</span></div><span class="sub">Your ranch slimes made <b>${this.ranchAway.pearls}</b> pearl${this.ranchAway.pearls === 1 ? '' : 's'}. They're waiting in the Pearl Basket${this.ranchAway.full ? ' (it filled up)' : ''}.</span></div>`;
      this.ranchAway = null;
    }
    const body = `<p>You were away for ${fmtDuration(away)}. Nothing bad happened while you were gone. ${esc(name)} just waited for you.</p>${jarHtml}${ranchHtml}`;
    if (st.jar.stored > 0) {
      this.hud.openModal(`<h2>${esc(name)} missed you!</h2>${body}<div class="actions"><button class="btn primary" id="pourBtn">Pour it out</button></div>`, {
        onOpen: card => card.querySelector('#pourBtn').addEventListener('click', ev => { const r = ev.currentTarget.getBoundingClientRect(); this.hud.closeModal(); this.collectJar(r); }),
      });
    } else this.hud.showSimple(`${esc(name)} missed you!`, body, `Hi, ${name}!`);
  }

  onVisibility() {
    if (document.hidden) {
      this.hiddenAt = Date.now();
      this.saveNow(true);
      this.sfx.suspend();
      this.sfx.purr(false);
    } else {
      this.sfx.resume();
      this.behave.morningCheck();
      if (this.hiddenAt) {
        const ra = this.life.passTime((Date.now() - this.hiddenAt) / 1000);   // (ranch life too)
        if (ra.pearls > 0 && this.state.phase === 'play') this.hud.toast(`<b>The ranch made ${ra.pearls} pearl${ra.pearls === 1 ? '' : 's'}</b>They're waiting in the Pearl Basket.`, '', 3200);
        this.checkPostcards();
      }
      if (this.hiddenAt && this.state.phase === 'play') {
        const away = (Date.now() - this.hiddenAt) / 1000;
        if (away > 30) {
          const jar = this.sim.fillJar(away);
          if (away > 300) {
            this.flash({ eyes: 'sparkle', mouth: 'grin', blush: 1 }, 1.8);
            this.slime.hop(5);
            this.sfx.mii();
            this.hud.say('You came back! ♥', 1800);
            if (jar.gained > 0) this.hud.toast(`<b>The Jelly Jar caught ${fmt(jar.gained)}</b>Tap the jar under your jelly count to pour it out.`);
          }
        }
      }
      this.hiddenAt = null;
      this.last = performance.now();
    }
  }
}
