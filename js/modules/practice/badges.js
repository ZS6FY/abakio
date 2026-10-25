// Badges ("kentekens") for the table-based modules.
// Streak badges (10, 25, 50, 100, 150+ in a row) are earned in ∞ rounds only, on purpose:
// they are the reward for sticking with the unlimited round.
// Icons are emoji placeholders until proper badge art is made.
// All earned badges are stored per learner as { badgeId: 'YYYY-MM-DD' }.
// Tables badges keep their original ids; missing-number badges start with "missing.".

import { load, save } from '../../core/storage.js';
import { t } from '../../core/i18n.js';

export const BADGES = {
  make: [
    { id: 'make.first', icon: '🧱' },
    { id: 'make.perfect', icon: '🎯' },
    { id: 'make.streak10', icon: '🐞' },
    { id: 'make.streak25', icon: '🐝' },
    { id: 'make.streak50', icon: '🦋' },
    { id: 'make.streak100', icon: '💯' },
    { id: 'make.streak150', icon: '🌟' },
    { id: 'make.speedy', icon: '🐇' },
    { id: 'make.cards', icon: '🃏' }
  ],
  tables: [
    { id: 'first', icon: '👣' },
    { id: 'perfectLearn', icon: '✨' },
    { id: 'shuffledPerfect', icon: '🔀' },
    { id: 'streak10', icon: '🔥' },
    { id: 'streak25', icon: '🌋' },
    { id: 'streak50', icon: '🚀' },
    { id: 'streak100', icon: '💯' },
    { id: 'streak150', icon: '🌟' },
    { id: 'speedy', icon: '⚡' },
    { id: 'champion', icon: '👑' }
  ],
  make24: [
    { id: 'make24.first', icon: '🎴' },
    { id: 'make24.player', icon: '♠️' },
    { id: 'make24.master', icon: '♣️' },
    { id: 'make24.hundred', icon: '♦️' },
    { id: 'make24.tough', icon: '🥜' },
    { id: 'make24.big', icon: '🔢' },
    { id: 'make24.streak5', icon: '🧭' },
    { id: 'make24.streak10', icon: '🦈' },
    { id: 'make24.streak25', icon: '🚂' },
    { id: 'make24.streak50', icon: '🐉' },
    { id: 'make24.lightning', icon: '🌩️' }
  ],
  missing: [
    { id: 'missing.first', icon: '🔎' },
    { id: 'missing.perfect', icon: '👁️' },
    { id: 'missing.streak10', icon: '🕵️' },
    { id: 'missing.streak25', icon: '🧠' },
    { id: 'missing.streak50', icon: '🦉' },
    { id: 'missing.streak100', icon: '💯' },
    { id: 'missing.streak150', icon: '🌟' },
    { id: 'missing.speedy', icon: '⚡' },
    { id: 'missing.allRound', icon: '🏆' }
  ]
};

export const MASTER_ICON = '🏅';
const TABLES_SPEEDY_MS = 60000;
const MISSING_SPEEDY_MS = 75000; // missing numbers take a little longer to read
const MAKE_SPEEDY_MS = 90000;    // young learners, and the pictures take time to look at
const MAKE24_LIGHTNING_MS = 30000;

export function getEarned(profileId) {
  return load(`badges.${profileId}`, {});
}

export function badgeName(id) {
  if (id.startsWith('master')) return t('badges.master.name', { n: id.slice(6) });
  return t(`badges.${id}.name`);
}

export function badgeIcon(id) {
  if (id.startsWith('master')) return MASTER_ICON;
  const all = Object.values(BADGES).flat();
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
      if (r.streak >= 100) give('streak100');
      if (r.streak >= 150) give('streak150');
    }
    if (r.isTimed && r.wrong === 0) {
      if (s.count >= 20 && r.total < TABLES_SPEEDY_MS) give('speedy');
      if (s.tables.length === 12 && s.count === 30) give('champion');
      if (s.tables.length === 1 && s.count >= 20) give(`master${s.tables[0]}`);
    }
  },
  make(give, s, r) {
    give('make.first');
    if (r.isLearn && r.wrong === 0) give('make.perfect');
    if (r.isStreak) {
      if (r.streak >= 10) give('make.streak10');
      if (r.streak >= 25) give('make.streak25');
      if (r.streak >= 50) give('make.streak50');
      if (r.streak >= 100) give('make.streak100');
      if (r.streak >= 150) give('make.streak150');
    }
    if (r.isTimed && r.wrong === 0 && s.count >= 20) {
      if (r.total < MAKE_SPEEDY_MS) give('make.speedy');
      if (s.step === 'pick3') give('make.cards');
    }
  },
  missing(give, s, r) {
    give('missing.first');
    if (r.isLearn && r.wrong === 0) give('missing.perfect');
    if (r.isStreak) {
      if (r.streak >= 10) give('missing.streak10');
      if (r.streak >= 25) give('missing.streak25');
      if (r.streak >= 50) give('missing.streak50');
      if (r.streak >= 100) give('missing.streak100');
      if (r.streak >= 150) give('missing.streak150');
    }
    if (r.isTimed && r.wrong === 0) {
      if (s.count >= 20 && r.total < MISSING_SPEEDY_MS) give('missing.speedy');
      if (s.turnaround && s.tables.length === 12 && s.count === 30) give('missing.allRound');
    }
  }
};

// Run a rule and store any badges it gives for the first time. Returns the new badge ids.
function award(profileId, rule) {
  const earned = getEarned(profileId);
  const today = new Date().toISOString().slice(0, 10);
  const fresh = [];
  const give = (id) => {
    if (!earned[id]) {
      earned[id] = today;
      fresh.push(id);
    }
  };
  rule(give);
  if (fresh.length) save(`badges.${profileId}`, earned);
  return fresh;
}

// Check a finished round and award any new badges. Returns the new badge ids.
export function awardBadges(profileId, moduleId, s, r) {
  return award(profileId, (give) => RULES[moduleId]?.(give, s, r));
}

// Maak 24 gives its badges card by card, so nothing is lost when a round is left early
// (and free play has no results screen at all).
// ev: { dots, hasBig, usedHint, challenge, ms, streak } – streak is only set in ∞ rounds.
// The counter key ends in ".<learnerId>", so it goes when the learner is removed.
export function awardMake24Card(profileId, ev) {
  const key = `make24.solved.${profileId}`;
  const solved = load(key, 0) + 1;
  save(key, solved);
  return award(profileId, (give) => {
    give('make24.first');
    if (solved >= 10) give('make24.player');
    if (solved >= 50) give('make24.master');
    if (solved >= 100) give('make24.hundred');
    if (ev.dots === 3 && !ev.usedHint) give('make24.tough');
    if (ev.hasBig) give('make24.big');
    if (ev.streak >= 5) give('make24.streak5');
    if (ev.streak >= 10) give('make24.streak10');
    if (ev.streak >= 25) give('make24.streak25');
    if (ev.streak >= 50) give('make24.streak50');
    if (ev.challenge && ev.dots === 3 && ev.ms < MAKE24_LIGHTNING_MS) give('make24.lightning');
  });
}
