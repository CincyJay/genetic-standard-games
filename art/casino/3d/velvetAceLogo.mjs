/**
 * The Velvet Ace logo (gold spade, "Velvet Ace" script, C A S I N O) as one shared canvas texture
 * (Claude, 2026-11-19). The gaming chair and the slot stool both wear it on their backs, so every
 * seat on the floor shares one texture and one material (one draw call per instanced level).
 * Returns null where there is no DOM (tests, node).
 */
const cache = new Map();
const matCache = new Map();

export function velvetAceLogoTexture(THREE, logoText = 'Velvet Ace') {
  if (typeof document === 'undefined') return null;
  const key = logoText;
  const hit = cache.get(key);
  if (hit && hit.THREE === THREE) return hit.map;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 640;
  const g = c.getContext('2d');
  if (g) {
    // drawn in a 512x320 design space at 2x; a dark outline under heavy gold so it reads from
    // walking distance against the burgundy leather (Joshua: bigger logo, 2026-11-19)
    g.scale(2, 2);
    const grad = g.createLinearGradient(0, 30, 0, 270);
    grad.addColorStop(0, '#fff0b8');
    grad.addColorStop(0.5, '#e2bd6c');
    grad.addColorStop(1, '#a87c36');
    const ink = '#24050d';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    // spade
    g.save();
    g.translate(256, 62);
    g.scale(1.15, 1.15);
    g.beginPath();
    g.moveTo(0, -38);
    g.bezierCurveTo(30, -10, 44, 8, 26, 24);
    g.bezierCurveTo(14, 34, 4, 26, 3, 18);
    g.lineTo(10, 40);
    g.lineTo(-10, 40);
    g.lineTo(-3, 18);
    g.bezierCurveTo(-4, 26, -14, 34, -26, 24);
    g.bezierCurveTo(-44, 8, -30, -10, 0, -38);
    g.closePath();
    g.strokeStyle = ink;
    g.lineWidth = 8;
    g.stroke();
    g.fillStyle = grad;
    g.fill();
    g.restore();
    const heavy = (text, y, maxW, outline, thicken) => {
      g.strokeStyle = ink;
      g.lineWidth = outline;
      g.strokeText(text, 256, y, maxW);
      g.fillStyle = grad;
      g.fillText(text, 256, y, maxW);
      g.strokeStyle = grad;
      g.lineWidth = thicken;
      g.strokeText(text, 256, y, maxW);
    };
    g.font = 'italic 700 112px "Brush Script MT", "Segoe Script", cursive, Georgia, serif';
    heavy(logoText, 168, 496, 12, 3.5);
    g.font = '700 40px Georgia, "Times New Roman", serif';
    heavy('C A S I N O', 252, 320, 8, 1.5);
    g.strokeStyle = ink;
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(116, 290);
    g.lineTo(396, 290);
    g.stroke();
    g.fillStyle = grad;
    g.fillRect(116, 288, 280, 4);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace ?? map.colorSpace;
    map.anisotropy = 8;
    cache.set(key, { THREE, map });
    return map;
  }
  return null;
}

/** One shared logo material (gold, transparent cut-out) for every seat back; null without a DOM. */
export function velvetAceLogoMaterial(THREE, logoText = 'Velvet Ace') {
  const map = velvetAceLogoTexture(THREE, logoText);
  if (!map) return null;
  const hit = matCache.get(logoText);
  if (hit && hit.THREE === THREE) return hit.mat;
  const mat = new THREE.MeshStandardMaterial({ name: 'VA_SEAT_BACK_LOGO', map, transparent: true, alphaTest: 0.08, roughness: 0.3, metalness: 0.75, depthWrite: false });
  matCache.set(logoText, { THREE, mat });
  return mat;
}
