// Save safety in the real game (slice H1), headless at 375 px wide, with a screenshot of every new card and toast:
//   broken   a save that can't be read and no copy: a new egg, the gentle card, the text kept in slimekin.save.broken
//   prev     a broken save + the previous good save: Pebble is back, a "Welcome back" toast
//   code     Load a save code: empty and bad codes refused with a message; a good one asks "Replace Pebble?" first
//            (Keep leaves Pebble), Replace loads it and keeps Pebble as slimekin.save.prev
//   hiccup   an error in every frame: drawing goes on, saving stops, after a few frames the hiccup card;
//            "Restore last good save" brings back the previous good save
//   gl       the phone takes the 3D picture away (WEBGL_lose_context): the card, then "The picture is back"
//   savefail storage refuses the save: one toast, not one per save
//   boot     the game can't start for another reason: "Slimekin hit a snag" (not "needs WebGL"); and with no WebGL at
//            all, the WebGL message
//   name     names in the top bar at 375 px (F10): 16 letters (the longest the game allows), Pebble, Pip: never cut
// Setup and running as in tools/smoke-test.cjs. Screenshots: tools/out/health/.
//   node tools/health-smoke.cjs [--only broken,code,...] [--dpr 1]
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const OUT = path.join(__dirname, 'out', 'health');
fs.mkdirSync(OUT, { recursive: true });
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ONLY = (arg('--only', '') || '').split(',').filter(Boolean);
const DPR = +arg('--dpr', '2');
const KEY = 'slimekin.save.v1', PREV = 'slimekin.save.prev', BROKEN = 'slimekin.save.broken';
const PEBBLE = { ...JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'main-gen2.json'), 'utf8')).save, savedAt: Date.now() - 60000 };
const VIEW = { width: 375, height: 812 };
const MARK = 'H1 test hiccup';

// Runs in the page before any script: seeds this scenario's storage once (?h=<name>), and the sabotage it asks for.
function seedPage({ seeds }) {
  const h = new URLSearchParams(location.search).get('h');
  if (!h) return;
  if (!sessionStorage.getItem('h1.' + h)) {
    sessionStorage.setItem('h1.' + h, '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(seeds[h] || {})) if (!k.startsWith('!')) localStorage.setItem(k, v);
  }
  const s = seeds[h] || {};
  if (s['!snag']) {   // the game's constructor throws (window.matchMedia is used while it applies the settings)
    window.matchMedia = () => { throw new Error('H1 test snag'); };
  }
  if (s['!nogl']) {   // no WebGL at all
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : get.call(this, t, ...a); };
  }
}

(async () => {
  const errors = [], results = [];
  const check = (cond, what, extra = '') => { const line = (cond ? 'ok   ' : 'FAIL ') + what + (extra ? ' | ' + extra : ''); results.push(line); log(line); if (!cond) errors.push(what + (extra ? ' | ' + extra : '')); };
  let kit = null;
  watchdog(25, () => kit ? kit.current() : 'setup');
  try {
    kit = await setup({ contextOptions: { viewport: VIEW, screen: VIEW, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, permissions: [] } });
    const { page, step, ev } = kit;
    page.setDefaultTimeout(120000);
    const pebbleText = JSON.stringify(PEBBLE);
    const mochi = { ...PEBBLE, slime: { ...PEBBLE.slime, name: 'Mochi' }, savedAt: Date.now() - 30000 };
    const seeds = {
      broken: { [KEY]: pebbleText.slice(0, 300) },
      prev: { [KEY]: pebbleText.slice(0, 500), [PREV]: pebbleText },
      code: { [KEY]: pebbleText }, hiccup: { [KEY]: pebbleText }, gl: { [KEY]: pebbleText }, savefail: { [KEY]: pebbleText },
      boot: { [KEY]: pebbleText, '!snag': '1' }, nogl: { [KEY]: pebbleText, '!nogl': '1' },
      name: { [KEY]: JSON.stringify({ ...PEBBLE, slime: { ...PEBBLE.slime, name: 'Marshmallowberry' } }) },
      namenight: { [KEY]: JSON.stringify({ ...PEBBLE, slime: { ...PEBBLE.slime, name: 'Wobblewiggleton' } }) },
      nameshort: { [KEY]: JSON.stringify({ ...PEBBLE, slime: { ...PEBBLE.slime, name: 'Pip' } }) },
      namepebble: { [KEY]: pebbleText },
    };
    await kit.context.addInitScript(seedPage, { seeds });
    const shot = (name, { night = false } = {}) => step('screenshot ' + name, async () => {
      if (night) await ev(() => document.documentElement.setAttribute('data-theme', 'dark'));
      for (let i = 0; i < 3; i++) { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 120000 }); }
      if (night) await ev(() => document.documentElement.removeAttribute('data-theme'));
      log('screenshot', name);
    }, 200000);
    const open = (h, ready = 'game') => step(`open (${h})`, async () => {
      await page.goto(`${kit.server.origin}/?h=${h}#debug`);
      if (ready === 'game') await page.waitForFunction(() => window.slimekin && document.getElementById('boot')?.hidden === true, null, { timeout: 150000 });
    }, 200000);
    const ls = k => ev(k => localStorage.getItem(k), k);
    const nameOf = t => { try { return JSON.parse(t).slime.name; } catch { return t == null ? '(none)' : '(unreadable)'; } };
    const card = key => ev(k => { const c = document.getElementById('notice-' + k); return c ? c.innerText : null; }, key);
    const run = n => !ONLY.length || ONLY.includes(n);

    if (run('broken')) {
      await open('broken');
      await page.waitForFunction(() => document.getElementById('notice-broken'), null, { timeout: 60000 });
      const text = await card('broken');
      check(/fresh egg/i.test(text) && /kept safe/i.test(text), 'broken: the gentle card shows', JSON.stringify(text.slice(0, 90)));
      check(await ev(() => window.slimekin.state.phase) === 'egg', 'broken: a new egg');
      await shot('1-broken-save');
      await ev(() => window.slimekin.advance(7));   // an autosave of the new egg
      check(await ls(BROKEN) === JSON.stringify(PEBBLE).slice(0, 300), 'broken: the old text is kept in slimekin.save.broken after the new egg saved');
      check(nameOf(await ls(KEY)) === '', 'broken: the new egg is saved as the save');
      await page.click('#notice-broken [data-act="ok"]');
      check(await card('broken') === null, 'broken: OK closes the card');
    }

    if (run('prev')) {
      await open('prev');
      await page.waitForFunction(() => /Welcome back/.test(document.getElementById('toasts')?.innerText || ''), null, { timeout: 60000 });
      const st = await ev(() => ({ name: window.slimekin.state.slime.name, phase: window.slimekin.state.phase, toast: document.getElementById('toasts').innerText }));
      check(st.name === 'Pebble' && st.phase === 'play', 'prev: a broken save + the previous good save: Pebble is back', JSON.stringify(st.name));
      check(/Pebble/.test(st.toast) && /hiccup/.test(st.toast), 'prev: the "Welcome back" toast', JSON.stringify(st.toast.slice(0, 120)));
      await shot('2-restored-toast');
      check((await ls(BROKEN) || '').length === 500, 'prev: the broken text is kept');
    }

    if (run('code')) {
      await open('code');
      const loadCode = async code => {
        await ev(() => document.getElementById('settingsBtn').click());
        await page.waitForSelector('#loadSave');
        await page.click('#loadSave');
        await page.waitForSelector('#saveCodeIn');
        await page.fill('#saveCodeIn', code);
        await page.click('#codeLoad');
        await page.waitForTimeout(300);
      };
      const msg = () => ev(() => document.getElementById('codeMsg')?.innerText || '');
      await loadCode('');
      check(/Paste a save code first/.test(await msg()), 'code: an empty code is refused', JSON.stringify(await msg()));
      await page.fill('#saveCodeIn', 'SLIMEKIN1:' + Buffer.from('{}').toString('base64'));
      await page.click('#codeLoad');
      await page.waitForTimeout(300);
      check(/doesn't hold a slime/.test(await msg()), 'code: "{}" is refused', JSON.stringify(await msg()));
      await page.fill('#saveCodeIn', 'SLIMEKIN1:eyJ2IjoxLCJwaGFzZ');
      await page.click('#codeLoad');
      await page.waitForTimeout(300);
      check(/cut short/.test(await msg()), 'code: a cut-off code is refused', JSON.stringify(await msg()));
      await shot('3-code-refused');
      check(nameOf(await ls(KEY)) === 'Pebble', 'code: nothing changed after the refusals');
      const good = 'SLIMEKIN1:' + Buffer.from(JSON.stringify(mochi), 'utf8').toString('base64');
      await page.fill('#saveCodeIn', good);
      await page.click('#codeLoad');
      await page.waitForSelector('#codeReplace');
      const ask = await ev(() => document.getElementById('modalCard').innerText);
      check(/Replace Pebble\?/.test(ask) && /Mochi/.test(ask) && /kept/.test(ask), 'code: a good code asks "Replace Pebble?" and names Mochi', JSON.stringify(ask.slice(0, 140)));
      await shot('4-code-confirm');
      await shot('4-code-confirm-night', { night: true });
      await page.click('#codeKeep');
      await page.waitForTimeout(300);
      check(await ev(() => window.slimekin.state.slime.name) === 'Pebble' && nameOf(await ls(KEY)) === 'Pebble', 'code: "Keep Pebble" changes nothing');
      await loadCode(good);
      await page.waitForSelector('#codeReplace');
      const nav = page.waitForNavigation({ waitUntil: 'commit', timeout: 90000 });
      await page.click('#codeReplace');
      await nav;
      await page.waitForFunction(() => window.slimekin && document.getElementById('boot')?.hidden === true, null, { timeout: 150000 });
      check(await ev(() => window.slimekin.state.slime.name) === 'Mochi', 'code: Replace loads Mochi');
      check(nameOf(await ls(PREV)) === 'Pebble', 'code: Pebble is kept as slimekin.save.prev', nameOf(await ls(PREV)));
      await ev(() => window.slimekin.advance(13));   // two autosaves on the new page
      check(nameOf(await ls(PREV)) === 'Pebble' && nameOf(await ls(KEY)) === 'Mochi', 'code: after two autosaves .prev still holds Pebble');
    }

    if (run('hiccup')) {
      await open('hiccup');
      await ev(() => window.slimekin.advance(7));   // one clean autosave (this visit keeps its .prev)
      const before = await ev(k => JSON.parse(localStorage.getItem(k)).savedAt, KEY);
      const frame0 = await ev(() => window.slimekin.stage.renderer.info.render.frame);
      await ev(m => { window.slimekin.behave.update = () => { throw new Error(m); }; }, MARK);   // an error early in every frame
      await page.waitForFunction(() => document.getElementById('notice-trouble'), null, { timeout: 60000 });
      const text = await card('trouble');
      check(/hiccup/i.test(text) && /saving is paused/.test(text), 'hiccup: the card shows after a few failed frames', JSON.stringify(text.slice(0, 100)));
      check(/Restore last good save/.test(text), 'hiccup: the card offers "Restore last good save"');
      await page.waitForTimeout(2500);
      const frame1 = await ev(() => window.slimekin.stage.renderer.info.render.frame);
      check(frame1 > frame0 + 2, 'hiccup: the picture is still drawn every frame (the error does not skip render)', `${frame0} -> ${frame1}`);
      await ev(() => { window.slimekin.saveT = 0; window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
      await page.waitForTimeout(1500);
      const after = await ev(k => JSON.parse(localStorage.getItem(k)).savedAt, KEY);
      check(after === before, 'hiccup: nothing is saved in that state (autosave and pagehide)', `${before} -> ${after}`);
      await shot('5-hiccup');
      await shot('5-hiccup-night', { night: true });
      await ev(k => { const p = JSON.parse(localStorage.getItem(k)); p.jelly = 4242; localStorage.setItem(k, JSON.stringify(p)); }, PREV);   // mark .prev
      const nav = page.waitForNavigation({ waitUntil: 'commit', timeout: 90000 });
      await page.click('#notice-trouble [data-act="restore"]');
      await nav;
      await page.waitForFunction(() => window.slimekin && document.getElementById('boot')?.hidden === true, null, { timeout: 150000 });
      check(Math.floor(await ev(() => window.slimekin.state.jelly)) >= 4242 && await card('trouble') === null, 'hiccup: "Restore last good save" starts from the previous good save', `${await ev(() => window.slimekin.state.jelly)}`);
      const errs = kit.errors.filter(e => e.includes(MARK));
      check(errs.length > 0 && errs.length <= 6, 'hiccup: the error is logged a few times, not every frame', `${errs.length} log line(s)`);
    }

    if (run('gl')) {
      await open('gl');
      await ev(() => { window.__lc = window.slimekin.stage.renderer.getContext().getExtension('WEBGL_lose_context'); window.__lc.loseContext(); });
      await page.waitForFunction(() => document.getElementById('notice-gl'), null, { timeout: 30000 });
      check(/fell asleep/.test(await card('gl')) && /safe and saved/.test(await card('gl')), 'gl: context lost: the card shows', JSON.stringify((await card('gl')).slice(0, 80)));
      await shot('6-picture-asleep');
      await ev(() => window.__lc.restoreContext());
      await page.waitForFunction(() => /is back/.test(document.getElementById('notice-gl')?.innerText || ''), null, { timeout: 30000 });
      await page.waitForTimeout(1500);
      await shot('7-picture-back');
      await page.click('#notice-gl [data-act="go"]');
      const f0 = await ev(() => window.slimekin.stage.renderer.info.render.frame);
      await page.waitForTimeout(2000);
      const f1 = await ev(() => window.slimekin.stage.renderer.info.render.frame);
      check(await card('gl') === null && f1 > f0, 'gl: "Carry on" closes it and the game draws again', `${f0} -> ${f1}`);
      await shot('7b-after-carry-on');
    }

    if (run('savefail')) {
      await open('savefail');
      await ev(k => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (key, v) { if (key === k) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } return set.call(this, key, v); }; }, KEY);
      await ev(() => window.slimekin.advance(13));   // two autosaves
      await page.waitForTimeout(400);
      const t = await ev(() => document.getElementById('toasts').innerText);
      const n = await ev(() => [...document.querySelectorAll('#toasts .toast')].filter(x => /Saving didn't work/.test(x.innerText)).length);
      check(/Saving didn't work/.test(t) && n === 1, 'savefail: one "Saving didn\'t work" toast for two failed saves', `${n} toast(s)`);
      await shot('8-save-failed');
    }

    if (run('boot')) {
      await open('boot', 'none');
      await page.waitForFunction(() => document.getElementById('notice-boot'), null, { timeout: 60000 });
      const text = await card('boot');
      check(/hit a snag/.test(text) && /save was not changed/.test(text) && !/WebGL/.test(text), 'boot: another start-up error says "hit a snag", not "needs WebGL"', JSON.stringify(text.slice(0, 100)));
      check(await ls(KEY) === pebbleText, 'boot: the save is untouched');
      await shot('9-boot-snag');
      await open('nogl', 'none');
      await page.waitForFunction(() => /needs 3D graphics/.test(document.getElementById('boot')?.innerText || ''), null, { timeout: 60000 });
      check(!(await ev(() => !!document.getElementById('notice-boot'))), 'boot: with no WebGL at all, the WebGL message (and no snag card)');
      await shot('10-no-webgl');
    }

    if (run('name')) {
      for (const [h, night, shotName] of [['name', false, '11-long-name'], ['namenight', true, '11-long-name-night'], ['namepebble', false, '12-name-pebble'], ['nameshort', false, '13-name-short']]) {
        await open(h);
        await page.waitForTimeout(600);   // (the pill measures its name every 0.25 s)
        const m = await ev(() => { const b = document.getElementById('nameBtn'); return { text: b.innerText, sw: b.scrollWidth, cw: b.clientWidth, two: b.closest('.slime-card').classList.contains('long-name'), h: Math.round(b.closest('.slime-card').getBoundingClientRect().height) }; });
        check(m.sw <= m.cw + 1, `name: ${JSON.stringify(m.text)} in the top bar at 375 px is shown in full (${m.two ? 'on its own line' : 'one-line pill'})`, `scrollWidth ${m.sw}, clientWidth ${m.cw}, pill ${m.h} px tall`);
        await shot(shotName, { night });
      }
    }
  } catch (e) {
    errors.push('test error: ' + e.message);
  } finally {
    if (kit) {
      errors.unshift(...kit.errors.filter(e => !e.includes(MARK) && !e.includes('H1 test snag') && !/WebGL|webgl|context/i.test(e)));
      kit.report(); await kit.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), results.join('\n') + '\n' + (errors.length ? 'FAILED\n' + errors.join('\n') : 'OK') + '\n');
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log(`\nOK (${results.length} checks)`);
})();
