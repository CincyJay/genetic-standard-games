import Phaser from 'phaser';
import { isUnlocked, UNLOCKS, type UnlockId } from '../logic/progression.ts';
import { MACHINES, type Machine } from '../logic/slots.ts';
import { DISPLAY_FONT, GOLD, audio, fmt, haptics, player } from '../services.ts';
import { VW, backdrop, coinBar, frame, text } from '../ui/common.ts';
import { FEATURE_TEXT, symKey } from './SlotsScene.ts';

const UNLOCK_FOR: Record<string, UnlockId | null> = { sevens: null, pharaoh: 'slots-pharaoh', ocean: 'slots-ocean', goldrush: 'slots-goldrush' };
const CARD_COLORS: Record<string, [number, number]> = {
  sevens: [0x6a2a80, 0x2a0d3a],
  pharaoh: [0x9a6a2a, 0x4a2a0a],
  ocean: [0x1f6a9a, 0x08243a],
  goldrush: [0x7a4a22, 0x2a160a],
};
const SHOWCASE: Record<string, string[]> = {
  sevens: ['seven', 'wild', 'seven'],
  pharaoh: ['mask', 'wild', 'gem'],
  ocean: ['shark', 'wild', 'pearl'],
  goldrush: ['nugget', 'wild', 'bar'],
};

/** Pick a slot machine: four themed machines, unlocked by level, with the shared jackpot on top. */
export class SlotLobbyScene extends Phaser.Scene {
  constructor() {
    super('slotlobby');
  }

  create(): void {
    frame(this);
    backdrop(this, 'bg-lobby');
    coinBar(this, 'Slots', () => this.scene.start('lobby'));
    // jackpot sign
    const sign = this.add.graphics();
    sign.fillStyle(0x0d0414, 0.9);
    sign.fillRoundedRect(VW / 2 - 440, 240, 880, 150, 30);
    sign.lineStyle(5, 0xe9c86a, 1);
    sign.strokeRoundedRect(VW / 2 - 440, 240, 880, 150, 30);
    text(this, VW / 2, 282, 'PROGRESSIVE JACKPOT', 30, '800', '#cbb6d6').setLetterSpacing(6);
    const jp = text(this, VW / 2, 340, fmt(player.jackpot), 64, '900', GOLD, DISPLAY_FONT);
    // the jackpot ticks up while you look at it (cosmetic; the real value grows with every bet)
    let shown = player.jackpot;
    this.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        shown += Phaser.Math.Between(1, 9);
        jp.setText(shown.toLocaleString('en-US'));
      },
    });
    MACHINES.forEach((m, i) => this.card(m, 430 + i * 360, i));
  }

  private card(m: Machine, y: number, i: number): void {
    const unlock = UNLOCK_FOR[m.id];
    const locked = unlock ? !isUnlocked(unlock, player.level) : false;
    const c = this.add.container(VW / 2, y + 160);
    const [c1, c2] = CARD_COLORS[m.id]!;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(-480, -150, 960, 320, 30);
    g.fillGradientStyle(c1, c1, c2, c2, 1);
    g.fillRoundedRect(-480, -160, 960, 320, 30);
    g.lineStyle(4, 0xe9c86a, locked ? 0.3 : 0.9);
    g.strokeRoundedRect(-480, -160, 960, 320, 30);
    c.add(g);
    SHOWCASE[m.id]!.forEach((s, k) => c.add(this.add.image(-380 + k * 112, -10, symKey(m, s)).setDisplaySize(120, 120)));
    c.add(text(this, 190, -60, m.name, 54, '900', GOLD, DISPLAY_FONT).setOrigin(0.5));
    c.add(text(this, 190, 10, FEATURE_TEXT[m.feature], 30, '600', '#e9e4ea'));
    if (locked) {
      const lvl = UNLOCKS.find((u) => u.id === unlock)!.level;
      const shade = this.add.graphics();
      shade.fillStyle(0x000000, 0.6);
      shade.fillRoundedRect(-480, -160, 960, 320, 30);
      c.add(shade);
      c.add(text(this, 0, -10, `Locked  ·  reach level ${lvl}`, 44, '800', '#ffffff'));
    } else {
      c.add(text(this, 190, 80, 'PLAY', 40, '900', '#7dff9a').setLetterSpacing(6));
    }
    c.setSize(960, 320).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      if (locked) {
        audio.invalid();
        haptics.fire('error');
        this.tweens.add({ targets: c, x: VW / 2 + 12, duration: 60, yoyo: true, repeat: 2 });
        return;
      }
      audio.unlock();
      audio.tap();
      this.scene.start('slots', { machine: m.id });
    });
    c.setScale(0.92).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 300, delay: 80 + i * 80, ease: 'Back.easeOut' });
  }
}
