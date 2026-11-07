// Ranch life smoke test: plays the Training Center and trips in a headless phone-sized browser (393x852), starting
// from an old generation-3 save (tools/fixtures/main-gen3.json: two residents from before ranch life, an egg on the
// cushion). Hatches the egg (so a treat has someone to go to), then: the old residents have 0 stars; the Ranch life row
// and a resident's page; Train (the picker) and a lesson finished with g.advance; Send on a trip (the picker), a lesson
// for the other slime, then the game is closed and reopened with two hours passed: one card lists both, the treat went
// to the slime at home, the Journal has the lines; Call home early; the souvenir shelf; a traveler refused by the
// Nursery, a new home and an auction; the #debug buttons. Fails on any page error. Screenshots (day and night) go to
// tools/out/ranch-life/.
//
// Setup as in tools/smoke-test.cjs (playwright + three@0.170.0 outside the repo, found through NODE_PATH).
// Starts its own dev server on a free loopback port, runs offline and stops everything on exit (tools/browser-kit.cjs).
//   node tools/ranch-life-smoke.cjs [--dpr 2] [--quick]     (--quick: day screenshots only)
const path = require('path');
const fs = require('fs');
const { devices } = require('playwright');
const { setup, watchdog, log: stamp } = require('./browser-kit.cjs');

const OUT = path.join(__dirname, 'out', 'ranch-life');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const DPR = Number(arg('dpr', 2));
const QUICK = process.argv.includes('--quick');
const VIEW = { width: 393, height: 852 };
fs.mkdirSync(OUT, { recursive: true });
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'main-gen3.json'), 'utf8')).save;
const HOUR = 3600e3;

(async () => {
  const errors = [];
  const log = [];
  const note = (...a) => { const s = a.join(' '); log.push(s); stamp(s); };
  const check = (cond, what, extra = '') => { note((cond ? 'ok   ' : 'FAIL ') + what + (extra ? ' | ' + extra : '')); if (!cond) errors.push(what + (extra ? ' | ' + extra : '')); };
  let kit = null;
  watchdog(40, () => kit ? kit.current() : 'setup');
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
          await ev(() => { const s = window.slimekin.slime; s.blinkT = 99; s.blinkPhase = -1; s.blink = 0; for (const t of document.querySelectorAll('.toast')) t.held = true; });
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
    const calm = () => ev(() => { const g = window.slimekin; g.state.tutorial = 5; g.requests.timer = 1e9; g.glimmerT = 1e9; g.debug('needs'); if (g.sim.asleep) g.wakeUp('rested'); });
    const clearToasts = () => ev(() => { for (const t of document.querySelectorAll('.toast')) t.remove(); });
    const scrollTo = sel => ev(s => { const el = document.querySelector(s); if (el) el.scrollIntoView({ block: 'start' }); return !!el; }, sel);
    const modalText = () => ev(() => (window.slimekin.hud.modalOpen ? document.getElementById('modalCard').innerText : ''));
    const res = name => ev(n => window.slimekin.state.ranch.residents.find(x => x.name === n), name);

    // ---------- 1. the old save opens: 0 stars, no lessons or trips ----------
    mark('1. the old save');
    await page.goto(`${kit.server.origin}/#debug`);
    await boot();
    const old = await ev(() => { const R = window.slimekin.state.ranch; return { life: R.life, res: R.residents.map(x => ({ name: x.name, skills: x.skills, lesson: x.lesson, trip: x.trip })) }; });
    check(old.res.length === 2 && old.res.every(x => Object.values(x.skills).every(v => v === 0) && x.lesson === null && x.trip === null) && old.life.lanes === 1 && old.life.wagons === 1,
      'the old residents start with 0 stars, no lesson, no trip; 1 lane and 1 wagon', JSON.stringify(old.res.map(x => x.name)));
    await ev(() => { const g = window.slimekin; for (let i = 0; i < 5; i++) g.tapEgg(g.egg.group.position.clone()); g.advance(4.5); });
    await page.waitForSelector('#slimeName');
    await page.fill('#slimeName', 'Clover'); await page.click('#nameOk');
    await calm();
    await ev(() => { window.slimekin.sim.ranch.addPearls(200); window.slimekin.advance(1); });

    // ---------- 2. the Ranch life row and a resident's page ----------
    mark('2. ranch tab and resident page');
    await page.click('#tab-ranch');
    // the ranch is the Barn ranch: its files load on the first visit, so wait for it (or its fallback) first
    await page.waitForFunction(() => { const b = window.slimekin.barnRanch; return b.on || b.view.failed; }, null, { timeout: 120000 });
    check(await ev(() => window.slimekin.barnRanch.on), 'the Ranch tab opens the barn');
    await ev(() => window.slimekin.advance(3));
    const row = await ev(() => { const c = document.querySelector('#body-ranch .rl-card'); return c ? c.innerText : null; });
    check(!!row && /Lessons\s*0 \/ 1 lane/.test(row) && /Travelers\s*0 \/ 1 wagon/.test(row) && /Souvenirs 0 \/ 18/.test(row), 'the Ranch tab has the Ranch life row (lessons 0/1, travelers 0/1, souvenirs 0/18)', JSON.stringify(row));
    await scrollTo('#body-ranch .rl-card');
    await shot('01-ranch-tab-row');
    const pebble = (await res('Pebble')).id, juniper = (await res('Juniper')).id;
    await ev(id => { window.slimekin.focusResident(id); window.slimekin.advance(3); }, pebble);
    const pg = await ev(() => document.querySelector('#body-ranch .rl-skills')?.innerText || '');
    check(/Bounce/.test(pg) && /Charm/.test(pg) && /Loves: Bounce/.test(pg) && /Train/.test(pg) && /Send on a trip/.test(pg), "Pebble's page: five skills, \"Loves: Bounce\" (playful), Train and Send on a trip", JSON.stringify(pg.replace(/\n/g, ' / ')));
    await scrollTo('#body-ranch .rl-skills');
    await shot('02-resident-page');

    // ---------- 3. Train: the picker, a lesson, finished with g.advance ----------
    mark('3. a lesson');
    await page.click('#body-ranch [data-rl="train"]');
    await ev(() => window.slimekin.advance(0.5));
    const tp = await modalText();
    check(/Train Pebble/.test(tp) && /Star 1: 15 min/.test(tp), 'the Train picker: Bounce star 1 takes 15 min for Pebble (loves Bounce: 25% shorter)', JSON.stringify(tp.slice(0, 160)));
    await shot('03-train-picker');
    const p0 = await ev(() => window.slimekin.state.ranch.pearls);
    await page.click('#modalCard [data-skill="bounce"]');
    await ev(() => window.slimekin.advance(1));
    const l1 = await ev(id => { const g = window.slimekin, x = g.sim.ranch.resident(id); return { lesson: x.lesson, pearls: g.state.ranch.pearls, page: document.querySelector('#body-ranch .rl-skills')?.innerText || '' }; }, pebble);
    check(l1.lesson && l1.lesson.skill === 'bounce' && l1.lesson.star === 1 && p0 - l1.pearls === 5 && /In a Bounce lesson/.test(l1.page), 'tapping Bounce starts the lesson (5 pearls) and the page shows it', JSON.stringify(l1.lesson));
    await clearToasts();
    await scrollTo('#body-ranch .rl-skills');
    await shot('04-in-a-lesson');
    await ev(() => window.slimekin.advance(15 * 60 + 5, 1 / 10), null, 300000);
    const l2 = await ev(id => { const g = window.slimekin, x = g.sim.ranch.resident(id); return { skills: x.skills, lesson: x.lesson, toast: [...document.querySelectorAll('.toast')].map(t => t.innerText).join(' / '), mem: g.state.memories.filter(m => /Training Center/.test(m.text)).map(m => m.text) }; }, pebble);
    check(l2.skills.bounce === 1 && l2.lesson === null && /earned 1 star in Bounce/.test(l2.toast) && l2.mem.some(m => /earned 1 star in Bounce/.test(m)), 'after 15 min (g.advance) the lesson ends: 1 star, a toast and a Journal line', JSON.stringify(l2.toast));
    await shot('05-lesson-done-toast', { night: false });
    await clearToasts();

    // ---------- 4. a trip, a lesson, close the game, reopen two hours later: one card ----------
    mark('4. trip, close, reopen');
    await ev(id => { window.slimekin.focusResident(id); window.slimekin.advance(2); }, juniper);
    await page.click('#body-ranch [data-rl="trip"]');
    await ev(() => window.slimekin.advance(0.5));
    const trp = await modalText();
    check(/Send Juniper on a trip/.test(trp) && /Puddle Café/.test(trp) && /Opens at Sturdy ★ \(Juniper has 0\)/.test(trp) && /Opens at Sturdy ★★ \(Juniper has 0\)/.test(trp),
      'the trip picker: six places; the 3-hour ones need Sturdy 1, the far ones Sturdy 2 for Bold Juniper', JSON.stringify(trp.replace(/\n/g, ' / ').slice(0, 400)));
    await shot('06-trip-picker');
    await page.click('#modalCard [data-place="cafe"]');
    await ev(() => window.slimekin.advance(1));
    // (the Barn ranch: Juniper was on the stand; it burrows out, leaves the stand's list and someone else comes up)
    const t1 = await ev(id => { const g = window.slimekin, b = g.barnRanch; return { trip: g.sim.ranch.resident(id).trip, inScene: b.active ? b.order.includes(id) || b.curId === id : !!g.ranch.resident(id) && g.ranch.resident(id).state !== 'leave', page: document.querySelector('#body-ranch .rl-skills')?.innerText || '' }; }, juniper);
    check(t1.trip && t1.trip.place === 'cafe' && t1.trip.souvenir === 'cupHat' && t1.trip.pearls > 0 && !t1.inScene && /On a trip to Puddle Café, home at/.test(t1.page) && /Call home early/.test(t1.page),
      'Juniper leaves for Puddle Café (pearls and souvenir fixed now), burrows out of the barn\'s stand, the page says when it is home', JSON.stringify(t1.trip));
    await clearToasts();
    await scrollTo('#body-ranch .rl-skills');
    await shot('07-on-a-trip');
    // and Pebble starts its second Bounce lesson (30 min for star 2 with its love)
    await ev(id => window.slimekin.life.train(id, 'bounce'), pebble);
    const before = await ev(() => { const g = window.slimekin; return { pearls: g.state.ranch.pearls, trip: g.state.ranch.residents.find(x => x.trip).trip }; });
    // close the game, and open it again as if two hours had passed (moving every timestamp back)
    await ev(() => { const g = window.slimekin; g.saveNow(); });
    const shift = await ev(h => {
      const s = JSON.parse(localStorage.getItem('slimekin.save.v1'));
      const d = 2 * h + window.slimekin.timeSkip;   // (the test clock is gone after a reload)
      s.savedAt -= 2 * h;
      for (const p of s.ranch.placed || []) p.lastCard = 1e9;   // (no postcards today: the pearl count below is the trip's alone)
      for (const x of s.ranch.residents) { if (x.trip) { x.trip.startAt -= d; x.trip.homeAt -= d; } if (x.lesson) { x.lesson.startAt -= d; x.lesson.doneAt -= d; } }
      localStorage.setItem('slimekin.save.v1', JSON.stringify(s));
      window.slimekin.resetting = true;   // (no save on the way out)
      return d;
    }, HOUR);
    note('closed; timestamps moved back', (shift / HOUR).toFixed(2), 'h');
    await page.reload();
    await boot();
    await calm();
    await ev(() => { const g = window.slimekin; for (let k = 0; k < 10 && !document.querySelector('#modalCard .rl-return'); k++) { if (g.hud.modalOpen) g.hud.closeModal(); g.advance(1); } });
    const card = await modalText();
    const after = await ev(() => { const g = window.slimekin, R = g.state.ranch; return { pearls: R.pearls, life: R.life, res: R.residents.map(x => ({ name: x.name, trip: x.trip, lesson: x.lesson, skills: x.skills })), mem: g.state.memories.slice(-6).map(m => m.icon + ' ' + m.text) }; });
    check(/While you were away/.test(card) && /Juniper · Puddle Café/.test(card) && /Paper Cup Hat/.test(card) && /Juniper brought Clover a sprinkle drop!/.test(card) && /Pebble · Bounce/.test(card),
      'reopened two hours later: one card lists the trip (pearls, souvenir, treat for Clover, story) and the lesson', JSON.stringify(card.replace(/\n/g, ' / ')));
    check(after.pearls - before.pearls === before.trip.pearls && after.res.every(x => !x.trip && !x.lesson) && after.life.souvenirs.cupHat && after.life.trips === 1 && after.life.lessons === 2,
      'the trip paid exactly what was fixed when it left; both are home; the souvenir is on the shelf', `+${after.pearls - before.pearls} pearls (fixed ${before.trip.pearls})`);
    check(after.mem.some(m => /^🧳 Juniper came home from Puddle Café\./.test(m)) && after.mem.some(m => /^🎓 Pebble earned 2 stars in Bounce/.test(m)), 'the Journal has the trip (with its story) and the lesson', JSON.stringify(after.mem));
    await ev(() => { const el = document.getElementById('modalCard'); el.scrollTop = 0; });
    await shot('08-return-card');
    await ev(() => window.slimekin.hud.closeModal());

    // ---------- 5. Call home early ----------
    mark('5. call home early');
    await page.click('#tab-ranch');
    await page.waitForFunction(() => { const b = window.slimekin.barnRanch; return b.on || b.view.failed; }, null, { timeout: 120000 });   // (the barn loads ahead of time, a moment after the page starts)
    await ev(() => window.slimekin.advance(3));
    await ev(id => { window.slimekin.focusResident(id); window.slimekin.advance(2); }, pebble);
    await page.click('#body-ranch [data-rl="trip"]');
    await ev(() => window.slimekin.advance(0.5));
    await page.click('#modalCard [data-place="garden"]');
    const tr2 = await ev(id => { const g = window.slimekin; g.advance(20 * 60, 1 / 5); return g.sim.ranch.resident(id).trip; }, pebble, 300000);
    await clearToasts();
    await page.click('#body-ranch [data-rl="callHome"]');
    await ev(() => window.slimekin.advance(0.5));
    const ch = await modalText();
    check(/Call Pebble home early\?/.test(ch) && /The souvenir and the treat only come with a full trip/.test(ch), 'Call home early asks first and says what waits for a full trip', JSON.stringify(ch.replace(/\n/g, ' / ')));
    await shot('09-call-home-early');
    const p1 = await ev(() => window.slimekin.state.ranch.pearls);
    await page.click('#rlYes');
    await ev(() => window.slimekin.advance(0.5));
    const early = await ev(() => { const g = window.slimekin; for (let k = 0; k < 6 && !document.querySelector('#modalCard .rl-return'); k++) g.advance(1); return { card: g.hud.modalOpen ? document.getElementById('modalCard').innerText : '', pearls: g.state.ranch.pearls, trips: g.state.ranch.life.trips, seeds: !!g.state.ranch.life.souvenirs.seeds }; });
    const share = Math.floor(tr2.pearls * 20 / 60);
    check(early.pearls - p1 === share && early.pearls - p1 <= tr2.pearls && !early.seeds && /Home early/.test(early.card),
      'home early after 20 of 60 min: a third of the pearls (never more than the full trip), no souvenir', `+${early.pearls - p1} of ${tr2.pearls}`);
    await shot('10-home-early-card', { night: false });
    await ev(() => window.slimekin.hud.closeModal());

    // ---------- 6. a traveler is refused: Nursery, new home, auction ----------
    mark('6. busy slimes refused');
    await ev(id => { const g = window.slimekin; g.life.send(id, 'garden'); g.advance(1); }, juniper);
    await clearToasts();
    await ev(id => { window.slimekin.focusResident(null); window.slimekin.advance(1); }, null);
    await ev(() => { const g = window.slimekin; g.openNursery(); g.advance(1.5); });
    const nur = await ev(id => { const g = window.slimekin, b = document.querySelector(`.parent-pick[data-id="${id}"]`); return { disabled: b && b.disabled, text: b && b.innerText, canBreed: g.sim.ranch.canBreed(id, g.state.ranch.residents.find(x => x.id !== id).id, g.nowMs()) }; }, juniper);
    check(nur.disabled && /On a trip/.test(nur.text) && nur.canBreed.reason === 'away', 'the Nursery: a traveler can\'t be picked ("On a trip"), canBreed says away', JSON.stringify(nur));
    await ev(() => document.querySelector('.parent-grid').scrollIntoView({ block: 'center' }));
    await shot('11-nursery-traveler');
    await ev(() => { const g = window.slimekin; g.closeNursery(); g.advance(1); });
    await ev(id => { document.querySelector(`#body-ranch .res [data-act="place"][data-id="${id}"]`).click(); window.slimekin.advance(0.3); }, juniper);
    const ref = await ev(() => ({ modal: window.slimekin.hud.modalOpen, toast: [...document.querySelectorAll('.toast')].map(t => t.innerText).join(' / ') }));
    check(!ref.modal && /Juniper is on a trip/.test(ref.toast), 'New home for a traveler: a friendly no (toast), no offers', JSON.stringify(ref.toast));
    await ev(() => { const s = document.querySelector('#body-ranch .rl-status'); if (s) s.closest('.res').scrollIntoView({ block: 'center' }); });
    await shot('12-new-home-refused');
    await clearToasts();
    await ev(id => { document.querySelector(`#body-ranch .res [data-act="auction"][data-id="${id}"]`).click(); window.slimekin.advance(0.3); }, juniper);
    const ref2 = await ev(() => ({ modal: window.slimekin.hud.modalOpen, toast: [...document.querySelectorAll('.toast')].map(t => t.innerText).join(' / ') }));
    check(!ref2.modal && /Juniper is on a trip/.test(ref2.toast), 'Auction for a traveler: the same friendly no', JSON.stringify(ref2.toast));
    await clearToasts();

    // ---------- 7. the shelf, a lane, the #debug buttons ----------
    mark('7. shelf, lanes, debug');
    await page.click('#body-ranch [data-rl="shelf"]');
    await ev(() => window.slimekin.advance(0.5));
    const shelf = await modalText();
    check(/Souvenirs 1 \/ 18/.test(shelf) && /Paper Cup Hat/.test(shelf), 'the souvenir shelf: 1 of 18, the Paper Cup Hat', JSON.stringify(shelf.slice(0, 120)));
    await shot('13-souvenir-shelf');
    await ev(() => window.slimekin.hud.closeModal());
    await ev(() => { document.querySelector('#body-ranch [data-rl="lane"]').click(); window.slimekin.advance(0.5); });
    const lanes = await ev(() => window.slimekin.state.ranch.life.lanes);
    check(lanes === 2, 'buying a second lane', `lanes ${lanes}`);
    await ev(id => window.slimekin.life.train(id, 'charm'), pebble);
    await clearToasts();
    await ev(() => { window.slimekin.openSettings(); window.slimekin.advance(0.4); });
    const dbg = await ev(() => ({ a: !!document.querySelector('[data-dbg="rlLessons"]'), b: !!document.querySelector('[data-dbg="rlTrips"]') }));
    check(dbg.a && dbg.b, 'Settings (#debug) has Finish lessons and Bring travelers home');
    await page.click('[data-dbg="rlLessons"]');
    await ev(() => window.slimekin.advance(1));
    await ev(() => { window.slimekin.openSettings(); window.slimekin.advance(0.4); });
    await page.click('[data-dbg="rlTrips"]');
    await ev(() => window.slimekin.advance(1));
    const dn = await ev(() => { const g = window.slimekin; for (let k = 0; k < 6 && !document.querySelector('#modalCard .rl-return'); k++) g.advance(1); return { busy: g.state.ranch.residents.filter(x => x.trip || x.lesson).map(x => x.name), charm: g.state.ranch.residents.find(x => x.name === 'Pebble').skills.charm, card: g.hud.modalOpen ? document.getElementById('modalCard').innerText : '' }; });
    check(dn.busy.length === 0 && dn.charm === 1 && /Juniper · Willowbend Gardens/.test(dn.card), 'the debug buttons finish the lesson and bring the traveler home (with its card)', JSON.stringify(dn.busy));
    // another card opening on top of the return card (here: Settings) does not lose it: it comes back afterwards
    const again = await ev(() => {
      const g = window.slimekin;
      g.openSettings(); g.advance(0.6);
      const replaced = !document.querySelector('#modalCard [data-rl-card]');
      g.hud.closeModal(); g.advance(1.2);
      return { replaced, back: !!document.querySelector('#modalCard [data-rl-card]') && g.hud.modalOpen && /Willowbend Gardens/.test(document.getElementById('modalCard').innerText) };
    });
    check(again.replaced && again.back, 'a card opened over the return card does not lose it: it shows again when that one closes', JSON.stringify(again));
    await ev(() => window.slimekin.hud.closeModal());
    await ev(() => { const g = window.slimekin; g.focusResident(null); g.advance(1); });
    await ev(() => { for (const t of document.querySelectorAll('.toast')) t.remove(); document.querySelector('#body-ranch [data-rl="shelf"]').scrollIntoView({ block: 'end' }); });
    await shot('14-ranch-row-after');
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
