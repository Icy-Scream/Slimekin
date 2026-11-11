// The terrarium's menu objects: the golden chest, the mirror, the potting bench, the jelly jar, the toy barn, the snack
// basket, the slate and the name stake. Each is its own small file (tp_<name>.glb and two baked textures, day and night,
// in src/assets/greenhouse/), placed by tp_objects.json: they are tappable later (their Tap_ boxes, Sparkle_ and Tag_
// anchors are here as data; nothing is tappable yet), so they are not baked into the room. Drawn like the room's floor:
// unlit, the day and night textures mixed on the room's own uNight, with its fog. Under each, a soft contact shadow (all
// eight in one mesh, one draw); at night the jar, the toy barn and the chest glow (additive sprites, nudged toward the
// camera so the object's own bumps don't cut into them); the stake's brass label carries the slime's name and number,
// written at run time. The Greenhouse (greenhouse.js) loads the files and owns this; the reference drawing is Usopp's
// P3 kit page (slimekin-notes, samples/terrarium-p3/src/kit/tp3.js).
import * as THREE from 'three';
import { GREENHOUSE } from '../data/content.js';
import { readGLB } from './glb.js';

const LABEL_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const LABEL_FRAG = `
uniform sampler2D tDay, tNight; uniform float uNight;
varying vec2 vUv;
void main(){
  gl_FragColor = mix(texture2D(tDay, vUv), texture2D(tNight, vUv), uNight);
  #include <colorspace_fragment>
}`;
const noRay = o => { o.raycast = () => {}; return o; };

export class MenuObjects {
  // tp: tp_objects.json; files: { <name>: { glb: ArrayBuffer, day: Texture, night: Texture } }; sprites: { shadow, glow }
  // (textures); U: the room's { uNight } uniform; shade(day, night): the room's floor material for two textures.
  constructor(tp, files, sprites, U, shade) {
    this.tp = tp;
    this.U = U;
    this.group = new THREE.Group();
    this.group.name = 'menu-objects';
    this.items = [];
    this.glows = [];
    this.tris = 0;
    const shPos = [], shUv = [], shIdx = [];
    for (const [name, o] of Object.entries(tp.objects)) {
      const f = files[name], g = readGLB(f.glb);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(g.position, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
      geo.setIndex(new THREE.BufferAttribute(g.index, 1));
      geo.computeBoundingSphere();
      const mesh = noRay(new THREE.Mesh(geo, shade(f.day, f.night)));
      mesh.name = 'tp_' + name;
      mesh.position.set(...o.position);
      mesh.rotation.y = o.yaw;
      this.group.add(mesh);
      this.tris += g.tris;
      // its anchors in the room (the GLB's own empties: Glow_, Sparkle_, Tag_Anchor, Tap_<name> with its half extents)
      const c = Math.cos(o.yaw), s = Math.sin(o.yaw), P = o.position;
      const at = t => [P[0] + t[0] * c + t[2] * s, P[1] + t[1], P[2] - t[0] * s + t[2] * c];
      const anchors = Object.fromEntries(Object.entries(g.nodes).map(([k, v]) => [k, { at: at(v.t), half: v.s }]));
      this.items.push({ name, o, mesh, anchors });
      // the contact shadow: a w x d quad on the floor at position + offset, turned by the yaw (as tp3.js lays it)
      const S = o.shadow, base = shPos.length / 3;
      for (const [sx, sz] of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) {
        const lx = sx * S.w / 2, lz = sz * S.d / 2;
        shPos.push(P[0] + S.offset[0] + lx * c + lz * s, P[1] + S.offset[1], P[2] + S.offset[2] - lx * s + lz * c);
        shUv.push((sx + 1) / 2, (sz + 1) / 2);
      }
      shIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);   // facing up: one side, one draw
      // the night glow
      if (o.glow) {
        const m = new THREE.SpriteMaterial({ map: sprites.glow, color: o.glow.color, transparent: true, depthWrite: false, depthTest: true,
          blending: THREE.AdditiveBlending, opacity: 0, fog: false, toneMapped: false });
        const sp = noRay(new THREE.Sprite(m));
        sp.scale.setScalar(o.glow.size);
        sp.renderOrder = 3;
        sp.visible = false;
        this.group.add(sp);
        this.glows.push({ sp, m, k: o.glow.opacity, toward: o.glow.toward_camera_m || 0, at: anchors[o.glow.at || 'Glow_Anchor'].at });
      }
      // the stake's label
      if (o.label) this.makeLabel(o, anchors[o.label.at || 'Tag_Anchor'].at);
    }
    // all the contact shadows: one mesh (they share the sprite and the day -> night opacity)
    {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(shPos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(shUv, 2));
      geo.setIndex(shIdx);
      const ops = Object.values(tp.objects).map(o => o.shadow.opacity.join());
      if (new Set(ops).size > 1) console.warn('Greenhouse: the menu objects\' shadows differ in opacity; the first one is used for all');
      this.shadowK = Object.values(tp.objects)[0].shadow.opacity;
      this.shadowMat = new THREE.MeshBasicMaterial({ map: sprites.shadow, transparent: true, depthWrite: false, toneMapped: false, fog: false });
      this.shadows = noRay(new THREE.Mesh(geo, this.shadowMat));
      this.shadows.name = 'menu-shadows';
      this.group.add(this.shadows);
    }
    this._dir = new THREE.Vector3();
  }

  // the stake's brass label: a quad at Tag_Anchor, turned by the stake's yaw, tilted back, 1.5 mm in front of the plate;
  // its two canvases (day: engraved with a lit lower lip; night: the letters catch the lamp) mixed on uNight
  makeLabel(o, p) {
    const L = o.label, W = GREENHOUSE.menu.labelPx, H = Math.round(W * L.h / L.w);
    const canvas = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    this.label = { L, W, H, day: canvas(), night: canvas(), text: null };
    this.label.tDay = tex(this.label.day);
    this.label.tNight = tex(this.label.night);
    const mat = new THREE.ShaderMaterial({ uniforms: { tDay: { value: this.label.tDay }, tNight: { value: this.label.tNight }, uNight: this.U.uNight },
      vertexShader: LABEL_VERT, fragmentShader: LABEL_FRAG, transparent: true, depthWrite: false, toneMapped: false });
    const q = noRay(new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), mat));
    q.name = 'stake-label';
    q.matrixAutoUpdate = false;
    q.matrix.makeTranslation(p[0], p[1], p[2]).multiply(new THREE.Matrix4().makeRotationY(o.yaw))
      .multiply(new THREE.Matrix4().makeRotationX(L.tilt)).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.0015));
    this.group.add(q);
    this.labelMesh = q;
  }

  // The stake's two lines: the slime's name (empty while it is an egg) and its number ("No. 0001": the family's
  // generation). Redrawn only when they change.
  setLabel(name, no) {
    const lb = this.label;
    if (!lb) return;
    const text = `${name || ''}\n${no || ''}`;
    if (text === lb.text) return;
    lb.text = text;
    const k = lb.W / 392, font = GREENHOUSE.menu.labelFont;   // the plate's layout at 392 x 218 (Usopp's make_plate.py)
    const lines = [[name, 'italic 400', 84, 84], [no, '700', 56, 160]];
    for (const [cv, look] of [[lb.day, lb.L.day], [lb.night, lb.L.night]]) {
      const x = cv.getContext('2d');
      x.clearRect(0, 0, lb.W, lb.H);
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.lineJoin = 'round';
      x.lineWidth = 4 * k;   // a 2 px stroke round each letter, for weight: it reads at phone size
      for (const [s, style, px, y] of lines) {
        if (!s) continue;
        let size = px * k;
        x.font = `${style} ${size}px ${font}`;
        const wMax = lb.W * 0.84, w = x.measureText(s).width;
        if (w > wMax) { size *= wMax / w; x.font = `${style} ${size}px ${font}`; }
        const draw = (dx, dy, col) => { x.fillStyle = x.strokeStyle = col; x.strokeText(s, lb.W / 2 + dx, y * k + dy); x.fillText(s, lb.W / 2 + dx, y * k + dy); };
        if (look.lip) draw(2 * k, 2 * k, look.lip);
        draw(0, 0, look.fill);
      }
    }
    lb.tDay.needsUpdate = true;
    lb.tNight.needsUpdate = true;
  }

  // Per frame: the shadows and glows follow the blend (nt: 0 day, 1 night), and the glows face the camera.
  update(nt, camera) {
    const K = this.shadowK;
    this.shadowMat.opacity = K[0] + (K[1] - K[0]) * nt;
    const e = camera.position;
    for (const g of this.glows) {
      g.m.opacity = g.k * nt;
      g.sp.visible = g.m.opacity > 0.003;
      if (!g.sp.visible) continue;
      const d = this._dir.set(e.x - g.at[0], e.y - g.at[1], e.z - g.at[2]).normalize().multiplyScalar(g.toward);
      g.sp.position.set(g.at[0] + d.x, g.at[1] + d.y, g.at[2] + d.z);
    }
  }

  // what they add to a frame: draw calls (the meshes, the shadows, the label, the glows lit now) and triangles
  counts() {
    return { objects: this.items.length, tris: this.tris, draws: this.items.length + 1 + (this.labelMesh ? 1 : 0) + this.glows.filter(g => g.sp.visible).length };
  }
}
