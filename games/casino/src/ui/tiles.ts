import Phaser from 'phaser';
import { cardId, cards } from '../logic/cards.ts';
import { UNLOCKS, isUnlocked, type UnlockId } from '../logic/progression.ts';
import { DISPLAY_FONT, GOLD, audio, haptics, player } from '../services.ts';
import { CARD_H, CARD_W, text } from './common.ts';
import { drawWheel } from './wheel.ts';

/** A tappable picture tile: a game in a room, or a room in the lobby. */
export interface Tile {
  key: string;
  title: string;
  sub: string;
  bg: string;
  unlock: UnlockId | null;
  ribbon?: string;
  data?: Record<string, unknown>;
  /** Draws the tile's picture into `c` (centered; the tile is w x h). */
  art: (scene: Phaser.Scene, c: Phaser.GameObjects.Container, w: number, h: number) => void;
}

/** A crop of a backdrop, sized to the tile. */
export function tileBg(scene: Phaser.Scene, key: string, w: number, h: number): Phaser.GameObjects.Image {
  const fk = `tile-${key}-${w}x${h}`;
  const tex = scene.textures.get(key);
  if (!tex.has(fk)) {
    const src = tex.getSourceImage() as { width: number; height: number };
    const ch = Math.min(src.height, (src.width * h) / w);
    tex.add(fk, 0, 0, Math.max(0, src.height * 0.36 - ch / 2), src.width, ch);
  }
  return scene.add.image(0, 0, key, fk).setDisplaySize(w, h);
}

/**
 * Draws a tile into `parent` at (x, y). `isDragging` lets a scrolling parent
 * swallow the tap that ends a drag.
 */
export function gameTile(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  t: Tile,
  x: number,
  y: number,
  w: number,
  h: number,
  i: number,
  isDragging: () => boolean = () => false,
): Phaser.GameObjects.Container {
  const locked = t.unlock ? !isUnlocked(t.unlock, player.level) : false;
  const c = scene.add.container(x, y);
  parent.add(c);
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.55);
  shadow.fillRoundedRect(-w / 2 + 4, -h / 2 + 14, w, h, 30);
  c.add([shadow, tileBg(scene, t.bg, w, h)]);
  const art = scene.add.container(0, 0);
  t.art(scene, art, w, h);
  c.add(art);
  const plate = scene.add.graphics();
  plate.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.88, 0.88);
  plate.fillRect(-w / 2, h / 2 - 200, w, 200);
  c.add(plate);
  // frame drawn over the image corners (rounded without a mask)
  const fr = scene.add.graphics();
  fr.lineStyle(16, 0x0e0414, 1);
  fr.strokeRoundedRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10, 36);
  fr.lineStyle(6, 0xc9962a, 1);
  fr.strokeRoundedRect(-w / 2, -h / 2, w, h, 30);
  fr.lineStyle(2, 0xfff4b0, 0.8);
  fr.strokeRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 28);
  fr.lineStyle(2, 0x5a3a08, 0.9);
  fr.strokeRoundedRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18, 22);
  c.add(fr);
  const big = h >= 400;
  c.add(text(scene, 0, h / 2 - (big ? 108 : 98), t.title, t.title.length > 13 ? (big ? 50 : 48) : big ? 60 : 56, '900', GOLD, DISPLAY_FONT).setStroke('#1a0700', 10));
  c.add(text(scene, 0, h / 2 - (big ? 50 : 44), t.sub, 26, '700', '#f3e6f0').setStroke('#000000', 5));
  if (t.ribbon && !locked) {
    const r = scene.add.graphics();
    r.fillStyle(t.ribbon === 'NEW' ? 0x18b860 : 0xe8283e, 1);
    r.fillRoundedRect(w / 2 - 130, -h / 2 + 22, 112, 50, 14);
    r.lineStyle(3, 0xffffff, 0.8);
    r.strokeRoundedRect(w / 2 - 130, -h / 2 + 22, 112, 50, 14);
    const rt = text(scene, w / 2 - 74, -h / 2 + 47, t.ribbon, 30, '900', '#ffffff');
    c.add([r, rt]);
    scene.tweens.add({ targets: rt, scale: 1.12, duration: 500, yoyo: true, repeat: -1 });
  }
  // a slow sheen sweeps across unlocked tiles now and then
  if (!locked) {
    const sheen = scene.add.graphics();
    sheen.fillStyle(0xffffff, 0.09);
    sheen.fillPoints([new Phaser.Math.Vector2(-40, -h / 2 + 12), new Phaser.Math.Vector2(30, -h / 2 + 12), new Phaser.Math.Vector2(-30, h / 2 - 12), new Phaser.Math.Vector2(-100, h / 2 - 12)], true);
    sheen.x = -w;
    c.add(sheen);
    scene.tweens.add({ targets: sheen, x: w, duration: 1100, delay: 1500 + i * 400, repeatDelay: 5000 + i * 300, repeat: -1, ease: 'Sine.easeInOut' });
  }
  if (locked) {
    const lvl = UNLOCKS.find((u) => u.id === t.unlock)!.level;
    const shade = scene.add.graphics();
    shade.fillStyle(0x000000, 0.62);
    shade.fillRoundedRect(-w / 2, -h / 2, w, h, 30);
    const lock = scene.add.graphics();
    lock.lineStyle(14, 0xe9c86a, 1);
    lock.beginPath();
    lock.arc(0, -70, 36, Math.PI, 0);
    lock.strokePath();
    lock.fillStyle(0xe9c86a, 1);
    lock.fillRoundedRect(-56, -70, 112, 86, 14);
    lock.fillStyle(0x3a2a10, 1);
    lock.fillCircle(0, -36, 10);
    c.add([shade, lock, text(scene, 0, 60, `Unlocks at level ${lvl}`, 34, '800', '#ffffff')]);
  }
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerup', () => {
    if (isDragging()) return;
    audio.unlock();
    if (locked) {
      audio.invalid();
      haptics.fire('error');
      scene.tweens.add({ targets: c, x: x + 12, duration: 60, yoyo: true, repeat: 2 });
      return;
    }
    audio.tap();
    haptics.fire('light');
    scene.tweens.add({ targets: c, scale: { from: 0.95, to: 1 }, duration: 160, onComplete: () => scene.scene.start(t.key, t.data) });
  });
  c.setScale(0.92).setAlpha(0);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 340, delay: 80 + i * 60, ease: 'Back.easeOut' });
  return c;
}

// ------------------------------------------------------------------ pictures
export function cardsArt(scene: Phaser.Scene, c: Phaser.GameObjects.Container, ids: string, chip: boolean, y = -80, size = 1): void {
  const cs = cards(ids);
  const n = cs.length;
  const scale = (n > 2 ? 0.66 : 0.9) * size;
  cs.forEach((card, i) => {
    const a = (i - (n - 1) / 2) * (n > 2 ? 12 : 14);
    c.add(
      scene.add
        .image((i - (n - 1) / 2) * (n > 2 ? 52 : 80) * size, y + Math.abs(i - (n - 1) / 2) * 8, `card-${cardId(card)}`)
        .setDisplaySize(CARD_W * scale, CARD_H * scale)
        .setAngle(a),
    );
  });
  if (chip) c.add(scene.add.image(130 * size, y + 70, 'chip-500').setDisplaySize(100 * size, 100 * size));
}

export function wheelArt(scene: Phaser.Scene, c: Phaser.GameObjects.Container, x = 0, y = -70, r = 110): void {
  const g = scene.add.graphics();
  drawWheel(scene, g, r, false);
  const holder = scene.add.container(x, y, [g]);
  c.add(holder);
  scene.tweens.add({ targets: holder, angle: 360, duration: 12000, repeat: -1 });
}

/** Three symbols in a little reel window. */
export function reelArt(scene: Phaser.Scene, c: Phaser.GameObjects.Container, keys: string[], y = -70, size = 120): void {
  const win = scene.add.graphics();
  const ww = size * 3 + 40;
  win.fillStyle(0x0a0310, 0.85);
  win.fillRoundedRect(-ww / 2, y - size / 2 - 20, ww, size + 40, 22);
  win.lineStyle(4, 0xe9c86a, 0.9);
  win.strokeRoundedRect(-ww / 2, y - size / 2 - 20, ww, size + 40, 22);
  c.add(win);
  keys.forEach((k, i) => c.add(scene.add.image((i - 1) * (size + 2), y, k).setDisplaySize(size, size)));
}
