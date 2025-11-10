# Supabase Offline Patterns

## Offline-First Database Sync

### Local Storage Strategy

```typescript
// lib/supabase-offline.ts
import { createClient } from '@supabase/supabase-js'

class SupabaseOfflineClient {
  private supabase: any
  private syncQueue: Map<string, any[]> = new Map()
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    this.initializeOfflineSupport()
  }
  
  private initializeOfflineSupport() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.syncWithServer())
    window.addEventListener('offline', () => console.log('App is offline'))
    
    // Check connection periodically
    setInterval(() => this.checkConnection(), 30000)
  }
  
  async query(table: string, query: any) {
    try {
      // Try online first
      const { data, error } = await this.supabase
        .from(table)
        .select(query)
      
      if (!error) {
        // Cache successful response
        this.cacheData(table, data)
        return { data, error: null }
      }
      throw error
    } catch (error) {
      // Fallback to cached data
      const cachedData = this.getCachedData(table)
      return { data: cachedData, error, offline: true }
    }
  }
  
  async mutation(table: string, operation: 'insert' | 'update' | 'delete', data: any) {
    const mutation = {
      id: crypto.randomUUID(),
      table,
      operation,
      data,
      timestamp: Date.now()
    }
    
    if (navigator.onLine) {
      try {
        const result = await this.executeMutation(mutation)
        return result
      } catch (error) {
        // Queue for later
        this.queueMutation(mutation)
        return { error, queued: true }
      }
    } else {
      // Offline - queue mutation
      this.queueMutation(mutation)
      
      // Optimistic update
      this.updateLocalCache(mutation)
      
      return { queued: true, optimistic: true }
    }
  }
  
  private queueMutation(mutation: any) {
    const queue = this.syncQueue.get(mutation.table) || []
    queue.push(mutation)
    this.syncQueue.set(mutation.table, queue)
    
    // Persist to IndexedDB
    this.persistQueue()
  }
  
  private async syncWithServer() {
    console.log('Syncing with server...')
    
    for (const [table, mutations] of this.syncQueue.entries()) {
      for (const mutation of mutations) {
        try {
          await this.executeMutation(mutation)
          // Remove from queue after successful sync
          this.removeMutationFromQueue(table, mutation.id)
        } catch (error) {
          console.error('Sync failed for mutation:', mutation, error)
        }
      }
    }
  }
  
  private async executeMutation(mutation: any) {
    const { table, operation, data } = mutation
    
    switch (operation) {
      case 'insert':
        return await this.supabase.from(table).insert(data)
      case 'update':
        return await this.supabase.from(table).update(data).eq('id', data.id)
      case 'delete':
        return await this.supabase.from(table).delete().eq('id', data.id)
    }
  }
  
  private cacheData(table: string, data: any) {
    localStorage.setItem(`supabase_cache_${table}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
  }
  
  private getCachedData(table: string) {
    const cached = localStorage.getItem(`supabase_cache_${table}`)
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      // Check if cache is still fresh (5 minutes)
      if (Date.now() - timestamp < 300000) {
        return data
      }
    }
    return null
  }
  
  private updateLocalCache(mutation: any) {
    const { table, operation, data } = mutation
    const cached = this.getCachedData(table) || []
    
    switch (operation) {
      case 'insert':
        cached.push(data)
        break
      case 'update':
        const index = cached.findIndex((item: any) => item.id === data.id)
        if (index !== -1) cached[index] = { ...cached[index], ...data }
        break
      case 'delete':
        const deleteIndex = cached.findIndex((item: any) => item.id === data.id)
        if (deleteIndex !== -1) cached.splice(deleteIndex, 1)
        break
    }
    
    this.cacheData(table, cached)
  }
  
  private async persistQueue() {
    // Use IndexedDB for persistent storage
    const db = await this.openIndexedDB()
    const tx = db.transaction('syncQueue', 'readwrite')
    const store = tx.objectStore('syncQueue')
    
    for (const [table, mutations] of this.syncQueue.entries()) {
      await store.put({ table, mutations })
    }
  }
  
  private async openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SupabaseOffline', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'table' })
        }
      }
    })
  }
  
  private removeMutationFromQueue(table: string, mutationId: string) {
    const queue = this.syncQueue.get(table) || []
    const filtered = queue.filter(m => m.id !== mutationId)
    
    if (filtered.length > 0) {
      this.syncQueue.set(table, filtered)
    } else {
      this.syncQueue.delete(table)
    }
    
    this.persistQueue()
  }
  
  private async checkConnection() {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/health`, {
        method: 'HEAD',
        mode: 'no-cors'
      })
      
      if (navigator.onLine) {
        this.syncWithServer()
      }
    } catch (error) {
      console.log('Connection check failed')
    }
  }
}

export const offlineClient = new SupabaseOfflineClient()
```

## Realtime Subscriptions with Offline Support

```typescript
// hooks/useRealtimeOffline.ts
import { useEffect, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function useRealtimeOffline(
  table: string,
  filter?: any
) {
  const [data, setData] = useState<any[]>([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  
  useEffect(() => {
    // Handle online/offline
    const handleOnline = () => {
      setIsOnline(true)
      subscribeToRealtime()
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Initial subscription
    if (isOnline) {
      subscribeToRealtime()
    } else {
      loadFromCache()
    }
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [table, filter])
  
  const subscribeToRealtime = () => {
    const newChannel = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filter
        },
        (payload) => {
          handleRealtimeUpdate(payload)
        }
      )
      .subscribe()
    
    setChannel(newChannel)
    loadInitialData()
  }
  
  const handleRealtimeUpdate = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload
    
    setData(current => {
      let updated = [...current]
      
      switch (eventType) {
        case 'INSERT':
          updated.push(newRecord)
          break
        case 'UPDATE':
          const index = updated.findIndex(item => item.id === newRecord.id)
          if (index !== -1) {
            updated[index] = newRecord
          }
          break
        case 'DELETE':
          updated = updated.filter(item => item.id !== oldRecord.id)
          break
      }
      
      // Cache the updated data
      cacheData(updated)
      return updated
    })
  }
  
  const loadInitialData = async () => {
    const { data: initialData, error } = await supabase
      .from(table)
      .select('*')
    
    if (!error && initialData) {
      setData(initialData)
      cacheData(initialData)
    }
  }
  
  const loadFromCache = () => {
    const cached = localStorage.getItem(`realtime_${table}`)
    if (cached) {
      setData(JSON.parse(cached))
    }
  }
  
  const cacheData = (data: any[]) => {
    localStorage.setItem(`realtime_${table}`, JSON.stringify(data))
  }
  
  return {
    data,
    isOnline,
    isSubscribed: !!channel
  }
}
```

## Conflict Resolution Strategies

### Last-Write-Wins with Timestamps

```typescript
interface ConflictResolution {
  strategy: 'last-write-wins' | 'merge' | 'manual'
  resolveConflict: (local: any, remote: any) => any
}

const lastWriteWins: ConflictResolution = {
  strategy: 'last-write-wins',
  resolveConflict: (local, remote) => {
    return local.updated_at > remote.updated_at ? local : remote
  }
}
```

### Three-Way Merge

```typescript
const threeWayMerge: ConflictResolution = {
  strategy: 'merge',
  resolveConflict: (local, remote, base) => {
    const merged = { ...base }
    
    // Apply changes from both local and remote
    for (const key in local) {
      if (local[key] !== base[key] && remote[key] === base[key]) {
        // Local change, no remote change
        merged[key] = local[key]
      } else if (remote[key] !== base[key] && local[key] === base[key]) {
        // Remote change, no local change
        merged[key] = remote[key]
      } else if (local[key] !== base[key] && remote[key] !== base[key]) {
        // Both changed - need resolution
        if (typeof local[key] === 'object' && typeof remote[key] === 'object') {
          // Recursive merge for objects
          merged[key] = threeWayMerge.resolveConflict(local[key], remote[key], base[key])
        } else {
          // Use last-write-wins for primitives
          merged[key] = local.updated_at > remote.updated_at ? local[key] : remote[key]
        }
      }
    }
    
    return merged
  }
}
```

## Storage Optimization

### Compression for Cached Data

```typescript
import pako from 'pako'

function compressData(data: any): string {
  const json = JSON.stringify(data)
  const compressed = pako.deflate(json)
  return btoa(String.fromCharCode.apply(null, compressed))
}

function decompressData(compressed: string): any {
  const binary = atob(compressed)
  const bytes = new Uint8Array(binary.length)
  
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  
  const decompressed = pako.inflate(bytes, { to: 'string' })
  return JSON.parse(decompressed)
}

// Usage
const largeDataset = await supabase.from('large_table').select('*')
const compressed = compressData(largeDataset)
localStorage.setItem('compressed_data', compressed)

// Later
const stored = localStorage.getItem('compressed_data')
const original = decompressData(stored)
```

## Authentication Offline Support

```typescript
class OfflineAuth {
  private tokenCache: string | null = null
  
  async getSession() {
    // Try to get session from Supabase
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        this.cacheSession(session)
        return session
      }
    } catch (error) {
      // Offline - use cached session
      return this.getCachedSession()
    }
  }
  
  private cacheSession(session: any) {
    // Encrypt sensitive data before storing
    const encrypted = this.encrypt(JSON.stringify(session))
    localStorage.setItem('supabase_session', encrypted)
  }
  
  private getCachedSession() {
    const encrypted = localStorage.getItem('supabase_session')
    if (!encrypted) return null
    
    try {
      const decrypted = this.decrypt(encrypted)
      const session = JSON.parse(decrypted)
      
      // Check if session is expired
      if (new Date(session.expires_at) < new Date()) {
        localStorage.removeItem('supabase_session')
        return null
      }
      
      return session
    } catch (error) {
      return null
    }
  }
  
  private encrypt(data: string): string {
    // Implement encryption (use Web Crypto API)
    return btoa(data) // Simple base64 for example
  }
  
  private decrypt(data: string): string {
    // Implement decryption
    return atob(data) // Simple base64 for example
  }
}
```
