// Abakio – app entry point.

import { initLanguage, setLanguage, currentLang, LANGUAGES, t } from './core/i18n.js';
import { getProfiles, addProfile } from './core/storage.js';

// ---- Home screen ----------------------------------------------------

function renderProfiles() {
  const list = document.getElementById('profile-list');
  const profiles = getProfiles();
  list.innerHTML = '';

  if (profiles.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = t('home.noProfiles');
    list.appendChild(p);
    return;
  }

  for (const profile of profiles) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn profile-btn';
    btn.textContent = `${profile.name} · ${t('common.grade')} ${profile.grade}`;
    btn.addEventListener('click', () => {
      // Placeholder until the module menu exists.
      alert(`${t('home.hello')}, ${profile.name}!`);
    });
    list.appendChild(btn);
  }
}

// Temporary simple prompts – will be replaced by a proper form screen.
function onAddProfile() {
  const name = prompt(t('home.askName'));
  if (!name || !name.trim()) return;
  const grade = prompt(t('home.askGrade'), '1');
  const g = Number(grade);
  if (!Number.isInteger(g) || g < 1 || g > 7) {
    alert(t('home.badGrade'));
    return;
  }
  addProfile(name, g);
  renderProfiles();
}

// ---- Language switch (handy during development) ---------------------

function updateLangButton() {
  const other = currentLang() === 'af' ? 'en' : 'af';
  const btn = document.getElementById('lang-btn');
  btn.textContent = LANGUAGES[other];
  btn.onclick = async () => {
    await setLanguage(other);
    updateLangButton();
    renderProfiles();
  };
}

// ---- Service worker and updates -------------------------------------

async function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const reg = await navigator.serviceWorker.register('sw.js');
  const banner = document.getElementById('update-banner');

  const showBanner = (worker) => {
    banner.hidden = false;
    document.getElementById('update-btn').onclick = () => worker.postMessage('SKIP_WAITING');
  };

  // A new version may already be waiting from an earlier visit.
  if (reg.waiting && navigator.serviceWorker.controller) showBanner(reg.waiting);

  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        showBanner(worker);
      }
    });
  });

  // Once the new worker takes over, reload so the new files are used.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  // Update check: compare the online version.json with the installed one.
  // Only a tiny file is fetched, and only when there is a connection.
  checkForUpdate(reg);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate(reg);
  });
}

let installedVersion = null;

async function checkForUpdate(reg) {
  if (!navigator.onLine) return;
  try {
    const res = await fetch('version.json', { cache: 'no-store' });
    const { version } = await res.json();
    if (installedVersion === null) {
      installedVersion = version;
      document.getElementById('version-label').textContent = `v${version}`;
    } else if (version !== installedVersion) {
      reg.update(); // downloads the new version; the banner appears when ready
    }
  } catch {
    // Offline or server unreachable – try again next time.
  }
}

// ---- Start ----------------------------------------------------------

async function start() {
  await initLanguage();
  updateLangButton();
  renderProfiles();
  document.getElementById('add-profile-btn').addEventListener('click', onAddProfile);
  setupServiceWorker();
}

start();
