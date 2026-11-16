/**
 * Browser test of the 3D floor prototype (VA-0016), with real touch taps at a phone viewport:
 * walk by tapping the floor, switch cameras, tap the free seat, sit, land in blackjack, come
 * back to the same spot. Fails on any console error. Uses a fresh browser profile, so no real
 * save is touched, and `?floor3d` never signs in to Firebase.
 * Usage: node tests/e2e/floor3d.mjs [url] [outDir]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = (process.argv[2] ?? 'http://localhost:5175/') + '?floor3d';
const out = process.argv[3] ?? fileURLToPath(new URL('../../screenshots/', import.meta.url));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2.8125, hasTouch: true, isMobile: true });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const ok = (cond, msg) => {
  if (!cond) {
    console.log('FAIL:', msg);
    process.exitCode = 1;
  } else console.log('ok  ', msg);
};
// screenshots are captures for review, not assertions. The software renderer here sometimes
// stalls a capture past Playwright's 30 s default (VA-0033, VA-0036), which used to crash the
// whole run. Retry with a longer timeout, and if a capture still fails, warn and carry on so the
// behaviour checks after it still run.
const shotFailures = [];
const shot = async (name) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.screenshot({ path: `${out}/${name}.png`, timeout: 45000 });
      return;
    } catch (e) {
      console.log(`warn screenshot ${name} attempt ${attempt} failed: ${String(e).split('\n')[0]}`);
      await page.waitForTimeout(500);
    }
  }
  shotFailures.push(name);
};
const st = () => page.evaluate(() => globalThis.__floor3d?.debug.state());
const scene = () => page.evaluate(() => globalThis.__scene?.()?.scene.key);
const until = async (fn, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await page.waitForTimeout(100);
  }
  return false;
};

await page.goto(url);
ok(await until(() => page.evaluate(() => !!globalThis.__floor3d), 30000), 'the 3D floor opens straight from boot with ?floor3d');
await page.waitForTimeout(800);
await shot('floor3d-01-follow');
const s0 = await st();
ok(s0.mode === 'follow' && Math.abs(s0.pos.z - 4.3) < 0.01, 'starts at the entrance in the follow view');
const rows = await page.evaluate(() => ['.back', '.cam', '.gear'].map((c) => document.querySelector(`#va3d-hud ${c}`).getBoundingClientRect().top));
const badgeTop = await page.evaluate(() => document.querySelector('#va3d-hud .badge').getBoundingClientRect().top);
ok(Math.max(...rows) - Math.min(...rows) < 2 && badgeTop > 832 - 40, 'portrait: the top bar is one row and the prototype badge sits at the bottom, clear of the floor labels');
ok(!(await page.locator('#va3d-hud .rotate').isVisible()), 'rotation, motion and roof settings wait in the ⚙ menu');

// tap the floor a few metres ahead and to the right
let p = await page.evaluate(() => globalThis.__floor3d.debug.screenOf(0.8, 0, 2.2));
await page.touchscreen.tap(p.x, p.y);
ok(p.x > 0 && p.x < 384 && p.y > 0 && p.y < 832, 'the tap point is on screen');
ok(await until(async () => (await st()).walking), 'a floor tap starts a walk');
ok(await until(async () => !(await st()).walking), 'the walk finishes');
const s1 = await st();
ok(Math.hypot(s1.pos.x - 0.8, s1.pos.z - 2.2) < 0.3, `arrives where tapped (${s1.pos.x.toFixed(2)}, ${s1.pos.z.toFixed(2)})`);

// switch to the overview with the on-screen button
await page.locator('#va3d-hud .cam').tap();
ok(await until(async () => (await st()).mode === 'overview'), 'the camera button switches to the overview');
ok(await until(async () => !(await st()).transitioning, 3000), 'the transition finishes');
await shot('floor3d-02-overview');

// a taken seat refuses
p = await page.evaluate(() => globalThis.__floor3d.debug.seatScreen('blackjack_2'));
await page.touchscreen.tap(p.x, p.y);
await page.waitForTimeout(300);
ok((await page.locator('#va3d-hud .toast').textContent()).includes('taken'), 'tapping the taken seat says it is taken');

// tap the free seat in the overview: walk, sit, open blackjack
p = await page.evaluate(() => globalThis.__floor3d.debug.seatScreen('blackjack_1'));
await page.touchscreen.tap(p.x, p.y);
ok(await until(async () => (await st())?.seat === 'blackjack_1'), 'tapping the free seat claims it');
await until(async () => (await st())?.sitting, 6000);
await shot('floor3d-03-sitting');
ok(await until(async () => (await scene()) === 'blackjack', 10000), 'sitting down opens the existing blackjack scene');
ok((await page.locator('#va3d-canvas').count()) === 0, 'the 3D canvas is removed while blackjack runs');
await page.waitForTimeout(1200);
await shot('floor3d-04-blackjack');

// back (the same path as Android Back) returns to the floor at the seat's standing spot
await page.evaluate(() => globalThis.__scene().events.emit('back'));
ok(await until(() => page.evaluate(() => !!globalThis.__floor3d), 15000), 'Back from blackjack returns to the 3D floor');
await page.waitForTimeout(800);
const s2 = await st();
ok(Math.hypot(s2.pos.x - -1.467, s2.pos.z - 0.373) < 0.1, `returns standing at the seat (${s2.pos.x.toFixed(2)}, ${s2.pos.z.toFixed(2)})`);
ok(s2.mode === 'overview', 'the camera choice is kept');
await shot('floor3d-05-returned');

// back to the follow view, try the joystick
await page.locator('#va3d-hud .cam').tap();
await until(async () => { const q = await st(); return q.mode === 'follow' && !q.transitioning; }, 3000);
await page.waitForTimeout(300);
const box = await page.locator('#va3d-hud .joy').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
const cdp = await page.context().newCDPSession(page);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
// you come back facing the table (your chair is right ahead), so first hold the stick down to
// step back, then up, then right: back toward the camera, away from it, then to its right
// the software renderer here handles touch events late: before each push, wait until the
// avatar has stopped, so the previous push's tail isn't counted in this one
const settle = async () => {
  let prev = await st();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    const q = await st();
    if (Math.hypot(q.pos.x - prev.pos.x, q.pos.z - prev.pos.z) < 1e-4 && q.camYaw === prev.camYaw) return q;
    prev = q;
  }
  return prev;
};
for (const [name, dx, dy, along] of [['down', 0, 50, 'back'], ['up', 0, -50, 'forward'], ['right', 50, 0, 'right']]) {
  const b = await settle();
  await touch('touchStart', cx, cy);
  await touch('touchMove', cx + dx, cy + dy);
  // hold until the avatar has walked a bit: the software renderer here delivers touch events
  // up to a few seconds late, so a fixed hold time doesn't mean a fixed walk (we check direction)
  await until(async () => { const q = await st(); return Math.hypot(q.pos.x - b.pos.x, q.pos.z - b.pos.z) > 0.6; }, 5000);
  await touch('touchEnd');
  const a = await settle();
  const mv = { x: a.pos.x - b.pos.x, z: a.pos.z - b.pos.z };
  const fl = Math.hypot(b.cam.target.x - b.cam.pos.x, b.cam.target.z - b.cam.pos.z);
  const f = { x: (b.cam.target.x - b.cam.pos.x) / fl, z: (b.cam.target.z - b.cam.pos.z) / fl };
  const comp = along === 'forward' ? mv.x * f.x + mv.z * f.z : along === 'back' ? -(mv.x * f.x + mv.z * f.z) : mv.x * -f.z + mv.z * f.x;
  ok(comp > 0.5 && comp > 0.9 * Math.hypot(mv.x, mv.z), `the joystick pushed ${name} walks ${along} relative to the camera (${comp.toFixed(2)} m)`);
}
// held a little left of straight-up on open floor: the camera swings round behind the avatar,
// but the walk must stay a straight line (it used to curl into a circle)
await page.evaluate(() => globalThis.__floor3d.debug.place(0, 4.3, 0));
const d0 = await settle();
await touch('touchStart', cx, cy);
await touch('touchMove', cx - 20, cy - 46);
const trail = [];
await until(async () => {
  const q = await st();
  trail.push(q.pos);
  return Math.hypot(q.pos.x - d0.pos.x, q.pos.z - d0.pos.z) > 2;
}, 15000);
await touch('touchEnd');
const d1 = await settle();
const ln = Math.hypot(d1.pos.x - d0.pos.x, d1.pos.z - d0.pos.z);
const ux = (d1.pos.x - d0.pos.x) / ln;
const uz = (d1.pos.z - d0.pos.z) / ln;
const off = Math.max(...trail.map((q) => Math.abs((q.x - d0.pos.x) * uz - (q.z - d0.pos.z) * ux)));
ok(ln > 1.5 && off < 0.15, `a push a little off straight-up walks in a straight line (${ln.toFixed(2)} m, strays ${off.toFixed(3)} m)`);
ok(Math.abs(d1.camYaw - d0.camYaw) > 0.1, `the camera still swings round behind the walk (${(d1.camYaw - d0.camYaw).toFixed(2)} rad)`);
await shot('floor3d-06-follow-joystick');

// turned sideways (the phone build rotates the floor; here the viewport stands in for it)
await page.setViewportSize({ width: 832, height: 384 });
// the software renderer can take a few seconds to deliver the resize, so wait for it
let land = await st();
let landW = 0;
await until(async () => {
  land = await st();
  landW = (await page.locator('#va3d-canvas').boundingBox())?.width ?? 0;
  return land.cam.fov === 50 && landW === 832;
}, 8000);
ok(land.cam.fov === 50 && landW === 832, `landscape: the floor fills the wide screen with a narrower follow view (fov ${land.cam.fov}, canvas ${landW} px)`);
await page.locator('#va3d-hud .gear').tap();
await page.waitForTimeout(200);
const rot = await page.locator('#va3d-hud .rotate').boundingBox();
const roofB = await page.locator('#va3d-hud .roof').boundingBox();
ok(rot && rot.height >= 48 && rot.y >= 0 && roofB && roofB.y + roofB.height <= 384, 'landscape: the settings menu and its buttons stay on screen at 48 dp');
await page.locator('#va3d-hud .gear').tap();
await shot('floor3d-07-landscape');

const stats = await page.evaluate(() => globalThis.__floor3d.stats());
ok(stats.reelTextures === 10, `every cabinet's reels show its machine's symbol atlas (${stats.reelTextures} of 10)`);
console.log('stats', JSON.stringify(stats));
if (stats.pilot05) ok(stats.heroTextures[0] === 2 && stats.heroTextures[1] === 2, `the hero's title and BONUS sign textures are still drawn after batching (${stats.heroTextures.join(' of ')})`);
ok(stats.lightMode === 'vegas', 'the floor opens in the Vegas lighting (dim room, neon bloom) by default');
// the ⚙ menu switches the lighting live, without a reload
await page.locator('#va3d-hud .gear').tap();
await page.waitForTimeout(200);
await page.locator('#va3d-hud .lightmode').tap();
await page.locator('#va3d-hud .gear').tap();
await page.waitForTimeout(800);
const flat = await page.evaluate(() => globalThis.__floor3d.stats());
ok(flat.lightMode === 'flat' && (await page.evaluate(() => localStorage.getItem('va3d.light'))) === 'flat', 'the lighting button switches to flat and remembers it');
console.log(`lighting draw calls: vegas ${stats.drawCalls} (scene + bloom), flat ${flat.drawCalls}`);
ok(stats.drawCalls <= 120 && stats.triangles <= 150000, `vegas stays within the 120 draw-call / 150k triangle budget (${stats.drawCalls} calls, ${stats.triangles} tris)`);
await shot('floor3d-08-landscape-flat');
await page.locator('#va3d-hud .gear').tap();
await page.waitForTimeout(200);
await page.locator('#va3d-hud .lightmode').tap();
await page.locator('#va3d-hud .gear').tap();
ok(await until(async () => (await page.evaluate(() => globalThis.__floor3d.stats())).lightMode === 'vegas', 3000), 'and back to Vegas');
ok(stats.artInteractive === 30 && stats.reelCells === 250, `each slot's reels, spin button and marquee stay separate from the batches (${stats.artInteractive} parts, ${stats.reelCells} reel cells)`);
// walking up to the hero slot frames its screen beside the avatar (VA-0043), still in landscape.
// The framing eases in and out over frame time, and the software renderer here draws only a few
// frames a second, so these waits are generous; on a phone it settles in well under a second.
await page.evaluate(() => globalThis.__floor3d.debug.place(-3.65, -5.6, -Math.PI / 2));
const framed = await until(async () => ((await st()).focus?.weight ?? 0) > 0.9, 30000);
const fs = await st();
ok(framed && fs.focus.id === 'sevens', `facing the hero slot up close, the follow camera frames it (${fs.focus ? fs.focus.id + ' ' + fs.focus.weight.toFixed(2) : 'no focus'})`);
await page.waitForTimeout(300);
const scr = await page.evaluate(() => ({ avatar: globalThis.__floor3d.debug.screenOf(-3.65, 0.9, -5.6), screen: globalThis.__floor3d.debug.screenOf(-5.15, 1.45, -5.6) }));
ok(scr.screen.x - scr.avatar.x > 120, `the avatar stands left of the machine screen, not over it (avatar x ${Math.round(scr.avatar.x)}, screen x ${Math.round(scr.screen.x)} of 832)`);
const chairAlpha = (await st()).propAlpha?.sevens ?? 1;
ok(chairAlpha < 0.5, `the hero's swivel chair fades while the machine is framed, so it no longer covers the reels (opacity ${chairAlpha.toFixed(2)})`);
const fstats = await page.evaluate(() => globalThis.__floor3d.stats());
console.log(`framed close-up: ${fstats.drawCalls} draw calls, ${fstats.triangles} tris`);
await shot('floor3d-09-landscape-hero-framed');
await page.evaluate(() => globalThis.__floor3d.debug.place(0, 4.3, 0));
ok(await until(async () => (await st()).focus === null, 45000), 'turning away from the machines releases the framing');
ok(await until(async () => ((await st()).propAlpha?.sevens ?? 1) === 1, 5000), 'and the chair is solid again');
if (shotFailures.length) console.log(`warn screenshots not captured: ${shotFailures.join(', ')}`);
ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
