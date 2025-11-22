/**
 * IndexedDB Offline Storage
 *
 * Provides offline data storage using IndexedDB with the idb library.
 * Handles caching, sync queue, and offline data management.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { OfflineAction, CachedData, SyncStatus } from '@/types/mobile'

// Database schema definition
interface YiConnectDB extends DBSchema {
  // Sync queue for offline actions
  syncQueue: {
    key: number
    value: OfflineAction
    indexes: {
      'by-status': string
      'by-timestamp': number
    }
  }

  // Cached data store
  cachedData: {
    key: string
    value: CachedData
    indexes: {
      'by-timestamp': number
      'by-expires': number
    }
  }

  // User profile cache
  userProfile: {
    key: string
    value: {
      id: string
      email: string
      fullName: string
      role: string
      chapterId: string
      avatarUrl?: string
      updatedAt: number
    }
  }

  // Cached events
  events: {
    key: string
    value: {
      id: string
      title: string
      description?: string
      startDate: string
      endDate: string
      venue?: string
      status: string
      category: string
      rsvpStatus?: string
      updatedAt: number
    }
    indexes: {
      'by-date': string
      'by-status': string
    }
  }

  // Cached notifications
  notifications: {
    key: string
    value: {
      id: string
      type: string
      title: string
      message: string
      read: boolean
      createdAt: number
      actionUrl?: string
    }
    indexes: {
      'by-read': number
      'by-created': number
    }
  }
}

const DB_NAME = 'yi-connect-offline'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<YiConnectDB>> | null = null

/**
 * Get or create the database connection
 */
export async function getDB(): Promise<IDBPDatabase<YiConnectDB>> {
  if (!dbPromise) {
    dbPromise = openDB<YiConnectDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Create sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', {
            keyPath: 'id',
            autoIncrement: true
          })
          syncStore.createIndex('by-status', 'status')
          syncStore.createIndex('by-timestamp', 'timestamp')
        }

        // Create cached data store
        if (!db.objectStoreNames.contains('cachedData')) {
          const cacheStore = db.createObjectStore('cachedData', {
            keyPath: 'key'
          })
          cacheStore.createIndex('by-timestamp', 'timestamp')
          cacheStore.createIndex('by-expires', 'expiresAt')
        }

        // Create user profile store
        if (!db.objectStoreNames.contains('userProfile')) {
          db.createObjectStore('userProfile', { keyPath: 'id' })
        }

        // Create events store
        if (!db.objectStoreNames.contains('events')) {
          const eventsStore = db.createObjectStore('events', { keyPath: 'id' })
          eventsStore.createIndex('by-date', 'startDate')
          eventsStore.createIndex('by-status', 'status')
        }

        // Create notifications store
        if (!db.objectStoreNames.contains('notifications')) {
          const notifStore = db.createObjectStore('notifications', {
            keyPath: 'id'
          })
          notifStore.createIndex('by-read', 'read')
          notifStore.createIndex('by-created', 'createdAt')
        }
      }
    })
  }

  return dbPromise
}

// ============================================================================
// Sync Queue Operations
// ============================================================================

/**
 * Add an action to the sync queue
 */
export async function addToSyncQueue(action: Omit<OfflineAction, 'id'>): Promise<number> {
  const db = await getDB()
  const id = await db.add('syncQueue', action as OfflineAction)
  return id
}

/**
 * Get all pending actions from the sync queue
 */
export async function getPendingActions(): Promise<OfflineAction[]> {
  const db = await getDB()
  return db.getAllFromIndex('syncQueue', 'by-status', 'pending')
}

/**
 * Update an action's status
 */
export async function updateActionStatus(
  id: number,
  status: OfflineAction['status'],
  error?: string
): Promise<void> {
  const db = await getDB()
  const action = await db.get('syncQueue', id)
  if (action) {
    action.status = status
    if (error) {
      action.error = error
      action.retryCount = (action.retryCount || 0) + 1
    }
    await db.put('syncQueue', action)
  }
}

/**
 * Remove an action from the queue
 */
export async function removeFromQueue(id: number): Promise<void> {
  const db = await getDB()
  await db.delete('syncQueue', id)
}

/**
 * Get sync status summary
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const db = await getDB()
  const pending = await db.getAllFromIndex('syncQueue', 'by-status', 'pending')
  const failed = await db.getAllFromIndex('syncQueue', 'by-status', 'failed')

  return {
    lastSyncTime: null, // Would be stored separately
    isSyncing: false,
    pendingCount: pending.length,
    failedCount: failed.length
  }
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Store data in cache
 */
export async function cacheData<T>(
  key: string,
  data: T,
  ttlSeconds: number = 3600
): Promise<void> {
  const db = await getDB()
  const now = Date.now()
  await db.put('cachedData', {
    key,
    data,
    timestamp: now,
    expiresAt: now + ttlSeconds * 1000,
    version: 1
  })
}

/**
 * Get data from cache
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  const db = await getDB()
  const cached = await db.get('cachedData', key)

  if (!cached) return null

  // Check if expired
  if (cached.expiresAt < Date.now()) {
    await db.delete('cachedData', key)
    return null
  }

  return cached.data as T
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  const db = await getDB()
  const now = Date.now()
  const tx = db.transaction('cachedData', 'readwrite')
  const index = tx.store.index('by-expires')

  let deleted = 0
  let cursor = await index.openCursor(IDBKeyRange.upperBound(now))

  while (cursor) {
    await cursor.delete()
    deleted++
    cursor = await cursor.continue()
  }

  return deleted
}

// ============================================================================
// User Profile Operations
// ============================================================================

/**
 * Cache user profile
 */
export async function cacheUserProfile(profile: {
  id: string
  email: string
  fullName: string
  role: string
  chapterId: string
  avatarUrl?: string
}): Promise<void> {
  const db = await getDB()
  await db.put('userProfile', {
    ...profile,
    updatedAt: Date.now()
  })
}

/**
 * Get cached user profile
 */
export async function getCachedUserProfile(): Promise<{
  id: string
  email: string
  fullName: string
  role: string
  chapterId: string
  avatarUrl?: string
} | null> {
  const db = await getDB()
  const profiles = await db.getAll('userProfile')
  return profiles[0] || null
}

// ============================================================================
// Events Cache Operations
// ============================================================================

/**
 * Cache events
 */
export async function cacheEvents(events: Array<{
  id: string
  title: string
  description?: string
  startDate: string
  endDate: string
  venue?: string
  status: string
  category: string
  rsvpStatus?: string
}>): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('events', 'readwrite')

  for (const event of events) {
    await tx.store.put({
      ...event,
      updatedAt: Date.now()
    })
  }

  await tx.done
}

/**
 * Get cached events
 */
export async function getCachedEvents(): Promise<Array<{
  id: string
  title: string
  description?: string
  startDate: string
  endDate: string
  venue?: string
  status: string
  category: string
  rsvpStatus?: string
}>> {
  const db = await getDB()
  return db.getAllFromIndex('events', 'by-date')
}

// ============================================================================
// Notifications Cache Operations
// ============================================================================

/**
 * Cache notifications
 */
export async function cacheNotifications(notifications: Array<{
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: number
  actionUrl?: string
}>): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('notifications', 'readwrite')

  for (const notification of notifications) {
    await tx.store.put(notification)
  }

  await tx.done
}

/**
 * Get cached notifications
 */
export async function getCachedNotifications(): Promise<Array<{
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: number
  actionUrl?: string
}>> {
  const db = await getDB()
  return db.getAllFromIndex('notifications', 'by-created')
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(id: string): Promise<void> {
  const db = await getDB()
  const notification = await db.get('notifications', id)
  if (notification) {
    notification.read = true
    await db.put('notifications', notification)
  }
}

// ============================================================================
// Database Utilities
// ============================================================================

/**
 * Clear all offline data
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB()
  await Promise.all([
    db.clear('syncQueue'),
    db.clear('cachedData'),
    db.clear('userProfile'),
    db.clear('events'),
    db.clear('notifications')
  ])
}

/**
 * Get database storage estimate
 */
export async function getStorageEstimate(): Promise<{
  usage: number
  quota: number
  percent: number
} | null> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percent: estimate.quota
        ? Math.round(((estimate.usage || 0) / estimate.quota) * 100)
        : 0
    }
  }
  return null
}
