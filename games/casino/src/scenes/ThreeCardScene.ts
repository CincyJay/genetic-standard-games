import Phaser from 'phaser';
import { newDeck, shuffle, type Card } from '../logic/cards.ts';
import { ANTE_BONUS, PAIR_PLUS, rank3, settleThreeCard } from '../logic/threecard.ts';
import { DISPLAY_FONT, audio, fmt, wallet } from '../services.ts';
import { VW, backdrop, banner, coinBar, dealCard, flipCard, frame, outOfCoins, text } from '../ui/common.ts';
import { BetBoard, bottomButtons, payout, type Spot } from '../ui/tablekit.ts';
import { Dealer } from '../ui/dealer.ts';

const DEALER_Y = 470;
const PLAYER_Y = 1060;
const FROM = { x: 540, y: 160 };

const SPOTS: Spot[] = [
  { id: 'pairPlus', x: 270, y: 1390, r: 88, label: 'PAIR PLUS', pays: 'up to 40 to 1' },
  { id: 'ante', x: 540, y: 1390, r: 100, label: 'ANTE', pays: '1 to 1 + bonus', color: 0x1a5ac8 },
  { id: 'play', x: 810, y: 1390, r: 88, label: 'PLAY', pays: '1 to 1' },
];

/** Three Card Poker: ante (then play or fold) and the Pair Plus side bet. */
export class ThreeCardScene extends Phaser.Scene {
  private board!: BetBoard;
  private refresh!: () => void;
  private sprites: Phaser.GameObjects.Image[] = [];
  private controls: Phaser.GameObjects.GameObject[] = [];
  private info!: Phaser.GameObjects.Text;
  private handText!: Phaser.GameObjects.Text;
  private dealerText!: Phaser.GameObjects.Text;
  private hand: { player: Card[]; dealer: Card[] } | null = null;
  private busy = false;

  constructor() {
    super('threecard');
  }

  create(): void {
    frame(this);
    backdrop(this, 'table-threecard');
    this.refresh = coinBar(this, 'Three Card Poker', () => {
      if (!this.busy && !this.hand) this.scene.start('room', { room: 'tables' });
    });
    this.sprites = [];
    this.hand = null;
    this.busy = false;
    text(this, VW / 2, DEALER_Y - 150, 'DEALER', 34, '900', '#cbd6ff', DISPLAY_FONT).setStroke('#000000', 6);
    this.dealerText = text(this, VW / 2, DEALER_Y + 150, '', 34, '800', '#ffffff').setDepth(8);
    this.handText = text(this, VW / 2, PLAYER_Y + 150, '', 40, '900', '#ffe14a').setDepth(8).setStroke('#000000', 6);
    this.info = text(this, VW / 2, 1255, '', 28, '800', '#ffffff').setDepth(8);
    const dealer = new Dealer(this, 'threecard');
    this.time.delayedCall(600, () => dealer.greet());
    this.board = new BetBoard(this, SPOTS, () => this.updateInfo());
    // the Play spot only takes chips when you decide to play
    this.board.add = ((orig) => (id: string, amount?: number) => (id === 'play' ? audio.invalid() : orig(id, amount)))(this.board.add.bind(this.board));
    this.betting();
    (globalThis as Record<string, unknown>).__threecard = {
      busy: () => this.busy,
      bet: (id: string, amount: number) => this.board.add(id, amount),
      deal: () => this.deal(),
      play: () => this.decide(true),
    };
  }

  private updateInfo(): void {
    const b = this.board.bets;
    this.info.setText(b.ante ? `Ante ${fmt(b.ante)}${b.pairPlus ? ` · Pair Plus ${fmt(b.pairPlus)}` : ''}` : 'Bet the Ante (and Pair Plus if you like), then Deal');
  }

  private clearControls(): void {
    this.controls.forEach((c) => c.destroy());
    this.controls = [];
  }

  private betting(): void {
    this.busy = false;
    this.hand = null;
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
    if (!this.board.bets.ante) {
      audio.invalid();
      this.info.setText('Place an Ante bet first');
      return;
    }
    // keep enough back to be able to play the hand
    if (wallet.coins < this.board.total + this.board.bets.ante) {
      this.info.setText(`Keep ${fmt(this.board.bets.ante)} back to play the hand`);
      return outOfCoins(this, this.refresh);
    }
    if (!this.board.pay(this.refresh)) return;
    this.busy = true;
    audio.unlock();
    this.clearControls();
    this.board.hidePicker();
    this.sprites.forEach((s) => s.destroy());
    this.sprites = [];
    this.handText.setText('');
    this.dealerText.setText('');
    const deck = shuffle(newDeck(1));
    const player = [deck.pop()!, deck.pop()!, deck.pop()!];
    const dealer = [deck.pop()!, deck.pop()!, deck.pop()!];
    this.hand = { player, dealer };
    for (let k = 0; k < 3; k++) {
      this.sprites.push(dealCard(this, FROM, VW / 2 + (k - 1) * 200, PLAYER_Y, player[k]!, k * 320, 1));
      this.sprites.push(dealCard(this, FROM, VW / 2 + (k - 1) * 150, DEALER_Y, null, k * 320 + 160, 0.8));
    }
    this.time.delayedCall(1300, () => {
      const r = rank3(player);
      this.handText.setText(r.name);
      if (PAIR_PLUS[r.category]) this.board.flash(['pairPlus']);
      this.busy = false;
      this.controls.push(
        ...bottomButtons(this, 1840, { label: 'Fold', fn: () => this.decide(false) }, { label: `Play ${fmt(this.board.bets.ante!)}`, fn: () => this.decide(true) }),
      );
      this.info.setText(ANTE_BONUS[r.category] ? `Ante bonus ${ANTE_BONUS[r.category]} to 1 is yours whatever the dealer has` : 'Play (match your Ante) or fold');
    });
  }

  private decide(play: boolean): void {
    if (!this.hand || this.busy) return;
    const ante = this.board.bets.ante!;
    if (play) {
      if (!wallet.spend(ante)) return outOfCoins(this, this.refresh);
      this.board.bets.play = ante;
      this.board.draw();
      audio.chips(4);
      this.refresh();
    } else audio.fold();
    this.busy = true;
    this.clearControls();
    const { player, dealer } = this.hand;
    // reveal the dealer
    const dealerSprites = this.sprites.filter((_, i) => i % 2 === 1);
    dealerSprites.forEach((s, k) => flipCard(this, s, dealer[k]!, 200 + k * 220));
    this.time.delayedCall(1100, () => {
      const res = settleThreeCard(player, dealer, ante, this.board.bets.pairPlus ?? 0, play);
      const dq = res.dealer.category > 0 || res.dealer.kickers[0]! >= 12;
      this.dealerText.setText(`${res.dealer.name}${dq ? '' : ' · does not qualify'}`);
      const staked = ante + (this.board.bets.pairPlus ?? 0) + (play ? ante : 0);
      const titles = { fold: 'FOLDED', 'no-qualify': 'DEALER DOESN\'T QUALIFY', win: 'YOU WIN', lose: 'DEALER WINS', push: 'PUSH' } as const;
      banner(this, titles[res.outcome], res.outcome === 'fold' ? '' : `${res.player.name} vs ${res.dealer.name}`, res.outcome === 'win' || res.outcome === 'no-qualify' ? '#7dffb0' : undefined);
      const won: string[] = [];
      if (res.outcome === 'win') won.push('ante', 'play');
      if (res.outcome === 'no-qualify') won.push('ante');
      this.board.flash(won);
      payout(this, res.back, staked, this.refresh, { x: VW / 2, y: 1300 });
      this.info.setText(res.back > staked ? `You win ${fmt(res.back - staked)}` : res.back === staked ? 'Push' : 'Next hand');
      this.time.delayedCall(2600, () => {
        this.board.bets = {};
        this.board.draw();
        this.betting();
      });
    });
  }
}
