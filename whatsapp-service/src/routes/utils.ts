/**
 * Utility Routes - Category 8 (2 endpoints)
 */

import { Router } from 'express';
import { sendTypingIndicator, isOnWhatsApp } from '../whatsapp';

export const utilsRoute = Router();

// POST /typing - Send typing indicator
utilsRoute.post('/typing', async (req, res) => {
  try {
    const { chat_jid, typing } = req.body;

    if (!chat_jid) {
      return res.status(400).json({
        success: false,
        error: 'chat_jid is required'
      });
    }

    await sendTypingIndicator(chat_jid, typing !== false);

    res.json({
      success: true,
      message: typing !== false ? 'Typing indicator shown' : 'Typing indicator cleared'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /check - Check if numbers are on WhatsApp
utilsRoute.post('/check', async (req, res) => {
  try {
    const { phone_numbers } = req.body;

    if (!phone_numbers || !Array.isArray(phone_numbers)) {
      return res.status(400).json({
        success: false,
        error: 'phone_numbers array is required'
      });
    }

    const results = await isOnWhatsApp(phone_numbers);

    const registered = results.filter(r => r.isRegistered).length;

    res.json({
      success: true,
      summary: {
        total: phone_numbers.length,
        registered,
        notRegistered: phone_numbers.length - registered
      },
      results
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});
