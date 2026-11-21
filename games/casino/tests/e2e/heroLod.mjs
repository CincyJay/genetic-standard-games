/**
 * Grand-hall hero LOD (VA-0305): pins the camera far from and near the end-wall heroes and checks
 * that stats().heroLod switches between 'lite' and 'full', with the draw calls and triangles each
 * way, and `?herolod=off` for comparison. Fresh browser profile (no real save), `?floor3d` (no
 * Firebase sign-in). SwiftShader, not a phone: captures are for review only.
 * Usage: node tests/e2e/heroLod.mjs [url] [outDir]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] ?? 'http://localhost:5175/';
const out = process.argv[3] ?? fileURLToPath(new URL('../../screenshots/', import.meta.url));
mkdirSync(out, { recursive: true });
// heroes stand at z -17.33, x -5.85..5.85, facing +Z
const views = {
  far: { pos: { x: 0, y: 1.7, z: 6 }, target: { x: 0, y: 1.6, z: -17 }, fov: 50, want: 'lite' },
  near: { pos: { x: -1.3, y: 1.6, z: -13.5 }, target: { x: -1.3, y: 1.5, z: -17.3 }, fov: 50, want: 'full' },
};
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = false;
for (const [tag, q] of [['lod', ''], ['off', '&herolod=off']]) {
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
    await page.screenshot({ path: `${out}/herolod-${tag}-${view}.png`, timeout: 90000 });
    const want = tag === 'off' ? null : v.want;
    const ok = st.heroLod === want;
    if (!ok) failed = true;
    console.log(`${ok ? 'ok' : 'FAIL'} ${tag} ${view}: heroLod ${st.heroLod} (want ${want}) drawCalls ${st.drawCalls} triangles ${st.triangles}`);
  }
  console.log(`${tag}: console errors ${errors.length}`);
  if (errors.length) {
    failed = true;
    for (const e of errors.slice(0, 5)) console.log('  error:', e);
  }
  await page.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
