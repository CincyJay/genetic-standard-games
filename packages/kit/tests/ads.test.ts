import { describe, expect, it } from 'vitest';
import { AdsService, type AdsProvider } from '../src/ads.ts';

function setup() {
  let now = 0;
  const shown: string[] = [];
  const provider: AdsProvider = {
    showRewarded: async () => true,
    showInterstitial: async (p) => void shown.push(p),
  };
  const ads = new AdsService(provider, { graceLevels: 5, cooldownSeconds: 60, everyNBreaks: 2 }, () => now);
  return { ads, shown, advance: (s: number) => (now += s * 1000) };
}

describe('interstitial policy', () => {
  it('never shows during the new-player grace period', async () => {
    const { ads, shown } = setup();
    for (let i = 0; i < 10; i++) await ads.atBreak('lc', 3);
    expect(shown).toHaveLength(0);
  });

  it('respects frequency and cooldown', async () => {
    const { ads, shown, advance } = setup();
    advance(1000);
    expect(await ads.atBreak('lc', 10)).toBe(false); // 1st break skipped
    expect(await ads.atBreak('lc', 10)).toBe(true); // 2nd break shows
    expect(await ads.atBreak('lc', 10)).toBe(false);
    expect(await ads.atBreak('lc', 10)).toBe(false); // cooldown not elapsed
    advance(61);
    await ads.atBreak('lc', 10);
    expect(await ads.atBreak('lc', 10)).toBe(true);
    expect(shown).toHaveLength(2);
  });

  it('Remove Ads disables interstitials', async () => {
    const { ads, shown } = setup();
    ads.noAds = true;
    for (let i = 0; i < 10; i++) await ads.atBreak('lc', 50);
    expect(shown).toHaveLength(0);
  });
});
