// app/sw.ts - Example Service Worker with Serwist
import { defaultCache } from '@serwist/next/browser'
import type { PrecacheEntry } from '@serwist/precaching'
import { installSerwist } from '@serwist/sw'
import { cacheNames } from '@serwist/core'

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[]
  __BUILD_TIME: string
}

// Install Serwist with comprehensive configuration
installSerwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
    
    // Supabase Storage caching
    {
      matcher: ({ url }) => url.hostname.includes('supabase.co') && url.pathname.includes('/storage/'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'supabase-storage',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          purgeOnQuotaError: true
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    
    // Supabase API caching
    {
      matcher: ({ url }) => url.hostname.includes('supabase.co') && url.pathname.includes('/rest/'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-api',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 5, // 5 minutes
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    
    // Static assets caching
    {
      matcher: /\.(css|js|woff2?|ttf|otf|eot)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          purgeOnQuotaError: true
        }
      }
    },
    
    // Image caching with optimization
    {
      matcher: /\.(png|jpg|jpeg|svg|gif|webp|avif)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          purgeOnQuotaError: true
        },
        plugins: [
          {
            handlerDidError: async () => {
              return new Response(
                `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100%" height="100%" fill="#f0f0f0"/>
                  <text x="50%" y="50%" text-anchor="middle" fill="#999">
                    Image unavailable offline
                  </text>
                </svg>`,
                {
                  headers: { 'Content-Type': 'image/svg+xml' }
                }
              )
            }
          }
        ]
      }
    },
    
    // API routes with offline fallback
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 5, // 5 minutes
        },
        plugins: [
          {
            handlerDidError: async () => {
              return new Response(
                JSON.stringify({ 
                  error: 'Offline', 
                  message: 'This content is not available offline',
                  cached: false 
                }),
                { 
                  status: 503,
                  headers: { 'Content-Type': 'application/json' } 
                }
              )
            }
          }
        ]
      }
    }
  ],
  
  offlineGoogleAnalytics: true,
  cleanupOutdatedCaches: true,
  precacheOptions: {
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/]
  }
})

// Handle background sync
self.addEventListener('sync', (event: any) => {
  console.log('Sync event:', event.tag)
  
  switch (event.tag) {
    case 'data-sync':
      event.waitUntil(syncOfflineData())
      break
    case 'form-sync':
      event.waitUntil(syncFormData())
      break
    default:
      event.waitUntil(genericSync(event.tag))
  }
})

// Sync offline data
async function syncOfflineData() {
  try {
    // Get all pending requests from IndexedDB
    const cache = await caches.open('offline-queue')
    const requests = await cache.keys()
    
    for (const request of requests) {
      try {
        const response = await fetch(request.clone())
        if (response.ok) {
          await cache.delete(request)
          console.log('Synced:', request.url)
        }
      } catch (error) {
        console.error('Sync failed for:', request.url, error)
      }
    }
    
    // Notify clients about sync completion
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
      client.postMessage({
        type: 'sync-complete',
        timestamp: Date.now()
      })
    })
  } catch (error) {
    console.error('Sync failed:', error)
  }
}

// Sync form data
async function syncFormData() {
  const formCache = await caches.open('form-data')
  const requests = await formCache.keys()
  
  for (const request of requests) {
    const cachedResponse = await formCache.match(request)
    if (!cachedResponse) continue
    
    const formData = await cachedResponse.json()
    
    try {
      const response = await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        await formCache.delete(request)
      }
    } catch (error) {
      console.error('Form sync failed:', error)
    }
  }
}

// Generic sync handler
async function genericSync(tag: string) {
  console.log('Generic sync for:', tag)
  // Implement custom sync logic based on tag
}

// Handle push notifications
self.addEventListener('push', function(event: PushEvent) {
  if (!event.data) return
  
  const data = event.data.json()
  
  const options: NotificationOptions = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
    vibrate: data.vibrate || [200, 100, 200],
    tag: data.tag || 'default',
    renotify: data.renotify || false,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    timestamp: data.timestamp || Date.now(),
    actions: data.actions || [],
    data: {
      url: data.url || '/',
      ...data.data
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', function(event: any) {
  event.notification.close()
  
  const url = event.notification.data?.url || '/'
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Check if there's already a window/tab open
        for (const client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        // Open new window if not found
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
  )
})

// Handle notification actions
self.addEventListener('notificationclose', function(event: any) {
  console.log('Notification closed:', event.notification.tag)
  
  // Track notification dismissal
  fetch('/api/analytics/notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'close',
      tag: event.notification.tag,
      timestamp: Date.now()
    })
  }).catch(console.error)
})

// Skip waiting when new service worker is available
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: self.__BUILD_TIME || 'unknown'
    })
  }
})

// Clean up old caches on activate
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheAllowlist = [
        'supabase-storage',
        'supabase-api',
        'static-assets',
        'images',
        'api-cache',
        'offline-queue',
        'form-data',
        ...Object.values(cacheNames)
      ]
      
      const cacheNamesList = await caches.keys()
      
      await Promise.all(
        cacheNamesList.map(cacheName => {
          if (!cacheAllowlist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
      
      // Claim all clients
      await self.clients.claim()
    })()
  )
})

// Handle fetch errors globally
self.addEventListener('unhandledrejection', event => {
  console.error('Unhandled rejection in SW:', event.reason)
  
  // Report to analytics
  fetch('/api/analytics/error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'unhandledrejection',
      error: event.reason?.toString(),
      timestamp: Date.now()
    })
  }).catch(console.error)
})
