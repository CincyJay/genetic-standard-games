/**
 * Synthesized sound effects via Web Audio: zero asset files, tiny download,
 * consistent "soft, bubbly" sound across games. Recorded SFX can replace any
 * cue later without changing callers.
 */
type Wave = OscillatorType;

interface Tone {
  freq: number;
  /** Frequency at the end of the tone (pitch glide). */
  to?: number;
  dur: number;
  wave?: Wave;
  vol?: number;
  delay?: number;
}

export class SynthAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  /** Call from the first user gesture (browsers block audio before that). */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  /** Pause output (e.g. while a full-screen ad plays). */
  duck(on: boolean): void {
    if (!this.ctx) return;
    void (on ? this.ctx.suspend() : this.ctx.resume());
  }

  play(tones: Tone[]): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    for (const t of tones) {
      const start = now + (t.delay ?? 0);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = t.wave ?? 'sine';
      osc.frequency.setValueAtTime(t.freq, start);
      if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.dur);
      const vol = t.vol ?? 0.3;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(vol, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
      osc.connect(gain).connect(this.master);
      osc.start(start);
      osc.stop(start + t.dur + 0.02);
    }
  }

  // ---- Shared cue library -------------------------------------------------
  tap(): void {
    this.play([{ freq: 900, to: 600, dur: 0.05, wave: 'triangle', vol: 0.15 }]);
  }
  lift(): void {
    this.play([{ freq: 420, to: 760, dur: 0.09, vol: 0.22 }]);
  }
  /** `step` raises the pitch so consecutive drops form a rising scale. */
  drop(step = 0): void {
    const base = 520 * Math.pow(2, (step % 8) / 12);
    this.play([{ freq: base * 1.6, to: base, dur: 0.11, vol: 0.28 }]);
  }
  invalid(): void {
    this.play([
      { freq: 220, to: 180, dur: 0.08, wave: 'square', vol: 0.06 },
      { freq: 200, to: 160, dur: 0.08, wave: 'square', vol: 0.06, delay: 0.09 },
    ]);
  }
  complete(): void {
    this.play([
      { freq: 784, dur: 0.12, vol: 0.2 },
      { freq: 1047, dur: 0.12, vol: 0.2, delay: 0.07 },
      { freq: 1319, dur: 0.22, vol: 0.18, delay: 0.14, wave: 'triangle' },
    ]);
  }
  win(): void {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    this.play(notes.map((f, i) => ({ freq: f, dur: 0.25, vol: 0.18, delay: i * 0.08, wave: 'triangle' as Wave })));
  }
}
