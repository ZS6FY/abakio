// Setup screen for Maak 24: how many dots (difficulty) and whether numbers
// above 9 may appear.

import { getProfile, load, save } from '../../core/storage.js';
import { t } from '../../core/i18n.js';
import { go } from '../../core/router.js';
import { mount, esc, setPlaying } from '../../ui/dom.js';
import { renderLearnerMenu } from '../../ui/learner-menu.js';
import { infoTag, infoCard, wireInfo } from '../../ui/info.js';
import { renderHelp } from '../practice/help.js';
import { renderMake24Play } from './play.js';

// No grade-based defaults yet: every learner starts on the easiest cards.
export function getMake24Settings(profileId) {
  const s = { dots: 1, big: false, ...load(`make24.settings.${profileId}`, {}) };
  if (![1, 2, 3].includes(s.dots)) s.dots = 1;
  s.big = Boolean(s.big);
  return s;
}

export function renderMake24Setup(profileId, mod) {
  setPlaying(false);
  if (!getProfile(profileId)) return;
  const s = getMake24Settings(profileId);
  const key = `make24.settings.${profileId}`;

  const dotButtons = [1, 2, 3].map((n) => `
    <button type="button" class="seg-btn" data-dots="${n}" aria-label="${esc(t('make24.level', { n }))}">
      <span class="dot-row">${'●'.repeat(n)}</span>
    </button>`).join('');

  const app = mount(`
    <section class="screen">
      <div class="topbar">
        <button type="button" class="btn-icon" id="back" aria-label="back">←</button>
        <h2 data-i18n="make24.title"></h2>
        <span></span>
      </div>

      <button type="button" class="btn-link help-link" id="help-link" data-i18n="help.link"></button>

      <div class="field">
        <span class="field-label"><span data-i18n="make24.difficulty"></span>${infoTag('level')}</span>
        ${infoCard('level', 'info.make24Level')}
        <div class="seg">${dotButtons}</div>
      </div>

      <div class="field">
        <span class="field-label"><span data-i18n="make24.big"></span>${infoTag('big')}</span>
        ${infoCard('big', 'info.make24Big')}
        <div class="seg">
          <button type="button" class="seg-btn" data-big="yes" data-i18n="make24.yes"></button>
          <button type="button" class="seg-btn" data-big="no" data-i18n="make24.no"></button>
        </div>
      </div>

      <button type="button" class="btn btn-primary" id="start" data-i18n="tables.start"></button>
    </section>`);

  const refresh = () => {
    app.querySelectorAll('[data-dots]').forEach((b) =>
      b.classList.toggle('on', Number(b.dataset.dots) === s.dots));
    app.querySelectorAll('[data-big]').forEach((b) =>
      b.classList.toggle('on', (b.dataset.big === 'yes') === s.big));
  };

  app.querySelectorAll('[data-dots]').forEach((b) => b.addEventListener('click', () => {
    s.dots = Number(b.dataset.dots);
    save(key, s);
    refresh();
  }));
  app.querySelectorAll('[data-big]').forEach((b) => b.addEventListener('click', () => {
    s.big = b.dataset.big === 'yes';
    save(key, s);
    refresh();
  }));

  app.querySelector('#back').addEventListener('click', () => go(renderLearnerMenu, profileId));
  app.querySelector('#help-link').addEventListener('click', () => go(renderHelp, profileId, mod));
  wireInfo(app, 'make24.setup', profileId);

  app.querySelector('#start').addEventListener('click', () => {
    save(key, s);
    go(renderMake24Play, profileId, { ...s }, mod);
  });

  refresh();
}
