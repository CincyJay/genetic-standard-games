/**
 * Velvet Ace: "marquee" end cap for back-to-back slot islands (Claude, at Joshua's request:
 * "think you can come up with a better more flashy side pannel?"). Original art, preview-only.
 *
 * Old-Vegas marquee on a velvet slab:
 * - diamond-tufted burgundy velvet face with gold buttons (canvas texture),
 * - a glowing VELVET ACE sign band at the top, a large gold ace of spades with a cyan neon outline,
 * - a ring of chasing marquee bulbs on a gold frame, gold top cap and kick plate.
 *
 * Same placement contract as ChatGPT's svelteIslandEndCap.mjs: Y up, metres, the decorated face is +X
 * (rotate Y by PI for the other end), origin at the floor centre of the cap.
 * `group.userData.animate(seconds)` runs the bulb chase; bulbs and neon are HDR so the floor bloom
 * catches them. Canvas2D is used when available (browser); without it the face is plain velvet.
 */
export function createVelvetIslandEndCapMarquee(THREE, { depth = 1.27, height = 2.09, width = 0.09, bulbSpacing = 0.072 } = {}) {
  const group = new THREE.Group();
  group.name = 'VA_ISLAND_END_CAP_MARQUEE';
  const std = (color, metalness, roughness, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  const velvet = std(0x3a0a1e, 0.05, 0.9);
  const gold = std(0xd4ad62, 0.85, 0.22);
  const darkGold = std(0x8a6a34, 0.8, 0.35);
  const add = (name, geometry, material) => {
    const m = new THREE.Mesh(geometry, material);
    m.name = name;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  // the slab's bevel stands 10 mm proud of its nominal face, so everything on the face sits past that
  const faceX = width / 2 + 0.012;

  // 1. the slab: a rounded-corner profile in the Z-Y plane, extruded along X
  const r = 0.07;
  const hz = depth / 2;
  const s = new THREE.Shape();
  s.moveTo(-hz + r, 0);
  s.lineTo(hz - r, 0);
  s.quadraticCurveTo(hz, 0, hz, r);
  s.lineTo(hz, height - r);
  s.quadraticCurveTo(hz, height, hz - r, height);
  s.lineTo(-hz + r, height);
  s.quadraticCurveTo(-hz, height, -hz, height - r);
  s.lineTo(-hz, r);
  s.quadraticCurveTo(-hz, 0, -hz + r, 0);
  const slab = add('marquee_velvet_slab', new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2, curveSegments: 6 }), velvet);
  slab.rotation.y = Math.PI / 2;
  slab.position.x = -width / 2;

  // 2. gold kick plate and top cap, wrapping the slab
  add('marquee_gold_kick_plate', new THREE.BoxGeometry(width + 0.04, 0.09, depth + 0.03), gold).position.set(0, 0.045, 0);
  add('marquee_gold_top_cap', new THREE.BoxGeometry(width + 0.04, 0.05, depth + 0.03), gold).position.set(0, height - 0.025, 0);

  // 3. the face art: a canvas texture (colour) plus a glow layer (emissive), on a plane on the +X face
  const margin = 0.11;
  const artW = depth - 2 * margin;
  const artH = height - 0.09 - 0.05 - 2 * margin + 0.04;
  const artY = 0.09 + margin - 0.02 + artH / 2;
  const hasCanvas = typeof document !== 'undefined';
  const faceMat = std(0x5a1030, 0.05, 0.8);
  let textures = [];
  if (hasCanvas) {
    const W = 640, H = Math.round(640 * artH / artW);
    const [color, glow] = drawFace(W, H);
    const map = new THREE.CanvasTexture(color);
    const emap = new THREE.CanvasTexture(glow);
    map.colorSpace = emap.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = emap.anisotropy = 4;
    faceMat.map = map;
    faceMat.color.set(0xffffff);
    faceMat.emissiveMap = emap;
    faceMat.emissive.set(0xffffff);
    faceMat.emissiveIntensity = 2.2;
    textures = [map, emap];
  }
  const face = add('marquee_face_art', new THREE.PlaneGeometry(artW, artH), faceMat);
  face.rotation.y = Math.PI / 2;
  face.position.set(faceX + 0.002, artY, 0);
  face.userData.glow = true;

  // 4. gold frame rails under the bulbs
  const fz = artW / 2 + 0.035, fy0 = artY - artH / 2 - 0.035, fy1 = artY + artH / 2 + 0.035;
  const rail = (name, w, h, y, z) => add(name, new THREE.BoxGeometry(0.02, h, w), darkGold).position.set(faceX + 0.006, y, z);
  rail('marquee_frame_top', 2 * fz + 0.05, 0.05, fy1, 0);
  rail('marquee_frame_bottom', 2 * fz + 0.05, 0.05, fy0, 0);
  rail('marquee_frame_left', 0.05, fy1 - fy0, (fy0 + fy1) / 2, -fz);
  rail('marquee_frame_right', 0.05, fy1 - fy0, (fy0 + fy1) / 2, fz);

  // 5. chasing marquee bulbs around the frame (one instanced mesh; HDR colours for the bloom)
  const pts = [];
  const along = (a, b, n) => { for (let i = 0; i < n; i++) { const t = i / n; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } };
  const corners = [[-fz, fy0], [fz, fy0], [fz, fy1], [-fz, fy1]];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    along(a, b, Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / bulbSpacing)));
  }
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.017, 10, 8), bulbMat, pts.length);
  bulbs.name = 'marquee_chase_bulbs';
  bulbs.userData.glow = true;
  const m4 = new THREE.Matrix4();
  pts.forEach(([z, y], i) => bulbs.setMatrixAt(i, m4.makeTranslation(faceX + 0.024, y, z)));
  const lit = new THREE.Color(5.0, 3.6, 1.7);
  const dim = new THREE.Color(0.45, 0.3, 0.12);
  const setChase = (t) => {
    const head = t * 16;
    for (let i = 0; i < pts.length; i++) {
      const k = (((i - head) % 4) + 4) % 4; // every fourth bulb lit, marching around the frame
      bulbs.setColorAt(i, k < 1 ? lit : k < 1.6 ? dim.clone().lerp(lit, 1.6 - k) : dim);
    }
    bulbs.instanceColor.needsUpdate = true;
  };
  setChase(0);
  group.add(bulbs);

  // 6. a cyan neon pulse on the face's glow layer, in step with the chase
  const animate = (t) => {
    setChase(t);
    faceMat.emissiveIntensity = 2.0 + 0.35 * Math.sin(t * 2.4);
  };
  group.userData = {
    artOnly: true, author: 'Claude', note: 'preview-only marquee end cap; original art',
    bulbs: pts.length, animate,
    dispose: () => { textures.forEach((x) => x.dispose()); },
  };
  return group;
}

/** The face artwork: returns [colour canvas, glow canvas]. All original drawing, no external assets. */
function drawFace(W, H) {
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const color = mk(), glow = mk();
  const g = color.getContext('2d'), e = glow.getContext('2d');
  // the glow layer: a faint burgundy so the velvet keeps its colour in a dark room (below bloom)
  const eg = e.createRadialGradient(W / 2, H * 0.55, 20, W / 2, H * 0.55, H * 0.75);
  eg.addColorStop(0, '#3a0a1c'); eg.addColorStop(1, '#12030a');
  e.fillStyle = eg; e.fillRect(0, 0, W, H);

  // velvet: a deep burgundy radial sheen
  const bg = g.createRadialGradient(W / 2, H * 0.55, 20, W / 2, H * 0.55, H * 0.75);
  bg.addColorStop(0, '#8a1c45'); bg.addColorStop(0.55, '#5a0f2e'); bg.addColorStop(1, '#230612');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  // diamond tufting: soft creases, then gold buttons at the crossings
  const step = W / 6;
  g.save();
  g.lineWidth = 3;
  for (let k = -H; k < W + H; k += step) {
    for (const dir of [1, -1]) {
      g.strokeStyle = 'rgba(20,2,10,.55)';
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k + dir * H, H); g.stroke();
      g.strokeStyle = 'rgba(255,170,200,.10)';
      g.beginPath(); g.moveTo(k + 3, 0); g.lineTo(k + 3 + dir * H, H); g.stroke();
    }
  }
  g.restore();
  for (let y = 0; y <= H + step; y += step / 2) {
    for (let x = ((y / (step / 2)) % 2) * (step / 2); x <= W; x += step) {
      const b = g.createRadialGradient(x - 2, y - 2, 1, x, y, 7);
      b.addColorStop(0, '#fff3c4'); b.addColorStop(0.5, '#c99a45'); b.addColorStop(1, '#4a3010');
      g.fillStyle = b; g.beginPath(); g.arc(x, y, 6.5, 0, Math.PI * 2); g.fill();
    }
  }

  // sign band at the top: navy plaque, gold border, glowing wordmark
  const bandH = H * 0.16, bandY = H * 0.035;
  const plaque = (ctx, fill, stroke, lw) => {
    ctx.beginPath(); ctx.roundRect(W * 0.06, bandY, W * 0.88, bandH, 22);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  };
  plaque(g, '#0b1426', '#e2be6e', 6);
  plaque(e, null, '#7a5a20', 6);
  const word = (ctx, fill, blur, shadow) => {
    ctx.save();
    ctx.font = `bold ${Math.round(bandH * 0.5)}px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = shadow; ctx.shadowBlur = blur;
    ctx.fillStyle = fill;
    ctx.fillText('VELVET ACE', W / 2, bandY + bandH * 0.47, W * 0.8);
    ctx.restore();
  };
  const goldText = g.createLinearGradient(0, bandY, 0, bandY + bandH);
  goldText.addColorStop(0, '#fff1bf'); goldText.addColorStop(0.5, '#e3b55a'); goldText.addColorStop(1, '#a8752a');
  word(g, goldText, 18, 'rgba(255,200,90,.8)');
  word(e, '#ffcf6a', 22, '#ff9a20');

  // the ace of spades: neon cyan outline (glow), gold body (colour)
  const cx = W / 2, cy = H * 0.53, sz = W * 0.62;
  const spade = (ctx) => {
    const s = sz / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.bezierCurveTo(cx + s * 0.25, cy - s * 0.55, cx + s * 1.0, cy - s * 0.25, cx + s * 0.92, cy + s * 0.22);
    ctx.bezierCurveTo(cx + s * 0.85, cy + s * 0.6, cx + s * 0.32, cy + s * 0.68, cx + s * 0.08, cy + s * 0.36);
    ctx.lineTo(cx + s * 0.3, cy + s * 0.95);
    ctx.lineTo(cx - s * 0.3, cy + s * 0.95);
    ctx.lineTo(cx - s * 0.08, cy + s * 0.36);
    ctx.bezierCurveTo(cx - s * 0.32, cy + s * 0.68, cx - s * 0.85, cy + s * 0.6, cx - s * 0.92, cy + s * 0.22);
    ctx.bezierCurveTo(cx - s * 1.0, cy - s * 0.25, cx - s * 0.25, cy - s * 0.55, cx, cy - s);
    ctx.closePath();
  };
  // dark halo so the emblem stands off the velvet
  g.save(); spade(g); g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 40; g.fillStyle = '#1a0610'; g.fill(); g.restore();
  const body = g.createLinearGradient(cx - sz / 2, cy - sz / 2, cx + sz / 2, cy + sz / 2);
  body.addColorStop(0, '#fff0b8'); body.addColorStop(0.35, '#e0b153'); body.addColorStop(0.7, '#9c6a22'); body.addColorStop(1, '#f2cf7c');
  spade(g); g.fillStyle = body; g.fill();
  g.save(); spade(g); g.clip();
  g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(cx - sz * 0.15, cy - sz * 0.2, sz * 0.18, sz * 0.32, -0.5, 0, Math.PI * 2); g.fill();
  g.restore();
  spade(g); g.strokeStyle = '#5ee6ff'; g.lineWidth = 7; g.stroke();
  // a warm self-glow on the gold body, so it reads as polished gold under the marquee lights
  const eb = e.createLinearGradient(cx - sz / 2, cy - sz / 2, cx + sz / 2, cy + sz / 2);
  eb.addColorStop(0, '#7a5a1e'); eb.addColorStop(0.5, '#4a300c'); eb.addColorStop(1, '#6a4a16');
  spade(e); e.fillStyle = eb; e.fill();
  e.save(); spade(e); e.strokeStyle = '#3fdcff'; e.lineWidth = 9; e.shadowColor = '#2bd2ff'; e.shadowBlur = 26; e.stroke(); e.restore();
  // an "A" engraved on the spade
  const ace = (ctx, fill) => {
    ctx.save();
    ctx.font = `bold ${Math.round(sz * 0.3)}px Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = fill; ctx.fillText('A', cx, cy + sz * 0.02);
    ctx.restore();
  };
  ace(g, '#3a0a1e');
  ace(e, '#000');

  // corner indices, like a playing card
  const corner = (ctx, x, y, rot, fill) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.font = `bold ${Math.round(W * 0.09)}px Georgia, serif`;
    ctx.textAlign = 'center'; ctx.fillStyle = fill; ctx.fillText('A', 0, 0);
    ctx.font = `${Math.round(W * 0.07)}px serif`; ctx.fillText('♠', 0, W * 0.07);
    ctx.restore();
  };
  corner(g, W * 0.12, bandY + bandH + W * 0.11, 0, '#f0cf82');
  corner(g, W * 0.88, H - W * 0.12, Math.PI, '#f0cf82');

  // bottom ribbon: the game, in cyan neon
  const rib = (ctx, fill, blur) => {
    ctx.save();
    ctx.font = `bold ${Math.round(W * 0.06)}px 'Segoe UI', Roboto, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#2bd2ff'; ctx.shadowBlur = blur; ctx.fillStyle = fill;
    ctx.fillText('5 REELS  ·  50 LINES', W / 2, H * 0.9, W * 0.8);
    ctx.restore();
  };
  rib(g, '#bdf3ff', 10);
  rib(e, '#5ee6ff', 20);

  // inner neon border
  const border = (ctx, color, lw, blur) => {
    ctx.save(); ctx.shadowColor = '#2bd2ff'; ctx.shadowBlur = blur;
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.roundRect(W * 0.03, H * 0.015, W * 0.94, H * 0.97, 26); ctx.stroke(); ctx.restore();
  };
  border(g, '#7fe9ff', 4, 8);
  border(e, '#3fdcff', 6, 18);
  return [color, glow];
}
