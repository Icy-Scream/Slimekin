// Recipe body samples (slice B1): renders the new body in a headless phone-sized browser (393x852, DPR 2), day and
// night, and builds labeled contact sheets from the frames:
//   stages-day / stages-night   Curly and Dollop (plain, Cat-ear, Topknot) at the four stages
//   inbetweens                  bred in-betweens (a few mix values), baby and grown
//   outfits                     every outfit (and the nightcap) on a grown Curly and a grown Dollop
//   forms-curly / forms-dollop  the 22 grown-up forms and 4 spark looks on both breeds (known rough until the refit)
//   ranch                       the ranch with 10 residents, day and night, and a visit
//   nursery                     the Nursery's special eggs, the full nest, the move-out choice, the Breed line
//   touch                       the real touch pulls from tools/recipe-smoke.cjs (run it first; skipped otherwise)
// It also measures the body's cost (pet shape pass, per-resident update, draw calls with 10 residents) into
// perf.json next to the sheets.
//
// Setup as in tools/smoke-test.cjs (playwright + three@0.170.0 outside the repo, found through NODE_PATH); its own
// dev server on a free loopback port, offline (tools/browser-kit.cjs). Sheets need ffmpeg on the PATH.
//   node tools/recipe-samples.cjs [--out DIR] [--dpr 2] [--only stages,inbetweens,outfits,forms,ranch,nursery]
//        [--outfit scarf,...] [--sheets-only]
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const flag = name => process.argv.includes('--' + name);
const OUT = path.resolve(arg('out', path.join(__dirname, 'out', 'recipe-body', 'samples')));
const FRAMES = path.join(__dirname, 'out', 'recipe-body', 'frames');
const SMOKE = path.join(__dirname, 'out', 'recipe-body');
const DPR = Number(arg('dpr', 2));
const ONLY = arg('only', '');
const want = k => !ONLY || ONLY.split(',').includes(k);
const OUTFIT = arg('outfit', '');   // --outfit scarf,bowtie: only these outfits (with --only outfits)
const VIEW = { width: 393, height: 852 };
fs.mkdirSync(FRAMES, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

// ---------- what to render ----------
const STAGE_NAMES = ['Hatchling', 'Sprout', 'Rascal', 'Settled'];
const BREEDS4 = [
  { key: 'curly', label: 'Curly', body: { mix: 0, variant: 'plain' } },
  { key: 'dollop', label: 'Dollop', body: { mix: 1, variant: 'plain' } },
  { key: 'ears', label: 'Cat-ear Dollop', body: { mix: 1, variant: 'ears' } },
  { key: 'topknot', label: 'Topknot Dollop', body: { mix: 1, variant: 'topknot' } },
];
const MIXES = [0, 0.25, 0.5, 0.75, 1];
// a diet color for each form (its traits), as in tools/render-samples.cjs
const FORM_TRAITS = id => {
  if (id === 'mochi') return { sweet: 6, heat: 5, nature: 5, mineral: 4, spark: 4, prism: 4 };
  const SPARK = { smore: { sweet: 177, heat: 174, spark: 30, mineral: 5, prism: 5 }, honeycomb: { sweet: 211, nature: 160, prism: 6 },
    campfire: { heat: 152, nature: 133, sweet: 32, spark: 18, mineral: 12 }, storm: { spark: 106, prism: 67, mineral: 46, sweet: 38 } };
  if (id.startsWith('spark:')) return SPARK[id.slice(6)];
  const [a, b] = id.split('+');
  return b ? { [a]: 20, [b]: 16 } : { [a]: 34 };
};
const PLAIN_TRAITS = { sweet: 8, nature: 4 };
const RANCH10 = [
  { name: 'Curly', body: { mix: 0 }, form: 'heat+sweet' }, { name: 'Dollop', body: { mix: 1 }, form: 'nature' },
  { name: 'Cat-ear', body: { mix: 1, variant: 'ears' }, form: 'mochi' }, { name: 'Topknot', body: { mix: 1, variant: 'topknot' }, form: 'prism' },
  { name: 'Mix 25%', body: { mix: 0.25 }, form: 'spark' }, { name: 'Mix 50%', body: { mix: 0.5 }, form: 'mineral+nature' },
  { name: 'Mix 75%', body: { mix: 0.75, variant: 'ears' }, form: 'nature+sweet' }, { name: 'Curly 2', body: { mix: 0, genes: { tall: 1.07, wide: 0.94, lump: 1.3, side: 0.03 } }, form: 'sweet' },
  { name: 'Dollop 2', body: { mix: 1, genes: { tall: 0.93, wide: 1.06, lump: 0.7, side: -0.03 } }, form: 'spark:storm' }, { name: 'Mix 40%', body: { mix: 0.4 }, form: 'prism+spark' },
];

const safe = id => id.replace(/[^a-z0-9+-]+/gi, '_');
const framePath = (id, theme, ext = 'png') => path.join(FRAMES, `${safe(id)}-${theme}.${ext}`);

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
  const perf = {};
  const setTheme = async dark => { await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark); await page.waitForTimeout(300); };
  const shot = async file => {
    for (let i = 0; i < 2; i++) {
      await ev(() => { const s = window.slimekin.slime; s.blinkT = 99; s.blinkPhase = -1; s.blink = 0; });
      await page.waitForTimeout(250);
      await page.screenshot({ path: file, timeout: 120000 });
    }
  };
  // a square crop around the pet (from its feet to above its top), saved next to the frame
  const clipPet = (id, theme, extra = {}) => ev(() => {
    const g = window.slimekin, sl = g.slime, V = () => g.v1.clone().set(0, 0, 0);
    const b = g.screenOf(sl.root.getWorldPosition(V())), t = g.screenOf(sl.headTopWorld(V()));
    const h = Math.max(60, b.y - t.y), side = Math.min(h * 2.1, innerWidth), cy = (b.y + t.y) / 2 - h * 0.12;
    return { x: (b.x + t.x) / 2 - side / 2, y: cy - side / 2, w: side, h: side };
  }).then(clip => fs.writeFileSync(framePath(id, theme, 'json'), JSON.stringify({ id, theme, clip, dpr: DPR, ...extra }, null, 1)));
  // the pet in a given body, stage, diet, form and outfits
  const pose = (o) => ev(o => {
    const g = window.slimekin, sl = g.slime, st = g.state.slime;
    const { STAGES } = g._content;
    const keys = Object.keys(st.traits), t = Object.fromEntries(keys.map(k => [k, (o.traits || {})[k] || 0]));
    Object.assign(st.traits, t); sl.setTraits(t); sl.color.copy(sl.targetColor);
    g.debugBody({ mix: o.body.mix, variant: o.body.variant || 'plain' }, { instant: true });
    if (o.body.genes) { st.genes = { ...st.genes, ...o.body.genes }; sl.setRecipe(st, { instant: true }); }
    else { st.genes = { tall: 1, wide: 1, lump: 1, side: 0 }; sl.setRecipe(st, { instant: true }); }
    st.growth = STAGES[o.stage].minGrowth;
    sl.setStage(o.stage, 0, true);
    sl.size = sl.sizeTarget = g.sim.size();
    sl.setForm(o.form || null, { pure: !!o.pure });
    st.worn = { head: null, face: null, neck: null, ...(o.worn || {}) }; sl.setOutfits(st.worn);
    sl.cap.on = !!o.cap; sl.cap.grow = o.cap ? 1 : 0;
    // (the sample slime grew up once, so it has the Grown-Up Ribbon; a baby in play never has a medal pin)
    if (sl.medalPin) sl.medalPin.sprite.visible = o.stage === 3;
    g.hud.closeModal(); g.debug('needs');
    g.advance(o.adv ?? 2.5);
    if (o.cap) { sl.cap.on = true; sl.cap.grow = 1; g.advance(0.3); }
    let bad = 0; for (const v of sl.geo.attributes.position.array) if (!Number.isFinite(v)) bad++;
    return { bad, m: sl.m, mix: sl.mixS };
  }, o);

  try {
    await step('open the game', () => page.goto(`${kit.server.origin}/#debug`));
    await step('boot', async () => {
      await page.waitForFunction(() => window.slimekin && window.slimekin.egg, null, { timeout: 120000 });
      await page.waitForTimeout(2500);
      await ev(async () => {
        const g = window.slimekin; g._content = await import('/src/data/content.js');
        g.behave.hour = () => 14; g.state.settings.quality = 'high'; g.applySettings(); g.debugInstant = true; g.instantEggs();
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
        for (const t of document.querySelectorAll('.toast')) t.remove();
      });
    });

    // ----- perf: the pet's shape pass and update (full body) -----
    perf.pet = await ev(() => {
      const g = window.slimekin, sl = g.slime, o = { x: 0, y: 0, z: 0 };
      const ms = fn => { fn(); const t0 = performance.now(); for (let k = 0; k < 40; k++) fn(); return +((performance.now() - t0) / 40).toFixed(2); };
      const shapePass = () => { const b = sl.base, az = sl.baseAz; for (let i = 0, j = 0; i < b.length; i += 3, j++) sl.shape(b[i], b[i + 1], b[i + 2], az[j], o, true); };
      const res = {};
      for (const [k, mix] of [['curly', 0], ['dollop', 1], ['mix50', 0.5]]) {
        g.debugBody({ mix, variant: 'plain' }, { instant: true }); g.advance(0.5);
        res[k] = { points: sl.geo.attributes.position.count, shapeMs: ms(shapePass), deformMs: ms(() => sl.deform()), updateMs: ms(() => sl.update(1 / 60)) };
      }
      sl.setQuality('low'); g.advance(0.3);
      res.lowQuality = { points: sl.geo.attributes.position.count, shapeMs: ms(shapePass), updateMs: ms(() => sl.update(1 / 60)) };
      sl.setQuality('high'); g.advance(0.3);
      return res;
    });
    log('perf pet', JSON.stringify(perf.pet));

    // ----- (1) the four breeds at the four stages, day and night -----
    if (want('stages')) for (const dark of [false, true]) {
      await setTheme(dark);
      const theme = dark ? 'night' : 'day';
      for (const b of BREEDS4) for (let s = 0; s < 4; s++) {
        const id = `stage-${b.key}-${s}`;
        const r = await step(`${id} ${theme}`, () => pose({ body: b.body, stage: s, traits: PLAIN_TRAITS, form: s === 3 ? 'mochi' : null }));
        if (r.bad) errors.push(`${id}: ${r.bad} non-finite points`);
        await shot(framePath(id, theme)); await clipPet(id, theme, r);
      }
    }
    await setTheme(false);

    // ----- (2) in-betweens, baby and grown -----
    if (want('inbetweens')) {
      for (const dark of [false, true]) {
        await setTheme(dark);
        const theme = dark ? 'night' : 'day';
        for (const [row, stage, variant] of [['baby', 0, 'plain'], ['grown', 3, 'plain'], ['ears', 3, 'ears']]) for (const mix of MIXES) {
          if (dark && row !== 'grown') continue;
          const id = `mix-${row}-${mix}`;
          if (row === 'ears' && mix === 0) continue;   // a Curly has no ears: the sheet shows the plain grown Curly there
          const r = await step(`${id} ${theme}`, () => pose({ body: { mix, variant }, stage, traits: PLAIN_TRAITS, form: stage === 3 ? 'mochi' : null }));
          if (r.bad) errors.push(`${id}: ${r.bad} non-finite points`);
          await shot(framePath(id, theme)); await clipPet(id, theme, r);
        }
      }
      await setTheme(false);
    }

    // ----- (3) every outfit on a grown Curly and a grown Dollop -----
    if (want('outfits')) {
      const outfits = await ev(() => window.slimekin._content.OUTFITS.map(o => ({ id: o.id, slot: o.slot, name: o.name })));
      for (const b of BREEDS4.slice(0, 2)) for (const o of [...outfits, { id: 'nightcap', slot: 'cap', name: 'Nightcap' }]) {
        if (OUTFIT && !OUTFIT.split(',').includes(o.id)) continue;
        const id = `outfit-${b.key}-${o.id}`;
        await step(id, () => pose({ body: b.body, stage: 3, traits: PLAIN_TRAITS, form: 'mochi', worn: o.slot === 'cap' ? {} : { [o.slot]: o.id }, cap: o.slot === 'cap' }));
        await shot(framePath(id, 'day')); await clipPet(id, 'day', { name: o.name });
      }
      perf.outfits = outfits;
    }

    // ----- (4) the 22 forms and 4 spark looks on both breeds (not refit yet) -----
    if (want('forms')) {
      const forms = await ev(() => { const C = window.slimekin._content; return [...Object.entries(C.FORM_BY_ID).map(([id, f]) => ({ id, name: f.name })), ...C.SPARK_FORMS.map(s => ({ id: 'spark:' + s.id, name: s.name }))]; });
      perf.forms = forms;
      for (const b of BREEDS4.slice(0, 2)) for (const f of forms) {
        const id = `form-${b.key}-${f.id}`;
        const r = await step(id, () => pose({ body: b.body, stage: 3, traits: FORM_TRAITS(f.id), form: f.id }));
        if (r.bad) errors.push(`${id}: ${r.bad} non-finite points`);
        await shot(framePath(id, 'day')); await clipPet(id, 'day', { name: f.name });
      }
    }

    // ----- (5) the ranch with 10 residents -----
    if (want('ranch')) {
      await pose({ body: { mix: 0 }, stage: 3, traits: PLAIN_TRAITS, form: 'mochi' });
      await step('ten residents', () => ev(list => {
        const g = window.slimekin, keys = Object.keys(g.state.slime.traits);
        const T = id => { const f = id; if (f === 'mochi') return { sweet: 6, heat: 5, nature: 5, mineral: 4, spark: 4, prism: 4 }; if (f.startsWith('spark:')) return { spark: 106, prism: 67, mineral: 46, sweet: 38 }; const [a, b] = f.split('+'); return b ? { [a]: 20, [b]: 16 } : { [a]: 34 }; };
        g.ranch.sync(list.map((d, i) => ({ id: 'sample' + i, name: d.name, traits: Object.fromEntries(keys.map(k => [k, T(d.form)[k] || 0])), form: { id: d.form, pure: false },
          breed: d.body.mix === 0 ? 'curly' : d.body.mix === 1 ? 'dollop' : 'mixed', variant: d.body.variant || 'plain', mix: d.body.mix, genes: { tall: 1, wide: 1, lump: 1, side: 0, ...(d.body.genes || {}) } })));
        // spread over the meadow, clear of the barn, pond, trees, basket and the Nursery's yard
        // (the two that get visited stand where the close-up camera has a clear view)
        const spots = [[-1.2, -2.2], [2.0, -3.4], [0.8, -1.9], [-1.4, 0.9], [-2.8, 0.0], [0, 0.2], [2.6, 1.6], [3.6, -3.6], [1.9, 3.6], [-0.4, 2.4]];
        let i = 0;
        for (const r of g.ranch.residents.values()) {
          const [x, z] = spots[i++ % spots.length];
          r.holder.position.x = x; r.holder.position.z = z; r.holder.rotation.y = 0; r.heading = 0; r.state = 'idle'; r.timer = 1e9;
        }
      }, RANCH10));
      await page.click('#tab-ranch');
      await ev(() => { const g = window.slimekin; g.hud.setSheet && g.hud.setSheet('closed', false); g.advance(5); });
      perf.ranch = await ev(() => {
        const g = window.slimekin, res = [...g.ranch.residents.values()];
        const ms = fn => { fn(); const t0 = performance.now(); for (let k = 0; k < 40; k++) fn(); return (performance.now() - t0) / 40; };
        // per resident: reshaping every frame (lod 1: the one you visit) and every other frame (lod 2: the rest while you watch)
        const perLod = lod => res.map(r => { const was = r.av.lod; r.av.lod = lod; const v = ms(() => r.av.update(1 / 60)); r.av.lod = was; return v; });
        const per = perLod(1), per2 = perLod(2);
        const o = { x: 0, y: 0, z: 0 };
        const shape = res.map(r => ms(() => { const av = r.av, b = av.base, az = av.baseAz; for (let i = 0, j = 0; i < b.length; i += 3, j++) av.shape(b[i], b[i + 1], b[i + 2], az[j], o, true); }));
        const frame = ms(() => g.advance(1 / 60));
        g.stage.render(); const calls = g.stage.renderer.info.render.calls, tris = g.stage.renderer.info.render.triangles;
        const hid = res.map(r => { const v = r.holder.visible; r.holder.visible = false; return v; });
        g.stage.render(); const callsNone = g.stage.renderer.info.render.calls;
        res.forEach((r, i) => { r.holder.visible = hid[i]; });
        let finite = true; for (const r of res) for (const v of r.av.geo.attributes.position.array) if (!Number.isFinite(v)) finite = false;
        const avg = a => +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2);
        return { residents: res.length, points: res[0].av.geo.attributes.position.count, updateMsAvg: avg(per), updateMsMax: +Math.max(...per).toFixed(2), shapeMsAvg: avg(shape),
          updateMsAvgLod2: avg(per2), updateMsAll10Lod1: +per.reduce((s, x) => s + x, 0).toFixed(2), updateMsAll10Watching: +(per2.reduce((s, x) => s + x, 0)).toFixed(2), gameFrameMs: +frame.toFixed(2), drawCalls: calls, drawCallsWithoutResidents: callsNone, perResidentCalls: +((calls - callsNone) / res.length).toFixed(1), triangles: tris, finite };
      });
      log('perf ranch', JSON.stringify(perf.ranch));
      if (!perf.ranch.finite) errors.push('ranch: non-finite points');
      for (const dark of [false, true]) {
        await setTheme(dark);
        await ev(() => window.slimekin.advance(1.5));
        await shot(framePath('ranch-10', dark ? 'night' : 'day'));
      }
      await setTheme(false);
      await ev(() => { const g = window.slimekin; g.focusResident('sample2'); g.advance(4.5); });
      await shot(framePath('ranch-visit', 'day'));
      await ev(() => { const g = window.slimekin; g.focusResident('sample5'); g.advance(4.5); });
      await shot(framePath('ranch-visit2', 'day'));
      await ev(() => { const g = window.slimekin; g.focusResident(null); g.leaveRanch(); g.advance(2); });
    }

    // ----- (6) the Nursery's special eggs and the menus around them -----
    if (want('nursery')) {
      await ev(() => { const g = window.slimekin; g.leaveRanch(); g.ranch.sync([]); g.state.ranch.residents = []; g.state.ranch.pearls = 180; g.state.ranch.nursery.eggs = []; g.syncNursery(); g.advance(1); });
      const openNursery = async () => {
        await page.click('#tab-ranch');
        await ev(() => { const g = window.slimekin; g.advance(2); g.openNursery(); g.hud.setSheet('tall'); g.advance(1.5); });
        await ev(() => { const el = document.getElementById('body-ranch'), t = el.querySelector('.special-egg'); if (t) el.scrollTop = Math.max(0, t.offsetTop - 150); });
      };
      await openNursery();
      for (const dark of [false, true]) { await setTheme(dark); await shot(framePath('nursery-special', dark ? 'night' : 'day')); }
      await setTheme(false);
      await page.click('button[data-act="buySpecial"][data-variant="ears"]');
      await ev(() => { const g = window.slimekin; g.advance(1); g.hud.renderRanch(true); });
      await ev(() => { const el = document.getElementById('body-ranch'), t = el.querySelector('.egg-card'); if (t) el.scrollTop = Math.max(0, t.offsetTop - 120); });
      await shot(framePath('nursery-bought', 'day'));
      await ev(() => { const g = window.slimekin; g.state.ranch.pearls = 40; g.hud.renderRanch(true); });
      await ev(() => { const el = document.getElementById('body-ranch'), t = el.querySelector('.special-egg'); if (t) el.scrollTop = Math.max(0, t.offsetTop - 150); });
      await shot(framePath('nursery-short', 'day'));
      // the move-out choice with the Cat-ear egg
      await ev(() => { const g = window.slimekin; g.closeNursery(); g.state.totalJelly = Math.max(g.state.totalJelly, 3e9); g.advance(2); });
      await page.click('#moveOutBtn');
      await ev(() => window.slimekin.advance(1.5));
      await shot(framePath('moveout-choice', 'day'));
      await ev(() => { const g = window.slimekin; g.hud.closeModal(); g.advance(1); });
      // your slime's page: the Breed line
      await ev(() => { const g = window.slimekin; g.debugBody({ mix: 0.5, variant: 'plain' }, { instant: true }); g.advance(1); });
      await page.click('#tab-slime');
      await ev(() => { const g = window.slimekin; g.advance(1.5); for (const t of document.querySelectorAll('.toast')) t.remove(); const el = document.querySelector('.breed-line'); if (el) el.scrollIntoView({ block: 'center' }); });
      await shot(framePath('slime-page', 'day'));
    }
  } catch (e) {
    errors.push('render error: ' + (e.stack || e.message));
  } finally {
    errors.unshift(...kit.errors);
    kit.report();
    await kit.close();
  }
  // (a partial run with --only keeps the numbers it did not measure again)
  const pf = path.join(OUT, 'perf.json'), before = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, 'utf8')) : {};
  fs.writeFileSync(pf, JSON.stringify({ ...before, ...perf, measuredAt: new Date().toISOString() }, null, 1));
  return errors;
}

// ---------- contact sheets (ffmpeg; the same layout as tools/render-samples.cjs) ----------
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const BG = '0xfff6ec', INK = '0x4a3b4f', SOFT = '0x8a7a8f';
const TXT = path.join(__dirname, 'out', 'recipe-body', 'txt');
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
      f += ',' + draw(t.label, fit(t.label, tw - 8, 28), th + 8);
      if (t.note) f += ',' + draw(t.note, fit(t.note, tw - 8, 21, 0.58), th + 44, FONT_REG, SOFT);
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
  const have = f => fs.existsSync(f);
  const tile = (id, theme, label, note) => ({ img: framePath(id, theme), label, note, crop: true });
  const full = (img, label, note) => ({ img, label, note });
  const sheet = (file, title, sub, rows, width) => {
    const missing = rows.flatMap(r => r.tiles).filter(t => !have(t.img)).map(t => path.basename(t.img));
    if (missing.length) { console.log('skip sheet', file, '(missing:', missing.slice(0, 4).join(', ') + (missing.length > 4 ? ' ...' : '') + ')'); return; }
    buildSheet(file, title, sub, rows, width);
  };
  for (const theme of ['day', 'night']) {
    sheet(`1-stages-${theme}.png`, `Curly and Dollop at the four stages (${theme})`, 'one body, a recipe of numbers per breed; growing up only blends numbers (grown: Marshmallow form, not refit)',
      BREEDS4.map(b => ({ header: b.label, w: 300, h: 300, tiles: STAGE_NAMES.map((s, i) => tile(`stage-${b.key}-${i}`, theme, s, b.label)) })), 1340);
  }
  sheet('2-inbetweens.png', 'Bred in-betweens: Curly x Dollop (only from the Nursery)', 'mix 0 = Curly, 1 = Dollop; a Curly x Dollop egg gets a mix between 0.25 and 0.75',
    [['baby', 'Hatchling', 'day'], ['grown', 'Settled', 'day'], ['ears', 'Settled, with cat ears', 'day'], ['grown', 'Settled (night)', 'night']].map(([row, h, theme]) => ({
      header: h, w: 260, h: 260, tiles: MIXES.map(m => row === 'ears' && m === 0
        ? tile('mix-grown-0', theme, 'Curly', 'no ears on a Curly')
        : tile(`mix-${row}-${m}`, theme, m === 0 ? 'Curly' : m === 1 ? (row === 'ears' ? 'Cat-ear Dollop' : 'Dollop') : `mix ${m}`, m === 0 || m === 1 ? 'pure' : 'in-between')) })), 1400);
  const outfitIds = fs.existsSync(FRAMES) ? [...new Set(fs.readdirSync(FRAMES).filter(f => /^outfit-curly-.*-day\.png$/.test(f)).map(f => f.replace(/^outfit-curly-|-day\.png$/g, '')))] : [];
  const nameOf = id => { try { return JSON.parse(fs.readFileSync(framePath(`outfit-curly-${id}`, 'day', 'json'), 'utf8')).name || id; } catch { return id; } };
  if (outfitIds.length) {
    const half = Math.ceil(outfitIds.length / 2);
    const rows = [];
    for (const b of BREEDS4.slice(0, 2)) for (const part of [outfitIds.slice(0, half), outfitIds.slice(half)]) rows.push({ header: `${b.label}, grown`, w: 250, h: 250, tiles: part.map(id => tile(`outfit-${b.key}-${id}`, 'day', nameOf(id), b.label)) });
    sheet('3-outfits.png', 'Every outfit on a grown Curly and a grown Dollop', 'does it sit on the body? (Marshmallow form)', rows, 1400);
  }
  const formIds = fs.existsSync(FRAMES) ? [...new Set(fs.readdirSync(FRAMES).filter(f => /^form-curly-.*-day\.png$/.test(f)).map(f => f.replace(/^form-curly-|-day\.png$/g, '')))] : [];
  const formName = (b, id) => { try { return JSON.parse(fs.readFileSync(path.join(FRAMES, `form-${b}-${id}-day.json`), 'utf8')).name; } catch { return id; } };
  if (formIds.length) for (const b of BREEDS4.slice(0, 2)) {
    const rows = [];
    for (let i = 0; i < formIds.length; i += 7) rows.push({ w: 230, h: 230, tiles: formIds.slice(i, i + 7).map(id => ({ img: path.join(FRAMES, `form-${b.key}-${id}-day.png`), label: formName(b.key, id).replace(/ Slime$/, ''), note: id.startsWith('spark_') ? 'spark' : '', crop: true })) });
    sheet(`4-forms-${b.key}.png`, `The 22 forms and 4 sparks on a grown ${b.label}`, 'known rough until the refit: the forms are not refit to the new body in this slice', rows, 1720);
  }
  sheet('5-ranch.png', 'The ranch with 10 residents (lite body)', 'Curly, Dollop, Cat-ear, Topknot and in-betweens, each with a form; a visit shows the full face and bubbles',
    [{ w: 393, h: 852, tiles: [full(framePath('ranch-10', 'day'), 'Day'), full(framePath('ranch-10', 'night'), 'Night'), full(framePath('ranch-visit', 'day'), 'Visiting the Cat-ear'), full(framePath('ranch-visit2', 'day'), 'Visiting an in-between')] }], 1700);
  sheet('6-nursery.png', 'Special eggs in the Nursery', 'Cat-ear and Topknot eggs for pearls, the type guaranteed; friendly reasons when the nest is full or pearls are short',
    [{ w: 393, h: 852, tiles: [full(framePath('nursery-special', 'day'), 'Special eggs', 'day'), full(framePath('nursery-special', 'night'), 'Special eggs', 'night'), full(framePath('nursery-bought', 'day'), 'Bought: waits in the nest'), full(framePath('nursery-short', 'day'), 'Not enough pearls')] },
      { w: 393, h: 852, tiles: [full(framePath('moveout-choice', 'day'), 'Move-out: choose the egg'), full(framePath('slime-page', 'day'), 'Your slime: the Breed line')] }], 1700);
  const pulls = [['02-curly-baby-pull', 'Curly baby'], ['04-curly-teen-pull', 'Curly teen'], ['06-curly-grown-pull', 'Curly grown'], ['09-dollop-ears-baby-pull', 'Cat-ear Dollop baby'], ['12-dollop-ears-grown-pull', 'Cat-ear Dollop grown']]
    .map(([f, l]) => full(path.join(SMOKE, `${f}-day.png`), l, 'real touch drag'));
  sheet('7-touch.png', 'Pulling the tip with a real touch (recipe-smoke frames)', 'Curly: the curl tip follows the finger and straightens; Dollop: the top of the dome', [{ w: 393, h: 852, tiles: pulls }], 2100);
}

(async () => {
  let errors = [];
  if (!flag('sheets-only')) errors = await render();
  try { buildSheets(); } catch (e) { errors.push('sheet error: ' + (e.stderr ? e.stderr.toString() : e.message)); }
  fs.rmSync(TXT, { recursive: true, force: true });
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
