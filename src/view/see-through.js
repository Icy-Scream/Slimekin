// The slime's see-through buffer (terrarium-perf). three.js draws everything opaque a second time for a see-through
// (transmission) body, into a buffer the body then samples, blurred by its roughness (a mipmap level). That buffer is
// drawn here at SEE.scale of the picture's size (three.js 0.170 sizes it from camera.viewport when the camera has one;
// Stage.render sets it every frame), a quarter of the pixels at 0.5, and every see-through material samples one mip level
// finer to match (seeThroughLod): the same blur, measured in the picture's pixels, as the full-size buffer gave. The
// look holds for the jelly's roughness (its mip level is about 1.4 at full size, so it never needed the finest pixels);
// glassy forms, whose level is under 1, come out a touch softer (the level can't go below 0).
import * as THREE from 'three';

export const SEE = {
  scale: 0.5,           // the buffer's size against the picture's (1 = three.js as it is)
  up: { value: 1 },     // picture width / buffer width, for the shaders (shared by every see-through material)
};

const LOD = 'float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );';
const CHUNK = THREE.ShaderChunk.transmission_pars_fragment;
const PATCHED = CHUNK.includes(LOD) ? 'uniform float uSeeUp;\n' + CHUNK.replace(LOD,
  'float lod = max( 0.0, log2( transmissionSamplerSize.x * uSeeUp ) * applyIorToRoughness( roughness, ior ) - log2( uSeeUp ) );') : null;
// With another three.js (the chunk changed), nothing is patched and the buffer stays full size.
export const SEE_OK = !!PATCHED;

// onBeforeCompile for a see-through material (or called from its own): the mip level of the full-size buffer.
export function seeThroughLod(sh) {
  if (!PATCHED) return;
  sh.uniforms.uSeeUp = SEE.up;
  sh.fragmentShader = sh.fragmentShader.replace('#include <transmission_pars_fragment>', PATCHED);
}

// Before a frame is drawn: the buffer's size, through the camera's viewport (in drawing-buffer pixels).
const _db = new THREE.Vector2();
export function sizeSeeThrough(renderer, camera) {
  const s = SEE_OK ? SEE.scale : 1;
  if (s >= 1) { camera.viewport = undefined; SEE.up.value = 1; return; }
  renderer.getDrawingBufferSize(_db);
  const w = Math.max(1, Math.round(_db.x * s)), h = Math.max(1, Math.round(_db.y * s));
  (camera.viewport || (camera.viewport = new THREE.Vector4())).set(0, 0, w, h);
  SEE.up.value = _db.x / w;
}
