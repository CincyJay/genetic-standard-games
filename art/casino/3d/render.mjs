/**
 * Renders the 3D casino art (slot symbols for now) with three.js in headless
 * Chromium and writes PNGs into games/casino/public/art/.
 * Usage: node art/casino/3d/render.mjs [set ...]
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = new URL('../../../', import.meta.url).pathname;
const pub = join(root, 'games/casino/public/art');
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html' };
const server = createServer(async (req, res) => {
  try {
    const p = join(root, decodeURIComponent(req.url.split('?')[0]));
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0);
const port = server.address().port;

const sets = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[page error]', e.message));
await page.goto(`http://localhost:${port}/art/casino/3d/page.html`);
await page.waitForFunction(() => globalThis.ready === true, null, { timeout: 60000 });
const ROOM_IDS = ['lobby', 'slots', 'poker', 'tables'];
const symSets = sets.filter((x) => !['logos', 'rooms', 'ui'].includes(x));
const out = sets.length && !symSets.length ? {} : await page.evaluate(async (sets) => globalThis.renderSymbols(sets), symSets);
for (const [set, syms] of Object.entries(out)) {
  await mkdir(join(pub, 'slots', set), { recursive: true });
  for (const [name, url] of Object.entries(syms)) {
    await writeFile(join(pub, 'slots', set, `${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log(`${set}: ${Object.keys(syms).length} symbols`);
}
if (!sets.length || sets.includes('ui')) {
  const ui = await page.evaluate(() => globalThis.renderUi());
  await mkdir(join(pub, 'ui'), { recursive: true });
  for (const [id, url] of Object.entries(ui)) await writeFile(join(pub, 'ui', `${id}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log(`ui: ${Object.keys(ui).length}`);
}
if (!sets.length || sets.includes('rooms')) {
  for (const id of ROOM_IDS) {
    const url = await page.evaluate((id) => globalThis.renderRoom(id), id);
    await writeFile(join(pub, `room-${id}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(`room ${id}`);
  }
}
if (!sets.length || sets.includes('logos')) {
  const logos = await page.evaluate(() => globalThis.renderLogos());
  await mkdir(join(pub, 'logos'), { recursive: true });
  for (const [id, url] of Object.entries(logos)) await writeFile(join(pub, 'logos', `${id}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log(`logos: ${Object.keys(logos).length}`);
}
await browser.close();
server.close();
