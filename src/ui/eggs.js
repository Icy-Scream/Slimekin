// The recipe body in the menus: special eggs in the Nursery (a Cat-ear or Topknot egg bought with pearls, the type
// guaranteed; BREEDS.specialEggs in content.js, rules in core/ranch.js canBuySpecialEgg / buySpecialEgg), how a
// Nursery egg is titled, and the breed line on your slime's page. Called from a few marked places in ui/hud.js.
import { BREEDS, BREEDING } from '../data/content.js';
import { fmt, fmtDuration } from '../core/format.js';
import { eggLabel } from '../core/breeding.js';
import { bodyName, cleanBody } from '../core/recipe.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// spot colors for a special egg (the egg on the cushion, the nest, the menus)
export const specialEggColors = variant => BREEDS.specialEggs[variant]?.colors || null;

// why a special egg can't be bought right now (canBuySpecialEgg's reason), in plain words; '' when it can
export function specialEggRefusal(g, variant, c) {
  if (!c || c.ok) return '';
  const def = BREEDS.specialEggs[variant], cur = esc(g.state.slime.name || 'your slime');
  if (c.reason === 'full') return g.state.phase === 'egg' ? `The nest is full (${BREEDING.maxEggs} eggs). Put a waiting egg on the cushion, or give one to a neighbor.`
    : `The nest is full (${BREEDING.maxEggs} eggs). Choose a waiting egg when ${cur} moves to the ranch, or give one to a neighbor.`;
  if (c.reason === 'pearls') return `${esc(def?.name || 'This egg')} costs ${fmt(def?.price || 0)} pearls. You have ${fmt(g.state.ranch.pearls)}.`;
  return '';
}

// The Nursery page's "Special eggs" section: one card per special egg, with its price and a friendly reason when
// it can't be bought.
export function specialEggsHtml(g) {
  const rr = g.sim.ranch;
  let html = `<div class="sec-title">Special eggs</div><p class="sub">Bought with pearls, so you always know what hatches. It waits in the nest like any egg and is ready in ${esc(fmtDuration(rr.newEggSeconds()))}.</p>`;
  for (const [variant, def] of Object.entries(BREEDS.specialEggs)) {
    const c = rr.canBuySpecialEgg(variant), why = specialEggRefusal(g, variant, c);
    html += `<div class="card egg-card special-egg"><div class="egg-row"><span class="egg-ic" style="--a:${def.colors[0]};--b:${def.colors[1]}" aria-hidden="true"></span>
      <div><b>${esc(def.name)}</b><span class="sub">${esc(def.blurb)}</span></div></div>
      ${why ? `<span class="sub special-why">${why}</span>` : ''}
      <div class="egg-acts"><button class="btn small primary" data-act="buySpecial" data-variant="${variant}" ${c.ok ? '' : 'disabled'}>Buy · <i class="pearl"></i> ${fmt(def.price)}</button></div></div>`;
  }
  return html;
}

// A waiting egg's title in the Nursery: "Ann and Bo's egg", or "Cat-ear egg" with what will hatch from it.
export function nurseryEggTitle(e) {
  if (e.special) return `<b>${esc(BREEDS.specialEggs[e.special]?.name || 'Special egg')}</b>`;
  return `<b>${esc(eggLabel(e, { cap: true }))}</b>`;
}
export const nurseryEggNote = e => (e.special ? `<span class="sub">${esc(BREEDS.specialEggs[e.special]?.blurb || '')}</span>` : '');

// Your slime's page: which breed it is (Curly, Dollop, a special Dollop, or an in-between from the Nursery).
export function breedHtml(s) {
  const b = cleanBody(s), name = bodyName(b);
  const what = b.breed === 'curly' ? 'A jelly drop with a curl on top.'
    : b.breed === 'dollop' ? (b.variant === 'ears' ? 'A soft gummy dome with little cat ears.' : b.variant === 'topknot' ? 'A soft gummy dome with a round topknot.' : 'A soft gummy dome.')
    : `Part Curly, part Dollop (about ${Math.round(b.mix * 100)}% Dollop). Only the Nursery makes these.`;
  return `<div class="row-between breed-line"><span>Breed</span><b>${esc(name)}</b></div><span class="sub">${esc(what)}</span>`;
}

// The family tree's egg for a slime without parents: a plain egg, or the special egg it hatched from.
export const eggOrigin = lin => (lin && lin.special && BREEDS.specialEggs[lin.special] ? BREEDS.specialEggs[lin.special].name : 'A plain egg');
