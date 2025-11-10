# Core Web Vitals Optimization Guide

Complete guide to achieving excellent Core Web Vitals scores in Next.js 16 applications.

## Core Web Vitals Overview

### The Three Pillars

```
┌─────────────────────────────────────────────────────┐
│  LCP (Largest Contentful Paint)  - LOADING         │
│  Target: < 2.5s | Acceptable: < 4.0s                │
│  Measures: When main content becomes visible        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  INP (Interaction to Next Paint)  - INTERACTIVITY  │
│  Target: < 200ms | Acceptable: < 500ms              │
│  Measures: Responsiveness to user interactions      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  CLS (Cumulative Layout Shift)  - VISUAL STABILITY │
│  Target: < 0.1 | Acceptable: < 0.25                 │
│  Measures: Unexpected layout shifts                 │
└─────────────────────────────────────────────────────┘
```

### Additional Metrics

- **TTFB** (Time to First Byte): < 600ms
- **FCP** (First Contentful Paint): < 1.8s

## LCP Optimization

### Identify LCP Element

```tsx
// app/layout.tsx - Track LCP
export function reportWebVitals(metric: any) {
  if (metric.name === 'LCP') {
    console.log('LCP Element:', metric.element)
    console.log('LCP Value:', metric.value)
  }
}
```

### Optimize Hero Images

```tsx
import Image from 'next/image'

export default function Hero() {
  return (
    <Image
      src="/hero.jpg"
      alt="Hero"
      width={1920}
      height={1080}
      priority        // ← Critical: Preloads the image
      quality={85}    // Balance quality vs size
      placeholder="blur"
      blurDataURL={blurDataUrl}
      sizes="100vw"   // Responsive sizing
    />
  )
}
```

### Preload Critical Resources

```tsx
// app/layout.tsx
export default function Layout({ children }) {
  return (
    <html>
      <head>
        {/* Preload fonts */}
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

        {/* Preload critical CSS */}
        <link
          rel="preload"
          href="/styles/critical.css"
          as="style"
        />

        {/* Preload LCP image if not using Next/Image */}
        <link
          rel="preload"
          as="image"
          href="/hero.jpg"
          fetchpriority="high"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Optimize Server Response (TTFB)

```tsx
// Use caching for faster responses
async function getHeroData() {
  'use cache'

  cacheLife('hours')
  cacheTag('hero')

  const data = await fetch('https://api.example.com/hero', {
    next: { revalidate: 3600 }
  })

  return data.json()
}

export default async function Hero() {
  const data = await getHeroData()

  return (
    <div>
      <h1>{data.title}</h1>
      <Image src={data.image} alt={data.title} priority />
    </div>
  )
}
```

### Streaming for Faster FCP

```tsx
import { Suspense } from 'react'

export default function Page() {
  return (
    <>
      {/* Shell loads immediately */}
      <Header />

      {/* LCP content streams in */}
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />
      </Suspense>

      {/* Below-fold content */}
      <Suspense fallback={<ContentSkeleton />}>
        <ContentSection />
      </Suspense>
    </>
  )
}
```

### LCP Checklist

- [ ] LCP element identified and optimized
- [ ] Hero images use `priority` prop
- [ ] Critical resources preloaded
- [ ] TTFB < 600ms (use caching)
- [ ] Image formats optimized (WebP/AVIF)
- [ ] Image dimensions specified
- [ ] CDN for static assets
- [ ] Server response time optimized

## INP Optimization

### Minimize JavaScript Execution

```tsx
'use client'

import { useMemo, useCallback } from 'react'

export default function SearchResults({ data }) {
  // ❌ Bad - expensive computation on every render
  const filtered = data.filter(item => expensiveCheck(item))

  // ✅ Good - memoized computation
  const filtered = useMemo(
    () => data.filter(item => expensiveCheck(item)),
    [data]
  )

  // ❌ Bad - creates new function on every render
  const handleClick = (id) => {
    processItem(id)
  }

  // ✅ Good - memoized callback
  const handleClick = useCallback((id) => {
    processItem(id)
  }, [])

  return <ResultsList items={filtered} onClick={handleClick} />
}
```

### Debounce User Inputs

```tsx
'use client'

import { useState, useCallback } from 'react'

export default function SearchBar() {
  const [query, setQuery] = useState('')

  // Debounce expensive operations
  const debouncedSearch = useCallback(
    debounce(async (value: string) => {
      const results = await searchAPI(value)
      setResults(results)
    }, 300),
    []
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    debouncedSearch(value)
  }

  return <input value={query} onChange={handleChange} />
}
```

### Use Server Components

```tsx
// ❌ Bad - heavy computation in Client Component
'use client'

export default function DataTable({ rawData }) {
  const processed = expensiveProcessing(rawData)  // Blocks interactions

  return <Table data={processed} />
}

// ✅ Good - computation in Server Component
async function DataTable() {
  const rawData = await fetchData()
  const processed = expensiveProcessing(rawData)  // Runs on server

  return <Table data={processed} />
}
```

### Optimize Event Handlers

```tsx
'use client'

export default function InteractiveList({ items }) {
  // ❌ Bad - synchronous heavy work blocks UI
  const handleClick = (id: string) => {
    const result = heavyComputation(id)  // Blocks interaction
    updateState(result)
  }

  // ✅ Good - defer heavy work
  const handleClick = async (id: string) => {
    // Quick UI update first
    setLoading(true)

    // Heavy work doesn't block
    await scheduler.yield()
    const result = heavyComputation(id)

    setLoading(false)
    updateState(result)
  }

  return (
    <div>
      {items.map(item => (
        <button key={item.id} onClick={() => handleClick(item.id)}>
          {item.name}
        </button>
      ))}
    </div>
  )
}
```

### Break Up Long Tasks

```tsx
'use client'

// ❌ Bad - long blocking task
function processAllItems(items: Item[]) {
  return items.map(item => expensiveTransform(item))  // Blocks for entire duration
}

// ✅ Good - chunked processing
async function processAllItems(items: Item[]) {
  const results = []
  const chunkSize = 50

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const processed = chunk.map(item => expensiveTransform(item))
    results.push(...processed)

    // Yield to browser between chunks
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  return results
}
```

### INP Checklist

- [ ] Expensive computations memoized
- [ ] Event handlers optimized
- [ ] Input events debounced
- [ ] Long tasks broken into chunks
- [ ] Heavy libraries loaded dynamically
- [ ] Server Components for heavy logic
- [ ] No blocking synchronous operations
- [ ] Third-party scripts deferred

## CLS Optimization

### Reserve Space for Images

```tsx
// ❌ Bad - causes layout shift
<img src="/product.jpg" alt="Product" />

// ✅ Good - dimensions prevent shift
<Image
  src="/product.jpg"
  alt="Product"
  width={400}
  height={300}
/>

// ✅ Good - aspect ratio reserved
<div className="aspect-[16/9]">
  <Image src="/video-thumb.jpg" alt="Video" fill />
</div>
```

### Font Loading Strategy

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',           // Prevent invisible text
  preload: true,             // Faster loading
  adjustFontFallback: true,  // ← Critical: Reduces CLS
  variable: '--font-inter'
})

export default function Layout({ children }) {
  return (
    <html className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
```

### Prevent Dynamic Content Shifts

```tsx
// ❌ Bad - content pops in
export default async function UserProfile() {
  const user = await getUser()

  return (
    <div>
      <h1>Profile</h1>
      {user && <UserInfo user={user} />}  // Shifts layout
    </div>
  )
}

// ✅ Good - skeleton prevents shift
export default function UserProfile() {
  return (
    <div>
      <h1>Profile</h1>
      <Suspense fallback={<UserInfoSkeleton />}>
        <UserInfo />
      </Suspense>
    </div>
  )
}
```

### Reserve Space for Ads/Embeds

```tsx
// ❌ Bad - ad causes shift when loaded
<div id="ad-slot"></div>

// ✅ Good - reserved space
<div className="min-h-[250px] w-full">
  <div id="ad-slot"></div>
</div>

// ✅ Better - with skeleton
<div className="min-h-[250px] w-full bg-gray-100 animate-pulse">
  <div id="ad-slot"></div>
</div>
```

### Avoid Inserting Content Above

```tsx
// ❌ Bad - banner pushes content down
export default function Page() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    setShowBanner(true)  // Causes CLS!
  }, [])

  return (
    <>
      {showBanner && <AnnouncementBanner />}
      <MainContent />
    </>
  )
}

// ✅ Good - overlay doesn't shift content
export default function Page() {
  return (
    <>
      <AnnouncementBanner className="fixed top-0 z-50" />
      <MainContent className="pt-16" />  // Account for banner
    </>
  )
}
```

### Carousel/Slider Optimization

```tsx
'use client'

// ❌ Bad - height changes between slides
<div className="carousel">
  {slides.map(slide => <img src={slide.image} />)}
</div>

// ✅ Good - consistent height
<div className="carousel h-[400px]">
  {slides.map(slide => (
    <Image
      src={slide.image}
      alt={slide.title}
      fill
      style={{ objectFit: 'cover' }}
    />
  ))}
</div>
```

### CLS Checklist

- [ ] All images have width/height
- [ ] Fonts use `adjustFontFallback`
- [ ] Skeletons for loading states
- [ ] Reserved space for ads/embeds
- [ ] No content insertion above fold
- [ ] Animations use transform/opacity
- [ ] Fixed heights for carousels
- [ ] Aspect ratios for responsive images

## Measuring Core Web Vitals

### In Development

```tsx
// app/layout.tsx
export function reportWebVitals(metric: any) {
  const thresholds = {
    FCP: 1800,
    LCP: 2500,
    FID: 100,
    CLS: 0.1,
    TTFB: 600,
    INP: 200
  }

  console.log(metric.name, metric.value)

  if (metric.value > thresholds[metric.name]) {
    console.warn(`Poor ${metric.name}:`, {
      value: metric.value,
      threshold: thresholds[metric.name],
      rating: metric.rating
    })
  }
}
```

### In Production

```tsx
// app/layout.tsx
export function reportWebVitals(metric: any) {
  // Send to analytics
  if (window.gtag) {
    window.gtag('event', metric.name, {
      value: Math.round(metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true
    })
  }

  // Or send to custom endpoint
  fetch('/api/analytics', {
    method: 'POST',
    body: JSON.stringify({
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      path: window.location.pathname
    })
  })
}
```

### Using Lighthouse

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit
lighthouse http://localhost:3000 --view

# CI/CD integration
lighthouse http://localhost:3000 --output json --output-path ./report.json
```

### Real User Monitoring (RUM)

```tsx
// Using Vercel Analytics
import { Analytics } from '@vercel/analytics/react'

export default function Layout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />  {/* Tracks Core Web Vitals */}
      </body>
    </html>
  )
}
```

## Common Issues and Fixes

### Issue: High LCP

**Diagnosis:**
```bash
# Check what's being loaded
npm run build && npm start
# Open DevTools > Performance > Record page load
# Look for large resources blocking LCP
```

**Fixes:**
- Add `priority` to hero images
- Reduce image file size
- Use CDN for static assets
- Implement caching
- Reduce server response time
- Remove render-blocking scripts

### Issue: High INP

**Diagnosis:**
```tsx
// Log slow interactions
export function reportWebVitals(metric: any) {
  if (metric.name === 'INP' && metric.value > 200) {
    console.warn('Slow interaction:', {
      value: metric.value,
      target: metric.entries[0]?.target
    })
  }
}
```

**Fixes:**
- Debounce inputs
- Use memoization
- Break up long tasks
- Defer non-critical JS
- Move logic to Server Components
- Optimize event handlers

### Issue: High CLS

**Diagnosis:**
```tsx
// Track layout shifts
export function reportWebVitals(metric: any) {
  if (metric.name === 'CLS') {
    metric.entries.forEach(entry => {
      console.log('Shift:', entry.sources)
    })
  }
}
```

**Fixes:**
- Add image dimensions
- Use font fallbacks
- Reserve space for dynamic content
- Avoid inserting content above fold
- Use transforms for animations
- Add skeletons for loading states

## Performance Budget

Set targets in your project:

```json
{
  "budgets": {
    "LCP": 2500,
    "INP": 200,
    "CLS": 0.1,
    "FCP": 1800,
    "TTFB": 600
  }
}
```

Monitor and enforce in CI/CD:

```js
// lighthouse-ci.js
module.exports = {
  ci: {
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'max-potential-fid': ['error', { maxNumericValue: 100 }]
      }
    }
  }
}
```

## Resources

- [Web.dev Core Web Vitals](https://web.dev/vitals/)
- [Next.js Analytics](https://nextjs.org/analytics)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Chrome UX Report](https://developers.google.com/web/tools/chrome-user-experience-report)
