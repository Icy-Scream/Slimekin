// The egg on the cushion: its look (a bred egg has its parents' spot colors), the hint under it, warming it with taps,
// hatching and naming the baby. A part of Game (src/mixin.js): `this` is the Game.
import * as THREE from 'three';
import { fmtDuration } from '../core/format.js';
import { Egg } from '../view/egg.js';
import { addEggSpark } from '../view/egg-spark.js';
import { bodyName } from '../core/recipe.js';
import { eggLabel } from '../core/breeding.js';
import { specialEggColors } from '../ui/eggs.js';
import { esc } from '../ui/esc.js';
import { SLIME_Y } from './shared.js';

export class EggPart {
  // the egg on the cushion as you see it: a bred egg has its parents' spot colors (and a twinkle for a family spark)
  makeEggView() {
    if (this.egg) {
      this.scene.remove(this.egg.group);
      this.egg.mesh.geometry.dispose(); this.egg.mat.dispose(); this.egg.tex.dispose();
    }
    const lin = this.state.slime.lineage || {};
    const sp = this.state.egg.bred?.special;   // a special egg (pearls) has its own spot colors
    this.egg = new Egg({ colors: sp ? specialEggColors(sp) : lin.parents?.length ? this.eggColors(lin.bias) : null });
    this.eggSpark = lin.spark ? addEggSpark(this.egg, { night: this.stage.dark }) : null;
    this.egg.group.position.y = SLIME_Y;
    this.egg.setWarmth(this.state.egg.warmth);
    this.scene.add(this.egg.group);
  }

  // The hint under the egg. A Nursery egg chosen while still warming finishes on the cushion: the hint counts down
  // and the bar shows the time; taps wait until it is ready.
  updateEggHint() {
    const w = this.state.egg.warmth, now = this.nowMs();
    const warming = !this.sim.eggReady(now);
    const set = (id, text) => { const el = document.getElementById(id); if (el.textContent !== text) el.textContent = text; };
    document.getElementById('eggHint').classList.toggle('warming', warming);
    if (warming) {
      const left = this.sim.eggSecondsLeft(now);
      document.getElementById('eggWarm').style.width = Math.round(100 * (1 - Math.min(1, left / this.sim.ranch.eggWarmSeconds(this.state.egg.bred)))) + '%';
      set('eggTitle', 'Still warming');
      set('eggText', `Ready in ${fmtDuration(left)}. It can finish warming right here.`);
    } else {
      document.getElementById('eggWarm').style.width = Math.round(w * 100) + '%';
      set('eggTitle', "Something's wiggling");
      set('eggText', w <= 0 ? 'Tap the egg to keep it warm' : w < 0.4 ? 'It likes that. Keep going' : w < 0.8 ? 'It is getting warmer...' : 'Almost there!');
    }
    // a gentle way to a Nursery egg instead (before this one hatches)
    const alt = document.getElementById('eggAlt'), show = this.sim.ranch.eggs().length > 0 && !this.hatching;
    if (alt.hidden === show) alt.hidden = !show;
  }
  // once a second while the egg waits: the countdown, and a little sparkle the moment a warming egg is ready
  updateEggWait(dt) {
    this.eggWaitT = (this.eggWaitT ?? 0) - dt;
    if (this.eggWaitT > 0) return;
    this.eggWaitT = 1;
    const warming = !this.sim.eggReady(this.nowMs());
    if (this.eggWarming && !warming && this.egg && !this.hatching) {
      this.egg.tap();
      this.fx.emit('sparkles', this.egg.group.position.clone().add(new THREE.Vector3(0, 0.9, 0)), { count: 12, color: '#ffe7a8' });
      this.sfx.sparkle();
      if (this.view !== 'ranch') this.hud.toast('<b>The egg is ready!</b>Tap it to keep it warm.', 'love', 3200);
    }
    this.eggWarming = warming;
    this.updateEggHint();
  }

  tapEgg(point) {
    if (this.hatching) return;
    const st = this.state;
    const r = this.sim.warmEgg(this.nowMs());
    if (!r) return;
    if (!r.ok) {
      // still warming: a small "not yet" shake, no warmth
      this.egg.notYet();
      this.sfx.bounce();
      if (this.time - (this.notYetT ?? -99) > 2.5) {
        this.notYetT = this.time;
        this.hud.toast(`<b>Not yet!</b>This egg is still warming. Ready in ${fmtDuration(r.left)}.`, '', 2600);
      }
      this.updateEggHint();
      return;
    }
    this.egg.tap();
    this.egg.setWarmth(st.egg.warmth);
    if (st.egg.warmth > 0.3) this.sfx.crack(); else this.sfx.bounce();
    this.fx.emit('sparkles', point, { count: 5, color: '#ffe7a8' });
    this.updateEggHint();
    this.saveNow();
    if (r.hatch) this.hatch();
  }

  hatch() {
    this.hatching = true;
    this.hud.setSheet('closed', false);
    this.hud.updateEggRanch();   // the Ranch tab goes away until the baby has a name
    this.egg.wobV += 14;
    this.after(0.25, () => { this.egg.wobV -= 18; this.sfx.crack(); });
    this.after(0.55, () => { this.egg.wobV += 18; this.sfx.crack(); });
    this.after(0.85, () => {
      const p = this.egg.group.position.clone().add(new THREE.Vector3(0, 0.8, 0));
      this.egg.burst(this.scene);
      this.sfx.hatch();
      this.fx.emit('sparkles', p, { count: 24, speed: 3 });
      this.fx.emit('confetti', p, { count: 30 });
      document.getElementById('eggHint').hidden = true;
      this.slime.root.visible = true;
      this.slime.visible = true;
      this.slime.size = 0.08;
      this.slime.sizeV = 3;
      this.slime.hop(6);
      this.state.slime.bornAt = Date.now();
      this.state.phase = 'naming';
      const lin = this.state.slime.lineage || {};
      const sp = this.state.egg.bred?.special;
      const from = (lin.parents?.length ? `Hatched from ${lin.parents[0].name} and ${lin.parents[1].name}'s egg.${lin.spark ? ' The egg twinkled with a family spark.' : ''}` : sp ? `Hatched from ${eggLabel(this.state.egg.bred)}.` : 'Hatched from a warm, spotty egg.') +
        ` A little ${bodyName(this.state.slime)}!`;
      this.sim.remember('🥚', from, 'hatch');
      this.flash({ eyes: 'sleep', mouth: 'o' }, 0.9);
      this.lookOverride = { target: new THREE.Vector3(-3, 1, 2), until: this.time + 2.0 };
      this.after(1.3, () => { this.lookOverride = { target: new THREE.Vector3(3, 1.2, 2), until: this.time + 0.7 }; this.sfx.question(); });
      this.after(2.0, () => { this.lookOverride = null; this.flash({ eyes: 'sparkle', mouth: 'open', blush: 0.9 }, 1.6); this.sfx.mii(); this.hud.say('!!'); this.slime.hop(4); });
      this.after(3.0, () => this.askName());
      this.saveNow(true);
    });
  }

  askName() {
    const lin = this.state.slime.lineage || {};
    const parents = lin.parents?.length ? `${esc(lin.parents[0].name)} and ${esc(lin.parents[1].name)}` : null;
    this.hud.showNaming(name => {
      const st = this.state;
      st.slime.name = name;
      st.phase = 'play';
      this.hatching = false;
      this.hud.setPhase('play');
      this.remember('💧', `You named them ${name}.`, 'named');
      this.sfx.mii();
      this.slime.hop(5);
      this.flash({ eyes: 'happy', mouth: 'grin', blush: 1 }, 1.5);
      this.fx.emit('hearts', this.slime.headTopWorld(this.v1), { count: 5 });
      this.after(0.4, () => this.hud.say(`${name}!`, 1800));
      this.saveNow(true);
      this.layoutChanged();
    }, parents ? { title: `${parents}'s baby hatched!`, text: `They take after their parents a little. What will you call them?` } : {});
  }

  rename(name) {
    const old = this.state.slime.name;
    if (!name || name === old) return;
    this.state.slime.name = name;
    this.remember('💧', `${old} got a new name: ${name}.`);
    this.hud.say('♥');
    this.sfx.mii();
    this.saveNow(true);
  }
}
