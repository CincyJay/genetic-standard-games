import Phaser from 'phaser';
import { makeButton, popIn } from '@tgs/kit';
import {
  LINES, LINE_BETS, LUCKY_SEVENS, MACHINES, MAX_TOTAL_BET, evaluate, gridFromStops, holdSpinRespin, holdSpinStart, holdSpinTotal, pickBoard, spinBonusWheel,
  spinStops, type Grid, type Lantern, type Machine, type SpinResult,
} from '../logic/slots.ts';
import { showBigWin, tierFor } from '../ui/bigwin.ts';
import { DISPLAY_FONT, GOLD, SECONDARY, THEME, analytics, audio, fmt, haptics, player, wallet } from '../services.ts';
import { paintPrizeWheel } from '../ui/wheel.ts';
import { VW, backdrop, banner, coinBar, coinShower, frame, makeButton as mb, outOfCoins, screenDim, text } from '../ui/common.ts';

const CELL = 186;
const LEFT = (VW - CELL * 5) / 2;
const TOP = 440;
const LINE_COLORS = [0xff4f8b, 0x4fd1ff, 0xffe14a, 0x7dff6a, 0xff9a3c, 0xc77dff, 0xffffff];

export const machineBg = (m: Machine) => (m.id === 'sevens' ? 'bg-floor' : `bg-slots-${m.id}`);
const JACKPOT_COLORS: Record<string, number> = { GRAND: 0xc8102e, MAJOR: 0x6b2fb3, MINOR: 0x1d6aa8, MINI: 0x0f8a5a };
export const symKey = (m: Machine, s: string) => `sym-${m.id}-${s}`;

const FEATURE_TEXT: Record<Machine['feature'], string> = {
  freespins: 'Free spins pay ×3',
  pick: 'Pick-a-sarcophagus bonus',
  expanding: 'Expanding wilds + free spins',
  wheel: 'Prize wheel bonus',
  holdspin: '6+ lanterns start Hold & Spin',
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
  private jackpotBoxes: Phaser.GameObjects.Container | null = null;
  private fx!: Phaser.GameObjects.Container;
  private shade: Phaser.GameObjects.Graphics | null = null;
  /** Dev builds only: the next spin lands on this grid (for screenshots and tests). */
  private rigged: Grid | null = null;
  private lines!: Phaser.GameObjects.Graphics;
  private autoBtn!: Phaser.GameObjects.Image;

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
    // each reel a softly lit drum: brighter in the middle, dark at top and bottom
    for (let r = 0; r < 5; r++) {
      win.fillGradientStyle(0x1a0a24, 0x1a0a24, 0x3a2048, 0x3a2048, 1);
      win.fillRect(LEFT + r * CELL + 3, TOP, CELL - 6, CELL * 1.5);
      win.fillGradientStyle(0x3a2048, 0x3a2048, 0x1a0a24, 0x1a0a24, 1);
      win.fillRect(LEFT + r * CELL + 3, TOP + CELL * 1.5, CELL - 6, CELL * 1.5);
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
    this.cabinet();
    this.lines = this.add.graphics().setDepth(22).setBlendMode(Phaser.BlendModes.ADD);
    this.fx = this.add.container(0, 0).setDepth(22);

    // 3D logo with a slow shine
    const logo = this.add.image(w / 2, 262, `logo-${this.m.id}`).setDisplaySize(900, 162).setDepth(23);
    this.tweens.add({ targets: logo, scale: logo.scale * 1.03, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.jackpotText = text(this, w / 2, 350, '', 36, '800', '#ffffff').setStroke('#14071f', 8).setDepth(23);
    this.jackpotBoxes = null;
    this.refresh = coinBar(this, 'Slots', () => {
      if (!this.spinning) this.scene.start('room', { room: 'slots' });
    });

    this.winText = text(this, w / 2, 1150, '', 72, '900', GOLD, DISPLAY_FONT).setStroke('#14071f', 12).setDepth(23);
    this.fsText = text(this, w / 2, 1240, FEATURE_TEXT[this.m.feature], 36, '700', '#ffffff').setDepth(23);

    // cabinet controls (3D-rendered buttons)
    this.add.image(w / 2, 1380, 'panel-bet').setDisplaySize(560, 149).setDepth(23);
    text(this, w / 2, 1352, 'TOTAL BET', 26, '800', '#cbb6d6').setDepth(24).setLetterSpacing(4);
    this.betText = text(this, w / 2, 1402, '', 50, '900', '#ffe9a8').setDepth(24);
    this.pressButton(w / 2 - 370, 1380, 'btn-minus', 140, 140, () => this.changeBet(-1));
    this.pressButton(w / 2 + 370, 1380, 'btn-plus', 140, 140, () => this.changeBet(1));
    this.updateBet();
    this.updateJackpot();
    const spinBtn = this.pressButton(w / 2, 1640, 'btn-spin', 300, 300, () => this.spin());
    // the spin button breathes so it invites a tap
    const glowRing = this.add.image(w / 2, 1640, 'fx-glow').setDisplaySize(420, 420).setDepth(23).setBlendMode(Phaser.BlendModes.ADD).setTint(0x7dffb0).setAlpha(0.35);
    this.tweens.add({ targets: glowRing, alpha: 0.12, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    void spinBtn;
    this.autoBtn = this.pressButton(190, 1660, 'btn-auto', 270, 101, () => this.toggleAuto());
    (globalThis as Record<string, unknown>).__slots = {
      spinning: () => this.spinning,
      freeSpins: () => this.freeSpins,
      machine: this.m.id,
      // test hooks: open this machine's bonus game directly
      bonus: () => (this.m.feature === 'pick' ? this.pickBonus(() => {}) : this.m.feature === 'wheel' ? this.wheelBonus(() => {}) : null),
      // dev test hook: the next spin lands on this grid (rows of symbol ids, top to bottom)
      rig: (rows: string[][]) => {
        if (import.meta.env.DEV) this.rigged = [0, 1, 2, 3, 4].map((r) => rows.map((row) => row[r]!));
      },
      // test hook: show the big-win celebration for a 60x win
      bigWin: () => {
        if (this.spinning) return;
        this.spinning = true;
        showBigWin(this, this.totalBet * 60, this.totalBet, () => (this.spinning = false));
      },
      // test hook: start Hold & Spin from a board with 6 lanterns
      holdSpin: () => {
        if (!this.m.holdSpin || this.spinning) return;
        this.spinning = true;
        const g: Grid = [0, 1, 2, 3, 4].map((r) => [0, 1, 2].map((row) => (r < 2 || (r === 2 && row < 2) ? 'scatter' : 'ten')));
        this.holdSpin(g, () => (this.spinning = false));
      },
    };
  }

  private symbol(s: string, y: number, blur = false): Phaser.GameObjects.Image {
    const key = blur ? this.blurKey(symKey(this.m, s)) : symKey(this.m, s);
    const img = this.add.image(0, y, key).setDisplaySize(CELL * 0.86, CELL * (blur ? 1.05 : 0.86));
    img.setData('sym', s);
    return img;
  }

  /** A motion-blurred copy of a symbol (stacked, faded copies along the reel direction). */
  private blurKey(key: string): string {
    const bk = `${key}-blur`;
    if (this.textures.exists(bk)) return bk;
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const w = 160;
    const h = 200;
    const tex = this.textures.createCanvas(bk, w, h)!;
    const ctx = tex.getContext();
    const n = 9;
    for (let i = 0; i < n; i++) {
      const dy = (i / (n - 1) - 0.5) * 50;
      ctx.globalAlpha = 0.22;
      ctx.drawImage(src, 0, 20 + dy, w, w);
    }
    tex.refresh();
    return bk;
  }

  /** Reel window frame: polished gold bezel with chasing marquee bulbs. */
  private cabinet(): void {
    const x0 = LEFT - 16;
    const y0 = TOP - 16;
    const fw = CELL * 5 + 32;
    const fh = CELL * 3 + 32;
    const g = this.add.graphics().setDepth(21);
    // outer bezel: dark edge, bright gold body, highlight and inner shadow lines
    g.lineStyle(26, 0x2a1406, 1);
    g.strokeRoundedRect(x0 - 10, y0 - 10, fw + 20, fh + 20, 38);
    g.lineStyle(18, 0xc98a1e, 1);
    g.strokeRoundedRect(x0 - 10, y0 - 10, fw + 20, fh + 20, 38);
    g.lineStyle(6, 0xffe7a0, 1);
    g.strokeRoundedRect(x0 - 14, y0 - 14, fw + 28, fh + 28, 40);
    g.lineStyle(4, 0x7a4a0a, 1);
    g.strokeRoundedRect(x0 - 2, y0 - 2, fw + 4, fh + 4, 30);
    g.lineStyle(3, 0x000000, 0.6);
    g.strokeRoundedRect(x0 + 2, y0 + 2, fw - 4, fh - 4, 26);
    // inner shadow at top of window so the reels look recessed
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.65, 0.65, 0, 0);
    g.fillRect(LEFT, TOP, CELL * 5, 46);
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.65, 0.65);
    g.fillRect(LEFT, TOP + CELL * 3 - 46, CELL * 5, 46);
    // separators between reels
    for (let r = 1; r < 5; r++) {
      g.fillStyle(0x000000, 0.55);
      g.fillRect(LEFT + r * CELL - 3, TOP, 6, CELL * 3);
      g.fillStyle(0xe9c86a, 0.35);
      g.fillRect(LEFT + r * CELL - 1, TOP, 2, CELL * 3);
    }
    // glass glare
    g.fillStyle(0xffffff, 0.05);
    g.fillPoints([new Phaser.Math.Vector2(LEFT, TOP), new Phaser.Math.Vector2(LEFT + 260, TOP), new Phaser.Math.Vector2(LEFT + 60, TOP + CELL * 3), new Phaser.Math.Vector2(LEFT, TOP + CELL * 3)], true);
    // bulbs around the bezel, chasing
    const bulbs: Phaser.GameObjects.Image[] = [];
    const per = (n: number, f: (t: number) => [number, number]) => {
      for (let i = 0; i < n; i++) {
        const [bx, by] = f(i / (n - 1));
        bulbs.push(this.add.image(bx, by, 'fx-spark').setDisplaySize(30, 30).setDepth(21).setBlendMode(Phaser.BlendModes.ADD));
      }
    };
    const L = x0 - 10;
    const R = x0 + fw + 10;
    const T = y0 - 10;
    const B = y0 + fh + 10;
    per(16, (t) => [L + 30 + t * (R - L - 60), T]);
    per(8, (t) => [R, T + 30 + t * (B - T - 60)]);
    per(16, (t) => [R - 30 - t * (R - L - 60), B]);
    per(8, (t) => [L, B - 30 - t * (B - T - 60)]);
    let k = 0;
    this.time.addEvent({
      delay: this.spinning ? 60 : 120,
      loop: true,
      callback: () => {
        k++;
        const fast = this.spinning;
        bulbs.forEach((b, i) => b.setAlpha((i + k) % (fast ? 2 : 4) === 0 ? 1 : 0.25));
      },
    });
  }

  private updateJackpot(): void {
    const hs = this.m.holdSpin;
    if (!hs) {
      this.jackpotText.setText(`JACKPOT ${fmt(player.jackpot)}  ·  five WILDs on a line`);
      return;
    }
    // Hold & Spin machines show their four fixed jackpots, scaled to the bet
    this.jackpotText.setVisible(false);
    this.jackpotBoxes?.destroy();
    const c = this.add.container(0, 0).setDepth(23);
    this.jackpotBoxes = c;
    const values: [string, number][] = [
      ['GRAND', hs.grand],
      ...(['MAJOR', 'MINOR', 'MINI'] as const).map((l): [string, number] => [l, hs.values.find((v) => v.lantern.label === l)!.lantern.mult]),
    ];
    const bw = 236;
    values.forEach(([label, mult], i) => {
      const x = VW / 2 + (i - 1.5) * (bw + 12);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.5);
      g.fillRoundedRect(x - bw / 2, 322, bw, 84, 18);
      g.fillStyle(JACKPOT_COLORS[label]!, 1);
      g.fillRoundedRect(x - bw / 2, 316, bw, 84, 18);
      g.lineStyle(3, 0xffd76a, 1);
      g.strokeRoundedRect(x - bw / 2, 316, bw, 84, 18);
      c.add([g, text(this, x, 338, label, 24, '900', '#ffe9a8').setLetterSpacing(3), text(this, x, 375, fmt(mult * this.totalBet), 34, '900', '#ffffff')]);
    });
  }

  private changeBet(d: number): void {
    if (this.spinning || this.freeSpins > 0) return;
    audio.chip();
    this.betIndex = Phaser.Math.Clamp(this.betIndex + d, 0, LINE_BETS.length - 1);
    this.updateBet();
  }

  private updateBet(): void {
    this.betText.setText(fmt(this.totalBet));
    if (this.m.holdSpin && this.jackpotText) this.updateJackpot();
  }

  private toggleAuto(): void {
    audio.tap();
    this.autoLeft = this.autoLeft > 0 ? 0 : 10;
    this.setAuto(this.autoLeft > 0);
    if (this.autoLeft > 0 && !this.spinning) this.spin();
  }

  /** An image button that presses in when tapped. */
  private pressButton(x: number, y: number, key: string, w: number, h: number, onTap: () => void): Phaser.GameObjects.Image {
    const img = this.add.image(x, y, key).setDisplaySize(w, h).setDepth(24).setInteractive({ useHandCursor: true });
    const sx = img.scaleX;
    const sy = img.scaleY;
    img.on('pointerdown', () => img.setScale(sx * 0.93, sy * 0.93));
    img.on('pointerout', () => img.setScale(sx, sy));
    img.on('pointerup', () => {
      this.tweens.add({ targets: img, scaleX: sx, scaleY: sy, duration: 140, ease: 'Back.easeOut' });
      onTap();
    });
    return img;
  }

  private setAuto(on: boolean): void {
    this.autoBtn.setTexture(on ? 'btn-auto-on' : 'btn-auto');
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
        this.setAuto(false);
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
    const grid = this.rigged ?? gridFromStops(this.m, spinStops(this.m));
    this.rigged = null;
    const result = evaluate(this.m, grid, this.lineBet);
    let stopped = 0;
    this.clearWinFx();
    // anticipation: when the feature is one or two symbols away, the last reels spin longer
    const need = this.m.holdSpin ? this.m.holdSpin.trigger : 3;
    const before = (r: number) => grid.slice(0, r).flat().filter((x) => x === 'scatter').length;
    const tease = (r: number) => r >= 3 && before(r) < need && before(r) >= need - (this.m.holdSpin ? 2 : 1);
    let extra = 0;
    const durations = [0, 1, 2, 3, 4].map((r) => {
      if (tease(r)) extra += 1100;
      return 700 + r * 260 + extra;
    });
    audio.reelSpin(durations[4]! / 1000);
    let landed = 0;
    for (let r = 0; r < 5; r++) {
      const col = this.reels[r]!;
      const filler = 14 + r * 4 + Math.round((durations[r]! - (700 + r * 260)) / 60);
      const current = this.finals[r]!;
      const newImgs = grid[r]!.map((s, row) => this.symbol(s, TOP + CELL * (row + 0.5) - CELL * (filler + 3)));
      const fill: Phaser.GameObjects.Image[] = [];
      for (let k = 0; k < filler; k++) {
        const s = this.m.symbols[Math.floor(Math.random() * this.m.symbols.length)]!;
        fill.push(this.symbol(s, TOP + CELL * (2.5 - k) - CELL * 3, true));
      }
      col.add([...newImgs, ...fill]);
      this.tweens.add({
        targets: col,
        y: CELL * (filler + 3),
        duration: durations[r]!,
        ease: 'Back.easeOut',
        easeParams: [0.6],
        onComplete: () => {
          current.forEach((im) => im.destroy());
          fill.forEach((im) => im.destroy());
          col.y = 0;
          newImgs.forEach((im, row) => (im.y = TOP + CELL * (row + 0.5)));
          this.finals[r] = newImgs;
          audio.reelStop();
          // landing squash
          newImgs.forEach((im) => this.tweens.add({ targets: im, scaleY: { from: im.scaleY * 0.9, to: im.scaleY }, duration: 160, ease: 'Back.easeOut' }));
          // feature symbols ring out as they land
          newImgs.forEach((im) => {
            if (im.getData('sym') !== 'scatter') return;
            landed++;
            audio.scatterLand(landed);
            this.sparkBurst(LEFT + CELL * (r + 0.5), im.y, 10);
            this.tweens.add({ targets: im, scale: im.scale * 1.18, duration: 180, yoyo: true, ease: 'Sine.easeOut' });
          });
          if (r < 4 && tease(r + 1)) this.anticipate(r + 1, durations[r + 1]! - durations[r]!);
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
      this.coinsToBalance(win);
      if (tierFor(win, this.totalBet) < 0) audio.complete();
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
        const total = this.freeTotal;
        this.freeTotal = 0;
        this.updateFsText();
        if (tierFor(total, this.totalBet) >= 0) {
          showBigWin(this, total, this.totalBet, () => this.continueAuto());
          return;
        }
        banner(this, 'Free spins total', `+${fmt(total)}`);
        this.time.delayedCall(1800, () => this.continueAuto());
        return;
      }
      this.continueAuto();
    };
    const next = () => {
      if (res.bonus) {
        player.event('slots_bonus');
        this.autoLeft = 0;
        this.setAuto(false);
        this.time.delayedCall(wait, () =>
          res.bonus === 'pick' ? this.pickBonus(resume) : res.bonus === 'wheel' ? this.wheelBonus(resume) : this.holdSpin(res.grid, resume),
        );
        return;
      }
      this.time.delayedCall(wait, resume);
    };
    // big wins get the full-screen celebration before anything else happens
    if (!free && tierFor(win, this.totalBet) >= 0) this.time.delayedCall(500, () => showBigWin(this, win, this.totalBet, next));
    else next();
  }

  private continueAuto(): void {
    if (this.autoLeft > 0) {
      this.autoLeft--;
      if (this.autoLeft === 0) this.setAuto(false);
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
                close();
                if (tierFor(total, bet) >= 0) showBigWin(this, total, bet, resume);
                else {
                  audio.win();
                  coinShower(this, VW / 2, 900, total);
                  resume();
                }
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
            if (tierFor(win, bet) >= 0) showBigWin(this, win, bet, resume);
            else resume();
          });
        },
      });
    }, { width: 460, height: 130, fontSize: 52, theme: THEME });
    panel.add(btn);
  }

  /**
   * Hold & Spin: the lanterns that triggered it lock in place with their values;
   * everything else respins. Three respins, and every new lantern resets them to
   * three. Fill all 15 cells for the Grand jackpot.
   */
  private holdSpin(grid: Grid, resume: () => void): void {
    const m = this.m;
    const hs = m.holdSpin!;
    const bet = this.totalBet;
    const board = holdSpinStart(m, grid);
    this.autoLeft = 0;
    this.setAuto(false);
    this.lines.clear();
    banner(this, 'HOLD & SPIN', `${board.filter(Boolean).length} lanterns locked`);
    audio.win();
    haptics.fire('success');
    const layer = this.add.container(0, 0).setDepth(20.5);
    const cellPos = (i: number) => ({ x: LEFT + CELL * (Math.floor(i / 3) + 0.5), y: TOP + CELL * ((i % 3) + 0.5) });
    const bgs: Phaser.GameObjects.Rectangle[] = [];
    const lit: Phaser.GameObjects.Container[] = [];
    for (let i = 0; i < 15; i++) {
      const { x, y } = cellPos(i);
      const r = this.add.rectangle(x, y, CELL - 10, CELL - 10, 0x2a0408, 0.97).setStrokeStyle(2, 0xe9b949, 0.35);
      r.setAlpha(0);
      this.tweens.add({ targets: r, alpha: 1, duration: 300, delay: 200 + i * 25 });
      bgs.push(r);
      layer.add(r);
    }
    const light = (i: number, l: Lantern, pop: boolean) => {
      const { x, y } = cellPos(i);
      const c = this.add.container(x, y);
      const img = this.add.image(0, -8, symKey(m, 'scatter')).setDisplaySize(CELL * 0.86, CELL * 0.86);
      const label = l.label ?? fmt(Math.round(l.mult * bet));
      const t = text(this, 0, 8, label, l.label ? 30 : 36, '900', l.label ? '#ffe14a' : '#ffffff').setStroke('#3a0000', 9);
      c.add([img, t]);
      layer.add(c);
      lit[i] = c;
      bgs[i]!.setStrokeStyle(4, 0xffd76a, 1);
      if (pop) {
        c.setScale(0);
        this.tweens.add({ targets: c, scale: 1, duration: 360, ease: 'Back.easeOut' });
      }
    };
    board.forEach((l, i) => l && this.time.delayedCall(500 + i * 30, () => light(i, l, true)));
    const running = () => board.reduce((s, l) => s + (l?.mult ?? 0), 0) * bet;
    let left = hs.respins;
    const status = () => this.fsText.setText(`RESPINS ${'●'.repeat(left)}${'○'.repeat(hs.respins - left)}`);
    status();
    this.winText.setText(`${fmt(Math.round(running()))}`);
    const step = () => {
      if (left === 0 || board.every((c) => c)) return tally();
      left--;
      status();
      audio.reelSpin(0.6);
      // empty cells shimmer while they "spin"
      board.forEach((c, i) => {
        if (!c) this.tweens.add({ targets: bgs[i], fillAlpha: 0.6, duration: 90, yoyo: true, repeat: 3 });
      });
      this.time.delayedCall(800, () => {
        const landed = holdSpinRespin(m, board);
        landed.forEach((i, k) =>
          this.time.delayedCall(k * 220, () => {
            light(i, board[i]!, true);
            audio.chips(3);
            audio.complete();
            haptics.fire('medium');
            this.winText.setText(fmt(Math.round(running())));
          }),
        );
        if (landed.length) left = hs.respins;
        else audio.reelStop();
        this.time.delayedCall(500 + landed.length * 220, () => {
          status();
          step();
        });
      });
    };
    this.time.delayedCall(1700, step);
    const tally = () => {
      const { mult, grand } = holdSpinTotal(m, board);
      const order = board.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
      let sum = 0;
      this.fsText.setText('Collecting lanterns');
      order.forEach((i, k) =>
        this.time.delayedCall(k * 160, () => {
          sum += board[i]!.mult * bet;
          this.winText.setText(fmt(Math.round(sum)));
          this.tweens.add({ targets: lit[i], scale: 1.18, duration: 120, yoyo: true });
          audio.coins(2);
        }),
      );
      const win = Math.round(mult * bet);
      this.time.delayedCall(order.length * 160 + 500, () => {
        const pay = () => {
          wallet.add(win);
          wallet.recordWin(win);
          player.event('coins_won', win);
          this.refresh();
          this.winText.setText(`WIN ${fmt(win)}`);
          const close = () => {
            this.tweens.add({ targets: layer, alpha: 0, duration: 300, onComplete: () => layer.destroy() });
            this.updateFsText();
            resume();
          };
          if (tierFor(win, bet) >= 0) showBigWin(this, win, bet, close);
          else {
            banner(this, 'HOLD & SPIN', `+${fmt(win)}`);
            audio.win();
            this.time.delayedCall(1800, close);
          }
        };
        if (grand) {
          banner(this, 'GRAND JACKPOT!', `+${fmt(hs.grand * bet)}`, '#ff5a5a');
          audio.win();
          this.cameras.main.shake(500, 0.01);
          this.time.delayedCall(2200, pay);
        } else pay();
      });
    };
  }

  // ---------------------------------------------------------------- win display
  /** A glowing frame and rising tone on a reel that might complete the feature. */
  private anticipate(reel: number, ms: number): void {
    const x = LEFT + CELL * (reel + 0.5);
    const glow = this.add.rectangle(x, TOP + CELL * 1.5, CELL - 6, CELL * 3, 0xffc040, 0).setStrokeStyle(8, 0xffd76a, 1).setDepth(22);
    const halo = this.add.image(x, TOP + CELL * 1.5, 'fx-glow').setDisplaySize(CELL * 2, CELL * 4).setDepth(19).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.tweens.add({ targets: halo, alpha: 0.9, duration: 300 });
    this.tweens.add({ targets: glow, alpha: { from: 1, to: 0.4 }, duration: 160, yoyo: true, repeat: -1 });
    const sparks = this.add.particles(0, 0, 'fx-spark', {
      x: { min: x - CELL / 2, max: x + CELL / 2 },
      y: { min: TOP, max: TOP + CELL * 3 },
      speedY: { min: -160, max: -60 },
      lifespan: 700,
      scale: { start: 0.6, end: 0 },
      frequency: 30,
      blendMode: 'ADD',
    }).setDepth(22);
    audio.tension(ms / 1000);
    this.time.delayedCall(ms, () => {
      [glow, halo].forEach((o) => this.tweens.killTweensOf(o));
      glow.destroy();
      halo.destroy();
      sparks.stop();
      this.time.delayedCall(800, () => sparks.destroy());
    });
  }

  private sparkBurst(x: number, y: number, n: number): void {
    const e = this.add.particles(x, y, 'fx-spark', {
      speed: { min: 120, max: 420 },
      lifespan: { min: 400, max: 800 },
      scale: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 360 },
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(23);
    e.explode(n);
    this.time.delayedCall(900, () => e.destroy());
  }

  private clearWinFx(): void {
    this.lines.clear();
    this.fx.each((o: Phaser.GameObjects.GameObject) => this.tweens.killTweensOf(o));
    this.fx.removeAll(true);
    this.shade?.destroy();
    this.shade = null;
    this.finals.flat().forEach((im) => im.setAlpha(1));
  }

  /** Win presentation: dim the losers, light up the winners, glowing paylines, sparkles. */
  private showLines(res: SpinResult): void {
    this.clearWinFx();
    const winners = new Set<Phaser.GameObjects.Image>();
    res.lineWins.forEach((lw) => {
      for (let reel = 0; reel < lw.count; reel++) winners.add(this.finals[reel]![LINES[lw.line]![reel]!]!);
    });
    if (res.scatterWin > 0) this.finals.flat().forEach((im) => im.getData('sym') === 'scatter' && winners.add(im));
    this.finals.flat().forEach((im) => !winners.has(im) && im.setAlpha(0.35));
    res.lineWins.forEach((lw, k) => {
      const color = LINE_COLORS[k % LINE_COLORS.length]!;
      const pts = LINES[lw.line]!.map((row, reel) => new Phaser.Math.Vector2(LEFT + CELL * (reel + 0.5), TOP + CELL * (row + 0.5)));
      this.lines.lineStyle(22, color, 0.18);
      this.lines.strokePoints(pts, false);
      this.lines.lineStyle(10, color, 0.45);
      this.lines.strokePoints(pts, false);
      this.lines.lineStyle(4, 0xffffff, 0.9);
      this.lines.strokePoints(pts, false);
    });
    let i = 0;
    winners.forEach((img) => {
      const x = (img.parentContainer?.x ?? 0) + img.x;
      const y = img.y;
      const halo = this.add.image(x, y, 'fx-glow').setDisplaySize(CELL * 1.35, CELL * 1.35).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.fx.add(halo);
      this.tweens.add({ targets: halo, alpha: { from: 0.95, to: 0.4 }, duration: 420, yoyo: true, repeat: -1, delay: i * 40 });
      this.tweens.add({ targets: img, scale: img.scale * 1.12, duration: 260, yoyo: true, repeat: 3, delay: i * 40, ease: 'Sine.easeInOut' });
      this.time.delayedCall(i * 40, () => this.sparkBurst(x, y, 8));
      i++;
    });
    // lines fade a little after a while so the board is readable again
    this.time.delayedCall(2600, () => {
      if (!this.spinning) this.tweens.add({ targets: this.lines, alpha: { from: 1, to: 0.35 }, duration: 400 });
    });
    this.lines.setAlpha(1);
  }

  /** Coins fly from the win amount up to the balance. */
  private coinsToBalance(win: number): void {
    const n = Math.min(24, 6 + Math.floor(Math.log10(Math.max(10, win)) * 3));
    const view = this.cameras.main;
    const tx = view.scrollX + this.scale.width - 210;
    const ty = view.scrollY + 100;
    for (let k = 0; k < n; k++) {
      const c = this.add.image(VW / 2 + Phaser.Math.Between(-120, 120), 1150 + Phaser.Math.Between(-30, 30), 'coin').setDisplaySize(60, 60).setDepth(60);
      this.tweens.add({
        targets: c,
        x: tx,
        y: ty,
        scale: c.scale * 0.6,
        duration: 650 + k * 25,
        delay: k * 40,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          c.destroy();
          if (k % 3 === 0) audio.coins(1);
        },
      });
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
