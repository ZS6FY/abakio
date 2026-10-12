// Badges ("kentekens") for the tables module.
// Icons are emoji placeholders until proper badge art is made.
// Earned badges are stored per learner as { badgeId: 'YYYY-MM-DD' }.

import { load, save } from '../../core/storage.js';
import { t } from '../../core/i18n.js';

export const BADGES = [
  { id: 'first', icon: '👣' },
  { id: 'perfectLearn', icon: '✨' },
  { id: 'shuffledPerfect', icon: '🔀' },
  { id: 'streak10', icon: '🔥' },
  { id: 'streak25', icon: '🌋' },
  { id: 'streak50', icon: '🚀' },
  { id: 'speedy', icon: '⚡' },
  { id: 'champion', icon: '👑' }
];

export const MASTER_ICON = '🏅';
export const SPEEDY_MS = 60000;

export function getEarned(profileId) {
  return load(`badges.${profileId}`, {});
}

export function badgeName(id) {
  if (id.startsWith('master')) return t('badges.master.name', { n: id.slice(6) });
  return t(`badges.${id}.name`);
}

export function badgeIcon(id) {
  if (id.startsWith('master')) return MASTER_ICON;
  return BADGES.find((b) => b.id === id)?.icon ?? '🏆';
}

// Check a finished round and award any new badges. Returns the new badge ids.
export function awardBadges(profileId, s, r) {
  const earned = getEarned(profileId);
  const today = new Date().toISOString().slice(0, 10);
  const fresh = [];
  const give = (id) => {
    if (!earned[id]) {
      earned[id] = today;
      fresh.push(id);
    }
  };

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
    if (s.count >= 20 && r.total < SPEEDY_MS) give('speedy');
    if (s.tables.length === 12 && s.count === 30) give('champion');
    if (s.tables.length === 1 && s.count >= 20) give(`master${s.tables[0]}`);
  }

  if (fresh.length) save(`badges.${profileId}`, earned);
  return fresh;
}
