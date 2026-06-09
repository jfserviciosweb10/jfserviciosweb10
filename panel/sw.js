/* RE-BOMBA Panel — Service Worker v1.2
   Rutas relativas: funciona en GitHub Pages con o sin dominio propio */
const CACHE_NAME = 'rebomba-panel-v2';
const ASSETS = [
  './index.html',
  './offline.html',
  './manifest.json'
];

/* ── INSTALL ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS).catch(() => c.add('./index.html')))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── FETCH ──
   Apps Script (script.google.com) → Network only, fallback JSON offline
   Resto → Cache first, Network fallback                                 */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname === 'script.google.com') {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(
          JSON.stringify({ error: 'offline', cached: true }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() =>
        e.request.mode === 'navigate'
          ? caches.match('./offline.html')
          : new Response('', { status: 408 })
      );
    })
  );
});

/* ── BACKGROUND SYNC: cola de precios/acciones guardadas offline ── */
self.addEventListener('sync', e => {
  if (e.tag === 'sync-rebomba') e.waitUntil(flushQueue());
});

async function flushQueue() {
  const db  = await openDB();
  const all = await dbGetAll(db, 'queue');
  for (const item of all) {
    try {
      await fetch(item.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload)
      });
      await dbDelete(db, 'queue', item.id);
    } catch { /* retry next sync */ }
  }
}

/* ── PUSH NOTIFICATIONS ── */
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || '🔥 RE-BOMBA', {
    body:     d.body    || 'Nuevo lead HOT en tu panel',
    icon:     'https://jfserviciosweb10.github.io/jfserviciosweb10/icon-192.png',
    badge:    'https://jfserviciosweb10.github.io/jfserviciosweb10/icon-192.png',
    vibrate:  [200, 100, 200],
    tag:      d.tag     || 'rebomba',
    renotify: true,
    data:     { url: d.url || './index.html#leads' },
    actions:  [{ action:'ver', title:'Ver ahora' }, { action:'cerrar', title:'Cerrar' }]
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'cerrar') return;
  e.waitUntil(
    clients.matchAll({ type:'window' }).then(list => {
      for (const c of list) if ('focus' in c) return c.focus();
      return clients.openWindow(e.notification.data.url);
    })
  );
});

/* ── IndexedDB helpers (minimalista) ── */
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('rebomba-sw', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('queue', { keyPath:'id', autoIncrement:true });
    r.onsuccess = e => res(e.target.result);
    r.onerror   = rej;
  });
}

function dbGetAll(db, store) {
  return new Promise(res => {
    const tx = db.transaction(store, 'readonly');
    const r  = tx.objectStore(store).getAll();
    r.onsuccess = () => res(r.result);
  });
}

function dbDelete(db, store, key) {
  return new Promise(res => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = res;
  });
}
