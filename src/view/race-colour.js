// A runner's colours (design/contests-race-view.md v2 §4.2): "the source is the colour the game shows". The kit's form
// colours were measured from the game's renders of a sample slime per form (the catalog's diet for that form, on each
// body); a slime that shows another colour (its own diet, Pure, its Dollop mix) gets the kit's colours moved by one
// L*a*b* step: (the colour it shows) - (the colour the sample shows). A slime that shows the sample's colour gets the
// kit's own colours, exactly. Glow patterns and Aurora's four bands keep their colours (approved 2026-11-12, RV2).
// shownColour is slime.js's body colour (setTraits, the form's tint, Pure, the Dollop's deeper skin) without three.js:
// the same sRGB <-> linear conversions and HSL steps three.js r170 uses, so it lands on the same hex
// (tools/race-colour-test.mjs checks it against three.js).
// Pure: no DOM, no three.js.
import { TRAITS, TRAIT_IDS } from '../data/content.js';
import { lab, lab2rgb, hexrgb, rgbhex } from './race-compose.js';

// the catalog's diet per form (tools/catalog-sheet.cjs FORM_TRAITS and SPARK_TRAITS: the shots the kit was measured on)
const SPARK_TRAITS = { smore: { sweet: 177, heat: 174, spark: 30, mineral: 5, prism: 5 }, honeycomb: { sweet: 211, nature: 160, prism: 6 },
  campfire: { heat: 152, nature: 133, sweet: 32, spark: 18, mineral: 12 }, storm: { spark: 106, prism: 67, mineral: 46, sweet: 38 } };
export const SAMPLE_TRAITS = id => {
  if (id === 'mochi') return { sweet: 6, heat: 5, nature: 5, mineral: 4, spark: 4, prism: 4 };
  if (id.startsWith('spark:')) return SPARK_TRAITS[id.slice(6)];
  const [a, b] = id.split('+');
  return b ? { [a]: 20, [b]: 16 } : { [a]: 34 };
};
// the sample bodies' Dollop mix (the catalog: Curly 0, Dollop 1, Curly x Dollop 0.5)
export const FAMILY_MIX = { curly: 0, dollop: 1, mixed: 0.5 };

// ---------- three.js r170's colour arithmetic ----------
const toLin = c => (c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4));
const toSrgb = c => (c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055);
const clamp01 = v => Math.max(0, Math.min(1, v));
const fromHex = h => { const n = parseInt(h.replace('#', ''), 16); return [toLin((n >> 16 & 255) / 255), toLin((n >> 8 & 255) / 255), toLin((n & 255) / 255)]; };
const lerp = (a, b, t) => { a[0] += (b[0] - a[0]) * t; a[1] += (b[1] - a[1]) * t; a[2] += (b[2] - a[2]) * t; return a; };
function getHSL(c) {
  const r = toSrgb(c[0]), g = toSrgb(c[1]), b = toSrgb(c[2]);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (min + max) / 2;
  if (min === max) { h = 0; s = 0; } else {
    const d = max - min;
    s = l <= 0.5 ? d / (max + min) : d / (2 - max - min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}
const hue2rgb = (p, q, t) => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * 6 * (2 / 3 - t);
  return p;
};
function setHSL(c, h, s, l) {
  h = ((h % 1) + 1) % 1; s = clamp01(s); l = clamp01(l);
  let r, g, b;
  if (s === 0) r = g = b = l;
  else {
    const p = l <= 0.5 ? l * (1 + s) : l + s - (l * s), q = (2 * l) - p;
    r = hue2rgb(q, p, h + 1 / 3); g = hue2rgb(q, p, h); b = hue2rgb(q, p, h - 1 / 3);
  }
  c[0] = toLin(r); c[1] = toLin(g); c[2] = toLin(b);
  return c;
}
const hexOf = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, toSrgb(v) * 255))).toString(16).padStart(2, '0')).join('');   // Color.getHexString

// The colour a grown slime's body shows in the game (SlimeAvatar: setTraits, then the form's tint, Pure, the Dollop's
// deeper skin). look: the form's FORM_LOOKS entry ({ tint, tintAmt }); mk: its Dollop mix (grown: the mix).
export function shownColour(traits, look, { pure = false, mk = 0 } = {}) {
  const entries = TRAIT_IDS.map(k => [k, (traits && traits[k]) || 0]).filter(e => e[1] > 0.01).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, e) => s + e[1], 0);
  const c = fromHex('#7ee6c3');
  if (total > 0) {
    const mix = fromHex(TRAITS[entries[0][0]].color);
    if (entries[1]) lerp(mix, fromHex(TRAITS[entries[1][0]].color), 0.38 * entries[1][1] / entries[0][1]);
    lerp(c, mix, Math.min(0.85, total / (total + 22)));
    const h = getHSL(c);
    setHSL(c, h.h, Math.max(h.s, 0.6), Math.min(0.78, Math.max(0.6, h.l)));
  }
  if (look && look.tint) lerp(c, fromHex(look.tint), look.tintAmt || 0.5);
  if (pure) { const h = getHSL(c); setHSL(c, h.h, Math.min(1, h.s * 1.2 + 0.06), Math.min(0.86, h.l + 0.05)); }
  if (mk > 0.001) { const h = getHSL(c); setHSL(c, h.h, h.s, Math.max(0.2, h.l - 0.09 * mk)); }
  return { lin: c, hex: hexOf(c) };
}

// ---------- the shift ----------
const move = (hex, d) => { const L = lab(hexrgb(hex)); return rgbhex(lab2rgb([L[0] + d[0], L[1] + d[1], L[2] + d[2]])); };
const moveRamp = (r, d) => Object.fromEntries(Object.entries(r).map(([s, h]) => [s, move(h, d)]));
const moveRamps = (rr, d) => ({ day: moveRamp(rr.day, d), night: moveRamp(rr.night, d) });

// A runner's colours for the composer: { ramps (the body ramp, day + night), fc (the form's forms_colours entry, its
// plain patterns moved too), shift (the L*a*b* step, or null: the kit's own objects) }.
// opts: form, fam ('curly' | 'dollop' | 'mixed'), traits (its diet), pure, mix (its Dollop mix), look (FORM_LOOKS[form])
export function runnerColours(kit, { form, fam, traits, pure = false, mix = 0, look = null }) {
  const fc = kit.fc[form];
  const base = form === 'spark' ? kit.j.families[fam].ramp : fc.ramps[fam];
  const want = shownColour(traits, look, { pure, mk: mix }).hex;
  const sample = shownColour(SAMPLE_TRAITS(form), look, { pure: false, mk: FAMILY_MIX[fam] }).hex;
  if (want === sample) return { ramps: base, fc, shift: null, shown: want, sample };
  const A = lab(hexrgb(sample)), B = lab(hexrgb(want)), d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const ramps = moveRamps(base, d);
  if (form === 'spark') return { ramps, fc, shift: d, shown: want, sample };
  const glow = new Set(fc.glow || []);
  const pattern = { ...(fc.pattern || {}) };
  for (const name of fc.pattern_names || []) {
    if (name === 'aurora' || glow.has(name) || !pattern[name] || !pattern[name][fam]) continue;
    const p = pattern[name][fam];
    pattern[name] = { ...pattern[name], [fam]: { ...p, day: p.day.map(h => move(h, d)), night: p.night ? p.night.map(h => move(h, d)) : p.night } };
  }
  return { ramps, fc: { ...fc, ramps: { ...fc.ramps, [fam]: ramps }, pattern }, shift: d, shown: want, sample };
}
