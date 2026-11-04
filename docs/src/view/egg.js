// The egg your slime hatches from. Tap to warm it; cracks spread until it hatches.
import * as THREE from 'three';

export class Egg {
  // colors: spot colors (a bred egg takes its colors from what its parents were raised on)
  constructor({ colors = null } = {}) {
    this.group = new THREE.Group();
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40 * Math.PI;
      const c = Math.cos(t);
      const r = Math.sin(t) * 0.62 * (1 + 0.13 * c);
      pts.push(new THREE.Vector2(Math.max(0.0001, r), (-c) * 0.86 + 0.86));
    }
    const geo = new THREE.LatheGeometry(pts, 64);

    this.canvas = document.createElement('canvas');
    this.canvas.width = 512; this.canvas.height = 256;
    this.ctx2d = this.canvas.getContext('2d');
    this.spots = [];
    const cols = colors && colors.length ? colors : ['#9eefd3', '#ffc2dc', '#ffe39a', '#c9b8ff'];
    for (let i = 0; i < 26; i++) this.spots.push({ x: Math.random() * 512, y: 30 + Math.random() * 200, r: 8 + Math.random() * 18, c: cols[i % cols.length] });
    this.crackPath = [];
    let x = 0, y = 108;
    while (x <= 520) { this.crackPath.push([x, y]); x += 16 + Math.random() * 14; y = 108 + (Math.random() - 0.5) * 40; }
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.wrapS = THREE.RepeatWrapping;

    this.mat = new THREE.MeshPhysicalMaterial({ map: this.tex, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color('#ffffff'), emissive: new THREE.Color('#7ee6c3'), emissiveIntensity: 0 });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.pivot = new THREE.Group();
    this.pivot.add(this.mesh);
    this.group.add(this.pivot);
    this.group.scale.setScalar(0.78);

    this.warmth = 0;
    this.wob = 0; this.wobV = 0;
    this.idle = 2;
    this.time = 0;
    this.shards = [];
    this.hatched = false;
    this.paint();
  }

  paint() {
    const c = this.ctx2d;
    c.fillStyle = '#fff7ea';
    c.fillRect(0, 0, 512, 256);
    for (const s of this.spots) {
      c.fillStyle = s.c;
      c.beginPath(); c.ellipse(s.x, s.y, s.r * 1.3, s.r, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(s.x - 512, s.y, s.r * 1.3, s.r, 0, 0, Math.PI * 2); c.fill();
    }
    const n = Math.floor(this.crackPath.length * Math.min(1, Math.max(0, (this.warmth - 0.3) / 0.6)));
    if (n > 1) {
      c.strokeStyle = '#6b4e5e';
      c.lineWidth = 5;
      c.lineJoin = 'round';
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const [px, py] = this.crackPath[i];
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
    }
    this.tex.needsUpdate = true;
  }

  setWarmth(w) {
    this.warmth = w;
    this.paint();
  }

  tap() {
    this.wobV += (Math.random() < 0.5 ? -1 : 1) * 4;
    this.squash = 0.12;
  }
  // "not yet": a small shake while the egg is still warming
  notYet() {
    this.wobV += (Math.random() < 0.5 ? -1 : 1) * 2.2;
    this.squash = 0.03;
  }

  hit(raycaster) {
    if (this.hatched) return null;
    const h = raycaster.intersectObject(this.mesh, false);
    return h.length ? h[0] : null;
  }

  // Break into shards that tumble away.
  burst(scene) {
    this.hatched = true;
    this.group.visible = false;
    const shardMat = new THREE.MeshStandardMaterial({ color: '#fff7ea', roughness: 0.5, side: THREE.DoubleSide });
    const spotMat = new THREE.MeshStandardMaterial({ color: '#9eefd3', roughness: 0.5, side: THREE.DoubleSide });
    const origin = new THREE.Vector3();
    this.group.getWorldPosition(origin);
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Shape();
      const a = 0.12 + Math.random() * 0.12;
      s.moveTo(0, 0); s.lineTo(a, Math.random() * 0.05); s.lineTo(a * 0.4, a * (0.8 + Math.random() * 0.4)); s.lineTo(0, 0);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(s), i % 4 === 0 ? spotMat : shardMat);
      const ang = Math.random() * Math.PI * 2;
      m.position.copy(origin).add(new THREE.Vector3(Math.cos(ang) * 0.3, 0.4 + Math.random() * 0.8, Math.sin(ang) * 0.3));
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const vel = new THREE.Vector3(Math.cos(ang) * (1.5 + Math.random() * 2), 3 + Math.random() * 3, Math.sin(ang) * (1.5 + Math.random() * 2) + 0.8);
      scene.add(m);
      this.shards.push({ m, vel, spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), age: 0 });
    }
  }

  update(dt, scene) {
    this.time += dt;
    if (!this.hatched) {
      this.idle -= dt;
      if (this.idle <= 0) {
        this.idle = Math.max(0.6, 2.8 - this.warmth * 2.2) + Math.random() * 1.5;
        this.wobV += (Math.random() < 0.5 ? -1 : 1) * (1.2 + this.warmth * 3);
      }
      this.wobV += (-this.wob * 90 - this.wobV * 7) * dt;
      this.wob += this.wobV * dt;
      this.pivot.rotation.z = this.wob * 0.12;
      this.squash = (this.squash || 0) * Math.exp(-dt * 8);
      this.pivot.scale.set(1 + this.squash, 1 - this.squash, 1 + this.squash);
      this.mat.emissiveIntensity = this.warmth * 0.35 * (0.7 + 0.3 * Math.sin(this.time * (3 + this.warmth * 6)));
    }
    for (const s of this.shards) {
      s.age += dt;
      s.vel.y -= 9 * dt;
      s.m.position.addScaledVector(s.vel, dt);
      if (s.m.position.y < 0.3) { s.m.position.y = 0.3; s.vel.multiplyScalar(0.4); s.vel.y = Math.abs(s.vel.y) * 0.3; }
      s.m.rotation.x += s.spin.x * dt; s.m.rotation.y += s.spin.y * dt;
      const k = Math.max(0, 1 - Math.max(0, s.age - 1.6) / 0.8);
      s.m.scale.setScalar(k);
    }
    const dead = this.shards.filter(s => s.age > 2.4);
    for (const s of dead) scene.remove(s.m);
    if (dead.length) this.shards = this.shards.filter(s => s.age <= 2.4);
  }
}
