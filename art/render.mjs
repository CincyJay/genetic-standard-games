/** Renders art/out/*.svg to PNG (for review and for game builds). Usage: node art/render.mjs [scale] */
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const dir = new URL('./out/', import.meta.url).pathname;
const scale = Number(process.argv[2] ?? 1);
const b = await chromium.launch();
const p = await b.newPage({ deviceScaleFactor: scale });
for (const f of readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
  const svg = readFileSync(dir + f, 'utf8');
  const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  await p.setViewportSize({ width: Number(w), height: Number(h) });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await p.screenshot({ path: dir + f.replace('.svg', '.png'), omitBackground: true });
}
await b.close();
console.log('rendered');
