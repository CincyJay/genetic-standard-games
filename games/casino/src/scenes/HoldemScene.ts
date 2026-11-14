import Phaser from 'phaser';
import { makeButton, popIn } from '@tgs/kit';
import { HoldemTable, decide, type Personality } from '../logic/holdem.ts';
import { DISPLAY_FONT, GOLD, THEME, audio, fmt, haptics, player, trophies, wallet } from '../services.ts';
import { MTT_EVENTS, MttField, SNG_BUYINS, START_CHIPS, blindsFor, mttBlinds, mttPrize, paidPlaces, prizeFor, type MttEvent } from '../logic/tournament.ts';
import { CARD_H, CARD_W, banner, coinBar, dealCard, flipCard, outOfCoins, text } from '../ui/common.ts';
import { CASH_STAKES } from './PokerLobbyScene.ts';
import { VH, VW, backdrop, frame, screenDim } from '../ui/common.ts';

const STAKES = CASH_STAKES;
const SEATS = [
  { x: 540, y: 1585 },
  { x: 112, y: 1290 },
  { x: 112, y: 640 },
  { x: 540, y: 300 },
  { x: 968, y: 640 },
  { x: 968, y: 1290 },
];
const CENTER = { x: 540, y: 960 };
const POT = { x: 540, y: 780 };
const BOARD_Y = 960;
const BRASS = 0xc9a96a;
const BRASS_HEX = '#d9c38f';
const PANEL = 0x0d0b0d;
const AV = 128; // avatar diameter

const BOTS: { name: string; key: string; p: Personality }[] = [
  { name: 'Rosa', key: 'rosa', p: { aggression: 0.7, bluff: 0.12 } },
  { name: 'Dmitri', key: 'dmitri', p: { aggression: 0.3, bluff: 0.04 } },
  { name: 'Kwame', key: 'kwame', p: { aggression: 0.5, bluff: 0.08 } },
  { name: 'Lena', key: 'lena', p: { aggression: 0.85, bluff: 0.18 } },
  { name: 'Hector', key: 'hector', p: { aggression: 0.2, bluff: 0.03 } },
  { name: 'Priya', key: 'priya', p: { aggression: 0.55, bluff: 0.1 } },
  { name: 'Sam', key: 'sam', p: { aggression: 0.4, bluff: 0.06 } },
  { name: 'Yuki', key: 'yuki', p: { aggression: 0.65, bluff: 0.14 } },
];

interface SeatUi {
  key: string;
  p: Personality;
  avatar: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Graphics;
  timer: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  stack: Phaser.GameObjects.Text;
  bubble: Phaser.GameObjects.Container | null;
  cards: Phaser.GameObjects.Image[];
  bet: Phaser.GameObjects.Container | null;
  shownBet: number;
}

const CHIP_VALUES = [5000, 1000, 500, 100, 50, 10];

export interface HoldemStart {
  mode?: 'cash' | 'sng' | 'mtt';
  stake?: number;
  sng?: number;
  event?: string;
}

interface MttRun {
  ev: MttEvent;
  field: MttField;
  inMoney: boolean;
  finalShown: boolean;
  bubbleShown: boolean;
  /** Seats whose bust has been counted. */
  counted: Set<number>;
}

export class HoldemScene extends Phaser.Scene {
  private table: HoldemTable | null = null;
  private stake = STAKES[0]!;
  /** Sit & Go in progress (null at a cash table). */
  private sng: { name: string; buyIn: number } | null = null;
  /** Seat indexes in the order they were knocked out. */
  private eliminated: number[] = [];
  private hud: Phaser.GameObjects.Text | null = null;
  private lastLevel = 0;
  private seats: SeatUi[] = [];
  private botCursor = 0;
  private refresh!: () => void;
  private board: Phaser.GameObjects.Image[] = [];
  private pot: Phaser.GameObjects.Container | null = null;
  private shownPot = 0;
  private dealerBtn: Phaser.GameObjects.Container | null = null;
  private handLabel!: Phaser.GameObjects.Text;
  private controls: Phaser.GameObjects.GameObject[] = [];
  private stepping = false;
  private thinking: Phaser.Tweens.Tween | null = null;
  private bottom = VH;
  private start: HoldemStart = {};
  private mtt: MttRun | null = null;
  private bg!: Phaser.GameObjects.Image;

  constructor() {
    super('holdem');
  }

  init(data: HoldemStart): void {
    this.start = data ?? {};
  }

  create(): void {
    const w = VW;
    const h = VH;
    this.bottom = frame(this).bottom;
    this.bg = backdrop(this, 'table-poker');
    this.table = null;
    this.mtt = null;
    this.sng = null;
    this.seats = [];
    this.board = [];
    this.pot = null;
    this.shownPot = 0;
    this.dealerBtn = null;
    this.controls = [];
    this.stepping = false;
    this.botCursor = Phaser.Math.Between(0, BOTS.length - 1);
    this.refresh = coinBar(this, "Hold'em", () => this.leave());
    this.handLabel = text(this, SEATS[0]!.x, 1268, '', 34, '700', BRASS_HEX).setDepth(30);
    (globalThis as Record<string, unknown>).__holdem = {
      state: () => ({ toAct: this.table?.toAct ?? -1, street: this.table?.street ?? 'none', hand: this.table?.handNumber ?? 0, stack: this.table?.seats[0]!.stack ?? 0 }),
      // dev test hooks: shrink the tournament field, or end the tournament in a given place
      field: (n: number) => {
        if (import.meta.env.DEV && this.mtt) this.mtt.field.remaining = n;
      },
      finish: (place: number) => {
        if (import.meta.env.DEV && this.mtt) this.finishMtt(place);
      },
    };
    // the lobby already took the buy-in; sit straight down
    const st = this.start;
    if (st.mode === 'mtt') {
      const ev = MTT_EVENTS.find((e) => e.id === st.event) ?? MTT_EVENTS[0]!;
      this.mtt = { ev, field: new MttField(ev), inMoney: false, finalShown: false, bubbleShown: false, counted: new Set() };
      this.eliminated = [];
      this.lastLevel = 0;
      this.sitDown();
    } else if (st.mode === 'sng') {
      this.sng = SNG_BUYINS[st.sng ?? 0]!;
      this.eliminated = [];
      this.lastLevel = 0;
      this.sitDown();
    } else if (st.mode === 'cash') {
      this.stake = STAKES[st.stake ?? 0]!;
      this.sitDown();
    } else this.time.delayedCall(0, () => this.scene.start('pokerlobby'));
  }

  // ------------------------------------------------------------ buy-in
  private panelBg(wd: number, ht: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(-wd / 2, -ht / 2 + 12, wd, ht, 36);
    g.fillStyle(PANEL, 0.94);
    g.fillRoundedRect(-wd / 2, -ht / 2, wd, ht, 36);
    g.lineStyle(2, BRASS, 0.6);
    g.strokeRoundedRect(-wd / 2, -ht / 2, wd, ht, 36);
    return g;
  }

  private nextBot() {
    const b = BOTS[this.botCursor % BOTS.length]!;
    this.botCursor++;
    return b;
  }

  private sitDown(): void {
    const startStack = this.mtt ? this.mtt.ev.startChips : this.sng ? START_CHIPS : this.stake.buyIn;
    const seats = [{ name: 'You', stack: startStack, human: true }];
    const picks = [{ name: 'You', key: 'you', p: { aggression: 0, bluff: 0 } }];
    for (let i = 1; i < 6; i++) {
      const b = this.nextBot();
      seats.push({ name: b.name, stack: startStack, human: false });
      picks.push(b);
    }
    const blinds = this.mtt ? mttBlinds(this.mtt.ev, 1) : this.sng ? blindsFor(1) : this.stake;
    this.table = new HoldemTable(seats, blinds.sb, blinds.bb);
    if (this.sng || this.mtt) {
      this.hud?.destroy();
      this.hud = text(this, VW / 2, this.cameras.main.scrollY + 236, '', 28, '800', BRASS_HEX).setDepth(30).setLineSpacing(6);
    }
    if (this.mtt) this.announce(this.mtt.ev.name, `${this.mtt.ev.field} players · shuffle up and deal`);
    picks.forEach((b, i) => this.seats.push(this.makeSeat(i, b.key, b.name, b.p)));
    this.newHand();
  }

  private makeSeat(i: number, key: string, name: string, p: Personality): SeatUi {
    const pos = SEATS[i]!;
    const shadow = this.add.graphics().setDepth(5);
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillCircle(pos.x + 4, pos.y + 8, AV / 2 + 6);
    const ring = this.add.graphics().setDepth(6);
    const avatar = this.add.image(pos.x, pos.y, `av-${key}`).setDisplaySize(AV, AV).setDepth(7);
    const timer = this.add.graphics().setDepth(8);
    const plate = this.add.graphics().setDepth(8);
    plate.fillStyle(PANEL, 0.88);
    plate.fillRoundedRect(pos.x - 92, pos.y + AV / 2 - 6, 184, 70, 18);
    plate.lineStyle(2, BRASS, 0.4);
    plate.strokeRoundedRect(pos.x - 92, pos.y + AV / 2 - 6, 184, 70, 18);
    const nm = text(this, pos.x, pos.y + AV / 2 + 14, name, 26, '700', '#e9e4ea').setDepth(9);
    const st = text(this, pos.x, pos.y + AV / 2 + 44, '', 28, '800', BRASS_HEX).setDepth(9);
    const ui: SeatUi = { key, p, avatar, ring, timer, name: nm, stack: st, bubble: null, cards: [], bet: null, shownBet: 0 };
    this.drawRing(ui, false);
    return ui;
  }

  private drawRing(ui: SeatUi, active: boolean, winner = false): void {
    const i = this.seats.indexOf(ui);
    const pos = SEATS[i >= 0 ? i : 0]!;
    ui.ring.clear();
    ui.ring.lineStyle(winner ? 8 : 5, winner ? 0xffd75e : active ? 0xffffff : BRASS, winner || active ? 1 : 0.7);
    ui.ring.strokeCircle(pos.x, pos.y, AV / 2 + 4);
  }

  // ------------------------------------------------------------ chips
  /** A small 3D stack of chips representing `amount`, with a label. */
  private chipStack(x: number, y: number, amount: number, label = true): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(12);
    const chips: number[] = [];
    let rest = amount;
    for (const v of CHIP_VALUES) {
      while (rest >= v && chips.length < 9) {
        chips.push(v);
        rest -= v;
      }
    }
    if (chips.length === 0) chips.push(10);
    const sh = this.add.ellipse(4, 8, 88, 40, 0x000000, 0.45);
    c.add(sh);
    chips.reverse().forEach((v, k) => {
      c.add(this.add.image(0, -k * 9, `chipside-${v}`).setDisplaySize(80, 50));
    });
    if (label) {
      const t = text(this, 0, 44, fmt(amount), 28, '800', '#ffffff');
      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.65);
      bg.fillRoundedRect(-t.width / 2 - 14, 26, t.width + 28, 36, 18);
      c.add([bg, t]);
    }
    return c;
  }

  private betSpot(i: number): { x: number; y: number } {
    const p = SEATS[i]!;
    const k = i === 0 ? 0.38 : i === 3 ? 0.45 : 0.4;
    return { x: p.x + (CENTER.x - p.x) * k, y: p.y + (CENTER.y - p.y) * k + (i === 0 ? -150 : 0) };
  }

  // ------------------------------------------------------------ hand flow
  private newHand(): void {
    if (!this.table) return;
    const t = this.table!;
    if (this.mtt && !this.mttBetweenHands()) return;
    if (this.sng) {
      const left = t.seats.filter((x) => x.stack > 0).length;
      if (t.seats[0]!.stack <= 0) return this.finishSng(this.placeOf(0));
      if (left === 1) return this.finishSng(1);
      const b = blindsFor(t.handNumber + 1);
      t.setBlinds(b.sb, b.bb);
      if (b.level !== this.lastLevel) {
        if (this.lastLevel > 0) this.toast(`Blinds up  ·  ${fmt(b.sb)} / ${fmt(b.bb)}`);
        this.lastLevel = b.level;
      }
      this.hud?.setText(`${this.sng.name}  ·  Level ${b.level}  ·  Blinds ${fmt(b.sb)}/${fmt(b.bb)}  ·  ${left} left`);
    }
    for (let i = 1; i < 6 && !this.sng && !this.mtt; i++) {
      if (t.seats[i]!.stack <= 0) {
        const b = this.nextBot();
        Object.assign(t.seats[i]!, { name: b.name, stack: this.stake.buyIn, out: false });
        const ui = this.seats[i]!;
        ui.key = b.key;
        ui.p = b.p;
        ui.avatar.setTexture(`av-${b.key}`).setDisplaySize(AV, AV);
        ui.name.setText(b.name);
        this.toast(`${b.name} sits down`);
      }
    }
    if (t.seats[0]!.stack <= 0) return this.busted();
    for (const ui of this.seats) {
      ui.cards.forEach((c) => c.destroy());
      ui.cards = [];
      ui.bet?.destroy();
      ui.bet = null;
      ui.shownBet = 0;
      ui.bubble?.destroy();
      ui.bubble = null;
      ui.avatar.setAlpha(1);
      this.drawRing(ui, false);
    }
    this.board.forEach((c) => c.destroy());
    this.board = [];
    this.pot?.destroy();
    this.pot = null;
    this.shownPot = 0;
    this.handLabel.setText('');
    t.startHand();
    this.placeDealerButton();
    // deal hole cards: yours face up and large, theirs face down beside their portrait
    let d = 0;
    for (let k = 0; k < 2; k++) {
      t.seats.forEach((s, i) => {
        if (s.out) return;
        const pos = this.holePos(i, k);
        const human = i === 0;
        const card = dealCard(this, CENTER, pos.x, pos.y, human ? s.cards[k]! : null, d, human ? 1 : 0.42);
        card.setAngle(human ? (k ? 5 : -5) : (k ? 10 : -4) * (i < 3 && i > 0 ? 1 : -1)).setDepth(human ? 20 : 4);
        this.seats[i]!.cards.push(card);
        d += 70;
      });
    }
    this.syncBets(false);
    this.time.delayedCall(d + 350, () => this.step());
  }

  /**
   * Tournament bookkeeping between hands: count busts at this table, fill empty
   * seats from other tables, bust players elsewhere, raise the blinds, and
   * announce the bubble, the money and the final table. Returns false when the
   * tournament is over for the player.
   */
  private mttBetweenHands(): boolean {
    const m = this.mtt!;
    const t = this.table!;
    const f = m.field;
    // busts at this table (the player last, so their place is right)
    t.seats.forEach((s, i) => {
      if (i === 0 || s.stack > 0 || m.counted.has(i)) return;
      m.counted.add(i);
      const place = f.bustAtTable();
      this.toast(`${s.name} is out in ${ordinal(place)}${mttPrize(m.ev, place) ? ` · ${fmt(mttPrize(m.ev, place))}` : ''}`);
      this.seats[i]!.avatar.setAlpha(0.3);
      this.seats[i]!.stack.setText('OUT');
    });
    if (t.seats[0]!.stack <= 0) {
      this.finishMtt(f.bustAtTable());
      return false;
    }
    const alive = () => t.seats.filter((s) => s.stack > 0).length;
    if (alive() === 1 && f.remaining === 1) {
      this.finishMtt(1);
      return false;
    }
    // players from other tables take the empty seats
    for (let i = 1; i < 6; i++) {
      if (t.seats[i]!.stack > 0 || f.outside(alive()) <= 0) continue;
      const b = this.nextBot();
      Object.assign(t.seats[i]!, { name: b.name, stack: f.averageStack, out: false });
      m.counted.delete(i);
      const ui = this.seats[i]!;
      ui.key = b.key;
      ui.p = b.p;
      ui.avatar.setTexture(`av-${b.key}`).setDisplaySize(AV, AV).setAlpha(1);
      ui.name.setText(b.name);
      this.toast(`${b.name} moves to your table`);
    }
    const b = mttBlinds(m.ev, t.handNumber + 1);
    f.tickOthers(alive(), b.level, Math.random);
    t.setBlinds(b.sb, b.bb);
    if (b.level !== this.lastLevel) {
      if (this.lastLevel > 0) this.toast(`Blinds up  ·  ${fmt(b.sb)} / ${fmt(b.bb)}`);
      this.lastLevel = b.level;
    }
    const paid = paidPlaces(m.ev.field);
    if (!m.bubbleShown && f.remaining === paid + 1) {
      m.bubbleShown = true;
      this.announce('MONEY BUBBLE', 'Next player out wins nothing', '#ff8a5a');
    }
    if (!m.inMoney && f.remaining <= paid) {
      m.inMoney = true;
      this.announce('IN THE MONEY!', `Everyone left wins at least ${fmt(mttPrize(m.ev, paid))}`, '#7dffb0');
      audio.win();
    }
    if (!m.finalShown && f.finalTable) {
      m.finalShown = true;
      this.bg.setTexture('table-final');
      this.announce('FINAL TABLE', `${f.remaining} left · 1st place ${fmt(mttPrize(m.ev, 1))}`, '#ffd75e');
      audio.win();
      this.cameras.main.flash(400, 255, 220, 140);
    }
    this.hud?.setText(
      `${m.ev.name}  ·  Level ${b.level}  ·  Blinds ${fmt(b.sb)}/${fmt(b.bb)}\nPlayers ${f.remaining}/${m.ev.field}  ·  Avg ${fmt(f.averageStack)}  ·  ${paid} paid`,
    );
    return true;
  }

  private finishMtt(place: number): void {
    const m = this.mtt!;
    this.stopPlay();
    const prize = mttPrize(m.ev, place);
    if (prize > 0) {
      wallet.add(prize);
      wallet.recordWin(prize);
      player.event('coins_won', prize);
      this.refresh();
    }
    const kind = place === 1 ? (m.ev.id === 'main' ? 'ring' : 'gold') : place === 2 ? 'silver' : place === 3 ? 'bronze' : null;
    if (kind) trophies.add({ kind, event: m.ev.name, place, prize });
    if (place === 1) player.event('holdem_pot', 3);
    this.endPanel(place, m.ev.name, prize, kind, `Play again  ·  ${fmt(m.ev.buyIn)}`, () => {
      if (!wallet.spend(m.ev.buyIn)) return outOfCoins(this, this.refresh);
      this.scene.restart({ mode: 'mtt', event: m.ev.id });
    }, `${m.ev.field} players · ${paidPlaces(m.ev.field)} paid`);
    this.table = null;
  }

  private announceAt = 0;
  /** Big banner, queued so announcements made on the same hand play one after another. */
  private announce(title: string, sub: string, color?: string): void {
    const now = this.time.now;
    const at = Math.max(now, this.announceAt);
    this.announceAt = at + 2000;
    this.time.delayedCall(at - now, () => banner(this, title, sub, color));
  }

  /** Cancel pending computer moves and deals (the tournament is over for the player). */
  private stopPlay(): void {
    this.time.removeAllEvents();
    this.thinking?.stop();
    this.thinking = null;
    this.stepping = false;
    this.clearControls();
  }

  /** Result panel for tournaments: trophy, place, prize, play again or lobby. */
  private endPanel(place: number, event: string, prize: number, kind: string | null, again: string, onAgain: () => void, sub: string): void {
    const dim = screenDim(this, 0.7, 99);
    const panel = this.add.container(VW / 2, 960).setDepth(100);
    panel.add(this.panelBg(860, 1100));
    if (kind) {
      const rays = this.add.image(0, -280, 'fx-glow').setDisplaySize(520, 520).setBlendMode(Phaser.BlendModes.ADD);
      const tro = this.add.image(0, -280, kind === 'ring' ? 'ring' : `trophy-${kind}`).setDisplaySize(300, 300);
      panel.add([rays, tro]);
      this.tweens.add({ targets: rays, alpha: { from: 0.9, to: 0.4 }, duration: 800, yoyo: true, repeat: -1 });
      tro.setScale(0);
      this.tweens.add({ targets: tro, scale: 300 / tro.width, duration: 600, ease: 'Back.easeOut', delay: 200 });
    }
    panel.add(text(this, 0, -60, place === 1 ? 'CHAMPION!' : `You finished ${ordinal(place)}`, 64, '900', place === 1 ? '#ffd75e' : '#ffffff', DISPLAY_FONT));
    panel.add(text(this, 0, 10, `${event} · ${sub}`, 28, '600', '#9a8f9e'));
    panel.add(text(this, 0, 100, prize > 0 ? `+${fmt(prize)}` : 'No prize this time', prize > 0 ? 84 : 44, '900', prize > 0 ? GOLD : '#9a8f9e'));
    panel.add(this.pillButton(0, 270, 'pill-raise', again, 640, 120, () => onAgain()));
    panel.add(this.pillButton(0, 420, 'pill-dark', 'Poker lobby', 640, 110, () => this.scene.start('pokerlobby')));
    void dim;
    popIn(this, panel);
    if (prize > 0) {
      audio.win();
      haptics.fire('success');
    } else audio.invalid();
  }

  /** A 3D pill button with a label. */
  private pillButton(x: number, y: number, key: string, label: string, w: number, h: number, onTap: () => void): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const img = this.add.image(0, 0, key).setDisplaySize(w, h);
    c.add([img, text(this, 0, 0, label, Math.round(h * 0.36), '900', '#ffffff').setShadow(0, 2, '#000000', 4, true, true)]);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => c.setScale(0.95));
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerup', () => {
      c.setScale(1);
      audio.tap();
      onTap();
    });
    return c;
  }

  private holePos(i: number, k: number): { x: number; y: number } {
    const s = SEATS[i]!;
    if (i === 0) return { x: s.x - 72 + k * 144, y: 1395 };
    const side = s.x < 540 ? 1 : s.x > 540 ? -1 : 0;
    if (i === 3) return { x: s.x + 96 + k * 34, y: s.y + 20 };
    return { x: s.x + side * (AV / 2 + 18 + k * 30), y: s.y - 6 };
  }

  private placeDealerButton(): void {
    const t = this.table!;
    const p = SEATS[t.button]!;
    const x = p.x + (p.x < 540 ? 92 : p.x > 540 ? -92 : -100);
    const y = p.y + (t.button === 0 ? -90 : 76);
    if (!this.dealerBtn) {
      this.dealerBtn = this.add.container(x, y, [this.add.ellipse(3, 8, 58, 30, 0x000000, 0.45), this.add.image(0, 0, 'dealer').setDisplaySize(66, 66)]).setDepth(15);
    } else this.tweens.add({ targets: this.dealerBtn, x, y, duration: 400, ease: 'Cubic.easeInOut' });
  }

  private step(): void {
    if (!this.table) return;
    const t = this.table!;
    if (this.stepping) return;
    this.syncBoard();
    this.syncBets(true);
    this.syncSeats();
    if (t.street === 'done') return this.showResults();
    if (t.toAct === 0) return this.humanTurn();
    const i = t.toAct;
    const me = t.seats[0]!;
    // once you're out of the hand the others play faster
    const think = me.folded || me.out ? Phaser.Math.Between(250, 450) : Phaser.Math.Between(700, 1300);
    this.stepping = true;
    this.startTimer(i, think);
    this.time.delayedCall(think, () => {
      this.stepping = false;
      this.stopTimer(i);
      if (t.toAct !== i || t.street === 'done') return this.step();
      t.act(decide(t, i, this.seats[i]!.p));
      this.afterAction(i);
    });
  }

  private afterAction(i: number): void {
    if (!this.table) return;
    const a = this.table.seats[i]!.lastAction ?? '';
    if (a === 'Fold') audio.fold();
    else if (a === 'Check') audio.knock();
    else audio.chips(a === 'All in' ? 7 : 3);
    this.bubble(i, a);
    if (a === 'Fold') {
      // toss the cards in
      this.seats[i]!.cards.forEach((c) => this.tweens.add({ targets: c, x: CENTER.x, y: CENTER.y, alpha: 0, angle: 90, duration: 300 }));
      this.seats[i]!.avatar.setAlpha(0.45);
    }
    this.step();
  }

  private startTimer(i: number, ms: number): void {
    const ui = this.seats[i]!;
    const pos = SEATS[i]!;
    this.drawRing(ui, true);
    this.thinking?.stop();
    this.thinking = this.tweens.addCounter({
      from: 1,
      to: 0,
      duration: ms,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        ui.timer.clear();
        ui.timer.lineStyle(8, v > 0.3 ? 0x5ee08f : 0xffb347, 1);
        ui.timer.beginPath();
        ui.timer.arc(pos.x, pos.y, AV / 2 + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v, false);
        ui.timer.strokePath();
      },
    });
  }

  private stopTimer(i: number): void {
    this.thinking?.stop();
    this.thinking = null;
    this.seats[i]!.timer.clear();
    this.drawRing(this.seats[i]!, false);
  }

  private bubble(i: number, label: string): void {
    const ui = this.seats[i]!;
    ui.bubble?.destroy();
    const p = SEATS[i]!;
    const color = label === 'Fold' ? 0x6a6470 : label === 'Check' ? 0x2f6f8f : label.startsWith('All') ? 0xb3283f : 0x3f7f3f;
    const t = text(this, 0, 0, label, 26, '800', '#ffffff');
    const g = this.add.graphics();
    g.fillStyle(color, 0.95);
    g.fillRoundedRect(-t.width / 2 - 16, -22, t.width + 32, 44, 22);
    ui.bubble = this.add.container(p.x, p.y - AV / 2 - 30, [g, t]).setDepth(25);
    popIn(this, ui.bubble);
  }

  // ------------------------------------------------------------ syncing
  private syncSeats(): void {
    const t = this.table!;
    t.seats.forEach((s, i) => {
      const ui = this.seats[i]!;
      ui.stack.setText(s.allIn ? 'ALL IN' : fmt(s.stack)).setColor(s.allIn ? '#ff8a9a' : BRASS_HEX);
    });
    const me = t.seats[0]!;
    this.handLabel.setText(!me.folded && t.board.length >= 3 ? t.handName(0) : '');
  }

  /** Animate bets: growing stacks in front of players; at the end of a round, slide them into the pot. */
  private syncBets(animate: boolean): void {
    const t = this.table!;
    const total = t.seats.reduce((a, s) => a + s.bet, 0);
    const shownTotal = this.seats.reduce((a, u) => a + u.shownBet, 0);
    if (total === 0 && shownTotal > 0) {
      // round over: everything slides to the pot
      audio.chips(5, 0.7);
      for (const ui of this.seats) {
        if (!ui.bet) continue;
        const b = ui.bet;
        ui.bet = null;
        ui.shownBet = 0;
        this.tweens.add({ targets: b, x: POT.x, y: POT.y, scale: 0.7, alpha: 0.2, duration: 380, ease: 'Cubic.easeIn', onComplete: () => b.destroy() });
      }
      this.time.delayedCall(380, () => this.syncPot());
      return;
    }
    t.seats.forEach((s, i) => {
      const ui = this.seats[i]!;
      if (s.bet === ui.shownBet) return;
      ui.bet?.destroy();
      ui.shownBet = s.bet;
      if (s.bet <= 0) {
        ui.bet = null;
        return;
      }
      const spot = this.betSpot(i);
      const stack = this.chipStack(spot.x, spot.y, s.bet);
      if (animate) {
        stack.setPosition(SEATS[i]!.x, SEATS[i]!.y);
        this.tweens.add({ targets: stack, x: spot.x, y: spot.y, duration: 280, ease: 'Cubic.easeOut' });
      }
      ui.bet = stack;
    });
    this.syncPot();
  }

  private syncPot(): void {
    const t = this.table!;
    const inPot = t.pot - t.seats.reduce((a, s) => a + s.bet, 0);
    if (inPot === this.shownPot && this.pot) return;
    this.pot?.destroy();
    this.shownPot = inPot;
    if (inPot <= 0) {
      this.pot = null;
      return;
    }
    this.pot = this.chipStack(POT.x, POT.y, inPot, false);
    const t2 = text(this, 0, 40, `Pot ${fmt(inPot)}`, 32, '800', '#ffffff');
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(-t2.width / 2 - 20, 20, t2.width + 40, 42, 21);
    this.pot.add([bg, t2]);
  }

  private syncBoard(): void {
    const t = this.table!;
    for (let k = this.board.length; k < t.board.length; k++) {
      const x = CENTER.x + (k - 2) * 142;
      const c = dealCard(this, POT, x, BOARD_Y, t.board[k]!, (k - this.board.length) * 160 + 200, 0.8);
      c.setDepth(10);
      this.board.push(c);
    }
  }

  // ------------------------------------------------------------ human turn
  private clearControls(): void {
    this.controls.forEach((c) => c.destroy());
    this.controls = [];
  }

  private controlPanel(): void {
    const w = VW;
    const h = this.bottom;
    const g = this.add.graphics().setDepth(55);
    g.fillStyle(PANEL, 0.92);
    g.fillRect(-1000, h - 210, w + 2000, 210 + 1000);
    g.lineStyle(2, BRASS, 0.5);
    g.lineBetween(-1000, h - 210, w + 1000, h - 210);
    this.controls.push(g);
  }

  private humanTurn(): void {
    if (!this.table) return;
    const t = this.table!;
    const L = t.legal(0);
    this.clearControls();
    this.drawRing(this.seats[0]!, true);
    this.controlPanel();
    const w = VW;
    const h = this.bottom;
    const y = h - 105;
    const act = (fn: () => void) => () => {
      haptics.fire('light');
      this.clearControls();
      this.drawRing(this.seats[0]!, false);
      fn();
      this.afterAction(0);
    };
    const btn = (x: number, key: string, label: string, fn: () => void) => this.pillButton(x, y, key, label, 320, 118, fn).setDepth(60);
    this.controls.push(
      btn(w / 2 - 345, 'pill-fold', 'FOLD', act(() => t.act({ type: 'fold' }))),
      btn(w / 2, 'pill-call', L.canCheck ? 'CHECK' : `CALL ${fmt(L.toCall)}`, act(() => t.act({ type: L.canCheck ? 'check' : 'call' }))),
    );
    if (L.canRaise) this.controls.push(btn(w / 2 + 345, 'pill-raise', t.currentBet > 0 ? 'RAISE' : 'BET', () => this.raisePanel()));
  }

  /** Bet slider with quick sizes. */
  private raisePanel(): void {
    const t = this.table!;
    const L = t.legal(0);
    audio.tap();
    this.clearControls();
    const w = VW;
    const h = this.bottom;
    const g = this.add.graphics().setDepth(55);
    g.fillStyle(PANEL, 0.95);
    g.fillRect(-1000, h - 380, w + 2000, 380 + 1000);
    g.lineStyle(2, BRASS, 0.5);
    g.lineBetween(-1000, h - 380, w + 1000, h - 380);
    this.controls.push(g);
    const min = L.minRaiseTo;
    const max = L.maxRaiseTo;
    let value = Math.min(max, Math.max(min, t.currentBet + Math.round(t.pot / 2)));
    const trackX0 = 120;
    const trackX1 = w - 120;
    const trackY = h - 270;
    const track = this.add.graphics().setDepth(56);
    const knob = this.add.circle(0, trackY, 30, 0xf4f1ea).setDepth(57).setStrokeStyle(4, BRASS).setInteractive({ draggable: true, useHandCursor: true });
    const label = text(this, w / 2, h - 340, '', 40, '800', '#ffffff').setDepth(57);
    const draw = () => {
      const f = max === min ? 1 : (value - min) / (max - min);
      const x = trackX0 + (trackX1 - trackX0) * f;
      track.clear();
      track.fillStyle(0x3a343c, 1);
      track.fillRoundedRect(trackX0, trackY - 8, trackX1 - trackX0, 16, 8);
      track.fillStyle(0x3f9f5f, 1);
      track.fillRoundedRect(trackX0, trackY - 8, Math.max(16, x - trackX0), 16, 8);
      knob.x = x;
      label.setText(value >= max ? `All in  ${fmt(max)}` : `${t.currentBet > 0 ? 'Raise to' : 'Bet'} ${fmt(value)}`);
    };
    const setFrom = (x: number) => {
      const f = Phaser.Math.Clamp((x - trackX0) / (trackX1 - trackX0), 0, 1);
      const raw = min + (max - min) * f;
      value = f >= 0.995 ? max : Math.min(max, Math.max(min, Math.round(raw / t.bb) * t.bb));
      draw();
    };
    knob.on('drag', (_p: Phaser.Input.Pointer, x: number) => setFrom(x));
    const hit = this.add.zone(w / 2, trackY, trackX1 - trackX0 + 60, 90).setInteractive().setDepth(56);
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => setFrom(p.x));
    this.controls.push(track, knob, label, hit);
    const presets: [string, number][] = [
      ['½ Pot', t.currentBet + Math.round(t.pot / 2)],
      ['¾ Pot', t.currentBet + Math.round((t.pot * 3) / 4)],
      ['Pot', t.currentBet + t.pot],
      ['All in', max],
    ];
    presets.forEach(([lbl, v], k) => {
      this.controls.push(
        this.pillButton(w / 2 + (k - 1.5) * 240, h - 185, 'pill-dark', lbl, 225, 82, () => {
          value = Math.min(max, Math.max(min, v));
          draw();
        }).setDepth(58),
      );
    });
    this.controls.push(
      this.pillButton(w / 2 - 300, h - 75, 'pill-dark', 'BACK', 280, 100, () => this.humanTurn()).setDepth(58),
      this.pillButton(w / 2 + 150, h - 75, 'pill-raise', 'CONFIRM', 440, 112, () => {
        haptics.fire('light');
        this.clearControls();
        this.drawRing(this.seats[0]!, false);
        t.act(value >= max ? { type: 'allin' } : { type: 'raise', to: value });
        this.afterAction(0);
      }).setDepth(58),
    );
    draw();
  }

  // ------------------------------------------------------------ results
  private showResults(): void {
    if (!this.table) return;
    const t = this.table!;
    this.clearControls();
    const showdown = t.board.length === 5 && t.seats.filter((s) => !s.folded && !s.out).length > 1;
    if (showdown) {
      t.seats.forEach((s, i) => {
        if (i === 0 || s.folded || s.out) return;
        const ui = this.seats[i]!;
        ui.cards.forEach((c, k) => {
          const p = SEATS[i]!;
          const side = p.x < 540 ? 1 : p.x > 540 ? -1 : 0;
          this.tweens.add({
            targets: c,
            x: i === 3 ? p.x - 60 + k * 120 + 170 : p.x + side * (110 + k * 70),
            y: i === 3 ? p.y + 30 : p.y + 10,
            angle: 0,
            duration: 220,
          });
          c.setDisplaySize(CARD_W * 0.6, CARD_H * 0.6).setDepth(14);
          flipCard(this, c, s.cards[k]!, 120 + k * 90);
        });
      });
    }
    // pot slides to the winner(s)
    const potObj = this.pot;
    this.pot = null;
    let humanWon = 0;
    const lines: string[] = [];
    t.results.forEach((r) => {
      const share = Math.floor(r.amount / r.winners.length);
      if (r.winners.includes(0)) humanWon += share;
      const names = r.winners.map((i) => t.seats[i]!.name);
      lines.push(`${names.length > 1 ? `${names.join(' & ')} split` : names[0] === 'You' ? 'You win' : `${names[0]} wins`} ${fmt(r.amount)}${r.hand ? ` · ${r.hand}` : ''}`);
      r.winners.forEach((wi) => {
        this.drawRing(this.seats[wi]!, false, true);
        const p = SEATS[wi]!;
        const stack = this.chipStack(POT.x, POT.y, share, false);
        this.tweens.add({ targets: stack, x: p.x, y: p.y, duration: 520, delay: showdown ? 900 : 300, ease: 'Cubic.easeInOut', onComplete: () => stack.destroy() });
      });
    });
    potObj?.destroy();
    for (const ui of this.seats) ui.bet?.destroy();
    this.time.delayedCall(showdown ? 1100 : 450, () => {
      audio.chips(6);
      this.syncSeats();
    });
    const w = VW;
    const msg = this.add.container(w / 2, 1150).setDepth(40);
    const tx = text(this, 0, 0, lines.join('\n'), 34, '800', '#ffffff');
    const bg = this.add.graphics();
    bg.fillStyle(PANEL, 0.88);
    bg.fillRoundedRect(-tx.width / 2 - 30, -tx.height / 2 - 18, tx.width + 60, tx.height + 36, 22);
    bg.lineStyle(2, BRASS, 0.6);
    bg.strokeRoundedRect(-tx.width / 2 - 30, -tx.height / 2 - 18, tx.width + 60, tx.height + 36, 22);
    msg.add([bg, tx]);
    msg.setAlpha(0);
    this.tweens.add({ targets: msg, alpha: 1, delay: showdown ? 700 : 200, duration: 250 });
    if (this.sng) this.recordEliminations();
    if (!t.seats[0]!.out) {
      player.wager(t.bb * 10);
      player.event('holdem_hand');
      if (humanWon > 0) {
        player.event('holdem_pot');
        player.event('coins_won', humanWon);
      }
      this.refresh();
    }
    if (humanWon > 0) {
      this.time.delayedCall(showdown ? 1200 : 500, () => audio.complete());
      haptics.fire('success');
      wallet.recordWin(humanWon);
    }
    this.time.delayedCall(showdown ? 4200 : 2600, () => {
      msg.destroy();
      this.newHand();
    });
  }

  private busted(): void {
    const w = VW;
    const panel = this.add.container(w / 2, 960).setDepth(100);
    panel.add([this.panelBg(820, 560), text(this, 0, -180, 'Out of chips', 56, '800', '#ffffff')]);
    panel.add(
      makeButton(this, 0, -20, `Rebuy ${fmt(this.stake.buyIn)}`, () => {
        if (!wallet.spend(this.stake.buyIn)) return outOfCoins(this, this.refresh);
        this.refresh();
        this.table!.seats[0]!.stack = this.stake.buyIn;
        this.table!.seats[0]!.out = false;
        panel.destroy();
        this.newHand();
      }, { width: 620, height: 130, fontSize: 44, color: 0x3f7f3f, shadow: 0x173a17, textColor: '#ffffff', theme: THEME }),
    );
    panel.add(makeButton(this, 0, 150, 'Leave table', () => this.scene.start('pokerlobby'), { width: 620, height: 110, fontSize: 40, color: 0x2a242c, shadow: 0x0d0b0d, textColor: '#e9e4ea', theme: THEME }));
    popIn(this, panel);
  }

  private leave(): void {
    const t = this.table;
    // cancel computer players' pending moves and any queued deals
    this.time.removeAllEvents();
    this.thinking?.stop();
    this.clearControls();
    if (t && (this.sng || this.mtt)) {
      this.toast('You left the tournament');
      this.table = null;
    } else if (t) {
      const chips = t.seats[0]!.stack;
      if (chips > 0) {
        wallet.add(chips);
        this.toast(`Cashed out ${fmt(chips)}`);
        audio.chips(6);
      }
      this.table = null;
    }
    this.time.delayedCall(t ? 700 : 0, () => this.scene.start('pokerlobby'));
  }

  /** Finishing place for a knocked-out seat (6th is the first one out). */
  private placeOf(seat: number): number {
    const k = this.eliminated.indexOf(seat);
    return k < 0 ? 1 : 6 - k;
  }

  private recordEliminations(): void {
    const t = this.table!;
    t.seats.forEach((s, i) => {
      if (s.stack > 0 || this.eliminated.includes(i)) return;
      this.eliminated.push(i);
      const place = this.placeOf(i);
      const ui = this.seats[i]!;
      ui.avatar.setAlpha(0.3);
      ui.stack.setText('OUT');
      if (i !== 0) this.toast(`${s.name} is out in ${ordinal(place)}`);
    });
  }

  private finishSng(place: number): void {
    const sg = this.sng!;
    this.stopPlay();
    const prize = prizeFor(sg.buyIn, place);
    if (prize > 0) {
      wallet.add(prize);
      wallet.recordWin(prize);
      player.event('coins_won', prize);
      if (place === 1) player.event('holdem_pot', 3);
      this.refresh();
    }
    const kind = place === 1 ? 'gold' : place === 2 ? 'silver' : place === 3 ? 'bronze' : null;
    if (kind) trophies.add({ kind, event: sg.name, place, prize });
    const idx = SNG_BUYINS.indexOf(sg);
    this.endPanel(place, sg.name, prize, kind, `Play again  ·  ${fmt(sg.buyIn)}`, () => {
      if (!wallet.spend(sg.buyIn)) return outOfCoins(this, this.refresh);
      this.scene.restart({ mode: 'sng', sng: Math.max(0, idx) });
    }, '6 players');
    this.table = null;
  }

  private toast(msg: string): void {
    const t = text(this, CENTER.x, 560, msg, 32, '700', '#ffffff').setDepth(45);
    const bg = this.add.graphics().setDepth(44);
    bg.fillStyle(PANEL, 0.85);
    bg.fillRoundedRect(CENTER.x - t.width / 2 - 24, 534, t.width + 48, 52, 26);
    this.tweens.add({ targets: [t, bg], alpha: 0, delay: 1600, duration: 400, onComplete: () => (t.destroy(), bg.destroy()) });
  }
}

function ordinal(n: number): string {
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
}
