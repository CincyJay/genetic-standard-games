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

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/**
 * Paint a prize wheel into a canvas texture (wedges, rim, hub and labels) and
 * return its key. One rotating image avoids Phaser 4 clipping rotated text.
 * Wedge 0 is centered at the top; wedges go clockwise.
 */
export function paintPrizeWheel(
  scene: Phaser.Scene,
  key: string,
  labels: string[],
  colors: (number | ((i: number) => number))[],
  R: number,
  opts: { font?: number; textColor?: (i: number) => string } = {},
): string {
  const size = Math.ceil((R + 34) * 2);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, size, size)!;
  const ctx = tex.getContext();
  const c = size / 2;
  const n = labels.length;
  const step = (Math.PI * 2) / n;
  ctx.fillStyle = '#3a2210';
  ctx.beginPath();
  ctx.arc(c, c, R + 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e9c86a';
  ctx.beginPath();
  ctx.arc(c, c, R + 14, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + i * step - step / 2;
    const col = colors[i % colors.length]!;
    ctx.fillStyle = hex(typeof col === 'function' ? col(i) : col);
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, R, a0, a0 + step);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e9c86a';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(i * step);
    ctx.font = `900 ${opts.font ?? 40}px Outfit, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(30,12,4,0.85)';
    ctx.strokeText(labels[i]!, 0, -R * 0.66);
    ctx.fillStyle = opts.textColor?.(i) ?? '#ffffff';
    ctx.fillText(labels[i]!, 0, -R * 0.66);
    ctx.restore();
  }
  ctx.fillStyle = '#e9c86a';
  ctx.beginPath();
  ctx.arc(c, c, R * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2210';
  ctx.beginPath();
  ctx.arc(c, c, R * 0.13, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
  return key;
}

/** Paint the full roulette wheel (pockets, numbers, cone) into a texture; pocket 0 at the top. */
export function paintRouletteWheel(scene: Phaser.Scene, key: string, r: number): string {
  if (scene.textures.exists(key)) return key;
  const size = Math.ceil(r * 2.3);
  const tex = scene.textures.createCanvas(key, size, size)!;
  const ctx = tex.getContext();
  const c = size / 2;
  const n = WHEEL_ORDER.length;
  const step = (Math.PI * 2) / n;
  const circle = (rad: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(c, c, rad, 0, Math.PI * 2);
    ctx.fill();
  };
  circle(r * 1.12, '#5a2e12');
  circle(r * 1.02, '#c9a03a');
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + i * step - step / 2;
    ctx.fillStyle = hex(COLORS[colorOf(WHEEL_ORDER[i]!)]);
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, r, a0, a0 + step);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = '#e9c86a';
  ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * step - step / 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r * 0.62, c + Math.sin(a) * r * 0.62);
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(i * step);
    ctx.font = `900 ${Math.round(r * 0.09)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(WHEEL_ORDER[i]), 0, -r * 0.86);
    ctx.restore();
  }
  circle(r * 0.62, '#7a3e18');
  circle(r * 0.5, '#9a5a28');
  ctx.strokeStyle = '#e9c86a';
  ctx.lineWidth = r * 0.05;
  ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(a) * r * 0.36, c + Math.sin(a) * r * 0.36);
    ctx.stroke();
  }
  circle(r * 0.14, '#e9c86a');
  tex.refresh();
  return key;
}
