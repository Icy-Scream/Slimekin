// The game's start with the Greenhouse as home: the player never sees another scene before the room. A headless phone
// (393 x 852, a cold load: a new browser with an empty cache for every part) opens the game from
// tools/fixtures/barn/barn-six.json and records every frame from the first one: the loading screen's opacity, which
// world home drew (data-home-world: 'greenhouse' | 'loading' (the plain Classic look while the room loads) | 'meadow' |
// 'classic') and the cross-fade's opacity.
//   delay3   the room's files held back 3 s: the loading screen stays up until the room is in and drawn; no frame shows
//            the Classic look or the Meadow; the barn's files are asked for only after the room's are in
//   delay12  the room's files held back 12 s: the loading screen goes after GREENHOUSE.arrive.wait (8 s) into the
//            Classic look, and the room cross-fades in when it arrives (the last loading-look frame over it, fading out:
//            no pop)
//   offline  the room's files can't load (offline on the very first run): home shows the Meadow, the setting stays
//            Greenhouse, one warning; no other look first
//   meadow, classic   those Backgrounds never wait: the loading screen goes as soon as the game is built
//   cold     timing only (--runs=N cold loads, no delay): cold start to playable
//   node tools/home-load-smoke.cjs [--only=delay3,delay12,offline,meadow,classic] [--film] [--nocheck] [--runs=3]
// --film saves every frame the browser draws (CDP screencast) with the record to tools/out/home-load/<part>/.
// --nocheck only films and prints the record (for an older copy of the game: SLIMEKIN_ROOT=<folder>).
const path = require('path');
const fs = require('fs');
const { setup, watchdog, log, deadline } = require('./browser-kit.cjs');

const arg = (k, d) => { const a = process.argv.find(x => x === `--${k}` || x.startsWith(`--${k}=`)); return a ? (a.includes('=') ? a.split('=')[1] : true) : d; };
const ONLY = String(arg('only', 'delay3,delay12,offline,meadow,classic')).split(',');
const FILM = !!arg('film', false), CHECK = !arg('nocheck', false), RUNS = +arg('runs', 3);
const OUT = path.join(__dirname, 'out', 'home-load');
const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'barn', 'barn-six.json'), 'utf8')).save;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const fails = [];
const expect = (cond, what, detail = '') => { if (cond) log('ok', what); else { fails.push(what + (detail ? ': ' + detail : '')); log('FAIL', what, detail); } };

// One cold load. room: { delay } holds the room's files back, { block: true } makes them fail.
async function load(part, { scene = 'greenhouse', delay = 0, block = false, until }) {
  const kit = await setup({ contextOptions: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } });
  const { page } = kit;
  const reqs = [], warns = [];
  page.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
  await kit.context.addInitScript(([save, scene]) => {
    const s = JSON.parse(JSON.stringify(save)), now = Date.now();
    for (const x of s.ranch.residents) {
      if (x.trip) { x.trip.startAt = now - 600000; x.trip.homeAt = now + 3000000; }
      if (x.lesson) { x.lesson.startAt = now - 600000; x.lesson.doneAt = now + 7200000; }
    }
    s.savedAt = now - 60000; s.ranch.lastVisit = now; s.settings.scene = scene;
    localStorage.setItem('slimekin.save.v1', JSON.stringify(s));
    // every frame: [ms since the page was asked for, loading screen opacity (-1 = gone), world home drew, cross-fade opacity]
    const R = window.__load = { frames: [], snap: null };
    const tick = t => {
      const b = document.getElementById('boot'), x = document.getElementById('homeFade'), g = window.slimekin;
      const drawn = document.documentElement.dataset.homeWorld || (g && g.home ? g.home.world : null);
      const xo = x && !x.hidden ? +getComputedStyle(x).opacity : 0;
      if (xo > 0 && !R.snap) {   // the cross-fade's picture: is it really the last frame (not blank)?
        try {
          const c = x.getContext('2d'), d = c.getImageData(0, 0, x.width, x.height).data;
          let a = 0, lum = [], n = 0;
          for (let i = 0; i < d.length; i += 4 * 997) { a += d[i + 3]; lum.push(d[i] + d[i + 1] + d[i + 2]); n++; }
          const m = lum.reduce((s, v) => s + v, 0) / n;
          R.snap = { w: x.width, h: x.height, alpha: a / n, spread: Math.sqrt(lum.reduce((s, v) => s + (v - m) * (v - m), 0) / n) };
        } catch (e) { R.snap = { error: String(e) }; }
      }
      R.frames.push([Math.round(t), b ? (b.hidden ? -1 : +(+getComputedStyle(b).opacity).toFixed(3)) : null, drawn, +xo.toFixed(3)]);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [SAVE, scene]);
  let origin0 = 0, gate = null;
  const rel = () => Date.now() - origin0;
  // held back: every one of the room's files waits until `delay` ms after the first one was asked for (so the whole
  // room arrives about `delay` ms late, as on a slow network, not `delay` per file)
  await page.route('**/src/assets/greenhouse/**', async r => {
    reqs.push(['room', path.basename(r.request().url()), rel()]);
    if (block) return r.abort('internetdisconnected');
    if (delay) await (gate = gate || sleep(delay));
    return r.continue().catch(() => {});
  });
  await page.route('**/src/assets/barn/**', r => { reqs.push(['barn', path.basename(r.request().url()), rel()]); return r.continue().catch(() => {}); });
  page.on('requestfinished', q => { const u = q.url(); if (/\/src\/assets\/greenhouse\//.test(u)) reqs.push(['room-in', path.basename(u), rel()]); });
  // every frame the browser draws (for the filmstrip)
  const shots = [];
  let cdp = null;
  if (FILM) {
    cdp = await kit.context.newCDPSession(page);
    cdp.on('Page.screencastFrame', f => { shots.push({ ts: f.metadata.timestamp * 1000, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1 });
  }
  origin0 = Date.now();
  await kit.step(`${part}: open`, () => page.goto(`${kit.server.origin}/?${part}#debug`), 120000);
  const timeOrigin = await kit.ev(() => performance.timeOrigin);
  await kit.step(`${part}: wait`, () => page.waitForFunction(until, null, { timeout: 120000, polling: 100 }), 125000);
  await sleep(1200);
  if (cdp) await cdp.send('Page.stopScreencast').catch(() => {});
  const rec = await kit.ev(() => {
    const m = n => { const e = performance.getEntriesByName(n)[0]; return e ? Math.round(e.startTime) : null; };
    const g = window.slimekin;
    return { ...window.__load, built: m('slimekin-built'), shown: m('slimekin-shown'), scene: g && g.state.settings.scene, world: g && g.home.world,
      failed: g && g.home.room.failed, barnAsked: g && g.barnRanch.pre.asked };
  });
  rec.reqs = reqs.map(([k, f, t]) => [k, f, t - (timeOrigin - origin0)]);   // ms since the page was asked for, like the frames
  rec.warns = warns.filter(w => /Greenhouse/.test(w));
  rec.errors = kit.errors.slice();
  if (FILM) {
    const dir = path.join(OUT, part);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const s of shots) {
      const ms = Math.round(s.ts - timeOrigin);
      if (ms >= 0) fs.writeFileSync(path.join(dir, `${String(ms).padStart(6, '0')}.jpg`), Buffer.from(s.data, 'base64'));
    }
    fs.writeFileSync(path.join(dir, 'record.json'), JSON.stringify(rec));
    log(`${part}: ${shots.length} frames filmed into ${path.relative(path.join(__dirname, '..'), dir)}`);
  }
  kit.report();
  await kit.close();
  return rec;
}

// the record in short: each change of what is on screen
function story(rec) {
  const out = [];
  let last = '';
  for (const [t, boot, world, xf] of rec.frames) {
    const s = `boot ${boot === -1 ? 'gone' : boot === 1 ? 'up' : 'fading'} | ${world || '-'}${xf > 0 ? ' | cross-fade' : ''}`;
    if (s !== last) { out.push(`${String(t).padStart(6)} ms  ${s}${boot > 0 && boot < 1 ? ` (${boot})` : ''}${xf > 0 && xf < 1 ? ` (${xf})` : ''}`); last = s; }
  }
  return out.join('\n');
}
// frames where the scene shows through (the loading screen fading or gone)
const visible = rec => rec.frames.filter(([, b]) => b !== null && b < 0.999);
const firstWith = (rec, f) => rec.frames.find(f);

const PARTS = {
  async delay3() {
    const rec = await load('delay3', { delay: 3000, until: () => { const b = document.getElementById('boot'); return b.hidden && (document.documentElement.dataset.homeWorld || (window.slimekin && window.slimekin.home.world)) === 'greenhouse'; } });
    log('delay3:\n' + story(rec));
    if (!CHECK) return;
    const roomIn = Math.max(...rec.reqs.filter(r => r[0] === 'room-in').map(r => r[2]));
    const vis = visible(rec), bad = vis.filter(f => f[2] !== 'greenhouse');
    expect(rec.errors.length === 0, 'delay3: no page errors', rec.errors.slice(0, 3).join(' | '));
    expect(roomIn >= 3000, `delay3: the room's files were held back (in at ${roomIn} ms)`);
    expect(vis.length > 10 && bad.length === 0, `delay3: no frame shows anything but the Greenhouse once the loading screen fades (${vis.length} frames seen through it, ${bad.length} not the room)`, JSON.stringify(bad.slice(0, 3)));
    const fadeAt = vis.length ? vis[0][0] : null, drawnAt = (firstWith(rec, f => f[2] === 'greenhouse') || [null])[0];
    expect(fadeAt !== null && drawnAt !== null && fadeAt > drawnAt && fadeAt >= roomIn, `delay3: the loading screen stays up until the room is in and drawn (room in ${roomIn} ms, first drawn ${drawnAt} ms, the screen starts to fade ${fadeAt} ms)`);
    expect(rec.shown !== null && rec.built !== null && rec.shown - rec.built < 8000, `delay3: built ${rec.built} ms, shown ${rec.shown} ms (held ${rec.shown - rec.built} ms, under the 8 s limit)`);
    const barn = rec.reqs.filter(r => r[0] === 'barn');
    expect(barn.length > 0 && Math.min(...barn.map(r => r[2])) > roomIn, `delay3: the barn's files are asked for after the room's are in (barn first asked ${barn.length ? Math.min(...barn.map(r => r[2])) : 'never'} ms)`);
    expect(rec.frames.every(f => f[3] === 0), 'delay3: no cross-fade (nothing else was shown first)');
  },
  async delay12() {
    const rec = await load('delay12', { delay: 12000, until: () => { const b = document.getElementById('boot'), x = document.getElementById('homeFade'); return b.hidden && (document.documentElement.dataset.homeWorld || (window.slimekin && window.slimekin.home.world)) === 'greenhouse' && (!x || x.hidden); } });
    log('delay12:\n' + story(rec));
    if (!CHECK) return;
    const A = { wait: 8000 };
    expect(rec.errors.length === 0, 'delay12: no page errors', rec.errors.slice(0, 3).join(' | '));
    const vis = visible(rec), fadeAt = vis.length ? vis[0][0] : null;
    const held = rec.shown - rec.built;
    expect(held >= A.wait - 100 && held <= A.wait + 600, `delay12: the loading screen waits ${held} ms for the room, then goes (limit ${A.wait} ms)`);
    const before = vis.filter(f => f[2] !== 'greenhouse');
    expect(before.length > 0 && before.every(f => f[2] === 'loading'), `delay12: until the room arrives home shows the Classic look (${before.length} frames, all 'loading')`, JSON.stringify(before.filter(f => f[2] !== 'loading').slice(0, 3)));
    // the switch: the first frame drawn with the room has the last loading-look frame over it, fully
    const i = rec.frames.findIndex(f => f[2] === 'greenhouse');
    const sw = rec.frames[i];
    expect(sw && sw[3] >= 0.99, `delay12: the frame the room first shows is fully under the last loading-look frame (cross-fade ${sw && sw[3]} at ${sw && sw[0]} ms)`);
    expect(rec.snap && rec.snap.alpha > 250 && rec.snap.spread > 8, `delay12: the cross-fade's picture is a real frame, not blank (${JSON.stringify(rec.snap)})`);
    const after = rec.frames.slice(i);
    const end = after.find(f => f[3] === 0);
    const mid = after.filter(f => f[3] > 0.04 && f[3] < 0.96);
    expect(end && end[0] - sw[0] >= 500, `delay12: the cross-fade takes ${end ? end[0] - sw[0] : '?'} ms (at least 500: a soft fade, never a pop)`);
    let down = true;
    for (let k = 1; k < after.length; k++) if (after[k][3] > after[k - 1][3] + 1e-3) down = false;
    expect(mid.length >= 2 && down, `delay12: it fades out step by step (${mid.length} frames in between: ${mid.map(f => f[3]).join(', ')})`);
    expect(after.every(f => f[2] === 'greenhouse'), 'delay12: once the room shows it stays');
  },
  async offline() {
    const rec = await load('offline', { block: true, until: () => { const b = document.getElementById('boot'); return b.hidden && (document.documentElement.dataset.homeWorld || (window.slimekin && window.slimekin.home.world)) === 'meadow'; } });
    log('offline:\n' + story(rec));
    if (!CHECK) return;
    const vis = visible(rec), bad = vis.filter(f => f[2] !== 'meadow');
    expect(rec.world === 'meadow' && rec.failed && rec.scene === 'greenhouse', `offline: home shows the Meadow, the setting stays Greenhouse (world ${rec.world}, setting ${rec.scene})`);
    expect(rec.warns.length === 1, `offline: logged once (${rec.warns.length}: ${rec.warns[0] || ''})`);
    expect(vis.length > 10 && bad.length === 0, `offline: the Meadow is the first thing shown (${vis.length} frames, ${bad.length} other)`, JSON.stringify(bad.slice(0, 3)));
    expect(rec.errors.filter(e => !/greenhouse|Failed to load resource/i.test(e)).length === 0, 'offline: no page errors', rec.errors.slice(0, 3).join(' | '));
  },
  async meadow() { await plain('meadow'); },
  async classic() { await plain('classic'); },
};
// the Meadow and Classic: no waiting
async function plain(scene) {
  const rec = await load(scene, { scene, delay: 3000, until: () => document.getElementById('boot').hidden });
  log(`${scene}:\n` + story(rec));
  if (!CHECK) return;
  const vis = visible(rec), bad = vis.filter(f => f[2] !== scene);
  expect(rec.errors.length === 0, `${scene}: no page errors`, rec.errors.slice(0, 3).join(' | '));
  expect(rec.shown !== null && rec.shown - rec.built <= 5, `${scene}: no waiting, the loading screen goes as soon as the game is built (${rec.shown - rec.built} ms)`);
  expect(vis.length > 10 && bad.length === 0, `${scene}: only ${scene} is shown (${vis.length} frames, ${bad.length} other)`);
  expect(!rec.reqs.some(r => r[0] === 'room'), `${scene}: the room's files are not asked for`);
}

async function cold() {
  const rows = [];
  for (let i = 0; i < RUNS; i++) {
    const rec = await load('cold', { until: () => { const b = document.getElementById('boot'); return b.hidden && (document.documentElement.dataset.homeWorld || (window.slimekin && window.slimekin.home.world)) !== 'loading'; } });
    const vis = visible(rec);
    const fade = vis.length ? vis[0][0] : null;
    const gone = (firstWith(rec, f => f[1] === -1) || [null])[0];
    const room = (firstWith(rec, f => f[2] === 'greenhouse' && f[1] < 0.999) || [null])[0];
    const other = vis.filter(f => f[2] !== 'greenhouse').length;
    const r = { first: rec.frames.length ? rec.frames[0][0] : null, fade, playable: gone, roomOnScreen: room, otherFrames: other };
    log(`cold run ${i + 1}:`, JSON.stringify(r));
    rows.push(r);
  }
  const med = k => { const v = rows.map(r => r[k]).filter(x => x !== null).sort((a, b) => a - b); return v.length ? `${v[(v.length - 1) >> 1]} (${v[0]}..${v[v.length - 1]})` : 'never'; };
  console.log(`\ncold loads, median (min..max) of ${rows.length}, ms since the page was asked for:`);
  for (const [k, n] of [['first', 'first frame'], ['fade', 'loading screen starts to fade'], ['playable', 'loading screen gone (playable)'], ['roomOnScreen', 'the Greenhouse on screen'], ['otherFrames', 'frames showing another look']]) console.log(`  ${n.padEnd(32)} ${med(k)}`);
}

(async () => {
  watchdog(30, () => 'home-load');
  fs.mkdirSync(OUT, { recursive: true });
  for (const p of ONLY) {
    if (p === 'cold') { await cold(); continue; }
    if (!PARTS[p]) throw new Error('unknown part ' + p);
    await PARTS[p]();
  }
  if (fails.length) { console.log('\nFAILED\n' + fails.join('\n')); process.exit(1); }
  console.log('\nOK');
  process.exit(0);
})().catch(e => { console.log('FAILED', e && e.stack || e); process.exit(1); });
