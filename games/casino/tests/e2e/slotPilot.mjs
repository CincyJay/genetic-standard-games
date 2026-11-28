/**
 * Captures the isolated premium slot pilot (VA-0076) from front, three-quarter, side and seated
 * views at a phone viewport. Review captures, plus a console-error check; not a visual verdict.
 * Usage: node tests/e2e/slotPilot.mjs [baseUrl] [outDir]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] ?? 'http://localhost:5175/';
const out = process.argv[3] ?? fileURLToPath(new URL('../../screenshots/', import.meta.url));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = false;
for (const [i, view] of ['front', 'three', 'side', 'seated'].entries()) {
  const page = await browser.newPage({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}slot-pilot.html?view=${view}`);
  await page.waitForFunction(() => globalThis.__slotPilot?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/slot-pilot-0${i + 1}-${view}.png`, timeout: 60000 });
  const info = await page.evaluate(() => globalThis.__slotPilot);
  console.log(view, JSON.stringify({ stats: info.stats, rects: info.rects }));
  if (errors.length) { failed = true; console.log('FAIL console errors:', errors); } else console.log('ok   no console errors:', view);
  await page.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
