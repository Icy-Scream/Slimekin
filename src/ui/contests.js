// Contest screens (C1b, from the approved mock-ups): the resident page's "Enter a contest" / "Dress up" row and its
// trophy line, the entry card (the three contests, the cup ladder, the next cup's rivals, the score before cheers and
// the coach's line), Dress up, the results cards (a loss with the coach's tip, a win with its prizes), the Ranch tab's
// Trophies half button and the Trophy Shelf. Rules: core/contests.js (scoreShow, applyShow, dressUp, ...); numbers and
// names: CONTESTS in content.js. The show itself on the barn's stand: contest-show.js. hud.js and ranch-life.js call in
// from a few marked places ([contests]); the elements are listed in UI-CHANGES.md "Contests (C1b)".
import { CONTESTS, CONTEST_BY_ID, CONTEST_IDS, OUTFITS, SKILL_BY_ID } from '../data/content.js';
import { scoreShow, canEnter, nextCup, trophiesOf, trophyCount, championsOf, styleOf, dressUp, shelfList, SLOTS } from '../core/contests.js';
import { gradeOf } from '../core/talents.js';
import { busy } from '../core/ranch-life.js';
import { ICON, cupIcon, blobIcon, memIcon } from './icons.js';
import { esc } from './esc.js';

const C = CONTESTS;
const SLOT_NAME = { head: 'Head', face: 'Face', neck: 'Neck' };
const SLOT_ORDER = ['head', 'face', 'neck'];   // Dress up's groups, top to bottom (any other slot after them)
const ORD = n => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
// a percent without a trailing ".0" (0.045 -> "4.5", 0.03 -> "3")
export const pct = v => String(Math.round(v * 1000) / 10);
const cupOf = (contest, cup, opts = {}) => cupIcon(CONTEST_BY_ID[contest].color, { tier: cup, champion: cup === C.cups.length, ...opts });
const mainAct = contest => CONTEST_BY_ID[contest].acts.find(a => a.role === 'main');
const skillName = id => SKILL_BY_ID[id]?.name || id;
const maxCheers = () => 3 * C.cheer.points.perfect;
const NUM_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];

const CSS = `
  :root { --cs-p: #6b4bd6; --cs-pt: #5b3fc4; --cs-soft: #f2edff; --cs-softline: #c7baf4; --cs-tip: #fff3d9; --cs-tipline: #f0cf7f; --cs-won: #1fa37a; --cs-line: #ebe2de; }
  :root[data-theme="dark"] { --cs-pt: #b9a6ff; --cs-soft: #2e2756; --cs-softline: #6552b8; --cs-tip: #3a2f4a; --cs-tipline: #a07f36; --cs-won: #5fe3b8; --cs-line: #362f5a; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --cs-pt: #b9a6ff; --cs-soft: #2e2756; --cs-softline: #6552b8; --cs-tip: #3a2f4a; --cs-tipline: #a07f36; --cs-won: #5fe3b8; --cs-line: #362f5a; } }
  .gi.cup { width: 24px; height: 24px; flex: none; color: var(--ink-2); } .gi.cup-2 { width: 29px; height: 29px; } .gi.cup-3 { width: 34px; height: 34px; } .gi.cup-4 { width: 37px; height: 37px; }
  .gi.blob { width: 22px; height: 22px; flex: none; }
  .cs-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; padding-left: 6px !important; padding-right: 6px !important; }
  .cs-btn .gi { width: 20px; height: 20px; }
  .cs-row2 { margin-top: 2px; }
  .cs-why { display: block; margin-top: 6px; grid-column: 1 / -1; }
  .cs-trophies { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .cs-trophies .gi.cup { width: 18px; height: 18px; }
  .cs-halves { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .cs-halves .btn { min-height: 52px; padding: 6px 8px; display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; }
  .cs-half .gi { width: 22px; height: 22px; flex: none; }
  .cs-half span { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; text-align: left; line-height: 1.2; }
  .cs-half b { font-size: 14px; white-space: nowrap; }
  .cs-half small { font-size: 11.5px; font-weight: 700; color: var(--ink-2); white-space: nowrap; }
  #modalCard.cs-modal { gap: 10px; }
  .cs-modal h2.cs-h { font-family: var(--body); font-weight: 800; font-size: 23px; }
  .cs-modal p.cs-p { font-size: 14px; line-height: 1.5; }
  .cs-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; padding: 4px; border-radius: 20px; background: var(--chip); }
  .cs-tab { border: 1.5px solid transparent; background: none; border-radius: 16px; padding: 6px 2px; font-weight: 800; font-size: 12.5px; color: var(--ink-2); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; white-space: nowrap; min-width: 0; }
  .cs-tab[aria-selected="true"] { background: var(--panel-strong); border-color: var(--cs-p); color: var(--ink); }
  .cs-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; display: inline-block; }
  .cs-cups { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
  .cs-cup { border: 1.2px solid var(--cs-line); background: var(--panel-strong); border-radius: 14px; min-height: 92px; padding: 8px 2px 6px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 3px; cursor: pointer; color: var(--ink); min-width: 0; }
  .cs-cup .cs-cupart { flex: 1; display: grid; place-items: center; }
  .cs-cup b { font-size: 12.5px; }
  .cs-cup .cs-st { font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 2px; }
  .cs-cup .cs-st .gi { width: 11px; height: 11px; }
  .cs-cup .won { color: var(--cs-won); } .cs-cup .next { color: var(--cs-pt); } .cs-cup .locked { color: var(--ink-2); font-weight: 600; font-size: 10px; }
  .cs-cup[aria-pressed="true"] { background: var(--cs-soft); border: 1.8px solid var(--cs-p); }
  .cs-cup:disabled { cursor: default; }
  .cs-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .cs-head b { font-size: 15px; } .cs-pt { color: var(--cs-pt); font-weight: 800; font-size: 13px; white-space: nowrap; }
  .cs-rivals { display: flex; flex-direction: column; gap: 4px; }
  .cs-rival { display: flex; align-items: center; gap: 8px; font-size: 14px; min-height: 27px; }
  .cs-rival span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cs-rival b { font-size: 15px; font-variant-numeric: tabular-nums; }
  .cs-mine { border-radius: 16px; background: var(--cs-soft); border: 1.2px solid var(--cs-softline); padding: 11px 14px; display: flex; flex-direction: column; gap: 5px; }
  .cs-mine .cs-head b { font-size: 16px; }
  .cs-mine .cs-score { display: inline-flex; align-items: baseline; gap: 6px; } .cs-mine .cs-score small { font-size: 11.5px; color: var(--ink-2); font-weight: 600; }
  .cs-mine .cs-score b { font-size: 22px; color: var(--cs-pt); font-variant-numeric: tabular-nums; }
  .cs-parts { font-size: 12.5px; color: var(--ink); line-height: 1.4; }
  .cs-coach { font-size: 12.5px; font-weight: 800; color: var(--cs-pt); line-height: 1.4; }
  .cs-free { font-size: 12.5px !important; line-height: 1.5 !important; }
  .cs-modal .btn { min-height: 44px; }
  .cs-modal .btn .gi { width: 20px; height: 20px; vertical-align: -5px; margin-right: 5px; }
  .cs-meter { border-radius: 16px; background: var(--cs-soft); border: 1.2px solid var(--cs-softline); padding: 10px 14px 12px; display: flex; flex-direction: column; gap: 8px; }
  .cs-meter .cs-head b { font-size: 15.5px; } .cs-meter .sub { font-size: 12px; }
  .cs-bar { height: 10px; border-radius: 5px; background: var(--chip); overflow: hidden; } .cs-bar i { display: block; height: 100%; border-radius: 5px; background: var(--cs-p); }
  .cs-group { font-weight: 800; font-size: 13.5px; color: var(--ink-2); margin: 2px 0 -4px; }
  .cs-outfit { display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 3px 9px 3px 8px; border-radius: 13px; border: 1px solid var(--cs-line); background: var(--panel-strong); color: var(--ink); text-align: left; font: inherit; width: 100%; box-sizing: border-box; }
  button.cs-outfit { cursor: pointer; }
  .cs-outfit.on { background: var(--cs-soft); border: 1.6px solid var(--cs-p); }
  .cs-outfit .cs-oic { width: 30px; height: 30px; flex: none; display: grid; place-items: center; }
  .cs-outfit .cs-oic img { width: 30px; height: 30px; }
  .cs-outfit b { font-size: 14px; white-space: nowrap; } .cs-outfit .sub { flex: 1; white-space: nowrap; }
  .cs-outfit.not .cs-oic, .cs-outfit.not b { opacity: .45; } .cs-outfit.not b { opacity: .7; color: var(--ink-2); }
  .cs-chip { flex: none; border-radius: 12px; padding: 3px 12px; font-weight: 800; font-size: 12px; background: var(--chip); border: 1px solid var(--edge); display: inline-flex; align-items: center; gap: 4px; }
  .cs-chip.on { background: var(--cs-p); color: #fff; border-color: transparent; } .cs-chip .gi { width: 12px; height: 12px; }
  .cs-res { align-items: stretch; }
  .cs-res h2.cs-big { font-family: var(--display); font-weight: 700; font-size: 30px; text-align: center; }
  .cs-res .cs-sub { text-align: center; font-weight: 800; font-size: 15px; color: var(--ink-2); margin: -6px 0 0; }
  .cs-board { display: flex; flex-direction: column; gap: 2px; }
  .cs-line { display: flex; align-items: center; gap: 9px; padding: 3px 12px; min-height: 26px; border-radius: 12px; border: 1px solid transparent; font-size: 13.5px; }
  .cs-line .n { width: 14px; text-align: center; font-weight: 800; color: var(--ink-2); } .cs-line .nm { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cs-line b { font-size: 15px; font-variant-numeric: tabular-nums; }
  .cs-line.me { background: var(--cs-soft); border-color: var(--cs-softline); } .cs-line.me .n, .cs-line.me b { color: var(--cs-pt); } .cs-line.me .nm { font-weight: 800; }
  .cs-res .cs-parts { text-align: center; color: var(--ink-2); font-size: 12.5px; }
  .cs-tip { border-radius: 16px; background: var(--cs-tip); border: 1.4px solid var(--cs-tipline); padding: 11px 14px 12px; display: flex; flex-direction: column; gap: 6px; }
  .cs-tip .cs-head { justify-content: flex-start; align-items: center; } .cs-tip .gi { width: 20px; height: 20px; }
  .cs-tip p { color: var(--ink) !important; font-weight: 700; font-size: 14px !important; line-height: 1.5 !important; }
  .cs-two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .cs-two.one { grid-template-columns: 1fr; }
  .cs-win-art { position: relative; height: 92px; display: grid; place-items: center; }
  .cs-win-art .gi.cup { width: 74px; height: 74px; }
  .cs-win-art .sp { position: absolute; width: 14px; height: 14px; } .cs-win-art .sp .gi { width: 100%; height: 100%; }
  .cs-prizes { border-radius: 16px; border: 1.2px solid var(--cs-line); padding: 8px 12px; display: flex; flex-direction: column; gap: 4px; }
  .cs-prize { display: flex; align-items: center; gap: 12px; min-height: 44px; }
  .cs-prize .ic { width: 26px; display: grid; place-items: center; flex: none; } .cs-prize .ic .gi.cup { width: 22px; height: 22px; } .cs-prize .ic .pearl { width: 18px; height: 18px; }
  .cs-prize span { display: flex; flex-direction: column; min-width: 0; } .cs-prize b { font-size: 14.5px; } .cs-prize small { font-size: 12.5px; color: var(--ink-2); }
  .cs-shelf-h { display: flex; align-items: center; gap: 7px; margin-top: 4px; } .cs-shelf-h b { font-size: 15px; flex: 1; }
  .cs-shelf-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
  .cs-shelf-row > div { border: 1.2px solid var(--cs-line); background: var(--panel-strong); border-radius: 14px; min-height: 96px; padding: 8px 2px 7px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 3px; min-width: 0; }
  .cs-shelf-row .cs-cupart { flex: 1; display: grid; place-items: center; }
  .cs-shelf-row b { font-size: 12.5px; } .cs-shelf-row small { font-size: 11.5px; color: var(--ink-2); max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cs-shelf-row small.who { color: var(--cs-pt); font-weight: 700; }`;

export class ContestsUI {
  constructor(game) {
    this.g = game;
    if (typeof document !== 'undefined' && !document.getElementById('contestsCss')) {
      const css = document.createElement('style');
      css.id = 'contestsCss';
      css.textContent = CSS;
      document.head.appendChild(css);
    }
  }
  get state() { return this.g.state; }
  resident(id) { return this.g.sim.ranch.resident(id); }
  // the color of a resident's body (its little blob on the results cards): the one on the stand, else a pale slime
  colorOf(id) {
    const b = this.g.barnRanch;
    try { if (b && b.curId === id && !b.view.empty) return '#' + b.view.av.mat.color.getHexString(); } catch { /* not built */ }
    return '#f4efe9';
  }

  // ---------- hud hooks ----------
  // Resident page: the second row under Train / Send on a trip. Hidden on a trip; in a lesson "Enter a contest" waits.
  residentRow(x) {
    if (!x || x.trip) return '';
    const id = esc(x.id), lesson = busy(x) === 'lesson';
    return `<div class="res cs-row2"><div class="acts"><button class="btn cs-btn" data-cs="enter" data-id="${id}" ${lesson ? 'disabled aria-disabled="true"' : ''}>${cupOf('beauty', 1)}Enter a contest</button><button class="btn cs-btn" data-cs="dress" data-id="${id}">${ICON.bow}Dress up</button></div>${lesson ? `<span class="sub cs-why">Contests wait until the lesson ends.</span>` : ''}</div>`;
  }
  // Resident page, beside the medal line: its cups, its TOTAL trophy bonus and its Champion perks ('' with no trophies).
  residentLine(x) {
    const n = trophyCount(x);
    if (!n) return '';
    const t = trophiesOf(x), name = esc(x.name);
    const cups = CONTEST_IDS.flatMap(c => Array.from({ length: t[c] }, (_, i) => cupOf(c, i + 1))).join('');
    const perks = championsOf(x).map(c => `<span class="sub cs-perk"><b>${esc(CONTEST_BY_ID[c].title)}:</b> ${esc(this.perkText(c, x.name))}.</span>`).join('');
    return `<span class="sub cs-trophies" aria-label="${n} trophies">${cups}<span>${n} troph${n === 1 ? 'y' : 'ies'}: buyers pay +${pct(C.trophyValue * n)}% for ${name}</span></span>${perks}`;
  }
  perkText(contest, name) {
    const p = C.perks[contest] || {};
    if (p.offers) return `buyers pay ${pct(p.offers)}% more for ${name}`;
    if (p.tripTime) return `${name}'s trips are ${pct(p.tripTime)}% shorter`;
    if (p.pearls) return `${name} makes ${pct(p.pearls)}% more pearls`;
    return '';
  }
  // Ranch tab: the Trophies half button beside Souvenirs (the Trophy Shelf: the ranch's first win of each cup)
  ranchHalf() {
    const sh = this.shelfCounts();
    return `<button class="btn cs-half" data-cs="shelf">${memIcon('🏆', '')}<span><b>Trophies ${sh.won} / ${sh.total}</b><small>Champions ${sh.champs} / ${CONTEST_IDS.length}</small></span></button>`;
  }
  shelfCounts() {
    const list = shelfList(this.state);
    return { won: list.filter(s => s.winner).length, total: list.length, champs: list.filter(s => s.winner && s.cup === C.cups.length).length };
  }
  click(b) {
    const k = b.dataset.cs, id = b.dataset.id;
    this.g.sfx.unlock && this.g.sfx.unlock();
    if (k === 'enter') this.openEntry(id);
    else if (k === 'dress') this.openDress(id);
    else if (k === 'shelf') this.openShelf();
  }

  // ---------- the entry card ----------
  // contest: the tab (default: the last one used, else the Beauty Show); cup: the cup picked (default: the next one)
  openEntry(id, contest = null, cup = null) {
    const g = this.g, x = this.resident(id);
    if (!x) return false;
    const why = busy(x);
    if (why) { g.life && g.life.refuse && g.sfx.error && g.sfx.error(); return false; }
    contest = CONTEST_BY_ID[contest] ? contest : (this.lastContest && CONTEST_BY_ID[this.lastContest] ? this.lastContest : CONTEST_IDS[0]);
    this.lastContest = contest;
    const next = nextCup(x, contest), won = trophiesOf(x)[contest];
    cup = Number.isInteger(cup) && cup >= 1 && cup <= next ? cup : next;
    const name = esc(x.name), def = CONTEST_BY_ID[contest], cupDef = C.cups[cup - 1];
    const tabs = CONTEST_IDS.map(c => `<button class="cs-tab" role="tab" data-cs="tab" data-contest="${c}" aria-selected="${c === contest}"><i class="cs-dot" style="background:${CONTEST_BY_ID[c].color}"></i>${esc(CONTEST_BY_ID[c].name)}</button>`).join('');
    const cups = C.cups.map((cd, i) => {
      const n = i + 1, isWon = n <= won, open = n <= next;
      const st = isWon ? `<span class="cs-st won">${ICON.check}Won</span>` : n === next ? '<span class="cs-st next">Next</span>' : `<span class="cs-st locked">${n === C.cups.length ? 'Naturals only' : 'Not yet'}</span>`;
      return `<button class="cs-cup" data-cs="cup" data-cup="${n}" aria-pressed="${n === cup}" ${open ? '' : 'disabled'} aria-label="${esc(cd.name)}${isWon ? ', won' : n === next ? ', next' : ', not open yet'}"><span class="cs-cupart">${cupOf(contest, n, { ghost: !isWon && n !== next })}</span><b>${esc(cd.short)}</b>${st}</button>`;
    }).join('');
    const rivals = [...cupDef.rivals].sort((a, b) => a.score - b.score);
    const top = rivals[rivals.length - 1].score;
    const pv = scoreShow(this.state, id, contest, { cup, cheers: 'none', reducedMotion: !!g.reduced });
    const parts = this.partsLine(pv, { natural: true });
    const style = def.acts.some(a => a.style);
    const sty = Math.min(C.score.styleCap, styleOf(x.worn));
    const html = `<h2 class="cs-h">Enter a contest</h2><p class="cs-p">${name} performs on the barn stand. You cheer three times.</p>
      <div class="cs-tabs" role="tablist" aria-label="Contests">${tabs}</div>
      <div class="cs-cups">${cups}</div>
      <div class="cs-head"><b>${esc(cupDef.name)} rivals</b><span class="cs-pt">To win: beat ${top}</span></div>
      <div class="cs-rivals">${rivals.map(r => `<div class="cs-rival">${blobIcon(r.color || '#ffc9a3')}<span>${esc(r.name)}</span><b>${r.score}</b></div>`).join('')}</div>
      <div class="cs-mine"><div class="cs-head"><b>${name}</b><span class="cs-score"><small>before cheers</small><b id="csBase">${pv.score - pv.cheers}</b></span></div>
        <span class="cs-parts">${esc(parts)}</span><span class="cs-coach" id="csCoach">${esc(this.coachLine(x, contest, cup, pv))}</span></div>
      ${style ? `<button class="btn cs-dressup" data-cs="dressFrom">${ICON.bow}Dress up · Style ${sty} of ${C.score.styleCap}</button>` : ''}
      <p class="cs-p cs-free">Shows are free and always open. Pearls come with a first win; repeats are for fun.</p>
      <button class="btn primary" data-cs="start" id="csStart">Start the show</button>
      <button class="btn" data-cs="close">Not now</button>`;
    this.open(html, 'entry', card => {
      for (const b of card.querySelectorAll('[data-cs]')) b.addEventListener('click', () => {
        if (b.disabled) return;
        const k = b.dataset.cs;
        if (k === 'tab') { g.sfx.plip && g.sfx.plip(); this.openEntry(id, b.dataset.contest); }
        else if (k === 'cup') { g.sfx.plip && g.sfx.plip(); this.openEntry(id, contest, +b.dataset.cup); }
        else if (k === 'dressFrom') this.openDress(id, { back: () => this.openEntry(id, contest, cup) });
        else if (k === 'start') { g.hud.closeModal(); g.contestShow.start(id, contest, cup); }
        else if (k === 'close') g.hud.closeModal();
      });
    });
    this.entry = { id, contest, cup };
    return true;
  }
  // the parts of a score: "Pose 50 · Natural +6 · Style 0 · Tricks 12 · Mood 4" (natural: flair on its own, as on the
  // entry card; else folded into the main act, as on the results cards) [+ " · Cheers 6"]
  partsLine(res, { natural = false, cheers = false } = {}) {
    const def = CONTEST_BY_ID[res.contest], out = [];
    def.acts.forEach((a, i) => {
      const p = res.acts[i].points + (!natural && a.role === 'main' ? res.flair.points : 0);
      out.push(`${a.short} ${p}`);
      if (natural && a.role === 'main' && res.flair.points > 0) out.push(`Natural +${res.flair.points}`);
    });
    out.push(`Mood ${res.mood}`);
    if (cheers) out.push(`Cheers ${res.cheers}`);
    return out.join(' · ');
  }
  // The coach's line on the entry card, from the rules' own preview: what cheers can still do, else the coach's tip with
  // the best cheers (the rules' closest single gap).
  coachLine(x, contest, cup, pv) {
    const base = pv.score - pv.cheers, top = pv.top, need = top - base, max = maxCheers(), P = C.cheer.points;
    if (this.g.reduced) return need <= 3 * P[C.cheer.reduced] ? `Cheers add ${3 * P[C.cheer.reduced]} with Reduced motion: that wins this one.` : `Cheers add ${3 * P[C.cheer.reduced]} with Reduced motion. ${this.tipShort(scoreShow(this.state, x.id, contest, { cup, cheers: 'perfect', reducedMotion: true }).tip, x)}`;
    if (need <= 0) return `${x.name} can win this one! Cheers add up to ${max} more.`;
    if (need <= 3 * P.nice) return `Cheers add up to ${max}. Any cheers win this one.`;
    if (need <= 3 * P.good) return `Cheers add up to ${max}. Good cheers win this one.`;
    if (need <= max) return `Cheers add up to ${max}. Perfect cheers win this one.`;
    const best = scoreShow(this.state, x.id, contest, { cup, cheers: 'perfect' });
    return `Cheers add up to ${max}. ${this.tipShort(best.tip, x)}`;
  }
  tipShort(tip, x) {
    if (!tip) return '';
    if (tip.kind === 'style') return 'Dress up to win this one.';
    if (tip.kind === 'skill') return tip.partial ? `Train ${skillName(tip.skill)} first.` : `${tip.text} would win it.`;
    if (tip.kind === 'talent') return `This cup needs a natural at ${skillName(tip.skill)}.`;
    return tip.text;
  }
  // The coach's tip card after a loss: the rules' tip (core/contests.js coachTip) said the mock-ups' way.
  tipText(tip, x) {
    const name = x.name;
    if (!tip) return '';
    if (tip.kind === 'cheers') return `${tip.text} Tap right when the pink ring meets the gold one.`;
    if (tip.kind === 'style') return `Dress ${name} up! Outfits add Style, and ${tip.gap} more Style would have won it.`;
    if (tip.kind === 'skill') return tip.partial ? `${tip.text}: ${name} can learn more ${skillName(tip.skill)} at the Training Center.` : `${tip.text} would have won it. ${name} can learn them at the Training Center.`;
    if (tip.kind === 'talent') return `${tip.text}. Every slime can win the Grand Cups; a Champion Cup takes a natural.`;
    return tip.text;
  }

  // ---------- results ----------
  // res: scoreShow's result (applied once by the show); given: what applyShow brought (pearls, trophy, shelf, ...)
  showResult(res, given, { onClose } = {}) {
    const g = this.g, x = this.resident(res.id) || { id: res.id, name: res.name };
    const html = res.won ? this.winHtml(res, given, x) : this.lossHtml(res, x);
    this.open(html, 'result', card => {
      for (const b of card.querySelectorAll('[data-cs]')) b.addEventListener('click', () => {
        const k = b.dataset.cs;
        g.hud.closeModal();
        if (k === 'tipDress') this.openDress(res.id, { back: () => this.openEntry(res.id, res.contest, res.cup) });
        else if (k === 'tipTrain') g.life.openTrain(res.id);
        else if (k === 'again') this.openEntry(res.id, res.contest, res.cup);
      });
    });
    g.hud.onModalClose = onClose || null;
  }
  boardHtml(res, rows) {
    return `<div class="cs-board">${rows.map((r, i) => `<div class="cs-line${r.me ? ' me' : ''}"><span class="n">${i + 1}</span>${blobIcon(r.color)}<span class="nm">${esc(r.name)}</span><b>${r.score}</b></div>`).join('')}</div>`;
  }
  rowsOf(res) {
    const me = { me: true, name: res.name, score: res.score, color: this.colorOf(res.id) };
    const rv = res.rivals.map(r => ({ name: r.name, score: r.score, color: r.color || '#ffc9a3' }));
    // a tie goes to your slime: it is listed above a rival with the same score
    return [me, ...rv].sort((a, b) => b.score - a.score || (b.me ? 1 : 0) - (a.me ? 1 : 0));
  }
  lossHtml(res, x) {
    const tip = res.tip || {};
    const act = tip.kind === 'style' ? '<button class="btn primary" data-cs="tipDress">Dress up</button>'
      : tip.kind === 'skill' && !busy(x) ? '<button class="btn primary" data-cs="tipTrain">Train</button>'
      : tip.kind === 'cheers' ? '<button class="btn primary" data-cs="again">Try again</button>' : '';
    return `<h2 class="cs-big">Good try!</h2><p class="cs-sub">${ORD(res.place)} place in the ${esc(res.cupName)}</p>
      ${this.boardHtml(res, this.rowsOf(res))}
      <p class="cs-parts">${esc(this.partsLine(res, { cheers: true }))}</p>
      <div class="cs-tip"><div class="cs-head">${ICON.whistle}<b>Coach's tip</b></div><p>${esc(this.tipText(tip, x))}</p></div>
      <div class="cs-two${act ? '' : ' one'}">${act}<button class="btn" data-cs="ok">Okay</button></div>`;
  }
  winHtml(res, given, x) {
    const name = esc(res.name), cupN = res.cup, last = cupN === C.cups.length;
    const rows = this.rowsOf(res).slice(0, 2);
    const sp = [[16, 18, '#ffd14d', 10], [78, 10, '#ff8fbf', 12], [8, 64, '#8fd7ff', 8], [86, 66, '#b6e36a', 9], [30, 80, '#ff8fbf', 7], [70, 86, '#ffd14d', 8]]
      .map(([l, t, c, s]) => `<i class="sp" style="left:${l}%;top:${t}%;width:${s * 1.4}px;height:${s * 1.4}px;color:${c}"><svg class="gi" viewBox="0 0 24 24"><path d="M12 1.8c.7 4.6 2.2 6.4 6.6 7.4.4.1.4.7 0 .8-4.4 1-5.9 2.8-6.6 7.4-.1.5-.7.5-.8 0-.7-4.6-2.2-6.4-6.6-7.4-.4-.1-.4-.7 0-.8 4.4-1 5.9-2.8 6.6-7.4.1-.5.7-.5.8 0z" fill="currentColor"/></svg></i>`).join('');
    const prizes = [];
    const ic = h => `<span class="ic">${h}</span>`;
    if (given && given.trophy) {
      if (given.pearls) prizes.push(`<div class="cs-prize">${ic('<i class="pearl"></i>')}<span><b>+${given.pearls} pearls</b><small>${name}'s first ${esc(res.cupName)}</small></span></div>`);
      const n = trophyCount(x);
      prizes.push(`<div class="cs-prize">${ic(cupOf(res.contest, cupN))}<span><b>A trophy for ${name}</b><small>Buyers pay ${pct(C.trophyValue * n)}% more for ${name}</small></span></div>`);
      if (given.shelf) prizes.push(`<div class="cs-prize">${ic(ICON.sparkle)}<span><b>First on the Trophy Shelf</b><small>The ranch's first ${esc(res.cupName)} in the ${esc(res.contestName)}</small></span></div>`);
      if (last) {
        const title = given.title || CONTEST_BY_ID[res.contest].title;
        prizes.push(`<div class="cs-prize">${ic(cupOf(res.contest, cupN))}<span><b>${esc(title)}!</b><small>${esc(this.perkText(res.contest, res.name))}</small></span></div>`);
      } else {
        const nx = C.cups[cupN], main = mainAct(res.contest).skill;
        const sub = cupN + 1 === C.cups.length ? (['A', 'S'].includes(gradeOf(x, main)) ? `${res.name} is a natural at ${skillName(main)}` : `It takes a natural at ${skillName(main)}`) : `Rivals up to ${Math.max(...nx.rivals.map(r => r.score))}`;
        prizes.push(`<div class="cs-prize">${ic(cupOf(res.contest, cupN + 1))}<span><b>${esc(nx.name)} is open</b><small>${esc(sub)}</small></span></div>`);
      }
    } else {
      prizes.push(`<div class="cs-prize">${ic(cupOf(res.contest, cupN))}<span><b>Won again!</b><small>${name} already has this cup: repeats are for fun.</small></span></div>`);
    }
    return `<div class="cs-win-art">${sp}${cupOf(res.contest, cupN)}</div>
      <h2 class="cs-big">${esc(res.cupName)}!</h2><p class="cs-sub">${name} won the ${esc(res.contestName)}${given && given.trophy ? '' : ' again'}</p>
      ${this.boardHtml(res, rows)}
      <p class="cs-parts">${esc(this.partsLine(res, { cheers: true }))}</p>
      <div class="cs-prizes">${prizes.join('')}</div>
      <button class="btn primary" data-cs="ok">Yay!</button>`;
  }

  // ---------- Dress up ----------
  // back: what Done (or closing) goes back to (the entry card it came from), or nothing
  openDress(id, { back = null } = {}) {
    const g = this.g, x = this.resident(id);
    if (!x) return false;
    if (busy(x) === 'away') return false;
    // the slime being dressed comes up on the stand, so you see its outfits change
    if (g.barnRanch && g.barnRanch.active && g.barnRanch.curId !== id) g.barnRanch.show(id);
    const owned = new Set(this.state.outfits.owned || []), worn = x.worn || {};
    const style = styleOf(worn), cap = C.score.styleCap, name = esc(x.name);
    const rank = o => (worn[o.slot] === o.id ? 0 : owned.has(o.id) ? 1 : 2);
    const slots = [...SLOT_ORDER.filter(s => SLOTS.includes(s)), ...SLOTS.filter(s => !SLOT_ORDER.includes(s))];
    const groups = slots.map(slot => {
      const list = OUTFITS.filter(o => o.slot === slot).map((o, i) => ({ o, i })).sort((a, b) => rank(a.o) - rank(b.o) || a.i - b.i).map(({ o }) => {
        const on = worn[slot] === o.id, have = owned.has(o.id), st = `+${C.style[o.id] || 0} Style`;
        const icon = `<span class="cs-oic">${g.hud.icon(o.id, o.name).replace('<span style="font-size:30px;line-height:1"', '<span style="font-size:22px;line-height:1"')}</span>`;
        if (!have) return `<div class="cs-outfit not">${icon}<b>${esc(o.name)}</b><span class="sub">${st}</span><span class="sub" style="flex:none">In Outfits</span></div>`;
        return `<button class="cs-outfit${on ? ' on' : ''}" data-cs="wear" data-slot="${slot}" data-outfit="${o.id}" aria-pressed="${on}">${icon}<b>${esc(o.name)}</b><span class="sub">${st}</span><span class="cs-chip${on ? ' on' : ''}">${on ? `${ICON.check}Wearing` : 'Wear'}</span></button>`;
      }).join('');
      return `<div class="cs-group">${SLOT_NAME[slot] || slot}</div>${list}`;
    }).join('');
    const html = `<h2 class="cs-h">Dress up ${name}</h2><p class="cs-p">Outfits your family owns. ${name} wears them on the ranch and in shows. One per spot.</p>
      <div class="cs-meter"><div class="cs-head"><b>Style ${Math.min(style, cap)} of ${cap}</b><span class="sub">counts in the Beauty Show</span></div><div class="cs-bar"><i style="width:${(Math.min(style, cap) / cap * 100).toFixed(0)}%"></i></div></div>
      ${groups}<button class="btn primary" data-cs="done">Done</button>`;
    this.open(html, 'dress', card => {
      for (const b of card.querySelectorAll('[data-cs]')) b.addEventListener('click', () => {
        if (b.dataset.cs === 'done') { g.hud.closeModal(); return; }
        const slot = b.dataset.slot, oid = b.dataset.outfit, on = (x.worn || {})[slot] === oid;
        const r = dressUp(this.state, id, slot, on ? null : oid);
        if (!r.ok) { g.sfx.error && g.sfx.error(); return; }
        g.sfx.plip && g.sfx.plip();
        this.applyLook(id);
        g.markDirty(true); g.saveNow();
        const keep = g.hud.onModalClose; g.hud.onModalClose = null;
        this.openDress(id, { back });
        g.hud.onModalClose = keep;
      });
    });
    g.hud.onModalClose = back ? () => back() : null;
    return true;
  }
  // the resident's 3D look follows what it wears: the stand (when it is on it) and its hidden ranch avatar
  applyLook(id) {
    const g = this.g, x = this.resident(id);
    if (!x) return;
    const b = g.barnRanch;
    if (b && b.curId === id && !b.view.empty) b.view.av.setOutfits(x.worn || {});
    const r = g.ranch && g.ranch.resident && g.ranch.resident(id);
    if (r && r.av && r.av.setOutfits) r.av.setOutfits(x.worn || {});
    g.hud.renderRanch(true);
  }

  // ---------- the Trophy Shelf ----------
  openShelf() {
    const g = this.g, list = shelfList(this.state), sh = this.shelfCounts();
    const sections = CONTEST_IDS.map(c => {
      const def = CONTEST_BY_ID[c], spots = list.filter(s => s.contest === c);
      const champ = spots[spots.length - 1].winner;
      const tiles = spots.map(s => `<div>${'<span class="cs-cupart">' + cupOf(c, s.cup, { ghost: !s.winner }) + '</span>'}<b>${esc(C.cups[s.cup - 1].short)}</b>${s.winner ? `<small class="who">${esc(s.winner.name)}</small>` : '<small>Not yet</small>'}</div>`).join('');
      return `<div class="cs-shelf-h"><i class="cs-dot" style="background:${def.color}"></i><b>${esc(def.name)}</b>${champ ? `<span class="cs-pt">Champion: ${esc(champ.name)}</span>` : ''}</div><div class="cs-shelf-row">${tiles}</div>`;
    }).join('');
    const html = `<h2 class="cs-h">Trophy Shelf ${sh.won} / ${sh.total}</h2><p class="cs-p">The first time any slime on your ranch wins a cup, it goes on the shelf. Champions ${sh.champs} / ${CONTEST_IDS.length}.</p>
      ${sections}<button class="btn primary" data-cs="done">Done</button>`;
    this.open(html, 'shelf', card => card.querySelector('[data-cs="done"]').addEventListener('click', () => g.hud.closeModal()));
  }

  // one modal for every contest card (the card gets the cs-modal class while it shows one)
  open(html, kind, onOpen) {
    const g = this.g, card = document.getElementById('modalCard');
    g.hud.openModal(`<div hidden data-cs-card="${kind}"></div>${html}`, { onOpen: c => { c.classList.add('cs-modal'); c.classList.toggle('cs-res', kind === 'result'); onOpen && onOpen(c); } });
    if (!this.watching && card) {
      this.watching = true;
      // the next modal that is not a contest card gets the plain look back
      new MutationObserver(() => { if (!card.querySelector('[data-cs-card]')) card.classList.remove('cs-modal', 'cs-res'); }).observe(card, { childList: true });
    }
  }
}
