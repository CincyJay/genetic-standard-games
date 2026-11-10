import Phaser from 'phaser';
import { buildSeedTextures } from '../art.ts';
import { analytics, applySettings } from '../services.ts';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    applySettings();
    buildSeedTextures(this);
    analytics.track('session_start', {});
    this.scene.start('menu');
  }
}
