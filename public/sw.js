/**
 * G-Buddy Service Worker
 * Provides offline support for the app shell
 */

const CACHE_NAME = 'gbuddy-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/gbuddy-icon.svg',
];

// Install event - cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Failed to cache some assets:', err);
      });
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all clients
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API requests
  if (event.request.url.includes('/api/')) return;
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version if available
      if (response) return response;
      
      // Otherwise fetch from network
      return fetch(event.request).then((fetchResponse) => {
        // Don't cache if not a valid response
        if (!fetchResponse || fetchResponse.status !== 200) {
          return fetchResponse;
        }
        
        // Clone the response
        const responseToCache = fetchResponse.clone();
        
        // Cache the new response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return fetchResponse;
      });
    }).catch(() => {
      // Return offline page if both cache and network fail
      return caches.match('/dashboard');
    })
  );
});