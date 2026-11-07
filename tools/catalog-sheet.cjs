// The slime character sheet: every grown-up form on every body (26 forms x 5 bodies = 130 looks), rendered the same
// way, and the contact sheets built from them. Tools only: it drives the game through its #debug hooks, as
// tools/recipe-samples.cjs (bodies) and tools/render-samples.cjs (form looks) do.
//
// Each look: the grown-up (Settled) slime in daylight, the Classic background (the plain nursery, not the Greenhouse
// room), the same camera, crop, size (neutral genes) and pose for all, the form's diet colours (the traits that make the
// form, as in the other sample tools), no outfit, no medal pin, the menus hidden. The forms, their flavors and the body
// names come from src/data/content.js, so the sheet follows the game's own list.
//
// Setup as in tools/smoke-test.cjs (playwright + three@0.170.0 outside the repo, found through NODE_PATH); its own dev
// server on a free loopback port, offline (tools/browser-kit.cjs). Sheets and the single renders need ffmpeg on the PATH.
//   node tools/catalog-sheet.cjs                     render all 130, then build everything
//   node tools/catalog-sheet.cjs --only heat+sweet,storm,candy   only these forms (form id, spark id, or part of the name)
//   node tools/catalog-sheet.cjs --body curly,mixed  only these bodies (curly, dollop, ears, topknot, mixed)
//   node tools/catalog-sheet.cjs --dpr 2             device scale factor (default 2)
//   node tools/catalog-sheet.cjs --no-sheets         render only (frames in tools/out/catalog/frames)
//   node tools/catalog-sheet.cjs --sheets-only       build from the frames already there (a look with no frame: an
//                                                    empty labeled cell, never a stand-in)
//   node tools/catalog-sheet.cjs --out DIR           where the sheets, the single renders and index.html go
//                                                    (default tools/out/catalog/sheet)
// Output: 00-overview.jpg, 01-single-flavor.jpg, 02-two-flavor-a.jpg, 02-two-flavor-b.jpg, 03-balanced-and-spark.jpg,
// looks/<form>--<body>.jpg (one labeled render per look), index.html (tap to enlarge) and catalog.json (what rendered,
// what failed and why, and the checks per look).
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const flag = name => process.argv.includes('--' + name);
const OUT = path.resolve(arg('out', path.join(__dirname, 'out', 'catalog', 'sheet')));
const FRAMES = path.join(__dirname, 'out', 'catalog', 'frames');
const DPR = Number(arg('dpr', 2));
const ONLY = arg('only', '');
const BODY = arg('body', '');
const VIEW = { width: 393, height: 852 };   // the owner's check size (iPhone, full screen web app)

// ---------- what to render ----------
// the five bodies, in the catalog's order (design notes: slime-catalog). Curly x Dollop is the in-between at mix 0.5.
const BODIES = [
  { id: 'curly', name: 'Curly', body: { mix: 0, variant: 'plain' } },
  { id: 'dollop', name: 'Dollop', body: { mix: 1, variant: 'plain' } },
  { id: 'ears', name: 'Cat-ear Dollop', body: { mix: 1, variant: 'ears' } },
  { id: 'topknot', name: 'Topknot Dollop', body: { mix: 1, variant: 'topknot' } },
  { id: 'mixed', name: null, note: 'in-between, mix 0.5', body: { mix: 0.5, variant: 'plain' } },   // name from BREEDS.names.mixed
];
// the diet each form is shown with (its colour comes from these, as in the game): as in tools/recipe-samples.cjs
const SPARK_TRAITS = { smore: { sweet: 177, heat: 174, spark: 30, mineral: 5, prism: 5 }, honeycomb: { sweet: 211, nature: 160, prism: 6 },
  campfire: { heat: 152, nature: 133, sweet: 32, spark: 18, mineral: 12 }, storm: { spark: 106, prism: 67, mineral: 46, sweet: 38 } };
const FORM_TRAITS = id => {
  if (id === 'mochi') return { sweet: 6, heat: 5, nature: 5, mineral: 4, spark: 4, prism: 4 };
  if (id.startsWith('spark:')) return SPARK_TRAITS[id.slice(6)];
  const [a, b] = id.split('+');
  return b ? { [a]: 20, [b]: 16 } : { [a]: 34 };
};

// the forms in the catalog's order, from the game's data
async function catalog() {
  const C = await import(pathToFileURL(path.join(ROOT, 'src/data/content.js')).href);
  const T = k => C.TRAITS[k].name, short = id => C.FORM_BY_ID[id].name.replace(/ Slime$/, '');
  const forms = [
    ...Object.keys(C.PURE_FORMS).map(id => ({ id, name: C.FORM_BY_ID[id].name, flavors: T(id), group: 'single' })),
    ...Object.keys(C.PAIR_FORMS).map(id => ({ id, name: C.FORM_BY_ID[id].name, flavors: id.split('+').map(T).join(' + '), group: 'pair' })),
    { id: 'mochi', name: C.GENERALIST_FORM.name, flavors: 'no single favorite', group: 'balanced' },
    ...C.SPARK_FORMS.map(s => ({ id: 'spark:' + s.id, name: s.name, flavors: s.parents.map(short).join(' × '), note: 'family spark: breeding only', group: 'spark' })),
  ];
  const bodies = BODIES.map(b => ({ ...b, name: b.name || C.BREEDS.names.mixed }));
  return { forms, bodies };
}
const pickForm = f => !ONLY || ONLY.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  .some(s => f.id === s || f.id === 'spark:' + s || f.name.toLowerCase().includes(s));
const pickBody = b => !BODY || BODY.split(',').map(s => s.trim()).includes(b.id);
const safe = id => id.replace(/[^a-z0-9+-]+/gi, '_');
const lookKey = (f, b) => `${safe(f.id)}--${b.id}`;
const framePath = (f, b, ext = 'png') => path.join(FRAMES, `${lookKey(f, b)}.${ext}`);

async function render(forms, bodies) {
  const { setup, watchdog, log } = require('./browser-kit.cjs');
  const { devices } = require('playwright');
  const errors = [];
  let kit = null;
  watchdog(150, () => kit ? kit.current() : 'setup');
  const dev = devices['iPhone 15 Pro'];
  kit = await setup({ contextOptions: { userAgent: dev.userAgent, isMobile: true, hasTouch: true, viewport: VIEW, screen: VIEW, deviceScaleFactor: DPR } });
  const { page, step } = kit;
  page.setDefaultTimeout(120000);
  const ev = (fn, a, ms) => kit.ev(fn, a, ms);
  const freeze = on => ev(on => { const g = window.slimekin; if (on && !g._upd) { g._upd = g.update; g.update = () => g.stage.render(); } else if (!on && g._upd) { g.update = g._upd; g._upd = null; } }, on);
  // the slime as a grown-up of this body and form, front on; then the game is held still (drawn, not updated) for the shot
  const pose = o => ev(o => {
    const g = window.slimekin, sl = g.slime, st = g.state.slime, { STAGES } = g._content;
    const keys = Object.keys(st.traits), t = Object.fromEntries(keys.map(k => [k, (o.traits || {})[k] || 0]));
    Object.assign(st.traits, t); sl.setTraits(t); sl.color.copy(sl.targetColor);
    g.debugBody({ mix: o.body.mix, variant: o.body.variant }, { instant: true });
    st.genes = { tall: 1, wide: 1, lump: 1, side: 0 }; sl.setRecipe(st, { instant: true });
    st.growth = STAGES[3].minGrowth;
    sl.setStage(3, 0, true);
    sl.size = sl.sizeTarget = g.sim.size();
    sl.setForm(o.form, { pure: false });
    st.worn = { head: null, face: null, neck: null }; sl.setOutfits(st.worn);
    sl.cap.on = false; sl.cap.grow = 0;
    sl.turnTarget = 0; sl.turnYaw = 0;
    if (sl.medalPin) sl.medalPin.sprite.visible = false;
    g.hud.closeModal(); g.debug('needs'); g.requests.timer = 1e9; g.glimmerT = 1e9;
    g.advance(2.5);
    sl.color.copy(sl.targetColor);
    if (sl.medalPin) sl.medalPin.sprite.visible = false;
    sl.blinkT = 99; sl.blinkPhase = -1; sl.blink = 0;
    for (const el of document.querySelectorAll('.toast')) el.remove();
    // checks: the body's points are all real numbers, the form's look is on, the body is the one asked for, the camera
    let bad = 0; for (const v of sl.geo.attributes.position.array) if (!Number.isFinite(v)) bad++;
    let props = 0; for (const p of sl.formProps) for (const ob of [p.obj, ...(p.extra || [])]) ob.traverse(c => { if (c.isMesh || c.isSprite || c.isPoints) props++; });
    const cam = g.stage.camera, r3 = v => +v.toFixed(3);
    return { bad, formId: sl.formId, props, mix: r3(st.mix), variant: st.variant, m: r3(sl.m), size: r3(sl.size), dark: !!g.stage.dark, world: g.home.world,
      camera: [...cam.position.toArray(), ...cam.quaternion.toArray(), cam.fov].map(r3) };
  }, o);

  const looks = [];
  for (const f of forms) for (const b of bodies) looks.push({ f, b });
  const done = [];
  try {
    await step('open the game', () => page.goto(`${kit.server.origin}/#debug`));
    await step('boot', async () => {
      await page.waitForFunction(() => window.slimekin && window.slimekin.egg && document.getElementById('boot').hidden, null, { timeout: 120000 });
      await page.waitForTimeout(1500);
      await ev(async () => {
        const g = window.slimekin; g._content = await import('/src/data/content.js');
        // daytime, high quality, the Classic background (the plain nursery: just the slime), instant eggs off the table
        g.behave.hour = () => 14; g.state.settings.quality = 'high'; g.state.settings.scene = 'classic'; g.applySettings();
        document.documentElement.setAttribute('data-theme', 'light');
      });
    });
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
        // only the 3D view in the pictures (the menus, counters and buttons hidden, their layout kept)
        const s = document.createElement('style'); s.textContent = 'body * { visibility: hidden !important; }'; document.head.appendChild(s);
        g.canvas.style.setProperty('visibility', 'visible', 'important');
        g.advance(1);
      });
    });
    // one crop for every look, from a reference pose (a grown Dollop, Marshmallow form), so the camera, crop and size are
    // the same on every tile: from just under the feet to well above the head (room for flames, clouds and crowns)
    const clip = await step('the crop', async () => {
      await pose({ body: BODIES[1].body, form: 'mochi', traits: FORM_TRAITS('mochi') });
      return ev(() => {
        const g = window.slimekin, sl = g.slime, V = () => g.v1.clone().set(0, 0, 0);
        const b = g.screenOf(sl.root.getWorldPosition(V())), t = g.screenOf(sl.headTopWorld(V()));
        const h = b.y - t.y, side = Math.round(Math.min(h * 2.3, innerWidth)), bottom = b.y + h * 0.32;
        const x = Math.round(Math.max(0, Math.min(innerWidth - side, b.x - side / 2))), y = Math.round(Math.max(0, bottom - side));
        return { x, y, width: side, height: side, ref: { h: +h.toFixed(1), bx: +b.x.toFixed(1), by: +b.y.toFixed(1) } };
      });
    });
    log('crop', JSON.stringify(clip));
    let fails = 0;
    for (const { f, b } of looks) {
      const id = lookKey(f, b), file = framePath(f, b), t0 = Date.now(), e0 = kit.errors.length;
      for (const x of ['png', 'json']) fs.rmSync(framePath(f, b, x), { force: true });
      const rec = { form: f.id, body: b.id, ok: false, problems: [] };
      try {
        await freeze(false);
        const r = await step(`pose ${id}`, () => pose({ body: b.body, form: f.id, traits: FORM_TRAITS(f.id) }));
        await freeze(true);
        await step(`shot ${id}`, async () => {
          await page.waitForTimeout(150);
          await page.screenshot({ path: file, clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height }, timeout: 120000 });
        });
        Object.assign(rec, r);
        if (r.bad) rec.problems.push(`${r.bad} body points are not numbers`);
        if (r.formId !== f.id) rec.problems.push(`the form's look did not go on (formId ${r.formId})`);
        if (Math.abs(r.mix - b.body.mix) > 1e-3 || r.variant !== b.body.variant) rec.problems.push(`body is mix ${r.mix} ${r.variant}, asked ${b.body.mix} ${b.body.variant}`);
        if (r.dark) rec.problems.push('night theme was on');
        if (r.world !== 'classic') rec.problems.push(`background is ${r.world}, not classic`);
        const pe = kit.errors.slice(e0);
        if (pe.length) rec.problems.push(...pe.map(e => 'page: ' + e.slice(0, 200)));
        rec.ok = !rec.problems.length;
        fails = 0;
      } catch (e) {
        rec.problems.push('render error: ' + e.message.split('\n')[0]);
        fs.rmSync(file, { force: true });
        if (++fails >= 3) { errors.push('three looks in a row failed; stopping'); done.push({ ...rec, ms: Date.now() - t0 }); break; }
      }
      rec.ms = Date.now() - t0;
      if (fs.existsSync(file)) fs.writeFileSync(framePath(f, b, 'json'), JSON.stringify({ ...rec, clip, dpr: DPR }, null, 1));
      done.push(rec);
      log(rec.ok ? 'ok' : 'PROBLEM', id, rec.ok ? `${rec.ms} ms, props ${rec.props}` : rec.problems.join('; '));
    }
    await freeze(false);
  } catch (e) {
    errors.push('render error: ' + (e.stack || e.message));
  } finally {
    kit.report();
    await kit.close();
  }
  const bad = done.filter(r => !r.ok);
  if (bad.length) errors.push(`${bad.length} look(s) with problems: ` + bad.map(r => `${r.form} on ${r.body}`).join(', '));
  const missing = looks.length - done.length;
  if (missing) errors.push(`${missing} look(s) not reached`);
  return errors;
}

// ---------- sheets (ffmpeg) ----------
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const BG = '0xfff6ec', CELL = '0xf3e6da', INK = '0x4a3b4f', SOFT = '0x8a7a8f', WARN = '0xc0392b';
const TXT = path.join(__dirname, 'out', 'catalog', 'txt');
let txtN = 0;
function textFile(s) { fs.mkdirSync(TXT, { recursive: true }); const f = path.join(TXT, `t${txtN++}.txt`); fs.writeFileSync(f, s); return f; }
// font size that fits a line into a width (DejaVu Sans Bold is about 0.64 em per character)
const fit = (s, w, size, em = 0.64) => Math.min(size, Math.floor(w / (Math.max(1, s.length) * em)));
const draw = (s, size, y, font = FONT, color = INK, x = '(w-text_w)/2') => `drawtext=fontfile=${font}:textfile=${textFile(s)}:expansion=none:fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}`;
// words into lines of at most `max` characters
const wrap = (s, max) => s.split(' ').reduce((ls, w) => { const l = ls[ls.length - 1]; if (l && (l + ' ' + w).length <= max) ls[ls.length - 1] = l + ' ' + w; else ls.push(w); return ls; }, []);
const ffmpeg = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { maxBuffer: 1 << 26 });
const JPG = ['-frames:v', '1', '-q:v', '3', '-pix_fmt', 'yuvj420p'];   // mjpeg q 3: about quality 88

// A grid: title, column headers, then rows of [row header cell, tiles...]. A tile with no frame is an empty labeled cell.
function gridSheet(file, { title, sub, cols, rows, tile, head, labels = true, colW }) {
  const gap = 10, pad = 20, labH = labels ? 58 : 0;
  const cw = colW || tile;
  const width = pad * 2 + head + cols.length * (cw + gap);
  const inputs = [], parts = [], stack = [];
  let n = 0;
  const band = (h, filters, name) => { parts.push(`color=c=${BG}:s=${width}x${h}:d=0.04${filters.length ? ',' + filters.join(',') : ''}[${name}]`); stack.push(`[${name}]`); };
  // the title, and the sub-title's lines under it
  const subs = [].concat(sub || []);
  if (title) band(90 + subs.length * 38, [draw(title, fit(title, width - 40, 50), 20), ...subs.map((s, i) => draw(s, fit(s, width - 40, 28, 0.6), 84 + i * 38, FONT_REG, SOFT))], 'title');
  // column headers (two lines: name, note)
  const colH = cols.some(c => c.note) ? 70 : 48;
  band(colH, cols.flatMap((c, i) => {
    const x0 = pad + head + i * (cw + gap);
    const sz = fit(c.name, cw - 8, labels ? 28 : 22);
    return [draw(c.name, sz, 8, FONT, INK, `${x0}+(${cw}-text_w)/2`), ...(c.note ? [draw(c.note, fit(c.note, cw - 8, labels ? 20 : 15, 0.58), 8 + sz + 8, FONT_REG, SOFT, `${x0}+(${cw}-text_w)/2`)] : [])];
  }), 'cols');
  rows.forEach((row, ri) => {
    const rh = tile + labH;
    // the row header: the form's name (wrapped) and its flavors
    const nameLines = wrap(row.name, labels ? 13 : 12), big = labels ? 34 : 22, small = labels ? 23 : 15;
    const sublines = [row.flavors, row.note].filter(Boolean).flatMap(s => wrap(s, labels ? 22 : 20));
    const blockH = nameLines.length * (big + 6) + sublines.length * (small + 6);
    let y = Math.max(6, Math.round((tile - blockH) / 2));
    const hf = [];
    for (const l of nameLines) { hf.push(draw(l, fit(l, head - 16, big), y, FONT, INK, '12')); y += big + 6; }
    y += 4;
    for (const l of sublines) { hf.push(draw(l, fit(l, head - 16, small, 0.58), y, FONT_REG, SOFT, '12')); y += small + 6; }
    parts.push(`color=c=${BG}:s=${head}x${rh + gap}:d=0.04,${hf.join(',')}[h${ri}]`);
    const cells = [`[h${ri}]`];
    row.tiles.forEach((t, ti) => {
      let f;
      if (t.img) {
        inputs.push('-i', t.img);
        f = `[${n++}:v]scale=${tile}:${tile}:flags=lanczos,pad=${cw}:${rh}:${(cw - tile) / 2}:0:color=${BG}`;
      } else {
        f = `color=c=${CELL}:s=${tile}x${tile}:d=0.04,${draw('not rendered', fit('not rendered', tile - 16, labels ? 26 : 16), `(h-text_h)/2`, FONT, WARN)},pad=${cw}:${rh}:${(cw - tile) / 2}:0:color=${BG}`;
      }
      if (labels) {
        f += ',' + draw(t.label, fit(t.label, cw - 8, 21), tile + 6);
        if (t.note) f += ',' + draw(t.note, fit(t.note, cw - 8, 18, 0.58), tile + 32, FONT_REG, t.img ? SOFT : WARN);
      }
      parts.push(`${f},pad=${cw + gap}:${rh + gap}:${gap}:0:color=${BG}[r${ri}t${ti}]`);
      cells.push(`[r${ri}t${ti}]`);
    });
    parts.push(`${cells.join('')}hstack=inputs=${cells.length},pad=${width}:${rh + gap}:${pad}:0:color=${BG}[row${ri}]`);
    stack.push(`[row${ri}]`);
  });
  band(24, [], 'foot');
  parts.push(`${stack.join('')}vstack=inputs=${stack.length}[out]`);
  const out = path.join(OUT, file);
  ffmpeg([...inputs, '-filter_complex', parts.join(';'), '-map', '[out]', ...(file.endsWith('.png') ? ['-frames:v', '1'] : JPG), out]);
  console.log('sheet', out, Math.round(fs.statSync(out).size / 1024) + ' KB');
  return { out, width };
}

// Two grids side by side on one page (the overview): rows split in half.
function overview(file, forms, bodies, have) {
  const half = Math.ceil(forms.length / 2);
  const opts = rows => ({ cols: bodies.map(b => ({ name: b.name })), rows, tile: 150, head: 190, labels: false });
  const rowsOf = list => list.map(f => ({ name: f.name.replace(/ Slime$/, ''), flavors: f.flavors, tiles: bodies.map(b => ({ img: have(f, b) })) }));
  const a = gridSheet('.ov-a.png', { title: null, ...opts(rowsOf(forms.slice(0, half))) });
  const b = gridSheet('.ov-b.png', { title: null, ...opts(rowsOf(forms.slice(half))) });
  const n = forms.length * bodies.length, got = forms.reduce((s, f) => s + bodies.filter(b => have(f, b)).length, 0);
  const title = `Every slime: ${forms.length} forms × ${bodies.length} bodies = ${n} grown-up looks`;
  const sub = `Settled, daylight, Classic background, no outfit; ${got} of ${n} rendered. The group sheets have the big pictures.`;
  const out = path.join(OUT, file), W = a.width * 2;
  // (the second half may have a row less: xstack fills the gap)
  ffmpeg(['-i', a.out, '-i', b.out, '-filter_complex',
    `[0:v][1:v]xstack=inputs=2:layout=0_0|w0_0:fill=${BG}[g];` +
    `color=c=${BG}:s=${W}x130:d=0.04,${draw(title, fit(title, W - 40, 52), 18)},${draw(sub, fit(sub, W - 40, 28, 0.6), 86, FONT_REG, SOFT)}[t];[t][g]vstack=inputs=2[out]`,
    '-map', '[out]', ...JPG, out]);
  for (const f of [a.out, b.out]) fs.rmSync(f, { force: true });
  console.log('sheet', out, Math.round(fs.statSync(out).size / 1024) + ' KB');
}

function buildAll(forms, bodies) {
  fs.mkdirSync(path.join(OUT, 'looks'), { recursive: true });
  const meta = (f, b) => { try { return JSON.parse(fs.readFileSync(framePath(f, b, 'json'), 'utf8')); } catch { return null; } };
  const have = (f, b) => fs.existsSync(framePath(f, b)) && meta(f, b) ? framePath(f, b) : null;
  // one labeled render per look (the frame as rendered, and a label band under it)
  const list = [];
  for (const f of forms) for (const b of bodies) {
    const src = have(f, b), m = meta(f, b), rel = `looks/${lookKey(f, b)}.jpg`;
    if (src) {
      const lab1 = f.name, lab2 = b.name;
      ffmpeg(['-i', src, '-filter_complex', `[0:v]scale=600:600:flags=lanczos,pad=600:690:0:0:color=${BG},${draw(lab1, fit(lab1, 580, 32), 608)},${draw(lab2, fit(lab2, 580, 26, 0.58), 650, FONT_REG, SOFT)}[out]`,
        '-map', '[out]', ...JPG, path.join(OUT, rel)]);
    } else fs.rmSync(path.join(OUT, rel), { force: true });
    list.push({ form: f.id, formName: f.name, flavors: f.flavors, group: f.group, body: b.id, bodyName: b.name, file: src ? rel : null,
      ok: !!(src && m && m.ok), problems: m ? m.problems : ['not rendered (no frame)'], checks: m ? { props: m.props, mix: m.mix, variant: m.variant, formId: m.formId, camera: m.camera, ms: m.ms } : null });
  }
  const cols = bodies.map(b => ({ name: b.name, note: b.note }));
  const rowsOf = fl => fl.map(f => ({ name: f.name, flavors: f.flavors, note: f.note,
    tiles: bodies.map(b => { const src = have(f, b), m = meta(f, b); return { img: src, label: f.name.replace(/ Slime$/, ''), note: src ? (m.ok ? b.name : 'CHECK: ' + m.problems[0]) : b.name + ': not rendered' }; }) }));
  const G = g => forms.filter(f => f.group === g);
  const pair = G('pair'), cut = Math.ceil(pair.length / 2);
  const sheets = [
    ['01-single-flavor.jpg', 'Single-flavor forms', 'one favorite flavor', G('single')],
    ['02-two-flavor-a.jpg', 'Two-flavor forms (1 of 2)', 'its top two flavors', pair.slice(0, cut)],
    ['02-two-flavor-b.jpg', 'Two-flavor forms (2 of 2)', 'its top two flavors', pair.slice(cut)],
    ['03-balanced-and-spark.jpg', 'The balanced form and the family spark forms', 'Marshmallow: no single favorite; sparks come only from breeding', [...G('balanced'), ...G('spark')]],
  ];
  const made = [];
  for (const [file, title, sub, fl] of sheets) {
    if (!fl.length) continue;
    gridSheet(file, { title, sub: [`${sub}. Columns: the five bodies.`, 'Grown-up (Settled), daylight, the same camera for all, no outfit.'], cols, rows: rowsOf(fl), tile: 300, head: 300 });
    made.push({ file, title, forms: fl.map(f => f.id) });
  }
  overview('00-overview.jpg', forms, bodies, have);
  made.unshift({ file: '00-overview.jpg', title: 'Overview: every look on one page' });
  fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify({ builtAt: new Date().toISOString(), forms: forms.length, bodies: bodies.length,
    rendered: list.filter(l => l.file).length, ok: list.filter(l => l.ok).length, failed: list.filter(l => !l.file).length, looks: list }, null, 1));
  fs.writeFileSync(path.join(OUT, 'index.html'), indexHtml(made, forms, bodies, list));
  console.log('index', path.join(OUT, 'index.html'));
  return list;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function indexHtml(sheets, forms, bodies, list) {
  const byKey = Object.fromEntries(list.map(l => [`${l.form}|${l.body}`, l]));
  const groups = [['single', 'Single-flavor forms'], ['pair', 'Two-flavor forms'], ['balanced', 'The balanced form'], ['spark', 'Family spark forms (breeding only)']];
  const cell = l => l.file
    ? `<a class="look${l.ok ? '' : ' warn'}" href="${l.file}" data-cap="${esc(l.formName + ', ' + l.bodyName)}"><img loading="lazy" src="${l.file}" alt="${esc(l.formName + ', ' + l.bodyName)}"></a>`
    : `<div class="look missing">not rendered<br><small>${esc(l.problems.join('; '))}</small></div>`;
  const table = fl => `<table><tr><th></th>${bodies.map(b => `<th>${esc(b.name)}${b.note ? `<br><small>${esc(b.note)}</small>` : ''}</th>`).join('')}</tr>` +
    fl.map(f => `<tr><th class="form">${esc(f.name)}<br><small>${esc(f.flavors)}${f.note ? '<br>' + esc(f.note) : ''}</small></th>${bodies.map(b => `<td>${cell(byKey[`${f.id}|${b.id}`])}</td>`).join('')}</tr>`).join('') + '</table>';
  const n = list.length, got = list.filter(l => l.file).length;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Slimekin: every slime</title>
<style>
body { font: 15px/1.4 -apple-system, system-ui, sans-serif; background: #fff6ec; color: #4a3b4f; margin: 0; padding: 12px; }
h1 { font-size: 22px; margin: 4px 0; } h2 { font-size: 18px; margin: 22px 0 6px; } small { color: #8a7a8f; }
.sheets a { display: block; margin: 8px 0; } .sheets img { width: 100%; max-width: 900px; border-radius: 8px; }
.wrap { overflow-x: auto; } table { border-collapse: collapse; } th, td { padding: 3px; vertical-align: middle; }
th { font-size: 13px; } th.form { text-align: left; min-width: 96px; }
.look img { width: 120px; height: auto; display: block; border-radius: 6px; } .look.warn img { outline: 3px solid #c0392b; }
.missing { width: 120px; height: 120px; display: flex; flex-direction: column; justify-content: center; text-align: center; background: #f3e6da; color: #c0392b; border-radius: 6px; font-size: 13px; }
#big { position: fixed; inset: 0; background: rgba(40, 30, 45, 0.92); display: none; align-items: center; justify-content: center; flex-direction: column; z-index: 9; }
#big img { max-width: 100%; max-height: 88vh; } #big p { color: #fff; margin: 8px; } #big.on { display: flex; }
</style></head><body>
<h1>Slimekin: every slime (${forms.length} forms × ${bodies.length} bodies)</h1>
<p>Grown-up (Settled), daylight, the Classic background, the same camera for all, no outfit, no medal. ${got} of ${n} rendered.
Tap any picture to see it big; tap again to close.</p>
<h2>The sheets</h2><div class="sheets">${sheets.map(s => `<a href="${s.file}">${esc(s.title)}<img loading="lazy" src="${s.file}" alt="${esc(s.title)}"></a>`).join('')}</div>
${groups.map(([g, t]) => { const fl = forms.filter(f => f.group === g); return fl.length ? `<h2>${esc(t)}</h2><div class="wrap">${table(fl)}</div>` : ''; }).join('\n')}
<div id="big"><img alt=""><p></p></div>
<script>
const big = document.getElementById('big');
for (const a of document.querySelectorAll('a.look')) a.addEventListener('click', e => {
  e.preventDefault(); big.querySelector('img').src = a.getAttribute('href'); big.querySelector('p').textContent = a.dataset.cap; big.classList.add('on');
});
big.addEventListener('click', () => big.classList.remove('on'));
</script>
</body></html>
`;
}

(async () => {
  const { forms: allForms, bodies: allBodies } = await catalog();
  const forms = allForms.filter(pickForm), bodies = allBodies.filter(pickBody);
  if (!forms.length || !bodies.length) { console.log('nothing to do: no form or body matches --only/--body'); process.exit(2); }
  console.log(`${forms.length} form(s) x ${bodies.length} body(ies) = ${forms.length * bodies.length} look(s)`);
  fs.mkdirSync(FRAMES, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  let errors = [];
  const t0 = Date.now();
  if (!flag('sheets-only')) errors = await render(forms, bodies);
  console.log(`render time ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (!flag('no-sheets')) {
    try { buildAll(forms, bodies); } catch (e) { errors.push('sheet error: ' + (e.stderr ? e.stderr.toString() : e.message)); }
  }
  fs.rmSync(TXT, { recursive: true, force: true });
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
