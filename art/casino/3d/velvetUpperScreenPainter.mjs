/**
 * Velvet Ace original upper-display art painter (isolated study).
 * Integrator supplies ScreenCopy { title: string, lines: string[] } and canvas.
 * Does not import gameplay code or touch production textures.
 * Draws at the canvas's existing dimensions; caller owns canvas/texture lifecycle.
 */
export function paintVelvetUpperScreen(canvas, copy, options = {}) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) throw new TypeError('Velvet Ace painter requires a 2D canvas');
  const w = canvas.width, h = canvas.height;
  if (!(w > 0 && h > 0)) throw new RangeError('Canvas must have positive dimensions');
  const scale = Math.min(w / 640, h / 360);
  const title = String(copy?.title ?? '').trim();
  const lines = Array.isArray(copy?.lines) ? copy.lines.map(v => String(v)) : [];
  const bonus = options.kind === 'bonus' || (options.kind !== 'marquee' && lines.length > 0);
  const rounded = (x,y,width,height,r) => {
    const rad = Math.min(r,width/2,height/2);
    ctx.beginPath(); ctx.moveTo(x+rad,y);
    ctx.arcTo(x+width,y,x+width,y+height,rad);
    ctx.arcTo(x+width,y+height,x,y+height,rad);
    ctx.arcTo(x,y+height,x,y,rad);
    ctx.arcTo(x,y,x+width,y,rad);ctx.closePath();
  };
  const gradient = ctx.createLinearGradient(0,0,w,h);
  gradient.addColorStop(0,'#160a25');
  gradient.addColorStop(0.48,'#35132b');
  gradient.addColorStop(1,'#080e22');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  // Art-deco radial fan: original vector geometry, no external image or baked game copy.
  ctx.save();ctx.translate(w/2,h*0.9);
  for(let i=-7;i<=7;i++){
    const a=(-Math.PI/2)+(i*Math.PI/17);
    ctx.beginPath();ctx.moveTo(0,0);
    ctx.lineTo(Math.cos(a)*w*1.2,Math.sin(a)*w*1.2);
    ctx.strokeStyle='rgba(224,158,77,0.11)';ctx.lineWidth=Math.max(1,2*scale);ctx.stroke();
  }
  ctx.restore();
  const inset=16*scale;
  rounded(inset,inset,w-2*inset,h-2*inset,22*scale);
  ctx.lineWidth=5*scale;ctx.strokeStyle='#9b642f';ctx.stroke();
  rounded(inset+8*scale,inset+8*scale,w-2*(inset+8*scale),h-2*(inset+8*scale),17*scale);
  ctx.lineWidth=2*scale;ctx.strokeStyle='#f2cc83';ctx.stroke();
  // Warm inset glints, kept inside the artwork, not a bloom effect.
  for(const side of [0,1]){
    ctx.save();ctx.translate(side ? w-36*scale : 36*scale, h/2);
    ctx.fillStyle='#d5a75d';
    ctx.beginPath();ctx.moveTo(0,-10*scale);ctx.lineTo(8*scale,0);
    ctx.lineTo(0,10*scale);ctx.lineTo(-8*scale,0);ctx.closePath();ctx.fill();ctx.restore();
  }
  ctx.textAlign='center';ctx.textBaseline='middle';
  const fitText=(text,maxWidth,initial,min,fontFamily='Georgia, serif') => {
    let px=initial;
    do { ctx.font=`700 ${px}px ${fontFamily}`; if(ctx.measureText(text).width<=maxWidth)break; px-=2*scale; }
    while(px>min);
    return Math.max(min,px);
  };
  const titleSize=fitText(title,w-115*scale,bonus?40*scale:78*scale,23*scale);
  ctx.shadowColor='#e9a244';ctx.shadowBlur=15*scale;
  ctx.fillStyle='#f9db9d';
  ctx.font=`700 ${titleSize}px Georgia, serif`;
  ctx.fillText(title,w/2,bonus?h*0.19:h*0.49,w-110*scale);
  ctx.shadowBlur=0;
  if(bonus){
    // Size for the physical topper, not a full-size UI panel. The rendered
    // bonus cap is only ~150 CSS pixels wide in a portrait floor view.
    const visible=lines.slice(0,5);
    const count=Math.max(visible.length,1);
    const top=h*0.34, bottom=h*0.91;
    const pitch=(bottom-top)/count;
    const rowHeight=pitch*0.91;
    // Sparse bonus screens get an engraved flourish in the unused space.
    // Decorative only: the text and jackpot values remain data-driven.
    if(count<=2){
      const cy=h*0.29;
      ctx.save();ctx.strokeStyle='rgba(234,177,95,0.35)';ctx.lineWidth=1.8*scale;
      for(const direction of [-1,1]){
        for(let k=0;k<5;k++){
          ctx.beginPath();ctx.moveTo(w/2+direction*95*scale,cy);
          ctx.quadraticCurveTo(w/2+direction*(145+k*12)*scale,cy-(12+k*5)*scale,w/2+direction*(215+k*6)*scale,cy);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    visible.forEach((line,i)=>{
      const y=top+(i+0.5)*pitch;
      rounded(w*0.09,y-rowHeight/2,w*0.82,rowHeight,7*scale);
      ctx.fillStyle=i%2===0?'rgba(16,12,33,0.85)':'rgba(65,25,49,0.83)';ctx.fill();
      ctx.strokeStyle='rgba(238,189,105,0.78)';ctx.lineWidth=1.8*scale;ctx.stroke();
      // Aim for 70% of each row's height, with a width fit for long
      // translated titles or large dynamic jackpot figures.
      const cap = count <= 2 ? 70*scale : 43*scale;
      // Keep the jackpot label in the same face as other bonus rows.
      // Only its changing value uses fixed-width numerals, avoiding a code-font label.
      const match = /^(GRAND|MAJOR|MINOR|MINI)(\s+)(.*)$/i.exec(line);
      const label = match ? match[1] + match[2] : '';
      const value = match ? match[3] : '';
      const rowFace = 'system-ui, sans-serif';
      const digitFace = 'ui-monospace, monospace';
      const maxWidth = w*0.76;
      const initial = Math.min(cap,rowHeight*(count <= 2 ? 0.66 : 0.70));
      let px = initial;
      const measureParts = (size) => {
        ctx.font = `700 ${size}px ${rowFace}`;
        const labelWidth = ctx.measureText(label).width;
        ctx.font = `700 ${size}px ${digitFace}`;
        return { labelWidth, total: labelWidth + ctx.measureText(value).width };
      };
      if(match){
        while(px > 13*scale && measureParts(px).total > maxWidth) px -= 2*scale;
        px = Math.max(13*scale,px);
      } else {
        px = fitText(line,maxWidth,initial,13*scale,rowFace);
      }
      ctx.fillStyle='#fff0c9';
      if(match){
        const { labelWidth, total } = measureParts(px);
        const left = w/2-total/2;
        ctx.textAlign='left';
        ctx.font=`700 ${px}px ${rowFace}`;
        ctx.fillText(label,left,y);
        ctx.font=`700 ${px}px ${digitFace}`;
        ctx.fillText(value,left+labelWidth,y);
        ctx.textAlign='center';
      } else {
        ctx.font=`700 ${px}px ${rowFace}`;
        ctx.fillText(line,w/2,y,maxWidth);
      }
    });
  } else {
    ctx.fillStyle='#d2a55c';
    ctx.fillRect(w*0.24,h*0.7,w*0.52,2*scale);
    ctx.beginPath();ctx.arc(w/2,h*0.7,6*scale,0,Math.PI*2);ctx.fill();
  }
  return canvas;
}
