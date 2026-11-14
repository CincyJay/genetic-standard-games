import Phaser from 'phaser';
import { popIn } from '@tgs/kit';
import { GOLD, save } from '../services.ts';
import { text } from './common.ts';

export type DealerMood = 'hello' | 'bets' | 'win' | 'bigwin' | 'lose' | 'push' | 'special';

interface DealerInfo {
  key: string;
  name: string;
  /** Who they are, shown under the name when you sit down. */
  style: string;
  lines: Record<DealerMood | 'back', string[]>;
}

/**
 * Eight dealers, each with a personality: their own greetings, their own way of
 * calling wins and losses, and a signature line for the big moments. `{n}` is
 * the visit count, used by dealers who remember returning players.
 */
const DEALERS: Record<string, DealerInfo> = {
  blackjack: {
    key: 'dealer-victoria',
    name: 'Victoria',
    style: 'Elegant and exacting · runs the blackjack pit',
    lines: {
      hello: ['Good evening. Take a seat.', 'Welcome. The minimum is posted.', 'Shall we begin?'],
      back: ['Back again. I admire persistence.', 'Ah, you returned. Visit {n}, I believe.'],
      bets: ['Bets, please.', 'Place your wagers.', 'Whenever you are ready.'],
      win: ['Well played.', 'Correctly done.', 'The house pays. This time.'],
      bigwin: ['Impressive. Truly.', 'I will remember that hand.'],
      lose: ['The house thanks you.', 'Unfortunate.', 'Discipline wins in the end.'],
      push: ['A push. Nobody wins.', 'Even. How tidy.'],
      special: ['Blackjack. Exquisite.', 'Twenty-one. Elegant.'],
    },
  },
  roulette: {
    key: 'dealer-sofia',
    name: 'Sofia',
    style: 'Playful and competitive · the face of the roulette room',
    lines: {
      hello: ['Ciao! Ready to spin?', 'Ooh, a new challenger!', 'Feeling lucky tonight?'],
      back: ['You came back! Visit {n}, who is counting? Me.', 'My favourite player returns!'],
      bets: ['Place your bets! I dare you.', 'Red or black? Choose wisely!', 'No more bets soon!'],
      win: ['Hey! You beat my wheel!', 'Okay, okay, you win this one.', 'Lucky, lucky!'],
      bigwin: ["You're on fire! Stop it!", 'Now you are showing off!'],
      lose: ['The wheel likes me today!', 'Ha! Try again?', 'Almost! Spin it back?'],
      push: ['Nobody wins? Boring!', 'A draw. Again!'],
      special: ['Straight up! Bravissimo!', 'Right on the number!'],
    },
  },
  holdem: {
    key: 'dealer-marcus',
    name: 'Marcus',
    style: 'Friendly and energetic · remembers every regular',
    lines: {
      hello: ['Hey hey! Welcome to the poker room!', 'Great to have you, pull up a chair!'],
      back: ['Welcome back, friend! Visit number {n}!', 'There they are! Good to see you again!'],
      bets: ['Shuffle up and deal!', 'Blinds are in, here we go!', 'Cards in the air!'],
      win: ['Ship it! Nice pot!', 'Way to go!', "That's how it's done!"],
      bigwin: ['WHAT a hand! Unbelievable!', 'Somebody call the cameras!'],
      lose: ['Shake it off, next hand!', "You'll get 'em next time!", 'Tough beat, buddy.'],
      push: ['Split pot! Everybody eats!'],
      special: ['What a pot!', 'Big hand, big hand!'],
    },
  },
  baccarat: {
    key: 'dealer-mei',
    name: 'Mei',
    style: 'Calm and gracious · the baccarat salon',
    lines: {
      hello: ['Welcome to the salon.', 'Please, be comfortable.', 'Good fortune tonight.'],
      back: ['Welcome back. Visit {n}. The shoe remembers you.', 'A pleasure to see you again.'],
      bets: ['Player, Banker, or Tie?', 'Your bets, please.', 'The shoe is ready.'],
      win: ['Congratulations.', 'A graceful win.', 'Fortune smiles.'],
      bigwin: ['A remarkable coup.', 'Wonderful. Truly.'],
      lose: ['The next coup awaits.', 'Patience brings luck.', 'The tide turns.'],
      push: ['A tie. Bets remain.'],
      special: ['A natural.', 'Banker continues the run.'],
    },
  },
  threecard: {
    key: 'dealer-fiona',
    name: 'Fiona',
    style: 'Cheerful and cheeky · Three Card Poker',
    lines: {
      hello: ['Oh hi! Three cards, endless fun!', 'Welcome, sit, sit!'],
      back: ['You again! Visit {n}! I knew you liked me.', 'Missed you!'],
      bets: ['Ante up, love!', 'Pair Plus? Go on, live a little!'],
      win: ['Yay! Nicely done!', 'Look at you!', 'Winner winner!'],
      bigwin: ['Oh my goodness, what a hand!', 'Stop it, that is brilliant!'],
      lose: ['Aww, next one!', 'Cheeky dealer wins!', 'Not your hand, love.'],
      push: ['A tie! How polite of us.'],
      special: ['Ante bonus! Lovely!', 'Pair Plus pays!'],
    },
  },
  war: {
    key: 'dealer-viktor',
    name: 'Viktor',
    style: 'Gruff and competitive · Casino War',
    lines: {
      hello: ['You want war? Sit.', 'Another challenger.'],
      back: ['You came back for more. Visit {n}.', 'Ready to lose again?'],
      bets: ['Bet. Then we fight.', 'Choose your stake.'],
      win: ['Hm. You win this battle.', 'Respect.'],
      bigwin: ['A victory worth remembering.', 'You fought well.'],
      lose: ['Victory is mine.', 'War is cruel.', 'Again?'],
      push: ['A standoff.'],
      special: ['Then it is WAR!', 'Brave. Or foolish.'],
    },
  },
  craps: {
    key: 'dealer-jamal',
    name: 'Jamal',
    style: 'The hype man · runs the craps table',
    lines: {
      hello: ['Welcome to the loudest table in the house!', "Let's roll, let's ROLL!"],
      back: ['My shooter is back! Visit {n}, baby!', 'There they are! Dice missed you!'],
      bets: ['Shooter coming out!', 'Bets down, dice up!', 'Get those chips on the line!'],
      win: ['WINNER WINNER!', "That's what I'm talking about!", 'Pay the line!'],
      bigwin: ["THE TABLE IS ON FIRE!", 'Somebody stop this shooter!'],
      lose: ['Ohhh, so close!', 'Shake it off, roll again!', 'Next shooter, next shooter!'],
      push: ['Push it real good!'],
      special: ['Winner, winner!', 'Seven out. Line away.'],
    },
  },
  uth: {
    key: 'dealer-kenji',
    name: 'Kenji',
    style: "Cool and analytical · Ultimate Texas Hold'em",
    lines: {
      hello: ['Welcome. The math is on your side, sometimes.', 'Good evening.'],
      back: ['Visit {n}. Your game is improving.', 'Welcome back.'],
      bets: ['Ante and blind, please.', 'Raise early with the strong hands.'],
      win: ['Well calculated.', 'Correct decision.', 'Nicely read.'],
      bigwin: ['Excellent. A textbook hand.', 'Optimal.'],
      lose: ['Variance.', 'The odds were close.', 'Stay disciplined.'],
      push: ['Equal hands. A push.'],
      special: ['Blind bonus pays.', 'Trips pays.'],
    },
  },
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
  private portrait: Phaser.GameObjects.Image | null = null;
  private ring: Phaser.GameObjects.Graphics | null = null;
  /** How many times the player has sat at this dealer's table (counting this one). */
  readonly visits: number;

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
      this.portrait = scene.add.image(x, y, this.info.key).setDisplaySize(148, 148).setDepth(21);
      this.ring = ring;
      // idle: a slow breath so the dealer feels present
      const base = this.portrait.scale;
      scene.tweens.add({ targets: this.portrait, scale: base * 1.025, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // dealers remember you
    const visits = { ...(save.get().dealerVisits ?? {}) };
    visits[this.info.key] = (visits[this.info.key] ?? 0) + 1;
    this.visits = visits[this.info.key]!;
    save.update((d) => {
      d.dealerVisits = visits;
    });
    const py = photo ? y + 92 : y;
    const plate = scene.add.graphics().setDepth(21);
    plate.fillStyle(0x0d0b10, 0.88);
    plate.fillRoundedRect(x - 80, py - 36, 160, 72, 18);
    plate.lineStyle(3, 0xe9c86a, 0.8);
    plate.strokeRoundedRect(x - 80, py - 36, 160, 72, 18);
    text(scene, x, py - 12, 'DEALER', 18, '800', '#a898b0').setDepth(22).setLetterSpacing(3);
    text(scene, x, py + 12, this.info.name, 28, '900', GOLD).setDepth(22);
  }

  /** Hello on a first visit; a returning player gets a personal welcome back. */
  greet(): void {
    if (this.visits > 1) this.say('back');
    else {
      this.say('hello');
      // first time at this table: who the dealer is
      const t = text(this.scene, this.left ? this.x - 92 : this.x + 92, this.y + 70, this.info.style, 22, '700', '#e9d6ee').setOrigin(this.left ? 1 : 0, 0.5).setDepth(23).setStroke('#000000', 4);
      this.scene.tweens.add({ targets: t, alpha: 0, delay: 3800, duration: 600, onComplete: () => t.destroy() });
    }
  }

  say(mood: DealerMood | 'back', line?: string): void {
    const pool = this.info.lines[mood];
    const msg = (line ?? pool[Math.floor(Math.random() * pool.length)]!).replace('{n}', String(this.visits));
    this.animate(mood);
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

  /** Body language: a nod when talking, a lift and a gold flash on big moments, a small droop on losses. */
  private animate(mood: DealerMood | 'back'): void {
    const p = this.portrait;
    if (!p) return;
    this.scene.tweens.killTweensOf(p);
    const base = 148 / p.width;
    p.setScale(base);
    if (mood === 'bigwin' || mood === 'special') {
      this.scene.tweens.add({ targets: p, scale: base * 1.12, y: this.y - 10, duration: 180, yoyo: true, repeat: 1, ease: 'Back.easeOut' });
      const glow = this.scene.add.image(this.x, this.y, 'fx-glow').setDisplaySize(260, 260).setDepth(19).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: glow, alpha: 0, duration: 900, onComplete: () => glow.destroy() });
      const e = this.scene.add.particles(this.x, this.y, 'fx-spark', { speed: { min: 80, max: 260 }, lifespan: 700, scale: { start: 0.7, end: 0 }, blendMode: 'ADD', emitting: false }).setDepth(24);
      e.explode(14);
      this.scene.time.delayedCall(800, () => e.destroy());
    } else if (mood === 'lose') {
      this.scene.tweens.add({ targets: p, angle: { from: -3, to: 3 }, duration: 120, yoyo: true, repeat: 1, onComplete: () => p.setAngle(0) });
    } else {
      this.scene.tweens.add({ targets: p, y: this.y - 6, duration: 140, yoyo: true, repeat: 1 });
    }
    this.ring?.setAlpha(1);
    // back to breathing
    this.scene.time.delayedCall(900, () => {
      if (!p.active) return;
      p.setPosition(this.x, this.y).setScale(base);
      this.scene.tweens.add({ targets: p, scale: base * 1.025, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  /** React to a round's result. */
  react(profit: number, staked: number): void {
    if (profit > 0) this.say(profit >= staked * 4 ? 'bigwin' : 'win');
    else if (profit === 0 && staked > 0) this.say('push');
    else this.say('lose');
  }
}

export const DEALER_KEYS = Object.values(DEALERS).map((d) => d.key);
