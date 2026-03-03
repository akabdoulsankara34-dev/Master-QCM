// sw.js - Service Worker pour Savoir+ Burkina
const CACHE_NAME = 'savoir-plus-v1';
const OFFLINE_URL = '/offline/offline.html';

// Fichiers à mettre en cache automatiquement
const PRECACHE_URLS = [
  '/',
  '/offline/offline.html',
  '/css/style.css',
  '/js/app.js',
  '/js/db.js',
  '/icons/icon-72.png',
  '/icons/icon-192.png'
];

// Installation du Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Installation');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Préchargement des fichiers');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activation');
  
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Suppression ancien cache:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  
  // Permet à la PWA de contrôler toutes les pages
  event.waitUntil(self.clients.claim());
});

// Stratégie de cache : Stale-While-Revalidate pour les pages
self.addEventListener('fetch', event => {
  // Ne pas intercepter les requêtes vers l'API ou les paiements
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('/payment/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Mise à jour en arrière-plan
          event.waitUntil(
            fetch(event.request.clone())
              .then(response => {
                if (response && response.status === 200) {
                  const responseClone = response.clone();
                  caches.open(CACHE_NAME)
                    .then(cache => {
                      cache.put(event.request, responseClone);
                    });
                }
              })
              .catch(() => {
                console.log('[Service Worker] Pas de connexion pour mise à jour');
              })
          );
          return cachedResponse;
        }

        // Pas en cache - essayer le réseau
        return fetch(event.request.clone())
          .then(response => {
            if (!response || response.status !== 200) {
              return response;
            }

            // Mettre en cache pour plus tard
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseClone);
              });

            return response;
          })
          .catch(error => {
            console.log('[Service Worker] Erreur réseau:', error);
            
            // Page hors-ligne pour les navigations
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            
            return new Response('Pas de connexion', {
              status: 503,
              statusText: 'Service Indisponible'
            });
          });
      })
  );
});

// Gestion des notifications push
self.addEventListener('push', event => {
  const options = {
    body: event.data.text(),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Voir'
      },
      {
        action: 'close',
        title: 'Fermer'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Savoir+ Burkina', options)
  );
});

// Gestion du clic sur notification
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Synchronisation en arrière-plan
self.addEventListener('sync', event => {
  if (event.tag === 'sync-progress') {
    console.log('[Service Worker] Synchronisation des progrès');
    event.waitUntil(syncProgress());
  }
  
  if (event.tag === 'sync-payment') {
    console.log('[Service Worker] Synchronisation des paiements');
    event.waitUntil(syncPayments());
  }
});

// Fonction de synchronisation des progrès
async function syncProgress() {
  try {
    const db = await openDB();
    const offlineProgress = await getOfflineProgress(db);
    
    if (offlineProgress.length > 0) {
      const response = await fetch('/api/sync-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offlineProgress)
      });
      
      if (response.ok) {
        await clearOfflineProgress(db);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Erreur synchronisation:', error);
  }
}