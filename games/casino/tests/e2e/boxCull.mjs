/**
 * Grand-hall box culling (VA-0316): the south copies batch apart from the hero LOD sets, and
 * world.ts skips any of those batches whose world box is out of view. Pins the camera in a few
 * views and checks stats().boxCull, with draw calls and triangles, against `?herolod=off` (no
 * hero LOD, so nothing box-culled) for comparison; then the follow camera and the overview
 * unpinned. When both ends are in view the combined lite set draws instead (liteAll), so that
 * view costs no more draw calls than before the split.
 * Fresh browser profile (no real save), `?floor3d` (no Firebase sign-in).
 * SwiftShader, not a phone: numbers and captures are for review only.
 * Usage: node tests/e2e/boxCull.mjs [url] [outDir]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] ?? 'http://localhost:5175/';
const out = process.argv[3] ?? fileURLToPath(new URL('../../screenshots/', import.meta.url));
mkdirSync(out, { recursive: true });
// south copies: z 7.3..14.9; hero sets (heroes + north copies): z -17.8..-6.8
const views = {
  // from mid-hall looking at the heroes: the south copies are behind the camera
  midNorth: { pos: { x: 0, y: 1.7, z: 6 }, target: { x: 0, y: 1.6, z: -17 }, fov: 50, liteAll: false, culls: true },
  // from the entrance looking in: everything ahead, nothing to cull
  entranceNorth: { pos: { x: 0, y: 1.7, z: 15.5 }, target: { x: 0, y: 1.6, z: -17 }, fov: 50, liteAll: true, culls: false },
  // from the north end looking back to the entrance: the heroes and north copies are behind
  northSouth: { pos: { x: 0, y: 1.7, z: -5 }, target: { x: 0, y: 1.6, z: 15 }, fov: 50, liteAll: false, culls: true },
  // near the heroes facing them (heroLod full): the south copies are behind
  nearHero: { pos: { x: -1.3, y: 1.6, z: -13.5 }, target: { x: -1.3, y: 1.5, z: -17.3 }, fov: 50, liteAll: false, culls: true },
};
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = false;
for (const [tag, q] of [['cull', ''], ['off', '&herolod=off']]) {
  const page = await browser.newPage({ viewport: { width: 1152, height: 768 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('va3d.hall', 'grand');
    localStorage.setItem('va3d.ceiling', 'gold-coffers');
  });
  await page.goto(`${base}?floor3d${q}`);
  await page.waitForFunction(() => window.__floor3d?.debug, null, { timeout: 120000 });
  for (const [view, v] of Object.entries(views)) {
    await page.evaluate((p) => window.__floor3d.debug.pinCamera(p), { pos: v.pos, target: v.target, fov: v.fov });
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => window.__floor3d.stats());
    await page.screenshot({ path: `${out}/boxcull-${tag}-${view}.png`, timeout: 90000 });
    const ok = tag === 'off' ? st.boxCull.of === 0 : st.boxCull.of > 0 && st.boxCull.liteAll === v.liteAll && (st.boxCull.culled > 0) === v.culls;
    if (!ok) failed = true;
    console.log(`${ok ? 'ok' : 'FAIL'} ${tag} ${view}: boxCull ${st.boxCull.culled}/${st.boxCull.of} liteAll ${st.boxCull.liteAll} heroLod ${st.heroLod} drawCalls ${st.drawCalls} triangles ${st.triangles}`);
  }
  await page.evaluate(() => window.__floor3d.debug.pinCamera(null));
  await page.waitForTimeout(1500);
  let st = await page.evaluate(() => window.__floor3d.stats());
  console.log(`info ${tag} follow (spawn): boxCull ${st.boxCull.culled}/${st.boxCull.of} liteAll ${st.boxCull.liteAll} heroLod ${st.heroLod} drawCalls ${st.drawCalls} triangles ${st.triangles}`);
  await page.locator('#va3d-hud .cam').click();
  await page.waitForFunction(() => window.__floor3d.debug.state().mode === 'overview' && !window.__floor3d.debug.state().transitioning, null, { timeout: 10000 });
  await page.waitForTimeout(1500);
  st = await page.evaluate(() => window.__floor3d.stats());
  await page.screenshot({ path: `${out}/boxcull-${tag}-overview.png`, timeout: 90000 });
  console.log(`info ${tag} overview: boxCull ${st.boxCull.culled}/${st.boxCull.of} liteAll ${st.boxCull.liteAll} heroLod ${st.heroLod} drawCalls ${st.drawCalls} triangles ${st.triangles}`);
  console.log(`${tag}: console errors ${errors.length}`);
  if (errors.length) {
    failed = true;
    for (const e of errors.slice(0, 5)) console.log('  error:', e);
  }
  await page.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
