// Form for adding a learner: first name and grade only.

import { addProfile } from '../core/storage.js';
import { go } from '../core/router.js';
import { mount, setPlaying } from './dom.js';
import { renderHome } from './home.js';

export function renderAddLearner() {
  setPlaying(false);
  let grade = 1;

  const gradeButtons = [1, 2, 3, 4, 5, 6, 7]
    .map((g) => `<button type="button" class="chip${g === grade ? ' on' : ''}" data-grade="${g}">${g}</button>`)
    .join('');

  const app = mount(`
    <section class="screen">
      <div class="topbar">
        <button type="button" class="btn-icon" id="back" aria-label="back">←</button>
        <h2 data-i18n="add.title"></h2>
        <span></span>
      </div>

      <label class="field">
        <span data-i18n="add.name"></span>
        <input id="name" type="text" maxlength="20" autocomplete="off" data-i18n-placeholder="add.namePlaceholder">
      </label>

      <div class="field">
        <span data-i18n="common.grade"></span>
        <div class="chips">${gradeButtons}</div>
      </div>

      <p class="error" id="error" hidden data-i18n="add.needName"></p>

      <button type="button" class="btn btn-primary" id="save" data-i18n="add.save"></button>
    </section>`);

  const nameInput = app.querySelector('#name');
  nameInput.focus();

  app.querySelectorAll('[data-grade]').forEach((btn) => {
    btn.addEventListener('click', () => {
      grade = Number(btn.dataset.grade);
      app.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('on', b === btn));
    });
  });

  const saveLearner = () => {
    const name = nameInput.value.trim();
    if (!name) {
      app.querySelector('#error').hidden = false;
      nameInput.focus();
      return;
    }
    addProfile(name, grade);
    go(renderHome);
  };

  app.querySelector('#save').addEventListener('click', saveLearner);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveLearner(); });
  app.querySelector('#back').addEventListener('click', () => go(renderHome));
}
