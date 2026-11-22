/**
 * What the triangles in a pinned grand-hall view are made of (VA-0374). With `?drawsrc=on` each
 * art batch records its triangles per source mesh; this pins the camera, reads debug.drawList()
 * (the batches in view) and prints the totals per batch set (static, lod:far, lod:south, ...) and
 * the heaviest source meshes. Fresh browser profile (no real save), `?floor3d` (no Firebase
 * sign-in). SwiftShader, not a phone: the numbers are the scene's, the frame rate is not.
 * Usage: node tests/e2e/drawSources.mjs [url] [extra query, e.g. '&copyfar=on'] [view]
 * Views: spawn (default), overview, lookback.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] ?? 'http://localhost:5175/';
const extra = process.argv[3] ?? '&herofar=theme&southfar=on';
const views = {
  // the player spawns at z 14.5 facing the end-wall heroes (z -17.3)
  spawn: { pos: { x: 0, y: 4.6, z: 14.5 }, target: { x: 0, y: 1.6, z: -17 }, fov: 50 },
  overview: { pos: { x: 0, y: 4.6, z: 6 }, target: { x: 0, y: 1.6, z: -17 }, fov: 50 },
  lookback: { pos: { x: 0, y: 1.7, z: -12 }, target: { x: 0, y: 1.5, z: 14 }, fov: 50 },
};
const view = views[process.argv[4] ?? 'spawn'];
if (!view) throw new Error(`unknown view; one of ${Object.keys(views).join(', ')}`);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1152, height: 768 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem('va3d.hall', 'grand');
  localStorage.setItem('va3d.ceiling', 'gold-coffers');
});
await page.goto(`${base}?floor3d&drawsrc=on${extra}`);
await page.waitForFunction(() => window.__floor3d?.debug, null, { timeout: 180000 });
await page.evaluate((v) => window.__floor3d.debug.pinCamera(v), view);
await page.waitForTimeout(2500);
const st = await page.evaluate(() => window.__floor3d.stats());
const list = await page.evaluate(() => window.__floor3d.debug.drawList());
const sets = {};
const sources = {};
let missing = 0;
for (const d of list) {
  // art:lod:far:H#... -> lod:far; art:#... -> static; art:fixtures#... -> fixtures; reels:sheet etc. -> its name
  const set = d.name.startsWith('art:') ? d.name.slice(4, d.name.indexOf('#')).replace(/:[HCWEB]$/, '') || 'static' : d.name.split('#')[0].replace(/^slot_[^/]+\//, 'slot_*/').replace(/:.*$/, '');
  const tris = d.tris * d.instances;
  sets[set] = (sets[set] ?? 0) + tris;
  if (!d.sources) {
    missing += tris;
    sources[`${set} ${set}`] = (sources[`${set} ${set}`] ?? 0) + tris;
    continue;
  }
  for (const [n, t] of Object.entries(d.sources)) sources[`${set} ${n}`] = (sources[`${set} ${n}`] ?? 0) + t * d.instances;
}
const total = Object.values(sets).reduce((a, b) => a + b, 0);
console.log(`view ${process.argv[4] ?? 'spawn'} query '${extra}': drawCalls ${st.drawCalls} triangles ${st.triangles} (renderer); ${list.length} meshes in view, ${Math.round(total)} tris by drawList (${Math.round(missing)} without a breakdown); heroLod ${st.heroLod}`);
console.log('per set:');
for (const [k, v] of Object.entries(sets).sort((a, b) => b[1] - a[1])) console.log(`  ${String(Math.round(v)).padStart(8)}  ${k}`);
console.log('heaviest sources (set, source mesh):');
for (const [k, v] of Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(Math.round(v)).padStart(8)}  ${k}`);
console.log(`console errors ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log('  error:', e);
await browser.close();
process.exitCode = errors.length ? 1 : 0;
