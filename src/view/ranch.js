// The ranch: a grassy hill behind the nursery where grown-up slimes live, hop around and
// make pearls. Seen small and hazy from the nursery; the camera flies over to visit.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SlimeAvatar } from './slime.js';
import { setMedalPin } from './medal-pin.js';
import { residentMedal } from '../core/medals.js';
import { STAGES } from '../data/content.js';
import { Egg } from './egg.js';
import { addEggSpark } from './egg-spark.js';

export const RANCH_POS = new THREE.Vector3(0, 0, -24);
export const RANCH_SCALE = 0.8;  // the whole ranch is built in local units and shrunk a little
export const RANCH_TOP = 1.3;      // height of the meadow
const R_TOP = 7.4;                 // radius of the flat meadow
const FENCE_R = 6.9;
const GATE = 0.3;                  // half-angle of the gate gap (faces the nursery)
const GROWN = STAGES.length - 1;   // residents are grown up (shape number m = 1)
const RESIDENT_LOD = 2;            // residents you are not visiting reshape every 2nd frame while you watch the ranch
const ROAM = 5.6;                  // how far residents wander from the middle
const TAU = Math.PI * 2;

const PAL = {
  day: {
    grass: ['#a8de80', '#93cf6c', '#b9e893'], side: '#98cf74', tuft: ['#86c95f', '#73b950', '#a3db82'],
    wood: '#f2d1a2', barn: '#ff9fa0', roof: '#b97480', trim: '#fff7f0', pond: '#8fd6ff', rim: '#f6e3bd',
    trunk: '#b58060', leaves: ['#8fd36f', '#ffbad3', '#a7e38b', '#ffd59a'], flowers: ['#ff9cc4', '#fff4a8', '#ffffff', '#d4b8ff', '#ffc08a'],
    stone: '#f3e4cc', pondGlow: 0.12, nursery: '#ffe7a6', nurseryRoof: '#8fcfc0', straw: '#e8c47a', windowGlow: 0,
  },
  night: {
    grass: ['#4f7d73', '#446e66', '#5a8a7f'], side: '#46736a', tuft: ['#3f6b62', '#365e57', '#4d7d72'],
    wood: '#a98f86', barn: '#b9708a', roof: '#6e4a63', trim: '#d8cde6', pond: '#3d5fa8', rim: '#8e86a8',
    trunk: '#6f5562', leaves: ['#4f7f6c', '#a0709a', '#5b8a73', '#9c8670'], flowers: ['#d38ab5', '#e8e0a0', '#e6e6ff', '#a995e0', '#d9a07a'],
    stone: '#9a90aa', pondGlow: 0.3, nursery: '#bfa98a', nurseryRoof: '#4f7f7a', straw: '#9c8a6a', windowGlow: 0.9,
  },
};
// The Nursery: a little cottage with a straw nest out front where bred eggs wait (front left of the meadow,
// clear of the barn, the pond, the trees, the gate path and the Pearl Basket).
const NURSERY = { x: -2.7, z: 3.1, rot: 0.7 };

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function grassTexture(cols) {
  const t = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = cols[0]; x.fillRect(0, 0, w, h);
    let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 260; i++) {
      x.fillStyle = i % 2 ? cols[1] : cols[2];
      x.globalAlpha = 0.35;
      x.beginPath(); x.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 40, 6 + rnd() * 24, rnd() * 3, 0, TAU); x.fill();
    }
    x.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

function weaveTexture() {
  const t = canvasTex(256, 64, (x, w, h) => {
    x.fillStyle = '#d9a866'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 16; c++) {
      x.fillStyle = (r + c) % 2 ? '#c48f4f' : '#e8bd7c';
      x.fillRect(c * 16 + 1, r * 16 + 2, 14, 12);
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

function signTexture(text) {
  return canvasTex(512, 128, (x, w, h) => {
    x.fillStyle = '#f7dcb0'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#c99a63'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8);
    x.fillStyle = '#7a4b2e'; x.font = '700 64px "Baloo 2", "Nunito", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + 4);
  });
}

export function pearlMaterial(color = '#ffffff') {
  const c = new THREE.Color('#fff8f2').lerp(new THREE.Color(color), 0.45);
  return new THREE.MeshPhysicalMaterial({
    color: c, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1,
    iridescence: 1, iridescenceIOR: 1.7, sheen: 1, sheenColor: new THREE.Color('#ffe2f0'), emissive: c, emissiveIntensity: 0.08,
  });
}
const PEARL_GEO = new THREE.SphereGeometry(0.12, 20, 14);
let SPARK_TEX = null;
function sparkTexture() {
  if (SPARK_TEX) return SPARK_TEX;
  SPARK_TEX = canvasTex(64, 64, (x) => {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(255,255,255,0.95)';
    x.beginPath(); x.moveTo(32, 2); x.lineTo(35, 29); x.lineTo(62, 32); x.lineTo(35, 35); x.lineTo(32, 62); x.lineTo(29, 35); x.lineTo(2, 32); x.lineTo(29, 29); x.closePath(); x.fill();
  });
  return SPARK_TEX;
}

// Blocked spots on the meadow (barn, pond, trees, basket, Nursery).
const OBSTACLES = [
  { x: -3.8, z: -3.0, r: 1.7 }, { x: 3.5, z: -1.2, r: 1.6 },
  { x: -0.8, z: -5.6, r: 0.8 }, { x: 2.4, z: -5.0, r: 0.8 }, { x: 5.2, z: -3.4, r: 0.7 }, { x: -5.6, z: 0.6, r: 0.7 },
  { x: 2.3, z: 5.0, r: 0.8 }, { x: NURSERY.x, z: NURSERY.z, r: 1.35 },
  // the Nursery's front yard stays clear, so the close-up camera can see the nest
  { x: NURSERY.x + Math.sin(NURSERY.rot + 0.25) * 2.2, z: NURSERY.z + Math.cos(NURSERY.rot + 0.25) * 2.2, r: 1.0 },
];
const blocked = (x, z, pad = 0) => OBSTACLES.some(o => (x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + pad) ** 2) || x * x + z * z > ROAM * ROAM;

export class RanchView {
  constructor(scene, { quality = 'high' } = {}) {
    this.scene = scene;
    this.quality = quality;
    this.group = new THREE.Group();
    this.group.position.copy(RANCH_POS);
    this.group.scale.setScalar(RANCH_SCALE);
    scene.add(this.group);
    this.orbit = 0;          // camera angle around the ranch while visiting (swipe to turn)
    this.mats = {};
    this.residents = new Map();
    this.pearls = [];
    this.time = 0;
    this.visiting = false;
    this.slow = 0;
    this.v = new THREE.Vector3();
    this.build();
    this.setTheme(false);
  }

  // ---------- building the scenery ----------
  build() {
    const g = this.group, M = this.mats;
    const std = (k, o = {}) => (M[k] = new THREE.MeshStandardMaterial({ roughness: 0.8, ...o }));

    // the hill: sides blend from the floor color into grass
    const prof = [[R_TOP + 3.4, 0], [R_TOP + 2.5, 0.22], [R_TOP + 1.3, 0.78], [R_TOP + 0.45, 1.16], [R_TOP, RANCH_TOP]].map(([r, y]) => new THREE.Vector2(r, y));
    const hill = new THREE.LatheGeometry(prof, 72);
    const cols = new Float32Array(hill.attributes.position.count * 3);
    hill.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.hillGeo = hill;
    std('hill', { vertexColors: true, roughness: 1 });
    g.add(new THREE.Mesh(hill, M.hill));
    std('grass', { roughness: 1 });
    const top = new THREE.Mesh(new THREE.CircleGeometry(R_TOP + 0.02, 72), M.grass);
    top.rotation.x = -Math.PI / 2; top.position.y = RANCH_TOP;
    g.add(top);
    this.hitHill = new THREE.Mesh(new THREE.CylinderGeometry(R_TOP + 1, R_TOP + 3, RANCH_TOP + 1.2, 24), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitHill.position.y = (RANCH_TOP + 1.2) / 2;
    g.add(this.hitHill);

    // grass tufts and flowers (instanced, cheap)
    let seed = 21; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const spot = (pad) => { for (let k = 0; k < 40; k++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * (R_TOP - 0.4); const x = Math.sin(a) * r, z = Math.cos(a) * r; if (!OBSTACLES.some(o => (x - o.x) ** 2 + (z - o.z) ** 2 < (o.r * 0.7 + pad) ** 2)) return [x, z]; } return [0, 0]; };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    std('tuft', { roughness: 1 });
    const blades = [];
    for (let k = 0; k < 3; k++) {
      const b = new THREE.ConeGeometry(0.022, 0.2, 3);
      b.translate(0, 0.1, 0); b.rotateZ((k - 1) * 0.35); b.rotateY(k * 2.1);
      blades.push(b);
    }
    const tufts = new THREE.InstancedMesh(mergeGeometries(blades), M.tuft, 320);
    this.tuftColors = [];
    for (let i = 0; i < 320; i++) {
      const [x, z] = spot(0.1);
      q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4));
      sc.setScalar(0.7 + rnd() * 0.8);
      tufts.setMatrixAt(i, m4.compose(p.set(x, RANCH_TOP - 0.01, z), q, sc));
      this.tuftColors.push(i % 3);
    }
    this.tufts = tufts;
    g.add(tufts);
    std('flower', { roughness: 0.6 });
    const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 8, 6), M.flower, 90);
    this.flowerIdx = [];
    for (let i = 0; i < 90; i++) {
      const [x, z] = spot(0.2);
      flowers.setMatrixAt(i, m4.compose(p.set(x, RANCH_TOP + 0.07, z), q.identity(), sc.set(1, 0.6, 1)));
      this.flowerIdx.push(i % 5);
    }
    this.flowers = flowers;
    g.add(flowers);

    // fence with a gate facing the nursery
    std('wood', { roughness: 0.75 });
    const posts = [];
    const n = 44;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      const d = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      if (d < GATE) continue;
      posts.push(a);
    }
    const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.66, 0.13), M.wood, posts.length + 2);
    posts.forEach((a, i) => postMesh.setMatrixAt(i, m4.compose(p.set(Math.sin(a) * FENCE_R, RANCH_TOP + 0.33, Math.cos(a) * FENCE_R), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), sc.set(1, 1, 1))));
    for (const [k, side] of [[0, -1], [1, 1]]) {
      const a = side * GATE;
      postMesh.setMatrixAt(posts.length + k, m4.compose(p.set(Math.sin(a) * FENCE_R, RANCH_TOP + 0.6, Math.cos(a) * FENCE_R), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), sc.set(1.4, 1.8, 1.4)));
    }
    g.add(postMesh);
    for (const h of [0.26, 0.5]) {
      const geo = new THREE.TorusGeometry(FENCE_R, 0.035, 6, 140, TAU - GATE * 2);
      geo.rotateZ(Math.PI / 2 + GATE);
      geo.rotateX(Math.PI / 2);
      const rail = new THREE.Mesh(geo, M.wood);
      rail.position.y = RANCH_TOP + h;
      g.add(rail);
    }
    // gate sign
    this.signMat = new THREE.MeshStandardMaterial({ map: signTexture('Slime Ranch'), roughness: 0.8 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.62, 0.08), [M.wood, M.wood, M.wood, M.wood, this.signMat, M.wood]);
    sign.position.set(0, RANCH_TOP + 1.38, FENCE_R + 0.02);
    g.add(sign);
    this.sign = sign;

    // stepping stones from the gate
    std('stone', { roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.32 - i * 0.02, 0.34, 0.06, 14), M.stone);
      s.position.set(Math.sin(i * 1.7) * 0.25, RANCH_TOP + 0.02, FENCE_R - 0.6 - i * 0.85);
      s.scale.z = 0.75;
      g.add(s);
    }

    // barn
    const barn = new THREE.Group();
    std('barn', { roughness: 0.7 }); std('roof', { roughness: 0.6 }); std('trim', { roughness: 0.6 });
    const walls = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.15, 1.5), M.barn);
    walls.position.y = 0.575;
    const roofShape = new THREE.Shape([new THREE.Vector2(-1.15, 0), new THREE.Vector2(1.15, 0), new THREE.Vector2(0, 0.8)]);
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 1.75, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 }), M.roof);
    roof.position.set(0, 1.12, -0.875);
    const gable = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.95, 0), new THREE.Vector2(0.95, 0), new THREE.Vector2(0, 0.66)])), M.barn);
    gable.position.set(0, 1.15, 0.751);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.8, 0.04), M.roof);
    door.position.set(0, 0.4, 0.76);
    const trimX = new THREE.Group();
    for (const r of [0.83, -0.83]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.03), M.trim); b.rotation.z = r; trimX.add(b); }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.92, 0.02), M.trim);
    frame.position.set(0, 0.46, 0.745);
    trimX.position.set(0, 0.4, 0.785);
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), M.trim);
    win.position.set(0, 1.42, 0.765);
    barn.add(walls, roof, gable, frame, door, trimX, win);
    barn.position.set(-3.8, RANCH_TOP, -3.0);
    barn.rotation.y = 0.65;
    g.add(barn);

    // pond with lily pads
    std('pond', { roughness: 0.08, metalness: 0.1 }); std('rim', { roughness: 0.9 });
    const rim = new THREE.Mesh(new THREE.CircleGeometry(1.48, 40), M.rim);
    rim.rotation.x = -Math.PI / 2; rim.scale.y = 0.72; rim.position.set(3.5, RANCH_TOP + 0.012, -1.2);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(1.26, 40), M.pond);
    pond.rotation.x = -Math.PI / 2; pond.scale.y = 0.7; pond.position.set(3.5, RANCH_TOP + 0.022, -1.2);
    g.add(rim, pond);
    const padMat = new THREE.MeshStandardMaterial({ color: '#6fbf5a', roughness: 0.6 });
    for (const [x, z, r] of [[3.1, -1.0, 0.24], [3.9, -1.45, 0.18]]) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(r, 18, 0.3, TAU - 0.5), padMat);
      pad.rotation.x = -Math.PI / 2; pad.position.set(x, RANCH_TOP + 0.03, z);
      g.add(pad);
    }
    const lotus = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffb0d0', roughness: 0.5 }));
    lotus.scale.y = 0.7; lotus.position.set(3.1, RANCH_TOP + 0.08, -1.0);
    g.add(lotus);

    // trees
    std('trunk', { roughness: 0.9 });
    this.canopies = [];
    for (const [x, z, s, ci] of [[-0.8, -5.6, 1.1, 0], [2.4, -5.0, 0.95, 1], [5.2, -3.4, 0.8, 2], [-5.6, 0.6, 0.85, 3]]) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 1.0, 8), M.trunk);
      trunk.position.y = 0.5;
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true });
      this.canopies.push({ mat, ci });
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), mat);
      crown.position.y = 1.35;
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), mat);
      puff.position.set(0.36, 1.12, 0.12);
      tree.add(trunk, crown, puff);
      tree.position.set(x, RANCH_TOP, z);
      tree.scale.setScalar(s);
      g.add(tree);
    }

    // soft blob shadows under the big things
    const shTex = canvasTex(64, 64, (x) => { const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(40,60,30,0.35)'); gr.addColorStop(1, 'rgba(40,60,30,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); });
    const shMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false });
    for (const [x, z, r] of [[-3.8, -3.0, 1.6], [-0.8, -5.6, 0.9], [2.4, -5.0, 0.8], [5.2, -3.4, 0.7], [-5.6, 0.6, 0.7]]) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.4, r * 2.4), shMat);
      sh.rotation.x = -Math.PI / 2; sh.position.set(x, RANCH_TOP + 0.015, z);
      g.add(sh);
    }

    // the Pearl Basket
    const basket = new THREE.Group();
    const bprof = [[0.0, 0.0], [0.3, 0.0], [0.34, 0.04], [0.42, 0.3], [0.46, 0.34], [0.44, 0.37], [0.4, 0.33]].map(([r, y]) => new THREE.Vector2(r, y));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(bprof, 28), new THREE.MeshStandardMaterial({ map: weaveTexture(), roughness: 0.9, side: THREE.DoubleSide }));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: '#c48f4f', roughness: 0.9 }));
    handle.position.y = 0.34;
    basket.add(bowl, handle);
    this.basketPearls = [];
    const bpm = pearlMaterial('#ffd6ec');
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(PEARL_GEO, bpm);
      const layer = i < 6 ? 0 : i < 10 ? 1 : 2;
      const a = i * 2.4, r = [0.22, 0.13, 0.04][layer];
      m.position.set(Math.cos(a) * r, 0.14 + layer * 0.09, Math.sin(a) * r);
      m.scale.setScalar(0.9);
      m.visible = false;
      basket.add(m);
      this.basketPearls.push(m);
    }
    // it sits on a little wooden crate so it doesn't sink into the grass
    const crate = new THREE.Group();
    const plank = new THREE.MeshStandardMaterial({ color: '#d9a46b', roughness: 0.85 });
    const crateBox = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.16, 0.86), plank);
    crateBox.position.y = 0.08;
    crate.add(crateBox);
    const slat = new THREE.MeshStandardMaterial({ color: '#b98350', roughness: 0.85 });
    for (const z of [-0.3, 0, 0.3]) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.03, 0.08), slat); sl.position.set(0, 0.165, z); crate.add(sl); }
    crate.position.set(2.3, RANCH_TOP, 5.0);
    crate.rotation.y = -0.4;
    g.add(crate);
    const bsh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), shMat);
    bsh.rotation.x = -Math.PI / 2; bsh.position.set(2.3, RANCH_TOP + 0.016, 5.0);
    g.add(bsh);
    basket.position.set(2.3, RANCH_TOP + 0.18, 5.0);
    basket.rotation.y = -0.4;
    basket.scale.setScalar(1.15);
    g.add(basket);
    this.basket = basket;
    this.basketHit = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.basketHit.position.y = 0.25;
    basket.add(this.basketHit);
    this.basketSparkle = 0;

    this.buildNursery();
  }

  // The Nursery: a butter-yellow cottage with a mint roof, a heart window that glows at night, and a straw
  // nest out front where bred eggs wait. Everything sits on a low stone step so nothing z-fights the grass.
  buildNursery() {
    const M = this.mats, g = this.group;
    const std = (k, o = {}) => (M[k] = new THREE.MeshStandardMaterial({ roughness: 0.8, ...o }));
    std('nursery', { roughness: 0.75 }); std('nurseryRoof', { roughness: 0.6 }); std('straw', { roughness: 1 });
    const hut = new THREE.Group();
    const step = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.1, 0.08, 28), M.stone);
    step.scale.set(1, 1, 0.82); step.position.y = 0.04;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.82, 0.95), M.nursery);
    walls.position.y = 0.08 + 0.41;
    const roofShape = new THREE.Shape([new THREE.Vector2(-0.82, 0), new THREE.Vector2(0.82, 0), new THREE.Vector2(0, 0.62)]);
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 1.15, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 }), M.nurseryRoof);
    roof.position.set(0, 0.88, -0.575);
    const gable = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.62, 0), new THREE.Vector2(0.62, 0), new THREE.Vector2(0, 0.47)])), M.nursery);
    gable.position.set(0, 0.9, 0.476);
    // an arched door with a trim frame
    const arch = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0); return s; };
    const frame = new THREE.Mesh(new THREE.ShapeGeometry(arch(0.46, 0.6), 12), M.trim);
    frame.position.set(-0.22, 0.08, 0.477);
    const door = new THREE.Mesh(new THREE.ShapeGeometry(arch(0.36, 0.53), 12), M.nurseryRoof);
    door.position.set(-0.22, 0.08, 0.479);
    // round window with a heart; it glows warm at night
    const heartTex = canvasTex(128, 128, (x, w, h) => {
      x.fillStyle = '#fff4dc'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ff8fb0';
      x.beginPath(); x.moveTo(64, 98); x.bezierCurveTo(10, 62, 30, 18, 64, 44); x.bezierCurveTo(98, 18, 118, 62, 64, 98); x.fill();
    });
    M.window = new THREE.MeshStandardMaterial({ map: heartTex, emissiveMap: heartTex, emissive: '#ffd08a', emissiveIntensity: 0, roughness: 0.5 });
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), M.window);
    win.position.set(0.3, 0.6, 0.478);
    const winRim = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.19, 24), M.trim);
    winRim.position.set(0.3, 0.6, 0.477);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.2), new THREE.MeshStandardMaterial({ map: signTexture('Nursery'), roughness: 0.8 }));
    sign.position.set(0, 1.06, 0.482);
    hut.add(step, walls, roof, gable, frame, door, win, winRim, sign);
    // the nest: a straw ring with a soft bed inside, beside the door
    const nest = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.11, 10, 28), M.straw);
    ring.rotation.x = Math.PI / 2; ring.scale.set(1.25, 1, 0.75); ring.position.y = 0.1;
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.08, 24), M.straw);
    bed.scale.set(1.2, 1, 1); bed.position.y = 0.06;
    nest.add(bed, ring);
    nest.position.set(0.38, 0.02, 0.95);
    hut.add(nest);
    this.nest = nest;
    hut.position.set(NURSERY.x, RANCH_TOP, NURSERY.z);
    hut.rotation.y = NURSERY.rot;
    g.add(hut);
    this.nursery = hut;
    this.nurseryHit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 2.3), new THREE.MeshBasicMaterial({ visible: false }));
    this.nurseryHit.position.set(0.1, 0.72, 0.4);
    hut.add(this.nurseryHit);
    this.nestEggs = new Map();
  }

  // Show the eggs waiting in the Nursery in the nest (two spots). eggs: [{ id, spark, colors }]
  setNursery(eggs) {
    const keep = new Set(eggs.map(e => e.id));
    for (const [id, n] of this.nestEggs) if (!keep.has(id)) { n.spark && n.spark.dispose(); this.nest.remove(n.egg.group); this.nestEggs.delete(id); }
    eggs.forEach((e, i) => {
      let n = this.nestEggs.get(e.id);
      if (!n) {
        const egg = new Egg({ colors: e.colors });
        egg.group.scale.setScalar(0.28);
        egg.group.rotation.y = -0.5 + i * 0.9;
        this.nest.add(egg.group);
        n = { egg, spark: e.spark ? addEggSpark(egg, { night: this.dark }) : null };
        this.nestEggs.set(e.id, n);
      }
      n.egg.group.position.set(eggs.length > 1 ? (i ? 0.17 : -0.17) : 0, 0.07, i ? -0.04 : 0.04);
      n.ready = !!e.ready;
    });
  }

  setTheme(dark, floor = dark ? '#3a2d58' : '#e9bdb6') {
    const p = dark ? PAL.night : PAL.day, M = this.mats;
    this.dark = dark;
    if (M.grass.map) M.grass.map.dispose();
    M.grass.map = grassTexture(p.grass); M.grass.needsUpdate = true;
    const pos = this.hillGeo.attributes.position, col = this.hillGeo.attributes.color;
    const a = new THREE.Color(floor), b = new THREE.Color(p.side), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { c.copy(a).lerp(b, Math.min(1, Math.pow(pos.getY(i) / RANCH_TOP, 0.7))); col.setXYZ(i, c.r, c.g, c.b); }
    col.needsUpdate = true;
    const tc = p.tuft.map(x => new THREE.Color(x));
    this.tuftColors.forEach((k, i) => this.tufts.setColorAt(i, tc[k]));
    this.tufts.instanceColor.needsUpdate = true;
    const fc = p.flowers.map(x => new THREE.Color(x));
    this.flowerIdx.forEach((k, i) => this.flowers.setColorAt(i, fc[k]));
    this.flowers.instanceColor.needsUpdate = true;
    for (const k of ['wood', 'barn', 'roof', 'trim', 'pond', 'rim', 'trunk', 'stone', 'nursery', 'nurseryRoof', 'straw']) M[k].color.set(p[k]);
    M.pond.emissive.set(p.pond).multiplyScalar(p.pondGlow);
    M.window.emissiveIntensity = p.windowGlow;
    for (const cn of this.canopies) cn.mat.color.set(p.leaves[cn.ci]);
    for (const r of this.residents.values()) r.av.cap.on = dark && r.state === 'nap';
    for (const n of this.nestEggs.values()) n.spark && n.spark.setNight(dark);
  }

  setName(text) {
    if (this.signMat.map) this.signMat.map.dispose();
    this.signMat.map = signTexture(text);
    this.signMat.needsUpdate = true;
  }

  // ---------- residents ----------
  // list: [{ id, name, traits, form: { id }, worn }]
  sync(list) {
    const keep = new Set(list.map(d => d.id));
    for (const [id, r] of this.residents) {
      if (!keep.has(id) && r.state !== 'leave') { this.group.remove(r.holder); this.residents.delete(id); }
    }
    for (const d of list) {
      if (this.residents.has(d.id)) continue;
      const av = new SlimeAvatar({ quality: this.quality, lite: true });
      av.setRecipe(d, { instant: true });   // its own body (breed, variant, mix, genes), grown up
      av.setStage(GROWN, 1, true);
      av.setTraits(d.traits || {});
      av.color.copy(av.targetColor);
      if (d.form) av.setForm(d.form.id, { pure: d.form.pure });
      if (d.worn) av.setOutfits(d.worn);
      setMedalPin(av, residentMedal(d));
      av.size = av.sizeTarget = 0.86;
      const holder = new THREE.Group();
      holder.add(av.root);
      let x = 0, z = 0;
      for (let k = 0; k < 30; k++) { x = (Math.random() - 0.5) * 2 * ROAM; z = (Math.random() - 0.5) * 2 * ROAM; if (!blocked(x, z, 0.6)) break; }
      holder.position.set(x, RANCH_TOP, z);
      holder.rotation.y = Math.random() * TAU;
      this.group.add(holder);
      this.residents.set(d.id, { id: d.id, data: d, av, holder, state: 'idle', timer: 1 + Math.random() * 3, target: new THREE.Vector3(), heading: holder.rotation.y, hopT: 0, happyT: 0 });
    }
  }

  resident(id) { return this.residents.get(id); }

  // a resident reacts to a tap: a happy squish and hearts (the game adds sound and fx)
  pet(id) {
    const r = this.residents.get(id);
    if (!r) return null;
    r.av.squish(0.8);
    r.av.hop(3);
    r.happyT = 2.2;
    r.state = 'idle'; r.timer = 2.5;
    r.av.cap.on = false;
    return r;
  }

  // ---------- pearls ----------
  spawnPearl(id, color) {
    const r = this.residents.get(id);
    if (!r || this.pearls.length > 40) return null;
    const m = new THREE.Mesh(PEARL_GEO, pearlMaterial(color || '#' + r.av.mat.color.getHexString()));
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTexture(), color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    spark.scale.setScalar(0.4);
    spark.position.set(0.05, 0.08, 0.05);
    m.add(spark);
    const start = r.av.headTopWorld(new THREE.Vector3());
    this.group.worldToLocal(start);
    m.position.copy(start);
    const a = Math.random() * TAU;
    const pearl = { mesh: m, spark, vel: new THREE.Vector3(Math.sin(a) * 1.2, 3.2, Math.cos(a) * 1.2), landed: false, t: 0, id };
    r.av.squish(0.6);
    this.group.add(m);
    this.pearls.push(pearl);
    return pearl;
  }

  removePearl(p) {
    this.group.remove(p.mesh);
    this.pearls = this.pearls.filter(x => x !== p);
  }
  clearPearls() { for (const p of this.pearls) this.group.remove(p.mesh); this.pearls = []; }
  pearlWorld(p, out) { return p.mesh.getWorldPosition(out); }
  basketWorld(out) { return this.basket.getWorldPosition(out).add(new THREE.Vector3(0, 0.35, 0)); }

  // A resident hops out through the gate to its new home, then disappears.
  leave(id, onDone) {
    const r = this.residents.get(id);
    if (!r) { onDone && onDone(); return; }
    r.state = 'leave';
    r.target.set(0, RANCH_TOP, FENCE_R + 1.2);
    r.timer = 14;
    r.onGone = onDone;
    r.av.cap.on = false;
  }

  setBasket(stored, cap) {
    const n = stored <= 0 ? 0 : Math.max(1, Math.round(Math.min(1, stored / Math.max(1, cap)) * this.basketPearls.length));
    this.basketPearls.forEach((m, i) => { m.visible = i < n; });
    this.basketFull = stored >= cap && cap > 0;
  }

  // ---------- picking ----------
  pick(raycaster) {
    const hits = [];
    for (const p of this.pearls) { const h = raycaster.intersectObject(p.mesh, false)[0]; if (h) hits.push({ type: 'pearl', pearl: p, d: h.distance - 0.3 }); }
    for (const r of this.residents.values()) { const h = r.av.hit(raycaster); if (h) hits.push({ type: 'slime', id: r.id, point: h.point, d: h.distance }); }
    const b = raycaster.intersectObject(this.basketHit, false)[0];
    if (b) hits.push({ type: 'basket', d: b.distance });
    const nh = raycaster.intersectObject(this.nurseryHit, false)[0];
    if (nh) hits.push({ type: 'nursery', d: nh.distance + 0.5 });
    if (!hits.length) {
      const h = raycaster.intersectObject(this.hitHill, false)[0];
      if (h) hits.push({ type: 'ranch', point: h.point, d: h.distance });
    }
    hits.sort((a, b2) => a.d - b2.d);
    return hits[0] || null;
  }

  // camera spot for visiting: orbit around the middle; portrait screens step back and widen the lens
  cameraFor(aspect, outPos, outLook) {
    const portrait = aspect < 0.9;
    const d = portrait ? 12 + (0.9 - aspect) * 9 : 18.5;
    const hgt = portrait ? d * 0.95 : 9.5;
    const top = RANCH_TOP * RANCH_SCALE;
    outPos.set(RANCH_POS.x + Math.sin(this.orbit) * d, top + hgt, RANCH_POS.z + Math.cos(this.orbit) * d);
    // portrait: aim a little low so the meadow sits above the bottom panel
    outLook.set(RANCH_POS.x, top + (portrait ? -1.2 : 0.2), RANCH_POS.z + (portrait ? 1.2 : 0));
    return portrait ? 42 : 32;
  }

  // close-up camera on one resident (tap to visit it): seen from the middle of the meadow,
  // so the camera stays inside the fence; the resident turns to face it.
  cameraNear(id, aspect, outPos, outLook) {
    const r = this.residents.get(id);
    if (!r) return null;
    const p = r.holder.getWorldPosition(this.v);
    const portrait = aspect < 0.9;
    const d = portrait ? 4.4 : 3.6;
    let dx = RANCH_POS.x - p.x, dz = RANCH_POS.z - p.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.8) { dx = Math.sin(this.orbit); dz = Math.cos(this.orbit); } else { dx /= len; dz /= len; }
    outPos.set(p.x + dx * d, p.y + (portrait ? 2.2 : 1.6), p.z + dz * d);
    outLook.set(p.x, p.y + (portrait ? 0.1 : 0.45), p.z);
    r.faceTo = Math.atan2(dx, dz);
    return portrait ? 40 : 30;
  }

  // close-up camera on the Nursery: in front of the cottage, a little to the side, so the door, the sign
  // and the nest all show; the game centers the look point in the free part of the screen
  cameraNursery(aspect, outPos, outLook) {
    const p = this.nursery.getWorldPosition(this.v);
    const portrait = aspect < 0.9;
    const a = NURSERY.rot + 0.25, d = portrait ? 5.6 : 4.4;
    outLook.set(p.x + Math.sin(NURSERY.rot) * 0.35, p.y + 0.45, p.z + Math.cos(NURSERY.rot) * 0.35);
    outPos.set(outLook.x + Math.sin(a) * d, outLook.y + (portrait ? 2.4 : 1.8), outLook.z + Math.cos(a) * d);
    return portrait ? 38 : 30;
  }

  // ---------- frame ----------
  update(dt, camera) {
    this.time += dt;
    const t = this.time;
    for (const n of this.nestEggs.values()) {
      // a ready egg gives a little wiggle now and then
      if (n.ready && Math.sin(t * 1.7 + n.egg.time) > 0.995) n.egg.wobV += 2.5;
      n.egg.update(dt, this.scene);
    }
    // far away: think and animate at a lower rate
    let step = dt;
    if (!this.visiting) {
      this.slow += dt;
      if (this.slow < 0.1) { this.updatePearls(dt); return; }
      step = this.slow; this.slow = 0;
    }
    for (const r of this.residents.values()) this.think(r, step, camera);
    this.updatePearls(dt);
    const pulse = this.basketFull ? 0.5 + 0.5 * Math.sin(t * 4) : 0;
    this.basket.scale.setScalar(1.15 * (1 + pulse * 0.05));
  }

  think(r, dt, camera) {
    const av = r.av, h = r.holder;
    r.timer -= dt;
    r.happyT -= dt;
    av.inner.visible = this.visiting;
    // while you watch the ranch, only the slime you are visiting reshapes every frame and shows its bubbles (far away
    // it is already slow)
    av.lod = this.visiting && this.focusId !== r.id ? RESIDENT_LOD : 1;
    if (r.happyT > 0) { Object.assign(av.expr, { eyes: 'happy', mouth: 'open', blush: 0.9 }); }
    else if (r.state === 'nap') Object.assign(av.expr, { eyes: 'sleep', mouth: 'smile', blush: 0.4 });
    else Object.assign(av.expr, { eyes: 'normal', mouth: 'smile', blush: 0.4 });
    av.lookTarget = this.visiting && r.happyT > 0 && camera ? camera.position : null;

    // while the player is looking at another resident, step out of the camera's way
    if (this.focusId && this.focusId !== r.id && camera && r.state !== 'walk') {
      const f = this.residents.get(this.focusId);
      if (f) {
        const fp = f.holder.position, cp = this.group.worldToLocal(this.v.copy(camera.position));
        const ax = cp.x - fp.x, az = cp.z - fp.z, len2 = ax * ax + az * az || 1;
        const k = Math.max(0, Math.min(1, ((h.position.x - fp.x) * ax + (h.position.z - fp.z) * az) / len2));
        const ex = fp.x + ax * k - h.position.x, ez = fp.z + az * k - h.position.z;
        if (ex * ex + ez * ez < 1.6 * 1.6) {
          const sx = -az, sz = ax, sl = Math.hypot(sx, sz) || 1, side = (sx * -ex + sz * -ez) >= 0 ? 1 : -1;
          const tx = h.position.x + sx / sl * side * 2.2, tz = h.position.z + sz / sl * side * 2.2;
          if (!blocked(tx, tz, 0.4)) { r.target.set(tx, RANCH_TOP, tz); r.state = 'walk'; r.timer = 6; }
        }
      }
    }
    if (this.focusId === r.id) {
      r.state = 'idle'; r.timer = Math.max(r.timer, 1);
      if (r.faceTo !== undefined) { let dh = r.faceTo - r.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); r.heading += dh * Math.min(1, dt * 4); h.rotation.y = r.heading; }
      av.lookTarget = camera ? camera.position : null;
    }
    if (r.state === 'idle' && r.timer <= 0) {
      const roll = Math.random();
      if (this.dark && roll < 0.55) { r.state = 'nap'; r.timer = 8 + Math.random() * 10; av.cap.on = true; av.breathRate = 1.2; }
      else if (roll < 0.75) {
        for (let k = 0; k < 20; k++) {
          const a = Math.random() * TAU, d = 1.2 + Math.random() * 2.4;
          const x = h.position.x + Math.sin(a) * d, z = h.position.z + Math.cos(a) * d;
          if (!blocked(x, z, 0.5)) { r.target.set(x, RANCH_TOP, z); r.state = 'walk'; r.timer = 10; break; }
        }
        if (r.state !== 'walk') r.timer = 1;
      } else if (roll < 0.88) { av.hop(4.5); av.spin(Math.random() < 0.5 ? -1 : 1); r.timer = 2 + Math.random() * 2; }
      else { r.timer = 2 + Math.random() * 4; av.kick(0.04); }
    }
    if (r.state === 'nap' && r.timer <= 0) { r.state = 'idle'; r.timer = 1; av.cap.on = false; av.breathRate = 2.1; }
    if (r.state === 'leave') {
      const dx = r.target.x - h.position.x, dz = r.target.z - h.position.z;
      const dist = Math.hypot(dx, dz);
      r.heading = Math.atan2(dx, dz); h.rotation.y = r.heading;
      r.hopT -= dt;
      if (av.hopY <= 0 && r.hopT <= 0) { av.hop(4); r.hopT = 0.15; }
      if (av.hopY > 0) { const sp = Math.min(dist, 2.2 * dt); h.position.x += Math.sin(r.heading) * sp; h.position.z += Math.cos(r.heading) * sp; }
      Object.assign(av.expr, { eyes: 'happy', mouth: 'open', blush: 0.8 });
      if (dist < 0.3 || r.timer <= 0) {
        av.sizeTarget = 0.001;
        if (av.size < 0.05 || r.timer <= -1.5) { this.group.remove(h); this.residents.delete(r.id); r.onGone && r.onGone(); return; }
      }
      av.update(dt);
      return;
    }
    if (r.state === 'walk') {
      const dx = r.target.x - h.position.x, dz = r.target.z - h.position.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let dh = want - r.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      r.heading += dh * Math.min(1, dt * 5);
      h.rotation.y = r.heading;
      r.hopT -= dt;
      if (av.hopY <= 0 && r.hopT <= 0 && Math.abs(dh) < 0.6) { av.hop(3.4); r.hopT = 0.25; }
      if (av.hopY > 0) {
        const sp = Math.min(dist, 1.5 * dt);
        h.position.x += Math.sin(r.heading) * sp; h.position.z += Math.cos(r.heading) * sp;
      }
      if (dist < 0.15 || r.timer <= 0) { r.state = 'idle'; r.timer = 2 + Math.random() * 5; }
    }
    av.update(dt);
  }

  updatePearls(dt) {
    for (const p of [...this.pearls]) {
      p.t += dt;
      if (!p.landed) {
        p.vel.y -= 12 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        const floor = RANCH_TOP + 0.12;
        if (p.mesh.position.y <= floor) {
          p.mesh.position.y = floor;
          if (Math.abs(p.vel.y) < 1.2) { p.landed = true; p.vel.set(0, 0, 0); }
          else { p.vel.y *= -0.35; p.vel.x *= 0.5; p.vel.z *= 0.5; }
        }
        // keep pearls inside the fence
        const r2 = Math.hypot(p.mesh.position.x, p.mesh.position.z);
        if (r2 > FENCE_R - 0.4) p.mesh.position.multiplyScalar((FENCE_R - 0.4) / r2).setY(p.mesh.position.y);
      } else if (p.t > (this.grassLife || 120) || p.rolling) {
        // nobody picked it up: it rolls over to the basket
        p.rolling = true;
        const b = this.basket.position;
        const dx = b.x - p.mesh.position.x, dz = b.z - p.mesh.position.z, d = Math.hypot(dx, dz);
        if (d < 0.25) { this.removePearl(p); continue; }
        const sp = Math.min(d, 2.5 * dt);
        p.mesh.position.x += dx / d * sp; p.mesh.position.z += dz / d * sp;
        p.mesh.position.y = RANCH_TOP + 0.12 + Math.abs(Math.sin(p.t * 9)) * 0.08;
        p.mesh.rotation.x += dt * 8;
      } else {
        p.mesh.position.y = RANCH_TOP + 0.12 + Math.sin(p.t * 2.5) * 0.02;
        p.mesh.rotation.y += dt;
        const tw = Math.max(0, Math.sin(p.t * 1.7)) ** 6;
        p.spark.material.opacity = 0.15 + 0.85 * tw;
        p.spark.scale.setScalar(0.25 + 0.3 * tw);
      }
    }
  }
}
