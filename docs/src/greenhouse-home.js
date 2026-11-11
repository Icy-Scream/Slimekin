// Home's world (Settings > Background): the Greenhouse (the default), the Meadow or Classic, and the Greenhouse
// camera you can turn. The game calls in from a few marked places (applySettings, input, the frame).
//   - The Greenhouse room loads after the first frame, under the loading screen: the game's start waits for it
//     (firstLook, [r3b]), so the player never sees another scene before the Greenhouse. Past GREENHOUSE.arrive.wait home
//     shows the plain Classic look ('loading') and the room cross-fades in when it arrives (the last frame stays over it
//     and fades out: never a pop). If it cannot load (offline on the very first run, or a copy of the game without the
//     room's files) home stays on the Meadow, the setting is not changed, and it is logged once.
//   - In the Greenhouse the nursery's floor, rug, cushion, sky and stars, the meadow and the ranch hill are hidden. The
//     ranch screen is the Barn ranch in every Background (barn-ranch.js): nothing of home is drawn there.
//   - The camera turns only in the Greenhouse, at home, with no modal open: the camera button steps through the set
//     angles; a one-finger drag that starts on empty background turns it around the slime; two fingers pinch to zoom.
import * as THREE from 'three';
import { GREENHOUSE } from './data/content.js';
import { CUSHION_TOP } from './view/stage.js';
import { Greenhouse } from './view/greenhouse.js';
import { CamRig, groundY as roomGround } from './view/greenhouse-math.js';
import { groundY as meadowGround } from './view/helpers3d.js';
import { CameraButton } from './ui/camera-button.js';

const C = GREENHOUSE.camera;
const SETS = C.order;   // front, wide, left, right
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Home {
  constructor(game) {
    this.g = game;
    this.room = new Greenhouse(game.scene);
    this.room.seeThings = () => this.seeThings();   // [perf] what the room's see-through pass must show the room behind
    this.world = null;          // what shows: 'greenhouse' | 'meadow' | 'classic' | 'loading' (Classic look while the room loads)
    this.shown = false;         // [r3b] the loading screen has gone (from here on a change of the loading look cross-fades)
    this.hold = null;           // [r3b] the loading screen waiting for the room: { n: frames drawn, done }
    this.fadeTo = null;         // [r3b] the world to cross-fade to after the next frame is drawn
    this.veil = new Veil();     // [r3b] the cross-fade: the last frame of the loading look over the new world
    this.drawn = null;          // the world drawn last (data-home-world on the page, for the browser tests)
    this.rig = new CamRig();
    this.view = SETS.includes(game.state.settings.camView) ? game.state.settings.camView : 'front';
    this.free = false;          // turned by hand (off the set angles)
    this.touches = new Map();   // background pointers: id -> { x, y }
    this.dragging = false;
    this.pinchD = 0;
    this.btnT = 0;
    this.button = new CameraButton({ onTap: () => this.next() });
    game.canvas.addEventListener('wheel', e => this.wheel(e), { passive: true });
  }

  // ---------- the world ----------
  // From applySettings: pick what home shows for settings.scene.
  apply() {
    const g = this.g, want = g.state.settings.scene;
    this.room.setQuality(g.resolvedQuality());   // (Low: no cloche glass, no fireflies, steady fairy bulbs)
    let world = want;
    if (want === 'greenhouse') {
      if (this.room.failed) world = 'meadow';
      else if (!this.room.ready) { world = 'loading'; this.startLoad(); }
    }
    if (world === this.world) { this.fadeTo = null; return; }
    // [r3b] the loading look gives way after the loading screen has gone (the room came late, or it could not load, or the
    // Background changed meanwhile): the frame drawn next stays over the new world and fades out (afterRender)
    if (this.world === 'loading' && this.shown && !(g.barnRanch && g.barnRanch.active)) { this.fadeTo = world; return; }
    this.setWorld(world);
  }

  setWorld(world) {
    const g = this.g;
    this.world = world;
    g.scenery.setEnabled(world === 'meadow' || world === 'greenhouse');   // (in the Greenhouse it stays hidden)
    g.stage.setClassic(world === 'classic' || world === 'loading');
    g.helpers3d.setLayout(world === 'greenhouse' ? 'greenhouse' : 'meadow', this.room.meta);
    if (world === 'greenhouse') this.room.setNight(g.stage.dark, true);
    this.frameWorld();
  }

  startLoad() {
    if (this.loadAsked) return;
    this.loadAsked = true;
    // after the first frame, under the loading screen (the start waits for the room: firstLook)
    requestAnimationFrame(() => setTimeout(() => this.room.load().then(() => this.apply()), 0));
  }

  // [r3b] For the loading screen (main.js): resolves when home shows what it should, the Greenhouse room in and drawn
  // (GREENHOUSE.arrive.frames frames) or the Meadow because the room could not load; at the latest after
  // GREENHOUSE.arrive.wait seconds (then the Classic look shows until the room arrives). The Meadow and Classic never wait.
  firstLook() {
    if (this.world !== 'loading') { this.shown = true; return Promise.resolve(this.world); }
    return new Promise(res => {
      const done = why => {
        if (!this.hold) return;
        clearTimeout(this.hold.timer);
        this.hold = null;
        this.shown = true;
        res(why);
      };
      this.hold = { n: 0, done, timer: setTimeout(() => done('timeout'), GREENHOUSE.arrive.wait * 1000) };
    });
  }

  // [r3b] Right after the stage has drawn a frame (drew: false when nothing was drawn).
  afterRender(drew) {
    if (this.fadeTo) {   // that frame was the loading look: keep it over the new world while it fades out
      const w = this.fadeTo;
      this.fadeTo = null;
      if (drew) this.veil.cover(this.g.canvas);   // (Reduced motion too: a fade, nothing moves)
      this.setWorld(w);
    }
    if (this.hold && drew && this.world !== 'loading' && ++this.hold.n >= GREENHOUSE.arrive.frames) this.hold.done('ready');
  }

  get inRoom() { return this.world === 'greenhouse'; }
  setNight(dark) { this.room.setNight(dark); }
  // ground height at home (things that stand on the floor)
  groundY(x, z) { return this.inRoom ? roomGround(x, z) : meadowGround(x, z); }

  // Each frame (before the stage renders): who is visible, the room's blend, the camera's target, the button.
  frameWorld() {
    const g = this.g, st = g.stage;
    if (g.barnRanch && g.barnRanch.active) {   // [barn] the ranch screen is the barn: nothing of home is drawn
      if (this.veil.on) this.veil.off();   // [r3b] (nor home's cross-fade)
      this.room.group.visible = false;
      g.scenery.group.visible = false;
      st.setHabitat(false);
      st.setRoomLook(g.barnRanch.view);
      g.helpers3d.group.visible = false;
      g.ranch.group.visible = false;
      st.setMotes(false);
      return;
    }
    st.setMotes(true);
    if (this.inRoom) {
      this.room.group.visible = true;
      g.scenery.group.visible = false;
      st.setHabitat(false);
      st.setRoomLook(this.room);
      g.helpers3d.group.visible = true;
      g.ranch.group.visible = false;
    } else {
      this.room.group.visible = false;
      st.setHabitat(true);
      st.setRoomLook(null);
      g.helpers3d.group.visible = true;
      // the ranch hill behind home in the Meadow (not in the Classic look, nor while the room loads)
      g.ranch.group.visible = this.world !== 'classic' && this.world !== 'loading';
    }
  }

  update(dt) {
    if (this.drawn !== this.world) { this.drawn = this.world; document.documentElement.dataset.homeWorld = this.world; }
    this.veil.update(dt, GREENHOUSE.arrive.fade);   // [r3b]
    this.frameWorld();
    if (this.inRoom && this.room.group.visible) {
      const st = this.g.state;
      this.room.setLabel(st.slime.name, 'No. ' + String(st.ranch.family.generation).padStart(4, '0'));   // the name stake
      this.room.update(dt, this.g.stage.camera, this.g.reduced, this.slimeBox());
    }
    this.frameCamera(dt);
  }

  // The box round the slime's see-through body (or round the egg on the stump), for the menu objects that body may show.
  // Measured from the body's points four times a second (its shape changes slowly; the wobble is small).
  slimeBox() {
    const g = this.g, s = g.slime, b = this.body || (this.body = { box: new THREE.Box3(), t: -1, v: new THREE.Vector3(),
      egg: new THREE.Box3(new THREE.Vector3(-0.6, CUSHION_TOP, -0.6), new THREE.Vector3(0.6, CUSHION_TOP + 1.2, 0.6)) });
    if (!s.root.visible) { b.t = -1; return b.egg; }
    if (b.t >= 0 && g.time - b.t < 0.25) return b.box;
    b.t = g.time;
    const pos = s.geo.attributes.position, m = s.mesh.matrixWorld, box = b.box.makeEmpty();
    for (let i = 0; i < pos.count; i += 3) box.expandByPoint(b.v.fromBufferAttribute(pos, i).applyMatrix4(m));
    return box.isEmpty() ? b.egg : box;
  }

  // [perf] The see-through things at home, for the room's see-through pass (greenhouse.js cull()): spheres in each
  // thing's own space. The slime's body: round its points, measured four times a second (in its own space, so it
  // follows every hop and the send-off as it happens); its baby feet; the helpers' see-through goo and water.
  seeThings() {
    const g = this.g, s = g.slime, out = this._see || (this._see = []);
    out.length = 0;
    if (s.root.visible && s.mat.transmission > 0 && !(g.barnRanch && g.barnRanch.active)) {
      const b = this.bodySphere || (this.bodySphere = { c: [0, 0, 0], r: 0, t: -1, box: new THREE.Box3(), v: new THREE.Vector3() });
      if (b.t < 0 || g.time - b.t >= 0.25 || g.time < b.t) {
        b.t = g.time;
        const pos = s.geo.attributes.position, box = b.box.makeEmpty();
        for (let i = 0; i < pos.count; i++) box.expandByPoint(b.v.fromBufferAttribute(pos, i));
        if (box.isEmpty()) { b.c = [0, 0.7, 0]; b.r = 3.2; }   // (the body's own bounding sphere)
        else {
          box.getCenter(b.v); b.c = [b.v.x, b.v.y, b.v.z];
          let r2 = 0;
          for (let i = 0; i < pos.count; i++) r2 = Math.max(r2, b.v.set(pos.getX(i) - b.c[0], pos.getY(i) - b.c[1], pos.getZ(i) - b.c[2]).lengthSq());
          b.r = Math.sqrt(r2);
        }
      }
      if (s.mesh.visible) out.push({ obj: s.mesh, c: b.c, r: b.r });
      for (const f of s.feet) if (f.visible) out.push({ obj: f, c: [0, 0, 0], r: 1 });
    }
    for (const t of g.helpers3d.seeMeshes()) out.push(t);
    return out;
  }

  // ---------- the camera ----------
  // the camera turns here and now: the Greenhouse, at home, in play or with the egg, no modal, nothing leaving
  get canTurn() {
    const g = this.g, ph = g.state.phase;
    return this.inRoom && g.view !== 'ranch' && (ph === 'play' || ph === 'egg') && !g.hud.modalOpen && !g.departing && !g.hatching;
  }
  pivot() { return [0, CUSHION_TOP + 0.35 + 0.42 * this.g.slime.size, 0]; }

  setView(v) {
    this.view = v;
    this.free = false;
    this.rig.reset();
    this.endDrag();
    const s = this.g.state.settings;
    if (s.camView !== v) { s.camView = v; this.g.markDirty(false); }
    if (this.g.reduced) this.g.stage.snapNext = true;   // Reduced motion: no glide
  }
  // the button: Front -> Wide -> Left -> Right -> Front; after turning it by hand, back to Front
  nextView() { return this.free ? 'front' : SETS[(SETS.indexOf(this.view) + 1) % SETS.length]; }
  next() {
    if (!this.canTurn) return;
    const v = this.nextView();
    this.setView(v);
    this.button.tip(v);
    this.g.sfx.unlock && this.g.sfx.unlock();
    this.g.sfx.plip && this.g.sfx.plip();
  }

  // the camera as it is now, without the menu's zoom-out (what a drag starts from)
  currentPose() {
    const st = this.g.stage, z = st.zoom || 1, l = st.camLook, p = st.camPos;
    return { pos: [l.x + (p.x - l.x) / z, l.y + (p.y - l.y) / z, l.z + (p.z - l.z) / z], look: [l.x, l.y, l.z], fov: st.camera.fov };
  }
  beginFree() {
    if (!this.free) { this.rig.reset(); this.free = true; }
    const c = this.currentPose();
    this.rig.begin(c.pos, c.look, c.fov, this.pivot(), this.g.slime.size);
  }

  // A press on empty background (where the swipe for the secret code starts): it may turn the camera.
  down(e) {
    if (e.isPrimary) this.endDrag();   // the first finger of a new touch: anything left over was a lift we never saw
    if (!this.canTurn || this.touches.size) return;
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0 });
  }
  // A second finger while one is down on the background (anywhere, even on the slime): a pinch. Returns true when it
  // took the finger, so the game neither boops nor counts a swipe.
  second(e) {
    if (e.isPrimary) { this.endDrag(); return false; }   // a new touch, not a second finger (clears a lift we never saw)
    if (!this.canTurn || this.touches.size !== 1 || this.touches.has(e.pointerId)) return false;
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0 });
    this.pinchD = this.spread();
    this.dragging = true;
    this.beginFree();
    return true;
  }
  spread() { const [a, b] = [...this.touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
  // a move of one of our pointers: turn (one finger) or pinch (two). Returns true when it was ours.
  move(e) {
    const t = this.touches.get(e.pointerId);
    if (!t) return false;
    if (!this.canTurn) { this.endDrag(); return true; }
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    t.x = e.clientX; t.y = e.clientY; t.moved += Math.hypot(dx, dy);
    if (this.touches.size >= 2) {
      const d = this.spread();
      if (this.pinchD > 0 && d > 0) this.rig.pinch(d / this.pinchD, this.pivot());
      this.pinchD = d;
      return true;
    }
    if (!this.dragging) {
      if (t.moved < 6) return true;   // a tap stays a tap (the secret code counts taps)
      this.dragging = true;
      this.beginFree();
    }
    this.rig.turn(dx, dy, this.pivot());
    return true;
  }
  up(e) {
    if (!this.touches.delete(e.pointerId)) return;
    if (this.touches.size === 1) {   // one finger lifted from a pinch: the other turns on from where it is
      this.pinchD = 0;
      const [t] = this.touches.values();
      t.moved = 99;
      this.beginFree();
    } else if (!this.touches.size) this.dragging = false;
  }
  endDrag() { this.touches.clear(); this.dragging = false; this.pinchD = 0; }
  // a mouse wheel zooms like a pinch (desktop)
  wheel(e) {
    if (!this.canTurn || e.ctrlKey) return;
    this.beginFree();
    this.rig.pinch(Math.exp(-clamp(e.deltaY, -120, 120) * 0.0015), this.pivot());
  }

  // Where the stage's camera should be this frame (null = the home camera, Front).
  frameCamera(dt) {
    const g = this.g, st = g.stage;
    if (g.barnRanch && g.barnRanch.active) { this.button.show(false); return; }   // [barn] (its own fixed camera)
    if (!this.inRoom) { st.cam = null; this.button.show(false); return; }
    if (this.free) {
      const p = this.rig.pose(this.pivot());
      st.cam = p ? { pos: p.pos, look: p.look, fov: p.fov, rate: this.dragging ? C.follow : C.glide } : null;
    } else if (this.view === 'front') st.cam = null;
    else {
      const v = C.views[this.view], L = C.limits;
      // a gentle sway with the pointer, like the Front camera, kept inside the limits
      const sw = g.reduced ? 0 : 1, tx = g.parallax.x * 0.35 * sw, ty = g.parallax.y * 0.18 * sw;
      const x = clamp(v.pos[0] + tx, -L.x, L.x);
      const pos = [x, v.pos[1] + ty, v.pos[2]];
      st.cam = { pos, look: v.look, fov: v.fov, rate: C.glide };
    }
    // the button: shown where the camera can turn, unless the menu is stretched over it
    this.btnT -= dt;
    if (this.btnT <= 0) {
      this.btnT = 0.25;
      const on = this.canTurn && g.hud.sheetState() !== 'tall';
      const top = on && g.state.phase === 'play' ? Math.round(document.querySelector('.top').getBoundingClientRect().bottom + 10) : null;
      this.button.show(on, top);
    }
    this.button.set(this.free ? 'free' : this.view, this.nextView());
  }

  // how far the camera has turned from straight on (radians; 0 in Front): the food drag plane faces the camera
  yaw() {
    if (!this.inRoom || this.g.view === 'ranch' || (!this.free && this.view === 'front')) return 0;
    const p = this.g.stage.camPos;
    return Math.atan2(p.x, p.z);
  }
}

// [r3b] The cross-fade when the room arrives after the loading screen has gone: a picture of the last frame drawn before
// it (a 2D canvas over the scene, under everything else) fades out over the new world. Made only when needed, emptied after.
class Veil {
  constructor() { this.el = null; this.on = false; this.t = 0; this.fresh = false; }
  cover(src) {
    let c = this.el;
    if (!c) {
      c = this.el = document.createElement('canvas');
      c.id = 'homeFade';
      c.className = 'home-fade';
      c.setAttribute('aria-hidden', 'true');
      src.after(c);
    }
    c.width = src.width;
    c.height = src.height;
    try {
      const ctx = c.getContext('2d');
      ctx.drawImage(src, 0, 0);   // the frame just drawn (still there until this task ends)
      // a browser that hands back an empty picture: the loading screen's colour instead (still a soft fade, not a pop)
      if (ctx.getImageData(c.width >> 1, c.height >> 2, 1, 1).data[3] === 0) {
        ctx.fillStyle = getComputedStyle(document.getElementById('boot')).backgroundColor;
        ctx.fillRect(0, 0, c.width, c.height);
      }
    } catch (e) {
      this.off();   // no picture: the world just changes
      return;
    }
    c.style.opacity = '1';
    c.hidden = false;
    this.on = true;
    this.t = 0;
    this.fresh = true;   // the first frame of the new world is fully under it
  }
  update(dt, dur) {
    if (!this.on) return;
    if (this.fresh) { this.fresh = false; return; }
    this.t += dt;
    const k = Math.min(1, this.t / dur), o = 1 - k * k * (3 - 2 * k);   // eased out
    this.el.style.opacity = o.toFixed(3);
    if (k >= 1) this.off();
  }
  off() {
    this.on = false;
    if (!this.el) return;
    this.el.hidden = true;
    this.el.width = this.el.height = 1;   // let the picture's memory go
  }
}
