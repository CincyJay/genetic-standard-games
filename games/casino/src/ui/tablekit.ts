import Phaser from 'phaser';
import { GOLD, THEME, audio, fmt, haptics, player, wallet } from '../services.ts';
import { chipPicker, coinShower, makeButton, outOfCoins, text } from './common.ts';
import type { Dealer } from './dealer.ts';

export const TABLE_CHIPS = [10, 50, 100, 500, 1000, 5000];
export const SPOT_MAX = 50_000;

export interface Spot {
  id: string;
  x: number;
  y: number;
  r: number;
  label: string;
  /** Small print under the label ("1 to 1"). */
  pays: string;
  color?: number;
}

/**
 * Shared bits for the card table games: bet spots printed on the felt with 3D
 * chip stacks, the chip rack, and Clear / Deal buttons. Scenes own the game
 * flow; this keeps the betting the same everywhere.
 */
export class BetBoard {
  bets: Record<string, number> = {};
  /** Last round's bets, for Rebet. */
  last: Record<string, number> = {};
  chip = 100;
  locked = false;
  private layer: Phaser.GameObjects.Container;
  private zones: Phaser.GameObjects.Zone[] = [];
  private picker: Phaser.GameObjects.GameObject[] = [];
  readonly scene: Phaser.Scene;
  readonly spots: Spot[];
  private readonly onChange: () => void;

  constructor(scene: Phaser.Scene, spots: Spot[], onChange: () => void) {
    this.scene = scene;
    this.spots = spots;
    this.onChange = onChange;
    this.layer = scene.add.container(0, 0).setDepth(5);
    for (const s of spots) {
      const z = scene.add.zone(s.x, s.y, s.r * 2.2, s.r * 2.2).setInteractive({ useHandCursor: true }).setDepth(6);
      z.on('pointerup', () => this.add(s.id));
      this.zones.push(z);
    }
    this.draw();
  }

  get total(): number {
    return Object.values(this.bets).reduce((a, b) => a + b, 0);
  }

  add(id: string, amount = this.chip): void {
    if (this.locked) return;
    audio.unlock();
    const cur = this.bets[id] ?? 0;
    if (cur + amount > SPOT_MAX) {
      audio.invalid();
      return;
    }
    if (this.total + amount > wallet.coins) {
      audio.invalid();
      haptics.fire('error');
      return;
    }
    this.bets[id] = cur + amount;
    audio.chip();
    this.draw();
    this.onChange();
  }

  clear(): void {
    if (this.locked) return;
    this.bets = {};
    audio.tap();
    this.draw();
    this.onChange();
  }

  rebet(): void {
    if (this.locked) return;
    const sum = Object.values(this.last).reduce((a, b) => a + b, 0);
    if (!sum || sum > wallet.coins) return;
    this.bets = { ...this.last };
    audio.chips(3);
    this.draw();
    this.onChange();
  }

  /** Takes the stake from the wallet; false (and nothing taken) if it can't be covered. */
  pay(refresh: () => void): boolean {
    const t = this.total;
    if (t <= 0) return false;
    if (!wallet.spend(t)) {
      outOfCoins(this.scene, refresh);
      return false;
    }
    player.wager(t);
    this.last = { ...this.bets };
    this.locked = true;
    refresh();
    return true;
  }

  /** Highlight winning spots after a round. */
  flash(ids: string[]): void {
    for (const id of ids) {
      const s = this.spots.find((x) => x.id === id);
      if (!s) continue;
      const g = this.scene.add.graphics().setDepth(7);
      g.lineStyle(10, 0xffe14a, 1);
      g.strokeCircle(s.x, s.y, s.r + 6);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 450, yoyo: true, repeat: 3, onComplete: () => g.destroy() });
    }
  }

  draw(): void {
    this.layer.removeAll(true);
    for (const s of this.spots) {
      const amt = this.bets[s.id] ?? 0;
      const g = this.scene.add.graphics();
      g.fillStyle(s.color ?? 0x000000, s.color ? 0.35 : 0.18);
      g.fillCircle(s.x, s.y, s.r);
      g.lineStyle(5, 0xe9c86a, amt ? 1 : 0.75);
      g.strokeCircle(s.x, s.y, s.r);
      g.lineStyle(2, 0xe9c86a, 0.4);
      g.strokeCircle(s.x, s.y, s.r - 10);
      this.layer.add(g);
      if (!amt) {
        this.layer.add(text(this.scene, s.x, s.y - (s.r > 70 ? 14 : 8), s.label, s.r > 70 ? 34 : 24, '900', GOLD).setStroke('#000000', 4));
        this.layer.add(text(this.scene, s.x, s.y + (s.r > 70 ? 26 : 18), s.pays, s.r > 70 ? 22 : 18, '700', 'rgba(255,244,220,0.75)'));
      } else {
        stackChips(this.scene, this.layer, s.x, s.y + 8, amt, Math.min(110, s.r * 1.25));
        const t = text(this.scene, s.x, s.y + s.r - 4, fmt(amt), 26, '900', '#ffffff');
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x000000, 0.7);
        bg.fillRoundedRect(s.x - t.width / 2 - 12, s.y + s.r - 22, t.width + 24, 36, 18);
        this.layer.add([bg, t]);
        this.layer.add(text(this.scene, s.x, s.y - s.r - 18, s.label, 22, '900', GOLD).setStroke('#000000', 4));
      }
    }
  }

  /** The chip rack (pick a chip value). */
  showPicker(y: number): void {
    (this.scene.data.get('dealer') as Dealer | undefined)?.say('bets');
    this.hidePicker();
    this.picker = chipPicker(this.scene, y, TABLE_CHIPS, this.chip, (v) => (this.chip = v));
  }

  hidePicker(): void {
    this.picker.forEach((o) => o.destroy());
    this.picker = [];
  }
}

/** A stack of 3D chips (seen from above) adding up to `amount`. */
export function stackChips(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, x: number, y: number, amount: number, size: number): void {
  let rest = amount;
  let k = 0;
  for (const v of [...TABLE_CHIPS].reverse()) {
    while (rest >= v && k < 7) {
      layer.add(scene.add.image(x + (k % 2) * 2, y - k * 7, `chip-${v}`).setDisplaySize(size, size));
      rest -= v;
      k++;
    }
  }
  if (k === 0) layer.add(scene.add.image(x, y, 'chip-10').setDisplaySize(size, size));
}

/** Pays out a round: adds coins, records wins, shows a shower and result banner text. */
export function payout(scene: Phaser.Scene, back: number, staked: number, refresh: () => void, at: { x: number; y: number }): void {
  (scene.data.get('dealer') as Dealer | undefined)?.react(back - staked, staked);
  if (back > 0) {
    wallet.add(back);
    refresh();
  }
  const profit = back - staked;
  if (profit > 0) {
    wallet.recordWin(profit);
    player.event('coins_won', profit);
    coinShower(scene, at.x, at.y, profit);
    if (profit >= staked * 4) audio.win();
    else audio.complete();
    haptics.fire('success');
  }
}

/** Standard bottom controls: Clear and a primary button. */
export function bottomButtons(scene: Phaser.Scene, y: number, left: { label: string; fn: () => void } | null, right: { label: string; fn: () => void }, extra?: { label: string; fn: () => void }): Phaser.GameObjects.Container[] {
  const out: Phaser.GameObjects.Container[] = [];
  if (left) out.push(makeButton(scene, 190, y, left.label, left.fn, { width: 260, height: 104, fontSize: 38, color: 0x2a2430, theme: THEME }));
  if (extra) out.push(makeButton(scene, 470, y, extra.label, extra.fn, { width: 260, height: 104, fontSize: 38, color: 0x5a1a8a, theme: THEME }));
  out.push(makeButton(scene, 820, y, right.label, right.fn, { width: 360, height: 116, fontSize: 46, theme: THEME }));
  return out;
}
