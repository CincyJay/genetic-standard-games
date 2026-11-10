import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.ts';
import { GameScene } from './scenes/GameScene.ts';
import { MenuScene } from './scenes/MenuScene.ts';
import { THEME } from './services.ts';

async function start(): Promise<void> {
  // Make sure the bundled font is ready before any text is drawn.
  try {
    await Promise.all([document.fonts.load('900 64px "Nunito"'), document.fonts.load('800 64px "Nunito"')]);
  } catch {
    /* fall back to system font */
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: THEME.bg,
    width: 1080,
    height: 1920,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
    input: { activePointers: 1 },
    scene: [BootScene, MenuScene, GameScene],
  });
}

void start();
