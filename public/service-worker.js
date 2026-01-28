self.addEventListener('install', (event) => {
  console.log('NOVO Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('NOVO Service Worker activated');
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
