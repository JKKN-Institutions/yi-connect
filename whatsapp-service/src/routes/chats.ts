/**
 * Chats Routes - Part of Category 2
 */

import { Router } from 'express';
import { listChats, getChat, getDirectChatByContact, markRead } from '../whatsapp';

export const chatsRoute = Router();

// GET /chats - List all chats
chatsRoute.get('/', async (req, res) => {
  try {
    const filter = {
      query: req.query.query as string,
      limit: parseInt(req.query.limit as string) || 20,
      page: parseInt(req.query.page as string) || 0,
      includeLastMessage: req.query.include_last_message !== 'false',
      sortBy: (req.query.sort_by as 'last_active' | 'name') || 'last_active'
    };

    const result = await listChats(filter);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /chats/by-phone/:phone - Get DM by phone number
chatsRoute.get('/by-phone/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const chat = await getDirectChatByContact(phone);

    res.json({
      success: true,
      chat
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /chats/:jid - Get specific chat
chatsRoute.get('/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    const includeLastMessage = req.query.include_last_message !== 'false';

    const chat = await getChat(jid, includeLastMessage);

    res.json({
      success: true,
      chat
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /chats/:jid/read - Mark messages as read
chatsRoute.post('/:jid/read', async (req, res) => {
  try {
    const { jid } = req.params;
    const { message_ids, sender } = req.body;

    if (!message_ids || !Array.isArray(message_ids)) {
      return res.status(400).json({
        success: false,
        error: 'message_ids array is required'
      });
    }

    await markRead(jid, message_ids, sender);

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});
