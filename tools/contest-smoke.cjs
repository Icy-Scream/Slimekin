// Contests: the real game at iPhone size (390 x 844) from tools/fixtures/barn/barn-six.json.
// C1 (the #debug path): g.contests refuses a slime in a lesson or on a trip, Dress up takes only the family's outfits,
// g.debug('contests') gives a resident every star its talents allow, g.contests.enter runs the ladder (Little -> Big ->
// Grand) with first-win pearls once, a repeat pays nothing, and after a reload the trophies, the Trophy Shelf, the show
// count and the Journal line are still in the save.
// C1b (the screens, real touch events through CDP Input.dispatchTouchEvent): Peaches becomes the mock-ups' Pebble (Charm
// 5, Smarts 3, a natural at Charm, Little and Big Beauty Cups won); the resident page's row (Enter a contest / Dress up;
// waiting in a lesson, hidden on a trip) -> the entry card (Grand Cup, rivals to 85, 72 before cheers) -> the show with
// three taps on the cheer ring (one on the beat = Perfect, one a little late = Good, one early = Nice try) -> the loss
// card and the coach's tip -> Dress up (three outfits, Style 16, on the stand's 3D slime) -> the entry card again -> a
// win (40 pearls once, a trophy, the shelf, the Journal) -> the trophy line on the page, the Ranch tab's Trophies, the
// Trophy Shelf, a Champion's title on the name card; Reduced motion (no ring, Good cheers, a repeat pays nothing); Low
// graphics with Skip (no more cheers); a reload mid-show pays nothing; every old save (tools/fixtures, fixtures/barn,
// fixtures/talents) opens the new screens without errors.
//   node tools/contest-smoke.cjs [--only=screens,reduced,low,reload,old]
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'barn', 'barn-six.json'), 'utf8')).save;

(async () => {
  const errors = [];
  const check = (cond, what, extra = '') => { log(`${cond ? 'ok  ' : 'FAIL'} ${what}${extra ? ' | ' + extra : ''}`); if (!cond) errors.push(what + (extra ? ': ' + extra : '')); };
  let kit = null;
  watchdog(20, () => kit ? kit.current() : 'setup');
  try {
    kit = await setup({ contextOptions: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } });
    const { page, step, ev } = kit;
    await kit.context.addInitScript(save => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const s = JSON.parse(JSON.stringify(save)), now = Date.now();
      for (const x of s.ranch.residents) {
        if (x.trip) { x.trip.startAt = now - 600000; x.trip.homeAt = now + 3000000; }
        if (x.lesson) { x.lesson.startAt = now - 600000; x.lesson.doneAt = now + 7200000; }
      }
      s.outfits.owned = ['bow', 'glasses', 'scarf'];
      s.savedAt = now - 60000; s.ranch.lastVisit = now;
      localStorage.setItem('slimekin.save.v1', JSON.stringify(s));
    }, SAVE);
    const boot = async () => {
      await page.waitForFunction(() => window.slimekin && window.slimekin.state && document.getElementById('boot').hidden, null, { timeout: 180000 });
      await ev(() => { const g = window.slimekin; g.hud.closeModal(); });
    };
    await step('boot', async () => { await page.goto(`${kit.server.origin}/#debug`); await boot(); }, 240000);
    const who = await ev(() => {
      const R = window.slimekin.state.ranch.residents;
      const pick = f => (R.find(f) || {}).id || null;
      return { lesson: pick(x => x.lesson), trip: pick(x => x.trip), free: pick(x => !x.lesson && !x.trip), pearls: window.slimekin.state.ranch.pearls, shows: window.slimekin.state.ranch.contests };
    });
    log('residents:', JSON.stringify(who));
    check(!!who.free && JSON.stringify(who.shows) === JSON.stringify({ shelf: {}, shows: 0 }), 'an old save loads with ranch.contests = { shelf: {}, shows: 0 } and a free resident');
    await step('busy residents and Dress up', async () => {
      const r = await ev(w => {
        const c = window.slimekin.contests;
        return {
          lesson: w.lesson ? c.enter(w.lesson, 'sprint', 'good').reason : 'lesson', trip: w.trip ? c.enter(w.trip, 'sprint', 'good').reason : 'away',
          notOwned: c.dress(w.free, 'head', 'crown').reason, wrongSlot: c.dress(w.free, 'face', 'scarf').reason,
          on: c.dress(w.free, 'neck', 'scarf').ok && c.dress(w.free, 'face', 'glasses').ok,
          worn: window.slimekin.state.ranch.residents.find(x => x.id === w.free).worn,
        };
      }, who);
      check(r.lesson === 'lesson' && r.trip === 'away', 'a slime in a lesson or on a trip can\'t enter', JSON.stringify(r));
      check(r.notOwned === 'owned' && r.wrongSlot === 'slot' && r.on && r.worn.neck === 'scarf' && r.worn.face === 'glasses', 'Dress up: only the family\'s outfits, each in its slot', JSON.stringify(r.worn));
    }, 60000);
    await step('the ladder', async () => {
      const r = await ev(w => {
        const g = window.slimekin, c = g.contests;
        const id = g.debug('contests') ?? null;   // (g.debug returns nothing; the resident is the first one home)
        const x = g.state.ranch.residents.find(y => !y.trip && !y.lesson);
        const before = g.state.ranch.pearls;
        const shows = ['good', 'good', 'good'].map(ch => c.enter(x.id, 'sprint', ch));
        const repeat = c.enter(x.id, 'sprint', 'perfect', { cup: 1 });
        const locked = c.enter(x.id, 'beauty', 'good', { cup: 3 });
        return { id, name: x.name, skills: x.skills, shows: shows.map(s => `${s.cupId}:${s.score}:${s.won}:${s.given && s.given.pearls}`), repeat: [repeat.repeat, repeat.given && repeat.given.pearls],
          locked: locked.reason, got: g.state.ranch.pearls - before, trophies: x.contests.trophies, ranch: g.state.ranch.contests, journal: g.state.memories.slice(-3).map(m => m.text) };
      }, who);
      log('ladder:', JSON.stringify(r));
      check(r.shows.join(' ') === `little:${r.shows[0].split(':')[1]}:true:5 big:${r.shows[1].split(':')[1]}:true:15 grand:${r.shows[2].split(':')[1]}:true:40`, 'Contest stars, then the Sprint ladder: Little, Big, Grand won, 5 + 15 + 40 pearls', r.shows.join(' '));
      check(r.got === 60 && r.repeat[0] === true && r.repeat[1] === 0 && r.locked === 'locked', 'a repeat of the Little Cup pays nothing; the Beauty Grand Cup is locked before its Little and Big', JSON.stringify({ got: r.got, repeat: r.repeat, locked: r.locked }));
      check(r.trophies.sprint === 3 && r.ranch.shows === 4 && Object.keys(r.ranch.shelf).length === 3 && r.journal.some(t => /won the Grand Cup at the Slime Sprint/.test(t)), 'trophies, the Trophy Shelf, the show count and a Journal line', JSON.stringify({ t: r.trophies, s: r.ranch }));
    }, 60000);
    await step('reload', async () => {
      await ev(() => window.slimekin.saveNow());
      await page.reload();
      await boot();
      const r = await ev(() => { const g = window.slimekin; const x = g.state.ranch.residents.find(y => y.contests.trophies.sprint === 3); return { name: x && x.name, ranch: g.state.ranch.contests, worn: x && x.worn }; });
      check(!!r.name && r.ranch.shows === 4 && Object.keys(r.ranch.shelf).length === 3, 'after a reload the trophies, the shelf and the show count are still there', JSON.stringify(r));
    }, 300000);
    // ---------------- C1b: the screens with real touches ----------------
    const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
    const want = k => !ONLY.length || ONLY.includes(k);
    const cdp = await kit.context.newCDPSession(page);
    const touch = async (x, y) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const box = sel => ev(q => { const el = document.querySelector(q); if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, disabled: !!el.disabled }; }, sel);
    // touch an element where it can be seen, once it stands still (a card that just opened grows in with an animation,
    // and headless Chrome only moves animations on when it draws a frame). The point is the middle of the part of it that
    // shows (inside the sheet and above the tab bar); if something else is on top there, it scrolls and looks again.
    const spot = sel => ev(q => {
      const el = document.querySelector(q);
      if (!el) return null;
      const r = el.getBoundingClientRect(), tabs = document.querySelector('#panel .tabs');
      let top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight);
      const sc = el.closest('.tab-body');
      if (sc && !el.closest('#modal')) { const b = sc.getBoundingClientRect(); top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); }
      if (tabs && !el.closest('#modal')) { const t = tabs.getBoundingClientRect(); if (t.height && t.top < bottom) bottom = Math.min(bottom, t.top); }
      const x = r.left + r.width / 2, y = (top + bottom) / 2;
      const e = bottom > top + 4 ? document.elementFromPoint(x, y) : null;
      const anim = !!(el.closest('.modal-card') && el.closest('.modal-card').getAnimations().some(a => a.playState === 'running'));
      return { x, y, ok: !!e && (e === el || el.contains(e)), on: e ? `${e.tagName}.${String(e.className).slice(0, 30)}` : 'nothing', anim };
    }, sel);
    const touchEl = async sel => {
      if (!(await ev(q => !!document.querySelector(q), sel))) throw new Error('nothing to touch: ' + sel);
      let a = null;
      for (let i = 0; i < 40; i++) {
        if (i === 0 || (a && !a.ok && i % 5 === 0)) await ev(([q, k]) => { const el = document.querySelector(q); el.scrollIntoView({ block: k ? 'start' : 'center' }); }, [sel, i > 0]);
        await page.waitForTimeout(150);
        const b = await spot(sel);
        if (b && b.ok && !b.anim && a && Math.abs(b.x - a.x) < 0.5 && Math.abs(b.y - a.y) < 0.5) { a = b; break; }
        a = b;
      }
      if (!a || !a.ok) log(`note: ${sel} can't be seen to touch (at ${a && a.x.toFixed(0)}, ${a && a.y.toFixed(0)} is ${a && a.on})`);
      await touch(a.x, a.y);
      return a;
    };
    const modalIs = (kind, ms = 60000) => page.waitForFunction(k => !!document.querySelector(`#modalCard [data-cs-card="${k}"]`) && !document.getElementById('modal').hidden, kind, { timeout: ms });
    const modalText = () => ev(() => document.getElementById('modalCard').innerText.replace(/\s+/g, ' ').trim());
    const P = 'rbarnpeach';
    // fast-forward the show's own clock to the next cheer ring of act n (the moves before it are not waited out)
    const toRing = n => page.waitForFunction(i => {
      const s = window.slimekin.contestShow.s;
      if (!s) return false;
      if (s.act === i && s.phase === 'ring') return !!(s.reduced || (s.ring && s.ring.anim && s.ring.anim.startTime !== null));
      if (s.phase === 'open' || s.phase === 'perform' || s.phase === 'pop' || s.phase === 'rest') s.t = 99;
      return false;
    }, n, { timeout: 120000, polling: 100 });
    // the same without hurrying the show (it plays at its own pace: the length of a show is measured on this one)
    const toRingSlow = n => page.waitForFunction(i => { const s = window.slimekin.contestShow.s; return !!s && s.act === i && s.phase === 'ring' && !!(s.reduced || (s.ring && s.ring.anim && s.ring.anim.startTime !== null)); }, n, { timeout: 120000, polling: 50 });
    const toEnd = () => page.waitForFunction(() => { const s = window.slimekin.contestShow.s; if (!s) return true; if (s.phase !== 'ring' && s.phase !== 'swap') s.t = 99; return false; }, null, { timeout: 120000, polling: 100 });
    // one real tap on the cheer ring, `at` seconds after the ring appeared (the ring's own clock: its animation's start)
    const tapAt = async at => {
      const r = await ev(() => ({ t0: window.slimekin.contestShow.s.ring.t0, now: performance.now() }));
      const wait = r.t0 + at * 1000 - r.now - 4;
      if (wait > 0) await page.waitForTimeout(wait);
      await touch(196, 470);
      await page.waitForFunction(() => { const s = window.slimekin.contestShow.s; return !s || s.phase !== 'ring'; }, null, { timeout: 30000 });
      return ev(() => { const s = window.slimekin.contestShow.s; return { grade: s.grades[s.act], tap: s.taps[s.act][0] }; });
    };
    const startFromCard = async () => {
      await touchEl('#modalCard [data-cs="start"]');
      await page.waitForFunction(() => window.slimekin.contestShow.on, null, { timeout: 30000 });
    };
    const freeIds = await ev(() => { const R = window.slimekin.state.ranch.residents; return { lesson: (R.find(x => x.lesson) || {}).id, trip: (R.find(x => x.trip) || {}).id }; });
    if (want('screens')) {
      await step('screens: Pebble and the barn', async () => {
        await ev(id => {
          const g = window.slimekin, x = g.state.ranch.residents.find(y => y.id === id);
          x.name = 'Pebble'; x.skills = { bounce: 0, speed: 0, sturdy: 0, smarts: 3, charm: 5 };
          x.potential = { bounce: 2, speed: 2, sturdy: 2, smarts: 3, charm: 3 }; x.talentsSeen = ['charm', 'smarts'];
          x.happiness = 82; x.contests.trophies = { beauty: 2, sprint: 0, bounce: 0 }; x.worn = { head: null, face: null, neck: null };
          g.state.outfits.owned = ['bow', 'bowtie', 'glasses', 'flowers', 'scarf'];
          g.sim.ranch.tick = (orig => dt => { x.happiness = 82; return orig.call(g.sim.ranch, dt); })(g.sim.ranch.tick);   // (mood stays 4 for the story)
          g.saveNow();
        }, P);
        await touchEl('#tab-ranch');
        await page.waitForFunction(() => { const b = window.slimekin.barnRanch; return (b.on && b.view.ready) || b.view.failed; }, null, { timeout: 180000 });
        await ev(id => { const g = window.slimekin; g.hud.closeModal(); g.focusResident(id); }, P);
        await page.waitForFunction(id => { const b = window.slimekin.barnRanch; return b.curId === id && !b.view.swapping; }, P, { timeout: 120000 });
        const rows = await ev(w => { const u = window.slimekin.contestsUI, R = window.slimekin.state.ranch.residents; return { lesson: u.residentRow(R.find(x => x.id === w.lesson)), trip: u.residentRow(R.find(x => x.id === w.trip)) }; }, freeIds);
        check(/data-cs="enter"[^>]*disabled/.test(rows.lesson) && /Contests wait until the lesson ends/.test(rows.lesson) && /data-cs="dress"/.test(rows.lesson) && rows.trip === '',
          'resident page: in a lesson "Enter a contest" waits (with the reason) and Dress up stays; on a trip the row is hidden');
        const page1 = await ev(() => { const b = document.querySelector('#body-ranch [data-cs="enter"]'), d = document.querySelector('#body-ranch [data-cs="dress"]'), t = document.querySelector('#body-ranch [data-rl="train"]');
          return { enter: b && b.innerText.trim(), dress: d && d.innerText.trim(), disabled: b && b.disabled, below: !!(b && t && b.getBoundingClientRect().top > t.getBoundingClientRect().bottom - 1) }; });
        check(page1.enter === 'Enter a contest' && page1.dress === 'Dress up' && !page1.disabled && page1.below, 'resident page: "Enter a contest" and "Dress up" as a row under Train / Send on a trip', JSON.stringify(page1));
      }, 400000);
      await step('screens: the entry card', async () => {
        await touchEl('#body-ranch [data-cs="enter"]');
        await modalIs('entry');
        const t = await modalText();
        log('entry card:', t);
        check(/Beauty Show/.test(t) && /Slime Sprint/.test(t) && /Bounce-Off/.test(t) && /Little Won Big Won Grand Next Champion Naturals only/.test(t) && /Grand Cup rivals To win: beat 85/.test(t) && /before cheers 72/.test(t)
          && /Pose 50 · Natural \+6 · Style 0 · Tricks 12 · Mood 4/.test(t) && /Cheers add up to 9\. Dress up to win this one\./.test(t) && /Dress up · Style 0 of 20/.test(t) && /Start the show/.test(t), 'entry card: tabs, the cup ladder, the Grand Cup\'s rivals, 72 before cheers and its parts, the coach\'s line, Dress up', t);
        const rv = await ev(() => [...document.querySelectorAll('#modalCard .cs-rival span')].map(e => e.textContent));
        check(rv.length === 3 && rv.every(n => /^.+'s slime$/.test(n)), 'rivals are "<Place>\'s slime"', rv.join(', '));
        await touchEl('#modalCard [data-cs="tab"][data-contest="sprint"]');
        await page.waitForFunction(() => /Little Cup rivals/.test(document.getElementById('modalCard').innerText), null, { timeout: 20000 });
        await touchEl('#modalCard [data-cs="tab"][data-contest="beauty"]');
        await page.waitForFunction(() => /Grand Cup rivals/.test(document.getElementById('modalCard').innerText), null, { timeout: 20000 });
        check(true, 'entry card: the contest tabs switch (Sprint shows the Little Cup, Beauty the Grand Cup)');
      }, 300000);
      await step('screens: the show, three real taps on the ring', async () => {
        const before = await ev(() => ({ pearls: window.slimekin.state.ranch.pearls, shows: window.slimekin.state.ranch.contests.shows }));
        await startFromCard();
        await toRing(0);
        const during = await ev(() => { const g = window.slimekin, cur = g.barnRanch.curId; g.barnRanch.request(1); return { cur, after: g.barnRanch.curId, swapping: g.barnRanch.view.swapping, card: document.getElementById('barnCard').innerText.replace(/\s+/g, ' '),
          strip: document.getElementById('csActs').innerText.replace(/\s+/g, ' '), bar: document.getElementById('ranchBar').classList.contains('cs-on'), banner: document.getElementById('csBanner').innerText, beat: document.getElementById('csBeat').innerText,
          go: document.getElementById('csGo').innerText, hint: document.getElementById('csHint').innerText, ring: document.getElementById('csPink').classList.contains('on'), sheet: document.getElementById('panel').classList.contains('open') }; });
        log('during the show:', JSON.stringify(during));
        check(during.after === during.cur && !during.swapping, 'no swapping during the show (a swipe asks for nothing)');
        check(/Act 1 of 3 · Pose \(Charm\)/.test(during.card) && during.bar && /Pose/.test(during.strip) && /Style/.test(during.strip) && /Tricks/.test(during.strip) && /Beauty Show · Grand Cup/.test(during.banner) && /To beat: 85/.test(during.beat)
          && during.go === 'Go, Pebble!' && during.hint === 'Tap when the rings meet' && during.ring && !during.sheet, 'the show: banner, To beat, the act on the name card, the act strip, "Go, Pebble!" and the ring, the menu closed', JSON.stringify(during));
        const beat = await ev(() => window.slimekin.contestShow.info().beat);
        const a = await tapAt(beat);            // on the beat
        await toRing(1);
        const b = await tapAt(beat + 0.22);     // a little late
        await toRing(2);
        const c = await tapAt(0.25);            // far too early
        log('taps:', JSON.stringify([a, b, c]));
        check(a.grade === 'perfect' && b.grade === 'good' && c.grade === 'nice', 'three real taps: on the beat = Perfect, a little late = Good, early = Nice try', JSON.stringify([a, b, c]));
        await toEnd();
        await modalIs('result');
        const t = await modalText();
        log('loss card:', t);
        const info = await ev(() => window.slimekin.contestShow.info().last);
        const after = await ev(() => ({ pearls: window.slimekin.state.ranch.pearls, shows: window.slimekin.state.ranch.contests.shows }));
        check(!info.won && info.place === 2 && info.cheers === 6 && JSON.stringify(info.grades) === '["perfect","good","nice"]' && info.score === 78, 'the result is the rules\' (scoreShow): 72 + cheers 3 + 2 + 1 = 78, 2nd', JSON.stringify(info));
        check(/^Good try! 2nd place in the Grand Cup/.test(t) && /Pebble 78/.test(t) && /Starlight Observatory's slime 85/.test(t) && /Pose 56 · Style 0 · Tricks 12 · Mood 4 · Cheers 6/.test(t)
          && /Coach's tip Dress Pebble up! Outfits add Style, and 7 more Style would have won it\./.test(t) && /Dress up Okay$/.test(t), 'the loss card: Good try!, the place, four scores, the parts, the coach\'s tip, Dress up / Okay', t);
        check(after.pearls === before.pearls && after.shows === before.shows + 1, 'a loss pays nothing; the show counts once', JSON.stringify({ before, after }));
      }, 400000);
      await step('screens: Dress up from the coach\'s tip', async () => {
        await touchEl('#modalCard [data-cs="tipDress"]');
        await modalIs('dress');
        for (const o of ['flowers', 'glasses', 'bowtie']) { await touchEl(`#modalCard [data-outfit="${o}"]`); await page.waitForFunction(id => !!document.querySelector(`#modalCard [data-outfit="${id}"][aria-pressed="true"]`), o, { timeout: 20000 }); }
        const t = await modalText();
        const r = await ev(id => { const g = window.slimekin, x = g.state.ranch.residents.find(y => y.id === id), av = g.barnRanch.view.av; return { worn: x.worn, stand: ['head', 'face', 'neck'].map(s => av.outfit[s] && av.outfit[s].id), cur: g.barnRanch.curId, faded: document.querySelectorAll('#modalCard .cs-outfit.not').length }; }, P);
        log('dress:', t, JSON.stringify(r));
        check(/Style 16 of 20/.test(t) && /Flower Crown \+6 Style Wearing/.test(t) && /Party Hat \+8 Style In Outfits/.test(t) && r.faded === 4, 'Dress up: Style 16 of 20, Wearing chips, the outfits the family does not own faded with "In Outfits"', t);
        check(r.worn.head === 'flowers' && r.worn.face === 'glasses' && r.worn.neck === 'bowtie' && r.cur === P && r.stand.join() === 'flowers,glasses,bowtie', 'Dress up: the save and the 3D slime on the stand wear them', JSON.stringify(r));
        await touchEl('#modalCard [data-cs="done"]');
        await modalIs('entry');
        const e = await modalText();
        check(/Dress up · Style 16 of 20/.test(e) && /before cheers 88/.test(e), 'Done goes back to the entry card: Style 16, 88 before cheers', e);
      }, 300000);
      await step('screens: a win', async () => {
        const before = await ev(() => ({ pearls: window.slimekin.state.ranch.pearls, mem: window.slimekin.state.memories.length }));
        await startFromCard();
        const beat = await ev(() => window.slimekin.contestShow.info().beat);
        const g3 = [];
        for (let i = 0; i < 3; i++) { await toRingSlow(i); g3.push((await tapAt(beat)).grade); }
        await modalIs('result', 120000);
        await modalIs('result');
        const t = await modalText();
        log('win card:', t, JSON.stringify(g3));
        const info = await ev(() => window.slimekin.contestShow.info().last);
        const after = await ev(id => { const g = window.slimekin, x = g.state.ranch.residents.find(y => y.id === id); return { pearls: g.state.ranch.pearls, mem: g.state.memories.slice(-1)[0], shelf: g.state.ranch.contests.shelf['beauty-grand'], trophies: x.contests.trophies }; }, P);
        check(info.won && info.given.pearls === 40 && info.given.trophy && info.given.shelf && after.pearls === before.pearls + 40 && after.trophies.beauty === 3 && after.shelf && after.shelf.name === 'Pebble' && after.mem.icon === '🏆',
          'a win: 40 pearls once, the trophy, the Trophy Shelf spot and a Journal line', JSON.stringify({ info, before, after }));
        check(info.seconds.game >= 30 && info.seconds.game <= 45, 'the whole show, played at its own pace with taps on the beat, lasts 30-45 s', JSON.stringify(info.seconds));
        check(/^Grand Cup! Pebble won the Beauty Show/.test(t) && /\+40 pearls Pebble's first Grand Cup/.test(t) && /A trophy for Pebble Buyers pay 4\.5% more for Pebble/.test(t) && /Champion Cup is open Pebble is a natural at Charm/.test(t) && /Yay!$/.test(t),
          'the win card: the cup, +40 pearls, the trophy and the total bonus, what opens next, Yay!', t);
        await touchEl('#modalCard [data-cs="ok"]');
        await page.waitForFunction(() => document.getElementById('modal').hidden, null, { timeout: 20000 });
        const line = await ev(() => { window.slimekin.hud.renderRanch(true); const el = document.querySelector('#body-ranch .cs-trophies'); return el ? { text: el.innerText.trim(), cups: el.querySelectorAll('.gi.cup').length } : null; });
        check(!!line && line.text === '3 trophies: buyers pay +4.5% for Pebble' && line.cups === 3, 'the resident page lists its cups and the TOTAL trophy bonus', JSON.stringify(line));
      }, 400000);
      await step('screens: the Ranch tab, the Trophy Shelf, a Champion\'s title', async () => {
        await ev(() => window.slimekin.focusResident(null));
        const half = await ev(() => { const b = document.querySelector('#body-ranch [data-cs="shelf"]'), s = document.querySelector('#body-ranch [data-rl="shelf"]'); return b && s ? { t: b.innerText.replace(/\s+/g, ' ').trim(), s: s.innerText.trim(), same: Math.abs(b.getBoundingClientRect().top - s.getBoundingClientRect().top) < 2 } : null; });
        check(!!half && half.t === 'Trophies 4 / 12 Champions 0 / 3' && /^Souvenirs \d+ \/ 18$/.test(half.s) && half.same, 'Ranch tab: "Souvenirs x / 18" and "Trophies 4 / 12 · Champions 0 / 3" as two halves of one row', JSON.stringify(half));
        const st = () => ev(() => ({ panel: document.getElementById('panel').className, modal: !document.getElementById('modal').hidden, card: (document.querySelector('#modalCard [data-cs-card]') || {}).dataset?.csCard || null, tab: window.slimekin.hud.tab, focus: window.slimekin.ranchFocus, show: window.slimekin.contestShow.on }));
        log('before the Trophies touch:', JSON.stringify(await st()));
        await ev(() => { window.__clicks = []; document.addEventListener('click', e => window.__clicks.push(e.target.tagName + '.' + e.target.className + ' ' + ((e.target.closest('button') || {}).dataset?.cs || '')), true); });
        await touchEl('#body-ranch [data-cs="shelf"]');
        await page.waitForTimeout(500);
        log('after it:', JSON.stringify(await st()), JSON.stringify(await ev(() => window.__clicks)));
        await modalIs('shelf');
        const t = await modalText();
        log('shelf:', t);
        check(/^Trophy Shelf 4 \/ 12/.test(t) && /Champions 0 \/ 3/.test(t) && /Grand Pebble/.test(t) && (t.match(/Not yet/g) || []).length === 8, 'the Trophy Shelf: 3 contests x 4 cups, the first winner\'s name, Not yet', t);
        await touchEl('#modalCard [data-cs="done"]');
        const title = await ev(async () => {
          const g = window.slimekin, j = g.state.ranch.residents.find(x => x.name === 'Juniper');
          j.contests.trophies.beauty = 4;
          g.barnRanch.show(j.id);
          await new Promise(r => { const k = () => (!g.barnRanch.view.swapping && g.barnRanch.curId === j.id ? r() : setTimeout(k, 100)); k(); });
          g.barnRanch.renderCard();
          const el = document.querySelector('#barnCard .bc-title');
          j.contests.trophies.sprint = 4; g.barnRanch.renderCard();
          const el2 = document.querySelector('#barnCard .bc-title');
          return { one: el && el.innerText.trim(), two: el2 && el2.innerText.trim() };
        });
        check(title.one === 'Beauty Champion' && title.two === 'Double Champion', 'a Champion\'s title chip on the name card (Beauty Champion; two contests: Double Champion)', JSON.stringify(title));
        await ev(() => { const j = window.slimekin.state.ranch.residents.find(x => x.name === 'Juniper'); j.contests.trophies.beauty = 0; j.contests.trophies.sprint = 3; window.slimekin.barnRanch.renderCard(); });
        await touchEl('#tab-slime');
        await touchEl('#tab-journal');
        const jl = await ev(() => { const el = [...document.querySelectorAll('#body-journal .mem-line, #body-journal div')].find(d => /won the Grand Cup at the Beauty Show/.test(d.textContent) && d.children.length < 6); return el ? { svg: !!el.querySelector('svg'), text: el.textContent.trim().slice(0, 90), emoji: /🏆/.test(el.textContent) } : null; });
        check(!!jl && jl.svg && !jl.emoji, 'the Journal line has the drawn cup (no emoji)', JSON.stringify(jl));
      }, 300000);
    }
    if (want('reduced')) {
      await step('Reduced motion: no ring, Good cheers', async () => {
        await ev(id => { const g = window.slimekin; g.state.settings.reducedMotion = true; g.applySettings(); g.focusResident(id); }, P);
        await page.waitForFunction(id => { const b = window.slimekin.barnRanch; return b.curId === id && !b.view.swapping; }, P, { timeout: 120000 });
        const before = await ev(() => window.slimekin.state.ranch.pearls);
        await ev(id => window.slimekin.contestsUI.openEntry(id, 'beauty', 3), P);
        await modalIs('entry');
        await startFromCard();
        await toRing(0);
        await page.waitForTimeout(300);
        const r = await ev(() => ({ ring: document.getElementById('csPink').classList.contains('on'), anim: !!(window.slimekin.contestShow.s.ring && window.slimekin.contestShow.s.ring.anim), go: document.getElementById('csGo').innerText, hint: document.getElementById('csHint').innerText }));
        await toEnd();
        await modalIs('result');
        const info = await ev(() => window.slimekin.contestShow.info().last);
        const t = await modalText();
        check(!r.ring && !r.anim && r.go === 'Go, Pebble!' && r.hint === '' && JSON.stringify(info.grades) === '["good","good","good"]' && info.cheers === 6, 'Reduced motion: no closing ring, every cheer is an automatic Good', JSON.stringify({ r, info }));
        check(info.won && info.given.pearls === 0 && !info.given.trophy && /Won again!/.test(t) && await ev(() => window.slimekin.state.ranch.pearls) === before, 'a repeat win pays nothing ("Won again!")', t);
        await touchEl('#modalCard [data-cs="ok"]');
        await ev(() => { const g = window.slimekin; g.state.settings.reducedMotion = false; g.applySettings(); });
      }, 300000);
    }
    if (want('low')) {
      await step('Low graphics and Skip', async () => {
        await ev(() => { const g = window.slimekin; g.state.settings.quality = 'low'; g.applySettings(); });
        await ev(id => window.slimekin.contestsUI.openEntry(id, 'sprint'), P);
        await modalIs('entry');
        await startFromCard();
        await toRing(0);
        const q = await ev(() => window.slimekin.barnRanch.view.quality);
        await touchEl('#csSkip');
        await modalIs('result');
        const info = await ev(() => window.slimekin.contestShow.info().last);
        check(q === 'low' && info.skipped && info.cheers === 0 && JSON.stringify(info.grades) === '["none","none","none"]', 'Low graphics: the show runs; Skip ends it with no cheers', JSON.stringify({ q, info }));
        await ev(() => window.slimekin.hud.closeModal());
        await ev(() => { const g = window.slimekin; g.state.settings.quality = 'auto'; g.applySettings(); });
      }, 300000);
    }
    if (want('reload')) {
      await step('a reload mid-show pays nothing', async () => {
        if (!(await ev(() => window.slimekin.barnRanch.on))) {
          await ev(() => window.slimekin.hud.openTab('ranch'));
          await page.waitForFunction(() => window.slimekin.barnRanch.on, null, { timeout: 180000 });
        }
        await ev(id => { window.slimekin.saveNow(); window.slimekin.contestsUI.openEntry(id, 'bounce'); }, P);
        await modalIs('entry');
        const before = await ev(id => { const g = window.slimekin; return { pearls: g.state.ranch.pearls, shows: g.state.ranch.contests.shows, trophies: g.state.ranch.residents.find(x => x.id === id).contests.trophies, shelf: Object.keys(g.state.ranch.contests.shelf).length }; }, P);
        await startFromCard();
        await toRing(1);
        await touch(196, 470);
        await page.waitForTimeout(300);
        await page.reload();
        await boot();
        const after = await ev(id => { const g = window.slimekin; return { pearls: g.state.ranch.pearls, shows: g.state.ranch.contests.shows, trophies: g.state.ranch.residents.find(x => x.id === id).contests.trophies, shelf: Object.keys(g.state.ranch.contests.shelf).length, on: g.contestShow.on, modal: !document.getElementById('modal').hidden && !!document.querySelector('#modalCard [data-cs-card]') }; }, P);
        check(after.pearls === before.pearls && after.shows === before.shows && JSON.stringify(after.trophies) === JSON.stringify(before.trophies) && after.shelf === before.shelf && !after.on && !after.modal,
          'a reload mid-show cancels it: no result, nothing paid, the show not counted', JSON.stringify({ before, after }));
      }, 400000);
    }
    if (want('old')) {
      await kit.context.addInitScript(() => { const n = sessionStorage.getItem('nextSave'); if (n) { sessionStorage.removeItem('nextSave'); localStorage.clear(); localStorage.setItem('slimekin.save.v1', n); } });
      const dir = path.join(__dirname, 'fixtures');
      const files = [...fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => path.join(dir, f)), ...['barn', 'talents'].flatMap(d => fs.existsSync(path.join(dir, d)) ? fs.readdirSync(path.join(dir, d)).filter(f => f.endsWith('.json')).map(f => path.join(dir, d, f)) : [])];
      for (const f of files) {
        await step('old save: ' + path.basename(f), async () => {
          const save = JSON.parse(fs.readFileSync(f, 'utf8')).save;
          const n0 = kit.errors.length;
          await ev(s => sessionStorage.setItem('nextSave', JSON.stringify(s)), save);   // (put in place before the game reads it)
          await page.reload();
          await boot();
          const r = await ev(() => {
            const g = window.slimekin, u = g.contestsUI, R = g.state.ranch.residents, out = { residents: R.length, opened: [] };
            for (const x of R) { u.residentRow(x); u.residentLine(x); }
            if (R.length) out.row = g.life.ranchRowHtml().includes('data-cs="shelf"');
            const free = R.find(x => !x.trip && !x.lesson), home = R.find(x => !x.trip);
            if (free && u.openEntry(free.id)) { out.opened.push('entry'); g.hud.closeModal(); }
            if (home && u.openDress(home.id)) { out.opened.push('dress'); g.hud.onModalClose = null; g.hud.closeModal(); }
            u.openShelf(); out.opened.push('shelf'); g.hud.closeModal();
            if (free) { g.hud.openTab('ranch'); g.focusResident(free.id); out.page = !!document.querySelector('#body-ranch [data-cs="enter"]'); }
            return out;
          });
          const errs = kit.errors.slice(n0);
          check(!errs.length && (!r.residents || (r.row && r.opened.length >= 2)), `old save ${path.relative(dir, f)} opens the new screens without errors`, JSON.stringify(r) + (errs.length ? ' ' + errs.join(' | ') : ''));
        }, 300000);
      }
    }
    errors.push(...kit.errors);
    kit.report();
  } catch (e) {
    errors.push(e.message);
    if (kit) { try { fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); await kit.page.screenshot({ path: path.join(__dirname, 'out', 'contest-smoke-failed.png'), timeout: 60000 }); log('picture of the failure: tools/out/contest-smoke-failed.png'); } catch { /* none */ } }
  } finally {
    if (kit) await kit.close();
  }
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
