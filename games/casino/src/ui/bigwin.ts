import Phaser from 'phaser';
import { DISPLAY_FONT, audio, haptics } from '../services.ts';
import { VH, VW, screenDim, text } from './common.ts';

/** Win tiers by multiple of the bet. */
export const WIN_TIERS = [
  { at: 10, name: 'BIG WIN', color: '#ffd23f', stroke: '#6a2a00' },
  { at: 25, name: 'SUPER WIN', color: '#7dffb0', stroke: '#063a1e' },
  { at: 50, name: 'MEGA WIN', color: '#7fd8ff', stroke: '#06223a' },
  { at: 100, name: 'EPIC WIN', color: '#ff7ad9', stroke: '#3a0630' },
];

export function tierFor(win: number, bet: number): number {
  let t = -1;
  WIN_TIERS.forEach((x, i) => {
    if (win >= x.at * bet) t = i;
  });
  return t;
}

/** Light rays painted once into a texture (rotating the image is fine; text is what clips). */
function raysTexture(scene: Phaser.Scene): string {
  const key = 'tex-rays';
  if (scene.textures.exists(key)) return key;
  const size = 1600;
  const tex = scene.textures.createCanvas(key, size, size)!;
  const ctx = tex.getContext();
  const c = size / 2;
  const grad = ctx.createRadialGradient(c, c, 40, c, c, c);
  grad.addColorStop(0, 'rgba(255,230,140,0.55)');
  grad.addColorStop(0.5, 'rgba(255,200,80,0.18)');
  grad.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = grad;
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + (Math.PI / n) * 0.9;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, c, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(c, c, 0, c, c, 420);
  glow.addColorStop(0, 'rgba(255,240,190,0.6)');
  glow.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
  return key;
}

/**
 * Full-screen big-win celebration: rays, a rolling counter that climbs through
 * the tiers (BIG, SUPER, MEGA, EPIC), and a fountain of coins. Tap to skip to
 * the total, tap again to close. The coins were already paid; this only shows them.
 */
export function showBigWin(scene: Phaser.Scene, win: number, bet: number, done?: () => void): void {
  const top = tierFor(win, bet);
  if (top < 0) {
    done?.();
    return;
  }
  const cx = VW / 2;
  const cy = VH / 2 - 60;
  const dim = screenDim(scene, 0.72, 400);
  const rays = scene.add.image(cx, cy, raysTexture(scene)).setDepth(401).setScale(0.2).setAlpha(0);
  scene.tweens.add({ targets: rays, scale: 1.1, alpha: 1, duration: 500, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: rays, angle: 360, duration: 16000, repeat: -1 });
  const title = text(scene, cx, cy - 170, WIN_TIERS[0]!.name, 132, '900', WIN_TIERS[0]!.color, DISPLAY_FONT)
    .setStroke(WIN_TIERS[0]!.stroke, 18)
    .setDepth(403)
    .setShadow(0, 10, '#000000', 16, true, true);
  const amount = text(scene, cx, cy + 40, '0', 120, '900', '#ffffff', DISPLAY_FONT).setStroke('#2a0e00', 16).setDepth(403);
  const hint = text(scene, cx, cy + 300, 'Tap to continue', 40, '700', '#ffffff').setDepth(403).setAlpha(0);
  title.setScale(0);
  scene.tweens.add({ targets: title, scale: 1, duration: 420, ease: 'Back.easeOut' });

  // coin fountain from the bottom of the screen
  const fountain = scene.add.particles(cx, VH + 40, 'coin', {
    speedY: { min: -2300, max: -1500 },
    speedX: { min: -650, max: 650 },
    gravityY: 2600,
    lifespan: 2000,
    scale: { min: 0.32, max: 0.6 },
    rotate: { min: 0, max: 360 },
    frequency: 26,
    quantity: 2,
  });
  fountain.setDepth(402);

  // count-up: each tier gets its own stretch of time, so the climb feels like a build
  const stops = WIN_TIERS.slice(0, top + 1).map((t) => t.at * bet);
  stops.push(win);
  const duration = 1600 + top * 1500;
  let tier = 0;
  let finished = false;
  let coinTick = 0;
  const setTier = (i: number) => {
    if (i === tier) return;
    tier = i;
    const t = WIN_TIERS[i]!;
    title.setText(t.name).setColor(t.color).setStroke(t.stroke, 18);
    title.setScale(1.6);
    scene.tweens.add({ targets: title, scale: 1, duration: 360, ease: 'Back.easeOut' });
    scene.cameras.main.shake(260, 0.006);
    audio.win();
    haptics.fire('success');
  };
  const counter = scene.tweens.addCounter({
    from: 0,
    to: win,
    duration,
    ease: 'Sine.easeOut',
    onUpdate: (tw) => {
      const v = Math.round(tw.getValue() ?? 0);
      amount.setText(v.toLocaleString('en-US'));
      for (let i = WIN_TIERS.length - 1; i >= 0; i--) {
        if (i <= top && v >= WIN_TIERS[i]!.at * bet) {
          setTier(i);
          break;
        }
      }
      if (++coinTick % 6 === 0) audio.coins(2);
    },
    onComplete: () => finish(),
  });
  audio.win();
  haptics.fire('success');

  const finish = () => {
    if (finished) return;
    finished = true;
    counter.stop();
    setTier(top);
    amount.setText(win.toLocaleString('en-US'));
    scene.tweens.add({ targets: amount, scale: { from: 1.25, to: 1 }, duration: 300, ease: 'Back.easeOut' });
    fountain.stop();
    hint.setAlpha(1);
    scene.tweens.add({ targets: hint, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    // closes by itself after a moment so autoplay keeps going
    scene.time.delayedCall(2600, close);
  };
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    zone.destroy();
    scene.tweens.add({
      targets: [rays, title, amount, hint],
      alpha: 0,
      duration: 260,
      onComplete: () => {
        [rays, title, amount, hint, dim].forEach((o) => o.destroy());
        scene.time.delayedCall(1800, () => fountain.destroy());
        done?.();
      },
    });
  };
  const zone = scene.add.zone(cx, VH / 2, VW * 3, VH * 3).setDepth(404).setScrollFactor(0).setInteractive();
  zone.on('pointerup', () => (finished ? close() : finish()));
  (globalThis as Record<string, unknown>).__bigWin = { skip: () => (finished ? close() : finish()) };
}
