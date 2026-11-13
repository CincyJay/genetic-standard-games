import Phaser from 'phaser';
import { WHEEL_ORDER, colorOf, settle, spin, spotKey, wins, type Bet, type BetSpot } from '../logic/roulette.ts';
import { DISPLAY_FONT, SECONDARY, THEME, audio, fmt, haptics, wallet } from '../services.ts';
import { banner, chipPicker, coinBar, coinShower, makeButton, outOfCoins, text } from '../ui/common.ts';
import { drawWheel } from '../ui/wheel.ts';

const CHIPS = [10, 50, 100, 500, 1000, 5000];
// Table layout (portrait): 0 on top, 12 rows of 3 numbers, outside bets on the right.
const GX = 115; // grid left
const GY = 384; // grid top (first number row)
const CW = 190; // cell width
const CH = 86; // cell height
const SIDE_X = GX + CW * 3; // dozens column x
const SIDE_W = 120;
const OUT_X = SIDE_X + SIDE_W; // even-money column x
const OUT_W = 140;
const RED_HEX = 0xc8102e;
const BLACK_HEX = 0x1d1d22;

interface Spot {
  spot: BetSpot;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class RouletteScene extends Phaser.Scene {
  private chip = 100;
  private bets = new Map<string, Bet>();
  private history: string[] = [];
  private spots: Spot[] = [];
  private chipSprites = new Map<string, Phaser.GameObjects.Container>();
  private refresh!: () => void;
  private totalText!: Phaser.GameObjects.Text;
  private recent: number[] = [];
  private recentRow!: Phaser.GameObjects.Container;
  private marker: Phaser.GameObjects.Graphics | null = null;
  private spinning = false;
  private lastBets: Bet[] = [];

  constructor() {
    super('roulette');
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.add.image(w / 2, h / 2, 'bg-felt').setDisplaySize(w, h);
    this.bets = new Map();
    this.history = [];
    this.spots = [];
    this.chipSprites = new Map();
    this.spinning = false;
    this.marker = null;
    this.refresh = coinBar(this, 'Roulette', () => {
      if (!this.spinning) this.scene.start('lobby');
    });
    this.recentRow = this.add.container(0, 240);
    this.drawRecent();
    this.drawTable();
    this.totalText = text(this, w / 2, 1555, '', 38, '800', '#ffffff');
    chipPicker(this, 1665, CHIPS, this.chip, (v) => (this.chip = v));
    makeButton(this, 170, 1820, 'Clear', () => this.clear(), { width: 260, height: 110, fontSize: 40, ...SECONDARY, theme: THEME });
    makeButton(this, 440, 1820, 'Undo', () => this.undo(), { width: 240, height: 110, fontSize: 40, ...SECONDARY, theme: THEME });
    makeButton(this, 800, 1820, 'Spin', () => this.spinWheel(), { width: 400, height: 130, fontSize: 56, theme: THEME });
    this.updateTotal();
  }

  // ---------------------------------------------------------------- table
  private addSpot(spot: BetSpot, x: number, y: number, w: number, h: number, fill: number, label: string, size = 36, rotate = false): void {
    const g = this.add.graphics();
    g.fillStyle(fill, fill === 0x000000 ? 0 : 1);
    g.fillRect(x, y, w, h);
    g.lineStyle(3, 0xe9c86a, 0.8);
    g.strokeRect(x, y, w, h);
    const t = text(this, x + w / 2, y + h / 2, label, size, '800', '#ffffff');
    if (rotate) t.setAngle(90);
    const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.place(spot));
    this.spots.push({ spot, x, y, w, h });
  }

  private drawTable(): void {
    this.addSpot({ type: 'straight', n: 0 }, GX, GY - CH, CW * 3, CH, 0x0f8a4a, '0', 40);
    for (let n = 1; n <= 36; n++) {
      const row = Math.ceil(n / 3) - 1;
      const col = (n - 1) % 3;
      this.addSpot({ type: 'straight', n }, GX + col * CW, GY + row * CH, CW, CH, colorOf(n) === 'red' ? RED_HEX : BLACK_HEX, String(n), 38);
    }
    // column bets ("2 to 1") under the grid
    ([1, 2, 3] as const).forEach((c) => this.addSpot({ type: 'column', n: c }, GX + (c - 1) * CW, GY + 12 * CH, CW, CH, 0x000000, '2 to 1', 30));
    // dozens beside the grid
    (['1st 12', '2nd 12', '3rd 12'] as const).forEach((label, i) =>
      this.addSpot({ type: 'dozen', n: (i + 1) as 1 | 2 | 3 }, SIDE_X, GY + i * 4 * CH, SIDE_W, CH * 4, 0x000000, label, 30, true),
    );
    // even-money bets
    const outside: [BetSpot, string, number][] = [
      [{ type: 'low' }, '1–18', 0x000000],
      [{ type: 'even' }, 'EVEN', 0x000000],
      [{ type: 'red' }, 'RED', RED_HEX],
      [{ type: 'black' }, 'BLACK', BLACK_HEX],
      [{ type: 'odd' }, 'ODD', 0x000000],
      [{ type: 'high' }, '19–36', 0x000000],
    ];
    outside.forEach(([spot, label, fill], i) => this.addSpot(spot, OUT_X, GY + i * 2 * CH, OUT_W, CH * 2, fill, label, 30, true));
  }

  private spotOf(s: BetSpot): Spot {
    return this.spots.find((p) => spotKey(p.spot) === spotKey(s))!;
  }

  private place(spot: BetSpot): void {
    if (this.spinning) return;
    if (!wallet.canAfford(this.totalBet() + this.chip)) return outOfCoins(this, this.refresh);
    audio.unlock();
    audio.play([{ freq: 900, to: 1200, dur: 0.05, wave: 'triangle', vol: 0.12 }]);
    haptics.fire('light');
    const key = spotKey(spot);
    const bet = this.bets.get(key) ?? { spot, amount: 0 };
    bet.amount += this.chip;
    this.bets.set(key, bet);
    this.history.push(key);
    this.drawChip(key);
    this.updateTotal();
  }

  private drawChip(key: string): void {
    this.chipSprites.get(key)?.destroy();
    this.chipSprites.delete(key);
    const bet = this.bets.get(key);
    if (!bet) return;
    const p = this.spotOf(bet.spot);
    const value = [...CHIPS].reverse().find((v) => v <= bet.amount) ?? 10;
    const img = this.add.image(0, 0, `chip-${value}`).setDisplaySize(76, 76);
    const label = text(this, 0, 0, fmt(bet.amount), 22, '900', '#ffffff').setStroke('#000000', 5);
    const c = this.add.container(p.x + p.w / 2, p.y + p.h / 2, [img, label]).setDepth(15);
    c.setScale(0.6);
    this.tweens.add({ targets: c, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.chipSprites.set(key, c);
  }

  private totalBet(): number {
    let t = 0;
    for (const b of this.bets.values()) t += b.amount;
    return t;
  }

  private updateTotal(): void {
    const t = this.totalBet();
    this.totalText.setText(t > 0 ? `Total bet ${fmt(t)}` : 'Tap the table to place chips');
  }

  private clear(): void {
    if (this.spinning) return;
    audio.tap();
    this.bets.clear();
    this.history = [];
    for (const c of this.chipSprites.values()) c.destroy();
    this.chipSprites.clear();
    this.updateTotal();
  }

  private undo(): void {
    if (this.spinning) return;
    const key = this.history.pop();
    if (!key) {
      // nothing placed yet: repeat the last round's bets
      if (this.lastBets.length && wallet.canAfford(this.lastBets.reduce((s, b) => s + b.amount, 0))) {
        for (const b of this.lastBets) {
          this.bets.set(spotKey(b.spot), { ...b });
          this.history.push(spotKey(b.spot));
          this.drawChip(spotKey(b.spot));
        }
        this.updateTotal();
      }
      return;
    }
    audio.tap();
    const bet = this.bets.get(key)!;
    bet.amount -= this.chip;
    if (bet.amount <= 0) this.bets.delete(key);
    this.drawChip(key);
    this.updateTotal();
  }

  // ----------------------------------------------------------------- spin
  private spinWheel(): void {
    if (this.spinning) return;
    const total = this.totalBet();
    if (total === 0) {
      this.undo(); // rebet if available
      return;
    }
    if (!wallet.spend(total)) return outOfCoins(this, this.refresh);
    this.refresh();
    audio.unlock();
    this.spinning = true;
    this.marker?.destroy();
    this.marker = null;
    const result = spin();
    const { width: w, height: h } = this.scale;

    // wheel overlay
    const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0).setDepth(60);
    this.tweens.add({ targets: dim, fillAlpha: 0.6, duration: 250 });
    const R = 400;
    const g = this.add.graphics();
    const labels = drawWheel(this, g, R);
    const wheel = this.add.container(0, 0, [g, ...labels]);
    const ball = this.add.circle(0, -R * 0.93, 18, 0xffffff).setStrokeStyle(3, 0xbbbbbb);
    const ballHolder = this.add.container(0, 0, [ball]);
    const holder = this.add.container(w / 2, 900, [wheel, ballHolder]).setDepth(61).setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: holder, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });

    // land the ball on the winning pocket: wheel spins clockwise, ball counter-clockwise
    const idx = WHEEL_ORDER.indexOf(result);
    const step = 360 / WHEEL_ORDER.length;
    const wheelEnd = 360 * 3 + Phaser.Math.Between(0, 359);
    const pocketAngle = wheelEnd + idx * step; // where that pocket ends up (deg, 0 = top)
    const ballEnd = -360 * 5 + (pocketAngle % 360) - 360;
    const dur = 4200;
    this.tweens.add({ targets: wheel, angle: wheelEnd, duration: dur, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: ballHolder, angle: ballEnd, duration: dur, ease: 'Cubic.easeOut' });
    // ball drops from the rim into the pockets
    this.tweens.add({ targets: ball, y: -R * 0.74, duration: 800, delay: dur - 1300, ease: 'Bounce.easeOut' });
    let ticks = 0;
    const tick = this.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        ticks++;
        if (ticks % Math.max(1, Math.floor(ticks / 12)) === 0) audio.play([{ freq: 2200, dur: 0.015, wave: 'square', vol: 0.03 }]);
      },
    });

    this.time.delayedCall(dur + 200, () => {
      tick.remove();
      const col = colorOf(result);
      const t = text(this, w / 2, 1420, `${result} ${col.toUpperCase()}`, 80, '900', col === 'red' ? '#ff5d6e' : col === 'green' ? '#5dff9a' : '#ffffff', DISPLAY_FONT)
        .setStroke('#000000', 12)
        .setDepth(62);
      audio.drop(4);
      this.time.delayedCall(1300, () => {
        this.tweens.add({ targets: [holder, t], alpha: 0, scale: 0.4, duration: 300, onComplete: () => (holder.destroy(), t.destroy()) });
        this.tweens.add({ targets: dim, fillAlpha: 0, duration: 300, onComplete: () => dim.destroy() });
        this.resolve(result);
      });
    });
  }

  private resolve(n: number): void {
    const bets = [...this.bets.values()];
    const returned = settle(bets, n);
    const staked = this.totalBet();
    this.recent.unshift(n);
    this.recent = this.recent.slice(0, 10);
    this.drawRecent();
    // mark the winning number on the table
    const p = this.spotOf({ type: 'straight', n });
    this.marker = this.add.graphics().setDepth(16);
    this.marker.lineStyle(8, 0xffffff, 1);
    this.marker.strokeRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
    this.tweens.add({ targets: this.marker, alpha: 0.3, duration: 400, yoyo: true, repeat: 3 });
    // losing chips slide off, winners stay
    for (const [key, b] of this.bets) {
      const c = this.chipSprites.get(key)!;
      if (!wins(b.spot, n)) this.tweens.add({ targets: c, x: 540, y: 120, alpha: 0, duration: 400, delay: 200, onComplete: () => c.destroy() });
    }
    if (returned > 0) {
      wallet.add(returned);
      this.refresh();
      const net = returned - staked;
      if (net > 0) {
        wallet.recordWin(net);
        banner(this, 'You win', `+${fmt(net)}`);
        audio.win();
        coinShower(this, p.x + p.w / 2, p.y, net);
        haptics.fire('success');
      } else {
        audio.complete();
      }
    } else audio.invalid();
    this.lastBets = bets.map((b) => ({ ...b }));
    this.time.delayedCall(1600, () => {
      this.bets.clear();
      this.history = [];
      for (const c of this.chipSprites.values()) c.destroy();
      this.chipSprites.clear();
      this.updateTotal();
      this.totalText.setText('Place your bets  ·  Undo repeats last bet');
      this.spinning = false;
    });
  }

  private drawRecent(): void {
    this.recentRow.removeAll(true);
    const w = this.scale.width;
    if (this.recent.length === 0) {
      this.recentRow.add(text(this, w / 2, 0, 'European wheel  ·  single zero', 30, '600', 'rgba(255,244,220,0.6)'));
      return;
    }
    this.recent.forEach((n, i) => {
      const x = 90 + i * 98;
      const g = this.add.graphics();
      const col = colorOf(n);
      g.fillStyle(col === 'red' ? RED_HEX : col === 'black' ? BLACK_HEX : 0x0f8a4a, 1);
      g.fillCircle(x, 0, i === 0 ? 40 : 34);
      g.lineStyle(3, 0xe9c86a, i === 0 ? 1 : 0.5);
      g.strokeCircle(x, 0, i === 0 ? 40 : 34);
      this.recentRow.add([g, text(this, x, 0, String(n), i === 0 ? 34 : 28, '900', '#ffffff')]);
    });
  }
}

