/**
 * Original Velvet Ace far-cabinet screen artwork. Opt-in texture generator.
 * Three.js CanvasTexture only; no external images, network, or game state.
 * Intended to replace flat colour blocks at 12m+ LOD, not hero reel art.
 */
export function createFarCabinetScreenTexture(THREE, options = {}) {
  const width = 256, height = 512;
  const canvas = options.canvas ?? (typeof document !== 'undefined'
    ? document.createElement('canvas') : null);
  if (!canvas) throw new Error('Provide a canvas when rendering outside a browser');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context required');
  const accent = options.accent ?? '#d9a55c';
  const title = String(options.title ?? 'VELVET ACE').slice(0, 22);
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#080d1b'); bg.addColorStop(.5, '#15233a');
  bg.addColorStop(1, '#05070e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  // Subtle diagonal woven backdrop; drawn once and reused as a texture.
  ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
  for (let x = -height; x < width + height; x += 16) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + height, height); ctx.stroke();
  }
  ctx.fillStyle = accent; ctx.fillRect(18, 20, width - 36, 3);
  ctx.textAlign = 'center'; ctx.fillStyle = '#f7e9ca';
  ctx.font = 'bold 23px sans-serif'; ctx.fillText(title, width / 2, 67);
  ctx.font = '12px sans-serif'; ctx.fillStyle = accent;
  ctx.fillText('FIVE REELS  •  FIVE ROWS', width / 2, 89);
  // Readable miniature 5×5 reel windows; stylized original symbols, not gameplay.
  const glyphs = ['◆', '7', '★', '♣', '♦', '✦', '♥'];
  const left = 18, top = 125, gap = 3, cellW = 42, cellH = 49;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
    const x = left + col * (cellW + gap), y = top + row * (cellH + gap);
    const shade = ctx.createLinearGradient(x, y, x, y + cellH);
    shade.addColorStop(0, '#25344b'); shade.addColorStop(.5, '#0a1425');
    shade.addColorStop(1, '#1b293f');
    ctx.fillStyle = shade; ctx.fillRect(x, y, cellW, cellH);
    ctx.strokeStyle = 'rgba(221,192,127,.45)';
    ctx.strokeRect(x + .5, y + .5, cellW - 1, cellH - 1);
    ctx.fillStyle = (row + col) % 3 === 0 ? accent : '#e9d7b0';
    ctx.font = 'bold 25px sans-serif';
    ctx.fillText(glyphs[(row * 3 + col * 5) % glyphs.length], x + cellW / 2, y + 33);
  }
  const footer = ctx.createLinearGradient(0, 406, 0, height);
  footer.addColorStop(0, 'rgba(12,23,39,0)'); footer.addColorStop(1, '#050811');
  ctx.fillStyle = footer; ctx.fillRect(0, 406, width, 106);
  ctx.fillStyle = accent; ctx.fillRect(18, 429, width - 36, 2);
  ctx.fillStyle = '#f3e2bc'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText('GOOD LUCK', width / 2, 461);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = Math.min(4, options.maxAnisotropy ?? 4);
  texture.needsUpdate = true;
  texture.userData = { artOnly: true, original: true, lod: 'far', size: [width, height] };
  return texture;
}
