import Phaser from 'phaser';
import { THEME, audio, haptics, save } from '../services.ts';
import { CHAPTERS, SPEAKERS, type Beat, type Chapter } from '../story.ts';
import { drawBackground } from './background.ts';

const MONO = '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace';
const GREEN = 0x3ddc84;
const DIM = '#5d6b86';
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

type Card = { kind: 'title'; beat: Beat } | { kind: 'log'; beat: Beat } | { kind: 'online'; beat: Beat };

/** Plays story beats as a vault terminal, then starts the level. */
export class StoryScene extends Phaser.Scene {
  private cards: Card[] = [];
  private cardIndex = 0;
  private lineIndex = 0;
  private level = 1;
  private beatKeys: string[] = [];
  private layer: Phaser.GameObjects.Container | null = null;
  private logY = 0;
  private typing: Phaser.Time.TimerEvent | null = null;
  private finishTyping: (() => void) | null = null;
  private continueBtn: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('story');
  }

  init(data: { beats: string[]; level: number }): void {
    this.level = data.level;
    this.beatKeys = data.beats;
    this.cardIndex = 0;
    this.lineIndex = 0;
    this.layer = null;
    const all: Beat[] = CHAPTERS.flatMap((c) =>
      (['intro', 'mid', 'outro'] as const).map((kind) => ({ key: `c${c.id}-${kind}`, chapter: c, kind, lines: c[kind] })),
    );
    this.cards = [];
    for (const key of data.beats) {
      const beat = all.find((b) => b.key === key);
      if (!beat) continue;
      if (beat.kind === 'intro') this.cards.push({ kind: 'title', beat });
      this.cards.push({ kind: 'log', beat });
      if (beat.kind === 'outro') this.cards.push({ kind: 'online', beat });
    }
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    drawBackground(this);
    // faint scanlines
    const scan = this.add.graphics().setDepth(50);
    scan.fillStyle(0x000000, 0.12);
    for (let y = 0; y < h; y += 6) scan.fillRect(0, y, w, 2);

    const skip = this.add
      .text(w - 60, 90, 'SKIP ›', { fontFamily: MONO, fontSize: '34px', fontStyle: '700', color: DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(60);
    skip.on('pointerup', () => this.finish());
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.advance();
    });
    this.showCard();
  }

  // ------------------------------------------------------------- flow
  private advance(): void {
    if (this.finishTyping) {
      this.finishTyping();
      return;
    }
    const card = this.cards[this.cardIndex];
    if (card?.kind === 'log' && this.lineIndex < card.beat.lines.length) {
      this.typeNextLine(card.beat);
      return;
    }
    audio.tap();
    this.cardIndex++;
    if (this.cardIndex >= this.cards.length) this.finish();
    else this.showCard();
  }

  private finish(): void {
    save.update((d) => {
      for (const k of this.beatKeys) if (!d.storySeen.includes(k)) d.storySeen.push(k);
    });
    this.scene.start('game', { level: this.level });
  }

  private showCard(): void {
    this.layer?.destroy();
    this.typing?.remove();
    this.typing = null;
    this.finishTyping = null;
    this.continueBtn = null;
    const card = this.cards[this.cardIndex];
    if (!card) return this.finish();
    this.layer = this.add.container(0, 0);
    this.drawHeader(card.beat);
    if (card.kind === 'title') this.showTitle(card.beat.chapter);
    else if (card.kind === 'online') this.showOnline(card.beat.chapter);
    else {
      this.lineIndex = 0;
      this.logY = 330;
      this.typeNextLine(card.beat);
    }
  }

  // ----------------------------------------------------------- pieces
  private status(beat: Beat): { day: number; power: number } {
    const c = beat.chapter;
    if (beat.kind === 'intro') return { day: c.day, power: c.powerStart };
    if (beat.kind === 'mid') return { day: c.day + 3, power: Math.round((c.powerStart + c.powerEnd) / 2) };
    return { day: c.day + 6, power: c.powerEnd };
  }

  private drawHeader(beat: Beat): void {
    const { width: w } = this.scale;
    const { day, power } = this.status(beat);
    const t = this.mono(60, 90, `DAY ${day}  ·  SECTOR ${beat.chapter.sector}  ·  PWR ${power}%`, 32, '700', DIM).setOrigin(0, 0.5);
    const g = this.add.graphics();
    g.fillStyle(0x1d2a44, 1);
    g.fillRect(60, 140, w - 120, 6);
    g.fillStyle(GREEN, 0.8);
    g.fillRect(60, 140, ((w - 120) * power) / 100, 6);
    this.layer!.add([t, g]);
  }

  private showTitle(c: Chapter): void {
    const { width: w, height: h } = this.scale;
    const sector = this.mono(w / 2, h * 0.4, `SECTOR ${c.sector}`, 130, '700', THEME.ink);
    const name = this.mono(w / 2, h * 0.4 + 120, c.title.toUpperCase(), 52, '400', DIM);
    const obj = this.mono(w / 2, h * 0.4 + 230, `> ${c.objective.toUpperCase()}_`, 34, '700', hex(GREEN));
    this.layer!.add([sector, name, obj]);
    this.tweens.add({ targets: obj, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    this.addContinue('BEGIN');
    this.fadeIn();
  }

  private showOnline(c: Chapter): void {
    const { width: w, height: h } = this.scale;
    const title = this.mono(w / 2, h * 0.36, `SECTOR ${c.sector} ONLINE`, 86, '700', hex(GREEN));
    const barW = 760;
    const g = this.add.graphics();
    const pct = this.mono(w / 2, h * 0.36 + 190, '', 40, '700', THEME.ink);
    const draw = (p: number) => {
      g.clear();
      g.lineStyle(3, GREEN, 0.6);
      g.strokeRect(w / 2 - barW / 2, h * 0.36 + 100, barW, 36);
      g.fillStyle(GREEN, 1);
      g.fillRect(w / 2 - barW / 2 + 6, h * 0.36 + 106, ((barW - 12) * p) / 100, 24);
      pct.setText(`VAULT POWER ${Math.round(p)}%`);
    };
    draw(c.powerStart);
    this.tweens.addCounter({ from: c.powerStart, to: c.powerEnd, duration: 1400, delay: 300, ease: 'Cubic.easeOut', onUpdate: (tw) => draw(tw.getValue() ?? c.powerEnd) });
    const next = CHAPTERS.find((x) => x.id === c.id + 1);
    const sub = this.mono(w / 2, h * 0.36 + 280, next ? `NEXT: SECTOR ${next.sector} / ${next.title.toUpperCase()}` : 'AWAITING NEXT TRANSMISSION', 32, '400', DIM);
    this.layer!.add([g, title, pct, sub]);
    audio.complete();
    haptics.fire('success');
    this.addContinue('CONTINUE');
    this.fadeIn();
  }

  private typeNextLine(beat: Beat): void {
    const { width: w, height: h } = this.scale;
    const line = beat.lines[this.lineIndex++]!;
    const sp = SPEAKERS[line.speaker];
    const block = this.add.container(0, 0);
    let y = this.logY;
    if (sp.tag) {
      block.add(this.mono(60, y, `[${sp.tag}]`, 30, '700', hex(sp.color)).setOrigin(0, 0));
      y += 52;
    }
    const body = this.add
      .text(60, y, '', {
        fontFamily: MONO,
        fontSize: '42px',
        fontStyle: '400',
        color: line.speaker === 'log' ? '#9aa6bd' : THEME.ink,
        wordWrap: { width: w - 120 },
        lineSpacing: 12,
      })
      .setOrigin(0, 0);
    block.add(body);
    this.layer!.add(block);

    // measure the finished block so the next line lands below it
    body.setText(line.text);
    const endY = y + body.height + 64;
    body.setText('');
    this.logY = endY;
    // keep the newest lines on screen
    const overflow = endY - (h - 300);
    if (overflow > 0) this.tweens.add({ targets: this.layer!.list.slice(2), y: `-=${overflow}`, duration: 250 });

    let n = 0;
    const done = () => {
      this.typing?.remove();
      this.typing = null;
      this.finishTyping = null;
      body.setText(line.text);
      if (this.lineIndex >= beat.lines.length && !this.continueBtn) this.addContinue('CONTINUE');
    };
    this.finishTyping = done;
    this.typing = this.time.addEvent({
      delay: 18,
      repeat: line.text.length - 1,
      callback: () => {
        n++;
        body.setText(line.text.slice(0, n) + (n < line.text.length ? '█' : ''));
        if (n % 3 === 0) audio.play([{ freq: 1800, dur: 0.012, wave: 'square', vol: 0.02 }]);
        if (n >= line.text.length) done();
      },
    });
  }

  private addContinue(label: string): void {
    const { width: w, height: h } = this.scale;
    const g = this.add.graphics();
    const bw = 460;
    const bh = 110;
    g.lineStyle(4, GREEN, 1);
    g.strokeRect(-bw / 2, -bh / 2, bw, bh);
    const t = this.mono(0, 0, `[ ${label} ]`, 40, '700', hex(GREEN));
    const btn = this.add.container(w / 2, h - 200, [g, t]).setDepth(55);
    btn.setSize(bw, bh).setInteractive({ useHandCursor: true });
    btn.on('pointerup', () => {
      // move straight to the next card, even mid-log
      this.finishTyping?.();
      const card = this.cards[this.cardIndex];
      if (card?.kind === 'log') this.lineIndex = card.beat.lines.length;
      this.advance();
    });
    this.continueBtn = btn;
    this.layer!.add(btn);
  }

  private mono(x: number, y: number, t: string, size: number, weight: string, color: string): Phaser.GameObjects.Text {
    return this.add.text(x, y, t, { fontFamily: MONO, fontSize: `${size}px`, fontStyle: weight, color, align: 'center' }).setOrigin(0.5);
  }

  private fadeIn(): void {
    this.layer!.alpha = 0;
    this.tweens.add({ targets: this.layer!, alpha: 1, duration: 220 });
  }
}
