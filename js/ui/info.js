// ⓘ info tags: a small button next to a heading that opens a short
// explanation card right below it. Texts live in the language files;
// a line break ("\n") in the text starts a new paragraph.

import { t } from '../core/i18n.js';
import { load, save } from '../core/storage.js';
import { esc } from './dom.js';

// The ⓘ button that goes next to a heading.
export function infoTag(id) {
  return `<button type="button" class="info-btn" data-info="${id}"
            aria-expanded="false" aria-label="${esc(t('info.label'))}">i</button>`;
}

// The card itself (hidden until the ⓘ is tapped).
export function infoCard(id, textKey) {
  const paragraphs = t(textKey).split('\n').map((p) => `<p>${esc(p)}</p>`).join('');
  return `<div class="info-card" data-info-card="${id}" hidden>${paragraphs}</div>`;
}

// Make the ⓘ buttons work. On a learner's first visit to a screen all cards
// open by themselves once, so nobody has to know about the ⓘ to find help.
export function wireInfo(root, screenKey, profileId) {
  const toggle = (id, open) => {
    const card = root.querySelector(`[data-info-card="${id}"]`);
    const btn = root.querySelector(`[data-info="${id}"]`);
    if (!card || !btn) return;
    card.hidden = !open;
    btn.classList.toggle('on', open);
    btn.setAttribute('aria-expanded', String(open));
  };

  root.querySelectorAll('[data-info]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const id = btn.dataset.info;
      const card = root.querySelector(`[data-info-card="${id}"]`);
      toggle(id, card.hidden);
    }));

  // Key ends in ".<learnerId>" so it is removed with the learner.
  const seenKey = `info.${screenKey}.${profileId}`;
  if (!load(seenKey, false)) {
    root.querySelectorAll('[data-info]').forEach((btn) => toggle(btn.dataset.info, true));
    save(seenKey, true);
  }
}
