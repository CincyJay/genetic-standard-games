import Phaser from 'phaser';
import { SEED_COLORS, SEED_TEX } from './services.ts';

export const SEED_TEX_W = 128;
export const SEED_TEX_H = 104;

function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) => Phaser.Math.Clamp(Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount), 0, 255);
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

/** Draws every seed color once into textures at boot, so gameplay uses cheap sprites. */
export function buildSeedTextures(scene: Phaser.Scene): void {
  const w = SEED_TEX_W;
  const h = SEED_TEX_H;
  SEED_COLORS.forEach((color, i) => {
    const g = scene.make.graphics({}, false);
    // soft contact shadow
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(w / 2, h / 2 + 8, w - 14, h - 18);
    // darker rim (gives the seed a rounded, 3D read)
    g.fillStyle(shade(color, -0.22), 1);
    g.fillEllipse(w / 2, h / 2 + 2, w - 12, h - 16);
    // body
    g.fillStyle(color, 1);
    g.fillEllipse(w / 2, h / 2 - 2, w - 18, h - 24);
    // seam: the little line that makes it read as a seed, not a ball
    g.lineStyle(5, shade(color, -0.28), 0.55);
    g.beginPath();
    g.arc(w / 2 + 34, h / 2 - 2, 40, Phaser.Math.DegToRad(150), Phaser.Math.DegToRad(210));
    g.strokePath();
    // highlights
    g.fillStyle(0xffffff, 0.45);
    g.fillEllipse(w / 2 - 18, h / 2 - 20, 44, 20);
    g.fillStyle(0xffffff, 0.8);
    g.fillEllipse(w / 2 - 24, h / 2 - 22, 16, 9);
    g.generateTexture(SEED_TEX(i), w, h);
    g.destroy();
  });

  // Small petal used for celebration particles.
  const p = scene.make.graphics({}, false);
  p.fillStyle(0xffffff, 1);
  p.fillEllipse(16, 10, 30, 18);
  p.generateTexture('petal', 32, 20);
  p.destroy();

  const s = scene.make.graphics({}, false);
  s.fillStyle(0xffffff, 1);
  s.fillCircle(8, 8, 8);
  s.generateTexture('dot', 16, 16);
  s.destroy();
}

/** Glass seed jar, drawn at a given size. Origin is the jar's bottom-center. */
export function drawJar(g: Phaser.GameObjects.Graphics, w: number, h: number, highlight: boolean): void {
  g.clear();
  const r = w * 0.32;
  // shadow on the table
  g.fillStyle(0x6b4f3a, 0.12);
  g.fillEllipse(0, 6, w * 1.05, 26);
  // glass body
  g.fillStyle(highlight ? 0xfff3c4 : 0xffffff, highlight ? 0.95 : 0.7);
  g.fillRoundedRect(-w / 2, -h, w, h, { tl: 14, tr: 14, bl: r, br: r });
  g.lineStyle(6, highlight ? 0xffb347 : 0xd9c8b4, 1);
  g.strokeRoundedRect(-w / 2, -h, w, h, { tl: 14, tr: 14, bl: r, br: r });
  // rim
  g.fillStyle(highlight ? 0xffb347 : 0xcdb69c, 1);
  g.fillRoundedRect(-w / 2 - 8, -h - 10, w + 16, 22, 11);
  // glass shine
  g.fillStyle(0xffffff, 0.75);
  g.fillRoundedRect(-w / 2 + 12, -h + 26, 10, h * 0.55, 5);
}

/** A sprout that grows out of a finished jar (a small preview of the garden). */
export function drawSprout(g: Phaser.GameObjects.Graphics, color: number): void {
  g.clear();
  g.lineStyle(8, 0x4f9a52, 1);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, -60);
  g.strokePath();
  g.fillStyle(0x6bcb77, 1);
  g.fillEllipse(-20, -34, 36, 18);
  g.fillEllipse(20, -46, 36, 18);
  // bloom
  g.fillStyle(color, 1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    g.fillCircle(Math.cos(a) * 14, -74 + Math.sin(a) * 14, 12);
  }
  g.fillStyle(0xfff2b3, 1);
  g.fillCircle(0, -74, 9);
}
