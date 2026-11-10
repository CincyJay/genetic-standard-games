import Phaser from 'phaser';
import { makeButton, makeIconButton, popIn, shake } from '@tgs/kit';
import { SEED_TEX_H, SEED_TEX_W, drawJar, drawSprout } from '../art.ts';
import { getLevel } from '../levels.ts';
import { starsFor, type Level } from '../logic/generator.ts';
import { canMove, isPotComplete, isSolved, moveCount, topRunLength, usefulMoves, type Board } from '../logic/rules.ts';
import { hint } from '../logic/solver.ts';
import { SEED_COLORS, SEED_TEX, THEME, ads, analytics, audio, haptics, save } from '../services.ts';
import { drawBackground } from './background.ts';

interface Jar {
  x: number;
  bottom: number;
  top: number;
  g: Phaser.GameObjects.Graphics;
  sprout: Phaser.GameObjects.Graphics | null;
}

interface HistoryEntry {
  from: number;
  to: number;
  count: number;
}

const TUTORIAL_TEXT = [
  'Tap a jar to lift its top seeds',
  'Now tap a jar to drop them in.\nColors must match, or use an empty jar',
  'Fill every jar with a single color!',
];

export class GameScene extends Phaser.Scene {
  private level!: Level;
  private board!: Board;
  private seeds: Phaser.GameObjects.Image[][] = [];
  private jars: Jar[] = [];
  private selected: number | null = null;
  private busy = false;
  private history: HistoryEntry[] = [];
  private moves = 0;
  private undos = 0;
  private dropStep = 0;
  private startedAt = 0;
  private won = false;

  // layout
  private jarW = 0;
  private jarH = 0;
  private seedScale = 1;
  private seedH = 0;
  private step = 0;
  private padBottom = 0;

  private movesText!: Phaser.GameObjects.Text;
  private tutorialText: Phaser.GameObjects.Text | null = null;
  private tutorialArrow: Phaser.GameObjects.Graphics | null = null;
  private toast: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('game');
  }

  init(data: { level?: number }): void {
    this.level = getLevel(data.level ?? save.get().level);
    this.board = { capacity: this.level.capacity, pots: this.level.pots.map((p) => p.slice()) };
    this.seeds = [];
    this.jars = [];
    this.selected = null;
    this.busy = false;
    this.history = [];
    this.moves = 0;
    this.undos = 0;
    this.dropStep = 0;
    this.won = false;
    this.tutorialText = null;
    this.tutorialArrow = null;
    this.toast = null;
  }

  create(): void {
    drawBackground(this);
    this.layoutBoard();
    this.buildHud();
    if (this.level.id === 1) this.startTutorial();
    this.startedAt = this.time.now;
    analytics.track('level_start', { level: this.level.id, attempt: 1 });
    this.exposeTestHooks();
  }

  // ---------------------------------------------------------------- layout
  private layoutBoard(): void {
    const { width: w } = this.scale;
    const n = this.board.pots.length;
    const rows = n <= 6 ? 1 : 2;
    const perRow = Math.ceil(n / rows);
    const gap = perRow <= 4 ? 60 : 30;
    this.jarW = Math.min(170, (980 - (perRow - 1) * gap) / perRow);
    this.seedScale = (this.jarW * 0.8) / SEED_TEX_W;
    this.seedH = SEED_TEX_H * this.seedScale;
    this.step = this.seedH * 0.8;
    this.padBottom = this.jarW * 0.14;
    this.jarH = this.board.capacity * this.step + this.padBottom + this.step * 0.55;

    const rowBottoms = rows === 1 ? [1180] : [880, 1480];
    let index = 0;
    for (let r = 0; r < rows; r++) {
      const count = r === 0 ? perRow : n - perRow;
      const rowW = count * this.jarW + (count - 1) * gap;
      for (let c = 0; c < count; c++) {
        const x = w / 2 - rowW / 2 + this.jarW / 2 + c * (this.jarW + gap);
        this.createJar(index++, x, rowBottoms[r]!);
      }
    }
  }

  private createJar(p: number, x: number, bottom: number): void {
    const g = this.add.graphics({ x, y: bottom });
    drawJar(g, this.jarW, this.jarH, false);
    const jar: Jar = { x, bottom, top: bottom - this.jarH, g, sprout: null };
    this.jars[p] = jar;

    // Generous tap area: the jar plus the space above it where seeds are lifted.
    const zoneH = this.jarH + this.step * 2.2;
    const zone = this.add.zone(x, bottom - zoneH / 2 + 20, this.jarW + 24, zoneH).setInteractive();
    zone.on('pointerdown', () => this.onTap(p));

    this.seeds[p] = this.board.pots[p]!.map((color, i) => {
      const s = this.add.image(x, this.seedY(p, i), SEED_TEX(color)).setScale(this.seedScale);
      s.setDepth(2);
      // entrance: seeds drop in, staggered
      const y = s.y;
      s.y = y - 400;
      s.alpha = 0;
      this.tweens.add({ targets: s, y, alpha: 1, duration: 420, delay: p * 40 + i * 50, ease: 'Bounce.easeOut' });
      return s;
    });
  }

  private seedY(p: number, i: number): number {
    return this.jars[p]!.bottom - this.padBottom - this.seedH / 2 - i * this.step;
  }

  private liftY(p: number, i: number, runStart: number): number {
    return this.jars[p]!.top - this.seedH / 2 - 26 - (i - runStart) * this.step;
  }

  // ------------------------------------------------------------------- HUD
  private buildHud(): void {
    const { width: w, height: h } = this.scale;
    makeIconButton(this, 110, 120, (g) => this.iconHome(g), () => {
      audio.tap();
      this.scene.start('menu');
    });

    this.add
      .text(w / 2, 110, `Level ${this.level.id}`, {
        fontFamily: THEME.font,
        fontSize: '84px',
        fontStyle: '900',
        color: THEME.ink,
      })
      .setOrigin(0.5);
    this.movesText = this.add
      .text(w / 2, 200, '', { fontFamily: THEME.font, fontSize: '42px', fontStyle: '800', color: THEME.inkSoft })
      .setOrigin(0.5);
    this.updateMovesText();

    const y = h - 190;
    makeIconButton(this, w / 2 - 300, y, (g) => this.iconRestart(g), () => this.restart(), { size: 140 });
    makeIconButton(this, w / 2, y, (g) => this.iconBulb(g), () => this.showHint(), { size: 160, color: 0xffd36b, shadow: 0xe0a83a });
    makeIconButton(this, w / 2 + 300, y, (g) => this.iconUndo(g), () => this.undo(), { size: 140 });
    const label = (x: number, t: string) =>
      this.add
        .text(x, y + 112, t, { fontFamily: THEME.font, fontSize: '34px', fontStyle: '800', color: THEME.inkSoft })
        .setOrigin(0.5);
    label(w / 2 - 300, 'Restart');
    label(w / 2, 'Hint');
    label(w / 2 + 300, 'Undo');
  }

  private updateMovesText(): void {
    this.movesText.setText(`Moves ${this.moves}  ·  Target ${this.level.par}`);
  }

  // ----------------------------------------------------------------- input
  private onTap(p: number): void {
    if (this.busy || this.won) return;
    audio.unlock();
    const pot = this.board.pots[p]!;

    if (this.selected === null) {
      if (pot.length === 0 || isPotComplete(pot, this.board.capacity)) {
        this.reject(p);
        return;
      }
      this.select(p);
      return;
    }
    if (this.selected === p) {
      this.deselect();
      return;
    }
    if (canMove(this.board, this.selected, p)) {
      this.executeMove(this.selected, p);
      return;
    }
    // Tapped a jar that can't take the seeds: if it has its own seeds, switch to it.
    if (pot.length > 0 && !isPotComplete(pot, this.board.capacity) && pot.length < this.board.capacity) {
      this.deselect();
      this.select(p);
      return;
    }
    this.reject(p);
    this.deselect();
  }

  private select(p: number): void {
    this.selected = p;
    const pot = this.board.pots[p]!;
    const runStart = pot.length - topRunLength(pot);
    for (let i = runStart; i < pot.length; i++) {
      const s = this.seeds[p]![i]!;
      this.tweens.killTweensOf(s);
      this.tweens.add({ targets: s, y: this.liftY(p, i, runStart), duration: 150, ease: 'Back.easeOut' });
    }
    drawJar(this.jars[p]!.g, this.jarW, this.jarH, true);
    audio.lift();
    haptics.fire('light');
    this.advanceTutorial(1);
  }

  private deselect(): void {
    const p = this.selected;
    if (p === null) return;
    this.selected = null;
    this.seeds[p]!.forEach((s, i) => {
      this.tweens.killTweensOf(s);
      this.tweens.add({ targets: s, y: this.seedY(p, i), duration: 160, ease: 'Quad.easeIn' });
    });
    drawJar(this.jars[p]!.g, this.jarW, this.jarH, false);
  }

  private reject(p: number): void {
    audio.invalid();
    haptics.fire('error');
    shake(this, this.jars[p]!.g);
    this.seeds[p]!.forEach((s) => shake(this, s));
  }

  // ----------------------------------------------------------------- moves
  private executeMove(from: number, to: number): void {
    const count = moveCount(this.board, from, to);
    this.history.push({ from, to, count });
    this.moves++;
    this.updateMovesText();
    this.selected = null;
    drawJar(this.jars[from]!.g, this.jarW, this.jarH, false);
    this.transfer(from, to, count, () => this.afterMove(to));
    this.advanceTutorial(2);
  }

  /**
   * Moves `count` seeds from the top of `from` onto `to` (board + sprites),
   * flying each seed along an arc. Does not check rules (undo reuses it).
   */
  private transfer(from: number, to: number, count: number, done: () => void): void {
    this.busy = true;
    const src = this.board.pots[from]!;
    const dst = this.board.pots[to]!;
    const srcSprites = this.seeds[from]!;
    const dstSprites = this.seeds[to]!;
    const startIndex = dst.length;

    // Taking seeds out of a finished jar un-finishes it.
    this.removeSprout(from);

    let landed = 0;
    for (let k = 0; k < count; k++) {
      dst.push(src.pop()!);
      const sprite = srcSprites.pop()!;
      dstSprites.push(sprite);
      const destIndex = startIndex + k;
      const x0 = sprite.x;
      const y0 = sprite.y;
      const x1 = this.jars[to]!.x;
      const y1 = this.seedY(to, destIndex);
      const peak = Math.min(y0, this.jars[to]!.top) - 140 - k * 10;
      this.tweens.killTweensOf(sprite);
      sprite.setDepth(5 + k);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 300 + Math.min(160, Math.abs(x1 - x0) * 0.25),
        delay: k * 70,
        ease: 'Sine.easeInOut',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          const u = 1 - t;
          sprite.x = u * u * x0 + 2 * u * t * ((x0 + x1) / 2) + t * t * x1;
          sprite.y = u * u * y0 + 2 * u * t * peak + t * t * y1;
          sprite.angle = Math.sin(t * Math.PI) * 25 * Math.sign(x1 - x0);
        },
        onComplete: () => {
          sprite.setPosition(x1, y1).setAngle(0).setDepth(2);
          this.tweens.add({
            targets: sprite,
            scaleY: { from: this.seedScale * 0.78, to: this.seedScale },
            scaleX: { from: this.seedScale * 1.15, to: this.seedScale },
            duration: 220,
            ease: 'Back.easeOut',
          });
          audio.drop(this.dropStep++);
          haptics.fire('light');
          landed++;
          if (landed === count) done();
        },
      });
    }
    // Any lifted seeds that didn't fit drop back into their jar.
    srcSprites.forEach((s, i) => {
      if (s.y < this.seedY(from, i) - 1) {
        this.tweens.add({ targets: s, y: this.seedY(from, i), duration: 180, delay: count * 70, ease: 'Quad.easeIn' });
      }
    });
  }

  private afterMove(to: number): void {
    this.busy = false;
    if (isPotComplete(this.board.pots[to]!, this.board.capacity)) this.celebratePot(to);
    if (isSolved(this.board)) {
      this.win();
      return;
    }
    if (usefulMoves(this.board).length === 0) this.showToast('No moves left. Try Undo or Restart');
  }

  private undo(): void {
    if (this.busy || this.won) return;
    const last = this.history.pop();
    if (!last) {
      this.showToast('Nothing to undo');
      return;
    }
    this.deselect();
    audio.tap();
    this.undos++;
    this.moves++;
    this.updateMovesText();
    // Week 3: free undos per level are limited; more via a rewarded ad (opt-in).
    this.transfer(last.to, last.from, last.count, () => {
      this.busy = false;
      if (isPotComplete(this.board.pots[last.from]!, this.board.capacity)) this.celebratePot(last.from);
    });
  }

  private restart(): void {
    if (this.won) return;
    audio.tap();
    analytics.track('level_restart', { level: this.level.id, moves: this.moves });
    this.scene.restart({ level: this.level.id });
  }

  private showHint(): void {
    if (this.busy || this.won) return;
    this.deselect();
    const m = hint(this.board);
    if (!m) {
      this.showToast('No hint from here. Try Undo');
      return;
    }
    audio.tap();
    // Week 3: hints become a rewarded-ad offer after a few free ones.
    this.pulseJar(m.from, 0xffd36b);
    this.time.delayedCall(350, () => this.pulseJar(m.to, 0x6bcb77));
    this.pointArrowAt(m.from);
  }

  // ----------------------------------------------------------- celebration
  private celebratePot(p: number): void {
    const jar = this.jars[p]!;
    const color = SEED_COLORS[this.board.pots[p]![0]!]!;
    audio.complete();
    haptics.fire('medium');
    this.burst(jar.x, jar.top, [color, 0xffffff, 0xfff2b3], 18);
    const sprout = this.add.graphics({ x: jar.x, y: jar.top - 4 }).setDepth(1);
    drawSprout(sprout, color);
    sprout.setScale(0);
    this.tweens.add({ targets: sprout, scale: this.jarW / 150, duration: 500, ease: 'Back.easeOut' });
    jar.sprout = sprout;
    this.seeds[p]!.forEach((s, i) =>
      this.tweens.add({ targets: s, y: s.y - 18, duration: 120, delay: i * 40, yoyo: true, ease: 'Quad.easeOut' }),
    );
  }

  private removeSprout(p: number): void {
    const sprout = this.jars[p]!.sprout;
    if (!sprout) return;
    this.jars[p]!.sprout = null;
    this.tweens.add({ targets: sprout, scale: 0, duration: 150, onComplete: () => sprout.destroy() });
  }

  private burst(x: number, y: number, tints: number[], qty: number): void {
    const e = this.add.particles(x, y, 'petal', {
      speed: { min: 250, max: 650 },
      angle: { min: 200, max: 340 },
      gravityY: 900,
      lifespan: 1100,
      scale: { start: 1.1, end: 0.3 },
      rotate: { min: 0, max: 360 },
      alpha: { start: 1, end: 0 },
      tint: tints,
      emitting: false,
    });
    e.setDepth(20);
    e.explode(qty);
    this.time.delayedCall(1300, () => e.destroy());
  }

  private win(): void {
    this.won = true;
    this.clearTutorial();
    const stars = starsFor(this.moves, this.level.par);
    const seconds = Math.round((this.time.now - this.startedAt) / 1000);
    const id = this.level.id;
    save.update((d) => {
      d.stars[id] = Math.max(d.stars[id] ?? 0, stars);
      if (d.level <= id) {
        d.level = id + 1;
        d.levelsCompleted++;
      }
    });
    analytics.track('level_complete', { level: id, moves: this.moves, seconds, stars, undos: this.undos });

    const { width: w } = this.scale;
    this.time.delayedCall(250, () => {
      audio.win();
      haptics.fire('success');
      this.burst(w * 0.25, 700, SEED_COLORS, 30);
      this.burst(w * 0.75, 700, SEED_COLORS, 30);
    });
    this.time.delayedCall(900, () => this.showWinPanel(stars));
  }

  private showWinPanel(stars: number): void {
    const { width: w, height: h } = this.scale;
    const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x3b2f2a, 0).setDepth(30).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.35, duration: 250 });

    const panel = this.add.container(w / 2, h / 2).setDepth(31);
    const bg = this.add.graphics();
    bg.fillStyle(0xe8d9c6, 1);
    bg.fillRoundedRect(-420, -380 + 14, 840, 760, 60);
    bg.fillStyle(0xffffff, 1);
    bg.fillRoundedRect(-420, -380, 840, 760, 60);
    const title = this.add
      .text(0, -270, 'Level Complete!', { fontFamily: THEME.font, fontSize: '80px', fontStyle: '900', color: '#4f9a52' })
      .setOrigin(0.5);
    panel.add([bg, title]);

    for (let i = 0; i < 3; i++) {
      const star = this.add.graphics({ x: (i - 1) * 190, y: -90 + (i === 1 ? -30 : 0) });
      this.drawStar(star, i < stars ? 0xffc93c : 0xeee3d6, i < stars ? 0xe0a83a : 0xddd0c0);
      panel.add(star);
      star.setScale(0);
      this.tweens.add({
        targets: star,
        scale: i === 1 ? 1.25 : 1,
        duration: 420,
        delay: 300 + i * 220,
        ease: 'Back.easeOut',
        onStart: () => {
          if (i < stars) audio.drop(i * 3);
        },
      });
    }
    const info = this.add
      .text(0, 90, `${this.moves} moves  ·  target ${this.level.par}`, {
        fontFamily: THEME.font,
        fontSize: '44px',
        fontStyle: '800',
        color: THEME.inkSoft,
      })
      .setOrigin(0.5);
    panel.add(info);

    const next = makeButton(
      this,
      0,
      240,
      'Next',
      async () => {
        audio.tap();
        await ads.atBreak('level_complete', save.get().levelsCompleted);
        this.scene.restart({ level: this.level.id + 1 });
      },
      { width: 520, height: 160, fontSize: 72, theme: THEME },
    );
    panel.add(next);
    popIn(this, panel);
  }

  // ---------------------------------------------------------- tutorial/ui
  private startTutorial(): void {
    const { width: w } = this.scale;
    this.tutorialText = this.add
      .text(w / 2, 360, TUTORIAL_TEXT[0]!, {
        fontFamily: THEME.font,
        fontSize: '50px',
        fontStyle: '800',
        color: THEME.ink,
        align: 'center',
        wordWrap: { width: 940 },
      })
      .setOrigin(0.5);
    analytics.track('tutorial_step', { step: 0 });
    this.time.delayedCall(700, () => this.pointTutorialArrow());
  }

  /** Point at the jar the player should tap next, following the solver's plan. */
  private pointTutorialArrow(): void {
    if (!this.tutorialText || this.won) return;
    const m = hint(this.board);
    if (!m) return;
    if (this.selected === null) {
      this.pointArrowAt(m.from);
      return;
    }
    const target =
      m.from === this.selected ? m.to : this.board.pots.findIndex((_, t) => canMove(this.board, this.selected!, t));
    if (target >= 0) this.pointArrowAt(target);
  }

  private advanceTutorial(step: number): void {
    if (!this.tutorialText) return;
    this.tutorialText.setText(TUTORIAL_TEXT[step] ?? '');
    analytics.track('tutorial_step', { step });
    if (step === 1) this.pointTutorialArrow();
    else this.tutorialArrow?.setVisible(false);
  }

  private clearTutorial(): void {
    this.tutorialText?.destroy();
    this.tutorialArrow?.destroy();
    this.tutorialText = null;
    this.tutorialArrow = null;
  }

  private pointArrowAt(p: number): void {
    const jar = this.jars[p];
    if (!jar) return;
    if (!this.tutorialArrow) {
      this.tutorialArrow = this.add.graphics().setDepth(25);
      const g = this.tutorialArrow;
      g.fillStyle(0xff8c42, 1);
      g.fillTriangle(-34, -40, 34, -40, 0, 10);
      g.fillRoundedRect(-14, -96, 28, 64, 10);
    }
    const a = this.tutorialArrow;
    this.tweens.killTweensOf(a);
    a.setVisible(true).setPosition(jar.x, jar.top - this.step * 2.4);
    this.tweens.add({ targets: a, y: a.y + 30, duration: 420, yoyo: true, repeat: 5, ease: 'Sine.easeInOut' });
  }

  private pulseJar(p: number, color: number): void {
    const jar = this.jars[p]!;
    const ring = this.add.graphics({ x: jar.x, y: jar.bottom - this.jarH / 2 }).setDepth(1);
    ring.lineStyle(10, color, 1);
    ring.strokeRoundedRect(-this.jarW / 2 - 14, -this.jarH / 2 - 24, this.jarW + 28, this.jarH + 40, 30);
    this.tweens.add({ targets: ring, alpha: { from: 1, to: 0 }, duration: 450, repeat: 2, onComplete: () => ring.destroy() });
  }

  private showToast(message: string): void {
    this.toast?.destroy();
    const { width: w } = this.scale;
    const text = this.add
      .text(0, 0, message, { fontFamily: THEME.font, fontSize: '44px', fontStyle: '800', color: '#ffffff' })
      .setOrigin(0.5);
    const bg = this.add.graphics();
    bg.fillStyle(0x3b2f2a, 0.88);
    bg.fillRoundedRect(-text.width / 2 - 40, -50, text.width + 80, 100, 50);
    const c = this.add.container(w / 2, 330, [bg, text]).setDepth(40);
    this.toast = c;
    popIn(this, c);
    this.time.delayedCall(2200, () => {
      if (this.toast === c) this.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => c.destroy() });
    });
  }

  // ----------------------------------------------------------------- icons
  private iconHome(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x6b5a50, 1);
    g.fillTriangle(-30, -2, 30, -2, 0, -30);
    g.fillRect(-20, -4, 40, 30);
    g.fillStyle(0xffffff, 1);
    g.fillRect(-7, 8, 14, 18);
  }

  private iconRestart(g: Phaser.GameObjects.Graphics): void {
    g.lineStyle(10, 0x6b5a50, 1);
    g.beginPath();
    g.arc(0, 0, 28, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(250));
    g.strokePath();
    g.fillStyle(0x6b5a50, 1);
    g.fillTriangle(8, -42, 28, -18, 30, -46);
  }

  private iconUndo(g: Phaser.GameObjects.Graphics): void {
    g.lineStyle(10, 0x6b5a50, 1);
    g.beginPath();
    g.arc(4, 8, 26, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(110));
    g.strokePath();
    g.fillStyle(0x6b5a50, 1);
    g.fillTriangle(-26, -18, 6, -38, 6, 2);
  }

  private iconBulb(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, -10, 30);
    g.fillRect(-14, 10, 28, 20);
    g.fillStyle(0xb7791f, 1);
    g.fillRoundedRect(-16, 28, 32, 14, 6);
  }

  private drawStar(g: Phaser.GameObjects.Graphics, fill: number, shadow: number): void {
    const pts = (r1: number, r2: number, dy: number) => {
      const out: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? r1 : r2;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        out.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r + dy));
      }
      return out;
    };
    g.fillStyle(shadow, 1);
    g.fillPoints(pts(80, 38, 8), true);
    g.fillStyle(fill, 1);
    g.fillPoints(pts(80, 38, 0), true);
  }

  // ------------------------------------------------------------ test hooks
  /** Lets automated play-tests read state and tap jars like a real player. */
  private exposeTestHooks(): void {
    const scene = this;
    (globalThis as Record<string, unknown>).__seedSort = {
      state: () => ({
        level: scene.level.id,
        moves: scene.moves,
        selected: scene.selected,
        busy: scene.busy,
        won: scene.won,
        pots: scene.board.pots.map((p) => p.slice()),
      }),
      /** Page (CSS pixel) coordinates of the center of jar p. */
      jarPoint: (p: number) => {
        const jar = scene.jars[p]!;
        const b = scene.scale.canvasBounds;
        const sx = b.width / scene.scale.width;
        const sy = b.height / scene.scale.height;
        return { x: b.x + jar.x * sx, y: b.y + (jar.bottom - scene.jarH / 2) * sy };
      },
      solve: () => hint(scene.board, 60_000),
    };
  }
}
