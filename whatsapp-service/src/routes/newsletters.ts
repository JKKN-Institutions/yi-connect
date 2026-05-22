/**
 * Newsletters Routes - Category 5 (7 endpoints)
 * Note: Newsletter support requires specific whatsapp-web.js version
 */

import { Router } from 'express';
import {
  listSubscribedNewsletters,
  getNewsletterInfo,
  previewNewsletterLink,
  followNewsletter,
  unfollowNewsletter,
  reactToNewsletterMessage,
  createNewsletter
} from '../whatsapp';

export const newslettersRoute = Router();

// GET /newsletters - List subscribed newsletters
newslettersRoute.get('/', async (req, res) => {
  try {
    const newsletters = await listSubscribedNewsletters();

    res.json({
      success: true,
      newsletters,
      count: newsletters.length
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /newsletters - Create newsletter
newslettersRoute.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'name is required'
      });
    }

    const result = await createNewsletter(name, description);

    res.json({
      success: true,
      newsletter: result
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /newsletters/preview - Preview newsletter from link
newslettersRoute.get('/preview', async (req, res) => {
  try {
    const inviteLink = req.query.invite_link as string;

    if (!inviteLink) {
      return res.status(400).json({
        success: false,
        error: 'invite_link query parameter is required'
      });
    }

    const result = await previewNewsletterLink(inviteLink);

    res.json({
      success: true,
      newsletter: result
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /newsletters/:jid - Get newsletter info
newslettersRoute.get('/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    const newsletter = await getNewsletterInfo(jid);

    res.json({
      success: true,
      newsletter
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /newsletters/:jid/follow - Follow newsletter
newslettersRoute.post('/:jid/follow', async (req, res) => {
  try {
    const { jid } = req.params;
    await followNewsletter(jid);

    res.json({
      success: true,
      message: 'Followed newsletter'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /newsletters/:jid/unfollow - Unfollow newsletter
newslettersRoute.post('/:jid/unfollow', async (req, res) => {
  try {
    const { jid } = req.params;
    await unfollowNewsletter(jid);

    res.json({
      success: true,
      message: 'Unfollowed newsletter'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /newsletters/:jid/react - React to newsletter message
newslettersRoute.post('/:jid/react', async (req, res) => {
  try {
    const { jid } = req.params;
    const { server_id, message_id, reaction } = req.body;

    if (server_id === undefined || !message_id || reaction === undefined) {
      return res.status(400).json({
        success: false,
        error: 'server_id, message_id, and reaction are required'
      });
    }

    await reactToNewsletterMessage(jid, server_id, message_id, reaction);

    res.json({
      success: true,
      message: reaction ? 'Reaction added' : 'Reaction removed'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});
