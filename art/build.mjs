/** Renders the full-screen backdrops to JPEG for the game. Usage: node art/build.mjs */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = new URL('./', import.meta.url).pathname;
const pub = new URL('../games/seed-sort/public/art/', import.meta.url).pathname;
const jobs = [
  ['out/greenhouse.svg', 'bg-greenhouse.jpg'],
  ['out/entrance-restored.svg', 'bg-garden.jpg'],
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
for (const [src, dst] of jobs) {
  await p.setContent(`<body style="margin:0">${readFileSync(here + src, 'utf8')}</body>`);
  await p.screenshot({ path: pub + dst, type: 'jpeg', quality: 85 });
}
await b.close();
console.log('built', jobs.length, 'backdrops');
