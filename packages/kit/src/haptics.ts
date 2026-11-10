/** Haptic feedback. Web uses navigator.vibrate; Week 3 swaps in Capacitor Haptics on iOS/Android. */
export type HapticKind = 'light' | 'medium' | 'success' | 'error';

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 16,
  success: [12, 40, 18],
  error: [20, 30, 20],
};

export class Haptics {
  enabled = true;

  fire(kind: HapticKind): void {
    if (!this.enabled) return;
    try {
      globalThis.navigator?.vibrate?.(PATTERNS[kind]);
    } catch {
      /* unsupported */
    }
  }
}
