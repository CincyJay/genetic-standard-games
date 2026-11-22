/**
 * Velvet Ace original far-LOD cabinet artwork, revision 5.
 * One 256x512 atlas, three independently UV-mapped bands; preserve the 256x512 mipmapped atlas.
 * Standalone art only. Caller owns material, UV mapping and disposal.
 */
export const FAR_CABINET_ATLAS_BANDS = Object.freeze({
  top: [0, 160], middle: [168, 376], lower: [384, 512]
});
export function createFarCabinetThreeScreenTexture(THREE, options = {}) {
  const canvas = options.canvas ?? (typeof document !== 'undefined' ? document.createElement('canvas') : null);
  if (!canvas) throw new Error('Canvas required');
  const width = 256, height = 512;
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context required');
  const accent = options.accent ?? '#d9a55c';
  const title = String(options.title ?? 'VELVET ACE').slice(0, 18);
  const subtitle = String(options.subtitle ?? 'FIVE BY FIVE').slice(0, 24);
  const footer = String(options.footer ?? 'GOOD LUCK').slice(0, 24);
  ctx.fillStyle = '#080e1a'; ctx.fillRect(0, 0, width, height);
  function panel(y0, y1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#26354a'); g.addColorStop(0.5, '#0c1627'); g.addColorStop(1, '#060a12');
    ctx.fillStyle = g; ctx.fillRect(0, y0, width, y1-y0);
    ctx.strokeStyle = accent; ctx.lineWidth = 3;
    ctx.strokeRect(5, y0+5, width-10, y1-y0-10);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for (let x = -height; x < width+height; x += 19) {
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x+(y1-y0), y1); ctx.stroke();
    }
  }
  panel(0, 160); panel(168, 376); panel(384, 512);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8e5c0'; ctx.font = 'bold 25px sans-serif';
  ctx.fillText(title, 128, 68, 220);
  ctx.fillStyle = accent; ctx.font = 'bold 12px sans-serif';
  ctx.fillText(subtitle, 128, 125, 220);
  // Move the 5x5 grid toward the top of its band, leaving the lower portion
  // unobtrusive when the driven reel strip is overlaid by the host app.
  const glyphs = ['7', '◆', '★', '♣', '♥', '✦', '♦'];
  const left = 17, top = 177, w = 42, h = 31, gap = 4;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const x = left+c*(w+gap), y = top+r*(h+gap);
    ctx.fillStyle = (r+c)%2 ? '#142239' : '#22334c';
    ctx.fillRect(x,y,w,h);
    ctx.strokeStyle = 'rgba(226,196,140,0.6)';
    ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
    ctx.fillStyle = (r+c)%3===0 ? accent : '#f2dfba';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(glyphs[(r*3+c*5)%glyphs.length], x+w/2, y+h/2+1);
  }
  ctx.fillStyle = '#f8e5c0'; ctx.font = 'bold 23px sans-serif';
  ctx.fillText(footer, 128, 437, 225);
  ctx.fillStyle = accent; ctx.font = 'bold 12px sans-serif';
  ctx.fillText('VELVET ACE', 128, 477, 225);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = Math.min(4, Math.max(1, options.maxAnisotropy ?? 4));
  texture.needsUpdate = true;
  texture.userData = { artOnly: true, lod: 'far', size: [width,height], bands: FAR_CABINET_ATLAS_BANDS };
  return texture;
}
