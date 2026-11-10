import Phaser from 'phaser';
import { SEED_COLORS, SEED_TEX } from './services.ts';

export const SEED_TEX_W = 128;
export const SEED_TEX_H = 96;

export function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) => Phaser.Math.Clamp(Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount), 0, 255);
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

/** Outline of a cannabis seed seen from the side: an oval that tapers to a soft point at one end. */
function seedOutline(cx: number, cy: number, a: number, b: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    const c = Math.cos(t);
    pts.push(new Phaser.Math.Vector2(cx + a * c * (c > 0 ? 1.06 : 1), cy + b * Math.sin(t) * (1 - 0.14 * c)));
  }
  return pts;
}

/**
 * Cannabis seeds: flat color per strain, a soft bevel, and the darker
 * "tiger-stripe" marbling real seeds have. No gloss.
 */
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
    // tiger-stripe mottling: wavy dark marks running across the shell
    const dark = shade(color, -0.34);
    const stripes: [number, number, number, number][] = [
      // x offset, start y, length, thickness
      [-36, -16, 26, 5],
      [-22, -22, 40, 6],
      [-8, -24, 30, 5],
      [6, -20, 44, 6],
      [20, -18, 28, 5],
      [33, -12, 22, 4],
      [-12, 10, 16, 4],
      [24, 12, 12, 4],
    ];
    for (const [dx, y0, len, thick] of stripes) {
      g.lineStyle(thick, dark, 0.4);
      g.beginPath();
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const px = cx + dx + Math.sin(t * Math.PI * 2 + dx) * 3 + t * 5;
        const py = cy + y0 + t * len;
        if (k === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }
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

/** A single leaflet: long, narrow, pointed at both ends, drawn from (x, y) along `angle`. */
function leaflet(g: Phaser.GameObjects.Graphics, x: number, y: number, len: number, angle: number, widthRatio = 0.2): void {
  const pts: Phaser.Math.Vector2[] = [];
  const half = (len * widthRatio) / 2;
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new Phaser.Math.Vector2(t * len, Math.pow(Math.sin(t * Math.PI), 0.8) * half));
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    pts.push(new Phaser.Math.Vector2(t * len, -Math.pow(Math.sin(t * Math.PI), 0.8) * half));
  }
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  g.fillPoints(
    pts.map((p) => new Phaser.Math.Vector2(x + p.x * ca - p.y * sa, y + p.x * sa + p.y * ca)),
    true,
  );
}

/**
 * Cannabis fan leaf: an odd number of leaflets radiating from one point, the
 * center one longest. (x, y) is where the leaflets meet; `rotation` turns the
 * whole leaf (0 = pointing up).
 */
export function drawFanLeaf(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  color: number,
  leaflets: 3 | 5 | 7 = 7,
  rotation = 0,
): void {
  const spread = [0, 30, 58, 84];
  const lens = [1, 0.84, 0.62, 0.4];
  const pairs = (leaflets - 1) / 2;
  g.fillStyle(color, 1);
  for (let k = pairs; k >= 0; k--) {
    const sides = k === 0 ? [0] : [-1, 1];
    for (const side of sides) {
      const ang = Phaser.Math.DegToRad(-90 + side * spread[k]! ) + rotation;
      leaflet(g, x, y, size * lens[k]!, ang);
    }
  }
}

/** Small fan leaf rising from a finished slot, in the seed's color. */
export function drawSprout(g: Phaser.GameObjects.Graphics, color: number): void {
  g.clear();
  g.lineStyle(5, color, 1);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, -16);
  g.strokePath();
  drawFanLeaf(g, 0, -16, 56, color, 7);
}

const LEAF_GREEN = 0x3fbf74;
const LEAF_GREEN_DARK = 0x2b8f55;

/**
 * A potted plant at a growth stage, origin at the pot's bottom-center, about
 * 300px tall at scale 1. The strain's color shows in its flowers (stage 2) and pot band.
 */
export function drawPlant(g: Phaser.GameObjects.Graphics, stage: 0 | 1 | 2, strainColor: number): void {
  g.clear();
  // pot
  g.fillStyle(0x2c3a57, 1);
  g.fillRoundedRect(-62, -86, 124, 86, { tl: 6, tr: 6, bl: 22, br: 22 });
  g.fillStyle(0x3a4b6e, 1);
  g.fillRoundedRect(-70, -96, 140, 22, 8);
  g.fillStyle(strainColor, 1);
  g.fillRect(-62, -60, 124, 8);

  const soil = -96;
  if (stage === 0) {
    g.lineStyle(6, LEAF_GREEN_DARK, 1);
    g.lineBetween(0, soil, 0, soil - 48);
    g.fillStyle(LEAF_GREEN, 1);
    g.fillEllipse(-18, soil - 44, 34, 16);
    g.fillEllipse(18, soil - 44, 34, 16);
    drawFanLeaf(g, 0, soil - 50, 40, LEAF_GREEN, 3);
    return;
  }
  const height = stage === 1 ? 150 : 200;
  g.lineStyle(8, LEAF_GREEN_DARK, 1);
  g.lineBetween(0, soil, 0, soil - height);
  // side branches with fan leaves, lower ones larger
  const tiers = stage === 1 ? 2 : 3;
  for (let i = 0; i < tiers; i++) {
    const y = soil - 50 - i * (height / (tiers + 0.6));
    const size = 78 - i * 12;
    g.lineStyle(5, LEAF_GREEN_DARK, 1);
    g.lineBetween(0, y, -34, y - 14);
    g.lineBetween(0, y, 34, y - 14);
    drawFanLeaf(g, -34, y - 14, size, LEAF_GREEN, 7, Phaser.Math.DegToRad(-48));
    drawFanLeaf(g, 34, y - 14, size, LEAF_GREEN, 7, Phaser.Math.DegToRad(48));
  }
  drawFanLeaf(g, 0, soil - height, 60, LEAF_GREEN, 5);
  if (stage === 2) {
    // flowering tops in the strain's color
    const tops: [number, number, number][] = [
      [0, soil - height - 30, 1],
      [-46, soil - height + 50, 0.8],
      [46, soil - height + 50, 0.8],
    ];
    for (const [cx, cy, sc] of tops) {
      g.fillStyle(shade(strainColor, -0.25), 1);
      for (let k = 0; k < 6; k++) g.fillCircle(cx + Math.sin(k * 2.1) * 9 * sc, cy + 6 - k * 7 * sc, 12 * sc);
      g.fillStyle(strainColor, 1);
      for (let k = 0; k < 6; k++) g.fillCircle(cx + Math.sin(k * 2.1) * 8 * sc, cy - k * 7 * sc, 10 * sc);
    }
  }
}
