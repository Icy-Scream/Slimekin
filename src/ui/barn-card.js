// The Barn ranch's name card and its ‹ › buttons (on top of the barn, under the menu sheet). The card shows the
// resident on the stand: its name, its body's name and one short line, and dots for up to BARN.dots residents
// ("3 of 12" beyond that). Tapping the card opens that resident's page; a quick sideways swipe on it swaps like a swipe
// on the barn. The coordinator (barn-ranch.js) fills it and places it above the menu sheet or the ranch bar every frame.
// Listed in UI-CHANGES.md "Barn ranch".
import { ICON } from './icons.js';
import { swipeDir } from '../view/barn-math.js';

const stamp = e => (e && e.timeStamp > 0 ? e.timeStamp : performance.now());   // the touch's own time (ms)

const CSS = `
  .barn-card { position: fixed; left: 50%; bottom: 120px; transform: translateX(-50%); z-index: 7; box-sizing: border-box;
    width: min(340px, calc(100vw - 32px)); padding: 9px 16px 9px; border-radius: 22px; text-align: center; color: var(--ink);
    cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; }
  .barn-card:focus-visible { outline: 3px solid var(--gel); outline-offset: 2px; }
  .barn-card b { display: block; font-family: var(--display); font-weight: 700; font-size: 22px; line-height: 1.15;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .barn-card .bc-line { display: block; margin-top: 1px; font-weight: 800; font-size: 13px; color: var(--ink-2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .barn-card .bc-line .st { color: var(--honey, #e0a526); letter-spacing: 1px; }
  .barn-card .bc-dots { display: flex; gap: 7px; justify-content: center; margin-top: 7px; height: 8px; }
  .barn-card .bc-dots u { width: 8px; height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--ink-2) 32%, transparent); transition: width .2s; }
  .barn-card .bc-dots u.on { width: 18px; background: #6b4bd6; }
  .barn-card .bc-count { display: block; margin-top: 4px; font-weight: 800; font-size: 12px; color: var(--ink-2); }
  .barn-card.empty b { font-size: 19px; }
  .barn-card.empty .bc-line { white-space: normal; font-size: 12.5px; line-height: 1.3; }
  .barn-arrow { position: fixed; top: 44%; z-index: 7; width: 44px; height: 44px; margin-top: -22px; padding: 0; border-radius: 22px;
    display: grid; place-items: center; cursor: pointer; color: inherit; }
  .barn-arrow .gi { width: 22px; height: 22px; }
  .barn-arrow:active { transform: scale(.94); }
  #barnPrev { left: 10px; } #barnNext { right: 10px; }
  .barn-card[hidden], .barn-arrow[hidden] { display: none; }
  .barn-wait { position: fixed; left: 50%; top: 96px; transform: translateX(-50%); z-index: 8; display: flex; align-items: center;
    gap: 9px; padding: 9px 18px 9px 14px; border-radius: 22px; font-family: var(--display); font-weight: 700; font-size: 17px;
    color: var(--ink); white-space: nowrap; pointer-events: none; animation: bw-in .25s ease-out; }
  .barn-wait svg { width: 22px; height: 22px; fill: #6b4bd6; flex: none; }
  .barn-wait .bw-dots { display: inline-flex; gap: 4px; margin-left: 1px; }
  .barn-wait .bw-dots u { width: 6px; height: 6px; border-radius: 3px; background: #6b4bd6; opacity: .35; animation: bw-dot 1.1s ease-in-out infinite; }
  .barn-wait .bw-dots u:nth-child(2) { animation-delay: .16s; } .barn-wait .bw-dots u:nth-child(3) { animation-delay: .32s; }
  .barn-wait.still, .barn-wait.still .bw-dots u { animation: none; } .barn-wait.still .bw-dots u { opacity: .7; }
  @keyframes bw-dot { 0%, 70%, 100% { transform: translateY(0); opacity: .35; } 35% { transform: translateY(-4px); opacity: 1; } }
  @keyframes bw-in { from { opacity: 0; transform: translate(-50%, -6px); } }
  .barn-wait[hidden] { display: none; }`;
function addCss() {
  if (document.getElementById('barnCss')) return;
  const css = document.createElement('style');
  css.id = 'barnCss';
  css.textContent = CSS;
  document.head.appendChild(css);
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class BarnCard {
  // on: { prev(), next(), open(), swipe(dir) }
  constructor(on) {
    this.on = on;
    addCss();
    const card = this.el = document.createElement('div');
    card.id = 'barnCard';
    card.className = 'barn-card glass';
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.hidden = true;
    document.body.appendChild(card);
    let down = null;
    card.addEventListener('pointerdown', e => { down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: stamp(e) }; try { card.setPointerCapture(e.pointerId); } catch { /* ignore */ } });
    card.addEventListener('pointerup', e => {
      const d = down; down = null;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y, dir = swipeDir(dx, dy, stamp(e) - d.t);
      if (dir) this.on.swipe(dir);
      else if (Math.hypot(dx, dy) < 12) this.on.open();
    });
    card.addEventListener('pointercancel', () => { down = null; });
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.on.open(); } });
    this.arrows = [['barnPrev', 'chevronLeft', 'Previous slime', () => this.on.prev()], ['barnNext', 'chevronRight', 'Next slime', () => this.on.next()]].map(([id, icon, label, fn]) => {
      const b = document.createElement('button');
      b.id = id; b.className = 'barn-arrow glass'; b.type = 'button';
      b.innerHTML = ICON[icon];
      b.setAttribute('aria-label', label);
      b.hidden = true;
      b.addEventListener('click', e => { e.stopPropagation(); fn(); });
      document.body.appendChild(b);
      return b;
    });
    this.key = '';
  }
  show(on) { this.el.hidden = !on; this.showArrows(on && this.many); }
  showArrows(on) { for (const b of this.arrows) b.hidden = !on; }
  // c: { name, breed, line, stars, count: { dots, on, text } } for a resident, or { empty: true, title, text }
  set(c) {
    const key = JSON.stringify(c);
    if (key === this.key) return;
    this.key = key;
    const el = this.el;
    el.classList.toggle('empty', !!c.empty);
    if (c.empty) {
      el.innerHTML = `<b>${esc(c.title)}</b><span class="bc-line">${esc(c.text)}</span>`;
      el.setAttribute('aria-label', `${c.title}. ${c.text}`);
      this.many = false;
    } else {
      // the line's stars (★, Ranch life's star text) in the stars' honey color
      const line = esc(`${c.breed} · ${c.line}`).replace(/(★+)/, '<span class="st">$1</span>');
      const n = c.count;
      const dots = n.dots ? `<i class="bc-dots">${Array.from({ length: n.dots }, (_, i) => `<u class="${i === n.on ? 'on' : ''}"></u>`).join('')}</i>` : `<span class="bc-count">${esc(n.text)}</span>`;
      el.innerHTML = `<b>${esc(c.name)}</b><span class="bc-line">${line}</span>${dots}`;
      el.setAttribute('aria-label', `${c.name}, ${c.breed}, ${c.line}. Open ${c.name}'s page`);
      this.many = (n.dots || 0) > 1 || !!n.text;
    }
    if (!el.hidden) this.showArrows(this.many);
  }
  // where: its bottom edge (pixels from the bottom of the screen) and its middle (pixels from the left); the arrows at
  // the slime's height (pixels from the top)
  place(bottom, cx, arrowsY) {
    const s = this.el.style, b = Math.round(bottom) + 'px', l = Math.round(cx) + 'px';
    if (s.bottom !== b) s.bottom = b;
    if (s.left !== l) s.left = l;
    const t = Math.round(arrowsY) + 'px';
    for (const a of this.arrows) if (a.style.top !== t) a.style.top = t;
  }
  height() { return this.el.offsetHeight || 0; }
}

// "Off to the barn": the short loading moment at home when Ranch is tapped before the barn's files are in (they load
// ahead of time, so this is rare: a slow network on the first visit). The barn house is the Ranch tab's own icon.
// Under the top bar, in the middle; it takes no touches. still: Reduced motion (the dots don't bounce).
const BARN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M12 2.6l9 6.8v11.8H3V9.4zm-2.6 18.6h5.2v-6.4H9.4zM10 9.2h4v3h-4z"/></svg>';
export class BarnWait {
  constructor() {
    addCss();
    const el = this.el = document.createElement('div');
    el.id = 'barnWait';
    el.className = 'barn-wait glass';
    el.setAttribute('role', 'status');
    el.innerHTML = `${BARN_ICON}<span>Off to the barn</span><i class="bw-dots" aria-hidden="true"><u></u><u></u><u></u></i>`;
    el.hidden = true;
    document.body.appendChild(el);
  }
  show(on, { still = false } = {}) {
    const el = this.el;
    if (on) {
      const top = document.querySelector('.top');
      el.style.top = Math.round((top ? top.getBoundingClientRect().bottom : 60) + 14) + 'px';
      el.classList.toggle('still', !!still);
    }
    el.hidden = !on;
  }
  get shown() { return !this.el.hidden; }
}
