// Lightweight sprite particles: jelly droplets, hearts, sparkles, steam, notes, Zzz, confetti.
import * as THREE from 'three';

function tex(draw, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  draw(x, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const TEX = {};
function buildTextures() {
  TEX.soft = tex((x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  });
  TEX.heart = tex((x, s) => {
    x.fillStyle = '#fff';
    x.beginPath();
    const cx = s / 2, cy = s / 2 + 4, k = s * 0.36;
    x.moveTo(cx, cy + k * 0.8);
    x.bezierCurveTo(cx - k * 1.9, cy - k * 0.3, cx - k * 0.8, cy - k * 1.7, cx, cy - k * 0.65);
    x.bezierCurveTo(cx + k * 0.8, cy - k * 1.7, cx + k * 1.9, cy - k * 0.3, cx, cy + k * 0.8);
    x.fill();
  });
  TEX.sparkle = tex((x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.25, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    x.fillStyle = '#fff';
    x.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r = i % 2 === 0 ? s * 0.48 : s * 0.08;
      x.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
    }
    x.fill();
  });
  TEX.drop = tex((x, s) => {
    x.fillStyle = '#fff';
    x.beginPath();
    x.moveTo(s / 2, s * 0.12);
    x.quadraticCurveTo(s * 0.85, s * 0.55, s / 2, s * 0.88);
    x.quadraticCurveTo(s * 0.15, s * 0.55, s / 2, s * 0.12);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.0)';
  });
  TEX.dot = tex((x, s) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2); x.fill(); });
  TEX.square = tex((x, s) => { x.fillStyle = '#fff'; x.fillRect(s * 0.2, s * 0.35, s * 0.6, s * 0.3); });
  TEX.note = tex((x, s) => {
    x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = s * 0.08;
    x.beginPath(); x.ellipse(s * 0.35, s * 0.72, s * 0.15, s * 0.11, -0.4, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(s * 0.48, s * 0.7); x.lineTo(s * 0.48, s * 0.15); x.quadraticCurveTo(s * 0.7, s * 0.25, s * 0.78, s * 0.4); x.stroke();
  });
  TEX.z = tex((x, s) => {
    x.fillStyle = '#fff';
    x.font = `bold ${s * 0.8}px "DynaPuff", system-ui, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('z', s / 2, s / 2);
  });
  TEX.leaf = tex((x, s) => {
    x.fillStyle = '#fff';
    x.beginPath();
    x.moveTo(s * 0.15, s * 0.85);
    x.quadraticCurveTo(s * 0.1, s * 0.15, s * 0.85, s * 0.15);
    x.quadraticCurveTo(s * 0.85, s * 0.85, s * 0.15, s * 0.85);
    x.fill();
  });
}

const PRESETS = {
  drops:    { tex: 'drop', count: 6, speed: 2.6, up: 2.4, gravity: 9, life: 1.1, size: 0.13, bounce: true },
  hearts:   { tex: 'heart', color: '#ff6f9f', count: 3, speed: 0.5, up: 0.9, gravity: -0.25, life: 1.7, size: 0.24, sway: 1.2 },
  sparkles: { tex: 'sparkle', color: '#fff3b0', count: 8, speed: 1.9, up: 0.5, gravity: 0.5, life: 0.75, size: 0.2, additive: true, spin: 3 },
  steam:    { tex: 'soft', color: '#ffffff', count: 5, speed: 0.35, up: 0.9, gravity: -0.3, life: 1.4, size: 0.28, grow: 2.2, alpha: 0.7 },
  sparks:   { tex: 'sparkle', color: '#ffe45c', count: 10, speed: 3.2, up: 1.2, gravity: 6, life: 0.55, size: 0.12, additive: true },
  leaves:   { tex: 'leaf', color: '#7fd66a', count: 5, speed: 1.2, up: 1.6, gravity: 1.6, life: 1.8, size: 0.14, spin: 4, sway: 1.5 },
  notes:    { tex: 'note', color: '#b49bff', count: 1, speed: 0.2, up: 0.6, gravity: -0.15, life: 2.4, size: 0.2, sway: 1 },
  zzz:      { tex: 'z', color: '#b9b0ff', count: 1, speed: 0.1, up: 0.45, gravity: -0.1, life: 2.6, size: 0.2, grow: 1.3, drift: 0.3 },
  confetti: { tex: 'square', count: 40, speed: 4.5, up: 4.5, gravity: 7, life: 2.6, size: 0.12, spin: 8, bounce: true },
  clank:    { tex: 'sparkle', color: '#d9e4f5', count: 6, speed: 2.2, up: 0.6, gravity: 2, life: 0.5, size: 0.16, additive: true },
  prism:    { tex: 'sparkle', count: 12, speed: 2.2, up: 0.8, gravity: 0.3, life: 1.1, size: 0.18, additive: true, rainbow: true },
  pop:      { tex: 'dot', color: '#e6f8ff', count: 7, speed: 1.6, up: 0, gravity: 0, life: 0.35, size: 0.05 },
  glints:   { tex: 'sparkle', color: '#ffe08a', count: 1, speed: 0.2, up: 0.1, gravity: 0, life: 0.6, size: 0.14, additive: true },
  crumbs:   { tex: 'dot', color: '#d39a5c', count: 6, speed: 1.4, up: 1.2, gravity: 7, life: 0.8, size: 0.04, bounce: true },
  dream:    { tex: 'sparkle', color: '#cfc4ff', count: 1, speed: 0.15, up: 0.25, gravity: -0.05, life: 2.2, size: 0.12, additive: true },
};
const RAINBOW = ['#ff8fb8', '#ffd36b', '#9cf2a8', '#8fd8ff', '#c7a8ff'];
const CONFETTI = ['#ff7aa8', '#ffd25a', '#7fe8c4', '#8fc8ff', '#c7a8ff', '#ffffff'];

export class FX {
  constructor(scene) {
    if (!TEX.soft) buildTextures();
    this.group = new THREE.Group();
    this.group.renderOrder = 5;
    scene.add(this.group);
    this.pool = [];
    this.live = [];
    this.reduced = false;
    this.floor = 0;
    this._v = new THREE.Vector3();
  }

  get(kindTex) {
    let sp = this.pool.pop();
    if (!sp) {
      sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      sp.renderOrder = 5;
    }
    sp.material.map = TEX[kindTex];
    sp.material.needsUpdate = true;
    this.group.add(sp);
    return sp;
  }

  emit(kind, pos, o = {}) {
    const p = { ...PRESETS[kind], ...o };
    let count = p.count;
    if (this.reduced) count = Math.max(1, Math.ceil(count / 3));
    if (this.live.length > 260) count = Math.min(count, 2);
    for (let i = 0; i < count; i++) {
      const sp = this.get(p.tex);
      const m = sp.material;
      const color = p.rainbow ? RAINBOW[i % RAINBOW.length] : kind === 'confetti' ? CONFETTI[(Math.random() * CONFETTI.length) | 0] : (p.color || '#ffffff');
      m.color.set(color);
      m.blending = p.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.rotation = Math.random() * Math.PI * 2 * (p.spin ? 1 : 0);
      m.opacity = p.alpha ?? 1;
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 2 - 1;
      const sp2 = p.speed * (0.5 + Math.random() * 0.7);
      const vel = new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - e * e) * sp2, e * sp2 * 0.5 + p.up * (0.6 + Math.random() * 0.6), Math.sin(a) * Math.sqrt(1 - e * e) * sp2);
      if (p.dir) vel.add(p.dir);
      const jitter = p.jitter ?? 0.05;
      const pp = { sp, pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * jitter * 2, (Math.random() - 0.5) * jitter * 2, (Math.random() - 0.5) * jitter * 2)),
        vel, age: 0, life: p.life * (0.75 + Math.random() * 0.5), size: p.size * (p.sizeMul || 1) * (0.75 + Math.random() * 0.5), p, phase: Math.random() * 6, spin: (p.spin || 0) * (Math.random() - 0.5) * 2 };
      this.live.push(pp);
    }
  }

  update(dt) {
    const keep = [];
    for (const q of this.live) {
      q.age += dt;
      const p = q.p;
      if (q.age >= q.life) { this.group.remove(q.sp); this.pool.push(q.sp); continue; }
      q.vel.y -= p.gravity * dt;
      if (p.drag) q.vel.multiplyScalar(Math.exp(-p.drag * dt));
      q.pos.addScaledVector(q.vel, dt);
      if (p.sway) q.pos.x += Math.sin(q.age * 4 + q.phase) * p.sway * dt * 0.3;
      if (p.drift) q.pos.x += p.drift * dt;
      if (p.bounce && q.pos.y < this.floor && q.vel.y < 0) {
        q.pos.y = this.floor;
        q.vel.y *= -0.35; q.vel.x *= 0.6; q.vel.z *= 0.6;
      }
      const k = q.age / q.life;
      q.sp.position.copy(q.pos);
      const grow = 1 + (p.grow || 0) * k;
      const pop = Math.min(1, q.age / 0.08);
      q.sp.scale.setScalar(q.size * grow * pop);
      const base = p.alpha ?? 1;
      q.sp.material.opacity = base * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      if (q.spin) q.sp.material.rotation += q.spin * dt;
      keep.push(q);
    }
    this.live = keep;
  }
}
