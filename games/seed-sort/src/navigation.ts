import type Phaser from 'phaser';

/** Start a level. Every "play" path goes through here (the garden story will hook in later). */
export function goToLevel(scene: Phaser.Scene, level: number): void {
  scene.scene.start('play', { level });
}
