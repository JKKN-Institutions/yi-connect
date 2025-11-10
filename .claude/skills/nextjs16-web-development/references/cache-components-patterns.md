---

# Next.js 16 Cache Components Patterns

Master Next.js 16's revolutionary Cache Components system for optimal performance and user experience.

## Understanding Cache Components

Cache Components fundamentally changes how Next.js handles rendering:
- **Old Model (Next.js ≤15)**: Static by default, opt into dynamic
- **New Model (Next.js 16)**: Dynamic by default, opt into caching

This shift gives you precise control over what gets cached and when.

## Enabling Cache Components

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true, // Enables PPR and cache directives
}

export default nextConfig
```

## Cache Directives

### 1. `'use cache'` - Standard Caching

Cache data and components with configurable lifecycles.

```typescript
// Basic usage
async function getData() {
  'use cache'
  // This function's result will be cached
  return await fetchData()
}

// With cache tags for invalidation
async function getProducts() {
  'use cache'
  cacheTag('products', 'inventory')
  return await db.products.findMany()
}

// With cache lifecycle
async function getAnalytics() {
  'use cache'
  cacheLife('hours') // or 'days', 'weeks', 'months'
  return await computeAnalytics()
}
```

### 2. `'use cache: private'` - User-Specific Caching

Cache personalized content that's specific to individual users.

```typescript
async function getUserDashboard(userId: string) {
  'use cache: private'
  cacheTag(`user-${userId}`)
  
  // This will be cached per-user
  const preferences = await getUserPreferences(userId)
  const recommendations = await getPersonalizedContent(userId)
  
  return { preferences, recommendations }
}

// User-specific with custom expiry
async function getUserNotifications(userId: string) {
  'use cache: private'
  cacheLife({ expire: 300 }) // 5 minutes
  
  return await fetchUserNotifications(userId)
}
```

### 3. `'use cache: remote'` - Server-Side Caching

Cache heavy computations in server-side cache handlers.

```typescript
async function processLargeDataset(params: DataParams) {
  'use cache: remote'
  cacheTag('heavy-computation')
  cacheLife({ expire: 7200 }) // 2 hours
  
  // Heavy computation cached server-side
  const processed = await performExpensiveCalculation(params)
  return processed
}
```

## Cache Lifecycle Management

### Predefined Profiles

```typescript
// Configure in next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    // Default profiles
    default: { expire: 3600 },           // 1 hour
    seconds: { expire: 5 },              // 5 seconds
    minutes: { expire: 60 },             // 1 minute
    hours: { expire: 3600 },             // 1 hour
    days: { expire: 86400 },             // 1 day
    weeks: { expire: 604800 },           // 1 week
    months: { expire: 2592000 },         // 30 days
    max: { expire: Number.MAX_SAFE_INTEGER },
    
    // Custom profiles
    realtime: { expire: 1 },
    frequent: { expire: 30 },
    moderate: { expire: 300 },
    stable: { expire: 3600 },
    static: { expire: 31536000 }, // 1 year
  }
}
```

### Using Cache Profiles

```typescript
// Use predefined profiles
async function getRealtimeData() {
  'use cache'
  cacheLife('realtime') // 1 second cache
  return await fetchLiveData()
}

// Use custom expiry
async function getSessionData() {
  'use cache'
  cacheLife({ expire: 1800 }) // 30 minutes
  return await fetchSessionData()
}

// Nested caching - shortest duration wins
async function getDashboard() {
  'use cache'
  cacheLife('days') // Dashboard shell cached for days
  
  return {
    layout: await getStaticLayout(), // Inherits 'days'
    metrics: await getRealtimeMetrics(), // Overrides with 'seconds'
  }
}
```

## Cache Invalidation Strategies

### 1. updateTag - Instant Updates

Use for immediate cache invalidation when users expect instant feedback.

```typescript
// Server Action with instant update
'use server'
import { updateTag } from 'next/cache'

export async function publishArticle(id: string) {
  await db.articles.update({
    where: { id },
    data: { published: true }
  })
  
  // Instantly invalidate cache
  updateTag('articles')
  updateTag(`article-${id}`)
}

// Multiple tags at once
export async function updateInventory(productId: string, quantity: number) {
  await db.inventory.update({
    where: { productId },
    data: { quantity }
  })
  
  // Update all related caches instantly
  updateTag('products')
  updateTag('inventory')
  updateTag(`product-${productId}`)
}
```

### 2. revalidateTag - Stale-While-Revalidate

Use for background updates where slight delays are acceptable.

```typescript
// Server Action with background revalidation
'use server'
import { revalidateTag } from 'next/cache'

export async function updateBlogPost(id: string, content: string) {
  await db.posts.update({
    where: { id },
    data: { content }
  })
  
  // Mark as stale, fetch new on next request
  revalidateTag('blog-posts', 'max')
  revalidateTag(`post-${id}`, 'max')
}

// Bulk operations with background refresh
export async function syncProducts() {
  await syncWithExternalAPI()
  
  // Background refresh for all products
  revalidateTag('products', 'max')
  revalidateTag('inventory', 'max')
}
```

### 3. refresh - Client Router Update

Update the client router without cache invalidation.

```typescript
'use server'
import { refresh } from 'next/cache'

export async function markAsRead(notificationId: string) {
  await db.notifications.update({
    where: { id: notificationId },
    data: { read: true }
  })
  
  // Refresh client without cache invalidation
  refresh()
}
```

## Streaming with Suspense

Combine caching with streaming for optimal UX.

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'

export default function Dashboard() {
  return (
    <>
      {/* Static shell - immediately shown */}
      <Header />
      
      {/* Cached content with fallback */}
      <Suspense fallback={<MetricsSkeleton />}>
        <CachedMetrics />
      </Suspense>
      
      {/* Dynamic content streams in */}
      <Suspense fallback={<FeedSkeleton />}>
        <LiveFeed />
      </Suspense>
    </>
  )
}

async function CachedMetrics() {
  'use cache'
  cacheLife('hours')
  cacheTag('metrics')
  
  const metrics = await fetchMetrics()
  return <MetricsDisplay data={metrics} />
}

async function LiveFeed() {
  // No cache - always fresh
  const feed = await fetchLiveFeed()
  return <FeedDisplay items={feed} />
}
```

## Advanced Patterns

### Pattern 1: Hybrid Caching Strategy

```typescript
// Combine different cache strategies in one component
async function ProductPage({ id }: { id: string }) {
  return (
    <>
      {/* Long-lived cache for product details */}
      <Suspense fallback={<ProductSkeleton />}>
        <ProductDetails id={id} />
      </Suspense>
      
      {/* Short cache for pricing */}
      <Suspense fallback={<PriceSkeleton />}>
        <ProductPricing id={id} />
      </Suspense>
      
      {/* No cache for stock status */}
      <Suspense fallback={<StockSkeleton />}>
        <StockStatus id={id} />
      </Suspense>
    </>
  )
}

async function ProductDetails({ id }: { id: string }) {
  'use cache'
  cacheLife('days')
  cacheTag(`product-${id}`)
  
  return await getProductDetails(id)
}

async function ProductPricing({ id }: { id: string }) {
  'use cache'
  cacheLife('minutes')
  cacheTag(`pricing-${id}`)
  
  return await getProductPricing(id)
}

async function StockStatus({ id }: { id: string }) {
  // No cache - real-time stock
  return await getStockStatus(id)
}
```

### Pattern 2: Conditional Caching

```typescript
// Cache based on conditions
async function getContent(slug: string, preview = false) {
  if (preview) {
    // No cache for preview mode
    return await fetchContent(slug, true)
  }
  
  // Use cache for production
  'use cache'
  cacheLife('hours')
  cacheTag('content', `content-${slug}`)
  
  return await fetchContent(slug, false)
}
```

### Pattern 3: Cache Warming

```typescript
// Proactively cache frequently accessed data
export async function warmCache() {
  const popularProducts = await getPopularProductIds()
  
  // Pre-fetch and cache popular products
  await Promise.all(
    popularProducts.map(id => getCachedProduct(id))
  )
}

async function getCachedProduct(id: string) {
  'use cache'
  cacheLife('hours')
  cacheTag('products', `product-${id}`)
  
  return await fetchProduct(id)
}
```

### Pattern 4: Cache Cascade

```typescript
// Multiple cache layers with fallbacks
async function getData(id: string) {
  // Try fast cache first
  const fastCache = await getFastCache(id)
  if (fastCache) return fastCache
  
  // Fall back to slower cache
  const slowCache = await getSlowCache(id)
  if (slowCache) return slowCache
  
  // Finally fetch from source
  return await fetchFromSource(id)
}

async function getFastCache(id: string) {
  'use cache'
  cacheLife('seconds')
  cacheTag(`fast-${id}`)
  
  return await checkFastCache(id)
}

async function getSlowCache(id: string) {
  'use cache: remote'
  cacheLife('hours')
  cacheTag(`slow-${id}`)
  
  return await checkSlowCache(id)
}
```

## Migration Guide from Next.js 15

### Before (Route Segment Config)

```typescript
// app/products/page.tsx
export const dynamic = 'force-static'
export const revalidate = 3600

export default async function ProductsPage() {
  const products = await fetch('/api/products', {
    next: { revalidate: 3600 }
  })
  return <ProductList products={products} />
}
```

### After (Cache Components)

```typescript
// app/products/page.tsx
async function getProducts() {
  'use cache'
  cacheLife('hours')
  cacheTag('products')
  
  return await fetch('/api/products')
}

export default async function ProductsPage() {
  const products = await getProducts()
  return <ProductList products={products} />
}
```

## Performance Monitoring

```typescript
// Monitor cache hit rates
async function getDataWithMetrics(key: string) {
  'use cache'
  cacheTag(`data-${key}`)
  
  const start = performance.now()
  const data = await fetchData(key)
  const duration = performance.now() - start
  
  // Log cache performance
  console.log(`Cache ${key}: ${duration}ms`)
  
  return data
}
```

## Best Practices

### DO:
- ✅ Use `updateTag` for user-triggered mutations
- ✅ Use `revalidateTag` for background syncs
- ✅ Apply appropriate `cacheLife` based on data freshness needs
- ✅ Use multiple cache tags for granular invalidation
- ✅ Wrap dynamic content in Suspense boundaries

### DON'T:
- ❌ Use runtime APIs (cookies, headers) in cached functions
- ❌ Cache sensitive user data without 'use cache: private'
- ❌ Over-cache frequently changing data
- ❌ Forget to handle cache misses gracefully
- ❌ Mix cached and uncached data without Suspense

## Debugging Cache Issues

```typescript
// Debug cache behavior
async function debugCache() {
  'use cache'
  cacheTag('debug')
  cacheLife('seconds')
  
  const timestamp = Date.now()
  console.log(`Cache generated at: ${timestamp}`)
  
  return {
    timestamp,
    data: await fetchData()
  }
}

// Test cache invalidation
export async function testInvalidation() {
  console.log('Before:', await debugCache())
  
  updateTag('debug')
  
  console.log('After:', await debugCache())
}
```

## Common Patterns by Use Case

### E-commerce
```typescript
'use cache'
cacheLife('hours')     // Product catalog
cacheLife('minutes')   // Pricing
cacheLife('seconds')   // Stock levels
// No cache            // Cart contents
```

### CMS/Blog
```typescript
'use cache'
cacheLife('days')      // Articles
cacheLife('hours')     // Comments
cacheLife('minutes')   // View counts
```

### Dashboard
```typescript
'use cache'
cacheLife('hours')     // Reports
cacheLife('minutes')   // Metrics
cacheLife('seconds')   // Real-time data
```

### SaaS
```typescript
'use cache: private'
cacheLife('hours')     // User settings
cacheLife('minutes')   // Project data
// No cache            // Billing info
```
