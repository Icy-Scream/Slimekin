// The slime: a soft jelly body deformed on the CPU every frame (squash, lean,
// poke dents, wobble, swallowing bulge), a canvas face that hugs the surface,
// accessories that grow from its diet, and eaten food floating inside.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { FaceRenderer } from './face.js';
import { makeFood, OUTFIT_MAKERS } from './models.js';
import { FORM_LOOKS, PROP_MAKERS, makePattern } from './forms.js';
import { TRAITS, TRAIT_IDS, FOOD_BY_ID } from '../data/content.js';

// How long each snack takes to fully dissolve (seconds of play), and what it breaks into.
const DIGEST = { cookie: 150, chili: 110, iron: 320, moss: 180, berry: 120, crystal: 360 };
const CRUMB_COLORS = {
  cookie: ['#d79a55', '#5a3424'], chili: ['#e8342a', '#4b9a3c'], iron: ['#9aa8ba', '#6f7a8a'],
  moss: ['#6dbb52', '#b4ea8a'], berry: ['#5d6cf0', '#ffe45c'], crystal: ['#a9e7ff', '#e6f9ff'],
};
const dyeColor = id => {
  const t = Object.entries(FOOD_BY_ID[id].traits).sort((a, b) => b[1] - a[1])[0][0];
  return TRAITS[t].color;
};
const CRUMB_GEO = new THREE.IcosahedronGeometry(0.06, 0);
let DYE_TEX = null;
function dyeTexture() {
  if (DYE_TEX) return DYE_TEX;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  DYE_TEX = new THREE.CanvasTexture(c);
  return DYE_TEX;
}
// Belly contents draw over the jelly but under the face, so they stay readable inside it.
const BELLY_ORDER = 1.5;
// Where each outfit sits. dir: point on the body; align: which model axis points out of the surface.
// ring: worn around the body at this height (on the unit sphere).
const OUTFIT_SPECS = {
  bow:     { dir: [-0.5, 0.8, 0.34], off: 0.03, align: 'up' },
  beret:   { dir: [0.12, 1, 0.14], off: -0.06, align: 'up' },
  party:   { dir: [0.2, 1, 0.1], off: -0.04, align: 'up' },
  crown:   { dir: [0, 1, 0.06], off: -0.03, align: 'up' },
  flowers: { ring: 0.8, off: 0.0 },
  scarf:   { ring: -0.2, off: 0.0 },
  bowtie:  { dir: [0, -0.33, 0.94], off: 0.04, align: 'front' },
  glasses: { dir: [0, 0.215, 0.977], off: 0.07, align: 'front' },
  shades:  { dir: [0, 0.215, 0.977], off: 0.08, align: 'front' },
};
function bellyMaterial(mat, opacity) {
  mat.transparent = true;
  mat.opacity = opacity;
  mat.depthTest = false;
  mat.depthWrite = false;
  return mat;
}

const BASE_COLOR = new THREE.Color('#7ee6c3');
const BOTTOM = 0.42;      // depth of the flattened lower half
const HEIGHT = 1.39;      // total rest height (local units)
const CENTER_Y = 0.6;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

class Spring {
  constructor(k, d, x = 0) { this.k = k; this.d = d; this.x = x; this.v = 0; this.target = x; }
  step(dt) { const a = -this.k * (this.x - this.target) - this.d * this.v; this.v += a * dt; this.x += this.v * dt; }
}

const TRAIT_COLORS = Object.fromEntries(TRAIT_IDS.map(k => [k, new THREE.Color(TRAITS[k].color)]));

export class SlimeAvatar {
  // lite: a cheaper slime for the ranch (coarser body, face redrawn less often).
  constructor({ quality = 'high', lite = false } = {}) {
    this.lite = lite;
    this.faceT = 0;
    this.root = new THREE.Group();
    this.body = new THREE.Group();     // squash pivot + roll
    this.root.add(this.body);

    let geo = new THREE.IcosahedronGeometry(1, lite ? 3 : 5);
    geo.deleteAttribute('normal');
    geo.deleteAttribute('uv');
    geo = mergeVertices(geo);
    this.geo = geo;
    this.base = Float32Array.from(geo.attributes.position.array);
    const n = this.base.length / 3;
    // Wrap-around UVs (seam at the back) so grown-up forms can paint patterns on the body.
    const uvs = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = this.base[i * 3], y = this.base[i * 3 + 1], z = this.base[i * 3 + 2];
      uvs[i * 2] = 0.5 + Math.atan2(x, z) / (Math.PI * 2);
      uvs[i * 2 + 1] = 0.5 + Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.baseAz = new Float32Array(n);
    for (let i = 0; i < n; i++) this.baseAz[i] = Math.atan2(this.base[i * 3 + 2], this.base[i * 3]);
    geo.computeVertexNormals();
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.7, 0), 3.2);

    this.mat = new THREE.MeshPhysicalMaterial({
      color: BASE_COLOR.clone(),
      roughness: 0.13,
      metalness: 0,
      transmission: 0.66,
      thickness: 1.1,
      ior: 1.22,
      attenuationColor: BASE_COLOR.clone(),
      attenuationDistance: 1.9,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      sheen: 0.6,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color('#ffffff'),
      emissive: BASE_COLOR.clone().multiplyScalar(0.05),
      iridescence: 0,
      iridescenceIOR: 1.3,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 1;
    this.body.add(this.mesh);

    // Cheap invisible shape for clicking.
    this.proxy = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ visible: false }));
    // Slightly larger than the body and steady while it squishes, so taps land reliably.
    this.proxy.position.y = 0.66;
    this.proxy.scale.set(1.18, 0.8, 1.18);
    this.body.add(this.proxy);

    // Face patch: a grid wrapped over the front of the body.
    this.face = new FaceRenderer();
    const fgeo = new THREE.PlaneGeometry(1, 1, 26, 18);
    const uv = fgeo.attributes.uv.array;
    const fn = fgeo.attributes.position.count;
    this.faceDirs = new Float32Array(fn * 3);
    const AZ = 1.32, EL0 = 0.15, EL = 0.9;
    for (let i = 0; i < fn; i++) {
      const az = (uv[i * 2] - 0.5) * AZ;
      const el = EL0 + (uv[i * 2 + 1] - 0.5) * EL;
      this.faceDirs[i * 3] = Math.sin(az) * Math.cos(el);
      this.faceDirs[i * 3 + 1] = Math.sin(el);
      this.faceDirs[i * 3 + 2] = Math.cos(az) * Math.cos(el);
    }
    this.faceGeo = fgeo;
    fgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.7, 0), 3.2);
    this.faceMesh = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({
      map: this.face.texture, transparent: true, depthWrite: false, toneMapped: false,
    }));
    this.faceMesh.renderOrder = 2;
    this.faceMesh.frustumCulled = false;
    this.body.add(this.faceMesh);
    this.mouthDir = new THREE.Vector3(0, Math.sin(-0.2), Math.cos(-0.2)).normalize();
    this.faceCenterDir = new THREE.Vector3(0, Math.sin(0.12), Math.cos(0.12)).normalize();

    this.inner = new THREE.Group();
    this.body.add(this.inner);
    this.innerItems = [];

    // Little pseudopod "hands" pushed out of the body (wave, high five, swat), and taffy pulling.
    this.nubs = {};
    this.nubList = [];
    this.pull = { dir: new THREE.Vector3(0, 0, 1), vec: new THREE.Vector3(), vel: new THREE.Vector3(), target: new THREE.Vector3(), active: false };
    this.sqBias = 0;
    this.colorOverride = null;
    this.tint = new THREE.Color();
    this.tintAmt = 0;
    this._c = new THREE.Color();
    this._c2 = new THREE.Color();
    this.spinDir = 1;

    this.buildAccessories();
    this.buildCap();
    this.outfit = { head: null, face: null, neck: null };
    this.formProps = [];
    this.form = null;
    this.formShape = null;
    this._z = new THREE.Vector3(0, 0, 1);
    this.buildShadow();

    // Motion state
    this.sq = new Spring(170, 9);
    this.leanX = new Spring(80, 8);
    this.leanZ = new Spring(80, 8);
    this.roll = new Spring(60, 7);
    this.yaw = 0; this.yawTarget = 0; this.spinLeft = 0;
    this.hopY = 0; this.hopV = 0;
    this.dents = [];
    this.wobble = 0;
    this.gulp = null;
    this.time = 0;
    this.size = 0.6; this.sizeTarget = 0.6; this.sizeV = 0;
    this.breathAmp = 0.022; this.breathRate = 2.1;
    this.glow = 0;
    this.stiffness = 1;
    this.color = BASE_COLOR.clone();
    this.targetColor = BASE_COLOR.clone();
    this.emissiveBoost = 0;
    this.traits = Object.fromEntries(TRAIT_IDS.map(k => [k, 0]));
    this.visible = true;

    this.expr = { eyes: 'normal', mouth: 'smile', mouthOpen: 0, blush: 0.35, eyeOpen: 1, tears: false, sweat: false, brows: null, iris: 'rgba(130,240,205,0.9)' };
    this.look = new THREE.Vector2();
    this.lookGoal = new THREE.Vector2();
    this.lookTarget = null;  // world Vector3 or null
    this.blink = 0; this.blinkPhase = -1; this.blinkT = 2.5;

    this._o = { x: 0, y: 0, z: 0 };
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);

    this.setQuality(quality);
  }

  setQuality(q) {
    this.quality = q;
    const high = q !== 'low';
    this.mat.transmission = high ? 0.66 : 0;
    this.mat.transparent = !high;
    this.mat.opacity = high ? 1 : 0.9;
    this.mat.needsUpdate = true;
  }

  // ---------- construction ----------
  buildAccessories() {
    const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
    this.acc = [];
    const add = (obj, dir, trait, at, off = 0, base = 1) => {
      obj.visible = false;
      this.body.add(obj);
      this.acc.push({ obj, dir: new THREE.Vector3(...dir).normalize(), trait, at, off, base, grow: 0 });
    };

    // Leaf sprout (nature)
    const sprout = new THREE.Group();
    const leafMat = std('#6fd25a', { roughness: 0.55 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.2, 8), leafMat);
    stem.position.y = 0.08;
    sprout.add(stem);
    const leafGeo = new THREE.SphereGeometry(0.15, 16, 10);
    for (const side of [-1, 1]) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.scale.set(1, 0.22, 0.55);
      leaf.position.set(side * 0.12, 0.2, 0);
      leaf.rotation.z = side * 0.5;
      sprout.add(leaf);
    }
    this.sprout = sprout;
    add(sprout, [0, 1, -0.06], 'nature', 10, -0.02);

    // Tiny flowers (lots of nature)
    for (const [d, c] of [[[0.62, 0.62, -0.45], '#ffd1e8'], [[-0.66, 0.55, -0.42], '#fff1a8']]) {
      const fl = new THREE.Group();
      const petal = std(c, { roughness: 0.6 });
      for (let i = 0; i < 5; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6), petal);
        const a = i / 5 * Math.PI * 2;
        p.position.set(Math.cos(a) * 0.05, 0.01, Math.sin(a) * 0.05);
        p.scale.set(1, 0.35, 1);
        fl.add(p);
      }
      fl.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std('#ffb347')));
      add(fl, d, 'nature', 38, 0.0);
    }

    // Flame tuft (heat): two glowing teardrops
    const flame = new THREE.Group();
    const drop = (h, r) => new THREE.LatheGeometry([[0, 0], [r * 0.7, h * 0.08], [r, h * 0.28], [r * 0.82, h * 0.52], [r * 0.42, h * 0.78], [0, h]].map(([x, y]) => new THREE.Vector2(x, y)), 18);
    const outer = new THREE.Mesh(drop(0.34, 0.11), std('#ff6a2b', { emissive: '#ff5a1a', emissiveIntensity: 1.2 }));
    const innerF = new THREE.Mesh(drop(0.2, 0.065), std('#ffe36b', { emissive: '#ffd23c', emissiveIntensity: 1.4 }));
    innerF.position.set(0, 0.015, 0.06);
    flame.add(outer, innerF);
    this.flame = flame;
    add(flame, [-0.36, 0.92, 0.02], 'heat', 10, -0.03);

    // Antenna (spark)
    const ant = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.26, 6), std('#5c5470', { roughness: 0.4 }));
    rod.position.y = 0.12;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), std('#ffe45c', { emissive: '#ffd21f', emissiveIntensity: 1.2 }));
    tip.position.y = 0.27;
    ant.add(rod, tip);
    this.antennaTip = tip;
    add(ant, [0.38, 0.9, 0.02], 'spark', 10, -0.02);

    // Crystals (prism)
    const cMat = new THREE.MeshPhysicalMaterial({ color: '#b5e9ff', roughness: 0.05, emissive: '#47b5ff', emissiveIntensity: 0.4, flatShading: true, iridescence: 1, clearcoat: 1 });
    for (const [d, s] of [[[0.45, 0.7, -0.55], 1], [[-0.35, 0.78, -0.55], 0.8], [[0.06, 0.88, -0.48], 1.15], [[0.75, 0.3, -0.58], 0.7], [[-0.72, 0.32, -0.6], 0.75]]) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), cMat);
      c.scale.set(1, 2.1, 1);
      c.position.y = 0.1;
      const g = new THREE.Group(); g.add(c);
      add(g, d, 'prism', 10, -0.03, s);
    }

    // Studs (mineral)
    const studMat = new THREE.MeshStandardMaterial({ color: '#a7b4c8', metalness: 0.9, roughness: 0.25 });
    for (const d of [[0.96, 0.15, -0.2], [-0.96, 0.18, -0.12], [0.58, 0.35, -0.75], [-0.55, 0.4, -0.74], [0.0, 0.55, -0.84], [0.3, 0.75, -0.6], [-0.28, 0.76, -0.6]]) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.04, 6), studMat);
      st.position.y = 0.0;
      const g = new THREE.Group(); g.add(st);
      add(g, d, 'mineral', 10, 0.0);
    }

    // Sprinkles (sweet)
    const sprinkleColors = ['#ff6fae', '#ffd25a', '#7fd1ff', '#b49bff', '#ffffff', '#7fe39a'];
    const capGeo = new THREE.CapsuleGeometry(0.018, 0.06, 4, 8);
    let placed = 0, tries = 0;
    while (placed < 22 && tries < 400) {
      tries++;
      const d = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 1.1 - 0.05, Math.random() * 2 - 1).normalize();
      if (d.z > 0.45 && Math.abs(d.x) < 0.75 && d.y < 0.62) continue; // keep the face clear
      if (d.y < 0.05) continue;
      const m = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: sprinkleColors[placed % sprinkleColors.length], roughness: 0.4 }));
      m.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI);
      const g = new THREE.Group(); g.add(m);
      add(g, [d.x, d.y, d.z], 'sweet', 10 + placed * 0.8, 0.012);
      placed++;
    }
  }

  // Nightcap that pops on while napping.
  buildCap() {
    const g = new THREE.Group();
    const cloth = new THREE.MeshStandardMaterial({ color: '#6b6fd8', roughness: 0.8 });
    const white = new THREE.MeshStandardMaterial({ color: '#fff8ee', roughness: 0.9 });
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(new THREE.Vector2(0.24 * (1 - t) ** 1.1 + 0.005, t * 0.5));
    }
    const cone = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), cloth);
    const p = cone.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + y * y * 0.9); }
    cone.geometry.computeVertexNormals();
    g.add(cone);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.05, 10, 24), white);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.02;
    g.add(band);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), white);
    pom.position.set(0.23, 0.48, 0);
    g.add(pom);
    g.visible = false;
    this.body.add(g);
    this.cap = { obj: g, dir: new THREE.Vector3(0.12, 1, -0.08).normalize(), grow: 0, on: false };
  }

  // Apply a grown-up form's signature look (see forms.js). Unknown ids leave the slime as it is.
  setForm(id) {
    const look = FORM_LOOKS[id] || null;
    for (const p of this.formProps) for (const o of [p.obj, ...(p.extra || [])]) o.parent && o.parent.remove(o);
    this.formProps = [];
    const m = this.mat;
    Object.assign(m, { roughness: 0.13, clearcoat: 1, sheen: 0.6, metalness: 0, iridescence: Math.min(1, (this.traits.prism || 0) / 25), thickness: 1.1 });
    m.transmission = this.quality === 'low' ? 0 : 0.66;
    if (m.map) { m.map.dispose(); m.map = null; }
    if (m.emissiveMap) { m.emissiveMap.dispose(); m.emissiveMap = null; }
    this.form = look;
    this.formId = look ? id : null;
    this.formShape = look && look.shape ? { tall: 1, wide: 1, lumpy: 0, square: 0, ...look.shape } : null;
    if (look) {
      if (look.mat) {
        for (const [k, v] of Object.entries(look.mat)) {
          if (k === 'transmission' && this.quality === 'low') continue;
          m[k] = v;
        }
      }
      if (look.pattern) m.map = makePattern(look.pattern);
      if (look.glowPattern) m.emissiveMap = makePattern(look.glowPattern);
      for (const name of look.props || []) if (PROP_MAKERS[name]) this.formProps.push(PROP_MAKERS[name](this));
    }
    this.formAnchor = (this.formProps.find(p => p.anchor) || {}).anchor || null;
    m.needsUpdate = true;
  }

  // Show the outfits the player has chosen (one per slot).
  setOutfits(worn) {
    for (const slot of ['head', 'face', 'neck']) {
      const id = worn[slot] || null;
      const cur = this.outfit[slot];
      if ((cur && cur.id) === id) continue;
      if (cur) this.body.remove(cur.obj);
      this.outfit[slot] = null;
      if (id && OUTFIT_MAKERS[id]) {
        const obj = OUTFIT_MAKERS[id]();
        obj.scale.setScalar(0.01);
        this.body.add(obj);
        const sp = OUTFIT_SPECS[id];
        this.outfit[slot] = { id, obj, spec: sp, dir: sp.dir ? new THREE.Vector3(...sp.dir).normalize() : null, grow: 0, rot0: obj.rotation.clone() };
      }
    }
  }

  placeOutfits(dt) {
    const o = this._o;
    for (const slot of ['head', 'face', 'neck']) {
      const it = this.outfit[slot];
      if (!it) continue;
      const hide = slot === 'head' && this.cap.on;
      it.grow += ((hide ? 0 : 1) - it.grow) * (1 - Math.exp(-dt * 7));
      it.obj.visible = it.grow > 0.02;
      if (!it.obj.visible) continue;
      const pop = it.grow * (1 + Math.sin(Math.min(1, it.grow) * Math.PI) * 0.12);
      const sp = it.spec;
      if (sp.ring !== undefined) {
        const ry = sp.ring;
        this.shape(0, ry, 0, 0, o);
        const cx = o.x, cy = o.y, cz = o.z;
        const rx = Math.sqrt(1 - ry * ry);
        this.shape(rx, ry, 0, 0, o);
        const r = Math.abs(o.x - cx) + 0.02;
        it.obj.position.set(cx, cy + sp.off, cz);
        it.obj.scale.set(r * pop, r * pop * (1 + this.sq.x), r * pop);
        continue;
      }
      this.shape(it.dir.x, it.dir.y, it.dir.z, Math.atan2(it.dir.z, it.dir.x), o);
      const ny = o.y - CENTER_Y * (1 + this.sq.x);
      const len = Math.sqrt(o.x * o.x + ny * ny + o.z * o.z) || 1;
      this._v.set(o.x / len, ny / len, o.z / len);
      it.obj.position.set(o.x + this._v.x * sp.off, o.y + this._v.y * sp.off, o.z + this._v.z * sp.off);
      this._q.setFromUnitVectors(sp.align === 'front' ? this._z : this._up, this._v);
      it.obj.quaternion.copy(this._q);
      if (sp.align === 'up') it.obj.rotateZ(it.rot0.z);
      it.obj.scale.setScalar(pop);
    }
  }

  buildShadow() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(40, 20, 60, 0.55)');
    g.addColorStop(0.55, 'rgba(40, 20, 60, 0.22)');
    g.addColorStop(1, 'rgba(40, 20, 60, 0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.004;
    this.shadow.renderOrder = 0;
    this.root.add(this.shadow);
  }

  // ---------- shape ----------
  shape(px, py, pz, az, o) {
    let x = px, y, z = pz;
    if (py < 0) {
      const t = -py, tt = 1 - t;
      y = -BOTTOM * (1 - tt * tt * tt);
      const w = 1 + 0.14 * t;
      x *= w; z *= w;
    } else {
      y = py * 0.97;
      const w = 1 - 0.07 * py * py;
      x *= w; z *= w;
    }
    const F = this.formShape;
    if (F) {
      if (F.square) {
        const r2 = Math.sqrt(x * x + z * z);
        if (r2 > 1e-4) { const r4 = Math.sqrt(Math.sqrt(x ** 4 + z ** 4)); const k = 1 + (r2 / r4 - 1) * F.square; x *= k; z *= k; }
      }
      if (F.wide !== 1) { x *= F.wide; z *= F.wide; }
      if (F.tall !== 1 && py > 0) y *= F.tall;
      if (F.peak && py > 0) { const k = py * py * py; x *= 1 - F.peak * k * 0.8; z *= 1 - F.peak * k * 0.8; y *= 1 + F.peak * k * 0.32; }
    }
    y += BOTTOM;
    const h = y / HEIGHT;

    let off = 0;
    if (F && F.lumpy) off += F.lumpy * 2.2 * Math.sin(px * 5.1 + 1.3) * Math.sin(py * 6.3 + 0.7) * Math.sin(pz * 5.7 + 2.1);
    const W = this.wobble;
    if (W > 0.0005) off += W * (Math.sin(3 * az + this.time * 11) * 0.6 + Math.sin(py * 7 + this.time * 8.3) * 0.4);
    for (let i = 0; i < this.dents.length; i++) {
      const d = this.dents[i];
      const dot = px * d.x + py * d.y + pz * d.z;
      if (dot > 0.55) off -= d.a * Math.exp(-(1 - dot) / 0.045);
    }
    if (this.gulp) { const dh = h - this.gulp.h; off += this.gulp.a * Math.exp(-dh * dh / 0.008); }
    for (let i = 0; i < this.nubList.length; i++) {
      const n = this.nubList[i];
      if (n.len < 0.003) continue;
      const dot = px * n.dir.x + py * n.dir.y + pz * n.dir.z;
      if (dot > 0.93) { const t = (dot - 0.93) / 0.07; const u = 1 - t; off += n.len * (1 - u * u * u); }
    }
    if (off !== 0) {
      const fade = Math.min(1, h * 4);
      const dy = y - CENTER_Y;
      const len = Math.sqrt(x * x + dy * dy + z * z) || 1;
      const s = off * fade / len;
      x += x * s; y += dy * s; z += z * s;
    }
    const pl = this.pull;
    if (pl.amt > 0.002) {
      const dot = px * pl.dir.x + py * pl.dir.y + pz * pl.dir.z;
      if (dot > 0.1) { const w = Math.exp(-(1 - dot) / 0.12) * Math.min(1, h * 3); x += pl.vec.x * w; y += pl.vec.y * w; z += pl.vec.z * w; }
    }
    const sq = this.sq.x;
    const sxz = 1 - sq * 0.45 + Math.max(0, -sq) * 0.3 * (1 - h);
    y *= 1 + sq;
    x *= sxz; z *= sxz;
    const hh = h * h;
    x += this.leanX.x * hh;
    z += this.leanZ.x * hh;
    o.x = x; o.y = y; o.z = z;
    return o;
  }

  shapeDir(dir, out) {
    const o = this.shape(dir.x, dir.y, dir.z, Math.atan2(dir.z, dir.x), this._o);
    return out.set(o.x, o.y, o.z);
  }

  // ---------- actions ----------
  poke(worldPoint, strength = 1) {
    const local = this.body.worldToLocal(this._v.copy(worldPoint));
    local.y -= CENTER_Y;
    local.normalize();
    const s = strength / this.stiffness;
    this.dents.push({ x: local.x, y: local.y, z: local.z, a: 0, v: 2.4 * s, age: 0 });
    if (this.dents.length > 5) this.dents.shift();
    this.sq.v -= 2.2 * s;
    this.wobble = Math.min(0.08, this.wobble + 0.025 * s);
    this.leanX.v -= local.x * 1.6 * s;
    this.leanZ.v -= local.z * 1.0 * s;
  }
  hop(power = 4) {
    if (this.hopY > 0.02) return;
    this.hopV = power;
    this.sq.v += 2.5;
  }
  squish(a = 1) { this.sq.v -= 2.5 * a; this.wobble = Math.min(0.08, this.wobble + 0.02 * a); }
  stretch(a = 1) { this.sq.v += 2.5 * a; }
  kick(a = 0.03) { this.wobble = Math.min(0.1, this.wobble + a); }
  spin(dir = 1) { this.spinLeft = Math.PI * 2; this.spinDir = dir < 0 ? -1 : 1; }

  // Push a little hand out of the body toward a local direction.
  nub(name, dir, len = 0.4, opts = {}) {
    let n = this.nubs[name];
    if (!n) {
      n = { base: new THREE.Vector3(), dir: new THREE.Vector3(), len: 0, v: 0, target: 0, wave: 0, k: 220, d: 14 };
      this.nubs[name] = n;
      this.nubList.push(n);
    }
    n.base.copy(dir).normalize();
    n.dir.copy(n.base);
    n.target = len;
    n.wave = opts.wave || 0;
    if (opts.snap) n.v += opts.snap;
    return n;
  }
  nubIn(name) { const n = this.nubs[name]; if (n) { n.target = 0; n.wave = 0; } }
  nubTipWorld(name, out) {
    const n = this.nubs[name];
    if (!n) return null;
    this.shapeDir(n.dir, out);
    return this.body.localToWorld(out);
  }
  localDir(worldPoint, out) {
    const l = this.body.worldToLocal(out.copy(worldPoint));
    l.y -= CENTER_Y;
    return l.normalize();
  }

  // Taffy pull: grab a spot and stretch it toward a target (local units).
  grab(worldPoint) {
    this.localDir(worldPoint, this.pull.dir);
    this.pull.active = true;
    this.pull.target.set(0, 0, 0);
  }
  pullTo(localVec) { this.pull.target.copy(localVec); }
  release() { this.pull.active = false; this.pull.target.set(0, 0, 0); }

  // Which part of the face a ray hits: eyeL, eyeR, mouth, cheekL, cheekR, or null.
  faceRegion(raycaster) {
    if (!this.visible) return null;
    const h = raycaster.intersectObject(this.faceMesh, false)[0];
    if (!h || !h.uv) return null;
    const f = this.face;
    const x = h.uv.x * 512, y = (1 - h.uv.y) * 352;
    const lx = this.look.x * 14, ly = this.look.y * 10;
    for (const side of [-1, 1]) {
      const ex = 256 + side * f.eyeDX + lx, ey = f.eyeY + ly;
      if (((x - ex) / 56) ** 2 + ((y - ey) / 68) ** 2 < 1) return side < 0 ? 'eyeL' : 'eyeR';
    }
    if (((x - 256) / 52) ** 2 + ((y - f.mouthY) / 40) ** 2 < 1) return 'mouth';
    for (const side of [-1, 1]) if (Math.hypot(x - (256 + side * 176), y - 232) < 48) return side < 0 ? 'cheekL' : 'cheekR';
    return 'face';
  }
  startGulp() { this.gulp = { h: 0.72, a: 0.11 }; }
  pulseGlow(a = 1) { this.glow = Math.max(this.glow, a); }

  // A snack sinks into the jelly, softens, breaks into crumbs, and its color swirls into the body.
  addInner(foodId, opts = {}) {
    const m = makeFood(foodId);
    m.traverse(o => {
      if (!o.isMesh) return;
      o.material = bellyMaterial(o.material.clone(), 0.88);
      o.renderOrder = BELLY_ORDER;
      o.userData.c0 = o.material.color.clone();
      if (o.material.emissive) { o.material.emissive.copy(o.userData.c0).multiplyScalar(0.18); o.material.emissiveIntensity = 1; }
    });
    // Settle low in the belly, spread out under the face.
    // Snacks settle into the bottom of the belly, toward the sides so the face stays clear.
    const slot = this.innerItems.length;
    const side = slot % 2 === 0 ? 1 : -1;
    const rest = new THREE.Vector3(side * (0.36 + Math.random() * 0.24), 0.1 + Math.random() * 0.13, -0.15 + Math.random() * 0.3);
    const start = opts.settled ? rest.clone() : new THREE.Vector3(0, 0.62, 0.42);
    m.position.copy(start);
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    const s0 = foodId === 'iron' || foodId === 'crystal' ? 0.78 : 0.86;
    m.scale.setScalar(s0);
    this.inner.add(m);
    const it = {
      id: foodId, m, s0, start, rest, age: opts.age || 0, life: opts.life || DIGEST[foodId] * (0.9 + Math.random() * 0.2),
      spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.7),
      phase: Math.random() * 6, split: false, crumbs: [], dyes: [], dye: new THREE.Color(dyeColor(foodId)),
    };
    this.innerItems.push(it);
    // Too full: the oldest whole snack starts breaking down early.
    if (this.innerItems.length > 14) {
      const old = this.innerItems.find(x => !x.split);
      if (old) old.age = Math.max(old.age, old.life * 0.56);
    }
    return it;
  }

  splitInner(it) {
    it.split = true;
    it.m.visible = false;
    const [c1, c2] = CRUMB_COLORS[it.id];
    const n = it.id === 'iron' ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const col = new THREE.Color(i % 3 === 2 ? c2 : c1);
      const mat = bellyMaterial(new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: it.id === 'iron' ? 0.6 : 0, emissive: col.clone().multiplyScalar(0.2) }), 0.9);
      const c = new THREE.Mesh(CRUMB_GEO, mat);
      c.renderOrder = BELLY_ORDER;
      c.position.copy(it.m.position);
      c.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      const s = 0.7 + Math.random() * 0.8;
      c.scale.setScalar(s);
      this.inner.add(c);
      it.crumbs.push({ c, s, c0: mat.color.clone(), vel: new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.2) * 0.1, (Math.random() - 0.5) * 0.12) });
    }
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.SpriteMaterial({ map: dyeTexture(), color: it.dye, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const d = new THREE.Sprite(mat);
      d.renderOrder = BELLY_ORDER - 0.1;
      const p = it.m.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.12, 0.03, (Math.random() - 0.5) * 0.1));
      p.x = Math.max(-0.3, Math.min(0.3, p.x)); p.z = Math.max(-0.3, Math.min(0.25, p.z));
      d.position.copy(p);
      d.scale.setScalar(0.02);
      this.inner.add(d);
      it.dyes.push({ d, c0: mat.color.clone(), drift: new THREE.Vector3((Math.random() - 0.5) * 0.03, 0.015, (Math.random() - 0.5) * 0.03) });
    }
  }

  removeInner(it) {
    const kill = o => { this.inner.remove(o); o.traverse(x => { if ((x.isMesh || x.isSprite) && x.material) x.material.dispose(); }); };
    kill(it.m);
    for (const c of it.crumbs) kill(c.c);
    for (const d of it.dyes) kill(d.d);
  }

  updateInner(dt) {
    const t = this.time;
    const body = this.color;
    let tintW = 0;
    this._c2.setRGB(0, 0, 0);
    for (const it of this.innerItems) {
      it.age += dt;
      const p = it.age / it.life;
      const k = Math.min(1, it.age / 2.6);
      const e = 1 - (1 - k) ** 3;
      const m = it.m;
      m.position.lerpVectors(it.start, it.rest, e);
      m.position.x += Math.sin(t * 0.4 + it.phase) * 0.025;
      m.position.y += Math.sin(t * 0.33 + it.phase) * 0.015;
      m.position.z += Math.cos(t * 0.37 + it.phase) * 0.02;
      if (!it.split) {
        const slow = 1 - Math.min(0.85, p * 1.5);
        m.rotation.x += it.spin.x * dt * slow; m.rotation.y += it.spin.y * dt * slow; m.rotation.z += it.spin.z * dt * slow;
        const soft = smooth(0.08, 0.55, p);
        m.scale.set(it.s0 * (1 + 0.18 * soft), it.s0 * (1 - 0.34 * soft), it.s0 * (1 + 0.18 * soft));
        m.traverse(o => { if (o.isMesh) { o.material.color.copy(o.userData.c0).lerp(body, 0.12 + soft * 0.25); o.material.opacity = 0.88 - soft * 0.2; } });
        if (p >= 0.55) this.splitInner(it);
      }
      if (it.split) {
        const q = smooth(0.55, 1, p);
        for (const c of it.crumbs) {
          c.vel.multiplyScalar(Math.exp(-dt * 1.2));
          c.c.position.addScaledVector(c.vel, dt);
          c.c.position.y = Math.max(0.08, c.c.position.y - dt * 0.01);
          c.c.rotation.y += dt * 0.4;
          c.c.scale.setScalar(c.s * Math.max(0, 1 - q) ** 0.6);
          c.c.material.color.copy(c.c0).lerp(body, 0.15 + q * 0.45);
          c.c.material.opacity = 0.9 * (1 - q * 0.6);
        }
        const bloom = Math.sin(Math.min(1, q * 1.15) * Math.PI);
        for (const d of it.dyes) {
          d.d.position.addScaledVector(d.drift, dt);
          d.d.scale.setScalar(0.1 + 0.55 * bloom);
          d.d.material.opacity = 0.55 * bloom;
        }
        tintW += bloom;
        this._c2.r += it.dye.r * bloom; this._c2.g += it.dye.g * bloom; this._c2.b += it.dye.b * bloom;
      }
    }
    const done = this.innerItems.filter(it => it.age >= it.life);
    for (const it of done) this.removeInner(it);
    if (done.length) this.innerItems = this.innerItems.filter(it => it.age < it.life);
    // Dissolving color bleeds faintly into the whole body.
    if (tintW > 0) this.tint.setRGB(this._c2.r / tintW, this._c2.g / tintW, this._c2.b / tintW);
    const goal = Math.min(0.22, tintW * 0.07);
    this.tintAmt += (goal - this.tintAmt) * (1 - Math.exp(-dt * 0.8));
  }

  bellySnapshot() {
    return this.innerItems.map(it => ({ id: it.id, age: Math.round(it.age), life: Math.round(it.life) }));
  }

  setTraits(traits) {
    Object.assign(this.traits, traits);
    const entries = TRAIT_IDS.map(k => [k, traits[k] || 0]).filter(e => e[1] > 0.01).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, e) => s + e[1], 0);
    const c = BASE_COLOR.clone();
    if (total > 0) {
      // Lead with the strongest trait, tint with the runner-up, so mixes stay vivid instead of muddy.
      const mix = TRAIT_COLORS[entries[0][0]].clone();
      if (entries[1]) mix.lerp(TRAIT_COLORS[entries[1][0]], 0.38 * entries[1][1] / entries[0][1]);
      c.lerp(mix, Math.min(0.85, total / (total + 22)));
      const hsl = {};
      c.getHSL(hsl, THREE.SRGBColorSpace);
      c.setHSL(hsl.h, Math.max(hsl.s, 0.6), Math.min(0.78, Math.max(0.6, hsl.l)), THREE.SRGBColorSpace);
    }
    this.targetColor.copy(c);
    this.stiffness = 1 + Math.min(1.2, (traits.mineral || 0) / 40);
    this.sq.k = 170 * this.stiffness;
    this.mat.iridescence = Math.max(Math.min(1, (traits.prism || 0) / 25), (this.form && this.form.mat && this.form.mat.iridescence) || 0);
    const iris = c.clone().lerp(new THREE.Color('#ffffff'), 0.35);
    this.expr.iris = `rgba(${Math.round(iris.r * 255)}, ${Math.round(iris.g * 255)}, ${Math.round(iris.b * 255)}, 0.95)`;
  }

  // ---------- queries ----------
  localToWorld(v) { return this.body.localToWorld(v); }
  headTopWorld(out) { this.shapeDir(this._v2.set(0, 1, 0), out); out.y += 0.12; return this.body.localToWorld(out); }
  mouthWorld(out) {
    this.shapeDir(this.mouthDir, out);
    out.z += 0.05;
    return this.body.localToWorld(out);
  }
  faceWorld(out) { this.shapeDir(this.faceCenterDir, out); return this.body.localToWorld(out); }
  centerWorld(out) { out.set(0, CENTER_Y * (1 + this.sq.x), 0); return this.body.localToWorld(out); }
  hit(raycaster) {
    if (!this.visible) return null;
    const hits = raycaster.intersectObject(this.proxy, false);
    return hits.length ? hits[0] : null;
  }

  // ---------- frame ----------
  update(dt) {
    this.time += dt;
    const t = this.time;

    // size spring (grows smoothly, with a little overshoot)
    const ks = 30, kd = 7;
    this.sizeV += (-(this.size - this.sizeTarget) * ks - this.sizeV * kd) * dt;
    this.size += this.sizeV * dt;

    // springs (sub-stepped for stability)
    this.sq.target = this.breathAmp * Math.sin(t * this.breathRate) + this.sqBias;
    for (const n of this.nubList) {
      n.v += (-(n.len - n.target) * n.k - n.v * n.d) * dt;
      n.len = Math.max(0, n.len + n.v * dt);
      if (n.wave) {
        const a = Math.sin(t * 11) * n.wave;
        n.dir.copy(n.base).applyAxisAngle(this._fwd || (this._fwd = new THREE.Vector3(0, 0, 1)), a).normalize();
      } else n.dir.copy(n.base);
    }
    const pl = this.pull;
    pl.vel.addScaledVector(this._v.copy(pl.vec).sub(pl.target), -260 * dt);
    pl.vel.multiplyScalar(Math.exp(-dt * (pl.active ? 14 : 7)));
    pl.vec.addScaledVector(pl.vel, dt);
    pl.amt = pl.vec.length();
    const steps = 3, h = dt / steps;
    for (let i = 0; i < steps; i++) { this.sq.step(h); this.leanX.step(h); this.leanZ.step(h); this.roll.step(h); }
    this.sq.x = clamp(this.sq.x, -0.55, 0.45);

    // hop
    if (this.hopY > 0 || this.hopV > 0) {
      this.hopV -= 22 * dt;
      this.hopY += this.hopV * dt;
      if (this.hopY <= 0) {
        const impact = Math.min(6, -this.hopV);
        this.hopY = 0; this.hopV = 0;
        this.sq.v -= impact * 0.55;
        this.wobble = Math.min(0.08, this.wobble + impact * 0.008);
        this.onLand && this.onLand(impact);
      }
    }

    // dents spring back
    for (const d of this.dents) {
      d.age += dt;
      d.v += (-d.a * 260 - d.v * 13) * dt;
      d.a += d.v * dt;
    }
    this.dents = this.dents.filter(d => d.age < 0.25 || Math.abs(d.a) > 0.002 || Math.abs(d.v) > 0.02);
    this.wobble *= Math.exp(-dt * 3.2);
    if (this.gulp) {
      this.gulp.h -= dt * 1.15;
      if (this.gulp.h < 0.32) this.gulp.a *= Math.exp(-dt * 14);
      if (this.gulp.h < 0.1) this.gulp = null;
    }

    // yaw toward look target, plus spins
    if (this.lookTarget) {
      const wp = this.root.getWorldPosition(this._v);
      const dx = this.lookTarget.x - wp.x, dz = this.lookTarget.z - wp.z;
      this.yawTarget = clamp(Math.atan2(dx, Math.max(0.6, dz)) * 0.55, -0.55, 0.55);
    } else this.yawTarget = 0;
    this.yaw += (this.yawTarget - this.yaw) * (1 - Math.exp(-dt * 4));
    let spinAdd = 0;
    if (this.spinLeft > 0) {
      const sp = Math.min(this.spinLeft, dt * 9);
      this.spinLeft -= sp;
      this.spinAcc = (this.spinAcc || 0) + sp;
      if (this.spinLeft <= 0) this.spinAcc = 0;
      spinAdd = (this.spinAcc || 0) * this.spinDir;
    }
    this.root.rotation.y = this.yaw + spinAdd;
    this.body.rotation.z = this.roll.x;

    const s = this.size;
    this.body.scale.setScalar(s);
    this.body.position.y = this.hopY;

    // color + glow
    this.color.lerp(this.targetColor, 1 - Math.exp(-dt * 1.4));
    const shown = this._c.copy(this.colorOverride || this.color);
    const look = this.form;
    if (look && look.tint && !this.colorOverride) shown.lerp(this._lookTint || (this._lookTint = new THREE.Color()), 0).lerp(this._lookTint.set(look.tint), look.tintAmt || 0.5);
    if (this.tintAmt > 0.002 && !this.colorOverride) shown.lerp(this.tint, this.tintAmt);
    this.mat.attenuationColor.copy(shown);
    if (look && look.mapWhite && this.mat.map) this.mat.color.copy(shown).lerp(this._c2.setRGB(1, 1, 1), look.mapWhite);
    else this.mat.color.copy(shown);
    if (look && look.mapScroll && this.mat.map) this.mat.map.offset.x = (t * look.mapScroll) % 1;
    this.glow *= Math.exp(-dt * 1.5);
    const heatGlow = Math.min(0.28, this.traits.heat / 90) * (0.8 + 0.2 * Math.sin(t * 3));
    if (look && look.glowPattern) {
      const k = look.glowMode === 'pulse' ? 0.5 + 0.45 * (0.5 + 0.5 * Math.sin(t * (look.glowSpeed || 2))) : 0.55 + 0.35 * Math.random();
      this.mat.emissive.set(look.glowColor || '#ffffff').multiplyScalar(k + this.glow);
    }
    else this.mat.emissive.copy(shown).multiplyScalar(0.1 + heatGlow + this.glow * 0.7 + this.emissiveBoost + (look && look.glow || 0));
    this.mat.sheenColor.copy(shown).lerp(this._c2.setRGB(1, 1, 1), 0.6);

    // deform body
    const pos = this.geo.attributes.position.array;
    const b = this.base, az = this.baseAz, o = this._o;
    for (let i = 0, j = 0; i < b.length; i += 3, j++) {
      this.shape(b[i], b[i + 1], b[i + 2], az[j], o);
      pos[i] = o.x; pos[i + 1] = o.y; pos[i + 2] = o.z;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();


    // face patch
    const fp = this.faceGeo.attributes.position.array, fd = this.faceDirs;
    for (let i = 0; i < fd.length; i += 3) {
      const dx = fd[i], dy = fd[i + 1], dz = fd[i + 2];
      this.shape(dx, dy, dz, Math.atan2(dz, dx), o);
      const ny = o.y - CENTER_Y * (1 + this.sq.x);
      const len = Math.sqrt(o.x * o.x + ny * ny + o.z * o.z) || 1;
      fp[i] = o.x + o.x / len * 0.012;
      fp[i + 1] = o.y + ny / len * 0.012;
      fp[i + 2] = o.z + o.z / len * 0.012;
    }
    this.faceGeo.attributes.position.needsUpdate = true;

    // eyes: look + blink
    if (this.lookTarget) {
      const f = this.faceWorld(this._v);
      const local = this.root.worldToLocal(this._v2.copy(this.lookTarget));
      const fl = this.root.worldToLocal(f);
      const dx = local.x - fl.x, dy = local.y - fl.y, dz = Math.max(0.5, local.z - fl.z);
      this.lookGoal.set(clamp(dx / dz * 1.6, -1, 1), clamp(-dy / dz * 1.8, -1, 1));
    } else this.lookGoal.set(0, 0);
    this.look.lerp(this.lookGoal, 1 - Math.exp(-dt * 12));
    this.blinkT -= dt;
    if (this.blinkT <= 0 && this.blinkPhase < 0) {
      this.blinkPhase = 0;
      this.blinkT = Math.random() < 0.18 ? 0.25 : 2 + Math.random() * 4;
    }
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt / 0.15;
      this.blink = Math.sin(Math.min(1, this.blinkPhase) * Math.PI);
      if (this.blinkPhase >= 1) { this.blinkPhase = -1; this.blink = 0; }
    }
    this.faceT -= dt;
    if (!this.lite || this.faceT <= 0) {
      this.faceT = 1 / 12;
      this.face.draw(this.expr, this.look, this.blink, t);
      this.face.texture.needsUpdate = true;
    }

    // accessories
    for (const a of this.acc) {
      const hidden = this.form && !(this.form.keep || []).includes(a.trait);
      const target = hidden ? 0 : smooth(a.at, a.at + 14, this.traits[a.trait] || 0);
      a.grow += (target - a.grow) * (1 - Math.exp(-dt * 2));
      const vis = a.grow > 0.02;
      a.obj.visible = vis;
      if (!vis) continue;
      this.shape(a.dir.x, a.dir.y, a.dir.z, Math.atan2(a.dir.z, a.dir.x), o);
      const ny = o.y - CENTER_Y * (1 + this.sq.x);
      const len = Math.sqrt(o.x * o.x + ny * ny + o.z * o.z) || 1;
      const nx = o.x / len, nny = ny / len, nz = o.z / len;
      a.obj.position.set(o.x + nx * a.off, o.y + nny * a.off, o.z + nz * a.off);
      this._v.set(nx, nny, nz);
      this._q.setFromUnitVectors(this._up, this._v);
      a.obj.quaternion.copy(this._q);
      a.obj.scale.setScalar(a.grow * a.base);
    }
    if (this.flame.visible) {
      const f = 1 + Math.sin(t * 17) * 0.08 + Math.sin(t * 29) * 0.05;
      this.flame.children[0].scale.set(1 / f, f, 1 / f);
    }
    if (this.sprout.visible) this.sprout.rotation.y = Math.sin(t * 1.3) * 0.25;

    // inner items
    this.inner.scale.set(1 - this.sq.x * 0.45, 1 + this.sq.x, 1 - this.sq.x * 0.45);
    this.updateInner(dt);
    this.placeOutfits(dt);
    const hatOn = !!this.outfit.head || this.cap.grow > 0.3;
    for (const p of this.formProps) {
      if (p.head) { p.obj.visible = !hatOn; if (hatOn) continue; }
      if (p.ring !== undefined) {
        this.shape(0, p.ring, 0, 0, o);
        const cx = o.x, cy = o.y, cz = o.z;
        this.shape(Math.sqrt(1 - p.ring * p.ring), p.ring, 0, 0, o);
        const r = Math.abs(o.x - cx);
        p.obj.position.set(cx, cy, cz);
        p.obj.scale.set(r, r * (1 + this.sq.x), r);
      }
      p.update && p.update(t);
    }

    // nightcap
    const cap = this.cap;
    cap.grow += ((cap.on ? 1 : 0) - cap.grow) * (1 - Math.exp(-dt * 6));
    cap.obj.visible = cap.grow > 0.02;
    if (cap.obj.visible) {
      this.shape(cap.dir.x, cap.dir.y, cap.dir.z, Math.atan2(cap.dir.z, cap.dir.x), o);
      cap.obj.position.set(o.x, o.y - 0.06, o.z);
      cap.obj.rotation.set(-0.15, 0.4, -0.25 + Math.sin(t * 1.3) * 0.04);
      const pop = cap.grow * (1 + Math.sin(cap.grow * Math.PI) * 0.15);
      cap.obj.scale.setScalar(pop);
    }

    // shadow
    const sh = s * 2.25 * (1 - this.sq.x * 0.35) / (1 + this.hopY * 0.8);
    this.shadow.scale.set(sh, sh * 0.92, 1);
    this.shadow.material.opacity = 0.9 / (1 + this.hopY * 2);
  }
}
