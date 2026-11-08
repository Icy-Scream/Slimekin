// The Barn ranch: the ranch screen is the baked barn, with one resident at a time on the show stand. This file decides
// who is on the stand (the ranch's own order, travelers left out, wrapping around), plays the swap when you ask
// (‹ ›, a quick sideways swipe, a resident picked in the menu) or when the one on the stand leaves, handles touch on
// the stand (tap and stroke pet, a quick swipe swaps and does not pet; pearls, the basket and the Nursery's nest), fills
// the name card, and fits the stand and the card above the menu sheet. game.js calls in from a few marked places
// ([barn]). The barn's 3D: view/barn.js; its plain math: view/barn-math.js; the card and buttons: ui/barn-card.js.
//   - The barn's files load ahead of time, in idle time once home has shown (preloadTick). The meadow ranch is never the
//     ranch screen: Ranch tapped before the files are in keeps you home with a short "Off to the barn" moment and opens
//     the barn the moment they arrive; when they cannot load (offline on the very first run, a copy of the game without
//     them) you stay home with one friendly toast, and the next tap tries again.
//   - At home nothing changes (the Meadow keeps its ranch hill; the Greenhouse hides it).
import * as THREE from 'three';
import { BARN } from './data/content.js';
import { BarnView } from './view/barn.js';
import { BarnCard, BarnWait } from './ui/barn-card.js';
import { standOrder, stepId, startId, nextAfterGone, swipeDir, pastSwipe, cardLine, cardCount, fitView, fovFor } from './view/barn-math.js';

// when a touch happened (ms): the event's own time (right even when frames are slow), else now
export const stamp = e => (e && e.timeStamp > 0 ? e.timeStamp : performance.now());

export class BarnRanch {
  constructor(game) {
    this.g = game;
    this.view = new BarnView(game.stage, { quality: game.resolvedQuality() });
    this.view.onWear = () => this.putOn(this.target, this.follow);
    this.view.onLanded = () => this.landed();
    this.card = new BarnCard({ prev: () => this.request(-1), next: () => this.request(1), open: () => this.openPage(), swipe: d => this.request(d) });
    this.wait = new BarnWait();   // "Off to the barn": Ranch tapped before the barn's files are in
    this.waiting = false;
    this.pre = { frames: 0, t: 0, asked: false };   // loading the barn ahead of time
    this.on = false;          // the barn is the ranch screen right now
    this.curId = null;        // the resident on the stand
    this.lastId = null;       // the one seen last (the barn opens on it next time)
    this.order = [];          // who can be on the stand, in order
    this.target = null;       // who the running swap puts on
    this.follow = false;      // a swap you asked for: an open resident page follows the stand
    this.queued = null;       // one more swap asked for during a swap
    this.back = {};           // trips that ended this session: id -> { place, at } (the card's "just back from ...")
    this.press = null;
    this.scale = 1;           // the picture's scale (a wider lens when the menu sheet leaves little room)
    this._cam = new THREE.PerspectiveCamera();
    this._v = new THREE.Vector3();
  }
  get active() { return this.on && this.g.view === 'ranch'; }

  // ---------- the barn's files, ahead of time ----------
  // Each frame: once home has shown its first frames (the Greenhouse room first, when that is home), the barn's files
  // start loading in idle time, so the game's start is never slowed and Ranch opens the barn at once.
  preloadTick(dt) {
    const p = this.pre, P = BARN.preload, home = this.g.home;
    if (p.asked) return;
    if (!home || !home.world || home.world === 'loading') return;
    p.frames++; p.t += dt;
    if (p.frames < P.frames || p.t < P.after) return;
    p.asked = true;
    const go = () => { if (!this.view.ready && !this.view.loading) this.view.load(); };
    if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: P.idle });
    else setTimeout(go, 0);
  }
  // From goRanch when the barn is not in yet: stay home with "Off to the barn" and open it the moment it is ready.
  // It can't load: stay home (back on the page you came from), one friendly toast; the next tap tries again.
  waitFor() {
    const g = this.g, v = this.view;
    if (this.waiting) return;
    if (v.failed) v.retry();
    this.waiting = true;
    this.wait.show(true, { still: g.reduced });
    const back = this.lastTab && this.lastTab !== 'ranch' ? this.lastTab : 'helpers';
    v.load().then(ok => {
      if (!this.waiting) return;   // called off: another tab, a goodbye
      this.waiting = false;
      this.wait.show(false);
      if (ok) { if (g.hud.tab === 'ranch') g.goRanch(); return; }
      g.ranchPage = null;
      g.ranchFocus = null;
      if (g.hud.tab === 'ranch') g.hud.selectTab(back);
      g.layoutChanged();
      g.hud.toast('<b>The barn needs the internet the first time.</b>Try again in a moment.', '', 3600);
    });
  }
  cancelWait() {
    if (!this.waiting) return;
    this.waiting = false;
    this.wait.show(false);
  }
  // the menu page shown before Ranch (where a failed wait goes back to)
  noteTab(t) { if (t !== 'ranch') this.lastTab = t; }

  // ---------- going to the ranch and back ----------
  // From goRanch, once the barn is ready (the ranch view is already set): the barn shows.
  enter() {
    const g = this.g, v = this.view, m = v.meta;
    this.on = true;
    this.justIn = true;
    this.cam = { pos: m.cam.pos, look: m.cam.look, fov: m.cam.fov };
    v.group.visible = true;
    v.setNight(g.stage.dark, true);
    v.setQuality(g.resolvedQuality());
    v.clock += 5;   // (no landing spring left over from last time)
    this.order = this.homeOrder();
    this.queued = null;
    this.putOn(startId(this.order, g.ranchFocus, this.lastId), false);
    g.syncNursery();
    v.setBasket(g.state.ranch.basket.stored, g.sim.ranch.basketCap());
    document.body.classList.add('in-barn');
    this.card.show(true);
    this.renderCard();
    this.hint();
    this.scale = 1;
    this.frame(0, true);
    g.stage.snapNext = true;
    g.layoutChanged();
  }
  // From leaveRanch: back home.
  leave() {
    if (!this.on) return;
    const g = this.g, v = this.view;
    this.on = false;
    if (v.swapping) {   // finish a swap at once (the stand is never left half-dressed)
      v.sw.on = false;
      v.applyClip(false);
      v.fadeEnd();
      if (v.sw.worn === false) this.putOn(this.target, false);
    }
    this.queued = null;
    this.gapT = false;
    this.press = null;
    v.group.visible = false;
    this.card.show(false);
    document.body.classList.remove('in-barn');
    g.stage.cam = null;
    g.slime.root.visible = g.slime.visible;
    if (g.egg) g.egg.group.visible = true;
  }

  // ---------- who is on the stand ----------
  // the ranch's own order without the travelers (Ranch life's homeResidents, the list every ranch sync uses)
  homeOrder() { return standOrder(this.g.life ? this.g.life.homeResidents() : this.g.state.ranch.residents); }
  resident(id) { return id ? this.g.sim.ranch.resident(id) : null; }
  // Dress the stand (null: nobody). follow: a resident page that is open follows the stand (a swap you asked for).
  putOn(id, follow) {
    const g = this.g, x = this.resident(id);
    this.curId = x ? x.id : null;
    if (x) this.lastId = x.id;
    this.view.dress(x);
    if (follow && x && g.ranchFocus && g.ranchFocus !== x.id && !g.ranchPage) { g.ranchFocus = x.id; g.hud.renderRanch(true); this.hint(); }
    this.renderCard();
  }
  // A swap you asked for: dir +1 next, -1 previous (‹ ›, a swipe).
  request(dir) {
    if (!this.active || this.g.hud.modalOpen) return;
    this.go({ dir, follow: true });
  }
  // A resident picked in the menu (Visit, its page): it comes up on the stand.
  show(id) {
    if (!this.active || !id || !this.order.includes(id)) return;
    if (id === this.curId && !this.view.swapping) { this.view.hop(3, 1.2); return; }
    if (this.justIn) { this.putOn(id, false); return; }
    this.go({ id, follow: false });
  }
  go(req) {
    const v = this.view;
    if (v.swapping || this.gapT) { this.queued = req; return; }
    const to = req.id !== undefined ? req.id : stepId(this.order, this.curId, req.dir);
    if (to === this.curId) { if (to) v.hop(3, 0.8); return; }   // one resident: a little hop instead
    this.target = to;
    this.follow = !!req.follow;
    v.startSwap({ reduced: this.g.reduced, fromEmpty: v.empty });
    const sfx = this.g.sfx;
    sfx.unlock && sfx.unlock();
    if (!this.g.reduced) { this.g.after(0.28, () => sfx.pop && sfx.pop()); if (to) this.g.after(0.45, () => sfx.bounce && sfx.bounce()); }
  }
  landed() {
    if (this.target) this.g.after(0.05, () => this.g.sfx.mii && this.active && this.g.sfx.mii());
    if (!this.queued) return;
    // one more swap was asked for: it starts a moment after this one lands (it stays queued until then)
    this.gapT = true;
    this.g.after(BARN.swap.queueGap, () => {
      this.gapT = false;
      const q = this.queued;
      this.queued = null;
      if (q && this.active) this.go(q);
    });
  }
  // The ranch's order changed: someone left (a new home, an auction, a trip) or came home (a traveler, a new resident).
  orderChanged(order) {
    const old = this.order;
    this.order = order;
    const v = this.view;
    if (v.swapping) {
      // the swap running now puts on someone who just left: it puts on the next one instead
      if (this.target && !order.includes(this.target)) this.target = nextAfterGone(old, order, this.target);
    } else if (this.curId && !order.includes(this.curId)) this.go({ id: nextAfterGone(old, order, this.curId), follow: false });
    else if (!this.curId && order.length) this.go({ id: order[0], follow: false });
    if (this.queued && this.queued.id && !order.includes(this.queued.id)) this.queued = null;
    this.renderCard();
  }
  // a trip ended (ranch life): the card says "just back from ..." for a while
  noteBack(r) { if (r && r.kind === 'trip' && !r.early) this.back[r.id] = { place: r.place, at: r.at }; }

  // ---------- the card ----------
  renderCard() {
    const g = this.g, R = g.state.ranch, x = this.resident(this.curId);
    if (!x) {
      const away = R.residents.filter(r => r.trip);
      if (away.length) {
        const first = away.reduce((a, b) => (a.trip.homeAt <= b.trip.homeAt ? a : b));
        this.card.set({ empty: true, title: away.length > 1 ? 'Everyone is on a trip' : `${first.name} is on a trip`, text: `${first.name} is home at ${g.life.clock(first.trip.homeAt)}.` });
      } else {
        const name = g.state.slime.name || 'your slime';
        this.card.set({ empty: true, title: 'Nobody lives here yet', text: `When ${name} is all grown up (Settled), they can move to the ranch.` });
      }
      return;
    }
    const c = cardLine(x, { now: g.nowMs(), back: this.back[x.id], perHour: g.sim.ranch.pearlRate(x) * 3600 });
    this.card.set({ name: x.name, breed: c.breed, line: c.line, count: cardCount(this.order.length, Math.max(0, this.order.indexOf(x.id))) });
  }
  openPage() {
    const g = this.g;
    if (!this.active) return;
    g.sfx.unlock && g.sfx.unlock();
    g.hud.openTab('ranch');   // (opens the menu sheet when it is closed)
    if (this.curId) g.focusResident(this.curId);
  }
  hint() {
    const g = this.g, x = this.resident(g.ranchFocus);
    const el = document.getElementById('ranchHint');
    if (!el) return;
    el.textContent = g.ranchPage === 'nursery' ? 'The Nursery. Pick two parents below.'
      : x && x.trip ? `${x.name} is on a trip.`
      : this.order.length > 1 ? 'Swipe for the next slime. Tap or stroke to pet.'
      : this.order.length ? 'Tap or stroke to pet.' : 'Your ranch slimes live here.';
  }

  // ---------- touch on the barn ----------
  down(e) {
    const g = this.g, hit = this.view.pick(g.raycaster);
    const p = this.press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, minX: e.clientX, maxX: e.clientX, t0: stamp(e), hit, petted: false, petT: -9, done: false };
    try { g.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!hit) return;
    if (hit.type === 'pearl') { g.pickRanchPearl(hit.pearl); p.done = true; }
    else if (hit.type === 'basket') { g.collectBasket(); p.done = true; }
    else if (hit.type === 'nursery') { g.openNursery(); p.done = true; }
  }
  move(e) {
    const p = this.press;
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    p.minX = Math.min(p.minX, p.x); p.maxX = Math.max(p.maxX, p.x);
    // stroking the slime keeps petting it, but only once the press can no longer be a quick swipe
    if (p.done || !p.hit || p.hit.type !== 'slime' || !pastSwipe(p, stamp(e))) return;
    const g = this.g;
    if (g.time - p.petT > BARN.strokeEvery) { g.petResident(p.hit.id, p.petted); p.petT = g.time; p.petted = true; }
  }
  up(e, cancel) {
    const p = this.press;
    this.press = null;
    if (!p || cancel || p.done) return;
    const dir = p.petted ? 0 : swipeDir(e.clientX - p.x0, e.clientY - p.y0, stamp(e) - p.t0);
    if (dir) { this.request(dir); return; }   // a quick sideways swipe swaps, and does not pet
    if (p.hit && p.hit.type === 'slime' && !p.petted && p.hit.id === this.curId) this.g.petResident(p.hit.id);   // a tap pets
  }

  // ---------- pearls ----------
  // A resident made a pearl while you watch: it pops out beside the stand (from the slime on the stand when it made
  // it), in its maker's color.
  spawnPearl(id) {
    const g = this.g, onStand = id === this.curId && !this.view.swapping;
    const r = g.ranch.resident(id);
    const color = onStand ? '#' + this.view.av.mat.color.getHexString() : r ? '#' + r.av.mat.color.getHexString() : '#ffffff';
    return this.view.spawnPearl(onStand, color);
  }

  // ---------- each frame ----------
  update(dt) {
    this.preloadTick(dt);
    if (!this.on) return;
    const g = this.g;
    if (g.view !== 'ranch') { this.leave(); return; }
    const order = this.homeOrder();
    if (order.length !== this.order.length || order.some((id, i) => id !== this.order[i])) this.orderChanged(order);
    // home is not drawn in the barn (the pet, the egg)
    g.slime.root.visible = false;
    if (g.egg) g.egg.group.visible = false;
    this.view.update(dt, g.stage.camera, g.reduced);
    this.frame(dt);
    this.renderCard();   // (every frame: it only touches the page when the card's words change)
    this.justIn = false;
  }
  // Fit the stand and the card between the top bar and the menu sheet (or the ranch bar): the camera's view slides up
  // and widens only as much as it must; with the sheet closed it is the barn's own camera, only slid up past the bars.
  frame(dt, snap = false) {
    const g = this.g, st = g.stage, h = innerHeight, w = innerWidth, F = BARN.frame;
    const mobile = window.matchMedia('(max-width: 860px)').matches;
    const panelEl = document.getElementById('panel'), pr = panelEl.getBoundingClientRect();
    const tall = mobile && panelEl.classList.contains('tall');
    const topBar = document.querySelector('.top').getBoundingClientRect().bottom;
    const bar = document.getElementById('ranchBar').getBoundingClientRect();
    let bottom = bar.height > 0 ? bar.top : h;
    if (mobile) bottom = panelEl.classList.contains('open') ? pr.top : Math.min(bottom, pr.top);
    bottom -= F.gap;
    const x = mobile ? 0 : (pr.width + 18) / 2;
    const cardH = this.card.height();
    if (!tall) {
      // where the stand's region is in the barn's own camera (no slide, no wider lens)
      const c = this._cam, m = this.cam;
      c.fov = m.fov; c.aspect = w / h; c.near = 0.1; c.far = 200;
      c.position.set(...m.pos); c.lookAt(...m.look); c.updateMatrixWorld(); c.updateProjectionMatrix();
      let nt = -Infinity, nb = Infinity;
      for (const [px, py, pz] of [[0, F.top, 0], [0, F.bottom, F.front], [-F.side, F.bottom, BARN.nest.z], [F.side, F.bottom, BARN.nest.z]]) {
        const v = this._v.set(px, py, pz).project(c);
        nt = Math.max(nt, v.y); nb = Math.min(nb, v.y);
      }
      this.fit = fitView(nt, nb, h, topBar + F.gap, bottom - cardH - F.gap);
    }
    const fit = this.fit || { scale: 1, off: 0 };
    this.scale = snap || Math.abs(fit.scale - this.scale) < 0.002 ? fit.scale : this.scale + (fit.scale - this.scale) * (1 - Math.exp(-dt * 6));
    g.viewGoal.set(x, fit.off);
    if (snap) {
      g.viewOff.set(x, fit.off);
      st.camera.setViewOffset(w, h, x, fit.off, w, h);
    }
    st.fitZoom = 1;
    st.cam = { pos: this.cam.pos, look: this.cam.look, fov: fovFor(this.cam.fov, this.scale), rate: 60 };
    st.snapNext = true;
    // the card above the sheet / the ranch bar, in the middle of the picture; the arrows at the slime's middle height
    const k = Math.tan(this.cam.fov * Math.PI / 360) / Math.tan(fovFor(this.cam.fov, this.scale) * Math.PI / 360);
    const mid = this._v.set(0, this.view.y0 + 0.8, 0).project(this._cam);
    const y = h / 2 * (1 - mid.y * k) - g.viewOff.y;
    this.card.place(h - bottom, w / 2 - g.viewOff.x, Math.max(topBar + 30, Math.min(y, bottom - cardH - 30)));
  }
  // (test hook) what the barn shows now
  info() {
    const v = this.view;
    return { on: this.on, ready: v.ready, failed: v.failed, waiting: this.waiting, preloaded: this.pre.asked, cur: this.curId, order: [...this.order], swapping: v.swapping, empty: v.empty, straw: v.liveStraw(), scale: this.scale, fit: this.fit, queued: !!this.queued, nest: v.nest ? v.nest.visible : false, pearls: v.pearls.length };
  }
}
