// Integration smoke test (slice M1: the recipe body, ranch life, the Cuddly Moving Day fix and the iPhone seam in one
// build). Plays where the branches meet, in a headless phone-sized browser (393x852), from the old generation-2 save
// (tools/fixtures/main-gen2.json: Pebble at home, Juniper on the ranch, both from before the recipe body and ranch life):
//   1. the old save migrates: Pebble and Juniper become Curlys, Juniper gets 0 stars, no lesson, no trip;
//   2. Pebble grows up (Grown-Up Ribbon pin); the Cuddly Moving Day sign plays on a Curly and on a Dollop, on both
//      sides: the snack must sit beside the face, clear of both eyes and the medal pin (measured on screen: rays through
//      every 2 px of the snack against the face's eye regions and the pin);
//   3. Pebble moves out as a Dollop: the ranch has a Curly (Juniper) and a Dollop (Pebble), each with its body and the
//      ranch-life fields, each drawn with its own breed;
//   4. the Curly trains (the Train page, a lesson finished with g.advance); the Dollop goes on a trip (the trip page),
//      leaves the scene, the Nursery's special eggs page opens with the traveler marked "On a trip", it comes home
//      with g.advance and is drawn as a Dollop again; then the other way round (the Dollop trains, the Curly travels);
//   5. a new home for the Curly and an auction for the Dollop.
// Fails on any page error. Screenshots (day and night) go to tools/out/integrate/; measurements to
// tools/out/integrate/measure.json.
//
// Setup as in tools/smoke-test.cjs (playwright + three@0.170.0 outside the repo, found through NODE_PATH).
// Starts its own dev server on a free loopback port, runs offline and stops everything on exit (tools/browser-kit.cjs).
//   node tools/integrate-smoke.cjs [--dpr 2] [--quick]     (--quick: day screenshots only)
const path = require('path');
const fs = require('fs');
const { devices } = require('playwright');
const { setup, watchdog, log } = require('./browser-kit.cjs');

const OUT = path.join(__dirname, 'out', 'integrate');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const DPR = Number(arg('dpr', 2));
const QUICK = process.argv.includes('--quick');
const VIEW = { width: 393, height: 852 };
fs.mkdirSync(OUT, { recursive: true });
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'main-gen2.json'), 'utf8')).save;

(async () => {
  const errors = [];
  const checks = [];
  const measures = {};
  const ok = (cond, what, extra = '') => { checks.push(!!cond); log((cond ? 'ok   ' : 'FAIL ') + what + (extra ? ' | ' + extra : '')); if (!cond) errors.push(what + (extra ? ' | ' + extra : '')); };
  let kit = null;
  watchdog(50, () => kit ? kit.current() : 'setup');
  try {
    const dev = devices['iPhone 15 Pro'];
    kit = await setup({ contextOptions: { userAgent: dev.userAgent, isMobile: true, hasTouch: true, viewport: VIEW, screen: VIEW, deviceScaleFactor: DPR } });
    const { page, step } = kit;
    await kit.context.addInitScript(save => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('slimekin.save.v1', JSON.stringify(save)); } }, { ...FIXTURE, savedAt: Date.now() - 60000 });
    page.setDefaultTimeout(120000);
    const ev = (fn, a, ms) => kit.ev(fn, a, ms);
    const setTheme = async dark => { await ev(d => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark); await page.waitForTimeout(300); await ev(() => window.slimekin.advance(0.25)); };
    // Headless Chrome only advances CSS transitions when it draws, so screenshots double as "settle".
    // before(dark) runs after the theme is set (a sign replays for the night shot: the game runs on during screenshots)
    const shot = (name, { night = !QUICK, before = null } = {}) => step('screenshot ' + name, async () => {
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
      log('screenshot', name);
    }, 400000);
    const boot = async () => {
      await page.waitForFunction(() => window.slimekin && window.slimekin.state, null, { timeout: 120000 });
      await page.waitForTimeout(2500);
      await ev(() => { const g = window.slimekin; g.behave.hour = () => 14; g.state.settings.quality = 'high'; g.applySettings(); });
    };
    const calm = () => ev(() => { const g = window.slimekin; g.state.tutorial = 5; g.requests.timer = 1e9; g.glimmerT = 1e9; g.debug('needs'); if (g.sim.asleep) g.wakeUp('rested'); });
    const clearToasts = () => ev(() => { for (const t of document.querySelectorAll('.toast')) t.remove(); });
    const modalText = () => ev(() => (window.slimekin.hud.modalOpen ? document.getElementById('modalCard').innerText : ''));
    const resident = id => ev(id => window.slimekin.state.ranch.residents.find(x => x.id === id) || null, id);
    // the resident as the ranch scene draws it: its avatar's body (null when it is not in the scene). The Barn ranch draws
    // one resident at a time, on the stand: a resident on the stand's list is brought up (as the menu's Visit does) and
    // the stand's avatar is read; one not on the list (a traveler, gone) is not drawn.
    const drawn = id => ev(id => {
      const g = window.slimekin, b = g.barnRanch;
      if (b && b.active) {
        if (!b.order.includes(id)) return null;
        b.show(id); g.advance(1.2);
        const av = b.view.av;
        return b.curId === id && av.root.visible ? { breed: av.bodyInfo.breed, mix: av.mixS, variant: av.bodyInfo.variant } : { notOnStand: b.curId };
      }
      const r = g.ranch.resident(id); return r && r.state !== 'leave' ? { breed: r.av.bodyInfo.breed, mix: r.av.mixS, variant: r.av.bodyInfo.variant } : null;
    }, id);

    // ---------- 1. the old save ----------
    await step('open the game', () => page.goto(`${kit.server.origin}/#debug`));
    await step('boot', boot);
    const m = await ev(() => { const s = window.slimekin.state, R = s.ranch; return { slime: { name: s.slime.name, breed: s.slime.breed, mix: s.slime.mix }, life: R.life, res: R.residents.map(x => ({ id: x.id, name: x.name, breed: x.breed, variant: x.variant, mix: x.mix, skills: x.skills, lesson: x.lesson, trip: x.trip })) }; });
    const juniper = m.res.find(x => x.name === 'Juniper');
    ok(m.slime.breed === 'curly' && m.slime.mix === 0 && juniper && juniper.breed === 'curly' && juniper.mix === 0 && juniper.variant === 'plain',
      'the old save: Pebble and Juniper are Curlys (the recipe body\'s rule for old saves)', JSON.stringify([m.slime, { name: juniper && juniper.name, breed: juniper && juniper.breed }]));
    ok(juniper && Object.values(juniper.skills).length === 5 && Object.values(juniper.skills).every(v => v === 0) && juniper.lesson === null && juniper.trip === null && m.life.lanes === 1 && m.life.wagons === 1,
      'and Juniper has the ranch-life fields: 0 stars, no lesson, no trip; 1 lane, 1 wagon', JSON.stringify(juniper && juniper.skills));
    const J = juniper.id;
    await calm();

    // ---------- 2. Pebble grows up; the Cuddly sign on a Curly and on a Dollop ----------
    const gu = await step('Pebble grows up', () => ev(() => {
      const g = window.slimekin;
      for (let k = 0; k < 6 && g.sim.stageIndex() < 3; k++) { g.debug('grow'); g.advance(3); g.hud.closeModal(); }
      for (let k = 0; k < 4; k++) { g.advance(1); g.hud.closeModal(); }
      g.requests.timer = 1e9; g.glimmerT = 1e9; g.debug('needs');
      return { stage: g.sim.stageIndex(), medal: g.state.slime.medalShown, pin: !!(g.slime.medalPin && g.slime.medalPin.sprite.visible !== false) };
    }, null, 300000), 320000);
    ok(gu.stage === 3 && gu.pin, 'Pebble is Settled and wears its medal pin', JSON.stringify(gu));
    await clearToasts();

    // On screen, with rays through the canvas every 2 px: where the snack is drawn, where the face's eyes are (the
    // avatar's own faceRegion), where the medal pin is; the snack must cover neither, and sit to the side of the face.
    const measure = () => ev(() => {
      const g = window.slimekin, sl = g.slime, a = g.movingDay.active, cam = g.stage.camera, rc = g.raycaster, ndc = g.ndc;
      const food = a && a.food;
      if (!food) return { snack: null, t: a && a.t };
      g.scene.updateMatrixWorld(true);
      const W = innerWidth, H = innerHeight, V = g.v1.constructor;
      const proj = w => { const p = w.clone().project(cam); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }; };
      // the region to scan: the slime's and the snack's screen boxes, padded
      const box = { x0: W, y0: H, x1: 0, y1: 0 };
      const grow = p => { box.x0 = Math.min(box.x0, p.x); box.y0 = Math.min(box.y0, p.y); box.x1 = Math.max(box.x1, p.x); box.y1 = Math.max(box.y1, p.y); };
      const pts = [];
      food.traverse(o => { if (o.isMesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 3) pts.push(o.localToWorld(new V(p.getX(i), p.getY(i), p.getZ(i)))); } });
      const posA = sl.geo.attributes.position;
      for (let i = 0; i < posA.count; i += 7) pts.push(sl.body.localToWorld(new V(posA.getX(i), posA.getY(i), posA.getZ(i))));
      for (const w of pts) grow(proj(w));
      box.x0 = Math.max(0, Math.floor(box.x0 - 12)); box.y0 = Math.max(0, Math.floor(box.y0 - 12)); box.x1 = Math.min(W, Math.ceil(box.x1 + 12)); box.y1 = Math.min(H, Math.ceil(box.y1 + 12));
      const pin = sl.medalPin && sl.medalPin.sprite;
      const foodPx = [], eyePx = [], pinPx = [];
      let eyeOver = 0, pinOver = 0;
      const S = 2;
      for (let y = box.y0; y <= box.y1; y += S) for (let x = box.x0; x <= box.x1; x += S) {
        ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1);
        rc.setFromCamera(ndc, cam);
        const onFood = rc.intersectObject(food, true).length > 0;
        const reg = sl.faceRegion(rc);
        const onEye = reg === 'eyeL' || reg === 'eyeR';
        const onPin = !!pin && rc.intersectObject(pin, false).length > 0;
        if (onFood) foodPx.push([x, y]);
        if (onEye) eyePx.push([x, y, reg]);
        if (onPin) pinPx.push([x, y]);
        if (onFood && onEye) eyeOver++;
        if (onFood && onPin) pinOver++;
      }
      const gap = (A, B) => { let d = Infinity; for (const p of A) for (const q of B) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1])); return Number.isFinite(d) ? Math.round(d) : null; };
      const mid = A => A.length ? { x: Math.round(A.reduce((s, p) => s + p[0], 0) / A.length), y: Math.round(A.reduce((s, p) => s + p[1], 0) / A.length) } : null;
      const eyeL = eyePx.filter(p => p[2] === 'eyeL'), eyeR = eyePx.filter(p => p[2] === 'eyeR');
      const fc = mid(foodPx), face = mid(eyePx);
      // beside the face: the snack's middle is farther out from the face's middle than the nearer eye's outer edge
      const near = fc && face ? (fc.x > face.x ? eyePx.filter(p => p[0] > face.x) : eyePx.filter(p => p[0] < face.x)) : [];
      const eyeEdge = near.length ? (fc.x > face.x ? Math.max(...near.map(p => p[0])) : Math.min(...near.map(p => p[0]))) : null;
      return {
        t: +a.t.toFixed(2), side: a.side, breed: sl.bodyInfo.breed, mix: +sl.mixS.toFixed(2), foodScale: +food.scale.x.toFixed(2),
        foodPx: foodPx.length * S * S, eyePx: eyePx.length * S * S, pinPx: pinPx.length * S * S, eyeOverlapPx: eyeOver * S * S, pinOverlapPx: pinOver * S * S,
        eyeGap: gap(foodPx, eyePx), pinGap: gap(foodPx, pinPx), snack: fc, eyeL: mid(eyeL), eyeR: mid(eyeR), pin: mid(pinPx),
        beside: !!(fc && face && eyeEdge !== null && Math.abs(fc.x - face.x) > Math.abs(eyeEdge - face.x)), eyeEdge,
      };
    }, null, 240000);
    const cuddly = async (label, mix) => {
      await ev(mix => { const g = window.slimekin; g.debugBody({ mix, variant: 'plain' }, { instant: true }); g.advance(3); g.debug('needs'); }, mix);
      for (const side of [1, -1]) {
        const key = `${label}-side${side > 0 ? '+1' : '-1'}`;
        // play the sign (the #debug button's own call), on this side; the snack is out and full size from t = 1.2 s.
        // Then hold the sign still at that moment (its clock stops; the slime itself lives on) so the measurement and
        // the screenshots show the same moment: software WebGL draws a few frames a second and a screenshot takes long.
        const play = () => ev(side => {
          const g = window.slimekin, md = g.movingDay;
          if (md.__step) { md.step = md.__step; delete md.__step; }
          g.debug('sign:cuddly'); md.active.side = side; g.advance(1.76);
          md.__step = md.step; md.step = function () { return md.__step.call(md, 0); };
        }, side);
        await play();
        const dm = await measure();
        await shot(`02-cuddly-${key}`, { before: async dark => { if (dark) { await play(); measures[key + '-night'] = await measure(); } } });
        measures[key] = dm;
        const n = measures[key + '-night'];
        for (const [when, r] of [['day', dm], ['night', n]]) {
          if (!r) continue;
          ok(r.snack && r.foodPx > 200 && r.eyePx > 200 && r.pinPx > 20 && r.eyeOverlapPx === 0 && r.pinOverlapPx === 0 && r.beside,
            `the Cuddly sign on a ${label} (side ${side}, ${when}): the snack is beside the face, clear of both eyes and the medal pin`,
            r.snack ? `t ${r.t}, snack ${r.foodPx} px at (${r.snack.x}, ${r.snack.y}), eyes ${r.eyePx} px, pin ${r.pinPx} px; overlap eyes ${r.eyeOverlapPx} px, pin ${r.pinOverlapPx} px; gap to the nearest eye ${r.eyeGap} px, to the pin ${r.pinGap} px` : `no snack at t ${r.t}`);
        }
        const end = await ev(() => { const g = window.slimekin, md = g.movingDay; if (md.__step) { md.step = md.__step; delete md.__step; } g.advance(4.4 + 1.5); const p = g.slime.root.position; return { active: !!g.movingDay.active, x: +p.x.toFixed(3), z: +p.z.toFixed(3) }; });
        ok(!end.active && Math.abs(end.x) < 0.02 && Math.abs(end.z) < 0.02, `the Cuddly sign on a ${label} (side ${side}) ends with the slime back on its cushion`, JSON.stringify(end));
      }
    };
    await step('Cuddly on a Curly', () => cuddly('Curly', 0), 900000);
    await step('Cuddly on a Dollop', () => cuddly('Dollop', 1), 900000);
    fs.writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify(measures, null, 1));

    // ---------- 3. Pebble moves out as a Dollop ----------
    await step('move out (Pebble, a Dollop)', async () => {
      await ev(() => { const g = window.slimekin; g.state.totalJelly = Math.max(g.state.totalJelly, 3e9); g.hud.closeModal(); g.hud.openTab('ranch'); g.closeNursery(); g.hud.openTab('ranch'); g.advance(3); });
      await page.click('#moveOutBtn');
      await page.click('#mvYes');
      const nav = page.waitForNavigation({ waitUntil: 'commit', timeout: 120000 });
      await ev(() => window.slimekin.advance(6));
      await nav;
      await page.waitForFunction(() => window.slimekin && window.slimekin.egg, null, { timeout: 120000 });
    }, 300000);
    await step('boot (gen 3)', boot);
    const r3 = await ev(() => { const R = window.slimekin.state.ranch; return R.residents.map(x => ({ id: x.id, name: x.name, breed: x.breed, variant: x.variant, mix: x.mix, skills: x.skills, lesson: x.lesson, trip: x.trip })); });
    const peb = r3.find(x => x.name === 'Pebble'), jun = r3.find(x => x.id === J);
    ok(r3.length === 2 && peb && peb.breed === 'dollop' && peb.mix === 1 && jun && jun.breed === 'curly',
      'moved out: the ranch has a Curly (Juniper) and a Dollop (Pebble)', JSON.stringify(r3.map(x => [x.name, x.breed, x.mix])));
    ok(peb && Object.values(peb.skills).length === 5 && Object.values(peb.skills).every(v => v === 0) && peb.lesson === null && peb.trip === null,
      'the new resident has its body and the ranch-life fields (0 stars, no lesson, no trip)', JSON.stringify(peb && peb.skills));
    const D = peb.id;
    await step('hatch the new egg', async () => {
      await ev(() => { const g = window.slimekin; for (let i = 0; i < 5; i++) g.tapEgg(g.egg.group.position.clone()); g.advance(4.5); });
      await page.waitForSelector('#slimeName');
      await page.fill('#slimeName', 'Clover'); await page.click('#nameOk');
    });
    await calm();
    await ev(() => { window.slimekin.sim.ranch.addPearls(300); window.slimekin.advance(1); });
    await page.click('#tab-ranch');
    // the ranch is the Barn ranch: its files load on the first visit, so wait for it (or its fallback) first
    await page.waitForFunction(() => { const b = window.slimekin.barnRanch; return b.on || b.view.failed; }, null, { timeout: 120000 });
    ok(await ev(() => window.slimekin.barnRanch.on), 'the Ranch tab opens the barn');
    await ev(() => { const g = window.slimekin; g.advance(4); g.hud.setSheet('closed'); g.advance(2); });
    const d0 = { j: await drawn(J), p: await drawn(D) };
    ok(d0.j && d0.j.breed === 'curly' && d0.j.mix === 0 && d0.p && d0.p.breed === 'dollop' && d0.p.mix === 1, 'the barn\'s stand draws Juniper as a Curly and Pebble as a Dollop', JSON.stringify(d0));
    await shot('03-ranch-curly-and-dollop');

    // ---------- 4a. the Curly trains (the Train page), the lesson ends with g.advance ----------
    await ev(id => { const g = window.slimekin; g.hud.setSheet('open'); g.focusResident(id); g.advance(3); }, J);
    await page.click('#body-ranch [data-rl="train"]');
    await ev(() => window.slimekin.advance(0.5));
    const tp = await modalText();
    ok(/Train Juniper/.test(tp) && /Bounce/.test(tp) && /Star 1/.test(tp), 'the Training page opens for the Curly (Train Juniper: five skills, star 1)', JSON.stringify(tp.replace(/\n/g, ' / ').slice(0, 160)));
    await shot('04-train-page');
    await page.click('#modalCard [data-skill="bounce"]');
    await ev(() => window.slimekin.advance(1));
    const les = (await resident(J)).lesson;
    const lesSec = await ev(l => Math.ceil((l.doneAt - window.slimekin.nowMs()) / 1000) + 5, les);
    ok(les && les.skill === 'bounce' && lesSec > 0, 'Juniper is in a Bounce lesson', `${lesSec} s to go`);
    await step('the lesson runs (g.advance)', () => ev(s => window.slimekin.advance(s, 1 / 10), lesSec, 600000), 620000);
    const jl = await resident(J), dj = await drawn(J);
    ok(jl.skills.bounce === 1 && jl.lesson === null && dj && dj.breed === 'curly' && dj.mix === 0, 'after the lesson: Juniper has 1 star in Bounce and is still drawn as a Curly', JSON.stringify({ skills: jl.skills, drawn: dj }));
    await clearToasts();

    // ---------- 4b. the Dollop goes on a trip, leaves the scene, the Nursery while it is away, home again ----------
    await ev(id => { const g = window.slimekin; g.focusResident(id); g.advance(2); }, D);
    await page.click('#body-ranch [data-rl="trip"]');
    await ev(() => window.slimekin.advance(0.5));
    const trp = await modalText();
    ok(/Send Pebble on a trip/.test(trp) && /Puddle Café/.test(trp), 'the trip page opens for the Dollop', JSON.stringify(trp.replace(/\n/g, ' / ').slice(0, 120)));
    await page.click('#modalCard [data-place="cafe"]');
    await ev(() => window.slimekin.advance(4));
    const tr = (await resident(D)).trip;
    const away = await drawn(D);
    ok(tr && tr.place === 'cafe' && away === null, 'Pebble is off to Puddle Café and is not on the ranch while away', JSON.stringify({ trip: tr && { place: tr.place, pearls: tr.pearls, souvenir: tr.souvenir }, drawn: away }));
    await clearToasts();
    await ev(() => { const g = window.slimekin; g.focusResident(null); g.advance(1); g.openNursery(); g.advance(1.5); });
    const nur = await ev(id => {
      const b = document.querySelector(`.parent-pick[data-id="${id}"]`);
      return { special: [...document.querySelectorAll('#body-ranch .special-egg')].map(c => c.innerText.split('\n')[0]), buy: document.querySelectorAll('#body-ranch [data-act="buySpecial"]').length, picked: !!b, disabled: !!(b && b.disabled), text: b ? b.innerText : '' };
    }, D);
    ok(nur.special.length === 2 && nur.buy === 2 && nur.disabled && /On a trip/.test(nur.text), 'the Nursery opens with the special eggs (Cat-ear, Topknot) and the traveler marked "On a trip"', JSON.stringify(nur));
    await ev(() => { const el = document.querySelector('#body-ranch .special-egg'); if (el) el.scrollIntoView({ block: 'start' }); });
    await shot('05-nursery-special-eggs');
    await ev(() => { const el = document.querySelector('.parent-grid'); if (el) el.scrollIntoView({ block: 'center' }); });
    await shot('06-nursery-traveler', { night: false });
    await ev(() => { const g = window.slimekin; g.closeNursery(); g.advance(1); });
    const tripSec = await ev(t => Math.ceil((t.homeAt - window.slimekin.nowMs()) / 1000) + 5, tr);
    await step(`the trip runs (g.advance ${tripSec} s)`, () => ev(s => window.slimekin.advance(s, 1 / 5), tripSec, 1500000), 1520000);
    await ev(() => { const g = window.slimekin; for (let k = 0; k < 8 && !document.querySelector('#modalCard .rl-return'); k++) g.advance(1); });
    const card = await modalText();
    const back = await resident(D), dp = await drawn(D);
    ok(back.trip === null && dp && dp.breed === 'dollop' && dp.mix === 1 && /Pebble/.test(card), 'Pebble comes home (the return card) and is drawn as a Dollop again', JSON.stringify({ drawn: dp, card: card.replace(/\n/g, ' / ').slice(0, 140) }));
    await shot('07-dollop-home-card');
    await ev(() => window.slimekin.hud.closeModal());
    await ev(() => { const g = window.slimekin; g.hud.setSheet('closed'); g.advance(3); });
    await shot('08-ranch-after-trip');

    // ---------- 4c. the other way round: the Dollop trains, the Curly travels (rules through the menus' own calls) ----------
    const sw = await ev(({ J, D }) => { const g = window.slimekin; const a = g.life.train(D, 'charm'), b = g.life.send(J, 'cafe'); g.advance(4); return { lesson: !!a, trip: !!b }; }, { J, D });
    const awayJ = await drawn(J);
    ok(sw.lesson && sw.trip && awayJ === null, 'the Dollop starts a Charm lesson; the Curly leaves on a trip and is not on the ranch', JSON.stringify({ ...sw, drawnJuniper: awayJ }));
    const lesD = (await resident(D)).lesson, trJ = (await resident(J)).trip;
    const both = await ev(({ a, b }) => Math.ceil((Math.max(a.doneAt, b.homeAt) - window.slimekin.nowMs()) / 1000) + 5, { a: lesD, b: trJ });
    await step(`lesson and trip run (g.advance ${both} s)`, () => ev(s => window.slimekin.advance(s, 1 / 5), both, 1500000), 1520000);
    await ev(() => { const g = window.slimekin; for (let k = 0; k < 8; k++) { g.advance(1); if (g.hud.modalOpen) g.hud.closeModal(); } });
    const fin = { j: await resident(J), d: await resident(D), dj: await drawn(J), dd: await drawn(D) };
    ok(fin.d.skills.charm === 1 && fin.d.lesson === null && fin.j.trip === null && fin.dj && fin.dj.breed === 'curly' && fin.dd && fin.dd.breed === 'dollop',
      'both done: the Dollop has a Charm star, the trained Curly is home and drawn as a Curly (its skills kept)', JSON.stringify({ d: fin.d.skills, j: fin.j.skills, dj: fin.dj, dd: fin.dd }));
    const shelf = await ev(() => Object.keys(window.slimekin.state.ranch.life.souvenirs).length);
    ok(shelf >= 2, 'two trips, two souvenirs on the shelf', `${shelf}`);

    // ---------- 5. a new home for the Curly, an auction for the Dollop ----------
    await clearToasts();
    const p0 = await ev(() => window.slimekin.state.ranch.pearls);
    await ev(id => { const g = window.slimekin; g.hud.setSheet('open'); g.askPlace(id); g.advance(0.5); }, J);
    const offers = await ev(() => document.querySelectorAll('#modalCard .offer').length);
    ok(offers > 0, 'a new home for the trained Curly: the offers open', `${offers} offers`);
    await shot('09-new-home-offers', { night: false });
    await page.click('#modalCard .offer');
    await page.click('#cpYes');
    await ev(() => window.slimekin.advance(4));
    const placed = await ev(id => ({ gone: !window.slimekin.state.ranch.residents.some(x => x.id === id), pearls: window.slimekin.state.ranch.pearls }), J);
    ok(placed.gone && placed.pearls > p0 && (await drawn(J)) === null, 'Juniper went to a new home (pearls paid, gone from the ranch scene)', `+${placed.pearls - p0} pearls`);
    await clearToasts();
    await ev(id => { const g = window.slimekin; g.startAuction(id); }, D);
    const sold = await step('the auction', () => ev(async () => {
      const g = window.slimekin;
      for (let k = 0; k < 120 && !document.querySelector('#aucSell'); k++) { g.advance(0.5); await new Promise(r => setTimeout(r, 30)); }
      const b = document.querySelector('#aucSell');
      if (!b) return { ok: false, line: document.getElementById('aucLine')?.innerText };
      const before = g.state.ranch.pearls;
      b.click(); g.advance(4);
      return { ok: true, price: g.state.ranch.pearls - before, left: g.state.ranch.residents.length };
    }, null, 300000), 320000);
    ok(sold.ok && sold.price > 0 && sold.left === 0 && (await drawn(D)) === null, 'Pebble the Dollop sold at auction (pearls paid, gone from the ranch scene)', JSON.stringify(sold));
  } catch (e) {
    errors.push('test error: ' + e.message);
  } finally {
    if (kit) { errors.unshift(...kit.errors); kit.report(); await kit.close(); }
  }
  fs.writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify(measures, null, 1));
  log(`${checks.filter(Boolean).length} of ${checks.length} checks passed`);
  if (errors.length) { console.log('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nOK');
})();
