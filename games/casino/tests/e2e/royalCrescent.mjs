/**
 * Captures the isolated Royal Crescent preview (VA-0083/VA-0084) with ChatGPT's finish adapter
 * (default) or as exported (`--finish=none`), front/three-quarter/side/seated at a phone viewport.
 * Review captures plus a console-error and adapter-ran check; not a visual verdict.
 * Usage: node tests/e2e/royalCrescent.mjs [baseUrl] [outDir] [theme] [finish]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] ?? 'http://localhost:5175/';
const out = process.argv[3] ?? fileURLToPath(new URL('../../screenshots/', import.meta.url));
const theme = process.argv[4] ?? 'royal';
const finish = process.argv[5] ?? 'v2';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = false;
for (const [i, view] of ['front', 'three', 'side', 'seat'].entries()) {
  const page = await browser.newPage({ viewport: { width: 832, height: 384 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}royal-crescent.html?view=${view}&theme=${theme}&finish=${finish}`);
  await page.waitForFunction(() => globalThis.__royal?.ready || globalThis.__royal?.error, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/royal-${finish}-${theme}-0${i + 1}-${view}.png`, timeout: 90000 });
  const info = await page.evaluate(() => ({ error: globalThis.__royal.error, report: globalThis.__royal.report() }));
  if (i === 0) console.log(JSON.stringify(info.report, null, 1));
  if (info.error) { failed = true; console.log('FAIL', info.error); }
  if (finish === 'v2' && info.report?.finish?.screens !== 2) { failed = true; console.log('FAIL finish screens', info.report?.finish); }
  if (errors.length) { failed = true; console.log('FAIL console errors:', errors); } else console.log('ok   no console errors:', view);
  await page.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
