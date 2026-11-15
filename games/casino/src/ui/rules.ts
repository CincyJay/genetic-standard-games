import Phaser from 'phaser';
import { RULES, type RulesKey } from '../data/rules.ts';
import { THEME, audio } from '../services.ts';

/**
 * The Rules sheet: a game's full rules in an HTML overlay above the canvas. HTML (not
 * canvas text) so it scrolls natively, is sized in dp, and follows Android's font-size
 * setting. Close with the button, a tap outside the sheet, or the Android back button.
 */
let open: { el: HTMLElement; close: () => void } | null = null;

/** Closes the sheet if one is open; returns whether it was (the back button uses this). */
export function closeRulesSheet(): boolean {
  if (!open) return false;
  open.close();
  return true;
}

export function isRulesOpen(): boolean {
  return open !== null;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function showRules(scene: Phaser.Scene, key: RulesKey): void {
  closeRulesSheet();
  const r = RULES[key];
  const font = THEME.font;
  const el = document.createElement('div');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', `${r.title} rules`);
  el.id = 'va-rules';
  el.innerHTML = `
<style>
#va-rules{position:fixed;inset:0;z-index:50;background:rgba(5,2,8,.72);display:flex;align-items:flex-end;justify-content:center;font-family:${font};
  padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
#va-rules .sheet{box-sizing:border-box;width:100%;max-width:560px;max-height:88%;display:flex;flex-direction:column;background:linear-gradient(#24112e,#120818);
  border:2px solid #e9c86a;border-bottom:none;border-radius:22px 22px 0 0;color:#f3e6f0;box-shadow:0 -8px 30px rgba(0,0,0,.6)}
#va-rules header{display:flex;align-items:center;gap:12px;padding:8px 8px 8px 20px;border-bottom:1px solid rgba(233,200,106,.35)}
#va-rules h2{flex:1;margin:0;font-size:22px;color:#ffe9a8;font-weight:800}
#va-rules button{min-width:48px;min-height:48px;border-radius:24px;border:2px solid #e9c86a;background:#2a1636;color:#ffe9a8;font:800 16px ${font};padding:0 18px}
#va-rules .body{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 20px 24px;font-size:17px;line-height:1.45}
#va-rules .intro{margin:4px 0 8px;color:#ffffff}
#va-rules h3{margin:18px 0 6px;font-size:18px;color:#e9c86a;font-weight:800}
#va-rules ul{margin:0;padding-left:20px}
#va-rules li{margin:4px 0}
#va-rules .note{margin-top:20px;font-size:14px;color:#cbb6d6}
</style>
<div class="sheet">
  <header><h2>${esc(r.title)} rules</h2><button type="button" class="close">Close</button></header>
  <div class="body">
    <p class="intro">${esc(r.intro)}</p>
    ${r.sections.map((s) => `<h3>${esc(s.head)}</h3><ul>${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`).join('')}
    <p class="note">Play money only. Coins have no cash value and can never be withdrawn.</p>
  </div>
</div>`;
  const close = () => {
    if (open?.el !== el) return;
    el.remove();
    open = null;
    scene.input.enabled = true;
  };
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    if (e.target === el || (e.target as HTMLElement).classList.contains('close')) {
      audio.tap();
      close();
    }
  });
  document.body.appendChild(el);
  // the canvas underneath must not react while the sheet is up
  scene.input.enabled = false;
  open = { el, close };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, close);
  (el.querySelector('.close') as HTMLButtonElement).focus();
}
