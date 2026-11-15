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
import { PokerLobbyScene } from './scenes/PokerLobbyScene.ts';
import { BaccaratScene } from './scenes/BaccaratScene.ts';
import { ThreeCardScene } from './scenes/ThreeCardScene.ts';
import { WarScene } from './scenes/WarScene.ts';
import { CrapsScene } from './scenes/CrapsScene.ts';
import { UthScene } from './scenes/UthScene.ts';
import { CardGameScene } from './scenes/CardGameScene.ts';
import { LoungeScene } from './scenes/LoungeScene.ts';
import { online } from './online.ts';
import { save } from './services.ts';
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
    scene: [BootScene, LobbyScene, RoomScene, PokerLobbyScene, SlotsScene, BlackjackScene, HoldemScene, VideoPokerScene, RouletteScene, BaccaratScene, ThreeCardScene, WarScene, CrapsScene, UthScene, CardGameScene, LoungeScene],
  });
  void setupBackButton(game);
  // moving between rooms and tables: every scene fades up from black, and the
  // table games settle in with a gentle "sitting down" zoom
  const TABLES = ['blackjack', 'roulette', 'baccarat', 'threecard', 'war', 'craps', 'uth', 'holdem', 'videopoker', 'slots', 'cardgame'];
  // sign in quietly in the background; the casino never waits for it
  online.start();
  game.events.once('ready', () => {
    for (const sc of game.scene.scenes) {
      sc.events.on('create', () => {
        // friends see where you are; the profile remembers your favourite game
        const key = sc.scene.key;
        if (key !== 'boot') online.setWhere(key);
        if (TABLES.includes(key))
          save.update((d) => {
            d.gameCounts = { ...(d.gameCounts ?? {}), [key]: (d.gameCounts?.[key] ?? 0) + 1 };
          });
        const cam = sc.cameras.main;
        cam.fadeIn(380, 8, 2, 12);
        if (TABLES.includes(sc.scene.key)) {
          cam.setZoom(1.07);
          cam.zoomTo(1, 650, 'Cubic.easeOut');
        }
      });
    }
  });
  // test hook (dev builds only): jump straight to a scene
  if (import.meta.env.DEV) Object.assign(globalThis, { __go: (key: string, data?: object) => void game.scene.getScenes(true)[0]?.scene.start(key, data), __scene: () => game.scene.getScenes(true)[0] });
}

void start();
