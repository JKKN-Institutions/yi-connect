# PWA Testing Guide

## Lighthouse PWA Audit

### Running Lighthouse Tests

```bash
# CLI testing
npm install -g lighthouse
lighthouse https://your-app.com --view

# Programmatic testing
npm install lighthouse puppeteer
```

```javascript
// lighthouse-test.js
const lighthouse = require('lighthouse')
const chromeLauncher = require('chrome-launcher')

async function runLighthouse(url) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] })
  const options = {
    logLevel: 'info',
    output: 'html',
    port: chrome.port,
    onlyCategories: ['performance', 'pwa', 'accessibility']
  }
  
  const runnerResult = await lighthouse(url, options)
  
  // Check PWA score
  const pwaScore = runnerResult.lhr.categories.pwa.score * 100
  console.log(`PWA Score: ${pwaScore}`)
  
  // Check specific audits
  const audits = runnerResult.lhr.audits
  console.log('Service Worker:', audits['service-worker'].score === 1 ? '✅' : '❌')
  console.log('HTTPS:', audits['is-on-https'].score === 1 ? '✅' : '❌')
  console.log('Installable:', audits['installable-manifest'].score === 1 ? '✅' : '❌')
  
  await chrome.kill()
  return runnerResult
}
```

## Service Worker Testing

### Jest Test Setup

```typescript
// __tests__/service-worker.test.ts
import { installSerwist } from '@serwist/sw'
import makeServiceWorkerEnv from 'service-worker-mock'

describe('Service Worker', () => {
  beforeEach(() => {
    Object.assign(global, makeServiceWorkerEnv())
    jest.resetModules()
  })
  
  test('should cache static assets on install', async () => {
    const cacheName = 'static-v1'
    const urlsToCache = [
      '/',
      '/offline',
      '/manifest.json'
    ]
    
    // Trigger install event
    await self.trigger('install')
    
    // Check if cache was created
    const cacheNames = await self.caches.keys()
    expect(cacheNames).toContain(cacheName)
    
    // Check if URLs were cached
    const cache = await self.caches.open(cacheName)
    for (const url of urlsToCache) {
      const response = await cache.match(url)
      expect(response).toBeDefined()
    }
  })
  
  test('should return cached response when offline', async () => {
    const request = new Request('/api/data')
    const cachedResponse = new Response('{"cached": true}')
    
    // Add to cache
    const cache = await self.caches.open('api-cache')
    await cache.put(request, cachedResponse)
    
    // Mock offline
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
    
    // Trigger fetch event
    const response = await self.trigger('fetch', request)
    
    expect(response).toBeDefined()
    const data = await response.json()
    expect(data.cached).toBe(true)
  })
  
  test('should handle push notifications', async () => {
    const pushData = {
      title: 'Test Notification',
      body: 'Test body',
      icon: '/icon.png'
    }
    
    const showNotificationSpy = jest.spyOn(
      self.registration,
      'showNotification'
    )
    
    // Trigger push event
    await self.trigger('push', {
      data: {
        json: () => pushData
      }
    })
    
    expect(showNotificationSpy).toHaveBeenCalledWith(
      pushData.title,
      expect.objectContaining({
        body: pushData.body,
        icon: pushData.icon
      })
    )
  })
})
```

## E2E Testing with Playwright

### PWA Installation Test

```typescript
// e2e/pwa-install.spec.ts
import { test, expect } from '@playwright/test'

test.describe('PWA Installation', () => {
  test('should show install prompt', async ({ page, context }) => {
    // Grant permissions
    await context.grantPermissions(['notifications'])
    
    // Navigate to app
    await page.goto('/')
    
    // Wait for service worker
    await page.waitForFunction(() => 'serviceWorker' in navigator)
    
    // Check if manifest is loaded
    const manifest = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]')
      return link ? link.href : null
    })
    expect(manifest).toBeTruthy()
    
    // Check for install prompt (Chrome only)
    const installPromptTriggered = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener('beforeinstallprompt', () => {
          resolve(true)
        })
        
        // Timeout after 5 seconds
        setTimeout(() => resolve(false), 5000)
      })
    })
    
    if (installPromptTriggered) {
      console.log('Install prompt available')
    }
  })
  
  test('should work offline', async ({ page, context }) => {
    // First visit online
    await page.goto('/')
    
    // Wait for service worker to activate
    await page.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.active?.state === 'activated'
    })
    
    // Go offline
    await context.setOffline(true)
    
    // Navigate should still work
    await page.reload()
    
    // Check if page loads
    await expect(page.locator('h1')).toBeVisible()
    
    // Check for offline indicator if implemented
    const isOffline = await page.evaluate(() => !navigator.onLine)
    expect(isOffline).toBe(true)
  })
  
  test('should handle push notifications', async ({ page, context }) => {
    // Grant notification permission
    await context.grantPermissions(['notifications'])
    
    await page.goto('/')
    
    // Check permission status
    const permission = await page.evaluate(() => Notification.permission)
    expect(permission).toBe('granted')
    
    // Subscribe to push
    const subscribed = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      
      try {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: new Uint8Array([/* your key */])
        })
        return !!subscription
      } catch (error) {
        return false
      }
    })
    
    expect(subscribed).toBe(true)
  })
})
```

## Performance Testing

### Web Vitals Monitoring

```typescript
// lib/web-vitals.ts
import { getCLS, getFID, getLCP, getFCP, getTTFB } from 'web-vitals'

export function reportWebVitals() {
  getCLS(console.log)
  getFID(console.log)
  getLCP(console.log)
  getFCP(console.log)
  getTTFB(console.log)
  
  // Send to analytics
  getCLS(sendToAnalytics)
  getFID(sendToAnalytics)
  getLCP(sendToAnalytics)
  getFCP(sendToAnalytics)
  getTTFB(sendToAnalytics)
}

function sendToAnalytics(metric: any) {
  // Google Analytics
  if (typeof gtag !== 'undefined') {
    gtag('event', metric.name, {
      value: Math.round(metric.value),
      event_label: metric.id,
      non_interaction: true
    })
  }
  
  // Custom endpoint
  fetch('/api/analytics/vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metric: metric.name,
      value: metric.value,
      id: metric.id,
      url: window.location.href
    })
  })
}
```

### Load Testing

```javascript
// load-test.js
const autocannon = require('autocannon')

async function loadTest() {
  const result = await autocannon({
    url: 'http://localhost:3000',
    connections: 100,
    pipelining: 1,
    duration: 30,
    requests: [
      {
        method: 'GET',
        path: '/'
      },
      {
        method: 'GET',
        path: '/api/data'
      },
      {
        method: 'POST',
        path: '/api/sync',
        body: JSON.stringify({ test: true }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    ]
  })
  
  console.log('Requests per second:', result.requests.average)
  console.log('Latency (ms):', result.latency.average)
  console.log('Errors:', result.errors)
}

loadTest()
```

## Mobile Testing

### Device Testing Checklist

```typescript
// test-utils/device-test.ts
export const deviceTests = [
  {
    name: 'iPhone 12',
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    hasTouch: true
  },
  {
    name: 'iPad Pro',
    viewport: { width: 1024, height: 1366 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
    hasTouch: true
  },
  {
    name: 'Pixel 5',
    viewport: { width: 393, height: 851 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5)',
    hasTouch: true
  },
  {
    name: 'Samsung Galaxy S21',
    viewport: { width: 384, height: 854 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B)',
    hasTouch: true
  }
]

// Playwright device testing
import { devices } from '@playwright/test'

test.describe('Mobile PWA Tests', () => {
  for (const device of ['iPhone 12', 'Pixel 5']) {
    test(`should work on ${device}`, async ({ browser }) => {
      const context = await browser.newContext({
        ...devices[device]
      })
      
      const page = await context.newPage()
      await page.goto('/')
      
      // Test touch gestures
      await page.tap('[data-testid="menu-button"]')
      
      // Test viewport
      const viewport = page.viewportSize()
      expect(viewport.width).toBeLessThan(500)
      
      // Test orientation change
      await page.evaluate(() => {
        screen.orientation.addEventListener('change', () => {
          console.log('Orientation changed')
        })
      })
      
      await context.close()
    })
  }
})
```

## Offline Testing

### Network Simulation

```typescript
// e2e/offline.spec.ts
test('should handle offline scenarios', async ({ page, context }) => {
  // Test offline data caching
  await page.goto('/data-page')
  
  // Wait for data to load
  await page.waitForSelector('[data-testid="data-loaded"]')
  
  // Go offline
  await context.setOffline(true)
  
  // Refresh page
  await page.reload()
  
  // Data should still be visible (from cache)
  await expect(page.locator('[data-testid="data-loaded"]')).toBeVisible()
  
  // Test offline form submission
  await page.fill('#name', 'Test User')
  await page.click('#submit')
  
  // Should show offline message
  await expect(page.locator('.offline-message')).toBeVisible()
  
  // Go back online
  await context.setOffline(false)
  
  // Should sync automatically
  await page.waitForSelector('.sync-success', { timeout: 10000 })
})
```

## Security Testing

### CSP Validation

```typescript
// security-test.ts
test('should have proper CSP headers', async ({ page }) => {
  const response = await page.goto('/')
  const csp = response?.headers()['content-security-policy']
  
  expect(csp).toBeDefined()
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("script-src 'self'")
  expect(csp).not.toContain("'unsafe-inline'")
  expect(csp).not.toContain("'unsafe-eval'")
})

test('should use HTTPS', async ({ page }) => {
  const response = await page.goto('/')
  const url = new URL(response?.url() || '')
  
  expect(url.protocol).toBe('https:')
})
```

## Automated Testing Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/pwa-tests.yml
name: PWA Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build app
        run: npm run build
        
      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/dashboard
          uploadArtifacts: true
          temporaryPublicStorage: true
          
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright
        run: npx playwright install --with-deps
        
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Manual Testing Checklist

```markdown
## PWA Manual Testing Checklist

### Installation
- [ ] Install prompt appears on desktop Chrome
- [ ] Install prompt appears on mobile browsers
- [ ] App installs successfully
- [ ] App icon appears on home screen
- [ ] App opens in standalone mode
- [ ] Splash screen displays correctly

### Offline Functionality
- [ ] App loads when offline
- [ ] Critical pages are cached
- [ ] Offline page displays for non-cached routes
- [ ] Forms can be filled offline
- [ ] Data syncs when back online

### Push Notifications
- [ ] Permission prompt appears
- [ ] Notifications display correctly
- [ ] Click actions work
- [ ] Unsubscribe works

### Performance
- [ ] Lighthouse PWA score > 90
- [ ] First paint < 2s
- [ ] Time to interactive < 5s
- [ ] No layout shifts

### Cross-browser
- [ ] Chrome (Desktop & Mobile)
- [ ] Safari (iOS 16.4+)
- [ ] Firefox
- [ ] Edge
- [ ] Samsung Internet

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast passes WCAG
- [ ] Focus indicators visible
```
