import Phaser from 'phaser';
import { makeButton, makeIconButton, popIn } from '@tgs/kit';
import { SEED_COLORS, SEED_TEX, THEME, applySettings, audio, haptics, save } from '../services.ts';
import { drawBackground } from './background.ts';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    drawBackground(this);

    // Title
    const title = this.add
      .text(w / 2, h * 0.27, 'Seed\nSort', {
        fontFamily: THEME.font,
        fontSize: '200px',
        fontStyle: '900',
        color: '#4f9a52',
        align: 'center',
        lineSpacing: -40,
      })
      .setOrigin(0.5);
    title.setStroke('#ffffff', 22);
    title.setShadow(0, 12, 'rgba(79,154,82,0.25)', 0, true, true);
    popIn(this, title);

    // Bobbing decorative seeds around the title
    const spots = [
      [0.16, 0.14], [0.84, 0.16], [0.12, 0.36], [0.88, 0.38], [0.3, 0.07], [0.72, 0.06],
    ] as const;
    spots.forEach(([fx, fy], i) => {
      const s = this.add.image(w * fx, h * fy, SEED_TEX(i % SEED_COLORS.length)).setScale(0.9).setAngle(-20 + i * 9);
      this.tweens.add({
        targets: s,
        y: s.y - 24,
        angle: s.angle + 10,
        duration: 1600 + i * 170,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    const level = save.get().level;
    const play = makeButton(
      this,
      w / 2,
      h * 0.58,
      level === 1 ? 'Play' : `Level ${level}`,
      () => {
        audio.unlock();
        audio.tap();
        haptics.fire('light');
        this.scene.start('game', { level: save.get().level });
      },
      { width: 620, height: 170, fontSize: 76, theme: THEME },
    );
    popIn(this, play, 150);
    this.tweens.add({ targets: play, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 600 });

    const done = save.get().levelsCompleted;
    this.add
      .text(w / 2, h * 0.67, done > 0 ? `${done} levels grown` : 'Sort the seeds. Grow the garden.', {
        fontFamily: THEME.font,
        fontSize: '44px',
        fontStyle: '800',
        color: THEME.inkSoft,
      })
      .setOrigin(0.5);

    // Sound toggle
    const soundBtn = makeIconButton(this, w - 110, 110, (g) => this.drawSpeaker(g, save.get().settings.sound), () => {
      save.update((d) => (d.settings.sound = !d.settings.sound));
      applySettings();
      audio.unlock();
      audio.tap();
      this.drawSpeaker(soundBtn.list[1] as Phaser.GameObjects.Graphics, save.get().settings.sound);
    });

    this.add
      .text(w / 2, h - 70, 'THE GENETIC STANDARD', {
        fontFamily: THEME.font,
        fontSize: '30px',
        fontStyle: '800',
        color: '#9fb58a',
      })
      .setOrigin(0.5)
      .setLetterSpacing(6);
  }

  private drawSpeaker(g: Phaser.GameObjects.Graphics, on: boolean): void {
    g.clear();
    g.fillStyle(0x6b5a50, 1);
    g.fillRect(-26, -12, 16, 24);
    g.fillTriangle(-12, -12, 10, -30, 10, 30);
    g.fillTriangle(-12, -12, -12, 12, 10, 30);
    g.lineStyle(7, 0x6b5a50, 1);
    if (on) {
      g.beginPath();
      g.arc(14, 0, 16, -0.9, 0.9);
      g.strokePath();
      g.beginPath();
      g.arc(14, 0, 30, -0.9, 0.9);
      g.strokePath();
    } else {
      g.lineBetween(20, -14, 40, 14);
      g.lineBetween(40, -14, 20, 14);
    }
  }
}
