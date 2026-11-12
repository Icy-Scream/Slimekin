// PNG index sheets (the race kit's, 8-bit greyscale or RGB/RGBA, not interlaced) without a canvas: a canvas can colour-
// manage a greyscale PNG and change the index values. Split the chunks here, inflate (zlib in node, the browser's
// DecompressionStream), then undo the row filters here. Pure.
export function pngChunks(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (dv.getUint32(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, depth = 0, type = 0, inter = 0, size = 0;
  const idat = [];
  while (p < b.length) {
    const len = dv.getUint32(p), kind = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    if (kind === 'IHDR') { w = dv.getUint32(p + 8); h = dv.getUint32(p + 12); depth = b[p + 16]; type = b[p + 17]; inter = b[p + 20]; }
    else if (kind === 'IDAT') { idat.push(b.subarray(p + 8, p + 8 + len)); size += len; }
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 6: 4 }[type];
  if (depth !== 8 || !ch || inter) throw new Error(`unsupported PNG (depth ${depth}, type ${type}, interlace ${inter})`);
  const z = new Uint8Array(size);
  let o = 0;
  for (const d of idat) { z.set(d, o); o += d.length; }
  return { w, h, ch, z };
}
export function unfilter(raw, w, h, ch) {
  const stride = w * ch, out = new Uint8Array(w * h * ch);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], s0 = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[y * stride + x - ch] : 0, up = y ? out[(y - 1) * stride + x] : 0, c = x >= ch && y ? out[(y - 1) * stride + x - ch] : 0;
      let v = raw[s0 + x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return out;
}
// in the browser: fetch + DecompressionStream('deflate') (zlib)
export async function fetchPng(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const { w, h, ch, z } = pngChunks(new Uint8Array(await r.arrayBuffer()));
  const raw = new Uint8Array(await new Response(new Blob([z]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  return { w, h, ch, data: unfilter(raw, w, h, ch) };
}
