import Phaser from 'phaser';
import {
  AS_PICTURED, AVATAR_PRESETS, CUSTOM_CATEGORIES, groupsFor, optionAvailable, portraitKey, presetById, presetOfValue, sanitizeLook,
  type AvatarLook, type CategoryId,
} from '../logic/avatars.ts';
import { DISPLAY_FONT, GOLD, THEME, audio, haptics, save } from '../services.ts';
import { hasPhoto, photoInputOver, removePhoto, wearLook } from '../ui/avatar.ts';
import { VW, backdrop, banner, coinBar, frame, makeButton, text } from '../ui/common.ts';
import { loadPortraits } from './BootScene.ts';

type Tab = 'presets' | 'customize' | 'photo';

/** What the player is trying on; kept between visits so browsing never loses progress. */
interface Draft {
  look: AvatarLook;
  tab: Tab;
  category: CategoryId;
}

const PREVIEW_Y = 470;
const TABS_Y = 800;
const CONTENT_TOP = 870;
const FOOTER_Y = 1800;
const BURGUNDY = 0x5a0a24;

/**
 * THE DRESSING ROOM: choose one of the 16 photorealistic presets, look
 * through the customisation catalogue (options unlock as matching realistic
 * artwork is added), or use your own photo (picked, cropped, saved). Changes
 * apply everywhere the player appears: lobby, profile, chat, friends,
 * messages and the tables.
 */
export class DressingRoomScene extends Phaser.Scene {
  private back = 'lobby';
  private draft!: Draft;
  private preview!: Phaser.GameObjects.Container;
  private content!: Phaser.GameObjects.Container;
  private footer!: Phaser.GameObjects.Container;
  private tabs!: Phaser.GameObjects.Container;
  private scroll = 0;
  private maxScroll = 0;
  private dragged = false;

  constructor() {
    super('dressing');
  }

  init(data: { back?: string }): void {
    this.back = data.back && data.back !== 'dressing' ? data.back : 'lobby';
  }

  create(): void {
    const view = frame(this);
    backdrop(this, 'room-lobby');
    this.add.rectangle(VW / 2, (view.top + view.bottom) / 2, VW, view.bottom - view.top, 0x07030a, 0.78);
    coinBar(this, 'Dressing Room', () => this.scene.start(this.back));
    const saved = save.get();
    const worn = saved.avatarLook ?? { preset: presetOfValue(saved.avatar ?? '') ?? AVATAR_PRESETS[0]!.id, custom: {} };
    this.draft = (this.registry.get('dressing.draft') as Draft | undefined) ?? { look: sanitizeLook(worn), tab: hasPhoto() ? 'photo' : 'presets', category: 'face' };
    // the scrolling grid passes under the preview area: cover it with the same backdrop
    backdrop(this, 'room-lobby', { y0: -10000, y1: CONTENT_TOP - 8 }).setDepth(4.5);
    this.add.rectangle(VW / 2, (view.top + CONTENT_TOP - 8) / 2, VW, CONTENT_TOP - 8 - view.top, 0x07030a, 0.78).setDepth(4.6);
    this.add.image(VW / 2, 300, 'fx-glow').setDisplaySize(1300, 900).setTint(0x7a2ad8).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.7);
    this.preview = this.add.container(0, 0).setDepth(5);
    this.tabs = this.add.container(0, 0).setDepth(6);
    this.content = this.add.container(0, 0).setDepth(4);
    this.footer = this.add.container(0, 0).setDepth(7);
    this.scroll = 0;
    // the content area scrolls (the presets grid)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragged = false;
      p.event?.preventDefault?.();
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || p.downY < CONTENT_TOP || p.downY > FOOTER_Y - 80) return;
      const dy = p.position.y - p.prevPosition.y;
      if (Math.abs(p.position.y - p.downY) > 14) this.dragged = true;
      if (!this.dragged) return;
      this.scroll = Phaser.Math.Clamp(this.scroll - dy, 0, this.maxScroll);
      this.content.y = -this.scroll;
    });
    // the large portraits load on first visit
    const loading = text(this, VW / 2, PREVIEW_Y, 'Opening the Dressing Room…', 32, '700', '#cbb6d6');
    loadPortraits(this, () => {
      loading.destroy();
      this.renderAll();
    });
    (globalThis as Record<string, unknown>).__dressing = {
      draft: () => this.draft,
      pick: (id: string) => this.pickPreset(id),
      tab: (t: Tab) => this.setTab(t),
      category: (c: CategoryId) => this.setCategory(c),
      confirm: () => this.confirm(),
      removePhoto: () => removePhoto(this, () => this.renderAll()),
      tilePos: (i: number) => this.tilePos(i),
      footerY: FOOTER_Y,
      tabsY: TABS_Y,
    };
  }

  private renderAll(): void {
    this.registry.set('dressing.draft', this.draft);
    this.renderPreview();
    this.renderTabs();
    this.renderContent();
    this.renderFooter();
  }

  // ---------------------------------------------------------------- preview
  private renderPreview(): void {
    this.preview.removeAll(true);
    const photo = this.draft.tab === 'photo' && hasPhoto();
    const p = presetById(this.draft.look.preset)!;
    const x = VW / 2;
    const g = this.add.graphics();
    if (photo) {
      g.fillStyle(0x000000, 0.6);
      g.fillCircle(x, PREVIEW_Y + 8, 196);
      g.fillStyle(BURGUNDY, 1);
      g.fillCircle(x, PREVIEW_Y, 192);
      g.lineStyle(8, 0xe9c86a, 1);
      g.strokeCircle(x, PREVIEW_Y, 188);
      this.preview.add([g, this.add.image(x, PREVIEW_Y, 'av-you').setDisplaySize(360, 360)]);
      this.preview.add(text(this, x, PREVIEW_Y + 230, 'Your photo', 44, '900', GOLD, DISPLAY_FONT));
      return;
    }
    const w = 320;
    const h = Math.round((w * 236) / 190);
    g.fillStyle(0x000000, 0.6);
    g.fillRoundedRect(x - w / 2 - 10, PREVIEW_Y - h / 2 - 4, w + 20, h + 24, 26);
    g.fillStyle(BURGUNDY, 1);
    g.fillRoundedRect(x - w / 2 - 12, PREVIEW_Y - h / 2 - 12, w + 24, h + 24, 26);
    this.preview.add(g);
    this.preview.add(this.add.image(x, PREVIEW_Y, portraitKey(p.id)).setDisplaySize(w, h));
    const rim = this.add.graphics();
    rim.lineStyle(6, 0xe9c86a, 1);
    rim.strokeRoundedRect(x - w / 2 - 6, PREVIEW_Y - h / 2 - 6, w + 12, h + 12, 22);
    rim.lineStyle(2, 0xfff0b0, 0.8);
    rim.strokeRoundedRect(x - w / 2 - 12, PREVIEW_Y - h / 2 - 12, w + 24, h + 24, 26);
    this.preview.add(rim);
    // nameplate
    const plate = this.add.graphics();
    plate.fillStyle(0x0a0608, 0.95);
    plate.fillRoundedRect(x - 130, PREVIEW_Y + h / 2 - 30, 260, 62, 16);
    plate.lineStyle(3, 0xe9c86a, 1);
    plate.strokeRoundedRect(x - 130, PREVIEW_Y + h / 2 - 30, 260, 62, 16);
    this.preview.add([plate, text(this, x, PREVIEW_Y + h / 2 + 1, p.name.toUpperCase(), 34, '900', '#ffe9a8', DISPLAY_FONT).setLetterSpacing(3)]);
    const current = save.get().avatarLook?.preset === p.id && !hasPhoto();
    this.preview.add(text(this, x, PREVIEW_Y - h / 2 - 34, current ? 'Your current look' : 'Previewing', 26, '800', current ? '#7dffb0' : '#cbb6d6').setLetterSpacing(2));
  }

  // ---------------------------------------------------------------- tabs
  private renderTabs(): void {
    this.tabs.removeAll(true);
    const tabs: [Tab, string][] = [['presets', 'AVATARS'], ['customize', 'CUSTOMIZE'], ['photo', 'USE MY PHOTO']];
    const w = 320;
    tabs.forEach(([id, label], i) => {
      const x = VW / 2 + (i - 1) * (w + 12);
      const on = this.draft.tab === id;
      const g = this.add.graphics();
      g.fillStyle(on ? BURGUNDY : 0x16101c, 1);
      g.fillRoundedRect(x - w / 2, TABS_Y - 38, w, 76, 20);
      g.lineStyle(on ? 4 : 2, 0xe9c86a, on ? 1 : 0.45);
      g.strokeRoundedRect(x - w / 2, TABS_Y - 38, w, 76, 20);
      const t = text(this, x, TABS_Y, label, 28, '900', on ? '#ffe9a8' : '#a898b0').setLetterSpacing(2);
      const z = this.add.zone(x, TABS_Y, w, 76).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.setTab(id));
      this.tabs.add([g, t, z]);
    });
  }

  private setTab(t: Tab): void {
    if (this.draft.tab === t) return;
    audio.tap();
    this.draft.tab = t;
    this.scroll = 0;
    this.renderAll();
  }

  // ---------------------------------------------------------------- content
  private renderContent(): void {
    this.content.removeAll(true);
    this.content.y = 0;
    this.maxScroll = 0;
    this.input.setTopOnly(true);
    if (this.draft.tab === 'presets') this.presetGrid();
    else if (this.draft.tab === 'customize') this.customizer();
    else this.photoPanel();
    // the content scrolls under the tabs and footer: mask both edges with the backdrop colour
  }

  private tilePos(i: number): { x: number; y: number } {
    const cols = 4;
    const w = 232;
    const h = 300;
    const gap = 14;
    return { x: VW / 2 + ((i % cols) - 1.5) * (w + gap), y: CONTENT_TOP + 20 + h / 2 + Math.floor(i / cols) * (h + gap) };
  }

  /** The 16 presets in a scrollable grid; tap to preview. */
  private presetGrid(): void {
    const w = 232;
    const h = 300;
    AVATAR_PRESETS.forEach((p, i) => {
      const { x, y } = this.tilePos(i);
      const on = this.draft.look.preset === p.id;
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      if (on) {
        g.fillStyle(0xe9c86a, 0.25);
        g.fillRoundedRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 22);
      }
      g.fillStyle(0x000000, 0.6);
      g.fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, 18);
      c.add(g);
      const img = this.add.image(0, -12, portraitKey(p.id)).setDisplaySize(w - 16, (w - 16) * (236 / 190));
      c.add(img);
      const rim = this.add.graphics();
      rim.lineStyle(on ? 6 : 3, on ? 0xffe08a : 0xb8923a, 1);
      rim.strokeRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 16);
      rim.fillStyle(0x0a0608, 0.95);
      rim.fillRoundedRect(-w / 2 + 22, h / 2 - 50, w - 44, 42, 12);
      rim.lineStyle(2, 0xe9c86a, 0.9);
      rim.strokeRoundedRect(-w / 2 + 22, h / 2 - 50, w - 44, 42, 12);
      c.add([rim, text(this, 0, h / 2 - 29, p.name.toUpperCase(), 24, '900', on ? '#ffe9a8' : '#f3e6f0', DISPLAY_FONT).setLetterSpacing(2)]);
      c.setSize(w, h).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        if (!this.dragged) this.pickPreset(p.id);
      });
      this.content.add(c);
    });
    const rows = Math.ceil(AVATAR_PRESETS.length / 4);
    this.maxScroll = Math.max(0, CONTENT_TOP + 20 + rows * 314 - (FOOTER_Y - 90));
  }

  private pickPreset(id: string): void {
    if (!presetById(id)) return;
    audio.tap();
    haptics.fire('light');
    // a different preset starts from its own look (variants belong to each character)
    if (this.draft.look.preset !== id) this.draft.look = { preset: id, custom: {} };
    const keep = this.scroll;
    this.renderAll();
    this.scroll = Math.min(keep, this.maxScroll);
    this.content.y = -this.scroll;
  }

  /** Category chips, then each group's options. Locked options say why. */
  private customizer(): void {
    const preset = presetById(this.draft.look.preset)!;
    const cats = CUSTOM_CATEGORIES;
    const cw = 160;
    cats.forEach((cat, i) => {
      const x = VW / 2 + (i - (cats.length - 1) / 2) * (cw + 8);
      const y = CONTENT_TOP + 44;
      const on = this.draft.category === cat.id;
      const g = this.add.graphics();
      g.fillStyle(on ? BURGUNDY : 0x16101c, 1);
      g.fillRoundedRect(x - cw / 2, y - 34, cw, 68, 16);
      g.lineStyle(on ? 3 : 2, 0xe9c86a, on ? 1 : 0.4);
      g.strokeRoundedRect(x - cw / 2, y - 34, cw, 68, 16);
      const z = this.add.zone(x, y, cw, 68).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.setCategory(cat.id));
      this.content.add([g, text(this, x, y, cat.label, 24, '900', on ? '#ffe9a8' : '#cbb6d6'), z]);
    });
    const cat = cats.find((c) => c.id === this.draft.category)!;
    let y = CONTENT_TOP + 130;
    const groups = groupsFor(preset.id, cat);
    if (!groups.length) {
      this.content.add(text(this, VW / 2, y + 40, `${cat.label} options don't apply to ${preset.name}.`, 30, '700', '#cbb6d6'));
      return;
    }
    let locked = 0;
    for (const grp of groups) {
      this.content.add(text(this, 70, y, grp.label.toUpperCase(), 24, '900', GOLD).setOrigin(0, 0.5).setLetterSpacing(3));
      y += 46;
      let x = 70;
      for (const o of grp.options) {
        const ok = optionAvailable(preset.id, grp.id, o.id);
        if (!ok) locked++;
        const chosen = (this.draft.look.custom[grp.id] ?? AS_PICTURED) === o.id;
        const t = text(this, 0, 0, o.label, 24, '800', chosen ? '#2a1400' : ok ? '#ffffff' : '#6e6276');
        const bw = t.width + 48;
        if (x + bw > VW - 60) {
          x = 70;
          y += 66;
        }
        const g = this.add.graphics();
        g.fillStyle(chosen ? 0xe9c86a : ok ? 0x2a2233 : 0x120e16, 1);
        g.fillRoundedRect(x, y - 26, bw, 52, 26);
        g.lineStyle(2, ok ? 0xe9c86a : 0x3a3244, ok ? 0.8 : 1);
        g.strokeRoundedRect(x, y - 26, bw, 52, 26);
        t.setPosition(x + bw / 2, y);
        this.content.add([g, t]);
        if (ok && !chosen) {
          const z = this.add.zone(x + bw / 2, y, bw, 52).setInteractive({ useHandCursor: true });
          z.on('pointerup', () => {
            audio.tap();
            if (o.id === AS_PICTURED) delete this.draft.look.custom[grp.id];
            else this.draft.look.custom[grp.id] = o.id;
            this.renderAll();
          });
          this.content.add(z);
        }
        x += bw + 12;
      }
      y += 84;
    }
    if (locked)
      this.content.add(
        text(this, VW / 2, Math.min(y + 10, FOOTER_Y - 130), 'Greyed options unlock as realistic artwork for this character is added.\nYour avatar is never drawn over or altered.', 24, '600', '#a898b0').setAlign('center'),
      );
    this.maxScroll = Math.max(0, y + 60 - (FOOTER_Y - 90));
  }

  private setCategory(c: CategoryId): void {
    audio.tap();
    this.draft.category = c;
    this.renderAll();
  }

  /** USE MY PHOTO: pick from the phone, crop, save; replace or remove it later. */
  private photoPanel(): void {
    const y = CONTENT_TOP + 90;
    const photo = hasPhoto();
    this.content.add(
      text(this, VW / 2, y, photo ? 'Your photo shows in chat, your profile, friends lists,\nmessages and at the tables.' : 'Use a photo from your phone instead of a preset.\nYou can move and zoom it to fit the frame.', 28, '600', '#e9d6ee').setAlign('center'),
    );
    const by = y + 180;
    const label = photo ? 'Replace photo' : 'USE MY PHOTO';
    const btn = makeButton(this, VW / 2, by, label, () => {}, { width: 560, height: 120, fontSize: 44, theme: THEME });
    this.content.add(btn);
    // a real file input over the button opens the photo picker from the tap itself
    photoInputOver(this, VW / 2, by, 560, 120, (savedPhoto) => {
      if (!savedPhoto) return;
      haptics.fire('success');
      banner(this, 'Photo saved', 'It now shows wherever you appear');
      this.renderAll();
    });
    if (photo)
      this.content.add(
        makeButton(this, VW / 2, by + 160, 'Remove photo', () => {
          audio.tap();
          removePhoto(this, () => {
            this.draft.tab = 'presets';
            this.renderAll();
          });
        }, { width: 460, height: 100, fontSize: 36, color: 0x3a2a44, theme: THEME }),
      );
    this.content.add(
      text(this, VW / 2, by + (photo ? 300 : 170), 'Photos are only visible to signed-in Velvet Ace players.\nShare only photos of yourself. Players can report pictures.', 22, '600', '#8a7a94').setAlign('center'),
    );
  }

  // ---------------------------------------------------------------- footer
  private renderFooter(): void {
    this.footer.removeAll(true);
    const view = frame(this);
    const g = this.add.graphics();
    g.fillGradientStyle(0x07030a, 0x07030a, 0x07030a, 0x07030a, 0, 0, 1, 1);
    g.fillRect(0, FOOTER_Y - 150, VW, 60);
    g.fillStyle(0x07030a, 1);
    g.fillRect(0, FOOTER_Y - 90, VW, view.bottom - FOOTER_Y + 200);
    this.footer.add(g);
    if (this.draft.tab === 'photo') return;
    const wearing = !hasPhoto() && JSON.stringify(sanitizeLook(this.draft.look)) === JSON.stringify(save.get().avatarLook ?? null);
    if (this.draft.tab === 'presets')
      this.footer.add(
        makeButton(this, VW / 2 - 250, FOOTER_Y, 'Customize', () => this.setTab('customize'), { width: 420, height: 112, fontSize: 40, color: 0x2a2430, theme: THEME }),
      );
    this.footer.add(
      makeButton(this, this.draft.tab === 'presets' ? VW / 2 + 230 : VW / 2, FOOTER_Y, wearing ? 'Wearing this' : 'Confirm Selection', () => this.confirm(), {
        width: this.draft.tab === 'presets' ? 460 : 600, height: 112, fontSize: 40, theme: THEME,
      }),
    );
  }

  private confirm(): void {
    audio.chips(2);
    haptics.fire('success');
    wearLook(this, this.draft.look, () => {
      banner(this, 'Looking sharp', `${presetById(this.draft.look.preset)!.name} is now your avatar`);
      this.renderAll();
    });
  }
}
