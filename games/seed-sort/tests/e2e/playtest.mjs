/**
 * Automated play-test: opens the game like a phone would, taps through the
 * menu, and plays levels to completion with real taps (using the solver to
 * pick moves). Fails on any console error. Saves screenshots.
 *
 * Usage: node tests/e2e/playtest.mjs [url] [levelsToPlay]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const url = process.argv[2] ?? 'http://localhost:5173/';
const levelsToPlay = Number(process.argv[3] ?? 3);
const outDir = new URL('../../screenshots/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const shot = (name) => page.screenshot({ path: `${outDir}${name}.png` });
const state = () => page.evaluate(() => globalThis.__seedSort?.state());
const waitIdle = () => page.waitForFunction(() => { const s = globalThis.__seedSort?.state(); return s && !s.busy; });

await page.goto(url);
await page.waitForTimeout(1500);
await shot('01-menu');

// Tap "Play": centered, 58% down the game area.
const box = await page.locator('canvas').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.66);
// Chapter 1 story plays first: screenshot the title card and a dialogue line, then tap through.
await page.waitForTimeout(2500);
await shot('01b-story-title');
await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.78); // "Begin"
await page.waitForTimeout(4000);
await shot('01c-story-line');
await page.mouse.click(box.x + (box.width * 1010) / 1080, box.y + (box.height * 110) / 1920); // "Skip"
await page.waitForFunction(() => globalThis.__seedSort?.state()?.level >= 1);
await page.waitForTimeout(4000); // headless (no GPU) runs at low FPS
await shot('02-level1-tutorial');

const tapJar = async (p) => {
  const pt = await page.evaluate((i) => globalThis.__seedSort.jarPoint(i), p);
  await page.mouse.click(pt.x, pt.y);
};

for (let n = 0; n < levelsToPlay; n++) {
  const level = (await state()).level;
  if (n === 1) {
    // Undo check: make one move, undo it, the board must be back to the start.
    const before = JSON.stringify((await state()).pots);
    const m = await page.evaluate(() => globalThis.__seedSort.solve());
    await tapJar(m.from);
    await page.waitForTimeout(170);
    await tapJar(m.to);
    await waitIdle();
    if (JSON.stringify((await state()).pots) === before) throw new Error('Move did not change the board');
    // Undo button: game coords (540 + 300, 1920 - 190)
    await page.mouse.click(box.x + (box.width * 840) / 1080, box.y + (box.height * 1730) / 1920);
    await page.waitForTimeout(300);
    await waitIdle();
    if (JSON.stringify((await state()).pots) !== before) throw new Error('Undo did not restore the board');
    console.log('Undo restores the board ✓');
  }
  let safety = 200;
  while (!(await state()).won && safety-- > 0) {
    await waitIdle();
    if ((await state()).won) break;
    const move = await page.evaluate(() => globalThis.__seedSort.solve());
    if (!move) throw new Error(`Solver found no move on level ${level}: ${JSON.stringify(await state())}`);
    const a = await page.evaluate((p) => globalThis.__seedSort.jarPoint(p), move.from);
    await page.mouse.click(a.x, a.y);
    await page.waitForTimeout(170);
    if (n === 0 && (await state()).moves === 0) await shot('03-seed-lifted');
    const b = await page.evaluate((p) => globalThis.__seedSort.jarPoint(p), move.to);
    await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(80);
  }
  const s = await state();
  if (!s.won) throw new Error(`Level ${level} not won`);
  console.log(`Level ${level} complete in ${s.moves} moves`);
  await page.waitForTimeout(6000); // let the stars and seed-pack reveal finish (headless runs slowly)
  await shot(`04-win-level${level}`);
  // Tap "Next level" (panel center + 450 game px; game is 1920 tall)
  await page.mouse.click(box.x + box.width / 2, box.y + (box.height * (960 + 450)) / 1920);
  await page.waitForFunction((l) => globalThis.__seedSort.state().level === l + 1 && !globalThis.__seedSort.state().won, level);
  await page.waitForTimeout(1200);
}

// Jump to a returning player with a grown garden, and a late level for the two-row layout.
await page.evaluate(() => {
  const garden = { sunflower: 5, tulip: 3, daisy: 1, iris: 6, blueberry: 2, 'golden-rose': 1, moonflower: 5, tomato: 4 };
  localStorage.setItem('seed-sort.save', JSON.stringify({ v: 1, data: { level: 60, stars: {}, levelsCompleted: 59, garden, settings: { sound: true, haptics: true } } }));
});
await page.reload();
await page.waitForTimeout(1200);
await shot('05-menu-returning');
// Garden button sits 190 game px below Play (66% down)
await page.mouse.click(box.x + box.width / 2, box.y + (box.height * (1920 * 0.66 + 190)) / 1920);
await page.waitForTimeout(2500);
await shot('07-garden');
// back to menu
await page.mouse.click(box.x + (box.width * 110) / 1080, box.y + (box.height * 120) / 1920);
await page.waitForTimeout(1500);
await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.66);
await page.waitForTimeout(1500);
await shot('06-level60');

await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Play-test passed with no console errors.');
