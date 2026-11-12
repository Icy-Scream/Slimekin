// A small PNG reader for the race kit's index sheets in node (tests and tools only; the browser decodes with a canvas):
// 8-bit greyscale or 8-bit RGBA / RGB, non-interlaced. Returns { w, h, ch, data } (data: Uint8Array, ch bytes a pixel).
import fs from 'node:fs';
import zlib from 'node:zlib';

export function readPng(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG: ' + file);
  let p = 8, w = 0, h = 0, depth = 0, type = 0, inter = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), kind = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; inter = d[12]; }
    else if (kind === 'IDAT') idat.push(d);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 6: 4 }[type];
  if (depth !== 8 || !ch || inter) throw new Error(`unsupported PNG (depth ${depth}, type ${type}, interlace ${inter}): ${file}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = new Uint8Array(w * h * ch);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[y * stride + x - ch] : 0, up = y ? out[(y - 1) * stride + x] : 0, c = x >= ch && y ? out[(y - 1) * stride + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}

// The race kit from src/assets/race/ as race-compose.js wants it (node).
export function loadRaceKit(dir) {
  const J = f => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
  const sheet = f => { const p = readPng(`${dir}/${f}`); return { w: p.w, h: p.h, data: p.data }; };
  const j = J('kit.json'), forms = Object.fromEntries(J('forms.json').map(f => [f.id, f]));
  const tiles = {};
  for (const f of fs.readdirSync(`${dir}/tiles`)) tiles[f.replace(/^tile_|\.png$/g, '')] = readPng(`${dir}/tiles/${f}`).data;
  return {
    j, fc: J('forms_colours.json'), forms, pj: J('props.json'), oj: J('outfits.json'), bj: J('breed.json'), fxj: J('fx.json'), course: J('course.json'), palette: J('palette_day.json'),
    sheets: { curly: sheet('body_curly.png'), dollop: sheet('body_dollop.png'), mixed: sheet('body_mixed.png'), props: sheet('overlay_props.png'), acc: sheet('overlay_acc.png'),
      outfits: sheet('overlay_outfits.png'), breed: sheet('overlay_breed.png'), fx: sheet('overlay_fx.png'), crowd: sheet('overlay_crowd.png'), course: sheet('course_sprint.png') },
    tiles, zig: readPng(`${dir}/tile_zigzag.png`).data,
  };
}
