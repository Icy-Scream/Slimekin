// A tiny travel bundle (a cloth sack tied to a little stick): PLACEHOLDER art for the "very ready" Moving Day sign.
// It sits on the cushion now and then; the game shows and hides it (src/moving-day.js).
import * as THREE from 'three';

export function makeTravelBundle() {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: '#ff9fc6', roughness: 0.9 });
  const dots = new THREE.MeshStandardMaterial({ color: '#fff7fb', roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: '#b07a4a', roughness: 0.8 });
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), cloth);
  sack.scale.set(1, 0.82, 0.92);
  sack.position.y = 0.17;
  g.add(sack);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, el = -0.2 + (i % 3) * 0.35;
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), dots);
    d.position.set(Math.cos(a) * Math.cos(el) * 0.2, 0.17 + Math.sin(el) * 0.165, Math.sin(a) * Math.cos(el) * 0.185);
    g.add(d);
  }
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 12), cloth);
  knot.position.y = 0.37;
  g.add(knot);
  const ears = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.022, 8, 16), cloth);
  ears.position.y = 0.44; ears.rotation.y = Math.PI / 2;
  g.add(ears);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.75, 8), wood);
  stick.position.set(-0.16, 0.3, 0);
  stick.rotation.z = -0.95;
  g.add(stick);
  return g;
}
