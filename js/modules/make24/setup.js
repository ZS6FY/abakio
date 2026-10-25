// Setup screen for Maak 24: free play, Uitdaging (with a round size) or Saamspeel, how many
// dots (difficulty) and whether numbers above 9 may appear.

import { getProfile, load, save } from '../../core/storage.js';
import { t } from '../../core/i18n.js';
import { go } from '../../core/router.js';
import { mount, esc, setPlaying } from '../../ui/dom.js';
import { renderLearnerMenu } from '../../ui/learner-menu.js';
import { infoTag, infoCard, wireInfo } from '../../ui/info.js';
import { renderHelp } from '../practice/help.js';
import { renderMake24Play } from './play.js';
import { renderMake24Join } from './together.js';
import { SKIP_PENALTY_MS, GAME_CARDS } from './board.js';

// No grade-based defaults yet: every learner starts on the easiest cards, in free play.
// Saamspeel keeps its own difficulty (togetherDots), Lukraak by default.
export function getMake24Settings(profileId) {
  const s = { mode: 'free', dots: 1, togetherDots: 'random', big: false, count: 5, ...load(`make24.settings.${profileId}`, {}) };
  if (!['free', 'challenge', 'together'].includes(s.mode)) s.mode = 'free';
  if (![1, 2, 3, 'random'].includes(s.dots)) s.dots = 1;
  if (![1, 2, 3, 'random'].includes(s.togetherDots)) s.togetherDots = 'random';
  if (![5, 10, 'inf'].includes(s.count)) s.count = 5;
  s.big = Boolean(s.big);
  return s;
}

export function renderMake24Setup(profileId, mod) {
  setPlaying(false);
  if (!getProfile(profileId)) return;
  const s = getMake24Settings(profileId);
  const key = `make24.settings.${profileId}`;
  const dotsKey = () => (s.mode === 'together' ? 'togetherDots' : 'dots');

  // The dots are drawn in the same colours as on the card: teal, orange, yellow.
  const dotButtons = [1, 2, 3].map((n) => `
    <button type="button" class="seg-btn m24-level" data-dots="${n}" aria-label="${esc(t('make24.level', { n }))}">
      <span class="m24-lvl l${n}" aria-hidden="true">${'<i></i>'.repeat(n)}</span>
    </button>`).join('')
    + `<button type="button" class="seg-btn m24-level m24-random" data-dots="random" data-i18n="make24.random"></button>`;

  const app = mount(`
    <section class="screen">
      <div class="topbar">
        <button type="button" class="btn-icon" id="back" aria-label="back">←</button>
        <h2 data-i18n="make24.title"></h2>
        <span></span>
      </div>

      <button type="button" class="btn-link help-link" id="help-link" data-i18n="help.link"></button>

      <div class="field">
        <span class="field-label"><span data-i18n="make24.mode"></span>${infoTag('mode')}</span>
        ${infoCard('mode', 'info.make24Mode', { n: SKIP_PENALTY_MS / 1000, cards: GAME_CARDS })}
        <div class="seg">
          <button type="button" class="seg-btn" data-mode="free"><span data-i18n="make24.free"></span><small data-i18n="tables.learnSub"></small></button>
          <button type="button" class="seg-btn" data-mode="challenge"><span data-i18n="make24.challenge"></span><small data-i18n="tables.gameSub"></small></button>
          <button type="button" class="seg-btn" data-mode="together"><span data-i18n="make24.together.mode"></span><small data-i18n="make24.together.modeSub"></small></button>
        </div>
      </div>

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

      <div class="field" id="count-field">
        <span class="field-label"><span data-i18n="make24.count"></span>${infoTag('count')}</span>
        ${infoCard('count', 'info.make24Count')}
        <div class="seg">
          <button type="button" class="seg-btn" data-count="5">5</button>
          <button type="button" class="seg-btn" data-count="10">10</button>
          <button type="button" class="seg-btn" data-count="inf">∞</button>
        </div>
      </div>

      <button type="button" class="btn btn-primary" id="start" data-i18n="tables.start"></button>
    </section>`);

  const refresh = () => {
    app.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === s.mode));
    app.querySelectorAll('[data-count]').forEach((b) => b.classList.toggle('on', b.dataset.count === String(s.count)));
    app.querySelector('#count-field').hidden = s.mode !== 'challenge'; // the round size is for Uitdaging only
    app.querySelectorAll('[data-dots]').forEach((b) =>
      b.classList.toggle('on', b.dataset.dots === String(s[dotsKey()])));
    app.querySelectorAll('[data-big]').forEach((b) =>
      b.classList.toggle('on', (b.dataset.big === 'yes') === s.big));
  };

  app.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    s.mode = b.dataset.mode;
    save(key, s);
    refresh();
  }));
  app.querySelectorAll('[data-count]').forEach((b) => b.addEventListener('click', () => {
    s.count = b.dataset.count === 'inf' ? 'inf' : Number(b.dataset.count);
    save(key, s);
    refresh();
  }));
  app.querySelectorAll('[data-dots]').forEach((b) => b.addEventListener('click', () => {
    s[dotsKey()] = b.dataset.dots === 'random' ? 'random' : Number(b.dataset.dots);
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
    if (s.mode === 'together') {
      go(renderMake24Join, profileId, { mode: 'together', dots: s.togetherDots, big: s.big }, mod);
    } else {
      go(renderMake24Play, profileId, { ...s }, mod);
    }
  });

  refresh();
}
