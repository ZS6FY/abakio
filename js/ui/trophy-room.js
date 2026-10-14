// Trofeekamer: a learner's badges and records, one section per module.

import { getProfile, load } from '../core/storage.js';
import { t, currentLang } from '../core/i18n.js';
import { go } from '../core/router.js';
import { mount, esc, setPlaying, formatSeconds } from './dom.js';
import { renderLearnerMenu } from './learner-menu.js';
import { BADGES, MASTER_ICON, getEarned, badgeName } from '../modules/practice/badges.js';

const MODULES = [
  { id: 'make', title: 'make.title' },
  { id: 'tables', title: 'tables.title' },
  { id: 'missing', title: 'missing.title' }
];

function formatDate(iso) {
  const locale = currentLang() === 'af' ? 'af-ZA' : 'en-ZA';
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function badgeCard(b, earnedOn) {
  const note = earnedOn ? t('trophy.earned', { d: formatDate(earnedOn) }) : t(`badges.${b.id}.how`);
  return `
    <div class="badge${earnedOn ? ' earned' : ''}">
      <span class="badge-icon">${b.icon}</span>
      <span class="badge-name">${esc(badgeName(b.id))}</span>
      <small>${esc(note)}</small>
    </div>`;
}

// "5,6,7,8,10" → "5–8, 10"
function compactRange(list) {
  const nums = list.split(',').map(Number);
  const out = [];
  let start = nums[0];
  for (let i = 1; i <= nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) {
      out.push(start === nums[i - 1] ? `${start}` : `${start}–${nums[i - 1]}`);
      start = nums[i];
    }
  }
  return out.join(', ');
}

// Maak 'n getal records: "make|mode|op|count|step|targets"
function makeWhat([, , op, count, step, targets]) {
  const opLabel = { add: t('make.add'), sub: t('make.sub'), mix: t('tables.mix') };
  const stepLabel = step === 'sum' ? t(`make.stepSum.${op}`)
    : t({ bond: 'make.stepBond', pick2: 'make.stepPick2', pick3: 'make.stepPick3' }[step]);
  return [
    count === 'inf' ? t('rec.unlimited') : t('rec.questions', { n: count }),
    stepLabel, opLabel[op] ?? op, compactRange(targets)
  ].join(' · ');
}

// Records are stored under keys like "tables|game|mul|20|fixed|2,3,4".
function recordRows(profileId, moduleId) {
  const best = load(`best.${profileId}`, {});
  const opLabel = { mul: t('tables.mul'), div: t('tables.div'), mix: t('tables.mix') };

  return Object.entries(best)
    .map(([key, value]) => ({ parts: key.split('|'), value }))
    .filter(({ parts }) => parts[0] === moduleId && parts.length === 6)
    .sort((x, y) => x.parts.join('|').localeCompare(y.parts.join('|')))
    .map(({ parts, value }) => {
      const [, , op, count, turn, tables] = parts;
      const isStreak = count === 'inf';
      const what = moduleId === 'make' ? makeWhat(parts) : [
        isStreak ? t('rec.unlimited') : t('rec.questions', { n: count }),
        opLabel[op] ?? op,
        tables.split(',').map((n) => `×${n}`).join(' '),
        turn === 'turn' ? t('tables.turn') : ''
      ].filter(Boolean).join(' · ');
      const score = isStreak ? t('rec.inRow', { n: value }) : formatSeconds(value);
      return `<div class="record-row"><span>${esc(what)}</span><strong>${esc(score)}</strong></div>`;
    });
}

function moduleSection(profileId, mod, earned) {
  const badges = BADGES[mod.id].map((b) => badgeCard(b, earned[b.id])).join('');

  const masters = mod.id === 'tables'
    ? `<h4 data-i18n="trophy.masters"></h4>
       <small class="hint" data-i18n="trophy.mastersHow"></small>
       <div class="masters">${Array.from({ length: 12 }, (_, i) => i + 1).map((n) => `
         <div class="master${earned[`master${n}`] ? ' earned' : ''}" title="${esc(badgeName(`master${n}`))}">
           <span>${MASTER_ICON}</span><small>×${n}</small>
         </div>`).join('')}</div>`
    : '';

  const records = recordRows(profileId, mod.id);

  return `
    <section class="trophy-section">
      <h3 data-i18n="${mod.title}"></h3>
      <h4 data-i18n="trophy.badges"></h4>
      <div class="badges">${badges}</div>
      ${masters}
      <h4 data-i18n="trophy.records"></h4>
      <div class="records">
        ${records.length ? records.join('') : '<p class="empty" data-i18n="trophy.noRecords"></p>'}
      </div>
    </section>`;
}

export function renderTrophyRoom(profileId) {
  setPlaying(false);
  const profile = getProfile(profileId);
  if (!profile) return;

  const earned = getEarned(profileId);

  const app = mount(`
    <section class="screen">
      <div class="topbar">
        <button type="button" class="btn-icon" id="back" aria-label="back">←</button>
        <h2 data-i18n="trophy.title"></h2>
        <span></span>
      </div>
      ${MODULES.map((m) => moduleSection(profileId, m, earned)).join('')}
    </section>`);

  app.querySelector('#back').addEventListener('click', () => go(renderLearnerMenu, profileId));
}
