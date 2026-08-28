// FlatSpec Drive - Service Worker (Offline First Support)
const CACHE_NAME = 'flatspec-cache-v11';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=JetBrains+Mono:wght@400;700&display=swap'
];

// 安裝階段：預先快取核心資源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching offline assets...');
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(new Request(url, { mode: 'no-cors' })).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

// 啟用階段：清除舊版快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[SW] Removing old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 攔截請求：支援完全離線運作
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = req.url;

  // 1. Google Apps Script 雲端同步 API：走網路，不快取動態同步
  if (url.includes('script.google.com') || req.method !== 'GET') {
    return;
  }

  // 2. 頁面導航 / HTML 請求：Network First，斷網時立即 Fallback 到快取
  if (req.mode === 'navigate' || (req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(req).then(networkRes => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        }
        return networkRes;
      }).catch(async () => {
        const cached = await caches.match(req) || await caches.match('./index.html') || await caches.match('./');
        if (cached) return cached;
        return new Response('離線模式', { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
      })
    );
    return;
  }

  // 3. 靜態資源、CDN 與字體：Cache First + 背景更新 (Stale-While-Revalidate)
  event.respondWith(
    caches.match(req).then(cachedRes => {
      const fetchPromise = fetch(req).then(networkRes => {
        if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        }
        return networkRes;
      }).catch(() => null);

      return cachedRes || fetchPromise;
    })
  );
});