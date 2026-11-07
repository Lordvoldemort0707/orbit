/* Orbit service worker: the app shell is cached on install, so Orbit opens offline.
   Bump VERSION when files change; the page then offers a reload. */
const VERSION = 'orbit-v3';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/charts.js', 'js/core.js', 'js/ui.js', 'js/timer.js', 'js/life.js', 'js/fx.js', 'js/ambient.js', 'js/weather.js', 'js/sample.js', 'js/app.js',
  'js/views/today.js', 'js/views/tasks.js', 'js/views/habits.js', 'js/views/focus.js', 'js/views/planner.js',
  'js/views/notes.js', 'js/views/journal.js', 'js/views/stats.js', 'js/views/settings.js',
  'js/views/goals.js', 'js/views/money.js', 'js/views/calendar.js', 'js/views/progress.js', 'js/views/study.js', 'js/views/review.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];
const FONTS = 'orbit-fonts';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== FONTS) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // fonts: cache first, they never change
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }
      catch (_) { return hit || Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // pages: network first, so a new version shows up; the cached shell when offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('index.html', copy)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  // everything else: the network when it answers, so changes show at once; the cache when offline
  e.respondWith(caches.open(VERSION).then(async (c) => {
    try {
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    } catch (_) {
      return (await c.match(req, { ignoreSearch: true })) || Response.error();
    }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow('./#/today');
  })());
});
