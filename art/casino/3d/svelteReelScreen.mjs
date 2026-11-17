/**
 * Velvet Ace Svelte 01: original five-reel, five-row portrait slot screen.
 * Isolated art preview only; the 5x5/50-line label matches the actual game.
 * Canvas2D required. UV, window and return API remain compatible with Claude's preview.
 */
export function createSvelteReelScreen(THREE, { width = 512, height = 1024 } = {}) {
  if (typeof document === 'undefined') throw new Error('Canvas2D browser preview required');
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas2D unavailable');
  const sx = width / 512, sy = height / 1024;
  c.scale(sx, sy);
  const round = (x, y, w, h, r, fill, stroke, lineWidth = 2) => {
    c.beginPath(); c.roundRect(x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lineWidth; c.strokeStyle = stroke; c.stroke(); }
  };
  const bg = c.createLinearGradient(0, 0, 512, 1024);
  bg.addColorStop(0, '#07111c'); bg.addColorStop(.52, '#172840'); bg.addColorStop(1, '#080c16');
  c.fillStyle = bg; c.fillRect(0, 0, 512, 1024);
  round(10, 10, 492, 1004, 22, '#0a111d', '#bca36d', 3);
  round(20, 20, 472, 984, 16, '#111b2b', '#465a72');
  c.textAlign = 'center';
  c.shadowColor = '#f6bd67'; c.shadowBlur = 13;
  c.fillStyle = '#ffe0a0'; c.font = 'bold 49px Georgia, serif'; c.fillText('VELVET ACE', 256, 105);
  c.shadowBlur = 0;
  c.fillStyle = '#a9d9e7'; c.font = 'bold 18px sans-serif'; c.fillText('MIDNIGHT REELS', 256, 143);
  round(34, 161, 444, 62, 12, '#172236', '#c9aa70');
  c.fillStyle = '#f6d28b'; c.font = 'bold 22px sans-serif'; c.fillText('GRAND  25,000', 256, 187);
  c.fillStyle = '#a7dcec'; c.font = 'bold 15px sans-serif'; c.fillText('MAJOR  5,000    •    MINOR  500', 256, 209);
  // Five independent reel windows, 5 symbols each. 85x520 inner windows.
  // Keep this large: the owner's priority is legible 5x5 reels on a slim portrait display.
  const symbols = ['7', '◆', '♛', '★', '♥', '♠', '✦'];
  const reelWindows = [];
  const railY = 240, railH = 540, railW = 91, railGap = 3, railX = 22;
  const innerInset = 3, innerY = 249, innerH = 522, innerW = 85;
  for (let col = 0; col < 5; col++) {
    const x = railX + col * (railW + railGap);
    round(x, railY, railW, railH, 7, '#060a10', '#bca36d', 1.6);
    const g = c.createLinearGradient(x, innerY, x + railW, innerY);
    g.addColorStop(0, '#8095a7'); g.addColorStop(.09, '#e7f0f1');
    g.addColorStop(.48, '#f9f4e8'); g.addColorStop(.91, '#e2e9ed');
    g.addColorStop(1, '#65798a');
    round(x + innerInset, innerY, innerW, innerH, 4, g);
    const rowH = innerH / 5;
    for (let row = 0; row < 5; row++) {
      const centerY = innerY + rowH * (row + .5);
      const symbol = symbols[(col * 3 + row * 2 + (col + row) % 3) % symbols.length];
      c.fillStyle = row === 2 ? '#a31f35' : '#173a60';
      c.font = 'bold 51px Georgia, serif';
      c.fillText(symbol, x + railW / 2, centerY + 17);
      if (row < 4) {
        c.fillStyle = 'rgba(39,52,71,.30)';
        c.fillRect(x + 5, innerY + (row + 1) * rowH - 1, railW - 10, 2);
      }
    }
    reelWindows.push({
      x: Math.round((x + innerInset) * sx),
      y: Math.round(innerY * sy),
      w: Math.round(innerW * sx),
      h: Math.round(innerH * sy)
    });
  }
  round(34, 794, 444, 74, 12, '#151e30', '#c9aa70');
  c.fillStyle = '#f2d18b'; c.font = 'bold 22px sans-serif';
  c.fillText('5 REELS  •  50 LINES', 256, 824);
  c.fillStyle = '#eaf6ff'; c.font = 'bold 22px sans-serif';
  c.fillText('FEATURE READY', 256, 853);
  round(34, 883, 444, 101, 12, '#091420', '#bca36d');
  c.fillStyle = '#9dddf1'; c.font = 'bold 19px sans-serif';
  c.fillText('CREDITS          BET           WIN', 256, 919);
  c.fillStyle = '#fff2cc'; c.font = 'bold 25px sans-serif';
  c.fillText('12,500           50           2,450', 256, 955);
  // Preview-only live meter overlay contract: callers can repaint these three
  // disjoint rectangles after a spin without touching reelWindows or game state.
  const meterRects = {
    credits: { x: Math.round(35 * sx), y: Math.round(925 * sy), w: Math.round(139 * sx), h: Math.round(45 * sy) },
    bet: { x: Math.round(186 * sx), y: Math.round(925 * sy), w: Math.round(139 * sx), h: Math.round(45 * sy) },
    win: { x: Math.round(337 * sx), y: Math.round(925 * sy), w: Math.round(139 * sx), h: Math.round(45 * sy) }
  };
  const drawMeters = (ctx, values = {}) => {
    if (!ctx || typeof ctx.save !== 'function') throw new TypeError('Canvas2D context required');
    ctx.save();
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    // clear the whole value row of the meter well, gaps included: the static values above are one
    // spaced string, and with a wider sans-serif (Android) "12,500" ran past the credits box (VA-0140)
    ctx.fillStyle = '#091420'; ctx.fillRect(35, 925, 441, 45);
    for (const [key, x] of [['credits', 35], ['bet', 186], ['win', 337]]) {
      ctx.fillStyle = '#fff2cc'; ctx.font = 'bold 23px sans-serif';
      ctx.textAlign = 'center';
      const value = values[key];
      ctx.fillText(value == null ? '—' : String(value), x + 69.5, 956, 132);
    }
    ctx.restore();
    texture.needsUpdate = true;
  };
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return { canvas, texture, reelWindows, meterRects, drawMeters, dispose: () => texture.dispose(), artOnly: true };
}
