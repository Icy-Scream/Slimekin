// Jelly loop smoke test: plays the jelly loop in a headless phone-sized browser (393x852), starting from an old
// generation-3 save (tools/fixtures/main-gen3.json): the old Family Bonus is kept; the Heirlooms tab glows, the page
// opens and buying the Cookie Tin makes snacks cheaper (the Toy Box fills the next slime's helpers); medal ceremonies
// (Ribbon, then Gold with debug jelly) and the badges; the move-out screen (medal, bonus now -> after, leftover jelly
// and the "Visit the Heirlooms" button), the move-out itself; then every Moving Day sign played from the #debug
// buttons, the travel bundle, a sign that comes by itself at "very ready", and the Journal clue. Fails on any page
// error. Screenshots (day and night) go to tools/out/jelly-loop/.
//
// Setup as in tools/smoke-test.cjs (playwright + three@0.170.0 outside the repo, found through NODE_PATH).
// Starts its own dev server on a free loopback port, runs offline and stops everything on exit (tools/browser-kit.cjs).
//   node tools/jelly-loop-smoke.cjs [--dpr 2] [--quick]     (--quick: day screenshots only)
const path = require('path');
const fs = require('fs');
const { devices } = require('playwright');
const { setup, watchdog, log: stamp } = require('./browser-kit.cjs');

const OUT = path.join(__dirname, 'out', 'jelly-loop');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const DPR = Number(arg('dpr', 2));
const QUICK = process.argv.includes('--quick');
const VIEW = { width: 393, height: 852 };
fs.mkdirSync(OUT, { recursive: true });
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'main-gen3.json'), 'utf8')).save;
const SIGNS = ['curious', 'familiar', 'bold', 'shy', 'playful', 'mellow', 'cuddly', 'independent', 'patient', 'impulsive'];

(async () => {
  const errors = [];
  const log = [];
  const note = (...a) => { const s = a.join(' '); log.push(s); stamp(s); };
  const check = (cond, what, extra = '') => { note((cond ? 'ok   ' : 'FAIL ') + what + (extra ? ' | ' + extra : '')); if (!cond) errors.push(what + (extra ? ' | ' + extra : '')); };
  let kit = null;
  watchdog(45, () => kit ? kit.current() : 'setup');
  try {
    const dev = devices['iPhone 15 Pro'];
    kit = await setup({ contextOptions: { userAgent: dev.userAgent, isMobile: true, hasTouch: true, viewport: VIEW, screen: VIEW, deviceScaleFactor: DPR } });
    const { page, mark } = kit;
    await kit.context.addInitScript(save => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('slimekin.save.v1', JSON.stringify(save)); } }, { ...FIXTURE, savedAt: Date.now() - 60000 });
    page.setDefaultTimeout(120000);
    const ev = (fn, a, ms) => kit.ev(fn, a, ms);
    const setTheme = async dark => { await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark); await page.waitForTimeout(300); await ev(() => window.slimekin.advance(0.25)); };
    // Headless Chrome only advances CSS transitions when it draws, so screenshots double as "settle".
    const shot = async (name, { night = !QUICK, before = null } = {}) => {
      for (const dark of night ? [false, true] : [false]) {
        await setTheme(dark);
        if (before) await before(dark);
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
      await page.waitForFunction(() => window.slimekin && window.slimekin.state, null, { timeout: 120000 });
      await page.waitForTimeout(2500);
      await ev(() => { const g = window.slimekin; g.behave.hour = () => 14; g.state.settings.quality = 'high'; g.applySettings(); });
    };
    // steady scene: daytime clock, no requests, glimmers or random moments; awake and fed
    const calm = () => ev(() => { const g = window.slimekin; g.state.tutorial = 5; g.requests.timer = 1e9; g.glimmerT = 1e9; g.debug('needs'); if (g.sim.asleep) g.wakeUp('rested'); });
    const hatch = async name => {
      await ev(() => { const g = window.slimekin; for (let i = 0; i < 5; i++) g.tapEgg(g.egg.group.position.clone()); g.advance(4.5); });
      await page.waitForSelector('#slimeName');
      await page.fill('#slimeName', name); await page.click('#nameOk');
      await calm();
    };
    // grow up to Settled with the debug button (closing the stage cards; keep: leave the grown-up card open)
    const growUp = keep => ev(keep => {
      const g = window.slimekin;
      for (let k = 0; k < 6 && g.sim.stageIndex() < 3; k++) { g.debug('grow'); g.advance(3); if (g.sim.stageIndex() < 3 || !keep) g.hud.closeModal(); }
      if (!keep) for (let k = 0; k < 3; k++) { g.advance(1); g.hud.closeModal(); }
      g.requests.timer = 1e9; g.glimmerT = 1e9; g.debug('needs');
      return { stage: g.sim.stageIndex(), form: g.state.slime.form && g.state.slime.form.name, card: document.getElementById('modalCard').innerText };
    }, keep, 300000);
    const skip = () => ev(() => window.slimekin.timeSkip);

    // ---------- 1. the old save opens; its Family Bonus is kept ----------
    mark('1. the old save opens');
    await page.goto(`${kit.server.origin}/#debug`);
    await boot();
    const fam0 = FIXTURE.ranch.family;
    const f1 = await ev(() => ({ ...window.slimekin.state.ranch.family }));
    check(Math.abs(f1.bonus - fam0.bonus) < 1e-9 && f1.lifetime === fam0.lifetime && Number.isFinite(f1.legacy), 'the old save keeps its Family Bonus exactly',
      `${fam0.bonus.toFixed(4)}% -> ${f1.bonus.toFixed(4)}%, legacy ${f1.legacy.toExponential(3)}`);
    await hatch('Clover');

    // ---------- 2. Heirlooms: the chest glows, the page, buying ----------
    mark('2. Heirlooms');
    const tray0 = await ev(() => { const g = window.slimekin; g.sim.addJelly(2.5e8); g.advance(1.2); return { glow: document.getElementById('tab-heirlooms').classList.contains('glow'), price: g.sim.foodPrice('cookie'), label: g.hud.foodEls.cookie.b.getAttribute('aria-label') }; });
    check(tray0.glow, 'the chest tab glows when an heirloom becomes affordable');
    await shot('01-chest-glow');
    await page.click('#tab-heirlooms');
    await ev(() => window.slimekin.advance(1));
    const page0 = await ev(() => ({ glow: document.getElementById('tab-heirlooms').classList.contains('glow'), cards: [...document.querySelectorAll('#body-heirlooms .heirloom')].map(c => c.className.replace('card heirloom ', '') + ':' + c.dataset.id), buys: document.querySelectorAll('#body-heirlooms button[data-buy]').length }));
    check(!page0.glow && page0.buys === 3 && page0.cards.filter(c => c.startsWith('unknown')).length === 6, 'the page: next three with Buy, six silhouettes; opening it stops the glow', page0.cards.join(' '));
    await shot('02-heirlooms-page');
    await ev(() => { document.querySelector('#body-heirlooms .heirloom.unknown:last-child').scrollIntoView({ block: 'end' }); window.slimekin.advance(0.3); });
    await shot('02b-heirlooms-silhouettes');
    await ev(() => { document.getElementById('body-heirlooms').scrollIntoView({ block: 'start' }); document.querySelector('#body-heirlooms .heirloom').scrollIntoView({ block: 'center' }); });
    // the Buy button's click handler buys at once, so the jelly made can be compared in the same moment
    const buy = await ev(() => {
      const g = window.slimekin, before = { total: g.state.totalJelly, jelly: g.state.jelly, fam: JSON.stringify(g.state.ranch.family), after: g.sim.moveOutPreview().bonusAfter };
      document.querySelector('button[data-buy="cookietin"]').click();
      for (const t of document.querySelectorAll('.toast')) t.held = true;   // (screenshots below are slow)
      const same = g.state.totalJelly === before.total && JSON.stringify(g.state.ranch.family) === before.fam && g.sim.moveOutPreview().bonusAfter === before.after;
      return { same, spent: before.jelly - g.state.jelly };
    });
    check(buy.same && buy.spent === 1e8, 'buying spends jelly (100M) and does not change the jelly made or the Family Bonus', JSON.stringify(buy));
    await ev(() => window.slimekin.advance(1));
    await ev(() => { document.querySelector('button[data-buy="toybox"]').click(); for (const t of document.querySelectorAll('.toast')) t.held = true; window.slimekin.advance(1); });
    const bought = await ev(() => { const g = window.slimekin; return { owned: g.state.heirlooms.owned, owned1: document.querySelectorAll('#body-heirlooms .heirloom.owned').length, mem: g.state.memories.filter(m => /got the/.test(m.text)).length }; });
    check(bought.owned.join(',') === 'cookietin,toybox' && bought.owned1 === 2 && bought.mem === 2, 'bought the Cookie Tin and the Toy Box (owned cards, Journal lines)', bought.owned.join(','));
    await shot('03-heirlooms-bought');
    await ev(() => { for (const t of document.querySelectorAll('.toast')) t.remove(); });

    // ---------- 3. medals: the Ribbon when grown up, then Gold; the badges ----------
    mark('3. medals');
    await ev(() => window.slimekin.hud.setSheet('closed'));
    const g0 = await growUp(true);
    note('grown up:', JSON.stringify(g0.form));
    await ev(() => { const g = window.slimekin; g.hud.closeModal(); g.advance(5); });
    const rib = await ev(() => ({ shown: window.slimekin.state.slime.medalShown, toast: [...document.querySelectorAll('.toast.medal-toast')].map(t => t.innerText).join(' / ') }));
    check(rib.shown === 'ribbon' && /Ribbon/.test(rib.toast), 'the Grown-Up Ribbon ceremony after the grown-up card', JSON.stringify(rib.toast));
    await ev(() => { const g = window.slimekin; for (const t of document.querySelectorAll('.toast')) t.remove(); g.sim.addJelly(2e11); g.advance(1.2); for (const t of document.querySelectorAll('.toast')) t.held = true; });
    const gold = await ev(() => { const g = window.slimekin; return { shown: g.state.slime.medalShown, toast: [...document.querySelectorAll('.toast.medal-toast')].map(t => t.innerText).join(' / '), mem: g.state.memories.filter(m => /medal/.test(m.text)).map(m => m.text), badge: document.getElementById('medalBadge').textContent, badgeHidden: document.getElementById('medalBadge').hidden }; });
    check(gold.shown === 'gold' && /GOLD|Gold/.test(gold.toast) && gold.mem.length === 3, 'the Gold ceremony (Bronze, Silver, Gold: one ceremony, three Journal lines)', JSON.stringify(gold.toast));
    check(!gold.badgeHidden, 'the HUD badge by the name carries the medal (shown on wider screens; phones hide it in the compact pill)', gold.badge);
    await shot('04-medal-ceremony');
    // the Cookie Tin's effect where you see it: the snack tray (grown-up prices are big enough to show 20% off)
    const tray = await ev(() => { const g = window.slimekin, f = g.sim.stage().foodCost; g.advance(0.5); const el = g.hud.foodEls.chili; return { label: el.b.getAttribute('aria-label'), shown: el.price.textContent, full: Math.ceil(12 * f), tin: Math.ceil(12 * f * 0.8), price: g.sim.foodPrice('chili') }; });
    check(tray.price === tray.tin && tray.label.includes(tray.tin.toLocaleString('en-US')) && tray.shown.includes('2.5K') && tray.tin < tray.full, "the Cookie Tin's effect: snacks cost 20% less, and the tray shows it",
      `Chili ${tray.full} -> ${tray.tin}: shows "${tray.shown}", label "${tray.label}"`);
    await ev(() => { const g = window.slimekin; for (const t of document.querySelectorAll('.toast')) t.remove(); g.advance(0.5); });
    await page.click('#tab-slime');
    await ev(() => window.slimekin.advance(1));
    const slimeTab = await ev(() => document.getElementById('body-slime').innerText);
    check(/Gold/.test(slimeTab), 'the Slime tab shows the medal');
    await shot('05-badges-slime-tab');

    // ---------- 4. the move-out screen ----------
    mark('4. the move-out screen');
    const pv = await ev(() => { const g = window.slimekin, p = g.sim.moveOutPreview(); g.askMoveOut(); g.advance(0.5); return { now: p.bonusNow, after: p.bonusAfter, text: document.getElementById('modalCard').innerText, jelly: g.state.jelly }; });
    const want = `Family Bonus +${pv.now.toFixed(1)}% → +${pv.after.toFixed(1)}%`;
    check(pv.text.includes(want), 'the move-out screen: "' + want + '"');
    check(/takes the Gold medal/.test(pv.text) && /pearls x1\.35/.test(pv.text), 'the move-out screen: the medal it takes and its ranch perk');
    check(/You still have [\d.]+[KMBTQ]? jelly\./.test(pv.text) && /Visit the Heirlooms first\?/.test(pv.text), 'the move-out screen: the leftover jelly line');
    await shot('06-move-out');
    await page.click('#mvHeirlooms');
    await ev(() => window.slimekin.advance(0.6));
    const hl = await ev(() => ({ tab: window.slimekin.hud.tab, modal: window.slimekin.hud.modalOpen, visible: !document.getElementById('body-heirlooms').hidden }));
    check(hl.tab === 'heirlooms' && !hl.modal && hl.visible, '"Visit the Heirlooms" closes the screen and opens the Heirlooms page', JSON.stringify(hl));
    // ... and the move-out can be started again
    const before = await ev(() => ({ ...window.slimekin.state.ranch.family }));
    const sk = await skip();
    const pv2 = await ev(() => { window.slimekin.askMoveOut(); window.slimekin.advance(0.5); return window.slimekin.sim.moveOutPreview().bonusAfter; });
    await page.click('#mvYes');
    const nav = page.waitForNavigation({ waitUntil: 'commit', timeout: 90000 });
    await ev(() => window.slimekin.advance(6));
    await nav;
    await boot();
    await ev(s => { window.slimekin.timeSkip = s; }, sk);
    const after = await ev(() => { const s = window.slimekin.state; return { fam: { ...s.ranch.family }, phase: s.phase, res: s.ranch.residents.map(x => x.name), owned: s.heirlooms.owned }; });
    // (the slime keeps making jelly during the goodbye, so the bonus may end a hair above what the screen said)
    check(after.fam.bonus >= pv2 - 1e-9 && after.fam.bonus - pv2 < 0.05 && after.fam.bonus > before.bonus && after.fam.generation === before.generation + 1, 'moved out: the Family Bonus is what the screen said',
      `screen +${pv2.toFixed(3)}%, now ${before.bonus.toFixed(2)}% -> ${after.fam.bonus.toFixed(3)}%`);
    check(after.owned.join(',') === 'cookietin,toybox', 'heirlooms stay after the move-out');
    await ev(() => window.slimekin.hud.closeModal());
    await hatch('Willow');
    const helpers = await ev(() => ({ ...window.slimekin.state.helpers }));
    check(helpers.feather === 10 && helpers.bubbles === 5, "the Toy Box: the new slime starts with 10 Tickle Feathers and 5 Bubble Wands", `feather ${helpers.feather}, bubbles ${helpers.bubbles}`);
    // the resident's badge on the ranch
    await page.click('#tab-ranch');
    await ev(() => window.slimekin.advance(3));
    const cid = await ev(() => window.slimekin.state.ranch.residents.find(x => x.name === 'Clover').id);
    await ev(id => { window.slimekin.focusResident(id); window.slimekin.advance(4); }, cid);
    const card = await ev(() => document.getElementById('panel').innerText);
    check(/Gold/.test(card), "the ranch card shows Clover's Gold medal");
    await shot('07-ranch-resident-badge');
    await ev(() => window.slimekin.leaveRanch());

    // ---------- 5. Moving Day signs ----------
    mark('5. Moving Day');
    await growUp(false);
    await calm();
    await ev(() => { const g = window.slimekin; g.advance(5); for (const t of document.querySelectorAll('.toast')) t.remove(); g.hud.closeModal(); g.advance(1); });
    // Willow's Ribbon in the family tree
    await page.click('#tab-slime');   // UI pass 2: the Journal is a page inside your slime's tab
    await page.click('#tab-journal');
    await page.click('[data-jp="family"]');
    await ev(() => window.slimekin.advance(1));
    check(await ev(() => !!document.querySelector('#body-journal .tree-node.me .medal-badge')), "the family tree shows Willow's Grown-Up Ribbon");
    await shot('08-family-tree-badge', { night: false });
    await page.click('[data-jp="notes"]');
    // the Journal clue (once a slime is grown up)
    await ev(() => { window.slimekin.hud.journalKey = ''; window.slimekin.hud.renderJournal(true); window.slimekin.advance(0.5); });
    const clue = await ev(() => document.getElementById('body-journal').innerText);
    check(clue.includes('Grown slimes sometimes dream of the ranch. Watch where they look.'), 'the Journal has the Moving Day clue');
    await ev(() => document.querySelector('.moving-day-clue').scrollIntoView({ block: 'center' }));
    await shot('09-journal-clue', { night: false });
    await ev(() => window.slimekin.hud.setSheet('closed'));
    // the tester tools
    await ev(() => { window.slimekin.openSettings(); window.slimekin.advance(0.4); document.querySelector('.md-debug').scrollIntoView({ block: 'center' }); });
    const status = await ev(() => document.getElementById('mdStatus').textContent);
    note('tester status:', status);
    await shot('10-tester-buttons', { night: false });
    const mine = await ev(() => window.slimekin.movingDay.signFor());
    for (const id of SIGNS) {
      await ev(() => { const g = window.slimekin; if (!g.hud.modalOpen) g.openSettings(); g.advance(0.3); g.debug('needs'); });
      await page.click(`[data-dbg="sign:${id}"]`);
      const dur = await ev(() => { const g = window.slimekin, a = g.movingDay.active; return a ? a.def.dur : 0; });
      check(dur > 0, `sign "${id}" plays from its debug button`);
      await ev(d => window.slimekin.advance(d * 0.4), dur);
      // screenshots are slow and the game runs on meanwhile: the night shot plays the sign again from the start
      await shot(`11-sign-${id}`, { before: async dark => { if (dark) await ev(({ id, d }) => { const g = window.slimekin; g.debug('sign:' + id); g.advance(d * 0.4); }, { id, d: dur }); } });
      const end = await ev(d => { const g = window.slimekin; g.advance(d + 1.5); const p = g.slime.root.position; return { active: !!g.movingDay.active, x: p.x, z: p.z, turn: g.slime.turnYaw }; }, dur);
      check(!end.active && Math.abs(end.x) < 0.02 && Math.abs(end.z) < 0.02 && Math.abs(end.turn) < 0.05, `sign "${id}" ends with the slime back on its cushion`, JSON.stringify(end));
    }
    await ev(() => { const g = window.slimekin; g.openSettings(); g.advance(0.3); });
    await page.click('[data-dbg="bundle"]');
    await ev(() => window.slimekin.advance(1.5));
    check(await ev(() => !!window.slimekin.movingDay.bundle), 'the travel bundle shows from its debug button');
    await shot('12-travel-bundle');
    // a sign that comes by itself: make this slime "very ready" and wait with calm play
    const nat = await ev(() => {
      const g = window.slimekin, f = g.state.ranch.family, md = g.movingDay;
      const need = 1e7 * Math.pow((3.2 * (1 + f.bonus / 100) - 1) * 20, 3) - f.lifetime - f.legacy;
      g.sim.addJelly(Math.max(0, need - g.state.totalJelly));
      g.state.slime.medalShown = g.sim.medal().id;
      const p0 = md.played;
      let waited = 0;
      for (; waited < 240 && md.played === p0; waited += 2) { g.debug('needs'); if (g.sim.asleep) g.wakeUp('rested'); g.advance(2, 1 / 15); }
      return { R: md.ratio(), level: md.level && md.level.id, played: md.played - p0, last: md.last, mine: md.signFor(), waited };
    }, null, 300000);
    check(nat.level === 'veryReady' && nat.played === 1 && nat.last === mine, 'at "very ready" the slime\'s own sign comes by itself during calm play', JSON.stringify(nat));
    await ev(() => window.slimekin.advance(8));
    // nothing on the main screen tells the player to move out
    await ev(() => window.slimekin.hud.setSheet('closed'));
    const hud = await ev(() => [...document.querySelectorAll('#ui > :not(#panel):not(#modal)')].filter(e => e.offsetParent).map(e => e.innerText).join(' '));
    check(!/move out|ready to move|moving day/i.test(hud), 'no text on the main screen about moving out');
  } catch (e) {
    errors.push('test error: ' + (e.stack || e.message));
    if (kit && !e.diagnosed) await kit.diagnose();
  } finally {
    if (kit) { errors.unshift(...kit.errors); kit.report(); await kit.close(); }
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n') + '\n' + (errors.length ? 'FAILED\n' + errors.join('\n') : 'OK') + '\n');
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
