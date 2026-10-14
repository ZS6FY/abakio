// "Staan reg…" signal during the calm pause after a mistake.
// A thin bar slowly empties over the pause, and "Staan reg…" fades in softly
// during the last second. No flashing: the pause is there so a child can
// settle, not to rush them. Pure CSS animation, so no timers to clean up.

import { t } from '../core/i18n.js';
import { esc } from './dom.js';

export function showPauseBar(slot, ms) {
  if (!slot) return;
  const delay = Math.max(0, ms - 1000);
  slot.innerHTML = `
    <div class="pause-bar" aria-hidden="true"><div class="pause-fill" style="animation-duration:${ms}ms"></div></div>
    <div class="ready" style="animation-delay:${delay}ms">${esc(t('play.ready'))}</div>`;
}

export function clearPauseBar(slot) {
  if (slot) slot.innerHTML = '';
}
