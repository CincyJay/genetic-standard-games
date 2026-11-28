/**
 * The phone's keyboard shortens the window, which would shrink the whole game
 * into the space above it. The game's box keeps its height while a text field
 * is being typed in (the keyboard simply covers the bottom) and follows the
 * window again once the window is full height or nothing is being typed.
 */
export function holdGameHeight(id = 'game'): void {
  const el = document.getElementById(id);
  if (!el) return;
  const fit = () => {
    const typing = document.activeElement instanceof HTMLInputElement;
    if (typing && window.innerHeight < el.clientHeight) return;
    el.style.height = `${window.innerHeight}px`;
  };
  fit();
  // registered before Phaser starts, so the box is settled when Phaser measures it
  window.addEventListener('resize', fit);
}
