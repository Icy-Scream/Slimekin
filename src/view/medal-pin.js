// The medal pin worn on a slime (at home and on the ranch): a small PLACEHOLDER sprite drawn from the medal's emoji
// icon (MEDALS in content.js). The game only calls setMedalPin(avatar, medal | null); the UI branch can replace the
// drawing in texture() without touching anything else. The avatar places it each frame (SlimeAvatar.placePin).
import * as THREE from 'three';

const DIR = new THREE.Vector3(0.66, -0.12, 0.74).normalize();   // on the chest, to the viewer's right of the face
const cache = new Map();

function texture(icon) {
  if (cache.has(icon)) return cache.get(icon);
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(255, 252, 244, 0.92)';
  x.beginPath(); x.arc(48, 48, 40, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(240, 176, 64, 0.95)'; x.lineWidth = 5; x.stroke();
  x.font = '50px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(icon, 48, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
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
  sprite.scale.setScalar(0.26);
  av.body.add(sprite);
  av.medalPin = { id, sprite, dir: DIR, off: 0.06 };
  av.placePin();
}
