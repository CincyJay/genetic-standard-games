import Phaser from 'phaser';
import { makeButton } from '@tgs/kit';
import { drawBloom } from '../art.ts';
import { THEME, audio, haptics, save } from '../services.ts';
import { CHAPTERS, SPEAKERS, type Beat, type Line } from '../story.ts';
import { drawBackground } from './background.ts';

type Card = { kind: 'title'; beat: Beat } | { kind: 'line'; beat: Beat; line: Line } | { kind: 'restored'; beat: Beat };

/** Plays story beats as a sequence of cards, then starts the level. */
export class StoryScene extends Phaser.Scene {
  private cards: Card[] = [];
  private index = 0;
  private level = 1;
  private beatKeys: string[] = [];
  private layer: Phaser.GameObjects.Container | null = null;
  private typing: Phaser.Time.TimerEvent | null = null;
  private fullText = '';
  private textObj: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('story');
  }

  init(data: { beats: string[]; level: number }): void {
    this.level = data.level;
    this.beatKeys = data.beats;
    this.index = 0;
    this.layer = null;
    const all: Beat[] = CHAPTERS.flatMap((c) =>
      (['intro', 'mid', 'outro'] as const).map((kind) => ({ key: `c${c.id}-${kind}`, chapter: c, kind, lines: c[kind] })),
    );
    this.cards = [];
    for (const key of data.beats) {
      const beat = all.find((b) => b.key === key);
      if (!beat) continue;
      if (beat.kind === 'intro') this.cards.push({ kind: 'title', beat });
      for (const line of beat.lines) this.cards.push({ kind: 'line', beat, line });
      if (beat.kind === 'outro') this.cards.push({ kind: 'restored', beat });
    }
  }

  create(): void {
    const { width: w } = this.scale;
    drawBackground(this);
    const skip = this.add
      .text(w - 70, 110, 'Skip', { fontFamily: THEME.font, fontSize: '40px', fontStyle: '500', color: THEME.inkSoft })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    skip.on('pointerup', () => this.finish());
    // Tap anywhere to advance (buttons handle their own taps).
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.advance();
    });
    this.show();
  }

  private advance(): void {
    // First tap finishes the typing; the next one moves on.
    if (this.typing && this.textObj) {
      this.typing.remove();
      this.typing = null;
      this.textObj.setText(this.fullText);
      return;
    }
    audio.tap();
    this.index++;
    if (this.index >= this.cards.length) this.finish();
    else this.show();
  }

  private finish(): void {
    save.update((d) => {
      for (const k of this.beatKeys) if (!d.storySeen.includes(k)) d.storySeen.push(k);
    });
    this.scene.start('game', { level: this.level });
  }

  private show(): void {
    this.layer?.destroy();
    this.typing?.remove();
    this.typing = null;
    this.textObj = null;
    const card = this.cards[this.index];
    if (!card) return this.finish();
    const { width: w, height: h } = this.scale;
    const layer = this.add.container(0, 0);
    this.layer = layer;

    if (card.kind === 'title') {
      const c = card.beat.chapter;
      const g = this.add.graphics();
      g.fillStyle(THEME.surface, 1);
      g.fillCircle(w / 2, h * 0.36, 170);
      drawBloom(g, w / 2, h * 0.36, 110, [0xffc93c, 0xa47bff, 0xff4d6a, 0x3ddc84, 0x5ac8fa][(c.id - 1) % 5]!);
      const label = this.text(w / 2, h * 0.5, `CHAPTER ${c.id}`, 34, '700', THEME.inkSoft).setLetterSpacing(8);
      const title = this.text(w / 2, h * 0.5 + 90, c.title, 88, '800', THEME.ink);
      const area = this.text(w / 2, h * 0.5 + 180, `Restore the ${c.area}`, 42, '500', THEME.inkSoft);
      layer.add([g, label, title, area]);
      this.addContinue(layer, 'Begin');
      this.fadeIn(layer);
      return;
    }

    if (card.kind === 'restored') {
      const c = card.beat.chapter;
      const g = this.add.graphics();
      g.fillStyle(THEME.primary, 1);
      g.fillCircle(w / 2, h * 0.38, 120);
      g.lineStyle(22, THEME.bg, 1);
      g.beginPath();
      g.moveTo(w / 2 - 50, h * 0.38 + 4);
      g.lineTo(w / 2 - 12, h * 0.38 + 42);
      g.lineTo(w / 2 + 56, h * 0.38 - 40);
      g.strokePath();
      const title = this.text(w / 2, h * 0.52, `${c.area} restored`, 76, '800', THEME.ink);
      const next = CHAPTERS.find((x) => x.id === c.id + 1);
      const sub = this.text(
        w / 2,
        h * 0.52 + 100,
        next ? `Next: Chapter ${next.id}, ${next.title}` : 'More chapters coming soon',
        42,
        '500',
        THEME.inkSoft,
      );
      layer.add([g, title, sub]);
      audio.win();
      haptics.fire('success');
      this.addContinue(layer, 'Continue');
      this.fadeIn(layer);
      return;
    }

    // Dialogue line
    const { line } = card;
    const sp = SPEAKERS[line.speaker];
    const boxW = 960;
    const boxY = h * 0.5;
    const isLetter = line.speaker === 'ivy';
    const isNarration = line.speaker === 'narrator';
    const g = this.add.graphics();
    if (!isNarration) {
      g.fillStyle(THEME.surfaceEdge, 1);
      g.fillRoundedRect(w / 2 - boxW / 2, boxY - 200 + 10, boxW, 520, 40);
      g.fillStyle(isLetter ? 0x2a2440 : THEME.surface, 1);
      g.fillRoundedRect(w / 2 - boxW / 2, boxY - 200, boxW, 520, 40);
      if (isLetter) {
        g.lineStyle(3, sp.color, 0.6);
        g.strokeRoundedRect(w / 2 - boxW / 2, boxY - 200, boxW, 520, 40);
      }
      // speaker badge
      g.fillStyle(sp.color, 1);
      g.fillCircle(w / 2 - boxW / 2 + 110, boxY - 200, 70);
      layer.add(g);
      layer.add(this.text(w / 2 - boxW / 2 + 110, boxY - 200, sp.initial, 64, '800', '#0d1424'));
      layer.add(this.text(w / 2 - boxW / 2 + 210, boxY - 200, sp.name, 44, '700', THEME.ink).setOrigin(0, 0.5));
    } else {
      layer.add(g);
    }
    const textObj = this.add
      .text(w / 2, isNarration ? boxY : boxY + 60, '', {
        fontFamily: THEME.font,
        fontSize: isNarration ? '52px' : '48px',
        fontStyle: isLetter ? 'italic 500' : '500',
        color: isNarration ? THEME.inkSoft : THEME.ink,
        align: isNarration ? 'center' : 'left',
        wordWrap: { width: boxW - 120 },
        lineSpacing: 14,
      })
      .setOrigin(0.5);
    layer.add(textObj);
    this.textObj = textObj;
    this.fullText = line.text;
    let n = 0;
    this.typing = this.time.addEvent({
      delay: 22,
      repeat: line.text.length - 1,
      callback: () => {
        n++;
        textObj.setText(line.text.slice(0, n));
        if (n >= line.text.length) this.typing = null;
      },
    });
    const hint = this.text(w / 2, h - 230, 'Tap to continue', 34, '500', '#4c5a76');
    this.tweens.add({ targets: hint, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
    layer.add(hint);
    this.fadeIn(layer);
  }

  private addContinue(layer: Phaser.GameObjects.Container, label: string): void {
    const { width: w, height: h } = this.scale;
    layer.add(makeButton(this, w / 2, h * 0.78, label, () => this.advance(), { width: 520, height: 140, fontSize: 52, theme: THEME }));
  }

  private text(x: number, y: number, t: string, size: number, weight: string, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, t, { fontFamily: THEME.font, fontSize: `${size}px`, fontStyle: weight, color, align: 'center', wordWrap: { width: 960 } })
      .setOrigin(0.5);
  }

  private fadeIn(layer: Phaser.GameObjects.Container): void {
    layer.alpha = 0;
    this.tweens.add({ targets: layer, alpha: 1, duration: 260 });
  }
}
