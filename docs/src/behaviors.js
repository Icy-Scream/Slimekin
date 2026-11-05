// Personality layer: gestures (pull, hug, shake, rub, flick, tickle, high five, face pokes),
// emotes the slime learns by copying you, small life moments (hiccups, burps, daydreams,
// morning stretch), playing with the room, and hidden secrets.
import * as THREE from 'three';
import { EMOTES, TRICK_LEARNED, SECRETS, FOOD_BY_ID } from './data/content.js';
import { fmt } from './core/format.js';
import { esc } from './ui/hud.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];

export class Behaviors {
  constructor(game) {
    this.g = game;
    this.v = new THREE.Vector3();
    this.v2 = new THREE.Vector3();
    this.v3 = new THREE.Vector3();
    this.shake = { rev: [], lastSign: 0, until: -1, time: 0, sfxT: 0, said: false };
    this.turn = 0; this.lastPetVec = null; this.turnT = 0;
    this.sideTaps = []; this.headTaps = []; this.eyePokes = [];
    this.grumpyUntil = -1; this.warPokes = 0;
    this.highFive = null; this.hfCooldown = 0;
    this.hiccups = null; this.lastHiccup = -999; this.feedTimes = [];
    this.lastBurp = -999;
    this.emoteBusy = -1;
    this.typed = ''; this.konami = 0;
    this.rainbowUntil = -1; this.rainbowT = 0;
    this.melting = -1; this.tickleUntil = -1; this.tickleCooldown = 0;
    this.nomUntil = -1; this.nomCooldown = 0;
    this.peekUntil = -1; this.singUntil = -1;
    this.danceBreakT = 30;
    this.dreamT = 6;
    this.introT = 0;
    this.hugT = 0; this.hugHeartT = 0;
    this.rainbowColor = new THREE.Color();
  }

  get time() { return this.g.time; }
  get s() { return this.g.state.slime; }
  say(t, ms) { this.g.hud.say(t, ms); }

  // ---------- secrets ----------
  secret(id) {
    const g = this.g, st = g.state;
    if (st.secrets.includes(id)) return false;
    st.secrets.push(id);
    const def = SECRETS.find(x => x.id === id);
    g.hud.toast(`<b>Secret found: ${esc(def.name)}</b>${st.secrets.length} of ${SECRETS.length} secrets discovered.`, 'combo', 4200);
    g.sfx.sparkle();
    g.fx.emit('sparkles', g.slime.headTopWorld(this.v), { count: 14, rainbow: true });
    g.remember('🔮', `Secret found: ${def.name}. ${def.text}`, 'secret-' + id);
    const b = g.sim.addBond(3);
    if (b) g.onBondUp(b);
    g.hud.dot('journal');
    g.markDirty(true);
    return true;
  }

  // ---------- time of day ----------
  hour() { return new Date().getHours(); }
  isNight() { const h = this.hour(); return h >= 21 || h < 5; }
  isMorning() { const h = this.hour(); return h >= 5 && h < 11; }

  morningCheck() {
    const g = this.g, st = g.state;
    if (st.phase !== 'play' || !this.isMorning()) return;
    const key = new Date().toDateString();
    if (st.lastMorning === key) return;
    st.lastMorning = key;
    g.after(1.6, () => {
      if (g.sim.asleep) g.wakeUp('rested');
      g.slime.stretch(1.8);
      g.sfx.yawn();
      g.flash({ eyes: 'sleep', mouth: 'yawn' }, 1.2);
      g.after(1.3, () => {
        this.say('Good morning! ☀', 1900);
        g.flash({ eyes: 'sparkle', mouth: 'grin', blush: 0.8 }, 1.4);
        g.sfx.mii();
        g.slime.hop(4);
      });
      g.remember('☀️', `Your first morning together with ${g.Name}.`, 'morning1');
    });
  }

  // ---------- pointer gestures ----------
  onPressStart(p, hit, region) {
    p.mode = 'tap';
    p.sx = p.x; p.sy = p.y;
    p.grab = hit.point.clone();
    p.region = region;
    this.lastPetVec = null;
  }

  onPressMove(p, dx, dy) {
    const g = this.g;
    if (p.mode === 'snapped' || p.mode === 'hug') return;
    // Shake: fast left-right reversals.
    if (Math.abs(dx) > 8) {
      const sign = Math.sign(dx);
      if (this.shake.lastSign && sign !== this.shake.lastSign) this.shake.rev.push(this.time);
      this.shake.lastSign = sign;
    }
    this.shake.rev = this.shake.rev.filter(t => this.time - t < 0.9);
    if (this.shake.rev.length >= 4 && !g.sim.asleep) {
      this.shake.until = this.time + 0.35;
      g.slime.leanX.v += clamp(dx, -40, 40) * 0.06;
    }

    if (p.mode === 'tap' && p.moved > 16) {
      p.mode = p.over || g.sim.asleep ? 'pet' : 'pull';
      if (p.mode === 'pull') this.startPull(p);
    }
    if (p.mode === 'pet') {
      // Rubbing in circles: add up how much the stroke direction turns.
      if (Math.hypot(dx, dy) > 2) {
        if (this.lastPetVec) {
          const [lx, ly] = this.lastPetVec;
          const a = Math.atan2(lx * dy - ly * dx, lx * dx + ly * dy);
          if (Math.abs(a) < 1.2) this.turn += a;
        }
        this.lastPetVec = [dx, dy];
        this.turnT = this.time;
      }
      if (Math.abs(this.turn) > Math.PI * 6 && this.melting < this.time && !g.sim.asleep) this.melt();
      if (!p.over && Math.hypot(p.x - p.sx, p.y - p.sy) > 70 && !g.sim.asleep) { p.mode = 'pull'; this.startPull(p); }
    }
    if (p.mode === 'pull') this.updatePull(p);
  }

  onPressUp(p, cancel) {
    const g = this.g;
    if (p.mode === 'pull') this.endPull(false);
    else if (p.mode === 'hug') this.endHug();
    else if (!cancel && (p.mode === 'tap' || p.mode === 'pet')) {
      const dur = this.time - p.t;
      const dxT = p.x - p.sx, dyT = p.y - p.sy;
      if (dur < 0.45 && Math.abs(dxT) > 80 && Math.abs(dyT) < Math.abs(dxT) * 0.7 && !g.sim.asleep) this.flickSpin(Math.sign(dxT));
    }
    this.lastPetVec = null;
  }

  // Taffy pull
  startPull(p) {
    const g = this.g;
    g.slime.grab(p.grab);
    const n = g.stage.camera.getWorldDirection(this.v).negate();
    this.pullPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, p.grab);
    this.pullMax = 0;
    g.sfx.stretch();
    g.sfx.purr(false);
  }
  updatePull(p) {
    const g = this.g, sl = g.slime;
    if (!g.raycaster.ray.intersectPlane(this.pullPlane, this.v2)) return;
    const a = sl.body.worldToLocal(this.v2.clone());
    const b = sl.body.worldToLocal(p.grab.clone());
    const d = a.sub(b);
    const len = d.length();
    const max = 0.95;
    const eff = max * (1 - Math.exp(-len / max));
    if (len > 0.0001) d.setLength(eff);
    sl.pullTo(d);
    this.pullMax = Math.max(this.pullMax, eff);
    if (len > 2.6) { p.mode = 'snapped'; this.endPull(true); }
  }
  endPull(snapped) {
    const g = this.g, sl = g.slime;
    sl.release();
    sl.kick(0.07);
    sl.squish(0.7);
    g.sfx.boing();
    if (snapped) { g.sfx.snap(); this.say('Boing!', 900); }
    g.flash({ eyes: 'happy', mouth: 'grin', blush: 0.8 }, 1.0);
    g.after(0.2, () => g.sfx.giggle());
    if (this.pullMax > 0.25) {
      const gain = g.sim.boopValue() * (1 + this.pullMax * 4);
      g.sim.addJelly(gain);
      g.hud.floatText(g.pointerPx.x, g.pointerPx.y - 10, '+' + fmt(gain));
    }
    if (this.pullMax > 0.4) this.secret('taffy');
    g.lastInteract = this.time;
  }

  // Hug (press and hold still)
  startHug() {
    const g = this.g;
    this.hugT = 0;
    g.sfx.coo();
    g.lastInteract = this.time;
  }
  updateHug(dt) {
    const g = this.g;
    this.hugT += dt;
    g.sfx.purr(true);
    const r = g.sim.pet(dt);
    if (r.bondUp) g.onBondUp(r.bondUp);
    this.hugHeartT -= dt;
    if (this.hugHeartT <= 0) {
      this.hugHeartT = 0.4;
      g.fx.emit('hearts', g.slime.headTopWorld(this.v), { count: 1 });
    }
    if (this.hugT > 1.4) this.secret('hug');
  }
  endHug() {
    const g = this.g;
    g.sfx.purr(false);
    g.slime.stretch(1.6);
    if (this.hugT > 0.6) { g.sfx.mii(); this.say('♥', 900); }
  }

  melt() {
    const g = this.g;
    this.melting = this.time + 3.4;
    this.turn = 0;
    g.sfx.coo();
    this.say('~♥~', 1400);
    this.secret('melt');
    if (this.s.energy < 50) g.after(3.2, () => g.fallAsleep('melted'));
  }

  flickSpin(dir) {
    const g = this.g;
    g.slime.spin(dir);
    g.sfx.whee();
    g.flash({ eyes: 'happy', mouth: 'grin', blush: 0.8 }, 0.7);
    g.after(0.75, () => g.flash({ eyes: 'dizzy', mouth: 'wavy' }, 0.7));
    this.say('Wheee!', 900);
    this.secret('spin');
  }

  // ---------- boop hooks ----------
  onBoop(point, region, r) {
    const g = this.g;
    if (r.dizzy || r.becameDizzy || r.asleep) return;
    const dir = g.slime.localDir(point, this.v3);
    if (this.hiccups && Math.random() < 0.4) { this.cureHiccups(); return; }
    if (region === 'eyeL' || region === 'eyeR') this.eyePoke(region);
    else if (region === 'mouth') this.nom();
    else if (region === 'cheekL' || region === 'cheekR') g.flash({ eyes: 'happy', mouth: 'cat', blush: 1 }, 0.45);
    if (Math.abs(dir.x) > 0.72 && dir.y < 0.5) this.sideTickle();
    if (dir.y > 0.45) {
      this.headTaps.push(this.time);
      this.headTaps = this.headTaps.filter(t => this.time - t < 0.45);
      if (this.headTaps.length >= 2 && !this.highFive && this.time > this.hfCooldown) { this.headTaps = []; this.offerHighFive(); }
    }
  }

  eyePoke(region) {
    const g = this.g;
    this.eyePokes.push(this.time);
    this.eyePokes = this.eyePokes.filter(t => this.time - t < 6);
    g.flash({ [region]: 'wince', mouth: 'o', blush: 0.4 }, 0.5);
    g.sfx.ow();
    if (this.grumpyUntil > this.time) {
      this.warPokes++;
      if (this.warPokes >= 2) this.pokeBack();
    } else if (this.eyePokes.length >= 3) {
      this.grumpyUntil = this.time + 5;
      this.warPokes = 0;
      this.say('Hey! Not the eyes!', 1500);
      g.sfx.hey();
      g.slime.leanZ.v -= 1.6;
    } else if (Math.random() < 0.35) this.say('Ow!', 700);
  }

  pokeBack() {
    const g = this.g, sl = g.slime;
    this.grumpyUntil = -1;
    this.eyePokes = [];
    this.warPokes = 0;
    sl.nub('poke', this.v.set(0, 0.18, 1), 0.6, { snap: 9 });
    g.after(0.28, () => sl.nubIn('poke'));
    g.after(0.12, () => { g.stage.shake(0.14); g.sfx.boop(1.4); });
    this.say('Boop!', 1000);
    g.flash({ eyes: 'happy', mouth: 'grin', blush: 0.9 }, 1.1);
    g.after(0.4, () => g.sfx.giggle());
    this.secret('pokewar');
  }

  nom() {
    const g = this.g;
    if (this.time < this.nomCooldown) return;
    this.nomCooldown = this.time + 1.2;
    this.nomUntil = this.time + 0.6;
    g.sfx.nom();
    if (Math.random() < 0.5) this.say('Nom!', 700);
    this.secret('nom');
  }

  sideTickle() {
    const g = this.g;
    this.sideTaps.push(this.time);
    this.sideTaps = this.sideTaps.filter(t => this.time - t < 1.6);
    g.flash({ eyes: 'happy', mouth: 'grin', blush: 0.8 }, 0.45);
    g.sfx.tickle();
    if (this.sideTaps.length >= 4 && this.time > this.tickleCooldown) {
      this.sideTaps = [];
      this.tickleCooldown = this.time + 6;
      this.tickleUntil = this.time + 1.8;
      [0, 0.35, 0.7, 1.1].forEach(d => g.after(d, () => g.sfx.giggle()));
      g.slime.hop(4);
      g.after(0.6, () => g.slime.hop(3));
      this.say('Hahaha! Stop!', 1400);
      g.flash({ eyes: 'happy', mouth: 'grin', blush: 1, tears: true }, 1.8);
      this.secret('tickle');
    }
  }

  offerHighFive() {
    const g = this.g;
    const side = Math.random() < 0.5 ? -1 : 1;
    this.highFive = { until: this.time + 3.6, side };
    g.slime.nub('hand', this.v.set(0.9 * side, 0.32, 0.3), 0.46, { snap: 5 });
    this.say('High five!', 1500);
    g.sfx.hi();
    this.hfCooldown = this.time + 9;
  }
  tryHighFive(raycaster) {
    if (!this.highFive) return false;
    const g = this.g;
    const tip = g.slime.nubTipWorld('hand', this.v);
    if (!tip) return false;
    const r = 0.22 + 0.22 * g.slime.size;
    if (raycaster.ray.distanceSqToPoint(tip) > r * r) return false;
    this.highFive = null;
    g.slime.nub('hand', g.slime.nubs.hand.base, 0.2, { snap: -6 });
    g.after(0.2, () => g.slime.nubIn('hand'));
    g.sfx.slap();
    g.fx.emit('sparkles', tip, { count: 14 });
    g.slime.hop(4.5);
    g.flash({ eyes: 'happy', mouth: 'grin', blush: 1 }, 1.2);
    this.say('Yeah!', 1000);
    const b = g.sim.addBond(2);
    if (b) g.onBondUp(b);
    this.secret('highfive');
    g.lastInteract = this.time;
    return true;
  }

  // ---------- feeding hooks ----------
  onFed(r, tummyBefore) {
    const g = this.g;
    this.feedTimes.push(this.time);
    this.feedTimes = this.feedTimes.filter(t => this.time - t < 14);
    if (this.feedTimes.length >= 3 && !this.hiccups && this.time - this.lastHiccup > 45) g.after(1.8, () => this.startHiccups());
    if (tummyBefore < 88 && this.s.tummy >= 90 && this.time - this.lastBurp > 60) {
      this.lastBurp = this.time;
      g.after(2.3, () => this.burp());
    }
    const h = this.hour();
    if (h >= 0 && h < 4) g.after(1.6, () => this.secret('midnight'));
  }

  startHiccups() {
    if (this.g.sim.asleep) return;
    this.hiccups = { until: this.time + 9, next: this.time + 0.2 };
    this.lastHiccup = this.time;
  }
  cureHiccups() {
    const g = this.g;
    this.hiccups = null;
    g.flash({ eyes: 'wide', mouth: 'o' }, 0.6);
    this.say('!', 600);
    g.after(0.7, () => { this.say('Thanks! They stopped!', 1500); g.flash({ eyes: 'happy', mouth: 'grin' }, 1); g.sfx.mii(); });
    this.secret('hiccup');
  }
  burp() {
    const g = this.g;
    if (g.sim.asleep) return;
    g.sfx.burp();
    g.fx.emit('steam', g.slime.mouthWorld(this.v), { count: 3, size: 0.18 });
    g.slime.squish(0.6);
    g.flash({ eyes: 'happy', mouth: 'o', blush: 1 }, 1.5);
    g.after(0.5, () => this.say('Oops! Excuse me...', 1500));
    this.secret('burp');
  }

  // ---------- keyboard ----------
  onKey(e) {
    const g = this.g;
    const k = (e.key || '').toLowerCase();
    this.konami = (k === KONAMI[this.konami]) ? this.konami + 1 : (k === KONAMI[0] ? 1 : 0);
    if (this.konami === KONAMI.length) { this.konami = 0; this.rainbow(); return; }
    if (k.length === 1 && /[a-z0-9]/.test(k)) {
      this.typed = (this.typed + k).slice(-24);
      const name = (this.s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (name.length >= 2 && this.typed.endsWith(name)) { this.typed = ''; this.answerName(); }
    }
  }
  // Touch version of the cheat code: swipe on the background, then tap twice.
  onSwipe(dir) {
    const seq = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'tap', 'tap'];
    this.swipeStep = dir === seq[this.swipeStep || 0] ? (this.swipeStep || 0) + 1 : (dir === 'up' ? 1 : 0);
    if (this.swipeStep === seq.length) { this.swipeStep = 0; this.rainbow(); }
  }

  answerName() {
    const g = this.g;
    if (g.sim.asleep) g.wakeUp('called');
    g.lookOverride = { target: g.stage.camera.position.clone(), until: this.time + 1.8 };
    g.flash({ eyes: 'sparkle', mouth: 'open', blush: 0.9 }, 1.5);
    g.sfx.mii();
    g.slime.hop(4);
    this.say(Math.random() < 0.5 ? 'Yes? ♥' : '!!', 1300);
    this.secret('name');
  }
  rainbow() {
    const g = this.g;
    this.rainbowUntil = this.time + 30;
    g.sfx.rainbow();
    g.slime.spin(1);
    g.slime.hop(5);
    this.say('✨ Rainbow mode! ✨', 1800);
    this.secret('rainbow');
  }

  // ---------- emotes (it copies you, then learns) ----------
  emoteUnlocked(def) {
    const sim = this.g.sim;
    if (def.stage && sim.stageIndex() < def.stage) return false;
    if (def.bond && sim.bondLevel() < def.bond) return false;
    return true;
  }
  practice(id) { return this.s.tricks[id] || 0; }
  learned(id) { return this.practice(id) >= TRICK_LEARNED; }

  doEmote(id, fromEl) {
    const g = this.g;
    const def = EMOTES.find(e => e.id === id);
    g.sfx.unlock();
    if (!def) return;
    if (!this.emoteUnlocked(def)) { g.sfx.error(); g.hud.toast(`<b>${esc(def.name)}</b>${esc(def.lock)}.`); return; }
    if (g.sim.asleep) { g.hud.toast(`<b>Shh</b>${esc(g.Name)} is napping.`); return; }
    if (this.emoteBusy > this.time || g.busy()) return;
    this.emoteBusy = this.time + 2.6;
    g.lastInteract = this.time;
    const n = this.practice(id);
    const quality = n === 0 ? 'confused' : n < TRICK_LEARNED - 1 ? 'clumsy' : 'good';
    g.hud.playerEmote(def, fromEl);
    g.lookOverride = { target: g.stage.camera.position.clone(), until: this.time + 1 };
    let delay = 0.55;
    if (quality === 'confused') {
      delay = 1.2;
      g.after(0.45, () => { this.say('?', 700); g.sfx.question(); g.slime.roll.v += 2.5; });
    }
    g.after(delay, () => this.perform(id, quality));
    this.s.tricks[id] = n + 1;
    if (n + 1 === TRICK_LEARNED) {
      g.after(delay + 2.2, () => {
        g.remember('🎓', `${g.Name} learned to ${def.name.toLowerCase()}! Now they do it on their own sometimes.`, 'trick-' + id);
        g.hud.toast(`<b>${esc(g.Name)} learned a trick: ${esc(def.name)}</b>Watch for it when they're happy.`, 'love', 4000);
        g.sfx.sparkle();
        const b = g.sim.addBond(3);
        if (b) g.onBondUp(b);
        g.hud.dot('slime');
      });
    }
    g.markDirty(true);
  }

  perform(id, quality = 'good') {
    const g = this.g, sl = g.slime;
    if (g.sim.asleep) return;
    const good = quality === 'good';
    const flourish = good && g.sim.bondLevel() >= 5;
    switch (id) {
      case 'wave':
        sl.nub('wave', this.v.set(0.9, 0.32, 0.3), good ? 0.46 : 0.28, { wave: good ? 0.45 : 0.2, snap: 3 });
        g.sfx.hi();
        this.say(good ? 'Hi!' : 'hi...?', 1100);
        g.flash({ eyes: 'happy', mouth: 'open', blush: 0.7 }, 1.6);
        g.after(1.7, () => sl.nubIn('wave'));
        break;
      case 'dance':
        g.dance(good ? 3 : 1.6);
        g.sfx.giggle();
        g.flash({ eyes: 'happy', mouth: 'grin', blush: 0.8 }, good ? 3 : 1.6);
        for (let i = 0; i < (good ? 4 : 2); i++) g.after(i * 0.6, () => g.fx.emit('notes', sl.headTopWorld(this.v), { color: ['#b49bff', '#ff9fc6', '#8fd8ff'][i % 3] }));
        if (!good) g.after(1.3, () => { g.flash({ eyes: 'dizzy', mouth: 'wavy' }, 0.7); sl.roll.v += 3; });
        break;
      case 'kiss':
        if (good) {
          g.flash({ eyes: 'wink', mouth: 'kiss', blush: 1 }, 1.2);
          g.after(0.3, () => {
            g.sfx.kiss();
            g.fx.emit('hearts', sl.mouthWorld(this.v), { count: flourish ? 3 : 1, dir: new THREE.Vector3(0, 0.3, 2.4), size: 0.32 });
          });
        } else {
          g.flash({ eyes: 'sleep', mouth: 'kiss', blush: 1 }, 1.2);
          g.after(0.3, () => { g.sfx.kiss(); g.fx.emit('hearts', sl.mouthWorld(this.v), { count: 1, gravity: 3, up: 0.6, size: 0.24 }); });
        }
        break;
      case 'spin':
        sl.spin(1);
        g.sfx.whee();
        if (good) g.after(0.75, () => { g.flash({ eyes: 'sparkle', mouth: 'grin' }, 1); g.fx.emit('sparkles', sl.headTopWorld(this.v), { count: 10 }); });
        else g.after(0.75, () => g.flash({ eyes: 'dizzy', mouth: 'wavy' }, 0.9));
        break;
      case 'peekaboo': {
        const hide = good ? 1.3 : 1.6;
        this.peekUntil = this.time + hide;
        if (!good) g.after(0.6, () => { this.peekUntil = this.time + 0.25; g.after(0.35, () => { this.peekUntil = this.time + 0.6; }); });
        g.after(hide + (good ? 0 : 0.1), () => {
          this.peekUntil = -1;
          sl.stretch(2);
          sl.hop(4.5);
          g.flash({ eyes: 'sparkle', mouth: 'grin', blush: 0.9 }, 1.1);
          g.sfx.boo();
          this.say('Boo!', 900);
          g.after(0.35, () => g.sfx.giggle());
        });
        break;
      }
      case 'sing':
        this.singUntil = this.time + 1.8;
        g.sfx.sing(!good);
        for (let i = 0; i < 4; i++) g.after(i * 0.42, () => g.fx.emit('notes', sl.headTopWorld(this.v), { color: ['#ff9fc6', '#8fd8ff', '#ffd36b', '#b49bff'][i] }));
        if (!good) g.after(1.9, () => { g.flash({ eyes: 'happy', mouth: 'flat', blush: 1, sweat: true }, 1.2); this.say('...♪?', 900); });
        break;
    }
    if (flourish) g.after(1.9, () => { g.fx.emit('hearts', sl.headTopWorld(this.v), { count: 3 }); g.sfx.coo(); });
  }

  // ---------- playing with the room ----------
  onTickle(pos, f) {
    const g = this.g;
    if (g.sim.asleep || g.busy() || g.movingDay.active) return false;
    if (Math.random() > 0.3 + this.s.personality.playful / 250) return false;
    const dir = g.slime.localDir(pos, this.v).clone();
    dir.y = Math.max(dir.y, 0.15);
    g.slime.nub('swat', dir, 0.45, { snap: 8 });
    g.after(0.22, () => g.slime.nubIn('swat'));
    f.fling = 1; f.tickle = -1; f.ticked = false;
    g.sfx.tickle();
    g.flash({ eyes: 'happy', mouth: 'grin', blush: 0.7 }, 0.7);
    if (Math.random() < 0.4) this.say('Got it!', 800);
    return true;
  }

  popNearbyBubble(b) {
    const g = this.g, sl = g.slime;
    g.lookOverride = { target: b.m.position, until: this.time + 1.2 };
    g.flash({ eyes: 'sparkle', mouth: 'o' }, 0.6);
    if (b.m.position.y > sl.centerWorld(this.v).y + 1.2) sl.hop(5);
    g.after(0.45, () => {
      if (!g.helpers3d.bubbles.includes(b)) return;
      const dir = sl.localDir(b.m.position, this.v).clone();
      dir.y = Math.max(dir.y, 0.05);
      sl.nub('swat', dir, 0.5, { snap: 8 });
      g.after(0.12, () => {
        if (!g.helpers3d.bubbles.includes(b)) return;
        g.helpers3d.popBubble(b);
        g.sfx.pop();
        const gain = g.sim.boopValue();
        g.sim.addJelly(gain);
        const sp = g.screenOf(b.m.position);
        g.hud.floatText(sp.x, sp.y, '+' + fmt(gain));
        g.sfx.giggle();
      });
      g.after(0.32, () => sl.nubIn('swat'));
    });
    g.remember('🫧', `${g.Name} popped a bubble all by themselves.`, 'selfpop');
  }

  palVisit() {
    const g = this.g;
    const a = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6);
    const target = new THREE.Vector3(Math.sin(a) * 2.3, 0, Math.cos(a) * 2.3);
    g.helpers3d.visit(target, pal => {
      if (g.sim.asleep) return;
      const pos = pal.obj.position.clone().add(new THREE.Vector3(0, 0.25, 0));
      g.lookOverride = { target: pos, until: this.time + 1.6 };
      g.slime.leanX.v += Math.sign(pos.x) * 2;
      g.slime.hop(3);
      pal.cheer = 1;
      g.sfx.coo();
      g.after(0.3, () => g.sfx.giggle());
      g.flash({ eyes: 'happy', mouth: 'grin', blush: 0.9 }, 1.2);
      g.fx.emit('hearts', pos.clone().lerp(g.slime.headTopWorld(this.v), 0.5), { count: 3 });
      this.say('♥', 900);
      g.sim.addBond(0.5);
      g.remember('💧', `A slimeling pal hopped over to say hi to ${g.Name}.`, 'palvisit');
    });
  }

  stargaze() {
    const g = this.g;
    g.lookOverride = { target: new THREE.Vector3(1.5, 7, -8), until: this.time + 2.2 };
    g.flash({ eyes: 'sparkle', mouth: 'o', blush: 0.6 }, 2.2);
    this.say('Ooh...', 1300);
    for (let i = 0; i < 4; i++) g.after(i * 0.3, () => g.fx.emit('glints', new THREE.Vector3((Math.random() - 0.5) * 6, 4 + Math.random() * 2, -5), { size: 0.3 }));
  }

  daydream(hungry = false) {
    const g = this.g;
    const fav = this.s.favorite;
    g.hud.think(g.hud.icon(fav, FOOD_BY_ID[fav].name), 2400);
    if (hungry) g.flash({ eyes: 'normal', mouth: 'drool' }, 2.2);
    else g.flash({ eyes: 'happy', mouth: 'o', blush: 0.7 }, 2.2);
    g.lookOverride = { target: g.slime.headTopWorld(this.v).clone().add(new THREE.Vector3(0.6, 1.5, 1)), until: this.time + 2 };
  }

  idleOptions(opts, pointerNear) {
    const g = this.g, s = this.s, sim = g.sim;
    const c = g.slime.centerWorld(this.v2);
    const bubble = g.helpers3d.nearestBubble(c, 1.6 + g.slime.size);
    if (bubble) opts.push([1.4 + s.personality.playful / 40, () => this.popNearbyBubble(bubble)]);
    if (g.helpers3d.slimelings.length) opts.push([0.4 + s.personality.cuddly / 90, () => this.palVisit()]);
    if (g.state.helpers.observatory > 0 && (g.stage.dark || this.isNight())) opts.push([0.5, () => this.stargaze()]);
    if (s.joy > 50 && s.tummy > 25) opts.push([0.45, () => this.daydream(false)]);
    if (s.tummy < 30) opts.push([1.2, () => this.daydream(true)]);
    if (this.learned('wave') && pointerNear) opts.push([0.5, () => this.perform('wave')]);
    if (this.learned('peekaboo') && pointerNear) opts.push([0.35, () => this.perform('peekaboo')]);
    if (this.learned('sing') && s.joy > 65) opts.push([0.4, () => this.perform('sing')]);
    if (this.learned('spin') && s.joy > 60) opts.push([0.25, () => this.perform('spin')]);
    if (this.learned('kiss') && sim.bondLevel() >= 3 && pointerNear) opts.push([0.3, () => this.perform('kiss')]);
    if (sim.bondLevel() >= 3 && pointerNear && !this.highFive && this.time > this.hfCooldown) opts.push([0.35, () => this.offerHighFive()]);
    if (this.isNight()) opts.push([0.7, () => { g.flash({ eyes: 'sleep', mouth: 'yawn' }, 1.3); g.sfx.yawn(); }]);
  }

  // ---------- per-frame ----------
  update(dt) {
    const g = this.g, p = g.press, st = g.state;
    if (p && p.mode === 'tap' && !g.sim.asleep && this.time - p.t > 0.5 && p.moved < 12) { p.mode = 'hug'; this.startHug(); }
    if (p && p.mode === 'hug') this.updateHug(dt);

    // shaking
    const sh = this.shake;
    if (sh.until > this.time) {
      sh.time += dt;
      g.slime.wobble = Math.max(g.slime.wobble, 0.07);
      sh.sfxT -= dt;
      if (sh.sfxT <= 0) { sh.sfxT = 0.22; g.sfx.wobble(); }
      if (sh.time > 0.7 && !sh.said) { sh.said = true; this.say('Whoa-a-a!', 1100); }
      if (sh.time > 1.0) this.secret('shake');
      if (sh.time > 2.4) {
        g.sim.dizzy = 2.2;
        g.sfx.dizzy();
        this.say('@_@', 1200);
        sh.time = 0; sh.rev = []; sh.until = -1;
      }
    } else {
      sh.time = Math.max(0, sh.time - dt * 1.5);
      if (sh.time === 0) sh.said = false;
    }
    if (this.time - this.turnT > 0.6) this.turn = 0;

    if (this.highFive && this.time > this.highFive.until) {
      this.highFive = null;
      g.slime.nubIn('hand');
      g.flash({ eyes: 'normal', mouth: 'pout' }, 0.9);
      this.say('aww...', 800);
    }

    if (this.hiccups) {
      if (g.sim.asleep || this.time > this.hiccups.until) {
        if (!g.sim.asleep) this.say('...phew', 900);
        this.hiccups = null;
      } else if (this.time > this.hiccups.next) {
        this.hiccups.next = this.time + 1.1 + Math.random() * 0.9;
        g.sfx.hic();
        g.slime.hop(2.4);
        g.flash({ eyes: 'wide', mouth: 'o' }, 0.25);
        this.say('hic!', 500);
      }
    }

    if (this.rainbowUntil > this.time) {
      this.rainbowColor.setHSL((this.time * 0.22) % 1, 0.75, 0.66, THREE.SRGBColorSpace);
      g.slime.colorOverride = this.rainbowColor;
      this.rainbowT -= dt;
      if (this.rainbowT <= 0) { this.rainbowT = 0.3; g.fx.emit('sparkles', g.slime.centerWorld(this.v).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.5, 0.4)), { count: 2, rainbow: true }); }
    } else g.slime.colorOverride = null;

    if (st.helpers.musicbox > 0 && !g.sim.asleep && !g.busy() && !p && !g.movingDay.active) {
      this.danceBreakT -= dt;
      if (this.danceBreakT <= 0) {
        this.danceBreakT = 25 + Math.random() * 25;
        if (this.learned('dance')) this.perform('dance');
        else { g.dance(2.5); g.fx.emit('notes', g.slime.headTopWorld(this.v), {}); }
      }
    }

    if (g.sim.asleep) {
      this.dreamT -= dt;
      if (this.dreamT <= 0) {
        this.dreamT = 8 + Math.random() * 8;
        const pool = [this.s.favorite];
        if (st.helpers.slimeling > 0) pool.push('slimeling');
        if (st.helpers.feather > 0) pool.push('feather');
        if (st.helpers.musicbox > 0) pool.push('musicbox');
        g.hud.think(g.hud.icon(pool[Math.floor(Math.random() * pool.length)]), 2600);
      }
    }

    // Introduce emotes once the tutorial is done.
    if (st.tutorial === 4) {
      this.introT += dt;
      if (this.introT > 12 && !g.hud.modalOpen) {
        st.tutorial = 5;
        g.hud.toast(`<b>New: emotes</b>Tap the smile button next to ${esc(g.Name)}'s name. They will try to copy you.`, 'love', 6000);
        g.hud.pulseEmoteButton();
      }
    }
  }

  applyExpression(e) {
    const g = this.g, p = g.press, t = this.time;
    if (p && p.mode === 'hug') { e.eyes = 'happy'; e.mouth = 'cat'; e.blush = 1; }
    if (p && p.mode === 'pull') {
      const a = g.slime.pull.amt || 0;
      e.eyes = a > 0.55 ? 'wince' : 'wide';
      e.mouth = a > 0.3 ? 'open' : 'o';
      e.blush = 0.6;
      e.sweat = a > 0.75;
    }
    if (this.shake.until > t) { e.eyes = this.shake.time > 1.5 ? 'dizzy' : 'wide'; e.mouth = 'wavy'; e.brows = null; }
    if (this.melting > t) { e.eyes = 'happy'; e.mouth = 'cat'; e.blush = 1; }
    if (this.grumpyUntil > t) { e.brows = 'determined'; e.mouth = 'pout'; e.eyes = 'normal'; }
    if (this.highFive) { e.eyes = 'sparkle'; e.mouth = 'open'; }
    if (this.nomUntil > t) { e.eyes = 'happy'; e.mouthOpen = 0.55 * Math.abs(Math.sin((this.nomUntil - t) * Math.PI / 0.15)); }
    if (this.peekUntil > t) { e.eyes = 'wince'; e.mouth = 'flat'; e.blush = 0.8; }
    if (this.singUntil > t) { e.eyes = 'happy'; e.mouthOpen = 0.2 + 0.35 * Math.abs(Math.sin(t * Math.PI / 0.24)); }
  }

  applyMotion() {
    const g = this.g, sl = g.slime, p = g.press, t = this.time;
    let bias = 0;
    if (p && p.mode === 'hug') { bias = -0.16; sl.leanZ.target += 0.07; }
    if (this.melting > t) { bias = -0.34; sl.leanX.target += Math.sin(t * 2) * 0.05; }
    if (this.peekUntil > t) bias = -0.22;
    if (p && p.mode === 'pull') { sl.leanX.target += clamp(sl.pull.vec.x * 0.2, -0.15, 0.15); }
    if (this.tickleUntil > t) sl.roll.target += Math.sin(t * 14) * 0.16;
    if (this.grumpyUntil > t) sl.leanZ.target -= 0.06;
    sl.sqBias = bias;
  }
}
