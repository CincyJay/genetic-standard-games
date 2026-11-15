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
// blocked network connections (this sandbox's proxy, Firebase's database servers) are not game bugs
const sandboxNoise = (t) => /ERR_TUNNEL_CONNECTION_FAILED|Establishing a tunnel via proxy|firebaseio\.com|ERR_CONNECTION_RESET/.test(t);
page.on('console', (m) => m.type() === 'error' && !sandboxNoise(m.text()) && errors.push(m.text()));
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
// lobby has a door per room; each room lists its games
const ROOMS = {
  slots: ['sevens', 'lanterns', 'pharaoh', 'ocean', 'goldrush'],
  poker: ['holdem', 'jacks', 'deuces', 'ddb'],
  tables: ['blackjack', 'roulette', 'baccarat', 'threecard', 'craps', 'uth', 'war'],
  cards: ['euchre', 'hearts', 'spades'],
};
const roomOf = (name) => Object.keys(ROOMS).find((r) => ROOMS[r].includes(name));
const openTile = async (name) => {
  await collectLevelUps();
  if ((await page.evaluate(() => globalThis.__scene().scene.key)) !== 'lobby') {
    await page.evaluate(() => globalThis.__go('lobby'));
    await wait(2500);
  }
  const room = roomOf(name);
  const door = Object.keys(ROOMS).indexOf(room);
  await tap(540, await page.evaluate((i) => globalThis.__lobby.door(i), door));
  await wait(2500);
  const R = await page.evaluate(() => ({ top: globalThis.__room.top, ...globalThis.__room.tile }));
  const i = ROOMS[room].indexOf(name);
  const col = i % R.cols;
  const row = Math.floor(i / R.cols);
  const x = R.cols === 1 ? 540 : 40 + R.w / 2 + col * (R.w + R.gap);
  await tap(x, R.top + R.h / 2 + row * (R.h + R.gap));
  await wait(2500);
};
const tapSpin = async () => {
  const p = await page.evaluate(() => globalThis.__slots.spinXY);
  await tap(p.x, p.y);
};
const barTap = async (x) => tap(x, await page.evaluate(() => globalThis.__lobby.barY));
await shot('01-lobby');

step('daily wheel');
await barTap(420);
await wait(1500);
await shot('01b-wheel');
await tap(540, 960 + 520); // Spin
await wait(6500);
await shot('01c-wheel-won');
await tap(540, 960 + 520); // Collect
await wait(1500);

step('missions');
await barTap(600);
await wait(1500);
await shot('01d-missions');
await tap(540, 960 + 460); // Close
await wait(800);

step('hourly bonus');
await barTap(180);
await wait(1500);

step('profile');
await barTap(960);
await wait(1500);
await shot('01e-profile');
await tap(540, 960 + 560); // Close
await wait(800);

step('dressing room: presets, photo, remove');
await page.evaluate(() => globalThis.__go('dressing'));
await page.waitForFunction(() => globalThis.__dressing, null, { timeout: 30000 });
await wait(2500);
await shot('01g-dressing-room');
{
  // tap the Jasmine tile (7th) with a real tap, then Confirm Selection
  const t = await page.evaluate(() => globalThis.__dressing.tilePos(6));
  await tap(t.x, t.y);
  await wait(600);
  if ((await page.evaluate(() => globalThis.__dressing.draft().preset)) !== 'avatar_07') throw new Error('dressing room: tile tap did not select');
  await tap(540 + 230, await page.evaluate(() => globalThis.__dressing.footerY));
  await wait(1200);
  const mine = () => page.evaluate(() => { const d = JSON.parse(localStorage.getItem('velvet-ace.save')).data; return `${d.avatarMode}:${d.presetAvatarId}:${(d.photo ?? '').slice(0, 14)}`; });
  if ((await mine()) !== 'preset:avatar_07:') throw new Error(`dressing room: preset not saved (${await mine()})`);
  await shot('01h-dressing-confirmed');
  await page.evaluate(() => globalThis.__dressing.tab('photo'));
  await wait(500);
  await page.setInputFiles('input[data-role="avatar-photo"]', new URL('./fixtures/test-photo.jpg', import.meta.url).pathname);
  await page.waitForSelector('[data-role="crop-editor"]');
  await page.locator('[data-role="crop-zoom"]').fill('1.5');
  await shot('01j-photo-crop');
  await page.click('[data-role="crop-save"]');
  await wait(1500);
  if ((await mine()) !== 'photo:avatar_07:data:image/png') throw new Error(`photo not saved (${await mine()})`);
  await shot('01k-photo-saved');
  await page.evaluate(() => globalThis.__dressing.removePhoto());
  await wait(800);
  if ((await mine()) !== 'preset:avatar_07:') throw new Error(`removing the photo did not restore the preset (${await mine()})`);
}
await page.evaluate(() => globalThis.__go('lobby'));
await wait(2000);

step('slots');
await tap(540, await page.evaluate(() => globalThis.__lobby.door(0)));
await wait(2500);
await shot('01f-slots-room');
await openTile('sevens');
for (let i = 0; i < 4; i++) {
  await tapSpin();
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
await openTile('jacks');
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

step('baccarat');
await openTile('baccarat');
await tap(790, 1390); // Banker
await tap(820, 1840); // Deal
await wait(500);
await page.waitForFunction(() => !globalThis.__baccarat.busy(), null, { timeout: 60000 });
await wait(800);
await shot('10b-baccarat');
await back();

step('three card poker');
await openTile('threecard');
await tap(540, 1390); // Ante
await tap(820, 1840); // Deal
await wait(2200);
await collectLevelUps();
await tap(820, 1840); // Play
await wait(2500);
await shot('10c-three-card');
await page.waitForFunction(() => !globalThis.__threecard.busy(), null, { timeout: 60000 });
await back();

step('casino war');
await openTile('war');
await tap(700, 1390); // Bet
await tap(820, 1840); // Deal
await wait(2000);
await collectLevelUps();
if (await page.evaluate(() => globalThis.__war.atWar())) await tap(820, 1840); // go to war
await page.waitForFunction(() => !globalThis.__war.busy() && !globalThis.__war.atWar(), null, { timeout: 60000 });
await shot('10d-war');
await back();

step('craps');
await openTile('craps');
await tap(540, 1210); // Pass Line
await tap(540, 950); // Field
for (let k = 0; k < 3; k++) {
  await tap(800, 1840); // Roll
  await wait(800);
  await page.waitForFunction(() => !globalThis.__craps.rolling(), null, { timeout: 60000 });
  await collectLevelUps();
  if ((await page.evaluate(() => globalThis.__craps.point())) === null) await tap(540, 1210);
}
await shot('10e-craps');
await back();

step("ultimate texas hold'em");
await openTile('uth');
await tap(415, 1390); // Ante (+ Blind)
await tap(820, 1840); // Deal
await wait(2500);
await collectLevelUps();
await tap(190, 1840); // Check
await wait(2000);
await tap(820, 1840); // Bet 2x
await wait(3000);
await shot('10f-uth');
await page.waitForFunction(() => !globalThis.__uth.busy(), null, { timeout: 60000 });
await back();

// Card Club: a hand card sits on a row along the bottom; tap its visible left strip
const handTap = async (i) => {
  const n = await page.evaluate(() => globalThis.__scene().rules.hand(0).length);
  const step = Math.min(130, 900 / Math.max(1, n - 1));
  await tap(540 + (i - (n - 1) / 2) * step - 78 + step / 2, 1680);
  await wait(300);
};
// lets the computer play your seat (fast) until a few tricks or a round have gone by
const autoPlay = async (ms) => {
  await page.evaluate(() => globalThis.__cards.fast());
  const t0 = Date.now();
  while (Date.now() - t0 < ms && !(await page.evaluate(() => globalThis.__cards.over()))) {
    await page.evaluate(() => globalThis.__cards.auto());
    await wait(150);
  }
};

step('hearts');
await openTile('hearts');
await shot('10g-hearts-pass');
for (const i of [12, 11, 10]) await handTap(i);
await tap(540, 1180); // Pass left
await wait(1500);
if ((await page.evaluate(() => globalThis.__cards.phase())) !== 'play') throw new Error('hearts: the pass did not go through');
await autoPlay(8000);
await shot('10h-hearts');
await back();

step('spades');
await openTile('spades');
await page.waitForFunction(() => globalThis.__cards.turn() === 0 || globalThis.__cards.phase() === 'play', null, { timeout: 15000 });
if ((await page.evaluate(() => globalThis.__cards.phase())) === 'bid') {
  await tap(130 + 3 * 137, 1080); // bid 3
  await wait(1500);
}
await autoPlay(8000);
await shot('10i-spades');
await back();

step('euchre');
await openTile('euchre');
await page.waitForFunction(() => globalThis.__cards.turn() === 0 || globalThis.__cards.phase() === 'play', null, { timeout: 15000 });
await shot('10j-euchre');
if ((await page.evaluate(() => globalThis.__cards.phase())) === 'order') {
  await tap(540 + 170, 1180); // Pass
  await wait(1200);
}
await autoPlay(60000);
await shot('10k-euchre-end');
if (!(await page.evaluate(() => globalThis.__cards.over()))) throw new Error('euchre: game did not finish');
await back();

step("hold'em");
await openTile('holdem');
await shot('11-poker-lobby');
await page.evaluate(() => globalThis.__pokerlobby.tab('cash'));
await wait(800);
await tap(540, (await page.evaluate(() => globalThis.__pokerlobby.rowY(0))) + 100); // Casual cash table
await wait(2500);
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
step('high-limit machines');
for (const id of ['dragon', 'empire', 'thunder', 'tiger', 'cosmic']) {
  await page.evaluate((id) => globalThis.__go('slots', { machine: id }), id);
  await wait(2500);
  for (let k = 0; k < 2; k++) {
    if (k === 1) await page.evaluate(() => globalThis.__slots.rig(globalThis.__slots.plainRows(), { wildReels: [], luckyWheel: false }));
    await tapSpin();
    await wait(800);
    await page.waitForFunction(() => !globalThis.__slots.spinning(), null, { timeout: 120000 });
  }
  await shot(`16h-${id}`);
}
await page.evaluate(() => globalThis.__go('lobby'));
await wait(2500);
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
    // plain spins: the bonus is played on purpose below
    await page.evaluate(() => globalThis.__slots.rig(globalThis.__slots.plainRows(), { wildReels: [], luckyWheel: false }));
    await tapSpin();
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
await page.evaluate(() => globalThis.__pokerlobby.tab('sitngo'));
await wait(800);
await shot('20-sitngo-list');
await tap(540, (await page.evaluate(() => globalThis.__pokerlobby.rowY(0))) + 100); // Bronze Sit & Go
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

step('poker series tournament');
await page.evaluate(() => globalThis.__go('pokerlobby'));
await wait(2500);
await shot('23-poker-series');
await tap(540, (await page.evaluate(() => globalThis.__pokerlobby.rowY(0))) + 100); // Daily Deepstack
const t2 = Date.now();
let mttHands = 0;
while (Date.now() - t2 < 90000) {
  const s3 = await page.evaluate(() => globalThis.__holdem.state());
  mttHands = Math.max(mttHands, s3.hand);
  if (s3.hand >= 3) break;
  if (s3.toAct === 0) {
    const v = await page.evaluate(() => globalThis.__view);
    await page.mouse.click(box.x + ((540 + (v.W - 1080) / 2) * box.width) / v.W, box.y + ((v.H - 105) * box.height) / v.H);
    await wait(400);
  }
  await wait(250);
}
await shot('24-tournament-table');
step(`tournament: played ${mttHands} hands`);

await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Play-test passed with no console errors.');
