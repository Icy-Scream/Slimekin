// Light or dark theme, screen size, and where the camera fits the slime in the space the menu leaves.
// A part of Game (src/mixin.js): `this` is the Game.

export class LayoutPart {
  // ---------- theme / layout ----------
  watchTheme() {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = root.getAttribute('data-theme');
      const dark = t === 'dark' || (t !== 'light' && mq.matches);
      if (dark !== this.stage.dark) this.stage.setTheme(dark);
    };
    apply();
    mq.addEventListener?.('change', apply);
    new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  layoutChanged() {
    this.resize();
    setTimeout(() => this.resize(), 400);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    if (!this.stage) return;
    this.stage.resize(w, h, this.viewOff.x, this.viewOff.y);
    this.computeViewGoal();
  }

  computeViewGoal() {
    const w = innerWidth, h = innerHeight;
    let x = 0, y = 0, zoom = 1;
    const mobileTop = window.matchMedia('(max-width: 860px)').matches;
    this.topLimit = mobileTop ? document.querySelector('.top').getBoundingClientRect().bottom : 0;
    if (this.view === 'ranch') { this.stage.fitZoom = 1; return; }   // [barn] the barn fits its stand each frame
    if (this.state.phase === 'play') {
      const mobile = window.matchMedia('(max-width: 860px)').matches;
      const panelEl = document.getElementById('panel');
      // a stretched (tall) menu covers most of the screen on purpose: keep the scene where it was behind it
      if (mobile && panelEl.classList.contains('tall')) return;
      const panel = panelEl.getBoundingClientRect();
      const top = document.querySelector('.top').getBoundingClientRect();
      const tray = document.getElementById('tray').getBoundingClientRect();
      if (!mobile) {
        x = (panel.width + 18) / 2;
        const free = (top.bottom + tray.top) / 2;
        y = (h / 2 - free) * 0.6;
      } else {
        const bottom = Math.min(tray.top, panel.top);
        const free = (top.bottom + bottom) / 2;
        y = h / 2 - free;
        // a tall menu leaves little room: zoom out so the slime still fits above it
        zoom = Math.max(1, Math.min(2.3, (h * 0.4) / Math.max(80, bottom - top.bottom)));
      }
    }
    this.stage.fitZoom = zoom;
    this.viewGoal.set(x, y);
  }
}
