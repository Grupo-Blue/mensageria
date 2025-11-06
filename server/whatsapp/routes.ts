import { Router } from 'express';
import * as db from '../db';

const router = Router();

// POST /api/whatsapp/groups - Recebe dados de grupos do backend Docker
router.post('/groups', async (req, res) => {
  try {
    const { sessionId, groupId, groupName, lastMessageAt } = req.body;

    if (!sessionId || !groupId || !groupName) {
      return res.status(400).json({ error: 'sessionId, groupId and groupName are required' });
    }

    const timestamp = lastMessageAt ? new Date(lastMessageAt) : undefined;
    await db.upsertWhatsappGroup(sessionId, groupId, groupName, timestamp);

    res.json({ success: true });
  } catch (error) {
    console.error('[WhatsApp Groups] Error saving group:', error);
    res.status(500).json({ error: 'Failed to save group' });
  }
});

export default router;
