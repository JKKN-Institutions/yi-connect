/**
 * Disconnect Route - Disconnect WhatsApp client
 */

import { Router, Request, Response } from 'express';
import { disconnect, getStatus } from '../whatsapp';

const router = Router();

/**
 * POST /disconnect
 * Disconnect the WhatsApp client
 */
router.post('/', async (_req: Request, res: Response) => {
  try {
    console.log('[Disconnect] Received disconnect request');

    await disconnect();

    console.log('[Disconnect] Disconnected successfully');

    res.json({
      success: true,
      status: 'disconnected'
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Disconnect] Error:', errorMsg);
    res.status(500).json({
      success: false,
      error: errorMsg
    });
  }
});

/**
 * GET /disconnect
 * Get current status (for checking after disconnect)
 */
router.get('/', (_req: Request, res: Response) => {
  const status = getStatus();
  res.json(status);
});

export { router as disconnectRouter };
