// Smoke test: plays through the main flow in a headless phone-sized browser and saves screenshots.
// It hatches a slime, grows it to Settled, visits the ranch, moves it to the ranch (a new generation)
// and checks that nothing throws.
//
// One-time setup (outside the repo is fine; nothing here is committed):
//   npm install --no-save playwright three@0.170.0
//   npx playwright install chromium
// Run (starts its own dev server on port 5199):
//   node tools/smoke-test.cjs
// Screenshots land in tools/out/ (ignored by git).
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const PORT = 5199;
const THREE = path.resolve(path.dirname(require.resolve('three')), '..');   // three/build/three.cjs -> package folder
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve.mjs'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  // Software WebGL so it runs on machines without a GPU (slow, a few frames a second).
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  try {
    const page = await (await browser.newContext({ ...devices['iPhone 15 Pro'], deviceScaleFactor: 1 })).newPage();
    page.setDefaultTimeout(90000);
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    // three.js comes from a CDN in the page; serve it from node_modules instead
    await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', route => route.fulfill({ path: path.join(THREE, route.request().url().split('three@0.170.0/')[1]), contentType: 'text/javascript' }));
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    const ev = (fn, a) => page.evaluate(fn, a);
    // Headless Chrome only advances CSS transitions when it draws, so screenshots double as "settle".
    const shot = async name => { for (let i = 0; i < 2; i++) { await page.waitForTimeout(200); await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 90000 }); } console.log('screenshot', name); };

    await page.goto(`http://localhost:${PORT}/#debug`);   // #debug exposes the game as window.slimekin
    await page.waitForTimeout(3000);
    await ev(() => { const g = window.slimekin; for (let i = 0; i < 5; i++) g.tapEgg(g.egg.group.position.clone()); g.advance(4.5); });
    await page.fill('#slimeName', 'Smoke'); await page.click('#nameOk');
    await ev(() => {
      const g = window.slimekin;
      g.state.tutorial = 5; g.requests.timer = 1e9;
      Object.assign(g.state.slime.traits, { sweet: 22, heat: 16 });
      for (let i = 0; i < 3; i++) { g.debug('grow'); g.advance(3); g.hud.closeModal(); }   // to Settled
      g.state.totalJelly = 3e9;
      g.advance(1); g.hud.closeModal();
    });
    await shot('01-settled');
    await page.click('#tab-ranch');
    await ev(() => window.slimekin.advance(4));
    await shot('02-ranch');
    await page.click('#moveOutBtn');
    await page.click('#mvYes');
    const nav = page.waitForNavigation({ timeout: 60000 });
    await ev(() => window.slimekin.advance(6));               // goodbye, fade, save, reload
    await nav;
    await page.waitForTimeout(3500);
    const st = await ev(() => { const g = window.slimekin; return { phase: g.state.phase, generation: g.state.ranch.family.generation, residents: g.state.ranch.residents.length, pearls: g.state.ranch.pearls }; });
    await shot('03-new-egg');
    console.log('after moving out:', JSON.stringify(st));
    if (st.phase !== 'egg' || st.generation !== 2 || st.residents !== 1) errors.push('move to ranch did not start a new generation: ' + JSON.stringify(st));
  } catch (e) {
    errors.push('test error: ' + e.message);
  } finally {
    await browser.close();
    server.kill();
  }
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
