/**
 * WhatsApp Client Singleton
 *
 * Manages the WhatsApp Web connection using whatsapp-web.js.
 * Persists session in /app/.wwebjs_auth for Railway volume.
 */

// Use require to avoid ESM issues with whatsapp-web.js
/* eslint-disable @typescript-eslint/no-require-imports */
const WhatsApp = require('whatsapp-web.js');
const { Client, LocalAuth } = WhatsApp;

import * as QRCode from 'qrcode';
import path from 'path';

// Connection status type
export type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'ready';

// Singleton state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;
let qrCodeDataUrl: string | null = null;
let connectionStatus: ConnectionStatus = 'disconnected';
let lastError: string | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Get current connection status
 */
export function getStatus(): {
  status: ConnectionStatus;
  qrCode: string | null;
  error: string | null;
  isReady: boolean;
} {
  return {
    status: connectionStatus,
    qrCode: qrCodeDataUrl,
    error: lastError,
    isReady: connectionStatus === 'ready' && client !== null
  };
}

/**
 * Get the raw client for sending messages
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getClient(): any {
  return client;
}

/**
 * Check if client is ready
 */
export function isReady(): boolean {
  return connectionStatus === 'ready' && client !== null;
}

/**
 * Initialize and connect the WhatsApp client
 * Returns QR code data URL if needed, null if already authenticated
 */
export async function initializeClient(): Promise<{
  success: boolean;
  status: ConnectionStatus;
  qrCode: string | null;
  error?: string;
}> {
  console.log('[WhatsApp] initializeClient called, current status:', connectionStatus);

  // If already ready, return immediately
  if (connectionStatus === 'ready' && client) {
    return { success: true, status: 'ready', qrCode: null };
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    console.log('[WhatsApp] Initialization in progress, waiting...');
    await initializationPromise;
    return { success: true, status: connectionStatus, qrCode: qrCodeDataUrl };
  }

  // Start initialization
  initializationPromise = (async () => {
    try {
      connectionStatus = 'connecting';
      lastError = null;
      qrCodeDataUrl = null;

      // Create new client
      const authPath = process.env.NODE_ENV === 'production'
        ? '/app/.wwebjs_auth'
        : path.join(process.cwd(), '.wwebjs_auth');

      console.log('[WhatsApp] Auth path:', authPath);

      client = new Client({
        authStrategy: new LocalAuth({
          dataPath: authPath,
          clientId: 'yi-connect'
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ],
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
        }
      });

      // Set up event handlers
      setupEventHandlers();

      // Initialize client
      console.log('[WhatsApp] Starting initialization...');
      await client.initialize();
      console.log('[WhatsApp] Initialization complete');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[WhatsApp] Initialization error:', errorMsg);
      connectionStatus = 'disconnected';
      lastError = errorMsg;
      await cleanupClient();
    } finally {
      initializationPromise = null;
    }
  })();

  await initializationPromise;

  return {
    success: connectionStatus !== 'disconnected',
    status: connectionStatus,
    qrCode: qrCodeDataUrl,
    error: lastError || undefined
  };
}

/**
 * Set up WhatsApp client event handlers
 */
function setupEventHandlers() {
  if (!client) return;

  client.on('qr', async (qr: string) => {
    console.log('[WhatsApp] QR Code received');
    connectionStatus = 'qr_ready';

    try {
      qrCodeDataUrl = await QRCode.toDataURL(qr, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.error('[WhatsApp] QR generation error:', err);
      lastError = 'Failed to generate QR code';
    }
  });

  client.on('authenticated', () => {
    console.log('[WhatsApp] Authenticated');
    connectionStatus = 'authenticated';
    qrCodeDataUrl = null;
  });

  client.on('auth_failure', async (msg: string) => {
    console.error('[WhatsApp] Authentication failed:', msg);
    connectionStatus = 'disconnected';
    lastError = `Authentication failed: ${msg}`;
    await cleanupClient();
  });

  client.on('ready', () => {
    console.log('[WhatsApp] Client is ready!');
    connectionStatus = 'ready';
    lastError = null;
  });

  client.on('disconnected', async (reason: string) => {
    console.log('[WhatsApp] Disconnected:', reason);
    connectionStatus = 'disconnected';
    lastError = `Disconnected: ${reason}`;
    await cleanupClient();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client.on('message', (msg: any) => {
    // Log incoming messages (for debugging)
    console.log('[WhatsApp] Message received:', msg.from);
  });
}

/**
 * Cleanup the client
 */
async function cleanupClient(): Promise<void> {
  if (client) {
    try {
      console.log('[WhatsApp] Destroying client...');
      await client.destroy();
      console.log('[WhatsApp] Client destroyed');
    } catch (err) {
      console.error('[WhatsApp] Error destroying client:', err);
    }
    client = null;
  }
  qrCodeDataUrl = null;
}

/**
 * Disconnect the WhatsApp client
 */
export async function disconnect(): Promise<void> {
  await cleanupClient();
  connectionStatus = 'disconnected';
  lastError = null;
}

/**
 * Format phone number to WhatsApp format
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');

  // Handle Indian numbers
  if (cleaned.startsWith('0')) {
    // Remove leading 0 and add India country code
    cleaned = '91' + cleaned.substring(1);
  } else if (!cleaned.startsWith('91') && cleaned.length === 10) {
    // Assume Indian number if 10 digits
    cleaned = '91' + cleaned;
  }

  return `${cleaned}@c.us`;
}

/**
 * Send a message to a phone number
 */
export async function sendMessage(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isReady()) {
    return { success: false, error: 'WhatsApp not connected' };
  }

  try {
    const chatId = formatPhoneNumber(phoneNumber);

    // Check if number is registered
    const isRegistered = await client.isRegisteredUser(chatId);
    if (!isRegistered) {
      return { success: false, error: `${phoneNumber} is not registered on WhatsApp` };
    }

    // Send message
    const sentMessage = await client.sendMessage(chatId, message);
    console.log(`[WhatsApp] Message sent to ${phoneNumber}`);

    return { success: true, messageId: sentMessage.id._serialized };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[WhatsApp] Send error to ${phoneNumber}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send bulk messages with rate limiting
 */
export async function sendBulkMessages(
  recipients: Array<{ phoneNumber: string; message: string }>,
  delayMs: number = 1500
): Promise<{
  total: number;
  sent: number;
  failed: number;
  results: Array<{ phoneNumber: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ phoneNumber: string; success: boolean; error?: string }> = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i++) {
    const { phoneNumber, message } = recipients[i];
    const result = await sendMessage(phoneNumber, message);

    results.push({
      phoneNumber,
      success: result.success,
      error: result.error
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    // Add delay between messages (except for last one)
    if (i < recipients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return { total: recipients.length, sent, failed, results };
}

/**
 * Send message to a group
 */
export async function sendGroupMessage(
  groupId: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isReady()) {
    return { success: false, error: 'WhatsApp not connected' };
  }

  try {
    const chatId = groupId.endsWith('@g.us') ? groupId : `${groupId}@g.us`;
    const sentMessage = await client.sendMessage(chatId, message);
    console.log(`[WhatsApp] Group message sent to ${groupId}`);

    return { success: true, messageId: sentMessage.id._serialized };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[WhatsApp] Group send error:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}
