// Local storage for Abakio.
// Everything stays on this device. Nothing is ever sent anywhere.
// All keys start with "abakio." so they never clash with other apps.

const PREFIX = 'abakio.';

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback; // private mode, blocked storage or damaged data
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false; // storage full or blocked
  }
}

// ---- Profiles -------------------------------------------------------
// A profile holds only what the app needs: a display name and a grade.
// No surnames, birthdays, photos or anything else.

export function getProfiles() {
  return load('profiles', []);
}

export function getProfile(id) {
  return getProfiles().find((p) => p.id === id) || null;
}

export function addProfile(name, grade) {
  const profiles = getProfiles();
  const profile = {
    id: Date.now().toString(36),
    name: name.trim(),
    grade: Number(grade),
    created: new Date().toISOString().slice(0, 10)
  };
  profiles.push(profile);
  save('profiles', profiles);
  return profile;
}

export function removeProfile(id) {
  save('profiles', getProfiles().filter((p) => p.id !== id));
}

// ---- Per-fact results -----------------------------------------------
// For every fact a learner answers (e.g. "7x8" or "56/7") we keep how often
// it was right, how often wrong, and the last answer time. This will feed
// the revision pool later (wrong or slow facts come back more often).

export function recordAnswer(profileId, factKey, correct, ms) {
  const key = `stats.${profileId}`;
  const stats = load(key, {});
  const s = stats[factKey] || { r: 0, w: 0, ms: 0 };
  if (correct) s.r += 1; else s.w += 1;
  s.ms = Math.round(ms);
  stats[factKey] = s;
  save(key, stats);
}

// ---- Best scores ----------------------------------------------------

export function getBest(profileId, key) {
  return load(`best.${profileId}`, {})[key] ?? null;
}

export function setBest(profileId, key, value) {
  const all = load(`best.${profileId}`, {});
  all[key] = value;
  save(`best.${profileId}`, all);
}
