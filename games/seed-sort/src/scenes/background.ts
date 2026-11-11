import Phaser from 'phaser';

/** Warm paper backdrop with a soft vertical falloff. */
export function drawBackground(scene: Phaser.Scene): void {
  const { width: w, height: h } = scene.scale;
  const g = scene.add.graphics();
  g.fillGradientStyle(0xf6efe0, 0xf6efe0, 0xead9bd, 0xead9bd, 1);
  g.fillRect(0, 0, w, h);
  g.setDepth(-10).setScrollFactor(0);
}
