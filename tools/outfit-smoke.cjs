// Outfits in the real game (390 x 844, a phone in a headless browser), from the :8822 test copy's "Load the test ranch"
// save (tools/fixtures/talents/ranch-trained.json, the family owning Ribbon Bow, Bow Tie, Flower Crown, Round Glasses
// and Cozy Scarf). The captain's report (11 Nov): "the artisan beret remained as worn even though I selected the crown".
// Everywhere it checks three things agree: what the save says it wears, what the 3D slime draws (every outfit object
// still attached to it, so a leftover shows up) and what the page shows as worn.
//   dress    real touches (CDP Input.dispatchTouchEvent): Mochi's Dress up shows the Artist Beret she wears (the family
//            does not own one) as Wearing; touching the Tiny Crown (not owned) shakes it and changes nothing; the crown
//            bought in Outfits goes on Pebble at home, then Dress up puts it on Mochi: the beret is gone from the stand
//            and the hidden ranch avatar, and its row reads "In Outfits"
//   pairs    clicks: every slot, every pair of outfits in it, in both orders, as one walk per slot: at home in the
//            Outfits page and on Mochi in Dress up (the stand and the ranch avatar too); the same one again takes it off
//   swap     two residents dressed differently swap on the stand back and forth: each wears only its own
//   reload   after a reload: Pebble at home, the Outfits page, Mochi and Juniper on the stand, Dress up
//   unowned  at home: Pebble wears a Party Hat the family does not own (a hand-made save): the Outfits page shows it as
//            worn and a touch takes it off
//   counter  the jelly counter's number is set in M PLUS Rounded 1c 800 (design/STYLE.md §4: DynaPuff's B reads as 8)
// Fails on any page error. Screenshots (day, and night unless --quick) in tools/out/outfits/.
//   node tools/outfit-smoke.cjs [--quick] [--dpr 2] [--only=dress,pairs,swap,reload,unowned,counter] [--fonts <dir>]
//   (--fonts: a folder with DynaPuff[wdth,wght].ttf and MPLUSRounded1c-Bold/ExtraBold.ttf, for screenshots in the
//   game's own fonts; offline the page falls back to the system's)
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const arg = (name, def) => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); if (a) return a.slice(name.length + 3); const i = process.argv.indexOf('--' + name); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def; };
const QUICK = process.argv.includes('--quick');
const DPR = Number(arg('dpr', 1));
const ONLY = arg('only', 'dress,pairs,swap,reload,unowned,counter').split(',').filter(Boolean);
const want = k => ONLY.includes(k);
const FONTS = arg('fonts', process.env.SLIMEKIN_FONTS || '');
const OUT = path.join(__dirname, 'out', 'outfits');
fs.mkdirSync(OUT, { recursive: true });
const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'talents', 'ranch-trained.json'), 'utf8')).save;
SAVE.outfits.owned = ['bow', 'bowtie', 'flowers', 'glasses', 'scarf'];   // as the test copy's start.html
const SL = ['head', 'face', 'neck'];
const ITEMS = { head: ['bow', 'flowers', 'beret', 'party', 'crown'], face: ['glasses', 'shades'], neck: ['bowtie', 'scarf'] };
const MOCHI = 'rbarnmochi';

// One walk through the items that wears every ordered pair (a then b, a != b) once: an Euler circuit of the complete
// directed graph (Hierholzer). 5 items: 21 steps, 20 pairs.
function walk(items) {
  if (items.length < 2) return items.slice();
  const used = new Set(), out = [], stack = [0];
  while (stack.length) {
    const v = stack[stack.length - 1];
    const w = items.findIndex((_, u) => u !== v && !used.has(v + ',' + u));
    if (w < 0) out.push(stack.pop()); else { used.add(v + ',' + w); stack.push(w); }
  }
  return out.reverse().map(i => items[i]);
}

// Page side (sent as source text, once per page load as window.__ok).
//   drawn(av)   what an avatar holds per slot, and every outfit object still attached anywhere under it (objects are
//               tagged with their outfit id when the avatar puts them on; one left behind is still found)
//   home()      Pebble: the save's worn, the 3D slime, the Outfits page (its rows marked worn and their chips)
//   res(id)     a resident: its worn, the barn stand (when it is on it), its hidden ranch avatar, the Dress up card
function outfitKit() {
  if (window.__ok) return;
  const g = window.slimekin, SL = ['head', 'face', 'neck'];
  const tag = av => {
    if (!av || av.__okTagged) return;
    av.__okTagged = true;
    const mark = () => { for (const s of Object.keys(av.outfit)) { const it = av.outfit[s]; if (it && it.obj) it.obj.userData.outfit = it.id; } };
    mark();
    const orig = av.setOutfits;
    av.setOutfits = function (w) { const r = orig.call(this, w); mark(); return r; };
  };
  const drawn = av => {
    if (!av) return null;
    tag(av);
    const held = Object.fromEntries(SL.map(s => [s, av.outfit[s] ? av.outfit[s].id : null]));
    const attached = [];
    av.root.traverse(o => { if (o.userData && o.userData.outfit) attached.push(o.userData.outfit); });
    return { held, attached: attached.sort() };
  };
  const worn = w => Object.fromEntries(SL.map(s => [s, (w && w[s]) || null]));
  const home = () => {
    const rows = [...document.querySelectorAll('#body-outfits .outfit')];
    return { state: worn(g.state.outfits.worn), av: drawn(g.slime),
      ui: rows.filter(b => b.classList.contains('worn')).map(b => ({ id: b.dataset.id, chip: (b.querySelector('.wear.on, .wear, .cost') || {}).textContent || '', pressed: b.getAttribute('aria-pressed') })),
      rows: rows.length };
  };
  const res = id => {
    const x = g.state.ranch.residents.find(r => r.id === id), b = g.barnRanch, lite = g.ranch.resident(id);
    const card = document.querySelector('#modalCard [data-cs-card="dress"]') && !document.getElementById('modal').hidden;
    const rows = card ? [...document.querySelectorAll('#modalCard .cs-outfit')] : [];
    return { state: worn(x.worn), stand: b.curId === id && !b.view.swapping ? drawn(b.view.av) : null, lite: lite ? drawn(lite.av) : null,
      ui: card ? rows.filter(r => r.getAttribute('aria-pressed') === 'true').map(r => ({ id: r.dataset.outfit, text: r.innerText.replace(/\s+/g, ' ').trim() })) : null };
  };
  window.__ok = { tag, drawn, home, res };
}

// Page side of touchEl (as in tools/contest-smoke.cjs): looks once per drawn frame until the element holds still, on
// top, with no transition running on it or around it; a guard checks where the touch really lands.
function touchKit() {
  if (window.__tk) return;
  const tag = e => (e && e.tagName ? `${e.tagName}${e.id ? '#' + e.id : ''}.${String(e.className).slice(0, 30)}` : 'nothing');
  const moving = el => {
    for (let e = el; e; e = e.parentElement) {
      for (const a of e.getAnimations()) {
        if (a.playState !== 'running' || (a.effect && a.effect.getComputedTiming().endTime === Infinity)) continue;
        return `${tag(e)} ${a.transitionProperty || a.animationName || 'animation'}`;
      }
    }
    return '';
  };
  const spot = q => {
    const el = document.querySelector(q);
    if (!el) return null;
    const r = el.getBoundingClientRect(), tabs = document.querySelector('#panel .tabs');
    let top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight);
    const sc = el.closest('.tab-body');
    if (sc && !el.closest('#modal')) { const b = sc.getBoundingClientRect(); top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); }
    if (tabs && !el.closest('#modal') && !tabs.contains(el)) { const t = tabs.getBoundingClientRect(); if (t.height && t.top < bottom) bottom = Math.min(bottom, t.top); }
    const x = r.left + r.width / 2, y = (top + bottom) / 2;
    const e = bottom > top + 4 ? document.elementFromPoint(x, y) : null;
    return { x, y, ok: !!e && (e === el || el.contains(e)), on: tag(e), moving: moving(el) };
  };
  const settle = (q, need, budget) => new Promise(resolve => {
    const t0 = performance.now();
    let last = null, run = 0, frames = 0, done = false, timer = 0;
    const finish = (settled, s) => { if (done) return; done = true; clearTimeout(timer); resolve({ ...(s || spot(q) || { x: 0, y: 0, ok: false, on: 'nothing (gone)', moving: '' }), settled, frames, ms: Math.round(performance.now() - t0) }); };
    timer = setTimeout(() => finish(false), budget + 5000);
    const look = () => {
      if (done) return;
      frames++;
      const s = spot(q);
      const same = !!s && !!last && Math.abs(s.x - last.x) < 0.5 && Math.abs(s.y - last.y) < 0.5;
      run = s && s.ok && !s.moving ? (same ? run + 1 : 1) : 0;
      last = s;
      if (run >= need) return finish(true, s);
      if (performance.now() - t0 > budget) return finish(false, s);
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  const G = { q: null, state: null };
  const guard = e => {
    if (!G.q) return;
    if (!G.state && (e.type === 'pointerdown' || e.type === 'touchstart')) G.state = { hit: !!(e.target && e.target.closest && e.target.closest(G.q)), on: tag(e.target), events: [] };
    if (!G.state) return;
    G.state.events.push(e.type);
    if (!G.state.hit) { if (e.cancelable) e.preventDefault(); e.stopImmediatePropagation(); }
  };
  for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'click']) window.addEventListener(t, guard, { capture: true, passive: false });
  const arm = q => { G.q = q; G.state = null; return spot(q); };
  const result = () => new Promise(resolve => {
    let k = 0;
    const look = () => {
      const s = G.state;
      if (!(s && s.events.some(t => t === 'touchend' || t === 'touchcancel')) && ++k < 30) { requestAnimationFrame(look); return; }
      if (!s || s.hit) G.q = null;
      resolve(s ? { hit: s.hit, on: s.on, events: s.events.join(' ') } : { hit: false, on: 'nothing (no touch event came)', events: '' });
    };
    look();
  });
  window.__tk = { settle, arm, result };
}

(async () => {
  const errors = [];
  const check = (cond, what, extra = '') => { log(`${cond ? 'ok  ' : 'FAIL'} ${what}${extra ? ' | ' + extra : ''}`); if (!cond) errors.push(what + (extra ? ': ' + extra : '')); };
  let kit = null;
  watchdog(50, () => kit ? kit.current() : 'setup');
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
    // the save goes in once (a reload keeps what the game saved); a test can hand the next load its own save
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
      await ev(`(${outfitKit})()`);
      await ev(() => window.__ok.tag(window.slimekin.slime));
    };
    await step('boot', async () => { await page.goto(`${kit.server.origin}/#debug`); await boot(); }, 240000);

    const cdp = await context.newCDPSession(page);
    const touch = async (x, y) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const STILL = 3;
    const touchEl = async sel => {
      if (!(await ev(q => !!document.querySelector(q), sel))) throw new Error('nothing to touch: ' + sel);
      await ev(`(${touchKit})()`);
      await ev(q => document.querySelector(q).scrollIntoView({ block: 'center' }), sel);
      let misses = 0;
      for (let tries = 0; ; tries++) {
        const a = await ev(([q, n, ms]) => window.__tk.settle(q, n, ms), [sel, STILL, 30000]);
        if (!a.ok && tries < 2) { await ev(q => document.querySelector(q).scrollIntoView({ block: 'start' }), sel); continue; }
        if (!a.settled) log(`note: ${sel} did not hold still (${a.frames} frames, ${(a.ms / 1000).toFixed(0)} s); touching it anyway`);
        const b = await ev(q => window.__tk.arm(q), sel);
        if (!b) throw new Error('nothing to touch: ' + sel);
        if ((Math.abs(b.x - a.x) >= 0.5 || Math.abs(b.y - a.y) >= 0.5 || b.ok !== a.ok) && tries < 6) continue;
        await touch(b.x, b.y);
        const r = await ev(() => window.__tk.result());
        if (r.hit) return b;
        log(`note: the touch on ${sel} landed on ${r.on}; stopped before the game saw it`);
        if (++misses >= 2) throw new Error(`the touch on ${sel} landed on ${r.on}, twice`);
      }
    };
    const setTheme = async dark => { await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark); await page.waitForTimeout(250); };
    // a screenshot after a few drawn frames (headless Chrome moves CSS transitions on only when it draws)
    const shot = async (name, { night = !QUICK } = {}) => {
      for (const dark of night ? [false, true] : [false]) {
        await setTheme(dark);
        for (let i = 0; i < 3; i++) await page.screenshot({ path: path.join(OUT, `${name}-${dark ? 'night' : 'day'}.png`), timeout: 120000 });
      }
      await setTheme(false);
    };
    const modalIs = (kind, ms = 60000) => page.waitForFunction(k => !!document.querySelector(`#modalCard [data-cs-card="${k}"]`) && !document.getElementById('modal').hidden, kind, { timeout: ms });
    const toBarn = async () => {
      if (!(await ev(() => window.slimekin.barnRanch.active))) await touchEl('#tab-ranch');
      await page.waitForFunction(() => { const b = window.slimekin.barnRanch; return (b.on && b.view.ready) || b.view.failed; }, null, { timeout: 180000 });
      await ev(() => { window.slimekin.hud.closeModal(); window.__ok.tag(window.slimekin.barnRanch.view.av); });
    };
    const onStand = async id => {
      await ev(i => { const g = window.slimekin; g.hud.closeModal(); g.hud.onModalClose = null; g.hud.openTab('ranch'); g.focusResident(i); }, id);
      await page.waitForFunction(i => { const b = window.slimekin.barnRanch; return b.curId === i && !b.view.swapping; }, id, { timeout: 120000 });
      await ev(i => { const r = window.slimekin.ranch.resident(i); if (r) window.__ok.tag(r.av); }, id);
    };
    const id = name => ev(n => window.slimekin.state.ranch.residents.find(x => x.name === n).id, name);
    const W = o => SL.map(s => `${s} ${o[s] || '-'}`).join(', ');
    const want0 = o => Object.fromEntries(SL.map(s => [s, o[s] || null]));
    // the save, the 3D and the page agree with `exp` ({ head, face, neck }); where: a label for the log
    const agreeHome = (r, exp) => {
      const e = want0(exp), on = SL.map(s => e[s]).filter(Boolean).sort();
      const why = [];
      if (JSON.stringify(r.state) !== JSON.stringify(e)) why.push(`save ${W(r.state)}`);
      if (JSON.stringify(r.av.held) !== JSON.stringify(e)) why.push(`3D holds ${W(r.av.held)}`);
      if (JSON.stringify(r.av.attached) !== JSON.stringify(on)) why.push(`3D draws ${r.av.attached.join('+') || 'nothing'}`);
      if (r.rows && JSON.stringify(r.ui.map(u => u.id).sort()) !== JSON.stringify(on)) why.push(`page marks ${r.ui.map(u => u.id).join('+') || 'nothing'} worn`);
      if (r.rows && r.ui.some(u => u.chip !== 'Wearing' || u.pressed !== 'true')) why.push(`a worn row reads ${r.ui.map(u => `${u.id}:${u.chip}:${u.pressed}`).join(' ')}`);
      return why;
    };
    const agreeRes = (r, exp, { stand = true } = {}) => {
      const e = want0(exp), on = SL.map(s => e[s]).filter(Boolean).sort();
      const why = [];
      if (JSON.stringify(r.state) !== JSON.stringify(e)) why.push(`save ${W(r.state)}`);
      if (stand && !r.stand) why.push('not on the stand');
      for (const [k, d] of [['stand', r.stand], ['ranch avatar', r.lite]]) {
        if (!d) continue;
        if (JSON.stringify(d.held) !== JSON.stringify(e)) why.push(`${k} holds ${W(d.held)}`);
        if (JSON.stringify(d.attached) !== JSON.stringify(on)) why.push(`${k} draws ${d.attached.join('+') || 'nothing'}`);
      }
      if (r.ui && JSON.stringify(r.ui.map(u => u.id).sort()) !== JSON.stringify(on)) why.push(`Dress up shows ${r.ui.map(u => u.id).join('+') || 'nothing'} as worn`);
      if (r.ui && r.ui.some(u => !/Wearing$/.test(u.text))) why.push(`a worn row reads ${r.ui.map(u => u.text).join(' / ')}`);
      return why;
    };

    // ---------------- the captain's path, real touches ----------------
    if (want('dress')) {
      await step('dress: Mochi\'s Dress up, the beret she wears', async () => {
        await toBarn();
        await onStand(MOCHI);
        await touchEl('#body-ranch [data-cs="dress"]');
        await modalIs('dress');
        const r = await ev(i => window.__ok.res(i), MOCHI);
        const first = await ev(() => { const g = [...document.querySelectorAll('#modalCard .cs-group')].find(e => e.textContent === 'Head'), row = g && g.nextElementSibling; return row ? { text: row.innerText.replace(/\s+/g, ' ').trim(), pressed: row.getAttribute('aria-pressed'), not: row.classList.contains('not') } : null; });
        log('Head, first row:', JSON.stringify(first), '| worn', W(r.state), '| stand', r.stand && r.stand.attached.join('+'));
        check(r.state.head === 'beret' && r.stand && r.stand.attached.join() === 'beret', 'the test ranch: Mochi wears the Artist Beret (the family owns none) and the stand draws it', JSON.stringify(r.stand));
        check(!!first && /^Artist Beret .*Wearing$/.test(first.text) && first.pressed === 'true' && !first.not, 'Dress up shows the beret she wears as Wearing (first under Head), not as an outfit she can\'t have', JSON.stringify(first));
        await shot('dress-1-beret');
        // the Tiny Crown: the family does not own it yet
        await ev(() => { const row = [...document.querySelectorAll('#modalCard .cs-outfit')].find(e => (e.querySelector('b') || {}).textContent === 'Tiny Crown'); row.setAttribute('data-test', 'crown'); });
        await touchEl('#modalCard [data-test="crown"]');
        await page.waitForTimeout(150);
        const t = await ev(i => { const row = document.querySelector('#modalCard [data-test="crown"]') || [...document.querySelectorAll('#modalCard .cs-outfit')].find(e => (e.querySelector('b') || {}).textContent === 'Tiny Crown'); return { shook: !!row && row.classList.contains('shake'), text: row && row.innerText.replace(/\s+/g, ' ').trim(), res: window.__ok.res(i) }; }, MOCHI);
        check(t.shook && /In Outfits/.test(t.text), 'touching the Tiny Crown (not owned) answers: the row shakes, and it says where to get one ("In Outfits")', JSON.stringify({ shook: t.shook, text: t.text }));
        check(!agreeRes(t.res, { head: 'beret' }).length, 'and nothing changes: she keeps the beret (save, stand, ranch avatar, card)', agreeRes(t.res, { head: 'beret' }).join('; '));
        await touchEl('#modalCard [data-cs="done"]');
        await page.waitForFunction(() => document.getElementById('modal').hidden, null, { timeout: 30000 });
      }, 400000);
      await step('dress: buy the Tiny Crown in Outfits (it goes on Pebble at home)', async () => {
        await touchEl('#tab-outfits');
        await page.waitForFunction(() => window.slimekin.view !== 'ranch' && !!document.querySelector('#body-outfits .outfit[data-id="crown"]'), null, { timeout: 60000 });
        await ev(() => window.slimekin.debug('tera'));
        await touchEl('#body-outfits .outfit[data-id="crown"]');
        await page.waitForFunction(() => window.slimekin.state.outfits.owned.includes('crown'), null, { timeout: 30000 });
        const h = await ev(() => window.__ok.home());
        check(!agreeHome(h, { head: 'crown' }).length, 'bought: Pebble wears the Tiny Crown (save, 3D, Outfits page)', agreeHome(h, { head: 'crown' }).join('; '));
      }, 300000);
      await step('dress: the Tiny Crown on Mochi', async () => {
        await toBarn();
        await onStand(MOCHI);
        await touchEl('#body-ranch [data-cs="dress"]');
        await modalIs('dress');
        await touchEl('#modalCard [data-outfit="crown"]');
        await page.waitForFunction(() => !!document.querySelector('#modalCard [data-outfit="crown"][aria-pressed="true"]'), null, { timeout: 30000 });
        const r = await ev(i => window.__ok.res(i), MOCHI);
        const beret = await ev(() => { const row = [...document.querySelectorAll('#modalCard .cs-outfit')].find(e => (e.querySelector('b') || {}).textContent === 'Artist Beret'); return row && { text: row.innerText.replace(/\s+/g, ' ').trim(), not: row.classList.contains('not') }; });
        check(!agreeRes(r, { head: 'crown' }).length, 'Mochi wears the Tiny Crown: the save, the stand and the ranch avatar draw only the crown, the card marks only the crown', agreeRes(r, { head: 'crown' }).join('; ') || W(r.state));
        check(!!beret && beret.not && /In Outfits/.test(beret.text), 'the beret is off; its row now reads "In Outfits" (the family does not own one)', JSON.stringify(beret));
        await shot('dress-2-crown');
        await touchEl('#modalCard [data-cs="done"]');
        await page.waitForFunction(() => document.getElementById('modal').hidden, null, { timeout: 30000 });
        await ev(() => window.slimekin.hud.setSheet('closed', false));
        await shot('dress-3-stand-crown', { night: false });
      }, 400000);
    }

    // ---------------- every pair, every slot (clicks) ----------------
    const finals = { home: { head: null, face: null, neck: null }, mochi: null };
    if (want('pairs')) {
      await step('pairs: at home, the Outfits page', async () => {
        await ev(() => { const g = window.slimekin; g.leaveRanch(); g.state.jelly = 1e12; g.state.outfits.owned = ['bow', 'bowtie', 'glasses', 'flowers', 'scarf', 'beret', 'shades', 'party', 'crown']; g.hud.outfitKey = ''; g.hud.openTab('outfits'); g.hud.renderOutfits(); });
        await page.waitForFunction(() => document.querySelectorAll('#body-outfits .outfit.owned').length === 9, null, { timeout: 30000 });
        const exp = want0(await ev(() => window.slimekin.state.outfits.worn));
        let steps = 0;
        const bad = [];
        const tap = async o => { await ev(i => document.querySelector(`#body-outfits .outfit[data-id="${i}"]`).click(), o); steps++; };
        const look = async what => { const r = await ev(() => window.__ok.home()); const why = agreeHome(r, exp); if (why.length) bad.push(`${what}: ${why.join('; ')}`); };
        for (const s of SL) {
          const seq = walk(ITEMS[s]);
          for (let i = 0; i < seq.length; i++) { const was = exp[s]; await tap(seq[i]); exp[s] = seq[i]; await look(`${s} ${was || '(nothing)'} -> ${seq[i]}`); }
          await tap(seq[seq.length - 1]); exp[s] = null; await look(`${s} ${seq[seq.length - 1]} again (off)`);
          await tap(seq[1]); exp[s] = seq[1]; await look(`${s} ${seq[1]} on`);
        }
        Object.assign(finals.home, exp);
        check(!bad.length, `home: ${steps} touches through every pair in every slot; the save, the 3D slime and the Outfits page agree after each`, bad.slice(0, 3).join(' | ') || W(exp));
        await ev(() => document.querySelector('#body-outfits .outfit[data-id="flowers"]').scrollIntoView({ block: 'center' }));
        await shot('pairs-home', { night: false });
      }, 400000);
      await step('pairs: Mochi in Dress up', async () => {
        await toBarn();
        await onStand(MOCHI);
        await ev(i => window.slimekin.contestsUI.openDress(i), MOCHI);
        await modalIs('dress');
        const exp = want0(await ev(i => window.slimekin.state.ranch.residents.find(x => x.id === i).worn, MOCHI));
        let steps = 0;
        const bad = [];
        const tap = async o => { await ev(i => document.querySelector(`#modalCard [data-outfit="${i}"]`).click(), o); steps++; };
        const look = async what => {
          const r = await ev(i => window.__ok.res(i), MOCHI);
          const why = agreeRes(r, exp);
          if (why.length) bad.push(`${what}: ${why.join('; ')}`);
        };
        for (const s of SL) {
          const seq = walk(ITEMS[s]);
          for (let i = 0; i < seq.length; i++) { const was = exp[s]; await tap(seq[i]); exp[s] = seq[i]; await look(`${s} ${was || '(nothing)'} -> ${seq[i]}`); }
          await tap(seq[seq.length - 1]); exp[s] = null; await look(`${s} ${seq[seq.length - 1]} again (off)`);
          await tap(seq[2 % seq.length]); exp[s] = seq[2 % seq.length]; await look(`${s} ${exp[s]} on`);
        }
        finals.mochi = { ...exp };
        check(!bad.length, `Mochi: ${steps} touches through every pair in every slot; the save, the stand, the ranch avatar and the card agree after each`, bad.slice(0, 3).join(' | ') || W(exp));
        await ev(() => { const g = window.slimekin; g.hud.onModalClose = null; g.hud.closeModal(); });
      }, 400000);
    }

    // ---------------- two residents swap on the stand ----------------
    if (want('swap')) {
      await step('swap: Juniper and Mochi dressed differently, back and forth', async () => {
        await toBarn();
        const jun = await id('Juniper');
        await ev(() => { const g = window.slimekin; for (const o of ['beret', 'shades', 'party', 'crown']) if (!g.state.outfits.owned.includes(o)) g.state.outfits.owned.push(o); });
        await onStand(jun);
        await ev(i => window.slimekin.contestsUI.openDress(i), jun);
        await modalIs('dress');
        for (const o of ['party', 'shades', 'bowtie']) await ev(i => document.querySelector(`#modalCard [data-outfit="${i}"]`).click(), o);
        const jw = await ev(i => window.slimekin.state.ranch.residents.find(x => x.id === i).worn, jun);
        await ev(() => { const g = window.slimekin; g.hud.onModalClose = null; g.hud.closeModal(); });
        const mw = await ev(i => window.slimekin.state.ranch.residents.find(x => x.id === i).worn, MOCHI);
        const bad = [];
        // a swipe when they stand next to each other (the swap the captain makes), else picked in the menu (the same swap)
        const order = await ev(() => window.slimekin.barnRanch.order);
        const step1 = (from, to) => { const d = order.indexOf(to) - order.indexOf(from); return Math.abs(d) === 1 ? d : 0; };
        for (const [from, to, w] of [[jun, MOCHI, mw], [MOCHI, jun, jw], [jun, MOCHI, mw], [MOCHI, jun, jw]]) {
          await ev(([k, i]) => { const g = window.slimekin; g.hud.closeModal(); if (k) g.barnRanch.request(k); else g.barnRanch.show(i); }, [step1(from, to), to]);
          await page.waitForFunction(i => { const b = window.slimekin.barnRanch; return b.curId === i && !b.view.swapping; }, to, { timeout: 120000 });
          const r = await ev(i => window.__ok.res(i), to);
          const why = agreeRes(r, w);
          if (why.length) bad.push(`${to}: ${why.join('; ')}`);
        }
        check(!bad.length, `the stand dresses each one only in its own outfits, four swaps (Juniper ${W(jw)}; Mochi ${W(mw)})`, bad.join(' | '));
      }, 400000);
    }

    // ---------------- after a reload ----------------
    if (want('reload')) {
      await step('reload: everything as it was', async () => {
        const before = await ev(() => { const g = window.slimekin; return { home: g.state.outfits.worn, res: Object.fromEntries(g.state.ranch.residents.map(x => [x.id, x.worn])) }; });
        await ev(() => window.slimekin.saveNow());
        await page.reload();
        await boot();
        await ev(() => { const g = window.slimekin; g.hud.openTab('outfits'); g.hud.outfitKey = ''; g.hud.renderOutfits(); });
        await page.waitForFunction(() => document.querySelectorAll('#body-outfits .outfit').length > 0, null, { timeout: 30000 });
        const h = await ev(() => window.__ok.home());
        check(!agreeHome(h, before.home).length, 'after a reload Pebble wears the same (save, 3D, Outfits page)', agreeHome(h, before.home).join('; ') || W(before.home));
        await toBarn();
        const bad = [];
        for (const rid of Object.keys(before.res)) {
          const away = await ev(i => !!window.slimekin.state.ranch.residents.find(x => x.id === i).trip, rid);
          if (away) continue;
          await onStand(rid);
          const r = await ev(i => window.__ok.res(i), rid);
          const why = agreeRes(r, before.res[rid]);
          if (why.length) bad.push(`${rid}: ${why.join('; ')}`);
        }
        await onStand(MOCHI);
        await ev(i => window.slimekin.contestsUI.openDress(i), MOCHI);
        await modalIs('dress');
        const m = await ev(i => window.__ok.res(i), MOCHI);
        const why = agreeRes(m, before.res[MOCHI]);
        if (why.length) bad.push(`Mochi in Dress up: ${why.join('; ')}`);
        check(!bad.length, 'after a reload every resident on the stand wears its own outfits, and Mochi\'s Dress up card marks the same', bad.join(' | ') || W(before.res[MOCHI]));
        await ev(() => { const g = window.slimekin; g.hud.onModalClose = null; g.hud.closeModal(); });
      }, 600000);
    }

    // ---------------- at home: an outfit worn that the family does not own ----------------
    if (want('unowned')) {
      await step('unowned: Pebble in a Party Hat the family does not own', async () => {
        const save = await ev(() => { const g = window.slimekin; g.saveNow(); const s = JSON.parse(localStorage.getItem('slimekin.save.v1')); s.outfits.owned = ['bow', 'bowtie', 'flowers', 'glasses', 'scarf']; s.outfits.worn = { head: 'party', face: null, neck: null }; s.jelly = 1000; return s; });
        await ev(s => sessionStorage.setItem('nextSave', JSON.stringify(s)), save);
        await page.reload();
        await boot();
        await ev(() => { const g = window.slimekin; g.hud.openTab('outfits'); });
        await page.waitForFunction(() => !!document.querySelector('#body-outfits .outfit[data-id="party"]'), null, { timeout: 30000 });
        const h = await ev(() => window.__ok.home());
        const party = await ev(() => { const b = document.querySelector('#body-outfits .outfit[data-id="party"]'); return { text: b.innerText.replace(/\s+/g, ' ').trim(), worn: b.classList.contains('worn') }; });
        check(!agreeHome(h, { head: 'party' }).length, 'the Outfits page shows the Party Hat Pebble wears as Wearing (not a price)', agreeHome(h, { head: 'party' }).join('; ') + ' | ' + party.text);
        await ev(() => document.querySelector('#body-outfits .outfit[data-id="party"]').scrollIntoView({ block: 'center' }));
        await shot('unowned-1-party');
        await touchEl('#body-outfits .outfit[data-id="party"]');
        await page.waitForTimeout(300);
        const h2 = await ev(() => window.__ok.home());
        const after = await ev(() => { const b = document.querySelector('#body-outfits .outfit[data-id="party"]'); return b.innerText.replace(/\s+/g, ' ').trim(); });
        check(!agreeHome(h2, {}).length && /5B/.test(after), 'a touch takes it off: nothing on the head (save, 3D, page), and the Party Hat shows its price again', agreeHome(h2, {}).join('; ') + ' | ' + after);
        await shot('unowned-2-off');
      }, 400000);
    }

    // ---------------- the jelly counter's numbers ----------------
    if (want('counter')) {
      await step('counter: M PLUS Rounded 1c', async () => {
        await ev(() => { const g = window.slimekin; g.hud.closeModal(); if (g.view === 'ranch') g.leaveRanch(); g.state.jelly = 1.2e9; g.hud.setSheet('closed', false); });
        await page.waitForTimeout(800);
        const f = await ev(() => { const el = document.getElementById('jellyCount'), cs = getComputedStyle(el); return { text: el.textContent, family: cs.fontFamily, weight: cs.fontWeight, label: getComputedStyle(document.querySelector('.tab .tl')).fontFamily }; });
        check(/^"?M PLUS Rounded 1c"?/.test(f.family) && f.weight === '800', 'the jelly counter\'s number is set in M PLUS Rounded 1c 800', JSON.stringify(f));
        await page.screenshot({ path: path.join(OUT, 'counter-day.png'), clip: { x: 180, y: 0, width: 210, height: 110 } });
      }, 120000);
    }

    errors.push(...kit.errors);
    kit.report();
  } catch (e) {
    errors.push(e.message);
    if (kit) { try { await kit.page.screenshot({ path: path.join(OUT, 'outfit-smoke-failed.png'), timeout: 60000 }); log('picture of the failure: tools/out/outfits/outfit-smoke-failed.png'); } catch { /* none */ } }
  } finally {
    if (kit) await kit.close();
  }
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
