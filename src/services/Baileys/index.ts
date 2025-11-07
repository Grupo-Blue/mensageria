import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import socket from '../../libs/socket';
import groupStore from './groupStore';
import messageStore from './messageStore';
import { saveGroupInfo } from './saveGroupInfo';

interface ConnectionInterface {
  id: string;
  connection: any;
  connected: boolean;
}

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
  const io = socket.getIO();
  removeConnection(id);
  const dir = path.resolve(
    process.cwd(),
    'auth_info_baileys',
    id,
  );

  const { state, saveCreds } = await useMultiFileAuthState(dir);

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('presence.update', data => console.log('presence.update', data));

  sock.ev.on('connection.update', update => {
    if (update.qr) {
      io.emit('qrcode', {
        id,
        qrcode: update.qr,
        connected: false,
      });
    } else {
      io.emit('qrcode', {
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

      if (shouldReconnect) {
        removeConnection(id);
        void addConnection(id);
      } else {
        const authDir = path.resolve(
          process.cwd(),
          'auth_info_baileys',
          id,
        );
        fs.rmdir(authDir, { recursive: true }, err => {
          if (err) {
            console.log(err);
          }
          console.log(`${dir} is deleted!`);
        });
        removeConnection(id);
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
  const identifications = process.env.IDENTIFICATION?.split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (!identifications || identifications.length === 0) {
    await addConnection('mensageria');
    return;
  }

  await Promise.all(identifications.map(identifier => addConnection(identifier)));
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
}: SendMessageParamsInterface): Promise<void> => {
  const sessionId = process.env.IDENTIFICATION?.split(',')[0]?.trim() || 'mensageria';
  const connection = getConnection(sessionId);
  if (!connection) {
    throw new Error('Conexão não encontrada para envio de mensagem!');
  }
  let phoneNumber = toPhone.replace(/[^0-9]+/g, '');
  if (phoneNumber.length === 11) {
    phoneNumber = `55${phoneNumber.slice(0, 2)}${phoneNumber.slice(3, 11)}`;
  } else if (phoneNumber.length === 13) {
    phoneNumber = `${phoneNumber.slice(0, 4)}${phoneNumber.slice(5, 13)}`;
  }

  const [isWhatsapp] = await connection.onWhatsApp(phoneNumber);
  if (isWhatsapp?.exists) {
    phoneNumber = isWhatsapp.jid;
  } else {
    throw new Error('Este número não está cadastrado no Whatsapp');
  }

  const sended = await connection.sendMessage(phoneNumber, {
    text: message,
  });

  return sended;
};

export default connect;
