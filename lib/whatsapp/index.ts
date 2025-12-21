/**
 * WhatsApp Integration for Yi Connect
 *
 * Usage:
 * 1. Initialize: await initializeWhatsApp()
 * 2. Check status: getConnectionStatus()
 * 3. Scan QR if needed (qrCode in status)
 * 4. Send messages: await sendTextMessage(phone, message)
 */

// Client management
export {
  getWhatsAppClient,
  initializeWhatsApp,
  disconnectWhatsApp,
  getConnectionStatus,
  subscribeToStatus,
  isReady,
  getRawClient
} from './client';

// Message sending
export {
  sendTextMessage,
  sendBulkMessages,
  sendGroupMessage,
  getAllChats,
  formatPhoneNumber,
  type SendMessageResult,
  type BulkSendResult
} from './send-message';

// Message templates
export {
  formatEventCreated,
  formatRsvpConfirmation,
  formatEventReminder3Days,
  formatEventReminder1Day,
  formatEventReminderToday,
  formatEventCancellation,
  formatEventUpdate,
  formatPostEventThankYou,
  formatVolunteerAssignment,
  formatAnnouncement,
  type EventDetails,
  type MemberDetails
} from './format-message';
