/**
 * Renders the Android launcher icons and splash screens for Velvet Ace Casino.
 * Usage: node art/casino/android-icons.mjs   (after `npx cap add android`)
 */
import { readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const res = new URL('../../games/casino/android/app/src/main/res/', import.meta.url).pathname;

const SPADE = 'M50,0 C80,26 100,44 100,62 C100,78 88,88 74,88 C64,88 56,84 53,78 C55,88 60,95 66,100 L34,100 C40,95 45,88 47,78 C44,84 36,88 26,88 C12,88 0,78 0,62 C0,44 20,26 50,0 Z';
const card = (s) => `
  <g transform="translate(512 512) rotate(-8) scale(${s}) translate(-200 -280)">
    <rect x="6" y="14" width="400" height="560" rx="36" fill="#000" opacity="0.35"/>
    <rect x="0" y="0" width="400" height="560" rx="36" fill="#fffdf8" stroke="#e9c86a" stroke-width="14"/>
    <text x="52" y="104" font-family="Georgia, serif" font-weight="700" font-size="88" fill="#1d1d22" text-anchor="middle">A</text>
    <path d="${SPADE}" fill="#1d1d22" transform="translate(110 170) scale(1.8)"/>
    <circle cx="200" cy="290" r="150" fill="none" stroke="#e9c86a" stroke-width="8"/>
  </g>`;
const bg = `<defs><radialGradient id="v" cx="0.5" cy="0.35" r="0.8"><stop offset="0" stop-color="#6a2a80"/><stop offset="1" stop-color="#1a0f24"/></radialGradient></defs>`;
const full = (round) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${bg}
  ${round ? '<circle cx="512" cy="512" r="512" fill="url(#v)"/>' : '<rect width="1024" height="1024" rx="200" fill="url(#v)"/>'}${card(1.15)}</svg>`;
// adaptive foreground: content must sit inside the central 66/108 safe zone
const fg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${card(0.95)}</svg>`;
const splash = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs><radialGradient id="v" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stop-color="#5a1f6e"/><stop offset="1" stop-color="#14071f"/></radialGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#v)"/>
  <g transform="translate(${w / 2 - 512 * (Math.min(w, h) / 2400)} ${h / 2 - 620 * (Math.min(w, h) / 2400)}) scale(${Math.min(w, h) / 2400})">${card(1)}</g>
  <text x="${w / 2}" y="${h / 2 + Math.min(w, h) * 0.3}" font-family="Georgia, serif" font-weight="700" font-size="${Math.min(w, h) * 0.09}" fill="#e9c86a" text-anchor="middle">Velvet Ace</text></svg>`;

const ICON = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const b = await chromium.launch();
const p = await b.newPage();
async function render(svg, w, h, path, transparent = false) {
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<body style="margin:0;background:transparent"><div style="width:${w}px;height:${h}px">${svg.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`)}</div></body>`);
  await p.screenshot({ path, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
}
for (const [d, px] of Object.entries(ICON)) {
  await render(full(false), px, px, `${res}mipmap-${d}/ic_launcher.png`, true);
  await render(full(true), px, px, `${res}mipmap-${d}/ic_launcher_round.png`, true);
  const fpx = Math.round((px * 108) / 48);
  await render(fg, fpx, fpx, `${res}mipmap-${d}/ic_launcher_foreground.png`, true);
}
// splash screens: same sizes as Capacitor generated
const sizeOf = async (path) => p.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode(); return [img.naturalWidth, img.naturalHeight];
}, 'data:image/png;base64,' + (await import('node:fs')).readFileSync(path).toString('base64'));
const dirs = readdirSync(res).filter((d) => d.startsWith('drawable'));
for (const d of dirs) {
  const f = `${res}${d}/splash.png`;
  if (!existsSync(f)) continue;
  const [w, h] = await sizeOf(f);
  await render(splash(w, h), w, h, f);
}
await b.close();
console.log('icons and splash screens rendered');
