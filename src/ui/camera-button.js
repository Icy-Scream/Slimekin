// The Greenhouse camera button (only in the Greenhouse, at home): steps through the set angles (Front, Wide, Left,
// Right). After you turn the camera yourself it shows a little arrow, and its next tap brings you back to Front.
// Its place: under the top bar on the left, away from the slime and the snack tray (CSS: .cam-btn in index.html).
import { ICON } from './icons.js';

const NAMES = { front: 'Front', wide: 'Wide', left: 'Left', right: 'Right' };

export class CameraButton {
  constructor({ onTap }) {
    const b = document.createElement('button');
    b.className = 'cam-btn glass';
    b.id = 'camBtn';
    b.type = 'button';
    b.hidden = true;
    b.innerHTML = `<span class="ic">${ICON.camera}</span><span class="tip" aria-hidden="true"></span>`;
    // a tap on the button is not a press on the room behind it
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) b.addEventListener(ev, e => e.stopPropagation(), { passive: true });
    b.addEventListener('click', e => { e.stopPropagation(); onTap(); });
    document.body.appendChild(b);
    this.el = b;
    this.tipT = null;
    this.state = null;
  }

  // view: 'front' | 'wide' | 'left' | 'right' | 'free' (turned by hand); next: where a tap goes
  set(view, next) {
    const key = view + '>' + next;
    if (key === this.state) return;
    this.state = key;
    const free = view === 'free';
    this.el.dataset.view = view;
    this.el.classList.toggle('free', free);
    this.el.querySelector('.ic').innerHTML = free ? ICON.cameraBack : ICON.camera;
    const label = free ? 'Camera: turned by hand. Tap for the front view' : `Camera: ${NAMES[view]} view. Tap for ${NAMES[next]}`;
    this.el.setAttribute('aria-label', label);
    this.el.title = label;
  }

  // a short name next to the button after a tap ("Wide view")
  tip(view) {
    const t = this.el.querySelector('.tip');
    t.textContent = NAMES[view] ? `${NAMES[view]} view` : '';
    this.el.classList.add('tipping');
    clearTimeout(this.tipT);
    this.tipT = setTimeout(() => this.el.classList.remove('tipping'), 1300);
  }

  // top: px from the top of the screen (under the top bar), or null for the CSS default (no top bar: the egg)
  show(on, top = null) {
    if (this.el.hidden === !on && (!on || this.top === top)) return;
    this.el.hidden = !on;
    if (on && top !== this.top) { this.top = top; this.el.style.top = top === null ? '' : top + 'px'; }
  }
}
