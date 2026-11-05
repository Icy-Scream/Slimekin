// The world around the nursery: a soft meadow instead of a flat floor, rolling hills on the
// horizon (the ranch sits in front of them), drifting clouds, flowers and grass around the play mat,
// a few trees at the sides and a moon at night. Pure decoration: nothing here is tappable.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;

const LOOK = {
  day: {
    grass: ['#a8db84', '#96cf72', '#bde69c', '#8cc76c'], hills: ['#9fd690', '#b4e29e', '#9ccf98'], far: '#c9e6c6',
    tuft: ['#7fc25c', '#93cf6f', '#6fb24f'], leaves: ['#8fd36f', '#ffbad3', '#a7e38b', '#ffd59a'], trunk: '#c08a68',
    flowers: ['#ff9cc4', '#fff4a8', '#ffffff', '#d4b8ff', '#ffc08a', '#9fd8ff'], cloud: '#ffffff', cloudGlow: 0.25,
  },
  night: {
    grass: ['#2c4a52', '#284450', '#33525a', '#25404a'], hills: ['#2a4250', '#314a5a', '#263c4a'], far: '#2e3a58',
    tuft: ['#335a5c', '#3a6264', '#2d5052'], leaves: ['#3f6a62', '#8a6a92', '#4a7468', '#8a7a6a'], trunk: '#5e4a56',
    flowers: ['#d38ab5', '#e8e0a0', '#e6e6ff', '#a995e0', '#d9a07a', '#8ab8e0'], cloud: '#6a6496', cloudGlow: 0.05,
  },
};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// soft mottled grass, tiled across the ground
function grassTexture(cols) {
  const t = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = cols[0]; x.fillRect(0, 0, w, h);
    let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 140; i++) {
      x.fillStyle = cols[1 + (i % 3)];
      x.globalAlpha = 0.28;
      const px = rnd() * w, py = rnd() * h, rx = 8 + rnd() * 26, ry = 5 + rnd() * 14, a = rnd() * 3;
      // draw wrapped so the tile repeats without seams
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { x.beginPath(); x.ellipse(px + ox, py + oy, rx, ry, a, 0, TAU); x.fill(); }
    }
    x.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(26, 26);
  t.anisotropy = 4;
  return t;
}

const softDot = (() => {
  let t = null;
  return () => t || (t = canvasTex(64, 64, (x) => {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  }));
})();

export class Scenery {
  constructor(scene, stage) {
    this.scene = scene;
    this.stage = stage;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.time = 0;
    this.build();
  }

  build() {
    const g = this.group;
    let seed = 17; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();

    // rolling hills on the horizon (behind the ranch), two rows for depth
    this.hillMats = [];
    const hillGeo = new THREE.SphereGeometry(1, 28, 12, 0, TAU, 0, Math.PI / 2);
    for (let row = 0; row < 2; row++) {
      const mat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: false });
      this.hillMats.push({ mat, row });
      const n = row ? 16 : 13;
      for (let i = 0; i < n; i++) {
        const a = (i + rnd() * 0.6) / n * TAU;
        const r = row ? 64 + rnd() * 6 : 47 + rnd() * 6;
        const hill = new THREE.Mesh(hillGeo, mat);
        hill.position.set(Math.sin(a) * r, -0.3, Math.cos(a) * r);
        hill.scale.set(10 + rnd() * 9, (row ? 7 : 4) + rnd() * (row ? 6 : 4), 8 + rnd() * 6);
        hill.rotation.y = a;
        g.add(hill);
      }
    }

    // trees and bushes at the sides (framing the scene; kept clear of the ranch behind the cushion)
    this.leafMats = [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ roughness: 0.75, flatShading: true }));
    this.trunkMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const crownGeo = new THREE.IcosahedronGeometry(1, 1), trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 8);
    const treeSpots = [[-10, -7, 1.3, 0], [11.5, -9, 1.5, 2], [-15, -15, 1.6, 1], [16, -17, 1.4, 0], [-20, -4, 1.2, 3], [21, -5, 1.3, 1], [-8.5, -19, 1.1, 2], [9, -21, 1.0, 3]];
    for (const [x, z, s, ci] of treeSpots) {
      const t = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, this.trunkMat); trunk.position.y = 0.8;
      const crown = new THREE.Mesh(crownGeo, this.leafMats[ci]); crown.position.y = 2.3; crown.scale.setScalar(1.15);
      const puff = new THREE.Mesh(crownGeo, this.leafMats[ci]); puff.position.set(0.7, 1.9, 0.2); puff.scale.setScalar(0.75);
      t.add(trunk, crown, puff);
      t.position.set(x, 0, z); t.scale.setScalar(s); t.rotation.y = rnd() * TAU;
      g.add(t);
    }
    for (const [x, z, s, ci] of [[-6.5, -5, 0.9, 2], [7, -6.5, 1.0, 0], [-7.5, 3, 0.8, 1], [8, 2, 0.85, 2]]) {
      const b = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(crownGeo, this.leafMats[(ci + k) % 4]);
        m.position.set((k - 1) * 0.65, 0.45 + (k === 1 ? 0.2 : 0), (k % 2) * 0.2);
        m.scale.setScalar(k === 1 ? 0.75 : 0.58);
        b.add(m);
      }
      b.position.set(x, 0, z); b.scale.setScalar(s);
      g.add(b);
    }

    // grass tufts and flowers around the play mat (instanced: cheap)
    const blades = [];
    for (let k = 0; k < 4; k++) { const b = new THREE.ConeGeometry(0.04, 0.34 - (k % 2) * 0.08, 3); b.translate(0, 0.16, 0); b.rotateZ((k - 1.5) * 0.3); b.rotateY(k * 1.6); blades.push(b); }
    this.tuftMat = new THREE.MeshStandardMaterial({ roughness: 1 });
    const N_TUFT = 380;
    this.tufts = new THREE.InstancedMesh(mergeGeometries(blades), this.tuftMat, N_TUFT);
    this.tuftIdx = [];
    const ringSpot = (r0, r1) => {
      for (let k = 0; k < 30; k++) {
        const a = rnd() * TAU, r = r0 + Math.sqrt(rnd()) * (r1 - r0);
        const x = Math.sin(a) * r, z = Math.cos(a) * r;
        if (z < -14 && Math.abs(x) < 9) continue;          // leave the view of the ranch clear
        return [x, z];
      }
      return [r1, 0];
    };
    // a third of them in the front band you see below the cushion on a phone
    const frontSpot = () => [(rnd() - 0.5) * 9, 4.4 + rnd() * 6];
    for (let i = 0; i < N_TUFT; i++) {
      const [x, z] = i % 3 === 0 ? frontSpot() : ringSpot(4.6, 20);
      q.setFromEuler(e.set((rnd() - 0.5) * 0.3, rnd() * TAU, (rnd() - 0.5) * 0.3));
      sc.setScalar(0.8 + rnd() * 0.9);
      this.tufts.setMatrixAt(i, m4.compose(p.set(x, 0, z), q, sc));
      this.tuftIdx.push(i % 3);
    }
    g.add(this.tufts);

    const petal = new THREE.SphereGeometry(0.06, 7, 4); petal.scale(1, 0.35, 0.6);
    const parts = [];
    for (let k = 0; k < 5; k++) { const pg = petal.clone(); pg.translate(0.07, 0, 0); pg.rotateY(k / 5 * TAU); parts.push(pg); }
    const flowerGeo = mergeGeometries(parts); flowerGeo.translate(0, 0.16, 0);
    const midGeo = new THREE.SphereGeometry(0.04, 7, 5); midGeo.translate(0, 0.17, 0);
    const stemGeo = new THREE.CylinderGeometry(0.008, 0.01, 0.16, 4); stemGeo.translate(0, 0.08, 0);
    this.flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    this.flowerMidMat = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.6 });
    this.stemMat = new THREE.MeshStandardMaterial({ color: '#6fae55', roughness: 0.8 });
    const N_FLOWER = 160;
    this.flowers = new THREE.InstancedMesh(flowerGeo, this.flowerMat, N_FLOWER);
    this.flowerMids = new THREE.InstancedMesh(midGeo, this.flowerMidMat, N_FLOWER);
    this.stems = new THREE.InstancedMesh(stemGeo, this.stemMat, N_FLOWER);
    this.flowerIdx = [];
    for (let i = 0; i < N_FLOWER; i++) {
      // clusters: a few near each other read nicer than an even sprinkle
      const [x, z] = i % 3 === 0 ? frontSpot() : ringSpot(4.7, 14);
      q.setFromEuler(e.set((rnd() - 0.5) * 0.25, rnd() * TAU, (rnd() - 0.5) * 0.25));
      sc.setScalar(1.1 + rnd() * 0.9);
      m4.compose(p.set(x, 0, z), q, sc);
      this.flowers.setMatrixAt(i, m4); this.flowerMids.setMatrixAt(i, m4); this.stems.setMatrixAt(i, m4);
      this.flowerIdx.push(Math.floor(rnd() * 6));
    }
    g.add(this.flowers, this.flowerMids, this.stems);

    // puffy clouds low over the hills (no fog on them, so they stay crisp in the distance)
    this.cloudMat = new THREE.MeshStandardMaterial({ roughness: 1, fog: false, emissive: '#ffffff' });
    this.clouds = [];
    const puffGeo = new THREE.IcosahedronGeometry(1, 2);
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Group();
      const n = 4 + Math.floor(rnd() * 3);
      // the puffs of one cloud are merged into one mesh (one draw call per cloud)
      const puffs = [];
      for (let k = 0; k < n; k++) {
        const s = k === 0 ? 1.6 : 0.8 + rnd() * 0.7;
        const pg = puffGeo.clone();
        pg.scale(s * 1.2, s * 0.8, s);
        pg.translate((k - n / 2) * 1.3 + rnd() * 0.4, (k === 0 ? 0.4 : 0) + rnd() * 0.5, rnd() * 0.6);
        puffs.push(pg);
      }
      c.add(new THREE.Mesh(mergeGeometries(puffs), this.cloudMat));
      const z = -62 - rnd() * 14;
      c.position.set(-45 + i * 15 + rnd() * 6, 7 + rnd() * 4.5, z);
      c.scale.setScalar(1 + rnd() * 0.6);
      c.userData.speed = 0.25 + rnd() * 0.3;
      g.add(c);
      this.clouds.push(c);
    }

    // the moon (night only)
    this.moon = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40), new THREE.MeshBasicMaterial({ color: '#fff4cf', fog: false }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: '#fff0c0', transparent: true, opacity: 0.55, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(13);
    const crater = new THREE.MeshBasicMaterial({ color: '#f0e2b8', fog: false });
    for (const [x, y, r] of [[-0.6, 0.5, 0.45], [0.7, -0.3, 0.35], [0.1, -0.9, 0.25]]) {
      const c = new THREE.Mesh(new THREE.CircleGeometry(r, 20), crater); c.position.set(x, y, 0.01); this.moon.add(c);
    }
    this.moon.add(glow, disc);
    this.moon.position.set(9, 13, -78);
    this.moon.lookAt(0, 3, 10);
    g.add(this.moon);
  }

  // The classic look turns the whole meadow off (the floor goes back to the plain nursery color).
  setEnabled(on) {
    this.enabled = !!on;
    this.setTheme(!!this.stage.dark);
  }

  // Recolor for day or night; also sets the ground's grass texture.
  setTheme(dark) {
    const L = dark ? LOOK.night : LOOK.day;
    const fm = this.stage.floorMat;
    if (fm.map) { fm.map.dispose(); fm.map = null; }
    this.group.visible = this.enabled !== false;
    if (this.enabled !== false) { fm.map = grassTexture(L.grass); fm.color.set('#ffffff'); }
    fm.needsUpdate = true;
    for (const h of this.hillMats) h.mat.color.set(L.hills[h.row]).lerp(new THREE.Color(L.far), h.row ? 0.35 : 0.1);
    this.leafMats.forEach((m, i) => m.color.set(L.leaves[i]));
    this.trunkMat.color.set(L.trunk);
    const tc = L.tuft.map(c => new THREE.Color(c));
    this.tuftIdx.forEach((k, i) => this.tufts.setColorAt(i, tc[k]));
    this.tufts.instanceColor.needsUpdate = true;
    const fc = L.flowers.map(c => new THREE.Color(c));
    this.flowerIdx.forEach((k, i) => this.flowers.setColorAt(i, fc[k]));
    this.flowers.instanceColor.needsUpdate = true;
    this.cloudMat.color.set(L.cloud);
    this.cloudMat.emissive.set(L.cloud).multiplyScalar(L.cloudGlow);
    this.moon.visible = dark;
  }

  update(dt) {
    this.time += dt;
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 55) c.position.x = -55;
    }
  }
}
