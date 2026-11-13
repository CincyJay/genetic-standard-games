import '@fontsource/outfit/500.css';
import '@fontsource/outfit/700.css';
import '@fontsource/outfit/800.css';
import '@fontsource/outfit/900.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/900.css';
import Phaser from 'phaser';
import { BlackjackScene } from './scenes/BlackjackScene.ts';
import { BootScene } from './scenes/BootScene.ts';
import { HoldemScene } from './scenes/HoldemScene.ts';
import { LobbyScene } from './scenes/LobbyScene.ts';
import { RouletteScene } from './scenes/RouletteScene.ts';
import { SlotsScene } from './scenes/SlotsScene.ts';
import { VideoPokerScene } from './scenes/VideoPokerScene.ts';
import { THEME } from './services.ts';

async function start(): Promise<void> {
  try {
    await Promise.all([
      ...['500', '700', '800', '900'].map((wt) => document.fonts.load(`${wt} 64px "Outfit"`)),
      ...['700', '900'].map((wt) => document.fonts.load(`${wt} 64px "Playfair Display"`)),
    ]);
  } catch {
    /* system fonts */
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
    scene: [BootScene, LobbyScene, SlotsScene, BlackjackScene, HoldemScene, VideoPokerScene, RouletteScene],
  });
}

void start();
