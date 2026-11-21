/**
 * Waits until every machine's reel atlas has settled and two more frames have rendered (VA-0349).
 * Until then the reels draw per machine instead of as the one shared sheet (~19 extra draw calls in
 * the grand hall), so draw calls read earlier are the load window, not the steady state.
 */
export async function reelsSettled(page, timeout = 120000) {
  await page.waitForFunction(() => window.__floor3d?.stats().reelsSettled, null, { timeout });
  const f = await page.evaluate(() => window.__floor3d.stats().frames);
  await page.waitForFunction((n) => window.__floor3d.stats().frames >= n + 2, f, { timeout });
}
