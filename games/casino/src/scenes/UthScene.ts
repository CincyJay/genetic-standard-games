import Phaser from 'phaser';
import { newDeck, shuffle, type Card } from '../logic/cards.ts';
import { bestHand } from '../logic/poker.ts';
import { settleUth } from '../logic/uth.ts';
import { DISPLAY_FONT, audio, fmt, wallet } from '../services.ts';
import { VW, backdrop, banner, coinBar, dealCard, flipCard, frame, outOfCoins, text } from '../ui/common.ts';
import { Dealer } from '../ui/dealer.ts';
import { BetBoard, bottomButtons, payout, type Spot } from '../ui/tablekit.ts';

const DEALER_Y = 450;
const BOARD_Y = 720;
const PLAYER_Y = 1060;
const FROM = { x: 540, y: 160 };

const SPOTS: Spot[] = [
  { id: 'trips', x: 175, y: 1390, r: 74, label: 'TRIPS', pays: 'up to 50 to 1' },
  { id: 'ante', x: 415, y: 1390, r: 86, label: 'ANTE', pays: '1 to 1', color: 0x1a5ac8 },
  { id: 'blind', x: 665, y: 1390, r: 86, label: 'BLIND', pays: 'straight+ pays' },
  { id: 'play', x: 905, y: 1390, r: 74, label: 'PLAY', pays: '1 to 1' },
];

type Street = 'pre' | 'flop' | 'river';

/** Ultimate Texas Hold'em: Ante + Blind (+ Trips), then one Play bet: 4x/3x preflop, 2x on the flop, 1x at the river. */
export class UthScene extends Phaser.Scene {
  private board!: BetBoard;
  private refresh!: () => void;
  private sprites: { dealer: Phaser.GameObjects.Image[]; board: Phaser.GameObjects.Image[]; mine: Phaser.GameObjects.Image[] } = { dealer: [], board: [], mine: [] };
  private controls: Phaser.GameObjects.GameObject[] = [];
  private info!: Phaser.GameObjects.Text;
  private handText!: Phaser.GameObjects.Text;
  private dealerText!: Phaser.GameObjects.Text;
  private hand: { hole: Card[]; dealer: Card[]; board: Card[] } | null = null;
  private shown = 0;
  private busy = false;

  constructor() {
    super('uth');
  }

  create(): void {
    frame(this);
    backdrop(this, 'table-uth');
    this.refresh = coinBar(this, "Ultimate Hold'em", () => {
      if (!this.busy && !this.hand) this.scene.start('room', { room: 'tables' });
    }, 'uth');
    const dealer = new Dealer(this, 'uth');
    this.time.delayedCall(600, () => dealer.greet());
    this.sprites = { dealer: [], board: [], mine: [] };
    this.hand = null;
    this.busy = false;
    this.dealerText = text(this, VW / 2, DEALER_Y + 130, '', 30, '800', '#ffffff').setDepth(8);
    this.handText = text(this, VW / 2, PLAYER_Y + 150, '', 40, '900', '#ffe14a').setDepth(8).setStroke('#000000', 6);
    this.info = text(this, VW / 2, 1270, '', 28, '800', '#ffffff').setDepth(8);
    text(this, VW / 2, PLAYER_Y - 150, 'YOU', 26, '900', '#cbd6ff', DISPLAY_FONT).setDepth(2);
    this.board = new BetBoard(this, SPOTS, () => this.updateInfo());
    // Ante and Blind always match; Play only takes chips when you bet
    const orig = this.board.add.bind(this.board);
    this.board.add = (id: string, amount?: number) => {
      if (id === 'play') return audio.invalid();
      if (id === 'ante' || id === 'blind') {
        const a = amount ?? this.board.chip;
        if ((this.board.bets.ante ?? 0) + a > 10_000 || this.board.total + a * 2 > wallet.coins) return audio.invalid();
        orig('ante', a);
        orig('blind', a);
        return;
      }
      orig(id, amount);
    };
    this.betting();
    (globalThis as Record<string, unknown>).__uth = {
      busy: () => this.busy,
      street: () => this.street(),
      bet: (id: string, amount: number) => this.board.add(id, amount),
      deal: () => this.deal(),
      act: (mult: number) => (mult ? this.play(mult) : this.check()),
    };
  }

  private street(): Street | null {
    if (!this.hand) return null;
    return this.shown === 0 ? 'pre' : this.shown === 3 ? 'flop' : 'river';
  }

  private updateInfo(): void {
    const b = this.board.bets;
    this.info.setText(b.ante ? `Ante ${fmt(b.ante)} + Blind ${fmt(b.blind ?? 0)}${b.trips ? ` · Trips ${fmt(b.trips)}` : ''}` : 'Bet the Ante (the Blind matches it), Trips optional');
  }

  private clearControls(): void {
    this.controls.forEach((c) => c.destroy());
    this.controls = [];
  }

  private betting(): void {
    this.busy = false;
    this.hand = null;
    this.shown = 0;
    this.board.locked = false;
    this.clearControls();
    this.board.showPicker(1690);
    const hasLast = Object.keys(this.board.last).length > 0;
    this.controls.push(
      ...bottomButtons(this, 1840, { label: 'Clear', fn: () => this.board.clear() }, { label: 'Deal', fn: () => this.deal() }, hasLast ? { label: 'Rebet', fn: () => this.rebet() } : undefined),
    );
    this.updateInfo();
  }

  private rebet(): void {
    const last = { ...this.board.last };
    delete last.play;
    this.board.last = last;
    this.board.rebet();
  }

  private deal(): void {
    if (this.busy) return;
    const ante = this.board.bets.ante ?? 0;
    if (!ante) {
      audio.invalid();
      this.info.setText('Place an Ante bet first');
      return;
    }
    if (wallet.coins < this.board.total + ante) {
      this.info.setText(`Keep at least ${fmt(ante)} back for your Play bet`);
      return outOfCoins(this, this.refresh);
    }
    if (!this.board.pay(this.refresh)) return;
    this.busy = true;
    audio.unlock();
    this.clearControls();
    this.board.hidePicker();
    [...this.sprites.dealer, ...this.sprites.board, ...this.sprites.mine].forEach((s) => s.destroy());
    this.sprites = { dealer: [], board: [], mine: [] };
    this.handText.setText('');
    this.dealerText.setText('');
    const deck = shuffle(newDeck(1));
    const hole = [deck.pop()!, deck.pop()!];
    const dealer = [deck.pop()!, deck.pop()!];
    const board = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];
    this.hand = { hole, dealer, board };
    this.shown = 0;
    hole.forEach((c, k) => this.sprites.mine.push(dealCard(this, FROM, VW / 2 + (k - 0.5) * 190, PLAYER_Y, c, k * 300, 1.05)));
    for (let k = 0; k < 2; k++) this.sprites.dealer.push(dealCard(this, FROM, VW / 2 + (k - 0.5) * 140, DEALER_Y, null, 150 + k * 300, 0.75));
    for (let k = 0; k < 5; k++) this.sprites.board.push(dealCard(this, FROM, VW / 2 + (k - 2) * 150, BOARD_Y, null, 700 + k * 90, 0.82));
    this.time.delayedCall(1400, () => this.decision());
  }

  /** Buttons for the current street. */
  private decision(): void {
    this.busy = false;
    this.clearControls();
    const st = this.street();
    const ante = this.board.bets.ante!;
    const h = this.hand!;
    const cards = [...h.hole, ...h.board.slice(0, this.shown)];
    this.handText.setText(cards.length >= 5 ? bestHand(cards).name : h.hole[0]!.rank === h.hole[1]!.rank ? 'Pocket pair' : '');
    if (st === 'pre') {
      this.info.setText('Bet 4x or 3x now, or check and see the flop');
      this.controls.push(...bottomButtons(this, 1840, { label: 'Check', fn: () => this.check() }, { label: `Bet 4x ${fmt(ante * 4)}`, fn: () => this.play(4) }, { label: '3x', fn: () => this.play(3) }));
    } else if (st === 'flop') {
      this.info.setText('Bet 2x now, or check to the river');
      this.controls.push(...bottomButtons(this, 1840, { label: 'Check', fn: () => this.check() }, { label: `Bet 2x ${fmt(ante * 2)}`, fn: () => this.play(2) }));
    } else {
      this.info.setText('Last chance: bet 1x or fold');
      this.controls.push(...bottomButtons(this, 1840, { label: 'Fold', fn: () => this.finish(0) }, { label: `Bet 1x ${fmt(ante)}`, fn: () => this.play(1) }));
    }
  }

  private reveal(upTo: number, delay = 0): number {
    const h = this.hand!;
    let d = delay;
    for (let k = this.shown; k < upTo; k++) {
      flipCard(this, this.sprites.board[k]!, h.board[k]!, d);
      d += 180;
    }
    this.shown = upTo;
    return d;
  }

  private check(): void {
    if (this.busy || !this.hand) return;
    this.busy = true;
    this.clearControls();
    audio.knock();
    const d = this.reveal(this.shown === 0 ? 3 : 5);
    this.time.delayedCall(d + 500, () => this.decision());
  }

  private play(mult: number): void {
    if (this.busy || !this.hand) return;
    const amount = this.board.bets.ante! * mult;
    if (!wallet.spend(amount)) return outOfCoins(this, this.refresh);
    this.refresh();
    this.board.bets.play = amount;
    this.board.draw();
    audio.chips(5);
    this.finish(amount);
  }

  private finish(play: number): void {
    if (!this.hand) return;
    this.busy = true;
    this.clearControls();
    if (!play) audio.fold();
    const h = this.hand;
    let d = this.reveal(5);
    this.sprites.dealer.forEach((s, k) => flipCard(this, s, h.dealer[k]!, d + k * 200));
    d += 700;
    this.time.delayedCall(d, () => {
      const b = this.board.bets;
      const res = settleUth(h.hole, h.dealer, h.board, b.ante!, b.trips ?? 0, play);
      this.handText.setText(res.player.name);
      this.dealerText.setText(`Dealer: ${res.dealer.name}${res.dealerOpens ? '' : ' · does not open'}`);
      const staked = b.ante! * 2 + (b.trips ?? 0) + play;
      const titles = { fold: 'FOLDED', win: 'YOU WIN', lose: 'DEALER WINS', push: 'PUSH' } as const;
      banner(this, titles[res.outcome], res.outcome === 'fold' ? '' : `${res.player.name} vs ${res.dealer.name}`, res.outcome === 'win' ? '#7dffb0' : undefined);
      const won: string[] = [];
      if (res.outcome === 'win') won.push('ante', 'play', 'blind');
      if (res.tripsPaid) won.push('trips');
      this.board.flash(won);
      payout(this, res.back, staked, this.refresh, { x: VW / 2, y: 1300 });
      this.info.setText(res.back > staked ? `You win ${fmt(res.back - staked)}` : res.back === staked ? 'Push' : 'Next hand');
      this.time.delayedCall(2800, () => {
        this.board.bets = {};
        this.board.draw();
        this.betting();
      });
    });
  }
}
