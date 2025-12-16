import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import socket from '../../libs/socket';
import messageStore from './messageStore';
import { saveGroupInfo } from './saveGroupInfo';
import settingsStore from '../settingsStore';
import tokenCache from '../tokenCache';

interface ConnectionInterface {
  id: string;
  connection: any;
  connected: boolean;
}


/**
 * Generate HMAC signature for webhook payload
 */
const generateWebhookSignature = (payload: string, secret: string): string => {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};

/**
 * Forward received message to webhook
 * Priority:
 * 1. Connection-specific webhook (from tokenCache)
 * 2. Legacy settings webhook (fallback)
 */
const forwardToWebhook = async (connectionName: string, from: string, messageId: string, text: string) => {
  try {
    // Try to get connection-specific webhook config first
    let webhookUrl: string | null = null;
    let webhookSecret: string | null = null;

    const webhookConfig = tokenCache.getWebhookConfig(connectionName);
    if (webhookConfig?.url) {
      webhookUrl = webhookConfig.url;
      webhookSecret = webhookConfig.secret;
      console.log('[Webhook] Usando webhook específico da conexão:', connectionName);
    } else {
      // Fallback to legacy settings
      const settings = await settingsStore.getSettings();
      webhookUrl = settings.webhook_url;
      console.log('[Webhook] Usando webhook global (legacy)');
    }

    if (!webhookUrl) {
      console.log('[Webhook] URL não configurada para conexão:', connectionName);
      return;
    }

    console.log('[Webhook] Enviando para:', webhookUrl);

    const payload = {
      connection_name: connectionName,
      from,
      message_id: messageId,
      timestamp: new Date().toISOString(),
      text
    };

    const payloadString = JSON.stringify(payload);

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Connection-Name': connectionName,
    };

    // Add authorization with webhook secret
    if (webhookSecret) {
      headers['Authorization'] = `Bearer ${webhookSecret}`;
      headers['X-Webhook-Signature'] = generateWebhookSignature(payloadString, webhookSecret);
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: AbortSignal.timeout(10000)
    });

    if (response.ok) {
      console.log('[Webhook] Mensagem encaminhada com sucesso:', from);
    } else {
      const errorText = await response.text();
      console.log('[Webhook] Erro HTTP', response.status, errorText);
    }
  } catch (error: any) {
    console.error('[Webhook] Erro ao encaminhar:', error.message);
  }
};

const connections: ConnectionInterface[] = [];

const updateConnectionStatus = (id: string, status: boolean): void => {
  const target = connections.find(connectionItem => connectionItem.id === id);
  if (target) {
    target.connected = status;
  }
};
const groupNameCache = new Map<string, string>();

const closeBaileysConnection = (connection: any): void => {
  if (!connection) {
    return;
  }

  try {
    connection?.end?.();
  } catch (error) {
    console.error('Erro ao encerrar conexão Baileys com end():', error);
  }

  try {
    connection?.ws?.close?.();
  } catch (error) {
    console.error('Erro ao encerrar WebSocket do Baileys:', error);
  }
};

export const removeConnection = (id: string): void => {
  const index = connections.findIndex(c => c.id === id);
  if (index !== -1) {
    closeBaileysConnection(connections[index].connection);
    connections.splice(index, 1);
  }
};

export const addConnection = async (id: string): Promise<void> => {
  console.log('Entrou no addConnection')
  const io = socket.getIO();
  removeConnection(id);
  const dir = path.resolve(
    process.cwd(),
    'auth_info_baileys',
    id,
  );

  const { state, saveCreds } = await useMultiFileAuthState(dir);

  const sock = makeWASocket({
    // version,
    printQRInTerminal: true,
    auth: state,
    // patchMessageBeforeSending: msg => {
    //   let message = msg;
    //   const requiresPatch = !!(
    //     message.buttonsMessage ||
    //     // || message.templateMessage
    //     message.listMessage
    //   );
    //   if (requiresPatch) {
    //     message = {
    //       viewOnceMessage: {
    //         message: {
    //           messageContextInfo: {
    //             deviceListMetadataVersion: 2,
    //             deviceListMetadata: {},
    //           },
    //           ...message,
    //         },
    //       },
    //     };
    //   }

    //   return message;
    // },
  });

  // store?.bind(sock.ev);
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  sock.ev.on('creds.update', saveCreds);
  // sock.ev.on('chats.set', data => console.log('chats.set', data));
  // sock.ev.on('messages.set', data => console.log('messages.set', data));
  // sock.ev.on('contacts.set', data => console.log('contacts.set', data));
  // sock.ev.on('chats.upsert', data => console.log('chats.upsert', data));
  // sock.ev.on('chats.update', data => console.log('chats.update', data));
  // sock.ev.on('chats.delete', data => console.log('chats.delete', data));
  sock.ev.on('presence.update', data => console.log('presence.update', data));
  // sock.ev.on('contacts.upsert', data => console.log('contacts.upsert', data));
  // sock.ev.on('contacts.update', data => console.log('contacts.update', data));
  // sock.ev.on('messages.delete', data => console.log('messages.delete', data));
  // sock.ev.on('messages.update', data => console.log('messages.update', data));
  // sock.ev.on('messages.media-update', data =>
  //   console.log('messages.media-update', data),
  // );
  // sock.ev.on('messages.reaction', data =>
  //   console.log('messages.reaction', data),
  // );
  // sock.ev.on('message-receipt.update', data =>
  //   console.log('message-receipt.update', data),
  // );
  // sock.ev.on('groups.upsert', data => console.log('groups.upsert', data));
  // sock.ev.on('groups.update', data => console.log('groups.update', data));
  // sock.ev.on('group-participants.update', data =>
  //   console.log('group-participants.update', data),
  // );
  // sock.ev.on('blocklist.set', data => console.log('blocklist.set', data));
  // sock.ev.on('blocklist.update', data => console.log('blocklist.update', data));
  // sock.ev.on('call', data => console.log('call', data));



  sock.ev.on('connection.update', update => {
    if (update.qr) {
      io.emit(`qrcode`, {
        id,
        qrcode: update.qr,
        connected: false,
      });
    } else {
      io.emit(`qrcode`, {
        id,
        qrcode: null,
        connected: true,
      });
    }
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      updateConnectionStatus(id, false);
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      // reconnect if not logged out
      if (shouldReconnect) {
        removeConnection(id);
        addConnection(id);
      } else {
        const authDir = path.resolve(
          process.cwd(),
          'auth_info_baileys',
          id,
        );
        fs.rm(authDir, { recursive: true, force: true }, err => {
          if (err) {
            console.log(err);
          }
          console.log(`${authDir} is deleted!`);
        });
        removeConnection(id);
        addConnection(id);
      }
    } else if (connection === 'open') {
      console.log('Conexão aberta para o usuário', id);
      updateConnectionStatus(id, true);
    }
  });
  sock.ev.on('messages.upsert', async m => {
    console.log(
      'messages.upsert>>>>>>>>',
      new Date().toISOString(),
      JSON.stringify(m, undefined, 2),
    );

    try {
      if (m.type !== 'notify' || !m.messages?.length) {
        return;
      }

      for (const msg of m.messages) {
        const remoteJid = msg.key?.remoteJid;
        
        // NOVO: Processar mensagens individuais (não-grupo) para webhook
        if (remoteJid && remoteJid.endsWith('@s.whatsapp.net')) {
          const from = remoteJid;
          const messageId = msg.key?.id || 'unknown';
          const messageText =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption ||
            '';
          
          // Ignorar mensagens vazias ou de mídia sem texto
          if (messageText && messageText.trim()) {
            console.log('[Webhook] Mensagem individual recebida de:', from);
            await forwardToWebhook(id, from, messageId, messageText);
          }
          
          continue; // Pular para próxima mensagem
        }
        
if (!remoteJid || !remoteJid.endsWith('@g.us')) {
          continue;
        }

        const groupId = remoteJid;
        const sender = msg.pushName || msg.key?.participant || 'Desconhecido';

        let groupName = groupNameCache.get(groupId);
        if (!groupName) {
          try {
            const groupMetadata = await sock.groupMetadata(groupId);
            groupName = groupMetadata.subject || 'Grupo sem nome';
            groupNameCache.set(groupId, groupName);
          } catch (error) {
            console.log(
              `Não foi possível obter metadata do grupo ${groupId}:`,
              error,
            );
            groupName = 'Grupo sem nome';
          }
        }

        groupName = groupName ?? 'Grupo sem nome';

        const messageTimestamp = msg.messageTimestamp
          ? Number(msg.messageTimestamp) * 1000
          : Date.now();

        try {
          await saveGroupInfo({
            sessionId: id,
            groupId,
            groupName,
            lastMessageAt: new Date(messageTimestamp),
          });
        } catch (error) {
          console.error(
            `Falha ao salvar informações do grupo ${groupId}:`,
            error,
          );
        }

        console.log(
          '🔔 [GRUPO DETECTADO] ID:',
          groupId,
          '| Nome:',
          groupName,
          '| Remetente:',
          sender,
        );

        const messageText =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          '[Mídia ou mensagem especial]';

        messageStore.addMessage(groupId, sender, messageText, messageTimestamp);
      }
    } catch (error) {
      console.error('[ERRO] Falha ao processar mensagem:', error);
    }
  });
  connections.push({
    id,
    connection: sock,
    connected: false,
  });
};

const connect = async (): Promise<void> => {
    await addConnection(process.env.IDENTIFICATION ?? 'mensageria');
};

export const getConnection = (id: string): any => {
  const connection = connections.find(c => c.id === id);
  if (!connection) {
    throw new Error('connection not found');
  }
  return connection.connection;
};

export const listConnections = (): Array<{ id: string; connected: boolean }> =>
  connections.map(({ id: connectionId, connected }) => ({
    id: connectionId,
    connected,
  }));

interface SendMessageParamsInterface {
  toPhone: string;
  message: string;
  identification?: string;
}
interface TemplateButtonInterface {
  index: number;
  urlButton?: {
    displayText: string;
    url: string;
  };
  callButton?: {
    displayText: string;
    phoneNumber: string;
  };
  quickReplyButton?: {
    displayText: string;
    id: 'id-like-buttons-message';
  };
}

interface ButtonInterface {
  buttonId: string;
  buttonText: {
    displayText: string;
    phoneNumber?: string;
    url?: string;
  };
  type: number;
}
export interface ButtonMessageInterface {
  text: string;
  footer?: string;
  buttons: ButtonInterface[];
  headerType: number;
  image?: {
    url: string;
  };
}

export interface TemplateMessageInterface {
  text: string;
  footer?: string;
  templateButtons?: TemplateButtonInterface[];
  buttonMessage?: TemplateButtonInterface[];
  image?: {
    url: string;
  };
  viewOnce?: boolean;
}

export const sendMessage = async ({
  toPhone,
  message,
  identification,
}: SendMessageParamsInterface): Promise<void> => {
  console.log('[sendMessage] Iniciando envio:', { toPhone, identification });
  
  const connectionId = identification || process.env.IDENTIFICATION || 'mensageria';
  const connection = getConnection(connectionId)
  
  if (!connection) {
    console.error('[sendMessage] Conexão não encontrada:', connectionId);
    throw new Error('Conexão não encontrada para envio de mensagem!');
  }
  
  console.log('[sendMessage] Conexão encontrada:', connectionId);
  
  let phoneNumber = toPhone.replace(/[^0-9]+/g, '');
  if (phoneNumber.length === 11) {
    phoneNumber = `55${phoneNumber.slice(0, 2)}${phoneNumber.slice(3, 11)}`;
  } else if (phoneNumber.length === 13) {
    phoneNumber = `${phoneNumber.slice(0, 4)}${phoneNumber.slice(5, 13)}`;
  }
  
  console.log('[sendMessage] Número formatado:', phoneNumber);

  // Tentar verificar se o número está no WhatsApp com timeout
  try {
    console.log('[sendMessage] Verificando se número está no WhatsApp...');
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT_CHECK')), 10000);
    });
    
    const [isWhatsapp] = await Promise.race([
      connection.onWhatsApp(phoneNumber),
      timeoutPromise
    ]);
    
    console.log('[sendMessage] Resultado verificação:', isWhatsapp);
    
    if (isWhatsapp?.exists) {
      phoneNumber = isWhatsapp.jid
      console.log('[sendMessage] Número válido, JID:', phoneNumber);
    } else {
      console.error('[sendMessage] Número não cadastrado:', phoneNumber);
      throw new Error('Este número não está cadastrado no Whatsapp')
    }
  } catch (error: any) {
    if (error.message === 'TIMEOUT_CHECK') {
      // Se timeout na verificação, tenta enviar mesmo assim com formato padrão
      console.warn('[sendMessage] Timeout na verificação, tentando enviar sem validação...');
      phoneNumber = `${phoneNumber}@s.whatsapp.net`;
    } else {
      throw error;
    }
  }

  // Enviar mensagem com timeout
  try {
    console.log('[sendMessage] Enviando mensagem para:', phoneNumber);
    const sendTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout ao enviar mensagem')), 15000);
    });
    
    const sended = await Promise.race([
      connection.sendMessage(phoneNumber, { text: message }),
      sendTimeoutPromise
    ]);
    
    console.log('[sendMessage] Mensagem enviada com sucesso:', sended);
    return sended;
    
  } catch (error: any) {
    console.error('[sendMessage] Erro ao enviar:', error.message);
    throw error;
  }
};

export default connect;
