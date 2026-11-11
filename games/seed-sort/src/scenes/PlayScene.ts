import Phaser from 'phaser';
import { makeButton, makeIconButton, popIn, shake } from '@tgs/kit';
import {
  binAt,
  configForLevel,
  createSpawner,
  isCleared,
  isFailed,
  isSeed,
  itemPassed,
  newRun,
  speedAt,
  starsFor,
  tapItem,
  type ItemKind,
  type LevelConfig,
  type Outcome,
  type RunState,
  type SeedType,
  type Spawn,
} from '../logic/conveyor.ts';
import { goToLevel } from '../navigation.ts';
import { ITEM_TEX, SECONDARY, THEME, ads, analytics, audio, haptics, save } from '../services.ts';
import { makePackCard } from '../ui/packCard.ts';
import { STAGE_AT, STAGE_LABEL, rollPack, stageFor, type Variety } from '../varieties.ts';

// Layout (game is 1080 x 1920)
const BELT_TOP = 930; // top edge of the belt surface
const BELT_SURFACE = 90; // visible depth of the belt surface
const ITEM_Y = BELT_TOP + 30; // item centers ride here
const LANE_LEFT = 40;
const LANE_RIGHT = 1040;
const CRATE_BOTTOM = 1560;
const SPAWN_X = -90;
const EXIT_X = 1080 + 90;
const ITEM_SCALE = 0.8; // of the 240x180 texture

interface Item {
  id: number;
  kind: ItemKind;
  sprite: Phaser.GameObjects.Image;
  falling: boolean;
}

interface Crate {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Graphics;
  pile: number;
  w: number;
  h: number;
}

export class PlayScene extends Phaser.Scene {
  private cfg!: LevelConfig;
  private bins: SeedType[] = [];
  private run!: RunState;
  private spawn!: () => Spawn;
  private nextSpawn: Spawn | null = null;
  private sinceSpawn = 0;
  private sinceShuffle = 0;
  private items: Item[] = [];
  private crates: Crate[] = [];
  private nextId = 1;
  private running = false;
  private ended = false;
  private continued = false;
  private startedAt = 0;

  private tread!: Phaser.GameObjects.TileSprite;
  private scoreText!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private lifeIcons: Phaser.GameObjects.Graphics[] = [];
  private streakText!: Phaser.GameObjects.Text;
  private tip: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('play');
  }

  init(data: { level?: number }): void {
    this.cfg = configForLevel(data.level ?? save.get().level);
    this.bins = [...this.cfg.bins];
    this.run = newRun(this.cfg);
    this.spawn = createSpawner(this.cfg);
    this.nextSpawn = null;
    this.sinceSpawn = 0;
    this.sinceShuffle = 0;
    this.items = [];
    this.crates = [];
    this.nextId = 1;
    this.running = false;
    this.ended = false;
    this.continued = false;
    this.lifeIcons = [];
    this.tip = null;
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.add.image(w / 2, h / 2, 'bg-greenhouse').setDisplaySize(w, h);
    this.buildLanes();
    this.buildBelt();
    this.buildCrates();
    this.buildHud();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
    this.exposeTestHooks();
    analytics.track('level_start', { level: this.cfg.level, attempt: 1 });
    this.introBanner();
  }

  // ------------------------------------------------------------ building
  private buildBelt(): void {
    const { width: w } = this.scale;
    // tread texture: dark rubber with lighter ribs
    if (!this.textures.exists('tread')) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0x3b3531, 1);
      g.fillRect(0, 0, 64, BELT_SURFACE);
      g.fillStyle(0x4d4540, 1);
      g.fillRect(0, 0, 10, BELT_SURFACE);
      g.fillStyle(0x2c2724, 1);
      g.fillRect(10, 0, 3, BELT_SURFACE);
      g.generateTexture('tread', 64, BELT_SURFACE);
      g.destroy();
    }
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillRect(0, BELT_TOP + BELT_SURFACE + 46, w, 26);
    // legs
    const legs = this.add.graphics();
    for (let x = 120; x < w; x += 280) {
      legs.fillStyle(0x2f5640, 1);
      legs.fillRect(x - 12, BELT_TOP + BELT_SURFACE + 40, 24, 230);
      legs.fillStyle(0x3f7356, 1);
      legs.fillRect(x - 12, BELT_TOP + BELT_SURFACE + 40, 8, 230);
    }
    this.tread = this.add.tileSprite(w / 2, BELT_TOP + BELT_SURFACE / 2, w, BELT_SURFACE, 'tread');
    const frame = this.add.graphics();
    // shading on the belt surface (lighter far edge, darker near edge)
    frame.fillStyle(0xffffff, 0.08);
    frame.fillRect(0, BELT_TOP, w, 14);
    frame.fillStyle(0x000000, 0.18);
    frame.fillRect(0, BELT_TOP + BELT_SURFACE - 16, w, 16);
    // painted steel side rail (front face)
    frame.fillStyle(0x3f7356, 1);
    frame.fillRect(0, BELT_TOP + BELT_SURFACE, w, 44);
    frame.fillStyle(0x5a9c76, 1);
    frame.fillRect(0, BELT_TOP + BELT_SURFACE, w, 8);
    frame.fillStyle(0x2f5640, 1);
    frame.fillRect(0, BELT_TOP + BELT_SURFACE + 36, w, 8);
    for (let x = 30; x < w; x += 90) {
      frame.fillStyle(0x2f5640, 1);
      frame.fillCircle(x, BELT_TOP + BELT_SURFACE + 22, 6);
      frame.fillStyle(0x7fb894, 1);
      frame.fillCircle(x - 1.5, BELT_TOP + BELT_SURFACE + 20.5, 2);
    }
    // back rail
    frame.fillStyle(0x2f5640, 1);
    frame.fillRect(0, BELT_TOP - 12, w, 12);
  }

  private buildLanes(): void {
    // Faint drop lanes from the belt to each crate make the timing readable.
    const g = this.add.graphics();
    const k = this.bins.length;
    const laneW = (LANE_RIGHT - LANE_LEFT) / k;
    for (let i = 0; i < k; i++) {
      const x = LANE_LEFT + i * laneW;
      g.fillStyle(0xffffff, i % 2 === 0 ? 0.1 : 0.05);
      g.fillRect(x + 4, BELT_TOP + BELT_SURFACE + 44, laneW - 8, CRATE_BOTTOM - (BELT_TOP + BELT_SURFACE + 44) - 120);
    }
    for (let i = 1; i < k; i++) {
      const x = LANE_LEFT + i * laneW;
      for (let y = BELT_TOP + BELT_SURFACE + 60; y < CRATE_BOTTOM - 150; y += 34) {
        g.fillStyle(0xffffff, 0.35);
        g.fillRect(x - 2, y, 4, 18);
      }
    }
  }

  private laneCenter(i: number): number {
    const laneW = (LANE_RIGHT - LANE_LEFT) / this.bins.length;
    return LANE_LEFT + laneW * (i + 0.5);
  }

  private buildCrates(): void {
    const k = this.bins.length;
    const laneW = (LANE_RIGHT - LANE_LEFT) / k;
    const cw = Math.min(300, laneW * 0.95);
    const ch = (cw * 220) / 240;
    this.bins.forEach((kind, i) => {
      const glow = this.add.graphics();
      glow.fillStyle(THEME.accent, 0.5);
      glow.fillRoundedRect(-cw / 2 - 12, -ch - 14, cw + 24, ch + 22, 24);
      glow.setAlpha(0);
      const body = this.add.image(0, 0, 'crate').setOrigin(0.5, 1).setDisplaySize(cw, ch);
      const label = this.add.image(0, -ch * (84 / 220), ITEM_TEX(kind)).setScale((cw / 240) * 0.42);
      const c = this.add.container(this.laneCenter(i), CRATE_BOTTOM, [glow, body, label]);
      c.setDepth(4);
      this.crates.push({ container: c, body, glow, pile: 0, w: cw, h: ch });
    });
  }

  private buildHud(): void {
    const { width: w } = this.scale;
    makeIconButton(
      this,
      100,
      110,
      (g) => {
        g.lineStyle(9, THEME.icon, 1);
        g.lineBetween(12, -22, -12, 0);
        g.lineBetween(-12, 0, 12, 22);
      },
      () => {
        audio.tap();
        this.scene.start('menu');
      },
      { size: 104, theme: THEME },
    ).setDepth(20);

    // score card
    const card = this.add.graphics().setDepth(19);
    card.fillStyle(THEME.surfaceEdge, 1);
    card.fillRoundedRect(w / 2 - 220, 48, 440, 150, 36);
    card.fillStyle(THEME.surface, 0.96);
    card.fillRoundedRect(w / 2 - 220, 40, 440, 150, 36);
    this.add
      .text(w / 2, 82, `LEVEL ${this.cfg.level}`, { fontFamily: THEME.font, fontSize: '30px', fontStyle: '700', color: THEME.inkSoft })
      .setOrigin(0.5)
      .setLetterSpacing(4)
      .setDepth(20);
    this.scoreText = this.add
      .text(w / 2, 140, '0', { fontFamily: THEME.font, fontSize: '68px', fontStyle: '800', color: THEME.ink })
      .setOrigin(0.5)
      .setDepth(20);

    // lives: three leaves on a cream pill
    const pill = this.add.graphics().setDepth(19);
    pill.fillStyle(THEME.surfaceEdge, 1);
    pill.fillRoundedRect(w - 262, 78, 222, 92, 46);
    pill.fillStyle(THEME.surface, 0.96);
    pill.fillRoundedRect(w - 262, 72, 222, 92, 46);
    for (let i = 0; i < this.cfg.lives; i++) {
      const g = this.add.graphics({ x: w - 210 + i * 62, y: 118 }).setDepth(20);
      this.drawLeaf(g, true);
      this.lifeIcons.push(g);
    }

    // progress toward the level target
    this.progressBar = this.add.graphics().setDepth(20);
    this.progressText = this.add
      .text(w / 2, 262, '', { fontFamily: THEME.font, fontSize: '34px', fontStyle: '700', color: THEME.ink })
      .setOrigin(0.5)
      .setDepth(21);
    this.streakText = this.add
      .text(w / 2, 780, '', { fontFamily: THEME.font, fontSize: '54px', fontStyle: '800', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(21)
      .setStroke('#3e7f2f', 12);
    this.updateHud();
  }

  private drawLeaf(g: Phaser.GameObjects.Graphics, alive: boolean): void {
    g.clear();
    const fill = alive ? 0x5aa845 : 0xc9bda8;
    const vein = alive ? 0x3e7f2f : 0xa89a84;
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(2, 4, 50, 34);
    g.fillStyle(fill, 1);
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push(new Phaser.Math.Vector2(-26 + t * 52, -Math.sin(t * Math.PI) * 18));
    }
    for (let i = 20; i >= 0; i--) {
      const t = i / 20;
      pts.push(new Phaser.Math.Vector2(-26 + t * 52, Math.sin(t * Math.PI) * 18));
    }
    g.fillPoints(pts, true);
    g.lineStyle(3, vein, 1);
    g.lineBetween(-24, 0, 24, 0);
    g.setRotation(-0.5);
  }

  private updateHud(): void {
    const { width: w } = this.scale;
    this.scoreText.setText(this.run.score.toLocaleString());
    const barW = 620;
    const p = Math.min(1, this.run.sorted / this.cfg.target);
    this.progressBar.clear();
    this.progressBar.fillStyle(0x000000, 0.18);
    this.progressBar.fillRoundedRect(w / 2 - barW / 2, 242, barW, 40, 20);
    this.progressBar.fillStyle(THEME.primary, 1);
    if (p > 0) this.progressBar.fillRoundedRect(w / 2 - barW / 2, 242, Math.max(40, barW * p), 40, 20);
    this.progressText.setText(`${this.run.sorted} / ${this.cfg.target} sorted`);
    this.lifeIcons.forEach((g, i) => this.drawLeaf(g, i < this.run.lives));
  }

  // ---------------------------------------------------------------- flow
  private introBanner(): void {
    const { width: w } = this.scale;
    const c = this.add.container(w / 2, 600).setDepth(30);
    const bg = this.add.graphics();
    bg.fillStyle(THEME.surface, 0.97);
    bg.fillRoundedRect(-380, -110, 760, 220, 40);
    const t1 = this.add
      .text(0, -40, `Sort ${this.cfg.target} seeds`, { fontFamily: THEME.font, fontSize: '60px', fontStyle: '800', color: THEME.ink })
      .setOrigin(0.5);
    const sub =
      this.cfg.level === 1
        ? 'Tap a seed when it rolls over its crate'
        : this.cfg.rockChance > 0 && this.cfg.level <= 5
          ? 'New: leave the rocks alone!'
          : this.cfg.weedChance > 0 && this.cfg.level <= 7
            ? 'New: pluck weeds for bonus points'
            : this.cfg.shuffleEvery > 0 && this.cfg.level <= 11
              ? 'New: the crates move around!'
              : 'Keep your streak going';
    const t2 = this.add
      .text(0, 40, sub, { fontFamily: THEME.font, fontSize: '38px', fontStyle: '500', color: THEME.inkSoft })
      .setOrigin(0.5);
    c.add([bg, t1, t2]);
    popIn(this, c);
    this.time.delayedCall(this.cfg.level === 1 ? 2600 : 1600, () => {
      this.tweens.add({ targets: c, alpha: 0, y: 560, duration: 250, onComplete: () => c.destroy() });
      this.running = true;
      this.startedAt = this.time.now;
      if (this.cfg.level === 1) this.showTip();
    });
  }

  private showTip(): void {
    const { width: w } = this.scale;
    const c = this.add.container(w / 2, 1720).setDepth(25);
    const t = this.add
      .text(0, 0, 'Match the seed to the picture on the crate', {
        fontFamily: THEME.font,
        fontSize: '38px',
        fontStyle: '700',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#5a4634', 10);
    c.add(t);
    this.tip = c;
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.running || this.ended) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const v = speedAt(this.cfg, this.run.sorted / this.cfg.target);
    this.tread.tilePositionX -= v * dt;

    // spawning
    this.sinceSpawn += dt * 1000;
    if (!this.nextSpawn) this.nextSpawn = this.spawn();
    const last = this.items[this.items.length - 1];
    const roomy = !last || last.falling || last.sprite.x > SPAWN_X + 150;
    if (this.sinceSpawn >= this.nextSpawn.delay && roomy) {
      this.addItem(this.nextSpawn.kind);
      this.nextSpawn = null;
      this.sinceSpawn = 0;
    }

    // moving
    const laneW = (LANE_RIGHT - LANE_LEFT) / this.bins.length;
    const glowing = new Set<number>();
    for (const it of [...this.items]) {
      if (it.falling) continue;
      it.sprite.x += v * dt;
      // gentle roll for round seeds, bob for the rest
      if (it.kind === 'pea' || it.kind === 'golden') it.sprite.rotation += (v * dt) / 40;
      if (this.cfg.level <= 5 && isSeed(it.kind) && it.sprite.x > LANE_LEFT && it.sprite.x < LANE_RIGHT) {
        const lane = Math.floor((it.sprite.x - LANE_LEFT) / laneW);
        if (this.bins[lane] === it.kind) glowing.add(lane);
      }
      if (it.sprite.x > EXIT_X - 60) this.itemFellOff(it);
    }
    this.crates.forEach((c, i) => c.glow.setAlpha(glowing.has(i) ? 0.9 : 0));

    // crates shuffling
    if (this.cfg.shuffleEvery > 0) {
      this.sinceShuffle += dt * 1000;
      if (this.sinceShuffle >= this.cfg.shuffleEvery) {
        this.sinceShuffle = 0;
        this.shuffleCrates();
      }
    }
  }

  private addItem(kind: ItemKind): void {
    const sprite = this.add.image(SPAWN_X, ITEM_Y, ITEM_TEX(kind)).setScale(ITEM_SCALE).setDepth(10);
    sprite.setOrigin(0.5, 0.65);
    this.items.push({ id: this.nextId++, kind, sprite, falling: false });
  }

  private removeItem(it: Item): void {
    this.items = this.items.filter((x) => x !== it);
  }

  // --------------------------------------------------------------- input
  private onTap(p: Phaser.Input.Pointer): void {
    if (!this.running || this.ended) return;
    if (p.y < 620 || p.y > 1700) return; // HUD and floor are not the belt
    let best: Item | null = null;
    let bestD = 130;
    for (const it of this.items) {
      if (it.falling) continue;
      const d = Math.abs(it.sprite.x - p.x);
      if (d < bestD) {
        best = it;
        bestD = d;
      }
    }
    if (!best) return;
    audio.unlock();
    this.tip?.destroy();
    this.tip = null;
    const bin = binAt(best.sprite.x, this.bins.length, LANE_LEFT, LANE_RIGHT);
    const cfgNow = { ...this.cfg, bins: this.bins };
    const outcome = tapItem(this.run, cfgNow, best.kind, bin);
    this.resolve(best, bin, outcome);
  }

  private resolve(it: Item, bin: number, o: Outcome): void {
    it.falling = true;
    const s = it.sprite;
    const crate = this.crates[bin]!;
    const crateTop = CRATE_BOTTOM - crate.h;
    this.tweens.killTweensOf(s);

    if (o.kind === 'plucked') {
      audio.lift();
      haptics.fire('light');
      this.floatText(s.x, s.y - 60, `+${o.points}`, '#5aa845');
      this.burst(s.x, s.y, [0x5aa845, 0x7cbc45, 0x8a6440], 10);
      this.tweens.add({
        targets: s,
        y: s.y - 500,
        x: s.x + 120,
        angle: 220,
        alpha: 0,
        duration: 650,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          s.destroy();
          this.removeItem(it);
        },
      });
      this.updateHud();
      return;
    }

    // everything else drops into the crate below
    const targetX = crate.container.x + Phaser.Math.Between(-crate.w * 0.18, crate.w * 0.18);
    this.tweens.add({
      targets: s,
      x: targetX,
      y: crateTop + crate.h * 0.16,
      scale: ITEM_SCALE * 0.9,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => this.landed(it, crate, o),
    });
  }

  private landed(it: Item, crate: Crate, o: Outcome): void {
    const s = it.sprite;
    const crateTop = CRATE_BOTTOM - crate.h;
    if (o.kind === 'sorted' || o.kind === 'golden') {
      s.destroy();
      this.removeItem(it);
      this.addToPile(crate, o.kind === 'golden' ? 'golden' : it.kind);
      this.tweens.add({
        targets: crate.container,
        scaleY: { from: 0.9, to: 1 },
        scaleX: { from: 1.06, to: 1 },
        duration: 260,
        ease: 'Back.easeOut',
      });
      this.burst(crate.container.x, crateTop + 20, [0xd9c09a, 0xc9a77a, 0xefe2bf], 8);
      if (o.kind === 'golden') {
        audio.complete();
        haptics.fire('medium');
        this.burst(crate.container.x, crateTop, [0xffd23f, 0xfff7c2, 0xffffff], 24);
        this.floatText(crate.container.x, crateTop - 70, `+${o.points}`, '#e0a000');
      } else {
        audio.drop(o.streak);
        haptics.fire('light');
        this.floatText(crate.container.x, crateTop - 70, `+${o.points}`, '#3e7f2f');
      }
      if (o.streak >= 5 && o.streak % 5 === 0) this.streakPop(o.streak, o.multiplier);
    } else {
      // wrong crate or a rock: it bounces back out
      audio.invalid();
      haptics.fire('error');
      shake(this, crate.container);
      this.cameras.main.shake(180, 0.006);
      this.redX(crate.container.x, crateTop - 40);
      this.floatText(crate.container.x, crateTop - 110, o.kind === 'rock' ? 'Rock!' : 'Wrong crate', '#d6304f');
      this.tweens.add({
        targets: s,
        y: s.y - 160,
        x: s.x + 80,
        angle: 160,
        duration: 260,
        ease: 'Quad.easeOut',
        yoyo: false,
        onComplete: () =>
          this.tweens.add({
            targets: s,
            y: 2000,
            alpha: 0.6,
            duration: 500,
            ease: 'Quad.easeIn',
            onComplete: () => {
              s.destroy();
              this.removeItem(it);
            },
          }),
      });
      this.streakText.setText('');
    }
    this.updateHud();
    this.checkEnd();
  }

  private itemFellOff(it: Item): void {
    it.falling = true;
    const o = itemPassed(this.run, it.kind);
    const s = it.sprite;
    this.tweens.add({
      targets: s,
      x: s.x + 120,
      y: 1900,
      angle: 200,
      duration: 700,
      ease: 'Quad.easeIn',
      onComplete: () => {
        s.destroy();
        this.removeItem(it);
      },
    });
    if (o.kind === 'missed') {
      audio.invalid();
      haptics.fire('error');
      this.floatText(this.scale.width - 140, ITEM_Y - 90, 'Missed!', '#d6304f');
      this.streakText.setText('');
      this.updateHud();
      this.checkEnd();
    }
  }

  private addToPile(crate: Crate, kind: ItemKind): void {
    if (crate.pile >= 7) return;
    const i = crate.pile++;
    const px = (i % 4) * (crate.w * 0.16) - crate.w * 0.24 + (i >= 4 ? crate.w * 0.08 : 0);
    const py = -crate.h * (i >= 4 ? 0.86 : 0.8);
    const mini = this.add.image(px, py, ITEM_TEX(kind)).setScale(ITEM_SCALE * 0.45).setAngle(Phaser.Math.Between(-30, 30));
    crate.container.addAt(mini, 1);
  }

  private shuffleCrates(): void {
    const { width: w } = this.scale;
    const warn = this.add
      .text(w / 2, 1690, 'Crates moving!', { fontFamily: THEME.font, fontSize: '52px', fontStyle: '800', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(30)
      .setStroke('#d98a1f', 12);
    popIn(this, warn);
    this.time.delayedCall(700, () => {
      // rotate crates one step to the right (simple to read, still forces re-learning)
      const k = this.bins.length;
      this.bins = [this.bins[k - 1]!, ...this.bins.slice(0, k - 1)];
      this.crates = [this.crates[k - 1]!, ...this.crates.slice(0, k - 1)];
      this.crates.forEach((c, i) =>
        this.tweens.add({ targets: c.container, x: this.laneCenter(i), duration: 450, ease: 'Cubic.easeInOut' }),
      );
      audio.lift();
      this.tweens.add({ targets: warn, alpha: 0, delay: 500, duration: 300, onComplete: () => warn.destroy() });
    });
  }

  // ------------------------------------------------------------- effects
  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: THEME.font, fontSize: '46px', fontStyle: '800', color })
      .setOrigin(0.5)
      .setDepth(30)
      .setStroke('#ffffff', 10);
    this.tweens.add({ targets: t, y: y - 90, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private streakPop(streak: number, mult: number): void {
    this.streakText.setText(`${streak} in a row!  x${mult}`);
    this.streakText.setScale(0);
    this.tweens.add({ targets: this.streakText, scale: 1, duration: 300, ease: 'Back.easeOut' });
    audio.complete();
  }

  private redX(x: number, y: number): void {
    const g = this.add.graphics({ x, y }).setDepth(30);
    g.lineStyle(16, 0xd6304f, 1);
    g.lineBetween(-30, -30, 30, 30);
    g.lineBetween(30, -30, -30, 30);
    this.tweens.add({ targets: g, alpha: 0, scale: 1.4, duration: 600, onComplete: () => g.destroy() });
  }

  private burst(x: number, y: number, tints: number[], qty: number): void {
    const e = this.add.particles(x, y, 'dot', {
      speed: { min: 120, max: 420 },
      angle: { min: 200, max: 340 },
      gravityY: 900,
      lifespan: 700,
      scale: { start: 0.8, end: 0 },
      tint: tints,
      emitting: false,
    });
    e.setDepth(29);
    e.explode(qty);
    this.time.delayedCall(900, () => e.destroy());
  }

  // ----------------------------------------------------------------- end
  private checkEnd(): void {
    if (this.ended) return;
    if (isCleared(this.run, this.cfg)) this.win();
    else if (isFailed(this.run)) this.fail();
  }

  private stopBelt(): void {
    this.running = false;
    this.ended = true;
    for (const it of this.items) if (!it.falling) this.tweens.add({ targets: it.sprite, alpha: 0, duration: 300 });
  }

  private win(): void {
    this.stopBelt();
    const lvl = this.cfg.level;
    const stars = starsFor(this.run);
    const firstClear = save.get().level <= lvl;
    const pack = firstClear ? rollPack(lvl, save.get().garden) : null;
    save.update((d) => {
      d.stars[lvl] = Math.max(d.stars[lvl] ?? 0, stars);
      d.bestScore = Math.max(d.bestScore, this.run.score);
      if (firstClear) {
        d.level = lvl + 1;
        d.levelsCompleted++;
      }
      if (pack) d.garden[pack.id] = (d.garden[pack.id] ?? 0) + 1;
    });
    analytics.track('level_complete', {
      level: lvl,
      moves: this.run.sorted,
      seconds: Math.round((this.time.now - this.startedAt) / 1000),
      stars,
      undos: 0,
    });
    audio.win();
    haptics.fire('success');
    const { width: w } = this.scale;
    this.burst(w * 0.3, 700, [0x5aa845, 0xffd23f, 0xff6f91, 0x4d8dff], 30);
    this.burst(w * 0.7, 700, [0x5aa845, 0xffd23f, 0xff6f91, 0x4d8dff], 30);
    this.time.delayedCall(700, () => this.showWinPanel(stars, pack));
  }

  private fail(): void {
    this.stopBelt();
    analytics.track('level_fail', { level: this.cfg.level, moves: this.run.sorted, reason: 'lives' });
    this.time.delayedCall(500, () => this.showFailPanel());
  }

  private panel(height: number): { panel: Phaser.GameObjects.Container; top: number } {
    const { width: w, height: h } = this.scale;
    const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x2a1a10, 0).setDepth(40).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.55, duration: 250 });
    const panel = this.add.container(w / 2, h / 2).setDepth(41);
    const bg = this.add.graphics();
    bg.fillStyle(THEME.surfaceEdge, 1);
    bg.fillRoundedRect(-440, -height / 2 + 12, 880, height, 48);
    bg.fillStyle(THEME.surface, 1);
    bg.fillRoundedRect(-440, -height / 2, 880, height, 48);
    panel.add(bg);
    popIn(this, panel);
    return { panel, top: -height / 2 };
  }

  private showWinPanel(stars: number, pack: Variety | null): void {
    const { panel, top } = this.panel(pack ? 1460 : 820);
    let y = top + 110;
    panel.add(this.text(0, y, 'Level complete', 68, '800', THEME.ink));
    y += 160;
    for (let i = 0; i < 3; i++) {
      const star = this.add.graphics({ x: (i - 1) * 170, y: y + (i === 1 ? -20 : 0) });
      this.drawStar(star, i < stars ? THEME.accent : 0xe6dccb, i < stars ? 0xc98a10 : THEME.surfaceEdge);
      star.setScale(0);
      panel.add(star);
      this.tweens.add({
        targets: star,
        scale: i === 1 ? 1.05 : 0.85,
        duration: 420,
        delay: 300 + i * 200,
        ease: 'Back.easeOut',
        onStart: () => {
          if (i < stars) audio.drop(i * 3);
        },
      });
    }
    y += 140;
    panel.add(this.text(0, y, `Score ${this.run.score.toLocaleString()}  ·  best streak ${this.run.bestStreak}`, 38, '500', THEME.inkSoft));
    if (pack) {
      y += 290;
      const card = makePackCard(this, pack);
      card.setPosition(0, y);
      card.scaleX = 0;
      panel.add(card);
      this.tweens.add({
        targets: card,
        scaleX: 1,
        duration: 360,
        delay: 1000,
        ease: 'Back.easeOut',
        onStart: () => {
          audio.complete();
          haptics.fire('medium');
        },
      });
      const copies = save.get().garden[pack.id] ?? 1;
      const stage = stageFor(copies);
      const status =
        copies === 1
          ? 'New plant! Added to your garden'
          : stage === 2 && copies === STAGE_AT[2]
            ? 'Your plant is in full bloom!'
            : stage === 2
              ? `+1 seed  ·  ${copies} collected`
              : `+1 seed  ·  ${STAGE_LABEL[stage]}  ·  ${copies}/${STAGE_AT[stage + 1]} to grow`;
      y += 270;
      panel.add(this.text(0, y, status, 36, copies === 1 ? '700' : '500', copies === 1 ? '#3e7f2f' : THEME.inkSoft));
    }
    const by = -top - (pack ? 270 : 160);
    panel.add(
      makeButton(
        this,
        0,
        by,
        'Next level',
        async () => {
          audio.tap();
          await ads.atBreak('level_complete', save.get().levelsCompleted);
          goToLevel(this, this.cfg.level + 1);
        },
        { width: 560, height: 150, fontSize: 56, theme: THEME },
      ),
    );
    if (pack) {
      panel.add(
        makeButton(
          this,
          0,
          by + 160,
          'View garden',
          () => {
            audio.tap();
            this.scene.start('garden', { from: 'game', level: this.cfg.level + 1 });
          },
          { width: 560, height: 120, fontSize: 44, ...SECONDARY, theme: THEME },
        ),
      );
    }
  }

  private showFailPanel(): void {
    const canContinue = !this.continued;
    const { panel, top } = this.panel(canContinue ? 900 : 720);
    let y = top + 120;
    panel.add(this.text(0, y, 'Out of leaves!', 68, '800', THEME.ink));
    y += 100;
    panel.add(this.text(0, y, `${this.run.sorted} of ${this.cfg.target} sorted  ·  score ${this.run.score.toLocaleString()}`, 38, '500', THEME.inkSoft));
    y += 170;
    if (canContinue) {
      panel.add(
        makeButton(
          this,
          0,
          y,
          'Keep going  (+1 leaf)',
          async () => {
            audio.tap();
            analytics.track('ad_offer_shown', { placement: 'continue' });
            const ok = await ads.rewarded('continue');
            if (!ok) return;
            analytics.track('ad_rewarded_complete', { placement: 'continue' });
            this.continued = true;
            this.children.list
              .filter((o) => (o as unknown as { depth: number }).depth >= 40)
              .forEach((o) => o.destroy());
            this.run.lives = 1;
            this.ended = false;
            this.updateHud();
            this.running = true;
          },
          { width: 640, height: 150, fontSize: 48, color: THEME.accent, shadow: 0xc98a10, theme: THEME },
        ),
      );
      panel.add(this.text(0, y + 105, 'Watch a short video', 30, '500', THEME.inkSoft));
      y += 210;
    }
    panel.add(
      makeButton(this, 0, y, 'Try again', () => {
        audio.tap();
        this.scene.restart({ level: this.cfg.level });
      }, { width: 560, height: 130, fontSize: 48, theme: THEME }),
    );
    y += 160;
    panel.add(
      makeButton(this, 0, y, 'Menu', () => {
        audio.tap();
        this.scene.start('menu');
      }, { width: 560, height: 110, fontSize: 42, ...SECONDARY, theme: THEME }),
    );
  }

  private text(x: number, y: number, t: string, size: number, weight: string, color: string): Phaser.GameObjects.Text {
    return this.add.text(x, y, t, { fontFamily: THEME.font, fontSize: `${size}px`, fontStyle: weight, color }).setOrigin(0.5);
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
    g.fillPoints(pts(80, 38, 6), true);
    g.fillStyle(fill, 1);
    g.fillPoints(pts(80, 38, 0), true);
  }

  // ---------------------------------------------------------- test hooks
  /** Lets automated play-tests read the belt and tap like a real player. */
  private exposeTestHooks(): void {
    const scene = this;
    (globalThis as Record<string, unknown>).__seedSort = {
      state: () => ({
        level: scene.cfg.level,
        running: scene.running,
        ended: scene.ended,
        won: scene.ended && isCleared(scene.run, scene.cfg),
        failed: scene.ended && isFailed(scene.run),
        score: scene.run.score,
        lives: scene.run.lives,
        sorted: scene.run.sorted,
        target: scene.cfg.target,
        bins: [...scene.bins],
        items: scene.items.filter((i) => !i.falling).map((i) => ({ id: i.id, kind: i.kind, x: i.sprite.x })),
      }),
      lane: (x: number) => binAt(x, scene.bins.length, LANE_LEFT, LANE_RIGHT),
      laneBounds: () => {
        const laneW = (LANE_RIGHT - LANE_LEFT) / scene.bins.length;
        return scene.bins.map((_, i) => [LANE_LEFT + i * laneW, LANE_LEFT + (i + 1) * laneW]);
      },
      /** Page (CSS px) coordinates for a game point. */
      toPage: (x: number, y: number) => {
        const b = scene.scale.canvasBounds;
        return { x: b.x + (x * b.width) / scene.scale.width, y: b.y + (y * b.height) / scene.scale.height };
      },
      beltY: ITEM_Y,
    };
  }
}
