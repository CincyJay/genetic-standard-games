import Phaser from 'phaser';
import { RANKS, SUITS, cardId } from '../logic/cards.ts';
import { MACHINES } from '../logic/slots.ts';
import { THEME, analytics, applySettings } from '../services.ts';

export const CHIP_VALUES = [10, 50, 100, 500, 1000, 5000];

/** Loads every card, chip, slot symbol and backdrop, then opens the lobby. */
function darkened(scene: Phaser.Scene, from: string, to: string, shade: number): void {
  const src = scene.textures.get(from).getSourceImage() as HTMLImageElement;
  const bg = scene.textures.createCanvas(to, src.width, src.height)!;
  const ctx = bg.getContext();
  ctx.drawImage(src, 0, 0);
  ctx.fillStyle = `rgba(10,2,16,${shade})`;
  ctx.fillRect(0, 0, src.width, src.height);
  const v = ctx.createRadialGradient(src.width / 2, src.height * 0.4, src.width * 0.3, src.width / 2, src.height * 0.4, src.height * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, src.width, src.height);
  bg.refresh();
}

/** Soft glow and sparkle sprites for win effects (drawn once into canvas textures). */
function makeFxTextures(scene: Phaser.Scene): void {
  const glow = scene.textures.createCanvas('fx-glow', 256, 256)!;
  const g = glow.getContext();
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,240,180,1)');
  grad.addColorStop(0.35, 'rgba(255,200,80,0.55)');
  grad.addColorStop(1, 'rgba(255,160,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  glow.refresh();
  const spark = scene.textures.createCanvas('fx-spark', 64, 64)!;
  const c = spark.getContext();
  const r = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,240,200,0.7)');
  r.addColorStop(1, 'rgba(255,220,140,0)');
  c.fillStyle = r;
  c.fillRect(0, 0, 64, 64);
  // four-point star flare
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.beginPath();
  c.moveTo(32, 0);
  c.quadraticCurveTo(35, 29, 64, 32);
  c.quadraticCurveTo(35, 35, 32, 64);
  c.quadraticCurveTo(29, 35, 0, 32);
  c.quadraticCurveTo(29, 29, 32, 0);
  c.fill();
  spark.refresh();
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    const { width: w, height: h } = this.scale;
    const bar = this.add.graphics();
    this.load.on('progress', (p: number) => {
      bar.clear();
      bar.fillStyle(THEME.surface, 1);
      bar.fillRoundedRect(w / 2 - 260, h / 2 - 12, 520, 24, 12);
      bar.fillStyle(THEME.primary, 1);
      bar.fillRoundedRect(w / 2 - 260, h / 2 - 12, Math.max(24, 520 * p), 24, 12);
    });
    const cardSize = { width: 300, height: 420 };
    for (const s of SUITS) for (const r of RANKS) {
      const id = cardId({ rank: r, suit: s });
      this.load.svg(`card-${id}`, `art/cards/${id}.svg`, cardSize);
    }
    this.load.svg('card-back', 'art/cards/back.svg', cardSize);
    for (const v of CHIP_VALUES) {
      this.load.image(`chip-${v}`, `art/ui/chip-${v}.png`);
      this.load.image(`chipside-${v}`, `art/ui/chipside-${v}.png`);
    }
    for (const u of ['dealer', 'trophy-gold', 'trophy-silver', 'trophy-bronze', 'ring', 'pill-fold', 'pill-call', 'pill-raise', 'pill-dark']) this.load.image(u, `art/ui/${u}.png`);
    this.load.image('logo-poker-series', 'art/logos/poker-series.png');
    this.load.image('table-poker', 'art/table-poker.jpg');
    this.load.image('table-final', 'art/table-final.jpg');
    // slot symbols are 3D renders (art/casino/3d)
    for (const m of MACHINES)
      for (const s of m.symbols) this.load.image(`sym-${m.id}-${s}`, `art/slots/${m.id}/${s}.png`);
    for (const u of ['coin', 'btn-spin', 'btn-spin-lanterns', 'btn-spin-pharaoh', 'btn-spin-ocean', 'btn-spin-goldrush', 'btn-gamble', 'btn-stop', 'btn-plus', 'btn-minus', 'btn-auto', 'btn-auto-on', 'panel-bet']) this.load.image(u, `art/ui/${u}.png`);
    for (const m of MACHINES) this.load.image(`logo-${m.id}`, `art/logos/${m.id}.png`);
    for (const bg of ['bg-felt', 'bg-felt-red', 'bg-poker', 'room-lobby', 'room-slots', 'room-poker', 'room-tables', 'world-pharaoh', 'world-ocean', 'world-goldrush', 'world-lanterns']) this.load.image(bg, `art/${bg}.jpg`);
    for (const a of ['you', 'rosa', 'dmitri', 'kwame', 'lena', 'hector', 'priya', 'sam', 'yuki']) {
      this.load.svg(`av-${a}`, `art/avatars/${a}.svg`, { width: 256, height: 256 });
    }
  }

  create(): void {
    applySettings();
    const d = this.make.graphics({}, false);
    d.fillStyle(0xffffff, 1);
    d.fillCircle(8, 8, 8);
    d.generateTexture('dot', 16, 16);
    d.destroy();
    makeFxTextures(this);
    // each machine stands in its own 3D world, darkened with a vignette so the reels stand out
    darkened(this, 'room-slots', 'bg-floor', 0.45);
    for (const id of ['pharaoh', 'ocean', 'goldrush', 'lanterns']) darkened(this, `world-${id}`, `bg-machine-${id}`, 0.25);
    analytics.track('session_start', {});
    this.scene.start('lobby');
  }
}
