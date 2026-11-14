import Phaser from 'phaser';
import { PAYTABLES, VARIANT_NAMES, VideoPokerRound, classify, payFor, type Variant } from '../logic/videopoker.ts';
import { GOLD, SECONDARY, THEME, audio, fmt, haptics, player, wallet } from '../services.ts';
import { CARD_H, CARD_W, banner, coinBar, coinShower, dealCard, flipCard, makeButton, outOfCoins, text } from '../ui/common.ts';
import { VH, VW, backdrop, frame, screenDim } from '../ui/common.ts';

const DENOMS = [10, 50, 100, 500, 1000];
const CARD_Y = 1080;
const DECK = { x: 540, y: 1960 };

export class VideoPokerScene extends Phaser.Scene {
  private coins = 5;
  private variant: Variant = 'jacks';
  private tabs!: Phaser.GameObjects.Container;
  private get paytable() {
    return PAYTABLES[this.variant];
  }
  private denom = 100;
  private round: VideoPokerRound | null = null;
  private sprites: Phaser.GameObjects.Image[] = [];
  private heldTags: Phaser.GameObjects.Text[] = [];
  private table!: Phaser.GameObjects.Container;
  private resultText!: Phaser.GameObjects.Text;
  private betText!: Phaser.GameObjects.Text;
  private dealBtn!: Phaser.GameObjects.Container;
  private refresh!: () => void;
  private busy = false;

  constructor() {
    super('videopoker');
  }

  create(): void {
    const w = VW;
    const h = VH;
    frame(this);
    backdrop(this, 'bg-lobby');
    this.refresh = coinBar(this, 'Video Poker', () => this.scene.start('lobby'));
    // machine screen
    const scr = this.add.graphics();
    scr.fillStyle(0x0b1a5c, 1);
    scr.fillRoundedRect(30, 230, w - 60, 1180, 30);
    scr.lineStyle(6, 0xe9c86a, 0.9);
    scr.strokeRoundedRect(30, 230, w - 60, 1180, 30);
    this.table = this.add.container(0, 0);
    this.tabs = this.add.container(0, 0);
    this.drawTabs();
    this.drawPaytable(null);
    for (let i = 0; i < 5; i++) {
      this.sprites.push(this.add.image(this.cardX(i), CARD_Y, 'card-back').setDisplaySize(CARD_W, CARD_H).setDepth(10));
      this.heldTags.push(text(this, this.cardX(i), CARD_Y - CARD_H / 2 - 36, 'HELD', 34, '900', '#ffe14a').setAlpha(0));
      const zone = this.add.zone(this.cardX(i), CARD_Y, CARD_W + 10, CARD_H + 20).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.toggle(i));
    }
    this.resultText = text(this, w / 2, 1330, 'Choose your bet and deal', 44, '800', '#ffffff');

    // controls
    text(this, 150, 1500, 'COIN', 28, '700', THEME.inkSoft);
    const denomBtns: Phaser.GameObjects.Image[] = [];
    const ring = this.add.graphics();
    DENOMS.forEach((d, i) => {
      const img = this.add.image(280 + i * 150, 1500, `chip-${d}`).setDisplaySize(110, 110).setInteractive({ useHandCursor: true });
      img.on('pointerup', () => {
        if (this.round && !this.round.drawn) return;
        audio.tap();
        this.denom = d;
        mark();
        this.updateBet();
      });
      denomBtns.push(img);
    });
    const mark = () => {
      ring.clear();
      ring.lineStyle(7, 0xffffff, 1);
      const i = DENOMS.indexOf(this.denom);
      ring.strokeCircle(denomBtns[i]!.x, 1500, 62);
    };
    mark();
    this.betText = text(this, w / 2, 1620, '', 40, '800', GOLD);
    makeButton(this, 200, 1780, 'Bet One', () => {
      if (this.round && !this.round.drawn) return;
      audio.tap();
      this.coins = (this.coins % 5) + 1;
      this.updateBet();
    }, { width: 300, height: 120, fontSize: 40, ...SECONDARY, theme: THEME });
    makeButton(this, 520, 1780, 'Max Bet', () => {
      if (this.round && !this.round.drawn) return;
      this.coins = 5;
      this.updateBet();
      this.dealOrDraw();
    }, { width: 300, height: 120, fontSize: 40, ...SECONDARY, theme: THEME });
    this.dealBtn = makeButton(this, 860, 1780, 'Deal', () => this.dealOrDraw(), { width: 320, height: 130, fontSize: 52, theme: THEME });
    this.updateBet();
  }

  private cardX(i: number): number {
    return VW / 2 + (i - 2) * 196;
  }

  private updateBet(): void {
    this.betText.setText(`Bet ${this.coins} × ${fmt(this.denom)} = ${fmt(this.coins * this.denom)}`);
    this.drawPaytable(null);
  }

  /** Game tabs: Jacks or Better, Deuces Wild, Double Double Bonus. */
  private drawTabs(): void {
    this.tabs.removeAll(true);
    (['jacks', 'deuces', 'ddb'] as Variant[]).forEach((v, i) => {
      const x = 70 + i * 315;
      const g = this.add.graphics();
      const on = v === this.variant;
      g.fillStyle(on ? 0xe9b949 : 0x16297a, 1);
      g.fillRoundedRect(x, 254, 300, 70, 35);
      g.lineStyle(2, 0xe9c86a, on ? 1 : 0.5);
      g.strokeRoundedRect(x, 254, 300, 70, 35);
      const t = text(this, x + 150, 289, VARIANT_NAMES[v], v === 'ddb' ? 24 : 30, '800', on ? '#3a1a00' : '#ffe14a');
      const z = this.add.zone(x + 150, 289, 300, 70).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        if (this.busy || (this.round && !this.round.drawn)) return;
        audio.tap();
        this.variant = v;
        this.drawTabs();
        this.drawPaytable(null);
        this.resultText.setText(v === 'deuces' ? 'Every 2 is wild' : v === 'ddb' ? 'Big bonuses for four of a kind' : 'Pairs of jacks or better pay');
      });
      this.tabs.add([g, t, z]);
    });
  }

  /** Paytable with the current coin column and (optionally) the winning row highlighted. */
  private drawPaytable(win: string | null): void {
    this.table.removeAll(true);
    const top = 350;
    const rowH = Math.min(54, 560 / this.paytable.length);
    const font = Math.round(rowH * 0.56);
    const g = this.add.graphics();
    g.fillStyle(0xe9c86a, 0.18);
    g.fillRect(392 + (this.coins - 1) * 128, top - 8, 128, rowH * this.paytable.length + 10);
    if (win) {
      const r = this.paytable.findIndex((p) => p.key === win);
      g.fillStyle(0xff4f8b, 0.45);
      g.fillRect(60, top - 6 + r * rowH, VW - 120, rowH);
    }
    this.table.add(g);
    this.paytable.forEach((p, r) => {
      const y = top + r * rowH + rowH / 2 - 4;
      this.table.add(text(this, 80, y, p.name.toUpperCase(), font, '800', '#ffe14a').setOrigin(0, 0.5));
      p.pays.forEach((v, c) => {
        this.table.add(text(this, 456 + c * 128, y, String(v), font, '800', c === this.coins - 1 ? '#ffffff' : '#ffe14a'));
      });
    });
  }

  private toggle(i: number): void {
    if (!this.round || this.round.drawn || this.busy) return;
    this.round.toggle(i);
    audio.tap();
    haptics.fire('light');
    this.heldTags[i]!.setAlpha(this.round.held[i] ? 1 : 0);
    this.tweens.add({ targets: this.sprites[i], y: CARD_Y - (this.round.held[i] ? 24 : 0), duration: 120 });
  }

  private dealOrDraw(): void {
    if (this.busy) return;
    audio.unlock();
    if (!this.round || this.round.drawn) return this.deal();
    this.draw();
  }

  private deal(): void {
    const bet = this.coins * this.denom;
    if (!wallet.spend(bet)) return outOfCoins(this, this.refresh);
    player.wager(bet);
    player.event('videopoker_hand');
    this.refresh();
    this.busy = true;
    this.drawPaytable(null);
    this.round = new VideoPokerRound();
    const r = this.round;
    this.resultText.setText('Tap cards to hold, then draw');
    this.heldTags.forEach((t) => t.setAlpha(0));
    this.sprites.forEach((s) => s.destroy());
    this.sprites = r.hand.map((c, i) => dealCard(this, DECK, this.cardX(i), CARD_Y, c, i * 110));
    this.setDealLabel('Draw');
    this.time.delayedCall(900, () => {
      this.busy = false;
      const k = classify(r.hand, this.variant);
      if (k) {
        this.drawPaytable(k);
        this.resultText.setText(this.paytable.find((p) => p.key === k)!.name);
      }
    });
  }

  private draw(): void {
    const r = this.round!;
    this.busy = true;
    const replaced = r.held.map((h) => !h);
    r.draw();
    let delay = 0;
    replaced.forEach((rep, i) => {
      if (!rep) return;
      const s = this.sprites[i]!;
      this.tweens.add({
        targets: s,
        y: CARD_Y + 60,
        alpha: 0,
        duration: 120,
        delay,
        onComplete: () => {
          s.setTexture('card-back').setDisplaySize(CARD_W, CARD_H).setY(CARD_Y).setAlpha(1);
          flipCard(this, s, r.hand[i]!);
        },
      });
      delay += 120;
    });
    this.time.delayedCall(delay + 450, () => this.settle());
  }

  private settle(): void {
    const r = this.round!;
    const k = classify(r.hand, this.variant);
    const win = payFor(k, this.coins, this.variant) * this.denom;
    this.drawPaytable(k);
    if (k && payFor(k, 1, this.variant) >= 2) player.event('videopoker_twopair');
    if (win > 0) player.event('coins_won', win);
    if (win > 0) {
      wallet.add(win);
      wallet.recordWin(win);
      this.refresh();
      const name = this.paytable.find((p) => p.key === k)!.name;
      this.resultText.setText(`${name}  ·  Win ${fmt(win)}`);
      if (payFor(k, 1, this.variant) <= 2) audio.complete();
      else {
        audio.win();
        banner(this, name, `+${fmt(win)}`);
        coinShower(this, VW / 2, CARD_Y, win);
      }
      haptics.fire('success');
    } else {
      this.resultText.setText('No win');
    }
    this.heldTags.forEach((t) => t.setAlpha(0));
    this.sprites.forEach((s) => this.tweens.add({ targets: s, y: CARD_Y, duration: 120 }));
    this.setDealLabel('Deal');
    this.busy = false;
  }

  private setDealLabel(label: string): void {
    const t = this.dealBtn.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined;
    t?.setText(label);
  }
}
