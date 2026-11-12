// The way into the race (design/contests-race-view.md §1, "Bridge from the barn"): the barn's last 3D frame pixelates
// down to the race's 2 pt grid over 600 ms, your slime last; then the course slides in (race-skin.js: .rv-slide).
// Reduced motion has no bridge (the layer's 150 ms crossfade). Numbers: CONTESTS.race.view.bridge.
// One copy of the frame and two small canvases, made once; a frame draws only when a block size changes.
import { CONTESTS } from '../data/content.js';

const B = () => CONTESTS.race.view.bridge;

export class RaceBridge {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.snap = document.createElement('canvas');
    this.small = document.createElement('canvas');
    this.sctx = this.small.getContext('2d');
    this.t = -1;
    this.bAll = 0; this.bYou = 0;   // the block sizes drawn last (device px)
    this.cx = 0; this.cy = 0; this.r = 0;
  }
  get running() { return this.t >= 0; }
  // copy the frame just drawn: call it right after the render, in the same frame (the WebGL buffer is still there).
  // you: your slime's centre and radius on the screen (CSS px), or null (the middle of the screen)
  take(src, you) {
    const w = src.width, h = src.height, k = w / Math.max(1, innerWidth);
    this.c.width = w; this.c.height = h;
    this.snap.width = w; this.snap.height = h;
    this.snap.getContext('2d').drawImage(src, 0, 0);
    this.k = k;
    this.cx = (you ? you.x : innerWidth / 2) * k; this.cy = (you ? you.y : innerHeight / 2) * k; this.r = (you ? you.r : 60) * k;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.snap, 0, 0);
    this.t = 0; this.bAll = 1; this.bYou = 1;
  }
  // the block size (device px) at share u of the way: 1 (sharp) up to the 2 pt grid
  blockAt(u) {
    const top = Math.max(1, Math.round(2 * this.k));
    return u <= 0 ? 1 : Math.max(1, Math.round(1 + (top - 1) * Math.min(1, u)));
  }
  // advance the bridge; answers true when it is done (the course slides in next)
  update(dt) {
    if (this.t < 0) return true;
    const P = B();
    this.t += dt;
    const u = this.t / P.ms * 1000, lag = P.youLag;
    const bAll = this.blockAt(u / (1 - lag)), bYou = this.blockAt((u - lag) / (1 - lag));
    if (bAll !== this.bAll || bYou !== this.bYou) {
      this.bAll = bAll; this.bYou = bYou;
      this.pixelate(bAll);
      if (bYou !== bAll) {
        const x = this.ctx;
        x.save();
        x.beginPath(); x.arc(this.cx, this.cy, this.r, 0, 6.2832); x.clip();
        this.pixelate(bYou);
        x.restore();
      }
    }
    if (u >= 1) { this.t = -1; return true; }
    return false;
  }
  // the whole copy, in b x b blocks (each block its area's average colour)
  pixelate(b) {
    const x = this.ctx, w = this.c.width, h = this.c.height;
    if (b <= 1) { x.imageSmoothingEnabled = true; x.drawImage(this.snap, 0, 0); return; }
    const sw = Math.ceil(w / b), sh = Math.ceil(h / b);
    if (this.small.width < sw || this.small.height < sh) { this.small.width = sw; this.small.height = sh; }
    this.sctx.imageSmoothingEnabled = true;
    this.sctx.imageSmoothingQuality = 'medium';
    this.sctx.drawImage(this.snap, 0, 0, w, h, 0, 0, sw, sh);
    x.imageSmoothingEnabled = false;
    x.drawImage(this.small, 0, 0, sw, sh, 0, 0, sw * b, sh * b);
  }
  stop() { this.t = -1; }
  // let the copy go (the race is over)
  clear() { this.t = -1; this.c.width = 1; this.c.height = 1; this.snap.width = 1; this.snap.height = 1; this.small.width = 1; this.small.height = 1; }
}
