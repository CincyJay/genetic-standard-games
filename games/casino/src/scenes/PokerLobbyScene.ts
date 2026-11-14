import Phaser from 'phaser';
import { popIn } from '@tgs/kit';
import { isUnlocked, UNLOCKS } from '../logic/progression.ts';
import { MTT_EVENTS, SNG_BUYINS, mttPrize, paidPlaces, prizeFor, type MttEvent } from '../logic/tournament.ts';
import { DISPLAY_FONT, GOLD, audio, fmt, haptics, player, trophies, wallet } from '../services.ts';
import { VW, backdrop, coinBar, frame, outOfCoins, screenDim, text } from '../ui/common.ts';

export const CASH_STAKES = [
  { name: 'Casual', sb: 10, bb: 20, buyIn: 2_000, unlock: null },
  { name: 'High Roller', sb: 50, bb: 100, buyIn: 10_000, unlock: 'holdem-highroller' as const },
  { name: 'VIP Room', sb: 250, bb: 500, buyIn: 50_000, unlock: 'holdem-vip' as const },
];

type Tab = 'tournaments' | 'sitngo' | 'cash';
const TAB_NAMES: Record<Tab, string> = { tournaments: 'TOURNAMENTS', sitngo: 'SIT & GO', cash: 'CASH GAMES' };
const RED = 0xb8101e;
const NAVY = 0x0c1838;

/**
 * Poker lobby, in the style of a tournament series: an event schedule of
 * multi-table tournaments, sit & gos and cash tables, plus the trophy case.
 */
export class PokerLobbyScene extends Phaser.Scene {
  private tab: Tab = 'tournaments';
  private list: Phaser.GameObjects.Container | null = null;
  private tabBar: Phaser.GameObjects.Container | null = null;
  private refresh!: () => void;
  private top = 0;

  constructor() {
    super('pokerlobby');
  }

  create(): void {
    const view = frame(this);
    backdrop(this, 'room-poker');
    this.add.rectangle(VW / 2, (view.top + view.bottom) / 2, view.right - view.left, view.bottom - view.top, 0x05060f, 0.55);
    this.refresh = coinBar(this, 'Poker', () => this.scene.start('room', { room: 'poker' }));
    this.top = view.top + 210;
    const logo = this.add.image(VW / 2, this.top + 120, 'logo-poker-series').setDisplaySize(860, 258);
    this.tweens.add({ targets: logo, scale: logo.scale * 1.02, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // trophy case shortcut
    const won = trophies.all();
    const tc = this.add.container(VW - 110, this.top + 300);
    tc.add([this.add.image(0, -10, 'trophy-gold').setDisplaySize(110, 110), text(this, 0, 58, `${won.length}`, 30, '900', GOLD)]);
    tc.setSize(150, 160).setInteractive({ useHandCursor: true });
    tc.on('pointerup', () => this.trophyCase());
    const titles = won.filter((t) => t.kind === 'gold' || t.kind === 'ring').length;
    text(this, 60, this.top + 300, `Level ${player.level}  ·  ${titles} ${titles === 1 ? 'title' : 'titles'}  ·  ${won.length} ${won.length === 1 ? 'trophy' : 'trophies'}`, 32, '700', '#cbd6ff').setOrigin(0, 0.5);
    this.drawTabs();
    this.drawList();
    (globalThis as Record<string, unknown>).__pokerlobby = {
      tab: (t: Tab) => {
        this.tab = t;
        this.drawTabs();
        this.drawList();
      },
      rowY: (i: number) => this.top + 520 + i * 250,
    };
  }

  private drawTabs(): void {
    this.tabBar?.destroy();
    const c = this.add.container(0, this.top + 400);
    this.tabBar = c;
    (Object.keys(TAB_NAMES) as Tab[]).forEach((t, i) => {
      const x = 60 + i * 330;
      const on = t === this.tab;
      const g = this.add.graphics();
      g.fillStyle(on ? RED : NAVY, on ? 1 : 0.85);
      g.fillRoundedRect(x, -40, 310, 80, 16);
      g.lineStyle(3, 0xe9c86a, on ? 1 : 0.35);
      g.strokeRoundedRect(x, -40, 310, 80, 16);
      const z = this.add.zone(x + 155, 0, 310, 80).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        audio.tap();
        this.tab = t;
        this.drawTabs();
        this.drawList();
      });
      c.add([g, text(this, x + 155, 0, TAB_NAMES[t], 30, '900', on ? '#ffffff' : '#9aa8d8').setLetterSpacing(2), z]);
    });
  }

  private drawList(): void {
    this.list?.destroy();
    const c = this.add.container(0, 0);
    this.list = c;
    const y0 = this.top + 520;
    if (this.tab === 'tournaments') {
      MTT_EVENTS.forEach((ev, i) => this.eventRow(c, ev, y0 + i * 250, i));
    } else if (this.tab === 'sitngo') {
      SNG_BUYINS.forEach((sg, i) =>
        this.row(c, y0 + i * 250, i, {
          title: sg.name,
          lines: [`6 players · 1,500 chips · top 3 paid`, `1st ${fmt(prizeFor(sg.buyIn, 1))} · 2nd ${fmt(prizeFor(sg.buyIn, 2))} · 3rd ${fmt(prizeFor(sg.buyIn, 3))}`],
          price: sg.buyIn,
          action: 'PLAY',
          lockedAt: null,
          onTap: () => this.pay(sg.buyIn, { mode: 'sng', sng: i }),
        }),
      );
    } else {
      CASH_STAKES.forEach((st, i) => {
        const lockedAt = st.unlock && !isUnlocked(st.unlock, player.level) ? UNLOCKS.find((u) => u.id === st.unlock)!.level : null;
        this.row(c, y0 + i * 250, i, {
          title: `${st.name} Table`,
          lines: [`Blinds ${fmt(st.sb)} / ${fmt(st.bb)} · 6 seats`, 'Chips come back when you leave'],
          price: st.buyIn,
          action: 'SIT',
          lockedAt,
          onTap: () => this.pay(st.buyIn, { mode: 'cash', stake: i }),
        });
      });
    }
  }

  private eventRow(c: Phaser.GameObjects.Container, ev: MttEvent, y: number, i: number): void {
    const lockedAt = player.level < ev.level ? ev.level : null;
    this.row(c, y, i, {
      title: `#${i + 1}  ${ev.name}`,
      lines: [
        `${ev.field} players · ${fmt(ev.startChips)} chips · ${paidPlaces(ev.field)} paid · ${ev.tag}`,
        `Prize pool ${fmt(ev.buyIn * ev.field)}  ·  1st ${fmt(mttPrize(ev, 1))}`,
      ],
      price: ev.buyIn,
      action: 'REGISTER',
      lockedAt,
      onTap: () => this.pay(ev.buyIn, { mode: 'mtt', event: ev.id }),
      featured: ev.id === 'main',
    });
  }

  private row(
    c: Phaser.GameObjects.Container,
    y: number,
    i: number,
    o: { title: string; lines: string[]; price: number; action: string; lockedAt: number | null; onTap: () => void; featured?: boolean },
  ): void {
    const r = this.add.container(VW / 2, y + 100);
    const w = 980;
    const h = 220;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(-w / 2, -h / 2 + 10, w, h, 24);
    g.fillGradientStyle(o.featured ? 0x5a0a14 : 0x14214a, o.featured ? 0x5a0a14 : 0x14214a, o.featured ? 0x2a0408 : 0x080e24, o.featured ? 0x2a0408 : 0x080e24, 0.96);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 24);
    g.lineStyle(3, 0xe9c86a, o.featured ? 1 : 0.55);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 24);
    // red ribbon on the left edge
    g.fillStyle(o.featured ? 0xe9c86a : RED, 1);
    g.fillRoundedRect(-w / 2, -h / 2, 16, h, { tl: 24, bl: 24, tr: 0, br: 0 });
    r.add(g);
    r.add(text(this, -w / 2 + 44, -58, o.title, 44, '900', '#ffffff', DISPLAY_FONT).setOrigin(0, 0.5));
    o.lines.forEach((l, k) => r.add(text(this, -w / 2 + 44, 2 + k * 42, l, 26, '600', k ? GOLD : '#b8c4ec').setOrigin(0, 0.5)));
    // buy-in and action
    const bx = w / 2 - 140;
    const pill = this.add.image(bx, 22, o.lockedAt ? 'pill-dark' : o.action === 'REGISTER' ? 'pill-fold' : 'pill-raise').setDisplaySize(230, 84);
    const price = text(this, bx + 110, -58, fmt(o.price), 40, '900', GOLD).setOrigin(1, 0.5);
    r.add([pill, text(this, bx, 22, o.lockedAt ? `LEVEL ${o.lockedAt}` : o.action, 30, '900', '#ffffff'), price]);
    r.add(this.add.image(bx + 110 - price.width - 30, -58, 'coin').setDisplaySize(42, 42));
    if (o.lockedAt) {
      const shade = this.add.graphics();
      shade.fillStyle(0x000000, 0.35);
      shade.fillRoundedRect(-w / 2, -h / 2, w, h, 24);
      r.add(shade);
    }
    r.setSize(w, h).setInteractive({ useHandCursor: true });
    r.on('pointerup', () => {
      audio.unlock();
      if (o.lockedAt) {
        audio.invalid();
        haptics.fire('error');
        this.tweens.add({ targets: r, x: VW / 2 + 12, duration: 60, yoyo: true, repeat: 2 });
        return;
      }
      audio.tap();
      o.onTap();
    });
    r.setAlpha(0).setScale(0.96);
    this.tweens.add({ targets: r, alpha: 1, scale: 1, duration: 260, delay: 60 + i * 70, ease: 'Back.easeOut' });
    c.add(r);
  }

  private pay(buyIn: number, data: Record<string, unknown>): void {
    if (!wallet.spend(buyIn)) return outOfCoins(this, this.refresh);
    audio.chips(6);
    haptics.fire('medium');
    this.scene.start('holdem', data);
  }

  /** The player's trophies, newest first. */
  private trophyCase(): void {
    audio.tap();
    const dim = screenDim(this, 0.75, 200);
    const panel = this.add.container(VW / 2, 960).setDepth(201);
    const g = this.add.graphics();
    g.fillStyle(0x0a0e1e, 0.97);
    g.fillRoundedRect(-480, -700, 960, 1400, 36);
    g.lineStyle(4, 0xe9c86a, 0.9);
    g.strokeRoundedRect(-480, -700, 960, 1400, 36);
    panel.add([g, text(this, 0, -620, 'Trophy Case', 64, '900', GOLD, DISPLAY_FONT)]);
    const all = [...trophies.all()].reverse();
    if (!all.length) {
      panel.add(this.add.image(0, -200, 'trophy-gold').setDisplaySize(300, 300).setAlpha(0.35));
      panel.add(text(this, 0, 20, 'No trophies yet', 44, '800', '#ffffff'));
      panel.add(text(this, 0, 80, 'Finish in the top three of a tournament\nor win a sit & go to earn one.', 30, '600', '#9aa8d8'));
    } else {
      all.slice(0, 12).forEach((t, k) => {
        const x = -300 + (k % 3) * 300;
        const y = -420 + Math.floor(k / 3) * 270;
        panel.add(this.add.image(x, y, t.kind === 'ring' ? 'ring' : `trophy-${t.kind}`).setDisplaySize(170, 170));
        panel.add(text(this, x, y + 100, t.event, 24, '800', '#ffffff'));
        panel.add(text(this, x, y + 128, `${t.place === 1 ? 'Winner' : t.place === 2 ? '2nd' : '3rd'} · ${fmt(t.prize)}`, 22, '600', GOLD));
      });
    }
    const close = this.add.zone(0, 0, 960, 1400).setInteractive();
    close.on('pointerup', () => {
      dim.destroy();
      panel.destroy();
    });
    panel.add(close);
    panel.add(text(this, 0, 640, 'Tap to close', 28, '600', '#9aa8d8'));
    popIn(this, panel);
  }
}
