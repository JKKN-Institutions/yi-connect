# Bundle Optimization Patterns for Next.js 16

Comprehensive guide to reducing JavaScript bundle sizes and improving load performance in Next.js applications.

## Table of Contents

1. [Bundle Analysis](#bundle-analysis)
2. [Import Optimization](#import-optimization)
3. [Code Splitting](#code-splitting)
4. [Dynamic Imports](#dynamic-imports)
5. [Tree Shaking](#tree-shaking)
6. [Package Optimization](#package-optimization)
7. [Turbopack Configuration](#turbopack-configuration)

## Bundle Analysis

### Enable Bundle Analyzer

```js
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
})

module.exports = withBundleAnalyzer({
  // Your Next.js config
})
```

```bash
# Analyze bundle
ANALYZE=true npm run build

# Opens interactive treemap showing bundle composition
```

### Reading the Analysis

Look for:
- **Large bundles** > 244KB (uncompressed)
- **Duplicate dependencies** in multiple chunks
- **Unused code** from libraries
- **Vendor chunks** that could be split

## Import Optimization

### Tree-Shakeable Imports

```tsx
// ❌ Bad - imports entire library
import { Button, TextField, Select, Card } from '@mui/material'
import _ from 'lodash'
import * as Icons from 'react-icons'

// ✅ Good - tree-shakeable imports
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { debounce } from 'lodash-es'
import { FiCheck } from 'react-icons/fi'
```

### Enable Package Import Optimization

```js
// next.config.js
module.exports = {
  experimental: {
    optimizePackageImports: [
      '@mui/material',
      '@mui/icons-material',
      'lodash',
      'react-icons',
      'lucide-react',
      '@tremor/react',
      'recharts',
      'date-fns'
    ]
  }
}
```

With this enabled, you can use the convenient imports:
```tsx
// Now these are automatically optimized!
import { Button, TextField } from '@mui/material'
import { FiCheck, FiX } from 'react-icons/fi'
```

### Barrel File Optimization

```tsx
// ❌ Bad - barrel files prevent tree-shaking
// components/index.ts exports everything
import { Button, Header, Footer, Sidebar, Modal } from '@/components'

// ✅ Good - direct imports
import { Button } from '@/components/Button'
import { Header } from '@/components/Header'

// Or configure optimizePackageImports for your own packages
```

## Code Splitting

### Automatic Code Splitting

Next.js automatically splits code at route boundaries:

```
app/
├── page.tsx           → page.js chunk
├── about/
│   └── page.tsx       → about/page.js chunk
└── dashboard/
    └── page.tsx       → dashboard/page.js chunk
```

Each page gets its own bundle, loaded on-demand.

### Component-Level Splitting

```tsx
// Automatically split into separate chunks
export default function Page() {
  return (
    <>
      <Header />           {/* In page chunk */}
      <ProductGrid />      {/* In page chunk */}
      <Footer />           {/* In page chunk */}
    </>
  )
}
```

### Shared Chunks

Common dependencies are automatically extracted:

```
chunks/
├── framework.js       → React, React-DOM
├── main.js            → Next.js runtime
├── webpack.js         → Webpack runtime
└── 123abc.js          → Shared components
```

## Dynamic Imports

### Basic Dynamic Import

```tsx
import dynamic from 'next/dynamic'

// Load component on-demand
const HeavyChart = dynamic(() => import('@/components/HeavyChart'))

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <HeavyChart />  {/* Loaded when component renders */}
    </div>
  )
}
```

### With Loading State

```tsx
const HeavyChart = dynamic(
  () => import('@/components/HeavyChart'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false  // Disable SSR if not needed
  }
)
```

### Named Exports

```tsx
// Import named export
const SpecificComponent = dynamic(
  () => import('@/components/Heavy').then(mod => mod.SpecificComponent)
)
```

### Conditional Loading

```tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  ssr: false,
  loading: () => <p>Loading PDF viewer...</p>
})

export default function DocumentPage() {
  const [showPDF, setShowPDF] = useState(false)

  return (
    <div>
      <button onClick={() => setShowPDF(true)}>View PDF</button>
      {showPDF && <PDFViewer />}  {/* Only loaded when needed */}
    </div>
  )
}
```

### Lazy Loading Heavy Libraries

```tsx
// ❌ Bad - loads immediately
import moment from 'moment'
import Markdown from 'react-markdown'
import Chart from 'chart.js'

// ✅ Good - load on-demand
const formatDate = async (date: Date) => {
  const { default: dayjs } = await import('dayjs')  // Lighter alternative
  return dayjs(date).format('YYYY-MM-DD')
}

const MarkdownPreview = dynamic(() => import('react-markdown'))
const ChartComponent = dynamic(() => import('@/components/Chart'))
```

## Tree Shaking

### Ensure ES Modules

```js
// next.config.js
module.exports = {
  turbopack: {
    resolveAlias: {
      // Prefer ESM versions for better tree-shaking
      'lodash': 'lodash-es',
      'date-fns': 'date-fns/esm'
    }
  }
}
```

### Side-Effect Free Code

```js
// package.json
{
  "sideEffects": false  // Enables aggressive tree-shaking
}

// Or specify files with side effects
{
  "sideEffects": ["*.css", "*.scss", "src/polyfills.ts"]
}
```

### Mark Pure Functions

```tsx
// Use /*#__PURE__*/ annotation
const createConfig = /*#__PURE__*/ () => ({
  apiUrl: process.env.NEXT_PUBLIC_API_URL
})

// Minifier can remove if unused
```

## Package Optimization

### Replace Heavy Packages

```tsx
// Heavy packages → Lighter alternatives
moment (329KB)           → dayjs (7KB) or date-fns (13KB)
lodash (72KB)            → lodash-es + direct imports
axios (33KB)             → fetch API (built-in)
react-icons (all icons)  → lucide-react (specific icons)
chart.js (400KB)         → recharts (100KB) or visx
jquery                   → vanilla JS or React
```

### Example Migration

```tsx
// Before: Using Moment.js (329KB)
import moment from 'moment'
const formatted = moment(date).format('YYYY-MM-DD')

// After: Using dayjs (7KB)
import dayjs from 'dayjs'
const formatted = dayjs(date).format('YYYY-MM-DD')

// Or: Using native Intl API (0KB)
const formatted = new Intl.DateTimeFormat('en-US').format(date)
```

### Reduce Polyfills

```js
// next.config.js
module.exports = {
  // Only support modern browsers
  compiler: {
    targets: {
      browsers: ['chrome >= 90', 'firefox >= 88', 'safari >= 14']
    }
  }
}
```

## Turbopack Configuration

### Enable Turbopack (Next.js 16)

```bash
# Turbopack is now default in Next.js 16
npm run dev   # Uses Turbopack automatically
npm run build # Uses Turbopack for production
```

### Optimize for Production

```js
// next.config.js
module.exports = {
  turbopack: {
    // Resolve aliases for smaller bundles
    resolveAlias: {
      '@mui/material': '@mui/material/esm',
      'lodash': 'lodash-es'
    },

    // Module rules
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js'
      }
    }
  },

  // Production optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false
  }
}
```

### Performance Monitoring

```bash
# Turbopack build with tracing
NEXT_TURBOPACK_TRACING=1 npm run build

# Analyze output
npm run build -- --debug
```

## Advanced Techniques

### Manual Chunk Splitting

```js
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // Vendor chunk for heavy libraries
          vendor: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'vendor',
            priority: 10
          },
          // Separate chunk for UI library
          mui: {
            test: /[\\/]node_modules[\\/]@mui[\\/]/,
            name: 'mui',
            priority: 9
          },
          // Common components
          common: {
            minChunks: 2,
            priority: 8,
            reuseExistingChunk: true
          }
        }
      }
    }
    return config
  }
}
```

### Preload Critical Chunks

```tsx
// app/layout.tsx
import Link from 'next/link'

export default function Layout({ children }) {
  return (
    <html>
      <head>
        {/* Preload critical routes */}
        <link rel="prefetch" href="/dashboard" />
        <link rel="preload" href="/api/user" as="fetch" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### CSS Optimization

```js
// next.config.js
module.exports = {
  // Optimize CSS
  experimental: {
    optimizeCss: true  // Uses Lightning CSS
  }
}
```

### Remove Unused CSS

```js
// Use CSS Modules for automatic purging
// Button.module.css - only styles used by Button.tsx are included

// Or use Tailwind CSS with built-in purging
// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ]
}
```

## Bundle Size Targets

### Recommended Limits

| Metric | Target | Maximum |
|--------|--------|---------|
| Initial JS (FCP) | < 130 KB | < 170 KB |
| Total JS (Load) | < 200 KB | < 350 KB |
| Main bundle | < 170 KB | < 244 KB |
| CSS | < 50 KB | < 100 KB |
| Individual chunk | < 50 KB | < 100 KB |

*All sizes are gzipped*

### Calculate Gzip Size

```bash
# Check gzipped size
gzip -c .next/static/chunks/main-*.js | wc -c

# Or use size-limit
npm install --save-dev size-limit @size-limit/preset-app
```

```js
// package.json
{
  "size-limit": [
    {
      "path": ".next/static/chunks/*.js",
      "limit": "200 KB"
    }
  ]
}
```

## Monitoring & Validation

### Bundle Size Tracking

```js
// .github/workflows/bundle-size.yml
name: Bundle Size Check

on: [pull_request]

jobs:
  size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run build
      - uses: andresz1/size-limit-action@v1
```

### Performance Budget

```js
// next.config.js
module.exports = {
  // Fail build if bundle too large
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5
  },

  // Custom build warnings
  webpack: (config) => {
    config.performance = {
      maxAssetSize: 244000,      // 244KB
      maxEntrypointSize: 244000,
      hints: 'error'
    }
    return config
  }
}
```

## Checklist

Before deploying, verify:

- [ ] Bundle analyzer shows no unexpected large dependencies
- [ ] Initial JS bundle < 200KB (gzipped)
- [ ] Heavy libraries use dynamic imports
- [ ] Using optimizePackageImports for icon libraries
- [ ] Tree-shakeable imports for UI libraries
- [ ] No duplicate dependencies in multiple chunks
- [ ] CSS is optimized and purged
- [ ] Polyfills are minimal
- [ ] Build warnings addressed
- [ ] Performance budget in place

## Debugging Bundle Issues

```bash
# 1. Analyze bundle composition
ANALYZE=true npm run build

# 2. Check which components are in which chunks
npm run build -- --debug

# 3. Inspect individual chunk contents
less .next/static/chunks/app/page-*.js

# 4. Test bundle loading in production
npm run build && npm start

# 5. Monitor network tab for unnecessary loads
```

## Resources

- [Next.js Bundle Analysis](https://nextjs.org/docs/app/building-your-application/optimizing/bundle-analyzer)
- [Turbopack Documentation](https://nextjs.org/docs/architecture/turbopack)
- [Bundle Size Optimization Guide](https://web.dev/fast/)
