import Phaser from 'phaser';
import { PAYS_TEXT, POINTS, canBet, resolveRoll, type CrapsBet } from '../logic/craps.ts';
import { secureRandom } from '../logic/cards.ts';
import { DISPLAY_FONT, GOLD, THEME, audio, fmt, haptics, player, wallet } from '../services.ts';
import { VW, backdrop, banner, chipPicker, coinBar, coinShower, frame, makeButton, outOfCoins, text } from '../ui/common.ts';
import { Dealer } from '../ui/dealer.ts';
import { SPOT_MAX, TABLE_CHIPS, stackChips } from '../ui/tablekit.ts';

interface Area {
  id: CrapsBet;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color?: number;
  big?: boolean;
}

const POINT_LABEL: Record<number, string> = { 4: '4', 5: '5', 6: 'SIX', 8: '8', 9: 'NINE', 10: '10' };
const AREAS: Area[] = [
  ...POINTS.map((n, i): Area => ({ id: `place${n}` as CrapsBet, x: 60 + i * 160, y: 430, w: 160, h: 150, label: POINT_LABEL[n]!, big: true })),
  { id: 'hard6', x: 60, y: 610, w: 235, h: 120, label: 'HARD 6' },
  { id: 'hard8', x: 305, y: 610, w: 235, h: 120, label: 'HARD 8' },
  { id: 'hard4', x: 60, y: 740, w: 235, h: 120, label: 'HARD 4' },
  { id: 'hard10', x: 305, y: 740, w: 235, h: 120, label: 'HARD 10' },
  { id: 'any7', x: 560, y: 610, w: 460, h: 80, label: 'ANY SEVEN', color: 0xc8102e },
  { id: 'anyCraps', x: 560, y: 700, w: 460, h: 80, label: 'ANY CRAPS' },
  { id: 'yo', x: 560, y: 790, w: 460, h: 70, label: 'YO · ELEVEN' },
  { id: 'field', x: 60, y: 890, w: 960, h: 120, label: 'FIELD   2 · 3 · 4 · 9 · 10 · 11 · 12' },
  { id: 'dontPass', x: 60, y: 1030, w: 960, h: 90, label: "DON'T PASS BAR" },
  { id: 'pass', x: 60, y: 1140, w: 960, h: 140, label: 'PASS LINE', big: true },
  { id: 'passOdds', x: 340, y: 1300, w: 400, h: 110, label: 'PASS ODDS' },
];

/** Craps: pass line and odds, don't pass, field, place bets, hardways and props. */
export class CrapsScene extends Phaser.Scene {
  private bets: Partial<Record<CrapsBet, number>> = {};
  private point: number | null = null;
  private chip = 100;
  private refresh!: () => void;
  private layer!: Phaser.GameObjects.Container;
  private puck!: Phaser.GameObjects.Container;
  private callText!: Phaser.GameObjects.Text;
  private dice: Phaser.GameObjects.Image[] = [];
  private rolling = false;
  private dealer!: Dealer;
  private controls: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('craps');
  }

  create(): void {
    frame(this);
    backdrop(this, 'table-craps');
    this.refresh = coinBar(this, 'Craps', () => {
      if (!this.rolling) this.scene.start('room', { room: 'tables' });
    });
    this.dealer = new Dealer(this, 'craps', 110, 300);
    this.time.delayedCall(600, () => this.dealer.say('hello'));
    this.rolling = false;
    this.dice = [];
    // printed layout
    const g = this.add.graphics().setDepth(1);
    for (const a of AREAS) {
      g.fillStyle(a.color ?? 0x000000, a.color ? 0.3 : 0.14);
      g.fillRoundedRect(a.x + 4, a.y + 4, a.w - 8, a.h - 8, 12);
      g.lineStyle(4, 0xf4ecd8, 0.85);
      g.strokeRoundedRect(a.x + 4, a.y + 4, a.w - 8, a.h - 8, 12);
      const ty = a.y + a.h / 2 - (a.big ? 18 : 10);
      text(this, a.x + a.w / 2, ty, a.label, a.big ? (a.id === 'pass' ? 60 : 50) : a.id === 'field' ? 34 : 30, '900', a.color ? '#ffe0e4' : '#fdf6e6', DISPLAY_FONT).setDepth(2);
      text(this, a.x + a.w / 2, ty + (a.big ? 46 : 32), PAYS_TEXT[a.id], 20, '700', 'rgba(253,246,230,0.7)').setDepth(2);
      const z = this.add.zone(a.x + a.w / 2, a.y + a.h / 2, a.w, a.h).setInteractive({ useHandCursor: true }).setDepth(3);
      z.on('pointerup', () => this.place(a.id));
    }
    this.layer = this.add.container(0, 0).setDepth(5);
    this.puck = this.add.container(0, 0).setDepth(6);
    this.callText = text(this, VW / 2, 1460, 'Come-out roll · bet the Pass Line', 34, '900', '#ffffff').setDepth(8).setStroke('#000000', 6);
    this.controls = [];
    this.drawControls();
    this.drawBets();
    this.drawPuck();
    (globalThis as Record<string, unknown>).__craps = {
      rolling: () => this.rolling,
      point: () => this.point,
      bet: (id: CrapsBet, amount: number) => this.place(id, amount),
      roll: (d1?: number, d2?: number) => this.roll(d1, d2),
    };
  }

  private drawControls(): void {
    this.controls.forEach((c) => c.destroy());
    this.controls = [
      ...chipPicker(this, 1690, TABLE_CHIPS, this.chip, (v) => (this.chip = v)),
      makeButton(this, 200, 1840, 'Clear', () => this.clear(), { width: 280, height: 104, fontSize: 38, color: 0x2a2430, theme: THEME }),
      makeButton(this, 800, 1840, 'Roll', () => this.roll(), { width: 380, height: 116, fontSize: 50, theme: THEME }),
    ];
  }

  private place(id: CrapsBet, amount = this.chip): void {
    if (this.rolling) return;
    audio.unlock();
    if (!canBet(id, this.point, this.bets)) {
      audio.invalid();
      this.callText.setText(id === 'passOdds' ? 'Odds go behind a Pass Line bet once a point is set' : 'Line bets go down on the come-out roll');
      return;
    }
    // odds are capped at 3x the line bet
    if (id === 'passOdds' && (this.bets.passOdds ?? 0) + amount > (this.bets.pass ?? 0) * 3) {
      audio.invalid();
      this.callText.setText('Odds are limited to 3x your Pass Line bet');
      return;
    }
    if ((this.bets[id] ?? 0) + amount > SPOT_MAX) return audio.invalid();
    if (!wallet.spend(amount)) return outOfCoins(this, this.refresh);
    player.wager(amount);
    this.bets[id] = (this.bets[id] ?? 0) + amount;
    audio.chip();
    this.refresh();
    this.drawBets();
  }

  /** Takes back the bets that may come down (not a Pass Line bet once the point is on). */
  private clear(): void {
    if (this.rolling) return;
    let back = 0;
    for (const [k, v] of Object.entries(this.bets) as [CrapsBet, number][]) {
      if ((k === 'pass' || k === 'dontPass') && this.point !== null) continue;
      back += v;
      delete this.bets[k];
    }
    if (back) {
      wallet.add(back);
      audio.chips(3);
      this.refresh();
    }
    this.drawBets();
  }

  private drawBets(): void {
    this.layer.removeAll(true);
    for (const a of AREAS) {
      const amt = this.bets[a.id] ?? 0;
      if (!amt) continue;
      const off = this.point === null && (a.id.startsWith('place') || a.id.startsWith('hard'));
      const cx = a.x + a.w / 2 + (a.w > 400 ? a.w / 2 - 80 : 0);
      const cy = a.y + a.h / 2 + 6;
      stackChips(this, this.layer, cx, cy, amt, 70);
      const t = text(this, cx, cy + 40, fmt(amt) + (off ? ' · OFF' : ''), 22, '900', off ? '#ffb0b0' : '#ffffff');
      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.7);
      bg.fillRoundedRect(cx - t.width / 2 - 10, cy + 24, t.width + 20, 32, 16);
      this.layer.add([bg, t]);
    }
  }

  /** The ON/OFF puck: on the point number when a point is set, OFF in the corner otherwise. */
  private drawPuck(): void {
    this.puck.removeAll(true);
    const on = this.point !== null;
    const a = on ? AREAS.find((x) => x.id === `place${this.point}`)! : null;
    const x = a ? a.x + a.w / 2 : 1000;
    const y = a ? a.y + 30 : 400;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(x + 3, y + 5, 34);
    g.fillStyle(on ? 0xffffff : 0x1a1a1a, 1);
    g.fillCircle(x, y, 34);
    g.lineStyle(4, on ? 0x1a1a1a : 0xffffff, 1);
    g.strokeCircle(x, y, 26);
    this.puck.add([g, text(this, x, y, on ? 'ON' : 'OFF', 22, '900', on ? '#1a1a1a' : '#ffffff')]);
    this.puck.setScale(1);
    this.tweens.add({ targets: this.puck, scale: { from: 1.15, to: 1 }, duration: 250 });
  }

  private roll(f1?: number, f2?: number): void {
    if (this.rolling) return;
    if (!Object.keys(this.bets).length) {
      audio.invalid();
      this.callText.setText('Place a bet, then roll');
      return;
    }
    audio.unlock();
    this.rolling = true;
    const d1 = f1 ?? 1 + Math.floor(secureRandom() * 6);
    const d2 = f2 ?? 1 + Math.floor(secureRandom() * 6);
    this.dice.forEach((d) => d.destroy());
    // the dice fly from the shooter's corner, tumble and bounce off the back wall
    const land = [
      { x: 430 + Phaser.Math.Between(-40, 40), y: 960 + Phaser.Math.Between(-20, 20) },
      { x: 620 + Phaser.Math.Between(-40, 40), y: 975 + Phaser.Math.Between(-20, 20) },
    ];
    this.dice = [d1, d2].map((v, k) => {
      const img = this.add.image(900 + k * 60, 1500, `die-${1 + Math.floor(Math.random() * 6)}`).setDisplaySize(110, 110).setDepth(30);
      let spin = 0;
      const t = this.time.addEvent({ delay: 70, loop: true, callback: () => img.setTexture(`die-${1 + ((++spin + k) % 6)}`) });
      this.tweens.add({
        targets: img,
        x: land[k]!.x,
        y: land[k]!.y,
        angle: Phaser.Math.Between(540, 900) * (k ? -1 : 1),
        duration: 900,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          t.remove();
          img.setTexture(`die-${v}`).setAngle(Phaser.Math.Between(-20, 20));
          this.tweens.add({ targets: img, scale: { from: img.scale * 1.15, to: img.scale }, duration: 160 });
          audio.knock();
        },
      });
      return img;
    });
    audio.chips(2);
    haptics.fire('light');
    this.time.delayedCall(1100, () => this.settle(d1, d2));
  }

  private settle(d1: number, d2: number): void {
    const r = resolveRoll(this.point, this.bets, d1, d2);
    let back = 0;
    let profit = 0;
    let staked = 0;
    for (const [k, v] of Object.entries(r.paid) as [CrapsBet, number][]) {
      const stays = !r.resolved.includes(k);
      // bets that stay up (place, hardways) only pay their winnings
      back += stays ? v - this.bets[k]! : v;
      profit += v - this.bets[k]!;
    }
    for (const k of r.lost) staked += this.bets[k] ?? 0;
    for (const k of r.resolved) delete this.bets[k];
    this.point = r.point;
    const sum = d1 + d2;
    this.callText.setText(`${sum}  ·  ${r.call}`);
    if (back > 0) {
      wallet.add(back);
      this.refresh();
    }
    const net = profit - staked;
    if (profit > 0) {
      wallet.recordWin(profit);
      player.event('coins_won', profit);
      coinShower(this, VW / 2, 1000, profit);
      audio.complete();
    } else if (staked > 0) audio.invalid();
    if (r.call.startsWith('Winner')) {
      banner(this, r.call.toUpperCase(), profit > 0 ? `+${fmt(profit)}` : '', '#7dffb0');
      this.dealer.say('special', 'Winner, winner!');
    } else if (r.call === 'Seven out') {
      banner(this, 'SEVEN OUT', 'New shooter', '#ff8a9a');
      this.dealer.say('special', 'Seven out. Line away.');
    } else if (r.call.startsWith('Point')) {
      banner(this, `POINT IS ${sum}`, 'Roll it again before a 7', GOLD);
      this.dealer.say('bets', 'Point is on. Odds behind the line?');
    } else this.dealer.react(net, staked || 1);
    this.drawPuck();
    this.drawBets();
    this.time.delayedCall(700, () => {
      this.rolling = false;
      this.dice.forEach((d) => this.tweens.add({ targets: d, alpha: 0.6, duration: 600 }));
    });
  }
}
