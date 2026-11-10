import Phaser from 'phaser';
import { makeIconButton } from '@tgs/kit';
import { drawPlant } from '../art.ts';
import { THEME, audio, save } from '../services.ts';
import { RARITY_COLOR, RARITY_LABEL, STAGE_AT, STAGE_LABEL, VARIETIES, stageFor } from '../varieties.ts';
import { goToLevel } from '../navigation.ts';
import { drawBackground } from './background.ts';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** The player's collection: every plant variety, grown by how many packs of it they've opened. */
export class GardenScene extends Phaser.Scene {
  constructor() {
    super('garden');
  }

  create(data: { from?: string; level?: number }): void {
    const { width: w, height: h } = this.scale;
    drawBackground(this);

    const garden = save.get().garden;
    const found = VARIETIES.filter((s) => garden[s.id]).length;

    // Grid of plant cards (scrolls)
    const cols = 3;
    const cardW = 316;
    const cardH = 440;
    const gap = 26;
    const left = (w - (cols * cardW + (cols - 1) * gap)) / 2;
    const top = 330;
    VARIETIES.forEach((variety, i) => {
      const x = left + (i % cols) * (cardW + gap) + cardW / 2;
      const y = top + Math.floor(i / cols) * (cardH + gap);
      const copies = garden[variety.id] ?? 0;
      const g = this.add.graphics({ x, y });
      g.fillStyle(THEME.surface, copies ? 1 : 0.5);
      g.fillRoundedRect(-cardW / 2, 0, cardW, cardH, 28);
      if (copies) {
        g.lineStyle(3, RARITY_COLOR[variety.rarity], variety.rarity === 'common' ? 0.25 : 0.8);
        g.strokeRoundedRect(-cardW / 2, 0, cardW, cardH, 28);
        const plant = this.add.graphics({ x, y: y + 300 });
        drawPlant(plant, stageFor(copies), variety.color, variety.category);
        plant.setScale(0.78);
        const stage = stageFor(copies);
        const next = stage < 2 ? ` · ${copies}/${STAGE_AT[stage + 1]}` : '';
        this.add
          .text(x, y + 344, variety.name, {
            fontFamily: THEME.font,
            fontSize: variety.name.length > 15 ? '28px' : '33px',
            fontStyle: '700',
            color: THEME.ink,
          })
          .setOrigin(0.5);
        this.add
          .text(x, y + 392, `${STAGE_LABEL[stage]}${next}`, {
            fontFamily: THEME.font,
            fontSize: '26px',
            fontStyle: '500',
            color: stage === 2 ? hex(variety.color) : THEME.inkSoft,
          })
          .setOrigin(0.5);
      } else {
        this.add
          .text(x, y + 170, '?', { fontFamily: THEME.font, fontSize: '120px', fontStyle: '800', color: '#2c3a57' })
          .setOrigin(0.5);
        this.add
          .text(x, y + 344, RARITY_LABEL[variety.rarity], {
            fontFamily: THEME.font,
            fontSize: '30px',
            fontStyle: '700',
            color: hex(RARITY_COLOR[variety.rarity]),
          })
          .setOrigin(0.5)
          .setAlpha(0.7);
        this.add
          .text(x, y + 392, 'Undiscovered', { fontFamily: THEME.font, fontSize: '26px', fontStyle: '500', color: '#4c5a76' })
          .setOrigin(0.5);
      }
    });
    const contentBottom = top + Math.ceil(VARIETIES.length / cols) * (cardH + gap) + 60;

    // Fixed header
    const header = this.add.graphics().setScrollFactor(0).setDepth(10);
    header.fillGradientStyle(0x16233b, 0x16233b, 0x16233b, 0x16233b, 1, 1, 0.92, 0.92);
    header.fillRect(0, 0, w, 290);
    this.add
      .text(w / 2, 110, 'Garden', { fontFamily: THEME.font, fontSize: '72px', fontStyle: '700', color: THEME.ink })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(11);
    this.add
      .text(w / 2, 195, `${found} of ${VARIETIES.length} plants discovered`, {
        fontFamily: THEME.font,
        fontSize: '40px',
        fontStyle: '500',
        color: THEME.inkSoft,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(11);
    const back = makeIconButton(
      this,
      110,
      120,
      (g) => {
        g.lineStyle(8, THEME.icon, 1);
        g.lineBetween(12, -24, -14, 0);
        g.lineBetween(-14, 0, 12, 24);
      },
      () => {
        audio.tap();
        if (data.from === 'game' && data.level) goToLevel(this, data.level);
        else this.scene.start('menu');
      },
      { size: 110, theme: THEME },
    );
    back.setScrollFactor(0).setDepth(12);

    // Drag / wheel scrolling
    const cam = this.cameras.main;
    cam.setBounds(0, 0, w, Math.max(h, contentBottom));
    let dragY: number | null = null;
    let camStart = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragY = p.y;
      camStart = cam.scrollY;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragY !== null && p.isDown) cam.scrollY = camStart - (p.y - dragY);
    });
    this.input.on('pointerup', () => (dragY = null));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => (cam.scrollY += dy));
  }
}
