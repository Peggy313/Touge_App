/* TOUGE App — service worker: l'app si apre anche offline (file dell'app in cache),
 * sempre "rete prima" così gli aggiornamenti arrivano subito. Supabase e mappe non vengono messi in cache. */
const CACHE = 'touge-v3';
const SHELL = [
  './', './index.html', './manifest.json', './css/style.css',
  './js/config.js', './js/data.js', './js/i18n.js', './js/store.js', './js/art.js', './js/share.js', './js/app.js',
  './data/routes.json', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
