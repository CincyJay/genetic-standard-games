/**
 * One event schema for every game so titles can be compared side by side.
 * Week 3 adds a Firebase implementation; until then events go to the console
 * (dev) and an in-memory buffer (used by automated tests).
 */
export interface StandardEvents {
  session_start: Record<string, never>;
  tutorial_step: { step: number };
  level_start: { level: number; attempt: number };
  level_complete: { level: number; moves: number; seconds: number; stars: number; undos: number };
  level_fail: { level: number; moves: number; reason: string };
  level_restart: { level: number; moves: number };
  ad_offer_shown: { placement: string };
  ad_rewarded_complete: { placement: string };
  ad_interstitial_shown: { placement: string };
  iap_purchase: { product: string };
}

export type EventName = keyof StandardEvents;

export interface Analytics {
  track<E extends EventName>(name: E, params: StandardEvents[E]): void;
}

export class DebugAnalytics implements Analytics {
  readonly events: { name: string; params: unknown; t: number }[] = [];

  private readonly log: boolean;

  constructor(log = false) {
    this.log = log;
  }

  track<E extends EventName>(name: E, params: StandardEvents[E]): void {
    this.events.push({ name, params, t: Date.now() });
    if (this.log) console.info('[analytics]', name, params);
  }
}
