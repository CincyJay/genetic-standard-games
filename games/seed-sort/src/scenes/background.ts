import Phaser from 'phaser';

/** Soft garden backdrop shared by all scenes. */
export function drawBackground(scene: Phaser.Scene): void {
  const { width: w, height: h } = scene.scale;
  const g = scene.add.graphics();
  g.fillGradientStyle(0xfff9ef, 0xfff9ef, 0xf3f7e4, 0xf3f7e4, 1);
  g.fillRect(0, 0, w, h);
  // rolling hills at the bottom
  g.fillStyle(0xdcebc5, 1);
  g.fillEllipse(w * 0.2, h + 40, w * 1.1, 360);
  g.fillStyle(0xcfe4b4, 1);
  g.fillEllipse(w * 0.85, h + 70, w * 1.0, 380);
  // floating soft dots
  const rng = new Phaser.Math.RandomDataGenerator(['bg']);
  for (let i = 0; i < 14; i++) {
    g.fillStyle(0xffe6b8, 0.35);
    g.fillCircle(rng.between(0, w), rng.between(0, h * 0.8), rng.between(6, 22));
  }
  g.setDepth(-10);
}
