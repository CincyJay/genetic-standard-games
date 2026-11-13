import Phaser from 'phaser';
import { makeButton, popIn } from '@tgs/kit';
import { cardId, cards } from '../logic/cards.ts';
import { DISPLAY_FONT, GOLD, SECONDARY, THEME, audio, bonus, fmt, haptics, save } from '../services.ts';
import { CARD_H, CARD_W, coinBar, coinShower, formatWait, text } from '../ui/common.ts';
import { drawWheel } from '../ui/wheel.ts';

interface Tile {
  key: string;
  title: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
  art: (c: Phaser.GameObjects.Container, w: number, h: number) => void;
}

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('lobby');
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.add.image(w / 2, h / 2, 'bg-lobby').setDisplaySize(w, h);
    const refresh = coinBar(this, '');

    // logo: a fanned ace and king behind the name
    const fan = this.add.container(w / 2, 330);
    for (const [id, a, dx] of [['As', -12, -60], ['Kh', 10, 60]] as const) {
      fan.add(this.add.image(dx, 0, `card-${id}`).setDisplaySize(CARD_W * 0.9, CARD_H * 0.9).setAngle(a));
    }
    fan.setAlpha(0.35);
    const logo = text(this, w / 2, 330, 'Velvet Ace', 140, '900', GOLD, DISPLAY_FONT).setStroke('#14071f', 16);
    logo.setShadow(0, 8, 'rgba(0,0,0,0.5)', 10, true, true);
    text(this, w / 2, 430, 'C A S I N O', 40, '600', '#ffffff').setLetterSpacing(10);
    popIn(this, logo);

    // free bonus
    this.bonusButton(w / 2, 540, refresh);

    // game tiles
    const pad = 50;
    const full = w - pad * 2;
    const half = (full - 30) / 2;
    const tiles: Tile[] = [
      { key: 'slots', title: 'Slots', sub: '20 lines · free spins', x: pad, y: 650, w: full, h: 340, art: (c, tw, th) => this.slotsArt(c, tw, th) },
      { key: 'blackjack', title: 'Blackjack', sub: 'Beat the dealer to 21', x: pad, y: 1020, w: half, h: 330, art: (c, tw, th) => this.cardsArt(c, tw, th, 'As Kh', true) },
      { key: 'holdem', title: "Texas Hold'em", sub: '6-seat table', x: pad + half + 30, y: 1020, w: half, h: 330, art: (c, tw, th) => this.cardsArt(c, tw, th, 'Ad Ac', true) },
      { key: 'videopoker', title: 'Video Poker', sub: 'Jacks or Better', x: pad, y: 1380, w: half, h: 330, art: (c, tw, th) => this.cardsArt(c, tw, th, 'Th Jh Qh Kh Ah', false) },
      { key: 'roulette', title: 'Roulette', sub: 'European wheel', x: pad + half + 30, y: 1380, w: half, h: 330, art: (c, tw, th) => this.wheelArt(c, tw, th) },
    ];
    tiles.forEach((t, i) => this.tile(t, i));

    text(this, w / 2, h - 110, 'Play money only. Coins have no cash value', 30, '500', THEME.inkSoft);
    text(this, w / 2, h - 70, 'and can never be withdrawn or exchanged.', 30, '500', THEME.inkSoft);
    const best = save.get().biggestWin;
    if (best > 0) text(this, w / 2, 1760, `Biggest win  ${fmt(best)}`, 34, '700', GOLD);
  }

  private bonusButton(x: number, y: number, refresh: () => void): void {
    const ms = bonus.msUntilReady();
    if (ms === 0) {
      const b = makeButton(
        this,
        x,
        y,
        `Collect free bonus  +${fmt(bonus.amount())}`,
        () => {
          const got = bonus.collect();
          if (!got) return;
          audio.win();
          haptics.fire('success');
          coinShower(this, x, y, got);
          refresh();
          b.destroy();
          this.bonusButton(x, y, refresh);
        },
        { width: 760, height: 120, fontSize: 44, theme: THEME },
      );
      this.tweens.add({ targets: b, scale: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      const label = text(this, x, y, `Next free bonus in ${formatWait(ms)}`, 38, '700', THEME.inkSoft);
      this.time.addEvent({ delay: 30000, loop: true, callback: () => label.setText(`Next free bonus in ${formatWait(bonus.msUntilReady())}`) });
    }
  }

  private tile(t: Tile, i: number): void {
    const c = this.add.container(t.x + t.w / 2, t.y + t.h / 2);
    const g = this.add.graphics();
    g.fillStyle(0x0a0310, 0.6);
    g.fillRoundedRect(-t.w / 2, -t.h / 2 + 10, t.w, t.h, 32);
    g.fillGradientStyle(0x5a2470, 0x5a2470, 0x2a0d3a, 0x2a0d3a, 1);
    g.fillRoundedRect(-t.w / 2, -t.h / 2, t.w, t.h, 32);
    g.lineStyle(4, 0xe9c86a, 0.85);
    g.strokeRoundedRect(-t.w / 2, -t.h / 2, t.w, t.h, 32);
    c.add(g);
    const art = this.add.container(0, -30);
    c.add(art);
    t.art(art, t.w, t.h);
    c.add(text(this, 0, t.h / 2 - 76, t.title, t.key === 'slots' ? 60 : 46, '800', GOLD, DISPLAY_FONT).setStroke('#14071f', 8));
    c.add(text(this, 0, t.h / 2 - 32, t.sub, 28, '500', THEME.inkSoft));
    c.setSize(t.w, t.h).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      audio.unlock();
      audio.tap();
      haptics.fire('light');
      this.tweens.add({ targets: c, scale: { from: 0.95, to: 1 }, duration: 160, onComplete: () => this.scene.start(t.key) });
    });
    c.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 320, delay: 120 + i * 70, ease: 'Back.easeOut' });
  }

  private slotsArt(c: Phaser.GameObjects.Container, w: number, _h: number): void {
    const win = this.add.graphics();
    win.fillStyle(0x14071f, 1);
    win.fillRoundedRect(-330, -110, 660, 170, 20);
    win.lineStyle(4, 0xe9c86a, 0.6);
    win.strokeRoundedRect(-330, -110, 660, 170, 20);
    c.add(win);
    ['seven', 'wild', 'seven'].forEach((s, i) => c.add(this.add.image((i - 1) * 200, -25, `sym-${s}`).setDisplaySize(150, 150)));
    void w;
  }

  private cardsArt(c: Phaser.GameObjects.Container, _w: number, _h: number, ids: string, chip: boolean): void {
    const cs = cards(ids);
    const n = cs.length;
    const scale = n > 2 ? 0.62 : 0.78;
    cs.forEach((card, i) => {
      const a = (i - (n - 1) / 2) * (n > 2 ? 12 : 14);
      const img = this.add
        .image((i - (n - 1) / 2) * (n > 2 ? 46 : 70), -20 + Math.abs(i - (n - 1) / 2) * 8, `card-${cardId(card)}`)
        .setDisplaySize(CARD_W * scale, CARD_H * scale)
        .setAngle(a);
      c.add(img);
    });
    if (chip) c.add(this.add.image(120, 40, 'chip-500').setDisplaySize(90, 90));
  }

  private wheelArt(c: Phaser.GameObjects.Container, _w: number, _h: number): void {
    const g = this.add.graphics();
    drawWheel(this, g, 88, false);
    const holder = this.add.container(0, -20, [g]);
    c.add(holder);
    this.tweens.add({ targets: holder, angle: 360, duration: 12000, repeat: -1 });
  }
}
