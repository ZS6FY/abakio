// Abakio service worker
// Makes the app work offline and handles updates.
//
// RELEASE CHECKLIST: when you publish a change, bump VERSION here
// AND in version.json (keep them the same). That is what triggers
// the "new version available" banner on the kids' devices.

const VERSION = '0.5.1';
const CACHE = `abakio-${VERSION}`;

// Every file the app needs to run offline. Add new files here as the app grows.
const APP_SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/core/i18n.js',
  'js/core/router.js',
  'js/core/storage.js',
  'js/ui/dom.js',
  'js/ui/home.js',
  'js/ui/add-learner.js',
  'js/ui/learner-menu.js',
  'js/ui/remove-learner.js',
  'js/ui/trophy-room.js',
  'js/modules/tables/badges.js',
  'js/modules/tables/questions.js',
  'js/modules/tables/setup.js',
  'js/modules/tables/play.js',
  'lang/af.json',
  'lang/en.json',
  'assets/icons/favicon.ico',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png'
];

// Install: download and store all app files.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  // Do NOT skipWaiting here: the new version waits until the user taps "Update",
  // so a child is never interrupted in the middle of an exercise.
});

// Activate: remove caches from older versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('abakio-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// The page asks the waiting worker to take over when the user taps "Update".
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Fetch: version.json always from the network (so update checks are real);
// everything else from the cache first, falling back to the network.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch outside requests

  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))
  );
});
