import Phaser from 'phaser';
import { makeButton, popIn } from '@tgs/kit';
import { cardId, cards } from '../logic/cards.ts';
import { DISPLAY_FONT, GOLD, SECONDARY, THEME, audio, bonus, fmt, haptics, player, save } from '../services.ts';
import { showDailyWheel, showMissions } from '../ui/progress.ts';
import { CARD_H, CARD_W, coinBar, coinShower, formatWait, text } from '../ui/common.ts';
import { VH, VW, backdrop, frame, screenDim } from '../ui/common.ts';
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
  private refreshAll: () => void = () => {};
  private actionRow: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('lobby');
  }

  /** Portrait, level, VIP tier and XP progress. */
  private playerCard(): void {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x0d0414, 0.7);
    g.fillRoundedRect(50, 225, VW - 100, 190, 30);
    g.lineStyle(3, 0xe9c86a, 0.6);
    g.strokeRoundedRect(50, 225, VW - 100, 190, 30);
    const vip = player.vip();
    const p = player.progress();
    g.fillStyle(vip.color, 1);
    g.fillCircle(150, 320, 74);
    c.add(g);
    c.add(this.add.image(150, 320, 'av-you').setDisplaySize(136, 136));
    c.add(text(this, 260, 280, `Level ${p.level}`, 54, '900', GOLD, DISPLAY_FONT).setOrigin(0, 0.5));
    c.add(text(this, VW - 90, 282, `${vip.name} VIP`, 36, '800', '#' + vip.color.toString(16).padStart(6, '0')).setOrigin(1, 0.5));
    const bar = this.add.graphics();
    bar.fillStyle(0x000000, 0.6);
    bar.fillRoundedRect(260, 335, VW - 350, 26, 13);
    bar.fillStyle(0x5ee08f, 1);
    bar.fillRoundedRect(260, 335, Math.max(26, (VW - 350) * p.fraction), 26, 13);
    c.add(bar);
    c.add(text(this, 260, 388, `${fmt(p.into)} / ${fmt(p.needed)} XP to level ${p.level + 1}`, 28, '600', '#cbb6d6').setOrigin(0, 0.5));
  }

  /** Daily wheel, missions, free bonus. */
  private actions(refresh: () => void): void {
    this.actionRow?.destroy();
    const row = this.add.container(0, 0);
    this.actionRow = row;
    const W3 = (VW - 100 - 40) / 3;
    const tile = (i: number, title: string, sub: string, hot: boolean, onTap: () => void, badge = 0) => {
      const x = 50 + i * (W3 + 20);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(x, 448, W3, 150, 26);
      g.fillStyle(hot ? 0x7a3a9a : 0x2a1238, 1);
      g.fillRoundedRect(x, 440, W3, 150, 26);
      g.lineStyle(3, 0xe9c86a, hot ? 1 : 0.4);
      g.strokeRoundedRect(x, 440, W3, 150, 26);
      const t1 = text(this, x + W3 / 2, 492, title, 36, '800', '#ffffff');
      const t2 = text(this, x + W3 / 2, 546, sub, 30, '700', hot ? '#ffe14a' : '#a898b0');
      const c = this.add.container(0, 0, [g, t1, t2]);
      if (badge > 0) {
        const b = this.add.graphics();
        b.fillStyle(0xff3b5c, 1);
        b.fillCircle(x + W3 - 16, 448, 24);
        c.add([b, text(this, x + W3 - 16, 448, String(badge), 28, '900', '#ffffff')]);
      }
      const zone = this.add.zone(x + W3 / 2, 515, W3, 150).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => {
        audio.unlock();
        audio.tap();
        onTap();
      });
      c.add(zone);
      if (hot) this.tweens.add({ targets: [t2], scale: 1.08, duration: 600, yoyo: true, repeat: -1 });
      row.add(c);
    };
    const redraw = () => {
      refresh();
      this.actions(refresh);
    };
    const wheelReady = player.wheelReady();
    tile(0, 'Daily Wheel', wheelReady ? 'Spin now!' : 'Tomorrow', wheelReady, () => showDailyWheel(this, redraw));
    const ms = player.missions();
    const done = ms.filter((m) => m.done).length;
    const toClaim = player.unclaimedMissions();
    tile(1, 'Missions', toClaim ? 'Claim reward!' : `${done} / 3 done`, toClaim > 0, () => showMissions(this, redraw), toClaim);
    const wait = bonus.msUntilReady();
    tile(2, 'Free Bonus', wait === 0 ? `+${fmt(bonus.amount())}` : formatWait(wait), wait === 0, () => {
      const got = bonus.collect();
      if (!got) return;
      audio.win();
      haptics.fire('success');
      coinShower(this, VW - 50 - W3 / 2, 515, got);
      redraw();
    });
  }

  create(): void {
    const w = VW;
    const h = frame(this).bottom;
    backdrop(this, 'bg-lobby');
    const refresh = coinBar(this, 'Velvet Ace');
    this.refreshAll = refresh;

    this.playerCard();
    this.actions(refresh);

    // game tiles
    const pad = 50;
    const full = w - pad * 2;
    const half = (full - 30) / 2;
    const tiles: Tile[] = [
      { key: 'slotlobby', title: 'Slots', sub: '4 machines · progressive jackpot', x: pad, y: 650, w: full, h: 340, art: (c, tw, th) => this.slotsArt(c, tw, th) },
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
    ['seven', 'wild', 'seven'].forEach((s, i) => c.add(this.add.image((i - 1) * 200, -25, `sym-sevens-${s}`).setDisplaySize(150, 150)));
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
