// Heirlooms: family treasures that stay through every move-out and help every slime after (HEIRLOOMS in
// content.js). Pure functions over the save state; no three.js, no DOM.
import { HEIRLOOMS, HEIRLOOM_BY_ID } from '../data/content.js';

export function createHeirlooms() {
  // owned: heirloom ids the family has; seen: ids already announced as affordable (the tab's glow shows each once)
  return { owned: [], seen: [] };
}
export function migrateHeirlooms(saved) {
  const out = { ...createHeirlooms(), ...(saved && typeof saved === 'object' ? saved : {}) };
  for (const k of ['owned', 'seen']) out[k] = Array.isArray(out[k]) ? [...new Set(out[k].filter(id => HEIRLOOM_BY_ID[id]))] : [];
  return out;
}

export const ownsHeirloom = (state, id) => !!state?.heirlooms?.owned?.includes(id);
const ownedDefs = state => (state?.heirlooms?.owned || []).map(id => HEIRLOOM_BY_ID[id]).filter(Boolean);
// The product of one multiplier over every owned heirloom (1 when none has it).
export function heirloomMult(state, key) {
  let m = 1;
  for (const h of ownedDefs(state)) if (typeof h.fx[key] === 'number') m *= h.fx[key];
  return m;
}
export const heirloomFlag = (state, key) => ownedDefs(state).some(h => h.fx[key] === true);
// Helpers a new egg's slime starts with (the most any owned heirloom gives, per helper).
export function startHelpers(state) {
  const out = {};
  for (const h of ownedDefs(state)) for (const [id, n] of Object.entries(h.fx.startHelpers || {})) out[id] = Math.max(out[id] || 0, n);
  return out;
}
// Unowned heirlooms that can be bought, in price order.
export const forSale = state => HEIRLOOMS.filter(h => h.buyable !== false && !ownsHeirloom(state, h.id));
