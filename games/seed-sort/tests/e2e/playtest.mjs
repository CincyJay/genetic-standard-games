/**
 * Automated play-test for Conveyor Sort. Opens the game on a phone-sized
 * screen, taps Play, and plays levels with real taps: each seed is tapped when
 * it is over its matching crate, rocks are left alone, weeds are plucked.
 * Fails on any console error. Saves screenshots to screenshots/.
 *
 * Usage: node tests/e2e/playtest.mjs [url] [levels]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const url = process.argv[2] ?? 'http://localhost:5173/';
const levels = Number(process.argv[3] ?? 2);
const out = new URL('../../screenshots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (n) => page.screenshot({ path: `${out}${n}.png` });
const hook = (fn, arg) => page.evaluate(fn, arg);

await page.goto(url);
await page.waitForTimeout(2500);
await shot('01-menu');
const box = await page.locator('canvas').boundingBox();
const tapGame = (x, y) => page.mouse.click(box.x + (x * box.width) / 1080, box.y + (y * box.height) / 1920);

await tapGame(540, 1920 - 520); // Play
await page.waitForFunction(() => globalThis.__seedSort?.state()?.level >= 1);
await page.waitForTimeout(800);
await shot('02-intro');

for (let n = 0; n < levels; n++) {
  await page.waitForFunction(() => globalThis.__seedSort.state().running, null, { timeout: 30000 });
  const level = (await hook(() => globalThis.__seedSort.state())).level;
  let midShot = false;
  const t0 = Date.now();
  for (;;) {
    const s = await hook(() => globalThis.__seedSort.state());
    if (s.ended) break;
    if (Date.now() - t0 > 240000) throw new Error(`Level ${level} timed out`);
    if (!midShot && s.sorted >= 3) {
      await shot(`03-playing-level${level}`);
      midShot = true;
    }
    const bounds = await hook(() => globalThis.__seedSort.laneBounds());
    const pick = s.items.find((it) => {
      if (it.kind === 'rock') return false;
      if (it.kind === 'weed' || it.kind === 'golden') return it.x > 120 && it.x < 960;
      const lane = s.bins.indexOf(it.kind);
      if (lane < 0) return false;
      const [lo, hi] = bounds[lane];
      return it.x > lo + 25 && it.x < hi - 25;
    });
    if (pick) {
      const p = await hook((x) => globalThis.__seedSort.toPage(x, globalThis.__seedSort.beltY), pick.x);
      await page.mouse.click(p.x, p.y);
    }
    await page.waitForTimeout(30);
  }
  const s = await hook(() => globalThis.__seedSort.state());
  console.log(`Level ${level}: ${s.won ? 'cleared' : 'FAILED'} · sorted ${s.sorted}/${s.target} · score ${s.score} · lives ${s.lives}`);
  if (!s.won) throw new Error(`Robot player failed level ${level}`);
  await page.waitForTimeout(5000);
  await shot(`04-win-level${level}`);
  // "Next level": panel is 1460 tall centered at 960 → button at 960 + 730 - 270
  await tapGame(540, 960 + 730 - 270);
  await page.waitForFunction((l) => globalThis.__seedSort.state().level === l + 1, level, { timeout: 15000 });
  await page.waitForTimeout(600);
}

// Later level: five crates, rocks and weeds
await page.evaluate(() => {
  const data = { level: 14, stars: {}, levelsCompleted: 13, bestScore: 2450, garden: { sunflower: 5, tulip: 3, tomato: 2, iris: 1 }, settings: { sound: true, haptics: true } };
  localStorage.setItem('seed-sort.save', JSON.stringify({ v: 2, data }));
});
await page.reload();
await page.waitForTimeout(2500);
await shot('05-menu-returning');
await tapGame(540, 1920 - 320); // My Garden
await page.waitForTimeout(2500);
await shot('06-garden');
await tapGame(100, 110); // back
await page.waitForTimeout(1500);
await tapGame(540, 1920 - 520); // Play
await page.waitForFunction(() => globalThis.__seedSort?.state()?.running, null, { timeout: 30000 });
await page.waitForFunction(() => globalThis.__seedSort.state().items.length >= 4, null, { timeout: 60000 });
await shot('07-level14');

await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Play-test passed with no console errors.');
