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
// lobby: tiles scroll sideways in two rows; the bottom bar holds bonus, wheel, missions, profile
const TILE_ORDER = ['sevens', 'lanterns', 'pharaoh', 'ocean', 'goldrush', 'blackjack', 'holdem', 'videopoker', 'roulette'];
const openTile = async (name) => {
  await collectLevelUps();
  const i = TILE_ORDER.indexOf(name);
  const col = Math.floor(i / 2);
  const row = i % 2;
  await page.evaluate((c) => globalThis.__lobby.scrollTo(-(c * 466) + 300), col);
  await wait(300);
  const L = await page.evaluate(() => ({ x: globalThis.__lobby.stripX(), top: globalThis.__lobby.rowsTop }));
  await tap(40 + col * 466 + 220 + L.x, L.top + row * 526 + 250);
  await wait(2500);
};
const barTap = async (x) => tap(x, await page.evaluate(() => globalThis.__lobby.barY));
await shot('01-lobby');

step('daily wheel');
await barTap(460);
await wait(1500);
await shot('01b-wheel');
await tap(540, 960 + 520); // Spin
await wait(6500);
await shot('01c-wheel-won');
await tap(540, 960 + 520); // Collect
await wait(1500);

step('missions');
await barTap(660);
await wait(1500);
await shot('01d-missions');
await tap(540, 960 + 460); // Close
await wait(800);

step('hourly bonus');
await barTap(240);
await wait(1500);

step('profile');
await barTap(860);
await wait(1500);
await shot('01e-profile');
await tap(540, 960 + 560); // Close
await wait(800);

step('slots');
await page.evaluate(() => globalThis.__lobby.scrollTo(-2000));
await wait(800);
await shot('01f-lobby-scrolled');
await openTile('sevens');
for (let i = 0; i < 4; i++) {
  await tap(540, 1640);
  await wait(800);
  if (i === 0) await shot('02-slots-spinning');
  await page.waitForFunction(() => !globalThis.__slots.spinning(), null, { timeout: 120000 });
  await wait(600);
}
await shot('03-slots');
await back(); // to the lobby

step('big win');
await openTile('sevens');
await page.evaluate(() => globalThis.__slots.bigWin());
await wait(1500);
await shot('03b-big-win');
await page.waitForFunction(() => !globalThis.__slots.spinning(), null, { timeout: 60000 });
await back();

step('blackjack');
await openTile('blackjack');
await page.evaluate(() => globalThis.__bj.setup(2, true, true));
await wait(800);
await shot('04a-blackjack-betting');
await tap(710, 1835); // Deal
await wait(6000);
await shot('04-blackjack-deal');
for (let k = 0; k < 4; k++) {
  if ((await page.evaluate(() => globalThis.__bj.phase())) === 'player') await page.evaluate(() => globalThis.__bj.stand());
  await wait(1500);
}
await wait(3000);
await shot('05-blackjack-result');
await back();

step('video poker');
await openTile('videopoker');
await wait(2500);
await tap(70 + 315 + 150, 289); // Deuces Wild tab
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
await openTile('roulette');
await wait(2500);
await tap(115 + 190 * 1 + 95, 384 + 5 * 86 + 43); // number 17
await tap(115 + 190 * 1, 384 + 5 * 86 + 43); // split 16/17
await tap(115 + 190 * 2, 384 + 6 * 86); // corner 17/18/20/21
await tap(115 + 190 * 3 + 120 + 70, 384 + 4 * 86 + 86); // RED
await tap(115 + 190 * 3 + 60, 384 + 4 * 86 * 1 + 172); // 2nd dozen
await tap(600, 1820); // Track
await wait(1200);
await tap(540, 650); // Voisins du Zero
await wait(800);
await shot('08b-racetrack');
await tap(600, 1820); // back to the table
await wait(800);
await shot('08-roulette-bets');
await tap(800, 1820); // Spin
await wait(3000);
await shot('09-roulette-wheel');
await wait(9000);
await shot('10-roulette-result');
await back();

step("hold'em");
await openTile('holdem');
await shot('11-holdem-stakes');
await tap(540, 960 - 490); // Casual cash table
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
step('lucky lanterns: hold & spin');
await openTile('lanterns');
await shot('16-lanterns');
await page.evaluate(() => globalThis.__slots.holdSpin());
await wait(6000);
await shot('16b-hold-and-spin');
await page.waitForFunction(() => !globalThis.__slots.spinning(), null, { timeout: 180000 });
await back();
for (const id of ['pharaoh', 'ocean', 'goldrush']) {
  await openTile(id);
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
  } else {
    await back();
  }
}

step('sit & go');
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('velvet-ace.save'));
  raw.data.coins = 500000;
  localStorage.setItem('velvet-ace.save', JSON.stringify(raw));
});
await page.reload();
await wait(5000);
await openTile('holdem');
await shot('20-holdem-chooser');
await tap(540, 960 + 90); // Bronze Sit & Go
const t1 = Date.now();
let snapped = false;
let maxHand = 0;
while (Date.now() - t1 < 90000) {
  const s2 = await page.evaluate(() => globalThis.__holdem.state());
  maxHand = Math.max(maxHand, s2.hand);
  if (s2.hand === 0 && maxHand > 0) break; // tournament ended (busted or won)
  if (s2.hand >= 3 && !snapped) { await shot('21-sng'); snapped = true; }
  if (s2.hand >= 5) break;
  if (s2.toAct === 0) {
    const v = await page.evaluate(() => globalThis.__view);
    await page.mouse.click(box.x + ((540 + (v.W - 1080) / 2) * box.width) / v.W, box.y + ((v.H - 105) * box.height) / v.H);
    await wait(400);
  }
  await wait(250);
}
await wait(1500);
await shot('22-sng-end');
step(`sit & go: played ${maxHand} hands`);

await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Play-test passed with no console errors.');
