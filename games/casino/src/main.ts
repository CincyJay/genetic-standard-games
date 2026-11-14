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
import { RoomScene } from './scenes/RoomScene.ts';
import { SlotsScene } from './scenes/SlotsScene.ts';
import { VideoPokerScene } from './scenes/VideoPokerScene.ts';
import { setupBackButton } from './native.ts';
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
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: THEME.bg,
    width: 1080,
    height: 1920,
    scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
    input: { activePointers: 1 },
    scene: [BootScene, LobbyScene, RoomScene, SlotsScene, BlackjackScene, HoldemScene, VideoPokerScene, RouletteScene],
  });
  void setupBackButton(game);
  // test hook (dev builds only): jump straight to a scene
  if (import.meta.env.DEV) Object.assign(globalThis, { __go: (key: string, data?: object) => game.scene.getScenes(true)[0]?.scene.start(key, data), __scene: () => game.scene.getScenes(true)[0] });
}

void start();
