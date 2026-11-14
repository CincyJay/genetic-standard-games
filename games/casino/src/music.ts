/**
 * Background music: an endless, gentle lounge-jazz loop synthesized live with
 * Web Audio (electric piano comping, upright bass walking line, brushed drums
 * and an occasional vibraphone phrase). Nothing to license, nothing to download.
 * Each bar is generated as it's needed, so the loop never repeats exactly.
 */

// 8-bar progression in C: chord tones as MIDI notes (piano voicing), bass root.
const PROGRESSION: { voicing: number[]; root: number; scale: number[] }[] = [
  { voicing: [57, 60, 64, 67], root: 41, scale: [65, 67, 69, 72, 74, 76] }, // Fmaj9
  { voicing: [55, 59, 62, 67], root: 40, scale: [64, 67, 69, 71, 74, 76] }, // Em7
  { voicing: [53, 57, 60, 64], root: 38, scale: [62, 65, 69, 72, 74, 77] }, // Dm9
  { voicing: [53, 57, 59, 64], root: 43, scale: [62, 65, 67, 71, 74, 76] }, // G13
  { voicing: [55, 59, 62, 64], root: 36, scale: [64, 67, 69, 71, 72, 76] }, // Cmaj9
  { voicing: [55, 59, 60, 64], root: 45, scale: [64, 67, 69, 72, 76, 79] }, // Am9
  { voicing: [53, 57, 60, 64], root: 38, scale: [62, 65, 69, 72, 74, 77] }, // Dm9
  { voicing: [53, 56, 59, 65], root: 43, scale: [62, 65, 67, 71, 74, 77] }, // G7b9
];

const BPM = 88;
const BEAT = 60 / BPM;
const SWING = 0.62; // fraction of the beat where the off-beat eighth falls

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class LoungeMusic {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBar = 0;
  private bar = 0;
  private playing = false;
  volume = 0.16;

  /** Starts (or resumes) the loop on the given audio graph. */
  start(ctx: AudioContext, dest: AudioNode, noise: AudioBuffer): void {
    if (this.playing) return;
    if (this.ctx !== ctx) {
      this.ctx = ctx;
      this.noise = noise;
      const bus = ctx.createGain();
      bus.gain.value = 0;
      // gentle room: a feedback delay to soften everything
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5200;
      const delay = ctx.createDelay(1);
      delay.delayTime.value = BEAT * 0.75;
      const fb = ctx.createGain();
      fb.gain.value = 0.22;
      const wet = ctx.createGain();
      wet.gain.value = 0.18;
      bus.connect(lp).connect(dest);
      lp.connect(delay).connect(fb).connect(delay);
      delay.connect(wet).connect(dest);
      this.bus = bus;
    }
    this.playing = true;
    const t = this.ctx.currentTime;
    this.bus!.gain.cancelScheduledValues(t);
    this.bus!.gain.setValueAtTime(this.bus!.gain.value, t);
    this.bus!.gain.linearRampToValueAtTime(this.volume, t + 2.5);
    this.nextBar = Math.max(this.nextBar, t + 0.1);
    this.timer = setInterval(() => this.schedule(), 200);
    this.schedule();
  }

  stop(): void {
    if (!this.playing || !this.ctx || !this.bus) return;
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(0, t + 0.8);
    this.nextBar = t + 1;
  }

  /** Quieter while something loud (a big win) plays, then back up. */
  duck(seconds: number): void {
    if (!this.ctx || !this.bus || !this.playing) return;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(this.volume * 0.25, t + 0.3);
    this.bus.gain.setValueAtTime(this.volume * 0.25, t + seconds);
    this.bus.gain.linearRampToValueAtTime(this.volume, t + seconds + 1.5);
  }

  private schedule(): void {
    if (!this.ctx || !this.playing) return;
    while (this.nextBar < this.ctx.currentTime + 1.2) {
      this.playBar(this.nextBar, this.bar);
      this.nextBar += BEAT * 4;
      this.bar = (this.bar + 1) % PROGRESSION.length;
    }
  }

  private playBar(t0: number, i: number): void {
    const ch = PROGRESSION[i]!;
    const next = PROGRESSION[(i + 1) % PROGRESSION.length]!;
    const off = (beat: number) => t0 + (beat + SWING) * BEAT;
    const on = (beat: number) => t0 + beat * BEAT;
    // piano comping: a long chord on 1, a short stab on the and of 2 (sometimes 3)
    this.piano(ch.voicing, on(0), BEAT * 1.6, 0.05);
    this.piano(ch.voicing, Math.random() < 0.5 ? off(1) : on(2), BEAT * 0.5, 0.035);
    if (Math.random() < 0.35) this.piano(ch.voicing, off(3), BEAT * 0.4, 0.03);
    // walking bass: root, chord tone, chord tone, chromatic approach to the next root
    const tones = [ch.root, ch.root + (Math.random() < 0.5 ? 7 : 3 + (ch.voicing[1]! - ch.voicing[0]! === 4 ? 1 : 0)), ch.root + 7 + (Math.random() < 0.5 ? 0 : 5), next.root + (Math.random() < 0.5 ? 1 : -1)];
    tones.forEach((n, b) => this.bass(n, on(b), BEAT * 0.9));
    // brushes: swish on every beat, accents on 2 and 4, ride on the swung eighths
    for (let b = 0; b < 4; b++) {
      this.brush(on(b), b % 2 ? 0.05 : 0.03);
      if (Math.random() < 0.6) this.ride(off(b), 0.012);
      this.ride(on(b), 0.018);
    }
    // vibraphone: a short phrase every other bar or so
    if (Math.random() < 0.55) {
      let at = Math.floor(Math.random() * 3);
      const n = 2 + Math.floor(Math.random() * 3);
      let idx = Math.floor(Math.random() * ch.scale.length);
      for (let k = 0; k < n && at < 4; k++) {
        this.vibes(ch.scale[idx]!, (k % 2 ? off : on)(Math.floor(at)), BEAT * 1.4, 0.03);
        idx = Math.max(0, Math.min(ch.scale.length - 1, idx + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))));
        at += k % 2 ? 1 : 0;
      }
    }
  }

  /** Electric piano: sine + soft FM bark, slow tremolo. */
  private piano(notes: number[], t: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    notes.forEach((m, k) => {
      const at = t + k * 0.012; // slight roll
      const car = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const mg = ctx.createGain();
      car.frequency.value = hz(m);
      mod.frequency.value = hz(m) * 1;
      mg.gain.setValueAtTime(hz(m) * 0.9, at);
      mg.gain.exponentialRampToValueAtTime(hz(m) * 0.08, at + 0.4);
      mod.connect(mg).connect(car.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
      g.gain.exponentialRampToValueAtTime(vol * 0.4, at + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      car.connect(g).connect(this.bus!);
      car.start(at);
      mod.start(at);
      car.stop(at + dur + 0.05);
      mod.stop(at + dur + 0.05);
    });
  }

  /** Upright bass: low triangle with a quick pluck and decay. */
  private bass(m: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz(m);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(260, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.bus!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseHit(type: BiquadFilterType, freq: number, q: number, t: number, attack: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.bus!);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /** Brush swish on the snare. */
  private brush(t: number, vol: number): void {
    this.noiseHit('bandpass', 2600, 0.7, t, 0.05, 0.22, vol);
  }

  /** Soft ride cymbal tick. */
  private ride(t: number, vol: number): void {
    this.noiseHit('highpass', 7000, 0.5, t, 0.002, 0.35, vol);
  }

  /** Vibraphone: pure tone with a 4th-partial shimmer and slow vibrato. */
  private vibes(m: number, t: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const trem = ctx.createOscillator();
    const tg = ctx.createGain();
    trem.frequency.value = 5.5;
    tg.gain.value = vol * 0.3;
    trem.connect(tg).connect(g.gain);
    [1, 4].forEach((p, k) => {
      const o = ctx.createOscillator();
      o.frequency.value = hz(m) * p;
      const pg = ctx.createGain();
      pg.gain.value = k ? 0.15 : 1;
      o.connect(pg).connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
    g.connect(this.bus!);
    trem.start(t);
    trem.stop(t + dur + 0.05);
  }
}
