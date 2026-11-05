// Slime medals: which medal a slime has earned from its own jelly. Pure functions; no three.js, no DOM.
import { MEDALS, MEDAL_BY_ID } from '../data/content.js';

// The medal a slime with this much of its own jelly wears: null until it is grown up (Settled), then at least the
// Grown-Up Ribbon, and the highest step its jelly has reached.
export function medalFor(jelly, settled) {
  if (!settled) return null;
  const j = Number.isFinite(+jelly) ? +jelly : 0;
  let m = MEDALS[0];
  for (const x of MEDALS) if (j >= x.jelly) m = x;
  return m;
}
// Position on the ladder (-1 = none yet), from a medal or a medal id.
export const medalRank = m => (m ? MEDALS.indexOf(typeof m === 'string' ? MEDAL_BY_ID[m] : m) : -1);
// The next step up (null at the top).
export const nextMedal = m => MEDALS[medalRank(m) + 1] || null;
// A ranch resident's medal: residents are all grown up; computed from runTotal (nothing extra is saved).
export const residentMedal = x => medalFor(x?.runTotal || 0, true);
