import { Router } from 'express';
import * as db from '../db';

const router = Router();

// POST /api/whatsapp/groups - Recebe dados de grupos do backend Docker
router.post('/groups', async (req, res) => {
  try {
    const { sessionId, groupId, groupName, lastMessageAt } = req.body;

    if (!groupId || !groupName) {
      return res.status(400).json({ error: 'groupId and groupName are required' });
    }

    // TODO: Map sessionId to connectionId from database
    const connectionId = 0;

    await db.upsertWhatsappGroup(groupId, groupName, connectionId);

    res.json({ success: true });
  } catch (error) {
    console.error('[WhatsApp Groups] Error saving group:', error);
    res.status(500).json({ error: 'Failed to save group' });
  }
});

export default router;
