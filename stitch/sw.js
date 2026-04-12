// ===== SERVICE WORKER — Koncowrb =====
// Strategy: Network first ALWAYS — tidak ada cache
// Vercel sudah handle CDN caching dengan benar

const CACHE_NAME = 'koncowrb-v3';

// Install — langsung aktif, skip waiting
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate — hapus SEMUA cache lama tanpa kecuali
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — Network first, NO caching
// Semua request langsung ke network
self.addEventListener('fetch', (e) => {
  // Hanya handle GET requests
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .catch(() => {
        // Offline fallback: coba cache jika ada
        return caches.match(e.request);
      })
  );
});
