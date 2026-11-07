// The travel bubble (the send-off): a soft see-through soap bubble made in code, no art files. Thin-film colours on its
// rim that drift with the angle and the time, two bright glints (fixed to the camera, like a window's reflection), a
// gentle wobble. High graphics draws its far side faintly first (a second pass, so the slime looks inside it), Low
// draws only its near side. Reduced motion: no wobble, no colour drift. send-off.js moves it; this only draws it.
import * as THREE from 'three';

const VERT = `
uniform float uTime, uWob;
varying vec3 vN; varying vec3 vV;
void main(){
  vec3 p = position;
  p *= 1.0 + uWob * (0.6 * sin(uTime * 3.1 + p.y * 3.0) + 0.4 * sin(uTime * 2.3 + p.x * 2.6 + p.z * 1.7));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform float uAlpha, uTime, uGlow, uBack;
varying vec3 vN; varying vec3 vV;
void main(){
  vec3 n = normalize(vN) * (uBack > 0.5 ? -1.0 : 1.0), v = normalize(vV);
  float c = clamp(dot(n, v), 0.0, 1.0);
  float f = pow(1.0 - c, 2.0);      // the rim
  float edge = pow(1.0 - c, 7.0);   // a thin bright outline
  vec3 film = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + f * 1.4 + n.y * 0.3 + uTime * 0.06));
  vec3 col = mix(vec3(1.0), film, 0.8) * (1.0 + 0.35 * uGlow);
  float front = 1.0 - uBack;
  float g1 = smoothstep(0.93, 0.98, dot(n, normalize(vec3(-0.45, 0.55, 0.7))));   // a soft window glint, upper left
  float g2 = smoothstep(0.978, 0.992, dot(n, normalize(vec3(0.42, -0.4, 0.81))));  // a small one, lower right
  float a = uAlpha * (0.04 + 0.6 * f + 0.35 * edge + 0.2 * uGlow) + uAlpha * front * (0.7 * g1 + 0.6 * g2);
  vec3 o = mix(col, vec3(1.0), clamp(front * (g1 + g2) + edge * 0.3, 0.0, 1.0));
  gl_FragColor = vec4(o, clamp(a * (uBack > 0.5 ? 0.45 : 1.0), 0.0, 1.0));
}`;

export class TravelBubble {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'travel-bubble';
    this.group.visible = false;
    const geo = new THREE.SphereGeometry(1, 48, 32);
    const mat = back => new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uWob: { value: 0 }, uAlpha: { value: 0 }, uGlow: { value: 0 }, uBack: { value: back ? 1 : 0 } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: back ? THREE.BackSide : THREE.FrontSide, fog: false,
    });
    this.back = new THREE.Mesh(geo, mat(true));
    this.front = new THREE.Mesh(geo, mat(false));
    this.back.renderOrder = 4;     // its far side, then the sparkles (5), then its near side
    this.front.renderOrder = 6;
    for (const m of [this.back, this.front]) { m.frustumCulled = false; this.group.add(m); }
    this.time = 0;
    scene.add(this.group);
  }
  // Low graphics: only the near side (one pass)
  setQuality(q) { this.back.visible = q !== 'low'; }
  // pos: [x, y, z]; r: radius; alpha 0..1; glow 0..1; wob: the wobble (0 = none)
  set(pos, r, { alpha = 1, glow = 0, wob = 0 } = {}) {
    this.group.position.set(pos[0], pos[1], pos[2]);
    this.group.scale.setScalar(Math.max(1e-4, r));
    for (const m of [this.back, this.front]) { const u = m.material.uniforms; u.uAlpha.value = alpha; u.uGlow.value = glow; u.uWob.value = wob; }
  }
  update(dt, still) {
    if (!still) this.time += dt;
    for (const m of [this.back, this.front]) m.material.uniforms.uTime.value = this.time;
  }
  show(on) { this.group.visible = !!on; }
  // (tests and sheets) how many passes it draws now
  passes() { return this.group.visible ? (this.back.visible ? 2 : 1) : 0; }
}
