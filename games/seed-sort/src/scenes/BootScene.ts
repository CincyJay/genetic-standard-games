import Phaser from 'phaser';
import { SEED_TYPES } from '../logic/conveyor.ts';
import { THEME, analytics, applySettings } from '../services.ts';

const ITEMS = [...SEED_TYPES, 'golden', 'rock', 'weed'];

/** Loads all artwork with a simple progress bar, then opens the menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    const { width: w, height: h } = this.scale;
    const bar = this.add.graphics();
    this.load.on('progress', (p: number) => {
      bar.clear();
      bar.fillStyle(THEME.surfaceEdge, 1);
      bar.fillRoundedRect(w / 2 - 240, h / 2 - 10, 480, 20, 10);
      bar.fillStyle(THEME.primary, 1);
      bar.fillRoundedRect(w / 2 - 240, h / 2 - 10, Math.max(20, 480 * p), 20, 10);
    });
    // SVG sprites rasterize at 1.5x their display size so they stay crisp
    for (const k of ITEMS) this.load.svg(`item-${k}`, `art/item-${k}.svg`, { width: 240, height: 180 });
    this.load.svg('crate', 'art/crate.svg', { width: 360, height: 330 });
    this.load.image('bg-greenhouse', 'art/bg-greenhouse.jpg');
    this.load.image('bg-garden', 'art/bg-garden.jpg');
  }

  create(): void {
    applySettings();
    // small white dot for particles
    const d = this.make.graphics({}, false);
    d.fillStyle(0xffffff, 1);
    d.fillCircle(8, 8, 8);
    d.generateTexture('dot', 16, 16);
    d.destroy();
    analytics.track('session_start', {});
    this.scene.start('menu');
  }
}
