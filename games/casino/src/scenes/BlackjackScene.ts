import Phaser from 'phaser';
import { makeButton as mkBtn } from '@tgs/kit';
import { BlackjackRound, Shoe, handTotal, type PlayerHand } from '../logic/blackjack.ts';
import { PAIR_PAYS, SIDE_NAMES, THREE_PAYS, perfectPairs, twentyOnePlusThree } from '../logic/sidebets.ts';
import { DISPLAY_FONT, GOLD, SECONDARY, THEME, analytics, audio, fmt, haptics, player, wallet } from '../services.ts';
import { CARD_H, CARD_W, VW, backdrop, banner, chipPicker, coinBar, coinShower, dealCard, flipCard, frame, makeButton, outOfCoins, text } from '../ui/common.ts';

const SHOE = { x: 940, y: 330 };
const DEALER_Y = 470;
const PLAYER_Y = 1120;
const BET_Y = 1420;
const CHIPS = [10, 50, 100, 500, 1000, 5000];
/** Column centers for 1, 2 or 3 betting spots. */
const COLUMNS: Record<number, number[]> = { 1: [540], 2: [300, 780], 3: [190, 540, 890] };
const SCALE: Record<number, number> = { 1: 1, 2: 0.85, 3: 0.7 };

export class BlackjackScene extends Phaser.Scene {
  private shoe = new Shoe(6);
  private round: BlackjackRound | null = null;
  private bet = 100;
  private chip = 100;
  private spots = 1;
  private side21 = false;
  private sidePP = false;
  private refresh!: () => void;
  private dealerSprites: Phaser.GameObjects.Image[] = [];
  private handSprites = new Map<PlayerHand, Phaser.GameObjects.Image[]>();
  private labels: Phaser.GameObjects.GameObject[] = [];
  private controls: Phaser.GameObjects.GameObject[] = [];
  private betLayer!: Phaser.GameObjects.Container;
  private infoText!: Phaser.GameObjects.Text;
  private busy = false;
  private sideWon = 0;
  private sideStaked = 0;

  constructor() {
    super('blackjack');
  }

  private get sideBet(): number {
    return Math.max(10, Math.round(this.bet / 4 / 10) * 10);
  }

  create(): void {
    const w = VW;
    frame(this);
    backdrop(this, 'bg-felt');
    this.refresh = coinBar(this, 'Blackjack', () => this.scene.start('room', { room: 'tables' }));
    text(this, w / 2, 760, 'BLACKJACK PAYS 3 TO 2', 44, '700', 'rgba(233,200,106,0.7)', DISPLAY_FONT);
    text(this, w / 2, 818, 'Dealer stands on all 17s  ·  side bets 21+3 and Perfect Pairs', 28, '500', 'rgba(255,244,220,0.5)');
    const arc = this.add.graphics();
    arc.lineStyle(4, 0xe9c86a, 0.35);
    arc.beginPath();
    arc.arc(w / 2, 300, 620, Phaser.Math.DegToRad(52), Phaser.Math.DegToRad(128));
    arc.strokePath();
    for (let k = 0; k < 4; k++) this.add.image(SHOE.x + k * 3, SHOE.y - k * 3, 'card-back').setDisplaySize(CARD_W * 0.8, CARD_H * 0.8).setAngle(12);
    this.betLayer = this.add.container(0, 0).setDepth(5);
    this.infoText = text(this, w / 2, BET_Y + 120, '', 34, '800', '#ffffff');
    this.bettingPhase();
    (globalThis as Record<string, unknown>).__bj = {
      phase: () => (this.busy ? 'busy' : (this.round?.phase ?? 'betting')),
      stand: () => this.act('stand'),
      setup: (spots: number, s21: boolean, pp: boolean) => {
        this.spots = spots;
        this.side21 = s21;
        this.sidePP = pp;
        this.bettingPhase();
      },
    };
  }

  // ------------------------------------------------------------- betting
  private clearControls(): void {
    for (const c of this.controls) c.destroy();
    this.controls = [];
  }

  private colX(spot: number): number {
    return COLUMNS[this.spots]![spot]!;
  }

  private chipStack(x: number, y: number, amount: number, size: number): void {
    let rest = amount;
    let k = 0;
    for (const v of [...CHIPS].reverse()) {
      while (rest >= v && k < 6) {
        this.betLayer.add(this.add.image(x, y - k * 8, `chip-${v}`).setDisplaySize(size, size));
        rest -= v;
        k++;
      }
    }
  }

  /** Bet circles (and side-bet circles) for each spot, with chips on them. */
  private showBets(): void {
    this.betLayer.removeAll(true);
    const r = Math.round(80 * SCALE[this.spots]!);
    for (let s = 0; s < this.spots; s++) {
      const x = this.colX(s);
      const g = this.add.graphics();
      g.lineStyle(5, 0xe9c86a, 0.7);
      g.strokeCircle(x, BET_Y, r);
      this.betLayer.add(g);
      if (this.bet > 0) this.chipStack(x, BET_Y, this.bet, r * 1.35);
      const sides: [boolean, string, number][] = [
        [this.side21, '21+3', -1],
        [this.sidePP, 'PP', 1],
      ];
      for (const [on, label, dir] of sides) {
        const sx = x + dir * (r + 40);
        const sy = BET_Y - 70;
        const sg = this.add.graphics();
        sg.lineStyle(3, 0xe9c86a, on ? 0.9 : 0.35);
        sg.strokeCircle(sx, sy, 34);
        this.betLayer.add(sg);
        if (on) this.betLayer.add(this.add.image(sx, sy, `chip-${CHIPS.filter((v) => v <= this.sideBet).pop() ?? 10}`).setDisplaySize(56, 56));
        this.betLayer.add(text(this, sx, sy + 52, label, 22, '800', on ? GOLD : 'rgba(233,200,106,0.5)'));
      }
    }
    const total = (this.bet + (this.side21 ? this.sideBet : 0) + (this.sidePP ? this.sideBet : 0)) * this.spots;
    this.infoText.setText(this.bet > 0 ? `${this.spots} hand${this.spots > 1 ? 's' : ''} × ${fmt(this.bet)}${this.side21 || this.sidePP ? ` + side bets` : ''}  ·  total ${fmt(total)}` : 'Tap chips to bet');
  }

  private toggleButton(x: number, y: number, label: string, on: boolean, fn: () => void, w = 200): void {
    this.controls.push(
      mkBtn(this, x, y, label, fn, {
        width: w,
        height: 76,
        fontSize: 30,
        color: on ? 0xe9b949 : 0x24123a,
        shadow: on ? 0xa97a1c : 0x0d0414,
        textColor: on ? '#3a1a00' : '#e9c86a',
        theme: THEME,
      }),
    );
  }

  private bettingPhase(): void {
    this.busy = false;
    this.clearControls();
    this.showBets();
    const w = VW;
    // hands: 1 / 2 / 3, then side-bet toggles
    [1, 2, 3].forEach((n, i) =>
      this.toggleButton(120 + i * 150, 1560, `${n} hand${n > 1 ? 's' : ''}`, this.spots === n, () => {
        audio.tap();
        this.spots = n;
        this.bettingPhase();
      }, 140),
    );
    this.toggleButton(w - 340, 1560, '21+3', this.side21, () => {
      audio.chip();
      this.side21 = !this.side21;
      this.bettingPhase();
    }, 170);
    this.toggleButton(w - 140, 1560, 'Pairs', this.sidePP, () => {
      audio.chip();
      this.sidePP = !this.sidePP;
      this.bettingPhase();
    }, 170);
    this.controls.push(
      ...chipPicker(this, 1690, CHIPS, this.chip, (v) => {
        this.chip = v;
        this.bet = Math.min(this.bet + v, 50_000);
        this.showBets();
      }),
    );
    this.controls.push(
      makeButton(this, w / 2 - 250, 1835, 'Clear', () => {
        audio.tap();
        this.bet = 0;
        this.showBets();
      }, { width: 300, height: 110, fontSize: 42, ...SECONDARY, theme: THEME }),
      makeButton(this, w / 2 + 170, 1835, 'Deal', () => this.deal(), { width: 440, height: 120, fontSize: 52, theme: THEME }),
    );
  }

  private deal(): void {
    if (this.busy || this.bet <= 0) return;
    const sidePer = (this.side21 ? this.sideBet : 0) + (this.sidePP ? this.sideBet : 0);
    const total = (this.bet + sidePer) * this.spots;
    if (!wallet.spend(total)) return outOfCoins(this, this.refresh);
    player.wager(total);
    this.refresh();
    audio.unlock();
    this.busy = true;
    this.clearControls();
    this.sideWon = 0;
    this.sideStaked = sidePer * this.spots;
    if (this.shoe.needsShuffle) {
      this.shoe.reshuffle();
      banner(this, 'Shuffling', '', '#ffffff');
    }
    this.round = new BlackjackRound(this.shoe, new Array(this.spots).fill(this.bet));
    analytics.track('level_start', { level: 0, attempt: 1 });
    const r = this.round;
    this.handSprites = new Map();
    this.dealerSprites = [];
    let d = 0;
    // deal order: each spot, dealer up card, each spot, dealer hole card
    for (let round2 = 0; round2 < 2; round2++) {
      r.hands.forEach((h) => {
        const list = this.handSprites.get(h) ?? [];
        this.handSprites.set(h, list);
        const pos = this.cardPos(h, round2, 2);
        list.push(dealCard(this, SHOE, pos.x, PLAYER_Y, h.cards[round2]!, d, SCALE[this.spots]));
        d += 220;
      });
      this.dealerSprites.push(dealCard(this, SHOE, this.dealerX(round2, 2), DEALER_Y, round2 === 0 ? r.dealer[0]! : null, d));
      d += 220;
    }
    this.time.delayedCall(d + 400, () => {
      this.settleSideBets();
      this.busy = false;
      this.updateLabels();
      if (r.phase === 'settled') this.finish();
      else this.actionControls();
    });
  }

  /** 21+3 and Perfect Pairs are decided by the first two cards (and the dealer's up card). */
  private settleSideBets(): void {
    const r = this.round!;
    if (!this.side21 && !this.sidePP) return;
    r.hands.forEach((h) => {
      const [a, b] = h.cards as [typeof h.cards[0], typeof h.cards[0]];
      const x = this.colX(h.spot);
      const results: string[] = [];
      if (this.side21) {
        const res = twentyOnePlusThree(a!, b!, r.dealer[0]!);
        if (res) {
          const won = this.sideBet * (THREE_PAYS[res] + 1);
          this.sideWon += won;
          results.push(`21+3 ${SIDE_NAMES[res]} +${fmt(won - this.sideBet)}`);
        }
      }
      if (this.sidePP) {
        const res = perfectPairs(a!, b!);
        if (res) {
          const won = this.sideBet * (PAIR_PAYS[res] + 1);
          this.sideWon += won;
          results.push(`${SIDE_NAMES[res]} +${fmt(won - this.sideBet)}`);
        }
      }
      if (results.length) {
        const t = text(this, x, PLAYER_Y + 230, results.join('\n'), 28, '900', GOLD).setStroke('#0a1f14', 8).setDepth(30);
        this.labels.push(t);
        audio.complete();
        haptics.fire('success');
      }
    });
    if (this.sideWon > 0) {
      wallet.add(this.sideWon);
      wallet.recordWin(this.sideWon);
      player.event('coins_won', this.sideWon - this.sideStaked);
      this.refresh();
      coinShower(this, VW / 2, PLAYER_Y, this.sideWon);
    }
    // side chips are settled: clear them from the felt
    this.showBetsDuringPlay();
  }

  private showBetsDuringPlay(): void {
    this.betLayer.removeAll(true);
    const r = this.round!;
    const size = Math.round(80 * SCALE[this.spots]!) * 1.1;
    for (const h of r.hands) this.chipStack(this.handX(h), BET_Y, h.bet, size);
  }

  // ---------------------------------------------------------- positions
  /** X center of a hand: its spot's column, split side by side if the spot split. */
  private handX(h: PlayerHand): number {
    const r = this.round!;
    const same = r.hands.filter((x) => x.spot === h.spot);
    const k = same.indexOf(h);
    const colW = this.spots === 1 ? 480 : this.spots === 2 ? 240 : 170;
    return this.colX(h.spot) + (k - (same.length - 1) / 2) * colW;
  }
  private cardPos(h: PlayerHand, j: number, n: number): { x: number } {
    const s = SCALE[this.spots]!;
    const split = this.round!.hands.filter((x) => x.spot === h.spot).length > 1;
    const gap = (split ? 40 : 62) * s;
    return { x: this.handX(h) + (j - (n - 1) / 2) * gap };
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
    const y = 1710;
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

  /** Move every card to where it belongs now (after a split or a new card). */
  private relayout(): void {
    const r = this.round!;
    for (const h of r.hands) {
      const list = this.handSprites.get(h) ?? [];
      list.forEach((spr, j) => this.tweens.add({ targets: spr, x: this.cardPos(h, j, h.cards.length).x, duration: 220 }));
    }
    this.showBetsDuringPlay();
  }

  private act(kind: 'hit' | 'stand' | 'double' | 'split'): void {
    if (this.busy) return;
    const r = this.round!;
    const h = r.hand;
    if (kind === 'double' || kind === 'split') {
      if (!wallet.spend(h.bet)) return outOfCoins(this, this.refresh);
      player.wager(h.bet);
      this.refresh();
    }
    audio.tap();
    haptics.fire('light');
    const before = new Map(r.hands.map((x) => [x, x.cards.length]));
    if (kind === 'hit') r.hit();
    else if (kind === 'stand') r.stand();
    else if (kind === 'double') r.double();
    else r.split();
    this.busy = true;
    this.clearControls();
    let delay = 0;
    if (kind === 'split') {
      // the second card moves to the new hand
      const newHand = r.hands.find((x) => !before.has(x))!;
      const moved = this.handSprites.get(h)!.pop()!;
      this.handSprites.set(newHand, [moved]);
      before.set(h, 1);
      before.set(newHand, 1);
      this.relayout();
      delay = 300;
    }
    for (const hh of r.hands) {
      const list = this.handSprites.get(hh)!;
      for (let j = before.get(hh) ?? 0; j < hh.cards.length; j++) {
        this.relayout();
        const spr = dealCard(this, SHOE, this.cardPos(hh, j, hh.cards.length).x, PLAYER_Y, hh.cards[j]!, delay, SCALE[this.spots]);
        if (hh.doubled && j === 2) spr.setAngle(90);
        list.push(spr);
        delay += 280;
      }
    }
    this.time.delayedCall(delay + 350, () => {
      this.busy = false;
      this.relayout();
      this.updateLabels();
      if (r.phase === 'settled') this.finish();
      else this.actionControls();
    });
  }

  private updateLabels(): void {
    for (const l of this.labels) if ((l as Phaser.GameObjects.Container).getData?.('total')) l.destroy();
    this.labels = this.labels.filter((l) => l.active);
    const r = this.round;
    if (!r) return;
    for (const hh of r.hands) {
      const t = handTotal(hh.cards);
      const label = t.total > 21 ? 'Bust' : t.soft && t.total < 21 ? `${t.total - 10}/${t.total}` : String(t.total);
      const active = r.phase === 'player' && r.hand === hh && (r.hands.length > 1);
      this.labels.push(this.badge(this.handX(hh), PLAYER_Y + (CARD_H * SCALE[this.spots]!) / 2 + 44, label, active).setData('total', true));
    }
    if (r.phase === 'settled') {
      const d = handTotal(r.dealer).total;
      this.labels.push(this.badge(VW / 2, DEALER_Y - CARD_H / 2 - 50, d > 21 ? 'Bust' : String(d), false).setData('total', true));
    }
  }

  private badge(x: number, y: number, label: string, active: boolean): Phaser.GameObjects.Container {
    const t = text(this, 0, 0, label, this.spots === 3 ? 32 : 40, '800', active ? '#3a1a00' : '#ffffff');
    const g = this.add.graphics();
    const bw = Math.max(90, t.width + 40);
    g.fillStyle(active ? 0xe9b949 : 0x000000, active ? 1 : 0.55);
    g.fillRoundedRect(-bw / 2, -30, bw, 60, 30);
    return this.add.container(x, y, [g, t]).setDepth(20);
  }

  // -------------------------------------------------------------- result
  private finish(): void {
    const r = this.round!;
    this.busy = true;
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
    r.hands.forEach((hh) => this.resultTag(hh));
    const net = payout - staked;
    player.event('blackjack_hand', r.hands.length);
    const wins = r.hands.filter((h) => h.result === 'win' || h.result === 'blackjack').length;
    if (wins) player.event('blackjack_win', wins);
    if (r.hands.some((h) => h.result === 'blackjack')) player.event('blackjack_blackjack');
    if (net > 0) player.event('coins_won', net);
    this.refresh();
    if (r.hands.some((h) => h.result === 'blackjack')) {
      banner(this, 'Blackjack!', net > 0 ? `+${fmt(net)}` : '');
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
    this.time.delayedCall(2400, () => this.clearTable());
  }

  private resultTag(hh: PlayerHand): void {
    const map = { blackjack: ['BLACKJACK', GOLD], win: ['WIN', '#5dff9a'], push: ['PUSH', '#ffffff'], lose: ['LOSE', '#ff6b7a'] } as const;
    const [label, color] = map[hh.result!];
    const size = this.spots === 3 ? 34 : 46;
    const t = text(this, this.handX(hh), PLAYER_Y - (CARD_H * SCALE[this.spots]!) / 2 - 44, label, size, '900', color).setStroke('#0a1f14', 10).setDepth(25);
    this.labels.push(t);
  }

  private clearTable(): void {
    const all = [...this.dealerSprites, ...[...this.handSprites.values()].flat()];
    this.tweens.add({ targets: all, x: -200, y: 300, angle: -30, duration: 350, ease: 'Cubic.easeIn', onComplete: () => all.forEach((s) => s.destroy()) });
    for (const l of this.labels) l.destroy();
    this.labels = [];
    this.round = null;
    this.time.delayedCall(380, () => this.bettingPhase());
  }
}
