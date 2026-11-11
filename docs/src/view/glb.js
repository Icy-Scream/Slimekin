// A tiny reader for the terrarium's menu-object GLBs (src/assets/greenhouse/tp_<name>.glb), with no three.js and no
// DOM, so node tests can run it. The files are made by one exporter and are all alike: one mesh (POSITION and
// TEXCOORD_0 as float32, indices as uint16 or uint32, tightly packed), on one node at the scene's root with no
// transform, and its child nodes the empties (Glow_Anchor, Sparkle_Anchor, Tag_Anchor, Tap_<name>: translation, and
// scale for Tap_). No materials, images, lights or extensions. Anything else is refused (it throws), so a file that
// is not one of these never draws wrong: the room shows without it.
const GLB_MAGIC = 0x46546c67, JSON_CHUNK = 0x4e4f534a, BIN_CHUNK = 0x004e4942;
const ARRAYS = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3 };

// Returns { name, position, uv, index, tris, nodes: { <empty>: { t: [x, y, z], s: [x, y, z] } } }.
export function readGLB(buf) {
  const dv = new DataView(buf);
  if (buf.byteLength < 20 || dv.getUint32(0, true) !== GLB_MAGIC || dv.getUint32(4, true) !== 2) throw new Error('not a glTF 2 binary');
  const jsonLen = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== JSON_CHUNK) throw new Error('no JSON chunk');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const binAt = 20 + jsonLen;
  if (binAt + 8 > buf.byteLength || dv.getUint32(binAt + 4, true) !== BIN_CHUNK) throw new Error('no BIN chunk');
  const binStart = binAt + 8, binLen = dv.getUint32(binAt, true);
  if (json.extensionsUsed?.length || json.materials || json.images || json.textures) throw new Error('unexpected extensions, materials or images');
  if (!json.meshes || json.meshes.length !== 1 || json.meshes[0].primitives.length !== 1) throw new Error('expected one mesh with one primitive');
  const prim = json.meshes[0].primitives[0];
  if (prim.mode !== undefined && prim.mode !== 4) throw new Error('expected triangles');
  const read = (i, type) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView], T = ARRAYS[a.componentType];
    if (!T || a.sparse || a.normalized || a.type !== type || (v.byteStride && v.byteStride !== SIZE[type] * T.BYTES_PER_ELEMENT)) throw new Error(`accessor ${i}: unsupported layout`);
    const off = (v.byteOffset || 0) + (a.byteOffset || 0), n = a.count * SIZE[type];
    if (off + n * T.BYTES_PER_ELEMENT > binLen) throw new Error(`accessor ${i}: outside the BIN chunk`);
    // a copy: the offset into the file need not be aligned for a typed array view
    return new T(buf.slice(binStart + off, binStart + off + n * T.BYTES_PER_ELEMENT));
  };
  const position = read(prim.attributes.POSITION, 'VEC3'), uv = read(prim.attributes.TEXCOORD_0, 'VEC2'), index = read(prim.indices, 'SCALAR');
  if (!(index instanceof Uint16Array || index instanceof Uint32Array)) throw new Error('indices must be unsigned integers');
  const points = position.length / 3;
  if (uv.length / 2 !== points || index.length % 3) throw new Error('attribute counts do not match');
  for (const k of index) if (k >= points) throw new Error('an index past the last point');
  const roots = json.scenes[json.scene || 0].nodes;
  const meshNode = json.nodes.find(n => n.mesh === 0);
  if (roots.length !== 1 || json.nodes[roots[0]] !== meshNode || meshNode.matrix || meshNode.translation || meshNode.rotation || meshNode.scale) throw new Error('expected the mesh at the root, untransformed');
  const nodes = {};
  for (const c of meshNode.children || []) {
    const n = json.nodes[c];
    if (n.matrix || n.rotation || n.children) throw new Error(`empty ${n.name}: unsupported transform`);
    nodes[n.name] = { t: n.translation || [0, 0, 0], s: n.scale || [1, 1, 1] };
  }
  return { name: meshNode.name, position, uv, index, tris: index.length / 3, nodes };
}
