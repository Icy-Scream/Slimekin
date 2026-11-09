// Coordinator: turns player input into Sim actions, then turns Sim results
// into slime reactions, effects, sounds and UI. Rules live in core/, looks in view/.
import * as THREE from 'three';
import { Sim, createState, migrate } from './core/sim.js';
import { Requests } from './core/requests.js';
import {
  TUNING, FOODS, FOOD_BY_ID, HELPERS, UPGRADE_BY_ID, STAGES, TRAITS, TRAIT_IDS, BOND, PERSONALITY, OUTFITS, PURE_LINE,
  MOVING_DAY, SKILL_IDS,
} from './data/content.js';
import { fmt, fmtShort } from './core/format.js';
import { Stage, CUSHION_TOP } from './view/stage.js';
import { SlimeAvatar } from './view/slime.js';
import { FX } from './view/fx.js';
import { HelperWorld } from './view/helpers3d.js';
import { setMedalPin } from './view/medal-pin.js';
import { cleanBody, bodyName } from './core/recipe.js';
import { makeFood, renderIcons, FOOD_MAKERS, HELPER_MAKERS, OUTFIT_MAKERS } from './view/models.js';
import { Sfx } from './audio/sfx.js';
import { Hud } from './ui/hud.js';
import { esc } from './ui/esc.js';
import { showNotice, copyText, agoText } from './ui/notice.js';
import { readSaveCode, makeSaveCode } from './core/save-check.js';
import { BROKEN_KEY } from './core/save.js';
import { ICON, memIcon } from './ui/icons.js';
import { Behaviors } from './behaviors.js';
import { MovingDay } from './moving-day.js';
import { movingDayRatio, movingDayLevel } from './core/movingday.js';
import { scoreShow, applyShow, dressUp } from './core/contests.js';
import { starCap } from './core/talents.js';
import { RanchView } from './view/ranch.js';
import { Scenery } from './view/scenery.js';
import { RanchLifeUI } from './ui/ranch-life.js';
import { haptic, freshState } from './platform/index.js';
import { Home } from './greenhouse-home.js';
import { BarnRanch } from './barn-ranch.js';
import { ContestsUI } from './ui/contests.js';
import { ContestShow } from './contest-show.js';
import { SendOff } from './send-off.js';
import { SLIME_Y, clamp, ease, DEBUG, an } from './game/shared.js';
import { EggPart } from './game/egg.js';
import { WelcomePart } from './game/welcome.js';
import { ShopPart } from './game/shop.js';
import { RanchPart } from './game/ranch.js';
import { NurseryPart } from './game/nursery.js';
import { MoveOutPart } from './game/move-out.js';
import { NewHomesPart } from './game/new-homes.js';
import { mixParts } from './mixin.js';

const TROUBLE_FAILS = 3;   // save safety: failed frames in a row (each clean frame takes 0.1 off) before the hiccup card

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
    this.perf = { t: 0, frames: 0, slow: 0, work: 0, level: 0 };
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
    else this.stage.setPixelRatio(this.perf.level >= 1 ? 1.25 : 2);
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

  // ---------- input ----------
  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', e => this.onDown(e));
    window.addEventListener('pointermove', e => this.onMove(e), { passive: true });
    window.addEventListener('pointerup', e => this.onUp(e));
    window.addEventListener('pointercancel', e => this.onUp(e, true));
    c.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => this.onKey(e));
    // Audio can only start from a user gesture; iPhones count the end of a tap, not the start.
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
      window.addEventListener(type, () => this.sfx.unlock(type), { capture: true, passive: true });
    }
  }

  setPointer(e) {
    this.pointerPx.x = e.clientX;
    this.pointerPx.y = e.clientY;
    this.ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.stage.camera);
    // [greenhouse] the drag plane in front of the slime faces the camera (straight on in Front, as always)
    const yaw = this.home ? this.home.yaw() : 0;
    this.plane.normal.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.raycaster.ray.intersectPlane(this.plane, this.pointerWorld);
    this.parallax.set(this.ndc.x, this.ndc.y);
  }

  onDown(e) {
    this.sfx.unlock();
    this.setPointer(e);
    this.lastPointerMove = this.time;
    this.lastInteract = this.time;
    const st = this.state;
    if (st.phase === 'egg') {
      if (this.view === 'ranch') { if (!this.hud.modalOpen) this.ranchDown(e); return; }
      if (this.home.second(e)) return;   // [greenhouse] a second finger while turning the camera: a pinch
      const h = this.egg && this.egg.hit(this.raycaster);
      if (h) this.tapEgg(h.point);
      else this.home.down(e);   // [greenhouse] empty background: turn the camera
      return;
    }
    if (st.phase !== 'play' || this.hud.modalOpen || this.departing) return;
    if (this.view === 'ranch') { this.ranchDown(e); return; }
    if (this.home.second(e)) { this.swipe = null; return; }   // [greenhouse] a second finger while turning the camera: a pinch
    if (this.behave.tryHighFive(this.raycaster)) return;
    if (this.glimmer && this.raycaster.ray.distanceSqToPoint(this.glimmer.obj.position) < 0.5 * 0.5) { this.catchGlimmer(); return; }
    const b = this.helpers3d.hitBubble(this.raycaster);
    if (b) { this.popBubble(b); return; }
    const hit = this.slime.hit(this.raycaster);
    if (!hit) {
      this.swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, t: this.time };
      this.home.down(e);   // [greenhouse] a drag from here turns the camera (a short swipe still counts for the secret code)
    }
    if (hit) {
      const region = this.slime.faceRegion(this.raycaster);
      this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: this.time, moved: 0, petting: false, over: true, lastMoveT: this.time, dir: 0, point: hit.point.clone() };
      this.behave.onPressStart(this.press, hit, region);
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (!this.sim.asleep) this.boop(hit.point, region);
      else this.slime.poke(hit.point, 0.3);
    }
  }

  onMove(e) {
    this.setPointer(e);
    this.lastPointerMove = this.time;
    if (this.rpress && e.pointerId === this.rpress.id) { this.ranchMove(e); return; }
    if (this.home.move(e)) return;   // [greenhouse] turning or pinching the camera
    if (this.foodPress && e.pointerId === this.foodPress.pointerId) {
      const fp = this.foodPress;
      if (!fp.dragging && Math.hypot(e.clientX - fp.x, e.clientY - fp.y) > 10) this.startFoodDrag();
      return;
    }
    const p = this.press;
    if (p && e.pointerId === p.id) {
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.moved += Math.hypot(dx, dy);
      p.x = e.clientX; p.y = e.clientY;
      const hit = this.slime.hit(this.raycaster);
      p.over = !!hit;
      this.behave.onPressMove(p, dx, dy);
      p.petting = p.mode === 'pet';
      this.canvas.classList.toggle('petting', p.mode === 'pet' || p.mode === 'pull');
      if (p.petting && hit && Math.hypot(dx, dy) > 0.5) { p.lastMoveT = this.time; p.dir = clamp(p.dir * 0.7 + dx * 0.01, -1, 1); this.lastInteract = this.time; }
      return;
    }
    if (this.state.phase === 'play' && e.pointerType === 'mouse') {
      const over = !this.hud.modalOpen && (!!this.slime.hit(this.raycaster) || !!this.helpers3d.hitBubble(this.raycaster) || (this.glimmer && this.raycaster.ray.distanceSqToPoint(this.glimmer.obj.position) < 0.25));
      this.canvas.classList.toggle('can-boop', over);
    } else if (this.state.phase === 'egg' && this.egg) {
      this.canvas.classList.toggle('can-boop', !!this.egg.hit(this.raycaster));
    }
  }

  onUp(e, cancel = false) {
    if (this.rpress && e.pointerId === this.rpress.id) { this.ranchUp(e, cancel); return; }
    this.home.up(e);   // [greenhouse]
    if (this.foodPress && e.pointerId === this.foodPress.pointerId) {
      const fp = this.foodPress;
      this.foodPress = null;
      if (fp.dragging) this.dropHeld(cancel);
      else if (!cancel) this.tossFood(fp.id, fp.btn);
      return;
    }
    const sw = this.swipe;
    if (sw && e.pointerId === sw.id) {
      this.swipe = null;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y, dist = Math.hypot(dx, dy);
      if (!cancel && this.time - sw.t < 0.8) {
        if (dist < 12) this.behave.onSwipe('tap');
        else if (dist > 45) this.behave.onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      }
    }
    const p = this.press;
    if (p && e.pointerId === p.id) {
      if (this.sim.asleep && !p.petting && this.time - p.t < 0.4) this.wakeUp('poked');
      this.behave.onPressUp(p, cancel);
      this.press = null;
      this.canvas.classList.remove('petting');
      this.sfx.purr(false);
    }
  }

  onKey(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || this.hud.modalOpen) return;
    if (this.barnRanch.active && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { this.barnRanch.request(e.key === 'ArrowRight' ? 1 : -1); return; }   // [barn]
    if (this.state.phase === 'egg' && this.view !== 'ranch' && (e.key === ' ' || e.key === 'Enter') && this.egg && e.target === this.canvas) {
      e.preventDefault();
      this.sfx.unlock();
      this.tapEgg(this.egg.group.position.clone().add(new THREE.Vector3(0, 0.8, 0.5)));
      return;
    }
    if (this.state.phase !== 'play') return;
    this.behave.onKey(e);
    if ((e.key === ' ' || e.key === 'Enter') && e.target === this.canvas) {
      e.preventDefault();
      this.sfx.unlock();
      if (this.sim.asleep) { this.wakeUp('poked'); return; }
      const f = this.slime.faceWorld(this.v1).clone();
      f.x += (Math.random() - 0.5) * 0.4; f.y += (Math.random() - 0.5) * 0.3;
      this.boop(f);
      return;
    }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= FOODS.length && !e.metaKey && !e.ctrlKey && !e.altKey) {
      this.sfx.unlock();
      this.tossFood(FOODS[n - 1].id, this.hud.foodEls?.[FOODS[n - 1].id]?.b);
    }
  }

  // ---------- boop / pet ----------
  boop(point, region = null) {
    const r = this.sim.boop();
    this.markDirty(false);
    if (r.becameDizzy) {
      this.slime.poke(point, 1.3);
      this.slime.kick(0.07);
      this.sfx.dizzy();
      this.hud.say('@_@ too much!', 1600);
      if (r.firstDizzy) {
        this.remember('💫', `Too many boops at once made ${this.Name} dizzy.`, 'dizzy');
        this.hud.toast(`<b>Whoa, dizzy!</b>Boop in a steady rhythm to keep ${esc(this.Name)} giggling without overdoing it.`, '', 4800);
      }
      return;
    }
    if (r.dizzy) { this.slime.poke(point, 0.5); return; }
    this.slime.poke(point, this.sim.fever ? 1.15 : 1);
    this.sfx.boop(this.sim.fever ? 1.15 : 1);
    this.buzz(8);
    if (this.sim.fever ? Math.random() < 0.5 : Math.random() < 0.12) this.sfx.giggle();
    this.fx.emit('drops', point, { color: this.slimeHex(), count: this.sim.fever ? 7 : 4 });
    if (this.sim.fever) this.fx.emit('sparkles', point, { count: 3, rainbow: true });
    this.hud.floatText(this.pointerPx.x, this.pointerPx.y - 10, '+' + fmt(r.gain), this.sim.fever ? 'big' : '');
    this.flash({ eyes: this.sim.fever ? 'happy' : 'wince', mouth: this.sim.fever ? 'grin' : 'open', blush: 0.7 }, this.sim.fever ? 0.5 : 0.14);
    if (Math.random() < 0.25) this.helpers3d.cheer();
    if (r.bondUp) this.onBondUp(r.bondUp);
    if (r.exhausted) this.after(0.3, () => this.fallAsleep('exhausted'));
    if (this.state.stats.boops === 1) this.remember('👆', `First boop! ${this.Name} giggled.`, 'boop1');
    if (this.state.stats.boops === 1000) this.remember('👆', `A thousand boops together.`, 'boop1000');
    this.behave.onBoop(point, region, r);
  }

  updatePetting(dt) {
    const p = this.press;
    const active = !!(p && p.petting && p.over && this.time - p.lastMoveT < 0.22);
    this.petActive = active;
    if (!active) { this.sfx.purr(false); return; }
    const r = this.sim.pet(dt);
    if (this.sim.asleep) {
      this.sim.addBond(0.15 * dt);
      this.heartT -= dt;
      if (this.heartT <= 0) { this.heartT = 0.6; this.fx.emit('hearts', this.slime.headTopWorld(this.v1), { count: 1, size: 0.16 }); }
      return;
    }
    this.sfx.purr(true);
    this.petAccum += r.gain;
    this.petTextT -= dt;
    if (this.petTextT <= 0 && this.petAccum > 0) {
      this.petTextT = 0.5;
      this.hud.floatText(this.pointerPx.x, this.pointerPx.y - 26, '+' + fmt(this.petAccum));
      this.petAccum = 0;
    }
    this.heartT -= dt;
    if (this.heartT <= 0) {
      this.heartT = 0.32;
      const h = this.slime.headTopWorld(this.v1);
      h.x += (Math.random() - 0.5) * 0.8 * this.slime.size;
      this.fx.emit('hearts', h, { count: 1 });
    }
    if (this.sim.bondLevel() >= 7) this.slime.emissiveBoost = 0.12;
    if (r.bondUp) this.onBondUp(r.bondUp);
    const req = this.requests.active;
    if (req && req.type === 'pets') {
      req.petProgress += dt;
      if (req.petProgress >= 2) this.fulfillPets();
    }
    if (this.state.stats.petTime > 1 && !this.state.memKeys.includes('pet1')) this.remember('🤲', `${this.Name} melted into their first pets.`, 'pet1');
    this.markDirty(false);
  }

  // ---------- sleep ----------
  fallAsleep(reason) {
    if (this.sim.asleep || this.state.phase !== 'play') return;
    if (this.requests.active) { this.requests.clear(); this.hud.hideAsk(); }
    this.sim.asleep = true;
    this.slime.cap.on = true;
    this.sleepT = 0;
    this.state.stats.naps++;
    this.sfx.yawn();
    this.flash({ eyes: 'sleep', mouth: 'yawn', blush: 0.3 }, 1.2);
    if (reason === 'exhausted') this.hud.say('so... tired...', 1600);
    if (!this.state.memKeys.includes('nap1')) this.remember('🌙', reason === 'tucked' ? `You tucked ${this.Name} in for their first nap.` : `${this.Name} dozed off for their first nap.`, 'nap1');
    this.markDirty(true);
  }

  wakeUp(kind) {
    if (!this.sim.asleep) return;
    if (kind === 'poked' && !this.sim.canWake()) {
      // too sleepy: it rolls over and keeps napping (no spamming a worn-out slime)
      this.slime.squish(0.4);
      this.sfx.grumble();
      this.hud.say(['Zzz... five more minutes...', 'mmmnope... zzz', '*snore*'][Math.floor(Math.random() * 3)], 1500);
      return;
    }
    this.sim.asleep = false;
    this.slime.cap.on = false;
    this.lastInteract = this.time;
    const s = this.state.slime;
    if (kind === 'poked' && s.energy < 60) {
      this.flash({ eyes: 'normal', mouth: 'pout', brows: 'determined', eyeOpen: 0.6 }, 1.8);
      this.sfx.grumble();
      this.hud.say('Hmph...', 1400);
      s.joy = clamp(s.joy - 4, 0, 100);
      this.slime.squish(0.6);
    } else {
      this.flash({ eyes: 'happy', mouth: 'open', blush: 0.6 }, 1.3);
      this.slime.stretch(1.4);
      this.sfx.mii();
      this.hud.say(kind === 'rested' ? 'Mmm, all better!' : '!', 1500);
    }
  }

  updateSleep(dt) {
    const s = this.state.slime;
    if (!this.sim.asleep) {
      const idle = this.time - this.lastInteract;
      if (s.energy <= 0.5) this.fallAsleep('exhausted');
      const night = this.behave.isNight();
      if (s.energy < (night ? 50 : 30) && idle > (night ? 40 : TUNING.autoSleepIdle) && !this.busy() && !this.press) this.fallAsleep('dozed');
      return;
    }
    this.sleepT += dt;
    this.zzzT -= dt;
    if (this.zzzT <= 0) {
      this.zzzT = 1.3;
      const h = this.slime.headTopWorld(this.v1);
      h.x += 0.25 * this.slime.size;
      this.fx.emit('zzz', h, {});
    }
    this.snoreT -= dt;
    if (this.snoreT <= 0) { this.snoreT = 3.2; this.sfx.snore(); }
    if (Math.random() < dt * 0.8) this.fx.emit('dream', this.slime.centerWorld(this.v1).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.4, 0.3)), {});
    if (s.energy >= 99.5 && this.sleepT > 4) this.wakeUp('rested');
  }

  // ---------- food ----------
  foodPointerDown(id, e, btn) {
    this.sfx.unlock();
    if (this.state.phase !== 'play' || e.button > 0) return;
    e.preventDefault();
    if (!this.sim.foodUnlocked(id)) {
      const f = FOOD_BY_ID[id];
      const st = STAGES.find(s => s.id === f.unlock);
      this.hud.shakeFood(id);
      this.sfx.error();
      this.hud.toast(`<b>${esc(f.name)}</b>Unlocks when ${esc(this.Name)} becomes a ${esc(st.name)}.`);
      return;
    }
    this.foodPress = { id, btn, pointerId: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
    try { btn.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  rejectFood(id, reason, btn) {
    const f = FOOD_BY_ID[id];
    if (reason === 'poor') {
      this.hud.shakeFood(id);
      this.sfx.error();
      this.hud.toast(`<b>Not enough jelly</b>${esc(an(f.name)).replace(/^a/, 'A')} costs ${fmt(this.sim.foodPrice(id))}. Boop or pet ${esc(this.Name)} to collect more.`);
    } else if (reason === 'full') {
      this.flash({ eyes: 'happy', mouth: 'flat', sweat: true }, 1.4);
      this.slime.leanX.v -= 1.2;
      this.sfx.grumble();
      this.hud.say('So full...', 1500);
    } else if (reason === 'asleep') {
      this.hud.toast(`<b>Shh</b>${esc(this.Name)} is napping. Snacks can wait.`);
    }
    return false;
  }

  startFoodDrag() {
    const fp = this.foodPress;
    fp.dragging = true;
    const obj = makeFood(fp.id);
    obj.scale.setScalar(1.55);
    this.scene.add(obj);
    this.held = { id: fp.id, obj, t: 0 };
    this.lastInteract = this.time;
    this.positionHeld(0);
  }

  positionHeld(dt) {
    const h = this.held;
    if (!h) return;
    h.t += dt;
    const p = this.pointerWorld;
    h.obj.position.set(p.x, p.y + Math.sin(h.t * 6) * 0.03, p.z);
    h.obj.rotation.y += dt * 1.2;
  }

  dropHeld(cancel) {
    const h = this.held;
    if (!h) return;
    this.held = null;
    const mouth = this.slime.mouthWorld(this.v1);
    const over = !!this.slime.hit(this.raycaster);
    const near = h.obj.position.distanceTo(mouth) < 0.65 + this.slime.size * 0.6;
    if (!cancel && (over || near)) {
      const can = this.sim.canFeed(h.id);
      if (can.ok && !this.eating) { this.beginEat(h.id, h.obj); return; }
      if (can.ok && this.eating) { this.feedQueue.push(h.id); this.scene.remove(h.obj); return; }
      this.rejectFood(h.id, can.reason);
    }
    this.falling.push({ obj: h.obj, v: new THREE.Vector3(0, 1, 0), t: 0 });
  }

  tossFood(id, btn, opts = {}) {
    if (this.state.phase !== 'play') return false;
    if (!this.sim.foodUnlocked(id)) { this.hud.shakeFood(id); return false; }
    const can = this.sim.canFeed(id);
    if (!can.ok) return this.rejectFood(id, can.reason, btn);
    if (this.flying || this.eating) {
      if (this.feedQueue.length < 2) this.feedQueue.push(id);
      return true;
    }
    this.lastInteract = this.time;
    const obj = makeFood(id);
    obj.scale.setScalar(1.4);
    let from;
    if (btn && btn.getBoundingClientRect) {
      const r = btn.getBoundingClientRect();
      const ndc = new THREE.Vector2((r.left + r.width / 2) / innerWidth * 2 - 1, -((r.top + r.height / 2) / innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.stage.camera);
      from = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.6), from)) from.set(0, 0.2, 2.6);
    } else {
      from = new THREE.Vector3(opts.auto ? -3.5 : 0, 0.3, 2.4);
    }
    obj.position.copy(from);
    this.scene.add(obj);
    this.flying = { id, obj, from, t: 0, dur: 0.55 };
    return true;
  }

  beginEat(id, obj) {
    this.eating = { id, obj, phase: 'approach', t: 0, from: obj.position.clone(), s0: obj.scale.x };
  }

  updateFood(dt) {
    if (this.held) this.positionHeld(dt);
    if (this.flying) {
      const f = this.flying;
      f.t += dt / f.dur;
      const mouth = this.slime.mouthWorld(this.v1);
      const k = clamp(f.t, 0, 1);
      f.obj.position.lerpVectors(f.from, mouth, ease(k));
      f.obj.position.y += Math.sin(k * Math.PI) * 1.2;
      f.obj.rotation.x += dt * 6; f.obj.rotation.z += dt * 4;
      if (f.t >= 1) {
        this.flying = null;
        const can = this.sim.canFeed(f.id);
        if (can.ok) this.beginEat(f.id, f.obj);
        else { this.rejectFood(f.id, can.reason); this.falling.push({ obj: f.obj, v: new THREE.Vector3(0.5, 2, 1), t: 0 }); }
      }
    }
    const e = this.eating;
    if (e) {
      e.t += dt;
      if (e.phase === 'approach') {
        const k = clamp(e.t / 0.16, 0, 1);
        const mouth = this.slime.mouthWorld(this.v1);
        e.obj.position.lerpVectors(e.from, mouth, ease(k));
        e.obj.scale.setScalar(e.s0 * (1 - k * 0.45));
        this.chompOpen = 1;
        if (k >= 1) {
          this.scene.remove(e.obj);
          const can = this.sim.canFeed(e.id);
          if (!can.ok) { this.rejectFood(e.id, can.reason); this.eating = null; this.chompOpen = 0; return; }
          const before = { ...this.state.slime.traits };
          const tummyBefore = this.state.slime.tummy;
          const r = this.sim.feed(e.id);
          e.r = r;
          this.afterFeed(r, before);
          this.behave.onFed(r, tummyBefore);
          this.sfx.munch(r.def.sound);
          this.slime.squish(0.9);
          if (e.id === 'cookie') this.fx.emit('crumbs', this.slime.mouthWorld(this.v1), {});
          e.phase = 'chew'; e.t = 0; e.chomps = 0;
        }
      } else if (e.phase === 'chew') {
        this.chompOpen = 0.65 * Math.abs(Math.sin(e.t * Math.PI / 0.17));
        const n = Math.floor(e.t / 0.17);
        if (n > e.chomps) { e.chomps = n; this.slime.squish(0.35); }
        if (e.t >= 0.52) {
          e.phase = 'gulp'; e.t = 0; this.chompOpen = 0;
          this.slime.startGulp();
          this.sfx.gulp();
        }
      } else if (e.phase === 'gulp') {
        if (e.t >= 0.28) {
          this.slime.addInner(e.id);
          this.eating = null;
          this.react(e.r);
          if (this.feedQueue.length) {
            const next = this.feedQueue.shift();
            this.after(0.25, () => this.tossFood(next, this.hud.foodEls?.[next]?.b));
          }
        }
      }
    }
    for (const f of this.falling) {
      f.t += dt;
      f.v.y -= 9 * dt;
      f.obj.position.addScaledVector(f.v, dt);
      f.obj.scale.multiplyScalar(Math.exp(-dt * 3));
    }
    const gone = this.falling.filter(f => f.t > 0.9);
    for (const f of gone) this.scene.remove(f.obj);
    if (gone.length) this.falling = this.falling.filter(f => f.t <= 0.9);
  }

  afterFeed(r, before) {
    const st = this.state, s = st.slime;
    const name = this.Name;
    this.slime.setTraits(s.traits);
    this.markDirty(true);
    if (st.stats.feeds === 1) this.remember(r.def.id, `${name}'s very first snack: ${an(r.def.name)}.`, 'feed1');
    else if (r.firstTime) this.remember(r.def.id, `${name} tried ${an(r.def.name)} for the first time.`, 'try-' + r.def.id);
    for (const k of TRAIT_IDS) {
      if (before[k] < 10 && s.traits[k] >= 10) {
        this.after(1.2, () => {
          this.remember('✨', `${name} grew ${TRAITS[k].look}!`, 'grew-' + k);
          this.hud.toast(`<b>${esc(name)} is changing</b>All those snacks gave them ${esc(TRAITS[k].look)}.`, '', 3800);
          this.fx.emit('sparkles', this.slime.headTopWorld(this.v1), { count: 12 });
          this.sfx.sparkle();
          this.hud.dot('slime');
        });
      }
    }
    // trait float text
    const main = Object.entries(r.traitDeltas).sort((a, b) => b[1] - a[1])[0];
    if (main) {
      const sp = this.screenOf(this.slime.headTopWorld(this.v1));
      this.after(0.5, () => this.hud.floatText(sp.x + 40, sp.y, `${TRAITS[main[0]].name} +${main[1].toFixed(1)}`, 'trait', TRAITS[main[0]].color));
    }
    // answering a craving with the snack it asked for
    const req = this.requests.active;
    if (req && req.type === 'craving' && req.food === r.def.id && !req.waiting) {
      const waited = req.waited;
      this.requests.clear();
      this.hud.hideAsk();
      st.stats.requests++;
      s.joy = clamp(s.joy + (waited ? 14 : 8), 0, 100);
      const b = this.sim.addBond(waited ? 8 : 4);
      if (waited) this.sim.nudge('patient', 2); else this.sim.nudge('bold', 1.5);
      this.sim.nudge('cuddly', 1);
      if (b) this.onBondUp(b);
      this.after(0.9, () => this.hud.say(waited ? 'Worth the wait! ♥' : 'Yay! ♥', 1500));
      this.remember(r.def.id, waited ? `${name} waited patiently, then got the ${r.def.name} they wanted.` : `You gave ${name} the ${r.def.name} they asked for.`, waited ? 'req-waitgive' : 'req-give');
    }
    if (st.tutorial === 1) st.tutorial = 2;
  }

  react(r) {
    const name = this.Name;
    const head = this.slime.headTopWorld(new THREE.Vector3());
    const mouth = this.slime.mouthWorld(new THREE.Vector3());
    const center = this.slime.centerWorld(new THREE.Vector3());
    if (r.liked === 'favorite') {
      this.flash({ eyes: 'heart', mouth: 'grin', blush: 1 }, 1.8);
      this.fx.emit('hearts', head, { count: 7 });
      this.sfx.coo();
      this.after(0.3, () => this.sfx.giggle());
      this.slime.hop(4.5);
      this.hud.say(r.discovered ? '!!! ♥♥♥' : '♥', 1400);
    } else if (r.liked === 'dislike') {
      this.flash({ eyes: 'wince', mouth: 'bleh', sweat: true, blush: 0.1 }, 1.6);
      this.sfx.bleh();
      this.slime.kick(0.07);
      this.hud.say('Bleh!', 1300);
    } else if (r.overfed) {
      this.flash({ eyes: 'happy', mouth: 'o', sweat: true, blush: 0.5 }, 1.4);
      this.hud.say('So full...', 1400);
    } else {
      this.flash({ eyes: 'happy', mouth: 'cat', blush: 0.7 }, 1.1);
      this.fx.emit('hearts', head, { count: 2 });
      this.sfx.coo();
    }
    switch (r.def.id) {
      case 'chili':
        this.fx.emit('steam', head, { count: 6 });
        this.slime.emissiveBoost = 0.35;
        this.after(1.0, () => {
          this.sfx.sneeze();
          this.fx.emit('sparks', this.slime.mouthWorld(this.v1), { count: 14, dir: new THREE.Vector3(0, 0, 2.5) });
          this.flash({ eyes: 'wince', mouth: 'open' }, 0.45);
          this.slime.hop(3);
          this.slime.emissiveBoost = 0;
        });
        break;
      case 'iron': this.fx.emit('clank', mouth, {}); this.slime.squish(1.4); break;
      case 'moss': this.fx.emit('leaves', head, {}); break;
      case 'berry': this.fx.emit('sparks', center, { count: 12 }); this.slime.kick(0.08); this.sfx.munch('zap'); break;
      case 'crystal': this.fx.emit('prism', center, {}); this.slime.pulseGlow(0.7); break;
    }
    if (r.discovered === 'favorite') {
      this.remember(r.def.id, `Discovered ${name}'s favorite food: ${r.def.name}!`, 'fav');
      this.hud.toast(`<b>Favorite found!</b>${esc(name)} loves ${esc(r.def.name)}. Favorites give extra joy and bond.`, 'love', 4200);
    } else if (r.discovered === 'dislike') {
      this.remember(r.def.id, `${name} is not a fan of ${r.def.name}, but ate it anyway.`, 'dislike');
      this.hud.toast(`<b>Noted</b>${esc(name)} does not like ${esc(r.def.name)}. It still counts as a meal.`);
    }
    if (r.combo) {
      this.sfx.combo();
      this.fx.emit('prism', center, { count: 16 });
      this.hud.toast(`<b>${r.comboNew ? 'New combo! ' : ''}${esc(r.combo.name)}</b>${esc(r.combo.effect)}`, 'combo', 4200);
      if (r.comboNew) { this.remember('✨', `Discovered the ${r.combo.name} combo.`, 'combo-' + r.combo.id); this.hud.dot('journal'); }
      if (r.combo.glimmer) this.after(0.8, () => this.spawnGlimmer());
    }
    if (r.bondUp) this.onBondUp(r.bondUp);
    if (r.stageAfter > r.stageBefore) this.after(1.1, () => this.stageUp(r));
  }

  stageUp(r) {
    const st = STAGES[r.stageAfter];
    const name = this.Name;
    this.sfx.voice = st.voice;
    if (r.form) this.slime.setForm(r.form.id, { pure: r.form.pure });
    this.slime.pulseGlow(1.4);
    this.slime.spin();
    this.slime.hop(6.5);
    this.flash({ eyes: 'sparkle', mouth: 'grin', blush: 1 }, 2.5);
    const head = this.slime.headTopWorld(this.v1).clone();
    this.fx.emit('confetti', head, { count: 50 });
    this.fx.emit('sparkles', head, { count: 20, speed: 2.5 });
    this.sfx.levelUp();
    this.remember('⭐', `${name} grew into a ${st.name}!`, 'stage-' + st.id);
    if (r.form) this.remember('⭐', `${name} settled into ${an(r.form.name)}. ${r.form.blurb}`, 'form');
    const lin = this.state.slime.lineage || {};
    const parents = lin.parents?.length ? `${lin.parents[0].name} and ${lin.parents[1].name}` : 'its parents';
    if (r.form?.spark) {
      this.remember('✦', `The family spark came true! ${name} became ${an(r.form.name)}, something only ${parents} could pass on.`, 'spark-' + r.form.spark);
      this.after(2.4, () => { this.fx.emit('prism', this.slime.headTopWorld(this.v1).clone(), { count: 24, speed: 2 }); this.sfx.combo(); });
    } else if (r.nearMiss) {
      this.remember('✦', `${name} carried a family spark but grew into ${an(r.form.name)}. Clue: ${r.nearMiss.clue}`, 'nearmiss');
      this.after(4.5, () => this.hud.toast(`<b>So close!</b>${esc(name)} had a family spark from ${esc(parents)}. Clue for next time: ${esc(r.nearMiss.clue)}`, 'combo', 6500));
    } else if (r.form?.pure) {
      this.remember('✦', `${name} grew up just like ${parents}: ${an(r.form.name)}.`, 'pure');
    }
    const foods = FOODS.filter(f => f.unlock === st.id);
    let body = `<p>${esc(st.blurb)}</p><div class="unlocks">`;
    body += `<div class="unlock"><span style="font-size:22px;width:34px;text-align:center">x${st.boop}</span>Boops now give ${st.boop} base jelly</div>`;
    for (const f of foods) body += `<div class="unlock">${this.hud.icon(f.id)}New snack: ${esc(f.name)}</div>`;
    body += '</div>';
    const extra = r.form?.spark ? `<span class="sub spark-line">${ICON.sparkle}A family spark! Only ${esc(parents)} could pass this on.</span>`
      : r.form?.pure ? `<span class="sub spark-line">${ICON.sparkle}${esc(PURE_LINE.note)}</span>`
      : r.nearMiss ? `<span class="sub">${esc(name)} carried a family spark, but grew up a little differently. The Journal kept a clue.</span>` : '';
    if (r.form) body = `<p>Everything you shared shaped who ${esc(name)} became.</p><div class="card"><span class="form-name">${esc(r.form.name)}</span><span class="sub">${esc(r.form.blurb)}</span>${extra}</div>` + body;
    else if (r.stageAfter >= 1) body += '<p>Snacks cost more now, since bigger slimes eat bigger portions.</p>';
    this.after(1.6, () => this.hud.showSimple(r.form ? `${esc(name)} is all grown up!` : `${esc(name)} is now a ${esc(st.name)}!`, body, 'Yay!'));
    this.medalHold = this.time + 4;   // the Grown-Up Ribbon's ceremony waits for this card
    this.saveNow(true);
  }

  // ---------- medals: earned live, a small ceremony once per medal per slime (also after a reload) ----------
  // Waits for a calm moment at home: not asleep, not eating, no card open, not mid-goodbye.
  updateMedals(dt) {
    this.medalT = (this.medalT ?? 1) - dt;
    if (this.medalT > 0) return;
    this.medalT = 0.5;
    if (this.view === 'ranch' || this.hud.modalOpen || this.sim.asleep || this.busy() || this.departing || this.hatching || this.time < (this.medalHold || 0)) return;
    const got = this.sim.takeNewMedals();
    if (got.length) this.medalCeremony(got);
  }
  medalCeremony(list) {
    const m = list[list.length - 1], name = this.Name;
    for (const x of list) {
      this.remember(x.icon, x.id === 'ribbon' ? `${name} earned the Grown-Up Ribbon: all grown up!` : `${name} earned the ${x.name} medal: ${fmtShort(x.jelly)} jelly of their own.`, 'medal-' + x.id);
    }
    const head = this.slime.headTopWorld(this.v1).clone();
    this.fx.emit('confetti', head, { count: 40 });
    this.fx.emit('sparkles', head, { count: 16, speed: 2.4, color: '#ffe08a' });
    this.slime.pulseGlow(1);
    this.slime.hop(6);
    this.after(0.35, () => this.slime.spin());
    this.flash({ eyes: 'sparkle', mouth: 'grin', blush: 1 }, 2.2);
    this.sfx.levelUp();
    this.after(0.6, () => this.sfx.mii());
    this.hud.say(`${m.icon}!`, 1800);
    const perk = m.id === 'ribbon' ? 'All grown up. Every grown slime wears one.' : `${fmtShort(m.jelly)} jelly of their own! On the ranch: pearls x${m.pearls}, buyers pay +${Math.round(m.offers * 100)}%.`;
    this.hud.toast(`<span class="medal-ic" aria-hidden="true">${memIcon(m.icon, esc(m.icon))}</span><b>${esc(name)} earned ${esc(m.title)}!</b>${esc(perk)}`, 'medal-toast', 5200);
    this.hud.dot('slime');
    this.hud.updateMedalBadge();
    setMedalPin(this.slime, this.sim.medalShown());
    this.saveNow(true);
  }

  onBondUp(level) {
    const b = BOND[level];
    this.hud.toast(`<b>Bond grew: ${esc(b.title)}</b>${esc(b.unlock || '')}`, 'love', 4200);
    this.fx.emit('hearts', this.slime.headTopWorld(this.v1), { count: 8 });
    this.sfx.sparkle();
    this.remember('❤️', `Your bond grew: ${b.title}.`, 'bond-' + level);
    this.hud.dot('slime');
  }

  dance(sec) { this.danceUntil = this.time + sec; }

  buzz(ms) {
    if (!this.state.settings.sound || this.reduced) return;
    haptic(ms);   // web: navigator.vibrate as before; iPhone app: a light tap
  }

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

  // ---------- bubbles ----------
  startBubblePlay() {
    this.bubbleGame = { t: 0, popped: 0, total: 6 };
    const c = this.slime.centerWorld(new THREE.Vector3());
    for (let i = 0; i < 6; i++) this.after(i * 0.22, () => this.helpers3d.spawnBubble(true, c));
    this.hud.say('Pop them!', 1500);
    this.flash({ eyes: 'sparkle', mouth: 'open', blush: 0.8 }, 1.4);
    this.slime.hop(4);
    this.sfx.mii();
  }

  popBubble(b) {
    this.helpers3d.popBubble(b);
    this.sfx.pop();
    this.lastInteract = this.time;
    const gain = b.game ? Math.max(this.sim.boopValue() * 4, this.sim.jps() * 3) : this.sim.boopValue();
    this.sim.addJelly(gain);
    this.hud.floatText(this.pointerPx.x, this.pointerPx.y - 10, '+' + fmt(gain));
    this.lookOverride = { target: b.m.position.clone(), until: this.time + 0.6 };
    if (b.game && this.bubbleGame) {
      this.bubbleGame.popped++;
      this.slime.hop(3);
      this.sfx.giggle();
      this.flash({ eyes: 'happy', mouth: 'grin', blush: 0.8 }, 0.6);
      if (this.bubbleGame.popped >= this.bubbleGame.total) this.finishBubbleGame(true);
    }
  }

  finishBubbleGame(all) {
    if (!this.bubbleGame) return;
    this.bubbleGame = null;
    const s = this.state.slime;
    s.joy = clamp(s.joy + (all ? 10 : 5), 0, 100);
    const b = this.sim.addBond(all ? 4 : 2);
    if (b) this.onBondUp(b);
    this.hud.say(all ? 'Again! Again!' : 'That was fun!', 1600);
    this.sfx.coo();
    if (all) this.remember('🫧', `You popped every bubble with ${this.Name}.`, 'bubbles-all');
  }

  // ---------- glimmers ----------
  spawnGlimmer() {
    if (this.glimmer) return;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 2), new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#ffbf2e', emissiveIntensity: 1.6, roughness: 0.3 })));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.helpers3d.glowTex, color: '#ffd76a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(1.2);
    g.add(glow);
    const side = Math.random() < 0.5 ? -1 : 1;
    const y = 1.1 + Math.random() * 1.0;
    const path = [new THREE.Vector3(side * 5.5, y, 0.6), new THREE.Vector3(side * 1.5, y + 1.4, 2.2), new THREE.Vector3(-side * 1.5, y + 0.4, 1.8), new THREE.Vector3(-side * 5.5, y + 0.8, 0.4)];
    this.scene.add(g);
    this.glimmer = { obj: g, t: 0, dur: 14, path, trail: 0 };
    const curious = this.state.slime.personality.curious;
    this.glimmer.watch = Math.random() < 0.5 + curious / 150;
    if (this.glimmer.watch && !this.sim.asleep) this.after(0.8, () => { if (this.glimmer) { this.hud.say('!', 900); this.sfx.question(); } });
  }

  updateGlimmer(dt) {
    if (!this.glimmer) {
      if (this.state.phase === 'play' && this.state.tutorial >= 2) {
        this.glimmerT -= dt * this.sim.fx.glimmerRate;
        if (this.glimmerT <= 0) {
          this.glimmerT = TUNING.glimmerEvery[0] + Math.random() * (TUNING.glimmerEvery[1] - TUNING.glimmerEvery[0]);
          this.spawnGlimmer();
        }
      }
      return;
    }
    const gl = this.glimmer;
    gl.t += dt / gl.dur;
    const t = clamp(gl.t, 0, 1), u = 1 - t, p = gl.path;
    const pos = new THREE.Vector3()
      .addScaledVector(p[0], u * u * u).addScaledVector(p[1], 3 * u * u * t)
      .addScaledVector(p[2], 3 * u * t * t).addScaledVector(p[3], t * t * t);
    pos.y += Math.sin(this.time * 3) * 0.12;
    gl.obj.position.copy(pos);
    gl.obj.rotation.y += dt * 2;
    gl.obj.children[1].material.opacity = 0.7 + 0.3 * Math.sin(this.time * 8);
    gl.trail -= dt;
    if (gl.trail <= 0) { gl.trail = 0.07; this.fx.emit('glints', pos, {}); }
    if (gl.t >= 1) { this.scene.remove(gl.obj); this.glimmer = null; }
  }

  catchGlimmer() {
    const gl = this.glimmer;
    if (!gl) return;
    this.scene.remove(gl.obj);
    this.glimmer = null;
    const pos = gl.obj.position;
    this.fx.emit('sparkles', pos, { count: 24, speed: 3, color: '#ffe08a' });
    this.sfx.sparkle();
    this.after(0.15, () => this.sfx.giggle());
    const st = this.state;
    st.stats.glimmers++;
    const roll = Math.random();
    const jps = this.sim.jps(), bv = this.sim.boopValue();
    let msg;
    if (roll < 0.45) {
      this.sim.addBuff({ id: 'rush', name: 'Jelly Rush', dur: 30, jpsMult: 5 });
      msg = '<b>Jelly Rush!</b>Jelly per second x5 for 30 seconds.';
    } else if (roll < 0.82) {
      const amt = (Math.max(bv * 25 + 10, Math.min(st.jelly * 0.15, jps * 600) + jps * 30)) * this.sim.fx.glimmerMult;
      this.sim.addJelly(amt);
      msg = `<b>Lucky!</b>+${fmt(amt)} jelly.`;
      this.hud.floatText(this.pointerPx.x, this.pointerPx.y - 20, '+' + fmt(amt), 'big');
    } else {
      this.sim.addBuff({ id: 'sugar', name: 'Sugar Rush', dur: 15, boopMult: 7 });
      msg = '<b>Sugar Rush!</b>Boops give x7 for 15 seconds. Boop away!';
    }
    this.hud.toast(msg, 'combo', 3600);
    if (!this.sim.asleep) {
      this.flash({ eyes: 'sparkle', mouth: 'grin', blush: 1 }, 1.4);
      this.slime.hop(5);
      this.hud.say('Yay!', 1000);
    }
    this.remember('✨', `You caught a Lucky Glimmer while ${this.Name} cheered.`, 'glimmer1');
    this.markDirty(true);
  }

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

  // Test helper: run the game forward without drawing every frame.
  advance(sec, step = 1 / 30) {
    this.noRender = true;
    for (let t = 0; t < sec; t += step) { this.timeSkip += step * 1000; this.update(step); }
    this.noRender = false;
  }

  // Moving Day tester tools (#debug only): where this slime is, and one button per sign (plus the travel bundle).
  movingDayDebugHtml() {
    const R = movingDayRatio(this.state), lvl = movingDayLevel(R), mine = this.movingDay.signFor();
    const name = id => { const [axis, end] = MOVING_DAY.signs[id].lean; return PERSONALITY[axis][end]; };
    return `<div class="sec-title">Moving Day signs</div><p class="sub" id="mdStatus">R ${R ? R.toFixed(3) : '-'} (${lvl ? lvl.id : R ? 'not yet' : 'not grown up'}); levels at ${MOVING_DAY.levels.map(l => l.at).join(' / ')}. This slime's sign: ${esc(name(mine))}.${lvl ? ` Next sign in about ${Math.max(0, Math.round(this.movingDay.timer))} s of calm play.` : ''}</p>
      <div class="actions md-debug">${Object.keys(MOVING_DAY.signs).map(id => `<button class="btn small" data-dbg="sign:${id}">${esc(name(id))}</button>`).join('')}<button class="btn small" data-dbg="bundle">Travel bundle</button></div>`;
  }

  // Recipe body tester tools (#debug only): set the breed, variant and mix of this slime (and of the egg on the cushion).
  bodyDebugHtml() {
    const sl = this.state.slime, b = (k, v, l) => `<button class="btn small" data-dbg="body:${k}:${v}" aria-pressed="${String(sl[k]) === String(v)}">${l}</button>`;
    return `<div class="sec-title">Body</div><p class="sub" id="bodyStatus">${esc(bodyName(sl))}: breed ${esc(sl.breed)}, variant ${esc(sl.variant)}, mix ${(+sl.mix).toFixed(2)}.</p>
      <div class="actions body-debug">${b('mix', 0, 'Curly')}${b('mix', 0.25, 'Mix 25%')}${b('mix', 0.5, 'Mix 50%')}${b('mix', 0.75, 'Mix 75%')}${b('mix', 1, 'Dollop')}</div>
      <div class="actions body-debug">${b('variant', 'plain', 'Plain')}${b('variant', 'ears', 'Cat ears')}${b('variant', 'topknot', 'Topknot')}</div>`;
  }
  // Set this slime's body (and the cushion egg's, while it waits); the body morphs over to it. Test hook too.
  debugBody(patch, { instant = false } = {}) {
    const st = this.state, sl = st.slime;
    let mix = 'mix' in patch ? clamp(+patch.mix, 0, 1) : sl.mix;
    const variant = 'variant' in patch ? patch.variant : sl.variant;
    if ('variant' in patch && variant !== 'plain' && mix <= 0) mix = 1;   // ears and a topknot only show with some Dollop in it
    Object.assign(sl, cleanBody({ breed: 'set', mix, variant, genes: sl.genes }));
    if (st.phase === 'egg' && st.egg.bred) st.egg.bred.body = cleanBody(sl);
    this.slime.setRecipe(sl, { instant });
    this.markDirty(true);
    return cleanBody(sl);
  }

  debug(k) {
    const s = this.state.slime;
    if (k.startsWith('body:')) { const [, key, v] = k.split(':'); this.debugBody({ [key]: key === 'mix' ? +v : v }); this.openSettings(); return; }
    if (k.startsWith('sign:')) { this.hud.closeModal(); if (this.sim.asleep) this.wakeUp('rested'); this.movingDay.play(k.slice(5), { forced: true }); return; }
    if (k === 'bundle') { this.hud.closeModal(); this.movingDay.showBundle(); return; }
    if (k === 'jelly') this.sim.addJelly(10000);
    if (k === 'mega') this.sim.addJelly(1e7);
    if (k === 'grow') {
      const i = this.sim.stageIndex();
      const next = STAGES[i + 1];
      if (next) {
        const before = i;
        s.growth = next.minGrowth + 1;
        const r = { stageBefore: before, stageAfter: this.sim.stageIndex(), form: null };
        if (r.stageAfter === STAGES.length - 1) { const res = this.sim.settleForm(); r.form = res.form; r.nearMiss = res.nearMiss || null; s.form = r.form; }
        this.hud.closeModal();
        this.stageUp(r);
      }
    }
    if (k === 'needs') { s.tummy = 80; s.joy = 90; s.energy = 100; }
    if (k === 'glim') { this.hud.closeModal(); this.spawnGlimmer(); }
    if (k === 'req') { this.hud.closeModal(); this.state.tutorial = Math.max(3, this.state.tutorial); this.requests.timer = 0; }
    if (k === 'bond') { const b = this.sim.addBond(60); if (b) this.onBondUp(b); }
    if (k === 'pearls') { this.sim.ranch.addPearls(100); this.hud.renderRanch(true); }
    if (k === 'tera') this.sim.addJelly(1e12);
    if (k === 'rlLessons' || k === 'rlTrips') { this.hud.closeModal(); this.life.debugFinish(k === 'rlLessons' ? 'lessons' : 'trips'); }
    if (k === 'contests') this.debugContestStars();
    if (k === 'instant') {
      this.debugInstant = !this.debugInstant;
      try { localStorage.setItem('slimekin.debug.instantEggs', this.debugInstant ? '1' : '0'); } catch { /* private mode */ }
      this.instantEggs();
      this.openSettings();
    }
  }
  // ---------- contests: the #debug path (the screens: ui/contests.js and contest-show.js) ----------
  // g.contests.enter(residentId, contestId, cheers, { cup }) runs a show (core/contests.js scoreShow) and writes its
  // result into the save (applyShow); returns the show with `given` (what it brought). cheers: 'perfect' | 'good' |
  // 'nice' | 'none' | 'mash' | 'skip', or per act a grade or a list of tap times (s from the ring appearing).
  // g.contests.dress(residentId, slot, outfitId | null): Dress up with an outfit the family owns.
  contestsDebug() {
    const done = () => { this.markDirty(true); this.saveNow(); this.hud.renderRanch(true); if (this.barnRanch.on) this.barnRanch.renderCard(); };
    return {
      enter: (id, contestId, cheers = 'good', opts = {}) => {
        const res = scoreShow(this.state, id, contestId, { cheers, reducedMotion: !!this.reduced, ...opts });
        if (!res.ok) return res;
        res.given = applyShow(this.state, res, this.nowMs());
        if (res.given?.journal) this.hud.dot('journal');
        done();
        return res;
      },
      preview: (id, contestId, cheers = 'none', opts = {}) => scoreShow(this.state, id, contestId, { cheers, reducedMotion: !!this.reduced, ...opts }),
      dress: (id, slot, outfitId = null) => { const r = dressUp(this.state, id, slot, outfitId); if (r.ok) done(); return r; },
    };
  }
  // Debug "Contest stars": the resident on the barn's stand (or the first one home and free) learns every star its talents
  // allow and is perfectly happy, so it can try every cup.
  debugContestStars() {
    const R = this.state.ranch.residents;
    const x = (this.barnRanch.on && R.find(r => r.id === this.barnRanch.curId)) || R.find(r => !r.trip && !r.lesson) || R.find(r => !r.trip);
    if (!x) { this.hud.toast('<b>No one to train</b>Move a slime to the ranch first.', '', 2400); return null; }
    for (const id of SKILL_IDS) x.skills[id] = Math.max(x.skills[id] || 0, starCap(x, id));
    x.happiness = 100;
    this.hud.closeModal();
    this.hud.toast(`<b>Debug: contest stars</b>${esc(x.name)} has every star it can learn.`, '', 2400);
    this.markDirty(true);
    this.hud.renderRanch(true);
    if (this.barnRanch.on) this.barnRanch.renderCard();
    return x.id;
  }
  // Debug "Instant eggs": every waiting egg (and the egg on the cushion) is ready now and no parent is resting.
  instantEggs() {
    if (!DEBUG || !this.debugInstant) return;
    const rr = this.sim.ranch, now = this.nowMs(), ce = this.state.egg;
    for (const e of rr.eggs()) e.readyAt = Math.min(e.readyAt, now);
    if (ce.readyAt) { ce.readyAt = Math.min(ce.readyAt, now); if (ce.bred) ce.bred.readyAt = Math.min(ce.bred.readyAt, now); }
    if (this.state.phase === 'egg') this.updateEggHint();
    for (const x of this.state.ranch.residents) x.bredDay = null;
    this.syncNursery();
    this.hud.renderRanch(true);
    this.markDirty(true);
  }

  // ---------- theme / layout ----------
  watchTheme() {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = root.getAttribute('data-theme');
      const dark = t === 'dark' || (t !== 'light' && mq.matches);
      if (dark !== this.stage.dark) this.stage.setTheme(dark);
    };
    apply();
    mq.addEventListener?.('change', apply);
    new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  layoutChanged() {
    this.resize();
    setTimeout(() => this.resize(), 400);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    if (!this.stage) return;
    this.stage.resize(w, h, this.viewOff.x, this.viewOff.y);
    this.computeViewGoal();
  }

  computeViewGoal() {
    const w = innerWidth, h = innerHeight;
    let x = 0, y = 0, zoom = 1;
    const mobileTop = window.matchMedia('(max-width: 860px)').matches;
    this.topLimit = mobileTop ? document.querySelector('.top').getBoundingClientRect().bottom : 0;
    if (this.view === 'ranch') { this.stage.fitZoom = 1; return; }   // [barn] the barn fits its stand each frame
    if (this.state.phase === 'play') {
      const mobile = window.matchMedia('(max-width: 860px)').matches;
      const panelEl = document.getElementById('panel');
      // a stretched (tall) menu covers most of the screen on purpose: keep the scene where it was behind it
      if (mobile && panelEl.classList.contains('tall')) return;
      const panel = panelEl.getBoundingClientRect();
      const top = document.querySelector('.top').getBoundingClientRect();
      const tray = document.getElementById('tray').getBoundingClientRect();
      if (!mobile) {
        x = (panel.width + 18) / 2;
        const free = (top.bottom + tray.top) / 2;
        y = (h / 2 - free) * 0.6;
      } else {
        const bottom = Math.min(tray.top, panel.top);
        const free = (top.bottom + bottom) / 2;
        y = h / 2 - free;
        // a tall menu leaves little room: zoom out so the slime still fits above it
        zoom = Math.max(1, Math.min(2.3, (h * 0.4) / Math.max(80, bottom - top.bottom)));
      }
    }
    this.stage.fitZoom = zoom;
    this.viewGoal.set(x, y);
  }

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

  // ---------- per-frame ----------
  updateTutorial() {
    const st = this.state;
    const name = this.Name;
    const mobile = window.matchMedia('(max-width: 860px)').matches;
    if (st.tutorial === 0 && st.stats.boops >= 5) st.tutorial = 1;
    if (st.tutorial === 1 && st.stats.feeds >= 1) st.tutorial = 2;
    if (st.tutorial === 2 && st.stats.petTime >= 1.2) st.tutorial = 3;
    if (st.tutorial === 3 && Object.values(st.helpers).some(n => n > 0)) st.tutorial = 4;
    let hint = null;
    if (this.requests.active) hint = null;
    else if (st.tutorial === 0) hint = `Boop ${name} to collect jelly`;
    else if (st.tutorial === 1) hint = st.jelly >= this.sim.foodPrice('cookie') ? `${name} looks hungry. Drag a Cookie onto them, or tap it` : `Boop a little more to afford a Cookie`;
    else if (st.tutorial === 2) hint = `Hold and stroke ${name} to pet them`;
    else if (st.tutorial === 3) hint = st.jelly >= HELPERS[0].cost ? (mobile ? 'Open the Shop below and buy a Tickle Feather' : 'Buy a Tickle Feather in the Shop') : `Save ${HELPERS[0].cost} jelly for your first helper`;
    // (a low tummy shows as the "Hungry!" bubble by the slime and a pulsing ring, no hint needed)
    else if (this.sim.asleep) hint = `${name} is napping. Helpers gather extra dream jelly`;
    this.hud.setHint(hint);
  }

  updateIdle(dt) {
    const s = this.state.slime;
    this.idleT -= dt;
    if (this.idleT > 0) return;
    this.idleT = 4 + Math.random() * 6;
    if (this.busy() || this.sim.asleep || this.sim.dizzy > 0 || this.press || this.bubbleGame || this.transient && this.transient.until > this.time || this.movingDay.active) return;
    const p = s.personality;
    const bond = this.sim.bondLevel();
    const pointerNear = this.time - this.lastPointerMove < 2 && this.pointerWorld.distanceTo(this.slime.centerWorld(this.v1)) < 2.4;
    const opts = [
      [0.6 + p.playful / 50, () => { this.slime.hop(3 + p.playful / 40); this.sfx.bounce(); }],
      [0.5 + p.curious / 50, () => { this.lookOverride = { target: new THREE.Vector3((Math.random() - 0.5) * 8, 0.5 + Math.random() * 2.5, 1 + Math.random() * 2), until: this.time + 1.4 }; if (Math.random() < 0.4) this.sfx.question(); }],
      [0.4, () => { this.slime.kick(0.04); this.flash({ eyes: 'happy', mouth: 'cat' }, 0.8); }],
    ];
    if (s.energy < 35) opts.push([2, () => { this.flash({ eyes: 'sleep', mouth: 'yawn' }, 1.3); this.sfx.yawn(); }]);
    if (s.tummy < 20) opts.push([2, () => { this.flash({ eyes: 'normal', mouth: 'drool' }, 1.6); this.hud.say('...hungry', 1400); this.sfx.sad(); }]);
    if (bond >= 6 && s.joy > 70) opts.push([0.6, () => { this.sfx.hum(); this.fx.emit('notes', this.slime.headTopWorld(this.v1), { count: 2 }); this.flash({ eyes: 'happy', mouth: 'o' }, 1.2); }]);
    if (bond >= 5 && pointerNear) opts.push([0.8, () => { this.flash({ eyes: 'wink', mouth: 'kiss', blush: 1 }, 1.1); this.sfx.kiss(); this.fx.emit('hearts', this.slime.mouthWorld(this.v1), { count: 1, dir: new THREE.Vector3(0, 0.3, 2), size: 0.3 }); }]);
    if (bond >= 4 && pointerNear) opts.push([0.8, () => { this.fx.emit('hearts', this.slime.headTopWorld(this.v1), { count: 2 }); this.flash({ eyes: 'happy', mouth: 'cat', blush: 0.9 }, 1); }]);
    this.behave.idleOptions(opts, pointerNear);
    const total = opts.reduce((t, o) => t + o[0], 0);
    let r = Math.random() * total;
    for (const [w, fn] of opts) { r -= w; if (r <= 0) { fn(); break; } }
  }

  computeExpression() {
    const e = this.slime.expr;
    const s = this.state.slime;
    const sim = this.sim;
    e.eyes = 'normal'; e.mouth = 'smile'; e.mouthOpen = 0; e.blush = 0.35; e.eyeOpen = 1; e.tears = false; e.sweat = false; e.brows = null; e.eyeL = null; e.eyeR = null;
    if (s.joy > 78) { e.mouth = 'cat'; e.blush = 0.5; }
    else if (s.joy > 55) { e.mouth = 'smile'; }
    else if (s.joy > 32) { e.mouth = 'flat'; e.blush = 0.2; }
    else { e.mouth = 'frown'; e.brows = 'sad'; e.blush = 0.1; if (s.joy < 16) e.tears = true; }
    if (s.tummy < 15) e.mouth = 'drool';
    if (s.energy < 25) e.eyeOpen = 0.6;
    const req = this.requests.active;
    if (req) {
      if (req.waiting) { e.brows = 'determined'; e.mouth = 'pout'; }
      else if (req.type === 'sleepy') { e.eyeOpen = 0.5; e.mouth = 'o'; }
      else { e.eyes = 'sparkle'; e.mouth = 'o'; e.blush = 0.6; }
    }
    if (this.glimmer && this.glimmer.watch) { e.eyes = 'sparkle'; e.mouth = 'o'; }
    if (this.held || this.flying) {
      const id = (this.held || this.flying).id;
      const obj = (this.held || this.flying).obj;
      const d = obj.position.distanceTo(this.slime.mouthWorld(this.v2));
      const near = clamp(1 - (d - 0.4) / 2.2, 0, 1);
      if (s.tummy >= 97) { e.mouth = 'flat'; e.sweat = true; }
      else if (id === s.favorite) { e.eyes = 'sparkle'; e.mouth = 'open'; e.blush = 0.9; e.mouthOpen = 0.35 + near * 0.6; }
      else if (id === s.dislike) { e.eyes = 'normal'; e.mouth = 'wavy'; e.sweat = near > 0.4; e.brows = 'sad'; }
      else { e.eyes = 'wide'; e.mouth = 'o'; e.mouthOpen = near > 0.5 ? (near - 0.5) * 1.4 : 0; }
    }
    if (sim.fever) { e.eyes = 'happy'; e.mouth = 'grin'; e.blush = 0.85; }
    if (this.petActive) { e.eyes = 'happy'; e.mouth = 'cat'; e.blush = 0.95; }
    if (sim.dizzy > 0) { e.eyes = 'dizzy'; e.mouth = 'wavy'; e.blush = 0.2; e.sweat = true; e.brows = null; }
    if (sim.asleep) { e.eyes = 'sleep'; e.mouth = this.petActive ? 'cat' : 'o'; e.blush = this.petActive ? 0.8 : 0.4; e.mouthOpen = 0; e.brows = null; e.tears = false; }
    if (!sim.asleep) this.behave.applyExpression(e);
    if (!sim.asleep) this.movingDay.applyExpression(e);
    if (this.transient && this.transient.until > this.time) Object.assign(e, this.transient.expr);
    if (this.eating || this.chompOpen > 0) e.mouthOpen = Math.max(e.mouthOpen, this.chompOpen);
    if (this.state.phase === 'egg') { e.eyes = 'sleep'; }
  }

  computeLook() {
    const sl = this.slime;
    let target = null;
    if (this.lookOverride && this.lookOverride.until > this.time) target = this.lookOverride.target;
    else if (this.held) target = this.held.obj.position;
    else if (this.flying) target = this.flying.obj.position;
    else if (this.eating) target = null;
    else if (this.sim.asleep) target = null;
    else if (this.glimmer && this.glimmer.watch) target = this.glimmer.obj.position;
    else if (this.bubbleGame && this.helpers3d.bubbles.length) {
      const c = sl.centerWorld(this.v1);
      let best = null, bd = Infinity;
      for (const b of this.helpers3d.bubbles) { const d = b.m.position.distanceTo(c); if (b.game && d < bd) { bd = d; best = b; } }
      target = best ? best.m.position : null;
    } else if (this.time - this.lastPointerMove < 2.5 || this.sim.bondLevel() >= 1) target = this.pointerWorld;
    sl.lookTarget = target;
  }

  computeMotion() {
    const sl = this.slime;
    const t = this.time;
    let lx = 0, lz = 0, roll = 0;
    if (this.state.helpers.musicbox > 0 && !this.sim.asleep && !this.reduced) lx += Math.sin(t * 1.6) * 0.05;
    if (this.petActive && this.press) lx += clamp(this.press.dir * 0.18, -0.16, 0.16);
    else if (this.sim.bondLevel() >= 2 && !this.sim.asleep && this.time - this.lastPointerMove < 2) {
      const c = sl.centerWorld(this.v1);
      const dx = this.pointerWorld.x - c.x, dy = this.pointerWorld.y - c.y;
      if (Math.hypot(dx, dy) < 2.6) { lx += clamp(dx * 0.05, -0.08, 0.08); lz += 0.05; }
    }
    if (this.danceUntil > t) { lx += Math.sin(t * 9) * 0.13; if (Math.random() < 0.02) sl.hop(3.5); }
    if (this.sim.fever && !this.reduced) lx += Math.sin(t * 12) * 0.04;
    if (this.sim.dizzy > 0) { lx += Math.sin(t * 7) * 0.12; roll = Math.sin(t * 5) * 0.12; }
    const req = this.requests.active;
    if (req && !req.waiting) roll += 0.1;
    sl.leanX.target = lx;
    sl.leanZ.target = lz;
    sl.roll.target = roll;
    this.behave.applyMotion();
    this.movingDay.applyMotion();
    if (this.sim.asleep) { sl.breathAmp = 0.04; sl.breathRate = 1.3; }
    else if (this.sim.fever) { sl.breathAmp = 0.03; sl.breathRate = 5; }
    else { sl.breathAmp = 0.022; sl.breathRate = this.state.slime.energy < 25 ? 1.5 : 2.1; }
    if (!this.petActive && sl.emissiveBoost > 0 && !this.eating) sl.emissiveBoost *= 0.95;
  }

  // Nothing much happening: render at half rate to save battery.
  calm() {
    return this.state.phase === 'play' && this.time - this.lastInteract > 12 && this.time - this.lastPointerMove > 3 &&
      !this.press && !this.held && !this.flying && !this.eating && !this.glimmer && !this.bubbleGame && this.fx.live.length < 6 &&
      !this.movingDay.active &&   // a Moving Day sign moves the slime: full frame rate
      !(this.barnRanch.active && this.barnRanch.view.swapping);   // [barn] the burrow swap: full frame rate
  }

  // Watches for frames arriving late. Lowers graphics quality on "Auto" if the device keeps struggling.
  trackSpeed(gap, target, workMs) {
    const p = this.perf;
    p.t += gap / 1000;
    p.frames++;
    p.work += workMs;
    if (gap > target * 1.5 + 4) p.slow++;
    if (p.t >= 3) {
      const fps = p.frames / p.t, slowShare = p.slow / p.frames, work = p.work / p.frames;
      p.t = 0; p.frames = 0; p.slow = 0; p.work = 0;
      this.hud.setSpeed(this.state.settings.showFps ? `${Math.round(fps)} fps · ${work.toFixed(1)} ms · ${['high', 'medium', 'low'][p.level]}` : null);
      if (this.state.settings.quality === 'auto' && slowShare > 0.4 && p.level < 2 && !document.hidden) {
        p.level++;
        this.applySettings();
      }
    }
  }

  // Small signature effects of a grown-up form (steam, glints, sparks, pollen, smoke...).
  updateFormFx(dt) {
    const fx = this.slime.form?.fx;
    if (!fx || this.reduced) return;
    this.formFxT -= dt;
    if (this.formFxT > 0) return;
    this.formFxT = fx.every * (0.6 + Math.random() * 0.8);
    const sl = this.slime;
    const head = sl.headTopWorld(this.v1);
    const at = sl.formAnchor && sl.formAnchor.visible !== false && sl.formAnchor.parent?.visible !== false
      ? sl.formAnchor.getWorldPosition(new THREE.Vector3()) : head.clone();
    const r = 0.9 * sl.size;
    const side = new THREE.Vector3((Math.random() - 0.5) * 2 * r, -Math.random() * r, (Math.random() - 0.2) * r).add(head);
    const col = fx.color ? { color: fx.color } : {};
    switch (fx.kind) {
      case 'steam': this.fx.emit('steam', at, { count: 2, size: 0.2 }); break;
      case 'smoke': this.fx.emit('steam', at, { count: 1, size: 0.16, color: '#c9c2c2', speed: 0.15 }); break;
      case 'glints': this.fx.emit('glints', side, { size: 0.2, life: 0.9, ...col }); break;
      case 'sparks': this.fx.emit('sparks', at, { count: 3, speed: 1.6, ...col }); break;
      case 'embers': this.fx.emit('sparks', at, { count: 2, speed: 0.8, gravity: -1.5, life: 0.9, color: '#ff9a3d' }); break;
      case 'pollen': this.fx.emit('dream', side, { color: fx.color || '#ffe27a', size: 0.09, life: 2.6 }); break;
      case 'prism': this.fx.emit('prism', side, { count: 2, speed: 0.6, size: 0.14 }); break;
      case 'fizz': this.fx.emit('dream', head.clone().add(new THREE.Vector3((Math.random() - 0.5) * r, -0.1, (Math.random() - 0.3) * r)), { color: '#ffffff', size: 0.07, life: 0.8, speed: 0.4 }); break;
      case 'firework':
        this.fx.emit('sparks', at, { count: 2, speed: 0.9, life: 0.4, color: '#ffd75a' });
        this.fireworkT = (this.fireworkT || 0) + 1;
        if (this.fireworkT % 24 === 0) {
          const p = head.clone(); p.y += 1.6 * sl.size; p.x += (Math.random() - 0.5) * 1.2;
          this.fx.emit('prism', p, { count: 18, speed: 2.6 });
          this.fx.emit('sparks', p, { count: 10, speed: 2.4, color: '#fff3b0' });
          this.sfx.plip && this.sfx.plip();
        }
        break;
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
mixParts(Game, EggPart, WelcomePart, ShopPart, RanchPart, NurseryPart, MoveOutPart, NewHomesPart);
