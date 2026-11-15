import Phaser from 'phaser';

/**
 * Euchre's traditional score keeping: each team uses a 4 and a 6 of one suit
 * and shows its score as the number of pips left uncovered.
 *   0     both cards face down
 *   1-3   the 4 face up, the 6 face down across it hiding 3, 2 or 1 pips
 *   4     the 4 face up, the 6 face down tucked behind it
 *   5     the 6 face up, the 4 face down hiding one pip
 *   6     the 6 face up, the 4 face down tucked behind it
 *   7-9   the 6 face up on top of the 4, leaving 1, 2 or 3 of its pips showing
 *   10    both face up
 * Where the covering card sits is worked out so it hides exactly the right
 * pips and none of the others.
 */
const W = 96;
const H = 134;
const PIP_R = 10;
const PIPS: Record<4 | 6, { x: number; y: number }[]> = {
  4: [
    { x: -22, y: -32 },
    { x: 22, y: -32 },
    { x: -22, y: 32 },
    { x: 22, y: 32 },
  ],
  6: [
    { x: -22, y: -38 },
    { x: 22, y: -38 },
    { x: -22, y: 0 },
    { x: 22, y: 0 },
    { x: -22, y: 38 },
    { x: 22, y: 38 },
  ],
};

interface Cover {
  x: number;
  y: number;
  angle: number;
  hidden: number[];
}
const cache = new Map<string, Cover>();

function subsets(n: number, k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, acc: number[]) => {
    if (acc.length === k) return void out.push([...acc]);
    for (let i = start; i < n; i++) rec(i + 1, [...acc, i]);
  };
  rec(0, []);
  // prefer hiding the bottom-right pips
  return out.sort((a, b) => b.reduce((s, i) => s + i, 0) - a.reduce((s, i) => s + i, 0));
}

/** Where to lay a card over a `rank` card so exactly `hide` pips are covered. */
function placeCover(rank: 4 | 6, hide: number): Cover {
  const key = `${rank}:${hide}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pips = PIPS[rank];
  let best: (Cover & { cost: number }) | null = null;
  for (const hidden of subsets(pips.length, hide)) {
    for (const angle of [0, 90, 45, -45, 30, -30, 60, -60]) {
      const t = (-angle * Math.PI) / 180;
      const cos = Math.cos(t);
      const sin = Math.sin(t);
      for (let cx = -W * 1.2; cx <= W * 1.2; cx += 4) {
        for (let cy = -H * 1.1; cy <= H * 1.1; cy += 4) {
          let ok = true;
          for (let i = 0; i < pips.length && ok; i++) {
            const dx = pips[i]!.x - cx;
            const dy = pips[i]!.y - cy;
            const lx = Math.abs(dx * cos - dy * sin);
            const ly = Math.abs(dx * sin + dy * cos);
            if (hidden.includes(i)) ok = lx <= W / 2 - PIP_R && ly <= H / 2 - PIP_R;
            else ok = lx >= W / 2 + PIP_R || ly >= H / 2 + PIP_R;
          }
          if (!ok) continue;
          // keep the pair snug, and square to the table when possible
          const cost = Math.hypot(cx, cy) + (angle % 90 === 0 ? 0 : 25);
          if (!best || cost < best.cost) best = { x: cx, y: cy, angle, hidden, cost };
        }
      }
    }
    if (best) break;
  }
  const out = best ?? { x: 0, y: 0, angle: 0, hidden: [] };
  cache.set(key, out);
  return out;
}

/** Draws a heart or spade pip of height `h` centred on (x, y). */
function pip(g: Phaser.GameObjects.Graphics, x: number, y: number, h: number, suit: 'h' | 's'): void {
  const r = h * 0.28;
  if (suit === 'h') {
    g.fillCircle(x - r * 0.95, y - h * 0.18, r);
    g.fillCircle(x + r * 0.95, y - h * 0.18, r);
    g.fillTriangle(x - r * 1.9, y - h * 0.08, x + r * 1.9, y - h * 0.08, x, y + h * 0.5);
  } else {
    g.fillCircle(x - r * 0.95, y + h * 0.1, r);
    g.fillCircle(x + r * 0.95, y + h * 0.1, r);
    g.fillTriangle(x - r * 1.9, y + h * 0.0, x + r * 1.9, y + h * 0.0, x, y - h * 0.5);
    g.fillTriangle(x, y + h * 0.05, x - r * 0.9, y + h * 0.5, x + r * 0.9, y + h * 0.5);
  }
}

/** A face-up 4 or 6 in vector graphics (stays sharp at any tilt); covered pips are left off. */
function face(scene: Phaser.Scene, rank: 4 | 6, suit: 'h' | 's', hidden: number[] = []): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.3);
  g.fillRoundedRect(-W / 2 + 2, -H / 2 + 4, W, H, 10);
  g.fillStyle(0xfdfaf2, 1);
  g.fillRoundedRect(-W / 2, -H / 2, W, H, 10);
  g.lineStyle(2, 0xc9bfa8, 1);
  g.strokeRoundedRect(-W / 2, -H / 2, W, H, 10);
  const color = suit === 'h' ? 0xc8102e : 0x16121c;
  g.fillStyle(color, 1);
  pip(g, -W / 2 + 13, -H / 2 + 36, 12, suit);
  PIPS[rank].forEach((p, i) => {
    if (!hidden.includes(i)) pip(g, p.x, p.y, 26, suit);
  });
  c.add(g);
  c.add(scene.add.text(-W / 2 + 13, -H / 2 + 15, String(rank), { fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'bold', color: suit === 'h' ? '#c8102e' : '#16121c' }).setOrigin(0.5));
  return c;
}

function back(scene: Phaser.Scene): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, 'card-back').setDisplaySize(W, H);
}

/** Draws one team's 4 and 6 showing `score` (0-10) centred on (x, y). */
export function fourSix(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, x: number, y: number, score: number, suit: 'h' | 's'): void {
  const s = Phaser.Math.Clamp(Math.round(score), 0, 10);
  const add = (o: Phaser.GameObjects.Container | Phaser.GameObjects.Image, dx: number, dy: number, angle = 0) => {
    o.setPosition(x + dx, y + dy).setAngle(angle);
    layer.add(o);
  };
  if (s === 0) {
    add(back(scene), -8, -6, -6);
    add(back(scene), 8, 6, 4);
  } else if (s === 4 || s === 6) {
    add(back(scene), -34, -10, -10);
    add(face(scene, s, suit), 10, 4);
  } else if (s === 10) {
    add(face(scene, 4, suit), -52, 0, -4);
    add(face(scene, 6, suit), 52, 0, 4);
  } else {
    const baseRank: 4 | 6 = s === 5 ? 6 : 4;
    const hide = s < 4 ? 4 - s : s === 5 ? 1 : 10 - s;
    const cv = placeCover(baseRank, hide);
    add(face(scene, baseRank, suit, cv.hidden), 0, 0);
    // 7-9: the face-up 6 is the covering card
    add(s >= 7 ? face(scene, 6, suit) : back(scene), cv.x, cv.y, cv.angle);
  }
}

