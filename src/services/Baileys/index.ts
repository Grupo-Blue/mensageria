import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import socket from '../../libs/socket';

interface ConnectionInterface {
  id: string;
  connection: any;
}

const connections: ConnectionInterface[] = [];

export const removeConnection = (id: string): void => {
  const index = connections.findIndex(c => c.id === id);
  if (index !== -1) {
    // connections[index].connection.close();
    connections.splice(index, 1);
  }
};

export const addConnection = async (id: string): Promise<void> => {
  console.log('Entrou no addConnection')
  const io = socket.getIO();
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
        fs.rmdir(authDir, { recursive: true }, err => {
          if (err) {
            console.log(err);
          }
          console.log(`${dir} is deleted!`);
        });
        removeConnection(id);
        addConnection(id);
      }
    } else if (connection === 'open') {
      console.log('Conexão aberta para o usuário', id);
    }
  });
  sock.ev.on('messages.upsert', m => {
    console.log(
      'messages.upsert>>>>>>>>',
      new Date().toISOString(),
      JSON.stringify(m, undefined, 2),
    );

    console.log('replying to', m.messages[0].key.remoteJid);
    // sock.sendMessage(m.messages[0].key.remoteJid!, {
    //   text: 'Hello there!',
    // });
  });
  connections.push({
    id,
    connection: sock,
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
  const connection = getConnection(process.env.IDENTIFICATION ?? 'mensageria')
  if (!connection) {
    throw new Error('Conexão não encontrada para envio de mensagem!');
  }
  let phoneNumber = toPhone.replace(/[^0-9]+/g, '');
  if (phoneNumber.length === 11) {
    phoneNumber = `55${phoneNumber.slice(0, 2)}${phoneNumber.slice(3, 11)}`;
  } else if (phoneNumber.length === 13) {
    phoneNumber = `${phoneNumber.slice(0, 4)}${phoneNumber.slice(5, 13)}`;
  }

  const [isWhatsapp] = await connection.onWhatsApp(phoneNumber)
  if (isWhatsapp?.exists) {
      phoneNumber = isWhatsapp.jid
  } else {
      throw new Error('Este número não está cadastrado no Whatsapp')
  }

  const sended = await connection.sendMessage(phoneNumber, {
    text: message,
  })

  return sended
};

export default connect;
