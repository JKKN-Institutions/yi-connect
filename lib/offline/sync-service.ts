/**
 * Background Sync Service
 *
 * Handles synchronization of offline actions when the app comes back online.
 * Uses exponential backoff for retries and conflict resolution.
 */

import {
  getDB,
  getPendingActions,
  updateActionStatus,
  removeFromQueue,
  getSyncStatus
} from './db'
import type { OfflineAction, SyncStatus } from '@/types/mobile'

// Sync configuration
const SYNC_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  batchSize: 5
}

// Sync state
let isSyncing = false
let syncListeners: Array<(status: SyncStatus) => void> = []

/**
 * Register a listener for sync status updates
 */
export function onSyncStatusChange(
  listener: (status: SyncStatus) => void
): () => void {
  syncListeners.push(listener)
  return () => {
    syncListeners = syncListeners.filter((l) => l !== listener)
  }
}

/**
 * Notify all listeners of sync status change
 */
async function notifyStatusChange(): Promise<void> {
  const status = await getSyncStatus()
  status.isSyncing = isSyncing
  syncListeners.forEach((listener) => listener(status))
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(retryCount: number): number {
  const delay = SYNC_CONFIG.baseDelay * Math.pow(2, retryCount)
  return Math.min(delay, SYNC_CONFIG.maxDelay)
}

/**
 * Process a single offline action
 */
async function processAction(action: OfflineAction): Promise<boolean> {
  try {
    const response = await fetch(action.url, {
      method: action.method,
      headers: {
        'Content-Type': 'application/json',
        ...action.headers
      },
      body: action.body
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return true
  } catch (error) {
    console.error('Action processing failed:', error)
    throw error
  }
}

/**
 * Sync all pending actions
 */
export async function syncPendingActions(): Promise<{
  synced: number
  failed: number
}> {
  if (isSyncing) {
    return { synced: 0, failed: 0 }
  }

  if (!navigator.onLine) {
    return { synced: 0, failed: 0 }
  }

  isSyncing = true
  await notifyStatusChange()

  let synced = 0
  let failed = 0

  try {
    const pendingActions = await getPendingActions()

    // Process in batches
    for (let i = 0; i < pendingActions.length; i += SYNC_CONFIG.batchSize) {
      const batch = pendingActions.slice(i, i + SYNC_CONFIG.batchSize)

      const results = await Promise.allSettled(
        batch.map(async (action) => {
          if (!action.id) return

          try {
            // Update status to syncing
            await updateActionStatus(action.id, 'syncing')

            // Process the action
            await processAction(action)

            // Remove from queue on success
            await removeFromQueue(action.id)
            synced++
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error'

            if (action.retryCount >= SYNC_CONFIG.maxRetries) {
              // Max retries reached, mark as failed
              await updateActionStatus(action.id, 'failed', errorMessage)
              failed++
            } else {
              // Reset to pending for retry
              await updateActionStatus(action.id, 'pending', errorMessage)

              // Schedule retry with backoff
              const delay = getBackoffDelay(action.retryCount)
              setTimeout(() => {
                syncPendingActions()
              }, delay)
            }
          }
        })
      )
    }
  } finally {
    isSyncing = false
    await notifyStatusChange()
  }

  return { synced, failed }
}

/**
 * Queue an action for offline sync
 */
export async function queueOfflineAction(
  type: OfflineAction['type'],
  url: string,
  method: OfflineAction['method'],
  body?: object,
  headers?: Record<string, string>
): Promise<number> {
  const db = await getDB()

  const action: Omit<OfflineAction, 'id'> = {
    type,
    url,
    method,
    headers: headers || {},
    body: body ? JSON.stringify(body) : undefined,
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0,
    maxRetries: SYNC_CONFIG.maxRetries
  }

  const id = await db.add('syncQueue', action as OfflineAction)

  // If online, try to sync immediately
  if (navigator.onLine) {
    syncPendingActions()
  }

  await notifyStatusChange()
  return id
}

/**
 * Setup online/offline listeners for automatic sync
 */
export function setupSyncListeners(): () => void {
  const handleOnline = () => {
    console.log('Back online, syncing pending actions...')
    syncPendingActions()
  }

  const handleOffline = () => {
    console.log('Went offline, actions will be queued')
    notifyStatusChange()
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Initial sync if online
  if (navigator.onLine) {
    syncPendingActions()
  }

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

/**
 * Register for background sync (if supported)
 */
export async function registerBackgroundSync(): Promise<boolean> {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready
      // @ts-ignore - sync API types
      await registration.sync.register('sync-offline-actions')
      return true
    } catch (error) {
      console.error('Background sync registration failed:', error)
      return false
    }
  }
  return false
}

/**
 * Get current sync status
 */
export async function getCurrentSyncStatus(): Promise<SyncStatus> {
  const status = await getSyncStatus()
  status.isSyncing = isSyncing
  return status
}
