/**
 * Captures of the grand hall's Svelte machines as back-to-back islands (VA-0197), with
 * `?islands=off` (the old wall banks) for comparison. Pinned cameras (debug.pinCamera), a fresh
 * browser profile (no real save) and `?floor3d` (no Firebase sign-in). Captures for review only:
 * SwiftShader, not a phone.
 * `slimcab` swaps the near cabinets for ChatGPT's slim shell (`?nearcab=slim`, VA-0216).
 * `slimlod` draws the slim family at every distance (`?slimlod=on`: near shell + 4530e71 mid/far, VA-0226).
 * `slimbulbs` / `bulbs` add ChatGPT's 8-tri far chase bulb on caps >= 15 m away (`?capbulbs=lod`, f61fe6e, VA-0232).
 * `carpetart` puts ChatGPT's woven medallion carpet texture on the hall floor (`?carpetart=on`, 436ef01, VA-0234).
 * `carpetvine` puts the woven-vine overlay version on it instead (`?carpetart=vine`, ca3a8ec, VA-0236).
 * `carpetdamask2` puts the interlaced damask (no medallion grid) on it (`?carpetart=damask2`, 5c65389, VA-0238).
 * `topper` adds ChatGPT's island seam topper (`?topper=on`, VA-0201).
 * Usage: node tests/e2e/islands.mjs [url] [outDir] [tag] [machineStyle] [variants, default islands,walls]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] ?? 'http://localhost:5175/';
const out = process.argv[3] ?? fileURLToPath(new URL('../../screenshots/', import.meta.url));
const tag = process.argv[4] ?? 'islands';
const style = process.argv[5] ?? 'svelte-lod';
const VARIANTS = { islands: '', walls: '&islands=off', topper: '&topper=on', artstool: '&farstool=art', slimcab: '&nearcab=slim', slimlod: '&slimlod=on', slimbulbs: '&slimlod=on&capbulbs=lod', bulbs: '&capbulbs=lod', carpetart: '&carpetart=on', carpetvine: '&carpetart=vine', carpetdamask2: '&carpetart=damask2' };
const variants = (process.argv[6] ?? 'islands,walls').split(',').map((v) => [v, VARIANTS[v]]);
mkdirSync(out, { recursive: true });
// the west islands: centre line x -8.6, back third z -15..-6.6
const views = {
  overview: { pos: { x: -2.5, y: 4.6, z: -1 }, target: { x: -8.6, y: 0.4, z: -11 }, fov: 60 },
  'aisle-side': { pos: { x: -5.6, y: 1.7, z: -4.6 }, target: { x: -8.2, y: 1.0, z: -11 }, fov: 50 },
  'wall-walkway': { pos: { x: -10.9, y: 1.7, z: -4.4 }, target: { x: -9.4, y: 1.0, z: -12 }, fov: 50 },
  'island-end': { pos: { x: -8.6, y: 1.6, z: -3.6 }, target: { x: -8.6, y: 1.0, z: -8 }, fov: 50 },
  // looking down onto the back island's shared backs and its near double cap (VA-0201)
  // the east face of the west island at stool distance, where the near cabinets draw (VA-0216)
  'cabinet-close': { pos: { x: -6.4, y: 1.45, z: -8.0 }, target: { x: -8.3, y: 1.25, z: -8.6 }, fov: 50 },
  'seam-high': { pos: { x: -7.4, y: 3.3, z: -4.6 }, target: { x: -8.6, y: 2.0, z: -8.5 }, fov: 50 },
};
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = false;
for (const [variant, q] of variants) {
  const page = await browser.newPage({ viewport: { width: 1152, height: 768 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((s) => {
    localStorage.setItem('va3d.hall', 'grand');
    localStorage.setItem('va3d.ceiling', 'gold-coffers');
    localStorage.setItem('va3d.light', 'warm');
    localStorage.setItem('va3d.machines', s);
  }, style);
  await page.goto(`${base}?floor3d${q}`);
  await page.waitForFunction(() => window.__floor3d?.debug, null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  let st = await page.evaluate(() => window.__floor3d.stats());
  console.log(`${variant} follow: drawCalls ${st.drawCalls} triangles ${st.triangles}; svelte ${JSON.stringify(st.svelteMachines)}`);
  await page.screenshot({ path: `${out}/${tag}-${variant}-follow.png`, timeout: 90000 });
  for (const [view, pin] of Object.entries(views)) {
    await page.evaluate((p) => window.__floor3d.debug.pinCamera(p), pin);
    await page.waitForTimeout(1500);
    st = await page.evaluate(() => window.__floor3d.stats());
    await page.screenshot({ path: `${out}/${tag}-${variant}-${view}.png`, timeout: 90000 });
    console.log(`${variant} ${view}: drawCalls ${st.drawCalls} triangles ${st.triangles}`);
  }
  console.log(`${variant}: console errors ${errors.length}`);
  if (errors.length) {
    failed = true;
    for (const e of errors.slice(0, 5)) console.log('  error:', e);
  }
  await page.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
