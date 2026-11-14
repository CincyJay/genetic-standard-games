import Phaser from 'phaser';
import { popIn } from '@tgs/kit';
import { GOLD } from '../services.ts';
import { text } from './common.ts';

export type DealerMood = 'hello' | 'bets' | 'win' | 'bigwin' | 'lose' | 'push' | 'special';

interface DealerInfo {
  key: string;
  name: string;
  lines: Record<DealerMood, string[]>;
}

const BASE: Record<DealerMood, string[]> = {
  hello: ['Welcome to my table!', 'Good to see you!', 'Pull up a seat.'],
  bets: ['Place your bets.', 'Bets, please.', 'Good luck this hand!'],
  win: ['Nicely played!', 'Winner!', "That's a good one.", 'Paying you out.'],
  bigwin: ['Wow, big winner!', 'The table is hot!', "Now that's a hand!"],
  lose: ["Next one's yours.", 'So close.', 'Shake it off.', 'The cards will turn.'],
  push: ['A push. Your bet stays.', 'Even this time.'],
  special: ['Ooh!', 'Look at that!'],
};

/** Each game has its own dealer with a few personal lines. */
const DEALERS: Record<string, DealerInfo> = {
  blackjack: { key: 'dealer-sofia', name: 'Sofia', lines: { ...BASE, special: ['Blackjack! Beautiful.', 'Twenty-one!'] } },
  roulette: { key: 'dealer-marco', name: 'Marco', lines: { ...BASE, bets: ['Place your bets!', 'No more bets soon...'], special: ['Straight up! Lovely.'] } },
  baccarat: { key: 'dealer-mei', name: 'Mei', lines: { ...BASE, special: ['A natural!', 'Banker is on a run.'] } },
  threecard: { key: 'dealer-fiona', name: 'Fiona', lines: { ...BASE, special: ['Ante bonus for you!', 'Pair Plus pays!'] } },
  war: { key: 'dealer-jamal', name: 'Jamal', lines: { ...BASE, special: ["It's war!", 'Brave move.'] } },
  craps: { key: 'dealer-elena', name: 'Elena', lines: { ...BASE, bets: ['Shooter coming out!', 'Bets down, dice up.'], special: ['Winner, winner!', 'Seven out.'] } },
  uth: { key: 'dealer-kenji', name: 'Kenji', lines: { ...BASE, special: ['Big blind bonus!', 'Trips pays!'] } },
  holdem: { key: 'dealer-victor', name: 'Victor', lines: { ...BASE, bets: ['Shuffle up and deal.', 'Blinds are in.'], special: ['Ship it!', 'What a pot!'] } },
};

/**
 * The dealer at a table: portrait with a name plate in the top-left corner and
 * a speech bubble for short reactions. `say` picks a random line for a mood.
 */
export class Dealer {
  readonly info: DealerInfo;
  private bubble: Phaser.GameObjects.Container | null = null;
  private readonly scene: Phaser.Scene;
  private readonly x: number;
  private readonly y: number;

  private readonly left: boolean;

  constructor(scene: Phaser.Scene, game: keyof typeof DEALERS, x = 110, y = 310, bubbleLeft = false) {
    this.scene = scene;
    this.info = DEALERS[game]!;
    this.x = x;
    this.y = y;
    this.left = bubbleLeft;
    scene.data.set('dealer', this);
    // a portrait shows when a photo for this dealer is shipped (art/dealers/<name>.png, see BootScene);
    // until then the dealer is a name plate with the speech bubble
    const photo = scene.textures.exists(this.info.key);
    if (photo) {
      const ring = scene.add.graphics().setDepth(20);
      ring.fillStyle(0x000000, 0.5);
      ring.fillCircle(x + 3, y + 6, 80);
      ring.lineStyle(5, 0xe9c86a, 1);
      ring.strokeCircle(x, y, 76);
      scene.add.image(x, y, this.info.key).setDisplaySize(148, 148).setDepth(21);
    }
    const py = photo ? y + 92 : y;
    const plate = scene.add.graphics().setDepth(21);
    plate.fillStyle(0x0d0b10, 0.88);
    plate.fillRoundedRect(x - 80, py - 36, 160, 72, 18);
    plate.lineStyle(3, 0xe9c86a, 0.8);
    plate.strokeRoundedRect(x - 80, py - 36, 160, 72, 18);
    text(scene, x, py - 12, 'DEALER', 18, '800', '#a898b0').setDepth(22).setLetterSpacing(3);
    text(scene, x, py + 12, this.info.name, 28, '900', GOLD).setDepth(22);
  }

  say(mood: DealerMood, line?: string): void {
    const pool = this.info.lines[mood];
    const msg = line ?? pool[Math.floor(Math.random() * pool.length)]!;
    this.bubble?.destroy();
    const t = text(this.scene, 0, 0, msg, 28, '800', '#1a1020');
    const w = t.width + 40;
    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w / 2 + 3, -30 + 5, w, 60, 24);
    g.fillStyle(0xfdf6e6, 1);
    g.fillRoundedRect(-w / 2, -30, w, 60, 24);
    if (this.left) g.fillTriangle(w / 2 - 6, 10, w / 2 + 22, 22, w / 2 - 24, -8);
    else g.fillTriangle(-w / 2 + 6, 10, -w / 2 - 22, 22, -w / 2 + 24, -8);
    const c = this.scene.add.container(this.left ? this.x - 92 - w / 2 : this.x + 92 + w / 2, this.y, [g, t]).setDepth(23);
    this.bubble = c;
    popIn(this.scene, c);
    this.scene.tweens.add({ targets: c, alpha: 0, delay: 2600, duration: 400, onComplete: () => c.destroy() });
  }

  /** React to a round's result. */
  react(profit: number, staked: number): void {
    if (profit > 0) this.say(profit >= staked * 4 ? 'bigwin' : 'win');
    else if (profit === 0 && staked > 0) this.say('push');
    else this.say('lose');
  }
}

export const DEALER_KEYS = Object.values(DEALERS).map((d) => d.key);
