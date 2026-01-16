import { Router } from 'express';
import { initializeClient, getState, getQRCode } from '../whatsapp';

export const connectRoute = Router();

connectRoute.post('/', async (req, res) => {
  try {
    const currentState = getState();

    if (currentState === 'ready') {
      return res.json({
        success: true,
        state: 'ready',
        message: 'Already connected'
      });
    }

    // Start initialization (non-blocking)
    initializeClient().catch(err => {
      console.error('[Connect] Init error:', err.message);
    });

    // Return current state
    res.json({
      success: true,
      state: getState(),
      message: 'Connection initiated. Poll /status for QR code.'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});
