import Phaser from 'phaser';
import { BaccaratShoe, settleBets, total, type BaccaratBet, type Coup, type Side } from '../logic/baccarat.ts';
import { DISPLAY_FONT, GOLD, audio, fmt } from '../services.ts';
import { CARD_H, CARD_W, VW, backdrop, banner, coinBar, dealCard, frame, text } from '../ui/common.ts';
import { BetBoard, bottomButtons, payout, type Spot } from '../ui/tablekit.ts';

const SHOE = { x: 940, y: 330 };
const HAND_Y = 600;
const PX = 300;
const BX = 780;
const ROAD_Y = 880;
const SIDE_COLOR: Record<Side, number> = { player: 0x1a5ac8, banker: 0xc8102e, tie: 0x18a050 };

const SPOTS: Spot[] = [
  { id: 'playerPair', x: 150, y: 1180, r: 62, label: 'P PAIR', pays: '11 to 1' },
  { id: 'tie', x: 540, y: 1180, r: 76, label: 'TIE', pays: '8 to 1', color: 0x18a050 },
  { id: 'bankerPair', x: 930, y: 1180, r: 62, label: 'B PAIR', pays: '11 to 1' },
  { id: 'player', x: 290, y: 1390, r: 112, label: 'PLAYER', pays: '1 to 1', color: 0x1a5ac8 },
  { id: 'banker', x: 790, y: 1390, r: 112, label: 'BANKER', pays: '0.95 to 1', color: 0xc8102e },
];

/** Punto banco: bet on Player, Banker or a Tie (plus the pair side bets). */
export class BaccaratScene extends Phaser.Scene {
  private shoe = new BaccaratShoe();
  private road: Side[] = [];
  private board!: BetBoard;
  private refresh!: () => void;
  private cards: Phaser.GameObjects.Image[] = [];
  private totals: Phaser.GameObjects.Container | null = null;
  private roadLayer: Phaser.GameObjects.Container | null = null;
  private controls: Phaser.GameObjects.GameObject[] = [];
  private info!: Phaser.GameObjects.Text;
  private busy = false;

  constructor() {
    super('baccarat');
  }

  create(): void {
    frame(this);
    backdrop(this, 'table-baccarat');
    this.refresh = coinBar(this, 'Baccarat', () => {
      if (!this.busy) this.scene.start('room', { room: 'tables' });
    });
    this.cards = [];
    this.totals = null;
    this.busy = false;
    text(this, PX - 50, HAND_Y - 160, 'PLAYER', 40, '900', '#8ab8ff', DISPLAY_FONT).setStroke('#000000', 6);
    text(this, BX - 50, HAND_Y - 160, 'BANKER', 40, '900', '#ff8a9a', DISPLAY_FONT).setStroke('#000000', 6);
    this.info = text(this, VW / 2, 1290, '', 30, '800', '#ffffff').setDepth(8);
    this.board = new BetBoard(this, SPOTS, () => this.updateInfo());
    this.drawRoad();
    this.betting();
    (globalThis as Record<string, unknown>).__baccarat = {
      busy: () => this.busy,
      bet: (id: string, amount: number) => this.board.add(id, amount),
      deal: () => this.deal(),
    };
  }

  private updateInfo(): void {
    this.info.setText(this.board.total ? `Total bet ${fmt(this.board.total)}` : 'Tap chips, then tap Player, Banker or Tie');
  }

  private clearControls(): void {
    this.controls.forEach((c) => c.destroy());
    this.controls = [];
  }

  private betting(): void {
    this.busy = false;
    this.board.locked = false;
    this.clearControls();
    this.board.showPicker(1690);
    const hasLast = Object.keys(this.board.last).length > 0;
    this.controls.push(
      ...bottomButtons(this, 1840, { label: 'Clear', fn: () => this.board.clear() }, { label: 'Deal', fn: () => this.deal() }, hasLast ? { label: 'Rebet', fn: () => this.board.rebet() } : undefined),
    );
    this.updateInfo();
  }

  private deal(): void {
    if (this.busy) return;
    if (!this.board.total) {
      audio.invalid();
      return;
    }
    if (!this.board.pay(this.refresh)) return;
    this.busy = true;
    audio.unlock();
    this.clearControls();
    this.board.hidePicker();
    this.cards.forEach((c) => c.destroy());
    this.cards = [];
    this.totals?.destroy();
    this.totals = null;
    const coup = this.shoe.next();
    // P B P B, then third cards (turned sideways, as they are dealt on a real table)
    const pos = (side: 'player' | 'banker', k: number) => ({
      x: (side === 'player' ? PX : BX) + (k === 2 ? (side === 'player' ? -200 : 200) : (k - 0.5) * 140),
      y: HAND_Y + (k === 2 ? 26 : 0),
    });
    const order: ['player' | 'banker', number][] = [
      ['player', 0],
      ['banker', 0],
      ['player', 1],
      ['banker', 1],
    ];
    let d = 0;
    for (const [side, k] of order) {
      const p = pos(side, k);
      this.cards.push(dealCard(this, SHOE, p.x, p.y, coup[side][k]!, d, 0.78));
      d += 260;
    }
    this.time.delayedCall(d + 300, () => this.showTotals(coup, 2, 2));
    let extra = 0;
    if (coup.player.length > 2) {
      const p = pos('player', 2);
      this.time.delayedCall(d + 900, () => {
        const c = dealCard(this, SHOE, p.x, p.y, coup.player[2]!, 0, 0.78);
        c.setAngle(90).setDepth(3);
        this.cards.push(c);
        this.time.delayedCall(500, () => this.showTotals(coup, 3, 2));
      });
      extra += 900;
    }
    if (coup.banker.length > 2) {
      const p = pos('banker', 2);
      this.time.delayedCall(d + 900 + extra, () => {
        const c = dealCard(this, SHOE, p.x, p.y, coup.banker[2]!, 0, 0.78);
        c.setAngle(90).setDepth(3);
        this.cards.push(c);
        this.time.delayedCall(500, () => this.showTotals(coup, coup.player.length, 3));
      });
      extra += 900;
    }
    this.time.delayedCall(d + 1200 + extra, () => this.settle(coup));
  }

  private showTotals(coup: Coup, pn: number, bn: number): void {
    this.totals?.destroy();
    const c = this.add.container(0, 0).setDepth(9);
    this.totals = c;
    // the hand total, in a badge beside the PLAYER / BANKER label
    const badge = (x: number, n: number, color: number) => {
      const y = HAND_Y - 160;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.6);
      g.fillCircle(x, y, 42);
      g.lineStyle(5, color, 1);
      g.strokeCircle(x, y, 42);
      c.add([g, text(this, x, y, String(n), 48, '900', '#ffffff')]);
    };
    badge(PX + 120, total(coup.player.slice(0, pn)), 0x4a8aff);
    badge(BX + 120, total(coup.banker.slice(0, bn)), 0xff4a6a);
    audio.tap();
  }

  private settle(coup: Coup): void {
    const staked = this.board.total;
    const back = settleBets(coup, this.board.bets as Partial<Record<BaccaratBet, number>>);
    const p = total(coup.player);
    const b = total(coup.banker);
    const title = coup.winner === 'tie' ? 'TIE' : coup.winner === 'player' ? 'PLAYER WINS' : 'BANKER WINS';
    banner(this, title, `${p} to ${b}${coup.natural ? ' · natural' : ''}`, coup.winner === 'player' ? '#8ab8ff' : coup.winner === 'banker' ? '#ff8a9a' : '#7dffb0');
    const winners: string[] = [coup.winner];
    if (coup.playerPair) winners.push('playerPair');
    if (coup.bankerPair) winners.push('bankerPair');
    this.board.flash(winners);
    payout(this, back, staked, this.refresh, { x: VW / 2, y: 1300 });
    this.info.setText(back > staked ? `You win ${fmt(back - staked)}` : back === staked ? 'Push' : 'Better luck next hand');
    this.road.push(coup.winner);
    if (this.road.length > 60) this.road.shift();
    this.drawRoad();
    this.time.delayedCall(2200, () => {
      this.board.bets = {};
      this.board.draw();
      this.betting();
    });
  }

  /** Bead road: the last results, column by column, like the scoreboard at a real baccarat table. */
  private drawRoad(): void {
    this.roadLayer?.destroy();
    const c = this.add.container(0, 0).setDepth(4);
    this.roadLayer = c;
    const cols = 14;
    const rows = 4;
    const cell = 46;
    const x0 = VW / 2 - (cols * cell) / 2;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(x0 - 14, ROAD_Y - 14, cols * cell + 28, rows * cell + 28, 16);
    g.lineStyle(2, 0xe9c86a, 0.5);
    g.strokeRoundedRect(x0 - 14, ROAD_Y - 14, cols * cell + 28, rows * cell + 28, 16);
    c.add(g);
    const shown = this.road.slice(-cols * rows);
    shown.forEach((r, i) => {
      const x = x0 + Math.floor(i / rows) * cell + cell / 2;
      const y = ROAD_Y + (i % rows) * cell + cell / 2;
      const dot = this.add.graphics();
      dot.fillStyle(SIDE_COLOR[r], 1);
      dot.fillCircle(x, y, 18);
      c.add([dot, text(this, x, y, r === 'player' ? 'P' : r === 'banker' ? 'B' : 'T', 20, '900', '#ffffff')]);
    });
    const counts = (s: Side) => this.road.filter((r) => r === s).length;
    c.add(text(this, VW / 2, ROAD_Y + rows * cell + 34, `Player ${counts('player')}  ·  Banker ${counts('banker')}  ·  Tie ${counts('tie')}`, 24, '700', GOLD));
  }
}
