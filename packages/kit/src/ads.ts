/**
 * Ads interface. Games only talk to this, never to an ad SDK directly, so the
 * network (AdMob now, AppLovin MAX mediation later) can change without touching
 * game code.
 *
 * Policy guardrails live here, not in each game:
 *  - rewarded ads are only ever shown after the player taps an explicit offer
 *  - interstitials only at natural breaks, with a cooldown and a "grace period"
 *    for brand-new players
 *  - the "Remove Ads" purchase disables interstitials (rewarded stay opt-in)
 */
export interface AdsProvider {
  showRewarded(placement: string): Promise<boolean>;
  showInterstitial(placement: string): Promise<void>;
}

export interface InterstitialPolicy {
  /** No interstitials until the player has completed this many levels. */
  graceLevels: number;
  /** Minimum seconds between interstitials. */
  cooldownSeconds: number;
  /** Show at most one per this many eligible breaks. */
  everyNBreaks: number;
}

export const DEFAULT_INTERSTITIAL_POLICY: InterstitialPolicy = {
  graceLevels: 8,
  cooldownSeconds: 90,
  everyNBreaks: 3,
};

export class AdsService {
  noAds = false;
  private lastShown = -Infinity;
  private breaks = 0;

  private readonly provider: AdsProvider;
  policy: InterstitialPolicy;
  private readonly now: () => number;

  constructor(
    provider: AdsProvider,
    policy: InterstitialPolicy = DEFAULT_INTERSTITIAL_POLICY,
    now: () => number = () => Date.now(),
  ) {
    this.provider = provider;
    this.policy = policy;
    this.now = now;
  }

  /** Rewarded: resolves true only if the player watched to completion. */
  rewarded(placement: string): Promise<boolean> {
    return this.provider.showRewarded(placement);
  }

  /** Call at a natural break (e.g. between levels). Decides whether to show. */
  async atBreak(placement: string, levelsCompleted: number): Promise<boolean> {
    if (this.noAds || levelsCompleted < this.policy.graceLevels) return false;
    this.breaks++;
    if (this.breaks % this.policy.everyNBreaks !== 0) return false;
    if ((this.now() - this.lastShown) / 1000 < this.policy.cooldownSeconds) return false;
    this.lastShown = this.now();
    await this.provider.showInterstitial(placement);
    return true;
  }
}

/** Development stand-in: rewarded ads succeed instantly, interstitials are no-ops. */
export class FakeAdsProvider implements AdsProvider {
  async showRewarded(): Promise<boolean> {
    return true;
  }
  async showInterstitial(): Promise<void> {}
}
