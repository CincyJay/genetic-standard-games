import Phaser from 'phaser';
import { RANKS, SUITS, cardId } from '../logic/cards.ts';
import { MACHINES } from '../logic/slots.ts';
import { THEME, analytics, applySettings } from '../services.ts';

export const CHIP_VALUES = [10, 50, 100, 500, 1000, 5000];

/** Loads every card, chip, slot symbol and backdrop, then opens the lobby. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    const { width: w, height: h } = this.scale;
    const bar = this.add.graphics();
    this.load.on('progress', (p: number) => {
      bar.clear();
      bar.fillStyle(THEME.surface, 1);
      bar.fillRoundedRect(w / 2 - 260, h / 2 - 12, 520, 24, 12);
      bar.fillStyle(THEME.primary, 1);
      bar.fillRoundedRect(w / 2 - 260, h / 2 - 12, Math.max(24, 520 * p), 24, 12);
    });
    const cardSize = { width: 300, height: 420 };
    for (const s of SUITS) for (const r of RANKS) {
      const id = cardId({ rank: r, suit: s });
      this.load.svg(`card-${id}`, `art/cards/${id}.svg`, cardSize);
    }
    this.load.svg('card-back', 'art/cards/back.svg', cardSize);
    for (const v of CHIP_VALUES) this.load.svg(`chip-${v}`, `art/chips/${v}.svg`, { width: 180, height: 180 });
    for (const m of MACHINES) for (const s of m.symbols) this.load.svg(`sym-${m.id}-${s}`, `art/slots/${m.id}/${s}.svg`, { width: 260, height: 260 });
    for (const bg of ['bg-lobby', 'bg-felt', 'bg-felt-red', 'bg-slots', 'bg-slots-pharaoh', 'bg-slots-ocean', 'bg-slots-goldrush', 'bg-slots-lanterns', 'bg-poker']) this.load.image(bg, `art/${bg}.jpg`);
    for (const a of ['you', 'rosa', 'dmitri', 'kwame', 'lena', 'hector', 'priya', 'sam', 'yuki']) {
      this.load.svg(`av-${a}`, `art/avatars/${a}.svg`, { width: 256, height: 256 });
    }
  }

  create(): void {
    applySettings();
    const d = this.make.graphics({}, false);
    d.fillStyle(0xffffff, 1);
    d.fillCircle(8, 8, 8);
    d.generateTexture('dot', 16, 16);
    d.destroy();
    analytics.track('session_start', {});
    this.scene.start('lobby');
  }
}
