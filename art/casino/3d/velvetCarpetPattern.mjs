/**
 * Velvet Ace original woven casino carpet texture, optional prototype.
 * Decorative texture only: no floor mesh, collision, lighting or live asset edits.
 * A caller supplies a canvas factory so this works in browser, OffscreenCanvas
 * or a test harness without assuming a DOM is available.
 */
export function createVelvetCarpetTexture(THREE, options = {}) {
  if (!THREE?.CanvasTexture) throw new TypeError('Three.js CanvasTexture required');
  const size = options.size ?? 512;
  if (!Number.isInteger(size) || size < 128 || size > 2048 || (size & (size - 1)) !== 0)
    throw new RangeError('size must be a power of two from 128 to 2048');
  const factory = options.createCanvas;
  if (typeof factory !== 'function') throw new TypeError('createCanvas(size) required');
  const canvas = factory(size);
  const ctx = canvas?.getContext?.('2d');
  if (!ctx || canvas.width !== size || canvas.height !== size)
    throw new TypeError('createCanvas must return a sized 2D canvas');
  const pi = Math.PI;
  // All marks are periodic within a 4x4 grid; the boundary is never stroked.
  ctx.fillStyle = '#211b2c'; ctx.fillRect(0, 0, size, size);
  const cell = size / 4;
  // Interlaced damask is a separate opt-in design, not a medallion variant.
  if (options.motif !== 'interlaced-damask') for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const cx = (x + .5) * cell, cy = (y + .5) * cell;
    ctx.save(); ctx.translate(cx, cy);
    ctx.rotate(((x + y) % 2) * pi / 4);
    // Deep garnet medallion, brushed antique gold woven border.
    ctx.fillStyle = '#52273d';
    ctx.beginPath(); ctx.ellipse(0, 0, cell * .35, cell * .35, 0, 0, 2*pi); ctx.fill();
    ctx.strokeStyle = '#a47b45'; ctx.lineWidth = Math.max(1, size / 350);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * pi / 4, r = (i % 2 ? .22 : .31) * cell;
      if (!i) ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r);
      else ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#bc925a';
    ctx.beginPath(); ctx.arc(0, 0, cell * .055, 0, 2*pi); ctx.fill();
    ctx.restore();
    // Interlocking corner flourishes, deliberately inset to avoid tile seams.
    ctx.strokeStyle = '#634559'; ctx.lineWidth = Math.max(1, size / 512);
    ctx.beginPath(); ctx.arc(cx, cy, cell * .41, 0, 2*pi); ctx.stroke();
  }
  if (options.motif === 'interlaced-damask') {
    // Seamless, large-scale interlacing. No medallion circles or dot grid.
    // Periodic functions meet with matching slopes at all tile boundaries.
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const drawRibbon = (vertical, phase, color, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i <= 256; i++) {
        const t = i / 256;
        const sway = .12 * Math.sin(4 * pi * t + phase);
        const a = t * size, b = size * (.5 + sway);
        if (i === 0) ctx.moveTo(vertical ? b : a, vertical ? a : b);
        else ctx.lineTo(vertical ? b : a, vertical ? a : b);
      }
      ctx.stroke();
    };
    // Broad garnet underweave remains legible when mipmapped at a distance.
    for (const phase of [0, pi]) {
      drawRibbon(false, phase, '#85435a', Math.max(9, size / 42));
      drawRibbon(true, phase, '#85435a', Math.max(9, size / 42));
    }
    // Gold raised thread, framed by a dark edge to separate crossing ribbons.
    for (const phase of [0, pi]) {
      drawRibbon(false, phase, '#302333', Math.max(7, size / 56));
      drawRibbon(false, phase, '#bd9659', Math.max(4, size / 110));
      drawRibbon(true, phase, '#302333', Math.max(7, size / 56));
      drawRibbon(true, phase, '#bd9659', Math.max(4, size / 110));
    }
    ctx.restore();
  }
  // Optional continuous-vine overlay: less polka-dot than isolated medallions.
  // The four quadrants use wrapped paths so their edges join on repeated tiles.
  // The original medallion look remains the default for backwards compatibility.
  if (options.motif === 'woven-vine') {
    ctx.save();
    ctx.strokeStyle = '#957149';
    ctx.lineWidth = Math.max(3, size / 150);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // A periodic pair of intertwined sinusoidal ribbons across the entire tile.
    // Sampled at identical endpoints, so the line joins when the texture repeats.
    for (const phase of [0, pi]) {
      ctx.beginPath();
      for (let i = 0; i <= 128; i++) {
        const x = i * size / 128;
        const y = size * (.5 + .14 * Math.sin(4 * pi * i / 128 + phase));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 128; i++) {
        const y = i * size / 128;
        const x = size * (.5 + .14 * Math.sin(4 * pi * i / 128 + phase));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Warm garnet tracery provides a second visual frequency at distance.
    ctx.strokeStyle = '#6e3b4d';
    ctx.lineWidth = Math.max(4, size / 100);
    for (let i = 0; i < 4; i++) {
      const p = (i + .5) * cell;
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.bezierCurveTo(size * .25, p - cell * .35, size * .75, p + cell * .35, size, p);
      ctx.stroke();
    }
    ctx.restore();
  } else if (options.motif !== undefined && options.motif !== 'medallion' && options.motif !== 'interlaced-damask') {
    throw new RangeError('motif must be medallion, woven-vine, or interlaced-damask');
  }
  // Seeded, low-opacity yarn speckle: reproducible across runs and devices.
  let seed = (options.seed ?? 420) >>> 0;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < size * 2; i++) {
    const x = Math.floor(rand()*size), y = Math.floor(rand()*size);
    ctx.fillStyle = rand() < .5 ? 'rgba(240,202,151,.10)' : 'rgba(8,6,15,.18)';
    ctx.fillRect(x, y, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, Math.max(1, options.anisotropy ?? 4));
  texture.repeat.set(options.repeatX ?? 4, options.repeatY ?? 8);
  texture.needsUpdate = true;
  texture.userData.velvetArt = {
    type: 'original-patterned-casino-carpet', motif: options.motif ?? 'medallion', visualOnly: true,
    productionIntegrated: false, textureSize: size,
    warning: 'Opt-in only. Verify actual floor UVs, seam continuity, readability, and mobile texture memory. Do not replace production carpet without owner approval.'
  };
  return texture;
}
