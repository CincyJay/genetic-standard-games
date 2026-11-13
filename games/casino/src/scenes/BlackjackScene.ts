import Phaser from 'phaser';
import { BlackjackRound, Shoe, handTotal, type PlayerHand } from '../logic/blackjack.ts';
import { DISPLAY_FONT, GOLD, SECONDARY, THEME, analytics, audio, fmt, haptics, wallet } from '../services.ts';
import { CARD_H, CARD_W, banner, chipPicker, coinBar, coinShower, dealCard, flipCard, makeButton, outOfCoins, text } from '../ui/common.ts';
import { VH, VW, backdrop, frame, screenDim } from '../ui/common.ts';

const SHOE = { x: 940, y: 330 };
const DEALER_Y = 470;
const PLAYER_Y = 1130;
const BET_Y = 1430;
const CHIPS = [10, 50, 100, 500, 1000, 5000];

export class BlackjackScene extends Phaser.Scene {
  private shoe = new Shoe(6);
  private round: BlackjackRound | null = null;
  private bet = 100;
  private chip = 100;
  private refresh!: () => void;
  private dealerSprites: Phaser.GameObjects.Image[] = [];
  private handSprites: Phaser.GameObjects.Image[][] = [];
  private labels: Phaser.GameObjects.GameObject[] = [];
  private controls: Phaser.GameObjects.GameObject[] = [];
  private betText!: Phaser.GameObjects.Text;
  private betChips: Phaser.GameObjects.Image[] = [];
  private busy = false;

  constructor() {
    super('blackjack');
  }

  create(): void {
    const w = VW;
    const h = VH;
    frame(this);
    backdrop(this, 'bg-felt');
    this.refresh = coinBar(this, 'Blackjack', () => this.scene.start('lobby'));
    // table printing
    text(this, w / 2, 760, 'BLACKJACK PAYS 3 TO 2', 44, '700', 'rgba(233,200,106,0.7)', DISPLAY_FONT);
    text(this, w / 2, 818, 'Dealer stands on all 17s', 32, '500', 'rgba(255,244,220,0.5)');
    const arc = this.add.graphics();
    arc.lineStyle(4, 0xe9c86a, 0.35);
    arc.beginPath();
    arc.arc(w / 2, 300, 620, Phaser.Math.DegToRad(52), Phaser.Math.DegToRad(128));
    arc.strokePath();
    // shoe
    for (let k = 0; k < 4; k++) this.add.image(SHOE.x + k * 3, SHOE.y - k * 3, 'card-back').setDisplaySize(CARD_W * 0.8, CARD_H * 0.8).setAngle(12);
    // bet circle
    const ring = this.add.graphics();
    ring.lineStyle(5, 0xe9c86a, 0.7);
    ring.strokeCircle(w / 2, BET_Y, 92);
    this.betText = text(this, w / 2, BET_Y + 130, '', 40, '800', '#ffffff');
    this.bettingPhase();
    (globalThis as Record<string, unknown>).__bj = {
      phase: () => (this.busy ? 'busy' : (this.round?.phase ?? 'betting')),
      stand: () => this.act('stand'),
    };
  }

  // ------------------------------------------------------------- betting
  private clearControls(): void {
    for (const c of this.controls) c.destroy();
    this.controls = [];
  }

  private showBet(): void {
    for (const c of this.betChips) c.destroy();
    this.betChips = [];
    // stack chips representing the bet, largest first
    let rest = this.bet;
    let k = 0;
    for (const v of [...CHIPS].reverse()) {
      while (rest >= v && k < 8) {
        this.betChips.push(this.add.image(VW / 2, BET_Y - k * 10, `chip-${v}`).setDisplaySize(130, 130).setDepth(5));
        rest -= v;
        k++;
      }
    }
    this.betText.setText(this.bet > 0 ? `Bet ${fmt(this.bet)}` : 'Tap chips to bet');
  }

  private bettingPhase(): void {
    this.busy = false;
    this.clearControls();
    this.showBet();
    const w = VW;
    this.controls.push(
      ...chipPicker(this, 1660, CHIPS, this.chip, (v) => {
        this.chip = v;
        this.bet = Math.min(this.bet + v, 50_000);
        this.showBet();
      }),
    );
    this.controls.push(
      makeButton(this, w / 2 - 250, 1820, 'Clear', () => {
        audio.tap();
        this.bet = 0;
        this.showBet();
      }, { width: 300, height: 110, fontSize: 42, ...SECONDARY, theme: THEME }),
      makeButton(this, w / 2 + 170, 1820, 'Deal', () => this.deal(), { width: 440, height: 120, fontSize: 52, theme: THEME }),
    );
  }

  private deal(): void {
    if (this.busy || this.bet <= 0) return;
    if (!wallet.spend(this.bet)) return outOfCoins(this, this.refresh);
    this.refresh();
    audio.unlock();
    this.busy = true;
    this.clearControls();
    if (this.shoe.needsShuffle) {
      this.shoe.reshuffle();
      banner(this, 'Shuffling', '', '#ffffff');
    }
    this.round = new BlackjackRound(this.shoe, this.bet);
    analytics.track('level_start', { level: 0, attempt: 1 });
    const r = this.round;
    const h = r.hands[0]!;
    this.handSprites = [[]];
    this.dealerSprites = [];
    // classic deal order: player, dealer (up), player, dealer (hole)
    this.handSprites[0]!.push(dealCard(this, SHOE, this.cardX(0, 0, 2), PLAYER_Y, h.cards[0]!, 0));
    this.dealerSprites.push(dealCard(this, SHOE, this.dealerX(0, 2), DEALER_Y, r.dealer[0]!, 250));
    this.handSprites[0]!.push(dealCard(this, SHOE, this.cardX(0, 1, 2), PLAYER_Y, h.cards[1]!, 500));
    this.dealerSprites.push(dealCard(this, SHOE, this.dealerX(1, 2), DEALER_Y, null, 750));
    this.time.delayedCall(1150, () => {
      this.busy = false;
      this.updateLabels();
      if (r.phase === 'settled') this.finish();
      else this.actionControls();
    });
  }

  // ---------------------------------------------------------- positions
  private handCenter(i: number): number {
    const n = this.round?.hands.length ?? 1;
    const w = VW;
    return n === 1 ? w / 2 : i === 0 ? w * 0.28 : w * 0.72;
  }
  private cardX(hand: number, j: number, n: number): number {
    return this.handCenter(hand) + (j - (n - 1) / 2) * 62;
  }
  private dealerX(j: number, n: number): number {
    return VW / 2 + (j - (n - 1) / 2) * 70;
  }

  // ------------------------------------------------------------ playing
  private actionControls(): void {
    this.clearControls();
    const r = this.round!;
    if (r.phase !== 'player') return;
    const w = VW;
    const y = 1700;
    const btns: [string, () => void, object][] = [
      ['Hit', () => this.act('hit'), {}],
      ['Stand', () => this.act('stand'), SECONDARY],
    ];
    if (r.canDouble()) btns.push(['Double', () => this.act('double'), { color: 0x0f8a7a, shadow: 0x075046, textColor: '#ffffff' }]);
    if (r.canSplit()) btns.push(['Split', () => this.act('split'), { color: 0x6b2fb3, shadow: 0x3a1566, textColor: '#ffffff' }]);
    const bw = btns.length > 2 ? 230 : 380;
    btns.forEach(([label, fn, style], i) => {
      const x = w / 2 + (i - (btns.length - 1) / 2) * (bw + 20);
      this.controls.push(makeButton(this, x, y, label, fn, { width: bw, height: 130, fontSize: 46, theme: THEME, ...style }));
    });
    this.updateLabels();
  }

  private act(kind: 'hit' | 'stand' | 'double' | 'split'): void {
    if (this.busy) return;
    const r = this.round!;
    if (kind === 'double' || kind === 'split') {
      if (!wallet.spend(r.hand.bet)) return outOfCoins(this, this.refresh);
      this.refresh();
    }
    audio.tap();
    haptics.fire('light');
    const before = r.hands.map((h) => h.cards.length);
    const handsBefore = r.hands.length;
    if (kind === 'hit') r.hit();
    else if (kind === 'stand') r.stand();
    else if (kind === 'double') r.double();
    else r.split();
    this.busy = true;
    this.clearControls();
    let delay = 0;
    if (r.hands.length !== handsBefore) {
      // split: move the second card into its own hand
      const moved = this.handSprites[0]!.pop()!;
      this.handSprites.push([moved]);
      r.hands.forEach((hh, hi) => {
        this.handSprites[hi]!.forEach((s, j) => this.tweens.add({ targets: s, x: this.cardX(hi, j, hh.cards.length), duration: 250 }));
      });
      before[0] = 1;
      before[1] = 1;
      delay = 300;
    }
    r.hands.forEach((hh, hi) => {
      for (let j = before[hi] ?? 0; j < hh.cards.length; j++) {
        // re-space existing cards, deal the new one
        this.handSprites[hi]!.forEach((s, k) => this.tweens.add({ targets: s, x: this.cardX(hi, k, hh.cards.length), duration: 200 }));
        this.handSprites[hi]!.push(dealCard(this, SHOE, this.cardX(hi, j, hh.cards.length), PLAYER_Y + (hh.doubled ? 0 : 0), hh.cards[j]!, delay));
        if (hh.doubled) this.handSprites[hi]![j]!.setAngle(90);
        delay += 280;
      }
    });
    this.time.delayedCall(delay + 350, () => {
      this.busy = false;
      this.updateLabels();
      if (r.phase === 'settled') this.finish();
      else this.actionControls();
    });
  }

  private updateLabels(): void {
    for (const l of this.labels) l.destroy();
    this.labels = [];
    const r = this.round;
    if (!r) return;
    r.hands.forEach((hh, i) => {
      const t = handTotal(hh.cards);
      const label = t.total > 21 ? 'Bust' : t.soft && t.total < 21 ? `${t.total - 10} / ${t.total}` : String(t.total);
      const y = PLAYER_Y + CARD_H / 2 + 50;
      this.labels.push(this.badge(this.handCenter(i), y, label, r.phase === 'player' && r.active === i && r.hands.length > 1));
    });
    if (r.phase === 'settled') {
      const d = handTotal(r.dealer).total;
      this.labels.push(this.badge(VW / 2, DEALER_Y - CARD_H / 2 - 50, d > 21 ? 'Bust' : String(d), false));
    }
  }

  private badge(x: number, y: number, label: string, active: boolean): Phaser.GameObjects.Container {
    const t = text(this, 0, 0, label, 40, '800', active ? '#3a1a00' : '#ffffff');
    const g = this.add.graphics();
    const bw = Math.max(110, t.width + 50);
    g.fillStyle(active ? 0xe9b949 : 0x000000, active ? 1 : 0.55);
    g.fillRoundedRect(-bw / 2, -34, bw, 68, 34);
    return this.add.container(x, y, [g, t]).setDepth(20);
  }

  // -------------------------------------------------------------- result
  private finish(): void {
    const r = this.round!;
    this.busy = true;
    // reveal the hole card, then draw the dealer's extra cards one by one
    flipCard(this, this.dealerSprites[1]!, r.dealer[1]!);
    let delay = 450;
    const n = r.dealer.length;
    this.dealerSprites.forEach((s, j) => this.tweens.add({ targets: s, x: this.dealerX(j, n), duration: 200 }));
    for (let j = 2; j < n; j++) {
      this.dealerSprites.push(dealCard(this, SHOE, this.dealerX(j, n), DEALER_Y, r.dealer[j]!, delay));
      delay += 500;
    }
    this.time.delayedCall(delay + 300, () => this.settleUi());
  }

  private settleUi(): void {
    const r = this.round!;
    this.updateLabels();
    const payout = r.totalPayout;
    const staked = r.hands.reduce((s, h) => s + h.bet, 0);
    wallet.add(payout);
    this.refresh();
    r.hands.forEach((hh, i) => this.resultTag(hh, i));
    const net = payout - staked;
    if (r.hands.some((h) => h.result === 'blackjack')) {
      banner(this, 'Blackjack!', `+${fmt(net)}`);
      audio.win();
    } else if (net > 0) {
      banner(this, 'You win', `+${fmt(net)}`);
      audio.complete();
    } else if (net === 0) {
      banner(this, 'Push', '', '#ffffff');
    } else {
      audio.invalid();
    }
    if (net > 0) {
      haptics.fire('success');
      coinShower(this, VW / 2, PLAYER_Y, net);
      wallet.recordWin(net);
    }
    this.time.delayedCall(2200, () => this.clearTable());
  }

  private resultTag(hh: PlayerHand, i: number): void {
    const map = { blackjack: ['BLACKJACK', GOLD], win: ['WIN', '#5dff9a'], push: ['PUSH', '#ffffff'], lose: ['LOSE', '#ff6b7a'] } as const;
    const [label, color] = map[hh.result!];
    const t = text(this, this.handCenter(i), PLAYER_Y - CARD_H / 2 - 50, label, 48, '900', color).setStroke('#0a1f14', 10).setDepth(25);
    this.labels.push(t);
  }

  private clearTable(): void {
    const all = [...this.dealerSprites, ...this.handSprites.flat()];
    this.tweens.add({ targets: all, x: -200, y: 300, angle: -30, duration: 350, ease: 'Cubic.easeIn', onComplete: () => all.forEach((s) => s.destroy()) });
    for (const l of this.labels) l.destroy();
    this.labels = [];
    this.round = null;
    this.time.delayedCall(380, () => this.bettingPhase());
  }
}

