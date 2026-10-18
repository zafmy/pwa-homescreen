// Bump VERSION whenever a precached file changes so clients pick up the new build.
const VERSION = 'zaf-v1';
const ASSETS = [
  './', './index.html', './app.html', './manifest.webmanifest',
  './css/base.css', './css/landing.css', './css/app.css',
  './js/price.js', './js/demo.js', './js/chart.js', './js/detect.js', './js/install.js', './js/landing.js', './js/app.js', './js/sw-register.js',
  './icons/logo.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first so online users always get the latest build; fall back to cache when offline.
// ignoreSearch lets ./app.html?source=pwa match the precached ./app.html.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))
      )
  );
});
