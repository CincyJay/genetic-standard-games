import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const sp = process.argv[2];
const ids = (process.argv[3] ?? 'sevens').split(',');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 432, height: 768 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://localhost:5174/');
await page.waitForFunction(() => globalThis.__lobby, null, { timeout: 60000 });
await page.waitForTimeout(1000);
for (const id of ids) {
  await page.evaluate((id) => globalThis.__go('slots', { machine: id }), id);
  await page.waitForTimeout(2500);
  const p = await page.evaluate(() => globalThis.__slots.spinXY);
  const box = await page.locator('canvas').boundingBox();
  const vw = await page.evaluate(() => globalThis.__view);
  await page.mouse.click(box.x + (p.x * box.width) / vw.W, box.y + ((p.y - vw.top0 ?? 0) * box.height) / vw.H).catch(() => {});
  await page.evaluate(() => globalThis.__scene().spin?.());
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${sp}/s5-${id}-spin.png` });
  await page.waitForFunction(() => !globalThis.__slots.spinning(), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${sp}/s5-${id}.png` });
}
console.log('errors', errs);
await b.close();
