import Phaser from 'phaser';
import { cardId, cards } from '../logic/cards.ts';
import { UNLOCKS, isUnlocked, type UnlockId } from '../logic/progression.ts';
import { MACHINES, type Machine } from '../logic/slots.ts';
import { DISPLAY_FONT, GOLD, audio, bonus, fmt, haptics, player } from '../services.ts';
import { showDailyWheel, showMissions, showProfile } from '../ui/progress.ts';
import { CARD_H, CARD_W, coinBar, coinShower, formatWait, text } from '../ui/common.ts';
import { VW, backdrop, frame } from '../ui/common.ts';
import { drawWheel } from '../ui/wheel.ts';
import { FEATURE_TEXT, machineBg, symKey } from './SlotsScene.ts';

const TILE_W = 440;
const TILE_H = 500;
const GAP = 26;
const PAD = 40;

interface Tile {
  key: string;
  title: string;
  sub: string;
  bg: string;
  unlock: UnlockId | null;
  ribbon?: string;
  data?: Record<string, unknown>;
  art: (c: Phaser.GameObjects.Container) => void;
}

const SLOT_UNLOCK: Record<string, UnlockId | null> = {
  sevens: null,
  lanterns: 'slots-lanterns',
  pharaoh: 'slots-pharaoh',
  ocean: 'slots-ocean',
  goldrush: 'slots-goldrush',
};
const SHOWCASE: Record<string, string[]> = {
  sevens: ['seven', 'wild', 'seven'],
  lanterns: ['scatter', 'tiger', 'scatter'],
  pharaoh: ['mask', 'wild', 'gem'],
  ocean: ['shark', 'wild', 'pearl'],
  goldrush: ['nugget', 'wild', 'bar'],
};
const RIBBON: Record<string, string> = { lanterns: 'NEW', sevens: 'HOT' };

/**
 * Casino floor: a jackpot marquee, a sideways-scrolling wall of machine and
 * table tiles (two rows), and a bottom bar with the hourly bonus, daily wheel,
 * missions and the player's profile.
 */
export class LobbyScene extends Phaser.Scene {
  private strip!: Phaser.GameObjects.Container;
  private dragged = false;
  private bar: Phaser.GameObjects.Container | null = null;
  private bonusSub: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('lobby');
  }

  create(): void {
    const view = frame(this);
    backdrop(this, 'bg-lobby');
    const refresh = coinBar(this, 'Velvet Ace');
    this.marquee(view.top);

    const tiles: Tile[] = [
      ...MACHINES.map((m) => this.slotTile(m)),
      {
        key: 'blackjack', title: 'Blackjack', sub: 'Up to 3 hands · side bets', bg: 'bg-felt', unlock: null,
        art: (c) => this.cardsArt(c, 'As Kh', true),
      },
      {
        key: 'holdem', title: "Texas Hold'em", sub: 'Cash tables · Sit & Go', bg: 'bg-poker', unlock: null,
        art: (c) => this.cardsArt(c, 'Ad Ac', true),
      },
      {
        key: 'videopoker', title: 'Video Poker', sub: 'Jacks · Deuces · Bonus', bg: 'bg-slots-ocean', unlock: null,
        art: (c) => this.cardsArt(c, 'Th Jh Qh Kh Ah', false),
      },
      {
        key: 'roulette', title: 'Roulette', sub: 'European · racetrack', bg: 'bg-felt-red', unlock: null,
        art: (c) => this.wheelArt(c),
      },
    ];

    // two rows, filled column by column, scrolling sideways
    const top = view.top + 380;
    const barTop = Math.max(top + TILE_H * 2 + GAP + 40, view.bottom - 330);
    const rowsTop = top + Math.max(0, (barTop - top - (TILE_H * 2 + GAP)) / 2 - 10);
    this.strip = this.add.container(0, 0);
    tiles.forEach((t, i) => {
      const col = Math.floor(i / 2);
      const row = i % 2;
      this.tile(t, PAD + col * (TILE_W + GAP) + TILE_W / 2, rowsTop + row * (TILE_H + GAP) + TILE_H / 2, i);
    });
    const cols = Math.ceil(tiles.length / 2);
    const contentW = PAD * 2 + cols * TILE_W + (cols - 1) * GAP;
    this.scroller(rowsTop, rowsTop + TILE_H * 2 + GAP, Math.min(0, VW - contentW));

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
      scrollTo: (x: number) => (this.strip.x = Math.max(Math.min(0, VW - contentW), Math.min(0, x))),
      stripX: () => this.strip.x,
      barY: barTop + 110,
      rowsTop,
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

  // ---------------------------------------------------------------- tiles
  private slotTile(m: Machine): Tile {
    return {
      key: 'slots',
      title: m.name,
      sub: FEATURE_TEXT[m.feature],
      bg: machineBg(m),
      unlock: SLOT_UNLOCK[m.id] ?? null,
      ribbon: RIBBON[m.id],
      data: { machine: m.id },
      art: (c) => {
        const win = this.add.graphics();
        win.fillStyle(0x0a0310, 0.85);
        win.fillRoundedRect(-190, -150, 380, 160, 22);
        win.lineStyle(4, 0xe9c86a, 0.9);
        win.strokeRoundedRect(-190, -150, 380, 160, 22);
        c.add(win);
        SHOWCASE[m.id]!.forEach((s, k) => c.add(this.add.image((k - 1) * 122, -70, symKey(m, s)).setDisplaySize(120, 120)));
      },
    };
  }

  /** A crop of a backdrop as the tile's picture. */
  private tileBg(key: string): Phaser.GameObjects.Image {
    const fk = `tile-${key}`;
    const tex = this.textures.get(key);
    if (!tex.has(fk)) {
      const src = tex.getSourceImage() as { width: number; height: number };
      const h = (src.width * TILE_H) / TILE_W;
      tex.add(fk, 0, 0, Math.max(0, src.height * 0.36 - h / 2), src.width, h);
    }
    return this.add.image(0, 0, key, fk).setDisplaySize(TILE_W, TILE_H);
  }

  private tile(t: Tile, x: number, y: number, i: number): void {
    const locked = t.unlock ? !isUnlocked(t.unlock, player.level) : false;
    const c = this.add.container(x, y);
    this.strip.add(c);
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(-TILE_W / 2 + 4, -TILE_H / 2 + 12, TILE_W, TILE_H, 30);
    c.add(shadow);
    const bg = this.tileBg(t.bg);
    // rounded corners: a mask-free trick, frame drawn over the image corners
    c.add(bg);
    const fr = this.add.graphics();
    fr.fillStyle(0x000000, 0.0);
    fr.lineStyle(14, 0x14071f, 1);
    fr.strokeRoundedRect(-TILE_W / 2 - 4, -TILE_H / 2 - 4, TILE_W + 8, TILE_H + 8, 34);
    fr.lineStyle(5, 0xe9c86a, 1);
    fr.strokeRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 30);
    fr.lineStyle(2, 0xfff4b0, 0.6);
    fr.strokeRoundedRect(-TILE_W / 2 + 8, -TILE_H / 2 + 8, TILE_W - 16, TILE_H - 16, 24);
    const art = this.add.container(0, 0);
    t.art(art);
    c.add(art);
    // name plate
    const plate = this.add.graphics();
    plate.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.85, 0.85);
    plate.fillRect(-TILE_W / 2, TILE_H / 2 - 210, TILE_W, 210);
    c.add(plate);
    c.add(fr);
    c.add(text(this, 0, TILE_H / 2 - 112, t.title, t.title.length > 13 ? 50 : 58, '900', GOLD, DISPLAY_FONT).setStroke('#1a0700', 10));
    c.add(text(this, 0, TILE_H / 2 - 52, t.sub, 26, '700', '#f3e6f0').setStroke('#000000', 5));
    if (t.ribbon && !locked) {
      const r = this.add.graphics();
      r.fillStyle(t.ribbon === 'NEW' ? 0x18b860 : 0xe8283e, 1);
      r.fillRoundedRect(TILE_W / 2 - 130, -TILE_H / 2 + 22, 112, 50, 14);
      r.lineStyle(3, 0xffffff, 0.8);
      r.strokeRoundedRect(TILE_W / 2 - 130, -TILE_H / 2 + 22, 112, 50, 14);
      const rt = text(this, TILE_W / 2 - 74, -TILE_H / 2 + 47, t.ribbon, 30, '900', '#ffffff');
      c.add([r, rt]);
      this.tweens.add({ targets: rt, scale: 1.12, duration: 500, yoyo: true, repeat: -1 });
    }
    if (locked) {
      const lvl = UNLOCKS.find((u) => u.id === t.unlock)!.level;
      const shade = this.add.graphics();
      shade.fillStyle(0x000000, 0.62);
      shade.fillRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 30);
      const lock = this.add.graphics();
      lock.lineStyle(14, 0xe9c86a, 1);
      lock.beginPath();
      lock.arc(0, -70, 36, Math.PI, 0);
      lock.strokePath();
      lock.fillStyle(0xe9c86a, 1);
      lock.fillRoundedRect(-56, -70, 112, 86, 14);
      lock.fillStyle(0x3a2a10, 1);
      lock.fillCircle(0, -36, 10);
      c.add([shade, lock, text(this, 0, 60, `Unlocks at level ${lvl}`, 34, '800', '#ffffff')]);
    }
    c.setSize(TILE_W, TILE_H).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      if (this.dragged) return;
      audio.unlock();
      if (locked) {
        audio.invalid();
        haptics.fire('error');
        this.tweens.add({ targets: c, x: x + 12, duration: 60, yoyo: true, repeat: 2 });
        return;
      }
      audio.tap();
      haptics.fire('light');
      this.tweens.add({ targets: c, scale: { from: 0.95, to: 1 }, duration: 160, onComplete: () => this.scene.start(t.key, t.data) });
    });
    c.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 320, delay: 80 + i * 50, ease: 'Back.easeOut' });
  }

  /** Sideways drag with momentum and soft edges. */
  private scroller(y0: number, y1: number, minX: number): void {
    let startX = 0;
    let startStrip = 0;
    let down = false;
    let lastX = 0;
    let lastT = 0;
    let vel = 0;
    let glide: Phaser.Tweens.Tween | null = null;
    const clamp = (x: number) => Phaser.Math.Clamp(x, minX, 0);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.worldY < y0 || p.worldY > y1) return;
      down = true;
      this.dragged = false;
      glide?.stop();
      startX = lastX = p.x;
      lastT = p.time;
      startStrip = this.strip.x;
      vel = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!down) return;
      const dx = p.x - startX;
      if (Math.abs(dx) > 14) this.dragged = true;
      if (!this.dragged) return;
      let x = startStrip + dx;
      if (x > 0) x = x * 0.35;
      if (x < minX) x = minX + (x - minX) * 0.35;
      this.strip.x = x;
      const dt = Math.max(1, p.time - lastT);
      vel = (p.x - lastX) / dt;
      lastX = p.x;
      lastT = p.time;
    });
    this.input.on('pointerup', () => {
      if (!down) return;
      down = false;
      const target = clamp(this.strip.x + vel * 380);
      glide = this.tweens.add({ targets: this.strip, x: target, duration: 520, ease: 'Cubic.easeOut' });
      // let the tile's own pointerup see `dragged` first, then reset
      this.time.delayedCall(0, () => (this.dragged = false));
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

  // ---------------------------------------------------------------- table art
  private cardsArt(c: Phaser.GameObjects.Container, ids: string, chip: boolean): void {
    const cs = cards(ids);
    const n = cs.length;
    const scale = n > 2 ? 0.66 : 0.9;
    cs.forEach((card, i) => {
      const a = (i - (n - 1) / 2) * (n > 2 ? 12 : 14);
      c.add(
        this.add
          .image((i - (n - 1) / 2) * (n > 2 ? 52 : 80), -80 + Math.abs(i - (n - 1) / 2) * 8, `card-${cardId(card)}`)
          .setDisplaySize(CARD_W * scale, CARD_H * scale)
          .setAngle(a),
      );
    });
    if (chip) c.add(this.add.image(130, -10, 'chip-500').setDisplaySize(100, 100));
  }

  private wheelArt(c: Phaser.GameObjects.Container): void {
    const g = this.add.graphics();
    drawWheel(this, g, 110, false);
    const holder = this.add.container(0, -70, [g]);
    c.add(holder);
    this.tweens.add({ targets: holder, angle: 360, duration: 12000, repeat: -1 });
  }
}
