/**
 * Multi-tenant connection routes
 * New endpoints for managing connections with per-connection API keys
 */

import { Router, Response } from 'express';
import { multiTenantAuth, requireConnection, AuthenticatedRequest } from '../../middlewares/multiTenantAuth.js';
import {
  addConnection,
  removeConnection,
  logoutConnection,
  getConnection,
  listConnections,
  sendMessage,
} from '../../services/Baileys/index.js';
import tokenCache from '../../services/tokenCache.js';

const router = Router();

/**
 * GET /connections
 * List all connections (filtered by API key if using per-connection auth)
 */
router.get('/', multiTenantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const connections = listConnections();

    // If authenticated with connection-specific API key, filter to that connection only
    if (req.tenant?.identification) {
      const filtered = connections.filter(c => c.id === req.tenant!.identification);
      return res.json(filtered);
    }

    // Legacy mode: return all connections
    return res.json(connections);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /connections/:connectionId
 * Get a specific connection's status
 */
router.get('/:connectionId', multiTenantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId } = req.params;

    // Verify authorization for this connection
    if (req.tenant?.identification && req.tenant.identification !== connectionId) {
      return res.status(403).json({ error: 'Não autorizado para esta conexão' });
    }

    const connections = listConnections();
    const connection = connections.find(c => c.id === connectionId);

    if (!connection) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    return res.json(connection);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /connections/:connectionId/connect
 * Initialize/reconnect a WhatsApp connection
 */
router.post('/:connectionId/connect', multiTenantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId } = req.params;

    // Verify authorization for this connection
    if (req.tenant?.identification && req.tenant.identification !== connectionId) {
      return res.status(403).json({ error: 'Não autorizado para esta conexão' });
    }

    await addConnection(connectionId);

    return res.json({
      success: true,
      message: 'Conexão iniciada. Aguarde o QR Code via Socket.IO.',
      connectionId,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /connections/:connectionId/disconnect
 * Disconnect a WhatsApp connection (keeps session for reconnect)
 */
router.post('/:connectionId/disconnect', multiTenantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId } = req.params;

    // Verify authorization for this connection
    if (req.tenant?.identification && req.tenant.identification !== connectionId) {
      return res.status(403).json({ error: 'Não autorizado para esta conexão' });
    }

    removeConnection(connectionId);

    return res.json({
      success: true,
      message: 'Conexão desconectada.',
      connectionId,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /connections/:connectionId/logout
 * Full logout: disconnect and delete session files (forces new QR code)
 */
router.post('/:connectionId/logout', multiTenantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId } = req.params;

    // Verify authorization for this connection
    if (req.tenant?.identification && req.tenant.identification !== connectionId) {
      return res.status(403).json({ error: 'Não autorizado para esta conexão' });
    }

    logoutConnection(connectionId);

    return res.json({
      success: true,
      message: 'Logout completo. Sessão removida, um novo QR Code será necessário.',
      connectionId,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /connections/:connectionId/send
 * Send a message through a specific connection
 */
router.post('/:connectionId/send', multiTenantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Campos phone e message são obrigatórios' });
    }

    // Verify authorization for this connection
    if (req.tenant?.identification && req.tenant.identification !== connectionId) {
      return res.status(403).json({ error: 'Não autorizado para esta conexão' });
    }

    // Check if connection exists and is connected
    const connections = listConnections();
    const connection = connections.find(c => c.id === connectionId);

    if (!connection) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    if (!connection.connected) {
      return res.status(400).json({ error: 'Conexão não está ativa. Reconecte primeiro.' });
    }

    const result = await sendMessage({
      toPhone: phone,
      message,
      identification: connectionId,
    });

    return res.json({
      success: true,
      message: 'Mensagem enviada com sucesso',
      data: result,
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /connections/sync
 * Force sync token cache from frontend
 */
router.post('/sync', multiTenantAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    await tokenCache.forceRefresh();

    return res.json({
      success: true,
      message: 'Cache de tokens sincronizado',
      connections: tokenCache.getAllConnections().length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
















