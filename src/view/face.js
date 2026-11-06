// Draws the slime's face onto a canvas every frame. The canvas is wrapped
// around the front of the body, so every expression is just 2D drawing.
import * as THREE from 'three';

const W = 512, H = 352;
const INK = '#2a1f3d';
const MOUTH_IN = '#4d1d38';
const TONGUE = '#ff8fae';
const TAU = Math.PI * 2;

export const FACE_W = W, FACE_H = H;
const lerp = (a, b, t) => a + (b - a) * t;
const ell = (c, x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); c.fill(); };
const _ca = new THREE.Color(), _cb = new THREE.Color();
const mixHex = (a, b, t) => '#' + _ca.set(a).lerp(_cb.set(b), t).getHexString();

export class FaceRenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    // The recipe body's face: ONE eye that slides from the Curly face (big glossy blue eyes, open smile) to the Dollop
    // face (dark ovals; the smile shrinks to a tiny one, then away when grown, though it still opens to eat, sing and
    // gasp). mixK: how Dollop the slime is (0..1); grown: how grown its Dollop face is (0..1). Set by SlimeAvatar.
    this.eyeY = 145;
    this.eyeDX = 118;
    this.mouthY = 196;
    this.cheekDX = 165;
    this.cheekY = 216;
    this.mixK = 0;
    this.grown = 0;
  }

  // The smile's size (1 = the Curly's open smile; a Dollop baby's tiny one; none on a grown Dollop).
  smileK() { return lerp(1, lerp(0.36, 0, this.grown), this.mixK); }
  // How far under mouthY (canvas px) the mouth reaches in its everyday shapes, drawn 1.3x: the smile, or the mouth
  // open to eat (a grin and the rest stay higher; only a sleepy yawn reaches a little further). The scarf stays under it.
  mouthLow() { return 1.3 * Math.max(30.6 * this.smileK(), 27.6); }

  draw(e, look, blink, t) {
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    this.blush(e.blush, t);
    const open = Math.max(0, e.eyeOpen * (1 - blink));
    const lx = look.x, ly = look.y;
    const leftStyle = e.eyeL || (e.eyes === 'wink' ? 'normal' : e.eyes);
    const rightStyle = e.eyeR || (e.eyes === 'wink' ? 'happy' : e.eyes);
    this.eye(W / 2 - this.eyeDX, this.eyeY, leftStyle, open, lx, ly, -1, t, e.iris);
    this.eye(W / 2 + this.eyeDX, this.eyeY, rightStyle, open, lx, ly, 1, t, e.iris);
    if (e.brows) this.brows(e.brows, lx, ly, open);
    this.mouth(e, lx * 6, t);
    if (e.tears) this.tears(t);
    if (e.sweat) this.sweat(t);
  }

  // soft round cheeks: always a little rosy (the baseline face), stronger when shy, with three white lines when
  // very embarrassed
  blush(amount, t) {
    const c = this.ctx, k = Math.max(0.55, amount) * lerp(1, 0.75, this.mixK);
    for (const side of [-1, 1]) {
      const x = W / 2 + side * this.cheekDX, y = this.cheekY;
      c.save(); c.translate(x, y); c.scale(1, 0.48);
      const g = c.createRadialGradient(0, 0, 4, 0, 0, 42);
      g.addColorStop(0, `rgba(255,120,150,${0.7 * k})`); g.addColorStop(0.7, `rgba(255,120,150,${0.45 * k})`); g.addColorStop(1, 'rgba(255,120,150,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 42, 0, TAU); c.fill(); c.restore();
      if (amount > 0.55) {
        c.strokeStyle = `rgba(255, 255, 255, ${(amount - 0.55) * 1.6})`;
        c.lineWidth = 4;
        for (let i = -1; i <= 1; i++) {
          c.beginPath();
          c.moveTo(x + i * 14 - 4, y + 6);
          c.lineTo(x + i * 14 + 4, y - 6);
          c.stroke();
        }
      }
    }
  }

  eye(cx, cy, style, open, lx, ly, side, t, iris) {
    const c = this.ctx;
    const ex = cx + lx * 14, ey = cy + ly * 10;
    const rx = 46, ry = 58;
    c.strokeStyle = INK;
    c.fillStyle = INK;
    const special = ['happy', 'sleep', 'wince', 'dizzy', 'heart'].includes(style) || open < 0.16;
    if (special) {
      c.save();
      c.translate(ex, ey); c.scale(1.25, 1.25); c.translate(-ex, -ey);
      this.eyeSpecial(ex, ey, style, open, side, t);
      c.restore();
      return;
    }
    this.eyeRound(ex, ey, rx, ry, style, open, lx, ly, side, t, iris);
  }

  eyeSpecial(ex, ey, style, open, side, t) {
    const c = this.ctx;
    switch (style) {
      case 'happy': {
        c.lineWidth = 12;
        c.beginPath();
        c.arc(ex, ey + 16, 29, Math.PI * 1.13, Math.PI * 1.87);
        c.stroke();
        return;
      }
      case 'sleep': {
        c.lineWidth = 9;
        c.beginPath();
        c.arc(ex, ey - 8, 28, Math.PI * 0.18, Math.PI * 0.82);
        c.stroke();
        c.lineWidth = 5;
        for (const k of [-1, 0, 1]) {
          const a = Math.PI * (0.5 + k * 0.26);
          const px = ex + Math.cos(a) * 28, py = ey - 8 + Math.sin(a) * 28;
          c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a) * 9, py + Math.sin(a) * 9); c.stroke();
        }
        return;
      }
      case 'wince': {
        c.lineWidth = 11;
        const d = side < 0 ? 1 : -1;
        c.beginPath();
        c.moveTo(ex - 20 * d, ey - 22);
        c.lineTo(ex + 18 * d, ey);
        c.lineTo(ex - 20 * d, ey + 22);
        c.stroke();
        return;
      }
      case 'dizzy': {
        c.lineWidth = 7;
        c.beginPath();
        const spin = t * 7 * side;
        for (let a = 0; a < Math.PI * 5.2; a += 0.18) {
          const r = 2 + a * 2.6;
          const x = ex + Math.cos(a + spin) * r, y = ey + Math.sin(a + spin) * r;
          if (a === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
        return;
      }
      case 'heart': {
        const s = 1 + Math.sin(t * 9) * 0.06;
        this.heart(ex, ey + 2, 44 * s, '#ff4f88');
        c.fillStyle = 'rgba(255,255,255,0.9)';
        c.beginPath(); c.ellipse(ex - 13 * s, ey - 9 * s, 8 * s, 6 * s, -0.5, 0, TAU); c.fill();
        return;
      }
    }

    // closed (blink)
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(ex - 28, ey + 2);
    c.quadraticCurveTo(ex, ey + 14, ex + 28, ey + 2);
    c.stroke();
  }

  // Round glossy eyes (normal, sparkle, wide, sad, determined): one parametric eye from the Curly face (k = 0: big
  // glossy blue eyes with a cyan glow) to the Dollop face (k = 1: dark ovals, smaller highlights when grown).
  eyeRound(ex, ey, rx, ry, style, open, lx, ly, side, t, iris) {
    const c = this.ctx, k = this.mixK, g = this.grown;
    const RX = lerp(56, 34, k), RY = lerp(70, lerp(47, 56, g), k) * (style === 'wide' ? 1.1 : style === 'sad' ? 0.92 : 1) * open;
    c.save();
    c.fillStyle = mixHex('#0e1c4e', '#10163a', k); ell(c, ex, ey, RX + 3 * k, RY + 3 * k);
    const ix = lerp(0.84, 1, k), iy = lerp(0.88, 1, k);
    c.beginPath(); c.ellipse(ex, ey + RY * 0.04 * (1 - k), RX * ix, Math.max(0.1, RY * iy), 0, 0, TAU); c.save(); c.clip();
    const gr = c.createLinearGradient(0, ey - RY, 0, ey + RY);
    gr.addColorStop(0, mixHex('#183496', '#1e2242', k)); gr.addColorStop(0.5, mixHex('#246ce4', '#1e2242', k)); gr.addColorStop(1, mixHex('#6ec8ff', '#2c3466', k));
    c.fillStyle = gr; c.fillRect(ex - RX, ey - RY * 1.1, RX * 2, RY * 2.2);
    c.fillStyle = `rgba(8,20,64,${0.84 * (1 - k)})`; ell(c, ex, ey - RY * 0.04, RX * 0.46, RY * 0.52);
    const gx = ex + RX * 0.05 * (1 - k), gy = ey + RY * lerp(0.5, 0.45, k);
    const rg = c.createRadialGradient(gx, gy, 0, gx, gy, Math.max(0.1, RX * lerp(0.6, 0.9, k)));
    rg.addColorStop(0, `rgba(${Math.round(lerp(80, 90, k))},${Math.round(lerp(230, 104, k))},${Math.round(lerp(255, 170, k))},${lerp(0.85, 0.7, k)})`); rg.addColorStop(1, 'rgba(90,104,170,0)');
    c.fillStyle = rg; ell(c, gx, gy, RX * lerp(0.6, 1, k), RY * lerp(0.32, 0.5, k));
    c.restore();
    if (open > 0.4) {
      c.fillStyle = '#ffffff';
      ell(c, ex + RX * lerp(0.26, lerp(0.2, 0.14, g), k), ey - RY * lerp(0.38, lerp(0.42, 0.5, g), k), RX * lerp(0.3, lerp(0.36, 0.34, g), k), RY * lerp(0.25, lerp(0.24, 0.2, g), k));
      c.globalAlpha = lerp(0.92, lerp(0.9, 0, g), k); ell(c, ex - RX * lerp(0.32, 0.3, k), ey + RY * lerp(0.36, 0.38, k), RX * 0.13, RY * 0.1); c.globalAlpha = 1;
    }
    c.restore();
    if (style === 'sparkle') {
      const tw = 0.75 + Math.sin(t * 10 + side) * 0.25;
      this.star(ex + RX * 0.25, ey - RY * 0.02, 13 * tw);
      this.star(ex - RX * 0.42, ey + RY * 0.4, 7 * (1.2 - tw * 0.4));
    }
  }

  brows(kind, lx, ly, open) {
    const c = this.ctx;
    c.strokeStyle = INK;
    c.lineWidth = 8;
    for (const side of [-1, 1]) {
      const bx = W / 2 + side * this.eyeDX + lx * 10;
      const by = this.eyeY - 76 + ly * 6 + (1 - open) * 12;
      // sad: inner ends raised. determined: inner ends lowered.
      const tilt = kind === 'sad' ? -11 : 11;
      c.beginPath();
      c.moveTo(bx - side * 28, by + tilt);
      c.lineTo(bx + side * 26, by - tilt);
      c.stroke();
    }
  }

  mouth(e, ox, t) {
    const c = this.ctx;
    const cx = W / 2 + ox, cy = this.mouthY;
    c.save();
    c.translate(cx, cy); c.scale(1.3, 1.3); c.translate(-cx, -cy);
    this.mouthShape(e, cx, cy, t);
    c.restore();
  }

  mouthShape(e, cx, cy, t) {
    const c = this.ctx;
    if ((e.mouth === 'smile' || e.mouth === 'cat') && !(e.mouthOpen > 0.05)) { this.smile(cx, cy); return; }
    c.strokeStyle = INK;
    c.fillStyle = INK;
    c.lineWidth = 6;
    if (e.mouthOpen > 0.05) {
      this.openMouth(cx, cy - 8, 22 + 8 * e.mouthOpen, 8 + 30 * e.mouthOpen);
      return;
    }
    switch (e.mouth) {
      case 'smile':
        c.beginPath(); c.arc(cx, cy - 16, 20, Math.PI * 0.2, Math.PI * 0.8); c.stroke(); break;
      case 'cat':
        c.beginPath(); c.arc(cx - 12, cy - 8, 12, Math.PI * 0.05, Math.PI * 0.95); c.stroke();
        c.beginPath(); c.arc(cx + 12, cy - 8, 12, Math.PI * 0.05, Math.PI * 0.95); c.stroke();
        break;
      case 'open':
        this.openMouth(cx, cy - 10, 28, 30); break;
      case 'grin':
        this.openMouth(cx, cy - 12, 40, 38); break;
      case 'o':
        this.oMouth(cx, cy - 2, 12, 14); break;
      case 'yawn':
        this.oMouth(cx, cy + 2, 22, 28 + Math.sin(t * 3) * 2); break;
      case 'flat':
        c.beginPath(); c.moveTo(cx - 14, cy - 4); c.lineTo(cx + 14, cy - 4); c.stroke(); break;
      case 'frown':
        c.beginPath(); c.arc(cx, cy + 12, 18, Math.PI * 1.22, Math.PI * 1.78); c.stroke(); break;
      case 'pout':
        c.beginPath(); c.arc(cx, cy + 6, 11, Math.PI * 1.2, Math.PI * 1.8); c.stroke(); break;
      case 'wavy': {
        c.lineWidth = 6;
        c.beginPath();
        for (let i = 0; i <= 24; i++) {
          const x = cx - 26 + i * (52 / 24);
          const y = cy - 4 + Math.sin(i * 0.8 + t * 12) * 5;
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
        break;
      }
      case 'bleh':
        c.fillStyle = TONGUE;
        c.beginPath(); c.ellipse(cx + 6, cy + 2, 11, 14, 0.2, 0, Math.PI); c.fill();
        c.beginPath(); c.moveTo(cx - 18, cy - 4); c.quadraticCurveTo(cx, cy + 4, cx + 20, cy - 6); c.stroke();
        break;
      case 'drool':
        this.oMouth(cx, cy - 2, 10, 11);
        c.fillStyle = 'rgba(160, 225, 255, 0.95)';
        c.beginPath();
        const dy = (t * 0.8 % 1) * 12;
        c.ellipse(cx + 14, cy + 8 + dy, 5, 7, 0, 0, TAU);
        c.fill();
        break;
      case 'kiss':
        c.lineWidth = 6;
        c.beginPath(); c.arc(cx + 2, cy - 10, 7, Math.PI * 1.45, Math.PI * 0.55); c.stroke();
        c.beginPath(); c.arc(cx + 2, cy + 3, 7, Math.PI * 1.45, Math.PI * 0.55); c.stroke();
        break;
      default:
        c.beginPath(); c.arc(cx, cy - 16, 20, Math.PI * 0.2, Math.PI * 0.8); c.stroke();
    }
  }

  // The baseline open smile; it shrinks to a Dollop baby's tiny smile, then away for a grown Dollop.
  smile(cx, cy) {
    const f = this.smileK();
    if (f < 0.06) return;
    const c = this.ctx, w = 34 * f, h = 38 * f, top = cy - 7 * f;
    const path = () => {
      c.beginPath(); c.moveTo(cx - w, top); c.quadraticCurveTo(cx, top - 5, cx + w, top);
      c.bezierCurveTo(cx + w * 0.98, top + h * 1.32, cx - w * 0.98, top + h * 1.32, cx - w, top); c.closePath();
    };
    c.save(); path(); c.fillStyle = '#962434'; c.fill(); c.clip();
    c.fillStyle = '#ff808e'; ell(c, cx, top + h * 0.98, w * 0.7, h * 0.5); c.restore();
    path(); c.lineWidth = Math.max(1.5, 4 * f); c.strokeStyle = '#581220'; c.stroke();
  }

  openMouth(cx, top, hw, depth) {
    const c = this.ctx;
    c.save();
    c.beginPath();
    c.moveTo(cx - hw, top);
    c.quadraticCurveTo(cx, top - 3, cx + hw, top);
    c.bezierCurveTo(cx + hw * 0.95, top + depth * 1.25, cx - hw * 0.95, top + depth * 1.25, cx - hw, top);
    c.closePath();
    c.fillStyle = MOUTH_IN;
    c.fill();
    c.clip();
    c.fillStyle = TONGUE;
    c.beginPath();
    c.ellipse(cx + 4, top + depth * 1.0, hw * 0.62, depth * 0.45, 0, 0, TAU);
    c.fill();
    c.restore();
    c.strokeStyle = INK;
    c.lineWidth = 4.5;
    c.beginPath();
    c.moveTo(cx - hw, top);
    c.quadraticCurveTo(cx, top - 3, cx + hw, top);
    c.bezierCurveTo(cx + hw * 0.95, top + depth * 1.25, cx - hw * 0.95, top + depth * 1.25, cx - hw, top);
    c.stroke();
  }

  oMouth(cx, cy, rx, ry) {
    const c = this.ctx;
    c.save();
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    c.fillStyle = MOUTH_IN; c.fill(); c.clip();
    c.fillStyle = TONGUE;
    c.beginPath(); c.ellipse(cx, cy + ry * 0.8, rx * 0.8, ry * 0.5, 0, 0, TAU); c.fill();
    c.restore();
    c.lineWidth = 5; c.strokeStyle = INK;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.stroke();
  }

  tears(t) {
    const c = this.ctx;
    for (const side of [-1, 1]) {
      const phase = (t * 0.9 + (side > 0 ? 0.5 : 0)) % 1;
      const x = W / 2 + side * (this.eyeDX + 18);
      const y = this.eyeY + 40 + phase * 70;
      c.globalAlpha = 1 - phase * 0.7;
      c.fillStyle = '#9fdcff';
      c.beginPath();
      c.moveTo(x, y - 12);
      c.quadraticCurveTo(x + 9, y + 2, x, y + 8);
      c.quadraticCurveTo(x - 9, y + 2, x, y - 12);
      c.fill();
      c.globalAlpha = 1;
    }
  }

  sweat(t) {
    const c = this.ctx;
    const x = W / 2 + 196, y = 62 + Math.sin(t * 4) * 3;
    c.fillStyle = '#a8e2ff';
    c.strokeStyle = 'rgba(42, 31, 61, 0.5)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y - 18);
    c.quadraticCurveTo(x + 14, y + 4, x, y + 12);
    c.quadraticCurveTo(x - 14, y + 4, x, y - 18);
    c.fill(); c.stroke();
  }

  star(x, y, r) {
    const c = this.ctx;
    c.fillStyle = '#ffffff';
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const rr = i % 2 === 0 ? r : r * 0.3;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
  }

  heart(x, y, s, color) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x, y + s * 0.42);
    c.bezierCurveTo(x - s * 1.05, y - s * 0.2, x - s * 0.45, y - s * 0.95, x, y - s * 0.38);
    c.bezierCurveTo(x + s * 0.45, y - s * 0.95, x + s * 1.05, y - s * 0.2, x, y + s * 0.42);
    c.fill();
  }
}
