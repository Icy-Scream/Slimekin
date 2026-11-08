// Contest screens (C1b): a picture of every new screen at iPhone size (393 x 852), day or night, for the contact sheets
// next to the approved mock-ups. From tools/fixtures/barn/barn-six.json: Peaches is renamed Pebble and made the mock-ups'
// story (Charm 5, Smarts 3, a natural at Charm, Little and Big Beauty Cups won); the family owns five outfits. The flow
// goes through the real screens with clicks: the resident page, the entry card, the show (act 1's cheer ring, held
// still for the picture), a loss (Good cheers), Dress up (Flower Crown, Round Glasses, Bow Tie), the entry card again,
// a win; then Juniper is made the Beauty Champion for the Ranch tab (title chip, Trophies) and the Trophy Shelf.
//   node tools/contest-shots.cjs [--night] [--dpr 2] [--fonts <dir with DynaPuff and M PLUS Rounded 1c .ttf>]
//   pictures: tools/out/contests/<screen>-<day|night>.png
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const NIGHT = process.argv.includes('--night');
const DPR = +arg('--dpr', 2);
const FONTS = arg('--fonts', process.env.SLIMEKIN_FONTS || '');
const T = NIGHT ? 'night' : 'day';
const OUT = path.join(__dirname, 'out', 'contests');
fs.mkdirSync(OUT, { recursive: true });
const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'barn', 'barn-six.json'), 'utf8')).save;

(async () => {
  const errors = [];
  let kit = null;
  watchdog(30, () => kit ? kit.current() : 'setup');
  try {
    kit = await setup({ contextOptions: { viewport: { width: 393, height: 852 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true } });
    const { page, step, ev, context } = kit;
    // the game's own fonts (the phone loads them from Google Fonts; the test is offline): from local files when given
    if (FONTS && fs.existsSync(FONTS)) {
      const files = fs.readdirSync(FONTS);
      const face = (fam, file, w) => files.includes(file) ? `@font-face{font-family:'${fam}';src:url(https://fonts.gstatic.com/local/${encodeURIComponent(file)}) format('truetype');font-weight:${w};font-display:block}` : '';
      const css = [face('DynaPuff', 'DynaPuff[wdth,wght].ttf', '400 700'), face('M PLUS Rounded 1c', 'MPLUSRounded1c-Medium.ttf', 500),
        face('M PLUS Rounded 1c', 'MPLUSRounded1c-Bold.ttf', 700), face('M PLUS Rounded 1c', 'MPLUSRounded1c-ExtraBold.ttf', 800)].join('\n');
      await context.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: css, contentType: 'text/css' }));
      await context.route('https://fonts.gstatic.com/local/**', r => r.fulfill({ path: path.join(FONTS, decodeURIComponent(r.request().url().split('/local/')[1])), contentType: 'font/ttf' }));
      log('fonts from', FONTS);
    }
    await context.addInitScript(([save, night]) => {
      const theme = () => document.documentElement && document.documentElement.setAttribute('data-theme', night ? 'dark' : 'light');
      if (document.documentElement) theme(); else document.addEventListener('DOMContentLoaded', theme);
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const s = JSON.parse(JSON.stringify(save)), now = Date.now();
      for (const x of s.ranch.residents) {
        if (x.trip) { x.trip.startAt = now - 600000; x.trip.homeAt = now + 3000000; }
        if (x.lesson) { x.lesson.startAt = now - 600000; x.lesson.doneAt = now + 7200000; }
      }
      const p = s.ranch.residents.find(x => x.id === 'rbarnpeach');
      p.name = 'Pebble';
      p.skills = { bounce: 0, speed: 0, sturdy: 0, smarts: 3, charm: 5 };
      p.potential = { bounce: 2, speed: 2, sturdy: 2, smarts: 3, charm: 3 };   // (a natural at Charm: grade A, +6)
      p.talentsSeen = ['charm', 'smarts'];
      p.happiness = 82;
      p.contests = { trophies: { beauty: 2, sprint: 0, bounce: 0 } };
      p.worn = { head: null, face: null, neck: null };
      s.outfits.owned = ['bow', 'bowtie', 'glasses', 'flowers', 'scarf'];
      s.ranch.contests = { shelf: {}, shows: 2 };
      s.ranch.pearls = 234;
      s.savedAt = now - 60000; s.ranch.lastVisit = now;
      localStorage.setItem('slimekin.save.v1', JSON.stringify(s));
    }, [SAVE, NIGHT]);
    const shot = async name => {
      for (let i = 0; i < 3; i++) { await page.waitForTimeout(220); await page.screenshot({ path: path.join(OUT, `${name}-${T}.png`), timeout: 180000 }); }
      log('picture', `${name}-${T}.png`);
    };
    const modalIs = kind => page.waitForFunction(k => !!document.querySelector(`#modalCard [data-cs-card="${k}"]`) && !document.getElementById('modal').hidden, kind, { timeout: 60000 });
    await step('boot', async () => {
      await page.goto(`${kit.server.origin}/#debug`);
      await page.waitForFunction(() => window.slimekin && window.slimekin.state && window.slimekin.barnRanch && document.getElementById('boot').hidden, null, { timeout: 180000 });
      await ev(() => { const g = window.slimekin; g.behave.hour = () => 14; g.hud.closeModal(); });
    }, 240000);
    await step('open the barn', async () => {
      await page.click('#tab-ranch');
      await page.waitForFunction(() => { const b = window.slimekin.barnRanch; return (b.on && b.view.ready) || b.view.failed; }, null, { timeout: 180000 });
      await ev(() => { const g = window.slimekin; g.hud.closeModal(); g.focusResident('rbarnpeach'); });
      await page.waitForFunction(() => { const b = window.slimekin.barnRanch; return b.curId === 'rbarnpeach' && !b.view.swapping; }, null, { timeout: 120000 });
      const grade = await ev(() => window.slimekin.contests.preview('rbarnpeach', 'beauty', 'none').flair);
      log('Pebble\'s flair:', JSON.stringify(grade));
    }, 300000);
    await step('the resident page', async () => {
      await ev(() => { const g = window.slimekin; g.hud.closeModal(); g.hud.renderRanch(true); const el = document.querySelector('#body-ranch .rl-skills'); if (el) el.scrollIntoView({ block: 'start' }); document.getElementById('body-ranch').scrollTop -= 6; });
      await page.waitForTimeout(800);
      await shot('resident');
    }, 300000);
    await step('the entry card', async () => {
      await page.click('#body-ranch [data-cs="enter"]');
      await modalIs('entry');
      await shot('entry');
    }, 300000);
    const startAndRing = async () => {
      await page.click('#modalCard [data-cs="start"]');
      await page.waitForFunction(() => { const i = window.slimekin.contestShow.info(); return i.on && i.phase !== 'swap'; }, null, { timeout: 120000 });
      await ev(() => { const s = window.slimekin.contestShow.s; if (s.phase === 'open') s.t = 99; });
      await page.waitForFunction(() => window.slimekin.contestShow.info().phase === 'perform', null, { timeout: 60000 });
      await ev(() => { window.slimekin.contestShow.s.t = window.slimekin.contestShow.s.t + 1.5; });
    };
    // the rest of a show: each act's cheer is the given grade (the show's own graded(), as a tap would), no waiting
    const finishShow = async grades => {
      for (let i = 0; i < 3; i++) {
        await page.waitForFunction(n => { const s = window.slimekin.contestShow.s; if (!s) return true; if (s.act === n && s.phase === 'ring') return true; if (s.phase !== 'ring' && s.phase !== 'finale') s.t = 99; return false; }, i, { timeout: 120000, polling: 200 });
        await ev(gr => { const sh = window.slimekin.contestShow; if (sh.s && sh.s.phase === 'ring') sh.debugCheer(gr); }, grades[i]);
      }
      await page.waitForFunction(() => { const s = window.slimekin.contestShow.s; if (!s) return true; s.t = 99; return false; }, null, { timeout: 120000, polling: 200 });
    };
    await step('the show (act 1, the ring)', async () => {
      await startAndRing();
      await page.waitForFunction(() => { const s = window.slimekin.contestShow.s; if (s.phase === 'perform') s.t = 99; return s.phase === 'ring' && s.ring && s.ring.anim; }, null, { timeout: 60000, polling: 200 });
      // hold the pink ring a little outside the gold one for the picture (the mock-up's moment)
      await ev(() => { const r = window.slimekin.contestShow.s.ring; r.anim.pause(); r.anim.currentTime = 0.72 * 1000 * window.slimekin.contestShow.info().beat; r.t0 = performance.now() + 1e6; });
      await page.waitForTimeout(600);
      await shot('show');
      await ev(() => { const r = window.slimekin.contestShow.s.ring; r.t0 = performance.now(); r.anim.play(); });
    }, 300000);
    await step('a loss', async () => {
      await finishShow(['good', 'good', 'good']);
      await modalIs('result');
      const t = await ev(() => document.getElementById('modalCard').innerText.replace(/\s+/g, ' '));
      log('loss card:', t);
      if (!/Good try!/.test(t)) errors.push('no loss card: ' + t);
      await shot('loss');
    }, 300000);
    await step('Dress up', async () => {
      await page.click('#modalCard [data-cs="tipDress"]');
      await modalIs('dress');
      for (const o of ['flowers', 'glasses', 'bowtie']) { await page.click(`#modalCard [data-outfit="${o}"]`); await page.waitForTimeout(150); }
      await page.waitForTimeout(1500);
      await shot('dress');
    }, 300000);
    await step('a win', async () => {
      await page.click('#modalCard [data-cs="done"]');
      await modalIs('entry');
      await shot('entry-dressed');
      await startAndRing();
      await finishShow(['perfect', 'good', 'perfect']);
      await modalIs('result');
      const t = await ev(() => document.getElementById('modalCard').innerText.replace(/\s+/g, ' '));
      log('win card:', t);
      if (!/Grand Cup!/.test(t)) errors.push('no win card: ' + t);
      await page.waitForTimeout(1200);
      await shot('win');
      await page.click('#modalCard [data-cs="ok"]');
      await ev(() => { const g = window.slimekin; g.hud.renderRanch(true); const el = document.querySelector('#body-ranch .cs-trophies'); if (el) el.scrollIntoView({ block: 'center' }); });
      await page.waitForTimeout(600);
      await shot('resident-trophy');
    }, 400000);
    await step('the Ranch tab and the title', async () => {
      await ev(() => {
        const g = window.slimekin, R = g.state.ranch, j = R.residents.find(x => x.name === 'Juniper'), now = Date.now();
        j.contests.trophies.beauty = 4;
        for (const c of ['little', 'big', 'grand', 'champion']) R.contests.shelf[`beauty-${c}`] = { id: j.id, name: j.name, at: now };
        R.contests.shelf['sprint-little'] = { id: 'rbarnpeach', name: 'Pebble', at: now };
        delete R.contests.shelf['beauty-grand'];
        R.contests.shelf['beauty-grand'] = { id: j.id, name: j.name, at: now };
        g.focusResident(null);
        g.hud.openTab('ranch');
        g.barnRanch.show(j.id);
      });
      await page.waitForFunction(() => { const b = window.slimekin.barnRanch; return b.curId === 'rmvgvzpxcf' && !b.view.swapping; }, null, { timeout: 120000 });
      await ev(() => { const g = window.slimekin; g.hud.renderRanch(true); const el = document.querySelector('#body-ranch .rl-card'); if (el) el.scrollIntoView({ block: 'start' }); document.getElementById('body-ranch').scrollTop -= 6; });
      await page.waitForTimeout(800);
      await shot('ranchtab');
      await page.click('#body-ranch [data-cs="shelf"]');
      await modalIs('shelf');
      await shot('shelf');
      await ev(() => window.slimekin.hud.closeModal());
    }, 300000);
    if (!NIGHT) {
      // Reduced motion and Low graphics (day only): act 1's cheer moment
      for (const [name, set] of [['show-reduced', { reducedMotion: true }], ['show-low', { quality: 'low' }]]) {
        await step(name, async () => {
          await ev(o => { const g = window.slimekin; Object.assign(g.state.settings, o); g.applySettings(); g.contestsUI.openEntry('rbarnpeach', 'sprint'); }, set);
          await modalIs('entry');
          await startAndRing();
          await page.waitForFunction(() => { const s = window.slimekin.contestShow.s; if (s.phase === 'perform') s.t = 99; return s.phase === 'ring' && s.ring; }, null, { timeout: 60000, polling: 200 });
          if (name === 'show-low') await ev(() => { const r = window.slimekin.contestShow.s.ring; if (r.anim) { r.anim.pause(); r.anim.currentTime = 0.72 * 1000 * window.slimekin.contestShow.info().beat; } r.t0 = performance.now() + 1e6; });
          else await ev(() => { window.slimekin.contestShow.s.t = -99; });
          await page.waitForTimeout(600);
          await shot(name);
          await ev(() => window.slimekin.contestShow.cancel());
          await ev(() => { const g = window.slimekin; g.state.settings.reducedMotion = false; g.state.settings.quality = 'auto'; g.applySettings(); });
        }, 300000);
      }
    }
    errors.push(...kit.errors);
    kit.report();
  } catch (e) {
    errors.push(e.message.split('\n')[0]);
    if (kit) errors.push(...kit.errors);
  } finally {
    if (kit) await kit.close();
  }
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log(`\nOK: pictures in ${OUT}`);
})();
