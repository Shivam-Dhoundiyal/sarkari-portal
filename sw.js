const CACHE_NAME = "sarkari-portal-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./app.js",
  "./icon-192.png",
  "./icon-512.png",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap"
];

// Install Event - cache essential visual resources
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event - clean up obsolete cache versions
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("Clearing obsolete Service Worker cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - network-first for dynamic files, cache-first for static assets
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  
  // Use Network-First strategy for html pages, app logic and dynamic database
  if (
    url.pathname.endsWith("data.js") || 
    url.pathname.endsWith("app.js") || 
    url.pathname.endsWith("index.html") || 
    url.pathname === "/"
  ) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if completely offline
          return caches.match(e.request);
        })
    );
  } else {
    // Cache-First strategy for static styling, icons, fonts
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(e.request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});
