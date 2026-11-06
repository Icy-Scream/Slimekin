// Home's world (Settings > Background): the Greenhouse (the default), the Meadow or Classic, and the Greenhouse
// camera you can turn. The game calls in from a few marked places (applySettings, input, the frame).
//   - The Greenhouse room loads after the first frame; until it is ready home shows the plain Classic look. If it
//     cannot load (offline on the very first run, or a copy of the game without the room's files) home stays on the
//     Meadow, the setting is not changed, and it is logged once.
//   - In the Greenhouse the nursery's floor, rug, cushion, sky and stars, the meadow and the ranch hill are hidden at
//     home; while visiting the ranch the room hides and the meadow shows (the ranch stands on it), as on the test page.
//   - The camera turns only in the Greenhouse, at home, with no modal open: the camera button steps through the set
//     angles; a one-finger drag that starts on empty background turns it around the slime; two fingers pinch to zoom.
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
    this.world = null;          // what shows: 'greenhouse' | 'meadow' | 'classic' | 'loading' (Classic look while the room loads)
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
    let world = want;
    if (want === 'greenhouse') {
      if (this.room.failed) world = 'meadow';
      else if (!this.room.ready) { world = 'loading'; this.startLoad(); }
    }
    if (world === this.world) return;
    this.world = world;
    g.scenery.setEnabled(world === 'meadow' || world === 'greenhouse');   // (in the Greenhouse only while visiting the ranch)
    g.stage.setClassic(world === 'classic' || world === 'loading');
    g.helpers3d.setLayout(world === 'greenhouse' ? 'greenhouse' : 'meadow', this.room.meta);
    if (world === 'greenhouse') this.room.setNight(g.stage.dark, true);
    this.frameWorld();
  }

  startLoad() {
    if (this.loadAsked) return;
    this.loadAsked = true;
    // after the first frame, so the game shows at once (in the Classic look) while the room comes in
    requestAnimationFrame(() => setTimeout(() => this.room.load().then(() => this.apply()), 0));
  }

  get inRoom() { return this.world === 'greenhouse'; }
  setNight(dark) { this.room.setNight(dark); }
  // ground height at home (things that stand on the floor)
  groundY(x, z) { return this.inRoom ? roomGround(x, z) : meadowGround(x, z); }

  // Each frame (before the stage renders): who is visible, the room's blend, the camera's target, the button.
  frameWorld() {
    const g = this.g, st = g.stage, home = g.view !== 'ranch';
    if (this.inRoom) {
      this.room.group.visible = home;
      g.scenery.group.visible = !home;
      st.setHabitat(!home);
      st.setRoomLook(home ? this.room : null);
      g.helpers3d.group.visible = home;
      g.ranch.group.visible = !home;
    } else {
      this.room.group.visible = false;
      st.setHabitat(true);
      st.setRoomLook(null);
      g.helpers3d.group.visible = true;
      // the Classic look (and while the room loads): the ranch only shows while you're over there (or flying there and back)
      g.ranch.group.visible = (this.world !== 'classic' && this.world !== 'loading') || g.view === 'ranch' || st.camPos.z < 3;
    }
  }

  update(dt) {
    this.frameWorld();
    if (this.inRoom && this.room.group.visible) this.room.update(dt, this.g.stage.camera, this.g.reduced);
    this.frameCamera(dt);
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
    if (!this.canTurn || this.touches.size) return;
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0, t: performance.now() });
  }
  // A second finger while one is down on the background (anywhere, even on the slime): a pinch. Returns true when it
  // took the finger, so the game neither boops nor counts a swipe.
  second(e) {
    if (!this.canTurn || this.touches.size !== 1 || this.touches.has(e.pointerId)) return false;
    const [first] = this.touches.values();
    if (performance.now() - first.t > 20000) { this.endDrag(); return false; }   // a finger we never saw lift: forget it
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0, t: performance.now() });
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
    t.x = e.clientX; t.y = e.clientY; t.moved += Math.hypot(dx, dy); t.t = performance.now();
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
