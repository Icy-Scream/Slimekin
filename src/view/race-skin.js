// The race's skin (RV2): every on-screen piece of the race that is not the pixel course, in ONE module, so the
// scrapbook art (UI art P1, design §6.1) drops in here later without touching the race. Today it is the game's current
// UI look (the glass panels, chips, cup icons, DynaPuff and M PLUS Rounded), at the design's places (§8, 390 x 844 pt)
// with the design's words (§1.0, §7). Skin gaps (a design piece that does not exist yet, and today's equivalent used):
// reports/race-rv2.md "Skin gaps".
//   - the layer: the pixel canvas (scaled up, no smoothing), the ring canvas (crisp, device pixels), Skip, the tote
//     strip (running order faces + the track with a pin per runner), the caller strip, the name card with its leg tag,
//     the act strip (Dash / Hill / Hoops), "Go, <name>!" and the first-race hint, the cheer words, the grade stamp, the
//     pat note, the photo finish's mount;
//   - the race card (F1, hidden scores) and the results (F8, no numbers), as html for the contest modal.
// Per frame only drawRings and drawTrack run (canvas calls with numbers and fixed strings: nothing is made).
import { CONTESTS, CONTEST_BY_ID, SKILL_BY_ID } from '../data/content.js';
import { cupIcon, ICON } from '../ui/icons.js';
import { esc } from '../ui/esc.js';

const RC = () => CONTESTS.race;
const ORD = n => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const STARS = n => '★'.repeat(Math.max(0, n));
const RING = { target: '#ffffff', close: '#3fa2ff', edge: 'rgba(44, 33, 66, 0.4)' };   // design §8 (Sprint blue)

const CSS = `
  #raceLayer { position: fixed; inset: 0; z-index: 8; overflow: hidden; background: #bfe0ef; touch-action: none; user-select: none; -webkit-user-select: none;
    opacity: 0; transition: opacity .3s ease; --rv-top: max(env(safe-area-inset-top, 0px), 12px); }
  #raceLayer.on { opacity: 1; }
  #raceLayer.rm { transition-duration: .15s; }
  #raceLayer[hidden] { display: none; }
  #raceCanvas { position: absolute; left: 0; image-rendering: pixelated; image-rendering: crisp-edges; }
  #raceRings { position: absolute; left: 0; top: 0; pointer-events: none; }
  .rv-skip { position: absolute; right: 16px; top: calc(var(--rv-top) + 4px); width: 112px; min-height: 44px; border-radius: 16px; color: var(--ink);
    font: 800 15px var(--body); cursor: pointer; z-index: 2; }
  .rv-tote { position: absolute; left: 16px; right: 16px; top: calc(var(--rv-top) + 60px); height: 64px; border-radius: 18px; box-sizing: border-box; }
  .rv-faces { position: absolute; left: 8px; top: 5px; display: flex; gap: 2px; }
  .rv-face { width: 36px; display: flex; flex-direction: column; align-items: center; gap: 1px; transition: transform .25s ease; }
  .rv-face canvas { width: 32px; height: 28px; image-rendering: pixelated; border: 2px solid #fff; border-radius: 9px; background: #eef6e6; box-shadow: 0 2px 5px -2px var(--shade); }
  .rv-face.you canvas { border-color: #6b4bd6; }
  .rv-face span { font: 800 12px/14px var(--body); color: var(--ink-2); }
  .rv-track { position: absolute; left: 170px; right: 8px; top: 12px; height: 40px; }
  .rv-caller { position: absolute; left: 16px; top: calc(var(--rv-top) + 132px); min-height: 44px; max-width: calc(100% - 32px); box-sizing: border-box; padding: 0 16px;
    display: flex; align-items: center; border-radius: 14px; font: 700 14px var(--body); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rv-caller:empty { display: none; }
  .rv-name { position: absolute; left: 50%; bottom: 126px; transform: translateX(-50%); width: min(300px, calc(100vw - 32px)); min-height: 72px; box-sizing: border-box;
    padding: 9px 16px; border-radius: 22px; text-align: center; color: var(--ink); display: flex; flex-direction: column; justify-content: center; }
  .rv-name b { font-family: var(--display); font-weight: 700; font-size: 22px; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rv-name span { font: 700 13px var(--body); color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rv-name span i { font-style: normal; color: var(--honey, #e0a526); letter-spacing: 1px; }
  .rv-acts { position: absolute; left: 16px; right: 16px; bottom: 38px; height: 76px; border-radius: 22px; box-sizing: border-box; display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 0 10px; align-items: center; justify-items: center; }
  .rv-acts > div { width: 96px; max-width: 100%; height: 32px; border-radius: 14px; display: grid; place-items: center; background: var(--panel-strong);
    border: 1px solid var(--cs-line, #ebe2de); font: 800 13px var(--body); color: var(--ink-2); box-sizing: border-box; }
  .rv-acts > div.now { border: 1.6px solid #6b4bd6; color: var(--ink); }
  .rv-acts > div.done { background: var(--cs-soft, #f2edff); border-color: var(--cs-softline, #c7baf4); color: var(--ink); }
  .rv-go, .rv-pop, .rv-hint, .rv-pat { position: absolute; left: 0; top: 0; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity .2s; }
  .rv-go.on, .rv-pop.on, .rv-hint.on, .rv-pat.on { opacity: 1; }
  .rv-go { font: 800 20px var(--body); color: var(--ink); line-height: 1;
    text-shadow: 3px 0 #fff, -3px 0 #fff, 0 3px #fff, 0 -3px #fff, 2px 2px #fff, -2px 2px #fff, 2px -2px #fff, -2px -2px #fff; }
  .rv-go.small { font-size: 16px; }
  .rv-hint { font: 700 14px var(--body); color: var(--ink-2); line-height: 1;
    text-shadow: 2px 0 #fff, -2px 0 #fff, 0 2px #fff, 0 -2px #fff, 1.5px 1.5px #fff, -1.5px 1.5px #fff, 1.5px -1.5px #fff, -1.5px -1.5px #fff; }
  .rv-pop { font-family: var(--display); font-weight: 700; font-size: 26px; color: #fff; line-height: 1; transform: scale(.7); transition: opacity .2s, transform .35s cubic-bezier(.3, 1.6, .6, 1);
    text-shadow: 2px 0 #3fa2ff, -2px 0 #3fa2ff, 0 2px #3fa2ff, 0 -2px #3fa2ff, 1.5px 1.5px #3fa2ff, -1.5px 1.5px #3fa2ff, 1.5px -1.5px #3fa2ff, -1.5px -1.5px #3fa2ff; }
  .rv-pop.on { transform: scale(1); }
  .rv-pop.perfect { text-shadow: 2px 0 #d9890c, -2px 0 #d9890c, 0 2px #d9890c, 0 -2px #d9890c, 1.5px 1.5px #d9890c, -1.5px 1.5px #d9890c, 1.5px -1.5px #d9890c, -1.5px -1.5px #d9890c; }
  .rv-pop.nice { font-size: 22px; text-shadow: 2px 0 #6b4bd6, -2px 0 #6b4bd6, 0 2px #6b4bd6, 0 -2px #6b4bd6, 1.5px 1.5px #6b4bd6, -1.5px 1.5px #6b4bd6, 1.5px -1.5px #6b4bd6, -1.5px -1.5px #6b4bd6; }
  .rv-pat { padding: 6px 13px; border-radius: 14px; background: rgba(40, 25, 60, .66); color: #fff; font: 800 13px var(--body); transform: translate(-50%, 0); }
  .rv-stamp { position: absolute; left: 0; top: 0; display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 12px; background: #6b4bd6; color: #fff;
    font: 800 13px var(--body); white-space: nowrap; pointer-events: none; opacity: 0; transform: translate(-50%, 0) scale(.6); transition: opacity .2s, transform .3s cubic-bezier(.3, 1.6, .6, 1); }
  .rv-stamp.on { opacity: 1; transform: translate(-50%, 0) scale(1); }
  .rv-stamp .gi { width: 14px; height: 14px; }
  .rv-photo { position: absolute; inset: 0; background: rgba(44, 33, 66, .35); display: none; z-index: 3; }
  .rv-photo.on { display: block; }
  .rv-mount { position: absolute; left: 28px; right: 28px; top: calc(var(--rv-top) + 123px); border-radius: 18px; padding: 12px 12px 14px; box-sizing: border-box;
    display: flex; flex-direction: column; align-items: center; gap: 6px; transform: scale(.94); transition: transform .35s ease; }
  .rv-photo.on .rv-mount { transform: scale(1); }
  .rv-mount canvas { width: 100%; image-rendering: pixelated; border-radius: 10px; }
  .rv-mount .fig { font: italic 600 14px var(--body); color: var(--ink-2); }
  .rv-mount .by { font: 700 16px var(--body); color: var(--ink); }
  .rv-mount .rv-won { position: absolute; right: 22px; top: 22px; padding: 4px 12px; border-radius: 12px; background: #1fa37a; color: #fff; font: 800 14px var(--body); transform: rotate(-4deg); }
  body.rv-on #ui { visibility: hidden; }
  body.rv-on .barn-card, body.rv-on .barn-arrow, body.rv-on .barn-wait { display: none !important; }
  .rv-rows { display: flex; flex-direction: column; gap: 4px; }
  .rv-row { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 2px 4px; }
  .rv-row canvas, .rv-row .rv-noface { width: 32px; height: 28px; flex: none; image-rendering: pixelated; border: 2px solid #fff; border-radius: 9px; background: #eef6e6; box-shadow: 0 2px 5px -2px var(--shade); }
  .rv-row.me { border-radius: 16px; background: var(--cs-soft, #f2edff); border: 1.2px solid var(--cs-softline, #c7baf4); padding: 2px 10px 2px 4px; }
  .rv-row .rv-rt { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
  .rv-row .rv-rt b { display: block; font: 800 15px var(--body); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rv-row .rv-rt small { display: block; font: 600 14px var(--body); color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rv-row small i { font: normal 800 13px var(--body); color: var(--honey, #e0a526); letter-spacing: 1px; }
  .rv-row .rv-grade { flex: none; padding: 3px 10px; border-radius: 11px; background: #1fa37a; color: #fff; font: 800 12px var(--body); }
  .rv-how { text-align: center; font-weight: 700; font-size: 14px; line-height: 1.5; color: var(--ink); margin: 0; }
  .cs-modal .rv-two { display: grid; grid-template-columns: 1fr 1.3fr; gap: 8px; }`;

// ---------- the layer ----------
export function buildLayer() {
  if (!document.getElementById('raceSkinCss')) {
    const css = document.createElement('style');
    css.id = 'raceSkinCss'; css.textContent = CSS;
    document.head.appendChild(css);
  }
  const el = document.createElement('div');
  el.id = 'raceLayer';
  el.hidden = true;
  el.innerHTML = `<canvas id="raceCanvas" aria-label="The race"></canvas><canvas id="raceRings"></canvas>
    <div class="rv-tote glass"><div class="rv-faces" id="rvFaces"></div><canvas class="rv-track" id="rvTrack"></canvas></div>
    <div class="rv-caller glass" id="rvCaller" aria-live="polite"></div>
    <div class="rv-name glass" id="rvName"><b></b><span></span></div>
    <div class="rv-acts glass" id="rvActs"></div>
    <div class="rv-go" id="rvGo"></div><div class="rv-hint" id="rvHint"></div><div class="rv-pop" id="rvPop"></div>
    <div class="rv-stamp" id="rvStamp"></div><div class="rv-pat" id="rvPat"></div>
    <div class="rv-photo" id="rvPhoto"><div class="rv-mount glass"><canvas id="rvSnap"></canvas><span class="fig" id="rvFig"></span><span class="by" id="rvBy"></span><span class="rv-won" id="rvWon"></span></div></div>
    <button class="rv-skip glass" id="rvSkip" type="button">Skip</button>`;
  document.body.appendChild(el);
  const $ = id => el.querySelector('#' + id);
  return { el, canvas: $('raceCanvas'), rings: $('raceRings'), faces: $('rvFaces'), track: $('rvTrack'), caller: $('rvCaller'), name: $('rvName'), acts: $('rvActs'),
    go: $('rvGo'), hint: $('rvHint'), pop: $('rvPop'), stamp: $('rvStamp'), pat: $('rvPat'), photo: $('rvPhoto'), snap: $('rvSnap'), fig: $('rvFig'), by: $('rvBy'), won: $('rvWon'), skip: $('rvSkip') };
}
// size the canvases for the screen: the art canvas W x H art px at 2 pt, its bottom on the screen's bottom
export function layout(ui, W, H) {
  const c = ui.canvas;
  c.width = W; c.height = H;
  c.style.width = W * 2 + 'px'; c.style.height = H * 2 + 'px';
  c.style.top = (innerHeight - H * 2) + 'px';
  const dpr = Math.min(3, window.devicePixelRatio || 1), r = ui.rings;
  r.width = Math.round(innerWidth * dpr); r.height = Math.round(innerHeight * dpr);
  r.style.width = innerWidth + 'px'; r.style.height = innerHeight + 'px';
  ui.ringDpr = dpr;
  const t = ui.track, tw = t.clientWidth || 180, th = t.clientHeight || 40;
  t.width = Math.round(tw * dpr); t.height = Math.round(th * dpr);
  ui.trackDpr = dpr; ui.trackW = tw; ui.trackH = th;
}
// art px -> screen pt
export const screenX = ax => ax * 2;
export const screenY = (ay, H) => innerHeight - H * 2 + ay * 2;

// the tote strip's faces, leader first ("1st" .. "4th" under them)
export function setFaces(ui, runners, arts) {
  ui.faces.innerHTML = '';
  ui.faceEls = runners.map((r, i) => {
    const d = document.createElement('div');
    d.className = 'rv-face' + (r.you ? ' you' : '');
    const c = document.createElement('canvas');
    c.width = 16; c.height = 14;
    c.getContext('2d').drawImage(arts[i].face, 0, 0);
    c.setAttribute('aria-label', r.you ? r.short : `${r.short}'s slime`);
    const s = document.createElement('span');
    d.append(c, s);
    ui.faces.appendChild(d);
    return { d, s };
  });
  ui.pinCol = arts.map(a => a.base);
}
// order: runner indexes, leader first (a new order only: the DOM moves)
export function setOrder(ui, order) {
  for (let k = 0; k < order.length; k++) {
    const f = ui.faceEls[order[k]];
    f.d.style.order = String(k);
    f.s.textContent = ORD(k + 1);
  }
}
// the track: a pencil line, the start and leg ticks, the finish tick, one pin per runner (drawn 4th to 1st, yours bigger)
export function drawTrack(ui, prog, order, youI) {
  const c = ui.track, x = c.getContext('2d'), d = ui.trackDpr, w = ui.trackW, h = ui.trackH;
  x.setTransform(d, 0, 0, d, 0, 0);
  x.clearRect(0, 0, w, h);
  const x0 = 7, x1 = w - 8, y = h / 2 + 4;
  x.strokeStyle = 'rgba(92, 84, 112, 0.75)'; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(x0, y); x.lineTo(x1, y); x.stroke();
  for (let k = 0; k <= 3; k++) { const tx = x0 + (x1 - x0) * k / 3; x.lineWidth = k === 3 ? 2.5 : 1.5; x.beginPath(); x.moveTo(tx, y - (k === 3 ? 8 : 5)); x.lineTo(tx, y + 5); x.stroke(); }
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k], r = i === youI ? 7 : 5, px = x0 + (x1 - x0) * prog[i];
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(px, y, r + 1.5, 0, 6.2832); x.fill();
    x.fillStyle = ui.pinCol[i]; x.beginPath(); x.arc(px, y, r, 0, 6.2832); x.fill();
  }
}
// the cheer rings, centred on your slime's body: the white target ring and the Sprint-blue ring closing on it (k: the
// closing ring's size as a share of the target's; <= 0: no rings)
export function drawRings(ui, cx, cy, k, hit, was) {
  const c = ui.rings, x = c.getContext('2d'), d = ui.ringDpr;
  if (k <= 0 && !was) return false;
  x.setTransform(d, 0, 0, d, 0, 0);
  if (ui.lx !== undefined) x.clearRect(ui.lx - 80, ui.ly - 80, 160, 160);
  x.clearRect(cx - 80, cy - 80, 160, 160);
  ui.lx = cx; ui.ly = cy;
  if (k <= 0) return false;
  const R = 39;   // 78 pt across: 1.3 x the runner's body
  ring(x, cx, cy, R, 3, hit ? '#fff4c4' : RING.target);
  ring(x, cx, cy, R * k, 4, hit ? '#fff4c4' : RING.close);
  return true;
}
function ring(x, cx, cy, r, w, col) {
  x.lineWidth = w + 2; x.strokeStyle = RING.edge; x.beginPath(); x.arc(cx, cy, r, 0, 6.2832); x.stroke();
  x.lineWidth = w; x.strokeStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, 6.2832); x.stroke();
}
export function clearRings(ui) { const c = ui.rings; c.getContext('2d').setTransform(1, 0, 0, 1, 0, 0); c.getContext('2d').clearRect(0, 0, c.width, c.height); }

// the words in your lane, ahead of your slime: "Go, <name>!" (16 pt if long; "Go, go, go!" if still too long) and the
// first-race hint under it
export function showGo(ui, name, cx, cy, hint) {
  const W = RC().words, g = ui.go;
  g.classList.remove('small');
  g.textContent = W.go.replace('{name}', name);
  if (g.offsetWidth > 138) { g.classList.add('small'); if (g.offsetWidth > 138) g.textContent = W.goShort; }
  place(g, cx + 60, cy - 3 - 17);
  g.classList.add('on');
  ui.hint.textContent = hint ? W.ring : '';
  place(ui.hint, cx + 60, cy + 19 - 13);
  ui.hint.classList.toggle('on', !!hint);
}
export function hideGo(ui) { ui.go.classList.remove('on'); ui.hint.classList.remove('on'); }
export function showPop(ui, grade, cx, cy) {
  const p = ui.pop;
  p.className = 'rv-pop ' + grade;
  p.textContent = grade === 'none' ? '' : RC().words[grade];
  place(p, cx + 60, cy - 24);
  if (grade !== 'none') requestAnimationFrame(() => p.classList.add('on'));
}
export function hidePop(ui) { ui.pop.classList.remove('on'); }
export function showStamp(ui, grade, cx, cy) {
  ui.stamp.innerHTML = `${grade === 'S' ? ICON.sparkle : ''}${grade} · a natural`;
  place(ui.stamp, cx, cy - 70);
  ui.stamp.classList.add('on');
}
export function hideStamp(ui) { ui.stamp.classList.remove('on'); }
export function showPat(ui, name, cx, cy, on) {
  ui.pat.textContent = RC().words.pat.replace('{name}', name);
  place(ui.pat, cx, cy - 78);
  ui.pat.classList.toggle('on', !!on);
}
const place = (el, x, y) => { el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; };
export function setCaller(ui, text) { if (ui.caller.textContent !== text) ui.caller.textContent = text; }
// the name card: the name and the leg tag ("The hill · Sturdy ★★★")
export function setName(ui, name, line, stars) {
  ui.name.querySelector('b').textContent = name;
  ui.name.querySelector('span').innerHTML = stars === null ? esc(line) : `${esc(line)} <i>${STARS(stars)}</i>`;
}
export function legTag(race, k) {
  const L = race.legs[k], r = race.runners[0];
  return { line: `${L.name} · ${SKILL_BY_ID[L.skill]?.name || L.skill}`, stars: r.stars[k] };
}
export function setActs(ui, race, now, grades) {
  const html = race.legs.map((L, k) => `<div class="${grades[k] ? 'done' : k === now ? 'now' : ''}">${esc(L.short)}</div>`).join('');
  if (ui.acts.innerHTML !== html) ui.acts.innerHTML = html;
}
// the photo finish: the frozen frame in a mount, "fig. 1 · photo finish · <date>", the margin, the winner's chip
export function showPhoto(ui, race, from) {
  const s = ui.snap;
  s.width = from.width; s.height = Math.min(from.height, 150);
  const top = Math.max(0, Math.min(from.height - s.height, 300 + (from.height - 422) - s.height));
  s.getContext('2d').drawImage(from, 0, top, s.width, s.height, 0, 0, s.width, s.height);
  const d = new Date();
  ui.fig.textContent = `fig. 1 · photo finish · ${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
  ui.by.textContent = race.finish.margin.words;
  const w = race.runners[race.finish.winner];
  ui.won.textContent = `1st · ${w.short}`;
  ui.photo.classList.add('on');
}
export function hidePhoto(ui) { ui.photo.classList.remove('on'); }

// ---------- the race card (F1): hidden scores ----------
// rows: [{ you, name, line, grade, color }] (yours first); the faces go in after (fillFaces)
export function cardRowsHtml(rows) {
  return `<div class="rv-rows">${rows.map((r, i) => `<div class="rv-row${r.you ? ' me' : ''}"><span class="rv-noface" data-face="${i}" style="background:${esc(r.color || '#eef6e6')}"></span>
    <div class="rv-rt"><b>${esc(r.name)}</b><small>${r.lineHtml}</small></div>${r.grade ? `<span class="rv-grade">${esc(r.grade)}</span>` : ''}</div>`).join('')}</div>`;
}
// a rival's line: "Speed ★★★★★ · finishes strong" (the words and the stars in their own fonts)
export function rivalLineHtml(card) {
  return `${esc(SKILL_BY_ID[card.skill]?.name || card.skill)} <i>${STARS(card.stars)}</i> · ${esc(card.styleWord)}`;
}
export function fillFaces(root, arts) {
  for (const el of root.querySelectorAll('[data-face]')) {
    const a = arts[+el.dataset.face];
    if (!a || !a.face) continue;
    const c = document.createElement('canvas');
    c.width = 16; c.height = 14;
    c.getContext('2d').drawImage(a.face, 0, 0);
    el.replaceWith(c);
  }
}
export const raceButtons = () => `<div class="rv-two"><button class="btn" data-cs="close">Not now</button><button class="btn primary" data-cs="start" id="csStart">${cupIcon(CONTEST_BY_ID.sprint.color)}Race!</button></div>`;

// ---------- results (F8): no numbers ----------
export function resultHtml(res, race, x, { prizes, tip, act, cupArt }) {
  const name = esc(res.name), f = race.finish;
  if (res.won) {
    return `<div class="cs-win-art">${cupArt}</div>
      <h2 class="cs-big">${esc(CONTEST_BY_ID.sprint.name.split(' ').pop())} ${esc(res.cupName)}!</h2><p class="cs-sub">${name} won ${esc(f.margin.words)}</p>
      <p class="rv-how">How ${name} ran: ${esc(race.how.text)}</p>
      <div class="cs-prizes">${prizes}</div>
      <button class="btn primary" data-cs="ok">Yay!</button>`;
  }
  const sub = f.quiet ? `${ORD(f.place)} place` : `${ORD(f.place)}, ${esc(f.margin.words)}`;
  return `<h2 class="cs-big">Good try!</h2><p class="cs-sub">${sub}</p>
    <p class="rv-how">${esc(race.how.text)}</p>
    <div class="cs-tip"><div class="cs-head">${ICON.whistle || ''}<b>Coach's tip</b></div><p>${esc(tip)}</p></div>
    <div class="cs-two${act ? '' : ' one'}">${act}<button class="btn" data-cs="ok">Okay</button></div>`;
}
