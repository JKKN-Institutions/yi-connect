import { Router } from 'express';
import { disconnect, getState } from '../whatsapp';

export const disconnectRoute = Router();

disconnectRoute.post('/', async (req, res) => {
  try {
    if (getState() === 'disconnected') {
      return res.json({
        success: true,
        message: 'Already disconnected'
      });
    }

    await disconnect();

    res.json({
      success: true,
      message: 'Disconnected successfully'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});
