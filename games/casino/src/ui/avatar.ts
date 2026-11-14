import Phaser from 'phaser';
import { save } from '../services.ts';

/** Size photos are stored at (round PNG). */
const PHOTO = 256;
let defaultImage: HTMLImageElement | HTMLCanvasElement | null = null;

/**
 * Draws the player's chosen picture into the 'av-you' canvas texture: the
 * default portrait, one of the pick-* portraits, or an uploaded photo. The
 * texture is redrawn in place, so every image already showing it updates and
 * nothing ever points at a removed texture. Calls `done` once it's drawn.
 */
export function applyAvatar(scene: Phaser.Scene, done: () => void = () => {}): void {
  const tex = scene.textures;
  // first call (at boot): swap the loaded portrait for a canvas we can redraw
  if (!defaultImage) {
    defaultImage = tex.get('av-you').getSourceImage() as HTMLImageElement;
    tex.remove('av-you');
    tex.createCanvas('av-you', PHOTO, PHOTO);
  }
  const canvas = tex.get('av-you') as Phaser.Textures.CanvasTexture;
  const draw = (src: CanvasImageSource) => {
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, PHOTO, PHOTO);
    ctx.drawImage(src, 0, 0, PHOTO, PHOTO);
    canvas.refresh();
    done();
  };
  const v = save.get().avatar ?? '';
  if (v.startsWith('data:')) {
    const img = new Image();
    img.onload = () => draw(img);
    img.onerror = () => draw(defaultImage!);
    img.src = v;
    return;
  }
  const key = v ? (v.startsWith('av-') ? v : `av-${v}`) : '';
  draw(key && tex.exists(key) ? (tex.get(key).getSourceImage() as HTMLImageElement) : defaultImage);
}

export function setAvatar(scene: Phaser.Scene, value: string, done?: () => void): void {
  save.update((d) => {
    d.avatar = value;
  });
  applyAvatar(scene, done);
}

/** Crops the middle square of an image file to a round portrait and saves it. */
function usePhoto(scene: Phaser.Scene, file: File, done: () => void): void {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const side = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = PHOTO;
    const ctx = c.getContext('2d')!;
    // round, like the other portraits (transparent corners)
    ctx.beginPath();
    ctx.arc(PHOTO / 2, PHOTO / 2, PHOTO / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, PHOTO, PHOTO);
    URL.revokeObjectURL(url);
    setAvatar(scene, c.toDataURL('image/png'), done);
  };
  img.src = url;
}

/**
 * Places a transparent <input type="file"> over a button (world coordinates),
 * so tapping the button opens the phone's photo picker (gallery or camera).
 * Browsers only open file pickers from a direct tap, which this guarantees.
 * Returns the element; remove it when the button goes away.
 */
export function photoInputOver(scene: Phaser.Scene, x: number, y: number, w: number, h: number, done: () => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
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
    input.remove();
    if (file) usePhoto(scene, file, done);
  });
  scene.scale.on('resize', place);
  scene.events.once('shutdown', () => input.remove());
  return input;
}
