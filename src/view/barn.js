// The Barn: the ranch screen. One resident at a time sits on the round show stand in the barn aisle; swipe (or tap
// ‹ ›) and the burrow swap plays: it wiggles, sinks into the straw nest, a poof of straw and hay dust, and the next
// resident pops up. The camera never moves, and the burrow never shows two slimes at once, so the barn draws ONE
// slime: the stand's avatar is dressed as the next resident while it is hidden under the straw.
// The barn was modelled and lit in Blender outside this repo and baked into src/assets/barn/ (format 2, the same as the
// Greenhouse room: barn.json + barn.bin, two floor textures), so the phone only draws its light. Live here: the sky
// through the doors, the stars, the lantern and bulb glows, the basket's glow and fireflies at night, the day/night
// blend, the straw (one instanced mesh), the hay dust, the sparkles, the Nursery's nest, the pearls and the slime.
// Nothing baked is tappable; the slime, the pearls, the basket and the nest are. Numbers: BARN in content.js; the
// plain math (the pose curve, the order, the card, the spots): view/barn-math.js.
import * as THREE from 'three';
import { BARN, STAGES, RANCH } from '../data/content.js';
import { SlimeAvatar } from './slime.js';
import { setMedalPin } from './medal-pin.js';
import { residentMedal } from '../core/medals.js';
import { Egg } from './egg.js';
import { addEggSpark } from './egg-spark.js';
import { pearlMaterial, PEARL_GEO, sparkTexture } from './ranch.js';
import { poseAt, springAt, clipOn, fadeAt, basketSpot } from './barn-math.js';

const BASE = new URL('../assets/barn/', import.meta.url);
const SKY_R = 110;   // the sky dome follows the camera, inside its far plane (the stage keeps far = 120)
const GROWN = STAGES.length - 1;
const PEARL_SCALE = 0.8;   // the meadow ranch draws its pearls at its own scale (0.8): the same size here
const S2L = 'vec3 s2l(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }';
const VERT = `
attribute vec3 colDay; attribute vec3 colNight;
uniform float uNight;
varying vec3 vCol;
#include <fog_pars_vertex>
${S2L}
void main(){
  vCol = mix(s2l(colDay), s2l(colNight), uNight);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = `
varying vec3 vCol;
#include <fog_pars_fragment>
void main(){
  gl_FragColor = vec4(vCol, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const FLOOR_VERT = `
varying vec2 vUv;
#include <fog_pars_vertex>
void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FLOOR_FRAG = `
uniform sampler2D tDay, tNight; uniform float uNight;
varying vec2 vUv;
#include <fog_pars_fragment>
void main(){
  gl_FragColor = vec4(mix(texture2D(tDay, vUv).rgb, texture2D(tNight, vUv).rgb, uNight), 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const HAY = ['#d9b45a', '#e8c66a', '#f3dc8c', '#c9a24e', '#f6e39e'];
const NIGHT_STRAW = new THREE.Color(0.5, 0.4, 0.32);
const DUST_AT = [[0, 0.55, 0.2], [-0.6, 0.45, 0.1], [0.62, 0.5, 0.15], [-0.25, 0.9, 0.5], [0.3, 1.0, 0.45], [0, 1.25, 0.3]];
const SPARK_AT = [[[-0.95, 1.5, 0.45], 0.32], [[0.92, 1.78, 0.5], 0.26], [[0.18, 2.05, 0.6], 0.2], [[-0.55, 1.98, 0.7], 0.16], [[1.12, 1.15, 0.55], 0.18], [[-1.15, 0.95, 0.5], 0.16]];
const NEST_DAY = '#e3bf6e', NEST_NIGHT = '#8f7a58';

const noRay = o => { o.raycast = () => {}; return o; };
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = p => 1 - (1 - p) * (1 - p);
function canvasTex(n, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class BarnView {
  // stage: the game's Stage (its renderer clips the sinking slime; its lights take the barn's slime light)
  constructor(stage, { quality = 'high' } = {}) {
    this.stage = stage;
    this.scene = stage.scene;
    this.quality = quality;
    this.group = new THREE.Group();
    this.group.name = 'barn';
    this.group.visible = false;
    this.ready = false;
    this.failed = false;
    this.loading = null;
    this.meta = null;
    this.U = { uNight: { value: 0 } };
    this.target = 0;
    this.glows = [];
    this.flies = [];
    this.time = 0;
    this.clock = 0;          // the swap's clock (a test can hold it and step it by hand)
    this.hold = false;
    this.loadMs = 0;
    this.light = { hemi: [new THREE.Color(), new THREE.Color(), 1], key: [new THREE.Color(), 1], rim: [new THREE.Color(), 1], env: 0.5 };
    this.fog = { color: new THREE.Color(), near: 40, far: 320 };
    this.sw = { on: false, t: 0, kind: 'burrow', worn: false, b1: false, b2: false };
    this.land = -9;          // when the slime last landed (the landing spring)
    this.empty = true;       // nobody on the stand
    this.res = { id: null, happyT: 0, timer: 3, nap: false };
    this.pearls = [];
    this.nestEggs = new Map();
    this.onWear = null;      // the swap puts the next resident on (the coordinator dresses it): () => void
    this.onLanded = null;    // the swap is over: () => void
  }

  // Loads the barn once. Resolves true when it is ready, false when it could not load (offline on the very first run,
  // or a copy of the game that does not carry the barn's files): the ranch stays the meadow ranch (logged once).
  load() {
    if (!this.loading) {
      const t0 = performance.now();
      this.loading = this.build().then(() => {
        this.ready = true;
        this.loadMs = Math.round(performance.now() - t0);
        return true;
      }, e => {
        this.failed = true;
        console.warn('Barn: the barn could not load, the meadow ranch stays for now.', e && e.message ? e.message : e);
        return false;
      });
    }
    return this.loading;
  }

  async build() {
    const get = async (name, kind) => {
      const res = await fetch(new URL(name, BASE));
      if (!res.ok) throw new Error(`${name}: ${res.status}`);
      return kind === 'json' ? res.json() : res.arrayBuffer();
    };
    const [meta, bin] = await Promise.all([get('barn.json', 'json'), get('barn.bin', 'bin')]);
    if (meta.format !== 2) throw new Error('unknown barn format ' + meta.format);
    const loader = new THREE.TextureLoader();
    const tex = name => new Promise((res, rej) => loader.load(new URL(name, BASE).href, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }, undefined, () => rej(new Error(name))));
    const [floorDay, floorNight] = await Promise.all([tex('floor_day.jpg'), tex('floor_night.jpg')]);
    this.meta = meta;
    const chunk = (name, Type) => { const [o, n] = meta.chunks[name]; return new Type(bin, o, n / Type.BYTES_PER_ELEMENT); };
    const shared = m => { m.uniforms.uNight = this.U.uNight; return m; };
    const placeQ = m => { m.position.set(...meta.qbox.center); m.scale.set(...meta.qbox.half); return m; };
    // straw, bunting and grass are thin: the barn draws both sides (as the test page)
    const baked = (geo, fog = true, side = THREE.DoubleSide) => noRay(new THREE.Mesh(geo, shared(new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uNight: { value: 0 } }]), vertexShader: VERT, fragmentShader: FRAG, fog, toneMapped: false, side,
    }))));
    const g = this.group;
    for (const { name } of meta.room_chunks) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(chunk(name + '.pos', Int16Array), 3, true));
      geo.setAttribute('colDay', new THREE.BufferAttribute(chunk(name + '.day', Uint8Array), 3, true));
      geo.setAttribute('colNight', new THREE.BufferAttribute(chunk(name + '.night', Uint8Array), 3, true));
      geo.setIndex(new THREE.BufferAttribute(chunk(name + '.idx', Uint16Array), 1));
      const m = placeQ(baked(geo));
      m.frustumCulled = false;
      g.add(m);
    }
    {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(chunk('floor.pos', Int16Array), 3, true));
      geo.setAttribute('uv', new THREE.BufferAttribute(chunk('floor.uv', Float32Array), 2));
      geo.setIndex(new THREE.BufferAttribute(chunk('floor.idx', Uint16Array), 1));
      const m = noRay(new THREE.Mesh(geo, shared(new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tDay: { value: null }, tNight: { value: null }, uNight: { value: 0 } }]),
        vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG, fog: true, toneMapped: false,
      }))));
      m.material.uniforms.tDay.value = floorDay;
      m.material.uniforms.tNight.value = floorNight;
      m.frustumCulled = false;
      g.add(placeQ(m));
    }
    // the sky through the big doors and the hay door: the Blender sky's colors by elevation, day and night per point
    const skyGeo = new THREE.SphereGeometry(SKY_R, 48, 24);
    const skyCols = stops => {
      const pos = skyGeo.attributes.position, out = new Uint8Array(pos.count * 3), c = new THREE.Color(), c2 = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const el = Math.asin(THREE.MathUtils.clamp(pos.getY(i) / SKY_R, -1, 1)) * 180 / Math.PI;
        let k = 0;
        while (k < stops.length - 2 && el > stops[k + 1][0]) k++;
        const [e0, h0] = stops[k], [e1, h1] = stops[k + 1];
        c.set(h0).lerp(c2.set(h1), THREE.MathUtils.clamp((el - e0) / (e1 - e0), 0, 1)).multiplyScalar(meta.expo).convertLinearToSRGB();
        out[i * 3] = c.r * 255; out[i * 3 + 1] = c.g * 255; out[i * 3 + 2] = c.b * 255;
      }
      return out;
    };
    skyGeo.setAttribute('colDay', new THREE.BufferAttribute(skyCols(meta.sky.day), 3, true));
    skyGeo.setAttribute('colNight', new THREE.BufferAttribute(skyCols(meta.sky.night), 3, true));
    this.sky = baked(skyGeo, false, THREE.BackSide);
    this.sky.material.depthWrite = false;
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    g.add(this.sky);
    // stars (night), seen through the doors at the far end
    {
      const n = 160, p = new Float32Array(n * 3), R = SKY_R * 0.97;
      let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < n; i++) {
        const az = (rnd() - 0.5) * 0.5, el = (4 + rnd() * 40) * Math.PI / 180;
        p[i * 3] = Math.sin(az) * Math.cos(el) * R; p[i * 3 + 1] = Math.sin(el) * R; p[i * 3 + 2] = -Math.cos(az) * Math.cos(el) * R;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.starMat = new THREE.PointsMaterial({ color: '#fff6d8', size: 2.2, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false, opacity: 0 });
      this.stars = noRay(new THREE.Points(geo, this.starMat));
      this.stars.frustumCulled = false;
      this.stars.renderOrder = -9;
      g.add(this.stars);
    }
    // glows: additive halos and point clouds, no lights (the barn's own light is baked); only drawn at night
    this.dotTex = canvasTex(64, (x, n) => { const gr = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, n, n); });
    const halo = (pos, color, size) => {
      const m = new THREE.SpriteMaterial({ map: this.dotTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
      const s = noRay(new THREE.Sprite(m));
      s.position.set(...pos); s.scale.setScalar(size); s.renderOrder = 3; s.visible = false;
      g.add(s);
      this.glows.push({ s, m, phase: Math.random() * 6.28 });
    };
    for (const p of meta.lanterns || []) if (p) { halo(p, '#ffb24a', 2.0); halo(p, '#ffe2a8', 0.6); }
    const dots = (list, world) => {
      const n = list.length, geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(list.flatMap(d => d.pos)), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const mat = new THREE.PointsMaterial({ map: this.dotTex, vertexColors: true, size: world, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
      const pts = noRay(new THREE.Points(geo, mat));
      pts.frustumCulled = false; pts.renderOrder = 3; pts.visible = false;
      g.add(pts);
      return { pts, mat, world, base: list.map(d => new THREE.Color(d.color)), phase: list.map((_, i) => (i * 2.399) % 6.283) };
    };
    const BULB = ['#ffd98a', '#ffc2d6', '#bfe8ff'];
    this.bulbs = dots((meta.bulbs || []).map((p, i) => ({ pos: p, color: BULB[i % 3] })), 0.24);
    this.pearlGlow = dots(meta.pearls.filter((_, i) => i % 4 === 0).map(p => ({ pos: p, color: '#e6dcff' })), 0.32);
    {
      let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 22; i++) this.flies.push({ home: new THREE.Vector3(-4 + rnd() * 8, 0.4 + rnd() * 2.2, meta.room.z_end - 2 - rnd() * 14), ph: rnd() * 6.28, sp: 0.3 + rnd() * 0.4 });
      this.fly = dots(this.flies.map(f => ({ pos: f.home.toArray(), color: '#d8ff8a' })), 0.18);
    }
    this.buildStraw();
    this.buildStand();
    this.buildNest();
    this.buildBasket();
    this.scene.add(g);
  }

  // ---------- straw, hay dust and sparkles ----------
  buildStraw() {
    const N = BARN.straw.high.strips;
    this.strawMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, toneMapped: false, fog: false });
    const straw = noRay(new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.strawMat, N));
    straw.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    straw.frustumCulled = false;
    const cols = HAY.map(h => new THREE.Color(h)), Z = new THREE.Matrix4().makeScale(0, 0, 0);
    this.P = [];
    for (let i = 0; i < N; i++) { straw.setColorAt(i, cols[i % cols.length]); straw.setMatrixAt(i, Z); this.P.push({ live: false }); }
    this.straw = straw;
    this.nextP = 0;
    this.Z = Z;
    this.group.add(straw);
    this.setQuality(this.quality);
    this.puffTex = canvasTex(128, (x, n) => { const gr = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, n, n); });
    this.starTex = canvasTex(64, (x, n) => { x.translate(n / 2, n / 2); x.fillStyle = '#fff';
      for (const [L, w] of [[n * 0.48, n * 0.06], [n * 0.28, n * 0.045]]) for (let k = 0; k < 2; k++) { x.save(); x.rotate(k * Math.PI / 2 + (L < n * 0.4 ? Math.PI / 4 : 0)); x.beginPath(); x.moveTo(-L, 0); x.quadraticCurveTo(0, w, L, 0); x.quadraticCurveTo(0, -w, -L, 0); x.fill(); x.restore(); }
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, n * 0.16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(-n / 2, -n / 2, n, n); });
    this.dust = DUST_AT.map((c, k) => {
      const m = new THREE.SpriteMaterial({ map: this.puffTex, color: '#e2c27c', transparent: true, depthWrite: false, opacity: 0, fog: false });
      const sp = noRay(new THREE.Sprite(m)); sp.position.set(...c); sp.renderOrder = 4; sp.visible = false;
      this.group.add(sp);
      return { sp, m, k, t0: 0 };
    });
    this.sparks = SPARK_AT.map(([c, sz]) => {
      const m = new THREE.SpriteMaterial({ map: this.starTex, color: '#fff3b0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
      const sp = noRay(new THREE.Sprite(m)); sp.position.set(...c); sp.renderOrder = 5; sp.visible = false;
      this.group.add(sp);
      return { sp, m, sz, t0: 0 };
    });
    this._m = new THREE.Matrix4(); this._x = new THREE.Vector3(); this._y = new THREE.Vector3(); this._z = new THREE.Vector3(); this._c = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }
  // Graphics quality: Low draws half the straw and the slime in one pass (no see-through second pass).
  setQuality(q) {
    this.quality = q;
    if (this.straw) this.straw.count = (q === 'low' ? BARN.straw.low : BARN.straw.high).strips;
    if (this.av) this.av.setQuality(q);
  }
  // n strips fly from a ring r0..r1 around the stand's middle at height y0: outward at s0..s1, up at u0..u1, a little
  // toward the camera; they tumble, land and fade (the test page's numbers)
  burst(t0, n, r0, r1, y0, s0, s1, u0, u1, toward, g = -8, drag = 1.4, fade = [0.3, 0.5]) {
    const N = this.straw.count, rnd = (a, b) => a + Math.random() * (b - a);
    for (let k = 0; k < n; k++) {
      const p = this.P[this.nextP]; this.nextP = (this.nextP + 1) % N;
      const a = rnd(0, 6.283), rr = rnd(r0, r1);
      const c0 = new THREE.Vector3(Math.cos(a) * rr, y0, -Math.sin(a) * rr);
      const aa = a + (Math.random() - 0.5) * 0.9, sp = rnd(s0, s1);
      const v = new THREE.Vector3(Math.cos(aa) * sp, rnd(u0, u1), -Math.sin(aa) * sp * 0.75 + toward * Math.random());
      const A = 0.5 * g, B = v.y, C = c0.y - 0.012;
      Object.assign(p, { live: true, t0, c0, v, g, drag, fade, a0: rnd(0, 6.28), wa: rnd(-22, 22), e0: rnd(-0.7, 0.7), we: rnd(-20, 20),
        L: rnd(0.14, 0.34), W: 0.042, tl: (-B - Math.sqrt(Math.max(B * B - 4 * A * C, 0))) / (2 * A) });
    }
  }
  updateStraw(t) {
    const st = this.straw, standR = this.meta.room.stand_r - 0.05, top = this.meta.room.stand_top - 0.1;
    let any = false;
    for (let i = 0; i < st.count; i++) {
      const p = this.P[i];
      if (!p.live) continue;
      any = true;
      const dt = t - p.t0;
      if (dt < 0) { st.setMatrixAt(i, this.Z); continue; }
      const te = Math.min(dt, p.tl), hx = (1 - Math.exp(-p.drag * te)) / p.drag, c = this._c;
      c.set(p.c0.x + p.v.x * hx, p.c0.y + p.v.y * te + 0.5 * p.g * te * te, p.c0.z + p.v.z * hx);
      c.y = Math.max(c.y, Math.hypot(c.x, c.z) < standR ? top : 0.012);
      const landed = dt >= p.tl;
      const a = p.a0 + p.wa * te, e = landed ? 0.05 : p.e0 + p.we * te;
      const k = THREE.MathUtils.clamp(1 - (dt - p.tl - p.fade[0]) / p.fade[1], 0, 1);
      if (k <= 0) { p.live = false; st.setMatrixAt(i, this.Z); continue; }
      const X = this._x.set(Math.cos(a) * Math.cos(e), Math.sin(e), -Math.sin(a) * Math.cos(e));
      const Y = this._y.crossVectors(X, this._up); if (Y.lengthSq() < 1e-6) Y.set(1, 0, 0); Y.normalize();
      const Zv = this._z.crossVectors(X, Y).normalize();
      this._m.makeBasis(X.multiplyScalar(p.L * k), Y.multiplyScalar(p.W * k), Zv).setPosition(c);
      st.setMatrixAt(i, this._m);
    }
    if (any || this.strawDirty) { st.instanceMatrix.needsUpdate = true; this.strawDirty = any; }
    st.visible = any;
  }
  liveStraw() { return this.P ? this.P.filter(p => p.live).length : 0; }

  // ---------- the stand and its slime ----------
  buildStand() {
    this.y0 = this.meta.room.stand_top;
    const av = new SlimeAvatar({ quality: this.quality });
    av.root.position.y = this.y0;
    av.size = av.sizeTarget = BARN.size;
    av.root.visible = false;
    this.group.add(av.root);
    this.av = av;
    // the clip plane: while the slime sinks, everything under the stand's top is cut, so it goes INTO the nest
    this.clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e4);
    this.clipList = [this.clip];
    this.stage.renderer.localClippingEnabled = true;
    this.applyClip(false);   // its materials get the plane now (the shader rebuild happens on load, not mid-swap)
  }
  applyClip(on) {
    this.clip.constant = on ? -(this.y0 + 0.02) : 1e4;
    this.av.root.traverse(o => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) if (m.clippingPlanes !== this.clipList) { m.clippingPlanes = this.clipList; m.needsUpdate = true; }
    });
  }
  // Put a resident on the stand: its own body, colors, traits, grown-up form, outfits and medal pin (what the meadow
  // ranch gives a resident), drawn at full quality. null: nobody (the stand is empty).
  dress(d) {
    const av = this.av, r = this.res;
    r.id = d ? d.id : null; r.happyT = 0; r.timer = 2 + Math.random() * 3; r.nap = false;
    this.empty = !d;
    if (!d) { av.root.visible = false; return; }
    av.setRecipe(d, { instant: true });
    av.setStage(GROWN, 1, true);
    av.setTraits(d.traits || {});
    av.color.copy(av.targetColor);
    av.setForm(d.form ? d.form.id : null, { pure: !!(d.form && d.form.pure) });
    av.setOutfits(d.worn || {});
    setMedalPin(av, residentMedal(d));
    av.size = av.sizeTarget = BARN.size;
    av.sizeV = 0;
    av.cap.on = false; av.cap.grow = 0;
    av.breathRate = 2.1;
    av.inner.visible = true;
    av.lookTarget = null;
    this.applyClip(this.sw.on && this.sw.kind === 'burrow' && clipOn(this.sw.t));
  }
  get swapping() { return this.sw.on; }
  get standId() { return this.res.id; }
  // Start a swap (the coordinator chose who comes next; it dresses the stand in onWear). reduced: the fade instead.
  // fromEmpty: nobody is on the stand now, so the poof starts at once and the next one pops up.
  startSwap({ reduced = false, fromEmpty = false } = {}) {
    const S = BARN.swap;
    Object.assign(this.sw, { on: true, t: fromEmpty && !reduced ? S.burst1 : 0, kind: reduced ? 'fade' : 'burrow', worn: false, b1: false, b2: false });
    if (reduced) this.fadeStart();
  }
  // a resident on the stand reacts to a tap: a happy squish, a hop and hearts (the game adds sound and fx)
  pet() {
    if (this.empty) return null;
    const av = this.av;
    av.squish(0.8);
    if (!this.sw.on) av.hop(3);
    this.res.happyT = 2.2; this.res.timer = 2.5; this.res.nap = false;
    av.cap.on = false;
    return { av };
  }
  hop(power = 4, happy = 1.8) { if (this.empty || this.sw.on) return; this.av.hop(power); this.res.happyT = Math.max(this.res.happyT, happy); this.av.cap.on = false; this.res.nap = false; }

  applyPose(vis, y, sz, lean) {
    const r = this.av.root, sx = 1 / Math.sqrt(Math.max(sz, 0.2));
    r.visible = vis && !this.empty;
    r.position.y = y;
    r.scale.set(sx, sz, sx);
    r.rotation.z = -lean * Math.PI / 180;
  }
  stepSwap(dt) {
    const S = BARN.swap, sw = this.sw;
    if (sw.on && sw.kind === 'fade') {
      sw.t += dt;
      if (!sw.worn && sw.t >= S.fade / 2) { sw.worn = true; this.onWear && this.onWear(); }
      this.applyPose(true, this.y0, 1, 0);
      this.setFade(fadeAt(sw.t));
      if (sw.t >= S.fade) { sw.on = false; this.fadeEnd(); this.land = -9; this.onLanded && this.onLanded(); }
      return;
    }
    if (sw.on) {
      sw.t += dt;
      const u = sw.t, high = this.quality !== 'low', k = high ? BARN.straw.high : BARN.straw.low;
      if (!sw.b1 && u >= S.burst1) {
        sw.b1 = true;
        this.burst(this.clock + 0.01, k.burst1, 0, 0.55, 0.32, 0.9, 2.8, 2.4, 4.6, 0.6);
        for (const d of this.dust) { d.t0 = this.clock; d.sp.visible = true; }
      }
      if (!sw.worn && u >= S.wear) { sw.worn = true; this.onWear && this.onWear(); }
      if (!sw.b2 && u >= S.burst2) { sw.b2 = true; this.burst(this.clock, k.burst2, 0.2, 0.8, 0.3, 0.4, 1.4, 1.8, 3.2, 0.3); }
      const pz = poseAt(u, this.y0);
      this.applyClip(clipOn(u));
      if (pz) this.applyPose(...pz);
      else {
        sw.on = false;
        this.applyClip(false);
        this.land = this.clock - (u - S.land);
        if (!this.empty) this.sparks.forEach((s, i) => { s.t0 = this.clock + BARN.sparkle.stagger * i; s.sp.visible = true; });
        this.onLanded && this.onLanded();
      }
    }
    if (!sw.on) this.applyPose(true, this.y0, springAt(this.clock - this.land), 0);
    for (const d of this.dust) {
      if (!d.sp.visible) continue;
      const e = this.clock - d.t0, life = BARN.dust;
      if (e > life) { d.sp.visible = false; continue; }
      const gr = 0.6 + 1.3 * easeOut(Math.min(e / (life * 0.5), 1)) * (0.85 + 0.1 * (d.k % 3));
      d.sp.scale.setScalar(gr * 0.42 * 2.6);
      d.m.opacity = 0.8 * Math.pow(1 - Math.max(0, (e - life * 0.25) / (life * 0.75)), 1.5) * (1 - 0.45 * this.U.uNight.value);
    }
    for (const s of this.sparks) {
      if (!s.sp.visible) continue;
      const e = this.clock - s.t0, life = BARN.sparkle.life;
      if (e > life) { s.sp.visible = false; continue; }
      const a = e < 0 ? 0 : Math.sin(Math.PI * e / life);
      s.m.opacity = a; s.sp.scale.setScalar(s.sz * 2.2 * Math.max(a, 0.01));
    }
  }
  // Reduced motion: the slime fades out and in (every material of it, put back after)
  fadeStart() {
    this.faded = new Map();
  }
  setFade(k) {
    if (!this.faded) return;
    this.av.root.traverse(o => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        if (!this.faded.has(m)) { this.faded.set(m, { t: m.transparent, o: m.opacity }); if (!m.transparent) { m.transparent = true; m.needsUpdate = true; } }
        m.opacity = this.faded.get(m).o * k;
      }
    });
  }
  fadeEnd() {
    if (!this.faded) return;
    for (const [m, v] of this.faded) { m.opacity = v.o; if (m.transparent !== v.t) { m.transparent = v.t; m.needsUpdate = true; } }
    this.faded = null;
  }

  // the resident on the stand between swaps: expressions, a hop now and then, a nap at night (like the meadow ranch)
  think(dt, camera) {
    const r = this.res, av = this.av;
    if (this.empty) return;
    r.happyT -= dt; r.timer -= dt;
    if (r.happyT > 0) Object.assign(av.expr, { eyes: 'happy', mouth: 'open', blush: 0.9 });
    else if (r.nap) Object.assign(av.expr, { eyes: 'sleep', mouth: 'smile', blush: 0.4 });
    else Object.assign(av.expr, { eyes: 'normal', mouth: 'smile', blush: 0.4 });
    av.lookTarget = r.happyT > 0 && camera ? camera.position : null;
    if (r.nap && r.timer <= 0) { r.nap = false; av.cap.on = false; av.breathRate = 2.1; r.timer = 2; }
    if (!r.nap && r.timer <= 0 && !this.sw.on) {
      const roll = Math.random();
      if (this.night > 0.5 && roll < 0.4) { r.nap = true; r.timer = 8 + Math.random() * 10; av.cap.on = true; av.breathRate = 1.2; }
      else if (roll < 0.62) { av.hop(4.5); av.spin(Math.random() < 0.5 ? -1 : 1); r.timer = 3 + Math.random() * 3; }
      else if (roll < 0.82) { av.kick(0.04); r.timer = 2 + Math.random() * 4; }
      else r.timer = 2 + Math.random() * 4;
    }
  }

  // ---------- the Nursery's nest (front left) and the Pearl Basket (front right, baked) ----------
  buildNest() {
    const n = BARN.nest, s = n.r / 0.52;
    this.nestMat = new THREE.MeshStandardMaterial({ color: NEST_DAY, roughness: 1 });
    const nest = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.11, 10, 28), this.nestMat);
    ring.rotation.x = Math.PI / 2; ring.scale.set(1.1, 1, 0.9); ring.position.y = 0.1;
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.08, 24), this.nestMat);
    bed.position.y = 0.05;
    nest.add(bed, ring);
    nest.scale.setScalar(s);
    nest.position.set(n.x, 0.012, n.z);
    nest.rotation.y = 0.3;
    nest.visible = false;
    this.nestHit = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.nestHit.position.y = 0.25;
    nest.add(this.nestHit);
    this.nest = nest;
    this.group.add(nest);
  }
  // The eggs waiting in the Nursery, in the nest (two spots); the nest shows only while there are eggs.
  setNursery(eggs) {
    if (!this.nest) return;
    const keep = new Set(eggs.map(e => e.id));
    for (const [id, n] of this.nestEggs) if (!keep.has(id)) { n.spark && n.spark.dispose(); this.nest.remove(n.egg.group); this.nestEggs.delete(id); }
    eggs.forEach((e, i) => {
      let n = this.nestEggs.get(e.id);
      if (!n) {
        const egg = new Egg({ colors: e.colors });
        egg.group.scale.setScalar(0.3);
        egg.group.rotation.y = -0.5 + i * 0.9;
        this.nest.add(egg.group);
        n = { egg, spark: e.spark ? addEggSpark(egg, { night: this.night > 0.5 }) : null };
        this.nestEggs.set(e.id, n);
      }
      n.egg.group.position.set(eggs.length > 1 ? (i ? 0.17 : -0.17) : 0, 0.06, i ? -0.04 : 0.04);
      n.ready = !!e.ready;
    });
    this.nest.visible = eggs.length > 0;
  }
  buildBasket() {
    const b = basketSpot(this.meta.pearls);
    this.basketAt = new THREE.Vector3(b.x, b.y, b.z);
    this.basketHit = new THREE.Mesh(new THREE.SphereGeometry(BARN.basket.r, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.basketHit.position.set(b.x, b.y + 0.08, b.z);
    this.group.add(this.basketHit);
    // the bake has the basket heaped with pearls; live pearls on top of the heap show how full it is
    const top = [...this.meta.pearls].sort((p, q) => q[1] - p[1]).slice(0, BARN.basket.shown);
    const m = new THREE.InstancedMesh(PEARL_GEO, pearlMaterial('#ffd6ec'), top.length);
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(0.62, 0.62, 0.62), p = new THREE.Vector3();
    top.forEach((t, i) => m.setMatrixAt(i, mx.compose(p.set(t[0], t[1] + 0.07, t[2]), q, sc)));
    m.count = 0;
    noRay(m);
    m.frustumCulled = false;
    this.basketPearls = m;
    this.basketMax = top.length;
    this.group.add(m);
    this.fill = 0;
  }
  setBasket(stored, cap) {
    this.fill = cap > 0 ? Math.min(1, stored / cap) : 0;
    if (!this.basketPearls) return;
    this.basketPearls.count = stored <= 0 ? 0 : Math.max(1, Math.round(this.fill * this.basketMax));
  }
  basketWorld(out) { return out.copy(this.basketAt).add(new THREE.Vector3(0, 0.35, 0)); }
  nestWorld(out) { return this.nest.getWorldPosition(out); }

  // ---------- pearls on the straw ----------
  // A pearl made while you watch: from the slime on the stand (out of its head), or from a resident in its stall (it
  // pops out beside the stand); it lands on the straw around the stand, clear of the basket and the nest. color: its
  // maker's color.
  spawnPearl(onStand, color) {
    if (this.pearls.length > 40) return null;
    const m = new THREE.Mesh(PEARL_GEO, pearlMaterial(color));
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTexture(), color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    spark.scale.setScalar(0.4);
    spark.position.set(0.05, 0.08, 0.05);
    m.add(spark);
    m.scale.setScalar(PEARL_SCALE);
    const start = new THREE.Vector3();
    if (onStand && !this.empty) this.av.headTopWorld(start);
    else { const a = (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 0.5); start.set(Math.sin(a) * 1.05, 0.55, -Math.abs(Math.cos(a)) * 0.5); }
    m.position.copy(start);
    // where it lands: in the stand's straw ring in front of the slime (BARN.pearlRing), apart from the other pearls
    const ring = BARN.pearlRing;
    let tx = 0, tz = ring.r[0];
    for (let k = 0; k < 20; k++) {
      const a = (Math.random() * 2 - 1) * ring.arc * Math.PI / 180, r = ring.r[0] + Math.random() * (ring.r[1] - ring.r[0]);
      tx = Math.sin(a) * r; tz = Math.cos(a) * r;
      if (!this.pearls.some(o => Math.hypot(o.tx - tx, o.tz - tz) < 0.22)) break;
    }
    const T = 0.75, g = 12, floor = this.floorAt(tx, tz);
    const vel = new THREE.Vector3((tx - start.x) / T, (floor - start.y + 0.5 * g * T * T) / T, (tz - start.z) / T);
    const pearl = { mesh: m, spark, vel, landed: false, t: 0, floor, tx, tz };
    if (onStand && !this.empty) this.av.squish(0.6);
    this.group.add(m);
    this.pearls.push(pearl);
    return pearl;
  }
  // the height a pearl rests at: on the stand's straw, or on the barn floor
  floorAt(x, z) { const R = this.meta.room; return (Math.hypot(x, z) < R.stand_r - 0.04 ? R.stand_top + 0.05 : 0.012) + 0.12 * PEARL_SCALE; }
  removePearl(p) { this.group.remove(p.mesh); this.pearls = this.pearls.filter(x => x !== p); }
  clearPearls() { for (const p of this.pearls) this.group.remove(p.mesh); this.pearls = []; }
  pearlWorld(p, out) { return p.mesh.getWorldPosition(out); }
  updatePearls(dt) {
    const room = this.meta.room, life = RANCH.grassLife;
    for (const p of [...this.pearls]) {
      p.t += dt;
      const pos = p.mesh.position;
      if (!p.landed) {
        p.vel.y -= 12 * dt;
        pos.addScaledVector(p.vel, dt);
        if (pos.y <= p.floor) {
          pos.y = p.floor;
          // it stays where it fell in the straw (it bounces straight up, a little)
          p.vel.x = p.vel.z = 0;
          if (Math.abs(p.vel.y) < 1.2) { p.landed = true; p.vel.set(0, 0, 0); }
          else p.vel.y *= -0.35;
        }
        pos.x = THREE.MathUtils.clamp(pos.x, -room.aisle_half + 0.2, room.aisle_half - 0.2);
      } else if (p.t > life || p.rolling) {
        // nobody picked it up: it rolls over to the basket
        p.rolling = true;
        const b = this.basketAt, dx = b.x - pos.x, dz = b.z - pos.z, d = Math.hypot(dx, dz);
        if (d < 0.25) { this.removePearl(p); continue; }
        const sp = Math.min(d, 2.5 * dt);
        pos.x += dx / d * sp; pos.z += dz / d * sp;
        p.floor += (this.floorAt(pos.x, pos.z) - p.floor) * Math.min(1, dt * 10);   // (off the stand's edge, down to the floor)
        pos.y = p.floor + Math.abs(Math.sin(p.t * 9)) * 0.08;
        p.mesh.rotation.x += dt * 8;
      } else {
        pos.y = p.floor + Math.sin(p.t * 2.5) * 0.02;
        p.mesh.rotation.y += dt;
        const tw = Math.max(0, Math.sin(p.t * 1.7)) ** 6;
        p.spark.material.opacity = 0.15 + 0.85 * tw;
        p.spark.scale.setScalar(0.25 + 0.3 * tw);
      }
    }
  }

  // ---------- picking ----------
  // What a tap hits: a pearl, the slime on the stand (not mid-swap), the basket or the nest (null: the barn itself).
  pick(raycaster) {
    const hits = [];
    for (const p of this.pearls) { const h = raycaster.intersectObject(p.mesh, false)[0]; if (h) hits.push({ type: 'pearl', pearl: p, d: h.distance - 0.3 }); }
    if (!this.empty && !this.sw.on) { const h = this.av.hit(raycaster); if (h) hits.push({ type: 'slime', id: this.res.id, point: h.point, d: h.distance }); }
    const b = raycaster.intersectObject(this.basketHit, false)[0];
    if (b) hits.push({ type: 'basket', d: b.distance });
    if (this.nest.visible) { const n = raycaster.intersectObject(this.nestHit, false)[0]; if (n) hits.push({ type: 'nursery', d: n.distance }); }
    hits.sort((a, c) => a.d - c.d);
    return hits[0] || null;
  }

  // ---------- day and night ----------
  setNight(dark, instant = false) {
    this.target = dark ? 1 : 0;
    if (instant) this.U.uNight.value = this.target;
  }
  get night() { return this.U.uNight.value; }

  // Per frame while the barn shows: the blend, glows, fireflies, the swap, the straw, the slime, the nest, pearls.
  update(dt, camera, reduced = false) {
    if (!this.ready) return;
    this.time += dt;
    if (!this.hold) this.clock += dt;
    const U = this.U.uNight;
    U.value += (this.target - U.value) * (1 - Math.exp(-dt * BARN.blend));
    if (Math.abs(this.target - U.value) < 0.002) U.value = this.target;
    const nt = U.value, t = this.time * 1000;
    this.starMat.opacity = nt;
    this.stars.visible = nt > 0.003;
    this.strawMat.color.setRGB(1, 1, 1).lerp(NIGHT_STRAW, nt);
    this.nestMat.color.set(NEST_DAY).lerp(this._nn || (this._nn = new THREE.Color(NEST_NIGHT)), nt);
    for (const h of this.glows) {
      h.m.opacity = nt * (reduced ? 1 : 0.93 + 0.07 * Math.sin(t / 1100 + h.phase));
      h.s.visible = h.m.opacity > 0.003;
    }
    const on = nt > 0.003, tanHalf = camera ? Math.tan(camera.fov * Math.PI / 360) : 0.344;
    const basketK = 0.35 + 0.65 * this.fill;
    for (const [d, tw] of [[this.bulbs, ph => 0.75 + 0.25 * Math.sin(t / 700 + ph)], [this.pearlGlow, ph => (0.5 + 0.2 * Math.sin(t / 900 + ph)) * basketK], [this.fly, ph => Math.max(0, Math.sin(t / 600 + ph * 3)) ** 2]]) {
      d.pts.visible = on;
      if (!on) continue;
      d.mat.size = d.world / tanHalf;   // the same size on screen as a halo `world` units wide, at any lens
      const col = d.pts.geometry.attributes.color;
      d.base.forEach((c, i) => { const k = nt * (reduced ? (d === this.pearlGlow ? 0.6 * basketK : 1) : tw(d.phase[i])); col.setXYZ(i, c.r * k, c.g * k, c.b * k); });
      col.needsUpdate = true;
    }
    if (on) {
      const pos = this.fly.pts.geometry.attributes.position;
      this.flies.forEach((f, i) => { const q = t / 1000 * f.sp + f.ph; pos.setXYZ(i, f.home.x + Math.sin(q) * 0.6, f.home.y + Math.sin(q * 1.7) * 0.25, f.home.z + Math.cos(q * 0.8) * 0.6); });
      pos.needsUpdate = true;
    }
    if (camera) { this.sky.position.copy(camera.position); this.stars.position.copy(camera.position); }
    // the slime's lights and the fog follow the blend (the stage takes them, as it takes the Greenhouse's)
    const L = this.meta.slime_light, o = this.light;
    if (!this.lights) {
      const col = x => ({ hemi: [new THREE.Color(x.hemi[0]), new THREE.Color(x.hemi[1]), x.hemi[2]], key: [new THREE.Color(x.key[0]), x.key[1]], rim: [new THREE.Color(x.rim[0]), x.rim[1]], env: x.env });
      this.lights = [col(L.day), col(L.night)];
      this.fogCols = [new THREE.Color(this.meta.fog.day[0]), new THREE.Color(this.meta.fog.night[0])];
    }
    const [a, b] = this.lights;
    o.hemi[0].lerpColors(a.hemi[0], b.hemi[0], nt); o.hemi[1].lerpColors(a.hemi[1], b.hemi[1], nt); o.hemi[2] = lerp(a.hemi[2], b.hemi[2], nt);
    o.key[0].lerpColors(a.key[0], b.key[0], nt); o.key[1] = lerp(a.key[1], b.key[1], nt);
    o.rim[0].lerpColors(a.rim[0], b.rim[0], nt); o.rim[1] = lerp(a.rim[1], b.rim[1], nt);
    o.env = lerp(a.env, b.env, nt);
    const fd = this.meta.fog.day, fn = this.meta.fog.night, F = this.fog;
    F.color.lerpColors(this.fogCols[0], this.fogCols[1], nt).multiplyScalar(this.meta.expo);
    const near = lerp(fd[1], fn[1], nt), depth = lerp(fd[2], fn[2], nt), amt = lerp(fd[3], fn[3], nt);
    F.near = near; F.far = near + depth / amt;
    // the stand: the swap, the straw, the dust and sparkles, then the slime itself
    if (!this.hold) this.stepSwap(dt);
    this.updateStraw(this.clock);
    if (!this.sw.on) this.think(dt, camera);
    if (!this.empty) this.av.update(dt);
    for (const n of this.nestEggs.values()) {
      if (n.ready && Math.sin(this.time * 1.7 + n.egg.time) > 0.995) n.egg.wobV += 2.5;
      n.egg.update(dt, this.scene);
    }
    if ((nt > 0.5) !== this.eggNight) { this.eggNight = nt > 0.5; for (const n of this.nestEggs.values()) n.spark && n.spark.setNight(this.eggNight); }
    this.updatePearls(dt);
  }
  // A test drives the swap by hand: step(sec) advances the swap's clock without real time.
  step(sec) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { this.clock += 1 / 60; this.stepSwap(1 / 60); } this.updateStraw(this.clock); }

  // what the barn adds to a frame (for the report and the smoke test)
  counts() {
    if (!this.meta) return null;
    const tris = this.meta.room_chunks.reduce((s, c) => s + c.tris, 0) + this.meta.floor.tris;
    return { tris, chunks: this.meta.room_chunks.length + 1, glows: this.glows.length + this.bulbs.base.length + this.pearlGlow.base.length + this.flies.length, straw: this.straw.count, loadMs: this.loadMs };
  }
}
