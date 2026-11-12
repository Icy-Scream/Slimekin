// Outfits in the real game (390 x 844, a phone in a headless browser), from the :8822 test copy's "Load the test ranch"
// save (tools/fixtures/talents/ranch-trained.json, the family owning Ribbon Bow, Bow Tie, Flower Crown, Round Glasses
// and Cozy Scarf). The captain's report (11 Nov): "the artisan beret remained as worn even though I selected the crown".
// Everywhere it checks three things agree: what the save says it wears, what the 3D slime draws (every outfit object
// still attached to it, so a leftover shows up) and what the page shows as worn.
//   dress    real touches (CDP Input.dispatchTouchEvent): Mochi's Dress up shows the Artist Beret she wears (the family
//            does not own one) as Wearing, the family's outfits as "Wear", the rest as "Needs N jelly" (a touch does
//            nothing); "Wear" puts the Round Glasses on; with more jelly the open card turns rows into "<price> Buy &
//            wear", and touching the Tiny Crown's buys it with the Outfits page's rule (jelly down by exactly its price)
//            and puts it on Mochi: the beret is gone from the save, the stand and the ranch avatar, the Style meter counts
//            the crown, Pebble keeps what she wore; a reload keeps it (the captain, 11 Nov: "I should be able to wear
//            items from my outfits and select wear too")
//   home     the Outfits page's tiles read the same labels ("✓ Wearing", "Wear", "<price> Buy & wear", "Needs N jelly");
//            "Needs" does nothing, "Buy & wear" buys at the price and Pebble wears it
//   pairs    clicks: every slot, every pair of outfits in it, in both orders, as one walk per slot: at home in the
//            Outfits page and on Mochi in Dress up (the stand and the ranch avatar too); the same one again takes it off
//   swap     two residents dressed differently swap on the stand back and forth: each wears only its own
//   reload   after a reload: Pebble at home, the Outfits page, Mochi and Juniper on the stand, Dress up
//   unowned  at home: Pebble wears a Party Hat the family does not own (a hand-made save): the Outfits page shows it as
//            worn and a touch takes it off
//   counter  the jelly counter's number is set in M PLUS Rounded 1c 800 (design/STYLE.md §4: DynaPuff's B reads as 8)
// Fails on any page error. Screenshots (day, and night unless --quick) in tools/out/outfits/.
//   node tools/outfit-smoke.cjs [--quick] [--dpr 2] [--only=dress,home,pairs,swap,reload,unowned,counter] [--fonts <dir>]
//   (--fonts: a folder with DynaPuff[wdth,wght].ttf and MPLUSRounded1c-Bold/ExtraBold.ttf, for screenshots in the
//   game's own fonts; offline the page falls back to the system's)
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const arg = (name, def) => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); if (a) return a.slice(name.length + 3); const i = process.argv.indexOf('--' + name); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def; };
const QUICK = process.argv.includes('--quick');
const DPR = Number(arg('dpr', 1));
const ONLY = arg('only', 'dress,home,pairs,swap,reload,unowned,counter').split(',').filter(Boolean);
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
      if (r.rows && r.ui.some(u => !/^Wearing$/.test(u.chip.trim()) || u.pressed !== 'true')) why.push(`a worn row reads ${r.ui.map(u => `${u.id}:${u.chip}:${u.pressed}`).join(' ')}`);
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
    // a Dress up row as the player reads it (what is shown; a hidden label is not in innerText), by outfit id
    const dressRow = oid => ev(o => { const row = document.querySelector(`#modalCard .cs-outfit[data-outfit="${o}"]`); return row ? { text: row.innerText.replace(/\s+/g, ' ').trim(), pressed: row.getAttribute('aria-pressed') } : null; }, oid);
    const meter = () => ev(() => (document.querySelector('#modalCard .cs-meter b') || {}).textContent || '');
    // prices, their short labels and Style, from the game's own content.js
    const content = () => ev(async () => {
      const c = await import('/src/data/content.js'), f = await import('/src/core/format.js');
      return { cost: Object.fromEntries(c.OUTFITS.map(o => [o.id, o.cost])), short: Object.fromEntries(c.OUTFITS.map(o => [o.id, f.fmtShort(o.cost)])), slot: Object.fromEntries(c.OUTFITS.map(o => [o.id, o.slot])), style: c.CONTESTS.style, cap: c.CONTESTS.score.styleCap };
    });
    // every buy from here on, with the jelly just before and just after it (helpers keep making jelly between frames, so
    // the price is checked inside the call): Sim.buyOutfit (the Outfits page's rule) and Sim.buyAndDress (Dress up's)
    const probe = () => ev(() => {
      const sim = window.slimekin.sim;
      if (sim.__probe) { sim.__probe.length = 0; return; }
      sim.__probe = [];
      for (const k of ['buyOutfit', 'buyAndDress']) {
        const orig = sim[k];
        if (typeof orig !== 'function') continue;
        sim[k] = function (...a) { const before = this.s.jelly, r = orig.apply(this, a); sim.__probe.push({ k, a, before, after: this.s.jelly, ok: !!r && r.ok !== false }); return r; };
      }
    });
    if (want('dress')) {
      await step('dress: Mochi\'s Dress up, every kind of row', async () => {
        await toBarn();
        await onStand(MOCHI);
        await touchEl('#body-ranch [data-cs="dress"]');
        await modalIs('dress');
        const K = await content();
        const r = await ev(i => window.__ok.res(i), MOCHI);
        const first = await ev(() => { const g = [...document.querySelectorAll('#modalCard .cs-group')].find(e => e.textContent === 'Head'), row = g && g.nextElementSibling; return row ? { text: row.innerText.replace(/\s+/g, ' ').trim(), pressed: row.getAttribute('aria-pressed'), id: row.dataset.outfit } : null; });
        log('Head, first row:', JSON.stringify(first), '| worn', W(r.state), '| stand', r.stand && r.stand.attached.join('+'));
        check(r.state.head === 'beret' && r.stand && r.stand.attached.join() === 'beret', 'the test ranch: Mochi wears the Artist Beret (the family owns none) and the stand draws it', JSON.stringify(r.stand));
        check(!!first && first.id === 'beret' && /^Artist Beret .*Wearing$/.test(first.text) && first.pressed === 'true', 'Dress up shows the beret she wears as "Wearing", first under Head', JSON.stringify(first));
        const jelly0 = await ev(() => window.slimekin.state.jelly);
        const rows = {};
        for (const o of ['bow', 'flowers', 'party', 'crown', 'glasses', 'shades', 'bowtie', 'scarf']) rows[o] = await dressRow(o);
        log('rows:', Object.entries(rows).map(([k, v]) => `${k}: ${v && v.text}`).join(' | '));
        const owned = ['bow', 'flowers', 'glasses', 'bowtie', 'scarf'], poor = ['party', 'crown', 'shades'];
        check(owned.every(o => rows[o] && / Wear$/.test(rows[o].text) && rows[o].pressed === 'false'), 'every outfit the family owns reads "Wear"', owned.map(o => rows[o] && rows[o].text).join(' / '));
        check(poor.every(o => rows[o] && rows[o].text.endsWith(`Needs ${K.short[o]} jelly`) && !/Buy|In Outfits/.test(rows[o].text)), `with ${Math.round(jelly0)} jelly, the ones the family can't afford read "Needs N jelly" (the Tiny Crown: "Needs ${K.short.crown} jelly")`, poor.map(o => rows[o] && rows[o].text).join(' / '));
        await shot('dress-1-needs');
        // touching a row it can't afford does nothing
        await probe();
        await touchEl('#modalCard .cs-outfit[data-outfit="crown"]');
        await page.waitForTimeout(300);
        const t = await ev(i => { const g = window.slimekin; return { res: window.__ok.res(i), owned: g.state.outfits.owned.slice(), jelly: g.state.jelly, probe: g.sim.__probe.slice() }; }, MOCHI);
        const crownRow = await dressRow('crown');
        check(!agreeRes(t.res, { head: 'beret' }).length && !t.owned.includes('crown') && t.jelly >= jelly0 && !t.probe.length && crownRow.text.endsWith(`Needs ${K.short.crown} jelly`),
          `touching "Needs ${K.short.crown} jelly" does nothing: nothing bought, no jelly spent, she keeps the beret (save, stand, ranch avatar, card)`, agreeRes(t.res, { head: 'beret' }).join('; ') + ` | ${JSON.stringify(t.probe)} | ${crownRow.text}`);
      }, 400000);
      await step('dress: "Wear" on an outfit the family owns', async () => {
        const K = await content();
        const m0 = await meter();
        await touchEl('#modalCard .cs-outfit[data-outfit="glasses"]');
        await page.waitForFunction(() => !!document.querySelector('#modalCard .cs-outfit[data-outfit="glasses"][aria-pressed="true"]'), null, { timeout: 30000 });
        const r = await ev(i => window.__ok.res(i), MOCHI);
        const m1 = await meter(), row = await dressRow('glasses');
        check(!agreeRes(r, { head: 'beret', face: 'glasses' }).length && /Wearing$/.test(row.text), 'touching "Wear" on the Round Glasses puts them on: the save, the stand, the ranch avatar and the card agree', agreeRes(r, { head: 'beret', face: 'glasses' }).join('; ') + ' | ' + row.text);
        check(m1 === `Style ${Math.min(K.style.beret + K.style.glasses, K.cap)} of ${K.cap}` && m1 !== m0, `the Style meter moves straight away (${m0} -> ${m1})`);
      }, 300000);
      await step('dress: "Buy & wear" the Tiny Crown on Mochi', async () => {
        const K = await content();
        // the rows follow the jelly while the card is open
        await ev(() => { window.slimekin.state.jelly = 1e10; });
        await page.waitForFunction(() => /Buy & wear$/.test((document.querySelector('#modalCard .cs-outfit[data-outfit="party"]') || {}).innerText || ''), null, { timeout: 20000 });
        const rows = {};
        for (const o of ['party', 'shades', 'crown']) rows[o] = await dressRow(o);
        check(rows.party.text.endsWith(`${K.short.party} Buy & wear`) && rows.shades.text.endsWith(`${K.short.shades} Buy & wear`) && rows.crown.text.endsWith(`Needs ${K.short.crown} jelly`),
          `with 10B jelly, the card still open: "${K.short.party} Buy & wear" on the Party Hat, "${K.short.shades} Buy & wear" on the Star Shades, still "Needs ${K.short.crown} jelly" on the Tiny Crown`, Object.values(rows).map(x => x.text).join(' / '));
        await ev(() => document.querySelector('#modalCard .cs-meter').scrollIntoView({ block: 'start' }));
        await shot('dress-2-kinds');
        await ev(() => { window.slimekin.state.jelly = 1.5e11; });
        await page.waitForFunction(() => /Buy & wear$/.test((document.querySelector('#modalCard .cs-outfit[data-outfit="crown"]') || {}).innerText || ''), null, { timeout: 20000 });
        const crown0 = await dressRow('crown');
        check(crown0.text.endsWith(`${K.short.crown} Buy & wear`), `with 150B jelly the Tiny Crown reads "${K.short.crown} Buy & wear"`, crown0.text);
        await probe();
        const home0 = await ev(() => ({ ...window.slimekin.state.outfits.worn }));
        await touchEl('#modalCard .cs-outfit[data-outfit="crown"]');
        await page.waitForFunction(() => !!document.querySelector('#modalCard .cs-outfit[data-outfit="crown"][aria-pressed="true"]'), null, { timeout: 30000 });
        const t = await ev(i => {
          const g = window.slimekin, s = JSON.parse(localStorage.getItem('slimekin.save.v1'));
          return { res: window.__ok.res(i), probe: g.sim.__probe.slice(), owned: g.state.outfits.owned.slice(), home: { ...g.state.outfits.worn }, saved: { owned: s.outfits.owned, worn: s.ranch.residents.find(x => x.id === i).worn } };
        }, MOCHI);
        const bd = t.probe.filter(p => p.k === 'buyAndDress'), bo = t.probe.filter(p => p.k === 'buyOutfit');
        check(bd.length === 1 && bo.length === 1 && bo[0].a[0] === 'crown' && bo[0].ok && bd[0].after === bd[0].before - K.cost.crown && bo[0].after === bo[0].before - K.cost.crown,
          `bought with the Outfits page's rule (Sim.buyOutfit, once): the jelly went down by exactly its price, ${K.cost.crown}`, JSON.stringify(t.probe));
        check(!agreeRes(t.res, { head: 'crown', face: 'glasses' }).length, 'Mochi wears the Tiny Crown: the beret is gone from the save, the stand and the ranch avatar, and the card marks the crown', agreeRes(t.res, { head: 'crown', face: 'glasses' }).join('; ') || W(t.res.state));
        const beret = await dressRow('beret'), m = await meter();
        check(!!beret && beret.pressed === 'false' && beret.text.endsWith(`${K.short.beret} Buy & wear`), `the beret's row now reads "${K.short.beret} Buy & wear"`, JSON.stringify(beret));
        check(m === `Style ${Math.min(K.style.crown + K.style.glasses, K.cap)} of ${K.cap}`, 'the Style meter counts the crown', m);
        check(t.owned.filter(o => o === 'crown').length === 1 && JSON.stringify(want0(t.home)) === JSON.stringify(want0(home0)), 'the family owns one Tiny Crown; Pebble at home wears what she wore', `${t.owned.join(',')} | home ${W(t.home)}`);
        check(t.saved.owned.includes('crown') && t.saved.worn.head === 'crown', 'the game saved it straight away', JSON.stringify(t.saved));
        await shot('dress-3-crown');
        await touchEl('#modalCard [data-cs="done"]');
        await page.waitForFunction(() => document.getElementById('modal').hidden, null, { timeout: 30000 });
        await ev(() => window.slimekin.hud.setSheet('closed', false));
        await shot('dress-4-stand-crown', { night: false });
      }, 400000);
      await step('dress: a reload keeps the crown on Mochi', async () => {
        const K = await content();
        await page.reload();   // no saveNow first: what the game saved when it bought the crown
        await boot();
        await toBarn();
        await onStand(MOCHI);
        const r = await ev(i => window.__ok.res(i), MOCHI);
        const owned = await ev(() => window.slimekin.state.outfits.owned.slice());
        check(!agreeRes(r, { head: 'crown', face: 'glasses' }).length && owned.includes('crown'), 'after a reload Mochi wears the crown and the glasses on the stand and the ranch avatar, and the family owns the crown', agreeRes(r, { head: 'crown', face: 'glasses' }).join('; ') || owned.join(','));
        await touchEl('#body-ranch [data-cs="dress"]');
        await modalIs('dress');
        const crown = await dressRow('crown'), beret = await dressRow('beret');
        check(/Wearing$/.test(crown.text) && crown.pressed === 'true' && beret.text.endsWith(`${K.short.beret} Buy & wear`), 'and her Dress up reads "Wearing" on the crown, "Buy & wear" on the beret', `${crown.text} / ${beret.text}`);
        await touchEl('#modalCard [data-cs="done"]');
        await page.waitForFunction(() => document.getElementById('modal').hidden, null, { timeout: 30000 });
      }, 600000);
    }

    // ---------------- the Outfits page at home: the same labels ----------------
    if (want('home')) {
      await step('home: the Outfits page reads Wearing, Wear, Buy & wear, Needs N jelly', async () => {
        const K = await content();
        await ev(() => { const g = window.slimekin; g.hud.closeModal(); g.hud.onModalClose = null; });
        await touchEl('#tab-outfits');
        await page.waitForFunction(() => window.slimekin.view !== 'ranch' && !!document.querySelector('#body-outfits .outfit[data-id="crown"]'), null, { timeout: 60000 });
        await ev(() => { window.slimekin.state.jelly = 1e9; });
        await page.waitForTimeout(600);
        // what each tile should read, from the save: worn, owned, enough jelly (the Outfits page's canAfford), or not
        const rows = () => ev(() => { const g = window.slimekin, o = g.state.outfits; return { jelly: g.state.jelly, worn: { ...o.worn }, owned: o.owned.slice(),
          tiles: [...document.querySelectorAll('#body-outfits .outfit')].map(b => ({ id: b.dataset.id, text: b.innerText.replace(/\s+/g, ' ').trim(), check: !!b.querySelector('.wear.on .gi.check') })) }; });
        const kind = (r, id) => (r.worn[K.slot[id]] === id ? 'wearing' : r.owned.includes(id) ? 'wear' : r.jelly + 1e-9 >= K.cost[id] ? 'buy' : 'needs');
        const label = (r, id) => ({ wearing: 'Wearing', wear: 'Wear', buy: `${K.short[id]} Buy & wear`, needs: `Needs ${K.short[id]} jelly` })[kind(r, id)];
        const bad = r => r.tiles.filter(x => !x.text.endsWith(' ' + label(r, x.id)) || (kind(r, x.id) === 'wearing') !== x.check);
        // the bow goes on with "Wear" (so every kind shows)
        await ev(() => { const o = window.slimekin.state.outfits; if (o.worn.head === 'bow') window.slimekin.wearOutfit('bow'); });
        await touchEl('#body-outfits .outfit[data-id="bow"]');
        await page.waitForFunction(() => window.slimekin.state.outfits.worn.head === 'bow', null, { timeout: 30000 });
        await page.waitForTimeout(300);
        const r1 = await rows();
        log('tiles:', r1.tiles.map(x => `${x.id}: ${x.text.split(' ').slice(-4).join(' ')}`).join(' | '));
        const kinds = new Set(r1.tiles.map(x => kind(r1, x.id)));
        check(!bad(r1).length && r1.tiles.length === 9 && kinds.size === 4, 'at 1B jelly every tile reads its label: "✓ Wearing" on the bow Pebble wears, "Wear" on the other owned ones, "N Buy & wear" or "Needs N jelly" on the rest',
          bad(r1).map(x => `${x.id}: ${x.text} (want ${label(r1, x.id)})`).join(' | ') || [...kinds].join(','));
        const h = await ev(() => window.__ok.home());
        check(!agreeHome(h, { head: 'bow' }).length, 'Pebble wears the bow: the save, the 3D slime and the page agree', agreeHome(h, { head: 'bow' }).join('; '));
        // a tile it can't afford does nothing; a "Buy & wear" one buys with the same rule and puts it on Pebble
        const ids = r1.tiles.map(x => x.id);
        const needs = ids.find(i => kind(r1, i) === 'needs'), buy = ids.find(i => kind(r1, i) === 'buy' && K.slot[i] !== 'head') || ids.find(i => kind(r1, i) === 'buy');
        await probe();
        await touchEl(`#body-outfits .outfit[data-id="${needs}"]`);
        await page.waitForTimeout(300);
        const t1 = await ev(() => ({ probe: window.slimekin.sim.__probe.slice(), worn: { ...window.slimekin.state.outfits.worn } }));
        const r2 = await rows();
        check(!t1.probe.some(p => p.ok) && JSON.stringify(want0(t1.worn)) === JSON.stringify(want0(r1.worn)) && r2.tiles.find(x => x.id === needs).text.endsWith(`Needs ${K.short[needs]} jelly`),
          `touching "Needs ${K.short[needs]} jelly" (${needs}) buys nothing and changes nothing`, JSON.stringify(t1));
        await probe();
        await touchEl(`#body-outfits .outfit[data-id="${buy}"]`);
        await page.waitForFunction(i => window.slimekin.state.outfits.owned.includes(i), buy, { timeout: 30000 });
        await page.waitForTimeout(300);
        const t2 = await ev(() => window.slimekin.sim.__probe.slice());
        const bo = t2.filter(p => p.k === 'buyOutfit'), exp = { ...r1.worn, [K.slot[buy]]: buy };
        const h2 = await ev(() => window.__ok.home());
        check(bo.length === 1 && bo[0].after === bo[0].before - K.cost[buy] && !agreeHome(h2, exp).length, `touching "${K.short[buy]} Buy & wear" (${buy}) buys it at its price and Pebble wears it (save, 3D, page "Wearing")`, JSON.stringify(t2) + ' | ' + agreeHome(h2, exp).join('; '));
        const r3 = await rows();
        check(!bad(r3).length, `and every tile still reads its label (${Math.round(r3.jelly / 1e6)}M jelly left)`, bad(r3).map(x => `${x.id}: ${x.text} (want ${label(r3, x.id)})`).join(' | '));
        // the lower half: Wear, Buy & wear, Wearing and Needs N jelly side by side
        await ev(() => document.querySelector('#body-outfits .outfit[data-id="scarf"]').scrollIntoView({ block: 'start' }));
        await shot('home-labels');
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
          // the walk's first touch must put seq[0] on: if an earlier scenario left it on, take it off first
          if (exp[s] === seq[0]) { await tap(seq[0]); exp[s] = null; await look(`${s} ${seq[0]} off first`); }
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
          // the walk's first touch must put seq[0] on: if an earlier scenario left it on, take it off first
          if (exp[s] === seq[0]) { await tap(seq[0]); exp[s] = null; await look(`${s} ${seq[0]} off first`); }
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
        check(!agreeHome(h2, {}).length && /Needs 5B jelly$/.test(after), 'a touch takes it off: nothing on the head (save, 3D, page), and the Party Hat reads "Needs 5B jelly" (1000 jelly)', agreeHome(h2, {}).join('; ') + ' | ' + after);
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
