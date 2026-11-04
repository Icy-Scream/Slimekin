// Grown-up form looks. When a slime settles, its form adds a signature look on top of the
// diet-based color: a body shape, a surface pattern, something inside it, small props and effects.
// Following the design doc, each form leans on 2-3 strong motifs instead of every trait at once.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;

// ---------- surface patterns (equirectangular canvas textures) ----------
function canvasTex(draw, w = 512, h = 256) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

const PATTERNS = {
  candy: () => canvasTex((x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ff6fa3';
    for (let i = -8; i < 16; i++) {
      const x0 = i * 64;
      x.beginPath();
      x.moveTo(x0, h); x.lineTo(x0 + 28, h); x.lineTo(x0 + 28 + h * 0.9, 0); x.lineTo(x0 + h * 0.9, 0);
      x.fill();
    }
  }),
  zigzag: () => canvasTex((x, w, h) => {
    x.fillStyle = '#000000'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#ffffff'; x.lineWidth = 7; x.lineJoin = 'miter';
    for (const row of [0.38, 0.55, 0.72]) {
      x.beginPath();
      for (let i = 0; i <= 16; i++) x.lineTo(i * w / 16, h * row + (i % 2 ? -12 : 12));
      x.stroke();
    }
  }),
  toast: () => canvasTex((x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, 0, 0, h * 0.5);
    g.addColorStop(0, '#a8662f'); g.addColorStop(0.3, '#c98a4c'); g.addColorStop(0.62, '#ecc28e'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h * 0.5);
    x.fillStyle = 'rgba(140, 80, 36, 0.35)';
    for (let i = 0; i < 120; i++) { x.beginPath(); x.arc(Math.random() * w, Math.random() * h * 0.32, 1 + Math.random() * 3, 0, TAU); x.fill(); }
  }),
  aurora: () => canvasTex((x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    const hues = ['#ff94c8', '#ffd97a', '#8ff0bd', '#86c8ff', '#c3a2ff', '#ff94c8', '#ffd97a', '#8ff0bd', '#86c8ff', '#c3a2ff', '#ff94c8'];
    hues.forEach((c, i) => g.addColorStop(i / (hues.length - 1), c));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const v = x.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(255,255,255,0.35)'); v.addColorStop(0.5, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(255,255,255,0.3)');
    x.fillStyle = v; x.fillRect(0, 0, w, h);
  }),
  // Rising flame tongues over a red-orange body (full color, mapWhite 1).
  flames: () => canvasTex((x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e8262e'); g.addColorStop(0.55, '#ff5a2a'); g.addColorStop(1, '#ff8a2a');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (const [col, top, n] of [['#ff9a1f', 0.22, 8], ['#ffe14d', 0.48, 11]]) {
      x.fillStyle = col;
      x.beginPath(); x.moveTo(0, h);
      for (let i = 0; i <= n; i++) {
        const cx = i / n * w, tip = h * (top + 0.12 * Math.sin(i * 2.7));
        x.quadraticCurveTo(cx - w / n * 0.5, h * 0.9, cx, tip);
        x.quadraticCurveTo(cx + w / n * 0.1, h * 0.85, cx + w / n * 0.5, h * 0.95);
      }
      x.lineTo(w, h); x.closePath(); x.fill();
    }
  }),
  // Riveted metal plates (multiplies the body color).
  plates: () => canvasTex((x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(70, 82, 105, 0.55)'; x.lineWidth = 3;
    for (const y of [0.3, 0.62]) { x.beginPath(); x.moveTo(0, h * y); x.lineTo(w, h * y); x.stroke(); }
    for (let i = 0; i < 8; i++) { const cx = (i + 0.5) * w / 8; x.beginPath(); x.moveTo(cx, h * 0.3); x.lineTo(cx, h * 0.62); x.stroke(); }
    for (const y of [0.33, 0.59]) for (let i = 0; i < 32; i++) {
      const cx = (i + 0.5) * w / 32;
      x.fillStyle = 'rgba(60, 70, 92, 0.6)'; x.beginPath(); x.arc(cx, h * y, 3.4, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(cx - 1, h * y - 1, 1.3, 0, TAU); x.fill();
    }
  }),
  // Soft mossy speckles (multiplies the body color).
  speckle: () => canvasTex((x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      x.fillStyle = Math.random() < 0.5 ? 'rgba(40, 90, 30, 0.18)' : 'rgba(255, 255, 210, 0.35)';
      x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, TAU); x.fill();
    }
  }),
  // Gold and white stars on cherry red (full color).
  stars: () => canvasTex((x, w, h) => {
    x.fillStyle = '#e8435f'; x.fillRect(0, 0, w, h);
    const star = (cx, cy, r, col) => {
      x.fillStyle = col; x.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      x.closePath(); x.fill();
    };
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) star(rnd() * w, h * (0.08 + rnd() * 0.84), 6 + rnd() * 9, i % 3 ? '#ffd75a' : '#ffffff');
  }),
  // Caramel drizzle over the top (multiplies the body color).
  drizzle: () => canvasTex((x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(110, 56, 20, 0.8)';
    x.fillRect(0, 0, w, h * 0.12);
    x.beginPath(); x.moveTo(0, h * 0.12);
    for (let i = 0; i <= 16; i++) {
      const cx = i / 16 * w, len = h * (0.04 + ((i * 7) % 5) * 0.03);
      x.lineTo(cx - w / 64, h * 0.12); x.quadraticCurveTo(cx - w / 64, h * 0.12 + len, cx, h * 0.12 + len); x.quadraticCurveTo(cx + w / 64, h * 0.12 + len, cx + w / 64, h * 0.12);
    }
    x.lineTo(w, h * 0.12); x.lineTo(w, 0); x.lineTo(0, 0); x.fill();
    x.strokeStyle = 'rgba(110, 56, 20, 0.55)'; x.lineWidth = 5; x.lineCap = 'round';
    x.beginPath();
    for (let i = 0; i <= 64; i++) x.lineTo(i / 64 * w, h * 0.3 + Math.sin(i * 0.6) * 9);
    x.stroke();
  }),
  // Glowing cracks (emissive map: white on black).
  cracks: () => canvasTex((x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 16; k++) {
      let px = (k + rnd()) * w / 16, py = h * (0.15 + rnd() * 0.6);
      x.lineWidth = 5;
      x.beginPath(); x.moveTo(px, py);
      for (let s = 0; s < 7; s++) { px += (rnd() - 0.5) * 50; py += (rnd() - 0.4) * 30; x.lineTo(px, py); if (s === 3) x.lineWidth = 2.5; }
      x.stroke();
    }
  }),
  // Soft glowing spots (emissive map).
  spots: () => canvasTex((x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 34; i++) {
      const cx = rnd() * w, cy = h * (0.3 + rnd() * 0.6), r = 9 + rnd() * 12;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
    }
  }),
  // Circuit-board lines (emissive map).
  circuit: () => canvasTex((x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 3;
    let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 22; k++) {
      let px = Math.round(rnd() * 32) * w / 32, py = Math.round((0.2 + rnd() * 0.65) * 16) * h / 16;
      x.beginPath(); x.moveTo(px, py);
      for (let s = 0; s < 3; s++) { if (s % 2) py += (rnd() < 0.5 ? -1 : 1) * h / 16 * (1 + Math.floor(rnd() * 2)); else px += w / 32 * (1 + Math.floor(rnd() * 3)); x.lineTo(px, py); }
      x.stroke();
      x.beginPath(); x.arc(px, py, 4.5, 0, TAU); x.fill();
    }
  }),
};

// ---------- all 22 grown-up forms ----------
export const FORM_LOOKS = {
  'heat+sweet': {
    title: 'Hearth Slime', tint: '#ff9a62', tintAmt: 0.6, shape: { tall: 0.96, wide: 1.04 }, glow: 0.05,
    keep: ['heat'], props: ['heartCore'], fx: { kind: 'steam', every: 2.4 },
  },
  'mineral+prism': {
    title: 'Geode Slime', tint: '#9a86c8', tintAmt: 0.7, shape: { lumpy: 0.05, tall: 0.92 },
    mat: { roughness: 0.42 }, keep: [], props: ['geodeCrystals'], fx: { kind: 'glints', every: 1.1 },
  },
  'prism+spark': {
    title: 'Aurora Slime', pattern: 'aurora', mapWhite: 0.8, mapScroll: 0.025, shape: { tall: 1.05 },
    mat: { iridescence: 1 }, keep: [], fx: { kind: 'glints', every: 0.45 },
  },
  'nature+sweet': {
    title: 'Nectar Slime', tint: '#ffb0c4', tintAmt: 0.78, keep: [], props: ['blossom', 'bee'], fx: { kind: 'pollen', every: 0.8 },
  },
  'mineral+nature': {
    title: 'Root Slime', tint: '#93ba62', tintAmt: 0.5, shape: { wide: 1.08, tall: 0.86 }, mat: { roughness: 0.3 },
    keep: ['nature'], props: ['roots', 'moss', 'mushroom'],
  },
  sweet: {
    title: 'Candy Slime', pattern: 'candy', mapWhite: 0.7, tint: '#ffd3e6', tintAmt: 0.6, mat: { roughness: 0.06 }, keep: ['sweet'],
  },
  spark: {
    title: 'Volt Slime', tint: '#ffe45c', tintAmt: 0.55, glowPattern: 'zigzag', glowColor: '#fff4a8', keep: [], props: ['voltHair'],
    fx: { kind: 'sparks', every: 0.9 },
  },
  mochi: {
    title: 'Marshmallow Slime', tint: '#fff5ea', tintAmt: 0.9, pattern: 'toast', mapWhite: 1, shape: { square: 0.85, tall: 0.95, wide: 1.0 },
    mat: { transmission: 0.1, roughness: 0.6, sheen: 1, clearcoat: 0.25 }, keep: [],
  },
  heat: {
    title: 'Blaze Slime', tint: '#ff6a3d', tintAmt: 0.6, pattern: 'flames', mapWhite: 1, glow: 0.1, shape: { tall: 1.04 },
    keep: [], props: ['flameCrown'], fx: { kind: 'embers', every: 0.5 },
  },
  mineral: {
    title: 'Iron Slime', tint: '#8f9db4', tintAmt: 0.75, pattern: 'plates', mapWhite: 0, shape: { square: 0.45, tall: 0.9 },
    mat: { metalness: 0.5, roughness: 0.3, transmission: 0.15 }, keep: ['mineral'], fx: { kind: 'glints', every: 1.6, color: '#e6eeff' },
  },
  nature: {
    title: 'Moss Slime', tint: '#62b04f', tintAmt: 0.6, pattern: 'speckle', mapWhite: 0, shape: { lumpy: 0.022, wide: 1.03 },
    mat: { roughness: 0.5, sheen: 1 }, keep: ['nature'], props: ['moss', 'ladybug'], fx: { kind: 'pollen', every: 1.2, color: '#d8f5a0' },
  },
  prism: {
    title: 'Crystal Slime', tint: '#a9dcff', tintAmt: 0.62, mat: { transmission: 0.95, roughness: 0.02, iridescence: 1, thickness: 0.7 },
    keep: ['prism'], props: ['crystalCrown', 'prismCore'], fx: { kind: 'prism', every: 0.9 },
  },
  'heat+mineral': {
    title: 'Furnace Slime', tint: '#5d4c4a', tintAmt: 0.8, glowPattern: 'cracks', glowColor: '#ff7a2a', glowMode: 'pulse', glowSpeed: 1.6,
    shape: { square: 0.3, tall: 0.92 }, mat: { roughness: 0.5, metalness: 0.25, transmission: 0.1 }, keep: [], props: ['chimney'],
    fx: { kind: 'smoke', every: 0.9 },
  },
  'heat+spark': {
    title: 'Firework Slime', tint: '#e8435f', tintAmt: 0.6, pattern: 'stars', mapWhite: 1, keep: [], props: ['fuse'],
    fx: { kind: 'firework', every: 0.22 },
  },
  'spark+sweet': {
    title: 'Fizzy Slime', tint: '#ff8fc4', tintAmt: 0.6, mat: { transmission: 0.85, roughness: 0.05 }, keep: [], props: ['innerBubbles', 'straw'],
    fx: { kind: 'fizz', every: 0.35 },
  },
  'nature+spark': {
    title: 'Firefly Slime', tint: '#24685e', tintAmt: 0.85, glowPattern: 'spots', glowColor: '#d8ff6a', glowMode: 'pulse', glowSpeed: 1.1,
    keep: ['nature'], props: ['fireflies'],
  },
  'heat+nature': {
    title: 'Sunbloom Slime', tint: '#ffc93c', tintAmt: 0.62, keep: [], props: ['sunflower', 'leafSkirt'], fx: { kind: 'pollen', every: 0.9 },
  },
  'mineral+spark': {
    title: 'Dynamo Slime', tint: '#7f8fa8', tintAmt: 0.7, glowPattern: 'circuit', glowColor: '#7af3ff', glowMode: 'pulse', glowSpeed: 2.4,
    shape: { square: 0.25 }, mat: { metalness: 0.35, roughness: 0.25, transmission: 0.2 }, keep: [], props: ['windupKey'],
    fx: { kind: 'sparks', every: 1.4, color: '#9ff6ff' },
  },
  'prism+sweet': {
    title: 'Sugarglass Slime', tint: '#ff9fd2', tintAmt: 0.55, mat: { transmission: 0.92, roughness: 0.03, iridescence: 0.7 },
    keep: ['sweet'], props: ['gumdrops'], fx: { kind: 'glints', every: 0.8, color: '#ffd1ec' },
  },
  'heat+prism': {
    title: 'Sunstone Slime', tint: '#ffb03a', tintAmt: 0.66, glow: 0.12, mat: { iridescence: 0.5, roughness: 0.08 },
    keep: [], props: ['sunHalo', 'sunCore'], fx: { kind: 'glints', every: 0.7, color: '#ffe08a' },
  },
  'nature+prism': {
    title: 'Dewdrop Slime', tint: '#8fe3e6', tintAmt: 0.6, shape: { peak: 0.55, tall: 1.06 }, mat: { transmission: 0.92, roughness: 0.02 },
    keep: [], props: ['dewLeaf', 'droplets'], fx: { kind: 'glints', every: 1.0, color: '#e8ffff' },
  },
  'mineral+sweet': {
    title: 'Toffee Guardian', tint: '#d68f48', tintAmt: 0.82, pattern: 'drizzle', mapWhite: 0, mat: { roughness: 0.1, transmission: 0.3 },
    keep: ['mineral'], props: ['helmet'],
  },
};

// ---------- props ----------
const overlay = (mat, opacity = 0.9) => { mat.transparent = true; mat.opacity = opacity; mat.depthTest = false; mat.depthWrite = false; return mat; };
const softTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.42);
  s.bezierCurveTo(-0.95, 0.1, -0.45, 0.85, 0, 0.32);
  s.bezierCurveTo(0.45, 0.85, 0.95, 0.1, 0, -0.42);
  return s;
}

// Sit a prop on the body surface along a direction, leaning out with the surface.
function surfacePlacer(av) {
  const o = { x: 0, y: 0, z: 0 };
  const up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3();
  return (obj, dir, sink = 0, lean = 1) => {
    av.shape(dir.x, dir.y, dir.z, Math.atan2(dir.z, dir.x), o);
    n.set(o.x, o.y - 0.55, o.z).normalize();
    if (lean < 1) n.lerp(up, 1 - lean).normalize();
    obj.position.set(o.x - n.x * sink, o.y - n.y * sink, o.z - n.z * sink);
    obj.quaternion.setFromUnitVectors(up, n);
  };
}

function crystalPoint(r, h, mat) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 6), mat);
  shaft.position.y = h / 2;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.7, 6), mat);
  tip.position.y = h + r * 0.85;
  g.add(shaft, tip);
  return g;
}

function boltShape() {
  const s = new THREE.Shape();
  const pts = [[0.05, 1], [-0.32, 0.18], [-0.04, 0.18], [-0.22, -0.62], [0.34, 0.32], [0.06, 0.32], [0.3, 1]];
  s.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
  s.closePath();
  return s;
}

export const PROP_MAKERS = {
  // A warm heart glowing deep inside the jelly, beating slowly, over a soft ember glow.
  heartCore(av) {
    const g = new THREE.Group();
    const geo = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.18, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 4, curveSegments: 20 });
    geo.center();
    const m = new THREE.Mesh(geo, overlay(new THREE.MeshStandardMaterial({ color: '#ff8a6e', emissive: '#ff5a3c', emissiveIntensity: 0.8, roughness: 0.35 }), 0.78));
    m.renderOrder = 1.46;
    const glow = new THREE.Sprite(overlay(new THREE.SpriteMaterial({ map: softTex(), color: '#ffb27a', blending: THREE.AdditiveBlending }), 0.5));
    glow.renderOrder = 1.44;
    glow.scale.setScalar(1.1);
    const ember = new THREE.Sprite(overlay(new THREE.SpriteMaterial({ map: softTex(), color: '#ff9a52', blending: THREE.AdditiveBlending }), 0.22));
    ember.renderOrder = 1.43;
    ember.scale.set(2.6, 1.6, 1);
    ember.position.set(0, -0.6, 0);
    g.add(ember, glow, m);
    g.position.set(0, 0.98, -0.15);
    av.inner.add(g);
    return {
      obj: g,
      update(t) {
        const p = t % 1.3;
        const beat = Math.exp(-p * p / 0.004) + 0.6 * Math.exp(-((p - 0.2) ** 2) / 0.004);
        m.scale.setScalar(0.24 * (1 + 0.14 * beat));
        m.rotation.y = Math.sin(t * 0.6) * 0.35;
        glow.material.opacity = 0.22 + 0.3 * beat;
        ember.material.opacity = 0.1 + 0.06 * beat;
      },
    };
  },

  // Amethyst clusters growing out of a rocky body, with a faint purple light inside.
  geodeCrystals(av) {
    const g = new THREE.Group();
    const mats = [
      new THREE.MeshStandardMaterial({ color: '#b48cff', emissive: '#6a3dff', emissiveIntensity: 0.25, roughness: 0.15, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#dcc8ff', emissive: '#8a62ff', emissiveIntensity: 0.2, roughness: 0.1, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#8e66f0', emissive: '#5a2fd6', emissiveIntensity: 0.3, roughness: 0.15, flatShading: true }),
    ];
    const clusters = [];
    const spots = [[-0.5, 0.82, -0.25, 1.1], [0.86, 0.42, 0.05, 0.85], [0.25, 0.62, -0.75, 0.9], [-0.86, 0.22, 0.42, 0.6]];
    for (const [x, y, z, size] of spots) {
      const c = new THREE.Group();
      const n = 4 + Math.round(size * 2);
      for (let i = 0; i < n; i++) {
        const big = i === 0;
        const pt = crystalPoint((big ? 0.075 : 0.045 + (i % 3) * 0.012) * size, (big ? 0.3 : 0.12 + (i % 4) * 0.05) * size, mats[i % 3]);
        const a = i / n * TAU;
        pt.position.set(big ? 0 : Math.cos(a) * 0.07 * size, 0, big ? 0 : Math.sin(a) * 0.07 * size);
        pt.rotation.set(big ? 0 : Math.sin(a) * 0.55, 0, big ? 0 : -Math.cos(a) * 0.55);
        c.add(pt);
      }
      g.add(c);
      clusters.push({ c, dir: new THREE.Vector3(x, y, z).normalize() });
    }
    const glow = new THREE.Sprite(overlay(new THREE.SpriteMaterial({ map: softTex(), color: '#b28cff', blending: THREE.AdditiveBlending }), 0.25));
    glow.renderOrder = 1.43;
    glow.scale.set(2.2, 1.5, 1);
    glow.position.set(0, 0.55, 0);
    av.inner.add(glow);
    av.body.add(g);
    const place = surfacePlacer(av);
    return {
      obj: g,
      extra: [glow],
      update(t) {
        for (const k of clusters) place(k.c, k.dir, 0.06);
        glow.material.opacity = 0.2 + 0.06 * Math.sin(t * 1.3);
      },
    };
  },

  // A big blossom on the head.
  blossom(av) {
    const g = new THREE.Group();
    const flower = new THREE.Group();
    const pink = new THREE.MeshStandardMaterial({ color: '#ff8fbd', roughness: 0.5 });
    const pale = new THREE.MeshStandardMaterial({ color: '#ffc4dc', roughness: 0.5 });
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), i % 2 ? pale : pink);
      p.scale.set(0.75, 0.22, 1);
      p.position.set(Math.sin(a) * 0.15, 0.02, Math.cos(a) * 0.15);
      p.rotation.y = a;
      p.rotation.x = -0.25;
      flower.add(p);
    }
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.8, emissive: '#ffb000', emissiveIntensity: 0.15 }));
    mid.scale.y = 0.6; mid.position.y = 0.05;
    flower.add(mid);
    flower.scale.setScalar(1.7);
    flower.rotation.x = 0.55;
    g.add(flower);
    av.body.add(g);
    const place = surfacePlacer(av);
    const dir = new THREE.Vector3(0.42, 0.9, 0.12).normalize();
    return {
      obj: g, head: true,
      update(t) {
        place(g, dir, 0.02, 0.6);
        flower.rotation.y = Math.sin(t * 0.7) * 0.15;
      },
    };
  },

  // A tiny bee friend that buzzes around the head.
  bee(av) {
    const g = new THREE.Group();
    const bee = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffcf33', roughness: 0.5 }));
    body.scale.set(1, 0.9, 1.25);
    bee.add(body);
    const black = new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.7 });
    for (const z of [-0.03, 0.035]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.014, 6, 20), black);
      band.position.z = z; band.scale.set(1, 0.92, 1);
      bee.add(band);
    }
    for (const x of [-0.035, 0.035]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), black);
      eye.position.set(x, 0.025, 0.105);
      bee.add(eye);
    }
    const wingMat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, roughness: 0.2 });
    const wings = [];
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), wingMat);
      w.scale.set(1, 0.15, 0.6);
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.03, 0.07, -0.01);
      w.position.x = side * 0.055;
      pivot.add(w);
      bee.add(pivot);
      wings.push({ pivot, side });
    }
    g.add(bee);
    av.body.add(g);
    const prev = new THREE.Vector3();
    return {
      obj: g,
      update(t) {
        const a = t * 0.9;
        prev.copy(bee.position);
        bee.position.set(Math.cos(a) * 1.2, 1.22 + Math.sin(t * 2.3) * 0.1 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.85 + 0.15);
        bee.rotation.y = Math.atan2(bee.position.x - prev.x, bee.position.z - prev.z) || 0;
        for (const w of wings) w.pivot.rotation.z = w.side * (0.4 + Math.sin(t * 60) * 0.5);
      },
    };
  },

  // Little root feet peeking out under the body.
  roots(av) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#7d5236', roughness: 0.85 });
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + 0.5;
      const r1 = 1.12 + (i % 3) * 0.07;
      const bend = (i % 2 ? 1 : -1) * 0.3;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.8, 0.12, Math.sin(a) * 0.8),
        new THREE.Vector3(Math.cos(a) * 0.98, 0.03, Math.sin(a) * 0.98),
        new THREE.Vector3(Math.cos(a + bend) * r1, 0.0, Math.sin(a + bend) * r1),
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.07, 8, false), mat);
      const geo = tube.geometry, pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const seg = Math.floor(k / 9) / 14;
        const p = curve.getPointAt(Math.min(1, seg));
        const taper = 1 - seg * 0.8;
        pos.setXYZ(k, p.x + (pos.getX(k) - p.x) * taper, p.y + (pos.getY(k) - p.y) * taper, p.z + (pos.getZ(k) - p.z) * taper);
      }
      geo.computeVertexNormals();
      g.add(tube);
    }
    av.body.add(g);
    return { obj: g, update() {} };
  },

  // Soft moss patches on the upper body.
  moss(av) {
    const g = new THREE.Group();
    const cols = ['#5e9e3c', '#86c75c', '#477f30'];
    const spots = [];
    const dirs = [[-0.75, 0.6, -0.1], [0.7, 0.55, -0.35], [0.1, 0.75, -0.65], [-0.35, 0.45, -0.85], [0.9, 0.2, 0.3], [-0.9, 0.15, 0.35], [0.35, 0.95, 0.0]];
    for (const [x, y, z] of dirs) {
      const patch = new THREE.Group();
      for (let k = 0; k < 9; k++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.055 + (k % 3) * 0.015, 8, 6), new THREE.MeshStandardMaterial({ color: cols[k % 3], roughness: 1 }));
        const a = k * 2.4, r = 0.03 + (k / 9) * 0.13;
        b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        b.scale.y = 0.55;
        patch.add(b);
      }
      g.add(patch);
      spots.push({ patch, dir: new THREE.Vector3(x, y, z).normalize() });
    }
    av.body.add(g);
    const place = surfacePlacer(av);
    return { obj: g, update() { for (const sp of spots) place(sp.patch, sp.dir, 0.02); } };
  },

  // A red spotted mushroom growing on the side of the head.
  mushroom(av) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.16, 12), new THREE.MeshStandardMaterial({ color: '#fff4e2', roughness: 0.8 }));
    stem.position.y = 0.08;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ff5a4f', roughness: 0.45 }));
    cap.scale.y = 0.75; cap.position.y = 0.14;
    g.add(stem, cap);
    const dot = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
    for (let i = 0; i < 6; i++) {
      const a = i * 2.3, el = 0.35 + (i % 3) * 0.3;
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), dot);
      d.position.set(Math.cos(a) * Math.cos(el) * 0.14, 0.14 + Math.sin(el) * 0.105, Math.sin(a) * Math.cos(el) * 0.14);
      d.scale.y = 0.5;
      g.add(d);
    }
    av.body.add(g);
    const place = surfacePlacer(av);
    const dir = new THREE.Vector3(-0.62, 0.75, 0.15).normalize();
    return { obj: g, head: true, update(t) { place(g, dir, 0.02, 0.5); g.rotation.z += Math.sin(t * 1.4) * 0.03; } };
  },

  // Crackling lightning-bolt hair.
  voltHair(av) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#fff3a0', emissive: '#ffcc00', emissiveIntensity: 1, roughness: 0.3 });
    const geo = new THREE.ExtrudeGeometry(boltShape(), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    geo.translate(0, 0.62, -0.06);
    const bolts = [];
    for (const [dx, lean, sc] of [[-0.24, -0.45, 0.22], [0, 0.0, 0.3], [0.24, 0.45, 0.22]]) {
      const b = new THREE.Mesh(geo, mat);
      b.scale.setScalar(sc);
      b.userData = { dx, lean };
      g.add(b);
      bolts.push(b);
    }
    av.body.add(g);
    const o = { x: 0, y: 0, z: 0 };
    return {
      obj: g, head: true,
      update(t) {
        av.shape(0, 1, 0.05, 0, o);
        g.position.set(o.x, o.y - 0.08, o.z);
        for (const b of bolts) { b.position.x = b.userData.dx; b.rotation.z = -b.userData.lean + Math.sin(t * 9 + b.userData.dx * 10) * 0.05; }
        mat.emissiveIntensity = 0.7 + Math.random() * 0.5;
      },
    };
  },

  // A faceted rainbow gem turning slowly inside.
  prismCore(av) {
    const g = new THREE.Group();
    const geo = new THREE.OctahedronGeometry(0.2, 0);
    const cols = ['#ff9ad5', '#ffe17a', '#8ff0c0', '#8cc8ff', '#c7a6ff'];
    const pos = geo.attributes.position, colors = [];
    for (let i = 0; i < pos.count; i++) { const c = new THREE.Color(cols[Math.floor(i / 3) % cols.length]); colors.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const gem = new THREE.Mesh(geo, overlay(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.2, emissive: '#ffffff', emissiveIntensity: 0.15, flatShading: true }), 0.75));
    gem.scale.set(1, 1.5, 1);
    gem.renderOrder = 1.46;
    const glow = new THREE.Sprite(overlay(new THREE.SpriteMaterial({ map: softTex(), color: '#dff2ff', blending: THREE.AdditiveBlending }), 0.35));
    glow.scale.setScalar(1.2); glow.renderOrder = 1.44;
    g.add(glow, gem);
    g.position.set(0, 0.95, -0.15);
    av.inner.add(g);
    return { obj: g, update(t) { gem.rotation.y = t * 0.6; gem.position.y = Math.sin(t * 1.2) * 0.03; } };
  },

  // A warm golden glow deep inside.
  sunCore(av) {
    const g = new THREE.Group();
    const glow = new THREE.Sprite(overlay(new THREE.SpriteMaterial({ map: softTex(), color: '#ffcf5a', blending: THREE.AdditiveBlending }), 0.45));
    glow.scale.setScalar(1.3); glow.renderOrder = 1.44;
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), overlay(new THREE.MeshStandardMaterial({ color: '#ffd76a', emissive: '#ffb000', emissiveIntensity: 0.8, flatShading: true }), 0.8));
    core.renderOrder = 1.46;
    g.add(glow, core);
    g.position.set(0, 0.98, -0.15);
    av.inner.add(g);
    return { obj: g, update(t) { core.rotation.y = t * 0.5; core.rotation.x = t * 0.3; glow.material.opacity = 0.35 + 0.12 * Math.sin(t * 2); } };
  },

  // Three dancing flames on top.
  flameCrown(av) {
    const g = new THREE.Group();
    const prof = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(Math.sin(t * Math.PI) ** 0.8 * 0.5 * (1 - t * 0.55), t * 1.6 - 0.2)); }
    const geo = new THREE.LatheGeometry(prof, 16);
    const outer = new THREE.MeshStandardMaterial({ color: '#ff7a2e', emissive: '#ff5a1f', emissiveIntensity: 0.9, roughness: 0.4, transparent: true, opacity: 0.92 });
    const inner = new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffd23f', emissiveIntensity: 1, roughness: 0.4 });
    const flames = [];
    for (const [dx, lean, sc] of [[-0.26, -0.4, 0.24], [0, 0, 0.33], [0.26, 0.4, 0.22]]) {
      const f = new THREE.Group();
      const o = new THREE.Mesh(geo, outer); const i = new THREE.Mesh(geo, inner);
      i.scale.setScalar(0.55); i.position.y = -0.02;
      f.add(o, i);
      f.scale.setScalar(sc); f.userData = { dx, lean, sc };
      g.add(f); flames.push(f);
    }
    av.body.add(g);
    const o = { x: 0, y: 0, z: 0 };
    return {
      obj: g, head: true, anchor: flames[1],
      update(t) {
        av.shape(0, 1, 0.05, 0, o);
        g.position.set(o.x, o.y - 0.06, o.z);
        for (const f of flames) {
          const { dx, lean, sc } = f.userData, k = 1 + Math.sin(t * 17 + dx * 30) * 0.08 + Math.sin(t * 29 + dx * 9) * 0.05;
          f.position.x = dx; f.rotation.z = -lean + Math.sin(t * 5 + dx * 7) * 0.08;
          f.scale.set(sc / k, sc * k, sc / k);
        }
      },
    };
  },

  // Clear crystal points ringed around the top.
  crystalCrown(av) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#e8f6ff', emissive: '#9fd8ff', emissiveIntensity: 0.25, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + 0.3, big = i % 2 === 0;
      const pt = crystalPoint(big ? 0.06 : 0.045, big ? 0.22 : 0.14, mat);
      pt.position.set(Math.sin(a) * 0.16, 0, Math.cos(a) * 0.16);
      pt.rotation.set(Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45);
      g.add(pt);
    }
    const mid = crystalPoint(0.07, 0.3, mat);
    g.add(mid);
    g.scale.setScalar(1.45);
    av.body.add(g);
    const o = { x: 0, y: 0, z: 0 };
    return { obj: g, head: true, update(t) { av.shape(0, 1, 0.02, 0, o); g.position.set(o.x, o.y - 0.1, o.z); g.rotation.y = t * 0.2; } };
  },

  // A little chimney that puffs smoke.
  chimney(av) {
    const g = new THREE.Group();
    const brick = new THREE.MeshStandardMaterial({ color: '#8c5a4a', roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: '#3d3333', roughness: 0.7 });
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.32, 14), brick);
    pipe.position.y = 0.12;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.06, 14), dark);
    rim.position.y = 0.29;
    const tip = new THREE.Object3D(); tip.position.y = 0.36;
    g.add(pipe, rim, tip);
    av.body.add(g);
    const place = surfacePlacer(av);
    const dir = new THREE.Vector3(0.45, 0.85, -0.3).normalize();
    return { obj: g, head: true, anchor: tip, update() { place(g, dir, 0.04, 0.35); } };
  },

  // A firework fuse with a fizzing spark at the tip.
  fuse(av) {
    const g = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0.02, 0.12, 0), new THREE.Vector3(0.1, 0.24, 0), new THREE.Vector3(0.2, 0.28, 0)]);
    const cord = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.025, 8, false), new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.9 }));
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: '#ffd75a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    spark.position.set(0.2, 0.28, 0);
    g.add(cord, spark);
    av.body.add(g);
    const o = { x: 0, y: 0, z: 0 };
    return {
      obj: g, head: true, anchor: spark,
      update() { av.shape(0, 1, 0.05, 0, o); g.position.set(o.x, o.y - 0.02, o.z); spark.scale.setScalar(0.16 + Math.random() * 0.14); },
    };
  },

  // A bendy striped straw.
  straw(av) {
    const g = new THREE.Group();
    const c = document.createElement('canvas'); c.width = 64; c.height = 8;
    const x = c.getContext('2d');
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#ff5a8a'; x.fillRect(i * 8, 0, 8, 8); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(3, 1);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0.04, 0.42, 0), new THREE.Vector3(0.16, 0.48, 0), new THREE.Vector3(0.3, 0.46, 0)]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.04, 10, false), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }));
    g.add(tube);
    av.body.add(g);
    const place = surfacePlacer(av);
    const dir = new THREE.Vector3(-0.35, 0.92, -0.15).normalize();
    return { obj: g, head: true, update(t) { place(g, dir, 0.06, 0.4); g.rotation.y += 0.5; } };
  },

  // Soda bubbles rising inside.
  innerBubbles(av) {
    const g = new THREE.Group();
    const mat = overlay(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, emissive: '#ffffff', emissiveIntensity: 0.4 }), 0.7);
    const geo = new THREE.SphereGeometry(0.055, 10, 8);
    const bubbles = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(geo, mat); m.renderOrder = 1.45;
      const a = i * 2.39, r = 0.15 + (i % 4) * 0.13;
      m.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r * 0.6, ph: i / 16, sp: 0.18 + (i % 3) * 0.06, s: 0.6 + (i % 3) * 0.35 };
      g.add(m); bubbles.push(m);
    }
    av.inner.add(g);
    return {
      obj: g,
      update(t) {
        for (const b of bubbles) {
          const u = b.userData, k = (t * u.sp + u.ph) % 1;
          b.position.set(u.x + Math.sin(t * 3 + u.ph * 9) * 0.03, 0.08 + k * 1.05, u.z);
          b.scale.setScalar(u.s * (0.6 + k * 0.6));
        }
      },
    };
  },

  // Glowing fireflies drifting around.
  fireflies(av) {
    const g = new THREE.Group();
    const flies = [];
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: '#d4ff3a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      f.scale.setScalar(0.3);
      f.userData = { a: i * 1.05, r: 1.15 + (i % 3) * 0.2, h: 0.5 + (i % 4) * 0.35, sp: 0.25 + (i % 3) * 0.08, ph: i * 1.7 };
      g.add(f); flies.push(f);
    }
    av.body.add(g);
    return {
      obj: g,
      update(t) {
        for (const f of flies) {
          const u = f.userData, a = u.a + t * u.sp;
          f.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 0.9 + u.ph) * 0.18, Math.sin(a) * u.r * 0.8);
          f.material.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.6 + u.ph)) ** 2;
        }
      },
    };
  },

  // A big sunflower on top.
  sunflower(av) {
    const g = new THREE.Group();
    const flower = new THREE.Group();
    const yellow = new THREE.MeshStandardMaterial({ color: '#ffd23a', roughness: 0.5 });
    const gold = new THREE.MeshStandardMaterial({ color: '#ffb81f', roughness: 0.5 });
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i < 12; i++) {
        const a = (i + ring * 0.5) / 12 * TAU;
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), ring ? gold : yellow);
        p.scale.set(0.45, 0.14, 1);
        p.position.set(Math.sin(a) * (0.17 - ring * 0.02), 0.01 - ring * 0.01, Math.cos(a) * (0.17 - ring * 0.02));
        p.rotation.y = a; p.rotation.x = -0.2;
        flower.add(p);
      }
    }
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 20), new THREE.MeshStandardMaterial({ color: '#6b3f1d', roughness: 0.95 }));
    disc.position.y = 0.03;
    flower.add(disc);
    flower.scale.setScalar(2);
    flower.rotation.x = 0.95;
    g.add(flower);
    av.body.add(g);
    const place = surfacePlacer(av);
    const dir = new THREE.Vector3(-0.15, 0.95, 0.05).normalize();
    return { obj: g, head: true, update(t) { place(g, dir, 0.0, 0.3); flower.rotation.y = Math.sin(t * 0.5) * 0.12; } };
  },

  // Big leaves around the base.
  leafSkirt(av) {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.bezierCurveTo(0.16, 0.1, 0.16, 0.36, 0, 0.5); shape.bezierCurveTo(-0.16, 0.36, -0.16, 0.1, 0, 0);
    const geo = new THREE.ShapeGeometry(shape, 10);
    const mats = [new THREE.MeshStandardMaterial({ color: '#5fb04a', roughness: 0.6, side: THREE.DoubleSide }), new THREE.MeshStandardMaterial({ color: '#4c9a3b', roughness: 0.6, side: THREE.DoubleSide })];
    const leaves = [];
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU + 0.45;
      const holder = new THREE.Group();
      const leaf = new THREE.Mesh(geo, mats[i % 2]);
      leaf.rotation.x = Math.PI / 2 - 0.3;
      leaf.scale.setScalar(1.3);
      holder.add(leaf);
      holder.rotation.y = a;
      g.add(holder);
      leaves.push({ holder, a });
    }
    av.body.add(g);
    const o = { x: 0, y: 0, z: 0 };
    return {
      obj: g,
      update(t) {
        for (const l of leaves) {
          const dx = Math.sin(l.a), dz = Math.cos(l.a);
          av.shape(dx * 0.94, -0.33, dz * 0.94, Math.atan2(dz, dx), o);
          l.holder.position.set(o.x * 0.92, Math.max(0.02, o.y - 0.02), o.z * 0.92);
          l.holder.scale.setScalar(1 + Math.sin(t * 0.8 + l.a) * 0.03);
        }
      },
    };
  },

  // A wind-up key turning slowly on its back.
  windupKey(av) {
    const g = new THREE.Group();
    const brass = new THREE.MeshStandardMaterial({ color: '#e0b04a', metalness: 0.8, roughness: 0.25 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10), brass);
    shaft.position.y = 0.08;
    const spin = new THREE.Group(); spin.position.y = 0.2;
    for (const side of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 10, 24), brass);
      loop.position.x = side * 0.11;
      spin.add(loop);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), brass);
    spin.add(hub);
    g.add(shaft, spin);
    av.body.add(g);
    const place = surfacePlacer(av);
    const dir = new THREE.Vector3(0.75, 0.35, -0.6).normalize();
    return { obj: g, update(t) { place(g, dir, 0.03); spin.rotation.y = t * 1.2; } };
  },

  // Candy gems floating inside the clear body.
  gumdrops(av) {
    const g = new THREE.Group();
    const cols = ['#ff5a8a', '#ffd23f', '#5ad1ff', '#9b6bff', '#6be38a', '#ff8a3d'];
    const items = [];
    const heart = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 14 });
    heart.center();
    for (let i = 0; i < 7; i++) {
      const mat = overlay(new THREE.MeshStandardMaterial({ color: cols[i % 6], roughness: 0.2, emissive: cols[i % 6], emissiveIntensity: 0.25 }), 0.85);
      const m = i % 2 ? new THREE.Mesh(heart, mat) : new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10, 0, TAU, 0, Math.PI * 0.6), mat);
      m.scale.setScalar(i % 2 ? 0.16 : 1);
      m.renderOrder = 1.46;
      const spots = [[-0.32, 1.02, -0.1], [0.05, 1.12, -0.2], [0.36, 0.98, -0.1], [-0.68, 0.42, 0.05], [0.7, 0.45, 0.0], [-0.58, 0.2, 0.25], [0.6, 0.22, 0.25]];
      const [sx, sy, sz] = spots[i];
      m.userData = { x: sx, y: sy, z: sz, ph: i };
      g.add(m); items.push(m);
    }
    av.inner.add(g);
    return {
      obj: g,
      update(t) {
        for (const m of items) { const u = m.userData; m.position.set(u.x, u.y + Math.sin(t * 0.8 + u.ph) * 0.04, u.z); m.rotation.y = t * 0.4 + u.ph; }
      },
    };
  },

  // A ring of golden sun rays floating above the head.
  sunHalo(av) {
    const g = new THREE.Group();
    const ring = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: '#ffc93c', emissive: '#ffae00', emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.3 });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      const ray = new THREE.Mesh(new THREE.ConeGeometry(0.035, i % 2 ? 0.1 : 0.15, 6), gold);
      ray.position.set(Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36);
      ray.rotation.z = -Math.PI / 2; ray.rotation.y = -a;
      ring.add(ray);
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 8, 40), gold);
    band.rotation.x = Math.PI / 2;
    ring.add(band);
    ring.rotation.x = 0.35;
    g.add(ring);
    av.body.add(g);
    const o = { x: 0, y: 0, z: 0 };
    return { obj: g, head: true, update(t) { av.shape(0, 1, 0, 0, o); g.position.set(o.x, o.y + 0.22 + Math.sin(t * 1.4) * 0.03, o.z); ring.rotation.y = t * 0.35; } };
  },

  // A leaf resting on top like a little hat.
  dewLeaf(av) {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.bezierCurveTo(0.22, 0.12, 0.2, 0.45, 0, 0.62); shape.bezierCurveTo(-0.2, 0.45, -0.22, 0.12, 0, 0);
    const geo = new THREE.ShapeGeometry(shape, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, -x * x * 1.6 - (y - 0.3) ** 2 * 0.5); }
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#5cc56a', roughness: 0.4, side: THREE.DoubleSide }));
    leaf.rotation.x = -Math.PI / 2 + 0.25;
    leaf.position.set(0, 0.02, 0.18);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.12, 6), new THREE.MeshStandardMaterial({ color: '#3f8f45' }));
    stem.position.set(0, 0.05, 0.2); stem.rotation.x = 0.5;
    g.add(leaf, stem);
    av.body.add(g);
    const o = { x: 0, y: 0, z: 0 };
    return { obj: g, head: true, update(t) { av.shape(0, 1, 0, 0, o); g.position.set(o.x, o.y - 0.03, o.z); g.rotation.set(0, 2.6 + Math.sin(t * 0.7) * 0.1, Math.sin(t * 1.1) * 0.05); } };
  },

  // Tiny water droplets clinging to the surface.
  droplets(av) {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0, metalness: 0, transparent: true, opacity: 0.55, clearcoat: 1 });
    const spots = [];
    const dirs = [[0.85, 0.35, 0.3], [-0.8, 0.5, 0.25], [0.6, 0.7, -0.4], [-0.5, 0.2, -0.85], [0.9, -0.1, -0.35], [-0.92, 0.05, 0.3], [0.2, 0.8, -0.6]];
    for (let i = 0; i < dirs.length; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.045 + (i % 3) * 0.015, 14, 10), mat);
      d.scale.y = 0.8;
      g.add(d);
      spots.push({ d, dir: new THREE.Vector3(...dirs[i]).normalize() });
    }
    av.body.add(g);
    const place = surfacePlacer(av);
    return { obj: g, update() { for (const sp of spots) place(sp.d, sp.dir, -0.015); } };
  },

  // A little knight helmet with a red plume.
  helmet(av) {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: '#d7dde8', metalness: 0.85, roughness: 0.22 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 14, 0, TAU, 0, Math.PI / 2), steel);
    dome.scale.y = 0.8;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 10, 32), steel);
    rim.rotation.x = Math.PI / 2;
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.5), steel);
    crest.position.y = 0.23;
    const plumeMat = new THREE.MeshStandardMaterial({ color: '#ff4f5e', roughness: 0.8 });
    const plume = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), plumeMat);
      const a = -0.4 + i * 0.28;
      f.position.set(0, 0.3 + Math.cos(a) * 0.14, -Math.sin(a) * 0.2 - 0.05);
      f.scale.set(0.8, 1, 1.4);
      plume.add(f);
    }
    g.add(dome, rim, crest, plume);
    g.scale.setScalar(1.25);
    av.body.add(g);
    const o = { x: 0, y: 0, z: 0 };
    return { obj: g, head: true, update(t) { av.shape(0, 1, -0.05, 0, o); g.position.set(o.x, o.y - 0.13, o.z - 0.04); g.rotation.set(-0.12, 0, 0.12); plume.rotation.x = Math.sin(t * 2) * 0.05; } };
  },

  // A ladybug strolling over its back.
  ladybug(av) {
    const g = new THREE.Group();
    const bug = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e8312f', roughness: 0.3 }));
    shell.scale.set(0.9, 0.7, 1.1);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: '#1e1a1a', roughness: 0.6 }));
    head.position.set(0, 0.01, 0.075);
    bug.add(shell, head);
    const dotMat = new THREE.MeshStandardMaterial({ color: '#1e1a1a', roughness: 0.6 });
    for (const [x, z] of [[0.03, 0.02], [-0.03, 0.02], [0.035, -0.035], [-0.035, -0.035], [0, -0.06]]) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), dotMat);
      d.position.set(x, 0.04, z); d.scale.y = 0.4; bug.add(d);
    }
    g.add(bug);
    av.body.add(g);
    const o = { x: 0, y: 0, z: 0 };
    const pos = new THREE.Vector3(), next = new THREE.Vector3(), n = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), m = new THREE.Matrix4();
    const at = (t, out) => {
      const a = Math.PI + 2.0 * Math.sin(t * 0.22), el = 0.55 + 0.22 * Math.sin(t * 0.37);
      const dx = Math.sin(a) * Math.cos(el), dy = Math.sin(el), dz = Math.cos(a) * Math.cos(el);
      av.shape(dx, dy, dz, Math.atan2(dz, dx), o);
      return out.set(o.x, o.y, o.z);
    };
    return {
      obj: g,
      update(t) {
        at(t, pos); at(t + 0.15, next);
        n.set(pos.x, pos.y - 0.55, pos.z).normalize();
        fwd.subVectors(next, pos); fwd.addScaledVector(n, -fwd.dot(n)).normalize();
        side.crossVectors(n, fwd).normalize();
        m.makeBasis(side, n, fwd);
        bug.quaternion.setFromRotationMatrix(m);
        bug.position.copy(pos).addScaledVector(n, -0.01);
      },
    };
  },
};

// ---------- breeding-only looks (SAMPLES) ----------
// Forms that come only from a parent pair raised on the right snacks (a "family spark", per the design
// doc). Not reachable in gameplay yet: the form resolver never picks a 'breed:' id, so these render only
// through setForm() (see tools/render-samples.cjs). Two takes (a, b) per form so the owner can pick one.

// Small tiling stripes (straight or diagonal) for wrappers and handles.
function stripeTex(a, b, n = 8, diagonal = false) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = a; x.fillRect(0, 0, 64, 64);
  x.fillStyle = b;
  const s = 64 / n;
  for (let i = -n; i < n * 2; i += 2) {
    x.beginPath();
    if (diagonal) { x.moveTo(i * s, 64); x.lineTo((i + 1) * s, 64); x.lineTo((i + 1) * s + 64, 0); x.lineTo(i * s + 64, 0); }
    else x.rect(i * s, 0, s, 64);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// A flat rounded slab lying in the XZ plane (top face up). uvs on the top/bottom map 0..1 over its width.
function slab(w, d, r = w * 0.07) {
  const bevel = Math.min(d * 0.25, 0.02);
  const geo = new THREE.ExtrudeGeometry(roundRect(w, w, r), { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 3 });
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / w + 0.5);
  geo.translate(0, 0, -d / 2);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// Graham cracker face: toasty tan, a pressed border, the snap line and docking holes.
const grahamTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#d89a52'; x.fillRect(0, 0, 256, 256);
    let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 520; i++) {
      x.fillStyle = rnd() < 0.5 ? 'rgba(150, 86, 34, 0.25)' : 'rgba(255, 222, 165, 0.3)';
      x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 1 + rnd() * 2.5, 0, TAU); x.fill();
    }
    x.strokeStyle = 'rgba(140, 78, 30, 0.5)'; x.lineWidth = 6;
    x.strokeRect(20, 20, 216, 216);
    x.setLineDash([12, 10]); x.beginPath(); x.moveTo(128, 26); x.lineTo(128, 230); x.stroke(); x.setLineDash([]);
    x.fillStyle = 'rgba(115, 60, 22, 0.75)';
    for (const cx of [56, 96, 160, 200]) for (const cy of [60, 106, 152, 198]) { x.beginPath(); x.arc(cx, cy, 7, 0, TAU); x.fill(); }
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();
function makeCracker(w, d) {
  return new THREE.Mesh(slab(w, d), [
    new THREE.MeshStandardMaterial({ map: grahamTex(), roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: '#c98a46', roughness: 0.9 }),
  ]);
}
const chocMat = () => new THREE.MeshStandardMaterial({ color: '#5e321f', roughness: 0.28, metalness: 0.05 });

// A little piece of honeycomb: seven hexagonal wax cells merged into one mesh.
function combGeo(r = 0.07, d = 0.05) {
  const hex = rad => Array.from({ length: 6 }, (_, i) => { const a = i / 6 * TAU + Math.PI / 6; return new THREE.Vector2(Math.cos(a) * rad, Math.sin(a) * rad); });
  const cell = new THREE.Shape(hex(r));
  cell.holes.push(new THREE.Path(hex(r * 0.66)));
  const base = new THREE.ExtrudeGeometry(cell, { depth: d, bevelEnabled: false });
  const parts = [[0, 0], ...Array.from({ length: 6 }, (_, i) => { const a = i / 6 * TAU; return [Math.cos(a) * r * Math.sqrt(3), Math.sin(a) * r * Math.sqrt(3)]; })]
    .map(([x, y]) => base.clone().translate(x, y, -d / 2));
  return mergeGeometries(parts);
}

Object.assign(PATTERNS, {
  // Soft marshmallow toasted on top, with melted chocolate dripping over the crown (full color).
  smoreToast: () => canvasTex((x, w, h) => {
    x.fillStyle = '#fff4e4'; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, 0, 0, h * 0.46);
    g.addColorStop(0, '#c27a3e'); g.addColorStop(0.35, '#dc9d5c'); g.addColorStop(0.7, '#f3cf9c'); g.addColorStop(1, 'rgba(255,244,228,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h * 0.46);
    x.fillStyle = '#6a3a22';
    x.fillRect(0, 0, w, h * 0.14);
    for (let i = 0; i < 10; i++) {
      const cx = (i + 0.5) / 10 * w, len = h * (0.07 + ((i * 5) % 4) * 0.045), r = w / 10 * 0.2;
      x.beginPath(); x.moveTo(cx - r * 1.9, h * 0.135); x.lineTo(cx - r, h * 0.14 + len - r);
      x.arc(cx, h * 0.14 + len - r, r, Math.PI, 0, true); x.lineTo(cx + r * 1.9, h * 0.135); x.fill();
    }
    x.strokeStyle = 'rgba(255, 220, 190, 0.35)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, h * 0.07); x.lineTo(w, h * 0.07); x.stroke();
  }),
  // Toasted golden-brown all over, darkest on top, with toasty blisters (full color).
  toastGold: () => canvasTex((x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h * 0.7);
    g.addColorStop(0, '#a85e22'); g.addColorStop(0.25, '#cf8436'); g.addColorStop(0.55, '#eba24a'); g.addColorStop(0.85, '#f7c983'); g.addColorStop(1, '#ffe9c8');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    let seed = 4; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) {
      const cx = rnd() * w, cy = h * (0.05 + rnd() * 0.42), r = 3 + rnd() * 7;
      const gg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      gg.addColorStop(0, 'rgba(110, 55, 20, 0.45)'); gg.addColorStop(1, 'rgba(110, 55, 20, 0)');
      x.fillStyle = gg; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
    }
  }),
  // Firelight from below: glows at the bottom, fading out above the eyes (emissive map), with ember specks.
  emberRise: () => canvasTex((x, w, h) => {
    const g = x.createLinearGradient(0, h * 0.34, 0, h * 0.66);
    g.addColorStop(0, '#000000'); g.addColorStop(1, '#ffffff');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    let seed = 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255, 255, 255, ${0.4 + rnd() * 0.5})`; x.beginPath(); x.arc(rnd() * w, h * (0.22 + rnd() * 0.3), 1.5 + rnd() * 2.5, 0, TAU); x.fill(); }
  }),
  // Honeycomb cells (multiplies the body color). 16 cells around, so it tiles.
  honeycomb: () => canvasTex((x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    const dx = w / 16, r = dx / Math.sqrt(3), dy = r * 1.5;
    for (let row = -1; row * dy < h + r; row++) {
      for (let col = -1; col <= 16; col++) {
        const cx = col * dx + (row % 2 ? dx / 2 : 0), cy = row * dy;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(255, 255, 255, 1)'); g.addColorStop(0.75, 'rgba(255, 226, 160, 1)'); g.addColorStop(1, 'rgba(240, 180, 90, 1)');
        x.fillStyle = g;
        x.beginPath();
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6; x.lineTo(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97); }
        x.closePath(); x.fill();
        x.strokeStyle = 'rgba(170, 92, 8, 0.65)'; x.lineWidth = 3.5; x.stroke();
      }
    }
  }),
});

Object.assign(PROP_MAKERS, {
  // Hearth's beating heart, in milk chocolate with a warm glow.
  chocoHeart(av) {
    const p = PROP_MAKERS.heartCore(av);
    const [ember, glow, heart] = p.obj.children;   // order as built in heartCore
    heart.material.color.set('#6e3a1e'); heart.material.emissive.set('#7a3510'); heart.material.emissiveIntensity = 0.35;
    glow.visible = ember.visible = false;   // no glow: the chocolate (and the drips on top) stay brown
    return p;
  },

  // A graham cracker worn like a beret, a chocolate square melting under it.
  grahamHat(av) {
    const g = new THREE.Group(), tilt = new THREE.Group();
    const cracker = makeCracker(0.95, 0.09);
    cracker.position.y = 0.1;
    const choc = new THREE.Mesh(slab(0.86, 0.065), chocMat());
    choc.rotation.y = 0.42; choc.position.set(0.02, 0.03, 0.02);
    const tip = new THREE.Object3D(); tip.position.y = 0.2;
    tilt.add(choc, cracker, tip);
    tilt.rotation.set(0.42, 0.25, 0.15);
    g.add(tilt);
    av.body.add(g);
    const o = { x: 0, y: 0, z: 0 };
    return {
      obj: g, head: true, anchor: tip,
      update(t) { av.shape(0.04, 1, -0.12, 0, o); g.position.set(o.x, o.y - 0.05, o.z); tilt.rotation.z = 0.15 + Math.sin(t * 1.2) * 0.025; },
    };
  },

  // Sitting on a big graham cracker in a puddle of melted chocolate that drips over the front edge.
  grahamBase(av) {
    const g = new THREE.Group();
    const W = 2.9, D = 0.07, bottom = 0.05;
    const cracker = makeCracker(W, D);
    const bevel = Math.min(D * 0.25, 0.02);
    cracker.position.y = bottom + D / 2 + bevel;
    const top = bottom + D + bevel * 2;
    const edge = W / 2 + bevel;
    // puddle outline: a wobbly ring with three tongues reaching the front edge
    const lobes = [Math.PI / 2 - 0.55, Math.PI / 2 + 0.1, Math.PI / 2 + 0.6].map(a => ({ a, r: (edge + 0.02) / Math.sin(a) }));
    const base = 1.3;
    const pts = [];
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * TAU;
      let r = base + 0.06 * Math.sin(a * 5 + 1) + 0.03 * Math.sin(a * 11);
      for (const l of lobes) { let da = Math.abs(a - l.a); da = Math.min(da, TAU - da); r = Math.max(r, base + (l.r - base) * Math.exp(-((da / 0.11) ** 2))); }
      pts.push(new THREE.Vector2(Math.cos(a) * r, -Math.sin(a) * r));
    }
    const pgeo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.012, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.025, bevelSegments: 3 });
    pgeo.rotateX(-Math.PI / 2);
    const mat = chocMat();
    const puddle = new THREE.Mesh(pgeo, mat);
    puddle.position.y = top + 0.002;
    // drips hanging over the front edge
    const drips = lobes.map((l, i) => {
      const len = 0.08 + i % 2 * 0.07;
      const c = new THREE.CapsuleGeometry(0.05, len, 4, 10);
      c.scale(1, 1, 0.6);
      c.translate(Math.cos(l.a) * l.r, top - len / 2 + 0.01, edge + 0.012);
      return c;
    });
    const drip = new THREE.Mesh(mergeGeometries(drips), mat);
    g.add(cracker, puddle, drip);
    av.body.add(g);
    return { obj: g, update() {} };
  },

  // A candy-striped honey dipper stuck in its head, slowly dripping honey.
  honeyDipper(av) {
    const g = new THREE.Group(), stick = new THREE.Group();
    const tex = stripeTex('#ffffff', '#ff6fa3', 8, true); tex.repeat.set(1, 3);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.62, 12), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 }));
    handle.position.y = 0.2;
    const parts = [new THREE.CylinderGeometry(0.05, 0.05, 0.24, 12)];
    for (let i = 0; i < 4; i++) {
      const r = new THREE.TorusGeometry(0.072 + (i === 1 || i === 2 ? 0.014 : 0), 0.03, 8, 20);
      r.rotateX(Math.PI / 2); r.translate(0, -0.09 + i * 0.06, 0);
      parts.push(r);
    }
    const knob = new THREE.SphereGeometry(0.055, 12, 8); knob.translate(0, 0.14, 0); parts.push(knob);
    const honey = new THREE.MeshStandardMaterial({ color: '#f2a516', emissive: '#b85f00', emissiveIntensity: 0.2, roughness: 0.12, metalness: 0.05 });
    const head = new THREE.Mesh(mergeGeometries(parts), honey);
    head.position.y = 0.62;
    stick.add(handle, head);
    stick.scale.setScalar(1.3);
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), honey);
    g.add(stick, drop);
    av.body.add(g);
    const place = surfacePlacer(av);
    const dir = new THREE.Vector3(0.4, 0.9, -0.1).normalize();
    const v = new THREE.Vector3();
    return {
      obj: g, head: true,
      update(t) {
        place(stick, dir, 0.2, 0.55);
        v.set(0, 0.65, 0).applyQuaternion(stick.quaternion).add(stick.position);
        const k = (t * 0.4) % 1;
        if (k < 0.65) { const s = 0.35 + k / 0.65 * 0.65; drop.position.set(v.x, v.y - 0.02 - s * 0.03, v.z); drop.scale.set(s, s * (1 + k * 0.5), s); }
        else { const f = (k - 0.65) / 0.35; drop.position.set(v.x, v.y - 0.05 - f * f * 0.45, v.z); drop.scale.setScalar(1 - f * 0.6); }
      },
    };
  },

  // Pieces of honeycomb floating in the clear amber body, with a warm honey light.
  combChunks(av) {
    const g = new THREE.Group();
    const geo = combGeo();
    const mat = overlay(new THREE.MeshStandardMaterial({ color: '#ffd04a', emissive: '#ff9a00', emissiveIntensity: 0.35, roughness: 0.3 }), 0.92);
    const items = [];
    for (const [x, y, z, s, ph] of [[-0.5, 0.92, -0.12, 1.15, 0], [0.52, 0.76, -0.08, 0.95, 2], [0.06, 1.16, -0.35, 0.85, 4]]) {
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 1.46; m.scale.setScalar(s);
      m.userData = { x, y, z, ph };
      g.add(m); items.push(m);
    }
    const glow = new THREE.Sprite(overlay(new THREE.SpriteMaterial({ map: softTex(), color: '#ffc04a', blending: THREE.AdditiveBlending }), 0.3));
    glow.renderOrder = 1.44; glow.scale.set(2.2, 1.5, 1); glow.position.set(0, 0.7, -0.1);
    g.add(glow);
    av.inner.add(g);
    return {
      obj: g,
      update(t) {
        for (const m of items) { const u = m.userData; m.position.set(u.x, u.y + Math.sin(t * 0.7 + u.ph) * 0.035, u.z); m.rotation.set(0.7 + Math.sin(t * 0.5 + u.ph) * 0.2, t * 0.3 + u.ph, 0.2); }
        glow.material.opacity = 0.24 + 0.06 * Math.sin(t * 1.2);
      },
    };
  },

  // Twisted candy-wrapper ends on both sides, like a wrapped sweet.
  wrapperTwists(av) {
    const g = new THREE.Group();
    const prof = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const r = t < 0.25 ? 0.16 - (t / 0.25) * 0.12 : 0.04 + Math.pow((t - 0.25) / 0.75, 0.8) * 0.25;
      prof.push(new THREE.Vector2(r, t * 0.5));
    }
    const geo = new THREE.LatheGeometry(prof, 32);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = Math.max(0, (y - 0.15) / 0.35);
      const s = 1 + 0.16 * k * Math.sin(a * 9);
      p.setXYZ(i, x * s, y + k * 0.03 * Math.cos(a * 9), z * s);
    }
    geo.computeVertexNormals();
    const tex = stripeTex('#fff7fb', '#ff7fb0', 8); tex.repeat.set(3, 1);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.28, side: THREE.DoubleSide });
    const ends = [];
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(geo, mat);
      g.add(m);
      ends.push({ m, side, dir: new THREE.Vector3(side, 0.2, -0.08).normalize() });
    }
    av.body.add(g);
    const place = surfacePlacer(av);
    return { obj: g, update(t) { for (const e of ends) { place(e.m, e.dir, 0.1); e.m.rotateY(e.side * 0.4 + Math.sin(t * 1.4 + e.side) * 0.15); } } };
  },

  // Campfire logs lying around the base (tree rings on the ends), moss growing on them.
  logRing(av) {
    const g = new THREE.Group();
    const sides = [], caps = [], moss = [];
    const ringTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = '#e8c58f'; x.fillRect(0, 0, 64, 64);
      x.strokeStyle = 'rgba(150, 96, 50, 0.7)'; x.lineWidth = 2.5;
      for (const r of [8, 15, 22]) { x.beginPath(); x.arc(32, 32, r, 0, TAU); x.stroke(); }
      x.strokeStyle = '#7a4a2a'; x.lineWidth = 6; x.beginPath(); x.arc(32, 32, 29, 0, TAU); x.stroke();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
    // angles around the base (0 = toward the viewer); the front stays clear for the face
    [0.6, 2.25, 3.14, -2.25, -0.6].forEach((a, i) => {
      const L = 0.62 + (i % 3) * 0.06, r = 0.13 + (i % 2) * 0.015;
      d.set(Math.sin(a), 0.12, Math.cos(a)).normalize();
      q.setFromUnitVectors(up, d);
      const mid = new THREE.Vector3(Math.sin(a) * 1.12, r + 0.06, Math.cos(a) * 1.12);   // lifted clear of the floor
      m4.compose(mid, q, new THREE.Vector3(1, 1, 1));
      sides.push(new THREE.CylinderGeometry(r, r * 1.05, L, 10, 1, true).applyMatrix4(m4));
      const cap = new THREE.CircleGeometry(r * 0.98, 12);
      cap.rotateX(-Math.PI / 2); cap.translate(0, L / 2 + 0.001, 0);
      caps.push(cap.applyMatrix4(m4));
      if (i % 2 === 0) {
        for (let k = 0; k < 6; k++) {
          const b = new THREE.SphereGeometry(0.045 + (k % 3) * 0.012, 7, 5);
          b.scale(1, 0.6, 1);
          b.translate((k - 2.5) * 0.06, r * 0.95, Math.sin(k * 2.1) * 0.035);
          // lie the tuft along the top of the log
          b.applyMatrix4(new THREE.Matrix4().makeRotationY(a - Math.PI / 2));
          b.translate(mid.x, mid.y, mid.z);
          moss.push(b);
        }
      }
    });
    const bark = new THREE.Mesh(mergeGeometries(sides), new THREE.MeshStandardMaterial({ color: '#7a4e2e', roughness: 0.9 }));
    const ends = new THREE.Mesh(mergeGeometries(caps), new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.8 }));
    const tufts = new THREE.Mesh(mergeGeometries(moss), new THREE.MeshStandardMaterial({ color: '#6aa84a', roughness: 1 }));
    g.add(bark, ends, tufts);
    av.body.add(g);
    return { obj: g, update() {} };
  },

  // A tiny campfire on its head: crossed sticks, a ring of pebbles and a heart-shaped flame.
  campHat(av) {
    const g = new THREE.Group(), fire = new THREE.Group();
    const sticks = [];
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + 0.4;
      const s = new THREE.CylinderGeometry(0.022, 0.03, 0.34, 7);
      s.translate(0, 0.17, 0);
      s.rotateX(0.62);
      s.rotateY(a);
      s.translate(-Math.sin(a) * 0.16, 0, -Math.cos(a) * 0.16);
      sticks.push(s);
    }
    const logs = new THREE.Mesh(mergeGeometries(sticks), new THREE.MeshStandardMaterial({ color: '#7a4e2e', roughness: 0.9 }));
    const pebbles = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU, p = new THREE.IcosahedronGeometry(0.05 + (i % 3) * 0.008, 0);
      p.scale(1.2, 0.65, 1);
      p.translate(Math.cos(a) * 0.27, 0.02, Math.sin(a) * 0.27);
      pebbles.push(p);
    }
    const stones = new THREE.Mesh(mergeGeometries(pebbles), new THREE.MeshStandardMaterial({ color: '#9a9aa4', roughness: 0.8, flatShading: true }));
    const heart = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 14 });
    heart.center();
    const outer = new THREE.Mesh(heart, new THREE.MeshStandardMaterial({ color: '#ff7a2e', emissive: '#ff5a1f', emissiveIntensity: 1, roughness: 0.4 }));
    const inner = new THREE.Mesh(heart, new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffcf3f', emissiveIntensity: 1.1, roughness: 0.4 }));
    inner.scale.setScalar(0.55); inner.position.set(0, -0.03, 0.06);
    const tongue = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.24, 0.12], [0.34, 0.42], [0.26, 0.8], [0.12, 1.15], [0, 1.45]].map(([x, y]) => new THREE.Vector2(x, y)), 16),
      new THREE.MeshStandardMaterial({ color: '#ff9a3a', emissive: '#ff6a1a', emissiveIntensity: 0.9, roughness: 0.4, transparent: true, opacity: 0.85 }));
    tongue.position.set(0, -0.5, -0.12);
    fire.add(tongue, outer, inner);
    fire.position.y = 0.3;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: '#ffb050', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
    glow.scale.setScalar(0.9); glow.position.y = 0.26;
    const tip = new THREE.Object3D(); tip.position.y = 0.48;
    g.add(stones, logs, fire, glow, tip);
    g.scale.setScalar(1.15);
    av.body.add(g);
    const o = { x: 0, y: 0, z: 0 };
    return {
      obj: g, head: true, anchor: tip,
      update(t) {
        av.shape(0, 1, -0.04, 0, o); g.position.set(o.x, o.y - 0.05, o.z);
        const k = 1 + Math.sin(t * 15) * 0.06 + Math.sin(t * 27) * 0.04;
        fire.scale.set(0.34 / k, 0.34 * k, 0.34);
        fire.rotation.z = Math.sin(t * 4) * 0.08;
        glow.material.opacity = 0.45 + 0.12 * Math.sin(t * 9);
      },
    };
  },

  // Puffy cloud bumps around the top, so the body reads as a little cumulus cloud.
  cloudPuffs(av) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#f4f6ff', roughness: 0.75 });
    const geo = new THREE.SphereGeometry(1, 18, 12);
    const spots = [];
    for (const [x, y, z, s] of [[0, 1, -0.15, 0.42], [-0.5, 0.82, -0.1, 0.36], [0.52, 0.8, -0.12, 0.38], [-0.86, 0.42, -0.1, 0.32], [0.88, 0.38, -0.08, 0.3], [-0.3, 0.75, -0.6, 0.36], [0.35, 0.72, -0.62, 0.34]]) {
      const m = new THREE.Mesh(geo, mat);
      m.scale.setScalar(s);
      g.add(m);
      spots.push({ m, s, dir: new THREE.Vector3(x, y, z).normalize() });
    }
    av.body.add(g);
    const place = surfacePlacer(av);
    return { obj: g, update(t) { for (const sp of spots) { place(sp.m, sp.dir, sp.s * 0.55); sp.m.scale.setScalar(sp.s * (1 + 0.03 * Math.sin(t * 1.3 + sp.s * 20))); } } };
  },

  // A small rainbow arching behind the head.
  rainbowArc(av) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    const cols = ['#ff8fb8', '#ffb36b', '#ffe27a', '#8fe8a8', '#86c8ff', '#c3a2ff'];
    cols.forEach((col, i) => { x.strokeStyle = col; x.lineWidth = 11; x.beginPath(); x.arc(128, 124, 110 - i * 11, Math.PI, 0); x.stroke(); });
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.95 }));
    sp.center.set(0.5, 0.02);
    sp.scale.set(2.3, 1.15, 1);
    const g = new THREE.Group(); g.add(sp);
    av.body.add(g);
    const o = { x: 0, y: 0, z: 0 };
    return { obj: g, head: true, update(t) { av.shape(0, 0.35, -1, -Math.PI / 2, o); g.position.set(0, o.y + 0.05, o.z - 0.05); sp.material.opacity = 0.85 + 0.1 * Math.sin(t * 1.5); } };
  },

  // One cheeky lightning bolt poking out of the cloud.
  stormBolt(av) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffd92e', emissive: '#ffb000', emissiveIntensity: 0.8, roughness: 0.35 });
    const geo = new THREE.ExtrudeGeometry(boltShape(), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    geo.translate(-0.1, 0.2, -0.06);
    const b = new THREE.Mesh(geo, mat);
    b.scale.setScalar(0.42);
    g.add(b);
    av.body.add(g);
    const place = surfacePlacer(av);
    const dir = new THREE.Vector3(0.55, 0.85, 0.05).normalize();
    return { obj: g, head: true, update(t) { place(g, dir, 0.02, 0.6); b.rotation.z = -0.45 + Math.sin(t * 7) * 0.05; mat.emissiveIntensity = 0.6 + 0.4 * Math.abs(Math.sin(t * 5)); } };
  },

  // A little storm cloud living inside the clear body: flickering lightning and rain falling into the belly.
  innerStorm(av) {
    const g = new THREE.Group();
    const puffs = [];
    for (const [x, y, z, s] of [[0, 0, 0, 0.16], [-0.17, -0.03, 0, 0.12], [0.17, -0.02, 0.01, 0.13], [-0.07, 0.09, -0.02, 0.12], [0.09, 0.08, 0, 0.11]]) {
      const p = new THREE.SphereGeometry(s, 14, 10); p.scale(1, 0.8, 0.8); p.translate(x, y, z); puffs.push(p);
    }
    const cloud = new THREE.Mesh(mergeGeometries(puffs), overlay(new THREE.MeshStandardMaterial({ color: '#d9d6f2', emissive: '#8c86c8', emissiveIntensity: 0.25, roughness: 0.8 }), 0.95));
    cloud.renderOrder = 1.46;
    const boltMat = overlay(new THREE.MeshStandardMaterial({ color: '#ffd92e', emissive: '#ffb000', emissiveIntensity: 1.2, roughness: 0.3 }), 0.95);
    const bgeo = new THREE.ExtrudeGeometry(boltShape(), { depth: 0.06, bevelEnabled: false });
    const bolt = new THREE.Mesh(bgeo, boltMat);
    bolt.renderOrder = 1.47;
    bolt.scale.setScalar(0.32); bolt.rotation.z = Math.PI; bolt.position.set(0.08, -0.06, 0.02);
    const flash = new THREE.Sprite(overlay(new THREE.SpriteMaterial({ map: softTex(), color: '#fff2a8', blending: THREE.AdditiveBlending }), 0.3));
    flash.renderOrder = 1.44; flash.scale.setScalar(1.3); flash.position.y = -0.1;
    const dropMat = overlay(new THREE.SpriteMaterial({ map: softTex(), color: '#4fb0ff' }), 0.95);
    const drops = [];
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Sprite(dropMat);
      d.renderOrder = 1.45; d.scale.set(0.07, 0.14, 1);
      d.userData = { x: -0.16 + i * 0.065, ph: i * 0.37 };
      drops.push(d);
    }
    g.add(flash, cloud, bolt, ...drops);
    g.position.set(0, 1.08, -0.1);
    g.scale.setScalar(1.35);
    av.inner.add(g);
    return {
      obj: g,
      update(t) {
        cloud.position.x = Math.sin(t * 0.6) * 0.05;
        const f = t % 2.6, strike = f < 0.09 || (f > 0.16 && f < 0.27);
        boltMat.emissiveIntensity = strike ? 2 : 0.9;
        flash.material.opacity = strike ? 0.6 : 0.18;
        for (const d of drops) { const u = d.userData, k = (t * 0.9 + u.ph) % 1; d.position.set(u.x + cloud.position.x, -0.1 - k * 0.6, 0.02); d.material.opacity = 0.9; }
      },
    };
  },
});

Object.assign(FORM_LOOKS, {
  // S'more (Hearth x Marshmallow)
  'breed:smore:a': {
    title: "S'more Slime", tint: '#fff2e0', tintAmt: 0.9, pattern: 'smoreToast', mapWhite: 1, glow: 0.04, shape: { square: 0.55, tall: 0.96 },
    mat: { transmission: 0.12, roughness: 0.6, sheen: 0.3, clearcoat: 0.1 }, keep: [], props: ['grahamHat', 'chocoHeart'], fx: { kind: 'steam', every: 2.6 },
  },
  'breed:smore:b': {
    title: "S'more Slime", tint: '#f3a24a', tintAmt: 0.65, pattern: 'toastGold', mapWhite: 1, glow: 0.08, shape: { square: 0.45, tall: 0.86, wide: 1.1 },
    mat: { transmission: 0.08, roughness: 0.35, sheen: 0.4, clearcoat: 0.7 }, keep: ['heat'], props: ['grahamBase'], fx: { kind: 'steam', every: 2.2 },
  },
  // Honeycomb (Nectar x Candy)
  'breed:honeycomb:a': {
    title: 'Honeycomb Slime', tint: '#ffbf2e', tintAmt: 0.85, pattern: 'honeycomb', mapWhite: 0, shape: { tall: 0.98, wide: 1.03 },
    mat: { roughness: 0.08, transmission: 0.45 }, keep: [], props: ['honeyDipper', 'bee'], fx: { kind: 'glints', every: 0.9, color: '#ffe08a' },
  },
  'breed:honeycomb:b': {
    title: 'Honeycomb Slime', tint: '#ffad1f', tintAmt: 0.75, shape: { square: 0.15, wide: 1.02 }, mat: { transmission: 0.92, roughness: 0.03, thickness: 0.9 },
    keep: [], props: ['combChunks', 'wrapperTwists', 'blossom'], fx: { kind: 'glints', every: 0.7, color: '#ffe7a0' },
  },
  // Campfire (Hearth x Root)
  'breed:campfire:a': {
    title: 'Campfire Slime', tint: '#ffb43c', tintAmt: 0.75, glowPattern: 'emberRise', glowColor: '#ff6a1a', glowMode: 'pulse', glowSpeed: 1.3,
    shape: { wide: 1.04, tall: 0.94 }, mat: { roughness: 0.2 }, keep: [], props: ['logRing', 'heartCore'], fx: { kind: 'embers', every: 0.55 },
  },
  'breed:campfire:b': {
    title: 'Campfire Slime', tint: '#3f8f5a', tintAmt: 0.75, shape: { wide: 1.07, tall: 0.88 }, mat: { roughness: 0.32 },
    keep: [], props: ['roots', 'campHat'], fx: { kind: 'embers', every: 0.5 },
  },
  // Storm (Aurora x Volt): a happy little storm cloud
  'breed:storm:a': {
    title: 'Storm Slime', tint: '#eef0ff', tintAmt: 0.85, shape: { tall: 0.95, wide: 1.04 }, mat: { transmission: 0.25, roughness: 0.55, sheen: 1, iridescence: 0.35 },
    keep: [], props: ['cloudPuffs', 'rainbowArc', 'stormBolt'], fx: { kind: 'glints', every: 0.6, color: '#fff6b0' },
  },
  'breed:storm:b': {
    title: 'Storm Slime', tint: '#8fc8ff', tintAmt: 0.68, shape: { tall: 1.02 }, mat: { transmission: 0.92, roughness: 0.03, iridescence: 1, thickness: 0.8 },
    keep: [], props: ['innerStorm'], fx: { kind: 'sparks', every: 1.0, color: '#fff3a8' },
  },
});

export function makePattern(name) { return PATTERNS[name] ? PATTERNS[name]() : null; }
