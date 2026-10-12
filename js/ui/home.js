// Home screen: pick a learner or add a new one.

import { getProfiles } from '../core/storage.js';
import { t } from '../core/i18n.js';
import { go } from '../core/router.js';
import { mount, esc, setPlaying } from './dom.js';
import { renderAddLearner } from './add-learner.js';
import { renderLearnerMenu } from './learner-menu.js';

export function renderHome() {
  setPlaying(false);
  const profiles = getProfiles();

  const list = profiles.length
    ? profiles.map((p) => `
        <button type="button" class="btn profile-btn" data-id="${esc(p.id)}">
          ${esc(p.name)} · ${t('common.grade')} ${p.grade}
        </button>`).join('')
    : '<p class="empty" data-i18n="home.noProfiles"></p>';

  const app = mount(`
    <section class="screen">
      <img class="mascot" src="assets/icons/icon-512.png" alt="" width="160" height="160">
      <h1>Abakio</h1>
      <p class="tagline" data-i18n="home.tagline"></p>
      <div class="profile-list">${list}</div>
      <button type="button" class="btn btn-primary" id="add-btn" data-i18n="home.addProfile"></button>
    </section>`);

  app.querySelectorAll('.profile-btn').forEach((btn) => {
    btn.addEventListener('click', () => go(renderLearnerMenu, btn.dataset.id));
  });
  app.querySelector('#add-btn').addEventListener('click', () => go(renderAddLearner));
}
