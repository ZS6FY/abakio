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
