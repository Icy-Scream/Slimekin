// Mochi's stars in the real game (390 x 844, a phone in a headless browser), from the :8822 test copy's "Load the test
// ranch" save (tools/fixtures/talents/ranch-trained.json; Peaches and Plum are in lessons that end 30 minutes after it
// loads, as on the test copy). The captain's report (11 Nov): "Mochi the crystal one has 6 stars under Smarts but one of
// the stars is not filled nor can she train it."
//   page    her resident page: 25 of 26 stars, Smarts 5 of 6 places (grade A: room for a 6th), the others 5 of 5
//   train   the Train picker while both lanes are busy: the Smarts card is greyed and says why on the card (waits for
//           a free lane, and when one frees up); short of pearls it says how many; the lessons end (#debug Finish
//           lessons): she learns star 6 for 80 pearls, then has 6 of 6 ("All six stars!")
//   slots   the star places a finished lesson shows (the toast now, the "Lesson done!" card after a reload) are the
//           ones her page shows: Plum's Speed (grade A) reads ★☆☆☆☆☆ everywhere once its first lesson has shown it
// Fails on any page error. Screenshots (day, and night unless --quick) in tools/out/stars/.
//   node tools/star-smoke.cjs [--quick] [--dpr 2] [--only=page,train,slots] [--fonts <dir>]
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const arg = (name, def) => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); if (a) return a.slice(name.length + 3); const i = process.argv.indexOf('--' + name); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def; };
const QUICK = process.argv.includes('--quick');
const DPR = Number(arg('dpr', 1));
const ONLY = arg('only', 'page,train,slots').split(',').filter(Boolean);
const want = k => ONLY.includes(k);
const FONTS = arg('fonts', process.env.SLIMEKIN_FONTS || '');
const OUT = path.join(__dirname, 'out', 'stars');
fs.mkdirSync(OUT, { recursive: true });
const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'talents', 'ranch-trained.json'), 'utf8')).save;
SAVE.outfits.owned = ['bow', 'bowtie', 'flowers', 'glasses', 'scarf'];   // as the test copy's start.html
const MOCHI = 'rbarnmochi';

(async () => {
  const errors = [];
  const check = (cond, what, extra = '') => { log(`${cond ? 'ok  ' : 'FAIL'} ${what}${extra ? ' | ' + extra : ''}`); if (!cond) errors.push(what + (extra ? ': ' + extra : '')); };
  let kit = null;
  watchdog(40, () => kit ? kit.current() : 'setup');
  try {
    kit = await setup({ contextOptions: { viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true } });
    const { page, step, ev, context } = kit;
    if (FONTS && fs.existsSync(FONTS)) {
      const files = fs.readdirSync(FONTS);
      const face = (fam, names, w) => { const f = names.find(n => files.includes(n)); return f ? `@font-face{font-family:'${fam}';src:url(https://fonts.gstatic.com/local/${encodeURIComponent(f)}) format('truetype');font-weight:${w};font-display:block}` : ''; };
      const css = [face('DynaPuff', ['DynaPuff[wdth,wght].ttf', 'DynaPuff.ttf'], '400 700'), face('M PLUS Rounded 1c', ['MPLUSRounded1c-Medium.ttf'], 500),
        face('M PLUS Rounded 1c', ['MPLUSRounded1c-Bold.ttf'], 700), face('M PLUS Rounded 1c', ['MPLUSRounded1c-ExtraBold.ttf'], 800)].join('\n');
      await context.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: css, contentType: 'text/css' }));
      await context.route('https://fonts.gstatic.com/local/**', r => r.fulfill({ path: path.join(FONTS, decodeURIComponent(r.request().url().split('/local/')[1])), contentType: 'font/ttf' }));
      log('fonts from', FONTS);
    }
    await context.addInitScript(save => {
      const next = sessionStorage.getItem('nextSave');
      if (next) { sessionStorage.removeItem('nextSave'); localStorage.setItem('slimekin.save.v1', next); return; }
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const s = JSON.parse(JSON.stringify(save)), now = Date.now();
      for (const x of s.ranch.residents) {
        if (x.trip) { x.trip.startAt = now - 600000; x.trip.homeAt = now + 3000000; }
        if (x.lesson) { x.lesson.startAt = now - 600000; x.lesson.doneAt = now + 1800000; }
      }
      s.savedAt = now - 60000; s.ranch.lastVisit = now;
      localStorage.setItem('slimekin.save.v1', JSON.stringify(s));
    }, SAVE);
    const boot = async () => {
      await page.waitForFunction(() => window.slimekin && window.slimekin.state && document.getElementById('boot').hidden, null, { timeout: 180000 });
      await ev(() => { const g = window.slimekin; g.hud.closeModal(); g.hud.onModalClose = null; });
    };
    await step('boot', async () => { await page.goto(`${kit.server.origin}/#debug`); await boot(); }, 240000);

    const cdp = await context.newCDPSession(page);
    const touchAt = async (x, y) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    // a real touch on an element once it holds still for three drawn frames, on top where it is touched
    const touchEl = async sel => {
      for (let tries = 0; tries < 40; tries++) {
        const a = await ev(q => new Promise(res => {
          const el = document.querySelector(q);
          if (!el) { res(null); return; }
          el.scrollIntoView({ block: 'center' });
          const spot = () => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
          let last = spot(), n = 0, f = 0;
          const look = () => {
            const s = spot(); n = Math.abs(s.x - last.x) < 0.5 && Math.abs(s.y - last.y) < 0.5 ? n + 1 : 0; last = s;
            const top = document.elementFromPoint(s.x, s.y);
            if (n >= 3 && top && (top === el || el.contains(top))) { res(s); return; }
            if (++f > 600) { res({ ...s, late: true }); return; }
            requestAnimationFrame(look);
          };
          requestAnimationFrame(look);
        }), sel);
        if (!a) throw new Error('nothing to touch: ' + sel);
        if (a.late) { log(`note: ${sel} did not hold still; touching it anyway`); }
        await touchAt(a.x, a.y);
        return a;
      }
      return null;
    };
    const setTheme = async dark => { await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark); await page.waitForTimeout(250); };
    const shot = async (name, { night = !QUICK } = {}) => {
      for (const dark of night ? [false, true] : [false]) {
        await setTheme(dark);
        for (let i = 0; i < 3; i++) await page.screenshot({ path: path.join(OUT, `${name}-${dark ? 'night' : 'day'}.png`), timeout: 120000 });
      }
      await setTheme(false);
    };
    const toBarn = async () => {
      if (!(await ev(() => window.slimekin.barnRanch.active))) await touchEl('#tab-ranch');
      await page.waitForFunction(() => { const b = window.slimekin.barnRanch; return (b.on && b.view.ready) || b.view.failed; }, null, { timeout: 180000 });
      await ev(() => window.slimekin.hud.closeModal());
    };
    const onPage = async rid => {
      await ev(i => { const g = window.slimekin; g.hud.closeModal(); g.hud.onModalClose = null; g.hud.openTab('ranch'); g.focusResident(i); g.hud.renderRanch(true); }, rid);
      await page.waitForFunction(i => { const b = window.slimekin.barnRanch; return b.curId === i && !b.view.swapping && !!document.querySelector('#body-ranch .rl-skills'); }, rid, { timeout: 120000 });
    };
    // the resident page's skills: the header and every row's stars (text and aria-label)
    const skills = () => ev(() => {
      const card = document.querySelector('#body-ranch .rl-skills'), title = [...document.querySelectorAll('#body-ranch .sec-title')].find(e => /^Skills/.test(e.textContent));
      return { title: title && title.textContent.replace(/\s+/g, ' ').trim(),
        rows: Object.fromEntries([...card.querySelectorAll('.row-between')].map(r => { const st = r.querySelector('.rl-stars'); return [r.textContent.replace(/[^A-Za-z]/g, '').replace(/[★☆].*/, ''), { stars: st.textContent, label: st.getAttribute('aria-label') }]; })) };
    });
    // the Train picker's cards: per skill, greyed or not and its text
    const picker = () => ev(() => Object.fromEntries([...document.querySelectorAll('#modalCard [data-skill]')].map(b => [b.dataset.skill, { disabled: b.disabled, text: b.innerText.replace(/\s+/g, ' ').trim() }])));
    const openTrain = async rid => {
      await onPage(rid);
      await touchEl('#body-ranch [data-rl="train"]');
      await page.waitForFunction(() => !!document.querySelector('#modalCard [data-skill]') && !document.getElementById('modal').hidden, null, { timeout: 30000 });
    };
    const closeModal = () => ev(() => { const g = window.slimekin; g.hud.onModalClose = null; g.hud.closeModal(); });
    const finishLessons = async () => {
      await ev(() => window.slimekin.debug('rlLessons'));
      await page.waitForFunction(() => window.slimekin.state.ranch.residents.every(x => !x.lesson), null, { timeout: 60000 });
    };

    if (want('page')) {
      await step('page: Mochi\'s stars', async () => {
        await toBarn();
        await onPage(MOCHI);
        const s = await skills();
        log('skills:', JSON.stringify(s));
        check(/^Skills 25 of 26 stars/.test(s.title || ''), 'her page counts 25 of 26 stars', s.title);
        check(s.rows.Smarts && s.rows.Smarts.stars === '★★★★★☆' && s.rows.Smarts.label === '5 of 6 stars', 'Smarts: 6 places, 5 filled (grade A: room for a 6th star)', JSON.stringify(s.rows.Smarts));
        check(['Bounce', 'Speed', 'Sturdy', 'Charm'].every(k => s.rows[k] && s.rows[k].stars === '★★★★★' && s.rows[k].label === '5 of 5 stars'), 'Bounce, Speed, Sturdy and Charm: 5 of 5', JSON.stringify(s.rows));
        await ev(() => document.querySelector('#body-ranch .rl-skills').scrollIntoView({ block: 'center' }));
        await shot('1-mochi-page');
      }, 300000);
    }

    if (want('train')) {
      await step('train: both lanes busy', async () => {
        await toBarn();
        const busy = await ev(() => window.slimekin.state.ranch.residents.filter(x => x.lesson).map(x => x.name));
        await openTrain(MOCHI);
        const p = await picker();
        log('picker:', JSON.stringify(p));
        const note = await ev(() => document.getElementById('modalCard').innerText.replace(/\s+/g, ' '));
        check(busy.join() === 'Peaches,Plum' && /The Training Center is full/.test(note), 'both lanes are busy (Peaches and Plum in lessons), and the picker\'s first lines say so', busy.join());
        check(p.smarts.disabled && /Star 6/.test(p.smarts.text), 'the Smarts card offers star 6 and is greyed while the lanes are busy', p.smarts.text);
        check(/free lane/i.test(p.smarts.text) && /\d:\d\d/.test(p.smarts.text), 'the Smarts card itself says why it waits: for a free lane, and when one frees up', p.smarts.text);
        check(['bounce', 'speed', 'sturdy', 'charm'].every(k => p[k].disabled && /All five stars!/.test(p[k].text) && !/free lane/i.test(p[k].text)), 'the full skills say "All five stars!" (no lane note on them)');
        await shot('2-train-lanes-busy');
        await closeModal();
      }, 300000);
      await step('train: short of pearls', async () => {
        await finishLessons();
        const pearls = await ev(() => { const g = window.slimekin, R = g.state.ranch, was = R.pearls; R.pearls = 50; return was; });
        await openTrain(MOCHI);
        const p = await picker();
        check(p.smarts.disabled && /80 pearls/.test(p.smarts.text) && /50/.test(p.smarts.text) && !/free lane/i.test(p.smarts.text), 'with 50 pearls the Smarts card says it needs 80 (and how many there are)', p.smarts.text);
        await shot('3-train-short', { night: false });
        await closeModal();
        await ev(n => { window.slimekin.state.ranch.pearls = n; }, pearls);
      }, 300000);
      await step('train: star 6', async () => {
        const before = await ev(() => window.slimekin.state.ranch.pearls);
        await openTrain(MOCHI);
        const p = await picker();
        check(!p.smarts.disabled && /Star 6: 4h 12m/.test(p.smarts.text) && !/free lane|pearls:/i.test(p.smarts.text), 'with a lane free the Smarts card is open: star 6, 4h 12m, 80 pearls', p.smarts.text);
        await touchEl('#modalCard [data-skill="smarts"]');
        await page.waitForFunction(i => !!window.slimekin.state.ranch.residents.find(x => x.id === i).lesson, MOCHI, { timeout: 30000 });
        const l = await ev(i => { const g = window.slimekin, x = g.state.ranch.residents.find(y => y.id === i); return { lesson: x.lesson, pearls: g.state.ranch.pearls }; }, MOCHI);
        check(l.lesson.skill === 'smarts' && l.lesson.star === 6 && before - l.pearls === 80, 'she starts her star-6 Smarts lesson (80 pearls)', JSON.stringify(l));
        await finishLessons();
        const toast = await ev(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.innerText.replace(/\s+/g, ' ')).find(t => /Mochi earned 6 stars in Smarts/.test(t)) || '');
        check(/★★★★★★/.test(toast) && !/☆/.test(toast), 'the toast: Mochi earned 6 stars in Smarts, ★★★★★★', toast);
        await onPage(MOCHI);
        const s = await skills();
        check(/^Skills 26 of 26 stars/.test(s.title) && s.rows.Smarts.stars === '★★★★★★' && s.rows.Smarts.label === '6 of 6 stars', 'her page: 26 of 26, Smarts 6 of 6', JSON.stringify({ t: s.title, s: s.rows.Smarts }));
        await openTrain(MOCHI);
        const q = await picker();
        check(q.smarts.disabled && /All six stars!/.test(q.smarts.text), 'the picker: Smarts "All six stars!"', q.smarts.text);
        await shot('4-train-six-stars');
        await closeModal();
      }, 400000);
    }

    if (want('slots')) {
      await step('slots: Plum\'s Speed, the toast and the page', async () => {
        await toBarn();
        if (await ev(() => window.slimekin.state.ranch.residents.some(x => x.lesson))) await finishLessons();
        const plum = await ev(() => window.slimekin.state.ranch.residents.find(x => x.name === 'Plum').id);
        await ev(() => { window.slimekin.state.ranch.pearls = 300; });
        await openTrain(plum);
        await touchEl('#modalCard [data-skill="speed"]');
        await page.waitForFunction(i => !!window.slimekin.state.ranch.residents.find(x => x.id === i).lesson, plum, { timeout: 30000 });
        await finishLessons();
        const toast = await ev(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.innerText.replace(/\s+/g, ' ')).find(t => /Plum earned 1 star in Speed/.test(t)) || '');
        await onPage(plum);
        const s = await skills();
        check(s.rows.Speed && s.rows.Speed.stars === '★☆☆☆☆☆', 'Plum\'s page after her first Speed lesson (grade A, now shown): ★☆☆☆☆☆', JSON.stringify(s.rows.Speed));
        check(toast.includes(s.rows.Speed.stars + ' '), 'the toast shows the same places as her page', toast);
      }, 300000);
      await step('slots: the "Lesson done!" card after a reload', async () => {
        const plum = await ev(() => window.slimekin.state.ranch.residents.find(x => x.name === 'Plum').id);
        await openTrain(plum);
        await touchEl('#modalCard [data-skill="speed"]');
        await page.waitForFunction(i => !!window.slimekin.state.ranch.residents.find(x => x.id === i).lesson, plum, { timeout: 30000 });
        // it ends while the game is closed
        const save = await ev(i => { const g = window.slimekin; g.saveNow(); const s = JSON.parse(localStorage.getItem('slimekin.save.v1')); const x = s.ranch.residents.find(y => y.id === i); x.lesson.doneAt = Date.now() - 60000; s.savedAt = Date.now() - 120000; return s; }, plum);
        await ev(s => sessionStorage.setItem('nextSave', JSON.stringify(s)), save);
        await page.reload();
        await page.waitForFunction(() => window.slimekin && window.slimekin.state && document.getElementById('boot').hidden, null, { timeout: 180000 });
        // other cards (welcome back) go first; the ranch's card comes when nothing else is open
        await page.waitForFunction(() => { const c = document.querySelector('#modalCard [data-rl-card]'); if (c && !document.getElementById('modal').hidden) return true; const g = window.slimekin; if (g.hud.modalOpen) g.hud.closeModal(); return false; }, null, { timeout: 120000, polling: 500 });
        const card = await ev(() => document.getElementById('modalCard').innerText.replace(/\s+/g, ' ').trim());
        await shot('5-lesson-card', { night: false });
        await closeModal();
        await toBarn();
        await onPage(plum);
        const s = await skills();
        check(/Plum · Speed/.test(card) && s.rows.Speed.stars === '★★☆☆☆☆' && card.includes('Plum · Speed ' + s.rows.Speed.stars), 'the "Lesson done!" card shows Plum\'s Speed with the places her page shows (★★☆☆☆☆)', `${card} | page ${s.rows.Speed.stars}`);
      }, 400000);
    }

    errors.push(...kit.errors);
    kit.report();
  } catch (e) {
    errors.push(e.message);
    if (kit) { try { await kit.page.screenshot({ path: path.join(OUT, 'star-smoke-failed.png'), timeout: 60000 }); log('picture of the failure: tools/out/stars/star-smoke-failed.png'); } catch { /* none */ } }
  } finally {
    if (kit) await kit.close();
  }
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
