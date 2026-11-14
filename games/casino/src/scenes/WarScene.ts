import Phaser from 'phaser';
import { newDeck, shuffle, type Card } from '../logic/cards.ts';
import { settleFirst, settleWar, surrender } from '../logic/war.ts';
import { DISPLAY_FONT, audio, fmt, wallet } from '../services.ts';
import { VW, backdrop, banner, coinBar, dealCard, frame, outOfCoins, text } from '../ui/common.ts';
import { BetBoard, bottomButtons, payout, type Spot } from '../ui/tablekit.ts';
import { Dealer } from '../ui/dealer.ts';

const SHOE = { x: 940, y: 330 };
const DEALER_Y = 520;
const PLAYER_Y = 1050;

const SPOTS: Spot[] = [
  { id: 'tie', x: 290, y: 1390, r: 84, label: 'TIE', pays: '10 to 1', color: 0x18a050 },
  { id: 'bet', x: 700, y: 1390, r: 112, label: 'BET', pays: '1 to 1', color: 0x5a1a8a },
];

/** Casino War: high card wins; on a tie, go to war or surrender. */
export class WarScene extends Phaser.Scene {
  private board!: BetBoard;
  private refresh!: () => void;
  private deck: Card[] = [];
  private sprites: Phaser.GameObjects.Image[] = [];
  private controls: Phaser.GameObjects.GameObject[] = [];
  private info!: Phaser.GameObjects.Text;
  private busy = false;
  private atWar = false;

  constructor() {
    super('war');
  }

  create(): void {
    frame(this);
    backdrop(this, 'table-war');
    this.refresh = coinBar(this, 'Casino War', () => {
      if (!this.busy && !this.atWar) this.scene.start('room', { room: 'tables' });
    });
    this.sprites = [];
    this.busy = false;
    this.atWar = false;
    this.deck = shuffle(newDeck(6));
    text(this, VW / 2, DEALER_Y - 170, 'DEALER', 34, '900', '#e9c8ff', DISPLAY_FONT).setStroke('#000000', 6);
    text(this, VW / 2, PLAYER_Y + 170, 'YOU', 34, '900', '#e9c8ff', DISPLAY_FONT).setStroke('#000000', 6);
    this.info = text(this, VW / 2, 1255, '', 30, '800', '#ffffff').setDepth(8);
    const dealer = new Dealer(this, 'war');
    this.time.delayedCall(600, () => dealer.say('hello'));
    this.board = new BetBoard(this, SPOTS, () => this.updateInfo());
    this.betting();
    (globalThis as Record<string, unknown>).__war = {
      busy: () => this.busy,
      atWar: () => this.atWar,
      bet: (id: string, amount: number) => this.board.add(id, amount),
      deal: () => this.deal(),
      war: () => this.goToWar(),
    };
  }

  private updateInfo(): void {
    this.info.setText(this.board.bets.bet ? `Bet ${fmt(this.board.bets.bet)}${this.board.bets.tie ? ` · Tie ${fmt(this.board.bets.tie)}` : ''}` : 'Tap chips, then tap BET');
  }

  private clearControls(): void {
    this.controls.forEach((c) => c.destroy());
    this.controls = [];
  }

  private draw(): Card {
    if (this.deck.length < 20) this.deck = shuffle(newDeck(6));
    return this.deck.pop()!;
  }

  private betting(): void {
    this.busy = false;
    this.atWar = false;
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
    if (!this.board.bets.bet) {
      audio.invalid();
      this.info.setText('Place a bet on BET first');
      return;
    }
    if (!this.board.pay(this.refresh)) return;
    this.busy = true;
    audio.unlock();
    this.clearControls();
    this.board.hidePicker();
    this.sprites.forEach((s) => s.destroy());
    this.sprites = [];
    const p = this.draw();
    const d = this.draw();
    this.sprites.push(dealCard(this, SHOE, VW / 2, PLAYER_Y, p, 0, 1.1), dealCard(this, SHOE, VW / 2, DEALER_Y, d, 300, 1.1));
    this.time.delayedCall(1100, () => {
      const bet = this.board.bets.bet!;
      const tieBet = this.board.bets.tie ?? 0;
      const r = settleFirst(p, d, bet, tieBet);
      if (!r.tie) {
        const win = r.back > 0;
        banner(this, win ? 'YOU WIN' : 'DEALER WINS', '', win ? '#7dffb0' : undefined);
        if (win) this.board.flash(['bet']);
        payout(this, r.back, bet + tieBet, this.refresh, { x: VW / 2, y: 1300 });
        this.info.setText(win ? `You win ${fmt(r.back - bet - tieBet)}` : 'Next hand');
        return this.next();
      }
      // tie: the tie bet pays now; then war or surrender
      if (r.back > 0) {
        payout(this, r.back, 0, this.refresh, { x: 290, y: 1390 });
        this.board.flash(['tie']);
      }
      banner(this, "IT'S A TIE!", 'Go to war, or surrender half', '#ffd75e');
      this.atWar = true;
      this.busy = false;
      this.info.setText(`War costs another ${fmt(bet)} · surrender returns ${fmt(surrender(bet))}`);
      this.controls.push(
        ...bottomButtons(this, 1840, { label: 'Surrender', fn: () => this.surrender() }, { label: 'Go to war', fn: () => this.goToWar() }),
      );
    });
  }

  private surrender(): void {
    if (!this.atWar || this.busy) return;
    const bet = this.board.bets.bet!;
    this.clearControls();
    this.busy = true;
    payout(this, surrender(bet), bet, this.refresh, { x: VW / 2, y: 1300 });
    this.info.setText(`Surrendered · ${fmt(surrender(bet))} back`);
    audio.fold();
    this.next();
  }

  private goToWar(): void {
    if (!this.atWar || this.busy) return;
    const bet = this.board.bets.bet!;
    if (!wallet.spend(bet)) return outOfCoins(this, this.refresh);
    this.refresh();
    this.busy = true;
    this.clearControls();
    audio.chips(5);
    this.board.bets.bet = bet * 2;
    this.board.draw();
    // burn three, then one card each beside the first ones
    for (let k = 0; k < 3; k++) {
      const burn = dealCard(this, SHOE, 140 + k * 26, 760, null, k * 160, 0.6);
      this.sprites.push(burn);
    }
    const p = this.draw();
    const d = this.draw();
    this.sprites.forEach((s, i) => i < 2 && this.tweens.add({ targets: s, x: s.x - 170, duration: 300 }));
    this.sprites.push(dealCard(this, SHOE, VW / 2 + 170, PLAYER_Y, p, 700, 1.1), dealCard(this, SHOE, VW / 2 + 170, DEALER_Y, d, 1000, 1.1));
    this.time.delayedCall(1900, () => {
      const back = settleWar(p, d, bet);
      const win = back > 0;
      banner(this, win ? 'YOU WIN THE WAR' : 'DEALER WINS THE WAR', '', win ? '#7dffb0' : undefined);
      if (win) this.board.flash(['bet']);
      payout(this, back, bet * 2, this.refresh, { x: VW / 2, y: 1300 });
      this.info.setText(win ? `You win ${fmt(back - bet * 2)} · original bet pushes` : 'Next hand');
      this.atWar = false;
      this.next();
    });
  }

  private next(): void {
    this.time.delayedCall(2300, () => {
      this.board.bets = {};
      this.board.draw();
      this.betting();
    });
  }
}
