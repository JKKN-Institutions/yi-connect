import { Router } from 'express';
import { getState, getQRCode, getClientInfo, getConnectionStatus } from '../whatsapp';

export const statusRoute = Router();

statusRoute.get('/', async (req, res) => {
  try {
    const status = await getConnectionStatus();

    res.json({
      success: true,
      state: status.state,
      isLoggedIn: status.isLoggedIn,
      qrCode: getQRCode(),
      clientInfo: status.info
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});
