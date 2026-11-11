// The Greenhouse: the cozy glass room that is the slime's home (Settings > Background > Greenhouse, the default).
// The room was modelled and lit in Blender outside this repo and baked into src/assets/greenhouse/ (format 2:
// gh.json + gh.bin, two floor textures): the light (sun, sky, bounce, soft shadows, the lantern and fairy lights) is
// painted into the room's vertex colors, day and night, so the phone only draws it. Live here: the sky through the
// glass, a faint glass sheen, the night glows (lantern, fairy bulbs, two jars, the cottage window), fireflies in the
// garden, and the day/night blend. Nothing in the room is tappable. Footprints, glow spots and the room's limits come
// from gh.json; everything tunable is GREENHOUSE in content.js.
import * as THREE from 'three';
import { GREENHOUSE } from '../data/content.js';
import { roomMeta } from './greenhouse-math.js';

const BASE = new URL('../assets/greenhouse/', import.meta.url);
const SKY_R = 110;   // the sky dome follows the camera, inside its far plane (the stage keeps far = 120)

const S2L = 'vec3 s2l(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }';
// baked vertex colors (sRGB, already exposed): drawn unlit, blended day -> night
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
// a faint sheen on the back and side panes (stronger at grazing angles), so the garden reads as behind glass
const GLASS_VERT = 'varying vec3 vN, vV, vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }';
const GLASS_FRAG = `uniform float uNight; varying vec3 vN, vV, vW;
void main(){
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
  float streak = smoothstep(0.82, 1.0, sin((vW.x + vW.y * 0.7 + vW.z * 0.7) * 1.3)) * 0.06;
  float a = 0.035 + 0.3 * f + streak;
  vec3 c = mix(vec3(0.93, 0.97, 1.0), vec3(0.55, 0.5, 0.75), uNight);
  gl_FragColor = vec4(c, a * mix(1.0, 0.6, uNight));
}`;

const noRay = o => { o.raycast = () => {}; return o; };
const lerp = (a, b, t) => a + (b - a) * t;
// The day/night blend lands on its target once the jump to it is under one level of 255 in any of the room's colours:
// the steepest the sRGB curve gets is 12.92 (at the darkest), so a jump of uNight under 1 / (255 x 12.92) moves no
// drawn colour by a whole level. (It used to land within 0.002, a jump of about 1 level on a dark night frame.)
const BLEND_SNAP = 1 / (255 * 12.92);

export class Greenhouse {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'greenhouse';
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
    this.loadMs = 0;
    this.light = { hemi: [new THREE.Color(), new THREE.Color(), 1], key: [new THREE.Color(), 1], rim: [new THREE.Color(), 1], env: 0.5 };
    // the slime's lights by day and by night (GREENHOUSE.slimeLight), as colors once
    const col = L => ({ hemi: [new THREE.Color(L.hemi[0]), new THREE.Color(L.hemi[1]), L.hemi[2]], key: [new THREE.Color(L.key[0]), L.key[1]], rim: [new THREE.Color(L.rim[0]), L.rim[1]], env: L.env });
    this.lights = [col(GREENHOUSE.slimeLight.day), col(GREENHOUSE.slimeLight.night)];
    this.fog = { color: new THREE.Color(), near: 30, far: 200 };
  }

  // Loads the room once (after the first frame). Resolves true when it is ready, false when it could not load
  // (offline on the very first run, or a copy of the game that does not carry the room's files).
  load() {
    if (!this.loading) {
      const t0 = performance.now();
      this.loading = this.build().then(() => {
        this.ready = true;
        this.loadMs = Math.round(performance.now() - t0);
        return true;
      }, e => {
        this.failed = true;
        console.warn('Greenhouse: the room could not load, the Meadow stays for now.', e && e.message ? e.message : e);
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
    const [meta, bin, tp] = await Promise.all([get('gh.json', 'json'), get('gh.bin', 'bin'), get('tp_objects.json', 'json').catch(() => null)]);
    if (meta.format !== 2) throw new Error('unknown room format ' + meta.format);
    const loader = new THREE.TextureLoader();
    const tex = name => new Promise((res, rej) => loader.load(new URL(name, BASE).href, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }, undefined, () => rej(new Error(name))));
    const [floorDay, floorNight] = await Promise.all([tex('floor_day.jpg'), tex('floor_night.jpg')]);
    this.meta = roomMeta(meta, tp);   // gh.json as the game uses it: the terrarium's footprints (greenhouse-math.js)
    const chunk = (name, Type) => { const [o, n] = meta.chunks[name]; return new Type(bin, o, n / Type.BYTES_PER_ELEMENT); };
    const shared = m => { m.uniforms.uNight = this.U.uNight; return m; };
    const placeQ = m => { m.position.set(...meta.qbox.center); m.scale.set(...meta.qbox.half); return m; };
    const baked = (geo, fog = true) => noRay(new THREE.Mesh(geo, shared(new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uNight: { value: 0 } }]), vertexShader: VERT, fragmentShader: FRAG, fog, toneMapped: false,
    }))));
    const g = this.group;
    // the room: a few big chunks, one draw call each
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
    // the plank floor: textured (day and night)
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
      g.add(placeQ(m));
    }
    // the sky: the Blender sky's colors by elevation, day and night per point
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
    this.sky = baked(skyGeo, false);
    this.sky.material.side = THREE.BackSide;
    this.sky.material.depthWrite = false;
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    g.add(this.sky);
    // stars (night): a fixed seeded field over the garden, behind the back glass
    {
      const n = 200, p = new Float32Array(n * 3), R = SKY_R * 0.97;
      let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < n; i++) {
        const az = (rnd() - 0.5) * 1.8, el = (6 + rnd() * 60) * Math.PI / 180;
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
    // the glass
    const glassMat = new THREE.ShaderMaterial({ uniforms: { uNight: this.U.uNight }, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG });
    for (const [c, d] of meta.panes) {
      const m = noRay(new THREE.Mesh(new THREE.BoxGeometry(Math.max(d[0], 0.01), d[1], Math.max(d[2], 0.01)), glassMat));
      m.position.set(...c);
      m.renderOrder = 2;
      g.add(m);
    }
    // glows: additive halos, no lights (the room's own light is baked); only drawn at night
    const dot = document.createElement('canvas');
    dot.width = dot.height = 64;
    { const x = dot.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
    this.dotTex = new THREE.CanvasTexture(dot);
    const halo = (pos, color, size, kind) => {
      const m = new THREE.SpriteMaterial({ map: this.dotTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
      const s = noRay(new THREE.Sprite(m));
      s.position.set(...pos); s.scale.setScalar(size); s.renderOrder = 3; s.visible = false;
      g.add(s);
      this.glows.push({ s, m, kind, phase: Math.random() * 6.28 });
      return s;
    };
    if (meta.lantern) { halo(meta.lantern, '#ffb24a', 2.2, 'lamp'); halo(meta.lantern, '#ffe2a8', 0.75, 'lamp'); }
    if (meta.jars) { halo(meta.jars[0], '#ffd84a', 0.7, 'jar'); halo(meta.jars[1], '#8fdcff', 0.7, 'jar'); }
    if (meta.window) halo(meta.window, '#ffb24a', 1.4, 'lamp');
    // the fairy bulbs and the fireflies: many small halos, one draw call per group (points sized like halos of
    // `world` units, see update; each one's twinkle is its color, which is the same as its opacity when added on)
    const dots = (list, world) => {
      const n = list.length, geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(list.flatMap(d => d.pos)), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const mat = new THREE.PointsMaterial({ map: this.dotTex, vertexColors: true, size: world, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 });
      const pts = noRay(new THREE.Points(geo, mat));
      pts.frustumCulled = false; pts.renderOrder = 3; pts.visible = false;
      g.add(pts);
      return { pts, mat, world, base: list.map(d => new THREE.Color(d.color)), phase: list.map(() => Math.random() * 6.28) };
    };
    const BULB = ['#ffd98a', '#ffc2d6', '#bfe8ff'];
    this.bulbs = dots((meta.bulbs || []).map((p, i) => ({ pos: [p[0], p[1] - 0.03, p[2] + 0.02], color: BULB[i % 3] })), 0.26);
    // fireflies drifting in the garden outside the glass
    {
      let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 26; i++) {
        const home = new THREE.Vector3(-6 + rnd() * 12, 0.4 + rnd() * 2.6, -8 - rnd() * 14);
        this.flies.push({ home, ph: rnd() * 6.28, sp: 0.3 + rnd() * 0.4 });
      }
      this.fly = dots(this.flies.map(f => ({ pos: f.home.toArray(), color: '#d8ff8a' })), 0.18);
      this.fly.phase = this.flies.map(f => f.ph);
    }
    this.scene.add(g);
  }

  // Night (1) or day (0); `instant` skips the blend (the first time the room shows).
  setNight(dark, instant = false) {
    this.target = dark ? 1 : 0;
    if (instant) this.U.uNight.value = this.target;
  }
  get night() { return this.U.uNight.value; }

  // Per frame while the room shows: the day/night blend, glows, fireflies, the sky around the camera.
  update(dt, camera, reduced = false) {
    if (!this.ready) return;
    this.time += dt;
    const U = this.U.uNight, k = GREENHOUSE.blend;
    U.value += (this.target - U.value) * (1 - Math.exp(-dt * k));
    if (Math.abs(this.target - U.value) < BLEND_SNAP) U.value = this.target;
    const nt = U.value, t = this.time * 1000;
    this.starMat.opacity = nt;
    this.stars.visible = nt > 0.003;
    for (const h of this.glows) {
      const tw = reduced ? 1 : 0.93 + 0.07 * Math.sin(t / 1100 + h.phase);
      h.m.opacity = nt * tw;
      h.s.visible = h.m.opacity > 0.003;
    }
    const on = nt > 0.003, tanHalf = camera ? Math.tan(camera.fov * Math.PI / 360) : 0.268;
    for (const [d, tw] of [[this.bulbs, (ph) => 0.75 + 0.25 * Math.sin(t / 700 + ph)], [this.fly, (ph) => Math.max(0, Math.sin(t / 600 + ph * 3)) ** 2]]) {
      d.pts.visible = on;
      if (!on) continue;
      d.mat.opacity = nt;
      d.mat.size = d.world / tanHalf;   // the same size on screen as a halo `world` units wide, at any fov
      const col = d.pts.geometry.attributes.color;
      d.base.forEach((c, i) => { const k = reduced ? 1 : tw(d.phase[i]); col.setXYZ(i, c.r * k, c.g * k, c.b * k); });
      col.needsUpdate = true;
    }
    if (on) {
      const pos = this.fly.pts.geometry.attributes.position;
      this.flies.forEach((f, i) => {
        const q = t / 1000 * f.sp + f.ph;
        pos.setXYZ(i, f.home.x + Math.sin(q) * 0.6, f.home.y + Math.sin(q * 1.7) * 0.25, f.home.z + Math.cos(q * 0.8) * 0.6);
      });
      pos.needsUpdate = true;
    }
    if (camera) { this.sky.position.copy(camera.position); this.stars.position.copy(camera.position); }
    // the slime's lights and the fog follow the blend
    const [a, b] = this.lights, o = this.light;
    o.hemi[0].lerpColors(a.hemi[0], b.hemi[0], nt);
    o.hemi[1].lerpColors(a.hemi[1], b.hemi[1], nt);
    o.hemi[2] = lerp(a.hemi[2], b.hemi[2], nt);
    o.key[0].lerpColors(a.key[0], b.key[0], nt); o.key[1] = lerp(a.key[1], b.key[1], nt);
    o.rim[0].lerpColors(a.rim[0], b.rim[0], nt); o.rim[1] = lerp(a.rim[1], b.rim[1], nt);
    o.env = lerp(a.env, b.env, nt);
    const fd = this.meta.fog.day, fn = this.meta.fog.night, F = this.fog;
    if (!this.fogCols) this.fogCols = [new THREE.Color(fd[0]), new THREE.Color(fn[0])];
    F.color.lerpColors(this.fogCols[0], this.fogCols[1], nt).multiplyScalar(this.meta.expo);
    const near = lerp(fd[1], fn[1], nt), depth = lerp(fd[2], fn[2], nt), amt = lerp(fd[3], fn[3], nt);
    F.near = near; F.far = near + depth / amt;
  }

  // what the room adds to a frame (for the report and the smoke test)
  counts() {
    if (!this.meta) return null;
    const tris = this.meta.room_chunks.reduce((s, c) => s + c.tris, 0) + this.meta.floor.tris;
    return { tris, chunks: this.meta.room_chunks.length + 1, glows: this.glows.length + this.bulbs.base.length + this.flies.length, loadMs: this.loadMs };
  }
}
