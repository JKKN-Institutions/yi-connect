/**
 * Offline Support Index
 *
 * Export all offline storage and sync utilities.
 */

export {
  getDB,
  addToSyncQueue,
  getPendingActions,
  updateActionStatus,
  removeFromQueue,
  getSyncStatus,
  cacheData,
  getCachedData,
  clearExpiredCache,
  cacheUserProfile,
  getCachedUserProfile,
  cacheEvents,
  getCachedEvents,
  cacheNotifications,
  getCachedNotifications,
  markNotificationRead,
  clearAllData,
  getStorageEstimate
} from './db'

export {
  onSyncStatusChange,
  syncPendingActions,
  queueOfflineAction,
  setupSyncListeners,
  registerBackgroundSync,
  getCurrentSyncStatus
} from './sync-service'
