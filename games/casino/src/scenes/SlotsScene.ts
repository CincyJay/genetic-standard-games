import Phaser from 'phaser';
import { makeButton, popIn } from '@tgs/kit';
import {
  LINES, LINE_BETS, LUCKY_SEVENS, MACHINES, MAX_TOTAL_BET, evaluate, gridFromStops, pickBoard, spinBonusWheel, spinStops, type Machine, type SpinResult,
} from '../logic/slots.ts';
import { DISPLAY_FONT, GOLD, SECONDARY, THEME, analytics, audio, fmt, haptics, player, wallet } from '../services.ts';
import { paintPrizeWheel } from '../ui/wheel.ts';
import { VW, backdrop, banner, coinBar, coinShower, frame, makeButton as mb, outOfCoins, screenDim, text } from '../ui/common.ts';

const CELL = 186;
const LEFT = (VW - CELL * 5) / 2;
const TOP = 440;
const LINE_COLORS = [0xff4f8b, 0x4fd1ff, 0xffe14a, 0x7dff6a, 0xff9a3c, 0xc77dff, 0xffffff];

export const machineBg = (m: Machine) => (m.id === 'sevens' ? 'bg-slots' : `bg-slots-${m.id}`);
export const symKey = (m: Machine, s: string) => `sym-${m.id}-${s}`;

const FEATURE_TEXT: Record<Machine['feature'], string> = {
  freespins: 'Free spins pay ×3',
  pick: 'Pick-a-sarcophagus bonus',
  expanding: 'Expanding wilds + free spins',
  wheel: 'Prize wheel bonus',
};
export { FEATURE_TEXT };

export class SlotsScene extends Phaser.Scene {
  private m: Machine = LUCKY_SEVENS;
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
  private jackpotText!: Phaser.GameObjects.Text;
  private lines!: Phaser.GameObjects.Graphics;
  private autoBtn!: Phaser.GameObjects.Container;

  constructor() {
    super('slots');
  }

  init(data: { machine?: string }): void {
    this.m = MACHINES.find((x) => x.id === data.machine) ?? LUCKY_SEVENS;
  }

  private get lineBet(): number {
    return LINE_BETS[this.betIndex]!;
  }
  private get totalBet(): number {
    return this.lineBet * LINES.length;
  }

  create(): void {
    const w = VW;
    frame(this);
    backdrop(this, machineBg(this.m));
    this.reels = [];
    this.finals = [];
    this.spinning = false;
    this.freeSpins = 0;
    this.freeTotal = 0;
    this.autoLeft = 0;

    const win = this.add.graphics();
    win.fillStyle(0x0d0414, 0.92);
    win.fillRoundedRect(LEFT - 16, TOP - 16, CELL * 5 + 32, CELL * 3 + 32, 28);
    for (let r = 0; r < 5; r++) {
      win.fillStyle(0xffffff, r % 2 ? 0.03 : 0.06);
      win.fillRect(LEFT + r * CELL, TOP, CELL, CELL * 3);
    }
    const start = gridFromStops(this.m, spinStops(this.m));
    for (let r = 0; r < 5; r++) {
      const col = this.add.container(LEFT + CELL * (r + 0.5), 0);
      const imgs = start[r]!.map((s, row) => this.symbol(s, TOP + CELL * (row + 0.5)));
      col.add(imgs);
      this.reels.push(col);
      this.finals.push(imgs);
    }
    backdrop(this, machineBg(this.m), { y0: -10000, y1: TOP - 16 }).setDepth(20);
    backdrop(this, machineBg(this.m), { y0: TOP + CELL * 3 + 16, y1: 10000 }).setDepth(20);
    const border = this.add.graphics().setDepth(21);
    border.lineStyle(10, 0xe9c86a, 1);
    border.strokeRoundedRect(LEFT - 16, TOP - 16, CELL * 5 + 32, CELL * 3 + 32, 28);
    border.lineStyle(3, 0xfff4b0, 0.7);
    border.strokeRoundedRect(LEFT - 8, TOP - 8, CELL * 5 + 16, CELL * 3 + 16, 22);
    this.lines = this.add.graphics().setDepth(22);

    text(this, w / 2, 270, this.m.name.toUpperCase(), 66, '900', GOLD, DISPLAY_FONT).setStroke('#14071f', 12).setDepth(23);
    this.jackpotText = text(this, w / 2, 350, '', 36, '800', '#ffffff').setStroke('#14071f', 8).setDepth(23);
    this.updateJackpot();
    this.refresh = coinBar(this, 'Slots', () => {
      if (!this.spinning) this.scene.start('slotlobby');
    });

    this.winText = text(this, w / 2, 1150, '', 72, '900', GOLD, DISPLAY_FONT).setStroke('#14071f', 12).setDepth(23);
    this.fsText = text(this, w / 2, 1240, FEATURE_TEXT[this.m.feature], 36, '700', '#ffffff').setDepth(23);

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
    makeButton(this, w / 2, 1640, 'SPIN', () => this.spin(), { width: 520, height: 170, fontSize: 80, theme: THEME }).setDepth(24);
    this.autoBtn = makeButton(this, w / 2, 1820, 'Auto ×10', () => this.toggleAuto(), { width: 320, height: 100, fontSize: 38, ...SECONDARY, theme: THEME }).setDepth(24);
    (globalThis as Record<string, unknown>).__slots = {
      spinning: () => this.spinning,
      freeSpins: () => this.freeSpins,
      machine: this.m.id,
      // test hooks: open this machine's bonus game directly
      bonus: () => (this.m.feature === 'pick' ? this.pickBonus(() => {}) : this.m.feature === 'wheel' ? this.wheelBonus(() => {}) : null),
    };
  }

  private symbol(s: string, y: number): Phaser.GameObjects.Image {
    return this.add.image(0, y, symKey(this.m, s)).setDisplaySize(CELL * 0.82, CELL * 0.82);
  }

  private updateJackpot(): void {
    this.jackpotText.setText(`JACKPOT ${fmt(player.jackpot)}  ·  five WILDs on a line`);
  }

  private changeBet(d: number): void {
    if (this.spinning || this.freeSpins > 0) return;
    audio.chip();
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
      player.wager(this.totalBet, true);
      player.event('slots_spin');
      this.refresh();
      this.updateJackpot();
    } else this.freeSpins--;
    this.spinning = true;
    this.lines.clear();
    this.winText.setText('');
    this.updateFsText();
    haptics.fire('light');
    const grid = gridFromStops(this.m, spinStops(this.m));
    const result = evaluate(this.m, grid, this.lineBet);
    let stopped = 0;
    audio.reelSpin(0.7 + 4 * 0.26);
    for (let r = 0; r < 5; r++) {
      const col = this.reels[r]!;
      const filler = 14 + r * 4;
      const current = this.finals[r]!;
      const newImgs = grid[r]!.map((s, row) => this.symbol(s, TOP + CELL * (row + 0.5) - CELL * (filler + 3)));
      const fill: Phaser.GameObjects.Image[] = [];
      for (let k = 0; k < filler; k++) {
        const s = this.m.symbols[Math.floor(Math.random() * this.m.symbols.length)]!;
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
          current.forEach((im) => im.destroy());
          fill.forEach((im) => im.destroy());
          col.y = 0;
          newImgs.forEach((im, row) => (im.y = TOP + CELL * (row + 0.5)));
          this.finals[r] = newImgs;
          audio.reelStop();
          if (++stopped === 5) this.expandThen(result, () => this.done(result, free));
        },
      });
    }
  }

  /** Deep Blue: wilds on reels 2-4 grow to fill the reel before lines are paid. */
  private expandThen(res: SpinResult, next: () => void): void {
    if (!res.expanded.length) return next();
    res.expanded.forEach((reel, k) => {
      this.time.delayedCall(k * 260, () => {
        const glow = this.add.rectangle(LEFT + CELL * (reel + 0.5), TOP + CELL * 1.5, CELL - 8, CELL * 3 - 8, 0x4fd1ff, 0.35).setDepth(22);
        this.tweens.add({ targets: glow, alpha: 0, duration: 700, onComplete: () => glow.destroy() });
        this.finals[reel]!.forEach((img) => {
          img.setTexture(symKey(this.m, 'wild')).setDisplaySize(CELL * 0.82, CELL * 0.82);
          this.tweens.add({ targets: img, scale: { from: img.scale * 0.6, to: img.scale }, duration: 280, ease: 'Back.easeOut' });
        });
        audio.complete();
      });
    });
    this.time.delayedCall(res.expanded.length * 260 + 400, next);
  }

  private updateFsText(): void {
    this.fsText.setText(
      this.freeSpins > 0 || this.freeTotal > 0
        ? `FREE SPINS ${this.freeSpins}${(this.m.freeSpinMultiplier ?? 1) > 1 ? `  ·  wins ×${this.m.freeSpinMultiplier}` : ''}`
        : FEATURE_TEXT[this.m.feature],
    );
  }

  private done(res: SpinResult, free: boolean): void {
    const mult = free ? (this.m.freeSpinMultiplier ?? 1) : 1;
    let win = res.total * mult;
    if (res.jackpot && !free) {
      const jp = player.winJackpot(this.totalBet / MAX_TOTAL_BET);
      this.time.delayedCall(400, () => {
        banner(this, 'JACKPOT!', `+${fmt(jp)}`);
        audio.win();
        coinShower(this, VW / 2, 700, jp);
        wallet.recordWin(jp);
        this.refresh();
        this.updateJackpot();
      });
    }
    if (free) this.freeTotal += win;
    if (win > 0) {
      wallet.add(win);
      wallet.recordWin(win);
      player.event('coins_won', win);
      this.refresh();
      this.showLines(res);
      this.countUp(win);
      const x = win / this.totalBet;
      if (x >= 50) banner(this, 'MEGA WIN', `+${fmt(win)}`);
      else if (x >= 25) banner(this, 'HUGE WIN', `+${fmt(win)}`);
      else if (x >= 10) banner(this, 'BIG WIN', `+${fmt(win)}`);
      if (x >= 10) {
        audio.win();
        coinShower(this, VW / 2, 700, win);
        haptics.fire('success');
      } else audio.complete();
    }
    analytics.track('level_complete', { level: 0, moves: 1, seconds: 0, stars: win > 0 ? 1 : 0, undos: 0 });
    let wait = win > 0 ? 1300 : 350;
    if (res.freeSpins > 0) {
      this.freeSpins += res.freeSpins;
      player.event('slots_bonus');
      this.time.delayedCall(win > 0 ? 900 : 300, () => {
        const mult2 = this.m.freeSpinMultiplier ?? 1;
        banner(this, 'FREE SPINS', `${res.freeSpins} spins${mult2 > 1 ? ` · wins ×${mult2}` : ''}`);
        audio.win();
      });
      wait += 1800;
    }
    this.updateFsText();
    const resume = () => {
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
    };
    if (res.bonus) {
      player.event('slots_bonus');
      this.autoLeft = 0;
      this.setLabel(this.autoBtn, 'Auto ×10');
      this.time.delayedCall(wait, () => (res.bonus === 'pick' ? this.pickBonus(resume) : this.wheelBonus(resume)));
      return;
    }
    this.time.delayedCall(wait, resume);
  }

  private continueAuto(): void {
    if (this.autoLeft > 0) {
      this.autoLeft--;
      if (this.autoLeft === 0) this.setLabel(this.autoBtn, 'Auto ×10');
      else return this.spin();
    }
  }

  // ---------------------------------------------------------------- bonus games
  private bonusPanel(title: string, sub: string): { panel: Phaser.GameObjects.Container; close: () => void } {
    const dim = screenDim(this, 0.75, 200);
    const panel = this.add.container(VW / 2, 960).setDepth(201);
    const g = this.add.graphics();
    g.fillStyle(0x140a1a, 0.96);
    g.fillRoundedRect(-490, -720, 980, 1440, 40);
    g.lineStyle(4, 0xe9c86a, 0.9);
    g.strokeRoundedRect(-490, -720, 980, 1440, 40);
    panel.add([g, text(this, 0, -630, title, 72, '900', GOLD, DISPLAY_FONT), text(this, 0, -555, sub, 34, '600', '#cbb6d6')]);
    popIn(this, panel);
    return { panel, close: () => (dim.destroy(), panel.destroy()) };
  }

  /** Pharaoh's Gold: open 3 of 9 sarcophagi; each hides a multiple of the total bet. */
  private pickBonus(resume: () => void): void {
    const tiles = pickBoard(this.m);
    const bet = this.totalBet;
    const { panel, close } = this.bonusPanel('BONUS', `Pick 3 sarcophagi · prizes × your bet (${fmt(bet)})`);
    banner(this, 'BONUS GAME', 'Pick 3!');
    audio.win();
    let picks = 0;
    let total = 0;
    const totalText = text(this, 0, 470, 'Total 0', 56, '900', '#ffffff');
    panel.add(totalText);
    const covers: Phaser.GameObjects.Image[] = [];
    tiles.forEach((mult, i) => {
      const x = ((i % 3) - 1) * 290;
      const y = -330 + Math.floor(i / 3) * 280;
      const cover = this.add.image(x, y, symKey(this.m, 'scatter')).setDisplaySize(220, 220).setInteractive({ useHandCursor: true });
      covers.push(cover);
      panel.add(cover);
      cover.on('pointerup', () => {
        if (picks >= 3 || !cover.input?.enabled) return;
        cover.disableInteractive();
        picks++;
        const prize = mult * bet;
        total += prize;
        audio.chips(4);
        haptics.fire('medium');
        this.tweens.add({ targets: cover, scaleX: 0, duration: 140, yoyo: true });
        const t = text(this, x, y, `×${mult}`, 70, '900', mult >= 15 ? '#ffd23f' : '#ffffff').setStroke('#3a1a00', 10);
        panel.add(t);
        popIn(this, t);
        totalText.setText(`Total ${fmt(total)}`);
        if (picks === 3) {
          // show what was left
          this.time.delayedCall(500, () => {
            tiles.forEach((m2, j) => {
              if (!covers[j]!.input?.enabled) return;
              covers[j]!.setAlpha(0.3);
              panel.add(text(this, ((j % 3) - 1) * 290, -330 + Math.floor(j / 3) * 280, `×${m2}`, 54, '800', '#8a7a90'));
            });
            panel.add(
              mb(this, 0, 610, `Collect ${fmt(total)}`, () => {
                wallet.add(total);
                wallet.recordWin(total);
                player.event('coins_won', total);
                this.refresh();
                audio.win();
                coinShower(this, VW / 2, 900, total);
                close();
                resume();
              }, { width: 560, height: 130, fontSize: 48, theme: THEME }),
            );
          });
        }
      });
    });
  }

  /** Gold Rush: spin a prize wheel of bet multipliers. */
  private wheelBonus(resume: () => void): void {
    const wh = this.m.wheel!;
    const bet = this.totalBet;
    const { panel, close } = this.bonusPanel('BONUS WHEEL', `Spin for up to ×${Math.max(...wh.prizes)} your bet`);
    banner(this, 'BONUS WHEEL', 'Spin it!');
    audio.win();
    const R = 380;
    const n = wh.prizes.length;
    const key = paintPrizeWheel(this, 'tex-bonus-wheel', wh.prizes.map((p) => `×${p}`), [0x7a3e18, 0xa4700f, 0x5a2e12, 0xc98a10], R, { font: 52 });
    const wheel = this.add.container(0, -40, [this.add.image(0, 0, key)]);
    const ptr = this.add.graphics();
    ptr.fillStyle(0xffffff, 1);
    ptr.fillTriangle(-34, -40 - R - 64, 34, -40 - R - 64, 0, -40 - R + 6);
    panel.add([wheel, ptr]);
    let spun = false;
    const btn = mb(this, 0, 560, 'Spin', () => {
      if (spun) return;
      spun = true;
      const idx = spinBonusWheel(this.m);
      const win = wh.prizes[idx]! * bet;
      let last = 0;
      this.tweens.add({
        targets: wheel,
        angle: 360 * 6 - idx * (360 / n),
        duration: 4200,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          const k = Math.floor(wheel.angle / (360 / n));
          if (k !== last) {
            last = k;
            audio.tap();
          }
        },
        onComplete: () => {
          wallet.add(win);
          wallet.recordWin(win);
          player.event('coins_won', win);
          this.refresh();
          audio.win();
          coinShower(this, VW / 2, 900, win);
          banner(this, `×${wh.prizes[idx]}`, `+${fmt(win)}`);
          (btn.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text).setText('Collect');
          btn.once('pointerup', () => {
            close();
            resume();
          });
        },
      });
    }, { width: 460, height: 130, fontSize: 52, theme: THEME });
    panel.add(btn);
  }

  // ---------------------------------------------------------------- win display
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
          if (img.texture.key === symKey(this.m, 'scatter')) this.tweens.add({ targets: img, scale: img.scale * 1.2, duration: 260, yoyo: true, repeat: 3 });
        }),
      );
    }
  }

  private countUp(win: number): void {
    this.tweens.addCounter({
      from: 0,
      to: win,
      duration: Math.min(1400, 300 + (win / this.totalBet) * 60),
      onUpdate: (tw) => this.winText.setText(`WIN ${fmt(Math.round(tw.getValue() ?? win))}`),
    });
  }
}
