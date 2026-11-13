/**
 * Automated play-test: visits every game in the casino, plays a round of each
 * with real taps, saves screenshots, and fails on any console error.
 * Usage: node tests/e2e/playtest.mjs [url]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const url = process.argv[2] ?? 'http://localhost:5174/';
const out = new URL('../../screenshots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (n) => page.screenshot({ path: `${out}${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);
const step = (msg) => console.log(`· ${msg}`);

await page.goto(url);
await wait(5000);
const box = await page.locator('canvas').boundingBox();
const tap = (x, y) => page.mouse.click(box.x + (x * box.width) / 1080, box.y + (y * box.height) / 1920);
const back = async () => { await tap(90, 100); await wait(2500); };
await shot('01-lobby');

step('collect bonus');
await tap(540, 540);
await wait(1500);

step('slots');
await tap(540, 820);
await wait(2500);
for (let i = 0; i < 4; i++) {
  await tap(540, 1640);
  await wait(800);
  if (i === 0) await shot('02-slots-spinning');
  await page.waitForFunction(() => !globalThis.__slots.spinning(), null, { timeout: 120000 });
  await wait(600);
}
await shot('03-slots');
await back();

step('blackjack');
await tap(300, 1185);
await wait(2500);
await tap(710, 1820); // Deal
await wait(4500);
await shot('04-blackjack-deal');
if ((await page.evaluate(() => globalThis.__bj.phase())) === 'player') await page.evaluate(() => globalThis.__bj.stand());
await wait(5000);
await shot('05-blackjack-result');
await back();

step('video poker');
await tap(300, 1545);
await wait(2500);
await tap(860, 1780); // Deal
await wait(3500);
await tap(148, 1080); // hold first two
await tap(344, 1080);
await wait(600);
await shot('06-videopoker-hold');
await tap(860, 1780); // Draw
await wait(3500);
await shot('07-videopoker-result');
await back();

step('roulette');
await tap(780, 1545);
await wait(2500);
await tap(115 + 190 * 1 + 95, 384 + 5 * 86 + 43); // number 17
await tap(115 + 190 * 3 + 120 + 70, 384 + 4 * 86 + 86); // RED
await tap(115 + 190 * 3 + 60, 384 + 4 * 86 * 1 + 172); // 2nd dozen
await wait(800);
await shot('08-roulette-bets');
await tap(800, 1820); // Spin
await wait(3000);
await shot('09-roulette-wheel');
await wait(9000);
await shot('10-roulette-result');
await back();

step("hold'em");
await tap(780, 1185);
await wait(2500);
await shot('11-holdem-stakes');
await tap(540, 900 - 170); // Casual table
const t0 = Date.now();
let lastHand = 0;
let shots = 0;
while (Date.now() - t0 < 150000) {
  const s = await page.evaluate(() => globalThis.__holdem.state());
  if (s.hand >= 4) break;
  if (s.toAct === 0) {
    if (shots === 0) { await shot('12-holdem-your-turn'); shots++; }
    await tap(750, 1690); // check / call
    await wait(500);
  }
  if (s.street === 'done' && s.hand !== lastHand) {
    lastHand = s.hand;
    if (shots === 1) { await wait(1500); await shot('13-holdem-showdown'); shots++; }
  }
  await wait(250);
}
step(`played ${(await page.evaluate(() => globalThis.__holdem.state())).hand} hands`);
await back();
await wait(1000);
await shot('14-lobby-after');

await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Play-test passed with no console errors.');
