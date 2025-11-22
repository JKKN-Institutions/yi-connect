/**
 * Mobile-specific Type Definitions
 *
 * Types for mobile PWA features including offline support,
 * push notifications, and mobile-specific UI components.
 */

// ============================================================================
// Offline Storage Types
// ============================================================================

export interface OfflineAction {
  id?: number
  type: 'rsvp' | 'checkin' | 'log_hours' | 'submit_feedback' | 'update_profile'
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers: Record<string, string>
  body?: string
  timestamp: number
  status: 'pending' | 'syncing' | 'failed' | 'completed'
  retryCount: number
  maxRetries: number
  error?: string
}

export interface CachedData<T = unknown> {
  key: string
  data: T
  timestamp: number
  expiresAt: number
  version: number
}

export interface SyncStatus {
  lastSyncTime: number | null
  isSyncing: boolean
  pendingCount: number
  failedCount: number
  error?: string
}

// ============================================================================
// Push Notification Types
// ============================================================================

export interface PushSubscriptionData {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  deviceInfo?: DeviceInfo
}

export interface DeviceInfo {
  userAgent: string
  platform: string
  language: string
  screenWidth: number
  screenHeight: number
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  url?: string
  requireInteraction?: boolean
  actions?: Array<{ action: string; title: string; icon?: string }>
  data?: Record<string, unknown>
}

export interface NotificationPreferences {
  eventsEnabled: boolean
  announcementsEnabled: boolean
  approvalsEnabled: boolean
  remindersEnabled: boolean
  quietHoursStart?: string // HH:mm format
  quietHoursEnd?: string // HH:mm format
}

export type NotificationCategory =
  | 'event_reminder'
  | 'event_update'
  | 'announcement'
  | 'approval_request'
  | 'award_nomination'
  | 'task_deadline'
  | 'general'

// ============================================================================
// Mobile Navigation Types
// ============================================================================

export interface BottomNavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  isActive?: boolean
}

export interface QuickAction {
  id: string
  name: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  href?: string
  onClick?: () => void
  variant?: 'default' | 'primary' | 'secondary' | 'destructive'
  requiresAuth?: boolean
  roles?: string[]
}

// ============================================================================
// Mobile Dashboard Types
// ============================================================================

export interface MobileDashboardStats {
  upcomingEvents: number
  engagementScore: number
  tasksDue: number
  unreadNotifications: number
  birthdaysThisWeek?: number
}

export interface QuickStat {
  id: string
  label: string
  value: string | number
  change?: number
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: string // Icon name as string (e.g., 'calendar', 'users', 'bell')
  href?: string
}

// ============================================================================
// QR Scanner Types
// ============================================================================

export interface QRScanResult {
  success: boolean
  data?: string
  error?: string
  format?: string
}

export interface CheckInData {
  eventId: string
  memberId?: string
  guestName?: string
  guestEmail?: string
  timestamp: number
  method: 'qr' | 'manual' | 'self'
  location?: {
    latitude: number
    longitude: number
    accuracy: number
  }
}

// ============================================================================
// Location Types
// ============================================================================

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export interface NearbyEvent {
  id: string
  title: string
  distance: number // in meters
  venue?: string
  startTime: string
}

// ============================================================================
// PWA Types
// ============================================================================

export interface InstallPromptState {
  isInstallable: boolean
  isInstalled: boolean
  isIOS: boolean
  isStandalone: boolean
  isDismissed: boolean
}

export interface ServiceWorkerState {
  isSupported: boolean
  isRegistered: boolean
  isUpdating: boolean
  hasUpdate: boolean
}

// ============================================================================
// Mobile Form Types
// ============================================================================

export interface MobileFormField {
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'time' | 'select' | 'textarea'
  placeholder?: string
  required?: boolean
  options?: { value: string; label: string }[]
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
}

// ============================================================================
// Haptic Feedback Types
// ============================================================================

export type HapticFeedbackType =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'selection'

// ============================================================================
// Share Types
// ============================================================================

export interface ShareData {
  title?: string
  text?: string
  url?: string
  files?: File[]
}

export interface ShareResult {
  success: boolean
  error?: string
  shared?: boolean
}
