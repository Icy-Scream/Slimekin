// The slime: a soft jelly body deformed on the CPU every frame (squash, lean,
// poke dents, wobble, swallowing bulge), a canvas face that hugs the surface,
// accessories that grow from its diet, and eaten food floating inside.
import * as THREE from 'three';
import { FaceRenderer, FACE_H } from './face.js';
import { BOTTOM, HEIGHT, CENTER_Y, TAU, clamp, smooth, nrm3, A0, B0, N0, bodyTopology, restShape, curlFrame } from './body.js';
const [A0x, A0y, A0z] = A0;
import { makeFood, OUTFIT_MAKERS } from './models.js';
import { FORM_LOOKS, PROP_MAKERS, makePattern } from './forms.js';
import { TRAITS, TRAIT_IDS, FOOD_BY_ID, BREEDS } from '../data/content.js';
import { recipeFor, stageM, cleanBody } from '../core/recipe.js';
import { scarfLayout, scarfHeight, scarfScratch, fitScarf } from './scarf.js';
import { seeThroughLod } from './see-through.js';

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
// ring: worn around the body at this height (on the unit sphere). fit: follows the body's real outline (the scarf,
// view/scarf.js: its height comes from the mouth and the neck, not from here).
const OUTFIT_SPECS = {
  bow:     { dir: [-0.5, 0.8, 0.34], off: 0.03, align: 'up' },
  beret:   { dir: [0.12, 1, 0.14], off: -0.06, align: 'up' },
  party:   { dir: [0.2, 1, 0.1], off: -0.04, align: 'up' },
  crown:   { dir: [0, 1, 0.06], off: -0.03, align: 'up' },
  flowers: { ring: 0.8, off: 0.0 },
  scarf:   { fit: true },
  bowtie:  { dir: [0, -0.33, 0.94], off: 0.04, align: 'front' },
  glasses: { dir: [0, 0.215, 0.977], off: 0.07, align: 'front' },
  shades:  { dir: [0, 0.215, 0.977], off: 0.08, align: 'front' },
};
// Face and neck pieces follow the face up and down the body (its elevation `faceEl` changes with the breed and as it
// grows): the directions above fit a face at OUTFIT_FACE_EL. The bow tie sits higher than it was drawn for (the
// recipe body's mouth is higher on the face than the old one's), by OUTFIT_NECK_RAISE.
const OUTFIT_FACE_EL = 0.2, OUTFIT_NECK_RAISE = 0.11;
// The face canvas covers this much of the body's elevation (radians), top to bottom.
const FACE_EL_SPAN = 0.9;
// The Cozy Scarf's meshes baked into the scarf's own space (the worn copy only: models.js makes a fresh one each time),
// with each vertex's place on the ring (view/scarf.js). Their vertices move every frame, so the bounds are generous.
export function scarfParts(obj) {
  const parts = [];
  for (const m of obj.children) {
    if (!m.isMesh || !m.userData.fit) continue;
    m.updateMatrix();
    m.geometry.applyMatrix4(m.matrix);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    const P = m.geometry.attributes.position, Nm = m.geometry.attributes.normal;
    P.setUsage(THREE.DynamicDrawUsage); Nm.setUsage(THREE.DynamicDrawUsage);
    m.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);
    parts.push({ mesh: m, L: scarfLayout(P.array, Nm.array, m.userData.fit === 'tail'), pos: P.array, nrm: Nm.array });
  }
  return parts;
}
function bellyMaterial(mat, opacity) {
  mat.transparent = true;
  mat.opacity = opacity;
  mat.depthTest = false;
  mat.depthWrite = false;
  return mat;
}

const BASE_COLOR = new THREE.Color('#7ee6c3');
const PURE_IRIDESCENCE = 0.55;
const PURE_SHEEN = new THREE.Color('#ffe7a0');
const lerp = (a, b, t) => a + (b - a) * t;
let LOD_SEQ = 0;   // staggers which frame each resident reshapes on

// ---------- the recipe body ----------
// One body for every slime (the pure math is in view/body.js, so node tests check exactly what is drawn): unit
// directions in rings around the curl's axis, denser along the curl, so the same points can be the baby drop, a
// Dollop's dome or a Curly's curl. The shape is the recipe (core/recipe.js, BREEDS in content.js) plus slow goo
// motion plus every physics term (dents, squash, lean, hop, wobble, gulp, little hands, taffy pull), then a grown-up
// form's shape on top.
// Bubbles inside the jelly.
let BUBBLE_TEX = null;
function bubbleTex() {
  if (BUBBLE_TEX) return BUBBLE_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 10, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(0.8, 'rgba(210,245,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(32, 32, 30, 0, TAU); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 24, 0, TAU); x.stroke();
  x.fillStyle = 'rgba(255,255,255,0.95)'; x.beginPath(); x.ellipse(24, 23, 6, 4, -0.6, 0, TAU); x.fill();
  BUBBLE_TEX = new THREE.CanvasTexture(c); BUBBLE_TEX.colorSpace = THREE.SRGBColorSpace;
  return BUBBLE_TEX;
}
const BUBBLE_DIRS = [[-0.45, 0.35, 0.8], [0.3, 0.5, 0.82], [0.55, 0.15, 0.85], [-0.2, 0.62, 0.78], [0.05, 0.25, 0.97], [-0.62, 0.05, 0.78]].map(d => nrm3(...d));
// The jelly skin: a soft blurred inside, a rim light, a lighter glow low in the body, small crisp painted highlights
// (small on purpose: big white spots read as glass) and, on the wet skin, a slow ripple that makes the shine crawl.
// uMk: how gummy (Dollop) the body is; uWet: the wet skin's small glints; uRip: the ripple (off on Low graphics).
function jellyShader(U) {
  return sh => {
    Object.assign(sh.uniforms, U);
    seeThroughLod(sh);   // [perf] the see-through buffer is drawn smaller: sample it as if it were full size (see-through.js)
    sh.vertexShader = 'varying vec3 vLocalP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLocalP = transformed;');
    sh.fragmentShader = 'varying vec3 vLocalP;\nuniform float uTime; uniform vec3 uRim; uniform vec3 uLow; uniform float uMk; uniform float uWet; uniform float uRip;\n' +
      'vec3 slimeRipple(vec3 lp) { vec3 q = lp * vec3(7.0, 5.0, 7.0); q.y += uTime * 0.55;\n' +
      '  return vec3(sin(q.x * 1.3 + sin(q.y * 1.7) * 1.2), sin(q.y * 1.1 + sin(q.z * 1.5 + q.x) * 1.3) * 0.5, sin(q.z * 1.2 + sin(q.x * 1.4 + q.y) * 1.1)); }\n' +
      sh.fragmentShader
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  if (uRip > 0.0) normal = normalize(normal + slimeRipple(vLocalP) * 0.06 * uRip);')
        .replace('#include <clearcoat_normal_fragment_maps>', '#include <clearcoat_normal_fragment_maps>\n  if (uRip > 0.0) clearcoatNormal = normalize(clearcoatNormal + slimeRipple(vLocalP) * 0.11 * uRip);')
        .replace('#include <opaque_fragment>', `
      {
        vec3 Vd = normalize(vViewPosition);
        vec3 Nn = normalize(normal);
        float ndv = clamp(dot(Nn, Vd), 0.0, 1.0);
        float frs = 1.0 - ndv;
        float low = smoothstep(0.85, 0.05, vLocalP.y);
        outgoingLight *= 1.0 - 0.2 * uMk * smoothstep(0.45, 1.25, vLocalP.y);
        outgoingLight = mix(outgoingLight, uLow, (0.2 + 0.14 * uMk) * low * (0.4 + 0.6 * ndv));
        vec3 p = vLocalP * vec3(2.2, 2.6, 2.2);
        float sw = sin(p.x * 1.4 + sin(p.y * 1.9 + uTime * 0.5) * 1.5 + uTime * 0.3) * sin(p.z * 1.3 + sin(p.x * 1.2 - uTime * 0.4) * 1.3 + p.y * 0.8);
        outgoingLight += uLow * smoothstep(0.55, 0.9, sw) * 0.1 * low;
        outgoingLight = mix(outgoingLight, uRim, smoothstep(0.55, 0.92, frs) * 0.28);
        float d1 = dot(Nn, normalize(vec3(-0.45, 0.55, 0.7))), d2 = dot(Nn, normalize(vec3(0.6, 0.3, 0.75)));
        float h1 = smoothstep(mix(mix(0.972, 0.988, uWet), 0.992, uMk), mix(mix(0.98, 0.993, uWet), 0.996, uMk), d1);
        float h2 = smoothstep(mix(mix(0.986, 0.994, uWet), 0.995, uMk), mix(mix(0.99, 0.997, uWet), 0.998, uMk), d2);
        outgoingLight = mix(outgoingLight, vec3(1.0), clamp(h1 * mix(0.78, 0.62, uMk) + h2 * mix(0.65, 0.5, uMk), 0.0, 1.0));
      }
      #include <opaque_fragment>`);
  };
}
// The jelly's material numbers (v3base look): a plain Curly (mk 0) to a grown Dollop's gummy skin (mk 1); wet = the
// wet skin (small glints instead of broad glass patches). A grown-up form's own `mat` numbers win over these.
const JELLY = {
  static: { thickness: 1.4, ior: 1.25, attenuationDistance: 1.3 },
  live: (mk, wet) => ({
    roughness: lerp(0.3, 0.36, mk),
    clearcoat: lerp(lerp(1, 0.6, wet), 0.45, mk), clearcoatRoughness: lerp(lerp(0.08, 0.16, wet), 0.3, mk),
    sheen: lerp(0.4, 0.75, mk), specularIntensity: lerp(lerp(1, 0.45, wet), 0.35, mk),
    transmission: lerp(0.5, 0.32, mk),
  }),
};

// [perf] The body's normals each frame: three.js's computeVertexNormals (indexed) written out on the arrays, the same
// sums in the same order with the same float32 stores, so the same numbers (it was a quarter of the body's cost).
function bodyNormals(geo) {
  const pos = geo.attributes.position.array, idx = geo.index.array;
  let na = geo.attributes.normal;
  if (!na) { na = new THREE.BufferAttribute(new Float32Array(pos.length), 3); geo.setAttribute('normal', na); }
  const n = na.array;
  n.fill(0);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
    const cx = pos[c] - bx, cy = pos[c + 1] - by, cz = pos[c + 2] - bz;
    const ax = pos[a] - bx, ay = pos[a + 1] - by, az = pos[a + 2] - bz;
    const x = cy * az - cz * ay, y = cz * ax - cx * az, z = cx * ay - cy * ax;
    n[a] += x; n[a + 1] += y; n[a + 2] += z;
    n[b] += x; n[b + 1] += y; n[b + 2] += z;
    n[c] += x; n[c + 1] += y; n[c + 2] += z;
  }
  for (let i = 0; i < n.length; i += 3) {
    const x = n[i], y = n[i + 1], z = n[i + 2], k = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
    n[i] = x * k; n[i + 1] = y * k; n[i + 2] = z * k;
  }
  na.needsUpdate = true;
}

class Spring {
  constructor(k, d, x = 0) { this.k = k; this.d = d; this.x = x; this.v = 0; this.target = x; }
  step(dt) { const a = -this.k * (this.x - this.target) - this.d * this.v; this.v += a * dt; this.x += this.v * dt; }
}

const TRAIT_COLORS = Object.fromEntries(TRAIT_IDS.map(k => [k, new THREE.Color(TRAITS[k].color)]));

// Pure slimes (same form as both parents) twinkle with a few soft four-point sparkles.
let PURE_TEX = null, PURE_GLOW = null;
function pureGlowTex() {
  if (PURE_GLOW) return PURE_GLOW;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.62, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  PURE_GLOW = new THREE.CanvasTexture(c);
  PURE_GLOW.colorSpace = THREE.SRGBColorSpace;
  return PURE_GLOW;
}
function pureStarTex() {
  if (PURE_TEX) return PURE_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#ffffff'; x.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? 4 : 31; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  x.fill();
  PURE_TEX = new THREE.CanvasTexture(c);
  PURE_TEX.colorSpace = THREE.SRGBColorSpace;
  return PURE_TEX;
}

export class SlimeAvatar {
  // lite: a cheaper slime for the ranch (lighter body, face redrawn less often).
  constructor({ quality = 'high', lite = false } = {}) {
    this.lite = lite;
    // how often the body's points are reshaped: 1 = every frame; ranch residents the camera isn't close to use 2
    // (every other frame, staggered between residents) to halve their cost while you watch the ranch
    this.lod = 1;
    this._lodN = LOD_SEQ++;
    this.faceT = 0;
    this.root = new THREE.Group();
    this.body = new THREE.Group();     // squash pivot + roll
    this.root.add(this.body);

    // the recipe body (see BREEDS in content.js): the slime's own mix of the breeds, its shape number m
    // (0 = baby .. 1 = grown, eased toward mTarget) and the recipe S it shows now
    this.bodyInfo = { breed: 'curly', variant: 'plain', mix: 0, genes: { tall: 1, wide: 1, lump: 1, side: 0 } };
    this.m = 0; this.mTarget = 0; this.mixS = 0; this.mk = 0;
    this.S = recipeFor(this.bodyInfo, 0);
    this._rKey = '';
    this.curl = null;                  // the curl's frame this frame (frameCurl)
    this.dyn = { sx: 0, vx: 0, sz: 0, vz: 0 };   // the curl sways behind the body's lean
    this.tipGrab = 0;                  // > 0 while the curl is held by its tip (how far up it was grabbed)
    this.topIdx = -1;                  // the highest point of the body (the curl's top, or the dome's)
    this.faceEl = -1;
    this._curlBuf = { cA: new Float32Array(129), cB: new Float32Array(129), ph: new Float32Array(129) };   // the curl's centerline
    this.wet = true;                   // the wet skin (small crisp glints); ripple: its slow ripple (not on Low)
    this.ripple = true;

    this.geo = new THREE.BufferGeometry();
    this.useBody(lite ? 'lite' : 'full');

    this.jellyU = { uTime: { value: 0 }, uRim: { value: new THREE.Color('#bdf3ff') }, uLow: { value: new THREE.Color('#8fe4ff') }, uMk: { value: 0 }, uWet: { value: 1 }, uRip: { value: 1 } };
    this.mat = new THREE.MeshPhysicalMaterial({
      color: BASE_COLOR.clone(),
      roughness: 0.3,
      metalness: 0,
      transmission: 0.5,
      thickness: JELLY.static.thickness,
      ior: JELLY.static.ior,
      attenuationColor: BASE_COLOR.clone(),
      attenuationDistance: JELLY.static.attenuationDistance,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      sheen: 0.4,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color('#ffffff'),
      emissive: BASE_COLOR.clone().multiplyScalar(0.05),
      iridescence: 0,
      iridescenceIOR: 1.3,
    });
    this.mat.onBeforeCompile = jellyShader(this.jellyU);
    this.mat.customProgramCacheKey = () => 'slimekin-jelly';
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.renderOrder = 1;
    this.body.add(this.mesh);

    // the baby's two little feet (they tuck in as it grows)
    const footGeo = new THREE.SphereGeometry(1, lite ? 14 : 28, lite ? 10 : 18);
    this.feet = [-1, 1].map(side => {
      const f = new THREE.Mesh(footGeo, this.mat);
      f.renderOrder = 1; f.visible = false; f.userData.d = nrm3(side * 0.55, -0.62, 0.62);
      this.body.add(f);
      return f;
    });
    this._hitList = [];
    // bubbles inside the jelly (drawn over it, like the snacks in the belly; residents show them when visited)
    this.fizz = new THREE.Group();
    this.body.add(this.fizz);
    this.bubbles = BUBBLE_DIRS.map((d, i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex(), depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 }));
      sp.renderOrder = 1.5; sp.userData = { d, r: 0.03 + (i % 3) * 0.012, ph: i * 1.7 };
      this.fizz.add(sp);
      return sp;
    });

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
    this._hsl = {};
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
    this.turnYaw = 0; this.turnTarget = 0; this.turnRate = 3;   // an extra body turn the game can ask for (Moving Day signs)
    this.hopY = 0; this.hopV = 0;
    this.dents = [];
    this.wobble = 0;
    this.gulp = null;
    this.time = 0;
    this.size = 0.6; this.sizeTarget = 0.6; this.sizeV = 0;
    this.breathAmp = 0.022; this.breathRate = 2.1;
    this.shadowFade = 1;   // the send-off lifts the slime off the cushion: its shadow fades (send-off.js)
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
    this.mat.transmission = high ? 0.5 : 0;
    this.mat.transparent = !high;
    this.mat.opacity = high ? 1 : 0.9;
    this.mat.needsUpdate = true;
    // Low graphics: no wet ripple, and the pet uses the lighter body too
    this.ripple = high;
    if (!this.lite) this.useBody(high ? 'full' : 'lite');
  }

  // ---------- the recipe body ----------
  // Which body the mesh uses ('full' for the pet, 'lite' for residents and on Low graphics). Same math either way.
  useBody(kind) {
    if (this.bodyKind === kind) return;
    const T = bodyTopology(kind), geo = this.geo;
    this.bodyKind = kind;
    this.base = T.base; this.baseAz = T.baseAz;
    geo.setIndex(new THREE.BufferAttribute(T.index, 1));
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(T.count * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(T.uvs, 2));
    geo.deleteAttribute('normal');
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.7, 0), 3.2);
    this.topIdx = -1;
    this.tipGrab = 0;
    if (this.mesh) this.deform();
  }
  // The slime's body: { breed, variant, mix, genes } (from the save). instant: no morph (loading, a new egg).
  setRecipe(body, { instant = false } = {}) {
    const b = cleanBody(body);
    this.bodyInfo = b;
    if (instant) this.mixS = b.mix;
    this._rKey = '';
  }
  // Growth: stage index (STAGES) and how far along it is; the body eases toward it (instant: jump there).
  setStage(stageIndex, progress = 0, instant = false) {
    this.mTarget = stageM(stageIndex, progress);
    if (instant) { this.m = this.mTarget; this._rKey = ''; }
  }
  // The recipe this frame: eased growth and mix (blending numbers is cheap; recomputed only while they move).
  updateRecipe(dt) {
    this.m += (this.mTarget - this.m) * (1 - Math.exp(-dt * BREEDS.growEase));
    this.mixS += (this.bodyInfo.mix - this.mixS) * (1 - Math.exp(-dt * BREEDS.mixEase));
    if (Math.abs(this.m - this.mTarget) < 1e-4) this.m = this.mTarget;
    if (Math.abs(this.mixS - this.bodyInfo.mix) < 1e-4) this.mixS = this.bodyInfo.mix;
    const key = this.m.toFixed(4) + '|' + this.mixS.toFixed(4);
    if (key === this._rKey) return;
    this._rKey = key;
    this.S = recipeFor({ ...this.bodyInfo, mix: this.mixS }, this.m);
    // the gummy skin comes in with the Dollop breed, fully when grown
    this.mk = this.mixS * (0.35 + 0.65 * smooth(0, 1, this.m));
    // the face slides from the Curly face (big glossy eyes, open smile) to the Dollop face (dark ovals, tiny smile)
    const g = smooth(0.5, 1, this.m);
    this.face.mixK = this.mixS; this.face.grown = g;
    this.face.eyeDX = lerp(118, lerp(102, 118, g), this.mixS);
    if (Math.abs(this.S.faceEl - this.faceEl) > 0.002) this.setFaceEl(this.S.faceEl);
  }
  // Where the face sits (its elevation on the body, radians); the mouth and face points follow it.
  setFaceEl(el0) {
    const uv = this.faceGeo.attributes.uv.array, fd = this.faceDirs, AZ = 1.32, EL = FACE_EL_SPAN;
    for (let i = 0; i < fd.length / 3; i++) {
      const az = (uv[i * 2] - 0.5) * AZ, el = el0 + (uv[i * 2 + 1] - 0.5) * EL;
      fd[i * 3] = Math.sin(az) * Math.cos(el); fd[i * 3 + 1] = Math.sin(el); fd[i * 3 + 2] = Math.cos(az) * Math.cos(el);
    }
    this.faceEl = el0;
    // the drawn mouth sits at mouthY on the face canvas; mouthDir stays the same bit below it as before
    const mouthEl = el0 + (0.5 - this.face.mouthY / FACE_H) * EL - 0.19;
    this.mouthDir.set(0, Math.sin(mouthEl), Math.cos(mouthEl));
    this.faceCenterDir.set(0, Math.sin(el0 - 0.03), Math.cos(el0 - 0.03));
  }
  // The curl's frame for this frame: its base ring, axis and centerline (it lags behind the lean, droops when
  // squashed, and straightens while its tip is pulled).
  frameCurl() {
    this.curl = curlFrame(this.S, this.time, this.formShape, this.dyn, this.sq.x, this.pull.amt, this.tipGrab, this._curlBuf);
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
  // pure: the Pure version (same form as both parents): brighter colors, a soft shimmer and sparkles.
  setForm(id, { pure = false } = {}) {
    const look = FORM_LOOKS[id] || null;
    for (const p of this.formProps) for (const o of [p.obj, ...(p.extra || [])]) o.parent && o.parent.remove(o);
    this.formProps = [];
    if (this.pureFx) { this.body.remove(this.pureFx.group); this.pureFx = null; }
    this.pure = !!(pure && look);
    const m = this.mat;
    // the jelly skin (JELLY: the live numbers follow the breed every frame), then the form's own material numbers
    Object.assign(m, { metalness: 0, iridescence: Math.min(1, (this.traits.prism || 0) / 25), ...JELLY.static, ...JELLY.live(this.mk, this.wet ? 1 : 0) });
    m.iridescenceThicknessRange = [100, 400];
    if (this.quality === 'low') m.transmission = 0;
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
    if (this.pure) {
      m.sheen = 1; m.iridescence = Math.max(m.iridescence, PURE_IRIDESCENCE);
      this.pureFx = this.buildPure();
    }
    // material numbers the form (or Pure) sets itself: the jelly's live numbers leave them alone
    this.lockedMat = new Set([...Object.keys((look && look.mat) || {}), ...(this.pure ? ['sheen'] : [])]);
    this.formAnchor = (this.formProps.find(p => p.anchor) || {}).anchor || null;
    m.needsUpdate = true;
  }

  buildPure() {
    const group = new THREE.Group();
    // a soft golden glow around the body (it sits in the middle, so only the part outside the body shows)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: pureGlowTex(), color: '#ffd45c', transparent: true, depthWrite: false, opacity: 0.5 }));
    glow.position.set(0, CENTER_Y, 0);
    group.add(glow);
    const n = this.lite ? 5 : 8, items = [];
    const cols = ['#ffc21a', '#ffd95a', '#ffb02e'];
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pureStarTex(), color: cols[i % 3], transparent: true, depthWrite: false, opacity: 0 }));
      sp.renderOrder = 3;
      group.add(sp);
      // spread around the body, high and low, so one is always twinkling somewhere
      items.push({ sp, az: i / n * Math.PI * 2 + 0.5, el: [0.75, 0.2, 0.45, -0.1][i % 4], ph: i * 1.9 });
    }
    this.body.add(group);
    return { group, glow, items };
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
        if (sp.fit) this.outfit[slot].fit = { parts: scarfParts(obj), H: {}, T: {}, S: null, F: null, chin: NaN, wait: 0, fitted: false };
      }
    }
  }

  // This body without its quick moves (squash, lean, boops, wobble, gulps, little hands, pulls): its shape() is the
  // goo at rest, slow lumps and all.
  calmView() {
    return this._calmView || (this._calmView = Object.assign(Object.create(this), { wobble: 0, dents: [], gulp: null, nubList: [], pull: { amt: 0 }, sq: { x: 0 }, leanX: { x: 0 }, leanZ: { x: 0 } }));
  }
  // The Cozy Scarf follows the body's real outline (view/scarf.js). Its height is worked out on the calm body (a boop
  // never makes it jump) when the recipe, the form or the face moves, and a few times a second as the goo's slow lumps
  // drift (eased); the outline every frame the body is reshaped (every other frame for a resident you are not
  // visiting, in step with its body).
  placeScarf(it, pop, dt) {
    const fit = it.fit, f = this.face;
    // the mouth's lowest everyday point on the face's center line (the scarf stays under it)
    const chinEl = this.faceEl + (0.5 - (f.mouthY + f.mouthLow()) / FACE_H) * FACE_EL_SPAN;
    fit.wait -= dt;
    if (fit.S !== this.S || fit.F !== this.formShape || fit.chin !== chinEl || fit.wait <= 0) {
      scarfHeight(this.calmView(), chinEl, fit.T);
      if (!fit.S) Object.assign(fit.H, fit.T);
      fit.S = this.S; fit.F = this.formShape; fit.chin = chinEl; fit.wait = 0.25;
    }
    const H = fit.H, T = fit.T, k = 1 - Math.exp(-dt * 6);
    H.el += (T.el - H.el) * k; H.t += (T.t - H.t) * k; H.yC += (T.yC - H.yC) * k; H.chinEl = chinEl;
    if (this._reshaped || !fit.fitted) {
      const C0 = fitScarf(this, H, fit.parts, this.sq.x, this._scarfX || (this._scarfX = scarfScratch()));
      it.obj.position.set(C0[0], C0[1], C0[2]);
      for (const p of fit.parts) { const a = p.mesh.geometry.attributes; a.position.needsUpdate = true; a.normal.needsUpdate = true; }
      fit.fitted = true;
    }
    it.obj.scale.setScalar(pop);
  }

  placeOutfits(dt) {
    const o = this._o;
    for (const slot of ['head', 'face', 'neck']) {
      const it = this.outfit[slot];
      if (!it) continue;
      const hide = slot === 'head' && this.cap.on;
      const lift = slot === 'head' && this.form && this.form.hatLift || 0;   // e.g. sits on Storm's cloud puffs
      it.grow += ((hide ? 0 : 1) - it.grow) * (1 - Math.exp(-dt * 7));
      it.obj.visible = it.grow > 0.02;
      if (!it.obj.visible) continue;
      const pop = it.grow * (1 + Math.sin(Math.min(1, it.grow) * Math.PI) * 0.12);
      const sp = it.spec;
      if (sp.fit) { this.placeScarf(it, pop, dt); continue; }
      const fe = this.faceEl > -0.5 ? this.faceEl : OUTFIT_FACE_EL;
      const tilt = slot === 'head' ? 0 : fe - OUTFIT_FACE_EL + (slot === 'neck' ? OUTFIT_NECK_RAISE : 0);
      if (sp.ring !== undefined) {
        const ry = Math.sin(Math.asin(sp.ring) + tilt);
        this.shape(0, ry, 0, 0, o);
        const cx = o.x, cy = o.y, cz = o.z;
        const rx = Math.sqrt(1 - ry * ry);
        // the body's width around that ring (square forms, lumps and the goo lip are not round): a crown rests on the
        // widest part
        let rMax = 0;
        for (let k = 0; k < 8; k++) { const a = k * TAU / 8; this.shape(rx * Math.cos(a), ry, rx * Math.sin(a), a, o); rMax = Math.max(rMax, Math.hypot(o.x - cx, o.z - cz)); }
        const r = rMax + 0.02;
        it.obj.position.set(cx, cy + sp.off + lift, cz);
        it.obj.scale.set(r * pop, r * pop * (1 + this.sq.x), r * pop);
        continue;
      }
      let dx = it.dir.x, dy = it.dir.y, dz = it.dir.z;
      if (tilt) { const c = Math.cos(tilt), sn = Math.sin(tilt); dy = it.dir.y * c + it.dir.z * sn; dz = it.dir.z * c - it.dir.y * sn; }
      this.shape(dx, dy, dz, Math.atan2(dz, dx), o);
      const ny = o.y - CENTER_Y * (1 + this.sq.x);
      const len = Math.sqrt(o.x * o.x + ny * ny + o.z * o.z) || 1;
      this._v.set(o.x / len, ny / len, o.z / len);
      it.obj.position.set(o.x + this._v.x * (sp.off + lift), o.y + this._v.y * (sp.off + lift), o.z + this._v.z * (sp.off + lift));
      this._q.setFromUnitVectors(sp.align === 'front' ? this._z : this._up, this._v);
      it.obj.quaternion.copy(this._q);
      if (sp.align === 'up') it.obj.rotateZ(it.rot0.z);
      it.obj.scale.setScalar(pop);
    }
  }

  // A medal pin (view/medal-pin.js) sits on the chest, just outside the surface, like an outfit.
  placePin() {
    const p = this.medalPin;
    if (!p) return;
    const o = this._o, d = p.dir;
    this.shape(d.x, d.y, d.z, Math.atan2(d.z, d.x), o);
    const ny = o.y - CENTER_Y * (1 + this.sq.x);
    const len = Math.sqrt(o.x * o.x + ny * ny + o.z * o.z) || 1;
    p.sprite.position.set(o.x + o.x / len * p.off, o.y + ny / len * p.off, o.z + o.z / len * p.off);
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
  // A point of the body for the unit direction (px, py, pz) (az = its azimuth). arm: also the curl (the body mesh
  // and grabbing use it); without it, the point sits on the dome under the curl, which keeps outfits, props, the face
  // and the pin steady on the body while the curl sways or is pulled.
  // This frame's lump and knob sizes (they breathe a little) and each knob's reach, worked out once per frame and
  // recipe instead of once per point.
  liveSizes() {
    const S = this.S, T = this.time, L = this._live || (this._live = { T: NaN, S: null, b: [], k: [], c: [] });
    if (L.T === T && L.S === S) return L;
    S.bumps.forEach((b, i) => { L.b[i] = b[1] * (1 + 0.15 * Math.sin(T * 0.9 + i * 1.7)); });
    S.knobs.forEach((k, i) => { L.k[i] = k[1] * (1 + 0.08 * Math.sin(T * 1.1 + i)); L.c[i] = Math.cos(k[2]); });
    L.T = T; L.S = S;
    return L;
  }
  shape(px, py, pz, az, o, arm = false) {
    const S = this.S, C = this.curl, T = this.time, FS = this.formShape;
    restShape(px, py, pz, az, S, T, FS, o);
    let x = o.x, y = o.y, z = o.z, tipW = 0, armSp = -1;
    if (arm && C) {
      const c = px * A0x + py * A0y + pz * A0z;
      if (c > C.c0) {
        const sp = 1 - Math.pow(Math.acos(Math.min(1, c)) / C.th, 1.5);
        const ex = px - c * A0x, ey = py - c * A0y, ez = pz - c * A0z;
        const el = Math.hypot(ex, ey, ez) || 1e-9;
        const u = (ex * B0[0] + ey * B0[1] + ez * B0[2]) / el, v = (ex * N0[0] + ey * N0[1] + ez * N0[2]) / el;
        const fi = clamp(sp, 0, 1) * 128, i0 = Math.min(127, fi | 0), fr = fi - i0;
        const fA = C.cA[i0] + (C.cA[i0 + 1] - C.cA[i0]) * fr, fB = C.cB[i0] + (C.cB[i0 + 1] - C.cB[i0]) * fr;
        const phv = C.ph[i0] + (C.ph[i0 + 1] - C.ph[i0]) * fr, sk = Math.sin(phv), ck = Math.cos(phv);
        let rho;
        if (sp < 0.3) { const q = 1 - sp / 0.3; rho = S.ra + (C.r0 - S.ra) * q * q; }
        else if (sp <= 0.86) rho = S.ra + (S.rt - S.ra) * (sp - 0.3) / 0.56;
        else { const q = (sp - 0.86) / 0.14; rho = S.rt * Math.sqrt(Math.max(0, 1 - q * q)); }
        const A = C.A, Bv = C.Bv, N = C.N;
        const bpx = -sk * A[0] + ck * Bv[0], bpy = -sk * A[1] + ck * Bv[1], bpz = -sk * A[2] + ck * Bv[2];
        const tx = C.C[0] + fA * A[0] + fB * Bv[0] + rho * (u * bpx + v * N[0]);
        const ty = C.C[1] + fA * A[1] + fB * Bv[1] + rho * (u * bpy + v * N[1]);
        const tz = C.C[2] + fA * A[2] + fB * Bv[2] + rho * (u * bpz + v * N[2]);
        tipW = smooth(0, 0.15, sp) * S.armK; armSp = sp;
        x += (tx - x) * tipW; y += (ty - y) * tipW; z += (tz - z) * tipW;
      }
    }
    const h = y / HEIGHT;
    // living goo: slow lumps that drift over the body
    let off = S.lump * 1.6 * (1 - tipW) * (
      Math.sin(px * 2.3 + 1.1 + T * 0.7) * Math.sin(py * 2.1 + 0.4 - T * 0.5) * Math.sin(pz * 2.6 + 2.3 + T * 0.6)
      + 0.6 * Math.sin(px * 3.7 + 0.3 - T * 0.4) * Math.sin(pz * 3.1 + 1.7 + T * 0.55)
      + 0.4 * Math.sin(py * 3.3 + px * 1.3 + 1.3 + T * 0.8));
    const BL = S.bumps, LK = this.liveSizes();   // the recipe's lumps, breathing a little (sizes worked out once a frame)
    for (let i = 0; i < BL.length; i++) {
      const bd = BL[i][0]; if (BL[i][1] < 0.002) continue;
      const e = (1 - (px * bd[0] + py * bd[1] + pz * bd[2])) / BL[i][2];
      if (e < 9) off += LK.b[i] * Math.exp(-e);   // (further away a lump adds nothing you could see)
    }
    const KL = S.knobs;   // knobs: a round ball profile, or a pointed cat ear
    for (let i = 0; i < KL.length; i++) {
      const kd = KL[i][0]; if (KL[i][1] < 0.002) continue;
      const kr = KL[i][2], d = px * kd[0] + py * kd[1] + pz * kd[2];
      if (d <= LK.c[i]) continue;
      const q = Math.acos(clamp(d, -1, 1)) / kr;
      const f = KL[i][3] ? Math.pow(Math.max(0, 1 - Math.sqrt(q * q + 0.02)) / 0.8586, 1.25)   // pointed ear, softly rounded tip
                         : Math.pow(1 - q * q, 0.55);                                            // round knob
      off += LK.k[i] * f;
    }
    // a grown-up form's lumps (Geode, Moss)
    if (FS && FS.lumpy) off += FS.lumpy * 2.2 * Math.sin(px * 5.1 + 1.3) * Math.sin(py * 6.3 + 0.7) * Math.sin(pz * 5.7 + 2.1) * (1 - tipW);
    const W = this.wobble;
    if (W > 0.0005) off += W * (Math.sin(3 * az + T * 11) * 0.6 + Math.sin(py * 7 + T * 8.3) * 0.4);
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
      if (this.tipGrab > 0) {   // held by the curl: the tip follows the finger, the curl stretches like taffy
        if (armSp > 0) { const w = Math.pow(clamp(armSp / this.tipGrab, 0, 1), 1.3) * S.armK; x += pl.vec.x * w; y += pl.vec.y * w; z += pl.vec.z * w; }
      } else {
        const dot = px * pl.dir.x + py * pl.dir.y + pz * pl.dir.z;
        if (dot > 0.1) { const w = Math.exp(-(1 - dot) / 0.12) * Math.min(1, h * 3); x += pl.vec.x * w; y += pl.vec.y * w; z += pl.vec.z * w; }
      }
    }
    const sq = this.sq.x, hh2 = Math.min(1.6, h);
    const sxz = 1 - sq * 0.45 + Math.max(0, -sq) * 0.3 * (1 - hh2);
    y *= 1 + sq;
    x *= sxz; z *= sxz;
    const hh = hh2 * hh2;
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

  // Taffy pull: grab a spot and stretch it toward a target (local units). Grabbed by the curl (above its base), it is
  // the tip that follows the finger, and the curl boings back when let go.
  grab(worldPoint) {
    this.localDir(worldPoint, this.pull.dir);
    this.pull.active = true;
    this.pull.target.set(0, 0, 0);
    this.tipGrab = 0;
    const C = this.curl;
    if (!C || this.S.armK < 0.3) return;
    const lp = this.mesh.worldToLocal(this._v.copy(worldPoint));
    const pos = this.geo.attributes.position.array, b = this.base;
    let best = 1e9, bi = 0;
    for (let i = 0, j = 0; i < pos.length; i += 3, j++) {
      const dx = pos[i] - lp.x, dy = pos[i + 1] - lp.y, dz = pos[i + 2] - lp.z, dd = dx * dx + dy * dy + dz * dz;
      if (dd < best) { best = dd; bi = j; }
    }
    const c = b[bi * 3] * A0x + b[bi * 3 + 1] * A0y + b[bi * 3 + 2] * A0z;
    if (c > C.c0) { const sp = 1 - Math.pow(Math.acos(Math.min(1, c)) / C.th, 1.5); if (sp > 0.18) this.tipGrab = Math.max(0.3, sp); }
  }
  pullTo(localVec) { this.pull.target.copy(localVec); }
  release() {
    if (this.tipGrab) { this.dyn.vx += this.pull.vec.x * 18; this.dyn.vz += this.pull.vec.z * 18; }   // the curl boings back
    this.pull.active = false; this.pull.target.set(0, 0, 0);
  }

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
    for (const side of [-1, 1]) if (Math.hypot(x - (256 + side * f.cheekDX), y - f.cheekY) < 48) return side < 0 ? 'cheekL' : 'cheekR';
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
    this.mat.iridescence = Math.max(Math.min(1, (traits.prism || 0) / 25), (this.form && this.form.mat && this.form.mat.iridescence) || 0, this.pure ? PURE_IRIDESCENCE : 0);
    const iris = c.clone().lerp(new THREE.Color('#ffffff'), 0.35);
    this.expr.iris = `rgba(${Math.round(iris.r * 255)}, ${Math.round(iris.g * 255)}, ${Math.round(iris.b * 255)}, 0.95)`;
  }

  // ---------- queries ----------
  localToWorld(v) { return this.body.localToWorld(v); }
  // the real top of the body (the curl's top on a Curly, the dome or a knob on a Dollop), for hearts, notes and sparkles
  headTopWorld(out) {
    const i = this.topIdx, pos = this.geo.attributes.position.array;
    if (i >= 0 && i * 3 + 2 < pos.length) out.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    else this.shapeDir(this._v2.set(0, 1, 0), out);
    out.y += 0.12;
    return this.body.localToWorld(out);
  }
  mouthWorld(out) {
    this.shapeDir(this.mouthDir, out);
    out.z += 0.05;
    return this.body.localToWorld(out);
  }
  faceWorld(out) { this.shapeDir(this.faceCenterDir, out); return this.body.localToWorld(out); }
  centerWorld(out) { out.set(0, CENTER_Y * (1 + this.sq.x), 0); return this.body.localToWorld(out); }
  // touch the real body (and the baby's feet): the curl, ears and knobs count too
  hit(raycaster) {
    if (!this.visible) return null;
    const list = this._hitList;
    list.length = 0; list.push(this.mesh);
    for (const f of this.feet) if (f.visible) list.push(f);
    const hits = raycaster.intersectObjects(list, false);
    return hits.length ? hits[0] : null;
  }

  // the body this frame: every point of the recipe body with all the physics (and the highest point, for headTopWorld)
  deform() {
    const pos = this.geo.attributes.position.array;
    const b = this.base, az = this.baseAz, o = this._o;
    let top = -1e9, ti = -1;
    for (let i = 0, j = 0; i < b.length; i += 3, j++) {
      this.shape(b[i], b[i + 1], b[i + 2], az[j], o, true);
      pos[i] = o.x; pos[i + 1] = o.y; pos[i + 2] = o.z;
      if (o.y > top) { top = o.y; ti = j; }
    }
    this.topIdx = ti;
    this.geo.attributes.position.needsUpdate = true;
    bodyNormals(this.geo);
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
    this.turnYaw += (this.turnTarget - this.turnYaw) * (1 - Math.exp(-dt * this.turnRate));
    this.root.rotation.y = this.yaw + spinAdd + this.turnYaw;
    this.body.rotation.z = this.roll.x;

    const s = this.size;
    this.body.scale.setScalar(s);
    this.body.position.y = this.hopY;

    // the recipe body: growth and breed mix ease along; the curl sways like a lagging spring behind the lean
    this.updateRecipe(dt);
    if (this.tipGrab && !pl.active && (pl.amt || 0) < 0.003) this.tipGrab = 0;
    const dyn = this.dyn;
    dyn.vx += (-(dyn.sx - (-this.leanX.x * 2.4)) * 55 - dyn.vx * 4.5) * dt; dyn.sx += dyn.vx * dt;
    dyn.vz += (-(dyn.sz - (-this.leanZ.x * 2.4)) * 55 - dyn.vz * 4.5) * dt; dyn.sz += dyn.vz * dt;
    this.frameCurl();

    // color + glow
    this.color.lerp(this.targetColor, 1 - Math.exp(-dt * 1.4));
    const shown = this._c.copy(this.colorOverride || this.color);
    const look = this.form;
    if (look && look.tint && !this.colorOverride) shown.lerp(this._lookTint || (this._lookTint = new THREE.Color()), 0).lerp(this._lookTint.set(look.tint), look.tintAmt || 0.5);
    if (this.pure && !this.colorOverride) {
      // Pure: richer, brighter colors
      shown.getHSL(this._hsl, THREE.SRGBColorSpace);
      shown.setHSL(this._hsl.h, Math.min(1, this._hsl.s * 1.2 + 0.06), Math.min(0.86, this._hsl.l + 0.05), THREE.SRGBColorSpace);
    }
    if (this.tintAmt > 0.002 && !this.colorOverride) shown.lerp(this.tint, this.tintAmt);
    // the jelly skin: a Dollop's gummy body is a little deeper in color; the rim light and the low glow are lighter
    // versions of the body's own color (so a diet color never gets a foreign glow)
    shown.getHSL(this._hsl, THREE.SRGBColorSpace);
    if (this.mk > 0.001 && !this.colorOverride) { this._hsl.l = Math.max(0.2, this._hsl.l - 0.09 * this.mk); shown.setHSL(this._hsl.h, this._hsl.s, this._hsl.l, THREE.SRGBColorSpace); }
    const JU = this.jellyU, sat = Math.min(1, this._hsl.s * 1.1 + 0.1);
    JU.uLow.value.setHSL(this._hsl.h, sat, 0.78, THREE.SRGBColorSpace);
    JU.uRim.value.setHSL(this._hsl.h, sat, 0.87, THREE.SRGBColorSpace);
    JU.uTime.value = t; JU.uMk.value = this.mk; JU.uWet.value = this.wet ? 1 : 0; JU.uRip.value = this.ripple ? 1 : 0;
    const live = JELLY.live(this.mk, this.wet ? 1 : 0), locked = this.lockedMat;
    for (const k in live) {
      if (locked && locked.has(k)) continue;
      if (k === 'transmission' && this.quality === 'low') continue;
      this.mat[k] = live[k];
    }
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
    else this.mat.emissive.copy(shown).multiplyScalar(0.1 + heatGlow + this.glow * 0.7 + this.emissiveBoost + (look && look.glow || 0) + (this.pure ? 0.06 : 0));
    // (Pure: a warm golden sheen along the edges)
    if (this.pure) this.mat.sheenColor.copy(shown).lerp(this._c2.set(PURE_SHEEN), 0.8);
    else this.mat.sheenColor.copy(shown).lerp(this._c2.setRGB(1, 1, 1), 0.6);
    // Pure: a soft shimmer that slowly drifts over the body
    if (this.pure) this.mat.iridescenceThicknessRange[1] = 420 + 180 * Math.sin(t * 0.7);

    // deform body (every lod-th frame)
    this._reshaped = ++this._lodN % this.lod === 0;
    if (this._reshaped) this.deform();
    const o = this._o;
    // the baby's feet (they tuck in as it grows) and the bubbles inside, riding the body
    const sqx = this.sq.x, fk = this.S.feet;
    for (const f of this.feet) {
      f.visible = fk > 0.02;
      if (!f.visible) continue;
      const fd = f.userData.d; this.shape(fd[0], fd[1], fd[2], Math.atan2(fd[2], fd[0]), o);
      f.position.set(o.x * 1.02, 0.1 * fk * (1 + sqx * 0.5), o.z * 1.04 + 0.04);
      f.scale.set(0.2 * fk * (1 - sqx * 0.4), 0.13 * fk * (1 + sqx * 0.6), 0.22 * fk);
    }
    this.fizz.visible = this.inner.visible && this.lod === 1;   // (ranch residents far from the camera skip their bubbles)
    if (this.fizz.visible) {
      const cy = CENTER_Y * (1 + sqx);
      for (const bb of this.bubbles) {
        const u = bb.userData, d = u.d;
        const bx = d[0] + Math.sin(t * 0.3 + u.ph) * 0.06, by = d[1] + Math.sin(t * 0.22 + u.ph) * 0.08, bl = Math.hypot(bx, by, d[2]) || 1;
        this.shape(bx / bl, by / bl, d[2] / bl, Math.atan2(d[2] / bl, bx / bl), o);
        bb.position.set(o.x * 0.84, cy + (o.y - cy) * 0.84, o.z * 0.84);
        bb.scale.setScalar(u.r * 2);
      }
    }


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
    this.placePin();
    const hatOn = !!this.outfit.head || this.cap.grow > 0.3;
    // head props hide under hats, except on spark forms (headKeep): there the hat sits on top
    const keepHead = !!(this.form && this.form.headKeep);
    for (const p of this.formProps) {
      if (p.head && !keepHead) { p.obj.visible = !hatOn; if (hatOn) continue; }
      if (p.ring !== undefined) {
        this.shape(0, p.ring, 0, 0, o);
        const cx = o.x, cy = o.y, cz = o.z;
        this.shape(Math.sqrt(1 - p.ring * p.ring), p.ring, 0, 0, o);
        const r = Math.abs(o.x - cx);
        p.obj.position.set(cx, cy, cz);
        p.obj.scale.set(r, r * (1 + this.sq.x), r);
      }
      p.update && p.update(t, hatOn);
    }
    if (this.pureFx) {
      const gl = this.pureFx.glow;
      gl.scale.set(2.75 * (1 - this.sq.x * 0.3), 2.75 * HEIGHT / 2 * (1 + this.sq.x) + 0.6, 1);
      gl.position.y = CENTER_Y * (1 + this.sq.x);
      gl.material.opacity = 0.42 + 0.1 * Math.sin(t * 1.6);
      for (const it of this.pureFx.items) {
        const a = it.az + t * 0.18, ce = Math.cos(it.el);
        const dx = Math.sin(a) * ce, dy = Math.sin(it.el), dz = Math.cos(a) * ce;
        this.shape(dx, dy, dz, Math.atan2(dz, dx), o);
        const ny = o.y - CENTER_Y * (1 + this.sq.x);
        const len = Math.sqrt(o.x * o.x + ny * ny + o.z * o.z) || 1;
        it.sp.position.set(o.x + o.x / len * 0.1, o.y + ny / len * 0.1, o.z + o.z / len * 0.1);
        // twinkle; stay off the face, and fade out round the back
        const onFace = dz > 0.6 && it.el < 0.6 && it.el > -0.3;
        const show = onFace ? 0 : smooth(-0.45, -0.1, dz);
        const k = (0.5 + 0.5 * Math.sin(t * 1.5 + it.ph)) ** 2;
        it.sp.material.opacity = show * (0.5 + 0.5 * k);
        it.sp.scale.setScalar(0.26 + 0.26 * k);
        it.sp.material.rotation = t * 0.6 + it.ph;
      }
    }

    // nightcap
    const cap = this.cap;
    cap.grow += ((cap.on ? 1 : 0) - cap.grow) * (1 - Math.exp(-dt * 6));
    cap.obj.visible = cap.grow > 0.02;
    if (cap.obj.visible) {
      this.shape(cap.dir.x, cap.dir.y, cap.dir.z, Math.atan2(cap.dir.z, cap.dir.x), o);
      cap.obj.position.set(o.x, o.y - 0.06 + (this.form && this.form.hatLift || 0), o.z);
      cap.obj.rotation.set(-0.15, 0.4, -0.25 + Math.sin(t * 1.3) * 0.04);
      const pop = cap.grow * (1 + Math.sin(cap.grow * Math.PI) * 0.15);
      cap.obj.scale.setScalar(pop);
    }

    // shadow
    const sh = s * 2.25 * (1 - this.sq.x * 0.35) / (1 + this.hopY * 0.8);
    this.shadow.scale.set(sh, sh * 0.92, 1);
    this.shadow.material.opacity = 0.9 / (1 + this.hopY * 2) * this.shadowFade;
  }
}
