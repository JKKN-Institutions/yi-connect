# Advanced Serwist Configuration

## Custom Cache Strategies

### Implementing Custom Handlers

```typescript
// app/sw.ts
import { Strategy } from '@serwist/strategies'

class CustomCacheStrategy extends Strategy {
  async _handle(request: Request, handler: any): Promise<Response> {
    // Custom logic here
    const cache = await caches.open('custom-cache')
    const cached = await cache.match(request)
    
    if (cached && !this.isExpired(cached)) {
      return cached
    }
    
    const response = await handler.fetchAndCachePut(request)
    return response
  }
  
  private isExpired(response: Response): boolean {
    const cacheTime = response.headers.get('sw-cache-time')
    if (!cacheTime) return false
    
    const age = Date.now() - parseInt(cacheTime)
    return age > 3600000 // 1 hour
  }
}
```

## Advanced Runtime Caching

### API Routes with Fallback

```typescript
{
  matcher: ({ url }) => url.pathname.startsWith('/api/'),
  handler: 'NetworkFirst',
  options: {
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    expiration: {
      maxEntries: 50,
      maxAgeSeconds: 300,
      purgeOnQuotaError: true
    },
    cacheableResponse: {
      statuses: [0, 200]
    },
    plugins: [
      {
        handlerDidError: async () => {
          // Return fallback response
          return new Response(
            JSON.stringify({ error: 'Offline', cached: true }),
            { headers: { 'Content-Type': 'application/json' } }
          )
        }
      }
    ]
  }
}
```

### Image Optimization Strategy

```typescript
{
  matcher: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
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
        requestWillFetch: async ({ request }) => {
          // Add image optimization headers
          const headers = new Headers(request.headers)
          headers.set('X-Image-Quality', 'auto')
          return new Request(request.url, { headers })
        },
        fetchDidSucceed: async ({ response }) => {
          // Check if image needs optimization
          if (response.headers.get('Content-Length') > 500000) {
            console.warn('Large image detected:', response.url)
          }
          return response
        }
      }
    ]
  }
}
```

## Precaching Strategies

### Selective Precaching

```typescript
// serwist.config.js
module.exports = {
  globPatterns: [
    '**/*.{js,css,html}',
    'icons/**/*.png',
    'fonts/**/*.{woff,woff2}'
  ],
  globIgnores: [
    '**/node_modules/**',
    '**/*.map',
    '**/test/**'
  ],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
  modifyURLPrefix: {
    '': '/_next/static/'
  }
}
```

### Dynamic Precache Manifest

```typescript
// app/sw.ts
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Fetch critical resources dynamically
      const response = await fetch('/api/critical-resources')
      const resources = await response.json()
      
      const cache = await caches.open('precache-v1')
      await cache.addAll(resources)
    })()
  )
})
```

## Background Sync Implementation

### Queue Management

```typescript
import { Queue } from '@serwist/background-sync'

const queue = new Queue('api-queue', {
  maxRetentionTime: 24 * 60, // 24 hours
  onSync: async ({ queue }) => {
    let entry
    while ((entry = await queue.shift())) {
      try {
        await fetch(entry.request)
      } catch (error) {
        await queue.unshift(entry)
        throw error
      }
    }
  }
})

// Add failed requests to queue
self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return queue.pushRequest({ request: event.request })
      })
    )
  }
})
```

## Cache Management

### Storage Quota Management

```typescript
async function manageCacheStorage() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const { usage, quota } = await navigator.storage.estimate()
    const percentUsed = (usage / quota) * 100
    
    if (percentUsed > 90) {
      // Clear old caches
      const cacheNames = await caches.keys()
      const oldCaches = cacheNames.filter(name => 
        !name.startsWith('precache') && 
        !name.startsWith('runtime')
      )
      
      await Promise.all(
        oldCaches.map(name => caches.delete(name))
      )
    }
  }
}
```

### Versioned Caching

```typescript
const CACHE_VERSION = 'v2'
const CACHE_NAME = `app-${CACHE_VERSION}`

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('app-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    })
  )
})
```

## Performance Monitoring

### Cache Hit Ratio Tracking

```typescript
let cacheHits = 0
let totalRequests = 0

self.addEventListener('fetch', (event: FetchEvent) => {
  totalRequests++
  
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        cacheHits++
        // Report metrics
        if (totalRequests % 100 === 0) {
          console.log(`Cache hit ratio: ${(cacheHits/totalRequests*100).toFixed(2)}%`)
        }
        return cached
      }
      return fetch(event.request)
    })
  )
})
```

## Navigation Preload

```typescript
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable()
      }
    })()
  )
})

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const preloadResponse = event.preloadResponse
        if (preloadResponse) {
          const response = await preloadResponse
          if (response) return response
        }
        
        return fetch(event.request)
      })()
    )
  }
})
```
