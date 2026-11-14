import Phaser from 'phaser';
import { MACHINES, type Machine } from '../logic/slots.ts';
import type { UnlockId } from '../logic/progression.ts';
import { VW, backdrop, coinBar, frame, text } from '../ui/common.ts';
import { cardsArt, gameTile, reelArt, wheelArt, type Tile } from '../ui/tiles.ts';
import { FEATURE_TEXT, machineBg, symKey } from './SlotsScene.ts';

export type RoomId = 'slots' | 'poker' | 'tables';

const SLOT_UNLOCK: Record<string, UnlockId | null> = {
  sevens: null,
  lanterns: 'slots-lanterns',
  pharaoh: 'slots-pharaoh',
  ocean: 'slots-ocean',
  goldrush: 'slots-goldrush',
};
export const SHOWCASE: Record<string, string[]> = {
  sevens: ['seven', 'wild', 'seven'],
  lanterns: ['scatter', 'ingot', 'scatter'],
  pharaoh: ['mask', 'wild', 'gem'],
  ocean: ['shark', 'wild', 'pearl'],
  goldrush: ['nugget', 'wild', 'bar'],
};
const RIBBON: Record<string, string> = { lanterns: 'NEW', sevens: 'HOT' };

export function slotTile(m: Machine): Tile {
  return {
    key: 'slots',
    title: m.name,
    sub: FEATURE_TEXT[m.feature],
    bg: machineBg(m),
    unlock: SLOT_UNLOCK[m.id] ?? null,
    ribbon: RIBBON[m.id],
    data: { machine: m.id },
    art: (scene, c) => reelArt(scene, c, SHOWCASE[m.id]!.map((s) => symKey(m, s)), -70, 118),
  };
}

export interface Room {
  id: RoomId;
  title: string;
  sub: string;
  bg: string;
  games: () => Tile[];
}

export const ROOMS: Room[] = [
  {
    id: 'slots',
    title: 'Slots Room',
    sub: `${MACHINES.length} machines · progressive jackpot`,
    bg: 'room-slots',
    games: () => MACHINES.map(slotTile),
  },
  {
    id: 'poker',
    title: 'Poker Room',
    sub: "Hold'em tables, Sit & Go, video poker",
    bg: 'room-poker',
    games: () => [
      {
        key: 'holdem', title: "Texas Hold'em", sub: 'Cash tables · Sit & Go', bg: 'bg-poker', unlock: null, ribbon: 'HOT',
        art: (s, c) => cardsArt(s, c, 'Ad Ac', true),
      },
      {
        key: 'videopoker', title: 'Jacks or Better', sub: 'Classic video poker', bg: 'bg-slots-ocean', unlock: null, data: { variant: 'jacks' },
        art: (s, c) => cardsArt(s, c, 'Jh Jd Ks 7c 2h', false),
      },
      {
        key: 'videopoker', title: 'Deuces Wild', sub: 'Every 2 is wild', bg: 'bg-slots-ocean', unlock: null, data: { variant: 'deuces' },
        art: (s, c) => cardsArt(s, c, '2s 2h Ac Ad Ah', false),
      },
      {
        key: 'videopoker', title: 'Double Double', sub: 'Big four-of-a-kind bonuses', bg: 'bg-slots-ocean', unlock: null, data: { variant: 'ddb' },
        art: (s, c) => cardsArt(s, c, 'As Ah Ad Ac 2s', false),
      },
    ],
  },
  {
    id: 'tables',
    title: 'Table Games',
    sub: 'Blackjack and roulette',
    bg: 'room-tables',
    games: () => [
      {
        key: 'blackjack', title: 'Blackjack', sub: 'Up to 3 hands · Perfect Pairs · 21+3', bg: 'bg-felt', unlock: null,
        art: (s, c) => cardsArt(s, c, 'As Kh', true, -90, 1.15),
      },
      {
        key: 'roulette', title: 'Roulette', sub: 'European single zero · racetrack', bg: 'bg-felt-red', unlock: null,
        art: (s, c) => wheelArt(s, c, 0, -80, 150),
      },
    ],
  },
];

/** One room of the casino: its games as tiles, scrolling vertically. */
export class RoomScene extends Phaser.Scene {
  private room: Room = ROOMS[0]!;
  private list!: Phaser.GameObjects.Container;
  private dragged = false;

  constructor() {
    super('room');
  }

  init(data: { room?: RoomId }): void {
    this.room = ROOMS.find((r) => r.id === data.room) ?? ROOMS[0]!;
  }

  create(): void {
    const view = frame(this);
    backdrop(this, this.room.bg);
    // darken the room so the tiles pop
    this.add.rectangle(VW / 2, (view.top + view.bottom) / 2, view.right - view.left, view.bottom - view.top, 0x0a0210, 0.35);
    coinBar(this, this.room.title, () => this.scene.start('lobby'));
    text(this, VW / 2, view.top + 255, this.room.sub, 34, '700', '#e9d6ee').setStroke('#000000', 6);

    const games = this.room.games();
    const one = games.length <= 2;
    const w = one ? 1000 : 488;
    const h = one ? 620 : 540;
    const gap = one ? 40 : 24;
    const top = view.top + 320;
    this.list = this.add.container(0, 0);
    games.forEach((t, i) => {
      const col = one ? 0 : i % 2;
      const row = one ? i : Math.floor(i / 2);
      const x = one ? VW / 2 : 40 + w / 2 + col * (w + gap);
      gameTile(this, this.list, t, x, top + h / 2 + row * (h + gap), w, h, i, () => this.dragged);
    });
    const rows = one ? games.length : Math.ceil(games.length / 2);
    const contentH = rows * h + (rows - 1) * gap + 60;
    const minY = Math.min(0, view.bottom - top - contentH);
    this.scroller(minY);
    (globalThis as Record<string, unknown>).__room = {
      id: this.room.id,
      top,
      tile: { w, h, gap, cols: one ? 1 : 2 },
      scrollTo: (y: number) => (this.list.y = Phaser.Math.Clamp(y, minY, 0)),
      listY: () => this.list.y,
    };
  }

  /** Vertical drag with momentum. */
  private scroller(minY: number): void {
    let startY = 0;
    let start = 0;
    let down = false;
    let lastY = 0;
    let lastT = 0;
    let vel = 0;
    let glide: Phaser.Tweens.Tween | null = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y < 200) return; // the top bar
      down = true;
      this.dragged = false;
      glide?.stop();
      startY = lastY = p.y;
      lastT = p.time;
      start = this.list.y;
      vel = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!down) return;
      const dy = p.y - startY;
      if (Math.abs(dy) > 14) this.dragged = true;
      if (!this.dragged) return;
      let y = start + dy;
      if (y > 0) y *= 0.35;
      if (y < minY) y = minY + (y - minY) * 0.35;
      this.list.y = y;
      vel = (p.y - lastY) / Math.max(1, p.time - lastT);
      lastY = p.y;
      lastT = p.time;
    });
    this.input.on('pointerup', () => {
      if (!down) return;
      down = false;
      glide = this.tweens.add({ targets: this.list, y: Phaser.Math.Clamp(this.list.y + vel * 380, minY, 0), duration: 520, ease: 'Cubic.easeOut' });
      this.time.delayedCall(0, () => (this.dragged = false));
    });
  }
}
