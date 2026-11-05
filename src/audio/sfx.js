// Every sound is synthesized with Web Audio: no audio files to load.
// The slime's "voice" is a set of little chirps whose pitch drops as it grows.

const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export class Sfx {
  constructor() {
    this.ctx = null;
    this.sound = true;
    this.music = true;
    this.voice = 1.3;
    this.musicWanted = false;
    this.purrNodes = null;
  }

  build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch { this.ctx = null; return; }
    const c = this.ctx;
    this.out = c.createDynamicsCompressor();
    this.out.threshold.value = -16;
    this.out.ratio.value = 3;
    this.out.connect(c.destination);
    this.master = c.createGain();
    this.master.gain.value = this.sound ? 0.75 : 0;
    this.master.connect(this.out);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.out);
    const len = c.sampleRate;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.purrNodes = null;
  }

  // Called on every user gesture. iPhones only allow audio to start from a finished tap
  // (touchend/click), so the context is created there, and rebuilt if it gets stuck.
  unlock(type) {
    const strong = type === 'pointerup' || type === 'touchend' || type === 'click' || type === 'keydown';
    if (!this.ctx) {
      if (IS_IOS && !strong) return;
      this.build();
      this.updateMusic();
    } else if (this.stuck && strong) {
      try { this.ctx.close(); } catch { /* ignore */ }
      this.ctx = null;
      this.stuck = false;
      this.build();
      this.updateMusic();
    }
    const c = this.ctx;
    if (!c || c.state === 'running') return;
    c.resume().catch(() => {});
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
    } catch { /* ignore */ }
    if (strong) {
      clearTimeout(this.stuckT);
      this.stuckT = setTimeout(() => { if (this.ctx === c && c.state !== 'running' && !document.hidden) this.stuck = true; }, 700);
    }
  }

  status() {
    const st = this.ctx ? this.ctx.state : 'not started yet';
    const mode = navigator.audioSession ? ` · mode: ${navigator.audioSession.type}` : '';
    return `Audio: ${st}${mode}${this.sound ? '' : ' · sound is off'}`;
  }

  test() {
    this.unlock('click');
    setTimeout(() => { this.sparkle(); this.mii(); }, 60);
  }

  // On iPhone, silent mode mutes web audio unless the page asks to behave like media playback.
  setPlayOnSilent(on) {
    try { if (navigator.audioSession) navigator.audioSession.type = on ? 'playback' : 'auto'; } catch { /* unsupported */ }
  }

  get ok() { return !!(this.ctx && this.sound && this.ctx.state === 'running'); }

  setSound(on) {
    this.sound = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.75 : 0, this.ctx.currentTime, 0.05);
    if (!on) this.purr(false);
    this.updateMusic();
  }
  setMusic(on) { this.music = on; this.updateMusic(); }
  setMusicWanted(on) { this.musicWanted = on; this.updateMusic(); }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {}); }

  // ---------- primitives ----------
  tone(o) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || o.dur));
    const g = c.createGain();
    const v = o.vol ?? 0.25;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.att || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.vib) {
      const l = c.createOscillator();
      l.frequency.value = o.vib[0];
      const lg = c.createGain();
      lg.gain.value = o.vib[1];
      l.connect(lg).connect(osc.frequency);
      l.start(t); l.stop(t + o.dur + 0.05);
    }
    if (o.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = o.lp;
      node.connect(f); node = f;
    }
    node.connect(g).connect(o.bus || this.master);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }

  noise(o) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t + (o.att || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5, o.dur + 0.05);
  }

  // ---------- slime voice ----------
  boop(p = 1) {
    const v = this.voice * p * (0.94 + Math.random() * 0.12);
    this.tone({ f: 520 * v, f2: 280 * v, dur: 0.16, vol: 0.3 });
    this.tone({ type: 'triangle', f: 1040 * v, f2: 640 * v, dur: 0.07, vol: 0.05 });
    this.noise({ filter: 'lowpass', f: 700, dur: 0.06, vol: 0.08 });
  }
  giggle() {
    const v = this.voice;
    const n = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const base = (880 + Math.random() * 220) * v * (1 - i * 0.04);
      this.tone({ type: 'triangle', f: base, f2: base * 1.35, dur: 0.085, delay: i * 0.08, vol: 0.13, vib: [28, 30] });
    }
  }
  coo() {
    const v = this.voice;
    this.tone({ f: 640 * v, f2: 1020 * v, dur: 0.32, vol: 0.18, vib: [9, 22], att: 0.03 });
  }
  mii() {
    const v = this.voice;
    this.tone({ f: 760 * v, f2: 1180 * v, dur: 0.16, vol: 0.18, vib: [12, 18] });
    this.tone({ f: 1180 * v, f2: 1400 * v, dur: 0.24, delay: 0.15, vol: 0.16, vib: [10, 25] });
  }
  question() {
    const v = this.voice;
    this.tone({ f: 600 * v, f2: 980 * v, dur: 0.22, vol: 0.15, vib: [8, 12], glide: 0.22 });
  }
  sad() {
    const v = this.voice;
    this.tone({ f: 620 * v, f2: 380 * v, dur: 0.55, vol: 0.13, vib: [6, 14], att: 0.04 });
  }
  grumble() {
    const v = this.voice;
    this.tone({ type: 'triangle', f: 300 * v, f2: 240 * v, dur: 0.3, vol: 0.1, vib: [18, 20], lp: 1200 });
  }
  yawn() {
    const v = this.voice;
    this.tone({ f: 520 * v, f2: 250 * v, dur: 1.0, att: 0.25, vol: 0.12, vib: [5, 12] });
    this.noise({ filter: 'lowpass', f: 900, dur: 0.9, att: 0.3, vol: 0.03 });
  }
  snore() {
    this.noise({ filter: 'lowpass', f: 380, dur: 1.3, att: 0.6, vol: 0.035 });
    this.tone({ f: 110, dur: 1.2, att: 0.6, vol: 0.02 });
  }
  dizzy() {
    const v = this.voice;
    this.tone({ type: 'triangle', f: 900 * v, f2: 300 * v, dur: 0.6, vol: 0.12, vib: [14, 120] });
  }
  kiss() {
    this.tone({ f: 900 * this.voice, f2: 1500 * this.voice, dur: 0.1, vol: 0.12 });
    this.tone({ f: 1800, f2: 600, dur: 0.05, delay: 0.1, vol: 0.12 });
  }
  hum() {
    const v = this.voice * 0.9;
    [0, 4, 7, 4].forEach((n, i) => this.tone({ f: NOTE(72 + n) * v, dur: 0.3, delay: i * 0.22, vol: 0.06, vib: [6, 6], att: 0.05 }));
  }

  // ---------- eating ----------
  munch(kind) {
    switch (kind) {
      case 'crunch':
        for (let i = 0; i < 3; i++) this.noise({ f: 2200 + Math.random() * 800, q: 1.2, dur: 0.06, delay: i * 0.17, vol: 0.18 });
        break;
      case 'clink':
        for (let i = 0; i < 3; i++) {
          this.tone({ type: 'square', f: 2300 + Math.random() * 600, dur: 0.09, delay: i * 0.17, vol: 0.03, lp: 5000 });
          this.tone({ f: 3400 + Math.random() * 400, dur: 0.18, delay: i * 0.17, vol: 0.05 });
        }
        break;
      case 'sizzle':
        this.noise({ filter: 'highpass', f: 3500, dur: 0.7, vol: 0.06, att: 0.05 });
        for (let i = 0; i < 2; i++) this.noise({ f: 1800, q: 1, dur: 0.05, delay: i * 0.17, vol: 0.12 });
        break;
      case 'squelch':
        for (let i = 0; i < 3; i++) this.noise({ f: 500, f2: 1200, q: 3, dur: 0.12, delay: i * 0.17, vol: 0.14 });
        break;
      case 'zap':
        this.tone({ type: 'sawtooth', f: 1800, f2: 200, dur: 0.15, vol: 0.05, lp: 3000 });
        for (let i = 0; i < 4; i++) this.noise({ filter: 'highpass', f: 5000, dur: 0.02, delay: 0.1 + i * 0.07, vol: 0.12 });
        break;
      case 'chime':
        [1568, 2093, 2637].forEach((f, i) => this.tone({ f, dur: 0.9, delay: i * 0.06, vol: 0.06 }));
        break;
      default:
        this.noise({ f: 1500, dur: 0.06, vol: 0.12 });
    }
  }
  gulp() {
    const v = this.voice;
    this.tone({ f: 330 * v, f2: 110 * v, dur: 0.22, vol: 0.26 });
    this.tone({ f: 900, f2: 1500, dur: 0.05, delay: 0.18, vol: 0.05 });
  }
  bleh() {
    const v = this.voice;
    this.tone({ type: 'triangle', f: 420 * v, f2: 300 * v, dur: 0.35, vol: 0.12, vib: [22, 25] });
  }
  sneeze() {
    const v = this.voice;
    this.tone({ f: 500 * v, f2: 900 * v, dur: 0.25, vol: 0.08, att: 0.2 });
    this.noise({ f: 2500, q: 0.6, dur: 0.18, delay: 0.27, vol: 0.25 });
  }

  // ---------- world ----------
  pop() {
    this.tone({ f: 1400, f2: 500, dur: 0.06, vol: 0.12 });
    this.noise({ filter: 'highpass', f: 3000, dur: 0.03, vol: 0.08 });
  }
  plip() { this.tone({ f: 1500 + Math.random() * 400, f2: 2300, dur: 0.05, vol: 0.04 }); }
  sparkle() {
    [1318.5, 1568, 1975.5, 2637].forEach((f, i) => this.tone({ type: 'triangle', f, dur: 0.25, delay: i * 0.05, vol: 0.06 }));
  }
  buy() {
    this.tone({ type: 'triangle', f: 988, dur: 0.12, vol: 0.12 });
    this.tone({ type: 'triangle', f: 1319, dur: 0.2, delay: 0.08, vol: 0.12 });
  }
  error() { this.tone({ type: 'square', f: 230, f2: 180, dur: 0.16, vol: 0.04, lp: 900 }); }
  crack() {
    this.noise({ f: 3200, q: 2, dur: 0.05, vol: 0.25 });
    this.noise({ f: 1800, q: 2, dur: 0.07, delay: 0.05, vol: 0.18 });
  }
  hatch() {
    this.noise({ f: 2000, q: 0.8, dur: 0.25, vol: 0.3 });
    this.sparkle();
    setTimeout(() => this.mii(), 450);
  }
  levelUp() {
    [72, 76, 79, 84].forEach((n, i) => {
      this.tone({ f: NOTE(n), dur: 0.7, delay: i * 0.12, vol: 0.1 });
      this.tone({ f: NOTE(n) * 2, dur: 0.4, delay: i * 0.12, vol: 0.03 });
    });
    this.tone({ type: 'triangle', f: NOTE(88), dur: 1.2, delay: 0.5, vol: 0.06, vib: [6, 8] });
  }
  combo() {
    [67, 71, 74, 79, 83].forEach((n, i) => this.tone({ type: 'triangle', f: NOTE(n), dur: 0.4, delay: i * 0.06, vol: 0.08 }));
  }
  bounce() { this.tone({ f: 280 * this.voice, f2: 520 * this.voice, dur: 0.12, vol: 0.1 }); }
  tickle() {
    const v = this.voice;
    this.tone({ type: 'triangle', f: 1000 * v, f2: 1300 * v, dur: 0.07, vol: 0.08, vib: [30, 40] });
    this.tone({ type: 'triangle', f: 1100 * v, f2: 1400 * v, dur: 0.07, delay: 0.08, vol: 0.07, vib: [30, 40] });
  }

  // ---------- new moments ----------
  stretch() {
    const v = this.voice;
    this.tone({ type: 'triangle', f: 500 * v, f2: 1300 * v, dur: 0.45, vol: 0.08, vib: [18, 30], att: 0.05 });
  }
  boing() {
    this.tone({ f: 180, f2: 520, dur: 0.18, vol: 0.2 });
    this.tone({ f: 520, f2: 260, dur: 0.35, delay: 0.12, vol: 0.12, vib: [16, 40] });
  }
  snap() {
    this.noise({ filter: 'highpass', f: 2500, dur: 0.05, vol: 0.25 });
    this.tone({ f: 900, f2: 200, dur: 0.15, vol: 0.18 });
  }
  wobble() {
    const v = this.voice;
    this.tone({ type: 'triangle', f: 380 * v, f2: 300 * v, dur: 0.16, vol: 0.08, vib: [26, 60] });
  }
  whee() {
    const v = this.voice;
    this.tone({ f: 600 * v, f2: 1500 * v, dur: 0.5, vol: 0.14, vib: [8, 30] });
  }
  hic() {
    const v = this.voice;
    this.tone({ type: 'triangle', f: 1300 * v, f2: 900 * v, dur: 0.07, vol: 0.16 });
    this.noise({ f: 1500, q: 3, dur: 0.04, vol: 0.12 });
  }
  burp() {
    this.tone({ type: 'sawtooth', f: 120, f2: 85, dur: 0.45, vol: 0.12, lp: 600, vib: [22, 14] });
    this.noise({ filter: 'lowpass', f: 500, dur: 0.4, vol: 0.06 });
  }
  slap() {
    this.noise({ f: 2200, q: 0.7, dur: 0.08, vol: 0.35 });
    this.noise({ filter: 'highpass', f: 4000, dur: 0.12, delay: 0.02, vol: 0.12 });
    this.sparkle();
  }
  nom() {
    const v = this.voice;
    for (let i = 0; i < 2; i++) this.tone({ type: 'triangle', f: 700 * v, f2: 500 * v, dur: 0.08, delay: i * 0.12, vol: 0.12 });
  }
  hey() {
    const v = this.voice;
    this.tone({ type: 'triangle', f: 500 * v, f2: 760 * v, dur: 0.16, vol: 0.13, lp: 2400 });
    this.tone({ type: 'triangle', f: 760 * v, f2: 420 * v, dur: 0.22, delay: 0.15, vol: 0.12, lp: 2400 });
  }
  ow() {
    const v = this.voice;
    this.tone({ f: 1100 * v, f2: 700 * v, dur: 0.14, vol: 0.12, vib: [30, 50] });
  }
  hi() {
    const v = this.voice;
    this.tone({ f: 700 * v, f2: 1050 * v, dur: 0.14, vol: 0.15 });
    this.tone({ f: 1050 * v, f2: 950 * v, dur: 0.18, delay: 0.13, vol: 0.12, vib: [10, 20] });
  }
  boo() {
    const v = this.voice;
    this.tone({ f: 400 * v, f2: 1200 * v, dur: 0.22, vol: 0.18 });
    this.noise({ f: 1800, q: 0.8, dur: 0.1, vol: 0.12 });
  }
  sing(clumsy = false) {
    const v = this.voice;
    const melody = [0, 4, 7, 9, 7, 4, 12];
    melody.forEach((n, i) => {
      const off = clumsy ? (Math.random() - 0.5) * 4 : 0;
      this.tone({ f: NOTE(72 + n + off) * v * 0.9, dur: 0.3, delay: i * 0.24, vol: 0.08, vib: [6, 8], att: 0.04 });
    });
  }
  // a slow, different little tune (a grown slime dreaming of the ranch); mid-range notes only (phone speakers)
  dreamyHum() {
    const v = this.voice * 0.9;
    [0, 3, 7, 5, 3, 0].forEach((n, i) => this.tone({ f: NOTE(67 + n) * v, dur: 0.55, delay: i * 0.5, vol: 0.055, vib: [4, 5], att: 0.12 }));
  }
  rainbow() {
    [60, 64, 67, 72, 76, 79, 84, 88].forEach((n, i) => this.tone({ type: 'triangle', f: NOTE(n), dur: 0.35, delay: i * 0.07, vol: 0.07 }));
  }

  // Low rumble while being petted.
  // Petting sound: a soft, contented "mmm" hum (not a low rumble: phone speakers turn those into buzz).
  // A warm tone in the middle of the range small speakers play well, with gentle vibrato, a slow
  // breathing swell and little rises and falls in pitch. It keeps running and only fades in and out,
  // so pauses while stroking don't click. Can be turned off in Settings.
  purr(on) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (on && this.purrOff) on = false;
    if (!this.purrNodes) {
      if (!on || !this.ok) return;
      const osc = c.createOscillator(); osc.type = 'sine';
      const osc2 = c.createOscillator(); osc2.type = 'sine';
      const o2g = c.createGain(); o2g.gain.value = 0.12;
      const vib = c.createOscillator(); vib.type = 'sine'; vib.frequency.value = 5.2;
      const vibg = c.createGain(); vibg.gain.value = 14;            // +-14 cents
      vib.connect(vibg); vibg.connect(osc.detune); vibg.connect(osc2.detune);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.4;
      const breath = c.createGain(); breath.gain.value = 0.8;
      const br = c.createOscillator(); br.type = 'sine'; br.frequency.value = 0.45;
      const brg = c.createGain(); brg.gain.value = 0.2;
      br.connect(brg).connect(breath.gain);
      const out = c.createGain(); out.gain.value = 0;
      osc.connect(lp); osc2.connect(o2g).connect(lp);
      lp.connect(breath).connect(out).connect(this.master);
      for (const o of [osc, osc2, vib, br]) o.start();
      this.purrNodes = { osc, osc2, out, on: false, nextGlide: 0, step: 0 };
    }
    const n = this.purrNodes, t = c.currentTime;
    if (on) {
      // drift between a few nearby notes, like humming to itself
      if (t >= n.nextGlide) {
        const steps = [0, 2, 4, 2, 0, -3, 0, 5, 4, 0];
        const semi = steps[n.step++ % steps.length];
        const f = 300 * (this.voice || 1) * Math.pow(2, semi / 12);
        n.osc.frequency.setTargetAtTime(f, t, n.on ? 0.09 : 0.001);
        n.osc2.frequency.setTargetAtTime(f * 2, t, n.on ? 0.09 : 0.001);
        n.nextGlide = t + 0.55 + Math.random() * 0.5;
      }
    }
    if (on !== n.on) {
      n.on = on;
      n.out.gain.cancelScheduledValues(t);
      n.out.gain.setTargetAtTime(on && this.sound ? 0.03 : 0, t, on ? 0.15 : 0.3);
    }
  }
  setPurr(enabled) { this.purrOff = !enabled; if (!enabled) this.purr(false); }

  // ---------- music box lullaby (plays once a Music Box is owned) ----------
  updateMusic() {
    const want = this.ctx && this.sound && this.music && this.musicWanted;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(want ? 1 : 0, this.ctx.currentTime, 0.6);
    if (want && !this.musicTimer) {
      this.nextNote = this.ctx.currentTime + 0.2;
      this.step = 0;
      this.phrase = this.makePhrase();
      this.musicTimer = setInterval(() => this.scheduleMusic(), 150);
    } else if (!want && this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
  makePhrase() {
    const out = [];
    let idx = 5;
    for (let i = 0; i < 16; i++) {
      idx = Math.max(0, Math.min(9, idx + Math.floor(Math.random() * 5) - 2));
      out.push(Math.random() < 0.18 ? null : idx);
    }
    out[15] = null; out[0] = 5;
    return out;
  }
  scheduleMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    while (this.nextNote < this.ctx.currentTime + 0.5) {
      const i = this.step % 16;
      if (i === 0 && this.step > 0 && Math.random() < 0.5) this.phrase = this.makePhrase();
      const deg = this.phrase[i];
      const when = this.nextNote - this.ctx.currentTime;
      if (deg !== null) {
        const n = 72 + PENTA[deg % 5] + 12 * Math.floor(deg / 5);
        this.bell(NOTE(n), when, 0.05);
      }
      if (i % 8 === 0) this.bell(NOTE(48 + (i === 0 ? 0 : 7)), when, 0.035);
      this.nextNote += 0.42;
      this.step++;
    }
  }
  bell(f, delay, vol) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + Math.max(0, delay);
    for (const [mult, v, d] of [[1, 1, 1.6], [2.01, 0.3, 0.8], [3.02, 0.12, 0.5]]) {
      const o = c.createOscillator(); o.frequency.value = f * mult;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(this.musicBus);
      o.start(t); o.stop(t + d + 0.05);
    }
  }
}
