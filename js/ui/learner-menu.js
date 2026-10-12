// A learner's own menu: one tile per module.

import { getProfile } from '../core/storage.js';
import { t } from '../core/i18n.js';
import { go } from '../core/router.js';
import { mount, esc, setPlaying } from './dom.js';
import { renderHome } from './home.js';
import { renderSetup } from '../modules/practice/setup.js';
import { TABLES } from '../modules/tables/module.js';
import { MISSING } from '../modules/missing/module.js';
import { renderTrophyRoom } from './trophy-room.js';

export function renderLearnerMenu(profileId) {
  setPlaying(false);
  const profile = getProfile(profileId);
  if (!profile) return go(renderHome);

  const app = mount(`
    <section class="screen">
      <div class="topbar">
        <button type="button" class="btn-icon" id="back" aria-label="back">←</button>
        <h2>${esc(t('menu.hello', { name: profile.name }))}</h2>
        <span></span>
      </div>

      <div class="tiles">
        <button type="button" class="tile" id="tile-tables">
          <span class="tile-icon">×÷</span>
          <span class="tile-title" data-i18n="menu.tables"></span>
          <span class="tile-sub" data-i18n="menu.tablesSub"></span>
        </button>

        <button type="button" class="tile" id="tile-missing">
          <span class="tile-icon">?×2</span>
          <span class="tile-title" data-i18n="menu.missing"></span>
          <span class="tile-sub" data-i18n="menu.missingSub"></span>
        </button>

        <button type="button" class="tile" disabled>
          <span class="tile-icon">24</span>
          <span class="tile-title" data-i18n="menu.make24"></span>
          <span class="tile-sub" data-i18n="menu.soon"></span>
        </button>

        <button type="button" class="tile tile-trophy" id="tile-trophies">
          <span class="tile-icon">🏆</span>
          <span class="tile-title" data-i18n="menu.trophies"></span>
          <span class="tile-sub" data-i18n="menu.trophiesSub"></span>
        </button>
      </div>
    </section>`);

  app.querySelector('#back').addEventListener('click', () => go(renderHome));
  app.querySelector('#tile-tables').addEventListener('click', () => go(renderSetup, profileId, TABLES));
  app.querySelector('#tile-missing').addEventListener('click', () => go(renderSetup, profileId, MISSING));
  app.querySelector('#tile-trophies').addEventListener('click', () => go(renderTrophyRoom, profileId));
}
