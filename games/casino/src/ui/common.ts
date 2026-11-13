import Phaser from 'phaser';
import { makeButton, makeIconButton, popIn } from '@tgs/kit';
import type { Card } from '../logic/cards.ts';
import { cardId } from '../logic/cards.ts';
import { DISPLAY_FONT, GOLD, SECONDARY, THEME, ads, analytics, audio, bonus, fmt, haptics, wallet } from '../services.ts';

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
export function coinBar(scene: Phaser.Scene, title: string, onBack?: () => void): () => void {
  const { width: w } = scene.scale;
  const g = scene.add.graphics().setDepth(50);
  g.fillStyle(0x000000, 0.35);
  g.fillRect(0, 0, w, 200);
  if (onBack) {
    makeIconButton(
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
  }
  text(scene, onBack ? 400 : w / 2 - 200, 100, title, 52, '700', GOLD, DISPLAY_FONT).setOrigin(0, 0.5).setDepth(51);
  // coin pill
  const pill = scene.add.graphics().setDepth(51);
  pill.fillStyle(0x14071f, 0.9);
  pill.fillRoundedRect(w - 380, 62, 340, 76, 38);
  pill.lineStyle(3, 0xe9c86a, 0.8);
  pill.strokeRoundedRect(w - 380, 62, 340, 76, 38);
  scene.add.image(w - 344, 100, 'chip-1000').setDisplaySize(64, 64).setDepth(52);
  const amount = text(scene, w - 190, 100, '', 44, '800', '#ffffff').setDepth(52);
  let shown = wallet.coins;
  const refresh = () => {
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
    onStart: () => audio.play([{ freq: 1400, to: 700, dur: 0.05, wave: 'triangle', vol: 0.08 }]),
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
  const e = scene.add.particles(x, y, 'chip-1000', {
    speed: { min: 300, max: 900 },
    angle: { min: 220, max: 320 },
    gravityY: 1600,
    lifespan: 1400,
    scale: { start: 0.35, end: 0.2 },
    rotate: { min: 0, max: 360 },
    emitting: false,
  });
  e.setDepth(80);
  e.explode(qty);
  scene.time.delayedCall(1600, () => e.destroy());
}

/** Big centered banner ("BLACKJACK!", "+2,500"). */
export function banner(scene: Phaser.Scene, line1: string, line2 = '', color = GOLD): void {
  const { width: w } = scene.scale;
  const c = scene.add.container(w / 2, 760).setDepth(90);
  const t1 = text(scene, 0, 0, line1, 96, '900', color, DISPLAY_FONT).setStroke('#14071f', 14);
  c.add(t1);
  if (line2) c.add(text(scene, 0, 96, line2, 60, '800', '#ffffff').setStroke('#14071f', 12));
  popIn(scene, c);
  scene.tweens.add({ targets: c, alpha: 0, delay: 1500, duration: 400, onComplete: () => c.destroy() });
}

/** Modal shown when a bet can't be covered: free bonus or a rewarded video. */
export function outOfCoins(scene: Phaser.Scene, refresh: () => void): void {
  const { width: w, height: h } = scene.scale;
  const dim = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6).setDepth(200).setInteractive();
  const panel = scene.add.container(w / 2, h / 2).setDepth(201);
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
        audio.complete();
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

/** A row of chip buttons to choose a bet size; calls `onPick` with the value. Returns the objects it created. */
export function chipPicker(scene: Phaser.Scene, y: number, values: number[], selected: number, onPick: (v: number) => void): Phaser.GameObjects.GameObject[] {
  const { width: w } = scene.scale;
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
    img.on('pointerup', () => {
      audio.tap();
      mark(i);
      onPick(v);
    });
    imgs.push(img);
  });
  const idx = Math.max(0, values.indexOf(selected));
  mark(idx);
  return [ring, ...imgs];
}

export { makeButton };
