/**
 * Screen rotation for the 3D floor. The app is portrait-only (every 2D game is laid out for
 * portrait), but the 3D floor may turn sideways for a wider view. On the floor the player
 * picks Auto (follow the phone, if Android's auto-rotate is on), Landscape or Portrait; any
 * Phaser scene gets portrait back before it starts. No-ops in a web browser.
 */
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

export type RotatePref = 'auto' | 'landscape' | 'portrait';
export const ROTATE_ORDER: RotatePref[] = ['auto', 'landscape', 'portrait'];

const native = () => Capacitor.isNativePlatform();

/** Applies the floor's rotation choice. */
export async function applyFloorRotation(pref: RotatePref): Promise<void> {
  if (!native()) return;
  try {
    await ScreenOrientation.lock({ orientation: pref === 'auto' ? 'any' : pref });
  } catch {
    /* rotation is a nicety: never block the floor on it */
  }
}

/**
 * Locks the app back to portrait and resolves once the page is portrait-shaped again (or
 * after `ms`), so the Phaser scene that follows lays out for portrait.
 */
export async function backToPortrait(ms = 1500): Promise<void> {
  if (!native()) return;
  try {
    await ScreenOrientation.lock({ orientation: 'portrait' });
  } catch {
    return;
  }
  if (window.innerHeight >= window.innerWidth) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      window.removeEventListener('resize', check);
      clearTimeout(timer);
      // one more frame so the WebView has settled its new size
      requestAnimationFrame(() => resolve());
    };
    const check = () => window.innerHeight >= window.innerWidth && done();
    const timer = window.setTimeout(done, ms);
    window.addEventListener('resize', check);
  });
}
