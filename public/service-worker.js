const CACHE_VERSION = '__CACHE_VERSION__';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const NEVER_CACHE_PATTERNS = [
  /\/\.netlify\/functions\//,
  /api\.anthropic\.com/,
  /supabase\.co/,
];

const JS_CSS_PATTERN = /\.(js|css)$/;
const HASHED_ASSET_PATTERN = /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/i;

self.addEventListener('install', (event) => {
  // Do NOT call skipWaiting() here — that raced the in-page "New version" banner.
  // Activation waits until the user clicks reload (SKIP_WAITING message below).
  console.log('[NOVO SW] Installing version:', CACHE_VERSION);
});

self.addEventListener('activate', (event) => {
  console.log('[NOVO SW] Activating version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== `${CACHE_VERSION}-static`)
          .map((name) => {
            console.log('[NOVO SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[NOVO SW] Now controlling all clients');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (NEVER_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) {
    event.respondWith(fetch(request));
    return;
  }

  if (JS_CSS_PATTERN.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (HASHED_ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Fixed-name assets (icons, manifest, etc.): network-first so updates propagate immediately.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
