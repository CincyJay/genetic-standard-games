import Phaser from 'phaser';
import { faceKey, presetById, presetOfValue, thumbKey, type PhotoVisibility } from '../logic/avatars.ts';
import { online } from '../online.ts';
import { save } from '../services.ts';

/** Size photos are stored at on the device (round PNG). */
const PHOTO = 256;
/** Biggest photo file accepted from the picker. */
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

/** Short content hash, used to name a photo ('photo-<hash>') and cache its texture. */
export const hashOf = (v: string) => {
  let h = 0;
  for (let i = 0; i < v.length; i += 7) h = (h * 31 + v.charCodeAt(i)) | 0;
  return `${v.length.toString(36)}${(h >>> 0).toString(36)}`;
};

/** Moves a version 1.5 save ('avatar' + 'avatarLook') to the preset/photo fields. Safe to call often. */
export function migrateAvatar(): void {
  const d = save.get();
  if (d.avatar === undefined && d.avatarLook === undefined) return;
  save.update((s) => {
    const old = s.avatar ?? '';
    const preset = presetOfValue(s.avatarLook?.preset) ?? presetOfValue(old);
    s.presetAvatarId = s.presetAvatarId ?? preset;
    if (old.startsWith('data:')) {
      s.avatarMode = 'photo';
      s.photo = old;
      s.photoAssetId = `photo-${hashOf(old)}`;
    } else if (preset) s.avatarMode = 'preset';
    delete s.avatar;
    delete s.avatarLook;
  });
}

/** What the player shows right now: their photo, a preset id, or '' (the Velvet Ace monogram). */
export function myAvatarValue(): string {
  const d = save.get();
  if (d.avatarMode === 'photo' && d.photo) return d.photo;
  if (d.avatarMode === 'preset' && presetById(d.presetAvatarId)) return d.presetAvatarId!;
  return '';
}

export const hasPhoto = () => Boolean(save.get().photo);
export const wearingPhoto = () => save.get().avatarMode === 'photo' && hasPhoto();

/**
 * Draws the player's picture into the 'av-you' canvas texture (used across
 * the casino). It is redrawn in place, so every image already showing it
 * updates. Calls `done` once it's drawn.
 */
export function applyAvatar(scene: Phaser.Scene, done: () => void = () => {}): void {
  migrateAvatar();
  const tex = scene.textures;
  if (!tex.exists('av-you')) tex.createCanvas('av-you', PHOTO, PHOTO);
  const canvas = tex.get('av-you') as Phaser.Textures.CanvasTexture;
  const fallback = () => tex.get('av-default').getSourceImage() as HTMLCanvasElement;
  const draw = (src: CanvasImageSource) => {
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, PHOTO, PHOTO);
    ctx.drawImage(src, 0, 0, PHOTO, PHOTO);
    canvas.refresh();
    done();
  };
  const v = myAvatarValue();
  if (v.startsWith('data:')) {
    const img = new Image();
    img.onload = () => draw(img);
    img.onerror = () => draw(fallback());
    img.src = v;
    return;
  }
  draw(v && tex.exists(faceKey(v)) ? (tex.get(faceKey(v)).getSourceImage() as HTMLImageElement) : fallback());
}

/** Shows the change here and on the online profile (chat, friends, tables pick it up). */
function changed(scene: Phaser.Scene, done?: () => void): void {
  applyAvatar(scene, done);
  void online.publish();
}

/** Wears one of the 16 presets. A saved photo stays on the device (and offline) for later. */
export function wearPreset(scene: Phaser.Scene, id: string, done?: () => void): void {
  if (!presetById(id)) return;
  save.update((d) => {
    d.avatarMode = 'preset';
    d.presetAvatarId = id;
    d.photoAssetId = null;
  });
  changed(scene, done);
}

/** Wears a newly cropped photo. */
export function wearPhoto(scene: Phaser.Scene, dataUrl: string, done?: () => void): void {
  save.update((d) => {
    d.avatarMode = 'photo';
    d.photo = dataUrl;
    d.photoAssetId = `photo-${hashOf(dataUrl)}`;
  });
  changed(scene, done);
}

/** Switches back to the saved photo (after wearing a preset for a while). */
export function wearSavedPhoto(scene: Phaser.Scene, done?: () => void): void {
  const p = save.get().photo;
  if (p) wearPhoto(scene, p, done);
}

/** Deletes the photo from the device and the profile; back to the preset (or the monogram). */
export function removePhoto(scene: Phaser.Scene, done?: () => void): void {
  save.update((d) => {
    delete d.photo;
    d.photoAssetId = null;
    d.avatarMode = presetById(d.presetAvatarId) ? 'preset' : undefined;
  });
  changed(scene, done);
}

export const photoVisibility = (): PhotoVisibility => save.get().photoVisibility ?? 'everyone';
export function setPhotoVisibility(v: PhotoVisibility): void {
  save.update((d) => {
    d.photoVisibility = v;
  });
  void online.publish();
}

/**
 * Places a transparent <input type="file"> over a button (world coordinates),
 * so tapping the button opens the phone's photo picker (on Android, the
 * system photo picker). Browsers only open file pickers from a direct tap,
 * which this guarantees. The chosen photo opens in the crop editor.
 * Returns the element; it is removed with the scene or when used.
 */
export function photoInputOver(scene: Phaser.Scene, x: number, y: number, w: number, h: number, done: (saved: boolean) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.dataset.role = 'avatar-photo';
  const canvas = scene.game.canvas;
  const place = () => {
    const r = canvas.getBoundingClientRect();
    const cam = scene.cameras.main;
    const sx = r.width / scene.scale.width;
    const sy = r.height / scene.scale.height;
    Object.assign(input.style, {
      position: 'fixed',
      left: `${r.left + (x - w / 2 - cam.scrollX) * sx}px`,
      top: `${r.top + (y - h / 2 - cam.scrollY) * sy}px`,
      width: `${w * sx}px`,
      height: `${h * sy}px`,
      opacity: '0',
      zIndex: '10',
      cursor: 'pointer',
    });
  };
  place();
  document.body.appendChild(input);
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) return void notice('That photo is too large (20 MB at most).');
    if (!file.type.startsWith('image/')) return void notice('Please choose a photo.');
    cropPhoto(file, (url) => {
      if (url) wearPhoto(scene, url, () => done(true));
      else done(false);
    });
  });
  scene.scale.on('resize', place);
  scene.events.once('shutdown', () => input.remove());
  return input;
}

function notice(msg: string): void {
  const n = document.createElement('div');
  n.textContent = msg;
  Object.assign(n.style, {
    position: 'fixed', left: '50%', top: '18%', transform: 'translateX(-50%)', zIndex: '60', padding: '14px 22px', borderRadius: '14px',
    background: '#1a0f24', color: '#ffe9a8', border: '2px solid #e9c86a', font: '700 16px Outfit, system-ui, sans-serif',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 2600);
}

/**
 * The crop editor: the photo inside a round frame; drag to reposition, pinch
 * or use the slider to zoom. Saves a 256px round PNG. Nothing about the face
 * is altered: the photo is only moved, scaled and cropped.
 */
export function cropPhoto(file: File | Blob, done: (dataUrl: string | null) => void): void {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onerror = () => {
    URL.revokeObjectURL(url);
    notice('That photo could not be opened.');
    done(null);
  };
  img.onload = () => {
    // work from a copy no larger than 1600px, so huge camera photos stay smooth
    const big = Math.max(img.width, img.height);
    const k = Math.min(1, 1600 / big);
    const src = document.createElement('canvas');
    src.width = Math.round(img.width * k);
    src.height = Math.round(img.height * k);
    src.getContext('2d')!.drawImage(img, 0, 0, src.width, src.height);
    URL.revokeObjectURL(url);
    openEditor(src, done);
  };
  img.src = url;
}

function openEditor(src: HTMLCanvasElement, done: (dataUrl: string | null) => void): void {
  const V = Math.min(300, Math.round(window.innerWidth * 0.72));
  const root = document.createElement('div');
  root.dataset.role = 'crop-editor';
  Object.assign(root.style, {
    position: 'fixed', inset: '0', zIndex: '50', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px',
    background: 'radial-gradient(circle at 50% 30%, rgba(90,20,110,.55), rgba(8,4,12,.96) 70%)', font: '700 16px Outfit, system-ui, sans-serif', color: '#f3e6f0',
    touchAction: 'none', userSelect: 'none',
  } as Partial<CSSStyleDeclaration>);
  const title = document.createElement('div');
  title.textContent = 'Position your photo';
  Object.assign(title.style, { font: '900 26px "Playfair Display", Georgia, serif', color: '#e9c86a' });
  const hint = document.createElement('div');
  hint.textContent = 'Drag to move · slide or pinch to zoom';
  hint.style.color = '#cbb6d6';
  const frame = document.createElement('div');
  Object.assign(frame.style, {
    width: `${V}px`, height: `${V}px`, borderRadius: '50%', overflow: 'hidden', position: 'relative', border: '4px solid #e9c86a',
    boxShadow: '0 0 0 6px #3a0a1a, 0 0 40px rgba(233,200,106,.45)', background: '#000', cursor: 'grab',
  } as Partial<CSSStyleDeclaration>);
  const view = document.createElement('canvas');
  view.width = view.height = V * 2;
  Object.assign(view.style, { width: `${V}px`, height: `${V}px`, display: 'block' });
  frame.appendChild(view);
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '1';
  slider.max = '4';
  slider.step = '0.01';
  slider.value = '1';
  slider.dataset.role = 'crop-zoom';
  Object.assign(slider.style, { width: `${V}px`, accentColor: '#e9c86a' });
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', gap: '14px' });
  const button = (label: string, gold: boolean) => {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      padding: '14px 26px', borderRadius: '999px', font: '900 18px Outfit, system-ui, sans-serif', cursor: 'pointer',
      border: gold ? '2px solid #fff0b0' : '2px solid #8a7a9a', color: gold ? '#2a1400' : '#ffffff',
      background: gold ? 'linear-gradient(#ffe08a, #c98a1e)' : 'linear-gradient(#3a2a44, #1a1022)',
    } as Partial<CSSStyleDeclaration>);
    return b;
  };
  const cancel = button('Cancel', false);
  const ok = button('Save photo', true);
  cancel.dataset.role = 'crop-cancel';
  ok.dataset.role = 'crop-save';
  row.append(cancel, ok);
  root.append(title, frame, hint, slider, row);
  document.body.appendChild(root);

  // the photo covers the circle at zoom 1; offsets are in frame pixels from centred
  const cover = V / Math.min(src.width, src.height);
  let zoom = 1;
  let ox = 0;
  let oy = 0;
  const clamp = () => {
    const w = src.width * cover * zoom;
    const h = src.height * cover * zoom;
    ox = Math.max(-(w - V) / 2, Math.min((w - V) / 2, ox));
    oy = Math.max(-(h - V) / 2, Math.min((h - V) / 2, oy));
  };
  const paint = (ctx: CanvasRenderingContext2D, size: number) => {
    const s = size / V;
    const w = src.width * cover * zoom;
    const h = src.height * cover * zoom;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(src, (V / 2 + ox - w / 2) * s, (V / 2 + oy - h / 2) * s, w * s, h * s);
  };
  const redraw = () => {
    clamp();
    paint(view.getContext('2d')!, view.width);
  };
  redraw();
  slider.addEventListener('input', () => {
    zoom = Number(slider.value);
    redraw();
  });
  // drag with one pointer, pinch with two
  const pts = new Map<number, { x: number; y: number }>();
  let pinch0 = 0;
  let zoom0 = 1;
  frame.addEventListener('pointerdown', (e) => {
    frame.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch0 = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      zoom0 = zoom;
    }
  });
  frame.addEventListener('pointermove', (e) => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      zoom = Math.max(1, Math.min(4, (zoom0 * Math.hypot(a!.x - b!.x, a!.y - b!.y)) / Math.max(1, pinch0)));
      slider.value = String(zoom);
    } else {
      ox += e.clientX - prev.x;
      oy += e.clientY - prev.y;
    }
    redraw();
  });
  const up = (e: PointerEvent) => pts.delete(e.pointerId);
  frame.addEventListener('pointerup', up);
  frame.addEventListener('pointercancel', up);
  const close = (result: string | null) => {
    root.remove();
    done(result);
  };
  cancel.addEventListener('click', () => close(null));
  ok.addEventListener('click', () => {
    const out = document.createElement('canvas');
    out.width = out.height = PHOTO;
    const ctx = out.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(PHOTO / 2, PHOTO / 2, PHOTO / 2, 0, Math.PI * 2);
    ctx.clip();
    paint(ctx, PHOTO);
    close(out.toDataURL('image/png'));
  });
}

/** Photos already turned into textures (or loading), by content hash. */
const photoKeys = new Map<string, Promise<string | null>>();

/**
 * Resolves any player's picture value (profile, chat message, photo) to a
 * texture key and calls `ready` with it: preset portraits at once (the small
 * thumbnail when `small`), photos once decoded (each distinct photo once).
 * Values that can't be shown (retired keys, broken images) leave the
 * monogram in place.
 */
export function avatarTexture(scene: Phaser.Scene, value: string, ready: (key: string) => void, small = false): void {
  const v = value ?? '';
  if (!v) return;
  if (!v.startsWith('data:')) {
    const preset = presetOfValue(v);
    if (!preset) return;
    const key = small && scene.textures.exists(thumbKey(preset)) ? thumbKey(preset) : faceKey(preset);
    if (scene.textures.exists(key)) ready(key);
    return;
  }
  const key = `photo-${hashOf(v)}`;
  if (scene.textures.exists(key)) return ready(key);
  let p = photoKeys.get(key);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (!scene.textures.exists(key)) scene.textures.addImage(key, img);
        resolve(key);
      };
      img.onerror = () => resolve(null);
      img.src = v;
    });
    photoKeys.set(key, p);
  }
  void p.then((k) => k && ready(k));
}
