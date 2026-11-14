import Phaser from 'phaser';
import { DISPLAY_FONT, GOLD, audio, bonus, fmt, haptics, player } from '../services.ts';
import { showDailyWheel, showMissions, showProfile } from '../ui/progress.ts';
import { coinBar, coinShower, formatWait, text } from '../ui/common.ts';
import { VW, backdrop, frame } from '../ui/common.ts';
import { drawWheel } from '../ui/wheel.ts';
import { cardsArt, gameTile, reelArt, wheelArt } from '../ui/tiles.ts';
import { LUCKY_LANTERNS, LUCKY_SEVENS } from '../logic/slots.ts';
import { ROOMS } from './RoomScene.ts';
import { symKey } from './SlotsScene.ts';

/**
 * Casino floor: a jackpot marquee, a sideways-scrolling wall of machine and
 * table tiles (two rows), and a bottom bar with the hourly bonus, daily wheel,
 * missions and the player's profile.
 */
export class LobbyScene extends Phaser.Scene {
  private bar: Phaser.GameObjects.Container | null = null;
  private bonusSub: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('lobby');
  }

  create(): void {
    const view = frame(this);
    backdrop(this, 'room-lobby');
    const refresh = coinBar(this, 'Velvet Ace');
    this.marquee(view.top);

    // one door per room
    const top = view.top + 380;
    const barTop = Math.max(top + 3 * 420 + 2 * 24 + 30, view.bottom - 330);
    const doorH = Math.min(560, Math.floor((barTop - top - 30 - 2 * 24) / 3));
    const doors = this.add.container(0, 0);
    const doorArt: Record<string, (s: Phaser.Scene, c: Phaser.GameObjects.Container) => void> = {
      slots: (s, c) =>
        reelArt(s, c, [symKey(LUCKY_SEVENS, 'seven'), symKey(LUCKY_LANTERNS, 'scatter'), symKey(LUCKY_SEVENS, 'seven')], -doorH / 2 + 130, 130),
      poker: (s, c) => {
        cardsArt(s, c, 'Ad Ac', false, -doorH / 2 + 150, 1);
        c.add(s.add.image(-260, -doorH / 2 + 170, 'chip-1000').setDisplaySize(120, 120));
        c.add(s.add.image(260, -doorH / 2 + 170, 'chip-500').setDisplaySize(120, 120));
      },
      tables: (s, c) => {
        wheelArt(s, c, -200, -doorH / 2 + 150, 105);
        cardsArt(s, c, 'As Kh', false, -doorH / 2 + 150, 0.85);
        c.list.slice(-2).forEach((o) => ((o as Phaser.GameObjects.Image).x += 220));
      },
    };
    ROOMS.forEach((r, i) =>
      gameTile(
        this,
        doors,
        { key: 'room', title: r.title, sub: r.sub, bg: r.bg, unlock: null, data: { room: r.id }, art: doorArt[r.id]! },
        VW / 2,
        top + doorH / 2 + i * (doorH + 24),
        1000,
        doorH,
        i,
      ),
    );

    this.bottomBar(barTop, refresh);
    // tick the bonus countdown; rebuild the bar only when something becomes ready
    let state = this.barState();
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        const now = this.barState();
        if (now !== state) {
          state = now;
          this.bottomBar(barTop, refresh);
        } else {
          const w = bonus.msUntilReady();
          if (w > 0) this.bonusSub?.setText(formatWait(w));
        }
      },
    });
    text(this, VW / 2, view.bottom - 40, 'Play money only · coins have no cash value and can never be withdrawn', 24, '500', '#a898b0');
    (globalThis as Record<string, unknown>).__lobby = {
      barY: barTop + 110,
      door: (i: number) => top + doorH / 2 + i * (doorH + 24),
    };
  }

  // ---------------------------------------------------------------- marquee
  private marquee(t0: number): void {
    const dy = t0;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(40, dy + 222, VW - 80, 136, 28);
    g.fillGradientStyle(0x3a0d1a, 0x3a0d1a, 0x14040a, 0x14040a, 1);
    g.fillRoundedRect(40, dy + 214, VW - 80, 136, 28);
    g.lineStyle(4, 0xe9c86a, 1);
    g.strokeRoundedRect(40, dy + 214, VW - 80, 136, 28);
    // chasing bulbs around the sign
    const bulbs: Phaser.GameObjects.Arc[] = [];
    const n = 22;
    for (let i = 0; i < n; i++) {
      const x = 70 + (i * (VW - 140)) / (n - 1);
      bulbs.push(this.add.circle(x, dy + 226, 6, 0xffe08a), this.add.circle(x, dy + 338, 6, 0xffe08a));
    }
    let k = 0;
    this.time.addEvent({
      delay: 140,
      loop: true,
      callback: () => {
        k++;
        bulbs.forEach((b, i) => b.setAlpha((Math.floor(i / 2) + k) % 3 === 0 ? 1 : 0.25));
      },
    });
    text(this, VW / 2, dy + 252, 'PROGRESSIVE JACKPOT', 26, '800', '#e9c8d6').setLetterSpacing(8);
    const jp = text(this, VW / 2, dy + 304, '', 64, '900', GOLD, DISPLAY_FONT).setStroke('#2a0a00', 8);
    let shown = player.jackpot;
    jp.setText(shown.toLocaleString('en-US'));
    // cosmetic tick-up; the real value grows with every slot bet
    this.time.addEvent({
      delay: 110,
      loop: true,
      callback: () => {
        shown += Phaser.Math.Between(1, 9);
        jp.setText(shown.toLocaleString('en-US'));
      },
    });
  }

  // ---------------------------------------------------------------- bottom bar
  private barState(): string {
    return `${bonus.msUntilReady() === 0}|${player.wheelReady()}|${player.unclaimedMissions()}|${player.level}`;
  }

  private bottomBar(y: number, refresh: () => void): void {
    if (this.bar) {
      this.bar.each((o: Phaser.GameObjects.GameObject) => this.tweens.killTweensOf(o));
      this.bar.destroy();
    }
    const c = this.add.container(0, 0).setDepth(30);
    this.bar = c;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(24, y + 10, VW - 48, 220, 34);
    g.fillGradientStyle(0x3a1250, 0x3a1250, 0x1a0726, 0x1a0726, 1);
    g.fillRoundedRect(24, y, VW - 48, 220, 34);
    g.lineStyle(4, 0xe9c86a, 0.9);
    g.strokeRoundedRect(24, y, VW - 48, 220, 34);
    c.add(g);
    const redraw = () => {
      refresh();
      this.bottomBar(y, refresh);
    };
    const wait = bonus.msUntilReady();
    const wheelReady = player.wheelReady();
    const toClaim = player.unclaimedMissions();
    const items: { label: string; sub: string; hot: boolean; icon: (g: Phaser.GameObjects.Graphics) => void; badge?: number; tap: () => void; wide?: boolean }[] = [
      {
        label: 'Hourly Bonus',
        sub: wait === 0 ? `Collect ${fmt(bonus.amount())}` : formatWait(wait),
        hot: wait === 0,
        wide: true,
        icon: (ig) => {
          ig.fillStyle(0xa4700f, 1);
          ig.fillCircle(0, 4, 40);
          ig.fillStyle(0xffd23f, 1);
          ig.fillCircle(0, 0, 40);
          ig.lineStyle(4, 0xa4700f, 1);
          ig.strokeCircle(0, 0, 28);
        },
        tap: () => {
          const got = bonus.collect();
          if (!got) {
            audio.invalid();
            return;
          }
          audio.win();
          haptics.fire('success');
          coinShower(this, 230, y + 60, got);
          redraw();
        },
      },
      {
        label: 'Daily Wheel',
        sub: wheelReady ? 'Spin!' : 'Tomorrow',
        hot: wheelReady,
        icon: (ig) => drawWheel(this, ig, 40, false),
        tap: () => showDailyWheel(this, redraw),
      },
      {
        label: 'Missions',
        sub: toClaim ? 'Claim!' : `${player.missions().filter((m) => m.done).length}/3`,
        hot: toClaim > 0,
        badge: toClaim,
        icon: (ig) => {
          ig.fillStyle(0xf3e6d0, 1);
          ig.fillRoundedRect(-30, -38, 60, 76, 8);
          ig.lineStyle(5, 0x5ee08f, 1);
          for (let k = 0; k < 3; k++) {
            ig.lineBetween(-20, -18 + k * 22, -12, -10 + k * 22);
            ig.lineBetween(-12, -10 + k * 22, 0, -26 + k * 22);
          }
          ig.lineStyle(4, 0x8a7a90, 1);
          for (let k = 0; k < 3; k++) ig.lineBetween(6, -18 + k * 22, 22, -18 + k * 22);
        },
        tap: () => showMissions(this, redraw),
      },
      {
        label: 'Profile',
        sub: `Level ${player.level}`,
        hot: false,
        icon: () => {},
        tap: () => showProfile(this, redraw),
      },
    ];
    const widths = items.map((it) => (it.wide ? 360 : 200));
    const total = widths.reduce((a, b) => a + b, 0);
    let x = 24 + (VW - 48 - total) / 2;
    items.forEach((it, k) => {
      const w = widths[k]!;
      const cx = x + w / 2;
      x += w;
      if (it.wide) {
        const hg = this.add.graphics();
        hg.fillStyle(it.hot ? 0x18b860 : 0x2a1238, 1);
        hg.fillRoundedRect(cx - w / 2 + 14, y + 22, w - 28, 176, 26);
        hg.lineStyle(3, 0xe9c86a, it.hot ? 1 : 0.4);
        hg.strokeRoundedRect(cx - w / 2 + 14, y + 22, w - 28, 176, 26);
        c.add(hg);
      }
      const ig = this.add.graphics();
      ig.setPosition(cx, y + 76);
      it.icon(ig);
      c.add(ig);
      if (it.label === 'Profile') c.add(this.add.image(cx, y + 76, 'av-you').setDisplaySize(96, 96));
      const sub = text(this, cx, y + 184, it.sub, it.wide ? 36 : 28, '800', it.hot ? '#ffe14a' : '#cbb6d6');
      c.add([text(this, cx, y + 142, it.label, it.wide ? 32 : 26, '800', '#ffffff'), sub]);
      if (it.hot) this.tweens.add({ targets: sub, scale: 1.08, duration: 520, yoyo: true, repeat: -1 });
      if (it.wide) this.bonusSub = sub;
      if (it.badge) {
        const b = this.add.graphics();
        b.fillStyle(0xff3b5c, 1);
        b.fillCircle(cx + 44, y + 38, 22);
        c.add([b, text(this, cx + 44, y + 38, String(it.badge), 26, '900', '#ffffff')]);
      }
      const z = this.add.zone(cx, y + 110, w - 10, 210).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        audio.unlock();
        audio.tap();
        it.tap();
      });
      c.add(z);
    });
  }
}
