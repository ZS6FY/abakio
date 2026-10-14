// Setup screen for Maak 'n getal: mode, step, + / −, which numbers,
// pictures and round size.

import { getProfile, load, save } from '../../core/storage.js';
import { t } from '../../core/i18n.js';
import { go } from '../../core/router.js';
import { mount, setPlaying } from '../../ui/dom.js';
import { renderLearnerMenu } from '../../ui/learner-menu.js';
import { infoTag, infoCard, wireInfo } from '../../ui/info.js';
import { renderHelp } from '../practice/help.js';
import { renderMakePlay } from './play.js';

const MIN = 3;
const MAX = 20;
const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

// Gr 1: plus only, numbers 5–10, pictures on. Gr 2 and up: plus and minus,
// numbers 10–20, pictures only after a mistake. Everything can be changed.
export function getMakeSettings(profileId) {
  const grade = getProfile(profileId)?.grade ?? 1;
  const young = grade <= 1;
  return {
    mode: 'learn',
    step: 'sum',
    op: young ? 'add' : 'mix',
    targets: young ? range(5, 10) : range(10, 20),
    pictures: young ? 'on' : 'help',
    count: 10,
    ...load(`make.settings.${profileId}`, {})
  };
}

// Example sums on the step buttons follow the chosen + / −.
const EXAMPLES = {
  sum: { add: '6 + 3 = □', sub: '9 − 5 = □', mix: '6 + 3 · 9 − 5' },
  bond: { add: '6 + □ = 9', sub: '9 − □ = 4', mix: '6 + □ · 9 − □' },
  pick2: { add: '□ + □ = 9', sub: '□ − □ = 4', mix: '□ + □ · □ − □' },
  pick3: { add: '□ + □ + □', sub: '□ − □ − □', mix: '□ + □ + □ · □ − □ − □' }
};

export function renderMakeSetup(profileId, mod) {
  setPlaying(false);
  if (!getProfile(profileId)) return;
  const s = getMakeSettings(profileId);
  const key = `make.settings.${profileId}`;

  const seg = (name, options) => options.map(([value, label, sub]) => `
    <button type="button" class="seg-btn" data-${name}="${value}">
      <span ${label ? `data-i18n="${label}"` : ''}></span>
      ${sub !== undefined ? `<small>${sub}</small>` : ''}
    </button>`).join('');

  const chips = range(MIN, MAX)
    .map((n) => `<button type="button" class="chip" data-target="${n}">${n}</button>`).join('');

  const app = mount(`
    <section class="screen">
      <div class="topbar">
        <button type="button" class="btn-icon" id="back" aria-label="back">←</button>
        <h2 data-i18n="make.title"></h2>
        <span></span>
      </div>

      <button type="button" class="btn-link help-link" id="help-link" data-i18n="help.link"></button>

      <div class="field">
        <span class="field-label"><span data-i18n="tables.mode"></span>${infoTag('mode')}</span>
        ${infoCard('mode', 'info.mode')}
        <div class="seg">${seg('mode', [
          ['learn', 'tables.learn', ''],
          ['game', 'tables.game', '']
        ])}</div>
      </div>

      <div class="field">
        <span class="field-label"><span data-i18n="make.step"></span>${infoTag('step')}</span>
        ${infoCard('step', 'info.makeStep')}
        <div class="seg seg-grid">${seg('step', [
          ['sum', '', ''], ['bond', 'make.stepBond', ''],
          ['pick2', 'make.stepPick2', ''], ['pick3', 'make.stepPick3', '']
        ])}</div>
      </div>

      <div class="field">
        <span class="field-label"><span data-i18n="tables.op"></span>${infoTag('op')}</span>
        ${infoCard('op', 'info.makeOp')}
        <div class="seg">${seg('op', [
          ['add', 'make.add'], ['sub', 'make.sub'], ['mix', 'tables.mix']
        ])}</div>
      </div>

      <div class="field">
        <div class="field-head">
          <span class="field-label"><span data-i18n="make.targets"></span>${infoTag('targets')}</span>
          <span>
            <button type="button" class="btn-link" id="all" data-i18n="tables.all"></button>
            <button type="button" class="btn-link" id="none" data-i18n="tables.none"></button>
          </span>
        </div>
        ${infoCard('targets', 'info.makeTargets')}
        <div class="chips">${chips}</div>
      </div>

      <div class="field">
        <span class="field-label"><span data-i18n="make.pictures"></span>${infoTag('pictures')}</span>
        ${infoCard('pictures', 'info.makePictures')}
        <div class="seg">${seg('pictures', [
          ['on', 'make.picsOn'], ['help', 'make.picsHelp'], ['off', 'make.picsOff']
        ])}</div>
      </div>

      <div class="field" id="count-field">
        <span class="field-label"><span data-i18n="tables.count"></span>${infoTag('count')}</span>
        ${infoCard('count', 'info.count')}
        <div class="seg">
          <button type="button" class="seg-btn" data-count="10">10</button>
          <button type="button" class="seg-btn" data-count="20">20</button>
          <button type="button" class="seg-btn" data-count="30">30</button>
          <button type="button" class="seg-btn" data-count="inf">∞</button>
        </div>
      </div>

      <p class="error" id="error" hidden data-i18n="make.pickOne"></p>
      <button type="button" class="btn btn-primary" id="start" data-i18n="tables.start"></button>
    </section>`);

  // Sub-labels of the mode buttons (same texts as the other modules).
  app.querySelector('[data-mode="learn"] small').textContent = t('tables.learnSub');
  app.querySelector('[data-mode="game"] small').textContent = t('tables.gameSub');

  const refresh = () => {
    if (s.mode === 'learn') s.count = 10;
    const on = (attr, value) => app.querySelectorAll(`[data-${attr}]`).forEach((b) =>
      b.classList.toggle('on', b.dataset[attr] === String(value)));
    on('mode', s.mode);
    on('step', s.step);
    on('op', s.op);
    on('pictures', s.pictures);
    on('count', s.count);
    app.querySelectorAll('[data-target]').forEach((b) =>
      b.classList.toggle('on', s.targets.includes(Number(b.dataset.target))));
    // The first step's name follows the sign: Tel saam (+), Wat bly oor (−).
    app.querySelector('[data-step="sum"] span').textContent = t(`make.stepSum.${s.op}`);
    app.querySelectorAll('[data-step]').forEach((b) => {
      b.querySelector('small').textContent = EXAMPLES[b.dataset.step][s.op];
    });
    app.querySelector('#count-field').hidden = s.mode === 'learn';
    app.querySelector('#error').hidden = true;
  };

  const bind = (attr, apply) => app.querySelectorAll(`[data-${attr}]`).forEach((b) =>
    b.addEventListener('click', () => { apply(b.dataset[attr]); refresh(); }));
  bind('mode', (v) => { s.mode = v; });
  bind('step', (v) => { s.step = v; });
  bind('op', (v) => { s.op = v; });
  bind('pictures', (v) => { s.pictures = v; });
  bind('count', (v) => { s.count = v === 'inf' ? 'inf' : Number(v); });
  bind('target', (v) => {
    const n = Number(v);
    s.targets = s.targets.includes(n) ? s.targets.filter((x) => x !== n) : [...s.targets, n];
  });
  app.querySelector('#all').addEventListener('click', () => { s.targets = range(MIN, MAX); refresh(); });
  app.querySelector('#none').addEventListener('click', () => { s.targets = []; refresh(); });

  app.querySelector('#back').addEventListener('click', () => go(renderLearnerMenu, profileId));
  app.querySelector('#help-link').addEventListener('click', () => { save(key, s); go(renderHelp, profileId, mod); });
  wireInfo(app, 'make.setup', profileId);

  app.querySelector('#start').addEventListener('click', () => {
    if (!s.targets.length) { app.querySelector('#error').hidden = false; return; }
    s.targets.sort((x, y) => x - y);
    save(key, s);
    go(renderMakePlay, profileId, { ...s }, mod);
  });

  refresh();
}
