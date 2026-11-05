// Moving Day: how ready a grown slime is to move to the ranch, and which sign it shows (MOVING_DAY in content.js).
// Pure functions; no three.js, no DOM. The signs themselves are played by src/moving-day.js.
import { MOVING_DAY, STAGES, PERSONALITY_IDS } from '../data/content.js';
import { familyBonusFor } from './ranch.js';

// R = (1 + the Family Bonus after moving out now / 100) / (1 + the Family Bonus now / 100): how much faster the next
// baby's jelly would grow. 0 unless the slime is grown up (Settled) and being raised.
export function movingDayRatio(state) {
  const s = state, f = s?.ranch?.family;
  if (!s || s.phase !== 'play' || !f) return 0;
  if ((s.slime?.growth || 0) < STAGES[STAGES.length - 1].minGrowth) return 0;
  const after = familyBonusFor((f.lifetime || 0) + (f.legacy || 0) + Math.max(0, s.totalJelly || 0));
  const now = f.bonus || 0;
  return (1 + Math.max(now, after) / 100) / (1 + now / 100);
}
// The level for a ratio: null (not yet), or one of MOVING_DAY.levels (restless, ready, veryReady).
export function movingDayLevel(ratio) {
  let lvl = null;
  for (const l of MOVING_DAY.levels) if (ratio >= l.at) lvl = l;
  return lvl;
}
// The sign a slime shows: from its strongest personality lean (the slider farthest from 50, and which end).
// Ties go to the first slider in PERSONALITY_IDS order.
export function movingDaySign(personality) {
  let best = PERSONALITY_IDS[0], far = -1;
  for (const id of PERSONALITY_IDS) {
    const d = Math.abs((personality?.[id] ?? 50) - 50);
    if (d > far) { far = d; best = id; }
  }
  const end = (personality?.[best] ?? 50) >= 50 ? 'high' : 'low';
  return Object.keys(MOVING_DAY.signs).find(k => MOVING_DAY.signs[k].lean[0] === best && MOVING_DAY.signs[k].lean[1] === end);
}
