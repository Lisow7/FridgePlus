// public/push-handler.js
//
// Chargé dans le service worker généré (generateSW) via
// workbox.importScripts dans vite.config.js — PAS un service worker séparé.
// Le navigateur a déjà déchiffré le payload avant de déclencher `push` :
// aucune dépendance crypto ici, fonctionne aussi en PWA installée sur iOS.

self.addEventListener('push', (event) => {
  let payload = { title: 'Fridge+', body: '' }
  try {
    if (event.data) payload = event.data.json()
  } catch {
    // payload non-JSON : on garde le fallback ci-dessus
  }

  const title = payload.title || 'Fridge+'
  const options = {
    body: payload.body || '',
    icon: '/icons/push-icon-192.png',
    badge: '/icons/push-icon-badge.png',
    data: payload.data || {},
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})
