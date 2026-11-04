// Breeding smoke test: plays the breeding core in a headless phone-sized browser (393x852), starting from an
// old generation-3 save (made with the code before breeding, tools/fixtures/main-gen3.json): hatch and grow
// the current baby, add two Candy Slimes to the ranch, make a spark egg and a Pure egg in the Nursery, wait
// out the timer with g.advance, move out choosing the spark egg, hatch it, raise it on the recipe to Settled
// (S'more Slime), then do the same with the Pure egg (Pure Candy Slime), and open the family tree. Fails on
// any page error. Screenshots (day and night) go to tools/out/breeding/.
//
// Setup as in tools/smoke-test.cjs (playwright + three@0.170.0 outside the repo, found through NODE_PATH).
// Starts its own dev server on a free loopback port and stops it on exit.
//   node tools/breeding-smoke.cjs [--dpr 2] [--quick]     (--quick: day screenshots only)
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'breeding');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const DPR = Number(arg('dpr', 2));
const QUICK = process.argv.includes('--quick');
const VIEW = { width: 393, height: 852 };
const THREE = path.resolve(path.dirname(require.resolve('three')), '..');
fs.mkdirSync(OUT, { recursive: true });
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'main-gen3.json'), 'utf8')).save;

function freePort(from = 5410) {
  let used = '';
  try { used = execFileSync('ss', ['-ltn'], { encoding: 'utf8' }); } catch { /* no ss: just try */ }
  for (let p = from; p < from + 200; p++) if (!new RegExp(`:${p}\\s`).test(used)) return p;
  throw new Error('no free port');
}

(async () => {
  const port = freePort();
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve.mjs'), String(port), '127.0.0.1'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const log = [];
  const note = (...a) => { const s = a.join(' '); log.push(s); console.log(s); };
  try {
    const dev = devices['iPhone 15 Pro'];
    const ctx = await browser.newContext({ userAgent: dev.userAgent, isMobile: true, hasTouch: true, viewport: VIEW, screen: VIEW, deviceScaleFactor: DPR });
    // the old save is on the "phone" before the new code first opens it
    await ctx.addInitScript(save => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('slimekin.save.v1', JSON.stringify(save)); } }, { ...FIXTURE, savedAt: Date.now() - 60000 });
    const page = await ctx.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', route => route.fulfill({ path: path.join(THREE, route.request().url().split('three@0.170.0/')[1]), contentType: 'text/javascript' }));
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    const ev = (fn, a) => page.evaluate(fn, a);
    const setTheme = async dark => { await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark); await page.waitForTimeout(300); await ev(() => window.slimekin.advance(0.5)); };
    // Headless Chrome only advances CSS transitions when it draws, so screenshots double as "settle".
    const shot = async (name, { night = !QUICK } = {}) => {
      for (const dark of night ? [false, true] : [false]) {
        await setTheme(dark);
        for (let i = 0; i < 2; i++) {
          await ev(() => { const s = window.slimekin.slime; s.blinkT = 99; s.blinkPhase = -1; s.blink = 0; });
          await page.waitForTimeout(250);
          await page.screenshot({ path: path.join(OUT, `${name}-${dark ? 'night' : 'day'}.png`), timeout: 120000 });
        }
      }
      await setTheme(false);
      note('screenshot', name);
    };
    const boot = async () => {
      await page.waitForFunction(() => window.slimekin && window.slimekin.state, null, { timeout: 60000 });
      await page.waitForTimeout(2500);
      await ev(() => { const g = window.slimekin; g.behave.hour = () => 14; g.state.settings.quality = 'high'; g.applySettings(); });
    };
    // steady scene for screenshots: daytime clock, no requests, glimmers or random moments
    const calm = () => ev(() => { const g = window.slimekin; g.state.tutorial = 5; g.requests.timer = 1e9; g.glimmerT = 1e9; g.debug('needs'); });
    const hatch = async name => {
      await ev(() => { const g = window.slimekin; for (let i = 0; i < 5; i++) g.tapEgg(g.egg.group.position.clone()); g.advance(4.5); });
      await page.waitForSelector('#slimeName');
      const title = await ev(() => document.querySelector('#modalCard h2').textContent);
      await page.fill('#slimeName', name); await page.click('#nameOk');
      await calm();
      return title;
    };
    // raise the slime to Settled on a diet through the real feeding rules (the tummy is emptied before each
    // snack so the test doesn't wait for digestion); returns the form it settled into
    // (keep: leave the grown-up card open for a screenshot)
    const raise = (diet, keep = false) => ev(({ diet, keep }) => {
      const g = window.slimekin, s = g.state.slime;
      let i = 0;
      for (let guard = 0; guard < 4000 && g.sim.stageIndex() < 3; guard++) {
        const stage = ['hatchling', 'sprout', 'rascal', 'settled'][g.sim.stageIndex()];
        const list = (diet[stage] || diet.hatchling).filter(f => g.sim.foodUnlocked(f));
        s.tummy = 30;
        const before = { ...s.traits };
        const r = g.sim.feed(list[i++ % list.length], { free: true });
        g.afterFeed(r, before); g.react(r);
        g.advance(0.2); g.hud.closeModal();
      }
      if (keep) {
        // wait for the grown-up card (it has the form name); close any earlier stage cards on the way
        for (let k = 0; k < 16 && !document.querySelector('#modalCard .form-name'); k++) { g.advance(0.5); if (!document.querySelector('#modalCard .form-name')) g.hud.closeModal(); }
      } else for (let k = 0; k < 4; k++) { g.advance(1); g.hud.closeModal(); }
      g.requests.timer = 1e9; g.glimmerT = 1e9;
      g.debug('needs');
      return { form: s.form, traits: s.traits, lineage: s.lineage, card: document.getElementById('modalCard')?.innerText || '' };
    }, { diet, keep });
    const closeCard = () => ev(() => { const g = window.slimekin; for (let k = 0; k < 3; k++) { g.hud.closeModal(); g.advance(1); } g.hud.closeModal(); g.debug('needs'); g.advance(1); });

    // ---------- 1. the old save opens; the current baby hatches and grows up ----------
    await page.goto(`http://127.0.0.1:${port}/#debug`);
    await boot();
    const st0 = await ev(() => { const g = window.slimekin; return { phase: g.state.phase, gen: g.state.ranch.family.generation, residents: g.state.ranch.residents.map(x => x.name + ':' + x.form.name + ':line' + x.lineage.line), eggs: g.state.ranch.nursery.eggs.length }; });
    note('old save opened:', JSON.stringify(st0));
    if (st0.phase !== 'egg' || st0.residents.length !== 2) errors.push('old save did not load as expected: ' + JSON.stringify(st0));
    await hatch('Hazel');
    const r0 = await raise({ hatchling: ['cookie'] });
    note('Hazel settled:', r0.form.name);
    // two Candy Slimes join the ranch (as if raised earlier), and some pearls
    await ev(() => {
      const g = window.slimekin, R = g.state.ranch;
      const candy = (id, name, fav) => ({ id, name, form: { id: 'sweet', name: 'Candy Slime', blurb: 'Pure sugar and sunshine. Makes friends instantly.' },
        traits: { sweet: 250, heat: 0, mineral: 0, nature: 0, spark: 0, prism: 0 }, personality: { curious: 55, patient: 50, playful: 70, cuddly: 60, bold: 45 },
        bondXp: 200, bondLevel: 4, favorite: fav, dislike: 'iron', tricks: {}, worn: { head: null, face: null, neck: null }, bornAt: Date.now() - 864e5, movedAt: Date.now() - 36e5,
        generation: 1, runTotal: 2e9, jps: 120, happiness: 85, pearlT: 0, petAt: 0, memories: [], lineage: { line: 1, parents: [], spark: null, pure: null, egg: null, bias: null } });
      R.slots = 6;
      R.residents.push(candy('rc1', 'Sugar', 'cookie'), candy('rc2', 'Sprinkle', 'berry'));
      R.pearls = 80;
      g.ranch.sync(R.residents);
    });

    // ---------- 2. the Nursery on the ranch ----------
    await page.click('#tab-ranch');
    await ev(() => window.slimekin.advance(4));
    await shot('01-ranch-with-nursery');
    await page.click('[data-act="nursery"]');
    await ev(() => window.slimekin.advance(3));
    await shot('02-nursery-panel');

    // ---------- 3. a spark egg (Hearth x Marshmallow) and a Pure egg (Candy x Candy) ----------
    const pickParent = name => page.click(`.parent-pick:has-text("${name}")`);
    await pickParent('Juniper'); await pickParent('Pebble');
    await page.click('#breedBtn');
    await ev(() => window.slimekin.advance(3));
    await pickParent('Sugar'); await pickParent('Sprinkle');
    const msg = await ev(() => document.getElementById('breedMsg').textContent);
    note('picked Sugar + Sprinkle:', msg);
    await page.click('#breedBtn');
    await ev(() => window.slimekin.advance(3));
    const n1 = await ev(() => { const g = window.slimekin, R = g.state.ranch, rr = g.sim.ranch; return { pearls: R.pearls, eggs: rr.eggs().map(e => ({ parents: e.parents.map(p => p.name).join(' x '), spark: e.spark, pure: e.pure, bias: e.bias })), resting: R.residents.filter(x => rr.restingToday(x, g.nowMs())).map(x => x.name), sparks: R.sparks, nest: g.ranch.nestEggs.size }; });
    note('after breeding:', JSON.stringify(n1));
    if (n1.eggs.length !== 2 || n1.eggs[0].spark !== 'smore' || n1.eggs[1].pure !== 'sweet' || n1.pearls !== 80 - 50 || n1.nest !== 2) errors.push('breeding did not make the expected eggs: ' + JSON.stringify(n1));
    const restingBtn = await ev(() => [...document.querySelectorAll('.parent-pick')].filter(b => b.disabled).map(b => b.querySelector('b').textContent));
    note('resting today (buttons disabled):', restingBtn.join(', '));
    await shot('03-waiting-eggs');

    // ---------- 4. wait out the timer (1 hour of game time) ----------
    const t0 = Date.now();
    await ev(h => window.slimekin.advance(h * 3600 + 5, 1 / 10), 1);
    note(`advanced one hour of game time in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    await ev(() => window.slimekin.advance(1.5));
    const ready = await ev(() => { const g = window.slimekin; return g.sim.ranch.eggs().map(e => g.sim.ranch.eggReady(e, g.nowMs())); });
    note('eggs ready:', JSON.stringify(ready));
    if (!ready.every(Boolean)) errors.push('eggs not ready after the timer');
    await shot('04-eggs-ready');

    // ---------- 5. move out, choosing the spark egg ----------
    const skip = await ev(() => window.slimekin.timeSkip);
    await page.click('#nurseryBack');
    await ev(() => window.slimekin.advance(1));
    await page.click('#moveOutBtn');
    await page.waitForSelector('.egg-choice');
    await page.click('.choice.spark');
    await shot('05-egg-choice');
    const moveOut = async () => {
      await page.click('#mvYes');
      const nav = page.waitForNavigation({ timeout: 90000 });
      await ev(() => window.slimekin.advance(6));               // goodbye, fade, save, reload
      await nav;
      await boot();
      // keep the test clock where it was (the page reload starts a new game object)
      await ev(s => { window.slimekin.timeSkip = s; }, skip);
    };
    await moveOut();
    const st1 = await ev(() => { const g = window.slimekin, s = g.state; return { phase: s.phase, gen: s.ranch.family.generation, lineage: s.slime.lineage, traits: s.slime.traits, eggs: s.ranch.nursery.eggs.length, spark: !!g.eggSpark }; });
    note('after moving out with the spark egg:', JSON.stringify(st1));
    if (st1.phase !== 'egg' || st1.lineage.spark !== 'smore' || st1.lineage.parents.length !== 2 || !st1.spark) errors.push('the spark egg did not start the generation: ' + JSON.stringify(st1));
    await ev(() => window.slimekin.advance(2));
    await shot('06-arrival');
    await ev(() => { window.slimekin.hud.closeModal(); window.slimekin.advance(2); });
    await shot('06-spark-egg');

    // ---------- 6. hatch it and raise it on the recipe (sweet + warm) ----------
    const title1 = await hatch('Toasty');
    note('naming title:', title1);
    // the Slime tab tells about the baby's family and its spark
    await ev(() => { const g = window.slimekin; g.hud.openTab('slime'); g.advance(1.5); });
    await shot('06-spark-baby');
    const babyCard = await ev(() => document.getElementById('body-slime').innerText);
    if (!/family spark glows/i.test(babyCard)) errors.push('the Slime tab does not show the family spark');
    await ev(() => { const g = window.slimekin; document.getElementById('panel').classList.remove('open'); g.layoutChanged(); g.advance(1); });
    const r1 = await raise({ hatchling: ['cookie', 'chili'] }, true);
    note('Toasty settled:', r1.form.name, JSON.stringify(r1.traits));
    note('grown-up card:', JSON.stringify(r1.card));
    if (r1.form.id !== 'spark:smore') errors.push('raised on the recipe it did not become a S\'more Slime: ' + r1.form.name);
    if (!/family spark/i.test(r1.card)) errors.push('the grown-up card does not mention the family spark');
    await shot('07-smore-card');
    await closeCard();
    await shot('07-smore-settled');

    // ---------- 7. move out choosing the Pure egg; raise it like its parents (cookies) ----------
    await page.click('#tab-ranch');
    await ev(() => window.slimekin.advance(3));
    await page.click('#moveOutBtn');
    await page.waitForSelector('.egg-choice');
    await page.click('.choice[data-egg]:not([data-egg=""])');
    await moveOut();
    await ev(() => window.slimekin.hud.closeModal());
    await hatch('Glimmer');
    const r2 = await raise({ hatchling: ['cookie'] }, true);
    note('Glimmer settled:', r2.form.name, 'pure:', r2.form.pure);
    note('grown-up card:', JSON.stringify(r2.card));
    if (!r2.form.pure || r2.form.id !== 'sweet') errors.push('raised like its parents it did not become Pure: ' + r2.form.name);
    await shot('08-pure-card');
    await closeCard();
    await shot('08-pure-settled');

    // ---------- 8. the S'more Slime on the ranch ----------
    await page.click('#tab-ranch');
    await ev(() => window.slimekin.advance(3));
    const smoreId = await ev(() => window.slimekin.state.ranch.residents.find(x => x.form.spark === 'smore').id);
    await ev(id => { window.slimekin.focusResident(id); window.slimekin.advance(4); }, smoreId);
    await shot('09-smore-resident');
    await ev(() => window.slimekin.leaveRanch());

    // ---------- 9. the family tree in the Journal ----------
    await page.click('#tab-journal');
    await page.click('[data-jp="family"]');
    await ev(() => window.slimekin.advance(1));
    await shot('10-family-tree');
    const tree = await ev(() => document.getElementById('body-journal').innerText);
    note('family tree text:', JSON.stringify(tree.slice(0, 600)));
    const fin = await ev(() => { const s = window.slimekin.state; return { gen: s.ranch.family.generation, residents: s.ranch.residents.map(x => `${x.name} (${x.form.name}${x.lineage.parents.length ? ', child of ' + x.lineage.parents.map(p => p.name).join(' & ') : ''})`), sparks: s.ranch.sparks, pures: s.ranch.pures }; });
    note('final:', JSON.stringify(fin));
  } catch (e) {
    errors.push('test error: ' + (e.stack || e.message));
  } finally {
    await browser.close();
    server.kill();
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n') + '\n' + (errors.length ? 'FAILED\n' + errors.join('\n') : 'OK') + '\n');
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
