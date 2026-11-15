import Phaser from 'phaser';
import { popIn } from '@tgs/kit';
import { cardId, type Card, type Suit } from '../logic/cards.ts';
import { EUCHRE_TARGET, EuchreRound, SUIT_NAMES, team as eTeam } from '../logic/euchre.ts';
import { HEARTS_TARGET, HeartsRound, PASS_NAMES } from '../logic/hearts.ts';
import { SPADES_TARGET, SpadesRound, addSpadesScore } from '../logic/spades.ts';
import { same, type Played } from '../logic/tricks.ts';
import { DISPLAY_FONT, GOLD, THEME, audio, fmt, haptics, player, wallet } from '../services.ts';
import { CARD_H, CARD_W, VW, backdrop, banner, coinBar, coinShower, frame, makeButton, screenDim, text } from '../ui/common.ts';

export type CardGameId = 'hearts' | 'spades' | 'euchre';
const WIN_REWARD = 1500;
const NAMES: Record<CardGameId, string> = { hearts: 'Hearts', spades: 'Spades', euchre: 'Euchre' };

/** Seats clockwise from you (bottom): left, top (your partner in Spades and Euchre), right. */
const SEAT_POS = [
  { x: 540, y: 1330 },
  { x: 120, y: 860 },
  { x: 540, y: 330 },
  { x: 960, y: 860 },
];
const TRICK_POS = [
  { x: 540, y: 1010 },
  { x: 380, y: 860 },
  { x: 540, y: 700 },
  { x: 700, y: 860 },
];
const BOTS = [
  { name: 'You', key: 'you' },
  { name: 'Rosa', key: 'rosa' },
  { name: 'Kwame', key: 'kwame' },
  { name: 'Lena', key: 'lena' },
];

type Phase = 'pass' | 'bid' | 'order' | 'name' | 'discard' | 'play' | 'done';

/** One game's rules seen through the same shape, so one table can run all three. */
interface Rules {
  partners: boolean;
  target: number;
  lowWins: boolean;
  newRound(): void;
  phase(): Phase;
  turn(): number;
  hand(seat: number): Card[];
  trick(): Played[];
  legal(seat: number): Card[];
  play(seat: number, c: Card): number | null;
  /** One computer action for the current phase. */
  bot(seat: number): void;
  trumpLabel(): string;
  seatInfo(seat: number): string;
  /** Scores the finished round; returns a one-line summary. */
  finishRound(): string;
  totals(): number[];
  scoreLine(): string;
  /** Winner seat/team index once the game is over, else null. */
  winner(): number | null;
  /** The live round object. */
  round(): unknown;
}

function heartsRules(): Rules {
  let round = 0;
  let r = new HeartsRound(0);
  const totals = [0, 0, 0, 0];
  return {
    partners: false,
    target: HEARTS_TARGET,
    lowWins: true,
    round: () => r,
    newRound: () => (r = new HeartsRound(round++)),
    phase: () => r.phase,
    turn: () => (r.phase === 'pass' ? 0 : r.turn),
    hand: (s) => r.hands[s]!,
    trick: () => r.trick,
    legal: (s) => (r.phase === 'pass' ? r.hands[s]! : r.legal(s)),
    play: (s, c) => r.play(s, c),
    // in the pass phase every seat still to pass chooses its cards
    bot: (s) => {
      if (r.phase !== 'pass') return void r.play(s, r.botPlay(s));
      for (let k = 0; k < 4; k++) if (!r.passes[k]) r.pass(k, r.botPass(k));
    },
    trumpLabel: () => (r.phase === 'pass' ? `Pass 3 cards ${PASS_NAMES[r.passDir]}` : r.heartsBroken ? 'Hearts broken' : 'No trump'),
    seatInfo: (s) => `${totals[s]} pts`,
    finishRound: () => {
      const p = r.points();
      p.forEach((v, i) => (totals[i]! += v));
      const moon = p.filter((v) => v === 26).length === 3 ? p.indexOf(0) : -1;
      return moon >= 0 ? `${BOTS[moon]!.name} shot the moon!` : `This round: ${p.map((v, i) => `${BOTS[i]!.name} ${v}`).join(' · ')}`;
    },
    totals: () => totals,
    scoreLine: () => `First to ${HEARTS_TARGET} loses · lowest score wins`,
    winner: () => {
      if (Math.max(...totals) < HEARTS_TARGET) return null;
      const low = Math.min(...totals);
      return totals.indexOf(low);
    },
  };
}

function spadesRules(): Rules {
  let dealer = 3;
  let r = new SpadesRound(dealer);
  const totals: [number, number] = [0, 0];
  const bags: [number, number] = [0, 0];
  return {
    partners: true,
    target: SPADES_TARGET,
    lowWins: false,
    round: () => r,
    newRound: () => {
      dealer = (dealer + 1) % 4;
      r = new SpadesRound(dealer);
    },
    phase: () => r.phase,
    turn: () => r.turn,
    hand: (s) => r.hands[s]!,
    trick: () => r.trick,
    legal: (s) => r.legal(s),
    play: (s, c) => r.play(s, c),
    bot: (s) => (r.phase === 'bid' ? r.bid(s, r.botBid(s)) : void r.play(s, r.botPlay(s))),
    trumpLabel: () => (r.broken ? 'Spades are trump · broken' : 'Spades are trump'),
    seatInfo: (s) => (r.bids[s] === null ? '' : `${r.bids[s] === 0 ? 'Nil' : `Bid ${r.bids[s]}`} · ${r.tricks[s]} won`),
    finishRound: () => {
      const sc = r.score();
      addSpadesScore(totals, bags, sc);
      return `You & Kwame ${sc.points[0] >= 0 ? '+' : ''}${sc.points[0]} · Rosa & Lena ${sc.points[1] >= 0 ? '+' : ''}${sc.points[1]}`;
    },
    totals: () => totals,
    scoreLine: () => `You & Kwame ${totals[0]} (${bags[0]} bags) · Them ${totals[1]} (${bags[1]} bags) · to ${SPADES_TARGET}`,
    winner: () => (Math.max(...totals) >= SPADES_TARGET && totals[0] !== totals[1] ? (totals[0] > totals[1] ? 0 : 1) : null),
  };
}

function euchreRules(): Rules {
  let dealer = 3;
  let r = new EuchreRound(dealer);
  const totals: [number, number] = [0, 0];
  return {
    partners: true,
    target: EUCHRE_TARGET,
    lowWins: false,
    round: () => r,
    newRound: () => {
      dealer = (dealer + 1) % 4;
      r = new EuchreRound(dealer);
    },
    phase: () => r.phase,
    turn: () => r.turn,
    hand: (s) => r.hands[s]!,
    trick: () => r.trick,
    legal: (s) => r.legal(s),
    play: (s, c) => r.play(s, c),
    bot: (s) => {
      if (r.phase === 'order') r.order(s, r.botOrder(s));
      else if (r.phase === 'name') r.name(s, r.botName(s));
      else if (r.phase === 'discard') r.discard(s, r.botDiscard(s));
      else r.play(s, r.botPlay(s));
    },
    trumpLabel: () =>
      r.trump ? `Trump: ${SUIT_NAMES[r.trump]} · called by ${BOTS[r.maker]!.name}` : r.phase === 'order' ? `Turned up: ${cardName(r.upcard)} · dealer ${BOTS[r.dealer]!.name}` : 'Name trump',
    seatInfo: (s) => (r.phase === 'play' || r.phase === 'done' ? `${r.tricks[s]} won${s === r.dealer ? ' · D' : ''}` : s === r.dealer ? 'Dealer' : ''),
    finishRound: () => {
      const sc = r.score();
      totals[0] += sc.points[0];
      totals[1] += sc.points[1];
      const makers = eTeam(r.maker) === 0 ? 'You & Kwame' : 'Rosa & Lena';
      return sc.euchred ? `${makers} got euchred!` : sc.march ? `${makers} took all five!` : `${makers} made it`;
    },
    totals: () => totals,
    scoreLine: () => `You & Kwame ${totals[0]} · Rosa & Lena ${totals[1]} · to ${EUCHRE_TARGET}`,
    winner: () => (Math.max(...totals) >= EUCHRE_TARGET ? (totals[0] > totals[1] ? 0 : 1) : null),
  };
}

function cardName(c: Card): string {
  const r = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' }[c.rank as number] ?? String(c.rank);
  return `${r} of ${SUIT_NAMES[c.suit]}`;
}

/**
 * The Card Club table: Hearts, Spades or Euchre against three computer
 * players. You sit at the bottom; in Spades and Euchre the player across is
 * your partner. Winning a game pays a coin bonus.
 */
export class CardGameScene extends Phaser.Scene {
  private gameId: CardGameId = 'hearts';
  private rules!: Rules;
  private handLayer!: Phaser.GameObjects.Container;
  private trickLayer!: Phaser.GameObjects.Container;
  private seatLayer!: Phaser.GameObjects.Container;
  private ui!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;
  private trumpText!: Phaser.GameObjects.Text;
  private selected: Card[] = [];
  private busy = false;
  private shownTrick = 0;
  private over = false;
  /** Delay multiplier (the play-test speeds the table up). */
  private pace = 1;

  constructor() {
    super('cardgame');
  }

  init(data: { game?: CardGameId }): void {
    this.gameId = data.game ?? 'hearts';
  }

  create(): void {
    const view = frame(this);
    backdrop(this, 'bg-felt');
    coinBar(this, NAMES[this.gameId], () => this.scene.start('room', { room: 'cards' }));
    this.rules = this.gameId === 'hearts' ? heartsRules() : this.gameId === 'spades' ? spadesRules() : euchreRules();
    this.hud = text(this, VW / 2, view.top + 236, '', 26, '800', GOLD).setDepth(30);
    this.trumpText = text(this, VW / 2, 545, '', 30, '800', '#ffffff').setDepth(4).setAlpha(0.85);
    this.seatLayer = this.add.container(0, 0).setDepth(6);
    this.trickLayer = this.add.container(0, 0).setDepth(8);
    this.handLayer = this.add.container(0, 0).setDepth(20);
    this.ui = this.add.container(0, 0).setDepth(40);
    this.busy = false;
    this.over = false;
    this.shownTrick = 0;
    this.selected = [];
    this.startRound();
    (globalThis as Record<string, unknown>).__cards = {
      phase: () => this.rules.phase(),
      turn: () => this.rules.turn(),
      // test hook: let the computer play your seat too
      auto: () => {
        if (this.rules.turn() === 0 && !this.busy) {
          this.rules.bot(0);
          this.selected = [];
          this.step();
        }
      },
      totals: () => this.rules.totals(),
      over: () => this.over,
      fast: () => (this.pace = 0.1),
    };
  }

  private startRound(): void {
    this.rules.newRound();
    this.shownTrick = 0;
    this.trickLayer.removeAll(true);
    audio.chips(3);
    this.drawSeats();
    this.drawHand();
    this.step();
  }

  // ---------------------------------------------------------------- drawing
  private drawSeats(): void {
    this.seatLayer.removeAll(true);
    BOTS.forEach((b, s) => {
      const p = SEAT_POS[s]!;
      const turn = this.rules.turn() === s && this.rules.phase() !== 'done';
      const partner = this.rules.partners && s === 2;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.5);
      g.fillCircle(p.x + 3, p.y + 6, 66);
      g.lineStyle(turn ? 8 : 4, turn ? 0xffffff : partner ? 0x7dffb0 : 0xe9c86a, 1);
      g.strokeCircle(p.x, p.y, 62);
      this.seatLayer.add([g, this.add.image(p.x, p.y, `av-${b.key}`).setDisplaySize(118, 118)]);
      const plate = this.add.graphics();
      plate.fillStyle(0x0d0b10, 0.88);
      plate.fillRoundedRect(p.x - 100, p.y + 56, 200, 74, 16);
      this.seatLayer.add(plate);
      this.seatLayer.add(text(this, p.x, p.y + 76, `${b.name}${partner ? ' · partner' : ''}`, 24, '800', partner ? '#7dffb0' : '#ffffff'));
      this.seatLayer.add(text(this, p.x, p.y + 108, this.rules.seatInfo(s), 22, '700', GOLD));
      // opponents' cards as a small fan of backs
      if (s !== 0) {
        const n = this.rules.hand(s).length;
        for (let k = 0; k < Math.min(n, 13); k++) {
          const off = (k - (n - 1) / 2) * (s === 2 ? 16 : 11);
          const pos = s === 2 ? { x: p.x + 200 + off, y: p.y } : { x: p.x + (s === 1 ? 20 : -20), y: p.y - 170 + off };
          this.seatLayer.add(this.add.image(pos.x, pos.y, 'card-back').setDisplaySize(CARD_W * 0.32, CARD_H * 0.32).setAngle(s === 2 ? 0 : 90));
        }
      }
    });
    this.hud.setText(this.rules.scoreLine());
    this.trumpText.setText(this.rules.trumpLabel());
  }

  /** Your hand, fanned along the bottom. Playable cards stand up; others are dimmed. */
  private drawHand(): void {
    this.handLayer.removeAll(true);
    const hand = this.rules.hand(0);
    const phase = this.rules.phase();
    const myTurn = this.rules.turn() === 0;
    const legal = myTurn ? this.rules.legal(0) : [];
    const n = hand.length;
    const step = Math.min(130, 900 / Math.max(1, n - 1));
    const base = 1790;
    hand.forEach((c, i) => {
      // a neat overlapping row so every corner index stays readable
      const k = i - (n - 1) / 2;
      const x = VW / 2 + k * step;
      const ok = legal.some((l) => same(l, c));
      const sel = this.selected.some((l) => same(l, c));
      const lift = sel ? 60 : ok && (phase === 'play' || phase === 'discard') ? 26 : 0;
      const img = this.add
        .image(x, base - lift, `card-${cardId(c)}`)
        .setOrigin(0.5, 1)
        .setDisplaySize(CARD_W * 0.92, CARD_H * 0.92)
      if (myTurn && (phase === 'play' || phase === 'discard' || phase === 'pass') && !ok) img.setTint(0x777777);
      if (myTurn && ok) {
        img.setInteractive({ useHandCursor: true });
        img.on('pointerup', () => this.tapCard(c));
      }
      this.handLayer.add(img);
    });
  }

  private drawTrick(): void {
    this.trickLayer.removeAll(true);
    if (this.gameId === 'euchre' && this.rules.phase() === 'order') this.showUpcard(this.roundObj() as EuchreRound);
    for (const p of this.rules.trick()) {
      const pos = TRICK_POS[p.seat]!;
      this.trickLayer.add(this.add.image(pos.x, pos.y, `card-${cardId(p.card)}`).setDisplaySize(CARD_W * 0.85, CARD_H * 0.85).setAngle((p.seat - 1.5) * 4));
    }
  }

  // ---------------------------------------------------------------- flow
  /** Advance: computer turns run on a timer; your turn shows the right controls. */
  private step(): void {
    if (this.busy) return;
    this.ui.removeAll(true);
    this.drawSeats();
    this.drawHand();
    this.drawTrick();
    const phase = this.rules.phase();
    if (phase === 'done') return this.endRound();
    const turn = this.rules.turn();
    if (turn !== 0) {
      this.busy = true;
      this.time.delayedCall((phase === 'play' ? 650 : 500) * this.pace, () => {
        this.busy = false;
        const before = this.rules.trick().length;
        this.rules.bot(turn);
        this.afterPlay(before);
      });
      return;
    }
    this.humanControls(phase);
  }

  /** After a card lands: if it completed a trick, show it, then sweep it to the winner. */
  private afterPlay(trickBefore: number): void {
    audio.card();
    const now = this.rules.trick().length;
    if (trickBefore === 3 && now === 0) {
      // the trick just completed: show all four for a moment
      const last = (this.lastTrickOf() ?? []) as Played[];
      this.trickLayer.removeAll(true);
      for (const p of last) {
        const pos = TRICK_POS[p.seat]!;
        this.trickLayer.add(this.add.image(pos.x, pos.y, `card-${cardId(p.card)}`).setDisplaySize(CARD_W * 0.85, CARD_H * 0.85));
      }
      const w = this.lastWinner();
      this.busy = true;
      this.drawSeats();
      this.drawHand();
      this.time.delayedCall(900 * this.pace, () => {
        const to = SEAT_POS[w]!;
        this.tweens.add({ targets: this.trickLayer.list, x: to.x, y: to.y, alpha: 0, scale: 0.2, duration: 380, ease: 'Cubic.easeIn' });
        if (w === 0 || (this.rules.partners && w === 2)) audio.chips(2);
        this.time.delayedCall(420 * this.pace, () => {
          this.busy = false;
          this.step();
        });
      });
      return;
    }
    this.step();
  }

  private lastTrickOf(): Played[] | null {
    return (this.roundObj() as { lastTrick?: { trick: Played[] } } | null)?.lastTrick?.trick ?? null;
  }

  private lastWinner(): number {
    return (this.roundObj() as { lastTrick?: { winner: number } } | null)?.lastTrick?.winner ?? 0;
  }

  private roundObj(): unknown {
    return this.rules.round();
  }

  private tapCard(c: Card): void {
    if (this.busy) return;
    const phase = this.rules.phase();
    if (phase === 'pass') {
      const i = this.selected.findIndex((x) => same(x, c));
      if (i >= 0) this.selected.splice(i, 1);
      else if (this.selected.length < 3) this.selected.push(c);
      audio.tap();
      this.drawHand();
      this.humanControls('pass');
      return;
    }
    if (phase === 'discard') {
      (this.roundObj() as EuchreRound).discard(0, c);
      audio.card();
      this.step();
      return;
    }
    if (phase === 'play') {
      const before = this.rules.trick().length;
      if (this.rules.play(0, c) === null && this.rules.trick().length === before) return;
      haptics.fire('light');
      this.afterPlay(before);
    }
  }

  private humanControls(phase: Phase): void {
    this.ui.removeAll(true);
    const y = 1180;
    const btn = (x: number, label: string, fn: () => void, color?: number, w = 300) =>
      this.ui.add(makeButton(this, x, y, label, fn, { width: w, height: 100, fontSize: 36, color, theme: THEME }));
    if (phase === 'pass') {
      const r = this.roundObj() as HeartsRound;
      const left = 3 - this.selected.length;
      this.ui.add(text(this, VW / 2, y - 90, left ? `Choose ${left} more card${left > 1 ? 's' : ''} to pass ${PASS_NAMES[r.passDir]}` : 'Ready to pass', 30, '800', '#ffffff').setStroke('#000000', 6));
      if (!left)
        btn(VW / 2, `Pass ${PASS_NAMES[r.passDir]}`, () => {
          r.pass(0, this.selected);
          for (let s = 1; s < 4; s++) r.pass(s, r.botPass(s));
          this.selected = [];
          audio.chips(2);
          this.step();
        });
    } else if (phase === 'bid') {
      this.bidPicker();
    } else if (phase === 'order') {
      const r = this.roundObj() as EuchreRound;
      this.ui.add(text(this, VW / 2, y - 90, r.dealer === 0 ? `Pick up the ${cardName(r.upcard)}?` : `Order up ${SUIT_NAMES[r.upcard.suit]} as trump?`, 30, '800', '#ffffff').setStroke('#000000', 6));
      btn(VW / 2 - 170, r.dealer === 0 ? 'Pick it up' : 'Order it up', () => {
        r.order(0, true);
        this.step();
      }, 0x18a050);
      btn(VW / 2 + 170, 'Pass', () => {
        r.order(0, false);
        this.step();
      }, 0x2a2430);
    } else if (phase === 'name') {
      const r = this.roundObj() as EuchreRound;
      this.ui.add(text(this, VW / 2, y - 150, r.dealer === 0 ? 'Everyone passed. You must name trump:' : 'Name trump, or pass', 30, '800', '#ffffff').setStroke('#000000', 6));
      const suits = (['s', 'h', 'd', 'c'] as Suit[]).filter((s) => s !== r.upcard.suit);
      suits.forEach((s, i) => {
        this.ui.add(
          makeButton(this, 220 + i * 230, y - 50, SUIT_NAMES[s], () => {
            r.name(0, s);
            this.step();
          }, { width: 210, height: 90, fontSize: 30, color: s === 'h' || s === 'd' ? 0xb8101e : 0x2a2430, theme: THEME }),
        );
      });
      if (r.dealer !== 0)
        this.ui.add(
          makeButton(this, 220 + suits.length * 230, y - 50, 'Pass', () => {
            r.name(0, null);
            this.step();
          }, { width: 210, height: 90, fontSize: 30, color: 0x5a1a8a, theme: THEME }),
        );
    } else if (phase === 'discard') {
      this.ui.add(text(this, VW / 2, y - 90, 'Tap a card to discard', 30, '800', '#ffffff').setStroke('#000000', 6));
    } else if (phase === 'play') {
      this.ui.add(text(this, VW / 2, 1500, 'Your turn', 28, '800', '#ffe14a').setStroke('#000000', 5));
    }
  }

  private showUpcard(r: EuchreRound): void {
    this.trickLayer.removeAll(true);
    const img = this.add.image(VW / 2, 860, `card-${cardId(r.upcard)}`).setDisplaySize(CARD_W, CARD_H);
    this.trickLayer.add(img);
  }

  /** Spades bid: 0 (Nil) to 13, with a suggestion. */
  private bidPicker(): void {
    const r = this.roundObj() as SpadesRound;
    const suggest = r.botBid(0);
    this.ui.add(text(this, VW / 2, 1000, `Your bid (suggested: ${suggest === 0 ? 'Nil' : suggest})`, 30, '800', '#ffffff').setStroke('#000000', 6));
    for (let n = 0; n <= 13; n++) {
      const x = 130 + (n % 7) * 137;
      const y = 1080 + Math.floor(n / 7) * 100;
      this.ui.add(
        makeButton(this, x, y, n === 0 ? 'Nil' : String(n), () => {
          r.bid(0, n);
          audio.chip();
          this.step();
        }, { width: 124, height: 88, fontSize: 32, color: n === suggest ? 0x18a050 : 0x2a2430, theme: THEME }),
      );
    }
  }

  private endRound(): void {
    const summary = this.rules.finishRound();
    this.drawSeats();
    const w = this.rules.winner();
    if (w === null) {
      banner(this, 'Round over', summary, '#ffffff');
      this.time.delayedCall(2600 * this.pace, () => this.startRound());
      return;
    }
    // game over
    this.over = true;
    const youWin = w === 0;
    if (youWin) {
      wallet.add(WIN_REWARD);
      wallet.recordWin(WIN_REWARD);
      player.event('coins_won', WIN_REWARD);
      coinShower(this, VW / 2, 900, WIN_REWARD);
      audio.win();
    } else audio.invalid();
    screenDim(this, 0.65, 90);
    const c = this.add.container(VW / 2, 960).setDepth(91);
    const g = this.add.graphics();
    g.fillStyle(0x140a1e, 0.97);
    g.fillRoundedRect(-440, -360, 880, 720, 36);
    g.lineStyle(4, 0xe9c86a, 0.9);
    g.strokeRoundedRect(-440, -360, 880, 720, 36);
    const who = this.rules.partners ? (w === 0 ? 'You & Kwame win!' : 'Rosa & Lena win') : w === 0 ? 'You win!' : `${BOTS[w]!.name} wins`;
    c.add([g, text(this, 0, -270, who, 64, '900', youWin ? GOLD : '#ffffff', DISPLAY_FONT), text(this, 0, -180, summary, 28, '600', '#cbb6d6').setWordWrapWidth(780)]);
    c.add(text(this, 0, -90, this.rules.scoreLine(), 28, '700', '#ffffff').setWordWrapWidth(780));
    if (youWin) c.add(text(this, 0, 10, `+${fmt(WIN_REWARD)} coins`, 64, '900', GOLD));
    c.add(makeButton(this, 0, 160, 'Play again', () => this.scene.restart({ game: this.gameId }), { width: 520, height: 120, fontSize: 46, theme: THEME }));
    c.add(makeButton(this, 0, 290, 'Card Club', () => this.scene.start('room', { room: 'cards' }), { width: 520, height: 100, fontSize: 38, color: 0x2a2430, theme: THEME }));
    popIn(this, c);
  }
}
