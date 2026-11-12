// The race kit in the browser (RV2): loads src/assets/race/ (Usopp's kit, unchanged) once, and builds each runner's
// sprite strip with the kit's own composer (race-compose.js): your slime from its body, form, colour, Pure and outfits,
// a rival from its place's recipe (CONTESTS.race.rivals) in its RIVAL_COLOR. A strip is the race's 24 frames (plan
// FRAMES) side by side, 56 x 56 art px each, with the contact shadow under the body (frame A's rule); plus the face
// crop for the tote strip and the race card (16 x 14 art px between the eyes). Built in slices of a few ms (step), so
// it fits in idle time while the race card is open.
import { CONTESTS } from '../data/content.js';
import { cleanBody } from '../core/recipe.js';
import { prepareKit, composeRunner, rampRule, KIT_OUTFIT, CAN } from './race-compose.js';
import { runnerColours } from './race-colour.js';
import { FORM_LOOKS } from './forms.js';
import { FRAMES, kitFrameOf, exprOf } from './race-plan.js';
import { fetchPng } from './png-index.js';

const BASE = new URL('../assets/race/', import.meta.url);
const SHEETS = { curly: 'body_curly.png', dollop: 'body_dollop.png', mixed: 'body_mixed.png', props: 'overlay_props.png', acc: 'overlay_acc.png',
  fx: 'overlay_fx.png', crowd: 'overlay_crowd.png', course: 'course_sprint.png' };
const TILES = ['aurora', 'candy', 'circuit', 'cracks', 'drizzle', 'emberRise', 'firelight', 'flames', 'honeycomb', 'plates', 'speckle', 'spots', 'stars',
  'toast', 'toastGold', 'zigzag'];
const SURGE_SPARK = { surge_long: 0, surge_spark: 2, surge_back: 3 };   // the Volt's surge sparks (the kit's frames)
const VERGE = [0x5f, 0x9f, 0x58];   // the contact shadow: the darker grass (frame A)

let KIT = null, LOADING = null;
export const kitNow = () => KIT;
// the kit, loaded once (a promise; rejects if a file is missing)
export function loadKit() {
  if (KIT) return Promise.resolve(KIT);
  if (LOADING) return LOADING;
  const J = f => fetch(new URL(f, BASE)).then(r => { if (!r.ok) throw new Error(f + ': ' + r.status); return r.json(); });
  const P = f => fetchPng(new URL(f, BASE));
  LOADING = (async () => {
    const [j, fc, forms, pj, fxj, course, palette] = await Promise.all(['kit.json', 'forms_colours.json', 'forms.json', 'props.json', 'fx.json', 'course.json', 'palette_day.json'].map(J));
    const names = Object.keys(SHEETS);
    const sheets = Object.fromEntries((await Promise.all(names.map(n => P(SHEETS[n])))).map((p, i) => [names[i], { w: p.w, h: p.h, data: p.data }]));
    const tl = await Promise.all(TILES.map(t => P(`tiles/tile_${t}.png`)));
    const tiles = Object.fromEntries(tl.map((p, i) => [TILES[i], p.data]));
    const zig = (await P('tile_zigzag.png')).data;
    KIT = prepareKit({ j, fc, forms: Object.fromEntries(forms.map(f => [f.id, f])), pj, fxj, course, palette, sheets, tiles, zig });
    return KIT;
  })();
  LOADING.catch(() => { LOADING = null; });
  return LOADING;
}

// ---------- who runs ----------
const formOf = id => (id && (FORM_LOOKS[id] || String(id).startsWith('spark:')) ? id : 'mochi');
// your slime (a ranch resident)
export function castOfResident(x) {
  const b = cleanBody(x), form = formOf(x.form && x.form.id);
  const worn = ['head', 'face', 'neck'].map(s => x.worn && x.worn[s]).filter(o => o && KIT_OUTFIT[o]).map(o => KIT_OUTFIT[o]);
  return { key: `you:${x.id}:${form}:${b.breed}:${b.variant}:${b.mix}:${worn}:${!!(x.form && x.form.pure)}:${JSON.stringify(x.traits || {})}`, you: true,
    fam: b.breed, breed: b.breed !== 'curly' && b.variant !== 'plain' ? b.variant : null, form, worn, pure: !!(x.form && x.form.pure), traits: x.traits || {}, mix: b.mix };
}
// a rival (its place's recipe, in its place colour: the cup's rival color, RIVAL_COLOR)
export function castOfRival(place, color) {
  const r = CONTESTS.race.rivals[place] || CONTESTS.race.rivals.school;
  const ramp = rampRule(color || '#ffc9a3');
  return { key: `rival:${place}:${color}`, you: false, fam: r.breed, breed: r.breed !== 'curly' && r.variant !== 'plain' ? r.variant : null, form: r.form,
    worn: [KIT_OUTFIT[r.outfit]].filter(Boolean), pure: false, ramps: { day: ramp, night: ramp }, base: ramp.base };
}

// ---------- a runner's strip ----------
const CACHE = new Map();   // finished strips by cast key (the rivals are the same every race)
export class RunnerArt {
  constructor(kit, cast) {
    this.kit = kit; this.cast = cast;
    this.next = 0;
    this.done = false;
    const c = cast.you ? runnerColours(kit, { form: cast.form, fam: cast.fam, traits: cast.traits, pure: cast.pure, mix: cast.mix, look: FORM_LOOKS[cast.form] }) : null;
    this.ramps = cast.ramps || (c && c.ramps);
    this.fc = c ? c.fc : null;
    this.base = cast.base || (this.ramps ? this.ramps.day.base : (kit.fc[cast.form] || kit.fc.mochi).ramps[cast.fam].day.base);
    this.canvas = document.createElement('canvas');
    this.canvas.width = CAN * FRAMES.length; this.canvas.height = CAN;
    this.ctx = this.canvas.getContext('2d');
    this.face = document.createElement('canvas');
    this.face.width = 16; this.face.height = 14;
    this.img = this.ctx.createImageData(CAN, CAN);
  }
  static of(kit, cast) {
    const hit = CACHE.get(cast.key);
    if (hit && hit.kit === kit) return hit;
    const a = new RunnerArt(kit, cast);
    CACHE.set(cast.key, a);
    if (CACHE.size > 24) CACHE.delete(CACHE.keys().next().value);
    return a;
  }
  // compose frames for about `ms` milliseconds; true when every frame is in
  step(ms = 6) {
    const t0 = performance.now(), k = this.kit, c = this.cast;
    while (this.next < FRAMES.length && (performance.now() - t0 < ms || this.next === 0)) {
      const i = this.next++, id = FRAMES[i], fid = kitFrameOf(id);
      const px = composeRunner(k, { fam: c.fam, frame: fid, form: c.form, theme: 'day', expr: exprOf(id), worn: c.worn, pure: c.pure, propFrame: i % 2,
        spark: c.form === 'spark' && SURGE_SPARK[id] !== undefined ? SURGE_SPARK[id] : null, breed: c.breed, ramps: this.ramps || null, fc: this.fc });
      this.shadow(px, k.j.families[c.fam].frames[fid]);
      this.img.data.set(px);
      this.ctx.putImageData(this.img, i * CAN, 0);
      if (i === 0) this.cropFace(px, k.j.families[c.fam].frames.idle_0);
    }
    this.done = this.next >= FRAMES.length;
    return this.done;
  }
  finish() { while (!this.step(50)); return this; }
  // frame A's contact shadow: an ellipse in the darker grass under the body, smaller when the body is in the air
  shadow(px, F) {
    const bb = F.bbox, air = 50 - 1 - bb[3];
    const rx = (bb[2] - bb[0] + 1) * (air <= 1 ? 0.42 : 0.3), ry = 1.6, cx = (bb[0] + bb[2] + 1) / 2, cy = 50 + 0.5;
    for (let y = Math.floor(cy - ry) - 1; y < Math.floor(cy + ry) + 2; y++) for (let x = Math.floor(cx - rx) - 1; x < Math.floor(cx + rx) + 2; x++) {
      if (x < 0 || y < 0 || x >= CAN || y >= CAN || ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 > 1) continue;
      const p = (y * CAN + x) * 4;
      if (px[p + 3]) continue;
      px[p] = VERGE[0]; px[p + 1] = VERGE[1]; px[p + 2] = VERGE[2]; px[p + 3] = 255;
    }
  }
  // the face marker: 16 x 14 art px centred between the eyes (both eyes show)
  cropFace(px, F) {
    const e = F.anchors.eyes, mx = (e[0][0] + e[1][0]) / 2 + 2, my = (e[0][1] + e[1][1]) / 2 + 2.5;
    const x0 = Math.round(mx - 8), y0 = Math.round(my - 7), ctx = this.face.getContext('2d'), im = ctx.createImageData(16, 14);
    for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) {
      const sx = x0 + x, sy = y0 + y;
      if (sx < 0 || sy < 0 || sx >= CAN || sy >= CAN) continue;
      im.data.set(px.subarray((sy * CAN + sx) * 4, (sy * CAN + sx) * 4 + 4), (y * 16 + x) * 4);
    }
    ctx.putImageData(im, 0, 0);
  }
}
