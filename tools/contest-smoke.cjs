// Contests C1 (rules only, no screens yet): the #debug path in the real game. From tools/fixtures/barn/barn-six.json at
// iPhone size: g.contests refuses a slime in a lesson or on a trip, Dress up takes only the family's outfits,
// g.debug('contests') gives a resident every star its talents allow, g.contests.enter runs the ladder (Little -> Big ->
// Grand) with first-win pearls once, a repeat pays nothing, and after a reload the trophies, the Trophy Shelf, the show
// count and the Journal line are still in the save. C1b (the screens) adds real taps on the cheer ring here.
//   node tools/contest-smoke.cjs
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
    errors.push(...kit.errors);
    kit.report();
  } catch (e) {
    errors.push(e.message);
  } finally {
    if (kit) await kit.close();
  }
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
