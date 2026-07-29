const CACHE_NAME = 'seoul-trip-shell-v4';
const APP_SHELL = [
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './pwa-icon-192.png',
  './pwa-icon-512.png'
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const rootResponse = await fetch('./', { cache: 'reload' });
  await cache.put('./', rootResponse.clone());

  const precacheResponse = await fetch('./precache-manifest.json', { cache: 'reload' });
  const precache = precacheResponse.ok ? await precacheResponse.clone().json() : { files: [] };
  if (precacheResponse.ok) await cache.put('./precache-manifest.json', precacheResponse);

  const html = await rootResponse.text();
  const linkedAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], self.registration.scope))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.href);

  await cache.addAll([...new Set([...APP_SHELL, ...(precache.files || []), ...linkedAssets])]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
