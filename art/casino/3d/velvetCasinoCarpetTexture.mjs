/**
 * Velvet Ace original casino carpet art, isolated prototype.
 * Seamless 512px repeat tile: midnight-plum woven ground, staggered gold
 * lozenges, alternating rosettes/medallions and low-contrast fibres. No external assets.
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
  // A 2x2 super-cell breaks the checkerboard rhythm while remaining tileable.
  // Paint across the edges with wrapped duplicates for seamless repeats.
  const cell = 256;
  const drawWrapped = (paint, x, y) => {
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) paint(x + dx, y + dy);
  };
  // Broad, quiet burgundy pools vary the woven ground without hard grid lines.
  for (const [x, y, radius] of [[64, 88, 115], [380, 310, 145], [150, 440, 95]]) {
    drawWrapped((px, py) => {
      const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
      grad.addColorStop(0, 'rgba(146,59,83,0.37)');
      grad.addColorStop(1, 'rgba(116,49,72,0)');
      ctx.fillStyle = grad; ctx.fillRect(px-radius, py-radius, radius*2, radius*2);
    }, x, y);
  }
  const strokeDiamond = (cx, cy, radius, color, width) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius); ctx.lineTo(cx + radius, cy);
    ctx.lineTo(cx, cy + radius); ctx.lineTo(cx - radius, cy); ctx.closePath();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  };
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
    const x = col * cell + 128 + (row % 2 ? 68 : -68);
    const y = row * cell + 128;
    const ornate = (row + col) % 2 === 0;
    drawWrapped((px, py) => {
      strokeDiamond(px, py, ornate ? 91 : 81, 'rgba(216,168,101,0.85)', 5);
      strokeDiamond(px, py, ornate ? 74 : 66, 'rgba(112,51,71,0.90)', 12);
      strokeDiamond(px, py, ornate ? 58 : 51, 'rgba(226,178,111,0.70)', 3);
      if (ornate) {
        for (let p = 0; p < 10; p++) {
          const angle = p * Math.PI / 5;
          ctx.beginPath();
          ctx.ellipse(px + Math.cos(angle)*24, py + Math.sin(angle)*24,
            10, 20, angle, 0, Math.PI*2);
          ctx.fillStyle = p % 2 ? '#78334b' : '#9a5261';
          ctx.fill();
        }
      } else {
        ctx.beginPath(); ctx.arc(px, py, 27, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(216,168,101,0.75)'; ctx.lineWidth = 5; ctx.stroke();
        for (let p = 0; p < 4; p++) {
          const angle = p * Math.PI / 2;
          ctx.beginPath();
          ctx.ellipse(px + Math.cos(angle)*15, py + Math.sin(angle)*15,
            9, 16, angle, 0, Math.PI*2);
          ctx.fillStyle = '#70374e'; ctx.fill();
        }
      }
      ctx.beginPath(); ctx.arc(px, py, ornate ? 9 : 7, 0, Math.PI*2);
      ctx.fillStyle = '#c69b61'; ctx.fill();
    }, x, y);
  }
  // Continuous gold filigree traverses the empty ground between medallions.
  // Wrapped cubic paths cross every tile boundary, unlike isolated floor-tile frames.
  const vine = (offset, alpha) => {
    for (let wrap = -1; wrap <= 1; wrap++) {
      ctx.beginPath();
      ctx.moveTo(-size + wrap * size, offset);
      for (let segment = -1; segment < 5; segment++) {
        const x0 = segment * 128 + wrap * size;
        const y0 = offset + (segment % 2 === 0 ? 26 : -26);
        const y1 = offset + (segment % 2 === 0 ? -26 : 26);
        ctx.bezierCurveTo(x0 + 42, y0, x0 + 86, y1, x0 + 128, offset);
      }
      ctx.strokeStyle = 'rgba(197,137,83,' + alpha + ')';
      ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(offset, -size + wrap * size);
      for (let segment = -1; segment < 5; segment++) {
        const y0 = segment * 128 + wrap * size;
        const x0 = offset + (segment % 2 === 0 ? 26 : -26);
        const x1 = offset + (segment % 2 === 0 ? -26 : 26);
        ctx.bezierCurveTo(x0, y0 + 42, x1, y0 + 86, offset, y0 + 128);
      }
      ctx.strokeStyle = 'rgba(197,137,83,' + alpha + ')';
      ctx.lineWidth = 4; ctx.stroke();
    }
  };
  vine(0, 0.55); vine(256, 0.55);
  // Small repeating leaves bridge the vine network; wrapped copies avoid seams.
  for (let x = 0; x < size; x += 64) for (let y = 0; y < size; y += 128) {
    drawWrapped((px, py) => {
      ctx.beginPath();
      ctx.ellipse(px + 14, py + 10, 13, 4, -0.55, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(166,105,81,0.65)'; ctx.fill();
      ctx.beginPath();
      ctx.ellipse(px - 14, py - 10, 13, 4, -0.55, 0, Math.PI * 2);
      ctx.fill();
    }, x, y);
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
