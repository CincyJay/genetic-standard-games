/** Renders casino backdrops to JPEG. Usage: python3 art/casino/backgrounds.py && node art/casino/build.mjs */
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = new URL('./out/', import.meta.url).pathname;
const pub = new URL('../../games/casino/public/art/', import.meta.url).pathname;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
for (const f of readdirSync(out).filter((f) => f.endsWith('.svg'))) {
  await p.setContent(`<body style="margin:0">${readFileSync(out + f, 'utf8')}</body>`);
  await p.screenshot({ path: pub + f.replace('.svg', '.jpg'), type: 'jpeg', quality: 84 });
}
await b.close();
console.log('rendered backdrops');
