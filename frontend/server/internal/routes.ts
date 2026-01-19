/**
 * Internal API routes for backend-to-frontend communication
 * These routes are protected by an internal token
 */

import { Router } from 'express';
import * as db from '../db';

const router = Router();

const INTERNAL_TOKEN = process.env.INTERNAL_SYNC_TOKEN || process.env.BACKEND_API_TOKEN;

/**
 * Middleware to validate internal token
 */
const validateInternalToken = (req: any, res: any, next: any) => {
  const token = req.headers['x-internal-token'];

  if (!INTERNAL_TOKEN) {
    return res.status(500).json({ error: 'Internal token not configured' });
  }

  if (!token || token !== INTERNAL_TOKEN) {
    return res.status(401).json({ error: 'Invalid internal token' });
  }

  next();
};

/**
 * GET /api/internal/connections
 * Returns all WhatsApp connections with their API keys and webhook configs
 * Used by backend to sync token cache
 */
router.get('/connections', validateInternalToken, async (_req, res) => {
  try {
    const connections = await db.getAllWhatsappConnectionsWithWebhooks();

    res.json({ connections });
  } catch (error: any) {
    console.error('[Internal API] Error fetching connections:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/internal/connections/:id/status
 * Update connection status from backend
 */
router.post('/connections/:id/status', validateInternalToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, phoneNumber } = req.body;

    await db.updateWhatsappConnectionByIdentification(id, {
      status,
      phoneNumber,
      lastConnectedAt: status === 'connected' ? new Date() : undefined,
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Internal API] Error updating connection status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/internal/webhook-log
 * Log a webhook call from backend
 */
router.post('/webhook-log', validateInternalToken, async (req, res) => {
  try {
    const { connectionName, fromNumber, messageId, text, status, response, errorMessage } = req.body;

    await db.createWebhookLog({
      connectionName,
      fromNumber,
      messageId,
      text,
      status,
      response,
      errorMessage,
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Internal API] Error creating webhook log:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
















