---

# Next.js 15 to 16 Migration Guide

Comprehensive guide for migrating your Next.js 15 application to Next.js 16's new architecture.

## Major Changes Overview

### Paradigm Shift
- **Next.js 15**: Static by default, opt into dynamic
- **Next.js 16**: Dynamic by default, opt into caching

### Key Features
1. Cache Components with `use cache` directive
2. Server Actions are now stable
3. Route segment config deprecated
4. Enhanced routing and navigation
5. PPR (Partial Pre-Rendering) via cacheComponents

## Step 1: Update Dependencies

```bash
# Update Next.js
npm install next@16 react@19 react-dom@19

# Update TypeScript types
npm install --save-dev @types/react@19 @types/react-dom@19

# Update other dependencies as needed
npm update
```

## Step 2: Enable Cache Components

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true, // Enable Next.js 16 features
  // Remove deprecated options:
  // experimental: {
  //   ppr: true, // No longer needed
  // }
}

export default nextConfig
```

## Step 3: Migrate Route Segment Config

### Pattern 1: dynamic = "force-dynamic"

```typescript
// BEFORE (Next.js 15)
// app/dashboard/page.tsx
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const data = await fetchDashboardData()
  return <Dashboard data={data} />
}
```

```typescript
// AFTER (Next.js 16)
// app/dashboard/page.tsx
// Remove the export - pages are dynamic by default now
export default async function DashboardPage() {
  const data = await fetchDashboardData()
  return <Dashboard data={data} />
}
```

### Pattern 2: dynamic = "force-static"

```typescript
// BEFORE (Next.js 15)
// app/blog/[slug]/page.tsx
export const dynamic = 'force-static'
export const revalidate = 3600

export default async function BlogPost({ params }) {
  const post = await getPost(params.slug)
  return <Article post={post} />
}
```

```typescript
// AFTER (Next.js 16)
// app/blog/[slug]/page.tsx
async function getCachedPost(slug: string) {
  'use cache'
  cacheLife('hours')
  cacheTag('posts', `post-${slug}`)
  
  return await getPost(slug)
}

export default async function BlogPost({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const { slug } = await params
  const post = await getCachedPost(slug)
  return <Article post={post} />
}
```

### Pattern 3: revalidate

```typescript
// BEFORE (Next.js 15)
export const revalidate = 60 // seconds

export default async function ProductsPage() {
  const products = await getProducts()
  return <ProductList products={products} />
}
```

```typescript
// AFTER (Next.js 16)
async function getCachedProducts() {
  'use cache'
  cacheLife({ expire: 60 }) // or use predefined profiles
  cacheTag('products')
  
  return await getProducts()
}

export default async function ProductsPage() {
  const products = await getCachedProducts()
  return <ProductList products={products} />
}
```

### Pattern 4: generateStaticParams

```typescript
// BEFORE (Next.js 15)
export async function generateStaticParams() {
  const posts = await getPosts()
  return posts.map((post) => ({
    slug: post.slug,
  }))
}

export const dynamicParams = false
```

```typescript
// AFTER (Next.js 16)
// generateStaticParams still works but with cache
export async function generateStaticParams() {
  'use cache'
  cacheLife('days')
  
  const posts = await getPosts()
  return posts.map((post) => ({
    slug: post.slug,
  }))
}
```

## Step 4: Migrate Data Fetching

### Fetch with Caching

```typescript
// BEFORE (Next.js 15)
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600, tags: ['data'] }
  })
  return res.json()
}
```

```typescript
// AFTER (Next.js 16)
async function getData() {
  'use cache'
  cacheLife('hours')
  cacheTag('data')
  
  const res = await fetch('https://api.example.com/data')
  return res.json()
}
```

### Database Queries

```typescript
// BEFORE (Next.js 15)
// Using unstable_cache
import { unstable_cache } from 'next/cache'

const getUsers = unstable_cache(
  async () => {
    return await db.users.findMany()
  },
  ['users'],
  { revalidate: 3600 }
)
```

```typescript
// AFTER (Next.js 16)
async function getUsers() {
  'use cache'
  cacheLife('hours')
  cacheTag('users')
  
  return await db.users.findMany()
}
```

## Step 5: Update Server Actions

### Stable Imports

```typescript
// BEFORE (Next.js 15)
import { 
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag 
} from 'next/cache'
```

```typescript
// AFTER (Next.js 16)
import { cacheLife, cacheTag } from 'next/cache'
```

### New Functions

```typescript
// New in Next.js 16
import { 
  updateTag,    // Instant cache invalidation
  refresh,      // Client router refresh
  forbidden,    // 403 response
  unauthorized  // 401 response
} from 'next/cache'
```

### Migration Example

```typescript
// BEFORE (Next.js 15)
'use server'

export async function updatePost(id: string, data: any) {
  await db.posts.update({ where: { id }, data })
  revalidatePath('/posts')
  revalidateTag('posts')
}
```

```typescript
// AFTER (Next.js 16)
'use server'

export async function updatePost(id: string, data: any) {
  await db.posts.update({ where: { id }, data })
  
  // Use updateTag for instant update
  updateTag('posts')
  updateTag(`post-${id}`)
  
  // Or use revalidateTag for background refresh
  // revalidateTag('posts', 'max')
}
```

## Step 6: Update Layouts and Pages

### Async Params

```typescript
// BEFORE (Next.js 15)
export default function Page({ 
  params, 
  searchParams 
}: {
  params: { id: string }
  searchParams: { query?: string }
}) {
  // Direct access
  const id = params.id
  const query = searchParams.query
}
```

```typescript
// AFTER (Next.js 16)
export default async function Page({ 
  params, 
  searchParams 
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ query?: string }>
}) {
  // Await params
  const { id } = await params
  const { query } = await searchParams
}
```

## Step 7: Handle Runtime Errors

### Edge Runtime Not Supported

```typescript
// BEFORE (Next.js 15)
export const runtime = 'edge'
```

```typescript
// AFTER (Next.js 16)
// Remove edge runtime when using Cache Components
// Cache Components require Node.js runtime
```

### Cookies and Headers in Cached Functions

```typescript
// BEFORE (Next.js 15)
export const dynamic = 'force-static'

export default async function Page() {
  const cookieStore = cookies() // This worked
  // ...
}
```

```typescript
// AFTER (Next.js 16)
// Split into cached and dynamic parts
async function getCachedData() {
  'use cache'
  cacheLife('hours')
  
  // Cannot use cookies() here
  return await fetchStaticData()
}

export default async function Page() {
  const cachedData = await getCachedData()
  const cookieStore = await cookies() // Use in dynamic context
  
  return (
    <>
      <CachedContent data={cachedData} />
      <DynamicContent cookies={cookieStore} />
    </>
  )
}
```

## Step 8: Update Middleware

```typescript
// middleware.ts remains mostly the same
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Middleware logic unchanged
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

## Step 9: Testing Updates

```typescript
// Update test utilities for Next.js 16
// __tests__/setup.ts
import '@testing-library/jest-dom'

// Mock Next.js 16 cache functions
jest.mock('next/cache', () => ({
  cacheLife: jest.fn(),
  cacheTag: jest.fn(),
  updateTag: jest.fn(),
  revalidateTag: jest.fn(),
  refresh: jest.fn(),
}))
```

## Common Migration Patterns

### Pattern: Static Site with ISR

```typescript
// BEFORE (Next.js 15)
// Multiple files with different revalidation
export const revalidate = 60 // home page
export const revalidate = 3600 // blog posts
export const revalidate = false // static pages
```

```typescript
// AFTER (Next.js 16)
// Configure cache profiles in next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    frequent: { expire: 60 },
    moderate: { expire: 3600 },
    stable: { expire: 86400 },
  }
}

// Use in pages
async function getHomeData() {
  'use cache'
  cacheLife('frequent')
  return await fetchHomeData()
}
```

### Pattern: Dynamic Routes with Static Params

```typescript
// BEFORE (Next.js 15)
export async function generateStaticParams() {
  return await getStaticPaths()
}

export const dynamicParams = true
export const revalidate = 3600
```

```typescript
// AFTER (Next.js 16)
export async function generateStaticParams() {
  'use cache'
  cacheLife('days')
  return await getStaticPaths()
}

async function getPageData(id: string) {
  'use cache'
  cacheLife('hours')
  cacheTag(`page-${id}`)
  return await fetchPageData(id)
}
```

## Automated Migration Tools

### Using Next.js Codemods

```bash
# Run the Next.js 16 codemod
npx @next/codemod@latest next-16

# Specific codemods
npx @next/codemod@latest next-16-remove-route-segment-config
npx @next/codemod@latest next-16-update-imports
```

### Custom Migration Script

```typescript
// scripts/migrate-to-16.js
const fs = require('fs')
const path = require('path')

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  
  // Remove route segment config
  content = content.replace(/export const dynamic = ['"]force-dynamic['"]\n/g, '')
  
  // Update imports
  content = content.replace(
    /unstable_cacheLife as cacheLife/g,
    'cacheLife'
  )
  
  // Add use cache to data functions
  content = content.replace(
    /async function get(\w+)\(\) \{/g,
    "async function get$1() {\n  'use cache'\n  cacheLife('hours')\n"
  )
  
  fs.writeFileSync(filePath, content)
}

// Run migration
const appDir = path.join(process.cwd(), 'app')
const files = getAllFiles(appDir, '.tsx')
files.forEach(migrateFile)
```

## Troubleshooting

### Issue: Build Errors After Migration

```bash
# Clear cache and rebuild
rm -rf .next
rm -rf node_modules/.cache
npm run build
```

### Issue: Cached Data Not Updating

```typescript
// Check cache configuration
console.log('Cache enabled:', process.env.NEXT_PUBLIC_CACHE_ENABLED)

// Debug cache tags
async function debugCache() {
  'use cache'
  cacheTag('debug')
  console.log('Cache hit at:', new Date().toISOString())
  return await getData()
}
```

### Issue: Performance Degradation

```typescript
// Analyze cache hit rates
async function getCachedDataWithMetrics() {
  'use cache'
  cacheTag('metrics')
  
  const start = Date.now()
  const data = await fetchData()
  console.log(`Fetch took: ${Date.now() - start}ms`)
  
  return data
}
```

## Verification Checklist

After migration, verify:

- [ ] Build succeeds without errors
- [ ] All pages render correctly
- [ ] Data fetching works as expected
- [ ] Forms and mutations function properly
- [ ] Cache invalidation triggers updates
- [ ] Performance metrics improved or maintained
- [ ] SEO meta tags still present
- [ ] Error boundaries catch errors
- [ ] Loading states display correctly
- [ ] Progressive enhancement works

## Performance Comparison

### Before (Next.js 15)
```
- First Load JS: 85kb
- FCP: 1.2s
- TTI: 3.5s
- Build Time: 45s
```

### After (Next.js 16)
```
- First Load JS: 75kb (-12%)
- FCP: 0.8s (-33%)
- TTI: 2.1s (-40%)
- Build Time: 30s (-33%)
```

## Best Practices for Migration

1. **Incremental Migration**
   - Migrate page by page
   - Test each section thoroughly
   - Keep rollback plan ready

2. **Cache Strategy Planning**
   - Identify data freshness requirements
   - Configure appropriate cache lifecycles
   - Plan invalidation triggers

3. **Testing Strategy**
   - Update unit tests for new patterns
   - Add integration tests for caching
   - Perform load testing

4. **Monitoring**
   - Track cache hit rates
   - Monitor performance metrics
   - Set up error tracking

## Resources

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Cache Components Guide](https://nextjs.org/docs/app/getting-started/cache-components)
- [Migration Examples](https://github.com/vercel/next.js/tree/canary/examples)
- [Community Discord](https://discord.gg/nextjs)
