import Phaser from 'phaser';
import { drawFanLeaf, shade } from '../art.ts';
import { THEME } from '../services.ts';
import { RARITY_COLOR, RARITY_LABEL, type Strain } from '../strains.ts';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** A seed packet: crimped top, the strain's leaf, name, lineage and rarity. Origin is the center. */
export function makePackCard(scene: Phaser.Scene, strain: Strain, w = 560, h = 420): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const top = -h / 2;
  // body
  g.fillStyle(THEME.surfaceEdge, 1);
  g.fillRoundedRect(-w / 2, top + 8, w, h, 28);
  g.fillStyle(0x24324f, 1);
  g.fillRoundedRect(-w / 2, top, w, h, 28);
  // crimped header strip in the strain's color
  const band = 64;
  g.fillStyle(shade(strain.color, -0.45), 1);
  g.fillRoundedRect(-w / 2, top, w, band, { tl: 28, tr: 28, bl: 0, br: 0 });
  g.fillStyle(0x24324f, 1);
  const teeth = 22;
  for (let i = 0; i < teeth; i++) {
    const x0 = -w / 2 + 20 + (i * (w - 40)) / teeth;
    const x1 = x0 + (w - 40) / teeth;
    g.fillTriangle(x0, top + band, x1, top + band, (x0 + x1) / 2, top + band - 12);
  }
  // rarity edge
  g.lineStyle(4, RARITY_COLOR[strain.rarity], strain.rarity === 'common' ? 0.35 : 0.9);
  g.strokeRoundedRect(-w / 2, top, w, h, 28);
  // leaf
  drawFanLeaf(g, 0, top + band + 170, 120, strain.color, 7);
  g.lineStyle(6, strain.color, 1);
  g.lineBetween(0, top + band + 170, 0, top + band + 196);

  const label = scene.add
    .text(0, top + band / 2 - 4, 'SEED PACK', {
      fontFamily: THEME.font,
      fontSize: '26px',
      fontStyle: '700',
      color: hex(shade(strain.color, 0.55)),
    })
    .setOrigin(0.5)
    .setLetterSpacing(6);
  const name = scene.add
    .text(0, top + band + 250, strain.name, {
      fontFamily: THEME.font,
      fontSize: strain.name.length > 16 ? '40px' : '48px',
      fontStyle: '700',
      color: THEME.ink,
    })
    .setOrigin(0.5);
  const meta = scene.add
    .text(0, top + band + 306, `${strain.lineage}  ·  ${strain.terpene}  ·  `, {
      fontFamily: THEME.font,
      fontSize: '30px',
      fontStyle: '500',
      color: THEME.inkSoft,
    })
    .setOrigin(0.5);
  const rarity = scene.add
    .text(0, meta.y, RARITY_LABEL[strain.rarity], {
      fontFamily: THEME.font,
      fontSize: '30px',
      fontStyle: '700',
      color: hex(RARITY_COLOR[strain.rarity]),
    })
    .setOrigin(0, 0.5);
  // center "meta + rarity" as one line
  const total = meta.width + rarity.width;
  meta.setOrigin(0, 0.5).setX(-total / 2);
  rarity.setX(-total / 2 + meta.width);

  return scene.add.container(0, 0, [g, label, name, meta, rarity]);
}
