import Phaser from 'phaser';
import { makeIconButton, popIn, type ButtonOptions } from '@tgs/kit';
import type { Card } from '../logic/cards.ts';
import { cardId } from '../logic/cards.ts';
import { DISPLAY_FONT, GOLD, SECONDARY, THEME, ads, analytics, audio, bonus, fmt, haptics, player, wallet } from '../services.ts';
import { showLevelUps } from './progress.ts';
import { closeRulesSheet, showRules } from './rules.ts';
import type { RulesKey } from '../data/rules.ts';

/** Design size: every scene lays out in this 1080 x 1920 world. */
export const VW = 1080;
export const VH = 1920;

/**
 * The smallest comfortable touch target, 48 dp, in design px for this screen. The canvas
 * scales with the phone, so this comes from the display scale (design px per CSS px):
 * 135 on a 384-dp-wide phone, 144 on a 360-dp one. Never less than 120.
 */
export function minTap(scene: Phaser.Scene): number {
  const s = scene.scale.displayScale?.x;
  return Math.max(120, Math.round(48 * (s && Number.isFinite(s) && s > 0 ? s : 2.8125)));
}

/**
 * Make an interactive object's hit area at least `w` x `h` design px, centred on it,
 * without changing how it looks. Works for containers (with a size) and images.
 */
export function padHit<T extends Phaser.GameObjects.Container | Phaser.GameObjects.Image>(obj: T, w: number, h: number): T {
  if (!obj.input) obj.setInteractive({ useHandCursor: true });
  const sx = Math.abs(obj.scaleX) || 1;
  const sy = Math.abs(obj.scaleY) || 1;
  const lw = Math.max(obj.width, w / sx);
  const lh = Math.max(obj.height, h / sy);
  obj.input!.hitArea = new Phaser.Geom.Rectangle((obj.width - lw) / 2, (obj.height - lh) / 2, lw, lh);
  obj.input!.hitAreaCallback = Phaser.Geom.Rectangle.Contains;
  return obj;
}

type Scalable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;

/**
 * Press feedback that shrinks an object's visuals, never the object itself. Shrinking the
 * object would shrink its hit area too, so a tap near the edge would land inside on press,
 * fall outside on release, and be lost. Returns press/release functions.
 */
export function pressVisuals(visuals: Scalable[], k = 0.94): { press: () => void; release: () => void } {
  const base = visuals.map((v) => [v.scaleX, v.scaleY] as const);
  return {
    press: () => visuals.forEach((v, i) => v.setScale(base[i]![0] * k, base[i]![1] * k)),
    release: () => visuals.forEach((v, i) => v.setScale(base[i]![0], base[i]![1])),
  };
}

/** The hit area of an interactive object in design px (for tests and the VA board's measurements). */
export function hitSize(obj: Phaser.GameObjects.Container | Phaser.GameObjects.Image): { w: number; h: number } {
  const r = obj.input?.hitArea as Phaser.Geom.Rectangle | undefined;
  return r ? { w: Math.round(r.width * Math.abs(obj.scaleX)), h: Math.round(r.height * Math.abs(obj.scaleY)) } : { w: 0, h: 0 };
}

/**
 * Fit the design to any screen shape. The game canvas fills the phone (Scale.EXPAND);
 * the camera centers the 1080x1920 layout and the extra space shows evenly around it.
 * Returns the visible world bounds (bottom-anchored UI should use `bottom`).
 */
export function frame(scene: Phaser.Scene): { left: number; right: number; top: number; bottom: number } {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const ex = (W - VW) / 2;
  const ey = (H - VH) / 2;
  scene.cameras.main.setScroll(-ex, -ey);
  (globalThis as Record<string, unknown>).__view = { W, H };
  return { left: -ex, right: VW + ex, top: -ey, bottom: VH + ey };
}

/**
 * Full-screen background that always covers the screen (uniform scale, centered).
 * With `crop`, only the part behind world rows y0..y1 is drawn (used to mask slot reels).
 */
export function backdrop(scene: Phaser.Scene, key: string, crop?: { y0: number; y1: number }): Phaser.GameObjects.Image {
  const W = scene.scale.width;
  const H = scene.scale.height;
  // always the full image ('__BASE'): adding a cropped frame elsewhere changes the texture's default frame
  const img = scene.add.image(W / 2, H / 2, key, '__BASE').setScrollFactor(0);
  const s = Math.max(W / img.width, H / img.height);
  img.setScale(s);
  if (crop) {
    const ey = (H - VH) / 2;
    const offY = (H - img.height * s) / 2;
    const ty0 = Math.max(0, (crop.y0 + ey - offY) / s);
    const ty1 = Math.min(img.height, (crop.y1 + ey - offY) / s);
    img.setCrop(0, ty0, img.width, Math.max(0, ty1 - ty0));
  }
  return img;
}

/** A dimming layer over the whole screen. */
export function screenDim(scene: Phaser.Scene, alpha: number, depth: number): Phaser.GameObjects.Rectangle {
  const W = scene.scale.width;
  const H = scene.scale.height;
  return scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, alpha).setScrollFactor(0).setDepth(depth).setInteractive();
}

export const CARD_W = 170;
export const CARD_H = (CARD_W * 280) / 200;

export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  t: string,
  size: number,
  weight = '700',
  color = THEME.ink,
  font = THEME.font,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, t, { fontFamily: font, fontSize: `${size}px`, fontStyle: weight, color, align: 'center' }).setOrigin(0.5);
}

/** Top bar: back button, title, coin balance. Returns a function that refreshes the balance. */
/** The top bar: back arrow, title, an optional Rules button (table games), level and coins. */
export function coinBar(scene: Phaser.Scene, title: string, onBack?: () => void, rules?: RulesKey): () => void {
  const w = scene.scale.width;
  const pin = <T extends Phaser.GameObjects.GameObject & { setScrollFactor(x: number): T }>(o: T): T => o.setScrollFactor(0);
  const g = pin(scene.add.graphics().setDepth(50));
  g.fillStyle(0x000000, 0.35);
  g.fillRect(0, 0, w, 200);
  if (onBack) {
    const back = makeIconButton(
      scene,
      90,
      100,
      (ig) => {
        ig.lineStyle(9, THEME.icon, 1);
        ig.lineBetween(12, -22, -12, 0);
        ig.lineBetween(-12, 0, 12, 22);
      },
      () => {
        audio.tap();
        onBack();
      },
      { size: 100, theme: THEME },
    ).setDepth(51);
    padHit(back, minTap(scene), minTap(scene));
    pin(back);
    // Android back button / gesture does the same as the arrow
    const onBackKey = () => {
      audio.tap();
      // the back button closes the Rules sheet first
      if (closeRulesSheet()) return;
      onBack();
    };
    scene.events.on('back', onBackKey);
    // scene events outlive a restart: without this, every visit adds another handler and
    // one Back press runs them all (closing the Rules sheet and then leaving the table)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off('back', onBackKey));
  }
  const titleX = onBack ? 160 : w / 2 - 200;
  // the title must end before the Rules button (or the level badge)
  let titleEnd = w - 448 - 38 - 16;
  if (rules) {
    const t = minTap(scene);
    const rx = w - 448 - 38 - 12 - t / 2;
    const info = makeIconButton(
      scene,
      rx,
      100,
      (ig) => {
        ig.fillStyle(THEME.icon, 1);
        ig.fillCircle(0, -17, 7);
        ig.fillRoundedRect(-6, -4, 12, 30, 4);
      },
      () => {
        audio.tap();
        showRules(scene, rules);
      },
      { size: 84, theme: THEME },
    ).setDepth(51);
    padHit(info, t, t);
    pin(info);
    titleEnd = rx - t / 2 - 8;
  }
  const titleText = pin(text(scene, titleX, 100, title, 52, '700', GOLD, DISPLAY_FONT).setOrigin(0, 0.5).setDepth(51));
  if (titleText.width > titleEnd - titleX) titleText.setScale((titleEnd - titleX) / titleText.width);
  // coin pill
  const pill = pin(scene.add.graphics().setDepth(51));
  pill.fillStyle(0x14071f, 0.9);
  pill.fillRoundedRect(w - 380, 62, 340, 76, 38);
  pill.lineStyle(3, 0xe9c86a, 0.8);
  pill.strokeRoundedRect(w - 380, 62, 340, 76, 38);
  pin(scene.add.image(w - 344, 100, 'coin').setDisplaySize(66, 66).setDepth(52));
  const amount = pin(text(scene, w - 190, 100, '', 44, '800', '#ffffff').setDepth(52));
  // level badge (VIP color) and XP bar under the coin pill
  const badge = pin(scene.add.graphics().setDepth(52));
  const lvlText = pin(text(scene, w - 448, 100, '', 34, '900', '#1a0e22').setDepth(53));
  const xpBar = pin(scene.add.graphics().setDepth(52));
  const drawLevel = () => {
    const p = player.progress();
    const vip = player.vip();
    badge.clear();
    badge.fillStyle(0x000000, 0.4);
    badge.fillCircle(w - 446, 104, 40);
    badge.fillStyle(vip.color, 1);
    badge.fillCircle(w - 448, 100, 38);
    badge.lineStyle(3, 0xffffff, 0.6);
    badge.strokeCircle(w - 448, 100, 38);
    lvlText.setText(String(p.level));
    xpBar.clear();
    xpBar.fillStyle(0x000000, 0.55);
    xpBar.fillRoundedRect(w - 370, 150, 320, 12, 6);
    xpBar.fillStyle(0x5ee08f, 1);
    xpBar.fillRoundedRect(w - 370, 150, Math.max(12, 320 * p.fraction), 12, 6);
  };
  drawLevel();
  let shown = wallet.coins;
  let celebrating = false;
  const refresh = () => {
    drawLevel();
    const ups = celebrating ? [] : player.takeLevelUps();
    if (ups.length) {
      celebrating = true;
      showLevelUps(scene, ups, () => {
        celebrating = false;
        refresh();
      });
    }
    const target = wallet.coins;
    scene.tweens.addCounter({
      from: shown,
      to: target,
      duration: target > shown ? 700 : 200,
      onUpdate: (tw) => amount.setText(fmt(Math.round(tw.getValue() ?? target))),
    });
    shown = target;
  };
  amount.setText(fmt(shown));
  return refresh;
}

/** Card sprite at (x, y): face-down by default. */
export function cardSprite(scene: Phaser.Scene, x: number, y: number, c?: Card): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, c ? `card-${cardId(c)}` : 'card-back')
    .setDisplaySize(CARD_W, CARD_H)
    .setDepth(10);
}

/** Deal a card from (fromX, fromY) to (x, y), flipping it face-up on arrival if `c` is given. */
export function dealCard(
  scene: Phaser.Scene,
  from: { x: number; y: number },
  x: number,
  y: number,
  c: Card | null,
  delay = 0,
  size = 1,
): Phaser.GameObjects.Image {
  const s = cardSprite(scene, from.x, from.y).setAngle(-20).setAlpha(0);
  if (size !== 1) s.setDisplaySize(CARD_W * size, CARD_H * size);
  scene.tweens.add({
    targets: s,
    x,
    y,
    angle: 0,
    alpha: 1,
    duration: 280,
    delay,
    ease: 'Cubic.easeOut',
    onStart: () => audio.card(),
    onComplete: () => {
      if (c) flipCard(scene, s, c);
    },
  });
  return s;
}

/** Flip a face-down card face-up, keeping its current on-screen size. */
export function flipCard(scene: Phaser.Scene, s: Phaser.GameObjects.Image, c: Card, delay = 0): void {
  const dw = s.displayWidth;
  const dh = s.displayHeight;
  scene.tweens.add({
    targets: s,
    scaleX: 0,
    duration: 110,
    delay,
    onStart: () => audio.flip(),
    onComplete: () => {
      s.setTexture(`card-${cardId(c)}`).setDisplaySize(dw, dh);
      const full = s.scaleX;
      s.scaleX = 0;
      scene.tweens.add({ targets: s, scaleX: full, duration: 110 });
    },
  });
}

/** Coins burst for wins. Bigger wins, more coins. */
export function coinShower(scene: Phaser.Scene, x: number, y: number, amount: number): void {
  const qty = Math.min(60, 10 + Math.floor(Math.log10(Math.max(10, amount)) * 8));
  const e = scene.add.particles(x, y, 'coin', {
    speed: { min: 300, max: 900 },
    angle: { min: 220, max: 320 },
    gravityY: 1600,
    lifespan: 1400,
    scale: { start: 0.5, end: 0.28 },
    rotate: { min: 0, max: 360 },
    emitting: false,
  });
  e.setDepth(80);
  e.explode(qty);
  scene.time.delayedCall(1600, () => e.destroy());
}

/** Big centered banner ("BLACKJACK!", "+2,500"). */
export function banner(scene: Phaser.Scene, line1: string, line2 = '', color = GOLD): void {
  const c = scene.add.container(VW / 2, 760).setDepth(90);
  const t1 = text(scene, 0, 0, line1, 96, '900', color, DISPLAY_FONT).setStroke('#14071f', 14);
  c.add(t1);
  if (line2) c.add(text(scene, 0, 96, line2, 60, '800', '#ffffff').setStroke('#14071f', 12));
  popIn(scene, c);
  scene.tweens.add({ targets: c, alpha: 0, delay: 1500, duration: 400, onComplete: () => c.destroy() });
}

/** Modal shown when a bet can't be covered: free bonus or a rewarded video. */
export function outOfCoins(scene: Phaser.Scene, refresh: () => void): void {
  const dim = screenDim(scene, 0.6, 200);
  const panel = scene.add.container(VW / 2, VH / 2).setDepth(201);
  const bg = scene.add.graphics();
  bg.fillStyle(THEME.surfaceEdge, 1);
  bg.fillRoundedRect(-420, -340, 840, 680, 48);
  bg.fillStyle(THEME.surface, 1);
  bg.fillRoundedRect(-420, -350, 840, 680, 48);
  bg.lineStyle(4, 0xe9c86a, 0.8);
  bg.strokeRoundedRect(-420, -350, 840, 680, 48);
  panel.add([bg, text(scene, 0, -250, 'Need more coins?', 62, '800', GOLD, DISPLAY_FONT)]);
  const close = () => {
    dim.destroy();
    panel.destroy();
  };
  const ready = bonus.msUntilReady() === 0;
  panel.add(
    makeButton(
      scene,
      0,
      -90,
      ready ? `Free bonus  +${fmt(bonus.amount())}` : `Bonus in ${formatWait(bonus.msUntilReady())}`,
      () => {
        if (!ready) return;
        audio.win();
        bonus.collect();
        refresh();
        close();
      },
      { width: 640, height: 140, fontSize: 46, theme: THEME, ...(ready ? {} : SECONDARY) },
    ),
  );
  panel.add(
    makeButton(
      scene,
      0,
      80,
      'Watch a video  +1,000',
      async () => {
        analytics.track('ad_offer_shown', { placement: 'coins' });
        if (await ads.rewarded('coins')) {
          analytics.track('ad_rewarded_complete', { placement: 'coins' });
          wallet.add(1000);
          haptics.fire('success');
          refresh();
          close();
        }
      },
      { width: 640, height: 140, fontSize: 46, ...SECONDARY, theme: THEME },
    ),
  );
  panel.add(text(scene, 0, 220, 'Close', 40, '600', THEME.inkSoft).setInteractive({ useHandCursor: true }).on('pointerup', close));
  popIn(scene, panel);
}

export function formatWait(ms: number): string {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/**
 * A row of chip buttons to choose a bet size; calls `onPick` with the value. Returns the objects it created.
 * Each chip's hit area is 48 dp wide (never past the gap to its neighbour) and `hitH` tall.
 */
export function chipPicker(scene: Phaser.Scene, y: number, values: number[], selected: number, onPick: (v: number) => void, hitH = 118): Phaser.GameObjects.GameObject[] {
  const w = VW;
  const gap = Math.min(170, (w - 120) / values.length);
  const imgs: Phaser.GameObjects.Image[] = [];
  const ring = scene.add.graphics().setDepth(30);
  const mark = (i: number) => {
    ring.clear();
    ring.lineStyle(8, 0xffffff, 1);
    ring.strokeCircle(imgs[i]!.x, imgs[i]!.y, 66);
  };
  values.forEach((v, i) => {
    const x = w / 2 + (i - (values.length - 1) / 2) * gap;
    const img = scene.add.image(x, y, `chip-${v}`).setDisplaySize(118, 118).setDepth(31).setInteractive({ useHandCursor: true });
    padHit(img, Math.min(gap - 2, Math.max(118, minTap(scene))), hitH);
    img.on('pointerup', () => {
      audio.unlock();
      audio.chip();
      mark(i);
      onPick(v);
    });
    imgs.push(img);
  });
  const idx = Math.max(0, values.indexOf(selected));
  mark(idx);
  return [ring, ...imgs];
}

/** Which 3D pill a button colour maps to. */
function pillFor(color: number | undefined): string {
  if (color === undefined) return 'pill-gold';
  const c = Phaser.Display.Color.IntegerToColor(color);
  const hsv = Phaser.Display.Color.RGBToHSV(c.red, c.green, c.blue) as { h: number; s: number; v: number };
  if (hsv.v < 0.3 || hsv.s < 0.25) return 'pill-dark';
  const h = hsv.h;
  if (h < 0.04 || h > 0.94) return 'pill-fold';
  if (h < 0.17) return 'pill-gold';
  if (h < 0.45) return 'pill-raise';
  if (h < 0.72) return 'pill-call';
  return 'pill-purple';
}

/**
 * Buttons are 3D-rendered pills (gold, dark, red, blue, green or purple, picked
 * from the requested colour), stretched with a nine-slice so the rounded ends
 * keep their shape at any width. Same signature as the kit's makeButton.
 */
export function makeButton(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, opts: ButtonOptions = {}): Phaser.GameObjects.Container {
  const w = opts.width ?? 420;
  const h = opts.height ?? 130;
  const key = pillFor(opts.color);
  const face = scene.add.nineslice(0, 0, key, undefined, w * (153 / h), 153, 80, 80, 0, 0).setScale(h / 153);
  const gold = key === 'pill-gold';
  const t = scene.add
    .text(0, -2, label, { fontFamily: THEME.font, fontSize: `${opts.fontSize ?? 56}px`, fontStyle: '800', color: gold ? '#3a1a00' : (opts.textColor && opts.textColor !== '#3a1a00' ? opts.textColor : '#ffffff') })
    .setOrigin(0.5);
  // never let a label spill past the pill's rounded ends
  const room = w - Math.min(48, h * 0.45);
  if (t.width > room) t.setScale(room / t.width);
  if (!gold) t.setShadow(0, 2, '#000000', 4, true, true);
  const c = scene.add.container(x, y, [face, t]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  const fx = pressVisuals([face, t], 0.96);
  c.on('pointerdown', () => {
    face.setTint(0xcccccc);
    fx.press();
  });
  const release = () => {
    face.clearTint();
    fx.release();
  };
  c.on('pointerout', release);
  c.on('pointerup', () => {
    release();
    scene.tweens.add({ targets: c, scale: { from: 0.94, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    onClick();
  });
  return c;
}
