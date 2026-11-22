/**
 * Velvet Ace original casino carpet art, isolated prototype.
 * Seamless 512px repeat tile: midnight-plum woven ground, interlocking gold
 * lozenges, burgundy rosettes and low-contrast fibres. No external assets.
 * Apply to an existing floor mesh only in a dev preview; never changes production.
 */
export function createVelvetCasinoCarpetTexture(THREE, options = {}) {
  const canvas = options.canvas ?? (typeof document !== 'undefined' ? document.createElement('canvas') : null);
  if (!canvas) throw new Error('A canvas or browser document is required');
  const size = 512;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context required');
  ctx.fillStyle = '#241522'; ctx.fillRect(0, 0, size, size);
  // Seeded noise gives deterministic fibres without a visible tile-edge seam.
  let seed = 0x5eeda11;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 12500; i++) {
    const x = rand() * size, y = rand() * size;
    ctx.fillStyle = rand() > 0.54 ? 'rgba(198,145,153,0.065)' : 'rgba(7,7,20,0.11)';
    ctx.fillRect(x, y, 1, 1 + rand() * 3);
  }
  // All motifs are periodic on a 128px lattice. Draw neighboring copies to
  // guarantee that shapes crossing an edge continue on the opposite edge.
  const cell = 128;
  const strokeDiamond = (cx, cy, radius, color, width) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius); ctx.lineTo(cx + radius, cy);
    ctx.lineTo(cx, cy + radius); ctx.lineTo(cx - radius, cy); ctx.closePath();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  };
  for (let row = -1; row <= 4; row++) for (let col = -1; col <= 4; col++) {
    const x = col * cell, y = row * cell;
    strokeDiamond(x, y, 59, 'rgba(170,122,70,0.54)', 3);
    strokeDiamond(x, y, 48, 'rgba(105,54,71,0.86)', 9);
    strokeDiamond(x, y, 36, 'rgba(213,162,95,0.28)', 1.5);
    ctx.fillStyle = '#602b42';
    for (let p = 0; p < 8; p++) {
      const a = p * Math.PI / 4;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a)*15, y + Math.sin(a)*15, 7, 12, a, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2);
    ctx.fillStyle = '#b18a55'; ctx.fill();
    // Tiny corner medallions interrupt the grid without adding geometry.
    ctx.beginPath(); ctx.arc(x + 64, y + 64, 5, 0, Math.PI*2);
    ctx.fillStyle = '#7b4652'; ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(options.repeatX ?? 12, options.repeatY ?? 12);
  texture.anisotropy = Math.max(1, Math.min(8, options.maxAnisotropy ?? 4));
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  texture.userData = { artOnly: true, original: true, tilePixels: size, tileMetres: options.tileMetres ?? 1.6, previewOnly: true };
  return texture; // caller disposes texture and owns any material
}
