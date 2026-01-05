/**
 * WhatsApp Message Sending Functions
 */

import { getRawClient, isReady } from './client';

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

/**
 * Format phone number to WhatsApp format
 * Removes spaces, dashes, and ensures country code
 * @param phoneNumber - Phone number in any format
 * @returns Formatted number for WhatsApp (e.g., "919876543210@c.us")
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

  // WhatsApp chat ID format
  return `${cleaned}@c.us`;
}

/**
 * Send a text message to a phone number
 * @param phoneNumber - Recipient phone number
 * @param message - Message text to send
 */
export async function sendTextMessage(
  phoneNumber: string,
  message: string
): Promise<SendMessageResult> {
  try {
    if (!isReady()) {
      return {
        success: false,
        error: 'WhatsApp not connected. Please scan QR code first.'
      };
    }

    const client = getRawClient();
    if (!client) {
      return {
        success: false,
        error: 'WhatsApp client not available'
      };
    }

    const chatId = formatPhoneNumber(phoneNumber);

    // Check if number is registered on WhatsApp
    const isRegistered = await client.isRegisteredUser(chatId);
    if (!isRegistered) {
      return {
        success: false,
        error: `${phoneNumber} is not registered on WhatsApp`
      };
    }

    // Send the message
    const sentMessage = await client.sendMessage(chatId, message);

    return {
      success: true,
      messageId: sentMessage.id._serialized
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[WhatsApp] Send error to ${phoneNumber}:`, errorMsg);
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Send bulk messages to multiple recipients
 * Adds delay between messages to avoid rate limiting
 * @param recipients - Array of { phoneNumber, message }
 * @param delayMs - Delay between messages (default 1000ms)
 */
export async function sendBulkMessages(
  recipients: Array<{ phoneNumber: string; message: string }>,
  delayMs: number = 1000
): Promise<BulkSendResult> {
  const results: BulkSendResult['results'] = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const result = await sendTextMessage(recipient.phoneNumber, recipient.message);

    results.push({
      phoneNumber: recipient.phoneNumber,
      ...result
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    // Add delay between messages to avoid rate limiting
    if (recipients.indexOf(recipient) < recipients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return {
    total: recipients.length,
    sent,
    failed,
    results
  };
}

/**
 * Send message to a group
 * @param groupId - WhatsApp group ID
 * @param message - Message text
 */
export async function sendGroupMessage(
  groupId: string,
  message: string
): Promise<SendMessageResult> {
  try {
    if (!isReady()) {
      return {
        success: false,
        error: 'WhatsApp not connected. Please scan QR code first.'
      };
    }

    const client = getRawClient();
    if (!client) {
      return {
        success: false,
        error: 'WhatsApp client not available'
      };
    }

    // Group IDs end with @g.us
    const chatId = groupId.endsWith('@g.us') ? groupId : `${groupId}@g.us`;

    const sentMessage = await client.sendMessage(chatId, message);

    return {
      success: true,
      messageId: sentMessage.id._serialized
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Get all chats (for group selection)
 */
export async function getAllChats(): Promise<Array<{
  id: string;
  name: string;
  isGroup: boolean;
}>> {
  try {
    if (!isReady()) {
      return [];
    }

    const client = getRawClient();
    if (!client) {
      return [];
    }

    const chats = await client.getChats();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return chats.map((chat: any) => ({
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup
    }));
  } catch (error) {
    console.error('[WhatsApp] Get chats error:', error);
    return [];
  }
}
