import Phaser from 'phaser';
import { makeButton, popIn } from '@tgs/kit';
import { cardId } from '../logic/cards.ts';
import { HoldemTable, decide, type Personality } from '../logic/holdem.ts';
import { DANGER, DISPLAY_FONT, GOLD, SECONDARY, THEME, audio, fmt, haptics, wallet } from '../services.ts';
import { CARD_H, CARD_W, banner, coinBar, coinShower, dealCard, flipCard, outOfCoins, text } from '../ui/common.ts';

const STAKES = [
  { name: 'Casual', sb: 10, bb: 20, buyIn: 2_000 },
  { name: 'High Roller', sb: 50, bb: 100, buyIn: 10_000 },
  { name: 'VIP Room', sb: 250, bb: 500, buyIn: 50_000 },
];
const SEATS = [
  { x: 540, y: 1440 },
  { x: 150, y: 1170 },
  { x: 150, y: 690 },
  { x: 540, y: 450 },
  { x: 930, y: 690 },
  { x: 930, y: 1170 },
];
const CENTER = { x: 540, y: 880 };
const BOARD_Y = 900;
const BOT_POOL: [string, number, Personality][] = [
  ['Rosa', 0xff4f8b, { aggression: 0.7, bluff: 0.12 }],
  ['Dmitri', 0x4fd1ff, { aggression: 0.3, bluff: 0.04 }],
  ['Kwame', 0x7dff6a, { aggression: 0.5, bluff: 0.08 }],
  ['Lena', 0xffe14a, { aggression: 0.85, bluff: 0.18 }],
  ['Hector', 0xff9a3c, { aggression: 0.2, bluff: 0.03 }],
  ['Priya', 0xc77dff, { aggression: 0.55, bluff: 0.1 }],
  ['Sam', 0x2fd6c3, { aggression: 0.4, bluff: 0.06 }],
  ['Yuki', 0xff7a5c, { aggression: 0.65, bluff: 0.14 }],
];

interface SeatView {
  color: number;
  personality: Personality;
  cards: Phaser.GameObjects.Image[];
}

export class HoldemScene extends Phaser.Scene {
  private table: HoldemTable | null = null;
  private stake = STAKES[0]!;
  private views: SeatView[] = [];
  private poolIndex = 0;
  private refresh!: () => void;
  private layer!: Phaser.GameObjects.Container;
  private controls: Phaser.GameObjects.GameObject[] = [];
  private board: Phaser.GameObjects.Image[] = [];
  private stepping = false;

  constructor() {
    super('holdem');
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.add.image(w / 2, h / 2, 'bg-lobby').setDisplaySize(w, h);
    this.table = null;
    this.views = [];
    this.board = [];
    this.controls = [];
    this.poolIndex = Phaser.Math.Between(0, BOT_POOL.length - 1);
    this.drawTableFelt();
    this.layer = this.add.container(0, 0).setDepth(20);
    this.refresh = coinBar(this, "Hold'em", () => this.leave());
    this.chooseStakes();
    (globalThis as Record<string, unknown>).__holdem = {
      state: () => ({ toAct: this.table?.toAct ?? -1, street: this.table?.street ?? 'none', hand: this.table?.handNumber ?? 0, stack: this.table?.seats[0]!.stack ?? 0 }),
    };
  }

  private drawTableFelt(): void {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(CENTER.x, CENTER.y + 20, 900, 1360);
    g.fillStyle(0x5a2e12, 1);
    g.fillEllipse(CENTER.x, CENTER.y, 900, 1360);
    g.fillStyle(0x7a4520, 1);
    g.fillEllipse(CENTER.x, CENTER.y - 6, 870, 1330);
    g.fillStyle(0x0f6a42, 1);
    g.fillEllipse(CENTER.x, CENTER.y, 780, 1240);
    g.fillStyle(0x1f8a57, 0.6);
    g.fillEllipse(CENTER.x, CENTER.y - 40, 600, 900);
    g.lineStyle(3, 0xe9c86a, 0.45);
    g.strokeEllipse(CENTER.x, CENTER.y, 700, 1150);
    text(this, CENTER.x, 1060, 'VELVET ACE', 40, '900', 'rgba(233,200,106,0.35)', DISPLAY_FONT).setLetterSpacing(6);
  }

  // ------------------------------------------------------------ buy-in
  private chooseStakes(): void {
    const { width: w } = this.scale;
    const panel = this.add.container(w / 2, 900).setDepth(100);
    const bg = this.add.graphics();
    bg.fillStyle(THEME.surfaceEdge, 0.95);
    bg.fillRoundedRect(-440, -420, 880, 840, 48);
    bg.lineStyle(4, 0xe9c86a, 0.9);
    bg.strokeRoundedRect(-440, -420, 880, 840, 48);
    panel.add([bg, text(this, 0, -330, 'Choose a table', 64, '900', GOLD, DISPLAY_FONT)]);
    STAKES.forEach((s, i) => {
      const y = -170 + i * 200;
      panel.add(
        makeButton(
          this,
          0,
          y,
          `${s.name}  ·  buy-in ${fmt(s.buyIn)}`,
          () => {
            if (!wallet.spend(s.buyIn)) return outOfCoins(this, this.refresh);
            this.refresh();
            audio.unlock();
            audio.complete();
            this.stake = s;
            panel.destroy();
            this.sitDown();
          },
          { width: 760, height: 130, fontSize: 40, theme: THEME, ...(i === 0 ? {} : SECONDARY) },
        ),
      );
      panel.add(text(this, 0, y + 88, `Blinds ${fmt(s.sb)} / ${fmt(s.bb)}`, 28, '600', THEME.inkSoft));
    });
    popIn(this, panel);
  }

  private nextBot(): [string, number, Personality] {
    const b = BOT_POOL[this.poolIndex % BOT_POOL.length]!;
    this.poolIndex++;
    return b;
  }

  private sitDown(): void {
    const seats = [{ name: 'You', stack: this.stake.buyIn, human: true }];
    this.views = [{ color: 0xe9c86a, personality: { aggression: 0, bluff: 0 }, cards: [] }];
    for (let i = 1; i < 6; i++) {
      const [name, color, personality] = this.nextBot();
      seats.push({ name, stack: this.stake.buyIn, human: false });
      this.views.push({ color, personality, cards: [] });
    }
    this.table = new HoldemTable(seats, this.stake.sb, this.stake.bb);
    this.newHand();
  }

  // ------------------------------------------------------------ hand flow
  private newHand(): void {
    const t = this.table!;
    // replace busted computer players so the table stays full
    for (let i = 1; i < 6; i++) {
      if (t.seats[i]!.stack <= 0) {
        const [name, color, personality] = this.nextBot();
        Object.assign(t.seats[i]!, { name, stack: this.stake.buyIn, out: false });
        this.views[i] = { color, personality, cards: [] };
        this.toast(`${name} joins the table`);
      }
    }
    if (t.seats[0]!.stack <= 0) return this.busted();
    for (const v of this.views) v.cards.forEach((c) => c.destroy());
    this.board.forEach((c) => c.destroy());
    this.board = [];
    t.startHand();
    // deal hole cards
    let d = 0;
    t.seats.forEach((s, i) => {
      const v = this.views[i]!;
      v.cards = [];
      if (s.out) return;
      const human = i === 0;
      for (let k = 0; k < 2; k++) {
        const pos = this.holePos(i, k);
        const card = dealCard(this, CENTER, pos.x, pos.y, human ? s.cards[k]! : null, d, human ? 0.95 : 0.5);
        card.setAngle(human ? (k ? 6 : -6) : k ? 8 : -8);
        v.cards.push(card);
        d += 60;
      }
    });
    this.render();
    this.time.delayedCall(d + 300, () => this.step());
  }

  private holePos(i: number, k: number): { x: number; y: number } {
    const s = SEATS[i]!;
    if (i === 0) return { x: s.x - 70 + k * 140, y: s.y - 210 };
    const towardCenter = s.x < 540 ? 1 : s.x > 540 ? -1 : 0;
    return { x: s.x + towardCenter * 110 + (k - 0.5) * 50, y: s.y + (i === 3 ? 110 : 0) };
  }

  private step(): void {
    const t = this.table!;
    if (this.stepping) return;
    this.syncBoard();
    this.render();
    if (t.street === 'done') return this.showResults();
    if (t.toAct === 0) return this.humanTurn();
    this.stepping = true;
    this.time.delayedCall(Phaser.Math.Between(550, 950), () => {
      this.stepping = false;
      const i = t.toAct;
      if (i < 0 || t.street === 'done') return this.step();
      t.act(decide(t, i, this.views[i]!.personality));
      this.actionSound(t.seats[i]!.lastAction ?? '');
      this.step();
    });
  }

  private actionSound(a: string): void {
    if (a === 'Fold') audio.play([{ freq: 300, to: 200, dur: 0.08, wave: 'triangle', vol: 0.08 }]);
    else if (a === 'Check') audio.tap();
    else audio.play([{ freq: 900, to: 1200, dur: 0.05, wave: 'triangle', vol: 0.12 }, { freq: 1100, to: 1400, dur: 0.05, wave: 'triangle', vol: 0.1, delay: 0.06 }]);
  }

  private syncBoard(): void {
    const t = this.table!;
    for (let k = this.board.length; k < t.board.length; k++) {
      const x = CENTER.x + (k - 2) * 148;
      const c = dealCard(this, CENTER, x, BOARD_Y, t.board[k]!, (k - this.board.length) * 150 + 100, 0.82);
      this.board.push(c);
    }
  }

  // ------------------------------------------------------------- render
  private render(): void {
    const t = this.table!;
    this.layer.removeAll(true);
    // pot
    if (t.pot > 0) {
      const pot = this.add.container(CENTER.x, 700);
      pot.add([this.add.image(-90, 0, 'chip-500').setDisplaySize(70, 70), text(this, 20, 0, `Pot ${fmt(t.pot)}`, 42, '800', '#ffffff')]);
      this.layer.add(pot);
    }
    t.seats.forEach((s, i) => {
      const p = SEATS[i]!;
      const v = this.views[i]!;
      const g = this.add.graphics();
      const active = t.toAct === i && t.street !== 'done';
      if (active) {
        g.fillStyle(0xe9c86a, 0.35);
        g.fillCircle(p.x, p.y, 84);
      }
      g.fillStyle(0x14071f, 1);
      g.fillCircle(p.x, p.y, 68);
      g.fillStyle(v.color, s.folded || s.out ? 0.35 : 1);
      g.fillCircle(p.x, p.y, 60);
      g.lineStyle(4, active ? 0xffffff : 0xe9c86a, 1);
      g.strokeCircle(p.x, p.y, 68);
      this.layer.add(g);
      this.layer.add(text(this, p.x, p.y, s.name[0]!, 60, '900', '#14071f'));
      const plate = this.add.graphics();
      plate.fillStyle(0x000000, 0.7);
      plate.fillRoundedRect(p.x - 100, p.y + 70, 200, 76, 18);
      this.layer.add(plate);
      this.layer.add(text(this, p.x, p.y + 92, s.name, 28, '700', '#ffffff'));
      this.layer.add(text(this, p.x, p.y + 124, s.allIn ? 'ALL IN' : fmt(s.stack), 28, '800', s.allIn ? '#ff6b7a' : GOLD));
      // bet in front of the seat
      if (s.bet > 0) {
        const bx = p.x + (CENTER.x - p.x) * 0.38;
        const by = p.y + (CENTER.y - p.y) * 0.3;
        this.layer.add(this.add.image(bx, by, 'chip-100').setDisplaySize(54, 54));
        this.layer.add(text(this, bx, by + 46, fmt(s.bet), 26, '800', '#ffffff').setStroke('#000000', 6));
      }
      // last action bubble
      if (s.lastAction && t.street !== 'done') {
        const bub = text(this, p.x, p.y - 100, s.lastAction, 28, '800', '#14071f');
        const bg = this.add.graphics();
        bg.fillStyle(s.lastAction === 'Fold' ? 0xbbbbbb : 0xffffff, 1);
        bg.fillRoundedRect(p.x - bub.width / 2 - 18, p.y - 124, bub.width + 36, 48, 24);
        this.layer.add([bg, bub]);
      }
      if (i === t.button) {
        const dx = p.x + (p.x < 540 ? 80 : p.x > 540 ? -80 : 96);
        const dy = p.y - 60;
        const d = this.add.graphics();
        d.fillStyle(0xffffff, 1);
        d.fillCircle(dx, dy, 24);
        d.lineStyle(3, 0x14071f, 1);
        d.strokeCircle(dx, dy, 24);
        this.layer.add([d, text(this, dx, dy, 'D', 26, '900', '#14071f')]);
      }
      // dim folded hands
      v.cards.forEach((c) => c.setAlpha(s.folded ? 0.35 : 1));
    });
    // human's current hand name
    const me = t.seats[0]!;
    if (!me.folded && me.cards.length && t.board.length >= 3) {
      this.layer.add(text(this, SEATS[0]!.x, SEATS[0]!.y - 345, t.handName(0), 34, '800', GOLD).setStroke('#000000', 6));
    }
  }

  // ------------------------------------------------------------ human turn
  private clearControls(): void {
    this.controls.forEach((c) => c.destroy());
    this.controls = [];
  }

  private humanTurn(): void {
    const t = this.table!;
    const L = t.legal(0);
    this.clearControls();
    const { width: w } = this.scale;
    const act = (fn: () => void) => () => {
      haptics.fire('light');
      this.clearControls();
      fn();
      this.actionSound(t.seats[0]!.lastAction ?? '');
      this.step();
    };
    const row1 = 1690;
    this.controls.push(
      makeButton(this, w / 2 - 260, row1, 'Fold', act(() => t.act({ type: 'fold' })), { width: 400, height: 120, fontSize: 46, ...DANGER, theme: THEME }),
      makeButton(
        this,
        w / 2 + 210,
        row1,
        L.canCheck ? 'Check' : `Call ${fmt(L.toCall)}`,
        act(() => t.act({ type: L.canCheck ? 'check' : 'call' })),
        { width: 500, height: 120, fontSize: 46, theme: THEME },
      ),
    );
    if (L.canRaise) {
      const pot = t.pot;
      const opts: [string, number][] = [
        [`Min ${fmt(L.minRaiseTo)}`, L.minRaiseTo],
        ['½ Pot', t.currentBet + Math.round(pot / 2)],
        ['Pot', t.currentBet + pot],
        ['All in', L.maxRaiseTo],
      ];
      opts.forEach(([label, to], k) => {
        const x = w / 2 + (k - 1.5) * 245;
        this.controls.push(
          makeButton(
            this,
            x,
            1840,
            label,
            act(() => t.act(label === 'All in' ? { type: 'allin' } : { type: 'raise', to })),
            { width: 230, height: 100, fontSize: label.length > 7 ? 30 : 36, ...SECONDARY, theme: THEME },
          ),
        );
      });
    }
    this.controls.forEach((c) => (c as Phaser.GameObjects.Container).setDepth(60));
  }

  // ------------------------------------------------------------- results
  private showResults(): void {
    const t = this.table!;
    this.clearControls();
    const showdown = t.board.length === 5 && t.seats.filter((s) => !s.folded && !s.out).length > 1;
    if (showdown) {
      t.seats.forEach((s, i) => {
        if (i === 0 || s.folded || s.out) return;
        this.views[i]!.cards.forEach((c, k) => {
          // grow the revealed cards a little so they're readable, then flip
          c.setDisplaySize(CARD_W * 0.62, CARD_H * 0.62);
          flipCard(this, c, s.cards[k]!, k * 80);
        });
      });
    }
    let humanWon = 0;
    const lines = t.results.map((r) => {
      const names = r.winners.map((i) => t.seats[i]!.name);
      if (r.winners.includes(0)) humanWon += Math.floor(r.amount / r.winners.length);
      for (const i of r.winners) {
        const p = SEATS[i]!;
        const ring = this.add.graphics().setDepth(30);
        ring.lineStyle(10, 0xffe14a, 1);
        ring.strokeCircle(p.x, p.y, 80);
        this.tweens.add({ targets: ring, alpha: 0, duration: 500, yoyo: true, repeat: 2, onComplete: () => ring.destroy() });
      }
      const who = names.length > 1 ? `${names.join(' & ')} split` : names[0] === 'You' ? 'You win' : `${names[0]} wins`;
      return `${who} ${fmt(r.amount)}${r.hand ? ` with ${r.hand}` : ''}`;
    });
    const msg = text(this, CENTER.x, 700, lines.join('\n'), 36, '800', '#ffffff').setStroke('#000000', 8).setDepth(40);
    if (humanWon > 0) {
      audio.win();
      haptics.fire('success');
      coinShower(this, SEATS[0]!.x, SEATS[0]!.y - 150, humanWon);
      wallet.recordWin(humanWon);
    }
    this.render();
    this.time.delayedCall(showdown ? 3600 : 2400, () => {
      msg.destroy();
      this.newHand();
    });
  }

  private busted(): void {
    const { width: w } = this.scale;
    const panel = this.add.container(w / 2, 900).setDepth(100);
    const bg = this.add.graphics();
    bg.fillStyle(THEME.surfaceEdge, 0.95);
    bg.fillRoundedRect(-420, -300, 840, 600, 48);
    bg.lineStyle(4, 0xe9c86a, 0.9);
    bg.strokeRoundedRect(-420, -300, 840, 600, 48);
    panel.add([bg, text(this, 0, -200, 'Out of chips', 64, '900', GOLD, DISPLAY_FONT)]);
    panel.add(
      makeButton(this, 0, -30, `Rebuy ${fmt(this.stake.buyIn)}`, () => {
        if (!wallet.spend(this.stake.buyIn)) return outOfCoins(this, this.refresh);
        this.refresh();
        this.table!.seats[0]!.stack = this.stake.buyIn;
        this.table!.seats[0]!.out = false;
        panel.destroy();
        this.newHand();
      }, { width: 640, height: 130, fontSize: 46, theme: THEME }),
    );
    panel.add(makeButton(this, 0, 140, 'Leave table', () => this.scene.start('lobby'), { width: 640, height: 120, fontSize: 42, ...SECONDARY, theme: THEME }));
    popIn(this, panel);
  }

  private leave(): void {
    const t = this.table;
    if (t) {
      const chips = t.seats[0]!.stack;
      if (chips > 0) {
        wallet.add(chips);
        banner(this, 'Cashed out', fmt(chips));
      }
      this.table = null;
    }
    this.time.delayedCall(t ? 600 : 0, () => this.scene.start('lobby'));
  }

  private toast(msg: string): void {
    const t = text(this, CENTER.x, 600, msg, 34, '700', '#ffffff').setStroke('#000000', 8).setDepth(45);
    this.tweens.add({ targets: t, alpha: 0, delay: 1500, duration: 400, onComplete: () => t.destroy() });
  }
}
