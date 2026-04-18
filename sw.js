// ================================================================
// VITALIDADE 40+ - Service Worker v1.0
// PWA Offline-First com Cache Strategy
// ================================================================

const CACHE_NAME = 'vitalidade-v1.0.0';
const STATIC_CACHE = 'vitalidade-static-v1';
const DYNAMIC_CACHE = 'vitalidade-dynamic-v1';

// Arquivos essenciais para cache estático
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Failed to cache static assets:', err);
      })
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Estratégia de fetch: Network First com fallback para cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-GET
  if (request.method !== 'GET') {
    return;
  }

  // API calls: Network Only (não cachear)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(
            JSON.stringify({ 
              error: 'offline',
              message: 'Você está offline. Conecte-se à internet para usar a IA.'
            }),
            { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Supabase: Network Only
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(
            JSON.stringify({ error: 'offline' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // CDN externos: Cache First
  if (url.hostname.includes('cdn.tailwindcss.com') || 
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request)
            .then((networkResponse) => {
              const responseToCache = networkResponse.clone();
              caches.open(STATIC_CACHE)
                .then((cache) => cache.put(request, responseToCache));
              return networkResponse;
            });
        })
    );
    return;
  }

  // Páginas locais: Network First com fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cachear resposta bem-sucedida
        if (networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open(DYNAMIC_CACHE)
            .then((cache) => cache.put(request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback para cache
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Página offline padrão
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Background Sync para checkins offline
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-checkins') {
    event.waitUntil(syncPendingCheckins());
  }
});

async function syncPendingCheckins() {
  // Implementar sincronização de checkins pendentes
  console.log('[SW] Syncing pending checkins...');
}

// Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || 'Nova atualização do seu treino!',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open', title: 'Abrir App' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Vitalidade 40+', options)
  );
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url === event.notification.data.url && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(event.notification.data.url);
          }
        })
    );
  }
});

console.log('[SW] Service Worker loaded - Vitalidade 40+ v1.0.0');
