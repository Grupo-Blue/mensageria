/**
 * Multi-tenant connection routes
 * New endpoints for managing connections with per-connection API keys
 */

import { Router, Response } from 'express';
import { multiTenantAuth, requireConnection, AuthenticatedRequest } from '../../middlewares/multiTenantAuth.js';
import { rateLimit, apiKeyOrIpKey } from '../../middlewares/rateLimit.js';
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

// Rate limit do envio direto: 120 mensagens/minuto por chave (~2/seg, abaixo do
// risco de banimento sustentado). Para volume maior, usar o disparo em massa.
const sendRateLimit = rateLimit({
  name: 'connections-send',
  windowMs: 60_000,
  max: 120,
  keyFn: apiKeyOrIpKey,
});

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
 * Initialize/reconnect a WhatsApp connection.
 *
 * Body opcional: `{ proxy: { host, port, username, password } }` — quando
 * presente, o socket Baileys sai por esse proxy estático (Webshare). O proxy
 * é memorizado para sobreviver a reconexões automáticas.
 */
router.post('/:connectionId/connect', multiTenantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId } = req.params;
    const proxyBody = req.body?.proxy;

    // Verify authorization for this connection
    if (req.tenant?.identification && req.tenant.identification !== connectionId) {
      return res.status(403).json({ error: 'Não autorizado para esta conexão' });
    }

    let proxy: { host: string; port: number; username: string; password: string } | undefined;
    if (proxyBody && typeof proxyBody === 'object') {
      const { host, port, username, password } = proxyBody as { host?: string; port?: number | string; username?: string; password?: string };
      if (host && port && username && password) {
        // Valida que a porta é um inteiro válido (1–65535). Sem isso, NaN ou
        // valores fora do range chegariam até o HttpsProxyAgent e causariam
        // falhas de conexão difíceis de diagnosticar.
        const parsedPort = Number(port);
        if (Number.isFinite(parsedPort) && parsedPort >= 1 && parsedPort <= 65535) {
          proxy = { host, port: parsedPort, username, password };
        } else {
          console.warn(`[connect] proxy descartado: porta inválida (${port})`);
        }
      }
    }

    await addConnection(connectionId, proxy ? { proxy } : undefined);

    return res.json({
      success: true,
      message: 'Conexão iniciada. Aguarde o QR Code via Socket.IO.',
      connectionId,
      proxyApplied: !!proxy,
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
router.post('/:connectionId/send', sendRateLimit, multiTenantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { phone, message, mediaUrl, mediaType, mediaFileName, mediaMimeType } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Campo phone é obrigatório' });
    }
    // Texto OU mídia precisa estar presente
    if (!message && !mediaUrl) {
      return res.status(400).json({ error: 'Envie message ou mediaUrl (com mediaType)' });
    }
    if (mediaUrl && !['image', 'document', 'audio'].includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType deve ser image, document ou audio' });
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
      message: message || '',
      identification: connectionId,
      mediaUrl,
      mediaType,
      mediaFileName,
      mediaMimeType,
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
















