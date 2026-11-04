// Sample renderer: shows form looks (and egg samples) in a headless phone-sized browser, day and night,
// and builds labeled contact sheets from the frames. Used to send rendered samples before building
// a new look into the game (see AGENTS.md: "send rendered sample images first").
//
// Setup is the same as tools/smoke-test.cjs (playwright + three@0.170.0 installed outside the repo,
// found through NODE_PATH). Starts its own dev server on a free loopback port and stops it on exit.
//
//   node tools/render-samples.cjs                      render everything below, then build the sheets
//   node tools/render-samples.cjs --only smore         only looks/eggs whose id contains "smore"
//   node tools/render-samples.cjs --sheets-only        rebuild sheets from frames already rendered
//   node tools/render-samples.cjs --out DIR            where the sheets go (default tools/out/samples)
//   node tools/render-samples.cjs --dpr 1              device scale factor (default 2)
//
// Frames land in tools/out/samples/frames (ignored by git). Sheets need ffmpeg on the PATH.
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const flag = name => process.argv.includes('--' + name);
const OUT = path.resolve(arg('out', path.join(__dirname, 'out', 'samples')));
const FRAMES = path.join(__dirname, 'out', 'samples', 'frames');
const DPR = Number(arg('dpr', 2));
const ONLY = arg('only', '');
const VIEW = { width: 393, height: 852 };   // the owner's check size (iPhone, full screen web app)
fs.mkdirSync(FRAMES, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

// ---------- what to render ----------
// traits: the diet the slime is shown with (missing trait keys are filled with 0).
const LOOKS = [
  // the seven parent looks, for comparison
  { id: 'heat+sweet', label: 'Hearth', note: 'parent', traits: { sweet: 22, heat: 16 } },
  { id: 'mochi', label: 'Marshmallow', note: 'parent', traits: { sweet: 6, heat: 5, nature: 5, mineral: 4, spark: 4, prism: 4 } },
  { id: 'nature+sweet', label: 'Nectar', note: 'parent', traits: { nature: 20, sweet: 16 } },
  { id: 'sweet', label: 'Candy', note: 'parent', traits: { sweet: 34 } },
  { id: 'mineral+nature', label: 'Root', note: 'parent', traits: { nature: 20, mineral: 18 } },
  { id: 'prism+spark', label: 'Aurora', note: 'parent', traits: { prism: 20, spark: 18 } },
  { id: 'spark', label: 'Volt', note: 'parent', traits: { spark: 34 } },
  // breeding-only takes (samples)
  { id: 'breed:smore:a', label: "S'more · take A", note: 'cracker hat, chocolate heart', traits: { sweet: 20, heat: 16 } },
  { id: 'breed:smore:b', label: "S'more · take B", note: 'gooey s\'more on a cracker', traits: { sweet: 18, heat: 22 } },
  { id: 'breed:honeycomb:a', label: 'Honeycomb · take A', note: 'hive buddy, honey dipper', traits: { sweet: 22, nature: 14 } },
  { id: 'breed:honeycomb:b', label: 'Honeycomb · take B', note: 'wrapped honey-drop candy', traits: { sweet: 20, nature: 14 } },
  { id: 'breed:campfire:a', label: 'Campfire · take A', note: 'warm heart of a log fire', traits: { heat: 20, nature: 14 } },
  { id: 'breed:campfire:b', label: 'Campfire · take B', note: 'little camper, campfire hat', traits: { heat: 14, nature: 20 } },
  { id: 'breed:storm:a', label: 'Storm · take A', note: 'puffy cloud, rainbow, bolt', traits: { spark: 20, prism: 14 } },
  { id: 'breed:storm:b', label: 'Storm · take B', note: 'storm in a bottle', traits: { spark: 18, prism: 16 } },
];
const EGGS = [
  { id: 'egg:normal', label: 'Normal egg', note: 'as in the game today', kind: null },
  { id: 'egg:spark:a', label: 'Spark egg · take A', note: 'warm heartbeat glow inside', kind: 'glow' },
  { id: 'egg:spark:b', label: 'Spark egg · take B', note: 'a twinkle circles it', kind: 'twinkle' },
];
const TAKE_IDS = ['breed:smore:a', 'breed:smore:b', 'breed:honeycomb:a', 'breed:honeycomb:b', 'breed:campfire:a', 'breed:campfire:b', 'breed:storm:a', 'breed:storm:b'];
// ranch check: every take as a resident (cheaper "lite" slimes), seen from the Ranch tab
const RANCH = [{ id: 'ranch:all', label: 'All 8 takes on the ranch', note: 'lite residents, Ranch tab' }];
const PARENT_IDS = ['heat+sweet', 'mochi', 'nature+sweet', 'sweet', 'mineral+nature', 'prism+spark', 'spark'];
// one sheet per breeding form: parents and both takes, day and night, then close-ups of the takes
const formSheet = (file, title, sub, ids) => ({ file, title, sub, width: 1330, rows: [
  { header: 'Day', theme: 'day', ids, w: 320, h: 694 },
  { header: 'Night', theme: 'night', ids, w: 320, h: 694 },
  { header: 'Close-up (day)', theme: 'day', crop: true, ids: ids.slice(2), w: 650, h: 650 },
] });
const SHEETS = [
  formSheet('01-smore.png', "S'more Slime", 'Hearth × Marshmallow, raised on the right snacks', ['heat+sweet', 'mochi', 'breed:smore:a', 'breed:smore:b']),
  formSheet('02-honeycomb.png', 'Honeycomb Slime', 'Nectar × Candy, raised on the right snacks', ['nature+sweet', 'sweet', 'breed:honeycomb:a', 'breed:honeycomb:b']),
  formSheet('03-campfire.png', 'Campfire Slime', 'Hearth × Root, raised on the right snacks', ['heat+sweet', 'mineral+nature', 'breed:campfire:a', 'breed:campfire:b']),
  formSheet('04-storm.png', 'Storm Slime', 'Aurora × Volt, raised on the right snacks', ['prism+spark', 'spark', 'breed:storm:a', 'breed:storm:b']),
  { file: '00-overview.png', title: 'Breeding-only forms: all 8 takes', sub: 'Close-ups, day. Each form has a take A and a take B.', width: 1330, rows: [
    { header: "S'more and Honeycomb", theme: 'day', crop: true, ids: TAKE_IDS.slice(0, 4), w: 320, h: 320 },
    { header: 'Campfire and Storm', theme: 'day', crop: true, ids: TAKE_IDS.slice(4), w: 320, h: 320 },
  ] },
  { file: 'egg-spark.png', title: 'Family spark egg', sub: 'An egg from a spark pair looks a little special', width: 1000, rows: [
    { header: 'Day', theme: 'day', ids: EGGS.map(e => e.id), w: 320, h: 694 },
    { header: 'Night', theme: 'night', ids: EGGS.map(e => e.id), w: 320, h: 694 },
    { header: 'Close-up (day)', theme: 'day', crop: true, ids: EGGS.map(e => e.id), w: 320, h: 320 },
    { header: 'Close-up (night)', theme: 'night', crop: true, ids: EGGS.map(e => e.id), w: 320, h: 320 },
  ] },
  { file: 'ranch-lite.png', title: 'Ranch check: the takes as ranch residents', sub: 'Lite slimes (coarser body). Left to right: day, night', width: 1000, rows: [
    { header: '', theme: 'day', ids: ['ranch:all'], w: 480, h: 1041, pair: true },
  ] },
  { file: 'parents.png', title: 'Parent looks (as in the game today)', sub: 'Day and night, for comparison', width: 1330, rows: [
    { header: 'Day', theme: 'day', ids: PARENT_IDS, w: 180, h: 390 },
    { header: 'Night', theme: 'night', ids: PARENT_IDS, w: 180, h: 390 },
  ] },
];

// ---------- helpers ----------
const safe = id => id.replace(/[^a-z0-9+-]+/gi, '_');
const framePath = (id, theme, ext = 'png') => path.join(FRAMES, `${safe(id)}-${theme}.${ext}`);
const matches = id => !ONLY || ONLY.split(',').some(s => id.includes(s));

function freePort(from = 5310) {
  let used = '';
  try { used = execFileSync('ss', ['-ltn'], { encoding: 'utf8' }); } catch { /* no ss: just try */ }
  for (let p = from; p < from + 200; p++) if (!new RegExp(`:${p}\\s`).test(used)) return p;
  throw new Error('no free port');
}

async function render() {
  const { chromium, devices } = require('playwright');
  const THREE_DIR = path.resolve(path.dirname(require.resolve('three')), '..');
  const port = freePort();
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve.mjs'), String(port), '127.0.0.1'], { stdio: 'ignore' });
  const errors = [];
  let browser;
  try {
    await new Promise(r => setTimeout(r, 800));
    browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const dev = devices['iPhone 15 Pro'];
    const ctx = await browser.newContext({ userAgent: dev.userAgent, isMobile: true, hasTouch: true, viewport: VIEW, screen: VIEW, deviceScaleFactor: DPR });
    const page = await ctx.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', route => route.fulfill({ path: path.join(THREE_DIR, route.request().url().split('three@0.170.0/')[1]), contentType: 'text/javascript' }));
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    const ev = (fn, a) => page.evaluate(fn, a);
    // Software WebGL draws only a few frames a second; screenshot twice so transitions settle.
    // (no blinking mid-shot: eyes stay open for the samples)
    const shot = async file => {
      for (let i = 0; i < 2; i++) {
        await page.evaluate(() => { const s = window.slimekin.slime; s.blinkT = 99; s.blinkPhase = -1; s.blink = 0; });
        await page.waitForTimeout(250);
        await page.screenshot({ path: file, timeout: 120000 });
      }
    };
    const setTheme = async dark => { await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark); await page.waitForTimeout(300); };

    await page.goto(`http://127.0.0.1:${port}/#debug`);
    await page.waitForTimeout(3000);
    // steady conditions for every shot: daytime clock (no sleepy-night moods), no requests or glimmers,
    // no random personality moments, full needs, fixed high quality (the phone's normal setting)
    await ev(() => {
      const g = window.slimekin;
      g.behave.hour = () => 14;
      g.state.settings.quality = 'high'; g.applySettings();
    });

    // ----- eggs (before hatching) -----
    const eggs = EGGS.filter(e => matches(e.id));
    if (eggs.length) {
      for (const dark of [false, true]) {
        await setTheme(dark);
        for (const e of eggs) {
          await ev(async ({ kind }) => {
            const g = window.slimekin;
            const mod = await import('/src/view/egg-spark.js');
            if (g._spark) { g._spark.dispose(); g._spark = null; }
            if (kind) g._spark = mod.addEggSpark(g.egg, kind);
            g.advance(2.5);
          }, e);
          const file = framePath(e.id, dark ? 'night' : 'day');
          await shot(file);
          const clip = await ev(() => {
            const g = window.slimekin, V = () => g.v1.clone().set(0, 0, 0);
            const base = g.egg.group.getWorldPosition(V());
            const b = g.screenOf(base), t = g.screenOf(base.clone().add(V().set(0, 1.35, 0)));
            const h = b.y - t.y, side = Math.min(h * 2.0, innerWidth), cy = (b.y + t.y) / 2 - h * 0.05;
            return { x: (b.x + t.x) / 2 - side / 2, y: cy - side / 2, w: side, h: side };
          });
          fs.writeFileSync(framePath(e.id, dark ? 'night' : 'day', 'json'), JSON.stringify({ id: e.id, clip, dpr: DPR }, null, 1));
          console.log('egg', e.id, dark ? 'night' : 'day');
        }
        await ev(() => { const g = window.slimekin; if (g._spark) { g._spark.dispose(); g._spark = null; } });
      }
      await setTheme(false);
    }

    const looks = LOOKS.filter(l => matches(l.id));
    const wantRanch = ONLY ? ONLY.split(',').includes('ranch') : true;
    if (looks.length || wantRanch) {
      // hatch and grow up (as in the smoke test)
      await ev(() => { const g = window.slimekin; for (let i = 0; i < 5; i++) g.tapEgg(g.egg.group.position.clone()); g.advance(4.5); });
      await page.fill('#slimeName', 'Sample'); await page.click('#nameOk');
      await ev(() => {
        const g = window.slimekin;
        g.state.tutorial = 5; g.requests.timer = 1e9; g.glimmerT = 1e9;
        Object.assign(g.state.slime.traits, { sweet: 22, heat: 16 });
        for (let i = 0; i < 3; i++) { g.debug('grow'); g.advance(3); g.hud.closeModal(); }
        g.advance(1); g.hud.closeModal();
        g.behave.update = () => {};
        g.updateIdle = () => {};
        g.requests.timer = 1e9; g.glimmerT = 1e9;
        g.debug('needs');
      });
      for (const dark of [false, true]) {
        await setTheme(dark);
        for (const l of looks) {
          const theme = dark ? 'night' : 'day';
          const stats = await ev(async ({ id, traits }) => {
            const g = window.slimekin, sl = g.slime;
            const t = Object.fromEntries(Object.keys(g.state.slime.traits).map(k => [k, 0]));
            Object.assign(t, traits);
            Object.assign(g.state.slime.traits, t);
            sl.setTraits(t);
            sl.color.copy(sl.targetColor);
            const count = () => { let n = 0; sl.root.traverseVisible(o => { if (o.isMesh || o.isSprite) n++; }); return n; };
            // cost: draw calls of the slime alone (rest of the scene hidden for one render), with and without the look
            const solo = () => {
              const hid = [];
              for (const c of g.scene.children) if (c !== sl.root && c.visible && !c.isLight) { c.visible = false; hid.push(c); }
              g.stage.render();
              const n = g.stage.renderer.info.render.calls;
              for (const c of hid) c.visible = true;
              return n;
            };
            sl.setForm(null); g.advance(2);
            const calls0 = solo(), objs0 = count();
            sl.setForm(id);
            g.hud.closeModal(); g.debug('needs'); g.requests.timer = 1e9; g.glimmerT = 1e9;
            g.advance(4);
            const calls1 = solo(), objs1 = count();
            // and with the look's own props hidden, so the difference is what the props cost
            const props = sl.formProps.flatMap(p => [p.obj, ...(p.extra || [])]), was = props.map(o => o.visible);
            for (const o of props) o.visible = false;
            const callsBare = solo();
            props.forEach((o, i) => { o.visible = was[i]; });
            let propMeshes = 0;
            for (const p of sl.formProps) for (const o of [p.obj, ...(p.extra || [])]) o.traverse(c => { if (c.isMesh || c.isSprite) propMeshes++; });
            // lite (ranch resident) copy: must build and stay finite; inner overlays hide on the ranch unless visiting
            const { SlimeAvatar } = await import('/src/view/slime.js');
            const lite = new SlimeAvatar({ quality: 'high', lite: true });
            lite.setTraits(t); lite.setForm(id); lite.size = lite.sizeTarget = 0.86;
            for (let i = 0; i < 20; i++) lite.update(1 / 10);
            lite.inner.visible = false;
            let liteObjs = 0, finite = true;
            lite.root.updateMatrixWorld(true);
            lite.root.traverseVisible(o => { if (o.isMesh || o.isSprite) { liteObjs++; const e = o.matrixWorld.elements; if (e.some(v => !Number.isFinite(v))) finite = false; } });
            if (!Array.from(lite.geo.attributes.position.array).every(Number.isFinite)) finite = false;
            return { callsNoForm: calls0, callsLook: calls1, callsLookNoProps: callsBare, propDrawCalls: calls1 - callsBare, objs0, objs1, propMeshes, liteObjs, liteFinite: finite };
          }, l);
          const file = framePath(l.id, theme);
          await shot(file);
          const clip = await ev(() => {
            const g = window.slimekin, sl = g.slime, V = () => g.v1.clone().set(0, 0, 0);
            const b = g.screenOf(sl.root.getWorldPosition(V())), t = g.screenOf(sl.headTopWorld(V()));
            const h = b.y - t.y, side = Math.min(h * 2.05, innerWidth), cy = (b.y + t.y) / 2 - h * 0.14;
            return { x: (b.x + t.x) / 2 - side / 2, y: cy - side / 2, w: side, h: side };
          });
          fs.writeFileSync(framePath(l.id, theme, 'json'), JSON.stringify({ id: l.id, theme, clip, dpr: DPR, stats }, null, 1));
          console.log('look', l.id, theme, JSON.stringify(stats));
        }
      }
    }

    // ----- ranch residents (lite) -----
    if (wantRanch) {
      const list = LOOKS.filter(l => TAKE_IDS.includes(l.id)).map((l, i) => ({ id: 'sample' + i, name: l.label, traits: l.traits, form: { id: l.id } }));
      await setTheme(false);
      await ev(list => {
        const g = window.slimekin;
        const keys = Object.keys(g.state.slime.traits);
        g.ranch.sync(list.map(d => ({ ...d, traits: Object.fromEntries(keys.map(k => [k, d.traits[k] || 0])) })));
        // stand them in rows facing the camera (clear of the barn and pond) and keep them there
        const spots = [[-1.9, -2.0], [-0.2, 2.5], [-0.4, -2.0], [1.1, -2.0], [-2.6, 0.3], [-1.0, 0.3], [0.6, 0.3], [2.2, 0.3]];
        let i = 0;
        for (const r of g.ranch.residents.values()) {
          if (!String(r.id).startsWith('sample')) continue;
          const [x, z] = spots[i++ % spots.length];
          r.holder.position.x = x; r.holder.position.z = z;
          r.holder.rotation.y = 0; r.heading = 0; r.state = 'idle'; r.timer = 1e9;
        }
      }, list);
      await page.click('#tab-ranch');
      await ev(() => window.slimekin.advance(5));
      for (const dark of [false, true]) {
        await setTheme(dark);
        await ev(() => window.slimekin.advance(2));
        const theme = dark ? 'night' : 'day';
        const file = framePath('ranch:all', theme);
        await shot(file);
        const info = await ev(() => {
          const g = window.slimekin, out = [];
          for (const r of g.ranch.residents.values()) {
            let n = 0, finite = true;
            r.av.root.traverseVisible(o => { if (o.isMesh || o.isSprite) { n++; if (o.matrixWorld.elements.some(v => !Number.isFinite(v))) finite = false; } });
            out.push({ form: r.av.formId, lite: r.av.lite, visibleObjs: n, finite });
          }
          return out;
        });
        fs.writeFileSync(framePath('ranch:all', theme, 'json'), JSON.stringify({ id: 'ranch:all', theme, residents: info }, null, 1));
        console.log('ranch', theme, JSON.stringify(info));
      }
    }
  } catch (e) {
    errors.push('render error: ' + (e.stack || e.message));
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  return errors;
}

// ---------- contact sheets (ffmpeg) ----------
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const BG = '0xfff6ec', INK = '0x4a3b4f', SOFT = '0x8a7a8f';
const TXT = path.join(__dirname, 'out', 'samples', 'txt');
let txtN = 0;
function textFile(s) { fs.mkdirSync(TXT, { recursive: true }); const f = path.join(TXT, `t${txtN++}.txt`); fs.writeFileSync(f, s); return f; }
// font size that fits a line into a width (DejaVu Sans Bold is about 0.64 em per character)
const fit = (s, w, size, em = 0.64) => Math.min(size, Math.floor(w / (Math.max(1, s.length) * em)));
const draw = (s, size, y, font = FONT, color = INK, x = '(w-text_w)/2') => `drawtext=fontfile=${font}:textfile=${textFile(s)}:expansion=none:fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}`;

// rows: [{ header, tiles: [{ img, label, note, crop: bool }], w, h }]
function buildSheet(file, title, sub, rows, width) {
  const inputs = [], parts = [], stack = [];
  const gap = 10, labelH = 74;
  let n = 0;
  const band = (h, filters, name) => { parts.push(`color=c=${BG}:s=${width}x${h}:d=0.04${filters.length ? ',' + filters.join(',') : ''}[${name}]`); stack.push(`[${name}]`); };
  band(sub ? 132 : 92, [draw(title, fit(title, width - 40, 54), 22), ...(sub ? [draw(sub, fit(sub, width - 40, 32, 0.6), 86, FONT_REG, SOFT)] : [])], 'title');
  rows.forEach((row, ri) => {
    if (row.header) band(46, [draw(row.header, 26, 12, FONT, SOFT, '24')], `h${ri}`);
    const tiles = [];
    row.tiles.forEach((t, ti) => {
      const meta = t.crop ? JSON.parse(fs.readFileSync(t.img.replace(/\.png$/, '.json'), 'utf8')) : null;
      inputs.push('-i', t.img);
      const idx = n++;
      const tw = row.w, th = row.h;
      let f = `[${idx}:v]`;
      if (meta) {
        // keep the crop square: shrink it to fit the frame, then slide it inside
        const c = meta.clip, k = meta.dpr, W = VIEW.width * k, H = VIEW.height * k;
        const side = Math.round(Math.min(c.w * k, c.h * k, W, H));
        const x = Math.round(Math.max(0, Math.min(W - side, c.x * k + (c.w * k - side) / 2)));
        const y = Math.round(Math.max(0, Math.min(H - side, c.y * k + (c.h * k - side) / 2)));
        f += `crop=${side}:${side}:${x}:${y},`;
      }
      f += `scale=${tw}:${th}:flags=lanczos,pad=${tw}:${th + labelH}:0:0:color=${BG}`;
      f += ',' + draw(t.label, fit(t.label, tw - 8, 30), th + 8);
      if (t.note) f += ',' + draw(t.note, fit(t.note, tw - 8, 21, 0.58), th + 44, FONT_REG, SOFT);
      parts.push(`${f}[r${ri}t${ti}]`);
      tiles.push(`[r${ri}t${ti}]`);
    });
    const used = row.tiles.length * row.w + (row.tiles.length - 1) * gap;
    const side = Math.floor((width - used) / 2);
    // join tiles with gaps, centered in the sheet width
    const padded = tiles.map((tl, i) => { parts.push(`${tl}pad=${row.w + (i ? gap : 0)}:${row.h + labelH}:${i ? gap : 0}:0:color=${BG}[r${ri}p${i}]`); return `[r${ri}p${i}]`; });
    parts.push(`${padded.join('')}hstack=inputs=${padded.length}${padded.length === 1 ? '' : ''},pad=${width}:${row.h + labelH}:${side}:0:color=${BG}[row${ri}]`.replace('hstack=inputs=1,', 'null,'));
    stack.push(`[row${ri}]`);
  });
  band(24, [], 'foot');
  parts.push(`${stack.join('')}vstack=inputs=${stack.length},split[a][b];[a]palettegen=max_colors=256:stats_mode=full[pal];[b][pal]paletteuse=dither=sierra2_4a[out]`);
  const out = path.join(OUT, file);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', parts.join(';'), '-map', '[out]', '-frames:v', '1', out]);
  console.log('sheet', out, Math.round(fs.statSync(out).size / 1024) + ' KB');
}

function buildSheets() {
  const byId = Object.fromEntries([...LOOKS, ...EGGS, ...RANCH].map(l => [l.id, l]));
  const have = (id, th) => fs.existsSync(framePath(id, th));
  for (const s of SHEETS) {
    const ids = s.rows.flatMap(r => r.ids);
    const missing = ids.filter(id => !have(id, 'day') || !have(id, 'night'));
    if (missing.length) { console.log('skip sheet', s.file, '(missing frames:', missing.join(', ') + ')'); continue; }
    const rows = s.rows.map(r => ({
      header: r.header, w: r.w, h: r.h,
      tiles: r.pair
        ? ['day', 'night'].map(th => ({ img: framePath(r.ids[0], th), label: byId[r.ids[0]].label.replace(/^/, th === 'day' ? 'Day: ' : 'Night: '), note: byId[r.ids[0]].note }))
        : r.ids.map(id => ({ img: framePath(id, r.theme), label: byId[id].label, note: byId[id].note, crop: !!r.crop })),
    }));
    buildSheet(s.file, s.title, s.sub, rows, s.width);
  }
}

(async () => {
  let errors = [];
  if (!flag('sheets-only')) errors = await render();
  if (!flag('no-sheets')) {
    try { buildSheets(); } catch (e) { errors.push('sheet error: ' + (e.stderr ? e.stderr.toString() : e.message)); }
  }
  fs.rmSync(TXT, { recursive: true, force: true });
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
