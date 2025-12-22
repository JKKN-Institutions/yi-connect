/**
 * Status Route - Get WhatsApp connection status
 */

import { Router, Request, Response } from 'express';
import { getStatus } from '../whatsapp';

const router = Router();

/**
 * GET /status
 * Get current WhatsApp connection status
 */
router.get('/', (_req: Request, res: Response) => {
  const status = getStatus();
  res.json(status);
});

export { router as statusRouter };
