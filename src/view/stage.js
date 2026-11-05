// Renderer, camera, lights and the cozy habitat (rug, cushion, drifting motes).
// Two palettes: a soft daytime meadow and a starry night. The meadow itself (grass, hills, clouds,
// trees, flowers, moon) lives in scenery.js.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const CUSHION_TOP = 0.3;

const PALETTES = {
  light: {
    sky: ['#a9d6f5', '#fbe4ec'], fog: '#f6e6ec', floor: '#a6d888', rug: ['#f8dccf', '#f3b4ba', '#f6d39f'],
    cushion: '#ff92b2', piping: '#ffcf70', button: '#ee6f98',
    hemi: ['#fff3ee', '#d8e6c2', 0.7], key: ['#fff0de', 1.5], rim: ['#bfe9ff', 1.1], env: 0.5, exposure: 0.92,
    mote: '#ffffff', moteAlpha: 0.35,
  },
  dark: {
    sky: ['#0b0a22', '#2b2550'], fog: '#2b2550', floor: '#2b4650', rug: ['#4a3a6e', '#3f3060', '#56407a'],
    cushion: '#c87aa6', piping: '#e8c27a', button: '#a95f8c',
    hemi: ['#7c74c8', '#2b2149', 0.95], key: ['#ffd6a8', 1.7], rim: ['#a08cff', 1.9], env: 0.55, exposure: 1.0,
    mote: '#fff6c8', moteAlpha: 0.9,
  },
};

// The classic look (a setting): the original plain nursery with nothing in the background, so the
// slime is the only thing to look at. These replace the meadow colors and haze.
const CLASSIC = {
  light: { sky: ['#cfe3f7', '#f3dbe4'], fog: '#f2d3d6', floor: '#e9bdb6', hemi: ['#fff3ee', '#f2c3b5', 0.7], fogNear: 14, fogFar: 40 },
  dark: { sky: ['#0d0b24', '#2a2047'], fog: '#2a2047', floor: '#3a2d58', fogNear: 14, fogFar: 40 },
};

// Sky dome: horizon color matches the fog, so the floor melts into the sky.
function paintSky(geo, top, horizon) {
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const a = new THREE.Color(horizon), b = new THREE.Color(top), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 90;
    const k = Math.min(1, Math.max(0, (h - 0.005) / 0.2));
    c.copy(a).lerp(b, k * k * (3 - 2 * k));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
}

function rugTexture(cols, floor) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const R = 256;
  x.fillStyle = floor;
  x.fillRect(0, 0, 512, 512);
  const rings = [[1, cols[1]], [0.9, cols[0]], [0.78, cols[2]], [0.7, cols[0]], [0.5, cols[1]], [0.42, cols[0]]];
  for (const [r, col] of rings) {
    x.fillStyle = col;
    x.beginPath();
    const n = 28;
    for (let i = 0; i <= n * 8; i++) {
      const a = i / (n * 8) * Math.PI * 2;
      const rr = R * r * (r === 1 ? (0.95 + 0.05 * Math.cos(a * n)) : 1);
      x.lineTo(R + Math.cos(a) * rr, R + Math.sin(a) * rr);
    }
    x.fill();
  }
  // tiny dotted stitch ring
  x.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 90; i++) {
    const a = i / 90 * Math.PI * 2;
    x.beginPath(); x.arc(R + Math.cos(a) * R * 0.84, R + Math.sin(a) * R * 0.84, 3.2, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export class Stage {
  constructor(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;
    this.pixelRatioCap = 2;

    const scene = new THREE.Scene();
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(r);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = this.env;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 120);
    this.camPos = new THREE.Vector3(0, 2.6, 9);
    this.camLook = new THREE.Vector3(0, 0.8, 0);
    this.focus = null;
    this._fp = new THREE.Vector3(); this._fo = new THREE.Vector3(); this._fl = new THREE.Vector3();
    this.zoom = 1; this.fitZoom = 1;
    this.portrait = false;

    this.hemi = new THREE.HemisphereLight('#fff', '#fff', 1);
    this.key = new THREE.DirectionalLight('#fff', 2);
    this.key.position.set(3, 6, 5);
    this.rim = new THREE.DirectionalLight('#fff', 1.2);
    this.rim.position.set(-4, 3, -5);
    scene.add(this.hemi, this.key, this.rim);

    // floor
    this.floorMat = new THREE.MeshStandardMaterial({ color: '#fff', roughness: 1 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    this.rugMat = new THREE.MeshStandardMaterial({ roughness: 1, transparent: false });
    this.rug = new THREE.Mesh(new THREE.CircleGeometry(4.3, 96), this.rugMat);
    this.rug.rotation.x = -Math.PI / 2;
    this.rug.position.y = 0.006;
    scene.add(this.rug);

    // cushion
    const prof = [[0, 0.27], [0.5, 0.285], [1.2, 0.305], [1.7, 0.285], [1.95, 0.22], [2.06, 0.12], [2.0, 0.035], [1.82, 0.0], [0, 0]]
      .map(([x, y]) => new THREE.Vector2(x, y)).reverse();
    this.cushionMat = new THREE.MeshPhysicalMaterial({ color: '#fff', roughness: 0.85, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff') });
    const cushion = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), this.cushionMat);
    scene.add(cushion);
    this.pipingMat = new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.5 });
    const piping = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.055, 12, 120), this.pipingMat);
    piping.rotation.x = Math.PI / 2;
    piping.position.y = 0.19;
    scene.add(piping);
    this.buttonMat = new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.6 });
    const bgeo = new THREE.SphereGeometry(0.06, 12, 8);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + 0.3;
      const b = new THREE.Mesh(bgeo, this.buttonMat);
      b.position.set(Math.cos(a) * 1.55, 0.29, Math.sin(a) * 1.55);
      b.scale.y = 0.45;
      scene.add(b);
    }

    // drifting motes / fireflies
    const mtex = softDot();
    this.motes = [];
    for (let i = 0; i < 42; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: mtex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const p = new THREE.Vector3((Math.random() - 0.5) * 14, 0.4 + Math.random() * 5, -6 + Math.random() * 9);
      m.position.copy(p);
      m.scale.setScalar(0.04 + Math.random() * 0.07);
      scene.add(m);
      this.motes.push({ m, base: p, phase: Math.random() * 10, speed: 0.2 + Math.random() * 0.4 });
    }
    // night stars far behind
    this.stars = new THREE.Group();
    for (let i = 0; i < 70; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mtex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#fff7d6', fog: false }));
      s.position.set((Math.random() - 0.5) * 70, 4 + Math.random() * 22, -38 - Math.random() * 8);
      s.scale.setScalar(0.25 + Math.random() * 0.45);
      s.userData.phase = Math.random() * 10;
      this.stars.add(s);
    }
    scene.add(this.stars);

    this.skyGeo = new THREE.SphereGeometry(90, 32, 24);
    this.sky = new THREE.Mesh(this.skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    this.time = 0;
    this.setTheme(false);
  }

  setClassic(on) {
    if (this.classic === !!on) return;
    this.classic = !!on;
    this.setTheme(!!this.dark);
  }

  setTheme(dark) {
    const base = dark ? PALETTES.dark : PALETTES.light;
    const p = this.classic ? { ...base, ...CLASSIC[dark ? 'dark' : 'light'] } : base;
    this.fogNear = p.fogNear || 18; this.fogFar = p.fogFar || 58;
    this.dark = dark;
    this.palette = p;
    paintSky(this.skyGeo, p.sky[0], p.fog);
    this.scene.fog = new THREE.Fog(p.fog, this.fogNear, this.fogFar);
    this.floorMat.color.set(p.floor);
    this.onTheme && this.onTheme(dark, p);
    if (this.rugMat.map) this.rugMat.map.dispose();
    this.rugMat.map = rugTexture(p.rug, p.floor);
    this.rugMat.needsUpdate = true;
    this.cushionMat.color.set(p.cushion);
    this.pipingMat.color.set(p.piping);
    this.buttonMat.color.set(p.button);
    this.hemi.color.set(p.hemi[0]); this.hemi.groundColor.set(p.hemi[1]); this.hemi.intensity = p.hemi[2];
    this.key.color.set(p.key[0]); this.key.intensity = p.key[1];
    this.rim.color.set(p.rim[0]); this.rim.intensity = p.rim[1];
    this.scene.environmentIntensity = p.env;
    this.renderer.toneMappingExposure = p.exposure;
    for (const mo of this.motes) { mo.m.material.color.set(p.mote); }
    this.stars.visible = dark;
  }

  resize(w, h, offX = 0, offY = 0) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.setViewOffset(w, h, offX, offY, w, h);
    this.camera.updateProjectionMatrix();
    this.portrait = w / h < 0.9;
    this.aspect = w / h;
  }

  setPixelRatio(cap) {
    this.pixelRatioCap = cap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  }

  update(dt, size, pointer, reduced) {
    this.time += dt;
    const t = this.time;
    const portraitBoost = this.portrait ? Math.min(1.5, 1 + (0.9 - this.aspect) * 0.8) : 1;
    const dist = (7.6 + size * 2.4) * portraitBoost;
    const sway = reduced ? 0 : 1;
    const tx = pointer.x * 0.35 * sway, ty = pointer.y * 0.18 * sway;
    if (this.focus) {
      // visiting somewhere else (the ranch): glide over, then sway gently with the pointer
      const f = this.focus;
      this.camPos.lerp(this._fp.copy(f.pos).add(this._fo.set(tx * 2, ty * 2, 0)), 1 - Math.exp(-dt * 2.2));
      this.camLook.lerp(f.look, 1 - Math.exp(-dt * 2.6));
    }
    const fogFar = this.focus ? 80 : this.fogFar;
    if (this.scene.fog && Math.abs(this.scene.fog.far - fogFar) > 0.1) {
      this.scene.fog.far += (fogFar - this.scene.fog.far) * (1 - Math.exp(-dt * 2));
      this.scene.fog.near = this.fogNear + (this.scene.fog.far - this.fogFar) * 0.6;
    }
    // zoom out when a phone menu covers most of the screen, so the slime still fits above it
    this.zoom += ((this.focus ? 1 : this.fitZoom) - this.zoom) * (1 - Math.exp(-dt * 5));
    const fov = this.focus && this.focus.fov ? this.focus.fov : 30;
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 2.4)); this.camera.updateProjectionMatrix(); }
    if (!this.focus) {
      const look = this._fl.set(0, CUSHION_TOP + 0.35 + size * 0.42, 0);
      const pos = this._fp.set(tx, 2.25 + size * 0.75 + ty, dist).sub(look).multiplyScalar(this.zoom).add(look);
      this.camPos.lerp(pos, 1 - Math.exp(-dt * 3));
      this.camLook.lerp(look, 1 - Math.exp(-dt * 3));
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    if (this.shakeAmt > 0.002) {
      if (!reduced) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shakeAmt, (Math.random() - 0.5) * this.shakeAmt, 0));
      this.shakeAmt *= Math.exp(-dt * 9);
    }

    for (const mo of this.motes) {
      const k = t * mo.speed + mo.phase;
      mo.m.position.set(mo.base.x + Math.sin(k) * 0.6, mo.base.y + Math.sin(k * 0.7) * 0.4, mo.base.z + Math.cos(k * 0.8) * 0.5);
      mo.m.material.opacity = this.palette.moteAlpha * (0.4 + 0.6 * Math.max(0, Math.sin(k * 1.7)));
    }
    if (this.stars.visible) for (const s of this.stars.children) s.material.opacity = 0.5 + 0.5 * Math.sin(t * 1.5 + s.userData.phase);
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt || 0, a); }

  render() { this.renderer.render(this.scene, this.camera); }
}
