import Phaser from 'phaser';
import { WHEEL_ORDER, colorOf } from '../logic/roulette.ts';

const COLORS = { red: 0xc8102e, black: 0x1d1d22, green: 0x0f8a4a };

/**
 * Draws a roulette wheel centered at (0, 0) into `g`. Pocket 0 is at the top;
 * pockets go clockwise in WHEEL_ORDER. Numbers are separate Text objects returned
 * so the caller can put them in the same container and rotate everything together.
 */
export function drawWheel(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, r: number, withNumbers = true): Phaser.GameObjects.Text[] {
  const n = WHEEL_ORDER.length;
  const step = (Math.PI * 2) / n;
  // outer wooden rim
  g.fillStyle(0x5a2e12, 1);
  g.fillCircle(0, 0, r * 1.12);
  g.fillStyle(0xc9a03a, 1);
  g.fillCircle(0, 0, r * 1.02);
  // pockets
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + i * step - step / 2;
    g.fillStyle(COLORS[colorOf(WHEEL_ORDER[i]!)], 1);
    g.slice(0, 0, r, a0, a0 + step, false);
    g.fillPath();
  }
  g.lineStyle(2, 0xe9c86a, 0.9);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * step - step / 2;
    g.lineBetween(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, Math.cos(a) * r, Math.sin(a) * r);
  }
  // inner cone
  g.fillStyle(0x7a3e18, 1);
  g.fillCircle(0, 0, r * 0.62);
  g.fillStyle(0x9a5a28, 1);
  g.fillCircle(0, 0, r * 0.5);
  g.fillStyle(0xe9c86a, 1);
  g.fillCircle(0, 0, r * 0.14);
  // turret spokes
  g.lineStyle(r * 0.05, 0xe9c86a, 1);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    g.lineBetween(0, 0, Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36);
  }
  const labels: Phaser.GameObjects.Text[] = [];
  if (withNumbers) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * step;
      const t = scene.add
        .text(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, String(WHEEL_ORDER[i]), {
          fontFamily: 'Arial, sans-serif',
          fontSize: `${Math.round(r * 0.09)}px`,
          fontStyle: '900',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setRotation(a + Math.PI / 2);
      labels.push(t);
    }
  }
  return labels;
}
