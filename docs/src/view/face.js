// Draws the slime's face onto a canvas every frame. The canvas is wrapped
// around the front of the body, so every expression is just 2D drawing.
import * as THREE from 'three';

const W = 512, H = 352;
const INK = '#2a1f3d';
const MOUTH_IN = '#4d1d38';
const TONGUE = '#ff8fae';
const TAU = Math.PI * 2;

export const FACE_W = W, FACE_H = H;

export class FaceRenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.eyeY = 150;
    this.eyeDX = 112;
    this.mouthY = 238;
  }

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

  blush(amount, t) {
    if (amount < 0.02) return;
    const c = this.ctx;
    for (const side of [-1, 1]) {
      const x = W / 2 + side * 176, y = 232;
      c.save();
      c.translate(x, y);
      c.scale(1, 0.55);
      const g = c.createRadialGradient(0, 0, 4, 0, 0, 58);
      g.addColorStop(0, `rgba(255, 105, 150, ${0.62 * amount})`);
      g.addColorStop(1, 'rgba(255, 105, 150, 0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, 58, 0, TAU); c.fill();
      c.restore();
      if (amount > 0.55) {
        c.strokeStyle = `rgba(255, 255, 255, ${(amount - 0.55) * 1.6})`;
        c.lineWidth = 4;
        for (let i = -1; i <= 1; i++) {
          c.beginPath();
          c.moveTo(x + i * 16 - 5, y + 7);
          c.lineTo(x + i * 16 + 5, y - 7);
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

  // Round glossy eyes: normal, sparkle, wide, sad, determined
  eyeRound(ex, ey, rx, ry, style, open, lx, ly, side, t, iris) {
    const c = this.ctx;
    let erx = rx, ery = ry * open;
    if (style === 'wide') { erx *= 1.08; ery *= 1.12; }
    if (style === 'sad') { ery *= 0.92; }
    c.save();
    c.beginPath();
    c.ellipse(ex, ey, erx, ery, 0, 0, TAU);
    c.fillStyle = INK;
    c.fill();
    c.clip();
    const g = c.createLinearGradient(0, ey - ery, 0, ey + ery);
    g.addColorStop(0.3, 'rgba(0,0,0,0)');
    g.addColorStop(1, iris || 'rgba(120, 240, 200, 0.9)');
    c.fillStyle = g;
    c.fillRect(ex - erx, ey - ery, erx * 2, ery * 2);
    c.restore();

    const hs = style === 'wide' ? 0.7 : 1;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(ex - erx * 0.3 - lx * 3, ey - ery * 0.36 - ly * 2, erx * 0.35 * hs, Math.min(erx * 0.35, ery * 0.42) * hs, -0.35, 0, TAU);
    c.fill();
    c.beginPath();
    c.arc(ex + erx * 0.36, ey + ery * 0.34, erx * 0.14 * hs, 0, TAU);
    c.fill();
    if (style === 'sparkle') {
      const tw = 0.75 + Math.sin(t * 10 + side) * 0.25;
      this.star(ex + erx * 0.25, ey - ery * 0.02, 13 * tw);
      this.star(ex - erx * 0.42, ey + ery * 0.4, 7 * (1.2 - tw * 0.4));
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
