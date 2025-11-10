# Advanced Caching Strategies for Next.js 16

Complete guide to implementing optimal caching patterns in Next.js 16 applications using Cache Components, Data Cache, and granular invalidation.

## Table of Contents

1. [Cache Layers Overview](#cache-layers-overview)
2. [Cache Components (Next.js 16+)](#cache-components-nextjs-16)
3. [Data Cache (Fetch)](#data-cache-fetch)
4. [Cache Invalidation Strategies](#cache-invalidation-strategies)
5. [Cache Profiles](#cache-profiles)
6. [Advanced Patterns](#advanced-patterns)
7. [Troubleshooting](#troubleshooting)

## Cache Layers Overview

Next.js 16 provides multiple cache layers that work together:

```
┌─────────────────────────────────────────┐
│   Cache Components ('use cache')        │  ← Component-level caching
├─────────────────────────────────────────┤
│   Data Cache (fetch with next.cache)    │  ← Request-level caching
├─────────────────────────────────────────┤
│   Full Route Cache                      │  ← Route-level caching
├─────────────────────────────────────────┤
│   Router Cache (Client)                 │  ← Client-side caching
└─────────────────────────────────────────┘
```

### When to Use Each Layer

- **Cache Components**: Expensive Server Components with complex logic
- **Data Cache**: Individual API/database requests
- **Full Route Cache**: Static pages with no dynamic segments
- **Router Cache**: Automatic client-side caching

## Cache Components (Next.js 16+)

### Basic Usage

```tsx
async function ProductList() {
  'use cache'

  const products = await db.products.findMany()
  return <div>{/* render products */}</div>
}
```

### With Cache Life

```tsx
import { cacheLife } from 'next/cache'

async function DashboardStats() {
  'use cache'

  cacheLife('minutes')  // Built-in profile: 5 min stale, 1 hour revalidate

  const stats = await calculateExpensiveStats()
  return <StatCards stats={stats} />
}
```

### With Cache Tags

```tsx
import { cacheTag, cacheLife } from 'next/cache'

async function UserProfile({ userId }: { userId: string }) {
  'use cache'

  cacheLife('hours')
  cacheTag(`user-${userId}`)

  const user = await db.users.findUnique({ where: { id: userId } })
  return <ProfileCard user={user} />
}
```

### Custom Cache Life

```tsx
import { cacheLife } from 'next/cache'

async function StockPrices() {
  'use cache'

  // Custom cache profile
  cacheLife({
    stale: 30,        // 30 seconds stale-while-revalidate
    revalidate: 60,   // Revalidate after 60 seconds
    expire: 300       // Expire after 5 minutes
  })

  const prices = await getStockPrices()
  return <PriceTable prices={prices} />
}
```

## Data Cache (Fetch)

### Force Cache (Static)

```tsx
// Cache indefinitely (until manual revalidation)
async function getStaticData() {
  const res = await fetch('https://api.example.com/static', {
    cache: 'force-cache'
  })
  return res.json()
}
```

### Time-based Revalidation (ISR)

```tsx
// Revalidate every hour
async function getProducts() {
  const res = await fetch('https://api.example.com/products', {
    next: { revalidate: 3600 }
  })
  return res.json()
}
```

### With Cache Tags

```tsx
// Enable tag-based invalidation
async function getProduct(id: string) {
  const res = await fetch(`https://api.example.com/products/${id}`, {
    next: {
      revalidate: 3600,
      tags: ['products', `product-${id}`]
    }
  })
  return res.json()
}
```

### No Cache (Dynamic)

```tsx
// Always fetch fresh data
async function getUserData() {
  const res = await fetch('https://api.example.com/user', {
    cache: 'no-store'
  })
  return res.json()
}
```

## Cache Invalidation Strategies

### Granular Invalidation with Tags

```tsx
// app/actions.ts
'use server'
import { revalidateTag } from 'next/cache'

export async function updateProduct(id: string, data: any) {
  await db.products.update({ where: { id }, data })

  // Invalidate specific product
  revalidateTag(`product-${id}`)
}

export async function deleteProduct(id: string) {
  await db.products.delete({ where: { id } })

  // Invalidate product and list
  revalidateTag(`product-${id}`)
  revalidateTag('products')
}
```

### Path-based Invalidation

```tsx
'use server'
import { revalidatePath } from 'next/cache'

export async function createPost(data: any) {
  await db.posts.create({ data })

  // Revalidate entire route
  revalidatePath('/blog')

  // Revalidate with layout
  revalidatePath('/blog', 'layout')

  // Revalidate specific page
  revalidatePath('/blog/[slug]', 'page')
}
```

### On-Demand Revalidation

```tsx
// app/api/revalidate/route.ts
import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')

  if (secret !== process.env.REVALIDATION_SECRET) {
    return Response.json({ message: 'Invalid secret' }, { status: 401 })
  }

  const tag = request.nextUrl.searchParams.get('tag')

  if (tag) {
    revalidateTag(tag)
    return Response.json({ revalidated: true, tag })
  }

  return Response.json({ revalidated: false }, { status: 400 })
}
```

## Cache Profiles

### Built-in Profiles

```tsx
import { cacheLife } from 'next/cache'

// Very dynamic - 1s stale, 10s revalidate, 1m expire
cacheLife('seconds')

// Frequently updated - 5m stale, 1h revalidate, 1d expire
cacheLife('minutes')

// Moderately dynamic - 15m stale, 1h revalidate, 1w expire
cacheLife('hours')

// Mostly static - 1d stale, 1w revalidate, 1mo expire
cacheLife('days')

// Rarely changes - 1w stale, 1mo revalidate, 1y expire
cacheLife('weeks')

// Static - Cache permanently
cacheLife('max')
```

### Custom Profiles

```tsx
// next.config.ts
export default {
  cacheLife: {
    // Custom profile for stock data
    stock: {
      stale: 30,        // Serve stale for 30s
      revalidate: 60,   // Revalidate after 1m
      expire: 300       // Expire after 5m
    },
    // Custom profile for user data
    user: {
      stale: 300,       // 5 minutes
      revalidate: 900,  // 15 minutes
      expire: 3600      // 1 hour
    }
  }
}

// Usage in components
async function StockPrice() {
  'use cache'
  cacheLife('stock')  // Use custom profile

  const price = await getStockPrice()
  return <span>{price}</span>
}
```

## Advanced Patterns

### Combining Cache Layers

```tsx
import { cacheLife, cacheTag } from 'next/cache'

async function ProductDetailPage({ id }: { id: string }) {
  'use cache'

  // Component-level cache
  cacheLife('hours')
  cacheTag(`product-page-${id}`)

  // Data-level cache
  const product = await fetch(`/api/products/${id}`, {
    next: {
      revalidate: 3600,
      tags: [`product-${id}`]
    }
  }).then(r => r.json())

  const reviews = await fetch(`/api/reviews?product=${id}`, {
    next: {
      revalidate: 300,  // Reviews update more frequently
      tags: [`reviews-${id}`]
    }
  }).then(r => r.json())

  return (
    <div>
      <ProductDetails product={product} />
      <ReviewsList reviews={reviews} />
    </div>
  )
}
```

### Conditional Caching

```tsx
async function UserContent({ userId }: { userId: string }) {
  'use cache'

  const user = await getUser(userId)

  // Adjust cache based on user tier
  if (user.tier === 'premium') {
    cacheLife('minutes')  // Fresh data for premium users
  } else {
    cacheLife('hours')    // Longer cache for free users
  }

  cacheTag(`user-content-${userId}`)

  const content = await getContent(userId)
  return <ContentDisplay content={content} />
}
```

### Parallel Caching with Tags

```tsx
'use server'
import { revalidateTag } from 'next/cache'

export async function updateUserProfile(userId: string, data: any) {
  await db.users.update({ where: { id: userId }, data })

  // Invalidate all user-related caches in parallel
  const tags = [
    `user-${userId}`,
    `user-profile-${userId}`,
    `user-content-${userId}`,
    `user-dashboard-${userId}`
  ]

  tags.forEach(tag => revalidateTag(tag))
}
```

### Nested Component Caching

```tsx
// Parent component - cache the whole page
async function DashboardPage() {
  'use cache'
  cacheLife('minutes')
  cacheTag('dashboard')

  return (
    <div>
      <DashboardHeader />
      <DashboardStats />  {/* Also cached */}
      <RecentActivity />  {/* Also cached */}
    </div>
  )
}

// Child component - separate cache strategy
async function DashboardStats() {
  'use cache'
  cacheLife('seconds')  // Update more frequently than parent
  cacheTag('dashboard-stats')

  const stats = await getStats()
  return <StatCards stats={stats} />
}
```

## Troubleshooting

### Cache Not Working

```tsx
// ❌ Won't cache - missing 'use cache'
async function BadExample() {
  const data = await fetch('/api/data')
  return <div>{data}</div>
}

// ✅ Properly cached
async function GoodExample() {
  'use cache'
  cacheLife('hours')

  const data = await fetch('/api/data')
  return <div>{data}</div>
}
```

### Cache Too Aggressive

```tsx
// ❌ Caches user-specific data globally
async function BadUserData() {
  'use cache'  // Don't cache personalized content!
  cacheLife('hours')

  const user = await getCurrentUser()
  return <UserProfile user={user} />
}

// ✅ Use dynamic rendering for personalized content
async function GoodUserData() {
  // No 'use cache' - render dynamically
  const user = await getCurrentUser()
  return <UserProfile user={user} />
}
```

### Stale Data After Mutations

```tsx
// ❌ Mutation without revalidation
export async function updatePost(id: string, data: any) {
  await db.posts.update({ where: { id }, data })
  // Cache is now stale!
}

// ✅ Properly revalidate after mutation
export async function updatePost(id: string, data: any) {
  await db.posts.update({ where: { id }, data })
  revalidateTag(`post-${id}`)
  revalidatePath('/blog')
}
```

### Testing Cache Behavior

```bash
# Clear Next.js cache
rm -rf .next

# Run in development (caching disabled)
npm run dev

# Test production caching
npm run build
npm start

# Check cache headers
curl -I http://localhost:3000/page
```

## Best Practices

1. **Use Cache Tags**: Always add tags for data that can be mutated
2. **Choose Appropriate Profiles**: Match cache duration to data freshness needs
3. **Invalidate Granularly**: Use tags instead of paths when possible
4. **Monitor Cache Hit Rates**: Use analytics to track cache effectiveness
5. **Test in Production Mode**: Caching behaves differently in dev vs prod
6. **Document Cache Strategy**: Add comments explaining cache decisions
7. **Avoid Over-caching**: Don't cache personalized or frequently-changing data

## Performance Impact

| Strategy | TTFB | Throughput | Freshness |
|----------|------|------------|-----------|
| No Cache | Slow | Low | Always Fresh |
| Data Cache | Medium | Medium | Configurable |
| Cache Components | Fast | High | Configurable |
| Full Route Cache | Very Fast | Very High | Static |

Choose the right balance for your use case!
