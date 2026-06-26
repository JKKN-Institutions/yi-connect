/// <reference lib="webworker" />

/**
 * Service Worker for Yi Connect PWA
 *
 * Handles caching strategies, offline support, background sync,
 * and push notifications for the Progressive Web App.
 */

import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { NetworkOnly, Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

// Initialize Serwist with configuration
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // The venue PROJECTOR (/yip/event/<id>/display) must NEVER be served from
    // cache. It stays open for hours on a big screen and must always reflect
    // the latest deployed code + live data. NetworkOnly (matched before the
    // default page strategy) keeps it out of the PWA cache entirely, so a
    // reload always fetches fresh. The page also self-checks for new deploys
    // and reloads itself (see projector-display.tsx).
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && /\/yip\/event\/[^/]+\/display\/?$/.test(url.pathname),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ]
})

// Register Serwist
serwist.addEventListeners()

// Push Notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json() as {
    title: string
    body: string
    icon?: string
    badge?: string
    tag?: string
    url?: string
    requireInteraction?: boolean
    actions?: Array<{ action: string; title: string }>
    data?: Record<string, unknown>
  }

  const options: NotificationOptions = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
    tag: data.tag || 'yi-connect-notification',
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || '/dashboard',
      timestamp: Date.now(),
      ...data.data
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = (event.notification.data as { url?: string })?.url || '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus()
            return (client as WindowClient).navigate(urlToOpen)
          }
        }
        // Open new window if none exists
        return self.clients.openWindow(urlToOpen)
      })
  )
})

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
