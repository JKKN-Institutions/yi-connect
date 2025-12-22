/**
 * Send Route - Send single WhatsApp message
 */

import { Router, Request, Response } from 'express';
import { sendMessage, sendGroupMessage, isReady } from '../whatsapp';

const router = Router();

interface SendMessageBody {
  phone?: string;
  phoneNumber?: string;
  groupId?: string;
  message: string;
}

/**
 * POST /send
 * Send a message to a phone number or group
 */
router.post('/', async (req: Request<object, object, SendMessageBody>, res: Response) => {
  try {
    const { phone, phoneNumber, groupId, message } = req.body;
    const recipient = phone || phoneNumber;

    // Validate request
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    if (!recipient && !groupId) {
      return res.status(400).json({
        success: false,
        error: 'Either phone/phoneNumber or groupId is required'
      });
    }

    // Check if connected
    if (!isReady()) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp not connected. Please connect first.'
      });
    }

    // Send to group or individual
    let result;
    if (groupId) {
      console.log(`[Send] Sending to group: ${groupId}`);
      result = await sendGroupMessage(groupId, message);
    } else {
      console.log(`[Send] Sending to: ${recipient}`);
      result = await sendMessage(recipient!, message);
    }

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Send] Error:', errorMsg);
    res.status(500).json({
      success: false,
      error: errorMsg
    });
  }
});

export { router as sendRouter };
