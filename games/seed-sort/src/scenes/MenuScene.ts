import Phaser from 'phaser';
import { makeButton, makeIconButton } from '@tgs/kit';
import { SEED_TEX_H, SEED_TEX_W, drawJar } from '../art.ts';
import { SEED_TEX, THEME, applySettings, audio, haptics, save } from '../services.ts';
import { goToLevel } from '../navigation.ts';
import { STORY_LAST_LEVEL, chapterProgress } from '../story.ts';
import { drawBackground } from './background.ts';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    drawBackground(this);
    this.drawLogoMark(w / 2, h * 0.36);

    const title = this.add
      .text(w / 2, h * 0.45, 'Seed Sort', {
        fontFamily: THEME.font,
        fontSize: '150px',
        fontStyle: '800',
        color: THEME.ink,
      })
      .setOrigin(0.5);
    title.setLetterSpacing(-2);

    this.drawChapterProgress(w / 2, h * 0.45 + 120);

    const level = save.get().level;
    makeButton(
      this,
      w / 2,
      h * 0.66,
      level === 1 ? 'Play' : `Play  ·  Level ${level}`,
      () => {
        audio.unlock();
        audio.tap();
        haptics.fire('light');
        goToLevel(this, save.get().level);
      },
      { width: 620, height: 150, fontSize: 60, theme: THEME },
    );

    const found = Object.keys(save.get().garden).length;
    makeButton(
      this,
      w / 2,
      h * 0.66 + 190,
      found > 0 ? `Garden  ·  ${found} plants` : 'Garden',
      () => {
        audio.unlock();
        audio.tap();
        this.scene.start('garden', { from: 'menu' });
      },
      { width: 620, height: 120, fontSize: 44, color: 0x2c3a57, shadow: THEME.surfaceEdge, textColor: THEME.ink, theme: THEME },
    );

    const soundBtn = makeIconButton(
      this,
      w - 110,
      120,
      (g) => this.drawSpeaker(g, save.get().settings.sound),
      () => {
        save.update((d) => (d.settings.sound = !d.settings.sound));
        applySettings();
        audio.unlock();
        audio.tap();
        this.drawSpeaker(soundBtn.list[1] as Phaser.GameObjects.Graphics, save.get().settings.sound);
      },
      { size: 110, theme: THEME },
    );

    this.add
      .text(w / 2, h - 80, 'THE GENETIC STANDARD', {
        fontFamily: THEME.font,
        fontSize: '28px',
        fontStyle: '500',
        color: '#4c5a76',
      })
      .setOrigin(0.5)
      .setLetterSpacing(8);
  }

  /** "Chapter 2 · The Glass House" with a progress bar, or a tagline before the story starts / after it ends. */
  private drawChapterProgress(cx: number, y: number): void {
    const level = save.get().level;
    const p = chapterProgress(level);
    const style = { fontFamily: THEME.font, fontSize: '42px', fontStyle: '500', color: THEME.inkSoft };
    if (!p) {
      const t = level > STORY_LAST_LEVEL ? 'Larkspur Gardens is open. More chapters soon.' : 'Sort the seeds. Grow your garden.';
      this.add.text(cx, y, t, style).setOrigin(0.5);
      return;
    }
    this.add.text(cx, y, `Chapter ${p.chapter.id}  ·  ${p.chapter.title}`, style).setOrigin(0.5);
    const barW = 520;
    const g = this.add.graphics();
    g.fillStyle(THEME.surface, 1);
    g.fillRoundedRect(cx - barW / 2, y + 50, barW, 18, 9);
    if (p.done > 0) {
      g.fillStyle(THEME.primary, 1);
      g.fillRoundedRect(cx - barW / 2, y + 50, Math.max(18, (barW * p.done) / p.total), 18, 9);
    }
  }

  /** Three sorted slots: the game in one glance. */
  private drawLogoMark(cx: number, bottom: number): void {
    const slotW = 104;
    const scale = (slotW * 0.8) / SEED_TEX_W;
    const step = SEED_TEX_H * scale * 0.8;
    const slotH = 3 * step + 40;
    const colors = [0, 1, 2];
    colors.forEach((color, i) => {
      const x = cx + (i - 1) * (slotW + 34);
      const g = this.add.graphics({ x, y: bottom });
      drawJar(g, slotW, slotH, false, i === 1 ? 0x3ddc84 : undefined);
      for (let k = 0; k < 3; k++) {
        const s = this.add.image(x, bottom - 14 - (SEED_TEX_H * scale) / 2 - k * step, SEED_TEX(color)).setScale(scale);
        s.alpha = 0;
        this.tweens.add({ targets: s, alpha: 1, y: { from: s.y - 40, to: s.y }, duration: 380, delay: 120 + i * 90 + k * 60, ease: 'Cubic.easeOut' });
      }
    });
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
