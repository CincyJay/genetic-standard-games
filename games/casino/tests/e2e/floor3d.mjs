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
await page.screenshot({ path: `${out}/floor3d-01-follow.png` });
const s0 = await st();
ok(s0.mode === 'follow' && Math.abs(s0.pos.z - 2.2) < 0.01, 'starts at the entrance in the follow view');

// tap the floor a few metres ahead and to the right
let p = await page.evaluate(() => globalThis.__floor3d.debug.screenOf(0.8, 0, 0.2));
await page.touchscreen.tap(p.x, p.y);
ok(p.x > 0 && p.x < 384 && p.y > 0 && p.y < 832, 'the tap point is on screen');
ok(await until(async () => (await st()).walking), 'a floor tap starts a walk');
ok(await until(async () => !(await st()).walking), 'the walk finishes');
const s1 = await st();
ok(Math.hypot(s1.pos.x - 0.8, s1.pos.z - 0.2) < 0.3, `arrives where tapped (${s1.pos.x.toFixed(2)}, ${s1.pos.z.toFixed(2)})`);

// switch to the overview with the on-screen button
await page.locator('#va3d-hud .cam').tap();
ok(await until(async () => (await st()).mode === 'overview'), 'the camera button switches to the overview');
await page.waitForTimeout(700);
ok(!(await st()).transitioning, 'the transition finishes');
await page.screenshot({ path: `${out}/floor3d-02-overview.png` });

// a taken seat refuses
p = await page.evaluate(() => globalThis.__floor3d.debug.seatScreen('blackjack-1-seat-2'));
await page.touchscreen.tap(p.x, p.y);
await page.waitForTimeout(300);
ok((await page.locator('#va3d-hud .toast').textContent()).includes('taken'), 'tapping the taken seat says it is taken');

// tap the free seat in the overview: walk, sit, open blackjack
p = await page.evaluate(() => globalThis.__floor3d.debug.seatScreen('blackjack-1-seat-1'));
await page.touchscreen.tap(p.x, p.y);
ok(await until(async () => (await st())?.seat === 'blackjack-1-seat-1'), 'tapping the free seat claims it');
await until(async () => (await st())?.sitting, 6000);
await page.screenshot({ path: `${out}/floor3d-03-sitting.png` });
ok(await until(async () => (await scene()) === 'blackjack', 10000), 'sitting down opens the existing blackjack scene');
ok((await page.locator('#va3d-canvas').count()) === 0, 'the 3D canvas is removed while blackjack runs');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/floor3d-04-blackjack.png` });

// back (the same path as Android Back) returns to the floor at the seat's standing spot
await page.evaluate(() => globalThis.__scene().events.emit('back'));
ok(await until(() => page.evaluate(() => !!globalThis.__floor3d), 15000), 'Back from blackjack returns to the 3D floor');
await page.waitForTimeout(800);
const s2 = await st();
ok(Math.hypot(s2.pos.x - -1.15, s2.pos.z - -0.84) < 0.1, `returns standing at the seat (${s2.pos.x.toFixed(2)}, ${s2.pos.z.toFixed(2)})`);
ok(s2.mode === 'overview', 'the camera choice is kept');
await page.screenshot({ path: `${out}/floor3d-05-returned.png` });

// back to the follow view, try the joystick
await page.locator('#va3d-hud .cam').tap();
await page.waitForTimeout(700);
const box = await page.locator('#va3d-hud .joy').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
const cdp = await page.context().newCDPSession(page);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
// hold the stick up, then right: it walks away from the camera, then to its right
for (const [name, dx, dy, along] of [['up', 0, -50, 'forward'], ['right', 50, 0, 'right']]) {
  const b = await st();
  await touch('touchStart', cx, cy);
  await touch('touchMove', cx + dx, cy + dy);
  await page.waitForTimeout(600);
  await touch('touchEnd');
  const a = await st();
  const mv = { x: a.pos.x - b.pos.x, z: a.pos.z - b.pos.z };
  const fl = Math.hypot(b.cam.target.x - b.cam.pos.x, b.cam.target.z - b.cam.pos.z);
  const f = { x: (b.cam.target.x - b.cam.pos.x) / fl, z: (b.cam.target.z - b.cam.pos.z) / fl };
  const comp = along === 'forward' ? mv.x * f.x + mv.z * f.z : mv.x * -f.z + mv.z * f.x;
  ok(comp > 0.5 && comp > 0.9 * Math.hypot(mv.x, mv.z), `the joystick pushed ${name} walks ${along} relative to the camera (${comp.toFixed(2)} m)`);
}
await page.screenshot({ path: `${out}/floor3d-06-follow-joystick.png` });

// turned sideways (the phone build rotates the floor; here the viewport stands in for it)
await page.setViewportSize({ width: 832, height: 384 });
await page.waitForTimeout(600);
const land = await st();
ok(land.cam.fov === 50 && (await page.locator('#va3d-canvas').boundingBox()).width === 832, 'landscape: the floor fills the wide screen with a narrower follow view');
const rot = await page.locator('#va3d-hud .rotate').boundingBox();
ok(rot && rot.height >= 48 && rot.y >= 0 && rot.y + rot.height <= 384, 'landscape: the HUD buttons stay on screen at 48 dp');
await page.screenshot({ path: `${out}/floor3d-07-landscape.png` });

const stats = await page.evaluate(() => globalThis.__floor3d.stats());
console.log('stats', JSON.stringify(stats));
ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
