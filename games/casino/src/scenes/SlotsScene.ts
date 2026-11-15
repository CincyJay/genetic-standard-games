import Phaser from 'phaser';
import { popIn } from '@tgs/kit';
import {
  LUCKY_WHEEL, LUCKY_WHEEL_CHANCE, rollWildReels, spinLuckyWheel,
  LINES, ROWS, LINE_CHOICES, lineBetsOf, freeSpinMult, LUCKY_SEVENS, MACHINES, MAX_TOTAL_BET, evaluate, gridFromStops, holdSpinRespin, holdSpinStart, holdSpinTotal, pickBoard, spinBonusWheel,
  spinStops, type Grid, type Lantern, type Machine, type SpinResult,
} from '../logic/slots.ts';
import { showBigWin, tierFor } from '../ui/bigwin.ts';
import { RANKS, SUITS, cardId, secureRandom, type Card } from '../logic/cards.ts';
import { DISPLAY_FONT, GOLD, SECONDARY, THEME, analytics, audio, fmt, haptics, player, wallet } from '../services.ts';
import { paintPrizeWheel } from '../ui/wheel.ts';
import { VW, backdrop, banner, coinBar, coinShower, frame, makeButton, makeButton as mb, outOfCoins, screenDim, text } from '../ui/common.ts';

const CELL = 160;
const LEFT = (VW - CELL * 5) / 2;
const TOP = 776;
const WIN_Y = 1636;
const CONSOLE_Y = 1736;
const ROW2_Y = 1846;
const SPIN_X = 898;
/** The cabinet's outline (the machine fills the screen like a real one). */
const CAB = { x0: 34, x1: VW - 34, y0: 214, y1: 1902 };
const LINE_COLORS = [0xff4f8b, 0x4fd1ff, 0xffe14a, 0x7dff6a, 0xff9a3c, 0xc77dff, 0xffffff];

export const machineBg = (m: Machine) => (m.id === 'sevens' ? 'bg-floor' : `bg-machine-${m.id}`);

/** Each machine's cabinet: bezel metal, bulb colour, reel tint and spin button. */
interface CabinetTheme {
  edge: number;
  body: number;
  shine: number;
  inner: number;
  bulb: number;
  reelDark: number;
  reelLight: number;
  spin: string;
  spinGlow: number;
  /** Neon trim around the cabinet and the SPIN button colour. */
  neon: number;
  /** The bright (undimmed) world art shown in the cabinet's top box. */
  art: string;
}
const THEMES: Record<string, CabinetTheme> = {
  sevens: { edge: 0x2a1406, body: 0xc98a1e, shine: 0xffe7a0, inner: 0x7a4a0a, bulb: 0xffe08a, reelDark: 0x1a0a24, reelLight: 0x3a2048, spin: 'btn-spin', spinGlow: 0x7dffb0, neon: 0xb04cff, art: 'room-slots' },
  lanterns: { edge: 0x3a0006, body: 0xb8101e, shine: 0xffd76a, inner: 0xe9b949, bulb: 0xffb040, reelDark: 0x22040a, reelLight: 0x4a0c14, spin: 'btn-spin-lanterns', spinGlow: 0xff7a5a, neon: 0xff2a3a, art: 'world-lanterns' },
  pharaoh: { edge: 0x0a1440, body: 0x1d3aa8, shine: 0xffe08a, inner: 0xe9b949, bulb: 0xffd890, reelDark: 0x14100a, reelLight: 0x30261a, spin: 'btn-spin-pharaoh', spinGlow: 0x7aa8ff, neon: 0xffb020, art: 'world-pharaoh' },
  ocean: { edge: 0x062a3a, body: 0x1a8aa8, shine: 0xbff4ff, inner: 0x7fe0ff, bulb: 0x7fe0ff, reelDark: 0x041828, reelLight: 0x0a3050, spin: 'btn-spin-ocean', spinGlow: 0x7fe0ff, neon: 0x2a9dff, art: 'world-ocean' },
  goldrush: { edge: 0x2a1006, body: 0x8a4a1a, shine: 0xffc070, inner: 0x5a2a0a, bulb: 0xffb050, reelDark: 0x140a04, reelLight: 0x2c1c0c, spin: 'btn-spin-goldrush', spinGlow: 0xffb050, neon: 0xffa020, art: 'world-goldrush' },
};
/** Lucky Wheel wedges that are named jackpots (multiples of the total bet). */
export const WHEEL_JACKPOTS = { MINI: 50, MINOR: 100, MAJOR: 250 } as const;
const LADDER_Y = 488;
/** The Grand never shows less than this many times the total bet. */
const GRAND_MIN = 1000;
Object.assign(THEMES, {
  dragon: { edge: 0x2a0004, body: 0x9a0a14, shine: 0xffd76a, inner: 0xe9b949, bulb: 0xff8a3a, reelDark: 0x1a0204, reelLight: 0x3e0a0c, spin: '', spinGlow: 0xff5a3a, neon: 0xff3a1a, art: 'world-dragon' },
  empire: { edge: 0x10102a, body: 0xc8ccd8, shine: 0xffffff, inner: 0xbfe8ff, bulb: 0xdff4ff, reelDark: 0x0c0a1e, reelLight: 0x2a2048, spin: '', spinGlow: 0xbfe8ff, neon: 0xc070ff, art: 'world-empire' },
  thunder: { edge: 0x060a1a, body: 0x3a5a9a, shine: 0xcfe8ff, inner: 0x8ab8ff, bulb: 0xcfe8ff, reelDark: 0x060a18, reelLight: 0x1a2440, spin: '', spinGlow: 0x8ad8ff, neon: 0x3ab0ff, art: 'world-thunder' },
  tiger: { edge: 0x1a0a02, body: 0xc8701a, shine: 0xffd08a, inner: 0x18a868, bulb: 0xffc060, reelDark: 0x0a1406, reelLight: 0x1e3010, spin: '', spinGlow: 0xffb040, neon: 0xff9a1a, art: 'world-tiger' },
  cosmic: { edge: 0x0a0418, body: 0x5a2ad8, shine: 0xff9aff, inner: 0x2ad8ff, bulb: 0xff6ad8, reelDark: 0x06021a, reelLight: 0x1e0c40, spin: '', spinGlow: 0xff40c0, neon: 0xff40d0, art: 'world-cosmic' },
});
const JACKPOT_COLORS: Record<string, number> = { GRAND: 0xc8102e, MAJOR: 0x6b2fb3, MINOR: 0x1d6aa8, MINI: 0x0f8a5a };
/**
 * Strokes a payline segment by segment (Phaser's strokePoints drops straight
 * runs of collinear points), with round joints.
 */
function strokePath(g: Phaser.GameObjects.Graphics, pts: Phaser.Math.Vector2[]): void {
  for (let i = 1; i < pts.length; i++) g.lineBetween(pts[i - 1]!.x, pts[i - 1]!.y, pts[i]!.x, pts[i]!.y);
}
export const symKey = (m: Machine, s: string) => `sym-${m.id}-${s}`;

const FEATURE_TEXT: Record<Machine['feature'], string> = {
  freespins: 'Free spins pay ×3',
  pick: 'Pick-a-sarcophagus bonus',
  expanding: 'Expanding wilds + free spins',
  wheel: 'Prize wheel bonus',
  holdspin: '7+ lanterns start Hold & Spin',
};
export { FEATURE_TEXT };
export const featureText = (m: Machine) => m.blurb ?? FEATURE_TEXT[m.feature];

export class SlotsScene extends Phaser.Scene {
  private m: Machine = LUCKY_SEVENS;
  private get theme(): CabinetTheme {
    return THEMES[this.m.id] ?? THEMES.sevens!;
  }
  private betIndex = 2;
  /** Paylines being played (pay by line). */
  private lineCount = LINES.length;
  private linesText!: Phaser.GameObjects.Text;
  private totalText!: Phaser.GameObjects.Text;
  private reels: Phaser.GameObjects.Container[] = [];
  private finals: Phaser.GameObjects.Image[][] = [];
  private spinning = false;
  private freeSpins = 0;
  private freeTotal = 0;
  /** Free spins played so far in this feature (the multiplier can climb with it). */
  private fsPlayed = 0;
  private autoLeft = 0;
  private refresh!: () => void;
  private winText!: Phaser.GameObjects.Text;
  private betText!: Phaser.GameObjects.Text;
  private fsText!: Phaser.GameObjects.Text;
  private jackpotBoxes: Phaser.GameObjects.Container | null = null;
  private fx!: Phaser.GameObjects.Container;
  private shade: Phaser.GameObjects.Graphics | null = null;
  /** Dev builds only: the next spin lands on this grid (for screenshots and tests). */
  private rigged: Grid | null = null;
  private riggedExtras: { wildReels?: number[]; luckyWheel?: boolean } | null = null;
  /** The last paid win that can still be gambled (0 when none). */
  private gambleable = 0;
  private gambleBtn!: Phaser.GameObjects.Image;
  private lines!: Phaser.GameObjects.Graphics;
  private lineFlash: Phaser.Time.TimerEvent | null = null;
  private autoBtn!: Phaser.GameObjects.Image;

  constructor() {
    super('slots');
  }

  init(data: { machine?: string }): void {
    this.m = MACHINES.find((x) => x.id === data.machine) ?? LUCKY_SEVENS;
    this.betIndex = this.m.lineBets ? 0 : Math.min(this.betIndex, lineBetsOf(this.m).length - 1);
  }

  private get lineBet(): number {
    return this.bets[this.betIndex]!;
  }
  private get bets(): number[] {
    return lineBetsOf(this.m);
  }
  private get totalBet(): number {
    return this.lineBet * this.lineCount;
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
    win.fillStyle(0x07020c, 1);
    win.fillRoundedRect(LEFT - 16, TOP - 16, CELL * 5 + 32, CELL * ROWS + 32, 24);
    // every symbol sits in its own lit tile, like a modern video cabinet
    for (let r = 0; r < 5; r++)
      for (let row = 0; row < ROWS; row++) {
        const x = LEFT + r * CELL + 4;
        const y = TOP + row * CELL + 4;
        win.fillGradientStyle(this.theme.reelLight, this.theme.reelLight, this.theme.reelDark, this.theme.reelDark, 1);
        win.fillRoundedRect(x, y, CELL - 8, CELL - 8, 14);
        win.lineStyle(2, 0xe9c86a, 0.45);
        win.strokeRoundedRect(x, y, CELL - 8, CELL - 8, 14);
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
    backdrop(this, machineBg(this.m), { y0: TOP + CELL * ROWS + 16, y1: 10000 }).setDepth(20);
    this.cabinet();
    this.lines = this.add.graphics().setDepth(22).setBlendMode(Phaser.BlendModes.ADD);
    this.fx = this.add.container(0, 0).setDepth(22);

    this.topBox();
    this.jackpotBoxes = null;
    this.updateJackpot();
    this.refresh = coinBar(this, this.m.name, () => {
      if (!this.spinning) this.scene.start('room', { room: 'slots' });
    });

    this.winText = text(this, w / 2, WIN_Y, '', 72, '900', GOLD, DISPLAY_FONT).setStroke('#14071f', 12).setDepth(23);
    this.fsText = text(this, w / 2, LADDER_Y - 36, featureText(this.m), 24, '800', '#ffffff').setStroke('#000000', 6).setDepth(24).setWordWrapWidth(860).setAlign('center');
    this.totalText = text(this, w / 2, ROW2_Y, '', 34, '900', '#ffe9a8').setStroke('#000000', 6).setDepth(24);
    this.console();
    this.updateBet();
    this.autoBtn = this.pressButton(170, ROW2_Y, 'btn-auto', 200, 76, () => this.toggleAuto());
    this.gambleBtn = this.pressButton(910, ROW2_Y, 'btn-gamble', 200, 76, () => this.openGamble()).setVisible(false);
    this.gambleable = 0;
    (globalThis as Record<string, unknown>).__slots = {
      spinning: () => this.spinning,
      spinXY: { x: SPIN_X, y: CONSOLE_Y },
      // test hook: a grid with no line wins and no feature (so a scripted spin never stops for a bonus)
      plainRows: () => Array.from({ length: ROWS }, () => [0, 1, 0, 1, 0].map((k) => this.m.symbols[k]!)),
      freeSpins: () => this.freeSpins,
      machine: this.m.id,
      // test hooks: open this machine's bonus game directly
      bonus: () => (this.m.feature === 'pick' ? this.pickBonus(() => {}) : this.m.feature === 'wheel' ? this.wheelBonus(() => {}) : null),
      // dev test hook: the next spin lands on this grid (rows of symbol ids, top to bottom)
      rig: (rows: string[][], extras?: { wildReels?: number[]; luckyWheel?: boolean }) => {
        if (!import.meta.env.DEV) return;
        if (rows.length) this.rigged = [0, 1, 2, 3, 4].map((r) => rows.map((row) => row[r]!));
        this.riggedExtras = extras ?? null;
      },
      gamble: () => this.openGamble(),
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
        const need = this.m.holdSpin.trigger;
        const g: Grid = [0, 1, 2, 3, 4].map((r) => Array.from({ length: ROWS }, (_, row) => (r * ROWS + row < need ? 'scatter' : 'ten')));
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

  /**
   * The cabinet: chrome body with neon trim in the machine's colour, a crown
   * topper, the reel window's gold bezel with chasing bulbs.
   */
  private cabinet(): void {
    const t = this.theme;
    const { x0, x1, y0, y1 } = CAB;
    const wx0 = LEFT - 16;
    const wy0 = TOP - 16;
    const ww = CELL * 5 + 32;
    const wh = CELL * ROWS + 32;
    const g = this.add.graphics().setDepth(21);
    // body: four panels around the reel window, so reels never show outside it
    const body = (x: number, y: number, w: number, h: number) => {
      g.fillGradientStyle(0x2a2233, 0x2a2233, 0x0c0812, 0x0c0812, 1);
      g.fillRect(x, y, w, h);
    };
    body(x0, y0, x1 - x0, wy0 - y0);
    body(x0, wy0 + wh, x1 - x0, y1 - wy0 - wh);
    body(x0, wy0, wx0 - x0, wh);
    body(wx0 + ww, wy0, x1 - wx0 - ww, wh);
    // chrome edges and neon trim
    const neon = this.add.graphics().setDepth(21).setBlendMode(Phaser.BlendModes.ADD);
    for (const [w, a] of [[30, 0.12], [18, 0.22], [8, 0.6]] as const) {
      neon.lineStyle(w, t.neon, a);
      neon.strokeRoundedRect(x0 + 4, y0 + 4, x1 - x0 - 8, y1 - y0 - 8, 44);
    }
    g.lineStyle(10, 0xd9dde6, 1);
    g.strokeRoundedRect(x0, y0, x1 - x0, y1 - y0, 46);
    g.lineStyle(3, 0xffffff, 0.8);
    g.strokeRoundedRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8, 48);
    g.lineStyle(4, 0x5a5466, 1);
    g.strokeRoundedRect(x0 + 8, y0 + 8, x1 - x0 - 16, y1 - y0 - 16, 40);
    this.tweens.add({ targets: neon, alpha: 0.65, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // reel window bezel
    g.lineStyle(22, t.edge, 1);
    g.strokeRoundedRect(wx0 - 8, wy0 - 8, ww + 16, wh + 16, 32);
    g.lineStyle(14, t.body, 1);
    g.strokeRoundedRect(wx0 - 8, wy0 - 8, ww + 16, wh + 16, 32);
    g.lineStyle(4, t.shine, 1);
    g.strokeRoundedRect(wx0 - 12, wy0 - 12, ww + 24, wh + 24, 34);
    g.lineStyle(3, 0x000000, 0.7);
    g.strokeRoundedRect(wx0, wy0, ww, wh, 24);
    // inner shadow at the window's top and bottom so the reels look recessed
    const sh = this.add.graphics().setDepth(21);
    sh.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.6, 0.6, 0, 0);
    sh.fillRect(LEFT, TOP, CELL * 5, 40);
    sh.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.6, 0.6);
    sh.fillRect(LEFT, TOP + CELL * ROWS - 40, CELL * 5, 40);
    sh.fillStyle(0xffffff, 0.05);
    sh.fillPoints([new Phaser.Math.Vector2(LEFT, TOP), new Phaser.Math.Vector2(LEFT + 260, TOP), new Phaser.Math.Vector2(LEFT + 60, TOP + CELL * ROWS), new Phaser.Math.Vector2(LEFT, TOP + CELL * ROWS)], true);
    // chasing bulbs on the bezel
    const bulbs: Phaser.GameObjects.Image[] = [];
    const per = (n: number, f: (u: number) => [number, number]) => {
      for (let i = 0; i < n; i++) {
        const [bx, by] = f(i / (n - 1));
        bulbs.push(this.add.image(bx, by, 'fx-spark').setDisplaySize(26, 26).setDepth(22).setBlendMode(Phaser.BlendModes.ADD).setTint(t.bulb));
      }
    };
    const L = wx0 - 8;
    const R = wx0 + ww + 8;
    const T = wy0 - 8;
    const B = wy0 + wh + 8;
    per(16, (u) => [L + 30 + u * (R - L - 60), T]);
    per(16, (u) => [R - 30 - u * (R - L - 60), B]);
    let k = 0;
    this.time.addEvent({
      delay: 110,
      loop: true,
      callback: () => {
        k++;
        const fast = this.spinning;
        bulbs.forEach((b, i) => b.setAlpha((i + k) % (fast ? 2 : 4) === 0 ? 1 : 0.25));
      },
    });
  }

  /** The cabinet's top box: the machine's world art behind its 3D logo, under a crown. */
  private topBox(): void {
    const t = this.theme;
    const bx0 = CAB.x0 + 34;
    const bx1 = CAB.x1 - 34;
    const by0 = CAB.y0 + 34;
    const by1 = LADDER_Y - 14;
    backdrop(this, t.art, { y0: by0, y1: by1 }).setDepth(22);
    const g = this.add.graphics().setDepth(22);
    // trim the art to the box: cover the strips beside it with the cabinet body
    g.fillStyle(0x1f1928, 1);
    g.fillRect(CAB.x0 - 40, by0 - 2, bx0 - CAB.x0 + 40, by1 - by0 + 4);
    g.fillRect(bx1, by0 - 2, CAB.x1 - bx1 + 40, by1 - by0 + 4);
    // soft vignette so the logo pops, then a chrome frame with neon lining
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.6, 0.6);
    g.fillRect(bx0, by0 + (by1 - by0) * 0.45, bx1 - bx0, (by1 - by0) * 0.55);
    g.lineStyle(10, 0xd9dde6, 1);
    g.strokeRoundedRect(bx0, by0, bx1 - bx0, by1 - by0, 26);
    g.lineStyle(4, t.neon, 1);
    g.strokeRoundedRect(bx0 + 7, by0 + 7, bx1 - bx0 - 14, by1 - by0 - 14, 20);
    // rounded corners: paint the body colour over the art's square corners
    const corner = (cx: number, cy: number, sx: number, sy: number) => {
      g.fillStyle(0x1f1928, 1);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + sx * 26, cy);
      g.arc(cx + sx * 26, cy + sy * 26, 26, sy < 0 ? Math.PI / 2 : -Math.PI / 2, sx < 0 ? 0 : Math.PI, sx * sy > 0);
      g.closePath();
      g.fillPath();
    };
    void corner;
    const logo = this.add.image(VW / 2, by1 - 112, `logo-${this.m.id}`).setDisplaySize(760, 137).setDepth(23);
    this.tweens.add({ targets: logo, scale: logo.scale * 1.03, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.crown(VW / 2, CAB.y0 + 8);
  }

  /** A gold crown topper with jewels. */
  private crown(x: number, y: number): void {
    const g = this.add.graphics().setDepth(24);
    const pts = [
      [-95, 34], [-110, -30], [-55, 4], [0, -50], [55, 4], [110, -30], [95, 34],
    ].map(([px, py]) => new Phaser.Math.Vector2(x + px!, y + py!));
    g.fillStyle(0x6a4708, 1);
    g.fillPoints(pts.map((p) => new Phaser.Math.Vector2(p.x + 3, p.y + 5)), true);
    g.fillGradientStyle(0xfff0b0, 0xfff0b0, 0xc98a1e, 0xc98a1e, 1);
    g.fillPoints(pts, true);
    g.lineStyle(3, 0x7a4a0a, 1);
    g.strokePoints(pts, true);
    g.fillStyle(0xc98a1e, 1);
    g.fillRoundedRect(x - 100, y + 26, 200, 26, 8);
    g.lineStyle(3, 0x7a4a0a, 1);
    g.strokeRoundedRect(x - 100, y + 26, 200, 26, 8);
    for (const [jx, jy, c] of [[0, -50, 0xc8102e], [-110, -30, 0x2a9dff], [110, -30, 0x2a9dff], [-50, 39, 0x18a050], [0, 39, 0xc8102e], [50, 39, 0x18a050]] as const) {
      g.fillStyle(0xfff0b0, 1);
      g.fillCircle(x + jx, y + jy, 11);
      g.fillStyle(c, 1);
      g.fillCircle(x + jx, y + jy, 8);
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(x + jx - 3, y + jy - 3, 3);
    }
  }

  /** BET − value + · MAX BET · SPIN, on a console under the reels. */
  private console(): void {
    const y = CONSOLE_Y;
    const g = this.add.graphics().setDepth(23);
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(64, y - 66, VW - 128, 140, 34);
    g.fillGradientStyle(0x2a2233, 0x2a2233, 0x0a0710, 0x0a0710, 1);
    g.fillRoundedRect(60, y - 72, VW - 120, 140, 34);
    g.lineStyle(3, 0xe9c86a, 0.8);
    g.strokeRoundedRect(60, y - 72, VW - 120, 140, 34);
    // two steppers: how many lines, and the bet on each line
    const round = (x: number, label: string, fn: () => void) => {
      const c = this.add.container(x, y + 6).setDepth(24);
      const b = this.add.graphics();
      b.fillGradientStyle(0x5a5466, 0x5a5466, 0x1a1622, 0x1a1622, 1);
      b.fillCircle(0, 0, 28);
      b.lineStyle(3, 0xd9dde6, 1);
      b.strokeCircle(0, 0, 28);
      c.add([b, text(this, 0, -2, label, 40, '900', '#ffffff')]);
      c.setSize(64, 64).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => c.setScale(0.9));
      c.on('pointerout', () => c.setScale(1));
      c.on('pointerup', () => {
        c.setScale(1);
        fn();
      });
    };
    const box = (x0: number, w: number, label: string) => {
      g.fillStyle(0x05020a, 1);
      g.fillRoundedRect(x0, y - 52, w, 104, 30);
      g.lineStyle(3, 0x8a7a9a, 1);
      g.strokeRoundedRect(x0, y - 52, w, 104, 30);
      text(this, x0 + w / 2, y - 30, label, 18, '800', '#cbb6d6').setDepth(24).setLetterSpacing(2);
      return text(this, x0 + w / 2, y + 10, '', 36, '900', '#ffe9a8').setDepth(24);
    };
    this.linesText = box(80, 236, 'LINES');
    round(118, '−', () => this.changeLines(-1));
    round(278, '+', () => this.changeLines(1));
    this.betText = box(328, 264, 'BET / LINE');
    round(366, '−', () => this.changeBet(-1));
    round(554, '+', () => this.changeBet(1));
    makeButton(this, 694, y, 'MAX\nBET', () => this.maxBet(), { width: 140, height: 104, fontSize: 28, color: 0x2a2430, theme: THEME }).setDepth(24);
    makeButton(this, SPIN_X, y, 'SPIN', () => this.spin(), { width: 220, height: 116, fontSize: 50, color: this.theme.neon, theme: THEME }).setDepth(24);
  }

  /** The biggest bet you can afford on this machine. */
  private maxBet(): void {
    if (this.spinning || this.freeSpins > 0) return;
    this.lineCount = LINES.length;
    let i = this.bets.length - 1;
    while (i > 0 && this.bets[i]! * this.lineCount > wallet.coins) i--;
    this.betIndex = i;
    audio.chips(3);
    this.updateBet();
  }

  /**
   * The four-line jackpot ladder. Grand is the shared progressive (your share
   * at this bet: five WILDs on a line); Major, Minor and Mini are Lucky Wheel
   * wedges. Hold & Spin machines show their own lantern jackpots instead.
   */
  private ladder(): [string, number][] {
    const hs = this.m.holdSpin;
    const bet = this.totalBet;
    if (hs) {
      return [
        ['GRAND', hs.grand * bet],
        ...(['MAJOR', 'MINOR', 'MINI'] as const).map((l): [string, number] => [l, hs.values.find((v) => v.lantern.label === l)!.lantern.mult * bet]),
      ];
    }
    return [
      ['GRAND', this.grandValue()],
      ['MAJOR', WHEEL_JACKPOTS.MAJOR * bet],
      ['MINOR', WHEEL_JACKPOTS.MINOR * bet],
      ['MINI', WHEEL_JACKPOTS.MINI * bet],
    ];
  }

  /** The Grand at this bet: your share of the progressive, never less than 1,000x the bet. */
  private grandValue(): number {
    return Math.max(GRAND_MIN * this.totalBet, Math.round(player.jackpot * Math.min(1, this.totalBet / MAX_TOTAL_BET)));
  }

  private updateJackpot(): void {
    this.jackpotBoxes?.destroy();
    const c = this.add.container(0, 0).setDepth(23);
    this.jackpotBoxes = c;
    let y = LADDER_Y;
    this.ladder().forEach(([label, value], i) => {
      const grand = i === 0;
      const h = grand ? 70 : 52;
      const bw = grand ? 900 : 820;
      const x0 = VW / 2 - bw / 2;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.55);
      g.fillRoundedRect(x0 + 2, y + 5, bw, h, h / 2);
      g.fillGradientStyle(0x1a1024, 0x1a1024, 0x05020a, 0x05020a, 1);
      g.fillRoundedRect(x0, y, bw, h, h / 2);
      g.lineStyle(grand ? 4 : 3, 0xe9c86a, 1);
      g.strokeRoundedRect(x0, y, bw, h, h / 2);
      // coloured name tag on the left
      const tw = grand ? 230 : 200;
      g.fillStyle(JACKPOT_COLORS[label]!, 1);
      g.fillRoundedRect(x0 + 6, y + 6, tw, h - 12, (h - 12) / 2);
      g.fillStyle(0xffffff, 0.22);
      g.fillRoundedRect(x0 + 14, y + 9, tw - 16, (h - 12) / 2 - 2, (h - 12) / 4);
      c.add(g);
      c.add(text(this, x0 + 6 + tw / 2, y + h / 2, label, grand ? 36 : 28, '900', '#ffe9a8').setStroke('#000000', 5).setLetterSpacing(2));
      c.add(text(this, x0 + bw - 36, y + h / 2, fmt(value), grand ? 46 : 34, '900', grand ? '#ffe14a' : '#ffffff', grand ? DISPLAY_FONT : undefined).setOrigin(1, 0.5));
      y += h + 8;
    });
  }

  private changeBet(d: number): void {
    if (this.spinning || this.freeSpins > 0) return;
    audio.chip();
    this.betIndex = Phaser.Math.Clamp(this.betIndex + d, 0, this.bets.length - 1);
    this.updateBet();
  }

  private changeLines(d: number): void {
    if (this.spinning || this.freeSpins > 0) return;
    audio.chip();
    const i = Phaser.Math.Clamp(LINE_CHOICES.indexOf(this.lineCount) + d, 0, LINE_CHOICES.length - 1);
    this.lineCount = LINE_CHOICES[i]!;
    this.updateBet();
    this.flashLines();
  }

  /** Shows the paylines being played for a moment. */
  private flashLines(): void {
    this.clearWinFx();
    this.lines.clear();
    for (let k = 0; k < this.lineCount; k++) {
      const pts = LINES[k]!.map((row, reel) => new Phaser.Math.Vector2(LEFT + CELL * (reel + 0.5), TOP + CELL * (row + 0.5)));
      this.lines.lineStyle(12, LINE_COLORS[k % LINE_COLORS.length]!, 0.4);
      strokePath(this.lines, pts);
      this.lines.lineStyle(5, LINE_COLORS[k % LINE_COLORS.length]!, 1);
      strokePath(this.lines, pts);
    }
    // (a tween on this layer hides it at once, even with a delay, so fade with a timer)
    this.lineFlash?.remove();
    const drawn = this.lines;
    this.lineFlash = this.time.delayedCall(1400, () => {
      if (!this.spinning && drawn.active) drawn.clear();
    });
  }

  private updateBet(): void {
    this.linesText.setText(String(this.lineCount));
    this.betText.setText(fmt(this.lineBet));
    this.totalText.setText(`TOTAL BET ${fmt(this.totalBet)}`);
    this.updateJackpot();
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
    this.lineFlash?.remove();
    this.lineFlash = null;
    this.lines.clear();
    this.winText.setText('');
    this.updateFsText();
    haptics.fire('light');
    const grid = this.rigged ?? gridFromStops(this.m, spinStops(this.m));
    const extras = this.riggedExtras;
    const rigged = this.rigged !== null || extras !== null;
    this.rigged = null;
    this.riggedExtras = null;
    // paid spins can turn whole reels wild or award the Lucky Wheel
    const wildReels = extras?.wildReels ?? (free || rigged ? [] : rollWildReels());
    const result = evaluate(this.m, grid, this.lineBet, wildReels, this.lineCount);
    result.luckyWheel = extras?.luckyWheel ?? (!free && !rigged && secureRandom() < LUCKY_WHEEL_CHANCE);
    this.hideGamble();
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
      const newImgs = grid[r]!.map((s, row) => this.symbol(s, TOP + CELL * (row + 0.5) - CELL * (filler + ROWS)));
      const fill: Phaser.GameObjects.Image[] = [];
      for (let k = 0; k < filler; k++) {
        const s = this.m.symbols[Math.floor(Math.random() * this.m.symbols.length)]!;
        fill.push(this.symbol(s, TOP + CELL * (ROWS - 0.5 - k) - CELL * ROWS, true));
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
    if (res.wildReels.length) {
      const after = () => (res.expanded.length ? this.expandThen({ ...res, wildReels: [] }, next) : next());
      return this.wildReelsFx(res.wildReels, after);
    }
    if (!res.expanded.length) return next();
    res.expanded.forEach((reel, k) => {
      this.time.delayedCall(k * 260, () => {
        const glow = this.add.rectangle(LEFT + CELL * (reel + 0.5), TOP + (CELL * ROWS) / 2, CELL - 8, CELL * ROWS - 8, 0x4fd1ff, 0.35).setDepth(22);
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

  /** Wild Reels: lightning down the chosen reels, which turn fully wild. */
  private wildReelsFx(reels: number[], next: () => void): void {
    banner(this, 'WILD REELS!', reels.length > 1 ? `${reels.length} reels turn wild` : 'A reel turns wild', '#7dffb0');
    audio.tension(0.8);
    this.cameras.main.shake(300, 0.006);
    reels.forEach((reel, k) => {
      this.time.delayedCall(600 + k * 380, () => {
        const x = LEFT + CELL * (reel + 0.5);
        const bolt = this.add.image(x, TOP + (CELL * ROWS) / 2, 'fx-glow').setDisplaySize(CELL * 1.6, CELL * (ROWS + 0.6)).setDepth(22).setBlendMode(Phaser.BlendModes.ADD).setTint(0xaaffdd);
        this.tweens.add({ targets: bolt, alpha: { from: 1, to: 0 }, duration: 900, onComplete: () => bolt.destroy() });
        const frameG = this.add.rectangle(x, TOP + (CELL * ROWS) / 2, CELL - 6, CELL * ROWS, 0, 0).setStrokeStyle(8, 0x7dffb0, 1).setDepth(22);
        this.fx.add(frameG);
        this.tweens.add({ targets: frameG, alpha: { from: 1, to: 0.5 }, duration: 300, yoyo: true, repeat: -1 });
        this.finals[reel]!.forEach((img, row) => {
          img.setTexture(symKey(this.m, 'wild')).setDisplaySize(CELL * 0.86, CELL * 0.86).setData('sym', 'wild');
          this.tweens.add({ targets: img, scale: { from: img.scale * 0.3, to: img.scale }, duration: 360, delay: row * 80, ease: 'Back.easeOut' });
          this.time.delayedCall(row * 80, () => this.sparkBurst(x, img.y, 10));
        });
        audio.win();
        haptics.fire('success');
      });
    });
    this.time.delayedCall(600 + reels.length * 380 + 500, next);
  }

  // ---------------------------------------------------------------- Lucky Wheel
  /** Side game on any machine: spin for a multiple of the bet. */
  private luckyWheel(resume: () => void): void {
    const bet = this.totalBet;
    this.autoLeft = 0;
    this.setAuto(false);
    const { panel, close } = this.bonusPanel('LUCKY WHEEL', `Every wedge pays × your bet (${fmt(bet)})`);
    banner(this, 'LUCKY WHEEL!', 'Spin to win', '#ffd23f');
    audio.win();
    const R = 400;
    const n = LUCKY_WHEEL.prizes.length;
    const cols = [0xc8102e, 0x1d3aa8, 0x0f8a5a, 0x6b2fb3, 0xd8701a, 0x0f8a9a];
    // on ladder machines the top wedges are the named jackpots shown on the cabinet
    const named = (p: number) => (this.m.holdSpin ? undefined : (Object.entries(WHEEL_JACKPOTS).find(([, v]) => v === p)?.[0]));
    const key = paintPrizeWheel(this, this.m.holdSpin ? 'tex-lucky-wheel' : 'tex-lucky-wheel-jp', LUCKY_WHEEL.prizes.map((p) => named(p) ?? `×${p}`), LUCKY_WHEEL.prizes.map((p, i) => (p >= 100 ? 0xd4a017 : cols[i % cols.length]!)), R, { font: 54 });
    const wheel = this.add.container(0, -40, [this.add.image(0, 0, key)]);
    const hub = this.add.image(0, -40, 'coin').setDisplaySize(130, 130);
    const ptr = this.add.graphics();
    ptr.fillStyle(0xffffff, 1);
    ptr.fillTriangle(-36, -40 - R - 66, 36, -40 - R - 66, 0, -40 - R + 8);
    ptr.lineStyle(4, 0x3a2210, 1);
    ptr.strokeTriangle(-36, -40 - R - 66, 36, -40 - R - 66, 0, -40 - R + 8);
    // bulbs around the rim
    const bulbs: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      bulbs.push(this.add.image(Math.cos(a) * (R + 26), -40 + Math.sin(a) * (R + 26), 'fx-spark').setDisplaySize(34, 34).setBlendMode(Phaser.BlendModes.ADD));
    }
    let tick = 0;
    const blink = this.time.addEvent({ delay: 120, loop: true, callback: () => bulbs.forEach((b, i) => b.setAlpha((i + ++tick) % 2 ? 1 : 0.3)) });
    panel.add([wheel, hub, ptr, ...bulbs]);
    let spun = false;
    const btn = mb(this, 0, 590, 'SPIN', () => {
      if (spun) return;
      spun = true;
      const idx = spinLuckyWheel();
      const win = LUCKY_WHEEL.prizes[idx]! * bet;
      let last = 0;
      this.tweens.add({
        targets: wheel,
        angle: 360 * 7 - idx * (360 / n),
        duration: 5200,
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
          this.sparkBurst(VW / 2, 960 - 40 - R, 30);
          (btn.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text).setText('Collect');
          btn.once('pointerup', () => {
            blink.remove();
            close();
            if (tierFor(win, bet) >= 0) showBigWin(this, win, bet, resume);
            else {
              banner(this, `×${LUCKY_WHEEL.prizes[idx]}`, `+${fmt(win)}`);
              audio.win();
              this.time.delayedCall(1500, resume);
            }
          });
        },
      });
    }, { width: 460, height: 130, fontSize: 56, theme: THEME });
    panel.add(btn);
  }

  // ---------------------------------------------------------------- gamble
  private showGamble(win: number): void {
    this.gambleable = win;
    if (this.autoLeft > 0 || this.freeSpins > 0) return;
    this.gambleBtn.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.gambleBtn, alpha: 1, duration: 250 });
  }

  private hideGamble(): void {
    this.gambleable = 0;
    this.gambleBtn?.setVisible(false);
  }

  /**
   * Double up: a face-down card; guess its colour (×2) or suit (×4). Win and
   * keep going (up to 5 times), or lose the amount. The win is already in the
   * balance, so a loss takes it back and a win adds the difference.
   */
  private openGamble(): void {
    if (this.spinning || this.gambleable <= 0) return;
    let amount = this.gambleable;
    this.hideGamble();
    this.spinning = true;
    const { panel, close } = this.bonusPanel('GAMBLE', 'Red or black doubles it · the right suit pays ×4');
    const stake = text(this, 0, -440, '', 64, '900', '#ffffff', DISPLAY_FONT);
    const hint = text(this, 0, -370, '', 34, '700', '#cbb6d6');
    const card = this.add.image(0, -100, 'card-back').setDisplaySize(250, 350);
    const glow = this.add.image(0, -100, 'fx-glow').setDisplaySize(520, 620).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35);
    panel.add([glow, card, stake, hint]);
    this.tweens.add({ targets: glow, alpha: 0.15, duration: 700, yoyo: true, repeat: -1 });
    const history: Phaser.GameObjects.Image[] = [];
    let rounds = 0;
    let busy = false;
    const draw = () => {
      stake.setText(fmt(amount));
      hint.setText(rounds < 5 ? `Win ${fmt(amount * 2)} on colour or ${fmt(amount * 4)} on suit` : 'Maximum reached: collect your win');
    };
    draw();
    const buttons: Phaser.GameObjects.Container[] = [];
    const finish = () => {
      close();
      this.spinning = false;
      this.refresh();
    };
    const guess = (pick: 'red' | 'black' | Card['suit']) => {
      if (busy || rounds >= 5 || amount <= 0) return;
      busy = true;
      const c: Card = { rank: RANKS[Math.floor(secureRandom() * 13)]!, suit: SUITS[Math.floor(secureRandom() * 4)]! };
      const red = c.suit === 'h' || c.suit === 'd';
      const right = pick === 'red' ? red : pick === 'black' ? !red : pick === c.suit;
      const mult = pick === 'red' || pick === 'black' ? 2 : 4;
      audio.flip();
      this.tweens.add({
        targets: card,
        scaleX: 0,
        duration: 140,
        yoyo: true,
        onYoyo: () => card.setTexture(`card-${cardId(c)}`).setDisplaySize(card.displayWidth || 1, 350),
        onComplete: () => {
          card.setDisplaySize(250, 350);
          const h = this.add.image(-330 + history.length * 90, 170, `card-${cardId(c)}`).setDisplaySize(76, 106);
          history.push(h);
          panel.add(h);
          rounds++;
          if (right) {
            wallet.add(amount * (mult - 1));
            amount *= mult;
            wallet.recordWin(amount);
            audio.win();
            this.sparkBurst(VW / 2, 860, 20);
            draw();
            this.time.delayedCall(700, () => {
              card.setTexture('card-back').setDisplaySize(250, 350);
              busy = false;
            });
          } else {
            wallet.spend(amount);
            audio.invalid();
            haptics.fire('error');
            amount = 0;
            stake.setText('0');
            hint.setText('Better luck next time');
            this.time.delayedCall(1300, finish);
          }
          this.refresh();
        },
      });
    };
    const row = (y: number, items: [string, () => void, number][]) =>
      items.forEach(([label, fn, color], i) => {
        const w = 880 / items.length - 20;
        const b = mb(this, -440 + w / 2 + 10 + i * (w + 20), y, label, fn, { width: w, height: 110, fontSize: label.length > 2 ? 40 : 56, color, shadow: 0x0a0408, textColor: '#ffffff', theme: THEME });
        buttons.push(b);
        panel.add(b);
      });
    row(300, [['RED ×2', () => guess('red'), 0xc8102e], ['BLACK ×2', () => guess('black'), 0x22222a]]);
    row(430, [['♥', () => guess('h'), 0xa80e28], ['♦', () => guess('d'), 0xa80e28], ['♣', () => guess('c'), 0x22222a], ['♠', () => guess('s'), 0x22222a]]);
    panel.add(
      mb(this, 0, 590, 'Collect', () => {
        if (busy) return;
        audio.coins(6);
        finish();
      }, { width: 460, height: 120, fontSize: 48, theme: THEME }),
    );
  }

  private updateFsText(): void {
    this.fsText.setText(
      this.freeSpins > 0 || this.freeTotal > 0
        ? `FREE SPINS ${this.freeSpins}${freeSpinMult(this.m, this.fsPlayed) > 1 ? `  ·  wins ×${freeSpinMult(this.m, this.fsPlayed)}` : ''}`
        : featureText(this.m),
    );
  }

  private done(res: SpinResult, free: boolean): void {
    const mult = free ? freeSpinMult(this.m, this.fsPlayed++) : 1;
    let win = res.total * mult;
    if (res.jackpot && !free) {
      // the progressive share, topped up to the Grand's floor
      const grand = this.grandValue();
      const jp = player.winJackpot(Math.min(1, this.totalBet / MAX_TOTAL_BET));
      if (grand > jp) wallet.add(grand - jp);
      const paid = Math.max(grand, jp);
      this.time.delayedCall(400, () => {
        banner(this, 'GRAND JACKPOT!', `+${fmt(paid)}`);
        audio.win();
        coinShower(this, VW / 2, 700, paid);
        wallet.recordWin(paid);
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
        const mult2 = freeSpinMult(this.m, this.fsPlayed);
        banner(this, 'FREE SPINS', `${res.freeSpins} spins${mult2 > 1 ? ` · wins ×${mult2}` : ''}${this.m.freeSpinRamp ? ' and climbing' : ''}`);
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
        this.fsPlayed = 0;
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
    const afterWheel = () => {
      if (res.bonus) {
        player.event('slots_bonus');
        this.autoLeft = 0;
        this.setAuto(false);
        this.time.delayedCall(wait, () =>
          res.bonus === 'pick' ? this.pickBonus(resume) : res.bonus === 'wheel' ? this.wheelBonus(resume) : this.holdSpin(res.grid, resume),
        );
        return;
      }
      // a plain paid win can be gambled
      if (!free && win > 0 && !res.freeSpins) this.showGamble(win);
      this.time.delayedCall(wait, resume);
    };
    const next = () => {
      if (!res.luckyWheel) return afterWheel();
      this.time.delayedCall(wait, () => this.luckyWheel(afterWheel));
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
    const n = this.m.picks ?? 3;
    const { panel, close } = this.bonusPanel('BONUS', `Pick ${n} · prizes × your bet (${fmt(bet)})`);
    banner(this, 'BONUS GAME', `Pick ${n}!`);
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
        if (picks >= n || !cover.input?.enabled) return;
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
        if (picks === n) {
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
   * three. Fill every cell for the Grand jackpot.
   */
  private holdSpin(grid: Grid, resume: () => void): void {
    const m = this.m;
    const hs = m.holdSpin!;
    const bet = this.totalBet;
    const board = holdSpinStart(m, grid);
    this.autoLeft = 0;
    this.setAuto(false);
    this.lines.clear();
    banner(this, 'HOLD & SPIN', `${board.filter(Boolean).length} ${this.m.id === 'dragon' ? 'dragon eggs' : 'lanterns'} locked`);
    audio.win();
    haptics.fire('success');
    const layer = this.add.container(0, 0).setDepth(20.5);
    const cellPos = (i: number) => ({ x: LEFT + CELL * (Math.floor(i / ROWS) + 0.5), y: TOP + CELL * ((i % ROWS) + 0.5) });
    const bgs: Phaser.GameObjects.Rectangle[] = [];
    const lit: Phaser.GameObjects.Container[] = [];
    for (let i = 0; i < 5 * ROWS; i++) {
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
      this.fsText.setText(this.m.id === 'dragon' ? 'Collecting dragon eggs' : 'Collecting lanterns');
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
    const glow = this.add.rectangle(x, TOP + (CELL * ROWS) / 2, CELL - 6, CELL * ROWS, 0xffc040, 0).setStrokeStyle(8, 0xffd76a, 1).setDepth(22);
    const halo = this.add.image(x, TOP + (CELL * ROWS) / 2, 'fx-glow').setDisplaySize(CELL * 2, CELL * (ROWS + 1)).setDepth(19).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.tweens.add({ targets: halo, alpha: 0.9, duration: 300 });
    this.tweens.add({ targets: glow, alpha: { from: 1, to: 0.4 }, duration: 160, yoyo: true, repeat: -1 });
    const sparks = this.add.particles(0, 0, 'fx-spark', {
      x: { min: x - CELL / 2, max: x + CELL / 2 },
      y: { min: TOP, max: TOP + CELL * ROWS },
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
      strokePath(this.lines, pts);
      this.lines.lineStyle(10, color, 0.45);
      strokePath(this.lines, pts);
      this.lines.lineStyle(4, 0xffffff, 0.9);
      strokePath(this.lines, pts);
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
