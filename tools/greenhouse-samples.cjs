// The new slime body in the Greenhouse (slice M2a): renders a headless phone (393x852, DPR 2) and builds one labeled
// contact sheet, 1-new-body-in-the-greenhouse.png:
//   - a grown Curly, a plain Dollop, a Cat-ear Dollop and a Topknot Dollop on the stump, Front, by day and by night,
//     next to the same slime on the Meadow (to judge the room's slime lights, GREENHOUSE.slimeLight in content.js)
//   - the same four in Wide and Left, day and night (the whole phone screen)
//   - the Cozy Scarf and a hat on the stump, the egg and a special egg (Cat-ear) on the stump, the Cuddly sign there
//   node tools/greenhouse-samples.cjs [--out DIR] [--dpr 2] [--only egg,bodies,angles,extras] [--sheets-only]
//        [--light lights.json] [--tag NAME]
// --light: try other slime lights without editing content.js ({ day: { hemi: [sky, ground, i], key: [color, i],
// rim: [color, i], env }, night: {...} }, any part); the frames then go under the --tag name (for a before/after).
// Setup as in tools/smoke-test.cjs (playwright + three@0.170.0 outside the repo, through NODE_PATH); its own dev server on
// a free loopback port, offline (tools/browser-kit.cjs). The sheet needs ffmpeg on the PATH.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const flag = name => process.argv.includes('--' + name);
const OUT = path.resolve(arg('out', path.join(__dirname, 'out', 'greenhouse', 'samples')));
const TAG = arg('tag', 'now');
const FRAMES = path.join(__dirname, 'out', 'greenhouse', 'frames', TAG);
const DPR = Number(arg('dpr', 2));
const ONLY = arg('only', '');
const want = k => !ONLY || ONLY.split(',').includes(k);
const LIGHT = arg('light', '') ? JSON.parse(fs.readFileSync(arg('light'), 'utf8')) : null;
const VIEW = { width: 393, height: 852 };
fs.mkdirSync(FRAMES, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const BODIES = [
  { key: 'curly', label: 'Curly', body: { mix: 0, variant: 'plain' } },
  { key: 'dollop', label: 'Dollop', body: { mix: 1, variant: 'plain' } },
  { key: 'ears', label: 'Cat-ear Dollop', body: { mix: 1, variant: 'ears' } },
  { key: 'topknot', label: 'Topknot Dollop', body: { mix: 1, variant: 'topknot' } },
];
const TRAITS = { sweet: 8, nature: 4 };   // a gentle diet color (as in tools/recipe-samples.cjs)
const FORM = 'mochi';                     // grown: the Marshmallow form (as on the B1 sheets)
const framePath = (id, theme, ext = 'png') => path.join(FRAMES, `${id}-${theme}.${ext}`);

async function render() {
  const errors = [];
  let kit = null;
  watchdog(150, () => kit ? kit.current() : 'setup');
  const { devices } = require('playwright');
  const dev = devices['iPhone 15 Pro'];
  kit = await setup({ contextOptions: { userAgent: dev.userAgent, isMobile: true, hasTouch: true, viewport: VIEW, screen: VIEW, deviceScaleFactor: DPR } });
  const { page, step } = kit;
  page.setDefaultTimeout(120000);
  const ev = (fn, a, ms) => kit.ev(fn, a, ms);
  // day or night: the page theme, the room's blend done at once, the slime's lights with it
  const setTheme = async dark => {
    await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark);
    await page.waitForTimeout(300);
    await ev(() => { const g = window.slimekin; g.home.room.setNight(g.stage.dark, true); g.advance(0.3); });
  };
  const shot = async file => {
    for (let i = 0; i < 2; i++) {
      await ev(() => { const s = window.slimekin.slime; s.blinkT = 99; s.blinkPhase = -1; s.blink = 0; for (const t of document.querySelectorAll('.toast')) t.remove(); });
      await page.waitForTimeout(250);
      await page.screenshot({ path: file, timeout: 120000 });
    }
  };
  // a square crop around the pet (or the egg), saved next to the frame
  const clip = (id, theme, extra = {}) => ev(() => {
    const g = window.slimekin, V = () => g.v1.clone().set(0, 0, 0);
    let b, t;
    if (g.state.phase === 'egg') { const p = g.egg.group.position; b = g.screenOf(V().copy(p)); t = g.screenOf(V().copy(p).setY(p.y + 1.1)); }
    else { b = g.screenOf(g.slime.root.getWorldPosition(V())); t = g.screenOf(g.slime.headTopWorld(V())); }
    const h = Math.max(60, b.y - t.y), side = Math.min(h * 2.1, innerWidth), cy = (b.y + t.y) / 2 - h * 0.12;
    return { x: (b.x + t.x) / 2 - side / 2, y: cy - side / 2, w: side, h: side };
  }).then(c => fs.writeFileSync(framePath(id, theme, 'json'), JSON.stringify({ id, theme, clip: c, dpr: DPR, ...extra }, null, 1)));
  const frame = async (id, extra) => {
    for (const dark of [false, true]) {
      const theme = dark ? 'night' : 'day';
      await setTheme(dark);
      if (extra && extra.before) await extra.before(dark);
      await shot(framePath(id, theme));
      await clip(id, theme, { world: await ev(() => window.slimekin.home.world) });
    }
    await setTheme(false);
    log('frame', id);
  };
  const scene = (s, view = 'front') => ev(([s, view]) => {
    const g = window.slimekin;
    g.state.settings.scene = s; g.applySettings();
    if (s === 'greenhouse') g.home.setView(view);
    g.advance(3);
    return g.home.world;
  }, [s, view]);
  // the pet in a body, grown, with the diet color, the form and outfits (as tools/recipe-samples.cjs poses it)
  const pose = o => ev(o => {
    const g = window.slimekin, sl = g.slime, st = g.state.slime;
    const { STAGES } = g._content;
    const keys = Object.keys(st.traits), t = Object.fromEntries(keys.map(k => [k, (o.traits || {})[k] || 0]));
    Object.assign(st.traits, t); sl.setTraits(t); sl.color.copy(sl.targetColor);
    g.debugBody({ mix: o.body.mix, variant: o.body.variant || 'plain' }, { instant: true });
    st.genes = { tall: 1, wide: 1, lump: 1, side: 0 }; sl.setRecipe(st, { instant: true });
    st.growth = STAGES[3].minGrowth;
    sl.setStage(3, 0, true);
    sl.size = sl.sizeTarget = g.sim.size();
    sl.setForm(o.form || null, {});
    st.worn = { head: null, face: null, neck: null, ...(o.worn || {}) }; sl.setOutfits(st.worn);
    g.hud.closeModal(); g.debug('needs');
    g.advance(2.5);
    let bad = 0; for (const v of sl.geo.attributes.position.array) if (!Number.isFinite(v)) bad++;
    return { bad, mix: +sl.mixS.toFixed(2), breed: sl.bodyInfo.breed };
  }, o);

  try {
    await step('open the game', () => page.goto(`${kit.server.origin}/#debug`));
    await step('boot', async () => {
      await page.waitForFunction(() => window.slimekin && window.slimekin.egg && window.slimekin.home, null, { timeout: 120000 });
      await page.waitForFunction(() => window.slimekin.home.room.ready || window.slimekin.home.room.failed, null, { timeout: 150000 });
      await ev(async light => {
        const g = window.slimekin; g._content = await import('/src/data/content.js');
        g.behave.hour = () => 14; g.state.settings.quality = 'high'; g.applySettings(); g.debugInstant = true; g.instantEggs();
        // --light: other slime lights for the room (the room keeps them as colors, day and night)
        if (light) g.home.room.lights.forEach((L, i) => {
          const o = light[i ? 'night' : 'day'];
          if (!o) return;
          if (o.hemi) { L.hemi[0].set(o.hemi[0]); L.hemi[1].set(o.hemi[1]); L.hemi[2] = o.hemi[2]; }
          if (o.key) { L.key[0].set(o.key[0]); L.key[1] = o.key[1]; }
          if (o.rim) { L.rim[0].set(o.rim[0]); L.rim[1] = o.rim[1]; }
          if (o.env !== undefined) L.env = o.env;
        });
      }, LIGHT);
      const w = await ev(() => window.slimekin.home.world);
      if (w !== 'greenhouse') throw new Error('the room did not load: ' + w);
    });

    // ----- the egg and a special egg on the stump -----
    if (want('egg')) {
      await ev(() => { const g = window.slimekin; g.state.tutorial = 0; g.advance(1); });
      await step('egg', () => frame('egg'), 400000);
      await ev(() => { const g = window.slimekin; g.state.egg.bred = { ...(g.state.egg.bred || {}), special: 'ears' }; g.makeEggView(); g.advance(1); });
      await step('special egg', () => frame('egg-ears'), 400000);
      await ev(() => { const g = window.slimekin; if (g.state.egg.bred) delete g.state.egg.bred.special; g.makeEggView(); g.advance(0.5); });
    }

    await step('hatch and grow', async () => {
      await ev(() => { const g = window.slimekin; for (let i = 0; i < 5; i++) g.tapEgg(g.egg.group.position.clone()); g.advance(4.5); });
      await page.fill('#slimeName', 'Sample'); await page.click('#nameOk');
      await ev(() => {
        const g = window.slimekin;
        g.state.tutorial = 5; g.requests.timer = 1e9; g.glimmerT = 1e9;
        for (let i = 0; i < 3; i++) { g.debug('grow'); g.advance(3); g.hud.closeModal(); }
        g.advance(1); g.hud.closeModal();
        // steady shots: no personality moments, no idle wandering, no requests or glimmers
        g.behave.update = () => {}; g.updateIdle = () => {};
        g.requests.timer = 1e9; g.glimmerT = 1e9; g.debug('needs');
        for (const t of document.querySelectorAll('.toast')) t.remove();
      });
    });

    // ----- the four bodies: Front in the room and on the Meadow; Wide and Left in the room -----
    for (const b of BODIES) {
      if (!want('bodies') && !want('angles')) break;
      const r = await step(`pose ${b.key}`, () => pose({ body: b.body, traits: TRAITS, form: FORM }));
      if (r.bad) errors.push(`${b.key}: ${r.bad} non-finite points`);
      log('pose', b.key, JSON.stringify(r));
      if (want('bodies')) {
        await scene('greenhouse', 'front');
        await step(`${b.key} front`, () => frame(`${b.key}-gh-front`), 400000);
        await scene('meadow');
        await step(`${b.key} meadow`, () => frame(`${b.key}-meadow-front`), 400000);
      }
      if (want('angles')) for (const v of ['wide', 'left']) {
        await scene('greenhouse', v);
        await step(`${b.key} ${v}`, () => frame(`${b.key}-gh-${v}`), 400000);
      }
      await scene('greenhouse', 'front');
    }

    // ----- the scarf, a hat, the Cuddly sign on the stump -----
    if (want('extras')) {
      await scene('greenhouse', 'front');
      await step('scarf', async () => { await pose({ body: BODIES[1].body, traits: TRAITS, form: FORM, worn: { neck: 'scarf' } }); await frame('scarf-dollop'); }, 400000);
      await step('hat', async () => { await pose({ body: BODIES[0].body, traits: TRAITS, form: FORM, worn: { head: 'beret' } }); await frame('beret-curly'); }, 400000);
      // the Cuddly sign, held at t = 1.77 s (the snack out and full size), as tools/integrate-smoke.cjs holds it
      const play = () => ev(() => {
        const g = window.slimekin, md = g.movingDay;
        if (md.__step) { md.step = md.__step; delete md.__step; }
        g.debug('sign:cuddly'); md.active.side = 1; g.advance(1.76);
        md.__step = md.step; md.step = function () { return md.__step.call(md, 0); };
      });
      const release = () => ev(() => { const g = window.slimekin, md = g.movingDay; if (md.__step) { md.step = md.__step; delete md.__step; } g.advance(6); });
      for (const b of [BODIES[0], BODIES[1]]) {
        await pose({ body: b.body, traits: TRAITS, form: FORM });
        await step(`cuddly ${b.key}`, () => frame(`cuddly-${b.key}`, { before: play }), 400000);
        await release();
        const end = await ev(() => { const g = window.slimekin, a = g.movingDay.active, p = g.slime.root.position; return { active: !!a, x: +p.x.toFixed(3), z: +p.z.toFixed(3), y: +p.y.toFixed(3) }; });
        log('cuddly', b.key, 'ends', JSON.stringify(end));
        if (end.active || Math.abs(end.x) > 0.02 || Math.abs(end.z) > 0.02) errors.push(`the Cuddly sign on a ${b.label} did not end on the stump: ${JSON.stringify(end)}`);
      }
    }
  } catch (e) {
    errors.push('test error: ' + e.message);
  }
  errors.unshift(...kit.errors);
  await kit.close();
  return errors;
}

// ---------- the sheet (ffmpeg) ----------
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const BG = '0xfff6ec', INK = '0x4a3b4f', SOFT = '0x8a7a8f';
const TXT = path.join(__dirname, 'out', 'greenhouse', 'txt');
let txtN = 0;
function textFile(s) { fs.mkdirSync(TXT, { recursive: true }); const f = path.join(TXT, `t${txtN++}.txt`); fs.writeFileSync(f, s); return f; }
const fit = (s, w, size, em = 0.64) => Math.min(size, Math.floor(w / (Math.max(1, s.length) * em)));
const draw = (s, size, y, font = FONT, color = INK, x = '(w-text_w)/2') => `drawtext=fontfile=${font}:textfile=${textFile(s)}:expansion=none:fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}`;

// rows: [{ header, tiles: [{ img, label, note, crop }], w, h }]
function buildSheet(file, title, sub, rows, width) {
  const inputs = [], parts = [], stack = [];
  const gap = 10, labelH = 74;
  let n = 0;
  const band = (h, filters, name) => { parts.push(`color=c=${BG}:s=${width}x${h}:d=0.04${filters.length ? ',' + filters.join(',') : ''}[${name}]`); stack.push(`[${name}]`); };
  band(sub ? 132 : 92, [draw(title, fit(title, width - 40, 54), 22), ...(sub ? [draw(sub, fit(sub, width - 40, 30, 0.6), 86, FONT_REG, SOFT)] : [])], 'title');
  rows.forEach((row, ri) => {
    if (row.header) band(46, [draw(row.header, 26, 12, FONT, SOFT, '24')], `h${ri}`);
    const tiles = [];
    row.tiles.forEach((t, ti) => {
      const meta = t.crop ? JSON.parse(fs.readFileSync(t.img.replace(/\.png$/, '.json'), 'utf8')) : null;
      inputs.push('-i', t.img);
      const idx = n++, tw = row.w, th = row.h;
      let f = `[${idx}:v]`;
      if (meta) {
        const c = meta.clip, k = meta.dpr, W = VIEW.width * k, H = VIEW.height * k;
        const side = Math.round(Math.min(c.w * k, c.h * k, W, H));
        const x = Math.round(Math.max(0, Math.min(W - side, c.x * k + (c.w * k - side) / 2)));
        const y = Math.round(Math.max(0, Math.min(H - side, c.y * k + (c.h * k - side) / 2)));
        f += `crop=${side}:${side}:${x}:${y},`;
      }
      f += `scale=${tw}:${th}:flags=lanczos,pad=${tw}:${th + labelH}:0:0:color=${BG}`;
      f += ',' + draw(t.label, fit(t.label, tw - 8, 26), th + 8);
      if (t.note) f += ',' + draw(t.note, fit(t.note, tw - 8, 20, 0.58), th + 42, FONT_REG, SOFT);
      parts.push(`${f}[r${ri}t${ti}]`);
      tiles.push(`[r${ri}t${ti}]`);
    });
    const used = row.tiles.length * row.w + (row.tiles.length - 1) * gap;
    const side = Math.floor((width - used) / 2);
    const padded = tiles.map((tl, i) => { parts.push(`${tl}pad=${row.w + (i ? gap : 0)}:${row.h + labelH}:${i ? gap : 0}:0:color=${BG}[r${ri}p${i}]`); return `[r${ri}p${i}]`; });
    parts.push(`${padded.join('')}hstack=inputs=${padded.length},pad=${width}:${row.h + labelH}:${side}:0:color=${BG}[row${ri}]`.replace('hstack=inputs=1,', 'null,'));
    stack.push(`[row${ri}]`);
  });
  band(24, [], 'foot');
  parts.push(`${stack.join('')}vstack=inputs=${stack.length},split[a][b];[a]palettegen=max_colors=256:stats_mode=full[pal];[b][pal]paletteuse=dither=sierra2_4a[out]`);
  const out = path.join(OUT, file);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', parts.join(';'), '-map', '[out]', '-frames:v', '1', out]);
  console.log('sheet', out, Math.round(fs.statSync(out).size / 1024) + ' KB');
}

function buildSheets() {
  const crop = (id, theme, label, note) => ({ img: framePath(id, theme), label, note, crop: true });
  const full = (id, theme, label, note) => ({ img: framePath(id, theme), label, note });
  const rows = [];
  for (const b of BODIES) rows.push({ header: `${b.label}, grown (Marshmallow form): Front on the stump vs the same slime on the Meadow`, w: 300, h: 300, tiles: [
    crop(`${b.key}-gh-front`, 'day', 'Greenhouse, day'), crop(`${b.key}-gh-front`, 'night', 'Greenhouse, night'),
    crop(`${b.key}-meadow-front`, 'day', 'Meadow, day'), crop(`${b.key}-meadow-front`, 'night', 'Meadow, night')] });
  for (const v of ['wide', 'left']) rows.push({ header: `${v === 'wide' ? 'Wide' : 'Left'} (the whole phone screen), day and night`, w: 196, h: 425, tiles:
    BODIES.flatMap(b => ['day', 'night'].map(t => full(`${b.key}-gh-${v}`, t, b.label, t))) });
  rows.push({ header: 'On the stump: the Cozy Scarf and a hat (Artist Beret)', w: 300, h: 300, tiles: [
    crop('scarf-dollop', 'day', 'Scarf, Dollop', 'day'), crop('scarf-dollop', 'night', 'Scarf, Dollop', 'night'),
    crop('beret-curly', 'day', 'Beret, Curly', 'day'), crop('beret-curly', 'night', 'Beret, Curly', 'night')] });
  rows.push({ header: 'The Cuddly sign on the stump (whole screen) and the eggs on the stump', w: 196, h: 425, tiles: [
    full('cuddly-curly', 'day', 'Cuddly, Curly', 'day'), full('cuddly-curly', 'night', 'Cuddly, Curly', 'night'),
    full('cuddly-dollop', 'day', 'Cuddly, Dollop', 'day'), full('cuddly-dollop', 'night', 'Cuddly, Dollop', 'night'),
    full('egg', 'day', 'Egg', 'day'), full('egg', 'night', 'Egg', 'night'),
    full('egg-ears', 'day', 'Cat-ear egg', 'day'), full('egg-ears', 'night', 'Cat-ear egg', 'night')] });
  const missing = rows.flatMap(r => r.tiles).filter(t => !fs.existsSync(t.img)).map(t => path.basename(t.img));
  if (missing.length) { console.log('skip sheet (missing:', missing.slice(0, 6).join(', ') + (missing.length > 6 ? ' ...' : '') + ')'); return; }
  buildSheet(TAG === 'now' ? '1-new-body-in-the-greenhouse.png' : `1-new-body-in-the-greenhouse-${TAG}.png`,
    'The new slime body in the Greenhouse', `393 x 852 phone, DPR ${DPR}; slime lights ${LIGHT ? 'from ' + path.basename(arg('light')) : 'from GREENHOUSE.slimeLight'}`, rows, 1660);
}

(async () => {
  let errors = [];
  if (!flag('sheets-only')) errors = await render();
  buildSheets();
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
