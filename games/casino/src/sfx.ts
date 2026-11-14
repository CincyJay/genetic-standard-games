import { LoungeMusic } from './music.ts';

/**
 * Casino sound engine. Everything is synthesized with Web Audio, but modeled on
 * the physical sound (filtered noise for clay chips and cards, inharmonic partials
 * for coins, FM bells for wins) instead of plain tones, so nothing sounds like a beep.
 */
export class CasinoSound {
  enabled = true;
  /** Background music on/off (separate from sound effects). */
  musicOn = true;
  readonly music = new LoungeMusic();
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    const out = ctx.createGain();
    out.gain.value = 0.8;
    out.connect(comp).connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.ctx = ctx;
    this.out = out;
    this.noise = buf;
    // pause everything while the app is in the background
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
    this.syncMusic();
  }

  /** Starts or stops the background loop to match `musicOn`. */
  syncMusic(): void {
    if (!this.ctx || !this.out || !this.noise) return;
    if (this.musicOn) this.music.start(this.ctx, this.out, this.noise);
    else this.music.stop();
  }

  private ready(): AudioContext | null {
    return this.enabled && this.ctx && this.out && this.noise ? this.ctx : null;
  }

  /** Filtered noise burst. `sweepTo` glides the filter frequency. */
  private burst(type: BiquadFilterType, freq: number, q: number, dur: number, vol: number, at = 0, sweepTo?: number): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out!);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  /** Decaying sine partial. */
  private partial(freq: number, dur: number, vol: number, at = 0, to?: number): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** FM bell: warm attack, long shimmering decay. */
  private bell(freq: number, dur: number, vol: number, at = 0): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    car.frequency.value = freq;
    mod.frequency.value = freq * 3.5;
    modGain.gain.setValueAtTime(freq * 2.2, t);
    modGain.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur);
    mod.connect(modGain).connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g).connect(this.out!);
    car.start(t);
    mod.start(t);
    car.stop(t + dur + 0.05);
    mod.stop(t + dur + 0.05);
  }

  private rv(spread = 0.08): number {
    return 1 + (Math.random() * 2 - 1) * spread;
  }

  // ------------------------------------------------------------ table sounds
  /** One clay chip set down: a sharp clack with a short ring, then a softer settle. */
  chip(vol = 1, at = 0): void {
    const r = this.rv();
    this.burst('bandpass', 3200 * r, 5, 0.035, 0.45 * vol, at);
    this.partial(2350 * r, 0.05, 0.1 * vol, at);
    this.burst('bandpass', 2700 * r, 6, 0.03, 0.22 * vol, at + 0.04);
  }

  /** A small stack of chips pushed out or collected. */
  chips(n = 4, vol = 1): void {
    for (let i = 0; i < n; i++) this.chip(vol * (0.6 + Math.random() * 0.4), i * 0.045 + Math.random() * 0.015);
  }

  /** A card slid off the deck and landing on felt. */
  card(at = 0): void {
    this.burst('bandpass', 1300, 0.9, 0.09, 0.32, at, 3800);
    this.burst('lowpass', 420, 0.8, 0.05, 0.4, at + 0.07);
  }

  /** A card turned face up. */
  flip(at = 0): void {
    this.burst('highpass', 2600, 0.7, 0.03, 0.28, at);
    this.burst('bandpass', 1700, 2, 0.025, 0.18, at + 0.025);
  }

  /** Two knuckle taps on the table (poker "check"). */
  knock(): void {
    for (const at of [0, 0.13]) {
      this.burst('lowpass', 260, 1.2, 0.07, 0.7, at);
      this.partial(140, 0.07, 0.25, at, 90);
    }
  }

  /** Cards tossed into the muck. */
  fold(): void {
    this.burst('bandpass', 2200, 0.8, 0.12, 0.25, 0, 900);
  }

  /** Light UI press: a soft tick, not a beep. */
  tap(): void {
    this.burst('bandpass', 2400, 3, 0.018, 0.16);
    this.partial(700, 0.025, 0.05);
  }

  /** A lost hand: a muted thud. */
  invalid(): void {
    this.burst('lowpass', 320, 1, 0.14, 0.35);
    this.partial(150, 0.16, 0.12, 0, 95);
  }

  // ------------------------------------------------------------ machines
  /** Reels whirring for `seconds` (soft mechanical ticking that slows). */
  reelSpin(seconds: number): void {
    const n = Math.floor(seconds * 16);
    for (let i = 0; i < n; i++) {
      const at = i / 16;
      this.burst('bandpass', 1500 + (i % 3) * 200, 4, 0.02, 0.06 * (1 - (i / n) * 0.5), at);
    }
  }

  /** A reel locking into place. */
  reelStop(): void {
    this.partial(95, 0.14, 0.45, 0, 55);
    this.burst('bandpass', 1100, 2.5, 0.035, 0.28);
    this.burst('lowpass', 500, 1, 0.05, 0.2, 0.01);
  }

  /** Roulette ball: rolling on the rim, then bouncing through pockets and settling. */
  ballRoll(seconds: number): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    const roll = seconds * 0.7;
    // rolling: band-limited noise with a quick flutter
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + roll);
    f.Q.value = 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.3);
    g.gain.setValueAtTime(0.16, t + roll * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + roll);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(28, t);
    lfo.frequency.linearRampToValueAtTime(9, t + roll);
    lfoGain.gain.value = 0.07;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(this.out!);
    src.start(t);
    lfo.start(t);
    src.stop(t + roll + 0.05);
    lfo.stop(t + roll + 0.05);
    // pocket bounces: clicks with shrinking gaps and volume
    let at = roll - 0.1;
    let gap = 0.22;
    let vol = 0.55;
    for (let i = 0; i < 9; i++) {
      this.burst('bandpass', 3400 * this.rv(0.15), 5, 0.025, vol, at);
      this.partial(2100 * this.rv(0.1), 0.04, vol * 0.25, at);
      at += gap;
      gap *= 0.78;
      vol *= 0.78;
    }
  }

  // ------------------------------------------------------------ rewards
  /** Coins landing: bright metallic pings with inharmonic overtones. */
  coins(n = 6, at = 0): void {
    for (let i = 0; i < n; i++) {
      const base = 2400 + Math.random() * 1800;
      const when = at + i * 0.055 + Math.random() * 0.03;
      this.partial(base, 0.28, 0.06, when);
      this.partial(base * 1.48, 0.2, 0.035, when);
      this.partial(base * 2.07, 0.12, 0.02, when);
    }
  }

  /** Anticipation: a rising shimmer while the last reels keep spinning. */
  tension(seconds: number): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(880, t + seconds);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + seconds);
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 9;
    lg.gain.value = 0.03;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + seconds * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.1);
    lfo.connect(lg).connect(g.gain);
    o.connect(f).connect(g).connect(this.out!);
    o.start(t);
    lfo.start(t);
    o.stop(t + seconds + 0.15);
    lfo.stop(t + seconds + 0.15);
  }

  /** A feature symbol lands: bright bell ping. */
  scatterLand(n = 1): void {
    const notes = [1568, 1760, 2093, 2349, 2637, 3136];
    this.bell(notes[Math.min(n - 1, notes.length - 1)]!, 0.9, 0.1);
    this.partial(notes[Math.min(n - 1, notes.length - 1)]! * 2, 0.4, 0.03);
  }

  /** Small win: two soft bell notes and a few coins. */
  complete(): void {
    this.bell(1318, 0.9, 0.12);
    this.bell(1976, 0.9, 0.08, 0.09);
    this.coins(3, 0.15);
  }

  /** Big win: rising bell arpeggio over a shower of coins. */
  win(): void {
    this.music.duck(2.5);
    [1047, 1319, 1568, 2093].forEach((f, i) => this.bell(f, 1.2, 0.12, i * 0.1));
    this.coins(14, 0.2);
  }

  // ------------------------------------------------------------ compatibility
  /** Older call sites: a chip clack (`step` is ignored). */
  drop(_step = 0): void {
    this.chip();
  }
  lift(): void {
    this.chip(0.6);
  }
}
