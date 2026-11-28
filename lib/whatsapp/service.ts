import 'server-only';

/**
 * WhatsApp service core — UNGUARDED.
 *
 * Plain server module (NOT "use server"), so nothing here is callable from a
 * browser. It picks the backend (Railway service in production, local
 * whatsapp-web.js client in development) and performs the operation.
 *
 * It does NO authorization. Callers must check access first:
 * - app/actions/whatsapp.ts and app/api/whatsapp/** check getWhatsAppAccess()
 *   (lib/whatsapp/access.ts) before calling in here.
 * - Server code on its own auth system (e.g. the YiFi dossier delivery, gated
 *   by the YiFi admin 'dossiers' permission) may call in here directly.
 *
 * IMPORTANT: local client imports are DYNAMIC to avoid loading whatsapp-web.js
 * at module load time (fails on Vercel serverless).
 */

import {
  isServiceConfigured,
  connectWhatsAppAPI,
  disconnectWhatsAppAPI,
  getWhatsAppStatusAPI,
  sendMessageAPI,
  sendBulkMessagesAPI,
  sendGroupMessageAPI
} from '@/lib/whatsapp/api-client';

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BulkSendResult {
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    phoneNumber: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

export interface WhatsAppStatusResult {
  status: string;
  qrCode: string | null;
  error: string | null;
  isReady: boolean;
}

// Dynamic import helper for local client (only loads when needed in dev)
async function getLocalClient() {
  const {
    initializeWhatsApp,
    disconnectWhatsApp,
    getConnectionStatus,
    sendTextMessage,
    sendBulkMessages,
    sendGroupMessage
  } = await import('@/lib/whatsapp');

  return {
    initializeWhatsApp,
    disconnectWhatsApp,
    getConnectionStatus,
    sendTextMessage,
    sendBulkMessages,
    sendGroupMessage
  };
}

/**
 * Check if we're running on Vercel (serverless environment)
 * Uses multiple detection methods for reliability
 */
function isServerless(): boolean {
  // Check Vercel environment variables
  if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) {
    return true;
  }
  // Check AWS Lambda
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return true;
  }
  // If not explicitly in development and no local client configured, assume serverless
  if (process.env.NODE_ENV === 'production' && !isServiceConfigured()) {
    return true;
  }
  return false;
}

function shouldUseApiClient(): boolean {
  return isServiceConfigured();
}

// ============================================================
// Connection Management
// ============================================================

export async function connectWhatsAppCore(): Promise<{
  success: boolean;
  status: string;
  qrCode?: string | null;
  error?: string;
}> {
  try {
    if (shouldUseApiClient()) {
      const result = await connectWhatsAppAPI();
      return result;
    } else if (isServerless()) {
      // Serverless without Railway service configured
      return {
        success: false,
        status: 'not_configured',
        error: 'WhatsApp service not configured. Please set up the Railway WhatsApp service.'
      };
    } else {
      const { initializeWhatsApp } = await getLocalClient();
      const result = await initializeWhatsApp();
      return result;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, status: 'disconnected', error: errorMsg };
  }
}

export async function disconnectWhatsAppCore(): Promise<{ success: boolean }> {
  try {
    if (shouldUseApiClient()) {
      await disconnectWhatsAppAPI();
    } else if (isServerless()) {
      // Nothing to disconnect on serverless without service
      return { success: true };
    } else {
      const { disconnectWhatsApp } = await getLocalClient();
      await disconnectWhatsApp();
    }
    return { success: true };
  } catch (error) {
    console.error('[WhatsApp Action] Disconnect error:', error);
    return { success: false };
  }
}

export async function getWhatsAppStatusCore(): Promise<WhatsAppStatusResult> {
  if (shouldUseApiClient()) {
    // The Railway service is an EXTERNAL dependency and answers 404 once it is
    // torn down. An unhandled throw here is not a broken page, it is a broken
    // DEPLOY: this status is read by a prerendered page, so a dead third-party
    // service silently blocked every production build for 18 hours (18-19 Aug
    // 2026). Degrade to the same 'not configured' shape this function already
    // returns when no service is configured at all.
    try {
      return await getWhatsAppStatusAPI();
    } catch (err) {
      return {
        status: 'not_configured',
        qrCode: null,
        error: `WhatsApp service unreachable: ${
          err instanceof Error ? err.message : String(err)
        }`,
        isReady: false,
      };
    }
  } else if (isServerless()) {
    // Serverless without Railway service - return helpful error
    return {
      status: 'not_configured',
      qrCode: null,
      error: 'WhatsApp service not configured. Please set up the Railway WhatsApp service.',
      isReady: false
    };
  }
  const { getConnectionStatus } = await getLocalClient();
  return getConnectionStatus();
}

// ============================================================
// Message Sending
// ============================================================

export async function sendWhatsAppMessageCore(
  phoneNumber: string,
  message: string
): Promise<SendMessageResult> {
  if (shouldUseApiClient()) {
    return sendMessageAPI(phoneNumber, message);
  } else if (isServerless()) {
    return { success: false, error: 'WhatsApp service not configured' };
  }
  const { sendTextMessage } = await getLocalClient();
  return sendTextMessage(phoneNumber, message);
}

export async function sendBulkWhatsAppMessagesCore(
  recipients: Array<{ phoneNumber: string; message: string }>,
  delayMs: number = 1000
): Promise<BulkSendResult> {
  if (shouldUseApiClient()) {
    // Transform to API format (phone instead of phoneNumber)
    const apiRecipients = recipients.map(r => ({ phone: r.phoneNumber, message: r.message }));
    const result = await sendBulkMessagesAPI(apiRecipients, delayMs);
    // Transform back to app format (phoneNumber instead of phone)
    return {
      total: result.total,
      sent: result.sent,
      failed: result.failed,
      results: result.results.map(r => ({
        phoneNumber: r.phone,
        success: r.success,
        messageId: r.messageId,
        error: r.error
      }))
    };
  } else if (isServerless()) {
    return { total: recipients.length, sent: 0, failed: recipients.length, results: [] };
  }
  const { sendBulkMessages } = await getLocalClient();
  return sendBulkMessages(recipients, delayMs);
}

export async function sendWhatsAppGroupMessageCore(
  groupId: string,
  message: string
): Promise<SendMessageResult> {
  if (shouldUseApiClient()) {
    return sendGroupMessageAPI(groupId, message);
  } else if (isServerless()) {
    return { success: false, error: 'WhatsApp service not configured' };
  }
  const { sendGroupMessage } = await getLocalClient();
  return sendGroupMessage(groupId, message);
}
