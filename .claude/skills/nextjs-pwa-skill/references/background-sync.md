# Background Sync Implementation

## Core Background Sync Setup

### Basic Background Sync Registration

```typescript
// app/hooks/useBackgroundSync.ts
import { useEffect } from 'react'

export function useBackgroundSync() {
  useEffect(() => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      registerBackgroundSync()
    }
  }, [])
  
  async function registerBackgroundSync() {
    const registration = await navigator.serviceWorker.ready
    
    try {
      await registration.sync.register('data-sync')
      console.log('Background sync registered')
    } catch (error) {
      console.error('Background sync registration failed:', error)
    }
  }
  
  async function requestSync(tag: string = 'data-sync') {
    const registration = await navigator.serviceWorker.ready
    await registration.sync.register(tag)
  }
  
  return { requestSync }
}
```

## Advanced Queue Management

### IndexedDB Queue Implementation

```typescript
// lib/sync-queue.ts
class SyncQueue {
  private dbName = 'SyncQueue'
  private storeName = 'requests'
  private db: IDBDatabase | null = null
  
  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true
          })
          
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('status', 'status', { unique: false })
          store.createIndex('retryCount', 'retryCount', { unique: false })
        }
      }
    })
  }
  
  async addRequest(request: {
    url: string
    method: string
    headers?: HeadersInit
    body?: any
    metadata?: any
  }) {
    if (!this.db) await this.init()
    
    const transaction = this.db!.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)
    
    const queueItem = {
      ...request,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    }
    
    return new Promise((resolve, reject) => {
      const request = store.add(queueItem)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  
  async getNextRequest() {
    if (!this.db) await this.init()
    
    const transaction = this.db!.transaction([this.storeName], 'readonly')
    const store = transaction.objectStore(this.storeName)
    const index = store.index('status')
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only('pending'))
      
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          resolve(cursor.value)
        } else {
          resolve(null)
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }
  
  async updateRequest(id: number, updates: any) {
    if (!this.db) await this.init()
    
    const transaction = this.db!.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)
    
    const getRequest = store.get(id)
    
    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const data = getRequest.result
        if (!data) {
          reject(new Error('Request not found'))
          return
        }
        
        const updated = { ...data, ...updates }
        const updateRequest = store.put(updated)
        
        updateRequest.onsuccess = () => resolve(updated)
        updateRequest.onerror = () => reject(updateRequest.error)
      }
      
      getRequest.onerror = () => reject(getRequest.error)
    })
  }
  
  async deleteRequest(id: number) {
    if (!this.db) await this.init()
    
    const transaction = this.db!.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(request.error)
    })
  }
  
  async getAllPending() {
    if (!this.db) await this.init()
    
    const transaction = this.db!.transaction([this.storeName], 'readonly')
    const store = transaction.objectStore(this.storeName)
    const index = store.index('status')
    
    return new Promise<any[]>((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only('pending'))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000) {
    if (!this.db) await this.init()
    
    const transaction = this.db!.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)
    const index = store.index('timestamp')
    
    const cutoff = Date.now() - maxAge
    const range = IDBKeyRange.upperBound(cutoff)
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(range)
      let deleted = 0
      
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          cursor.delete()
          deleted++
          cursor.continue()
        } else {
          resolve(deleted)
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }
}

export const syncQueue = new SyncQueue()
```

## Service Worker Sync Handler

```typescript
// sw.ts - Advanced sync handler
self.addEventListener('sync', (event: any) => {
  console.log('Sync event triggered:', event.tag)
  
  switch (event.tag) {
    case 'data-sync':
      event.waitUntil(syncData())
      break
    case 'analytics-sync':
      event.waitUntil(syncAnalytics())
      break
    case 'image-upload':
      event.waitUntil(syncImageUploads())
      break
    default:
      event.waitUntil(genericSync(event.tag))
  }
})

async function syncData() {
  const queue = new SyncQueue()
  await queue.init()
  
  const pending = await queue.getAllPending()
  console.log(`Processing ${pending.length} queued requests`)
  
  for (const item of pending) {
    try {
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, item.retryCount), 30000)
      await new Promise(resolve => setTimeout(resolve, delay))
      
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body ? JSON.stringify(item.body) : undefined
      })
      
      if (response.ok) {
        await queue.deleteRequest(item.id)
        console.log(`Successfully synced request ${item.id}`)
      } else if (response.status >= 400 && response.status < 500) {
        // Client error - don't retry
        await queue.updateRequest(item.id, {
          status: 'failed',
          error: `HTTP ${response.status}`
        })
      } else {
        // Server error - retry
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.error(`Failed to sync request ${item.id}:`, error)
      
      // Update retry count
      const newRetryCount = item.retryCount + 1
      
      if (newRetryCount >= 5) {
        // Max retries reached
        await queue.updateRequest(item.id, {
          status: 'failed',
          retryCount: newRetryCount,
          error: error.message
        })
      } else {
        await queue.updateRequest(item.id, {
          retryCount: newRetryCount
        })
      }
    }
  }
}

async function syncAnalytics() {
  // Batch analytics events
  const events = await getStoredAnalytics()
  
  if (events.length === 0) return
  
  try {
    const response = await fetch('/api/analytics/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events })
    })
    
    if (response.ok) {
      await clearStoredAnalytics()
    }
  } catch (error) {
    console.error('Analytics sync failed:', error)
  }
}

async function syncImageUploads() {
  const cache = await caches.open('image-uploads')
  const requests = await cache.keys()
  
  for (const request of requests) {
    const response = await cache.match(request)
    if (!response) continue
    
    try {
      const blob = await response.blob()
      const formData = new FormData()
      formData.append('image', blob)
      
      // Get metadata from request URL
      const url = new URL(request.url)
      const metadata = Object.fromEntries(url.searchParams)
      
      for (const [key, value] of Object.entries(metadata)) {
        formData.append(key, value)
      }
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      if (uploadResponse.ok) {
        await cache.delete(request)
      }
    } catch (error) {
      console.error('Image upload failed:', error)
    }
  }
}
```

## Periodic Background Sync

```typescript
// Periodic sync registration (requires permission)
async function registerPeriodicSync() {
  const registration = await navigator.serviceWorker.ready
  
  // Check if periodic sync is supported
  if ('periodicSync' in registration) {
    try {
      // Request permission
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync' as PermissionName
      })
      
      if (status.state === 'granted') {
        await registration.periodicSync.register('daily-sync', {
          minInterval: 24 * 60 * 60 * 1000 // 24 hours
        })
        
        await registration.periodicSync.register('check-updates', {
          minInterval: 60 * 60 * 1000 // 1 hour
        })
      }
    } catch (error) {
      console.error('Periodic sync registration failed:', error)
    }
  }
}

// Service worker handler
self.addEventListener('periodicsync', (event: any) => {
  switch (event.tag) {
    case 'daily-sync':
      event.waitUntil(performDailySync())
      break
    case 'check-updates':
      event.waitUntil(checkForUpdates())
      break
  }
})

async function performDailySync() {
  // Clean up old data
  await syncQueue.cleanup()
  
  // Sync user preferences
  await syncUserPreferences()
  
  // Update cached content
  await updateCachedContent()
}
```

## Form Data Sync

```typescript
// Auto-save and sync form data
class FormSync {
  private formData: Map<string, any> = new Map()
  
  trackForm(formId: string) {
    const form = document.getElementById(formId) as HTMLFormElement
    if (!form) return
    
    // Auto-save on input
    form.addEventListener('input', (event) => {
      this.saveFormData(formId, form)
    })
    
    // Sync on submit
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      await this.syncForm(formId, form)
    })
    
    // Restore saved data
    this.restoreFormData(formId, form)
  }
  
  private saveFormData(formId: string, form: HTMLFormElement) {
    const data = new FormData(form)
    const object: any = {}
    
    data.forEach((value, key) => {
      object[key] = value
    })
    
    this.formData.set(formId, object)
    localStorage.setItem(`form_${formId}`, JSON.stringify(object))
  }
  
  private restoreFormData(formId: string, form: HTMLFormElement) {
    const saved = localStorage.getItem(`form_${formId}`)
    if (!saved) return
    
    try {
      const data = JSON.parse(saved)
      
      for (const [key, value] of Object.entries(data)) {
        const input = form.elements.namedItem(key) as HTMLInputElement
        if (input) {
          input.value = value as string
        }
      }
    } catch (error) {
      console.error('Failed to restore form data:', error)
    }
  }
  
  private async syncForm(formId: string, form: HTMLFormElement) {
    const data = new FormData(form)
    
    try {
      const response = await fetch(form.action, {
        method: form.method,
        body: data
      })
      
      if (response.ok) {
        // Clear saved data
        localStorage.removeItem(`form_${formId}`)
        this.formData.delete(formId)
      } else {
        throw new Error('Form submission failed')
      }
    } catch (error) {
      // Queue for background sync
      await syncQueue.addRequest({
        url: form.action,
        method: form.method,
        body: Object.fromEntries(data),
        metadata: { formId, type: 'form' }
      })
      
      // Register sync
      const registration = await navigator.serviceWorker.ready
      await registration.sync.register('form-sync')
      
      // Notify user
      this.showOfflineNotification()
    }
  }
  
  private showOfflineNotification() {
    // Show a toast or notification
    const toast = document.createElement('div')
    toast.className = 'sync-toast'
    toast.textContent = 'Your data will be saved when you\'re back online'
    document.body.appendChild(toast)
    
    setTimeout(() => toast.remove(), 5000)
  }
}

export const formSync = new FormSync()
```

## Sync Status UI

```typescript
// components/sync-status.tsx
import { useState, useEffect } from 'react'

export function SyncStatus() {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle')
  const [pendingCount, setPendingCount] = useState(0)
  
  useEffect(() => {
    checkSyncStatus()
    
    // Listen for sync events
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'sync-status') {
        setSyncStatus(event.data.status)
        setPendingCount(event.data.pending || 0)
      }
    })
    
    // Check periodically
    const interval = setInterval(checkSyncStatus, 30000)
    return () => clearInterval(interval)
  }, [])
  
  async function checkSyncStatus() {
    const queue = await syncQueue.getAllPending()
    setPendingCount(queue.length)
  }
  
  async function triggerSync() {
    setSyncStatus('syncing')
    const registration = await navigator.serviceWorker.ready
    await registration.sync.register('data-sync')
  }
  
  if (pendingCount === 0) return null
  
  return (
    <div className="sync-status">
      <span>{pendingCount} items pending sync</span>
      {syncStatus === 'syncing' ? (
        <span>Syncing...</span>
      ) : (
        <button onClick={triggerSync}>Sync Now</button>
      )}
    </div>
  )
}
```
