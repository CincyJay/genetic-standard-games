import Phaser from 'phaser';

/** Shared visual language: flat, clean, high-contrast. Each game overrides what it needs. */
export interface Theme {
  bg: number;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  inkSoft: string;
  /** Main call-to-action color and its pressed/edge shade. */
  primary: number;
  primaryDark: number;
  /** Text on primary buttons. */
  onPrimary: string;
  /** Raised surfaces: panels, icon buttons. */
  surface: number;
  surfaceEdge: number;
  /** Icon strokes on surfaces. */
  icon: number;
  /** Highlight for selection and hints. */
  accent: number;
  font: string;
}

export const DEFAULT_THEME: Theme = {
  bg: 0x111b2e,
  ink: '#f2f5fb',
  inkSoft: '#8a97b1',
  primary: 0x3ddc84,
  primaryDark: 0x23a862,
  onPrimary: '#0d1a12',
  surface: 0x1d2a44,
  surfaceEdge: 0x0b1322,
  icon: 0xdfe6f3,
  accent: 0xffd84d,
  font: '"Outfit", "Segoe UI", system-ui, sans-serif',
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
  const depth = 8;
  const color = opts.color ?? theme.primary;
  const shadow = opts.shadow ?? theme.primaryDark;

  const g = scene.add.graphics();
  const draw = (pressed: boolean) => {
    g.clear();
    g.fillStyle(shadow, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + depth, w, h, r);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + (pressed ? depth - 4 : 0), w, h, r);
  };
  draw(false);

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: theme.font,
      fontSize: `${opts.fontSize ?? 56}px`,
      fontStyle: '700',
      color: opts.textColor ?? theme.onPrimary,
    })
    .setOrigin(0.5);

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
  opts: { size?: number; color?: number; shadow?: number; theme?: Theme } = {},
): Phaser.GameObjects.Container {
  const theme = opts.theme ?? DEFAULT_THEME;
  const size = opts.size ?? 120;
  const g = scene.add.graphics();
  g.fillStyle(opts.shadow ?? theme.surfaceEdge, 1);
  g.fillCircle(0, 6, size / 2);
  g.fillStyle(opts.color ?? theme.surface, 1);
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
