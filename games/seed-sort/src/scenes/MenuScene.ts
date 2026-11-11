import Phaser from 'phaser';
import { makeButton, makeIconButton, popIn } from '@tgs/kit';
import { goToLevel } from '../navigation.ts';
import { ITEM_TEX, SECONDARY, THEME, applySettings, audio, haptics, save } from '../services.ts';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.add.image(w / 2, h / 2, 'bg-garden').setDisplaySize(w, h);
    // soft wash at the top and bottom so text reads over the painting
    const wash = this.add.graphics();
    wash.fillGradientStyle(0xfff8ea, 0xfff8ea, 0xfff8ea, 0xfff8ea, 0.9, 0.9, 0, 0);
    wash.fillRect(0, 0, w, 760);
    wash.fillGradientStyle(0x2a1a10, 0x2a1a10, 0x2a1a10, 0x2a1a10, 0, 0, 0.55, 0.55);
    wash.fillRect(0, h - 900, w, 900);

    // logo: a little pile of seeds over the title
    const seeds = ['redbean', 'corn', 'pea', 'sunflower', 'pumpkin', 'acorn', 'runner'];
    seeds.forEach((k, i) => {
      const x = w / 2 + (i - 3) * 110;
      const y = 300 + Math.abs(i - 3) * 18;
      const s = this.add.image(x, y - 300, ITEM_TEX(k)).setScale(0.55).setAngle(-18 + i * 6);
      this.tweens.add({ targets: s, y, duration: 650, delay: 100 + i * 70, ease: 'Bounce.easeOut' });
    });
    const title = this.add
      .text(w / 2, 470, 'Seed Sort', { fontFamily: THEME.font, fontSize: '170px', fontStyle: '800', color: '#3e7f2f' })
      .setOrigin(0.5)
      .setStroke('#ffffff', 18);
    title.setShadow(0, 10, 'rgba(62,127,47,0.35)', 0, true, true);
    popIn(this, title, 200);
    this.add
      .text(w / 2, 610, 'Catch every seed. Grow your garden.', {
        fontFamily: THEME.font,
        fontSize: '44px',
        fontStyle: '700',
        color: THEME.ink,
      })
      .setOrigin(0.5)
      .setStroke('#fff8ea', 10);

    const level = save.get().level;
    const play = makeButton(
      this,
      w / 2,
      h - 520,
      level === 1 ? 'Play' : `Play  ·  Level ${level}`,
      () => {
        audio.unlock();
        audio.tap();
        haptics.fire('light');
        goToLevel(this, save.get().level);
      },
      { width: 660, height: 170, fontSize: 64, theme: THEME },
    );
    this.tweens.add({ targets: play, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 800 });

    const found = Object.keys(save.get().garden).length;
    makeButton(
      this,
      w / 2,
      h - 320,
      found > 0 ? `My Garden  ·  ${found} plants` : 'My Garden',
      () => {
        audio.unlock();
        audio.tap();
        this.scene.start('garden', { from: 'menu' });
      },
      { width: 660, height: 130, fontSize: 46, ...SECONDARY, theme: THEME },
    );
    const best = save.get().bestScore;
    if (best > 0) {
      this.add
        .text(w / 2, h - 190, `Best score  ${best.toLocaleString()}`, { fontFamily: THEME.font, fontSize: '38px', fontStyle: '700', color: '#fff8ea' })
        .setOrigin(0.5);
    }

    const soundBtn = makeIconButton(
      this,
      w - 100,
      100,
      (g) => this.drawSpeaker(g, save.get().settings.sound),
      () => {
        save.update((d) => (d.settings.sound = !d.settings.sound));
        applySettings();
        audio.unlock();
        audio.tap();
        this.drawSpeaker(soundBtn.list[1] as Phaser.GameObjects.Graphics, save.get().settings.sound);
      },
      { size: 104, theme: THEME },
    );

    this.add
      .text(w / 2, h - 80, 'THE GENETIC STANDARD', { fontFamily: THEME.font, fontSize: '28px', fontStyle: '700', color: '#efe2c8' })
      .setOrigin(0.5)
      .setLetterSpacing(8);
  }

  private drawSpeaker(g: Phaser.GameObjects.Graphics, on: boolean): void {
    const c = THEME.icon;
    g.clear();
    g.fillStyle(c, 1);
    g.fillRect(-24, -10, 14, 20);
    g.fillTriangle(-12, -10, 8, -26, 8, 26);
    g.fillTriangle(-12, -10, -12, 10, 8, 26);
    g.lineStyle(6, c, 1);
    if (on) {
      g.beginPath();
      g.arc(12, 0, 14, -0.9, 0.9);
      g.strokePath();
      g.beginPath();
      g.arc(12, 0, 26, -0.9, 0.9);
      g.strokePath();
    } else {
      g.lineBetween(18, -12, 36, 12);
      g.lineBetween(36, -12, 18, 12);
    }
  }
}
