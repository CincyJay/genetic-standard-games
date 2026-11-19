/**
 * Repeatable close-ups of one grand-hall blackjack chair (VA-0190), so chair revisions are compared
 * from the same camera instead of wherever the avatar happens to stand. Uses debug.pinCamera, a
 * fresh browser profile (no real save) and `?floor3d` (no Firebase sign-in). Captures for review
 * only: SwiftShader, not a phone.
 * Usage: node tests/e2e/chairCloseup.mjs [url] [outDir] [tag]
 * Writes <outDir>/<tag>-<chair>-<view>.png for chair = luxury, lod, lod-near, swivel and view = rear, side, front.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] ?? 'http://localhost:5175/';
const out = process.argv[3] ?? fileURLToPath(new URL('../../screenshots/', import.meta.url));
const tag = process.argv[4] ?? 'chair';
mkdirSync(out, { recursive: true });
const CHAIR = 'blackjack_1_chair';
const styles = [['luxury', ''], ['lod', '&chair=lod'], ['lod-near', '&chair=lod-near'], ['swivel', '&chair=swivel', '+Z']];
// eye offsets in the chair's frame: f = toward the table (its front), r = its right, y = height
const views = { rear: { f: -1.25, r: 0.55, y: 1.35 }, side: { f: -0.35, r: 1.7, y: 1.3 }, front: { f: 0.35, r: -1.25, y: 1.35 } };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = false;
for (const [style, q, front = '-Z'] of styles) {
  const page = await browser.newPage({ viewport: { width: 1152, height: 768 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('va3d.hall', 'grand');
    localStorage.setItem('va3d.ceiling', 'gold-coffers');
    localStorage.setItem('va3d.light', 'warm');
  });
  await page.goto(`${base}?floor3d${q}`);
  await page.waitForFunction(() => window.__floor3d?.debug, null, { timeout: 120000 });
  const pose = await page.evaluate((n) => window.__floor3d.debug.objectPose(n), CHAIR);
  if (!pose) throw new Error(`no ${CHAIR}`);
  // the luxury and LOD chairs' fronts are their local -Z (userData.forward / front), so the front is
  // yaw + pi; the swivel chair (31b9eb8) faces +Z, so its front is yaw itself
  const s = front === '+Z' ? 1 : -1;
  const fwd = { x: s * Math.sin(pose.yaw), z: s * Math.cos(pose.yaw) };
  const right = { x: -fwd.z, z: fwd.x };
  for (const [view, o] of Object.entries(views)) {
    const pin = {
      pos: { x: pose.x + fwd.x * o.f + right.x * o.r, y: o.y, z: pose.z + fwd.z * o.f + right.z * o.r },
      target: { x: pose.x, y: 0.85, z: pose.z },
      fov: 40,
    };
    await page.evaluate((p) => window.__floor3d.debug.pinCamera(p), pin);
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => window.__floor3d.stats());
    await page.screenshot({ path: `${out}/${tag}-${style}-${view}.png`, timeout: 90000 });
    console.log(`${style} ${view}: drawCalls ${st.drawCalls} triangles ${st.triangles}`);
  }
  console.log(`${style}: chair at (${pose.x.toFixed(3)}, ${pose.z.toFixed(3)}) yaw ${pose.yaw.toFixed(3)}; console errors ${errors.length}`);
  if (errors.length) {
    failed = true;
    for (const e of errors.slice(0, 5)) console.log('  error:', e);
  }
  await page.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
