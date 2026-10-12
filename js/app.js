// Abakio – app entry point.

import { initLanguage, setLanguage, currentLang, LANGUAGES } from './core/i18n.js';
import { go, rerender } from './core/router.js';
import { renderHome } from './ui/home.js';

// ---- Language switch (handy during development) ---------------------

function updateLangButton() {
  const other = currentLang() === 'af' ? 'en' : 'af';
  const btn = document.getElementById('lang-btn');
  btn.textContent = LANGUAGES[other];
  btn.onclick = async () => {
    await setLanguage(other);
    updateLangButton();
    rerender();
  };
}

// ---- Service worker and updates -------------------------------------

async function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const hadController = !!navigator.serviceWorker.controller;
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

  // Once a NEW worker takes over (after "Update"), reload so the new files are used.
  // On the very first visit there is no old worker, so nothing to reload.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  // Update check: compare the online version.json with the installed one.
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
  go(renderHome);
  setupServiceWorker();
}

start();
