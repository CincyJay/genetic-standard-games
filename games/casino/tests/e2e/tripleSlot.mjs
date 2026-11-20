/**
 * Captures the isolated triple-screen cabinet study (VA-0256) from front, three-quarter, side and seated
 * views at a phone viewport. Review captures, plus a console-error check; not a visual verdict.
 * Usage: node tests/e2e/tripleSlot.mjs [baseUrl] [outDir]
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
  await page.goto(`${base}triple-slot.html?view=${view}`);
  await page.waitForFunction(() => globalThis.__tripleSlot?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/triple-slot-0${i + 1}-${view}.png`, timeout: 60000 });
  const info = await page.evaluate(() => globalThis.__tripleSlot);
  console.log(view, JSON.stringify({ machine: info.machine, error: info.error, stats: info.stats, rects: info.rects }));
  if (info.error) failed = true;
  if (errors.length) { failed = true; console.log('FAIL console errors:', errors); } else console.log('ok   no console errors:', view);
  await page.close();
}
// live jackpot (dev): bonus screen repaints the rolling GRAND at most ~4 Hz while the loop runs
{
  const page = await browser.newPage({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}triple-slot.html?view=front&machine=empire&jackpot=live`);
  await page.waitForFunction(() => globalThis.__tripleSlot?.ready, null, { timeout: 60000 });
  const a = await page.evaluate(() => ({ ...globalThis.__tripleSlot.live, t: performance.now() }));
  await page.waitForTimeout(3000);
  const b = await page.evaluate(() => ({ ...globalThis.__tripleSlot.live, t: performance.now() }));
  await page.screenshot({ path: `${out}/triple-slot-05-live-jackpot.png`, timeout: 60000 });
  const secs = (b.t - a.t) / 1000;
  const repaints = b.repaints - a.repaints;
  console.log('live', JSON.stringify({ secs: +secs.toFixed(2), frames: b.frames - a.frames, repaints, grandFrom: a.grand, grandTo: b.grand }));
  if (!(b.grand > a.grand)) { failed = true; console.log('FAIL live GRAND did not climb'); } else console.log('ok   live GRAND climbs');
  if (!(repaints >= 1 && repaints <= Math.ceil(secs * 4) + 1)) { failed = true; console.log('FAIL live repaint rate', repaints); } else console.log('ok   live repaints throttled:', repaints);
  if (errors.length) { failed = true; console.log('FAIL console errors:', errors); } else console.log('ok   no console errors: live');
  await page.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
