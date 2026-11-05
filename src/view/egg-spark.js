// Family-spark egg: an egg from a parent pair that shares a family spark looks a little special, so the
// player can tell something is coming (foreshadowing, per the design doc). A gold star circles the egg with
// a pastel trail; by day the star is bigger and brighter (with a soft halo, so it shows on the pale room);
// at night the shell also glows warm from inside, beating slowly like a heart.
import * as THREE from 'three';

let TEX = null;
function textures() {
  if (TEX) return TEX;
  const make = draw => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    draw(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  TEX = {
    soft: make(x => {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    }),
    star: make(x => {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.3, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      x.fillStyle = '#ffffff'; x.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? 5 : 30; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
      x.fill();
    }),
  };
  return TEX;
}
// additive glows vanish on the pale daytime room, so the visible bits use normal blending
const sprite = (map, color, opacity, additive = true) => new THREE.Sprite(new THREE.SpriteMaterial({ map, color, opacity, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));

// Decorate an Egg (view/egg.js). Returns { setNight(bool), dispose() }.
export function addEggSpark(egg, { night = false } = {}) {
  const T = textures();
  const emissive0 = egg.mat.emissive.clone();
  // the twinkle: a gold star on a slow tilted orbit with a pink and blue trail (and a soft halo by day)
  const halo = sprite(T.soft, '#fff1b8', 0.6, false);
  const star = sprite(T.star, '#ffc928', 1, false);
  const trail = Array.from({ length: 7 }, (_, i) => {
    const s = sprite(T.star, i % 2 ? '#ff8fc8' : '#7fc4ff', 0.85 * (1 - i / 8), false);
    s.scale.setScalar(0.3 * (1 - i / 9));
    return s;
  });
  // the night glow: an aura around the shell and a warm light shining through it from the middle
  const aura = sprite(T.soft, '#ffb347', 0.3, false);
  aura.scale.setScalar(2.6); aura.position.y = 0.82;
  const core = sprite(T.soft, '#ffe2a0', 0.3);
  core.material.depthTest = false; core.renderOrder = 2;
  core.scale.set(1.0, 1.3, 1); core.position.y = 0.8;
  egg.group.add(halo, star, ...trail);
  egg.pivot.add(aura, core);
  const added = [halo, star, ...trail, aura, core];
  let dark = night;
  const at = (a, out) => out.set(Math.cos(a) * 1.1, 0.85 + Math.sin(a * 2) * 0.1 + Math.sin(a) * 0.3, Math.sin(a) * 1.1);
  const tick = t => {
    const a = 0.2 + t * 0.8;   // a slow lap (about 8 seconds), starting in front
    at(a, star.position);
    halo.position.copy(star.position);
    star.material.rotation = t * 1.5;
    const size = dark ? 0.6 : 0.78;   // a little bigger by day
    star.scale.setScalar(size + 0.12 * Math.sin(t * 9));
    halo.scale.setScalar(size * 1.7);
    trail.forEach((s, i) => at(a - (i + 1) * 0.2, s.position));
    if (dark) {
      const p = t % 1.5, beat = Math.exp(-p * p / 0.006) + 0.6 * Math.exp(-((p - 0.22) ** 2) / 0.006);
      egg.mat.emissive.set('#ffb45a');
      egg.mat.emissiveIntensity = Math.max(egg.mat.emissiveIntensity, 0.2 + 0.3 * beat);
      aura.material.opacity = 0.4 + 0.3 * beat;
      core.material.opacity = 0.18 + 0.32 * beat;
    } else {
      egg.mat.emissive.set('#ffe7a8');
      egg.mat.emissiveIntensity = Math.max(egg.mat.emissiveIntensity, 0.06 + 0.04 * Math.sin(t * 3));
    }
  };
  const setNight = n => {
    dark = !!n;
    aura.visible = core.visible = dark;
    halo.visible = !dark;
    star.material.color.set(dark ? '#ffc928' : '#ffb400');
  };
  setNight(night);
  let t = 0;
  const own = Object.prototype.hasOwnProperty.call(egg, 'update'), update = egg.update;
  egg.update = function (dt, scene) { update.call(this, dt, scene); t += dt; tick(t); };
  return {
    setNight,
    dispose() {
      for (const o of added) o.parent && o.parent.remove(o);
      if (own) egg.update = update; else delete egg.update;
      egg.mat.emissive.copy(emissive0);
    },
  };
}
