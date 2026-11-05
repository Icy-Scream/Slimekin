// Sample renderer: shows form looks (and egg samples) in a headless phone-sized browser, day and night,
// and builds labeled contact sheets from the frames. Used to send rendered samples before building
// a new look into the game (see AGENTS.md: "send rendered sample images first").
//
// Setup is the same as tools/smoke-test.cjs (playwright + three@0.170.0 installed outside the repo,
// found through NODE_PATH). Starts its own dev server on a free loopback port and stops it on exit.
//
//   node tools/render-samples.cjs                      render everything below, then build the sheets
//   node tools/render-samples.cjs --only smore         only looks/eggs whose key contains "smore"
//
// The flow sheets (Nursery, move-out, raised, journal) use the frames of tools/breeding-smoke.cjs (run it
// first, without --quick, so night frames exist too).
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
// key: frame name (defaults to id); traits: the diet the slime is shown with (missing trait keys are filled
// with 0); outfit: worn outfits; cap: nightcap on; pure: the Pure version of the form.
const LOOKS = [
  // the seven parent looks, for comparison
  { id: 'heat+sweet', label: 'Hearth', note: 'parent', traits: { sweet: 22, heat: 16 } },
  { id: 'mochi', label: 'Marshmallow', note: 'parent', traits: { sweet: 6, heat: 5, nature: 5, mineral: 4, spark: 4, prism: 4 } },
  { id: 'nature+sweet', label: 'Nectar', note: 'parent', traits: { nature: 20, sweet: 16 } },
  { id: 'sweet', label: 'Candy', note: 'parent', traits: { sweet: 34 } },
  { id: 'mineral+nature', label: 'Root', note: 'parent', traits: { nature: 20, mineral: 18 } },
  { id: 'prism+spark', label: 'Aurora', note: 'parent', traits: { prism: 20, spark: 18 } },
  { id: 'spark', label: 'Volt', note: 'parent', traits: { spark: 34 } },
  // the four spark forms (breeding only), with the traits the recipe gives
  { id: 'spark:smore', label: "S'more Slime", note: 'Hearth × Marshmallow', traits: { sweet: 177, heat: 174, spark: 30, mineral: 5, prism: 5 } },
  { id: 'spark:honeycomb', label: 'Honeycomb Slime', note: 'Nectar × Candy', traits: { sweet: 211, nature: 160, prism: 6 } },
  { id: 'spark:campfire', label: 'Campfire Slime', note: 'Hearth × Root', traits: { heat: 152, nature: 133, sweet: 32, spark: 18, mineral: 12 } },
  { id: 'spark:storm', label: 'Storm Slime', note: 'Aurora × Volt', traits: { spark: 106, prism: 67, mineral: 46, sweet: 38 } },
  // the hat rule: head pieces of spark forms stay, the hat or nightcap sits on top
  { key: 'hat:honeycomb:party', id: 'spark:honeycomb', label: 'Honeycomb + Party Hat', note: 'dipper stays', traits: { sweet: 211, nature: 160 }, outfit: { head: 'party' } },
  { key: 'hat:honeycomb:cap', id: 'spark:honeycomb', label: 'Honeycomb + nightcap', note: 'napping', traits: { sweet: 211, nature: 160 }, cap: true },
  { key: 'hat:storm:party', id: 'spark:storm', label: 'Storm + Party Hat', note: 'rainbow and bolt stay', traits: { spark: 106, prism: 67, mineral: 46, sweet: 38 }, outfit: { head: 'party' } },
  { key: 'hat:storm:cap', id: 'spark:storm', label: 'Storm + nightcap', note: 'napping', traits: { spark: 106, prism: 67, mineral: 46, sweet: 38 }, cap: true },
  { key: 'hat:honeycomb:crown', id: 'spark:honeycomb', label: 'Honeycomb + Tiny Crown', note: 'another hat', traits: { sweet: 211, nature: 160 }, outfit: { head: 'crown' } },
  { key: 'hat:storm:beret', id: 'spark:storm', label: 'Storm + Artist Beret', note: 'another hat', traits: { spark: 106, prism: 67, mineral: 46, sweet: 38 }, outfit: { head: 'beret' } },
  // Pure versions next to the normal form
  { key: 'form:sweet', id: 'sweet', label: 'Candy', note: 'normal', traits: { sweet: 259 } },
  { key: 'pure:sweet', id: 'sweet', label: 'Pure Candy', note: 'Candy × Candy', traits: { sweet: 259 }, pure: true },
  { key: 'form:heat+sweet', id: 'heat+sweet', label: 'Hearth', note: 'normal', traits: { sweet: 169, heat: 168, spark: 22 } },
  { key: 'pure:heat+sweet', id: 'heat+sweet', label: 'Pure Hearth', note: 'Hearth × Hearth', traits: { sweet: 169, heat: 168, spark: 22 }, pure: true },
  { key: 'form:prism+spark', id: 'prism+spark', label: 'Aurora', note: 'normal', traits: { spark: 100, prism: 70, mineral: 20, sweet: 20 } },
  { key: 'pure:prism+spark', id: 'prism+spark', label: 'Pure Aurora', note: 'Aurora × Aurora', traits: { spark: 100, prism: 70, mineral: 20, sweet: 20 }, pure: true },
  { key: 'form:mineral', id: 'mineral', label: 'Iron', note: 'normal', traits: { mineral: 132 } },
  { key: 'pure:mineral', id: 'mineral', label: 'Pure Iron', note: 'Iron × Iron', traits: { mineral: 132 }, pure: true },
  { key: 'form:nature', id: 'nature', label: 'Moss', note: 'normal', traits: { nature: 140, sweet: 20 } },
  { key: 'pure:nature', id: 'nature', label: 'Pure Moss', note: 'Moss × Moss', traits: { nature: 140, sweet: 20 }, pure: true },
].map(l => ({ key: l.id, ...l }));
const EGGS = [
  { id: 'egg:normal', label: 'Normal egg', note: 'a plain egg', spark: false },
  { id: 'egg:spark', label: 'Spark egg', note: 'twinkle; warm glow at night', spark: true },
];
const SPARK_IDS = ['spark:smore', 'spark:honeycomb', 'spark:campfire', 'spark:storm'];
const HAT_KEYS = ['hat:honeycomb:party', 'hat:honeycomb:cap', 'hat:storm:party', 'hat:storm:cap'];
const PURE_KEYS = ['pure:sweet', 'pure:heat+sweet', 'pure:prism+spark', 'pure:mineral'];
// ranch check: the spark forms and two Pure forms as residents (cheaper "lite" slimes), seen from the Ranch tab;
// at night they wear their nightcaps (napping)
const RANCH_LIST = [...SPARK_IDS.map(id => LOOKS.find(l => l.key === id)), LOOKS.find(l => l.key === 'pure:sweet'), LOOKS.find(l => l.key === 'pure:prism+spark')];
const RANCH = [{ id: 'ranch:all', label: 'Spark and Pure residents', note: 'lite residents, Ranch tab; nightcaps at night' }];
// frames from the breeding play-through (tools/breeding-smoke.cjs), for the flow sheets
const FLOW = path.join(__dirname, 'out', 'breeding');
const flow = (name, label, note) => ({ id: 'flow:' + name, label, note, flow: name });
const FLOWS = [
  flow('01-ranch-with-nursery', 'Ranch with the Nursery', 'front left of the meadow'),
  flow('02-nursery-panel', 'Nursery panel', 'pick two parents'),
  flow('03-waiting-eggs', 'Two eggs waiting', 'spark egg + Pure egg, timer'),
  flow('04-eggs-ready', 'Eggs ready', 'after an hour of game time'),
  flow('05-egg-choice', 'Moving out: which egg?', 'the spark egg picked'),
  flow('06-arrival', 'After moving out', 'the egg comes to the cushion'),
  flow('06-spark-egg', 'Spark egg on the cushion', 'from the Nursery'),
  flow('06-spark-baby', 'The spark baby', 'Slime tab: family card'),
  flow('07-smore-card', 'Grown up', "raised on the recipe: S'more"),
  flow('07-smore-settled', "S'more Slime", 'raised from the spark egg'),
  flow('08-pure-card', 'Grown up', 'raised like its parents'),
  flow('08-pure-settled', 'Pure Candy Slime', 'from two Candy parents'),
  flow('09-smore-resident', "S'more on the ranch", 'visiting it'),
  flow('10-family-tree', 'Journal: family tree', 'parents, spark forms, Pure'),
];
const F = name => 'flow:' + name;
const pairRow = (header, ids, w = 320, h = 694) => [
  { header: header + ' (day)', theme: 'day', ids, w, h },
  { header: header + ' (night)', theme: 'night', ids, w, h },
];
const SHEETS = [
  { file: '01-nursery.png', title: 'The Nursery on the ranch', sub: 'Breeding play-through from an old save, 393×852', width: 1330, rows: [
    ...pairRow('', ['01-ranch-with-nursery', '02-nursery-panel', '03-waiting-eggs', '04-eggs-ready'].map(F)),
  ] },
  { file: '02-move-out-and-spark-egg.png', title: 'Choosing the next egg, and the spark egg', sub: 'Move-out choice, arrival, the spark egg waiting to hatch', width: 1330, rows: [
    ...pairRow('', [F('05-egg-choice'), F('06-arrival'), F('06-spark-egg'), F('06-spark-baby')]),
    { header: 'Close-up: normal egg | spark egg (day) | spark egg (night)', theme: 'day', crop: true, ids: ['egg:normal', 'egg:spark', 'egg:spark@night'], w: 320, h: 320 },
  ] },
  { file: '03-spark-forms.png', title: 'The four spark forms', sub: "S'more (take B), Honeycomb (A), Campfire (A), Storm (A) as the main slime", width: 1330, rows: [
    ...pairRow('Main slime', SPARK_IDS),
    { header: 'Close-up (day)', theme: 'day', crop: true, ids: SPARK_IDS, w: 320, h: 320 },
    { header: 'Close-up (night)', theme: 'night', crop: true, ids: SPARK_IDS, w: 320, h: 320 },
  ] },
  { file: '04-ranch-residents.png', title: 'Spark and Pure slimes living on the ranch', sub: 'Lite residents. Left: day. Right: night, napping in nightcaps', width: 1000, rows: [
    { header: '', theme: 'day', ids: ['ranch:all'], w: 480, h: 1041, pair: true },
  ] },
  { file: '05-hats.png', title: 'Hats on spark forms: the head piece stays, the hat sits on top', sub: 'Honeycomb (dipper) and Storm (rainbow, bolt)', width: 1330, rows: [
    ...pairRow('', HAT_KEYS),
    { header: 'Close-up (day)', theme: 'day', crop: true, ids: HAT_KEYS, w: 320, h: 320 },
    { header: 'Other hats (close-up, day)', theme: 'day', crop: true, ids: ['hat:honeycomb:crown', 'hat:storm:beret'], w: 320, h: 320 },
  ] },
  { file: '06-pure.png', title: 'Pure versions (same form as both parents)', sub: 'Richer colors, a soft shimmer, a warm golden glow, twinkling stars', width: 1330, rows: [
    { header: 'Normal | Pure (close-up, day)', theme: 'day', crop: true, ids: ['form:sweet', 'pure:sweet', 'form:heat+sweet', 'pure:heat+sweet'], w: 320, h: 320 },
    { header: 'Normal | Pure (close-up, day)', theme: 'day', crop: true, ids: ['form:prism+spark', 'pure:prism+spark', 'form:mineral', 'pure:mineral'], w: 320, h: 320 },
    { header: 'Normal | Pure (close-up, night)', theme: 'night', crop: true, ids: ['form:sweet', 'pure:sweet', 'form:nature', 'pure:nature'], w: 320, h: 320 },
    ...pairRow('Pure, full screen', PURE_KEYS),
  ] },
  { file: '07-raised-and-journal.png', title: 'Raised from bred eggs, and the family tree', sub: 'From the play-through', width: 1330, rows: [
    ...pairRow('', [F('07-smore-card'), F('07-smore-settled'), F('08-pure-card'), F('08-pure-settled')]),
    ...pairRow('', [F('09-smore-resident'), F('10-family-tree')]),
  ] },
  { file: '00-parents.png', title: 'The parent forms, for comparison', sub: 'Hearth, Marshmallow, Nectar, Candy, Root, Aurora, Volt (close-up, day)', width: 1330, rows: [
    { header: '', theme: 'day', crop: true, ids: ['heat+sweet', 'mochi', 'nature+sweet', 'sweet'], w: 320, h: 320 },
    { header: '', theme: 'day', crop: true, ids: ['mineral+nature', 'prism+spark', 'spark'], w: 320, h: 320 },
  ] },
];
// ---------- helpers ----------
const safe = id => id.replace(/[^a-z0-9+-]+/gi, '_');
const framePath = (id, theme, ext = 'png') => path.join(FRAMES, `${safe(id)}-${theme}.${ext}`);
const matches = key => !ONLY || ONLY.split(',').some(s => key.includes(s));

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
          await ev(async ({ spark, dark }) => {
            const g = window.slimekin;
            const mod = await import('/src/view/egg-spark.js');
            if (g._spark) { g._spark.dispose(); g._spark = null; }
            if (spark) g._spark = mod.addEggSpark(g.egg, { night: dark });
            g.advance(2.5);
          }, { ...e, dark });
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

    const looks = LOOKS.filter(l => matches(l.key));
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
          const stats = await ev(async ({ id, traits, outfit, cap, pure }) => {
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
            sl.setForm(id, { pure: !!pure });
            g.state.slime.worn = { head: null, face: null, neck: null, ...(outfit || {}) };
            sl.setOutfits(g.state.slime.worn);
            sl.cap.on = !!cap;
            g.hud.closeModal(); g.debug('needs'); g.requests.timer = 1e9; g.glimmerT = 1e9;
            g.advance(4);
            if (cap) { sl.cap.on = true; sl.cap.grow = 1; g.advance(0.5); }
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
            lite.setTraits(t); lite.setForm(id, { pure: !!pure }); lite.size = lite.sizeTarget = 0.86;
            for (let i = 0; i < 20; i++) lite.update(1 / 10);
            lite.inner.visible = false;
            let liteObjs = 0, finite = true;
            lite.root.updateMatrixWorld(true);
            lite.root.traverseVisible(o => { if (o.isMesh || o.isSprite) { liteObjs++; const e = o.matrixWorld.elements; if (e.some(v => !Number.isFinite(v))) finite = false; } });
            if (!Array.from(lite.geo.attributes.position.array).every(Number.isFinite)) finite = false;
            sl.cap.on = false; sl.cap.grow = 0;
            return { callsNoForm: calls0, callsLook: calls1, callsLookNoProps: callsBare, propDrawCalls: calls1 - callsBare, objs0, objs1, propMeshes, liteObjs, liteFinite: finite };
          }, l);
          const file = framePath(l.key, theme);
          if (l.cap) await ev(() => { const sl = window.slimekin.slime; sl.cap.on = true; sl.cap.grow = 1; window.slimekin.advance(0.3); });
          await shot(file);
          await ev(() => { const g = window.slimekin, sl = g.slime; sl.cap.on = false; sl.cap.grow = 0; g.state.slime.worn = { head: null, face: null, neck: null }; sl.setOutfits(g.state.slime.worn); });
          const clip = await ev(() => {
            const g = window.slimekin, sl = g.slime, V = () => g.v1.clone().set(0, 0, 0);
            const b = g.screenOf(sl.root.getWorldPosition(V())), t = g.screenOf(sl.headTopWorld(V()));
            const h = b.y - t.y, side = Math.min(h * 2.05, innerWidth), cy = (b.y + t.y) / 2 - h * 0.14;
            return { x: (b.x + t.x) / 2 - side / 2, y: cy - side / 2, w: side, h: side };
          });
          fs.writeFileSync(framePath(l.key, theme, 'json'), JSON.stringify({ id: l.id, key: l.key, theme, clip, dpr: DPR, stats }, null, 1));
          console.log('look', l.key, theme, JSON.stringify(stats));
        }
      }
    }

    // ----- ranch residents (lite) -----
    if (wantRanch) {
      const list = RANCH_LIST.map((l, i) => ({ id: 'sample' + i, name: l.label, traits: l.traits, form: { id: l.id, pure: !!l.pure } }));
      await setTheme(false);
      await ev(list => {
        const g = window.slimekin;
        const keys = Object.keys(g.state.slime.traits);
        g.ranch.sync(list.map(d => ({ ...d, traits: Object.fromEntries(keys.map(k => [k, d.traits[k] || 0])) })));
        // stand them in rows facing the camera (clear of the barn and pond) and keep them there
        // two staggered rows, far enough apart that the front row doesn't hide the back row
        const spots = [[-2.3, -1.5], [-0.3, -1.5], [1.7, -1.5], [-1.7, 1.2], [0.3, 1.2], [2.3, 1.2]];
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
        // at night they nap in their nightcaps (the hat rule on the ranch)
        await ev(d => { const g = window.slimekin; for (const r of g.ranch.residents.values()) if (String(r.id).startsWith('sample')) { r.av.cap.on = d; r.state = d ? 'nap' : 'idle'; r.timer = 1e9; } g.advance(2); }, dark);
        const theme = dark ? 'night' : 'day';
        const file = framePath('ranch:all', theme);
        await shot(file);
        const info = await ev(() => {
          const g = window.slimekin, out = [];
          for (const r of g.ranch.residents.values()) {
            let n = 0, finite = true;
            r.av.root.traverseVisible(o => { if (o.isMesh || o.isSprite) { n++; if (o.matrixWorld.elements.some(v => !Number.isFinite(v))) finite = false; } });
            out.push({ form: r.av.formId, pure: r.av.pure, lite: r.av.lite, visibleObjs: n, finite });
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
  const byId = Object.fromEntries([...LOOKS.map(l => [l.key, l]), ...[...EGGS, ...RANCH, ...FLOWS].map(l => [l.id, l])]);
  // flow frames come from the breeding play-through; 'id@night' shows the night frame in a day row
  const src = (id, th) => {
    const [base, force] = id.split('@');
    const t = force || th, f = byId[base];
    return f && f.flow ? path.join(FLOW, `${f.flow}-${t}.png`) : framePath(base, t);
  };
  const have = (id, th) => fs.existsSync(src(id, th));
  for (const s of SHEETS) {
    const ids = s.rows.flatMap(r => r.ids);
    const missing = ids.filter(id => !have(id, 'day') || !have(id, 'night'));
    if (missing.length) { console.log('skip sheet', s.file, '(missing frames:', missing.join(', ') + ')'); continue; }
    const rows = s.rows.map(r => ({
      header: r.header, w: r.w, h: r.h,
      tiles: r.pair
        ? ['day', 'night'].map(th => ({ img: src(r.ids[0], th), label: byId[r.ids[0]].label.replace(/^/, th === 'day' ? 'Day: ' : 'Night: '), note: byId[r.ids[0]].note }))
        : r.ids.map(id => ({ img: src(id, r.theme), label: byId[id.split('@')[0]].label + (id.includes('@night') ? ' (night)' : ''), note: byId[id.split('@')[0]].note, crop: !!r.crop })),
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
