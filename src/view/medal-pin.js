// The medal pin worn on a slime (at home and on the ranch): a small sprite of the medal's drawing (MEDALS in
// content.js, art in src/ui/icons.js). The game only calls setMedalPin(avatar, medal | null); the UI branch can replace the
// drawing in texture() without touching anything else. The avatar places it each frame (SlimeAvatar.placePin).
import * as THREE from 'three';
import { iconSvgDoc } from '../ui/icons.js';

const DIR = new THREE.Vector3(0.66, -0.12, 0.74).normalize();   // on the chest, to the viewer's right of the face
const cache = new Map();

// Drawn from the same medal art as the HUD (src/ui/icons.js): ribbon, metal disc and emblem, with a soft shadow so it
// reads as a pin on the jelly. The SVG loads as an image; until it has, the old cream disc stands in.
function texture(icon) {
  if (cache.has(icon)) return cache.get(icon);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const fallback = () => {
    x.fillStyle = 'rgba(255, 252, 244, 0.92)';
    x.beginPath(); x.arc(64, 64, 52, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(240, 176, 64, 0.95)'; x.lineWidth = 6; x.stroke();
    t.needsUpdate = true;
  };
  const doc = iconSvgDoc(icon);
  if (!doc) fallback();
  else {
    const img = new Image();
    img.onload = () => {
      x.clearRect(0, 0, 128, 128);
      x.shadowColor = 'rgba(60, 30, 70, 0.35)'; x.shadowBlur = 8; x.shadowOffsetY = 3;
      x.drawImage(img, 4, 2, 120, 120);
      t.needsUpdate = true;
    };
    img.onerror = fallback;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(doc);
  }
  cache.set(icon, t);
  return t;
}

export function setMedalPin(av, medal) {
  const id = medal ? medal.id : null;
  if ((av.medalPin ? av.medalPin.id : null) === id) return;
  if (av.medalPin) { av.body.remove(av.medalPin.sprite); av.medalPin.sprite.material.dispose(); av.medalPin = null; }
  if (!medal) return;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(medal.icon), transparent: true, depthWrite: false, toneMapped: false }));
  sprite.renderOrder = 3;
  sprite.scale.setScalar(0.34);
  av.body.add(sprite);
  av.medalPin = { id, sprite, dir: DIR, off: 0.06 };
  av.placePin();
}
