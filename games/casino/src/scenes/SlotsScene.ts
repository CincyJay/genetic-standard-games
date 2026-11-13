import Phaser from 'phaser';
import { FREE_SPIN_MULTIPLIER, LINES, LINE_BETS, SYMBOLS, gridFromStops, evaluate, spinStops, type SpinResult, type Sym } from '../logic/slots.ts';
import { DISPLAY_FONT, GOLD, SECONDARY, THEME, analytics, audio, fmt, haptics, wallet } from '../services.ts';
import { banner, coinBar, coinShower, makeButton, outOfCoins, text } from '../ui/common.ts';

const CELL = 186;
const LEFT = (1080 - CELL * 5) / 2;
const TOP = 420;
const LINE_COLORS = [0xff4f8b, 0x4fd1ff, 0xffe14a, 0x7dff6a, 0xff9a3c, 0xc77dff, 0xffffff];

export class SlotsScene extends Phaser.Scene {
  private betIndex = 2;
  private reels: Phaser.GameObjects.Container[] = [];
  private finals: Phaser.GameObjects.Image[][] = [];
  private spinning = false;
  private freeSpins = 0;
  private freeTotal = 0;
  private autoLeft = 0;
  private refresh!: () => void;
  private winText!: Phaser.GameObjects.Text;
  private betText!: Phaser.GameObjects.Text;
  private fsText!: Phaser.GameObjects.Text;
  private lines!: Phaser.GameObjects.Graphics;
  private spinBtn!: Phaser.GameObjects.Container;
  private autoBtn!: Phaser.GameObjects.Container;

  constructor() {
    super('slots');
  }

  private get lineBet(): number {
    return LINE_BETS[this.betIndex]!;
  }
  private get totalBet(): number {
    return this.lineBet * LINES.length;
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.add.image(w / 2, h / 2, 'bg-slots').setDisplaySize(w, h);
    this.reels = [];
    this.finals = [];
    this.spinning = false;
    this.freeSpins = 0;
    this.autoLeft = 0;

    // reel window
    const win = this.add.graphics();
    win.fillStyle(0x0d0414, 1);
    win.fillRoundedRect(LEFT - 16, TOP - 16, CELL * 5 + 32, CELL * 3 + 32, 28);
    for (let r = 0; r < 5; r++) {
      win.fillStyle(r % 2 ? 0x1c0a28 : 0x22102f, 1);
      win.fillRect(LEFT + r * CELL, TOP, CELL, CELL * 3);
    }
    const start = gridFromStops(spinStops());
    for (let r = 0; r < 5; r++) {
      const col = this.add.container(LEFT + CELL * (r + 0.5), 0);
      const imgs = start[r]!.map((s, row) => this.symbol(s, TOP + CELL * (row + 0.5)));
      col.add(imgs);
      this.reels.push(col);
      this.finals.push(imgs);
    }
    // covers above and below the window hide the spinning strips
    this.add.image(0, 0, 'bg-slots').setOrigin(0).setDisplaySize(w, h).setCrop(0, 0, 1080, TOP - 16).setDepth(20);
    this.add.image(0, 0, 'bg-slots').setOrigin(0).setDisplaySize(w, h).setCrop(0, TOP + CELL * 3 + 16, 1080, 1920).setDepth(20);
    const frame = this.add.graphics().setDepth(21);
    frame.lineStyle(10, 0xe9c86a, 1);
    frame.strokeRoundedRect(LEFT - 16, TOP - 16, CELL * 5 + 32, CELL * 3 + 32, 28);
    frame.lineStyle(3, 0xfff4b0, 0.7);
    frame.strokeRoundedRect(LEFT - 8, TOP - 8, CELL * 5 + 16, CELL * 3 + 16, 22);
    this.lines = this.add.graphics().setDepth(22);

    text(this, w / 2, 300, 'LUCKY SEVENS', 76, '900', GOLD, DISPLAY_FONT).setStroke('#14071f', 12).setDepth(23);
    this.refresh = coinBar(this, 'Slots', () => {
      if (!this.spinning) this.scene.start('lobby');
    });

    // win + free spins
    this.winText = text(this, w / 2, 1150, '', 72, '900', GOLD, DISPLAY_FONT).setStroke('#14071f', 12).setDepth(23);
    this.fsText = text(this, w / 2, 1240, '', 40, '800', '#ffffff').setDepth(23);

    // bet
    const panel = this.add.graphics().setDepth(23);
    panel.fillStyle(0x14071f, 0.85);
    panel.fillRoundedRect(w / 2 - 300, 1330, 600, 130, 30);
    panel.lineStyle(3, 0xe9c86a, 0.7);
    panel.strokeRoundedRect(w / 2 - 300, 1330, 600, 130, 30);
    text(this, w / 2, 1365, 'TOTAL BET', 28, '700', THEME.inkSoft).setDepth(24);
    this.betText = text(this, w / 2, 1418, '', 50, '900', '#ffffff').setDepth(24);
    makeButton(this, w / 2 - 380, 1395, '−', () => this.changeBet(-1), { width: 130, height: 120, fontSize: 70, ...SECONDARY, theme: THEME }).setDepth(24);
    makeButton(this, w / 2 + 380, 1395, '+', () => this.changeBet(1), { width: 130, height: 120, fontSize: 70, ...SECONDARY, theme: THEME }).setDepth(24);
    this.updateBet();

    this.spinBtn = makeButton(this, w / 2, 1640, 'SPIN', () => this.spin(), { width: 520, height: 170, fontSize: 80, theme: THEME }).setDepth(24);
    this.autoBtn = makeButton(this, w / 2, 1820, 'Auto ×10', () => this.toggleAuto(), { width: 320, height: 100, fontSize: 38, ...SECONDARY, theme: THEME }).setDepth(24);
    this.exposeTestHooks();
  }

  private symbol(s: Sym, y: number): Phaser.GameObjects.Image {
    return this.add.image(0, y, `sym-${s}`).setDisplaySize(CELL * 0.82, CELL * 0.82);
  }

  private changeBet(d: number): void {
    if (this.spinning || this.freeSpins > 0) return;
    audio.tap();
    this.betIndex = Phaser.Math.Clamp(this.betIndex + d, 0, LINE_BETS.length - 1);
    this.updateBet();
  }

  private updateBet(): void {
    this.betText.setText(fmt(this.totalBet));
  }

  private toggleAuto(): void {
    audio.tap();
    this.autoLeft = this.autoLeft > 0 ? 0 : 10;
    this.setLabel(this.autoBtn, this.autoLeft > 0 ? 'Stop auto' : 'Auto ×10');
    if (this.autoLeft > 0 && !this.spinning) this.spin();
  }

  private setLabel(btn: Phaser.GameObjects.Container, label: string): void {
    (btn.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined)?.setText(label);
  }

  private spin(): void {
    if (this.spinning) return;
    audio.unlock();
    const free = this.freeSpins > 0;
    if (!free) {
      if (!wallet.spend(this.totalBet)) {
        this.autoLeft = 0;
        this.setLabel(this.autoBtn, 'Auto ×10');
        return outOfCoins(this, this.refresh);
      }
      this.refresh();
    } else {
      this.freeSpins--;
    }
    this.spinning = true;
    this.lines.clear();
    this.winText.setText('');
    this.updateFsText();
    haptics.fire('light');
    const stops = spinStops();
    const grid = gridFromStops(stops);
    const result = evaluate(grid, this.lineBet);
    let stopped = 0;
    for (let r = 0; r < 5; r++) {
      const col = this.reels[r]!;
      // strip: final three on top, random filler, then the symbols currently showing
      const filler = 14 + r * 4;
      const current = this.finals[r]!;
      const newImgs = grid[r]!.map((s, row) => this.symbol(s, TOP + CELL * (row + 0.5) - CELL * (filler + 3)));
      const fill: Phaser.GameObjects.Image[] = [];
      for (let k = 0; k < filler; k++) {
        const s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!;
        fill.push(this.symbol(s, TOP + CELL * (2.5 - k) - CELL * 3).setAlpha(0.9));
      }
      col.add([...newImgs, ...fill]);
      this.tweens.add({
        targets: col,
        y: CELL * (filler + 3),
        duration: 700 + r * 260,
        ease: 'Back.easeOut',
        easeParams: [0.6],
        onComplete: () => {
          // normalize: keep only the final three at their resting positions
          current.forEach((im) => im.destroy());
          fill.forEach((im) => im.destroy());
          col.y = 0;
          newImgs.forEach((im, row) => (im.y = TOP + CELL * (row + 0.5)));
          this.finals[r] = newImgs;
          audio.play([{ freq: 160, to: 90, dur: 0.08, wave: 'square', vol: 0.08 }]);
          if (++stopped === 5) this.done(result, free);
        },
      });
    }
  }

  private updateFsText(): void {
    this.fsText.setText(this.freeSpins > 0 || this.freeTotal > 0 ? `FREE SPINS ${this.freeSpins}  ·  wins ×${FREE_SPIN_MULTIPLIER}` : '');
  }

  private done(res: SpinResult, free: boolean): void {
    const mult = free ? FREE_SPIN_MULTIPLIER : 1;
    const win = res.total * mult;
    if (free) this.freeTotal += win;
    if (win > 0) {
      wallet.add(win);
      wallet.recordWin(win);
      this.refresh();
      this.showLines(res);
      this.countUp(win);
      const x = win / this.totalBet;
      if (x >= 50) banner(this, 'MEGA WIN', `+${fmt(win)}`);
      else if (x >= 25) banner(this, 'HUGE WIN', `+${fmt(win)}`);
      else if (x >= 10) banner(this, 'BIG WIN', `+${fmt(win)}`);
      if (x >= 10) {
        audio.win();
        coinShower(this, this.scale.width / 2, 700, win);
        haptics.fire('success');
      } else audio.complete();
    }
    analytics.track('level_complete', { level: 0, moves: 1, seconds: 0, stars: win > 0 ? 1 : 0, undos: 0 });
    let wait = win > 0 ? 1300 : 350;
    if (res.freeSpins > 0) {
      this.freeSpins += res.freeSpins;
      this.time.delayedCall(win > 0 ? 900 : 300, () => {
        banner(this, 'FREE SPINS', `${res.freeSpins} spins · wins ×${FREE_SPIN_MULTIPLIER}`);
        audio.win();
      });
      wait += 1800;
    }
    this.updateFsText();
    this.time.delayedCall(wait, () => {
      this.spinning = false;
      if (this.freeSpins > 0) return this.spin();
      if (this.freeTotal > 0) {
        banner(this, 'Free spins total', `+${fmt(this.freeTotal)}`);
        this.freeTotal = 0;
        this.updateFsText();
        this.time.delayedCall(1800, () => this.continueAuto());
        return;
      }
      this.continueAuto();
    });
  }

  private continueAuto(): void {
    if (this.autoLeft > 0) {
      this.autoLeft--;
      if (this.autoLeft === 0) this.setLabel(this.autoBtn, 'Auto ×10');
      else return this.spin();
    }
  }

  private showLines(res: SpinResult): void {
    this.lines.clear();
    res.lineWins.forEach((lw, k) => {
      const color = LINE_COLORS[k % LINE_COLORS.length]!;
      const pts = LINES[lw.line]!.map((row, reel) => new Phaser.Math.Vector2(LEFT + CELL * (reel + 0.5), TOP + CELL * (row + 0.5)));
      this.lines.lineStyle(10, 0x000000, 0.5);
      this.lines.strokePoints(pts, false);
      this.lines.lineStyle(6, color, 1);
      this.lines.strokePoints(pts, false);
      for (let reel = 0; reel < lw.count; reel++) {
        const img = this.finals[reel]![LINES[lw.line]![reel]!]!;
        this.tweens.add({ targets: img, scale: img.scale * 1.15, duration: 220, yoyo: true, repeat: 2 });
      }
    });
    if (res.scatterWin > 0) {
      this.finals.forEach((col) =>
        col.forEach((img) => {
          if (img.texture.key === 'sym-scatter') this.tweens.add({ targets: img, scale: img.scale * 1.2, duration: 260, yoyo: true, repeat: 3 });
        }),
      );
    }
  }

  private countUp(win: number): void {
    this.tweens.addCounter({
      from: 0,
      to: win,
      duration: Math.min(1400, 300 + win / this.totalBet * 60),
      onUpdate: (tw) => this.winText.setText(`WIN ${fmt(Math.round(tw.getValue() ?? win))}`),
    });
  }

  private exposeTestHooks(): void {
    (globalThis as Record<string, unknown>).__slots = { spinning: () => this.spinning, freeSpins: () => this.freeSpins };
  }
}
