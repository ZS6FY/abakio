// Trofeekamer: a learner's badges and records.

import { getProfile, load } from '../core/storage.js';
import { t, currentLang } from '../core/i18n.js';
import { go } from '../core/router.js';
import { mount, esc, setPlaying, formatSeconds } from './dom.js';
import { renderLearnerMenu } from './learner-menu.js';
import { BADGES, MASTER_ICON, getEarned, badgeName } from '../modules/tables/badges.js';

function formatDate(iso) {
  const locale = currentLang() === 'af' ? 'af-ZA' : 'en-ZA';
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function badgeCard(id, icon, earnedOn, how) {
  return `
    <div class="badge${earnedOn ? ' earned' : ''}">
      <span class="badge-icon">${icon}</span>
      <span class="badge-name">${esc(badgeName(id))}</span>
      <small>${esc(earnedOn ? t('trophy.earned', { d: formatDate(earnedOn) }) : how)}</small>
    </div>`;
}

// Records are stored under keys like "tables|game|mul|20|fixed|2,3,4".
function recordRows(profileId) {
  const best = load(`best.${profileId}`, {});
  const opLabel = { mul: t('tables.mul'), div: t('tables.div'), mix: t('tables.mix') };

  return Object.entries(best)
    .map(([key, value]) => ({ parts: key.split('|'), value }))
    .filter(({ parts }) => parts[0] === 'tables' && parts.length === 6)
    .sort((x, y) => x.parts.join('|').localeCompare(y.parts.join('|')))
    .map(({ parts, value }) => {
      const [, , op, count, turn, tables] = parts;
      const isStreak = count === 'inf';
      const what = [
        isStreak ? t('rec.unlimited') : t('rec.questions', { n: count }),
        opLabel[op] ?? op,
        tables.split(',').map((n) => `×${n}`).join(' '),
        turn === 'turn' ? t('tables.turn') : ''
      ].filter(Boolean).join(' · ');
      const score = isStreak ? t('rec.inRow', { n: value }) : formatSeconds(value);
      return `<div class="record-row"><span>${esc(what)}</span><strong>${esc(score)}</strong></div>`;
    });
}

export function renderTrophyRoom(profileId) {
  setPlaying(false);
  const profile = getProfile(profileId);
  if (!profile) return;

  const earned = getEarned(profileId);

  const badges = BADGES
    .map((b) => badgeCard(b.id, b.icon, earned[b.id], t(`badges.${b.id}.how`)))
    .join('');

  const masters = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((n) => `
      <div class="master${earned[`master${n}`] ? ' earned' : ''}" title="${esc(badgeName(`master${n}`))}">
        <span>${MASTER_ICON}</span><small>×${n}</small>
      </div>`)
    .join('');

  const records = recordRows(profileId);

  const app = mount(`
    <section class="screen">
      <div class="topbar">
        <button type="button" class="btn-icon" id="back" aria-label="back">←</button>
        <h2 data-i18n="trophy.title"></h2>
        <span></span>
      </div>

      <h3 data-i18n="trophy.badges"></h3>
      <div class="badges">${badges}</div>

      <h3 data-i18n="trophy.masters"></h3>
      <small class="hint" data-i18n="trophy.mastersHow"></small>
      <div class="masters">${masters}</div>

      <h3 data-i18n="trophy.records"></h3>
      <div class="records">
        ${records.length ? records.join('') : '<p class="empty" data-i18n="trophy.noRecords"></p>'}
      </div>
    </section>`);

  app.querySelector('#back').addEventListener('click', () => go(renderLearnerMenu, profileId));
}
