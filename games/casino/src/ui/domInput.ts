import Phaser from 'phaser';

/**
 * A real HTML text field laid over the game at world position (x, y), so
 * players get the phone's own keyboard, autocorrect and emoji. Removed when the
 * scene shuts down. `onEnter` runs on the keyboard's send/enter key.
 */
export function textInput(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  placeholder: string,
  onEnter: (value: string) => void,
  maxLength = 200,
): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.maxLength = maxLength;
  input.enterKeyHint = 'send';
  input.autocomplete = 'off';
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
      boxSizing: 'border-box',
      padding: `0 ${14 * sx}px`,
      fontSize: `${Math.round(h * sy * 0.42)}px`,
      fontFamily: 'Outfit, system-ui, sans-serif',
      color: '#ffffff',
      background: 'rgba(16,8,24,0.92)',
      border: '2px solid rgba(233,200,106,0.8)',
      borderRadius: `${(h * sy) / 2}px`,
      outline: 'none',
      zIndex: '10',
      userSelect: 'text',
      webkitUserSelect: 'text',
    });
  };
  place();
  document.body.appendChild(input);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      onEnter(input.value);
      e.preventDefault();
    }
  });
  scene.scale.on('resize', place);
  scene.events.once('shutdown', () => input.remove());
  return input;
}
