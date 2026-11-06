// Ranch life rules: the Training Center (five skills, lessons, lanes) and trips (six places, wagons, souvenirs,
// treats, stories, Friend of a place). All numbers are in RANCH_LIFE (content.js). No three.js, no DOM; everything
// that depends on time takes `now` (ms, the wall clock: game.nowMs()).
import { RANCH_LIFE, SKILL_IDS } from '../data/content.js';

const clampStars = v => Math.max(0, Math.min(RANCH_LIFE.maxStars, Math.floor(Number.isFinite(+v) ? +v : 0)));

// ---------- save ----------
// ranch.life: lanes and wagons owned, souvenirs found ({ souvenirId: { at, by } }), places you are a Friend of,
// and how many lessons and trips ever finished.
export function createLife() {
  return { lanes: RANCH_LIFE.lanes.start, wagons: RANCH_LIFE.wagons.start, souvenirs: {}, friends: [], trips: 0, lessons: 0 };
}
export function migrateLife(saved) {
  const fresh = createLife();
  const out = { ...fresh, ...(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}) };
  const count = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number.isFinite(+v) ? +v : lo)));
  out.lanes = count(out.lanes, RANCH_LIFE.lanes.start, RANCH_LIFE.lanes.start + RANCH_LIFE.lanes.costs.length);
  out.wagons = count(out.wagons, RANCH_LIFE.wagons.start, RANCH_LIFE.wagons.start + RANCH_LIFE.wagons.costs.length);
  out.trips = count(out.trips, 0, Infinity);
  out.lessons = count(out.lessons, 0, Infinity);
  if (!out.souvenirs || typeof out.souvenirs !== 'object' || Array.isArray(out.souvenirs)) out.souvenirs = {};
  out.friends = Array.isArray(out.friends) ? [...new Set(out.friends.filter(id => typeof id === 'string'))] : [];
  return out;
}
export const emptySkills = () => Object.fromEntries(SKILL_IDS.map(id => [id, 0]));
// A resident from before ranch life: 0 stars, no lesson, no trip. Keeps a valid lesson/trip; drops a broken one.
export function migrateResident(x) {
  x.skills = { ...emptySkills(), ...(x.skills && typeof x.skills === 'object' ? x.skills : {}) };
  for (const id of SKILL_IDS) x.skills[id] = clampStars(x.skills[id]);
  const l = x.lesson;
  if (!(l && typeof l === 'object' && SKILL_IDS.includes(l.skill) && Number.isFinite(l.doneAt) && Number.isFinite(l.startAt))) x.lesson = null;
  const t = x.trip;
  if (!(t && typeof t === 'object' && typeof t.place === 'string' && Number.isFinite(t.homeAt) && Number.isFinite(t.startAt))) x.trip = null;
  return x;
}
