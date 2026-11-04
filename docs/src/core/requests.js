// The slime occasionally asks for something. Every request has more than one
// reasonable answer, and each answer nudges personality in its own direction.
import { TUNING, FOODS, FOOD_BY_ID } from '../data/content.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class Requests {
  constructor(sim) {
    this.sim = sim;
    this.active = null;
    this.timer = 35; // the first one comes a little sooner
  }

  nextDelay() {
    const p = this.sim.slime.personality;
    const [a, b] = TUNING.requestEvery;
    const lean = 1 + (p.patient - p.bold) / 200; // bold slimes ask more often
    return rand(a, b) * lean;
  }

  clear() { this.active = null; this.timer = this.nextDelay(); }

  tick(dt, canRequest) {
    const r = this.active;
    if (r) {
      r.age += dt;
      if (r.waiting) {
        r.waitLeft -= dt;
        if (r.waitLeft <= 0) {
          r.waiting = false;
          r.waited = true;
          r.age = 0;
          r.ttl = 25;
          return { event: 'waited', req: r };
        }
        return null;
      }
      if (r.age > r.ttl) {
        this.clear();
        return { event: 'expired', req: r };
      }
      return null;
    }
    if (!canRequest) return null;
    this.timer -= dt;
    if (this.timer > 0) return null;
    this.active = this.make();
    this.timer = this.nextDelay();
    return this.active ? { event: 'new', req: this.active } : null;
  }

  make() {
    const sim = this.sim;
    const s = sim.slime;
    const unlocked = FOODS.filter(f => sim.foodUnlocked(f.id));
    const options = [];
    options.push({ w: 3, type: 'craving' });
    options.push({ w: 0.8 + s.personality.cuddly / 45, type: 'pets' });
    options.push({ w: 0.8 + s.personality.playful / 45, type: 'play' });
    if (s.energy < 40) options.push({ w: 4, type: 'sleepy' });
    const total = options.reduce((t, o) => t + o.w, 0);
    let roll = Math.random() * total, type = 'craving';
    for (const o of options) { roll -= o.w; if (roll <= 0) { type = o.type; break; } }

    const base = { id: Math.random().toString(36).slice(2), type, age: 0, ttl: 40, waiting: false, waited: false, petProgress: 0 };
    if (type === 'craving') {
      const fav = FOOD_BY_ID[s.favorite];
      const food = (sim.foodUnlocked(fav.id) && Math.random() < 0.6) ? fav : unlocked[Math.floor(Math.random() * unlocked.length)];
      return { ...base, food: food.id };
    }
    return base;
  }
}
