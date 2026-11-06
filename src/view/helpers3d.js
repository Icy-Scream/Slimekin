// Visible helpers around the habitat. Buying a helper adds something you can see.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { feather, planter, slimeling, moonLampPost, rainbowArch, HELPER_MAKERS } from './models.js';
import { GREENHOUSE } from '../data/content.js';
import { groundY as roomGround, palWander, palStart, palToward, palSpotOk } from './greenhouse-math.js';

const FEATHER_COLORS = ['#a98bff', '#ff8fbd', '#6fc4ff', '#ffbf47', '#7fd88f'];
const SLIMELING_COLORS = ['#ffb3d1', '#ffd98a', '#a8d8ff', '#c9b3ff', '#a8f0c8', '#ffc4a3', '#e0b3ff', '#b3f0ec'];
const rand = (a, b) => a + Math.random() * (b - a);

// Height of whatever is under a point in the meadow (and the Classic look): the cushion (matches its profile in
// stage.js) or the rug. In the Greenhouse the room's own ground is used (greenhouse-math.js).
const CUSHION_TOP_PROFILE = [[0, 0.27], [0.5, 0.285], [1.2, 0.305], [1.7, 0.285], [1.95, 0.22], [2.06, 0.12], [2.14, 0.006]];
export function groundY(x, z) {
  const r = Math.hypot(x, z);
  const P = CUSHION_TOP_PROFILE;
  if (r >= P[P.length - 1][0]) return 0.006;
  for (let i = 1; i < P.length; i++) {
    if (r <= P[i][0]) { const [r0, y0] = P[i - 1], [r1, y1] = P[i]; return y0 + (y1 - y0) * (r - r0) / (r1 - r0); }
  }
  return 0.006;
}
// a slimeling's body is centered on its origin, so lift it until its bottom touches the ground
const PAL_LIFT = 0.125;
// Moon Lamp posts, in the order they are bought: [x, z, post height]. The first pair frames the slime on a
// phone; the others stand wider, at the cushion's sides (never right behind the slime, where the moons
// would peek over its head). All are on the grass between the cushion and the planters.
const LAMP_SPOTS = [[-1.37, -1.91, 1.45], [1.37, -1.91, 1.45], [-2.08, -1.2, 1.3], [2.08, -1.2, 1.3], [-2.45, -0.4, 1.2], [2.45, -0.4, 1.2]];

// The prop limit: how many copies of a helper are drawn. Owning more still earns more; the scene just
// stops adding copies. Low graphics (picked, or chosen by Auto on a struggling phone) shows fewer.
// The one-of-a-kind helpers: [id, meadow position, turn, shown size]. The Greenhouse's spots are in content.js.
const SINGLES = [
  ['bubbles', [2.35, 0.32, 1.3], -0.6, 2.2],
  ['musicbox', [-2.5, 0.2, 1.15], 0.7, 2.1],
  ['fountain', [3.3, 0, -1.6], 0, 2.4],
  ['observatory', [-3.4, 0, -1.5], 0.6, 2.6],
  ['spa', [3.55, 0, 0.15], -0.5, 1.9],
];

const SHOWN = {
  high: { feather: 6, garden: 6, slimeling: 5, lamp: 6 },
  low: { feather: 3, garden: 4, slimeling: 3, lamp: 3 },
};

// Merge some meshes inside `parent` into one mesh colored per part (vertex colors): one draw call
// instead of one per part. See-through parts are blended onto `under` so they look the same.
function bake(parent, meshes, { roughness = 0.6, under = null, material = null } = {}) {
  let root = parent;
  while (root.parent) root = root.parent;
  root.updateMatrixWorld(true);
  const inv = parent.matrixWorld.clone().invert(), m4 = new THREE.Matrix4(), col = new THREE.Color();
  const flat = meshes.some(m => !m.geometry.index);   // merging needs all indexed or none
  const geos = meshes.map(m => {
    let g = m.geometry.clone();
    if (flat && g.index) g = g.toNonIndexed();
    g.clearGroups();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld));
    col.copy(m.material.color);
    if (m.material.transparent && under) col.lerpColors(under, m.material.color, m.material.opacity);
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.toArray(c, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    m.parent.remove(m);
    return g;
  });
  const out = new THREE.Mesh(mergeGeometries(geos), material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness }));
  parent.add(out);
  return out;
}

// free a removed copy's GPU memory (the shared glow texture stays)
function dispose(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

export class HelperWorld {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.feathers = [];
    this.bubbles = [];
    this.planters = [];
    this.slimelings = [];
    this.lamps = [];
    this.singles = {};
    this.counts = {};
    this.shown = SHOWN.high;
    // 'meadow' (also the Classic look) or 'greenhouse': where things stand (GREENHOUSE.spots in content.js)
    this.layout = 'meadow';
    this.room = null;         // the Greenhouse room's limits and footprints (gh.json) once it has loaded
    this.bubbleTimer = 1;
    this.tickleTimer = 6;
    this.time = 0;
    this.bubbleMat = new THREE.MeshPhysicalMaterial({ color: '#eaf8ff', roughness: 0, metalness: 0, transparent: true, opacity: 0.32, iridescence: 1, iridescenceIOR: 1.25, depthWrite: false });
    this.bubbleGeo = new THREE.SphereGeometry(1, 24, 16);
    const glowC = document.createElement('canvas');
    glowC.width = glowC.height = 64;
    const gx = glowC.getContext('2d');
    const gg = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gg.addColorStop(0, 'rgba(255,240,190,0.9)'); gg.addColorStop(1, 'rgba(255,240,190,0)');
    gx.fillStyle = gg; gx.fillRect(0, 0, 64, 64);
    this.glowTex = new THREE.CanvasTexture(glowC);
  }

  popIn(obj, target = 1) {
    obj.scale.setScalar(0.01);
    obj.userData.popT = 0;
    obj.userData.popTarget = target;
  }

  // 'high' or 'low' (the game's resolved graphics quality): fewer copies on low
  setQuality(q) {
    const next = SHOWN[q] || SHOWN.high;
    if (next === this.shown) return;
    this.shown = next;
    this.sync(this.counts);
  }

  // the lamps glow brighter at night
  setNight(dark) {
    this.night = dark;
    for (const l of this.lamps) l.glow.material.opacity = dark ? 0.6 : 0.3;
  }

  // drop the newest copies above the limit
  trim(list, n) {
    while (list.length > n) {
      const x = list.pop();
      this.group.remove(x.obj);
      dispose(x.obj);
    }
  }

  sync(helpers) {
    const want = id => Math.min(this.shown[id], helpers[id] || 0);
    this.trim(this.feathers, want('feather'));
    this.trim(this.planters, want('garden'));
    this.trim(this.slimelings, want('slimeling'));
    this.trim(this.lamps, want('lamp'));
    // feathers
    while (this.feathers.length < want('feather')) {
      const i = this.feathers.length;
      const obj = feather(FEATHER_COLORS[i % FEATHER_COLORS.length]);
      this.group.add(obj);
      this.popIn(obj, 0.95);
      this.feathers.push({ obj, angle: rand(0, Math.PI * 2), speed: rand(0.25, 0.45) * (i % 2 ? 1 : -1), radius: rand(1.25, 1.75), height: rand(0.5, 1.4), phase: rand(0, 6), tickle: -1 });
    }
    // planters behind the cushion
    while (this.planters.length < want('garden')) {
      const i = this.planters.length;
      const obj = planter(i);
      const sprout = obj.userData.sprout;
      bake(obj, obj.children.filter(c => c !== sprout && c.isMesh), { roughness: 0.7 });
      bake(sprout, sprout.children.filter(c => c.isMesh), { roughness: 0.5 });
      obj.position.set(...this.planterSpot(i));
      obj.rotation.y = rand(0, 6);
      this.group.add(obj);
      this.popIn(obj, 1.6);
      this.planters.push({ obj, phase: rand(0, 6) });
    }
    // slimeling pals (they sit on the floor around the cushion, never inside it)
    while (this.slimelings.length < want('slimeling')) {
      const i = this.slimelings.length;
      const obj = slimeling(SLIMELING_COLORS[i % SLIMELING_COLORS.length]);
      const body = obj.userData.body;
      bake(obj, obj.children.filter(c => c !== body && c.isMesh), { roughness: 0.35, under: body.material.color });
      this.palSpot(obj.position);
      this.group.add(obj);
      this.popIn(obj, 1.5);
      this.slimelings.push({ obj, target: obj.position.clone(), hopT: rand(0, 1), hopping: false, from: new THREE.Vector3(), rest: rand(0.5, 2), cheer: 0 });
    }
    // Moon Lamps: posts planted in the grass behind the cushion, the moon swaying under the hook
    while (this.lamps.length < want('lamp')) {
      const i = this.lamps.length;
      const h = LAMP_SPOTS[i % LAMP_SPOTS.length][2];
      const obj = moonLampPost(h);
      const swing = obj.userData.swing;
      bake(obj, obj.children.filter(c => c !== swing && c.isMesh), { roughness: 0.5 });
      bake(swing, swing.children.filter(c => c.isMesh), { material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, emissive: '#ffd970', emissiveIntensity: 0.55 }) });
      this.placeLamp(obj, i);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: this.night ? 0.6 : 0.3 }));
      glow.scale.setScalar(0.75);
      glow.position.y = -0.31;
      swing.add(glow);
      this.group.add(obj);
      this.popIn(obj, 1);
      this.lamps.push({ obj, swing, glow, phase: rand(0, 6) });
    }
    for (const [id, , , scale] of SINGLES) {
      if ((helpers[id] || 0) > 0 && !this.singles[id]) {
        const obj = HELPER_MAKERS[id]();
        this.placeSingle(id, obj);
        this.group.add(obj);
        this.popIn(obj, scale);
        this.singles[id] = obj;
      }
    }
    if ((helpers.rainbow || 0) > 0 && !this.singles.rainbow) this.makeArch(true);
    this.counts = { ...helpers };
  }

  // ---------- where things stand: the meadow (today's spots) or the Greenhouse room ----------
  ground(x, z) { return this.layout === 'greenhouse' ? roomGround(x, z) : groundY(x, z); }

  planterSpot(i) {
    if (this.layout === 'greenhouse') {
      const [x, z] = GREENHOUSE.spots.planters[i % GREENHOUSE.spots.planters.length];
      return [x, roomGround(x, z) + GREENHOUSE.lift.planter, z];
    }
    const a = Math.PI + (i % 2 ? 1 : -1) * (0.35 + Math.floor(i / 2) * 0.32) + (i === 0 ? 0.35 : 0);
    const R = 2.75 + (i % 3) * 0.25;
    return [Math.sin(a) * R, 0.18, Math.cos(a) * R];
  }

  placeLamp(obj, i) {
    if (this.layout === 'greenhouse') {
      const [x, z] = GREENHOUSE.spots.lamps[i % GREENHOUSE.spots.lamps.length];
      obj.position.set(x, roomGround(x, z), z);
      obj.rotation.y = Math.atan2(z, -x);   // the hook points at the slime
      return;
    }
    const [x, z] = LAMP_SPOTS[i % LAMP_SPOTS.length];
    obj.position.set(x, groundY(x, z), z);
    obj.rotation.y = x < 0 ? 0.3 : Math.PI - 0.3;   // the hook leans in toward the slime
  }

  placeSingle(id, obj) {
    const m = SINGLES.find(s => s[0] === id);
    if (this.layout === 'greenhouse') {
      const [x, z] = GREENHOUSE.spots[id];
      obj.position.set(x, roomGround(x, z) + (GREENHOUSE.lift[id] || 0), z);
      obj.rotation.y = GREENHOUSE.spots.turn[id] ?? m[2];
      return;
    }
    obj.position.set(...m[1]);
    obj.rotation.y = m[2];
  }

  // the Rainbow Arch: over the meadow far behind the cushion, or over the garden behind the Greenhouse's back glass
  makeArch(pop) {
    const old = this.singles.rainbow;
    if (old) { this.group.remove(old); dispose(old); }
    const gh = this.layout === 'greenhouse', A = GREENHOUSE.spots.rainbow;
    const R = gh ? A.radius : 6.2, tube = gh ? A.tube : 0.22;
    const arch = rainbowArch(R, tube);
    arch.position.set(...(gh ? A.pos : [0, -0.9, -14]));
    arch.userData.R = R - 0.3;   // where its drizzle starts (just under the top band)
    this.group.add(arch);
    if (pop) this.popIn(arch, 1);
    this.singles.rainbow = arch;
  }

  // a slimeling pal's first spot (meadow: anywhere on a ring around the cushion; Greenhouse: on the rug or the floor,
  // clear of everything)
  palSpot(out, self = null) {
    if (this.layout === 'greenhouse') {
      const [x, z] = palStart(Math.random, this.blockers(self), this.room);
      out.set(x, roomGround(x, z) + PAL_LIFT, z);
      return out;
    }
    const a = rand(0, Math.PI * 2), R = rand(2.5, 3.4);
    out.set(Math.sin(a) * R, 0, Math.cos(a) * R);
    out.y = groundY(out.x, out.z) + PAL_LIFT;
    return out;
  }

  // Everything a Greenhouse pal must keep clear of: the room's footprints, the helpers standing on the floor, and the
  // other pals (where they are and where they are hopping to).
  blockers(self = null) {
    const R = GREENHOUSE.radius, out = this.room ? this.room.footprints.map(f => ({ x: f.x, z: f.z, r: f.r })) : [];
    for (const p of this.planters) out.push({ x: p.obj.position.x, z: p.obj.position.z, r: R.planter });
    for (const l of this.lamps) out.push({ x: l.obj.position.x, z: l.obj.position.z, r: R.lamp });
    for (const [id] of SINGLES) { const o = this.singles[id]; if (o) out.push({ x: o.position.x, z: o.position.z, r: R[id] }); }
    const pr = GREENHOUSE.spots.pals.spacing / 2;
    for (const s of this.slimelings) {
      if (s === self) continue;
      out.push({ x: s.obj.position.x, z: s.obj.position.z, r: pr });
      if (s.hopping) out.push({ x: s.target.x, z: s.target.z, r: pr });
    }
    return out;
  }

  // Move everything to the meadow's spots or the Greenhouse room's (room: gh.json, needed for the Greenhouse).
  setLayout(layout, room = null) {
    if (room) this.room = room;
    if (layout === 'greenhouse' && !this.room) layout = 'meadow';
    if (layout === this.layout) return;
    this.layout = layout;
    this.planters.forEach((p, i) => p.obj.position.set(...this.planterSpot(i)));
    this.lamps.forEach((l, i) => this.placeLamp(l.obj, i));
    for (const [id] of SINGLES) if (this.singles[id]) this.placeSingle(id, this.singles[id]);
    if (this.singles.rainbow) this.makeArch(false);
    for (const s of this.slimelings) {
      s.hopping = false; s.visit = null; s.rest = rand(0.5, 2);
      this.palSpot(s.obj.position, s);
      s.target.copy(s.obj.position);
    }
  }

  spawnBubble(game = false, near = null) {
    if (this.bubbles.length > (game ? 24 : 12)) return null;
    const r = game ? rand(0.2, 0.28) : rand(0.08, 0.17);
    const m = new THREE.Mesh(this.bubbleGeo, this.bubbleMat);
    m.scale.setScalar(r);
    let p;
    if (near) p = near.clone().add(new THREE.Vector3(rand(-1.6, 1.6), rand(-0.2, 0.9), rand(0.2, 1.2)));
    else if (this.singles.bubbles && Math.random() < 0.6) p = this.singles.bubbles.position.clone().add(new THREE.Vector3(rand(-0.2, 0.2), 0.7, rand(-0.2, 0.2)));
    else { const a = rand(0, Math.PI * 2), R = rand(1.2, 2.8); p = new THREE.Vector3(Math.sin(a) * R, 0.4, Math.cos(a) * R); }
    m.position.copy(p);
    this.group.add(m);
    const b = { m, r, vy: game ? rand(0.05, 0.15) : rand(0.25, 0.5), life: game ? 9 : rand(6, 9), age: 0, phase: rand(0, 6), game };
    this.bubbles.push(b);
    return b;
  }

  popBubble(b) {
    this.group.remove(b.m);
    this.bubbles = this.bubbles.filter(x => x !== b);
    this.fx.emit('pop', b.m.position, { sizeMul: b.r * 6 });
  }

  hitBubble(raycaster) {
    let best = null, bestD = Infinity;
    for (const b of this.bubbles) {
      const d = raycaster.ray.distanceSqToPoint(b.m.position);
      const rr = (b.r * 1.35) ** 2;
      if (d < rr) {
        const dist = raycaster.ray.origin.distanceTo(b.m.position);
        if (dist < bestD) { bestD = dist; best = b; }
      }
    }
    return best;
  }

  // Send one slimeling pal over to say hi to the main slime.
  visit(target, onArrive) {
    const free = this.slimelings.filter(s => !s.visit);
    if (!free.length) return null;
    const s = free[Math.floor(Math.random() * free.length)];
    target = target.clone();
    if (this.layout === 'greenhouse') {
      // the same side of the slime, on a free spot of the rug (the bowl and the lamps stand there too)
      const a0 = Math.atan2(target.x, target.z), R = Math.hypot(target.x, target.z), bl = this.blockers(s);
      for (let k = 0; k < 24; k++) {
        const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.12;
        if (palSpotOk(Math.sin(a) * R, Math.cos(a) * R, bl, undefined, this.room)) { target.set(Math.sin(a) * R, 0, Math.cos(a) * R); break; }
      }
    }
    s.visit = { target, onArrive, arrived: false };
    s.rest = 0;
    return s;
  }
  nearestBubble(pos, maxDist) {
    let best = null, bd = maxDist;
    for (const b of this.bubbles) {
      if (b.game) continue;
      const d = b.m.position.distanceTo(pos);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  cheer() { for (const s of this.slimelings) if (!s.hopping && Math.random() < 0.6) s.cheer = 1; }

  update(dt, ctx) {
    this.time += dt;
    const t = this.time;
    const c = ctx.slimeCenter;
    const size = ctx.slimeSize;

    for (const o of this.group.children) {
      const u = o.userData;
      if (u.popT !== undefined && u.popT < 1) {
        u.popT = Math.min(1, u.popT + dt * 2.2);
        const k = u.popT;
        const s = u.popTarget * (1 + Math.sin(k * Math.PI) * 0.35 * (1 - k)) * (k < 1 ? k : 1);
        o.scale.setScalar(Math.max(0.01, s));
      }
    }

    // feathers orbit and sometimes swoop in for a tickle
    this.tickleTimer -= dt;
    if (this.tickleTimer <= 0 && this.feathers.length && ctx.canTickle) {
      const f = this.feathers[Math.floor(Math.random() * this.feathers.length)];
      if (f.tickle < 0) f.tickle = 0;
      this.tickleTimer = rand(7, 16) / Math.sqrt(this.feathers.length);
      this.tickleTimer = Math.max(3.5, this.tickleTimer);
    }
    for (const f of this.feathers) {
      f.fling = (f.fling || 0) * Math.exp(-dt * 1.6);
      f.angle += f.speed * dt * (1 + f.fling * 6);
      let R = (f.radius + 0.35) * size + 0.5 + f.fling * 1.2;
      let y = c.y + (f.height - 0.8) * size + Math.sin(t * 0.9 + f.phase) * 0.22;
      if (f.tickle >= 0) {
        f.tickle += dt / 1.3;
        const k = Math.sin(Math.min(1, f.tickle) * Math.PI);
        R = R * (1 - k) + (0.95 * size) * k;
        y = y * (1 - k) + (c.y + 0.1 * size) * k;
        if (!f.ticked && f.tickle > 0.5) { f.ticked = true; ctx.onTickle && ctx.onTickle(f.obj.position, f); }
        if (f.tickle >= 1) { f.tickle = -1; f.ticked = false; }
      }
      f.obj.position.set(c.x + Math.cos(f.angle) * R, y, c.z + Math.sin(f.angle) * R * 0.85);
      f.obj.rotation.set(Math.sin(t * 3 + f.phase) * 0.35, -f.angle + (f.speed > 0 ? 0 : Math.PI), 0.9 + Math.sin(t * 4 + f.phase) * 0.5);
    }

    // bubbles drift up and pop
    if (this.singles.bubbles) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) {
        this.spawnBubble();
        this.bubbleTimer = Math.max(0.5, 3.2 / Math.sqrt(this.counts.bubbles || 1)) * rand(0.7, 1.3);
      }
    }
    for (const b of [...this.bubbles]) {
      b.age += dt;
      b.m.position.y += b.vy * dt;
      b.m.position.x += Math.sin(t * 1.5 + b.phase) * 0.15 * dt;
      const wob = 1 + Math.sin(t * 6 + b.phase) * 0.04;
      b.m.scale.set(b.r * wob, b.r / wob, b.r * wob);
      if (b.age > b.life) { this.popBubble(b); ctx.onBubbleExpire && ctx.onBubbleExpire(b); }
    }

    for (const p of this.planters) {
      const sp = p.obj.userData.sprout || p.obj.children.find(ch => ch.userData && ch.isGroup);
      if (sp) sp.rotation.z = Math.sin(t * 1.4 + p.phase) * 0.12;
    }

    // slimelings hop around and look at the main slime
    for (const s of this.slimelings) {
      const o = s.obj;
      if (!s.hopping) {
        s.rest -= dt;
        o.rotation.y += (Math.atan2(c.x - o.position.x, c.z - o.position.z) - o.rotation.y) * (1 - Math.exp(-dt * 3));
        const body = o.children[0];
        const breathe = 1 + Math.sin(t * 3 + s.hopT * 9) * 0.03;
        body.scale.set(1.05 / breathe, 0.82 * breathe, 1.05 / breathe);
        if (s.cheer > 0 || s.rest <= 0) {
          s.hopping = true;
          s.hopT = 0;
          s.from.copy(o.position);
          if (s.cheer > 0) { s.target.copy(o.position); s.cheer = 0; }
          else if (s.visit && !s.visit.arrived && this.layout === 'greenhouse') {
            // around the stump, never across it
            const v = s.visit.target, p = palToward([o.position.x, o.position.z], [v.x, v.z], Math.random, this.blockers(s), this.room);
            if (p) s.target.set(p[0], 0, p[1]); else s.target.copy(o.position);
          } else if (s.visit && !s.visit.arrived) {
            s.target.copy(s.visit.target);
            const d = s.target.distanceTo(o.position);
            if (d > 1.3) s.target.lerpVectors(o.position, s.visit.target, 1.3 / d);
          } else {
            if (s.visit && s.visit.arrived && s.visit.left === undefined) s.visit = null;
            if (this.layout === 'greenhouse') {
              // on the rug and the floor next to where it is, clear of the stump, the furniture and the helpers
              const p = palWander([o.position.x, o.position.z], Math.random, this.blockers(s), this.room);
              if (p) s.target.set(p[0], 0, p[1]); else s.target.copy(o.position);
            } else {
              // wander around the ring next to where it is, so it never hops through the cushion
              const a = Math.atan2(o.position.x, o.position.z) + rand(-0.6, 0.6), R = rand(2.5, 3.5);
              s.target.set(Math.sin(a) * R, 0, Math.cos(a) * R);
            }
          }
        }
      } else {
        s.hopT += dt / 0.55;
        const k = Math.min(1, s.hopT);
        o.position.lerpVectors(s.from, s.target, k);
        const g0 = this.ground(s.from.x, s.from.z), g1 = this.ground(s.target.x, s.target.z), gm = this.ground(o.position.x, o.position.z);
        o.position.y = Math.max(gm, g0 + (g1 - g0) * k) + PAL_LIFT + Math.sin(k * Math.PI) * 0.45;
        o.rotation.y += (Math.atan2(s.target.x - s.from.x, s.target.z - s.from.z + 0.0001) - o.rotation.y) * 0.2;
        const body = o.children[0];
        const st = 1 + Math.sin(k * Math.PI) * 0.15;
        body.scale.set(1.05 / st, 0.82 * st, 1.05 / st);
        if (k >= 1) {
          s.hopping = false; s.rest = rand(0.8, 3.2); o.position.y = this.ground(o.position.x, o.position.z) + PAL_LIFT;
          if (s.visit && !s.visit.arrived && o.position.distanceTo(s.visit.target) < 0.15) {
            s.visit.arrived = true;
            s.rest = 1.8;
            o.rotation.y = Math.atan2(c.x - o.position.x, c.z - o.position.z);
            s.visit.onArrive && s.visit.onArrive(s);
          }
        }
      }
    }

    for (const l of this.lamps) {
      l.swing.rotation.z = Math.sin(t * 1.1 + l.phase) * 0.09;
      l.swing.rotation.x = Math.sin(t * 0.7 + l.phase * 1.7) * 0.05;
    }

    const mb = this.singles.musicbox;
    if (mb && mb.userData.spinner) mb.userData.spinner.rotation.y += dt * 1.6;
    if (mb && ctx.fxOn) {
      this.noteT = (this.noteT || 0) - dt;
      if (this.noteT <= 0) {
        this.noteT = rand(1, 1.8);
        this.fx.emit('notes', mb.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { color: ['#b49bff', '#ff9fc6', '#8fd8ff'][Math.floor(rand(0, 3))] });
      }
    }
    const fo = this.singles.fountain;
    if (fo && ctx.fxOn) {
      this.fountT = (this.fountT || 0) - dt;
      if (this.fountT <= 0) {
        this.fountT = 0.35;
        this.fx.emit('drops', fo.position.clone().add(new THREE.Vector3(0, 0.95, 0)), { count: 2, color: ctx.slimeColor, speed: 0.8, up: 1.5, size: 0.09, bounce: false, life: 0.7 });
      }
    }
    const spaObj = this.singles.spa;
    if (spaObj && spaObj.userData.duck) {
      const d = spaObj.userData.duck;
      d.position.y = 0.23 + Math.sin(t * 2.2) * 0.012;
      d.position.x = 0.12 + Math.sin(t * 0.4) * 0.12;
      d.rotation.y = t * 0.4;
      if (ctx.fxOn) {
        this.spaT = (this.spaT || 0) - dt;
        if (this.spaT <= 0) { this.spaT = 1.4; this.fx.emit('steam', spaObj.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { count: 1, size: 0.3 }); }
      }
    }
    const arch = this.singles.rainbow;
    if (arch && ctx.fxOn) {
      this.rainT = (this.rainT || 0) - dt;
      if (this.rainT <= 0) {
        this.rainT = 0.25;
        const a = 0.25 + Math.random() * (Math.PI - 0.5), R = arch.userData.R || 5.9;
        const p = new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0).add(arch.position);
        this.fx.emit('drops', p, { count: 1, color: ['#ff8fa8', '#ffe680', '#8fd0ff', '#9ee6a0'][Math.floor(Math.random() * 4)], speed: 0.2, up: 0, size: 0.18, bounce: false, life: 1.6 });
      }
    }
    const ob = this.singles.observatory;
    if (ob && ctx.fxOn) {
      this.starT = (this.starT || 0) - dt;
      if (this.starT <= 0) {
        this.starT = rand(0.6, 1.4);
        // dream-stars falling in the sky (in the Greenhouse: outside, beyond the back glass)
        const p = this.layout === 'greenhouse' ? new THREE.Vector3(rand(-4, 4), rand(3.2, 5.6), rand(-9, -6)) : new THREE.Vector3(rand(-5, 5), rand(3, 5.5), rand(-5, -2));
        this.fx.emit('glints', p, { size: rand(0.12, 0.26) });
      }
    }
  }
}
