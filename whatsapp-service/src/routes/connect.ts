/**
 * Connect Route - Initialize WhatsApp and get QR code
 */

import { Router, Request, Response } from 'express';
import { initializeClient, getStatus } from '../whatsapp';

const router = Router();

/**
 * POST /connect
 * Initialize WhatsApp client and return QR code if needed
 */
router.post('/', async (_req: Request, res: Response) => {
  try {
    console.log('[Connect] Received connect request');

    const result = await initializeClient();

    console.log('[Connect] Result:', result.status);

    res.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Connect] Error:', errorMsg);
    res.status(500).json({
      success: false,
      status: 'disconnected',
      error: errorMsg
    });
  }
});

/**
 * GET /connect
 * Get current connection status (alias for /status)
 */
router.get('/', (_req: Request, res: Response) => {
  const status = getStatus();
  res.json({
    success: status.isReady,
    ...status
  });
});

export { router as connectRouter };
