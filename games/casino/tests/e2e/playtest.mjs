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
// Galaxy S25 proportions (1080x2340 screen, ~384x832 CSS px)
const page = await (
  await browser.newContext({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2.8125, isMobile: true, hasTouch: true })
).newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (n) => page.screenshot({ path: `${out}${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);
const step = (msg) => console.log(`· ${msg}`);

await page.goto(url);
await wait(5000);
const box = await page.locator('canvas').boundingBox();
// game coordinates are the 1080x1920 design; the canvas may be taller or wider (centered)
const tapRaw = async (x, y) => {
  const v = await page.evaluate(() => globalThis.__view ?? { W: 1080, H: 1920 });
  const px = box.x + ((x + (v.W - 1080) / 2) * box.width) / v.W;
  const py = box.y + ((y + (v.H - 1920) / 2) * box.height) / v.H;
  await page.mouse.click(px, py);
};
const tap = async (x, y) => {
  if (!(await page.evaluate(() => globalThis.__levelUp ?? null))) return tapRaw(x, y);
  // a level-up popped up: collect it first, then tap
  const lu = await page.evaluate(() => globalThis.__levelUp);
  await tapRaw(540, lu.collectY);
  await wait(1200);
  return tapRaw(x, y);
};
// collect any level-up celebration that is covering the screen
const collectLevelUps = async () => {
  for (let k = 0; k < 5; k++) {
    const lu = await page.evaluate(() => globalThis.__levelUp ?? null);
    if (!lu) return;
    await tap(540, lu.collectY);
    await wait(1200);
  }
};
// the back button is pinned to the screen's top-left corner
const back = async () => {
  await collectLevelUps(); await page.mouse.click(box.x + (90 * box.width) / (await page.evaluate(() => globalThis.__view.W)), box.y + (100 * box.height) / (await page.evaluate(() => globalThis.__view.H))); await wait(2500); };
await shot('01-lobby');

step('daily wheel');
await tap(207, 515);
await wait(1500);
await shot('01b-wheel');
await tap(540, 960 + 520); // Spin
await wait(6500);
await shot('01c-wheel-won');
await tap(540, 960 + 520); // Collect
await wait(1500);

step('missions');
await tap(540, 515);
await wait(1500);
await shot('01d-missions');
await tap(540, 960 + 460); // Close
await wait(800);

step('free bonus');
await tap(873, 515);
await wait(1500);

step('slots');
await tap(540, 820);
await wait(2500);
await shot('01e-slot-machines');
await tap(540, 590); // Lucky Sevens
await wait(2500);
for (let i = 0; i < 4; i++) {
  await tap(540, 1640);
  await wait(800);
  if (i === 0) await shot('02-slots-spinning');
  await page.waitForFunction(() => !globalThis.__slots.spinning(), null, { timeout: 120000 });
  await wait(600);
}
await shot('03-slots');
await back(); // to the machine picker
await back(); // to the lobby

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
await tap(115 + 190 * 1, 384 + 5 * 86 + 43); // split 16/17
await tap(115 + 190 * 2, 384 + 6 * 86); // corner 17/18/20/21
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
await tap(540, 960 - 130); // Casual table
const t0 = Date.now();
let lastHand = 0;
let shots = 0;
while (Date.now() - t0 < 150000) {
  const s = await page.evaluate(() => globalThis.__holdem.state());
  if (s.hand >= 4) break;
  if (s.toAct === 0) {
    if (shots === 0) { await shot('12-holdem-your-turn'); shots++; }
    // check / call sits in the bottom bar, pinned to the screen bottom
    const v = await page.evaluate(() => globalThis.__view);
    await page.mouse.click(box.x + ((540 + (v.W - 1080) / 2) * box.width) / v.W, box.y + ((v.H - 105) * box.height) / v.H);
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

step('themed machines (unlocked by raising the level)');
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('velvet-ace.save'));
  raw.data.xp = 20000; // about level 14
  raw.data.coins = 500000;
  localStorage.setItem('velvet-ace.save', JSON.stringify(raw));
});
await page.reload();
await wait(5000);
await shot('15-lobby-level');
await tap(540, 820);
await wait(2500);
await shot('16-slot-machines-unlocked');
for (const [i, id] of [[1, 'pharaoh'], [2, 'ocean'], [3, 'goldrush']]) {
  await tap(540, 590 + i * 360);
  await wait(2500);
  for (let k = 0; k < 3; k++) {
    await tap(540, 1640);
    await wait(800);
    await page.waitForFunction(() => !globalThis.__slots.spinning(), null, { timeout: 120000 });
  }
  await wait(1500);
  await shot(`17-${id}`);
  if (id !== 'ocean') {
    await page.evaluate(() => globalThis.__slots.bonus());
    await wait(2500);
    await shot(`18-${id}-bonus`);
    if (id === 'pharaoh') {
      for (const [x, y] of [[250, 630], [540, 910], [830, 1190]]) { await tap(x, y); await wait(700); }
    } else {
      await tap(540, 960 + 560);
      await wait(6000);
    }
    await shot(`19-${id}-bonus-result`);
    await page.reload();
    await wait(5000);
    await tap(540, 820);
    await wait(2500);
  } else {
    await back();
  }
}

await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Play-test passed with no console errors.');
