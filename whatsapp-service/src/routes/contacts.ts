/**
 * Contacts Routes - Part of Category 2
 */

import { Router } from 'express';
import { searchContacts, getContactChats, getLastInteraction } from '../whatsapp';

export const contactsRoute = Router();

// GET /contacts/search - Search contacts
contactsRoute.get('/search', async (req, res) => {
  try {
    const query = req.query.query as string;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'query parameter is required'
      });
    }

    const contacts = await searchContacts(query);

    res.json({
      success: true,
      contacts,
      count: contacts.length
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /contacts/:jid/chats - Get all chats involving contact
contactsRoute.get('/:jid/chats', async (req, res) => {
  try {
    const { jid } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const page = parseInt(req.query.page as string) || 0;

    const chats = await getContactChats(jid, limit, page);

    res.json({
      success: true,
      chats,
      count: chats.length
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /contacts/:jid/last - Get last interaction
contactsRoute.get('/:jid/last', async (req, res) => {
  try {
    const { jid } = req.params;
    const message = await getLastInteraction(jid);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'No messages found'
      });
    }

    res.json({
      success: true,
      message
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});
