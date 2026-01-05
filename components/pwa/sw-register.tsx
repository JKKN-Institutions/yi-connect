'use client'

/**
 * Service Worker Registration Component
 *
 * Registers the service worker and handles updates.
 */

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Dispatch custom event for update prompt
                  window.dispatchEvent(new CustomEvent('sw-update-available'))
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error)
        })

      // Handle controller change (when SW takes over)
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true
          // Optionally reload the page when new SW takes control
          // window.location.reload()
        }
      })
    }
  }, [])

  return null
}
