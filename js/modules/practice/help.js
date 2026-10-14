// "Hoe werk dit?" – all the explanations for a module on one page,
// with a short note for parents at the top.

import { getProfile } from '../../core/storage.js';
import { t } from '../../core/i18n.js';
import { go } from '../../core/router.js';
import { mount, esc, setPlaying } from '../../ui/dom.js';
import { renderSetup } from './setup.js';

export function renderHelp(profileId, mod) {
  setPlaying(false);
  if (!getProfile(profileId)) return;

  const sections = [
    ['tables.mode', 'info.mode'],
    ['tables.order', 'info.order'],
    ['tables.op', 'info.op'],
    ['tables.which', 'info.which'],
    ['tables.turn', mod.turnInfo],
    ['tables.count', 'info.count']
  ];

  const paras = (key) => t(key).split('\n').map((p) => `<p>${esc(p)}</p>`).join('');

  const app = mount(`
    <section class="screen help">
      <div class="topbar">
        <button type="button" class="btn-icon" id="back" aria-label="back">←</button>
        <h2 data-i18n="help.title"></h2>
        <span></span>
      </div>

      <div class="parent-note">${paras('help.parents')}</div>

      ${sections.map(([heading, text]) => `
        <div class="help-section">
          <h3 data-i18n="${heading}"></h3>
          ${paras(text)}
        </div>`).join('')}

      <button type="button" class="btn btn-primary" id="done" data-i18n="help.back"></button>
    </section>`);

  const back = () => go(renderSetup, profileId, mod);
  app.querySelector('#back').addEventListener('click', back);
  app.querySelector('#done').addEventListener('click', back);
}
