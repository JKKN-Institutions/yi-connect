/**
 * LID Resolution Routes - Category 6 (6 endpoints)
 * LIDs are privacy-preserving identifiers WhatsApp uses instead of phone numbers
 */

import { Router } from 'express';
import {
  resolveLid,
  resolvePhoneToLid,
  resolveBatchLids,
  getLidCacheStats,
  listLidMappings,
  populateLidCache
} from '../whatsapp';

export const lidRoute = Router();

// GET /lid/resolve - Resolve LID to phone
lidRoute.get('/resolve', async (req, res) => {
  try {
    const lid = req.query.lid as string;

    if (!lid) {
      return res.status(400).json({
        success: false,
        error: 'lid query parameter is required'
      });
    }

    const result = resolveLid(lid);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'LID not found in cache'
      });
    }

    res.json({
      success: true,
      lid,
      ...result
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /lid/phone - Resolve phone to LID
lidRoute.get('/phone', async (req, res) => {
  try {
    const phone = req.query.phone as string;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'phone query parameter is required'
      });
    }

    const lid = resolvePhoneToLid(phone);

    if (!lid) {
      return res.status(404).json({
        success: false,
        error: 'Phone number not found in cache'
      });
    }

    res.json({
      success: true,
      phone,
      lid
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /lid/batch - Batch resolve LIDs and phones
lidRoute.post('/batch', async (req, res) => {
  try {
    const { lids, phones } = req.body;

    const result = resolveBatchLids(lids || [], phones || []);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /lid/stats - Get LID cache statistics
lidRoute.get('/stats', async (req, res) => {
  try {
    const stats = getLidCacheStats();

    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /lid/mappings - List all LID mappings
lidRoute.get('/mappings', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const mappings = listLidMappings(limit);

    res.json({
      success: true,
      mappings,
      count: mappings.length
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /lid/populate - Populate LID cache from groups
lidRoute.post('/populate', async (req, res) => {
  try {
    const result = await populateLidCache();

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});
