/**
 * WhatsApp API Client
 *
 * Calls the external Railway WhatsApp service for all WhatsApp operations.
 * Used in production (Vercel) instead of the local whatsapp-web.js client.
 */

// Types matching the local client
export type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'ready';

export interface StatusResponse {
  status: ConnectionStatus;
  qrCode: string | null;
  error: string | null;
  isReady: boolean;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BulkSendResult {
  success: boolean;
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    phoneNumber: string;
    success: boolean;
    error?: string;
  }>;
}

// Service configuration
const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL;
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;

/**
 * Check if the WhatsApp service is configured
 */
export function isServiceConfigured(): boolean {
  return !!(WHATSAPP_SERVICE_URL && WHATSAPP_API_KEY);
}

/**
 * Get headers for API requests
 */
function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': WHATSAPP_API_KEY || ''
  };
}

/**
 * Make a request to the WhatsApp service
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!WHATSAPP_SERVICE_URL) {
    throw new Error('WHATSAPP_SERVICE_URL not configured');
  }

  if (!WHATSAPP_API_KEY) {
    throw new Error('WHATSAPP_API_KEY not configured');
  }

  const url = `${WHATSAPP_SERVICE_URL}${endpoint}`;
  console.log(`[WhatsApp API] ${options.method || 'GET'} ${endpoint}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
        ...options.headers
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[WhatsApp API] Error:`, data);
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data as T;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('WhatsApp service unreachable. Is it running?');
    }
    throw error;
  }
}

/**
 * Initialize/connect WhatsApp
 */
export async function connectWhatsAppAPI(): Promise<{
  success: boolean;
  status: ConnectionStatus;
  qrCode?: string | null;
  error?: string;
}> {
  return apiRequest('/connect', {
    method: 'POST'
  });
}

/**
 * Get WhatsApp connection status
 */
export async function getWhatsAppStatusAPI(): Promise<StatusResponse> {
  return apiRequest('/status');
}

/**
 * Disconnect WhatsApp
 */
export async function disconnectWhatsAppAPI(): Promise<{ success: boolean }> {
  return apiRequest('/disconnect', {
    method: 'POST'
  });
}

/**
 * Send a single message
 */
export async function sendMessageAPI(
  phoneNumber: string,
  message: string
): Promise<SendMessageResult> {
  return apiRequest('/send', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, message })
  });
}

/**
 * Send a group message
 */
export async function sendGroupMessageAPI(
  groupId: string,
  message: string
): Promise<SendMessageResult> {
  return apiRequest('/send', {
    method: 'POST',
    body: JSON.stringify({ groupId, message })
  });
}

/**
 * Send bulk messages
 */
export async function sendBulkMessagesAPI(
  recipients: Array<{ phoneNumber: string; message: string }>,
  delayMs: number = 1500
): Promise<BulkSendResult> {
  return apiRequest('/send-bulk', {
    method: 'POST',
    body: JSON.stringify({ recipients, delayMs })
  });
}

/**
 * Check service health
 */
export async function checkHealthAPI(): Promise<{ status: string; timestamp: string }> {
  if (!WHATSAPP_SERVICE_URL) {
    return { status: 'not_configured', timestamp: new Date().toISOString() };
  }

  try {
    const response = await fetch(`${WHATSAPP_SERVICE_URL}/health`);
    return await response.json();
  } catch {
    return { status: 'unreachable', timestamp: new Date().toISOString() };
  }
}
