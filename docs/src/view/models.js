// Small hand-built 3D models for foods and helpers. The same models are
// rendered once at boot into the icons used by the shop and the snack tray.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2, ...o });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };

function cookie() {
  const g = new THREE.Group();
  const dough = std('#dda468', { roughness: 0.85 });
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 28), dough));
  const rim = mesh(new THREE.TorusGeometry(0.16, 0.031, 10, 28), dough);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const chip = std('#5a3424', { roughness: 0.6 });
  const chipGeo = new THREE.SphereGeometry(0.024, 8, 6);
  [[0.05, 0.06], [-0.07, 0.03], [0.0, -0.07], [-0.03, 0.09], [0.09, -0.05], [-0.09, -0.06]].forEach(([x, z], i) => {
    g.add(mesh(chipGeo, chip, x, i % 2 ? 0.031 : -0.031, z));
    if (i < 4) g.add(mesh(chipGeo, chip, -x * 0.8, 0.031, z * 0.7));
  });
  return g;
}

function chili() {
  const g = new THREE.Group();
  const pts = [[0, 0.01], [0.055, 0.01], [0.068, -0.04], [0.064, -0.1], [0.052, -0.18], [0.034, -0.26], [0.013, -0.33], [0, -0.35]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 18);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + y * y * 2.2); }
  geo.computeVertexNormals();
  g.add(mesh(geo, phys('#e8342a', { roughness: 0.25 })));
  const green = std('#4b9a3c', { roughness: 0.6 });
  const cap = mesh(new THREE.SphereGeometry(0.062, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), green, 0, 0.004, 0);
  cap.scale.y = 0.45;
  g.add(cap);
  const stem = mesh(new THREE.CylinderGeometry(0.011, 0.016, 0.08, 8), green, -0.012, 0.05, 0);
  stem.rotation.z = 0.35;
  g.add(stem);
  g.position.y = 0.16;
  const wrap = new THREE.Group(); wrap.add(g); wrap.rotation.z = -0.5;
  return wrap;
}

function iron() {
  const g = new THREE.Group();
  const metal = std('#9aa8ba', { metalness: 0.85, roughness: 0.3 });
  const nut = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.075, 6), metal);
  g.add(nut);
  g.add(mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.078, 18), std('#2b3038', { roughness: 0.8 })));
  const bolt = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 12), std('#7f8a99', { metalness: 0.8, roughness: 0.4 }), 0.0, 0.0, 0);
  bolt.rotation.z = Math.PI / 2;
  bolt.position.set(0.14, 0.05, 0.05);
  const head = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 6), metal);
  head.rotation.z = Math.PI / 2;
  head.position.set(0.24, 0.05, 0.05);
  g.add(bolt, head);
  return g;
}

function moss() {
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(0.24, 0.2, 0.24, 3, 0.045), std('#5aa648', { roughness: 0.95 })));
  g.add(mesh(new RoundedBoxGeometry(0.255, 0.07, 0.255, 2, 0.032), std('#93dd6e', { roughness: 0.95 }), 0, 0.085, 0));
  const dot = std('#c6f59a', { roughness: 0.9 });
  const dg = new THREE.SphereGeometry(0.018, 8, 6);
  [[0.06, 0.05], [-0.07, -0.02], [0.01, -0.08], [-0.04, 0.08], [0.08, -0.07]].forEach(([x, z]) => g.add(mesh(dg, dot, x, 0.122, z)));
  return g;
}

function berry() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.11, 24, 16), phys('#5d6cf0', { roughness: 0.22 })));
  const crown = mesh(new THREE.ConeGeometry(0.04, 0.035, 5, 1, true), std('#2f5c4a', { side: THREE.DoubleSide }), 0, 0.105, 0);
  crown.rotation.x = Math.PI;
  g.add(crown);
  const spark = std('#ffe45c', { emissive: '#ffd21f', emissiveIntensity: 1.2 });
  const sg = new THREE.OctahedronGeometry(0.022, 0);
  [[0.13, 0.06, 0.03], [-0.1, 0.1, -0.05], [0.04, -0.11, 0.1]].forEach(([x, y, z]) => g.add(mesh(sg, spark, x, y, z)));
  return g;
}

function crystal() {
  const g = new THREE.Group();
  const mat = phys('#a9e7ff', { roughness: 0.05, emissive: '#3aa9ff', emissiveIntensity: 0.35, flatShading: true, iridescence: 0.8 });
  const main = mesh(new THREE.OctahedronGeometry(0.1, 0), mat);
  main.scale.set(1, 1.9, 1);
  g.add(main);
  const small = mesh(new THREE.OctahedronGeometry(0.06, 0), mat, 0.08, -0.08, 0.02);
  small.scale.set(1, 1.7, 1); small.rotation.z = -0.6;
  const small2 = mesh(new THREE.OctahedronGeometry(0.05, 0), mat, -0.08, -0.1, -0.01);
  small2.scale.set(1, 1.6, 1); small2.rotation.z = 0.7;
  g.add(small, small2);
  return g;
}

export const FOOD_MAKERS = { cookie, chili, iron, moss, berry, crystal };

// ---------- helpers ----------
export function feather(color = '#d5c3ff') {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.1, 0.08, 0.09, 0.3, 0, 0.44);
  s.bezierCurveTo(-0.09, 0.3, -0.1, 0.08, 0, 0);
  const vane = mesh(new THREE.ShapeGeometry(s, 14), std(color, { side: THREE.DoubleSide, roughness: 0.85 }));
  g.add(vane);
  const quill = mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.52, 6), std('#fff5e6'), 0, 0.2, 0.003);
  g.add(quill);
  g.children.forEach(c => { c.position.y -= 0.2; });
  return g;
}

function bubbleWand() {
  const g = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(0.11, 0.018, 10, 30), phys('#ff94c2'), 0, 0.12, 0);
  g.add(ring);
  g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 10), std('#ffcf6e'), 0, -0.13, 0));
  const film = mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0, iridescence: 1, side: THREE.DoubleSide }), 0, 0.12, 0);
  g.add(film);
  const b = mesh(new THREE.SphereGeometry(0.055, 18, 12), new THREE.MeshPhysicalMaterial({ color: '#dff6ff', transparent: true, opacity: 0.45, roughness: 0, iridescence: 1 }), 0.13, 0.24, 0.02);
  g.add(b);
  return g;
}

export function planter(seed = 0) {
  const g = new THREE.Group();
  const potColors = ['#ff9b7d', '#ffc06b', '#b9a1ff', '#7fd3c0'];
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.2, 22), std(potColors[seed % 4], { roughness: 0.75 }), 0, 0.1, 0));
  const rim = mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 26), std(potColors[seed % 4], { roughness: 0.6 }), 0, 0.2, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  g.add(mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.02, 22), std('#6b4a3a', { roughness: 1 }), 0, 0.195, 0));
  const leafMat = std('#6fcf5a', { roughness: 0.6 });
  const stem = mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.16, 6), leafMat, 0, 0.28, 0);
  g.add(stem);
  const leafGeo = new THREE.SphereGeometry(0.07, 12, 8);
  const sprout = new THREE.Group();
  sprout.position.y = 0.35;
  for (const side of [-1, 1]) {
    const leaf = mesh(leafGeo, leafMat, side * 0.055, 0, 0);
    leaf.scale.set(1, 0.25, 0.55);
    leaf.rotation.z = side * 0.45;
    sprout.add(leaf);
  }
  if (seed % 2 === 0) sprout.add(mesh(new THREE.SphereGeometry(0.032, 12, 8), phys('#ff6f91'), 0, 0.03, 0.02));
  else sprout.add(mesh(new THREE.SphereGeometry(0.03, 12, 8), phys('#ffd25a'), 0, 0.03, 0.02));
  g.add(sprout);
  g.userData.sprout = sprout;
  g.children.forEach(c => { c.position.y -= 0.18; });
  return g;
}

export function slimeling(color = '#ffb3d1') {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.16, 24, 16), phys(color, { roughness: 0.15, clearcoat: 1, sheen: 0.5, sheenColor: '#ffffff' }), 0, 0.12, 0);
  body.scale.set(1.05, 0.82, 1.05);
  g.add(body);
  const eyeMat = std('#2a1f3d', { roughness: 0.3 });
  const eyeGeo = new THREE.SphereGeometry(0.022, 10, 8);
  for (const s of [-1, 1]) {
    const eye = mesh(eyeGeo, eyeMat, s * 0.055, 0.15, 0.148);
    eye.scale.set(0.9, 1.25, 0.6);
    g.add(eye);
    g.add(mesh(new THREE.SphereGeometry(0.007, 6, 6), std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), s * 0.055 - 0.007, 0.162, 0.162));
  }
  const blush = std('#ff7aa8', { transparent: true, opacity: 0.6, roughness: 1 });
  for (const s of [-1, 1]) {
    const b = mesh(new THREE.SphereGeometry(0.02, 8, 6), blush, s * 0.098, 0.115, 0.13);
    b.scale.set(1.2, 0.6, 0.4);
    g.add(b);
  }
  g.userData.body = body;
  g.children.forEach(c => { c.position.y -= 0.12; });
  return g;
}

function musicBox() {
  const g = new THREE.Group();
  const wood = std('#ffc7da', { roughness: 0.6 });
  const gold = std('#f2c35d', { metalness: 0.7, roughness: 0.35 });
  g.add(mesh(new RoundedBoxGeometry(0.34, 0.2, 0.25, 2, 0.02), wood));
  g.add(mesh(new THREE.BoxGeometry(0.35, 0.025, 0.26), gold, 0, 0.09, 0));
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.105, -0.125);
  lidPivot.rotation.x = -1.05;
  lidPivot.add(mesh(new RoundedBoxGeometry(0.34, 0.035, 0.25, 2, 0.015), wood, 0, 0, 0.125));
  g.add(lidPivot);
  const spinner = new THREE.Group();
  spinner.position.set(0, 0.11, 0.02);
  spinner.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 16), gold));
  const tiny = mesh(new THREE.SphereGeometry(0.035, 14, 10), phys('#8ef0c8'), 0, 0.04, 0);
  tiny.scale.y = 0.8;
  spinner.add(tiny);
  g.add(spinner);
  g.userData.spinner = spinner;
  const crank = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.07, 8), gold, 0.2, 0, 0);
  crank.rotation.z = Math.PI / 2;
  g.add(crank);
  return g;
}

export function moonLamp() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.14, 24, 16), std('#fff6d2', { emissive: '#ffe9a3', emissiveIntensity: 0.9, roughness: 0.4 })));
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.04, 12), std('#c8a7ff', { roughness: 0.5 }), 0, 0.15, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 4), std('#c8a7ff'), 0, 0.31, 0));
  return g;
}

export function fountain() {
  const g = new THREE.Group();
  const stone = std('#c6e6f2', { roughness: 0.7 });
  const goo = phys('#7fe8c4', { roughness: 0.1, transmission: 0.3 });
  g.add(mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.09, 26), stone, 0, 0.045, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.02, 26), goo, 0, 0.09, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.22, 14), stone, 0, 0.2, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.13, 0.08, 0.05, 20), stone, 0, 0.32, 0));
  const top = mesh(new THREE.SphereGeometry(0.06, 16, 12), goo, 0, 0.37, 0);
  g.add(top);
  g.userData.top = top;
  return g;
}

function telescope() {
  const g = new THREE.Group();
  const wood = std('#8a6a50', { roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    const leg = mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.32, 6), wood, Math.cos(a) * 0.07, 0.14, Math.sin(a) * 0.07);
    leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    g.add(leg);
  }
  const tube = new THREE.Group();
  tube.position.y = 0.3;
  tube.rotation.z = -0.9;
  tube.add(mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.38, 18), phys('#7d73e6')));
  const gold = std('#f2c35d', { metalness: 0.7, roughness: 0.35 });
  tube.add(mesh(new THREE.CylinderGeometry(0.063, 0.063, 0.03, 18), gold, 0, 0.17, 0));
  tube.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.025, 18), gold, 0, -0.1, 0));
  tube.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 10), gold, 0, -0.21, 0));
  g.add(tube);
  return g;
}

export function spa() {
  const g = new THREE.Group();
  const tub = new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.48, 0.06], [0.5, 0.22], [0.47, 0.26], [0.43, 0.22], [0.4, 0.08], [0, 0.08]].map(([x, y]) => new THREE.Vector2(x, y)), 36);
  g.add(mesh(tub, std('#ffd6e6', { roughness: 0.4, side: THREE.DoubleSide })));
  const water = mesh(new THREE.CircleGeometry(0.43, 32), phys('#9fe6ff', { roughness: 0.05, transmission: 0.2, emissive: '#5fd0ff', emissiveIntensity: 0.15 }), 0, 0.2, 0);
  water.rotation.x = -Math.PI / 2;
  g.add(water);
  const duck = new THREE.Group();
  duck.add(mesh(new THREE.SphereGeometry(0.07, 14, 10), std('#ffd54a')));
  duck.add(mesh(new THREE.SphereGeometry(0.045, 12, 8), std('#ffd54a'), 0.04, 0.06, 0));
  const beak = mesh(new THREE.ConeGeometry(0.018, 0.04, 8), std('#ff8a3d'), 0.09, 0.06, 0);
  beak.rotation.z = -Math.PI / 2;
  duck.add(beak);
  duck.position.set(0.12, 0.23, 0.1);
  g.add(duck);
  g.userData.duck = duck;
  const bubbleMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, roughness: 0, iridescence: 1 });
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    g.add(mesh(new THREE.SphereGeometry(0.04 + (i % 3) * 0.015, 12, 8), bubbleMat, Math.cos(a) * 0.28, 0.22, Math.sin(a) * 0.28));
  }
  return g;
}

export function rainbowArch(radius = 1, tube = 0.08) {
  const g = new THREE.Group();
  const colors = ['#ff8fa8', '#ffc078', '#ffe680', '#9ee6a0', '#8fd0ff', '#b9a3ff'];
  colors.forEach((c, i) => {
    const r = radius - i * tube * 1.6;
    const m = mesh(new THREE.TorusGeometry(r, tube, 10, 64, Math.PI), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: c, emissiveIntensity: 0.25 }));
    g.add(m);
  });
  for (const x of [-radius + tube * 4, radius - tube * 4]) {
    const cloud = new THREE.Group();
    for (let i = 0; i < 4; i++) cloud.add(mesh(new THREE.SphereGeometry(radius * 0.13, 14, 10), std('#ffffff', { roughness: 0.9 }), (i - 1.5) * radius * 0.1, Math.sin(i * 2) * radius * 0.03, 0));
    cloud.position.x = x;
    g.add(cloud);
  }
  return g;
}

// ---------- outfits (built around a local origin; the slime positions them) ----------
export const OUTFIT_MAKERS = {
  bow() {
    const g = new THREE.Group();
    const mat = phys('#ff6fa3', { roughness: 0.35 });
    for (const s of [-1, 1]) {
      const loop = mesh(new THREE.SphereGeometry(0.13, 16, 12), mat, s * 0.12, 0, 0);
      loop.scale.set(1.15, 0.75, 0.42);
      loop.rotation.z = s * 0.25;
      g.add(loop);
      const tail = mesh(new THREE.ConeGeometry(0.05, 0.16, 8), mat, s * 0.06, -0.1, 0);
      tail.rotation.z = s * 0.5;
      g.add(tail);
    }
    g.add(mesh(new THREE.SphereGeometry(0.06, 12, 10), mat));
    return g;
  },
  bowtie() {
    const g = new THREE.Group();
    const mat = phys('#e14b6a', { roughness: 0.4 });
    for (const s of [-1, 1]) {
      const wing = mesh(new THREE.ConeGeometry(0.1, 0.2, 4), mat, s * 0.1, 0, 0);
      wing.rotation.z = s * Math.PI / 2;
      wing.scale.z = 0.4;
      g.add(wing);
    }
    g.add(mesh(new THREE.SphereGeometry(0.045, 12, 10), mat));
    return g;
  },
  glasses() {
    const g = new THREE.Group();
    const frame = std('#3a2f52', { roughness: 0.35, metalness: 0.3 });
    const lens = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, roughness: 0, depthWrite: false });
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.TorusGeometry(0.17, 0.022, 10, 32), frame, s * 0.29, 0, 0));
      g.add(mesh(new THREE.CircleGeometry(0.17, 24), lens, s * 0.29, 0, -0.005));
    }
    const bridge = mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 16, Math.PI), frame, 0, 0.03, 0);
    g.add(bridge);
    return g;
  },
  shades() {
    const g = new THREE.Group();
    const frame = std('#ffcf4a', { roughness: 0.3, metalness: 0.6 });
    const dark = phys('#2a1f3d', { roughness: 0.1, clearcoat: 1 });
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 === 0 ? 0.2 : 0.09;
      if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r); else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
    for (const s of [-1, 1]) g.add(mesh(geo, dark, s * 0.29, 0, -0.02));
    g.add(mesh(new THREE.BoxGeometry(0.16, 0.025, 0.025), frame, 0, 0.05, 0));
    return g;
  },
  flowers() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.TorusGeometry(1, 0.06, 8, 48), std('#6fbf55', { roughness: 0.7 }), 0, 0, 0));
    g.children[0].rotation.x = Math.PI / 2;
    const cols = ['#ff9fc6', '#fff1a8', '#c9b3ff', '#ffffff'];
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      const f = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const p = mesh(new THREE.SphereGeometry(0.1, 8, 6), std(cols[i % 4], { roughness: 0.6 }), Math.cos(k * 1.26) * 0.1, 0.03, Math.sin(k * 1.26) * 0.1);
        p.scale.y = 0.45;
        f.add(p);
      }
      f.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), std('#ffb347'), 0, 0.05, 0));
      f.position.set(Math.cos(a), 0.02, Math.sin(a));
      f.rotation.z = Math.cos(a) * -0.5; f.rotation.x = Math.sin(a) * 0.5;
      g.add(f);
    }
    g.userData.ring = true;
    return g;
  },
  scarf() {
    const g = new THREE.Group();
    const knit = std('#ff8a5c', { roughness: 0.95 });
    const ring = mesh(new THREE.TorusGeometry(1, 0.085, 12, 48), knit);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const stripe = std('#fff1d6', { roughness: 0.95 });
    const r2 = mesh(new THREE.TorusGeometry(1.002, 0.087, 12, 48, 0.25), stripe);
    r2.rotation.x = Math.PI / 2;
    g.add(r2);
    const tail = mesh(new RoundedBoxGeometry(0.2, 0.42, 0.07, 2, 0.03), knit, 0.45, -0.22, 0.9);
    tail.rotation.z = 0.25;
    g.add(tail);
    g.userData.ring = true;
    return g;
  },
  beret() {
    const g = new THREE.Group();
    const felt = std('#e2506d', { roughness: 0.9 });
    const top = mesh(new THREE.SphereGeometry(0.42, 24, 12), felt);
    top.scale.set(1, 0.32, 1);
    g.add(top);
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.08, 8), felt, 0, 0.15, 0));
    g.rotation.z = -0.25;
    return g;
  },
  party() {
    const g = new THREE.Group();
    const c = mesh(new THREE.ConeGeometry(0.2, 0.5, 24), phys('#8fd0ff', { roughness: 0.4 }), 0, 0.25, 0);
    g.add(c);
    const dots = std('#ffe680');
    for (let i = 0; i < 6; i++) { const a = i * 1.05; const y = 0.08 + (i % 3) * 0.12; const r = 0.2 * (1 - y / 0.5) + 0.005; g.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), dots, Math.cos(a) * r, y, Math.sin(a) * r)); }
    g.add(mesh(new THREE.SphereGeometry(0.06, 12, 10), std('#ff6fa3'), 0, 0.52, 0));
    return g;
  },
  crown() {
    const g = new THREE.Group();
    const gold = std('#ffcf4a', { metalness: 0.85, roughness: 0.25 });
    const band = mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.12, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#ffcf4a', metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide }));
    g.add(band);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      const sp = mesh(new THREE.ConeGeometry(0.05, 0.14, 8), gold, Math.cos(a) * 0.24, 0.12, Math.sin(a) * 0.24);
      g.add(sp);
      g.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), phys(['#ff6fa3', '#8fd0ff', '#9ee6a0', '#b9a3ff', '#ffffff'][i]), Math.cos(a) * 0.255, 0.0, Math.sin(a) * 0.255));
    }
    g.rotation.z = 0.12;
    return g;
  },
};

export const HELPER_MAKERS = {
  feather: () => feather(),
  bubbles: bubbleWand,
  garden: () => planter(0),
  slimeling: () => slimeling(),
  musicbox: musicBox,
  lamp: moonLamp,
  fountain,
  observatory: telescope,
  spa,
  rainbow: () => rainbowArch(0.4, 0.035),
};

// Cached food models, cloned on demand (clones share geometry and materials).
const foodCache = {};
export function makeFood(id) {
  if (!foodCache[id]) foodCache[id] = FOOD_MAKERS[id]();
  return foodCache[id].clone();
}

// Render every model to a transparent PNG data URL for the DOM.
export function renderIcons(renderer, env, entries) {
  const size = 192, outSize = 112;
  const out = {};
  const rt = new THREE.WebGLRenderTarget(size, size);
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffd6c4', 0.9));
  const key = new THREE.DirectionalLight('#ffffff', 1.7);
  key.position.set(1.5, 2.5, 2.5);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
  const big = document.createElement('canvas');
  big.width = big.height = size;
  const bctx = big.getContext('2d');
  const img = bctx.createImageData(size, size);
  const small = document.createElement('canvas');
  small.width = small.height = outSize;
  const sctx = small.getContext('2d');
  const buf = new Uint8Array(size * size * 4);
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const l = i / 255;
    const s = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
    lut[i] = Math.round(Math.min(1, s) * 255);
  }
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevTarget = renderer.getRenderTarget();
  const box = new THREE.Box3(), sphere = new THREE.Sphere();
  for (const [id, obj, rot] of entries) {
    const holder = new THREE.Group();
    holder.add(obj);
    if (rot) holder.rotation.set(rot[0], rot[1], rot[2] || 0);
    scene.add(holder);
    holder.updateMatrixWorld(true);
    box.setFromObject(holder);
    box.getBoundingSphere(sphere);
    const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 0.86;
    cam.position.set(sphere.center.x, sphere.center.y + dist * 0.18, sphere.center.z + dist);
    cam.lookAt(sphere.center);
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const s = ((size - 1 - y) * size + x) * 4, t = (y * size + x) * 4;
        d[t] = lut[buf[s]]; d[t + 1] = lut[buf[s + 1]]; d[t + 2] = lut[buf[s + 2]]; d[t + 3] = buf[s + 3];
      }
    }
    bctx.putImageData(img, 0, 0);
    sctx.clearRect(0, 0, outSize, outSize);
    sctx.drawImage(big, 0, 0, outSize, outSize);
    out[id] = small.toDataURL('image/png');
    scene.remove(holder);
  }
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  rt.dispose();
  return out;
}
