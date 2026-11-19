
const CACHE = 'luz-alma-v7';

const ASSETS = [
  './',
  './index.html',
  './app.js',
  './meditaciones.js',
  './config.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      await cache.addAll(ASSETS);

      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith('luz-alma-v') &&
            key !== CACHE
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (
    request.method !== 'GET' ||
    new URL(request.url).origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      try {
        const response = await fetch(request);

        if (response.ok) {
          cache.put(request, response.clone()).catch(() => {});
        }

        return response;
      } catch (error) {
        const saved = await caches.match(request, {
          ignoreSearch: true
        });

        if (saved) return saved;

        if (request.mode === 'navigate') {
          const page = await cache.match('./index.html');
          if (page) return page;
        }

        throw error;
      }
    })()
  );
});
