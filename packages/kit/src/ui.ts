import Phaser from 'phaser';

/** Shared visual language: soft, bright, rounded. Each game overrides the palette. */
export interface Theme {
  bg: number;
  ink: string;
  inkSoft: string;
  primary: number;
  primaryDark: number;
  secondary: number;
  secondaryDark: number;
  panel: number;
  font: string;
}

export const DEFAULT_THEME: Theme = {
  bg: 0xfff7ec,
  ink: '#3b2f2a',
  inkSoft: '#8a7a70',
  primary: 0x5cc46a,
  primaryDark: 0x3f9a4c,
  secondary: 0xffb347,
  secondaryDark: 0xd98a1f,
  panel: 0xffffff,
  font: '"Nunito", "Trebuchet MS", "Segoe UI", system-ui, sans-serif',
};

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  shadow?: number;
  fontSize?: number;
  textColor?: string;
  theme?: Theme;
}

/** Chunky rounded button with a pressed-down state and a tactile bounce. */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const theme = opts.theme ?? DEFAULT_THEME;
  const w = opts.width ?? 420;
  const h = opts.height ?? 130;
  const r = Math.min(h / 2, 48);
  const depth = 12;
  const color = opts.color ?? theme.primary;
  const shadow = opts.shadow ?? theme.primaryDark;

  const g = scene.add.graphics();
  const draw = (pressed: boolean) => {
    g.clear();
    g.fillStyle(shadow, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + depth, w, h, r);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + (pressed ? depth - 4 : 0), w, h, r);
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(-w / 2 + 16, -h / 2 + (pressed ? depth - 4 : 0) + 10, w - 32, h * 0.32, r * 0.6);
  };
  draw(false);

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: theme.font,
      fontSize: `${opts.fontSize ?? 56}px`,
      fontStyle: '900',
      color: opts.textColor ?? '#ffffff',
    })
    .setOrigin(0.5);
  text.setShadow(0, 3, 'rgba(0,0,0,0.18)', 0);

  const c = scene.add.container(x, y, [g, text]);
  c.setSize(w, h + depth);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => {
    draw(true);
    text.y = depth - 4;
  });
  const release = () => {
    draw(false);
    text.y = 0;
  };
  c.on('pointerout', release);
  c.on('pointerup', () => {
    release();
    scene.tweens.add({ targets: c, scale: { from: 0.94, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    onClick();
  });
  return c;
}

/** Circular icon button (undo, restart, settings...). Icon is drawn by `drawIcon` in a 0-centered box. */
export function makeIconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  drawIcon: (g: Phaser.GameObjects.Graphics) => void,
  onClick: () => void,
  opts: { size?: number; color?: number; shadow?: number } = {},
): Phaser.GameObjects.Container {
  const size = opts.size ?? 120;
  const g = scene.add.graphics();
  g.fillStyle(opts.shadow ?? 0xe8d9c6, 1);
  g.fillCircle(0, 8, size / 2);
  g.fillStyle(opts.color ?? 0xffffff, 1);
  g.fillCircle(0, 0, size / 2);
  const icon = scene.add.graphics();
  drawIcon(icon);
  const c = scene.add.container(x, y, [g, icon]);
  c.setSize(size, size);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerup', () => {
    scene.tweens.add({ targets: c, scale: { from: 0.88, to: 1 }, duration: 240, ease: 'Back.easeOut' });
    onClick();
  });
  return c;
}

/** Pop an object in from nothing. */
export function popIn(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, delay = 0): void {
  const t = target as unknown as Phaser.GameObjects.Components.Transform;
  t.setScale?.(0);
  scene.tweens.add({ targets: target, scale: 1, duration: 380, delay, ease: 'Back.easeOut' });
}

/** Horizontal "no" shake. */
export function shake(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject & { x: number }): void {
  const x0 = target.x;
  scene.tweens.add({
    targets: target,
    x: { from: x0 - 14, to: x0 },
    duration: 260,
    ease: 'Elastic.easeOut',
    easeParams: [1.2, 0.3],
  });
}
