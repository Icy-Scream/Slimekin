// A small PNG reader for the race kit's index sheets in node (tests and tools; the game uses the same chunk and row
// code, src/view/png-index.js, with the browser's DecompressionStream). Returns { w, h, ch, data } (ch bytes a pixel).
import fs from 'node:fs';
import zlib from 'node:zlib';
import { pngChunks, unfilter } from '../src/view/png-index.js';

export function readPng(file) {
  const { w, h, ch, z } = pngChunks(fs.readFileSync(file));
  return { w, h, ch, data: unfilter(zlib.inflateSync(z), w, h, ch) };
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
