/**
 * WhatsApp Web Client - Singleton with Session Persistence
 * Uses whatsapp-web.js to connect to WhatsApp Web
 *
 * IMPORTANT: Run `npm install whatsapp-web.js` before using
 */

/* eslint-disable @typescript-eslint/no-require-imports */
// Use require() to avoid Turbopack bundling issues with whatsapp-web.js
// The package has native Puppeteer dependencies that don't work when bundled
const WhatsApp = require('whatsapp-web.js');
const { Client, LocalAuth } = WhatsApp;
type Message = typeof WhatsApp.Message;

import * as QRCode from 'qrcode';
import path from 'path';

// Singleton state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;
let qrCodeDataUrl: string | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'ready' = 'disconnected';
let lastError: string | null = null;

// Initialization lock to prevent concurrent requests
let initializationPromise: Promise<{ success: boolean; status: typeof connectionStatus; error?: string }> | null = null;

// Timeout for initialization (20 seconds)
const INIT_TIMEOUT_MS = 20000;

// Event listeners for external subscribers
type StatusListener = (status: typeof connectionStatus, qr?: string) => void;
const statusListeners: Set<StatusListener> = new Set();

/**
 * Get or create the WhatsApp client instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getWhatsAppClient(): any {
  if (!client) {
    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.join(process.cwd(), '.wwebjs_auth'),
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
        ]
      }
    });

    // Set up event handlers
    setupEventHandlers(client);
  }

  return client;
}

/**
 * Set up all WhatsApp client event handlers
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setupEventHandlers(whatsappClient: any) {
  whatsappClient.on('qr', async (qr: string) => {
    console.log('[WhatsApp] QR Code received');
    connectionStatus = 'qr_ready';

    try {
      // Generate QR code as data URL for display in UI
      qrCodeDataUrl = await QRCode.toDataURL(qr, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      notifyListeners('qr_ready', qrCodeDataUrl);
    } catch (err) {
      console.error('[WhatsApp] QR generation error:', err);
      lastError = 'Failed to generate QR code';
    }
  });

  whatsappClient.on('authenticated', () => {
    console.log('[WhatsApp] Authenticated');
    connectionStatus = 'authenticated';
    qrCodeDataUrl = null;
    notifyListeners('authenticated');
  });

  whatsappClient.on('auth_failure', async (msg: string) => {
    console.error('[WhatsApp] Authentication failed:', msg);
    connectionStatus = 'disconnected';
    lastError = `Authentication failed: ${msg}`;
    // Clean up the failed client
    await cleanupClient();
    notifyListeners('disconnected');
  });

  whatsappClient.on('ready', () => {
    console.log('[WhatsApp] Client is ready!');
    connectionStatus = 'ready';
    lastError = null;
    notifyListeners('ready');
  });

  whatsappClient.on('disconnected', async (reason: string) => {
    console.log('[WhatsApp] Disconnected:', reason);
    connectionStatus = 'disconnected';
    lastError = `Disconnected: ${reason}`;
    // Clean up the client
    await cleanupClient();
    notifyListeners('disconnected');
  });

  whatsappClient.on('message', (msg: Message) => {
    // Log incoming messages for debugging
    console.log('[WhatsApp] Message received:', msg.from, msg.body.substring(0, 50));
  });
}

/**
 * Notify all status listeners
 */
function notifyListeners(status: typeof connectionStatus, qr?: string) {
  statusListeners.forEach(listener => {
    try {
      listener(status, qr);
    } catch (err) {
      console.error('[WhatsApp] Listener error:', err);
    }
  });
}

/**
 * Cleanup function to destroy client and reset state
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
 * Initialize and connect the WhatsApp client
 */
export async function initializeWhatsApp(): Promise<{
  success: boolean;
  status: typeof connectionStatus;
  error?: string;
}> {
  console.log('[WhatsApp] initializeWhatsApp called, current status:', connectionStatus);

  // If already ready, return immediately
  if (connectionStatus === 'ready' && client) {
    console.log('[WhatsApp] Already ready, returning');
    return { success: true, status: 'ready' };
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    console.log('[WhatsApp] Initialization in progress, waiting...');
    return initializationPromise;
  }

  // Create a new initialization promise
  initializationPromise = (async () => {
    try {
      connectionStatus = 'connecting';
      lastError = null;
      console.log('[WhatsApp] Status set to connecting, getting client...');

      const whatsapp = getWhatsAppClient();
      console.log('[WhatsApp] Client obtained, calling initialize()...');

      const startTime = Date.now();

      // Race between initialization and timeout
      await Promise.race([
        whatsapp.initialize(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Initialization timed out after 20 seconds')), INIT_TIMEOUT_MS)
        )
      ]);

      console.log(`[WhatsApp] initialize() completed in ${Date.now() - startTime}ms`);

      return { success: true, status: connectionStatus };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[WhatsApp] Initialization error:', errorMsg);
      console.error('[WhatsApp] Full error:', error);

      // Clean up the failed client
      await cleanupClient();

      connectionStatus = 'disconnected';
      lastError = errorMsg;

      return { success: false, status: 'disconnected' as const, error: errorMsg };
    } finally {
      // Clear the lock
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Disconnect the WhatsApp client
 */
export async function disconnectWhatsApp(): Promise<void> {
  if (client) {
    try {
      await client.destroy();
    } catch (err) {
      console.error('[WhatsApp] Disconnect error:', err);
    }
    client = null;
  }
  connectionStatus = 'disconnected';
  qrCodeDataUrl = null;
  notifyListeners('disconnected');
}

/**
 * Get current connection status
 */
export function getConnectionStatus(): {
  status: typeof connectionStatus;
  qrCode: string | null;
  error: string | null;
  isReady: boolean;
} {
  // Must check both status AND client existence for true ready state
  const ready = connectionStatus === 'ready' && client !== null;
  return {
    status: ready ? connectionStatus : (client ? connectionStatus : 'disconnected'),
    qrCode: qrCodeDataUrl,
    error: lastError,
    isReady: ready
  };
}

/**
 * Subscribe to status changes
 */
export function subscribeToStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

/**
 * Check if client is ready to send messages
 */
export function isReady(): boolean {
  return connectionStatus === 'ready' && client !== null;
}

/**
 * Get the raw client for advanced operations
 * Only use if isReady() returns true
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRawClient(): any {
  return client;
}
