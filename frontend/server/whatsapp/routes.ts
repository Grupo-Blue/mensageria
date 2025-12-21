import { Router } from 'express';
import axios from 'axios';
import * as db from '../db';

const router = Router();

const BACKEND_API_URL = process.env.BACKEND_API_URL || process.env.VITE_BACKEND_API_URL || 'http://localhost:3001';

// POST /api/whatsapp/send-message - API REST pública para enviar mensagens
router.post('/send-message', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const { connectionName, to, message } = req.body;

    // Validar API Key
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'API Key não fornecida. Use o header X-API-Key.' });
    }

    // Validar campos obrigatórios
    if (!connectionName || !to || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campos obrigatórios: connectionName, to, message' 
      });
    }

    // Buscar usuário pela API Key
    const user = await db.getUserByApiKey(apiKey);
    if (!user) {
      // Tentar buscar conexão pela API Key (para compatibilidade)
      const connectionByKey = await db.getWhatsappConnectionByApiKey(apiKey);
      if (!connectionByKey) {
        return res.status(403).json({ success: false, error: 'API Key inválida' });
      }
      // Se encontrou conexão pela API Key, usar ela diretamente
      if (connectionByKey.identification !== connectionName) {
        return res.status(403).json({ 
          success: false, 
          error: 'API Key não tem permissão para esta conexão' 
        });
      }
      // Usar a conexão encontrada pela API Key
      const connection = connectionByKey;
      
      if (connection.status !== 'connected') {
        return res.status(400).json({ 
          success: false, 
          error: `Conexão "${connectionName}" não está ativa. Status: ${connection.status}` 
        });
      }

      // Enviar mensagem via backend
      const apiToken = process.env.BACKEND_API_TOKEN;
      if (!apiToken) {
        console.error('[API send-message] BACKEND_API_TOKEN não configurado');
        return res.status(500).json({ success: false, error: 'Configuração do servidor incompleta' });
      }

      console.log('[API send-message] Enviando para:', `${BACKEND_API_URL}/whatsapp?token=${connectionName}`);

      await axios.post(
        `${BACKEND_API_URL}/whatsapp?token=${connectionName}`,
        { phone: to, message: message },
        { headers: { 'x-auth-api': apiToken }, timeout: 30000 }
      );

      // Registrar mensagem no banco
      await db.createMessage({
        userId: connection.userId,
        platform: 'whatsapp',
        connectionId: connection.id,
        recipient: to,
        content: message,
        status: 'sent'
      });

      return res.json({
        success: true,
        message: 'Mensagem enviada',
        data: {
          to: to.includes('@') ? to : `${to}@s.whatsapp.net`,
          sentAt: new Date().toISOString()
        }
      });
    }

    // Buscar conexão pelo nome (identification)
    const connections = await db.getWhatsappConnections(user.id);
    const connection = connections.find(c => c.identification === connectionName);
    
    if (!connection) {
      return res.status(404).json({ 
        success: false, 
        error: `Conexão "${connectionName}" não encontrada` 
      });
    }

    // Verificar se está conectada
    if (connection.status !== 'connected') {
      return res.status(400).json({ 
        success: false, 
        error: `Conexão "${connectionName}" não está ativa. Status: ${connection.status}` 
      });
    }

    // Enviar mensagem via backend
    const apiToken = process.env.BACKEND_API_TOKEN;
    if (!apiToken) {
      console.error('[API send-message] BACKEND_API_TOKEN não configurado');
      return res.status(500).json({ success: false, error: 'Configuração do servidor incompleta' });
    }

    console.log('[API send-message] Enviando para:', `${BACKEND_API_URL}/whatsapp?token=${connectionName}`);

    const response = await axios.post(
      `${BACKEND_API_URL}/whatsapp?token=${connectionName}`,
      { phone: to, message: message },
      { headers: { 'x-auth-api': apiToken }, timeout: 30000 }
    );

    // Registrar mensagem no banco
    await db.createMessage({
      userId: user.id,
      platform: 'whatsapp',
      connectionId: connection.id,
      recipient: to,
      content: message,
      status: 'sent'
    });

    res.json({
      success: true,
      message: 'Mensagem enviada',
      data: {
        to: to.includes('@') ? to : `${to}@s.whatsapp.net`,
        sentAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[API send-message] Erro:', error.message, error.response?.data);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        success: false, 
        error: 'Backend WhatsApp não disponível' 
      });
    }
    
    if (error.response?.status === 401) {
      return res.status(500).json({ 
        success: false, 
        error: 'Erro de autenticação com o backend' 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.message || error.message || 'Erro ao enviar mensagem' 
    });
  }
});

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
