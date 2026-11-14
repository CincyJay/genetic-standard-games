import type Phaser from 'phaser';

/**
 * Android back button / back gesture: inside a game it returns to the lobby
 * (the scene's own back handler runs, so hold'em still cashes you out); in the
 * lobby it sends the app to the background instead of closing it mid-session.
 * Does nothing in a web browser.
 */
export async function setupBackButton(game: Phaser.Game): Promise<void> {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) return;
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', () => {
    const active = game.scene.getScenes(true)[0];
    if (!active || active.scene.key === 'lobby' || active.scene.key === 'boot') {
      void App.minimizeApp();
      return;
    }
    active.events.emit('back');
  });
}
