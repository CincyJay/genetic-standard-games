/**
 * Velvet Ace Svelte 01: original five-reel, five-row burgundy/gold portrait slot screen.
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
  bg.addColorStop(0, '#18071e'); bg.addColorStop(.52, '#351034'); bg.addColorStop(1, '#100916');
  c.fillStyle = bg; c.fillRect(0, 0, 512, 1024);
  round(10, 10, 492, 1004, 22, '#180c20', '#e5b86b', 3);
  round(20, 20, 472, 984, 16, '#25112b', '#824b85');
  c.textAlign = 'center';
  c.shadowColor = '#f6bd67'; c.shadowBlur = 13;
  c.fillStyle = '#ffe0a0'; c.font = 'italic bold 57px Georgia, serif'; c.fillText('Velvet Ace', 256, 105);
  c.shadowBlur = 0;
  c.fillStyle = '#d8a9f3'; c.font = 'bold 18px sans-serif'; c.fillText('♠  C A S I N O  ♠', 256, 143);
  // Four independently coloured progressive jackpot plaques, preview values only.
  const jackpots = [
    ['GRAND', '$10,000.00', '#842038'],
    ['MAJOR', '$2,500.00', '#5b257b'],
    ['MINOR', '$500.00', '#1b6851'],
    ['MINI', '$100.00', '#806025']
  ];
  jackpots.forEach(([label, amount, color], i) => {
    const x = 27 + (i % 2) * 233, y = 160 + Math.floor(i / 2) * 39;
    round(x, y, 225, 34, 11, color, '#e2b96c', 1.5);
    c.textAlign = 'left'; c.fillStyle = '#fff1d0';
    c.font = 'bold 15px sans-serif'; c.fillText(label, x + 9, y + 22);
    c.textAlign = 'right'; c.font = 'bold 16px Georgia, serif';
    c.fillText(amount, x + 216, y + 22);
  });
  c.textAlign = 'center';
  // Five independent reel windows, 5 symbols each. 85x520 inner windows.
  // Keep this large: the owner's priority is legible 5x5 reels on a slim portrait display.
  const symbols = ['7', '◆', '♛', '★', '♥', '♠', '✦'];
  const reelWindows = [];
  const railY = 240, railH = 540, railW = 91, railGap = 3, railX = 22;
  const innerInset = 3, innerY = 249, innerH = 522, innerW = 85;
  for (let col = 0; col < 5; col++) {
    const x = railX + col * (railW + railGap);
    round(x, railY, railW, railH, 7, '#130b1b', '#dfb96c', 1.6);
    // Dark physical reel cells with warm gold separators. Keep 5x5 geometry
    // and exact reelWindows coordinates so existing reel animation still fits.
    round(x + innerInset, innerY, innerW, innerH, 4, '#1c1024');
    const rowH = innerH / 5;
    for (let row = 0; row < 5; row++) {
      const cellY = innerY + row * rowH;
      const shade = c.createLinearGradient(x, cellY, x + innerW, cellY + rowH);
      shade.addColorStop(0, '#190e1e'); shade.addColorStop(.5, '#35203a');
      shade.addColorStop(1, '#170c1d');
      c.fillStyle = shade;
      c.fillRect(x + innerInset + 1, cellY + 2, innerW - 2, rowH - 4);
      const centerY = cellY + rowH / 2;
      const symbol = symbols[(col * 3 + row * 2 + (col + row) % 3) % symbols.length];
      c.shadowColor = '#a456c9'; c.shadowBlur = 7;
      c.fillStyle = row === 2 ? '#ffb95b' : '#f0d8b2';
      c.font = 'bold 51px Georgia, serif';
      c.fillText(symbol, x + railW / 2, centerY + 17);
      c.shadowBlur = 0;
      if (row < 4) {
        c.fillStyle = '#ad854b';
        c.fillRect(x + 4, innerY + (row + 1) * rowH - 1, railW - 8, 2);
      }
    }
    reelWindows.push({
      x: Math.round((x + innerInset) * sx),
      y: Math.round(innerY * sy),
      w: Math.round(innerW * sx),
      h: Math.round(innerH * sy)
    });
  }
  round(34, 794, 444, 74, 12, '#37153f', '#d9a95c');
  c.fillStyle = '#f2d18b'; c.font = 'bold 22px sans-serif';
  c.fillText('5 REELS  •  50 LINES', 256, 824);
  c.fillStyle = '#eaf6ff'; c.font = 'bold 22px sans-serif';
  c.fillText('FEATURE READY', 256, 853);
  round(34, 883, 444, 101, 12, '#190d24', '#d9a95c');
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
    for (const [key, x] of [['credits', 35], ['bet', 186], ['win', 337]]) {
      ctx.fillStyle = '#190d24'; ctx.fillRect(x, 925, 139, 45);
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
