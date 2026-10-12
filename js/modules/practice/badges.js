// Badges ("kentekens") for the table-based modules.
// Icons are emoji placeholders until proper badge art is made.
// All earned badges are stored per learner as { badgeId: 'YYYY-MM-DD' }.
// Tables badges keep their original ids; missing-number badges start with "missing.".

import { load, save } from '../../core/storage.js';
import { t } from '../../core/i18n.js';

export const BADGES = {
  tables: [
    { id: 'first', icon: '👣' },
    { id: 'perfectLearn', icon: '✨' },
    { id: 'shuffledPerfect', icon: '🔀' },
    { id: 'streak10', icon: '🔥' },
    { id: 'streak25', icon: '🌋' },
    { id: 'streak50', icon: '🚀' },
    { id: 'speedy', icon: '⚡' },
    { id: 'champion', icon: '👑' }
  ],
  missing: [
    { id: 'missing.first', icon: '🔎' },
    { id: 'missing.perfect', icon: '👁️' },
    { id: 'missing.streak10', icon: '🕵️' },
    { id: 'missing.streak25', icon: '🧠' },
    { id: 'missing.speedy', icon: '⚡' },
    { id: 'missing.allRound', icon: '🏆' }
  ]
};

export const MASTER_ICON = '🏅';
const TABLES_SPEEDY_MS = 60000;
const MISSING_SPEEDY_MS = 75000; // missing numbers take a little longer to read

export function getEarned(profileId) {
  return load(`badges.${profileId}`, {});
}

export function badgeName(id) {
  if (id.startsWith('master')) return t('badges.master.name', { n: id.slice(6) });
  return t(`badges.${id}.name`);
}

export function badgeIcon(id) {
  if (id.startsWith('master')) return MASTER_ICON;
  const all = [...BADGES.tables, ...BADGES.missing];
  return all.find((b) => b.id === id)?.icon ?? '🏆';
}

// Rules per module: call give(id) for every badge the finished round deserves.
const RULES = {
  tables(give, s, r) {
    give('first');
    if (r.isLearn && r.wrong === 0) {
      give('perfectLearn');
      if (s.learnOrder === 'shuffle') give('shuffledPerfect');
    }
    if (r.isStreak) {
      if (r.streak >= 10) give('streak10');
      if (r.streak >= 25) give('streak25');
      if (r.streak >= 50) give('streak50');
    }
    if (r.isTimed && r.wrong === 0) {
      if (s.count >= 20 && r.total < TABLES_SPEEDY_MS) give('speedy');
      if (s.tables.length === 12 && s.count === 30) give('champion');
      if (s.tables.length === 1 && s.count >= 20) give(`master${s.tables[0]}`);
    }
  },
  missing(give, s, r) {
    give('missing.first');
    if (r.isLearn && r.wrong === 0) give('missing.perfect');
    if (r.isStreak) {
      if (r.streak >= 10) give('missing.streak10');
      if (r.streak >= 25) give('missing.streak25');
    }
    if (r.isTimed && r.wrong === 0) {
      if (s.count >= 20 && r.total < MISSING_SPEEDY_MS) give('missing.speedy');
      if (s.turnaround && s.tables.length === 12 && s.count === 30) give('missing.allRound');
    }
  }
};

// Check a finished round and award any new badges. Returns the new badge ids.
export function awardBadges(profileId, moduleId, s, r) {
  const earned = getEarned(profileId);
  const today = new Date().toISOString().slice(0, 10);
  const fresh = [];
  const give = (id) => {
    if (!earned[id]) {
      earned[id] = today;
      fresh.push(id);
    }
  };
  RULES[moduleId]?.(give, s, r);
  if (fresh.length) save(`badges.${profileId}`, earned);
  return fresh;
}
