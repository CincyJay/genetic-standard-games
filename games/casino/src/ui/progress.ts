import Phaser from 'phaser';
import { makeButton, popIn } from '@tgs/kit';
import { WHEEL_PRIZES, levelReward, unlocksBetween } from '../logic/progression.ts';
import { DISPLAY_FONT, GOLD, THEME, applySettings, audio, fmt, haptics, player, save } from '../services.ts';
import { VH, VW, coinShower, screenDim, text } from './common.ts';
import { paintPrizeWheel } from './wheel.ts';

const PANEL = 0x1a0e22;
const BRASS = 0xc9a96a;

function modal(scene: Phaser.Scene, w: number, h: number): { panel: Phaser.GameObjects.Container; close: () => void } {
  const dim = screenDim(scene, 0.7, 300);
  const panel = scene.add.container(VW / 2, VH / 2).setDepth(301);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.5);
  g.fillRoundedRect(-w / 2, -h / 2 + 14, w, h, 40);
  g.fillStyle(PANEL, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 40);
  g.lineStyle(3, BRASS, 0.8);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 40);
  panel.add(g);
  popIn(scene, panel);
  return {
    panel,
    close: () => {
      dim.destroy();
      panel.destroy();
    },
  };
}

/** Celebrate one or more new levels (rewards were already paid). Calls `done` when dismissed. */
export function showLevelUps(scene: Phaser.Scene, levels: number[], done?: () => void): void {
  if (!levels.length) return done?.();
  const from = levels[0]! - 1;
  const to = levels[levels.length - 1]!;
  const reward = levels.reduce((s, l) => s + levelReward(l), 0);
  const unlocks = unlocksBetween(from, to);
  const { panel, close } = modal(scene, 820, 760 + unlocks.length * 70);
  const top = -(760 + unlocks.length * 70) / 2;
  panel.add(text(scene, 0, top + 110, 'LEVEL UP', 46, '800', '#ffffff').setLetterSpacing(10));
  const star = scene.add.graphics();
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 120 : 56;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r + top + 300));
  }
  star.fillStyle(0xa4700f, 1);
  star.fillPoints(pts.map((p) => new Phaser.Math.Vector2(p.x, p.y + 8)), true);
  star.fillStyle(0xffd23f, 1);
  star.fillPoints(pts, true);
  panel.add([star, text(scene, 0, top + 308, String(to), 84, '900', '#5a1a00', DISPLAY_FONT)]);
  panel.add(text(scene, 0, top + 480, `+${fmt(reward)} coins`, 56, '800', GOLD));
  unlocks.forEach((u, i) => panel.add(text(scene, 0, top + 560 + i * 70, `Unlocked: ${u.name}`, 36, '700', '#7dff9a')));
  // test hook: where the Collect button is, while this is open
  (globalThis as Record<string, unknown>).__levelUp = { collectY: VH / 2 - top - 110 };
  panel.add(
    makeButton(scene, 0, -top - 110, 'Collect', () => {
      audio.tap();
      (globalThis as Record<string, unknown>).__levelUp = null;
      close();
      done?.();
    }, { width: 460, height: 130, fontSize: 50, theme: THEME }),
  );
  audio.win();
  haptics.fire('success');
  coinShower(scene, VW / 2, VH / 2, reward);
}

/** Today's three missions with progress bars and claim buttons. */
export function showMissions(scene: Phaser.Scene, refresh: () => void): void {
  const { panel, close } = modal(scene, 900, 1100);
  panel.add(text(scene, 0, -460, 'Daily Missions', 60, '800', GOLD, DISPLAY_FONT));
  panel.add(text(scene, 0, -395, 'New missions every day at midnight', 30, '500', '#a898b0'));
  const rows = scene.add.container(0, 0);
  panel.add(rows);
  const draw = () => {
    rows.removeAll(true);
    player.missions().forEach((m, i) => {
      const y = -260 + i * 230;
      const g = scene.add.graphics();
      g.fillStyle(0xffffff, 0.05);
      g.fillRoundedRect(-410, y - 90, 820, 200, 26);
      rows.add(g);
      rows.add(text(scene, -380, y - 40, m.text, 34, '700', '#ffffff').setOrigin(0, 0.5));
      const bw = 480;
      const bar = scene.add.graphics();
      bar.fillStyle(0x000000, 0.5);
      bar.fillRoundedRect(-380, y + 20, bw, 26, 13);
      bar.fillStyle(m.done ? 0x5ee08f : 0xe9b949, 1);
      bar.fillRoundedRect(-380, y + 20, Math.max(26, (bw * m.progress) / m.target), 26, 13);
      rows.add(bar);
      rows.add(text(scene, -380 + bw / 2, y + 68, `${fmt(m.progress)} / ${fmt(m.target)}`, 26, '600', '#a898b0'));
      if (m.claimed) rows.add(text(scene, 290, y + 10, 'Claimed', 34, '700', '#7a6a80'));
      else if (m.done) {
        rows.add(
          makeButton(scene, 290, y + 20, `+${fmt(m.reward)}`, () => {
            const got = player.claim(m.id);
            if (!got) return;
            audio.complete();
            coinShower(scene, VW / 2 + 290, VH / 2 + y, got);
            refresh();
            draw();
          }, { width: 200, height: 100, fontSize: 38, theme: THEME }),
        );
      } else rows.add(text(scene, 290, y + 10, `+${fmt(m.reward)}`, 38, '800', '#7a6a80'));
    });
  };
  draw();
  panel.add(
    makeButton(scene, 0, 460, 'Close', () => {
      audio.tap();
      close();
    }, { width: 360, height: 110, fontSize: 42, color: 0x3a2a44, shadow: 0x120a16, textColor: '#ffffff', theme: THEME }),
  );
}

const WEDGE_COLORS = [0x7a1530, 0x1d3a6a, 0x0f6a42, 0x6b2fb3, 0xa4700f, 0x0f8a7a];

/** Daily prize wheel. */
export function showDailyWheel(scene: Phaser.Scene, refresh: () => void): void {
  const { panel, close } = modal(scene, 960, 1300);
  panel.add(text(scene, 0, -560, 'Daily Wheel', 64, '800', GOLD, DISPLAY_FONT));
  const vip = player.vip();
  panel.add(text(scene, 0, -495, vip.bonus > 1 ? `${vip.name} VIP bonus: prizes ×${vip.bonus}` : 'Spin once a day for free coins', 32, '600', '#a898b0'));
  const R = 360;
  const n = WHEEL_PRIZES.length;
  const key = paintPrizeWheel(
    scene,
    'tex-daily-wheel',
    WHEEL_PRIZES.map((p) => fmt(p)),
    WHEEL_PRIZES.map((p, i) => (p >= 10000 ? 0xd4a017 : WEDGE_COLORS[i % WEDGE_COLORS.length]!)),
    R,
    { font: 38 },
  );
  const wheel = scene.add.container(0, 10, [scene.add.image(0, 0, key)]);
  const pointer = scene.add.graphics();
  pointer.fillStyle(0xffffff, 1);
  pointer.fillTriangle(-30, -R - 60, 30, -R - 60, 0, -R + 6);
  pointer.lineStyle(4, 0x3a2210, 1);
  pointer.strokeTriangle(-30, -R - 60, 30, -R - 60, 0, -R + 6);
  panel.add([wheel, pointer]);
  pointer.y = 10;
  let spinning = false;
  const btn = makeButton(scene, 0, 520, player.wheelReady() ? 'Spin' : 'Come back tomorrow', () => {
    if (spinning) return;
    if (!player.wheelReady()) {
      close();
      return;
    }
    spinning = true;
    audio.unlock();
    const { wedge, coins } = player.spinDailyWheel();
    const target = 360 * 6 - wedge * (360 / n);
    // ticking that slows down
    let last = 0;
    scene.tweens.add({
      targets: wheel,
      angle: target,
      duration: 4200,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        const k = Math.floor(wheel.angle / (360 / n));
        if (k !== last) {
          last = k;
          audio.tap();
        }
      },
      onComplete: () => {
        audio.win();
        haptics.fire('success');
        coinShower(scene, VW / 2, VH / 2, coins);
        panel.add(text(scene, 0, 10, `+${fmt(coins)}`, 80, '900', '#ffffff').setStroke('#3a1a00', 14));
        refresh();
        (btn.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text).setText('Collect');
        spinning = false;
      },
    });
  }, { width: 520, height: 130, fontSize: 50, theme: THEME });
  panel.add(btn);
}

/** Player profile: level, VIP tier, stats and settings (sound, music, vibration). */
export function showProfile(scene: Phaser.Scene, refresh: () => void): void {
  const { panel, close } = modal(scene, 920, 1360);
  const p = player.progress();
  const vip = player.vip();
  const d = save.get();
  const ring = scene.add.graphics();
  ring.fillStyle(vip.color, 1);
  ring.fillCircle(0, -500, 104);
  panel.add([ring, scene.add.image(0, -500, 'av-you').setDisplaySize(190, 190)]);
  panel.add(text(scene, 0, -360, `Level ${p.level}`, 64, '900', GOLD, DISPLAY_FONT));
  panel.add(text(scene, 0, -296, `${vip.name} VIP${vip.bonus > 1 ? `  ·  wheel ×${vip.bonus}` : ''}`, 36, '800', '#' + vip.color.toString(16).padStart(6, '0')));
  const bar = scene.add.graphics();
  bar.fillStyle(0x000000, 0.6);
  bar.fillRoundedRect(-340, -250, 680, 30, 15);
  bar.fillStyle(0x5ee08f, 1);
  bar.fillRoundedRect(-340, -250, Math.max(30, 680 * p.fraction), 30, 15);
  panel.add([bar, text(scene, 0, -194, `${fmt(p.into)} / ${fmt(p.needed)} XP to level ${p.level + 1}`, 28, '600', '#cbb6d6')]);
  const stats: [string, string][] = [
    ['Coins', fmt(d.coins)],
    ['Biggest win', fmt(d.biggestWin)],
    ['Games played', fmt(d.handsPlayed)],
  ];
  stats.forEach(([k, v], i) => {
    const y = -110 + i * 76;
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 0.05);
    g.fillRoundedRect(-380, y - 32, 760, 64, 16);
    panel.add([g, text(scene, -350, y, k, 34, '700', '#cbb6d6').setOrigin(0, 0.5), text(scene, 350, y, v, 38, '900', '#ffffff').setOrigin(1, 0.5)]);
  });
  // settings toggles
  const toggles: { label: string; get: () => boolean; set: (on: boolean) => void }[] = [
    { label: 'Sound effects', get: () => save.get().settings.sound, set: (on) => save.update((s) => void (s.settings.sound = on)) },
    { label: 'Music', get: () => save.get().settings.music !== false, set: (on) => save.update((s) => void (s.settings.music = on)) },
    { label: 'Vibration', get: () => save.get().settings.haptics, set: (on) => save.update((s) => void (s.settings.haptics = on)) },
  ];
  toggles.forEach((t, i) => {
    const y = 160 + i * 110;
    panel.add(text(scene, -350, y, t.label, 38, '700', '#ffffff').setOrigin(0, 0.5));
    const sw = scene.add.graphics();
    const draw = () => {
      const on = t.get();
      sw.clear();
      sw.fillStyle(on ? 0x18b860 : 0x3a2a44, 1);
      sw.fillRoundedRect(210, y - 32, 140, 64, 32);
      sw.fillStyle(0xffffff, 1);
      sw.fillCircle(on ? 318 : 242, y, 26);
    };
    draw();
    const z = scene.add.zone(280, y, 180, 90).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => {
      t.set(!t.get());
      applySettings();
      audio.unlock();
      audio.tap();
      draw();
    });
    panel.add([sw, z]);
  });
  panel.add(
    makeButton(scene, 0, 560, 'Close', () => {
      audio.tap();
      close();
      refresh();
    }, { width: 360, height: 110, fontSize: 42, color: 0x3a2a44, shadow: 0x120a16, textColor: '#ffffff', theme: THEME }),
  );
}
