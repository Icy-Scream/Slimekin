// Coordinator: turns player input into Sim actions, then turns Sim results
// into slime reactions, effects, sounds and UI. Rules live in core/, looks in view/.
// This file builds the Game (world, views, HUD, the frame loop) and runs each frame. Everything else the Game does is
// in its parts, one subject per file in src/game/, mixed into Game.prototype at the bottom (src/mixin.js), so every
// method is still game.x() for its callers:
//   egg.js        the egg on the cushion: its look and hint, warming, hatching, naming
//   care.js       boops, petting, naps, bond-up, dance, buzz
//   food.js       snacks: tray taps and drags, the toss, eating, what it changes, reactions
//   mood.js       tutorial hint, idle moments, the face, where it looks, how it sways
//   growth.js     stage-up card, medal ceremony, the grown-up form's effects
//   requests.js   the slime's requests and their answers
//   play.js       bubble play, Lucky Glimmers
//   shop.js       helpers, upgrades, the Jelly Jar, outfits, heirlooms (buying; the pages are in ui/hud.js)
//   welcome.js    welcome back, returning to the app
//   ranch.js      going to the barn and what you do there (petting, pearls, basket, room)
//   nursery.js    the Nursery: eggs, breeding, special eggs, the cushion swap
//   move-out.js   the move-out card, the goodbye, a baby's new home
//   new-homes.js  residents' new homes, auctions, postcards
//   input.js      pointer and keys
//   layout.js     theme, resize, where the camera fits the slime
//   settings.js   the Settings card, save codes, starting over
//   saving.js     saving and save safety
//   debug.js      #debug tester tools
//   shared.js     SLIME_Y, clamp, ease, DEBUG, an
import * as THREE from 'three';
import { Sim, createState, migrate } from './core/sim.js';
import { Requests } from './core/requests.js';
import { FOODS, FOOD_BY_ID, HELPERS, UPGRADE_BY_ID, OUTFITS, AUTO_QUALITY } from './data/content.js';
import { Stage, CUSHION_TOP } from './view/stage.js';
import { SlimeAvatar } from './view/slime.js';
import { FX } from './view/fx.js';
import { HelperWorld } from './view/helpers3d.js';
import { setMedalPin } from './view/medal-pin.js';
import { renderIcons, FOOD_MAKERS, HELPER_MAKERS, OUTFIT_MAKERS } from './view/models.js';
import { Sfx } from './audio/sfx.js';
import { Hud } from './ui/hud.js';
import { Behaviors } from './behaviors.js';
import { MovingDay } from './moving-day.js';
import { RanchView } from './view/ranch.js';
import { Scenery } from './view/scenery.js';
import { RanchLifeUI } from './ui/ranch-life.js';
import { freshState } from './platform/index.js';
import { Home } from './greenhouse-home.js';
import { BarnRanch } from './barn-ranch.js';
import { ContestsUI } from './ui/contests.js';
import { ContestShow } from './contest-show.js';
import { SendOff } from './send-off.js';
import { SLIME_Y, DEBUG } from './game/shared.js';
import { EggPart } from './game/egg.js';
import { WelcomePart } from './game/welcome.js';
import { ShopPart } from './game/shop.js';
import { RanchPart } from './game/ranch.js';
import { NurseryPart } from './game/nursery.js';
import { MoveOutPart } from './game/move-out.js';
import { NewHomesPart } from './game/new-homes.js';
import { InputPart } from './game/input.js';
import { CarePart } from './game/care.js';
import { FoodPart } from './game/food.js';
import { GrowthPart } from './game/growth.js';
import { RequestsPart } from './game/requests.js';
import { PlayPart } from './game/play.js';
import { MoodPart } from './game/mood.js';
import { LayoutPart } from './game/layout.js';
import { SettingsPart } from './game/settings.js';
import { SavingPart } from './game/saving.js';
import { DebugPart } from './game/debug.js';
import { mixParts } from './mixin.js';

export class Game {
  constructor({ canvas, save, store, start = null }) {
    this.canvas = canvas;
    this.store = store;
    // save safety: how this visit started (main.js: 'local' | 'prev' | 'backup' | 'cloud' | 'hot' | 'none', broken), the
    // frame health (failed frames; the autosave only follows a clean frame), the hiccup card (trouble: no more saving)
    this.start = start;
    this.health = { fails: 0, lastFailed: false, logged: 0 };
    this.trouble = false;
    this.glLost = false;
    this.state = save ? migrate(save) : freshState(createState());   // freshState: the iPhone app's defaults (no-op on the web)
    this.sim = new Sim(this.state);
    this.requests = new Requests(this.sim);
    this.life = new RanchLifeUI(this);   // ranch life: lessons and trips (menus in ui/ranch-life.js, rules in core/ranch-life.js)
    this.contests = DEBUG ? this.contestsDebug() : null;   // contests (#debug): the rules straight, no show (core/contests.js)
    this.contestsUI = new ContestsUI(this);   // [contests] the entry card, Dress up, results, the Trophy Shelf (ui/contests.js)
    this.contestShow = new ContestShow(this);   // [contests] the show on the barn's stand (contest-show.js)
    this.sfx = new Sfx();
    this.sfx.sound = this.state.settings.sound;
    this.sfx.music = this.state.settings.music;
    this.sfx.voice = this.sim.stage().voice;

    this.stage = new Stage(canvas);
    this.scene = this.stage.scene;
    this.scenery = new Scenery(this.scene, this.stage);
    this.scenery.setTheme(this.stage.dark);
    this.fx = new FX(this.scene);
    this.fx.floor = CUSHION_TOP;
    this.slime = new SlimeAvatar({ quality: this.resolvedQuality() });
    this.slime.root.position.y = SLIME_Y;
    this.scene.add(this.slime.root);
    this.slime.setTraits(this.state.slime.traits);
    this.slime.setRecipe(this.state.slime, { instant: true });   // its breed (Curly, Dollop or in-between), fixed at the egg
    this.slime.setStage(this.sim.stageIndex(), this.sim.stageProgress(), true);
    this.slime.size = this.slime.sizeTarget = this.sim.size();
    this.slime.setOutfits(this.state.outfits.worn);
    if (this.state.slime.form) this.slime.setForm(this.state.slime.form.id, { pure: this.state.slime.form.pure });
    setMedalPin(this.slime, this.sim.medalShown());
    this.formFxT = 1;
    this.timeSkip = 0;   // test clock: advance() moves the Nursery's egg timers along with game time
    // debug only (#debug): Nursery eggs are ready at once and parents don't rest; remembered on this device, not in the save
    this.debugInstant = DEBUG && (() => { try { return localStorage.getItem('slimekin.debug.instantEggs') === '1'; } catch { return false; } })();
    this.ranch = new RanchView(this.scene, { quality: this.resolvedQuality() });
    this.ranch.setTheme(this.stage.dark, this.stage.palette.floor);
    this.stage.onTheme = (dark, p) => { this.ranch.setTheme(dark, p.floor); this.scenery.setTheme(dark); this.eggSpark && this.eggSpark.setNight(dark); this.helpers3d && this.helpers3d.setNight(dark); this.home && this.home.setNight(dark); this.barnRanch && this.barnRanch.view.setNight(dark); };   // [barn] the barn blends too
    this.ranch.sync(this.life.homeResidents());   // (travelers are not on the ranch)
    this.ranchPage = null;   // 'nursery' while the Nursery panel is open
    this.nurseryT = 0;
    this.syncNursery();
    this.helpers3d = new HelperWorld(this.scene, this.fx);
    this.helpers3d.setNight(this.stage.dark);
    this.helpers3d.sync(this.state.helpers);
    this.home = new Home(this);   // [greenhouse] home's world (Greenhouse / Meadow / Classic) and the camera you can turn
    this.sendOff = new SendOff(this);   // [bubble] the goodbye's travel bubble (send-off.js)
    this.barnRanch = new BarnRanch(this);   // [barn] the ranch screen: the baked barn, one resident on the stand (barn-ranch.js)
    this.hud = new Hud(this);
    this.behave = new Behaviors(this);
    this.movingDay = new MovingDay(this);
    for (const b of this.state.slime.belly || []) {
      if (FOOD_BY_ID[b.id]) this.slime.addInner(b.id, { age: b.age || 0, life: b.life, settled: true });
    }

    try {
      const entries = [
        ...FOODS.map(f => [f.id, FOOD_MAKERS[f.id](), ({ cookie: [0.95, 0.3, 0], chili: [0.3, -0.5, 0], iron: [0.75, 0.5, 0], moss: [0.45, -0.6, 0], berry: [0.35, 0, 0], crystal: [0.15, -0.4, 0] })[f.id]]),
        ...HELPERS.map(h => [h.id, HELPER_MAKERS[h.id](), h.id === 'feather' ? [0, 0, -0.7] : [0.2, -0.45, 0]]),
        ...OUTFITS.map(o => [o.id, OUTFIT_MAKERS[o.id](), ({ flowers: [0.9, 0, 0], scarf: [0.9, 0, 0], glasses: [0.2, -0.3, 0], shades: [0.2, -0.3, 0], bowtie: [0.2, -0.3, 0], bow: [0.2, -0.3, 0] })[o.id] || [0.25, -0.4, 0]]),
      ];
      this.hud.setIcons(renderIcons(this.stage.renderer, this.stage.env, entries));
    } catch (e) {
      console.warn('Icon render failed, using fallbacks', e);
      this.hud.setIcons({});
    }

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.pointerPx = { x: innerWidth / 2, y: innerHeight / 2 };
    this.parallax = new THREE.Vector2();
    this.pointerWorld = new THREE.Vector3(0, 1.2, 2);
    this.lastPointerMove = -99;
    this.lastInteract = 0;
    this.time = 0;
    this.timeline = [];
    this.transient = null;
    this.press = null;
    this.foodPress = null;
    this.held = null;
    this.flying = null;
    this.eating = null;
    this.feedQueue = [];
    this.falling = [];
    this.glimmer = null;
    this.glimmerT = 50 + Math.random() * 80;
    this.bubbleGame = null;
    this.idleT = 5;
    this.chompOpen = 0;
    this.sleepT = 0;
    this.zzzT = 0;
    this.snoreT = 0;
    this.petTextT = 0;
    this.petAccum = 0;
    this.heartT = 0;
    this.autoFeedT = 0;
    this.saveT = 6;
    this.lastCloud = -999;
    this.cloudDirty = false;
    this.cloudSoon = false;
    this.viewOff = new THREE.Vector2();
    this.viewGoal = new THREE.Vector2();
    // frame-rate watch (trackSpeed): the window's frames, their gaps (win), caps and work; the display's beat from the last 32
    // gaps between its frames (beats); level: Auto's step (0 High, 1 pixel ratio 1.5, 2 Low)
    this.perf = { t: 0, frames: 0, work: 0, level: 0, beat: 1000 / 60, rafAt: 0, beats: new Float64Array(32), bi: 0, bn: 0, sorted: new Float64Array(32),
      win: new Float64Array(512), cap: new Float64Array(512), bad: 0, settle: AUTO_QUALITY.settle, stalled: false, steps: [] };
    this.v1 = new THREE.Vector3();
    this.v2 = new THREE.Vector3();
    this.v3 = new THREE.Vector3();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -1.6);

    this.view = 'home';
    this.ranchFocus = null;
    this.rpress = null;
    this.departing = null;
    // The ranch keeps going while the game is closed (in every phase, even while an egg waits).
    // (ranch life: lessons that ended and travelers who came home meanwhile are finished where they happened)
    const awayAll = (Date.now() - (this.state.savedAt || Date.now())) / 1000;
    this.ranchAway = this.life.passTime(awayAll);
    this.ranch.setBasket(this.state.ranch.basket.stored, this.sim.ranch.basketCap());

    this.applySettings();
    this.setupPhase();
    this.instantEggs();
    document.getElementById('eggAlt').addEventListener('click', () => this.openNursery());
    // [r3b] the start's moments are timed from when the loading screen goes (it may wait for the Greenhouse room)
    this.onShown = [];
    this.whenShown(() => this.after(2.5, () => this.checkPostcards()));
    if (this.state.ranch.justMoved) { const j = this.state.ranch.justMoved; delete this.state.ranch.justMoved; this.whenShown(() => this.after(1.4, () => this.showMovedIn(j))); }
    this.whenShown(() => this.after(0.8, () => this.startNote()));   // save safety: a save that came back from a copy, or could not be read
    this.watchContext();   // save safety: the phone can take the 3D picture away (WebGL context lost)
    this.bindInput();
    this.watchTheme();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    // re-measure once the phone menu finishes sliding (the camera fits the slime into what's left)
    document.getElementById('panel').addEventListener('transitionend', e => { if (e.propertyName === 'height') this.resize(); });
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => this.saveNow(true));

    this.last = performance.now();
    this.hiddenAt = null;
    // Capped at 60 fps (120 Hz phones would otherwise burn battery), 30 fps when things are calm.
    const loop = now => {
      requestAnimationFrame(loop);
      this.beatTick(now);   // [perf] every callback, drawn or not: the display's own beat
      const target = this.calm() ? 1000 / 30 : 1000 / 60;
      const gap = now - this.last;
      if (gap < target - 2) return;
      const dt = Math.min(0.05, Math.max(0, gap / 1000));
      this.last = now;
      const t0 = performance.now();
      try { this.update(dt); } catch (e) { this.frameDone(0, e); }   // (update() catches its own; this is the last net)
      try { this.trackSpeed(gap, target, performance.now() - t0); } catch (e) { console.error(e); }
    };
    requestAnimationFrame(loop);
  }

  // [r3b] The loading screen and the game's first look (main.js): firstLook() resolves when home shows what it should
  // (the Greenhouse room waits, at most GREENHOUSE.arrive.wait s); shown() when the loading screen starts to go.
  firstLook() { return this.home.firstLook(); }
  whenShown(fn) { if (this.onShown) this.onShown.push(fn); else fn(); }
  shown() {
    const q = this.onShown;
    this.onShown = null;
    for (const fn of q || []) { try { fn(); } catch (e) { console.error(e); } }
  }

  // ---------- helpers ----------
  get name() { return this.state.slime.name || 'your slime'; }
  get Name() { const n = this.state.slime.name || 'Your slime'; return n; }
  after(sec, fn) { this.timeline.push({ t: this.time + sec, fn }); }
  flash(expr, dur) { this.transient = { expr, until: this.time + dur }; }
  dayCount() { const b = this.state.slime.bornAt || this.state.createdAt; return Math.max(1, Math.floor((Date.now() - b) / 86400000) + 1); }
  upgradeName(id) { return UPGRADE_BY_ID[id]?.name || id; }
  slimeHex() { return '#' + this.slime.color.getHexString(); }
  remember(icon, text, key) {
    if (this.sim.remember(icon, text, key)) { this.hud.dot('journal'); this.markDirty(true); }
  }
  markDirty(major) { this.cloudDirty = true; if (major) this.cloudSoon = true; }
  busy() { return !!(this.eating || this.flying || this.held); }
  screenOf(world) {
    const v = this.v3.copy(world).project(this.stage.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, front: v.z < 1 };
  }

  resolvedQuality() {
    const q = this.state.settings.quality;
    if (q === 'auto') return (this.perf && this.perf.level >= 2) ? 'low' : 'high';
    return q;
  }

  applySettings() {
    const s = this.state.settings;
    // background: the Greenhouse (the default), the meadow, or the classic plain nursery (only the slime to look at)
    if (s.scene !== 'classic' && s.scene !== 'meadow' && s.scene !== 'greenhouse') s.scene = 'greenhouse';
    this.home.apply();   // [greenhouse]
    this.sfx.setPlayOnSilent(!!s.soundOnSilent);
    this.sfx.setSound(s.sound);
    this.sfx.setMusic(s.music);
    this.sfx.setPurr(s.purr !== false);
    this.reduced = s.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.fx.reduced = this.reduced;
    this.slime.setQuality(this.resolvedQuality());
    this.helpers3d.setQuality(this.resolvedQuality());
    this.barnRanch.view.setQuality(this.resolvedQuality());   // [barn]
    if (s.quality === 'low') this.stage.setPixelRatio(1);
    else if (s.quality === 'high') this.stage.setPixelRatio(2);
    else this.stage.setPixelRatio(this.perf.level >= 1 ? AUTO_QUALITY.ratio1 : 2);
    this.resize();
  }

  // ---------- phases ----------
  setupPhase() {
    const st = this.state;
    if (st.phase === 'egg') {
      this.makeEggView();
      this.slime.root.visible = false;
      this.slime.visible = false;
      document.getElementById('eggHint').hidden = false;
      this.eggWarming = !this.sim.eggReady(this.nowMs());
      this.updateEggHint();
      this.hud.setPhase('egg');
    } else {
      this.hud.setPhase(st.phase);
      if (st.phase === 'naming') this.after(0.6, () => this.askName());
      else this.welcomeBack();
    }
  }

  // Test helper: run the game forward without drawing every frame.
  advance(sec, step = 1 / 30) {
    this.noRender = true;
    for (let t = 0; t < sec; t += step) { this.timeSkip += step * 1000; this.update(step); }
    this.noRender = false;
  }

  // Nothing much happening: render at half rate to save battery.
  calm() {
    return this.state.phase === 'play' && this.time - this.lastInteract > 12 && this.time - this.lastPointerMove > 3 &&
      !this.press && !this.held && !this.flying && !this.eating && !this.glimmer && !this.bubbleGame && this.fx.live.length < 6 &&
      !this.movingDay.active &&   // a Moving Day sign moves the slime: full frame rate
      !(this.barnRanch.active && this.barnRanch.view.swapping);   // [barn] the burrow swap: full frame rate
  }

  // [perf] The display's own beat: the gap between the browser's frame callbacks, drawn or not (60 Hz: 16.7 ms; Low Power
  // Mode on an iPhone, or a 30 Hz screen: 33.3 ms).
  beatTick(now) {
    const p = this.perf, d = now - p.rafAt;
    p.rafAt = now;
    if (d > 0 && d < AUTO_QUALITY.stall) { p.beats[p.bi] = d; p.bi = (p.bi + 1) % p.beats.length; if (p.bn < p.beats.length) p.bn++; }
  }

  // Watches for frames arriving late, and on "Auto" lowers graphics quality if the device keeps struggling. [perf] A frame
  // is late when it misses its beat (the display's own, or the game's cap when calm): a phone in Low Power Mode, which
  // shows 30 frames a second, steady, is not struggling. Steps down after a few seconds of late frames, never back up
  // (no flip-flop); see AUTO_QUALITY.
  trackSpeed(gap, target, workMs) {
    const p = this.perf, A = AUTO_QUALITY;
    if (gap > A.stall) { p.stalled = true; return; }   // a stall (the phone busy elsewhere, an alert): not the game's pace
    if (p.frames < p.win.length) { p.win[p.frames] = gap; p.cap[p.frames] = target; }
    p.t += gap / 1000;
    p.frames++;
    p.work += workMs;
    if (p.t < A.window) return;
    // the beat: a low quarter of the last gaps between frame callbacks (missed beats show as longer gaps)
    if (p.bn >= 8) { const s = p.sorted.subarray(0, p.bn); s.set(p.beats.subarray(0, p.bn)); s.sort(); p.beat = s[p.bn >> 2]; }
    const n = Math.min(p.frames, p.win.length);
    let late = 0;
    for (let i = 0; i < n; i++) if (p.win[i] > Math.max(p.cap[i], p.beat) * A.late) late++;
    const fps = p.frames / p.t, lateShare = late / n, work = p.work / p.frames;
    p.t = 0; p.frames = 0; p.work = 0;
    p.lateShare = lateShare;
    this.hud.setSpeed(this.state.settings.showFps ? `${Math.round(fps)} fps · ${work.toFixed(1)} ms · ${['high', 'medium', 'low'][p.level]}` : null);
    if (p.settle > 0 || p.stalled) { p.settle = Math.max(0, p.settle - 1); p.stalled = false; p.bad = 0; return; }
    if (this.state.settings.quality !== 'auto' || p.level >= 2 || document.hidden) { p.bad = 0; return; }
    p.bad = lateShare >= A.lateShare ? p.bad + 1 : 0;
    if (p.bad >= A.windows || lateShare >= A.veryLate) {
      p.level++;
      p.bad = 0;
      p.settle = A.settleAfter;
      p.steps.push({ at: +this.time.toFixed(1), level: p.level, lateShare: +lateShare.toFixed(2), beat: +p.beat.toFixed(1) });
      this.applySettings();
    }
  }

  // One frame: the world, the picture, the bubbles over the slime. Each part runs on its own, so an error early in the
  // frame never skips drawing; then frameDone() (save safety) autosaves after a clean frame, or counts the failure.
  update(dt) {
    let err = null;
    try { this.updateWorld(dt); } catch (e) { err = e; }
    try { this.draw(dt); } catch (e) { err = err || e; }
    try { this.updateOverlay(dt); } catch (e) { err = err || e; }
    this.frameDone(dt, err);
  }

  updateWorld(dt) {
    this.time += dt;
    if (this.timeline.length) {
      const due = this.timeline.filter(e => e.t <= this.time);
      if (due.length) {
        this.timeline = this.timeline.filter(e => e.t > this.time);
        for (const e of due) { try { e.fn(); } catch (err) { console.error(err); } }
      }
    }
    const st = this.state;
    if (st.phase === 'play') {
      const tk = this.sim.tick(dt);
      if (tk.feverStarted) {
        this.sfx.giggle();
        this.hud.say('Hehehe!', 900);
        if (!st.memKeys.includes('fever1')) this.remember('😆', `${this.Name} caught Giggle Fever for the first time.`, 'fever1');
      }
      this.updatePetting(dt);
      this.behave.update(dt);
      this.updateSleep(dt);
      this.updateRequests(dt);
      this.updateIdle(dt);
      this.updateGlimmer(dt);
      this.updateMedals(dt);
      this.movingDay.update(dt);
      this.updateFormFx(dt);
      this.updateTutorial();
      if (this.bubbleGame) {
        this.bubbleGame.t += dt;
        if (this.bubbleGame.t > 10.5) this.finishBubbleGame(false);
      }
      this.autoFeedT -= dt;
      if (this.sim.fx.autoFeed && st.slime.tummy < 25 && this.autoFeedT <= 0 && !this.busy() && !this.sim.asleep && this.sim.canFeed('cookie').ok) {
        this.autoFeedT = 5;
        this.tossFood('cookie', null, { auto: true });
      }
      this.sfx.setMusicWanted(st.helpers.musicbox > 0);
    } else if (st.phase === 'egg') {
      this.updateEggWait(dt);
      this.hud.updateEggPhase(dt);
    }
    if (this.egg) {
      this.egg.update(dt, this.scene);
      if (this.egg.hatched && !this.egg.shards.length) { this.scene.remove(this.egg.group); this.egg = null; }
    }

    this.computeExpression();
    this.computeLook();
    this.computeMotion();
    this.slime.sizeTarget = this.sim.size();
    this.slime.setStage(this.sim.stageIndex(), this.sim.stageProgress());   // the body morphs as it grows
    if (this.departing) this.updateDeparture(dt);
    // (off screen while visiting the ranch, so it can rest)
    if (this.slime.visible && !this.barnRanch.active) this.slime.update(dt);   // [barn] (not drawn in the barn)
    this.updateFood(dt);
    const center = this.slime.centerWorld(new THREE.Vector3());
    this.helpers3d.update(dt, {
      slimeCenter: center, slimeSize: this.slime.size, fxOn: !this.reduced, slimeColor: this.slimeHex(),
      canTickle: st.phase === 'play' && !this.busy(),
      onTickle: (pos, f) => {
        if (this.sim.asleep) { this.slime.poke(pos, 0.25); return; }
        if (this.behave.onTickle(pos, f)) return;
        this.slime.poke(pos, 0.55);
        this.sfx.tickle();
        if (!this.transient || this.transient.until < this.time) this.flash({ eyes: 'happy', mouth: 'open', blush: 0.7 }, 0.6);
      },
    });
    this.updateRanch(dt);
    this.nurseryT -= dt;
    if (this.nurseryT <= 0) { this.nurseryT = 1; this.syncNursery(); }
    // [greenhouse] what home shows (the room, the meadow or the classic nursery; the ranch hill) and the camera's target
    this.home.update(dt);
    this.barnRanch.update(dt);   // [barn] the ranch screen (the barn), when it shows
    this.contestShow.update(dt);   // [contests] a show on the barn's stand, when one runs
    this.ranch.update(dt);
    this.scenery.update(dt);
    this.fx.update(dt);
  }

  draw(dt) {
    // smooth view offset toward the free area of the screen
    if (Math.abs(this.viewOff.x - this.viewGoal.x) > 0.5 || Math.abs(this.viewOff.y - this.viewGoal.y) > 0.5) {
      this.viewOff.lerp(this.viewGoal, 1 - Math.exp(-dt * 6));
      this.stage.camera.setViewOffset(innerWidth, innerHeight, this.viewOff.x, this.viewOff.y, innerWidth, innerHeight);
      this.stage.camera.updateProjectionMatrix();
    }
    this.stage.update(dt, this.slime.size, this.parallax, this.reduced);
    const drawn = !this.noRender && !this.glLost;   // (no picture to draw into while the phone has taken it away)
    if (drawn) this.stage.render();
    this.home.afterRender(drawn);   // [r3b] the loading screen's wait, the room's cross-fade
  }

  updateOverlay(dt) {
    const st = this.state;
    if (st.phase === 'play' || st.phase === 'naming') {
      if (st.phase === 'play') this.hud.update(dt);
      // Steady anchor above the head (ignores breathing and hops) so buttons don't jitter.
      const anchor = this.slime.root.getWorldPosition(this.v1);
      anchor.y += this.slime.size * 1.42 + 0.22;
      const sp = this.screenOf(anchor);
      const base = this.screenOf(this.slime.root.getWorldPosition(this.v2));
      this.hud.placeBubbles(sp.x, sp.y, sp.front, base.y, st.phase === 'play' ? this.topLimit : 0);
    }
  }
}

// the rest of Game: its parts (./game/), mixed into Game.prototype (src/mixin.js)
mixParts(Game, EggPart, WelcomePart, ShopPart, RanchPart, NurseryPart, MoveOutPart, NewHomesPart, InputPart, CarePart, FoodPart,
  GrowthPart, RequestsPart, PlayPart, MoodPart, LayoutPart, SettingsPart, SavingPart, DebugPart);
