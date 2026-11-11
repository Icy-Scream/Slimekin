// Tester tools (#debug only): the Settings card's debug buttons, the Moving Day and body tools, contests without the
// show (g.contests), and instant eggs. A part of Game (src/mixin.js): `this` is the Game.
import { STAGES, PERSONALITY, MOVING_DAY, SKILL_IDS } from '../data/content.js';
import { cleanBody, bodyName } from '../core/recipe.js';
import { esc } from '../ui/esc.js';
import { movingDayRatio, movingDayLevel } from '../core/movingday.js';
import { scoreShow, applyShow, dressUp } from '../core/contests.js';
import { starCap } from '../core/talents.js';
import { DEBUG, clamp } from './shared.js';

export class DebugPart {
  // Moving Day tester tools (#debug only): where this slime is, and one button per sign (plus the travel bundle).
  movingDayDebugHtml() {
    const R = movingDayRatio(this.state), lvl = movingDayLevel(R), mine = this.movingDay.signFor();
    const name = id => { const [axis, end] = MOVING_DAY.signs[id].lean; return PERSONALITY[axis][end]; };
    return `<div class="sec-title">Moving Day signs</div><p class="sub" id="mdStatus">R ${R ? R.toFixed(3) : '-'} (${lvl ? lvl.id : R ? 'not yet' : 'not grown up'}); levels at ${MOVING_DAY.levels.map(l => l.at).join(' / ')}. This slime's sign: ${esc(name(mine))}.${lvl ? ` Next sign in about ${Math.max(0, Math.round(this.movingDay.timer))} s of calm play.` : ''}</p>
      <div class="actions md-debug">${Object.keys(MOVING_DAY.signs).map(id => `<button class="btn small" data-dbg="sign:${id}">${esc(name(id))}</button>`).join('')}<button class="btn small" data-dbg="bundle">Travel bundle</button></div>`;
  }

  // Recipe body tester tools (#debug only): set the breed, variant and mix of this slime (and of the egg on the cushion).
  bodyDebugHtml() {
    const sl = this.state.slime, b = (k, v, l) => `<button class="btn small" data-dbg="body:${k}:${v}" aria-pressed="${String(sl[k]) === String(v)}">${l}</button>`;
    return `<div class="sec-title">Body</div><p class="sub" id="bodyStatus">${esc(bodyName(sl))}: breed ${esc(sl.breed)}, variant ${esc(sl.variant)}, mix ${(+sl.mix).toFixed(2)}.</p>
      <div class="actions body-debug">${b('mix', 0, 'Curly')}${b('mix', 0.25, 'Mix 25%')}${b('mix', 0.5, 'Mix 50%')}${b('mix', 0.75, 'Mix 75%')}${b('mix', 1, 'Dollop')}</div>
      <div class="actions body-debug">${b('variant', 'plain', 'Plain')}${b('variant', 'ears', 'Cat ears')}${b('variant', 'topknot', 'Topknot')}</div>`;
  }
  // Set this slime's body (and the cushion egg's, while it waits); the body morphs over to it. Test hook too.
  debugBody(patch, { instant = false } = {}) {
    const st = this.state, sl = st.slime;
    let mix = 'mix' in patch ? clamp(+patch.mix, 0, 1) : sl.mix;
    const variant = 'variant' in patch ? patch.variant : sl.variant;
    if ('variant' in patch && variant !== 'plain' && mix <= 0) mix = 1;   // ears and a topknot only show with some Dollop in it
    Object.assign(sl, cleanBody({ breed: 'set', mix, variant, genes: sl.genes }));
    if (st.phase === 'egg' && st.egg.bred) st.egg.bred.body = cleanBody(sl);
    this.slime.setRecipe(sl, { instant });
    this.markDirty(true);
    return cleanBody(sl);
  }

  debug(k) {
    const s = this.state.slime;
    if (k.startsWith('body:')) { const [, key, v] = k.split(':'); this.debugBody({ [key]: key === 'mix' ? +v : v }); this.openSettings(); return; }
    if (k.startsWith('sign:')) { this.hud.closeModal(); if (this.sim.asleep) this.wakeUp('rested'); this.movingDay.play(k.slice(5), { forced: true }); return; }
    if (k === 'bundle') { this.hud.closeModal(); this.movingDay.showBundle(); return; }
    if (k === 'jelly') this.sim.addJelly(10000);
    if (k === 'mega') this.sim.addJelly(1e7);
    if (k === 'grow') {
      const i = this.sim.stageIndex();
      const next = STAGES[i + 1];
      if (next) {
        const before = i;
        s.growth = next.minGrowth + 1;
        const r = { stageBefore: before, stageAfter: this.sim.stageIndex(), form: null };
        if (r.stageAfter === STAGES.length - 1) { const res = this.sim.settleForm(); r.form = res.form; r.nearMiss = res.nearMiss || null; s.form = r.form; }
        this.hud.closeModal();
        this.stageUp(r);
      }
    }
    if (k === 'needs') { s.tummy = 80; s.joy = 90; s.energy = 100; }
    if (k === 'glim') { this.hud.closeModal(); this.spawnGlimmer(); }
    if (k === 'req') { this.hud.closeModal(); this.state.tutorial = Math.max(3, this.state.tutorial); this.requests.timer = 0; }
    if (k === 'bond') { const b = this.sim.addBond(60); if (b) this.onBondUp(b); }
    if (k === 'pearls') { this.sim.ranch.addPearls(100); this.hud.renderRanch(true); }
    if (k === 'tera') this.sim.addJelly(1e12);
    if (k === 'rlLessons' || k === 'rlTrips') { this.hud.closeModal(); this.life.debugFinish(k === 'rlLessons' ? 'lessons' : 'trips'); }
    if (k === 'contests') this.debugContestStars();
    if (k === 'instant') {
      this.debugInstant = !this.debugInstant;
      try { localStorage.setItem('slimekin.debug.instantEggs', this.debugInstant ? '1' : '0'); } catch { /* private mode */ }
      this.instantEggs();
      this.openSettings();
    }
  }
  // ---------- contests: the #debug path (the screens: ui/contests.js and contest-show.js) ----------
  // g.contests.enter(residentId, contestId, cheers, { cup }) runs a show (core/contests.js scoreShow) and writes its
  // result into the save (applyShow); returns the show with `given` (what it brought). cheers: 'perfect' | 'good' |
  // 'nice' | 'none' | 'mash' | 'skip', or per act a grade or a list of tap times (s from the ring appearing).
  // g.contests.dress(residentId, slot, outfitId | null): Dress up with an outfit the family owns.
  contestsDebug() {
    const done = () => { this.markDirty(true); this.saveNow(); this.hud.renderRanch(true); if (this.barnRanch.on) this.barnRanch.renderCard(); };
    return {
      enter: (id, contestId, cheers = 'good', opts = {}) => {
        const res = scoreShow(this.state, id, contestId, { cheers, reducedMotion: !!this.reduced, ...opts });
        if (!res.ok) return res;
        res.given = applyShow(this.state, res, this.nowMs());
        if (res.given?.journal) this.hud.dot('journal');
        done();
        return res;
      },
      preview: (id, contestId, cheers = 'none', opts = {}) => scoreShow(this.state, id, contestId, { cheers, reducedMotion: !!this.reduced, ...opts }),
      dress: (id, slot, outfitId = null) => { const r = dressUp(this.state, id, slot, outfitId); if (r.ok) done(); return r; },
    };
  }
  // Debug "Contest stars": the resident on the barn's stand (or the first one home and free) learns every star its talents
  // allow and is perfectly happy, so it can try every cup.
  debugContestStars() {
    const R = this.state.ranch.residents;
    const x = (this.barnRanch.on && R.find(r => r.id === this.barnRanch.curId)) || R.find(r => !r.trip && !r.lesson) || R.find(r => !r.trip);
    if (!x) { this.hud.toast('<b>No one to train</b>Move a slime to the ranch first.', '', 2400); return null; }
    for (const id of SKILL_IDS) x.skills[id] = Math.max(x.skills[id] || 0, starCap(x, id));
    x.happiness = 100;
    this.hud.closeModal();
    this.hud.toast(`<b>Debug: contest stars</b>${esc(x.name)} has every star it can learn.`, '', 2400);
    this.markDirty(true);
    this.hud.renderRanch(true);
    if (this.barnRanch.on) this.barnRanch.renderCard();
    return x.id;
  }
  // Debug "Instant eggs": every waiting egg (and the egg on the cushion) is ready now and no parent is resting.
  instantEggs() {
    if (!DEBUG || !this.debugInstant) return;
    const rr = this.sim.ranch, now = this.nowMs(), ce = this.state.egg;
    for (const e of rr.eggs()) e.readyAt = Math.min(e.readyAt, now);
    if (ce.readyAt) { ce.readyAt = Math.min(ce.readyAt, now); if (ce.bred) ce.bred.readyAt = Math.min(ce.bred.readyAt, now); }
    if (this.state.phase === 'egg') this.updateEggHint();
    for (const x of this.state.ranch.residents) x.bredDay = null;
    this.syncNursery();
    this.hud.renderRanch(true);
    this.markDirty(true);
  }
}
