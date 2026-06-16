const CACHE_VERSION = 'novo-cache-2026-06-16-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const NEVER_CACHE_PATTERNS = [
  /\/\.netlify\/functions\//,
  /api\.anthropic\.com/,
  /supabase\.co/,
];

const JS_CSS_PATTERN = /\.(js|css)$/;

self.addEventListener('install', (event) => {
  console.log('[NOVO SW] Installing version:', CACHE_VERSION);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[NOVO SW] Activating version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheName.startsWith(CACHE_VERSION)) {
            console.log('[NOVO SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
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
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
