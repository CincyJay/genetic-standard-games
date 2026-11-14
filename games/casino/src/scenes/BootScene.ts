import Phaser from 'phaser';
import { RANKS, SUITS, cardId } from '../logic/cards.ts';
import { MACHINES } from '../logic/slots.ts';
import { THEME, analytics, applySettings } from '../services.ts';

const RENDERED = ['sevens', 'lanterns'];

export const CHIP_VALUES = [10, 50, 100, 500, 1000, 5000];

/** Loads every card, chip, slot symbol and backdrop, then opens the lobby. */
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
    for (const v of CHIP_VALUES) this.load.svg(`chip-${v}`, `art/chips/${v}.svg`, { width: 180, height: 180 });
    // 3D-rendered machines ship PNGs; the rest are still vector art
    for (const m of MACHINES)
      for (const s of m.symbols) {
        if (RENDERED.includes(m.id)) this.load.image(`sym-${m.id}-${s}`, `art/slots/${m.id}/${s}.png`);
        else this.load.svg(`sym-${m.id}-${s}`, `art/slots/${m.id}/${s}.svg`, { width: 260, height: 260 });
      }
    for (const u of ['coin', 'btn-spin', 'btn-stop', 'btn-plus', 'btn-minus', 'btn-auto', 'btn-auto-on', 'panel-bet']) this.load.image(u, `art/ui/${u}.png`);
    for (const m of MACHINES) this.load.image(`logo-${m.id}`, `art/logos/${m.id}.png`);
    for (const bg of ['bg-lobby', 'bg-felt', 'bg-felt-red', 'bg-slots', 'bg-slots-pharaoh', 'bg-slots-ocean', 'bg-slots-goldrush', 'bg-slots-lanterns', 'bg-poker', 'room-lobby', 'room-slots', 'room-poker', 'room-tables']) this.load.image(bg, `art/${bg}.jpg`);
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
    // Lucky Sevens stands on the casino floor: the slots-room render, darkened with a vignette
    const src = this.textures.get('room-slots').getSourceImage() as HTMLImageElement;
    const bg = this.textures.createCanvas('bg-floor', src.width, src.height)!;
    const ctx = bg.getContext();
    ctx.drawImage(src, 0, 0);
    ctx.fillStyle = 'rgba(10,2,16,0.45)';
    ctx.fillRect(0, 0, src.width, src.height);
    const v = ctx.createRadialGradient(src.width / 2, src.height * 0.4, src.width * 0.3, src.width / 2, src.height * 0.4, src.height * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, src.width, src.height);
    bg.refresh();
    analytics.track('session_start', {});
    this.scene.start('lobby');
  }
}
