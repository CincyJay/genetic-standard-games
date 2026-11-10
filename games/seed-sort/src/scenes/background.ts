import Phaser from 'phaser';

/** Deep navy backdrop with a soft vertical falloff. Nothing decorative competes with the board. */
export function drawBackground(scene: Phaser.Scene): void {
  const { width: w, height: h } = scene.scale;
  const g = scene.add.graphics();
  g.fillGradientStyle(0x16233b, 0x16233b, 0x0c1424, 0x0c1424, 1);
  g.fillRect(0, 0, w, h);
  g.setDepth(-10).setScrollFactor(0);
}
