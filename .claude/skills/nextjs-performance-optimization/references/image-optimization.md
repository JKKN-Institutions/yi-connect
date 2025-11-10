# Image Optimization Guide for Next.js

Comprehensive guide to optimizing images for maximum performance in Next.js applications.

## Next.js Image Component

### Basic Usage

```tsx
import Image from 'next/image'

export default function ProductImage() {
  return (
    <Image
      src="/product.jpg"
      alt="Product"
      width={800}
      height={600}
      quality={85}
    />
  )
}
```

### Image Priority (LCP)

```tsx
// Hero/above-fold images - preload for LCP
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1920}
  height={1080}
  priority          // ← Preloads the image
  quality={90}      // Higher quality for hero
/>

// Below-fold images - lazy load
<Image
  src="/product.jpg"
  alt="Product"
  width={400}
  height={300}
  loading="lazy"    // Default behavior
/>
```

### Responsive Images

```tsx
<Image
  src="/banner.jpg"
  alt="Banner"
  width={1200}
  height={400}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  quality={85}
/>
```

**Sizes Explained:**
- `(max-width: 768px) 100vw` - Full width on mobile
- `(max-width: 1200px) 50vw` - Half width on tablet
- `33vw` - One-third width on desktop

### Fill Container

```tsx
// For images that should fill container
<div className="relative w-full h-[400px]">
  <Image
    src="/background.jpg"
    alt="Background"
    fill                           // Fills container
    style={{ objectFit: 'cover' }}  // or 'contain'
    sizes="100vw"
  />
</div>
```

### Blur Placeholder

```tsx
// Static import - automatic blur placeholder
import heroImage from '@/public/hero.jpg'

<Image
  src={heroImage}
  alt="Hero"
  placeholder="blur"  // Auto-generated blur
/>

// Dynamic - manual blur data URL
<Image
  src="/dynamic-image.jpg"
  alt="Dynamic"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
/>
```

## Image Configuration

### Global Configuration

```js
// next.config.js
module.exports = {
  images: {
    // Formats (in order of preference)
    formats: ['image/avif', 'image/webp'],

    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],

    // Image sizes for different use cases
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Cache optimization
    minimumCacheTTL: 31536000,  // 1 year

    // Remote patterns
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.example.com',
        port: '',
        pathname: '/uploads/**'
      }
    ],

    // Disable static imports if needed
    disableStaticImages: false,

    // Dangerous allow all (not recommended)
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment'
  }
}
```

### Custom Loader

```js
// next.config.js
module.exports = {
  images: {
    loader: 'custom',
    loaderFile: './imageLoader.ts'
  }
}
```

```ts
// imageLoader.ts
export default function cloudinaryLoader({ src, width, quality }) {
  const params = ['f_auto', 'c_limit', `w_${width}`, `q_${quality || 'auto'}`]
  return `https://res.cloudinary.com/demo/image/upload/${params.join(',')}${src}`
}
```

## Image Formats

### Format Comparison

| Format | Compression | Browser Support | Use Case |
|--------|-------------|-----------------|----------|
| AVIF | Best | Modern browsers | Production (with fallback) |
| WebP | Excellent | 95%+ browsers | Default modern format |
| JPEG | Good | 100% | Fallback, photos |
| PNG | Lossless | 100% | Transparency needed |
| SVG | Vector | 100% | Icons, logos |

### Format Selection Strategy

```tsx
// Next.js automatically serves best format
<Image
  src="/photo.jpg"       // Served as AVIF or WebP if supported
  alt="Photo"
  width={800}
  height={600}
/>

// For manual control
<picture>
  <source srcSet="/image.avif" type="image/avif" />
  <source srcSet="/image.webp" type="image/webp" />
  <img src="/image.jpg" alt="Fallback" />
</picture>
```

## Image Optimization Techniques

### Quality Settings

```tsx
// Hero images - high quality
<Image src="/hero.jpg" quality={90} />

// Content images - balanced
<Image src="/content.jpg" quality={85} />  // Default

// Thumbnails - lower quality acceptable
<Image src="/thumb.jpg" quality={75} />

// Background images - optimize aggressively
<Image src="/bg.jpg" quality={60} />
```

### Lazy Loading

```tsx
// Above-fold - no lazy loading
<Image
  src="/hero.jpg"
  priority
  loading="eager"
/>

// Just below fold - lazy load
<Image
  src="/product.jpg"
  loading="lazy"  // Default
/>

// Native lazy loading (without Image component)
<img src="/regular.jpg" loading="lazy" alt="Image" />
```

### Blur-up Technique

```tsx
// Generate blur placeholder
import { getPlaiceholder } from 'plaiceholder'

async function getBlurData(imagePath: string) {
  const buffer = await fs.readFile(imagePath)
  const { base64 } = await getPlaiceholder(buffer)
  return base64
}

// Usage
export default async function Page() {
  const blurDataURL = await getBlurData('./public/hero.jpg')

  return (
    <Image
      src="/hero.jpg"
      alt="Hero"
      width={1920}
      height={1080}
      placeholder="blur"
      blurDataURL={blurDataURL}
    />
  )
}
```

## Remote Images

### Configuration

```js
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com'
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com'
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/photo-*'
      }
    ]
  }
}
```

### Usage

```tsx
<Image
  src="https://cdn.example.com/photo.jpg"
  alt="Remote"
  width={800}
  height={600}
  unoptimized={false}  // Enable optimization
/>
```

### Optimization Bypass

```tsx
// For already-optimized CDN images
<Image
  src="https://optimized-cdn.com/image.jpg"
  alt="Pre-optimized"
  width={800}
  height={600}
  unoptimized  // Skip Next.js optimization
/>
```

## Advanced Patterns

### Art Direction

```tsx
'use client'

import Image from 'next/image'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export default function ResponsiveImage() {
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
    <Image
      src={isMobile ? '/mobile-hero.jpg' : '/desktop-hero.jpg'}
      alt="Hero"
      width={isMobile ? 768 : 1920}
      height={isMobile ? 400 : 1080}
      priority
    />
  )
}
```

### Dynamic Image Grid

```tsx
export default function ImageGrid({ images }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {images.map((img, index) => (
        <div key={img.id} className="relative aspect-square">
          <Image
            src={img.url}
            alt={img.alt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
            priority={index < 3}  // Prioritize first row
          />
        </div>
      ))}
    </div>
  )
}
```

### Image Carousel with Prefetch

```tsx
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

export default function Carousel({ images }) {
  const [current, setCurrent] = useState(0)

  // Prefetch next image
  useEffect(() => {
    const nextIndex = (current + 1) % images.length
    const img = new window.Image()
    img.src = images[nextIndex]
  }, [current, images])

  return (
    <div className="relative h-[400px]">
      <Image
        src={images[current]}
        alt={`Slide ${current + 1}`}
        fill
        priority
        sizes="100vw"
      />
    </div>
  )
}
```

## SVG Optimization

### Inline SVG

```tsx
// For small icons - inline
export default function Icon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path d="..." />
    </svg>
  )
}
```

### SVG as Image

```tsx
// For larger SVGs
import Image from 'next/image'

<Image
  src="/logo.svg"
  alt="Logo"
  width={200}
  height={60}
/>
```

### SVGR Integration

```tsx
// Import SVG as component
import Logo from '@/public/logo.svg'

export default function Header() {
  return <Logo className="h-12 w-auto" />
}
```

```js
// next.config.js
module.exports = {
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    })
    return config
  }
}
```

## Performance Monitoring

### Track Image Loading

```tsx
'use client'

export default function MonitoredImage({ src, alt }) {
  const handleLoadingComplete = (result) => {
    console.log('Image loaded:', {
      src,
      naturalWidth: result.naturalWidth,
      naturalHeight: result.naturalHeight
    })

    // Track to analytics
    analytics.track('image_loaded', {
      src,
      width: result.naturalWidth,
      height: result.naturalHeight
    })
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={600}
      onLoadingComplete={handleLoadingComplete}
    />
  )
}
```

### Detect Largest Contentful Paint

```tsx
// app/layout.tsx
export function reportWebVitals(metric) {
  if (metric.name === 'LCP') {
    const lcpElement = metric.entries[metric.entries.length - 1]
    console.log('LCP element:', lcpElement.element)

    if (lcpElement.element?.tagName === 'IMG') {
      console.log('LCP is an image:', lcpElement.url)
    }
  }
}
```

## Image Optimization Checklist

### Before Production

- [ ] All images use Next.js Image component
- [ ] Hero/LCP images have `priority` prop
- [ ] All images have appropriate `sizes` attribute
- [ ] Quality set appropriately (85 default, 90 hero, 75 thumbnails)
- [ ] AVIF and WebP formats enabled
- [ ] Blur placeholders for important images
- [ ] Remote image domains configured
- [ ] No layout shifts (width/height specified)
- [ ] Lazy loading for below-fold images
- [ ] SVGs optimized and properly loaded

### Measurement

```bash
# Check image sizes
npm run build

# Lighthouse audit
lighthouse http://localhost:3000 --view

# Check actual served formats
curl -I http://localhost:3000/_next/image?url=/hero.jpg&w=1920&q=85
```

## Common Issues

### Issue: Images Not Optimizing

**Check:**
1. Using Image component?
2. Remote domain configured?
3. Build mode (not dev)?

```tsx
// ❌ Won't optimize
<img src="/photo.jpg" />

// ✅ Will optimize
<Image src="/photo.jpg" width={800} height={600} />
```

### Issue: Slow LCP

**Fix:**
```tsx
// Add priority to LCP image
<Image
  src="/hero.jpg"
  priority  // ← Add this
  quality={90}
  width={1920}
  height={1080}
/>
```

### Issue: Layout Shift (CLS)

**Fix:**
```tsx
// ❌ Missing dimensions
<Image src="/photo.jpg" />

// ✅ Specify dimensions
<Image src="/photo.jpg" width={800} height={600} />

// ✅ Or use fill with container
<div className="relative h-[400px]">
  <Image src="/photo.jpg" fill />
</div>
```

### Issue: Blurry Images

**Fix:**
```tsx
// Increase quality or use larger dimensions
<Image
  src="/photo.jpg"
  width={800}    // Serve larger size
  height={600}
  quality={90}   // Increase quality
/>
```

## Resources

- [Next.js Image Documentation](https://nextjs.org/docs/app/api-reference/components/image)
- [Image Optimization Guide](https://web.dev/fast/#optimize-your-images)
- [AVIF Support](https://caniuse.com/avif)
- [WebP Support](https://caniuse.com/webp)
