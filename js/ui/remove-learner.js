// Remove a learner: pick who, then confirm by typing their name.
// Typing the name is a deliberate speed bump so a child can't remove
// a sibling with two taps. A parent PIN will replace or add to this later.

import { getProfiles, getProfile, removeProfile } from '../core/storage.js';
import { t } from '../core/i18n.js';
import { go } from '../core/router.js';
import { mount, esc, setPlaying } from './dom.js';
import { renderHome } from './home.js';

export function renderRemoveLearner() {
  setPlaying(false);
  const profiles = getProfiles();

  const list = profiles.map((p) => `
    <button type="button" class="btn remove-pick" data-id="${esc(p.id)}">
      ${esc(p.name)} · ${t('common.grade')} ${p.grade}
    </button>`).join('');

  const app = mount(`
    <section class="screen">
      <div class="topbar">
        <button type="button" class="btn-icon" id="back" aria-label="back">←</button>
        <h2 data-i18n="remove.title"></h2>
        <span></span>
      </div>
      <p data-i18n="remove.pick"></p>
      <div class="profile-list">${list}</div>
    </section>`);

  app.querySelector('#back').addEventListener('click', () => go(renderHome));
  app.querySelectorAll('.remove-pick').forEach((btn) =>
    btn.addEventListener('click', () => go(renderConfirmRemove, btn.dataset.id)));
}

function renderConfirmRemove(profileId) {
  setPlaying(false);
  const profile = getProfile(profileId);
  if (!profile) return go(renderHome);

  const app = mount(`
    <section class="screen">
      <div class="topbar">
        <button type="button" class="btn-icon" id="back" aria-label="back">←</button>
        <h2 data-i18n="remove.title"></h2>
        <span></span>
      </div>

      <div class="warning">
        <p class="warning-title">⚠️ ${esc(t('remove.confirmTitle', { name: profile.name }))}</p>
        <p>${esc(t('remove.confirmText', { name: profile.name }))}</p>
        <p><strong data-i18n="remove.cannotUndo"></strong></p>
      </div>

      <label class="field">
        <span>${esc(t('remove.typeName', { name: profile.name }))}</span>
        <input id="confirm-name" type="text" autocomplete="off">
      </label>

      <button type="button" class="btn btn-danger" id="remove" disabled data-i18n="remove.confirmBtn"></button>
      <button type="button" class="btn" id="cancel" data-i18n="remove.cancel"></button>
    </section>`);

  const input = app.querySelector('#confirm-name');
  const removeBtn = app.querySelector('#remove');
  const matches = () => input.value.trim().toLowerCase() === profile.name.trim().toLowerCase();

  input.addEventListener('input', () => { removeBtn.disabled = !matches(); });
  removeBtn.addEventListener('click', () => {
    if (!matches()) return;
    removeProfile(profileId);
    go(renderHome);
  });
  app.querySelector('#cancel').addEventListener('click', () => go(renderHome));
  app.querySelector('#back').addEventListener('click', () => go(renderRemoveLearner));
}
