// Requests: the slime asks for a snack, pets, a nap or play; the bubble's text and buttons, and the answers.
// A part of Game (src/mixin.js): `this` is the Game.
import { FOOD_BY_ID } from '../data/content.js';
import { fmtShort } from '../core/format.js';
import { an, clamp } from './shared.js';

export class RequestsPart {
  // ---------- requests ----------
  requestView(r) {
    const name = this.Name;
    if (r.type === 'craving') {
      const f = FOOD_BY_ID[r.food];
      const price = fmtShort(this.sim.foodPrice(r.food));
      if (r.waiting) return { icon: r.food, text: `${name} is waiting patiently...`, options: [], timer: true };
      if (r.waited) return { icon: r.food, text: `${name} waited so well! Give them the ${f.name} now?`, options: [{ id: 'give', label: `Give it (${price})`, primary: true }, { id: 'later', label: 'Maybe later' }], timer: true };
      return { icon: r.food, text: `${name} wants ${an(f.name)}!`, options: [{ id: 'give', label: `Give it (${price})`, primary: true }, { id: 'wait', label: 'Ask to wait' }, { id: 'play', label: 'Play instead' }], timer: true };
    }
    if (r.type === 'pets') return { text: `${name} wants some pets! Hold and stroke them.`, options: [{ id: 'later', label: 'Not now' }], timer: true };
    if (r.type === 'sleepy') return { text: `${name} is getting sleepy...`, options: [{ id: 'tuck', label: 'Tuck them in', primary: true }, { id: 'later', label: 'Not yet' }], timer: true };
    return { text: `${name} wants to play!`, options: [{ id: 'play', label: "Let's play!", primary: true }, { id: 'later', label: 'Later' }], timer: true };
  }

  updateRequests(dt) {
    const can = this.state.tutorial >= 3 && !this.sim.asleep && !this.busy() && !this.hud.modalOpen && !this.bubbleGame && this.sim.dizzy <= 0;
    const ev = this.requests.tick(dt, can);
    if (ev) {
      if (ev.event === 'new') {
        this.hud.showAsk(ev.req, this.requestView(ev.req));
        this.sfx.question();
        this.slime.hop(2.5);
      } else if (ev.event === 'waited') {
        const s = this.state.slime;
        this.sim.nudge('patient', 3);
        s.joy = clamp(s.joy + 3, 0, 100);
        const b = this.sim.addBond(6);
        if (b) this.onBondUp(b);
        this.hud.showAsk(ev.req, this.requestView(ev.req));
        this.flash({ eyes: 'sparkle', mouth: 'open', blush: 0.9 }, 1.2);
        this.hud.say('I waited!', 1300);
        this.sfx.mii();
        this.remember('⏳', `${this.Name} learned to wait patiently.`, 'waited');
      } else if (ev.event === 'expired') {
        this.hud.hideAsk();
        const s = this.state.slime;
        s.joy = clamp(s.joy - 4, 0, 100);
        this.sim.nudge('bold', -0.5);
        this.flash({ eyes: 'normal', mouth: 'pout', brows: 'sad' }, 1.6);
        this.hud.say('...okay', 1300);
        this.sfx.sad();
      }
    }
    const r = this.requests.active;
    if (r && this.hud.askEl) this.hud.setAskTimer(r.waiting ? r.waitLeft / 10 : 1 - r.age / r.ttl);
  }

  answerRequest(opt) {
    const r = this.requests.active;
    if (!r) return;
    this.sfx.unlock();
    const s = this.state.slime;
    const st = this.state;
    const name = this.Name;
    const done = () => { this.requests.clear(); this.hud.hideAsk(); st.stats.requests++; this.markDirty(true); };
    if (r.type === 'craving') {
      if (opt === 'give') { this.tossFood(r.food, null); return; }
      if (opt === 'wait') {
        r.waiting = true; r.waitLeft = 10;
        this.hud.showAsk(r, this.requestView(r));
        this.flash({ eyes: 'normal', mouth: 'pout', brows: 'determined' }, 1.2);
        this.hud.say('...!', 1000);
        return;
      }
      if (opt === 'play') {
        done();
        this.sim.nudge('curious', 2); this.sim.nudge('playful', 2);
        this.remember('🫧', `Instead of a snack, you and ${name} played with bubbles.`, 'req-play');
        this.startBubblePlay();
        return;
      }
      if (opt === 'later') { done(); this.sim.nudge('patient', 1); this.flash({ mouth: 'pout', eyes: 'normal' }, 1); return; }
    }
    if (r.type === 'sleepy') {
      done();
      if (opt === 'tuck') {
        this.sim.nudge('cuddly', 1); this.sim.nudge('patient', 1);
        const b = this.sim.addBond(3); if (b) this.onBondUp(b);
        this.fx.emit('hearts', this.slime.headTopWorld(this.v1), { count: 3 });
        this.fallAsleep('tucked');
      } else { this.sim.nudge('bold', 1); this.flash({ eyes: 'normal', mouth: 'yawn', eyeOpen: 0.5 }, 1.2); this.sfx.yawn(); }
      return;
    }
    if (r.type === 'play') {
      done();
      if (opt === 'play') { this.sim.nudge('playful', 3); const b = this.sim.addBond(2); if (b) this.onBondUp(b); this.startBubblePlay(); }
      else { this.sim.nudge('patient', 2); this.sim.nudge('playful', -1); this.flash({ mouth: 'pout', eyes: 'normal' }, 1.2); }
      return;
    }
    if (r.type === 'pets') { done(); this.sim.nudge('cuddly', -1); this.sim.nudge('bold', 0.5); this.flash({ mouth: 'pout', eyes: 'normal' }, 1.2); }
  }

  fulfillPets() {
    this.requests.clear();
    this.hud.hideAsk();
    const s = this.state.slime;
    this.state.stats.requests++;
    s.joy = clamp(s.joy + 8, 0, 100);
    this.sim.nudge('cuddly', 3);
    const b = this.sim.addBond(6);
    if (b) this.onBondUp(b);
    this.hud.say('♥♥♥', 1400);
    this.fx.emit('hearts', this.slime.headTopWorld(this.v1), { count: 6 });
    this.remember('🤲', `${this.Name} asked for pets, and you gave them plenty.`, 'req-pets');
  }
}
