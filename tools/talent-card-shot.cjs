// The barn card with a talent's reveal line (Talents T1), one picture at iPhone size (390 x 844), day and night, and the
// Train picker past five stars. From tools/fixtures/barn/barn-six.json: Mochi (a Crystal Slime, Curly) has had lessons
// in Bounce, Speed and Smarts; her Potential in Smarts is 5, so Smarts is S and the card says "a natural at Smarts!".
// Then she has 5 Smarts stars and the Train picker offers the 6th (7 star places, 80 pearls).
//   node tools/talent-card-shot.cjs [--dpr 2]
//   pictures: tools/out/talents/barn-card-reveal-{day,night}.png, train-picker-6th-star-day.png
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const OUT = path.join(__dirname, 'out', 'talents');
fs.mkdirSync(OUT, { recursive: true });
const dprArg = process.argv.indexOf('--dpr');
const DPR = dprArg > 0 ? +process.argv[dprArg + 1] : 2;
const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'barn', 'barn-six.json'), 'utf8')).save;

(async () => {
  const errors = [];
  let kit = null;
  watchdog(20, () => kit ? kit.current() : 'setup');
  try {
    kit = await setup({ contextOptions: { viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true } });
    const { page, step, ev } = kit;
    await kit.context.addInitScript(save => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const s = JSON.parse(JSON.stringify(save)), now = Date.now();
      for (const x of s.ranch.residents) {
        if (x.trip) { x.trip.startAt = now - 600000; x.trip.homeAt = now + 3000000; }
        if (x.lesson) { x.lesson.startAt = now - 600000; x.lesson.doneAt = now + 7200000; }
      }
      const m = s.ranch.residents.find(x => x.name === 'Mochi');
      m.skills.smarts = 1;
      m.potential = { bounce: 2, speed: 3, sturdy: 2, smarts: 5, charm: 3 };
      m.talentsSeen = ['bounce', 'speed', 'smarts'];
      s.savedAt = now - 60000; s.ranch.lastVisit = now;
      localStorage.setItem('slimekin.save.v1', JSON.stringify(s));
    }, SAVE);
    await step('boot', async () => {
      await page.goto(`${kit.server.origin}/#debug`);
      await page.waitForFunction(() => window.slimekin && window.slimekin.state && window.slimekin.barnRanch && document.getElementById('boot').hidden, null, { timeout: 180000 });
      await ev(() => { const g = window.slimekin; g.behave.hour = () => 14; g.hud.closeModal(); });
    }, 240000);
    await step('open the barn', async () => {
      await page.click('#tab-ranch');
      await page.waitForFunction(() => { const b = window.slimekin.barnRanch; return (b.on && b.view.ready) || b.view.failed; }, null, { timeout: 180000 });
      const id = await ev(() => window.slimekin.state.ranch.residents.find(x => x.name === 'Mochi').id);
      await ev(i => { const g = window.slimekin; g.hud.setSheet('closed', false); g.barnRanch.show(i); g.advance(1.2); }, id);
      await page.waitForFunction(() => !window.slimekin.barnRanch.view.swapping, null, { timeout: 120000 });
    }, 300000);
    const card = await ev(() => { const c = document.getElementById('barnCard'); return { hidden: c.hidden, text: c.innerText.replace(/\s+/g, ' ').trim(), aria: c.getAttribute('aria-label'), h: c.offsetHeight, w: c.offsetWidth }; });
    log('card:', JSON.stringify(card));
    if (card.hidden || !/a natural at Smarts!/.test(card.text)) errors.push('the card does not show "a natural at Smarts!": ' + card.text);
    for (const dark of [false, true]) {
      await step(`screenshot ${dark ? 'night' : 'day'}`, async () => {
        await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark);
        await ev(() => window.slimekin.advance(3.2));
        for (let i = 0; i < 3; i++) { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, `barn-card-reveal-${dark ? 'night' : 'day'}.png`), timeout: 180000 }); }
      }, 600000);
    }
    await step('the Train picker past five stars', async () => {
      await ev(() => document.documentElement.setAttribute('data-theme', 'light'));
      const r = await ev(() => {
        const g = window.slimekin, m = g.state.ranch.residents.find(x => x.name === 'Mochi');
        m.skills.smarts = 5; g.state.ranch.pearls = 300;
        g.life.openTrain(m.id);
        const b = document.querySelector('.rl-pick[data-skill="smarts"]');
        return b ? { text: b.innerText.replace(/\s+/g, ' ').trim(), disabled: b.disabled, w: b.scrollWidth, cw: b.clientWidth } : null;
      });
      log('Train picker, Smarts:', JSON.stringify(r));
      if (!r || !/★★★★★☆☆/.test(r.text) || !/Star 6: .*80/.test(r.text) || r.disabled) errors.push('the Train picker does not offer a 6th Smarts star with 7 places: ' + JSON.stringify(r));
      if (r && r.w > r.cw + 1) errors.push('the Smarts row overflows: ' + JSON.stringify(r));
      for (let i = 0; i < 3; i++) { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, 'train-picker-6th-star-day.png'), timeout: 180000 }); }
    }, 300000);
    const fit = await ev(() => { const r = document.getElementById('barnCard').getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth, vh: innerHeight }; });
    if (fit.left < 0 || fit.right > fit.vw || fit.bottom > fit.vh) errors.push('the card does not fit the screen: ' + JSON.stringify(fit));
    log('card box:', JSON.stringify(fit));
    errors.push(...kit.errors);
    kit.report();
  } catch (e) {
    errors.push(e.message);
  } finally {
    if (kit) await kit.close();
  }
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log(`\nOK: ${path.join(OUT, 'barn-card-reveal-day.png')} and -night.png`);
})();
