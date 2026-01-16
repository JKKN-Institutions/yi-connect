/**
 * Profile Routes - Category 7 (5 endpoints)
 */

import { Router } from 'express';
import {
  getProfilePicture,
  setStatusMessage,
  getUserInfo,
  getBusinessProfile
} from '../whatsapp';

export const profileRoute = Router();

// PATCH /profile/status - Set status message
profileRoute.patch('/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'status is required'
      });
    }

    await setStatusMessage(status);

    res.json({
      success: true,
      message: 'Status updated'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /profile/:jid/picture - Get profile picture
profileRoute.get('/:jid/picture', async (req, res) => {
  try {
    const { jid } = req.params;
    const url = await getProfilePicture(jid);

    if (!url) {
      return res.status(404).json({
        success: false,
        error: 'Profile picture not found'
      });
    }

    res.json({
      success: true,
      url
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /users/info - Get detailed user info
profileRoute.post('/users/info', async (req, res) => {
  try {
    const { jids } = req.body;

    if (!jids || !Array.isArray(jids)) {
      return res.status(400).json({
        success: false,
        error: 'jids array is required'
      });
    }

    const users = await getUserInfo(jids);

    res.json({
      success: true,
      users
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /business/:jid - Get business profile
profileRoute.get('/business/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    const profile = await getBusinessProfile(jid);

    res.json({
      success: true,
      profile
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});
