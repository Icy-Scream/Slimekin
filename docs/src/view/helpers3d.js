// Visible helpers around the habitat. Buying a helper adds something you can see.
import * as THREE from 'three';
import { feather, planter, slimeling, moonLamp, fountain, rainbowArch, HELPER_MAKERS } from './models.js';

const FEATHER_COLORS = ['#a98bff', '#ff8fbd', '#6fc4ff', '#ffbf47', '#7fd88f'];
const SLIMELING_COLORS = ['#ffb3d1', '#ffd98a', '#a8d8ff', '#c9b3ff', '#a8f0c8', '#ffc4a3', '#e0b3ff', '#b3f0ec'];
const rand = (a, b) => a + Math.random() * (b - a);

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

  sync(helpers) {
    const want = (id, cap) => Math.min(cap, helpers[id] || 0);
    // feathers
    while (this.feathers.length < want('feather', 10)) {
      const i = this.feathers.length;
      const obj = feather(FEATHER_COLORS[i % FEATHER_COLORS.length]);
      this.group.add(obj);
      this.popIn(obj, 0.95);
      this.feathers.push({ obj, angle: rand(0, Math.PI * 2), speed: rand(0.25, 0.45) * (i % 2 ? 1 : -1), radius: rand(1.25, 1.75), height: rand(0.5, 1.4), phase: rand(0, 6), tickle: -1 });
    }
    // planters behind the cushion
    while (this.planters.length < want('garden', 9)) {
      const i = this.planters.length;
      const obj = planter(i);
      const a = Math.PI + (i % 2 ? 1 : -1) * (0.35 + Math.floor(i / 2) * 0.32) + (i === 0 ? 0.35 : 0);
      const R = 2.75 + (i % 3) * 0.25;
      obj.position.set(Math.sin(a) * R, 0.18, Math.cos(a) * R);
      obj.rotation.y = rand(0, 6);
      this.group.add(obj);
      this.popIn(obj, 1.6);
      this.planters.push({ obj, phase: rand(0, 6) });
    }
    // slimeling pals
    while (this.slimelings.length < want('slimeling', 8)) {
      const i = this.slimelings.length;
      const obj = slimeling(SLIMELING_COLORS[i % SLIMELING_COLORS.length]);
      const a = rand(0, Math.PI * 2), R = rand(2.5, 3.4);
      obj.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
      this.group.add(obj);
      this.popIn(obj, 1.5);
      this.slimelings.push({ obj, target: obj.position.clone(), hopT: rand(0, 1), hopping: false, from: new THREE.Vector3(), rest: rand(0.5, 2), cheer: 0 });
    }
    // lamps floating in the back
    while (this.lamps.length < want('lamp', 6)) {
      const i = this.lamps.length;
      const obj = moonLamp();
      const side = i % 2 ? 1 : -1;
      obj.position.set(side * (2.4 + Math.floor(i / 2) * 1.1), 3.1 + (i % 3) * 0.45, -3.2 - Math.floor(i / 2) * 1.2);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
      glow.scale.setScalar(0.7);
      obj.add(glow);
      this.group.add(obj);
      this.popIn(obj, 1.2);
      this.lamps.push({ obj, base: obj.position.clone(), phase: rand(0, 6) });
    }
    const single = (id, pos, rotY, scale) => {
      if ((helpers[id] || 0) > 0 && !this.singles[id]) {
        const obj = HELPER_MAKERS[id]();
        obj.position.copy(pos);
        obj.rotation.y = rotY;
        this.group.add(obj);
        this.popIn(obj, scale);
        this.singles[id] = obj;
      }
    };
    single('bubbles', new THREE.Vector3(2.35, 0.32, 1.3), -0.6, 2.2);
    single('musicbox', new THREE.Vector3(-2.5, 0.2, 1.15), 0.7, 2.1);
    single('fountain', new THREE.Vector3(3.3, 0, -1.6), 0, 2.4);
    single('observatory', new THREE.Vector3(-3.4, 0, -1.5), 0.6, 2.6);
    single('spa', new THREE.Vector3(3.55, 0, 0.15), -0.5, 1.9);
    if ((helpers.rainbow || 0) > 0 && !this.singles.rainbow) {
      const arch = rainbowArch(6.2, 0.22);
      arch.position.set(0, -0.9, -14);
      this.group.add(arch);
      this.popIn(arch, 1);
      this.singles.rainbow = arch;
    }
    this.counts = { ...helpers };
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
    s.visit = { target: target.clone(), onArrive, arrived: false };
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
          else if (s.visit && !s.visit.arrived) {
            s.target.copy(s.visit.target);
            const d = s.target.distanceTo(o.position);
            if (d > 1.3) s.target.lerpVectors(o.position, s.visit.target, 1.3 / d);
          } else {
            if (s.visit && s.visit.arrived && s.visit.left === undefined) s.visit = null;
            const a = rand(0, Math.PI * 2), R = rand(2.5, 3.6);
            s.target.set(Math.sin(a) * R, 0, Math.cos(a) * R);
            if (s.target.distanceTo(o.position) > 1.5) s.target.lerp(o.position, 0.5);
          }
        }
      } else {
        s.hopT += dt / 0.55;
        const k = Math.min(1, s.hopT);
        o.position.lerpVectors(s.from, s.target, k);
        o.position.y = Math.sin(k * Math.PI) * 0.45;
        o.rotation.y += (Math.atan2(s.target.x - s.from.x, s.target.z - s.from.z + 0.0001) - o.rotation.y) * 0.2;
        const body = o.children[0];
        const st = 1 + Math.sin(k * Math.PI) * 0.15;
        body.scale.set(1.05 / st, 0.82 * st, 1.05 / st);
        if (k >= 1) {
          s.hopping = false; s.rest = rand(0.8, 3.2); o.position.y = 0;
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
      l.obj.position.y = l.base.y + Math.sin(t * 0.8 + l.phase) * 0.15;
      l.obj.rotation.z = Math.sin(t * 0.6 + l.phase) * 0.08;
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
        const a = 0.25 + Math.random() * (Math.PI - 0.5);
        const p = new THREE.Vector3(Math.cos(a) * 5.9, Math.sin(a) * 5.9 - 0.9, -14);
        this.fx.emit('drops', p, { count: 1, color: ['#ff8fa8', '#ffe680', '#8fd0ff', '#9ee6a0'][Math.floor(Math.random() * 4)], speed: 0.2, up: 0, size: 0.18, bounce: false, life: 1.6 });
      }
    }
    const ob = this.singles.observatory;
    if (ob && ctx.fxOn) {
      this.starT = (this.starT || 0) - dt;
      if (this.starT <= 0) {
        this.starT = rand(0.6, 1.4);
        this.fx.emit('glints', new THREE.Vector3(rand(-5, 5), rand(3, 5.5), rand(-5, -2)), { size: rand(0.12, 0.26) });
      }
    }
  }
}
