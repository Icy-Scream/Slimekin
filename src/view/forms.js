// Grown-up form looks. When a slime settles, its form adds a signature look on top of the
// diet-based color: a body shape, a surface pattern, something inside it, small props and effects.
// Following the design doc, each form leans on 2-3 strong motifs instead of every trait at once.
import * as THREE from 'three';

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
};

// ---------- the eight sample forms (more to follow once the style is approved) ----------
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
      obj: g,
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
    return { obj: g, update(t) { place(g, dir, 0.02, 0.5); g.rotation.z += Math.sin(t * 1.4) * 0.03; } };
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
      obj: g,
      update(t) {
        av.shape(0, 1, 0.05, 0, o);
        g.position.set(o.x, o.y - 0.08, o.z);
        for (const b of bolts) { b.position.x = b.userData.dx; b.rotation.z = -b.userData.lean + Math.sin(t * 9 + b.userData.dx * 10) * 0.05; }
        mat.emissiveIntensity = 0.7 + Math.random() * 0.5;
      },
    };
  },
};

export function makePattern(name) { return PATTERNS[name] ? PATTERNS[name]() : null; }
