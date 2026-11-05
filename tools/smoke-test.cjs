// Smoke test: plays through the main flow in a headless phone-sized browser and saves screenshots.
// It hatches a slime, grows it to Settled, visits the ranch, moves it to the ranch (a new generation)
// and checks that nothing throws.
//
// One-time setup (outside the repo is fine; nothing here is committed):
//   npm install --no-save playwright three@0.170.0
//   npx playwright install chromium
// Run (starts its own dev server on a free port only reachable from this machine, and runs offline;
// see tools/browser-kit.cjs):
//   node tools/smoke-test.cjs
// Screenshots land in tools/out/ (ignored by git).
const path = require('path');
const fs = require('fs');
const { devices } = require('playwright');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const errors = [];
  let kit = null;
  watchdog(12, () => kit ? kit.current() : 'setup');
  try {
    kit = await setup({ contextOptions: { ...devices['iPhone 15 Pro'], deviceScaleFactor: 1 } });
    const { page, step, ev } = kit;
    page.setDefaultTimeout(90000);
    // Headless Chrome only advances CSS transitions when it draws, so screenshots double as "settle".
    const shot = name => step('screenshot ' + name, async () => {
      for (let i = 0; i < 2; i++) { await page.waitForTimeout(200); await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 90000 }); }
      log('screenshot', name);
    }, 200000);

    await step('open the game', () => page.goto(`${kit.server.origin}/#debug`));   // #debug exposes the game as window.slimekin
    await step('game starts', () => page.waitForFunction(() => window.slimekin && window.slimekin.egg, null, { timeout: 90000 }));
    await page.waitForTimeout(3000);
    await step('hatch', () => ev(() => { const g = window.slimekin; for (let i = 0; i < 5; i++) g.tapEgg(g.egg.group.position.clone()); g.advance(4.5); }));
    await step('name it', async () => { await page.fill('#slimeName', 'Smoke'); await page.click('#nameOk'); });
    await step('grow to Settled', () => ev(() => {
      const g = window.slimekin;
      g.state.tutorial = 5; g.requests.timer = 1e9;
      Object.assign(g.state.slime.traits, { sweet: 22, heat: 16 });
      for (let i = 0; i < 3; i++) { g.debug('grow'); g.advance(3); g.hud.closeModal(); }   // to Settled
      g.state.totalJelly = 3e9;
      g.advance(1); g.hud.closeModal();
    }));
    await shot('01-settled');
    await step('open the ranch', async () => { await page.click('#tab-ranch'); await ev(() => window.slimekin.advance(4)); });
    await shot('02-ranch');
    await step('move out', async () => {
      await page.click('#moveOutBtn');
      await page.click('#mvYes');
      // The goodbye runs on the game clock: advance() plays it (hop away, fade, save) and the page reloads at
      // its end. The navigation wait is armed before that and only waits for the new page to start; the new
      // game is then awaited on its own state rather than on the page's "load" event.
      const nav = page.waitForNavigation({ waitUntil: 'commit', timeout: 90000 });
      await ev(() => window.slimekin.advance(6));               // goodbye, fade, save, reload
      await nav;
    });
    await step('the new egg starts', () => page.waitForFunction(() => window.slimekin && window.slimekin.egg, null, { timeout: 120000 }), 150000);
    await page.waitForTimeout(3500);
    const st = await step('read the state', () => ev(() => { const g = window.slimekin; return { phase: g.state.phase, generation: g.state.ranch.family.generation, residents: g.state.ranch.residents.length, pearls: g.state.ranch.pearls }; }));
    await shot('03-new-egg');
    log('after moving out:', JSON.stringify(st));
    if (st.phase !== 'egg' || st.generation !== 2 || st.residents !== 1) errors.push('move to ranch did not start a new generation: ' + JSON.stringify(st));
  } catch (e) {
    errors.push('test error: ' + e.message);
  } finally {
    if (kit) { errors.unshift(...kit.errors); kit.report(); await kit.close(); }
  }
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
