// Tables module: choose mode, operation, tables and round size.

import { getProfile, load, save } from '../../core/storage.js';
import { go } from '../../core/router.js';
import { mount, setPlaying } from '../../ui/dom.js';
import { renderLearnerMenu } from '../../ui/learner-menu.js';
import { renderPlay } from './play.js';

const DEFAULTS = { mode: 'learn', learnOrder: 'order', op: 'mul', tables: [2, 3, 4, 5], count: 10 };

// Turnaround ("Draai om") starts off for Gr 1–3 and on for Gr 4+,
// matching when the curriculum teaches commutative pairs with the tables.
export function getSettings(profileId) {
  const profile = getProfile(profileId);
  const saved = load(`tables.settings.${profileId}`, {});
  return {
    ...DEFAULTS,
    turnaround: (profile?.grade ?? 1) >= 4,
    ...saved
  };
}

export function renderTablesSetup(profileId) {
  setPlaying(false);
  if (!getProfile(profileId)) return;

  const s = getSettings(profileId);

  const seg = (name, options) => options.map(([value, label, sub]) => `
    <button type="button" class="seg-btn" data-${name}="${value}">
      <span data-i18n="${label}"></span>
      ${sub ? `<small data-i18n="${sub}"></small>` : ''}
    </button>`).join('');

  const tableChips = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((n) => `<button type="button" class="chip" data-table="${n}">×${n}</button>`)
    .join('');

  const app = mount(`
    <section class="screen">
      <div class="topbar">
        <button type="button" class="btn-icon" id="back" aria-label="back">←</button>
        <h2 data-i18n="tables.title"></h2>
        <span></span>
      </div>

      <div class="field">
        <span data-i18n="tables.mode"></span>
        <div class="seg">${seg('mode', [
          ['learn', 'tables.learn', 'tables.learnSub'],
          ['game', 'tables.game', 'tables.gameSub']
        ])}</div>
      </div>

      <div class="field" id="order-field">
        <span data-i18n="tables.order"></span>
        <div class="seg">${seg('order', [
          ['order', 'tables.inOrder'],
          ['shuffle', 'tables.shuffled']
        ])}</div>
      </div>

      <div class="field">
        <span data-i18n="tables.op"></span>
        <div class="seg">${seg('op', [
          ['mul', 'tables.mul'],
          ['div', 'tables.div'],
          ['mix', 'tables.mix']
        ])}</div>
      </div>

      <div class="field">
        <div class="field-head">
          <span data-i18n="tables.which"></span>
          <span>
            <button type="button" class="btn-link" id="all" data-i18n="tables.all"></button>
            <button type="button" class="btn-link" id="none" data-i18n="tables.none"></button>
          </span>
        </div>
        <div class="chips">${tableChips}</div>
      </div>

      <div class="field">
        <span data-i18n="tables.turn"></span>
        <div class="seg">${seg('turn', [
          ['off', 'tables.off'],
          ['on', 'tables.on']
        ])}</div>
        <small class="hint" data-i18n="tables.turnHint"></small>
      </div>

      <div class="field" id="count-field">
        <span data-i18n="tables.count"></span>
        <div class="seg">
          <button type="button" class="seg-btn" data-count="10">10</button>
          <button type="button" class="seg-btn" data-count="20">20</button>
          <button type="button" class="seg-btn" data-count="30">30</button>
          <button type="button" class="seg-btn" data-count="inf">∞</button>
        </div>
        <small class="hint" id="inf-hint" data-i18n="tables.unlimitedHint"></small>
      </div>

      <small class="hint" id="learn-hint" data-i18n="tables.learnHint"></small>

      <p class="error" id="error" hidden data-i18n="tables.pickOne"></p>
      <button type="button" class="btn btn-primary" id="start" data-i18n="tables.start"></button>
    </section>`);

  // Show the current choices on the buttons.
  const refresh = () => {
    if (s.mode === 'learn' && s.count === 'inf') s.count = 10; // unlimited is a game only
    app.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === s.mode));
    app.querySelectorAll('[data-op]').forEach((b) => b.classList.toggle('on', b.dataset.op === s.op));
    app.querySelectorAll('[data-table]').forEach((b) =>
      b.classList.toggle('on', s.tables.includes(Number(b.dataset.table))));
    app.querySelectorAll('[data-count]').forEach((b) => {
      b.classList.toggle('on', String(s.count) === b.dataset.count);
      if (b.dataset.count === 'inf') b.hidden = s.mode !== 'game';
    });
    app.querySelectorAll('[data-turn]').forEach((b) =>
      b.classList.toggle('on', (b.dataset.turn === 'on') === s.turnaround));
    app.querySelector('#inf-hint').hidden = s.count !== 'inf';
    // Learn mode goes through the chosen tables in order, so no question count.
    app.querySelector('#count-field').hidden = s.mode === 'learn';
    app.querySelector('#order-field').hidden = s.mode !== 'learn';
    app.querySelectorAll('[data-order]').forEach((b) =>
      b.classList.toggle('on', b.dataset.order === s.learnOrder));
    app.querySelector('#learn-hint').hidden = !(s.mode === 'learn' && s.learnOrder === 'order');
    app.querySelector('#error').hidden = true;
  };

  app.querySelectorAll('[data-turn]').forEach((b) =>
    b.addEventListener('click', () => { s.turnaround = b.dataset.turn === 'on'; refresh(); }));
  app.querySelectorAll('[data-order]').forEach((b) =>
    b.addEventListener('click', () => { s.learnOrder = b.dataset.order; refresh(); }));

  app.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => { s.mode = b.dataset.mode; refresh(); }));
  app.querySelectorAll('[data-op]').forEach((b) =>
    b.addEventListener('click', () => { s.op = b.dataset.op; refresh(); }));
  app.querySelectorAll('[data-count]').forEach((b) =>
    b.addEventListener('click', () => {
      s.count = b.dataset.count === 'inf' ? 'inf' : Number(b.dataset.count);
      refresh();
    }));
  app.querySelectorAll('[data-table]').forEach((b) =>
    b.addEventListener('click', () => {
      const n = Number(b.dataset.table);
      s.tables = s.tables.includes(n) ? s.tables.filter((x) => x !== n) : [...s.tables, n];
      refresh();
    }));
  app.querySelector('#all').addEventListener('click', () => {
    s.tables = Array.from({ length: 12 }, (_, i) => i + 1);
    refresh();
  });
  app.querySelector('#none').addEventListener('click', () => { s.tables = []; refresh(); });

  app.querySelector('#back').addEventListener('click', () => go(renderLearnerMenu, profileId));
  app.querySelector('#start').addEventListener('click', () => {
    if (s.tables.length === 0) {
      app.querySelector('#error').hidden = false;
      return;
    }
    s.tables.sort((x, y) => x - y);
    save(`tables.settings.${profileId}`, s);
    go(renderPlay, profileId, { ...s });
  });

  refresh();
}
