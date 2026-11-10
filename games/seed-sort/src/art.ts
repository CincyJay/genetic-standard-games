import Phaser from 'phaser';
import { SEED_COLORS, SEED_TEX } from './services.ts';

export const SEED_TEX_W = 128;
export const SEED_TEX_H = 96;

export function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) => Phaser.Math.Clamp(Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount), 0, 255);
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

/** Seed outline: an oval that tapers to a soft point at one end. */
function seedOutline(cx: number, cy: number, a: number, b: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    const c = Math.cos(t);
    pts.push(new Phaser.Math.Vector2(cx + a * c * (c > 0 ? 1.06 : 1), cy + b * Math.sin(t) * (1 - 0.14 * c)));
  }
  return pts;
}

/** Flat seeds with a soft bevel. No gloss, no outlines. */
export function buildSeedTextures(scene: Phaser.Scene): void {
  const w = SEED_TEX_W;
  const h = SEED_TEX_H;
  const a = (w - 16) / 2;
  const b = (h - 22) / 2;
  SEED_COLORS.forEach((color, i) => {
    const g = scene.make.graphics({}, false);
    const cx = w / 2;
    const cy = h / 2 - 3;
    g.fillStyle(shade(color, -0.35), 1);
    g.fillPoints(seedOutline(cx, cy + 6, a, b), true);
    g.fillStyle(color, 1);
    g.fillPoints(seedOutline(cx, cy, a, b), true);
    // soft top bevel
    g.fillStyle(shade(color, 0.25), 0.6);
    g.fillEllipse(cx - 4, cy - b * 0.66, a * 1.15, b * 0.3);
    g.generateTexture(SEED_TEX(i), w, h);
    g.destroy();
  });

  const d = scene.make.graphics({}, false);
  d.fillStyle(0xffffff, 1);
  d.fillCircle(8, 8, 8);
  d.generateTexture('dot', 16, 16);
  d.destroy();
}

/** A seed slot. Origin is the slot's bottom-center. */
export function drawJar(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  selected: boolean,
  doneColor?: number,
): void {
  g.clear();
  const radius = { tl: 20, tr: 20, bl: w * 0.42, br: w * 0.42 };
  const tint = doneColor ?? (selected ? 0xffd84d : 0xffffff);
  g.fillStyle(tint, doneColor !== undefined ? 0.14 : selected ? 0.1 : 0.05);
  g.fillRoundedRect(-w / 2, -h, w, h, radius);
  g.lineStyle(5, tint, doneColor !== undefined ? 0.85 : selected ? 0.9 : 0.16);
  g.strokeRoundedRect(-w / 2, -h, w, h, radius);
}

/** A simple pointed leaf from (x, y) along `angle`. */
function leaf(g: Phaser.GameObjects.Graphics, x: number, y: number, len: number, angle: number, widthRatio = 0.45): void {
  const pts: Phaser.Math.Vector2[] = [];
  const half = (len * widthRatio) / 2;
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new Phaser.Math.Vector2(t * len, Math.sin(t * Math.PI) * half));
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    pts.push(new Phaser.Math.Vector2(t * len, -Math.sin(t * Math.PI) * half));
  }
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  g.fillPoints(
    pts.map((p) => new Phaser.Math.Vector2(x + p.x * ca - p.y * sa, y + p.x * sa + p.y * ca)),
    true,
  );
}

/** Two-leaf sprout rising from a finished slot, in the seed's color. */
export function drawSprout(g: Phaser.GameObjects.Graphics, color: number): void {
  g.clear();
  g.lineStyle(6, color, 1);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, -40);
  g.strokePath();
  g.fillStyle(color, 1);
  leaf(g, 0, -28, 40, Phaser.Math.DegToRad(-150));
  leaf(g, 0, -40, 40, Phaser.Math.DegToRad(-30));
}

/** Five-petal flower head centered at (x, y). */
export function drawBloom(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number): void {
  g.fillStyle(shade(color, -0.2), 1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    g.fillCircle(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62 + 3, r * 0.5);
  }
  g.fillStyle(color, 1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    g.fillCircle(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.48);
  }
  g.fillStyle(0xffe9a8, 1);
  g.fillCircle(x, y, r * 0.3);
}

/** Round fruit or vegetable with a small leaf cap, centered at (x, y). */
export function drawFruit(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number): void {
  g.fillStyle(shade(color, -0.25), 1);
  g.fillCircle(x, y + 3, r);
  g.fillStyle(color, 1);
  g.fillCircle(x, y, r);
  g.fillStyle(shade(color, 0.25), 0.6);
  g.fillEllipse(x - r * 0.25, y - r * 0.45, r * 0.9, r * 0.35);
  g.fillStyle(LEAF_GREEN, 1);
  leaf(g, x, y - r + 2, r * 0.8, Phaser.Math.DegToRad(-130), 0.5);
  leaf(g, x, y - r + 2, r * 0.8, Phaser.Math.DegToRad(-50), 0.5);
}

/** Icon for a variety: a bloom for flowers and herbs, a fruit for fruit and vegetables. */
export function drawVarietyIcon(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  color: number,
  category: 'Flower' | 'Fruit' | 'Vegetable' | 'Herb',
): void {
  if (category === 'Fruit' || category === 'Vegetable') drawFruit(g, x, y, size * 0.42, color);
  else drawBloom(g, x, y, size * 0.5, color);
}

const LEAF_GREEN = 0x3fbf74;
const LEAF_GREEN_DARK = 0x2b8f55;

/**
 * A potted plant at a growth stage, origin at the pot's bottom-center, about
 * 300px tall at scale 1. The variety's color shows in its blooms or fruit and the pot band.
 */
export function drawPlant(
  g: Phaser.GameObjects.Graphics,
  stage: 0 | 1 | 2,
  color: number,
  category: 'Flower' | 'Fruit' | 'Vegetable' | 'Herb',
): void {
  g.clear();
  // pot
  g.fillStyle(0x2c3a57, 1);
  g.fillRoundedRect(-62, -86, 124, 86, { tl: 6, tr: 6, bl: 22, br: 22 });
  g.fillStyle(0x3a4b6e, 1);
  g.fillRoundedRect(-70, -96, 140, 22, 8);
  g.fillStyle(color, 1);
  g.fillRect(-62, -60, 124, 8);

  const soil = -96;
  if (stage === 0) {
    g.lineStyle(6, LEAF_GREEN_DARK, 1);
    g.lineBetween(0, soil, 0, soil - 44);
    g.fillStyle(LEAF_GREEN, 1);
    leaf(g, 0, soil - 40, 40, Phaser.Math.DegToRad(-160));
    leaf(g, 0, soil - 40, 40, Phaser.Math.DegToRad(-20));
    return;
  }
  const height = stage === 1 ? 140 : 180;
  g.lineStyle(8, LEAF_GREEN_DARK, 1);
  g.lineBetween(0, soil, 0, soil - height);
  g.fillStyle(LEAF_GREEN, 1);
  const pairs = stage === 1 ? 2 : 3;
  for (let i = 0; i < pairs; i++) {
    const y = soil - 30 - i * (height / (pairs + 0.4));
    const len = 66 - i * 10;
    leaf(g, 0, y, len, Phaser.Math.DegToRad(-160 + i * 6));
    leaf(g, 0, y - 12, len, Phaser.Math.DegToRad(-20 - i * 6));
  }
  if (stage === 1) {
    g.fillStyle(LEAF_GREEN, 1);
    leaf(g, 0, soil - height, 34, Phaser.Math.DegToRad(-90));
    return;
  }
  // blooming: flowers or fruit in the variety's color
  const spots: [number, number, number][] = [
    [0, soil - height - 10, 1],
    [-52, soil - height + 60, 0.75],
    [52, soil - height + 40, 0.75],
  ];
  for (const [x, y, sc] of spots) drawVarietyIcon(g, x, y, 64 * sc, color, category);
}
