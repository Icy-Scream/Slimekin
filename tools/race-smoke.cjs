// Slime Sprint as a race (RV2): the real game at iPhone size (390 x 844), from tools/fixtures/barn/barn-six.json, with
// real touches (CDP Input.dispatchTouchEvent). Peaches becomes the design's Juniper (design/contests-race-view.md §7:
// Curly, Volt, Bow Tie, Speed 5 with an A talent, Sturdy 3, Smarts 2, mood 4, Little and Big Sprint Cups won).
//   card     the race card (F1): the cup ladder, four runners with their faces, no numbers, "your chances" in words
//   race     the Grand Cup: the pat at the gate (the ranch's pet), three real taps on the rings (early = Nice try, then
//            two Good), the photo finish, the results in words; the shown order and the result == scoreShow run on its own
//            with the same taps; nothing saved before the end; the 3D stopped while the race covered it
//   loss     the same cup with no tap on the straight: 84 against 85, "2nd, by a wobble", Starlight caught her
//   skip     Skip at once: no cheers, the result == scoreShow with no cheers
//   reload   a reload mid-race: no result, nothing paid, the show not counted
//   reduced  Reduced motion: still shots, every cheer an automatic Good, no slow motion
//   low      Low graphics: the race runs, effects cut
//   blocked  the race's files blocked: the stand show runs instead
//   beauty   the Beauty Show still runs on the stand (until RV4)
// Screenshots (390 x 844): tools/out/race/ (card, gate, cheer, photo, results, loss, reduced). Every number "server,
// slow-env" when run on the server.
//   node tools/race-smoke.cjs [--only=card,race,...] [--night]
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'barn', 'barn-six.json'), 'utf8')).save;
const OUT = path.join(__dirname, 'out', 'race');
fs.mkdirSync(OUT, { recursive: true });
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = k => !ONLY.length || ONLY.includes(k);
const P = 'rbarnpeach';
// --night: the game's night theme (data-theme="dark"); the course stays the day course (night is RV3). Screenshots get
// a -night suffix.
const NIGHT = process.argv.includes('--night');

(async () => {
  const errors = [];
  const check = (cond, what, extra = '') => { log(`${cond ? 'ok  ' : 'FAIL'} ${what}${extra ? ' | ' + extra : ''}`); if (!cond) errors.push(what + (extra ? ': ' + extra : '')); };
  let kit = null;
  watchdog(60, () => kit ? kit.current() : 'setup');
  try {
    kit = await setup({ contextOptions: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } });
    const { page, step, ev } = kit;
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e && e.message || e)));
    if (NIGHT) await kit.context.addInitScript(() => {
      const theme = () => document.documentElement && document.documentElement.setAttribute('data-theme', 'dark');
      if (document.documentElement) theme(); else document.addEventListener('DOMContentLoaded', theme);
    });
    await kit.context.addInitScript(save => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const s = JSON.parse(JSON.stringify(save)), now = Date.now();
      for (const x of s.ranch.residents) {
        if (x.trip) { x.trip.startAt = now - 600000; x.trip.homeAt = now + 3000000; }
        if (x.lesson) { x.lesson.startAt = now - 600000; x.lesson.doneAt = now + 7200000; }
      }
      s.savedAt = now - 60000; s.ranch.lastVisit = now;
      localStorage.setItem('slimekin.save.v1', JSON.stringify(s));
    }, SAVE);
    const boot = async () => {
      await page.waitForFunction(() => window.slimekin && window.slimekin.state && document.getElementById('boot').hidden, null, { timeout: 180000 });
      await ev(() => { const g = window.slimekin; g.hud.closeModal(); });
    };
    const cdp = await kit.context.newCDPSession(page);
    const touch = async (x, y) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const touchSel = async sel => {
      const b = await ev(q => { const el = document.querySelector(q); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
      if (!b) throw new Error('nothing to touch: ' + sel);
      await page.waitForTimeout(250);
      await touch(b.x, b.y);
    };
    const shot = async name => { name += NIGHT ? '-night' : ''; await page.screenshot({ path: path.join(OUT, name + '.png') }); log('screenshot', name); };
    const modalIs = (kind, ms = 60000) => page.waitForFunction(k => !!document.querySelector(`#modalCard [data-cs-card="${k}"]`) && !document.getElementById('modal').hidden, kind, { timeout: ms });
    const modalText = () => ev(() => document.getElementById('modalCard').innerText.replace(/\s+/g, ' ').trim());
    const info = () => ev(() => window.slimekin.raceView.info());
    const toBarn = async () => {
      if (!(await ev(() => window.slimekin.barnRanch.on))) {
        await ev(() => window.slimekin.hud.openTab('ranch'));
        await page.waitForFunction(() => window.slimekin.barnRanch.on || (window.slimekin.barnRanch.view && window.slimekin.barnRanch.view.failed), null, { timeout: 240000 });
      }
      await ev(() => window.slimekin.hud.closeModal());
    };
    // Juniper (design §7), on the stand; trophies: how many Sprint cups won
    const juniper = (trophies = 2, happy = 72) => ev(([id, tr, h]) => {
      const g = window.slimekin, x = g.state.ranch.residents.find(y => y.id === id);
      x.name = 'Juniper'; x.form = { id: 'spark', name: 'Volt Slime', blurb: '' }; x.breed = 'curly'; x.variant = 'plain'; x.mix = 0;
      x.traits = { sweet: 0, heat: 0, mineral: 0, nature: 0, spark: 34, prism: 0 };
      x.worn = { head: null, face: null, neck: 'bowtie' };
      x.skills = { bounce: 0, speed: 5, sturdy: 3, smarts: 2, charm: 0 };
      x.potential = { bounce: 1, speed: 3, sturdy: 1, smarts: 1, charm: 1 };
      for (const k of Object.keys(x.personality)) x.personality[k] = 50;
      x.happiness = h; x.petAt = 0; x.lesson = null; x.trip = null;
      x.contests.trophies = { beauty: 0, sprint: tr, bounce: 0 };
      g.barnRanch.show(id);
      return { form: x.form.id };
    }, [P, trophies, happy]);
    const ranchNow = () => ev(id => { const g = window.slimekin, x = g.state.ranch.residents.find(y => y.id === id); return { pearls: g.state.ranch.pearls, shows: g.state.ranch.contests.shows, trophies: { ...x.contests.trophies }, shelf: Object.keys(g.state.ranch.contests.shelf).length, saved: localStorage.getItem('slimekin.save.v1').length }; }, P);
    const openCard = async (cup = null) => {
      await ev(([id, c]) => window.slimekin.contestsUI.openEntry(id, 'sprint', c), [P, cup]);
      await modalIs('entry');
      await page.waitForFunction(() => document.querySelectorAll('#modalCard .rv-row canvas').length === 4, null, { timeout: 120000 });
    };
    // Race!: the bridge (the barn's frame pixelates, the course slides in; Reduced motion: a crossfade), then the gate
    const startRace = async (film = null) => {
      await touchSel('#modalCard [data-cs="start"]');
      if (film) {
        await page.waitForFunction(() => { const s = window.slimekin.raceView.s; return s && (s.phase === 'bridge' || s.phase === 'gate'); }, null, { timeout: 120000, polling: 20 });
        film.phase = await ev(() => window.slimekin.raceView.s.phase);
        await page.waitForTimeout(250);
        await shot(film.name);
      }
      await page.waitForFunction(() => { const r = window.slimekin.raceView; return r.covers && r.s && r.s.phase !== 'bridge'; }, null, { timeout: 120000 });
    };
    // wait for ring k, then one real tap `at` seconds after it appeared (null: no tap); answers its grade
    const cheer = async (k, at) => {
      await page.waitForFunction(i => { const r = window.slimekin.raceView.info(); return !r.on || (r.ring && r.ring.k === i); }, k, { timeout: 120000, polling: 30 });
      if (at === null) {
        await page.waitForFunction(i => { const r = window.slimekin.raceView.info(); return !r.on || r.grades[i] !== null; }, k, { timeout: 60000, polling: 50 });
        return ev(i => window.slimekin.raceView.info().grades[i], k);
      }
      const r = await ev(() => ({ t0: window.slimekin.raceView.info().ring.t0, now: performance.now(), you: window.slimekin.raceView.info().you }));
      const wait = r.t0 + at * 1000 - r.now - 4;
      if (wait > 0) await page.waitForTimeout(wait);
      await touch(195, 470);
      await page.waitForFunction(i => { const r = window.slimekin.raceView.info(); return !r.on || r.grades[i] !== null; }, k, { timeout: 30000 });
      return ev(i => { const r = window.slimekin.raceView.info(); return { grade: r.grades[i], tap: r.taps[i][0] }; }, k);
    };
    const toResult = async () => { await modalIs('result', 180000); return { info: (await info()).last, text: await modalText() }; };
    // scoreShow run on its own, in the page, with the race's taps
    const rules = (cup, taps, reduced = false) => ev(([id, c, tp, rm]) => import('/src/core/contests.js').then(K => { const r = K.scoreShow(window.slimekin.state, id, 'sprint', { cup: c, cheers: tp, reducedMotion: rm }); return { score: r.score, place: r.place, won: r.won, cheers: r.cheers }; }), [P, cup, taps, reduced]);

    await step('boot', async () => { await page.goto(`${kit.server.origin}/#debug`); await boot(); }, 240000);
    await step('the barn', toBarn, 300000);
    await juniper(2);

    if (want('card')) await step('card: the race card, hidden scores', async () => {
      await openCard();
      const t = await modalText();
      log('race card:', t);
      const rows = await ev(() => [...document.querySelectorAll('#modalCard .rv-row')].map(r => [...r.querySelectorAll('b, small, .rv-grade')].map(e => e.textContent.trim()).join(' ')));
      check(rows.length === 4 && /^Juniper Can win this with good cheers\. A$/.test(rows[0]) && /^Starlight's slime Speed ★★★★★ · finishes strong$/.test(rows[1])
        && /^Glimmer's slime Speed ★★★★★ · fast starter$/.test(rows[2]) && /^Pebblepeak's slime Speed ★★★★ · steady$/.test(rows[3]), 'F1: Juniper "Can win this with good cheers." with her A; Starlight, Glimmer, Pebblepeak described, not scored', rows.join(' | '));
      const nums = (rows.join(' ') + ' ' + t.replace(/Pearls come with a first win/, '')).match(/\d/g);
      check(!nums && /Little Won Big Won Grand Next Champion Naturals only/.test(t) && /Race!/.test(t) && /Not now/.test(t), 'no numbers on the card; the cup ladder; "Not now" and "Race!"', t);
      if (want('race')) await shot('1-card');
    }, 300000);

    if (want('race')) await step('race: the Grand Cup with real taps', async () => {
      const before = await ranchNow();
      if (!(await ev(() => !document.getElementById('modal').hidden))) await openCard();
      const film = { name: '1b-bridge' };
      await startRace(film);
      check(film.phase === 'bridge', 'the way in: the barn\'s frame pixelates (the bridge), then the course slides in', film.phase);
      const i0 = await info();
      check(i0.shown && i0.phase === 'gate' && i0.t < 3, 'the race starts at the gate', JSON.stringify({ t: i0.t, phase: i0.phase }));
      const rendered = await ev(() => { const g = window.slimekin; return { covers: g.raceView.covers, ui: getComputedStyle(document.getElementById('ui')).visibility }; });
      check(rendered.covers && rendered.ui === 'hidden', 'the race covers the barn (the 3D stops drawing, the HUD hides)', JSON.stringify(rendered));
      // the pat: a tap on Juniper at the gate (the ranch's pet: +15 happiness)
      const hp0 = await ev(id => window.slimekin.state.ranch.residents.find(x => x.id === id).happiness, P);
      await page.waitForTimeout(500);
      await shot('2-gate');
      await touch(i0.you.x, i0.you.y);
      await page.waitForTimeout(200);
      const hp1 = await ev(id => window.slimekin.state.ranch.residents.find(x => x.id === id).happiness, P);
      check(Math.abs(hp1 - Math.min(100, hp0 + 15)) < 0.2, 'the pat at the gate is the ranch\'s pet (+15 happiness; mood 4 stays 4)', `${hp0} -> ${hp1}`);
      // three real taps: early on the straight (Nice try), then two Good (0.2 s late)
      await page.waitForFunction(() => { const r = window.slimekin.raceView.info(); return r.ring && r.ring.k === 0; }, null, { timeout: 120000, polling: 30 });
      await page.waitForTimeout(700);
      await shot('3-cheer');
      const c0 = await cheer(0, 0.6), c1 = await cheer(1, 1.7), c2 = await cheer(2, 1.72);
      // each grade is the rules' grade of the tap as the game got it (a busy box can deliver a touch late)
      const ruled = await ev(ts => import('/src/core/contests.js').then(K => ts.map(t => K.cheerGrade([t]))), [c0.tap, c1.tap, c2.tap]);
      check(c0.grade === ruled[0] && c1.grade === ruled[1] && c2.grade === ruled[2], 'the rings grade real taps by the rules (cheerGrade of each tap as received)', JSON.stringify({ got: [c0, c1, c2], ruled }));
      const asMeant = c0.grade === 'nice' && c1.grade === 'good' && c2.grade === 'good';
      if (!asMeant) log('note: the taps landed off their aim (a busy box); the design-frame words below are checked only for Nice try, Good, Good');
      const mid = await ranchNow();
      check(mid.shows === before.shows && mid.pearls === before.pearls, 'nothing saved during the race (the show count, pearls)');
      await page.waitForFunction(() => { const r = window.slimekin.raceView.info(); return !r.on || r.hold > 0; }, null, { timeout: 120000, polling: 30 });
      const ph = await info();
      if (ph.on) { await page.waitForTimeout(600); await shot('4-photo'); }
      check(ph.on && ph.hold > 0, 'a photo finish (a tie at 85)', JSON.stringify({ on: ph.on, hold: ph.hold }));
      const { info: L, text } = await toResult();
      log('results:', text);
      await page.waitForTimeout(800);
      await shot('5-results');
      const R = await rules(3, L.taps);
      check(L.won && L.place === 1 && R.won && R.place === L.place && R.score === L.score && L.shown.place === R.place && L.shown.order[0] === 0,
        'the shown race and the result == scoreShow on its own with the same taps (1st, 85)', JSON.stringify({ shown: L.shown, res: { place: L.place, score: L.score }, rules: R }));
      if (asMeant) check(/Sprint Grand Cup!/.test(text) && /Juniper won by a wobble/.test(text) && /How Juniper ran: led from the gate, held on at the line\./.test(text), 'F8: "Sprint Grand Cup!", "Juniper won by a wobble", "How Juniper ran: led from the gate, held on at the line."', text);
      else check(/Sprint Grand Cup!/.test(text) && new RegExp('Juniper won ' + L.shown.words).test(text) && /How Juniper ran: /.test(text), 'F8 (taps off their aim): "Sprint Grand Cup!", "Juniper won <the race\'s margin words>", "How Juniper ran: ..."', text);
      check(!/\b(85|72|60|61|75|84)\b/.test(text) && !/Rivals up to/.test(text), 'no scores on the results', text);
      const after = await ranchNow();
      check(after.shows === before.shows + 1 && after.trophies.sprint === 3, 'applied once at the end: the show counted, the Grand Cup won', JSON.stringify({ before, after }));
      log('race perf (server, slow-env):', JSON.stringify(L.perf), 'seconds', JSON.stringify(L.seconds));
      await ev(() => window.slimekin.hud.closeModal());
    }, 600000);

    if (want('loss')) await step('loss: the pat, then no tap on the straight', async () => {
      await juniper(3);
      await openCard(3);
      await startRace();
      const y = (await info()).you;
      await touch(y.x, y.y);
      const g0 = await cheer(0, null), g1 = await cheer(1, 1.7), g2 = await cheer(2, 1.72);
      const asMeant = g0 === 'none' && g1.grade === 'good' && g2.grade === 'good';
      if (!asMeant) log('note: the taps landed off their aim (a busy box):', JSON.stringify([g0, g1, g2]));
      const { info: L, text } = await toResult();
      log('results:', text);
      await page.waitForTimeout(800);
      await shot('6-loss');
      const R = await rules(3, L.taps);
      if (!asMeant) check(R.place === L.place && R.score === L.score && L.shown.place === R.place, 'the result == scoreShow (taps off their aim)', JSON.stringify({ L: { place: L.place, score: L.score, shown: L.shown }, R }));
      else check(!L.won && L.place === 2 && R.place === 2 && R.score === L.score && L.shown.place === 2, 'the result == scoreShow (2nd, 84 against 85)', JSON.stringify({ L: { place: L.place, score: L.score, shown: L.shown }, R }));
      if (asMeant) check(/Good try!/.test(text) && /2nd, by a wobble/.test(text) && /Starlight caught Juniper in the hoops\./.test(text) && /Tap right when the blue ring meets the white one\./.test(text) && !/\b(84|85)\b/.test(text),
        'F8b: "Good try!", "2nd, by a wobble", "Starlight caught Juniper in the hoops.", the coach\'s tip (this race\'s rings), no scores', text);
      await ev(() => window.slimekin.hud.closeModal());
    }, 600000);

    if (want('skip')) await step('skip', async () => {
      await juniper(3);
      await openCard(3);
      await startRace();
      await page.waitForTimeout(1500);
      await touchSel('#rvSkip');
      const { info: L } = await toResult();
      const R = await rules(3, [[], [], []]);
      check(L.skipped && L.cheers === 0 && JSON.stringify(L.grades) === '[null,null,null]' && R.score === L.score && R.place === L.place, 'Skip: no cheers, the result == scoreShow with none', JSON.stringify({ L: { skipped: L.skipped, cheers: L.cheers, grades: L.grades, score: L.score }, R }));
      await ev(() => window.slimekin.hud.closeModal());
    }, 300000);

    if (want('reload')) await step('reload mid-race', async () => {
      await juniper(3);
      await ev(() => window.slimekin.saveNow());
      const before = await ranchNow();
      await openCard(3);
      await startRace();
      await cheer(0, 1.5);
      await page.reload();
      await boot();
      const after = await ranchNow();
      const on = await ev(() => window.slimekin.raceView.on || !!document.querySelector('#modalCard [data-cs-card]') && !document.getElementById('modal').hidden);
      check(after.pearls === before.pearls && after.shows === before.shows && JSON.stringify(after.trophies) === JSON.stringify(before.trophies) && after.shelf === before.shelf && !on,
        'a reload mid-race cancels it: no result, nothing paid, the show not counted', JSON.stringify({ before, after, on }));
      await toBarn();
    }, 600000);

    if (want('reduced')) await step('Reduced motion', async () => {
      await juniper(3);
      await ev(() => { const g = window.slimekin; g.state.settings.reducedMotion = true; g.applySettings(); });
      await openCard(3);
      const t = await modalText();
      check(/Ready for this one\.|Can win this with good cheers\.|Not yet:/.test(t) && !/needs great cheers/.test(t), 'Reduced motion: the card\'s chances never say "needs great cheers"', t.slice(0, 300));
      await startRace();
      await page.waitForFunction(() => { const r = window.slimekin.raceView.info(); return r.t > 13; }, null, { timeout: 120000, polling: 100 });
      await shot('7-reduced');
      const mid = await info();
      check(mid.reduced && mid.grades[0] === 'good' && mid.grades[1] === 'good', 'every cheer an automatic Good', JSON.stringify(mid.grades));
      const { info: L } = await toResult();
      const R = await rules(3, [[], [], []], true);
      check(L.reduced && L.cheers === 6 && R.score === L.score && R.place === L.place, 'the result == scoreShow (Reduced motion: three Good)', JSON.stringify({ L: { score: L.score, place: L.place }, R }));
      await ev(() => { const g = window.slimekin; g.hud.closeModal(); g.state.settings.reducedMotion = false; g.applySettings(); });
    }, 600000);

    if (want('low')) await step('Low graphics', async () => {
      await juniper(3);
      await ev(() => { const g = window.slimekin; g.state.settings.quality = 'low'; g.applySettings(); });
      await openCard(3);
      await startRace();
      await page.waitForTimeout(6000);
      const mid = await info();
      await touchSel('#rvSkip');
      await toResult();
      check(mid.low && mid.on, 'Low graphics: the race runs (no form effects, the crowd and the sails still, half the confetti)', JSON.stringify({ low: mid.low, draws: mid.draws }));
      await ev(() => { const g = window.slimekin; g.hud.closeModal(); g.state.settings.quality = 'auto'; g.applySettings(); });
    }, 300000);

    if (want('beauty')) await step('Beauty keeps the stand show', async () => {
      await ev(id => window.slimekin.contestsUI.openEntry(id, 'beauty'), P);
      await modalIs('entry');
      const t = await modalText();
      await touchSel('#modalCard [data-cs="start"]');
      await page.waitForFunction(() => window.slimekin.contestShow.s, null, { timeout: 30000 });
      const r = await ev(() => ({ race: window.slimekin.raceView.on, show: !!window.slimekin.contestShow.s }));
      check(/To win: beat/.test(t) && !r.race && r.show, 'the Beauty Show: today\'s card and the stand show (until RV4)', JSON.stringify(r));
      await ev(() => window.slimekin.contestShow.cancel());
    }, 300000);

    if (want('blocked')) await step('the race files blocked: the stand show', async () => {
      await page.route('**/src/assets/race/**', r => r.abort());
      await page.reload();
      await boot();
      await toBarn();
      await juniper(3);
      await ev(id => window.slimekin.contestsUI.openEntry(id, 'sprint', 3), P);
      await modalIs('entry');
      await touchSel('#modalCard [data-cs="start"]');
      await page.waitForFunction(() => window.slimekin.contestShow.s || !window.slimekin.raceView.on, null, { timeout: 60000 });
      const r = await ev(() => ({ race: window.slimekin.raceView.on, show: !!window.slimekin.contestShow.s }));
      check(!r.race && r.show, 'with the race\'s files blocked, the Sprint runs as the stand show', JSON.stringify(r));
      await ev(() => window.slimekin.contestShow.cancel());
      await page.unroute('**/src/assets/race/**');
    }, 400000);

    check(!pageErrors.length, 'no page errors', pageErrors.slice(0, 3).join(' | '));
  } catch (e) {
    errors.push(String(e && e.stack || e));
    log('ERROR', e && e.stack || e);
  } finally {
    if (kit) await kit.close();
  }
  log(errors.length ? `FAILED (${errors.length}):\n  ${errors.join('\n  ')}` : 'OK');
  process.exit(errors.length ? 1 : 0);
})();
